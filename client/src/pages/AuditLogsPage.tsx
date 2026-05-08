import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useQuery as useAuthQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { Shield, Search, Filter, RefreshCw, ChevronDown } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AuthUser } from "@/App";

interface AuditLog {
  id: string;
  organizationId: string | null;
  userId: string | null;
  action: string;
  resourceType: string;
  resourceId: string | null;
  details: string | null;
  ipAddress: string | null;
  createdAt: string;
}

const ACTION_LABELS: Record<string, string> = {
  login_success: "Login Success",
  login_failed: "Login Failed",
  user_created: "User Created",
  user_role_changed: "Role Changed",
  user_status_changed: "Status Changed",
  user_password_changed: "Password Reset",
  user_deleted_by_super_admin: "User Deleted",
  user_removed_from_org_by_super_admin: "User Removed from Org",
  aws_config_update: "AWS Config Updated",
  db_connection_created: "DB Connection Created",
  db_connection_updated: "DB Connection Updated",
  db_connection_deleted: "DB Connection Deleted",
  sftp_config_created: "SFTP Config Created",
  sftp_config_updated: "SFTP Config Updated",
  sftp_config_deleted: "SFTP Config Deleted",
  update_role_permission: "Role Permission Changed",
  super_admin_impersonation_started: "Impersonation Started",
  super_admin_impersonation_ended: "Impersonation Ended",
  organization_created: "Org Created",
  organization_deleted: "Org Deleted",
  email_verified: "Email Verified",
  password_reset_by_super_admin: "Password Reset (Super Admin)",
};

const RESOURCE_TYPE_LABELS: Record<string, string> = {
  auth: "Auth",
  user: "User",
  rbac: "RBAC",
  aws_config: "AWS",
  database_connection: "Database",
  sftp_config: "SFTP",
  organization: "Organization",
  organization_member: "Org Member",
};

function actionBadgeVariant(action: string): "default" | "destructive" | "secondary" | "outline" {
  if (action.includes("failed") || action.includes("deleted") || action.includes("impersonation_started")) return "destructive";
  if (action.includes("created") || action.includes("success") || action.includes("verified")) return "default";
  if (action.includes("updated") || action.includes("changed") || action.includes("reset")) return "secondary";
  return "outline";
}

export default function AuditLogsPage() {
  const { data: user } = useAuthQuery<AuthUser>({ queryKey: ['/api/auth/me'] });
  const orgId = user?.organizationId;

  const [search, setSearch] = useState("");
  const [actionFilter, setActionFilter] = useState<string>("all");
  const [resourceFilter, setResourceFilter] = useState<string>("all");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const { data: logs = [], isLoading, refetch, isFetching } = useQuery<AuditLog[]>({
    queryKey: ['/api/organizations', orgId, 'audit-logs'],
    queryFn: async () => {
      if (!orgId) return [];
      const res = await fetch(`/api/organizations/${orgId}/audit-logs?limit=500`);
      if (!res.ok) throw new Error("Failed to fetch audit logs");
      return res.json();
    },
    enabled: !!orgId,
  });

  const uniqueActions = useMemo(() => Array.from(new Set(logs.map(l => l.action))).sort(), [logs]);
  const uniqueResourceTypes = useMemo(() => Array.from(new Set(logs.map(l => l.resourceType))).sort(), [logs]);

  const filtered = useMemo(() => {
    return logs.filter(log => {
      if (actionFilter !== "all" && log.action !== actionFilter) return false;
      if (resourceFilter !== "all" && log.resourceType !== resourceFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        const matches =
          log.action.includes(q) ||
          (log.details?.toLowerCase().includes(q)) ||
          (log.ipAddress?.includes(q)) ||
          (log.userId?.includes(q)) ||
          (log.resourceId?.toLowerCase().includes(q));
        if (!matches) return false;
      }
      return true;
    });
  }, [logs, actionFilter, resourceFilter, search]);

  const toggleExpand = (id: string) => {
    setExpanded(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Shield className="h-5 w-5 text-muted-foreground" />
          <h1 className="text-xl font-semibold">Audit Logs</h1>
          <Badge variant="secondary" data-testid="badge-log-count">{filtered.length} events</Badge>
        </div>
        <Button
          variant="outline"
          size="default"
          onClick={() => refetch()}
          disabled={isFetching}
          data-testid="button-refresh-audit-logs"
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${isFetching ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input
            placeholder="Search actions, details, IP..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9"
            data-testid="input-audit-search"
          />
        </div>
        <Select value={actionFilter} onValueChange={setActionFilter}>
          <SelectTrigger className="w-52" data-testid="select-action-filter">
            <Filter className="h-4 w-4 mr-2 text-muted-foreground" />
            <SelectValue placeholder="All actions" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All actions</SelectItem>
            {uniqueActions.map(a => (
              <SelectItem key={a} value={a}>{ACTION_LABELS[a] ?? a}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={resourceFilter} onValueChange={setResourceFilter}>
          <SelectTrigger className="w-44" data-testid="select-resource-filter">
            <SelectValue placeholder="All resources" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All resources</SelectItem>
            {uniqueResourceTypes.map(r => (
              <SelectItem key={r} value={r}>{RESOURCE_TYPE_LABELS[r] ?? r}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-12 rounded-md bg-muted animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-2">
          <Shield className="h-8 w-8" />
          <p className="font-medium">No audit events found</p>
          <p className="text-sm">Try adjusting your filters</p>
        </div>
      ) : (
        <div className="rounded-md border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="text-left px-4 py-2.5 font-medium text-muted-foreground w-40">Time</th>
                <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Action</th>
                <th className="text-left px-4 py-2.5 font-medium text-muted-foreground w-28">Resource</th>
                <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Details</th>
                <th className="text-left px-4 py-2.5 font-medium text-muted-foreground w-28">IP Address</th>
                <th className="w-8"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((log, idx) => {
                const isExpanded = expanded.has(log.id);
                return (
                  <>
                    <tr
                      key={log.id}
                      className={`border-b last:border-0 hover-elevate cursor-pointer transition-colors ${idx % 2 === 0 ? "" : "bg-muted/20"}`}
                      onClick={() => toggleExpand(log.id)}
                      data-testid={`row-audit-${log.id}`}
                    >
                      <td className="px-4 py-2.5 text-muted-foreground text-xs whitespace-nowrap">
                        {format(new Date(log.createdAt), "MMM d, HH:mm:ss")}
                      </td>
                      <td className="px-4 py-2.5">
                        <Badge variant={actionBadgeVariant(log.action)} className="text-xs">
                          {ACTION_LABELS[log.action] ?? log.action}
                        </Badge>
                      </td>
                      <td className="px-4 py-2.5">
                        <span className="text-xs text-muted-foreground">
                          {RESOURCE_TYPE_LABELS[log.resourceType] ?? log.resourceType}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-muted-foreground max-w-xs truncate">
                        {log.details ?? <span className="italic text-muted-foreground/50">—</span>}
                      </td>
                      <td className="px-4 py-2.5 text-xs text-muted-foreground font-mono">
                        {log.ipAddress ?? "—"}
                      </td>
                      <td className="px-2 py-2.5">
                        <ChevronDown className={`h-3.5 w-3.5 text-muted-foreground transition-transform ${isExpanded ? "rotate-180" : ""}`} />
                      </td>
                    </tr>
                    {isExpanded && (
                      <tr key={`${log.id}-expanded`} className="bg-muted/30 border-b last:border-0">
                        <td colSpan={6} className="px-6 py-3">
                          <div className="grid grid-cols-2 gap-x-8 gap-y-1 text-xs">
                            <div>
                              <span className="text-muted-foreground">Event ID: </span>
                              <span className="font-mono">{log.id}</span>
                            </div>
                            <div>
                              <span className="text-muted-foreground">User ID: </span>
                              <span className="font-mono">{log.userId ?? "—"}</span>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Resource ID: </span>
                              <span className="font-mono">{log.resourceId ?? "—"}</span>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Timestamp: </span>
                              <span>{format(new Date(log.createdAt), "PPpp")}</span>
                            </div>
                            {log.details && (
                              <div className="col-span-2">
                                <span className="text-muted-foreground">Details: </span>
                                <span>{log.details}</span>
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
