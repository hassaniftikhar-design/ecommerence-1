import { apiSuccess, apiError } from "@/lib/api-response";
import { getCurrentUser } from "@/lib/server-auth";
import { createSetupIntentServer } from "@/server/services/payment.service";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser(request);
    const userId = user?.id || user?.sub;

    if (!user || !userId) {
      return apiError("Unauthorized: Please log in", [], 401);
    }

    const result = await createSetupIntentServer(userId);

    if (!result.success) {
      return apiError(result.message, result.errors || [], result.status);
    }

    return apiSuccess(result.message, result.data, result.status);
  } catch (error) {
    return apiError("Failed to initialize payment setup", [
      (error as Error).message,
    ], 500);
  }
}
