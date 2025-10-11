import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";
import { Pie, PieChart, Cell, ResponsiveContainer, Tooltip, AreaChart, Area, XAxis, YAxis, CartesianGrid, Legend } from "recharts";

export default function ClientDashboard() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [clients, setClients] = useState<any[]>([]);
  const [clientId, setClientId] = useState<string | undefined>(undefined);
  const [documents, setDocuments] = useState<any[]>([]);
  const [records, setRecords] = useState<any[]>([]);
  const { toast } = useToast();

  useEffect(() => {
    init();
  }, []);

  useEffect(() => {
    const id = searchParams.get("clientId") || undefined;
    setClientId(id);
  }, [searchParams]);

  useEffect(() => {
    if (clientId) {
      fetchClientData(clientId);
    }
  }, [clientId]);

  const init = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: list } = await supabase
        .from("clients")
        .select("*")
        .eq("accountant_id", user.id)
        .order("business_name", { ascending: true });
      setClients(list || []);
      if (!searchParams.get("clientId") && (list || []).length > 0) {
        setSearchParams({ clientId: (list as any[])[0].id });
      }
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const fetchClientData = async (id: string) => {
    setLoading(true);
    try {
      const [{ data: docs }, { data: recs }] = await Promise.all([
        supabase.from("documents").select("*").eq("client_id", id).order("created_at", { ascending: false }),
        supabase.from("financial_records").select("*").eq("client_id", id).order("transaction_date", { ascending: false }),
      ]);
      setDocuments(docs || []);
      setRecords(recs || []);
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const totals = useMemo(() => {
    const income = records.filter(r => r.record_type === 'income').reduce((s, r) => s + Number(r.amount), 0);
    const expenses = records.filter(r => r.record_type === 'expense').reduce((s, r) => s + Number(r.amount), 0);
    const assets = records.filter(r => r.record_type === 'asset').reduce((s, r) => s + Number(r.amount), 0);
    const liabilities = records.filter(r => r.record_type === 'liability').reduce((s, r) => s + Number(r.amount), 0);
    return { income, expenses, assets, liabilities, net: income - expenses };
  }, [records]);

  const expenseByCategory = useMemo(() => {
    const map = new Map<string, number>();
    for (const r of records.filter(r => r.record_type === 'expense')) {
      const key = r.category || 'Other';
      map.set(key, (map.get(key) || 0) + Number(r.amount));
    }
    return Array.from(map.entries()).map(([name, value]) => ({ name, value }));
  }, [records]);

  const COLORS = ["#6366f1", "#f59e0b", "#10b981", "#ef4444", "#8b5cf6", "#06b6d4"]; 

  const monthlyTrend = useMemo(() => {
    const map = new Map<string, { income: number; expense: number }>();
    for (const r of records) {
      const d = new Date(r.transaction_date);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      if (!map.has(key)) map.set(key, { income: 0, expense: 0 });
      const bucket = map.get(key)!;
      if (r.record_type === 'income') bucket.income += Number(r.amount);
      if (r.record_type === 'expense') bucket.expense += Number(r.amount);
    }
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b)).map(([month, v]) => ({ month, ...v }));
  }, [records]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Client Dashboard</h1>
          <p className="text-muted-foreground">Preview your client's financial overview</p>
        </div>
        <div className="w-full sm:w-[280px]">
          <Select value={clientId} onValueChange={(v) => setSearchParams({ clientId: v })}>
            <SelectTrigger>
              <SelectValue placeholder="Select client" />
            </SelectTrigger>
            <SelectContent>
              {clients.map(c => (
                <SelectItem key={c.id} value={c.id}>{c.business_name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card className="p-6">
          <p className="text-sm text-muted-foreground">Total Assets</p>
          <p className="text-2xl font-bold mt-1">₹{totals.assets.toLocaleString()}</p>
        </Card>
        <Card className="p-6">
          <p className="text-sm text-muted-foreground">Total Liabilities</p>
          <p className="text-2xl font-bold mt-1">₹{totals.liabilities.toLocaleString()}</p>
        </Card>
        <Card className="p-6">
          <p className="text-sm text-muted-foreground">Income</p>
          <p className="text-2xl font-bold mt-1">₹{totals.income.toLocaleString()}</p>
        </Card>
        <Card className="p-6">
          <p className="text-sm text-muted-foreground">Net Profit</p>
          <p className="text-2xl font-bold mt-1">₹{totals.net.toLocaleString()}</p>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card className="p-6">
          <h3 className="font-semibold mb-4">Expense Breakdown</h3>
          <div className="h-64">
            <ResponsiveContainer>
              <PieChart>
                <Pie data={expenseByCategory} dataKey="value" nameKey="name" outerRadius={100} label>
                  {expenseByCategory.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </Card>
        <Card className="p-6">
          <h3 className="font-semibold mb-4">Income vs Expense (Monthly)</h3>
          <div className="h-64">
            <ResponsiveContainer>
              <AreaChart data={monthlyTrend}>
                <defs>
                  <linearGradient id="colorInc" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.4}/>
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorExp" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ef4444" stopOpacity={0.4}/>
                    <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Area type="monotone" dataKey="income" stroke="#10b981" fill="url(#colorInc)" />
                <Area type="monotone" dataKey="expense" stroke="#ef4444" fill="url(#colorExp)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      <Card>
        <div className="p-6">
          <h3 className="font-semibold mb-4">Recent Documents</h3>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>File</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Uploaded</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {documents.slice(0, 10).map(d => (
                <TableRow key={d.id}>
                  <TableCell className="truncate max-w-[240px]">{d.file_name}</TableCell>
                  <TableCell className="capitalize">{d.status}</TableCell>
                  <TableCell className="text-right">{new Date(d.created_at).toLocaleString()}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Card>
    </div>
  );
}
