import { randomBytes } from "crypto";
import { prisma } from "@/lib/prisma";
import { forgotPasswordSchema } from "@/lib/validators";
import { sendResetPasswordEmail } from "@/lib/email";
import { apiSuccess, apiError } from "@/lib/api-response";
import { PASSWORD_RESET_EXPIRATION_MINUTES } from "@/constants";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = forgotPasswordSchema.safeParse(body);

    if (!parsed.success) {
      const issueErrors = parsed.error.issues.map(
        (issue) => `${issue.path.join(".")}: ${issue.message}`
      );
      return apiError("Validation failed", issueErrors, 400);
    }

    const { email } = parsed.data;
    const normalizedEmail = email.toLowerCase().trim();

    const user = await prisma.user.findUnique({ where: { email: normalizedEmail } });

    if (!user) {
      return apiError("This email does not exist in our Store.", [], 404);
    }

    const token = randomBytes(32).toString("hex");
    const expiresAt = new Date(
      Date.now() + PASSWORD_RESET_EXPIRATION_MINUTES * 60 * 1000
    );

    await prisma.passwordResetToken.create({
      data: {
        token,
        userId: user.id,
        expiresAt,
      },
    });

    try {
      await sendResetPasswordEmail(user.email, token);
    } catch (emailErr) {
      console.error("Failed to send reset email:", emailErr);
      return apiError("Failed to send password reset email. Please try again later.", [], 500);
    }

    return apiSuccess(
      "Password reset instructions have been sent to your email."
    );
  } catch (error) {
    return apiError("An internal server error occurred", [(error as Error).message], 500);
  }
}
