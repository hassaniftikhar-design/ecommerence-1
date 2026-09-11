export interface PaymentStatusConfig {
    label: string;
    badgeStyle: string;
}

export const PAYMENT_STATUS_CONFIG: Record<string, PaymentStatusConfig> = {
    SUCCEEDED: {
        label: 'Paid',
        badgeStyle: 'bg-emerald-50 text-emerald-700 border-emerald-200'
    },
    PENDING: {
        label: 'Pending',
        badgeStyle: 'bg-amber-50 text-amber-700 border-amber-200'
    },
    PROCESSING: {
        label: 'Processing',
        badgeStyle: 'bg-blue-50 text-blue-700 border-blue-200'
    },
    FAILED: {
        label: 'Failed',
        badgeStyle: 'bg-red-50 text-red-700 border-red-200'
    },
    REFUNDED: {
        label: 'Refunded',
        badgeStyle: 'bg-purple-50 text-purple-700 border-purple-200'
    },
    PARTIALLY_REFUNDED: {
        label: 'Partial Refund',
        badgeStyle: 'bg-indigo-50 text-indigo-700 border-indigo-200'
    }
};

export function getPaymentStatusDetails(
    status?: string | null,
    paymentMethod?: string | null
): PaymentStatusConfig {
    if (!status) {
        if (paymentMethod === 'Cash on Delivery' || paymentMethod === 'COD') {
            return {
                label: 'Pending (COD)',
                badgeStyle: 'bg-amber-50 text-amber-700 border-amber-200'
            };
        }
        return {
            label: 'Pending',
            badgeStyle: 'bg-amber-50 text-amber-700 border-amber-200'
        };
    }

    const upper = status.toUpperCase();
    if (upper === 'PENDING' && (paymentMethod === 'Cash on Delivery' || paymentMethod === 'COD')) {
        return {
            label: 'Pending (COD)',
            badgeStyle: 'bg-amber-50 text-amber-700 border-amber-200'
        };
    }

    return (
        PAYMENT_STATUS_CONFIG[upper] || {
            label: status,
            badgeStyle: 'bg-slate-50 text-slate-700 border-slate-200'
        }
    );
}

export interface OrderStatusConfig {
    label: string;
    badgeStyle: string;
}

export const ORDER_STATUS_CONFIG: Record<string, OrderStatusConfig> = {
    IN_PROGRESS: {
        label: 'In Progress',
        badgeStyle: 'bg-[#F59E0B] text-white'
    },
    DISPATCHED: {
        label: 'Dispatched',
        badgeStyle: 'bg-[#007BFF] text-white'
    },
    DELIVERED: {
        label: 'Delivered',
        badgeStyle: 'bg-[#22C55E] text-white'
    },
    REJECTED: {
        label: 'Rejected',
        badgeStyle: 'bg-[#EF4444] text-white'
    }
};

export function getOrderStatusDetails(status?: string | null): OrderStatusConfig {
    if (!status) {
        return { label: 'In Progress', badgeStyle: 'bg-[#F59E0B] text-white' };
    }
    const upper = status.toUpperCase();
    return (
        ORDER_STATUS_CONFIG[upper] || {
            label: status,
            badgeStyle: 'bg-[#F59E0B] text-white'
        }
    );
}
