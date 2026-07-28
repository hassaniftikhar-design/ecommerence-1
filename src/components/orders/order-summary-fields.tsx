import type { OrderDetail } from "@/types/order.types";

interface Field {
  label: string;
  value: string;
}

// The top of Order Detail is a fixed set of label/value pairs
// (Date, Order #, User, Products, Amount). One small component instead
// of five hand-copied <div> pairs, and the field list is data so
// adding a field later (e.g. "Status") is a one-line change here.
export function OrderSummaryFields({ order }: { order: OrderDetail }) {
  const fields: Field[] = [
    { label: "Date", value: order.date },
    { label: "Order #", value: order.orderNumber },
    { label: "User", value: order.user },
    { label: "Products", value: String(order.productsCount).padStart(2, "0") },
    { label: "Amount", value: `$${order.amount.toFixed(2)}` },
  ];

  return (
    <dl className="flex flex-wrap gap-x-16 gap-y-4 border-b border-border-card pb-6">
      {fields.map((field) => (
        <div key={field.label}>
          <dt className="mb-1 text-sm text-meta">{field.label}</dt>
          <dd className="text-base font-medium text-charcoal">
            {field.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}
