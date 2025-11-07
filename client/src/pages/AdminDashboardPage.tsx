import { useEffect, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import StatsCard from "@/components/StatsCard";
import QueryLimitControl from "@/components/QueryLimitControl";
import UserManagementTable from "@/components/UserManagementTable";
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

  const { data: rowLimitSetting } = useQuery({
    queryKey: ['/api/settings', 'row_limit'],
    queryFn: () => apiRequest('/api/settings/row_limit'),
  });

  const updateLimitMutation = useMutation({
    mutationFn: (limit: number) => 
      apiRequest('/api/settings', {
        method: 'PUT',
        body: JSON.stringify({ key: 'row_limit', value: String(limit) }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/settings', 'row_limit'] });
      toast({
        title: "Success",
        description: "Row limit updated successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update row limit",
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
        currentLimit={rowLimitSetting ? parseInt(rowLimitSetting.value) : 1000}
        onUpdate={(limit) => updateLimitMutation.mutate(limit)}
      />

      <UserManagementTable users={formattedUsers} />
    </div>
  );
}