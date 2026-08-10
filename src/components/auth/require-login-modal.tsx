"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { LogIn, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ROUTES } from "@/constants/routes";

interface RequireLoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
}

export function RequireLoginModal({
  isOpen,
  onClose,
  title = "Login Required",
  description = "Please log in to your account to view your cart or add items to your cart.",
}: RequireLoginModalProps) {
  const [mounted, setMounted] = useState(false);
  const router = useRouter();

  useEffect(() => {
    setMounted(true);
  }, []);

  // Prevent background scrolling when open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  if (!isOpen || !mounted) return null;

  const handleLoginClick = () => {
    onClose();
    router.push(ROUTES.login);
  };

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 overflow-hidden">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-xs transition-opacity duration-300"
        onClick={onClose}
      />

      {/* Modal Container */}
      <div className="relative z-[10000] w-full max-w-md bg-white rounded-2xl p-6 sm:p-8 shadow-2xl border border-slate-100 text-center animate-in fade-in zoom-in-95 duration-200">
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 rounded-full p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition cursor-pointer"
          aria-label="Close modal"
        >
          <X className="h-5 w-5" />
        </button>

        {/* Login Icon */}
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-blue-50 text-[#007BFF] border border-blue-100 shadow-xs">
          <LogIn className="h-8 w-8 stroke-[2.2] ml-0.5" />
        </div>

        {/* Title & Description */}
        <h3 className="text-xl font-bold text-slate-900">{title}</h3>
        <p className="text-sm text-slate-500 mt-2 leading-relaxed">
          {description}
        </p>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-3 pt-6 w-full">
          <Button
            type="button"
            onClick={onClose}
            className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold h-11 rounded-xl text-xs sm:text-sm border border-slate-200 transition cursor-pointer"
          >
            Cancel
          </Button>

          <Button
            type="button"
            onClick={handleLoginClick}
            className="flex-1 bg-[#007BFF] hover:bg-[#0056b3] text-white font-semibold h-11 rounded-xl text-xs sm:text-sm shadow-sm transition cursor-pointer flex items-center justify-center gap-2"
          >
            <LogIn className="h-4 w-4" />
            Login
          </Button>
        </div>
      </div>
    </div>,
    document.body
  );
}
