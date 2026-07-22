import { filterAiWritableStatePatch } from '../src/lib/ai-state-permissions';
import { resolveAiAgentProfileWritePolicy } from '../src/lib/ai-profile-write-policy';

function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(message);
}

const direct = resolveAiAgentProfileWritePolicy({
  syncProfile: true,
  profileWriteMode: 'direct',
});
assert(direct.requestMemoryUpdate, 'direct mode should request memory/profile output from backend');
assert(direct.directProfileWrite, 'direct mode should allow legacy direct profile write');
assert(direct.stateMemoryWrite, 'direct mode should allow profile-like SDUI state writes');
assert(!direct.memoryCandidateOnly, 'direct mode should not be candidate-only');

const candidateOnly = resolveAiAgentProfileWritePolicy({
  syncProfile: true,
  profileWriteMode: 'memory_candidate',
});
assert(candidateOnly.requestMemoryUpdate, 'candidate-only mode should still request updatedProfile output');
assert(!candidateOnly.directProfileWrite, 'candidate-only mode must block direct profile writes');
assert(!candidateOnly.stateMemoryWrite, 'candidate-only mode must block SDUI profile writes');
assert(candidateOnly.memoryCandidateOnly, 'candidate-only mode should be explicit');

const off = resolveAiAgentProfileWritePolicy({
  syncProfile: true,
  profileWriteMode: 'off',
});
assert(!off.requestMemoryUpdate, 'off mode should not request memory/profile output');
assert(!off.directProfileWrite, 'off mode should block direct profile writes');
assert(!off.stateMemoryWrite, 'off mode should block state memory writes');

const rawPatch = {
  insights: { global: 'Keep dashboard narrative' },
  dynamicWidgets: [{ id: 'widget-1', type: 'MetricCard' }],
  userPersona: { description: 'Should be memory candidate first' },
  goal: { target: 100000 },
  lifeStrategiesShort: ['Do not write directly'],
  lifeStrategiesLong: ['Do not write directly'],
  agentMemorySnapshots: [{ id: 'memory-1' }],
};

const candidateFiltered = filterAiWritableStatePatch(rawPatch, {
  allowMemoryWrite: candidateOnly.stateMemoryWrite,
});
assert(candidateFiltered.insights?.global === 'Keep dashboard narrative', 'candidate mode should keep non-profile dashboard insights');
assert(Array.isArray(candidateFiltered.dynamicWidgets), 'candidate mode should keep visual widgets');
assert(!('userPersona' in candidateFiltered), 'candidate mode should strip userPersona');
assert(!('goal' in candidateFiltered), 'candidate mode should strip goal');
assert(!('lifeStrategiesShort' in candidateFiltered), 'candidate mode should strip short life strategies');
assert(!('lifeStrategiesLong' in candidateFiltered), 'candidate mode should strip long life strategies');
assert(!('agentMemorySnapshots' in candidateFiltered), 'candidate mode should strip memory snapshots');

const directFiltered = filterAiWritableStatePatch(rawPatch, {
  allowMemoryWrite: direct.stateMemoryWrite,
});
assert(directFiltered.userPersona?.description === 'Should be memory candidate first', 'direct mode should preserve legacy userPersona writes');
assert(directFiltered.goal?.target === 100000, 'direct mode should preserve legacy goal writes');
assert(Array.isArray(directFiltered.agentMemorySnapshots), 'direct mode should preserve legacy memory snapshots');

console.log(JSON.stringify({
  status: 'ok',
  checked: [
    'direct-profile-write-mode',
    'workbench-candidate-only-mode',
    'off-profile-write-mode',
    'candidate-mode-strips-profile-sdui-fields',
    'direct-mode-preserves-legacy-profile-fields',
  ],
  candidateMode: candidateOnly,
  candidateFilteredKeys: Object.keys(candidateFiltered),
  directFilteredKeys: Object.keys(directFiltered),
}));
