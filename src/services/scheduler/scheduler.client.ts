/**
 * Scheduler Client for communicating with the FastAPI + Celery Background Service.
 * Token is kept strictly server-side.
 */

const SCHEDULER_URL = process.env.JOB_SCHEDULER_URL || 'http://localhost:8000';
const INTERNAL_SERVICE_TOKEN = process.env.INTERNAL_SERVICE_TOKEN || 'supersecret_internal_service_token_default';

interface EnqueueResponse {
  task_id: string;
  status: string;
  message: string;
}

export interface ImportJobStatus {
  id: string;
  filename?: string;
  status: string;
  total_items: number;
  processed_items: number;
  successful_items: number;
  failed_items: number;
  created_at: string;
  updated_at: string;
  started_at?: string;
  completed_at?: string;
  errors: Array<{
    id?: string;
    row_index: number;
    product_name?: string;
    error_type?: string;
    error: string;
    product_id?: string;
    resolution_status?: string;
    resolved_at?: string;
    raw_data?: any;
  }>;
}

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
      const errorBody = await res.json().catch(() => ({}));
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
  /**
   * Enqueue password reset email task in background worker.
   */
  async enqueueForgotPasswordEmail(params: {
    userId?: string;
    email?: string;
    resetToken: string;
  }): Promise<{ success: boolean; taskId?: string; error?: string }> {
    const result = await schedulerRequest<EnqueueResponse>('/jobs/forgot-password', {
      method: 'POST',
      body: JSON.stringify({
        user_id: params.userId,
        email: params.email,
        reset_token: params.resetToken
      })
    });

    if (!result.success) {
      return { success: false, error: result.error };
    }
    return { success: true, taskId: result.data?.task_id };
  },

  /**
   * Enqueue Facebook OAuth verification OTP email task in high-priority worker.
   */
  async enqueueFacebookOtpEmail(params: {
    email: string;
    otp: string;
  }): Promise<{ success: boolean; taskId?: string; error?: string }> {
    const result = await schedulerRequest<EnqueueResponse>('/jobs/facebook-otp', {
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

  /**
   * Enqueue order placed confirmation email task.
   */
  async enqueueOrderPlacedEmail(orderId: string): Promise<{ success: boolean; taskId?: string; error?: string }> {
    const result = await schedulerRequest<EnqueueResponse>('/jobs/order-placed', {
      method: 'POST',
      body: JSON.stringify({ order_id: orderId })
    });

    if (!result.success) {
      return { success: false, error: result.error };
    }
    return { success: true, taskId: result.data?.task_id };
  },

  /**
   * Enqueue order status update email task.
   */
  async enqueueOrderStatusEmail(
    orderId: string,
    previousStatus?: string,
    newStatus?: string
  ): Promise<{ success: boolean; taskId?: string; error?: string }> {
    const result = await schedulerRequest<EnqueueResponse>('/jobs/order-status', {
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

  /**
   * Enqueue bulk product import job from durable file paths.
   */
  async enqueueBulkProductImportFile(params: {
    jobId?: string;
    createdById: string;
    filename: string;
    csvPath: string;
    imagesPath?: string;
  }): Promise<{ success: boolean; taskId?: string; error?: string }> {
    const result = await schedulerRequest<EnqueueResponse>('/jobs/product-import', {
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

  /**
   * Enqueue bulk product import job from in-memory products array (backward-compatibility).
   */
  async enqueueBulkProductImport(
    products: unknown[],
    createdById: string
  ): Promise<{ success: boolean; taskId?: string; error?: string }> {
    const result = await schedulerRequest<EnqueueResponse>('/jobs/product-import', {
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

  /**
   * Retrieve bulk product import progress and row errors.
   */
  async getImportJobStatus(
    jobId: string
  ): Promise<{ success: boolean; data?: ImportJobStatus; error?: string }> {
    return schedulerRequest<ImportJobStatus>(`/jobs/product-import/${jobId}`, {
      method: 'GET'
    });
  },

  /**
   * Mark an import error item as resolved after successful product edit/creation.
   */
  async resolveImportItem(
    jobId: string,
    itemId: string,
    productId?: string
  ): Promise<{ success: boolean; data?: any; error?: string }> {
    const query = productId ? `?product_id=${encodeURIComponent(productId)}` : '';
    return schedulerRequest<any>(`/jobs/product-import/${jobId}/items/${itemId}/resolve${query}`, {
      method: 'PATCH'
    });
  }
};
