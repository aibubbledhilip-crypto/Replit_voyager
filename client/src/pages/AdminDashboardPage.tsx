import { useQuery, useMutation } from "@tanstack/react-query";
import StatsCard from "@/components/StatsCard";
import QueryLimitControl from "@/components/QueryLimitControl";
import UserManagementTable from "@/components/UserManagementTable";
import MsisdnTableConfig from "@/components/MsisdnTableConfig";
import { Activity, Users, Clock, Database } from "lucide-react";
import { apiRequest } from "@/lib/api";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

export default function AdminDashboardPage() {
  const { toast } = useToast();
  
  const { data: users = [] } = useQuery({
    queryKey: ['/api/users'],
    queryFn: () => apiRequest('/api/users'),
  });

  const { data: logs = [] } = useQuery({
    queryKey: ['/api/logs'],
    queryFn: () => apiRequest('/api/logs'),
  });

  const { data: exportLimitSetting } = useQuery({
    queryKey: ['/api/settings', 'row_limit'],
    queryFn: () => apiRequest('/api/settings/row_limit'),
  });

  const { data: displayLimitSetting } = useQuery({
    queryKey: ['/api/settings', 'display_limit'],
    queryFn: () => apiRequest('/api/settings/display_limit'),
  });

  const { data: msisdnTablesSf } = useQuery({
    queryKey: ['/api/settings', 'msisdn_table_sf'],
    queryFn: () => apiRequest('/api/settings/msisdn_table_sf'),
  });

  const { data: msisdnTablesAria } = useQuery({
    queryKey: ['/api/settings', 'msisdn_table_aria'],
    queryFn: () => apiRequest('/api/settings/msisdn_table_aria'),
  });

  const { data: msisdnTablesMatrix } = useQuery({
    queryKey: ['/api/settings', 'msisdn_table_matrix'],
    queryFn: () => apiRequest('/api/settings/msisdn_table_matrix'),
  });

  const { data: msisdnTablesTrufinder } = useQuery({
    queryKey: ['/api/settings', 'msisdn_table_trufinder'],
    queryFn: () => apiRequest('/api/settings/msisdn_table_trufinder'),
  });

  const { data: msisdnTablesNokia } = useQuery({
    queryKey: ['/api/settings', 'msisdn_table_nokia'],
    queryFn: () => apiRequest('/api/settings/msisdn_table_nokia'),
  });

  const updateExportLimitMutation = useMutation({
    mutationFn: (limit: number) => 
      apiRequest('/api/settings', {
        method: 'PUT',
        body: JSON.stringify({ key: 'row_limit', value: String(limit) }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/settings', 'row_limit'] });
      toast({
        title: "Success",
        description: "Export limit updated successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update export limit",
        variant: "destructive",
      });
    },
  });

  const updateDisplayLimitMutation = useMutation({
    mutationFn: (limit: number) => 
      apiRequest('/api/settings', {
        method: 'PUT',
        body: JSON.stringify({ key: 'display_limit', value: String(limit) }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/settings', 'display_limit'] });
      toast({
        title: "Success",
        description: "Display limit updated successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update display limit",
        variant: "destructive",
      });
    },
  });

  const updateMsisdnTablesMutation = useMutation({
    mutationFn: async (tables: { sf: string; aria: string; matrix: string; trufinder: string; nokia: string }) => {
      const updates = [
        { key: 'msisdn_table_sf', value: tables.sf },
        { key: 'msisdn_table_aria', value: tables.aria },
        { key: 'msisdn_table_matrix', value: tables.matrix },
        { key: 'msisdn_table_trufinder', value: tables.trufinder },
        { key: 'msisdn_table_nokia', value: tables.nokia },
      ];
      
      for (const update of updates) {
        await apiRequest('/api/settings', {
          method: 'PUT',
          body: JSON.stringify(update),
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/settings'] });
      toast({
        title: "Success",
        description: "MSISDN lookup tables updated successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update MSISDN tables",
        variant: "destructive",
      });
    },
  });

  // Calculate stats
  const activeUsers = users.filter((u: any) => u.status === 'active').length;
  const totalQueries = logs.length;
  const avgQueryTime = logs.length > 0
    ? Math.round(logs.reduce((sum: number, log: any) => sum + log.executionTime, 0) / logs.length)
    : 0;
  const totalDataExtracted = logs.reduce((sum: number, log: any) => sum + log.rowsReturned, 0);

  const formattedUsers = users.map((user: any) => ({
    ...user,
    email: `${user.username}@company.com`,
    lastActive: user.lastActive 
      ? new Date(user.lastActive).toLocaleString() 
      : 'Never',
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold mb-2">Admin Dashboard</h1>
        <p className="text-muted-foreground">Overview of system usage and user activity</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard 
          title="Total Queries"
          value={totalQueries}
          description="All time"
          icon={Activity}
        />
        <StatsCard 
          title="Active Users"
          value={activeUsers}
          description={`${users.length} total users`}
          icon={Users}
        />
        <StatsCard 
          title="Avg Query Time"
          value={`${avgQueryTime}ms`}
          description="Average execution"
          icon={Clock}
        />
        <StatsCard 
          title="Rows Extracted"
          value={totalDataExtracted.toLocaleString()}
          description="Total all time"
          icon={Database}
        />
      </div>

      <QueryLimitControl 
        displayLimit={displayLimitSetting ? parseInt(displayLimitSetting.value) : 10000}
        exportLimit={exportLimitSetting ? parseInt(exportLimitSetting.value) : 1000}
        onUpdateDisplayLimit={(limit) => updateDisplayLimitMutation.mutate(limit)}
        onUpdateExportLimit={(limit) => updateExportLimitMutation.mutate(limit)}
      />

      <MsisdnTableConfig 
        tables={{
          sf: msisdnTablesSf?.value || 'vw_sf_all_segment_hierarchy',
          aria: msisdnTablesAria?.value || 'vw_aria_hierarchy_all_status_reverse',
          matrix: msisdnTablesMatrix?.value || 'vw_matrixx_plan',
          trufinder: msisdnTablesTrufinder?.value || 'vw_true_finder_raw',
          nokia: msisdnTablesNokia?.value || 'vw_nokia_raw',
        }}
        onSave={(tables) => updateMsisdnTablesMutation.mutate(tables)}
        isLoading={updateMsisdnTablesMutation.isPending}
      />

      <UserManagementTable users={formattedUsers} />
    </div>
  );
}
