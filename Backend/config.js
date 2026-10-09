// config.js — local settings for the backend.
//
// Reads from a local .env file if one exists (see .env.example —
// copy it to .env and fill in real values; .env is gitignored so
// secrets never end up in source control or commit history).
require('dotenv').config();
//
// OWNER_REPLY_KEY is the secret you type in when replying to a comment
// as the site owner. Anyone who knows this key can post a reply that
// gets tagged and styled as coming from you — so treat it like a
// password: change the default below to something only you know,
// and don't share it publicly (e.g. don't post it in a comment!).

module.exports = {
  OWNER_REPLY_KEY: process.env.OWNER_REPLY_KEY || 'change-this-before-using',
  SESSION_TTL_DAYS: Number(process.env.SESSION_TTL_DAYS) || 30,
  // How long a "forgot password" link stays valid before it expires.
  RESET_TOKEN_TTL_MINUTES: Number(process.env.RESET_TOKEN_TTL_MINUTES) || 30,

  // --- Outgoing email (contact form notifications + replies) ---
  // All optional. If SMTP_HOST/SMTP_USER/SMTP_PASS aren't set, the
  // site still works — contact messages just get stored in the
  // database without emailing anyone (see routes/contact.js).
  //
  // For Gmail: SMTP_HOST=smtp.gmail.com, SMTP_PORT=465, SMTP_USER is
  // your address, SMTP_PASS is a 16-character "App Password" (not
  // your normal password — Google requires this for SMTP access:
  // https://myaccount.google.com/apppasswords). Any other provider
  // (Outlook, Zoho, a transactional email service like Resend or
  // Postmark) works the same way with their own SMTP host/port.
  SMTP_HOST: process.env.SMTP_HOST || '',
  SMTP_PORT: Number(process.env.SMTP_PORT) || 465,
  SMTP_USER: process.env.SMTP_USER || '',
  SMTP_PASS: process.env.SMTP_PASS || '',
  // Where new contact-form messages get sent. Defaults to SMTP_USER
  // if not set separately.
  OWNER_EMAIL: process.env.OWNER_EMAIL || process.env.SMTP_USER || '',

  // Accounts allowed to view/reply to contact messages at
  // contact-inbox.html — they just need to register a normal account
  // with one of these exact emails and log in; no separate password
  // or key involved. Override with a comma-separated ADMIN_EMAILS env
  // var to change this without editing code.
  ADMIN_EMAILS: (process.env.ADMIN_EMAILS || 'johnniekips@gmail.com,scottechstar@gmail.com')
    .split(',')
    .map(function (e) { return e.trim().toLowerCase(); })
    .filter(Boolean)
};