import { useEffect, useState } from 'react';
import { AuthProvider, useAuth } from './lib/auth';
import { supabase } from './lib/supabase';
import type { AuditHeader, Notification } from './lib/types';
import { LoginView } from './views/LoginView';
import { DashboardView } from './views/DashboardView';
import { ProductsView } from './views/ProductsView';
import { ScannerView } from './views/ScannerView';
import { AuditsView } from './views/AuditsView';
import { ReportsView } from './views/ReportsView';
import { UsersView } from './views/UsersView';
import {
  LayoutDashboard, ClipboardCheck, Package, ScanLine, FileBarChart,
  Users as UsersIcon, Warehouse, Bell, LogOut, Loader2, Menu, X,
} from 'lucide-react';

type View = 'dashboard' | 'audits' | 'scan' | 'products' | 'reports' | 'users';

function AppContent() {
  const { user, loading, signOut } = useAuth();
  const [view, setView] = useState<View>('dashboard');
  const [activeAudit, setActiveAudit] = useState<AuditHeader | null>(null);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [showNotifs, setShowNotifs] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    if (!user) return;
    // Fetch most recent in_progress audit for scanner
    supabase
      .from('audit_header')
      .select('*')
      .in('status', ['assigned', 'in_progress'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data }) => { if (data) setActiveAudit(data as AuditHeader); });

    // Fetch notifications
    const fetchNotifs = () => {
      supabase.from('notifications').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(20)
        .then(({ data }) => setNotifications(data || []));
    };
    fetchNotifs();
    const interval = setInterval(fetchNotifs, 30000);
    return () => clearInterval(interval);
  }, [user]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
      </div>
    );
  }

  if (!user) return <LoginView />;

  const navItems: { id: View; label: string; icon: typeof LayoutDashboard; roles?: string[] }[] = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'audits', label: 'Audits', icon: ClipboardCheck },
    { id: 'scan', label: 'QR Scanner', icon: ScanLine, roles: ['auditor', 'manager', 'super_admin'] },
    { id: 'products', label: 'Products', icon: Package },
    { id: 'reports', label: 'Reports', icon: FileBarChart, roles: ['manager', 'super_admin', 'viewer'] },
    { id: 'users', label: 'Users', icon: UsersIcon, roles: ['super_admin'] },
  ];

  const visibleNav = navItems.filter(item => !item.roles || item.roles.includes(user.role));
  const unreadCount = notifications.filter(n => !n.read).length;

  const markAllRead = async () => {
    await supabase.from('notifications').update({ read: true }).eq('user_id', user.id).eq('read', false);
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  };

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Mobile header */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-30 bg-slate-900 text-white px-4 py-3 flex items-center justify-between">
        <button onClick={() => setSidebarOpen(true)}><Menu className="w-6 h-6" /></button>
        <div className="flex items-center gap-2">
          <Warehouse className="w-5 h-5 text-blue-400" />
          <span className="font-semibold text-sm">Warehouse Audit</span>
        </div>
        <button onClick={() => setShowNotifs(true)} className="relative">
          <Bell className="w-5 h-5" />
          {unreadCount > 0 && <span className="absolute -top-1 -right-1 w-4 h-4 bg-rose-500 rounded-full text-xs flex items-center justify-center">{unreadCount}</span>}
        </button>
      </div>

      {/* Sidebar */}
      {sidebarOpen && <div className="lg:hidden fixed inset-0 bg-slate-900/50 z-30" onClick={() => setSidebarOpen(false)} />}
      <aside className={`fixed top-0 left-0 h-full w-64 bg-slate-900 text-slate-300 flex flex-col z-40 transition-transform ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>
        <div className="px-5 py-5 flex items-center gap-3 border-b border-slate-800">
          <div className="w-10 h-10 rounded-lg bg-blue-600 flex items-center justify-center">
            <Warehouse className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-white font-semibold text-sm leading-tight">Warehouse Audit</h1>
            <p className="text-xs text-slate-500">Inventory Control</p>
          </div>
          <button onClick={() => setSidebarOpen(false)} className="lg:hidden ml-auto text-slate-400"><X className="w-5 h-5" /></button>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {visibleNav.map(item => {
            const Icon = item.icon;
            const active = view === item.id;
            return (
              <button key={item.id} onClick={() => { setView(item.id); setSidebarOpen(false); }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${active ? 'bg-blue-600 text-white' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'}`}>
                <Icon className="w-5 h-5" /> {item.label}
              </button>
            );
          })}
        </nav>

        <div className="px-4 py-4 border-t border-slate-800">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 rounded-full bg-slate-700 flex items-center justify-center text-white text-sm font-medium">
              {user.full_name.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm text-slate-200 font-medium truncate">{user.full_name}</div>
              <div className="text-xs text-slate-500 capitalize">{user.role.replace('_', ' ')}</div>
            </div>
          </div>
          <button onClick={signOut} className="w-full flex items-center justify-center gap-2 px-3 py-2 text-sm text-slate-400 hover:bg-slate-800 rounded-lg transition-colors">
            <LogOut className="w-4 h-4" /> Sign Out
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="lg:ml-64 pt-14 lg:pt-0">
        {/* Desktop top bar */}
        <div className="hidden lg:flex items-center justify-end px-8 py-4 border-b border-slate-200 bg-white">
          <button onClick={() => setShowNotifs(true)} className="relative p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg">
            <Bell className="w-5 h-5" />
            {unreadCount > 0 && <span className="absolute top-1 right-1 w-4 h-4 bg-rose-500 rounded-full text-white text-xs flex items-center justify-center">{unreadCount}</span>}
          </button>
        </div>

        <div className="max-w-7xl mx-auto px-4 lg:px-8 py-6 lg:py-8">
          {view === 'dashboard' && <DashboardView />}
          {view === 'audits' && <AuditsView onSelectAudit={setActiveAudit} />}
          {view === 'scan' && <ScannerView activeAudit={activeAudit} />}
          {view === 'products' && <ProductsView />}
          {view === 'reports' && <ReportsView />}
          {view === 'users' && <UsersView />}
        </div>
      </main>

      {/* Notifications panel */}
      {showNotifs && (
        <div className="fixed inset-0 z-50 flex justify-end" onClick={() => setShowNotifs(false)}>
          <div className="w-full max-w-sm bg-white shadow-2xl h-full overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 sticky top-0 bg-white">
              <h3 className="font-semibold text-slate-900">Notifications</h3>
              <div className="flex items-center gap-2">
                {unreadCount > 0 && <button onClick={markAllRead} className="text-xs text-blue-600 hover:text-blue-700">Mark all read</button>}
                <button onClick={() => setShowNotifs(false)} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
              </div>
            </div>
            {notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-48 text-center">
                <Bell className="w-10 h-10 text-slate-300 mb-3" />
                <p className="text-sm text-slate-500">No notifications</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {notifications.map(n => (
                  <div key={n.id} className={`px-5 py-3 ${!n.read ? 'bg-blue-50' : ''}`}>
                    <div className="text-sm font-medium text-slate-900">{n.title}</div>
                    <div className="text-sm text-slate-600 mt-0.5">{n.message}</div>
                    <div className="text-xs text-slate-400 mt-1">{new Date(n.created_at).toLocaleString()}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
