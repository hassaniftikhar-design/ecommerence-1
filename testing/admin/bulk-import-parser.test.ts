import {
  parseCsvText,
  buildFolderImageIndex,
  groupCsvRows,
  resolveImageForPath,
  formatProductsForApiPayload
} from '@/lib/bulk-import-parser';
import { getColorHex } from '@/constants/generalconstants';

describe('Bulk Import Parser & Row-Grouping', () => {
  describe('parseCsvText', () => {
    it('parses valid CSV text without description and without requiring SKU', () => {
      const csv = `title,price,categoryName,colorName,sizeName,stock,imagePath
Classic Tee,29.99,Apparel,Black,M,50,tee_black.jpg
Classic Tee,29.99,Apparel,White,L,30,tee_white.jpg`;

      const rows = parseCsvText(csv);
      expect(rows).toHaveLength(2);
      expect(rows[0]).toEqual({
        originalRowIndex: 2,
        title: 'Classic Tee',
        price: 29.99,
        categoryName: 'Apparel',
        colorName: 'Black',
        sizeName: 'M',
        stock: 50,
        sku: '',
        imagePath: 'tee_black.jpg'
      });
      expect(rows[1]?.colorName).toBe('White');
    });

    it('handles quoted fields with commas correctly', () => {
      const csv = `title,price,categoryName,colorName,sizeName,stock,imagePath
"Pro Gamer, Edition 2",89.99,"Gaming, Tech",Navy,XL,15,gamer.jpg`;

      const rows = parseCsvText(csv);
      expect(rows).toHaveLength(1);
      expect(rows[0]?.title).toBe('Pro Gamer, Edition 2');
      expect(rows[0]?.categoryName).toBe('Gaming, Tech');
      expect(rows[0]?.price).toBe(89.99);
    });
  });

  describe('groupCsvRows & Scattered Matches', () => {
    it('groups non-consecutive scattered rows into a single product with multiple variants', () => {
      const csv = `title,price,categoryName,colorName,sizeName,stock,imagePath
Running Shoe,99.00,Footwear,Black,L,20,shoe_black.jpg
Casual Hoodie,55.00,Apparel,Gray,L,15,hoodie_gray.jpg
Running Shoe,99.00,Footwear,Red,XL,10,shoe_red.jpg
Running Shoe,99.00,Footwear,Blue,M,12,shoe_blue.jpg`;

      const rows = parseCsvText(csv);
      const grouped = groupCsvRows(rows);

      expect(grouped).toHaveLength(2);

      const runningShoe = grouped.find((p) => p.title === 'Running Shoe');
      expect(runningShoe).toBeDefined();
      expect(runningShoe?.variants).toHaveLength(3);
      expect(runningShoe?.price).toBe(99.0);
      expect(runningShoe?.categoryName).toBe('Footwear');

      // First row encountered gives default image
      expect(runningShoe?.defaultImage.imagePath).toBe('shoe_black.jpg');

      // First variant has shoe_black.jpg
      expect(runningShoe?.variants[0]?.colorName).toBe('Black');
      expect(runningShoe?.variants[0]?.imagePath).toBe('shoe_black.jpg');

      // Subsequent variants retain their own imagePath
      expect(runningShoe?.variants[1]?.colorName).toBe('Red');
      expect(runningShoe?.variants[1]?.imagePath).toBe('shoe_red.jpg');

      expect(runningShoe?.variants[2]?.colorName).toBe('Blue');
      expect(runningShoe?.variants[2]?.imagePath).toBe('shoe_blue.jpg');
    });

    it('flags unlisted categories, colors, or sizes as errors', () => {
      const csv = `title,price,categoryName,colorName,sizeName,stock,imagePath
Invalid Item,50.00,AlienCategory,NeonRainbow,10XL,5,item.jpg`;

      const rows = parseCsvText(csv);
      const grouped = groupCsvRows(rows, null, ['Apparel', 'Footwear']);

      expect(grouped).toHaveLength(1);
      const prod = grouped[0]!;
      expect(prod.errors.some((e) => e.includes('AlienCategory'))).toBe(true);
      expect(prod.errors.some((e) => e.includes('NeonRainbow'))).toBe(true);
      expect(prod.errors.some((e) => e.includes('10XL'))).toBe(true);
    });

    it('treats rows with same title but different price or category as separate products with a warning', () => {
      const csv = `title,price,categoryName,colorName,sizeName,stock,imagePath
Ergonomic Chair,150.00,Furniture,Black,M,10,chair1.jpg
Ergonomic Chair,200.00,Furniture,Black,M,5,chair2.jpg`;

      const rows = parseCsvText(csv);
      const grouped = groupCsvRows(rows);

      expect(grouped).toHaveLength(2);
      expect(grouped[0]?.price).toBe(150.0);
      expect(grouped[1]?.price).toBe(200.0);

      expect(grouped[0]?.warnings.length).toBeGreaterThan(0);
      expect(grouped[0]?.warnings[0]).toContain('treated as a separate product');
      expect(grouped[1]?.warnings[0]).toContain('treated as a separate product');
    });

    it('flags duplicate (colorName, sizeName) within the same product group as an error', () => {
      const csv = `title,price,categoryName,colorName,sizeName,stock,imagePath
Cotton Polo,39.00,Apparel,Navy,M,20,polo1.jpg
Cotton Polo,39.00,Apparel,Navy,M,15,polo2.jpg`;

      const rows = parseCsvText(csv);
      const grouped = groupCsvRows(rows);

      expect(grouped).toHaveLength(1);
      expect(grouped[0]?.errors.length).toBeGreaterThan(0);
      expect(grouped[0]?.errors[0]).toContain("Duplicate variant for color 'Navy' and size 'M'");
    });

    it('treats titles differing only in case as separate products ("jacket" vs "Jacket" vs "JACKET")', () => {
      const csv = `title,price,categoryName,colorName,sizeName,stock,imagePath
jacket,1000.00,Clothing,Black,M,10,j1.jpg
Jacket,1000.00,Clothing,Black,L,15,j2.jpg
JACKET,1000.00,Clothing,Black,XL,20,j3.jpg`;

      const rows = parseCsvText(csv);
      const grouped = groupCsvRows(rows);

      // Must be 3 distinct products
      expect(grouped).toHaveLength(3);
      expect(grouped.map((p) => p.title)).toEqual(['jacket', 'Jacket', 'JACKET']);
    });

    it('groups identical case titles with matching price and category into a single multi-variant product', () => {
      const csv = `title,price,categoryName,colorName,sizeName,stock,imagePath
Jacket,1000.00,Clothing,Black,M,10,j1.jpg
Jacket,1000.00,Clothing,Red,L,15,j2.jpg`;

      const rows = parseCsvText(csv);
      const grouped = groupCsvRows(rows);

      expect(grouped).toHaveLength(1);
      expect(grouped[0]?.title).toBe('Jacket');
      expect(grouped[0]?.variants).toHaveLength(2);
    });

    it('splits products when prices differ despite identical case title and category', () => {
      const csv = `title,price,categoryName,colorName,sizeName,stock,imagePath
Jacket,1000.00,Clothing,Black,M,10,j1.jpg
Jacket,1200.00,Clothing,Black,L,15,j2.jpg`;

      const rows = parseCsvText(csv);
      const grouped = groupCsvRows(rows);

      expect(grouped).toHaveLength(2);
      expect(grouped[0]?.price).toBe(1000.0);
      expect(grouped[1]?.price).toBe(1200.0);
    });

    it('splits products when categories differ despite identical case title and price', () => {
      const csv = `title,price,categoryName,colorName,sizeName,stock,imagePath
Jacket,1000.00,Clothing,Black,M,10,j1.jpg
Jacket,1000.00,Shoes,Black,L,15,j2.jpg`;

      const rows = parseCsvText(csv);
      const grouped = groupCsvRows(rows);

      expect(grouped).toHaveLength(2);
      expect(grouped[0]?.categoryName).toBe('Clothing');
      expect(grouped[1]?.categoryName).toBe('Shoes');
    });
  });

  describe('Folder Image Matching & Collision Detection', () => {
    it('matches exact filenames and detects collisions across subfolders', () => {
      const file1 = new File(['content1'], 'shirt_blue.jpg', { type: 'image/jpeg' });
      const file2 = new File(['content2'], 'shirt_red.jpg', { type: 'image/jpeg' });
      const file3Duplicate = new File(['content3'], 'shirt_blue.jpg', { type: 'image/jpeg' });

      const index = buildFolderImageIndex([file1, file2, file3Duplicate]);

      expect(index.collisionFilenames.has('shirt_blue.jpg')).toBe(true);
      expect(index.collisionFilenames.has('shirt_red.jpg')).toBe(false);

      // shirt_blue.jpg collision resolution
      const resCollision = resolveImageForPath('shirt_blue.jpg', index);
      expect(resCollision.imageMatchStatus).toBe('collision');
      expect(resCollision.errorMessage).toContain('Multiple files named');

      // shirt_red.jpg unique exact match
      const resMatch = resolveImageForPath('shirt_red.jpg', index);
      expect(resMatch.imageMatchStatus).toBe('matched');
      expect(resMatch.localFile).toBe(file2);

      // non-existent file
      const resMissing = resolveImageForPath('shirt_green.jpg', index);
      expect(resMissing.imageMatchStatus).toBe('unmatched');
      expect(resMissing.errorMessage).toContain('not found in the selected folder');
    });
  });

  describe('Color-to-Hex Resolution & Payload Formatting', () => {
    it('resolves canonical hex values case-insensitively and formats API payload with options and attributes', () => {
      expect(getColorHex('Black')).toBe('#18181B');
      expect(getColorHex('black')).toBe('#18181B');
      expect(getColorHex(' Red ')).toBe('#EF4444');
      expect(getColorHex('Navy Blue')).toBe('#1E3A8A');

      const csv = `title,price,categoryName,colorName,sizeName,stock,imagePath
Winter Parka,199.99,Outerwear,Black,L,10,parka_black.jpg
Winter Parka,199.99,Outerwear,Red,M,8,parka_red.jpg`;

      const rows = parseCsvText(csv);
      const grouped = groupCsvRows(rows);
      const payload = formatProductsForApiPayload(grouped);

      expect(payload).toHaveLength(1);
      const parka = payload[0]!;
      expect(parka.name).toBe('Winter Parka');
      expect(parka.price).toBe(199.99);
      expect(parka.categoryName).toBe('Outerwear');

      // Check options structure
      expect(parka.options).toEqual([
        { name: 'Color', values: ['Black', 'Red'] },
        { name: 'Size', values: ['L', 'M'] }
      ]);

      // Check variants structure
      expect(parka.variants).toHaveLength(2);
      expect(parka.variants[0]?.attributes).toEqual({ Color: 'Black', Size: 'L' });
      expect(parka.variants[0]?.stock).toBe(10);

      expect(parka.variants[1]?.attributes).toEqual({ Color: 'Red', Size: 'M' });
      expect(parka.variants[1]?.stock).toBe(8);
    });

    it('formats standard product without color or size with empty options and empty attributes', () => {
      const csv = `title,price,categoryName,colorName,sizeName,stock,imagePath
Ceramic Mug,15.00,Kitchen,,,25,mug.jpg`;

      const rows = parseCsvText(csv);
      const grouped = groupCsvRows(rows);
      expect(grouped).toHaveLength(1);
      expect(grouped[0]?.errors).toHaveLength(0);

      const payload = formatProductsForApiPayload(grouped);
      expect(payload).toHaveLength(1);
      const mug = payload[0]!;
      expect(mug.name).toBe('Ceramic Mug');
      expect(mug.price).toBe(15.00);
      expect(mug.options).toEqual([]);
      expect(mug.variants).toHaveLength(1);
      expect(mug.variants[0]?.attributes).toEqual({});
      expect(mug.variants[0]?.stock).toBe(25);
    });
  });
});
