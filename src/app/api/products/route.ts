import { getCurrentUser, isAdmin } from "@/lib/server-auth";
import { apiSuccess, apiError } from "@/lib/api-response";
import {
  getProductsServer,
  createProductServer,
} from "@/server/services/product.service";
import { PRODUCT_FETCH_BATCH_SIZE } from "@/constants/generalconstants";

export async function GET(request: Request) {
  try {
    const user = await getCurrentUser(request);
    const userIsAdmin = Boolean(user && isAdmin(user));

    const { searchParams } = new URL(request.url);
    const searchQuery = (searchParams.get("search") || searchParams.get("q") || "").trim();
    const categoryQuery = (searchParams.get("category") || "").trim();
    const sortQuery = searchParams.get("sort") || "newest";
    const statusQuery = searchParams.get("status") || (userIsAdmin ? "all" : "active");

    const pageParam = searchParams.get("page");
    const limitParam = searchParams.get("limit");
    const isPaginatedCall = Boolean(pageParam || limitParam || (userIsAdmin && searchParams.has("page")));

    const pageNumber = Math.max(1, parseInt(pageParam || "1", 10) || 1);
    const limitNumber = Math.max(
      1,
      Math.min(100, parseInt(limitParam || String(PRODUCT_FETCH_BATCH_SIZE), 10) || PRODUCT_FETCH_BATCH_SIZE)
    );

    const result = await getProductsServer({
      searchQuery,
      categoryQuery,
      sortQuery,
      statusQuery,
      pageNumber,
      limitNumber,
      isPaginatedCall,
      userIsAdmin,
    });

    return apiSuccess("Products retrieved successfully", result);
  } catch (error) {
    return apiError("Failed to fetch products", [(error as Error).message], 500);
  }
}

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser(request);

    if (!user || !isAdmin(user)) {
      return apiError("Forbidden: Only ADMIN users can create products", [], 403);
    }

    const body = await request.json();
    const adminUserId = (user.id || user.sub)!;

    const result = await createProductServer(body, adminUserId);

    if (!result.success) {
      return apiError(result.message, result.errors, result.status);
    }

    return apiSuccess("Product created successfully", { product: result.product }, result.status);
  } catch (error) {
    return apiError("Failed to create product", [(error as Error).message], 500);
  }
}
