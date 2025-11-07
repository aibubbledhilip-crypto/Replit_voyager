import StatsCard from "@/components/StatsCard";
import QueryLimitControl from "@/components/QueryLimitControl";
import UserManagementTable from "@/components/UserManagementTable";
import { Activity, Users, Clock, Database } from "lucide-react";

export default function AdminDashboardPage() {
  const mockUsers = [
    { id: '1', username: 'sarah.chen', email: 'sarah.chen@company.com', role: 'admin' as const, lastActive: '2 min ago', status: 'active' as const },
    { id: '2', username: 'john.doe', email: 'john.doe@company.com', role: 'user' as const, lastActive: '1 hour ago', status: 'active' as const },
    { id: '3', username: 'alice.smith', email: 'alice.smith@company.com', role: 'user' as const, lastActive: '3 days ago', status: 'inactive' as const },
    { id: '4', username: 'bob.wilson', email: 'bob.wilson@company.com', role: 'user' as const, lastActive: '5 hours ago', status: 'active' as const },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold mb-2">Admin Dashboard</h1>
        <p className="text-muted-foreground">Overview of system usage and user activity</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard 
          title="Total Queries"
          value="1,247"
          description="Last 30 days"
          icon={Activity}
          trend={{ value: 12, label: 'from last month' }}
        />
        <StatsCard 
          title="Active Users"
          value="24"
          description="Currently online"
          icon={Users}
        />
        <StatsCard 
          title="Avg Query Time"
          value="342ms"
          description="Average execution"
          icon={Clock}
          trend={{ value: -8, label: 'improvement' }}
        />
        <StatsCard 
          title="Data Extracted"
          value="2.4GB"
          description="Total this month"
          icon={Database}
        />
      </div>

      <QueryLimitControl 
        currentLimit={1000}
        onUpdate={(limit) => console.log('Updated limit:', limit)}
      />

      <UserManagementTable users={mockUsers} />
    </div>
  );
}