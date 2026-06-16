import { useState, useEffect } from 'react';
import { PiggyBank, Plus, Trash2, X } from 'lucide-react';
const ICONS = ['🎯','🏠','🚗','✈️','💍','🎓','💰','📱','🎮','🏖️','💻','🎸','👶','💪'];

export default function SavingsGoals({ token, addToast }) {
  const [goals, setGoals] = useState([]);
  const [show, setShow] = useState(false);
  const [name, setName] = useState('');
  const [target, setTarget] = useState('');
  const [deadline, setDeadline] = useState('');
  const [icon, setIcon] = useState('🎯');
  const [contId, setContId] = useState(null);
  const [contAmt, setContAmt] = useState('');

  const load = () => { fetch('/api/savings-goals',{headers:{Authorization:`Bearer ${token}`}}).then(r=>r.json()).then(d=>{if(Array.isArray(d))setGoals(d);}); };
  useEffect(load,[token]);

  const create = async (e) => {
    e.preventDefault(); if(!name||!target) return;
    const r = await fetch('/api/savings-goals',{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`},body:JSON.stringify({name,targetAmount:parseFloat(target),deadline:deadline||null,icon})});
    const d = await r.json(); setGoals(p=>[d,...p]); setShow(false); setName(''); setTarget(''); setDeadline(''); setIcon('🎯');
    addToast({id:Date.now(),type:'success',title:'Goal Created',message:`${icon} ${name}`});
  };

  const contribute = async () => {
    if(!contAmt||parseFloat(contAmt)<=0) return;
    const r = await fetch(`/api/savings-goals/${contId}/contribute`,{method:'PUT',headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`},body:JSON.stringify({amount:parseFloat(contAmt)})});
    const d = await r.json(); setGoals(p=>p.map(g=>g.id===contId?d:g)); setContId(null); setContAmt('');
    addToast({id:Date.now(),type:'success',title:'Saved!',message:`₹${parseFloat(contAmt).toLocaleString('en-IN')} contributed`});
  };

  const del = async (id) => { await fetch(`/api/savings-goals/${id}`,{method:'DELETE',headers:{Authorization:`Bearer ${token}`}}); setGoals(p=>p.filter(g=>g.id!==id)); };

  return (
    <div className="flex-1 p-6 lg:p-8 space-y-5 overflow-y-auto max-h-screen">
      <div className="flex justify-between items-center">
        <div><h2 className="text-2xl lg:text-3xl font-display font-bold text-white">Savings Goals</h2><p className="text-gray-500 text-xs mt-1">Track your financial targets</p></div>
        <button onClick={()=>setShow(!show)} className="px-4 py-2 rounded-xl bg-gradient-to-r from-savings to-emerald-400 text-white text-xs font-semibold cursor-pointer flex items-center gap-1.5"><Plus className="h-3.5 w-3.5" />New Goal</button>
      </div>

      {show && (
        <form onSubmit={create} className="glass rounded-2xl p-5 space-y-3 animate-fade-up">
          <div className="flex flex-wrap gap-3">
            <div className="flex-1 min-w-[160px]"><label className="block text-[10px] text-gray-500 mb-1">Name</label><input type="text" required value={name} onChange={e=>setName(e.target.value)} placeholder="e.g. Vacation" className="w-full glass-input rounded-lg px-3 py-2 text-xs" /></div>
            <div className="w-[120px]"><label className="block text-[10px] text-gray-500 mb-1">Target ₹</label><input type="number" required min="1" value={target} onChange={e=>setTarget(e.target.value)} className="w-full glass-input rounded-lg px-3 py-2 text-xs" /></div>
            <div className="w-[140px]"><label className="block text-[10px] text-gray-500 mb-1">Deadline</label><input type="date" value={deadline} onChange={e=>setDeadline(e.target.value)} className="w-full glass-input rounded-lg px-3 py-2 text-xs" /></div>
          </div>
          <div><label className="block text-[10px] text-gray-500 mb-1">Icon</label><div className="flex gap-1.5 flex-wrap">{ICONS.map(ic=>(<button key={ic} type="button" onClick={()=>setIcon(ic)} className={`p-1.5 rounded-lg text-sm cursor-pointer ${icon===ic?'bg-savings/20 ring-1 ring-savings':'bg-white/3 hover:bg-white/5'}`}>{ic}</button>))}</div></div>
          <button type="submit" className="px-4 py-2 rounded-lg bg-savings text-white text-xs font-semibold cursor-pointer">Create</button>
        </form>
      )}

      {contId && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={()=>setContId(null)}>
          <div className="glass rounded-2xl p-5 w-full max-w-xs" onClick={e=>e.stopPropagation()}>
            <div className="flex justify-between items-center mb-3"><h3 className="text-xs font-semibold text-white">Contribute</h3><button onClick={()=>setContId(null)} className="text-gray-400 cursor-pointer"><X className="h-4 w-4" /></button></div>
            <input type="number" min="1" value={contAmt} onChange={e=>setContAmt(e.target.value)} placeholder="Amount ₹" className="w-full glass-input rounded-lg px-3 py-2 text-xs mb-3" autoFocus />
            <button onClick={contribute} className="w-full py-2 rounded-lg bg-savings text-white text-xs font-semibold cursor-pointer">Save ₹{contAmt||'0'}</button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {goals.map(g => {
          const pct=g.target_amount>0?Math.round(g.current_amount/g.target_amount*100):0;
          const r=50*0.65, circ=2*Math.PI*r, off=circ-(Math.min(pct,100)/100)*circ;
          const col = pct>=100?'#10b981':pct>=50?'#10b981':pct>=25?'#f59e0b':'#ef4444';
          return (
            <div key={g.id} className="glass rounded-2xl p-5 glass-hover group relative">
              <button onClick={()=>del(g.id)} className="absolute top-3 right-3 p-1 rounded-lg text-gray-600 hover:text-expense hover:bg-expense/10 opacity-0 group-hover:opacity-100 cursor-pointer"><Trash2 className="h-3 w-3" /></button>
              <div className="flex items-start gap-3">
                <div className="relative shrink-0"><svg width="70" height="70" className="-rotate-90"><circle cx="35" cy="35" r={r} fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth="5"/><circle cx="35" cy="35" r={r} fill="none" stroke={col} strokeWidth="5" strokeDasharray={circ} strokeDashoffset={off} strokeLinecap="round" className="transition-all duration-500"/></svg><span className="absolute inset-0 flex items-center justify-center text-base">{g.icon}</span></div>
                <div className="flex-1 min-w-0 pt-1">
                  <h4 className="text-xs font-semibold text-white">{g.name}</h4>
                  <p className="text-[10px] text-gray-400 mt-0.5">₹{g.current_amount.toLocaleString('en-IN')} / ₹{g.target_amount.toLocaleString('en-IN')}</p>
                  <p className="text-[10px] mt-0.5" style={{color:col}}>{pct}%</p>
                  {g.deadline && <p className="text-[9px] text-gray-500">Due: {g.deadline}</p>}
                </div>
              </div>
              <button onClick={()=>{setContId(g.id);setContAmt('');}} className="mt-3 w-full py-1.5 rounded-lg bg-savings/10 text-savings text-[10px] font-semibold hover:bg-savings/20 cursor-pointer">+ Contribute</button>
            </div>
          );
        })}
      </div>
      {goals.length===0&&!show && <div className="glass rounded-2xl py-14 text-center"><PiggyBank className="h-8 w-8 mx-auto mb-2 text-gray-600" /><p className="text-xs text-gray-400">No goals yet</p></div>}
    </div>
  );
}
