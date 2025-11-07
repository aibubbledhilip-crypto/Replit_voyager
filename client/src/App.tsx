import { useState } from "react";
import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import Header from "@/components/Header";
import LoginPage from "@/components/LoginPage";
import QueryExecutionPage from "@/pages/QueryExecutionPage";
import AdminDashboardPage from "@/pages/AdminDashboardPage";
import UsageLogsPage from "@/pages/UsageLogsPage";
import NotFound from "@/pages/not-found";

function Router() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userRole] = useState<'admin' | 'user'>('admin');

  if (!isAuthenticated) {
    return <LoginPage />;
  }

  const sidebarStyle = {
    "--sidebar-width": "16rem",
  };

  return (
    <SidebarProvider style={sidebarStyle as React.CSSProperties}>
      <div className="flex h-screen w-full">
        <AppSidebar userRole={userRole} />
        <div className="flex flex-col flex-1 overflow-hidden">
          <Header 
            userRole={userRole}
            userName="Sarah Chen"
            onLogout={() => {
              setIsAuthenticated(false);
              console.log('User logged out');
            }}
          />
          <div className="flex items-center p-2 border-b bg-background">
            <SidebarTrigger data-testid="button-sidebar-toggle" />
          </div>
          <main className="flex-1 overflow-auto">
            <div className="p-6 max-w-7xl mx-auto">
              <Switch>
                <Route path="/" component={QueryExecutionPage} />
                <Route path="/admin" component={AdminDashboardPage} />
                <Route path="/admin/logs" component={UsageLogsPage} />
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
        <Router />
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}