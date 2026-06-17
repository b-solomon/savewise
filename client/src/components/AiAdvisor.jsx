import { useState, useRef, useEffect } from 'react';
import { Send, Sparkles, FileText, X } from 'lucide-react';
const TIPS = ['Where can I cut spending?','Am I on track for my savings goals?','Analyze my spending this month','How can I save ₹5000 more?','Review my stock portfolio','Which budget am I exceeding?'];

export default function AiAdvisor({ token, user }) {
  const [msgs, setMsgs] = useState(() => {
    const saved = localStorage.getItem(`sw_chat_${user?.id || 'default'}`);
    return saved ? JSON.parse(saved) : [];
  });
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState(null);
  const btm = useRef(null);
  
  useEffect(()=>{btm.current?.scrollIntoView({behavior:'smooth'});},[msgs]);

  useEffect(() => {
    if (msgs.length > 0) {
      localStorage.setItem(`sw_chat_${user?.id || 'default'}`, JSON.stringify(msgs));
    }
  }, [msgs, user?.id]);

  const send = async (text) => {
    if (!text.trim()) return;
    const userMsg = {sender:'user',text:text.trim(),timestamp:new Date().toISOString()};
    const up = [...msgs,userMsg]; setMsgs(up); setInput(''); setLoading(true);
    try {
      const r = await fetch('/api/ai/chat',{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`},body:JSON.stringify({messages:up})});
      const d = await r.json();
      if (!r.ok || d.error) throw new Error(d.error || 'Failed to get AI response');
      setMsgs(p=>[...p,d]);
    } catch(e) { setMsgs(p=>[...p,{sender:'ai',text:`Error: ${e.message}`,timestamp:new Date().toISOString()}]); }
    finally { setLoading(false); }
  };

  const getReport = async () => {
    setLoading(true);
    try {
      const r = await fetch('/api/ai/monthly-report',{headers:{Authorization:`Bearer ${token}`}});
      const d = await r.json();
      if (!r.ok || d.error) throw new Error(d.error || 'Failed to get monthly report');
      setReport(d);
    } catch(e) { setReport({error:e.message}); }
    finally { setLoading(false); }
  };

  const fmt = (t) => {
    if (!t) return '';
    return t.replace(/\*\*(.*?)\*\*/g,'<strong class="text-white">$1</strong>').replace(/\n- /g,'\n• ').replace(/\n/g,'<br/>');
  };

  return (
    <div className="flex-1 flex flex-col max-h-screen">
      <div className="p-5 border-b border-white/5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-gradient-to-tr from-accent to-savings"><Sparkles className="h-5 w-5 text-white" /></div>
          <div><h2 className="text-base font-display font-bold text-white">SaveWise AI Advisor</h2><p className="text-[10px] text-gray-500">Powered by your real spending & portfolio data</p></div>
        </div>
        <div className="flex gap-2">
          {msgs.length > 0 && (
            <button onClick={() => { setMsgs([]); localStorage.removeItem(`sw_chat_${user?.id || 'default'}`); }} className="px-3 py-1.5 rounded-lg glass text-[10px] text-expense hover:bg-expense/10 hover:text-white font-medium cursor-pointer flex items-center gap-1.5">
              Clear Chat
            </button>
          )}
          <button onClick={getReport} disabled={loading} className="px-3 py-1.5 rounded-lg glass text-[10px] text-gray-300 hover:text-white font-medium cursor-pointer flex items-center gap-1.5"><FileText className="h-3 w-3" />Monthly Report</button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-5 space-y-3">
        {msgs.length===0 && !report && (
          <div className="flex flex-col items-center justify-center h-full gap-5 text-center">
            <Sparkles className="h-10 w-10 text-savings/30" />
            <div><h3 className="text-base font-display font-semibold text-white mb-1">Ask about your finances</h3><p className="text-xs text-gray-500 max-w-md">I analyze your real spending & portfolio to give personalized advice</p></div>
            <div className="flex flex-wrap gap-2 justify-center max-w-lg">{TIPS.map((s,i)=>(<button key={i} onClick={()=>send(s)} className="px-3 py-1.5 rounded-lg glass text-[10px] text-gray-400 hover:text-white hover:bg-white/5 cursor-pointer">{s}</button>))}</div>
          </div>
        )}

        {report && (
          <div className="glass rounded-2xl p-5 mb-3 animate-fade-up">
            <div className="flex justify-between items-center mb-2">
              <h4 className="text-xs font-semibold text-white flex items-center gap-2"><FileText className="h-3.5 w-3.5 text-accent" />Monthly Report — {report.month}</h4>
              <button onClick={() => setReport(null)} className="p-1 rounded-lg text-gray-400 hover:text-white cursor-pointer hover:bg-white/5"><X className="h-3.5 w-3.5" /></button>
            </div>
            {report.error ? <p className="text-expense text-xs">{report.error}</p> :
            <div className="text-xs text-gray-300 leading-relaxed" dangerouslySetInnerHTML={{__html:fmt(report.report||'')}} />}
            {report.savingsRate!=null && <div className="mt-3 text-[10px] text-gray-500">Savings Rate: {report.savingsRate}%</div>}
          </div>
        )}

        {msgs.map((m,i)=>(
          <div key={i} className={`flex ${m.sender==='user'?'justify-end':'justify-start'}`}>
            <div className={`max-w-[75%] rounded-2xl px-4 py-2.5 text-xs leading-relaxed ${m.sender==='user'?'bg-savings/12 text-white rounded-br-md':'glass text-gray-300 rounded-bl-md'}`}>
              {m.sender==='user' ? m.text : <span dangerouslySetInnerHTML={{__html:fmt(m.text)}} />}
            </div>
          </div>
        ))}
        {loading && <div className="flex justify-start"><div className="glass rounded-2xl rounded-bl-md px-4 py-2.5"><div className="flex gap-1"><span className="w-1.5 h-1.5 bg-savings rounded-full animate-bounce" style={{animationDelay:'0ms'}} /><span className="w-1.5 h-1.5 bg-savings rounded-full animate-bounce" style={{animationDelay:'150ms'}} /><span className="w-1.5 h-1.5 bg-savings rounded-full animate-bounce" style={{animationDelay:'300ms'}} /></div></div></div>}
        <div ref={btm} />
      </div>

      <div className="p-4 border-t border-white/5"><div className="flex gap-2">
        <input type="text" value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>e.key==='Enter'&&send(input)} placeholder="Ask about spending, savings, portfolio..." className="flex-1 glass-input rounded-xl px-4 py-2.5 text-xs" disabled={loading} />
        <button onClick={()=>send(input)} disabled={loading||!input.trim()} className="p-2.5 rounded-xl bg-savings text-white disabled:opacity-40 cursor-pointer"><Send className="h-4 w-4" /></button>
      </div></div>
    </div>
  );
}
