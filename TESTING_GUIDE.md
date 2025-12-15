# Testing Guide for WhatsApp Bot

This guide will help you test the WhatsApp bot with actual data.

## Prerequisites

1. All environment variables are set in Netlify (or locally in `.env` file)
2. Netlify functions are deployed
3. Twilio WhatsApp Sandbox is configured

## Environment Variables Required

Make sure these are set in Netlify (Site settings > Environment variables):

- `ANTHROPIC_API_KEY` - Your Anthropic Claude API key (starts with `sk-ant-`)
- `TWILIO_ACCOUNT_SID` - Your Twilio Account SID
- `TWILIO_AUTH_TOKEN` - Your Twilio Auth Token
- `VESSEL_API_URL` - Vessel API URL (currently hardcoded in api-client.js, but checked by webhook)
- `SENDGRID_API_KEY` - (Optional) For email functionality
- `SENDER_EMAIL` - (Optional) For email functionality

## Testing Methods

### Method 1: Test Locally (Recommended for Debugging)

1. Create a `.env` file in the project root with your environment variables:
   ```
   ANTHROPIC_API_KEY=sk-ant-xxx...
   TWILIO_ACCOUNT_SID=ACxxx...
   TWILIO_AUTH_TOKEN=xxx...
   VESSEL_API_URL=https://psc.ocean-eye.io/api/v1/vessels/dashboard/
   ```

2. Run the local test script:
   ```bash
   node test-webhook-local.js "Risk score for gcl yamuna"
   ```

   Or test with different messages:
   ```bash
   node test-webhook-local.js "Risk level of gcl tapi"
   node test-webhook-local.js "Recommendations for GCL GANGA"
   ```

### Method 2: Test via Netlify Functions Logs

1. Deploy your functions to Netlify:
   ```bash
   netlify deploy --prod
   ```

2. Send a message via WhatsApp to your Twilio number

3. Check Netlify function logs:
   ```bash
   netlify functions:log whatsapp-webhook --follow
   ```

   Or view logs in Netlify Dashboard:
   - Go to your site
   - Functions > whatsapp-webhook > View logs

### Method 3: Test Intent Detection Directly

Run the comprehensive test script:
```bash
node test-whatsapp-webhook.js
```

This will test:
- Intent detection with Claude API
- Vessel lookup
- API calls to fetch vessel data

## Common Issues and Solutions

### Issue: "I'm not sure what you're asking" even with correct queries

**Possible causes:**
1. Anthropic API key is invalid or not set correctly
2. Anthropic API is returning an error
3. Intent detection response parsing is failing
4. Vessel identifier extraction is failing

**Debugging steps:**
1. Check Netlify function logs for errors
2. Verify `ANTHROPIC_API_KEY` is set correctly
3. Test intent detection locally:
   ```bash
   node test-whatsapp-webhook.js
   ```
4. Check if the vessel name matches exactly (case-insensitive matching is supported)

### Issue: "Server misconfiguration: missing env vars"

**Solution:**
- Verify all required environment variables are set in Netlify
- Check that variable names match exactly (case-sensitive)
- Redeploy after setting environment variables

### Issue: Vessel not found

**Possible causes:**
1. Vessel name doesn't match the mappings in `data/vessel-mappings.csv`
2. Vessel data is not available in the API

**Solution:**
1. Check `data/vessel-mappings.csv` for the vessel name
2. Verify the vessel exists in the dashboard API
3. Try using the IMO number instead: "Risk score for 9481219"

## Testing with Actual Data

### Step 1: Verify Environment Variables

Run the setup check:
```bash
node test-setup.js
```

This will verify all environment variables are set correctly.

### Step 2: Test Vessel Lookup

```bash
node test/test-vessel-lookup.js
```

This verifies that vessel names can be resolved to IMO numbers.

### Step 3: Test API Client

```bash
node test/test-api-client.js
```

This verifies that the API can fetch vessel data.

### Step 4: Test Full Flow

```bash
node test-webhook-local.js "Risk score for gcl yamuna"
```

This simulates a full WhatsApp webhook call locally.

### Step 5: Test on Netlify

1. Deploy to Netlify
2. Send a WhatsApp message
3. Check the response
4. Review logs if there are issues

## Expected Behavior

When you send: **"Risk score for gcl yamuna"**

The bot should:
1. Detect intent: `risk_score`
2. Extract vessel identifier: `gcl yamuna`
3. Look up vessel: `GCL YAMUNA` (IMO: 9481219)
4. Fetch vessel data from API
5. Analyze risk score with Claude
6. Return formatted response

## Debugging Tips

1. **Check Netlify Logs**: Most errors will be logged with context
2. **Test Locally First**: Use `test-webhook-local.js` to debug without deploying
3. **Verify API Keys**: Make sure all API keys are valid and have proper permissions
4. **Check Vessel Mappings**: Ensure vessel names in CSV match what users will send
5. **Test with IMO Numbers**: Try using IMO numbers directly if vessel names fail

## Getting Help

If you're still experiencing issues:

1. Check Netlify function logs for detailed error messages
2. Run local tests to isolate the issue
3. Verify all environment variables are set correctly
4. Check that all APIs (Anthropic, Vessel API) are accessible and responding

