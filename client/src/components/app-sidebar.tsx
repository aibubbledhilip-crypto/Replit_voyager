import { Database, FileText, Settings, Shield, Search, GitCompare, Server, Activity, LayoutDashboard, Zap } from "lucide-react";
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

interface MenuItem {
  title: string;
  url: string;
  icon: any;
}

interface MenuCategory {
  label: string;
  items: MenuItem[];
}

const nexusGatewayItems: MenuItem[] = [
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
];

const toolsItems: MenuItem[] = [
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
];

const adminItems: MenuItem[] = [
  {
    title: "Dashboard",
    url: "/admin",
    icon: LayoutDashboard,
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

interface AppSidebarProps {
  userRole?: 'admin' | 'user';
}

export function AppSidebar({ userRole = 'user' }: AppSidebarProps) {
  const categories: MenuCategory[] = [
    {
      label: "Nexus Gateway",
      items: nexusGatewayItems,
    },
    {
      label: "Tools",
      items: toolsItems,
    },
  ];

  if (userRole === 'admin') {
    categories.push({
      label: "Administration",
      items: adminItems,
    });
  }

  return (
    <Sidebar data-testid="sidebar-navigation">
      <SidebarContent>
        {categories.map((category) => (
          <SidebarGroup key={category.label}>
            <SidebarGroupLabel>{category.label}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {category.items.map((item) => (
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
        ))}
      </SidebarContent>
    </Sidebar>
  );
}
