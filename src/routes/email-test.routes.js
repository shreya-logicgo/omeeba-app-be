import express from 'express';
import { sendEmail, verifyConnection } from '../services/emailService.js';

const router = express.Router();

/**
 * Test email service connection
 * GET /api/email-test/verify
 */
router.get('/verify', async (req, res) => {
  try {
    const isConnected = await verifyConnection();
    
    res.json({
      success: isConnected,
      message: isConnected ? 'SMTP connection verified successfully' : 'SMTP connection failed',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error verifying email connection',
      error: error.message
    });
  }
});

/**
 * Send test email
 * POST /api/email-test/send
 */
router.post('/send', async (req, res) => {
  try {
    const { to, subject, html, text } = req.body;

    // Validate required fields
    if (!to || !subject) {
      return res.status(400).json({
        success: false,
        message: 'Recipient email and subject are required'
      });
    }

    // Default test content if not provided
    const defaultHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #007bff;">Test Email from Omeeba</h2>
        <p>This is a test email to verify that the email service is working correctly.</p>
        <div style="background-color: #f8f9fa; padding: 20px; border-radius: 5px; margin: 20px 0;">
          <h3>Email Details:</h3>
          <ul>
            <li><strong>To:</strong> ${to}</li>
            <li><strong>Subject:</strong> ${subject}</li>
            <li><strong>Sent at:</strong> ${new Date().toLocaleString()}</li>
          </ul>
        </div>
        <p style="color: #6c757d; font-size: 14px;">
          If you received this email, the email service is working correctly! 🎉
        </p>
      </div>
    `;

    const defaultText = `
Test Email from Omeeba

This is a test email to verify that the email service is working correctly.

Email Details:
- To: ${to}
- Subject: ${subject}
- Sent at: ${new Date().toLocaleString()}

If you received this email, the email service is working correctly! 🎉
    `;

    const result = await sendEmail(
      to,
      subject,
      html || defaultHtml,
      text || defaultText
    );

    if (result.success) {
      res.json({
        success: true,
        message: 'Test email sent successfully',
        data: {
          messageId: result.messageId,
          response: result.response,
          sentTo: to,
          subject: subject
        },
        timestamp: new Date().toISOString()
      });
    } else {
      res.status(500).json({
        success: false,
        message: 'Failed to send test email',
        error: result.error,
        details: result.details,
        timestamp: new Date().toISOString()
      });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error sending test email',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

export default router;
