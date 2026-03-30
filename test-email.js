import { sendEmail, verifyConnection } from './src/services/emailService.js';

// Set environment variables for testing
process.env.FROM_EMAIL = 'noreply@omeeba.co.in';

async function testEmailService() {
  console.log('🚀 Testing Email Service...\n');

  try {
    // Test 1: Verify connection
    console.log('1️⃣ Testing SMTP connection...');
    const isConnected = await verifyConnection();
    console.log(`Connection status: ${isConnected ? '✅ Connected' : '❌ Failed'}\n`);

    if (isConnected) {
      // Test 2: Send test email
      console.log('2️⃣ Sending test email...');
      const result = await sendEmail(
        'harsh.logicgo6@gmail.com', // Change this to your test email
        'Test Email from Omeeba',
        `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #007bff;">🎉 Email Service Test Successful!</h2>
            <p>This email confirms that the Nodemailer email service with Brevo SMTP is working correctly.</p>
            <div style="background-color: #f8f9fa; padding: 20px; border-radius: 5px; margin: 20px 0;">
              <h3>Test Details:</h3>
              <ul>
                <li><strong>Service:</strong> Nodemailer with Brevo SMTP</li>
                <li><strong>Host:</strong> smtp-relay.brevo.com</li>
                <li><strong>Port:</strong> 587</li>
                <li><strong>Sent at:</strong> ${new Date().toLocaleString()}</li>
              </ul>
            </div>
            <p style="color: #28a745; font-weight: bold;">✅ Email service is operational!</p>
          </div>
        `,
        `Email Service Test Successful!\n\nThis email confirms that the Nodemailer email service with Brevo SMTP is working correctly.\n\nTest Details:\n- Service: Nodemailer with Brevo SMTP\n- Host: smtp-relay.brevo.com\n- Port: 587\n- Sent at: ${new Date().toLocaleString()}\n\n✅ Email service is operational!`
      );

      if (result.success) {
        console.log('✅ Email sent successfully!');
        console.log(`Message ID: ${result.messageId}`);
        console.log(`Response: ${result.response}\n`);
      } else {
        console.log('❌ Email sending failed:', result.error);
        console.log('Details:', result.details, '\n');
      }
    }

    console.log('🏁 Email service test completed!');

  } catch (error) {
    console.error('❌ Test failed with error:', error.message);
  }
}

// Run the test
testEmailService();
