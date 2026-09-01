import { type ValidationResult } from './validation.middleware';

export interface ValidatedMarkNotificationInput {
  notificationId?: string;
  markAll?: boolean;
}

export function validateMarkNotificationReadInput(
  notificationId?: unknown,
  markAll?: unknown
): ValidationResult<ValidatedMarkNotificationInput> {
  const isMarkAll = Boolean(markAll);
  const cleanNotificationId =
    typeof notificationId === 'string' && notificationId.trim()
      ? notificationId.trim()
      : undefined;

  if (!isMarkAll && !cleanNotificationId) {
    return {
      success: false,
      status: 400,
      errors: [],
      message: 'Missing notificationId or markAll flag'
    };
  }

  return {
    success: true,
    data: {
      notificationId: cleanNotificationId,
      markAll: isMarkAll
    }
  };
}
