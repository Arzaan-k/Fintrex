// KYC workflow management for WhatsApp
// Handles client onboarding, document requests, and checklist tracking

export interface KYCChecklistItem {
  document_type: string;
  is_required: boolean;
  status: 'pending' | 'uploaded' | 'verified' | 'rejected';
  document_id?: string;
}

/**
 * Get KYC checklist for a client
 */
export async function getClientKYCChecklist(
  supabase: any,
  clientId: string
): Promise<KYCChecklistItem[]> {
  const { data: checklist, error } = await supabase
    .from('client_kyc_checklists')
    .select('*')
    .eq('client_id', clientId)
    .order('is_required', { ascending: false })
    .order('requested_at', { ascending: true });

  if (error) {
    console.error('Error fetching KYC checklist:', error);
    return [];
  }

  return checklist || [];
}

/**
 * Initialize KYC checklist for new client
 */
export async function initializeKYCChecklist(
  supabase: any,
  clientId: string,
  businessType: string = 'proprietorship'
): Promise<void> {
  // Check if checklist already exists
  const { data: existing } = await supabase
    .from('client_kyc_checklists')
    .select('id')
    .eq('client_id', clientId)
    .limit(1);

  if (existing && existing.length > 0) {
    console.log(`KYC checklist already exists for client ${clientId}`);
    return;
  }

  // Default required documents based on business type
  const documentsByType: { [key: string]: Array<{ type: string; required: boolean }> } = {
    proprietorship: [
      { type: 'pan_card', required: true },
      { type: 'aadhaar_card', required: true },
      { type: 'gst_certificate', required: false },
      { type: 'bank_details', required: true },
      { type: 'cancelled_cheque', required: true },
      { type: 'address_proof', required: true },
      { type: 'shop_establishment', required: false },
    ],
    partnership: [
      { type: 'partnership_deed', required: true },
      { type: 'pan_card', required: true },
      { type: 'partners_aadhaar', required: true },
      { type: 'gst_certificate', required: true },
      { type: 'bank_details', required: true },
      { type: 'cancelled_cheque', required: true },
      { type: 'registration_certificate', required: true },
    ],
    llp: [
      { type: 'llp_agreement', required: true },
      { type: 'incorporation_certificate', required: true },
      { type: 'pan_card', required: true },
      { type: 'partners_aadhaar', required: true },
      { type: 'gst_certificate', required: true },
      { type: 'bank_details', required: true },
      { type: 'cancelled_cheque', required: true },
    ],
    private_limited: [
      { type: 'moa_aoa', required: true },
      { type: 'incorporation_certificate', required: true },
      { type: 'cin_certificate', required: true },
      { type: 'pan_card', required: true },
      { type: 'directors_din', required: true },
      { type: 'gst_certificate', required: true },
      { type: 'bank_details', required: true },
      { type: 'cancelled_cheque', required: true },
      { type: 'share_certificates', required: false },
    ],
  };

  const documents = documentsByType[businessType] || documentsByType.proprietorship;

  const checklistItems = documents.map(doc => ({
    client_id: clientId,
    document_type: doc.type,
    is_required: doc.required,
    status: 'pending',
    requested_at: new Date().toISOString(),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }));

  const { error: insertError } = await supabase
    .from('client_kyc_checklists')
    .insert(checklistItems);

  if (insertError) {
    console.error('Error initializing KYC checklist:', insertError);
    throw new Error('Failed to initialize KYC checklist');
  }

  console.log(`✅ Initialized KYC checklist for client ${clientId} (${businessType})`);
}

/**
 * Get human-readable document type name
 */
export function getDocumentTypeName(docType: string): string {
  const nameMap: { [key: string]: string } = {
    pan_card: 'PAN Card',
    aadhaar_card: 'Aadhaar Card',
    gst_certificate: 'GST Certificate',
    bank_details: 'Bank Account Details',
    cancelled_cheque: 'Cancelled Cheque',
    address_proof: 'Address Proof',
    shop_establishment: 'Shop Establishment Certificate',
    partnership_deed: 'Partnership Deed',
    partners_aadhaar: 'Partners\' Aadhaar Cards',
    llp_agreement: 'LLP Agreement',
    incorporation_certificate: 'Certificate of Incorporation',
    moa_aoa: 'MOA & AOA',
    cin_certificate: 'CIN Certificate',
    directors_din: 'Directors\' DIN',
    share_certificates: 'Share Certificates',
    registration_certificate: 'Registration Certificate',
    previous_itr: 'Previous Year ITR',
    utility_bill: 'Utility Bill',
    rent_agreement: 'Rent Agreement',
  };

  return nameMap[docType] || docType.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
}

/**
 * Format KYC checklist as WhatsApp message
 */
export function formatKYCChecklistMessage(checklist: KYCChecklistItem[]): string {
  if (!checklist || checklist.length === 0) {
    return '✅ *KYC Complete!*\n\nAll required documents have been uploaded.';
  }

  const pending = checklist.filter(item => item.status === 'pending');
  const required = pending.filter(item => item.is_required);
  const optional = pending.filter(item => !item.is_required);

  if (pending.length === 0) {
    return '✅ *KYC Complete!*\n\nAll documents have been uploaded and are under review.';
  }

  let message = '📋 *KYC Document Checklist*\n\n';

  if (required.length > 0) {
    message += '*Required Documents:*\n';
    required.forEach((item, index) => {
      message += `${index + 1}. ❌ ${getDocumentTypeName(item.document_type)}\n`;
    });
    message += '\n';
  }

  if (optional.length > 0) {
    message += '*Optional Documents:*\n';
    optional.forEach((item, index) => {
      message += `${index + 1}. ⚪ ${getDocumentTypeName(item.document_type)}\n`;
    });
    message += '\n';
  }

  message += `*Progress:* ${checklist.length - pending.length}/${checklist.length} completed\n\n`;
  message += 'Please upload the required documents to complete your KYC.';

  return message;
}

/**
 * Update KYC checklist item when document is uploaded
 */
export async function updateKYCChecklistItem(
  supabase: any,
  clientId: string,
  documentType: string,
  documentId: string,
  status: 'uploaded' | 'verified' | 'rejected' = 'uploaded'
): Promise<void> {
  const updateData: any = {
    document_id: documentId,
    status: status,
    uploaded_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  if (status === 'verified') {
    updateData.verified_at = new Date().toISOString();
  }

  const { error } = await supabase
    .from('client_kyc_checklists')
    .update(updateData)
    .eq('client_id', clientId)
    .eq('document_type', documentType);

  if (error) {
    console.error('Error updating KYC checklist:', error);
  } else {
    console.log(`✅ Updated KYC checklist: ${documentType} → ${status}`);
  }

  // Check if KYC is complete
  const checklist = await getClientKYCChecklist(supabase, clientId);
  const requiredPending = checklist.filter(item => item.is_required && item.status === 'pending');

  if (requiredPending.length === 0) {
    // All required documents uploaded - update client status
    await supabase
      .from('clients')
      .update({
        status: 'active', // Change from kyc_pending to active
        updated_at: new Date().toISOString(),
      })
      .eq('id', clientId);

    console.log(`✅ KYC completed for client ${clientId} - status updated to active`);
  }
}

/**
 * Send KYC document request to client
 */
export async function sendKYCDocumentRequest(
  supabase: any,
  phoneNumberId: string,
  clientPhone: string,
  documentType: string,
  clientId: string,
  accountantId: string
): Promise<void> {
  const documentName = getDocumentTypeName(documentType);

  const message = {
    type: 'text',
    text: {
      body: `📄 *Document Request*\n\n` +
            `Please upload your *${documentName}* to complete your KYC.\n\n` +
            `Simply send the document as a photo or PDF. Make sure the image is clear and all details are visible.\n\n` +
            `If you have any questions, please contact your accountant.`
    }
  };

  // Send WhatsApp message (implement sendWhatsAppMessage function)
  // This would call the WhatsApp API

  // Log the request in database
  await supabase
    .from('document_requests')
    .insert({
      client_id: clientId,
      accountant_id: accountantId,
      document_type: documentType,
      request_type: 'automated',
      message: message.text.body,
      status: 'sent',
      sent_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
}

/**
 * Get next pending KYC document
 */
export async function getNextPendingKYCDocument(
  supabase: any,
  clientId: string
): Promise<KYCChecklistItem | null> {
  const checklist = await getClientKYCChecklist(supabase, clientId);

  // Prioritize required documents
  const pending = checklist
    .filter(item => item.status === 'pending')
    .sort((a, b) => {
      if (a.is_required && !b.is_required) return -1;
      if (!a.is_required && b.is_required) return 1;
      return 0;
    });

  return pending.length > 0 ? pending[0] : null;
}

/**
 * Classify document type from content using simple rules
 * (In production, this would use LLM for better accuracy)
 */
export function classifyKYCDocument(filename: string, ocrText: string): string {
  const lowerText = ocrText.toLowerCase();
  const lowerFilename = filename.toLowerCase();

  if (lowerText.includes('permanent account number') || lowerText.includes('income tax department') || lowerFilename.includes('pan')) {
    return 'pan_card';
  }

  if (lowerText.includes('aadhaar') || lowerText.includes('आधार') || lowerFilename.includes('aadhaar') || lowerFilename.includes('aadhar')) {
    return 'aadhaar_card';
  }

  if (lowerText.includes('gstin') || lowerText.includes('goods and services tax') || lowerFilename.includes('gst')) {
    return 'gst_certificate';
  }

  if (lowerText.includes('ifsc') || lowerText.includes('account number') || lowerFilename.includes('cheque') || lowerFilename.includes('bank')) {
    if (lowerText.includes('cancelled') || lowerFilename.includes('cancelled')) {
      return 'cancelled_cheque';
    }
    return 'bank_details';
  }

  if (lowerText.includes('partnership deed') || lowerFilename.includes('partnership')) {
    return 'partnership_deed';
  }

  if (lowerText.includes('certificate of incorporation') || lowerText.includes('incorporated') || lowerFilename.includes('incorporation')) {
    return 'incorporation_certificate';
  }

  if (lowerText.includes('memorandum') || lowerText.includes('articles of association') || lowerFilename.includes('moa') || lowerFilename.includes('aoa')) {
    return 'moa_aoa';
  }

  if (lowerText.includes('electricity bill') || lowerText.includes('utility bill') || lowerFilename.includes('utility') || lowerFilename.includes('electric')) {
    return 'utility_bill';
  }

  if (lowerText.includes('rent agreement') || lowerText.includes('lease') || lowerFilename.includes('rent') || lowerFilename.includes('lease')) {
    return 'rent_agreement';
  }

  // Default to general KYC document
  return 'kyc_document';
}

/**
 * Send KYC status update to accountant
 */
export async function notifyAccountantKYCProgress(
  supabase: any,
  accountantId: string,
  clientId: string,
  clientName: string,
  progress: number
): Promise<void> {
  const message = `KYC Progress Update: ${clientName} has completed ${progress}% of KYC documents`;

  await supabase
    .from('notifications')
    .insert({
      user_id: accountantId,
      title: 'KYC Progress Update',
      message: message,
      type: 'info',
      read: false,
      link: `/clients/${clientId}`,
      created_at: new Date().toISOString(),
    });

  console.log(`📧 Notified accountant ${accountantId} about KYC progress for ${clientName}`);
}

/**
 * Calculate KYC completion percentage
 */
export function calculateKYCProgress(checklist: KYCChecklistItem[]): number {
  if (!checklist || checklist.length === 0) return 100;

  const completed = checklist.filter(item => item.status === 'uploaded' || item.status === 'verified').length;
  return Math.round((completed / checklist.length) * 100);
}

/**
 * Send KYC reminder for pending documents
 */
export async function sendKYCReminder(
  supabase: any,
  clientId: string
): Promise<void> {
  const checklist = await getClientKYCChecklist(supabase, clientId);
  const pending = checklist.filter(item => item.status === 'pending');

  if (pending.length === 0) return;

  // Update reminder count
  for (const item of pending) {
    await supabase
      .from('client_kyc_checklists')
      .update({
        reminder_count: (item.reminder_count || 0) + 1,
        last_reminder_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', item.id);
  }

  console.log(`📬 KYC reminder sent for client ${clientId} - ${pending.length} pending documents`);
}
