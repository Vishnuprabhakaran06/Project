import { useEffect, useState, useRef } from "react";
import api from "./api";
import "./VerifyEmail.css";

function VerifyEmail({ onVerified }) {
  const [status, setStatus] = useState("verifying");
  const [message, setMessage] = useState("");
  const verificationStarted = useRef(false);

  useEffect(() => {
    if (verificationStarted.current) {
      return;
    }

    verificationStarted.current = true;

    const verifyEmail = async () => {
      const params = new URLSearchParams(window.location.search);
      const token = params.get("token");

      if (!token) {
        setStatus("error");
        setMessage("Invalid or missing verification link. Please request a new link.");
        return;
      }

      try {
        const response = await api.get("/auth/verify-email", {
          params: {
            token: token,
          },
        });

        setStatus("success");
        setMessage(
          response.data.message ||
          "Email verified successfully. You can now login to your account."
        );
      } catch (err) {
        setStatus("error");
        setMessage(
          err?.response?.data?.detail ||
          "Email verification failed or link has expired."
        );
      }
    };

    verifyEmail();
  }, []);

  if (status === "verifying") {
    return (
      <div className="verify-container">
        <div className="verify-card">
          <div className="verify-badge-icon verify-badge-loading">
            <div className="verify-spinner" />
          </div>
          <h2 className="verify-title">Verifying your email...</h2>
          <p className="verify-message">
            Please wait while we validate your activation token.
          </p>
        </div>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="verify-container">
        <div className="verify-card">
          <div className="verify-badge-icon verify-badge-error">✕</div>
          <h2 className="verify-title">Verification Failed</h2>
          <p className="verify-message">{message}</p>

          <button type="button" className="verify-btn" onClick={onVerified}>
            Return to Login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="verify-container">
      <div className="verify-card">
        <div className="verify-badge-icon verify-badge-success">✓</div>
        <h2 className="verify-title">Email Verified Successfully</h2>
        <p className="verify-message">{message}</p>

        <button type="button" className="verify-btn" onClick={onVerified}>
          Go to Login
        </button>
      </div>
    </div>
  );
}

export default VerifyEmail;