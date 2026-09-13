import ExcelJS from 'exceljs';
import {
  COLOR_OPTIONS,
  SIZE_OPTIONS,
} from '@/constants/generalconstants';

describe('Bulk Import XLSX Template Generator', () => {
  it('generates a valid XLSX workbook with restricted dropdowns', async () => {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Ecommerce Admin';

    // Sheet: Product Import Template
    const templateSheet = workbook.addWorksheet('Product Import Template');

    templateSheet.columns = [
      { header: 'title', key: 'title', width: 28 },
      { header: 'price', key: 'price', width: 14 },
      { header: 'categoryName', key: 'categoryName', width: 20 },
      { header: 'colorName', key: 'colorName', width: 18 },
      { header: 'sizeName', key: 'sizeName', width: 14 },
      { header: 'stock', key: 'stock', width: 14 },
      { header: 'imagePath', key: 'imagePath', width: 30 },
    ];

    const categoryNames = ['Apparel', 'Electronics', 'Footwear'];

    // Excel list formulas
    const categoryFormula = `"${categoryNames.join(',')}"`;
    const colorFormula = `"${COLOR_OPTIONS.join(',')}"`;
    const sizeFormula = `"${SIZE_OPTIONS.join(',')}"`;

    // Apply validation to rows 2-1000
    for (let row = 2; row <= 1000; row++) {
      // Category
      templateSheet.getCell(`C${row}`).dataValidation = {
        type: 'list',
        allowBlank: false,
        formulae: [categoryFormula],
        showErrorMessage: true,
        errorStyle: 'stop',
        errorTitle: 'Invalid Category',
        error: 'Please select a category from the dropdown.',
      };

      // Color
      templateSheet.getCell(`D${row}`).dataValidation = {
        type: 'list',
        allowBlank: false,
        formulae: [colorFormula],
        showErrorMessage: true,
        errorStyle: 'stop',
        errorTitle: 'Invalid Color',
        error: 'Please select a color from the dropdown.',
      };

      // Size
      templateSheet.getCell(`E${row}`).dataValidation = {
        type: 'list',
        allowBlank: false,
        formulae: [sizeFormula],
        showErrorMessage: true,
        errorStyle: 'stop',
        errorTitle: 'Invalid Size',
        error: 'Please select a size from the dropdown.',
      };
    }

    const buffer = await workbook.xlsx.writeBuffer();

    expect(buffer).toBeDefined();
    expect(buffer.byteLength).toBeGreaterThan(0);

    // Read back
    const readWorkbook = new ExcelJS.Workbook();

    await readWorkbook.xlsx.load(
      Buffer.from(buffer) as unknown as ExcelJS.Buffer
    );

    expect(readWorkbook.worksheets.length).toBe(1);

    const sheet = readWorkbook.getWorksheet(
      'Product Import Template'
    )!;

    expect(sheet).toBeDefined();

    // Headers
    const headers = sheet.getRow(1).values as string[];

    expect(headers).toContain('title');
    expect(headers).toContain('price');
    expect(headers).toContain('categoryName');
    expect(headers).toContain('colorName');
    expect(headers).toContain('sizeName');
    expect(headers).toContain('stock');
    expect(headers).toContain('imagePath');

    expect(headers).not.toContain('sku');
    expect(headers).not.toContain('description');

    // Verify validations
    expect(sheet.getCell('C2').dataValidation).toBeDefined();
    expect(sheet.getCell('D2').dataValidation).toBeDefined();
    expect(sheet.getCell('E2').dataValidation).toBeDefined();

    expect(sheet.getCell('C2').dataValidation?.type).toBe('list');
    expect(sheet.getCell('D2').dataValidation?.type).toBe('list');
    expect(sheet.getCell('E2').dataValidation?.type).toBe('list');

    expect(sheet.getCell('C2').dataValidation?.errorStyle).toBe('stop');
    expect(sheet.getCell('D2').dataValidation?.errorStyle).toBe('stop');
    expect(sheet.getCell('E2').dataValidation?.errorStyle).toBe('stop');
  });
});