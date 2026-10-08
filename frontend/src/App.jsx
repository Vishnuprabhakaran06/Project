import { useEffect, useState, useMemo } from "react";
import api from "./api";
import Login from "./Login";
import AdminDashboard from "./AdminDashboard";
import Signup from "./Signup";
import VerifyEmail from "./VerifyEmail";
import "./App.css";

// ── helpers ───────────────────────────────────────────────────
const fmt = (n) => `₹${Number(n || 0).toFixed(2)}`;

function formatDate(isoStr) {
  if (!isoStr) return "";

  const d = new Date(
    isoStr + (isoStr.endsWith("Z") ? "" : "Z")
  );

  return d.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatDateTime(isoStr) {
  if (!isoStr) return "";

  const d = new Date(
    isoStr + (isoStr.endsWith("Z") ? "" : "Z")
  );

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

  const [summary, setSummary] = useState(null);
  const [recentUsage, setRecentUsage] = useState([]);

  const [loading, setLoading] = useState(true);
  const [summaryError, setSummaryError] = useState(null);

  const [toast, setToast] = useState(null);
  const [showSignup, setShowSignup] = useState(false);

  // History filtering & pagination
  const [startDateFilter, setStartDateFilter] = useState("");
  const [endDateFilter, setEndDateFilter] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const PAGE_SIZE = 20;

  const handleStartDateChange = (e) => {
    setStartDateFilter(e.target.value);
    setCurrentPage(1);
  };

  const handleEndDateChange = (e) => {
    setEndDateFilter(e.target.value);
    setCurrentPage(1);
  };

  const handleResetFilters = () => {
    setStartDateFilter("");
    setEndDateFilter("");
    setCurrentPage(1);
  };

  const [user, setUser] = useState(() => {
    const savedUser = localStorage.getItem("user");
    return savedUser ? JSON.parse(savedUser) : null;
  });

  // ── Toast ────────────────────────────────────────────────────
  const showToast = (text, type = "success") => {
    setToast({ text, type });

    setTimeout(() => {
      setToast(null);
    }, 3500);
  };

  // ── Load plans ───────────────────────────────────────────────
  useEffect(() => {
    api
      .get("/plans/")
      .then((r) => {
        setPlans(r.data || []);
      })
      .catch(() => {
        showToast("Failed to load plans.", "error");
      });
  }, []);

  // ── Load customer usage ─────────────────────────────────────
  useEffect(() => {
    if (!user || user.role !== "CUSTOMER") return;

    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setSummary(null);
      setSummaryError(null);
      setRecentUsage([]);

      try {
        const [sumRes, recentRes] = await Promise.all([
          api.get("/usage/summary"),
          api.get("/usage/recent?limit=200"),
        ]);

        if (cancelled) return;

        if (sumRes.data.subscription_status === "EXPIRED") {
          setSummary(null);
          setSummaryError("You have no active subscription.");
        } else {
          setSummary(sumRes.data);
        }
        setRecentUsage(recentRes.data || []);
      } catch (err) {
        if (cancelled) return;

        const detail = err?.response?.data?.detail;

        setSummaryError(
          detail === "Subscription not found"
            ? "You have no active subscription."
            : "Could not load usage summary. Please try again."
        );
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    load();

    return () => {
      cancelled = true;
    };
  }, [user]);

  // ── Refresh dashboard data ──────────────────────────────────
  const refreshData = async () => {
    try {
      const [sumRes, recentRes] = await Promise.all([
        api.get("/usage/summary"),
        api.get("/usage/recent?limit=200"),
      ]);

      if (sumRes.data.subscription_status === "EXPIRED") {
        setSummary(null);
        setSummaryError("You have no active subscription.");
      } else {
        setSummary(sumRes.data);
        setSummaryError(null);
      }
      setRecentUsage(recentRes.data || []);
    } catch (err) {
      const detail = err?.response?.data?.detail;

      if (detail === "Subscription not found") {
        setSummary(null);
        setRecentUsage([]);
        setSummaryError("You have no active subscription.");
      } else {
        console.error("Failed to refresh data", err);
      }
    }
  };

  // ── Simulate an API call ────────────────────────────────────
  const recordUsage = async () => {
    try {
      await api.post("/api/request", null);

      await refreshData();

      showToast("API call simulated successfully!");
    } catch {
      showToast(
        "Failed to simulate API call.",
        "error"
      );
    }
  };

  // ── Buy / switch plan ───────────────────────────────────────
  const changePlan = async (planId) => {
    try {
      await api.post("/subscriptions/", null, {
        params: {
          plan_id: planId,
        },
      });

      await refreshData();

      showToast(
        summary
          ? "Plan switched successfully!"
          : "Plan purchased successfully!"
      );
    } catch (err) {
      console.error("Failed to purchase/switch plan:", err);

      showToast(
        err?.response?.data?.detail ||
        "Failed to purchase plan.",
        "error"
      );
    }
  };

  // ── Derived values ──────────────────────────────────────────
  const pct =
    summary && summary.plan_limit > 0
      ? (summary.total_usage / summary.plan_limit) * 100
      : 0;

  const cappedPct = Math.min(pct, 100);

  const isOver =
    summary && summary.overage > 0;

  const isWarning =
    !isOver && pct >= 80;

  const totalDue = summary
    ? Number(summary.monthly_price || 0) +
    Number(summary.overage_cost || 0)
    : 0;

  // ── Current plan ────────────────────────────────────────────
  const currentPlan = plans.find(
    (p) => p.name === summary?.plan
  );

  // ── Savings hint ────────────────────────────────────────────
  const getSavingsHint = (plan) => {
    if (!summary || !currentPlan) {
      return null;
    }

    if (plan.name === summary.plan) {
      return null;
    }

    const currentTotal =
      Number(currentPlan.monthly_price || 0) +
      summary.overage *
      Number(currentPlan.overage_price || 0);

    const altTotal =
      Number(plan.monthly_price || 0) +
      Math.max(
        summary.total_usage - plan.request_limit,
        0
      ) *
      Number(plan.overage_price || 0);

    const diff = currentTotal - altTotal;

    if (Math.abs(diff) < 0.01) {
      return null;
    }

    if (diff > 0) {
      return `Switching would save you ${fmt(diff)} this cycle`;
    }

    return `Switching would cost ${fmt(-diff)} more this cycle`;
  };

  // ── Usage record plan attribution ───────────────────────────
  const getRecordPlan = (record, allRecords) => {
    if (record.plan) {
      return record.plan;
    }

    if (summary?.billing_cycle?.cycle_start_datetime) {
      const cycleStart = new Date(summary.billing_cycle.cycle_start_datetime);
      const recordTime = new Date(record.created_at);
      if (recordTime >= cycleStart) {
        return summary.plan;
      }
    }

    // Fallback: newest summary.total_usage records belong to current plan
    if (summary?.total_usage != null && allRecords) {
      const idx = allRecords.findIndex((r) => r.id === record.id);
      if (idx >= 0 && idx < summary.total_usage) {
        return summary.plan;
      }
    }

    const otherPlan = plans.find((p) => p.name !== summary?.plan);
    return otherPlan?.name || "Starter";
  };

  // ── Filtered & Paginated Usage ──────────────────────────────
  const filteredUsage = useMemo(() => {
    return recentUsage.filter((record) => {
      if (!record.created_at) return true;
      const recordDate = new Date(record.created_at);

      if (startDateFilter) {
        const start = new Date(startDateFilter);
        start.setHours(0, 0, 0, 0);
        if (recordDate < start) return false;
      }

      if (endDateFilter) {
        const end = new Date(endDateFilter);
        end.setHours(23, 59, 59, 999);
        if (recordDate > end) return false;
      }

      return true;
    });
  }, [recentUsage, startDateFilter, endDateFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredUsage.length / PAGE_SIZE));
  const safeCurrentPage = Math.min(currentPage, totalPages);

  const paginatedUsage = useMemo(() => {
    const startIdx = (safeCurrentPage - 1) * PAGE_SIZE;
    return filteredUsage.slice(startIdx, startIdx + PAGE_SIZE);
  }, [filteredUsage, safeCurrentPage, PAGE_SIZE]);

  // ── Login ───────────────────────────────────────────────────
  const handleLogin = (loggedInUser) => {
    setUser(loggedInUser);
  };

  // ── Logout ──────────────────────────────────────────────────
  const handleLogout = () => {
    localStorage.removeItem("access_token");
    localStorage.removeItem("user");

    setUser(null);
  };

  // ── Email verification page ─────────────────────────────────
  const isVerifyEmailPage =
    window.location.pathname === "/verify-email";

  if (isVerifyEmailPage) {
    return (
      <VerifyEmail
        onVerified={() => {
          window.location.href = "/";
        }}
      />
    );
  }

  // ── Login / Signup ──────────────────────────────────────────
  if (!user) {
    if (showSignup) {
      return (
        <Signup
          onSignup={() => setShowSignup(false)}
        />
      );
    }

    return (
      <Login
        onLogin={handleLogin}
        onSignup={() => setShowSignup(true)}
      />
    );
  }

  // ── Admin dashboard ─────────────────────────────────────────
  if (user.role === "ADMIN") {
    return (
      <AdminDashboard
        user={user}
        onLogout={handleLogout}
      />
    );
  }

  // ── Customer dashboard ──────────────────────────────────────
  return (
    <div className="dashboard">

      {/* ── Toast ── */}
      {toast && (
        <div
          className={`toast toast-${toast.type}`}
          role="alert"
        >
          {toast.type === "success" ? "✓" : "✕"}{" "}
          {toast.text}
        </div>
      )}

      {/* ── Header ── */}
      <header className="dashboard-header">
        <div className="header-title">
          <h1>SaaS Billing Dashboard</h1>

          <p className="header-subtitle">
            Usage and subscription overview
          </p>
        </div>

        <div className="tenant-selector">
          <p>
            {user.email} ({user.role})
          </p>

          <button onClick={handleLogout}>
            Logout
          </button>
        </div>
      </header>

      {/* ── Loading ── */}
      {loading && (
        <div className="status-banner">
          ⏳ Loading customer data...
        </div>
      )}

      {/* ── No active subscription ── */}
      {summaryError ===
        "You have no active subscription." &&
        !loading && (
          <div
            className="status-banner status-error"
            role="alert"
          >
            ⚠️ You have no active subscription.
          </div>
        )}

      {/* ── Other errors ── */}
      {summaryError &&
        summaryError !==
        "You have no active subscription." &&
        !loading && (
          <div
            className="status-banner status-error"
            role="alert"
          >
            ⚠️ {summaryError}
          </div>
        )}

      {/* ====================================================== */}
      {/* NORMAL CUSTOMER DASHBOARD                              */}
      {/* ====================================================== */}

      {summary && !loading && (
        <>
          {/* ── Warning / Alert State ── */}
          {isOver && (
            <div
              className="alert-banner alert-danger"
              role="alert"
            >
              <span className="alert-icon">
                ⚠️
              </span>

              <div>
                <strong>
                  Limit Exceeded:{" "}
                </strong>

                <span>
                  You've exceeded your plan by{" "}
                  {summary.overage} request
                  {summary.overage !== 1 ? "s" : ""}.
                  Additional overage charges apply.
                </span>
              </div>
            </div>
          )}

          {isWarning && (
            <div
              className="alert-banner alert-warning"
              role="alert"
            >
              <span className="alert-icon">
                ⚠️
              </span>

              <div>
                <strong>
                  Approaching plan limit:{" "}
                </strong>

                <span>
                  You have used{" "}
                  {Math.round(pct)}% of your plan
                  limit. Only{" "}
                  {summary.remaining_usage} request
                  {summary.remaining_usage !== 1
                    ? "s"
                    : ""}{" "}
                  remaining.
                </span>
              </div>
            </div>
          )}

          {/* ── Usage Hero Card ── */}
          <section
            className={`hero-card ${isOver
              ? "hero-over"
              : isWarning
                ? "hero-warn"
                : ""
              }`}
          >
            <div className="hero-top">
              <div className="hero-left">
                <span className="hero-label">
                  CURRENT USAGE
                </span>

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
                    /{" "}
                    {summary.plan_limit.toLocaleString()}{" "}
                    requests
                  </span>
                </div>

                <div className="hero-sub">
                  {isOver
                    ? `${summary.overage} requests over the limit`
                    : `${summary.remaining_usage.toLocaleString()} requests remaining`}
                </div>
              </div>

              {/* ── Billing Period ── */}
              {summary.billing_cycle && (
                <div className="billing-period-card">
                  <span className="bp-label">
                    Current Cycle
                  </span>

                  <span className="bp-dates">
                    {formatDate(
                      summary.billing_cycle.start_date
                    )}{" "}
                    –{" "}
                    {formatDate(
                      summary.billing_cycle.end_date
                    )}
                  </span>

                  <span className="bp-reset">
                    Resets in{" "}
                    <strong>
                      {
                        summary.billing_cycle
                          .days_remaining
                      }
                    </strong>{" "}
                    day
                    {summary.billing_cycle
                      .days_remaining !== 1
                      ? "s"
                      : ""}
                  </span>
                </div>
              )}
            </div>

            {/* ── Progress Bar ── */}
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
                    backgroundColor:
                      progressColor(pct),
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
                  <span>
                    | 100% Limit Reached
                  </span>

                  <span className="text-red font-semibold">
                    +{summary.overage} Overage (
                    {Math.round(pct)}%)
                  </span>
                </div>
              )}
            </div>

            {/* ── Simulate API Call ── */}
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

          {/* ── Metrics Grid ── */}
          <div className="summary-grid">

            <div className="card">
              <span>Current Plan</span>
              <strong>{summary.plan}</strong>
            </div>

            <div className="card">
              <span>Monthly Base Price</span>
              <strong>
                {fmt(summary.monthly_price)}
              </strong>
            </div>

            <div className="card">
              <span>Remaining Usage</span>
              <strong>
                {summary.remaining_usage}
              </strong>
            </div>

            <div
              className={`card ${isOver ? "card-danger" : ""
                }`}
            >
              <span>Overage Requests</span>

              <strong
                className={
                  isOver ? "text-red" : ""
                }
              >
                {summary.overage}
              </strong>
            </div>

            <div
              className={`card ${isOver ? "card-danger" : ""
                }`}
            >
              <span>Overage Rate</span>

              <strong>
                {fmt(
                  currentPlan?.overage_price || 0
                )}{" "}
                / req
              </strong>
            </div>

            <div
              className={`card ${isOver ? "card-danger" : ""
                }`}
            >
              <span>Overage Cost</span>

              <strong
                className={
                  isOver ? "text-red" : ""
                }
              >
                {fmt(summary.overage_cost)}
              </strong>
            </div>
          </div>

          {/* ── Estimated Invoice ── */}
          <section className="cost-summary-card">
            <div className="cost-summary-header">
              <div>
                <h2>Estimated Invoice</h2>

                <p className="section-subtitle">
                  Current billing cycle breakdown
                  (base subscription + overage fees)
                </p>
              </div>

              <span className="invoice-badge">
                Current Cycle
              </span>
            </div>

            <div className="cost-breakdown-list">

              <div className="cost-breakdown-item">
                <span className="cost-item-name">
                  Base Plan:{" "}
                  <strong>{summary.plan}</strong>
                </span>

                <span className="cost-item-price">
                  {fmt(summary.monthly_price)}
                </span>
              </div>

              <div
                className={`cost-breakdown-item ${isOver
                  ? "cost-breakdown-overage"
                  : ""
                  }`}
              >
                <span className="cost-item-name">
                  Overage Charges (
                  {summary.overage} requests ×{" "}
                  {fmt(
                    currentPlan?.overage_price || 0
                  )}
                  )
                </span>

                <span
                  className={`cost-item-price ${isOver ? "text-red" : ""
                    }`}
                >
                  {fmt(summary.overage_cost)}
                </span>
              </div>

              <div className="cost-breakdown-total">
                <span className="total-label">
                  Total Estimated Due
                </span>

                <span className="total-price">
                  {fmt(totalDue)}
                </span>
              </div>

            </div>
          </section>

          {/* ── Usage History ── */}
          <section className="history-section">
            <div className="history-header">
              <div>
                <h2>Usage History</h2>
                <p className="section-subtitle">
                  Recent API activity and event logs with plan & cycle attribution
                </p>
              </div>

              <span className="history-count">
                {filteredUsage.length} event
                {filteredUsage.length !== 1 ? "s" : ""}
              </span>
            </div>

            {/* Date Filters & Controls */}
            <div className="history-controls-bar">
              <div className="history-date-filters">
                <div className="history-filter-field">
                  <label htmlFor="filter-from-date">From</label>
                  <input
                    id="filter-from-date"
                    type="date"
                    className="history-date-input"
                    value={startDateFilter}
                    onChange={handleStartDateChange}
                  />
                </div>

                <div className="history-filter-field">
                  <label htmlFor="filter-to-date">To</label>
                  <input
                    id="filter-to-date"
                    type="date"
                    className="history-date-input"
                    value={endDateFilter}
                    onChange={handleEndDateChange}
                  />
                </div>

                {(startDateFilter || endDateFilter) && (
                  <button
                    type="button"
                    className="history-reset-btn"
                    onClick={handleResetFilters}
                    title="Reset date filters"
                  >
                    Reset Filter
                  </button>
                )}
              </div>

              <div className="history-summary-tag">
                {filteredUsage.length > 0 && (
                  <span>
                    Showing {Math.min((safeCurrentPage - 1) * PAGE_SIZE + 1, filteredUsage.length)}–
                    {Math.min(safeCurrentPage * PAGE_SIZE, filteredUsage.length)} of {filteredUsage.length}
                  </span>
                )}
              </div>
            </div>

            {filteredUsage.length === 0 ? (
              <p className="empty-history">
                {recentUsage.length === 0
                  ? "No recorded API calls yet for this customer."
                  : "No usage records found matching the selected date range."}
              </p>
            ) : (
              <>
                <div className="history-table-container">
                  <table className="history-table">
                    <thead>
                      <tr>
                        <th>Record ID</th>
                        <th>Event Type</th>
                        <th>Plan</th>
                        <th>Timestamp</th>
                        <th>Status</th>
                      </tr>
                    </thead>

                    <tbody>
                      {paginatedUsage.map((record) => {
                        const recordPlan = getRecordPlan(record, recentUsage);
                        const isCurrent = recordPlan === summary?.plan;

                        return (
                          <tr key={record.id}>
                            <td className="id-cell">
                              #{record.id}
                            </td>

                            <td>
                              <span className="badge-event-type">
                                {record.usage_type}
                              </span>
                            </td>

                            <td>
                              <span
                                className={`badge-plan ${
                                  isCurrent ? "badge-plan-current" : "badge-plan-previous"
                                }`}
                                title={isCurrent ? "Current active plan" : "Previous plan / cycle"}
                              >
                                {recordPlan}
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
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Pagination Controls */}
                {totalPages > 1 && (
                  <div className="history-pagination">
                    <button
                      type="button"
                      className="pagination-btn"
                      disabled={safeCurrentPage <= 1}
                      onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    >
                      ← Previous
                    </button>

                    <span className="pagination-info">
                      Page <strong>{safeCurrentPage}</strong> of <strong>{totalPages}</strong>
                    </span>

                    <button
                      type="button"
                      className="pagination-btn"
                      disabled={safeCurrentPage >= totalPages}
                      onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    >
                      Next →
                    </button>
                  </div>
                )}
              </>
            )}
          </section>
        </>
      )}

      {/* ====================================================== */}
      {/* PLANS SECTION                                          */}
      {/* ====================================================== */}

      {!loading && (
        <section className="plans-section">

          <h2>
            {summary
              ? "Available Plans"
              : "Choose a Plan"}
          </h2>

          <p className="section-subtitle">
            {summary
              ? "Compare plans and easily upgrade or switch"
              : "Choose a subscription plan to start using the platform"}
          </p>

          <div className="plans-grid">

            {plans.map((plan) => {
              const isActive =
                summary &&
                plan.name === summary.plan;

              const isPro =
                plan.name
                  .toLowerCase()
                  .includes("pro");

              const hint =
                getSavingsHint(plan);

              return (
                <div
                  className={`plan-card ${isActive
                    ? "active-plan"
                    : ""
                    } ${isPro
                      ? "recommended-plan-card"
                      : ""
                    }`}
                  key={plan.id}
                >

                  {/* Recommended badge */}
                  {isPro && (
                    <div className="recommended-badge">
                      Recommended
                    </div>
                  )}

                  <div className="plan-header">
                    <h3>{plan.name}</h3>

                    {isActive && (
                      <span className="current-badge">
                        Active
                      </span>
                    )}
                  </div>

                  <div className="plan-pricing-row">
                    <span className="plan-price-val">
                      {fmt(plan.monthly_price)}
                    </span>

                    <span className="plan-price-period">
                      / month
                    </span>
                  </div>

                  <div className="plan-features">
                    <p className="limit">
                      <strong>
                        {plan.request_limit.toLocaleString()}
                      </strong>{" "}
                      requests included
                    </p>

                    <p className="plan-overage-text">
                      {fmt(plan.overage_price)} per
                      extra request
                    </p>
                  </div>

                  {/* Savings hint only when customer already has a plan */}
                  {hint && (
                    <div
                      className={`savings-hint ${hint.includes("save")
                        ? "savings-hint-positive"
                        : "savings-hint-neutral"
                        }`}
                    >
                      💡 {hint}
                    </div>
                  )}

                  <button
                    className="plan-switch-btn"
                    onClick={() =>
                      changePlan(plan.id)
                    }
                    disabled={isActive}
                  >
                    {isActive
                      ? "Current Plan"
                      : summary
                        ? `Switch to ${plan.name}`
                        : `Buy ${plan.name}`}
                  </button>

                </div>
              );
            })}

          </div>
        </section>
      )}

    </div>
  );
}

export default App;