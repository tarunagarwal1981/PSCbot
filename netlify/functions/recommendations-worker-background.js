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

exports.handler = async (event, context, callback) => {
  // Background functions must use callback; they can run up to 15 minutes
  console.log('Background recommendations worker invoked');

  const done = (statusCode, body) => {
    callback(null, { statusCode, body });
  };

  try {
    const payload = JSON.parse(event.body || '{}');
    const { fromNumber, vesselIdentifier } = payload;

    if (!fromNumber || !vesselIdentifier) {
      return done(400, 'Missing fromNumber or vesselIdentifier');
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

    console.log('Fetching recommendations in background', { imo, vesselName, fromNumber });

    // Fetch recommendations (allow long timeout, e.g. 4 minutes)
    const recData = await apiClient.fetchRecommendations(imo, { timeoutMs: 240000 });

    if (!recData) {
      await sendWhatsAppMessage(
        fromNumber,
        `📋 Recommendations for ${vesselName} (IMO ${imo}) are unavailable right now. Please try again later.`
      );
      return done(200, 'Done');
    }

    let msg;
    if (typeof recData.rawText === 'string') {
      const header = `📋 Recommendations for ${vesselName} (IMO ${imo})\n\n`;
      const maxLen = 5000;
      let body = recData.rawText.trim();
      if (body.length > maxLen) {
        body = body.slice(0, maxLen) + '\n\n...[truncated]';
      }
      msg = header + body;
    } else {
      msg = `📋 Recommendations for ${vesselName} (IMO ${imo}) are ready, but could not be formatted automatically.`;
    }

    await sendWhatsAppMessage(fromNumber, msg);

    return done(200, 'Done');
  } catch (err) {
    console.error('Background worker error', err);
    return done(500, 'Error');
  }
};


