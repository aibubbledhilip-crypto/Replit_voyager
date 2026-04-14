import { useState } from "react";
import { Database, FileText, Search, GitCompare, Layers, Server, Activity, LayoutDashboard, ChevronDown, Brain, CreditCard, Users, Settings, Shield, Cloud, Link2, BarChart2, KeyRound, Key } from "lucide-react";
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
  permission?: string;
}

interface AppSidebarProps {
  userRole?: 'admin' | 'user';
  isSuperAdmin?: boolean;
  permissions?: string[];
  orgRole?: string | null;
}

export function AppSidebar({
  userRole = 'user',
  isSuperAdmin = false,
  permissions = [],
  orgRole,
}: AppSidebarProps) {
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({});
  const [openSubmenus, setOpenSubmenus] = useState<Record<string, boolean>>({});

  const isAdmin = isSuperAdmin || ['owner', 'admin'].includes(orgRole ?? '');
  const hasPerm = (feature: string) => isSuperAdmin || permissions.includes(feature);

  const toggleSection = (label: string) => {
    setOpenSections(prev => ({ ...prev, [label]: !prev[label] }));
  };

  const toggleSubmenu = (title: string) => {
    setOpenSubmenus(prev => ({ ...prev, [title]: !prev[title] }));
  };

  const nexusGatewayItems: MenuItem[] = [
    { title: "Executor", url: "/", icon: Database, permission: "execute_queries" },
    { title: "Explorer", url: "/explorer", icon: Search, permission: "explorer" },
  ];

  const watchTowerItems: MenuItem[] = [
    { title: "Depiction", url: "/depiction", icon: BarChart2, permission: "depiction" },
  ];

  const toolsItems: MenuItem[] = [
    { title: "File Comparison", url: "/file-comparison", icon: GitCompare, permission: "file_compare" },
    { title: "File Aggregate", url: "/file-aggregate", icon: Layers, permission: "file_aggregate" },
    { title: "SFTP Monitor", url: "/sftp-monitor", icon: Activity, permission: "sftp_monitor" },
  ];

  const adminItems: MenuItem[] = [
    { title: "Dashboard", url: "/admin", icon: LayoutDashboard },
    { title: "User Management", url: "/admin/users", icon: Users },
    {
      title: "Configurations",
      icon: Settings,
      children: [
        { title: "Databases", url: "/admin/db-connections", icon: Link2 },
        { title: "AWS", url: "/admin/aws-config", icon: Cloud },
        { title: "Explorer", url: "/admin/explorer-config", icon: Search },
        { title: "AI", url: "/admin/ai-config", icon: Brain },
        { title: "SFTP", url: "/admin/sftp-config", icon: Server },
        { title: "Roles", url: "/admin/role-permissions", icon: KeyRound },
      ],
    },
    { title: "Usage Logs", url: "/admin/logs", icon: FileText },
    { title: "Billing", url: "/billing", icon: CreditCard },
  ];

  const platformItems: MenuItem[] = [
    { title: "Super Admin", url: "/super-admin", icon: Shield },
  ];

  const categories: { label: string; items: MenuItem[] }[] = [];

  const visibleNexus = nexusGatewayItems.filter(i => !i.permission || hasPerm(i.permission));
  if (visibleNexus.length > 0) categories.push({ label: "Nexus Gateway", items: visibleNexus });

  const visibleWatch = watchTowerItems.filter(i => !i.permission || hasPerm(i.permission));
  if (visibleWatch.length > 0) categories.push({ label: "Watch Tower", items: visibleWatch });

  const visibleTools = toolsItems.filter(i => !i.permission || hasPerm(i.permission));
  if (visibleTools.length > 0) categories.push({ label: "Tools", items: visibleTools });

  categories.push({ label: "Settings", items: [{ title: "API Keys", url: "/settings/api-keys", icon: Key }] });
  if (isAdmin) categories.push({ label: "Administration", items: adminItems });
  if (isSuperAdmin) categories.push({ label: "Platform", items: platformItems });

  return (
    <nav className="flex flex-col gap-1 p-2 h-full overflow-y-auto">
      {categories.map((category) => (
        <div key={category.label} className="mb-1">
          <Collapsible
            open={openSections[category.label] !== false}
            onOpenChange={() => toggleSection(category.label)}
          >
            <CollapsibleTrigger asChild>
              <button
                className="flex w-full items-center justify-between px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors"
                data-testid={`section-${category.label.toLowerCase().replace(/\s+/g, '-')}`}
              >
                {category.label}
                <ChevronDown
                  className={cn(
                    "h-3 w-3 transition-transform duration-200",
                    openSections[category.label] !== false ? "rotate-0" : "-rotate-90"
                  )}
                />
              </button>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="mt-0.5 space-y-0.5">
                {category.items.map((item) => (
                  <div key={item.title}>
                    {item.children ? (
                      <Collapsible
                        open={openSubmenus[item.title] !== false}
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
                                openSubmenus[item.title] !== false ? "rotate-0" : "-rotate-90"
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
