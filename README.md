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

```bash
# Install dependencies
npm install

# Setup environment variables
cp .env.example .env
# Edit .env with your API keys

# Test configuration
npm test

# Start development server
npm run dev

# Deploy to production
npm run deploy
```

## Prerequisites

- Node.js (v14+)
- Anthropic API key
- Twilio account
- Netlify account
- Vessel API access

## Documentation

- **[QUICKSTART.md](./QUICKSTART.md)** - Step-by-step setup guide
- **[PROJECT_SUMMARY.md](./PROJECT_SUMMARY.md)** - Complete project overview and architecture
- **[CONTRIBUTING.md](./CONTRIBUTING.md)** - Contribution guidelines
- **[CHANGELOG.md](./CHANGELOG.md)** - Version history

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
- **HTTP Client**: node-fetch

## License

MIT License - see [LICENSE](./LICENSE) file for details.

## Support

For setup help, see [QUICKSTART.md](./QUICKSTART.md).  
For project details, see [PROJECT_SUMMARY.md](./PROJECT_SUMMARY.md).  
For contributing, see [CONTRIBUTING.md](./CONTRIBUTING.md).

---

**Version**: 1.0.0

