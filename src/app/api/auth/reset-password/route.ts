import { hash } from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { resetPasswordSchema } from "@/lib/validators";
import { apiSuccess, apiError } from "@/lib/api-response";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get("token");

    if (!token) {
      return apiError("Missing reset token", [], 400);
    }

    const resetToken = await prisma.passwordResetToken.findUnique({
      where: { token },
      include: { user: true },
    });

    if (!resetToken) {
      return apiError("This password reset link is invalid.", [], 400);
    }

    if (resetToken.used) {
      return apiError("This password reset link has already been used.", [], 400);
    }

    if (resetToken.expiresAt.getTime() < Date.now()) {
      return apiError("This password reset link has expired.", [], 400);
    }

    if (!resetToken.user.isActive) {
      return apiError("User account is inactive.", [], 400);
    }

    return apiSuccess("Reset token is valid", { valid: true });
  } catch (error) {
    return apiError("An internal server error occurred", [(error as Error).message], 500);
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = resetPasswordSchema.safeParse(body);

    if (!parsed.success) {
      const issueErrors = parsed.error.issues.map(
        (issue) => `${issue.path.join(".")}: ${issue.message}`
      );
      return apiError("Validation failed", issueErrors, 400);
    }

    const { token, password } = parsed.data;

    const resetToken = await prisma.passwordResetToken.findUnique({
      where: { token },
      include: { user: true },
    });

    if (
      !resetToken ||
      resetToken.used ||
      resetToken.expiresAt.getTime() < Date.now() ||
      !resetToken.user.isActive
    ) {
      return apiError("The reset link is invalid or has expired", [], 400);
    }

    const hashedPassword = await hash(password, 12);

    await prisma.$transaction([
      prisma.user.update({
        where: { id: resetToken.userId },
        data: { password: hashedPassword },
      }),
      prisma.passwordResetToken.update({
        where: { id: resetToken.id },
        data: { used: true },
      }),
    ]);

    return apiSuccess("Password changed successfully");
  } catch (error) {
    return apiError("An internal server error occurred", [(error as Error).message], 500);
  }
}
