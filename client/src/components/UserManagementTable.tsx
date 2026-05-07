import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Users, MoreVertical } from "lucide-react";
import CreateUserDialog from "@/components/CreateUserDialog";
import ResetPasswordDialog from "@/components/ResetPasswordDialog";
import { apiRequest } from "@/lib/api";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type OrgRole = 'owner' | 'admin' | 'member' | 'viewer';

interface User {
  id: string;
  username: string;
  email: string;
  role: 'admin' | 'user';
  orgRole?: OrgRole;
  lastActive: string;
  status: 'active' | 'inactive';
}

interface UserManagementTableProps {
  users?: User[];
}

const ORG_ROLE_COLORS: Record<OrgRole, string> = {
  owner:  "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
  admin:  "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  member: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  viewer: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
};

function OrgRoleBadge({ role }: { role?: OrgRole }) {
  if (!role) return null;
  return (
    <span className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-medium capitalize ${ORG_ROLE_COLORS[role] ?? ''}`}>
      {role}
    </span>
  );
}

export default function UserManagementTable({ users = [] }: UserManagementTableProps) {
  const { toast } = useToast();

  const updateOrgRoleMutation = useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: string }) =>
      apiRequest(`/api/users/${userId}/org-role`, {
        method: 'PATCH',
        body: JSON.stringify({ role }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/users'] });
      toast({ title: "Org role updated" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to update org role", variant: "destructive" });
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: ({ userId, status }: { userId: string; status: string }) =>
      apiRequest(`/api/users/${userId}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/users'] });
      toast({ title: "Success", description: "User status updated successfully" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to update status", variant: "destructive" });
    },
  });

  const createUserMutation = useMutation({
    mutationFn: (newUser: { username: string; email: string; password: string; role: 'admin' | 'user' }) =>
      apiRequest('/api/users', {
        method: 'POST',
        body: JSON.stringify(newUser),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/users'] });
      toast({ title: "Success", description: "User created successfully" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to create user", variant: "destructive" });
    },
  });

  const resetPasswordMutation = useMutation({
    mutationFn: ({ userId, password }: { userId: string; password: string }) =>
      apiRequest(`/api/users/${userId}/password`, {
        method: 'PATCH',
        body: JSON.stringify({ password }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/users'] });
      toast({ title: "Success", description: "Password reset successfully" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to reset password", variant: "destructive" });
    },
  });

  const handleOrgRoleChange = (userId: string, newRole: OrgRole) => {
    updateOrgRoleMutation.mutate({ userId, role: newRole });
  };

  const handleToggleStatus = (userId: string, currentStatus: string) => {
    const newStatus = currentStatus === 'active' ? 'inactive' : 'active';
    updateStatusMutation.mutate({ userId, status: newStatus });
  };

  const handleResetPassword = (userId: string, newPassword: string) => {
    resetPasswordMutation.mutate({ userId, password: newPassword });
  };

  return (
    <Card data-testid="card-user-management">
      <CardHeader>
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" />
              <CardTitle className="text-lg font-medium">User Management</CardTitle>
            </div>
            <CardDescription className="mt-1">
              Manage users, org roles, and access permissions
            </CardDescription>
          </div>
          <CreateUserDialog onCreateUser={(user) => createUserMutation.mutate(user)} />
        </div>
      </CardHeader>
      <CardContent>
        <div className="border rounded-md overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="font-semibold">Username</TableHead>
                <TableHead className="font-semibold">Email</TableHead>
                <TableHead className="font-semibold">Org Role</TableHead>
                <TableHead className="font-semibold">Last Active</TableHead>
                <TableHead className="font-semibold">Status</TableHead>
                <TableHead className="font-semibold w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((user) => {
                const isOwner = user.orgRole === 'owner';
                return (
                  <TableRow key={user.id} data-testid={`row-user-${user.id}`}>
                    <TableCell className="font-medium" data-testid={`text-username-${user.id}`}>
                      {user.username}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {user.email}
                    </TableCell>
                    <TableCell>
                      {isOwner ? (
                        <OrgRoleBadge role="owner" />
                      ) : (
                        <Select
                          value={user.orgRole ?? 'member'}
                          onValueChange={(value: OrgRole) => handleOrgRoleChange(user.id, value)}
                          disabled={updateOrgRoleMutation.isPending}
                        >
                          <SelectTrigger className="w-28" data-testid={`select-org-role-${user.id}`}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="admin">Admin</SelectItem>
                            <SelectItem value="member">Member</SelectItem>
                            <SelectItem value="viewer">Viewer</SelectItem>
                          </SelectContent>
                        </Select>
                      )}
                    </TableCell>
                    <TableCell className="text-sm">
                      {user.lastActive}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={user.status === 'active' ? 'default' : 'secondary'}
                        className="text-xs"
                        data-testid={`badge-status-${user.id}`}
                      >
                        {user.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" data-testid={`button-actions-${user.id}`}>
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuLabel>Actions</DropdownMenuLabel>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => handleToggleStatus(user.id, user.status)}>
                            {user.status === 'active' ? 'Deactivate' : 'Activate'}
                          </DropdownMenuItem>
                          <DropdownMenuItem asChild>
                            <ResetPasswordDialog
                              userId={user.id}
                              username={user.username}
                              onResetPassword={handleResetPassword}
                              trigger={
                                <div
                                  className="relative flex cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none transition-colors hover:bg-accent hover:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50"
                                  data-testid={`button-open-reset-password-${user.id}`}
                                >
                                  Reset Password
                                </div>
                              }
                            />
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
