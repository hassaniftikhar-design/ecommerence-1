import { hash, compare } from "bcryptjs";
import { getCurrentUser } from "@/lib/server-auth";
import { prisma } from "@/lib/prisma";
import { changePasswordSchema } from "@/lib/validators";
import { apiSuccess, apiError } from "@/lib/api-response";

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser(request);
    if (!user || !user.sub) {
      return apiError("Unauthorized", [], 401);
    }

    const body = await request.json();
    const parsed = changePasswordSchema.safeParse(body);

    if (!parsed.success) {
      const issueErrors = parsed.error.issues.map(
        (issue) => `${issue.path.join(".")}: ${issue.message}`
      );
      return apiError("Validation failed", issueErrors, 400);
    }

    const { currentPassword, newPassword } = parsed.data;

    const dbUser = await prisma.user.findUnique({
      where: { id: user.sub },
    });

    if (!dbUser || !dbUser.isActive) {
      return apiError("User not found or inactive", [], 404);
    }

    if (!dbUser.password) {
      return apiError("No password set for this account. Please use password reset.", [], 400);
    }

    const isMatch = await compare(currentPassword, dbUser.password);
    if (!isMatch) {
      return apiError("Incorrect current password", [], 400);
    }

    const newHashedPassword = await hash(newPassword, 12);

    await prisma.user.update({
      where: { id: dbUser.id },
      data: { password: newHashedPassword },
    });

    return apiSuccess("Password updated successfully");
  } catch (error) {
    return apiError("An internal server error occurred", [(error as Error).message], 500);
  }
}
