const sgMail = require('@sendgrid/mail');
const fs = require('fs');
const path = require('path');

const TEMP_DIR = '/tmp';
const DEFAULT_SENDER_NAME = 'KIVAAN Vessel Intelligence';

/**
 * Initialize SendGrid with API key from environment
 */
function initializeSendGrid() {
  const apiKey = process.env.SENDGRID_API_KEY;
  if (!apiKey) {
    throw new Error('SENDGRID_API_KEY environment variable is not set');
  }
  sgMail.setApiKey(apiKey);
}

/**
 * Generate HTML email template
 * @param {string} vesselName - Vessel name
 * @param {string} vesselIMO - Vessel IMO number
 * @param {number} criticalCount - Count of critical recommendations
 * @param {number} moderateCount - Count of moderate recommendations
 * @param {number} recommendedCount - Count of recommended items
 * @param {string|number} riskScore - Risk score
 * @param {string} riskLevel - Risk level
 * @returns {string} HTML email content
 */
function generateEmailHTML(vesselName, vesselIMO, criticalCount, moderateCount, recommendedCount, riskScore, riskLevel) {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body {
      font-family: Arial, sans-serif;
      line-height: 1.6;
      color: #333;
      max-width: 600px;
      margin: 0 auto;
      padding: 20px;
    }
    h2 {
      color: #1F4E78;
      border-bottom: 2px solid #1F4E78;
      padding-bottom: 10px;
    }
    h3 {
      color: #1F4E78;
      margin-top: 20px;
    }
    ul {
      margin: 10px 0;
      padding-left: 20px;
    }
    li {
      margin: 5px 0;
    }
    strong {
      color: #1F4E78;
    }
  </style>
</head>
<body>
  <h2>Vessel Recommendations Report</h2>
  <p>Hello,</p>
  <p>Here's your detailed recommendations report for <strong>${escapeHtml(vesselName)}</strong> (IMO: ${escapeHtml(String(vesselIMO))}).</p>
  
  <h3>Report Summary:</h3>
  <ul>
    <li>Critical Items: <strong>${criticalCount}</strong></li>
    <li>Moderate Items: <strong>${moderateCount}</strong></li>
    <li>Recommended Items: <strong>${recommendedCount}</strong></li>
    <li>Risk Score: <strong>${escapeHtml(String(riskScore))}</strong> (${escapeHtml(String(riskLevel))})</li>
  </ul>
  
  <p>The attached Excel file contains:</p>
  <ul>
    <li>Complete recommendations by priority</li>
    <li>Internal & external checklists</li>
    <li>Campaign trends and general guidance</li>
  </ul>
  
  <p>Please review the critical items for immediate action.</p>
  
  <p>Best regards,<br>${DEFAULT_SENDER_NAME}</p>
</body>
</html>
  `.trim();
}

/**
 * Generate plain text email template
 * @param {string} vesselName - Vessel name
 * @param {string} vesselIMO - Vessel IMO number
 * @param {number} criticalCount - Count of critical recommendations
 * @param {number} moderateCount - Count of moderate recommendations
 * @param {number} recommendedCount - Count of recommended items
 * @param {string|number} riskScore - Risk score
 * @param {string} riskLevel - Risk level
 * @returns {string} Plain text email content
 */
function generateEmailText(vesselName, vesselIMO, criticalCount, moderateCount, recommendedCount, riskScore, riskLevel) {
  return `Vessel Recommendations Report

Hello,

Here's your detailed recommendations report for ${vesselName} (IMO: ${vesselIMO}).

Report Summary:
- Critical Items: ${criticalCount}
- Moderate Items: ${moderateCount}
- Recommended Items: ${recommendedCount}
- Risk Score: ${riskScore} (${riskLevel})

The attached Excel file contains:
- Complete recommendations by priority
- Internal & external checklists
- Campaign trends and general guidance

Please review the critical items for immediate action.

Best regards,
${DEFAULT_SENDER_NAME}`;
}

/**
 * Escape HTML special characters
 * @param {string} text - Text to escape
 * @returns {string} Escaped text
 */
function escapeHtml(text) {
  if (typeof text !== 'string') {
    text = String(text);
  }
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  };
  return text.replace(/[&<>"']/g, (m) => map[m] || m);
}

/**
 * Read Excel file from /tmp directory
 * @param {string} excelFilePath - Path to Excel file
 * @returns {Buffer} File buffer
 */
function readExcelFile(excelFilePath) {
  // Ensure path is within TEMP_DIR for security
  const resolvedPath = path.resolve(excelFilePath);
  const resolvedTempDir = path.resolve(TEMP_DIR);
  
  if (!resolvedPath.startsWith(resolvedTempDir)) {
    throw new Error('Invalid file path: file must be in /tmp directory');
  }

  if (!fs.existsSync(excelFilePath)) {
    throw new Error(`Excel file not found: ${excelFilePath}`);
  }

  return fs.readFileSync(excelFilePath);
}

/**
 * Netlify serverless function handler
 * @param {any} event - Netlify function event object
 * @returns {Promise<any>} HTTP response
 */
exports.handler = async (event) => {
  console.log('[send-email] Request received', { method: event.httpMethod });

  // Only accept POST requests
  if (event.httpMethod !== 'POST') {
    console.warn('[send-email] Invalid method', { method: event.httpMethod });
    return {
      statusCode: 405,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Method Not Allowed' }),
    };
  }

  let excelFilePath = null;

  try {
    // Initialize SendGrid
    initializeSendGrid();
    console.log('[send-email] SendGrid initialized');

    // Parse request body
    let requestData;
    if (typeof event.body === 'string') {
      requestData = JSON.parse(event.body);
    } else {
      requestData = event.body;
    }

    if (!requestData) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Missing request data' }),
      };
    }

    // Extract required parameters
    const recipientEmail = requestData.recipientEmail || requestData.email;
    const vesselName = requestData.vesselName || requestData.vessel_name || 'Unknown Vessel';
    const vesselIMO = requestData.vesselIMO || requestData.vessel_imo || requestData.imo || 'N/A';
    excelFilePath = requestData.excelFilePath || requestData.excel_file_path;
    
    // Extract recommendations counts
    const recommendationsCounts = requestData.recommendationsCounts || requestData.recommendations_counts || {};
    const criticalCount = recommendationsCounts.critical || recommendationsCounts.CRITICAL || 0;
    const moderateCount = recommendationsCounts.moderate || recommendationsCounts.MODERATE || 0;
    const recommendedCount = recommendationsCounts.recommended || recommendationsCounts.RECOMMENDED || 0;
    
    // Extract risk information
    const riskScore = requestData.riskScore || requestData.risk_score || 'N/A';
    const riskLevel = requestData.riskLevel || requestData.risk_level || 'N/A';

    // Validate required fields
    if (!recipientEmail) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          error: 'Missing recipientEmail',
          requiresEmail: true 
        }),
      };
    }

    // Validate email format (basic check)
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(recipientEmail)) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Invalid email address format' }),
      };
    }

    if (!excelFilePath) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Missing excelFilePath' }),
      };
    }

    // Get sender email and name from environment
    const senderEmail = process.env.SENDER_EMAIL || process.env.DEFAULT_SENDER_EMAIL;
    const senderName = process.env.SENDER_NAME || DEFAULT_SENDER_NAME;

    if (!senderEmail) {
      return {
        statusCode: 500,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'SENDER_EMAIL environment variable is not set' }),
      };
    }

    // Read Excel file
    let excelBuffer;
    try {
      excelBuffer = readExcelFile(excelFilePath);
    } catch (readError) {
      const errorMessage = readError instanceof Error ? readError.message : String(readError);
      return {
        statusCode: 404,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          error: 'Excel file not found or cannot be read',
          message: errorMessage 
        }),
      };
    }

    // Generate email content
    const htmlContent = generateEmailHTML(
      vesselName,
      vesselIMO,
      criticalCount,
      moderateCount,
      recommendedCount,
      riskScore,
      riskLevel
    );
    const textContent = generateEmailText(
      vesselName,
      vesselIMO,
      criticalCount,
      moderateCount,
      recommendedCount,
      riskScore,
      riskLevel
    );

    // Extract filename from path
    const filename = path.basename(excelFilePath);

    // Prepare email message
    const msg = {
      to: recipientEmail,
      from: {
        email: senderEmail,
        name: senderName,
      },
      subject: `Vessel Recommendations Report - ${vesselName}`,
      text: textContent,
      html: htmlContent,
      attachments: [
        {
          content: excelBuffer.toString('base64'),
          filename: filename,
          type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          disposition: 'attachment',
        },
      ],
    };

    // Send email via SendGrid
    console.log('[send-email] Sending email', { 
      to: recipientEmail, 
      vesselName, 
      attachmentSize: (excelBuffer.length / 1024).toFixed(2) + ' KB' 
    });
    
    let sendResult;
    try {
      sendResult = await sgMail.send(msg);
      console.log('[send-email] Email sent successfully', { 
        messageId: sendResult[0]?.headers?.['x-message-id'] || 'N/A' 
      });
    } catch (sendError) {
      const errorMessage = sendError instanceof Error ? sendError.message : String(sendError);
      console.error('[send-email] SendGrid error:', errorMessage);
      
      // Extract detailed error information if available
      let detailedError = errorMessage;
      if (sendError && typeof sendError === 'object' && 'response' in sendError) {
        const response = /** @type {any} */ (sendError.response);
        if (response.body) {
          detailedError = JSON.stringify(response.body);
        }
      }

      return {
        statusCode: 500,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          error: 'Failed to send email via SendGrid',
          message: detailedError,
        }),
      };
    }

    // Verify successful send (SendGrid returns 202 Accepted)
    if (!sendResult || !sendResult[0] || sendResult[0].statusCode !== 202) {
      return {
        statusCode: 500,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          error: 'Unexpected response from SendGrid',
          statusCode: sendResult?.[0]?.statusCode || 'unknown',
        }),
      };
    }

    // Clean up Excel file after successful send
    try {
      if (fs.existsSync(excelFilePath)) {
        fs.unlinkSync(excelFilePath);
        console.log(`Cleaned up Excel file: ${excelFilePath}`);
      }
    } catch (cleanupError) {
      // Log but don't fail the request - file will be cleaned up by age check anyway
      const errorMessage = cleanupError instanceof Error ? cleanupError.message : String(cleanupError);
      console.warn(`Warning: Could not delete Excel file ${excelFilePath} after sending:`, errorMessage);
    }

    // Return success response
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        success: true,
        recipient: recipientEmail,
        vesselName: vesselName,
        messageId: sendResult[0].headers?.['x-message-id'] || 'N/A',
        sentAt: new Date().toISOString(),
      }),
    };
  } catch (error) {
    console.error('Error in send-email function:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);

    // Clean up Excel file on error (best effort)
    if (excelFilePath) {
      try {
        if (fs.existsSync(excelFilePath)) {
          fs.unlinkSync(excelFilePath);
        }
      } catch (cleanupError) {
        // Ignore cleanup errors
        console.warn('Error during cleanup:', cleanupError);
      }
    }

    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        error: 'Failed to send email',
        message: errorMessage,
      }),
    };
  }
};

