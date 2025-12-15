const fetch = require('node-fetch');
const fs = require('fs');
const path = require('path');

// Import utility modules
const systemPrompts = require('../../config/system-prompts');
const apiClient = require('../../utils/api-client');
const stateManager = require('../../utils/state-manager');
const vesselLookup = require('../../utils/vessel-lookup');

// Import Excel generation function
const { generateExcelFile } = require('./generate-excel');

const TEMP_DIR = '/tmp';

// Phone number to email mapping (for testing/demo purposes)
// In production, this should be stored in a database or retrieved from user profile
const PHONE_TO_EMAIL = {
  // Add phone numbers (with country code) mapped to emails
  // Example: '+1234567890': 'user@example.com',
  // You can also use environment variable for default email
};

/**
 * Get email address for a phone number
 * @param {string} phoneNumber - Phone number
 * @returns {string|null} Email address or null if not found
 */
function getEmailForPhone(phoneNumber) {
  // Check mapping first
  if (PHONE_TO_EMAIL[phoneNumber]) {
    return PHONE_TO_EMAIL[phoneNumber];
  }
  
  // Fallback to environment variable for testing
  const defaultEmail = process.env.DEFAULT_RECIPIENT_EMAIL || process.env.TEST_RECIPIENT_EMAIL;
  if (defaultEmail) {
    return defaultEmail;
  }
  
  return null;
}

/**
 * Calculate recommendations counts from recommendationsData
 * @param {any} recommendationsData - Recommendations data object
 * @returns {{critical: number, moderate: number, recommended: number}} Counts by priority
 */
function calculateRecommendationsCounts(recommendationsData) {
  // Handle different data structures
  const criticalData = recommendationsData.CRITICAL || recommendationsData.critical || [];
  const moderateData = recommendationsData.MODERATE || recommendationsData.moderate || [];
  const recommendedData = recommendationsData.RECOMMENDED || recommendationsData.recommended || [];
  
  // If data is in a flat array, count by priority/severity
  const allRecommendations = recommendationsData.recommendations || recommendationsData.data || [];
  
  let criticalCount = 0;
  let moderateCount = 0;
  let recommendedCount = 0;
  
  if (Array.isArray(criticalData)) {
    criticalCount = criticalData.length;
  }
  if (Array.isArray(moderateData)) {
    moderateCount = moderateData.length;
  }
  if (Array.isArray(recommendedData)) {
    recommendedCount = recommendedData.length;
  }
  
  // If counts are 0 but we have a flat array, calculate from array
  if (criticalCount === 0 && moderateCount === 0 && recommendedCount === 0 && Array.isArray(allRecommendations)) {
    criticalCount = allRecommendations.filter((/** @type {any} */ r) => 
      (r.priority || r.severity || '').toUpperCase() === 'CRITICAL' || 
      (r.priority || r.severity || '').toUpperCase() === 'HIGH'
    ).length;
    
    moderateCount = allRecommendations.filter((/** @type {any} */ r) => 
      (r.priority || r.severity || '').toUpperCase() === 'MODERATE' || 
      (r.priority || r.severity || '').toUpperCase() === 'MEDIUM'
    ).length;
    
    recommendedCount = allRecommendations.filter((/** @type {any} */ r) => 
      (r.priority || r.severity || '').toUpperCase() === 'RECOMMENDED' || 
      (r.priority || r.severity || '').toUpperCase() === 'LOW'
    ).length;
  }
  
  return {
    critical: criticalCount,
    moderate: moderateCount,
    recommended: recommendedCount,
  };
}

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
const CLAUDE_MODEL = 'claude-sonnet-4-20250514';
const SUPPORTED_INTENTS = [
  'risk_score',
  'risk_level',
  'recommendations',
  'vessel_info',
];

// Rate limiting configuration
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1 hour
const RATE_LIMIT_MAX_REQUESTS = 50; // Max requests per hour per user
const STATE_EXPIRY_MS = 10 * 60 * 1000; // 10 minutes

// In-memory rate limiting (in production, use Redis or similar)
const rateLimitStore = new Map();

/**
 * Logging utility with context
 * @param {string} level - Log level (info, warn, error)
 * @param {string} message - Log message
 * @param {any} context - Additional context object
 */
function log(level, message, context = {}) {
  const timestamp = new Date().toISOString();
  const contextStr = Object.keys(context).length > 0 ? ` ${JSON.stringify(context)}` : '';
  console[level](`[${timestamp}] [${level.toUpperCase()}] ${message}${contextStr}`);
}

/**
 * Check and update rate limit for a user
 * @param {string} phoneNumber - User's phone number
 * @returns {{allowed: boolean, remaining: number, resetAt: number}} Rate limit status
 */
function checkRateLimit(phoneNumber) {
  const now = Date.now();
  const userLimit = rateLimitStore.get(phoneNumber) || { count: 0, resetAt: now + RATE_LIMIT_WINDOW_MS };
  
  // Reset if window expired
  if (now > userLimit.resetAt) {
    userLimit.count = 0;
    userLimit.resetAt = now + RATE_LIMIT_WINDOW_MS;
  }
  
  const remaining = Math.max(0, RATE_LIMIT_MAX_REQUESTS - userLimit.count);
  const allowed = userLimit.count < RATE_LIMIT_MAX_REQUESTS;
  
  if (allowed) {
    userLimit.count++;
  }
  
  rateLimitStore.set(phoneNumber, userLimit);
  
  return {
    allowed,
    remaining,
    resetAt: userLimit.resetAt,
  };
}

/**
 * Check if state has expired
 * @param {any} state - State object
 * @returns {boolean} True if expired
 */
function isStateExpired(state) {
  if (!state || !state.timestamp) {
    return true;
  }
  const age = Date.now() - state.timestamp;
  return age > STATE_EXPIRY_MS;
}

/**
 * Create user-friendly vessel not found message
 * @param {string} vesselIdentifier - Vessel name or IMO that was searched
 * @returns {string} Error message
 */
function createVesselNotFoundMessage(vesselIdentifier) {
  return `I couldn't find a vessel named '${vesselIdentifier}'. Please check the spelling or try using the IMO number.\n\n` +
         `Try: 'Risk score for GCL YAMUNA' or 'Vessel 9481219'`;
}

/**
 * Create unclear intent message
 * @returns {string} Error message
 */
function createUnclearIntentMessage() {
  return `I'm not sure what you're asking. Try:\n` +
         `• 'Risk score for GCL YAMUNA'\n` +
         `• 'Risk level of GCL TAPI'\n` +
         `• 'Recommendations for GCL GANGA'`;
}

/**
 * @param {any} event
 */
exports.handler = async (event) => {
  log('info', 'WhatsApp webhook received', { 
    method: event.httpMethod,
    hasBody: !!event.body 
  });

  if (event.httpMethod !== 'POST') {
    log('warn', 'Invalid HTTP method', { method: event.httpMethod });
    return {
      statusCode: 405,
      headers: { 'Content-Type': 'text/plain' },
      body: 'Method Not Allowed',
    };
  }

  try {
    const envMissing = missingEnvVars([
      'ANTHROPIC_API_KEY',
      'TWILIO_ACCOUNT_SID',
      'TWILIO_AUTH_TOKEN',
      'VESSEL_API_URL',
    ]);
    if (envMissing.length) {
      log('error', 'Missing required environment variables', { missing: envMissing });
      const message = `Server misconfiguration: missing env vars ${envMissing.join(', ')}`;
      return xmlResponse(generateTwiMLResponse(message));
    }

    // Parse Twilio webhook parameters
    const params = new URLSearchParams(event.body || '');
    const userMessage = params.get('Body') || '';
    const fromNumber = params.get('From') || '';
    const toNumber = params.get('To') || '';
    
    if (!userMessage.trim()) {
      log('info', 'Empty message received', { fromNumber: fromNumber.substring(0, 4) + '****' });
      return xmlResponse(generateTwiMLResponse('Please send a vessel name or IMO to begin.'));
    }

    if (!fromNumber) {
      log('error', 'Missing From parameter in Twilio webhook');
      return xmlResponse(generateTwiMLResponse('Error: Missing sender information.'));
    }

    // Check rate limit
    const rateLimit = checkRateLimit(fromNumber);
    if (!rateLimit.allowed) {
      log('warn', 'Rate limit exceeded', { phoneNumber: fromNumber, remaining: rateLimit.remaining });
      return xmlResponse(generateTwiMLResponse(
        `⚠️ You've reached the rate limit. Please try again later.\n\n` +
        `Limit: ${RATE_LIMIT_MAX_REQUESTS} requests per hour.`
      ));
    }
    
    if (rateLimit.remaining < 5) {
      log('info', 'Rate limit warning', { phoneNumber: fromNumber, remaining: rateLimit.remaining });
    }

    // Check if user has pending state
    const existingState = stateManager.getState(fromNumber);
    
    if (existingState) {
      // Check if state has expired
      if (isStateExpired(existingState)) {
        log('info', 'State expired', { phoneNumber: fromNumber, stateAge: Date.now() - (existingState.timestamp || 0) });
        stateManager.clearState(fromNumber);
        return xmlResponse(generateTwiMLResponse(
          'Your session expired. Please send your request again.'
        ));
      }
      
      // User has pending state - check if responding to follow-up
      const normalizedMessage = userMessage.toLowerCase().trim();
      const isDownload = normalizedMessage === '1' || 
                        normalizedMessage === 'download' || 
                        normalizedMessage.includes('download');
      const isEmail = normalizedMessage === '2' || 
                     normalizedMessage === 'email' || 
                     normalizedMessage.includes('email');
      
      if (isDownload) {
        // User wants to download Excel
        log('info', 'Excel download requested', { phoneNumber: fromNumber, vessel: existingState.vesselName });
        return await handleExcelRequest(existingState, fromNumber);
      } else if (isEmail) {
        // User wants email delivery
        log('info', 'Email delivery requested', { phoneNumber: fromNumber, vessel: existingState.vesselName });
        return await handleEmailRequest(existingState, fromNumber);
      } else {
        // Not a valid follow-up response - clear state and process as new query
        log('info', 'Invalid follow-up response, clearing state', { phoneNumber: fromNumber, message: userMessage });
        stateManager.clearState(fromNumber);
        return await processNewQuery(userMessage, fromNumber);
      }
    } else {
      // No existing state - process as new query
      log('info', 'Processing new query', { phoneNumber: fromNumber, messageLength: userMessage.length });
      return await processNewQuery(userMessage, fromNumber);
    }
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    log('error', 'Unhandled error in main handler', { 
      error: errorMessage,
      stack: err instanceof Error ? err.stack : undefined
    });
    return xmlResponse(
      generateTwiMLResponse(
        'Sorry, something went wrong while processing your request. Please try again in a moment.'
      )
    );
  }
};

/**
 * Process a new user query
 * Uses intentDetection prompt to determine intent and vessel identifier
 * Routes to appropriate handler based on intent
 * @param {string} userMessage - User's message
 * @param {string} fromNumber - User's phone number
 * @returns {Promise<any>} TwiML response
 */
async function processNewQuery(userMessage, fromNumber) {
  try {
    log('info', 'Starting intent detection', { phoneNumber: fromNumber, message: userMessage });
    
    // Call Claude API with intentDetection prompt
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

    let resp;
    try {
      resp = await fetch(ANTHROPIC_API_URL, {
        method: 'POST',
        headers: anthropicHeaders(),
        body: JSON.stringify(payload),
      });
    } catch (fetchError) {
      log('error', 'Anthropic API fetch failed', { 
        phoneNumber: fromNumber, 
        error: fetchError instanceof Error ? fetchError.message : String(fetchError) 
      });
      return xmlResponse(generateTwiMLResponse(
        'Sorry, I\'m having trouble processing your request right now. Please try again in a moment.'
      ));
    }

    if (!resp.ok) {
      const text = await resp.text();
      log('error', 'Anthropic API error', { 
        phoneNumber: fromNumber, 
        status: resp.status,
        statusText: resp.statusText,
        response: text.substring(0, 500) 
      });
      // Log full error for debugging
      console.error('Full Anthropic API error response:', text);
      return xmlResponse(generateTwiMLResponse(createUnclearIntentMessage()));
    }

    const data = await resp.json();
    const contentText = (data?.content?.[0]?.text || '').trim();
    
    // Log the raw response for debugging
    log('info', 'Anthropic API response received', {
      phoneNumber: fromNumber,
      responseLength: contentText.length,
      responsePreview: contentText.substring(0, 200)
    });

    // Parse JSON response
    let intentResult;
    try {
      // Extract JSON from response (handle markdown code blocks if present)
      const jsonMatch = contentText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        intentResult = JSON.parse(jsonMatch[0]);
      } else {
        intentResult = JSON.parse(contentText);
      }
    } catch (parseErr) {
      log('error', 'Failed to parse intent detection response', { 
        phoneNumber: fromNumber, 
        parseError: parseErr instanceof Error ? parseErr.message : String(parseErr),
        responseText: contentText.substring(0, 500),
        fullResponse: contentText
      });
      // Log full response for debugging
      console.error('Full content text that failed to parse:', contentText);
      return xmlResponse(generateTwiMLResponse(createUnclearIntentMessage()));
    }

    const { vessel_identifier, intent, confidence } = intentResult || {};
    
    log('info', 'Intent detected', { 
      phoneNumber: fromNumber, 
      intent, 
      confidence, 
      vesselIdentifier: vessel_identifier 
    });

    // Validate intent
    if (!intent || intent === 'unknown' || !SUPPORTED_INTENTS.includes(intent)) {
      log('warn', 'Unclear or unsupported intent', { 
        phoneNumber: fromNumber, 
        intent, 
        message: userMessage 
      });
      return xmlResponse(generateTwiMLResponse(createUnclearIntentMessage()));
    }

    // Validate vessel identifier
    if (!vessel_identifier) {
      log('warn', 'Missing vessel identifier', { phoneNumber: fromNumber, intent });
      return xmlResponse(generateTwiMLResponse(
        'I need a vessel name or IMO number to help you.\n\n' +
        'Please include the vessel name or IMO in your message.\n\n' +
        'Example: "What is the risk score for GCL YAMUNA?"'
      ));
    }

    // Route to appropriate handler based on intent
    switch (intent) {
      case 'risk_score':
        return await handleRiskScoreIntent(vessel_identifier, fromNumber);
      
      case 'risk_level':
        return await handleRiskLevelIntent(vessel_identifier, fromNumber);
      
      case 'recommendations':
        return await handleRecommendationsIntent(vessel_identifier, fromNumber);
      
      case 'vessel_info':
        // TODO: Implement handleVesselInfoIntent
        return await handleVesselInfoIntent(vessel_identifier, fromNumber);
      
      default:
        return xmlResponse(generateTwiMLResponse(
          `Intent "${intent}" is not yet supported. Please try: risk score, risk level, recommendations, or vessel info.`
        ));
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    log('error', 'Error in processNewQuery', { 
      phoneNumber: fromNumber, 
      error: errorMessage 
    });
    return xmlResponse(generateTwiMLResponse(
      'Sorry, something went wrong while processing your request. Please try again in a moment.'
    ));
  }
}

/**
 * Handle Excel download request
 * @param {any} state - Conversation state with vessel data
 * @param {string} fromNumber - User's phone number
 * @returns {Promise<any>} TwiML response
 */
async function handleExcelRequest(state, fromNumber) {
  try {
    // Retrieve vessel data and recommendations data from state
    const vesselData = state.vesselData || {};
    const recommendationsData = state.recommendationsData || {};
    const vesselName = state.vesselName || vesselData.name || vesselData.vesselName || 'Unknown Vessel';

    if (!vesselData || Object.keys(vesselData).length === 0) {
      stateManager.clearState(fromNumber);
      return xmlResponse(generateTwiMLResponse(
        '❌ Error: Vessel data not found. Please start a new query.'
      ));
    }

    // Generate Excel file using internal function call
    const excelBuffer = await generateExcelFile(vesselData, recommendationsData);

    // Extract IMO for filename
    const imo = vesselData.imo || vesselData.imoNumber || state.vesselIMO || 'unknown';
    const timestamp = Date.now();
    const filename = `recommendations_${imo}_${timestamp}.xlsx`;
    const filepath = path.join(TEMP_DIR, filename);
    
    // Ensure temp directory exists
    if (!fs.existsSync(TEMP_DIR)) {
      fs.mkdirSync(TEMP_DIR, { recursive: true });
    }

    // Save file to /tmp directory
    fs.writeFileSync(filepath, /** @type {any} */ (excelBuffer), 'binary');

    // Generate download URL
    const baseUrl = process.env.URL || process.env.DEPLOY_PRIME_URL || 'https://your-site.netlify.app';
    const downloadUrl = `${baseUrl}/.netlify/functions/download-excel?file=${encodeURIComponent(filename)}`;

    // Clear state after successful generation
    stateManager.clearState(fromNumber);

    // Send message with download link
    const message = `📊 Here's your recommendations report for ${vesselName}:\n\n${downloadUrl}\n\n⚠️ Link expires in 10 minutes.`;
    
    log('info', 'Excel file generated successfully', { phoneNumber: fromNumber, vesselName, filename });
    
    return xmlResponse(generateTwiMLResponse(message));
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    log('error', 'Error in handleExcelRequest', { 
      phoneNumber: fromNumber, 
      error: errorMessage 
    });
    
    // Clear state on error to prevent stuck state
    stateManager.clearState(fromNumber);
    
    return xmlResponse(generateTwiMLResponse(
      `❌ Sorry, I encountered an error generating the Excel file.\n\n` +
      `Please try again or contact support.`
    ));
  }
}

/**
 * Handle email delivery request
 * @param {any} state - Conversation state with vessel data
 * @param {string} fromNumber - User's phone number
 * @returns {Promise<any>} TwiML response
 */
async function handleEmailRequest(state, fromNumber) {
  let excelFilePath = null;
  
  try {
    // Retrieve vessel data and recommendations data from state
    const vesselData = state.vesselData || {};
    const recommendationsData = state.recommendationsData || {};
    const vesselName = state.vesselName || vesselData.name || vesselData.vesselName || 'Unknown Vessel';
    const vesselIMO = state.vesselIMO || vesselData.imo || vesselData.imoNumber || 'N/A';

    if (!vesselData || Object.keys(vesselData).length === 0) {
      stateManager.clearState(fromNumber);
      return xmlResponse(generateTwiMLResponse(
        '❌ Error: Vessel data not found. Please start a new query.'
      ));
    }

    // Get recipient email from phone number mapping or default
    const recipientEmail = getEmailForPhone(fromNumber);
    if (!recipientEmail) {
      // Keep state so user can still download
      return xmlResponse(generateTwiMLResponse(
        `❌ Email address not found for your phone number.\n\n` +
        `Please use the download option instead. Reply '1' to download.`
      ));
    }

    // Generate Excel file using internal function call (same as download flow)
    const excelBuffer = await generateExcelFile(vesselData, recommendationsData);

    // Extract IMO for filename
    const imo = vesselData.imo || vesselData.imoNumber || state.vesselIMO || 'unknown';
    const timestamp = Date.now();
    const filename = `recommendations_${imo}_${timestamp}.xlsx`;
    excelFilePath = path.join(TEMP_DIR, filename);
    
    // Ensure temp directory exists
    if (!fs.existsSync(TEMP_DIR)) {
      fs.mkdirSync(TEMP_DIR, { recursive: true });
    }

    // Save file to /tmp directory
    fs.writeFileSync(excelFilePath, /** @type {any} */ (excelBuffer), 'binary');

    // Calculate recommendations counts
    const counts = calculateRecommendationsCounts(recommendationsData);

    // Extract risk information
    const riskScore = vesselData.riskScore || vesselData.risk_score || 'N/A';
    const riskLevel = vesselData.riskLevel || vesselData.risk_level || 'N/A';

    // Call send-email function via HTTP
    const baseUrl = process.env.URL || process.env.DEPLOY_PRIME_URL || 'https://your-site.netlify.app';
    const sendEmailUrl = `${baseUrl}/.netlify/functions/send-email`;

    const emailPayload = {
      recipientEmail: recipientEmail,
      vesselName: vesselName,
      vesselIMO: vesselIMO,
      excelFilePath: excelFilePath,
      recommendationsCounts: {
        critical: counts.critical,
        moderate: counts.moderate,
        recommended: counts.recommended,
      },
      riskScore: riskScore,
      riskLevel: riskLevel,
    };

    const emailResponse = await fetch(sendEmailUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(emailPayload),
    });

    if (!emailResponse.ok) {
      const errorData = await emailResponse.json().catch(() => ({}));
      const errorMessage = errorData.message || errorData.error || `HTTP ${emailResponse.status}`;
      
      // Clean up Excel file on error
      if (excelFilePath && fs.existsSync(excelFilePath)) {
        try {
          fs.unlinkSync(excelFilePath);
        } catch (cleanupError) {
          console.warn('Error cleaning up Excel file:', cleanupError);
        }
      }

      // Keep state so user can try download instead
      return xmlResponse(generateTwiMLResponse(
        `⚠️ Email delivery failed. Would you like to download instead? Reply '1'`
      ));
    }

    const emailResult = await emailResponse.json();

    // Clear state after successful email send
    stateManager.clearState(fromNumber);

    // Send confirmation message
    const message = `✅ Recommendations report for ${vesselName} has been sent to ${recipientEmail}. Please check your inbox.`;
    
    log('info', 'Email sent successfully', { phoneNumber: fromNumber, vesselName, recipientEmail });
    
    return xmlResponse(generateTwiMLResponse(message));
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    log('error', 'Error in handleEmailRequest', { 
      phoneNumber: fromNumber, 
      error: errorMessage 
    });
    
    // Clean up Excel file on error (best effort)
    if (excelFilePath && fs.existsSync(excelFilePath)) {
      try {
        fs.unlinkSync(excelFilePath);
      } catch (cleanupError) {
        log('warn', 'Error cleaning up Excel file', { 
          phoneNumber: fromNumber, 
          error: cleanupError instanceof Error ? cleanupError.message : String(cleanupError) 
        });
      }
    }

    // Keep state so user can try download instead
    return xmlResponse(generateTwiMLResponse(
      `⚠️ Email delivery failed. Would you like to download instead? Reply '1'`
    ));
  }
}

/**
 * Handle risk score intent
 * @param {string} vesselIdentifier - Vessel name or IMO
 * @param {string} fromNumber - User's phone number
 * @returns {Promise<any>} TwiML response
 */
async function handleRiskScoreIntent(vesselIdentifier, fromNumber) {
  try {
    log('info', 'Processing risk score intent', { phoneNumber: fromNumber, vesselIdentifier });
    
    // 1. Resolve vessel identifier to IMO using vessel-lookup
    let vesselLookupResult = null;
    let imo = null;
    let vesselName = null;

    // Check if identifier is an IMO (numeric)
    if (/^\d+$/.test(vesselIdentifier.trim())) {
      // It's an IMO number
      imo = vesselIdentifier.trim();
      vesselLookupResult = vesselLookup.getVesselByIMO(imo);
      if (vesselLookupResult) {
        vesselName = vesselLookupResult.name;
      }
    } else {
      // It's a vessel name - look it up
      vesselLookupResult = vesselLookup.getVesselByName(vesselIdentifier);
      if (vesselLookupResult) {
        imo = vesselLookupResult.imo;
        vesselName = vesselLookupResult.name;
      }
    }

    if (!imo) {
      log('warn', 'Vessel not found in lookup', { phoneNumber: fromNumber, vesselIdentifier });
      return xmlResponse(generateTwiMLResponse(createVesselNotFoundMessage(vesselIdentifier)));
    }

    // 2. Fetch vessel data using api-client
    let vesselData;
    try {
      vesselData = await apiClient.fetchVesselByName(vesselName || vesselIdentifier);
    } catch (apiError) {
      log('error', 'Dashboard API failed', { 
        phoneNumber: fromNumber, 
        vesselName: vesselName || vesselIdentifier,
        error: apiError instanceof Error ? apiError.message : String(apiError)
      });
      return xmlResponse(generateTwiMLResponse(
        'Sorry, I\'m having trouble accessing vessel data right now. Please try again in a moment.'
      ));
    }
    
    if (!vesselData) {
      log('warn', 'Vessel data not found in API', { phoneNumber: fromNumber, vesselName: vesselName || vesselIdentifier });
      return xmlResponse(generateTwiMLResponse(createVesselNotFoundMessage(vesselIdentifier)));
    }

    log('info', 'Vessel data fetched successfully', { phoneNumber: fromNumber, vesselName, imo });

    // 3. Call Claude API with riskScoreAnalysis prompt
    const prompt = systemPrompts.riskScoreAnalysis(vesselData);
    const analysis = await callClaude(prompt);

    if (!analysis) {
      log('error', 'Claude API analysis failed', { phoneNumber: fromNumber, vesselName });
      return xmlResponse(generateTwiMLResponse(
        `Sorry, I couldn't analyze the risk score for "${vesselName || vesselIdentifier}". Please try again in a moment.`
      ));
    }

    log('info', 'Risk score analysis completed', { phoneNumber: fromNumber, vesselName });
    
    // 4. Return analyzed response as TwiML
    return xmlResponse(generateTwiMLResponse(analysis));
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    log('error', 'Error in handleRiskScoreIntent', { 
      phoneNumber: fromNumber, 
      vesselIdentifier, 
      error: errorMessage 
    });
    return xmlResponse(generateTwiMLResponse(
      'Sorry, something went wrong while fetching the risk score. Please try again in a moment.'
    ));
  }
}

/**
 * Handle risk level intent
 * @param {string} vesselIdentifier - Vessel name or IMO
 * @param {string} fromNumber - User's phone number
 * @returns {Promise<any>} TwiML response
 */
async function handleRiskLevelIntent(vesselIdentifier, fromNumber) {
  try {
    log('info', 'Processing risk level intent', { phoneNumber: fromNumber, vesselIdentifier });
    
    // 1. Resolve vessel identifier to IMO using vessel-lookup
    let vesselLookupResult = null;
    let imo = null;
    let vesselName = null;

    // Check if identifier is an IMO (numeric)
    if (/^\d+$/.test(vesselIdentifier.trim())) {
      // It's an IMO number
      imo = vesselIdentifier.trim();
      vesselLookupResult = vesselLookup.getVesselByIMO(imo);
      if (vesselLookupResult) {
        vesselName = vesselLookupResult.name;
      }
    } else {
      // It's a vessel name - look it up
      vesselLookupResult = vesselLookup.getVesselByName(vesselIdentifier);
      if (vesselLookupResult) {
        imo = vesselLookupResult.imo;
        vesselName = vesselLookupResult.name;
      }
    }

    if (!imo) {
      log('warn', 'Vessel not found in lookup', { phoneNumber: fromNumber, vesselIdentifier });
      return xmlResponse(generateTwiMLResponse(createVesselNotFoundMessage(vesselIdentifier)));
    }

    // 2. Fetch vessel data using api-client
    let vesselData;
    try {
      vesselData = await apiClient.fetchVesselByName(vesselName || vesselIdentifier);
    } catch (apiError) {
      log('error', 'Dashboard API failed', { 
        phoneNumber: fromNumber, 
        vesselName: vesselName || vesselIdentifier,
        error: apiError instanceof Error ? apiError.message : String(apiError)
      });
      return xmlResponse(generateTwiMLResponse(
        'Sorry, I\'m having trouble accessing vessel data right now. Please try again in a moment.'
      ));
    }
    
    if (!vesselData) {
      log('warn', 'Vessel data not found in API', { phoneNumber: fromNumber, vesselName: vesselName || vesselIdentifier });
      return xmlResponse(generateTwiMLResponse(createVesselNotFoundMessage(vesselIdentifier)));
    }

    log('info', 'Vessel data fetched successfully', { phoneNumber: fromNumber, vesselName, imo });

    // 3. Call Claude API with riskLevelAnalysis prompt
    const prompt = systemPrompts.riskLevelAnalysis(vesselData);
    const analysis = await callClaude(prompt);

    if (!analysis) {
      log('error', 'Claude API analysis failed', { phoneNumber: fromNumber, vesselName });
      return xmlResponse(generateTwiMLResponse(
        `Sorry, I couldn't analyze the risk level for "${vesselName || vesselIdentifier}". Please try again in a moment.`
      ));
    }

    log('info', 'Risk level analysis completed', { phoneNumber: fromNumber, vesselName });
    
    // 4. Return analyzed response as TwiML
    return xmlResponse(generateTwiMLResponse(analysis));
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    log('error', 'Error in handleRiskLevelIntent', { 
      phoneNumber: fromNumber, 
      vesselIdentifier, 
      error: errorMessage 
    });
    return xmlResponse(generateTwiMLResponse(
      'Sorry, something went wrong while fetching the risk level. Please try again in a moment.'
    ));
  }
}

/**
 * Handle recommendations intent
 * @param {string} vesselIdentifier - Vessel name or IMO
 * @param {string} fromNumber - User's phone number
 * @returns {Promise<any>} TwiML response
 */
async function handleRecommendationsIntent(vesselIdentifier, fromNumber) {
  try {
    log('info', 'Processing recommendations intent', { phoneNumber: fromNumber, vesselIdentifier });
    
    // 1. Resolve vessel identifier to IMO using vessel-lookup
    let vesselLookupResult = null;
    let imo = null;
    let vesselName = null;

    // Check if identifier is an IMO (numeric)
    if (/^\d+$/.test(vesselIdentifier.trim())) {
      // It's an IMO number
      imo = vesselIdentifier.trim();
      vesselLookupResult = vesselLookup.getVesselByIMO(imo);
      if (vesselLookupResult) {
        vesselName = vesselLookupResult.name;
      }
    } else {
      // It's a vessel name - look it up
      vesselLookupResult = vesselLookup.getVesselByName(vesselIdentifier);
      if (vesselLookupResult) {
        imo = vesselLookupResult.imo;
        vesselName = vesselLookupResult.name;
      }
    }

    if (!imo) {
      log('warn', 'Vessel not found in lookup', { phoneNumber: fromNumber, vesselIdentifier });
      return xmlResponse(generateTwiMLResponse(createVesselNotFoundMessage(vesselIdentifier)));
    }

    // 2. Fetch vessel data from dashboard API
    let vesselData;
    try {
      vesselData = await apiClient.fetchVesselByName(vesselName || vesselIdentifier);
    } catch (apiError) {
      log('error', 'Dashboard API failed', { 
        phoneNumber: fromNumber, 
        vesselName: vesselName || vesselIdentifier,
        error: apiError instanceof Error ? apiError.message : String(apiError)
      });
      return xmlResponse(generateTwiMLResponse(
        'Sorry, I\'m having trouble accessing vessel data right now. Please try again in a moment.'
      ));
    }
    
    if (!vesselData) {
      log('warn', 'Vessel data not found in API', { phoneNumber: fromNumber, vesselName: vesselName || vesselIdentifier });
      return xmlResponse(generateTwiMLResponse(createVesselNotFoundMessage(vesselIdentifier)));
    }

    log('info', 'Vessel data fetched successfully', { phoneNumber: fromNumber, vesselName, imo });

    // 3. Fetch detailed recommendations from recommendations API
    let recommendationsData;
    try {
      recommendationsData = await apiClient.fetchRecommendations(imo);
    } catch (apiError) {
      log('error', 'Recommendations API failed', { 
        phoneNumber: fromNumber, 
        imo,
        vesselName,
        error: apiError instanceof Error ? apiError.message : String(apiError)
      });
      return xmlResponse(generateTwiMLResponse(
        'I found the vessel but couldn\'t retrieve recommendations. Please try again.'
      ));
    }
    
    if (!recommendationsData) {
      log('warn', 'Recommendations data not found', { phoneNumber: fromNumber, imo, vesselName });
      return xmlResponse(generateTwiMLResponse(
        'I found the vessel but couldn\'t retrieve recommendations. Please try again.'
      ));
    }

    log('info', 'Recommendations data fetched successfully', { phoneNumber: fromNumber, vesselName, imo });

    // 4. Call Claude API with recommendationsSummary prompt
    const prompt = systemPrompts.recommendationsSummary(recommendationsData);
    
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

    const resp = await fetch(ANTHROPIC_API_URL, {
      method: 'POST',
      headers: anthropicHeaders(),
      body: JSON.stringify(payload),
    });

    if (!resp.ok) {
      const text = await resp.text();
      log('warn', 'Anthropic API error, using fallback summary', { 
        phoneNumber: fromNumber, 
        status: resp.status,
        vesselName 
      });
      // Fallback: create simple summary if Claude fails
      const recommendations = recommendationsData?.recommendations || recommendationsData?.data || [];
      const critical = Array.isArray(recommendations) ? recommendations.filter((/** @type {any} */ r) => 
        (r.priority || r.severity || '').toUpperCase() === 'CRITICAL' || 
        (r.priority || r.severity || '').toUpperCase() === 'HIGH'
      ).length : 0;
      const moderate = Array.isArray(recommendations) ? recommendations.filter((/** @type {any} */ r) => 
        (r.priority || r.severity || '').toUpperCase() === 'MODERATE' || 
        (r.priority || r.severity || '').toUpperCase() === 'MEDIUM'
      ).length : 0;
      const recommended = Array.isArray(recommendations) ? recommendations.filter((/** @type {any} */ r) => 
        (r.priority || r.severity || '').toUpperCase() === 'RECOMMENDED' || 
        (r.priority || r.severity || '').toUpperCase() === 'LOW'
      ).length : 0;
      
      const summary = `📋 Found ${recommendations.length} recommendations:\n` +
        `• ${critical} critical\n` +
        `• ${moderate} moderate\n` +
        `• ${recommended} recommended`;
      
      const message = `📋 *Recommendations for ${vesselName || vesselIdentifier}*\n\n${summary}\n\n` +
        `How would you like to receive this?\n\n` +
        `1️⃣ Download Excel file\n` +
        `2️⃣ Email to your registered address\n\n` +
        `Reply with '1' or '2'`;
      
      // Save state with timestamp
      stateManager.saveState(fromNumber, {
        intent: 'recommendations',
        vesselName: vesselName || vesselIdentifier,
        vesselIMO: imo,
        vesselData: vesselData,
        recommendationsData: recommendationsData,
        timestamp: Date.now(),
      });
      
      log('info', 'State saved for recommendations follow-up', { phoneNumber: fromNumber, vesselName });
      
      return xmlResponse(generateTwiMLResponse(message));
    }

    const data = await resp.json();
    const summary = (data?.content?.[0]?.text || '').trim();

    // 5. Create response message
    const message = `📋 *Recommendations for ${vesselName || vesselIdentifier}*\n\n${summary}\n\n` +
      `How would you like to receive this?\n\n` +
      `1️⃣ Download Excel file\n` +
      `2️⃣ Email to your registered address\n\n` +
      `Reply with '1' or '2'`;

    // 6. Save state with all data for follow-up (Excel/Email)
    stateManager.saveState(fromNumber, {
      intent: 'recommendations',
      vesselName: vesselName || vesselIdentifier,
      vesselIMO: imo,
      vesselData: vesselData,
      recommendationsData: recommendationsData,
      timestamp: Date.now(),
    });

    log('info', 'State saved for recommendations follow-up', { phoneNumber: fromNumber, vesselName });

    // 7. Return TwiML response
    return xmlResponse(generateTwiMLResponse(message));
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    log('error', 'Error in handleRecommendationsIntent', { 
      phoneNumber: fromNumber, 
      vesselIdentifier, 
      error: errorMessage 
    });
    return xmlResponse(generateTwiMLResponse(
      'Sorry, something went wrong while fetching recommendations. Please try again in a moment.'
    ));
  }
}

/**
 * Handle vessel info intent
 * @param {string} vesselIdentifier - Vessel name or IMO
 * @param {string} fromNumber - User's phone number
 * @returns {Promise<any>} TwiML response
 */
async function handleVesselInfoIntent(vesselIdentifier, fromNumber) {
  // TODO: Implement vessel info handler
  // 1. Resolve vessel identifier to IMO using vessel-lookup
  // 2. Fetch vessel data using api-client
  // 3. Format and return vessel information
  return xmlResponse(generateTwiMLResponse(
    `Vessel info handler for "${vesselIdentifier}" - Coming soon!`
  ));
}

/**
 * Helper function to call Claude API
 * @param {string} prompt - The prompt to send to Claude
 * @param {number} temperature - Temperature setting (default: 0.7)
 * @param {number} maxTokens - Maximum tokens (default: 1000)
 * @returns {Promise<string|null>} Response text or null on error
 */
async function callClaude(prompt, temperature = 0.7, maxTokens = 1000) {
  try {
    const payload = {
      model: CLAUDE_MODEL,
      max_tokens: maxTokens,
      temperature: temperature,
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
    };

    const resp = await fetch(ANTHROPIC_API_URL, {
      method: 'POST',
      headers: anthropicHeaders(),
      body: JSON.stringify(payload),
    });

    if (!resp.ok) {
      const text = await resp.text();
      console.error(`Claude API error ${resp.status}: ${text}`);
      return null;
    }

    const data = await resp.json();
    const contentText = (data?.content?.[0]?.text || '').trim();
    
    if (!contentText) {
      console.error('Claude API returned empty response');
      return null;
    }

    return contentText;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('Error calling Claude API:', errorMessage);
    return null;
  }
}

/**
 * @param {string[]} keys
 */
function missingEnvVars(keys) {
  return keys.filter((/** @type { string } } */ k) => !process.env[k]);
}

// State management is now handled by utils/state-manager module

/**
 * @param {string} userMessage
 */
async function detectIntent(userMessage) {
  const systemPrompt = `
You are a maritime compliance assistant. Identify the user's intent and extract vessel identifiers.
Supported intents: ${SUPPORTED_INTENTS.join(', ')}.
Return a short JSON object with keys: intent (one of supported intents), vessel_name (optional), imo (optional).
If unsure, set intent to null.
  `.trim();

  const payload = {
    model: CLAUDE_MODEL,
    max_tokens: 200,
    system: systemPrompt,
    messages: [
      {
        role: 'user',
        content: `User message: """${userMessage}"""\nRespond with JSON only.`,
      },
    ],
  };

  const resp = await fetch(ANTHROPIC_API_URL, {
    method: 'POST',
    headers: anthropicHeaders(),
    body: JSON.stringify(payload),
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Anthropic intent error ${resp.status}: ${text}`);
  }

  const data = await resp.json();
  const contentText = (data?.content?.[0]?.text || '').trim();
  try {
    return JSON.parse(contentText);
  } catch (parseErr) {
    throw new Error(`Anthropic intent parse error: ${contentText}`);
  }
}

/**
 * @param {any} intentResponse
 */
async function fetchVesselData(intentResponse) {
  const { vessel_name, imo } = intentResponse || {};
  const vesselApiUrl = process.env.VESSEL_API_URL;
  if (!vesselApiUrl) {
    throw new Error('VESSEL_API_URL environment variable is not set');
  }
  const url = new URL(vesselApiUrl);
  if (imo) url.searchParams.set('imo', imo);
  if (vessel_name) url.searchParams.set('name', vessel_name);

  /** @type {Record<string, string>} */
  const headers = {
    Accept: 'application/json',
  };
  if (process.env.VESSEL_API_KEY) {
    headers['x-api-key'] = process.env.VESSEL_API_KEY;
  }

  const resp = await fetch(url.toString(), { headers });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Vessel API error ${resp.status}: ${text}`);
  }

  const payload = await resp.json();
  const vessel = Array.isArray(payload?.vessels) ? payload.vessels[0] : null;
  if (!vessel) {
    return null;
  }
  return vessel;
}

/**
 * @param {string} userMessage
 * @param {any} intentResponse
 * @param {any} vesselData
 * @param {string} phoneNumber
 */
async function formatResponse(userMessage, intentResponse, vesselData, phoneNumber) {
  if (!vesselData) {
    return 'No matching vessel found. Please provide the vessel name or IMO.';
  }

  const { intent } = intentResponse;

  // Handle recommendations intent - format directly without LLM
  if (intent === 'recommendations') {
    // Save state for follow-up question
    if (phoneNumber) {
      stateManager.saveState(phoneNumber, {
        intent: 'recommendations',
        vesselData,
        lastQuery: userMessage,
        waitingForFollowUp: true,
      });
    }
    return formatRecommendationsDirectly(vesselData);
  }

  // Handle risk_score and risk_level with enhanced analysis
  if (intent === 'risk_score' || intent === 'risk_level') {
    return await formatRiskAnalysis(userMessage, intent, vesselData);
  }

  // Default: Use Claude for other intents
  const systemPrompt = `
You are a concise maritime safety assistant crafting WhatsApp replies.
Use the provided intent and vessel data to answer naturally and briefly (<= 120 words).
If data is missing for the intent, say so politely and suggest another detail the user can request.
Avoid markdown; plain text only.
  `.trim();

  const payload = {
    model: CLAUDE_MODEL,
    max_tokens: 300,
    system: systemPrompt,
    messages: [
      {
        role: 'user',
        content: `
User message: """${userMessage}"""
Intent JSON: ${JSON.stringify(intentResponse)}
Vessel data JSON: ${JSON.stringify(vesselData)}
Compose the WhatsApp reply.
        `.trim(),
      },
    ],
  };

  try {
    const resp = await fetch(ANTHROPIC_API_URL, {
      method: 'POST',
      headers: anthropicHeaders(),
      body: JSON.stringify(payload),
    });

    if (!resp.ok) {
      const text = await resp.text();
      throw new Error(`Anthropic format error ${resp.status}: ${text}`);
    }

    const data = await resp.json();
    const contentText = (data?.content?.[0]?.text || '').trim();
    return contentText || 'Sorry, I could not generate a reply.';
  } catch (error) {
    console.error('Error in formatResponse:', error);
    return 'Sorry, I encountered an error formatting the response. Please try again.';
  }
}

/**
 * @param {any} vesselData
 * @param {any} intent
 */
function getRiskAnalysisPrompt(vesselData, intent) {
  if (intent === 'risk_score') {
    return `You are a maritime risk analyst. Analyze this vessel's risk score and provide a brief, actionable assessment.

Vessel Data:
${JSON.stringify(vesselData)}

Provide analysis in this format:
1. State the risk score and level clearly
2. Break down 3-4 key risk factors with their scores and what they mean
3. Provide a 2-3 sentence overall assessment
4. Keep it under 150 words
5. Use bullet points and emojis for readability (this is WhatsApp)
6. Be direct and professional, avoid marketing language

Focus on: What the numbers mean, why they matter, what needs attention.`;
  }

  if (intent === 'risk_level') {
    return `You are a maritime risk analyst. Explain this vessel's risk level in practical terms.

Vessel Data:
${JSON.stringify(vesselData)}

Provide analysis in this format:
1. State the risk level and label
2. Explain what this risk level means operationally
3. Identify 2-3 key factors contributing to this level
4. Compare to typical fleet standards if possible
5. Keep it under 150 words
6. Use bullet points and emojis for readability

Focus on: Practical implications, what operators should know, context for the rating.`;
  }

  return '';
}

/**
 * @param {string} userMessage
 * @param {any} intent
 * @param {any} vesselData
 */
async function formatRiskAnalysis(userMessage, intent, vesselData) {
  try {
    const systemPrompt = getRiskAnalysisPrompt(vesselData, intent);
    
    const payload = {
      model: CLAUDE_MODEL,
      max_tokens: 400,
      system: systemPrompt,
      messages: [
        {
          role: 'user',
          content: `Analyze the vessel risk data and provide the assessment.`,
        },
      ],
    };

    const resp = await fetch(ANTHROPIC_API_URL, {
      method: 'POST',
      headers: anthropicHeaders(),
      body: JSON.stringify(payload),
    });

    if (!resp.ok) {
      const text = await resp.text();
      throw new Error(`Anthropic risk analysis error ${resp.status}: ${text}`);
    }

    const data = await resp.json();
    const contentText = (data?.content?.[0]?.text || '').trim();
    return contentText || 'Sorry, I could not generate the risk analysis.';
  } catch (error) {
    console.error('Error in formatRiskAnalysis:', error);
    return 'Sorry, I encountered an error analyzing the risk data. Please try again.';
  }
}

/**
 * @param {any} vesselData
 */
function formatRecommendationsDirectly(vesselData) {
  try {
    const recommendations = vesselData.recommendationsData || vesselData.recommendations || [];
    
    if (!recommendations || recommendations.length === 0) {
      return 'No recommendations available for this vessel at this time.';
    }

    let message = '📋 *Vessel Recommendations*\n\n';
    
    recommendations.slice(0, 5).forEach((/** @type {any} */ rec, /** @type {number} */ index) => {
      const priority = rec.priority || rec.severity || 'Medium';
      const category = rec.category || rec.type || 'General';
      const description = rec.description || rec.recommendation || rec.text || 'No description';
      
      message += `${index + 1}. *${category}* (${priority})\n`;
      message += `   ${description}\n\n`;
    });

    if (recommendations.length > 5) {
      message += `... and ${recommendations.length - 5} more recommendations.\n\n`;
    }

    message += 'Report ready! How would you like to receive it?\n\n';
    message += '1️⃣ Download as Excel file\n';
    message += '2️⃣ Receive via email\n\n';
    message += 'Reply with "1" or "download" for Excel, or "2" or "email" for email delivery.';

    return message;
  } catch (error) {
    console.error('Error in formatRecommendationsDirectly:', error);
    return 'Sorry, I encountered an error formatting recommendations. Please try again.';
  }
}

/**
 * Handle Excel download request
 * @param {string} fromNumber - User's phone number
 * @param {object} vesselData - Vessel data for Excel generation
 */
async function handleExcelDownload(fromNumber, vesselData) {
  try {
    // Call the generate-excel function
    const baseUrl = process.env.URL || process.env.DEPLOY_PRIME_URL || 'https://your-site.netlify.app';
    const generateUrl = `${baseUrl}/.netlify/functions/generate-excel`;
    
    const excelResponse = await fetch(generateUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(vesselData),
    });

    if (!excelResponse.ok) {
      throw new Error(`Excel generation failed: ${excelResponse.status}`);
    }

    const excelResult = await excelResponse.json();
    
    return xmlResponse(generateTwiMLResponse(
      `📊 Excel file prepared!\n\n` +
      `File: ${excelResult.filename}\n` +
      `Download link: ${excelResult.downloadUrl}\n\n` +
      `⚠️ Link expires in 5 minutes\n\n` +
      `Click the link to download your vessel recommendations report.`
    ));
  } catch (error) {
    console.error('Error generating Excel:', error);
    return xmlResponse(generateTwiMLResponse(
      `❌ Sorry, I encountered an error generating the Excel file.\n\n` +
      `Please try again or contact support.`
    ));
  }
}

/**
 * Handle email delivery request
 * @param {string} fromNumber - User's phone number
 * @param {object} vesselData - Vessel data for email
 */
async function handleEmailDelivery(fromNumber, vesselData) {
  try {
    // Call the send-email function
    const baseUrl = process.env.URL || process.env.DEPLOY_PRIME_URL || 'https://your-site.netlify.app';
    const emailUrl = `${baseUrl}/.netlify/functions/send-email`;
    
    const emailResponse = await fetch(emailUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        phoneNumber: fromNumber,
        vesselData,
      }),
    });

    if (!emailResponse.ok) {
      const errorData = await emailResponse.json();
      
      // Check if email is required
      if (errorData.requiresEmail) {
        // Save state to ask for email
        stateManager.saveState(fromNumber, {
          intent: 'recommendations',
          vesselData,
          waitingForEmail: true,
          lastQuery: 'email delivery',
        });
        
        return xmlResponse(generateTwiMLResponse(
          `📧 To send via email, I need your email address.\n\n` +
          `Please reply with your email address, or use the download option instead.\n\n` +
          `Example: "myemail@example.com"`
        ));
      }
      
      throw new Error(`Email sending failed: ${emailResponse.status}`);
    }

    const emailResult = await emailResponse.json();
    
    return xmlResponse(generateTwiMLResponse(
      `📧 Email sent successfully!\n\n` +
      `Your recommendations report has been sent to:\n${emailResult.recipient}\n\n` +
      `Please check your inbox (and spam folder) for the Excel file attachment.`
    ));
  } catch (error) {
    console.error('Error sending email:', error);
    return xmlResponse(generateTwiMLResponse(
      `❌ Sorry, I encountered an error sending the email.\n\n` +
      `Please try again or use the download option instead.`
    ));
  }
}

/**
 * Handle email delivery with provided email address
 * @param {string} fromNumber - User's phone number
 * @param {object} vesselData - Vessel data for email
 * @param {string} emailAddress - User's email address
 */
async function handleEmailDeliveryWithEmail(fromNumber, vesselData, emailAddress) {
  try {
    // Call the send-email function with provided email
    const baseUrl = process.env.URL || process.env.DEPLOY_PRIME_URL || 'https://your-site.netlify.app';
    const emailUrl = `${baseUrl}/.netlify/functions/send-email`;
    
    const emailResponse = await fetch(emailUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        phoneNumber: fromNumber,
        vesselData,
        recipientEmail: emailAddress,
      }),
    });

    if (!emailResponse.ok) {
      const errorData = await emailResponse.json();
      throw new Error(errorData.message || `Email sending failed: ${emailResponse.status}`);
    }

    const emailResult = await emailResponse.json();
    
    return xmlResponse(generateTwiMLResponse(
      `📧 Email sent successfully!\n\n` +
      `Your recommendations report has been sent to:\n${emailResult.recipient}\n\n` +
      `Please check your inbox (and spam folder) for the Excel file attachment.`
    ));
  } catch (error) {
    console.error('Error sending email:', error);
    return xmlResponse(generateTwiMLResponse(
      `❌ Sorry, I encountered an error sending the email.\n\n` +
      `Error: ${error instanceof Error ? error.message : String(error)}\n\n` +
      `Please try again or use the download option instead.`
    ));
  }
}

/**
 * @param {any} vesselData
 */
function generateRecommendationsExcel(vesselData) {
  try {
    const recommendations = vesselData.recommendationsData || vesselData.recommendations || [];
    
    // Structure data for Excel generation
    const excelRows = recommendations.map((/** @type {any} */ rec, /** @type {number} */ index) => {
      return {
        'No.': index + 1,
        'Category': rec.category || rec.type || 'General',
        'Priority': rec.priority || rec.severity || 'Medium',
        'Description': rec.description || rec.recommendation || rec.text || '',
        'Status': rec.status || 'Pending',
        'Due Date': rec.dueDate || rec.targetDate || '',
        'Vessel Name': vesselData.name || '',
        'IMO': vesselData.imo || '',
      };
    });

    // In production, this would:
    // 1. Use a library like 'exceljs' to create actual Excel file
    // 2. Upload to cloud storage (S3, etc.)
    // 3. Return a signed URL for download
    // 4. Or send via email using a service like SendGrid, SES, etc.

    const filename = `vessel_recommendations_${vesselData.imo || vesselData.name || 'unknown'}_${Date.now()}.xlsx`;
    
    return {
      filename,
      rowCount: excelRows.length,
      data: excelRows,
      downloadUrl: process.env.EXCEL_DOWNLOAD_BASE_URL 
        ? `${process.env.EXCEL_DOWNLOAD_BASE_URL}/${filename}`
        : null,
      // In production, include actual file generation logic here
      // For now, return structured data ready for Excel generation
    };
  } catch (error) {
    console.error('Error in generateRecommendationsExcel:', error);
    throw new Error('Failed to generate Excel data structure');
  }
}

/**
 * @param {string} message
 */
function generateTwiMLResponse(message) {
  const safe = escapeXml(message || '');
  return `<?xml version="1.0" encoding="UTF-8"?>` +
    `<Response><Message>${safe}</Message></Response>`;
}

/**
 * @param {string} body
 */
function xmlResponse(body) {
  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'text/xml',
    },
    body,
  };
}

/**
 * @param {string} unsafe
 */
function escapeXml(unsafe) {
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function anthropicHeaders() {
  /** @type {Record<string, string>} */
  const headers = {
    'Content-Type': 'application/json',
    'anthropic-version': '2023-06-01',
  };
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (apiKey) {
    headers['x-api-key'] = apiKey;
  } else {
    log('error', 'ANTHROPIC_API_KEY is not set in environment variables');
  }
  return headers;
}

