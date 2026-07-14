import { useState, useEffect } from 'react';
import { TrendingUp, TrendingDown, Plus, Trash2, Search, Briefcase, RefreshCw, X } from 'lucide-react';

export default function Portfolio({ token, addToast }) {
  const [holdings, setHoldings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [symbol, setSymbol] = useState('');
  const [name, setName] = useState('');
  const [exchange, setExchange] = useState('NSE');
  const [qty, setQty] = useState('');
  const [buyPrice, setBuyPrice] = useState('');
  const [buyDate, setBuyDate] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searchTimeout, setSearchTimeout] = useState(null);

  const fetchHoldings = async () => {
    setLoading(true);
    try {
      const r = await fetch('/api/holdings', { headers: { Authorization: `Bearer ${token}` } });
      const d = await r.json();
      if (Array.isArray(d)) setHoldings(d);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchHoldings(); }, [token]);

  const handleSearch = (q) => {
    setSymbol(q);
    if (searchTimeout) clearTimeout(searchTimeout);
    if (q.length < 1) { setSearchResults([]); return; }
    setSearchTimeout(setTimeout(async () => {
      try {
        const r = await fetch(`/api/holdings/search?q=${encodeURIComponent(q)}`, { headers: { Authorization: `Bearer ${token}` } });
        const d = await r.json();
        setSearchResults(Array.isArray(d) ? d : []);
      } catch { setSearchResults([]); }
    }, 300));
  };

  const selectSymbol = (s) => {
    setSymbol(s.symbol.replace('.NS','').replace('.BO',''));
    setName(s.name);
    if (s.symbol.endsWith('.NS')) setExchange('NSE');
    else if (s.symbol.endsWith('.BO')) setExchange('BSE');
    else setExchange('US');
    setSearchResults([]);
  };

  const [submitting, setSubmitting] = useState(false);

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!symbol || !qty || !buyPrice || submitting) return;
    setSubmitting(true);
    try {
      const r = await fetch('/api/holdings', {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ symbol, name, exchange, quantity: parseFloat(qty), avgBuyPrice: parseFloat(buyPrice), buyDate: buyDate || undefined })
      });
      if (!r.ok) {
        const data = await r.json().catch(() => ({}));
        throw new Error(data.error || `Server error (${r.status})`);
      }
      addToast({ id: Date.now(), type: 'success', title: 'Holding Added', message: `${symbol} × ${qty} @ ₹${buyPrice}` });
      setShowAdd(false); setSymbol(''); setName(''); setQty(''); setBuyPrice(''); setBuyDate('');
      fetchHoldings();
    } catch (err) {
      const msg = err.message === 'Failed to fetch'
        ? 'Server is offline or waking up. Please wait 10-15 seconds and try again.'
        : err.message;
      addToast({ id: Date.now(), type: 'error', title: 'Connection Error', message: msg });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDel = async (id, sym) => {
    await fetch(`/api/holdings/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
    setHoldings(p => p.filter(h => h.id !== id));
    addToast({ id: Date.now(), type: 'success', title: 'Removed', message: `${sym} deleted` });
  };

  const totalInvested = holdings.reduce((s, h) => s + (h.investedValue || h.avg_buy_price * h.quantity), 0);
  const totalCurrent = holdings.reduce((s, h) => s + (h.currentValue || h.avg_buy_price * h.quantity), 0);
  const totalPnl = totalCurrent - totalInvested;
  const totalPnlPct = totalInvested > 0 ? (totalPnl / totalInvested) * 100 : 0;

  return (
    <div className="flex-1 p-6 lg:p-8 space-y-5 overflow-y-auto max-h-screen">
      <div className="flex flex-wrap justify-between items-center gap-3">
        <div><h2 className="text-2xl lg:text-3xl font-display font-bold text-white">Portfolio</h2><p className="text-gray-500 text-xs mt-1">Live P&L • NSE/BSE & US Stocks</p></div>
        <div className="flex gap-2">
          <button onClick={fetchHoldings} className="p-2.5 rounded-xl glass text-gray-400 hover:text-white cursor-pointer"><RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /></button>
          <button onClick={() => setShowAdd(!showAdd)} className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-savings to-emerald-400 text-white text-xs font-semibold cursor-pointer flex items-center gap-1.5">
            <Plus className="h-3.5 w-3.5" />Add Holding
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="glass rounded-2xl p-5 glass-hover">
          <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">Invested</p>
          <h3 className="text-lg font-display font-bold text-white">₹{Math.round(totalInvested).toLocaleString('en-IN')}</h3>
        </div>
        <div className="glass rounded-2xl p-5 glass-hover">
          <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">Current Value</p>
          <h3 className="text-lg font-display font-bold text-white">₹{Math.round(totalCurrent).toLocaleString('en-IN')}</h3>
        </div>
        <div className={`glass rounded-2xl p-5 glass-hover border-l-4 ${totalPnl >= 0 ? 'border-l-profit' : 'border-l-loss'}`}>
          <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">Total P&L</p>
          <h3 className={`text-lg font-display font-bold ${totalPnl >= 0 ? 'text-profit' : 'text-loss'}`}>
            {totalPnl >= 0 ? '+' : ''}₹{Math.round(totalPnl).toLocaleString('en-IN')}
            <span className="text-xs ml-1.5 font-normal">({totalPnlPct >= 0 ? '+' : ''}{totalPnlPct.toFixed(2)}%)</span>
          </h3>
        </div>
      </div>

      {/* Add Form */}
      {showAdd && (
        <form onSubmit={handleAdd} className="glass rounded-2xl p-5 space-y-3 animate-fade-up">
          <div className="flex flex-wrap gap-3">
            <div className="flex-1 min-w-[160px] relative">
              <label className="block text-[10px] text-gray-500 mb-1">Symbol</label>
              <input type="text" required value={symbol} onChange={e => handleSearch(e.target.value)} placeholder="e.g. RELIANCE, AAPL" className="w-full glass-input rounded-lg px-3 py-2 text-xs" />
              {searchResults.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-1 glass rounded-lg z-30 max-h-40 overflow-y-auto">
                  {searchResults.map((s, i) => (
                    <button key={i} type="button" onClick={() => selectSymbol(s)} className="w-full px-3 py-2 text-left text-[11px] hover:bg-white/5 cursor-pointer flex justify-between">
                      <span className="text-white font-medium">{s.symbol}</span><span className="text-gray-500 truncate ml-2">{s.name}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="w-[100px]">
              <label className="block text-[10px] text-gray-500 mb-1">Exchange</label>
              <select value={exchange} onChange={e => setExchange(e.target.value)} className="w-full glass-input rounded-lg px-2 py-2 text-xs cursor-pointer">
                <option value="NSE">NSE</option><option value="BSE">BSE</option><option value="US">US</option>
              </select>
            </div>
            <div className="w-[90px]"><label className="block text-[10px] text-gray-500 mb-1">Qty</label><input type="number" required min="0.01" step="0.01" value={qty} onChange={e => setQty(e.target.value)} className="w-full glass-input rounded-lg px-2 py-2 text-xs" /></div>
            <div className="w-[110px]"><label className="block text-[10px] text-gray-500 mb-1">Avg Buy ₹</label><input type="number" required min="0.01" step="0.01" value={buyPrice} onChange={e => setBuyPrice(e.target.value)} className="w-full glass-input rounded-lg px-2 py-2 text-xs" /></div>
            <div className="w-[120px]"><label className="block text-[10px] text-gray-500 mb-1">Buy Date</label><input type="date" value={buyDate} onChange={e => setBuyDate(e.target.value)} className="w-full glass-input rounded-lg px-2 py-2 text-xs" /></div>
          </div>
          <div className="flex gap-2">
            <button type="submit" disabled={submitting} className="px-4 py-2 rounded-lg bg-savings text-white text-xs font-semibold cursor-pointer disabled:opacity-50 flex items-center gap-1">
              {submitting && <RefreshCw className="h-3 w-3 animate-spin" />}
              {submitting ? 'Adding...' : 'Add'}
            </button>
            <button type="button" onClick={() => setShowAdd(false)} className="px-4 py-2 rounded-lg glass text-xs text-gray-400 cursor-pointer">Cancel</button>
          </div>
        </form>
      )}

      {/* Holdings Table */}
      {loading ? (
        <div className="glass rounded-2xl py-16 text-center"><RefreshCw className="h-6 w-6 mx-auto mb-2 text-gray-600 animate-spin" /><p className="text-xs text-gray-500">Fetching live prices...</p></div>
      ) : holdings.length > 0 ? (
        <div className="glass rounded-2xl overflow-x-auto">
          <table className="w-full text-xs">
            <thead><tr className="border-b border-white/5 text-[10px] text-gray-500 uppercase">
              <th className="text-left p-3.5">Stock</th><th className="text-right p-3.5">Qty</th><th className="text-right p-3.5">Avg Buy</th>
              <th className="text-right p-3.5">Live Price</th><th className="text-right p-3.5">Day Chg</th>
              <th className="text-right p-3.5">Invested</th><th className="text-right p-3.5">Current</th>
              <th className="text-right p-3.5">P&L</th><th className="p-3.5"></th>
            </tr></thead>
            <tbody>
              {holdings.map(h => (
                <tr key={h.id} className="border-b border-white/3 hover:bg-white/2 transition-colors">
                  <td className="p-3.5">
                    <div className="font-semibold text-white">{h.symbol}</div>
                    <div className="text-[9px] text-gray-500">{h.marketName || h.name || h.exchange}</div>
                  </td>
                  <td className="text-right p-3.5 text-gray-300">{h.quantity}</td>
                  <td className="text-right p-3.5 text-gray-300">₹{h.avg_buy_price.toLocaleString('en-IN')}</td>
                  <td className="text-right p-3.5 font-semibold text-white">
                    {h.priceError ? <span className="text-gray-500">N/A</span> : `₹${h.livePrice?.toLocaleString('en-IN')}`}
                  </td>
                  <td className={`text-right p-3.5 ${(h.dayChangePct||0) >= 0 ? 'text-profit' : 'text-loss'}`}>
                    {h.dayChangePct >= 0 ? '+' : ''}{h.dayChangePct?.toFixed(2)}%
                  </td>
                  <td className="text-right p-3.5 text-gray-300">₹{(h.investedValue||0).toLocaleString('en-IN')}</td>
                  <td className="text-right p-3.5 text-white font-medium">₹{(h.currentValue||0).toLocaleString('en-IN')}</td>
                  <td className={`text-right p-3.5 font-bold ${(h.pnl||0) >= 0 ? 'text-profit' : 'text-loss'}`}>
                    <div>{h.pnl >= 0 ? '+' : ''}₹{Math.round(h.pnl||0).toLocaleString('en-IN')}</div>
                    <div className="text-[9px] font-normal">({h.pnlPct >= 0 ? '+' : ''}{h.pnlPct?.toFixed(2)}%)</div>
                  </td>
                  <td className="p-3.5">
                    <button onClick={() => handleDel(h.id, h.symbol)} className="p-1 rounded-lg text-gray-600 hover:text-expense hover:bg-expense/10 cursor-pointer"><Trash2 className="h-3 w-3" /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="glass rounded-2xl py-16 text-center">
          <Briefcase className="h-8 w-8 mx-auto mb-2 text-gray-600" />
          <p className="text-xs text-gray-400">No holdings yet</p>
          <p className="text-[10px] text-gray-500 mt-1">Click "Add Holding" to track your stocks</p>
        </div>
      )}
    </div>
  );
}
