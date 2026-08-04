import { writeFile, mkdir } from "fs/promises";
import { join } from "path";
import { getCurrentUser, isAdmin } from "@/lib/server-auth";
import { apiSuccess, apiError } from "@/lib/api-response";
import { isCloudinaryConfigured, uploadToCloudinary } from "@/lib/cloudinary";

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser(request);

    if (!user || !isAdmin(user)) {
      return apiError("Forbidden: Only ADMIN users can upload images", [], 403);
    }

    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return apiError("No file uploaded", [], 400);
    }

    const allowedTypes = ["image/jpeg", "image/png", "image/webp", "image/gif", "image/svg+xml"];
    if (!allowedTypes.includes(file.type)) {
      return apiError("Invalid file type. Allowed types: JPEG, PNG, WEBP, GIF, SVG", [], 400);
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const filename = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.-]/g, "_")}`;

    // 1. Upload to Cloudinary if credentials are configured in .env
    if (isCloudinaryConfigured()) {
      try {
        const cloudinaryResult = await uploadToCloudinary(buffer, "ecommerce_products");
        return apiSuccess("Image uploaded successfully to Cloudinary", { url: cloudinaryResult.url }, 201);
      } catch (cloudinaryErr) {
        console.error("Cloudinary upload failed, falling back to local storage:", cloudinaryErr);
      }
    }

    // 2. Fallback to local filesystem storage (/public/uploads/)
    const uploadsDir = join(process.cwd(), "public", "uploads");
    await mkdir(uploadsDir, { recursive: true });
    const filePath = join(uploadsDir, filename);

    await writeFile(filePath, buffer);
    const fileUrl = `/uploads/${filename}`;

    return apiSuccess("Image uploaded successfully to local storage", { url: fileUrl }, 201);
  } catch (error) {
    return apiError("Failed to upload image", [(error as Error).message], 500);
  }
}
