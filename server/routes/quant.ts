import { Router } from 'express';
import { fetchStockHistory } from '../services/quantEngine';
export const quantRouter = Router();

quantRouter.get('/history', async (req, res) => {
    const symbol = req.query.symbol as string;
    if (!symbol) return res.status(400).json({ error: 'Symbol required' });
    const history = await fetchStockHistory(symbol);
    if (!history) return res.status(500).json({ error: 'Failed to fetch history' });
    res.json({ symbol, history });
});
