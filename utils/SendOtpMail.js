/**
 * sendOtpMail — thin wrapper kept for backward compatibility.
 * All actual sending is delegated to the Brevo email service.
 */
import { sendOTPEmail } from '../services/emailService.js'

export const sendOtpMail = async (toEmail, otp) => {
  if (!process.env.BREVO_API_KEY) {
    console.warn(
      '⚠️  BREVO_API_KEY is not set. OTP email will be skipped.\n' +
      '   Get a free API key at https://app.brevo.com → SMTP & API → API Keys'
    )
    return
  }
  await sendOTPEmail(toEmail, otp)
}
