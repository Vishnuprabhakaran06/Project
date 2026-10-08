import { useEffect, useState } from "react";
import api from "./api";
import "./AdminDashboard.css";
function AdminDashboard({ user, onLogout }) {
    const [tenants, setTenants] = useState([]);
    const [subscriptions, setSubscriptions] = useState([]);
    const [usageSummaries, setUsageSummaries] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    useEffect(() => {
        const loadData = async () => {
            try {
                const [tenantResponse, subscriptionResponse, usageResponse] =
                    await Promise.all([
                        api.get("/tenants/"),
                        api.get("/subscriptions/admin"),
                        api.get("/usage/admin/summary"),
                    ]);
                setTenants(tenantResponse.data);
                setSubscriptions(subscriptionResponse.data);
                setUsageSummaries(usageResponse.data);
            } catch (err) {
                console.error("Failed to load admin data", err);
                setError(err?.response?.data?.detail || "Failed to load admin data.");
            } finally {
                setLoading(false);
            }
        };
        loadData();
    }, []);
    return (
        <div className="admin-dashboard">
              
            {/* ========================= Header ========================== */}  
            <header className="dashboard-header">
                  
                <div className="header-title">
                      
                    <h1>Admin Dashboard</h1>  
                    <p className="header-subtitle">
                          
                        Manage customers, subscriptions and usage  
                    </p>  
                </div>  
                <div className="admin-user">
                      
                    <div className="admin-user-info">
                          
                        <p>{user.email}</p> <p className="admin-role"> {user.role} </p>  
                    </div>  
                    <button className="logout-button" onClick={onLogout}>
                          
                        Logout  
                    </button>  
                </div>  
            </header>  
            {/* ========================= Main Content ========================== */}  
            <main className="admin-content">
                  
                <h2>Customers</h2> {/* Loading */}  
                {loading && <p className="loading-message"> Loading customers... </p>}  
                {/* Error */} {error && <p className="error-message"> {error} </p>}  
                {/* Customer Table */}  
                {!loading && !error && (
                    <div className="table-wrapper">
                          
                        <table className="customer-table">    
                            <thead>
                                <tr> 
                                    <th>Customer</th> <th>Tenant ID</th> <th>Plan</th>  
                                    <th>Monthly Price</th> <th>Usage</th> <th>Limit</th>  
                                    <th>Remaining</th> <th>Overage</th> <th>Overage Cost</th>  
                                    <th>Start Date</th> <th>End Date</th> <th>Status</th>  
                                </tr>  
                            </thead>  
                            <tbody>
                                  
                                {tenants.map((tenant) => {
                                    const subscription = subscriptions.find(
                                        (item) => item.tenant_id === tenant.id,
                                    );
                                    const usage = usageSummaries.find(
                                        (item) => item.tenant_id === tenant.id,
                                    );
                                    return (
                                        <tr key={tenant.id}>
                                              
                                            {/* Customer */}  
                                            <td className="customer-name"> {tenant.name} </td>  
                                            {/* Tenant ID */}  
                                            <td className="tenant-id"> {tenant.id} </td> {/* Plan */}  
                                            <td className="plan-name">
                                                  
                                                {subscription
                                                    ? subscription.plan
                                                    : "No subscription"}  
                                            </td>  
                                            {/* Monthly Price */}  
                                            <td className="price">
                                                  
                                                {subscription
                                                    ? `₹${Number(subscription.monthly_price).toFixed(2)}`
                                                    : "-"}  
                                            </td>  
                                            {/* Usage */} <td> {usage ? usage.total_usage : "-"} </td>  
                                            {/* Limit */} <td> {usage ? usage.plan_limit : "-"} </td>  
                                            {/* Remaining */}  
                                            <td> {usage ? usage.remaining_usage : "-"} </td>  
                                            {/* Overage */} <td> {usage ? usage.overage : "-"} </td>  
                                            {/* Overage Cost */}  
                                            <td className="price">
                                                  
                                                {usage
                                                    ? `₹${Number(usage.overage_cost).toFixed(2)}`
                                                    : "-"}  
                                            </td>  
                                            {/* Start Date */}  
                                            <td>
                                                  
                                                {subscription
                                                    ? new Date(
                                                        subscription.start_date,
                                                    ).toLocaleDateString()
                                                    : "-"}  
                                            </td>  
                                            {/* End Date */}  
                                            <td>
                                                  
                                                {subscription
                                                    ? subscription.end_date
                                                        ? new Date(
                                                            subscription.end_date,
                                                        ).toLocaleDateString()
                                                        : "N/A"
                                                    : "-"}  
                                            </td>  
                                            {/* Status */}  
                                            <td>
                                                  
                                                {subscription ? (
                                                    <span
                                                        className={`status-badge ${subscription.status === "ACTIVE" ? "status-active" : "status-expired"}`}
                                                    >
                                                          
                                                        {subscription.status}  
                                                    </span>
                                                ) : (
                                                    "-"
                                                )}  
                                            </td>  
                                        </tr>
                                    );
                                })}  
                            </tbody>  
                        </table>  
                    </div>
                )}  
            </main>  
        </div>
    );
}
export default AdminDashboard;
