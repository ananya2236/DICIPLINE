import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { LayoutDashboard, Calendar, Code, BarChart2, MessageSquare, LogOut, User as UserIcon } from 'lucide-react';
import { useAuth } from './AuthContext';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const SidebarItem = ({ icon: Icon, label, to, active }: { icon: any, label: string, to: string, active: boolean }) => (
  <Link
    to={to}
    className={cn(
      "flex items-center space-x-3 px-4 py-3 rounded-lg transition-all duration-200 group",
      active ? "bg-gold text-black" : "text-gray-400 hover:text-gold hover:bg-gold/10"
    )}
  >
    <Icon className={cn("w-5 h-5", active ? "text-black" : "group-hover:text-gold")} />
    <span className="font-medium">{label}</span>
  </Link>
);

const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <div className="flex min-h-screen bg-black text-white">
      {/* Sidebar */}
      <aside className="w-64 border-r border-gold/10 flex flex-col fixed inset-y-0 left-0 bg-black-soft z-50">
        <div className="p-8">
          <h1 className="text-2xl font-bold text-gold tracking-tight flex items-center gap-2">
            <div className="w-8 h-8 bg-gold rounded flex items-center justify-center">
              <span className="text-black text-xs font-black">DT</span>
            </div>
            DISCIPLINE
          </h1>
        </div>

        <nav className="flex-1 px-4 space-y-2">
          <SidebarItem 
            icon={LayoutDashboard} 
            label="Dashboard" 
            to="/" 
            active={location.pathname === '/'} 
          />
          <SidebarItem 
            icon={Calendar} 
            label="Daily Tracker" 
            to="/tracker" 
            active={location.pathname === '/tracker'} 
          />
          <SidebarItem 
            icon={Code} 
            label="DSA Tracker" 
            to="/dsa" 
            active={location.pathname === '/dsa'} 
          />
          <SidebarItem 
            icon={BarChart2} 
            label="Stats" 
            to="/stats" 
            active={location.pathname === '/stats'} 
          />
          <SidebarItem 
            icon={MessageSquare} 
            label="Reflections" 
            to="/reflections" 
            active={location.pathname === '/reflections'} 
          />
        </nav>

        <div className="p-4 border-t border-gold/10">
          <div className="flex items-center space-x-3 p-3 mb-4">
            {user?.photoURL ? (
              <img src={user.photoURL} alt="Avatar" className="w-10 h-10 rounded-full border border-gold/50" />
            ) : (
              <div className="w-10 h-10 rounded-full bg-gold/20 flex items-center justify-center">
                <UserIcon className="w-6 h-6 text-gold" />
              </div>
            )}
            <div className="flex-1 overflow-hidden">
              <p className="text-sm font-medium truncate">{user?.displayName || 'User'}</p>
              <p className="text-xs text-gray-500 truncate">{user?.email}</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center space-x-3 w-full px-4 py-3 text-red-400 hover:bg-red-400/10 rounded-lg transition-colors"
          >
            <LogOut className="w-5 h-5" />
            <span className="font-medium">Logout</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 ml-64 p-8">
        <div className="max-w-6xl mx-auto">
          {children}
        </div>
      </main>
    </div>
  );
};

export default Layout;
