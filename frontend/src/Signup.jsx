import { useState } from "react";
import api from "./api";
import "./Signup.css";

function Signup({ onSignup }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [companyName, setCompanyName] = useState("");

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [showVerification, setShowVerification] = useState(false);

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSignup = async (e) => {
    e.preventDefault();

    setError("");

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);

    try {
      await api.post("/auth/signup", {
        email,
        password,
        company_name: companyName,
      });

      // Signup successful.
      // Verification link has been sent to the user's email.
      setShowVerification(true);
    } catch (err) {
      setError(
        err?.response?.data?.detail ||
        "Signup failed. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  if (showVerification) {
    return (
      <div className="auth-container">
        <div className="auth-card verification-card">
          <div className="verification-icon-circle">✉️</div>

          <h2 className="auth-title">Please verify your email</h2>

          <p className="auth-subtitle">
            Your account has been created successfully.
          </p>

          <p style={{ margin: "16px 0 6px", fontSize: "14px", color: "var(--gray-600)" }}>
            We have sent an activation link to:
          </p>

          <div className="verification-email-box">
            {email}
          </div>

          <p className="verification-instructions">
            Please check your inbox and click the verification link to activate your account.
          </p>


        </div>
      </div>
    );
  }

  return (
    <div className="auth-container">
      <div className="auth-card">
        <div className="auth-header">
          <div className="auth-brand-badge">⚡ SaaS Billing</div>
          <h2 className="auth-title">Create your account</h2>
          <p className="auth-subtitle">Start monitoring API usage and billing in minutes</p>
        </div>

        <form className="auth-form" onSubmit={handleSignup}>
          <div className="form-group">
            <label className="form-label" htmlFor="signup-company">Organization Name</label>
            <input
              id="signup-company"
              className="form-input"
              type="text"
              placeholder="Acme Corp"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="signup-email">Work Email</label>
            <input
              id="signup-email"
              className="form-input"
              type="email"
              placeholder="you@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="signup-password">Password</label>
            <div className="password-input-wrapper">
              <input
                id="signup-password"
                className="form-input"
                type={showPassword ? "text" : "password"}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                autoComplete="new-password"
              />
              <button
                type="button"
                className="password-toggle-btn"
                onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? "Hide password" : "Show password"}
                title={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                    <line x1="1" y1="1" x2="23" y2="23" />
                  </svg>
                ) : (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                )}
              </button>
            </div>
            <span className="form-hint">Must be at least 6 characters</span>
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="signup-confirm-password">Confirm Password</label>
            <div className="password-input-wrapper">
              <input
                id="signup-confirm-password"
                className="form-input"
                type={showConfirmPassword ? "text" : "password"}
                placeholder="••••••••"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                minLength={6}
                autoComplete="new-password"
              />
              <button
                type="button"
                className="password-toggle-btn"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                aria-label={showConfirmPassword ? "Hide password" : "Show password"}
                title={showConfirmPassword ? "Hide password" : "Show password"}
              >
                {showConfirmPassword ? (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                    <line x1="1" y1="1" x2="23" y2="23" />
                  </svg>
                ) : (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                )}
              </button>
            </div>
          </div>

          {error && (
            <div className="auth-alert-error" role="alert">
              <span className="auth-alert-icon">⚠️</span>
              <span>{error}</span>
            </div>
          )}

          <button className="auth-submit-btn" type="submit" disabled={loading}>
            {loading ? (
              <>
                <span className="auth-spinner" />
                <span>Creating Account...</span>
              </>
            ) : (
              "Sign Up"
            )}
          </button>
        </form>

        <div className="auth-footer">
          <span>Already have an account?</span>
          <button
            type="button"
            className="auth-link-btn"
            onClick={onSignup}
          >
            Log in
          </button>
        </div>
      </div>
    </div>
  );
}

export default Signup;
