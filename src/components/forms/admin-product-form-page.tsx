'use client';

import React, { useEffect, useState } from 'react';

import { useRouter } from 'next/navigation';
import Link from 'next/link';

import { AlertCircle, ArrowLeft } from 'lucide-react';

import { BackHeading } from '@/components/common/back-heading';
import { ProductForm } from '@/components/forms/product-form';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { getProductById } from '@/services/product.service';
import { ROUTES } from '@/constants/routes';
import type { Product } from '@/types/product.types';

interface AdminProductFormPageProps {
  productId?: string;
}

export function AdminProductFormPage({ productId }: AdminProductFormPageProps) {
  const router = useRouter();
  const isEditMode = Boolean(productId);
  const [productData, setProductData] = useState<Product | null>(null);
  const [loading, setLoading] = useState<boolean>(isEditMode);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!productId) {
      setProductData(null);
      setLoading(false);
      return;
    }

    let isMounted = true;
    async function loadProduct() {
      try {
        setLoading(true);
        setError(null);
        const data = await getProductById(productId!);
        if (isMounted) {
          setProductData(data);
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

    loadProduct();
    return () => {
      isMounted = false;
    };
  }, [productId]);

  const pageTitle = isEditMode ? 'Edit Product' : 'Add a Single Product';

  return (
    <div className="space-y-6 pb-12">
      <BackHeading title={pageTitle} href={ROUTES.adminProducts} />

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
              <Link href={ROUTES.adminProducts} className="flex items-center gap-2">
                <ArrowLeft className="h-4 w-4" /> Back to Products
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
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Skeleton className="h-10 w-full rounded-lg" />
              <Skeleton className="h-10 w-full rounded-lg" />
              <Skeleton className="h-10 w-full rounded-lg" />
            </div>
          </div>
        </div>
      ) : !error && (!isEditMode || productData) ? (
        <div className="rounded-xl border border-slate-200 bg-white p-4 sm:p-6 shadow-xs">
          <ProductForm
            mode={isEditMode ? 'edit' : 'create'}
            initialData={productData || undefined}
            onSubmitSuccess={() => router.push(ROUTES.adminProducts)}
          />
        </div>
      ) : null}
    </div>
  );
}
