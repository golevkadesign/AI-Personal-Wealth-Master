import React from 'react';
import { motion } from 'motion/react';
import { Shield, Lock, EyeOff, LockKeyhole } from 'lucide-react';
import { loginWithGoogle } from '../lib/firebase';
import { useTranslation } from '../hooks/useTranslation';

const ArbitraLogo = ({ className = "w-24 h-24" }: { className?: string }) => (
  <svg viewBox="0 0 100 100" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M50 12 L84 82 H69 L50 43 L31 82 H16 L50 12 Z" fill="url(#arbitraGold)" />
    <path d="M50 48 L52.5 54.5 L59 57 L52.5 59.5 L50 66 L47.5 59.5 L41 57 L47.5 54.5 L50 48 Z" fill="#FFF2D4" className="animate-pulse" />
    <defs>
      <linearGradient id="arbitraGold" x1="16" y1="12" x2="84" y2="82" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stopColor="#E7D7B0" />
        <stop offset="60%" stopColor="#C9B284" />
        <stop offset="100%" stopColor="#8C8370" />
      </linearGradient>
    </defs>
  </svg>
);

const SecurityBadge = ({ icon: Icon, text }: { icon: any, text: string }) => (
  <div className="flex items-center gap-1.5 px-3 py-1 text-[#8C8370] rounded-lg border border-[#C9B284]/15 bg-black/40 text-[10px] font-mono tracking-wider uppercase">
    <Icon className="w-3 h-3 text-[#C9B284]" />
    {text}
  </div>
);

const TerminalFrame = ({ children }: { children: React.ReactNode }) => {
  return (
    <div className="relative min-h-screen flex items-center justify-center bg-[#090a0c] text-neutral-100 overflow-hidden select-none">
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-[#C9B284]/5 rounded-full blur-[120px] pointer-events-none" />
      <div 
        className="absolute inset-0 pointer-events-none opacity-10" 
        style={{
          backgroundImage: `
            radial-gradient(circle at 1px 1px, #C9B284 1.2px, transparent 0),
            linear-gradient(to right, rgba(201,178,132,0.1) 1px, transparent 1px),
            linear-gradient(to bottom, rgba(201,178,132,0.1) 1px, transparent 1px)
          `,
          backgroundSize: '32px 32px, 8px 8px, 8px 8px',
          backgroundPosition: 'center center'
        }}
      />
      
      <div className="absolute top-8 left-8 text-[#C9B284]/30 font-mono text-[9px] tracking-widest hidden sm:block">
        SYS.LOC_01 // SECURE_SHELL
      </div>
      <div className="absolute top-8 right-8 text-[#C9B284]/30 font-mono text-[9px] tracking-widest hidden sm:block">
        PORT_3000 // ARBITRA_V2.5
      </div>
      <div className="absolute bottom-8 left-8 text-[#C9B284]/30 font-mono text-[9px] tracking-widest hidden sm:block">
        INTEL_ENGINE // CLOUD_SECURE
      </div>
      <div className="absolute bottom-8 right-8 text-[#C9B284]/30 font-mono text-[9px] tracking-widest hidden sm:block">
        INITIALIZATION_COMPLETE
      </div>

      {children}
    </div>
  );
};

interface AuthTerminalLayoutProps {
  loadingAuth: boolean;
}

export const AuthTerminalLayout: React.FC<AuthTerminalLayoutProps> = ({ loadingAuth }) => {
  const { t } = useTranslation();

  if (loadingAuth) {
    return (
      <TerminalFrame>
        <motion.div 
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="bg-[#0e1115]/90 border border-[#C9B284]/20 rounded-[28px] p-8 sm:p-10 max-w-sm w-full flex flex-col items-center text-center shadow-[0_24px_64px_rgba(0,0,0,0.8),inset_0_1px_0_rgba(201,178,132,0.15)] backdrop-blur-xl relative"
        >
          {/* Top corner alignment marks */}
          <div className="absolute top-4 left-4 w-2.5 h-2.5 border-t border-l border-[#C9B284]/30" />
          <div className="absolute top-4 right-4 w-2.5 h-2.5 border-t border-r border-[#C9B284]/30" />
          <div className="absolute bottom-4 left-4 w-2.5 h-2.5 border-b border-l border-[#C9B284]/30" />
          <div className="absolute bottom-4 right-4 w-2.5 h-2.5 border-b border-r border-[#C9B284]/30" />

          {/* Crosshair with Arbitra Logo */}
          <div className="relative w-40 h-40 flex items-center justify-center mb-6">
            {/* HUD Circles */}
            <div className="absolute inset-0 border border-[#C9B284]/10 rounded-full animate-[spin_12s_linear_infinite]" />
            <div className="absolute inset-3 border border-dashed border-[#C9B284]/15 rounded-full animate-[spin_24s_linear_infinite_reverse]" />
            {/* Target Cross Lines */}
            <div className="absolute w-[115%] h-[1px] bg-gradient-to-r from-transparent via-[#C9B284]/20 to-transparent" />
            <div className="absolute h-[115%] w-[1px] bg-gradient-to-b from-transparent via-[#C9B284]/20 to-transparent" />
            
            {/* Corner diamond dots */}
            <div className="absolute -top-1 w-1 h-1 bg-[#C9B284]" />
            <div className="absolute -bottom-1 w-1 h-1 bg-[#C9B284]" />
            <div className="absolute -left-1 w-1 h-1 bg-[#C9B284]" />
            <div className="absolute -right-1 w-1 h-1 bg-[#C9B284]" />

            <ArbitraLogo className="w-20 h-20 relative z-10" />
          </div>

          {/* Indeterminate linear progress bar */}
          <div className="w-full relative mb-6">
            <div className="h-[2px] w-full bg-[#12161b] rounded-full overflow-hidden border border-neutral-800/20">
              <motion.div 
                animate={{ 
                  x: ["-100%", "100%"]
                }}
                transition={{ 
                  repeat: Infinity, 
                  duration: 1.8, 
                  ease: "easeInOut" 
                }}
                className="h-full w-1/3 bg-gradient-to-r from-transparent via-[#C9B284] to-transparent rounded-full shadow-[0_0_8px_#C9B284]"
              />
            </div>
            <div className="flex justify-end mt-1.5">
               <span className="text-[9px] font-mono text-[#C9B284]/50 tracking-wider">SECURE LINK STATUS: SYNCING...</span>
            </div>
          </div>

          <h2 className="text-[17px] font-serif tracking-wide text-[#E7D7B0] mb-2 font-medium">
            {t('auth.authenticating')}
          </h2>
          <p className="text-xs text-[#8C8370] font-sans tracking-wide mb-8">
            Syncing encrypted profile and workspace
          </p>

          {/* Tiny bottom badges */}
          <div className="flex justify-center flex-wrap gap-2.5 w-full">
            <SecurityBadge icon={Shield} text="Encrypted" />
            <SecurityBadge icon={Lock} text="Secure" />
            <SecurityBadge icon={EyeOff} text="Private" />
          </div>
        </motion.div>

        {/* Outer label footer */}
        <div className="absolute bottom-10 left-12 right-12 flex justify-center">
          <p className="text-[10px] font-mono tracking-[0.3em] text-[#C9B284]/40 uppercase">
            &gt; ARBITRA TERMINAL BOOT SEQUENCE &lt;
          </p>
        </div>
      </TerminalFrame>
    );
  }

  return (
    <TerminalFrame>
      <motion.div 
        initial={{ opacity: 0, y: 15, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
        className="bg-[#0e1115]/90 border border-[#C9B284]/20 rounded-[32px] p-8 sm:p-12 max-w-md w-full text-center shadow-[0_32px_80px_rgba(0,0,0,0.9),inset_0_1px_0_rgba(201,178,132,0.15)] backdrop-blur-xl relative overflow-hidden"
      >
        {/* Grid visual overlay inside card for wealth terminal vibe */}
        <div className="absolute inset-0 opacity-[0.02] pointer-events-none" 
          style={{
            backgroundImage: 'linear-gradient(rgba(201,178,132,0.15) 1px, transparent 1px), linear-gradient(90deg, rgba(201,178,132,0.15) 1px, transparent 1px)',
            backgroundSize: '16px 16px'
          }}
        />

        {/* Top subtle glow */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-[1px] bg-gradient-to-r from-transparent via-[#C9B284]/40 to-transparent" />

        {/* Content */}
        <div className="relative z-10 flex flex-col items-center">
          {/* Brand Logo Mark */}
          <div className="mb-6 transform hover:scale-105 transition-transform duration-500">
            <ArbitraLogo className="w-20 h-20" />
          </div>

          {/* Programmatic display font style header */}
          <h1 className="text-3xl font-serif text-[#E7D7B0] font-medium tracking-wide mb-2 selection:bg-[#C9B284]/30">
            Arbitra Terminal
          </h1>

          {/* Subtitle uppercase tracking */}
          <p className="text-[#8C8370] text-[10px] tracking-[0.22em] uppercase font-mono font-semibold mb-6">
            Secure Authentication Required
          </p>

          {/* Decorative Diamond Ornament separator */}
          <div className="flex items-center gap-3 w-32 justify-center mb-8">
            <div className="h-[1px] flex-1 bg-gradient-to-r from-transparent to-[#C9B284]/30" />
            <div className="w-1.5 h-1.5 rotate-45 border border-[#C9B284] bg-transparent" />
            <div className="h-[1px] flex-1 bg-gradient-to-l from-transparent to-[#C9B284]/30" />
          </div>

          {/* Trust Copy */}
          <p className="text-neutral-300 text-[13.5px] font-sans antialiased text-center tracking-wide mb-9 leading-relaxed max-w-[280px]">
            Private wealth intelligence workspace.
          </p>

          {/* Google Authentication Button */}
          <motion.button 
            whileHover={{ scale: 1.015, translateY: -1 }}
            whileTap={{ scale: 0.985 }}
            onClick={loginWithGoogle}
            className="w-full py-4 px-6 bg-[#F5F5F7] hover:bg-white text-[#1D1D1F] rounded-[20px] font-mono text-[13px] tracking-wide font-bold flex items-center justify-center gap-3.5 transition-all shadow-[0_4px_20px_rgba(0,0,0,0.5),0_1px_2px_rgba(255,255,255,0.7)_inset] border border-transparent"
          >
            {/* Google high fidelity brand icon */}
            <svg className="w-5 h-5 flex-shrink-0" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.1c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.08H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.92l2.85-2.22.81-.6z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.08l3.66 2.84c.87-2.6 3.3-4.54 6.16-4.54z" fill="#EA4335"/>
            </svg>
            {t('auth.signIn')}
          </motion.button>

          {/* Separator boundary */}
          <div className="flex items-center gap-3 w-32 justify-center mt-9 mb-7">
            <div className="h-[1px] flex-1 bg-gradient-to-r from-transparent to-[#C9B284]/20" />
            <div className="w-1 h-1 rotate-45 bg-[#C9B284]/40" />
            <div className="h-[1px] flex-1 bg-gradient-to-l from-transparent to-[#C9B284]/20" />
          </div>

          {/* Bottom microcopy with locking emblem */}
          <div className="flex items-start gap-3 text-left max-w-[280px]">
            <div className="w-8 h-8 rounded-full border border-[#C9B284]/15 bg-black/30 flex items-center justify-center flex-shrink-0 text-[#C9B284]/80 mt-0.5 shadow-inner">
              <LockKeyhole className="w-3.5 h-3.5" />
            </div>
            <p className="text-[11px] leading-relaxed font-sans text-[#8C8370]/95 antialiased">
              Your profile and workspace stay encrypted and private.
            </p>
          </div>
        </div>
      </motion.div>
    </TerminalFrame>
  );
};
