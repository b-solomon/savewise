import { useState } from 'react';
import { Wallet, Mail, Lock, User, ShieldCheck } from 'lucide-react';

export default function Login({ onLoginSuccess }) {
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault(); setError(''); setLoading(true);
    try {
      const ep = isRegister ? '/api/auth/register' : '/api/auth/login';
      const body = isRegister ? { email, password, name } : { email, password };
      const res = await fetch(ep, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Auth failed');
      onLoginSuccess(data.token, data.user);
    } catch (err) { setError(err.message); } finally { setLoading(false); }
  };

  return (
    <div className="relative min-h-screen flex items-center justify-center bg-[#060710] p-4 overflow-hidden">
      <div className="absolute top-[-15%] left-[-10%] w-[55vw] h-[55vw] rounded-full bg-savings/8 blur-[140px] animate-glow" />
      <div className="absolute bottom-[-15%] right-[-10%] w-[50vw] h-[50vw] rounded-full bg-accent/8 blur-[140px] animate-glow" style={{animationDelay:'-5s'}} />

      <div className="w-full max-w-md z-10 animate-fade-up">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center p-3.5 rounded-2xl bg-gradient-to-tr from-savings to-emerald-400 shadow-lg shadow-savings/25 mb-4">
            <Wallet className="h-8 w-8 text-white" />
          </div>
          <h1 className="text-4xl font-display font-bold tracking-tight text-white">Save<span className="text-gradient">Wise</span></h1>
          <p className="text-gray-500 text-sm mt-2">Bank-grade encrypted finance tracker</p>
        </div>

        <div className="glass rounded-3xl p-8 glow-green">
          <h2 className="text-xl font-display font-semibold text-white mb-6 text-center">{isRegister ? 'Create Account' : 'Welcome Back'}</h2>
          {error && <div className="mb-4 p-3 rounded-xl bg-expense/10 border border-expense/20 text-expense text-xs">{error}</div>}

          <form onSubmit={handleSubmit} className="space-y-4">
            {isRegister && (
              <div className="relative">
                <User className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
                <input type="text" required placeholder="Full Name" value={name} onChange={e=>setName(e.target.value)} className="w-full pl-11 pr-4 py-3 rounded-xl glass-input text-sm" />
              </div>
            )}
            <div className="relative">
              <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
              <input type="email" required placeholder="Email address" value={email} onChange={e=>setEmail(e.target.value)} className="w-full pl-11 pr-4 py-3 rounded-xl glass-input text-sm" />
            </div>
            <div className="relative">
              <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
              <input type="password" required placeholder="Password" value={password} onChange={e=>setPassword(e.target.value)} className="w-full pl-11 pr-4 py-3 rounded-xl glass-input text-sm" />
            </div>
            <button type="submit" disabled={loading}
              className="w-full py-3.5 rounded-xl bg-gradient-to-r from-savings to-emerald-400 text-white font-semibold text-sm hover:opacity-95 transition disabled:opacity-50 shadow-lg shadow-savings/15 cursor-pointer">
              {loading ? 'Processing...' : isRegister ? 'Create Account' : 'Sign In'}
            </button>
          </form>

          <div className="flex items-center justify-center gap-2 mt-5 text-[10px] text-gray-500">
            <ShieldCheck className="h-3 w-3" /> AES-256 encrypted • Zero-knowledge security
          </div>

          <p className="mt-4 text-center text-xs text-gray-400">
            {isRegister ? 'Already have an account?' : "Don't have an account?"}{' '}
            <button onClick={()=>setIsRegister(!isRegister)} className="text-savings hover:underline font-semibold cursor-pointer">{isRegister ? 'Sign In' : 'Sign Up'}</button>
          </p>
        </div>
      </div>
    </div>
  );
}
