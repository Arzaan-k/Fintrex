# WhatsApp Sync Complete Implementation Guide

## Overview

This document describes the complete WhatsApp synchronization system for Fintrex. Everything happening in the app is now automatically synced with WhatsApp, keeping clients informed in real-time.

## Features Implemented

### 1. Real-Time Document Status Updates ✅
- **Trigger**: Automatic when document status changes
- **Notifications**:
  - Processing started
  - Processing completed
  - Processing failed
  - Review pending

**Example**: When a client uploads an invoice, they get notified immediately when processing starts, and again when extraction is complete.

### 2. Payment Reminders & Tracking ✅
- **Automated Reminders**:
  - 3 days before due date
  - On due date
  - When overdue (up to 3 reminders every 3 days)
- **Interactive Buttons**:
  - Mark as Paid
  - View Invoice Details
- **Automatic Payment Record Creation**: When marked as paid via WhatsApp

**Example**: Client gets a reminder "Payment due in 3 days for Invoice #INV-001, ₹50,000" with a button to mark it as paid.

### 3. Journal Entry Confirmations ✅
- **Trigger**: Automatic when new journal entry is created
- **Information Sent**:
  - Transaction date
  - Description
  - Amount
  - Confirmation that books are updated

**Example**: "📊 Transaction Recorded - Your purchase of ₹10,000 has been added to your books on 22/01/2025"

### 4. Monthly Financial Summaries ✅
- **Schedule**: Automatically on the 1st of each month
- **Information Included**:
  - Total Income
  - Total Expenses
  - Net Profit/Loss
  - Link to detailed reports

**Example**: "📊 Monthly Summary for January 2025: Income ₹5,00,000 | Expenses ₹3,50,000 | Net Profit ₹1,50,000"

### 5. Anomaly Detection Alerts ✅
- **Types of Anomalies**:
  - Amount spike (>3x average)
  - Duplicate invoices
  - Missing sequence
  - Tax calculation mismatch
- **Interactive Actions**:
  - Review on web
  - Ignore anomaly

**Example**: "⚠️ Anomaly Alert - Invoice amount ₹2,00,000 is significantly higher than your average of ₹50,000"

### 6. GST Filing Reminders ✅
- **Schedule**:
  - GSTR-1: Reminder on 6th of month (due 11th)
  - GSTR-3B: Reminder on 15th of month (due 20th)
- **Information Sent**:
  - Filing type
  - Period
  - Due date

**Example**: "📋 GST Filing Reminder - GSTR-1 for January 2025 is due on 11th February. Your accountant will prepare it."

### 7. KYC Document Requests ✅
- **Trigger**: When accountant creates KYC requirement
- **Reminders**: Every 2 days (up to 3 reminders)
- **Interactive Button**: Upload Now
- **Tracking**: Status updates when uploaded

**Example**: "🆔 KYC Document Required - Please upload: PAN Card. Required within 5 days."

### 8. Document Request Workflow ✅
- **Priority-based Reminders**:
  - High priority: Daily reminders
  - Normal priority: Every 2 days
- **Max 3 reminders per request**
- **Escalation**: Urgent marker for expiring requests

**Example**: "🔴 Document Request (Reminder #2) - Please upload: Bank Statement for December 2024. This is urgent!"

### 9. Payment Confirmation Notifications ✅
- **Trigger**: When payment is recorded in the system
- **Information Sent**:
  - Invoice number
  - Vendor name
  - Amount paid
  - Payment date

**Example**: "✅ Payment Recorded - Your payment of ₹50,000 for Invoice #INV-001 to ABC Suppliers has been recorded."

## Architecture

### Components

1. **whatsapp-notify** (Edge Function)
   - Central notification service
   - Handles all WhatsApp message sending
   - 9 notification types supported

2. **whatsapp-webhook** (Edge Function)
   - Receives inbound WhatsApp messages
   - Handles button interactions
   - Manages user sessions
   - Routes to appropriate handlers

3. **whatsapp-scheduler** (Edge Function)
   - Runs on cron schedule
   - Sends periodic notifications
   - Checks payment reminders
   - Sends monthly summaries
   - GST filing reminders
   - KYC reminders
   - Cleans up expired sessions

4. **Database Triggers**
   - Automatic notifications on data changes
   - Document status changes
   - Journal entries created
   - Anomalies detected
   - Payment reminders

### Database Tables

#### New Tables
- `payments` - Payment records with WhatsApp integration
- `payment_reminders` - Automated payment reminder tracking
- `anomalies` - Detected anomalies in documents
- `gst_filings` - GST filing tracking
- `whatsapp_notifications_log` - Log of all notifications sent

#### Enhanced Tables
- `documents` - Added upload_source, review_status, file_size
- `client_kyc_checklists` - Added reminder_count, last_reminder_sent, due_date
- `document_requests` - Added reminder_count, last_reminder_sent

## Setup Instructions

### 1. Deploy Edge Functions

```bash
# Deploy WhatsApp notification service
supabase functions deploy whatsapp-notify

# Deploy WhatsApp webhook (already deployed)
supabase functions deploy whatsapp-webhook

# Deploy WhatsApp scheduler
supabase functions deploy whatsapp-scheduler
```

### 2. Run Database Migrations

```bash
# Apply WhatsApp sync triggers
supabase db push

# Or manually run:
# 20250122_whatsapp_sync_triggers.sql
# 20250122_add_payments_and_missing_columns.sql
```

### 3. Set Environment Variables

Ensure these are set in Supabase Edge Functions:

```env
WHATSAPP_TOKEN=your_whatsapp_token
WHATSAPP_PHONE_NUMBER_ID=your_phone_number_id
WHATSAPP_VERIFY_TOKEN=your_verify_token
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
APP_URL=https://app.fintrex.ai
```

### 4. Setup Cron Job for Scheduler

#### Option A: Supabase Cron (Recommended)

Add to your Supabase project settings or use `pg_cron`:

```sql
-- Run scheduler every hour
SELECT cron.schedule(
  'whatsapp-scheduler-hourly',
  '0 * * * *', -- Every hour
  $$
  SELECT net.http_post(
    url := 'https://your-project.supabase.co/functions/v1/whatsapp-scheduler',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    )
  );
  $$
);
```

#### Option B: External Cron (e.g., GitHub Actions)

Create `.github/workflows/whatsapp-scheduler.yml`:

```yaml
name: WhatsApp Scheduler

on:
  schedule:
    - cron: '0 * * * *' # Every hour

jobs:
  run-scheduler:
    runs-on: ubuntu-latest
    steps:
      - name: Call scheduler function
        run: |
          curl -X POST \
            -H "Authorization: Bearer ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}" \
            https://your-project.supabase.co/functions/v1/whatsapp-scheduler
```

#### Option C: EasyCron / Other Services

Set up a cron job to hit:
```
POST https://your-project.supabase.co/functions/v1/whatsapp-scheduler
Header: Authorization: Bearer YOUR_SERVICE_ROLE_KEY
```

Recommended schedule: **Every hour** (0 * * * *)

### 5. Configure WhatsApp Business Account

1. Ensure webhook is configured in Meta Business Manager
2. Webhook URL: `https://your-project.supabase.co/functions/v1/whatsapp-webhook`
3. Verify token matches `WHATSAPP_VERIFY_TOKEN`
4. Subscribe to `messages` events

## How It Works

### Automatic Notifications Flow

```
Document Status Change
  ↓
Database Trigger Fires
  ↓
trigger_notify_document_status() called
  ↓
notify_whatsapp() function
  ↓
HTTP POST to whatsapp-notify edge function
  ↓
WhatsApp API sends message to client
  ↓
Logged in whatsapp_notifications_log
```

### Scheduled Notifications Flow

```
Cron Job Triggers
  ↓
whatsapp-scheduler function runs
  ↓
Queries database for pending reminders
  ↓
Calls whatsapp-notify for each reminder
  ↓
Updates reminder_count and last_reminder_sent
  ↓
Returns summary of sent notifications
```

### Interactive Buttons Flow

```
Client clicks button in WhatsApp
  ↓
Meta sends webhook to whatsapp-webhook
  ↓
handleButtonClick() identifies action
  ↓
Appropriate handler function called
  ↓
Database updated
  ↓
Confirmation message sent to client
```

## Notification Types Reference

| Type | Trigger | Frequency | Interactive |
|------|---------|-----------|-------------|
| `document_status` | Document status change | Real-time | No |
| `payment_reminder` | Due date approaching | 3 days before, on due, when overdue | Yes |
| `journal_entry` | Journal entry created | Real-time | No |
| `anomaly` | Anomaly detected | Real-time | Yes |
| `gst_filing` | GST due date approaching | 5 days before due | No |
| `monthly_summary` | 1st of month | Monthly | No |
| `kyc_request` | KYC document needed | Every 2 days | Yes |
| `document_request` | Document needed | Based on priority | No |
| `payment_confirmation` | Payment recorded | Real-time | No |

## Button Interactions Reference

| Button ID Pattern | Action | Updates |
|-------------------|--------|---------|
| `approve_{docId}` | Approve document | Sets status to approved |
| `review_{docId}` | Request review | Sends web app link |
| `reject_{docId}` | Reject document | Sets status to rejected |
| `mark_paid_{invoiceId}` | Mark invoice as paid | Creates payment record |
| `view_invoice_{invoiceId}` | View invoice details | Shows invoice info |
| `review_anomaly_{docId}` | Review anomaly | Sends web app link |
| `ignore_anomaly_{docId}` | Ignore anomaly | Marks anomaly as ignored |
| `upload_kyc` | Start KYC upload | Starts document upload flow |

## Testing

### Test Document Status Notification

```sql
-- Update a document status
UPDATE documents
SET status = 'completed'
WHERE id = 'your-document-id';

-- Check notification log
SELECT * FROM whatsapp_notifications_log
ORDER BY created_at DESC
LIMIT 1;
```

### Test Payment Reminder

```sql
-- Create a payment reminder
INSERT INTO payment_reminders (
  invoice_id,
  client_id,
  due_date,
  status
) VALUES (
  'your-invoice-id',
  'your-client-id',
  CURRENT_DATE + INTERVAL '2 days',
  'pending'
);

-- Manually trigger scheduler
-- POST to /functions/v1/whatsapp-scheduler
```

### Test Monthly Summary

```sql
-- Manually call notification function
SELECT notify_whatsapp(
  'monthly_summary',
  jsonb_build_object(
    'client_id', 'your-client-id',
    'month', 1,
    'year', 2025
  )
);
```

## Monitoring

### Check Notification Logs

```sql
-- Recent notifications
SELECT
  notification_type,
  payload,
  status,
  created_at,
  error_message
FROM whatsapp_notifications_log
ORDER BY created_at DESC
LIMIT 100;

-- Notification success rate
SELECT
  notification_type,
  COUNT(*) as total,
  COUNT(CASE WHEN status = 'sent' THEN 1 END) as sent,
  COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed,
  ROUND(
    100.0 * COUNT(CASE WHEN status = 'sent' THEN 1 END) / COUNT(*),
    2
  ) as success_rate_percent
FROM whatsapp_notifications_log
WHERE created_at > NOW() - INTERVAL '24 hours'
GROUP BY notification_type;
```

### Check Scheduler Performance

```sql
-- Last scheduler run
SELECT *
FROM whatsapp_notifications_log
WHERE notification_type = 'scheduler_run'
ORDER BY created_at DESC
LIMIT 1;
```

### Monitor Rate Limits

```sql
-- Check rate limits by phone number
SELECT
  phone_number,
  request_count,
  window_start,
  blocked_until
FROM whatsapp_rate_limits
WHERE blocked_until > NOW()
  OR window_start > NOW() - INTERVAL '1 hour';
```

## Troubleshooting

### Notifications Not Sending

1. **Check environment variables**:
   ```bash
   # In Supabase dashboard
   Settings > Edge Functions > Environment Variables
   ```

2. **Check notification log for errors**:
   ```sql
   SELECT * FROM whatsapp_notifications_log
   WHERE status = 'failed'
   ORDER BY created_at DESC;
   ```

3. **Verify WhatsApp token is valid**:
   ```bash
   curl -X GET "https://graph.facebook.com/v20.0/me?access_token=YOUR_TOKEN"
   ```

### Scheduler Not Running

1. **Check cron job is configured** (see Setup Instructions)

2. **Manually trigger to test**:
   ```bash
   curl -X POST \
     -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY" \
     https://your-project.supabase.co/functions/v1/whatsapp-scheduler
   ```

3. **Check function logs**:
   ```bash
   supabase functions logs whatsapp-scheduler
   ```

### Triggers Not Firing

1. **Check trigger exists**:
   ```sql
   SELECT * FROM pg_trigger
   WHERE tgname LIKE 'notify_%';
   ```

2. **Check function exists**:
   ```sql
   SELECT * FROM pg_proc
   WHERE proname = 'notify_whatsapp';
   ```

3. **Manually test trigger**:
   ```sql
   SELECT notify_whatsapp(
     'document_status',
     jsonb_build_object(
       'document_id', 'test-id',
       'status', 'completed'
     )
   );
   ```

## Rate Limits & Best Practices

### WhatsApp Rate Limits (Built-in)
- **20 requests per phone number per hour**
- Automatically tracked in `whatsapp_rate_limits` table
- Users blocked for 1 hour if exceeded

### Sending Best Practices
- Scheduler runs hourly (not more frequent to avoid overload)
- Payment reminders: Max 3 per invoice
- KYC reminders: Every 2 days, max 3
- Document requests: Based on priority (daily for urgent)

### Message Guidelines
- Keep messages concise and actionable
- Use emojis for visual clarity
- Provide context (invoice numbers, amounts, dates)
- Include call-to-action buttons where appropriate

## Security Considerations

1. **Service Role Key**: Only used in edge functions, never exposed to client
2. **Row Level Security**: All tables have RLS enabled
3. **Phone Number Validation**: Only registered clients receive messages
4. **Rate Limiting**: Prevents abuse and spam
5. **Session Expiry**: WhatsApp sessions expire after 24 hours
6. **Webhook Verification**: Meta webhook verification token required

## Future Enhancements

### Planned Features
- [ ] Multi-language support (Hindi, Tamil, etc.)
- [ ] Rich media notifications (PDF invoices via WhatsApp)
- [ ] Voice message support for complex explanations
- [ ] WhatsApp chatbot for common queries
- [ ] Analytics dashboard for notification effectiveness
- [ ] A/B testing for message templates
- [ ] SMS fallback for non-WhatsApp users

### Performance Optimizations
- [ ] Batch notifications for multiple clients
- [ ] Queue system for high-volume periods
- [ ] Caching for frequently accessed data
- [ ] Database query optimization
- [ ] CDN for media files

## Support

For issues or questions:
1. Check logs in Supabase dashboard
2. Review notification log table
3. Check WhatsApp Business Manager for webhook status
4. Contact Fintrex support team

## Changelog

### v1.0.0 (2025-01-22)
- ✅ Initial implementation
- ✅ All 9 notification types
- ✅ Database triggers
- ✅ Scheduler function
- ✅ Interactive buttons
- ✅ Payment tracking
- ✅ Anomaly detection
- ✅ GST filing reminders
- ✅ Monthly summaries
- ✅ Complete documentation

---

**Status**: ✅ **PRODUCTION READY**

All WhatsApp sync features are fully implemented and tested. The app is now completely synced with WhatsApp!
