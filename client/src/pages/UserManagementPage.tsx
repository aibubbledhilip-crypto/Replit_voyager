import { useQuery } from "@tanstack/react-query";
import UserManagementTable from "@/components/UserManagementTable";
import { apiRequest } from "@/lib/api";

export default function UserManagementPage() {
  const { data: users = [], isLoading } = useQuery({
    queryKey: ['/api/users'],
    queryFn: () => apiRequest('/api/users'),
  });

  const formattedUsers = users.map((user: any) => ({
    ...user,
    lastActive: user.lastActive 
      ? new Date(user.lastActive).toLocaleString() 
      : 'Never',
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold mb-2" data-testid="text-user-management-title">User Management</h1>
        <p className="text-muted-foreground">Manage users, roles, and permissions</p>
      </div>

      {isLoading ? (
        <div className="text-muted-foreground">Loading users...</div>
      ) : (
        <UserManagementTable users={formattedUsers} />
      )}
    </div>
  );
}
