import { getColorHex, COLOR_OPTIONS, SIZE_OPTIONS } from '@/constants/generalconstants';

export interface RawCsvRow {
  originalRowIndex: number; // 1-indexed row number in the CSV file
  title: string;
  price: number | string;
  categoryName: string;
  colorName: string;
  sizeName: string;
  stock: number | string;
  sku?: string;
  imagePath: string;
}

export interface ParsedVariant {
  id: string;
  originalRowIndex: number;
  colorName: string;
  colorHex: string;
  sizeName: string;
  stock: number;
  sku: string;
  imagePath: string;
  localFile?: File;
  previewUrl?: string;
  cloudinaryUrl?: string;
  imageMatchStatus: 'matched' | 'unmatched' | 'collision' | 'none';
  errorMessage?: string;
}

export interface GroupedProduct {
  id: string;
  title: string;
  price: number;
  categoryName: string;
  defaultImage: {
    imagePath?: string;
    localFile?: File;
    previewUrl?: string;
    cloudinaryUrl?: string;
    imageMatchStatus?: 'matched' | 'unmatched' | 'collision' | 'none';
  };
  variants: ParsedVariant[];
  warnings: string[];
  errors: string[];
}

export interface FolderImageIndex {
  exactMap: Map<string, File[]>; // filename -> File[]
  collisionFilenames: Set<string>; // filenames that appeared more than once across subfolders
}

/**
 * Builds an index from an uploaded folder / FileList.
 * Detects filename collisions across subfolders.
 */
export function buildFolderImageIndex(files: File[] | FileList): FolderImageIndex {
  const exactMap = new Map<string, File[]>();
  const fileArray = Array.from(files);

  for (const file of fileArray) {
    const filename = file.name.trim();
    if (!filename) continue;

    const existing = exactMap.get(filename) || [];
    existing.push(file);
    exactMap.set(filename, existing);
  }

  const collisionFilenames = new Set<string>();
  exactMap.forEach((matchedFiles, filename) => {
    if (matchedFiles.length > 1) {
      collisionFilenames.add(filename);
    }
  });

  return { exactMap, collisionFilenames };
}

/**
 * Resolves a local File and preview URL for a given imagePath string.
 * Strictly avoids substring/fuzzy matching.
 */
export function resolveImageForPath(
  imagePath: string,
  folderIndex?: FolderImageIndex | null
): {
  localFile?: File;
  previewUrl?: string;
  imageMatchStatus: 'matched' | 'unmatched' | 'collision' | 'none';
  errorMessage?: string;
} {
  const trimmed = (imagePath || '').trim();
  if (!trimmed) {
    return { imageMatchStatus: 'none' };
  }

  // If starts with http:// or https:// or data:
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://') || trimmed.startsWith('data:')) {
    return {
      previewUrl: trimmed,
      imageMatchStatus: 'matched'
    };
  }

  if (!folderIndex) {
    return {
      imageMatchStatus: 'unmatched',
      errorMessage: `Image '${trimmed}' specified but no images folder uploaded`
    };
  }

  // Check collision across subfolders
  if (folderIndex.collisionFilenames.has(trimmed)) {
    return {
      imageMatchStatus: 'collision',
      errorMessage: `Multiple files named '${trimmed}' found in subfolders. Rename to make filename unique.`
    };
  }

  // Exact filename match
  const matchedFiles = folderIndex.exactMap.get(trimmed);
  if (matchedFiles && matchedFiles.length === 1 && matchedFiles[0]) {
    const file = matchedFiles[0];
    return {
      localFile: file,
      previewUrl:
        typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function'
          ? URL.createObjectURL(file)
          : undefined,
      imageMatchStatus: 'matched'
    };
  }

  // Case-folding fallback (only if unique)
  const lowerMap = new Map<string, File[]>();
  folderIndex.exactMap.forEach((files, name) => {
    const lName = name.toLowerCase();
    const ex = lowerMap.get(lName) || [];
    ex.push(...files);
    lowerMap.set(lName, ex);
  });

  const caseMatches = lowerMap.get(trimmed.toLowerCase());
  if (caseMatches && caseMatches.length === 1 && caseMatches[0]) {
    const file = caseMatches[0];
    return {
      localFile: file,
      previewUrl:
        typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function'
          ? URL.createObjectURL(file)
          : undefined,
      imageMatchStatus: 'matched'
    };
  }

  return {
    imageMatchStatus: 'unmatched',
    errorMessage: `Image file '${trimmed}' not found in the selected folder`
  };
}

/**
 * Parses raw CSV text into RawCsvRow items.
 * Ignores any 'description' column. SKU is optional.
 */
export function parseCsvText(csvText: string): RawCsvRow[] {
  const lines = csvText
    .split(/\r\n|\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  if (lines.length === 0 || !lines[0]) return [];

  // Parse Header row
  const headerLine = lines[0];
  const headers = splitCsvLine(headerLine).map((h) => h.trim().toLowerCase().replace(/['"]/g, ''));

  const titleIdx = headers.findIndex(
    (h) => h === 'title' || h === 'product' || h === 'name' || h.includes('title') || h.includes('name')
  );
  const priceIdx = headers.findIndex(
    (h) => h === 'price' || h.includes('price') || h.includes('cost') || h.includes('amount')
  );
  const categoryIdx = headers.findIndex(
    (h) => h === 'categoryname' || h === 'category' || h.includes('cat')
  );
  const colorIdx = headers.findIndex(
    (h) => h === 'colorname' || h === 'color' || h.includes('color') || h.includes('colour')
  );
  const sizeIdx = headers.findIndex(
    (h) => h === 'sizename' || h === 'size' || h.includes('size')
  );
  const stockIdx = headers.findIndex(
    (h) => h === 'stock' || h.includes('stock') || h.includes('qty') || h.includes('quantity')
  );
  const skuIdx = headers.findIndex((h) => h === 'sku' || h.includes('sku') || h.includes('code'));
  const imageIdx = headers.findIndex(
    (h) => h === 'imagepath' || h === 'image' || h.includes('image') || h.includes('photo') || h.includes('file')
  );

  const rows: RawCsvRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line) continue;

    const fields = splitCsvLine(line);

    const title = titleIdx !== -1 && fields[titleIdx] !== undefined ? fields[titleIdx]! : '';
    const price = priceIdx !== -1 && fields[priceIdx] !== undefined ? fields[priceIdx]! : 0;
    const categoryName = categoryIdx !== -1 && fields[categoryIdx] !== undefined ? fields[categoryIdx]! : '';
    const colorName = colorIdx !== -1 && fields[colorIdx] !== undefined ? fields[colorIdx]! : '';
    const sizeName = sizeIdx !== -1 && fields[sizeIdx] !== undefined ? fields[sizeIdx]! : '';
    const stock = stockIdx !== -1 && fields[stockIdx] !== undefined ? fields[stockIdx]! : 10;
    const sku = skuIdx !== -1 && fields[skuIdx] !== undefined ? fields[skuIdx]! : '';
    const imagePath = imageIdx !== -1 && fields[imageIdx] !== undefined ? fields[imageIdx]! : '';

    rows.push({
      originalRowIndex: i + 1, // 1-indexed (row 1 was header)
      title: title.trim(),
      price: typeof price === 'string' ? parseFloat(price.replace(/[^0-9.]/g, '')) || 0 : Number(price) || 0,
      categoryName: categoryName.trim(),
      colorName: colorName.trim(),
      sizeName: sizeName.trim(),
      stock: typeof stock === 'string' ? parseInt(stock.replace(/[^0-9]/g, ''), 10) || 0 : Number(stock) || 0,
      sku: sku.trim(),
      imagePath: imagePath.trim()
    });
  }

  return rows;
}

/**
 * Splits CSV line supporting quoted fields with embedded commas.
 */
function splitCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result.map((s) => s.replace(/^"|"$/g, ''));
}

/**
 * Normalizes color/size name to canonical casing if matched.
 */
function findCanonicalMatch(val: string, options: readonly string[]): string | null {
  const trimmed = val.trim().toLowerCase();
  const match = options.find((opt) => opt.toLowerCase() === trimmed);
  return match || null;
}

/**
 * Groups raw CSV rows into base products and variants.
 * Handles non-consecutive / scattered rows.
 * Validates strictly against existing categories, colors, and sizes.
 */
export function groupCsvRows(
  rows: RawCsvRow[],
  folderIndex?: FolderImageIndex | null,
  allowedCategories?: string[]
): GroupedProduct[] {
  // Map of groupKey -> GroupedProduct
  const productGroupMap = new Map<string, GroupedProduct>();
  const titleToGroupKeys = new Map<string, Set<string>>();

  // Variant deduplication tracker: groupKey -> Set<"color:size">
  const variantKeysMap = new Map<string, Map<string, number>>(); // "color:size" -> originalRowIndex

  rows.forEach((row) => {
    const rawTitle = row.title.trim();
    const normCategory = row.categoryName.trim().toLowerCase();
    const numPrice = Number(row.price) || 0;
    const priceStr = numPrice.toFixed(2);

    const groupKey = `${rawTitle}:::${priceStr}:::${normCategory}`;

    // Track titles for split-product warning detection
    if (!titleToGroupKeys.has(rawTitle)) {
      titleToGroupKeys.set(rawTitle, new Set());
    }
    titleToGroupKeys.get(rawTitle)!.add(groupKey);

    const imageResolution = resolveImageForPath(row.imagePath, folderIndex);

    const rawColor = row.colorName?.trim() || '';
    const rawSize = row.sizeName?.trim() || '';

    // Canonical Color matching (if specified)
    const canonicalColor = rawColor ? findCanonicalMatch(rawColor, COLOR_OPTIONS) : '';
    const colorHex = rawColor ? getColorHex(rawColor) : '';

    // Canonical Size matching (if specified)
    const canonicalSize = rawSize ? findCanonicalMatch(rawSize, SIZE_OPTIONS) : '';

    const variant: ParsedVariant = {
      id: `var-${Date.now()}-${row.originalRowIndex}-${Math.random().toString(36).substring(2, 6)}`,
      originalRowIndex: row.originalRowIndex,
      colorName: canonicalColor || rawColor,
      colorHex,
      sizeName: canonicalSize || rawSize,
      stock: Number(row.stock) >= 0 ? Number(row.stock) : 0,
      sku: row.sku || '',
      imagePath: row.imagePath,
      localFile: imageResolution.localFile,
      previewUrl: imageResolution.previewUrl,
      imageMatchStatus: imageResolution.imageMatchStatus,
      errorMessage: imageResolution.errorMessage
    };

    if (!productGroupMap.has(groupKey)) {
      // First row encountered -> Base Product
      const newProduct: GroupedProduct = {
        id: `prod-${Date.now()}-${row.originalRowIndex}-${Math.random().toString(36).substring(2, 6)}`,
        title: row.title || `Untitled Product ${row.originalRowIndex}`,
        price: numPrice,
        categoryName: row.categoryName || 'General',
        defaultImage: {
          imagePath: row.imagePath,
          localFile: imageResolution.localFile,
          previewUrl: imageResolution.previewUrl,
          imageMatchStatus: imageResolution.imageMatchStatus
        },
        variants: [variant],
        warnings: [],
        errors: []
      };

      // Validate base product fields
      if (!row.title.trim()) {
        newProduct.errors.push(`Row ${row.originalRowIndex}: Product Title is required.`);
      }
      if (numPrice < 0) {
        newProduct.errors.push(`Row ${row.originalRowIndex}: Price cannot be negative.`);
      }
      if (!row.categoryName.trim()) {
        newProduct.errors.push(`Row ${row.originalRowIndex}: Category name is required.`);
      } else if (
        allowedCategories &&
        allowedCategories.length > 0 &&
        !allowedCategories.some((c) => c.toLowerCase() === row.categoryName.trim().toLowerCase())
      ) {
        newProduct.errors.push(
          `Row ${row.originalRowIndex}: Category '${row.categoryName}' does not exist. Please select an existing category.`
        );
      }

      productGroupMap.set(groupKey, newProduct);
      variantKeysMap.set(groupKey, new Map());
    } else {
      // Subsequent row in existing product group -> Additional variant
      const existingProduct = productGroupMap.get(groupKey)!;
      existingProduct.variants.push(variant);
    }

    const targetProduct = productGroupMap.get(groupKey)!;

    // Strict validation if Color is provided
    if (rawColor && !canonicalColor) {
      targetProduct.errors.push(
        `Row ${row.originalRowIndex}: Color '${row.colorName}' is not allowed. Please select an existing color from: ${COLOR_OPTIONS.join(', ')}.`
      );
    }

    // Strict validation if Size is provided
    if (rawSize && !canonicalSize) {
      targetProduct.errors.push(
        `Row ${row.originalRowIndex}: Size '${row.sizeName}' is not allowed. Please select an existing size from: ${SIZE_OPTIONS.join(', ')}.`
      );
    }

    // Check duplicate (colorName, sizeName) within this product group
    const currentVariantMap = variantKeysMap.get(groupKey)!;
    const variantKey = `${rawColor.toLowerCase()}:::${rawSize.toLowerCase()}`;

    if (currentVariantMap.has(variantKey)) {
      const firstRow = currentVariantMap.get(variantKey)!;
      const desc = rawColor || rawSize ? `color '${rawColor || 'None'}' and size '${rawSize || 'None'}'` : 'Standard specification';
      targetProduct.errors.push(
        `Row ${row.originalRowIndex}: Duplicate variant for ${desc} (already defined in Row ${firstRow}).`
      );
    } else {
      currentVariantMap.set(variantKey, row.originalRowIndex);
    }
  });

  // Second pass: Populate split-product warnings
  titleToGroupKeys.forEach((keys, normTitle) => {
    if (keys.size > 1 && normTitle) {
      keys.forEach((key) => {
        const product = productGroupMap.get(key);
        if (product) {
          product.warnings.push(
            `Another row has the same title '${product.title}' but different price or category — treated as a separate product.`
          );
        }
      });
    }
  });

  return Array.from(productGroupMap.values());
}

/**
 * Formats grouped products into the JSON payload accepted by /api/admin/products/bulk.
 */
export function formatProductsForApiPayload(products: GroupedProduct[]) {
  return products.map((prod) => {
    // Unique colors & sizes (filtering out empty)
    const uniqueColors = Array.from(
      new Set(prod.variants.map((v) => v.colorName.trim()).filter(Boolean))
    );
    const uniqueSizes = Array.from(
      new Set(prod.variants.map((v) => v.sizeName.trim()).filter(Boolean))
    );

    const options: { name: string; values: string[] }[] = [];
    if (uniqueColors.length > 0) {
      options.push({ name: 'Color', values: uniqueColors });
    }
    if (uniqueSizes.length > 0) {
      options.push({ name: 'Size', values: uniqueSizes });
    }

    const defaultImgUrl =
      prod.defaultImage.cloudinaryUrl ||
      prod.defaultImage.previewUrl ||
      undefined;

    const formattedVariants = prod.variants.map((v) => {
      const variantImgUrl = v.cloudinaryUrl || v.previewUrl;
      const images: string[] = [];

      if (variantImgUrl) {
        images.push(variantImgUrl);
      } else if (defaultImgUrl) {
        images.push(defaultImgUrl);
      }

      const attributes: Record<string, string> = {};
      if (v.colorName && v.colorName.trim()) {
        attributes.Color = v.colorName.trim();
      }
      if (v.sizeName && v.sizeName.trim()) {
        attributes.Size = v.sizeName.trim();
      }

      return {
        sku: v.sku?.trim() || undefined,
        stock: Number(v.stock) || 0,
        images,
        attributes
      };
    });

    return {
      name: prod.title.trim(),
      price: Number(prod.price),
      categoryName: prod.categoryName.trim(),
      imageUrl: defaultImgUrl,
      options,
      variants: formattedVariants
    };
  });
}
