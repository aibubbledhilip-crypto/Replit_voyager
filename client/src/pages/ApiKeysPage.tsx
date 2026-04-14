import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Key, Plus, Trash2, Copy, Check, AlertTriangle, Clock, Tag } from "lucide-react";

interface ApiKey {
  id: string;
  name: string;
  keyPrefix: string;
  scopes: string[];
  lastUsedAt: string | null;
  expiresAt: string | null;
  createdAt: string;
  revoked: boolean;
}

interface CreatedKey extends ApiKey {
  rawKey: string;
}

const SCOPE_LABELS: Record<string, { label: string; description: string }> = {
  execute_queries: {
    label: "Executor",
    description: "Run SQL queries via POST /api/v1/execute",
  },
  explorer: {
    label: "Explorer",
    description: "Run explorer lookups via POST /api/v1/explorer/lookup",
  },
};

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(value).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };
  return (
    <Button size="icon" variant="ghost" onClick={copy} data-testid="button-copy-key">
      {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
    </Button>
  );
}

function NewKeyDialog({ onCreated }: { onCreated: (key: CreatedKey) => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [scopes, setScopes] = useState<string[]>(["execute_queries"]);
  const { toast } = useToast();

  const createMutation = useMutation({
    mutationFn: (data: { name: string; scopes: string[] }) =>
      apiRequest("POST", "/api/user/api-keys", data).then(r => r.json()),
    onSuccess: (data: CreatedKey) => {
      queryClient.invalidateQueries({ queryKey: ["/api/user/api-keys"] });
      setOpen(false);
      setName("");
      setScopes(["execute_queries"]);
      onCreated(data);
    },
    onError: (error: any) => {
      toast({ title: "Failed to create key", description: error.message, variant: "destructive" });
    },
  });

  const toggleScope = (scope: string) => {
    setScopes(prev =>
      prev.includes(scope) ? prev.filter(s => s !== scope) : [...prev, scope]
    );
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button data-testid="button-new-api-key" className="gap-2">
          <Plus className="h-4 w-4" />
          New API Key
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create API Key</DialogTitle>
          <DialogDescription>
            Generate a personal access token scoped to specific features. The key is shown once — save it immediately.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-5 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="key-name">Key Name</Label>
            <Input
              id="key-name"
              data-testid="input-api-key-name"
              placeholder="e.g. ETL pipeline, Dashboard integration"
              value={name}
              onChange={e => setName(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>Scopes</Label>
            <p className="text-xs text-muted-foreground">Select which endpoints this key can access.</p>
            <div className="space-y-2">
              {Object.entries(SCOPE_LABELS).map(([scope, info]) => (
                <div
                  key={scope}
                  className="flex items-start gap-3 rounded-md border p-3"
                >
                  <Checkbox
                    id={`scope-${scope}`}
                    data-testid={`checkbox-scope-${scope}`}
                    checked={scopes.includes(scope)}
                    onCheckedChange={() => toggleScope(scope)}
                  />
                  <div>
                    <Label htmlFor={`scope-${scope}`} className="font-medium cursor-pointer">{info.label}</Label>
                    <p className="text-xs text-muted-foreground mt-0.5">{info.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button
            data-testid="button-create-api-key"
            onClick={() => createMutation.mutate({ name, scopes })}
            disabled={!name.trim() || scopes.length === 0 || createMutation.isPending}
          >
            {createMutation.isPending ? "Creating..." : "Create Key"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RevealedKeyBanner({ apiKey, onDismiss }: { apiKey: CreatedKey; onDismiss: () => void }) {
  return (
    <Card className="border-amber-300 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-800">
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
          <CardTitle className="text-sm text-amber-700 dark:text-amber-300">Save your API key — it won't be shown again</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-xs text-amber-600 dark:text-amber-400">
          Key <strong>{apiKey.name}</strong> was created successfully. Copy it now and store it in a secure location.
        </p>
        <div className="flex items-center gap-2 bg-white dark:bg-black rounded-md border px-3 py-2 font-mono text-sm">
          <span className="flex-1 break-all select-all" data-testid="text-revealed-key">{apiKey.rawKey}</span>
          <CopyButton value={apiKey.rawKey} />
        </div>
        <Button size="sm" variant="outline" onClick={onDismiss} data-testid="button-dismiss-key-banner">
          I've saved my key
        </Button>
      </CardContent>
    </Card>
  );
}

export default function ApiKeysPage() {
  const [revealedKey, setRevealedKey] = useState<CreatedKey | null>(null);
  const { toast } = useToast();

  const { data: keys = [], isLoading } = useQuery<ApiKey[]>({
    queryKey: ["/api/user/api-keys"],
  });

  const revokeMutation = useMutation({
    mutationFn: (id: string) =>
      apiRequest("DELETE", `/api/user/api-keys/${id}`).then(r => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/user/api-keys"] });
      toast({ title: "API key revoked" });
    },
    onError: (error: any) => {
      toast({ title: "Failed to revoke key", description: error.message, variant: "destructive" });
    },
  });

  return (
    <div className="container max-w-3xl mx-auto py-8 px-4 space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Key className="h-6 w-6" />
            API Keys
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Manage personal access tokens for programmatic access to the Executor and Explorer APIs.
          </p>
        </div>
        <NewKeyDialog onCreated={key => setRevealedKey(key)} />
      </div>

      {/* Newly created key banner */}
      {revealedKey && (
        <RevealedKeyBanner apiKey={revealedKey} onDismiss={() => setRevealedKey(null)} />
      )}

      {/* Usage card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">How to use</CardTitle>
          <CardDescription>Include your API key in the Authorization header of every request.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Execute a query</p>
            <pre className="bg-muted rounded-md p-3 text-xs overflow-x-auto leading-relaxed">{`curl -X POST https://your-voyager-domain/api/v1/execute \\
  -H "Authorization: Bearer vgr_your_key_here" \\
  -H "Content-Type: application/json" \\
  -d '{"query": "SELECT * FROM my_table LIMIT 10"}'`}</pre>
          </div>
          <div className="space-y-1.5">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Explorer lookup</p>
            <pre className="bg-muted rounded-md p-3 text-xs overflow-x-auto leading-relaxed">{`curl -X POST https://your-voyager-domain/api/v1/explorer/lookup \\
  -H "Authorization: Bearer vgr_your_key_here" \\
  -H "Content-Type: application/json" \\
  -d '{"value": "60123456789"}'`}</pre>
          </div>
        </CardContent>
      </Card>

      {/* Keys list */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Your Keys</h2>

        {isLoading ? (
          <div className="text-sm text-muted-foreground py-6 text-center">Loading...</div>
        ) : keys.length === 0 ? (
          <Card>
            <CardContent className="py-10 text-center text-muted-foreground text-sm">
              <Key className="h-8 w-8 mx-auto mb-2 opacity-30" />
              No API keys yet. Create one to get started.
            </CardContent>
          </Card>
        ) : (
          keys.map(key => (
            <Card key={key.id} data-testid={`card-api-key-${key.id}`}>
              <CardContent className="py-4">
                <div className="flex flex-wrap items-start gap-4 justify-between">
                  <div className="space-y-1.5 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold text-sm" data-testid={`text-key-name-${key.id}`}>{key.name}</span>
                      <code className="text-xs bg-muted rounded px-1.5 py-0.5 font-mono text-muted-foreground">
                        {key.keyPrefix}••••••••
                      </code>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {key.scopes.map(scope => (
                        <Badge key={scope} variant="secondary" className="text-xs gap-1">
                          <Tag className="h-2.5 w-2.5" />
                          {SCOPE_LABELS[scope]?.label ?? scope}
                        </Badge>
                      ))}
                    </div>
                    <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        Created {new Date(key.createdAt).toLocaleDateString()}
                      </span>
                      {key.lastUsedAt && (
                        <span>Last used {new Date(key.lastUsedAt).toLocaleDateString()}</span>
                      )}
                      {key.expiresAt && (
                        <span className={new Date(key.expiresAt) < new Date() ? "text-red-500" : ""}>
                          {new Date(key.expiresAt) < new Date() ? "Expired" : "Expires"} {new Date(key.expiresAt).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  </div>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        size="icon"
                        variant="ghost"
                        data-testid={`button-revoke-key-${key.id}`}
                        disabled={revokeMutation.isPending}
                      >
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Revoke API Key</AlertDialogTitle>
                        <AlertDialogDescription>
                          Revoking <strong>{key.name}</strong> will immediately invalidate it. Any automation using this key will stop working.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => revokeMutation.mutate(key.id)}
                          className="bg-red-600 hover:bg-red-700 text-white"
                          data-testid={`button-confirm-revoke-${key.id}`}
                        >
                          Revoke Key
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
