import React, { useState, useEffect } from 'react';
import { X, Settings, Loader2, RefreshCw, Wallet, Cpu, LineChart, Shield, CheckCircle2, AlertTriangle } from 'lucide-react';
import { getSettings, saveSettings as persistSettings, AppSettings } from '../lib/settings';
import { useTranslation } from '../hooks/useTranslation';

function buildModelOptions(currentValue: string | undefined, defaults: string[], available: string[]): string[] {
  const result: string[] = [];
  const trimmedVal = currentValue?.trim();
  if (trimmedVal) {
    result.push(trimmedVal);
  }
  defaults.forEach(d => {
    const trimmed = d?.trim();
    if (trimmed) result.push(trimmed);
  });
  available.forEach(a => {
    const trimmed = a?.trim();
    if (trimmed) result.push(trimmed);
  });
  return Array.from(new Set(result));
}

function getModelLabel(m: string, currentValue: string | undefined, defaultModel: string): string {
  if (m === currentValue) {
    return `${m} (当前)`;
  }
  if (m === defaultModel) {
    return `${m} (默认可选)`;
  }
  return m;
}

export const SettingsModal = ({ isOpen, onClose, onClearData }: { isOpen: boolean, onClose: () => void, onClearData?: () => void }) => {
  const { t } = useTranslation();
  const [settings, setSettings] = useState<AppSettings>(getSettings());
  const [availableGeminiModels, setAvailableGeminiModels] = useState<string[]>([
    'gemini-3.1-pro-preview',
    'gemini-3-flash-preview',
    'gemini-2.5-pro',
    'gemini-2.5-flash',
    'gemini-1.5-pro',
    'gemini-1.5-flash'
  ]);
  const [availableOpenAIModels, setAvailableOpenAIModels] = useState<string[]>([
    'gpt-4o',
    'gpt-4o-mini',
    'o3-mini',
    'o1-preview',
    'o1-mini',
    'gpt-4-turbo'
  ]);
  const [isLoadingGeminiModels, setIsLoadingGeminiModels] = useState(false);
  const [isLoadingOpenAIModels, setIsLoadingOpenAIModels] = useState(false);
  const [activeTab, setActiveTab] = useState<'ai' | 'finance' | 'wallet' | 'security'>('ai');
  const [showSavedToast, setShowSavedToast] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setSettings(getSettings());
    }
  }, [isOpen]);

  const handleSave = () => {
    const normalizedSettings = { ...settings };
    
    // Trim all model fields safely
    normalizedSettings.geminiFastModel = (normalizedSettings.geminiFastModel || '').trim();
    normalizedSettings.geminiAdvancedModel = (normalizedSettings.geminiAdvancedModel || '').trim();
    normalizedSettings.openaiFastModel = (normalizedSettings.openaiFastModel || '').trim();
    normalizedSettings.openaiAdvancedModel = (normalizedSettings.openaiAdvancedModel || '').trim();

    // Fallback if empty
    if (normalizedSettings.provider === 'gemini') {
      if (!normalizedSettings.geminiFastModel) {
        normalizedSettings.geminiFastModel = 'gemini-3-flash-preview';
      }
      if (!normalizedSettings.geminiAdvancedModel) {
        normalizedSettings.geminiAdvancedModel = 'gemini-3.1-pro-preview';
      }
    } else if (normalizedSettings.provider === 'openai') {
      if (!normalizedSettings.openaiFastModel) {
        normalizedSettings.openaiFastModel = 'gpt-4o-mini';
      }
      if (!normalizedSettings.openaiAdvancedModel) {
        normalizedSettings.openaiAdvancedModel = 'gpt-4o';
      }
    }

    persistSettings(normalizedSettings);

    // Development only console.debug post-save check to ensure state was saved successfully
    if (process.env.NODE_ENV !== 'production') {
      const saved = getSettings();
      console.debug("[SettingsSave] Saved provider/models verification:", {
        provider: saved.provider,
        geminiFastModel: saved.geminiFastModel,
        geminiAdvancedModel: saved.geminiAdvancedModel,
        openaiFastModel: saved.openaiFastModel,
        openaiAdvancedModel: saved.openaiAdvancedModel
      });
    }

    setShowSavedToast(true);
    setTimeout(() => {
      onClose();
      window.location.reload(); // Reload to apply cleanly
    }, 600);
  };

  const fetchGeminiModels = async () => {
    const key = settings.geminiKey;
    if (!key) {
      alert("请先输入 Gemini API Key");
      return;
    }
    if (key.includes('•') || key.includes('*') || key === 'placeholder') {
      alert("当前的 Key 为加密占位符或掩码。如果您正在使用系统托管或默认的 API Key，无需主动从官方拉取模型列表，您可以直接在下拉菜单中进行选择。");
      return;
    }
    setIsLoadingGeminiModels(true);
    try {
      const trimmedKey = key.trim();
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${trimmedKey}`);
      if (!res.ok) {
        let errText = await res.text();
        try {
          const parsed = JSON.parse(errText);
          if (parsed.error && parsed.error.message) {
            errText = parsed.error.message;
          }
        } catch {}
        throw new Error(errText);
      }
      const data = await res.json();
      const models = data.models.map((m: any) => m.name.replace('models/', '')).filter((m: string) => m.includes('gemini'));
      setAvailableGeminiModels(prev => Array.from(new Set([...models, ...prev])));
    } catch (e: any) {
      alert("拉取 Gemini 模型失败: " + e.message);
    } finally {
      setIsLoadingGeminiModels(false);
    }
  };

  const fetchOpenAIModels = async () => {
    const key = settings.openaiKey;
    if (!key) {
      alert("请先输入 OpenAI API Key");
      return;
    }
    if (key.includes('•') || key.includes('*') || key === 'placeholder') {
      alert("当前的 Key 为加密占位符或掩码。如果您正在使用系统托管或默认的 API Key，无需主动从官方拉取模型列表，您可以直接在下拉菜单中进行选择。");
      return;
    }
    setIsLoadingOpenAIModels(true);
    try {
      const trimmedKey = key.trim();
      const res = await fetch(`https://api.openai.com/v1/models`, {
        headers: { 'Authorization': `Bearer ${trimmedKey}` }
      });
      if (!res.ok) {
        let errText = await res.text();
        try {
          const parsed = JSON.parse(errText);
          if (parsed.error && parsed.error.message) {
            errText = parsed.error.message;
          }
        } catch {}
        throw new Error(errText);
      }
      const data = await res.json();
      const models = data.data.map((m: any) => m.id).filter((m: string) => m.includes('gpt') || m.includes('o1') || m.includes('o3'));
      setAvailableOpenAIModels(prev => Array.from(new Set([...models, ...prev])));
    } catch (e: any) {
      alert("拉取 OpenAI 模型失败: " + e.message);
    } finally {
      setIsLoadingOpenAIModels(false);
    }
  };

  if (!isOpen) return null;

  const NavItem = ({ id, icon: Icon, label }: { id: typeof activeTab, icon: any, label: string }) => {
    const isActive = activeTab === id;
    return (
      <button
        onClick={() => setActiveTab(id)}
        className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-[13px] font-medium transition-all ${
          isActive 
            ? 'bg-[#C9B284]/10 border border-[#C9B284]/30 text-[#E7D7B0]' 
            : 'text-[#8C8370] hover:bg-[#C9B284]/5 hover:text-[#C9B284]'
        }`}
      >
        <Icon className="w-4 h-4" />
        {label}
      </button>
    );
  };

  return (
    <div className="fixed inset-0 bg-[#05070A]/80 backdrop-blur-md z-50 flex justify-center items-center p-4">
      <div className="bg-[#0B0F19]/95 border border-[#C9B284]/20 rounded-2xl w-full max-w-4xl h-[70vh] min-h-[500px] flex flex-col shadow-[0_0_80px_rgba(0,0,0,0.6)] font-sans animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="px-6 py-5 border-b border-[#C9B284]/10 flex justify-between items-center shrink-0">
          <h2 className="text-[16px] font-bold flex items-center gap-2.5 text-[#E7D7B0] tracking-wide">
            <Settings className="w-4 h-4 text-[#C9B284]" /> 设置 / Settings
          </h2>
          <button onClick={onClose} aria-label="关闭设置" className="text-[#8C8370] hover:text-[#C9B284] transition-colors p-1 rounded-md hover:bg-[#C9B284]/10">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Area */}
        <div className="flex flex-1 overflow-hidden">
          
          {/* Left Nav */}
          <div className="w-56 border-r border-[#C9B284]/10 p-4 space-y-2 shrink-0 bg-black/20">
            <NavItem id="ai" icon={Cpu} label={t('settings.aiModel')} />
            <NavItem id="finance" icon={LineChart} label={t('settings.financeData')} />
            <NavItem id="wallet" icon={Wallet} label={t('settings.walletAccount')} />
            <NavItem id="security" icon={Shield} label={t('settings.security')} />
          </div>

          {/* Right Panel */}
          <div className="flex-1 p-8 overflow-y-auto custom-scroll space-y-8 bg-black/10">
            
            {activeTab === 'ai' && (
              <div className="space-y-6 animate-in fade-in duration-300">
                <h3 className="text-sm font-bold text-[#C9B284] uppercase tracking-wider border-b border-[#C9B284]/10 pb-3">{t('settings.apiModelSettings')}</h3>
                
                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-2 col-span-2">
                    <label className="text-[11px] text-[#8C8370] font-mono uppercase">{t('settings.aiProvider')}</label>
                    <select 
                      value={settings.provider}
                      onChange={(e) => setSettings({...settings, provider: e.target.value as 'gemini' | 'openai'})}
                      className="w-full bg-[#121419] border border-[#1A1D20] text-[#E7D7B0] text-[13px] rounded-lg px-3 py-2.5 focus:outline-none focus:border-[#C9B284]/50 transition-colors"
                    >
                      <option value="gemini">Google Gemini</option>
                      <option value="openai">OpenAI (ChatGPT)</option>
                    </select>
                  </div>
                  
                  {/* Fast Model Selection */}
                  <div className="space-y-2 col-span-2 md:col-span-1">
                    <div className="flex justify-between items-center">
                      <label className="text-[11px] text-[#8C8370] font-mono uppercase">{t('settings.modelFast')}</label>
                      <button 
                         onClick={settings.provider === 'gemini' ? fetchGeminiModels : fetchOpenAIModels}
                         disabled={settings.provider === 'gemini' ? isLoadingGeminiModels : isLoadingOpenAIModels}
                         className="text-[10px] text-[#C9B284] flex items-center gap-1 hover:text-[#E7D7B0] disabled:opacity-50"
                      >
                         {((settings.provider === 'gemini' && isLoadingGeminiModels) || (settings.provider === 'openai' && isLoadingOpenAIModels)) ? <Loader2 className="w-3 h-3 animate-spin"/> : <RefreshCw className="w-3 h-3"/>}
                         {t('settings.refresh')}
                      </button>
                    </div>
                    {settings.provider === 'gemini' ? (
                      <select 
                        value={settings.geminiFastModel}
                        onChange={(e) => setSettings({...settings, geminiFastModel: e.target.value})}
                        className="w-full bg-[#121419] border border-[#1A1D20] text-[#E7D7B0] text-[13px] rounded-lg px-3 py-2.5 focus:outline-none focus:border-[#C9B284]/50 transition-colors font-mono"
                      >
                        {buildModelOptions(settings.geminiFastModel, ['gemini-3-flash-preview', 'gemini-2.5-flash'], availableGeminiModels).map(m => (
                          <option key={m} value={m}>
                            {getModelLabel(m, settings.geminiFastModel, 'gemini-3-flash-preview')}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <select 
                        value={settings.openaiFastModel}
                        onChange={(e) => setSettings({...settings, openaiFastModel: e.target.value})}
                        className="w-full bg-[#121419] border border-[#1A1D20] text-[#E7D7B0] text-[13px] rounded-lg px-3 py-2.5 focus:outline-none focus:border-[#C9B284]/50 transition-colors font-mono"
                      >
                        {buildModelOptions(settings.openaiFastModel, ['gpt-4o-mini', 'gpt-3.5-turbo'], availableOpenAIModels).map(m => (
                          <option key={m} value={m}>
                            {getModelLabel(m, settings.openaiFastModel, 'gpt-4o-mini')}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>

                  {/* Advanced Model Selection */}
                  <div className="space-y-2 col-span-2 md:col-span-1">
                    <label className="text-[11px] text-[#8C8370] font-mono uppercase">{t('settings.modelAdvanced')}</label>
                    {settings.provider === 'gemini' ? (
                      <select 
                        value={settings.geminiAdvancedModel}
                        onChange={(e) => setSettings({...settings, geminiAdvancedModel: e.target.value})}
                        className="w-full bg-[#121419] border border-[#1A1D20] text-[#E7D7B0] text-[13px] rounded-lg px-3 py-2.5 focus:outline-none focus:border-[#C9B284]/50 transition-colors font-mono"
                      >
                        {buildModelOptions(settings.geminiAdvancedModel, ['gemini-3.1-pro-preview', 'gemini-2.5-pro'], availableGeminiModels).map(m => (
                          <option key={m} value={m}>
                            {getModelLabel(m, settings.geminiAdvancedModel, 'gemini-3.1-pro-preview')}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <select 
                        value={settings.openaiAdvancedModel}
                        onChange={(e) => setSettings({...settings, openaiAdvancedModel: e.target.value})}
                        className="w-full bg-[#121419] border border-[#1A1D20] text-[#E7D7B0] text-[13px] rounded-lg px-3 py-2.5 focus:outline-none focus:border-[#C9B284]/50 transition-colors font-mono"
                      >
                        {buildModelOptions(settings.openaiAdvancedModel, ['gpt-4o', 'o3-mini', 'o1-preview'], availableOpenAIModels).map(m => (
                          <option key={m} value={m}>
                            {getModelLabel(m, settings.openaiAdvancedModel, 'gpt-4o')}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                   <div className="flex items-center justify-between">
                     <label className="text-[11px] text-[#8C8370] font-mono uppercase">{t('settings.apiKey')}</label>
                     <span className="text-[9px] text-[#C9B284]/70 font-sans px-2 border border-[#C9B284]/20 rounded-md">
                       {t('settings.apiCredentialWarning')}
                     </span>
                   </div>
                   <input
                      type="password"
                      value={settings.provider === 'gemini' ? settings.geminiKey : settings.openaiKey}
                      onChange={(e) => {
                        if (settings.provider === 'gemini') {
                          setSettings({...settings, geminiKey: e.target.value});
                        } else {
                          setSettings({...settings, openaiKey: e.target.value});
                        }
                      }}
                      placeholder={settings.provider === 'gemini' ? "AIzaSy..." : "sk-..."}
                      className="w-full bg-[#121419] border border-[#1A1D20] rounded-lg px-4 py-2.5 text-[13px] text-[#E7D7B0] focus:outline-none focus:border-[#C9B284]/50 font-mono transition-colors"
                   />
                </div>

                <div className="flex justify-between items-center text-[11px] font-mono pt-4 border-t border-[#1A1D20]">
                   <div className="flex flex-col gap-1">
                      <span className="text-[#8C8370] uppercase">{t('settings.connectionStatus')}</span>
                      <span className="flex items-center gap-1.5 text-emerald-400">
                         <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.5)] animate-pulse"></span>
                         {t('settings.connected')}
                      </span>
                   </div>
                   <div className="flex flex-col gap-1 text-right border-l border-[#1A1D20] pl-6">
                      <span className="text-[#8C8370] uppercase">{t('settings.lastUpdated')}</span>
                      <span className="text-slate-300 flex items-center gap-1"><RefreshCw className="w-3 h-3 text-[#C9B284]"/> 1 minute ago</span>
                   </div>
                </div>
              </div>
            )}

            {activeTab === 'finance' && (
              <div className="space-y-6 animate-in fade-in duration-300">
                <h3 className="text-sm font-bold text-[#C9B284] uppercase tracking-wider border-b border-[#C9B284]/10 pb-3">{t('settings.longbridgeSettings')}</h3>
                
                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-[11px] text-[#8C8370] font-mono uppercase">{t('settings.dataSource')}</label>
                    <select className="w-full bg-[#121419] border border-[#1A1D20] text-[#E7D7B0] text-[13px] rounded-lg px-3 py-2.5 focus:outline-none focus:border-[#C9B284]/50 transition-colors">
                      <option>LongBridge (Live)</option>
                      <option>Demo Market Data</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[11px] text-[#8C8370] font-mono uppercase">{t('settings.refreshInterval')}</label>
                    <select className="w-full bg-[#121419] border border-[#1A1D20] text-[#E7D7B0] text-[13px] rounded-lg px-3 py-2.5 focus:outline-none focus:border-[#C9B284]/50 transition-colors">
                      <option>15 minutes</option>
                      <option>1 hour</option>
                      <option>Real-time (Websocket)</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                   <h4 className="text-[12px] text-[#E7D7B0]">{t('settings.connectedAccounts')}</h4>
                   <button 
                     onClick={() => {
                       const newAcc = { id: Math.random().toString(36).substring(7), name: `长桥账户 ${settings.longbridgeAccounts?.length ? settings.longbridgeAccounts.length + 1 : 1}`, appKey: '', appSecret: '', accessToken: '' };
                       setSettings({ ...settings, longbridgeAccounts: [...(settings.longbridgeAccounts || []), newAcc] });
                     }}
                     className="text-[11px] text-[#C9B284] hover:text-[#E7D7B0] transition-colors flex items-center gap-1 border border-[#C9B284]/30 px-2 py-1 rounded hover:bg-[#C9B284]/10"
                   >
                     {t('settings.addAccount')}
                   </button>
                  </div>
                  
                  {(!settings.longbridgeAccounts || settings.longbridgeAccounts.length === 0) && (
                     <div className="p-6 border border-dashed border-[#1A1D20] rounded-xl flex flex-col items-center justify-center text-center gap-2 text-[#8C8370]">
                       <span className="text-xs uppercase tracking-widest font-mono">{t('settings.noAccounts')}</span>
                     </div>
                  )}

                  {settings.longbridgeAccounts?.map(acc => (
                     <div key={acc.id} className="bg-[#121419] border border-[#1A1D20] rounded-xl p-4 relative group">
                       <button onClick={() => setSettings({...settings, longbridgeAccounts: settings.longbridgeAccounts?.filter(a => a.id !== acc.id)})} className="absolute top-2 right-2 p-1.5 text-[#8C8370] hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"><X className="w-4 h-4"/></button>
                       <input type="text" placeholder="Account Name (e.g. Main Portfolio)" value={acc.name} onChange={e => { const newAccs = settings.longbridgeAccounts?.map(a => a.id === acc.id ? {...a, name: e.target.value} : a); setSettings({...settings, longbridgeAccounts: newAccs}); }} className="w-full bg-transparent text-[13px] font-bold text-[#E7D7B0] mb-3 focus:outline-none placeholder-[#8C8370]" />
                       <div className="space-y-2 grid grid-cols-2 gap-3 items-end">
                         <div className="space-y-1 col-span-2 sm:col-span-1">
                            <label className="text-[10px] text-[#8C8370] uppercase font-mono">App Key</label>
                            <input type="text" placeholder="Key" value={acc.appKey} onChange={e => { const newAccs = settings.longbridgeAccounts?.map(a => a.id === acc.id ? {...a, appKey: e.target.value} : a); setSettings({...settings, longbridgeAccounts: newAccs}); }} className="w-full bg-[#0B0D0F] border border-[#1A1D20] rounded p-2 text-xs text-slate-300 focus:border-[#C9B284]/50 focus:outline-none font-mono" />
                         </div>
                         <div className="space-y-1 col-span-2 sm:col-span-1">
                            <label className="text-[10px] text-[#8C8370] uppercase font-mono">App Secret</label>
                            <input type="password" placeholder="Secret" value={acc.appSecret} onChange={e => { const newAccs = settings.longbridgeAccounts?.map(a => a.id === acc.id ? {...a, appSecret: e.target.value} : a); setSettings({...settings, longbridgeAccounts: newAccs}); }} className="w-full bg-[#0B0D0F] border border-[#1A1D20] rounded p-2 text-xs text-slate-300 focus:border-[#C9B284]/50 focus:outline-none font-mono" />
                         </div>
                         <div className="space-y-1 col-span-2">
                            <label className="text-[10px] text-[#8C8370] uppercase font-mono">Access Token</label>
                            <input type="password" placeholder="Token" value={acc.accessToken} onChange={e => { const newAccs = settings.longbridgeAccounts?.map(a => a.id === acc.id ? {...a, accessToken: e.target.value} : a); setSettings({...settings, longbridgeAccounts: newAccs}); }} className="w-full bg-[#0B0D0F] border border-[#1A1D20] rounded p-2 text-xs text-slate-300 focus:border-[#C9B284]/50 focus:outline-none font-mono" />
                         </div>
                       </div>
                     </div>
                  ))}
                </div>

                <div className="flex justify-between items-center text-[11px] font-mono pt-4 border-t border-[#1A1D20]">
                   <div className="flex flex-col gap-1">
                      <span className="text-[#8C8370] uppercase">{t('settings.connectionStatus')}</span>
                      <span className="flex items-center gap-1.5 text-emerald-400">
                         <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.5)]"></span>
                         {t('settings.connected')}
                      </span>
                   </div>
                   <div className="flex flex-col gap-1 text-right border-l border-[#1A1D20] pl-6">
                      <span className="text-[#8C8370] uppercase">{t('settings.lastUpdated')}</span>
                      <span className="text-slate-300 flex items-center justify-end gap-1"><RefreshCw className="w-3 h-3 text-[#C9B284]"/> 2 minutes ago</span>
                   </div>
                </div>
              </div>
            )}

            {activeTab === 'wallet' && (
              <div className="space-y-6 animate-in fade-in duration-300">
                <h3 className="text-sm font-bold text-[#C9B284] uppercase tracking-wider border-b border-[#C9B284]/10 pb-3">{t('settings.walletSettings')}</h3>
                
                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-[11px] text-[#8C8370] font-mono uppercase">{t('settings.activeWallet')}</label>
                    <select className="w-full bg-[#121419] border border-[#1A1D20] text-[#E7D7B0] text-[13px] rounded-lg px-3 py-2.5 focus:outline-none focus:border-[#C9B284]/50 transition-colors">
                      <option>Arbitra Wallet</option>
                      <option>Local Account</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[11px] text-[#8C8370] font-mono uppercase">{t('settings.network')}</label>
                    <select className="w-full bg-[#121419] border border-[#1A1D20] text-[#E7D7B0] text-[13px] rounded-lg px-3 py-2.5 focus:outline-none focus:border-[#C9B284]/50 transition-colors">
                      <option>Ethereum Mainnet</option>
                      <option>Arbitrum One</option>
                      <option>Off-chain Sync</option>
                    </select>
                  </div>
                </div>
                
                <div className="p-4 bg-[#121419] border border-[#1A1D20] rounded-xl flex items-center justify-between">
                   <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#C9B284] to-[#8C8370] flex items-center justify-center p-0.5">
                         <div className="w-full h-full bg-[#0B0F19] rounded-full flex items-center justify-center">
                            <Wallet className="w-4 h-4 text-[#C9B284]" />
                         </div>
                      </div>
                      <div>
                         <div className="text-[13px] text-[#E7D7B0] font-medium">0x... (Not Configured)</div>
                         <div className="text-[11px] text-[#8C8370] font-mono mt-0.5">Placeholder Address</div>
                      </div>
                   </div>
                </div>

                <div className="flex justify-between items-center text-[11px] font-mono pt-4 border-t border-[#1A1D20]">
                   <div className="flex flex-col gap-1">
                      <span className="text-[#8C8370] uppercase">{t('settings.connectionStatus')}</span>
                      <span className="flex items-center gap-1.5 text-emerald-400">
                         <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.5)]"></span>
                         {t('settings.connected')}
                      </span>
                   </div>
                   <div className="flex flex-col gap-1 text-right border-l border-[#1A1D20] pl-6">
                      <span className="text-[#8C8370] uppercase">{t('settings.lastUpdated')}</span>
                      <span className="text-slate-300 flex items-center justify-end gap-1"><RefreshCw className="w-3 h-3 text-[#C9B284] animate-spin-slow"/> Just now</span>
                   </div>
                </div>
              </div>
            )}

            {activeTab === 'security' && (
              <div className="space-y-6 animate-in fade-in duration-300">
                <h3 className="text-sm font-bold text-[#C9B284] uppercase tracking-wider border-b border-[#C9B284]/10 pb-3">{t('settings.security')}</h3>
                <div className="p-6 border border-dashed border-[#1A1D20] rounded-xl flex flex-col items-center justify-center text-center gap-2 text-[#8C8370]">
                   <Shield className="w-6 h-6 mb-2 text-[#C9B284]/50" />
                   <span className="text-xs uppercase tracking-widest font-mono">{t('settings.authDisabled')}</span>
                </div>

                {onClearData && (
                  <div className="border border-red-950/40 bg-[#1A0B0B]/40 rounded-xl p-5 space-y-4">
                    <div className="flex items-start gap-3">
                      <AlertTriangle className="w-5 h-5 text-red-500/70 shrink-0 mt-0.5" />
                      <div className="space-y-1">
                        <h4 className="text-[13px] font-bold text-white tracking-wide">
                          重置工作区 / Reset Workspace
                        </h4>
                        <p className="text-[#8C8370] text-[11px] leading-relaxed">
                          清空资产状态、聊天历史、AI 分析缓存、画像数据，但保留 AI API Key 与券商账户 API Key；如需删除 Key，请在对应表单中手动清空。
                        </p>
                      </div>
                    </div>
                    <div className="flex justify-start">
                      <button
                        onClick={onClearData}
                        className="px-4 py-2 bg-red-900/10 hover:bg-red-900/20 border border-red-900/30 text-red-400 hover:text-red-300 text-xs font-mono uppercase tracking-wider rounded-lg transition-all cursor-pointer"
                      >
                        重置工作区
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Footer actions */}
        <div className="px-6 py-4 bg-[#0B0F19] border-t border-[#C9B284]/10 flex justify-between items-center shrink-0">
          <div className="flex-1">
             {showSavedToast && (
                <span className="text-[12px] text-emerald-400 flex items-center gap-1.5 animate-in fade-in">
                  <CheckCircle2 className="w-4 h-4" /> {t('settings.saveSuccess')}
                </span>
             )}
          </div>
          <div className="flex gap-4">
            <button 
              onClick={onClose} 
              className="px-5 py-2 text-[13px] font-medium text-[#8C8370] hover:text-[#E7D7B0] transition-colors"
            >
              {t('settings.cancel')}
            </button>
            <button 
              onClick={handleSave} 
              className="px-6 py-2 bg-[#C9B284]/10 border border-[#C9B284]/30 text-[#C9B284] text-[13px] font-bold rounded-lg hover:bg-[#C9B284] hover:text-[#05070A] transition-all flex items-center gap-2"
            >
              <Settings className="w-4 h-4" /> {t('settings.save')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

