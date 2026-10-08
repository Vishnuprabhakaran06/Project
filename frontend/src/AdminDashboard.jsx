import { useEffect, useState, useMemo } from "react";
import api from "./api";
import "./AdminDashboard.css";

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

function AdminDashboard({ user, onLogout }) {
    const [tenants, setTenants] = useState([]);
    const [subscriptions, setSubscriptions] = useState([]);
    const [usageSummaries, setUsageSummaries] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [searchQuery, setSearchQuery] = useState("");
    const [statusFilter, setStatusFilter] = useState("ALL");

    useEffect(() => {
        const loadData = async () => {
            setLoading(true);
            setError("");
            try {
                const [tenantResponse, subscriptionResponse, usageResponse] =
                    await Promise.all([
                        api.get("/tenants/"),
                        api.get("/subscriptions/admin"),
                        api.get("/usage/admin/summary"),
                    ]);
                setTenants(tenantResponse.data || []);
                setSubscriptions(subscriptionResponse.data || []);
                setUsageSummaries(usageResponse.data || []);
            } catch (err) {
                console.error("Failed to load admin data", err);
                setError(err?.response?.data?.detail || "Failed to load admin data.");
            } finally {
                setLoading(false);
            }
        };
        loadData();
    }, []);

    // ── KPI Summary Calculations ─────────────────────────────────
    const activeSubsCount = useMemo(() => {
        return subscriptions.filter((s) => s.status === "ACTIVE").length;
    }, [subscriptions]);

    const totalMRR = useMemo(() => {
        return subscriptions
            .filter((s) => s.status === "ACTIVE")
            .reduce((sum, s) => sum + Number(s.monthly_price || 0), 0);
    }, [subscriptions]);

    const totalOverage = useMemo(() => {
        return usageSummaries.reduce(
            (sum, u) => sum + Number(u.overage_cost || 0),
            0
        );
    }, [usageSummaries]);

    // ── Combined & Filtered Tenants ──────────────────────────────
    const filteredTenants = useMemo(() => {
        return tenants.filter((tenant) => {
            const sub = subscriptions.find((item) => item.tenant_id === tenant.id);

            // Search match
            const query = searchQuery.toLowerCase().trim();
            const matchesSearch =
                !query ||
                (tenant.name || "").toLowerCase().includes(query) ||
                String(tenant.id).includes(query);


            if (!matchesSearch) return false;

            // Status filter
            if (statusFilter === "ALL") return true;
            if (statusFilter === "ACTIVE") return sub?.status === "ACTIVE";
            if (statusFilter === "EXPIRED") return sub?.status === "EXPIRED";
            if (statusFilter === "NO_SUB") return !sub;

            return true;
        });
    }, [tenants, subscriptions, searchQuery, statusFilter]);

    return (
        <div className="admin-dashboard">
            {/* ── Header ── */}
            <header className="dashboard-header">
                <div className="header-title">
                    <h1>Admin Dashboard</h1>
                    <p className="header-subtitle">
                        Manage customers, subscriptions, and usage analytics
                    </p>
                </div>

                <div className="admin-user-bar">
                    <div className="admin-user-badge">
                        <span className="admin-avatar">AD</span>
                        <div className="admin-user-details">
                            <span>{user?.email}</span>
                            <span className="admin-role-badge">{user?.role}</span>
                        </div>
                    </div>

                    <button className="admin-logout-btn" onClick={onLogout}>
                        Logout
                    </button>
                </div>
            </header>

            {/* ── Error Banner ── */}
            {error && (
                <div className="admin-alert-banner" role="alert">
                    <span>⚠️</span>
                    <span>{error}</span>
                </div>
            )}

            {/* ── KPI Stats Grid ── */}
            <section className="admin-stats-grid">
                <div className="admin-stat-card">
                    <div className="admin-stat-header">
                        <span className="admin-stat-label">Total Customers</span>
                        <span className="admin-stat-icon">👥</span>
                    </div>
                    <div className="admin-stat-value">{tenants.length}</div>
                    <div className="admin-stat-subtext">Registered organizations</div>
                </div>

                <div className="admin-stat-card">
                    <div className="admin-stat-header">
                        <span className="admin-stat-label">Active Subscriptions</span>
                        <span className="admin-stat-icon">⚡</span>
                    </div>
                    <div className="admin-stat-value">{activeSubsCount}</div>
                    <div className="admin-stat-subtext">Current recurring plans</div>
                </div>

                <div className="admin-stat-card">
                    <div className="admin-stat-header">
                        <span className="admin-stat-label">Monthly MRR</span>
                        <span className="admin-stat-icon">💳</span>
                    </div>
                    <div className="admin-stat-value">{fmt(totalMRR)}</div>
                    <div className="admin-stat-subtext">Base recurring billing</div>
                </div>

                <div className="admin-stat-card">
                    <div className="admin-stat-header">
                        <span className="admin-stat-label">Total Overages</span>
                        <span className="admin-stat-icon">📈</span>
                    </div>
                    <div className="admin-stat-value">{fmt(totalOverage)}</div>
                    <div className="admin-stat-subtext">Accumulated extra charges</div>
                </div>
            </section>

            {/* ── Main Content Section ── */}
            <main className="admin-main-card">
                <div className="admin-card-header">
                    <div className="admin-card-title-group">
                        <h2>Customers</h2>
                        <span className="admin-count-badge">
                            {filteredTenants.length} {filteredTenants.length === 1 ? "customer" : "customers"}
                        </span>
                    </div>

                    <div className="admin-filters-bar">
                        <div className="admin-search-box">
                            <span className="admin-search-icon">🔍</span>
                            <input
                                type="text"
                                className="admin-search-input"
                                placeholder="Search by name or ID..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                        </div>

                        <select
                            className="admin-filter-select"
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value)}
                        >
                            <option value="ALL">All Statuses</option>
                            <option value="ACTIVE">Active</option>
                            <option value="EXPIRED">Expired</option>
                            <option value="NO_SUB">No Subscription</option>
                        </select>
                    </div>
                </div>

                {/* Loading */}
                {loading && (
                    <div className="admin-loading-state">
                        <p>⏳ Loading customers and usage records...</p>
                    </div>
                )}

                {/* Table */}
                {!loading && !error && (
                    <div className="admin-table-container">
                        {filteredTenants.length === 0 ? (
                            <div className="admin-empty-state">
                                <div className="admin-empty-icon">📂</div>
                                <p>No customers found matching your search or filters.</p>
                            </div>
                        ) : (
                            <table className="admin-table">
                                <thead>
                                    <tr>
                                        <th>Customer</th>
                                        <th>Tenant ID</th>
                                        <th>Plan</th>
                                        <th>Monthly Price</th>
                                        <th>Usage</th>
                                        <th>Limit</th>
                                        <th>Remaining</th>
                                        <th>Overage</th>
                                        <th>Overage Cost</th>
                                        <th>Start Date</th>
                                        <th>End Date</th>
                                        <th>Status</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredTenants.map((tenant) => {
                                        const subscription = subscriptions.find(
                                            (item) => item.tenant_id === tenant.id
                                        );
                                        const usage = usageSummaries.find(
                                            (item) => item.tenant_id === tenant.id
                                        );
                                        const isOver = usage && usage.overage > 0;

                                        return (
                                            <tr key={tenant.id}>
                                                {/* Customer */}
                                                <td className="col-customer">{tenant.name}</td>

                                                {/* Tenant ID */}
                                                <td>
                                                    <span className="col-tenant-id">{tenant.id}</span>
                                                </td>

                                                {/* Plan */}
                                                <td>
                                                    <span
                                                        className={`col-plan-badge ${subscription ? "" : "col-plan-none"
                                                            }`}
                                                    >
                                                        {subscription ? subscription.plan : "None"}
                                                    </span>
                                                </td>

                                                {/* Monthly Price */}
                                                <td className="col-price">
                                                    {subscription
                                                        ? fmt(subscription.monthly_price)
                                                        : "-"}
                                                </td>

                                                {/* Usage */}
                                                <td>{usage ? usage.total_usage : "-"}</td>

                                                {/* Limit */}
                                                <td>{usage ? usage.plan_limit : "-"}</td>

                                                {/* Remaining */}
                                                <td>{usage ? usage.remaining_usage : "-"}</td>

                                                {/* Overage */}
                                                <td className={isOver ? "col-overage-active" : ""}>
                                                    {usage ? usage.overage : "-"}
                                                </td>

                                                {/* Overage Cost */}
                                                <td
                                                    className={`col-price ${isOver ? "col-overage-active" : ""
                                                        }`}
                                                >
                                                    {usage ? fmt(usage.overage_cost) : "-"}
                                                </td>

                                                {/* Start Date */}
                                                <td>
                                                    {subscription
                                                        ? formatDate(subscription.start_date)
                                                        : "-"}
                                                </td>

                                                {/* End Date */}
                                                <td>
                                                    {subscription
                                                        ? formatDate(subscription.end_date)
                                                        : "-"}
                                                </td>

                                                {/* Status */}
                                                <td>
                                                    {subscription ? (
                                                        <span
                                                            className={`admin-status-badge ${subscription.status === "ACTIVE"
                                                                    ? "admin-status-active"
                                                                    : "admin-status-expired"
                                                                }`}
                                                        >
                                                            {subscription.status}
                                                        </span>
                                                    ) : (
                                                        <span className="admin-status-badge admin-status-none">
                                                            No Plan
                                                        </span>
                                                    )}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        )}
                    </div>
                )}
            </main>
        </div>
    );
}

export default AdminDashboard;
