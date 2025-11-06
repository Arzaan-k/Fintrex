import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Upload,
  Search,
  Filter,
  FileText,
  CheckCircle2,
  Clock,
  AlertCircle,
  Loader2,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { processDocument, extractInvoice } from "@/lib/backend";
import PageHeader from "@/components/PageHeader";

export default function Documents() {
  const [loading, setLoading] = useState(true);
  const [documents, setDocuments] = useState<any[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isUploadDialogOpen, setIsUploadDialogOpen] = useState(false);
  const [selectedClient, setSelectedClient] = useState("");
  const [uploading, setUploading] = useState(false);
  const [processingDocId, setProcessingDocId] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: clientsData } = await supabase
        .from("clients")
        .select("*")
        .eq("accountant_id", user.id);

      const { data: docsData } = await supabase
        .from("documents")
        .select("*, clients!inner(*)")
        .eq("clients.accountant_id", user.id)
        .order("created_at", { ascending: false });
      
      console.log('Documents fetched:', docsData); // Debug log

      setClients(clientsData || []);
      setDocuments(docsData || []);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleProcessDocument = async (doc: any) => {
    if (doc.status === "completed") return;
    setProcessingDocId(doc.id);
    try {
      console.log('🔄 Starting document processing for:', doc.id);
      
      // set status to processing
      await supabase.from("documents").update({ status: "processing" }).eq("id", doc.id);
      console.log('📝 Document status set to processing');

      // process via backend (or fallback simulation)
      console.log('⚙️ Calling processDocument function...');
      const { extracted, suggestion } = await processDocument({ id: doc.id, file_name: doc.file_name });
      console.log('✅ Document processed. Extracted data:', { extracted, suggestion });

      // update document with extracted data and mark completed
      await supabase
        .from("documents")
        .update({ status: "completed", extracted_data: extracted, updated_at: new Date().toISOString() })
        .eq("id", doc.id);
      console.log('💾 Document updated with extracted data');

      // create financial record
      console.log('💰 Creating financial record with data:', {
        client_id: doc.client_id,
        document_id: doc.id,
        record_type: suggestion.record_type,
        amount: suggestion.amount,
        description: suggestion.description,
        category: suggestion.category,
        transaction_date: suggestion.transaction_date,
      });
      await supabase.from("financial_records").insert({
        client_id: doc.client_id,
        document_id: doc.id,
        record_type: suggestion.record_type,
        amount: suggestion.amount,
        description: suggestion.description,
        category: suggestion.category,
        transaction_date: suggestion.transaction_date,
      });
      console.log('✅ Financial record created');

      // derive invoice from extracted data and upsert into invoices table
      try {
        console.log('🧾 Creating invoice record...');
        const { invoice } = await extractInvoice(extracted);
        const sb = supabase as any;

        // Only create invoice records for sales/purchase documents
        if (invoice.invoice_type === 'sales' || invoice.invoice_type === 'purchase') {
          await sb.from("invoices").insert({
            document_id: doc.id,
            client_id: doc.client_id,
            invoice_type: invoice.invoice_type,
            invoice_number: invoice.invoice_number,
            invoice_date: invoice.invoice_date,
            due_date: invoice.due_date || null,
            vendor_name: invoice.vendor_name,
            vendor_gstin: invoice.vendor_gstin,
            customer_name: invoice.customer_name,
            customer_gstin: invoice.customer_gstin,
            line_items: invoice.line_items,
            tax_details: invoice.tax_details,
            total_amount: invoice.total_amount,
            currency: invoice.currency || "INR",
            payment_status: invoice.payment_status || "unpaid",
          });
          console.log('✅ Invoice record created');
        } else {
          console.log('ℹ️ Skipping invoice creation - not a sales/purchase document');
        }
      } catch (e) {
        // Non-fatal: continue even if invoice insert fails
        console.error("Invoice creation failed - continuing without invoice record:", e.message);
        console.log("💡 Financial records were created successfully");
      }

      // increment client's completed_documents (read-modify-write)
      {
        console.log('📈 Updating client document count...');
        const { data: clientRow } = await supabase
          .from("clients")
          .select("completed_documents")
          .eq("id", doc.client_id)
          .single();
        const current = clientRow?.completed_documents || 0;
        await supabase
          .from("clients")
          .update({ completed_documents: current + 1 })
          .eq("id", doc.client_id);
        console.log('✅ Client document count updated');
      }

      toast({ title: "Processed", description: "Document processed and financial record created." });
      fetchData();
    } catch (error: any) {
      console.error('❌ Document processing failed:', error);
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setProcessingDocId(null);
    }
  };

  const handleFileUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    const fileInput = document.getElementById("file-upload") as HTMLInputElement;
    const file = fileInput?.files?.[0];

    if (!file || !selectedClient) {
      toast({
        title: "Error",
        description: "Please select a client and file",
        variant: "destructive",
      });
      return;
    }

    setUploading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const filePath = `${user.id}/${Date.now()}_${file.name}`;
      const { error: uploadError } = await supabase.storage
        .from("documents")
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { error: dbError } = await supabase.from("documents").insert({
        client_id: selectedClient,
        file_name: file.name,
        file_path: filePath,
        file_type: file.type,
        file_size: file.size,
      });

      if (dbError) throw dbError;

      // increment client's total_documents counter using read-modify-write
      {
        const { data: clientRow } = await supabase
          .from("clients")
          .select("total_documents")
          .eq("id", selectedClient)
          .single();
        const current = clientRow?.total_documents || 0;
        await supabase
          .from("clients")
          .update({ total_documents: current + 1 })
          .eq("id", selectedClient);
      }

      toast({
        title: "Success",
        description: "Document uploaded successfully",
      });

      setIsUploadDialogOpen(false);
      setSelectedClient("");
      fetchData();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "completed":
        return CheckCircle2;
      case "processing":
        return Clock;
      default:
        return AlertCircle;
    }
  };

  const getStatusVariant = (status: string) => {
    switch (status) {
      case "completed":
        return "default";
      case "processing":
        return "secondary";
      default:
        return "outline";
    }
  };

  const filteredDocuments = documents.filter((doc) =>
    doc.file_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    doc.clients?.business_name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const stats = {
    total: documents.length,
    completed: documents.filter(d => d.status === "completed").length,
    processing: documents.filter(d => d.status === "processing").length,
    pending: documents.filter(d => d.status === "pending").length,
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
        title="Documents"
        subtitle="Manage and process client documents"
        actions={
          <Dialog open={isUploadDialogOpen} onOpenChange={setIsUploadDialogOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Upload className="h-4 w-4" />
                Upload Document
              </Button>
            </DialogTrigger>
            <DialogContent>
              <form onSubmit={handleFileUpload}>
                <DialogHeader>
                  <DialogTitle>Upload Document</DialogTitle>
                  <DialogDescription>
                    Select a client and upload their document
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="client">Client *</Label>
                    <Select value={selectedClient} onValueChange={setSelectedClient} required>
                      <SelectTrigger>
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
                  <div className="space-y-2">
                    <Label htmlFor="file-upload">Document *</Label>
                    <Input
                      id="file-upload"
                      type="file"
                      accept=".pdf,.jpg,.jpeg,.png"
                      required
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button type="submit" disabled={uploading}>
                    {uploading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Upload
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        }
      />

      <div className="grid gap-4 md:grid-cols-4">
        <Card className="p-4">
          <p className="text-sm text-muted-foreground">Total Documents</p>
          <p className="text-2xl font-bold mt-1">{stats.total}</p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-muted-foreground">Completed</p>
          <p className="text-2xl font-bold mt-1 text-secondary">{stats.completed}</p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-muted-foreground">Processing</p>
          <p className="text-2xl font-bold mt-1 text-warning">{stats.processing}</p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-muted-foreground">Pending</p>
          <p className="text-2xl font-bold mt-1 text-destructive">{stats.pending}</p>
        </Card>
      </div>

      <Card className="p-4">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search documents..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>
      </Card>

      {filteredDocuments.length === 0 ? (
        <Card className="p-12 text-center">
          <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p className="text-muted-foreground">No documents found</p>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {filteredDocuments.map((doc) => {
            const StatusIcon = getStatusIcon(doc.status);
            return (
              <Card key={doc.id} className="p-6 hover:shadow-lg transition-shadow">
                <div className="flex items-start gap-4">
                  <div className="p-3 rounded-lg bg-muted">
                    <FileText className="h-6 w-6 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold truncate mb-1">{doc.file_name}</h3>
                    <p className="text-sm text-muted-foreground mb-3">
                      {doc.clients?.business_name}
                    </p>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground mb-3">
                      <span>{(doc.file_size / 1024 / 1024).toFixed(2)} MB</span>
                      <span>{new Date(doc.created_at).toLocaleDateString()}</span>
                    </div>
                    <Badge variant={getStatusVariant(doc.status)} className="gap-1">
                      <StatusIcon className="h-3 w-3" />
                      {doc.status.charAt(0).toUpperCase() + doc.status.slice(1)}
                    </Badge>
                    <div className="mt-4">
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => handleProcessDocument(doc)}
                        disabled={processingDocId === doc.id || doc.status === "completed"}
                      >
                        {processingDocId === doc.id ? (
                          <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Processing...</>
                        ) : (
                          <>Process</>
                        )}
                      </Button>
                    </div>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
