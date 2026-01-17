import { useState, useEffect } from "react";
import { Switch, Route, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider, useQuery } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import Header from "@/components/Header";
import LoginPage from "@/components/LoginPage";
import QueryExecutionPage from "@/pages/QueryExecutionPage";
import ExplorerPage from "@/pages/ExplorerPage";
import FileComparisonPage from "@/pages/FileComparisonPage";
import AdminDashboardPage from "@/pages/AdminDashboardPage";
import UsageLogsPage from "@/pages/UsageLogsPage";
import SftpConfigPage from "@/pages/SftpConfigPage";
import SftpMonitorPage from "@/pages/SftpMonitorPage";
import ExplorerConfigPage from "@/pages/ExplorerConfigPage";
import NotFound from "@/pages/not-found";
import { apiRequest } from "@/lib/api";

interface AuthUser {
  id: string;
  username: string;
  role: 'admin' | 'user';
}

function AuthenticatedApp() {
  const [location] = useLocation();
  const { data: user, isLoading } = useQuery<AuthUser>({
    queryKey: ['/api/auth/me'],
  });
  
  // Query Execution and Explorer pages use full width
  const isFullWidthPage = location === "/" || location === "/explorer";

  const handleLogout = async () => {
    try {
      await apiRequest('/api/auth/logout', { method: 'POST' });
      queryClient.clear();
      window.location.reload();
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (!user) {
    return <LoginPage />;
  }

  const sidebarStyle = {
    "--sidebar-width": "16rem",
  };

  return (
    <SidebarProvider style={sidebarStyle as React.CSSProperties}>
      <div className="flex h-screen w-full">
        <AppSidebar userRole={user.role} />
        <div className="flex flex-col flex-1 overflow-hidden">
          <Header 
            userRole={user.role}
            userName={user.username}
            onLogout={handleLogout}
          />
          <div className="flex items-center p-2 border-b bg-background">
            <SidebarTrigger data-testid="button-sidebar-toggle" />
          </div>
          <main className="flex-1 overflow-auto">
            <div className={`p-6 ${isFullWidthPage ? 'h-full' : 'max-w-7xl mx-auto'}`}>
              <Switch>
                <Route path="/" component={QueryExecutionPage} />
                <Route path="/explorer" component={ExplorerPage} />
                <Route path="/file-comparison" component={FileComparisonPage} />
                <Route path="/admin" component={AdminDashboardPage} />
                <Route path="/admin/logs" component={UsageLogsPage} />
                <Route path="/admin/sftp-config" component={SftpConfigPage} />
                <Route path="/admin/explorer-config" component={ExplorerConfigPage} />
                <Route path="/sftp-monitor" component={SftpMonitorPage} />
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
