import * as crypto from 'crypto';
import { loadLongbridgeSdk } from './longbridgeNative';

// server/services/longbridgeAdapter.ts
export interface LongbridgeAccount {
    id: string; name: string; appKey: string; appSecret: string; accessToken: string;
}

export interface RawAccountPosition {
    symbol: string;
    name: string;
    quantity: number;
    availableQuantity?: number;
    costPrice: number;
    currency: string;
    market?: string;
    accountId: string;
    accountName: string;
    rawMarketValue?: number;
    rawCurrentPrice?: number;
    rawProfit?: number;
    rawProfitRate?: number;
    rawDailyPnl?: number;
    rawDailyPnlRate?: number;
    rawReturnSource?: string;
}

export interface AggregatedPosition {
    symbol: string;
    name: string;
    quantity: number;
    availableQuantity?: number;
    costPrice: number;
    currentPrice?: number;
    previousClose?: number;
    marketValue?: number;
    value?: number;
    currency?: string;
    market?: string;
    pnl?: number;
    pnlPercent?: number;
    dailyPnl?: number;
    dailyPnlPercent?: number;
    ownedPercent?: number;
    returnSource?: string;
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
            const cleaned = val.replace(/[,％%$¥￥]/g, '').trim();
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
    previousClose?: number;
    marketValue: number | undefined;
    pnl?: number;
    pnlPercent?: number;
    dailyPnl?: number;
    dailyPnlPercent?: number;
    returnSource?: string;
    valuationSource: string;
    _staleQuote?: boolean;
}

interface QuoteSnapshot {
    price?: number;
    previousClose?: number;
    source: string;
}

interface ProfitSnapshot {
    profit?: number;
    profitRate?: number;
    underlyingProfit?: number;
    derivativesProfit?: number;
    orderProfit?: number;
    source: 'longbridge_profit_analysis';
}

interface ProfitAnalysisResult {
    itemsBySymbol: Record<string, ProfitSnapshot>;
    meta: {
        available: boolean;
        itemCount: number;
        reason?: string;
        updatedAt?: string;
        updatedDate?: string;
        summaryProfit?: number;
        summaryProfitRate?: number;
    };
}

function normalizeRateToPercent(rate: number | undefined): number | undefined {
    if (rate === undefined || !isFinite(rate)) return undefined;
    return Math.abs(rate) <= 1 ? rate * 100 : rate;
}

function computeReturnMetrics(
    quantity: number,
    currentPrice: number | undefined,
    previousClose: number | undefined,
    costPrice: number | undefined,
    rawProfit?: number,
    rawProfitRate?: number,
    rawDailyPnl?: number,
    rawDailyPnlRate?: number,
    rawReturnSource?: string
): Pick<ValuationResult, 'pnl' | 'pnlPercent' | 'dailyPnl' | 'dailyPnlPercent' | 'returnSource'> {
    const pnl = rawProfit !== undefined
        ? rawProfit
        : (currentPrice !== undefined && costPrice !== undefined && costPrice !== 0
            ? (currentPrice - costPrice) * quantity
            : undefined);

    const pnlPercent = rawProfitRate !== undefined
        ? rawProfitRate
        : (currentPrice !== undefined && costPrice !== undefined && costPrice !== 0
            ? ((currentPrice - costPrice) / Math.abs(costPrice)) * 100
            : undefined);

    const dailyPnl = rawDailyPnl !== undefined
        ? rawDailyPnl
        : (currentPrice !== undefined && previousClose !== undefined && previousClose > 0
            ? (currentPrice - previousClose) * quantity
            : undefined);

    const dailyPnlPercent = rawDailyPnlRate !== undefined
        ? rawDailyPnlRate
        : (currentPrice !== undefined && previousClose !== undefined && previousClose > 0
            ? ((currentPrice - previousClose) / previousClose) * 100
            : undefined);

    return {
        pnl,
        pnlPercent,
        dailyPnl,
        dailyPnlPercent,
        returnSource: rawProfit !== undefined || rawProfitRate !== undefined || rawDailyPnl !== undefined || rawDailyPnlRate !== undefined
            ? (rawReturnSource || 'longbridge_position')
            : (pnl !== undefined || dailyPnl !== undefined ? 'derived_from_quote' : undefined)
    };
}

function determineValuation(
    quantity: number,
    quote: QuoteSnapshot | undefined,
    rawMarketValue: number | undefined,
    rawCurrentPrice: number | undefined,
    costPrice: number | undefined,
    rawProfit?: number,
    rawProfitRate?: number,
    rawDailyPnl?: number,
    rawDailyPnlRate?: number,
    rawReturnSource?: string
): ValuationResult {
    let currentPrice: number | undefined;
    let previousClose: number | undefined;
    let marketValue: number | undefined;
    let valuationSource: string;
    let _staleQuote: boolean | undefined;

    if (quote?.price !== undefined && quote.price > 0) {
        currentPrice = quote.price;
        previousClose = quote.previousClose;
        marketValue = quantity * quote.price;
        valuationSource = quote.source;
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
    } else if (costPrice !== undefined && costPrice !== 0) {
        const fallbackCostBasis = Math.abs(costPrice);
        currentPrice = fallbackCostBasis;
        marketValue = quantity * fallbackCostBasis;
        valuationSource = costPrice < 0 ? 'negative_cost_basis_estimate' : 'cost_basis_estimate';
        _staleQuote = true;
    } else {
        marketValue = undefined;
        currentPrice = undefined;
        valuationSource = 'missing_quote';
    }

    return {
        currentPrice,
        previousClose,
        marketValue,
        ...computeReturnMetrics(quantity, currentPrice, previousClose, costPrice, rawProfit, rawProfitRate, rawDailyPnl, rawDailyPnlRate, rawReturnSource),
        valuationSource,
        _staleQuote
    };
}

function buildLongbridgeHeaders(account: LongbridgeAccount, method: string, path: string, query = ''): Record<string, string> {
    let accessToken = (account.accessToken || '').trim();
    let appKey = (account.appKey || '').trim();
    let appSecret = (account.appSecret || '').trim();

    const headers: Record<string, string> = { 'Content-Type': 'application/json' };

    if (appKey && appSecret) {
        const timestamp = Date.now().toString();
        const signedHeaders = 'authorization;x-api-key;x-timestamp';
        const signedValues = `authorization:${accessToken}\nx-api-key:${appKey}\nx-timestamp:${timestamp}\n`;
        const strToSign = `${method}|${path}|${query}|${signedValues}|${signedHeaders}|`;
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

    return headers;
}

function extractQuoteList(lbData: any): any[] {
    if (!lbData) return [];
    const data = lbData.data ?? lbData;
    if (Array.isArray(data)) return data;
    if (Array.isArray(data?.secu_quote)) return data.secu_quote;
    if (Array.isArray(data?.quotes)) return data.quotes;
    if (Array.isArray(data?.list)) return data.list;
    if (Array.isArray(data?.items)) return data.items;
    if (Array.isArray(lbData?.secu_quote)) return lbData.secu_quote;
    return data && typeof data === 'object' ? [data] : [];
}

const fetchQuotesUsingAccount = async (symbols: string[], account: LongbridgeAccount): Promise<Record<string, QuoteSnapshot>> => {
    let accessToken = (account.accessToken || '').trim();

    if (!accessToken || symbols.length === 0) return {};

    const executeFetch = async (query: string): Promise<Record<string, QuoteSnapshot>> => {
        try {
            const method = 'GET';
            const path = '/v1/quote/quote';
            const headers = buildLongbridgeHeaders(account, method, path, query);
            
            const res = await fetch(`https://openapi.longbridgeapp.com${path}?${query}`, { headers, method });
            const lbData = await res.json();
            
            if ((lbData.code === 0 || lbData.code === undefined) && (lbData.data || lbData.secu_quote)) {
                const quotes: Record<string, QuoteSnapshot> = {};
                extractQuoteList(lbData).forEach((q: any) => {
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
                    const previousClose = parseNum(q.prev_close, q.prevClose, q.previous_close);
                    if (px !== undefined && px > 0) {
                        quotes[normalizeSymbol(symbol)] = {
                            price: px,
                            previousClose,
                            source: 'longbridge_quote'
                        };
                    }
                });
                return quotes;
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

    if (!accessToken) return [];

    try {
        const headers = buildLongbridgeHeaders(account, 'GET', '/v1/asset/stock');

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
                    p.stock_info?.quantity,
                    p.stock_info?.qty
                ) ?? 0;

                const availableQuantity = parseNum(
                    p.availableQuantity,
                    p.available_quantity,
                    p.stock_info?.availableQuantity,
                    p.stock_info?.available_quantity
                );

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
                const rawProfit = parseNum(p.pnl, p.profit, p.pl, p.unrealized_profit, p.stock_info?.pnl, p.stock_info?.profit);
                const rawProfitRate = normalizeRateToPercent(parseNum(p.pnlPercent, p.pnl_percent, p.profit_rate, p.pl_rate, p.stock_info?.profit_rate));
                const rawDailyPnl = parseNum(p.dailyPnl, p.daily_pnl, p.daily_profit, p.today_profit, p.stock_info?.daily_pnl, p.stock_info?.today_profit);
                const rawDailyPnlRate = normalizeRateToPercent(parseNum(p.dailyPnlPercent, p.daily_pnl_percent, p.daily_profit_rate, p.today_profit_rate, p.stock_info?.daily_profit_rate));
                const currency = p.currency || p.stock_info?.currency || 'USD';
                const market = p.market || p.stock_info?.market;
                
                positions.push({
                    symbol: symbol,
                    name: p.symbolName || p.symbol_name || p.name || p.stock_info?.symbolName || p.stock_info?.symbol_name || p.stock_info?.name || p.symbol || p.stock_info?.symbol,
                    quantity: qty,
                    availableQuantity,
                    costPrice: costPrice,
                    currency: currency,
                    market,
                    accountId: account.id || account.name,
                    accountName: account.name,
                    rawMarketValue: (mktVal !== undefined && mktVal > 0) ? mktVal : undefined,
                    rawCurrentPrice: (currPrice !== undefined && currPrice > 0) ? currPrice : undefined,
                    rawProfit,
                    rawProfitRate,
                    rawDailyPnl,
                    rawDailyPnlRate
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

function unwrapLongbridgeSdkResult(value: any): any {
    if (!value) return value;
    if (typeof value.toJSON === 'function') return value.toJSON();
    if (typeof value.toObject === 'function') return value.toObject();
    try {
        return JSON.parse(JSON.stringify(value));
    } catch {
        return value;
    }
}

function registerProfitSnapshot(
    map: Record<string, ProfitSnapshot>,
    key: any,
    snapshot: ProfitSnapshot
) {
    const normalizedKey = normalizeSymbol(key);
    if (!normalizedKey) return;
    map[normalizedKey] = snapshot;
}

function extractProfitAnalysisItems(payload: any): any[] {
    if (!payload) return [];
    const data = payload.data ?? payload;
    const sublist = data.sublist ?? data.sub_list ?? data.pnl_sublist;
    if (Array.isArray(data.items)) return data.items;
    if (Array.isArray(sublist?.items)) return sublist.items;
    if (Array.isArray(sublist?.list)) return sublist.list;
    if (Array.isArray(data.sublist)) return data.sublist;
    return [];
}

async function fetchProfitAnalysisUsingAccount(account: LongbridgeAccount): Promise<ProfitAnalysisResult> {
    const appKey = (account.appKey || '').trim();
    const appSecret = (account.appSecret || '').trim();
    const accessToken = (account.accessToken || '').trim();

    if (!appKey || !appSecret || !accessToken) {
        return { itemsBySymbol: {}, meta: { available: false, itemCount: 0, reason: 'missing_api_key_or_token' } };
    }

    try {
        const lb = await loadLongbridgeSdk();
        const Config = lb.Config;
        const PortfolioContext = lb.PortfolioContext;

        if (!Config || !PortfolioContext?.new) {
            return { itemsBySymbol: {}, meta: { available: false, itemCount: 0, reason: 'portfolio_context_unavailable' } };
        }

        const config = Config.fromApikey(appKey, appSecret, accessToken);
        const portfolioContext = PortfolioContext.new(config);
        const result = unwrapLongbridgeSdkResult(await portfolioContext.profitAnalysis(null, null));
        const data = result?.data ?? result ?? {};
        const summary = data.summary ?? {};
        const sublist = data.sublist ?? data.sub_list ?? {};
        const items = extractProfitAnalysisItems(data);
        const itemsBySymbol: Record<string, ProfitSnapshot> = {};

        items.forEach((item: any) => {
            const symbol = item.symbol || item.securityCode || item.security_code;
            const securityCode = item.securityCode || item.security_code || symbol;
            const market = item.market;
            const profit = parseNum(item.profit, item.pnl, item.pl);
            const profitRate = normalizeRateToPercent(parseNum(item.profitRate, item.profit_rate, item.pnlPercent, item.pnl_percent));
            const snapshot: ProfitSnapshot = {
                profit,
                profitRate,
                underlyingProfit: parseNum(item.underlyingProfit, item.underlying_profit),
                derivativesProfit: parseNum(item.derivativesProfit, item.derivatives_profit),
                orderProfit: parseNum(item.orderProfit, item.order_profit),
                source: 'longbridge_profit_analysis'
            };

            registerProfitSnapshot(itemsBySymbol, symbol, snapshot);
            if (market && securityCode) {
                registerProfitSnapshot(itemsBySymbol, `${securityCode}.${market}`, snapshot);
            }
        });

        return {
            itemsBySymbol,
            meta: {
                available: true,
                itemCount: items.length,
                updatedAt: sublist.updatedAt || sublist.updated_at,
                updatedDate: sublist.updatedDate || sublist.updated_date,
                summaryProfit: parseNum(summary.sumProfit, summary.sum_profit),
                summaryProfitRate: normalizeRateToPercent(parseNum(summary.sumProfitRate, summary.sum_profit_rate))
            }
        };
    } catch (err: any) {
        console.warn(`[Longbridge Adapter] Portfolio P&L analysis unavailable for ${account.name}:`, err?.message || err);
        return {
            itemsBySymbol: {},
            meta: {
                available: false,
                itemCount: 0,
                reason: err?.message || 'profit_analysis_failed'
            }
        };
    }
}

function applyProfitAnalysisToPositions(
    positions: RawAccountPosition[],
    itemsBySymbol: Record<string, ProfitSnapshot>
): RawAccountPosition[] {
    return positions.map(position => {
        const direct = itemsBySymbol[position.symbol];
        const baseSymbol = normalizeSymbol(position.symbol.split('.')[0]);
        const profit = direct || itemsBySymbol[baseSymbol];
        if (!profit) return position;

        const rawProfit = profit.profit ?? profit.underlyingProfit ?? profit.orderProfit;
        return {
            ...position,
            rawProfit: rawProfit ?? position.rawProfit,
            rawProfitRate: profit.profitRate ?? position.rawProfitRate,
            rawReturnSource: rawProfit !== undefined || profit.profitRate !== undefined
                ? profit.source
                : position.rawReturnSource
        };
    });
}

async function fetchSingleAccountSnapshot(account: LongbridgeAccount): Promise<{
    accountId: string;
    accountName: string;
    positions: RawAccountPosition[];
    profitAnalysis: ProfitAnalysisResult['meta'];
}> {
    const [positions, profitAnalysis] = await Promise.all([
        fetchSingleAccountPositions(account),
        fetchProfitAnalysisUsingAccount(account)
    ]);

    return {
        accountId: account.id || account.name,
        accountName: account.name,
        positions: applyProfitAnalysisToPositions(positions, profitAnalysis.itemsBySymbol),
        profitAnalysis: profitAnalysis.meta
    };
}

export const aggregateLongbridgePortfolios = async (accounts: LongbridgeAccount[]): Promise<{ positions: AggregatedPosition[], meta: any }> => {
    if (!accounts || accounts.length === 0) return { positions: [], meta: {} };
    
    const results = await Promise.allSettled(accounts.map(acc => fetchSingleAccountSnapshot(acc)));
    
    const rawPositions: RawAccountPosition[] = [];
    let successCount = 0;
    const profitAnalysisByAccount: Record<string, ProfitAnalysisResult['meta']> = {};
    results.forEach(result => {
        if (result.status === 'fulfilled' && result.value) {
            successCount++;
            rawPositions.push(...result.value.positions);
            profitAnalysisByAccount[result.value.accountName || result.value.accountId] = result.value.profitAnalysis;
        } else if (result.status === 'rejected') {
            console.error(`[Longbridge Adapter] 某账户拉取失败:`, result.reason);
        }
    });

    if (successCount === 0 && accounts.length > 0) {
        throw new Error("All Longbridge accounts failed to sync. Check network or API keys.");
    }

    const uniqueSymbols = Array.from(new Set(rawPositions.map(p => p.symbol)));
    const firstAccount = accounts.find(a => a.appKey && a.appSecret && a.accessToken) || accounts[0];
    const quotes: Record<string, QuoteSnapshot> = {};

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
        
        const quote = quotes[symbol];
        
        const val = determineValuation(
            raw.quantity,
            quote,
            raw.rawMarketValue,
            raw.rawCurrentPrice,
            raw.costPrice,
            raw.rawProfit,
            raw.rawProfitRate,
            raw.rawDailyPnl,
            raw.rawDailyPnlRate,
            raw.rawReturnSource
        );

        const accountBreakdownRow = {
            accountId: raw.accountId,
            accountName: raw.accountName,
            quantity: raw.quantity,
            availableQuantity: raw.availableQuantity,
            costPrice: raw.costPrice,
            currentPrice: val.currentPrice,
            previousClose: val.previousClose,
            marketValue: val.marketValue,
            pnl: val.pnl,
            pnlPercent: val.pnlPercent,
            dailyPnl: val.dailyPnl,
            dailyPnlPercent: val.dailyPnlPercent,
            returnSource: val.returnSource,
            valuationSource: val.valuationSource,
            _staleQuote: val._staleQuote
        };

        if (existing) {
            const totalQty = existing.quantity + raw.quantity;
            const newCostPrice = totalQty > 0 ? ((existing.quantity * existing.costPrice) + (raw.quantity * raw.costPrice)) / totalQty : 0;
            
            const combinedVal = determineValuation(
                totalQty,
                quote,
                existing.marketValue !== undefined || val.marketValue !== undefined 
                    ? (existing.marketValue || 0) + (val.marketValue || 0) 
                    : undefined,
                quote?.price || val.currentPrice || existing.currentPrice,
                newCostPrice,
                existing.pnl !== undefined || val.pnl !== undefined ? (existing.pnl || 0) + (val.pnl || 0) : undefined,
                undefined,
                existing.dailyPnl !== undefined || val.dailyPnl !== undefined ? (existing.dailyPnl || 0) + (val.dailyPnl || 0) : undefined,
                undefined,
                existing.returnSource === 'longbridge_profit_analysis' || val.returnSource === 'longbridge_profit_analysis'
                    ? 'longbridge_profit_analysis'
                    : undefined
            );

            existing.quantity = totalQty;
            existing.availableQuantity = (existing.availableQuantity || 0) + (raw.availableQuantity || 0);
            existing.costPrice = newCostPrice;
            existing.currentPrice = combinedVal.currentPrice;
            existing.previousClose = combinedVal.previousClose;
            existing.marketValue = combinedVal.marketValue;
            existing.value = combinedVal.marketValue;
            existing.pnl = combinedVal.pnl;
            existing.pnlPercent = combinedVal.pnlPercent;
            existing.dailyPnl = combinedVal.dailyPnl;
            existing.dailyPnlPercent = combinedVal.dailyPnlPercent;
            existing.returnSource = combinedVal.returnSource;
            existing.valuationSource = combinedVal.valuationSource;
            existing._staleQuote = combinedVal._staleQuote;
            existing.accountBreakdown?.push(accountBreakdownRow);
        } else {
            positionMap.set(symbol, {
                symbol,
                name: raw.name,
                currency: raw.currency,
                market: raw.market,
                quantity: raw.quantity,
                availableQuantity: raw.availableQuantity,
                costPrice: raw.costPrice,
                currentPrice: val.currentPrice,
                previousClose: val.previousClose,
                marketValue: val.marketValue,
                value: val.marketValue,
                pnl: val.pnl,
                pnlPercent: val.pnlPercent,
                dailyPnl: val.dailyPnl,
                dailyPnlPercent: val.dailyPnlPercent,
                returnSource: val.returnSource,
                _staleQuote: val._staleQuote,
                valuationSource: val.valuationSource,
                accountBreakdown: [accountBreakdownRow]
            });
        }
    });

    const finalPositions = Array.from(positionMap.values()).sort((a, b) => (b.marketValue || 0) - (a.marketValue || 0));
    const totalMarketValue = finalPositions.reduce((sum, p) => sum + (p.marketValue || 0), 0);
    finalPositions.forEach(p => {
        if (totalMarketValue > 0 && p.marketValue !== undefined) {
            p.ownedPercent = (p.marketValue / totalMarketValue) * 100;
        }
    });

    const quoteCoverage = uniqueSymbols.length > 0 ? Object.keys(quotes).length / uniqueSymbols.length : 1;
    const missingQuoteSymbols = uniqueSymbols.filter(s => !quotes[s]);

    const estimatedValuationSymbols = finalPositions
        .filter(p => p.valuationSource === 'cost_basis_estimate' || p.valuationSource === 'negative_cost_basis_estimate')
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
            previousClose: p.previousClose,
            marketValue: p.marketValue,
            costPrice: p.costPrice,
            pnl: p.pnl,
            dailyPnl: p.dailyPnl,
            valuationSource: p.valuationSource,
            accountCount: p.accountBreakdown?.length
        }));
        console.table(debugPositions);
    }

    return {
        positions: finalPositions,
        meta: {
            valuationVersion: 5,
            accountCount: accounts.length,
            positionCount: finalPositions.length,
            quoteCoverage,
            missingQuoteSymbols,
            valuationCoverage,
            missingValuationSymbols,
            estimatedValuationSymbols,
            totalMarketValue,
            profitAnalysisByAccount,
            generatedAt: Date.now()
        }
    };
};

export interface AccountPosition {
    symbol: string;
    name: string;
    quantity: number;
    availableQuantity?: number;
    costPrice: number;
    currentPrice?: number;
    previousClose?: number;
    marketValue?: number;
    value?: number;
    pnl?: number;
    pnlPercent?: number;
    dailyPnl?: number;
    dailyPnlPercent?: number;
    ownedPercent?: number;
    returnSource?: string;
    _staleQuote?: boolean;
    currency?: string;
    market?: string;
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
        profitAnalysisAvailable?: boolean;
        profitAnalysisItemCount?: number;
        profitAnalysisMissingSymbols?: string[];
        profitAnalysisReason?: string;
        profitAnalysisUpdatedAt?: string;
        profitAnalysisUpdatedDate?: string;
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
            const snapshot = await fetchSingleAccountSnapshot(acc);
            const rawPositions = snapshot.positions;
            
            const uniqueSymbols = Array.from(new Set(rawPositions.map(p => p.symbol)));
            const quotes: Record<string, QuoteSnapshot> = {};
            
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
                    const quote = quotes[symbol];
                    
                    const val = determineValuation(
                        raw.quantity,
                        quote,
                        raw.rawMarketValue,
                        raw.rawCurrentPrice,
                        raw.costPrice,
                        raw.rawProfit,
                        raw.rawProfitRate,
                        raw.rawDailyPnl,
                        raw.rawDailyPnlRate,
                        raw.rawReturnSource
                    );

                    return {
                        symbol,
                        name: raw.name,
                        quantity: raw.quantity,
                        availableQuantity: raw.availableQuantity,
                        costPrice: raw.costPrice,
                        currentPrice: val.currentPrice,
                        previousClose: val.previousClose,
                        marketValue: val.marketValue,
                        value: val.marketValue,
                        pnl: val.pnl,
                        pnlPercent: val.pnlPercent,
                        dailyPnl: val.dailyPnl,
                        dailyPnlPercent: val.dailyPnlPercent,
                        returnSource: val.returnSource,
                        _staleQuote: val._staleQuote,
                        currency: raw.currency,
                        market: raw.market,
                        valuationSource: val.valuationSource,
                        accountId: raw.accountId,
                        accountName: raw.accountName
                    };
                });

            const accountMarketValue = positions.reduce((sum, p) => sum + (p.marketValue || 0), 0);
            positions.forEach(p => {
                if (accountMarketValue > 0 && p.marketValue !== undefined) {
                    p.ownedPercent = (p.marketValue / accountMarketValue) * 100;
                }
            });

            const missingQuoteSymbols = uniqueSymbols.filter(s => !quotes[s]);
            const quoteCoverage = uniqueSymbols.length > 0 ? Object.keys(quotes).length / uniqueSymbols.length : 1;

            const estimatedValuationSymbols = positions
                .filter(p => p.valuationSource === 'cost_basis_estimate' || p.valuationSource === 'negative_cost_basis_estimate')
                .map(p => p.symbol);

            const profitAnalysisMissingSymbols = positions
                .filter(p => p.returnSource !== 'longbridge_profit_analysis')
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
                    profitAnalysisAvailable: snapshot.profitAnalysis.available,
                    profitAnalysisItemCount: snapshot.profitAnalysis.itemCount,
                    profitAnalysisMissingSymbols,
                    profitAnalysisReason: snapshot.profitAnalysis.reason,
                    profitAnalysisUpdatedAt: snapshot.profitAnalysis.updatedAt,
                    profitAnalysisUpdatedDate: snapshot.profitAnalysis.updatedDate,
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

export { determineValuation as _testDetermineValuation };
