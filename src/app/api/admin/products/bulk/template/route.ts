import { NextResponse } from 'next/server';
import ExcelJS from 'exceljs';
import { prisma } from '@/lib/prisma';
import {
  COLOR_OPTIONS,
  SIZE_OPTIONS,
} from '@/constants/generalconstants';
import { getCurrentUser, isAdmin } from '@/lib/server-auth';
import { apiError } from '@/lib/api-response';

export async function GET(request: Request) {
  try {
    const user = await getCurrentUser(request);

    if (!user || !isAdmin(user)) {
      return apiError(
        'Forbidden: Only ADMIN users can download import templates',
        [],
        403
      );
    }

    // 1. Fetch categories from DB
    const dbCategories = await prisma.category.findMany({
      orderBy: { name: 'asc' },
      select: { name: true },
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
          'General',
        ];

    const workbook = new ExcelJS.Workbook();

    workbook.creator = 'Ecommerce Admin';
    workbook.created = new Date();

    // 2. Product Import Template Worksheet
    const templateSheet = workbook.addWorksheet(
      'Product Import Template',
      {
        views: [{ state: 'frozen', ySplit: 1 }],
      }
    );

    templateSheet.columns = [
      { header: 'title', key: 'title', width: 28 },
      { header: 'price', key: 'price', width: 14 },
      { header: 'categoryName', key: 'categoryName', width: 22 },
      { header: 'colorName', key: 'colorName', width: 18 },
      { header: 'sizeName', key: 'sizeName', width: 14 },
      { header: 'stock', key: 'stock', width: 14 },
      { header: 'imagePath', key: 'imagePath', width: 30 },
    ];

    // 3. Style Header Row
    const headerRow = templateSheet.getRow(1);

    headerRow.height = 24;

    headerRow.eachCell((cell) => {
      cell.font = {
        bold: true,
        color: { argb: 'FFFFFFFF' },
      };

      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF1E293B' },
      };

      cell.alignment = {
        vertical: 'middle',
        horizontal: 'center',
      };
    });

    // 4. Sample demonstration rows (No SKU, No description)
    const sampleRows = [
      {
        title: 'Classic Heavyweight Tee',
        price: 34.99,
        categoryName: categoryNames[0] || 'Apparel',
        colorName: 'Black',
        sizeName: 'M',
        stock: 50,
        imagePath: 'tee_black.jpg',
      },
      {
        title: 'Classic Heavyweight Tee',
        price: 34.99,
        categoryName: categoryNames[0] || 'Apparel',
        colorName: 'Black',
        sizeName: 'L',
        stock: 40,
        imagePath: 'tee_black.jpg',
      },
      {
        title: 'Classic Heavyweight Tee',
        price: 34.99,
        categoryName: categoryNames[0] || 'Apparel',
        colorName: 'White',
        sizeName: 'M',
        stock: 35,
        imagePath: 'tee_white.jpg',
      },
      {
        title: 'Wireless Ergonomic Keyboard',
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
        imagePath: 'keyboard_gray.png',
      },
      {
        title: 'Minimalist Ceramic Mug',
        price: 18.0,
        categoryName:
          categoryNames.find((category) =>
            category.toLowerCase().includes('kitch')
          ) ||
          categoryNames[0] ||
          'Kitchen',
        colorName: '', // Standard size & color
        sizeName: '',
        stock: 60,
        imagePath: 'mug_standard.png',
      },
    ];

    sampleRows.forEach((row) => {
      templateSheet.addRow(row);
    });

    // 5. Create dropdown formulas directly from arrays
    const categoryList = `"${categoryNames.join(',')}"`;
    const colorList = `"${COLOR_OPTIONS.join(',')}"`;
    const sizeList = `"${SIZE_OPTIONS.join(',')}"`;

    // 6. Apply validation to rows 2-1000 (Color & Size allow blank for standard products)
    for (let row = 2; row <= 1000; row++) {
      // Category
      templateSheet.getCell(`C${row}`).dataValidation = {
        type: 'list',
        allowBlank: false,
        formulae: [categoryList],
        showErrorMessage: true,
        errorStyle: 'stop',
        errorTitle: 'Invalid Category',
        error: 'Please select a category from the dropdown.',
      };

      // Color (Optional - Blank means Standard Color)
      templateSheet.getCell(`D${row}`).dataValidation = {
        type: 'list',
        allowBlank: true,
        formulae: [colorList],
        showErrorMessage: true,
        errorStyle: 'stop',
        errorTitle: 'Invalid Color',
        error: 'Please select a valid color from the dropdown or leave blank for standard.',
      };

      // Size (Optional - Blank means Standard Size)
      templateSheet.getCell(`E${row}`).dataValidation = {
        type: 'list',
        allowBlank: true,
        formulae: [sizeList],
        showErrorMessage: true,
        errorStyle: 'stop',
        errorTitle: 'Invalid Size',
        error: 'Please select a valid size from the dropdown or leave blank for standard.',
      };
    }

    // 7. Generate XLSX
    const buffer = await workbook.xlsx.writeBuffer();

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type':
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition':
          'attachment; filename="product_bulk_import_template.xlsx"',
      },
    });
  } catch (error) {
    return apiError(
      'Failed to generate template',
      [(error as Error).message],
      500
    );
  }
}
