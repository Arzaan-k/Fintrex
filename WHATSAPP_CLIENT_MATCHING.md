# WhatsApp Smart Client Matching System

## Overview

The WhatsApp integration now uses **smart client matching** to automatically link incoming messages to existing client accounts that accountants have already created in their dashboard. This ensures all documents are properly organized under the correct client profile.

---

## How It Works

### 1. Accountant Creates Client in Dashboard

The accountant first creates a client account via the web dashboard:

```
Dashboard → Clients → Add New Client

Fields:
- Client Name: "ABC Enterprises"
- Phone Number: +919876543210  ← This is key!
- Email: client@example.com
- GSTIN: 29XXXXX1234X1Z5
- Address: ...
```

### 2. Client Sends WhatsApp Message

When the client sends a message from their WhatsApp number (`+919876543210`):

```
Client WhatsApp: "Hi"
```

### 3. System Automatically Matches

The webhook performs smart matching:

```typescript
// Phone variants for flexible matching
const phoneVariants = [
  "+919876543210",      // Full international format
  "919876543210",       // Without +
  "9876543210",         // Without country code
  "09876543210"         // With 0 prefix
];

// Find existing client
const { data: clients } = await supabase
  .from("clients")
  .select("id, phone_number, email, client_name, status")
  .eq("accountant_id", accountantId)
  .or(`phone_number.in.(...),phone.in.(...)`)
  .limit(1);
```

### 4. Documents Linked to Client Profile

All documents uploaded by this WhatsApp number are automatically:
- ✅ Linked to the matched client ID
- ✅ Visible only under that client's profile
- ✅ Segregated from other clients
- ✅ Accessible only to the assigned accountant

---

## Matching Logic

### Priority 1: Phone Number Matching

The system checks multiple phone formats:

| Format | Example | Use Case |
|--------|---------|----------|
| Full international | `+919876543210` | Standard WhatsApp format |
| Without + | `919876543210` | Some systems |
| Without country code | `9876543210` | Indian mobile numbers |
| With 0 prefix | `09876543210` | Traditional format |

**Match Example:**
```
Dashboard: phone_number = "9876543210"
WhatsApp: from = "+919876543210"
✅ MATCH - Same number, different format
```

### Priority 2: Email Matching (Future)

For clients who message from different numbers but provide email:

```
Client: "My email is client@example.com"
System: Checks email field in clients table
✅ MATCH - Links to existing account
```

---

## User Experience

### Scenario A: Existing Client (Registered)

**1. Client sends first message:**
```
Client: "Hi"
```

**2. System finds match:**
```
✅ Matched to existing client: ABC Enterprises (uuid-123)
```

**3. Personalized response:**
```
Bot: Welcome back, ABC Enterprises! 👋

Your documents will be automatically linked to your account.

Send me an invoice to get started! 📄
```

**4. Client sends invoice:**
```
Client: *Sends invoice.pdf*
```

**5. Document stored under client profile:**
```
Database:
- client_id: uuid-123 (ABC Enterprises)
- accountant_id: uuid-accountant
- file_path: uuid-123/1737039123_invoice.pdf
- upload_source: whatsapp
```

**6. Accountant sees in dashboard:**
```
Clients → ABC Enterprises → Documents
- invoice.pdf (uploaded via WhatsApp)
- Status: Processing
- Confidence: 94%
```

---

### Scenario B: Unknown Number (Not Registered)

**1. Unknown client sends message:**
```
Unknown: "Hi"
Phone: +911234567890
```

**2. System checks for match:**
```
⚠️ Unknown phone number +911234567890 - no client account found
```

**3. Rejection message:**
```
Bot: ⚠️ *Account Not Found*

Your phone number is not registered in our system.

Please ask your accountant to add you as a client first,
or provide your registered phone number/email.

For support, contact your accountant.
```

**4. No documents accepted:**
```
- Document uploads blocked
- No client_id assigned
- Message processing stopped
```

---

## Accountant Workflow

### Step 1: Add Client in Dashboard

```
1. Go to Dashboard → Clients → Add New
2. Fill in client details:
   ✓ Client Name
   ✓ Phone Number (MUST match WhatsApp number)
   ✓ Email (optional)
   ✓ Other details
3. Click Save
```

### Step 2: Share WhatsApp Number

```
Accountant tells client:

"Send your invoices to our WhatsApp Business number:
+91-XXXX-XXXXXX

Your documents will be automatically processed and
added to your account."
```

### Step 3: Client Sends Documents

```
Client messages the WhatsApp number
→ System matches phone number
→ Documents auto-linked to client profile
→ Accountant sees in client's document list
```

### Step 4: Review in Dashboard

```
Dashboard → Clients → ABC Enterprises → Documents

View all documents from this client:
- WhatsApp uploads
- Web uploads
- Email uploads

All in one place! ✅
```

---

## Technical Implementation

### Database Schema

**clients table:**
```sql
CREATE TABLE clients (
  id UUID PRIMARY KEY,
  accountant_id UUID REFERENCES profiles(id),
  client_name TEXT NOT NULL,
  phone_number TEXT,      -- Primary matching field
  phone TEXT,             -- Alternative phone field
  email TEXT,             -- Future: email matching
  -- ... other fields
);

-- Index for fast phone lookups
CREATE INDEX idx_clients_phone ON clients(phone_number);
CREATE INDEX idx_clients_phone_alt ON clients(phone);
CREATE INDEX idx_clients_email ON clients(email);
```

**documents table:**
```sql
CREATE TABLE documents (
  id UUID PRIMARY KEY,
  client_id UUID REFERENCES clients(id),  -- Linked to matched client
  accountant_id UUID REFERENCES profiles(id),
  file_path TEXT,
  upload_source TEXT,  -- 'whatsapp', 'web', 'email'
  -- ... other fields
);

-- Documents are scoped to client
CREATE INDEX idx_documents_client ON documents(client_id);
```

### Matching Code

```typescript
// Smart client matching
const phoneVariants = [
  from,                                    // +919876543210
  from.replace(/^\+/, ''),                 // 919876543210
  from.replace(/^\+?91/, ''),              // 9876543210
  from.replace(/^\+?91/, '0'),             // 09876543210
];

const { data: clients } = await supabase
  .from("clients")
  .select("id, phone_number, email, client_name, status")
  .eq("accountant_id", accountantId)
  .or(`phone_number.in.(${phoneVariants.join(',')}),phone.in.(${phoneVariants.join(',')})`)
  .limit(1);

if (clients && clients.length > 0) {
  // ✅ Match found
  clientId = clients[0].id;
  clientName = clients[0].client_name;

  // All documents will use this client_id
  await createDocument({
    client_id: clientId,
    // ...
  });
} else {
  // ❌ No match - reject
  await sendRejectionMessage(from);
  continue; // Skip processing
}
```

---

## Security & Privacy

### 1. Data Isolation

Each accountant's clients are isolated:

```typescript
// Always scoped to accountant
.eq("accountant_id", accountantId)

// Results:
Accountant A's clients: [Client 1, Client 2, Client 3]
Accountant B's clients: [Client 4, Client 5, Client 6]
❌ Accountant A cannot see Client 4's documents
```

### 2. No Auto-Creation

**OLD (Insecure):**
```
Unknown number → Auto-create client → Accept documents
⚠️ Security risk: Anyone could send documents
```

**NEW (Secure):**
```
Unknown number → No match → Reject documents
✅ Only registered clients can upload
```

### 3. Accountant Verification

The system verifies:
1. ✅ WhatsApp Business number → Accountant profile
2. ✅ Client phone → Client profile
3. ✅ Client → Accountant relationship
4. ✅ Document → Client ownership

---

## Benefits

### For Accountants

✅ **Organized**: All client documents in one place
✅ **Automatic**: No manual linking required
✅ **Secure**: Only registered clients can upload
✅ **Trackable**: See which client sent which document
✅ **Scalable**: Works for 1 or 1000 clients

### For Clients

✅ **Simple**: Just send to WhatsApp, no account setup
✅ **Fast**: Documents instantly linked to their profile
✅ **Reliable**: Always goes to the right accountant
✅ **Transparent**: Can see status in dashboard if given access

---

## Testing

### Test Case 1: Existing Client

```sql
-- Setup: Create client
INSERT INTO clients (accountant_id, client_name, phone_number)
VALUES ('accountant-uuid', 'Test Client', '9876543210');

-- Test: Send WhatsApp message from +919876543210
-- Expected: ✅ Match found, welcome message sent

-- Verify:
SELECT * FROM documents
WHERE client_id = (
  SELECT id FROM clients WHERE phone_number = '9876543210'
);
-- Should show uploaded document
```

### Test Case 2: Unknown Number

```
-- Test: Send WhatsApp message from +911234567890
-- (Number not in clients table)

-- Expected: ❌ Rejection message sent
-- Verify: No document created
```

### Test Case 3: Multiple Format Match

```sql
-- Setup: Client has phone = "9876543210" (no prefix)
-- Test: WhatsApp message from "+919876543210" (full format)
-- Expected: ✅ Match found (format normalized)
```

---

## Future Enhancements

### 1. Email-Based Matching

```
Client: "My email is client@example.com"
System: Checks email field
✅ Match → Link to account
```

### 2. Multi-Number Support

```sql
ALTER TABLE clients ADD COLUMN alternate_phones TEXT[];

-- Match any of client's registered numbers
WHERE phone_number = ANY(alternate_phones)
```

### 3. Client Verification Code

```
Unknown number → Send verification code → Client provides → Match
```

### 4. Accountant Notifications

```
Unknown number tries to send doc
→ Notify accountant
→ "Add +911234567890 as client?"
→ One-click approval
```

---

## Troubleshooting

### Issue: Client not matched despite registration

**Check:**
```sql
-- Verify client exists
SELECT id, client_name, phone_number
FROM clients
WHERE accountant_id = 'your-accountant-uuid';

-- Check exact format
SELECT phone_number FROM clients WHERE id = 'client-uuid';
```

**Common Issues:**
- Phone format mismatch: Use `9876543210` format
- Wrong accountant: Check `accountant_id` is correct
- Typo in number: Verify digits match exactly

**Fix:**
```sql
-- Update phone format
UPDATE clients
SET phone_number = '9876543210'
WHERE id = 'client-uuid';
```

### Issue: Documents going to wrong client

**Cause**: Multiple clients with same phone number

**Check:**
```sql
-- Find duplicates
SELECT phone_number, COUNT(*)
FROM clients
WHERE accountant_id = 'your-accountant-uuid'
GROUP BY phone_number
HAVING COUNT(*) > 1;
```

**Fix:**
```sql
-- Remove or update duplicate
UPDATE clients
SET phone_number = NULL  -- or correct number
WHERE id = 'duplicate-client-uuid';
```

---

## Best Practices

### 1. Phone Number Format

**Recommended format in dashboard:**
```
✅ 9876543210          (10 digits, no prefix)
✅ +919876543210       (full international)
✅ 919876543210        (with country code)

❌ (0) 9876543210      (with spaces/brackets)
❌ 98765-43210         (with dashes)
```

### 2. Client Onboarding

```
Step 1: Add client in dashboard with phone
Step 2: Tell client the WhatsApp number
Step 3: Client sends "Hi" to test
Step 4: Verify match in logs
Step 5: Start sending documents
```

### 3. Data Hygiene

```
Regular cleanup:
- Remove duplicate phone numbers
- Verify all clients have accountant_id
- Check for orphaned documents
```

---

## Summary

**How it works:**
1. Accountant creates client with phone number in dashboard
2. Client sends WhatsApp message from that number
3. System automatically matches and links documents
4. All documents appear under client's profile
5. Perfect organization with zero manual work!

**Key Feature:** No auto-creation of clients. Only pre-registered clients can upload documents. This ensures security, organization, and proper client management.

---

**🎉 Smart Client Matching Complete!**

Your WhatsApp integration now properly segregates all documents by client, ensuring each accountant sees only their clients' documents, and each client's documents are properly organized under their profile.
