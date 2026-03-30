/**
 * Email Service using Nodemailer with Brevo SMTP
 * A reusable email service for sending emails via Brevo SMTP
 */

import nodemailer from 'nodemailer';

// Create transporter with Brevo SMTP configuration
const transporter = nodemailer.createTransport({
  host: "smtp-relay.brevo.com",
  port: 587,
  secure: false, // true for 465, false for other ports
  auth: {
    user: "a631b2001@smtp-brevo.com",
    pass: "V1Lt6JxCOGF0Nkp9"
  }
});

/**
 * Send email using Nodemailer with Brevo SMTP
 * @param {string} to - Recipient email address
 * @param {string} subject - Email subject
 * @param {string} html - Email HTML content (optional)
 * @param {string} text - Email text content (optional)
 * @returns {Promise<Object>} Email send result
 */
export const sendEmail = async (to, subject, html = null, text = null) => {
  try {
    console.log('📧 Email Service Started');
    console.log('📨 To:', to);
    console.log('📋 Subject:', subject);
    console.log('🔑 SMTP Login configured:', !!process.env.BREVO_SMTP_LOGIN);
    console.log('📧 From Email:', process.env.FROM_EMAIL || 'noreply@omeeba.com');

    // Validate required environment variables
    if (!process.env.FROM_EMAIL) {
      throw new Error('FROM_EMAIL environment variable not configured');
    }

    // Prepare mail options
    const mailOptions = {
      from: process.env.FROM_EMAIL,
      to: to,
      subject: subject
    };

    // Add content if provided
    if (html) {
      mailOptions.html = html;
    }
    
    if (text) {
      mailOptions.text = text;
    } else if (html) {
      // Generate text content from HTML if text is not provided
      mailOptions.text = html.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
    }

    // Send email
    const info = await transporter.sendMail(mailOptions);

    console.log('✅ Email sent successfully');
    console.log('📧 Message ID:', info.messageId);
    console.log('📊 Response:', info.response);

    return {
      success: true,
      messageId: info.messageId,
      response: info.response,
      envelope: info.envelope
    };

  } catch (error) {
    console.error('❌ Email sending failed:', error.message);
    console.error('🔍 Error details:', error);

    return {
      success: false,
      error: error.message,
      details: error
    };
  }
};

/**
 * Verify SMTP connection
 * @returns {Promise<boolean>} Connection status
 */
export const verifyConnection = async () => {
  try {
    console.log('🔍 Verifying SMTP connection...');
    await transporter.verify();
    console.log('✅ SMTP connection verified successfully');
    return true;
  } catch (error) {
    console.error('❌ SMTP connection verification failed:', error.message);
    return false;
  }
};

/**
 * Send email with attachment support
 * @param {string} to - Recipient email address
 * @param {string} subject - Email subject
 * @param {string} html - Email HTML content (optional)
 * @param {string} text - Email text content (optional)
 * @param {Array} attachments - Array of attachment objects (optional)
 * @returns {Promise<Object>} Email send result
 */
export const sendEmailWithAttachments = async (to, subject, html = null, text = null, attachments = []) => {
  try {
    const mailOptions = {
      from: process.env.FROM_EMAIL,
      to: to,
      subject: subject,
      attachments: attachments
    };

    if (html) {
      mailOptions.html = html;
    }
    
    if (text) {
      mailOptions.text = text;
    } else if (html) {
      mailOptions.text = html.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
    }

    const info = await transporter.sendMail(mailOptions);

    console.log('✅ Email with attachments sent successfully');
    console.log('📧 Message ID:', info.messageId);

    return {
      success: true,
      messageId: info.messageId,
      response: info.response,
      attachmentsSent: attachments.length
    };

  } catch (error) {
    console.error('❌ Email with attachments sending failed:', error.message);
    return {
      success: false,
      error: error.message,
      details: error
    };
  }
};

export default {
  sendEmail,
  verifyConnection,
  sendEmailWithAttachments
};
