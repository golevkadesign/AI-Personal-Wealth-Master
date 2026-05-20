import React from 'react';
import { motion } from 'motion/react';
import { Database, Cpu, Sparkles, Settings, LogOut } from 'lucide-react';
import { logout } from '../lib/firebase';

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
  return (
      <header className="sticky top-0 z-40 bg-[#0E1011]/90 backdrop-blur-md border-b border-dash-subtle mb-6 md:mb-8 transition-colors">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 h-[72px] flex justify-between items-center">
          
          {/* Brand Area */}
          <div className="flex items-center gap-4 cursor-default">
            {/* Dark Golden Sphere Icon Placeholder */}
            <div className="w-10 h-10 rounded-full flex items-center justify-center relative overflow-hidden group">
              <div className="absolute inset-0 rounded-full border border-dash-gold/40"></div>
              <div className="absolute w-[120%] h-[120%] rounded-full bg-[radial-gradient(circle,rgba(201,178,132,0.15)_0%,transparent_60%)]"></div>
              {/* Point Field simulation */}
              <div className="grid grid-cols-4 grid-rows-4 gap-0.5 opacity-60">
                 {Array.from({length: 16}).map((_, i) => (
                    <div key={i} className="w-[1.5px] h-[1.5px] bg-dash-gold rounded-full"></div>
                 ))}
              </div>
            </div>
            <div className="flex flex-col justify-center">
              <h1 className="text-[22px] font-serif tracking-wide text-dash-primary leading-tight">
                Arbitra
              </h1>
              <span className="text-[11px] font-sans text-dash-tertiary tracking-[0.1em] mt-0">Terminal</span>
            </div>
          </div>
          
          {/* Actions Area */}
          <div className="flex items-center gap-3">
            
            <button
              onClick={() => setShowProfileReport(true)}
              className="hidden lg:flex items-center gap-2.5 px-4 h-[42px] rounded-[10px] border border-dash-subtle bg-dash-surface-hover hover:bg-dash-hover transition-colors text-left group"
            >
              <Database className="w-4 h-4 text-dash-secondary group-hover:text-dash-primary" />
              <div className="flex flex-col leading-none">
                 <span className="text-[12px] font-medium text-dash-primary">长线记忆</span>
                 <span className="text-[9px] font-mono tracking-widest text-dash-tertiary uppercase mt-0.5">Memory</span>
              </div>
            </button>

            <button
              onClick={() => setShowDeveloperView(true)}
              className="hidden lg:flex items-center gap-2.5 px-4 h-[42px] rounded-[10px] border border-dash-subtle bg-dash-surface-hover hover:bg-dash-hover transition-colors text-left group"
            >
              <Cpu className="w-4 h-4 text-dash-secondary group-hover:text-dash-primary" />
              <div className="flex flex-col leading-none">
                 <span className="text-[12px] font-medium text-dash-primary">开发者</span>
                 <span className="text-[9px] font-mono tracking-widest text-dash-tertiary uppercase mt-0.5">Developer</span>
              </div>
            </button>

            <motion.button 
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setDrawerOpen(true)} 
              className="hidden md:flex items-center gap-2.5 px-4 h-[42px] rounded-[10px] bg-dash-gold/20 border border-dash-gold/40 hover:bg-dash-gold/30 transition-colors text-left"
            >
              <Sparkles className="w-4 h-4 text-dash-gold" />
              <div className="flex flex-col leading-none">
                 <span className="text-[12px] font-medium text-[#f0e6d2]">询问 Arbitra</span>
                 <span className="text-[9px] font-mono tracking-widest text-dash-gold uppercase mt-0.5">Ask Arbitra</span>
              </div>
            </motion.button>
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={() => setDrawerOpen(true)} 
              className="flex md:hidden items-center justify-center w-[42px] h-[42px] rounded-[10px] bg-dash-gold/20 border border-dash-gold/40 hover:bg-dash-gold/30 transition-colors"
            >
               <Sparkles className="w-[18px] h-[18px] text-dash-gold" />
            </motion.button>

            <div 
              className="w-[42px] h-[42px] rounded-full border border-dash-subtle overflow-hidden shrink-0 mx-1" 
              title={user.displayName} 
            >
              <img src={user.photoURL} alt="User Avatar" className="w-full h-full object-cover" />
            </div>

            <button
              onClick={() => setShowSettingsModal(true)}
              className="hidden md:flex items-center gap-2.5 px-4 h-[42px] rounded-[10px] border border-dash-subtle bg-dash-surface-hover hover:bg-dash-hover transition-colors text-left group"
            >
              <Settings className="w-4 h-4 text-dash-secondary group-hover:text-dash-primary" />
              <div className="flex flex-col leading-none">
                 <span className="text-[12px] font-medium text-dash-primary">设置</span>
                 <span className="text-[9px] font-mono tracking-widest text-dash-tertiary uppercase mt-0.5">Settings</span>
              </div>
            </button>

            <button
              onClick={logout}
              className="hidden sm:flex items-center gap-2.5 px-4 h-[42px] rounded-[10px] border border-dash-subtle bg-dash-surface-hover hover:bg-dash-hover hover:border-dash-danger/30 transition-colors text-left group"
            >
              <LogOut className="w-4 h-4 text-dash-secondary group-hover:text-dash-danger" />
              <div className="flex flex-col leading-none">
                 <span className="text-[12px] font-medium text-dash-primary group-hover:text-dash-danger">退出登录</span>
                 <span className="text-[9px] font-mono tracking-widest text-dash-tertiary group-hover:text-dash-danger/70 uppercase mt-0.5">LogOut</span>
              </div>
            </button>
            <button
              onClick={logout}
              className="flex sm:hidden items-center justify-center w-[42px] h-[42px] rounded-[10px] border border-dash-subtle bg-dash-surface-hover transition-colors"
            >
               <LogOut className="w-[18px] h-[18px] text-dash-secondary" />
            </button>

          </div>
        </div>
      </header>
  );
}
