// Email HTML Templates with CSS
// ================================================

const emailStyles = require("./emailStyles");

// ✅ Confirmation Email Template
const confirmationEmailTemplate = ({
  fullName,
  orderId,
  total,
  items,
  shippingInfo,
  bankDetails,
}) => {
  const itemsList = items
    .map(
      (item) =>
        `
        <tr style="${emailStyles.tableRow}">
          <td style="${emailStyles.tableCell}">${item.name}</td>
          <td style="${emailStyles.tableCell} text-align: right;">Qty: ${
          item.quantity
        }</td>
          <td style="${
            emailStyles.tableCell
          } text-align: right;">₦${item.price.toLocaleString()}</td>
          <td style="${
            emailStyles.tableCell
          } text-align: right; font-weight: bold;">₦${(
          item.quantity * item.price
        ).toLocaleString()}</td>
        </tr>
      `
    )
    .join("");

  const subtotal = total * 0.9;
  const shipping = total > 100 * 0.9 ? 0 : 10;
  const tax = total * 0.1;

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Order Confirmation - Bank Transfer Required</title>
        <style>
          ${emailStyles.global}
        </style>
      </head>
      <body>
        <div style="${emailStyles.container}">
          <!-- Header -->
          <div style="${emailStyles.header}">
            <h1 style="${emailStyles.headerTitle}">🏦 Order Confirmation</h1>
            <p style="${
              emailStyles.headerSubtitle
            }">Bank Transfer Payment Required</p>
          </div>

          <!-- Main Content -->
          <div style="${emailStyles.content}">
            <p style="${
              emailStyles.greeting
            }">Hi <strong>${fullName}</strong>,</p>
            <p style="${
              emailStyles.text
            }">Thank you for your order! We're excited to process it. To complete your order, please transfer the amount below to our bank account within 24 hours.</p>

            <!-- Order Information -->
            <div style="${emailStyles.section}">
              <div style="${emailStyles.sectionTitle}">📋 Order Details</div>
              <div style="${emailStyles.infoBox}">
                <div style="${emailStyles.infoItem}">
                  <span style="${emailStyles.infoLabel}">Order ID:</span>
                  <span style="${
                    emailStyles.infoValue
                  }"><strong>${orderId}</strong></span>
                </div>
                <div style="${emailStyles.infoItem}">
                  <span style="${emailStyles.infoLabel}">Order Date:</span>
                  <span style="${
                    emailStyles.infoValue
                  }">${new Date().toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })}</span>
                </div>
                <div style="${emailStyles.infoItem}">
                  <span style="${emailStyles.infoLabel}">Payment Method:</span>
                  <span style="${emailStyles.infoValue}">Bank Transfer</span>
                </div>
              </div>
            </div>

            <!-- Items Table -->
            <div style="${emailStyles.section}">
              <div style="${emailStyles.sectionTitle}">🛍️ Order Items</div>
              <table style="${emailStyles.table}">
                <thead>
                  <tr>
                    <th style="${emailStyles.tableHeader}">Product</th>
                    <th style="${emailStyles.tableHeader}">Quantity</th>
                    <th style="${emailStyles.tableHeader}">Price</th>
                    <th style="${emailStyles.tableHeader}">Total</th>
                  </tr>
                </thead>
                <tbody>
                  ${itemsList}
                </tbody>
              </table>
            </div>

            <!-- Pricing Summary -->
            <div style="${emailStyles.section}">
              <div style="${emailStyles.sectionTitle}">💰 Pricing Summary</div>
              <div style="${emailStyles.pricingTable}">
                <div style="${emailStyles.pricingRow}">
                  <span>Subtotal:</span>
                  <span>₦${subtotal.toLocaleString()}</span>
                </div>
                <div style="${emailStyles.pricingRow}">
                  <span>Shipping:</span>
                  <span>₦${shipping.toLocaleString()}</span>
                </div>
                <div style="${emailStyles.pricingRow}">
                  <span>Tax (10%):</span>
                  <span>₦${tax.toLocaleString()}</span>
                </div>
                <div style="${emailStyles.pricingRowTotal}">
                  <span>Total Amount to Pay:</span>
                  <span>₦${total.toLocaleString()}</span>
                </div>
              </div>
              <div style="${
                emailStyles.amountHighlight
              }">₦${total.toLocaleString()}</div>
            </div>

            <!-- Bank Transfer Instructions -->
            <div style="${emailStyles.section}">
              <div style="${
                emailStyles.sectionTitle
              }">🏦 Bank Transfer Details</div>
              <p style="${
                emailStyles.text
              }">Please transfer the exact amount to the account below. Use your Order ID as the transfer reference.</p>
              <div style="${emailStyles.bankBox}">
                <div style="${emailStyles.bankDetail}">
                  <span style="${emailStyles.bankLabel}">Bank Name:</span>
                  <span style="${emailStyles.bankValue}">${
    bankDetails.bankName
  }</span>
                </div>
                <div style="${emailStyles.bankDetail}">
                  <span style="${emailStyles.bankLabel}">Account Name:</span>
                  <span style="${emailStyles.bankValue}">${
    bankDetails.accountName
  }</span>
                </div>
                <div style="${emailStyles.bankDetail}">
                  <span style="${emailStyles.bankLabel}">Account Number:</span>
                  <span style="${emailStyles.bankValue}">${
    bankDetails.accountNumber
  }</span>
                </div>
                <div style="${emailStyles.bankDetail}">
                  <span style="${emailStyles.bankLabel}">Amount:</span>
                  <span style="${
                    emailStyles.bankValue
                  }">₦${total.toLocaleString()}</span>
                </div>
                <div style="${emailStyles.bankDetail}">
                  <span style="${emailStyles.bankLabel}">Reference:</span>
                  <span style="${emailStyles.bankValue}">${orderId}</span>
                </div>
              </div>
            </div>

            <!-- Important Information -->
            <div style="${emailStyles.warningBox}">
              <div style="${
                emailStyles.warningTitle
              }">📌 Important Information</div>
              <div style="${
                emailStyles.warningText
              }">✓ Please use your Order ID (${orderId}) as the transfer reference for tracking purposes</div>
              <div style="${
                emailStyles.warningText
              }">✓ Your order will be confirmed within 2-4 hours after we receive your payment</div>
              <div style="${
                emailStyles.warningText
              }">✓ Once verified, we'll send you a shipping confirmation with tracking details</div>
              <div style="${
                emailStyles.warningText
              }">✓ Keep your proof of transfer for your records</div>
              <div style="${
                emailStyles.warningText
              }">⏰ Payment must be received within 24 hours to maintain your order</div>
            </div>

            <!-- Shipping Information -->
            <div style="${emailStyles.section}">
              <div style="${
                emailStyles.sectionTitle
              }">📍 Delivery Information</div>
              <div style="${emailStyles.shippingInfo}">
                <div style="${emailStyles.shippingInfoTitle}">Shipping To:</div>
                <div style="${emailStyles.shippingInfoItem}">${
    shippingInfo.fullName
  }</div>
                <div style="${emailStyles.shippingInfoItem}">${
    shippingInfo.address
  }</div>
                <div style="${emailStyles.shippingInfoItem}">${
    shippingInfo.city
  }, ${shippingInfo.state} ${shippingInfo.zipCode}</div>
                <div style="${
                  emailStyles.shippingInfoItem
                }"><strong>Phone:</strong> ${shippingInfo.phone}</div>
              </div>
            </div>

            <!-- Support -->
            <div style="${emailStyles.section}">
              <p style="${
                emailStyles.supportText
              }"><strong>Need help?</strong> If you have any questions about your order or payment, please contact our support team at <a href="mailto:${
    process.env.SUPPORT_EMAIL || "support@ochacho.com"
  }" style="${emailStyles.link}">${
    process.env.SUPPORT_EMAIL || "support@ochacho.com"
  }</a></p>
            </div>
          </div>

          <!-- Footer -->
          <div style="${emailStyles.footer}">
            <p>© ${new Date().getFullYear()} Ochacho Pharmacy/Supermarket. All rights reserved.</p>
            <p><a href="${
              process.env.CLIENT_URL || "https://localhost:3000"
            }/privacy-policy" style="${
    emailStyles.link
  }">Privacy Policy</a> | <a href="${
    process.env.CLIENT_URL || "https://localhost:3000"
  }/terms" style="${emailStyles.link}">Terms of Service</a></p>
            <p>Thank you for shopping with us!</p>
          </div>
        </div>
      </body>
    </html>
  `;
};

// ✅ Verification Email Template
const verificationEmailTemplate = ({
  fullName,
  orderId,
  total,
  verifiedAmount,
  verifiedAt,
}) => {
  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Payment Verified - Order Confirmation</title>
        <style>
          ${emailStyles.global}
          ${emailStyles.successHeader}
        </style>
      </head>
      <body>
        <div style="${emailStyles.container}">
          <div style="${emailStyles.headerSuccess}">
            <h1 style="${emailStyles.headerTitle}">✅ Payment Verified!</h1>
          </div>

          <div style="${emailStyles.content}">
            <p style="${emailStyles.text}">Hi <strong>${fullName}</strong>,</p>
            <p style="${
              emailStyles.text
            }">Great news! We have successfully received and verified your bank transfer payment for order <strong>${orderId}</strong>.</p>

            <div style="${emailStyles.successBox}">
              <h2 style="${
                emailStyles.successBoxTitle
              }">✅ Payment Confirmed</h2>
              <p style="${
                emailStyles.text
              }">Your order is now being prepared for shipment.</p>
            </div>

            <div style="${emailStyles.infoBox}">
              <div style="${emailStyles.infoItem}">
                <span style="${emailStyles.infoLabel}">Order ID:</span>
                <span style="${emailStyles.infoValue}">${orderId}</span>
              </div>
              <div style="${emailStyles.infoItem}">
                <span style="${emailStyles.infoLabel}">Amount Verified:</span>
                <span style="${
                  emailStyles.infoValue
                }">₦${verifiedAmount.toLocaleString()}</span>
              </div>
              <div style="${emailStyles.infoItem}">
                <span style="${emailStyles.infoLabel}">Verification Date:</span>
                <span style="${emailStyles.infoValue}">${new Date(
    verifiedAt
  ).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })}</span>
              </div>
              <div style="${emailStyles.infoItem}">
                <span style="${emailStyles.infoLabel}">Status:</span>
                <span style="color: #10b981; font-weight: bold;">Paid ✓</span>
              </div>
            </div>

            <p style="${
              emailStyles.text
            }"><strong>What's next?</strong> We're preparing your order for shipment. You'll receive a shipping confirmation email with tracking details within 24 hours.</p>

            <p style="${emailStyles.text}">Thank you for your purchase!</p>
          </div>

          <div style="${emailStyles.footer}">
            <p>© ${new Date().getFullYear()} Ochacho Pharmacy/Supermarket</p>
            <p>Thank you for shopping with us!</p>
          </div>
        </div>
      </body>
    </html>
  `;
};

// ✅ Reminder Email Template
const reminderEmailTemplate = ({
  fullName,
  orderId,
  total,
  bankDetails,
  hoursRemaining,
}) => {
  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <title>Payment Reminder - Order ${orderId}</title>
        <style>
          ${emailStyles.global}
          ${emailStyles.warningHeader}
        </style>
      </head>
      <body>
        <div style="${emailStyles.container}">
          <div style="${emailStyles.headerWarning}">
            <h1 style="${emailStyles.headerTitle}">⏰ Payment Reminder</h1>
          </div>

          <div style="${emailStyles.content}">
            <p style="${emailStyles.text}">Hi <strong>${fullName}</strong>,</p>
            <p style="${
              emailStyles.text
            }">This is a friendly reminder that we haven't received your bank transfer payment for order <strong>${orderId}</strong> yet.</p>

            <div style="${emailStyles.warningBox}">
              <p style="font-weight: bold; color: #92400e; margin: 0;"><strong>⏳ Time Remaining: ${hoursRemaining} hours</strong></p>
              <p style="color: #92400e; margin: 10px 0 0 0;">Please complete your payment soon to avoid order cancellation.</p>
            </div>

            <p style="${emailStyles.text}"><strong>Amount to Pay:</strong></p>
            <div style="${
              emailStyles.amountHighlight
            }">₦${total.toLocaleString()}</div>

            <p style="${emailStyles.text}"><strong>Bank Details:</strong></p>
            <div style="${emailStyles.bankBox}">
              <div style="${emailStyles.bankDetail}">
                <span style="${emailStyles.bankLabel}">Bank:</span>
                <span style="${emailStyles.bankValue}">${
    bankDetails.bankName
  }</span>
              </div>
              <div style="${emailStyles.bankDetail}">
                <span style="${emailStyles.bankLabel}">Account:</span>
                <span style="${emailStyles.bankValue}">${
    bankDetails.accountName
  }</span>
              </div>
              <div style="${emailStyles.bankDetail}">
                <span style="${emailStyles.bankLabel}">Account Number:</span>
                <span style="${emailStyles.bankValue}"><strong>${
    bankDetails.accountNumber
  }</strong></span>
              </div>
              <div style="${emailStyles.bankDetail}">
                <span style="${emailStyles.bankLabel}">Reference:</span>
                <span style="${
                  emailStyles.bankValue
                }"><strong>${orderId}</strong></span>
              </div>
            </div>

            <p style="${
              emailStyles.supportText
            }">Once you've completed the transfer, it may take 2-4 hours for us to verify and confirm your payment.</p>
          </div>

          <div style="${emailStyles.footer}">
            <p>© ${new Date().getFullYear()} Ochacho Pharmacy/Supermarket</p>
          </div>
        </div>
      </body>
    </html>
  `;
};

module.exports = {
  confirmationEmailTemplate,
  verificationEmailTemplate,
  reminderEmailTemplate,
};
