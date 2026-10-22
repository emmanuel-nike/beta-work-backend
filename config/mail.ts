import env from '#start/env'
import { defineConfig, transports } from '@adonisjs/mail'
import type { InferMailers } from '@adonisjs/mail/types'

const smtpUser = env.get('SMTP_USERNAME')

const mailConfig = defineConfig({
  default: 'smtp',

  /**
   * The global "from" identity applied to every outgoing message
   * unless overridden per-message.
   */
  from: {
    address: env.get('MAIL_FROM_ADDRESS', 'no-reply@betawork.app'),
    name: env.get('MAIL_FROM_NAME', 'BetaWork'),
  },

  /**
   * The mailers object can be used to configure multiple mailers
   * each using a different transport or same transport with different
   * options.
   */
  mailers: {
    smtp: transports.smtp({
      host: env.get('SMTP_HOST', 'localhost'),
      port: env.get('SMTP_PORT', 587),
      /**
       * Only attach auth when credentials are configured, so local
       * dev/relay setups without authentication still work.
       */
      auth: smtpUser
        ? {
            type: 'login',
            user: smtpUser,
            pass: env.get('SMTP_PASSWORD', ''),
          }
        : undefined,
    }),
  },
})

export default mailConfig

declare module '@adonisjs/mail/types' {
  export interface MailersList extends InferMailers<typeof mailConfig> {}
}
