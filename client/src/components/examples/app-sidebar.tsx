import { AppSidebar } from '../app-sidebar';
import { SidebarProvider } from '@/components/ui/sidebar';

export default function AppSidebarExample() {
  const style = {
    "--sidebar-width": "16rem",
  };

  return (
    <div className="space-y-4">
      <div className="h-96 border rounded-md overflow-hidden">
        <SidebarProvider style={style as React.CSSProperties}>
          <div className="flex h-full w-full">
            <AppSidebar userRole="admin" />
            <div className="flex-1 p-6">
              <p className="text-muted-foreground">Admin Sidebar</p>
            </div>
          </div>
        </SidebarProvider>
      </div>
      
      <div className="h-96 border rounded-md overflow-hidden">
        <SidebarProvider style={style as React.CSSProperties}>
          <div className="flex h-full w-full">
            <AppSidebar userRole="user" />
            <div className="flex-1 p-6">
              <p className="text-muted-foreground">User Sidebar</p>
            </div>
          </div>
        </SidebarProvider>
      </div>
    </div>
  );
}