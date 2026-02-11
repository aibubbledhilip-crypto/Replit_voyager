import { Database, LogOut, Eye, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface HeaderProps {
  userRole?: 'admin' | 'user';
  userName?: string;
  isSuperAdmin?: boolean;
  impersonating?: { organizationId: string; organizationName: string } | null;
  onLogout?: () => void;
}

export default function Header({ 
  userRole = 'user', 
  userName = 'User', 
  isSuperAdmin = false,
  impersonating = null,
  onLogout 
}: HeaderProps) {
  const { toast } = useToast();
  const initials = userName.split(' ').map(n => n[0]).join('').toUpperCase();

  const stopImpersonationMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", "/api/super-admin/stop-impersonation");
    },
    onSuccess: () => {
      toast({ title: "Stopped impersonation", description: "Returned to super admin mode" });
      window.location.reload();
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  return (
    <div>
      {impersonating && (
        <div className="bg-amber-500 text-amber-950 px-4 py-2 flex items-center justify-between" data-testid="banner-impersonation">
          <div className="flex items-center gap-2">
            <Eye className="h-4 w-4" />
            <span className="text-sm font-medium">
              Viewing as: <strong>{impersonating.organizationName}</strong>
            </span>
          </div>
          <Button 
            variant="ghost" 
            size="sm" 
            className="h-7 text-amber-950 hover:bg-amber-600"
            onClick={() => stopImpersonationMutation.mutate()}
            disabled={stopImpersonationMutation.isPending}
            data-testid="button-stop-impersonation"
          >
            <XCircle className="h-4 w-4 mr-1" />
            Exit
          </Button>
        </div>
      )}
      <header className="h-16 border-b bg-card flex items-center justify-between gap-4 px-4" data-testid="header-main">
        <div className="flex items-center gap-3">
          <SidebarTrigger data-testid="button-sidebar-toggle" />
          <div className="p-2 bg-primary rounded-md">
            <Database className="h-5 w-5 text-primary-foreground" />
          </div>
          <h1 className="text-xl font-semibold" data-testid="text-app-title">Voyager</h1>
          {isSuperAdmin && (
            <Badge variant="outline" className="bg-primary/10 text-primary border-primary/30" data-testid="badge-super-admin">
              Super Admin
            </Badge>
          )}
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground hidden sm:inline">Status:</span>
            <div className="flex items-center gap-1.5">
              <div className="h-2 w-2 rounded-full bg-status-online" />
              <span className="text-sm font-medium hidden sm:inline" data-testid="text-connection-status">Connected</span>
            </div>
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="flex items-center gap-2 h-10" data-testid="button-user-menu">
                <Avatar className="h-8 w-8">
                  <AvatarImage src="" />
                  <AvatarFallback className="text-xs">{initials}</AvatarFallback>
                </Avatar>
                <div className="hidden md:flex flex-col items-start">
                  <span className="text-sm font-medium" data-testid="text-username">{userName}</span>
                  <Badge variant="secondary" className="h-4 text-xs px-1.5" data-testid="badge-user-role">
                    {userRole === 'admin' ? 'Admin' : 'User'}
                  </Badge>
                </div>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuLabel>My Account</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={onLogout} data-testid="button-logout">
                <LogOut className="mr-2 h-4 w-4" />
                <span>Log out</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>
    </div>
  );
}
