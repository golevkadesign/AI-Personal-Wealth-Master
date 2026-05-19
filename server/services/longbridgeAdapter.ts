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
}

const fetchSingleAccountPositions = async (account: LongbridgeAccount): Promise<AggregatedPosition[]> => {
    console.log(`[Longbridge Adapter] 正在请求实盘账户: ${account.name}...`);
    
    try {
        // TODO: 请基于项目根目录下的 test-lb2.ts 的真实长桥 OpenAPI 调用逻辑，在这里发起真实的网络请求。
        // 使用 account.appKey, account.appSecret, account.accessToken 进行鉴权。
        
        // 由于尚未注入完整的 test-lb2.ts 逻辑，我们先返回空数组，阻止幻觉 Mock 数据破坏大盘：
        // 真实的 SDK 接入后，请确保返回的数组格式严格为：
        // return [{ symbol: "AAPL", name: "Apple", quantity: 100, costPrice: 150 }];
        
        console.warn(`[Longbridge Adapter] 实盘 SDK 尚未完全映射，当前账户 ${account.name} 暂时返回空持仓。请集成真实的 OpenAPI 请求。`);
        return [];
        
    } catch (error) {
        console.error(`[Longbridge Adapter] 账户 ${account.name} 抓取异常:`, error);
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
                    
                    positionMap.set(pos.symbol, {
                        ...existing,
                        quantity: totalQty,
                        costPrice: newCostPrice
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
