const nodemailer = require('nodemailer');

let transporter = null;

const getTransporter = () => {
  if (transporter) return transporter;
  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: String(process.env.SMTP_SECURE || 'false') === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
  return transporter;
};

const sendOtpEmail = async (toEmail, otp) => {
  const from = process.env.SMTP_FROM || 'RabsConnect <no-reply@rabsconnect.in>';
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 24px; background: #f5f7fb;">
      <div style="background: #ffffff; border-radius: 12px; padding: 32px; box-shadow: 0 2px 6px rgba(0,0,0,0.05);">
        <h2 style="color: #1a202c; margin: 0 0 8px;">Password Reset Request</h2>
        <p style="color: #4a5568; font-size: 14px; line-height: 22px;">
          We received a request to reset your RabsConnect password. Use the verification code below to continue:
        </p>
        <div style="text-align: center; margin: 28px 0;">
          <div style="display: inline-block; background: #D4A01715; padding: 16px 32px; border-radius: 12px; border: 2px dashed #D4A017;">
            <span style="font-size: 32px; font-weight: 800; letter-spacing: 8px; color: #D4A017;">${otp}</span>
          </div>
        </div>
        <p style="color: #718096; font-size: 12px; text-align: center;">
          This code will expire in <strong>10 minutes</strong>.
        </p>
        <p style="color: #718096; font-size: 12px; text-align: center; margin-top: 16px;">
          If you didn't request a password reset, you can safely ignore this email.
        </p>
      </div>
      <p style="text-align: center; color: #a0aec0; font-size: 11px; margin-top: 20px;">
        © ${new Date().getFullYear()} RabsConnect. All rights reserved.
      </p>
    </div>
  `;
  await getTransporter().sendMail({
    from,
    to: toEmail,
    subject: 'Your RabsConnect Password Reset Code',
    html,
    text: `Your RabsConnect password reset code is: ${otp}\n\nThis code expires in 10 minutes.`,
  });
};

module.exports = {sendOtpEmail};
