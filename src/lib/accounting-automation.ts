/**
 * Accounting Automation
 * Auto-generates double-entry journal entries from invoices and financial records
 */

import { supabase } from "@/integrations/supabase/client";

export interface JournalEntry {
  id?: string;
  client_id: string;
  entry_date: string;
  entry_type: 'sales' | 'purchase' | 'payment' | 'receipt' | 'adjustment' | 'other';
  narration: string;
  reference_document_id?: string;
  reference_invoice_id?: string;
  is_auto_generated: boolean;
  created_by?: string;
  status: 'draft' | 'posted' | 'reversed';
}

export interface JournalLineItem {
  id?: string;
  entry_id: string;
  account_name: string;
  account_code: string;
  account_id?: string;
  debit_amount: number;
  credit_amount: number;
  reference_document_id?: string;
}

/**
 * Create journal entry from invoice (uses database trigger, but can be called manually)
 */
export async function createJournalFromInvoice(invoiceId: string): Promise<string> {
  const { data, error } = await supabase.rpc('create_journal_from_invoice', {
    p_invoice_id: invoiceId
  });

  if (error) throw error;
  return data; // Returns entry_id
}

/**
 * Create manual journal entry
 */
export async function createManualJournalEntry(
  entry: Omit<JournalEntry, 'id'>,
  lineItems: Omit<JournalLineItem, 'id' | 'entry_id'>[]
): Promise<string> {
  // Validate debits = credits
  const totalDebits = lineItems.reduce((sum, item) => sum + item.debit_amount, 0);
  const totalCredits = lineItems.reduce((sum, item) => sum + item.credit_amount, 0);

  if (Math.abs(totalDebits - totalCredits) > 0.01) {
    throw new Error(`Journal entry not balanced: Debits=${totalDebits}, Credits=${totalCredits}`);
  }

  // Insert entry
  const { data: entryData, error: entryError } = await supabase
    .from('journal_entries')
    .insert(entry)
    .select()
    .single();

  if (entryError) throw entryError;

  // Insert line items
  const lineItemsWithEntryId = lineItems.map(item => ({
    ...item,
    entry_id: entryData.id,
  }));

  const { error: lineItemsError } = await supabase
    .from('journal_line_items')
    .insert(lineItemsWithEntryId);

  if (lineItemsError) {
    // Rollback entry
    await supabase.from('journal_entries').delete().eq('id', entryData.id);
    throw lineItemsError;
  }

  return entryData.id;
}

/**
 * Create journal entry from payment
 */
export async function createJournalFromPayment(
  clientId: string,
  paymentDate: string,
  amount: number,
  fromAccount: { name: string; code: string },
  toAccount: { name: string; code: string },
  narration: string,
  documentId?: string
): Promise<string> {
  const lineItems: Omit<JournalLineItem, 'id' | 'entry_id'>[] = [
    {
      account_name: toAccount.name,
      account_code: toAccount.code,
      debit_amount: amount,
      credit_amount: 0,
      reference_document_id: documentId,
    },
    {
      account_name: fromAccount.name,
      account_code: fromAccount.code,
      debit_amount: 0,
      credit_amount: amount,
      reference_document_id: documentId,
    },
  ];

  return createManualJournalEntry(
    {
      client_id: clientId,
      entry_date: paymentDate,
      entry_type: 'payment',
      narration,
      reference_document_id: documentId,
      is_auto_generated: true,
      status: 'posted',
    },
    lineItems
  );
}

/**
 * Create journal entry from receipt
 */
export async function createJournalFromReceipt(
  clientId: string,
  receiptDate: string,
  amount: number,
  fromAccount: { name: string; code: string },
  toAccount: { name: string; code: string },
  narration: string,
  documentId?: string
): Promise<string> {
  const lineItems: Omit<JournalLineItem, 'id' | 'entry_id'>[] = [
    {
      account_name: toAccount.name,
      account_code: toAccount.code,
      debit_amount: amount,
      credit_amount: 0,
      reference_document_id: documentId,
    },
    {
      account_name: fromAccount.name,
      account_code: fromAccount.code,
      debit_amount: 0,
      credit_amount: amount,
      reference_document_id: documentId,
    },
  ];

  return createManualJournalEntry(
    {
      client_id: clientId,
      entry_date: receiptDate,
      entry_type: 'receipt',
      narration,
      reference_document_id: documentId,
      is_auto_generated: true,
      status: 'posted',
    },
    lineItems
  );
}

/**
 * Get journal entries for client
 */
export async function getJournalEntries(
  clientId: string,
  options?: {
    startDate?: string;
    endDate?: string;
    status?: 'draft' | 'posted' | 'reversed';
    entryType?: JournalEntry['entry_type'];
  }
): Promise<(JournalEntry & { line_items: JournalLineItem[] })[]> {
  let query = supabase
    .from('journal_entries')
    .select(`
      *,
      line_items:journal_line_items(*)
    `)
    .eq('client_id', clientId)
    .order('entry_date', { ascending: false });

  if (options?.startDate) {
    query = query.gte('entry_date', options.startDate);
  }
  if (options?.endDate) {
    query = query.lte('entry_date', options.endDate);
  }
  if (options?.status) {
    query = query.eq('status', options.status);
  }
  if (options?.entryType) {
    query = query.eq('entry_type', options.entryType);
  }

  const { data, error } = await query;

  if (error) throw error;
  return data || [];
}

/**
 * Get journal entry by ID with line items
 */
export async function getJournalEntry(entryId: string): Promise<(JournalEntry & { line_items: JournalLineItem[] }) | null> {
  const { data, error } = await supabase
    .from('journal_entries')
    .select(`
      *,
      line_items:journal_line_items(*)
    `)
    .eq('id', entryId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    throw error;
  }
  return data;
}

/**
 * Update journal entry (only if draft)
 */
export async function updateJournalEntry(
  entryId: string,
  updates: Partial<Omit<JournalEntry, 'id' | 'client_id'>>,
  lineItems?: Omit<JournalLineItem, 'id' | 'entry_id'>[]
): Promise<void> {
  // Check if entry is draft
  const { data: entry } = await supabase
    .from('journal_entries')
    .select('status')
    .eq('id', entryId)
    .single();

  if (!entry || entry.status !== 'draft') {
    throw new Error('Can only update draft entries');
  }

  // Update entry
  const { error: entryError } = await supabase
    .from('journal_entries')
    .update(updates)
    .eq('id', entryId);

  if (entryError) throw entryError;

  // If line items provided, replace them
  if (lineItems) {
    // Validate balance
    const totalDebits = lineItems.reduce((sum, item) => sum + item.debit_amount, 0);
    const totalCredits = lineItems.reduce((sum, item) => sum + item.credit_amount, 0);

    if (Math.abs(totalDebits - totalCredits) > 0.01) {
      throw new Error(`Journal entry not balanced: Debits=${totalDebits}, Credits=${totalCredits}`);
    }

    // Delete existing line items
    await supabase.from('journal_line_items').delete().eq('entry_id', entryId);

    // Insert new line items
    const lineItemsWithEntryId = lineItems.map(item => ({
      ...item,
      entry_id: entryId,
    }));

    const { error: lineItemsError } = await supabase
      .from('journal_line_items')
      .insert(lineItemsWithEntryId);

    if (lineItemsError) throw lineItemsError;
  }
}

/**
 * Post journal entry (change status from draft to posted)
 */
export async function postJournalEntry(entryId: string): Promise<void> {
  // Validate balance
  const { data: isBalanced } = await supabase.rpc('validate_journal_entry_balance', {
    p_entry_id: entryId
  });

  if (!isBalanced) {
    throw new Error('Cannot post unbalanced journal entry');
  }

  const { error } = await supabase
    .from('journal_entries')
    .update({ status: 'posted' })
    .eq('id', entryId);

  if (error) throw error;
}

/**
 * Reverse journal entry (create reversing entry)
 */
export async function reverseJournalEntry(
  entryId: string,
  reversalDate: string,
  narration: string
): Promise<string> {
  const entry = await getJournalEntry(entryId);
  if (!entry) throw new Error('Journal entry not found');

  if (entry.status !== 'posted') {
    throw new Error('Can only reverse posted entries');
  }

  // Create reversing line items (swap debits and credits)
  const reversingLineItems = entry.line_items.map(item => ({
    account_name: item.account_name,
    account_code: item.account_code,
    account_id: item.account_id,
    debit_amount: item.credit_amount, // Swap
    credit_amount: item.debit_amount, // Swap
    reference_document_id: item.reference_document_id,
  }));

  // Create reversing entry
  const reversingEntryId = await createManualJournalEntry(
    {
      client_id: entry.client_id,
      entry_date: reversalDate,
      entry_type: 'adjustment',
      narration: `Reversal of ${entry.narration} - ${narration}`,
      is_auto_generated: false,
      status: 'posted',
    },
    reversingLineItems
  );

  // Mark original entry as reversed
  await supabase
    .from('journal_entries')
    .update({ status: 'reversed' })
    .eq('id', entryId);

  return reversingEntryId;
}

/**
 * Delete journal entry (only if draft)
 */
export async function deleteJournalEntry(entryId: string): Promise<void> {
  const { data: entry } = await supabase
    .from('journal_entries')
    .select('status')
    .eq('id', entryId)
    .single();

  if (!entry || entry.status !== 'draft') {
    throw new Error('Can only delete draft entries. Use reverse for posted entries.');
  }

  // Line items will be deleted automatically due to ON DELETE CASCADE
  const { error } = await supabase
    .from('journal_entries')
    .delete()
    .eq('id', entryId);

  if (error) throw error;
}

/**
 * Get journal entries summary
 */
export async function getJournalEntriesSummary(
  clientId: string,
  startDate?: string,
  endDate?: string
): Promise<{
  total: number;
  posted: number;
  draft: number;
  reversed: number;
  totalDebits: number;
  totalCredits: number;
}> {
  let query = supabase
    .from('journal_entries')
    .select(`
      status,
      line_items:journal_line_items(debit_amount, credit_amount)
    `)
    .eq('client_id', clientId);

  if (startDate) {
    query = query.gte('entry_date', startDate);
  }
  if (endDate) {
    query = query.lte('entry_date', endDate);
  }

  const { data, error } = await query;

  if (error) throw error;

  const entries = data || [];
  const summary = {
    total: entries.length,
    posted: entries.filter(e => e.status === 'posted').length,
    draft: entries.filter(e => e.status === 'draft').length,
    reversed: entries.filter(e => e.status === 'reversed').length,
    totalDebits: 0,
    totalCredits: 0,
  };

  entries.forEach(entry => {
    if (entry.status === 'posted') {
      (entry.line_items || []).forEach((item: any) => {
        summary.totalDebits += item.debit_amount || 0;
        summary.totalCredits += item.credit_amount || 0;
      });
    }
  });

  return summary;
}
