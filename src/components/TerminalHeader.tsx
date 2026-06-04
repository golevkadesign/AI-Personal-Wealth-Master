import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'motion/react';
import { Database, Cpu, Sparkles, Settings, LogOut, Globe } from 'lucide-react';
import { logout } from '../lib/firebase';
import { useTranslation } from '../hooks/useTranslation';
import { useWealthStore } from '../hooks/useWealthStore';

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
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const {
    data,
    publicHoldingAccountsSyncStatus,
    publicHoldingAccountsError,
    marketContextStatus,
    marketContextError,
  } = useWealthStore();

  const publicHoldingAccounts = data.publicHoldingAccounts || (data.distributions as any)?.publicHoldingAccounts || [];
  const dynamicWidgetCount = data.dynamicWidgets?.length || 0;

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsDropdownOpen(false);
      }
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  return (
    <header className="sticky top-0 z-40 bg-dash-bg/80 backdrop-blur-md border-b border-[#312B20] mb-6 md:mb-8 transition-colors">
      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 h-[72px] flex justify-between items-center">
        
        {/* Brand Area */}
        <div className="flex items-center gap-3 sm:gap-4 select-none shrink-0">
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

        {/* Mid-Status Area (xl devices only) —— 优雅融入 Header 单行内部 */}
        <div className="hidden xl:flex flex-1 items-center justify-center min-w-0 px-6">
          <div className="flex items-center gap-2.5 min-w-0 overflow-hidden text-[10.5px] font-mono select-none">
            {/* 1. 系统状态 */}
            <div className="flex items-center gap-1.5 shrink-0 border border-emerald-500/10 bg-emerald-500/[0.02] px-2 py-0.5 rounded-lg">
              <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
              <span className="text-[#8C8370] font-sans">正常运行</span>
            </div>

            {/* 2. 数据同步 */}
            <div className="flex items-center gap-1.5 shrink-0 border border-white/[0.04] bg-white/[0.01] px-2 py-0.5 rounded-lg">
              <span className={`w-1.5 h-1.5 rounded-full ${
                publicHoldingAccountsSyncStatus === 'loading' ? 'bg-amber-500 animate-spin' :
                publicHoldingAccountsSyncStatus === 'success' ? 'bg-emerald-500' :
                publicHoldingAccountsSyncStatus === 'error' ? 'bg-rose-500' : 'bg-zinc-500'
              }`} />
              <span className="text-[#8C8370] font-sans">
                {publicHoldingAccountsSyncStatus === 'loading' ? '同步中' :
                 publicHoldingAccountsSyncStatus === 'success' ? '已同步' :
                 publicHoldingAccountsSyncStatus === 'error' ? '同步异常' : '等待数据'}
              </span>
            </div>

            {/* 3. 持仓账户 */}
            <div className="flex items-center gap-1.5 shrink-0 border border-white/[0.04] bg-white/[0.01] px-2 py-0.5 rounded-lg">
              <span className={`w-1.5 h-1.5 rounded-full ${publicHoldingAccounts.length > 0 ? 'bg-amber-500' : 'bg-zinc-500'}`} />
              <span className="text-[#8C8370] font-sans">
                {publicHoldingAccounts.length > 0 ? `${publicHoldingAccounts.length} 账户` : '等待账户'}
              </span>
            </div>

            {/* 4. AI分析状态 */}
            <div className="flex items-center gap-1.5 shrink-0 border border-white/[0.04] bg-white/[0.01] px-2 py-0.5 rounded-lg">
              <span className={`w-1.5 h-1.5 rounded-full ${dynamicWidgetCount > 0 ? 'bg-[#C9B284]' : 'bg-zinc-500'}`} />
              <span className="text-[#8C8370] font-sans">
                {dynamicWidgetCount > 0 ? `AI 洞察 ${dynamicWidgetCount}` : 'AI 空闲'}
              </span>
            </div>

            {/* 5. 市场环境 */}
            <div className="flex items-center gap-1.5 shrink-0 border border-white/[0.04] bg-white/[0.01] px-2 py-0.5 rounded-lg min-w-0" title={
              marketContextStatus === 'error' && marketContextError ? marketContextError : 
              data.marketContext ? `${data.marketContext.freshness} · Stooq delayed` : '市场环境状态'
            }>
              <span className={`w-1.5 h-1.5 rounded-full ${
                marketContextStatus === 'loading' ? 'bg-amber-500 animate-pulse' :
                marketContextStatus === 'error' ? 'bg-rose-500' :
                data.marketContext ? (
                  data.marketContext.regime?.riskMode === 'risk_on' ? 'bg-emerald-500' :
                  data.marketContext.regime?.riskMode === 'risk_off' ? 'bg-amber-500' :
                  'bg-[#C9B284]'
                ) : 'bg-zinc-500'
              }`} />
              <span className="text-[#8C8370] font-sans truncate max-w-[124px]">
                {marketContextStatus === 'loading' ? '市场刷新中' :
                 marketContextStatus === 'error' ? '市场异常' :
                 data.marketContext ? (
                   data.marketContext.regime?.riskMode === 'risk_on' ? 'Risk-on' :
                   data.marketContext.regime?.riskMode === 'risk_off' ? 'Risk-off' :
                   data.marketContext.regime?.riskMode === 'neutral' ? 'Neutral' : 'Neutral'
                 ) : '市场待刷新'}
              </span>
            </div>
          </div>
        </div>
        
        {/* Actions Area */}
        <div className="flex items-center gap-2 sm:gap-3 lg:gap-4">
          
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

          <div className="h-6 w-px bg-dash-subtle/50 mx-0.5"></div>

          {/* Avatar dropdown trigger & menu */}
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
              className="w-10 h-10 rounded-xl bg-dash-surface-hover border border-[#C9B284]/30 hover:border-[#C9B284] flex items-center justify-center overflow-hidden shrink-0 shadow-sm transition-all ml-1 duration-300 cursor-pointer focus:outline-none"
              title={user.displayName || "User Account Menu"}
              aria-label="Toggle account menu"
            >
              <img src={user.photoURL} alt="User Avatar" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
            </button>

            {isDropdownOpen && (
              <div 
                className="absolute right-0 mt-3 w-64 bg-[#0B0F19]/95 border border-[#C9B284]/20 rounded-xl shadow-[0_20px_50px_rgba(0,0,0,0.8)] overflow-hidden z-50 text-sans font-normal backdrop-blur-md animate-in fade-in slide-in-from-top-3 duration-200"
              >
                {/* User info info cards */}
                <div className="p-4 border-b border-[#C9B284]/10 bg-black/30 flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg border border-[#C9B284]/30 flex items-center justify-center overflow-hidden shrink-0 shadow-sm">
                    <img src={user.photoURL} alt="User Avatar Mini" className="w-full h-full object-cover animate-fade-in" referrerPolicy="no-referrer" />
                  </div>
                  <div className="flex flex-col min-w-0">
                    <div className="text-[12.5px] font-bold text-white truncate pr-1">
                      {user.displayName || "Alex H."}
                    </div>
                    <div className="text-[10px] font-mono text-[#8C8370] truncate leading-tight mt-0.5">
                      {user.email || "user@example.com"}
                    </div>
                  </div>
                </div>

                {/* Dropdown Menu List Items */}
                <div className="p-1.5 space-y-1">
                  {/* Memory Profile Toggle Option */}
                  <button
                    onClick={() => {
                      setIsDropdownOpen(false);
                      setShowProfileReport(true);
                    }}
                    className="w-full flex items-center gap-2.5 px-3.5 py-2.5 rounded-lg text-left text-[12.5px] text-[#8C8370] hover:bg-[#C9B284]/10 hover:text-[#E7D7B0] transition-all cursor-pointer"
                  >
                    <Database className="w-4 h-4 text-[#8C8370]" />
                    <span>{t('nav.memoryProfile') || '长线记忆 / Memory'}</span>
                  </button>

                  {/* Developer View Toggle Option */}
                  <button
                    onClick={() => {
                      setIsDropdownOpen(false);
                      setShowDeveloperView(true);
                    }}
                    className="w-full flex items-center gap-2.5 px-3.5 py-2.5 rounded-lg text-left text-[12.5px] text-[#8C8370] hover:bg-[#C9B284]/10 hover:text-[#E7D7B0] transition-all cursor-pointer"
                  >
                    <Cpu className="w-4 h-4 text-[#8C8370]" />
                    <span>{t('nav.developer') || '开发者视图 / Developer'}</span>
                  </button>

                  {/* Toggle Interface Language Option */}
                  <button
                    onClick={() => {
                      setLanguage(language === 'zh-CN' ? 'en-US' : 'zh-CN');
                    }}
                    className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-lg text-left text-[12.5px] text-[#8C8370] hover:bg-[#C9B284]/10 hover:text-[#E7D7B0] transition-all cursor-pointer"
                  >
                    <div className="flex items-center gap-2.5">
                      <Globe className="w-4 h-4 text-[#8C8370]" />
                      <span>{language === 'zh-CN' ? '切换语言 / Language' : 'Language / 切换语言'}</span>
                    </div>
                    <span className="text-[10px] font-mono font-bold bg-[#C9B284]/10 border border-[#C9B284]/20 text-[#C9B284] px-1.5 py-0.5 rounded uppercase leading-none text-center">
                      {language === 'zh-CN' ? 'EN' : '中'}
                    </span>
                  </button>

                  {/* Settings Modal Toggle Option */}
                  <button
                    onClick={() => {
                      setIsDropdownOpen(false);
                      setShowSettingsModal(true);
                    }}
                    className="w-full flex items-center gap-2.5 px-3.5 py-2.5 rounded-lg text-left text-[12.5px] text-[#8C8370] hover:bg-[#C9B284]/10 hover:text-[#E7D7B0] transition-all cursor-pointer"
                  >
                    <Settings className="w-4 h-4 text-[#8C8370]" />
                    <span>{t('nav.settings') || '设置 / Settings'}</span>
                  </button>

                  <div className="h-px bg-[#C9B284]/10 my-1 mx-2" />

                  {/* Ultimate Logout Option */}
                  <button
                    onClick={() => {
                      setIsDropdownOpen(false);
                      logout();
                    }}
                    className="w-full flex items-center gap-2.5 px-3.5 py-2.5 rounded-lg text-left text-[12.5px] text-[#8C8370] hover:bg-rose-500/10 hover:text-rose-400 transition-all cursor-pointer"
                  >
                    <LogOut className="w-4 h-4 text-red-500/60" />
                    <span>{language === 'zh-CN' ? '退出登录' : 'Logout'}</span>
                  </button>

                </div>
              </div>
            )}
          </div>

        </div>
      </div>
    </header>
  );
}
