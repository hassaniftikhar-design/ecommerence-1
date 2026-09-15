'use client';
import React, { useEffect, useState, Suspense } from 'react';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';

import { AlertCircle, ArrowLeft } from 'lucide-react';

import { BackHeading } from '@/components/common/back-heading';
import { ProductForm } from '@/components/forms/product-form';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ROUTES } from '@/constants/routes';
import { DEFAULT_PRODUCT_IMAGE } from '@/constants/generalconstants';
import { getProductById } from '@/services/product.service';
import type { Product } from '@/types/product.types';

interface AdminProductFormPageProps {
  productId?: string;
}

export function AdminProductFormPageContent({ productId }: AdminProductFormPageProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const importItemId = searchParams.get('importItemId');
  const jobId = searchParams.get('jobId');

  const [productData, setProductData] = useState<Product | null>(null);
  const [effectiveMode, setEffectiveMode] = useState<'create' | 'edit'>(productId ? 'edit' : 'create');
  const [loading, setLoading] = useState<boolean>(Boolean(productId || (importItemId && jobId)));
  const [error, setError] = useState<string | null>(null);

  const effectiveJobId = jobId || productData?.importError?.jobId;
  const effectiveImportItemId = importItemId || productData?.importError?.itemId;

  useEffect(() => {
    let isMounted = true;

    // Helper to format raw import data into a prefilled Product object
    const formatRawImportData = (errItem: any): Product => {
      const raw = errItem.raw_data || {};
      const primaryImg = raw.imageUrl || raw.variants?.[0]?.images?.[0] || DEFAULT_PRODUCT_IMAGE;

      const prefilledVariants = (raw.variants && raw.variants.length > 0)
        ? raw.variants.map((v: any, idx: number) => ({
            id: `temp-${idx}`,
            productId: errItem.product_id || '',
            sku: v.sku || '',
            stock: Number(v.stock) > 0 ? Number(v.stock) : 1,
            images: Array.isArray(v.images) && v.images.length > 0 && v.images[0] ? v.images : [primaryImg],
            attributes: v.attributes || {},
            variantOptions: Object.entries(v.attributes || {}).map(([optName, val]) => ({
              optionName: optName,
              value: String(val)
            })),
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          }))
        : [
            {
              id: 'temp-0',
              productId: errItem.product_id || '',
              sku: '',
              stock: Number(raw.stock) > 0 ? Number(raw.stock) : 1,
              images: primaryImg ? [primaryImg] : [],
              attributes: { Color: 'Black', Size: 'M' },
              variantOptions: [
                { optionName: 'Color', value: 'Black' },
                { optionName: 'Size', value: 'M' }
              ],
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString()
            }
          ];

      return {
        id: errItem.product_id || '',
        name: raw.name || '',
        price: Number(raw.price) >= 0 ? Number(raw.price) : 0,
        stock: prefilledVariants.reduce((sum: number, v: any) => sum + (v.stock || 0), 0),
        imageUrl: primaryImg,
        isActive: true,
        category: {
          id: raw.categoryId || '',
          name: raw.categoryName || raw.category || 'General'
        },
        createdBy: {
          id: '',
          name: ''
        },
        options: (raw.options || []).map((o: any, idx: number) => ({
          id: `opt-${idx}`,
          productId: errItem.product_id || '',
          name: o.name,
          values: (o.values || []).map((val: string, vIdx: number) => ({
            id: `val-${vIdx}`,
            optionId: `opt-${idx}`,
            value: String(val)
          }))
        })),
        variants: prefilledVariants,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
    };

    async function loadData() {
      try {
        setLoading(true);
        setError(null);

        // 1. If productId is provided, try loading the existing product from DB
        if (productId) {
          try {
            const data = await getProductById(productId);
            if (isMounted) {
              setProductData(data);
              setEffectiveMode('edit');
            }
            return;
          } catch (fetchErr) {
            console.warn(`Product ID ${productId} not found in DB. Checking import error item fallback...`, fetchErr);
            // If product was not in DB, but we have import item and job references, load raw import item data
            if (importItemId && jobId) {
              const res = await fetch(`/api/admin/imports/${jobId}/review`);
              const json = await res.json();
              if (res.ok && json.success && json.data) {
                const errItem = (json.data.errors || []).find((e: any) => e.id === importItemId);
                if (errItem) {
                  const prefilled = formatRawImportData(errItem);
                  if (isMounted) {
                    setProductData(prefilled);
                    setEffectiveMode('create'); // Product not in DB, so create upon save
                  }
                  return;
                }
              }
            }
            throw fetchErr;
          }
        }

        // 2. If creating new product pre-filled from an import error item
        if (importItemId && jobId) {
          const res = await fetch(`/api/admin/imports/${jobId}/review`);
          const json = await res.json();
          if (res.ok && json.success && json.data) {
            const errItem = (json.data.errors || []).find((e: any) => e.id === importItemId);
            if (errItem) {
              const prefilled = formatRawImportData(errItem);
              if (isMounted) {
                setProductData(prefilled);
                setEffectiveMode('create');
              }
              return;
            }
          }
        }
      } catch (err) {
        if (isMounted) {
          setError((err as Error).message || 'Failed to load product details');
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    loadData();
    return () => {
      isMounted = false;
    };
  }, [productId, importItemId, jobId]);

  const handleResolveAndRedirect = async (savedProduct?: Product) => {
    if (effectiveImportItemId && effectiveJobId) {
      const resolvedProdId = savedProduct?.id || productId;
      try {
        await fetch(`/api/admin/imports/items/${effectiveImportItemId}/resolve`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ jobId: effectiveJobId, productId: resolvedProdId })
        });
      } catch (resErr) {
        console.warn('Failed to auto-resolve import item:', resErr);
      }
      router.push(`/admin/products/imports/${effectiveJobId}/review`);
    } else {
      router.push(ROUTES.adminProducts);
    }
  };

  const isEdit = effectiveMode === 'edit';
  const pageTitle = isEdit ? 'Edit Product' : 'Add a Single Product';
  const backHref = effectiveJobId ? `/admin/products/imports/${effectiveJobId}/review` : ROUTES.adminProducts;

  return (
    <div className="space-y-6 pb-12">
      <BackHeading title={pageTitle} href={backHref} />


      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-8 text-center shadow-xs space-y-4">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-red-100 text-red-600">
            <AlertCircle className="h-7 w-7" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-red-800">Failed to Load Product</h3>
            <p className="text-sm text-red-600 mt-1 max-w-md mx-auto">{error}</p>
          </div>
          <div className="pt-2">
            <Button asChild variant="outline" className="border-red-200 hover:bg-red-100 text-red-700">
              <Link href={backHref} className="flex items-center gap-2">
                <ArrowLeft className="h-4 w-4" /> Back
              </Link>
            </Button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="space-y-6">
          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-xs space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-10 w-full rounded-lg" />
              </div>
              <div className="space-y-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-10 w-full rounded-lg" />
              </div>
            </div>
            <div className="space-y-2">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-28 w-full rounded-lg" />
            </div>
          </div>
        </div>
      ) : !error && (effectiveMode === 'create' || productData) ? (
        <div className="rounded-xl border border-slate-200 bg-white p-4 sm:p-6 shadow-xs">
          <ProductForm
            key={productData?.id || (importItemId ? `import-${importItemId}` : 'new-product')}
            mode={effectiveMode}
            initialData={productData || undefined}
            onSubmitSuccess={handleResolveAndRedirect}
          />
        </div>
      ) : null}
    </div>
  );
}

export function AdminProductFormPage(props: AdminProductFormPageProps) {
  return (
    <Suspense fallback={<div className="p-8 text-center text-xs text-slate-400">Loading form...</div>}>
      <AdminProductFormPageContent {...props} />
    </Suspense>
  );
}
