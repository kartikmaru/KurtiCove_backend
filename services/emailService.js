import { BrevoClient } from '@getbrevo/brevo'

// ─────────────────────────────────────────────────────────────
//  Brevo transactional email service
//  Uses @getbrevo/brevo BrevoClient — correct for this SDK version.
//
//  Required env vars:
//    BREVO_API_KEY       — from https://app.brevo.com → SMTP & API → API Keys
//    BREVO_SENDER_EMAIL  — must be a verified Brevo sender address
//    BREVO_SENDER_NAME   — display name (default: "Kurti Cove")
// ─────────────────────────────────────────────────────────────

function getClient() {
  const apiKey = process.env.BREVO_API_KEY
  if (!apiKey) throw new Error('BREVO_API_KEY is not set in environment variables.')
  return new BrevoClient({ apiKey })
}

/**
 * Generic send — all helpers below call this.
 *
 * @param {string} to      Recipient email address
 * @param {string} subject Email subject line
 * @param {string} html    Full HTML body
 */
export const sendEmail = async (to, subject, html) => {
  const senderEmail = process.env.BREVO_SENDER_EMAIL
  const senderName  = process.env.BREVO_SENDER_NAME || 'Kurti Cove'

  if (!senderEmail) throw new Error('BREVO_SENDER_EMAIL is not set in environment variables.')

  const client = getClient()

  await client.transactionalEmails.sendTransacEmail({
    sender:      { name: senderName, email: senderEmail },
    to:          [{ email: to }],
    subject,
    htmlContent: html,
  })
}

/**
 * Send a 6-digit OTP verification email.
 */
export const sendOTPEmail = async (email, otp) => {
  const subject = 'Your Kurti Cove Verification OTP'
  const html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8"/>
      <meta name="viewport" content="width=device-width,initial-scale=1.0"/>
      <title>Verify Your Email</title>
    </head>
    <body style="margin:0;padding:0;background:#F3E8FF;
                 font-family:'Segoe UI',Arial,sans-serif;">
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td align="center" style="padding:40px 16px;">
            <table width="480" cellpadding="0" cellspacing="0"
                   style="background:#ffffff;border-radius:16px;
                          border:1px solid #E9D5FF;overflow:hidden;
                          box-shadow:0 4px 20px rgba(168,85,247,0.12);">
              <!-- Header -->
              <tr>
                <td style="background:linear-gradient(135deg,#7C3AED,#A855F7);
                            padding:32px;text-align:center;">
                  <h1 style="margin:0;color:#ffffff;font-size:26px;
                              font-weight:700;letter-spacing:1px;">
                    Kurti Cove
                  </h1>
                  <p style="margin:6px 0 0;color:rgba(255,255,255,0.8);
                              font-size:13px;">
                    Ethnic Wear for Every Woman
                  </p>
                </td>
              </tr>
              <!-- Body -->
              <tr>
                <td style="padding:36px 32px 24px;">
                  <p style="margin:0 0 8px;color:#3B0764;font-size:16px;
                              font-weight:600;">
                    Verify Your Email Address
                  </p>
                  <p style="margin:0 0 28px;color:#6B7280;font-size:14px;
                              line-height:1.6;">
                    Use the OTP below to complete your registration.
                    This code is valid for <strong>10 minutes</strong>.
                  </p>
                  <!-- OTP Box -->
                  <div style="background:#FAF5FF;border:2px solid #A855F7;
                               border-radius:12px;padding:24px;text-align:center;
                               margin-bottom:28px;">
                    <p style="margin:0 0 8px;color:#7C3AED;font-size:12px;
                                font-weight:600;text-transform:uppercase;
                                letter-spacing:2px;">
                      Your OTP
                    </p>
                    <span style="font-size:42px;font-weight:800;color:#3B0764;
                                  letter-spacing:10px;font-family:monospace;">
                      ${otp}
                    </span>
                  </div>
                  <p style="margin:0;color:#9CA3AF;font-size:12px;line-height:1.6;">
                    If you didn't request this, you can safely ignore this email.
                    Do not share this OTP with anyone.
                  </p>
                </td>
              </tr>
              <!-- Footer -->
              <tr>
                <td style="background:#FAF5FF;padding:20px 32px;
                            border-top:1px solid #E9D5FF;text-align:center;">
                  <p style="margin:0;color:#C084FC;font-size:11px;">
                    © 2025 Kurti Cove. All rights reserved.
                  </p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `
  await sendEmail(email, subject, html)
}

/**
 * Send a welcome email after successful account verification.
 */
export const sendWelcomeEmail = async (email, name) => {
  const subject = `Welcome to Kurti Cove, ${name}!`
  const frontendUrl = process.env.FRONTEND_URL || 'https://kurti-cove.vercel.app'
  const html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8"/>
      <meta name="viewport" content="width=device-width,initial-scale=1.0"/>
      <title>Welcome to Kurti Cove</title>
    </head>
    <body style="margin:0;padding:0;background:#F3E8FF;
                 font-family:'Segoe UI',Arial,sans-serif;">
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td align="center" style="padding:40px 16px;">
            <table width="480" cellpadding="0" cellspacing="0"
                   style="background:#ffffff;border-radius:16px;
                          border:1px solid #E9D5FF;overflow:hidden;
                          box-shadow:0 4px 20px rgba(168,85,247,0.12);">
              <!-- Header -->
              <tr>
                <td style="background:linear-gradient(135deg,#7C3AED,#A855F7);
                            padding:36px 32px;text-align:center;">
                  <h1 style="margin:0 0 8px;color:#ffffff;font-size:28px;
                              font-weight:700;letter-spacing:1px;">
                    Welcome, ${name}!
                  </h1>
                  <p style="margin:0;color:rgba(255,255,255,0.85);font-size:14px;">
                    You're officially part of the Kurti Cove family
                  </p>
                </td>
              </tr>
              <!-- Body -->
              <tr>
                <td style="padding:36px 32px 28px;">
                  <p style="margin:0 0 20px;color:#3B0764;font-size:15px;
                              line-height:1.7;">
                    Hi <strong>${name}</strong>, your account has been verified.
                    Explore our handpicked collection of ethnic kurtis — crafted
                    for every woman, every occasion.
                  </p>
                  <!-- Features -->
                  <table width="100%" cellpadding="0" cellspacing="0"
                         style="margin-bottom:28px;">
                    <tr>
                      <td style="padding:10px 0;border-bottom:1px solid #F3E8FF;">
                        <p style="margin:0;color:#3B0764;font-size:13px;font-weight:600;">
                          New Arrivals Every Week
                        </p>
                        <p style="margin:2px 0 0;color:#9CA3AF;font-size:12px;">
                          Fresh styles added regularly
                        </p>
                      </td>
                    </tr>
                    <tr>
                      <td style="padding:10px 0;border-bottom:1px solid #F3E8FF;">
                        <p style="margin:0;color:#3B0764;font-size:13px;font-weight:600;">
                          Exclusive Member Discounts
                        </p>
                        <p style="margin:2px 0 0;color:#9CA3AF;font-size:12px;">
                          Save more with every order
                        </p>
                      </td>
                    </tr>
                    <tr>
                      <td style="padding:10px 0;">
                        <p style="margin:0;color:#3B0764;font-size:13px;font-weight:600;">
                          Easy 15-Day Returns
                        </p>
                        <p style="margin:2px 0 0;color:#9CA3AF;font-size:12px;">
                          Shop with confidence
                        </p>
                      </td>
                    </tr>
                  </table>
                  <!-- CTA -->
                  <div style="text-align:center;">
                    <a href="${frontendUrl}/shop"
                       style="display:inline-block;background:#A855F7;color:#ffffff;
                               text-decoration:none;padding:14px 36px;
                               border-radius:50px;font-size:14px;font-weight:600;">
                      Start Shopping
                    </a>
                  </div>
                </td>
              </tr>
              <!-- Footer -->
              <tr>
                <td style="background:#FAF5FF;padding:20px 32px;
                            border-top:1px solid #E9D5FF;text-align:center;">
                  <p style="margin:0;color:#C084FC;font-size:11px;">
                    © 2025 Kurti Cove. All rights reserved.
                  </p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `
  await sendEmail(email, subject, html)
}
