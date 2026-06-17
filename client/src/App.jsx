import { useState, useEffect } from 'react';
import Login from './components/Login';
import Sidebar from './components/Sidebar';
import Dashboard from './components/Dashboard';
import Transactions from './components/Transactions';
import Portfolio from './components/Portfolio';
import Budgets from './components/Budgets';
import SavingsGoals from './components/SavingsGoals';
import AiAdvisor from './components/AiAdvisor';
import BankSync from './components/BankSync';
import { X, Menu, Wallet } from 'lucide-react';

export default function App() {
  const [token, setToken] = useState(localStorage.getItem('sw_token') || '');
  const [user, setUser] = useState(null);
  const [tab, setTab] = useState('dashboard');
  const [categories, setCategories] = useState([]);
  const [toasts, setToasts] = useState([]);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [phoneUrl, setPhoneUrl] = useState('');

  useEffect(() => {
    if (token) {
      fetch('/api/auth/me', { headers: { Authorization: `Bearer ${token}` } })
        .then(r => { if (!r.ok) throw new Error(); return r.json(); })
        .then(u => { 
          setUser(u); 
          fetch('/api/categories', { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()).then(d => { if (Array.isArray(d)) setCategories(d); });
          fetch('/api/system/ip', { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()).then(d => { if (d.ip && d.ip !== 'localhost') setPhoneUrl(`http://${d.ip}:3001`); });
        })
        .catch(() => logout());
    }
  }, [token]);

  const login = (t, u) => { localStorage.setItem('sw_token', t); setToken(t); setUser(u); };
  const logout = () => { localStorage.removeItem('sw_token'); setToken(''); setUser(null); setCategories([]); };
  const toast = (t) => { setToasts(p => [...p, t]); setTimeout(() => setToasts(p => p.filter(x => x.id !== t.id)), 5000); };

  const content = () => {
    switch (tab) {
      case 'dashboard': return <Dashboard token={token} setActiveTab={setTab} />;
      case 'transactions': return <Transactions token={token} categories={categories} addToast={toast} />;
      case 'sync': return (
        <div className="flex-1 p-6 lg:p-8 overflow-y-auto max-h-screen">
          <BankSync token={token} phoneUrl={phoneUrl} showToast={(msg, type) => toast({ id: Date.now(), type, title: type === 'success' ? 'Success' : 'Error', message: msg })} />
        </div>
      );
      case 'portfolio': return <Portfolio token={token} addToast={toast} />;
      case 'budgets': return <Budgets token={token} categories={categories} addToast={toast} />;
      case 'savings': return <SavingsGoals token={token} addToast={toast} />;
      case 'ai': return <AiAdvisor key={user?.id || 'default'} token={token} user={user} />;
      default: return <Dashboard token={token} />;
    }
  };

  if (!token || !user) return <Login onLoginSuccess={login} />;

  return (
    <div className="flex flex-col md:flex-row bg-[#060710] min-h-screen text-gray-100 relative">
      {/* Mobile Top Header */}
      <div className="flex md:hidden items-center justify-between p-4 border-b border-white/5 bg-[#080a14] relative z-30 shrink-0">
        <button onClick={() => setSidebarOpen(true)} className="p-2 rounded-xl glass hover:text-white cursor-pointer">
          <Menu className="h-5 w-5 text-gray-300" />
        </button>
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-gradient-to-tr from-savings to-emerald-400">
            <Wallet className="h-4 w-4 text-white" />
          </div>
          <span className="font-display font-bold text-sm text-white tracking-wide">SaveWise</span>
        </div>
        <div className="w-9 h-9" /> {/* balance/spacing placeholder */}
      </div>

      <Sidebar activeTab={tab} setActiveTab={setTab} user={user} onLogout={logout} isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} phoneUrl={phoneUrl} />
      <div className="flex-1 flex flex-col min-w-0 relative">
        <div className="absolute top-0 right-1/4 w-[40vw] h-[30vh] rounded-full bg-savings/4 blur-[140px] pointer-events-none animate-glow" />
        <div className="absolute bottom-1/4 left-1/4 w-[35vw] h-[25vh] rounded-full bg-accent/4 blur-[140px] pointer-events-none animate-glow" style={{ animationDelay: '-4s' }} />
        {content()}
      </div>

      <div className="fixed top-5 right-5 z-50 flex flex-col gap-2 max-w-xs pointer-events-none">
        {toasts.map(t => (
          <div key={t.id} className={`glass border-l-4 rounded-xl p-3.5 flex gap-2 shadow-2xl animate-slide-in pointer-events-auto ${t.type === 'success' ? 'border-l-savings' : 'border-l-expense'}`}>
            <div className="flex-1"><h5 className="text-[10px] font-bold text-white">{t.title}</h5><p className="text-[9px] text-gray-400 mt-0.5">{t.message}</p></div>
            <button onClick={() => setToasts(p => p.filter(x => x.id !== t.id))} className="text-gray-500 hover:text-white cursor-pointer"><X className="h-3 w-3" /></button>
          </div>
        ))}
      </div>
    </div>
  );
}
