// FILE: services/emailService.js
// Bank Transfer Email Service
// ================================================

const nodemailer = require("nodemailer");
const {
  confirmationEmailTemplate,
  verificationEmailTemplate,
  reminderEmailTemplate,
} = require("../emails/templates/bankTransferTemplates");

// Initialize email transporter
const transporter = nodemailer.createTransport({
  service: process.env.EMAIL_SERVICE || "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD,
  },
});

// ✅ Send Bank Transfer Order Confirmation Email
const sendBankTransferConfirmationEmail = async ({
  email,
  fullName,
  orderId,
  total,
  items,
  shippingInfo,
  bankDetails,
}) => {
  try {
    console.log(`📧 Sending bank transfer confirmation email to ${email}`);

    const htmlContent = confirmationEmailTemplate({
      fullName,
      orderId,
      total,
      items,
      shippingInfo,
      bankDetails,
    });

    const mailOptions = {
      from: `Ochacho Pharmacy <${process.env.EMAIL_USER}>`,
      to: email,
      subject: `Order Confirmation - Bank Transfer Required [${orderId}]`,
      html: htmlContent,
      replyTo: process.env.SUPPORT_EMAIL || "support@ochacho.com",
    };

    const result = await transporter.sendMail(mailOptions);
    console.log(`✅ Confirmation email sent successfully to ${email}`);
    console.log("Message ID:", result.messageId);
    return result;
  } catch (error) {
    console.error(`❌ Error sending confirmation email to ${email}:`, error);
    throw error;
  }
};

// ✅ Send Bank Transfer Verification Email
const sendBankTransferVerificationEmail = async ({
  email,
  fullName,
  orderId,
  total,
  verifiedAmount,
  verifiedAt,
}) => {
  try {
    console.log(`📧 Sending bank transfer verification email to ${email}`);

    const htmlContent = verificationEmailTemplate({
      fullName,
      orderId,
      total,
      verifiedAmount,
      verifiedAt,
    });

    const mailOptions = {
      from: `Ochacho Pharmacy <${process.env.EMAIL_USER}>`,
      to: email,
      subject: `Payment Verified - Order ${orderId} Confirmed`,
      html: htmlContent,
      replyTo: process.env.SUPPORT_EMAIL || "support@ochacho.com",
    };

    const result = await transporter.sendMail(mailOptions);
    console.log(`✅ Verification email sent to ${email}`);
    return result;
  } catch (error) {
    console.error(`❌ Error sending verification email:`, error);
    throw error;
  }
};

// ✅ Send Bank Transfer Reminder Email
const sendBankTransferReminderEmail = async ({
  email,
  fullName,
  orderId,
  total,
  bankDetails,
  hoursRemaining,
}) => {
  try {
    console.log(`📧 Sending bank transfer reminder email to ${email}`);

    const htmlContent = reminderEmailTemplate({
      fullName,
      orderId,
      total,
      bankDetails,
      hoursRemaining,
    });

    const mailOptions = {
      from: `Ochacho Pharmacy <${process.env.EMAIL_USER}>`,
      to: email,
      subject: `Payment Reminder - Order ${orderId} (${hoursRemaining} hours remaining)`,
      html: htmlContent,
      replyTo: process.env.SUPPORT_EMAIL || "support@ochacho.com",
    };

    const result = await transporter.sendMail(mailOptions);
    console.log(`✅ Reminder email sent to ${email}`);
    return result;
  } catch (error) {
    console.error(`❌ Error sending reminder email:`, error);
    throw error;
  }
};

module.exports = {
  sendBankTransferConfirmationEmail,
  sendBankTransferVerificationEmail,
  sendBankTransferReminderEmail,
};
