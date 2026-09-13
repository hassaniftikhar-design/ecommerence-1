/* eslint-disable @typescript-eslint/no-explicit-any */
jest.mock('next/server', () => {
  class MockNextResponse {
    status: number;
    headers: {
      get: (key: string) => string | null;
      set: (key: string, value: string) => void;
      has: (key: string) => boolean;
      delete: (key: string) => void;
    };
    private _data: any;
    private _headerMap: Map<string, string>;

    constructor(data?: any, init?: { status?: number; headers?: any }) {
      this._data = data;
      this.status = init?.status ?? 200;
      this._headerMap = new Map();
      if (init?.headers) {
        if (typeof init.headers.forEach === 'function') {
          init.headers.forEach((v: string, k: string) => this._headerMap.set(k.toLowerCase(), v));
        } else if (typeof init.headers === 'object') {
          Object.entries(init.headers).forEach(([k, v]) => this._headerMap.set(k.toLowerCase(), String(v)));
        }
      }
      this.headers = {
        get: (key: string) => this._headerMap.get(key.toLowerCase()) ?? null,
        set: (key: string, value: string) => this._headerMap.set(key.toLowerCase(), value),
        has: (key: string) => this._headerMap.has(key.toLowerCase()),
        delete: (key: string) => this._headerMap.delete(key.toLowerCase())
      };
    }

    async json() {
      return this._data;
    }

    static json(data: any, init?: { status?: number; headers?: any }) {
      return new MockNextResponse(data, init);
    }
  }

  return {
    NextResponse: MockNextResponse
  };
});

jest.mock('@/lib/server-auth', () => ({
  getCurrentUser: jest.fn(),
  isAdmin: jest.fn()
}));

jest.mock('@/services/scheduler/scheduler.client', () => ({
  schedulerClient: {
    enqueueBulkProductImport: jest.fn(),
    enqueueBulkProductImportFile: jest.fn()
  }
}));

jest.mock('@/lib/import-storage', () => ({
  saveUploadedImportFiles: jest.fn()
}));

import { POST } from '@/app/api/admin/products/bulk/route';
import { getCurrentUser, isAdmin } from '@/lib/server-auth';
import { schedulerClient } from '@/services/scheduler/scheduler.client';
import { saveUploadedImportFiles } from '@/lib/import-storage';

describe('POST /api/admin/products/bulk', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('rejects unauthenticated or non-admin users with 403', async () => {
    (getCurrentUser as jest.Mock).mockResolvedValue({ id: 'u1', role: 'USER' });
    (isAdmin as jest.Mock).mockReturnValue(false);

    const req = new Request('http://localhost:3000/api/admin/products/bulk', {
      method: 'POST',
      body: JSON.stringify({ products: [] })
    });

    const res = await POST(req);
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.success).toBe(false);
    expect(body.message).toContain('Forbidden');
  });

  it('rejects empty products array in JSON payload with 400', async () => {
    (getCurrentUser as jest.Mock).mockResolvedValue({ id: 'admin1', role: 'ADMIN' });
    (isAdmin as jest.Mock).mockReturnValue(true);

    const req = new Request('http://localhost:3000/api/admin/products/bulk', {
      method: 'POST',
      body: JSON.stringify({ products: [] })
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.success).toBe(false);
  });

  it('successfully enqueues multipart CSV file upload and returns 202 Accepted immediately', async () => {
    (getCurrentUser as jest.Mock).mockResolvedValue({ id: 'admin-123', role: 'ADMIN' });
    (isAdmin as jest.Mock).mockReturnValue(true);
    (saveUploadedImportFiles as jest.Mock).mockResolvedValue({
      filename: 'catalog.csv',
      csvPath: '/abs/path/to/storage/catalog.csv',
      imagesPath: '/abs/path/to/storage/images'
    });
    (schedulerClient.enqueueBulkProductImportFile as jest.Mock).mockResolvedValue({
      success: true,
      jobId: 'job-abc-123',
      taskId: 'celery-task-9988'
    });

    const formData = new FormData();
    const mockFile = new File(['name,price,category\nShirt,29.99,Apparel'], 'catalog.csv', { type: 'text/csv' });
    formData.append('file', mockFile);

    const req = new Request('http://localhost:3000/api/admin/products/bulk', {
      method: 'POST',
      headers: {
        'content-type': 'multipart/form-data'
      }
    });
    (req as any).formData = async () => formData;

    const res = await POST(req);
    expect(res.status).toBe(202);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.taskId).toBe('celery-task-9988');
    expect(body.data.status).toBe('QUEUED');
    expect(schedulerClient.enqueueBulkProductImportFile).toHaveBeenCalledWith(
      expect.objectContaining({
        createdById: 'admin-123',
        filename: 'catalog.csv'
      })
    );
  });

  it('successfully enqueues JSON bulk products and returns 202 Accepted immediately', async () => {
    (getCurrentUser as jest.Mock).mockResolvedValue({ id: 'admin-123', role: 'ADMIN' });
    (isAdmin as jest.Mock).mockReturnValue(true);
    (schedulerClient.enqueueBulkProductImport as jest.Mock).mockResolvedValue({
      success: true,
      taskId: 'celery-task-9988'
    });

    const products = [
      {
        name: 'Running Shoes',
        price: 89.99,
        categoryName: 'Footwear',
        options: [{ name: 'Color', values: ['Black'] }],
        variants: [
          {
            stock: 10,
            images: ['https://example.com/shoe.jpg'],
            attributes: { Color: 'Black', Size: 'M' }
          }
        ]
      }
    ];

    const req = new Request('http://localhost:3000/api/admin/products/bulk', {
      method: 'POST',
      body: JSON.stringify({ products })
    });

    const res = await POST(req);
    expect(res.status).toBe(202);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.taskId).toBe('celery-task-9988');
    expect(body.data.totalCount).toBe(1);

    expect(schedulerClient.enqueueBulkProductImport).toHaveBeenCalledWith(products, 'admin-123');
  });
});
