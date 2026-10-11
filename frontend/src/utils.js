/**
 * Shared formatting utilities used across customer and admin dashboards.
 */

/** Format a number as Indian Rupees (e.g. ₹1.23) */
export const fmt = (n) => `₹${Number(n || 0).toFixed(2)}`;

/** Format an ISO date string as "DD Mon YYYY" in en-IN locale */
export function formatDate(isoStr) {
  if (!isoStr) return "-";
  try {
    const d = new Date(isoStr + (isoStr.endsWith("Z") ? "" : "Z"));
    return d.toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return isoStr;
  }
}

/** Format an ISO datetime string as "DD Mon, HH:MM AM/PM" in en-IN locale */
export function formatDateTime(isoStr) {
  if (!isoStr) return "-";
  try {
    const d = new Date(isoStr + (isoStr.endsWith("Z") ? "" : "Z"));
    return d.toLocaleString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
  } catch {
    return isoStr;
  }
}
