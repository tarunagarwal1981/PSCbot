#!/usr/bin/env node

/**
 * Test Vessel Lookup Script
 * 
 * Tests the vessel-lookup module with various inputs:
 * - Exact name matches
 * - Partial matches
 * - Case insensitivity
 * - IMO number lookups
 * 
 * Usage: node test/test-vessel-lookup.js
 */

const vesselLookup = require('../utils/vessel-lookup');

// Color codes for terminal output
const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const RESET = '\x1b[0m';

let testsPassed = 0;
let testsFailed = 0;

/**
 * Run a test and report results
 * @param {string} testName - Name of the test
 * @param {Function} testFn - Test function that returns true on success
 */
function runTest(testName, testFn) {
  try {
    const result = testFn();
    if (result) {
      console.log(`${GREEN}✓${RESET} ${testName}`);
      testsPassed++;
    } else {
      console.log(`${RED}✗${RESET} ${testName}`);
      testsFailed++;
    }
  } catch (error) {
    console.log(`${RED}✗${RESET} ${testName} - Error: ${error.message}`);
    testsFailed++;
  }
}

/**
 * Test exact name match
 */
function testExactNameMatch() {
  const result = vesselLookup.getVesselByName('GCL YAMUNA');
  return result !== null && result.name === 'GCL YAMUNA' && result.imo === '9481219';
}

/**
 * Test case insensitivity
 */
function testCaseInsensitivity() {
  const testCases = [
    'gcl yamuna',
    'GCL yamuna',
    'gcl YAMUNA',
    'Gcl Yamuna',
  ];
  
  for (const name of testCases) {
    const result = vesselLookup.getVesselByName(name);
    if (!result || result.name !== 'GCL YAMUNA' || result.imo !== '9481219') {
      return false;
    }
  }
  return true;
}

/**
 * Test partial matches
 */
function testPartialMatches() {
  const testCases = [
    { input: 'YAMUNA', expected: 'GCL YAMUNA' },
    { input: 'GCL', expected: 'GCL YAMUNA' }, // Should match first vessel starting with GCL
    { input: 'TAPI', expected: 'GCL TAPI' },
    { input: 'GANGA', expected: 'GCL GANGA' },
  ];
  
  for (const testCase of testCases) {
    const result = vesselLookup.getVesselByName(testCase.input);
    if (!result || result.name !== testCase.expected) {
      console.log(`  Partial match failed: "${testCase.input}" expected "${testCase.expected}", got ${result ? result.name : 'null'}`);
      return false;
    }
  }
  return true;
}

/**
 * Test IMO number lookup
 */
function testIMOLookup() {
  const testCases = [
    { imo: '9481219', expected: 'GCL YAMUNA' },
    { imo: '9481659', expected: 'GCL TAPI' },
    { imo: '9481697', expected: 'GCL GANGA' },
    { imo: 9481219, expected: 'GCL YAMUNA' }, // Test with number
  ];
  
  for (const testCase of testCases) {
    const result = vesselLookup.getVesselByIMO(testCase.imo);
    if (!result || result.name !== testCase.expected || result.imo !== String(testCase.imo)) {
      console.log(`  IMO lookup failed: "${testCase.imo}" expected "${testCase.expected}", got ${result ? result.name : 'null'}`);
      return false;
    }
  }
  return true;
}

/**
 * Test invalid inputs
 */
function testInvalidInputs() {
  // Test null/undefined
  if (vesselLookup.getVesselByName(null) !== null) return false;
  if (vesselLookup.getVesselByName(undefined) !== null) return false;
  if (vesselLookup.getVesselByName('') !== null) return false;
  if (vesselLookup.getVesselByName('   ') !== null) return false;
  
  // Test non-existent vessel
  if (vesselLookup.getVesselByName('NONEXISTENT VESSEL') !== null) return false;
  
  // Test invalid IMO
  if (vesselLookup.getVesselByIMO(null) !== null) return false;
  if (vesselLookup.getVesselByIMO('') !== null) return false;
  if (vesselLookup.getVesselByIMO('9999999') !== null) return false;
  
  return true;
}

/**
 * Test cache functionality
 */
function testCache() {
  // Clear cache first
  vesselLookup.clearCache();
  
  // First lookup should load from file
  const result1 = vesselLookup.getVesselByName('GCL YAMUNA');
  
  // Second lookup should use cache
  const result2 = vesselLookup.getVesselByName('GCL YAMUNA');
  
  // Both should return same result
  return result1 !== null && 
         result2 !== null && 
         result1.name === result2.name && 
         result1.imo === result2.imo;
}

/**
 * Main test runner
 */
function main() {
  console.log('\n🧪 Testing Vessel Lookup Module\n');
  console.log('=' .repeat(50));
  
  // Run all tests
  runTest('Exact name match', testExactNameMatch);
  runTest('Case insensitivity', testCaseInsensitivity);
  runTest('Partial matches', testPartialMatches);
  runTest('IMO number lookup', testIMOLookup);
  runTest('Invalid inputs handling', testInvalidInputs);
  runTest('Cache functionality', testCache);
  
  // Print summary
  console.log('\n' + '='.repeat(50));
  console.log(`\n📊 Test Results:`);
  console.log(`${GREEN}Passed: ${testsPassed}${RESET}`);
  if (testsFailed > 0) {
    console.log(`${RED}Failed: ${testsFailed}${RESET}`);
  } else {
    console.log(`${GREEN}Failed: ${testsFailed}${RESET}`);
  }
  console.log(`Total: ${testsPassed + testsFailed}\n`);
  
  // Exit with appropriate code
  process.exit(testsFailed > 0 ? 1 : 0);
}

// Run tests
main();

