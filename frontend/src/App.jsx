
import { useState, useEffect } from "react";
import {
  Routes,
  Route,
  Navigate,
  useNavigate,
} from "react-router-dom";

import Login from "./Login";
import Signup from "./Signup";
import VerifyEmail from "./VerifyEmail";
import AdminDashboard from "./AdminDashboard";
import CustomerDashboard from "./CustomerDashboard";

function App() {
  const navigate = useNavigate();

  const [user, setUser] = useState(() => {
    const token = localStorage.getItem("access_token");
    const savedUser = localStorage.getItem("user");

    if (!token || !savedUser) return null;

    try {
      const payload = JSON.parse(atob(token.split(".")[1]));

      if (payload.exp && payload.exp * 1000 < Date.now()) {
        localStorage.removeItem("access_token");
        localStorage.removeItem("user");
        return null;
      }

      return JSON.parse(savedUser);
    } catch {
      localStorage.removeItem("access_token");
      localStorage.removeItem("user");
      return null;
    }
  });

  const handleLogin = (loggedInUser) => {
    setUser(loggedInUser);
  };

  const handleLogout = () => {
    localStorage.removeItem("access_token");
    localStorage.removeItem("user");
    setUser(null);
    navigate("/", { replace: true });
  };

  useEffect(() => {
    const handleExpired = () => {
      localStorage.removeItem("access_token");
      localStorage.removeItem("user");
      setUser(null);
      navigate("/", { replace: true });
    };

    window.addEventListener("auth:expired", handleExpired);

    return () => {
      window.removeEventListener("auth:expired", handleExpired);
    };
  }, [navigate]);

  // Keep existing global auth-expiry event handling.
  // It is attached through the effect below.
  const isAuthenticated = Boolean(user);
  const isAdmin = user?.role === "ADMIN";
  const isCustomer = user?.role === "CUSTOMER";

  return (
    <Routes>
      <Route
        path="/verify-email"
        element={
          <VerifyEmail
            onVerified={() => navigate("/", { replace: true })}
          />
        }
      />

      <Route
        path="/"
        element={
          isAuthenticated ? (
            <Navigate
              to={isAdmin ? "/admin" : "/dashboard"}
              replace
            />
          ) : (
            <Login
              onLogin={handleLogin}
              onSignup={() => navigate("/signup")}
            />
          )
        }
      />

      <Route
        path="/signup"
        element={
          isAuthenticated ? (
            <Navigate
              to={isAdmin ? "/admin" : "/dashboard"}
              replace
            />
          ) : (
            <Signup
              onSignup={() => navigate("/")}
            />
          )
        }
      />

      <Route
        path="/dashboard"
        element={
          !isAuthenticated ? (
            <Navigate to="/" replace />
          ) : isCustomer ? (
            <CustomerDashboard user={user} onLogout={handleLogout} />
          ) : (
            <Navigate to="/admin" replace />
          )
        }
      />

      <Route
        path="/admin"
        element={
          !isAuthenticated ? (
            <Navigate to="/" replace />
          ) : isAdmin ? (
            <AdminDashboard user={user} onLogout={handleLogout} />
          ) : (
            <Navigate to="/dashboard" replace />
          )
        }
      />

      <Route
        path="*"
        element={
          <Navigate
            to={
              !isAuthenticated
                ? "/"
                : isAdmin
                  ? "/admin"
                  : "/dashboard"
            }
            replace
          />
        }
      />
    </Routes>
  );
}

export default App;


