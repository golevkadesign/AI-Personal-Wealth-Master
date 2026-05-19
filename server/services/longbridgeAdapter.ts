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

// 模拟长桥单账户抓取
const fetchSingleAccountPositions = async (account: LongbridgeAccount): Promise<AggregatedPosition[]> => {
    console.log(`[Longbridge Adapter] 正在请求实盘账户: ${account.name}...`);
    // 模拟重叠的数据
    if (account.name.includes("1")) {
        return [{ symbol: "AAPL", name: "Apple", quantity: 100, costPrice: 170 }];
    } else {
        return [{ symbol: "AAPL", name: "Apple", quantity: 50, costPrice: 180 }, { symbol: "TSLA", name: "Tesla", quantity: 200, costPrice: 200 }];
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
