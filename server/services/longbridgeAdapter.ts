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
    rawCurrentPrice?: number;
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
    _staleQuote?: boolean;
    accountBreakdown?: any[];
}

function parseNum(...values: any[]): number | undefined {
    for (const val of values) {
        if (val === null || val === undefined || val === '') continue;
        if (typeof val === 'number') {
            if (!isNaN(val)) return val;
            continue;
        }
        if (typeof val === 'string') {
            const cleaned = val.replace(/,/g, '').trim();
            const parsed = Number(cleaned);
            if (!isNaN(parsed)) return parsed;
        }
    }
    return undefined;
}

function pickMarketValue(raw: any): number | undefined {
    if (!raw) return undefined;
    return parseNum(
        raw.marketValue,
        raw.market_value,
        raw.position_market_value,
        raw.current_market_value,
        raw.asset_value,
        raw.value,
        raw.amount,
        raw.stock_info?.marketValue,
        raw.stock_info?.market_value,
        raw.stock_info?.asset_value
    );
}

function pickCurrentPrice(raw: any): number | undefined {
    if (!raw) return undefined;
    return parseNum(
        raw.currentPrice,
        raw.current_price,
        raw.lastPrice,
        raw.last_price,
        raw.last_done,
        raw.price,
        raw.stock_info?.currentPrice,
        raw.stock_info?.current_price,
        raw.stock_info?.last_done,
        raw.stock_info?.price
    );
}

interface ValuationResult {
    currentPrice: number | undefined;
    marketValue: number | undefined;
    valuationSource: string;
    _staleQuote?: boolean;
}

function determineValuation(
    quantity: number,
    quotePrice: number | undefined,
    rawMarketValue: number | undefined,
    rawCurrentPrice: number | undefined,
    costPrice: number | undefined
): ValuationResult {
    let currentPrice: number | undefined;
    let marketValue: number | undefined;
    let valuationSource: string;
    let _staleQuote: boolean | undefined;

    if (quotePrice !== undefined && quotePrice > 0) {
        currentPrice = quotePrice;
        marketValue = quantity * quotePrice;
        valuationSource = 'longbridge_quote';
    } else if (rawMarketValue !== undefined && rawMarketValue > 0) {
        marketValue = rawMarketValue;
        currentPrice = rawCurrentPrice !== undefined && rawCurrentPrice > 0 
            ? rawCurrentPrice 
            : (quantity > 0 ? rawMarketValue / quantity : undefined);
        valuationSource = 'longbridge_position_value';
    } else if (rawCurrentPrice !== undefined && rawCurrentPrice > 0) {
        currentPrice = rawCurrentPrice;
        marketValue = quantity * rawCurrentPrice;
        valuationSource = 'longbridge_position_price';
    } else if (costPrice !== undefined && costPrice > 0) {
        currentPrice = costPrice;
        marketValue = quantity * costPrice;
        valuationSource = 'cost_basis_estimate';
        _staleQuote = true;
    } else {
        marketValue = undefined;
        currentPrice = undefined;
        valuationSource = 'missing_quote';
    }

    return { currentPrice, marketValue, valuationSource, _staleQuote };
}

const fetchQuotesUsingAccount = async (symbols: string[], account: LongbridgeAccount): Promise<Record<string, number>> => {
    let accessToken = (account.accessToken || '').trim();
    let appKey = (account.appKey || '').trim();
    let appSecret = (account.appSecret || '').trim();

    if (!accessToken || symbols.length === 0) return {};

    const executeFetch = async (query: string): Promise<Record<string, number>> => {
        try {
            const method = 'GET';
            const path = '/v1/quote/quote';
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
            
            if (lbData.code === 0 && lbData.data) {
                let list: any[] = [];
                if (Array.isArray(lbData.data)) {
                    list = lbData.data;
                } else if (lbData.data) {
                    list = lbData.data.list || lbData.data.items || lbData.data.quotes || [];
                    if (!Array.isArray(list) && typeof lbData.data === 'object') {
                        list = [lbData.data];
                    }
                }
                
                if (Array.isArray(list) && list.length > 0) {
                    const quotes: Record<string, number> = {};
                    list.forEach((q: any) => {
                        if (!q) return;
                        const symbol = q.symbol || q.stock_info?.symbol;
                        if (!symbol) return;
                        const px = parseNum(
                            q.last_done,
                            q.lastDone,
                            q.price,
                            q.current_price,
                            q.last_price
                        );
                        if (px !== undefined && px > 0) {
                            quotes[normalizeSymbol(symbol)] = px;
                        }
                    });
                    return quotes;
                }
            }
        } catch (e) {
            console.warn(`[Longbridge Adapter] Quote fetch (query: ${query}) failed:`, e);
        }
        return {};
    };

    const commaQuery = `symbol=${symbols.join(',')}`;
    let quotes = await executeFetch(commaQuery);

    if (Object.keys(quotes).length === 0 && symbols.length > 0) {
        console.log(`[Longbridge Adapter] Comma query returned no quotes, attempting repeated query fallback...`);
        const repeatedQuery = symbols.map(s => `symbol=${s}`).join('&');
        quotes = await executeFetch(repeatedQuery);
    }

    return quotes;
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

                const qty = parseNum(
                    p.quantity,
                    p.qty,
                    p.available_quantity,
                    p.stock_info?.quantity,
                    p.stock_info?.qty
                ) ?? 0;

                const costPrice = parseNum(
                    p.costPrice,
                    p.cost_price,
                    p.average_cost,
                    p.avg_cost,
                    p.stock_info?.cost_price,
                    p.stock_info?.average_cost
                ) ?? 0;

                const mktVal = pickMarketValue(p);
                const currPrice = pickCurrentPrice(p);
                const currency = p.currency || p.stock_info?.currency || 'USD';
                
                positions.push({
                    symbol: symbol,
                    name: p.symbolName || p.name || p.stock_info?.name || p.symbol || p.stock_info?.symbol,
                    quantity: qty,
                    costPrice: costPrice,
                    currency: currency,
                    accountId: account.id || account.name,
                    accountName: account.name,
                    rawMarketValue: (mktVal !== undefined && mktVal > 0) ? mktVal : undefined,
                    rawCurrentPrice: (currPrice !== undefined && currPrice > 0) ? currPrice : undefined
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
        
        const quotePrice = quotes[symbol];
        
        const val = determineValuation(
            raw.quantity,
            quotePrice,
            raw.rawMarketValue,
            raw.rawCurrentPrice,
            raw.costPrice
        );

        const accountBreakdownRow = {
            accountId: raw.accountId,
            accountName: raw.accountName,
            quantity: raw.quantity,
            costPrice: raw.costPrice,
            currentPrice: val.currentPrice,
            marketValue: val.marketValue,
            valuationSource: val.valuationSource,
            _staleQuote: val._staleQuote
        };

        if (existing) {
            const totalQty = existing.quantity + raw.quantity;
            const newCostPrice = totalQty > 0 ? ((existing.quantity * existing.costPrice) + (raw.quantity * raw.costPrice)) / totalQty : 0;
            
            const combinedVal = determineValuation(
                totalQty,
                quotePrice,
                existing.marketValue !== undefined || val.marketValue !== undefined 
                    ? (existing.marketValue || 0) + (val.marketValue || 0) 
                    : undefined,
                quotePrice || val.currentPrice || existing.currentPrice,
                newCostPrice
            );

            existing.quantity = totalQty;
            existing.costPrice = newCostPrice;
            existing.currentPrice = combinedVal.currentPrice;
            existing.marketValue = combinedVal.marketValue;
            existing.value = combinedVal.marketValue;
            existing.valuationSource = combinedVal.valuationSource;
            existing._staleQuote = combinedVal._staleQuote;
            existing.accountBreakdown?.push(accountBreakdownRow);
        } else {
            positionMap.set(symbol, {
                symbol,
                name: raw.name,
                currency: raw.currency,
                quantity: raw.quantity,
                costPrice: raw.costPrice,
                currentPrice: val.currentPrice,
                marketValue: val.marketValue,
                value: val.marketValue,
                _staleQuote: val._staleQuote,
                valuationSource: val.valuationSource,
                accountBreakdown: [accountBreakdownRow]
            });
        }
    });

    const finalPositions = Array.from(positionMap.values()).sort((a, b) => (b.marketValue || 0) - (a.marketValue || 0));

    const quoteCoverage = uniqueSymbols.length > 0 ? Object.keys(quotes).length / uniqueSymbols.length : 1;
    const missingQuoteSymbols = uniqueSymbols.filter(s => !quotes[s]);

    const estimatedValuationSymbols = finalPositions
        .filter(p => p.valuationSource === 'cost_basis_estimate')
        .map(p => p.symbol);
    
    const missingValuationSymbols = finalPositions
        .filter(p => p.marketValue === undefined)
        .map(p => p.symbol);

    const valuedCount = finalPositions.filter(p => p.marketValue !== undefined).length;
    const valuationCoverage = finalPositions.length > 0 ? valuedCount / finalPositions.length : 1;

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
            valuationCoverage,
            missingValuationSymbols,
            estimatedValuationSymbols,
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
    value?: number;
    _staleQuote?: boolean;
    currency?: string;
    valuationSource: string;
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
        valuationCoverage?: number;
        missingValuationSymbols?: string[];
        estimatedValuationSymbols?: string[];
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
                    const quotePrice = quotes[symbol];
                    
                    const val = determineValuation(
                        raw.quantity,
                        quotePrice,
                        raw.rawMarketValue,
                        raw.rawCurrentPrice,
                        raw.costPrice
                    );

                    return {
                        symbol,
                        name: raw.name,
                        quantity: raw.quantity,
                        costPrice: raw.costPrice,
                        currentPrice: val.currentPrice,
                        marketValue: val.marketValue,
                        value: val.marketValue,
                        _staleQuote: val._staleQuote,
                        currency: raw.currency,
                        valuationSource: val.valuationSource,
                        accountId: raw.accountId,
                        accountName: raw.accountName
                    };
                });

            const missingQuoteSymbols = uniqueSymbols.filter(s => !quotes[s]);
            const quoteCoverage = uniqueSymbols.length > 0 ? Object.keys(quotes).length / uniqueSymbols.length : 1;

            const estimatedValuationSymbols = positions
                .filter(p => p.valuationSource === 'cost_basis_estimate')
                .map(p => p.symbol);
            
            const missingValuationSymbols = positions
                .filter(p => p.marketValue === undefined)
                .map(p => p.symbol);

            const valuedCount = positions.filter(p => p.marketValue !== undefined).length;
            const valuationCoverage = positions.length > 0 ? valuedCount / positions.length : 1;

            portfolios.push({
                accountId: acc.id || acc.name,
                accountName: acc.name,
                positions,
                meta: {
                    positionCount: positions.length,
                    quoteCoverage,
                    missingQuoteSymbols,
                    valuationCoverage,
                    missingValuationSymbols,
                    estimatedValuationSymbols,
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
