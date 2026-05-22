import { AgentAnalysisSnapshot } from '../types/portfolio';

const MAX_SNAPSHOTS = 10;

function getStorageKey(uid: string) {
  return `ai_terminal_position_snapshots_${uid}`;
}

export function saveAgentAnalysisSnapshot(uid: string, snapshot: AgentAnalysisSnapshot): void {
  try {
    const key = getStorageKey(uid);
    const existingStr = localStorage.getItem(key);
    let snapshots: AgentAnalysisSnapshot[] = [];
    if (existingStr) {
      try {
        snapshots = JSON.parse(existingStr);
      } catch (e) {
        // ignore
      }
    }
    snapshots = [snapshot, ...snapshots].slice(0, MAX_SNAPSHOTS);
    localStorage.setItem(key, JSON.stringify(snapshots));
  } catch (err) {
    console.error('Failed to save AgentAnalysisSnapshot', err);
  }
}

export function getAgentAnalysisSnapshots(uid: string): AgentAnalysisSnapshot[] {
  try {
    const key = getStorageKey(uid);
    const existingStr = localStorage.getItem(key);
    if (existingStr) {
      return JSON.parse(existingStr);
    }
  } catch (err) {
    console.error('Failed to get AgentAnalysisSnapshots', err);
  }
  return [];
}

export function getLatestAgentAnalysisSnapshot(uid: string, symbol: string): AgentAnalysisSnapshot | null {
  const snapshots = getAgentAnalysisSnapshots(uid);
  return snapshots.find(s => s.holdingSnapshot.symbol === symbol) || null;
}

export function buildAnalysisDiff(current: AgentAnalysisSnapshot, previous: AgentAnalysisSnapshot | null) {
  if (!previous) return null;
  return {
    priceChange: current.holdingSnapshot.currentPrice - previous.holdingSnapshot.currentPrice,
    marketValueChange: current.holdingSnapshot.marketValue - previous.holdingSnapshot.marketValue,
    rsiChange: (current.quantSignals.rsi || 0) - (previous.quantSignals.rsi || 0),
    timeDiffMs: current.timestamp - previous.timestamp
  };
}
