// mailer.js — thin wrapper around nodemailer.
//
// If SMTP isn't configured (see config.js), every function here
// resolves quietly instead of throwing, and logs a one-line note to
// the console. This means the site keeps working — contact messages
// still save to the database — even before you've set up email.

const nodemailer = require('nodemailer');
const config = require('./config');

const isConfigured = Boolean(config.SMTP_HOST && config.SMTP_USER && config.SMTP_PASS);

let transporter = null;
if (isConfigured) {
  transporter = nodemailer.createTransport({
    host: config.SMTP_HOST,
    port: config.SMTP_PORT,
    secure: config.SMTP_PORT === 465,
    auth: {
      user: config.SMTP_USER,
      pass: config.SMTP_PASS
    }
  });
}

let warnedOnce = false;
function warnNotConfigured() {
  if (warnedOnce) return;
  warnedOnce = true;
  console.log(
    'Email is not configured (SMTP_HOST/SMTP_USER/SMTP_PASS are unset) — ' +
    'contact messages will still be saved, just not emailed. See Backend/readme.md.'
  );
}

/**
 * @param {{to: string, subject: string, text: string, replyTo?: string}} opts
 * @returns {Promise<{sent: boolean}>}
 */
async function sendMail(opts) {
  if (!isConfigured) {
    warnNotConfigured();
    return { sent: false };
  }
  try {
    await transporter.sendMail({
      from: config.SMTP_USER,
      to: opts.to,
      replyTo: opts.replyTo,
      subject: opts.subject,
      text: opts.text
    });
    return { sent: true };
  } catch (err) {
    console.error('Email send failed:', err.message);
    return { sent: false, error: err.message };
  }
}

module.exports = { sendMail, isConfigured };
