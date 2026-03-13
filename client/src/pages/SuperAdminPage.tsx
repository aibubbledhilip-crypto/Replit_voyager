import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { Building2, Users, Activity, Shield, Eye, Trash2, KeyRound, Loader2 } from "lucide-react";
import { format } from "date-fns";

interface PlatformStats {
  totalOrganizations: number;
  activeOrganizations: number;
  totalUsers: number;
  activeUsers: number;
  superAdmins: number;
  totalQueries: number;
  queriesLast7Days: number;
}

interface OrgWithDetails {
  id: string;
  name: string;
  slug: string;
  status: string;
  createdAt: string;
  memberCount: number;
  subscription: {
    planName: string;
    status: string;
  } | null;
}

interface UserWithDetails {
  id: string;
  email: string;
  username: string;
  role: string;
  status: string;
  isSuperAdmin: boolean;
  createdAt: string;
  lastActive: string | null;
  organizations: { id: string; name: string }[];
}

export default function SuperAdminPage() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("overview");
  const [resetPasswordUser, setResetPasswordUser] = useState<UserWithDetails | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [manageOrgsUser, setManageOrgsUser] = useState<UserWithDetails | null>(null);

  const { data: stats, isLoading: statsLoading } = useQuery<PlatformStats>({
    queryKey: ["/api/super-admin/stats"],
  });

  const { data: organizations, isLoading: orgsLoading } = useQuery<OrgWithDetails[]>({
    queryKey: ["/api/super-admin/organizations"],
  });

  const { data: users, isLoading: usersLoading } = useQuery<UserWithDetails[]>({
    queryKey: ["/api/super-admin/users"],
  });

  const impersonateMutation = useMutation({
    mutationFn: async (organizationId: string) => {
      return apiRequest("POST", `/api/super-admin/impersonate/${organizationId}`);
    },
    onSuccess: () => {
      toast({ title: "Impersonation active", description: "You are now viewing as this organization" });
      window.location.reload();
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const deleteOrgMutation = useMutation({
    mutationFn: async (orgId: string) => {
      return apiRequest("DELETE", `/api/super-admin/organizations/${orgId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/super-admin/organizations"] });
      queryClient.invalidateQueries({ queryKey: ["/api/super-admin/stats"] });
      toast({ title: "Organization deleted", description: "The organization and all its data have been removed." });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const resetPasswordMutation = useMutation({
    mutationFn: async ({ userId, password }: { userId: string; password: string }) => {
      return apiRequest("POST", `/api/super-admin/users/${userId}/reset-password`, { newPassword: password });
    },
    onSuccess: () => {
      setResetPasswordUser(null);
      setNewPassword("");
      toast({ title: "Password reset", description: "The user's password has been updated." });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const removeFromOrgMutation = useMutation({
    mutationFn: async ({ userId, orgId }: { userId: string; orgId: string }) => {
      return apiRequest("DELETE", `/api/super-admin/users/${userId}/organizations/${orgId}`);
    },
    onSuccess: (_, { userId, orgId }) => {
      queryClient.invalidateQueries({ queryKey: ["/api/super-admin/users"] });
      // Optimistically update the dialog user's org list
      setManageOrgsUser((prev) =>
        prev && prev.id === userId
          ? { ...prev, organizations: prev.organizations.filter((o) => o.id !== orgId) }
          : prev
      );
      toast({ title: "Removed", description: "User removed from organization." });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const toggleSuperAdminMutation = useMutation({
    mutationFn: async ({ userId, isSuperAdmin }: { userId: string; isSuperAdmin: boolean }) => {
      return apiRequest("PATCH", `/api/super-admin/users/${userId}/super-admin`, { isSuperAdmin });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/super-admin/users"] });
      queryClient.invalidateQueries({ queryKey: ["/api/super-admin/stats"] });
      toast({ title: "Updated", description: "Super admin status updated" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const handleResetPasswordSubmit = () => {
    if (!resetPasswordUser || !newPassword) return;
    resetPasswordMutation.mutate({ userId: resetPasswordUser.id, password: newPassword });
  };

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-2">
          <Shield className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold" data-testid="text-page-title">Platform Administration</h1>
        </div>
        <p className="text-muted-foreground">Manage all organizations, users, and platform settings</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-6">
          <TabsTrigger value="overview" data-testid="tab-overview">Overview</TabsTrigger>
          <TabsTrigger value="organizations" data-testid="tab-organizations">Organizations</TabsTrigger>
          <TabsTrigger value="users" data-testid="tab-users">Users</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          {statsLoading ? (
            <div className="text-muted-foreground">Loading statistics...</div>
          ) : stats ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Organizations</CardTitle>
                  <Building2 className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold" data-testid="text-total-orgs">{stats.totalOrganizations}</div>
                  <p className="text-xs text-muted-foreground">{stats.activeOrganizations} active</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Users</CardTitle>
                  <Users className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold" data-testid="text-total-users">{stats.totalUsers}</div>
                  <p className="text-xs text-muted-foreground">
                    {stats.activeUsers} active, {stats.superAdmins} super admins
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Queries</CardTitle>
                  <Activity className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold" data-testid="text-total-queries">{stats.totalQueries}</div>
                  <p className="text-xs text-muted-foreground">{stats.queriesLast7Days} in last 7 days</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Super Admins</CardTitle>
                  <Shield className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold" data-testid="text-super-admins">{stats.superAdmins}</div>
                  <p className="text-xs text-muted-foreground">Platform administrators</p>
                </CardContent>
              </Card>
            </div>
          ) : null}
        </TabsContent>

        <TabsContent value="organizations">
          <Card>
            <CardHeader>
              <CardTitle>All Organizations</CardTitle>
              <CardDescription>View and manage all organizations on the platform</CardDescription>
            </CardHeader>
            <CardContent>
              {orgsLoading ? (
                <div className="text-muted-foreground">Loading organizations...</div>
              ) : organizations && organizations.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Organization</TableHead>
                      <TableHead>Members</TableHead>
                      <TableHead>Plan</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {organizations.map((org) => (
                      <TableRow key={org.id} data-testid={`row-org-${org.id}`}>
                        <TableCell>
                          <div>
                            <div className="font-medium">{org.name}</div>
                            <div className="text-sm text-muted-foreground">{org.slug}</div>
                          </div>
                        </TableCell>
                        <TableCell>{org.memberCount}</TableCell>
                        <TableCell>
                          <Badge variant={org.subscription ? "default" : "secondary"}>
                            {org.subscription?.planName || "Free"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant={org.status === "active" ? "default" : "secondary"}>
                            {org.status}
                          </Badge>
                        </TableCell>
                        <TableCell>{format(new Date(org.createdAt), "MMM d, yyyy")}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => impersonateMutation.mutate(org.id)}
                              disabled={impersonateMutation.isPending}
                              data-testid={`button-impersonate-${org.id}`}
                            >
                              <Eye className="h-4 w-4 mr-1" />
                              View As
                            </Button>
                            {org.id !== 'default-org' && (
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="text-destructive"
                                    data-testid={`button-delete-org-${org.id}`}
                                  >
                                    <Trash2 className="h-4 w-4 mr-1" />
                                    Delete
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Delete Organization</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      This will permanently delete <strong>{org.name}</strong> and all its data — users, queries, settings, connections, and charts. This action cannot be undone.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    <AlertDialogAction
                                      className="bg-destructive text-destructive-foreground"
                                      onClick={() => deleteOrgMutation.mutate(org.id)}
                                      data-testid={`button-confirm-delete-org-${org.id}`}
                                    >
                                      Delete Organization
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="text-muted-foreground">No organizations found</div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="users">
          <Card>
            <CardHeader>
              <CardTitle>All Users</CardTitle>
              <CardDescription>View and manage all users on the platform</CardDescription>
            </CardHeader>
            <CardContent>
              {usersLoading ? (
                <div className="text-muted-foreground">Loading users...</div>
              ) : users && users.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>User</TableHead>
                      <TableHead>Organizations</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Super Admin</TableHead>
                      <TableHead>Last Active</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {users.map((user) => (
                      <TableRow key={user.id} data-testid={`row-user-${user.id}`}>
                        <TableCell>
                          <div>
                            <div className="font-medium">{user.username}</div>
                            <div className="text-sm text-muted-foreground">{user.email}</div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {user.organizations.length > 0 ? (
                              user.organizations.slice(0, 2).map((org) => (
                                <Badge key={org.id} variant="outline" className="text-xs">
                                  {org.name}
                                </Badge>
                              ))
                            ) : (
                              <span className="text-muted-foreground text-sm">None</span>
                            )}
                            {user.organizations.length > 2 && (
                              <Badge variant="outline" className="text-xs">
                                +{user.organizations.length - 2}
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary">{user.role}</Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant={user.status === "active" ? "default" : "secondary"}>
                            {user.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Switch
                            checked={user.isSuperAdmin}
                            onCheckedChange={(checked) =>
                              toggleSuperAdminMutation.mutate({ userId: user.id, isSuperAdmin: checked })
                            }
                            disabled={toggleSuperAdminMutation.isPending}
                            data-testid={`switch-super-admin-${user.id}`}
                          />
                        </TableCell>
                        <TableCell>
                          {user.lastActive
                            ? format(new Date(user.lastActive), "MMM d, yyyy HH:mm")
                            : "Never"}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setManageOrgsUser(user)}
                              data-testid={`button-manage-orgs-${user.id}`}
                            >
                              <Building2 className="h-4 w-4 mr-1" />
                              Orgs
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => { setResetPasswordUser(user); setNewPassword(""); }}
                              data-testid={`button-reset-password-${user.id}`}
                            >
                              <KeyRound className="h-4 w-4 mr-1" />
                              Reset PW
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="text-muted-foreground">No users found</div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Manage Orgs Dialog */}
      <Dialog open={!!manageOrgsUser} onOpenChange={(open) => { if (!open) setManageOrgsUser(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Organization Memberships</DialogTitle>
          </DialogHeader>
          <div className="py-2">
            {manageOrgsUser && (
              <p className="text-sm text-muted-foreground mb-4">
                Managing organizations for <strong>{manageOrgsUser.username}</strong> ({manageOrgsUser.email})
              </p>
            )}
            {manageOrgsUser && manageOrgsUser.organizations.length === 0 ? (
              <p className="text-sm text-muted-foreground">This user is not a member of any organization.</p>
            ) : (
              <div className="space-y-2">
                {manageOrgsUser?.organizations.map((org) => (
                  <div key={org.id} className="flex items-center justify-between px-3 py-2 rounded-md border">
                    <div className="flex items-center gap-2">
                      <Building2 className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm">{org.name}</span>
                    </div>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive"
                          data-testid={`button-remove-from-org-${org.id}`}
                        >
                          <Trash2 className="h-4 w-4 mr-1" />
                          Remove
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Remove from Organization</AlertDialogTitle>
                          <AlertDialogDescription>
                            Remove <strong>{manageOrgsUser?.username}</strong> from <strong>{org.name}</strong>? Their account will remain but they will lose access to this organization.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            className="bg-destructive text-destructive-foreground"
                            onClick={() => removeFromOrgMutation.mutate({ userId: manageOrgsUser!.id, orgId: org.id })}
                            data-testid={`button-confirm-remove-from-org-${org.id}`}
                          >
                            Remove
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                ))}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setManageOrgsUser(null)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reset Password Dialog */}
      <Dialog open={!!resetPasswordUser} onOpenChange={(open) => { if (!open) { setResetPasswordUser(null); setNewPassword(""); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reset Password</DialogTitle>
          </DialogHeader>
          <div className="py-2 space-y-4">
            {resetPasswordUser && (
              <p className="text-sm text-muted-foreground">
                Setting a new password for <strong>{resetPasswordUser.username}</strong> ({resetPasswordUser.email})
              </p>
            )}
            <div className="space-y-2">
              <Label htmlFor="new-password">New Password</Label>
              <Input
                id="new-password"
                type="password"
                placeholder="Minimum 8 characters"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleResetPasswordSubmit()}
                data-testid="input-new-password"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setResetPasswordUser(null); setNewPassword(""); }}>
              Cancel
            </Button>
            <Button
              onClick={handleResetPasswordSubmit}
              disabled={newPassword.length < 8 || resetPasswordMutation.isPending}
              data-testid="button-confirm-reset-password"
            >
              {resetPasswordMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Reset Password
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
