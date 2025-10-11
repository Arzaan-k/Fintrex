import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Users, 
  FileText, 
  TrendingUp, 
  Clock,
  ArrowUpRight,
  AlertCircle,
  DollarSign,
  Loader2
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";

export default function Dashboard() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalClients: 0,
    documentsProcessed: 0,
    pendingReviews: 0,
    monthlyRevenue: 0
  });
  const [recentClients, setRecentClients] = useState<any[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { count: clientsCount } = await supabase
        .from("clients")
        .select("*", { count: "exact", head: true })
        .eq("accountant_id", user.id);

      const { count: docsCount } = await supabase
        .from("documents")
        .select("*, clients!inner(*)", { count: "exact", head: true })
        .eq("clients.accountant_id", user.id);

      const { count: pendingCount } = await supabase
        .from("documents")
        .select("*, clients!inner(*)", { count: "exact", head: true })
        .eq("clients.accountant_id", user.id)
        .eq("status", "pending");

      const { data: clients } = await supabase
        .from("clients")
        .select("*")
        .eq("accountant_id", user.id)
        .order("created_at", { ascending: false })
        .limit(3);

      setStats({
        totalClients: clientsCount || 0,
        documentsProcessed: docsCount || 0,
        pendingReviews: pendingCount || 0,
        monthlyRevenue: 240000
      });

      setRecentClients(clients || []);
    } catch (error) {
      console.error("Error fetching dashboard data:", error);
    } finally {
      setLoading(false);
    }
  };

  const getCompletionPercentage = (client: any) => {
    if (client.total_documents === 0) return 0;
    return Math.round((client.completed_documents / client.total_documents) * 100);
  };

  const formatStatus = (status: string) => {
    return status.split("_").map(word => 
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join(" ");
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const statsData = [
    {
      name: "Total Clients",
      value: stats.totalClients.toString(),
      change: "+12%",
      trend: "up",
      icon: Users,
      color: "text-primary",
    },
    {
      name: "Documents Processed",
      value: stats.documentsProcessed.toString(),
      change: "+18%",
      trend: "up",
      icon: FileText,
      color: "text-secondary",
    },
    {
      name: "Pending Reviews",
      value: stats.pendingReviews.toString(),
      change: "-5%",
      trend: "down",
      icon: Clock,
      color: "text-warning",
    },
    {
      name: "Monthly Revenue",
      value: `₹${(stats.monthlyRevenue / 1000).toFixed(1)}L`,
      change: "+24%",
      trend: "up",
      icon: DollarSign,
      color: "text-secondary",
    },
  ];

  return (
    <div className="space-y-6">
      <div className="bg-gradient-primary rounded-xl p-6 text-sidebar-foreground shadow-lg">
        <h1 className="text-3xl font-bold mb-2">Welcome back!</h1>
        <p className="text-sidebar-foreground/90">
          Here's what's happening with your practice today
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        {statsData.map((stat) => {
          const Icon = stat.icon;
          return (
            <Card key={stat.name} className="p-6 hover:shadow-lg transition-shadow">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <p className="text-sm font-medium text-muted-foreground">
                    {stat.name}
                  </p>
                  <p className="text-2xl font-bold">{stat.value}</p>
                </div>
                <div className={`p-3 rounded-full bg-muted ${stat.color}`}>
                  <Icon className="h-6 w-6" />
                </div>
              </div>
              <div className="mt-4 flex items-center gap-2">
                <span
                  className={`text-sm font-medium ${
                    stat.trend === "up" ? "text-secondary" : "text-destructive"
                  }`}
                >
                  {stat.change}
                </span>
                <span className="text-sm text-muted-foreground">vs last month</span>
              </div>
            </Card>
          );
        })}
      </div>

      <Card className="p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold">Recent Clients</h2>
          <Button variant="ghost" size="sm" onClick={() => navigate("/clients")}>
            View All
            <ArrowUpRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
        
        {recentClients.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No clients yet. Add your first client to get started!</p>
            <Button onClick={() => navigate("/clients")} className="mt-4">
              Add Client
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {recentClients.map((client) => {
              const completion = getCompletionPercentage(client);
              return (
                <div
                  key={client.id}
                  className="flex items-center justify-between p-4 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-medium">{client.business_name}</h3>
                      <Badge
                        variant={
                          client.status === "active"
                            ? "default"
                            : client.status === "kyc_pending"
                            ? "secondary"
                            : "outline"
                        }
                      >
                        {formatStatus(client.status)}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <span>Documents: {client.completed_documents}/{client.total_documents}</span>
                      <div className="flex items-center gap-1">
                        <div className="w-24 h-1.5 bg-muted rounded-full overflow-hidden">
                          <div
                            className="h-full bg-secondary rounded-full transition-all"
                            style={{ width: `${completion}%` }}
                          />
                        </div>
                        <span>{completion}%</span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      <Card className="p-6">
        <h2 className="text-xl font-semibold mb-4">Quick Actions</h2>
        <div className="grid gap-4 md:grid-cols-3">
          <Button className="h-auto flex-col gap-2 py-6" onClick={() => navigate("/clients")}>
            <Users className="h-6 w-6" />
            <span>Add New Client</span>
          </Button>
          <Button variant="secondary" className="h-auto flex-col gap-2 py-6" onClick={() => navigate("/documents")}>
            <FileText className="h-6 w-6" />
            <span>Upload Documents</span>
          </Button>
          <Button variant="outline" className="h-auto flex-col gap-2 py-6" onClick={() => navigate("/financials")}>
            <TrendingUp className="h-6 w-6" />
            <span>Generate Report</span>
          </Button>
        </div>
      </Card>
    </div>
  );
}
