import { type ValidationResult } from "./validation.middleware";

export function validateCreateCategoryInput(name: unknown): ValidationResult<string> {
  if (typeof name !== "string" || !name.trim()) {
    return {
      success: false,
      status: 400,
      errors: [],
      message: "Category name is required",
    };
  }

  return {
    success: true,
    data: name.trim(),
  };
}
