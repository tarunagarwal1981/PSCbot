#!/usr/bin/env node

/**
 * Test Excel Generation Script
 * 
 * Standalone script to test Excel file generation with sample vessel data.
 * Generates a test Excel file locally to verify format and structure.
 * 
 * Usage: npm run test-excel
 */

const ExcelJS = require('exceljs');
const fs = require('fs');
const path = require('path');

// Sample vessel data matching API response structure
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
      campaigns: {
        trend: 'Increasing trend in PSC inspections',
        recommendations: [
          'Ensure all covers are properly secured',
          'Inspect covers for damage before departure',
        ],
      },
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
      description: 'Hatchway covers require immediate attention',
      recommendation: 'Replace damaged covers and ensure proper securing',
      text: 'Critical issue with hatchway covers',
      status: 'Pending',
      dueDate: '2024-02-15',
    },
    {
      category: 'Fire safety',
      issueType: 'CRITICAL',
      priority: 'CRITICAL',
      severity: 'HIGH',
      campaignTrend: 'Standard compliance check',
      generalRecommendations: [
        'Review fire safety equipment maintenance records',
        'Conduct fire drill training for crew',
      ],
      internalChecklist: [
        'Fire extinguisher inspection',
        'Fire detection system test',
        'Emergency response plan review',
      ],
      externalChecklist: [
        'SOLAS compliance verification',
        'Port state control fire safety check',
      ],
    },
    {
      category: 'Navigation equipment',
      issueType: 'MODERATE',
      priority: 'MODERATE',
      severity: 'MEDIUM',
      campaignTrend: 'Standard compliance check',
      generalRecommendations: [
        'Review navigation equipment maintenance records',
        'Consider upgrading navigation equipment',
      ],
      internalChecklist: [
        'Equipment performance review',
        'Calibration check',
      ],
      externalChecklist: [
        'Industry best practices compliance',
        'Regulatory compliance verification',
      ],
    },
    {
      category: 'Life-saving appliances',
      issueType: 'MODERATE',
      priority: 'MODERATE',
      severity: 'MEDIUM',
      campaignTrend: 'Routine inspection',
      generalRecommendations: [
        'Verify lifeboat condition',
        'Check lifejacket inventory',
      ],
      internalChecklist: [
        'Life-saving equipment inventory',
        'Maintenance records review',
      ],
      externalChecklist: [
        'SOLAS compliance check',
      ],
    },
    {
      category: 'Cargo handling equipment',
      issueType: 'RECOMMENDED',
      priority: 'RECOMMENDED',
      severity: 'LOW',
      campaignTrend: 'Best practice recommendation',
      generalRecommendations: [
        'Consider upgrading cargo handling equipment',
        'Review operational procedures',
      ],
      internalChecklist: [
        'Equipment performance review',
        'Operational efficiency assessment',
      ],
      externalChecklist: [
        'Industry best practices compliance',
      ],
    },
    {
      category: 'Communication equipment',
      issueType: 'RECOMMENDED',
      priority: 'RECOMMENDED',
      severity: 'LOW',
      campaignTrend: 'Best practice recommendation',
      generalRecommendations: [
        'Review communication equipment maintenance',
      ],
      internalChecklist: [
        'Equipment functionality test',
      ],
      externalChecklist: [
        'Regulatory compliance verification',
      ],
    },
  ],
};

// Excel generation function (same as in generate-excel.js)
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
  recommendations.forEach((/** @type {any} */ rec) => {
    const row = worksheet.addRow({
      category: rec.category || rec.type || 'General',
      issueType: rec.issueType || rec.issue_type || '',
      campaignTrend: rec.campaignTrend || rec.campaign_trend || rec.trend || '',
      generalRecommendations: Array.isArray(rec.generalRecommendations)
        ? rec.generalRecommendations.join('\n')
        : rec.general_recommendations
          ? Array.isArray(rec.general_recommendations)
            ? rec.general_recommendations.join('\n')
            : rec.general_recommendations
          : rec.description || rec.recommendation || rec.text || '',
      internalChecklist: Array.isArray(rec.internalChecklist)
        ? rec.internalChecklist.join('\n')
        : rec.internal_checklist
          ? Array.isArray(rec.internal_checklist)
            ? rec.internal_checklist.join('\n')
            : rec.internal_checklist
          : '',
      externalChecklist: Array.isArray(rec.externalChecklist)
        ? rec.externalChecklist.join('\n')
        : rec.external_checklist
          ? Array.isArray(rec.external_checklist)
            ? rec.external_checklist.join('\n')
            : rec.external_checklist
          : '',
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

// Main test function
async function testExcelGeneration() {
  console.log('🧪 Testing Excel Generation...\n');
  console.log('='.repeat(60));

  try {
    // Generate Excel file
    console.log('📊 Generating Excel file from sample data...');
    const excelBuffer = await generateExcelFile(sampleVesselData);

    // Create output directory if it doesn't exist
    const outputDir = path.join(process.cwd(), 'test-output');
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    // Generate filename
    const vesselName = sampleVesselData.name.replace(/\s+/g, '_').toUpperCase();
    const dateStr = new Date().toISOString().split('T')[0]?.replace(/-/g, '') || '';
    const filename = `Recommendations_${vesselName}_${dateStr}.xlsx`;
    const filepath = path.join(outputDir, filename);

    // Save file
    fs.writeFileSync(filepath, /** @type {any} */ (excelBuffer), 'binary');

    // Get file stats
    const stats = fs.statSync(filepath);
    const fileSizeKB = (stats.size / 1024).toFixed(2);

    console.log('✅ Excel file generated successfully!\n');
    console.log('📁 File Details:');
    console.log(`   Location: ${filepath}`);
    console.log(`   Filename: ${filename}`);
    console.log(`   Size: ${fileSizeKB} KB`);
    console.log(`   Sheets: 4 (Summary, CRITICAL, MODERATE, RECOMMENDED)`);
    console.log(`   Critical items: ${sampleVesselData.recommendationsData.filter((r) => (r.priority || '').toUpperCase() === 'CRITICAL').length}`);
    console.log(`   Moderate items: ${sampleVesselData.recommendationsData.filter((r) => (r.priority || '').toUpperCase() === 'MODERATE').length}`);
    console.log(`   Recommended items: ${sampleVesselData.recommendationsData.filter((r) => (r.priority || '').toUpperCase() === 'RECOMMENDED').length}`);
    console.log('\n✨ Test completed successfully!');
    console.log(`\n💡 Open the file to verify the format: ${filepath}`);

    return { success: true, filepath, filename, size: fileSizeKB };
  } catch (error) {
    console.error('❌ Error generating Excel file:', error);
    const errorStack = error instanceof Error ? error.stack : String(error);
    console.error('Stack trace:', errorStack);
    process.exit(1);
  }
}

// Run the test
if (require.main === module) {
  testExcelGeneration()
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

module.exports = { generateExcelFile, testExcelGeneration };


