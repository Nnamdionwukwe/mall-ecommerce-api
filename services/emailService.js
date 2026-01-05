const nodemailer = require("nodemailer");

// Initialize email transporter
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD,
  },
});

// Test connection on startup
transporter.verify((error, success) => {
  if (error) {
    console.error("❌ Email error:", error);
  } else {
    console.log("✅ Email service ready");
  }
});

// ✅ Send Order Confirmation
const sendOrderConfirmationEmail = async ({
  email,
  fullName,
  orderId,
  total,
  items,
  shippingInfo,
}) => {
  try {
    // Format items for email
    const itemsList = items
      .map(
        (item) =>
          `<tr style="border-bottom: 1px solid #ddd;">
            <td style="padding: 10px;">${item.name}</td>
            <td style="padding: 10px; text-align: right;">${item.quantity}</td>
            <td style="padding: 10px; text-align: right;">₦${item.price.toLocaleString()}</td>
            <td style="padding: 10px; text-align: right;">₦${(
              item.quantity * item.price
            ).toLocaleString()}</td>
          </tr>`
      )
      .join("");

    // Email HTML template
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #f9f9f9; padding: 20px;">
        
        <!-- Header -->
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0;">
          <h1 style="margin: 0; font-size: 24px;">✅ Order Confirmed!</h1>
          <p style="margin: 10px 0 0 0; opacity: 0.9;">Payment Received Successfully</p>
        </div>

        <!-- Content -->
        <div style="background: white; padding: 30px; border-radius: 0 0 8px 8px;">
          <p>Hi <strong>${fullName}</strong>,</p>
          
          <p>Thank you for your order! Your payment has been received and is being processed.</p>

          <!-- Order ID -->
          <div style="background: #f0f0f0; padding: 15px; border-radius: 5px; margin: 20px 0;">
            <p style="margin: 0;"><strong>Order ID:</strong> ${orderId}</p>
            <p style="margin: 10px 0 0 0;"><strong>Order Date:</strong> ${new Date().toLocaleDateString()}</p>
            <p style="margin: 10px 0 0 0;"><strong>Status:</strong> <span style="color: #10b981;">Paid ✓</span></p>
          </div>

          <!-- Items Table -->
          <h2 style="font-size: 16px; margin-top: 20px; margin-bottom: 10px;">Order Items:</h2>
          <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
            <tr style="background: #f0f0f0;">
              <th style="padding: 10px; text-align: left;">Product</th>
              <th style="padding: 10px; text-align: right;">Qty</th>
              <th style="padding: 10px; text-align: right;">Price</th>
              <th style="padding: 10px; text-align: right;">Total</th>
            </tr>
            ${itemsList}
          </table>

          <!-- Total -->
          <div style="background: #ecfdf5; border: 2px solid #10b981; padding: 15px; border-radius: 5px; text-align: center; margin-bottom: 20px;">
            <p style="margin: 0; font-size: 24px; font-weight: bold; color: #10b981;">₦${total.toLocaleString()}</p>
          </div>

          <!-- Shipping Info -->
          <h2 style="font-size: 16px; margin-top: 20px; margin-bottom: 10px;">Shipping To:</h2>
          <div style="background: #f0f0f0; padding: 15px; border-radius: 5px; margin-bottom: 20px;">
            <p style="margin: 5px 0;"><strong>${
              shippingInfo.fullName
            }</strong></p>
            <p style="margin: 5px 0;">${shippingInfo.address}</p>
            <p style="margin: 5px 0;">${shippingInfo.city}, ${
      shippingInfo.state
    }</p>
            <p style="margin: 5px 0;"><strong>Phone:</strong> ${
              shippingInfo.phone
            }</p>
          </div>

          <!-- What's Next -->
          <div style="background: #ecfdf5; border-left: 4px solid #10b981; padding: 15px; margin-bottom: 20px;">
            <p style="margin: 0;"><strong>What's Next?</strong> Your order is being prepared for shipment. You'll receive a shipping confirmation with tracking details within 24 hours.</p>
          </div>

          <!-- Support -->
          <p style="font-size: 14px; color: #666;">
            <strong>Need help?</strong> Contact us at 
            <a href="mailto:support@ochacho.com" style="color: #667eea; text-decoration: none;">support@ochacho.com</a>
          </p>
        </div>

        <!-- Footer -->
        <div style="text-align: center; padding: 20px; font-size: 12px; color: #999;">
          <p>© ${new Date().getFullYear()} Ochacho Pharmacy. All rights reserved.</p>
          <p>Thank you for shopping with us!</p>
        </div>
      </div>
    `;

    // Send email
    const result = await transporter.sendMail({
      from: `"Ochacho Pharmacy" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: `Order Confirmation - ${orderId}`,
      html: html,
    });

    console.log(`✅ Order confirmation sent to ${email}`);
    return result;
  } catch (error) {
    console.error("❌ Email error:", error);
    // Don't throw - let order complete even if email fails
    return null;
  }
};

module.exports = { sendOrderConfirmationEmail, transporter };

// ================================================
// IN YOUR orders.js - AFTER ORDER CREATION
// ================================================

/*
const { sendOrderConfirmationEmail } = require("../services/emailService");

router.post("/verify-payment", auth, async (req, res) => {
  try {
    // ... your existing code ...

    // After saving order
    await order.save();

    // ✅ SEND EMAIL
    try {
      await sendOrderConfirmationEmail({
        email: shippingInfo.email,
        fullName: shippingInfo.fullName,
        orderId: order.orderId,
        total: order.pricing.total,
        items: orderItems,
        shippingInfo: order.shippingInfo,
      });
    } catch (emailErr) {
      console.warn("Email failed:", emailErr.message);
    }

    res.status(201).json({
      success: true,
      message: "Order created successfully",
      data: { ... },
    });
  } catch (error) {
    // ... error handling ...
  }
});
*/

// ================================================
// ADD TO YOUR .env FILE
// ================================================

/*
EMAIL_SERVICE=gmail
EMAIL_USER=your-email@gmail.com
EMAIL_PASSWORD=your-app-password

SUPPORT_EMAIL=support@ochacho.com
CLIENT_URL=http://localhost:3000
*/

// ================================================
// INSTALL REQUIRED PACKAGE
// ================================================

/*
npm install nodemailer
*/

// ================================================
// TEST YOUR EMAIL (Optional Route)
// ================================================

/*
router.post("/test-email", auth, isAdmin, async (req, res) => {
  const { sendOrderConfirmationEmail } = require("../services/emailService");

  try {
    await sendOrderConfirmationEmail({
      email: "test@example.com",
      fullName: "Test User",
      orderId: "TEST-001",
      total: 50000,
      items: [
        { name: "Test Product", quantity: 1, price: 50000 },
      ],
      shippingInfo: {
        fullName: "Test User",
        address: "123 Test Street",
        city: "Lagos",
        state: "Lagos",
        phone: "08012345678",
      },
    });

    res.json({ success: true, message: "Test email sent!" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
*/
