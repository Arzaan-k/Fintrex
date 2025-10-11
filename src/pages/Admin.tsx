import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, Activity, Users, FileText, TrendingUp } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import PageHeader from "@/components/PageHeader";

export default function Admin() {
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [metrics, setMetrics] = useState({
    totalClients: 0,
    totalDocuments: 0,
    totalFinancialRecords: 0,
    approxAccountants: 0,
  });
  const [recentDocuments, setRecentDocuments] = useState<any[]>([]);
  const { toast } = useToast();

  useEffect(() => {
    init();
  }, []);

  const init = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      // Check admin role
      const { data: roles, error: roleError } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id);
      if (roleError) throw roleError;
      const admin = (roles || []).some(r => r.role === "admin");
      setIsAdmin(admin);
      if (!admin) {
        setLoading(false);
        return;
      }

      // Counts accessible to admin per RLS policies
      const [{ count: clientsCount }, { count: docsCount }, { count: finCount }] = await Promise.all([
        supabase.from("clients").select("id", { count: "exact", head: true }),
        supabase.from("documents").select("id", { count: "exact", head: true }),
        supabase.from("financial_records").select("id", { count: "exact", head: true }),
      ]);

      // Approx accountants: distinct accountant_id from clients
      const { data: clientOwners, error: ownersErr } = await supabase
        .from("clients")
        .select("accountant_id")
        .limit(2000);
      if (ownersErr) throw ownersErr;
      const approxAccountants = new Set((clientOwners || []).map((c: any) => c.accountant_id)).size;

      const { data: docs } = await supabase
        .from("documents")
        .select("id, file_name, status, created_at, clients(business_name)")
        .order("created_at", { ascending: false })
        .limit(10);

      setMetrics({
        totalClients: clientsCount || 0,
        totalDocuments: docsCount || 0,
        totalFinancialRecords: finCount || 0,
        approxAccountants,
      });
      setRecentDocuments(docs || []);
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <Card className="p-8 text-center">
        <Activity className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
        <p className="text-muted-foreground">You don't have access to the Admin Dashboard.</p>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Admin Dashboard"
        subtitle="Platform-wide metrics and recent activity"
      />

      <div className="grid gap-4 md:grid-cols-4">
        <Card className="p-6">
          <div className="flex items-center gap-3">
            <Users className="h-5 w-5 text-primary" />
            <div>
              <p className="text-sm text-muted-foreground">Total Clients</p>
              <p className="text-2xl font-bold">{metrics.totalClients}</p>
            </div>
          </div>
        </Card>
        <Card className="p-6">
          <div className="flex items-center gap-3">
            <FileText className="h-5 w-5 text-primary" />
            <div>
              <p className="text-sm text-muted-foreground">Documents</p>
              <p className="text-2xl font-bold">{metrics.totalDocuments}</p>
            </div>
          </div>
        </Card>
        <Card className="p-6">
          <div className="flex items-center gap-3">
            <TrendingUp className="h-5 w-5 text-primary" />
            <div>
              <p className="text-sm text-muted-foreground">Financial Records</p>
              <p className="text-2xl font-bold">{metrics.totalFinancialRecords}</p>
            </div>
          </div>
        </Card>
        <Card className="p-6">
          <div className="flex items-center gap-3">
            <Users className="h-5 w-5 text-secondary" />
            <div>
              <p className="text-sm text-muted-foreground">Approx. Accountants</p>
              <p className="text-2xl font-bold">{metrics.approxAccountants}</p>
            </div>
          </div>
        </Card>
      </div>

      <Card>
        <div className="p-6">
          <h2 className="text-xl font-semibold mb-4">Recent Documents</h2>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>File</TableHead>
                <TableHead>Client</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Uploaded</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(recentDocuments || []).map((d) => (
                <TableRow key={d.id}>
                  <TableCell className="font-medium truncate max-w-[240px]">{d.file_name}</TableCell>
                  <TableCell>{d.clients?.business_name || "-"}</TableCell>
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
