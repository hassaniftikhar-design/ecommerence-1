import React, { Suspense } from 'react';

import { AdminProductsView } from '@/components/forms/admin-products-view';

export default function Page() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-slate-400">Loading products...</div>}>
      <AdminProductsView />
    </Suspense>
  );
}
