# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2024-01-XX

### Added

- Initial release of PSCbot WhatsApp chatbot
- WhatsApp webhook handler using Netlify serverless functions
- Integration with Anthropic Claude AI (claude-sonnet-4-20250514) for:
  - Intent detection from user messages
  - Natural language response formatting
- Integration with Twilio WhatsApp API for message handling
- Support for 9 vessel data intents:
  - `risk_score` - Get vessel risk score
  - `risk_level` - Get vessel risk level
  - `risk_breakdown` - Get detailed risk breakdown
  - `recommendations` - Get vessel recommendations
  - `inspection_info` - Get inspection information
  - `vessel_info` - Get general vessel information
  - `psc_trends` - Get PSC trends data
  - `change_history` - Get change history
  - `campaigns` - Get campaign information
- Vessel API integration with support for IMO and vessel name queries
- Environment configuration test script (`test-setup.js`)
- Comprehensive documentation:
  - `QUICKSTART.md` - Step-by-step setup guide
  - `PROJECT_SUMMARY.md` - Complete project overview
  - `CONTRIBUTING.md` - Contribution guidelines
- Netlify configuration with:
  - Serverless function deployment
  - API route redirects
  - Development server settings
- Error handling and user-friendly error messages
- XML escaping for TwiML responses
- `.env.example` template for environment variables
- `.gitignore` for common files and directories

### Technical Details

- **Runtime**: Node.js (v14+)
- **Deployment**: Netlify serverless functions
- **Bundler**: esbuild
- **Dependencies**:
  - `node-fetch@2.6.7` - HTTP client for API requests
- **Dev Dependencies**:
  - `netlify-cli@17.0.0` - Netlify deployment and development tools

### Security

- Environment variables for sensitive credentials
- XML injection prevention via proper escaping
- Input validation for user messages
- Error messages that don't expose internal details

