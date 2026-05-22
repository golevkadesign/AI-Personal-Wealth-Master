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
    valuationSource?: string;
    accountBreakdown?: any[];
}

const fetchQuotesUsingAccount = async (symbols: string[], account: LongbridgeAccount): Promise<Record<string, number>> => {
    let accessToken = (account.accessToken || '').trim();
    let appKey = (account.appKey || '').trim();
    let appSecret = (account.appSecret || '').trim();

    if (!accessToken || symbols.length === 0) return {};

    try {
        const method = 'GET';
        const path = '/v1/quote/quote';
        const query = `symbol=${symbols.join(',')}`;
        const timestamp = Date.now().toString();

        let headers: any = { 'Content-Type': 'application/json' };
        
        if (appKey && appSecret) {
            const signedHeaders = 'authorization;x-api-key;x-timestamp';
            const signedValues = `authorization:${accessToken}\nx-api-key:${appKey}\nx-timestamp:${timestamp}\n`;
            const strToSign = `GET|${path}|${query}|${signedValues}|${signedHeaders}|`;
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
        
        const res = await fetch(`https://openapi.longbridgeapp.com${path}?${query}`, { headers, method });
        const lbData = await res.json();
        
        if (lbData.code === 0 && lbData.data && lbData.data.length > 0) {
            const quotes: Record<string, number> = {};
            lbData.data.forEach((q: any) => {
                const px = Number(q.last_done);
                if (!isNaN(px) && px > 0) quotes[q.symbol] = px;
            });
            return quotes;
        }
    } catch (e) {
        console.warn(`[Longbridge Adapter] Quote fetch failed for ${symbols.join(',')}:`, e);
    }
    return {};
};

const normalizeSymbol = (s: string) => String(s || '').trim().toUpperCase();

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
                const rawSymbol = p.symbol || p.stock_info?.symbol;
                if (!rawSymbol) return; // Skip empty symbols
                const symbol = normalizeSymbol(rawSymbol);

                const qty = Number(p.quantity || 0);
                const costPrice = Number(p.costPrice || p.cost_price || 0);
                
                let currentPx = Number(p.currentPrice || p.current_price || p.latestPrice || p.latest_price || p.lastPrice || p.last_price || p.last_done || p.nominalPrice || p.nominal_price);
                
                let mktVal = Number(p.marketValue ?? p.market_value ?? p.holding_value ?? p.currentValue ?? p.current_value ?? p.totalMarketValue ?? p.total_market_value);
                
                let valuationSource = 'unknown';
                
                if (!isNaN(mktVal) && mktVal > 0) {
                    valuationSource = 'longbridge_position';
                } else if (!isNaN(currentPx) && currentPx > 0) {
                    mktVal = qty * currentPx;
                    valuationSource = 'longbridge_quote';
                } else {
                    if (costPrice > 0) {
                        mktVal = qty * costPrice;
                        valuationSource = 'positive_cost_fallback';
                        currentPx = costPrice;
                    } else {
                        mktVal = 0;
                        currentPx = 0;
                    }
                }

                const currency = p.currency || p.stock_info?.currency || 'USD';
                
                positions.push({
                    symbol: symbol,
                    name: p.symbolName || p.name || p.stock_info?.name || p.symbol || p.stock_info?.symbol,
                    quantity: qty,
                    costPrice: costPrice,
                    currentPrice: currentPx,
                    marketValue: mktVal,
                    value: mktVal,
                    currency: currency,
                    valuationSource
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
                    const aggregatedCurrentPrice = totalQty > 0 ? newMarketValue / totalQty : 0;
                    
                    const accountBreakdown = existing.accountBreakdown ? [...existing.accountBreakdown] : [{...existing}];
                    accountBreakdown.push({...pos});
                    
                    positionMap.set(pos.symbol, {
                        ...existing,
                        quantity: totalQty,
                        costPrice: newCostPrice,
                        currentPrice: aggregatedCurrentPrice,
                        marketValue: newMarketValue,
                        value: newValue,
                        valuationSource: 'aggregated',
                        accountBreakdown
                    });
                } else {
                    positionMap.set(pos.symbol, { ...pos, accountBreakdown: [{...pos}] });
                }
            });
        } else if (result.status === 'rejected') {
            console.error(`[Longbridge Adapter] 某账户拉取失败:`, result.reason);
        }
    });

    const finalPositions = Array.from(positionMap.values());
    const missingQuoteSymbols = finalPositions.filter(p => !p.marketValue || p.marketValue <= 0 || p.valuationSource === 'unknown' || p.valuationSource === 'positive_cost_fallback').map(p => p.symbol);
    
    if (missingQuoteSymbols.length > 0 && accounts.length > 0) {
        // use the first valid account to fetch quotes for missing symbols
        const firstAccount = accounts.find(a => a.appKey && a.appSecret && a.accessToken);
        if (firstAccount) {
            // chunk symbols into 50 to avoid URI too long
            const chunkSize = 50;
            for (let i = 0; i < missingQuoteSymbols.length; i += chunkSize) {
                const chunk = missingQuoteSymbols.slice(i, i + chunkSize);
                const quotes = await fetchQuotesUsingAccount(chunk, firstAccount);
                for (const symbol in quotes) {
                    const price = quotes[symbol];
                    const existing = positionMap.get(symbol);
                    if (existing && price > 0) {
                        existing.currentPrice = price;
                        existing.marketValue = existing.quantity * price;
                        existing.value = existing.marketValue;
                        existing.valuationSource = 'longbridge_quote_fallback';
                        if (existing.accountBreakdown) {
                            existing.accountBreakdown.forEach(row => {
                                row.currentPrice = price;
                                row.marketValue = row.quantity * price;
                                row.value = row.marketValue;
                                row.valuationSource = 'longbridge_quote_fallback';
                            });
                        }
                    }
                }
            }
        }
    }

    if (process.env.NODE_ENV !== 'production') {
        const debugPositions = Array.from(positionMap.values()).map(p => ({
            symbol: p.symbol,
            quantity: p.quantity,
            currentPrice: p.currentPrice,
            marketValue: p.marketValue,
            costPrice: p.costPrice,
            valuationSource: p.valuationSource,
            accountCount: p.accountBreakdown?.length
        }));
        console.table(debugPositions);
    }

    return Array.from(positionMap.values()).sort((a, b) => (b.marketValue || 0) - (a.marketValue || 0));
};
