import { useState, useEffect, useRef } from 'react';
import { Sparkles, Trash2, Search, ChevronLeft, ChevronRight, CheckCircle, AlertCircle, Upload, FileText } from 'lucide-react';

const CAT_ICONS = {'Food & Dining':'🍕','Transport':'🚗','Shopping':'🛍️','Rent':'🏠','Bills & Utilities':'📱','Entertainment':'🎬','Health':'💊','Education':'📚','Groceries':'🛒','Insurance':'🛡️','EMI & Loans':'🏦','Other':'📌','Salary':'💰','Freelance':'💻','Investment':'📈','Refund':'↩️','Other Income':'💵'};

export default function Transactions({ token, categories, addToast }) {
  const [sms, setSms] = useState('');
  const [results, setResults] = useState([]);
  const [parsing, setParsing] = useState(false);
  const [txns, setTxns] = useState([]);
  const [filterCat, setFilterCat] = useState('');
  const [filterType, setFilterType] = useState('');
  const [search, setSearch] = useState('');
  const [month, setMonth] = useState(() => { const n=new Date(); return `${n.getFullYear()}-${String(n.getMonth()+1).padStart(2,'0')}`; });
  const fileRef = useRef(null);

  const fetchTxns = () => {
    let url = `/api/transactions?month=${month}`;
    if (filterCat) url += `&category=${filterCat}`;
    if (filterType) url += `&type=${filterType}`;
    fetch(url, { headers: { Authorization: `Bearer ${token}` } }).then(r=>r.json()).then(d=>{ if (Array.isArray(d)) setTxns(d); });
  };
  useEffect(fetchTxns, [month, filterCat, filterType, token]);

  const handleParse = async () => {
    if (!sms.trim()) return; setParsing(true); setResults([]);
    try {
      const lines = sms.trim().split(/\n{2,}|\n/).filter(l=>l.trim().length>8);
      let data;
      if (lines.length > 1) {
        const r = await fetch('/api/transactions/bulk-parse', { method:'POST', headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`}, body:JSON.stringify({messages:lines}) });
        data = await r.json(); setResults(data.results||[]);
        if (data.success>0) addToast({id:Date.now(),type:'success',title:'Parsed!',message:`${data.success}/${data.total} transactions saved`});
      } else {
        const r = await fetch('/api/transactions/parse-sms', { method:'POST', headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`}, body:JSON.stringify({smsText:sms.trim()}) });
        data = await r.json(); setResults([data]);
        if (!data.error) addToast({id:Date.now(),type:'success',title:'Saved!',message:`₹${data.amount} ${data.type} → ${data.category}`});
      }
      setSms(''); fetchTxns();
    } catch(e) { addToast({id:Date.now(),type:'error',title:'Error',message:e.message}); }
    finally { setParsing(false); }
  };

  const handleCSV = async (e) => {
    const file = e.target.files?.[0]; if (!file) return;
    const fd = new FormData(); fd.append('file', file);
    try {
      const r = await fetch('/api/transactions/import-csv', { method:'POST', headers:{Authorization:`Bearer ${token}`}, body:fd });
      const data = await r.json();
      if (data.error) addToast({id:Date.now(),type:'error',title:'Import Error',message:data.error});
      else { addToast({id:Date.now(),type:'success',title:'CSV Imported',message:data.message}); fetchTxns(); }
    } catch(e) { addToast({id:Date.now(),type:'error',title:'Error',message:e.message}); }
    e.target.value = '';
  };

  const handleDel = async (id) => {
    await fetch(`/api/transactions/${id}`, { method:'DELETE', headers:{Authorization:`Bearer ${token}`} });
    setTxns(p=>p.filter(t=>t.id!==id));
  };

  const chgMonth = (d) => { const [y,m]=month.split('-').map(Number); const dt=new Date(y,m-1+d,1); setMonth(`${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,'0')}`); };
  const mLabel = () => { const [y,m]=month.split('-'); return new Date(y,m-1).toLocaleDateString('en-IN',{month:'long',year:'numeric'}); };

  const filtered = txns.filter(t => { if (!search) return true; const q=search.toLowerCase(); return t.description?.toLowerCase().includes(q)||t.merchant?.toLowerCase().includes(q)||t.category?.toLowerCase().includes(q); });
  const totals = filtered.reduce((a,t) => { a[t.type]=(a[t.type]||0)+t.amount; return a; }, {});
  const expCats = categories.filter(c=>c.type==='expense');

  return (
    <div className="flex-1 p-6 lg:p-8 space-y-5 overflow-y-auto max-h-screen">
      <h2 className="text-2xl lg:text-3xl font-display font-bold text-white">Transactions</h2>

      {/* SMS Parser */}
      <div className="glass rounded-2xl p-5 border border-savings/20 glow-green">
        <div className="flex items-center gap-2 mb-3"><Sparkles className="h-4 w-4 text-savings" /><h3 className="text-xs font-semibold text-white">Paste Bank SMS — Auto Parse & Save</h3></div>
        <textarea value={sms} onChange={e=>setSms(e.target.value)} rows={3}
          placeholder={"Paste bank SMS here...\n\nExample: INR 450.00 debited from A/c XX1234 on 10-Jun for SWIGGY UPI Ref 412345678\nMultiple SMS? Paste one per line."}
          className="w-full rounded-xl glass-input p-3.5 text-sm resize-none mb-3 border-savings/20 focus:border-savings" />
        <div className="flex gap-3">
          <button onClick={handleParse} disabled={parsing||!sms.trim()} className="px-5 py-2 rounded-xl bg-gradient-to-r from-savings to-emerald-400 text-white text-xs font-semibold shadow-md shadow-savings/10 disabled:opacity-40 cursor-pointer">
            {parsing ? 'Parsing...' : '✨ Parse & Save'}
          </button>
          <input type="file" ref={fileRef} accept=".csv" onChange={handleCSV} className="hidden" />
          <button onClick={()=>fileRef.current?.click()} className="px-4 py-2 rounded-xl glass text-xs text-gray-300 hover:text-white font-medium flex items-center gap-1.5 cursor-pointer">
            <Upload className="h-3.5 w-3.5" />Import CSV
          </button>
        </div>

        {results.length > 0 && (
          <div className="mt-3 space-y-1.5">{results.map((r,i) => (
            <div key={i} className={`flex items-center gap-2 p-2.5 rounded-lg text-[11px] ${r.error?'bg-expense/8 border border-expense/15':'bg-savings/8 border border-savings/15'}`}>
              {r.error ? <><AlertCircle className="h-3.5 w-3.5 text-expense shrink-0" /><span className="text-expense">{r.error}</span></> :
                <><CheckCircle className="h-3.5 w-3.5 text-savings shrink-0" /><span className="text-gray-300">{r.type==='income'?'💰':'💸'} ₹{r.amount?.toLocaleString('en-IN')} → {r.category} {r.merchant?`(${r.merchant})`:''} • {r.date} • {r.paymentMethod}</span></>}
            </div>
          ))}</div>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1.5 glass rounded-lg px-2.5 py-1.5">
          <button onClick={()=>chgMonth(-1)} className="text-gray-400 hover:text-white cursor-pointer"><ChevronLeft className="h-3.5 w-3.5" /></button>
          <span className="text-[11px] font-medium text-white min-w-[110px] text-center">{mLabel()}</span>
          <button onClick={()=>chgMonth(1)} className="text-gray-400 hover:text-white cursor-pointer"><ChevronRight className="h-3.5 w-3.5" /></button>
        </div>
        <select value={filterType} onChange={e=>setFilterType(e.target.value)} className="glass-input rounded-lg px-2.5 py-1.5 text-[11px] cursor-pointer"><option value="">All Types</option><option value="income">Income</option><option value="expense">Expense</option></select>
        <select value={filterCat} onChange={e=>setFilterCat(e.target.value)} className="glass-input rounded-lg px-2.5 py-1.5 text-[11px] cursor-pointer"><option value="">All Categories</option>{expCats.map(c=><option key={c.id} value={c.name}>{c.icon} {c.name}</option>)}</select>
        <div className="relative ml-auto"><Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3 w-3 text-gray-500" /><input type="text" placeholder="Search..." value={search} onChange={e=>setSearch(e.target.value)} className="pl-7 pr-3 py-1.5 rounded-lg glass-input text-[11px] w-40" /></div>
      </div>

      <div className="flex gap-3 text-[11px]"><span className="text-gray-400">{filtered.length} transactions</span><span className="text-income">Income ₹{(totals.income||0).toLocaleString('en-IN')}</span><span className="text-expense">Expenses ₹{(totals.expense||0).toLocaleString('en-IN')}</span></div>

      {/* List */}
      <div className="glass rounded-2xl divide-y divide-white/3">
        {filtered.length > 0 ? filtered.map(t => (
          <div key={t.id} className="flex items-center gap-3 p-3.5 hover:bg-white/2 transition-colors">
            <span className="text-base">{CAT_ICONS[t.category]||'📌'}</span>
            <div className="flex-1 min-w-0">
              <p className="text-[11px] font-medium text-white truncate">{t.description||t.merchant||t.category}</p>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="text-[9px] text-gray-500">{t.date}</span>
                {t.payment_method && <span className="text-[9px] px-1 py-0.5 rounded bg-white/4 text-gray-400">{t.payment_method}</span>}
                {t.source==='sms' && <span className="text-[9px] px-1 py-0.5 rounded bg-savings/10 text-savings">SMS</span>}
                {t.source==='csv' && <span className="text-[9px] px-1 py-0.5 rounded bg-accent/10 text-accent">CSV</span>}
              </div>
            </div>
            <span className={`text-xs font-semibold ${t.type==='income'?'text-income':'text-expense'}`}>{t.type==='income'?'+':'-'}₹{t.amount.toLocaleString('en-IN')}</span>
            <button onClick={()=>handleDel(t.id)} className="p-1 rounded-lg text-gray-600 hover:text-expense hover:bg-expense/10 cursor-pointer"><Trash2 className="h-3 w-3" /></button>
          </div>
        )) : (
          <div className="py-14 text-center"><FileText className="h-8 w-8 mx-auto mb-2 text-gray-600" /><p className="text-xs text-gray-400">No transactions found</p><p className="text-[10px] text-gray-500 mt-1">Paste bank SMS or import CSV above</p></div>
        )}
      </div>
    </div>
  );
}
