#!/bin/bash
echo '=== Running Code Integrity Verification ==='
echo '[Checking] 1. Core Chat Input & Context Flow...'
grep -q 'fetch("/api/chat"' src/hooks/useAiAgent.ts || { echo 'Error: Chat API call missing'; exit 1; }
grep -q 'evaluateWealthStatus' server/routes/chat.ts || { echo 'Error: Orchestrator flow missing'; exit 1; }

echo '[Checking] 1.5 Intent Router Flash Pre-processing...'
grep -q 'gemini-3-flash' server/services/orchestrator.ts || { echo 'Error: Flash intent routing missing'; exit 1; }
grep -q 'analyzeIntent' server/services/orchestrator.ts || { echo 'Error: Intent logic missing'; exit 1; }

echo '[Checking] 2. AI Thinking & Result Output (Pro Level)...'
grep -q '<think>' src/hooks/useAiAgent.ts || { echo 'Error: <think> parser missing in useAiAgent.ts'; exit 1; }
grep -q 'Synthesizer Agent' server/services/orchestrator.ts || { echo 'Error: Synthesizer mechanism missing'; exit 1; }
grep -q 'gemini-3.1-pro' server/services/orchestrator.ts || { echo 'Error: Synthesizer not using Pro model'; exit 1; }

echo '[Checking] 3. Market Feedback Integration...'
grep -q 'yahoo' server/services/hydrator.ts || { echo 'Error: Yahoo Finance integration missing'; exit 1; }

echo '[Checking] 4. Life Strategy Sub-planning (Detailed Node Plans)...'
grep -q '/api/plan' src/hooks/useStrategyStream.ts || { echo 'Error: useStrategyStream Plan API missing'; exit 1; }

echo '[Checking] 5. TypeScript Compilation...'
npx tsc --noEmit || { echo 'TypeScript check failed'; exit 1; }

echo '✅ Verification Passed: Entire pipeline remains effective.'
exit 0
