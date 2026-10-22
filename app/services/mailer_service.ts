import mail from '@adonisjs/mail/services/main'
import logger from '@adonisjs/core/services/logger'

/**
 * Thin wrapper around the mail service for the auth flows. All sends are
 * best-effort: a delivery failure is logged but never thrown, so a broken
 * SMTP server can't 500 a request or leak whether an account exists. The
 * cached OTP/reset code remains the source of truth for verification.
 */
export default class MailerService {
  /**
   * OTP email for signup / artisan onboarding verification.
   */
  static async sendOtpEmail(email: string, otp: string) {
    await this.safeSend(email, 'Your BetaWork verification code', 'emails/otp_verification', {
      email,
      otp,
    })
  }

  /**
   * OTP email for the forgot-password reset flow.
   */
  static async sendPasswordResetEmail(email: string, otp: string) {
    await this.safeSend(email, 'Reset your BetaWork password', 'emails/password_reset', {
      email,
      otp,
    })
  }

  private static async safeSend(
    to: string,
    subject: string,
    view: string,
    data: Record<string, unknown>
  ) {
    try {
      await mail.send((message) => {
        message.to(to).subject(subject).htmlView(view, data)
      })
    } catch (error) {
      logger.error({ err: error, to }, 'Failed to send email')
    }
  }
}
