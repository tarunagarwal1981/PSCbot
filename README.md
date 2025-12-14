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
- Email service (SendGrid or AWS SES)

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

