import express, { Request, Response } from 'express';
import { analyzePortfolioReview } from '../services/portfolioReviewAgent';

const router = express.Router();

router.post('/analyze', async (req: Request, res: Response) => {
  try {
    const { session, settings, userRiskPolicy, customApiKey, reviewMemory, previousReviewSummary } = req.body;

    if (!session) {
      res.status(400).json({ success: false, error: '缺少会话数据 (session)' });
      return;
    }

    if (!session.currentSnapshot) {
      res.status(400).json({ success: false, error: '缺少当前资产快照 (currentSnapshot)' });
      return;
    }

    const holdings = session.currentSnapshot.flattenedHoldings || [];
    if (holdings.length > 300) {
      res.status(400).json({ success: false, error: '当前持仓笔数超过系统单次分析上限 300 笔限制' });
      return;
    }

    const sessionLength = JSON.stringify(session).length;
    if (sessionLength > 1024 * 1024) {
      res.status(400).json({ success: false, error: '上传的复盘会话体积超限 (最大支持 1MB)' });
      return;
    }

    const finalSettings = { ...(settings || {}) };

    // Use custom API key fallback if provided, aligned with plan router pattern
    if (customApiKey) {
      if (!finalSettings.geminiKey && finalSettings.provider === 'gemini') {
        finalSettings.geminiKey = customApiKey;
      } else if (!finalSettings.openaiKey && finalSettings.provider === 'openai') {
        finalSettings.openaiKey = customApiKey;
      } else if (!finalSettings.provider) {
        finalSettings.geminiKey = customApiKey;
      }
    }

    const report = await analyzePortfolioReview(
      session,
      finalSettings,
      userRiskPolicy,
      reviewMemory,
      previousReviewSummary
    );
    res.json({
      success: true,
      report
    });
  } catch (err: any) {
    console.error('[Portfolio Review Route] Error analyzing session:', err);
    res.status(500).json({
      success: false,
      error: err?.message || String(err)
    });
  }
});

export default router;
