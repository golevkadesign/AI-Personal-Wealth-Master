import * as crypto from 'crypto';

// server/services/longbridgeAdapter.ts
export interface LongbridgeAccount {
    id: string; name: string; appKey: string; appSecret: string; accessToken: string;
}

export interface RawAccountPosition {
    symbol: string;
    name: string;
    quantity: number;
    costPrice: number;
    currency: string;
    accountId: string;
    accountName: string;
    rawMarketValue?: number;
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

const fetchSingleAccountPositions = async (account: LongbridgeAccount): Promise<RawAccountPosition[]> => {
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
        
        let positions: RawAccountPosition[] = [];
        if (lbData.code === 0 && lbData.data) {
            const channels = lbData.data.channels || [];
            const list = Array.isArray(lbData.data) ? lbData.data : (lbData.data.list || []);
            
            const extractPos = (p: any) => {
                const rawSymbol = p.symbol || p.stock_info?.symbol;
                if (!rawSymbol) return; // Skip empty symbols
                const symbol = normalizeSymbol(rawSymbol);

                const qty = Number(p.quantity || 0);
                const costPrice = Number(p.costPrice || p.cost_price || 0);
                const mktVal = Number(p.marketValue ?? p.market_value);
                const currency = p.currency || p.stock_info?.currency || 'USD';
                
                positions.push({
                    symbol: symbol,
                    name: p.symbolName || p.name || p.stock_info?.name || p.symbol || p.stock_info?.symbol,
                    quantity: qty,
                    costPrice: costPrice,
                    currency: currency,
                    accountId: account.id || account.name,
                    accountName: account.name,
                    rawMarketValue: (!isNaN(mktVal) && mktVal > 0) ? mktVal : undefined
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

export const aggregateLongbridgePortfolios = async (accounts: LongbridgeAccount[]): Promise<{ positions: AggregatedPosition[], meta: any }> => {
    if (!accounts || accounts.length === 0) return { positions: [], meta: {} };
    
    const results = await Promise.allSettled(accounts.map(acc => fetchSingleAccountPositions(acc)));
    
    const rawPositions: RawAccountPosition[] = [];
    let successCount = 0;
    results.forEach(result => {
        if (result.status === 'fulfilled' && result.value) {
            successCount++;
            rawPositions.push(...result.value);
        } else if (result.status === 'rejected') {
            console.error(`[Longbridge Adapter] 某账户拉取失败:`, result.reason);
        }
    });

    if (successCount === 0 && accounts.length > 0) {
        throw new Error("All Longbridge accounts failed to sync. Check network or API keys.");
    }

    const uniqueSymbols = Array.from(new Set(rawPositions.map(p => p.symbol)));
    const firstAccount = accounts.find(a => a.appKey && a.appSecret && a.accessToken) || accounts[0];
    const quotes: Record<string, number> = {};

    if (uniqueSymbols.length > 0 && firstAccount) {
        const chunkSize = 50;
        for (let i = 0; i < uniqueSymbols.length; i += chunkSize) {
            const chunk = uniqueSymbols.slice(i, i + chunkSize);
            const chunkQuotes = await fetchQuotesUsingAccount(chunk, firstAccount);
            Object.assign(quotes, chunkQuotes);
        }
    }

    const positionMap = new Map<string, AggregatedPosition>();

    rawPositions.forEach(raw => {
        if (raw.quantity === 0) return; // Ignore empty positions right away 

        const symbol = raw.symbol;
        const existing = positionMap.get(symbol);
        
        let quotePrice = quotes[symbol];
        let currentPrice: number | undefined;
        let marketValue: number | undefined;
        let valuationSource: string;

        if (quotePrice && quotePrice > 0) {
            currentPrice = quotePrice;
            marketValue = raw.quantity * quotePrice;
            valuationSource = 'longbridge_quote';
        } else if (raw.rawMarketValue && raw.rawMarketValue > 0) {
            marketValue = raw.rawMarketValue;
            currentPrice = undefined;
            valuationSource = 'missing_quote_fallback';
        } else {
            marketValue = undefined;
            currentPrice = undefined;
            valuationSource = 'missing_quote';
        }

        const accountBreakdownRow = {
            accountId: raw.accountId,
            accountName: raw.accountName,
            quantity: raw.quantity,
            costPrice: raw.costPrice,
            currentPrice,
            marketValue,
            valuationSource
        };

        if (existing) {
            const totalQty = existing.quantity + raw.quantity;
            const newCostPrice = totalQty > 0 ? ((existing.quantity * existing.costPrice) + (raw.quantity * raw.costPrice)) / totalQty : 0;
            
            let newMarketValue: number | undefined;
            let newCurrentPrice: number | undefined;
            
            if (quotePrice && quotePrice > 0) {
                 newMarketValue = totalQty * quotePrice;
                 newCurrentPrice = quotePrice;
            } else {
                 const mVal1 = existing.marketValue || 0;
                 const mVal2 = marketValue || 0;
                 if (mVal1 > 0 || mVal2 > 0) {
                     newMarketValue = mVal1 + mVal2;
                 }
            }

            existing.quantity = totalQty;
            existing.costPrice = newCostPrice;
            existing.currentPrice = newCurrentPrice;
            existing.marketValue = newMarketValue;
            existing.value = newMarketValue;
            if (quotePrice && quotePrice > 0) {
                 existing.valuationSource = 'longbridge_quote';
            } else if (existing.valuationSource === 'missing_quote') {
                 if (valuationSource !== 'missing_quote') existing.valuationSource = valuationSource;
            }
            existing.accountBreakdown?.push(accountBreakdownRow);
        } else {
            positionMap.set(symbol, {
                symbol,
                name: raw.name,
                currency: raw.currency,
                quantity: raw.quantity,
                costPrice: raw.costPrice,
                currentPrice,
                marketValue,
                value: marketValue,
                valuationSource,
                accountBreakdown: [accountBreakdownRow]
            });
        }
    });

    const finalPositions = Array.from(positionMap.values()).sort((a, b) => (b.marketValue || 0) - (a.marketValue || 0));

    const quoteCoverage = uniqueSymbols.length > 0 ? Object.keys(quotes).length / uniqueSymbols.length : 1;
    const missingQuoteSymbols = uniqueSymbols.filter(s => !quotes[s]);

    if (quoteCoverage < 1) {
        console.warn(`[Longbridge Adapter] Missing quote for symbols:`, missingQuoteSymbols);
    }

    if (process.env.NODE_ENV !== 'production') {
        const debugPositions = finalPositions.map(p => ({
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

    return {
        positions: finalPositions,
        meta: {
            valuationVersion: 3,
            accountCount: accounts.length,
            positionCount: finalPositions.length,
            quoteCoverage,
            missingQuoteSymbols,
            generatedAt: Date.now()
        }
    };
};

export interface AccountPosition {
    symbol: string;
    name: string;
    quantity: number;
    costPrice: number;
    currentPrice?: number;
    marketValue?: number;
    currency?: string;
    valuationSource?: string;
    accountId: string;
    accountName: string;
}

export interface AccountPortfolio {
    accountId: string;
    accountName: string;
    positions: AccountPosition[];
    meta: {
        positionCount: number;
        quoteCoverage?: number;
        missingQuoteSymbols?: string[];
        generatedAt: number;
        error?: string;
    };
}

export const fetchLongbridgeAccountPortfolios = async (
    accounts: LongbridgeAccount[]
): Promise<{ accounts: AccountPortfolio[]; meta: any }> => {
    if (!accounts || accounts.length === 0) {
        return { accounts: [], meta: { generatedAt: Date.now(), accountCount: 0 } };
    }

    const accountErrors: Record<string, string> = {};
    const portfolios: AccountPortfolio[] = [];

    for (const acc of accounts) {
        try {
            console.log(`[Longbridge Adapter] ⚡ 正在独立请求账户持仓和行情: ${acc.name}...`);
            const rawPositions = await fetchSingleAccountPositions(acc);
            
            const uniqueSymbols = Array.from(new Set(rawPositions.map(p => p.symbol)));
            const quotes: Record<string, number> = {};
            
            if (uniqueSymbols.length > 0) {
                const chunkSize = 50;
                for (let i = 0; i < uniqueSymbols.length; i += chunkSize) {
                    const chunk = uniqueSymbols.slice(i, i + chunkSize);
                    const chunkQuotes = await fetchQuotesUsingAccount(chunk, acc);
                    Object.assign(quotes, chunkQuotes);
                }
            }

            const positions: AccountPosition[] = rawPositions
                .filter(raw => raw.quantity !== 0)
                .map(raw => {
                    const symbol = raw.symbol;
                    let quotePrice = quotes[symbol];
                    
                    let currentPrice: number | undefined;
                    let marketValue: number | undefined;
                    let valuationSource: string;

                    if (quotePrice && quotePrice > 0) {
                        currentPrice = quotePrice;
                        marketValue = raw.quantity * quotePrice;
                        valuationSource = 'longbridge_quote';
                    } else if (raw.rawMarketValue && raw.rawMarketValue > 0) {
                        marketValue = raw.rawMarketValue;
                        currentPrice = undefined;
                        valuationSource = 'missing_quote_fallback';
                    } else {
                        marketValue = undefined;
                        currentPrice = undefined;
                        valuationSource = 'missing_quote';
                    }

                    return {
                        symbol,
                        name: raw.name,
                        quantity: raw.quantity,
                        costPrice: raw.costPrice,
                        currentPrice,
                        marketValue,
                        currency: raw.currency,
                        valuationSource,
                        accountId: raw.accountId,
                        accountName: raw.accountName
                    };
                });

            const missingQuoteSymbols = uniqueSymbols.filter(s => !quotes[s]);
            const quoteCoverage = uniqueSymbols.length > 0 ? Object.keys(quotes).length / uniqueSymbols.length : 1;

            portfolios.push({
                accountId: acc.id || acc.name,
                accountName: acc.name,
                positions,
                meta: {
                    positionCount: positions.length,
                    quoteCoverage,
                    missingQuoteSymbols,
                    generatedAt: Date.now()
                }
            });
        } catch (err: any) {
            console.error(`[Longbridge Adapter] Error processing account ${acc.name}:`, err);
            const errMsg = err?.message || String(err);
            accountErrors[acc.name || acc.id] = errMsg;

            portfolios.push({
                accountId: acc.id || acc.name,
                accountName: acc.name,
                positions: [],
                meta: {
                    positionCount: 0,
                    generatedAt: Date.now(),
                    error: errMsg
                }
            });
        }
    }

    return {
        accounts: portfolios,
        meta: {
            generatedAt: Date.now(),
            accountCount: accounts.length,
            successCount: portfolios.filter(p => !p.meta.error).length,
            accountErrors: Object.keys(accountErrors).length > 0 ? accountErrors : undefined
        }
    };
};
