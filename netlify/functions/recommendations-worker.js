const fetch = require('node-fetch');
const apiClient = require('../../utils/api-client');
const vesselLookup = require('../../utils/vessel-lookup');

// Send WhatsApp message via Twilio REST API
async function sendWhatsAppMessage(toNumber, body) {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const fromNumber = process.env.TWILIO_WHATSAPP_FROM; // e.g., 'whatsapp:+14155238886'

  if (!accountSid || !authToken || !fromNumber) {
    console.error('Missing Twilio env vars for outbound message');
    return;
  }

  const auth = Buffer.from(`${accountSid}:${authToken}`).toString('base64');
  const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;

  const params = new URLSearchParams();
  params.append('From', fromNumber);
  params.append('To', toNumber);
  params.append('Body', body);

  const resp = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params.toString(),
  });

  if (!resp.ok) {
    const text = await resp.text();
    console.error('Twilio send error', resp.status, text.substring(0, 200));
  }
}

function summarizeRecommendations(data) {
  const list =
    data?.recommendations ||
    data?.data ||
    data?.CRITICAL ||
    data?.critical ||
    [];

  const all = Array.isArray(list) ? list : [];
  const count = (p) =>
    all.filter(
      (r) => (r.priority || r.severity || '').toUpperCase() === p,
    ).length;

  const critical = count('CRITICAL') + count('HIGH');
  const moderate = count('MODERATE') + count('MEDIUM');
  const recommended = count('RECOMMENDED') + count('LOW');

  return {
    total: all.length,
    critical,
    moderate,
    recommended,
  };
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const payload = JSON.parse(event.body || '{}');
    const { fromNumber, vesselIdentifier } = payload;

    if (!fromNumber || !vesselIdentifier) {
      return { statusCode: 400, body: 'Missing fromNumber or vesselIdentifier' };
    }

    // Resolve IMO
    let lookup = null;
    if (/^\d+$/.test(vesselIdentifier.trim())) {
      lookup = vesselLookup.getVesselByIMO(vesselIdentifier.trim());
    } else {
      lookup = vesselLookup.getVesselByName(vesselIdentifier);
    }
    const imo = lookup?.imo || vesselIdentifier;
    const vesselName = lookup?.name || vesselIdentifier;

    // Fetch recommendations (may be slow)
    // Allow longer timeout here (background), default to 30s
    const recData = await apiClient.fetchRecommendations(imo, { timeoutMs: 30000 });

    if (!recData) {
      await sendWhatsAppMessage(
        fromNumber,
        `📋 Recommendations for ${vesselName} (IMO ${imo}) are unavailable right now. Please try again later.`,
      );
      return { statusCode: 200, body: 'Done' };
    }

    const summary = summarizeRecommendations(recData);
    const msg =
      `📋 Recommendations for ${vesselName} (IMO ${imo})\n` +
      `Total: ${summary.total}\n` +
      `• Critical: ${summary.critical}\n` +
      `• Moderate: ${summary.moderate}\n` +
      `• Recommended: ${summary.recommended}\n\n` +
      `Reply "1" to get the Excel file or "2" for email.`;

    await sendWhatsAppMessage(fromNumber, msg);

    return { statusCode: 200, body: 'Done' };
  } catch (err) {
    console.error('Worker error', err);
    return { statusCode: 500, body: 'Error' };
  }
};

