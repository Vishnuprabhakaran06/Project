import { useEffect } from "react";
import { createPortal } from "react-dom";
import "./EstimatedBillModal.css";

const fmt = (n) => `₹${Number(n || 0).toFixed(2)}`;

function formatDate(isoStr) {
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

function formatDateTime(dateObj = new Date()) {
  try {
    return dateObj.toLocaleString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
  } catch {
    return String(dateObj);
  }
}

export default function EstimatedBillModal({
  summary,
  currentPlan,
  user,
  onClose,
}) {
  // Lock body scroll while modal is open
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  // Close on ESC key
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  if (!summary) return null;

  const now = new Date();
  const invoiceDate = formatDateTime(now);
  const tenantId = user?.tenant_id || summary?.tenant_id || "-";
  const customerName =
    summary?.tenant_name ||
    user?.company_name ||
    `Customer #${tenantId}`;
  const customerEmail = user?.email || "-";

  const planName = summary?.plan || "Standard";
  const planPrice = Number(summary?.monthly_price || 0);
  const totalUsage = Number(summary?.total_usage || 0);
  const permittedLimit = Number(summary?.plan_limit || 0);
  const overageQty = Number(summary?.overage || 0);
  const overageRate = Number(currentPlan?.overage_price || 0);
  const overageCost = Number(summary?.overage_cost || 0);
  const totalEstimatedAmount = planPrice + overageCost;

  const cycleStart = summary?.billing_cycle?.start_date;
  const cycleEnd = summary?.billing_cycle?.end_date;

  const invoiceNumber = `EST-${tenantId}-${now.getFullYear()}${String(
    now.getMonth() + 1
  ).padStart(2, "0")}`;

  const handlePrint = () => window.print();

  return createPortal(
    <div
      className="bill-modal-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-label="Estimated Bill Preview"
    >
      <div className="bill-modal-container">

        {/* ── Sticky Toolbar (hidden on print) ── */}
        <div className="bill-modal-actions-bar">
          <div className="bill-modal-actions-title">
            <span>Bill Preview</span>
            <span className="preview-pill">Pro-Forma</span>
          </div>

          <div className="bill-modal-buttons">
            <button
              type="button"
              className="btn-modal-print"
              onClick={handlePrint}
              title="Print document or save as PDF"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="2"
                strokeLinecap="round" strokeLinejoin="round">
                <polyline points="6 9 6 2 18 2 18 9" />
                <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
                <rect x="6" y="14" width="12" height="8" />
              </svg>
              <span className="btn-label-full">Print / Save PDF</span>
              <span className="btn-label-short">Print</span>
            </button>

            <button
              type="button"
              className="btn-modal-close"
              onClick={onClose}
              title="Close preview"
            >
              ✕ <span className="btn-label-full">Close</span>
            </button>
          </div>
        </div>

        {/* ── Scrollable Bill Document ── */}
        <div className="bill-modal-scroll-area">
          <div className="bill-paper" id="estimated-bill-printable">

            {/* Header */}
            <div className="bill-paper-header">
              <div className="bill-paper-brand">
                <div className="bill-brand-logo">⚡ SaaS Billing</div>
                <div className="bill-brand-tagline">
                  Cloud Infrastructure &amp; Metered Usage Platform
                </div>
              </div>
              <div className="bill-invoice-meta">
                <h1 className="bill-title-label">Estimated Bill</h1>
                <div className="bill-status-pill">Unbilled · Ongoing</div>
              </div>
            </div>

            {/* Customer Details + Billing Cycle */}
            <div className="bill-info-grid">
              <div className="bill-info-box">
                <div className="bill-info-box-title">👤 Customer Details</div>
                <div className="bill-info-row">
                  <span className="label">Company</span>
                  <span className="value bill-value-wrap">{customerName}</span>
                </div>
                <div className="bill-info-row">
                  <span className="label">Email</span>
                  <span className="value bill-value-wrap">{customerEmail}</span>
                </div>
                <div className="bill-info-row">
                  <span className="label">Customer ID</span>
                  <span className="value">#{tenantId}</span>
                </div>
                <div className="bill-info-row">
                  <span className="label">Ref #</span>
                  <span className="value bill-value-wrap">{invoiceNumber}</span>
                </div>
              </div>

              <div className="bill-info-box">
                <div className="bill-info-box-title">📅 Billing Details</div>
                <div className="bill-info-row">
                  <span className="label">Plan</span>
                  <span className="value">{planName}</span>
                </div>
                <div className="bill-info-row">
                  <span className="label">Cycle</span>
                  <span className="value bill-value-wrap">
                    {formatDate(cycleStart)} – {formatDate(cycleEnd)}
                  </span>
                </div>
                <div className="bill-info-row">
                  <span className="label">Generated</span>
                  <span className="value bill-value-wrap">{invoiceDate}</span>
                </div>
                <div className="bill-info-row">
                  <span className="label">Status</span>
                  <span className="value">Active Cycle</span>
                </div>
              </div>
            </div>

            {/* Usage Metric Chips */}
            <div className="bill-highlights-bar">
              <div className="bill-highlight-chip">
                <div className="bill-chip-label">Permitted Limit</div>
                <div className="bill-chip-value">
                  {permittedLimit.toLocaleString()}
                </div>
                <div className="bill-chip-sub">requests</div>
              </div>

              <div className="bill-highlight-chip chip-accent">
                <div className="bill-chip-label">Total Usage</div>
                <div className="bill-chip-value">
                  {totalUsage.toLocaleString()}
                </div>
                <div className="bill-chip-sub">requests</div>
              </div>

              <div className={`bill-highlight-chip ${overageQty > 0 ? "chip-warning" : ""}`}>
                <div className="bill-chip-label">Excess Usage</div>
                <div className="bill-chip-value">
                  {overageQty.toLocaleString()}
                </div>
                <div className="bill-chip-sub">requests</div>
              </div>

              <div className="bill-highlight-chip">
                <div className="bill-chip-label">Excess Rate</div>
                <div className="bill-chip-value bill-chip-value--sm">
                  {fmt(overageRate)}
                </div>
                <div className="bill-chip-sub">per request</div>
              </div>
            </div>

            {/* ── Itemized Table (desktop) / Cards (mobile) ── */}
            {/* Desktop table — hidden on small screens via CSS */}
            <div className="bill-table-wrapper bill-table-desktop">
              <table className="bill-table">
                <thead>
                  <tr>
                    <th>Item Description</th>
                    <th className="text-center">Limit</th>
                    <th className="text-center">Usage</th>
                    <th className="text-center">Excess</th>
                    <th className="text-right">Rate</th>
                    <th className="text-right">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>
                      <strong>Base Plan ({planName})</strong>
                      <span className="bill-item-subtext">
                        Monthly subscription · includes {permittedLimit.toLocaleString()} API requests
                      </span>
                    </td>
                    <td className="text-center">{permittedLimit.toLocaleString()}</td>
                    <td className="text-center">{totalUsage.toLocaleString()}</td>
                    <td className="text-center">—</td>
                    <td className="text-right">{fmt(planPrice)}/mo</td>
                    <td className="text-right"><strong>{fmt(planPrice)}</strong></td>
                  </tr>
                  <tr>
                    <td>
                      <strong>Excess Usage Surcharge</strong>
                      <span className="bill-item-subtext">
                        {overageQty > 0
                          ? `${overageQty.toLocaleString()} requests beyond permitted limit`
                          : "Usage within permitted limit — no excess charge"}
                      </span>
                    </td>
                    <td className="text-center">—</td>
                    <td className="text-center">—</td>
                    <td className="text-center">
                      {overageQty > 0 ? `${overageQty.toLocaleString()}` : "0"}
                    </td>
                    <td className="text-right">{fmt(overageRate)}/req</td>
                    <td className="text-right">
                      {overageQty > 0
                        ? <strong className="text-danger">{fmt(overageCost)}</strong>
                        : <span className="badge-included">₹0.00</span>
                      }
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Mobile cards — shown only on small screens */}
            <div className="bill-item-cards bill-table-mobile">
              {/* Card 1 */}
              <div className="bill-item-card">
                <div className="bill-item-card-header">
                  <strong>Base Plan ({planName})</strong>
                  <span className="bill-item-card-amount">{fmt(planPrice)}</span>
                </div>
                <p className="bill-item-card-desc">
                  Monthly subscription · includes {permittedLimit.toLocaleString()} API requests
                </p>
                <div className="bill-item-card-meta">
                  <span>Limit: <b>{permittedLimit.toLocaleString()}</b></span>
                  <span>Usage: <b>{totalUsage.toLocaleString()}</b></span>
                  <span>Rate: <b>{fmt(planPrice)}/mo</b></span>
                </div>
              </div>

              {/* Card 2 */}
              <div className={`bill-item-card ${overageQty > 0 ? "bill-item-card--warning" : ""}`}>
                <div className="bill-item-card-header">
                  <strong>Excess Usage Surcharge</strong>
                  <span className={`bill-item-card-amount ${overageQty > 0 ? "text-danger" : "text-success"}`}>
                    {overageQty > 0 ? fmt(overageCost) : "₹0.00"}
                  </span>
                </div>
                <p className="bill-item-card-desc">
                  {overageQty > 0
                    ? `${overageQty.toLocaleString()} requests beyond permitted limit`
                    : "Usage within permitted limit — no excess charge"}
                </p>
                <div className="bill-item-card-meta">
                  <span>Excess: <b>{overageQty.toLocaleString()}</b></span>
                  <span>Rate: <b>{fmt(overageRate)}/req</b></span>
                </div>
              </div>
            </div>

            {/* Totals */}
            <div className="bill-calculation-section">
              <div className="bill-totals-box">
                <div className="bill-total-row">
                  <span className="label">Plan Base Price</span>
                  <span className="value">{fmt(planPrice)}</span>
                </div>
                <div className="bill-total-row">
                  <span className="label">Excess Usage Charges</span>
                  <span className="value">{fmt(overageCost)}</span>
                </div>
                <div className="bill-total-row total-grand">
                  <span className="label">Total Estimated Amount</span>
                  <span className="grand-amount">{fmt(totalEstimatedAmount)}</span>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="bill-paper-footer">
              <p>
                <strong>Notice:</strong> This is an estimated calculation based on metered API
                usage recorded up to {invoiceDate}. Final charges will be consolidated at the
                end of your billing cycle on {formatDate(cycleEnd)}.
              </p>
            </div>

          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
