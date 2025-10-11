# Fintrex - Automated Accounting Platform

## 🚀 Overview

Fintrex is an AI-powered accounting automation platform designed for Indian accountants. It streamlines client onboarding, KYC verification, and financial document management through WhatsApp and email integration. The platform uses OCR and LLM technology to automatically extract, process, and organize financial data into balance sheets and financial statements.

## ✨ Key Features

### For Accountants
- **Client Management**: Complete client portfolio management system
- **Document Processing**: Automated OCR and data extraction using Gemini AI
- **Financial Statements**: Auto-generated Balance Sheets, P&L, and Cash Flow statements
- **GST Compliance**: GSTR-1 and GSTR-3B report generation
- **WhatsApp Integration**: Document collection via WhatsApp Business API
- **Email Integration**: Automated email parsing and attachment processing
- **Dashboard Analytics**: Real-time insights and performance metrics

### For Clients
- **Simple Document Upload**: Submit documents via WhatsApp, Email, or Web
- **Real-time Financial Overview**: View balance sheets and financial status
- **Compliance Tracking**: GST filing reminders and deadlines
- **Invoice Tracking**: Monitor receivables and payables

### For Admins
- **Platform Monitoring**: System health and usage analytics
- **Accountant Management**: Onboard and manage accountants
- **Quality Assurance**: OCR accuracy monitoring and error tracking

## 🏗️ Tech Stack

### Frontend
- **Framework**: React 18 + TypeScript
- **Build Tool**: Vite
- **UI Components**: shadcn/ui + Radix UI
- **Styling**: Tailwind CSS
- **State Management**: TanStack Query
- **Routing**: React Router v6
- **Charts**: Recharts

### Backend
- **Database**: Supabase (PostgreSQL)
- **Authentication**: Supabase Auth (JWT)
- **Storage**: Supabase Storage
- **Real-time**: Supabase Realtime

### AI/ML
- **OCR**: Google Gemini Vision API
- **LLM**: Google Gemini 1.5 Flash
- **Document Classification**: AI-powered categorization
- **Data Extraction**: Structured field extraction

### Integrations
- **WhatsApp**: WhatsApp Business API (via proxy)
- **Email**: SMTP/IMAP (via backend service)
- **Payment**: Razorpay (planned)

## 📦 Installation

### Prerequisites
- Node.js 18+ or Bun
- Supabase account
- Gemini API key (optional, for AI features)

### Setup Steps

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd appy-maker-main
   ```

2. **Install dependencies**
   ```bash
   npm install
   # or
   bun install
   ```

3. **Configure environment variables**
   
   Create a `.env` file in the root directory:
   ```env
   # Supabase Configuration
   VITE_SUPABASE_URL=your_supabase_url
   VITE_SUPABASE_PUBLISHABLE_KEY=your_supabase_anon_key
   VITE_SUPABASE_PROJECT_ID=your_project_id

   # AI Configuration (Optional)
   VITE_GEMINI_API_KEY=your_gemini_api_key

   # Backend Services (Optional)
   VITE_BACKEND_URL=your_backend_url
   VITE_WHATSAPP_PROXY_URL=your_whatsapp_proxy_url
   ```

4. **Setup Supabase Database**
   
   Run the migrations in the `supabase` folder to create the required tables:
   - `profiles` - User profiles
   - `user_roles` - Role-based access control
   - `clients` - Client information
   - `documents` - Document metadata
   - `financial_records` - Financial transactions
   - `invoices` - Invoice data

5. **Start development server**
   ```bash
   npm run dev
   # or
   bun dev
   ```

   The app will be available at `http://localhost:8080`

## 🗂️ Project Structure

```
src/
├── components/        # Reusable UI components
│   ├── ui/           # shadcn/ui components
│   ├── BalanceSheet.tsx
│   ├── ProfitLossStatement.tsx
│   ├── DashboardLayout.tsx
│   ├── KYCPanel.tsx
│   └── ...
├── pages/            # Route pages
│   ├── Auth.tsx      # Authentication
│   ├── Dashboard.tsx # Main dashboard
│   ├── Clients.tsx   # Client management
│   ├── Documents.tsx # Document processing
│   ├── Invoices.tsx  # Invoice management
│   ├── Financials.tsx # Financial statements
│   ├── GSTReports.tsx # GST reporting
│   ├── Admin.tsx     # Admin panel
│   └── ClientDashboard.tsx # Client view
├── lib/              # Utility libraries
│   ├── backend.ts    # Backend API calls
│   ├── financial.ts  # Financial calculations
│   ├── whatsapp.ts   # WhatsApp integration
│   ├── ocr-enhanced.ts # OCR processing
│   ├── email-service.ts # Email integration
│   ├── processing.ts # Document processing
│   └── utils.ts      # General utilities
├── integrations/     # Third-party integrations
│   └── supabase/     # Supabase client & types
├── hooks/            # Custom React hooks
└── App.tsx           # Main app component
```

## 🔐 Authentication & Roles

The platform supports three user roles:

1. **Admin** (`admin`)
   - Platform-wide access
   - Accountant management
   - System monitoring

2. **Accountant** (`accountant`)
   - Default role for new sign-ups
   - Client management
   - Document processing
   - Financial reporting

3. **Client** (`client`)
   - View-only access to own data
   - Document upload
   - Financial statements

## 🧪 Testing

### Running Tests
```bash
npm run lint
```

### Manual Testing
1. Create an account and sign in
2. Add a test client
3. Upload sample documents (invoices, receipts)
4. Process documents and view extracted data
5. Generate financial statements

## 🚀 Deployment

### Build for Production
```bash
npm run build
```

The built files will be in the `dist/` directory.

### Deployment Options
- **Vercel**: Zero-config deployment
- **Netlify**: Automatic deployments from Git
- **AWS S3 + CloudFront**: Static hosting
- **Docker**: Containerized deployment

## 📚 API Documentation

### Document Processing
```typescript
import { processDocumentComplete } from '@/lib/ocr-enhanced';

// Process a document file
const result = await processDocumentComplete(file);
console.log(result.fields); // Extracted data
console.log(result.classification); // Document type
```

### WhatsApp Integration
```typescript
import { sendTemplate } from '@/lib/whatsapp';

// Send KYC request via WhatsApp
await sendTemplate(
  '+919876543210',
  'kyc_request',
  { client_name: 'John Doe', firm_name: 'ABC Accountants' }
);
```

### Financial Calculations
```typescript
import { generateBalanceSheet, formatINR } from '@/lib/financial';

// Generate balance sheet
const balanceSheet = generateBalanceSheet(records, new Date());
const totalAssets = calculateTotal(balanceSheet.assets);
console.log(formatINR(totalAssets)); // ₹1,234,567.00
```

## 🤝 Contributing

Contributions are welcome! Please follow these steps:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📝 License

This project is private and proprietary.

## 🙏 Acknowledgments

- **shadcn/ui** for the beautiful UI components
- **Supabase** for the backend infrastructure
- **Google Gemini** for AI-powered document processing
- **Radix UI** for accessible component primitives

## 📧 Support

For support, email support@fintrex.in or join our Slack channel.

## 🗺️ Roadmap

### Phase 1 (Current)
- ✅ Basic authentication and user management
- ✅ Client management system
- ✅ Document upload and storage
- ✅ OCR and data extraction
- ✅ Financial statements generation
- ✅ GST report generation

### Phase 2 (Q2 2025)
- ⏳ WhatsApp Business API integration
- ⏳ Email automation
- ⏳ Bank statement reconciliation
- ⏳ Mobile app (React Native)
- ⏳ Advanced AI features

### Phase 3 (Q3 2025)
- 📋 E-invoice generation
- 📋 ITR filing integration
- 📋 Payment gateway integration
- 📋 Multi-language support
- 📋 API for third-party integrations

### Phase 4 (Q4 2025)
- 📋 International expansion
- 📋 Tally integration
- 📋 Advanced analytics & insights
- 📋 Collaborative features

## 💡 Tips & Best Practices

### Performance
- Use React Query for efficient data fetching and caching
- Optimize images and documents before upload
- Implement pagination for large datasets

### Security
- Never store API keys in frontend code
- Use environment variables for sensitive data
- Implement proper Row Level Security (RLS) in Supabase
- Validate all user inputs on both client and server

### UX
- Provide clear feedback for all user actions
- Implement proper loading states
- Handle errors gracefully with user-friendly messages
- Use optimistic updates for better perceived performance

---

**Built with ❤️ for Indian Accountants**

# Fintrex – Automated Accounting Platform (MVP)

Fintrex is an AI-assisted accounting app that streamlines client onboarding (KYC), document collection, OCR/LLM extraction, and automated financial statements. This MVP implements the PRD’s core flows using Supabase and a React (Vite) frontend.

## Stack

- Vite + React + TypeScript
- Tailwind CSS + shadcn/ui
- Supabase (Auth, Database, Storage, RLS)
- Recharts (analytics)

## Setup

1) Prereqs: Node 18+ and npm

2) Environment: fill `.env`

```
VITE_SUPABASE_URL=... 
VITE_SUPABASE_PUBLISHABLE_KEY=...
VITE_SUPABASE_PROJECT_ID=...
```

3) Supabase migration

- Apply SQL in `supabase/migrations/*.sql` to create tables, RLS, and the Storage bucket `documents`.
- Ensure the Storage bucket named `documents` exists.

4) Install & run

```
npm ci
npm run dev
```

## App Structure (key routes)

- `/auth` – Email/password sign-in/up (Supabase)
- `/` – Accountant dashboard
- `/clients` – Client list, add client, KYC actions (send WhatsApp template, mark KYC complete)
- `/documents` – Upload to Storage, simulate OCR/LLM processing, create financial records
- `/financials` – Balance Sheet and P&L from `financial_records`
- `/admin` – Admin dashboard (visible if user has `admin` role)
- `/client-dashboard?clientId=...` – Client-specific overview (charts, documents, records)

## Roles & Access

- Default signup assigns `accountant` role (trigger in migration).
- To test Admin dashboard, insert an `admin` role for your user in `public.user_roles` using Supabase SQL editor.

## Core Flows (PRD-aligned)

- **KYC & Onboarding**: Add client → Send KYC via WhatsApp (simulated) → Mark KYC complete.
- **Document Processing**: Upload PDF/JPG/PNG → Set status → Simulate OCR/LLM → Save `extracted_data` → Insert `financial_records` → Update client counters.
- **Financials**: Balance Sheet and P&L aggregate from `financial_records` (income/expense/asset/liability).
- **Admin**: Platform metrics (clients, documents, financial records, approx. accountants) and recent activity.

## WhatsApp & OCR/LLM (Simulated)

- `src/lib/whatsapp.ts` – stub `sendTemplate()` for WhatsApp Business Cloud API integration.
- `src/lib/processing.ts` – stub `simulateProcessing()` that returns structured invoice-like JSON and a suggested financial record.

Replace these with real providers (Meta Cloud API, AWS Textract/Google Vision + an LLM) when ready.

## Notes & Next Steps

- Add OTP login for Client role and a dedicated Client portal view.
- Add exports (PDF/Excel), advanced analytics, and compliance reports.
- Integrate real WhatsApp provider and OCR/LLM backends.

## Scripts

- `npm run dev` – Start dev server
- `npm run build` – Production build
- `npm run preview` – Preview production build
