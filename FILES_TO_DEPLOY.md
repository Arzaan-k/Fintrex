# 📂 Exact Files to Deploy

## 🎯 Summary
You need to:
1. Run **1 SQL file** in Supabase SQL Editor
2. Deploy **6 TypeScript files** as an Edge Function

---

## 1️⃣ SQL Migration (Run in SQL Editor)

### File Path:
```
supabase/migrations/20250120000000_whatsapp_complete_fixed.sql
```

### Where to run:
- Supabase Dashboard → SQL Editor → New Query → Paste → Run

### What it creates:
- 9 database tables
- All indexes (with IF NOT EXISTS)
- All RLS policies
- Helper functions

### Expected result:
✅ "Success. No rows returned"

---

## 2️⃣ Edge Function Files (Deploy as Function)

### Function Name:
```
whatsapp-webhook
```

### Files to upload (all from `supabase/functions/whatsapp-webhook/`):

#### Main File:
1. **index.ts** (543 KB)
   - Main webhook handler
   - Handles GET (verification) and POST (messages)

#### Import Modules:
2. **session-manager.ts** (9 KB)
   - Session management functions
   - Exports: getOrCreateSession, updateSession, etc.

3. **accounting-validations.ts**
   - Invoice validation logic
   - GST validation
   - Accounting rules

4. **kyc-workflows.ts**
   - KYC document workflows
   - Template management
   - Document requests

5. **vendor-matching.ts**
   - Vendor normalization
   - Fuzzy matching
   - Vendor master management

#### Configuration:
6. **deno.json** (IMPORTANT!)
   ```json
   {
     "compilerOptions": {
       "lib": ["deno.window"],
       "types": ["https://esm.sh/@supabase/functions-js/src/edge-runtime.d.ts"]
     },
     "imports": {
       "@supabase/supabase-js": "https://esm.sh/@supabase/supabase-js@2"
     }
   }
   ```
   **This fixes the "Module not found" error!**

---

## 📋 Deployment Checklist

### Step 1: Migration
- [ ] Opened Supabase SQL Editor
- [ ] Copied contents of `20250120000000_whatsapp_complete_fixed.sql`
- [ ] Pasted and clicked Run
- [ ] Saw success message (no errors)

### Step 2: Edge Function
- [ ] Opened Edge Functions in Supabase Dashboard
- [ ] Clicked "Deploy new function"
- [ ] Named it `whatsapp-webhook`
- [ ] Uploaded `index.ts` as main file
- [ ] Uploaded `session-manager.ts`
- [ ] Uploaded `accounting-validations.ts`
- [ ] Uploaded `kyc-workflows.ts`
- [ ] Uploaded `vendor-matching.ts`
- [ ] Uploaded `deno.json` ← **Don't forget this!**
- [ ] Clicked Deploy
- [ ] Deployment succeeded (no errors)

### Step 3: Secrets
- [ ] Set `WHATSAPP_TOKEN`
- [ ] Set `WHATSAPP_VERIFY_TOKEN`
- [ ] Set `SUPABASE_URL`
- [ ] Set `SUPABASE_SERVICE_ROLE_KEY`
- [ ] Set `APP_URL`

---

## 🔍 File Locations

All files are in your project:

```
Fintrex/
├── supabase/
│   ├── migrations/
│   │   └── 20250120000000_whatsapp_complete_fixed.sql ← RUN THIS IN SQL EDITOR
│   └── functions/
│       └── whatsapp-webhook/
│           ├── index.ts                      ← MAIN FILE
│           ├── session-manager.ts            ← IMPORT 1
│           ├── accounting-validations.ts     ← IMPORT 2
│           ├── kyc-workflows.ts              ← IMPORT 3
│           ├── vendor-matching.ts            ← IMPORT 4
│           └── deno.json                     ← CONFIG (FIXES ERROR!)
├── DEPLOYMENT_GUIDE.md    ← Full instructions
├── FIXES_SUMMARY.md       ← What was fixed
├── QUICK_DEPLOY.md        ← Quick reference
└── FILES_TO_DEPLOY.md     ← This file
```

---

## ⚠️ Important Notes

### Don't use these old files:
- ❌ `202511190001_whatsapp_complete_schema.sql` - Has bugs, will fail
- ❌ `20251117_add_whatsapp_fields.sql` - Functionality already in new migration

### Do use this new file:
- ✅ `20250120000000_whatsapp_complete_fixed.sql` - Fixed, idempotent version

### Why deno.json is critical:
Without it, you get:
```
Module not found "file:///.../session-manager.ts"
```

With it:
```
✅ Function deployed successfully
```

---

## 🧪 Verify Deployment

### Check migration worked:
```sql
-- Run in SQL Editor
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name LIKE '%whatsapp%';

-- Should return:
-- whatsapp_sessions
-- whatsapp_messages
-- whatsapp_rate_limits
```

### Check edge function works:
```bash
curl "https://izqefnwufcaldqpzuhkr.supabase.co/functions/v1/whatsapp-webhook?hub.mode=subscribe&hub.verify_token=YOUR_TOKEN&hub.challenge=test123"

# Should return: test123
```

---

## 📊 File Sizes (for reference)

```
index.ts                    ~25 KB
session-manager.ts          ~10 KB
accounting-validations.ts   ~15 KB
kyc-workflows.ts           ~12 KB
vendor-matching.ts         ~10 KB
deno.json                  ~0.2 KB
-----------------------------------
Total:                     ~72 KB
```

---

## ✅ Success Criteria

After deployment:

1. **SQL Editor:**
   - ✅ No errors when running migration
   - ✅ All tables show up in Database → Tables

2. **Edge Functions:**
   - ✅ Function status is "Active"
   - ✅ No errors in function logs
   - ✅ Test endpoint returns challenge correctly

3. **WhatsApp:**
   - ✅ Webhook verification succeeds
   - ✅ Messages are received and processed
   - ✅ Bot responds with welcome message

---

## 🆘 Quick Fixes

**"Index already exists" error?**
→ You're using the old migration file. Use `20250120000000_whatsapp_complete_fixed.sql`

**"Module not found" error?**
→ You forgot to upload `deno.json`. Upload it with the function files.

**"Cannot find project ref" error?**
→ Use Supabase Dashboard instead of CLI, or run `supabase login` first

**Function returns 502 error?**
→ Check that all 5 secrets are set correctly

---

## 🎯 Bottom Line

**Migrate:** 1 file → SQL Editor
**Deploy:** 6 files → Edge Function
**Secrets:** 5 values → Settings

That's it! 🚀
