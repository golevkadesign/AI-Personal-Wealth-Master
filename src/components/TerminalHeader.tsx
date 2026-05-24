import React from 'react';
import { motion } from 'motion/react';
import { Database, Cpu, Sparkles, Settings, LogOut, Languages } from 'lucide-react';
import { logout } from '../lib/firebase';
import { useTranslation } from '../hooks/useTranslation';

interface TerminalHeaderProps {
  user: any;
  setShowProfileReport: (show: boolean) => void;
  setShowDeveloperView: (show: boolean) => void;
  setDrawerOpen: (open: boolean) => void;
  setShowSettingsModal: (show: boolean) => void;
}

export function TerminalHeader({
  user,
  setShowProfileReport,
  setShowDeveloperView,
  setDrawerOpen,
  setShowSettingsModal
}: TerminalHeaderProps) {
  const { t, language, setLanguage } = useTranslation();

  return (
    <header className="sticky top-0 z-40 bg-dash-bg/80 backdrop-blur-md border-b border-[#312B20] mb-6 md:mb-8 transition-colors">
      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 h-[72px] flex justify-between items-center">
        
        {/* Brand Area */}
        <div className="flex items-center gap-3 sm:gap-4 select-none">
          <div className="bg-[#1C1F22] border border-dash-subtle shadow-inner w-10 h-10 rounded-xl flex items-center justify-center relative overflow-hidden group">
            <div className="absolute inset-0 bg-[#C9B284]/10 opacity-30 group-hover:opacity-50 transition-opacity"></div>
            {/* Elegant dark gold dot */}
            <div className="w-3.5 h-3.5 rounded-full bg-[#C9B284] shadow-[0_0_12px_rgba(201,178,132,0.6)]"></div>
          </div>
          <div className="flex flex-col justify-center">
            <h1 className="text-xl font-bold tracking-tight text-white leading-none font-sans">
              ARBITRA
            </h1>
            <span className="text-[10px] font-mono tracking-widest uppercase text-[#A39167] mt-1 font-semibold">
              Sovereign Operating System
            </span>
          </div>
        </div>
        
        {/* Actions Area */}
        <div className="flex items-center gap-2 sm:gap-3 lg:gap-4">
          
          <button
            onClick={() => setShowProfileReport(true)}
            className="hidden sm:inline-flex items-center gap-2 bg-[#1A1D1F] hover:bg-[#202326] text-dash-primary border border-dash-subtle px-3 py-1.5 rounded-xl font-mono text-[11px] font-semibold tracking-wider transition-colors duration-200"
            title={t('nav.memoryProfile')}
            aria-label={t('nav.memoryProfile')}
          >
            <Database className="w-3.5 h-3.5 text-[#A39167]" />
            <span>{t('nav.memoryProfile')}</span>
          </button>

          <button
            onClick={() => setShowDeveloperView(true)}
            className="hidden sm:inline-flex items-center gap-2 bg-[#1A1D1F] hover:bg-[#202326] text-dash-primary border border-dash-subtle px-3 py-1.5 rounded-xl font-mono text-[11px] font-semibold tracking-wider transition-colors duration-200"
            title={t('nav.developer')}
            aria-label={t('nav.developer')}
          >
            <Cpu className="w-3.5 h-3.5 text-[#A39167]" />
            <span>{t('nav.developer')}</span>
          </button>

          {/* Sparkly Premium AI Button */}
          <motion.button 
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => setDrawerOpen(true)} 
            className="bg-[#C9B284] hover:bg-[#D4AF37] text-[#121415] hover:text-[#0c0d0e] flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-xs sm:text-sm shadow-lg transition-colors cursor-pointer"
            title="询问 Arbitra"
            aria-label="询问 Arbitra"
          >
            <Sparkles className="w-4 h-4 text-current shrink-0" />
            <span>询问 Arbitra</span>
          </motion.button>

          <div className="h-6 w-px bg-dash-subtle/80 mx-1"></div>

          <button
            onClick={() => setLanguage(language === 'zh-CN' ? 'en-US' : 'zh-CN')}
            className="text-dash-tertiary hover:text-[#C9B284] w-10 h-10 flex items-center justify-center rounded-xl hover:bg-[#1A1D1F]/60 transition-colors relative"
            title={language === 'zh-CN' ? 'Switch to English' : '切换到中文'}
            aria-label="Toggle Language"
          >
            <div className="absolute inset-0 m-auto w-6 h-6 border border-dash-subtle rounded flex items-center justify-center text-[10px] font-bold font-mono">
              {language === 'zh-CN' ? '中' : 'EN'}
            </div>
          </button>

          <button
            onClick={() => setShowSettingsModal(true)}
            className="text-dash-tertiary hover:text-[#C9B284] w-10 h-10 flex items-center justify-center rounded-xl hover:bg-[#1A1D1F]/60 transition-colors"
            title={t('nav.settings')}
            aria-label={t('nav.settings')}
          >
            <Settings className="w-4.5 h-4.5 text-current" />
          </button>

          <button
            onClick={logout}
            className="text-dash-tertiary hover:text-red-400 w-10 h-10 flex items-center justify-center rounded-xl hover:bg-[#1A1D1F]/60 transition-colors"
            title="退出登录"
            aria-label="退出登录"
          >
            <LogOut className="w-4.5 h-4.5 text-current" />
          </button>

          {/* Avatar frame with gold active boundary ring */}
          <div 
            className="w-10 h-10 rounded-xl bg-dash-surface-hover border border-[#C9B284]/30 flex items-center justify-center overflow-hidden shrink-0 shadow-sm hover:border-[#C9B284] transition-all ml-1 duration-300" 
            title={user.displayName} 
            aria-label="User Avatar"
          >
            <img src={user.photoURL} alt="User Avatar" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
          </div>

        </div>
      </div>
    </header>
  );
}
