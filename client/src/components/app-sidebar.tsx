import { useState } from "react";
import { Database, FileText, Search, GitCompare, Server, Activity, LayoutDashboard, ChevronDown, Brain, CreditCard, Users, Settings, Shield, Cloud, Link2 } from "lucide-react";
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
        title: "Databases",
        url: "/admin/db-connections",
        icon: Link2,
      },
      {
        title: "AWS",
        url: "/admin/aws-config",
        icon: Cloud,
      },
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
      defaultOpen: false,
    },
    {
      label: "Tools",
      items: toolsItems,
      defaultOpen: false,
    },
  ];

  if (userRole === 'admin') {
    categories.push({
      label: "Administration",
      items: adminItems,
      defaultOpen: false,
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
      defaultOpen: false,
    });
  }

  const [openCategories, setOpenCategories] = useState<Record<string, boolean>>(
    categories.reduce((acc, cat) => ({ ...acc, [cat.label]: cat.defaultOpen ?? false }), {})
  );

  const [openSubmenus, setOpenSubmenus] = useState<Record<string, boolean>>({
    "Configurations": false,
  });

  const toggleCategory = (label: string) => {
    setOpenCategories(prev => ({ ...prev, [label]: !prev[label] }));
  };

  const toggleSubmenu = (title: string) => {
    setOpenSubmenus(prev => ({ ...prev, [title]: !prev[title] }));
  };

  return (
    <nav className="flex flex-col h-full overflow-y-auto py-2" data-testid="sidebar-navigation">
      {categories.map((category) => (
        <div key={category.label} className="px-2 py-1">
          <Collapsible
            open={openCategories[category.label]}
            onOpenChange={() => toggleCategory(category.label)}
          >
            <CollapsibleTrigger asChild>
              <button
                className="flex w-full items-center justify-between px-3 py-2 text-sm font-semibold text-foreground/70 hover:text-foreground transition-colors rounded-md"
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
              <div className="mt-1 space-y-0.5">
                {category.items.map((item) => (
                  <div key={item.title}>
                    {item.children ? (
                      <Collapsible
                        open={openSubmenus[item.title]}
                        onOpenChange={() => toggleSubmenu(item.title)}
                      >
                        <CollapsibleTrigger asChild>
                          <button
                            className="flex w-full items-center gap-2 px-3 py-1.5 text-sm rounded-md hover-elevate transition-colors"
                            data-testid={`toggle-${item.title.toLowerCase().replace(/\s+/g, '-')}`}
                          >
                            <item.icon className="h-4 w-4" />
                            <span>{item.title}</span>
                            <ChevronDown
                              className={cn(
                                "ml-auto h-4 w-4 transition-transform duration-200",
                                openSubmenus[item.title] ? "rotate-0" : "-rotate-90"
                              )}
                            />
                          </button>
                        </CollapsibleTrigger>
                        <CollapsibleContent>
                          <div className="ml-4 mt-0.5 space-y-0.5 border-l pl-2">
                            {item.children.map((child) => (
                              <a
                                key={child.title}
                                href={child.url}
                                className="flex items-center gap-2 px-3 py-1.5 text-sm rounded-md hover-elevate transition-colors"
                                data-testid={`link-${child.title.toLowerCase().replace(/\s+/g, '-')}-config`}
                              >
                                <child.icon className="h-4 w-4" />
                                <span>{child.title}</span>
                              </a>
                            ))}
                          </div>
                        </CollapsibleContent>
                      </Collapsible>
                    ) : (
                      <a
                        href={item.url}
                        className="flex items-center gap-2 px-3 py-1.5 text-sm rounded-md hover-elevate transition-colors"
                        data-testid={`link-${item.title.toLowerCase().replace(/\s+/g, '-')}`}
                      >
                        <item.icon className="h-4 w-4" />
                        <span>{item.title}</span>
                      </a>
                    )}
                  </div>
                ))}
              </div>
            </CollapsibleContent>
          </Collapsible>
        </div>
      ))}
    </nav>
  );
}
