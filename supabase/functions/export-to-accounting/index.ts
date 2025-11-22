// Supabase Edge Function: export-to-accounting
// Exports financial data in formats compatible with Tally, ZohoBooks, etc.
// Endpoint: POST /export-to-accounting
// Body: { clientId: string, exportType: 'tally' | 'zohobooks' | 'quickbooks', dataType: 'journal' | 'ledger' | 'trial_balance', startDate?: string, endDate?: string }

// deno-lint-ignore-file no-explicit-any
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

const JSON_HEADERS = {
  "content-type": "application/json",
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "POST, OPTIONS",
  "access-control-allow-headers": "content-type, authorization, apikey, x-client-info",
};

/**
 * Export journal entries in Tally XML format
 */
function exportJournalToTally(entries: any[], client: any): string {
  const xml: string[] = [];

  xml.push('<?xml version="1.0" encoding="UTF-8"?>');
  xml.push('<ENVELOPE>');
  xml.push('  <HEADER>');
  xml.push('    <TALLYREQUEST>Import Data</TALLYREQUEST>');
  xml.push('  </HEADER>');
  xml.push('  <BODY>');
  xml.push('    <IMPORTDATA>');
  xml.push('      <REQUESTDESC>');
  xml.push('        <REPORTNAME>Vouchers</REPORTNAME>');
  xml.push('      </REQUESTDESC>');
  xml.push('      <REQUESTDATA>');

  entries.forEach((entry: any) => {
    xml.push('        <TALLYMESSAGE xmlns:UDF="TallyUDF">');
    xml.push('          <VOUCHER REMOTEID="" VCHKEY="" VCHTYPE="Journal" ACTION="Create">');
    xml.push(`            <DATE>${entry.entry_date?.replace(/-/g, '') || ''}</DATE>`);
    xml.push(`            <GUID></GUID>`);
    xml.push(`            <NARRATION>${entry.narration || ''}</NARRATION>`);
    xml.push(`            <VOUCHERTYPENAME>Journal</VOUCHERTYPENAME>`);
    xml.push(`            <VOUCHERNUMBER>${entry.id || ''}</VOUCHERNUMBER>`);
    xml.push(`            <REFERENCE>${entry.reference_invoice_id || ''}</REFERENCE>`);

    entry.line_items?.forEach((line: any) => {
      if (line.debit_amount > 0) {
        xml.push('            <ALLLEDGERENTRIES.LIST>');
        xml.push(`              <LEDGERNAME>${line.account_name || ''}</LEDGERNAME>`);
        xml.push(`              <ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE>`);
        xml.push(`              <AMOUNT>-${line.debit_amount}</AMOUNT>`);
        xml.push('            </ALLLEDGERENTRIES.LIST>');
      }
      if (line.credit_amount > 0) {
        xml.push('            <ALLLEDGERENTRIES.LIST>');
        xml.push(`              <LEDGERNAME>${line.account_name || ''}</LEDGERNAME>`);
        xml.push(`              <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>`);
        xml.push(`              <AMOUNT>${line.credit_amount}</AMOUNT>`);
        xml.push('            </ALLLEDGERENTRIES.LIST>');
      }
    });

    xml.push('          </VOUCHER>');
    xml.push('        </TALLYMESSAGE>');
  });

  xml.push('      </REQUESTDATA>');
  xml.push('    </IMPORTDATA>');
  xml.push('  </BODY>');
  xml.push('</ENVELOPE>');

  return xml.join('\n');
}

/**
 * Export journal entries in CSV format for Tally
 */
function exportJournalToCSV(entries: any[], client: any): string {
  const csv: string[] = [];

  // Header
  csv.push('Date,Voucher Number,Voucher Type,Account Name,Debit,Credit,Narration');

  entries.forEach((entry: any) => {
    const date = entry.entry_date || '';
    const voucherNumber = entry.id || '';
    const voucherType = entry.entry_type || 'Journal';
    const narration = (entry.narration || '').replace(/,/g, ' ');

    entry.line_items?.forEach((line: any) => {
      const accountName = (line.account_name || '').replace(/,/g, ' ');
      const debit = line.debit_amount || 0;
      const credit = line.credit_amount || 0;

      csv.push(`${date},${voucherNumber},${voucherType},${accountName},${debit},${credit},"${narration}"`);
    });
  });

  return csv.join('\n');
}

/**
 * Export ledger in CSV format
 */
function exportLedgerToCSV(ledger: any[], client: any): string {
  const csv: string[] = [];

  // Header
  csv.push('Account Code,Account Name,Account Type,Debit Total,Credit Total,Balance');

  ledger.forEach((account: any) => {
    const accountCode = account.account_code || '';
    const accountName = (account.account_name || '').replace(/,/g, ' ');
    const accountType = account.account_type || '';
    const debitTotal = account.debit_total || 0;
    const creditTotal = account.credit_total || 0;
    const balance = account.balance || 0;

    csv.push(`${accountCode},${accountName},${accountType},${debitTotal},${creditTotal},${balance}`);
  });

  return csv.join('\n');
}

/**
 * Export to ZohoBooks JSON format
 */
function exportJournalToZohoBooks(entries: any[], client: any): any {
  const journals: any[] = [];

  entries.forEach((entry: any) => {
    const journal: any = {
      journal_date: entry.entry_date,
      reference_number: entry.id,
      notes: entry.narration,
      line_items: [],
    };

    entry.line_items?.forEach((line: any) => {
      if (line.debit_amount > 0) {
        journal.line_items.push({
          account_name: line.account_name,
          description: line.description || entry.narration,
          debit_or_credit: 'debit',
          amount: line.debit_amount,
        });
      }
      if (line.credit_amount > 0) {
        journal.line_items.push({
          account_name: line.account_name,
          description: line.description || entry.narration,
          debit_or_credit: 'credit',
          amount: line.credit_amount,
        });
      }
    });

    journals.push(journal);
  });

  return {
    journals: journals,
    organization_name: client.business_name || '',
    export_date: new Date().toISOString(),
  };
}

/**
 * Get journal entries with line items
 */
async function getJournalEntries(
  supabase: any,
  clientId: string,
  startDate?: string,
  endDate?: string
): Promise<any[]> {
  let query = supabase
    .from('journal_entries')
    .select(`
      *,
      line_items:journal_line_items(*)
    `)
    .eq('client_id', clientId)
    .eq('status', 'posted')
    .order('entry_date', { ascending: true });

  if (startDate) {
    query = query.gte('entry_date', startDate);
  }
  if (endDate) {
    query = query.lte('entry_date', endDate);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching journal entries:', error);
    throw error;
  }

  return data || [];
}

/**
 * Get trial balance/ledger
 */
async function getTrialBalance(
  supabase: any,
  clientId: string,
  asOfDate: string
): Promise<any[]> {
  // Use the database function
  const { data, error } = await supabase
    .rpc('get_trial_balance', {
      p_client_id: clientId,
      p_as_of_date: asOfDate,
    });

  if (error) {
    console.error('Error getting trial balance:', error);
    throw error;
  }

  return data || [];
}

/**
 * Main handler
 */
serve(async (req: Request): Promise<Response> => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: JSON_HEADERS });
  }

  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "Method not allowed" }),
      { status: 405, headers: JSON_HEADERS }
    );
  }

  try {
    const body = await req.json() as {
      clientId: string;
      exportType: 'tally' | 'tally_xml' | 'tally_csv' | 'zohobooks' | 'quickbooks' | 'csv';
      dataType: 'journal' | 'ledger' | 'trial_balance';
      startDate?: string;
      endDate?: string;
      asOfDate?: string;
    };

    if (!body.clientId || !body.exportType || !body.dataType) {
      return new Response(
        JSON.stringify({ error: "clientId, exportType, and dataType are required" }),
        { status: 400, headers: JSON_HEADERS }
      );
    }

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      return new Response(
        JSON.stringify({ error: "Supabase configuration missing" }),
        { status: 500, headers: JSON_HEADERS }
      );
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false }
    });

    // Get client details
    const { data: client } = await supabase
      .from('clients')
      .select('*')
      .eq('id', body.clientId)
      .single();

    if (!client) {
      return new Response(
        JSON.stringify({ error: "Client not found" }),
        { status: 404, headers: JSON_HEADERS }
      );
    }

    let exportData: string | any;
    let contentType = 'text/csv';
    let filename = `export_${body.dataType}_${new Date().toISOString().split('T')[0]}`;

    if (body.dataType === 'journal') {
      const entries = await getJournalEntries(supabase, body.clientId, body.startDate, body.endDate);

      if (body.exportType === 'tally_xml' || body.exportType === 'tally') {
        exportData = exportJournalToTally(entries, client);
        contentType = 'application/xml';
        filename += '.xml';
      } else if (body.exportType === 'tally_csv' || body.exportType === 'csv') {
        exportData = exportJournalToCSV(entries, client);
        contentType = 'text/csv';
        filename += '.csv';
      } else if (body.exportType === 'zohobooks') {
        exportData = JSON.stringify(exportJournalToZohoBooks(entries, client), null, 2);
        contentType = 'application/json';
        filename += '.json';
      } else {
        return new Response(
          JSON.stringify({ error: "Unsupported export type for journal data" }),
          { status: 400, headers: JSON_HEADERS }
        );
      }
    } else if (body.dataType === 'ledger' || body.dataType === 'trial_balance') {
      const asOfDate = body.asOfDate || new Date().toISOString().split('T')[0];
      const ledger = await getTrialBalance(supabase, body.clientId, asOfDate);

      exportData = exportLedgerToCSV(ledger, client);
      contentType = 'text/csv';
      filename += '.csv';
    } else {
      return new Response(
        JSON.stringify({ error: "Unsupported data type" }),
        { status: 400, headers: JSON_HEADERS }
      );
    }

    return new Response(
      exportData,
      {
        status: 200,
        headers: {
          ...JSON_HEADERS,
          'content-type': contentType,
          'content-disposition': `attachment; filename="${filename}"`,
        }
      }
    );

  } catch (error) {
    console.error('❌ Error exporting data:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
      { status: 500, headers: JSON_HEADERS }
    );
  }
});
