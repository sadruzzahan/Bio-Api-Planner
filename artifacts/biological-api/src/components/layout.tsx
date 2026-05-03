import { ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { useUser, useClerk } from "@clerk/react";
import {
  Activity,
  CheckSquare,
  Cpu,
  Droplet,
  LayoutDashboard,
  Settings,
  Moon,
  Zap,
  MessageSquare,
  Beaker,
  Shield,
  LogOut,
  User as UserIcon,
} from "lucide-react";
import { useGetCurrentUser, useGetCurrentState } from "@workspace/api-client-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

export function Layout({ children }: { children: ReactNode }) {
  const [location, navigate] = useLocation();
  const { data: user } = useGetCurrentUser();
  const { data: state } = useGetCurrentState();
  const { user: clerkUser } = useUser();
  const { signOut, openUserProfile } = useClerk();

  const navItems = [
    { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
    { name: "Biometrics", href: "/biometrics", icon: Activity },
    { name: "Sleep", href: "/sleep", icon: Moon },
    { name: "Glucose", href: "/glucose", icon: Droplet },
    { name: "Activity", href: "/activity", icon: Zap },
    { name: "Interventions", href: "/interventions", icon: CheckSquare },
    { name: "Chat", href: "/chat", icon: MessageSquare },
    { name: "Supplements", href: "/supplements", icon: Beaker },
    { name: "Integrations", href: "/integrations", icon: Cpu },
  ];

  const stateColorClass = (() => {
    const s = state?.energyState?.toLowerCase();
    if (s === "peak" || s === "optimal") return "text-green-400";
    if (s === "moderate") return "text-yellow-400";
    if (s === "fatigued" || s === "stressed") return "text-orange-400";
    return "text-primary";
  })();

  const displayName =
    user?.name || clerkUser?.fullName || clerkUser?.username || "Operator";
  const displayEmail =
    user?.email ||
    clerkUser?.primaryEmailAddress?.emailAddress ||
    "";
  const initials = (displayName || "OP")
    .split(/\s+/)
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const handleSignOut = async () => {
    await signOut({ redirectUrl: import.meta.env.BASE_URL });
    navigate("/");
  };

  const UserMenu = ({ compact = false }: { compact?: boolean }) => (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-accent transition-colors w-full text-left"
        data-testid="user-menu-trigger"
      >
        <Avatar className="w-7 h-7 border border-primary/30">
          {clerkUser?.imageUrl && <AvatarImage src={clerkUser.imageUrl} alt={displayName} />}
          <AvatarFallback className="bg-primary/10 text-primary font-mono text-xs">
            {initials}
          </AvatarFallback>
        </Avatar>
        {!compact && (
          <div className="flex-1 min-w-0">
            <div className="font-mono text-xs font-bold truncate">{displayName}</div>
            <div className="font-mono text-[10px] text-muted-foreground truncate">{displayEmail}</div>
          </div>
        )}
        {!compact && user?.tier && (
          <span className="text-[9px] font-mono uppercase border border-primary/30 text-primary px-1 py-0.5 rounded shrink-0">
            {user.tier}
          </span>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="font-mono text-xs">
          <div className="truncate">{displayName}</div>
          <div className="truncate text-muted-foreground font-normal">{displayEmail}</div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => navigate("/profile")} data-testid="menu-profile">
          <UserIcon className="w-4 h-4 mr-2" /> Profile
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => openUserProfile()} data-testid="menu-account">
          <Settings className="w-4 h-4 mr-2" /> Manage account
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={handleSignOut} data-testid="menu-signout" className="text-destructive focus:text-destructive">
          <LogOut className="w-4 h-4 mr-2" /> Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  return (
    <div className="min-h-screen bg-background flex flex-col md:flex-row">
      <aside className="w-full md:w-64 border-r border-border bg-card flex-col hidden md:flex">
        <div className="h-16 flex items-center px-6 border-b border-border shrink-0">
          <div className="flex items-center gap-2 text-primary font-bold tracking-widest uppercase">
            <Activity className="w-5 h-5" />
            <span>BioOS</span>
          </div>
        </div>

        {state && (
          <div className="px-4 py-3 border-b border-border bg-primary/5 shrink-0">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Shield className={`w-4 h-4 ${stateColorClass}`} />
                <span className={`font-mono text-xs uppercase font-bold tracking-wider ${stateColorClass}`}>
                  {state.energyState}
                </span>
              </div>
              <span className={`font-mono text-sm font-bold ${stateColorClass}`}>
                {state.readinessScore}%
              </span>
            </div>
            <div className="mt-1 h-1 bg-border rounded-full overflow-hidden">
              <div
                className="h-full bg-current rounded-full transition-all"
                style={{ width: `${state.readinessScore}%`, color: `hsl(var(--primary))` }}
              />
            </div>
          </div>
        )}

        <nav className="flex-1 py-4 px-3 space-y-0.5 overflow-y-auto">
          {navItems.map((item) => {
            const isActive = location === item.href;
            return (
              <Link
                key={item.name}
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                }`}
                data-testid={`nav-${item.name.toLowerCase().replace(/ /g, "-")}`}
              >
                <item.icon className="w-4 h-4 shrink-0" />
                {item.name}
              </Link>
            );
          })}
        </nav>
        <div className="p-3 border-t border-border shrink-0">
          <UserMenu />
        </div>
      </aside>

      <main className="flex-1 flex flex-col overflow-hidden">
        <header className="h-14 md:hidden flex items-center justify-between px-4 border-b border-border bg-card shrink-0">
          <div className="flex items-center gap-2 text-primary font-bold tracking-widest uppercase">
            <Activity className="w-5 h-5" />
            <span>BioOS</span>
          </div>
          <div className="flex items-center gap-3">
            {state && (
              <div className={`flex items-center gap-1.5 font-mono text-xs ${stateColorClass}`}>
                <Shield className="w-3.5 h-3.5" />
                <span className="uppercase font-bold">{state.energyState}</span>
                <span className="font-bold">{state.readinessScore}%</span>
              </div>
            )}
            <UserMenu compact />
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-4 md:p-8">
          {children}
        </div>

        <nav className="md:hidden flex items-center justify-around border-t border-border bg-card py-2 shrink-0">
          {[...navItems, { name: "Profile", href: "/profile", icon: Settings }].map((item) => {
            const isActive = location === item.href;
            return (
              <Link
                key={item.name}
                href={item.href}
                className={`flex flex-col items-center gap-1 p-1 text-[10px] font-mono transition-colors min-w-0 ${
                  isActive ? "text-primary" : "text-muted-foreground"
                }`}
                data-testid={`mob-nav-${item.name.toLowerCase().replace(/ /g, "-")}`}
              >
                <item.icon className="w-4 h-4 shrink-0" />
                <span className="uppercase tracking-wider truncate max-w-[48px] text-center">{item.name}</span>
              </Link>
            );
          })}
        </nav>
      </main>
    </div>
  );
}
