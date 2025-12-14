# Deployment Checklist

Use this checklist to ensure your PSC Bot is ready for production deployment.

## Pre-Deployment

### Environment Setup
- [ ] Node.js 18+ installed (`node --version`)
- [ ] npm installed (`npm --version`)
- [ ] Netlify CLI installed (`netlify --version`)
- [ ] Git repository cloned and up to date

### Dependencies
- [ ] All dependencies installed (`npm install`)
- [ ] No dependency conflicts or warnings
- [ ] `node_modules/` directory exists and is complete

### Environment Variables
- [ ] `ANTHROPIC_API_KEY` - Claude AI API key (starts with `sk-ant-`)
- [ ] `TWILIO_ACCOUNT_SID` - Twilio Account SID (starts with `AC`)
- [ ] `TWILIO_AUTH_TOKEN` - Twilio Auth Token
- [ ] `VESSEL_API_URL` - Your vessel data API endpoint
- [ ] `VESSEL_API_KEY` - (Optional) API key if required
- [ ] `SENDGRID_API_KEY` - SendGrid API key (starts with `SG.`)
- [ ] `SENDER_EMAIL` - Verified sender email address
- [ ] `SENDER_NAME` - Sender name (defaults to "KIVAAN Vessel Intelligence")
- [ ] `DEFAULT_RECIPIENT_EMAIL` - (Optional) Default email for testing
- [ ] `PHONE_EMAIL_MAP` - (Optional) Phone-to-email mapping

**Verify in Netlify:**
```bash
netlify env:list
```

### Vessel Data
- [ ] `data/vessel-mappings.csv` file exists
- [ ] CSV file has header row: `vessel_name,imo`
- [ ] At least one vessel entry added (or 600+ vessels for production)
- [ ] CSV format is correct (no extra spaces, proper commas)
- [ ] Test vessel lookup: `node test/test-vessel-lookup.js`

**Expected:** All tests pass, vessels are found correctly

### Code Review
- [ ] All imports are correct and paths are valid
- [ ] All async functions have try-catch error handling
- [ ] Error messages are user-friendly (no technical jargon)
- [ ] TwiML responses are properly formatted
- [ ] File paths use `path.join()` for cross-platform compatibility
- [ ] Console.log statements added for key operations (not excessive)

## Deployment

### Netlify Setup
- [ ] Logged into Netlify (`netlify login`)
- [ ] Site initialized (`netlify init`)
- [ ] Site created and linked to repository
- [ ] Build settings configured:
  - Build command: `npm run build` (or empty)
  - Publish directory: `public` (or empty)
  - Functions directory: `netlify/functions`

### Environment Variables in Netlify
- [ ] All required environment variables set in Netlify dashboard
- [ ] Variables set for **Production** environment
- [ ] Variables verified: `netlify env:list`
- [ ] No sensitive data in code (all in environment variables)

### Deploy to Production
- [ ] Deployment successful: `netlify deploy --prod`
- [ ] No build errors or warnings
- [ ] Functions deployed successfully
- [ ] Function URLs obtained:
  - WhatsApp webhook: `https://your-site.netlify.app/.netlify/functions/whatsapp-webhook`
  - Generate Excel: `https://your-site.netlify.app/.netlify/functions/generate-excel`
  - Download Excel: `https://your-site.netlify.app/.netlify/functions/download-excel`
  - Send Email: `https://your-site.netlify.app/.netlify/functions/send-email`

**Expected:** Deployment completes with success message and website URL

## Twilio Configuration

### WhatsApp Sandbox
- [ ] Twilio account created and verified
- [ ] WhatsApp Sandbox joined (send `join <code>` to Twilio number)
- [ ] Confirmation message received
- [ ] Sandbox number noted

### Webhook Configuration
- [ ] Webhook URL set in Twilio console:
  ```
  https://your-site.netlify.app/.netlify/functions/whatsapp-webhook
  ```
- [ ] HTTP method set to **POST**
- [ ] Webhook saved and shows green checkmark
- [ ] Webhook URL matches Netlify function URL exactly

**Location:** Twilio Console → Messaging → Try it out → Send a WhatsApp message

## Testing

### Basic Functionality
- [ ] Test message sent via WhatsApp to Twilio sandbox number
- [ ] Bot responds to test message
- [ ] No errors in function logs

### Test Queries
- [ ] **Risk Score Query:**
  ```
  What is the risk score for GCL YAMUNA?
  ```
  **Expected:** Bot returns risk score analysis

- [ ] **Risk Level Query:**
  ```
  Risk level of GCL TAPI
  ```
  **Expected:** Bot returns risk level explanation

- [ ] **Recommendations Query:**
  ```
  Recommendations for GCL GANGA
  ```
  **Expected:** Bot returns recommendations summary with download/email options

- [ ] **Partial Name Match:**
  ```
  YAMUNA risk score
  ```
  **Expected:** Bot finds "GCL YAMUNA" and returns results

- [ ] **IMO Number:**
  ```
  Risk score for 9481219
  ```
  **Expected:** Bot finds vessel by IMO and returns results

### Excel Download
- [ ] Request recommendations for a vessel
- [ ] Reply with `1` or `download`
- [ ] Receive download link
- [ ] Download link works (file downloads)
- [ ] Excel file opens correctly
- [ ] Excel file contains all sheets:
  - [ ] Vessel Summary
  - [ ] CRITICAL Recommendations
  - [ ] MODERATE Recommendations
  - [ ] RECOMMENDED
  - [ ] Campaigns

**Expected:** Excel file downloads, opens, and contains all expected data

### Email Delivery
- [ ] Request recommendations for a vessel
- [ ] Reply with `2` or `email`
- [ ] Email sent successfully
- [ ] Email received in inbox
- [ ] Email contains:
  - [ ] Professional HTML formatting
  - [ ] Report summary with counts
  - [ ] Excel file attachment
  - [ ] Correct sender name and email

**Expected:** Email arrives with attachment, formatting looks professional

### Error Handling
- [ ] **Vessel Not Found:**
  ```
  Risk score for NONEXISTENT VESSEL
  ```
  **Expected:** User-friendly error message with suggestions

- [ ] **Unclear Intent:**
  ```
  Hello
  ```
  **Expected:** Helpful message with example queries

- [ ] **API Failure:** (if possible to simulate)
  **Expected:** Graceful error message, no crashes

- [ ] **Rate Limiting:** (if applicable)
  **Expected:** Clear message about rate limit

**Expected:** All errors show user-friendly messages, no technical errors exposed

## Monitoring

### Logs
- [ ] Function logs accessible: `netlify functions:log whatsapp-webhook`
- [ ] Logs show successful operations
- [ ] Error logs are clear and actionable
- [ ] Logging includes context (phone number, vessel, etc.)

### Performance
- [ ] Function execution times reasonable (< 5 seconds)
- [ ] No timeout errors
- [ ] Memory usage within limits

### API Usage
- [ ] Anthropic API usage monitored
- [ ] Twilio API usage monitored
- [ ] SendGrid API usage monitored
- [ ] Vessel API usage monitored
- [ ] No unexpected API quota issues

### Alerts
- [ ] Error rate alerts configured (if available)
- [ ] API quota warnings set up
- [ ] Monitoring dashboard accessible

## Production Readiness

### Security
- [ ] All API keys stored in environment variables (not in code)
- [ ] `.env` file in `.gitignore` (not committed)
- [ ] No sensitive data in logs
- [ ] File paths validated (no directory traversal)
- [ ] Input validation in place

### Documentation
- [ ] README.md updated with deployment instructions
- [ ] QUICKSTART.md reviewed and accurate
- [ ] Environment variables documented in `.env.example`
- [ ] Troubleshooting guide available

### Backup & Recovery
- [ ] Vessel mappings CSV backed up
- [ ] Environment variables documented (securely)
- [ ] Deployment process documented
- [ ] Rollback procedure known

## Post-Deployment

### Verification
- [ ] All test queries work correctly
- [ ] Excel generation works
- [ ] Email delivery works
- [ ] Error handling works
- [ ] No console errors in production logs

### User Acceptance
- [ ] Test with actual users (if applicable)
- [ ] Gather feedback
- [ ] Document any issues

### Maintenance
- [ ] Monitoring set up
- [ ] Regular log reviews scheduled
- [ ] Update procedure documented
- [ ] Support contact information available

---

## Quick Verification Commands

```bash
# Check environment variables
netlify env:list

# View function logs
netlify functions:log whatsapp-webhook --tail

# Test locally
npm run dev

# Run tests
npm test
npm run test:excel

# Deploy
netlify deploy --prod

# Check deployment status
netlify status
```

---

## Common Issues & Solutions

### Issue: Bot not responding
- ✅ Check webhook URL in Twilio matches Netlify function URL
- ✅ Verify all environment variables are set
- ✅ Check function logs for errors

### Issue: "Vessel not found"
- ✅ Verify vessel exists in `data/vessel-mappings.csv`
- ✅ Check CSV format is correct
- ✅ Test vessel lookup: `node test/test-vessel-lookup.js`

### Issue: Excel download fails
- ✅ Check function logs: `netlify functions:log download-excel`
- ✅ Verify file hasn't expired (10 minute limit)
- ✅ Check `/tmp` directory permissions

### Issue: Email not sending
- ✅ Verify SendGrid API key is correct
- ✅ Check sender email is verified in SendGrid
- ✅ Verify recipient email is set
- ✅ Check function logs: `netlify functions:log send-email`

---

**✅ Ready for Production:** Check all items above before going live.

**Last Updated:** 2024-12-14

