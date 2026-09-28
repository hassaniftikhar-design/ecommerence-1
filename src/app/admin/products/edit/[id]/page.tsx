
import { AdminProductFormPage } from '@/components/forms/admin-product-form-page';

export default async function EditProductPage({
  params
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <AdminProductFormPage productId={id} />;
}
