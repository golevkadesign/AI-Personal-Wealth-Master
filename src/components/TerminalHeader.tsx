import React from 'react';
import { motion } from 'motion/react';
import { Database, Cpu, Sparkles, User, Settings, LogOut } from 'lucide-react';
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
      <header className="sticky top-0 z-40 bg-surface/70 backdrop-blur-2xl border-b border-outline-variant/50 mb-6 md:mb-8 transition-all">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 h-16 md:h-20 flex justify-between items-center">
          <div className="flex items-center gap-3 sm:gap-4">
            <div className="bg-surface-container border border-outline shadow-inner w-10 h-10 sm:w-12 sm:h-12 rounded-[14px] flex items-center justify-center relative overflow-hidden transition-all hover:border-primary/50">
              <div className="absolute inset-0 bg-gradient-to-br from-primary/20 to-transparent opacity-20"></div>
              <div className="w-4 h-4 sm:w-5 sm:h-5 rounded-full bg-primary shadow-[0_0_12px_rgba(230,205,157,0.4)] animate-pulse"></div>
            </div>
            <div className="truncate flex flex-col justify-center">
              <h1 className="text-xl sm:text-2xl font-sans font-semibold tracking-tight text-on-surface leading-none">
                Arbitra <span className="text-primary font-mono opacity-80">Terminal</span>
              </h1>
            </div>
          </div>
          
          <div className="flex items-center gap-3 sm:gap-4 lg:gap-6">
            <button
              onClick={() => setShowProfileReport(true)}
              className="group flex items-center space-x-2 px-3 py-1.5 sm:px-4 sm:py-2 rounded-xl bg-surface-container-low border border-outline-variant text-on-surface-variant hover:text-primary hover:border-primary/50 transition-all font-mono text-[10px] sm:text-xs uppercase tracking-widest font-semibold shadow-sm"
              title="长线记忆 / Memory Profile"
            >
              <Database className="w-3.5 h-3.5 sm:w-4 sm:h-4 group-hover:animate-pulse" />
              <span className="hidden sm:inline">Memory</span>
            </button>

            <button
              onClick={() => setShowDeveloperView(true)}
              className="group flex items-center space-x-2 px-3 py-1.5 sm:px-4 sm:py-2 rounded-xl bg-surface-container-low border border-outline-variant text-on-surface-variant hover:text-primary hover:border-primary/50 transition-all font-mono text-[10px] sm:text-xs uppercase tracking-widest font-semibold shadow-sm"
              title="开发者视图 / Developer View"
            >
              <Cpu className="w-3.5 h-3.5 sm:w-4 sm:h-4 group-hover:rotate-12 transition-transform" />
              <span className="hidden sm:inline">Developer</span>
            </button>

            <motion.button 
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setDrawerOpen(true)} 
              className="hidden md:flex items-center gap-2 px-6 py-2.5 rounded-[12px] text-[13px] font-bold bg-primary text-on-primary hover:bg-primary-fixed hover:-translate-y-0.5 transition-all shadow-[0_4px_14px_0_rgba(230,205,157,0.2)]"
            >
              <Sparkles className="w-4 h-4" /> Initialize
            </motion.button>

            {/* Mobile simplified AI button */}
            <motion.button 
              whileTap={{ scale: 0.95 }}
              onClick={() => setDrawerOpen(true)} 
              className="flex md:hidden items-center justify-center w-10 h-10 rounded-[12px] bg-primary text-on-primary hover:bg-primary-fixed transition-all shadow-sm"
            >
              <Sparkles className="w-5 h-5" />
            </motion.button>

            <div className="h-6 md:h-8 w-px bg-outline-variant mx-1"></div>

            <div className="flex items-center gap-3 group relative cursor-pointer">
               <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-[12px] bg-surface-container border-2 border-outline-variant hover:border-primary flex items-center justify-center overflow-hidden shrink-0 transition-all shadow-sm">
                 {user?.photoURL ? (
                    <img src={user.photoURL} alt="Profile" className="w-full h-full object-cover" />
                 ) : (
                    <User className="w-5 h-5 text-on-surface-variant" />
                 )}
               </div>
               <div className="absolute right-0 top-12 sm:top-14 scale-0 group-hover:scale-100 origin-top-right transition-all duration-200 bg-surface-container border border-outline rounded-2xl p-2 shadow-2xl z-50 w-56 backdrop-blur-2xl">
                  <div className="px-3 py-3 border-b border-outline-variant mb-2">
                    <p className="text-[13px] font-bold text-on-surface truncate">{user?.displayName || "Agent"}</p>
                    <p className="text-[11px] font-mono tracking-wide text-on-surface-variant truncate">{user?.email || "anon@terminal"}</p>
                  </div>
                  <button onClick={() => setShowSettingsModal(true)} className="w-full flex items-center gap-2 text-on-surface hover:text-primary hover:bg-surface-container-high p-2.5 rounded-xl text-xs font-mono font-semibold transition-colors mb-1 uppercase tracking-wide">
                    <Settings className="w-4 h-4" /> Settings
                  </button>
                  <button onClick={logout} className="w-full flex items-center gap-2 text-on-surface hover:bg-error/10 hover:text-error p-2.5 rounded-xl text-xs font-mono font-semibold transition-colors uppercase tracking-wide">
                    <LogOut className="w-4 h-4" /> Disconnect
                  </button>
               </div>
            </div>
          </div>
        </div>
      </header>
  );
}
