import { PortfolioReviewSnapshot, PositionDelta, ReviewHolding } from '../../types/portfolio-review';

/**
 * Generates a unique key for matching holdings.
 * Prefers "accountId:symbol". If accountId is missing, falls back to "symbol".
 */
function getHoldingKey(holding: ReviewHolding): string {
  const accId = holding.accountId || '';
  const sym = holding.symbol || '';
  if (accId && sym) {
    return `${accId}:${sym}`;
  }
  return sym || holding.name || '';
}

export function diffPortfolioSnapshots(
  previous: PortfolioReviewSnapshot | undefined,
  current: PortfolioReviewSnapshot
): PositionDelta[] {
  const deltas: PositionDelta[] = [];
  const prevHoldings = previous?.flattenedHoldings || [];
  const curHoldings = current.flattenedHoldings || [];

  // Maps for efficient lookup
  const prevMap = new Map<string, ReviewHolding>();
  prevHoldings.forEach(h => {
    const key = getHoldingKey(h);
    if (key) {
      prevMap.set(key, h);
    }
  });

  const matchedPrevKeys = new Set<string>();

  // Compare and identify new/increase/reduce/unchanged/exit
  curHoldings.forEach(cur => {
    const key = getHoldingKey(cur);
    const prev = key ? prevMap.get(key) : undefined;
    
    const symbol = cur.symbol || cur.name || 'UNKNOWN';
    const name = cur.name || cur.symbol;
    const accountId = cur.accountId;
    const accountName = cur.accountName;

    const currentQty = cur.quantity || 0;
    const currentVal = cur.marketValue || 0;

    if (key) {
      matchedPrevKeys.add(key);
    }

    if (!prev) {
      // New Position
      if (currentQty > 0) {
        deltas.push({
          symbol,
          name,
          accountId,
          accountName,
          previousQuantity: 0,
          currentQuantity: currentQty,
          previousMarketValue: 0,
          currentMarketValue: currentVal,
          quantityDelta: currentQty,
          marketValueDelta: currentVal,
          actionType: 'new_position',
          confidence: 'high',
          reason: `新增持仓：在账户 ${accountName || accountId || '默认账户'} 中新买入 $${symbol} ${currentQty} 股，当前市值 $${currentVal.toFixed(2)}。`
        });
      } else {
        deltas.push({
          symbol,
          name,
          accountId,
          accountName,
          previousQuantity: 0,
          currentQuantity: currentQty,
          previousMarketValue: 0,
          currentMarketValue: currentVal,
          quantityDelta: 0,
          marketValueDelta: 0,
          actionType: 'unknown',
          confidence: 'medium',
          reason: `状态未知：检测到零股持仓且没有历史对比记录。`
        });
      }
    } else {
      // Found previous holding, let's compare
      const prevQty = prev.quantity || 0;
      const prevVal = prev.marketValue || 0;

      const qtyDelta = currentQty - prevQty;
      const valDelta = currentVal - prevVal;

      // Check if qty is roughly the same
      const isQtyUnchanged = Math.abs(qtyDelta) < 0.00001;

      if (isQtyUnchanged) {
        // Unchanged
        deltas.push({
          symbol,
          name,
          accountId,
          accountName,
          previousQuantity: prevQty,
          currentQuantity: currentQty,
          previousMarketValue: prevVal,
          currentMarketValue: currentVal,
          quantityDelta: 0,
          marketValueDelta: valDelta,
          actionType: 'unchanged',
          confidence: 'high',
          reason: `持仓未变：标的 $${symbol} 数量保持 $${currentQty} 不变，由于价格波动市值变动了 $${valDelta >= 0 ? '+' : ''}${valDelta.toFixed(2)}。`
        });
      } else if (qtyDelta > 0) {
        // Increase
        deltas.push({
          symbol,
          name,
          accountId,
          accountName,
          previousQuantity: prevQty,
          currentQuantity: currentQty,
          previousMarketValue: prevVal,
          currentMarketValue: currentVal,
          quantityDelta: qtyDelta,
          marketValueDelta: valDelta,
          actionType: 'increase',
          confidence: 'high',
          reason: `持仓加仓：标的 $${symbol} 数量由 ${prevQty} 增加至 ${currentQty}（净增 +${qtyDelta.toFixed(4)}），市值变动 $${valDelta >= 0 ? '+' : ''}${valDelta.toFixed(2)}。`
        });
      } else {
        // Reduce or Exit
        if (currentQty <= 0.00001) {
          // Exit
          deltas.push({
            symbol,
            name,
            accountId,
            accountName,
            previousQuantity: prevQty,
            currentQuantity: 0,
            previousMarketValue: prevVal,
            currentMarketValue: 0,
            quantityDelta: -prevQty,
            marketValueDelta: -prevVal,
            actionType: 'exit',
            confidence: 'high',
            reason: `持仓清仓：标的 $${symbol} 已全部出清（此前持仓为 ${prevQty}，市值 $${prevVal.toFixed(2)}）。`
          });
        } else {
          // Reduce
          deltas.push({
            symbol,
            name,
            accountId,
            accountName,
            previousQuantity: prevQty,
            currentQuantity: currentQty,
            previousMarketValue: prevVal,
            currentMarketValue: currentVal,
            quantityDelta: qtyDelta,
            marketValueDelta: valDelta,
            actionType: 'reduce',
            confidence: 'high',
            reason: `持仓减仓：标的 $${symbol} 数量由 ${prevQty} 减少至 ${currentQty}（净减 ${Math.abs(qtyDelta).toFixed(4)}），变现/缩水市值 $${valDelta.toFixed(2)}。`
          });
        }
      }
    }
  });

  // Check for previous holdings that no longer exist in current (Exits)
  prevHoldings.forEach(prev => {
    const key = getHoldingKey(prev);
    if (key && !matchedPrevKeys.has(key)) {
      const symbol = prev.symbol || prev.name || 'UNKNOWN';
      const name = prev.name || prev.symbol;
      const accountId = prev.accountId;
      const accountName = prev.accountName;
      const prevQty = prev.quantity || 0;
      const prevVal = prev.marketValue || 0;

      deltas.push({
        symbol,
        name,
        accountId,
        accountName,
        previousQuantity: prevQty,
        currentQuantity: 0,
        previousMarketValue: prevVal,
        currentMarketValue: 0,
        quantityDelta: -prevQty,
        marketValueDelta: -prevVal,
        actionType: 'exit',
        confidence: 'high',
        reason: `持仓出清：标的 $${symbol} 未在本次更新中出现，视为已全部出清（此前持仓为 ${prevQty}，市值 $${prevVal.toFixed(2)}）。`
      });
    }
  });

  return deltas;
}
