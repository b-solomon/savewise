import { useState, useEffect } from 'react';

export default function HumanVerification({ onVerify, verified }) {
  const [status, setStatus] = useState('idle'); // 'idle' | 'verifying' | 'success'

  useEffect(() => {
    if (verified) {
      setStatus('success');
    }
  }, [verified]);

  const handleInteract = () => {
    if (status !== 'idle') return;
    setStatus('verifying');
    // Fast, realistic verification delay
    setTimeout(() => {
      setStatus('success');
      if (onVerify) onVerify(true);
    }, 750);
  };

  return (
    <div className="w-full my-3">
      <div 
        onClick={handleInteract}
        className={`w-full max-w-sm mx-auto bg-[#1b1c21] border border-[#333742] rounded-lg p-3.5 flex items-center justify-between select-none transition-all duration-200 ${status === 'idle' ? 'cursor-pointer hover:border-[#4f5565] hover:bg-[#20222a]' : 'cursor-default'}`}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => { if (e.key === ' ' || e.key === 'Enter') handleInteract(); }}
      >
        {/* Left Side: Status / Checkbox */}
        <div className="flex items-center gap-3">
          {status === 'idle' && (
            <>
              <div className="w-6 h-6 rounded border-2 border-gray-400 bg-[#282a36] flex items-center justify-center transition-colors hover:border-gray-300">
                <div className="w-2.5 h-2.5 rounded-sm bg-transparent" />
              </div>
              <span className="text-xs text-gray-200 font-medium tracking-wide">
                Verify you are human
              </span>
            </>
          )}

          {status === 'verifying' && (
            <>
              <div className="w-6 h-6 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin shrink-0" />
              <span className="text-xs text-gray-300 font-medium tracking-wide">
                Verifying...
              </span>
            </>
          )}

          {status === 'success' && (
            <>
              <div className="w-7 h-7 rounded-full bg-[#10b981] flex items-center justify-center text-white shrink-0 shadow-[0_0_12px_rgba(16,185,129,0.35)] animate-fade-in">
                <svg className="w-4 h-4 stroke-white stroke-[3] fill-none" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <span className="text-sm text-gray-100 font-semibold tracking-wide">
                Success!
              </span>
            </>
          )}
        </div>

        {/* Right Side: Cloudflare Branding (exact logo match) */}
        <div className="flex flex-col items-end shrink-0 pl-3">
          <div className="flex items-center gap-1.5">
            <svg className="w-7 h-4.5" viewBox="0 0 100 45" fill="none">
              {/* Cloudflare cloud icon */}
              <path
                d="M78.5 25.4c-.8-6.1-5.9-10.8-12.1-10.8-3.1 0-6 1.2-8.1 3.2C56.1 11.2 49 6.5 40.7 6.5c-11.2 0-20.5 8.4-21.7 19.3-5.5.9-9.7 5.7-9.7 11.4 0 6.4 5.2 11.6 11.6 11.6h57.6c5.9 0 10.7-4.8 10.7-10.7 0-5.4-4-9.8-9.3-10.6z"
                fill="#F38020"
              />
              <path
                d="M74.8 28.5c-.3-2.1-2-3.7-4.2-3.7-1.1 0-2.1.4-2.8 1.1-.8-2.3-3.1-3.9-5.7-3.9-3.7 0-6.7 2.8-7 6.4h19.7z"
                fill="#FAAD3F"
              />
            </svg>
            <span className="font-extrabold text-[10px] tracking-wider text-gray-200 uppercase font-sans">
              CLOUDFLARE
            </span>
          </div>
          <div className="flex items-center gap-1 text-[8.5px] text-gray-400 mt-0.5">
            <a 
              href="https://www.cloudflare.com/privacypolicy/" 
              target="_blank" 
              rel="noreferrer" 
              className="hover:text-gray-200 underline underline-offset-1"
              onClick={(e) => e.stopPropagation()}
            >
              Privacy
            </a>
            <span>•</span>
            <a 
              href="https://www.cloudflare.com/website-terms/" 
              target="_blank" 
              rel="noreferrer" 
              className="hover:text-gray-200 underline underline-offset-1"
              onClick={(e) => e.stopPropagation()}
            >
              Help
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
