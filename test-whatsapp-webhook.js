#!/usr/bin/env node

/**
 * Test WhatsApp Webhook Script
 * 
 * This script tests the WhatsApp webhook functionality end-to-end:
 * - Intent detection with Claude API
 * - Vessel lookup
 * - API calls to fetch vessel data
 * 
 * Usage: node test-whatsapp-webhook.js
 */

const fetch = require('node-fetch');
const fs = require('fs');
const path = require('path');

// Load environment variables from .env file if it exists
function loadEnvFile() {
  const envPath = path.join(process.cwd(), '.env');
  if (fs.existsSync(envPath)) {
    try {
      const envContent = fs.readFileSync(envPath, 'utf8');
      envContent.split('\n').forEach((line) => {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith('#')) {
          const [key, ...valueParts] = trimmed.split('=');
          if (key && valueParts.length > 0) {
            const value = valueParts.join('=').replace(/^["']|["']$/g, '');
            process.env[key.trim()] = value.trim();
          }
        }
      });
      console.log('✓ Loaded .env file\n');
    } catch (error) {
      console.log('⚠ Could not load .env file:', error.message);
    }
  }
}

// Color codes for terminal output
const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const BLUE = '\x1b[34m';
const CYAN = '\x1b[36m';
const RESET = '\x1b[0m';

function log(message, color = 'white') {
  const colors = {
    green: GREEN,
    red: RED,
    yellow: YELLOW,
    blue: BLUE,
    cyan: CYAN,
    white: RESET,
  };
  console.log(`${colors[color]}${message}${RESET}`);
}

// Load environment variables
loadEnvFile();

// Check required environment variables
const requiredEnvVars = [
  'ANTHROPIC_API_KEY',
  'VESSEL_API_URL',
];

const missingVars = requiredEnvVars.filter(key => !process.env[key]);

if (missingVars.length > 0) {
  log(`\n❌ Missing required environment variables: ${missingVars.join(', ')}`, 'red');
  log('Please set these in your .env file or environment\n', 'yellow');
  process.exit(1);
}

// Import modules
const systemPrompts = require('./config/system-prompts');
const apiClient = require('./utils/api-client');
const vesselLookup = require('./utils/vessel-lookup');

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
const CLAUDE_MODEL = 'claude-sonnet-4-20250514';

function anthropicHeaders() {
  return {
    'Content-Type': 'application/json',
    'anthropic-version': '2023-06-01',
    'x-api-key': process.env.ANTHROPIC_API_KEY,
  };
}

/**
 * Test intent detection with Claude API
 */
async function testIntentDetection(userMessage) {
  log(`\n🔍 Testing Intent Detection`, 'blue');
  log(`User message: "${userMessage}"`, 'cyan');
  
  try {
    const prompt = systemPrompts.intentDetection(userMessage);
    
    const payload = {
      model: CLAUDE_MODEL,
      max_tokens: 200,
      temperature: 0,
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
    };

    log('Calling Claude API...', 'yellow');
    const resp = await fetch(ANTHROPIC_API_URL, {
      method: 'POST',
      headers: anthropicHeaders(),
      body: JSON.stringify(payload),
    });

    if (!resp.ok) {
      const text = await resp.text();
      log(`❌ Claude API error: ${resp.status}`, 'red');
      log(`Response: ${text.substring(0, 200)}`, 'red');
      return null;
    }

    const data = await resp.json();
    const contentText = (data?.content?.[0]?.text || '').trim();
    
    log(`✓ Claude API response received`, 'green');
    log(`Raw response: ${contentText.substring(0, 200)}...`, 'cyan');

    // Parse JSON response
    let intentResult;
    try {
      const jsonMatch = contentText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        intentResult = JSON.parse(jsonMatch[0]);
      } else {
        intentResult = JSON.parse(contentText);
      }
      
      log(`\n📊 Intent Detection Results:`, 'blue');
      log(`  Intent: ${intentResult.intent || 'null'}`, intentResult.intent && intentResult.intent !== 'unknown' ? 'green' : 'yellow');
      log(`  Vessel Identifier: ${intentResult.vessel_identifier || 'null'}`, intentResult.vessel_identifier ? 'green' : 'yellow');
      log(`  Confidence: ${intentResult.confidence || 'null'}`, 'cyan');
      
      return intentResult;
    } catch (parseErr) {
      log(`❌ Failed to parse JSON response`, 'red');
      log(`Parse error: ${parseErr.message}`, 'red');
      log(`Response text: ${contentText}`, 'red');
      return null;
    }
  } catch (error) {
    log(`❌ Error in intent detection: ${error.message}`, 'red');
    return null;
  }
}

/**
 * Test vessel lookup
 */
async function testVesselLookup(vesselIdentifier) {
  log(`\n🔍 Testing Vessel Lookup`, 'blue');
  log(`Vessel identifier: "${vesselIdentifier}"`, 'cyan');
  
  try {
    let vesselLookupResult = null;
    let imo = null;
    let vesselName = null;

    // Check if identifier is an IMO (numeric)
    if (/^\d+$/.test(vesselIdentifier.trim())) {
      log('Identifier appears to be an IMO number', 'yellow');
      imo = vesselIdentifier.trim();
      vesselLookupResult = vesselLookup.getVesselByIMO(imo);
      if (vesselLookupResult) {
        vesselName = vesselLookupResult.name;
        log(`✓ Found vessel by IMO: ${vesselName} (IMO: ${imo})`, 'green');
      } else {
        log(`❌ Vessel not found in lookup for IMO: ${imo}`, 'red');
      }
    } else {
      log('Identifier appears to be a vessel name', 'yellow');
      vesselLookupResult = vesselLookup.getVesselByName(vesselIdentifier);
      if (vesselLookupResult) {
        imo = vesselLookupResult.imo;
        vesselName = vesselLookupResult.name;
        log(`✓ Found vessel by name: ${vesselName} (IMO: ${imo})`, 'green');
      } else {
        log(`❌ Vessel not found in lookup for name: ${vesselIdentifier}`, 'red');
      }
    }

    if (!imo) {
      return null;
    }

    return { imo, vesselName, vesselLookupResult };
  } catch (error) {
    log(`❌ Error in vessel lookup: ${error.message}`, 'red');
    return null;
  }
}

/**
 * Test API call to fetch vessel data
 */
async function testVesselDataFetch(vesselName) {
  log(`\n🔍 Testing Vessel Data Fetch`, 'blue');
  log(`Vessel name: "${vesselName}"`, 'cyan');
  
  try {
    log('Calling API to fetch vessel data...', 'yellow');
    const vesselData = await apiClient.fetchVesselByName(vesselName);
    
    if (!vesselData) {
      log(`❌ Vessel data not found in API`, 'red');
      return null;
    }

    log(`✓ Vessel data fetched successfully`, 'green');
    log(`Vessel data keys: ${Object.keys(vesselData).join(', ')}`, 'cyan');
    
    // Show some key fields
    if (vesselData.name || vesselData.vesselName) {
      log(`  Name: ${vesselData.name || vesselData.vesselName}`, 'cyan');
    }
    if (vesselData.imo || vesselData.imoNumber) {
      log(`  IMO: ${vesselData.imo || vesselData.imoNumber}`, 'cyan');
    }
    if (vesselData.riskScore || vesselData.risk_score) {
      log(`  Risk Score: ${vesselData.riskScore || vesselData.risk_score}`, 'cyan');
    }
    if (vesselData.riskLevel || vesselData.risk_level) {
      log(`  Risk Level: ${vesselData.riskLevel || vesselData.risk_level}`, 'cyan');
    }
    
    return vesselData;
  } catch (error) {
    log(`❌ Error fetching vessel data: ${error.message}`, 'red');
    if (error.stack) {
      log(`Stack: ${error.stack.substring(0, 300)}`, 'red');
    }
    return null;
  }
}

/**
 * Test full flow for a user message
 */
async function testFullFlow(userMessage) {
  log(`\n${'='.repeat(60)}`, 'blue');
  log(`🧪 Testing Full Flow for: "${userMessage}"`, 'blue');
  log(`${'='.repeat(60)}`, 'blue');
  
  // Step 1: Intent Detection
  const intentResult = await testIntentDetection(userMessage);
  if (!intentResult) {
    log(`\n❌ Intent detection failed. Cannot continue.`, 'red');
    return;
  }

  if (!intentResult.vessel_identifier) {
    log(`\n⚠️ No vessel identifier found. Cannot continue.`, 'yellow');
    return;
  }

  if (intentResult.intent === 'unknown' || !intentResult.intent) {
    log(`\n⚠️ Intent is unknown. Cannot continue.`, 'yellow');
    return;
  }

  // Step 2: Vessel Lookup
  const lookupResult = await testVesselLookup(intentResult.vessel_identifier);
  if (!lookupResult) {
    log(`\n❌ Vessel lookup failed. Cannot continue.`, 'red');
    return;
  }

  // Step 3: Fetch Vessel Data
  const vesselData = await testVesselDataFetch(lookupResult.vesselName || intentResult.vessel_identifier);
  if (!vesselData) {
    log(`\n❌ Vessel data fetch failed. Cannot continue.`, 'red');
    return;
  }

  log(`\n✅ Full flow completed successfully!`, 'green');
}

/**
 * Main test runner
 */
async function main() {
  log('\n🚀 WhatsApp Webhook Test Suite', 'blue');
  log('='.repeat(60), 'blue');
  
  // Test cases from the screenshot
  const testCases = [
    'Risk score for gcl yamuna',
    'Risk level of gcl tapi',
    'Recommendations for GCL GANGA',
  ];

  // Run tests
  for (const testCase of testCases) {
    await testFullFlow(testCase);
    log('\n'); // Add spacing between tests
  }

  log('\n' + '='.repeat(60), 'blue');
  log('✅ Test suite completed', 'green');
  log('='.repeat(60) + '\n', 'blue');
}

// Run tests
main().catch(error => {
  log(`\n❌ Fatal error: ${error.message}`, 'red');
  if (error.stack) {
    log(`Stack: ${error.stack}`, 'red');
  }
  process.exit(1);
});

