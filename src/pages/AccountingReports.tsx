import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Download,
  FileSpreadsheet,
  FileText,
  TrendingUp,
  Loader2,
  Calculator,
  BarChart3
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  generateBalanceSheet,
  generateProfitLoss,
  exportToTallyXML,
  exportToTallyCSV,
  exportToZohoBooks,
  exportTrialBalanceCSV,
  downloadBlob,
  getJournalEntries,
} from "@/lib/financial-api";
import { toast } from "sonner";

export default function AccountingReports() {
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [clients, setClients] = useState<any[]>([]);
  const [selectedClient, setSelectedClient] = useState<string>("");
  const [journalEntries, setJournalEntries] = useState<any[]>([]);
  const [balanceSheet, setBalanceSheet] = useState<any>(null);
  const [profitLoss, setProfitLoss] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<'journal' | 'trial_balance' | 'balance_sheet' | 'profit_loss'>('journal');

  useEffect(() => {
    fetchClients();
  }, []);

  useEffect(() => {
    if (selectedClient) {
      fetchReportsData();
    }
  }, [selectedClient]);

  const fetchClients = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('clients')
        .select('*')
        .eq('accountant_id', user.id)
        .order('business_name');

      if (error) throw error;

      setClients(data || []);
      if (data && data.length > 0) {
        setSelectedClient(data[0].id);
      }
    } catch (error) {
      console.error('Error fetching clients:', error);
      toast.error('Failed to load clients');
    } finally {
      setLoading(false);
    }
  };

  const fetchReportsData = async () => {
    if (!selectedClient) return;

    setLoading(true);
    try {
      // Fetch journal entries
      const entries = await getJournalEntries(selectedClient);
      setJournalEntries(entries || []);

      // Fetch or generate balance sheet
      try {
        const bs = await generateBalanceSheet(selectedClient);
        setBalanceSheet(bs);
      } catch (error) {
        console.error('Error generating balance sheet:', error);
      }

      // Fetch or generate P&L
      try {
        const pl = await generateProfitLoss(selectedClient);
        setProfitLoss(pl);
      } catch (error) {
        console.error('Error generating P&L:', error);
      }
    } catch (error) {
      console.error('Error fetching reports data:', error);
      toast.error('Failed to load reports');
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async (type: 'tally_xml' | 'tally_csv' | 'zohobooks' | 'trial_balance') => {
    if (!selectedClient) {
      toast.error('Please select a client first');
      return;
    }

    setExporting(true);
    try {
      let blob: Blob;
      let filename: string;

      switch (type) {
        case 'tally_xml':
          blob = await exportToTallyXML(selectedClient);
          filename = `tally_export_${new Date().toISOString().split('T')[0]}.xml`;
          break;
        case 'tally_csv':
          blob = await exportToTallyCSV(selectedClient);
          filename = `tally_export_${new Date().toISOString().split('T')[0]}.csv`;
          break;
        case 'zohobooks':
          blob = await exportToZohoBooks(selectedClient);
          filename = `zohobooks_export_${new Date().toISOString().split('T')[0]}.json`;
          break;
        case 'trial_balance':
          blob = await exportTrialBalanceCSV(selectedClient);
          filename = `trial_balance_${new Date().toISOString().split('T')[0]}.csv`;
          break;
      }

      downloadBlob(blob, filename);
      toast.success('Export downloaded successfully');
    } catch (error) {
      console.error('Error exporting:', error);
      toast.error('Failed to export data');
    } finally {
      setExporting(false);
    }
  };

  const formatCurrency = (amount: number | string) => {
    const num = typeof amount === 'string' ? parseFloat(amount) : amount;
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 2,
    }).format(num);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  };

  if (loading && clients.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-gradient-primary rounded-xl p-6 text-sidebar-foreground shadow-lg">
        <h1 className="text-3xl font-bold mb-2">Accounting Reports</h1>
        <p className="text-sidebar-foreground/90">
          View journal entries, trial balance, and export to Tally/ZohoBooks
        </p>
      </div>

      <Card className="p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Select Client</label>
              <Select value={selectedClient} onValueChange={setSelectedClient}>
                <SelectTrigger className="w-[300px]">
                  <SelectValue placeholder="Select a client" />
                </SelectTrigger>
                <SelectContent>
                  {clients.map((client) => (
                    <SelectItem key={client.id} value={client.id}>
                      {client.business_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={() => handleExport('tally_xml')}
              disabled={exporting || !selectedClient}
            >
              {exporting ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <FileText className="mr-2 h-4 w-4" />
              )}
              Export to Tally (XML)
            </Button>
            <Button
              variant="outline"
              onClick={() => handleExport('tally_csv')}
              disabled={exporting || !selectedClient}
            >
              {exporting ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <FileSpreadsheet className="mr-2 h-4 w-4" />
              )}
              Export to Tally (CSV)
            </Button>
            <Button
              variant="outline"
              onClick={() => handleExport('zohobooks')}
              disabled={exporting || !selectedClient}
            >
              {exporting ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Download className="mr-2 h-4 w-4" />
              )}
              Export to ZohoBooks
            </Button>
          </div>
        </div>

        <div className="flex gap-2 mb-6 border-b">
          <Button
            variant={activeTab === 'journal' ? 'default' : 'ghost'}
            onClick={() => setActiveTab('journal')}
            className="rounded-b-none"
          >
            <FileText className="mr-2 h-4 w-4" />
            Journal Entries
          </Button>
          <Button
            variant={activeTab === 'trial_balance' ? 'default' : 'ghost'}
            onClick={() => setActiveTab('trial_balance')}
            className="rounded-b-none"
          >
            <Calculator className="mr-2 h-4 w-4" />
            Trial Balance
          </Button>
          <Button
            variant={activeTab === 'balance_sheet' ? 'default' : 'ghost'}
            onClick={() => setActiveTab('balance_sheet')}
            className="rounded-b-none"
          >
            <BarChart3 className="mr-2 h-4 w-4" />
            Balance Sheet
          </Button>
          <Button
            variant={activeTab === 'profit_loss' ? 'default' : 'ghost'}
            onClick={() => setActiveTab('profit_loss')}
            className="rounded-b-none"
          >
            <TrendingUp className="mr-2 h-4 w-4" />
            Profit & Loss
          </Button>
        </div>

        {activeTab === 'journal' && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Journal Entries</h3>
              <Badge>{journalEntries.length} entries</Badge>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : journalEntries.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No journal entries found</p>
              </div>
            ) : (
              <div className="space-y-4">
                {journalEntries.slice(0, 20).map((entry) => (
                  <Card key={entry.id} className="p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="font-medium">{formatDate(entry.entry_date)}</h4>
                          <Badge variant={entry.status === 'posted' ? 'default' : 'secondary'}>
                            {entry.status}
                          </Badge>
                          {entry.is_auto_generated && (
                            <Badge variant="outline">Auto</Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">{entry.narration}</p>
                      </div>
                    </div>

                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Account</TableHead>
                          <TableHead className="text-right">Debit</TableHead>
                          <TableHead className="text-right">Credit</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {entry.line_items?.map((item: any) => (
                          <TableRow key={item.id}>
                            <TableCell>{item.account_name}</TableCell>
                            <TableCell className="text-right">
                              {item.debit_amount > 0 ? formatCurrency(item.debit_amount) : '—'}
                            </TableCell>
                            <TableCell className="text-right">
                              {item.credit_amount > 0 ? formatCurrency(item.credit_amount) : '—'}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'trial_balance' && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Trial Balance</h3>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleExport('trial_balance')}
                disabled={exporting}
              >
                <Download className="mr-2 h-4 w-4" />
                Export CSV
              </Button>
            </div>

            <p className="text-center py-8 text-muted-foreground">
              Trial balance will be calculated from journal entries. Export as CSV to view in Excel.
            </p>
          </div>
        )}

        {activeTab === 'balance_sheet' && (
          <div>
            <h3 className="text-lg font-semibold mb-4">Balance Sheet</h3>

            {balanceSheet ? (
              <div className="space-y-6">
                <div className="grid md:grid-cols-2 gap-6">
                  <Card className="p-4">
                    <h4 className="font-semibold mb-3 text-green-600">Assets</h4>
                    <p className="text-2xl font-bold mb-4">
                      {formatCurrency(balanceSheet.total_assets)}
                    </p>
                    <div className="text-sm space-y-1">
                      <div className="flex justify-between">
                        <span>Current Assets:</span>
                        <span className="font-medium">
                          {formatCurrency(balanceSheet.data?.totals?.current_assets || 0)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>Non-Current Assets:</span>
                        <span className="font-medium">
                          {formatCurrency(balanceSheet.data?.totals?.non_current_assets || 0)}
                        </span>
                      </div>
                    </div>
                  </Card>

                  <Card className="p-4">
                    <h4 className="font-semibold mb-3 text-red-600">Liabilities & Equity</h4>
                    <p className="text-2xl font-bold mb-4">
                      {formatCurrency(balanceSheet.total_liabilities + balanceSheet.total_equity)}
                    </p>
                    <div className="text-sm space-y-1">
                      <div className="flex justify-between">
                        <span>Current Liabilities:</span>
                        <span className="font-medium">
                          {formatCurrency(balanceSheet.data?.totals?.current_liabilities || 0)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>Non-Current Liabilities:</span>
                        <span className="font-medium">
                          {formatCurrency(balanceSheet.data?.totals?.non_current_liabilities || 0)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>Equity:</span>
                        <span className="font-medium">
                          {formatCurrency(balanceSheet.total_equity)}
                        </span>
                      </div>
                    </div>
                  </Card>
                </div>

                <p className="text-sm text-muted-foreground text-center">
                  As of {formatDate(balanceSheet.as_of_date)}
                </p>
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <BarChart3 className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No balance sheet generated yet</p>
                <Button onClick={fetchReportsData} className="mt-4">
                  Generate Balance Sheet
                </Button>
              </div>
            )}
          </div>
        )}

        {activeTab === 'profit_loss' && (
          <div>
            <h3 className="text-lg font-semibold mb-4">Profit & Loss Statement</h3>

            {profitLoss ? (
              <div className="space-y-6">
                <div className="grid md:grid-cols-3 gap-6">
                  <Card className="p-4">
                    <h4 className="font-semibold mb-2 text-green-600">Revenue</h4>
                    <p className="text-2xl font-bold">
                      {formatCurrency(profitLoss.total_revenue)}
                    </p>
                  </Card>

                  <Card className="p-4">
                    <h4 className="font-semibold mb-2 text-red-600">Expenses</h4>
                    <p className="text-2xl font-bold">
                      {formatCurrency(profitLoss.total_expenses)}
                    </p>
                  </Card>

                  <Card className="p-4">
                    <h4 className="font-semibold mb-2 text-blue-600">Net Profit</h4>
                    <p className={`text-2xl font-bold ${profitLoss.net_profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {formatCurrency(profitLoss.net_profit)}
                    </p>
                  </Card>
                </div>

                <p className="text-sm text-muted-foreground text-center">
                  From {formatDate(profitLoss.start_date)} to {formatDate(profitLoss.end_date)}
                </p>
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <TrendingUp className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No P&L statement generated yet</p>
                <Button onClick={fetchReportsData} className="mt-4">
                  Generate P&L Statement
                </Button>
              </div>
            )}
          </div>
        )}
      </Card>
    </div>
  );
}
