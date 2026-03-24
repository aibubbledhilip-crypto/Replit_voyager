import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  ChevronDown, ChevronRight, Play, CheckCircle2, XCircle, Clock, RefreshCw,
  Database, Users, CreditCard, Phone, Settings, AlertTriangle, Zap, History, Copy, Check
} from "lucide-react";

// ─── Mock Data ────────────────────────────────────────────────────────────────

type FieldType = "text" | "number" | "select" | "textarea" | "date";

interface Field {
  key: string;
  label: string;
  type: FieldType;
  placeholder?: string;
  required?: boolean;
  options?: string[];
  hint?: string;
}

interface Action {
  id: string;
  name: string;
  description: string;
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  path: string;
  fields: Field[];
  requiresConfirm?: boolean;
  tags?: string[];
}

interface Group {
  id: string;
  label: string;
  icon: any;
  color: string;
  actions: Action[];
}

const GROUPS: Group[] = [
  {
    id: "subscriber",
    label: "Subscriber Fixes",
    icon: Phone,
    color: "text-blue-500",
    actions: [
      {
        id: "resend-sms",
        name: "Resend Activation SMS",
        description: "Resend the account activation SMS to a subscriber's MSISDN.",
        method: "POST",
        path: "/api/subscribers/{msisdn}/resend-activation",
        tags: ["common"],
        fields: [
          { key: "msisdn", label: "MSISDN", type: "text", placeholder: "e.g. 60123456789", required: true, hint: "Include country code without +" },
          { key: "reason", label: "Reason", type: "select", required: true, options: ["Customer request", "Failed delivery", "Number ported", "Other"] },
        ],
      },
      {
        id: "reset-pin",
        name: "Reset Subscriber PIN",
        description: "Force-reset the self-service PIN for a subscriber account.",
        method: "PATCH",
        path: "/api/subscribers/{msisdn}/pin",
        requiresConfirm: true,
        fields: [
          { key: "msisdn", label: "MSISDN", type: "text", placeholder: "e.g. 60123456789", required: true },
          { key: "new_pin", label: "New PIN", type: "text", placeholder: "4–6 digits", required: true, hint: "Leave blank to send auto-generated PIN" },
        ],
      },
      {
        id: "lookup-subscriber",
        name: "Subscriber Lookup",
        description: "Retrieve full subscriber profile including plan, status, and add-ons.",
        method: "GET",
        path: "/api/subscribers/{msisdn}",
        tags: ["lookup"],
        fields: [
          { key: "msisdn", label: "MSISDN", type: "text", placeholder: "e.g. 60123456789", required: true },
        ],
      },
      {
        id: "suspend",
        name: "Suspend / Unsuspend",
        description: "Temporarily suspend or restore a subscriber account.",
        method: "PATCH",
        path: "/api/subscribers/{msisdn}/status",
        requiresConfirm: true,
        fields: [
          { key: "msisdn", label: "MSISDN", type: "text", placeholder: "e.g. 60123456789", required: true },
          { key: "action", label: "Action", type: "select", required: true, options: ["suspend", "unsuspend"] },
          { key: "note", label: "Internal Note", type: "textarea", placeholder: "Reason for this action..." },
        ],
      },
    ],
  },
  {
    id: "billing",
    label: "Billing Operations",
    icon: CreditCard,
    color: "text-emerald-500",
    actions: [
      {
        id: "refund",
        name: "Issue Refund",
        description: "Apply a credit refund to a subscriber's account balance.",
        method: "POST",
        path: "/api/billing/{msisdn}/refund",
        requiresConfirm: true,
        tags: ["common"],
        fields: [
          { key: "msisdn", label: "MSISDN", type: "text", placeholder: "e.g. 60123456789", required: true },
          { key: "amount", label: "Amount (MYR)", type: "number", placeholder: "e.g. 15.00", required: true },
          { key: "type", label: "Refund Type", type: "select", required: true, options: ["credit", "cashback", "waiver"] },
          { key: "reference", label: "Reference / Ticket ID", type: "text", placeholder: "e.g. INC-00124" },
        ],
      },
      {
        id: "waive-late-fee",
        name: "Waive Late Fee",
        description: "Remove a pending late payment fee from the subscriber's invoice.",
        method: "DELETE",
        path: "/api/billing/{msisdn}/late-fee/{invoice_id}",
        requiresConfirm: true,
        fields: [
          { key: "msisdn", label: "MSISDN", type: "text", placeholder: "e.g. 60123456789", required: true },
          { key: "invoice_id", label: "Invoice ID", type: "text", placeholder: "e.g. INV-20240301-0012", required: true },
        ],
      },
      {
        id: "billing-history",
        name: "Billing History",
        description: "Fetch recent invoices and payment records for a subscriber.",
        method: "GET",
        path: "/api/billing/{msisdn}/invoices",
        tags: ["lookup"],
        fields: [
          { key: "msisdn", label: "MSISDN", type: "text", placeholder: "e.g. 60123456789", required: true },
          { key: "from_date", label: "From Date", type: "date" },
          { key: "to_date", label: "To Date", type: "date" },
          { key: "limit", label: "Max Records", type: "number", placeholder: "20" },
        ],
      },
    ],
  },
  {
    id: "provisioning",
    label: "Provisioning",
    icon: Settings,
    color: "text-violet-500",
    actions: [
      {
        id: "reprovision",
        name: "Re-provision Service",
        description: "Trigger a full reprovisioning cycle for a subscriber's active services.",
        method: "POST",
        path: "/api/provisioning/{msisdn}/reprovision",
        requiresConfirm: true,
        tags: ["common"],
        fields: [
          { key: "msisdn", label: "MSISDN", type: "text", placeholder: "e.g. 60123456789", required: true },
          { key: "service_type", label: "Service Type", type: "select", required: true, options: ["voice", "data", "sms", "all"] },
          { key: "force", label: "Force Mode", type: "select", options: ["false", "true"] },
        ],
      },
      {
        id: "add-addon",
        name: "Add Add-on",
        description: "Activate a supplementary add-on plan for a subscriber.",
        method: "POST",
        path: "/api/provisioning/{msisdn}/addons",
        fields: [
          { key: "msisdn", label: "MSISDN", type: "text", placeholder: "e.g. 60123456789", required: true },
          { key: "addon_code", label: "Add-on Code", type: "text", placeholder: "e.g. DATA-1GB-7D", required: true },
          { key: "effective_date", label: "Effective Date", type: "date" },
        ],
      },
    ],
  },
];

// ─── Mock execution responses ─────────────────────────────────────────────────

const MOCK_RESPONSES: Record<string, any> = {
  "resend-sms": { status: "success", message: "Activation SMS sent to 60123456789", timestamp: "2026-03-24T09:14:02Z", request_id: "req_8f2a1c" },
  "reset-pin": { status: "success", message: "PIN reset successfully. New PIN sent via SMS.", subscriber_id: "SUB-00412" },
  "lookup-subscriber": { status: "success", msisdn: "60123456789", name: "Ahmad Razif", plan: "Postpaid 80", plan_status: "active", data_used_gb: 12.4, data_limit_gb: 20, billing_cycle_end: "2026-04-01", outstanding_amount: 0 },
  "suspend": { status: "success", message: "Account suspended successfully.", effective_at: "2026-03-24T09:14:02Z" },
  "refund": { status: "success", message: "Credit of MYR 15.00 applied to account.", transaction_id: "TXN-20260324-0098", new_balance: "MYR 15.00" },
  "waive-late-fee": { status: "success", message: "Late fee waived. Invoice updated.", invoice_id: "INV-20240301-0012" },
  "billing-history": { status: "success", total: 3, invoices: [{ id: "INV-003", date: "2026-03-01", amount: 80, status: "paid" }, { id: "INV-002", date: "2026-02-01", amount: 80, status: "paid" }, { id: "INV-001", date: "2026-01-01", amount: 80, status: "paid" }] },
  "reprovision": { status: "success", message: "Reprovisioning initiated for all services.", job_id: "JOB-PRV-00291", estimated_completion_seconds: 45 },
  "add-addon": { status: "success", message: "Add-on DATA-1GB-7D activated.", expires_at: "2026-03-31T23:59:59Z" },
};

// ─── Method badge ─────────────────────────────────────────────────────────────

const METHOD_COLORS: Record<string, string> = {
  GET: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
  POST: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
  PUT: "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300",
  PATCH: "bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300",
  DELETE: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300",
};

function MethodBadge({ method }: { method: string }) {
  return (
    <span className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-bold tracking-wider ${METHOD_COLORS[method] ?? ""}`}>
      {method}
    </span>
  );
}

// ─── Recent Executions (sidebar bottom) ──────────────────────────────────────

const RECENT: { name: string; status: "success" | "error"; time: string }[] = [
  { name: "Resend Activation SMS", status: "success", time: "2 min ago" },
  { name: "Issue Refund", status: "success", time: "14 min ago" },
  { name: "Reset Subscriber PIN", status: "error", time: "31 min ago" },
];

// ─── Main Component ───────────────────────────────────────────────────────────

export function ActionExecutionPage() {
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({ subscriber: true, billing: true, provisioning: false });
  const [selectedAction, setSelectedAction] = useState<Action | null>(GROUPS[0].actions[0]);
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({});
  const [confirming, setConfirming] = useState(false);
  const [executing, setExecuting] = useState(false);
  const [response, setResponse] = useState<any | null>(null);
  const [responseError, setResponseError] = useState(false);
  const [copied, setCopied] = useState(false);

  const toggleGroup = (id: string) => setOpenGroups(prev => ({ ...prev, [id]: !prev[id] }));

  const selectAction = (action: Action) => {
    setSelectedAction(action);
    setFieldValues({});
    setConfirming(false);
    setResponse(null);
    setResponseError(false);
  };

  const handleFieldChange = (key: string, value: string) => {
    setFieldValues(prev => ({ ...prev, [key]: value }));
  };

  const handleExecute = async () => {
    if (!selectedAction) return;
    if (selectedAction.requiresConfirm && !confirming) {
      setConfirming(true);
      return;
    }
    setExecuting(true);
    setConfirming(false);
    setResponse(null);
    await new Promise(r => setTimeout(r, 1200));
    setResponse(MOCK_RESPONSES[selectedAction.id] ?? { status: "success", message: "Operation completed." });
    setResponseError(false);
    setExecuting(false);
  };

  const handleCopy = () => {
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const requiredFilled = selectedAction?.fields
    .filter(f => f.required)
    .every(f => !!fieldValues[f.key]?.trim());

  return (
    <div className="flex h-screen bg-background text-foreground overflow-hidden font-sans">

      {/* ── Left sidebar ── */}
      <aside className="w-60 shrink-0 border-r flex flex-col bg-muted/30">
        <div className="px-4 py-4 border-b">
          <div className="flex items-center gap-2">
            <Zap className="h-4 w-4 text-primary" />
            <span className="font-semibold text-sm">Actions</span>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">Guided API operations</p>
        </div>

        <ScrollArea className="flex-1">
          <div className="py-2 px-2 space-y-0.5">
            {GROUPS.map(group => (
              <div key={group.id}>
                <button
                  onClick={() => toggleGroup(group.id)}
                  className="flex w-full items-center gap-2 px-2 py-1.5 rounded-md text-xs font-semibold uppercase tracking-wide text-muted-foreground hover:text-foreground transition-colors"
                >
                  {openGroups[group.id] ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                  <group.icon className={`h-3.5 w-3.5 ${group.color}`} />
                  {group.label}
                </button>
                {openGroups[group.id] && (
                  <div className="ml-5 mt-0.5 mb-1 space-y-0.5">
                    {group.actions.map(action => (
                      <button
                        key={action.id}
                        onClick={() => selectAction(action)}
                        className={`w-full text-left px-2 py-1.5 rounded-md text-sm transition-colors flex items-center justify-between gap-1 ${
                          selectedAction?.id === action.id
                            ? "bg-primary/10 text-primary font-medium"
                            : "hover:bg-muted text-foreground"
                        }`}
                      >
                        <span className="truncate">{action.name}</span>
                        {action.tags?.includes("common") && (
                          <span className="shrink-0 text-[9px] bg-primary/15 text-primary rounded px-1 py-0.5 font-medium">HOT</span>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </ScrollArea>

        {/* Recent executions */}
        <div className="border-t px-3 py-3">
          <div className="flex items-center gap-1.5 mb-2">
            <History className="h-3 w-3 text-muted-foreground" />
            <span className="text-xs font-medium text-muted-foreground">Recent</span>
          </div>
          <div className="space-y-1.5">
            {RECENT.map((r, i) => (
              <div key={i} className="flex items-center gap-1.5">
                {r.status === "success"
                  ? <CheckCircle2 className="h-3 w-3 text-emerald-500 shrink-0" />
                  : <XCircle className="h-3 w-3 text-red-500 shrink-0" />}
                <div className="min-w-0">
                  <p className="text-xs truncate leading-tight">{r.name}</p>
                  <p className="text-[10px] text-muted-foreground">{r.time}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </aside>

      {/* ── Main panel ── */}
      {selectedAction ? (
        <div className="flex flex-1 min-w-0 divide-x">

          {/* Form panel */}
          <div className="flex flex-col flex-1 min-w-0">
            {/* Header */}
            <div className="px-6 py-4 border-b">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <MethodBadge method={selectedAction.method} />
                    <code className="text-xs text-muted-foreground font-mono">{selectedAction.path}</code>
                  </div>
                  <h2 className="text-lg font-semibold">{selectedAction.name}</h2>
                  <p className="text-sm text-muted-foreground mt-0.5">{selectedAction.description}</p>
                </div>
                {selectedAction.requiresConfirm && (
                  <Badge variant="outline" className="text-amber-600 border-amber-300 bg-amber-50 dark:bg-amber-950 dark:text-amber-400 dark:border-amber-800 gap-1 text-xs">
                    <AlertTriangle className="h-3 w-3" />
                    Requires confirmation
                  </Badge>
                )}
              </div>
            </div>

            {/* Fields */}
            <ScrollArea className="flex-1">
              <div className="px-6 py-5 space-y-5 max-w-xl">
                {selectedAction.fields.map(field => (
                  <div key={field.key} className="space-y-1.5">
                    <Label className="text-sm font-medium">
                      {field.label}
                      {field.required && <span className="text-red-500 ml-0.5">*</span>}
                    </Label>
                    {field.type === "text" && (
                      <Input
                        placeholder={field.placeholder}
                        value={fieldValues[field.key] ?? ""}
                        onChange={e => handleFieldChange(field.key, e.target.value)}
                      />
                    )}
                    {field.type === "number" && (
                      <Input
                        type="number"
                        placeholder={field.placeholder}
                        value={fieldValues[field.key] ?? ""}
                        onChange={e => handleFieldChange(field.key, e.target.value)}
                      />
                    )}
                    {field.type === "date" && (
                      <Input
                        type="date"
                        value={fieldValues[field.key] ?? ""}
                        onChange={e => handleFieldChange(field.key, e.target.value)}
                      />
                    )}
                    {field.type === "textarea" && (
                      <Textarea
                        placeholder={field.placeholder}
                        value={fieldValues[field.key] ?? ""}
                        onChange={e => handleFieldChange(field.key, e.target.value)}
                        rows={3}
                      />
                    )}
                    {field.type === "select" && (
                      <Select
                        value={fieldValues[field.key] ?? ""}
                        onValueChange={v => handleFieldChange(field.key, v)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select..." />
                        </SelectTrigger>
                        <SelectContent>
                          {field.options?.map(opt => (
                            <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                    {field.hint && <p className="text-xs text-muted-foreground">{field.hint}</p>}
                  </div>
                ))}
              </div>
            </ScrollArea>

            {/* Footer / Action bar */}
            <div className="px-6 py-4 border-t bg-muted/20">
              {confirming ? (
                <div className="flex items-center gap-3">
                  <div className="flex-1 flex items-center gap-2 text-amber-600 dark:text-amber-400">
                    <AlertTriangle className="h-4 w-4 shrink-0" />
                    <span className="text-sm font-medium">This action will make changes. Are you sure?</span>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => setConfirming(false)}>Cancel</Button>
                  <Button size="sm" onClick={handleExecute} className="bg-amber-600 hover:bg-amber-700 text-white">
                    Confirm & Execute
                  </Button>
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <Button
                    onClick={handleExecute}
                    disabled={!requiredFilled || executing}
                    className="gap-2"
                  >
                    {executing ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                    {executing ? "Executing..." : selectedAction.requiresConfirm ? "Execute (will confirm)" : "Execute"}
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => { setFieldValues({}); setResponse(null); setConfirming(false); }}>
                    Clear
                  </Button>
                  {!requiredFilled && (
                    <p className="text-xs text-muted-foreground">Fill in required fields to continue</p>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Response panel */}
          <div className="w-80 shrink-0 flex flex-col">
            <div className="px-4 py-3 border-b">
              <span className="text-sm font-medium">Response</span>
            </div>
            <ScrollArea className="flex-1">
              {executing ? (
                <div className="flex flex-col items-center justify-center h-48 gap-3 text-muted-foreground">
                  <RefreshCw className="h-6 w-6 animate-spin" />
                  <p className="text-sm">Calling API...</p>
                </div>
              ) : response ? (
                <div className="p-4 space-y-3">
                  {/* Status banner */}
                  <div className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium ${
                    response.status === "success"
                      ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
                      : "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300"
                  }`}>
                    {response.status === "success"
                      ? <CheckCircle2 className="h-4 w-4 shrink-0" />
                      : <XCircle className="h-4 w-4 shrink-0" />}
                    {response.status === "success" ? "Success" : "Error"}
                  </div>

                  {/* Message */}
                  {response.message && (
                    <p className="text-sm text-foreground">{response.message}</p>
                  )}

                  <Separator />

                  {/* Key-value fields */}
                  <div className="space-y-2">
                    {Object.entries(response)
                      .filter(([k]) => k !== "status" && k !== "message")
                      .map(([k, v]) => (
                        <div key={k}>
                          <p className="text-xs text-muted-foreground font-mono mb-0.5">{k}</p>
                          <p className="text-xs font-medium break-all">
                            {typeof v === "object" ? JSON.stringify(v, null, 2) : String(v)}
                          </p>
                        </div>
                      ))}
                  </div>

                  <Separator />

                  {/* Raw JSON */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <p className="text-xs text-muted-foreground">Raw JSON</p>
                      <button
                        onClick={handleCopy}
                        className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                      >
                        {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                        {copied ? "Copied" : "Copy"}
                      </button>
                    </div>
                    <pre className="text-[10px] bg-muted rounded-md p-3 overflow-x-auto leading-relaxed">
                      {JSON.stringify(response, null, 2)}
                    </pre>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-48 gap-2 text-muted-foreground px-6 text-center">
                  <Clock className="h-5 w-5" />
                  <p className="text-sm">Response will appear here after execution</p>
                </div>
              )}
            </ScrollArea>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center text-muted-foreground">
          <p className="text-sm">Select an action from the sidebar</p>
        </div>
      )}
    </div>
  );
}
