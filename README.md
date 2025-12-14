# PSCbot

A WhatsApp chatbot for querying maritime vessel PSC (Port State Control) data using Twilio, Claude AI, and Netlify serverless functions.

## Features

- 🤖 **AI-Powered Intent Detection** - Uses Claude AI to understand natural language queries
- 📊 **Vessel Data Queries** - Get risk scores, inspections, recommendations, and more
- 💬 **WhatsApp Integration** - Access via WhatsApp through Twilio
- ☁️ **Serverless Architecture** - Deployed on Netlify Functions
- 🔒 **Secure** - Environment-based configuration with proper error handling

## Supported Queries

- Risk score and risk level
- Risk breakdown details
- Vessel recommendations
- Inspection information
- General vessel information
- PSC trends
- Change history
- Campaigns

## Quick Start

See [QUICKSTART.md](./QUICKSTART.md) for detailed setup instructions (~20 minutes).

## Local Testing

### Step 1: Clone Repository

```bash
git clone <repository-url>
cd PSCbot
```

### Step 2: Install Dependencies

```bash
npm install
```

This installs all required packages including:
- `@sendgrid/mail` - Email service
- `exceljs` - Excel file generation
- `node-fetch` - HTTP client
- `netlify-cli` - Netlify deployment tools

### Step 3: Configure Environment Variables

```bash
# Copy example environment file
cp .env.example .env

# Edit .env with your actual API keys
nano .env  # or use your preferred editor
```

Required variables in `.env`:
```env
ANTHROPIC_API_KEY=sk-ant-xxx
TWILIO_ACCOUNT_SID=ACxxx
TWILIO_AUTH_TOKEN=xxx
VESSEL_API_URL=https://api.example.com/vessels
SENDGRID_API_KEY=SG.xxx
SENDER_EMAIL=reports@yourdomain.com
```

See `.env.example` for all available options.

### Step 4: Add Vessel Mappings

Edit `data/vessel-mappings.csv` with your vessel data:

```csv
vessel_name,imo
GCL YAMUNA,9481219
GCL TAPI,9481659
GCL GANGA,9481697
```

This file is used for vessel name-to-IMO lookups.

### Step 5: Run Tests

```bash
# Test environment configuration
npm test

# Test vessel lookup functionality
node test/test-vessel-lookup.js

# Test Excel generation
node test/test-excel-generation.js

# Test API client (optional, requires VESSEL_API_URL)
node test/test-api-client.js
```

### Step 6: Start Local Development Server

```bash
npm run dev
# or
netlify dev
```

This starts a local server at `http://localhost:8888` that simulates Netlify Functions.

**Local Function URLs:**
- WhatsApp Webhook: `http://localhost:8888/.netlify/functions/whatsapp-webhook`
- Generate Excel: `http://localhost:8888/.netlify/functions/generate-excel`
- Download Excel: `http://localhost:8888/.netlify/functions/download-excel`
- Send Email: `http://localhost:8888/.netlify/functions/send-email`

### Step 7: Test Locally with Twilio

1. **Get your local URL** using a tool like [ngrok](https://ngrok.com/):
   ```bash
   ngrok http 8888
   ```

2. **Update Twilio Webhook** to point to your ngrok URL:
   ```
   https://your-ngrok-url.ngrok.io/.netlify/functions/whatsapp-webhook
   ```

3. **Send test messages** via WhatsApp to your Twilio sandbox number.

## Prerequisites

Before you begin, ensure you have the following:

### Required Software
- **Node.js 18+** - [Download](https://nodejs.org/)
- **npm** (comes with Node.js)
- **Git** - [Download](https://git-scm.com/)

### Required Accounts & API Keys

1. **Netlify Account**
   - Sign up at [netlify.com](https://www.netlify.com/)
   - Free tier is sufficient for development

2. **Anthropic API Key** (Claude AI)
   - Sign up at [console.anthropic.com](https://console.anthropic.com/)
   - Create an API key from the dashboard
   - Key format: `sk-ant-xxx...`

3. **Twilio Account** (WhatsApp Integration)
   - Sign up at [twilio.com](https://www.twilio.com/)
   - Enable WhatsApp Sandbox (free for testing)
   - Get Account SID and Auth Token from dashboard
   - Configure WhatsApp Sandbox number

4. **SendGrid Account** (Email Service)
   - Sign up at [sendgrid.com](https://sendgrid.com/)
   - Create API key with "Mail Send" permissions
   - Verify sender email address
   - Key format: `SG.xxx...`

5. **Vessel API Access**
   - Access to vessel data API endpoint
   - API key if required by your API provider

## Deployment

### Step 1: Install Netlify CLI

```bash
npm install -g netlify-cli
```

Or use npx (no global install needed):
```bash
npx netlify-cli --version
```

### Step 2: Login to Netlify

```bash
netlify login
```

This opens your browser to authenticate. Follow the prompts to authorize Netlify CLI.

### Step 3: Initialize Netlify Project

```bash
netlify init
```

This will:
- Link your local project to a Netlify site
- Create a new site or link to existing one
- Set up build settings

**Configuration options:**
- **Build command**: `npm run build` (or leave empty if no build needed)
- **Publish directory**: `public` (or leave empty)
- **Functions directory**: `netlify/functions`

### Step 4: Set Environment Variables

You can set environment variables via CLI or Netlify Dashboard.

**Option A: Via CLI (Recommended for multiple variables)**

```bash
# Set individual variables
netlify env:set ANTHROPIC_API_KEY "sk-ant-xxx"
netlify env:set TWILIO_ACCOUNT_SID "ACxxx"
netlify env:set TWILIO_AUTH_TOKEN "xxx"
netlify env:set VESSEL_API_URL "https://api.example.com/vessels"
netlify env:set SENDGRID_API_KEY "SG.xxx"
netlify env:set SENDER_EMAIL "reports@yourdomain.com"
netlify env:set SENDER_NAME "KIVAAN Vessel Intelligence"

# Optional variables
netlify env:set VESSEL_API_KEY "your-api-key"
netlify env:set DEFAULT_RECIPIENT_EMAIL "test@example.com"
netlify env:set PHONE_EMAIL_MAP "+1234567890:user@example.com"
```

**Option B: Via Netlify Dashboard**

1. Go to your site dashboard: `https://app.netlify.com/sites/your-site-name`
2. Navigate to **Site settings** → **Environment variables**
3. Click **Add variable** for each required variable
4. Set variable name and value
5. Click **Save**

**Important:** Set variables for **Production** environment (or all environments).

### Step 5: Deploy to Production

```bash
# Deploy to production
npm run deploy
# or
netlify deploy --prod
```

This will:
- Build your functions
- Upload to Netlify
- Deploy to production URL

**Deployment output:**
```
Deploy path:        /path/to/PSCbot
Functions path:     netlify/functions
Functions included: whatsapp-webhook, generate-excel, download-excel, send-email
Deploying to main site URL...
✔ Finished hashing
✔ CDN requesting 0 files
✔ Finished uploading 0 files
✔ Deploy log is https://app.netlify.com/sites/your-site/deploys/xxx

Website URL:        https://your-site.netlify.app
```

### Step 6: Get Function URLs

After deployment, your function URLs will be:

```
https://your-site.netlify.app/.netlify/functions/whatsapp-webhook
https://your-site.netlify.app/.netlify/functions/generate-excel
https://your-site.netlify.app/.netlify/functions/download-excel
https://your-site.netlify.app/.netlify/functions/send-email
```

### Step 7: Configure Twilio Webhook

1. **Go to Twilio Console**: [console.twilio.com](https://console.twilio.com/)

2. **Navigate to WhatsApp Sandbox**:
   - Messaging → Try it out → Send a WhatsApp message
   - Or: Phone Numbers → Manage → Active numbers → WhatsApp Sandbox

3. **Set Webhook URL**:
   ```
   https://your-site.netlify.app/.netlify/functions/whatsapp-webhook
   ```

4. **HTTP Method**: `POST`

5. **Save** the configuration

6. **Test** by sending a WhatsApp message to your sandbox number

### Step 8: Verify Deployment

1. Check function logs:
   ```bash
   netlify functions:log whatsapp-webhook
   ```

2. Test via WhatsApp:
   - Send a message to your Twilio WhatsApp sandbox number
   - Try: "Risk score for GCL YAMUNA"
   - You should receive a response

## Testing Production

### How to Test via WhatsApp

1. **Join Twilio WhatsApp Sandbox**:
   - Send `join <your-sandbox-keyword>` to Twilio's WhatsApp number
   - You'll receive a confirmation message

2. **Send Test Queries**:

   **Risk Score Query:**
   ```
   What is the risk score for GCL YAMUNA?
   ```
   Expected: Detailed risk score analysis

   **Risk Level Query:**
   ```
   Risk level of GCL TAPI
   ```
   Expected: Risk level explanation

   **Recommendations Query:**
   ```
   Recommendations for GCL GANGA
   ```
   Expected: Summary of recommendations with download/email options

   **Partial Vessel Name:**
   ```
   YAMUNA risk score
   ```
   Expected: Should find "GCL YAMUNA" and return results

   **IMO Number:**
   ```
   Risk score for 9481219
   ```
   Expected: Should find vessel by IMO and return results

3. **Test Excel Download**:
   - Request recommendations
   - Reply with `1` or `download`
   - You should receive a download link (expires in 10 minutes)

4. **Test Email Delivery**:
   - Request recommendations
   - Reply with `2` or `email`
   - Email should be sent to configured recipient

### Expected Responses

**Successful Query:**
```
📊 Risk Score for GCL YAMUNA

Risk Score: 45 (HIGH)

Key Risk Factors:
• Inspection History: 15 points
• Compliance Issues: 20 points
• Age Factor: 10 points

Overall Assessment: This vessel shows elevated risk levels...
```

**Vessel Not Found:**
```
I couldn't find a vessel named 'XYZ'. Please check the spelling or try using the IMO number.

Try: 'Risk score for GCL YAMUNA' or 'Vessel 9481219'
```

**Unclear Intent:**
```
I'm not sure what you're asking. Try:
• 'Risk score for GCL YAMUNA'
• 'Risk level of GCL TAPI'
• 'Recommendations for GCL GANGA'
```

### Troubleshooting Common Issues

**Issue: No response from bot**

1. **Check Twilio webhook configuration**:
   - Verify webhook URL is correct
   - Ensure HTTP method is POST
   - Check webhook is enabled

2. **Check Netlify function logs**:
   ```bash
   netlify functions:log whatsapp-webhook --tail
   ```

3. **Verify environment variables**:
   ```bash
   netlify env:list
   ```

**Issue: "Vessel not found" errors**

1. **Check vessel mappings**:
   - Verify `data/vessel-mappings.csv` has correct data
   - Ensure vessel names match exactly (case-insensitive)

2. **Check API connectivity**:
   - Verify `VESSEL_API_URL` is correct
   - Test API endpoint manually
   - Check `VESSEL_API_KEY` if required

**Issue: Excel download fails**

1. **Check function logs**:
   ```bash
   netlify functions:log download-excel --tail
   ```

2. **Verify file exists**:
   - Files expire after 10 minutes
   - Check `/tmp` directory permissions

3. **Check URL format**:
   - Ensure download URL is properly formatted
   - Verify base URL is correct

**Issue: Email not sending**

1. **Check SendGrid configuration**:
   - Verify `SENDGRID_API_KEY` is correct
   - Ensure sender email is verified in SendGrid
   - Check SendGrid account status

2. **Check function logs**:
   ```bash
   netlify functions:log send-email --tail
   ```

3. **Verify recipient email**:
   - Check `PHONE_EMAIL_MAP` or `DEFAULT_RECIPIENT_EMAIL`
   - Ensure email format is valid

**Issue: Rate limit errors**

- Bot has rate limiting (50 requests/hour per user)
- Wait before retrying
- Check logs for rate limit warnings

**Issue: API errors**

1. **Check API endpoints**:
   - Verify `VESSEL_API_URL` is accessible
   - Test API with curl or Postman

2. **Check API authentication**:
   - Verify `VESSEL_API_KEY` if required
   - Check API key permissions

3. **Review error logs**:
   ```bash
   netlify functions:log --tail
   ```

## Monitoring

### View Function Logs

**All functions:**
```bash
netlify functions:log --tail
```

**Specific function:**
```bash
netlify functions:log whatsapp-webhook --tail
netlify functions:log generate-excel --tail
netlify functions:log send-email --tail
```

**Filter by level:**
```bash
netlify functions:log --level error
```

### Check Error Rates

1. **Netlify Dashboard**:
   - Go to your site → **Functions** tab
   - View function invocations and errors
   - Check response times

2. **Function Logs**:
   ```bash
   # View recent errors
   netlify functions:log --level error --tail
   ```

3. **Set up alerts**:
   - Netlify Dashboard → Site settings → Notifications
   - Configure email alerts for function errors

### Monitor API Usage

1. **Anthropic API**:
   - Check usage at [console.anthropic.com](https://console.anthropic.com/)
   - Monitor token usage and costs

2. **Twilio API**:
   - Check usage at [console.twilio.com](https://console.twilio.com/)
   - Monitor WhatsApp message counts

3. **SendGrid API**:
   - Check usage at [app.sendgrid.com](https://app.sendgrid.com/)
   - Monitor email sends and delivery rates

4. **Vessel API**:
   - Check your API provider dashboard
   - Monitor request counts and rate limits

### Performance Monitoring

**Check function execution times:**
```bash
netlify functions:log --tail | grep "Duration"
```

**View in Netlify Dashboard:**
- Site → Functions → Click on function name
- View execution time graphs
- Check memory usage

### Best Practices

1. **Set up monitoring alerts** for:
   - High error rates (>5%)
   - Slow function execution (>5s)
   - API quota warnings

2. **Regular log reviews**:
   - Check logs weekly for patterns
   - Identify common errors
   - Optimize based on usage

3. **Monitor costs**:
   - Track API usage across all services
   - Set budget alerts
   - Optimize based on usage patterns

## Documentation

- **[QUICKSTART.md](./QUICKSTART.md)** - Step-by-step setup guide
- **[PROJECT_SUMMARY.md](./PROJECT_SUMMARY.md)** - Complete project overview and architecture
- **[CONTRIBUTING.md](./CONTRIBUTING.md)** - Contribution guidelines
- **[CHANGELOG.md](./CHANGELOG.md)** - Version history
- **[test/README.md](./test/README.md)** - Test scripts documentation

## Project Structure

```
PSCbot/
├── netlify/
│   └── functions/
│       └── whatsapp-webhook.js  # Main serverless function
├── netlify.toml                 # Netlify configuration
├── package.json                 # Dependencies and scripts
├── test-setup.js               # Environment test script
├── .env.example                # Environment variables template
├── .gitignore                  # Git ignore rules
└── [Documentation files]
```

## Technology Stack

- **Runtime**: Node.js
- **Deployment**: Netlify Functions
- **AI**: Anthropic Claude (claude-sonnet-4-20250514)
- **Messaging**: Twilio WhatsApp API
- **Email**: SendGrid or AWS SES
- **File Storage**: Netlify /tmp/ or custom storage (S3, etc.)
- **HTTP Client**: node-fetch
- **Excel Generation**: exceljs

## License

MIT License - see [LICENSE](./LICENSE) file for details.

## Email Service Setup

The bot supports two email service providers for sending recommendation reports:

### Option 1: SendGrid (Recommended)

1. **Sign up** at [SendGrid](https://sendgrid.com/)
2. **Create API Key**:
   - Go to Settings → API Keys
   - Create a new API key with "Mail Send" permissions
   - Copy the API key (starts with `SG.`)
3. **Verify Sender Email**:
   - Go to Settings → Sender Authentication
   - Verify your sender email address
4. **Configure in .env**:
   ```env
   SENDGRID_API_KEY=SG.your_api_key_here
   DEFAULT_SENDER_EMAIL=reports@yourdomain.com
   DEFAULT_SENDER_NAME=KIVAAN Vessel Intelligence
   ```

**Pros**: Simple setup, generous free tier, good documentation  
**Cons**: Requires email verification, rate limits on free tier

### Option 2: AWS SES

1. **Set up AWS Account** and configure SES
2. **Verify Sender Email** in SES console
3. **Create IAM User** with SES send permissions
4. **Configure in .env**:
   ```env
   AWS_ACCESS_KEY_ID=your_access_key
   AWS_SECRET_ACCESS_KEY=your_secret_key
   AWS_REGION=us-east-1
   DEFAULT_SENDER_EMAIL=reports@yourdomain.com
   DEFAULT_SENDER_NAME=KIVAAN Vessel Intelligence
   ```

**Pros**: Lower cost at scale, integrates with AWS ecosystem  
**Cons**: More complex setup, requires AWS knowledge

**Note**: Currently, the codebase uses SendGrid. To use AWS SES, you'll need to modify `netlify/functions/send-email.js` to use the AWS SDK instead of SendGrid.

## File Storage Configuration

Excel files can be stored in two ways:

### Option 1: Temporary Storage (Default)

Files are stored in Netlify's `/tmp/` directory and expire after 5 minutes. No configuration needed.

**Pros**: Simple, no additional setup  
**Cons**: Files expire quickly, not suitable for long-term storage

### Option 2: Custom Storage (S3, CloudFront, etc.)

For production, configure a permanent storage solution:

1. **Set up storage** (AWS S3, CloudFront, or similar)
2. **Configure in .env**:
   ```env
   EXCEL_STORAGE_URL=https://your-storage-bucket.com
   ```
3. **Update `generate-excel.js`** to upload files to your storage and return signed URLs

**Pros**: Permanent storage, better for production  
**Cons**: Requires additional infrastructure setup

## User Email Lookup Strategy

The bot needs email addresses to send recommendation reports. There are three approaches:

### Option 1: Phone Number Mapping (Default)

The system maintains an in-memory mapping of phone numbers to email addresses. Users are prompted for their email on first use.

**Implementation**: In-memory Map (for production, use Redis or database)

### Option 2: CRM/API Integration

If you have a CRM system that maps phone numbers to emails:

1. **Set up API endpoint** that accepts phone number and returns email
2. **Configure in .env**:
   ```env
   USER_EMAIL_MAPPING_API=https://your-crm-api.com/user-lookup
   ```
3. **Update `send-email.js`** to call this API for email lookup

**API Expected Format**:
```json
GET /user-lookup?phone=+1234567890
Response: { "email": "user@example.com", "name": "User Name" }
```

### Option 3: User Registration Flow

Implement a registration flow where users provide their email via WhatsApp before receiving reports.

**Implementation**: Extend conversation state management to handle email collection

## Testing Email Delivery Locally

Test email functionality without deploying:

1. **Set up environment variables** in `.env`:
   ```env
   SENDGRID_API_KEY=SG.your_test_key
   DEFAULT_SENDER_EMAIL=test@yourdomain.com
   TEST_RECIPIENT_EMAIL=your-test-email@example.com
   ```

2. **Run the test script**:
   ```bash
   npm run test-email
   ```

3. **Verify**:
   - Check your inbox for the test email
   - Verify Excel attachment is included
   - Check email formatting and content

**Note**: The test script generates a sample Excel file and sends it as an attachment. Make sure your SendGrid sender email is verified before testing.

## Support

For setup help, see [QUICKSTART.md](./QUICKSTART.md).  
For project details, see [PROJECT_SUMMARY.md](./PROJECT_SUMMARY.md).  
For contributing, see [CONTRIBUTING.md](./CONTRIBUTING.md).

---

**Version**: 1.0.0

