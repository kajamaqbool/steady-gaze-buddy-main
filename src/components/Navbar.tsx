import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useGazeStore } from '../store/gazeStore';
import { Shield, BookOpen, LogOut, Menu, X, LayoutDashboard, GraduationCap, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

export const Navbar: React.FC = () => {
  const { isAuthenticated, logout, role, getRoleDashboard } = useAuth();
  const connectionStatus = useGazeStore((state) => state.connectionStatus);
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const getStatusBadge = () => {
    switch (connectionStatus) {
      case 'CONNECTED':
        return (
          <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200 flex items-center gap-1.5 px-2.5 py-1 text-xs">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            Live Sync Ready
          </Badge>
        );
      case 'CONNECTING':
      case 'RECONNECTING':
        return (
          <Badge className="bg-amber-100 text-amber-800 border-amber-200 flex items-center gap-1.5 px-2.5 py-1 text-xs">
            <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping" />
            Connecting...
          </Badge>
        );
      default:
        return (
          <Badge variant="outline" className="bg-slate-100 text-slate-600 border-slate-200 flex items-center gap-1.5 px-2.5 py-1 text-xs">
            <span className="w-2 h-2 rounded-full bg-slate-400" />
            Offline Mode
          </Badge>
        );
    }
  };

  const normRole = role ? role.trim().toUpperCase() : null;

  const getRoleLabel = () => {
    switch (normRole) {
      case 'PARENT':
        return { label: 'Parent Dashboard', icon: Users, path: '/parent/dashboard' };
      case 'TEACHER':
        return { label: 'Teacher Portal', icon: GraduationCap, path: '/teacher/dashboard' };
      case 'STUDENT':
        return { label: 'Student Quest', icon: LayoutDashboard, path: '/student/dashboard' };
      default:
        return null;
    }
  };

  const roleInfo = getRoleLabel();
  const DashboardIcon = roleInfo?.icon;

  return (
    <header className="sticky top-0 z-40 bg-cream/90 backdrop-blur-md border-b border-border/60 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          
          {/* Logo & Title */}
          <Link to="/" className="flex items-center gap-2.5 group transition-transform duration-200 hover:scale-[1.01]">
            <div className="w-10 h-10 rounded-xl bg-primary text-primary-foreground flex items-center justify-center shadow-sm group-hover:shadow-md transition-all">
              <Shield className="w-5 h-5 text-white" />
            </div>
            <div className="flex flex-col">
              <span className="font-display font-extrabold text-lg text-foreground tracking-tight leading-none">
                Dyslexia Shield
              </span>
              <span className="text-[10px] font-medium text-muted-foreground tracking-wide uppercase mt-0.5">
                AI Reading Companion
              </span>
            </div>
          </Link>

          {/* Connection Status & Nav links - Desktop */}
          <div className="hidden md:flex items-center gap-6">
            {getStatusBadge()}

            {isAuthenticated() && (
              <nav className="flex items-center gap-1.5 text-sm font-medium">
                
                {/* Reading Adventure (for Student role or general access) */}
                {normRole === 'STUDENT' && (
                  <Link
                    to="/"
                    className={`px-3 py-2 rounded-lg transition-colors flex items-center gap-1.5 ${
                      location.pathname === '/'
                        ? 'bg-primary/10 text-primary font-semibold'
                        : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                    }`}
                  >
                    <BookOpen className="w-4 h-4" />
                    Reading Adventure
                  </Link>
                )}

                {/* Role Specific Dashboard Link */}
                {roleInfo && DashboardIcon && (
                  <Link
                    to={roleInfo.path}
                    className={`px-3 py-2 rounded-lg transition-colors flex items-center gap-1.5 ${
                      location.pathname.startsWith(roleInfo.path)
                        ? 'bg-primary text-primary-foreground font-semibold shadow-xs'
                        : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                    }`}
                  >
                    <DashboardIcon className="w-4 h-4" />
                    {roleInfo.label}
                  </Link>
                )}

                <button
                  onClick={logout}
                  className="ml-2 px-3 py-2 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors flex items-center gap-1.5 text-sm"
                  title="Sign Out"
                >
                  <LogOut className="w-4 h-4" />
                  Sign Out
                </button>
              </nav>
            )}

            {!isAuthenticated() && (
              <div className="flex items-center gap-3">
                <Link to="/login">
                  <Button variant="ghost" size="sm" className="font-medium">
                    Sign In
                  </Button>
                </Link>
                <Link to="/register">
                  <Button size="sm" className="font-semibold shadow-xs">
                    Create Account
                  </Button>
                </Link>
              </div>
            )}
          </div>

          {/* Mobile Menu Toggle */}
          <div className="flex items-center gap-2 md:hidden">
            {getStatusBadge()}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label="Toggle navigation menu"
              className="text-foreground"
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </Button>
          </div>
        </div>
      </div>

      {/* Mobile Drawer Menu */}
      {mobileMenuOpen && (
        <div className="md:hidden border-b border-border bg-card/95 backdrop-blur-md px-4 pt-3 pb-5 space-y-3 animate-fade-in-up">
          {isAuthenticated() ? (
            <>
              {normRole === 'STUDENT' && (
                <Link
                  to="/"
                  onClick={() => setMobileMenuOpen(false)}
                  className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-semibold transition-colors ${
                    location.pathname === '/'
                      ? 'bg-primary text-primary-foreground'
                      : 'text-foreground hover:bg-muted'
                  }`}
                >
                  <BookOpen className="w-4 h-4" />
                  Reading Adventure
                </Link>
              )}

              {roleInfo && DashboardIcon && (
                <Link
                  to={roleInfo.path}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-semibold transition-colors ${
                    location.pathname.startsWith(roleInfo.path)
                      ? 'bg-primary text-primary-foreground'
                      : 'text-foreground hover:bg-muted'
                  }`}
                >
                  <DashboardIcon className="w-4 h-4" />
                  {roleInfo.label}
                </Link>
              )}

              <div className="pt-2 border-t border-border">
                <Button
                  onClick={() => {
                    setMobileMenuOpen(false);
                    logout();
                  }}
                  variant="destructive"
                  size="sm"
                  className="w-full flex items-center justify-center gap-2"
                >
                  <LogOut className="w-4 h-4" />
                  Sign Out
                </Button>
              </div>
            </>
          ) : (
            <div className="flex flex-col gap-2 pt-2">
              <Link to="/login" onClick={() => setMobileMenuOpen(false)}>
                <Button variant="outline" className="w-full">
                  Sign In
                </Button>
              </Link>
              <Link to="/register" onClick={() => setMobileMenuOpen(false)}>
                <Button className="w-full">
                  Create Account
                </Button>
              </Link>
            </div>
          )}
        </div>
      )}
    </header>
  );
};

export default Navbar;
