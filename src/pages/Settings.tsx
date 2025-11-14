import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { 
  Phone, 
  Mail, 
  Building2, 
  Palette, 
  Bell, 
  Shield,
  Loader2,
  Check,
  Copy,
  Info
} from "lucide-react";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert";

export default function Settings() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  // Profile & Contact Settings
  const [profile, setProfile] = useState({
    full_name: "",
    firm_name: "",
    ca_registration_number: "",
    phone_number: "",
    whatsapp_number: "",
    email: "",
    address: "",
    city: "",
    state: "",
    pincode: ""
  });

  // Email Integration
  const [emailConfig, setEmailConfig] = useState({
    enabled: false,
    provider: "gmail" as "gmail" | "outlook" | "custom",
    custom_email: "",
    smtp_host: "",
    smtp_port: "587",
    smtp_username: "",
    smtp_password: "",
    imap_host: "",
    imap_port: "993"
  });

  // Branding
  const [branding, setBranding] = useState({
    logo_url: "",
    primary_color: "#3b82f6",
    greeting_message: "Hello! Welcome to our accounting services. Send us your documents and we'll process them automatically.",
    acknowledgment_message: "✅ Document received! We're processing it now. You'll be notified once it's ready."
  });

  // Notifications
  const [notifications, setNotifications] = useState({
    email_new_document: true,
    email_processing_complete: true,
    email_kyc_complete: true,
    email_weekly_summary: true,
    whatsapp_enabled: false
  });

  // Automation Settings
  const [automation, setAutomation] = useState({
    auto_process_documents: true,
    auto_create_journal_entries: true,
    auto_send_acknowledgments: true,
    require_manual_review: false,
    confidence_threshold: 0.85
  });

  const [dedicatedEmail, setDedicatedEmail] = useState("");
  const [webhookUrl, setWebhookUrl] = useState("");

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Load profile
      const { data: profileData, error: profileError } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .maybeSingle();

      if (profileError) throw profileError;

      if (profileData) {
        setProfile({
          full_name: profileData.full_name || "",
          firm_name: profileData.firm_name || "",
          ca_registration_number: profileData.ca_registration_number || "",
          phone_number: profileData.phone_number || "",
          whatsapp_number: profileData.whatsapp_number || "",
          email: user.email || "",
          address: profileData.address || "",
          city: profileData.city || "",
          state: profileData.state || "",
          pincode: profileData.pincode || ""
        });

        // Generate dedicated email and webhook
        const firmSlug = (profileData.firm_name || user.email?.split('@')[0] || 'accountant')
          .toLowerCase()
          .replace(/[^a-z0-9]/g, '');
        setDedicatedEmail(`${firmSlug}-${user.id.slice(0, 8)}@fintrex.email`);
        setWebhookUrl(`${window.location.origin}/api/whatsapp-webhook/${user.id}`);

        // Load settings from metadata or separate table
        const settings = profileData.settings || {};
        if (settings.email_config) setEmailConfig({ ...emailConfig, ...settings.email_config });
        if (settings.branding) setBranding({ ...branding, ...settings.branding });
        if (settings.notifications) setNotifications({ ...notifications, ...settings.notifications });
        if (settings.automation) setAutomation({ ...automation, ...settings.automation });
      }
    } catch (error: any) {
      console.error("Error loading settings:", error);
      toast({
        title: "Error",
        description: "Failed to load settings",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const saveSettings = async () => {
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Update profile
      const { error: profileError } = await supabase
        .from("profiles")
        .update({
          full_name: profile.full_name,
          firm_name: profile.firm_name,
          ca_registration_number: profile.ca_registration_number,
          phone_number: profile.phone_number,
          whatsapp_number: profile.whatsapp_number,
          address: profile.address,
          city: profile.city,
          state: profile.state,
          pincode: profile.pincode,
          settings: {
            email_config: emailConfig,
            branding: branding,
            notifications: notifications,
            automation: automation
          }
        })
        .eq("id", user.id);

      if (profileError) throw profileError;

      toast({
        title: "Success",
        description: "Settings saved successfully"
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setSaving(false);
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copied!",
      description: `${label} copied to clipboard`
    });
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
      <div>
        <h1 className="text-3xl font-bold">Settings</h1>
        <p className="text-muted-foreground">Configure your account and automation preferences</p>
      </div>

      <Tabs defaultValue="profile" className="w-full">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="communication">Communication</TabsTrigger>
          <TabsTrigger value="branding">Branding</TabsTrigger>
          <TabsTrigger value="automation">Automation</TabsTrigger>
          <TabsTrigger value="notifications">Notifications</TabsTrigger>
        </TabsList>

        {/* Profile & Contact Tab */}
        <TabsContent value="profile" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5" />
                Professional Information
              </CardTitle>
              <CardDescription>
                Your professional details and firm information
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="full_name">Full Name *</Label>
                  <Input
                    id="full_name"
                    value={profile.full_name}
                    onChange={(e) => setProfile({ ...profile, full_name: e.target.value })}
                    placeholder="CA John Doe"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="firm_name">Firm Name *</Label>
                  <Input
                    id="firm_name"
                    value={profile.firm_name}
                    onChange={(e) => setProfile({ ...profile, firm_name: e.target.value })}
                    placeholder="Doe & Associates"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="ca_registration">CA Registration Number</Label>
                  <Input
                    id="ca_registration"
                    value={profile.ca_registration_number}
                    onChange={(e) => setProfile({ ...profile, ca_registration_number: e.target.value })}
                    placeholder="123456"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">Email Address</Label>
                  <Input
                    id="email"
                    type="email"
                    value={profile.email}
                    disabled
                    className="bg-muted"
                  />
                  <p className="text-xs text-muted-foreground">
                    Email cannot be changed here. Contact support to update.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Phone className="h-5 w-5" />
                Contact Information
              </CardTitle>
              <CardDescription>
                Phone numbers used for client identification
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="phone_number">Phone Number</Label>
                  <Input
                    id="phone_number"
                    value={profile.phone_number}
                    onChange={(e) => setProfile({ ...profile, phone_number: e.target.value })}
                    placeholder="+91 9876543210"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="whatsapp_number">WhatsApp Business Number *</Label>
                  <Input
                    id="whatsapp_number"
                    value={profile.whatsapp_number}
                    onChange={(e) => setProfile({ ...profile, whatsapp_number: e.target.value })}
                    placeholder="+91 9876543210"
                  />
                  <p className="text-xs text-muted-foreground">
                    This number receives documents from clients
                  </p>
                </div>
              </div>

              <Alert>
                <Info className="h-4 w-4" />
                <AlertTitle>Important: WhatsApp Number</AlertTitle>
                <AlertDescription>
                  Clients will send documents to this WhatsApp number. Make sure this is a valid WhatsApp Business number connected to our system.
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Office Address</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="address">Street Address</Label>
                <Textarea
                  id="address"
                  value={profile.address}
                  onChange={(e) => setProfile({ ...profile, address: e.target.value })}
                  placeholder="123 Main Street"
                  rows={2}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="city">City</Label>
                  <Input
                    id="city"
                    value={profile.city}
                    onChange={(e) => setProfile({ ...profile, city: e.target.value })}
                    placeholder="Mumbai"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="state">State</Label>
                  <Input
                    id="state"
                    value={profile.state}
                    onChange={(e) => setProfile({ ...profile, state: e.target.value })}
                    placeholder="Maharashtra"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="pincode">Pincode</Label>
                  <Input
                    id="pincode"
                    value={profile.pincode}
                    onChange={(e) => setProfile({ ...profile, pincode: e.target.value })}
                    placeholder="400001"
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Communication Tab */}
        <TabsContent value="communication" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Phone className="h-5 w-5" />
                WhatsApp Integration
              </CardTitle>
              <CardDescription>
                Configure your WhatsApp Business API for document reception
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Alert>
                <Info className="h-4 w-4" />
                <AlertTitle>Your Dedicated WhatsApp Number</AlertTitle>
                <AlertDescription>
                  <div className="mt-2 space-y-2">
                    <div className="flex items-center gap-2">
                      <code className="px-2 py-1 bg-muted rounded text-sm flex-1">
                        {profile.whatsapp_number || "Not configured"}
                      </code>
                      {profile.whatsapp_number && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => copyToClipboard(profile.whatsapp_number, "WhatsApp number")}
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                    <p className="text-xs">
                      Share this number with your clients for document submission
                    </p>
                  </div>
                </AlertDescription>
              </Alert>

              <div className="space-y-2">
                <Label>Webhook URL (for WhatsApp Business API)</Label>
                <div className="flex items-center gap-2">
                  <Input
                    value={webhookUrl}
                    readOnly
                    className="font-mono text-sm"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => copyToClipboard(webhookUrl, "Webhook URL")}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Configure this webhook URL in your WhatsApp Business API provider (Twilio, 360Dialog, etc.)
                </p>
              </div>

              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div className="space-y-0.5">
                  <Label>WhatsApp Status</Label>
                  <p className="text-sm text-muted-foreground">
                    {profile.whatsapp_number ? "Configured" : "Not configured"}
                  </p>
                </div>
                {profile.whatsapp_number && (
                  <Check className="h-5 w-5 text-green-500" />
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Mail className="h-5 w-5" />
                Email Integration
              </CardTitle>
              <CardDescription>
                Configure email for document reception
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Enable Email Integration</Label>
                  <p className="text-sm text-muted-foreground">
                    Receive documents via email
                  </p>
                </div>
                <Switch
                  checked={emailConfig.enabled}
                  onCheckedChange={(checked) => setEmailConfig({ ...emailConfig, enabled: checked })}
                />
              </div>

              {emailConfig.enabled && (
                <>
                  <Alert>
                    <Mail className="h-4 w-4" />
                    <AlertTitle>Your Dedicated Email Address</AlertTitle>
                    <AlertDescription>
                      <div className="mt-2 space-y-2">
                        <div className="flex items-center gap-2">
                          <code className="px-2 py-1 bg-muted rounded text-sm flex-1">
                            {dedicatedEmail}
                          </code>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => copyToClipboard(dedicatedEmail, "Email address")}
                          >
                            <Copy className="h-4 w-4" />
                          </Button>
                        </div>
                        <p className="text-xs">
                          Clients can send documents to this email address
                        </p>
                      </div>
                    </AlertDescription>
                  </Alert>

                  <div className="space-y-2">
                    <Label>Email Provider</Label>
                    <Select
                      value={emailConfig.provider}
                      onValueChange={(value: any) => setEmailConfig({ ...emailConfig, provider: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="gmail">Gmail</SelectItem>
                        <SelectItem value="outlook">Outlook</SelectItem>
                        <SelectItem value="custom">Custom SMTP/IMAP</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {emailConfig.provider === "custom" && (
                    <div className="space-y-4 p-4 border rounded-lg">
                      <h4 className="font-medium">SMTP Configuration (Sending)</h4>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>SMTP Host</Label>
                          <Input
                            value={emailConfig.smtp_host}
                            onChange={(e) => setEmailConfig({ ...emailConfig, smtp_host: e.target.value })}
                            placeholder="smtp.example.com"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>SMTP Port</Label>
                          <Input
                            value={emailConfig.smtp_port}
                            onChange={(e) => setEmailConfig({ ...emailConfig, smtp_port: e.target.value })}
                            placeholder="587"
                          />
                        </div>
                      </div>

                      <h4 className="font-medium mt-4">IMAP Configuration (Receiving)</h4>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>IMAP Host</Label>
                          <Input
                            value={emailConfig.imap_host}
                            onChange={(e) => setEmailConfig({ ...emailConfig, imap_host: e.target.value })}
                            placeholder="imap.example.com"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>IMAP Port</Label>
                          <Input
                            value={emailConfig.imap_port}
                            onChange={(e) => setEmailConfig({ ...emailConfig, imap_port: e.target.value })}
                            placeholder="993"
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Branding Tab */}
        <TabsContent value="branding" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Palette className="h-5 w-5" />
                White-Label Branding
              </CardTitle>
              <CardDescription>
                Customize how clients experience your automation
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Firm Logo URL</Label>
                <Input
                  value={branding.logo_url}
                  onChange={(e) => setBranding({ ...branding, logo_url: e.target.value })}
                  placeholder="https://example.com/logo.png"
                />
                <p className="text-xs text-muted-foreground">
                  Used in client dashboard and communications
                </p>
              </div>

              <div className="space-y-2">
                <Label>Primary Brand Color</Label>
                <div className="flex items-center gap-2">
                  <Input
                    type="color"
                    value={branding.primary_color}
                    onChange={(e) => setBranding({ ...branding, primary_color: e.target.value })}
                    className="w-20 h-10"
                  />
                  <Input
                    value={branding.primary_color}
                    onChange={(e) => setBranding({ ...branding, primary_color: e.target.value })}
                    placeholder="#3b82f6"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Welcome/Greeting Message</Label>
                <Textarea
                  value={branding.greeting_message}
                  onChange={(e) => setBranding({ ...branding, greeting_message: e.target.value })}
                  rows={3}
                  placeholder="Hello! Welcome to..."
                />
                <p className="text-xs text-muted-foreground">
                  Sent to new clients when they first contact you
                </p>
              </div>

              <div className="space-y-2">
                <Label>Document Acknowledgment Message</Label>
                <Textarea
                  value={branding.acknowledgment_message}
                  onChange={(e) => setBranding({ ...branding, acknowledgment_message: e.target.value })}
                  rows={3}
                />
                <p className="text-xs text-muted-foreground">
                  Sent when a document is received
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Automation Tab */}
        <TabsContent value="automation" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Automation Settings
              </CardTitle>
              <CardDescription>
                Configure how documents are processed automatically
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Auto-Process Documents</Label>
                  <p className="text-sm text-muted-foreground">
                    Automatically extract and process incoming documents
                  </p>
                </div>
                <Switch
                  checked={automation.auto_process_documents}
                  onCheckedChange={(checked) => setAutomation({ ...automation, auto_process_documents: checked })}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Auto-Create Journal Entries</Label>
                  <p className="text-sm text-muted-foreground">
                    Automatically create accounting entries from invoices
                  </p>
                </div>
                <Switch
                  checked={automation.auto_create_journal_entries}
                  onCheckedChange={(checked) => setAutomation({ ...automation, auto_create_journal_entries: checked })}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Send Acknowledgments</Label>
                  <p className="text-sm text-muted-foreground">
                    Automatically send confirmation messages to clients
                  </p>
                </div>
                <Switch
                  checked={automation.auto_send_acknowledgments}
                  onCheckedChange={(checked) => setAutomation({ ...automation, auto_send_acknowledgments: checked })}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Require Manual Review</Label>
                  <p className="text-sm text-muted-foreground">
                    Hold documents for your approval before posting
                  </p>
                </div>
                <Switch
                  checked={automation.require_manual_review}
                  onCheckedChange={(checked) => setAutomation({ ...automation, require_manual_review: checked })}
                />
              </div>

              <div className="space-y-2">
                <Label>Confidence Threshold</Label>
                <div className="flex items-center gap-4">
                  <input
                    type="range"
                    min="0.5"
                    max="1"
                    step="0.05"
                    value={automation.confidence_threshold}
                    onChange={(e) => setAutomation({ ...automation, confidence_threshold: parseFloat(e.target.value) })}
                    className="flex-1"
                  />
                  <span className="text-sm font-medium w-12 text-right">
                    {Math.round(automation.confidence_threshold * 100)}%
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Documents below this confidence score will be flagged for review
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Notifications Tab */}
        <TabsContent value="notifications" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bell className="h-5 w-5" />
                Notification Preferences
              </CardTitle>
              <CardDescription>
                Choose how you want to be notified
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <h4 className="font-medium">Email Notifications</h4>
              
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>New Document Received</Label>
                  <p className="text-sm text-muted-foreground">
                    When a client sends a document
                  </p>
                </div>
                <Switch
                  checked={notifications.email_new_document}
                  onCheckedChange={(checked) => setNotifications({ ...notifications, email_new_document: checked })}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Processing Complete</Label>
                  <p className="text-sm text-muted-foreground">
                    When document processing finishes
                  </p>
                </div>
                <Switch
                  checked={notifications.email_processing_complete}
                  onCheckedChange={(checked) => setNotifications({ ...notifications, email_processing_complete: checked })}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>KYC Completion</Label>
                  <p className="text-sm text-muted-foreground">
                    When a client completes KYC
                  </p>
                </div>
                <Switch
                  checked={notifications.email_kyc_complete}
                  onCheckedChange={(checked) => setNotifications({ ...notifications, email_kyc_complete: checked })}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Weekly Summary</Label>
                  <p className="text-sm text-muted-foreground">
                    Weekly digest of activity
                  </p>
                </div>
                <Switch
                  checked={notifications.email_weekly_summary}
                  onCheckedChange={(checked) => setNotifications({ ...notifications, email_weekly_summary: checked })}
                />
              </div>

              <h4 className="font-medium mt-6">WhatsApp Notifications</h4>
              
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Enable WhatsApp Alerts</Label>
                  <p className="text-sm text-muted-foreground">
                    Receive critical alerts via WhatsApp
                  </p>
                </div>
                <Switch
                  checked={notifications.whatsapp_enabled}
                  onCheckedChange={(checked) => setNotifications({ ...notifications, whatsapp_enabled: checked })}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Save Button - Fixed at bottom */}
      <div className="flex justify-end gap-2 sticky bottom-0 bg-background py-4 border-t">
        <Button variant="outline" onClick={loadSettings} disabled={saving}>
          Reset
        </Button>
        <Button onClick={saveSettings} disabled={saving}>
          {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Save Changes
        </Button>
      </div>
    </div>
  );
}
