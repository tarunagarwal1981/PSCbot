# Quick Start Guide

Get your WhatsApp chatbot up and running in ~20 minutes.

## Prerequisites

Before you begin, ensure you have:

- **Node.js** (v14 or higher) installed
- **npm** (comes with Node.js)
- **Git** installed
- **Anthropic account** - [Sign up](https://console.anthropic.com/)
- **Twilio account** - [Sign up](https://www.twilio.com/try-twilio)
- **Netlify account** - [Sign up](https://app.netlify.com/signup)
- **Vessel API access** - Your vessel data API endpoint and credentials

---

## Step 1: Get API Keys (5 minutes)

### 1.1 Anthropic API Key

1. Go to [Anthropic Console](https://console.anthropic.com/settings/keys)
2. Click **"Create Key"**
3. Copy your API key (starts with `sk-ant-`)
4. Save it securely - you won't see it again

### 1.2 Twilio Credentials

1. Go to [Twilio Console](https://console.twilio.com/)
2. Find your **Account SID** (starts with `AC`) on the dashboard
3. Find your **Auth Token** - click "Show" to reveal it
4. Copy both values

---

## Step 2: Join WhatsApp Sandbox (3 minutes)

1. Go to [Twilio WhatsApp Sandbox](https://console.twilio.com/us1/develop/sms/sandbox)
2. You'll see a code like: **join [random-word]**
3. Send this exact message to **+1 415 523 8886** from your WhatsApp
4. Wait for confirmation: *"You're all set! You can start sending messages to this number."*

**Note:** Sandbox allows testing with up to 5 verified numbers.

---

## Step 3: Deploy to Netlify (7 minutes)

### Option A: Using Netlify CLI (Recommended)

```bash
# Install Netlify CLI globally (if not already installed)
npm install -g netlify-cli

# Login to Netlify
netlify login

# Initialize and deploy
netlify init
# Follow prompts:
# - Create & configure a new site
# - Team: Select your team
# - Site name: (or press Enter for auto-generated)
# - Build command: npm run build (or leave empty)
# - Directory to deploy: public (or leave empty)

# Deploy to production
npm run deploy
```

### Option B: Using Netlify Web UI

1. Push your code to **GitHub/GitLab/Bitbucket**
2. Go to [Netlify Dashboard](https://app.netlify.com/)
3. Click **"Add new site"** → **"Import an existing project"**
4. Connect your repository
5. Configure build settings:
   - **Build command:** `npm run build` (or leave empty)
   - **Publish directory:** `public` (or leave empty)
6. Click **"Deploy site"**

---

## Step 4: Configure Environment Variables (3 minutes)

### In Netlify Dashboard:

1. Go to your site → **Site settings** → **Environment variables**
2. Add each variable:

```
ANTHROPIC_API_KEY = sk-ant-your-key-here
TWILIO_ACCOUNT_SID = ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN = your-auth-token-here
VESSEL_API_URL = https://your-api-endpoint.com/vessels
VESSEL_API_KEY = your-vessel-api-key (if required)
```

3. Click **"Save"**

### For Local Development:

```bash
# Copy example file
cp .env.example .env

# Edit .env and add your values
# Use your preferred text editor
```

---

## Step 5: Configure Twilio Webhook (2 minutes)

1. Go to [Twilio Console](https://console.twilio.com/) → **Messaging** → **Try it out** → **Send a WhatsApp message**
2. Or go to [WhatsApp Sandbox](https://console.twilio.com/us1/develop/sms/sandbox)
3. Find **"A MESSAGE COMES IN"** webhook field
4. Enter your Netlify function URL:
   ```
   https://your-site-name.netlify.app/.netlify/functions/whatsapp-webhook
   ```
   Or if you set up redirects:
   ```
   https://your-site-name.netlify.app/api/whatsapp-webhook
   ```
5. Set method to **POST**
6. Click **"Save"**

---

## Step 6: Test Your Bot (2 minutes)

Send these test messages to your Twilio WhatsApp number:

### Basic Queries:
```
What is the risk score for vessel ABC?
```

```
Show me risk level for IMO 1234567
```

```
Get recommendations for vessel XYZ
```

### Advanced Queries:
```
What is the risk breakdown for vessel ABC?
```

```
Show inspection info for IMO 9876543
```

```
Get PSC trends for vessel XYZ
```

### Expected Response:
The bot should respond with formatted information about the vessel, including risk scores, recommendations, or other requested data.

---

## Troubleshooting

### Bot not responding?
- ✅ Check Netlify function logs: **Site** → **Functions** → **whatsapp-webhook** → **Logs**
- ✅ Verify webhook URL in Twilio is correct
- ✅ Ensure all environment variables are set in Netlify
- ✅ Test locally: `npm run dev` and use ngrok to expose localhost

### "Server misconfiguration" error?
- ✅ Run `npm test` to verify environment variables
- ✅ Check all required env vars are set in Netlify
- ✅ Verify API keys are correct (not expired)

### API connection errors?
- ✅ Test Anthropic API: Check key at [Anthropic Console](https://console.anthropic.com/settings/keys)
- ✅ Test Vessel API: Verify URL and authentication
- ✅ Check function logs for detailed error messages

### Local development issues?
```bash
# Verify setup
npm test

# Start local dev server
npm run dev

# Check function at: http://localhost:8888/.netlify/functions/whatsapp-webhook
```

---

## Next Steps

- **Customize intents:** Edit `netlify/functions/whatsapp-webhook.js` to add new intents
- **Improve responses:** Adjust Claude prompts for better formatting
- **Add features:** Extend vessel API integration
- **Production:** Move from sandbox to production Twilio WhatsApp API

---

## Time Breakdown

- Step 1: Get API Keys → **5 minutes**
- Step 2: Join WhatsApp Sandbox → **3 minutes**
- Step 3: Deploy to Netlify → **7 minutes**
- Step 4: Configure Environment Variables → **3 minutes**
- Step 5: Configure Twilio Webhook → **2 minutes**
- Step 6: Test Your Bot → **2 minutes**

**Total: ~22 minutes**

---

## Support

- **Netlify Docs:** [netlify.com/docs](https://docs.netlify.com/)
- **Twilio WhatsApp:** [twilio.com/docs/whatsapp](https://www.twilio.com/docs/whatsapp)
- **Anthropic API:** [docs.anthropic.com](https://docs.anthropic.com/)

