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
