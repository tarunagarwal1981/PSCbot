# Quick Start Guide

**Total Time: ~30 minutes**

Get your PSC Bot up and running in production with this speed-run guide.

---

## Prerequisites Checklist

Before starting, ensure you have:
- [ ] Node.js 18+ installed (`node --version`)
- [ ] npm installed (`npm --version`)
- [ ] Git installed (`git --version`)
- [ ] Netlify account ([sign up](https://www.netlify.com/))

---

## Step 1: Get API Keys (5 minutes)

### 1.1 Anthropic API Key (1 min)
1. Go to [console.anthropic.com](https://console.anthropic.com/)
2. Sign up or log in
3. Navigate to **API Keys**
4. Click **Create Key**
5. Copy the key (starts with `sk-ant-`)

**✅ Success:** You have a key like `sk-ant-api03-xxx...`

### 1.2 SendGrid API Key (2 min)
1. Go to [sendgrid.com](https://sendgrid.com/) and sign up
2. Navigate to **Settings → API Keys**
3. Click **Create API Key**
4. Name it "PSC Bot" and select **Mail Send** permission
5. Copy the key (starts with `SG.`)
6. Go to **Settings → Sender Authentication**
7. Verify your sender email address

**✅ Success:** You have a key like `SG.xxx...` and verified email

### 1.3 Twilio Credentials (2 min)
1. Go to [twilio.com](https://www.twilio.com/) and sign up
2. Navigate to **Console Dashboard**
3. Copy **Account SID** (starts with `AC`)
4. Copy **Auth Token** (click to reveal)
5. Go to **Messaging → Try it out → Send a WhatsApp message**
6. Note your **WhatsApp Sandbox** number and join code

**✅ Success:** You have Account SID, Auth Token, and WhatsApp sandbox info

---

## Step 2: Prepare Vessel Data (2 minutes)

### 2.1 Clone Repository
```bash
git clone <your-repo-url>
cd PSCbot
```

**✅ Success:** You're in the `PSCbot` directory

### 2.2 Add Vessel Mappings
Edit `data/vessel-mappings.csv`:

```bash
nano data/vessel-mappings.csv
```

Add your vessels (format: `vessel_name,imo`):
```csv
vessel_name,imo
GCL YAMUNA,9481219
GCL TAPI,9481659
GCL GANGA,9481697
```

**✅ Success:** CSV file has at least one vessel entry

---

## Step 3: Deploy to Netlify (10 minutes)

### 3.1 Install Dependencies (1 min)
```bash
npm install
```

**✅ Success:** No errors, `node_modules/` created

### 3.2 Install Netlify CLI (1 min)
```bash
npm install -g netlify-cli
```

**✅ Success:** `netlify --version` shows version number

### 3.3 Login to Netlify (1 min)
```bash
netlify login
```

**✅ Success:** Browser opens, you're logged in, terminal shows "Logged in as..."

### 3.4 Initialize Project (2 min)
```bash
netlify init
```

**Options:**
- **Create & configure a new site** → Yes
- **Team:** Select your team
- **Site name:** `pscbot` (or your choice)
- **Build command:** `npm run build` (or press Enter)
- **Directory to deploy:** `public` (or press Enter)
- **Functions folder:** `netlify/functions`

**✅ Success:** Site created, `.netlify/` directory exists

### 3.5 Set Environment Variables (3 min)

**Option A: Via CLI (Recommended)**
```bash
netlify env:set ANTHROPIC_API_KEY "sk-ant-xxx"
netlify env:set TWILIO_ACCOUNT_SID "ACxxx"
netlify env:set TWILIO_AUTH_TOKEN "xxx"
netlify env:set VESSEL_API_URL "https://api.example.com/vessels"
netlify env:set SENDGRID_API_KEY "SG.xxx"
netlify env:set SENDER_EMAIL "reports@yourdomain.com"
netlify env:set SENDER_NAME "KIVAAN Vessel Intelligence"
```

**Option B: Via Dashboard**
1. Go to [app.netlify.com](https://app.netlify.com/)
2. Select your site → **Site settings** → **Environment variables**
3. Add each variable:
   - `ANTHROPIC_API_KEY`
   - `TWILIO_ACCOUNT_SID`
   - `TWILIO_AUTH_TOKEN`
   - `VESSEL_API_URL`
   - `SENDGRID_API_KEY`
   - `SENDER_EMAIL`
   - `SENDER_NAME`

**✅ Success:** All 7 variables set (verify with `netlify env:list`)

### 3.6 Deploy to Production (2 min)
```bash
netlify deploy --prod
```

**Expected Output:**
```
Deploying to main site URL...
✔ Finished hashing
✔ CDN requesting 0 files
✔ Finished uploading 0 files
✔ Deploy log is https://app.netlify.com/...

Website URL: https://your-site.netlify.app
```

**✅ Success:** Deployment completes, you have a website URL

### 3.7 Get Function URL (1 min)
Your webhook URL will be:
```
https://your-site.netlify.app/.netlify/functions/whatsapp-webhook
```

**✅ Success:** You have the full webhook URL copied

---

## Step 4: Configure Twilio (5 minutes)

### 4.1 Join WhatsApp Sandbox (1 min)
1. Open WhatsApp on your phone
2. Send message to Twilio's WhatsApp number: `join <your-sandbox-code>`
3. Wait for confirmation: "You're all set!"

**✅ Success:** You receive confirmation message

### 4.2 Set Webhook URL (2 min)
1. Go to [console.twilio.com](https://console.twilio.com/)
2. Navigate to **Messaging → Try it out → Send a WhatsApp message**
3. Find **When a message comes in** field
4. Enter your webhook URL:
   ```
   https://your-site.netlify.app/.netlify/functions/whatsapp-webhook
   ```
5. Set **HTTP method:** `POST`
6. Click **Save**

**✅ Success:** Webhook URL saved, shows green checkmark

### 4.3 Verify Configuration (2 min)
1. In Twilio console, check webhook is set correctly
2. Note your WhatsApp sandbox number (format: `whatsapp:+14155238886`)

**✅ Success:** Webhook URL matches your Netlify function URL

---

## Step 5: Test the Bot (5 minutes)

### 5.1 Test Risk Score Query (1 min)
Send via WhatsApp:
```
What is the risk score for GCL YAMUNA?
```

**✅ Success:** Bot responds with risk score analysis

### 5.2 Test Recommendations Query (2 min)
Send via WhatsApp:
```
Recommendations for GCL YAMUNA
```

Then reply with:
```
1
```

**✅ Success:** Bot sends download link for Excel file

### 5.3 Test Partial Name Match (1 min)
Send via WhatsApp:
```
YAMUNA risk level
```

**✅ Success:** Bot finds vessel and returns risk level

### 5.4 Verify Logs (1 min)
```bash
netlify functions:log whatsapp-webhook --tail
```

**✅ Success:** You see function invocations and no errors

---

## Troubleshooting

### Bot Not Responding?
1. Check webhook URL in Twilio matches Netlify function URL
2. Verify environment variables: `netlify env:list`
3. Check logs: `netlify functions:log whatsapp-webhook --tail`

### "Vessel not found" Error?
1. Verify vessel exists in `data/vessel-mappings.csv`
2. Check CSV format: `vessel_name,imo` (no spaces)
3. Ensure vessel name matches exactly (case-insensitive)

### Excel Download Fails?
1. Check function logs: `netlify functions:log download-excel`
2. Verify file hasn't expired (10 minute limit)
3. Try generating again

### Email Not Sending?
1. Verify SendGrid API key is correct
2. Check sender email is verified in SendGrid
3. Set `DEFAULT_RECIPIENT_EMAIL` in environment variables

---

## Next Steps

- **Monitor Usage:** `netlify functions:log --tail`
- **View Dashboard:** [app.netlify.com](https://app.netlify.com/)
- **Read Full Docs:** See [README.md](./README.md)
- **Customize:** Edit vessel mappings, add more vessels

---

## Quick Reference

**Function URLs:**
- Webhook: `https://your-site.netlify.app/.netlify/functions/whatsapp-webhook`
- Generate Excel: `https://your-site.netlify.app/.netlify/functions/generate-excel`
- Download Excel: `https://your-site.netlify.app/.netlify/functions/download-excel`
- Send Email: `https://your-site.netlify.app/.netlify/functions/send-email`

**Useful Commands:**
```bash
# View logs
netlify functions:log whatsapp-webhook --tail

# List environment variables
netlify env:list

# Redeploy
netlify deploy --prod

# Open site dashboard
netlify open
```

---

**🎉 Congratulations!** Your PSC Bot is now live and ready to use.

**Total Time:** ~30 minutes
