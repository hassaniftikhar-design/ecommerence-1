import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';

import { isCloudinaryConfigured, uploadToCloudinary } from '@/lib/cloudinary';
import { validateUploadFileInput } from '@/server/middlewares';

export async function uploadProductImageServer(file: unknown) {
  const validation = validateUploadFileInput(file);
  if (!validation.success) {
    return validation;
  }

  const validatedFile = validation.data;
  const bytes = await validatedFile.arrayBuffer();
  const buffer = Buffer.from(bytes);
  const filename = `${Date.now()}-${validatedFile.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;

  // 1. Upload to Cloudinary if credentials are configured in .env
  if (isCloudinaryConfigured()) {
    try {
      const cloudinaryResult = await uploadToCloudinary(buffer, 'ecommerce_products');
      return {
        success: true as const,
        status: 201,
        message: 'Image uploaded successfully to Cloudinary',
        url: cloudinaryResult.url
      };
    } catch (cloudinaryErr) {
      console.error('Cloudinary upload failed, falling back to local storage:', cloudinaryErr);
    }
  }

  // 2. Fallback to local filesystem storage (/public/uploads/)
  const uploadsDir = join(process.cwd(), 'public', 'uploads');
  await mkdir(uploadsDir, { recursive: true });
  const filePath = join(uploadsDir, filename);

  await writeFile(filePath, buffer);
  const fileUrl = `/uploads/${filename}`;

  return {
    success: true as const,
    status: 201,
    message: 'Image uploaded successfully to local storage',
    url: fileUrl
  };
}
