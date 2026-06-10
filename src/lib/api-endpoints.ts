const DEFAULT_CLOUD_RUN_API_BASE = 'https://ai-wealth-master-api-ug5qtuehlq-de.a.run.app';

function normalizeBaseUrl(baseUrl: string) {
  return baseUrl.replace(/\/+$/, '');
}

function normalizePath(path: string) {
  return path.startsWith('/') ? path : `/${path}`;
}

function shouldBypassHostingProxyForStreaming() {
  if (typeof window === 'undefined') return false;
  const host = window.location.hostname;
  return host.endsWith('.web.app') || host.endsWith('.firebaseapp.com');
}

export function getApiEndpoint(path: string, options?: { streaming?: boolean }) {
  const normalizedPath = normalizePath(path);
  const configuredBase = import.meta.env.VITE_API_BASE_URL;
  const shouldUseDirectBackend = options?.streaming && shouldBypassHostingProxyForStreaming();
  const baseUrl = configuredBase || (shouldUseDirectBackend ? DEFAULT_CLOUD_RUN_API_BASE : '');

  return baseUrl ? `${normalizeBaseUrl(baseUrl)}${normalizedPath}` : normalizedPath;
}
