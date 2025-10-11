import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Upload, CheckCircle2, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export default function KYCPanel({ clientId, open, onOpenChange }: { clientId: string; open: boolean; onOpenChange: (v: boolean) => void; }) {
  const [loading, setLoading] = useState(true);
  const [checklist, setChecklist] = useState<any[]>([]);
  const [types, setTypes] = useState<any[]>([]);
  const [uploading, setUploading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (open && clientId) fetchData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, clientId]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const sb = supabase as any;
      const [{ data: t }, { data: c }] = await Promise.all([
        sb.from("kyc_document_types").select("*").order("name", { ascending: true }),
        sb.from("kyc_checklists").select("*").eq("client_id", clientId),
      ]);
      setTypes(t || []);
      setChecklist(c || []);
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const ensureChecklist = async () => {
    // Seed checklist with all required types not present
    const existingCodes = new Set(checklist.map((i) => i.type_code));
    const toInsert = types
      .filter((t) => !existingCodes.has(t.code))
      .map((t) => ({ client_id: clientId, type_code: t.code, required: true }));
    if (toInsert.length > 0) {
      const sb = supabase as any;
      const { error } = await sb.from("kyc_checklists").insert(toInsert);
      if (error) throw error;
      await fetchData();
    }
  };

  const handleUpload = async (typeCode: string) => {
    const input = document.getElementById(`kyc-file-${typeCode}`) as HTMLInputElement;
    const file = input?.files?.[0];
    if (!file) {
      toast({ title: "Select a file", description: "Please choose a document to upload", variant: "destructive" });
      return;
    }
    setUploading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");
      const path = `${user.id}/kyc/${clientId}/${Date.now()}_${file.name}`;
      const { error: upErr } = await supabase.storage.from("documents").upload(path, file);
      if (upErr) throw upErr;
      const sb = supabase as any;
      const { error: insErr } = await sb.from("kyc_documents").insert({
        client_id: clientId,
        type_code: typeCode,
        file_path: path,
        file_name: file.name,
        file_size: file.size,
        status: "pending",
      });
      if (insErr) throw insErr;
      const { error: updErr } = await sb
        .from("kyc_checklists")
        .update({ status: "received" })
        .eq("client_id", clientId)
        .eq("type_code", typeCode);
      if (updErr) throw updErr;
      toast({ title: "Uploaded", description: `${file.name} uploaded` });
      await fetchData();
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>KYC Checklist</DialogTitle>
        </DialogHeader>
        {loading ? (
          <div className="py-10 flex items-center justify-center"><Loader2 className="h-6 w-6 animate-spin" /></div>
        ) : (
          <div className="space-y-4">
            <Card className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Initialize checklist with common types</p>
                </div>
                <Button variant="secondary" onClick={ensureChecklist}>Ensure Checklist</Button>
              </div>
            </Card>
            <Card>
              <div className="p-4">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Document</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Upload</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {types.map((t) => {
                      const item = checklist.find((c) => c.type_code === t.code);
                      const status = item?.status || "pending";
                      return (
                        <TableRow key={t.code}>
                          <TableCell className="font-medium">{t.name}</TableCell>
                          <TableCell>
                            <Badge variant={status === "verified" ? "default" : status === "received" ? "secondary" : "outline"} className="gap-1">
                              {status === "verified" && <CheckCircle2 className="h-3 w-3" />} {status.charAt(0).toUpperCase() + status.slice(1)}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-2">
                              <Label htmlFor={`kyc-file-${t.code}`} className="sr-only">Upload</Label>
                              <Input id={`kyc-file-${t.code}`} type="file" accept=".pdf,.jpg,.jpeg,.png" className="max-w-xs" />
                              <Button size="sm" onClick={() => handleUpload(t.code)} disabled={uploading}>
                                {uploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
                                Upload
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </Card>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
