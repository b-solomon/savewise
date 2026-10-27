import { useState, useEffect } from 'react';

export default function SiteLoader({ onComplete }) {
  const [percent, setPercent] = useState(0);

  useEffect(() => {
    const startTime = Date.now();
    const duration = 1200; // 1.2 seconds for realistic, snappy feel

    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(Math.floor((elapsed / duration) * 100), 100);
      setPercent(progress);

      if (progress >= 100) {
        clearInterval(interval);
        setTimeout(() => {
          if (onComplete) onComplete();
        }, 200);
      }
    }, 25);

    return () => clearInterval(interval);
  }, [onComplete]);

  const getStatusText = (p) => {
    if (p < 30) return 'INITIALIZING SYSTEM';
    if (p < 65) return 'ENCRYPTING CONNECTION';
    if (p < 95) return 'ALMOST THERE';
    return 'READY';
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#0d0d0d] text-white select-none">
      <div className="flex flex-col items-center">
        {/* Giant Bold Percentage Display */}
        <div className="text-[120px] sm:text-[160px] md:text-[200px] leading-none font-sans font-bold tracking-tight text-[#f4f4f0]">
          {percent}<span className="text-[75px] sm:text-[100px] md:text-[130px] font-medium ml-1">%</span>
        </div>

        {/* Thin Horizontal Progress Bar with Red Line */}
        <div className="w-[280px] sm:w-[380px] md:w-[460px] h-[2px] bg-[#222222] relative mt-2 mb-4 overflow-hidden rounded-full">
          <div
            className="absolute left-0 top-0 bottom-0 bg-[#e11d48] transition-all duration-75 ease-out shadow-[0_0_8px_rgba(225,29,72,0.8)]"
            style={{ width: `${percent}%` }}
          />
        </div>

        {/* Uppercase Monospace Status Text */}
        <p className="font-mono text-xs sm:text-sm tracking-[0.3em] text-[#8e8e8e] uppercase font-medium">
          {getStatusText(percent)}
        </p>
      </div>
    </div>
  );
}
