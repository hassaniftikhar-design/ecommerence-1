/**
 * Calculates a 5-box sliding window for pagination throughout the application.
 * - Displays at most 5 page buttons at any time.
 * - When currentPage > 5 (e.g. clicking Next to go to page 6), page 1 rolls off and page 6 appears ([2, 3, 4, 5, 6]).
 * - When currentPage <= 5, displays [1, 2, 3, 4, 5].
 * - When approaching the end of total pages, pins to the last 5 pages ([totalPages - 4, ..., totalPages]).
 */
export function getPaginationRange(
  currentPage: number,
  totalPages: number,
  maxVisible: number = 5
): number[] {
  if (totalPages <= 0) return [];
  if (totalPages <= maxVisible) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }

  let startPage = 1;
  if (currentPage > maxVisible) {
    startPage = currentPage - maxVisible + 1;
  }

  if (startPage + maxVisible - 1 > totalPages) {
    startPage = totalPages - maxVisible + 1;
  }

  const count = Math.min(maxVisible, totalPages - startPage + 1);
  return Array.from({ length: count }, (_, i) => startPage + i);
}
