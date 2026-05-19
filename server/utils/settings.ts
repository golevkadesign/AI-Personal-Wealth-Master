type Provider = 'gemini' | 'openai';

const ALLOWED_PROVIDERS = new Set<Provider>(['gemini', 'openai']);
const MODEL_FIELD_NAMES = [
  'geminiFastModel',
  'geminiAdvancedModel',
  'openaiFastModel',
  'openaiAdvancedModel',
  'intentModel',
  'orchestratorModel',
  'sentinelModel',
] as const;

const NUMERIC_FIELD_NAMES = [
  'sentinelCooldown',
  'heartbeatInterval',
  'liquidityBufferMonths',
  'strategicDebtThreshold',
] as const;

function copyStringField(target: Record<string, any>, source: any, key: string) {
  if (typeof source?.[key] === 'string' && source[key].trim()) {
    target[key] = source[key].trim();
  }
}

function copyNumberField(target: Record<string, any>, source: any, key: string) {
  const raw = source?.[key];
  if (typeof raw === 'number' && Number.isFinite(raw)) {
    target[key] = raw;
  }
}

function normalizeLongbridgeAccounts(accounts: any) {
  if (!Array.isArray(accounts)) return undefined;

  return accounts
    .filter(account => account && typeof account === 'object')
    .map(account => ({
      id: typeof account.id === 'string' ? account.id : '',
      name: typeof account.name === 'string' ? account.name : '',
      appKey: typeof account.appKey === 'string' ? account.appKey : '',
      appSecret: typeof account.appSecret === 'string' ? account.appSecret : '',
      accessToken: typeof account.accessToken === 'string' ? account.accessToken : '',
    }))
    .filter(account => account.appKey || account.appSecret || account.accessToken);
}

export function resolveRequestSettings(rawSettings: any = {}, customApiKey?: unknown) {
  const settings: Record<string, any> = {};

  if (ALLOWED_PROVIDERS.has(rawSettings?.provider)) {
    settings.provider = rawSettings.provider;
  }

  MODEL_FIELD_NAMES.forEach(key => copyStringField(settings, rawSettings, key));
  NUMERIC_FIELD_NAMES.forEach(key => copyNumberField(settings, rawSettings, key));

  if (rawSettings?.agentPrompts && typeof rawSettings.agentPrompts === 'object' && !Array.isArray(rawSettings.agentPrompts)) {
    settings.agentPrompts = rawSettings.agentPrompts;
  }

  copyStringField(settings, rawSettings, 'ragSchema');

  // Compatibility bridge: today the legacy frontend still submits provider API keys.
  // Keep that behavior centralized here so a later server-side secret store can replace it cleanly.
  copyStringField(settings, rawSettings, 'geminiKey');
  copyStringField(settings, rawSettings, 'openaiKey');
  copyStringField(settings, rawSettings, 'longbridgeAppKey');
  copyStringField(settings, rawSettings, 'longbridgeAppSecret');
  copyStringField(settings, rawSettings, 'longbridgeKey');

  const accounts = normalizeLongbridgeAccounts(rawSettings?.longbridgeAccounts);
  if (accounts) {
    settings.longbridgeAccounts = accounts;
  }

  if (typeof customApiKey === 'string' && customApiKey.trim()) {
    const key = customApiKey.trim();
    if (!settings.geminiKey && settings.provider === 'gemini') {
      settings.geminiKey = key;
    } else if (!settings.openaiKey && settings.provider === 'openai') {
      settings.openaiKey = key;
    } else if (!settings.provider) {
      settings.geminiKey = key;
    }
  }

  return settings;
}
