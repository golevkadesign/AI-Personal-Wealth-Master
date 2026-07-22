import express from 'express';
import {
  applyMemoryInboxDecision,
  createMemoryInboxSnapshot,
  hydrateWorkbenchMemoryProjection,
} from '../../src/lib/workbench-memory';
import type {
  MemoryInboxDecisionType,
  MemoryInboxItem,
  SovereignProfile,
  WorkbenchSessionSpec,
} from '../../src/types/workbench';

const router = express.Router();

const actionToDecision: Record<string, MemoryInboxDecisionType> = {
  accept: 'accept',
  reject: 'reject',
  merge: 'merge',
  'edit-and-accept': 'edit_and_accept',
  edit_and_accept: 'edit_and_accept',
  'mark-temporary': 'mark_temporary',
  mark_temporary: 'mark_temporary',
  revoke: 'revoke',
};

function parseJsonHeader<T>(value: unknown): T | undefined {
  if (typeof value !== 'string' || !value.trim()) return undefined;
  try {
    const decoded = Buffer.from(value, 'base64').toString('utf-8');
    return JSON.parse(decoded) as T;
  } catch {
    try {
      return JSON.parse(value) as T;
    } catch {
      return undefined;
    }
  }
}

function findInboxItem(session: WorkbenchSessionSpec | undefined, explicitItem: MemoryInboxItem | undefined, id: string) {
  if (explicitItem) return explicitItem;
  return session?.memoryInbox?.items.find((item) => item.id === id || item.candidate.id === id);
}

router.get('/candidates', (req, res) => {
  const session = parseJsonHeader<WorkbenchSessionSpec>(req.headers['x-workbench-session']);
  if (!session) {
    res.json({
      success: true,
      mode: 'stateless',
      items: [],
      note: 'Pass x-workbench-session or use POST /api/memory/candidates to hydrate candidates from a Workbench session.',
    });
    return;
  }

  const hydrated = hydrateWorkbenchMemoryProjection(session);
  res.json({
    success: true,
    mode: 'stateless',
    memoryInbox: hydrated.memoryInbox,
    dashboardProjection: hydrated.dashboardProjection,
    items: hydrated.memoryInbox?.items || [],
  });
});

router.post('/candidates', (req, res) => {
  const session = (req.body?.sessionSpec || req.body?.session) as WorkbenchSessionSpec | undefined;
  if (!session || typeof session !== 'object') {
    res.status(400).json({ success: false, error: 'Missing sessionSpec' });
    return;
  }

  const hydrated = hydrateWorkbenchMemoryProjection(session);
  res.json({
    success: true,
    mode: 'stateless',
    session: hydrated,
    memoryInbox: hydrated.memoryInbox,
    dashboardProjection: hydrated.dashboardProjection,
    items: hydrated.memoryInbox?.items || [],
  });
});

router.post('/candidates/:id/:action', (req, res) => {
  const decision = actionToDecision[String(req.params.action || '')];
  if (!decision) {
    res.status(400).json({ success: false, error: `Unsupported memory decision: ${req.params.action}` });
    return;
  }

  const session = (req.body?.sessionSpec || req.body?.session) as WorkbenchSessionSpec | undefined;
  const item = findInboxItem(session, req.body?.item, req.params.id);
  const profile = (req.body?.profile || session?.facts?.sovereignProfile) as SovereignProfile | undefined;

  if (!item) {
    res.status(404).json({ success: false, error: 'Memory candidate not found in request payload' });
    return;
  }
  if (!profile) {
    res.status(400).json({ success: false, error: 'Missing sovereign profile' });
    return;
  }

  const result = applyMemoryInboxDecision({
    item,
    profile,
    decision,
    editedPatch: req.body?.editedPatch,
    editedTitle: req.body?.editedTitle,
    editedBody: req.body?.editedBody,
    sessionSpec: session,
  });

  res.json({
    success: true,
    mode: 'stateless',
    decision,
    ...result,
  });
});

export default router;
