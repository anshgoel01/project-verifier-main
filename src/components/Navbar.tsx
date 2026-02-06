import { Link, useLocation } from 'react-router-dom';
 import { GraduationCap, Home, Shield, Search } from 'lucide-react';
import { cn } from '@/lib/utils';

export function Navbar() {
  const location = useLocation();

  const navItems = [
    { to: '/', label: 'Home', icon: Home },
     { to: '/track-job', label: 'Track Job', icon: Search },
  ];

  return (
    <nav className="border-b bg-card/80 backdrop-blur-sm sticky top-0 z-50">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-14">
          {/* Logo / Brand */}
          <Link to="/" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
            <div className="p-2 bg-primary rounded-lg">
              <GraduationCap className="w-5 h-5 text-primary-foreground" />
            </div>
            <div className="hidden sm:block">
              <h1 className="text-base font-semibold text-foreground leading-tight">
                Student Verification Portal
              </h1>
              <p className="text-xs text-muted-foreground">
                Guided Project Submission Validator
              </p>
            </div>
          </Link>

          {/* Navigation Links */}
          <div className="flex items-center gap-1">
            {navItems.map((item) => {
              const isActive = location.pathname === item.to;
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={cn(
                    'flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                  )}
                >
                  <item.icon className="w-4 h-4" />
                  <span className="hidden sm:inline">{item.label}</span>
                </Link>
              );
            })}
            
            {/* Admin Badge */}
            <div className="flex items-center gap-2 ml-4 pl-4 border-l text-sm text-muted-foreground">
              <Shield className="w-4 h-4" />
              <span className="hidden sm:inline">Admin Dashboard</span>
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
}
