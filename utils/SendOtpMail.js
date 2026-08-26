import nodemailer from 'nodemailer'

/**
 * Sends an OTP verification email to the user via Nodemailer + Gmail SMTP.
 *
 * The transporter is created inside this function (not at module level) so
 * that it always reads the correct env vars — which are only available after
 * dotenv.config() runs in server.js, not at import time.
 *
 * @param {string} toEmail - Recipient email address
 * @param {string|number} otp - 6-digit OTP code
 * @returns {Promise<void>}
 */
export const sendOtpMail = async (toEmail, otp) => {
  // ── Guard: skip sending if SMTP credentials are not configured ──────────
  const smtpUser = process.env.SMTP_USER
  const smtpPass = process.env.SMTP_PASS

  if (!smtpUser || !smtpPass || smtpUser.trim() === '' || smtpPass.trim() === '') {
    console.warn(
      '⚠️  SMTP credentials are not configured. Set SMTP_USER and SMTP_PASS in server/.env\n' +
      '   To get a Gmail App Password:\n' +
      '   1. Enable 2-Step Verification at myaccount.google.com/security\n' +
      '   2. Go to Security → App Passwords\n' +
      '   3. Generate a password for "Mail" and copy the 16 characters (no spaces)\n' +
      '   4. Set SMTP_PASS=<16chars> in server/.env'
    )
    return
  }

  // ── Create transporter fresh each call — reads env vars correctly ────────
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT) || 587,
    secure: process.env.SMTP_SECURE === 'true', // false for port 587 (STARTTLS)
    auth: {
      user: smtpUser,
      pass: smtpPass,
    },
  })

  const mailOptions = {
    from: `"Kurti Cove" <${smtpUser}>`,
    to: toEmail,
    subject: 'Your Kurti Cove Verification OTP',
    html: `
      <div style="font-family: 'Poppins', sans-serif; max-width: 480px;
                   margin: auto; background: #FAF5FF; border-radius: 12px;
                   padding: 32px; border: 1px solid #E9D5FF;">
        <h2 style="color: #3B0764; font-size: 24px; text-align: center;">
          Kurti Cove 🌸
        </h2>
        <p style="color: #6B21A8; text-align: center;">
          Your One-Time Password (OTP) is:
        </p>
        <div style="background: #A855F7; color: white; font-size: 36px;
                     font-weight: bold; text-align: center; padding: 16px;
                     border-radius: 8px; letter-spacing: 8px;">
          ${otp}
        </div>
        <p style="color: #7E22CE; text-align: center; margin-top: 16px;
                   font-size: 13px;">
          This OTP is valid for <strong>10 minutes</strong>.
          Do not share it with anyone.
        </p>
        <hr style="border-color: #E9D5FF; margin: 24px 0;">
        <p style="color: #C084FC; font-size: 11px; text-align: center;">
          © 2025 Kurti Cove. All rights reserved.
        </p>
      </div>
    `,
  }

  await transporter.sendMail(mailOptions)
}
