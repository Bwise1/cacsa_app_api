const nodemailer = require("nodemailer");
const axios = require("axios");

const ZEPTOMAIL_DEFAULT_URL = "https://api.zeptomail.com/v1.1/email";

/**
 * Env often sets `ZEPTOMAIL_API_URL=api.zeptomail.com` without scheme; axios then
 * treats it as a path on localhost. Always use https and the `/v1.1/email` path when only a host was given.
 */
function resolveZeptoMailApiUrl() {
  const raw = process.env.ZEPTOMAIL_API_URL?.trim();
  if (!raw) {
    return ZEPTOMAIL_DEFAULT_URL;
  }
  let url = raw;
  if (!/^https?:\/\//i.test(url)) {
    url = `https://${url}`;
  }
  try {
    const parsed = new URL(url);
    if (parsed.pathname === "/" || parsed.pathname === "") {
      parsed.pathname = "/v1.1/email";
    }
    return parsed.href;
  } catch {
    console.warn(
      "[emailService] ZEPTOMAIL_API_URL is invalid; using default",
      ZEPTOMAIL_DEFAULT_URL
    );
    return ZEPTOMAIL_DEFAULT_URL;
  }
}

/** Avoid `Zoho-enczapikey Zoho-enczapikey …` when the token in env already includes the prefix. */
function zeptoAuthorizationHeader(token) {
  const t = String(token).trim();
  if (/^Zoho-enczapikey\s+/i.test(t)) {
    return t;
  }
  return `Zoho-enczapikey ${t}`;
}

/**
 * Invite links:
 * - `deep`: custom scheme (always works if the app is installed).
 * - `web`: **public** HTTPS URL users can tap from email (recommended for production).
 *
 * Set **only** `FAMILY_JOIN_WEB_BASE` to your app site, e.g. `https://app.cacsa.org.ng`
 * (no trailing slash). That can differ from `BACKEND_URL` / API host.
 * Your reverse proxy should serve `GET /family/join` on that host by forwarding to this
 * API’s `/family/join` route (same handler as in FamilyController).
 */
function buildJoinUrls(token) {
  const deep = `cacsa://family/join?t=${encodeURIComponent(token)}`;
  const base =
    process.env.FAMILY_JOIN_WEB_BASE?.trim() ||
    process.env.BACKEND_URL?.trim() ||
    "";
  const web = base
    ? `${base.replace(/\/$/, "")}/family/join?t=${encodeURIComponent(token)}`
    : "";
  return { deep, web };
}

/** Keep in sync with `INVITE_TTL_DAYS` in FamilyController.js */
const FAMILY_INVITE_TTL_DAYS = 14;

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

async function createSmtpTransport() {
  const host = process.env.SMTP_HOST;
  const port = process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : 587;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !user || !pass) {
    return null;
  }

  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });
}

/**
 * ZeptoMail REST API (preferred). Env: ZEPTOMAIL_SEND_TOKEN, ZEPTOMAIL_FROM_ADDRESS,
 * optional ZEPTOMAIL_FROM_NAME, ZEPTOMAIL_API_URL.
 * @see https://www.zoho.com/zeptomail/help/api/email-sending.html
 */
async function sendViaZeptoMail({
  toEmail,
  toName,
  subject,
  textbody,
  htmlbody,
}) {
  const token = process.env.ZEPTOMAIL_SEND_TOKEN?.trim();
  const fromAddress = process.env.ZEPTOMAIL_FROM_ADDRESS?.trim();
  const fromName =
    process.env.ZEPTOMAIL_FROM_NAME?.trim() || "CACSA";

  if (!token || !fromAddress) {
    return false;
  }

  const url = resolveZeptoMailApiUrl();

  const payload = {
    from: { address: fromAddress, name: fromName },
    to: [
      {
        email_address: {
          address: toEmail,
          name: toName || toEmail.split("@")[0] || "User",
        },
      },
    ],
    subject,
  };

  if (htmlbody) {
    payload.htmlbody = htmlbody;
  }
  if (textbody) {
    payload.textbody = textbody;
  }
  if (!payload.textbody && !payload.htmlbody) {
    throw new Error("ZeptoMail: textbody or htmlbody required");
  }

  const res = await axios.post(url, payload, {
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      Authorization: zeptoAuthorizationHeader(token),
    },
    timeout: 30000,
    validateStatus: () => true,
  });

  if (res.status < 200 || res.status >= 300) {
    const errMsg =
      res.data?.error?.message ||
      res.data?.message ||
      `HTTP ${res.status}`;
    throw new Error(String(errMsg));
  }

  return true;
}

/**
 * Send transactional email: ZeptoMail if configured, else SMTP, else skip.
 */
async function sendTransactionalEmail({
  toEmail,
  toName,
  subject,
  textbody,
  htmlbody,
}) {
  try {
    await sendViaZeptoMail({
      toEmail,
      toName,
      subject,
      textbody,
      htmlbody,
    });
    return { sent: true, via: "zeptomail" };
  } catch (err) {
    console.error("[emailService] ZeptoMail failed:", err.message || err);
  }

  const transport = await createSmtpTransport();
  if (!transport) {
    return { sent: false, via: null };
  }

  const from =
    process.env.EMAIL_FROM ||
    process.env.ZEPTOMAIL_FROM_ADDRESS ||
    process.env.SMTP_USER ||
    "noreply@cacsa.app";

  await transport.sendMail({
    from,
    to: toEmail,
    subject,
    text: textbody || undefined,
    html: htmlbody || undefined,
  });

  return { sent: true, via: "smtp" };
}

/**
 * Sends family invite email. If neither ZeptoMail nor SMTP is configured, logs links.
 */
async function sendFamilyInviteEmail({
  toEmail,
  inviteToken,
  inviterEmail,
  tierLabel,
}) {
  const { deep, web } = buildJoinUrls(inviteToken);
  const isStudentFamily =
    typeof tierLabel === "string" &&
    tierLabel.toLowerCase().includes("student");

  const textbody = [
    `You've been invited to join a CACSA family subscription${inviterEmail ? ` by ${inviterEmail}` : ""}.`,
    tierLabel ? `Plan: ${tierLabel}` : "",
    "",
    isStudentFamily
      ? "The household owner has already completed plan verification. You do not need a student verification code to accept — only this invite and signing in with this email."
      : "",
    "",
    "YOUR INVITE CODE (copy the full code):",
    inviteToken,
    "",
    "How to join in the app:",
    "1) Install and open the CACSA app.",
    `2) Sign in with this exact email address (${toEmail}).`,
    "3) Open Subscribe — if you see \"You have a family invitation\", tap Accept; otherwise go to Subscription → \"Have a family invite code?\" (or Join family) and paste the code above.",
    "4) Tap Accept invitation.",
    "",
    `This invite expires in ${FAMILY_INVITE_TTL_DAYS} days. If it expires, ask the organiser to send a new invite.`,
    "",
    "You must use the same email address this message was sent to.",
    web ? `\nOpen in browser (if supported on your device):\n${web}` : "",
    deep ? `\nOpen in app:\n${deep}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  const tokenHtml = escapeHtml(inviteToken);

  const htmlbody = `
<div style="font-family:system-ui,Segoe UI,sans-serif;line-height:1.5;color:#1a1a1a;max-width:560px;">
  <h2 style="margin:0 0 12px;font-size:20px;">You're invited to a CACSA family plan</h2>
  <p style="margin:0 0 8px;">You've been invited to join a CACSA family subscription${
    inviterEmail ? ` by <strong>${escapeHtml(inviterEmail)}</strong>` : ""
  }.</p>
  ${tierLabel ? `<p style="margin:0 0 12px;"><strong>Plan:</strong> ${escapeHtml(tierLabel)}</p>` : ""}
  ${
    isStudentFamily
      ? `<p style="margin:0 0 12px;font-size:14px;color:#333;">The household owner has already completed verification for this plan. You do <strong>not</strong> need a student verification code to join — use this invite and sign in with <strong>${escapeHtml(toEmail)}</strong>.</p>`
      : ""
  }
  <p style="margin:16px 0 6px;font-weight:600;">Your invite code</p>
  <div style="background:#f4f4f4;border-radius:8px;padding:12px 14px;font-family:ui-monospace,monospace;font-size:14px;word-break:break-all;border:1px solid #ddd;">${tokenHtml}</div>
  <p style="margin:16px 0 8px;font-weight:600;">Steps</p>
  <ol style="margin:0;padding-left:20px;">
    <li>Install and open the CACSA app.</li>
    <li>Sign in with <strong>${escapeHtml(toEmail)}</strong>.</li>
    <li>On <strong>Subscribe</strong>, use the invitation banner if shown, or go to <strong>Join family</strong> and paste the code.</li>
    <li>Tap <strong>Accept invitation</strong>.</li>
  </ol>
  <p style="margin:16px 0 0;font-size:13px;color:#555;">This invite expires in <strong>${FAMILY_INVITE_TTL_DAYS} days</strong>. If it expires, ask the organiser to send a new invite.</p>
  ${
    web
      ? `<p style="margin:16px 0 0;"><a href="${escapeHtml(web)}" style="color:#00A551;">Open join link in browser</a></p>`
      : ""
  }
</div>`.trim();

  const result = await sendTransactionalEmail({
    toEmail,
    toName: toEmail.split("@")[0],
    subject: "Join your CACSA family subscription",
    textbody,
    htmlbody,
  });

  if (!result.sent) {
    console.warn(
      "[emailService] No ZeptoMail/SMTP; family invite link for",
      toEmail,
      ":\n",
      textbody
    );
    return { sent: false, deepLink: deep, webLink: web || null };
  }

  return { sent: true, deepLink: deep, webLink: web || null, via: result.via };
}

/**
 * Admin invite link for Next.js accept-invite page.
 */
async function sendAdminInviteEmail({ toEmail, inviteToken, roleName }) {
  const base =
    process.env.ADMIN_INVITE_WEB_BASE ||
    process.env.NEXT_PUBLIC_ADMIN_URL ||
    process.env.BACKEND_URL ||
    "";
  const path = `/invite/${encodeURIComponent(inviteToken)}`;
  const web = base
    ? `${base.replace(/\/$/, "")}${path}`
    : `(configure ADMIN_INVITE_WEB_BASE) token=${inviteToken}`;

  const textbody = [
    "You've been invited to the CACSA admin console.",
    roleName ? `Role: ${roleName}` : "",
    "",
    "Open this link to create your account:",
    web,
    "",
    "This link expires in 7 days.",
  ]
    .filter(Boolean)
    .join("\n");

  const result = await sendTransactionalEmail({
    toEmail,
    toName: toEmail.split("@")[0],
    subject: "CACSA admin invitation",
    textbody,
    logLabel: "admin invite",
  });

  if (!result.sent) {
    console.warn(
      "[emailService] No ZeptoMail/SMTP; admin invite for",
      toEmail,
      ":\n",
      textbody
    );
    return { sent: false, link: web };
  }

  return { sent: true, link: web, via: result.via };
}

module.exports = {
  sendFamilyInviteEmail,
  buildJoinUrls,
  sendAdminInviteEmail,
};
