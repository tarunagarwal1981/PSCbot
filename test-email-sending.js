#!/usr/bin/env node

/**
 * Test Email Sending Script
 * 
 * Standalone script to test email delivery with a test Excel attachment.
 * Generates a test Excel file and sends it via SendGrid.
 * 
 * Usage: npm run test-email
 * 
 * Required environment variables:
 * - SENDGRID_API_KEY
 * - DEFAULT_SENDER_EMAIL
 * - TEST_RECIPIENT_EMAIL (optional, defaults to sender email)
 */

const sgMail = require('@sendgrid/mail');
const { generateExcelFile } = require('./test-excel-generation');
const fs = require('fs');
const path = require('path');

// Initialize SendGrid
if (process.env.SENDGRID_API_KEY) {
  sgMail.setApiKey(process.env.SENDGRID_API_KEY);
} else {
  console.error('❌ Error: SENDGRID_API_KEY environment variable is not set');
  console.error('   Please set it in your .env file or environment');
  process.exit(1);
}

// Sample vessel data for testing
const sampleVesselData = {
  name: 'GCL YAMUNA',
  imo: '9481219',
  riskScore: 45,
  riskLevel: 'HIGH',
  lastInspection: {
    date: '2024-01-15',
    port: 'Port of Singapore',
  },
  recommendationsData: [
    {
      category: 'Covers (hatchway-, portable-, tarpaulins, etc.)',
      issueType: 'CRITICAL',
      priority: 'CRITICAL',
      severity: 'HIGH',
      campaignTrend: 'Increasing trend in PSC inspections',
      generalRecommendations: [
        'Inspect all hatchway covers for proper fit',
        'Check tarpaulin condition and replace if damaged',
        'Ensure proper securing mechanisms are functional',
      ],
      internalChecklist: [
        'Visual inspection of all covers',
        'Documentation of cover condition',
        'Maintenance schedule review',
      ],
      externalChecklist: [
        'PSC inspection readiness',
        'Compliance with SOLAS requirements',
        'Port state control preparation',
      ],
    },
    {
      category: 'Fire safety',
      issueType: 'MODERATE',
      priority: 'MODERATE',
      severity: 'MEDIUM',
      campaignTrend: 'Standard compliance check',
      generalRecommendations: [
        'Review fire safety equipment maintenance records',
        'Conduct fire drill training for crew',
      ],
      internalChecklist: [
        'Fire extinguisher inspection',
        'Fire detection system test',
      ],
      externalChecklist: ['SOLAS compliance verification'],
    },
    {
      category: 'Navigation equipment',
      issueType: 'RECOMMENDED',
      priority: 'RECOMMENDED',
      severity: 'LOW',
      campaignTrend: 'Best practice recommendation',
      generalRecommendations: ['Consider upgrading navigation equipment'],
      internalChecklist: ['Equipment performance review'],
      externalChecklist: ['Industry best practices compliance'],
    },
  ],
};

// Email template
/**
 * @param {any} vesselData
 */
function getEmailContent(vesselData) {
  const vesselName = vesselData.name || 'Unknown Vessel';
  const imo = vesselData.imo || 'N/A';
  const riskScore = vesselData.riskScore || 'N/A';
  const riskLevel = vesselData.riskLevel || 'N/A';

  const recommendations = vesselData.recommendationsData || vesselData.recommendations || [];
  const critical = recommendations.filter(
    (/** @type {any} */ r) =>
      (r.priority || r.severity || '').toUpperCase() === 'CRITICAL' ||
      (r.priority || r.severity || '').toUpperCase() === 'HIGH'
  );
  const moderate = recommendations.filter(
    (/** @type {any} */ r) =>
      (r.priority || r.severity || '').toUpperCase() === 'MODERATE' ||
      (r.priority || r.severity || '').toUpperCase() === 'MEDIUM'
  );
  const recommended = recommendations.filter(
    (/** @type {any} */ r) =>
      (r.priority || r.severity || '').toUpperCase() === 'RECOMMENDED' ||
      (r.priority || r.severity || '').toUpperCase() === 'LOW' ||
      (!critical.includes(r) && !moderate.includes(r))
  );

  const htmlBody = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .header { background-color: #1F4E78; color: white; padding: 20px; text-align: center; }
    .content { padding: 20px; }
    .summary { background-color: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0; }
    .summary-item { margin: 10px 0; }
    .critical { color: #d32f2f; font-weight: bold; }
    .moderate { color: #f57c00; font-weight: bold; }
    .recommended { color: #388e3c; font-weight: bold; }
    .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; font-size: 12px; color: #666; }
  </style>
</head>
<body>
  <div class="header">
    <h1>Vessel Recommendations Report</h1>
  </div>
  <div class="content">
    <p>Hello,</p>
    
    <p>This is a <strong>TEST EMAIL</strong> for the vessel recommendations report system.</p>
    
    <p>Here's your detailed recommendations report for <strong>${vesselName}</strong> (IMO: ${imo}).</p>
    
    <div class="summary">
      <h3>Report Summary:</h3>
      <div class="summary-item">
        <span class="critical">Critical Items:</span> ${critical.length}
      </div>
      <div class="summary-item">
        <span class="moderate">Moderate Items:</span> ${moderate.length}
      </div>
      <div class="summary-item">
        <span class="recommended">Recommended Items:</span> ${recommended.length}
      </div>
      <div class="summary-item">
        <strong>Risk Score:</strong> ${riskScore} (${riskLevel})
      </div>
    </div>
    
    <p>The attached Excel file contains:</p>
    <ul>
      <li>Complete recommendations by priority</li>
      <li>Internal & external checklists</li>
      <li>Campaign trends and general guidance</li>
    </ul>
    
    <p><strong>Please review the critical items for immediate action.</strong></p>
    
    <div class="footer">
      <p>Best regards,<br>
      <strong>KIVAAN Vessel Intelligence</strong></p>
      <p><em>This is a test email. Please ignore if received in error.</em></p>
    </div>
  </div>
</body>
</html>
  `.trim();

  const textBody = `
Hello,

This is a TEST EMAIL for the vessel recommendations report system.

Here's your detailed recommendations report for ${vesselName} (IMO: ${imo}).

Report Summary:
- Critical Items: ${critical.length}
- Moderate Items: ${moderate.length}
- Recommended Items: ${recommended.length}
- Risk Score: ${riskScore} (${riskLevel})

The attached Excel file contains:
- Complete recommendations by priority
- Internal & external checklists
- Campaign trends and general guidance

Please review the critical items for immediate action.

Best regards,
KIVAAN Vessel Intelligence

This is a test email. Please ignore if received in error.
  `.trim();

  return { html: htmlBody, text: textBody };
}

// Main test function
async function testEmailSending() {
  console.log('🧪 Testing Email Sending...\n');
  console.log('='.repeat(60));

  // Check required environment variables
  const senderEmail = process.env.DEFAULT_SENDER_EMAIL;
  if (!senderEmail) {
    console.error('❌ Error: DEFAULT_SENDER_EMAIL environment variable is not set');
    console.error('   Please set it in your .env file or environment');
    process.exit(1);
  }

  const recipientEmail = process.env.TEST_RECIPIENT_EMAIL || senderEmail;
  console.log(`📧 Sender: ${senderEmail}`);
  console.log(`📧 Recipient: ${recipientEmail}\n`);

  try {
    // Generate Excel file
    console.log('📊 Generating Excel file...');
    const excelBuffer = await generateExcelFile(sampleVesselData);
    const vesselName = sampleVesselData.name.replace(/\s+/g, '_').toUpperCase();
    const dateStr = new Date().toISOString().split('T')[0]?.replace(/-/g, '') || '';
    const filename = `Recommendations_${vesselName}_${dateStr}.xlsx`;

    const excelBufferAny = /** @type {any} */ (excelBuffer);
    const bufferLength = Buffer.isBuffer(excelBufferAny) ? excelBufferAny.length : (excelBufferAny && typeof excelBufferAny === 'object' && 'length' in excelBufferAny ? excelBufferAny.length : 0);
    console.log(`✅ Excel file generated (${(bufferLength / 1024).toFixed(2)} KB)\n`);

    // Prepare email content
    console.log('📝 Preparing email content...');
    const emailContent = getEmailContent(sampleVesselData);

    // Prepare email message
    const msg = {
      to: recipientEmail,
      from: {
        email: senderEmail,
        name: 'KIVAAN Vessel Intelligence (Test)',
      },
      subject: `[TEST] Vessel Recommendations Report - ${sampleVesselData.name}`,
      text: emailContent.text,
      html: emailContent.html,
      attachments: [
        {
          content: (() => {
            const excelBufferAny = /** @type {any} */ (excelBuffer);
            return Buffer.isBuffer(excelBufferAny) ? excelBufferAny.toString('base64') : (typeof excelBufferAny === 'string' ? excelBufferAny : Buffer.from(excelBufferAny).toString('base64'));
          })(),
          filename,
          type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          disposition: 'attachment',
        },
      ],
    };

    // Send email
    console.log('📤 Sending email via SendGrid...');
    const result = await sgMail.send(msg);

    if (result && result[0] && result[0].statusCode === 202) {
      console.log('✅ Email sent successfully!\n');
      console.log('📊 Email Details:');
      console.log(`   To: ${recipientEmail}`);
      console.log(`   From: ${senderEmail}`);
      console.log(`   Subject: ${msg.subject}`);
      console.log(`   Attachment: ${filename} (${(bufferLength / 1024).toFixed(2)} KB)`);
      console.log(`   Message ID: ${result[0].headers?.['x-message-id'] || 'N/A'}`);
      console.log('\n✨ Test completed successfully!');
      console.log(`\n💡 Check your inbox (and spam folder) for the test email.`);

      return { success: true, recipient: recipientEmail, messageId: result[0].headers?.['x-message-id'] };
    } else {
      throw new Error('Unexpected response from SendGrid');
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('❌ Error sending email:', errorMessage);
    
    if (error && typeof error === 'object' && 'response' in error && error.response) {
      const response = /** @type {any} */ (error.response);
      console.error('\n📋 SendGrid Error Details:');
      console.error(`   Status: ${response.statusCode || 'N/A'}`);
      console.error(`   Body:`, JSON.stringify(response.body || {}, null, 2));
    }
    
    console.error('\n💡 Troubleshooting:');
    console.error('   1. Verify SENDGRID_API_KEY is correct');
    console.error('   2. Verify DEFAULT_SENDER_EMAIL is verified in SendGrid');
    console.error('   3. Check SendGrid account status and limits');
    console.error('   4. Verify recipient email is valid');
    
    process.exit(1);
  }
}

// Run the test
if (require.main === module) {
  testEmailSending()
    .then((result) => {
      if (result.success) {
        process.exit(0);
      } else {
        process.exit(1);
      }
    })
    .catch((error) => {
      console.error('Fatal error:', error);
      process.exit(1);
    });
}

module.exports = { testEmailSending, getEmailContent };


