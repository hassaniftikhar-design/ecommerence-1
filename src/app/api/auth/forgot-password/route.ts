import { randomBytes } from "crypto";
import { prisma } from "@/lib/prisma";
import { forgotPasswordSchema } from "@/lib/validators";
import { sendResetPasswordEmail } from "@/lib/email";
import { apiSuccess, apiError } from "@/lib/api-response";

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
      // Return success response to prevent email enumeration
      return apiSuccess(
        "If an account exists with that email, password reset instructions have been sent."
      );
    }

    const token = randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 1000 * 60 * 60); // 1 hour

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
    }

    return apiSuccess(
      "If an account exists with that email, password reset instructions have been sent."
    );
  } catch (error) {
    return apiError("An internal server error occurred", [(error as Error).message], 500);
  }
}
