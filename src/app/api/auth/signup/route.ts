import { hash } from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { signupSchema } from "@/lib/validators";
import { apiSuccess, apiError } from "@/lib/api-response";

export const dynamic = "force-dynamic";  /// i added this bcz it only contain post method during run build adn when server tries to get sttic page data it throws not found 

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = signupSchema.safeParse(body);

    if (!parsed.success) {
      const issueErrors = parsed.error.issues.map(
        (issue) => `${issue.path.join(".")}: ${issue.message}`
      );
      return apiError("Validation failed", issueErrors, 400);
    }

    const { fullName, email, mobile, password } = parsed.data;
    const normalizedEmail = email.toLowerCase().trim();

    const existingUser = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (existingUser) {
      return apiError("A user with this email already exists", [], 409);
    }

    const hashedPassword = await hash(password, 12);

    const user = await prisma.user.create({
      data: {
        name: fullName,
        email: normalizedEmail,
        phone: mobile,
        password: hashedPassword,
      },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        role: true,
        createdAt: true,
      },
    });

    return apiSuccess("Account created successfully", { user }, 201);
  } catch (error) {
    return apiError("An internal server error occurred during signup", [
      (error as Error).message,
    ], 500);
  }
}
