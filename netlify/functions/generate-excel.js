const ExcelJS = require('exceljs');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// File storage directory (Netlify serverless functions have /tmp available)
const TEMP_DIR = '/tmp';
const FILE_TTL = 5 * 60 * 1000; // 5 minutes in milliseconds

// Clean up old files on function start
cleanupOldFiles();

/**
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
    let vesselData;
    if (typeof event.body === 'string') {
      vesselData = JSON.parse(event.body);
    } else {
      vesselData = event.body;
    }

    if (!vesselData) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Missing vessel data' }),
      };
    }

    // Generate Excel file
    const excelBuffer = await generateExcelFile(vesselData);

    // Save to temporary file
    const filename = `vessel_recommendations_${vesselData.imo || vesselData.name || 'unknown'}_${Date.now()}.xlsx`;
    const filepath = path.join(TEMP_DIR, filename);
    
    // Ensure temp directory exists
    if (!fs.existsSync(TEMP_DIR)) {
      fs.mkdirSync(TEMP_DIR, { recursive: true });
    }

    fs.writeFileSync(filepath, /** @type {any} */ (excelBuffer), 'binary');

    // Generate download URL
    // In production, upload to S3/cloud storage and generate signed URL
    // For now, return a function endpoint that serves the file
    const fileId = crypto.randomBytes(16).toString('hex');
    const baseUrl = process.env.URL || process.env.DEPLOY_PRIME_URL || 'https://your-site.netlify.app';
    const downloadUrl = `${baseUrl}/.netlify/functions/download-excel?file=${encodeURIComponent(filename)}&id=${fileId}`;

    // Store file metadata (in production, use Redis or database)
    // For now, we'll use a simple in-memory store or file-based metadata
    storeFileMetadata(filename, fileId, filepath);

    // Clean up old files periodically
    cleanupOldFiles();

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        success: true,
        filename,
        downloadUrl,
        expiresIn: '5 minutes',
        message: 'Excel file generated successfully',
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
 * @param {any} vesselData
 */
async function generateExcelFile(vesselData) {
  const workbook = new ExcelJS.Workbook();
  
  // Extract data
  const vesselName = vesselData.name || 'Unknown Vessel';
  const imo = vesselData.imo || 'N/A';
  const riskScore = vesselData.riskScore || vesselData.risk_score || 'N/A';
  const riskLevel = vesselData.riskLevel || vesselData.risk_level || 'N/A';
  const lastInspection = vesselData.lastInspection || vesselData.last_inspection || {};
  const lastInspectionDate = lastInspection.date || lastInspection.inspectionDate || 'N/A';
  const lastInspectionPort = lastInspection.port || lastInspection.portName || 'N/A';
  
  const recommendations = vesselData.recommendationsData || vesselData.recommendations || [];
  
  // Group recommendations by priority
  const critical = recommendations.filter((/** @type {any} */ r) => 
    (r.priority || r.severity || '').toUpperCase() === 'CRITICAL' || 
    (r.priority || r.severity || '').toUpperCase() === 'HIGH'
  );
  const moderate = recommendations.filter((/** @type {any} */ r) => 
    (r.priority || r.severity || '').toUpperCase() === 'MODERATE' || 
    (r.priority || r.severity || '').toUpperCase() === 'MEDIUM'
  );
  const recommended = recommendations.filter((/** @type {any} */ r) => 
    (r.priority || r.severity || '').toUpperCase() === 'RECOMMENDED' || 
    (r.priority || r.severity || '').toUpperCase() === 'LOW' ||
    (!critical.includes(r) && !moderate.includes(r))
  );

  // Sheet 1: Summary
  const summarySheet = workbook.addWorksheet('Summary');
  
  // Summary data
  summarySheet.addRow(['Vessel Name', vesselName]);
  summarySheet.addRow(['IMO', imo]);
  summarySheet.addRow(['Risk Score', riskScore]);
  summarySheet.addRow(['Risk Level', riskLevel]);
  summarySheet.addRow([]); // Empty row
  summarySheet.addRow(['Last Inspection Date', lastInspectionDate]);
  summarySheet.addRow(['Last Inspection Port', lastInspectionPort]);
  summarySheet.addRow([]); // Empty row
  summarySheet.addRow(['Recommendations Summary', '']);
  summarySheet.addRow(['Critical', critical.length]);
  summarySheet.addRow(['Moderate', moderate.length]);
  summarySheet.addRow(['Recommended', recommended.length]);
  summarySheet.addRow(['Total', recommendations.length]);

  // Style summary sheet
  summarySheet.getColumn(1).width = 25;
  summarySheet.getColumn(2).width = 30;
  
  // Style header row
  summarySheet.getRow(9).font = { bold: true, color: { argb: 'FFFFFFFF' } }; // White text
  summarySheet.getRow(9).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF1F4E78' }, // Dark blue background
  };

  // Sheet 2: CRITICAL
  const criticalSheet = workbook.addWorksheet('CRITICAL');
  addRecommendationsSheet(criticalSheet, critical, 'FFE6E6'); // Light red

  // Sheet 3: MODERATE
  const moderateSheet = workbook.addWorksheet('MODERATE');
  addRecommendationsSheet(moderateSheet, moderate, 'FFFFE6'); // Light yellow

  // Sheet 4: RECOMMENDED
  const recommendedSheet = workbook.addWorksheet('RECOMMENDED');
  addRecommendationsSheet(recommendedSheet, recommended, 'E6FFE6'); // Light green

  // Generate Excel buffer
  const buffer = await workbook.xlsx.writeBuffer();
  return buffer;
}

/**
 * @param {any} worksheet
 * @param {any[]} recommendations
 * @param {string} rowColor
 */
function addRecommendationsSheet(worksheet, recommendations, rowColor) {
  // Define columns
  const columns = [
    { header: 'Category', key: 'category', width: 20 },
    { header: 'Issue Type', key: 'issueType', width: 25 },
    { header: 'Campaign Trend', key: 'campaignTrend', width: 20 },
    { header: 'General Recommendations', key: 'generalRecommendations', width: 40 },
    { header: 'Internal Checklist', key: 'internalChecklist', width: 40 },
    { header: 'External Checklist', key: 'externalChecklist', width: 40 },
  ];

  worksheet.columns = columns;

  // Add header row
  worksheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  worksheet.getRow(1).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF1F4E78' }, // Dark blue background
  };
  worksheet.getRow(1).alignment = { vertical: 'middle', horizontal: 'center' };

  // Add data rows
  recommendations.forEach((/** @type {any} */ rec, /** @type {number} */ index) => {
    const row = worksheet.addRow({
      category: rec.category || rec.type || 'General',
      issueType: rec.issueType || rec.issue_type || rec.issueType || '',
      campaignTrend: rec.campaignTrend || rec.campaign_trend || rec.trend || '',
      generalRecommendations: rec.generalRecommendations || rec.general_recommendations || rec.description || rec.recommendation || rec.text || '',
      internalChecklist: rec.internalChecklist || rec.internal_checklist || rec.internalChecklist || '',
      externalChecklist: rec.externalChecklist || rec.external_checklist || rec.externalChecklist || '',
    });

    // Style data rows with background color
    row.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: rowColor },
    };

    // Wrap text for long content
    row.alignment = { vertical: 'top', wrapText: true };
  });

  // Add filters
  worksheet.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: worksheet.rowCount, column: columns.length },
  };

  // Auto-adjust column widths (with min/max limits)
  worksheet.columns.forEach((/** @type {any} */ column) => {
    let maxLength = 0;
    column.eachCell({ includeEmpty: false }, (/** @type {any} */ cell) => {
      const columnLength = cell.value ? cell.value.toString().length : 10;
      if (columnLength > maxLength) {
        maxLength = columnLength;
      }
    });
    column.width = Math.min(Math.max(maxLength + 2, column.width || 10), 50);
  });

  // Freeze header row
  worksheet.views = [
    {
      state: 'frozen',
      ySplit: 1,
    },
  ];
}

// Simple file metadata storage (in production, use Redis or database)
const fileMetadata = new Map();

/**
 * @param {string} filename
 * @param {string} fileId
 * @param {string} filepath
 */
function storeFileMetadata(filename, fileId, filepath) {
  fileMetadata.set(fileId, {
    filename,
    filepath,
    createdAt: Date.now(),
    expiresAt: Date.now() + FILE_TTL,
  });
}

/**
 * @param {string} fileId
 */
function getFileMetadata(fileId) {
  const metadata = fileMetadata.get(fileId);
  if (!metadata) return null;
  
  // Check if expired
  if (Date.now() > metadata.expiresAt) {
    // Clean up
    if (fs.existsSync(metadata.filepath)) {
      try {
        fs.unlinkSync(metadata.filepath);
      } catch (err) {
        console.error('Error deleting expired file:', err);
      }
    }
    fileMetadata.delete(fileId);
    return null;
  }
  
  return metadata;
}

function cleanupOldFiles() {
  try {
    if (!fs.existsSync(TEMP_DIR)) {
      return;
    }

    const files = fs.readdirSync(TEMP_DIR);
    const now = Date.now();

    files.forEach((file) => {
      if (file.endsWith('.xlsx')) {
        const filepath = path.join(TEMP_DIR, file);
        try {
          const stats = fs.statSync(filepath);
          const fileAge = now - stats.mtimeMs;

          // Delete files older than TTL
          if (fileAge > FILE_TTL) {
            fs.unlinkSync(filepath);
            console.log(`Cleaned up old file: ${file}`);
          }
        } catch (err) {
          console.error(`Error checking file ${file}:`, err);
        }
      }
    });

    // Clean up expired metadata
    fileMetadata.forEach((metadata, fileId) => {
      if (Date.now() > metadata.expiresAt) {
        fileMetadata.delete(fileId);
      }
    });
  } catch (error) {
    console.error('Error during cleanup:', error);
  }
}

// Export helper functions for testing and external use
exports.generateExcelFile = generateExcelFile;
exports.getFileMetadata = getFileMetadata;
exports.cleanupOldFiles = cleanupOldFiles;
exports.addRecommendationsSheet = addRecommendationsSheet;

