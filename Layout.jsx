import { Link, useLocation } from "react-router-dom";
import { MessageSquare, Network, Users, Settings, Sparkles, Sun, Moon } from "lucide-react";
import { useTheme } from "./Components/ui/ThemeProvider";
import { Button } from "./Components/ui/button";

export default function Layout({ children }) {
  const location = useLocation();
  const { setTheme, theme } = useTheme();

  const navigationItems = [
    {
      name: "Chat",
      url: "/chat",
      icon: MessageSquare,
      description: "Conversational Graph Assistant"
    },
    {
      name: "Network",
      url: "/network",
      icon: Network,
      description: "Interactive Graph Explorer"
    },
    {
      name: "People",
      url: "/people",
      icon: Users,
      description: "Connection Directory"
    },
    {
      name: "Profile",
      url: "/profile",
      icon: Settings,
      description: "Personal Settings"
    }
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Navigation Sidebar */}
      <div className="fixed left-0 top-0 h-full w-20 bg-card/80 backdrop-blur-xl border-r border-border z-40">
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="h-20 p-4 flex items-center justify-center border-b border-border">
            <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center animate-float flex-shrink-0">
              <Sparkles className="w-6 h-6 text-primary-foreground" />
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex-1 p-4">
            <div className="space-y-2">
              {navigationItems.map((item) => {
                const isActive = location.pathname === item.url;
                return (
                  <Link
                    key={item.name}
                    to={item.url}
                    className={`
                      group relative flex items-center justify-center gap-3 px-4 py-3 rounded-xl transition-all duration-300
                      ${isActive 
                        ? 'bg-primary/20 text-primary border border-primary/30' 
                        : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                      }
                    `}
                  >
                    <item.icon className={`w-6 h-6 ${isActive ? 'text-primary' : 'group-hover:text-foreground'}`} />
                    <span className="absolute left-full ml-4 px-2 py-1 rounded-md bg-muted text-sm text-foreground opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-50">
                      {item.name}
                    </span>
                  </Link>
                );
              })}
            </div>
          </nav>

          {/* User Profile */}
          <div className="h-24 p-4 flex items-center justify-center border-t border-border">
            <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
              <span className="text-sm font-bold text-primary-foreground">U</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="ml-20 min-h-screen">
        {/* Header Bar */}
        <header className="fixed top-0 left-20 right-0 h-20 px-8 flex items-center justify-between bg-card/80 backdrop-blur-xl z-30 border-b border-border">
          <div className="text-center invisible">
            {/* This is a spacer, the real title is centered below */}
            <h1 className="text-5xl font-bold text-center">Promatheia</h1>
          </div>
          <div className="absolute left-1/2 -translate-x-1/2">
            <h1 className="text-5xl font-bold text-foreground text-center">Promatheia</h1>
            <p className="text-sm text-muted-foreground text-center">An AI That Sees What LinkedIn Can't</p>
          </div>
          <div>
            <Button variant="ghost" size="icon" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} className="text-muted-foreground">
                {theme === 'dark' ? (
                    <Sun className="h-[1.2rem] w-[1.2rem]" />
                ) : (
                    <Moon className="h-[1.2rem] w-[1.2rem]" />
                )}
                <span className="sr-only">Toggle theme</span>
            </Button>
          </div>
        </header>
        
        <main className="relative pt-20">
          {children}
        </main>
      </div>

      {/* Background Effects */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/5 rounded-full blur-3xl animate-pulse-slow"></div>
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-primary/10 rounded-full blur-3xl animate-pulse-slow"></div>
      </div>
    </div>
  );
} 