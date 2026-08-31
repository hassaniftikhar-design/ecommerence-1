import { OrderStatus } from "@prisma/client";
import { type ValidationResult } from "./validation.middleware";

export function validateOrderStatusInput(status: unknown): ValidationResult<OrderStatus> {
  const validStatuses = Object.values(OrderStatus);

  if (typeof status !== "string" || !validStatuses.includes(status as OrderStatus)) {
    return {
      success: false,
      status: 400,
      errors: [],
      message: "Invalid status value",
    };
  }

  return {
    success: true,
    data: status as OrderStatus,
  };
}

export function validateOrderIdInput(id: unknown): ValidationResult<string> {
  if (typeof id !== "string" || !id.trim()) {
    return {
      success: false,
      status: 400,
      errors: [],
      message: "Order ID is required",
    };
  }

  return {
    success: true,
    data: id.trim(),
  };
}

export interface ValidatedCreateOrderInput {
  itemIds?: string[];
  expectedTotal?: number;
}

export function validateCreateOrderInput(
  itemIds?: unknown,
  expectedTotal?: unknown
): ValidationResult<ValidatedCreateOrderInput> {
  let cleanItemIds: string[] | undefined = undefined;
  if (Array.isArray(itemIds)) {
    cleanItemIds = itemIds.filter((id): id is string => typeof id === "string" && id.trim().length > 0);
  }

  let cleanExpectedTotal: number | undefined = undefined;
  if (typeof expectedTotal === "number" && !isNaN(expectedTotal) && expectedTotal >= 0) {
    cleanExpectedTotal = expectedTotal;
  }

  return {
    success: true,
    data: {
      itemIds: cleanItemIds,
      expectedTotal: cleanExpectedTotal,
    },
  };
}
