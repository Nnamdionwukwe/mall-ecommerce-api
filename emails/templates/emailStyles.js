// Centralized Email CSS Styles
// ================================================

const emailStyles = {
  // Base styles
  global: `
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', sans-serif;
      line-height: 1.6;
      color: #374151;
      background-color: #f9fafb;
      margin: 0;
      padding: 0;
    }
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
  `,

  // Container
  container: `
    max-width: 600px;
    margin: 20px auto;
    background-color: white;
    border-radius: 8px;
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
    overflow: hidden;
  `,

  // Header styles
  header: `
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    padding: 40px 20px;
    text-align: center;
  `,

  headerTitle: `
    margin: 0;
    font-size: 28px;
    font-weight: bold;
  `,

  headerSubtitle: `
    margin: 10px 0 0 0;
    opacity: 0.9;
  `,

  headerSuccess: `
    background: linear-gradient(135deg, #10b981 0%, #059669 100%);
    color: white;
    padding: 40px 20px;
    text-align: center;
  `,

  headerWarning: `
    background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
    color: white;
    padding: 40px 20px;
    text-align: center;
  `,

  successHeader: `
    .success-box {
      background-color: #ecfdf5;
      border: 2px solid #10b981;
      border-radius: 8px;
      padding: 20px;
      margin-bottom: 20px;
      text-align: center;
    }
    .success-box h2 {
      color: #059669;
      margin-top: 0;
      margin-bottom: 10px;
    }
  `,

  warningHeader: `
    .warning-box {
      background-color: #fffbeb;
      border-left: 4px solid #f59e0b;
      padding: 15px;
      border-radius: 4px;
      margin-bottom: 20px;
    }
  `,

  // Content area
  content: `
    padding: 40px 30px;
  `,

  text: `
    margin-bottom: 15px;
    color: #374151;
  `,

  greeting: `
    margin-bottom: 20px;
    color: #1f2937;
  `,

  // Sections
  section: `
    margin-bottom: 30px;
  `,

  sectionTitle: `
    font-size: 18px;
    font-weight: bold;
    color: #1f2937;
    margin-bottom: 15px;
    border-bottom: 3px solid #7c3aed;
    padding-bottom: 10px;
  `,

  // Info box
  infoBox: `
    background-color: #f3f4f6;
    border-left: 4px solid #7c3aed;
    padding: 15px;
    border-radius: 4px;
    margin-bottom: 15px;
  `,

  infoItem: `
    display: flex;
    justify-content: space-between;
    margin-bottom: 10px;
  `,

  infoLabel: `
    font-weight: 600;
    color: #6b7280;
  `,

  infoValue: `
    color: #1f2937;
    font-weight: 500;
    text-align: right;
  `,

  // Table styles
  table: `
    width: 100%;
    border-collapse: collapse;
    margin-bottom: 15px;
  `,

  tableHeader: `
    background-color: #f3f4f6;
    padding: 12px;
    text-align: left;
    font-weight: 600;
    color: #374151;
    border-bottom: 2px solid #e5e7eb;
  `,

  tableRow: `
    border-bottom: 1px solid #e5e7eb;
  `,

  tableCell: `
    padding: 12px;
    color: #374151;
  `,

  // Pricing table
  pricingTable: `
    background-color: #f9fafb;
    border-radius: 4px;
    overflow: hidden;
    margin-bottom: 20px;
  `,

  pricingRow: `
    display: flex;
    justify-content: space-between;
    padding: 12px 15px;
    border-bottom: 1px solid #e5e7eb;
  `,

  pricingRowTotal: `
    display: flex;
    justify-content: space-between;
    padding: 12px 15px;
    background-color: #f3f4f6;
    border-bottom: none;
    font-weight: bold;
    font-size: 16px;
  `,

  amountHighlight: `
    font-size: 24px;
    font-weight: bold;
    color: #10b981;
    text-align: center;
    padding: 15px;
    background-color: #f0fdf4;
    border-radius: 4px;
    margin: 15px 0;
  `,

  // Bank box
  bankBox: `
    background: linear-gradient(135deg, #f0fdf4 0%, #f0f9ff 100%);
    border: 2px solid #10b981;
    border-radius: 8px;
    padding: 20px;
    margin-bottom: 15px;
  `,

  bankDetail: `
    display: flex;
    justify-content: space-between;
    padding: 12px 0;
    border-bottom: 1px solid #e5e7eb;
  `,

  bankLabel: `
    font-weight: 600;
    color: #6b7280;
  `,

  bankValue: `
    font-family: 'Courier New', monospace;
    font-weight: bold;
    color: #1f2937;
    text-align: right;
  `,

  // Warning box
  warningBox: `
    background-color: #fef3c7;
    border-left: 4px solid #f59e0b;
    border-radius: 4px;
    padding: 15px;
    margin-bottom: 20px;
  `,

  warningTitle: `
    font-weight: bold;
    color: #92400e;
    margin-bottom: 10px;
  `,

  warningText: `
    color: #92400e;
    margin: 8px 0;
    font-size: 14px;
  `,

  // Success box
  successBox: `
    background-color: #ecfdf5;
    border: 2px solid #10b981;
    border-radius: 8px;
    padding: 20px;
    margin-bottom: 20px;
    text-align: center;
  `,

  successBoxTitle: `
    color: #059669;
    margin-top: 0;
    margin-bottom: 10px;
  `,

  // Shipping info
  shippingInfo: `
    background-color: #f3f4f6;
    border-radius: 4px;
    padding: 15px;
    margin-bottom: 20px;
  `,

  shippingInfoTitle: `
    font-weight: 600;
    color: #1f2937;
    margin-bottom: 8px;
  `,

  shippingInfoItem: `
    color: #6b7280;
    font-size: 14px;
    margin-bottom: 5px;
  `,

  // Support text
  supportText: `
    color: #6b7280;
    font-size: 14px;
    margin-bottom: 15px;
  `,

  link: `
    color: #7c3aed;
    text-decoration: none;
  `,

  // Footer
  footer: `
    background-color: #f9fafb;
    border-top: 1px solid #e5e7eb;
    padding: 20px 30px;
    text-align: center;
    color: #6b7280;
    font-size: 12px;
  `,
};

module.exports = emailStyles;
