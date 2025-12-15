#!/usr/bin/env node

/**
 * Local Webhook Test Script
 * 
 * Simulates a WhatsApp webhook call locally for testing.
 * This allows you to test the webhook function with actual data
 * without deploying to Netlify.
 * 
 * Usage: 
 *   1. Set environment variables in .env file or export them
 *   2. node test-webhook-local.js "Risk score for gcl yamuna"
 */

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

// Load env vars
loadEnvFile();

// Get user message from command line or use default
const userMessage = process.argv[2] || 'Risk score for gcl yamuna';
const fromNumber = process.argv[3] || '+1234567890';

// Color codes
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

// Check required environment variables
const requiredEnvVars = [
  'ANTHROPIC_API_KEY',
  'TWILIO_ACCOUNT_SID',
  'TWILIO_AUTH_TOKEN',
  'VESSEL_API_URL',
];

const missingVars = requiredEnvVars.filter(key => !process.env[key]);

if (missingVars.length > 0) {
  log(`\n❌ Missing required environment variables: ${missingVars.join(', ')}`, 'red');
  log('\nPlease set these in your .env file:', 'yellow');
  log('ANTHROPIC_API_KEY=sk-ant-xxx...', 'cyan');
  log('TWILIO_ACCOUNT_SID=ACxxx...', 'cyan');
  log('TWILIO_AUTH_TOKEN=xxx...', 'cyan');
  log('VESSEL_API_URL=https://psc.ocean-eye.io/api/v1/vessels/dashboard/', 'cyan');
  log('\nOr export them in your shell before running this script.\n', 'yellow');
  process.exit(1);
}

// Create a mock event object that simulates Netlify function event
function createMockEvent(userMessage, fromNumber) {
  // Twilio sends data as URL-encoded form data
  const params = new URLSearchParams();
  params.append('Body', userMessage);
  params.append('From', fromNumber);
  params.append('To', process.env.TWILIO_WHATSAPP_NUMBER || 'whatsapp:+14155238886');
  
  return {
    httpMethod: 'POST',
    body: params.toString(),
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
  };
}

// Import and call the webhook handler
async function testWebhook() {
  log('\n🚀 Testing WhatsApp Webhook Locally', 'blue');
  log('='.repeat(60), 'blue');
  log(`\nUser Message: "${userMessage}"`, 'cyan');
  log(`From Number: ${fromNumber}`, 'cyan');
  log('\n');

  try {
    // Import the handler
    const handler = require('./netlify/functions/whatsapp-webhook');
    
    // Create mock event
    const event = createMockEvent(userMessage, fromNumber);
    
    log('Calling webhook handler...', 'yellow');
    
    // Call the handler
    const response = await handler.handler(event);
    
    log('\n✅ Webhook Response:', 'green');
    log('='.repeat(60), 'blue');
    log(`Status Code: ${response.statusCode}`, 'cyan');
    log(`Content Type: ${response.headers['Content-Type']}`, 'cyan');
    
    // Parse TwiML response to extract message
    const body = response.body || '';
    const messageMatch = body.match(/<Message>(.*?)<\/Message>/s);
    if (messageMatch) {
      const message = messageMatch[1]
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&apos;/g, "'");
      
      log('\n📱 WhatsApp Message Response:', 'blue');
      log('-'.repeat(60), 'blue');
      log(message, 'white');
      log('-'.repeat(60), 'blue');
    } else {
      log('\n📱 Raw Response Body:', 'blue');
      log(body.substring(0, 500), 'white');
    }
    
    log('\n' + '='.repeat(60), 'blue');
    log('✅ Test completed successfully', 'green');
    log('='.repeat(60) + '\n', 'blue');
    
  } catch (error) {
    log('\n❌ Error testing webhook:', 'red');
    log(`Error: ${error.message}`, 'red');
    if (error.stack) {
      log(`\nStack trace:`, 'red');
      log(error.stack.substring(0, 500), 'red');
    }
    process.exit(1);
  }
}

// Run the test
testWebhook();

