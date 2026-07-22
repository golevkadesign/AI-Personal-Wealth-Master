import { Router } from "express";
import { getUniversalAiClient } from "../utils/ai-universal";
import { analyzeIntentWithFlash } from '../services/orchestrator';
import { createDashboardProjection } from "../../src/lib/workbench-memory";
import { deriveTerminalPatchFromSovereignProfile } from "../../src/lib/sovereign-profile-projection";
import type { SovereignProfile, WorkbenchSessionSpec } from "../../src/types/workbench";

export const profileRouter = Router();

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const unique = (items: Array<string | undefined | null>) =>
  Array.from(new Set(items.filter((item): item is string => Boolean(item))));

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

function mergeRecords(
  base: Record<string, unknown> | undefined,
  patch: Record<string, unknown> | undefined,
): Record<string, unknown> {
  if (!patch) return { ...(base || {}) };
  return Object.entries(patch).reduce<Record<string, unknown>>((next, [key, value]) => {
    const current = next[key];
    if (Array.isArray(value)) {
      next[key] = Array.isArray(current) ? [...current, ...value] : [...value];
      return next;
    }
    if (isRecord(value)) {
      next[key] = mergeRecords(isRecord(current) ? current : undefined, value);
      return next;
    }
    next[key] = value;
    return next;
  }, { ...(base || {}) });
}

function mergeProfile(profile: SovereignProfile, patch?: Partial<SovereignProfile>): SovereignProfile {
  const now = Date.now();
  if (!patch) return { ...profile };
  return {
    ...profile,
    ...patch,
    version: Math.max(Number(profile.version || 1), Number(patch.version || profile.version || 1)) + 1,
    updatedAt: now,
    identity: mergeRecords(profile.identity, patch.identity),
    lifeConstraints: mergeRecords(profile.lifeConstraints, patch.lifeConstraints),
    riskPreferences: mergeRecords(profile.riskPreferences, patch.riskPreferences),
    allocationPolicy: mergeRecords(profile.allocationPolicy, patch.allocationPolicy),
    behavioralPatterns: mergeRecords(profile.behavioralPatterns, patch.behavioralPatterns),
    decisionLedger: [
      ...(profile.decisionLedger || []),
      ...(patch.decisionLedger || []),
    ],
    sourceRefs: unique([...(profile.sourceRefs || []), ...(patch.sourceRefs || []), 'profile.patch']),
  };
}

profileRouter.get("/", (req, res) => {
  const profile = parseJsonHeader<SovereignProfile>(req.headers['x-sovereign-profile']);
  res.json({
    success: true,
    mode: 'stateless',
    profile: profile || null,
    note: profile ? undefined : 'Pass x-sovereign-profile or use PATCH /api/profile with a profile payload.',
  });
});

profileRouter.patch("/", (req, res) => {
  const profile = (req.body?.profile || req.body?.currentProfile || { version: 1 }) as SovereignProfile;
  const patch = (req.body?.patch || req.body?.profilePatch || {}) as Partial<SovereignProfile>;
  const nextProfile = mergeProfile(profile, patch);
  res.json({
    success: true,
    mode: 'stateless',
    profile: nextProfile,
  });
});

profileRouter.get("/source-index", (req, res) => {
  const profile = parseJsonHeader<SovereignProfile>(req.headers['x-sovereign-profile']);
  res.json({
    success: true,
    mode: 'stateless',
    sourceIndex: (profile as any)?.sourceIndex || profile?.sourceRefs || [],
  });
});

profileRouter.post("/source-index", (req, res) => {
  const profile = (req.body?.profile || {}) as SovereignProfile;
  res.json({
    success: true,
    mode: 'stateless',
    sourceIndex: (profile as any)?.sourceIndex || profile.sourceRefs || [],
  });
});

profileRouter.get("/decision-ledger", (req, res) => {
  const profile = parseJsonHeader<SovereignProfile>(req.headers['x-sovereign-profile']);
  res.json({
    success: true,
    mode: 'stateless',
    decisionLedger: profile?.decisionLedger || [],
  });
});

profileRouter.post("/decision-ledger", (req, res) => {
  const profile = (req.body?.profile || {}) as SovereignProfile;
  res.json({
    success: true,
    mode: 'stateless',
    decisionLedger: profile.decisionLedger || [],
  });
});

profileRouter.post("/recompute-projection", (req, res) => {
  const sessionSpec = (req.body?.sessionSpec || req.body?.session) as WorkbenchSessionSpec | undefined;
  const profile = (req.body?.profile || sessionSpec?.facts?.sovereignProfile) as SovereignProfile | undefined;

  if (!sessionSpec || !profile) {
    res.status(400).json({ success: false, error: 'Missing sessionSpec or profile' });
    return;
  }

  const dashboardProjection = createDashboardProjection(sessionSpec, profile, sessionSpec.memoryInbox);
  const terminalPatch = deriveTerminalPatchFromSovereignProfile({
    profile,
    dashboardProjection,
  });

  res.json({
    success: true,
    mode: 'stateless',
    profile,
    dashboardProjection,
    terminalPatch,
  });
});

profileRouter.post("/generate", async (req, res) => {
  try {
    const { data, settings, contextData } = req.body;
    const finalData = data || contextData || {};

    const passedSettings = settings || {};
    const ai = getUniversalAiClient(passedSettings);
    const targetModel = passedSettings.geminiFastModel || "gemini-2.5-flash"; // 优先使用用户配置

    const prompt = `你是一个客观且专业的第三人称资产管理分析旁白。你的任务是基于传入的 JSON 数据，生成一份格式化的自然语言长线记忆报告。
报告需严格包含以下板块：
1. 核心画像与性格
2. 职业与履历现状
3. 资产结构总览
4. 长短线战略目标记录

【严格约束】
- 纯粹的翻译任务（JSON -> 自然语言），严禁凭空捏造数据或给出投资建议。
- 必须 100% 忠实于传入的 JSON 数据。
- 输出纯 Markdown 格式。

【JSON 数据】
${JSON.stringify(finalData, null, 2)}`;

    const response = await ai.models.generateContent({
      model: targetModel,
      contents: [{ role: "user", parts: [{ text: prompt }] }],
    });

    res.json({ content: response.text });
  } catch (error: any) {
    console.error("Profile generation error:", error);
    res.status(500).json({ error: error.message });
  }
});

profileRouter.post('/parse', async (req, res) => {
    try {
        const { currentProfile, ragSchema, naturalLanguageInput, attachments } = req.body;
        
        const message = `[用户手动补充资料/事实修正]: ${naturalLanguageInput}`;
        // 借用 Flash 意图层极其强悍的 RAG 更新能力
        const result = await analyzeIntentWithFlash(
            message, 
            [], 
            req.body.settings, // 如果前端传了
            "General", 
            currentProfile || {}, 
            ragSchema || "", 
            attachments || []
        );

        if (!result.updatedProfile) {
            return res.status(500).json({ error: "解析引擎未能成功合并资料" });
        }

        res.json({ updatedProfile: result.updatedProfile });
    } catch (e: any) {
        console.error("Profile Parsing Route Error:", e);
        res.status(500).json({ error: "服务器内部解析错误", details: e.message });
    }
});

profileRouter.post('/parse-row', async (req, res) => {
    try {
        const { key, value, file } = req.body;
        
        let prompt = `你是一个顶级家族资产管家的【单行记忆事实精炼器】。
用户当前正在配置其 RAG 快照档案中的【${key || '未定义属性'}】维度。
当前输入的自然语言/历史数据为:
"""
${value || '暂无文字输入'}
"""

【任务要求】：
1. 请深度提取上述文本（以及随附的文件内容，如果有）中的全部核心财务事实、偏好红线、约束条件或资产变动。
2. 剔除一切客套话、修辞或无意义的描述。
3. 请将精炼后的结果以高度结构化的文本格式输出。如果原数据有明确的 JSON 结构意图，请尝试输出合法的紧凑 JSON（如数组或字典）。
4. 绝对不要输出任何前言、后语或 Markdown 代码块标记（不要写 \`\`\`json），只输出精炼后的纯净内容本身，以便前端直接填入 Textarea！`;

        const passedSettings = req.body.settings || {};
        const ai = getUniversalAiClient(passedSettings);
        const targetModel = passedSettings.geminiFastModel || "gemini-2.5-flash";

        let contents: any[] = [{ text: prompt }];

        if (file && file.base64) {
            const base64Data = file.base64.split(',')[1] || file.base64;
            const mimeTypeMatch = file.base64.match(/^data:(.*?);base64,/);
            const mimeType = mimeTypeMatch ? mimeTypeMatch[1] : "application/octet-stream";
            
            contents.push({
                inlineData: {
                    data: base64Data,
                    mimeType: mimeType
                }
            });
        }

        const response = await ai.models.generateContent({
            model: targetModel,
            contents: [{ role: "user", parts: contents }],
            config: {
                temperature: 0.1
            }
        });

        let refinedText = (response.text || "").replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();

        res.json({ parsedValue: refinedText });
    } catch (e: any) {
        console.error("Parse Row Error:", e);
        res.status(500).json({ error: e.message || "解析失败" });
    }
});
