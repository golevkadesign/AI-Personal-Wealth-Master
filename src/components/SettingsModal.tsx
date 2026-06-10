import React, { useEffect, useState } from 'react';
import { getSettings, saveSettings as persistSettings, AppSettings, LongbridgeAccount } from '../lib/settings';
import { useTranslation } from '../hooks/useTranslation';
import { MaterialIcon } from './ui/MaterialIcon';

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

function getModelLabel(m: string, currentValue: string | undefined, defaultModel: string, t: (key: string) => string): string {
  if (m === currentValue) {
    return `${m} (${t('settings.current')})`;
  }
  if (m === defaultModel) {
    return `${m} (${t('settings.defaultOption')})`;
  }
  return m;
}

type SettingsTab = 'ai' | 'finance' | 'wallet' | 'security';

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
  const [activeTab, setActiveTab] = useState<SettingsTab>('ai');
  const [showSavedToast, setShowSavedToast] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setSettings(getSettings());
    }
  }, [isOpen]);

  const handleSave = () => {
    const normalizedSettings = { ...settings };

    normalizedSettings.geminiFastModel = (normalizedSettings.geminiFastModel || '').trim();
    normalizedSettings.geminiAdvancedModel = (normalizedSettings.geminiAdvancedModel || '').trim();
    normalizedSettings.openaiFastModel = (normalizedSettings.openaiFastModel || '').trim();
    normalizedSettings.openaiAdvancedModel = (normalizedSettings.openaiAdvancedModel || '').trim();

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
      window.location.reload();
    }, 600);
  };

  const fetchGeminiModels = async () => {
    const key = settings.geminiKey;
    if (!key) {
      alert(t('settings.fetchGeminiFirst'));
      return;
    }
    if (key.includes('•') || key.includes('*') || key === 'placeholder') {
      alert(t('settings.maskedKeyHint'));
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
      alert(`${t('settings.fetchGeminiFailed')}: ${e.message}`);
    } finally {
      setIsLoadingGeminiModels(false);
    }
  };

  const fetchOpenAIModels = async () => {
    const key = settings.openaiKey;
    if (!key) {
      alert(t('settings.fetchOpenaiFirst'));
      return;
    }
    if (key.includes('•') || key.includes('*') || key === 'placeholder') {
      alert(t('settings.maskedKeyHint'));
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
      alert(`${t('settings.fetchOpenaiFailed')}: ${e.message}`);
    } finally {
      setIsLoadingOpenAIModels(false);
    }
  };

  if (!isOpen) return null;

  const isLoadingModels = (settings.provider === 'gemini' && isLoadingGeminiModels) || (settings.provider === 'openai' && isLoadingOpenAIModels);

  const updateAccount = (id: string, patch: Partial<LongbridgeAccount>) => {
    const newAccounts = settings.longbridgeAccounts?.map(account => account.id === id ? { ...account, ...patch } : account);
    setSettings({ ...settings, longbridgeAccounts: newAccounts });
  };

  const addLongbridgeAccount = () => {
    const newAcc = {
      id: Math.random().toString(36).substring(7),
      name: `${t('settings.defaultLongbridgeAccount')} ${settings.longbridgeAccounts?.length ? settings.longbridgeAccounts.length + 1 : 1}`,
      appKey: '',
      appSecret: '',
      accessToken: ''
    };
    setSettings({ ...settings, longbridgeAccounts: [...(settings.longbridgeAccounts || []), newAcc] });
  };

  const NavItem = ({ id, icon, label }: { id: SettingsTab, icon: string, label: string }) => {
    const isActive = activeTab === id;
    return (
      <button
        type="button"
        onClick={() => setActiveTab(id)}
        className={`aw-settings-tab cursor-pointer ${isActive ? 'aw-settings-tab-active' : ''}`}
      >
        <MaterialIcon name={icon} size={20} />
        <span>{label}</span>
      </button>
    );
  };

  const Field = ({ label, children }: { label: string, children: React.ReactNode }) => (
    <div className="space-y-2">
      <label className="aw-form-label">{label}</label>
      {children}
    </div>
  );

  const Select = ({ value, onChange, children, className = '' }: any) => (
    <select value={value} onChange={onChange} className={`aw-form-input ${className}`}>
      {children}
    </select>
  );

  const Input = ({ value, onChange, placeholder, type = 'text', className = '' }: any) => (
    <input
      type={type}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      className={`aw-form-input ${className}`}
    />
  );

  const SectionTitle = ({ children }: { children: React.ReactNode }) => (
    <h3 className="aw-section-kicker mb-4">{children}</h3>
  );

  const StatusLine = ({ minutes = '1 minute ago' }: { minutes?: string }) => (
    <div className="flex items-center justify-between gap-6 border-t border-aw-border-subtle pt-4 font-mono">
      <div className="flex flex-col gap-1">
        <span className="aw-caption aw-text-tertiary uppercase">{t('settings.connectionStatus')}</span>
        <span className="aw-caption flex items-center gap-2 text-aw-success">
          <span className="aw-status-dot aw-status-success" />
          {t('settings.connected')}
        </span>
      </div>
      <div className="flex flex-col gap-1 border-l border-aw-border-subtle pl-6 text-right">
        <span className="aw-caption aw-text-tertiary uppercase">{t('settings.lastUpdated')}</span>
        <span className="aw-caption aw-text-secondary flex items-center justify-end gap-1">
          <MaterialIcon name="refresh" size={16} className="text-aw-accent-mist" />
          {minutes}
        </span>
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="aw-modal-backdrop absolute inset-0" />
      <div className="aw-modal-shell aw-settings-shell relative flex flex-col overflow-hidden font-sans animate-in fade-in zoom-in-95 duration-200">
        <header className="aw-modal-header flex shrink-0 items-center justify-between gap-4 border-b px-6 py-5">
          <h2 className="aw-label aw-text-primary flex items-center gap-3 font-bold">
            <MaterialIcon name="settings" size={20} className="text-aw-accent-mist" />
            {t('settings.title')}
          </h2>
          <button type="button" onClick={onClose} aria-label={t('settings.closeSettings')} className="aw-icon-button cursor-pointer">
            <MaterialIcon name="close" size={24} />
          </button>
        </header>

        <div className="flex min-h-0 flex-1 overflow-hidden">
          <aside className="w-56 shrink-0 space-y-2 border-r border-aw-border-subtle bg-aw-surface-3 p-4">
            <NavItem id="ai" icon="memory" label={t('settings.aiModel')} />
            <NavItem id="finance" icon="monitoring" label={t('settings.financeData')} />
            <NavItem id="wallet" icon="account_balance_wallet" label={t('settings.walletAccount')} />
            <NavItem id="security" icon="shield_lock" label={t('settings.security')} />
          </aside>

          <main className="flex-1 space-y-8 overflow-y-auto p-8 custom-scroll">
            {activeTab === 'ai' && (
              <div className="space-y-6 animate-in fade-in duration-300">
                <SectionTitle>{t('settings.apiModelSettings')}</SectionTitle>

                <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                  <Field label={t('settings.aiProvider')}>
                    <Select
                      value={settings.provider}
                      onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setSettings({ ...settings, provider: e.target.value as 'gemini' | 'openai' })}
                    >
                      <option value="gemini">Google Gemini</option>
                      <option value="openai">OpenAI</option>
                    </Select>
                  </Field>

                  <div className="flex items-end justify-start md:justify-end">
                    <button
                      type="button"
                      onClick={settings.provider === 'gemini' ? fetchGeminiModels : fetchOpenAIModels}
                      disabled={isLoadingModels}
                      className="aw-button aw-button-ghost cursor-pointer disabled:cursor-wait disabled:opacity-60"
                    >
                      <MaterialIcon name="refresh" size={16} className={isLoadingModels ? 'animate-spin' : ''} />
                      {t('settings.refresh')}
                    </button>
                  </div>

                  <Field label={t('settings.modelFast')}>
                    {settings.provider === 'gemini' ? (
                      <Select
                        value={settings.geminiFastModel}
                        onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setSettings({ ...settings, geminiFastModel: e.target.value })}
                        className="font-mono"
                      >
                        {buildModelOptions(settings.geminiFastModel, ['gemini-3-flash-preview', 'gemini-2.5-flash'], availableGeminiModels).map(model => (
                          <option key={model} value={model}>{getModelLabel(model, settings.geminiFastModel, 'gemini-3-flash-preview', t)}</option>
                        ))}
                      </Select>
                    ) : (
                      <Select
                        value={settings.openaiFastModel}
                        onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setSettings({ ...settings, openaiFastModel: e.target.value })}
                        className="font-mono"
                      >
                        {buildModelOptions(settings.openaiFastModel, ['gpt-4o-mini', 'gpt-3.5-turbo'], availableOpenAIModels).map(model => (
                          <option key={model} value={model}>{getModelLabel(model, settings.openaiFastModel, 'gpt-4o-mini', t)}</option>
                        ))}
                      </Select>
                    )}
                  </Field>

                  <Field label={t('settings.modelAdvanced')}>
                    {settings.provider === 'gemini' ? (
                      <Select
                        value={settings.geminiAdvancedModel}
                        onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setSettings({ ...settings, geminiAdvancedModel: e.target.value })}
                        className="font-mono"
                      >
                        {buildModelOptions(settings.geminiAdvancedModel, ['gemini-3.1-pro-preview', 'gemini-2.5-pro'], availableGeminiModels).map(model => (
                          <option key={model} value={model}>{getModelLabel(model, settings.geminiAdvancedModel, 'gemini-3.1-pro-preview', t)}</option>
                        ))}
                      </Select>
                    ) : (
                      <Select
                        value={settings.openaiAdvancedModel}
                        onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setSettings({ ...settings, openaiAdvancedModel: e.target.value })}
                        className="font-mono"
                      >
                        {buildModelOptions(settings.openaiAdvancedModel, ['gpt-4o', 'o3-mini', 'o1-preview'], availableOpenAIModels).map(model => (
                          <option key={model} value={model}>{getModelLabel(model, settings.openaiAdvancedModel, 'gpt-4o', t)}</option>
                        ))}
                      </Select>
                    )}
                  </Field>
                </div>

                <Field label={t('settings.apiKey')}>
                  <div className="mb-2 flex justify-end">
                    <span className="aw-status-pill font-mono">{t('settings.apiCredentialWarning')}</span>
                  </div>
                  <Input
                    type="password"
                    value={settings.provider === 'gemini' ? settings.geminiKey : settings.openaiKey}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                      if (settings.provider === 'gemini') {
                        setSettings({ ...settings, geminiKey: e.target.value });
                      } else {
                        setSettings({ ...settings, openaiKey: e.target.value });
                      }
                    }}
                    placeholder={settings.provider === 'gemini' ? "AIzaSy..." : "sk-..."}
                    className="font-mono"
                  />
                </Field>

                <StatusLine />
              </div>
            )}

            {activeTab === 'finance' && (
              <div className="space-y-6 animate-in fade-in duration-300">
                <SectionTitle>{t('settings.longbridgeSettings')}</SectionTitle>

                <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                  <Field label={t('settings.dataSource')}>
                    <Select>
                      <option>LongBridge (Live)</option>
                      <option>Demo Market Data</option>
                    </Select>
                  </Field>
                  <Field label={t('settings.refreshInterval')}>
                    <Select
                      value={settings.financeRefreshInterval || '15 minutes'}
                      onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setSettings({ ...settings, financeRefreshInterval: e.target.value })}
                    >
                      <option value="15 minutes">15 minutes</option>
                      <option value="1 hour">1 hour</option>
                      <option value="Real-time (Websocket)">Real-time (Websocket)</option>
                    </Select>
                  </Field>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between gap-4">
                    <h4 className="aw-body aw-text-primary font-semibold">{t('settings.connectedAccounts')}</h4>
                    <button type="button" onClick={addLongbridgeAccount} className="aw-button aw-button-ghost cursor-pointer">
                      <MaterialIcon name="add" size={16} />
                      {t('settings.addAccount')}
                    </button>
                  </div>

                  {(!settings.longbridgeAccounts || settings.longbridgeAccounts.length === 0) && (
                    <div className="aw-panel-muted flex items-center justify-center border-dashed p-6 text-center">
                      <span className="aw-caption aw-text-tertiary font-mono uppercase">{t('settings.noAccounts')}</span>
                    </div>
                  )}

                  {settings.longbridgeAccounts?.map(account => (
                    <div key={account.id} className="aw-panel-muted group relative p-4">
                      <button
                        type="button"
                        onClick={() => setSettings({ ...settings, longbridgeAccounts: settings.longbridgeAccounts?.filter(item => item.id !== account.id) })}
                        className="aw-icon-button absolute right-2 top-2 cursor-pointer opacity-0 group-hover:opacity-100"
                        aria-label={t('settings.deleteAccount')}
                      >
                        <MaterialIcon name="close" size={20} />
                      </button>
                      <Input
                        value={account.name}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateAccount(account.id, { name: e.target.value })}
                        placeholder={t('settings.accountName')}
                        className="mb-3 bg-transparent font-bold"
                      />
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <Field label="App Key">
                          <Input value={account.appKey} onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateAccount(account.id, { appKey: e.target.value })} placeholder="Key" className="font-mono" />
                        </Field>
                        <Field label="App Secret">
                          <Input type="password" value={account.appSecret} onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateAccount(account.id, { appSecret: e.target.value })} placeholder="Secret" className="font-mono" />
                        </Field>
                        <div className="sm:col-span-2">
                          <Field label="Access Token">
                            <Input type="password" value={account.accessToken} onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateAccount(account.id, { accessToken: e.target.value })} placeholder="Token" className="font-mono" />
                          </Field>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="space-y-4 border-t border-aw-border-subtle pt-6">
                  <div>
                    <h4 className="aw-section-kicker">{t('settings.marketDataKeys')}</h4>
                    <p className="aw-caption aw-text-tertiary mt-2">
                      {t('settings.marketDataKeysDesc')}
                    </p>
                  </div>
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <Field label="FRED API Key">
                      <Input
                        type="password"
                        placeholder={t('settings.optionalFredKey')}
                        value={settings.fredApiKey || ''}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSettings({ ...settings, fredApiKey: e.target.value })}
                        className="font-mono"
                      />
                    </Field>
                    <Field label="Alpha Vantage API Key">
                      <Input
                        type="password"
                        placeholder={t('settings.optionalAlphaKey')}
                        value={settings.alphaVantageApiKey || ''}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSettings({ ...settings, alphaVantageApiKey: e.target.value })}
                        className="font-mono"
                      />
                    </Field>
                  </div>
                </div>

                <StatusLine minutes="2 minutes ago" />
              </div>
            )}

            {activeTab === 'wallet' && (
              <div className="space-y-6 animate-in fade-in duration-300">
                <SectionTitle>{t('settings.walletSettings')}</SectionTitle>

                <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                  <Field label={t('settings.activeWallet')}>
                    <Select>
                      <option>Arbitra Wallet</option>
                      <option>Local Account</option>
                    </Select>
                  </Field>
                  <Field label={t('settings.network')}>
                    <Select>
                      <option>Ethereum Mainnet</option>
                      <option>Arbitrum One</option>
                      <option>Off-chain Sync</option>
                    </Select>
                  </Field>
                </div>

                <div className="aw-panel-muted flex items-center justify-between gap-4 p-4">
                  <div className="flex items-center gap-3">
                    <div className="aw-chart-state-icon h-10 w-10 shrink-0">
                      <MaterialIcon name="account_balance_wallet" size={20} className="text-aw-accent-mist" />
                    </div>
                    <div>
                      <div className="aw-body aw-text-primary font-medium">0x... (Not Configured)</div>
                      <div className="aw-caption aw-text-tertiary mt-1 font-mono">Placeholder Address</div>
                    </div>
                  </div>
                </div>

                <StatusLine minutes="Just now" />
              </div>
            )}

            {activeTab === 'security' && (
              <div className="space-y-6 animate-in fade-in duration-300">
                <SectionTitle>{t('settings.security')}</SectionTitle>
                <div className="aw-panel-muted flex flex-col items-center justify-center gap-3 border-dashed p-6 text-center">
                  <MaterialIcon name="shield_lock" size={32} className="aw-text-tertiary" />
                  <span className="aw-caption aw-text-tertiary font-mono uppercase">{t('settings.authDisabled')}</span>
                </div>

                {onClearData && (
                  <div className="aw-danger-panel space-y-4 p-5">
                    <div className="flex items-start gap-3">
                      <MaterialIcon name="warning" size={24} className="text-aw-danger shrink-0" />
                      <div className="space-y-2">
                        <h4 className="aw-body aw-text-primary font-bold">{t('settings.resetWorkspaceTitle')}</h4>
                        <p className="aw-caption aw-text-secondary">
                          {t('settings.resetWorkspaceDesc')}
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={onClearData}
                      className="aw-button cursor-pointer border border-aw-danger text-aw-danger hover:bg-aw-danger/10"
                    >
                      {t('settings.resetWorkspace')}
                    </button>
                  </div>
                )}
              </div>
            )}
          </main>
        </div>

        <footer className="aw-modal-footer flex shrink-0 items-center justify-between gap-4 border-t px-6 py-4">
          <div className="flex-1">
            {showSavedToast && (
              <span className="aw-body flex items-center gap-2 text-aw-success animate-in fade-in">
                <MaterialIcon name="check_circle" size={20} />
                {t('settings.saveSuccess')}
              </span>
            )}
          </div>
          <div className="flex gap-3">
            <button type="button" onClick={onClose} className="aw-button aw-button-ghost cursor-pointer">
              {t('settings.cancel')}
            </button>
            <button type="button" onClick={handleSave} className="aw-button aw-button-primary cursor-pointer">
              <MaterialIcon name="settings" size={20} />
              {t('settings.save')}
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
};
