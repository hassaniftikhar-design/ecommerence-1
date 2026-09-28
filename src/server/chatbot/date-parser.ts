import 'server-only';

export interface ParsedDateFilter {
  dateFilter?: { gte?: Date; lt?: Date };
  periodLabel: string;
  isFuture?: boolean;
  isInvalid?: boolean;
  errorMessage?: string;
}

const MONTH_NAMES: Record<string, number> = {
  january: 0, jan: 0,
  february: 1, feb: 1,
  march: 2, mar: 2,
  april: 3, apr: 3,
  may: 4,
  june: 5, jun: 5,
  july: 6, jul: 6,
  august: 7, aug: 7,
  september: 8, sept: 8, sep: 8,
  october: 9, oct: 9,
  november: 10, nov: 10,
  december: 11, dec: 11
};

function parseDateString(str: string): Date | null {
  if (!str) return null;
  const trimmed = str.trim();

  // 1. ISO or YYYY-MM-DD
  const isoMatch = trimmed.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:T(\d{2}):(\d{2}):(\d{2}))?/);
  if (isoMatch) {
    const year = Number(isoMatch[1]);
    const month = Number(isoMatch[2]) - 1;
    const day = Number(isoMatch[3]);
    const d = new Date(year, month, day);
    if (!isNaN(d.getTime())) return d;
  }

  // 2. DD-MM-YYYY or DD/MM/YYYY
  const dmyMatch = trimmed.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (dmyMatch) {
    const day = Number(dmyMatch[1]);
    const month = Number(dmyMatch[2]) - 1;
    const year = Number(dmyMatch[3]);
    const d = new Date(year, month, day);
    if (!isNaN(d.getTime())) return d;
  }

  // 3. Named month: e.g. "15 September 2026" or "September 15, 2026" or "15th Sept"
  const namedMatch1 = trimmed.match(/^(\d{1,2})(?:st|nd|rd|th)?\s+([A-Za-z]+)(?:\s+(\d{4}))?$/i);
  if (namedMatch1) {
    const day = Number(namedMatch1[1]);
    const monthName = namedMatch1[2]?.toLowerCase();
    const year = namedMatch1[3] ? Number(namedMatch1[3]) : new Date().getFullYear();
    if (monthName && monthName in MONTH_NAMES) {
      const month = MONTH_NAMES[monthName]!;
      const d = new Date(year, month, day);
      if (!isNaN(d.getTime())) return d;
    }
  }

  const namedMatch2 = trimmed.match(/^([A-Za-z]+)\s+(\d{1,2})(?:st|nd|rd|th)?(?:\s*,?\s*(\d{4}))?$/i);
  if (namedMatch2) {
    const monthName = namedMatch2[1]?.toLowerCase();
    const day = Number(namedMatch2[2]);
    const year = namedMatch2[3] ? Number(namedMatch2[3]) : new Date().getFullYear();
    if (monthName && monthName in MONTH_NAMES) {
      const month = MONTH_NAMES[monthName]!;
      const d = new Date(year, month, day);
      if (!isNaN(d.getTime())) return d;
    }
  }

  const fallback = new Date(trimmed);
  if (!isNaN(fallback.getTime())) return fallback;

  return null;
}

export function parseDateFilter(input: {
  period?: string;
  from?: string;
  to?: string;
  days?: number;
  date?: string;
  query?: string;
}): ParsedDateFilter {
  const now = new Date();
  const rawPeriod = (input.period || '').trim().toLowerCase();
  const rawQuery = (input.query || '').trim().toLowerCase();
  const combined = `${rawPeriod} ${rawQuery}`.trim();

  // 1. Explicit single date (e.g. date: "2026-09-15" or query: "on 15th September")
  const explicitDate = input.date ? parseDateString(input.date) : null;
  if (explicitDate) {
    if (explicitDate.getTime() > now.getTime() + 24 * 60 * 60 * 1000) {
      return {
        isFuture: true,
        periodLabel: explicitDate.toLocaleDateString(),
        errorMessage: `The selected date (${explicitDate.toLocaleDateString()}) is in the future. No past orders exist for future dates.`
      };
    }
    const startOfDay = new Date(explicitDate.getFullYear(), explicitDate.getMonth(), explicitDate.getDate(), 0, 0, 0, 0);
    const endOfDay = new Date(explicitDate.getFullYear(), explicitDate.getMonth(), explicitDate.getDate() + 1, 0, 0, 0, 0);
    return {
      dateFilter: { gte: startOfDay, lt: endOfDay },
      periodLabel: explicitDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
    };
  }

  // 2. Explicit 'from' and 'to' parameters
  if (input.from) {
    const fromDate = parseDateString(input.from);
    if (!fromDate) {
      return { isInvalid: true, periodLabel: 'Invalid Date', errorMessage: `Invalid 'from' date provided: "${input.from}"` };
    }
    const toDate = input.to ? parseDateString(input.to) : null;

    if (toDate) {
      if (toDate < fromDate) {
        return { isInvalid: true, periodLabel: 'Invalid Range', errorMessage: `Start date (${fromDate.toLocaleDateString()}) cannot be after end date (${toDate.toLocaleDateString()}).` };
      }
      if (fromDate.getTime() > now.getTime()) {
        return { isFuture: true, periodLabel: `${fromDate.toLocaleDateString()} - ${toDate.toLocaleDateString()}`, errorMessage: 'The specified date range is in the future.' };
      }
      const startOfFrom = new Date(fromDate.getFullYear(), fromDate.getMonth(), fromDate.getDate(), 0, 0, 0, 0);
      const endOfTo = new Date(toDate.getFullYear(), toDate.getMonth(), toDate.getDate() + 1, 0, 0, 0, 0);
      return {
        dateFilter: { gte: startOfFrom, lt: endOfTo },
        periodLabel: `${fromDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} – ${toDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}`
      };
    } else {
      // Single date specified via from
      const startOfDay = new Date(fromDate.getFullYear(), fromDate.getMonth(), fromDate.getDate(), 0, 0, 0, 0);
      const endOfDay = new Date(fromDate.getFullYear(), fromDate.getMonth(), fromDate.getDate() + 1, 0, 0, 0, 0);
      return {
        dateFilter: { gte: startOfDay, lt: endOfDay },
        periodLabel: fromDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
      };
    }
  }

  // 3. Days / Weeks integer or period string
  if (typeof input.days === 'number' && input.days > 0) {
    const start = new Date(now.getTime() - input.days * 24 * 60 * 60 * 1000);
    return {
      dateFilter: { gte: start },
      periodLabel: input.days === 14 ? 'Last 2 Weeks' : input.days === 21 ? 'Last 3 Weeks' : input.days === 7 ? 'Last 7 Days' : input.days === 30 ? 'Last 30 Days' : `Last ${input.days} Days`
    };
  }

  // 4. Relative time expressions in period or query
  // "last N weeks" or "N weeks"
  const weekMatch = combined.match(/\b(?:last|past)?\s*(\d+)\s*weeks?\b/i);
  if (weekMatch) {
    const weeks = Number(weekMatch[1]);
    const days = weeks * 7;
    const start = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
    return {
      dateFilter: { gte: start },
      periodLabel: weeks === 1 ? 'Last 7 Days' : `Last ${weeks} Weeks`
    };
  }

  // "last N days" or "N days"
  const dayMatch = combined.match(/\b(?:last|past)\s*(\d+)\s*days?\b/i);
  if (dayMatch) {
    const days = Number(dayMatch[1]);
    const start = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
    return {
      dateFilter: { gte: start },
      periodLabel: `Last ${days} Days`
    };
  }

  // "last N months" or "N months"
  const monthMatch = combined.match(/\b(?:last|past)\s*(\d+)\s*months?\b/i);
  if (monthMatch) {
    const months = Number(monthMatch[1]);
    const days = months * 30;
    const start = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
    return {
      dateFilter: { gte: start },
      periodLabel: `Last ${months} Months`
    };
  }

  // Standard predefined periods
  if (rawPeriod === 'today' || /\btoday\b/i.test(combined)) {
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    return { dateFilter: { gte: startOfToday }, periodLabel: 'Today' };
  }

  if (rawPeriod === 'yesterday' || /\byesterday\b/i.test(combined)) {
    const startOfYesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 0, 0, 0, 0);
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    return { dateFilter: { gte: startOfYesterday, lt: startOfToday }, periodLabel: 'Yesterday' };
  }

  if (rawPeriod === '7days' || rawPeriod === 'week' || /\b(?:this\s*week|last\s*7\s*days)\b/i.test(combined)) {
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    return { dateFilter: { gte: sevenDaysAgo }, periodLabel: 'Last 7 Days' };
  }

  if (rawPeriod === '14days' || rawPeriod === '2weeks') {
    const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
    return { dateFilter: { gte: fourteenDaysAgo }, periodLabel: 'Last 2 Weeks' };
  }

  if (rawPeriod === '30days' || /\blast\s*30\s*days\b/i.test(combined)) {
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    return { dateFilter: { gte: thirtyDaysAgo }, periodLabel: 'Last 30 Days' };
  }

  if (rawPeriod === 'this_month' || /\bthis\s*month\b/i.test(combined)) {
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
    return { dateFilter: { gte: startOfMonth }, periodLabel: 'This Month' };
  }

  if (rawPeriod === 'last_month' || /\blast\s*month\b/i.test(combined)) {
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1, 0, 0, 0, 0);
    const startOfThisMonth = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
    return { dateFilter: { gte: startOfLastMonth, lt: startOfThisMonth }, periodLabel: 'Last Month' };
  }

  if (rawPeriod === 'this_year' || /\bthis\s*year\b/i.test(combined)) {
    const startOfYear = new Date(now.getFullYear(), 0, 1, 0, 0, 0, 0);
    return { dateFilter: { gte: startOfYear }, periodLabel: 'This Year' };
  }

  if (rawPeriod === 'last_year' || /\blast\s*year\b/i.test(combined)) {
    const startOfLastYear = new Date(now.getFullYear() - 1, 0, 1, 0, 0, 0, 0);
    const startOfThisYear = new Date(now.getFullYear(), 0, 1, 0, 0, 0, 0);
    return { dateFilter: { gte: startOfLastYear, lt: startOfThisYear }, periodLabel: 'Last Year' };
  }

  // 5. Check if natural query contains date range like "from 2026-09-01 to 2026-09-15" or "on 2026-09-15"
  const rangePattern = combined.match(/(?:from|between)?\s*(\d{4}-\d{1,2}-\d{1,2}|\d{1,2}[/-]\d{1,2}[/-]\d{4})\s*(?:to|and|-)\s*(\d{4}-\d{1,2}-\d{1,2}|\d{1,2}[/-]\d{1,2}[/-]\d{4})/i);
  if (rangePattern && rangePattern[1] && rangePattern[2]) {
    const fromD = parseDateString(rangePattern[1]);
    const toD = parseDateString(rangePattern[2]);
    if (fromD && toD) {
      if (toD < fromD) {
        return { isInvalid: true, periodLabel: 'Invalid Range', errorMessage: `Start date (${fromD.toLocaleDateString()}) cannot be after end date (${toD.toLocaleDateString()}).` };
      }
      const startOfFrom = new Date(fromD.getFullYear(), fromD.getMonth(), fromD.getDate(), 0, 0, 0, 0);
      const endOfTo = new Date(toD.getFullYear(), toD.getMonth(), toD.getDate() + 1, 0, 0, 0, 0);
      return {
        dateFilter: { gte: startOfFrom, lt: endOfTo },
        periodLabel: `${fromD.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} – ${toD.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}`
      };
    }
  }

  const singleDatePattern = combined.match(/\b(?:on|date|for)\s+(\d{4}-\d{1,2}-\d{1,2}|\d{1,2}(?:st|nd|rd|th)?\s+[A-Za-z]+(?:\s+\d{4})?|[A-Za-z]+\s+\d{1,2}(?:st|nd|rd|th)?(?:\s*,?\s*\d{4})?)\b/i);
  if (singleDatePattern && singleDatePattern[1]) {
    const d = parseDateString(singleDatePattern[1]);
    if (d) {
      if (d.getTime() > now.getTime() + 24 * 60 * 60 * 1000) {
        return {
          isFuture: true,
          periodLabel: d.toLocaleDateString(),
          errorMessage: `The date ${d.toLocaleDateString()} is in the future. No store records exist for future dates.`
        };
      }
      const startOfDay = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
      const endOfDay = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1, 0, 0, 0, 0);
      return {
        dateFilter: { gte: startOfDay, lt: endOfDay },
        periodLabel: d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
      };
    }
  }

  // Default: All Time
  return { periodLabel: 'All Time' };
}
