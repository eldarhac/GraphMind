import { Link, useLocation } from "react-router-dom";
import { MessageSquare, Network, Users, Settings, Sparkles } from "lucide-react";

export default function Layout({ children }) {
  const location = useLocation();

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
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950">
      <style>{`
        :root {
          --primary-gradient: linear-gradient(135deg, #3B82F6 0%, #1E40AF 100%);
          --glass-bg: rgba(15, 23, 42, 0.8);
          --glass-border: rgba(59, 130, 246, 0.2);
          --text-primary: #F8FAFC;
          --text-secondary: #CBD5E1;
          --accent: #3B82F6;
        }
        
        .glass-effect {
          background: var(--glass-bg);
          backdrop-filter: blur(20px);
          border: 1px solid var(--glass-border);
        }
        
        .text-glow {
          text-shadow: 0 0 20px rgba(59, 130, 246, 0.5);
        }
        
        .animate-pulse-slow {
          animation: pulse 3s infinite;
        }
        
        @keyframes float {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-10px); }
        }
        
        .animate-float {
          animation: float 6s ease-in-out infinite;
        }
      `}</style>

      {/* Navigation Sidebar */}
      <div className="fixed left-0 top-0 h-full w-20 glass-effect z-40 border-r border-slate-700/50">
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="h-20 p-4 flex items-center justify-center border-b border-slate-700/50">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-r from-blue-500 to-indigo-600 flex items-center justify-center animate-float flex-shrink-0">
              <Sparkles className="w-6 h-6 text-white" />
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
                        ? 'bg-gradient-to-r from-blue-500/20 to-indigo-600/20 text-blue-400 border border-blue-500/30' 
                        : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
                      }
                    `}
                  >
                    <item.icon className={`w-6 h-6 ${isActive ? 'text-blue-400' : 'group-hover:text-white'}`} />
                    <span className="absolute left-full ml-4 px-2 py-1 rounded-md bg-slate-800 text-sm text-white opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-50">
                      {item.name}
                    </span>
                  </Link>
                );
              })}
            </div>
          </nav>

          {/* User Profile */}
          <div className="h-24 p-4 flex items-center justify-center border-t border-slate-700/50">
            <div className="w-10 h-10 rounded-full bg-gradient-to-r from-blue-500 to-indigo-600 flex items-center justify-center flex-shrink-0">
              <span className="text-white text-sm font-bold">U</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="ml-20 min-h-screen">
        {/* Header Bar */}
        <header className="fixed top-0 left-20 right-0 h-20 px-8 flex items-center justify-center glass-effect z-30 border-b border-slate-700/50">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-white text-glow">Graphoscope</h1>
            <p className="text-sm text-slate-400">Your Personal Network Intelligence Engine</p>
          </div>
        </header>
        
        <main className="relative pt-20">
          {children}
        </main>
      </div>

      {/* Background Effects */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl animate-pulse-slow"></div>
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl animate-pulse-slow"></div>
      </div>
    </div>
  );
} 