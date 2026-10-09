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

function formatDateTime(isoStr) {
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

function AdminDashboard({ user, onLogout }) {
    const [tenants, setTenants] = useState([]);
    const [subscriptions, setSubscriptions] = useState([]);
    const [usageSummaries, setUsageSummaries] = useState([]);
    const [messages, setMessages] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    // View switch: "CUSTOMERS" (default Customer Flow) or "MESSAGES"
    const [activeView, setActiveView] = useState("CUSTOMERS");

    // Filters
    const [searchQuery, setSearchQuery] = useState("");
    const [statusFilter, setStatusFilter] = useState("ALL");
    const [selectedCustomerFilter, setSelectedCustomerFilter] = useState("ALL");

    // Pagination (20 items per page)
    const PAGE_SIZE = 20;
    const [customerPage, setCustomerPage] = useState(1);
    const [messagePage, setMessagePage] = useState(1);

    const loadData = async () => {
        setLoading(true);
        setError("");
        try {
            const [tenantResponse, subscriptionResponse, usageResponse, messagesResponse] =
                await Promise.all([
                    api.get("/tenants/"),
                    api.get("/subscriptions/admin"),
                    api.get("/usage/admin/summary"),
                    api.get("/api/admin/messages"),
                ]);
            setTenants(tenantResponse.data || []);
            setSubscriptions(subscriptionResponse.data || []);
            setUsageSummaries(usageResponse.data || []);
            setMessages(messagesResponse.data || []);
        } catch (err) {
            console.error("Failed to load admin data", err);
            setError(err?.response?.data?.detail || "Failed to load admin data.");
        } finally {
            setLoading(false);
        }
    };
    useEffect(() => {
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

    // Message counts grouped by tenant_id
    const messageCountsByTenant = useMemo(() => {
        const counts = {};
        for (const msg of messages) {
            counts[msg.tenant_id] = (counts[msg.tenant_id] || 0) + 1;
        }
        return counts;
    }, [messages]);

    // ── Combined & Filtered Tenants (Customer Flow) ─────────────
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

    // Customer Pagination
    const customerTotalPages = Math.max(1, Math.ceil(filteredTenants.length / PAGE_SIZE));
    const safeCustomerPage = Math.min(customerPage, customerTotalPages);
    const paginatedTenants = useMemo(() => {
        const startIdx = (safeCustomerPage - 1) * PAGE_SIZE;
        return filteredTenants.slice(startIdx, startIdx + PAGE_SIZE);
    }, [filteredTenants, safeCustomerPage, PAGE_SIZE]);

    // ── Filtered Messages ───────────────────────────────────────
    const filteredMessages = useMemo(() => {
        return messages.filter((msg) => {
            // Customer dropdown filter
            if (selectedCustomerFilter !== "ALL") {
                if (String(msg.tenant_id) !== String(selectedCustomerFilter)) {
                    return false;
                }
            }

            // Search query match
            const query = searchQuery.toLowerCase().trim();
            if (!query) return true;

            const name = (msg.customer_name || "").toLowerCase();
            const content = (msg.message || "").toLowerCase();
            const idMatch =
                String(msg.id).includes(query) ||
                String(msg.tenant_id).includes(query);

            return name.includes(query) || content.includes(query) || idMatch;
        });
    }, [messages, selectedCustomerFilter, searchQuery]);

    // Messages Pagination
    const messageTotalPages = Math.max(1, Math.ceil(filteredMessages.length / PAGE_SIZE));
    const safeMessagePage = Math.min(messagePage, messageTotalPages);
    const paginatedMessages = useMemo(() => {
        const startIdx = (safeMessagePage - 1) * PAGE_SIZE;
        return filteredMessages.slice(startIdx, startIdx + PAGE_SIZE);
    }, [filteredMessages, safeMessagePage, PAGE_SIZE]);

    const handleSwitchToCustomerMessages = (tenantId) => {
        setSelectedCustomerFilter(String(tenantId));
        setSearchQuery("");
        setMessagePage(1);
        setActiveView("MESSAGES");
    };

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
                        <span className="admin-stat-label">Total Messages</span>
                        <span className="admin-stat-icon">💬</span>
                    </div>
                    <div className="admin-stat-value">{messages.length}</div>
                    <div className="admin-stat-subtext">Customer Messages</div>
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
                    <div className="admin-header-tabs-group">
                        {/* Switcher: Customer Flow (Default) vs Messages */}
                        <div className="admin-view-toggle">
                            <button
                                type="button"
                                className={`admin-view-btn ${activeView === "CUSTOMERS" ? "active" : ""}`}
                                onClick={() => {
                                    setActiveView("CUSTOMERS");
                                    setSearchQuery("");
                                    setCustomerPage(1);
                                }}
                            >
                                <span className="view-btn-icon">👥</span>
                                <span>Customer Flow</span>
                                <span className="admin-tab-count-badge">
                                    {filteredTenants.length}
                                </span>
                            </button>

                            <button
                                type="button"
                                className={`admin-view-btn ${activeView === "MESSAGES" ? "active" : ""}`}
                                onClick={() => {
                                    setActiveView("MESSAGES");
                                    setSearchQuery("");
                                    setMessagePage(1);
                                }}
                            >
                                <span className="view-btn-icon">💬</span>
                                <span>Messages</span>
                                <span className="admin-tab-count-badge">
                                    {messages.length}
                                </span>
                            </button>
                        </div>
                    </div>

                    <div className="admin-filters-bar">
                        {activeView === "CUSTOMERS" ? (
                            <>
                                <div className="admin-search-box">
                                    <span className="admin-search-icon">🔍</span>
                                    <input
                                        type="text"
                                        className="admin-search-input"
                                        placeholder="Search by name or ID..."
                                        value={searchQuery}
                                        onChange={(e) => {
                                            setSearchQuery(e.target.value);
                                            setCustomerPage(1);
                                        }}
                                    />
                                </div>

                                <select
                                    className="admin-filter-select"
                                    value={statusFilter}
                                    onChange={(e) => {
                                        setStatusFilter(e.target.value);
                                        setCustomerPage(1);
                                    }}
                                >
                                    <option value="ALL">All Statuses</option>
                                    <option value="ACTIVE">Active</option>
                                    <option value="EXPIRED">Expired</option>
                                    <option value="NO_SUB">No Subscription</option>
                                </select>
                            </>
                        ) : (
                            <>
                                <div className="admin-search-box">
                                    <span className="admin-search-icon">🔍</span>
                                    <input
                                        type="text"
                                        className="admin-search-input"
                                        placeholder="Search message text, customer..."
                                        value={searchQuery}
                                        onChange={(e) => {
                                            setSearchQuery(e.target.value);
                                            setMessagePage(1);
                                        }}
                                    />
                                </div>

                                <select
                                    className="admin-filter-select"
                                    value={selectedCustomerFilter}
                                    onChange={(e) => {
                                        setSelectedCustomerFilter(e.target.value);
                                        setMessagePage(1);
                                    }}
                                >
                                    <option value="ALL">All Customers</option>
                                    {tenants.map((t) => (
                                        <option key={t.id} value={t.id}>
                                            {t.name} ({messageCountsByTenant[t.id] || 0} msgs)
                                        </option>
                                    ))}
                                </select>

                                <button
                                    type="button"
                                    className="admin-refresh-button"
                                    onClick={loadData}
                                    title="Refresh messages"
                                >
                                    ↻ 
                                </button>
                            </>
                        )}
                    </div>
                </div>

                {/* Loading */}
                {loading && (
                    <div className="admin-loading-state">
                        <p>⏳ Loading data...</p>
                    </div>
                )}

                {/* ── CUSTOMER FLOW TABLE (DEFAULT) ── */}
                {!loading && !error && activeView === "CUSTOMERS" && (
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
                                        <th>Messages</th>
                                        <th>Start Date</th>
                                        <th>End Date</th>
                                        <th>Status</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {paginatedTenants.map((tenant) => {
                                        const subscription = subscriptions.find(
                                            (item) => item.tenant_id === tenant.id
                                        );
                                        const usage = usageSummaries.find(
                                            (item) => item.tenant_id === tenant.id
                                        );
                                        const isOver = usage && usage.overage > 0;
                                        const msgCount = messageCountsByTenant[tenant.id] || 0;

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
                                                        className={`col-plan-badge ${
                                                            subscription ? "" : "col-plan-none"
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
                                                    className={`col-price ${
                                                        isOver ? "col-overage-active" : ""
                                                    }`}
                                                >
                                                    {usage ? fmt(usage.overage_cost) : "-"}
                                                </td>

                                                {/* Messages column */}
                                                <td>
                                                    <button
                                                        type="button"
                                                        className={`col-msg-count-btn ${
                                                            msgCount > 0 ? "has-messages" : ""
                                                        }`}
                                                        title={`Switch to messages for ${tenant.name}`}
                                                        onClick={() =>
                                                            handleSwitchToCustomerMessages(tenant.id)
                                                        }
                                                    >
                                                        💬 {msgCount} {msgCount === 1 ? "msg" : "msgs"}
                                                    </button>
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
                                                            className={`admin-status-badge ${
                                                                subscription.status === "ACTIVE"
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

                        {/* Customers Pagination Bar */}
                        {filteredTenants.length > 0 && (
                            <div className="admin-pagination-container">
                                <span className="admin-pagination-info">
                                    Showing {Math.min((safeCustomerPage - 1) * PAGE_SIZE + 1, filteredTenants.length)}–
                                    {Math.min(safeCustomerPage * PAGE_SIZE, filteredTenants.length)} of {filteredTenants.length} customers
                                </span>

                                {customerTotalPages > 1 && (
                                    <div className="admin-pagination-controls">
                                        <button
                                            type="button"
                                            className="admin-pagination-btn"
                                            disabled={safeCustomerPage <= 1}
                                            onClick={() => setCustomerPage((p) => Math.max(1, p - 1))}
                                        >
                                            ← Previous
                                        </button>

                                        <span className="admin-pagination-pages">
                                            Page <strong>{safeCustomerPage}</strong> of <strong>{customerTotalPages}</strong>
                                        </span>

                                        <button
                                            type="button"
                                            className="admin-pagination-btn"
                                            disabled={safeCustomerPage >= customerTotalPages}
                                            onClick={() => setCustomerPage((p) => Math.min(customerTotalPages, p + 1))}
                                        >
                                            Next →
                                        </button>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )}

                {/* ── CUSTOMER MESSAGES TABLE (SWITCHED VIEW) ── */}
                {!loading && !error && activeView === "MESSAGES" && (
                    <div className="admin-messages-view">
                        {selectedCustomerFilter !== "ALL" && (
                            <div className="admin-filter-pill-bar">
                                <span>
                                    Filtered by:{" "}
                                    <strong>
                                        {tenants.find(
                                            (t) => String(t.id) === String(selectedCustomerFilter)
                                        )?.name || `Tenant #${selectedCustomerFilter}`}
                                    </strong>
                                </span>
                                <button
                                    type="button"
                                    className="admin-clear-filter-btn"
                                    onClick={() => {
                                        setSelectedCustomerFilter("ALL");
                                        setMessagePage(1);
                                    }}
                                >
                                    ✕ Show all customer messages
                                </button>
                            </div>
                        )}

                        <div className="admin-table-container">
                            {filteredMessages.length === 0 ? (
                                <div className="admin-empty-state">
                                    <div className="admin-empty-icon">💬</div>
                                    <p>No customer messages found matching your criteria.</p>
                                </div>
                            ) : (
                                <table className="admin-table">
                                    <thead>
                                        <tr>
                                            <th style={{ width: "220px" }}>Customer Name</th>
                                            <th>Customer Messages</th>
                                            <th style={{ width: "200px" }}>Message Time</th>
                                            <th style={{ width: "110px" }}>Tenant ID</th>
                                            <th style={{ width: "100px" }}>ID</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {paginatedMessages.map((item) => (
                                            <tr key={item.id}>
                                                {/* Customer Name */}
                                                <td className="col-customer">
                                                    <div className="col-customer-cell">
                                                        <span className="customer-avatar-badge">
                                                            {(item.customer_name || "C")
                                                                .charAt(0)
                                                                .toUpperCase()}
                                                        </span>
                                                        <span className="customer-name-text">
                                                            {item.customer_name}
                                                        </span>
                                                    </div>
                                                </td>

                                                {/* Customer Messages */}
                                                <td className="col-message-content">
                                                    <div className="message-text-bubble">
                                                        {item.message}
                                                    </div>
                                                </td>

                                                {/* Message Time */}
                                                <td className="col-message-time">
                                                    <span className="time-badge">
                                                        🕒 {formatDateTime(item.created_at)}
                                                    </span>
                                                </td>

                                                {/* Tenant ID */}
                                                <td>
                                                    <span className="col-tenant-id">
                                                        #{item.tenant_id}
                                                    </span>
                                                </td>

                                                {/* Message ID */}
                                                <td>
                                                    <span className="col-msg-id">
                                                        #{item.id}
                                                    </span>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}
                        </div>

                        {/* Messages Pagination Bar */}
                        {filteredMessages.length > 0 && (
                            <div className="admin-pagination-container">
                                <span className="admin-pagination-info">
                                    Showing {Math.min((safeMessagePage - 1) * PAGE_SIZE + 1, filteredMessages.length)}–
                                    {Math.min(safeMessagePage * PAGE_SIZE, filteredMessages.length)} of {filteredMessages.length} messages
                                </span>

                                {messageTotalPages > 1 && (
                                    <div className="admin-pagination-controls">
                                        <button
                                            type="button"
                                            className="admin-pagination-btn"
                                            disabled={safeMessagePage <= 1}
                                            onClick={() => setMessagePage((p) => Math.max(1, p - 1))}
                                        >
                                            ← Previous
                                        </button>

                                        <span className="admin-pagination-pages">
                                            Page <strong>{safeMessagePage}</strong> of <strong>{messageTotalPages}</strong>
                                        </span>

                                        <button
                                            type="button"
                                            className="admin-pagination-btn"
                                            disabled={safeMessagePage >= messageTotalPages}
                                            onClick={() => setMessagePage((p) => Math.min(messageTotalPages, p + 1))}
                                        >
                                            Next →
                                        </button>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )}
            </main>
        </div>
    );
}

export default AdminDashboard;
