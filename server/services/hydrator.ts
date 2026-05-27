import { getRealTimeQuotes } from "./marketData";
import { extractTickers } from "./utils";
import { analyzeStock } from "./quantEngine";

interface DataProviderParams {
    message: string;
    contextData: any;
    settings: any;
    userId?: string;
    extractedTickers?: string[];
}

export interface DataProvider {
    name: string;
    fetch(params: DataProviderParams): Promise<{ source: string, payload: any }>;
}

const CACHE_TTL = 5 * 60 * 1000;
const cache = new Map<string, { timestamp: number, data: any }>();

export function flattenSymbolsFromAccountPortfolios(livePortfolioAccounts: any[]): string[] {
    if (!Array.isArray(livePortfolioAccounts)) return [];
    const symbols = new Set<string>();
    livePortfolioAccounts.forEach(account => {
        if (account && Array.isArray(account.positions)) {
            account.positions.forEach((pos: any) => {
                if (pos && pos.symbol) {
                    symbols.add(pos.symbol);
                }
            });
        }
    });
    return Array.from(symbols);
}

class MarketDataProvider implements DataProvider {
    name = "MarketData";
    
    async fetch({ message, contextData, extractedTickers }: DataProviderParams) {
        let symbolsToFetch = extractedTickers || [];
        if (!symbolsToFetch || symbolsToFetch.length === 0) {
            const liveAccounts = contextData?.livePortfolioAccounts || contextData?.publicHoldingAccounts;
            const acctSymbols = flattenSymbolsFromAccountPortfolios(liveAccounts);
            if (acctSymbols.length > 0) {
                symbolsToFetch = acctSymbols;
            } else {
                const publicHoldings = contextData?.distributions?.publicHoldings;
                if (Array.isArray(publicHoldings) && publicHoldings.length > 0) {
                    const extFromHoldings = publicHoldings.map((h: any) => h.symbol).filter(Boolean);
                    if (extFromHoldings.length > 0) {
                        symbolsToFetch = extFromHoldings;
                    }
                }
            }
            if (symbolsToFetch.length === 0) {
                symbolsToFetch = extractTickers(message);
            }
        }
        
        if (symbolsToFetch.length === 0) return { source: this.name, payload: null };
        
        const cacheKey = `market_${symbolsToFetch.sort().join('_')}`;
        const cached = cache.get(cacheKey);
        if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
            return { source: `${this.name} (Cache)`, payload: cached.data };
        }
        
        try {
            const data = await getRealTimeQuotes(symbolsToFetch);
            cache.set(cacheKey, { timestamp: Date.now(), data });
            return { source: this.name, payload: data };
        } catch (e) {
            console.error("MarketData fetch error:", e);
            return { source: this.name, payload: null };
        }
    }
}

class FirebaseStaticProvider implements DataProvider {
    name = "FirebaseStatic";
    async fetch({ contextData }: any) {
         // This can handle custom logic for formatting existing RAG static profiles if needed
         return { source: this.name, payload: contextData?.userProfile || null };
    }
}

// Registry of providers to allow easy plug-and-play decoupling
export const dataProviders: DataProvider[] = [
    new FirebaseStaticProvider(),
    new MarketDataProvider(),
    ];

export async function hydrateContext(message: string, contextData: any, settings: any, onProgress?: (msg: string) => void, userId?: string, extractedTickers: string[] = []) {
    if (onProgress) onProgress("⏳ [阶段 2.1] 启动 Context Hydrator 进行子节点并发提取调度...");
    
    // Run all providers concurrently
    const results = await Promise.all(
        dataProviders.map(p => p.fetch({ message, contextData, settings, userId, extractedTickers }))
    );
    
    const hydratedData: any = { marketData: {} };
    const liveAccounts = contextData?.livePortfolioAccounts || contextData?.publicHoldingAccounts;
    if (liveAccounts) {
        hydratedData.livePortfolioAccounts = liveAccounts;
        hydratedData.publicHoldingAccounts = liveAccounts;
    }
    const sources: string[] = [];
    
    for (const res of results) {
        if (res.payload) {
            sources.push(res.source);
            if (res.source.startsWith("MarketData")) {
                hydratedData.marketData = res.payload;
            } else if (res.source.startsWith("LongbridgeLive")) {
                hydratedData.livePortfolio = res.payload.livePortfolio;
            } else if (res.source.includes("FirebaseStatic")) {
                 hydratedData.staticProfile = res.payload;
            }
        }
    }
    
    // 获取手动填报或已有的持仓数据
    let manualHoldings: any[] = [];
    if (hydratedData.livePortfolio && hydratedData.livePortfolio.length > 0) {
        manualHoldings = hydratedData.livePortfolio;
    } else if (contextData?.distributions?.publicHoldings?.length > 0) {
        manualHoldings = JSON.parse(JSON.stringify(contextData.distributions.publicHoldings));
    }

    let workingPortfolio = manualHoldings;
    
    // 💥 植入量化指标洗注逻辑
    if (workingPortfolio && workingPortfolio.length > 0) {
        workingPortfolio = await Promise.all(
            workingPortfolio.map(async (holding: any) => {
                const symbolToFetch = holding.symbol || (holding.name && holding.name.length <= 6 && holding.name === holding.name.toUpperCase() ? holding.name : null);
                
                if (symbolToFetch) {
                    const quantData = await analyzeStock(symbolToFetch);
                    if (quantData) {
                        return {
                            ...holding,
                            symbol: symbolToFetch,
                            value: holding.quantity ? holding.quantity * quantData.currentPrice : (holding.value || 0),
                            marketValue: holding.quantity ? holding.quantity * quantData.currentPrice : (holding.marketValue || 0),
                            quantSignals: quantData
                        };
                    }
                }
                return holding;
            })
        );
    }
    
    if (workingPortfolio && workingPortfolio.length > 0 && hydratedData.marketData) {
        for (const pos of workingPortfolio) {
            const sym = pos.symbol || pos.name || '';
            let mData = hydratedData.marketData[sym];
            if (!mData) {
                const foundKey = Object.keys(hydratedData.marketData).find(k => k.includes(sym) || sym.includes(k));
                if (foundKey) mData = hydratedData.marketData[foundKey];
            }
            if (mData && mData.price) {
                const quantity = Number(pos.quantity || 0);
                if (quantity > 0) {
                    pos.marketValue = Number((mData.price * quantity).toFixed(3));
                } else if (pos.marketValue > 0) {
                    pos.quantity = Number((pos.marketValue / mData.price).toFixed(3));
                }
                pos._livePrice = mData.price;
            }
        }
        hydratedData.livePortfolio = workingPortfolio;
    }
    
    if (sources.length > 0 && onProgress) {
        onProgress(`✅ [阶段 2.3] 数据注水完成，激活聚合数据源: ${sources.join(', ')}`);
    }
    
    return hydratedData;
}
