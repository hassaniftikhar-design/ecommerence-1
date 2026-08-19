import { apiSuccess, apiError } from "@/lib/api-response";
import { forgotPasswordServer } from "@/server/services/auth.service";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const result = await forgotPasswordServer(body);

    if (!result.success) {
      return apiError(result.message, result.errors, result.status);
    }

    return apiSuccess(result.message);
  } catch (error) {
    return apiError("An internal server error occurred", [(error as Error).message], 500);
  }
}
