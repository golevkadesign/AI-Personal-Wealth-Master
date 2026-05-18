import { Router } from "express";
import { getUniversalAiClient } from "../utils/ai-universal";
import { analyzeIntentWithFlash } from '../services/orchestrator';

export const profileRouter = Router();

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
