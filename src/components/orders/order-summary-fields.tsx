import type { OrderDetail } from '@/types/order.types';
import { renderPaymentStatusBadge, renderStatusBadge } from '@/components/orders/orders-table';

export function OrderSummaryFields({ order }: { order: OrderDetail }) {
  const fields = [
    { label: 'Date', value: order.date },
    { label: 'Order #', value: order.orderNumber },
    { label: 'User', value: order.user },
    { label: 'Products', value: String(order.productsCount).padStart(2, '0') },
    { label: 'Sub Total', value: `$${(order.subTotal ?? order.amount).toFixed(2)}` },
    { label: 'Tax', value: `$${(order.tax ?? 0).toFixed(2)}` },
    { label: 'Total', value: `$${(order.totalAmount ?? order.amount).toFixed(2)}` }
  ];

  return (
    <dl className="flex flex-wrap gap-x-12 gap-y-4 border-b border-slate-200 pb-6 pt-2">
      {fields.map((field) => (
        <div key={field.label} className="min-w-[90px]">
          <dt className="mb-1 text-xs text-slate-400 font-normal">{field.label}</dt>
          <dd className="text-sm font-semibold text-slate-800">
            {field.value}
          </dd>
        </div>
      ))}
      <div className="min-w-[90px]">
        <dt className="mb-1 text-xs text-slate-400 font-normal">Order Status</dt>
        <dd className="pt-0.5">{renderStatusBadge(order.status)}</dd>
      </div>
      <div className="min-w-[90px]">
        <dt className="mb-1 text-xs text-slate-400 font-normal">Payment Status</dt>
        <dd className="pt-0.5">
          {renderPaymentStatusBadge(
            order.payment?.status,
            order.payment ? 'Card' : order.paymentMethod
          )}
        </dd>
      </div>
    </dl>
  );
}

