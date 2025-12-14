const fetch = require('node-fetch');

// Import utility modules
const systemPrompts = require('../../config/system-prompts');
const apiClient = require('../../utils/api-client');
const stateManager = require('../../utils/state-manager');
const vesselLookup = require('../../utils/vessel-lookup');

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
const CLAUDE_MODEL = 'claude-sonnet-4-20250514';
const SUPPORTED_INTENTS = [
  'risk_score',
  'risk_level',
  'recommendations',
  'vessel_info',
];

/**
 * @param {any} event
 */
exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
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
      const message = `Server misconfiguration: missing env vars ${envMissing.join(', ')}`;
      return xmlResponse(generateTwiMLResponse(message));
    }

    // Parse Twilio webhook parameters
    const params = new URLSearchParams(event.body || '');
    const userMessage = params.get('Body') || '';
    const fromNumber = params.get('From') || '';
    const toNumber = params.get('To') || '';
    
    if (!userMessage.trim()) {
      return xmlResponse(generateTwiMLResponse('Please send a vessel name or IMO to begin.'));
    }

    if (!fromNumber) {
      console.error('Missing From parameter in Twilio webhook');
      return xmlResponse(generateTwiMLResponse('Error: Missing sender information.'));
    }

    // Check if user has pending state
    const existingState = stateManager.getState(fromNumber);
    
    if (existingState) {
      // User has pending state - check if responding to follow-up
        const normalizedMessage = userMessage.toLowerCase().trim();
        const isDownload = normalizedMessage === '1' || normalizedMessage === 'download' || normalizedMessage.includes('download');
        const isEmail = normalizedMessage === '2' || normalizedMessage === 'email' || normalizedMessage.includes('email');
        
          if (isDownload) {
            // User wants to download Excel
        stateManager.clearState(fromNumber);
        return await handleExcelRequest(fromNumber, existingState);
          } else if (isEmail) {
            // User wants email delivery
        stateManager.clearState(fromNumber);
        return await handleEmailRequest(fromNumber, existingState);
          } else {
        // Not a valid follow-up response - clear state and process as new query
        stateManager.clearState(fromNumber);
        return await processNewQuery(userMessage, fromNumber);
      }
    } else {
      // No existing state - process as new query
      return await processNewQuery(userMessage, fromNumber);
    }
  } catch (err) {
    console.error('whatsapp-webhook error', err);
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

    const resp = await fetch(ANTHROPIC_API_URL, {
      method: 'POST',
      headers: anthropicHeaders(),
      body: JSON.stringify(payload),
    });

    if (!resp.ok) {
      const text = await resp.text();
      throw new Error(`Anthropic API error ${resp.status}: ${text}`);
    }

    const data = await resp.json();
    const contentText = (data?.content?.[0]?.text || '').trim();

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
      console.error('Error parsing intent detection response:', parseErr);
      console.error('Response text:', contentText);
      throw new Error(`Failed to parse intent detection response: ${contentText}`);
    }

    const { vessel_identifier, intent, confidence } = intentResult || {};

    // Validate intent
    if (!intent || intent === 'unknown' || !SUPPORTED_INTENTS.includes(intent)) {
      return xmlResponse(generateTwiMLResponse(
        'Sorry, I could not determine what you need. Please specify:\n' +
        '• Risk score\n' +
        '• Risk level\n' +
        '• Recommendations\n' +
        '• Vessel info\n\n' +
        'Include a vessel name or IMO number.'
      ));
    }

    // Validate vessel identifier
    if (!vessel_identifier) {
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
    console.error('Error in processNewQuery:', errorMessage);
    return xmlResponse(generateTwiMLResponse(
      'Sorry, something went wrong while processing your request. Please try again in a moment.'
    ));
  }
}

/**
 * Handle Excel download request
 * @param {string} fromNumber - User's phone number
 * @param {any} state - Conversation state with vessel data
 * @returns {Promise<any>} TwiML response
 */
async function handleExcelRequest(fromNumber, state) {
  // TODO: Implement Excel download handler
  // Should use state.vesselData and state.recommendationsData
  return xmlResponse(generateTwiMLResponse(
    'Excel download feature coming soon!'
  ));
}

/**
 * Handle email delivery request
 * @param {string} fromNumber - User's phone number
 * @param {any} state - Conversation state with vessel data
 * @returns {Promise<any>} TwiML response
 */
async function handleEmailRequest(fromNumber, state) {
  // TODO: Implement email delivery handler
  // Should use state.vesselData and state.recommendationsData
  return xmlResponse(generateTwiMLResponse(
    'Email delivery feature coming soon!'
  ));
}

/**
 * Handle risk score intent
 * @param {string} vesselIdentifier - Vessel name or IMO
 * @param {string} fromNumber - User's phone number
 * @returns {Promise<any>} TwiML response
 */
async function handleRiskScoreIntent(vesselIdentifier, fromNumber) {
  try {
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
      return xmlResponse(generateTwiMLResponse(
        `❌ Could not find vessel "${vesselIdentifier}".\n\n` +
        `Please provide a valid vessel name or IMO number.\n\n` +
        `Example: "GCL YAMUNA" or "9481219"`
      ));
    }

    // 2. Fetch vessel data using api-client
    const vesselData = await apiClient.fetchVesselByName(vesselName || vesselIdentifier);
    if (!vesselData) {
      return xmlResponse(generateTwiMLResponse(
        `❌ Vessel not found.\n\n` +
        `Could not fetch data for "${vesselName || vesselIdentifier}".\n\n` +
        `Please verify the vessel name or IMO and try again.`
      ));
    }

    // 3. Call Claude API with riskScoreAnalysis prompt
    const prompt = systemPrompts.riskScoreAnalysis(vesselData);
    const analysis = await callClaude(prompt);

    if (!analysis) {
      return xmlResponse(generateTwiMLResponse(
        `❌ Could not analyze risk score for "${vesselName || vesselIdentifier}".\n\n` +
        `Please try again in a moment.`
      ));
    }

    // 4. Return analyzed response as TwiML
    return xmlResponse(generateTwiMLResponse(analysis));
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('Error in handleRiskScoreIntent:', errorMessage);
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
      return xmlResponse(generateTwiMLResponse(
        `❌ Could not find vessel "${vesselIdentifier}".\n\n` +
        `Please provide a valid vessel name or IMO number.\n\n` +
        `Example: "GCL YAMUNA" or "9481219"`
      ));
    }

    // 2. Fetch vessel data using api-client
    const vesselData = await apiClient.fetchVesselByName(vesselName || vesselIdentifier);
    if (!vesselData) {
      return xmlResponse(generateTwiMLResponse(
        `❌ Vessel not found.\n\n` +
        `Could not fetch data for "${vesselName || vesselIdentifier}".\n\n` +
        `Please verify the vessel name or IMO and try again.`
      ));
    }

    // 3. Call Claude API with riskLevelAnalysis prompt
    const prompt = systemPrompts.riskLevelAnalysis(vesselData);
    const analysis = await callClaude(prompt);

    if (!analysis) {
      return xmlResponse(generateTwiMLResponse(
        `❌ Could not analyze risk level for "${vesselName || vesselIdentifier}".\n\n` +
        `Please try again in a moment.`
      ));
    }

    // 4. Return analyzed response as TwiML
    return xmlResponse(generateTwiMLResponse(analysis));
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('Error in handleRiskLevelIntent:', errorMessage);
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
      return xmlResponse(generateTwiMLResponse(
        `❌ Could not find vessel "${vesselIdentifier}".\n\n` +
        `Please provide a valid vessel name or IMO number.\n\n` +
        `Example: "GCL YAMUNA" or "9481219"`
      ));
    }

    // 2. Fetch vessel data from dashboard API
    const vesselData = await apiClient.fetchVesselByName(vesselName || vesselIdentifier);
    if (!vesselData) {
      return xmlResponse(generateTwiMLResponse(
        `❌ Could not fetch vessel data for "${vesselName || vesselIdentifier}".\n\n` +
        `Please try again in a moment.`
      ));
    }

    // 3. Fetch detailed recommendations from recommendations API
    const recommendationsData = await apiClient.fetchRecommendations(imo);
    if (!recommendationsData) {
      return xmlResponse(generateTwiMLResponse(
        `❌ Could not fetch recommendations for "${vesselName || vesselIdentifier}".\n\n` +
        `This vessel may not have recommendations available.`
      ));
    }

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
      console.error(`Anthropic API error ${resp.status}: ${text}`);
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
      
      // Save state
      stateManager.saveState(fromNumber, {
        intent: 'recommendations',
        vesselName: vesselName || vesselIdentifier,
        vesselIMO: imo,
        vesselData: vesselData,
        recommendationsData: recommendationsData,
      });
      
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
    });

    // 7. Return TwiML response
    return xmlResponse(generateTwiMLResponse(message));
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('Error in handleRecommendationsIntent:', errorMessage);
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
  if (process.env.ANTHROPIC_API_KEY) {
    headers['x-api-key'] = process.env.ANTHROPIC_API_KEY;
  }
  return headers;
}

