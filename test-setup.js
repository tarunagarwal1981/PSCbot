#!/usr/bin/env node

/**
 * Test Setup Script
 * Verifies environment configuration and tests API connections
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

// ANSI color codes
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

// Required environment variables
const REQUIRED_ENV_VARS = [
  'ANTHROPIC_API_KEY',
  'TWILIO_ACCOUNT_SID',
  'TWILIO_AUTH_TOKEN',
  'VESSEL_API_URL',
];

const OPTIONAL_ENV_VARS = ['VESSEL_API_KEY'];

// Helper functions
function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function maskValue(value) {
  if (!value || value.length <= 8) return '***';
  return value.substring(0, 8) + '...';
}

function loadEnvFile() {
  const envPath = path.join(process.cwd(), '.env');
  if (fs.existsSync(envPath)) {
    try {
      // Try to use dotenv if available
      try {
        require('dotenv').config();
        log('✓ Loaded .env file using dotenv', 'green');
        return true;
      } catch (e) {
        // If dotenv not available, parse manually
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
        log('✓ Loaded .env file manually', 'green');
        return true;
      }
    } catch (error) {
      log(`⚠ Warning: Could not load .env file: ${error.message}`, 'yellow');
      return false;
    }
  } else {
    log('ℹ No .env file found, using system environment variables', 'cyan');
    return false;
  }
}

function checkEnvVars() {
  log('\n📋 Checking Environment Variables...', 'blue');
  const missing = [];
  const present = [];

  REQUIRED_ENV_VARS.forEach((varName) => {
    const value = process.env[varName];
    if (!value || value.trim() === '') {
      missing.push(varName);
      log(`  ✗ ${varName}: MISSING`, 'red');
    } else {
      present.push(varName);
      log(`  ✓ ${varName}: ${maskValue(value)}`, 'green');
    }
  });

  OPTIONAL_ENV_VARS.forEach((varName) => {
    const value = process.env[varName];
    if (value && value.trim() !== '') {
      log(`  ✓ ${varName}: ${maskValue(value)} (optional)`, 'green');
    } else {
      log(`  ⚠ ${varName}: Not set (optional)`, 'yellow');
    }
  });

  return { missing, present };
}

function makeHttpsRequest(url, options = {}) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const requestOptions = {
      hostname: urlObj.hostname,
      port: urlObj.port || 443,
      path: urlObj.pathname + urlObj.search,
      method: options.method || 'GET',
      headers: options.headers || {},
    };

    const req = https.request(requestOptions, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          body: data,
        });
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    if (options.body) {
      req.write(options.body);
    }

    req.setTimeout(10000, () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });

    req.end();
  });
}

async function testAnthropicAPI() {
  log('\n🤖 Testing Anthropic API Connection...', 'blue');
  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (!apiKey) {
    log('  ✗ Cannot test: ANTHROPIC_API_KEY not set', 'red');
    return { success: false, error: 'API key not set' };
  }

  try {
    const requestBody = JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 10,
      messages: [
        {
          role: 'user',
          content: 'Say "test"',
        },
      ],
    });

    const response = await makeHttpsRequest('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: requestBody,
    });

    if (response.statusCode === 200) {
      log('  ✓ Anthropic API: Connection successful', 'green');
      return { success: true };
    } else if (response.statusCode === 401) {
      log('  ✗ Anthropic API: Authentication failed (invalid API key)', 'red');
      return { success: false, error: 'Invalid API key' };
    } else {
      log(`  ✗ Anthropic API: Unexpected status ${response.statusCode}`, 'red');
      log(`  Response: ${response.body.substring(0, 200)}`, 'yellow');
      return { success: false, error: `Status ${response.statusCode}` };
    }
  } catch (error) {
    log(`  ✗ Anthropic API: Connection failed - ${error.message}`, 'red');
    return { success: false, error: error.message };
  }
}

async function testVesselAPI() {
  log('\n🚢 Testing Vessel API Connection...', 'blue');
  const apiUrl = process.env.VESSEL_API_URL;
  const apiKey = process.env.VESSEL_API_KEY;

  if (!apiUrl) {
    log('  ⚠ Cannot test: VESSEL_API_URL not set', 'yellow');
    return { success: false, error: 'API URL not set', skipped: true };
  }

  try {
    const urlObj = new URL(apiUrl);
    const headers = {
      'Content-Type': 'application/json',
    };

    if (apiKey) {
      headers['Authorization'] = `Bearer ${apiKey}`;
      headers['X-API-Key'] = apiKey;
    }

    // Try a simple GET request (or POST with minimal data)
    const testUrl = apiUrl.endsWith('/') ? apiUrl : apiUrl + '/';
    const response = await makeHttpsRequest(testUrl, {
      method: 'GET',
      headers,
    });

    if (response.statusCode >= 200 && response.statusCode < 300) {
      log('  ✓ Vessel API: Connection successful', 'green');
      return { success: true };
    } else if (response.statusCode === 401 || response.statusCode === 403) {
      log('  ⚠ Vessel API: Authentication may be required', 'yellow');
      log(`  Status: ${response.statusCode}`, 'yellow');
      return { success: false, error: 'Authentication required', warning: true };
    } else {
      log(`  ⚠ Vessel API: Status ${response.statusCode}`, 'yellow');
      log(`  Response: ${response.body.substring(0, 200)}`, 'yellow');
      return { success: false, error: `Status ${response.statusCode}`, warning: true };
    }
  } catch (error) {
    if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
      log(`  ✗ Vessel API: Cannot reach ${apiUrl}`, 'red');
      log(`  Error: ${error.message}`, 'red');
    } else {
      log(`  ⚠ Vessel API: Connection issue - ${error.message}`, 'yellow');
    }
    return { success: false, error: error.message, warning: true };
  }
}

function printSummary(results) {
  log('\n' + '='.repeat(60), 'cyan');
  log('📊 Test Summary', 'blue');
  log('='.repeat(60), 'cyan');

  const { envCheck, anthropicTest, vesselTest } = results;

  // Environment variables
  if (envCheck.missing.length === 0) {
    log('✓ All required environment variables are set', 'green');
  } else {
    log(`✗ Missing ${envCheck.missing.length} required environment variable(s)`, 'red');
    envCheck.missing.forEach((varName) => {
      log(`  - ${varName}`, 'red');
    });
  }

  // Anthropic API
  if (anthropicTest.success) {
    log('✓ Anthropic API connection successful', 'green');
  } else {
    log('✗ Anthropic API connection failed', 'red');
    if (anthropicTest.error) {
      log(`  Error: ${anthropicTest.error}`, 'red');
    }
  }

  // Vessel API
  if (vesselTest.skipped) {
    log('⚠ Vessel API test skipped (URL not set)', 'yellow');
  } else if (vesselTest.success) {
    log('✓ Vessel API connection successful', 'green');
  } else if (vesselTest.warning) {
    log('⚠ Vessel API connection has issues (may still work)', 'yellow');
  } else {
    log('✗ Vessel API connection failed', 'red');
    if (vesselTest.error) {
      log(`  Error: ${vesselTest.error}`, 'red');
    }
  }

  log('\n📝 Next Steps:', 'blue');
  if (envCheck.missing.length > 0) {
    log('1. Set missing environment variables in .env file or system environment', 'yellow');
    log('2. Copy .env.example to .env and fill in your values', 'yellow');
  }
  if (!anthropicTest.success) {
    log('3. Verify ANTHROPIC_API_KEY at: https://console.anthropic.com/settings/keys', 'yellow');
  }
  if (!vesselTest.success && !vesselTest.skipped) {
    log('4. Verify VESSEL_API_URL and VESSEL_API_KEY (if required)', 'yellow');
  }
  if (envCheck.missing.length === 0 && anthropicTest.success) {
    log('✓ Configuration looks good! You can start the development server:', 'green');
    log('  npm run dev', 'cyan');
  }

  log('\n' + '='.repeat(60), 'cyan');
}

// Main execution
async function main() {
  log('🧪 WhatsApp Chatbot - Environment Test Setup', 'cyan');
  log('='.repeat(60), 'cyan');

  // Load environment variables
  loadEnvFile();

  // Check environment variables
  const envCheck = checkEnvVars();

  // Test API connections
  const anthropicTest = await testAnthropicAPI();
  const vesselTest = await testVesselAPI();

  // Print summary
  printSummary({ envCheck, anthropicTest, vesselTest });

  // Exit with appropriate code
  const hasErrors =
    envCheck.missing.length > 0 || (!anthropicTest.success && !anthropicTest.error?.includes('not set'));

  process.exit(hasErrors ? 1 : 0);
}

// Run the tests
main().catch((error) => {
  log(`\n✗ Fatal error: ${error.message}`, 'red');
  console.error(error);
  process.exit(1);
});
