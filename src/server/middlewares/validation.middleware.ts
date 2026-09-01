import { z } from 'zod';

export interface ValidationSuccess<T> {
  success: true;
  data: T;
}

export interface ValidationError {
  success: false;
  status: 400;
  errors: string[];
  message: string;
}

export type ValidationResult<T> = ValidationSuccess<T> | ValidationError;

/**
 * Validates arbitrary input against a Zod schema and formats any issues into a standardized error response.
 */
export function validateWithSchema<T>(
  schema: z.ZodType<T>,
  data: unknown
): ValidationResult<T> {
  const parsed = schema.safeParse(data);

  if (!parsed.success) {
    const issueErrors = parsed.error.issues.map(
      (issue) => `${issue.path.join('.')}: ${issue.message}`
    );
    const errorMessage = issueErrors.join(', ') || 'Validation failed';
    return {
      success: false,
      status: 400,
      errors: issueErrors,
      message: errorMessage
    };
  }

  return {
    success: true,
    data: parsed.data
  };
}
