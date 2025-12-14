const ExcelJS = require('exceljs');
const fs = require('fs');
const path = require('path');

// File storage directory (Netlify serverless functions have /tmp available)
const TEMP_DIR = '/tmp';

/**
 * Netlify serverless function handler
 * @param {any} event
 */
exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Method Not Allowed' }),
    };
  }

  try {
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

    const vesselData = requestData.vesselData || requestData;
    const recommendationsData = requestData.recommendationsData || vesselData.recommendationsData || {};

    if (!vesselData) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Missing vessel data' }),
      };
    }

    // Generate Excel file
    const excelBuffer = await generateExcelFile(vesselData, recommendationsData);

    // Extract IMO for filename
    const imo = vesselData.imo || vesselData.imoNumber || 'unknown';
    const timestamp = Date.now();
    const filename = `recommendations_${imo}_${timestamp}.xlsx`;
    const filepath = path.join(TEMP_DIR, filename);
    
    // Ensure temp directory exists
    if (!fs.existsSync(TEMP_DIR)) {
      fs.mkdirSync(TEMP_DIR, { recursive: true });
    }

    // Save file
    fs.writeFileSync(filepath, /** @type {any} */ (excelBuffer), 'binary');

    // Generate download URL
    const baseUrl = process.env.URL || process.env.DEPLOY_PRIME_URL || 'https://your-site.netlify.app';
    const downloadUrl = `${baseUrl}/.netlify/functions/download-excel?file=${encodeURIComponent(filename)}`;

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        success: true,
        filename: filename,
        downloadUrl: downloadUrl,
      }),
    };
  } catch (error) {
    console.error('Error generating Excel:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        error: 'Failed to generate Excel file',
        message: errorMessage,
      }),
    };
  }
};

/**
 * Generate Excel file with all sheets
 * @param {any} vesselData
 * @param {any} recommendationsData
 */
async function generateExcelFile(vesselData, recommendationsData) {
  const workbook = new ExcelJS.Workbook();
  
  // Extract vessel data
  const vesselName = vesselData.name || vesselData.vesselName || 'Unknown Vessel';
  const imo = vesselData.imo || vesselData.imoNumber || 'N/A';
  const riskScore = vesselData.riskScore || vesselData.risk_score || 'N/A';
  const riskLevel = vesselData.riskLevel || vesselData.risk_level || 'N/A';
  const riskLabel = vesselData.riskLabel || vesselData.risk_label || riskLevel || 'N/A';
  
  // Extract inspection data
  const lastInspection = vesselData.lastInspection || vesselData.last_inspection || {};
  let lastInspectionDate = 'N/A';
  if (lastInspection.date || lastInspection.inspectionDate || lastInspection.timestamp) {
    const dateValue = lastInspection.date || lastInspection.inspectionDate || lastInspection.timestamp;
    if (typeof dateValue === 'number') {
      lastInspectionDate = new Date(dateValue).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    } else if (typeof dateValue === 'string') {
      lastInspectionDate = dateValue;
    }
  }
  const lastInspectionPort = lastInspection.port || lastInspection.portName || lastInspection.port_name || 'N/A';
  
  // Current date/time for report generation
  const reportGenerated = new Date().toLocaleString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

  // SHEET 1: Vessel Summary
  const summarySheet = workbook.addWorksheet('Vessel Summary');
  
  // Add header row
  summarySheet.addRow(['Field', 'Value']);
  
  // Style header row
  const headerRow = summarySheet.getRow(1);
  headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  headerRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF1F4E78' }, // Dark blue
  };
  headerRow.alignment = { vertical: 'middle', horizontal: 'center' };
  headerRow.border = {
    top: { style: 'thin' },
    left: { style: 'thin' },
    bottom: { style: 'thin' },
    right: { style: 'thin' },
  };

  // Add data rows
  summarySheet.addRow(['Vessel Name', vesselName]);
  summarySheet.addRow(['IMO Number', imo]);
  summarySheet.addRow(['Risk Score', riskScore]);
  summarySheet.addRow(['Risk Level', riskLevel]);
  summarySheet.addRow(['Risk Label', riskLabel]);
  summarySheet.addRow(['Last Inspection Date', lastInspectionDate]);
  summarySheet.addRow(['Last Inspection Port', lastInspectionPort]);
  summarySheet.addRow(['Report Generated', reportGenerated]);

  // Style data rows with borders
  for (let i = 2; i <= summarySheet.rowCount; i++) {
    const row = summarySheet.getRow(i);
    row.border = {
      top: { style: 'thin' },
      left: { style: 'thin' },
      bottom: { style: 'thin' },
      right: { style: 'thin' },
    };
  }

  // Set column widths
  summarySheet.getColumn(1).width = 25;
  summarySheet.getColumn(2).width = 40;

  // SHEET 2: CRITICAL Recommendations
  const criticalData = recommendationsData.CRITICAL || recommendationsData.critical || [];
  const criticalSheet = workbook.addWorksheet('CRITICAL Recommendations');
  addRecommendationsSheet(criticalSheet, criticalData, 'FFC7CE'); // Light red

  // SHEET 3: MODERATE Recommendations
  const moderateData = recommendationsData.MODERATE || recommendationsData.moderate || [];
  const moderateSheet = workbook.addWorksheet('MODERATE Recommendations');
  addRecommendationsSheet(moderateSheet, moderateData, 'FFEB9C'); // Light yellow

  // SHEET 4: RECOMMENDED
  const recommendedData = recommendationsData.RECOMMENDED || recommendationsData.recommended || [];
  const recommendedSheet = workbook.addWorksheet('RECOMMENDED');
  addRecommendationsSheet(recommendedSheet, recommendedData, 'C6EFCE'); // Light green

  // SHEET 5: Campaigns
  const campaignsSheet = workbook.addWorksheet('Campaigns');
  addCampaignsSheet(campaignsSheet, recommendationsData);

  // Generate Excel buffer
  const buffer = await workbook.xlsx.writeBuffer();
  return buffer;
}

/**
 * Add recommendations sheet with styling
 * @param {any} worksheet
 * @param {any[]} recommendations
 * @param {string} rowColor - Hex color for data rows (without #)
 */
function addRecommendationsSheet(worksheet, recommendations, rowColor) {
  // Define columns
  const columns = [
    { header: 'Category', key: 'category', width: 20 },
    { header: 'Issue Type', key: 'issueType', width: 25 },
    { header: 'Campaign Trend', key: 'campaignTrend', width: 20 },
    { header: 'Recommendations', key: 'recommendations', width: 40 },
    { header: 'Internal Checklist', key: 'internalChecklist', width: 40 },
    { header: 'External Checklist', key: 'externalChecklist', width: 40 },
    { header: 'General Checklist', key: 'generalChecklist', width: 40 },
  ];

  worksheet.columns = columns;

  // Style header row
  const headerRow = worksheet.getRow(1);
  headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  headerRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF1F4E78' }, // Dark blue
  };
  headerRow.alignment = { vertical: 'middle', horizontal: 'center' };
  headerRow.border = {
    top: { style: 'thin' },
    left: { style: 'thin' },
    bottom: { style: 'thin' },
    right: { style: 'thin' },
  };

  // Add data rows
  if (Array.isArray(recommendations)) {
    recommendations.forEach((/** @type {any} */ rec) => {
      // Handle category - could be object or string
      let category = 'General';
      if (typeof rec === 'string') {
        category = rec;
      } else if (rec.category) {
        category = rec.category;
      } else if (rec.name) {
        category = rec.name;
      }

      // Parse recommendations data - could be nested object
      const recData = typeof rec === 'object' ? rec : {};
      
      // Join array fields with newlines
      const joinArray = (/** @type {any} */ arr) => {
        if (!arr) return '';
        if (Array.isArray(arr)) {
          return arr.filter(item => item).join('\n');
        }
        return String(arr || '');
      };

      const row = worksheet.addRow({
        category: category,
        issueType: recData.issueType || recData.issue_type || recData.issueType || '',
        campaignTrend: recData.campaignTrend || recData.campaign_trend || recData.trend || '',
        recommendations: joinArray(recData.recommendations || recData.generalRecommendations || recData.general_recommendations || recData.description || recData.recommendation || recData.text),
        internalChecklist: joinArray(recData.internalChecklist || recData.internal_checklist || recData.internalChecklist),
        externalChecklist: joinArray(recData.externalChecklist || recData.external_checklist || recData.externalChecklist),
        generalChecklist: joinArray(recData.generalChecklist || recData.general_checklist || recData.generalChecklist),
      });

      // Style data rows
      row.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: rowColor },
      };
      row.alignment = { vertical: 'top', wrapText: true };
      row.border = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' },
      };
    });
  }

  // Auto-adjust column widths
  worksheet.columns.forEach((/** @type {any} */ column) => {
    let maxLength = 0;
    column.eachCell({ includeEmpty: false }, (/** @type {any} */ cell) => {
      const cellValue = cell.value ? String(cell.value) : '';
      const lines = cellValue.split('\n');
      const maxLineLength = Math.max(...lines.map(line => line.length), 0);
      if (maxLineLength > maxLength) {
        maxLength = maxLineLength;
      }
    });
    column.width = Math.min(Math.max(maxLength + 2, column.width || 10), 50);
  });

  // Add filters
  if (worksheet.rowCount > 1) {
    worksheet.autoFilter = {
      from: { row: 1, column: 1 },
      to: { row: worksheet.rowCount, column: columns.length },
    };
  }

  // Freeze header row
  worksheet.views = [
    {
      state: 'frozen',
      ySplit: 1,
    },
  ];
}

/**
 * Add campaigns sheet
 * @param {any} worksheet
 * @param {any} recommendationsData
 */
function addCampaignsSheet(worksheet, recommendationsData) {
  // Define columns
  const columns = [
    { header: 'Campaign Name', key: 'campaignName', width: 30 },
    { header: 'Recommendations', key: 'recommendations', width: 60 },
  ];

  worksheet.columns = columns;

  // Style header row
  const headerRow = worksheet.getRow(1);
  headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  headerRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF1F4E78' }, // Dark blue
  };
  headerRow.alignment = { vertical: 'middle', horizontal: 'center' };
  headerRow.border = {
    top: { style: 'thin' },
    left: { style: 'thin' },
    bottom: { style: 'thin' },
    right: { style: 'thin' },
  };

  // Parse campaigns data
  const campaigns = recommendationsData.campaigns || recommendationsData.Campaigns || [];
  
  if (Array.isArray(campaigns)) {
    campaigns.forEach((/** @type {any} */ campaign) => {
      const campaignName = campaign.name || campaign.campaignName || campaign.campaign_name || 'Unknown Campaign';
      const recommendations = Array.isArray(campaign.recommendations) 
        ? campaign.recommendations.filter((/** @type {any} */ item) => item).join('\n')
        : (campaign.recommendations || campaign.description || '');

      const row = worksheet.addRow({
        campaignName: campaignName,
        recommendations: recommendations,
      });

      // Style data rows
      row.alignment = { vertical: 'top', wrapText: true };
      row.border = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' },
      };
    });
  } else if (typeof campaigns === 'object' && campaigns !== null) {
    // Handle object format where keys are campaign names
    Object.keys(campaigns).forEach(campaignName => {
      const campaignData = campaigns[campaignName];
      const recommendations = Array.isArray(campaignData) 
        ? campaignData.filter(item => item).join('\n')
        : (campaignData?.recommendations ? (Array.isArray(campaignData.recommendations) ? campaignData.recommendations.join('\n') : String(campaignData.recommendations)) : '');

      const row = worksheet.addRow({
        campaignName: campaignName,
        recommendations: recommendations,
      });

      // Style data rows
      row.alignment = { vertical: 'top', wrapText: true };
      row.border = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' },
      };
    });
  }

  // Auto-adjust column widths
  worksheet.columns.forEach((/** @type {any} */ column) => {
    let maxLength = 0;
    column.eachCell({ includeEmpty: false }, (/** @type {any} */ cell) => {
      const cellValue = cell.value ? String(cell.value) : '';
      const lines = cellValue.split('\n');
      const maxLineLength = Math.max(...lines.map((/** @type {string} */ line) => line.length), 0);
      if (maxLineLength > maxLength) {
        maxLength = maxLineLength;
      }
    });
    column.width = Math.min(Math.max(maxLength + 2, column.width || 10), 60);
  });

  // Add filters
  if (worksheet.rowCount > 1) {
    worksheet.autoFilter = {
      from: { row: 1, column: 1 },
      to: { row: worksheet.rowCount, column: columns.length },
    };
  }

  // Freeze header row
  worksheet.views = [
    {
      state: 'frozen',
      ySplit: 1,
    },
  ];
}

// Export helper function for testing
exports.generateExcelFile = generateExcelFile;
