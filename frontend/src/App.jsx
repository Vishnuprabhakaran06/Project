import { useEffect, useState } from "react";
import api from "./api";
import "./App.css";

// ── helpers ───────────────────────────────────────────────────
const fmt = (n) => `₹${Number(n || 0).toFixed(2)}`;

function formatDate(isoStr) {
  if (!isoStr) return "";
  const d = new Date(isoStr + (isoStr.endsWith("Z") ? "" : "Z"));
  return d.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatDateTime(isoStr) {
  if (!isoStr) return "";
  const d = new Date(isoStr + (isoStr.endsWith("Z") ? "" : "Z"));
  return d.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

// Progress bar colour thresholds
function progressColor(pct) {
  if (pct >= 100) return "var(--red)";
  if (pct >= 80) return "var(--amber)";
  return "var(--blue)";
}

// ── component ─────────────────────────────────────────────────
function App() {
  const [plans, setPlans] = useState([]);
  const [tenants, setTenants] = useState([]);
  const [selectedTenantId, setSelectedTenantId] = useState(1);
  const [summary, setSummary] = useState(null);
  const [recentUsage, setRecentUsage] = useState([]);
  const [loading, setLoading] = useState(true);
  const [summaryError, setSummaryError] = useState(null);
  const [toast, setToast] = useState(null);

  const showToast = (text, type = "success") => {
    setToast({ text, type });
    setTimeout(() => setToast(null), 3500);
  };

  // Load plans + tenants once
  useEffect(() => {
    api
      .get("/plans/")
      .then((r) => setPlans(r.data))
      .catch(() => showToast("Failed to load plans.", "error"));

    api
      .get("/tenants/")
      .then((r) => setTenants(r.data))
      .catch(() => showToast("Failed to load customers.", "error"));
  }, []);

  // Load summary + recent usage whenever tenant changes
  useEffect(() => {
    if (!selectedTenantId) return;
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setSummary(null);
      setSummaryError(null);
      setRecentUsage([]);
      try {
        const [sumRes, recentRes] = await Promise.all([
          api.get(`/usage/summary/${selectedTenantId}`),
          api.get(`/usage/recent/${selectedTenantId}`),
        ]);
        if (cancelled) return;
        setSummary(sumRes.data);
        setRecentUsage(recentRes.data || []);
      } catch (err) {
        if (cancelled) return;
        const detail = err?.response?.data?.detail;
        setSummaryError(
          detail === "Subscription not found"
            ? "This customer has no active subscription."
            : "Could not load usage summary. Please try again."
        );
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [selectedTenantId]);

  const refreshData = async () => {
    try {
      const [sumRes, recentRes] = await Promise.all([
        api.get(`/usage/summary/${selectedTenantId}`),
        api.get(`/usage/recent/${selectedTenantId}`),
      ]);
      setSummary(sumRes.data);
      setRecentUsage(recentRes.data || []);
    } catch (err) {
      console.error("Failed to refresh data", err);
    }
  };

  // Simulate an API call (demo)
  const recordUsage = async () => {
    try {
      await api.post("/api/request", null, {
        params: { tenant_id: selectedTenantId },
      });
      await refreshData();
      showToast("API call simulated successfully!");
    } catch {
      showToast("Failed to simulate API call.", "error");
    }
  };

  // Switch plan
  const changePlan = async (planId) => {
    try {
      await api.post("/subscriptions/", null, {
        params: { tenant_id: selectedTenantId, plan_id: planId },
      });
      await refreshData();
      showToast("Plan switched successfully!");
    } catch {
      showToast("Failed to switch plan.", "error");
    }
  };

  // ── derived values ─────────────────────────────────────────
  const pct =
    summary && summary.plan_limit > 0
      ? (summary.total_usage / summary.plan_limit) * 100
      : 0;
  const cappedPct = Math.min(pct, 100);
  const isOver = summary && summary.overage > 0;
  const isWarning = !isOver && pct >= 80;

  const totalDue = summary
    ? Number(summary.monthly_price || 0) + Number(summary.overage_cost || 0)
    : 0;

  // Savings hint for plan comparison
  const currentPlan = plans.find((p) => p.name === summary?.plan);
  const getSavingsHint = (plan) => {
    if (!summary || !currentPlan) return null;
    if (plan.name === summary.plan) return null;
    const currentTotal =
      Number(currentPlan.monthly_price || 0) +
      summary.overage * Number(currentPlan.overage_price || 0);
    const altTotal =
      Number(plan.monthly_price || 0) +
      Math.max(summary.total_usage - plan.request_limit, 0) *
        Number(plan.overage_price || 0);
    const diff = currentTotal - altTotal;
    if (Math.abs(diff) < 0.01) return null;
    if (diff > 0) return `Switching would save you ${fmt(diff)} this cycle`;
    return `Switching would cost ${fmt(-diff)} more this cycle`;
  };

  // ── render ─────────────────────────────────────────────────
  return (
    <div className="dashboard">
      {/* ── Toast ── */}
      {toast && (
        <div className={`toast toast-${toast.type}`} role="alert">
          {toast.type === "success" ? "✓" : "✕"} {toast.text}
        </div>
      )}

      {/* ── Header ── */}
      <header className="dashboard-header">
        <div className="header-title">
          <h1>SaaS Billing Dashboard</h1>
          <p className="header-subtitle">Usage and subscription overview</p>
        </div>

        <div className="tenant-selector">
          <label htmlFor="tenant-select">Select Customer</label>
          <select
            id="tenant-select"
            value={selectedTenantId}
            onChange={(e) => {
              setSelectedTenantId(Number(e.target.value));
            }}
          >
            {tenants.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </div>
      </header>

      {/* ── Loading ── */}
      {loading && (
        <div className="status-banner">
          ⏳ Loading customer data...
        </div>
      )}

      {/* ── Error ── */}
      {summaryError && !loading && (
        <div className="status-banner status-error" role="alert">
          ⚠️ {summaryError}
        </div>
      )}

      {/* ── Main dashboard ── */}
      {summary && !loading && (
        <>
          {/* ── 2. Warning / Alert State ── */}
          {isOver && (
            <div className="alert-banner alert-danger" role="alert">
              <span className="alert-icon">⚠️</span>
              <div>
                <strong>Limit Exceeded: </strong>
                <span>
                  You've exceeded your plan by {summary.overage} request
                  {summary.overage !== 1 ? "s" : ""}. Additional overage charges apply.
                </span>
              </div>
            </div>
          )}
          {isWarning && (
            <div className="alert-banner alert-warning" role="alert">
              <span className="alert-icon">⚠️</span>
              <div>
                <strong>Approaching plan limit: </strong>
                <span>
                  You have used {Math.round(pct)}% of your plan limit. Only{" "}
                  {summary.remaining_usage} request
                  {summary.remaining_usage !== 1 ? "s" : ""} remaining.
                </span>
              </div>
            </div>
          )}

          {/* ── 6. Visual Hierarchy: Usage Hero Card ── */}
          <section
            className={`hero-card ${
              isOver ? "hero-over" : isWarning ? "hero-warn" : ""
            }`}
          >
            <div className="hero-top">
              <div className="hero-left">
                <span className="hero-label">CURRENT USAGE</span>
                <div className="hero-number">
                  <span
                    className={
                      isOver
                        ? "text-red"
                        : isWarning
                        ? "text-amber"
                        : "text-blue"
                    }
                  >
                    {summary.total_usage.toLocaleString()}
                  </span>
                  <span className="hero-limit">
                    {" "}
                    / {summary.plan_limit.toLocaleString()} requests
                  </span>
                </div>
                <div className="hero-sub">
                  {isOver
                    ? `${summary.overage} requests over the limit`
                    : `${summary.remaining_usage.toLocaleString()} requests remaining`}
                </div>
              </div>

              {/* ── 4. Billing Period ── */}
              {summary.billing_cycle && (
                <div className="billing-period-card">
                  <span className="bp-label">Current Cycle</span>
                  <span className="bp-dates">
                    {formatDate(summary.billing_cycle.start_date)} –{" "}
                    {formatDate(summary.billing_cycle.end_date)}
                  </span>
                  <span className="bp-reset">
                    Resets in{" "}
                    <strong>{summary.billing_cycle.days_remaining}</strong> day
                    {summary.billing_cycle.days_remaining !== 1 ? "s" : ""}
                  </span>
                </div>
              )}
            </div>

            {/* ── 1. Progress Bar with Overage Visibility ── */}
            <div className="progress-container">
              <div className="progress-labels">
                <span>Usage</span>
                <span
                  style={{
                    color: progressColor(pct),
                    fontWeight: 700,
                  }}
                >
                  {Math.round(pct)}%
                </span>
              </div>
              <div className="progress-bar-track">
                <div
                  className="progress-fill"
                  style={{
                    width: `${cappedPct}%`,
                    backgroundColor: progressColor(pct),
                  }}
                />
                {isOver && (
                  <div
                    className="progress-limit-marker"
                    title="100% Plan Limit"
                  />
                )}
              </div>
              {isOver && (
                <div className="progress-overage-legend">
                  <span>| 100% Limit Reached</span>
                  <span className="text-red font-semibold">
                    +{summary.overage} Overage ({Math.round(pct)}%)
                  </span>
                </div>
              )}
            </div>

            {/* ── 8. Simulate API Call Button Label ── */}
            <div className="hero-actions">
              <button
                id="simulate-api-btn"
                className="usage-button"
                onClick={recordUsage}
              >
                ⚡ Simulate API Call (demo)
              </button>
            </div>
          </section>

          {/* ── 6. Metrics Grid (Plan Details & Secondary Stats) ── */}
          <div className="summary-grid">
            <div className="card">
              <span>Current Plan</span>
              <strong>{summary.plan}</strong>
            </div>

            <div className="card">
              <span>Monthly Base Price</span>
              <strong>{fmt(summary.monthly_price)}</strong>
            </div>

            <div className="card">
              <span>Remaining Usage</span>
              <strong>{summary.remaining_usage}</strong>
            </div>

            <div className={`card ${isOver ? "card-danger" : ""}`}>
              <span>Overage Requests</span>
              <strong className={isOver ? "text-red" : ""}>
                {summary.overage}
              </strong>
            </div>

            <div className={`card ${isOver ? "card-danger" : ""}`}>
              <span>Overage Rate</span>
              <strong>
                {fmt(currentPlan?.overage_price || 0)} / req
              </strong>
            </div>

            {/* ── 9. Minor Polish: ₹1.60 formatted as two decimal places ── */}
            <div className={`card ${isOver ? "card-danger" : ""}`}>
              <span>Overage Cost</span>
              <strong className={isOver ? "text-red" : ""}>
                {fmt(summary.overage_cost)}
              </strong>
            </div>
          </div>

          {/* ── 3. Cost Summary (Estimated Invoice) ── */}
          <section className="cost-summary-card">
            <div className="cost-summary-header">
              <div>
                <h2>Estimated Invoice</h2>
                <p className="section-subtitle">
                  Current billing cycle breakdown (base subscription + overage fees)
                </p>
              </div>
              <span className="invoice-badge">Current Cycle</span>
            </div>

            <div className="cost-breakdown-list">
              <div className="cost-breakdown-item">
                <span className="cost-item-name">
                  Base Plan: <strong>{summary.plan}</strong>
                </span>
                <span className="cost-item-price">
                  {fmt(summary.monthly_price)}
                </span>
              </div>

              <div
                className={`cost-breakdown-item ${
                  isOver ? "cost-breakdown-overage" : ""
                }`}
              >
                <span className="cost-item-name">
                  Overage Charges ({summary.overage} requests ×{" "}
                  {fmt(currentPlan?.overage_price || 0)})
                </span>
                <span
                  className={`cost-item-price ${
                    isOver ? "text-red" : ""
                  }`}
                >
                  {fmt(summary.overage_cost)}
                </span>
              </div>

              <div className="cost-breakdown-total">
                <span className="total-label">Total Estimated Due</span>
                <span className="total-price">{fmt(totalDue)}</span>
              </div>
            </div>
          </section>

          {/* ── 5. Usage History (Recent Events Table) ── */}
          <section className="history-section">
            <div className="history-header">
              <div>
                <h2>Usage History</h2>
                <p className="section-subtitle">
                  Recent API activity and event logs for tracking
                </p>
              </div>
              <span className="history-count">
                {recentUsage.length} event{recentUsage.length !== 1 ? "s" : ""}
              </span>
            </div>

            {recentUsage.length === 0 ? (
              <p className="empty-history">
                No recorded API calls yet for this customer.
              </p>
            ) : (
              <div className="history-table-container">
                <table className="history-table">
                  <thead>
                    <tr>
                      <th>Record ID</th>
                      <th>Event Type</th>
                      <th>Timestamp</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentUsage.map((record) => (
                      <tr key={record.id}>
                        <td className="id-cell">#{record.id}</td>
                        <td>
                          <span className="badge-event-type">
                            {record.usage_type}
                          </span>
                        </td>
                        <td className="time-cell">
                          {formatDateTime(record.created_at)}
                        </td>
                        <td>
                          <span className="badge-status-recorded">
                            Recorded
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {/* ── 7. Plan Comparison with Price, Recommended badge & Savings hint ── */}
          <section className="plans-section">
            <h2>Available Plans</h2>
            <p className="section-subtitle">
              Compare plans and easily upgrade or switch
            </p>

            <div className="plans-grid">
              {plans.map((plan) => {
                const isActive = plan.name === summary.plan;
                const isPro = plan.name.toLowerCase().includes("pro");
                const hint = getSavingsHint(plan);

                return (
                  <div
                    className={`plan-card ${
                      isActive ? "active-plan" : ""
                    } ${isPro ? "recommended-plan-card" : ""}`}
                    key={plan.id}
                  >
                    {isPro && (
                      <div className="recommended-badge">
                        Recommended
                      </div>
                    )}

                    <div className="plan-header">
                      <h3>{plan.name}</h3>
                      {isActive && (
                        <span className="current-badge">Active</span>
                      )}
                    </div>

                    <div className="plan-pricing-row">
                      <span className="plan-price-val">
                        {fmt(plan.monthly_price)}
                      </span>
                      <span className="plan-price-period">/ month</span>
                    </div>

                    <div className="plan-features">
                      <p className="limit">
                        <strong>
                          {plan.request_limit.toLocaleString()}
                        </strong>{" "}
                        requests included
                      </p>
                      <p className="plan-overage-text">
                        {fmt(plan.overage_price)} per extra request
                      </p>
                    </div>

                    {hint && (
                      <div
                        className={`savings-hint ${
                          hint.includes("save")
                            ? "savings-hint-positive"
                            : "savings-hint-neutral"
                        }`}
                      >
                        💡 {hint}
                      </div>
                    )}

                    <button
                      className="plan-switch-btn"
                      onClick={() => changePlan(plan.id)}
                      disabled={isActive}
                    >
                      {isActive ? "Current Plan" : `Switch to ${plan.name}`}
                    </button>
                  </div>
                );
              })}
            </div>
          </section>
        </>
      )}
    </div>
  );
}

export default App;