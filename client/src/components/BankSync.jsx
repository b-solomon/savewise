import React, { useState } from 'react';
import { 
  ShieldCheck, 
  Smartphone, 
  RefreshCw, 
  CheckCircle2, 
  ArrowRight, 
  Lock, 
  Building2, 
  Key, 
  Copy, 
  Check, 
  AlertCircle,
  Building,
  ArrowLeft
} from 'lucide-react';

const BANKS = [
  { id: 'hdfc', name: 'HDFC Bank', color: 'from-[#1c3f94] to-[#0a1c4b]', iconColor: 'text-blue-400' },
  { id: 'sbi', name: 'State Bank of India', color: 'from-[#008ecf] to-[#005180]', iconColor: 'text-cyan-400' },
  { id: 'icici', name: 'ICICI Bank', color: 'from-[#f58220] to-[#b3530c]', iconColor: 'text-orange-400' },
  { id: 'axis', name: 'Axis Bank', color: 'from-[#ae1c4f] to-[#6d0d2e]', iconColor: 'text-pink-500' },
  { id: 'kotak', name: 'Kotak Mahindra Bank', color: 'from-[#e61a22] to-[#990a0f]', iconColor: 'text-red-500' },
];

export default function BankSync({ token, phoneUrl, showToast, onSyncSuccess }) {
  const [selectedBank, setSelectedBank] = useState(null);
  const [syncStep, setSyncStep] = useState(0); // 0: Idle, 1: Mobile, 2: OTP, 3: Accounts, 4: Consent, 5: Success
  const [mobileNumber, setMobileNumber] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [generatedOtp, setGeneratedOtp] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [connectedBanks, setConnectedBanks] = useState([]);

  // Generate a mock OTP
  const startLinking = (bank) => {
    setSelectedBank(bank);
    setSyncStep(1);
    setMobileNumber('');
    setOtpCode('');
  };

  const handleMobileSubmit = (e) => {
    e.preventDefault();
    if (mobileNumber.length !== 10) {
      showToast('Please enter a valid 10-digit mobile number', 'error');
      return;
    }
    setIsLoading(true);
    setTimeout(() => {
      const code = Math.floor(1000 + Math.random() * 9000).toString();
      setGeneratedOtp(code);
      setSyncStep(2);
      setIsLoading(false);
      showToast(`Simulated OTP sent to +91 ${mobileNumber}`, 'success');
    }, 1200);
  };

  const handleOtpSubmit = (e) => {
    e.preventDefault();
    if (otpCode !== generatedOtp && otpCode !== '1234') {
      showToast('Invalid OTP. Use the code shown on the screen or 1234', 'error');
      return;
    }
    setIsLoading(true);
    setTimeout(() => {
      setSyncStep(3);
      setIsLoading(false);
    }, 1000);
  };

  const handleConfirmAccounts = () => {
    setSyncStep(4);
  };

  const handleConfirmConsent = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/sync/simulate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ bank: selectedBank.name })
      });
      const data = await res.json();
      setIsLoading(false);
      if (res.ok) {
        setSyncStep(5);
        setConnectedBanks([...connectedBanks, selectedBank.id]);
        showToast(`Connected to ${selectedBank.name} successfully!`, 'success');
        if (onSyncSuccess) onSyncSuccess();
      } else {
        showToast(data.error || 'Linking failed', 'error');
      }
    } catch (err) {
      setIsLoading(false);
      showToast('Connection to server failed', 'error');
    }
  };

  const resetWizard = () => {
    setSelectedBank(null);
    setSyncStep(0);
  };

  const copyToken = () => {
    navigator.clipboard.writeText(token);
    setCopied(true);
    showToast('Sync Token copied to clipboard!', 'success');
    setTimeout(() => setCopied(false), 2000);
  };

  const baseSyncUrl = phoneUrl || window.location.origin;
  const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(
    JSON.stringify({ url: baseSyncUrl, token })
  )}`;

  return (
    <div className="space-y-8 pb-12">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-extrabold text-white tracking-tight flex items-center gap-3">
          <RefreshCw className="h-8 w-8 text-emerald-400 animate-spin-slow" />
          Auto-Sync Hub
        </h1>
        <p className="mt-2 text-slate-400 text-sm max-w-xl">
          Connect your accounts securely via RBI Account Aggregator or set up your phone to push transaction notifications automatically.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left Column: Account Aggregator Link */}
        <div className="lg:col-span-2 space-y-6">
          <div className="glass-panel p-6 space-y-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <ShieldCheck className="h-6 w-6 text-emerald-400" />
                <h2 className="text-xl font-bold text-white">RBI Account Aggregator Sync</h2>
              </div>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                Official RBI Framework
              </span>
            </div>

            {syncStep === 0 ? (
              <div className="space-y-6">
                <p className="text-slate-300 text-sm leading-relaxed">
                  Consent to link your banks through the secure Account Aggregator (AA) network. 
                  SaveWise will fetch real-time transaction history automatically.
                </p>

                {/* Connected status */}
                {connectedBanks.length > 0 && (
                  <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-4 flex items-center gap-3">
                    <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0" />
                    <span className="text-sm text-emerald-200">
                      Connected banks: <strong>{connectedBanks.map(id => BANKS.find(b => b.id === id)?.name).join(', ')}</strong>. Transactions are auto-syncing.
                    </span>
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {BANKS.map((bank) => {
                    const isConnected = connectedBanks.includes(bank.id);
                    return (
                      <div 
                        key={bank.id}
                        className={`relative overflow-hidden rounded-xl border p-5 bg-gradient-to-br ${bank.color} ${
                          isConnected ? 'border-emerald-500/40 opacity-90' : 'border-white/5 hover:border-white/20 transition-all duration-300'
                        }`}
                      >
                        <div className="flex items-start justify-between">
                          <div>
                            <Building className="h-8 w-8 text-white/95 mb-2" />
                            <h3 className="font-bold text-white text-lg">{bank.name}</h3>
                          </div>
                          {isConnected && (
                            <span className="px-2 py-0.5 bg-emerald-500 text-white text-xs font-semibold rounded-full flex items-center gap-1">
                              <Check className="h-3 w-3" /> Active
                            </span>
                          )}
                        </div>
                        <button
                          onClick={() => startLinking(bank)}
                          className="mt-6 w-full py-2 rounded-lg bg-white/10 hover:bg-white/20 text-white text-sm font-semibold transition-colors flex items-center justify-center gap-2"
                        >
                          {isConnected ? 'Sync Again' : 'Connect Bank'} <ArrowRight className="h-4 w-4" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              // Linking Wizard Steps
              <div className="border border-white/5 bg-slate-900/40 rounded-2xl p-6 relative overflow-hidden">
                {/* Back button */}
                {syncStep < 5 && (
                  <button 
                    onClick={resetWizard}
                    className="absolute top-4 left-4 text-slate-400 hover:text-white flex items-center gap-1 text-xs"
                  >
                    <ArrowLeft className="h-4.5 w-4.5" /> Back
                  </button>
                )}

                <div className="max-w-md mx-auto py-4 text-center space-y-6">
                  {/* Icon & Title */}
                  <div className="inline-flex p-3 rounded-full bg-white/5 text-emerald-400">
                    <Building2 className="h-8 w-8" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-white">Linking with {selectedBank?.name}</h3>
                    <p className="text-slate-400 text-xs mt-1">Via Account Aggregator Network</p>
                  </div>

                  {/* Step 1: Mobile Input */}
                  {syncStep === 1 && (
                    <form onSubmit={handleMobileSubmit} className="space-y-4 text-left">
                      <div className="space-y-2">
                        <label className="text-xs font-semibold text-slate-300">Registered Mobile Number</label>
                        <div className="relative">
                          <span className="absolute left-3 top-2.5 text-slate-500 text-sm font-bold">+91</span>
                          <input 
                            type="tel"
                            placeholder="Enter 10-digit number"
                            maxLength={10}
                            value={mobileNumber}
                            onChange={(e) => setMobileNumber(e.target.value.replace(/\D/g, ''))}
                            className="glass-input pl-12 w-full text-white text-sm focus:outline-none"
                            required
                          />
                        </div>
                        <span className="text-[10px] text-slate-500 block">Must match the number registered with {selectedBank?.name}.</span>
                      </div>

                      <button
                        type="submit"
                        disabled={isLoading}
                        className="w-full py-3 bg-emerald-500 hover:bg-emerald-400 text-white font-bold rounded-xl transition-all shadow-lg shadow-emerald-500/20 text-sm flex items-center justify-center gap-2"
                      >
                        {isLoading ? (
                          <RefreshCw className="h-4 w-4 animate-spin" />
                        ) : (
                          <>Request Link OTP <ArrowRight className="h-4 w-4" /></>
                        )}
                      </button>
                    </form>
                  )}

                  {/* Step 2: OTP Verification */}
                  {syncStep === 2 && (
                    <form onSubmit={handleOtpSubmit} className="space-y-4 text-left">
                      <div className="bg-emerald-500/10 border border-emerald-500/20 p-3 rounded-xl flex items-center gap-2 mb-2">
                        <AlertCircle className="h-4 w-4 text-emerald-400 shrink-0" />
                        <span className="text-[11px] text-emerald-300">
                          Demo OTP: <strong className="text-white text-sm">{generatedOtp}</strong> (or enter 1234)
                        </span>
                      </div>

                      <div className="space-y-2">
                        <label className="text-xs font-semibold text-slate-300">Enter Verification Code</label>
                        <div className="relative">
                          <Key className="absolute left-3 top-3 text-slate-500 h-4.5 w-4.5" />
                          <input 
                            type="text"
                            placeholder="4-digit OTP"
                            maxLength={4}
                            value={otpCode}
                            onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
                            className="glass-input pl-10 text-center tracking-[1em] w-full text-white text-base font-bold focus:outline-none"
                            required
                          />
                        </div>
                      </div>

                      <button
                        type="submit"
                        disabled={isLoading}
                        className="w-full py-3 bg-emerald-500 hover:bg-emerald-400 text-white font-bold rounded-xl transition-all shadow-lg shadow-emerald-500/20 text-sm flex items-center justify-center gap-2"
                      >
                        {isLoading ? (
                          <RefreshCw className="h-4 w-4 animate-spin" />
                        ) : (
                          <>Verify OTP <ArrowRight className="h-4 w-4" /></>
                        )}
                      </button>
                    </form>
                  )}

                  {/* Step 3: Discover Accounts */}
                  {syncStep === 3 && (
                    <div className="space-y-4 text-left">
                      <div className="p-3 bg-slate-800/40 rounded-xl border border-white/5 space-y-2 text-xs">
                        <span className="text-slate-400 font-bold block mb-1">DISCOVERED ACCOUNTS:</span>
                        <div className="flex items-center justify-between p-2.5 bg-slate-900/60 rounded-lg border border-white/5">
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input type="checkbox" defaultChecked className="accent-emerald-500 h-4 w-4" />
                            <div>
                              <p className="text-white font-semibold">Savings A/c *******3924</p>
                              <p className="text-[10px] text-slate-500">{selectedBank?.name}</p>
                            </div>
                          </label>
                          <span className="font-bold text-slate-200 text-xs">₹1,24,500</span>
                        </div>
                        <div className="flex items-center justify-between p-2.5 bg-slate-900/60 rounded-lg border border-white/5">
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input type="checkbox" defaultChecked className="accent-emerald-500 h-4 w-4" />
                            <div>
                              <p className="text-white font-semibold">Credit Card *******8923</p>
                              <p className="text-[10px] text-slate-500">{selectedBank?.name}</p>
                            </div>
                          </label>
                          <span className="font-bold text-slate-200 text-xs">-₹12,450</span>
                        </div>
                      </div>

                      <button
                        onClick={handleConfirmAccounts}
                        className="w-full py-3 bg-emerald-500 hover:bg-emerald-400 text-white font-bold rounded-xl transition-all text-sm flex items-center justify-center gap-2"
                      >
                        Link Accounts <ArrowRight className="h-4 w-4" />
                      </button>
                    </div>
                  )}

                  {/* Step 4: Consent Form */}
                  {syncStep === 4 && (
                    <div className="space-y-4 text-left">
                      <div className="p-4 bg-slate-800/40 rounded-xl border border-white/5 text-[11px] leading-relaxed text-slate-300 space-y-2 max-h-56 overflow-y-auto">
                        <div className="flex items-center gap-1.5 text-emerald-400 font-bold mb-2">
                          <Lock className="h-3.5 w-3.5" /> RBI Consent Agreement
                        </div>
                        <p><strong>Consent Recipient:</strong> SaveWise Personal Finance</p>
                        <p><strong>Frequency of Fetch:</strong> Daily in background</p>
                        <p><strong>Data Duration:</strong> Last 12 months & future updates</p>
                        <p><strong>Consent Validity:</strong> 1 Year (Expires in 365 Days)</p>
                        <p className="border-t border-white/5 pt-2 text-slate-400">
                          By clicking Authorize, you grant secure authorization to pull transactions from the selected accounts. 
                          Your credentials are never stored. Data is encrypted end-to-end.
                        </p>
                      </div>

                      <button
                        onClick={handleConfirmConsent}
                        disabled={isLoading}
                        className="w-full py-3 bg-emerald-500 hover:bg-emerald-400 text-white font-bold rounded-xl transition-all shadow-lg shadow-emerald-500/20 text-sm flex items-center justify-center gap-2"
                      >
                        {isLoading ? (
                          <RefreshCw className="h-4 w-4 animate-spin" />
                        ) : (
                          <>Sign & Authorize Consent <ArrowRight className="h-4 w-4" /></>
                        )}
                      </button>
                    </div>
                  )}

                  {/* Step 5: Success */}
                  {syncStep === 5 && (
                    <div className="space-y-6">
                      <div className="inline-flex p-4 bg-emerald-500/20 text-emerald-400 rounded-full animate-bounce">
                        <CheckCircle2 className="h-10 w-10" />
                      </div>
                      <div>
                        <h4 className="text-xl font-bold text-white">Bank Connected Successfully!</h4>
                        <p className="text-slate-400 text-sm mt-2">
                          Historical bank statements have been retrieved and synced directly with your SaveWise ledger.
                        </p>
                      </div>
                      <button
                        onClick={resetWizard}
                        className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-xl transition-colors text-sm"
                      >
                        Done & Close
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Android SMS Sync Agent */}
        <div className="space-y-6">
          <div className="glass-panel p-6 space-y-6">
            <div className="flex items-center gap-3">
              <Smartphone className="h-6 w-6 text-emerald-400" />
              <h2 className="text-xl font-bold text-white">Android SMS Agent</h2>
            </div>
            
            <p className="text-slate-300 text-sm leading-relaxed">
              Automate transaction sync using a background SMS forwarder app. It reads bank transaction alerts on your mobile device and forwards them directly to your local SaveWise dashboard.
            </p>

            {/* QR Code Container */}
            <div className="flex flex-col items-center justify-center p-5 bg-white rounded-2xl border border-white/10 shadow-lg max-w-[200px] mx-auto">
              <img 
                src={qrCodeUrl}
                alt="Scan to Sync SaveWise"
                className="w-40 h-40 object-contain"
              />
              <span className="text-[9px] text-slate-500 font-semibold mt-2.5 uppercase tracking-wider">Scan in Mobile App</span>
            </div>

            {/* Token details */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-400">Your Unique Sync Token</label>
              <div className="flex gap-2">
                <input 
                  type="password"
                  value={token}
                  readOnly
                  className="glass-input flex-1 py-1.5 px-3 text-xs text-slate-300 select-all font-mono"
                />
                <button
                  onClick={copyToken}
                  className="px-3 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 text-emerald-400 hover:text-emerald-300 transition-colors flex items-center justify-center"
                  title="Copy Token"
                >
                  {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </button>
              </div>
              <span className="text-[10px] text-slate-500 leading-normal block">
                Do not share this token. It grants API access to push transactions to your account.
              </span>
            </div>

            {/* Steps list */}
            <div className="space-y-3 pt-2 text-xs border-t border-white/5">
              <h4 className="font-bold text-white uppercase text-[10px] tracking-wider text-slate-400">Setup Guide</h4>
              <ol className="list-decimal list-inside space-y-2 text-slate-300 pl-1">
                <li>Download any SMS forwarder or the custom SaveWise client on Android.</li>
                <li>Set the receiver URL to: <br /><code className="text-emerald-400 font-mono text-[10px] block py-1 bg-black/30 px-2 rounded mt-1 select-all">{baseSyncUrl}/api/transactions/parse-sms</code></li>
                <li>Add the HTTP Request Header:<br /><code className="text-emerald-400 font-mono text-[10px] block py-1 bg-black/30 px-2 rounded mt-1 select-all">Authorization: Bearer [Token]</code></li>
              </ol>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
