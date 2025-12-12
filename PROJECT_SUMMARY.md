# PSCbot Project Summary

A comprehensive overview of the WhatsApp chatbot project for maritime vessel PSC (Port State Control) data queries.

## Project Overview

PSCbot is a serverless WhatsApp chatbot that enables users to query vessel information through natural language messages. It integrates Twilio WhatsApp API, Anthropic Claude AI, and a custom vessel data API to provide intelligent responses about vessel risk scores, inspections, recommendations, and more.

## Architecture

```
User (WhatsApp) 
    ↓
Twilio WhatsApp API
    ↓
Netlify Serverless Function (whatsapp-webhook.js)
    ↓
    ├─→ Anthropic Claude AI (Intent Detection)
    ├─→ Vessel API (Data Fetching)
    └─→ Anthropic Claude AI (Response Formatting)
    ↓
TwiML XML Response
    ↓
User (WhatsApp)
```

## Project Structure

### Core Files

#### `package.json`
**Purpose**: Node.js project configuration and dependencies  
**Key Contents**:
- Project metadata and description
- Dependencies: `node-fetch@2.6.7`
- Dev Dependencies: `netlify-cli@17.0.0`
- Scripts:
  - `npm run dev` - Start local development server
  - `npm run deploy` - Deploy to Netlify production
  - `npm test` - Run environment configuration tests

#### `netlify.toml`
**Purpose**: Netlify deployment and build configuration  
**Key Settings**:
- Build command: `npm run build`
- Functions directory: `netlify/functions`
- Publish directory: `public`
- Node bundler: `esbuild`
- API redirects: `/api/*` → `/.netlify/functions/:splat`
- Dev server: Port 8888, auto-launch disabled

#### `netlify/functions/whatsapp-webhook.js`
**Purpose**: Main serverless function handler for WhatsApp webhooks  
**Functionality**:
- Receives POST requests from Twilio WhatsApp webhook
- Parses incoming message body
- Detects user intent using Claude AI
- Extracts vessel name/IMO from user message
- Fetches vessel data from external API
- Formats response using Claude AI
- Returns TwiML XML response

**Key Functions**:
- `detectIntent(userMessage)` - Uses Claude to parse intent and extract vessel info
- `fetchVesselData(intentResponse)` - Queries vessel API with IMO or name
- `formatResponse(userMessage, intentResponse, vesselData)` - Uses Claude to format natural response
- `generateTwiMLResponse(message)` - Creates TwiML XML for Twilio
- `escapeXml(unsafe)` - Escapes XML special characters
- `anthropicHeaders()` - Returns proper headers for Anthropic API

**Supported Intents**:
- `risk_score` - Vessel risk score
- `risk_level` - Risk level classification
- `risk_breakdown` - Detailed risk breakdown
- `recommendations` - Vessel recommendations
- `inspection_info` - Inspection information
- `vessel_info` - General vessel information
- `psc_trends` - PSC trends data
- `change_history` - Change history
- `campaigns` - Campaign information

### Configuration Files

#### `.gitignore`
**Purpose**: Excludes files from version control  
**Excluded**:
- `node_modules/` - Dependencies
- `.env` - Environment variables (sensitive)
- `.netlify/` - Netlify build cache
- `logs/` - Log files
- `.DS_Store` - macOS system files

#### `.env.example` (Template)
**Purpose**: Template for environment variables  
**Variables**:
- `ANTHROPIC_API_KEY` - Claude AI API key
- `TWILIO_ACCOUNT_SID` - Twilio account identifier
- `TWILIO_AUTH_TOKEN` - Twilio authentication token
- `VESSEL_API_URL` - Vessel data API endpoint
- `VESSEL_API_KEY` - Optional vessel API authentication key

### Testing & Development

#### `test-setup.js`
**Purpose**: Environment configuration verification script  
**Functionality**:
- Checks all required environment variables
- Tests Anthropic API connectivity
- Tests Vessel API connectivity (if configured)
- Provides colored output (green/red/yellow)
- Masks sensitive values in output
- Gives actionable error messages and next steps

**Usage**: `npm test` or `node test-setup.js`

### Documentation

#### `QUICKSTART.md`
**Purpose**: Step-by-step setup guide for new users  
**Contents**:
- Prerequisites checklist
- 6-step setup process (~22 minutes total)
- API key acquisition instructions
- WhatsApp sandbox setup
- Netlify deployment (CLI and web UI)
- Environment variable configuration
- Twilio webhook setup
- Testing instructions with example queries
- Troubleshooting tips

#### `CHANGELOG.md`
**Purpose**: Version history and release notes  
**Current Version**: v1.0.0  
**Format**: Keep a Changelog standard

#### `CONTRIBUTING.md`
**Purpose**: Guidelines for contributors  
**Contents**:
- Code of conduct
- How to report bugs
- How to suggest features
- Pull request process
- Development setup
- Code style guidelines
- Testing requirements
- Documentation standards

#### `LICENSE`
**Purpose**: MIT License - Open source license  
**Rights**: Free to use, modify, and distribute

## File Relationships

### Request Flow

1. **User sends WhatsApp message** → Twilio receives it
2. **Twilio webhook** → POSTs to `/.netlify/functions/whatsapp-webhook`
3. **netlify.toml redirect** → Maps `/api/*` to `/.netlify/functions/:splat`
4. **whatsapp-webhook.js** → Processes the request:
   - Validates environment variables
   - Parses message body
   - Calls `detectIntent()` → Anthropic API
   - Calls `fetchVesselData()` → Vessel API
   - Calls `formatResponse()` → Anthropic API
   - Returns TwiML XML via `generateTwiMLResponse()`

### Configuration Flow

1. **package.json** → Defines project structure and scripts
2. **netlify.toml** → Configures Netlify deployment
3. **.env** (from .env.example) → Sets environment variables
4. **test-setup.js** → Verifies configuration before deployment

### Development Flow

1. **Local Development**:
   ```bash
   npm install          # Install dependencies
   cp .env.example .env # Setup environment
   npm test            # Verify configuration
   npm run dev         # Start dev server
   ```

2. **Testing**:
   ```bash
   npm test            # Test environment setup
   ```

3. **Deployment**:
   ```bash
   npm run deploy      # Deploy to Netlify
   ```

## Environment Variables

### Required
- `ANTHROPIC_API_KEY` - Claude AI authentication
- `TWILIO_ACCOUNT_SID` - Twilio account identifier
- `TWILIO_AUTH_TOKEN` - Twilio authentication
- `VESSEL_API_URL` - Vessel data API endpoint

### Optional
- `VESSEL_API_KEY` - Vessel API authentication (if required)

## Dependencies

### Runtime
- **node-fetch@2.6.7** - HTTP client for API requests (CommonJS compatible)

### Development
- **netlify-cli@17.0.0** - Netlify deployment and local development tools

## Quick Start Command Sequence

```bash
# 1. Install dependencies
npm install

# 2. Setup environment variables
cp .env.example .env
# Edit .env with your API keys

# 3. Test configuration
npm test

# 4. Start local development server
npm run dev

# 5. Deploy to production (when ready)
npm run deploy
```

## API Endpoints

### Netlify Function
- **Path**: `/.netlify/functions/whatsapp-webhook`
- **Alternative**: `/api/whatsapp-webhook` (via redirect)
- **Method**: POST
- **Content-Type**: `application/x-www-form-urlencoded` (Twilio format)
- **Response**: TwiML XML

## External Integrations

### Anthropic Claude AI
- **Model**: `claude-sonnet-4-20250514`
- **API**: `https://api.anthropic.com/v1/messages`
- **Usage**: Intent detection and response formatting
- **Authentication**: `x-api-key` header

### Twilio WhatsApp
- **Service**: WhatsApp Business API via Twilio
- **Webhook Format**: URL-encoded form data
- **Response Format**: TwiML XML
- **Sandbox**: For testing (up to 5 numbers)

### Vessel API
- **Format**: REST API
- **Query Parameters**: `imo` or `name`
- **Response**: JSON with `vessels` array
- **Authentication**: Optional `x-api-key` header

## Error Handling

All functions include comprehensive error handling:
- **Environment validation** - Checks required variables
- **API errors** - Catches and logs HTTP errors
- **Parse errors** - Handles JSON parsing failures
- **User-friendly messages** - Returns helpful error messages to users
- **Logging** - Console errors for debugging

## Security Considerations

- Environment variables for sensitive data
- XML escaping to prevent injection
- Input validation for user messages
- Error messages don't expose internal details
- API keys never logged or exposed

## Production Readiness Checklist

✅ All required files created  
✅ Dependencies properly configured  
✅ Error handling implemented  
✅ Environment variable validation  
✅ Documentation complete  
✅ Test script available  
✅ Deployment configuration ready  
✅ License and contribution guidelines  
✅ Code follows best practices  

## Support & Resources

- **Setup Guide**: See `QUICKSTART.md`
- **Contributing**: See `CONTRIBUTING.md`
- **Changelog**: See `CHANGELOG.md`
- **Netlify Docs**: https://docs.netlify.com/
- **Twilio WhatsApp**: https://www.twilio.com/docs/whatsapp
- **Anthropic API**: https://docs.anthropic.com/

## Project Status

**Version**: 1.0.0  
**Status**: Production Ready  
**Last Updated**: 2024-01-XX

---

For detailed setup instructions, see [QUICKSTART.md](./QUICKSTART.md)

