import express from 'express';
import { createDashboardProjection } from '../../src/lib/workbench-memory';
import { createDashboardProjectionRefreshPatch } from '../../src/lib/dashboard-projection-sync';
import {
  deriveTerminalPatchFromDashboardProjection,
} from '../../src/lib/sovereign-profile-projection';
import type {
  MemoryInboxSnapshot,
  SovereignProfile,
  WorkbenchSessionSpec,
} from '../../src/types/workbench';
import type { DashboardProjectionRefreshTrigger } from '../../src/lib/dashboard-projection-sync';

const router = express.Router();

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

function recomputeProjection(input: {
  sessionSpec: WorkbenchSessionSpec;
  profile?: SovereignProfile;
  memoryInbox?: MemoryInboxSnapshot;
}) {
  const dashboardProjection = createDashboardProjection(
    input.sessionSpec,
    input.profile || input.sessionSpec.facts?.sovereignProfile,
    input.memoryInbox || input.sessionSpec.memoryInbox,
  );
  const terminalPatch = deriveTerminalPatchFromDashboardProjection({
    dashboardProjection,
    profile: input.profile || input.sessionSpec.facts?.sovereignProfile,
  });

  return { dashboardProjection, terminalPatch };
}

router.get('/projection', (req, res) => {
  const sessionSpec = parseJsonHeader<WorkbenchSessionSpec>(req.headers['x-workbench-session']);
  const profile = parseJsonHeader<SovereignProfile>(req.headers['x-sovereign-profile']);
  const memoryInbox = parseJsonHeader<MemoryInboxSnapshot>(req.headers['x-memory-inbox']);

  if (!sessionSpec) {
    res.json({
      success: true,
      mode: 'stateless',
      dashboardProjection: null,
      note: 'Pass x-workbench-session or use POST /api/dashboard/projection/recompute to recompute projection.',
    });
    return;
  }

  res.json({
    success: true,
    mode: 'stateless',
    ...recomputeProjection({ sessionSpec, profile, memoryInbox }),
  });
});

router.post('/projection/recompute', async (req, res) => {
  try {
    const sessionSpec = (req.body?.sessionSpec || req.body?.session) as WorkbenchSessionSpec | undefined;
    const profile = req.body?.profile as SovereignProfile | undefined;
    const memoryInbox = req.body?.memoryInbox as MemoryInboxSnapshot | undefined;

    if (sessionSpec) {
      res.json({
        success: true,
        mode: 'stateless',
        ...recomputeProjection({ sessionSpec, profile, memoryInbox }),
      });
      return;
    }

    if (req.body?.terminalState) {
      const result = await createDashboardProjectionRefreshPatch({
        terminalState: req.body.terminalState,
        trigger: req.body.trigger as DashboardProjectionRefreshTrigger | undefined,
        subject: req.body.subject,
      });
      res.json({
        success: true,
        mode: 'stateless',
        ...result,
      });
      return;
    }

    res.status(400).json({ success: false, error: 'Missing sessionSpec or terminalState' });
  } catch (error: any) {
    console.error('[Dashboard Projection Route] Failed to recompute projection:', error);
    res.status(500).json({ success: false, error: error?.message || 'Failed to recompute dashboard projection' });
  }
});

export default router;
