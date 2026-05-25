import express from 'express';
import { aggregateLongbridgePortfolios, fetchLongbridgeAccountPortfolios } from '../services/longbridgeAdapter';

const router = express.Router();

router.get('/positions', async (req, res) => {
    try {
        let accounts = [];
        // Extract accounts from custom header which the frontend will send
        const accountsHeader = req.headers['x-longbridge-accounts'];
        if (accountsHeader && typeof accountsHeader === 'string') {
            const decodedStr = decodeURIComponent(Buffer.from(accountsHeader, 'base64').toString('utf-8'));
            accounts = JSON.parse(decodedStr);
        }
        
        const result = await aggregateLongbridgePortfolios(accounts);
        
        res.json({
            success: true,
            data: result.positions,
            meta: result.meta
        });
    } catch (error) {
        console.error('[Longbridge API] Error fetching positions:', error);
        res.status(500).json({ success: false, error: 'Internal Server Error' });
    }
});

router.get('/account-portfolios', async (req, res) => {
    try {
        let accounts = [];
        // Extract accounts from custom header which the frontend sends
        const accountsHeader = req.headers['x-longbridge-accounts'];
        if (accountsHeader && typeof accountsHeader === 'string') {
            const decodedStr = decodeURIComponent(Buffer.from(accountsHeader, 'base64').toString('utf-8'));
            accounts = JSON.parse(decodedStr);
        }
        
        const result = await fetchLongbridgeAccountPortfolios(accounts);
        
        res.json({
            success: true,
            data: result.accounts,
            meta: result.meta
        });
    } catch (error) {
        console.error('[Longbridge API] Error fetching account-portfolios:', error);
        res.status(500).json({ success: false, error: 'Internal Server Error' });
    }
});

export default router;
