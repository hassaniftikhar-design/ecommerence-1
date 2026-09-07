import { type ValidationResult } from './validation.middleware';

export const ALLOWED_IMAGE_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/svg+xml'
];

export function validateUploadFileInput(file: unknown): ValidationResult<File> {
  if (!file || !(file instanceof File)) {
    return {
      success: false,
      status: 400,
      errors: ['No file uploaded'],
      message: 'No file uploaded'
    };
  }

  if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
    return {
      success: false,
      status: 400,
      errors: ['Invalid file type. Allowed types: JPEG, PNG, WEBP, GIF, SVG'],
      message: 'Invalid file type. Allowed types: JPEG, PNG, WEBP, GIF, SVG'
    };
  }

  return {
    success: true,
    data: file
  };
}
