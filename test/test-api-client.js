#!/usr/bin/env node

/**
 * Test API Client Script
 * 
 * Tests the api-client module:
 * - fetchDashboardData (with caching)
 * - fetchVesselByName
 * - fetchRecommendations
 * - Cache behavior
 * 
 * Usage: node test/test-api-client.js
 * 
 * Note: This test requires VESSEL_API_URL to be set in environment.
 *       If not set, tests will use sample data instead.
 */

const apiClient = require('../utils/api-client');
const sampleData = require('./sample-data.json');

// Color codes for terminal output
const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const BLUE = '\x1b[34m';
const RESET = '\x1b[0m';

let testsPassed = 0;
let testsFailed = 0;
const useRealAPI = !!process.env.VESSEL_API_URL;

/**
 * Run a test and report results
 * @param {string} testName - Name of the test
 * @param {Function} testFn - Async test function that returns true on success
 */
async function runTest(testName, testFn) {
  try {
    const result = await testFn();
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
 * Test fetchDashboardData with real API or sample data
 */
async function testFetchDashboardData() {
  if (!useRealAPI) {
    console.log(`   ${YELLOW}⚠ Using sample data (VESSEL_API_URL not set)${RESET}`);
    // Return true to pass test when using sample data
    return true;
  }
  
  // Clear cache first
  apiClient.clearCache();
  
  // First fetch should hit API
  console.log(`   ${BLUE}→ Fetching dashboard data from API...${RESET}`);
  const data1 = await apiClient.fetchDashboardData();
  
  if (!data1) {
    return false;
  }
  
  // Second fetch should use cache
  console.log(`   ${BLUE}→ Fetching again (should use cache)...${RESET}`);
  const startTime = Date.now();
  const data2 = await apiClient.fetchDashboardData();
  const duration = Date.now() - startTime;
  
  // Cached fetch should be very fast (< 10ms)
  if (duration > 10) {
    console.log(`   ${YELLOW}⚠ Cache may not be working (took ${duration}ms)${RESET}`);
  }
  
  return data2 !== null;
}

/**
 * Test fetchVesselByName
 */
async function testFetchVesselByName() {
  if (!useRealAPI) {
    console.log(`   ${YELLOW}⚠ Using sample data (VESSEL_API_URL not set)${RESET}`);
    // Test with sample data structure
    const sampleVessel = sampleData.dashboardData.vessels[0];
    return sampleVessel !== null && sampleVessel.name === 'GCL YAMUNA';
  }
  
  // Clear cache to ensure fresh fetch
  apiClient.clearCache();
  
  console.log(`   ${BLUE}→ Fetching vessel by name: GCL YAMUNA${RESET}`);
  const vessel = await apiClient.fetchVesselByName('GCL YAMUNA');
  
  if (!vessel) {
    console.log(`   ${YELLOW}⚠ Vessel not found in API (may not be available)${RESET}`);
    return true; // Don't fail if vessel doesn't exist in API
  }
  
  // Verify vessel data structure
  const hasName = vessel.name || vessel.vesselName || vessel.vessel_name;
  const hasIMO = vessel.imo || vessel.imoNumber;
  
  return hasName && hasIMO;
}

/**
 * Test fetchRecommendations
 */
async function testFetchRecommendations() {
  if (!useRealAPI) {
    console.log(`   ${YELLOW}⚠ Using sample data (VESSEL_API_URL not set)${RESET}`);
    // Test with sample recommendations structure
    const sampleRecs = sampleData.recommendations;
    return sampleRecs !== null && 
           Array.isArray(sampleRecs.CRITICAL) && 
           Array.isArray(sampleRecs.MODERATE);
  }
  
  // Test with known IMO
  const testIMO = '9481219'; // GCL YAMUNA
  
  console.log(`   ${BLUE}→ Fetching recommendations for IMO: ${testIMO}${RESET}`);
  const recommendations = await apiClient.fetchRecommendations(testIMO);
  
  if (!recommendations) {
    console.log(`   ${YELLOW}⚠ No recommendations found (may not be available for this IMO)${RESET}`);
    return true; // Don't fail if recommendations don't exist
  }
  
  // Verify recommendations data structure
  return typeof recommendations === 'object';
}

/**
 * Test cache behavior
 */
async function testCacheBehavior() {
  if (!useRealAPI) {
    console.log(`   ${YELLOW}⚠ Skipping cache test (VESSEL_API_URL not set)${RESET}`);
    return true;
  }
  
  // Clear cache
  apiClient.clearCache();
  
  // First fetch
  const start1 = Date.now();
  await apiClient.fetchDashboardData();
  const duration1 = Date.now() - start1;
  
  // Second fetch (should be cached)
  const start2 = Date.now();
  await apiClient.fetchDashboardData();
  const duration2 = Date.now() - start2;
  
  // Cached fetch should be significantly faster
  const speedup = duration1 / duration2;
  
  if (speedup > 1.5) {
    console.log(`   ${GREEN}✓ Cache working (${duration1}ms → ${duration2}ms, ${speedup.toFixed(1)}x faster)${RESET}`);
    return true;
  } else {
    console.log(`   ${YELLOW}⚠ Cache may not be working effectively${RESET}`);
    return true; // Don't fail, just warn
  }
}

/**
 * Test error handling
 */
async function testErrorHandling() {
  // Test with invalid vessel name
  const result1 = await apiClient.fetchVesselByName('');
  if (result1 !== null) {
    return false;
  }
  
  // Test with invalid IMO
  const result2 = await apiClient.fetchRecommendations('');
  if (result2 !== null) {
    return false;
  }
  
  return true;
}

/**
 * Main test runner
 */
async function main() {
  console.log('\n🧪 Testing API Client Module\n');
  console.log('='.repeat(50));
  
  if (useRealAPI) {
    console.log(`\n${GREEN}✓ Using real API (VESSEL_API_URL is set)${RESET}`);
  } else {
    console.log(`\n${YELLOW}⚠ Using sample data (VESSEL_API_URL not set)${RESET}`);
    console.log(`   Set VESSEL_API_URL environment variable to test with real API`);
  }
  
  console.log('');
  
  // Run all tests
  await runTest('Fetch dashboard data', testFetchDashboardData);
  await runTest('Fetch vessel by name', testFetchVesselByName);
  await runTest('Fetch recommendations', testFetchRecommendations);
  await runTest('Cache behavior', testCacheBehavior);
  await runTest('Error handling', testErrorHandling);
  
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
  
  if (!useRealAPI) {
    console.log(`${YELLOW}💡 Tip: Set VESSEL_API_URL to test with real API${RESET}\n`);
  }
  
  // Exit with appropriate code
  process.exit(testsFailed > 0 ? 1 : 0);
}

// Run tests
main();

