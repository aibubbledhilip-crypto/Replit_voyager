import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { apiRequest } from "@/lib/api";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { Shield, Info } from "lucide-react";

const FEATURE_LABELS: Record<string, { label: string; description: string }> = {
  execute_queries: { label: "Query Executor", description: "Run SQL queries against connected databases" },
  explorer:        { label: "Schema Explorer", description: "Browse database schemas, tables, and columns" },
  depiction:       { label: "Depiction Charts", description: "Create, save, and view dashboard charts" },
  file_compare:    { label: "File Comparison", description: "Compare and diff CSV/XLSX files" },
  file_aggregate:  { label: "File Aggregate", description: "Combine and aggregate multiple files" },
  sftp_monitor:    { label: "SFTP Monitor", description: "View SFTP server file health status" },
  msisdn_lookup:   { label: "MSISDN Lookup", description: "Look up phone numbers across data sources" },
  export_data:     { label: "Export Data", description: "Download query results as CSV" },
};

const ROLE_LABELS: Record<string, { label: string; color: string; description: string }> = {
  owner:  { label: "Owner",  color: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",  description: "Full access — cannot be restricted" },
  admin:  { label: "Admin",  color: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",   description: "Manages users and configuration" },
  member: { label: "Member", color: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200", description: "Standard user with data access" },
  viewer: { label: "Viewer", color: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",   description: "Read-only observer (no queries)" },
};

interface PermissionMatrix {
  matrix: Record<string, Record<string, boolean>>;
  roles: string[];
  features: string[];
}

export default function RolePermissionsPage() {
  const { toast } = useToast();

  const { data, isLoading } = useQuery<PermissionMatrix>({
    queryKey: ['/api/admin/role-permissions'],
  });

  const mutation = useMutation({
    mutationFn: async ({ role, feature, enabled }: { role: string; feature: string; enabled: boolean }) => {
      await apiRequest('/api/admin/role-permissions', {
        method: 'PUT',
        body: JSON.stringify({ role, feature, enabled }),
      });
    },
    onSuccess: (_, { role, feature, enabled }) => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/role-permissions'] });
      queryClient.invalidateQueries({ queryKey: ['/api/auth/me'] });
      toast({
        title: "Permission updated",
        description: `${ROLE_LABELS[role]?.label ?? role} — ${FEATURE_LABELS[feature]?.label ?? feature}: ${enabled ? 'enabled' : 'disabled'}`,
      });
    },
    onError: (error: any) => {
      toast({ title: "Failed to update permission", description: error.message, variant: "destructive" });
    },
  });

  const handleToggle = (role: string, feature: string, currentValue: boolean) => {
    if (role === 'owner') return; // owners always have all permissions
    mutation.mutate({ role, feature, enabled: !currentValue });
  };

  const roles = data?.roles ?? ['owner', 'admin', 'member', 'viewer'];
  const features = data?.features ?? Object.keys(FEATURE_LABELS);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold flex items-center gap-2">
          <Shield className="h-6 w-6" />
          Role Permissions
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Configure which features each role can access within your organization.
        </p>
      </div>

      {/* Role summary cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {roles.map(role => {
          const info = ROLE_LABELS[role];
          return (
            <div key={role} className="rounded-md border p-3 space-y-1">
              <span className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-medium ${info?.color ?? ''}`}>
                {info?.label ?? role}
              </span>
              <p className="text-xs text-muted-foreground leading-tight">{info?.description}</p>
            </div>
          );
        })}
      </div>

      {/* Permission matrix table */}
      <div className="rounded-md border overflow-x-auto">
        <table className="w-full text-sm" data-testid="role-permissions-table">
          <thead>
            <tr className="border-b bg-muted/40">
              <th className="text-left px-4 py-3 font-medium text-muted-foreground w-64">Feature</th>
              {roles.map(role => (
                <th key={role} className="px-4 py-3 text-center font-medium">
                  <span className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-medium ${ROLE_LABELS[role]?.color ?? ''}`}>
                    {ROLE_LABELS[role]?.label ?? role}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              Array.from({ length: 8 }).map((_, i) => (
                <tr key={i} className="border-b">
                  <td className="px-4 py-3"><Skeleton className="h-4 w-40" /></td>
                  {roles.map(r => (
                    <td key={r} className="px-4 py-3 text-center">
                      <Skeleton className="h-5 w-9 mx-auto rounded-full" />
                    </td>
                  ))}
                </tr>
              ))
            ) : (
              features.map((feature, idx) => {
                const info = FEATURE_LABELS[feature];
                return (
                  <tr
                    key={feature}
                    className={`border-b last:border-0 ${idx % 2 === 0 ? '' : 'bg-muted/20'}`}
                    data-testid={`permission-row-${feature}`}
                  >
                    <td className="px-4 py-3">
                      <div className="font-medium">{info?.label ?? feature}</div>
                      <div className="text-xs text-muted-foreground">{info?.description}</div>
                    </td>
                    {roles.map(role => {
                      const enabled = data?.matrix[role]?.[feature] ?? false;
                      const isOwner = role === 'owner';
                      return (
                        <td key={role} className="px-4 py-3 text-center">
                          <Switch
                            checked={enabled}
                            onCheckedChange={() => handleToggle(role, feature, enabled)}
                            disabled={isOwner || mutation.isPending}
                            aria-label={`${role} ${feature} permission`}
                            data-testid={`toggle-${role}-${feature}`}
                          />
                        </td>
                      );
                    })}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-start gap-2 text-xs text-muted-foreground rounded-md border p-3">
        <Info className="h-4 w-4 mt-0.5 shrink-0" />
        <span>
          Owner permissions are fixed and cannot be restricted. Changes take effect immediately for all active sessions.
          The <strong>Viewer</strong> role has access to SFTP Monitor by default — useful for stakeholders who only need to check file health status.
        </span>
      </div>
    </div>
  );
}
