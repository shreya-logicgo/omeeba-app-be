export const contactEmailTemplate = ({ name, subject, message }) => `
  <div style="font-family: Arial, sans-serif; max-width: 640px; margin: 0 auto; color: #1f2937;">
    <h2>Hello ${name},</h2>
    <p>Thank you for contacting our support team. We have received your request.</p>

    <div style="background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 14px; margin: 16px 0;">
      <p><strong>Subject:</strong> ${subject}</p>
      <p><strong>Message:</strong> ${message}</p>
    </div>

    <p>Our support team typically responds within 24-48 hours.</p>
    <p>Regards,<br/>Omeeba Support Team</p>

    <hr style="border: 0; border-top: 1px solid #e5e7eb; margin: 20px 0;" />
    <p style="font-size: 12px; color: #6b7280;">This is an automated email from Omeeba Support.</p>
  </div>
`;

export default contactEmailTemplate;