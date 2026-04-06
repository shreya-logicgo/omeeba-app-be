import { sendEmail } from './src/services/emailService.js';

// Set environment variables for testing
process.env.BREVO_SMTP_LOGIN = 'a631b2001@smtp-brevo.com';
process.env.BREVO_SMTP_PASSWORD = 'V1Lt6JxCOGF0Nkp9';
process.env.FROM_EMAIL = 'noreply@omeeba.co.in';

async function testEnvEmail() {
  console.log('🚀 Testing Email Service with Environment Variables...\n');

  try {
    console.log('📧 Environment Variables:');
    console.log('BREVO_SMTP_LOGIN:', process.env.BREVO_SMTP_LOGIN);
    console.log('BREVO_SMTP_PASSWORD configured:', !!process.env.BREVO_SMTP_PASSWORD);
    console.log('FROM_EMAIL:', process.env.FROM_EMAIL);
    console.log('');

    const result = await sendEmail(
      'harsh.logicgo6@gmail.com',
      'Test Email with Environment Variables',
      `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #28a745;">✅ Environment Variables Test!</h2>
          <p>This email confirms that the email service is working with environment variables.</p>
          <div style="background-color: #f8f9fa; padding: 20px; border-radius: 5px; margin: 20px 0;">
            <h3>Test Details:</h3>
            <ul>
              <li><strong>Method:</strong> Environment Variables</li>
              <li><strong>SMTP Login:</strong> ${process.env.BREVO_SMTP_LOGIN}</li>
              <li><strong>From Email:</strong> ${process.env.FROM_EMAIL}</li>
              <li><strong>Sent at:</strong> ${new Date().toLocaleString()}</li>
            </ul>
          </div>
          <p style="color: #28a745; font-weight: bold;">✅ Environment variables are working correctly!</p>
        </div>
      `,
      `Environment Variables Test!\n\nThis email confirms that the email service is working with environment variables.\n\nTest Details:\n- Method: Environment Variables\n- SMTP Login: ${process.env.BREVO_SMTP_LOGIN}\n- From Email: ${process.env.FROM_EMAIL}\n- Sent at: ${new Date().toLocaleString()}\n\n✅ Environment variables are working correctly!`
    );

    if (result.success) {
      console.log('✅ Email sent successfully with environment variables!');
      console.log(`Message ID: ${result.messageId}`);
      console.log(`Response: ${result.response}`);
    } else {
      console.log('❌ Email sending failed:', result.error);
    }

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testEnvEmail();
