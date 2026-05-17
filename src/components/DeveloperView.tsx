import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Network, Cpu, User, Activity, PieChart, ShieldAlert, ArrowDown, Binary, Braces, Sparkles, Database, RefreshCw, Edit2, Save, RotateCcw, AlertCircle, Sliders, FileCode, Plus, Trash2 } from 'lucide-react';
import { getSettings, saveSettings, AppSettings } from '../lib/settings';
import { DEFAULT_PROMPTS, DEFAULT_RAG_SCHEMA } from '../lib/defaultPrompts';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface DeveloperViewProps {
  isOpen: boolean;
  onClose: () => void;
  user?: any;
  onClearData?: () => void;
  onUpdateProfile?: (newProfile: any) => void;
}

export const DeveloperView: React.FC<DeveloperViewProps> = ({ isOpen, onClose, user, onClearData, onUpdateProfile }) => {
  const [activeTab, setActiveTab] = useState<'architecture' | 'memory' | 'routing' | 'moats'>('architecture');
  const [selectedNode, setSelectedNode] = useState<string | null>("rag");
  const [settings, setSettings] = useState<AppSettings>(getSettings());
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState("");
  const [profileFields, setProfileFields] = useState<{id: string, key: string, value: string}[]>([]);

  useEffect(() => {
    if (isOpen) {
      setSettings(getSettings());
      setIsEditing(false);
      if (user && typeof user === 'object') {
        const fields = Object.keys(user)
          // Filter out internal firebase auth properties if user is accidentally an Auth object, or just map them
          .map(k => ({
            id: Math.random().toString(36).substring(7),
            key: k,
            value: typeof user[k] === 'object' ? JSON.stringify(user[k], null, 2) : String(user[k])
          }));
        setProfileFields(fields);
      } else {
        setProfileFields([]);
      }
    }
  }, [isOpen, selectedNode, user]);

  const handleAddProfileField = () => setProfileFields([...profileFields, { id: Math.random().toString(36).substring(7), key: '', value: '' }]);
  const handleUpdateProfileField = (id: string, field: 'key' | 'value', val: string) => setProfileFields(profileFields.map(f => f.id === id ? { ...f, [field]: val } : f));
  const handleRemoveProfileField = (id: string) => setProfileFields(profileFields.filter(f => f.id !== id));

  const handleSaveProfile = () => {
    if (!onUpdateProfile) return alert("未绑定保存方法！");
    const newProfile: any = {};
    profileFields.forEach(f => {
      const k = f.key.trim();
      if (k) {
        try { newProfile[k] = JSON.parse(f.value); } 
        catch { newProfile[k] = f.value; }
      }
    });
    onUpdateProfile(newProfile);
    alert("长线记忆快照已成功物理覆盖写入！");
  };

  const AGENTS = useMemo(() => [
    {
      id: "rag", name: "RAG Memory Agent", role: "Context Guardian & Profile Updater", icon: <Database className="w-6 h-6 text-indigo-400" />, color: "border-indigo-500/50 bg-indigo-500/10",
      function: "Intercepts every message to update the persistent user profile with new life facts (Career, Financials, etc). Uses a strict JSON RAG schema.",
      pe: settings.ragSchema || DEFAULT_RAG_SCHEMA,
    },
    {
      id: "hydrator", name: "Context Hydrator (Live Data Layer)", role: "Real-time API integration layer", icon: <Activity className="w-6 h-6 text-emerald-400" />, color: "border-emerald-500/50 bg-emerald-500/10",
      function: "Decoupled adapter layer that fetches and injects live API data (e.g. Longbridge Live Portfolio, Yahoo Finance) directly into the prompting context without blocking the LLM.",
      pe: "Not an LLM prompt. This is a deterministic Node.js adapter layer that normalizes standard [LIVE_PORTFOLIO] payload for Expert Matrix."
    },
    {
      id: "orchestrator", name: "Orchestrator & Synthesizer", role: "Traffic Controller & Result Synthesizer", icon: <Network className="w-6 h-6 text-blue-400" />, color: "border-blue-500/50 bg-blue-500/10",
      function: "Analyzes user tier and context data to route the request to the appropriate expert agents. Maintains conversational session history for context memory. Synthesizes sub-agent results into a cohesive final strategy with actionable next steps.",
      pe: settings.agentPrompts?.orchestrator || DEFAULT_PROMPTS.orchestrator,
    },
    {
      id: "debt", name: "Debt Focus Agent", role: "Debt Crisis Intervention Advisor", icon: <ShieldAlert className="w-6 h-6 text-red-400" />, color: "border-red-500/50 bg-red-500/10",
      function: "Helps users get out of debt spirals, rebuild cash flow, and manage psychological stress. Distinguishes consumer vs strategic debt.",
      pe: settings.agentPrompts?.debt || DEFAULT_PROMPTS.debt
    },
    {
      id: "general", name: "General Finance Agent", role: "Comprehensive Financial Advisor (CFP)", icon: <PieChart className="w-6 h-6 text-emerald-400" />, color: "border-emerald-500/50 bg-emerald-500/10",
      function: "Dynamically adapts to students, mid-class families, and near-retirees. Balances growth, asset moats, and cash flow.",
      pe: settings.agentPrompts?.general || DEFAULT_PROMPTS.general
    },
    {
      id: "hnw", name: "High Net Worth Agent", role: "Family Office Wealth Manager", icon: <Sparkles className="w-6 h-6 text-purple-400" />, color: "border-purple-500/50 bg-purple-500/10",
      function: "Focuses on New vs Old Money differentiation, asset allocation, tax harvesting, inheritance, and tail risk mitigation.",
      pe: settings.agentPrompts?.hnw || DEFAULT_PROMPTS.hnw
    },
    {
      id: "market", name: "Market Analysis Agent", role: "Wall Street Quantitative Analyst", icon: <Activity className="w-6 h-6 text-dash-gold" />, color: "border-dash-gold/50 bg-dash-gold/10",
      function: "Performs technical and fundamental analysis based on fetched market data with tier-adjusted risk tolerance bounds.",
      pe: settings.agentPrompts?.market || DEFAULT_PROMPTS.market
    },
    {
      id: "devil", name: "Devil Advocate", role: "Pessimistic Stress Tester", icon: <AlertCircle className="w-6 h-6 text-red-500" />, color: "border-red-500/50 bg-red-500/10",
      function: "Specializes in finding flaws, predicting black swan events, and applying extreme stress testing.",
      pe: settings.agentPrompts?.devil || DEFAULT_PROMPTS.devil
    }
  ], [settings]);

  const activeAgent = AGENTS.find(a => a.id === selectedNode) || AGENTS[0];

  const handleSavePrompt = () => {
    const newSettings = { ...settings };
    if (activeAgent.id === 'rag') {
      newSettings.ragSchema = editContent;
    } else {
      newSettings.agentPrompts = {
        ...(newSettings.agentPrompts || {}),
        [activeAgent.id]: editContent
      };
    }
    setSettings(newSettings);
    saveSettings(newSettings);
    setIsEditing(false);
  };

  const handleRestoreDefault = () => {
    const newSettings = { ...settings };
    if (activeAgent.id === 'rag') {
      newSettings.ragSchema = DEFAULT_RAG_SCHEMA;
    } else {
      if (newSettings.agentPrompts) delete newSettings.agentPrompts[activeAgent.id];
    }
    setSettings(newSettings);
    saveSettings(newSettings);
    setIsEditing(false);
  };

  const handleSaveGlobal = () => {
    saveSettings(settings);
    alert("智能体全局配置已成功注入运行时生态！");
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.3 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-[4px] z-[40]"
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, x: 50, filter: 'blur(10px)' }} 
            animate={{ opacity: 1, x: 0, filter: 'blur(0px)' }} 
            exit={{ opacity: 0, x: '100%', filter: 'blur(10px)' }} 
            transition={{ type: "spring", bounce: 0, duration: 0.4 }}
            className="fixed inset-y-0 right-0 w-[100vw] sm:w-[95vw] xl:w-[1200px] max-w-full bg-dash-bg border-l border-dash-subtle z-[50] flex flex-col shadow-2xl font-sans"
          >
            {/* Header */}
            <div className="h-16 border-b border-dash-subtle flex items-center justify-between px-4 sm:px-6 bg-black/20 z-10 shrink-0">
          <div className="flex items-center space-x-3">
            <Binary className="w-6 h-6 text-dash-gold" />
            <h2 className="text-lg font-semibold tracking-tight text-white">Developer View: Control Center</h2>
          </div>
          <div className="flex items-center space-x-4">
            {user && (
              <button onClick={onClearData} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 transition-colors text-xs font-semibold uppercase tracking-wider">
                <ShieldAlert className="w-3.5 h-3.5" /> 彻底清空资料与状态记录
              </button>
            )}
            <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full text-slate-400 hover:text-white transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Main Workspace */}
        <div className="flex-1 flex overflow-hidden">
          {/* Left Thin Tab Bar */}
          <div className="w-16 border-r border-dash-subtle flex flex-col gap-4 py-6 items-center bg-black/10 shrink-0 z-20">
            {[
              { id: 'architecture', icon: Network, label: '架构与提示词' },
              { id: 'memory', icon: Database, label: '物理记忆实体' },
              { id: 'routing', icon: Cpu, label: '分布式模型网关' },
              { id: 'moats', icon: Sliders, label: '系统量化红线' }
            ].map(t => {
              const Icon = t.icon;
              const isSel = activeTab === t.id;
              return (
                <button key={t.id} onClick={() => setActiveTab(t.id as any)} 
                  className={`p-3 rounded-xl transition-all relative group overflow-hidden ${isSel ? 'bg-dash-primary/10 text-dash-primary shadow-[inset_0_0_20px_rgba(var(--color-dash-primary),0.1)]' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}>
                  {isSel && <div className="absolute left-0 top-1/4 bottom-1/4 w-1 bg-dash-primary rounded-r-full shadow-[0_0_10px_rgba(var(--color-dash-primary),0.8)]" />}
                  <Icon className="w-5 h-5 relative z-10" />
                  <span className="absolute left-full ml-2 px-2 py-1 bg-slate-800 text-white text-xs rounded opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity whitespace-nowrap z-50 border border-slate-700">{t.label}</span>
                </button>
              );
            })}
          </div>

          {/* Right Content Area */}
          <div className="flex-1 flex flex-col overflow-hidden bg-dash-base relative">
            {activeTab === 'architecture' && (
              <div className="flex-1 flex flex-col lg:flex-row h-full overflow-hidden">
                {/* Visual Flow Diagram */}
                <div className="flex-1 border-r border-dash-subtle p-4 md:p-8 overflow-y-auto relative bg-dash-base flex items-start justify-center">
                  <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'radial-gradient(circle at center, #ffffff 1px, transparent 1px)', backgroundSize: '32px 32px' }}></div>
                  <div className="relative w-full max-w-3xl flex flex-col items-center py-6">
                    {/* User */}
                    <div className="flex flex-col items-center mb-8">
                      <div className="w-14 h-14 rounded-full bg-white/5 border border-white/10 flex items-center justify-center shadow-lg relative z-10 backdrop-blur-sm">
                        <User className="w-6 h-6 text-dash-secondary" />
                      </div>
                      <div className="mt-2 text-[10px] font-mono text-dash-tertiary tracking-widest uppercase">User Query</div>
                    </div>
                    {/* RAG */}
                    <button onClick={() => setSelectedNode('rag')} className={`relative z-10 w-56 p-4 rounded-xl border ${selectedNode === 'rag' ? 'ring-2 ring-indigo-500/50 border-indigo-500' : 'border-indigo-500/30'} bg-indigo-500/10 hover:bg-indigo-500/20 transition-all flex flex-col items-center mb-8 backdrop-blur-md`}>
                      <Database className="w-5 h-5 text-indigo-400 mb-2" />
                      <div className="font-semibold text-sm text-white">RAG Memory Agent</div>
                    </button>
                    <ArrowDown className="w-5 h-5 text-dash-subtle mb-8 -mt-6" />
                    {/* Hydrator */}
                    <button onClick={() => setSelectedNode('hydrator')} className={`relative z-10 w-56 p-4 rounded-xl border ${selectedNode === 'hydrator' ? 'ring-2 ring-emerald-500/50 border-emerald-500' : 'border-emerald-500/30'} bg-emerald-500/10 hover:bg-emerald-500/20 transition-all flex flex-col items-center mb-8 backdrop-blur-md`}>
                      <Activity className="w-5 h-5 text-emerald-400 mb-2" />
                      <div className="font-semibold text-sm text-white">Context Hydrator</div>
                    </button>
                    <ArrowDown className="w-5 h-5 text-dash-subtle mb-8 -mt-6" />
                    {/* Orchestrator */}
                    <button onClick={() => setSelectedNode('orchestrator')} className={`relative z-10 w-56 p-4 rounded-xl border ${selectedNode === 'orchestrator' ? 'ring-2 ring-blue-500/50 border-blue-500' : 'border-blue-500/30'} bg-blue-500/10 hover:bg-blue-500/20 transition-all flex flex-col items-center backdrop-blur-md`}>
                      <Network className="w-5 h-5 text-blue-400 mb-2" />
                      <div className="font-semibold text-sm text-white">Orchestrator</div>
                    </button>
                    {/* Branches */}
                    <div className="flex w-full justify-between items-start mt-6 mb-4 max-w-xl relative">
                      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[calc(66.666%-1rem)] h-8 border-t border-l border-r border-dash-subtle rounded-t-xl"></div>
                      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-0 h-8 border-l border-dash-subtle"></div>
                    </div>
                    {/* Tiers */}
                    <div className="flex w-full justify-between max-w-2xl relative z-10 gap-3">
                      <button onClick={() => setSelectedNode('debt')} className={`flex-1 p-3 rounded-xl border ${selectedNode === 'debt' ? 'ring-2 ring-dash-red/50 border-dash-red' : 'border-dash-red/30'} bg-dash-red/10 flex flex-col items-center`}>
                        <ShieldAlert className="w-4 h-4 text-dash-red mb-1" />
                        <div className="font-semibold text-xs text-white">Debt Focus</div>
                      </button>
                      <button onClick={() => setSelectedNode('general')} className={`flex-1 p-3 rounded-xl border ${selectedNode === 'general' ? 'ring-2 ring-dash-green/50 border-dash-green' : 'border-dash-green/30'} bg-dash-green/10 flex flex-col items-center`}>
                        <PieChart className="w-4 h-4 text-dash-green mb-1" />
                        <div className="font-semibold text-xs text-white">General Finance</div>
                      </button>
                      <button onClick={() => setSelectedNode('hnw')} className={`flex-1 p-3 rounded-xl border ${selectedNode === 'hnw' ? 'ring-2 ring-purple-500/50 border-purple-500' : 'border-purple-500/30'} bg-purple-500/10 flex flex-col items-center`}>
                        <Sparkles className="w-4 h-4 text-purple-400 mb-1" />
                        <div className="font-semibold text-xs text-white">High Net Worth</div>
                      </button>
                    </div>
                    {/* Parallels */}
                    <div className="flex gap-4 w-full justify-center max-w-2xl mt-8">
                       <button onClick={() => setSelectedNode('market')} className={`w-48 p-3 rounded-xl border border-dashed ${selectedNode === 'market' ? 'ring-2 ring-dash-gold/50 border-dash-gold' : 'border-dash-gold/40'} bg-dash-gold/5 flex flex-col items-center`}>
                         <Activity className="w-4 h-4 text-dash-gold mb-1" />
                         <div className="font-semibold text-xs text-white">Market Quant</div>
                       </button>
                       <button onClick={() => setSelectedNode('devil')} className={`w-48 p-3 rounded-xl border border-dashed ${selectedNode === 'devil' ? 'ring-2 ring-dash-red/50 border-dash-red' : 'border-dash-red/40'} bg-dash-red/5 flex flex-col items-center`}>
                         <AlertCircle className="w-4 h-4 text-dash-red mb-1" />
                         <div className="font-semibold text-xs text-white">Devil's Advocate</div>
                       </button>
                    </div>
                  </div>
                </div>
                {/* Node PE Editor */}
                <div className="w-full lg:w-[450px] xl:w-[500px] bg-dash-surface flex flex-col overflow-y-auto">
                  <div className="p-6 border-b border-dash-subtle bg-dash-surface-hover/30 shrink-0">
                    <div className="flex items-center space-x-4">
                      <div className={`p-2.5 rounded-xl border ${activeAgent.color} shadow-sm bg-dash-base`}>{activeAgent.icon}</div>
                      <div>
                        <h3 className="text-lg font-bold text-white">{activeAgent.name}</h3>
                        <div className="text-[10px] font-mono uppercase tracking-widest text-dash-tertiary mt-1">{activeAgent.role}</div>
                      </div>
                    </div>
                    <div className="mt-4 text-xs text-slate-300 leading-relaxed bg-black/20 p-3 rounded-lg border border-dash-subtle">{activeAgent.function}</div>
                  </div>
                  <div className="p-6 flex-1 flex flex-col">
                    <div className="flex items-center justify-between mb-3 shrink-0">
                      <h4 className="text-[11px] uppercase tracking-widest text-dash-secondary font-bold flex items-center">
                        <FileCode className="w-3.5 h-3.5 mr-1.5" /> {activeAgent.id === 'rag' ? 'RAG JSON Schema' : 'System Prompt'}
                      </h4>
                      <div className="flex space-x-2">
                        {isEditing ? (
                          <>
                            <button onClick={handleSavePrompt} className="px-2.5 py-1 text-[10px] bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20 rounded border border-emerald-500/30 uppercase tracking-wide font-bold">Save</button>
                            <button onClick={() => setIsEditing(false)} className="px-2.5 py-1 text-[10px] bg-dash-base text-slate-400 hover:text-white rounded border border-dash-subtle uppercase tracking-wide font-bold">Cancel</button>
                          </>
                        ) : (
                          <>
                            <button onClick={() => { setEditContent(activeAgent.pe); setIsEditing(true); }} className="px-2.5 py-1 text-[10px] bg-blue-500/10 text-blue-500 hover:bg-blue-500/20 rounded border border-blue-500/30 uppercase tracking-wide font-bold">Edit</button>
                            <button onClick={handleRestoreDefault} className="px-2.5 py-1 text-[10px] bg-red-500/10 text-red-400 hover:bg-red-500/20 rounded border border-red-500/30 uppercase tracking-wide font-bold">Reset</button>
                          </>
                        )}
                      </div>
                    </div>
                    <div className="flex-1 relative min-h-[300px]">
                      {isEditing ? (
                        <textarea value={editContent} onChange={e => setEditContent(e.target.value)} className="absolute inset-0 w-full h-full text-xs font-mono text-slate-300 bg-black/40 p-4 rounded-xl border border-dash-primary/50 focus:outline-none focus:ring-1 focus:ring-dash-primary resize-none leading-relaxed" />
                      ) : activeAgent.id === 'rag' ? (
                        <div className="absolute inset-0 text-xs text-slate-300 bg-black/20 p-4 rounded-xl border border-dash-subtle overflow-y-auto prose prose-invert max-w-none">
                          <ReactMarkdown remarkPlugins={[remarkGfm]}>{activeAgent.pe}</ReactMarkdown>
                        </div>
                      ) : (
                        <pre className="absolute inset-0 text-[11px] leading-relaxed font-mono text-blue-300/90 bg-black/20 p-4 rounded-xl border border-dash-subtle overflow-y-auto whitespace-pre-wrap">
                          {activeAgent.pe}
                        </pre>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Other Config Tabs */}
            {activeTab !== 'architecture' && (
              <div className="flex-1 p-4 sm:p-8 overflow-y-auto">
                <div className="max-w-3xl space-y-8 mx-auto">
                  {activeTab === 'memory' && (
                    <div className="space-y-6 flex flex-col h-full">
                      <div className="flex justify-between items-center shrink-0">
                        <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                          <Database className="w-4 h-4"/> 物理记忆实体快照 (RAG Profile)
                        </h3>
                        <button onClick={handleAddProfileField} className="px-3 py-1.5 bg-dash-primary/20 text-dash-primary hover:bg-dash-primary/30 border border-dash-primary/30 rounded-lg text-xs font-bold transition-colors">
                          + 添加结构化属性
                        </button>
                      </div>

                      <div className="flex-1 overflow-y-auto space-y-4 pr-2 pb-6">
                        {profileFields.length === 0 && (
                           <div className="text-slate-500 text-sm text-center py-10 border border-dashed border-dash-subtle rounded-xl">暂无记忆数据，请手动添加或通过全局沙盒对话生成。</div>
                        )}
                        {profileFields.map((field) => (
                          <div key={field.id} className="bg-dash-surface border border-dash-subtle rounded-xl p-4 flex flex-col sm:flex-row gap-4 group transition-colors hover:border-dash-primary/50 relative shadow-sm">
                            <div className="w-full sm:w-1/3 shrink-0">
                              <input 
                                type="text" placeholder="属性键名 (e.g. Demographics)" value={field.key} 
                                onChange={(e) => handleUpdateProfileField(field.id, 'key', e.target.value)}
                                className="w-full bg-black/30 border border-dash-subtle rounded-lg p-2.5 text-[13px] text-dash-gold font-mono focus:outline-none focus:border-dash-primary transition-colors"
                              />
                            </div>
                            <div className="flex-1 w-full">
                              <textarea 
                                placeholder="详细履历、牵挂或财务约束内容..." value={field.value} 
                                onChange={(e) => handleUpdateProfileField(field.id, 'value', e.target.value)}
                                rows={typeof field.value === 'string' && field.value.length > 60 ? 4 : 1}
                                className="w-full bg-black/30 border border-dash-subtle rounded-lg p-2.5 text-[13px] text-slate-300 focus:outline-none focus:border-dash-primary transition-colors resize-y min-h-[42px] leading-relaxed scrollbar-thin scrollbar-thumb-dash-subtle"
                              />
                            </div>
                            <button onClick={() => handleRemoveProfileField(field.id)} className="absolute -right-2 -top-2 sm:opacity-0 sm:group-hover:opacity-100 opacity-100 p-1.5 bg-red-500/90 text-white rounded-full shadow-lg hover:bg-red-500 transition-all border border-red-400">
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                        ))}
                      </div>

                      {/* 专属保存按钮 */}
                      <div className="pt-6 border-t border-dash-subtle flex justify-end shrink-0">
                        <button onClick={handleSaveProfile} className="px-6 py-2.5 bg-dash-primary hover:bg-white text-black rounded-xl font-bold flex items-center gap-2 shadow-lg tracking-wide transition-colors">
                          <Save className="w-4 h-4" /> 物理覆盖写入记忆库
                        </button>
                      </div>
                    </div>
                  )}

                  {activeTab === 'routing' && (
                    <div className="space-y-6">
                      <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2"><Cpu className="w-4 h-4"/> 分布式模型网关路由</h3>
                      <div className="grid gap-5">
                        <div className="bg-dash-surface border border-dash-subtle p-5 rounded-xl">
                          <label className="block text-slate-300 text-xs font-bold uppercase tracking-wider mb-2">1. Intent Gateway (意图拦截极速节点)</label>
                          <input className="w-full bg-black/20 border border-dash-subtle rounded-lg p-2.5 text-sm text-white focus:outline-none focus:border-dash-primary transition-colors" value={settings.intentModel || ''} onChange={e => setSettings({...settings, intentModel: e.target.value})} placeholder="gemini-2.5-flash" />
                        </div>
                        <div className="bg-dash-surface border border-dash-subtle p-5 rounded-xl">
                          <label className="block text-slate-300 text-xs font-bold uppercase tracking-wider mb-2">2. Orchestrator CEO (核心深度决策节点)</label>
                          <input className="w-full bg-black/20 border border-dash-subtle rounded-lg p-2.5 text-sm text-white focus:outline-none focus:border-dash-primary transition-colors" value={settings.orchestratorModel || ''} onChange={e => setSettings({...settings, orchestratorModel: e.target.value})} placeholder="gemini-2.5-pro" />
                        </div>
                        <div className="bg-dash-surface border border-dash-subtle p-5 rounded-xl">
                          <label className="block text-slate-300 text-xs font-bold uppercase tracking-wider mb-2">3. Sentinel Daemon (后台静默巡检哨兵)</label>
                          <input className="w-full bg-black/20 border border-dash-subtle rounded-lg p-2.5 text-sm text-white focus:outline-none focus:border-dash-primary transition-colors" value={settings.sentinelModel || ''} onChange={e => setSettings({...settings, sentinelModel: e.target.value})} placeholder="gemini-2.5-flash" />
                        </div>
                      </div>
                    </div>
                  )}

                  {activeTab === 'moats' && (
                    <div className="space-y-6">
                      <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2"><Sliders className="w-4 h-4"/> 核心流控参数与量化红线约束</h3>
                      <div className="space-y-8 bg-dash-surface border border-dash-subtle rounded-xl p-6">
                        {/* Heartbeat */}
                        <div>
                          <div className="flex justify-between text-slate-300 mb-3 text-xs font-bold uppercase tracking-wider">
                            <span>📡 数据脉冲频率 (Heartbeat)</span>
                            <span className="text-dash-primary font-mono bg-dash-primary/10 px-2 py-0.5 rounded">{settings.heartbeatInterval || 180} 秒</span>
                          </div>
                          <input type="range" min="60" max="600" step="10" className="w-full accent-dash-primary h-1.5 bg-black/40 rounded-lg appearance-none cursor-pointer" value={settings.heartbeatInterval || 180} onChange={e => setSettings({...settings, heartbeatInterval: parseInt(e.target.value)})} />
                        </div>
                        {/* Cooldown */}
                        <div>
                          <div className="flex justify-between text-slate-300 mb-3 text-xs font-bold uppercase tracking-wider">
                            <span>🛑 哨兵巡检冷却 (Cooldown)</span>
                            <span className="text-dash-primary font-mono bg-dash-primary/10 px-2 py-0.5 rounded">{settings.sentinelCooldown || 60} 分钟</span>
                          </div>
                          <input type="range" min="1" max="240" step="5" className="w-full accent-dash-primary h-1.5 bg-black/40 rounded-lg appearance-none cursor-pointer" value={settings.sentinelCooldown || 60} onChange={e => setSettings({...settings, sentinelCooldown: parseInt(e.target.value)})} />
                        </div>
                        <div className="h-px bg-dash-subtle w-full"></div>
                        {/* Liquidity */}
                        <div>
                          <div className="flex justify-between text-slate-300 mb-3 text-xs font-bold uppercase tracking-wider">
                            <span>🍷 现金流安全垫 (Liquidity Cushion)</span>
                            <span className="text-dash-primary font-mono bg-dash-primary/10 px-2 py-0.5 rounded">{settings.liquidityBufferMonths || 6} 个月</span>
                          </div>
                          <input type="range" min="1" max="24" className="w-full accent-dash-primary h-1.5 bg-black/40 rounded-lg appearance-none cursor-pointer" value={settings.liquidityBufferMonths || 6} onChange={e => setSettings({...settings, liquidityBufferMonths: parseInt(e.target.value)})} />
                        </div>
                        {/* Debt */}
                        <div>
                          <div className="flex justify-between text-slate-300 mb-3 text-xs font-bold uppercase tracking-wider">
                            <span>⚠️ 负债率危机红线 (Strategic Debt Line)</span>
                            <span className="text-red-400 font-mono bg-red-500/10 px-2 py-0.5 rounded">{settings.strategicDebtThreshold || 40}%</span>
                          </div>
                          <input type="range" min="10" max="90" className="w-full accent-red-500 h-1.5 bg-black/40 rounded-lg appearance-none cursor-pointer" value={settings.strategicDebtThreshold || 40} onChange={e => setSettings({...settings, strategicDebtThreshold: parseInt(e.target.value)})} />
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Save Global Button for Non-Architecture Tabs */}
                <div className="mt-10 pt-6 border-t border-dash-subtle flex justify-end max-w-3xl">
                  <button onClick={handleSaveGlobal} className="px-6 py-2.5 bg-dash-primary hover:bg-white text-black rounded-xl font-bold flex items-center gap-2 shadow-lg tracking-wide transition-colors">
                    <Save className="w-4 h-4" /> 写入系统全局生态
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
