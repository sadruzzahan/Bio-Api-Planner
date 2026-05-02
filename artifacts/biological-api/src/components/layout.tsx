import { ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { Activity, Apple, CheckSquare, Clock, Cpu, Droplet, LayoutDashboard, Settings, Moon, Zap, MessageSquare } from "lucide-react";
import { useGetCurrentUser } from "@workspace/api-client-react";

export function Layout({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  const { data: user } = useGetCurrentUser();

  const navItems = [
    { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
    { name: "Biometrics", href: "/biometrics", icon: Activity },
    { name: "Sleep", href: "/sleep", icon: Moon },
    { name: "Glucose", href: "/glucose", icon: Droplet },
    { name: "Activity", href: "/activity", icon: Zap },
    { name: "Interventions", href: "/interventions", icon: CheckSquare },
    { name: "Chat", href: "/chat", icon: MessageSquare },
    { name: "Integrations", href: "/integrations", icon: Cpu },
  ];

  return (
    <div className="min-h-screen bg-background flex flex-col md:flex-row">
      <aside className="w-full md:w-64 border-r border-border bg-card flex flex-col hidden md:flex">
        <div className="h-16 flex items-center px-6 border-b border-border">
          <div className="flex items-center gap-2 text-primary font-bold tracking-widest uppercase">
            <Activity className="w-5 h-5" />
            <span>BioOS</span>
          </div>
        </div>
        <nav className="flex-1 py-6 px-3 space-y-1 overflow-y-auto">
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
                data-testid={`nav-${item.name.toLowerCase()}`}
              >
                <item.icon className="w-4 h-4" />
                {item.name}
              </Link>
            );
          })}
        </nav>
        <div className="p-4 border-t border-border">
          <Link
            href="/profile"
            className="flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium text-muted-foreground hover:bg-accent hover:text-accent-foreground"
            data-testid="nav-profile"
          >
            <Settings className="w-4 h-4" />
            <span>Profile</span>
          </Link>
        </div>
      </aside>

      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Mobile Header */}
        <header className="h-16 md:hidden flex items-center px-4 border-b border-border bg-card">
          <div className="flex items-center gap-2 text-primary font-bold tracking-widest uppercase">
            <Activity className="w-5 h-5" />
            <span>BioOS</span>
          </div>
        </header>
        
        <div className="flex-1 overflow-y-auto p-4 md:p-8">
          {children}
        </div>
      </main>
    </div>
  );
}
