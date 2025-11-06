import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import DashboardLayout from "./components/DashboardLayout";
import Dashboard from "./pages/Dashboard";
import Clients from "./pages/Clients";
import Documents from "./pages/Documents";
import Financials from "./pages/Financials";
import Invoices from "./pages/Invoices";
import GSTReports from "./pages/GSTReports";
import Auth from "./pages/Auth";
import ProtectedRoute from "./components/ProtectedRoute";
import NotFound from "./pages/NotFound";
import Admin from "./pages/Admin";
import ClientDashboard from "./pages/ClientDashboard";
import Settings from "./pages/Settings";
import OCRTest from "./pages/OCRTest";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/auth" element={<Auth />} />
          <Route path="/" element={<ProtectedRoute><DashboardLayout /></ProtectedRoute>}>
            <Route index element={<Dashboard />} />
            <Route path="clients" element={<Clients />} />
            <Route path="documents" element={<Documents />} />
            <Route path="invoices" element={<Invoices />} />
            <Route path="financials" element={<Financials />} />
            <Route path="gst-reports" element={<GSTReports />} />
            <Route path="settings" element={<Settings />} />
            <Route path="admin" element={<Admin />} />
            <Route path="client-dashboard" element={<ClientDashboard />} />
            <Route path="ocr-test" element={<OCRTest />} />
          </Route>
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
