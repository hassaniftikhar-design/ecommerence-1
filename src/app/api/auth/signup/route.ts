import { apiSuccess, apiError } from "@/lib/api-response";
import { signupUserServer } from "@/server/services/auth.service";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const result = await signupUserServer(body);

    if (!result.success) {
      return apiError(result.message, result.errors, result.status);
    }

    return apiSuccess(result.message, { user: result.user }, result.status);
  } catch (error) {
    return apiError("An internal server error occurred during signup", [
      (error as Error).message,
    ], 500);
  }
}
