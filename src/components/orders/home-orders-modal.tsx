'use client';

import { useState, useEffect } from 'react';

import { useRouter } from 'next/navigation';

import { OrdersModal } from '@/components/orders/orders-modal';
import { ROUTES } from '@/constants/routes';

interface HomeOrdersModalProps {
  openOrders?: boolean;
  initialOrderId?: string;
}

export function HomeOrdersModal({
  openOrders = false,
  initialOrderId
}: HomeOrdersModalProps) {
  const router = useRouter();
  const shouldBeOpen = openOrders || Boolean(initialOrderId);
  const [isOpen, setIsOpen] = useState(shouldBeOpen);

  useEffect(() => {
    setIsOpen(shouldBeOpen);
  }, [shouldBeOpen]);

  const handleClose = () => {
    setIsOpen(false);
    router.push(ROUTES.home);
  };

  if (!isOpen) return null;

  return (
    <OrdersModal
      isOpen={true}
      onClose={handleClose}
      initialOrderId={initialOrderId}
    />
  );
}
