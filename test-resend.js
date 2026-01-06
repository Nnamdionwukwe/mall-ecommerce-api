// Run this with: node test-resend.js
// ================================================

require("dotenv").config();
const { Resend } = require("resend");

console.log("\n========================================");
console.log("📧 RESEND EMAIL TEST");
console.log("========================================\n");

// Check environment
console.log("🔍 Environment Check:");
console.log(
  "   RESEND_API_KEY:",
  process.env.RESEND_API_KEY ? "✅ LOADED" : "❌ NOT FOUND"
);
console.log("   Key Length:", process.env.RESEND_API_KEY?.length || 0);
console.log(
  "   Key Preview:",
  process.env.RESEND_API_KEY?.substring(0, 15) + "..." || "NONE"
);
console.log(
  "   FROM EMAIL:",
  process.env.RESEND_FROM_EMAIL || "onboarding@resend.dev"
);
console.log("");

if (!process.env.RESEND_API_KEY) {
  console.error("❌ ERROR: RESEND_API_KEY not found in environment variables!");
  console.error("\n💡 Make sure your .env file contains:");
  console.error("   RESEND_API_KEY=re_your_key_here");
  process.exit(1);
}

// Initialize Resend
console.log("🔄 Initializing Resend client...");
const resend = new Resend(process.env.RESEND_API_KEY);
console.log("✅ Resend client created\n");

// Test email data
const testEmail = {
  from: process.env.RESEND_FROM_EMAIL || "onboarding@resend.dev",
  to: "delivered@resend.dev", // Resend's test email that always works
  subject:
    "Test Email from Ochacho Pharmacy - " + new Date().toLocaleTimeString(),
  html: `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body {
          font-family: Arial, sans-serif;
          line-height: 1.6;
          color: #333;
          max-width: 600px;
          margin: 0 auto;
          padding: 20px;
        }
        .container {
          background: #f9f9f9;
          border-radius: 10px;
          padding: 30px;
          border: 2px solid #667eea;
        }
        .header {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          padding: 20px;
          border-radius: 5px;
          text-align: center;
          margin-bottom: 20px;
        }
        .success {
          background: #d1fae5;
          color: #065f46;
          padding: 15px;
          border-radius: 5px;
          margin: 20px 0;
          text-align: center;
          font-weight: bold;
        }
        .info {
          background: white;
          padding: 15px;
          border-radius: 5px;
          margin: 10px 0;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>🎉 Test Email Success!</h1>
        </div>
        
        <div class="success">
          ✅ Resend is configured correctly!
        </div>
        
        <div class="info">
          <p><strong>Sent at:</strong> ${new Date().toLocaleString()}</p>
          <p><strong>From:</strong> ${
            process.env.RESEND_FROM_EMAIL || "onboarding@resend.dev"
          }</p>
          <p><strong>Store:</strong> ${
            process.env.STORE_NAME || "Ochacho Pharmacy & SuperMarket"
          }</p>
        </div>
        
        <p>This is a test email from your e-commerce backend. If you're seeing this, your email system is working correctly!</p>
        
        <p><strong>What this means:</strong></p>
        <ul>
          <li>✅ Environment variables are loading correctly</li>
          <li>✅ Resend API key is valid</li>
          <li>✅ Email sending functionality is operational</li>
          <li>✅ Your backend can send order confirmations</li>
        </ul>
        
        <p style="margin-top: 30px; padding-top: 20px; border-top: 2px solid #ddd; text-align: center; color: #666;">
          <strong>Ochacho Pharmacy & SuperMarket</strong><br>
          Email Test System
        </p>
      </div>
    </body>
    </html>
  `,
};

// Send the test email
console.log("📨 Sending test email...");
console.log("   From:", testEmail.from);
console.log("   To:", testEmail.to);
console.log("   Subject:", testEmail.subject);
console.log("");

resend.emails
  .send(testEmail)
  .then((result) => {
    console.log("========================================");
    console.log("✅ SUCCESS! Email sent successfully!");
    console.log("========================================");
    console.log("\n📧 Email Details:");
    console.log("   Message ID:", result.id);
    console.log("   Status: Sent");
    console.log("\n💡 What to do next:");
    console.log("   1. Check the Resend dashboard: https://resend.com/emails");
    console.log("   2. Look for email ID:", result.id);
    console.log("   3. Your email system is working!");
    console.log("\n✅ You can now send emails from your order system!\n");
  })
  .catch((error) => {
    console.log("========================================");
    console.log("❌ ERROR! Failed to send email");
    console.log("========================================");
    console.error("\n📧 Error Details:");
    console.error("   Message:", error.message);
    console.error("   Name:", error.name);

    if (error.message.includes("API key")) {
      console.error("\n💡 Troubleshooting:");
      console.error("   - Your API key might be invalid");
      console.error("   - Check: https://resend.com/api-keys");
      console.error("   - Make sure you're using the correct key");
      console.error(
        "   - Current key preview:",
        process.env.RESEND_API_KEY.substring(0, 15) + "..."
      );
    }

    if (error.message.includes("email")) {
      console.error("\n💡 Troubleshooting:");
      console.error("   - Verify your 'from' email domain in Resend");
      console.error("   - Go to: https://resend.com/domains");
      console.error("   - Add and verify your domain");
    }

    console.error("\n");
    process.exit(1);
  });
