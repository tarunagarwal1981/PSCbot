#!/usr/bin/env node

/**
 * Test Excel Generation Script
 * 
 * Tests Excel file generation with sample vessel data.
 * Generates a test Excel file locally and verifies it was created.
 * 
 * Usage: node test/test-excel-generation.js
 */

const { generateExcelFile } = require('../netlify/functions/generate-excel');
const fs = require('fs');
const path = require('path');
const sampleData = require('./sample-data.json');

// Color codes for terminal output
const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const RESET = '\x1b[0m';

const OUTPUT_DIR = path.join(__dirname, 'output');
const OUTPUT_FILE = path.join(OUTPUT_DIR, 'test-recommendations.xlsx');

/**
 * Ensure output directory exists
 */
function ensureOutputDir() {
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    console.log(`${YELLOW}Created output directory: ${OUTPUT_DIR}${RESET}`);
  }
}

/**
 * Main test function
 */
async function main() {
  console.log('\n🧪 Testing Excel Generation\n');
  console.log('='.repeat(50));
  
  try {
    // Prepare test data
    const vesselData = sampleData.vessel;
    const recommendationsData = sampleData.recommendations;
    
    console.log(`\n📋 Test Data:`);
    console.log(`   Vessel: ${vesselData.name} (IMO: ${vesselData.imo})`);
    console.log(`   Risk Score: ${vesselData.riskScore} (${vesselData.riskLevel})`);
    console.log(`   Critical Items: ${recommendationsData.CRITICAL.length}`);
    console.log(`   Moderate Items: ${recommendationsData.MODERATE.length}`);
    console.log(`   Recommended Items: ${recommendationsData.RECOMMENDED.length}`);
    
    // Generate Excel file
    console.log(`\n📊 Generating Excel file...`);
    const startTime = Date.now();
    const excelBuffer = await generateExcelFile(vesselData, recommendationsData);
    const duration = Date.now() - startTime;
    
    if (!excelBuffer) {
      console.log(`${RED}✗ Failed: Excel buffer is null or undefined${RESET}`);
      process.exit(1);
    }
    
    console.log(`${GREEN}✓${RESET} Excel file generated in ${duration}ms`);
    console.log(`   Buffer size: ${(excelBuffer.length / 1024).toFixed(2)} KB`);
    
    // Ensure output directory exists
    ensureOutputDir();
    
    // Save file
    console.log(`\n💾 Saving file to: ${OUTPUT_FILE}`);
    fs.writeFileSync(OUTPUT_FILE, excelBuffer, 'binary');
    
    // Verify file exists
    if (!fs.existsSync(OUTPUT_FILE)) {
      console.log(`${RED}✗ Failed: File was not created${RESET}`);
      process.exit(1);
    }
    
    const stats = fs.statSync(OUTPUT_FILE);
    console.log(`${GREEN}✓${RESET} File saved successfully`);
    console.log(`   File size: ${(stats.size / 1024).toFixed(2)} KB`);
    console.log(`   Created: ${stats.birthtime.toLocaleString()}`);
    
    // Test file is valid (check for Excel magic bytes)
    const fileBuffer = fs.readFileSync(OUTPUT_FILE);
    const magicBytes = fileBuffer.slice(0, 4);
    const isZipFile = magicBytes[0] === 0x50 && magicBytes[1] === 0x4B; // PK (ZIP header)
    
    if (isZipFile) {
      console.log(`${GREEN}✓${RESET} File format valid (ZIP/Excel format)`);
    } else {
      console.log(`${YELLOW}⚠${RESET} Warning: File may not be valid Excel format`);
    }
    
    // Print summary
    console.log('\n' + '='.repeat(50));
    console.log(`\n✅ Excel Generation Test: ${GREEN}PASSED${RESET}`);
    console.log(`\n📁 Output file: ${OUTPUT_FILE}`);
    console.log(`\n💡 You can now open the file to inspect its contents.`);
    console.log(`   On macOS: open "${OUTPUT_FILE}"`);
    console.log(`   On Linux: xdg-open "${OUTPUT_FILE}"`);
    console.log(`   On Windows: start "${OUTPUT_FILE}"\n`);
    
  } catch (error) {
    console.error(`\n${RED}✗ Test Failed:${RESET}`);
    console.error(`   Error: ${error.message}`);
    if (error.stack) {
      console.error(`\n   Stack trace:`);
      console.error(error.stack);
    }
    process.exit(1);
  }
}

// Run test
main();

