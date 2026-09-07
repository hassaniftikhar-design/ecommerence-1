
import type { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import GoogleProvider from 'next-auth/providers/google';
import FacebookProvider from 'next-auth/providers/facebook';
import { compare } from 'bcryptjs';
import { getServerSession as getNextAuthServerSession } from 'next-auth/next';

import { prisma } from '@/lib/prisma';
import { stripe } from '@/lib/stripe/stripe-server';
import { logStripeError } from '@/lib/stripe/errors';
import { createFacebookPendingTokenServer } from '@/server/services/facebook-auth.service';
import {
  SESSION_COOKIE_MAX_AGE_SECONDS,
  SESSION_DURATION_REMEMBER_ME_MS,
  SESSION_DURATION_DEFAULT_MS
} from '@/constants';

const googleClientId = process.env.GOOGLE_CLIENT_ID;
const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET;

const facebookClientId = process.env.FACEBOOK_CLIENT_ID || process.env.AUTH_FACEBOOK_ID;
const facebookClientSecret = process.env.FACEBOOK_CLIENT_SECRET || process.env.AUTH_FACEBOOK_SECRET;

const providers: NextAuthOptions['providers'] = [
  CredentialsProvider({
    name: 'Credentials',

    credentials: {
      email: {
        label: 'Email',
        type: 'email'
      },
      password: {
        label: 'Password',
        type: 'password'
      },
      rememberMe: {
        label: 'Remember Me',
        type: 'text'
      }
    },

    async authorize(credentials) {
      if (!credentials?.email || !credentials.password) {
        return null;
      }

      const user = await prisma.user.findUnique({
        where: {
          email: credentials.email.toLowerCase()
        }
      });

      if (!user || !user.isActive || !user.password) {
        return null;
      }

      const isValidPassword = await compare(
        credentials.password,
        user.password
      );

      if (!isValidPassword) {
        return null;
      }

      const isRememberMe =
        credentials.rememberMe === 'true' ||
        credentials.rememberMe === '1';

      return {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        rememberMe: isRememberMe
      };
    }
  })
];

if (googleClientId && googleClientSecret) {
  providers.unshift(
    GoogleProvider({
      clientId: googleClientId,
      clientSecret: googleClientSecret
    })
  );
}

if (facebookClientId && facebookClientSecret) {
  providers.unshift(
    FacebookProvider({
      clientId: facebookClientId,
      clientSecret: facebookClientSecret
    })
  );
}

export const authOptions: NextAuthOptions = {
  session: {
    strategy: 'jwt',
    maxAge: SESSION_COOKIE_MAX_AGE_SECONDS
  },

  providers,

  callbacks: {
    async signIn({ user, account }) {
      if (account?.provider === 'google') {
        if (!user.email) {
          return false;
        }

        const normalizedEmail = user.email.toLowerCase();

        let existingUser = await prisma.user.findUnique({
          where: {
            email: normalizedEmail
          }
        });

        if (!existingUser) {
          let stripeCustomerId: string | null = null;
          try {
            const customer = await stripe.customers.create({
              email: normalizedEmail,
              name: user.name || 'Google User'
            });
            stripeCustomerId = customer.id;
          } catch (stripeErr) {
            logStripeError('authOptions:googleSignIn:stripe.customers.create', stripeErr, {
              email: normalizedEmail
            });
          }

          existingUser = await prisma.user.create({
            data: {
              email: normalizedEmail,
              name: user.name || 'Google User',
              phone: null,
              password: null,
              emailVerified: new Date(),
              role: 'USER',
              isActive: true,
              stripeCustomerId
            }
          });
        } else if (!existingUser.isActive) {
          return false;
        }

        if (account.providerAccountId) {
          await prisma.account.upsert({
            where: {
              provider_providerAccountId: {
                provider: account.provider,
                providerAccountId: account.providerAccountId
              }
            },

            update: {
              access_token: account.access_token,
              id_token: account.id_token,
              refresh_token: account.refresh_token,
              expires_at: account.expires_at,
              token_type: account.token_type,
              scope: account.scope
            },

            create: {
              userId: existingUser.id,
              type: account.type,
              provider: account.provider,
              providerAccountId: account.providerAccountId,
              access_token: account.access_token,
              id_token: account.id_token,
              refresh_token: account.refresh_token,
              expires_at: account.expires_at,
              token_type: account.token_type,
              scope: account.scope
            }
          });
        }
      }

      if (account?.provider === 'facebook') {
        if (user.email) {
          const normalizedEmail = user.email.toLowerCase();

          const existingAccount = await prisma.account.findUnique({
            where: {
              provider_providerAccountId: {
                provider: 'facebook',
                providerAccountId: account.providerAccountId
              }
            }
          });

          if (existingAccount) {
            const linkedUser = await prisma.user.findUnique({
              where: { id: existingAccount.userId }
            });

            if (!linkedUser || !linkedUser.isActive) {
              return false;
            }

            await prisma.account.update({
              where: { id: existingAccount.id },
              data: {
                access_token: account.access_token,
                id_token: account.id_token,
                refresh_token: account.refresh_token,
                expires_at: account.expires_at,
                token_type: account.token_type,
                scope: account.scope
              }
            });

            return true;
          }

          let existingUser = await prisma.user.findUnique({
            where: {
              email: normalizedEmail
            }
          });

          if (!existingUser) {
            let stripeCustomerId: string | null = null;
            try {
              const customer = await stripe.customers.create({
                email: normalizedEmail,
                name: user.name || 'Facebook User'
              });
              stripeCustomerId = customer.id;
            } catch (stripeErr) {
              logStripeError('authOptions:facebookSignIn:stripe.customers.create', stripeErr, {
                email: normalizedEmail
              });
            }

            existingUser = await prisma.user.create({
              data: {
                email: normalizedEmail,
                name: user.name || 'Facebook User',
                phone: null,
                password: null,
                emailVerified: new Date(),
                role: 'USER',
                isActive: true,
                stripeCustomerId
              }
            });
          } else if (!existingUser.isActive) {
            return false;
          }

          if (account.providerAccountId) {
            await prisma.account.upsert({
              where: {
                provider_providerAccountId: {
                  provider: account.provider,
                  providerAccountId: account.providerAccountId
                }
              },

              update: {
                userId: existingUser.id,
                access_token: account.access_token,
                id_token: account.id_token,
                refresh_token: account.refresh_token,
                expires_at: account.expires_at,
                token_type: account.token_type,
                scope: account.scope
              },

              create: {
                userId: existingUser.id,
                type: account.type,
                provider: account.provider,
                providerAccountId: account.providerAccountId,
                access_token: account.access_token,
                id_token: account.id_token,
                refresh_token: account.refresh_token,
                expires_at: account.expires_at,
                token_type: account.token_type,
                scope: account.scope
              }
            });
          }

          return true;
        }

        // Facebook provided NO email
        const existingAccount = await prisma.account.findUnique({
          where: {
            provider_providerAccountId: {
              provider: 'facebook',
              providerAccountId: account.providerAccountId
            }
          }
        });

        if (existingAccount) {
          // Subsequent login without email - account already linked!
          const linkedUser = await prisma.user.findUnique({
            where: { id: existingAccount.userId }
          });

          if (!linkedUser || !linkedUser.isActive) {
            return false;
          }

          await prisma.account.update({
            where: { id: existingAccount.id },
            data: {
              access_token: account.access_token,
              id_token: account.id_token,
              refresh_token: account.refresh_token,
              expires_at: account.expires_at,
              token_type: account.token_type,
              scope: account.scope
            }
          });

          return true;
        }

        // First-time Facebook login with missing email:
        // Create secure temporary session token and redirect to email verification
        const pendingToken = await createFacebookPendingTokenServer(
          account.providerAccountId,
          user.name
        );

        return `/facebook-email?pendingToken=${encodeURIComponent(pendingToken)}`;
      }

      return true;
    },

    async jwt({ token, user, account }) {
      /*
       * This block runs when the JWT is initially created
       * after a successful login.
       */
      if (user) {
        const isRememberMe =
          (user as { rememberMe?: boolean }).rememberMe === true;

        const sessionDuration = isRememberMe
          ? SESSION_DURATION_REMEMBER_ME_MS
          : SESSION_DURATION_DEFAULT_MS;

        token.rememberMe = isRememberMe;

        token.sessionExpiresAt = Date.now() + sessionDuration;

        /*
         * Credentials login.
         */
        if (account?.provider !== 'google' && account?.provider !== 'facebook') {
          token.id = user.id;
          token.role = user.role;
          token.email = user.email;
        }

        /*
         * Google login.
         */
        if (account?.provider === 'google' && user.email) {
          const dbUser = await prisma.user.findUnique({
            where: {
              email: user.email.toLowerCase()
            }
          });

          if (dbUser) {
            token.id = dbUser.id;
            token.role = dbUser.role;
            token.email = dbUser.email;
          }
        }

        /*
         * Facebook login.
         */
        if (account?.provider === 'facebook') {
          if (user.email) {
            const dbUser = await prisma.user.findUnique({
              where: {
                email: user.email.toLowerCase()
              }
            });

            if (dbUser) {
              token.id = dbUser.id;
              token.role = dbUser.role;
              token.email = dbUser.email;
            }
          } else if (account.providerAccountId) {
            const dbAccount = await prisma.account.findUnique({
              where: {
                provider_providerAccountId: {
                  provider: 'facebook',
                  providerAccountId: account.providerAccountId
                }
              },
              include: { user: true }
            });

            if (dbAccount?.user) {
              token.id = dbAccount.user.id;
              token.role = dbAccount.user.role;
              token.email = dbAccount.user.email;
            }
          }
        }
      }

      /*
       * Do NOT invalidate the token here.
       *
       * Expiration is enforced by middleware and server-side
       * authorization using token.sessionExpiresAt.
       */
      return token;
    },

    // async session({ session, token }) {
    //   if (session.user && token.id) {
    //     session.user.id = token.id;
    //     session.user.role = token.role!;
    //     session.user.rememberMe = token.rememberMe;
    //     session.user.sessionExpiresAt = token.sessionExpiresAt;
    //   }

    //   return session;
    // },
    async session({ session, token }) {
      if (session.user && token.id) {
        session.user.id = token.id;
        session.user.role = token.role!;
        session.user.rememberMe = token.rememberMe ?? false;
        session.user.sessionExpiresAt = token.sessionExpiresAt!;
      }

      return session;
    }
  },

  pages: {
    signIn: '/login',
    error: '/login'
  },

  secret: process.env.NEXTAUTH_SECRET
};

export async function getServerAuthSession() {
  return getNextAuthServerSession(authOptions);
}
