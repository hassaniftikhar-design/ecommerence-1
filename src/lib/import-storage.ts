import { writeFile, mkdir, rm } from 'fs/promises';
import { join } from 'path';

export interface SavedImportFiles {
  csvPath: string;
  imagesPath?: string;
  filename: string;
}

/**
 * Saves uploaded CSV and accompanying product images to durable storage
 * accessible by the FastAPI scheduler and Celery background workers.
 */
export async function saveUploadedImportFiles(
  jobId: string,
  csvFile: File,
  imageFiles: File[] = []
): Promise<SavedImportFiles> {
  const baseImportsDir = join(process.cwd(), 'storage', 'imports', jobId);
  const imagesDir = join(baseImportsDir, 'images');

  await mkdir(imagesDir, { recursive: true });

  // 1. Save CSV file
  const safeCsvName = csvFile.name.replace(/[^a-zA-Z0-9.-]/g, '_');
  const csvPath = join(baseImportsDir, safeCsvName);
  const csvBytes = await csvFile.arrayBuffer();
  await writeFile(csvPath, Buffer.from(csvBytes));

  // 2. Save individual image files
  let hasImages = false;
  for (const imgFile of imageFiles) {
    const rawName = imgFile.name || '';
    if (!rawName) continue;
    // Strip any folder paths passed by webkitdirectory (e.g., 'productImages/shoe.jpg' -> 'shoe.jpg')
    const baseName = rawName.split('/').pop()?.split('\\').pop() || rawName;
    const safeImgName = baseName.replace(/[^a-zA-Z0-9._-]/g, '_');
    const imgPath = join(imagesDir, safeImgName);
    const imgBytes = await imgFile.arrayBuffer();
    await writeFile(imgPath, Buffer.from(imgBytes));
    hasImages = true;
  }

  return {
    csvPath,
    imagesPath: hasImages ? imagesDir : undefined,
    filename: csvFile.name
  };
}

/**
 * Removes the staging import directory once all items are uploaded or errors resolved.
 */
export async function cleanupImportStorage(jobId: string): Promise<void> {
  try {
    const baseImportsDir = join(process.cwd(), 'storage', 'imports', jobId);
    await rm(baseImportsDir, { recursive: true, force: true });
  } catch (err) {
    console.warn(`[ImportStorage] Failed to cleanup directory for job ${jobId}:`, err);
  }
}

