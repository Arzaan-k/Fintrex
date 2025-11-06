import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Download, TrendingUp, TrendingDown, Loader2, Calendar, FileText, DollarSign } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import BalanceSheet from "@/components/BalanceSheet";
import ProfitLossStatement from "@/components/ProfitLossStatement";
import { generateSimpleBalanceSheet, generateProfitLoss, calculateFinancialMetrics, formatINR } from "@/lib/financial";
import PageHeader from "@/components/PageHeader";

export default function Financials() {
  const [loading, setLoading] = useState(true);
  const [clients, setClients] = useState<any[]>([]);
  const [selectedClient, setSelectedClient] = useState<string>("");
  const [records, setRecords] = useState<any[]>([]);
  const [selectedPeriod, setSelectedPeriod] = useState("current-month");
  const { toast } = useToast();

  useEffect(() => {
    fetchClients();
  }, []);

  useEffect(() => {
    if (selectedClient) {
      fetchFinancialRecords();
    }
  }, [selectedClient]);

  const fetchClients = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from("clients")
        .select("*")
        .eq("accountant_id", user.id)
        .eq("status", "active")
        .order("business_name");

      if (error) throw error;
      setClients(data || []);
      
      if (data && data.length > 0) {
        setSelectedClient(data[0].id);
      }
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const fetchFinancialRecords = async () => {
    try {
      const { data, error } = await supabase
        .from("financial_records")
        .select("*")
        .eq("client_id", selectedClient)
        .order("transaction_date", { ascending: false });

      if (error) throw error;
      console.log('Financial records fetched:', data); // Debug log
      setRecords(data || []);
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const getDateRange = () => {
    const now = new Date();
    let startDate = new Date();
    let endDate = new Date();

    switch (selectedPeriod) {
      case "current-month":
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
      case "last-month":
        startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        endDate = new Date(now.getFullYear(), now.getMonth(), 0);
        break;
      case "current-quarter":
        const quarter = Math.floor(now.getMonth() / 3);
        startDate = new Date(now.getFullYear(), quarter * 3, 1);
        break;
      case "current-year":
        startDate = new Date(now.getFullYear(), 0, 1);
        break;
      case "last-year":
        startDate = new Date(now.getFullYear() - 1, 0, 1);
        endDate = new Date(now.getFullYear() - 1, 11, 31);
        break;
    }

    return { startDate, endDate };
  };

  const selectedClientData = clients.find(c => c.id === selectedClient);
  const { startDate, endDate } = getDateRange();
  
  const balanceSheetData = generateSimpleBalanceSheet(records, endDate);
  const profitLossData = generateProfitLoss(records, startDate, endDate);
  const metrics = calculateFinancialMetrics(records, startDate, endDate);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (clients.length === 0) {
    return (
      <Card className="p-12 text-center">
        <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
        <p className="text-muted-foreground mb-4">No active clients found</p>
        <Button onClick={() => window.location.href = "/clients"}>Add Client</Button>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Financial Statements"
        subtitle="View balance sheets, P&L, and cash flow statements"
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline">
              <Calendar className="mr-2 h-4 w-4" />
              Custom Date Range
            </Button>
            <Button>
              <FileText className="mr-2 h-4 w-4" />
              Generate Report
            </Button>
          </div>
        }
      />

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="client-select">Select Client</Label>
          <Select value={selectedClient} onValueChange={setSelectedClient}>
            <SelectTrigger id="client-select">
              <SelectValue placeholder="Choose a client" />
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
        <div className="space-y-2">
          <Label htmlFor="period-select">Period</Label>
          <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
            <SelectTrigger id="period-select">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="current-month">Current Month</SelectItem>
              <SelectItem value="last-month">Last Month</SelectItem>
              <SelectItem value="current-quarter">Current Quarter</SelectItem>
              <SelectItem value="current-year">Current Year</SelectItem>
              <SelectItem value="last-year">Last Year</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <DollarSign className="h-5 w-5 text-secondary" />
            <div>
              <p className="text-sm text-muted-foreground">Total Revenue</p>
              <p className="text-xl font-bold">{formatINR(metrics.totalRevenue)}</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <TrendingUp className="h-5 w-5 text-destructive" />
            <div>
              <p className="text-sm text-muted-foreground">Total Expenses</p>
              <p className="text-xl font-bold">{formatINR(metrics.totalExpenses)}</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <TrendingUp className={`h-5 w-5 ${metrics.netProfit >= 0 ? 'text-secondary' : 'text-destructive'}`} />
            <div>
              <p className="text-sm text-muted-foreground">Net Profit</p>
              <p className={`text-xl font-bold ${metrics.netProfit >= 0 ? 'text-secondary' : 'text-destructive'}`}>
                {formatINR(metrics.netProfit)}
              </p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <FileText className="h-5 w-5 text-primary" />
            <div>
              <p className="text-sm text-muted-foreground">Net Worth</p>
              <p className="text-xl font-bold">{formatINR(metrics.netWorth)}</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Financial Statements */}
      <Tabs defaultValue="balance-sheet" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="balance-sheet">Balance Sheet</TabsTrigger>
          <TabsTrigger value="profit-loss">Profit & Loss</TabsTrigger>
          <TabsTrigger value="cash-flow">Cash Flow</TabsTrigger>
        </TabsList>

        <TabsContent value="balance-sheet" className="mt-6">
          <BalanceSheet
            clientName={selectedClientData?.business_name || ""}
            asOfDate={endDate}
            data={balanceSheetData}
            status="draft"
          />
        </TabsContent>

        <TabsContent value="profit-loss" className="mt-6">
          <ProfitLossStatement
            clientName={selectedClientData?.business_name || ""}
            startDate={startDate}
            endDate={endDate}
            data={profitLossData}
            status="draft"
          />
        </TabsContent>

        <TabsContent value="cash-flow" className="mt-6">
          <Card className="p-6">
            <h2 className="text-2xl font-bold mb-4">Cash Flow Statement</h2>
            <p className="text-muted-foreground">
              Cash flow statement generation is coming soon. This will show cash inflows and outflows from operating, investing, and financing activities.
            </p>
          </Card>
        </TabsContent>
      </Tabs>

      {records.length === 0 && (
        <Card className="p-8 text-center">
          <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p className="text-muted-foreground mb-4">No financial records found for this client</p>
          <p className="text-sm text-muted-foreground">Upload and process documents to generate financial statements</p>
          <Button className="mt-4" onClick={() => window.location.href = "/documents"}>
            Upload Documents
          </Button>
        </Card>
      )}
    </div>
  );
}
