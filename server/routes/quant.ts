import { Router } from 'express';
import { fetchStockHistory, analyzeHistory } from '../services/quantEngine';
export const quantRouter = Router();

quantRouter.get('/history', async (req, res) => {
    const symbol = req.query.symbol as string;
    const useLb = req.query.useLb === 'true'; // 💥 解析前端意图
    
    if (!symbol) return res.status(400).json({ error: 'Symbol required' });
    
    // 这里可以进一步从数据库或 session 中获取该用户的长桥密钥 (lbConfig)
    const lbConfig = null; 

    // 传入参数激活混合引擎
    const result = await fetchStockHistory(symbol, useLb, lbConfig);
    
    if (!result || !result.history) {
        console.error(`Failed to fetch history for symbol: ${symbol}`);
        return res.status(500).json({ error: 'Failed to fetch history from all sources' });
    }
    res.json({ symbol, history: result.history, source: result.source, fallbackUsed: result.fallbackUsed });
});

quantRouter.get('/analysis', async (req, res) => {
    const symbol = req.query.symbol as string;
    const useLb = req.query.useLb === 'true';
    const quantity = Number(req.query.quantity) || 0;
    const currentPrice = Number(req.query.currentPrice) || undefined;
    
    if (!symbol) return res.status(400).json({ error: 'Symbol required' });
    
    const lbConfig = null;
    const result = await fetchStockHistory(symbol, useLb, lbConfig);
    
    if (!result || !result.history) {
        return res.status(500).json({ error: 'Failed to fetch history from all sources' });
    }
    
    const holdingSnapshot = { quantity, currentPrice };
    const analysisInfo = analyzeHistory(result.history, holdingSnapshot);
    
    if (!analysisInfo) {
        return res.status(500).json({ error: 'Failed to perform analysis' });
    }
    
    res.json({
        symbol,
        source: result.source,
        fallbackUsed: result.fallbackUsed,
        history: result.history,
        historySummary: analysisInfo.historySummary,
        quantSignals: analysisInfo.quantSignals,
        deterministicAdvice: analysisInfo.deterministicAdvice
    });
});
