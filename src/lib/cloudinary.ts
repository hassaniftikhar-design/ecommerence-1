import { v2 as cloudinary } from 'cloudinary';

const CLOUD_NAME = process.env.CLOUDINARY_CLOUD_NAME;
const API_KEY = process.env.CLOUDINARY_API_KEY;
const API_SECRET = process.env.CLOUDINARY_API_SECRET;

export function isCloudinaryConfigured(): boolean {
  return Boolean(
    CLOUD_NAME &&
      API_KEY &&
      API_SECRET &&
      CLOUD_NAME.trim() !== '' &&
      API_KEY.trim() !== '' &&
      API_SECRET.trim() !== ''
  );
}

if (isCloudinaryConfigured()) {
  cloudinary.config({
    cloud_name: CLOUD_NAME,
    api_key: API_KEY,
    api_secret: API_SECRET,
    secure: true
  });
}

export async function uploadToCloudinary(
  buffer: Buffer,
  folder = 'ecommerce_products'
): Promise<{ publicId: string; url: string }> {
  if (!isCloudinaryConfigured()) {
    throw new Error('Cloudinary credentials are not configured in environment variables.');
  }

  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder,
        resource_type: 'image'
      },
      (error, result) => {
        if (error || !result) {
          return reject(error || new Error('Failed to upload image to Cloudinary'));
        }
        resolve({
          publicId: result.public_id,
          url: result.secure_url
        });
      }
    );

    uploadStream.end(buffer);
  });
}
