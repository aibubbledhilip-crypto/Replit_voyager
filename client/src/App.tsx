import { useState, useEffect } from "react";
import { Switch, Route, useLocation, Redirect } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider, useQuery } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import Header from "@/components/Header";
import LoginPage from "@/components/LoginPage";
import SignupPage from "@/pages/SignupPage";
import QueryExecutionPage from "@/pages/QueryExecutionPage";
import ExplorerPage from "@/pages/ExplorerPage";
import FileComparisonPage from "@/pages/FileComparisonPage";
import AdminDashboardPage from "@/pages/AdminDashboardPage";
import UserManagementPage from "@/pages/UserManagementPage";
import UsageLogsPage from "@/pages/UsageLogsPage";
import SftpConfigPage from "@/pages/SftpConfigPage";
import SftpMonitorPage from "@/pages/SftpMonitorPage";
import ExplorerConfigPage from "@/pages/ExplorerConfigPage";
import AIConfigPage from "@/pages/AIConfigPage";
import BillingPage from "@/pages/BillingPage";
import SuperAdminPage from "@/pages/SuperAdminPage";
import NotFound from "@/pages/not-found";
import { apiRequest } from "@/lib/api";

interface AuthUser {
  id: string;
  username: string;
  role: 'admin' | 'user';
  isSuperAdmin?: boolean;
  impersonating?: { organizationId: string; organizationName: string } | null;
}

function AuthenticatedApp() {
  const [location, setLocation] = useLocation();
  const { data: user, isLoading } = useQuery<AuthUser>({
    queryKey: ['/api/auth/me'],
  });
  
  // Public routes that don't require authentication
  const publicRoutes = ['/login', '/signup', '/invite'];
  const isPublicRoute = publicRoutes.some(route => location.startsWith(route));
  
  // Query Execution and Explorer pages use full width
  const isFullWidthPage = location === "/" || location === "/explorer";

  // Redirect logged-in users away from login/signup pages
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

  // Handle public routes
  if (isPublicRoute) {
    // Wait for redirect effect to run
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
        <Route component={LoginPage} />
      </Switch>
    );
  }

  if (!user) {
    return <LoginPage />;
  }

  const sidebarStyle = {
    "--sidebar-width": "250px",
  };

  return (
    <SidebarProvider style={sidebarStyle as React.CSSProperties}>
      <div className="flex h-screen w-full">
        <AppSidebar userRole={user.role} isSuperAdmin={user.isSuperAdmin} />
        <div className="flex flex-col flex-1 min-w-0">
          <Header 
            userRole={user.role}
            userName={user.username}
            isSuperAdmin={user.isSuperAdmin}
            impersonating={user.impersonating}
            onLogout={handleLogout}
          />
          <main className="flex-1 overflow-auto">
            <div className={`p-6 ${isFullWidthPage ? 'h-full' : 'max-w-7xl mx-auto'}`}>
              <Switch>
                <Route path="/" component={QueryExecutionPage} />
                <Route path="/explorer" component={ExplorerPage} />
                <Route path="/file-comparison" component={FileComparisonPage} />
                <Route path="/admin" component={AdminDashboardPage} />
                <Route path="/admin/users" component={UserManagementPage} />
                <Route path="/admin/logs" component={UsageLogsPage} />
                <Route path="/admin/sftp-config" component={SftpConfigPage} />
                <Route path="/admin/explorer-config" component={ExplorerConfigPage} />
                <Route path="/admin/ai-config" component={AIConfigPage} />
                <Route path="/sftp-monitor" component={SftpMonitorPage} />
                <Route path="/billing" component={BillingPage} />
                <Route path="/super-admin" component={SuperAdminPage} />
                <Route component={NotFound} />
              </Switch>
            </div>
          </main>
        </div>
      </div>
    </SidebarProvider>
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
