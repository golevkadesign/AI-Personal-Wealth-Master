import * as crypto from 'crypto';

// server/services/longbridgeAdapter.ts
export interface LongbridgeAccount {
    id: string; name: string; appKey: string; appSecret: string; accessToken: string;
}

export interface AggregatedPosition {
    symbol: string;
    name: string;
    quantity: number;
    costPrice: number;
    currentPrice?: number;
    marketValue?: number;
    value?: number;
    currency?: string;
}

const fetchSingleAccountPositions = async (account: LongbridgeAccount): Promise<AggregatedPosition[]> => {
    console.log(`[Longbridge Adapter] ⚡ 正在请求实盘账户: ${account.name}...`);
    let accessToken = (account.accessToken || '').trim();
    let appKey = (account.appKey || '').trim();
    let appSecret = (account.appSecret || '').trim();

    if (!accessToken) return [];

    try {
        let headers: any = { 'Content-Type': 'application/json' };
        if (appKey && appSecret) {
            const timestamp = Date.now().toString();
            const signedHeaders = 'authorization;x-api-key;x-timestamp';
            const signedValues = `authorization:${accessToken}\nx-api-key:${appKey}\nx-timestamp:${timestamp}\n`;
            const strToSign = `GET|/v1/asset/stock||${signedValues}|${signedHeaders}|`;
            const strToSignHash = crypto.createHash('sha1').update(strToSign, 'utf8').digest('hex');
            const finalStrToSign = `HMAC-SHA256|${strToSignHash}`;
            const signature = crypto.createHmac('sha256', appSecret).update(finalStrToSign).digest('hex');
            
            headers['Authorization'] = accessToken;
            headers['X-Api-Key'] = appKey;
            headers['X-Timestamp'] = timestamp;
            headers['X-Api-Signature'] = `HMAC-SHA256 SignedHeaders=${signedHeaders}, Signature=${signature}`;
        } else {
            headers['Authorization'] = `Bearer ${accessToken}`;
        }

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);
        const res = await fetch("https://openapi.longbridgeapp.com/v1/asset/stock", { 
            headers, 
            method: 'GET', 
            signal: controller.signal,
            cache: 'no-store'
        }).finally(() => clearTimeout(timeoutId));
        const lbData = await res.json();
        
        let positions: AggregatedPosition[] = [];
        if (lbData.code === 0 && lbData.data) {
            const channels = lbData.data.channels || [];
            const list = Array.isArray(lbData.data) ? lbData.data : (lbData.data.list || []);
            
            const extractPos = (p: any) => {
                const qty = Number(p.quantity || 0);
                const costPrice = Number(p.costPrice || p.cost_price || 0);
                const currentPx = Number(p.currentPrice || p.current_price || p.lastPrice || costPrice);
                
                // Don't result in 0 if there are missing fields but we know qty & price
                let mktVal = Number(p.marketValue ?? p.market_value);
                if (isNaN(mktVal) || mktVal === 0) {
                    mktVal = qty * currentPx;
                }
                const currency = p.currency || p.stock_info?.currency || 'USD';
                
                positions.push({
                    symbol: p.symbol || p.stock_info?.symbol,
                    name: p.symbolName || p.name || p.stock_info?.name || p.symbol || p.stock_info?.symbol,
                    quantity: qty,
                    costPrice: costPrice,
                    currentPrice: currentPx,
                    marketValue: mktVal,
                    value: mktVal,
                    currency: currency
                });
            };

            if (channels.length > 0) {
                channels.forEach((c: any) => (c.positions || []).forEach(extractPos));
            } else if (list.length > 0) {
                list.forEach((p: any) => {
                    if (Array.isArray(p.stock_info)) p.stock_info.forEach(extractPos);
                    else extractPos(p);
                });
            }
        }
        return positions;
    } catch (e) {
        console.error(`[Longbridge Adapter] 账户 ${account.name} 抓取异常:`, e);
        return [];
    }
};

export const aggregateLongbridgePortfolios = async (accounts: LongbridgeAccount[]): Promise<AggregatedPosition[]> => {
    if (!accounts || accounts.length === 0) return [];
    
    const results = await Promise.allSettled(accounts.map(acc => fetchSingleAccountPositions(acc)));
    
    const positionMap = new Map<string, AggregatedPosition>();

    results.forEach(result => {
        if (result.status === 'fulfilled' && result.value) {
            result.value.forEach(pos => {
                if (positionMap.has(pos.symbol)) {
                    const existing = positionMap.get(pos.symbol)!;
                    const totalQty = existing.quantity + pos.quantity;
                    const newCostPrice = totalQty > 0 ? ((existing.quantity * existing.costPrice) + (pos.quantity * pos.costPrice)) / totalQty : 0;
                    
                    const newMarketValue = (existing.marketValue || 0) + (pos.marketValue || 0);
                    const newValue = (existing.value || 0) + (pos.value || 0);
                    
                    positionMap.set(pos.symbol, {
                        ...existing,
                        quantity: totalQty,
                        costPrice: newCostPrice,
                        marketValue: newMarketValue,
                        value: newValue
                    });
                } else {
                    positionMap.set(pos.symbol, { ...pos });
                }
            });
        } else if (result.status === 'rejected') {
            console.error(`[Longbridge Adapter] 某账户拉取失败:`, result.reason);
        }
    });

    return Array.from(positionMap.values());
};
