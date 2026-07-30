

// "use client";

// import { Minus, Plus } from "lucide-react";
// import { useQuantity } from "@/hooks/use-quantity";

// interface QuantitySelectorProps {
//   initialValue: number;
//   onChange?: (quantity: number) => void;
// }

// export function QuantitySelector({
//   initialValue,
//   onChange,
// }: QuantitySelectorProps) {
//   const { quantity, increment, decrement } = useQuantity(initialValue);

//   const handleIncrement = () => {
//     increment();
//     onChange?.(quantity + 1);
//   };
//   const handleDecrement = () => {
//     decrement();
//     onChange?.(quantity - 1);
//   };

//   const formattedQuantity = quantity < 10 ? `0${quantity}` : String(quantity);

//   return (
//     <div className="flex shrink-0 items-center gap-0.5 @xs:gap-1">
//       <button
//         type="button"
//         onClick={handleDecrement}
//         aria-label="Decrease quantity"
//         className="flex h-6 w-6 items-center justify-center rounded border border-[#E2E8F0] text-[#007BFF] transition-colors hover:bg-gray-50 @xs:h-8 @xs:w-8"
//       >
//         <Minus className="h-3 w-3 @xs:h-4 @xs:w-4" />
//       </button>

//       <span
//         aria-live="polite"
//         className="flex h-6 w-6 items-center justify-center rounded border border-[#E2E8F0] text-[10px] font-medium text-gray-900 @xs:h-8 @xs:w-9 @xs:text-sm"
//       >
//         {formattedQuantity}
//       </span>

//       <button
//         type="button"
//         onClick={handleIncrement}
//         aria-label="Increase quantity"
//         className="flex h-6 w-6 items-center justify-center rounded border border-[#E2E8F0] text-[#007BFF] transition-colors hover:bg-gray-50 @xs:h-8 @xs:w-8"
//       >
//         <Plus className="h-3 w-3 @xs:h-4 @xs:w-4" />
//       </button>
//     </div>
//   );
// }



"use client";

import { Minus, Plus } from "lucide-react";
import { useQuantity } from "@/hooks/use-quantity";

interface QuantitySelectorProps {
  initialValue: number;
  onChange?: (quantity: number) => void;
}

export function QuantitySelector({
  initialValue,
  onChange,
}: QuantitySelectorProps) {
  const { quantity, increment, decrement } = useQuantity(initialValue);

  const handleIncrement = () => {
    increment();
    onChange?.(quantity + 1);
  };
  const handleDecrement = () => {
    decrement();
    onChange?.(quantity - 1);
  };

  const formattedQuantity = quantity < 10 ? `0${quantity}` : String(quantity);

  return (
   
    <div className="flex w-auto items-center gap-0.5 max-[395px]:w-full max-[395px]:justify-between max-[395px]:gap-1 @xs:gap-1">
      <button
        type="button"
        onClick={handleDecrement} 
        aria-label="Decrease quantity"
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded border border-[#E2E8F0] text-[#007BFF] transition-colors hover:bg-gray-50 max-[395px]:h-8 max-[395px]:w-8 @xs:h-8 @xs:w-8"
      >
        <Minus className="h-3 w-3 max-[395px]:h-4 max-[395px]:w-4 @xs:h-4 @xs:w-4" />
      </button>

    
      <span
        aria-live="polite"
        className="flex h-7 w-7 items-center justify-center rounded border border-[#E2E8F0] text-[10px] font-medium text-gray-900 max-[395px]:h-8 max-[395px]:flex-1 max-[395px]:text-xs @xs:h-8 @xs:w-9 @xs:text-sm"
      >
        {formattedQuantity}
      </span>

      <button
        type="button"
        onClick={handleIncrement}
        aria-label="Increase quantity"
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded border border-[#E2E8F0] text-[#007BFF] transition-colors hover:bg-gray-50 max-[395px]:h-8 max-[395px]:w-8 @xs:h-8 @xs:w-8"
      >
        <Plus className="h-3 w-3 max-[395px]:h-4 max-[395px]:w-4 @xs:h-4 @xs:w-4" />
      </button>
    </div>
  );
}