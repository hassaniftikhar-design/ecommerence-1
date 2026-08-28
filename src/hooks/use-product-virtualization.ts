"use client";

import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import type { Product } from "@/types/product.types";
import {
  PRODUCT_RENDER_WINDOW_SIZE,
  PRODUCT_FETCH_BATCH_SIZE,
  PRODUCT_ESTIMATED_ROW_HEIGHT_PX,
  PRODUCT_GRID_GAP_DESKTOP_PX,
  PRODUCT_GRID_GAP_MOBILE_PX,
  PRODUCT_PREFETCH_ROOT_MARGIN,
  PRODUCT_VIRTUAL_OVERSCAN_ROWS,
} from "@/constants/generalconstants";

export interface UseProductVirtualizationOptions {
  items: Product[];
  totalCatalogCount?: number;
  firstLoadedPageNumber?: number;
  hasNextPage?: boolean;
  hasPreviousPage?: boolean;
  isFetchingNextPage?: boolean;
  isFetchingPreviousPage?: boolean;
  fetchNextPage: () => Promise<unknown> | void;
  fetchPreviousPage: () => Promise<unknown> | void;
  filterKey?: string;
}

export interface UseProductVirtualizationReturn {
  visibleProducts: Product[];
  startIndex: number;
  endIndex: number;
  topSpacerHeight: number;
  bottomSpacerHeight: number;
  columns: number;
  outerWrapperRef: React.RefObject<HTMLDivElement | null>;
  topSentinelRef: React.RefObject<HTMLDivElement | null>;
  bottomSentinelRef: React.RefObject<HTMLDivElement | null>;
}

export function useProductVirtualization({
  items,
  firstLoadedPageNumber = 1,
  hasNextPage = false,
  hasPreviousPage = false,
  isFetchingNextPage = false,
  isFetchingPreviousPage = false,
  fetchNextPage,
  fetchPreviousPage,
  filterKey = "",
}: UseProductVirtualizationOptions): UseProductVirtualizationReturn {
  const outerWrapperRef = useRef<HTMLDivElement | null>(null);
  const topSentinelRef = useRef<HTMLDivElement | null>(null);
  const bottomSentinelRef = useRef<HTMLDivElement | null>(null);

  const [columns, setColumns] = useState<number>(4);
  const [measuredRowHeight, setMeasuredRowHeight] = useState<number>(PRODUCT_ESTIMATED_ROW_HEIGHT_PX);
  const [startIndex, setStartIndex] = useState<number>(0);

  // Keep latest callbacks/values in refs to avoid recreating observers/scroll handlers
  const callbacksRef = useRef({
    fetchNextPage,
    fetchPreviousPage,
    hasNextPage,
    hasPreviousPage,
    isFetchingNextPage,
    isFetchingPreviousPage,
    itemsLength: items.length,
    startIndex,
    columns,
    measuredRowHeight,
  });

  callbacksRef.current = {
    fetchNextPage,
    fetchPreviousPage,
    hasNextPage,
    hasPreviousPage,
    isFetchingNextPage,
    isFetchingPreviousPage,
    itemsLength: items.length,
    startIndex,
    columns,
    measuredRowHeight,
  };

  // Reset window position to top whenever search, filter, or sort changes
  useEffect(() => {
    setStartIndex(0);
  }, [filterKey]);

  // Responsive column count detector
  useEffect(() => {
    const updateColumns = () => {
      const width = window.innerWidth;
      if (width >= 1024) {
        setColumns(4);
      } else if (width >= 768) {
        setColumns(3);
      } else {
        setColumns(2);
      }
    };

    updateColumns();
    window.addEventListener("resize", updateColumns, { passive: true });
    return () => window.removeEventListener("resize", updateColumns);
  }, []);

  // Dynamically measure actual rendered product card height once without recreating observer
  useEffect(() => {
    const container = outerWrapperRef.current;
    if (!container) return;

    const measureCard = () => {
      const cardEl = container.querySelector<HTMLElement>("[data-product-card]");
      if (cardEl) {
        const height = cardEl.getBoundingClientRect().height;
        if (
          height > 0 &&
          Math.abs(height - callbacksRef.current.measuredRowHeight) > 10
        ) {
          setMeasuredRowHeight(Math.round(height));
        }
      }
    };

    measureCard();

    const resizeObserver = new ResizeObserver(() => {
      measureCard();
    });

    resizeObserver.observe(container);
    return () => resizeObserver.disconnect();
  }, []);

  const totalLoaded = items.length;
  const pageOffset = Math.max(0, (firstLoadedPageNumber - 1) * PRODUCT_FETCH_BATCH_SIZE);

  // Window bounds calculation
  const maxStart = Math.max(0, totalLoaded - PRODUCT_RENDER_WINDOW_SIZE);
  const clampedStartIndex = Math.max(0, Math.min(startIndex, maxStart));

  // Align start index to beginning of full grid row
  const rowAlignedStartIndex = Math.floor(clampedStartIndex / columns) * columns;

  // When nearing the end of loaded products, include all remaining products so no trailing orphan row is left in the spacer
  const remainingLoaded = totalLoaded - rowAlignedStartIndex;
  const targetWindowSize =
    remainingLoaded <= PRODUCT_RENDER_WINDOW_SIZE + columns
      ? remainingLoaded
      : PRODUCT_RENDER_WINDOW_SIZE;

  const endIndex = Math.min(totalLoaded, rowAlignedStartIndex + targetWindowSize);

  const visibleProducts = useMemo(() => {
    return items.slice(rowAlignedStartIndex, endIndex);
  }, [items, rowAlignedStartIndex, endIndex]);

  // Spacer heights calculation
  const gap = columns === 4 ? PRODUCT_GRID_GAP_DESKTOP_PX : PRODUCT_GRID_GAP_MOBILE_PX;
  const effectiveRowHeight = measuredRowHeight + gap;

  const itemsAbove = pageOffset + rowAlignedStartIndex;
  const rowsAbove = Math.floor(itemsAbove / columns);

  // Bottom spacer only accounts for unmounted products currently loaded in memory below the render window
  const itemsBelow = Math.max(0, totalLoaded - endIndex);
  const rowsBelow = Math.ceil(itemsBelow / columns);

  const topSpacerHeight = rowsAbove > 0 ? rowsAbove * effectiveRowHeight : 0;
  const bottomSpacerHeight = rowsBelow > 0 ? rowsBelow * effectiveRowHeight : 0;

  // Stable window advance helper
  const shiftWindow = useCallback((deltaRows: number) => {
    setStartIndex((prev) => {
      const { itemsLength, columns: currentCols } = callbacksRef.current;
      const currentAligned = Math.floor(prev / currentCols) * currentCols;
      const target = currentAligned + deltaRows * currentCols;
      const maxPossibleStart = Math.max(0, itemsLength - PRODUCT_RENDER_WINDOW_SIZE);
      const clamped = Math.max(0, Math.min(target, maxPossibleStart));
      const aligned = Math.floor(clamped / currentCols) * currentCols;
      return aligned !== prev ? aligned : prev;
    });
  }, []);

  // Top and Bottom IntersectionObservers for bidirectional window movement and prefetching
  useEffect(() => {
    const bottomEl = bottomSentinelRef.current;
    if (!bottomEl) return;

    const bottomObserver = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (!entry?.isIntersecting) return;

        const {
          hasNextPage: hasNext,
          isFetchingNextPage: isFetchingNext,
          fetchNextPage: doFetchNext,
          itemsLength,
          startIndex: currentStart,
          columns: currentCols,
        } = callbacksRef.current;

        // Slide window down if more cached items exist ahead
        const currentEnd = Math.min(itemsLength, currentStart + PRODUCT_RENDER_WINDOW_SIZE);
        if (currentEnd < itemsLength) {
          shiftWindow(PRODUCT_VIRTUAL_OVERSCAN_ROWS);
        }

        // Prefetch next batch from API if approaching end of loaded dataset
        if (currentEnd >= itemsLength - currentCols * 2 && hasNext && !isFetchingNext) {
          doFetchNext();
        }
      },
      { rootMargin: PRODUCT_PREFETCH_ROOT_MARGIN }
    );

    bottomObserver.observe(bottomEl);
    return () => bottomObserver.disconnect();
  }, [shiftWindow]);

  useEffect(() => {
    const topEl = topSentinelRef.current;
    if (!topEl) return;

    const topObserver = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (!entry?.isIntersecting) return;

        const {
          hasPreviousPage: hasPrev,
          isFetchingPreviousPage: isFetchingPrev,
          fetchPreviousPage: doFetchPrev,
          startIndex: currentStart,
        } = callbacksRef.current;

        // Slide window up if cached items exist behind
        if (currentStart > 0) {
          shiftWindow(-PRODUCT_VIRTUAL_OVERSCAN_ROWS);
        }

        // Prefetch previous batch from API if scrolled back to top of cached window
        if (currentStart <= 0 && hasPrev && !isFetchingPrev) {
          doFetchPrev();
        }
      },
      { rootMargin: PRODUCT_PREFETCH_ROOT_MARGIN }
    );

    topObserver.observe(topEl);
    return () => topObserver.disconnect();
  }, [shiftWindow]);

  // Window scroll sync with RAF for fast scrolling
  useEffect(() => {
    let rafId: number | null = null;

    const onScroll = () => {
      if (rafId !== null) return;

      rafId = window.requestAnimationFrame(() => {
        rafId = null;
        const outerEl = outerWrapperRef.current;
        if (!outerEl) return;

        // Measure distance relative to outer component wrapper (which never shifts when spacers change)
        const rect = outerEl.getBoundingClientRect();
        const offsetFromTop = -rect.top;
        const {
          columns: currentCols,
          measuredRowHeight: currentCardHeight,
          itemsLength,
          startIndex: currentStart,
          hasNextPage: hasNext,
          hasPreviousPage: hasPrev,
          isFetchingNextPage: isFetchingNext,
          isFetchingPreviousPage: isFetchingPrev,
          fetchNextPage: doFetchNext,
          fetchPreviousPage: doFetchPrev,
        } = callbacksRef.current;

        const currentGap =
          currentCols === 4 ? PRODUCT_GRID_GAP_DESKTOP_PX : PRODUCT_GRID_GAP_MOBILE_PX;
        const rowH = currentCardHeight + currentGap;

        if (offsetFromTop <= 0) {
          if (currentStart !== 0) {
            setStartIndex(0);
          }
          if (hasPrev && !isFetchingPrev) {
            doFetchPrev();
          }
          return;
        }

        const isNearBottom =
          window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 250;

        if (isNearBottom) {
          const maxPossibleStart = Math.max(0, itemsLength - PRODUCT_RENDER_WINDOW_SIZE);
          const alignedMax = Math.floor(maxPossibleStart / currentCols) * currentCols;
          if (alignedMax !== currentStart) {
            setStartIndex(alignedMax);
          }
          if (hasNext && !isFetchingNext) {
            doFetchNext();
          }
          return;
        }

        const approxRow = Math.floor(offsetFromTop / rowH);
        const targetRow = Math.max(0, approxRow - PRODUCT_VIRTUAL_OVERSCAN_ROWS);
        const maxPossibleStart = Math.max(0, itemsLength - PRODUCT_RENDER_WINDOW_SIZE);
        const targetStart = Math.min(maxPossibleStart, targetRow * currentCols);
        const alignedStart = Math.floor(targetStart / currentCols) * currentCols;

        if (Math.abs(currentStart - alignedStart) >= currentCols) {
          setStartIndex(alignedStart);
        }

        // Prefetch trigger on scroll
        const currentEnd = alignedStart + PRODUCT_RENDER_WINDOW_SIZE;
        if (currentEnd >= itemsLength - currentCols * 2 && hasNext && !isFetchingNext) {
          doFetchNext();
        }
        if (alignedStart <= currentCols && hasPrev && !isFetchingPrev) {
          doFetchPrev();
        }
      });
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (rafId !== null) window.cancelAnimationFrame(rafId);
    };
  }, []);

  return {
    visibleProducts,
    startIndex: rowAlignedStartIndex,
    endIndex,
    topSpacerHeight,
    bottomSpacerHeight,
    columns,
    outerWrapperRef,
    topSentinelRef,
    bottomSentinelRef,
  };
}
