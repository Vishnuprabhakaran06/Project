import os
import smtplib
from email.message import EmailMessage

from dotenv import load_dotenv

load_dotenv()


def send_verification_email(
    recipient_email: str,
    verification_token: str
):
    smtp_host = os.getenv("SMTP_HOST")
    smtp_port = int(os.getenv("SMTP_PORT", "587"))
    smtp_username = os.getenv("SMTP_USERNAME")
    smtp_password = os.getenv("SMTP_PASSWORD")
    smtp_from_email = os.getenv("SMTP_FROM_EMAIL")

    verification_link = (
        f"http://localhost:5173/verify-email"
        f"?token={verification_token}"
    )

    message = EmailMessage()

    message["Subject"] = "Verify your SaaS Billing account"
    message["From"] = f"SaaS Billing <{smtp_from_email}>"
    message["To"] = recipient_email

    message.set_content(
    f"""
Hello,

Thank you for signing up for SaaS Billing.

Please verify your email address by clicking the button below:

Verify your Email

This verification link will expire in 24 hours.

If you did not create this account, please ignore this email.

Thanks,
SaaS Billing Team
"""
)

    message.add_alternative(
    f"""
<html>
  <body style="font-family: Arial, sans-serif; color: #333;">
    <p>Hello,</p>

    <p>Thank you for signing up for SaaS Billing.</p>

    <p>Please verify your email address by clicking the button below:</p>

    <p>
      <a
        href="{verification_link}"
        style="
          display: inline-block;
          padding: 12px 24px;
          background-color: #2563eb;
          color: #ffffff;
          text-decoration: none;
          border-radius: 6px;
          font-weight: bold;
        "
      >
        Verify Email
      </a>
    </p>

    <p>This verification link will expire in 24 hours.</p>

    <p>If you did not create this account, please ignore this email.</p>

    <p>
      Thanks,<br>
      SaaS Billing Team
    </p>
  </body>
</html>
""",
    subtype="html"
)

    with smtplib.SMTP(smtp_host, smtp_port) as server:
        server.starttls()
        server.login(smtp_username, smtp_password)
        server.send_message(message)