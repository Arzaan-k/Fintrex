# Fintrex - Product Requirements Document (PRD)

## Executive Summary

**Product Name:** Fintrex
**Version:** 1.0
**Target Market:** Indian Chartered Accountants, Accounting Firms, GST Consultants
**Launch Date:** Q1 2025

### Vision Statement
Fintrex is an AI-powered accounting automation platform that eliminates 60-70% of manual work for Indian accountants by automating client onboarding, document processing, and GST compliance reporting.

### Mission
Empower Indian accountants to scale their practice 3x without hiring additional staff by leveraging cutting-edge AI/ML technology for document processing and compliance automation.

---

## Problem Statement

### Current Pain Points

Indian accountants face three critical bottlenecks:

1. **Manual Client Onboarding (30-45 minutes per client)**
   - Chasing clients for KYC documents via calls, SMS, email
   - Manually verifying PAN, Aadhaar, GSTIN, incorporation certificates
   - Organizing documents in folders/drives with inconsistent naming
   - Missing documents discovered weeks later during filing

2. **Document Data Entry (2-3 hours per client monthly)**
   - Manually typing invoice data from scanned PDFs or photos
   - Cross-referencing vendor names (Reliance Industries vs Reliance Ind. Ltd)
   - Calculating GST amounts and validating HSN codes
   - Error rates of 5-10% leading to compliance issues

3. **GST Compliance Reporting (4-5 hours per client monthly)**
   - Manually preparing GSTR-1 from sales invoices
   - Manually preparing GSTR-3B from purchase invoices
   - Reconciling input tax credit (ITC)
   - Generating balance sheets and P&L statements
   - Last-minute filing rush due to backlog

### Market Validation

- **Target Addressable Market:** 150,000+ practicing CAs in India
- **Serviceable Market:** 50,000+ CAs managing 10+ clients (500,000+ businesses)
- **Current Tools:** Excel sheets, Tally, manual WhatsApp/email communication
- **Willingness to Pay:** ₹2,000-5,000/month for 10x time savings

---

## Solution Overview

### Core Value Proposition

**"From 40 hours to 4 hours per month - AI-powered accounting automation for Indian CAs"**

Fintrex automates the entire accounting workflow:
- **WhatsApp-native** client onboarding in 5 minutes
- **AI-powered OCR** with 95%+ accuracy across 4 engines
- **One-click GST reports** (GSTR-1, GSTR-3B) ready for e-filing
- **Automated balance sheets** with double-entry validation

### Key Differentiators

| Feature | Traditional Tools | Fintrex |
|---------|------------------|---------|
| Client Onboarding | 30-45 min manual | 5 min automated (WhatsApp) |
| Document Data Entry | 100% manual typing | 95% automated (AI OCR) |
| GST Report Generation | 4-5 hours | 15 minutes (one-click) |
| Client Communication | Calls/SMS/Email | WhatsApp Business API |
| Accuracy | 90-95% (human error) | 98%+ (AI + human review) |
| Scalability | 1 CA = 20-30 clients | 1 CA = 100+ clients |

---

## Product Features

### 1. Client Management System

**User Story:** As an accountant, I want to manage all my clients in one place so I can track their status and compliance deadlines.

**Functional Requirements:**
- ✅ Create client profile (business name, PAN, GSTIN, business type)
- ✅ Edit client details with audit trail
- ✅ Delete clients with confirmation (soft delete)
- ✅ View client list with search/filter (active, kyc_pending, inactive)
- ✅ Track KYC completion status per client
- ✅ Automated status transitions (kyc_pending → active after document verification)

**Technical Implementation:**
- Database: `clients` table with Row-Level Security (RLS)
- UI: `ClientManagement.tsx`, `AddClient.tsx`, `EditClient.tsx`
- Validation: PAN format (10 chars), GSTIN format (15 chars), email validation

---

### 2. WhatsApp Business Integration

**User Story:** As an accountant, I want clients to send documents via WhatsApp because they already use it daily.

**Functional Requirements:**
- ✅ Persistent WhatsApp session management (survives server restarts)
- ✅ State machine workflow: idle → awaiting_document → processing → confirmation
- ✅ Automated KYC document requests based on business type
- ✅ Document classification (PAN, Aadhaar, GSTIN, invoice, receipt, etc.)
- ✅ Payment reminder automation for overdue invoices
- ✅ Rate limiting (20 messages/hour per phone number) to prevent spam
- ✅ Message logging and analytics

**Business Logic:**
```
Client sends message →
  ├─ If first time: Create client profile, initiate KYC flow
  ├─ If document received: Auto-classify and process with OCR
  ├─ If payment query: Show pending invoices
  └─ If rate limit exceeded: Polite rate limit message
```

**Technical Implementation:**
- Edge Function: `whatsapp-webhook` (POST handler)
- Database Tables: `whatsapp_sessions`, `whatsapp_messages`, `client_kyc_checklists`
- External API: WhatsApp Business API with webhook verification
- Security: Phone number normalization (+91), rate limiting per user

**KYC Workflow Example (Private Limited Company):**
1. Client: "Hi, I'm XYZ Company"
2. Bot: "Welcome! I need the following documents:
   - Certificate of Incorporation
   - PAN Card (Company)
   - GSTIN Certificate
   - Bank Account Proof
   - Director KYC (PAN + Aadhaar)"
3. Client: [Sends photo of incorporation certificate]
4. Bot: "✅ Incorporation certificate received. Still pending: PAN, GSTIN, Bank Proof, Director KYC"
5. [Repeat until all documents received]
6. Bot: "🎉 KYC complete! You can now upload invoices and expenses."

---

### 3. Multi-Layer OCR Processing

**User Story:** As an accountant, I want documents automatically converted to structured data so I don't have to manually type them.

**Functional Requirements:**
- ✅ Support for PDF, JPG, PNG, HEIC formats
- ✅ Multi-engine OCR processing for maximum accuracy:
  1. Google Gemini 1.5 Flash (primary)
  2. DeepSeek Vision OCR (secondary)
  3. Google Cloud Vision API (tertiary)
  4. Tesseract.js (fallback)
- ✅ Confidence scoring per field (low/medium/high)
- ✅ Manual review queue for low-confidence extractions
- ✅ Document type classification (invoice, receipt, PAN, Aadhaar, etc.)
- ✅ Field extraction with validation:
  - Invoice: vendor, amount, GST%, GSTIN, invoice number, date, HSN codes
  - PAN Card: name, PAN number, date of birth
  - Aadhaar: name, Aadhaar number, address
  - Bank Statement: transactions with date, amount, description

**Technical Implementation:**
- Edge Function: `ocr-secure`, `extract-invoice`
- Processing Pipeline:
  1. Upload to Supabase Storage (with signed URL for 1 hour)
  2. Pre-processing (image enhancement, deskew)
  3. Parallel OCR calls to all engines
  4. Aggregate results with weighted scoring
  5. Validate extracted fields (GST format, PAN format, etc.)
  6. Store in `documents` table with confidence score
  7. If confidence < 80%, add to review queue

**OCR Accuracy Targets:**
- Invoices: 95%+ field accuracy
- PAN/Aadhaar: 98%+ accuracy (structured documents)
- Handwritten receipts: 75%+ accuracy (human review required)

---

### 4. Automated Financial Statements

**User Story:** As an accountant, I want to generate balance sheets and P&L statements with one click so I can save 4-5 hours per month per client.

**Functional Requirements:**
- ✅ Balance Sheet generation (Assets, Liabilities, Equity)
- ✅ Profit & Loss Statement (Revenue, Expenses, Net Profit/Loss)
- ✅ Cash Flow Statement (Operating, Investing, Financing)
- ✅ Trial Balance with double-entry validation
- ✅ Financial year alignment (April 1 - March 31 for India)
- ✅ Period comparison (current month vs previous month, current year vs previous year)
- ✅ Export to PDF/Excel for sharing with clients

**Calculations:**
```javascript
// Balance Sheet
Total Assets = Current Assets + Fixed Assets + Other Assets
Total Liabilities = Current Liabilities + Long-term Liabilities
Equity = Share Capital + Retained Earnings + Current Year Profit/Loss
Balance Check: Assets = Liabilities + Equity

// P&L Statement
Total Income = Sales + Other Income
Total Expenses = Direct Expenses + Indirect Expenses
Net Profit/Loss = Total Income - Total Expenses

// Cash Flow
Operating Cash Flow = Net Profit + Non-cash Expenses - Working Capital Changes
Investing Cash Flow = Asset Purchases - Asset Sales
Financing Cash Flow = Equity Raised + Loans Taken - Loan Repayments
```

**Technical Implementation:**
- Library: `lib/financialStatements.ts` with calculation functions
- UI Components: `BalanceSheet.tsx`, `ProfitLoss.tsx`, `TrialBalance.tsx`
- Database: `financial_records` table with double-entry tracking
- Validation: Automated balance validation (Assets = Liabilities + Equity)

---

### 5. GST Compliance Reports

**User Story:** As an accountant, I want to generate GSTR-1 and GSTR-3B reports from invoices so I can file GST returns in 15 minutes instead of 5 hours.

**Functional Requirements:**
- ✅ GSTR-1 generation (outward supplies):
  - B2B invoices (with GSTIN)
  - B2C invoices (without GSTIN)
  - HSN-wise summary
  - Document summary (invoices, credit notes, debit notes)
- ✅ GSTR-3B generation (summary return):
  - Outward taxable supplies (sales)
  - Inward supplies (input tax credit eligible)
  - ITC reversal calculations
  - Net GST payable (output tax - input tax)
- ✅ Auto-calculation of CGST, SGST, IGST based on invoice data
- ✅ HSN code validation (6-8 digit format)
- ✅ GSTIN validation (15-character format, checksum validation)
- ✅ Monthly/Quarterly filing period selection
- ✅ Export to JSON (for uploading to GST portal)

**GST Calculation Logic:**
```javascript
// Intra-state supply (within same state)
CGST = (Taxable Amount × GST Rate) / 2
SGST = (Taxable Amount × GST Rate) / 2
IGST = 0

// Inter-state supply (between different states)
CGST = 0
SGST = 0
IGST = Taxable Amount × GST Rate

// Net GST Payable (GSTR-3B)
Total Output Tax = CGST (sales) + SGST (sales) + IGST (sales)
Total Input Tax Credit = CGST (purchases) + SGST (purchases) + IGST (purchases)
Net GST Payable = Total Output Tax - Total Input Tax Credit
```

**Technical Implementation:**
- Library: `lib/gstCalculations.ts`
- UI Components: `GSTR1.tsx`, `GSTR3B.tsx`
- Database: `invoices` table with GST breakup columns
- API Integration: GST validation API (optional, for GSTIN verification)

---

### 6. Vendor Master with Fuzzy Matching

**User Story:** As an accountant, I want vendor names to be automatically normalized so "Reliance Industries" and "Reliance Ind Ltd" are treated as the same vendor.

**Functional Requirements:**
- ✅ Vendor database with primary name and aliases
- ✅ Fuzzy matching algorithm (Levenshtein distance)
- ✅ Auto-merge suggestions for similar vendor names
- ✅ Manual vendor linking interface
- ✅ Vendor-wise expense summary reports

**Fuzzy Matching Algorithm:**
```javascript
Similarity Score = 1 - (Levenshtein Distance / Max String Length)
If Similarity > 85%: Auto-suggest merge
If Similarity > 95%: Auto-merge (with notification)

Examples:
"Reliance Industries Ltd" vs "Reliance Industries Limited" → 92% match → Suggest merge
"Amazon Web Services" vs "AWS India" → 45% match → No suggestion
```

**Technical Implementation:**
- Database: `vendors` table with `aliases` JSONB column
- Algorithm: Levenshtein distance (PostgreSQL `pg_trgm` extension)
- UI: `VendorManagement.tsx` with merge interface

---

### 7. Review Queue System

**User Story:** As an accountant, I want to review low-confidence OCR extractions before they're finalized so I can ensure 100% accuracy.

**Functional Requirements:**
- ✅ Auto-populate review queue for documents with confidence < 80%
- ✅ Side-by-side view: Original document image + Extracted data
- ✅ Inline editing of extracted fields
- ✅ Approve/Reject workflow
- ✅ Bulk approval for high-confidence batches
- ✅ Priority sorting (urgent invoices first)

**Review Queue Logic:**
```
Document processed →
  ├─ If confidence ≥ 80%: Auto-approve, add to financial records
  ├─ If confidence < 80%: Add to review queue
  └─ If confidence < 50%: Flag as "needs manual entry"

Accountant reviews →
  ├─ If approved: Move to financial records, update vendor master
  ├─ If edited: Save corrections, retrain OCR model (future)
  └─ If rejected: Mark for re-processing or manual entry
```

**Technical Implementation:**
- Database: `documents` table with `review_status` column (pending/approved/rejected)
- UI: `ReviewQueue.tsx` with PDF viewer and form editor
- Library: PDFjs for rendering original document

---

### 8. Dashboard Analytics

**User Story:** As an accountant, I want to see my practice metrics at a glance so I can track growth and identify bottlenecks.

**Functional Requirements:**
- ✅ Real-time metrics:
  - Total clients (active, kyc_pending, inactive)
  - Documents processed (this month, all time)
  - Pending reviews (priority count)
  - Revenue by client (top 10 clients)
- ✅ Visual charts:
  - Monthly document processing trend
  - Revenue trend (last 12 months)
  - Document type distribution (invoices, receipts, KYC, etc.)
  - OCR confidence distribution
- ✅ Recent activity feed (last 20 actions)
- ✅ Quick actions (Add client, Upload document, View review queue)

**Technical Implementation:**
- UI: `Dashboard.tsx` with Recharts visualizations
- Data Fetching: TanStack Query with real-time subscriptions
- Database Views: Materialized views for performance (optional)

---

### 9. Email Integration

**User Story:** As an accountant, I want to receive documents via email in addition to WhatsApp so clients can use their preferred channel.

**Functional Requirements:**
- ✅ Email account configuration (Gmail, Outlook, custom SMTP)
- ✅ IMAP-based email polling (every 5 minutes)
- ✅ Attachment extraction (PDF, JPG, PNG, XLSX)
- ✅ Auto-parsing of sender email to identify client
- ✅ Subject line parsing for document type hints
- ✅ Priority classification (high/normal/low based on sender)
- ✅ Email-to-document linking in database

**Email Processing Flow:**
```
Email received →
  ├─ Extract sender email
  ├─ Match to client (by email in `clients` table)
  ├─ Extract attachments
  ├─ For each attachment:
  │   ├─ Upload to Supabase Storage
  │   ├─ Trigger OCR processing
  │   └─ Notify accountant (push notification)
  └─ Mark email as processed
```

**Technical Implementation:**
- Edge Function: `email-webhook` (triggered by cron or webhook)
- Library: `imap` (Node.js) for email fetching
- Configuration UI: `EmailSettings.tsx` for accountants

---

### 10. Client Portal (Limited Access)

**User Story:** As a client, I want to see my financial statements and upload documents without needing to contact my accountant every time.

**Functional Requirements:**
- ✅ View-only access to own financial statements
- ✅ Document upload interface (drag-and-drop)
- ✅ Track GST filing deadlines
- ✅ View outstanding invoices (receivables/payables)
- ✅ Download monthly reports (PDF)
- ⏳ Payment history (if integrated with Razorpay)

**Access Control:**
- Clients can ONLY view their own data (enforced via RLS)
- Clients CANNOT edit financial records
- Clients CAN upload documents and send messages

**Technical Implementation:**
- UI: `ClientDashboard.tsx` with restricted navigation
- Database: RLS policies filtering by `client_id` or `accountant_id`
- Authentication: Separate login for clients vs accountants

---

## User Roles & Permissions

### 1. Admin
**Permissions:**
- Full system access
- Manage all accountants and clients
- View system-wide analytics
- Configure platform settings (OCR engines, integrations)
- User role assignment

**Use Cases:**
- Platform owner/operator
- Quality assurance and monitoring
- Customer support escalations

---

### 2. Accountant
**Permissions:**
- Manage own clients (CRUD)
- Upload and process documents for own clients
- Generate financial statements and GST reports
- Configure WhatsApp and email integrations
- Review OCR extractions
- View own practice analytics

**Use Cases:**
- Chartered Accountants
- Tax consultants
- Accounting firm staff

**Data Isolation:**
- Row-Level Security (RLS) ensures Accountant A cannot see Accountant B's clients
- Enforced at database level (PostgreSQL policies)

---

### 3. Client
**Permissions:**
- View own financial statements (read-only)
- Upload documents via web/WhatsApp/email
- Track own GST compliance deadlines
- View own invoices and payment history
- Send messages to assigned accountant

**Use Cases:**
- Business owners
- Finance managers at client companies

**Data Isolation:**
- Clients can ONLY access data for their own `client_id`
- Enforced via RLS policies

---

## Technical Architecture

### Frontend Stack
- **Framework:** React 18 + TypeScript (Vite bundler for fast HMR)
- **UI Library:** shadcn/ui + Radix UI primitives (accessible, customizable)
- **Styling:** Tailwind CSS (utility-first, responsive)
- **State Management:** TanStack Query v5 (server state) + React Context (client state)
- **Routing:** React Router v6 (declarative routing)
- **Forms:** React Hook Form + Zod validation (type-safe)
- **Charts:** Recharts (declarative, responsive charts)
- **PDF Handling:** PDFjs (client-side rendering)
- **Icons:** Lucide React (tree-shakable, consistent)

### Backend Stack
- **Database:** Supabase (PostgreSQL 15)
  - Row-Level Security (RLS) for data isolation
  - Real-time subscriptions for live updates
  - Full-text search capabilities
- **Authentication:** Supabase Auth (JWT-based)
  - Email/password login
  - Magic link support (optional)
  - Role-based access control (RBAC)
- **Storage:** Supabase Storage
  - Bucket-level security policies
  - Signed URLs with expiration (1 hour default)
  - Automatic cleanup of temporary files
- **Serverless Functions:** Supabase Edge Functions (Deno runtime)
  - TypeScript-based
  - Global edge deployment
  - Zero cold starts for frequently used functions

### AI/ML Stack
1. **Google Gemini 1.5 Flash**
   - Use Case: Primary OCR and document understanding
   - Accuracy: 95-98% on business documents
   - Speed: 2-3 seconds per document
   - Cost: $0.00125 per request (average)

2. **DeepSeek Vision OCR**
   - Use Case: Secondary OCR, cost-effective alternative
   - Accuracy: 92-95% on invoices
   - Speed: 1-2 seconds per document
   - Cost: $0.0008 per request

3. **Google Cloud Vision API**
   - Use Case: Tertiary OCR, specialized for printed text
   - Accuracy: 98%+ on printed documents
   - Speed: 1-2 seconds
   - Cost: $1.50 per 1000 requests

4. **Tesseract.js**
   - Use Case: Fallback for offline/privacy-sensitive documents
   - Accuracy: 80-85% (lower but free)
   - Speed: 5-7 seconds (client-side processing)
   - Cost: Free (open-source)

### Integration APIs
- **WhatsApp Business API**
  - Vendor: Meta (formerly Facebook)
  - Pricing: ₹0.40 per conversation (24-hour window)
  - Rate Limits: Custom (application-level: 20 messages/hour per user)
  - Webhook: POST endpoint for receiving messages

- **Email (SMTP/IMAP)**
  - Supports: Gmail, Outlook, custom SMTP
  - Polling Frequency: Every 5 minutes (configurable)
  - Attachment Size Limit: 25 MB per email

- **Payment Gateway (Upcoming)**
  - Provider: Razorpay
  - Features: Invoice payments, payment links, reminders
  - Integration: Webhook for payment status updates

### Security Architecture

**Data Encryption:**
- In Transit: HTTPS/TLS 1.3 for all API calls
- At Rest: AES-256 encryption (Supabase default)
- Credentials: Encrypted environment variables (never in code)

**Access Control:**
- Row-Level Security (RLS) policies per user role
- JWT tokens with 1-hour expiration (refresh tokens for 30 days)
- API keys isolated to Edge Functions (never client-side)

**Rate Limiting:**
- WhatsApp: 20 messages/hour per phone number (spam prevention)
- API: 100 requests/minute per accountant (DDoS protection)
- OCR: 50 documents/hour per accountant (cost control)

**Audit Logging:**
- All WhatsApp messages logged in `whatsapp_messages` table
- Financial record changes tracked with `created_at` and `updated_at`
- User actions logged for compliance (optional, GDPR-compliant)

**Compliance:**
- GDPR: Right to erasure, data portability
- India Data Protection Law (upcoming): Data localization (Supabase Asia region)
- GST Act 2017: Document retention for 6 years (soft delete only)

---

## Database Schema (Core Tables)

### 1. `profiles`
User information with role mappings.

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key (Supabase Auth user ID) |
| email | TEXT | User email |
| full_name | TEXT | Display name |
| role | ENUM | admin / accountant / client |
| created_at | TIMESTAMP | Account creation date |

**RLS Policies:**
- Users can read their own profile
- Admins can read all profiles
- Accountants can read profiles of their clients

---

### 2. `clients`
Client business details with KYC status.

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| accountant_id | UUID | Foreign key to `profiles` (accountant) |
| business_name | TEXT | Legal business name |
| business_type | ENUM | proprietorship / partnership / llp / pvt_ltd / public_ltd |
| pan | VARCHAR(10) | PAN number (AAAAA9999A format) |
| gstin | VARCHAR(15) | GSTIN (15-character format) |
| phone | VARCHAR(15) | Phone number with country code (+91) |
| email | TEXT | Business email |
| kyc_status | ENUM | kyc_pending / active / inactive |
| created_at | TIMESTAMP | Client creation date |

**RLS Policies:**
- Accountants can CRUD their own clients
- Admins can read all clients
- Clients can read their own record

**Indexes:**
- `(accountant_id, kyc_status)` for filtering
- `(phone)` for WhatsApp lookups
- `(gstin)` for GST validation

---

### 3. `documents`
Uploaded files with processing status.

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| client_id | UUID | Foreign key to `clients` |
| accountant_id | UUID | Foreign key to `profiles` |
| file_name | TEXT | Original filename |
| file_url | TEXT | Supabase Storage URL |
| file_type | ENUM | pdf / jpg / png / heic |
| document_type | ENUM | invoice / receipt / pan / aadhaar / gstin / bank_statement / other |
| processing_status | ENUM | pending / processing / completed / failed |
| ocr_confidence | NUMERIC(5,2) | Confidence score (0-100) |
| review_status | ENUM | pending / approved / rejected |
| extracted_data | JSONB | OCR results (flexible schema) |
| uploaded_via | ENUM | web / whatsapp / email |
| created_at | TIMESTAMP | Upload timestamp |

**RLS Policies:**
- Accountants can CRUD documents for their clients
- Clients can read their own documents

**Indexes:**
- `(accountant_id, review_status)` for review queue
- `(client_id, document_type)` for client document list

---

### 4. `financial_records`
Double-entry transactions (income/expense/asset/liability).

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| client_id | UUID | Foreign key to `clients` |
| accountant_id | UUID | Foreign key to `profiles` |
| transaction_date | DATE | Date of transaction |
| description | TEXT | Transaction description |
| category | ENUM | income / expense / asset / liability / equity |
| debit_amount | NUMERIC(12,2) | Debit amount (for double-entry) |
| credit_amount | NUMERIC(12,2) | Credit amount (for double-entry) |
| tax_amount | NUMERIC(12,2) | GST amount (if applicable) |
| invoice_id | UUID | Foreign key to `invoices` (optional) |
| vendor_id | UUID | Foreign key to `vendors` (optional) |
| created_at | TIMESTAMP | Record creation |

**RLS Policies:**
- Accountants can CRUD records for their clients
- Clients can read their own records

**Constraints:**
- `CHECK (debit_amount + credit_amount > 0)` (at least one must be non-zero)
- `CHECK (debit_amount >= 0 AND credit_amount >= 0)` (no negative amounts)

---

### 5. `invoices`
Parsed invoice data with tax details.

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| client_id | UUID | Foreign key to `clients` |
| document_id | UUID | Foreign key to `documents` |
| invoice_number | VARCHAR(50) | Invoice number from OCR |
| invoice_date | DATE | Invoice date |
| vendor_name | TEXT | Vendor name (before normalization) |
| vendor_id | UUID | Foreign key to `vendors` (after matching) |
| vendor_gstin | VARCHAR(15) | Vendor GSTIN |
| total_amount | NUMERIC(12,2) | Total invoice amount |
| taxable_amount | NUMERIC(12,2) | Amount before GST |
| cgst | NUMERIC(12,2) | CGST amount |
| sgst | NUMERIC(12,2) | SGST amount |
| igst | NUMERIC(12,2) | IGST amount |
| gst_rate | NUMERIC(5,2) | GST rate (5, 12, 18, 28) |
| hsn_code | VARCHAR(8) | HSN code (6-8 digits) |
| invoice_type | ENUM | sales / purchase |
| created_at | TIMESTAMP | OCR timestamp |

**RLS Policies:**
- Accountants can CRUD invoices for their clients
- Clients can read their own invoices

**Indexes:**
- `(client_id, invoice_type, invoice_date)` for GST reports
- `(vendor_gstin)` for GSTR-2A matching

---

### 6. `vendors`
Normalized vendor master with fuzzy matching.

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| accountant_id | UUID | Foreign key to `profiles` |
| vendor_name | TEXT | Primary vendor name |
| aliases | JSONB | Array of alternate names |
| gstin | VARCHAR(15) | Vendor GSTIN (if registered) |
| pan | VARCHAR(10) | Vendor PAN |
| phone | VARCHAR(15) | Vendor phone |
| email | TEXT | Vendor email |
| created_at | TIMESTAMP | First appearance |

**RLS Policies:**
- Accountants can CRUD their own vendors
- Vendors are shared across clients of same accountant

**Fuzzy Matching:**
- Uses PostgreSQL `pg_trgm` extension for similarity matching
- Query: `SELECT * FROM vendors WHERE similarity(vendor_name, ?) > 0.85`

---

### 7. WhatsApp Tables

#### `whatsapp_sessions`
User conversation state tracking.

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| phone_number | VARCHAR(15) | WhatsApp phone number (+91...) |
| client_id | UUID | Foreign key to `clients` (if matched) |
| state | ENUM | idle / awaiting_document / processing / awaiting_confirmation |
| context | JSONB | State-specific data (expected_doc_type, etc.) |
| last_activity | TIMESTAMP | Last message timestamp |
| created_at | TIMESTAMP | Session start |

#### `whatsapp_messages`
Complete message audit log.

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| session_id | UUID | Foreign key to `whatsapp_sessions` |
| message_id | TEXT | WhatsApp message ID (for deduplication) |
| direction | ENUM | inbound / outbound |
| message_type | ENUM | text / image / document / audio / video |
| content | TEXT | Message text |
| media_url | TEXT | Media URL (if applicable) |
| created_at | TIMESTAMP | Message timestamp |

#### `client_kyc_checklists`
Per-client document tracking.

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| client_id | UUID | Foreign key to `clients` |
| document_type | TEXT | pan / aadhaar / gstin / incorporation_cert / bank_proof |
| status | ENUM | pending / received / verified |
| document_id | UUID | Foreign key to `documents` (if uploaded) |
| created_at | TIMESTAMP | Checklist creation |
| updated_at | TIMESTAMP | Last status change |

---

## User Journeys

### Journey 1: Accountant Onboards New Client via WhatsApp

**Steps:**
1. Client sends WhatsApp message: "Hi, I need accounting services"
2. Bot: "Welcome to [Accountant Name]'s practice! What's your business name?"
3. Client: "ABC Traders"
4. Bot: "Great! Is ABC Traders a: 1) Proprietorship, 2) Partnership, 3) LLP, 4) Private Limited?"
5. Client: "1"
6. Bot: "I need the following documents:
   - PAN Card (Business)
   - GSTIN Certificate
   - Bank Account Proof"
7. Client: [Sends photo of PAN card]
8. Bot: "✅ PAN card received (Confidence: 95%). Detected PAN: ABCDE1234F. Is this correct?"
9. Client: "Yes"
10. Bot: "Perfect! Still pending: GSTIN, Bank Proof"
11. Client: [Sends GSTIN certificate]
12. Bot: "✅ GSTIN received. Validating..."
13. Bot: "✅ GSTIN validated: 27ABCDE1234F1Z5"
14. Client: [Sends bank statement]
15. Bot: "✅ Bank proof received. KYC complete! 🎉 You can now send invoices and receipts anytime."

**Backend Flow:**
- New session created in `whatsapp_sessions` (state: idle)
- Client profile created in `clients` (kyc_status: kyc_pending)
- KYC checklist created in `client_kyc_checklists`
- Each document uploaded to `documents` table
- OCR processing triggered for each document
- Upon completion, client status updated to "active"
- Accountant receives notification: "New client ABC Traders onboarded"

**Time Saved:** 30 minutes → 5 minutes

---

### Journey 2: Client Uploads Invoice via WhatsApp

**Steps:**
1. Client: [Sends photo of purchase invoice from Reliance Industries]
2. Bot: "Invoice received! Processing..."
3. [Backend: OCR extracts fields]
4. Bot: "Invoice details:
   - Vendor: Reliance Industries Ltd
   - Amount: ₹50,000
   - GST (18%): ₹9,000
   - Total: ₹59,000
   - Date: 2025-01-15

   Is this correct?"
5. Client: "Yes"
6. Bot: "Invoice saved! I've notified your accountant."

**Backend Flow:**
- Document uploaded to Supabase Storage
- OCR processing (Gemini 1.5 Flash)
- Vendor name matched to existing vendor (fuzzy matching)
- Invoice record created in `invoices` table
- Financial record created in `financial_records` (Debit: Expense ₹50,000, Credit: GST Input ₹9,000)
- If confidence < 80%, added to review queue for accountant

**Time Saved:** 10 minutes manual entry → 30 seconds automated

---

### Journey 3: Accountant Generates GST Reports

**Steps:**
1. Accountant logs into web app
2. Navigate to: Clients → ABC Traders → GST Reports
3. Select period: January 2025
4. Click "Generate GSTR-1"
5. [System auto-populates all sales invoices for January]
6. Preview:
   - B2B Invoices: 45 invoices, ₹12,50,000 taxable, ₹2,25,000 GST
   - B2C Invoices: 120 invoices, ₹3,20,000 taxable, ₹57,600 GST
   - HSN Summary: 15 HSN codes
7. Accountant reviews, clicks "Export JSON"
8. [Downloads JSON file formatted for GST portal upload]
9. Accountant uploads JSON to GST portal
10. Filing complete!

**Backend Flow:**
- Query `invoices` table: `WHERE client_id = ? AND invoice_type = 'sales' AND invoice_date BETWEEN ? AND ?`
- Group by GSTIN (B2B) vs NULL (B2C)
- Calculate tax summary per GST rate (5%, 12%, 18%, 28%)
- Generate HSN-wise summary
- Format output as per GSTR-1 JSON schema (version 1.1)
- Return JSON for download

**Time Saved:** 4-5 hours → 15 minutes

---

## Success Metrics (KPIs)

### Product Metrics

1. **User Acquisition**
   - **Target:** 100 accountants in first 3 months
   - **Measurement:** New accountant signups per week
   - **Success Criteria:** 10+ signups/week by Month 3

2. **User Activation**
   - **Target:** 80% of accountants onboard first client within 7 days
   - **Measurement:** % of accountants with ≥1 client after 7 days
   - **Success Criteria:** 80%+ activation rate

3. **User Engagement**
   - **Target:** Accountants process 50+ documents/month on average
   - **Measurement:** Median documents processed per accountant per month
   - **Success Criteria:** 50+ documents/accountant/month

4. **User Retention**
   - **Target:** 70% of accountants active after 30 days
   - **Measurement:** % of accountants who logged in ≥3 times in last 30 days
   - **Success Criteria:** 70%+ monthly active rate

5. **Revenue**
   - **Target:** ₹2,00,000 MRR by Month 6
   - **Measurement:** Total monthly recurring revenue
   - **Pricing:** ₹2,000/month for 1-10 clients, ₹5,000/month for 11-50 clients

### Technical Metrics

1. **OCR Accuracy**
   - **Target:** 95%+ field-level accuracy on invoices
   - **Measurement:** % of fields correctly extracted (measured via review queue corrections)
   - **Success Criteria:** 95%+ accuracy

2. **Processing Speed**
   - **Target:** <5 seconds from upload to OCR completion
   - **Measurement:** p95 latency for OCR processing
   - **Success Criteria:** <5 seconds p95

3. **System Uptime**
   - **Target:** 99.5% uptime
   - **Measurement:** % of time API is responding within 2 seconds
   - **Success Criteria:** 99.5%+ uptime

4. **WhatsApp Message Delivery**
   - **Target:** 99%+ message delivery rate
   - **Measurement:** % of outbound WhatsApp messages delivered
   - **Success Criteria:** 99%+ delivery

### Business Metrics

1. **Time Saved per Accountant**
   - **Target:** 30+ hours saved per month
   - **Measurement:** User surveys + calculation (documents × 10 min saved)
   - **Success Criteria:** 30+ hours/month reported

2. **Client Capacity Increase**
   - **Target:** Accountants can manage 3x more clients
   - **Measurement:** Average clients per accountant (before vs after)
   - **Success Criteria:** 3x increase in client capacity

3. **Customer Satisfaction (NPS)**
   - **Target:** NPS score of 50+
   - **Measurement:** Quarterly NPS survey
   - **Success Criteria:** NPS ≥50 (promoters - detractors)

---

## Pricing Strategy

### Tier 1: Starter (₹1,999/month)
**Target:** Individual CAs, new practitioners
- Up to 10 clients
- 200 documents/month
- WhatsApp integration (1 number)
- Email integration (1 account)
- All financial reports (Balance Sheet, P&L, GST)
- Email support

### Tier 2: Professional (₹4,999/month)
**Target:** Established CAs, small firms
- Up to 50 clients
- 1,000 documents/month
- WhatsApp integration (3 numbers)
- Email integration (unlimited)
- All Starter features +
- Custom KYC workflows
- Vendor master with fuzzy matching
- Priority email support

### Tier 3: Enterprise (₹9,999/month)
**Target:** Accounting firms, GST consultants
- Unlimited clients
- 5,000 documents/month
- WhatsApp integration (10 numbers)
- All Professional features +
- Multi-user access (3 accountants)
- API access for custom integrations
- Dedicated account manager
- Phone + email support

### Add-ons
- **Extra documents:** ₹10 per 100 documents (beyond plan limit)
- **Additional accountants:** ₹2,000/month per additional user
- **Custom OCR training:** ₹20,000 one-time (for specialized documents)

### Free Trial
- **Duration:** 14 days
- **Limits:** 5 clients, 50 documents
- **No credit card required**

**Annual Discount:** 20% off (₹19,190 vs ₹23,988 for Starter plan)

---

## Go-to-Market Strategy

### Phase 1: Private Beta (Month 1-2)
**Goal:** Validate product-market fit with 20 early adopters

**Tactics:**
1. **Direct Outreach:** Contact 50 CAs via LinkedIn (offer free lifetime Starter plan)
2. **Referral Program:** Each beta user refers 2 CAs (₹5,000 credit for successful referral)
3. **Case Studies:** Document time savings and ROI for 5 power users

**Success Metrics:**
- 20 beta users onboarded
- 80%+ user satisfaction (survey)
- 5 case studies published

---

### Phase 2: Public Launch (Month 3-4)
**Goal:** Acquire 100 paying customers

**Tactics:**
1. **Content Marketing:**
   - Blog posts: "How to reduce GST filing time by 90%"
   - YouTube tutorials: "Fintrex walkthrough for CAs"
   - WhatsApp automation guides
2. **Paid Ads:**
   - Google Ads: "accounting automation software India" (₹50,000 budget)
   - LinkedIn Ads: Targeting CAs in tier 1/2 cities (₹30,000 budget)
3. **Community Building:**
   - WhatsApp group for beta users (product feedback, networking)
   - Telegram channel for tips and updates
4. **Partnerships:**
   - Partner with CA coaching institutes (offer student discounts)
   - Integrate with Tally (export data from Fintrex to Tally)

**Success Metrics:**
- 100 paying customers by Month 4
- CAC (Customer Acquisition Cost) < ₹10,000
- Organic traffic: 5,000 visits/month to website

---

### Phase 3: Growth (Month 5-12)
**Goal:** Scale to 500 paying customers

**Tactics:**
1. **Account-Based Marketing:** Target top 100 CA firms in India
2. **Webinars:** Monthly webinars on GST compliance, automation (200+ attendees)
3. **SEO:** Rank #1 for "GST accounting software" and "WhatsApp accounting"
4. **Integrations:** Integrate with Zoho Books, QuickBooks (expand reach)
5. **Influencer Marketing:** Partner with CA YouTubers (50k+ subscribers)

**Success Metrics:**
- 500 paying customers by Month 12
- ₹10,00,000 MRR
- Churn rate <5%/month

---

## Roadmap

### Q1 2025 (Launch)
- ✅ WhatsApp integration (production-ready)
- ✅ Multi-layer OCR (Gemini, DeepSeek, Vision, Tesseract)
- ✅ Client management and KYC workflows
- ✅ Financial statements (Balance Sheet, P&L, Trial Balance)
- ✅ GST reports (GSTR-1, GSTR-3B)
- ✅ Review queue system
- ✅ Dashboard analytics
- ⏳ Public website and landing page
- ⏳ Payment integration (Razorpay)

### Q2 2025 (Scaling)
- ⏳ Email integration (SMTP/IMAP)
- ⏳ Mobile app (React Native for iOS/Android)
- ⏳ Vendor master with fuzzy matching
- ⏳ Bulk document upload (ZIP file support)
- ⏳ Client portal (limited access dashboard)
- ⏳ Multi-language support (Hindi, Tamil, Telugu)

### Q3 2025 (Advanced Features)
- ⏳ TDS compliance (Form 26Q, 27Q)
- ⏳ Income Tax return preparation (ITR-3, ITR-4)
- ⏳ Bank statement reconciliation (auto-match transactions)
- ⏳ E-invoicing integration (IRN generation)
- ⏳ Custom report builder (drag-and-drop)
- ⏳ API for third-party integrations

### Q4 2025 (Enterprise Features)
- ⏳ Multi-accountant support (team collaboration)
- ⏳ Audit trail and compliance reports
- ⏳ Custom OCR model training (accountant-specific documents)
- ⏳ White-label solution (for accounting firms)
- ⏳ AI-powered anomaly detection (fraud detection)

---

## Risk Assessment

### Technical Risks

1. **OCR Accuracy Below Expectations**
   - **Risk:** OCR confidence <90% leads to excessive manual review
   - **Mitigation:** Multi-layer OCR approach (4 engines), human-in-the-loop review
   - **Contingency:** Hire data labelers to improve training data

2. **WhatsApp API Rate Limiting**
   - **Risk:** Meta throttles messages during high usage
   - **Mitigation:** Application-level rate limiting (20/hour per user)
   - **Contingency:** Fallback to SMS or email for urgent messages

3. **Supabase Downtime**
   - **Risk:** Database/storage unavailable during critical filing periods
   - **Mitigation:** Use Supabase Enterprise plan (99.99% SLA)
   - **Contingency:** Implement backup database (AWS RDS snapshot)

### Business Risks

1. **Low User Adoption**
   - **Risk:** Accountants prefer manual processes, resist change
   - **Mitigation:** Free trial, onboarding support, case studies
   - **Contingency:** Pivot to B2B (sell to accounting firms, not individual CAs)

2. **Competition from Tally/Zoho**
   - **Risk:** Established players add WhatsApp/OCR features
   - **Mitigation:** Focus on superior UX, faster innovation cycles
   - **Contingency:** Offer integration with Tally/Zoho (become complementary tool)

3. **Regulatory Changes**
   - **Risk:** GST law changes require major product updates
   - **Mitigation:** Stay updated via CA community, quarterly product reviews
   - **Contingency:** Budget 10% dev time for compliance updates

### Operational Risks

1. **Customer Support Overload**
   - **Risk:** High support requests during GST filing deadlines (10th, 20th of month)
   - **Mitigation:** Self-service knowledge base, chatbot for FAQs
   - **Contingency:** Hire part-time support staff during peak periods

2. **Data Security Breach**
   - **Risk:** Unauthorized access to client financial data
   - **Mitigation:** SOC 2 Type II compliance, RLS policies, encryption at rest/in transit
   - **Contingency:** Cyber insurance (₹50 lakh coverage), incident response plan

---

## Success Criteria

### Launch Success (Month 3)
- ✅ 100 accountants signed up
- ✅ 1,000 clients onboarded via WhatsApp
- ✅ 10,000 documents processed
- ✅ 95%+ OCR accuracy
- ✅ NPS score ≥40

### Product-Market Fit (Month 6)
- ✅ 300 paying accountants
- ✅ 70%+ monthly retention rate
- ✅ ₹6,00,000 MRR
- ✅ 30+ hours saved per accountant per month (validated)
- ✅ NPS score ≥50

### Scale (Month 12)
- ✅ 500 paying accountants
- ✅ 5,000 active clients
- ✅ 100,000 documents processed
- ✅ ₹10,00,000 MRR
- ✅ <5% monthly churn
- ✅ Profitability (revenue > costs)

---

## Appendix

### Glossary

- **CA:** Chartered Accountant (licensed accounting professional in India)
- **GST:** Goods and Services Tax (India's VAT system, launched 2017)
- **GSTR-1:** Monthly/Quarterly return for outward supplies (sales)
- **GSTR-3B:** Monthly summary return with tax liability calculation
- **GSTIN:** 15-character GST Identification Number (format: STATEPAN0000Z0)
- **PAN:** Permanent Account Number (10-character tax ID)
- **HSN:** Harmonized System of Nomenclature (product classification for GST)
- **ITC:** Input Tax Credit (GST paid on purchases, deductible from output tax)
- **OCR:** Optical Character Recognition (text extraction from images)
- **RLS:** Row-Level Security (database-level access control)
- **Fuzzy Matching:** Algorithm for finding similar text strings (e.g., vendor names)

### References

- GST Act 2017: https://www.gst.gov.in/
- WhatsApp Business API: https://developers.facebook.com/docs/whatsapp
- Google Gemini API: https://ai.google.dev/gemini-api/docs
- Supabase Documentation: https://supabase.com/docs
- Indian Accounting Standards: https://www.mca.gov.in/

---

**Document Version:** 1.0
**Last Updated:** 2025-11-20
**Owner:** Product Team
**Review Frequency:** Monthly (or after major releases)
