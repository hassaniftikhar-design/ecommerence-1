"use client";

import { use, useState } from "react";
import { useRouter } from "next/navigation";
import { BackHeading } from "@/components/common/back-heading";
import { OrdersModal } from "@/components/orders/orders-modal";
import { ROUTES } from "@/constants/routes";

export default function OrderDetailPage({
  params,
}: {
  params: Promise<{ orderId: string }>;
}) {
  const { orderId } = use(params);
  const router = useRouter();
  const [modalOpen, setModalOpen] = useState(true);

  const handleClose = () => {
    setModalOpen(false);
    router.push(ROUTES.home);
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12">
      <BackHeading title="My Orders" href={ROUTES.home} />
      <OrdersModal
        isOpen={modalOpen}
        onClose={handleClose}
        initialOrderId={orderId}
      />
    </div>
  );
}
