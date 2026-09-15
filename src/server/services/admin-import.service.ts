import { randomUUID } from 'crypto';

import ExcelJS from 'exceljs';

import {
  COLOR_OPTIONS,
  SIZE_OPTIONS
} from '@/constants/generalconstants';
import { cleanupImportStorage, saveUploadedImportFiles } from '@/lib/import-storage';
import { prisma } from '@/lib/prisma';
import { emitToUser } from '@/lib/socket/server';
import { schedulerClient } from '@/services/scheduler/scheduler.client';

/**
 * Generates an Excel XLSX workbook for bulk product importing with
 * active DB category validation dropdowns.
 */
export async function generateBulkProductImportTemplateServer(): Promise<Buffer> {
  const dbCategories = await prisma.category.findMany({
    orderBy: { name: 'asc' },
    select: { name: true }
  });

  const categoryNames =
    dbCategories.length > 0
      ? dbCategories.map((category) => category.name)
      : [
        'Apparel',
        'Electronics',
        'Footwear',
        'Accessories',
        'Kitchen',
        'General'
      ];

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Ecommerce Admin';
  workbook.created = new Date();

  const templateSheet = workbook.addWorksheet('Product Import Template', {
    views: [{ state: 'frozen', ySplit: 1 }]
  });

  templateSheet.columns = [
    { header: 'title', key: 'title', width: 28 },
    { header: 'sku', key: 'sku', width: 22 },
    { header: 'price', key: 'price', width: 14 },
    { header: 'categoryName', key: 'categoryName', width: 22 },
    { header: 'colorName', key: 'colorName', width: 18 },
    { header: 'sizeName', key: 'sizeName', width: 14 },
    { header: 'stock', key: 'stock', width: 14 },
    { header: 'imagePath', key: 'imagePath', width: 30 }
  ];

  const headerRow = templateSheet.getRow(1);
  headerRow.height = 24;

  headerRow.eachCell((cell) => {
    cell.font = {
      bold: true,
      color: { argb: 'FFFFFFFF' }
    };
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF1E293B' }
    };
    cell.alignment = {
      vertical: 'middle',
      horizontal: 'center'
    };
  });

  const sampleRows = [
    {
      title: 'Classic Heavyweight Tee',
      sku: 'BRAC-001-BLK-M',
      price: 34.99,
      categoryName: categoryNames[0] || 'Apparel',
      colorName: 'Black',
      sizeName: 'M',
      stock: 50,
      imagePath: 'tee_black.jpg'
    },
    {
      title: 'Classic Heavyweight Tee',
      sku: 'BRAC-001-BLK-L',
      price: 34.99,
      categoryName: categoryNames[0] || 'Apparel',
      colorName: 'Black',
      sizeName: 'L',
      stock: 40,
      imagePath: 'tee_black.jpg'
    },
    {
      title: 'Classic Heavyweight Tee',
      sku: 'BRAC-001-WHT-M',
      price: 34.99,
      categoryName: categoryNames[0] || 'Apparel',
      colorName: 'White',
      sizeName: 'M',
      stock: 35,
      imagePath: 'tee_white.jpg'
    },
    {
      title: 'Wireless Ergonomic Keyboard',
      sku: 'KEYB-001-GRY-L',
      price: 129.5,
      categoryName:
        categoryNames.find((category) =>
          category.toLowerCase().includes('elec')
        ) ||
        categoryNames[0] ||
        'Electronics',
      colorName: 'Gray',
      sizeName: 'L',
      stock: 25,
      imagePath: 'keyboard_gray.png'
    },
    {
      title: 'Minimalist Ceramic Mug',
      sku: 'MUG-001-DEF',
      price: 18.0,
      categoryName:
        categoryNames.find((category) =>
          category.toLowerCase().includes('kitch')
        ) ||
        categoryNames[0] ||
        'Kitchen',
      colorName: '',
      sizeName: '',
      stock: 60,
      imagePath: 'mug_standard.png'
    }
  ];

  sampleRows.forEach((row) => {
    templateSheet.addRow(row);
  });

  const categoryList = `"${categoryNames.join(',')}"`;
  const colorList = `"${COLOR_OPTIONS.join(',')}"`;
  const sizeList = `"${SIZE_OPTIONS.join(',')}"`;

  for (let row = 2; row <= 1000; row++) {
    templateSheet.getCell(`D${row}`).dataValidation = {
      type: 'list',
      allowBlank: false,
      formulae: [categoryList],
      showErrorMessage: true,
      errorStyle: 'stop',
      errorTitle: 'Invalid Category',
      error: 'Please select a category from the dropdown.'
    };

    templateSheet.getCell(`E${row}`).dataValidation = {
      type: 'list',
      allowBlank: true,
      formulae: [colorList],
      showErrorMessage: true,
      errorStyle: 'stop',
      errorTitle: 'Invalid Color',
      error: 'Please select a valid color from the dropdown or leave blank for standard.'
    };

    templateSheet.getCell(`F${row}`).dataValidation = {
      type: 'list',
      allowBlank: true,
      formulae: [sizeList],
      showErrorMessage: true,
      errorStyle: 'stop',
      errorTitle: 'Invalid Size',
      error: 'Please select a valid size from the dropdown or leave blank for standard.'
    };
  }

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

/**
 * Generates a clean CSV sample template for bulk product importing.
 */
export async function generateBulkProductImportCsvTemplateServer(): Promise<string> {
  const dbCategories = await prisma.category.findMany({
    orderBy: { name: 'asc' },
    select: { name: true }
  });

  const categoryName = dbCategories[0]?.name ?? 'Apparel';

  const rows = [
    ['title', 'sku', 'price', 'categoryName', 'colorName', 'sizeName', 'stock', 'imagePath'],
    ['Classic Heavyweight Tee', 'BRAC-001-BLK-M', '34.99', categoryName, 'Black', 'M', '50', 'tee_black.jpg'],
    ['Classic Heavyweight Tee', 'BRAC-001-BLK-L', '34.99', categoryName, 'Black', 'L', '40', 'tee_black.jpg'],
    ['Classic Heavyweight Tee', 'BRAC-001-WHT-M', '34.99', categoryName, 'White', 'M', '25', 'tee_white.jpg']
  ];

  return rows.map((r) => r.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(',')).join('\n');
}

/**
 * Resolves a failed product import item and reconciles remaining failures in DB.
 */
export async function resolveImportItemServer(input: {
  itemId: string;
  jobId: string;
  productId?: string;
}) {
  const { itemId, jobId, productId } = input;

  // 1. Update in background scheduler / database
  const res = await schedulerClient.resolveImportItem(jobId, itemId, productId);

  if (!res.success) {
    return {
      success: false as const,
      status: 500,
      message: res.error || 'Failed to resolve import item',
      errors: [res.error || 'Failed to resolve import item']
    };
  }

  // 2. If product_id exists, ensure product is active in DB
  if (productId) {
    await prisma.product.update({
      where: { id: productId },
      data: { isActive: true, inactiveAt: null }
    }).catch((err) => {
      console.warn(`Could not update product ${productId} active status:`, err);
    });
  }

  // 3. Check if all failed items for this job are resolved, and update notification
  const remainingUnresolved = await prisma.importItem.count({
    where: {
      job_id: jobId,
      status: 'FAILED',
      resolution_status: { not: 'RESOLVED' }
    }
  });

  if (remainingUnresolved === 0) {
    await cleanupImportStorage(jobId);

    const job = await prisma.importJob.findUnique({ where: { id: jobId } });
    const filename = job?.filename || 'products.csv';

    const affectedNotifs = await prisma.notification.findMany({
      where: {
        type: 'IMPORT_ERRORS',
        orderId: jobId
      }
    });

    await prisma.notification.updateMany({
      where: {
        type: 'IMPORT_ERRORS',
        orderId: jobId
      },
      data: {
        title: 'Import Errors Resolved',
        message: `All product import errors for ${filename} have been resolved.`,
        isRead: true
      }
    });

    for (const notif of affectedNotifs) {
      const newUnreadCount = await prisma.notification.count({
        where: { userId: notif.userId, isRead: false }
      });
      emitToUser(notif.userId, 'notification:unread-count', { count: newUnreadCount });
    }
  }

  return {
    success: true as const,
    status: 200,
    message: 'Import item marked as resolved successfully',
    data: {
      itemId,
      productId,
      resolutionStatus: 'RESOLVED',
      remainingUnresolved
    }
  };
}

/**
 * Fetches status of an import job.
 */
export async function getImportJobStatusServer(jobId: string) {
  const res = await schedulerClient.getImportJobStatus(jobId);

  if (!res.success || !res.data) {
    return {
      success: false as const,
      status: 404,
      message: res.error || `Import job '${jobId}' not found`,
      errors: [res.error || `Import job '${jobId}' not found`]
    };
  }

  return {
    success: true as const,
    status: 200,
    message: 'Import job status retrieved successfully',
    data: res.data
  };
}

/**
 * Fetches review details and aggregate resolution stats for an import job.
 */
export async function getImportJobReviewServer(jobId: string) {
  const res = await schedulerClient.getImportJobStatus(jobId);

  if (!res.success || !res.data) {
    return {
      success: false as const,
      status: 404,
      message: res.error || `Import job '${jobId}' not found`,
      errors: [res.error || `Import job '${jobId}' not found`]
    };
  }

  const job = res.data;
  const totalFailed = job.failed_items;
  const resolvedCount = job.errors.filter((e) => e.resolution_status === 'RESOLVED').length;
  const remainingCount = totalFailed - resolvedCount;

  return {
    success: true as const,
    status: 200,
    message: 'Import review details retrieved successfully',
    data: {
      job: {
        id: job.id,
        filename: job.filename || 'products.csv',
        status: job.status,
        totalItems: job.total_items,
        processedItems: job.processed_items,
        successfulItems: job.successful_items,
        failedItems: job.failed_items,
        createdAt: job.created_at,
        completedAt: job.completed_at
      },
      summary: {
        totalFailed,
        resolvedCount,
        remainingCount
      },
      errors: job.errors
    }
  };
}

/**
 * Exports CSV content of failed import items for a job.
 */
export async function exportImportErrorsCsvServer(jobId: string) {
  const res = await schedulerClient.getImportJobStatus(jobId);

  if (!res.success || !res.data) {
    return {
      success: false as const,
      status: 404,
      message: 'Import job not found'
    };
  }

  const errors = res.data.errors || [];
  const csvRows = [
    ['Row', 'Product Name', 'Error Type', 'Error Message', 'Resolution Status', 'Product ID'].join(',')
  ];

  for (const err of errors) {
    const rowNum = err.row_index;
    const name = `"${(err.product_name || 'Unnamed').replace(/"/g, '""')}"`;
    const errType = `"${(err.error_type || 'VALIDATION_ERROR').replace(/"/g, '""')}"`;
    const errMsg = `"${(err.error || 'Unknown error').replace(/"/g, '""')}"`;
    const status = `"${(err.resolution_status || 'PENDING').replace(/"/g, '""')}"`;
    const prodId = `"${(err.product_id || '').replace(/"/g, '""')}"`;

    csvRows.push([rowNum, name, errType, errMsg, status, prodId].join(','));
  }

  const csvContent = csvRows.join('\n');
  return {
    success: true as const,
    status: 200,
    csvContent,
    filename: `import-errors-${jobId}.csv`
  };
}

/**
 * Enqueues a multipart CSV/XLSX file upload for bulk import.
 */
export async function enqueueBulkProductImportFileServer(input: {
  adminUserId: string;
  csvFile: File;
  rawImageFiles?: File[];
}) {
  const { adminUserId, csvFile, rawImageFiles = [] } = input;
  const jobId = randomUUID();

  const saved = await saveUploadedImportFiles(jobId, csvFile, rawImageFiles);

  const result = await schedulerClient.enqueueBulkProductImportFile({
    jobId,
    createdById: adminUserId,
    filename: saved.filename,
    csvPath: saved.csvPath,
    imagesPath: saved.imagesPath
  });

  if (!result.success) {
    return {
      success: false as const,
      status: 500,
      message: result.error || 'Failed to queue bulk import job',
      errors: [result.error || 'Failed to queue bulk import job']
    };
  }

  return {
    success: true as const,
    status: 202,
    message: 'Product import has been queued for background processing',
    data: {
      jobId,
      taskId: result.taskId,
      filename: saved.filename,
      status: 'QUEUED'
    }
  };
}

/**
 * Enqueues a JSON payload for bulk import.
 */
export async function enqueueBulkProductImportJsonServer(input: {
  adminUserId: string;
  products: unknown[];
}) {
  const { adminUserId, products } = input;

  const result = await schedulerClient.enqueueBulkProductImport(products, adminUserId);

  if (!result.success) {
    return {
      success: false as const,
      status: 500,
      message: result.error || 'Failed to enqueue bulk import job',
      errors: [result.error || 'Failed to enqueue bulk import job']
    };
  }

  return {
    success: true as const,
    status: 202,
    message: 'Bulk product import job enqueued successfully',
    data: {
      taskId: result.taskId,
      totalCount: products.length,
      status: 'QUEUED'
    }
  };
}
