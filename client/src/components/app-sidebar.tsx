import { useState } from "react";
import { Database, FileText, Search, GitCompare, Server, Activity, LayoutDashboard, ChevronDown, Brain, CreditCard, Users, Settings, Shield } from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubItem,
  SidebarMenuSubButton,
} from "@/components/ui/sidebar";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";

interface MenuItem {
  title: string;
  url?: string;
  icon: any;
  children?: MenuItem[];
}

interface MenuCategory {
  label: string;
  items: MenuItem[];
  defaultOpen?: boolean;
}

const nexusGatewayItems: MenuItem[] = [
  {
    title: "Executor",
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
    title: "User Management",
    url: "/admin/users",
    icon: Users,
  },
  {
    title: "Configurations",
    icon: Settings,
    children: [
      {
        title: "Explorer",
        url: "/admin/explorer-config",
        icon: Search,
      },
      {
        title: "AI",
        url: "/admin/ai-config",
        icon: Brain,
      },
      {
        title: "SFTP",
        url: "/admin/sftp-config",
        icon: Server,
      },
    ],
  },
  {
    title: "Usage Logs",
    url: "/admin/logs",
    icon: FileText,
  },
  {
    title: "Billing",
    url: "/billing",
    icon: CreditCard,
  },
];

interface AppSidebarProps {
  userRole?: 'admin' | 'user';
  isSuperAdmin?: boolean;
}

export function AppSidebar({ userRole = 'user', isSuperAdmin = false }: AppSidebarProps) {
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

  if (isSuperAdmin) {
    categories.push({
      label: "Platform",
      items: [
        {
          title: "Super Admin",
          url: "/super-admin",
          icon: Shield,
        },
      ],
      defaultOpen: true,
    });
  }

  const [openCategories, setOpenCategories] = useState<Record<string, boolean>>(
    categories.reduce((acc, cat) => ({ ...acc, [cat.label]: cat.defaultOpen ?? true }), {})
  );

  const [openSubmenus, setOpenSubmenus] = useState<Record<string, boolean>>({
    "Configurations": true,
  });

  const toggleCategory = (label: string) => {
    setOpenCategories(prev => ({ ...prev, [label]: !prev[label] }));
  };

  const toggleSubmenu = (title: string) => {
    setOpenSubmenus(prev => ({ ...prev, [title]: !prev[title] }));
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
                        {item.children ? (
                          <Collapsible
                            open={openSubmenus[item.title]}
                            onOpenChange={() => toggleSubmenu(item.title)}
                          >
                            <CollapsibleTrigger asChild>
                              <SidebarMenuButton data-testid={`toggle-${item.title.toLowerCase().replace(/\s+/g, '-')}`}>
                                <item.icon className="h-4 w-4" />
                                <span>{item.title}</span>
                                <ChevronDown
                                  className={cn(
                                    "ml-auto h-4 w-4 transition-transform duration-200",
                                    openSubmenus[item.title] ? "rotate-0" : "-rotate-90"
                                  )}
                                />
                              </SidebarMenuButton>
                            </CollapsibleTrigger>
                            <CollapsibleContent>
                              <SidebarMenuSub>
                                {item.children.map((child) => (
                                  <SidebarMenuSubItem key={child.title}>
                                    <SidebarMenuSubButton asChild>
                                      <a href={child.url} data-testid={`link-${child.title.toLowerCase().replace(/\s+/g, '-')}-config`}>
                                        <child.icon className="h-4 w-4" />
                                        <span>{child.title}</span>
                                      </a>
                                    </SidebarMenuSubButton>
                                  </SidebarMenuSubItem>
                                ))}
                              </SidebarMenuSub>
                            </CollapsibleContent>
                          </Collapsible>
                        ) : (
                          <SidebarMenuButton asChild>
                            <a href={item.url} data-testid={`link-${item.title.toLowerCase().replace(/\s+/g, '-')}`}>
                              <item.icon className="h-4 w-4" />
                              <span>{item.title}</span>
                            </a>
                          </SidebarMenuButton>
                        )}
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
