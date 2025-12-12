const fetch = require('node-fetch');

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
const CLAUDE_MODEL = 'claude-sonnet-4-20250514';
const SUPPORTED_INTENTS = [
  'risk_score',
  'risk_level',
  'risk_breakdown',
  'recommendations',
  'inspection_info',
  'vessel_info',
  'psc_trends',
  'change_history',
  'campaigns',
];

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

    const params = new URLSearchParams(event.body || '');
    const userMessage = params.get('Body') || '';
    if (!userMessage.trim()) {
      return xmlResponse(generateTwiMLResponse('Please send a vessel name or IMO to begin.'));
    }

    const intentResponse = await detectIntent(userMessage);
    if (!intentResponse.intent || !SUPPORTED_INTENTS.includes(intentResponse.intent)) {
      return xmlResponse(
        generateTwiMLResponse(
          'Sorry, I could not determine what you need. Please specify risk score, risk level, breakdown, recommendations, inspection info, vessel info, PSC trends, change history, or campaigns.'
        )
      );
    }

    const vesselData = await fetchVesselData(intentResponse);
    const formatted = await formatResponse(userMessage, intentResponse, vesselData);
    return xmlResponse(generateTwiMLResponse(formatted));
  } catch (err) {
    console.error('whatsapp-webhook error', err);
    return xmlResponse(
      generateTwiMLResponse(
        'Sorry, something went wrong while processing your request. Please try again in a moment.'
      )
    );
  }
};

function missingEnvVars(keys) {
  return keys.filter((k) => !process.env[k]);
}

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

async function fetchVesselData(intentResponse) {
  const { vessel_name, imo } = intentResponse || {};
  const url = new URL(process.env.VESSEL_API_URL);
  if (imo) url.searchParams.set('imo', imo);
  if (vessel_name) url.searchParams.set('name', vessel_name);

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

async function formatResponse(userMessage, intentResponse, vesselData) {
  if (!vesselData) {
    return 'No matching vessel found. Please provide the vessel name or IMO.';
  }

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
}

function generateTwiMLResponse(message) {
  const safe = escapeXml(message || '');
  return `<?xml version="1.0" encoding="UTF-8"?>` +
    `<Response><Message>${safe}</Message></Response>`;
}

function xmlResponse(body) {
  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'text/xml',
    },
    body,
  };
}

function escapeXml(unsafe) {
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function anthropicHeaders() {
  return {
    'Content-Type': 'application/json',
    'x-api-key': process.env.ANTHROPIC_API_KEY,
    'anthropic-version': '2023-06-01',
  };
}

