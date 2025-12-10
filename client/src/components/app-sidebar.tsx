import { Home, Database, FileText, Settings, Shield, Search, GitCompare, Server, Activity, FileDown } from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";

const adminMenuItems = [
  {
    title: "Dashboard",
    url: "/admin",
    icon: Home,
  },
  {
    title: "Query Execution",
    url: "/",
    icon: Database,
  },
  {
    title: "MSISDN Lookup",
    url: "/msisdn-lookup",
    icon: Search,
  },
  {
    title: "File Comparison",
    url: "/file-comparison",
    icon: GitCompare,
  },
  {
    title: "SFTP Monitor",
    url: "/sftp-monitor",
    icon: Activity,
  },
  {
    title: "DVSum Reports",
    url: "/dvsum-reports",
    icon: FileDown,
  },
  {
    title: "SFTP Configuration",
    url: "/admin/sftp-config",
    icon: Server,
  },
  {
    title: "Usage Logs",
    url: "/admin/logs",
    icon: FileText,
  },
];

const userMenuItems = [
  {
    title: "Query Execution",
    url: "/",
    icon: Database,
  },
  {
    title: "MSISDN Lookup",
    url: "/msisdn-lookup",
    icon: Search,
  },
  {
    title: "File Comparison",
    url: "/file-comparison",
    icon: GitCompare,
  },
  {
    title: "SFTP Monitor",
    url: "/sftp-monitor",
    icon: Activity,
  },
  {
    title: "DVSum Reports",
    url: "/dvsum-reports",
    icon: FileDown,
  },
];

interface AppSidebarProps {
  userRole?: 'admin' | 'user';
}

export function AppSidebar({ userRole = 'user' }: AppSidebarProps) {
  const items = userRole === 'admin' ? adminMenuItems : userMenuItems;

  return (
    <Sidebar data-testid="sidebar-navigation">
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <a href={item.url} data-testid={`link-${item.title.toLowerCase().replace(/\s+/g, '-')}`}>
                      <item.icon />
                      <span>{item.title}</span>
                    </a>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}