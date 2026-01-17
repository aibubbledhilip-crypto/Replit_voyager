import { useState } from "react";
import { Database, FileText, Search, GitCompare, Server, Activity, LayoutDashboard, ChevronDown } from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";

interface MenuItem {
  title: string;
  url: string;
  icon: any;
}

interface MenuCategory {
  label: string;
  items: MenuItem[];
  defaultOpen?: boolean;
}

const nexusGatewayItems: MenuItem[] = [
  {
    title: "Query Execution",
    url: "/",
    icon: Database,
  },
  {
    title: "Explorer",
    url: "/explorer",
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
      defaultOpen: true,
    },
    {
      label: "Tools",
      items: toolsItems,
      defaultOpen: true,
    },
  ];

  if (userRole === 'admin') {
    categories.push({
      label: "Administration",
      items: adminItems,
      defaultOpen: true,
    });
  }

  const [openCategories, setOpenCategories] = useState<Record<string, boolean>>(
    categories.reduce((acc, cat) => ({ ...acc, [cat.label]: cat.defaultOpen ?? true }), {})
  );

  const toggleCategory = (label: string) => {
    setOpenCategories(prev => ({ ...prev, [label]: !prev[label] }));
  };

  return (
    <Sidebar data-testid="sidebar-navigation">
      <SidebarContent>
        {categories.map((category) => (
          <SidebarGroup key={category.label}>
            <Collapsible
              open={openCategories[category.label]}
              onOpenChange={() => toggleCategory(category.label)}
            >
              <CollapsibleTrigger asChild>
                <button
                  className="flex w-full items-center justify-between px-3 py-2 text-sm font-semibold text-sidebar-foreground/70 hover:text-sidebar-foreground transition-colors"
                  data-testid={`toggle-${category.label.toLowerCase().replace(/\s+/g, '-')}`}
                >
                  <span>{category.label}</span>
                  <ChevronDown
                    className={cn(
                      "h-4 w-4 transition-transform duration-200",
                      openCategories[category.label] ? "rotate-0" : "-rotate-90"
                    )}
                  />
                </button>
              </CollapsibleTrigger>
              <CollapsibleContent>
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
              </CollapsibleContent>
            </Collapsible>
          </SidebarGroup>
        ))}
      </SidebarContent>
    </Sidebar>
  );
}
