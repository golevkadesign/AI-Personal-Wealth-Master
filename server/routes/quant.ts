import { Router } from 'express';
import { fetchStockHistory } from '../services/quantEngine';
export const quantRouter = Router();

quantRouter.get('/history', async (req, res) => {
    const symbol = req.query.symbol as string;
    const useLb = req.query.useLb === 'true'; // 💥 解析前端意图
    
    if (!symbol) return res.status(400).json({ error: 'Symbol required' });
    
    // 这里可以进一步从数据库或 session 中获取该用户的长桥密钥 (lbConfig)
    const lbConfig = null; 

    // 传入参数激活混合引擎
    const history = await fetchStockHistory(symbol, useLb, lbConfig);
    
    if (!history) {
        console.error(`Failed to fetch history for symbol: ${symbol}`);
        return res.status(500).json({ error: 'Failed to fetch history from all sources' });
    }
    res.json({ symbol, history, source: useLb ? 'longbridge' : 'yahoo' });
});
