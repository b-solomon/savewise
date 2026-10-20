import { useState, useEffect } from 'react';
import { IndianRupee, ArrowUpRight, ArrowDownRight, ChevronLeft, ChevronRight, AlertTriangle, TrendingUp, Briefcase, X } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip } from 'recharts';
import { authFetch, fmtInr } from '../api';

const CAT_ICONS = {'Food & Dining':'🍕','Transport':'🚗','Shopping':'🛍️','Rent':'🏠','Bills & Utilities':'📱','Entertainment':'🎬','Health':'💊','Education':'📚','Groceries':'🛒','Insurance':'🛡️','EMI & Loans':'🏦','Other':'📌','Salary':'💰','Freelance':'💻','Investment':'📈','Refund':'↩️','Other Income':'💵'};

export default function Dashboard({ token, setActiveTab }) {
  const [s, setS] = useState(null);
  const [month, setMonth] = useState(() => { const n = new Date(); return `${n.getFullYear()}-${String(n.getMonth()+1).padStart(2,'0')}`; });
  const [showReportBanner, setShowReportBanner] = useState(false);
  const [prevMonthName, setPrevMonthName] = useState('');

  useEffect(() => {
    authFetch(`/api/dashboard/summary?month=${month}`, {}, token)
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (d && !d.error && Array.isArray(d.categoryBreakdown)) {
          setS(d);
        }
      })
      .catch(console.error);
  }, [month, token]);

  useEffect(() => {
    const now = new Date();
    let prevYear = now.getFullYear();
    let prevMonth = now.getMonth(); // 0-indexed (0=Jan), representing previous month
    if (prevMonth === 0) {
      prevMonth = 12;
      prevYear -= 1;
    }
    const prevMonthStr = `${prevYear}-${String(prevMonth).padStart(2, '0')}`;
    const prevMonthLabel = new Date(prevYear, prevMonth - 1).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
    setPrevMonthName(prevMonthLabel);

    authFetch(`/api/ai/monthly-report?month=${prevMonthStr}`, {}, token)
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (d && d.report) {
          setShowReportBanner(true);
        }
      })
      .catch(console.error);
  }, [token]);

  const chgMonth = (d) => { const [y,m] = month.split('-').map(Number); const dt = new Date(y,m-1+d,1); setMonth(`${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,'0')}`); };
  const mLabel = () => { const [y,m] = month.split('-'); return new Date(y,m-1).toLocaleDateString('en-IN',{month:'long',year:'numeric'}); };

  if (!s || !Array.isArray(s.categoryBreakdown)) {
    return <div className="flex-1 flex items-center justify-center text-gray-500">Loading dashboard...</div>;
  }

  const categoryBreakdown = s.categoryBreakdown || [];
  const dailyTrend = s.dailyTrend || [];
  const recentTransactions = s.recentTransactions || [];
  const alerts = categoryBreakdown.filter(c => c.budgetPercent >= 80);

  return (
    <div className="flex-1 p-6 lg:p-8 space-y-6 overflow-y-auto max-h-screen">
      <div className="flex flex-wrap justify-between items-center gap-4">
        <div><h2 className="text-2xl lg:text-3xl font-display font-bold text-white">Dashboard</h2><p className="text-gray-500 text-xs mt-1">Your complete financial overview</p></div>
        <div className="flex items-center gap-2 glass rounded-xl px-3 py-2">
          <button onClick={()=>chgMonth(-1)} className="text-gray-400 hover:text-white cursor-pointer"><ChevronLeft className="h-4 w-4" /></button>
          <span className="text-xs font-medium text-white min-w-[130px] text-center">{mLabel()}</span>
          <button onClick={()=>chgMonth(1)} className="text-gray-400 hover:text-white cursor-pointer"><ChevronRight className="h-4 w-4" /></button>
        </div>
      </div>

      {/* Auto Monthly Report Banner */}
      {showReportBanner && (
        <div className="glass rounded-2xl p-4 border-l-4 border-l-savings flex items-center justify-between animate-fade-up">
          <div className="flex items-center gap-3">
            <span className="text-xl">📊</span>
            <div>
              <h4 className="text-xs font-semibold text-white">Monthly Report Ready</h4>
              <p className="text-[10px] text-gray-400 mt-0.5">Your automated financial analysis for {prevMonthName} is available.</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={() => setActiveTab('ai')} className="px-3 py-1.5 rounded-lg bg-savings text-white text-[10px] font-semibold hover:bg-savings-light transition-all cursor-pointer">
              Read Report
            </button>
            <button onClick={() => setShowReportBanner(false)} className="p-1 rounded-lg text-gray-400 hover:text-white cursor-pointer hover:bg-white/5">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="glass rounded-2xl p-5 glass-hover">
          <div className="flex items-center justify-between mb-2"><span className="text-[10px] text-gray-500 uppercase tracking-wider">Balance</span><IndianRupee className="h-4 w-4 text-accent" /></div>
          <h3 className={`text-xl font-display font-bold ${(s?.balance || 0) >= 0 ? 'text-white' : 'text-expense'}`}>₹{fmtInr(s?.balance)}</h3>
          <p className="text-[10px] text-gray-500 mt-1">{s?.transactionCount || 0} txns</p>
        </div>
        <div className="glass rounded-2xl p-5 glass-hover">
          <div className="flex items-center justify-between mb-2"><span className="text-[10px] text-gray-500 uppercase tracking-wider">Income</span><ArrowUpRight className="h-4 w-4 text-income" /></div>
          <h3 className="text-xl font-display font-bold text-income">₹{fmtInr(s?.totalIncome)}</h3>
        </div>
        <div className="glass rounded-2xl p-5 glass-hover">
          <div className="flex items-center justify-between mb-2"><span className="text-[10px] text-gray-500 uppercase tracking-wider">Expenses</span><ArrowDownRight className="h-4 w-4 text-expense" /></div>
          <h3 className="text-xl font-display font-bold text-expense">₹{fmtInr(s?.totalExpenses)}</h3>
        </div>
        <div className="glass rounded-2xl p-5 glass-hover">
          <div className="flex items-center justify-between mb-2"><span className="text-[10px] text-gray-500 uppercase tracking-wider">Portfolio</span><Briefcase className="h-4 w-4 text-accent" /></div>
          <h3 className="text-xl font-display font-bold text-white">₹{fmtInr(s?.portfolioValue)}</h3>
          {(s?.portfolioPnl || 0) !== 0 && <p className={`text-[10px] mt-1 ${(s?.portfolioPnl || 0) >= 0 ? 'text-profit' : 'text-loss'}`}>{(s?.portfolioPnl || 0) >= 0 ? '+' : ''}₹{fmtInr(s?.portfolioPnl)} P&L</p>}
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="glass rounded-2xl p-5">
          <h4 className="text-xs font-semibold text-white mb-4">Spending by Category</h4>
          {categoryBreakdown.length > 0 ? (
            <div className="flex items-center gap-4">
              <div className="h-44 w-44 shrink-0"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={categoryBreakdown} dataKey="total" nameKey="category" cx="50%" cy="50%" innerRadius={38} outerRadius={68} paddingAngle={3}>
                {categoryBreakdown.map((e,i) => <Cell key={i} fill={e.color} />)}
              </Pie><Tooltip formatter={v => `₹${fmtInr(v)}`} /></PieChart></ResponsiveContainer></div>
              <div className="space-y-1.5 flex-1 min-w-0">
                {categoryBreakdown.slice(0,7).map((c,i) => (
                  <div key={i} className="flex items-center gap-2 text-[11px]">
                    <span className="w-2 h-2 rounded-full shrink-0" style={{backgroundColor:c.color}} />
                    <span className="text-gray-300 truncate">{CAT_ICONS[c.category]||'📌'} {c.category}</span>
                    <span className="text-gray-500 ml-auto">₹{fmtInr(c.total)}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : <p className="text-gray-600 text-xs text-center py-12">No expenses yet</p>}
        </div>

        <div className="glass rounded-2xl p-5">
          <h4 className="text-xs font-semibold text-white mb-4">Daily Spending</h4>
          {dailyTrend.length > 0 ? (
            <div className="h-44"><ResponsiveContainer width="100%" height="100%"><AreaChart data={dailyTrend}>
              <defs><linearGradient id="eg" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#ef4444" stopOpacity={0.3}/><stop offset="95%" stopColor="#ef4444" stopOpacity={0}/></linearGradient></defs>
              <XAxis dataKey="date" tick={{fill:'#6b7280',fontSize:9}} tickFormatter={v=>(v||'').split('-')[2]||''} />
              <YAxis tick={{fill:'#6b7280',fontSize:9}} tickFormatter={v=>`₹${(Number(v||0)/1000).toFixed(0)}k`} width={45} />
              <Tooltip formatter={v => `₹${fmtInr(v)}`} />
              <Area type="monotone" dataKey="expense" stroke="#ef4444" fill="url(#eg)" strokeWidth={2} />
            </AreaChart></ResponsiveContainer></div>
          ) : <p className="text-gray-600 text-xs text-center py-12">No data</p>}
        </div>
      </div>

      {/* Budget Alerts */}
      {alerts.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold text-white mb-3 flex items-center gap-2"><AlertTriangle className="h-3.5 w-3.5 text-warning" />Budget Alerts</h4>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {alerts.map((c,i) => (
              <div key={i} className={`glass rounded-xl p-3 border-l-4 ${c.budgetPercent>=100?'border-l-expense':'border-l-warning'}`}>
                <div className="flex justify-between text-[11px] mb-1.5"><span className="text-white font-medium">{CAT_ICONS[c.category]||'📌'} {c.category}</span><span className={c.budgetPercent>=100?'text-expense font-bold':'text-warning font-bold'}>{c.budgetPercent}%</span></div>
                <div className="w-full h-1 bg-white/5 rounded-full overflow-hidden"><div className={`h-full rounded-full ${c.budgetPercent>=100?'bg-expense':'bg-warning'}`} style={{width:`${Math.min(c.budgetPercent,100)}%`}} /></div>
                <p className="text-[9px] text-gray-500 mt-1">₹{fmtInr(c.total)} / ₹{fmtInr(c.budget)}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent Transactions */}
      <div className="glass rounded-2xl p-5">
        <h4 className="text-xs font-semibold text-white mb-3">Recent Transactions</h4>
        {recentTransactions.length > 0 ? (
          <div className="space-y-1">
            {recentTransactions.map((t,i) => (
              <div key={i} className="flex items-center gap-3 py-2 border-b border-white/3 last:border-0">
                <span className="text-base">{CAT_ICONS[t.category]||'📌'}</span>
                <div className="flex-1 min-w-0"><p className="text-[11px] font-medium text-white truncate">{t.description||t.merchant||t.category}</p><p className="text-[9px] text-gray-500">{t.date} • {t.payment_method}</p></div>
                <span className={`text-xs font-semibold ${t.type==='income'?'text-income':'text-expense'}`}>{t.type==='income'?'+':'-'}₹{fmtInr(t.amount)}</span>
              </div>
            ))}
          </div>
        ) : <p className="text-gray-600 text-xs text-center py-8">Paste bank SMS to start tracking!</p>}
      </div>
    </div>
  );
}
