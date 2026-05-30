export interface StooqDailyBar {
  date: string;
  open?: number;
  high?: number;
  low?: number;
  close?: number;
  volume?: number;
}

function parseStooqNumber(value: string | undefined): number | undefined {
  if (value === undefined || value === null) return undefined;
  const cleaned = value.trim();
  if (cleaned === '' || cleaned.toLowerCase() === 'n/a') return undefined;
  const noCommas = cleaned.replace(/,/g, '');
  const num = Number(noCommas);
  if (!Number.isFinite(num)) return undefined;
  return num;
}

export async function fetchStooqDaily(
  stooqSymbol: string,
  options?: { timeoutMs?: number }
): Promise<StooqDailyBar[]> {
  const timeoutMs = options?.timeoutMs ?? 5000;
  const url = `https://stooq.com/q/d/l/?s=${encodeURIComponent(stooqSymbol)}&i=d`;

  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(id);

    if (!res.ok) {
      console.warn(`[stooq-adapter] Failed to fetch ${stooqSymbol}: HTTP ${res.status}`);
      return [];
    }

    const text = await res.text();
    if (!text || text.includes('No data') || text.trim().length === 0) {
      console.warn(`[stooq-adapter] No data dynamic warning or empty response for ${stooqSymbol}`);
      return [];
    }

    const lines = text.split(/\r?\n/);
    if (lines.length <= 1) return [];

    const header = lines[0].toLowerCase().split(',');
    const dateIdx = header.indexOf('date');
    const openIdx = header.indexOf('open');
    const highIdx = header.indexOf('high');
    const lowIdx = header.indexOf('low');
    const closeIdx = header.indexOf('close');
    const volumeIdx = header.indexOf('volume');

    const bars: StooqDailyBar[] = [];

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      const cols = line.split(',');
      if (cols.length < 5) continue; // Needs at least date/open/high/low/close

      const dateVal = cols[dateIdx !== -1 ? dateIdx : 0];
      const openVal = parseStooqNumber(cols[openIdx !== -1 ? openIdx : 1]);
      const highVal = parseStooqNumber(cols[highIdx !== -1 ? highIdx : 2]);
      const lowVal = parseStooqNumber(cols[lowIdx !== -1 ? lowIdx : 3]);
      const closeVal = parseStooqNumber(cols[closeIdx !== -1 ? closeIdx : 4]);
      const volVal = volumeIdx !== -1 ? parseStooqNumber(cols[volumeIdx]) : undefined;

      // Ensure Date and Close are valid
      if (!dateVal || closeVal === undefined) {
        continue;
      }

      bars.push({
        date: dateVal,
        open: openVal,
        high: highVal,
        low: lowVal,
        close: closeVal,
        volume: volVal,
      });
    }

    // Sort bars by date chronological ascending (older first, newer last)
    bars.sort((a, b) => a.date.localeCompare(b.date));

    // Return the latest 260 trading days (~1 year)
    return bars.slice(-260);
  } catch (error: any) {
    clearTimeout(id);
    console.warn(`[stooq-adapter] Error fetching ${stooqSymbol}:`, error?.message || error);
    return [];
  }
}
