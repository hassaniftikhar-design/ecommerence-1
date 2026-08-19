import { getCurrentUser } from "@/lib/server-auth";
import { apiSuccess, apiError } from "@/lib/api-response";
import { changePasswordServer } from "@/server/services/auth.service";

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser(request);
    if (!user || !user.sub) {
      return apiError("Unauthorized", [], 401);
    }

    const body = await request.json();
    const result = await changePasswordServer(user.sub, body);

    if (!result.success) {
      return apiError(result.message, result.errors, result.status);
    }

    return apiSuccess(result.message);
  } catch (error) {
    return apiError("An internal server error occurred", [(error as Error).message], 500);
  }
}
