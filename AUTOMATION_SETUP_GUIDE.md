# 📱 Fintrex Automation Setup Guide

Complete guide to set up WhatsApp and Email automation for receiving documents from clients, similar to platforms like WATI.

## 🎯 Overview

Your Fintrex platform now supports **fully automated document reception and processing** via:
- ✅ **WhatsApp** (using Meta Business API)
- ✅ **Email** (using SendGrid, Mailgun, or custom SMTP)

Clients send documents → System auto-processes → Creates financial records → Updates dashboards

---

## 🚀 Quick Start

### 1. Configure Your Settings

1. Navigate to **Settings** page in the sidebar
2. Fill in your profile information:
   - Full Name
   - Firm Name
   - WhatsApp Business Number
   - Office Address

3. Configure **Communication** tab:
   - Set your WhatsApp Business number
   - Copy the webhook URL provided
   - Enable email integration if needed

4. Configure **Branding** tab:
   - Add your firm logo
   - Choose brand colors
   - Customize greeting messages
   - Set acknowledgment messages

5. Configure **Automation** tab:
   - Enable auto-process documents
   - Enable auto-create journal entries
   - Enable auto-send acknowledgments
   - Set confidence threshold (default: 85%)

6. **Save Changes**

---

## 📱 WhatsApp Setup (Meta Business API)

### Prerequisites
- Meta Business Account
- WhatsApp Business Account
- Phone number verified with Meta

### Step 1: Create Meta App

1. Go to [Meta for Developers](https://developers.facebook.com/)
2. Create a new app → Select "Business" type
3. Add **WhatsApp** product to your app

### Step 2: Configure WhatsApp Business API

1. In your Meta App dashboard:
   - Go to **WhatsApp → Getting Started**
   - Add your WhatsApp Business number
   - Complete phone number verification

2. Generate permanent access token:
   - Go to **WhatsApp → Configuration**
   - Generate a permanent token (not temporary test token)
   - Copy this token (you'll need it for environment variables)

### Step 3: Configure Webhook in Meta

1. In Meta App → **WhatsApp → Configuration**:
   ```
   Webhook URL: https://your-supabase-project.supabase.co/functions/v1/whatsapp-webhook
   Verify Token: fintrex_webhook_2025 (or your custom token)
   ```

2. Subscribe to webhook fields:
   - ✅ `messages`
   - ✅ `message_status`

3. Click **Verify and Save**

### Step 4: Set Environment Variables

In your Supabase project, add these secrets:

```bash
WHATSAPP_TOKEN=your_permanent_access_token_here
WHATSAPP_VERIFY_TOKEN=fintrex_webhook_2025
```

To add secrets in Supabase:
```bash
supabase secrets set WHATSAPP_TOKEN=EAAxxxxxxxxxxxxx
supabase secrets set WHATSAPP_VERIFY_TOKEN=fintrex_webhook_2025
```

### Step 5: Test Your Setup

1. Save your WhatsApp number in Settings page
2. Send a message to your WhatsApp Business number from a client phone
3. Send a document (PDF, image) via WhatsApp
4. Check the Documents page - document should appear automatically!

---

## 📧 Email Setup

### Option A: Using SendGrid (Recommended)

1. **Create SendGrid Account**
   - Sign up at [sendgrid.com](https://sendgrid.com)
   - Verify your domain

2. **Configure Inbound Parse**
   - Go to **Settings → Inbound Parse**
   - Add your subdomain: `@fintrex.yourdomain.com`
   - Set webhook URL: `https://your-supabase-project.supabase.co/functions/v1/email-webhook`

3. **Set DNS Records**
   ```
   Type: MX
   Host: fintrex.yourdomain.com
   Value: mx.sendgrid.net
   Priority: 10
   ```

4. **Test**
   - Send email with attachment to `yourfirm-abc12345@fintrex.yourdomain.com`
   - Document should appear in Documents page

### Option B: Using Mailgun

1. **Create Mailgun Account**
   - Sign up at [mailgun.com](https://mailgun.com)
   - Add and verify your domain

2. **Configure Routes**
   - Go to **Receiving → Routes**
   - Create new route:
     ```
     Priority: 1
     Filter Expression: match_recipient(".*@fintrex.yourdomain.com")
     Actions: forward("https://your-supabase-project.supabase.co/functions/v1/email-webhook")
     ```

3. **Set DNS Records** (Mailgun will provide these)

### Option C: Custom SMTP/IMAP

1. In Settings → Communication → Email Integration:
   - Select "Custom SMTP/IMAP"
   - Enter your SMTP settings (for sending)
   - Enter your IMAP settings (for receiving)

2. For receiving emails, you'll need to run an IMAP polling service or use email forwarding rules

---

## 🔄 Complete Automation Workflow

### Phase 1: Document Reception

1. **Client sends document via WhatsApp or Email**
   - Client uses the WhatsApp number configured in Settings
   - Or client sends email to generated email address

2. **Webhook receives document**
   - WhatsApp webhook or Email webhook triggered
   - System identifies accountant by phone/email

3. **Client matching**
   - System finds existing client by phone/email
   - If not found, auto-creates temporary client profile
   - Sends greeting message to new clients (if enabled)

### Phase 2: Document Processing

4. **Document upload**
   - File uploaded to Supabase Storage
   - Document record created in database
   - Acknowledgment sent to client (if enabled)

5. **OCR & Extraction**
   - Enhanced OCR processes document (Gemini API)
   - Extracts structured data (KYC, invoice, financial)
   - LLM enriches and validates data

6. **Client identification & KYC**
   - If KYC document detected:
     - Extracts business name, GSTIN, PAN, address
     - Updates client profile automatically
     - Marks KYC as complete

### Phase 3: Financial Processing

7. **Invoice processing**
   - Extracts invoice number, date, amounts, items
   - Determines if sales or purchase invoice
   - Validates GST calculations

8. **Journal entry creation** (if auto-create enabled)
   - Creates double-entry journal entries
   - Posts to general ledger
   - Updates trial balance

9. **Financial statements update**
   - Updates Balance Sheet
   - Updates Profit & Loss Statement
   - Updates GST Reports (GSTR-1, GSTR-3B)

### Phase 4: Notifications

10. **Accountant notifications**
    - Email notification (if enabled)
    - WhatsApp notification for critical items (if enabled)
    - Dashboard shows new documents badge

11. **Client notifications**
    - Processing complete message
    - Summary of extracted data
    - Next steps if manual review required

---

## ⚙️ Advanced Configuration

### Confidence Threshold

Documents are scored for extraction confidence (0-100%). Documents below your threshold are flagged for manual review.

**Recommended settings:**
- High automation: 75% threshold
- Balanced: 85% threshold (default)
- Conservative: 95% threshold

### Manual Review Mode

Enable "Require Manual Review" in Automation settings to hold all documents for approval before posting to financial records.

### White-Label Branding

Customize all client-facing messages:
- Greeting message for new clients
- Document acknowledgment message
- Firm logo in communications
- Brand colors in client dashboard

### Multiple Accountants

Each accountant has their own:
- WhatsApp Business number
- Dedicated email address
- Client list
- Settings and preferences

The system automatically routes documents to the correct accountant based on the receiving number/email.

---

## 🧪 Testing Automation

### Test Checklist

- [ ] WhatsApp webhook verification successful
- [ ] Test message received from client phone
- [ ] Test document (PDF) received via WhatsApp
- [ ] Document appears in Documents page
- [ ] Client auto-created or matched correctly
- [ ] Acknowledgment message sent to client
- [ ] Email webhook receiving test emails
- [ ] Email attachments processed correctly
- [ ] OCR extraction working for invoices
- [ ] Journal entries created (if enabled)
- [ ] Financial statements updated

### Debug Logs

Check Supabase Edge Function logs:
```bash
supabase functions logs whatsapp-webhook
supabase functions logs email-webhook
```

Common issues:
- **403 Forbidden**: Check verify token matches
- **No accountant found**: Verify WhatsApp number/email in Settings
- **Client not matched**: Check phone number format (+91 prefix)
- **Document not processing**: Check automation settings enabled

---

## 🔐 Security Best Practices

1. **Use strong verify tokens** for webhooks
2. **Keep access tokens secure** - never commit to git
3. **Use environment variables** for all secrets
4. **Enable manual review** for high-value transactions
5. **Regularly audit** document processing logs
6. **Set appropriate confidence thresholds**
7. **Verify client identity** before processing KYC

---

## 📊 Monitoring & Analytics

### Dashboard Metrics

Monitor these KPIs in your Dashboard:
- Documents received today/week/month
- Processing success rate
- Average confidence scores
- Documents requiring manual review
- Client acquisition (via automation)
- Processing time per document

### Notification Preferences

Configure in Settings → Notifications:
- Email on new document
- Email on processing complete
- Email on KYC complete
- Weekly summary digest
- WhatsApp alerts (critical only)

---

## 🆘 Troubleshooting

### WhatsApp Issues

**Problem**: Webhook not receiving messages
- **Solution**: Check webhook URL in Meta dashboard, verify token correct

**Problem**: Can't send acknowledgment messages
- **Solution**: Verify phone number registered with Meta Business API

**Problem**: Messages received but not processed
- **Solution**: Check accountant WhatsApp number matches in Settings

### Email Issues

**Problem**: Emails not arriving
- **Solution**: Check DNS records, verify domain in email provider

**Problem**: Attachments not downloading
- **Solution**: Check email webhook format, verify base64 decoding

**Problem**: Accountant not found
- **Solution**: Check dedicated email address in Settings page

### Processing Issues

**Problem**: Documents stuck in "pending"
- **Solution**: Check OCR service logs, verify Gemini API key

**Problem**: Low confidence scores
- **Solution**: Use higher quality documents, check OCR enhancement settings

**Problem**: Wrong client matched
- **Solution**: Update client phone/email, use smart matching features

---

## 🎓 Training Your Clients

### Share These Instructions with Clients

**For WhatsApp:**
1. Save accountant's WhatsApp Business number
2. Send your documents as attachments
3. Wait for confirmation message
4. Check status in client dashboard (if provided access)

**For Email:**
1. Send documents to: `{provided-email}@fintrex.email`
2. Use clear subject line (optional)
3. Attach PDF or images
4. Wait for acknowledgment email

**Best Practices:**
- ✅ Use clear, well-lit scans
- ✅ Send one document per message
- ✅ Include document type in message (optional)
- ❌ Don't send multiple documents in one file
- ❌ Don't use heavily compressed images

---

## 🔄 Regular Maintenance

### Weekly Tasks
- Review documents requiring manual attention
- Check confidence score trends
- Update client profiles with missing information
- Review and categorize new clients

### Monthly Tasks
- Review automation settings effectiveness
- Update branding messages if needed
- Check webhook health and uptime
- Backup important documents
- Review financial statement accuracy

### Quarterly Tasks
- Audit client KYC completeness
- Review and optimize confidence thresholds
- Update OCR and LLM configurations
- Train team on new features

---

## 📞 Support

For issues or questions:
1. Check this documentation first
2. Review Supabase function logs
3. Test with sample documents
4. Contact support with specific error messages

---

## 🎉 You're All Set!

Your automated accounting workflow is now live! Clients can send documents via WhatsApp or email, and they'll be automatically processed, categorized, and posted to your books.

**Next steps:**
1. Test with a few sample documents
2. Invite your clients to start using the system
3. Monitor the first few days closely
4. Adjust automation settings based on results
5. Scale to all your clients!

Happy automating! 🚀
