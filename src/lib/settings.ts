export interface LongbridgeAccount {
  id: string;
  name: string;
  appKey: string;
  appSecret: string;
  accessToken: string;
}

export interface PublicAppSettings {
  provider: 'gemini' | 'openai';
  geminiFastModel: string;
  geminiAdvancedModel: string;
  openaiFastModel: string;
  openaiAdvancedModel: string;
  intentModel?: string;
  orchestratorModel?: string;
  sentinelModel?: string;
  agentPrompts?: Record<string, string>;
  ragSchema?: string;
  sentinelCooldown?: number;
  heartbeatInterval?: number;
  liquidityBufferMonths?: number;
  strategicDebtThreshold?: number;
}

export interface SecretAppSettings {
  geminiKey: string;
  openaiKey: string;
  longbridgeAppKey?: string;
  longbridgeAppSecret?: string;
  longbridgeKey?: string;
  longbridgeAccounts?: LongbridgeAccount[];
}

export interface AppSettings extends PublicAppSettings, SecretAppSettings {}

export const defaultSettings: AppSettings = {
  provider: 'gemini',
  geminiKey: '',
  openaiKey: '',
  longbridgeAppKey: '',
  longbridgeAppSecret: '',
  longbridgeKey: '',
  longbridgeAccounts: [],
  geminiFastModel: 'gemini-3-flash-preview',
  geminiAdvancedModel: 'gemini-3.1-pro-preview',
  openaiFastModel: 'gpt-4o-mini',
  openaiAdvancedModel: 'gpt-4o',
  agentPrompts: {},
  ragSchema: '',
  intentModel: 'gemini-2.5-flash',
  orchestratorModel: 'gemini-2.5-pro',
  sentinelModel: 'gemini-2.5-flash',
  sentinelCooldown: 60,
  heartbeatInterval: 180,
  liquidityBufferMonths: 6,
  strategicDebtThreshold: 40,
};

export const getPublicSettings = (): PublicAppSettings => {
  if (typeof window === 'undefined') return defaultSettings;
  const storedPub = localStorage.getItem('arbitra_public_settings');
  if (storedPub) {
    try {
      return { ...defaultSettings, ...JSON.parse(storedPub) };
    } catch {}
  }
  // Fallback to legacy full settings
  const storedFull = localStorage.getItem('arbitra_app_settings');
  if (storedFull) {
    try {
      const full = JSON.parse(storedFull);
      return {
        provider: full.provider ?? defaultSettings.provider,
        geminiFastModel: full.geminiFastModel ?? defaultSettings.geminiFastModel,
        geminiAdvancedModel: full.geminiAdvancedModel ?? defaultSettings.geminiAdvancedModel,
        openaiFastModel: full.openaiFastModel ?? defaultSettings.openaiFastModel,
        openaiAdvancedModel: full.openaiAdvancedModel ?? defaultSettings.openaiAdvancedModel,
        intentModel: full.intentModel ?? defaultSettings.intentModel,
        orchestratorModel: full.orchestratorModel ?? defaultSettings.orchestratorModel,
        sentinelModel: full.sentinelModel ?? defaultSettings.sentinelModel,
        agentPrompts: full.agentPrompts ?? defaultSettings.agentPrompts,
        ragSchema: full.ragSchema ?? defaultSettings.ragSchema,
        sentinelCooldown: full.sentinelCooldown ?? defaultSettings.sentinelCooldown,
        heartbeatInterval: full.heartbeatInterval ?? defaultSettings.heartbeatInterval,
        liquidityBufferMonths: full.liquidityBufferMonths ?? defaultSettings.liquidityBufferMonths,
        strategicDebtThreshold: full.strategicDebtThreshold ?? defaultSettings.strategicDebtThreshold,
      };
    } catch {}
  }
  return defaultSettings;
};

export const savePublicSettings = (settings: PublicAppSettings) => {
  if (typeof window !== 'undefined') {
    const pubToSave: PublicAppSettings = {
      provider: settings.provider,
      geminiFastModel: settings.geminiFastModel,
      geminiAdvancedModel: settings.geminiAdvancedModel,
      openaiFastModel: settings.openaiFastModel,
      openaiAdvancedModel: settings.openaiAdvancedModel,
      intentModel: settings.intentModel,
      orchestratorModel: settings.orchestratorModel,
      sentinelModel: settings.sentinelModel,
      agentPrompts: settings.agentPrompts,
      ragSchema: settings.ragSchema,
      sentinelCooldown: settings.sentinelCooldown,
      heartbeatInterval: settings.heartbeatInterval,
      liquidityBufferMonths: settings.liquidityBufferMonths,
      strategicDebtThreshold: settings.strategicDebtThreshold,
    };
    localStorage.setItem('arbitra_public_settings', JSON.stringify(pubToSave));
    
    // Also save key to full settings to guarantee compatibility of legacy getSettings readers
    try {
      const fullStored = localStorage.getItem('arbitra_app_settings');
      const baseObj = fullStored ? JSON.parse(fullStored) : {};
      localStorage.setItem('arbitra_app_settings', JSON.stringify({ ...baseObj, ...pubToSave }));
    } catch {}
  }
};

export const getSecretSettingsUnsafe = (): SecretAppSettings => {
  const defaultSecret: SecretAppSettings = {
    geminiKey: defaultSettings.geminiKey,
    openaiKey: defaultSettings.openaiKey,
    longbridgeAppKey: defaultSettings.longbridgeAppKey,
    longbridgeAppSecret: defaultSettings.longbridgeAppSecret,
    longbridgeKey: defaultSettings.longbridgeKey,
    longbridgeAccounts: defaultSettings.longbridgeAccounts,
  };
  if (typeof window === 'undefined') return defaultSecret;
  const storedSec = localStorage.getItem('arbitra_secret_settings');
  if (storedSec) {
    try {
      return { ...defaultSecret, ...JSON.parse(storedSec) };
    } catch {}
  }
  // Fallback to legacy full settings
  const storedFull = localStorage.getItem('arbitra_app_settings');
  if (storedFull) {
    try {
      const full = JSON.parse(storedFull);
      return {
        geminiKey: full.geminiKey ?? defaultSecret.geminiKey,
        openaiKey: full.openaiKey ?? defaultSecret.openaiKey,
        longbridgeAppKey: full.longbridgeAppKey ?? defaultSecret.longbridgeAppKey,
        longbridgeAppSecret: full.longbridgeAppSecret ?? defaultSecret.longbridgeAppSecret,
        longbridgeKey: full.longbridgeKey ?? defaultSecret.longbridgeKey,
        longbridgeAccounts: full.longbridgeAccounts ?? defaultSecret.longbridgeAccounts,
      };
    } catch {}
  }
  // migrate legacy key
  const legacyKey = localStorage.getItem('custom_gemini_api_key');
  if (legacyKey) {
    return { ...defaultSecret, geminiKey: legacyKey };
  }
  return defaultSecret;
};

export const saveSecretSettingsUnsafe = (settings: SecretAppSettings) => {
  if (typeof window !== 'undefined') {
    const secToSave: SecretAppSettings = {
      geminiKey: settings.geminiKey,
      openaiKey: settings.openaiKey,
      longbridgeAppKey: settings.longbridgeAppKey,
      longbridgeAppSecret: settings.longbridgeAppSecret,
      longbridgeKey: settings.longbridgeKey,
      longbridgeAccounts: settings.longbridgeAccounts,
    };
    localStorage.setItem('arbitra_secret_settings', JSON.stringify(secToSave));
    
    // sync back legacy key so we don't break simple reads if any
    if (settings.geminiKey) {
        localStorage.setItem('custom_gemini_api_key', settings.geminiKey);
    } else {
        localStorage.removeItem('custom_gemini_api_key');
    }

    // Also save key to full settings to guarantee compatibility of legacy getSettings readers
    try {
      const fullStored = localStorage.getItem('arbitra_app_settings');
      const baseObj = fullStored ? JSON.parse(fullStored) : {};
      localStorage.setItem('arbitra_app_settings', JSON.stringify({ ...baseObj, ...secToSave }));
    } catch {}
  }
};

/** @deprecated Use getPublicSettings and getSecretSettingsUnsafe instead */
export const getSettings = (): AppSettings => {
  const pub = getPublicSettings();
  const sec = getSecretSettingsUnsafe();
  return { ...defaultSettings, ...pub, ...sec };
};

/** @deprecated Use savePublicSettings and saveSecretSettingsUnsafe instead */
export const saveSettings = (settings: AppSettings) => {
  savePublicSettings(settings);
  saveSecretSettingsUnsafe(settings);
};
