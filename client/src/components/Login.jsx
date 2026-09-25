import { useState } from 'react';
import { Wallet, Mail, Lock, User, ShieldCheck, Eye, EyeOff, Check, X, AlertCircle } from 'lucide-react';

export default function Login({ onLoginSuccess }) {
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Real-time Password Strength Evaluation Rules
  const criteria = {
    hasMinLength: password.length >= 8,
    hasUpper: /[A-Z]/.test(password),
    hasLower: /[a-z]/.test(password),
    hasDigit: /[0-9]/.test(password),
    hasSpecial: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password),
  };

  const metCount = Object.values(criteria).filter(Boolean).length;
  const isPasswordValid = metCount === 5;

  let strengthLabel = 'Weak';
  let strengthColor = 'bg-expense'; // Red (#ef4444)
  let badgeClass = 'text-expense bg-expense/10 border-expense/20';
  let strengthPercent = 20;

  if (!password) {
    strengthLabel = '';
    strengthPercent = 0;
  } else if (!criteria.hasMinLength || metCount <= 2) {
    strengthLabel = 'Weak';
    strengthColor = 'bg-expense';
    badgeClass = 'text-expense bg-expense/10 border-expense/20';
    strengthPercent = Math.min(metCount * 15, 30);
  } else if (metCount === 3 || metCount === 4) {
    strengthLabel = 'Normal';
    strengthColor = 'bg-warning';
    badgeClass = 'text-warning bg-warning/10 border-warning/20';
    strengthPercent = 65;
  } else if (isPasswordValid && password.length < 12) {
    strengthLabel = 'Strong';
    strengthColor = 'bg-savings';
    badgeClass = 'text-savings bg-savings/10 border-savings/20';
    strengthPercent = 85;
  } else if (isPasswordValid && password.length >= 12) {
    strengthLabel = 'Very Strong';
    strengthColor = 'bg-emerald-400';
    badgeClass = 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20';
    strengthPercent = 100;
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    // Senior Dev Client-Side Validation Guard for Registration
    if (isRegister && !isPasswordValid) {
      setError('Password is too weak! Please fulfill all security criteria below.');
      return;
    }

    setLoading(true);
    try {
      const ep = isRegister ? '/api/auth/register' : '/api/auth/login';
      const body = isRegister ? { email, password, name } : { email, password };
      const res = await fetch(ep, { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify(body) });
      
      let data = {};
      const ct = res.headers.get('content-type');
      if (ct && ct.includes('application/json')) {
        data = await res.json();
      } else {
        const txt = await res.text();
        throw new Error(txt.slice(0, 150) || 'Server returned an invalid non-JSON response');
      }
      
      if (!res.ok) throw new Error(data.error || 'Auth failed');
      onLoginSuccess(data.token, data.user);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
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
          {error && (
            <div className="mb-4 p-3 rounded-xl bg-expense/10 border border-expense/20 text-expense text-xs flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {isRegister && (
              <div className="relative">
                <User className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
                <input
                  type="text"
                  required
                  placeholder="Full Name"
                  value={name}
                  onChange={e=>setName(e.target.value)}
                  className="w-full pl-11 pr-4 py-3 rounded-xl glass-input text-sm text-white placeholder:text-gray-500"
                />
              </div>
            )}

            <div className="relative">
              <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
              <input
                type="email"
                required
                placeholder="Email address"
                value={email}
                onChange={e=>setEmail(e.target.value)}
                className="w-full pl-11 pr-4 py-3 rounded-xl glass-input text-sm text-white placeholder:text-gray-500"
              />
            </div>

            <div className="relative">
              <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
              <input
                type={showPassword ? 'text' : 'password'}
                required
                placeholder="Password"
                value={password}
                onChange={e=>setPassword(e.target.value)}
                className="w-full pl-11 pr-11 py-3 rounded-xl glass-input text-sm text-white placeholder:text-gray-500"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 cursor-pointer"
                title={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>

            {/* Registration Password Strength & Complexity UI */}
            {isRegister && (
              <div className="p-3.5 rounded-2xl bg-white/[0.03] border border-white/5 space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-400 font-medium">Password Strength:</span>
                  {strengthLabel ? (
                    <span className={`px-2 py-0.5 rounded-md font-semibold text-[10px] uppercase border ${badgeClass}`}>
                      {strengthLabel}
                    </span>
                  ) : (
                    <span className="text-gray-500 text-[11px]">Enter password</span>
                  )}
                </div>

                {/* Strength Meter Bar */}
                <div className="w-full h-1.5 bg-gray-800 rounded-full overflow-hidden">
                  <div
                    className={`h-full transition-all duration-300 ${strengthColor}`}
                    style={{ width: `${strengthPercent}%` }}
                  />
                </div>

                {/* Dynamic Criteria Requirements Checklist */}
                <div className="grid grid-cols-1 gap-1.5 pt-1 text-[11px]">
                  <CheckItem met={criteria.hasMinLength} label="At least 8 characters long" />
                  <CheckItem met={criteria.hasUpper} label="At least 1 uppercase letter (A-Z)" />
                  <CheckItem met={criteria.hasLower} label="At least 1 lowercase letter (a-z)" />
                  <CheckItem met={criteria.hasDigit} label="At least 1 numerical digit (0-9)" />
                  <CheckItem met={criteria.hasSpecial} label="At least 1 special character (!@#$%^&*...)" />
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={loading || (isRegister && !isPasswordValid)}
              className="w-full py-3.5 rounded-xl bg-gradient-to-r from-savings to-emerald-400 text-white font-semibold text-sm hover:opacity-95 transition disabled:opacity-40 disabled:cursor-not-allowed shadow-lg shadow-savings/15 cursor-pointer mt-2"
            >
              {loading ? 'Processing...' : isRegister ? 'Create Account' : 'Sign In'}
            </button>
          </form>

          <div className="flex items-center justify-center gap-2 mt-5 text-[10px] text-gray-500">
            <ShieldCheck className="h-3.5 w-3.5 text-savings" /> AES-256 encrypted • Zero-knowledge security
          </div>

          <p className="mt-4 text-center text-xs text-gray-400">
            {isRegister ? 'Already have an account?' : "Don't have an account?"}{' '}
            <button
              onClick={() => {
                setIsRegister(!isRegister);
                setError('');
              }}
              className="text-savings hover:underline font-semibold cursor-pointer"
            >
              {isRegister ? 'Sign In' : 'Sign Up'}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}

function CheckItem({ met, label }) {
  return (
    <div className={`flex items-center gap-2 transition-colors ${met ? 'text-savings font-medium' : 'text-gray-500'}`}>
      {met ? <Check className="h-3.5 w-3.5 shrink-0 text-savings" /> : <X className="h-3.5 w-3.5 shrink-0 text-gray-600" />}
      <span>{label}</span>
    </div>
  );
}
