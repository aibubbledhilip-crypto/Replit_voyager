import { Database, LogOut } from "lucide-react";
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

interface HeaderProps {
  userRole?: 'admin' | 'user';
  userName?: string;
  onLogout?: () => void;
}

export default function Header({ userRole = 'user', userName = 'User', onLogout }: HeaderProps) {
  const initials = userName.split(' ').map(n => n[0]).join('').toUpperCase();

  return (
    <header className="h-16 border-b bg-card flex items-center justify-between px-6" data-testid="header-main">
      <div className="flex items-center gap-3">
        <div className="p-2 bg-primary rounded-md">
          <Database className="h-5 w-5 text-primary-foreground" />
        </div>
        <h1 className="text-xl font-semibold" data-testid="text-app-title">Voyager</h1>
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
  );
}