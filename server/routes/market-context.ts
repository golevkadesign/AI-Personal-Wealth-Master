import express from 'express';
import { buildMarketContext } from '../services/marketContext';

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const forceRefresh = req.query.force === '1' || req.query.force === 'true';

    const fredApiKey = typeof req.headers['x-fred-api-key'] === 'string'
      ? req.headers['x-fred-api-key']
      : undefined;

    const alphaVantageApiKey = typeof req.headers['x-alpha-vantage-api-key'] === 'string'
      ? req.headers['x-alpha-vantage-api-key']
      : undefined;

    const data = await buildMarketContext({ 
      forceRefresh,
      fredApiKey,
      alphaVantageApiKey
    });

    res.json({
      success: true,
      data,
      generatedAt: data.generatedAt,
      warnings: data.warnings || []
    });
  } catch (error: any) {
    console.error('[market-context-route] Failed to handle market-context request:', error);
    res.status(500).json({
      success: false,
      error: error?.message || 'Failed to build market context'
    });
  }
});

export default router;
