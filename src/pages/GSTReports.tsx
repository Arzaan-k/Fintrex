import { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, FileText } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { formatINR } from "@/lib/financial";
import PageHeader from "@/components/PageHeader";

export default function GSTReports() {
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<string>(() => {
    const d = new Date();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    return `${d.getFullYear()}-${m}`; // YYYY-MM
  });
  const [invoices, setInvoices] = useState<any[]>([]);
  const { toast } = useToast();

  useEffect(() => { fetchData(); }, [period]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      // Load invoices for this accountant and selected month
      const start = new Date(`${period}-01T00:00:00`);
      const end = new Date(start);
      end.setMonth(end.getMonth() + 1);
      const sb = supabase as any;
      const { data } = await sb
        .from("invoices")
        .select("*, clients!inner(*)")
        .eq("clients.accountant_id", user.id)
        .gte("invoice_date", start.toISOString())
        .lt("invoice_date", end.toISOString())
        .order("invoice_date", { ascending: false });
      setInvoices(data || []);
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const months = useMemo(() => {
    const items: string[] = [];
    const now = new Date();
    for (let i = 0; i < 12; i++) {
      const d = new Date(now);
      d.setMonth(d.getMonth() - i);
      items.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
    }
    return items;
  }, []);

  // Basic summaries
  const summary = useMemo(() => {
    const sales = invoices.filter(i => i.invoice_type === 'sales');
    const purchase = invoices.filter(i => i.invoice_type === 'purchase');
    const sum = (arr: any[]) => arr.reduce((s, i) => s + Number(i.total_amount || 0), 0);
    return {
      salesCount: sales.length,
      purchaseCount: purchase.length,
      salesTotal: sum(sales),
      purchaseTotal: sum(purchase),
    };
  }, [invoices]);

  // GSTR-1: outward supplies (very simplified)
  const gstr1 = useMemo(() => {
    const rows = invoices
      .filter(i => i.invoice_type === 'sales')
      .map(i => ({
        invoice_number: i.invoice_number,
        invoice_date: i.invoice_date,
        customer_gstin: i.customer_gstin,
        taxable_value: Number(i.total_amount || 0) - Number(i.tax_details?.totalTax || 0),
        tax_value: Number(i.tax_details?.totalTax || 0),
        total: Number(i.total_amount || 0),
      }));
    return { rows };
  }, [invoices]);

  // GSTR-3B: summary (very simplified)
  const gstr3b = useMemo(() => {
    const outward = invoices.filter(i => i.invoice_type === 'sales');
    const inward = invoices.filter(i => i.invoice_type === 'purchase');
    const sumTax = (arr: any[], key: string) => arr.reduce((s, i) => s + Number(i.tax_details?.[key] || 0), 0);
    const sumTotal = (arr: any[]) => arr.reduce((s, i) => s + Number(i.total_amount || 0), 0);
    return {
      outwardTaxable: sumTotal(outward) - (sumTax(outward, 'totalTax')),
      outwardTax: sumTax(outward, 'totalTax'),
      inwardTaxable: sumTotal(inward) - (sumTax(inward, 'totalTax')),
      inwardTax: sumTax(inward, 'totalTax'),
      totalOutward: sumTotal(outward),
      totalInward: sumTotal(inward),
    };
  }, [invoices]);

  const exportGSTR1 = () => {
    const payload = { period, data: gstr1.rows };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `GSTR-1_${period}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportGSTR3B = () => {
    const payload = { period, data: gstr3b };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `GSTR-3B_${period}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="GST Reports"
        subtitle="GSTR-1 and GSTR-3B summaries"
        actions={
          <div className="w-[200px]">
            <Select value={period} onValueChange={setPeriod}>
              <SelectTrigger>
                <SelectValue placeholder="Select month" />
              </SelectTrigger>
              <SelectContent>
                {months.map(m => (
                  <SelectItem key={m} value={m}>{m}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        }
      />

      <div className="grid gap-4 md:grid-cols-4">
        <Card className="p-4">
          <p className="text-sm text-muted-foreground">Sales Invoices</p>
          <p className="text-2xl font-bold">{summary.salesCount}</p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-muted-foreground">Purchase Invoices</p>
          <p className="text-2xl font-bold">{summary.purchaseCount}</p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-muted-foreground">Sales Total</p>
          <p className="text-2xl font-bold">{formatINR(summary.salesTotal)}</p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-muted-foreground">Purchase Total</p>
          <p className="text-2xl font-bold">{formatINR(summary.purchaseTotal)}</p>
        </Card>
      </div>

      <Card>
        <div className="p-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-primary" />
            <h2 className="font-semibold">GSTR-1 (Outward Supplies)</h2>
          </div>
          <Button size="sm" onClick={exportGSTR1}>Export JSON</Button>
        </div>
        <div className="px-4 pb-4">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Invoice #</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Customer GSTIN</TableHead>
                <TableHead className="text-right">Taxable</TableHead>
                <TableHead className="text-right">Tax</TableHead>
                <TableHead className="text-right">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {gstr1.rows.map((r, idx) => (
                <TableRow key={idx}>
                  <TableCell>{r.invoice_number}</TableCell>
                  <TableCell>{new Date(r.invoice_date).toLocaleDateString('en-IN')}</TableCell>
                  <TableCell>{r.customer_gstin || '-'}</TableCell>
                  <TableCell className="text-right">{formatINR(r.taxable_value)}</TableCell>
                  <TableCell className="text-right">{formatINR(r.tax_value)}</TableCell>
                  <TableCell className="text-right">{formatINR(r.total)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Card>

      <Card>
        <div className="p-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-primary" />
            <h2 className="font-semibold">GSTR-3B (Summary)</h2>
          </div>
          <Button size="sm" onClick={exportGSTR3B}>Export JSON</Button>
        </div>
        <div className="px-4 pb-4">
          <div className="grid gap-4 md:grid-cols-3">
            <Card className="p-4">
              <p className="text-sm text-muted-foreground">Outward Taxable</p>
              <p className="text-2xl font-bold">{formatINR(gstr3b.outwardTaxable)}</p>
            </Card>
            <Card className="p-4">
              <p className="text-sm text-muted-foreground">Outward Tax</p>
              <p className="text-2xl font-bold">{formatINR(gstr3b.outwardTax)}</p>
            </Card>
            <Card className="p-4">
              <p className="text-sm text-muted-foreground">Total Outward</p>
              <p className="text-2xl font-bold">{formatINR(gstr3b.totalOutward)}</p>
            </Card>
            <Card className="p-4">
              <p className="text-sm text-muted-foreground">Inward Taxable</p>
              <p className="text-2xl font-bold">{formatINR(gstr3b.inwardTaxable)}</p>
            </Card>
            <Card className="p-4">
              <p className="text-sm text-muted-foreground">Inward Tax</p>
              <p className="text-2xl font-bold">{formatINR(gstr3b.inwardTax)}</p>
            </Card>
            <Card className="p-4">
              <p className="text-sm text-muted-foreground">Total Inward</p>
              <p className="text-2xl font-bold">{formatINR(gstr3b.totalInward)}</p>
            </Card>
          </div>
        </div>
      </Card>
    </div>
  );
}
