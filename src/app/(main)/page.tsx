import type { Metadata } from 'next';

import { HomeCatalogSection } from '@/components/home/home-catalog-section';
import { WelcomeToast } from '@/components/common/welcome-toast';
import { getProducts, getCategories } from '@/services/product.service';
import { PRODUCT_FETCH_BATCH_SIZE } from '@/constants/generalconstants';

export const metadata: Metadata = {
  title: 'ShopFastStore',
  description: 'Browse the full ShopFastStore product catalog.',
  openGraph: { title: 'ShopFastStore | Our Products' }
};

export default async function HomePage() {
  const [initialProducts, categories] = await Promise.all([
    getProducts({
      page: 1,
      limit: PRODUCT_FETCH_BATCH_SIZE,
      q: '',
      category: '',
      sort: ''
    }),
    getCategories()
  ]);

  return (
    <div className="w-full px-2 sm:px-4 md:px-[56px] lg:px-[60px]">
      <HomeCatalogSection
        initialProducts={initialProducts}
        categories={categories}
      />
      <WelcomeToast />
    </div>
  );
}
