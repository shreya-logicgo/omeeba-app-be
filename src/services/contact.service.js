// services/contactService.js
import { sendEmail as sendBrevoEmail } from "./email.service.js";
import { contactEmailTemplate } from "../templates/contactEmailTemplate.js";
import config from "../config/env.js";
import logger from "../utils/logger.js";

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Validate Contact Us request payload
 */
export const validateContactPayload = ({ name, email, subject, message } = {}) => {
  if (!name || !email || !subject || !message) {
    return { valid: false, message: "All fields are required" };
  }
  if (!emailRegex.test(email)) {
    return { valid: false, message: "Invalid email format" };
  }
  return { valid: true };
};

/**
 * Send email using Brevo
 */
const sendEmail = async ({ to, subject, html, replyTo, fromName }) => {
  try {
    const result = await sendBrevoEmail({ to, subject, html, replyTo, fromName });
    if (!result?.success) {
      logger.error("Brevo email failed", { to, subject, error: result?.error });
    }
    return result;
  } catch (err) {
    logger.error("Brevo send error", err);
    return { success: false, error: err.message };
  }
};

/**
 * Process contact request: send exactly two emails
 */
export const processContactRequest = async ({ name, email, subject, message }) => {
  const ADMIN_EMAIL = config.from || process.env.FROM_EMAIL || "support@omeeba.com";

  // 1️⃣ Confirmation email to user
  await sendEmail({
    to: email,
    subject: "Support Request Received",
    html: contactEmailTemplate({ name, subject, message }),
    fromName: "Omeeba Support",
  });

  // 2️⃣ Notification email to admin/support
  const adminHtml = `
    <div style="font-family: Arial, sans-serif;">
      <h3>New Contact Request</h3>
      <p><strong>Name:</strong> ${name}</p>
      <p><strong>Email:</strong> ${email}</p>
      <p><strong>Subject:</strong> ${subject}</p>
      <p><strong>Message:</strong></p>
      <p>${message}</p>
      <hr/>
      <p style="font-size:12px;color:gray;">Reply directly to this email to respond to the user.</p>
    </div>
  `;
  await sendEmail({
    to: ADMIN_EMAIL,
    subject: `[Contact] ${subject} - from ${name}`,
    html: adminHtml,
    replyTo: email,
    fromName: name,
  });
};

export default { validateContactPayload, processContactRequest };