/**
 * Email Service
 * Handles sending emails using Brevo (formerly Sendinblue) API
 */

import config from "../config/env.js";
import logger from "../utils/logger.js";

const BREVO_API_URL = "https://api.brevo.com/v3/smtp/email";

/**
 * Send email using Brevo API
 * @param {Object} options - Email options
 * @param {string|Array} options.to - Recipient email(s)
 * @param {string} options.subject - Email subject
 * @param {string} options.html - Email HTML content
 * @param {string} options.text - Email text content (optional)
 * @returns {Promise<Object>} Email send result
 */
export const sendEmail = async ({ to, subject, html, text }) => {
  try {
    // Check if Brevo API key is configured
    if (!config.brevo?.apiKey) {
      logger.warn(
        "Brevo API key not configured. Email sending will be skipped."
      );
      logger.info(
        `Email would be sent to ${Array.isArray(to) ? to.join(", ") : to}: ${subject}`
      );
      logger.info(`Email content: ${text || html}`);
      return {
        success: true,
        message: "Email logged (Brevo API key not configured)",
      };
    }

    // Prepare recipients
    const recipients = Array.isArray(to)
      ? to.map((email) => ({ email }))
      : [{ email: to }];

    // Prepare email payload
    const emailPayload = {
      sender: {
        name: config.email.fromName,
        email: config.email.from,
      },
      to: recipients,
      subject,
      htmlContent: html,
      textContent: text || html.replace(/<[^>]*>/g, ""), // Strip HTML tags for text version
    };

    // Send email via Brevo API
    const response = await fetch(BREVO_API_URL, {
      method: "POST",
      headers: {
        "api-key": config.brevo.apiKey,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(emailPayload),
    });

    const responseData = await response.json();

    if (!response.ok) {
      const errorMessage =
        responseData.message || `Brevo API error: ${response.status}`;
      logger.error(`Brevo API error:`, responseData);
      throw new Error(errorMessage);
    }

    logger.info(
      `Email sent successfully to ${Array.isArray(to) ? to.join(", ") : to}. Message ID: ${responseData.messageId}`
    );

    return {
      success: true,
      messageId: responseData.messageId,
      data: responseData,
    };
  } catch (error) {
    logger.error(
      `Error sending email to ${Array.isArray(to) ? to.join(", ") : to}:`,
      error
    );
    throw new Error(`Failed to send email: ${error.message}`);
  }
};

/**
 * Send OTP email
 * @param {string} email - Recipient email
 * @param {number} otp - OTP code
 * @returns {Promise<Object>} Email send result
 */
export const sendOTPEmail = async (email, otp) => {
  const subject = "Your OTP for Account Verification";
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>OTP Verification</title>
    </head>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background-color: #f4f4f4; padding: 20px; border-radius: 5px;">
        <h2 style="color: #333; text-align: center;">OTP Verification</h2>
        <p>Hello,</p>
        <p>Thank you for registering with us. Please use the following OTP to verify your account:</p>
        <div style="background-color: #fff; padding: 20px; border-radius: 5px; text-align: center; margin: 20px 0;">
          <h1 style="color: #007bff; font-size: 32px; margin: 0; letter-spacing: 5px;">${otp}</h1>
        </div>
        <p>This OTP will expire in ${config.otp.expireMinutes} minutes.</p>
        <p>If you didn't request this OTP, please ignore this email.</p>
        <p style="margin-top: 30px; color: #666; font-size: 12px;">
          Best regards,<br>
          ${config.email.fromName}
        </p>
      </div>
    </body>
    </html>
  `;

  const text = `
    OTP Verification
    
    Hello,
    
    Thank you for registering with us. Please use the following OTP to verify your account:
    
    OTP: ${otp}
    
    This OTP will expire in ${config.otp.expireMinutes} minutes.
    
    If you didn't request this OTP, please ignore this email.
    
    Best regards,
    ${config.email.fromName}
  `;

  return sendEmail({ to: email, subject, html, text });
};

export default {
  sendEmail,
  sendOTPEmail,
};
