// Email Integration Service
// Handles email parsing, attachment extraction, and document categorization

const BACKEND_URL = (import.meta as any).env?.VITE_BACKEND_URL as string | undefined;

export interface EmailMessage {
  id: string;
  from: string;
  to: string;
  subject: string;
  body: string;
  date: Date;
  attachments: EmailAttachment[];
}

export interface EmailAttachment {
  filename: string;
  contentType: string;
  size: number;
  data?: ArrayBuffer | Blob;
}

export interface ParsedEmail {
  clientPhone?: string;
  clientEmail?: string;
  documentType?: string;
  priority: 'high' | 'normal' | 'low';
  attachments: EmailAttachment[];
}

/**
 * Configure email account for document reception
 * In production, this would connect to SMTP/IMAP via backend
 */
export async function configureEmailAccount(config: {
  email: string;
  provider: 'gmail' | 'outlook' | 'custom';
  smtpSettings?: {
    host: string;
    port: number;
    secure: boolean;
  };
}): Promise<{ success: boolean; error?: string }> {
  if (!BACKEND_URL) {
    // Simulation mode
    console.log('[Email] Simulated email configuration:', config);
    return { success: true };
  }

  try {
    const response = await fetch(`${BACKEND_URL}/email/configure`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config),
    });

    if (!response.ok) {
      const error = await response.text();
      return { success: false, error };
    }

    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/**
 * Fetch new emails from configured account
 */
export async function fetchNewEmails(accountantId: string): Promise<EmailMessage[]> {
  if (!BACKEND_URL) {
    // Return simulated emails in dev mode
    return getSimulatedEmails();
  }

  try {
    const response = await fetch(`${BACKEND_URL}/email/fetch?accountantId=${accountantId}`);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch emails: ${response.status}`);
    }

    const data = await response.json();
    return data.emails || [];
  } catch (error) {
    console.error('[Email] Failed to fetch emails:', error);
    return [];
  }
}

/**
 * Parse email to extract client information and document hints
 */
export function parseEmail(email: EmailMessage): ParsedEmail {
  const parsed: ParsedEmail = {
    priority: 'normal',
    attachments: email.attachments,
  };

  // Extract phone number from subject or body
  const phoneRegex = /(\+91|0)?[6-9]\d{9}/;
  const phoneMatch = (email.subject + ' ' + email.body).match(phoneRegex);
  if (phoneMatch) {
    parsed.clientPhone = phoneMatch[0];
  }

  // Extract email
  const emailRegex = /[\w.-]+@[\w.-]+\.\w+/;
  const emailMatch = email.body.match(emailRegex);
  if (emailMatch && emailMatch[0] !== email.from) {
    parsed.clientEmail = emailMatch[0];
  }

  // Detect document type from subject/body
  const subject = email.subject.toLowerCase();
  const body = email.body.toLowerCase();

  if (subject.includes('kyc') || body.includes('kyc documents')) {
    parsed.documentType = 'kyc';
  } else if (subject.includes('invoice') || body.includes('invoice')) {
    parsed.documentType = 'invoice';
  } else if (subject.includes('receipt')) {
    parsed.documentType = 'receipt';
  } else if (subject.includes('bank statement')) {
    parsed.documentType = 'bank_statement';
  }

  // Priority detection
  if (subject.includes('urgent') || body.includes('urgent')) {
    parsed.priority = 'high';
  }

  return parsed;
}

/**
 * Extract attachments from email
 */
export async function extractAttachments(email: EmailMessage): Promise<File[]> {
  const files: File[] = [];

  for (const attachment of email.attachments) {
    if (attachment.data) {
      const blob = attachment.data instanceof Blob 
        ? attachment.data 
        : new Blob([attachment.data], { type: attachment.contentType });
      
      const file = new File([blob], attachment.filename, { type: attachment.contentType });
      files.push(file);
    }
  }

  return files;
}

/**
 * Categorize attachment by file type
 */
export function categorizeAttachment(filename: string, contentType: string): string {
  const ext = filename.split('.').pop()?.toLowerCase();
  
  if (ext === 'pdf') return 'pdf_document';
  if (['jpg', 'jpeg', 'png', 'gif', 'bmp'].includes(ext || '')) return 'image';
  if (['doc', 'docx', 'odt'].includes(ext || '')) return 'document';
  if (['xls', 'xlsx', 'csv'].includes(ext || '')) return 'spreadsheet';
  if (ext === 'zip') return 'archive';
  
  return 'other';
}

/**
 * Send document request email to client
 */
export async function sendDocumentRequestEmail(
  to: string,
  clientName: string,
  documents: string[],
  firmName: string = 'Fintrex'
): Promise<{ success: boolean; error?: string }> {
  const subject = `Document Request from ${firmName}`;
  const body = `
Dear ${clientName},

We hope this email finds you well. To proceed with your account setup and compliance requirements, we kindly request you to submit the following documents:

${documents.map((doc, i) => `${i + 1}. ${doc}`).join('\n')}

Please reply to this email with the documents attached, or you can also send them via WhatsApp.

If you have any questions, please don't hesitate to contact us.

Best regards,
${firmName} Team
  `.trim();

  if (!BACKEND_URL) {
    console.log('[Email] Simulated email send:', { to, subject });
    return { success: true };
  }

  try {
    const response = await fetch(`${BACKEND_URL}/email/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ to, subject, body }),
    });

    if (!response.ok) {
      const error = await response.text();
      return { success: false, error };
    }

    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/**
 * Send automated reminder email
 */
export async function sendReminderEmail(
  to: string,
  clientName: string,
  pendingDocuments: string[],
  firmName: string = 'Fintrex'
): Promise<{ success: boolean; error?: string }> {
  const subject = `Reminder: Pending Documents - ${firmName}`;
  const body = `
Dear ${clientName},

This is a friendly reminder that we are still waiting for the following documents from you:

${pendingDocuments.map((doc, i) => `${i + 1}. ${doc}`).join('\n')}

Please submit these documents at your earliest convenience to avoid any delays in processing.

Thank you for your cooperation.

Best regards,
${firmName} Team
  `.trim();

  return sendDocumentRequestEmail(to, clientName, pendingDocuments, firmName);
}

/**
 * Process incoming email and create document records
 */
export async function processIncomingEmail(
  email: EmailMessage,
  accountantId: string,
  clientId?: string
): Promise<{ success: boolean; documentsCreated: number; error?: string }> {
  try {
    const parsed = parseEmail(email);
    const files = await extractAttachments(email);

    if (files.length === 0) {
      return { success: false, documentsCreated: 0, error: 'No attachments found' };
    }

    // In production, this would:
    // 1. Match email to client (by email, phone, or manual selection)
    // 2. Upload files to storage
    // 3. Create document records in database
    // 4. Trigger OCR processing

    console.log('[Email] Processed email with', files.length, 'attachments');
    console.log('[Email] Parsed info:', parsed);

    return {
      success: true,
      documentsCreated: files.length,
    };
  } catch (error: any) {
    return {
      success: false,
      documentsCreated: 0,
      error: error.message,
    };
  }
}

/**
 * Get simulated emails for development
 */
function getSimulatedEmails(): EmailMessage[] {
  return [
    {
      id: '1',
      from: 'client@example.com',
      to: 'accountant@fintrex.com',
      subject: 'KYC Documents Submission',
      body: 'Please find attached my PAN card and GST certificate for account setup.',
      date: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
      attachments: [
        {
          filename: 'pan_card.pdf',
          contentType: 'application/pdf',
          size: 245000,
        },
        {
          filename: 'gst_certificate.pdf',
          contentType: 'application/pdf',
          size: 186000,
        },
      ],
    },
    {
      id: '2',
      from: 'vendor@supplier.com',
      to: 'accountant@fintrex.com',
      subject: 'Invoice #INV-2024-001',
      body: 'Attached is the invoice for services rendered in December 2024.',
      date: new Date(Date.now() - 5 * 60 * 60 * 1000), // 5 hours ago
      attachments: [
        {
          filename: 'invoice_dec_2024.pdf',
          contentType: 'application/pdf',
          size: 124000,
        },
      ],
    },
  ];
}

/**
 * Setup email forwarding rules
 * Clients can forward documents to a dedicated email address
 */
export function getForwardingEmailAddress(accountantId: string, firmName: string): string {
  // Generate a unique forwarding email
  const sanitizedFirmName = firmName.toLowerCase().replace(/[^a-z0-9]/g, '');
  return `${sanitizedFirmName}-${accountantId.slice(0, 8)}@fintrex.email`;
}

/**
 * Validate email address format
 */
export function validateEmailAddress(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Parse email threading to group related emails
 */
export function groupEmailThread(emails: EmailMessage[]): Map<string, EmailMessage[]> {
  const threads = new Map<string, EmailMessage[]>();

  emails.forEach(email => {
    // Extract thread ID from subject (Re:, Fwd:, etc.)
    const subject = email.subject.replace(/^(Re:|Fwd:|FW:)\s*/i, '').trim();
    
    if (!threads.has(subject)) {
      threads.set(subject, []);
    }
    threads.get(subject)!.push(email);
  });

  return threads;
}

/**
 * Generate email analytics
 */
export interface EmailAnalytics {
  totalReceived: number;
  withAttachments: number;
  processedSuccessfully: number;
  avgProcessingTime: number;
  topSenders: { email: string; count: number }[];
}

export function analyzeEmails(emails: EmailMessage[]): EmailAnalytics {
  const withAttachments = emails.filter(e => e.attachments.length > 0);
  
  const senderCounts = emails.reduce((acc, email) => {
    acc[email.from] = (acc[email.from] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const topSenders = Object.entries(senderCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)
    .map(([email, count]) => ({ email, count }));

  return {
    totalReceived: emails.length,
    withAttachments: withAttachments.length,
    processedSuccessfully: withAttachments.length,
    avgProcessingTime: 45, // seconds (simulated)
    topSenders,
  };
}
