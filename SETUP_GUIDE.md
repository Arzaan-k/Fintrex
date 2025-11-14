# 🚀 Fintrex Setup Guide

Complete guide to set up Fintrex and fix all RLS errors.

**Last Updated:** 2025-01-15

---

## 📋 Table of Contents

1. [Prerequisites](#prerequisites)
2. [Supabase Setup](#supabase-setup)
3. [Database Migration](#database-migration)
4. [Environment Variables](#environment-variables)
5. [Frontend Setup](#frontend-setup)
6. [Common Issues & Solutions](#common-issues--solutions)
7. [Verification](#verification)

---

## 1. Prerequisites

Before starting, ensure you have:

- ✅ Node.js 18+ installed
- ✅ npm or yarn package manager
- ✅ Supabase account ([sign up here](https://supabase.com))
- ✅ Supabase CLI installed (optional but recommended)

### Install Supabase CLI (Optional)

```bash
npm install -g supabase
```

Or use npx:
```bash
npx supabase --version
```

---

## 2. Supabase Setup

### Step 1: Create a New Supabase Project

1. Go to [Supabase Dashboard](https://supabase.com/dashboard)
2. Click "New Project"
3. Fill in:
   - **Project Name:** Fintrex
   - **Database Password:** (save this securely)
   - **Region:** Choose closest to your users
   - **Pricing Plan:** Free tier works fine

### Step 2: Get API Credentials

1. In your project, go to **Settings > API**
2. Copy these values:
   - **Project URL** (e.g., `https://xxxxx.supabase.co`)
   - **Anon/Public Key** (starts with `eyJhbGc...`)
   - **Service Role Key** (keep this secret!)

### Step 3: Create Storage Bucket

1. Go to **Storage** in the sidebar
2. Click "Create a new bucket"
3. Enter:
   - **Name:** `documents`
   - **Public:** Uncheck (keep private)
   - **File size limit:** 25 MB
   - **Allowed MIME types:** `application/pdf, image/jpeg, image/png, image/jpg`
4. Click "Create bucket"

---

## 3. Database Migration

### Option A: Using Supabase CLI (Recommended)

If you have Supabase CLI installed:

```bash
# Login to Supabase
supabase login

# Link to your project
supabase link --project-ref your-project-id

# Run migrations
supabase db push
```

### Option B: Using SQL Editor (Manual)

If you don't have Supabase CLI:

1. Go to **SQL Editor** in your Supabase dashboard
2. Click "New query"
3. Run migrations in this order:

#### Migration 1: Core Schema
Copy and paste the contents of:
```
supabase/migrations/FINAL_COMPLETE_MIGRATION.sql
```

#### Migration 2: Review Queue System
Copy and paste the contents of:
```
supabase/migrations/20250112000000_review_queue_system.sql
```

#### Migration 3: Fix RLS and Schema Issues
Copy and paste the contents of:
```
supabase/migrations/20250115_fix_rls_and_schema.sql
```

#### Migration 4: Fix Storage Policies
Copy and paste the contents of:
```
supabase/migrations/20250115_fix_storage_policies.sql
```

4. Click "Run" for each migration
5. Verify no errors appear

---

## 4. Environment Variables

### Step 1: Create .env File

```bash
cp .env.example .env
```

### Step 2: Configure Required Variables

Edit `.env` and set these **REQUIRED** variables:

```bash
# Supabase Configuration (REQUIRED)
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
VITE_SUPABASE_PROJECT_ID=your-project-id
```

### Step 3: Set Up Supabase Secrets (For OCR)

These API keys are **server-side only** and should be set as Supabase secrets.

#### Using Supabase CLI:

```bash
# Google Gemini (Recommended for OCR)
supabase secrets set GEMINI_API_KEY=your-gemini-api-key

# Alternative OCR providers (optional)
supabase secrets set DEEPSEEK_API_KEY=your-deepseek-key
supabase secrets set GOOGLE_VISION_API_KEY=your-vision-key
supabase secrets set OCRSPACE_API_KEY=your-ocrspace-key
```

#### Using Supabase Dashboard:

1. Go to **Settings > Edge Functions > Secrets**
2. Add each key:
   - Key: `GEMINI_API_KEY`
   - Value: `your-api-key-here`
3. Click "Add Secret"

### Step 4: Get OCR API Keys

#### Google Gemini API (Recommended)
1. Go to [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Click "Create API Key"
3. Copy the key and set as secret

#### DeepSeek API (Alternative)
1. Go to [DeepSeek Platform](https://platform.deepseek.com/api_keys)
2. Create an API key
3. Copy and set as secret

### Step 5: Optional Services

#### WhatsApp Integration (Optional)
```bash
supabase secrets set WHATSAPP_TOKEN=your-whatsapp-token
supabase secrets set WHATSAPP_PHONE_NUMBER_ID=your-phone-id
```

#### Email Service (Optional)
```bash
# SendGrid
supabase secrets set SENDGRID_API_KEY=SG.xxxxxxxxxx

# Or Mailgun
supabase secrets set MAILGUN_API_KEY=key-xxxxxxxxxx
supabase secrets set MAILGUN_DOMAIN=mg.yourdomain.com
```

---

## 5. Frontend Setup

### Step 1: Install Dependencies

```bash
npm install
```

### Step 2: Run Development Server

```bash
npm run dev
```

The app should now be running at `http://localhost:8080`

### Step 3: Build for Production

```bash
npm run build
```

---

## 6. Common Issues & Solutions

### Issue 1: "new row violates row-level security policy"

**Cause:** RLS policies not properly configured

**Solution:**
1. Run the migration: `20250115_fix_rls_and_schema.sql`
2. Run the migration: `20250115_fix_storage_policies.sql`
3. Verify policies in **Database > Policies**

### Issue 2: "Could not find the 'cess' column of 'invoices'"

**Cause:** Missing columns in invoices table

**Solution:**
1. Run migration: `20250115_fix_rls_and_schema.sql`
2. This adds: `cess`, `cgst`, `sgst`, `igst`, `subtotal`, `vendor_address`, `customer_address`

### Issue 3: Review Queue 400 Errors

**Cause:** Review queue RLS policies too restrictive

**Solution:**
1. Run migration: `20250115_fix_rls_and_schema.sql`
2. This updates review_queue policies to allow both accountants and clients

### Issue 4: "Blocked request. This host is not allowed"

**Cause:** Vite config missing allowed hosts

**Solution:**
Already fixed in `vite.config.ts` with:
```typescript
server: {
  allowedHosts: [
    "fintrex.onrender.com",
    ".onrender.com",
    "localhost",
    ".lovable.app",
    ".lovable.dev"
  ]
}
```

### Issue 5: React Router Future Flag Warnings

**Cause:** React Router v6 deprecation warnings

**Solution:**
Already fixed in `src/App.tsx` with:
```typescript
<BrowserRouter
  future={{
    v7_startTransition: true,
    v7_relativeSplatPath: true,
  }}
>
```

### Issue 6: Storage Upload Fails with 403

**Cause:** Storage bucket RLS policies not configured

**Solution:**
1. Run migration: `20250115_fix_storage_policies.sql`
2. This allows authenticated users to upload to documents bucket

---

## 7. Verification

### Test Database Connection

1. Log in to your app at `http://localhost:8080/auth`
2. Create a test account
3. Navigate to Dashboard

### Test Document Upload

1. Go to **Documents** page
2. Click "Upload Document"
3. Upload a test PDF or image
4. Verify no RLS errors in console

### Test Review Queue

1. Upload a document
2. Go to **Review Queue** page
3. Verify items appear without 400 errors

### Check Console for Errors

Open browser DevTools (F12) and verify:
- ✅ No RLS errors
- ✅ No "cess column" errors
- ✅ No storage policy errors
- ✅ No React Router warnings

---

## 🎉 You're All Set!

Your Fintrex installation should now be fully functional with:

- ✅ Fixed RLS policies for all tables
- ✅ Fixed storage bucket permissions
- ✅ Complete invoices table schema
- ✅ React Router v7 future flags enabled
- ✅ Vite config allowing production hosts
- ✅ Comprehensive environment variable setup

---

## 📚 Additional Resources

- [Supabase Documentation](https://supabase.com/docs)
- [Row Level Security Guide](https://supabase.com/docs/guides/auth/row-level-security)
- [Storage Documentation](https://supabase.com/docs/guides/storage)
- [Edge Functions Guide](https://supabase.com/docs/guides/functions)

---

## 🆘 Need Help?

If you encounter any issues:

1. Check the [Common Issues](#common-issues--solutions) section
2. Review Supabase logs in Dashboard > Logs
3. Check browser console for detailed error messages
4. Verify all migrations ran successfully

---

**Happy Accounting! 📊**
