
import type {
  ImportJobStatus,
  ResolveImportItemResponse,
  SchedulerEnqueueResponse
} from '@/types/product.types';

export type {
  ImportJobStatus,
  ResolveImportItemResponse,
  SchedulerEnqueueResponse
} from '@/types/product.types';

const SCHEDULER_URL = process.env.JOB_SCHEDULER_URL || 'http://localhost:8000';
const INTERNAL_SERVICE_TOKEN = process.env.INTERNAL_SERVICE_TOKEN || 'supersecret_internal_service_token_default';

async function schedulerRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<{ success: boolean; data?: T; error?: string }> {
  const url = `${SCHEDULER_URL.replace(/\/$/, '')}${endpoint}`;
  try {
    const res = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${INTERNAL_SERVICE_TOKEN}`,
        ...(options.headers || {})
      }
    });

    if (!res.ok) {
      const errorBody = (await res.json().catch(() => ({}))) as {
        error?: { message?: string };
        detail?: string;
      };
      const errorMessage =
        errorBody?.error?.message ||
        errorBody?.detail ||
        `Scheduler request failed with status ${res.status}`;
      return { success: false, error: errorMessage };
    }

    const data = (await res.json()) as T;
    return { success: true, data };
  } catch (err) {
    const errorMsg = (err as Error).message || 'Failed to connect to background job scheduler';
    console.warn(`[SchedulerClient] Connection error to ${url}:`, errorMsg);
    return { success: false, error: errorMsg };
  }
}

export const schedulerClient = {

  async enqueueForgotPasswordEmail(params: {
    userId?: string;
    email?: string;
    resetToken: string;
    expiryMinutes?: number;
  }): Promise<{ success: boolean; taskId?: string; error?: string }> {
    const result = await schedulerRequest<SchedulerEnqueueResponse>('/jobs/forgot-password', {
      method: 'POST',
      body: JSON.stringify({
        user_id: params.userId,
        email: params.email,
        reset_token: params.resetToken,
        expiry_minutes: params.expiryMinutes
      })
    });

    if (!result.success) {
      return { success: false, error: result.error };
    }
    return { success: true, taskId: result.data?.task_id };
  },

  async enqueueFacebookOtpEmail(params: {
    email: string;
    otp: string;
  }): Promise<{ success: boolean; taskId?: string; error?: string }> {
    const result = await schedulerRequest<SchedulerEnqueueResponse>('/jobs/facebook-otp', {
      method: 'POST',
      body: JSON.stringify({
        email: params.email,
        otp: params.otp
      })
    });

    if (!result.success) {
      return { success: false, error: result.error };
    }
    return { success: true, taskId: result.data?.task_id };
  },

  async enqueueOrderPlacedEmail(orderId: string): Promise<{ success: boolean; taskId?: string; error?: string }> {
    const result = await schedulerRequest<SchedulerEnqueueResponse>('/jobs/order-placed', {
      method: 'POST',
      body: JSON.stringify({ order_id: orderId })
    });

    if (!result.success) {
      return { success: false, error: result.error };
    }
    return { success: true, taskId: result.data?.task_id };
  },

  async enqueueOrderStatusEmail(
    orderId: string,
    previousStatus?: string,
    newStatus?: string
  ): Promise<{ success: boolean; taskId?: string; error?: string }> {
    const result = await schedulerRequest<SchedulerEnqueueResponse>('/jobs/order-status', {
      method: 'POST',
      body: JSON.stringify({
        order_id: orderId,
        previous_status: previousStatus,
        new_status: newStatus
      })
    });

    if (!result.success) {
      return { success: false, error: result.error };
    }
    return { success: true, taskId: result.data?.task_id };
  },

  async enqueueBulkProductImportFile(params: {
    jobId?: string;
    createdById: string;
    filename: string;
    csvPath: string;
    imagesPath?: string;
  }): Promise<{ success: boolean; taskId?: string; error?: string }> {
    const result = await schedulerRequest<SchedulerEnqueueResponse>('/jobs/product-import', {
      method: 'POST',
      body: JSON.stringify({
        job_id: params.jobId,
        created_by_id: params.createdById,
        filename: params.filename,
        csv_path: params.csvPath,
        images_path: params.imagesPath
      })
    });

    if (!result.success) {
      return { success: false, error: result.error };
    }
    return { success: true, taskId: result.data?.task_id };
  },

  async enqueueBulkProductImport(
    products: unknown[],
    createdById: string
  ): Promise<{ success: boolean; taskId?: string; error?: string }> {
    const result = await schedulerRequest<SchedulerEnqueueResponse>('/jobs/product-import', {
      method: 'POST',
      body: JSON.stringify({
        created_by_id: createdById,
        products
      })
    });

    if (!result.success) {
      return { success: false, error: result.error };
    }
    return { success: true, taskId: result.data?.task_id };
  },

  async getImportJobStatus(
    jobId: string
  ): Promise<{ success: boolean; data?: ImportJobStatus; error?: string }> {
    return schedulerRequest<ImportJobStatus>(`/jobs/product-import/${jobId}`, {
      method: 'GET'
    });
  },

  async resolveImportItem(
    jobId: string,
    itemId: string,
    productId?: string
  ): Promise<{ success: boolean; data?: ResolveImportItemResponse; error?: string }> {
    const query = productId ? `?product_id=${encodeURIComponent(productId)}` : '';
    return schedulerRequest<ResolveImportItemResponse>(`/jobs/product-import/${jobId}/items/${itemId}/resolve${query}`, {
      method: 'PATCH'
    });
  }
};
