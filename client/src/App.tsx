import { useState, useEffect } from "react";
import { Switch, Route, useLocation, Redirect } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider, useQuery } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppSidebar } from "@/components/app-sidebar";
import { SidebarToggleContext } from "@/lib/sidebar-context";
import Header from "@/components/Header";
import LoginPage from "@/components/LoginPage";
import SignupPage from "@/pages/SignupPage";
import VerifyEmailSentPage from "@/pages/VerifyEmailSentPage";
import VerifyEmailPage from "@/pages/VerifyEmailPage";
import QueryExecutionPage from "@/pages/QueryExecutionPage";
import ExplorerPage from "@/pages/ExplorerPage";
import FileComparisonPage from "@/pages/FileComparisonPage";
import FileAggregatePage from "@/pages/FileAggregatePage";
import AdminDashboardPage from "@/pages/AdminDashboardPage";
import UserManagementPage from "@/pages/UserManagementPage";
import UsageLogsPage from "@/pages/UsageLogsPage";
import SftpConfigPage from "@/pages/SftpConfigPage";
import SftpMonitorPage from "@/pages/SftpMonitorPage";
import ExplorerConfigPage from "@/pages/ExplorerConfigPage";
import AIConfigPage from "@/pages/AIConfigPage";
import AwsConfigPage from "@/pages/AwsConfigPage";
import DatabaseConnectionsPage from "@/pages/DatabaseConnectionsPage";
import BillingPage from "@/pages/BillingPage";
import SuperAdminPage from "@/pages/SuperAdminPage";
import ChartDashboardPage from "@/pages/ChartDashboardPage";
import RolePermissionsPage from "@/pages/RolePermissionsPage";
import ApiKeysPage from "@/pages/ApiKeysPage";
import NotFound from "@/pages/not-found";
import { apiRequest } from "@/lib/api";

export interface AuthUser {
  id: string;
  email: string;
  username: string;
  role: 'admin' | 'user';
  orgRole?: 'owner' | 'admin' | 'member' | 'viewer' | null;
  organizationId?: string;
  isSuperAdmin?: boolean;
  impersonating?: { organizationId: string; organizationName: string } | null;
  permissions?: string[];
}

function hasPermission(user: AuthUser | undefined, feature: string): boolean {
  if (!user) return false;
  if (user.isSuperAdmin) return true;
  return user.permissions?.includes(feature) ?? false;
}

function isOrgAdmin(user: AuthUser | undefined): boolean {
  if (!user) return false;
  if (user.isSuperAdmin) return true;
  return ['owner', 'admin'].includes(user.orgRole ?? '');
}

function AuthenticatedApp() {
  const [location, setLocation] = useLocation();
  const { data: user, isLoading } = useQuery<AuthUser>({
    queryKey: ['/api/auth/me'],
  });
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const toggleSidebar = () => setSidebarOpen(prev => !prev);
  
  const publicRoutes = ['/login', '/signup', '/invite', '/verify-email-sent', '/verify-email'];
  const isPublicRoute = publicRoutes.some(route => location.startsWith(route));
  
  const isFullWidthPage = location === "/" || location === "/explorer";

  useEffect(() => {
    if (user && (location === '/login' || location === '/signup')) {
      setLocation('/');
    }
  }, [user, location, setLocation]);

  const handleLogout = async () => {
    try {
      await apiRequest('/api/auth/logout', { method: 'POST' });
      queryClient.clear();
      window.location.reload();
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  if (isLoading && !isPublicRoute) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (isPublicRoute) {
    if (user && (location === '/login' || location === '/signup')) {
      return (
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-muted-foreground">Redirecting...</div>
        </div>
      );
    }
    return (
      <Switch>
        <Route path="/login" component={LoginPage} />
        <Route path="/signup" component={SignupPage} />
        <Route path="/verify-email-sent" component={VerifyEmailSentPage} />
        <Route path="/verify-email" component={VerifyEmailPage} />
        <Route component={LoginPage} />
      </Switch>
    );
  }

  if (!user) {
    return <LoginPage />;
  }

  // Permission-gated page wrapper
  const PermissionGate = ({ feature, children }: { feature: string; children: JSX.Element }) => {
    if (!hasPermission(user, feature)) {
      return (
        <div className="flex flex-col items-center justify-center h-64 gap-3">
          <div className="text-muted-foreground text-center">
            <p className="font-medium">Access Restricted</p>
            <p className="text-sm mt-1">You don't have permission to access this feature.</p>
          </div>
        </div>
      );
    }
    return children;
  };

  const AdminGate = ({ children }: { children: JSX.Element }) => {
    if (!isOrgAdmin(user)) {
      return (
        <div className="flex flex-col items-center justify-center h-64 gap-3">
          <div className="text-muted-foreground text-center">
            <p className="font-medium">Admin Access Required</p>
            <p className="text-sm mt-1">Only organization admins can access this page.</p>
          </div>
        </div>
      );
    }
    return children;
  };

  return (
    <SidebarToggleContext.Provider value={{ isOpen: sidebarOpen, toggle: toggleSidebar }}>
      <div className="flex flex-col h-screen w-full">
        <Header 
          userRole={user.role}
          userName={user.username}
          isSuperAdmin={user.isSuperAdmin}
          impersonating={user.impersonating}
          onLogout={handleLogout}
        />
        <div className="flex flex-1 min-h-0 w-full">
          <div
            className="bg-sidebar border-r transition-[width] duration-200 ease-linear overflow-hidden shrink-0"
            style={{ width: sidebarOpen ? '250px' : '0px' }}
            data-testid="sidebar-wrapper"
          >
            <div className="w-[250px] h-full">
              <AppSidebar
                userRole={user.role}
                isSuperAdmin={user.isSuperAdmin}
                permissions={user.permissions ?? []}
                orgRole={user.orgRole}
              />
            </div>
          </div>
          <main className="flex-1 overflow-auto min-w-0">
            <div className={`p-6 ${isFullWidthPage ? 'h-full' : 'max-w-7xl mx-auto'}`}>
              <Switch>
                <Route path="/">
                  <PermissionGate feature="execute_queries"><QueryExecutionPage /></PermissionGate>
                </Route>
                <Route path="/explorer">
                  <PermissionGate feature="explorer"><ExplorerPage /></PermissionGate>
                </Route>
                <Route path="/file-comparison">
                  <PermissionGate feature="file_compare"><FileComparisonPage /></PermissionGate>
                </Route>
                <Route path="/file-aggregate">
                  <PermissionGate feature="file_aggregate"><FileAggregatePage /></PermissionGate>
                </Route>
                <Route path="/depiction">
                  <PermissionGate feature="depiction"><ChartDashboardPage /></PermissionGate>
                </Route>
                <Route path="/sftp-monitor">
                  <PermissionGate feature="sftp_monitor"><SftpMonitorPage /></PermissionGate>
                </Route>
                <Route path="/admin">
                  <AdminGate><AdminDashboardPage /></AdminGate>
                </Route>
                <Route path="/admin/users">
                  <AdminGate><UserManagementPage /></AdminGate>
                </Route>
                <Route path="/admin/logs">
                  <AdminGate><UsageLogsPage /></AdminGate>
                </Route>
                <Route path="/admin/sftp-config">
                  <AdminGate><SftpConfigPage /></AdminGate>
                </Route>
                <Route path="/admin/explorer-config">
                  <AdminGate><ExplorerConfigPage /></AdminGate>
                </Route>
                <Route path="/admin/ai-config">
                  <AdminGate><AIConfigPage /></AdminGate>
                </Route>
                <Route path="/admin/aws-config">
                  <AdminGate><AwsConfigPage /></AdminGate>
                </Route>
                <Route path="/admin/db-connections">
                  <AdminGate><DatabaseConnectionsPage /></AdminGate>
                </Route>
                <Route path="/admin/role-permissions">
                  <AdminGate><RolePermissionsPage /></AdminGate>
                </Route>
                <Route path="/settings/api-keys" component={ApiKeysPage} />
                <Route path="/billing" component={BillingPage} />
                <Route path="/super-admin" component={SuperAdminPage} />
                <Route component={NotFound} />
              </Switch>
            </div>
          </main>
        </div>
      </div>
    </SidebarToggleContext.Provider>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AuthenticatedApp />
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}
