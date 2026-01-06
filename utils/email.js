const { Resend } = require("resend");

// ================================================
// LAZY INITIALIZATION - Resend Client
// ================================================
let resendClient = null;

/**
 * Get or create Resend client instance (lazy initialization)
 * IMPORTANT: Always read from process.env at runtime, never cache
 */
function getResendClient() {
  // ALWAYS re-check process.env - don't trust cached values
  const apiKey = process.env.RESEND_API_KEY;

  // Debug logging
  console.log("\n🔍 [getResendClient] Checking environment...");
  console.log("   process.env keys:", Object.keys(process.env).length);
  console.log("   RESEND_API_KEY exists:", !!apiKey);

  if (apiKey) {
    console.log("   API Key length:", apiKey.length);
    console.log("   API Key preview:", apiKey.substring(0, 15) + "...");
  } else {
    console.log("   Checking all env keys with RESEND:");
    const resendKeys = Object.keys(process.env).filter((k) =>
      k.includes("RESEND")
    );
    console.log("   Found:", resendKeys.length > 0 ? resendKeys : "NONE");
  }

  if (!apiKey) {
    console.warn("⚠️  RESEND_API_KEY not found - email service disabled");
    return null;
  }

  // Create new client if needed
  if (!resendClient) {
    try {
      resendClient = new Resend(apiKey);
      console.log("✅ Resend email client initialized successfully\n");
    } catch (error) {
      console.error("❌ Failed to initialize Resend:", error.message);
      return null;
    }
  }

  return resendClient;
}

/**
 * Get store configuration from environment variables
 * Always read fresh from process.env
 */
function getStoreConfig() {
  return {
    STORE_NAME: process.env.STORE_NAME || "Ochacho Pharmacy & SuperMarket",
    STORE_EMAIL: process.env.RESEND_FROM_EMAIL || "onboarding@resend.dev",
    STORE_SUPPORT_EMAIL:
      process.env.STORE_SUPPORT_EMAIL || "ochachopharmacysupermarket@gmail.com",
    STORE_PHONE: process.env.STORE_PHONE || "+234-903-382-2884",
  };
}

// ================================================
// EMAIL TEMPLATE WRAPPER
// ================================================
function emailTemplate(content, headerColor = "#667eea") {
  const config = getStoreConfig();

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
          line-height: 1.6;
          color: #333;
          max-width: 600px;
          margin: 0 auto;
          padding: 20px;
          background-color: #f5f5f5;
        }
        .email-container {
          background: white;
          border-radius: 10px;
          overflow: hidden;
          box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        .header {
          background: ${headerColor};
          color: white;
          padding: 30px;
          text-align: center;
        }
        .header h1 {
          margin: 0;
          font-size: 24px;
        }
        .content {
          padding: 30px;
        }
        .footer {
          background: #f8f9fa;
          padding: 20px;
          text-align: center;
          font-size: 14px;
          color: #666;
          border-top: 1px solid #e0e0e0;
        }
        .button {
          display: inline-block;
          padding: 12px 30px;
          background: ${headerColor};
          color: white;
          text-decoration: none;
          border-radius: 5px;
          margin: 20px 0;
          font-weight: bold;
        }
        .info-box {
          background: #f8f9fa;
          padding: 20px;
          border-radius: 8px;
          margin: 20px 0;
          border-left: 4px solid ${headerColor};
        }
        .info-box p {
          margin: 8px 0;
        }
        .info-box strong {
          display: inline-block;
          width: 150px;
          color: ${headerColor};
        }
        .amount {
          font-size: 28px;
          color: ${headerColor};
          font-weight: bold;
          margin: 20px 0;
        }
        .warning-box {
          background: #fff3cd;
          border: 1px solid #ffc107;
          padding: 15px;
          border-radius: 5px;
          margin: 20px 0;
        }
        .success-badge {
          background: #d1fae5;
          color: #065f46;
          padding: 10px 20px;
          border-radius: 50px;
          display: inline-block;
          font-weight: bold;
          margin: 15px 0;
        }
        .order-items {
          margin: 20px 0;
        }
        .order-item {
          display: flex;
          padding: 15px;
          border-bottom: 1px solid #e0e0e0;
          align-items: center;
        }
        .order-item:last-child {
          border-bottom: none;
        }
        .item-image {
          width: 60px;
          height: 60px;
          object-fit: cover;
          border-radius: 5px;
          margin-right: 15px;
        }
        .item-details {
          flex: 1;
        }
        .item-name {
          font-weight: bold;
          margin-bottom: 5px;
        }
        .item-price {
          color: #666;
          font-size: 14px;
        }
        .totals {
          margin: 20px 0;
          padding: 15px;
          background: #f8f9fa;
          border-radius: 5px;
        }
        .total-row {
          display: flex;
          justify-content: space-between;
          margin: 8px 0;
        }
        .total-row.final {
          font-weight: bold;
          font-size: 18px;
          border-top: 2px solid #ddd;
          padding-top: 10px;
          margin-top: 10px;
        }
      </style>
    </head>
    <body>
      <div class="email-container">
        ${content}
        <div class="footer">
          <p><strong>${config.STORE_NAME}</strong></p>
          <p>Email: ${config.STORE_SUPPORT_EMAIL} | Phone: ${
    config.STORE_PHONE
  }</p>
          <p style="margin: 5px 0; font-size: 12px;">This is an automated email. Please do not reply directly.</p>
          <p style="margin: 5px 0;">© ${new Date().getFullYear()} ${
    config.STORE_NAME
  }. All rights reserved.</p>
        </div>
      </div>
    </body>
    </html>
  `;
}

// ================================================
// EMAIL FUNCTIONS
// ================================================

async function sendOrderConfirmationEmail({
  email,
  fullName,
  orderId,
  total,
  items = [],
  shippingInfo,
  paymentMethod = "Card Payment",
}) {
  console.log(
    `\n📧 [sendOrderConfirmationEmail] Attempting to send to: ${email}`
  );

  const resend = getResendClient();
  if (!resend) {
    console.log(
      "⚠️  Email service not configured, skipping order confirmation email"
    );
    return { success: false, message: "Email service not configured" };
  }

  const config = getStoreConfig();

  const itemsHtml = items
    .map(
      (item) => `
    <div class="order-item">
      ${
        item.image
          ? `<img src="${item.image}" alt="${item.name}" class="item-image">`
          : ""
      }
      <div class="item-details">
        <div class="item-name">${item.name}</div>
        <div class="item-price">Qty: ${
          item.quantity
        } × ₦${item.price.toLocaleString("en-NG", {
        minimumFractionDigits: 2,
      })}</div>
      </div>
      <div style="font-weight: bold;">₦${(
        item.price * item.quantity
      ).toLocaleString("en-NG", { minimumFractionDigits: 2 })}</div>
    </div>
  `
    )
    .join("");

  const content = `
    <div class="header">
      <h1>🎉 Order Confirmed!</h1>
      <p style="margin: 10px 0 0 0;">Order #${orderId}</p>
    </div>
    
    <div class="content">
      <p>Hi <strong>${fullName}</strong>,</p>
      
      <div class="success-badge">✓ Payment Confirmed</div>
      
      <p>Thank you for your order! Your payment has been successfully processed and your order is now being prepared.</p>
      
      <h3 style="color: #667eea; margin-top: 30px;">Order Summary</h3>
      <div class="order-items">
        ${itemsHtml}
      </div>
      
      <div class="totals">
        <div class="total-row">
          <span>Subtotal:</span>
          <span>₦${(total * 0.9).toLocaleString("en-NG", {
            minimumFractionDigits: 2,
          })}</span>
        </div>
        <div class="total-row">
          <span>Shipping:</span>
          <span>₦${(total > 100 ? 0 : 10).toLocaleString("en-NG", {
            minimumFractionDigits: 2,
          })}</span>
        </div>
        <div class="total-row">
          <span>Tax (10%):</span>
          <span>₦${(total * 0.1).toLocaleString("en-NG", {
            minimumFractionDigits: 2,
          })}</span>
        </div>
        <div class="total-row final">
          <span>Total:</span>
          <span>₦${total.toLocaleString("en-NG", {
            minimumFractionDigits: 2,
          })}</span>
        </div>
      </div>
      
      <div class="info-box">
        <h4 style="margin-top: 0; color: #667eea;">Shipping Address</h4>
        <p>${shippingInfo.fullName}</p>
        <p>${shippingInfo.address}</p>
        <p>${shippingInfo.city}, ${shippingInfo.state} ${
    shippingInfo.zipCode || ""
  }</p>
        <p>Phone: ${shippingInfo.phone}</p>
      </div>
      
      <div class="info-box">
        <p><strong>Payment Method:</strong> ${paymentMethod}</p>
        <p><strong>Payment Status:</strong> <span style="color: #10b981;">✓ Paid</span></p>
      </div>
      
      <h3 style="color: #667eea;">What's Next?</h3>
      <ul>
        <li>📦 Your order is being prepared</li>
        <li>🚚 You'll receive tracking details once shipped</li>
        <li>📧 We'll keep you updated via email</li>
        <li>💬 Contact us anytime for questions</li>
      </ul>
      
      <p style="margin-top: 30px;">Thank you for shopping with ${
        config.STORE_NAME
      }!</p>
    </div>
  `;

  try {
    const data = await resend.emails.send({
      from: config.STORE_EMAIL,
      to: email,
      subject: `✅ Order Confirmed - ${orderId}`,
      html: emailTemplate(content, "#667eea"),
    });

    console.log("✅ Order confirmation email sent:", data.id);
    return { success: true, messageId: data.id };
  } catch (error) {
    console.error("❌ Failed to send order confirmation email:", error.message);
    return { success: false, error: error.message };
  }
}

async function sendBankTransferConfirmationEmail({
  email,
  fullName,
  orderId,
  total,
  items = [],
  shippingInfo,
  bankDetails,
}) {
  console.log(
    `\n📧 [sendBankTransferConfirmationEmail] Attempting to send to: ${email}`
  );

  const resend = getResendClient();
  if (!resend) {
    console.log(
      "⚠️  Email service not configured, skipping bank transfer email"
    );
    return { success: false, message: "Email service not configured" };
  }

  const config = getStoreConfig();

  const itemsHtml = items
    .map(
      (item) => `
    <div class="order-item">
      <div class="item-details">
        <div class="item-name">${item.name}</div>
        <div class="item-price">Qty: ${
          item.quantity
        } × ₦${item.price.toLocaleString("en-NG", {
        minimumFractionDigits: 2,
      })}</div>
      </div>
      <div style="font-weight: bold;">₦${(
        item.price * item.quantity
      ).toLocaleString("en-NG", { minimumFractionDigits: 2 })}</div>
    </div>
  `
    )
    .join("");

  const content = `
    <div class="header" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);">
      <h1>💳 Order Confirmation</h1>
      <p style="margin: 10px 0 0 0;">Order #${orderId}</p>
    </div>
    
    <div class="content">
      <p>Hi <strong>${fullName}</strong>,</p>
      
      <p>Thank you for your order! Your order <strong>${orderId}</strong> has been created successfully.</p>
      
      <h2 style="color: #667eea; margin-top: 30px;">⏰ Payment Required</h2>
      <p>Please complete your payment by transferring the exact amount below:</p>
      
      <div class="amount">₦${total.toLocaleString("en-NG", {
        minimumFractionDigits: 2,
      })}</div>
      
      <div class="info-box">
        <h3 style="margin-top: 0; color: #667eea;">Bank Transfer Details</h3>
        <p><strong>Bank Name:</strong> ${bankDetails.bankName}</p>
        <p><strong>Account Name:</strong> ${bankDetails.accountName}</p>
        <p><strong>Account Number:</strong> ${bankDetails.accountNumber}</p>
        <p><strong>Reference/Narration:</strong> ${orderId}</p>
      </div>
      
      <div class="warning-box">
        <strong>⚠️ IMPORTANT:</strong> Please use <strong>${orderId}</strong> as your transfer reference/narration. This ensures your payment is verified quickly.
      </div>
      
      <h3 style="color: #667eea; margin-top: 30px;">Order Summary</h3>
      <div class="order-items">
        ${itemsHtml}
      </div>
      
      <div class="totals">
        <div class="total-row final">
          <span>Amount to Transfer:</span>
          <span>₦${total.toLocaleString("en-NG", {
            minimumFractionDigits: 2,
          })}</span>
        </div>
      </div>
      
      <div class="info-box">
        <h4 style="margin-top: 0; color: #667eea;">Delivery Address</h4>
        <p>${shippingInfo.fullName}</p>
        <p>${shippingInfo.address}</p>
        <p>${shippingInfo.city}, ${shippingInfo.state} ${
    shippingInfo.zipCode || ""
  }</p>
        <p>Phone: ${shippingInfo.phone}</p>
      </div>
      
      <h3 style="color: #667eea;">Next Steps:</h3>
      <ol>
        <li><strong>Transfer the exact amount</strong> (₦${total.toLocaleString(
          "en-NG"
        )}) to the account above</li>
        <li><strong>Use "${orderId}" as the transfer reference</strong></li>
        <li>Your payment will be <strong>verified within 2-4 hours</strong></li>
        <li>You'll receive a confirmation email once verified</li>
        <li>Your order will be processed and shipped</li>
      </ol>
      
      <div class="warning-box" style="background: #e3f2fd; border-color: #2196f3;">
        <strong>💡 Pro Tip:</strong> Keep your bank transfer receipt. You may need it if there are any verification issues.
      </div>
      
      <p style="margin-top: 30px;">If you have any questions or need assistance, please reply to this email or contact our support team.</p>
      
      <p>Thank you for shopping with ${config.STORE_NAME}!</p>
    </div>
  `;

  try {
    const data = await resend.emails.send({
      from: config.STORE_EMAIL,
      to: email,
      subject: `Payment Required - Order ${orderId}`,
      html: emailTemplate(content, "#667eea"),
    });

    console.log("✅ Bank transfer confirmation email sent:", data.id);
    return { success: true, messageId: data.id };
  } catch (error) {
    console.error("❌ Failed to send bank transfer email:", error.message);
    return { success: false, error: error.message };
  }
}

async function sendPaymentVerifiedEmail({ email, fullName, orderId, total }) {
  console.log(
    `\n📧 [sendPaymentVerifiedEmail] Attempting to send to: ${email}`
  );

  const resend = getResendClient();
  if (!resend) {
    console.log(
      "⚠️  Email service not configured, skipping payment verification email"
    );
    return { success: false, message: "Email service not configured" };
  }

  const config = getStoreConfig();

  const content = `
    <div class="header" style="background: linear-gradient(135deg, #10b981 0%, #059669 100%);">
      <h1>✅ Payment Verified!</h1>
    </div>
    
    <div class="content">
      <p>Hi <strong>${fullName}</strong>,</p>
      
      <div class="success-badge">✓ Payment Confirmed</div>
      
      <p>Great news! We've successfully verified your payment of <strong>₦${total.toLocaleString(
        "en-NG",
        { minimumFractionDigits: 2 }
      )}</strong> for order <strong>${orderId}</strong>.</p>
      
      <div class="info-box" style="border-left-color: #10b981;">
        <p><strong>Order ID:</strong> ${orderId}</p>
        <p><strong>Amount Paid:</strong> ₦${total.toLocaleString("en-NG", {
          minimumFractionDigits: 2,
        })}</p>
        <p><strong>Payment Status:</strong> <span style="color: #10b981;">✓ Verified</span></p>
        <p><strong>Order Status:</strong> <span style="color: #f59e0b;">⏳ Processing</span></p>
      </div>
      
      <h3 style="color: #10b981;">What's Next?</h3>
      <ul>
        <li>✅ Payment confirmed and recorded</li>
        <li>📦 Your order is now being processed</li>
        <li>🚚 You'll receive tracking details once shipped</li>
        <li>📧 We'll keep you updated via email</li>
      </ul>
      
      <div class="warning-box" style="background: #d1fae5; border-color: #10b981;">
        <strong>📦 Estimated Processing Time:</strong> Your order will be prepared and shipped within 1-2 business days.
      </div>
      
      <p style="margin-top: 30px;">Thank you for your patience and for shopping with ${
        config.STORE_NAME
      }!</p>
    </div>
  `;

  try {
    const data = await resend.emails.send({
      from: config.STORE_EMAIL,
      to: email,
      subject: `✅ Payment Confirmed - Order ${orderId}`,
      html: emailTemplate(content, "#10b981"),
    });

    console.log("✅ Payment verification email sent:", data.id);
    return { success: true, messageId: data.id };
  } catch (error) {
    console.error(
      "❌ Failed to send payment verification email:",
      error.message
    );
    return { success: false, error: error.message };
  }
}

async function sendOrderShippedEmail({
  email,
  fullName,
  orderId,
  trackingNumber,
  estimatedDelivery,
}) {
  console.log(`\n📧 [sendOrderShippedEmail] Attempting to send to: ${email}`);

  const resend = getResendClient();
  if (!resend) {
    console.log("⚠️  Email service not configured, skipping shipping email");
    return { success: false, message: "Email service not configured" };
  }

  const config = getStoreConfig();

  const deliveryDate = estimatedDelivery
    ? new Date(estimatedDelivery).toLocaleDateString("en-US", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : "To be confirmed";

  const content = `
    <div class="header" style="background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);">
      <h1>🚚 Your Order Has Shipped!</h1>
    </div>
    
    <div class="content">
      <p>Hi <strong>${fullName}</strong>,</p>
      
      <p>Exciting news! Your order <strong>${orderId}</strong> is on its way to you!</p>
      
      <div class="info-box" style="border-left-color: #3b82f6; background: #eff6ff;">
        <h3 style="margin-top: 0; color: #1e40af;">Tracking Information</h3>
        <p><strong>Tracking Number:</strong></p>
        <div style="font-size: 24px; font-weight: bold; color: #1e40af; margin: 10px 0;">${trackingNumber}</div>
        ${
          estimatedDelivery
            ? `<p><strong>Estimated Delivery:</strong> ${deliveryDate}</p>`
            : ""
        }
      </div>
      
      <div class="warning-box" style="background: #dbeafe; border-color: #3b82f6;">
        <strong>📝 Track Your Package:</strong> Use the tracking number above with your courier's tracking system to monitor your delivery in real-time.
      </div>
      
      <h3 style="color: #3b82f6;">Delivery Information</h3>
      <ul>
        <li>📦 Package has been dispatched</li>
        <li>🚚 In transit to your delivery address</li>
        <li>📱 Track your package with the number above</li>
        <li>🏠 Estimated delivery: ${deliveryDate}</li>
      </ul>
      
      <div class="info-box">
        <h4 style="margin-top: 0; color: #3b82f6;">Need Help?</h4>
        <p>If you have any questions about your delivery or need to make changes to your delivery address, please contact us immediately.</p>
        <p><strong>Email:</strong> ${config.STORE_SUPPORT_EMAIL}</p>
        <p><strong>Phone:</strong> ${config.STORE_PHONE}</p>
      </div>
      
      <p style="margin-top: 30px;">Thank you for shopping with ${
        config.STORE_NAME
      }. We hope you love your order!</p>
    </div>
  `;

  try {
    const data = await resend.emails.send({
      from: config.STORE_EMAIL,
      to: email,
      subject: `🚚 Order ${orderId} Has Shipped - Track Your Package`,
      html: emailTemplate(content, "#3b82f6"),
    });

    console.log("✅ Shipping notification email sent:", data.id);
    return { success: true, messageId: data.id };
  } catch (error) {
    console.error("❌ Failed to send shipping email:", error.message);
    return { success: false, error: error.message };
  }
}

async function sendOrderDeliveredEmail({ email, fullName, orderId }) {
  console.log(`\n📧 [sendOrderDeliveredEmail] Attempting to send to: ${email}`);

  const resend = getResendClient();
  if (!resend) {
    console.log("⚠️  Email service not configured, skipping delivery email");
    return { success: false, message: "Email service not configured" };
  }

  const config = getStoreConfig();

  const content = `
    <div class="header" style="background: linear-gradient(135deg, #10b981 0%, #059669 100%);">
      <h1>🎉 Order Delivered!</h1>
    </div>
    
    <div class="content">
      <p>Hi <strong>${fullName}</strong>,</p>
      
      <div class="success-badge">✓ Delivered Successfully</div>
      
      <p>Your order <strong>${orderId}</strong> has been successfully delivered!</p>
      
      <div class="info-box" style="border-left-color: #10b981;">
        <p>We hope you're satisfied with your purchase. Your satisfaction is our top priority!</p>
      </div>
      
      <h3 style="color: #10b981;">Rate Your Experience</h3>
      <p>We'd love to hear about your shopping experience. Your feedback helps us improve!</p>
      
      <div style="text-align: center; margin: 30px 0;">
        <a href="#" class="button" style="background: #10b981;">Leave a Review</a>
      </div>
      
      <h3 style="color: #10b981;">Need Support?</h3>
      <p>If you have any issues with your order, please don't hesitate to contact us:</p>
      <ul>
        <li>📧 Email: ${config.STORE_SUPPORT_EMAIL}</li>
        <li>📱 Phone: ${config.STORE_PHONE}</li>
      </ul>
      
      <p style="margin-top: 30px;">Thank you for choosing ${config.STORE_NAME}. We look forward to serving you again!</p>
    </div>
  `;

  try {
    const data = await resend.emails.send({
      from: config.STORE_EMAIL,
      to: email,
      subject: `🎉 Order ${orderId} Delivered - Rate Your Experience`,
      html: emailTemplate(content, "#10b981"),
    });

    console.log("✅ Delivery confirmation email sent:", data.id);
    return { success: true, messageId: data.id };
  } catch (error) {
    console.error("❌ Failed to send delivery email:", error.message);
    return { success: false, error: error.message };
  }
}

async function sendOrderCancelledEmail({ email, fullName, orderId, reason }) {
  console.log(`\n📧 [sendOrderCancelledEmail] Attempting to send to: ${email}`);

  const resend = getResendClient();
  if (!resend) {
    console.log(
      "⚠️  Email service not configured, skipping cancellation email"
    );
    return { success: false, message: "Email service not configured" };
  }

  const config = getStoreConfig();

  const content = `
    <div class="header" style="background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);">
      <h1>Order Cancelled</h1>
    </div>
    
    <div class="content">
      <p>Hi <strong>${fullName}</strong>,</p>
      
      <p>Your order <strong>${orderId}</strong> has been cancelled.</p>
      
      ${
        reason
          ? `
        <div class="info-box" style="border-left-color: #ef4444;">
          <p><strong>Cancellation Reason:</strong></p>
          <p>${reason}</p>
        </div>
      `
          : ""
      }
      
      <div class="warning-box" style="background: #fee2e2; border-color: #ef4444;">
        <strong>💰 Refund Information:</strong> If you've already made a payment, your refund will be processed within 5-7 business days.
      </div>
      
      <p>We're sorry to see this order cancelled. If you have any questions or if there's anything we can do to help, please don't hesitate to contact us.</p>
      
      <div style="text-align: center; margin: 30px 0;">
        <a href="#" class="button" style="background: #667eea;">Continue Shopping</a>
      </div>
      
      <p style="margin-top: 30px;">We hope to serve you again soon!</p>
    </div>
  `;

  try {
    const data = await resend.emails.send({
      from: config.STORE_EMAIL,
      to: email,
      subject: `Order ${orderId} Cancelled`,
      html: emailTemplate(content, "#ef4444"),
    });

    console.log("✅ Cancellation email sent:", data.id);
    return { success: true, messageId: data.id };
  } catch (error) {
    console.error("❌ Failed to send cancellation email:", error.message);
    return { success: false, error: error.message };
  }
}

module.exports = {
  sendOrderConfirmationEmail,
  sendBankTransferConfirmationEmail,
  sendPaymentVerifiedEmail,
  sendOrderShippedEmail,
  sendOrderDeliveredEmail,
  sendOrderCancelledEmail,
};
