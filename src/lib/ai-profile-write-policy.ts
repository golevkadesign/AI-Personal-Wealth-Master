export type AiAgentProfileWriteMode = 'direct' | 'memory_candidate' | 'off';

export function resolveAiAgentProfileWritePolicy(input: {
  syncProfile: boolean;
  profileWriteMode?: AiAgentProfileWriteMode;
}) {
  const mode = input.profileWriteMode || 'direct';
  const syncEnabled = Boolean(input.syncProfile);
  return {
    mode,
    requestMemoryUpdate: syncEnabled && mode !== 'off',
    directProfileWrite: syncEnabled && mode === 'direct',
    stateMemoryWrite: syncEnabled && mode === 'direct',
    memoryCandidateOnly: syncEnabled && mode === 'memory_candidate',
  };
}
