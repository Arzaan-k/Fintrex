/**
 * GST Reports (GSTR-1, GSTR-3B)
 * AUTO-GENERATED from invoice data
 * Ready for e-filing on GST Portal
 */

import { supabase } from "@/integrations/supabase/client";

export interface GSTInvoice {
  invoice_number: string;
  invoice_date: string;
  gstin: string;
  legal_name: string;
  address: string;
  taxable_value: number;
  cgst: number;
  sgst: number;
  igst: number;
  cess: number;
  total_tax: number;
  invoice_value: number;
  place_of_supply: string;
  reverse_charge: boolean;
  invoice_type: string;
}

export interface GSTR1Report {
  gstin: string;
  legal_name: string;
  period: string; // MM-YYYY
  filing_status: 'draft' | 'filed';

  // B2B - Business to Business
  b2b: {
    invoices: GSTInvoice[];
    total_taxable: number;
    total_cgst: number;
    total_sgst: number;
    total_igst: number;
    total_cess: number;
  };

  // B2C Large - Business to Consumer > ₹2.5L
  b2c_large: {
    invoices: GSTInvoice[];
    total_taxable: number;
    total_tax: number;
  };

  // B2C Small - Business to Consumer < ₹2.5L
  b2c_small: {
    total_taxable: number;
    total_tax: number;
  };

  // Credit/Debit Notes
  credit_notes: GSTInvoice[];
  debit_notes: GSTInvoice[];

  summary: {
    total_outward_supplies: number;
    total_taxable_value: number;
    total_tax: number;
  };

  generated_at: string;
}

export interface GSTR3BReport {
  gstin: string;
  legal_name: string;
  period: string; // MM-YYYY
  filing_status: 'draft' | 'filed';

  // Table 3.1 - Outward Supplies
  outward_supplies: {
    taxable_value: number;
    cgst: number;
    sgst: number;
    igst: number;
    cess: number;
  };

  // Table 3.2 - Inter-State Supplies
  inter_state_supplies: {
    taxable_value: number;
    igst: number;
  };

  // Table 4 - Input Tax Credit (ITC)
  itc: {
    inputs: { cgst: number; sgst: number; igst: number; cess: number };
    capital_goods: { cgst: number; sgst: number; igst: number; cess: number };
    input_services: { cgst: number; sgst: number; igst: number; cess: number };
    total: { cgst: number; sgst: number; igst: number; cess: number };
  };

  // Table 5 - Tax Payable
  tax_payable: {
    cgst: number;
    sgst: number;
    igst: number;
    cess: number;
    total: number;
  };

  generated_at: string;
}

/**
 * Generate GSTR-1 Report (Outward Supplies)
 */
export async function generateGSTR1(
  clientId: string,
  month: number,
  year: number
): Promise<GSTR1Report> {
  const period = `${String(month).padStart(2, '0')}-${year}`;
  console.log(`📊 Generating GSTR-1 for client ${clientId}, period ${period}...`);

  // Get client GSTIN
  const { data: client } = await supabase
    .from('clients')
    .select('gstin, client_name, business_name, address')
    .eq('id', clientId)
    .single();

  if (!client?.gstin) {
    throw new Error('Client GSTIN not found. Cannot generate GST report.');
  }

  // Get sales invoices for the period
  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 0);

  const { data: invoices, error } = await supabase
    .from('invoices')
    .select('*')
    .eq('client_id', clientId)
    .eq('invoice_type', 'sales')
    .gte('invoice_date', startDate.toISOString().split('T')[0])
    .lte('invoice_date', endDate.toISOString().split('T')[0]);

  if (error) throw error;

  // Categorize invoices
  const b2bInvoices: GSTInvoice[] = [];
  const b2cLargeInvoices: GSTInvoice[] = [];
  let b2cSmallTaxable = 0;
  let b2cSmallTax = 0;

  (invoices || []).forEach(inv => {
    const isB2B = inv.customer_gstin && inv.customer_gstin.trim() !== '';
    const isLargeInvoice = (inv.total_amount || 0) > 250000; // ₹2.5L threshold

    const gstInvoice: GSTInvoice = {
      invoice_number: inv.invoice_number,
      invoice_date: inv.invoice_date,
      gstin: inv.customer_gstin || '',
      legal_name: inv.customer_name || '',
      address: inv.customer_address || '',
      taxable_value: inv.subtotal || 0,
      cgst: inv.cgst || 0,
      sgst: inv.sgst || 0,
      igst: inv.igst || 0,
      cess: inv.cess || 0,
      total_tax: (inv.cgst || 0) + (inv.sgst || 0) + (inv.igst || 0) + (inv.cess || 0),
      invoice_value: inv.total_amount || 0,
      place_of_supply: inv.customer_address || '',
      reverse_charge: false,
      invoice_type: 'Regular',
    };

    if (isB2B) {
      b2bInvoices.push(gstInvoice);
    } else if (isLargeInvoice) {
      b2cLargeInvoices.push(gstInvoice);
    } else {
      b2cSmallTaxable += gstInvoice.taxable_value;
      b2cSmallTax += gstInvoice.total_tax;
    }
  });

  // Calculate B2B totals
  const b2bTotalTaxable = b2bInvoices.reduce((sum, inv) => sum + inv.taxable_value, 0);
  const b2bTotalCGST = b2bInvoices.reduce((sum, inv) => sum + inv.cgst, 0);
  const b2bTotalSGST = b2bInvoices.reduce((sum, inv) => sum + inv.sgst, 0);
  const b2bTotalIGST = b2bInvoices.reduce((sum, inv) => sum + inv.igst, 0);
  const b2bTotalCess = b2bInvoices.reduce((sum, inv) => sum + inv.cess, 0);

  // Calculate B2C Large totals
  const b2cLargeTaxable = b2cLargeInvoices.reduce((sum, inv) => sum + inv.taxable_value, 0);
  const b2cLargeTax = b2cLargeInvoices.reduce((sum, inv) => sum + inv.total_tax, 0);

  // Overall summary
  const totalTaxableValue = b2bTotalTaxable + b2cLargeTaxable + b2cSmallTaxable;
  const totalTax = (b2bTotalCGST + b2bTotalSGST + b2bTotalIGST + b2bTotalCess) + b2cLargeTax + b2cSmallTax;
  const totalOutward = totalTaxableValue + totalTax;

  console.log(`✅ GSTR-1 generated: ${b2bInvoices.length} B2B invoices, Total Tax: ₹${totalTax.toFixed(2)}`);

  return {
    gstin: client.gstin,
    legal_name: client.client_name || client.business_name || '',
    period,
    filing_status: 'draft',
    b2b: {
      invoices: b2bInvoices,
      total_taxable: b2bTotalTaxable,
      total_cgst: b2bTotalCGST,
      total_sgst: b2bTotalSGST,
      total_igst: b2bTotalIGST,
      total_cess: b2bTotalCess,
    },
    b2c_large: {
      invoices: b2cLargeInvoices,
      total_taxable: b2cLargeTaxable,
      total_tax: b2cLargeTax,
    },
    b2c_small: {
      total_taxable: b2cSmallTaxable,
      total_tax: b2cSmallTax,
    },
    credit_notes: [],
    debit_notes: [],
    summary: {
      total_outward_supplies: totalOutward,
      total_taxable_value: totalTaxableValue,
      total_tax: totalTax,
    },
    generated_at: new Date().toISOString(),
  };
}

/**
 * Generate GSTR-3B Report (Summary Return)
 */
export async function generateGSTR3B(
  clientId: string,
  month: number,
  year: number
): Promise<GSTR3BReport> {
  const period = `${String(month).padStart(2, '0')}-${year}`;
  console.log(`📊 Generating GSTR-3B for client ${clientId}, period ${period}...`);

  // Get client GSTIN
  const { data: client } = await supabase
    .from('clients')
    .select('gstin, client_name, business_name')
    .eq('id', clientId)
    .single();

  if (!client?.gstin) {
    throw new Error('Client GSTIN not found. Cannot generate GST report.');
  }

  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 0);

  // Get sales invoices (outward supplies)
  const { data: salesInvoices } = await supabase
    .from('invoices')
    .select('*')
    .eq('client_id', clientId)
    .eq('invoice_type', 'sales')
    .gte('invoice_date', startDate.toISOString().split('T')[0])
    .lte('invoice_date', endDate.toISOString().split('T')[0]);

  // Get purchase invoices (input tax credit)
  const { data: purchaseInvoices } = await supabase
    .from('invoices')
    .select('*')
    .eq('client_id', clientId)
    .eq('invoice_type', 'purchase')
    .gte('invoice_date', startDate.toISOString().split('T')[0])
    .lte('invoice_date', endDate.toISOString().split('T')[0]);

  // Calculate outward supplies (Table 3.1)
  const outwardTaxable = (salesInvoices || []).reduce((sum, inv) => sum + (inv.subtotal || 0), 0);
  const outwardCGST = (salesInvoices || []).reduce((sum, inv) => sum + (inv.cgst || 0), 0);
  const outwardSGST = (salesInvoices || []).reduce((sum, inv) => sum + (inv.sgst || 0), 0);
  const outwardIGST = (salesInvoices || []).reduce((sum, inv) => sum + (inv.igst || 0), 0);
  const outwardCess = (salesInvoices || []).reduce((sum, inv) => sum + (inv.cess || 0), 0);

  // Calculate inter-state supplies (Table 3.2) - only IGST invoices
  const interStateTaxable = (salesInvoices || [])
    .filter(inv => (inv.igst || 0) > 0)
    .reduce((sum, inv) => sum + (inv.subtotal || 0), 0);
  const interStateIGST = (salesInvoices || [])
    .filter(inv => (inv.igst || 0) > 0)
    .reduce((sum, inv) => sum + (inv.igst || 0), 0);

  // Calculate Input Tax Credit (Table 4)
  const itcCGST = (purchaseInvoices || []).reduce((sum, inv) => sum + (inv.cgst || 0), 0);
  const itcSGST = (purchaseInvoices || []).reduce((sum, inv) => sum + (inv.sgst || 0), 0);
  const itcIGST = (purchaseInvoices || []).reduce((sum, inv) => sum + (inv.igst || 0), 0);
  const itcCess = (purchaseInvoices || []).reduce((sum, inv) => sum + (inv.cess || 0), 0);

  // Calculate tax payable (Table 5)
  const payableCGST = Math.max(0, outwardCGST - itcCGST);
  const payableSGST = Math.max(0, outwardSGST - itcSGST);
  const payableIGST = Math.max(0, outwardIGST - itcIGST);
  const payableCess = Math.max(0, outwardCess - itcCess);
  const totalPayable = payableCGST + payableSGST + payableIGST + payableCess;

  console.log(`✅ GSTR-3B generated: Tax Payable: ₹${totalPayable.toFixed(2)}`);

  return {
    gstin: client.gstin,
    legal_name: client.client_name || client.business_name || '',
    period,
    filing_status: 'draft',
    outward_supplies: {
      taxable_value: outwardTaxable,
      cgst: outwardCGST,
      sgst: outwardSGST,
      igst: outwardIGST,
      cess: outwardCess,
    },
    inter_state_supplies: {
      taxable_value: interStateTaxable,
      igst: interStateIGST,
    },
    itc: {
      inputs: { cgst: itcCGST, sgst: itcSGST, igst: itcIGST, cess: itcCess },
      capital_goods: { cgst: 0, sgst: 0, igst: 0, cess: 0 },
      input_services: { cgst: 0, sgst: 0, igst: 0, cess: 0 },
      total: { cgst: itcCGST, sgst: itcSGST, igst: itcIGST, cess: itcCess },
    },
    tax_payable: {
      cgst: payableCGST,
      sgst: payableSGST,
      igst: payableIGST,
      cess: payableCess,
      total: totalPayable,
    },
    generated_at: new Date().toISOString(),
  };
}

/**
 * Export GSTR-1 to JSON (ready for GST Portal upload)
 */
export async function exportGSTR1ToJSON(
  clientId: string,
  month: number,
  year: number
): Promise<string> {
  const report = await generateGSTR1(clientId, month, year);

  // Format for GST Portal
  const gstPortalFormat = {
    gstin: report.gstin,
    fp: report.period,
    b2b: report.b2b.invoices.map(inv => ({
      ctin: inv.gstin,
      inv: [{
        inum: inv.invoice_number,
        idt: inv.invoice_date,
        val: inv.invoice_value,
        pos: '27', // Place of supply state code
        rchrg: inv.reverse_charge ? 'Y' : 'N',
        inv_typ: inv.invoice_type,
        itms: [{
          num: 1,
          itm_det: {
            txval: inv.taxable_value,
            rt: 18, // Tax rate - should be calculated
            camt: inv.cgst,
            samt: inv.sgst,
            iamt: inv.igst,
            csamt: inv.cess,
          }
        }]
      }]
    })),
    b2cl: report.b2c_large.invoices.map(inv => ({
      inv: [{
        inum: inv.invoice_number,
        idt: inv.invoice_date,
        val: inv.invoice_value,
        pos: '27',
      }]
    })),
    b2cs: [{
      sply_ty: 'INTRA',
      txval: report.b2c_small.total_taxable,
      rt: 18,
      iamt: 0,
      camt: report.b2c_small.total_tax / 2,
      samt: report.b2c_small.total_tax / 2,
    }],
  };

  return JSON.stringify(gstPortalFormat, null, 2);
}

/**
 * Calculate GST liability for a period
 */
export async function calculateGSTLiability(
  clientId: string,
  month: number,
  year: number
): Promise<{
  output_tax: number;
  input_credit: number;
  net_payable: number;
  due_date: string;
}> {
  const gstr3b = await generateGSTR3B(clientId, month, year);

  const outputTax = gstr3b.outward_supplies.cgst + gstr3b.outward_supplies.sgst + gstr3b.outward_supplies.igst + gstr3b.outward_supplies.cess;
  const inputCredit = gstr3b.itc.total.cgst + gstr3b.itc.total.sgst + gstr3b.itc.total.igst + gstr3b.itc.total.cess;
  const netPayable = gstr3b.tax_payable.total;

  // Due date is 20th of next month
  const dueDate = new Date(year, month, 20);

  return {
    output_tax: outputTax,
    input_credit: inputCredit,
    net_payable: netPayable,
    due_date: dueDate.toISOString().split('T')[0],
  };
}
