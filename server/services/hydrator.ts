import { getRealTimeQuotes } from "./marketData";
import { extractTickers } from "./utils";
import { analyzeStock } from "./quantEngine";
import { aggregateLongbridgePortfolios } from "./longbridgeAdapter";

import * as crypto from 'crypto';

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

class MarketDataProvider implements DataProvider {
    name = "MarketData";
    
    async fetch({ message, contextData, extractedTickers }: DataProviderParams) {
        let symbolsToFetch = extractedTickers || [];
        if (!symbolsToFetch || symbolsToFetch.length === 0) {
            const allText = message + JSON.stringify(contextData?.distributions?.publicHoldings || []);
            symbolsToFetch = extractTickers(allText);
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
    if (contextData?.livePortfolioAccounts) {
        hydratedData.livePortfolioAccounts = contextData.livePortfolioAccounts;
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

    // 💥 [新增] 第一防线：优先聚合长桥实盘多账户数据
    if (settings?.longbridgeAccounts && settings.longbridgeAccounts.length > 0) {
        console.log(`[Hydrator] 侦测到长桥配置，启动多账户实盘聚合...`);
        const lbResult = await aggregateLongbridgePortfolios(settings.longbridgeAccounts);
        const lbHoldings = lbResult.positions;
        
        if (lbHoldings && lbHoldings.length > 0) {
            const lbMappedHoldings = lbHoldings.map(pos => ({
                symbol: pos.symbol,
                name: pos.name,
                quantity: pos.quantity,
                costPrice: pos.costPrice,
                currentPrice: pos.currentPrice,
                marketValue: pos.marketValue, // 已经精确计算
                value: pos.value
            }));

            // 利用 Map 进行基于 symbol 的去重合并 (长桥优先级最高，后写入)
            const mergedMap = new Map();
            
            manualHoldings.forEach((h: any) => {
                const key = h.symbol || h.name;
                if (key) mergedMap.set(key, h);
            });
            
            lbMappedHoldings.forEach((h: any) => {
                mergedMap.set(h.symbol, h); // 如果长桥也有，直接用长桥的绝对精准数据覆盖手填数据
            });

            // 将合并后的集合转回数组
            workingPortfolio = Array.from(mergedMap.values());
            hydratedData.livePortfolio = workingPortfolio;
        }
    }
    
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
