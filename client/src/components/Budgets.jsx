import { useState, useEffect } from 'react';
import { Target, Plus, Trash2 } from 'lucide-react';

export default function Budgets({ token, categories, addToast }) {
  const [budgets, setBudgets] = useState([]);
  const [spending, setSpending] = useState({});
  const [cat, setCat] = useState('');
  const [limit, setLimit] = useState('');
  const month = `${new Date().getFullYear()}-${String(new Date().getMonth()+1).padStart(2,'0')}`;
  const expCats = categories.filter(c=>c.type==='expense');
  const catLookup = {}; categories.forEach(c=>{catLookup[c.name]=c;});

  const load = async () => {
    const [b,s] = await Promise.all([
      fetch('/api/budgets',{headers:{Authorization:`Bearer ${token}`}}).then(r=>r.json()),
      fetch(`/api/dashboard/summary?month=${month}`,{headers:{Authorization:`Bearer ${token}`}}).then(r=>r.json())
    ]);
    if (Array.isArray(b)) setBudgets(b);
    const m={}; (s.categoryBreakdown||[]).forEach(c=>{m[c.category]=c.total;}); setSpending(m);
  };
  useEffect(()=>{load();},[token]);

  const add = async (e) => {
    e.preventDefault(); if(!cat||!limit) return;
    await fetch('/api/budgets',{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`},body:JSON.stringify({category:cat,monthlyLimit:parseFloat(limit)})});
    addToast({id:Date.now(),type:'success',title:'Budget Set',message:`₹${parseFloat(limit).toLocaleString('en-IN')} for ${cat}`});
    setCat(''); setLimit(''); load();
  };
  const del = async (id) => {
    await fetch(`/api/budgets/${id}`,{method:'DELETE',headers:{Authorization:`Bearer ${token}`}});
    setBudgets(p=>p.filter(b=>b.id!==id));
  };

  const totB = budgets.reduce((s,b)=>s+b.monthly_limit,0);
  const totS = budgets.reduce((s,b)=>s+(spending[b.category]||0),0);
  const totP = totB>0?Math.round(totS/totB*100):0;

  return (
    <div className="flex-1 p-6 lg:p-8 space-y-5 overflow-y-auto max-h-screen">
      <h2 className="text-2xl lg:text-3xl font-display font-bold text-white">Budgets</h2>

      <form onSubmit={add} className="glass rounded-2xl p-5 flex flex-wrap items-end gap-3">
        <div className="flex-1 min-w-[160px]"><label className="block text-[10px] text-gray-500 mb-1">Category</label><select value={cat} onChange={e=>setCat(e.target.value)} className="w-full glass-input rounded-lg px-3 py-2 text-xs cursor-pointer"><option value="">Select</option>{expCats.map(c=><option key={c.id} value={c.name}>{c.icon} {c.name}</option>)}</select></div>
        <div className="w-[130px]"><label className="block text-[10px] text-gray-500 mb-1">Monthly Limit ₹</label><input type="number" min="1" value={limit} onChange={e=>setLimit(e.target.value)} placeholder="5000" className="w-full glass-input rounded-lg px-3 py-2 text-xs" /></div>
        <button type="submit" className="px-4 py-2 rounded-lg bg-gradient-to-r from-savings to-emerald-400 text-white text-xs font-semibold cursor-pointer flex items-center gap-1"><Plus className="h-3.5 w-3.5" />Set</button>
      </form>

      {budgets.length>0 && (
        <div className="glass rounded-2xl p-5">
          <div className="flex justify-between text-xs mb-2"><span className="text-white font-medium">Overall Budget</span><span className={`font-bold ${totP>=100?'text-expense':totP>=80?'text-warning':'text-savings'}`}>{totP}%</span></div>
          <div className="w-full h-2.5 bg-white/4 rounded-full overflow-hidden"><div className={`h-full rounded-full transition-all ${totP>=100?'bg-expense':totP>=80?'bg-warning':'bg-savings'}`} style={{width:`${Math.min(totP,100)}%`}} /></div>
          <p className="text-[10px] text-gray-500 mt-1.5">₹{Math.round(totS).toLocaleString('en-IN')} / ₹{Math.round(totB).toLocaleString('en-IN')}</p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {budgets.map(b => {
          const sp=spending[b.category]||0; const pct=Math.round(sp/b.monthly_limit*100); const rem=b.monthly_limit-sp; const c=catLookup[b.category]||{};
          return (
            <div key={b.id} className="glass rounded-2xl p-5 glass-hover group relative">
              <button onClick={()=>del(b.id)} className="absolute top-3 right-3 p-1 rounded-lg text-gray-600 hover:text-expense hover:bg-expense/10 opacity-0 group-hover:opacity-100 cursor-pointer"><Trash2 className="h-3 w-3" /></button>
              <div className="flex items-center gap-2 mb-3"><span className="text-lg">{c.icon||'📌'}</span><span className="text-xs font-semibold text-white">{b.category}</span></div>
              <div className="flex justify-between text-[10px] mb-1.5"><span className="text-gray-400">₹{Math.round(sp).toLocaleString('en-IN')} spent</span><span className={`font-bold ${pct>=100?'text-expense':pct>=80?'text-warning':'text-savings'}`}>{pct}%</span></div>
              <div className="w-full h-1.5 bg-white/4 rounded-full overflow-hidden"><div className={`h-full rounded-full ${pct>=100?'bg-expense':pct>=80?'bg-warning':'bg-savings'}`} style={{width:`${Math.min(pct,100)}%`}} /></div>
              <p className="text-[9px] text-gray-500 mt-1">{rem>=0?`₹${Math.round(rem).toLocaleString('en-IN')} left`:`₹${Math.round(Math.abs(rem)).toLocaleString('en-IN')} over!`}</p>
            </div>
          );
        })}
      </div>

      {budgets.length===0 && <div className="glass rounded-2xl py-14 text-center"><Target className="h-8 w-8 mx-auto mb-2 text-gray-600" /><p className="text-xs text-gray-400">No budgets set</p></div>}
    </div>
  );
}
