'use client';

import { use } from 'react';

import { AdminProductFormPage } from '@/components/forms/admin-product-form-page';

export default function EditProductPage({
  params
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);

  return <AdminProductFormPage productId={id} />;
}
