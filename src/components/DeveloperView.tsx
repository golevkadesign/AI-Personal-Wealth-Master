import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, Cpu, User, Activity, PieChart, Sparkles, Target, Sliders, 
  Database, RefreshCw, Edit3, Trash2, Check, Copy, AlertTriangle, ShieldCheck,
  GitMerge, Settings2, PlaySquare, Workflow
} from 'lucide-react';
import { auth } from '../lib/firebase';
import { useWealthStore } from '../hooks/useWealthStore';
import { getSettings, saveSettings } from '../lib/settings';
import { DEFAULT_PROMPTS, DEFAULT_RAG_SCHEMA } from '../lib/defaultPrompts';

const AGENTS = [
  { id: 'rag', name: 'RAG Memory Agent', role: 'Context Retrieval', type: 'rag', color: 'border-emerald-500/25 bg-emerald-500/5 text-emerald-400' },
  { id: 'hydrator', name: 'Context Hydrator', role: 'Deterministic Layer', type: 'middleware', color: 'border-slate-500/25 bg-slate-500/5 text-slate-400' },
  { id: 'general', name: 'General Finance', role: 'Standard Planning', type: 'llm', color: 'border-blue-500/25 bg-blue-500/5 text-blue-400' },
  { id: 'hnw', name: 'HNW Manager', role: 'Wealth Structuring', type: 'llm', color: 'border-purple-500/25 bg-purple-500/5 text-purple-400' },
  { id: 'debt', name: 'Debt Crisis', role: 'Leverage & Risk', type: 'llm', color: 'border-rose-500/25 bg-rose-500/5 text-rose-400' },
  { id: 'market', name: 'Market Quant', role: 'Macro Strategy', type: 'llm', color: 'border-cyan-500/25 bg-cyan-500/5 text-cyan-400' },
  { id: 'devil', name: 'Devil\'s Advocate', role: 'Stress Testing', type: 'llm', color: 'border-red-600/30 bg-red-600/10 text-red-500' },
  { id: 'orchestrator', name: 'CEO / Synthesizer', role: 'Final Aggregation', type: 'llm', color: 'border-[#C9B284]/30 bg-[#C9B284]/10 text-[#E7D7B0]' }
];

interface DeveloperViewProps {
  isOpen: boolean;
  onClose: () => void;
  onClearData?: () => void;
}

export const DeveloperView: React.FC<DeveloperViewProps> = ({ 
  isOpen, 
  onClose, 
  onClearData
}) => {
  const user = useWealthStore(s => s.user);
  const state = useWealthStore(s => s.data);
  const commitData = useWealthStore(s => s.commitData);
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [editProfileData, setEditProfileData] = useState<any>({});
  const [selectedSection, setSelectedSection] = useState<string | null>(null);
  const [copiedUid, setCopiedUid] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  
  // Tabs & Pipeline
  const [activeTab, setActiveTab] = useState<'state' | 'pipeline'>('state');
  const [activeAgentId, setActiveAgentId] = useState<string>('orchestrator');
  const [isEditingPrompt, setIsEditingPrompt] = useState(false);
  const [editContent, setEditContent] = useState('');
  const [localSettings, setLocalSettings] = useState(getSettings());

  // Initialize editable profile fields when modal opens
  useEffect(() => {
    if (isOpen) {
      setEditProfileData({
        name: user?.name || user?.displayName || auth.currentUser?.displayName || 'Alex H.',
        email: user?.email || auth.currentUser?.email || 'alex.h@example.com',
        currency: user?.currency || 'USD',
        riskProfile: user?.riskProfile || 'Moderate',
        investmentHorizon: user?.investmentHorizon || 'Long Term',
        dataSource: user?.dataSource || 'auto-detected',
        createdAt: user?.createdAt || '2024-01-15T08:22:10Z',
        updatedAt: user?.updatedAt || '2025-05-27T14:33:45Z',
        ...user
      });
      setIsEditingProfile(false);
      setSelectedSection(null);
      setCopiedUid(false);
      setLocalSettings(getSettings());
      setIsEditingPrompt(false);
    }
  }, [isOpen, user]);

  const handleCopyUid = () => {
    const uid = auth.currentUser?.uid || 'user_9f3b7a2c';
    navigator.clipboard.writeText(uid);
    setCopiedUid(true);
    setTimeout(() => setCopiedUid(false), 2000);
  };

  const handleFieldChange = (key: string, val: string) => {
    setEditProfileData((prev: any) => ({
      ...prev,
      [key]: val
    }));
  };

  const handleSaveProfile = () => {
    commitData((prev: any) => ({
      ...prev,
      userProfile: editProfileData
    }));
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3000);
    setIsEditingProfile(false);
  };

  // Agent Pipeline Logic
  const handleSelectAgent = (id: string) => {
    setActiveAgentId(id);
    setIsEditingPrompt(false);
  };
  
  const activeAgent = AGENTS.find(a => a.id === activeAgentId) || AGENTS[0];
  
  const getCurrentAgentContent = (agent: typeof activeAgent) => {
    if (agent.type === 'rag') {
      return localSettings.ragSchema || DEFAULT_RAG_SCHEMA;
    }
    if (agent.type === 'llm') {
      return localSettings.agentPrompts?.[agent.id] || (DEFAULT_PROMPTS as any)[agent.id] || '';
    }
    return 'DETERMINISTIC_MIDDLEWARE_LAYER: \nThis node interpreting and routing extracted context. No stochastic LLM prompt is executed here.';
  };
  
  const handleEditPrompt = () => {
    setEditContent(getCurrentAgentContent(activeAgent));
    setIsEditingPrompt(true);
  };
  
  const handleCancelEdit = () => {
    setIsEditingPrompt(false);
  };
  
  const handleSavePrompt = () => {
    const newSettings = { ...localSettings };
    if (activeAgent.type === 'rag') {
      newSettings.ragSchema = editContent;
    } else if (activeAgent.type === 'llm') {
      newSettings.agentPrompts = {
        ...newSettings.agentPrompts,
        [activeAgent.id]: editContent
      };
    }
    
    saveSettings(newSettings);
    setLocalSettings(newSettings);
    setIsEditingPrompt(false);
    
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3000);
  };
  
  const handleRestoreDefault = () => {
    const newSettings = { ...localSettings };
    if (activeAgent.type === 'rag') {
      newSettings.ragSchema = DEFAULT_RAG_SCHEMA;
    } else if (activeAgent.type === 'llm') {
      if (newSettings.agentPrompts) {
        delete newSettings.agentPrompts[activeAgent.id];
      }
    }
    
    saveSettings(newSettings);
    setLocalSettings(newSettings);
    setIsEditingPrompt(false);
    
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3000);
  };

  // Live element counts for the state inspector rows
  const counts = useMemo(() => {
    const uCount = Object.keys(user || {}).length || 8;
    const mCount = Object.keys(state?.metrics || {}).length || 6;
    
    // Total items across all distribution categories
    const distCount = Object.values(state?.distributions || {}).reduce(
      (acc: number, arr: any) => acc + (Array.isArray(arr) ? arr.length : 0), 0
    ) || 5;

    const iCount = Object.keys(state?.insights || {}).filter(k => state?.insights?.[k]).length || 3;
    const gActive = state?.goal?.name ? 1 : 0;
    const wCount = state?.dynamicWidgets?.length || 12;

    return {
      userProfile: `${uCount} fields`,
      metrics: `${mCount} metrics`,
      distributions: `${distCount} items`,
      insights: `${iCount} items`,
      goal: gActive ? '1 active' : '0 active',
      dynamicWidgets: `${wCount} widgets`
    };
  }, [user, state]);

  // Generate pretty syntax highlighted code snippets
  const jsonCodeLines = useMemo(() => {
    let rawStr = '';
    if (!selectedSection) {
      rawStr = `{\n  "userProfile": { ... ${counts.userProfile} },\n  "metrics": { ... ${counts.metrics} },\n  "distributions": [ ... ${counts.distributions} ],\n  "insights": [ ... ${counts.insights} ],\n  "goal": { ... ${counts.goal} },\n  "dynamicWidgets": [ ... ${counts.dynamicWidgets} ]\n}`;
    } else {
      let subset: any = {};
      if (selectedSection === 'userProfile') {
        subset = { userProfile: user || {} };
      } else if (selectedSection === 'metrics') {
        subset = { metrics: state?.metrics || {} };
      } else if (selectedSection === 'distributions') {
        subset = { distributions: state?.distributions || {} };
      } else if (selectedSection === 'insights') {
        subset = { insights: state?.insights || {} };
      } else if (selectedSection === 'goal') {
        subset = { goal: state?.goal || {} };
      } else if (selectedSection === 'dynamicWidgets') {
        subset = { dynamicWidgets: state?.dynamicWidgets || [] };
      }
      rawStr = JSON.stringify(subset, null, 2);
    }
    return rawStr.split('\n');
  }, [selectedSection, user, state, counts]);

  const handleRefresh = () => {
    // Force a minor recalculation/refresh aesthetic representation
    setSelectedSection(null);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Deep immersive dark backdrop overlay */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="fixed inset-0 bg-[#030406]/85 backdrop-blur-[10px] z-[90]"
            onClick={onClose}
          />

          {/* Centered refined Modal container */}
          <div className="fixed inset-0 flex items-center justify-center pointer-events-none z-[100] p-4 sm:p-6 md:p-8">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
              className="bg-[#0E1115] border border-[#1C2026] rounded-[28px] w-full max-w-6xl h-[85vh] flex flex-col shadow-[0_32px_96px_rgba(0,0,0,0.95),0_0_0_1px_rgba(251,242,212,0.02)] pointer-events-auto overflow-hidden text-neutral-200 select-none"
            >
              
              {/* Header block with CPU chip icon and Title elements */}
              <div className="h-20 px-6 sm:px-8 border-b border-[#1C2026] flex items-center justify-between shrink-0 bg-[#0B0D10]/50 relative">
                {/* Thin top absolute accent bar */}
                <div className="absolute top-0 left-0 right-0 h-[1.5px] bg-gradient-to-r from-transparent via-[#C9B284]/20 to-transparent" />
                
                <div className="flex items-center gap-6">
                  <div className="flex items-center gap-4 border-r border-[#1C2026] pr-6 hidden sm:flex">
                    <div className="w-10 h-10 rounded-xl bg-[#12151A] border border-[#1C2026] flex items-center justify-center text-[#C9B284] shadow-inner transform scale-95">
                      <Cpu className="w-5 h-5 animate-pulse" />
                    </div>
                    <div>
                      <h2 className="text-base font-serif text-[#E7D7B0] tracking-wide font-medium">Developer View</h2>
                      <p className="text-[11px] font-mono tracking-widest text-[#8C8370] uppercase mt-0.5">App Workspace State</p>
                    </div>
                  </div>
                  
                  {/* Tabs */}
                  <div className="flex bg-[#12151A]/60 border border-[#1C2026] rounded-xl p-1">
                    <button
                      onClick={() => setActiveTab('state')}
                      className={`px-4 py-1.5 rounded-lg text-[11px] sm:text-xs font-mono uppercase tracking-wider transition-all cursor-pointer flex items-center gap-2 ${activeTab === 'state' ? 'bg-[#1C2026] text-[#E7D7B0] shadow-sm' : 'text-[#8C8370] hover:text-[#C9B284] hover:bg-[#1C2026]/50'}`}
                    >
                      <Database className="w-3.5 h-3.5 hidden sm:block" />
                      State & Data
                    </button>
                    <button
                      onClick={() => setActiveTab('pipeline')}
                      className={`px-4 py-1.5 rounded-lg text-[11px] sm:text-xs font-mono uppercase tracking-wider transition-all cursor-pointer flex items-center gap-2 ${activeTab === 'pipeline' ? 'bg-[#1C2026] text-[#E7D7B0] shadow-sm' : 'text-[#8C8370] hover:text-[#C9B284] hover:bg-[#1C2026]/50'}`}
                    >
                      <Workflow className="w-3.5 h-3.5 hidden sm:block" />
                      Pipeline
                    </button>
                  </div>
                </div>

                {/* Top close anchor */}
                <button 
                  onClick={onClose} 
                  className="p-2 bg-[#12151A]/60 hover:bg-[#1E232B] border border-[#1C2026] hover:border-[#8C8370]/30 rounded-full text-neutral-400 hover:text-white transition-all cursor-pointer shadow-sm"
                  aria-label="Close"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Central Dual Column Workspace Area */}
              <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
                {activeTab === 'state' ? (
                  <>
                    {/* Left Column: User Profile Debug panel */}
                    <div className="w-full md:w-[38%] h-auto max-h-[50%] md:max-h-full border-b md:border-b-0 border-r-0 md:border-r border-[#1C2026] flex flex-col bg-[#0B0D10]/20 overflow-y-auto custom-scrollbar p-6 sm:p-7 shrink-0 md:shrink-none">
                      
                      {/* Title */}
                      <div className="flex items-center gap-2 mb-6 shrink-0">
                        <User className="w-4 h-4 text-[#C9B284]" />
                        <h3 className="text-[13px] font-mono tracking-wider text-[#E7D7B0] uppercase font-bold">User Profile Debug</h3>
                      </div>

                      {/* Inspector Fields Table */}
                      <div className="space-y-3 flex-1 pb-6">
                        {/* Unique User ID Row */}
                        <div>
                          <label className="block text-[10px] font-mono uppercase tracking-wider text-[#8C8370] mb-1.5">User ID</label>
                          <div className="flex items-center bg-[#12151A] border border-[#1C2026] rounded-lg px-3 py-2 justify-between">
                            <span className="text-xs text-[#8C8370] font-mono truncate max-w-[200px]">
                              {auth.currentUser?.uid ? auth.currentUser.uid.slice(0, 14) + "..." : "user_9f3b7a2c"}
                            </span>
                            <button 
                              onClick={handleCopyUid}
                              className="p-1 text-neutral-500 hover:text-[#C9B284] hover:bg-neutral-800/40 rounded transition-all cursor-pointer"
                              title="Copy User ID"
                            >
                              {copiedUid ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                            </button>
                          </div>
                        </div>

                        {/* Standard Profile inputs */}
                        {[
                          { key: 'name', label: 'Name', type: 'text' },
                          { key: 'email', label: 'Email', type: 'email' },
                          { key: 'currency', label: 'Currency', type: 'text' },
                          { key: 'riskProfile', label: 'Risk Profile', type: 'text' },
                          { key: 'investmentHorizon', label: 'Investment Horizon', type: 'text' },
                          { key: 'dataSource', label: 'Data Source', type: 'text' },
                          { key: 'createdAt', label: 'Created At', type: 'text' },
                          { key: 'updatedAt', label: 'Updated At', type: 'text' },
                        ].map((f) => {
                          const isEmail = f.key === 'email';
                          const val = editProfileData[f.key] || '';
                          
                          // Mask email slightly to conform with API key rules if not in active edit mode
                          const displayVal = (isEmail && !isEditingProfile && val) 
                            ? val.replace(/(.{3})(.*)(@.*)/, "$1...$3")
                            : val;

                          return (
                            <div key={f.key}>
                              <label className="block text-[10px] font-mono uppercase tracking-wider text-[#8C8370] mb-1.5">{f.label}</label>
                              <input 
                                type={f.type}
                                value={displayVal}
                                disabled={!isEditingProfile}
                                readOnly={!isEditingProfile}
                                onChange={(e) => handleFieldChange(f.key, e.target.value)}
                                className={`w-full bg-[#12151A] border ${isEditingProfile ? 'border-[#C9B284]/40 text-[#E7D7B0] focus:border-[#C9B284]' : 'border-[#1C2026] text-neutral-300'} rounded-lg px-3 py-2 text-xs font-mono transition-all focus:outline-none`}
                              />
                            </div>
                          );
                        })}
                      </div>

                      {/* Dynamic Action Block for Triggering Profile Updates */}
                      <div className="mt-auto pt-6 border-t border-[#1C2026] relative z-10 shrink-0">
                        <div className="bg-[#12151A] border border-[#1C2026] rounded-xl p-4 flex flex-col">
                          <div className="flex items-start gap-3">
                            <div className="w-8 h-8 rounded-lg bg-[#C9B284]/5 border border-[#C9B284]/15 flex items-center justify-center text-[#C9B284] shrink-0">
                              <Edit3 className="w-4 h-4" />
                            </div>
                            <div>
                              <h4 className="text-xs font-serif text-[#E7D7B0] font-medium">Update Profile</h4>
                              <p className="text-[10px] text-[#8C8370] leading-relaxed mt-1">Update basic profile settings for the current user.</p>
                            </div>
                          </div>
                          
                          <div className="mt-4 flex gap-2">
                            {isEditingProfile ? (
                              <>
                                <button 
                                  onClick={handleSaveProfile}
                                  className="flex-1 py-2 bg-[#C9B284] hover:bg-[#E7D7B0] text-black rounded-lg text-xs font-semibold tracking-wide transition-colors cursor-pointer"
                                >
                                  Save Inputs
                                </button>
                                <button 
                                  onClick={() => {
                                    setEditProfileData({ ...user });
                                    setIsEditingProfile(false);
                                  }}
                                  className="py-2 px-3 bg-[#1E232B] hover:bg-neutral-800 rounded-lg text-xs font-mono text-neutral-400 hover:text-white transition-all border border-[#1C2026] cursor-pointer"
                                >
                                  Cancel
                                </button>
                              </>
                            ) : (
                              <button 
                                onClick={() => setIsEditingProfile(true)}
                                className="w-full flex items-center justify-center gap-2 py-2 border border-[#C9B284]/25 hover:border-[#C9B284]/50 bg-[#C9B284]/5 hover:bg-[#C9B284]/10 text-[#C9B284] hover:text-[#E7D7B0] rounded-lg text-xs font-mono tracking-wider uppercase transition-all duration-300 cursor-pointer shadow-sm"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                                Edit Profile
                              </button>
                            )}
                          </div>
                        </div>
                      </div>

                    </div>

                    {/* Right Column: Data / State Inspector panel */}
                    <div className="flex-1 flex flex-col bg-[#080A0D]/40 overflow-y-auto p-6 sm:p-7 custom-scrollbar">
                      
                      {/* Title & Refresh control */}
                      <div className="flex items-center justify-between mb-2 shrink-0">
                        <div className="flex items-center gap-2">
                          <Database className="w-4 h-4 text-[#C9B284]" />
                          <h3 className="text-[13px] font-mono tracking-wider text-[#E7D7B0] uppercase font-bold">Data / State Inspector</h3>
                        </div>
                        
                        <button 
                          onClick={handleRefresh}
                          className="flex items-center gap-1.5 px-2.5 py-1.5 bg-[#12151A] hover:bg-[#1E232B] border border-[#1C2026] rounded-lg text-[10px] font-mono text-[#8C8370] hover:text-white uppercase tracking-wider transition-all cursor-pointer shadow-sm"
                        >
                          <RefreshCw className="w-3 h-3 text-[#C9B284]" />
                          Refresh
                        </button>
                      </div>
                      
                      <p className="text-[11px] text-[#8C8370] tracking-wide mb-6">
                        Live snapshot of the current workspace state stored in local database.
                      </p>

                      {/* Summary lists mapping database states */}
                      <div className="space-y-2 mb-6 shrink-0 relative z-10">
                        {[
                          { id: 'userProfile', name: 'userProfile', count: counts.userProfile, icon: User, badge: 'valid', badgeColor: 'bg-[#0E2C1C] text-[#4ADE80] border-[#22C55E]/15' },
                          { id: 'metrics', name: 'metrics', count: counts.metrics, icon: Activity, badge: 'ok', badgeColor: 'bg-[#0E2C1C] text-[#4ADE80] border-[#22C55E]/15' },
                          { id: 'distributions', name: 'distributions', count: counts.distributions, icon: PieChart, badge: 'ok', badgeColor: 'bg-[#0E2C1C] text-[#4ADE80] border-[#22C55E]/15' },
                          { id: 'insights', name: 'insights', count: counts.insights, icon: Sparkles, badge: 'ok', badgeColor: 'bg-[#0E2C1C] text-[#4ADE80] border-[#22C55E]/15' },
                          { id: 'goal', name: 'goal', count: counts.goal, icon: Target, badge: 'partial', badgeColor: 'bg-[#2D1F10] text-[#FB923C] border-[#F97316]/15' },
                          { id: 'dynamicWidgets', name: 'dynamicWidgets', count: counts.dynamicWidgets, icon: Sliders, badge: 'ok', badgeColor: 'bg-[#0E2C1C] text-[#4ADE80] border-[#22C55E]/15' },
                        ].map((row) => {
                          const IconComponent = row.icon;
                          const isSelected = selectedSection === row.id;

                          return (
                            <div 
                              key={row.id}
                              onClick={() => setSelectedSection(isSelected ? null : row.id)}
                              className={`flex items-center justify-between px-4 py-3 bg-[#12151A]/60 rounded-xl border ${isSelected ? 'border-[#C9B284] bg-[#12151A]' : 'border-[#1C2026] hover:border-[#8C8370]/30'} transition-all cursor-pointer group`}
                            >
                              <div className="flex items-center gap-3">
                                <span className="text-[10px] font-mono text-[#8C8370]/40 group-hover:text-[#C9B284] transition-colors">{isSelected ? "▼" : "▶"}</span>
                                <IconComponent className="w-4 h-4 text-[#C9B284] opacity-85" />
                                <span className="text-xs font-mono text-neutral-300 font-medium group-hover:text-[#E7D7B0] transition-colors">{row.name}</span>
                              </div>

                              <div className="flex items-center gap-3.5">
                                <span className="text-[11px] font-mono text-[#8C8370]/80">{row.count}</span>
                                <span className={`text-[9px] font-mono tracking-widest uppercase px-1.5 py-0.5 rounded border ${row.badgeColor}`}>
                                  {row.badge}
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {/* Output Code box (Syntax highlighting engine representation) */}
                      <div className="flex-1 min-h-[180px] relative z-10 flex flex-col">
                        <div className="bg-[#0B0D10] border border-[#1C2026] rounded-xl flex-1 overflow-x-auto overflow-y-auto p-4 font-mono text-[12.5px] leading-relaxed relative text-[#A6B2C0] shadow-inner custom-scrollbar">
                          
                          {/* Floating Indicator */}
                          <div className="absolute top-3 right-3 text-[9px] font-mono font-semibold tracking-widest text-[#8C8370]/40 uppercase flex items-center gap-2">
                            {selectedSection && (
                              <button 
                                onClick={() => setSelectedSection(null)}
                                className="bg-[#12151A] hover:bg-[#1E232B] border border-[#1C2026] text-[#C9B284] rounded px-2 py-0.5 text-[8.5px] transition-all normal-case cursor-pointer"
                              >
                                ← Show Overview
                              </button>
                            )}
                            <span>JSON</span>
                          </div>

                          {/* Displaying split formatted table rows */}
                          <table className="w-full border-collapse select-text">
                            <tbody>
                              {jsonCodeLines.map((line, idx) => {
                                let highlightedElement = <span>{line}</span>;
                                const indent = line.match(/^\s*/)?.[0] || '';
                                const trimmed = line.trim();

                                if (trimmed.startsWith('"')) {
                                  const parts = trimmed.split('":');
                                  if (parts.length >= 2) {
                                    const key = parts[0] + '"';
                                    const remainingVal = parts.slice(1).join('":');
                                    
                                    let formattedValue = <span className="text-neutral-300">{remainingVal}</span>;
                                    if (remainingVal.trim().startsWith('{') || remainingVal.trim().startsWith('[')) {
                                      formattedValue = <span className="text-neutral-500">{remainingVal}</span>;
                                    } else if (remainingVal.includes('"')) {
                                      formattedValue = <span className="text-[#60a5fa]/90">{remainingVal}</span>;
                                    } else if (/\d+/.test(remainingVal)) {
                                      formattedValue = <span className="text-[#4ade80]/90">{remainingVal}</span>;
                                    }

                                    highlightedElement = (
                                      <span>
                                        {indent}
                                        <span className="text-[#C9B284]">{key}</span>
                                        <span className="text-neutral-500">:</span>
                                        {formattedValue}
                                      </span>
                                    );
                                  }
                                } else if (['{', '}', '[', ']', '},', '],'].includes(trimmed)) {
                                  highlightedElement = <span className="text-neutral-500">{line}</span>;
                                }

                                return (
                                  <tr key={idx} className="hover:bg-white/[0.015]">
                                    <td className="w-8 pr-3 text-right text-[#8C8370]/30 select-none text-[10px] font-mono border-r border-[#1C2026]/40">
                                      {idx + 1}
                                    </td>
                                    <td className="pl-4 pb-0.5 font-mono whitespace-pre text-[12.5px] select-text">
                                      {highlightedElement}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>

                    </div>
                  </>
                ) : (
                  <>
                    {/* Left Column: Agent Flow Pipeline */}
                    <div className="w-full md:w-[38%] h-auto max-h-[40%] md:max-h-full border-b md:border-b-0 border-r-0 md:border-r border-[#1C2026] p-6 sm:p-7 flex flex-col bg-[#0B0D10]/20 overflow-y-auto custom-scrollbar shrink-0 md:shrink-none">
                      <div className="flex items-center gap-2 mb-6 shrink-0">
                        <GitMerge className="w-4 h-4 text-[#C9B284]" />
                        <h3 className="text-[13px] font-mono tracking-wider text-[#E7D7B0] uppercase font-bold">Intelligence Pipeline</h3>
                      </div>
                      
                      <div className="flex flex-col gap-3 relative">
                        {/* Flow vertical line */}
                        <div className="absolute left-6 top-6 bottom-6 w-px bg-gradient-to-b from-[#C9B284]/20 via-[#C9B284]/10 to-transparent z-0" />
                        
                        {AGENTS.map((agent, i) => {
                           const isActive = activeAgentId === agent.id;
                           return (
                             <div 
                               key={agent.id}
                               onClick={() => handleSelectAgent(agent.id)}
                               className={`relative z-10 flex gap-4 p-3 rounded-xl border transition-all cursor-pointer group ${isActive ? 'bg-[#12151A] border-[#C9B284]/40 shadow-sm' : 'bg-[#0E1115]/80 border-[#1C2026] hover:border-[#8C8370]/30 hover:bg-[#12151A]'}`}
                             >
                                <div className={`w-6 h-6 shrink-0 flex items-center justify-center rounded-lg border bg-[#0B0D10] ${agent.color} text-[10px]`}>
                                  {i + 1}
                                </div>
                                <div className="flex flex-col flex-1">
                                  <div className="flex justify-between items-center mb-0.5">
                                    <span className={`text-[13px] font-medium font-sans ${isActive ? 'text-[#E7D7B0]' : 'text-neutral-300'}`}>{agent.name}</span>
                                    <span className="text-[9px] uppercase tracking-widest font-mono text-[#8C8370]/50">{agent.type}</span>
                                  </div>
                                  <span className="text-[11px] font-mono tracking-wide text-[#8C8370]">{agent.role}</span>
                                </div>
                             </div>
                           )
                        })}
                      </div>
                    </div>
                    
                    {/* Right Column: Prompt Lab & Editor */}
                    <div className="flex-1 flex flex-col bg-[#080A0D]/40 p-6 sm:p-7 overflow-hidden">
                       <div className="flex items-center gap-2 mb-4 shrink-0">
                          <Settings2 className="w-4 h-4 text-[#C9B284]" />
                          <h3 className="text-[13px] font-mono tracking-wider text-[#E7D7B0] uppercase font-bold">Node Configuration</h3>
                       </div>
                       
                       <div className="mb-4">
                         <h4 className="text-sm font-sans text-white font-medium">{activeAgent.name}</h4>
                         <p className="text-[11px] font-mono text-[#8C8370] tracking-wide mt-1">Role: {activeAgent.role} | Type: {activeAgent.type}</p>
                       </div>
                       
                       <div className="flex-1 flex flex-col border border-[#1C2026] rounded-xl overflow-hidden bg-[#0A0D11] relative">
                          {/* Header of Editor Component */}
                          <div className="h-10 bg-[#12151A]/60 border-b border-[#1C2026] flex items-center justify-between px-4 shrink-0">
                             <span className="text-[11px] font-mono text-[#C9B284] uppercase tracking-widest flex items-center gap-2">
                               <PlaySquare className="w-3.5 h-3.5 text-[#8C8370]" />
                               {activeAgent.type === 'rag' ? 'Memory Schema (JSON)' : (activeAgent.type === 'middleware' ? 'Runtime Logic' : 'System Prompt')}
                             </span>
                             {activeAgent.type !== 'middleware' && (
                               <div className="flex items-center gap-3">
                                 {isEditingPrompt ? (
                                   <>
                                      <button onClick={handleCancelEdit} className="text-[10px] uppercase font-mono text-[#8C8370] hover:text-white transition-colors cursor-pointer tracking-wider">Cancel</button>
                                      <button onClick={handleSavePrompt} className="text-[10px] uppercase font-mono text-[#12151A] font-semibold bg-[#C9B284] hover:bg-[#E7D7B0] px-2.5 py-1 rounded transition-colors cursor-pointer tracking-wider">Save</button>
                                   </>
                                 ) : (
                                   <>
                                      <button onClick={handleRestoreDefault} className="text-[10px] uppercase font-mono text-red-400 hover:text-red-300 transition-colors cursor-pointer tracking-wider flex justify-center items-center gap-1"><Trash2 className="w-3 h-3"/> Reset</button>
                                      <button onClick={handleEditPrompt} className="text-[10px] uppercase font-mono text-[#C9B284] hover:text-[#E7D7B0] transition-colors cursor-pointer tracking-wider flex justify-center items-center gap-1"><Edit3 className="w-3 h-3"/> Edit</button>
                                   </>
                                 )}
                               </div>
                             )}
                          </div>
                          {/* Editor Content Area */}
                          <div className="flex-1 relative overflow-auto custom-scrollbar p-0">
                             {isEditingPrompt ? (
                               <textarea
                                 value={editContent}
                                 onChange={(e) => setEditContent(e.target.value)}
                                 className="w-full h-full bg-transparent text-[#A6B2C0] font-mono text-[11.5px] leading-relaxed p-5 resize-none focus:outline-none placeholder:text-[#8C8370]/30"
                                 placeholder="Enter prompt or schema structure here..."
                               />
                             ) : (
                               <div className="p-5 text-[#A6B2C0] font-mono text-[11.5px] leading-relaxed whitespace-pre-wrap select-text">
                                 {getCurrentAgentContent(activeAgent)}
                               </div>
                             )}
                          </div>
                       </div>
                    </div>
                  </>
                )}
              </div>

              {/* Redesigned Footer Section containing clear-data actions */}
              <div className="h-20 px-6 sm:px-8 border-t border-[#1C2026] flex items-center justify-between shrink-0 bg-[#0B0D10]/50 relative">
                {/* Save feedback indicator Toast popup inside modal */}
                {saveSuccess && (
                  <div className="absolute -top-12 left-1/2 -translate-x-1/2 bg-[#0E2C1C] border border-[#22C55E]/20 text-[#4ADE80] font-mono text-[11px] rounded-lg px-4 py-1.5 shadow-xl flex items-center gap-2 animate-bounce">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    {activeTab === 'state' ? 'Long-term profile snapshot written physically to persistence!' : 'Agent configuration updated and saved securely.'}
                  </div>
                )}

                {/* Space holder */}
                <div />

                {/* Right region workflow controller */}
                <div className="flex items-center gap-3">
                  <button 
                    onClick={onClose}
                    className="px-5 py-2.5 bg-[#12151A] hover:bg-[#1E232B] border border-[#1C2026] hover:border-[#8C8370]/30 rounded-xl text-xs font-semibold text-neutral-400 hover:text-white tracking-wide transition-all cursor-pointer shadow-sm"
                  >
                    Close
                  </button>
                  {activeTab === 'state' && isEditingProfile && (
                    <button 
                      onClick={handleSaveProfile}
                      className="px-5 py-2.5 bg-gradient-to-r from-[#C9B284] to-[#E7D7B0] hover:from-[#E7D7B0] hover:to-[#FFF2D4] text-black rounded-xl text-xs font-semibold tracking-wide shadow-md hover:shadow-lg transition-all duration-300 cursor-pointer"
                    >
                      Save / Update Profile
                    </button>
                  )}
                </div>

              </div>

            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
};
