import { Wallet, LayoutDashboard, ArrowLeftRight, TrendingUp, Target, PiggyBank, MessageSquareCode, LogOut, User, Shield, X } from 'lucide-react';
const MENU = [
  { id:'dashboard', name:'Dashboard', icon: LayoutDashboard },
  { id:'transactions', name:'Transactions', icon: ArrowLeftRight },
  { id:'portfolio', name:'Portfolio', icon: TrendingUp },
  { id:'budgets', name:'Budgets', icon: Target },
  { id:'savings', name:'Savings Goals', icon: PiggyBank },
  { id:'ai', name:'AI Advisor', icon: MessageSquareCode },
];

export default function Sidebar({ activeTab, setActiveTab, user, onLogout, isOpen, onClose, phoneUrl }) {
  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div onClick={onClose} className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 md:hidden" />
      )}

      {/* Sidebar Panel */}
      <div className={`fixed inset-y-0 left-0 w-64 flex flex-col min-h-screen border-r border-white/5 bg-[#080a14] shrink-0 z-50 transition-transform duration-300 md:relative md:flex md:z-20 ${isOpen ? 'translate-x-0' : 'max-md:-translate-x-full'}`}>
        <div className="p-5 border-b border-white/5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-gradient-to-tr from-savings to-emerald-400 shadow-lg shadow-savings/15">
              <Wallet className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="font-display font-bold text-lg text-white tracking-wide">SaveWise</h1>
              <div className="flex items-center gap-1 text-[9px] text-gray-500"><Shield className="h-2.5 w-2.5" />E2E Encrypted</div>
            </div>
          </div>
          {/* Close button on mobile */}
          <button onClick={onClose} className="p-1 rounded-lg text-gray-400 hover:text-white md:hidden cursor-pointer hover:bg-white/5">
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="flex-1 px-3 py-5 space-y-1">
          {MENU.map(item => {
            const Icon = item.icon; const active = activeTab === item.id;
            return (
              <button key={item.id} onClick={()=>{setActiveTab(item.id); onClose();}}
                className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-all cursor-pointer group ${active ? 'bg-savings/10 text-white' : 'text-gray-400 hover:text-gray-200 hover:bg-white/3'}`}>
                <Icon className={`h-[18px] w-[18px] ${active ? 'text-savings' : 'text-gray-500 group-hover:text-gray-300'}`} />
                <span>{item.name}</span>
                {active && <div className="ml-auto w-1.5 h-1.5 rounded-full bg-savings shadow-[0_0_8px_#10b981]" />}
              </button>
            );
          })}
        </nav>

        <div className="p-3 border-t border-white/5 space-y-3">
          {phoneUrl && (
            <div className="p-2.5 rounded-xl bg-white/2 border border-white/5 text-[10px] text-gray-400 text-center select-all cursor-pointer hover:bg-white/5 hover:text-white transition-all">
              📱 Open on phone: <span className="font-mono text-savings font-semibold block mt-1">{phoneUrl}</span>
            </div>
          )}
          <div className="flex items-center gap-3 p-3 rounded-xl bg-white/2 border border-white/5">
            <div className="h-8 w-8 rounded-full bg-gradient-to-tr from-savings to-emerald-400 flex items-center justify-center font-display font-semibold text-xs text-white">
              {user?.name ? user.name[0].toUpperCase() : <User className="h-4 w-4" />}
            </div>
            <div className="overflow-hidden min-w-0">
              <p className="text-xs font-semibold text-white truncate">{user?.name || 'User'}</p>
              <p className="text-[10px] text-gray-500 truncate">{user?.email}</p>
            </div>
          </div>
          <button onClick={onLogout} className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-xs text-gray-400 hover:text-expense hover:bg-expense/10 transition-all cursor-pointer">
            <LogOut className="h-4 w-4" /><span>Sign Out</span>
          </button>
        </div>
      </div>
    </>
  );
}
