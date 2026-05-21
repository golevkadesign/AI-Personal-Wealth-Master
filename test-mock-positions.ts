import { getHoldingsOption } from './src/components/chart-configs.js';
import { getSDUIPieOption, getDonutOption } from './src/components/chart-configs.js';

const mockExtremeDataProps = {
  distributions: {
    publicHoldings: [
       // Mock Longbridge API return missing value/marketValue but has quantity/costPrice
       { symbol: "TEST.US", name: "Apple", quantity: 0, costPrice: 150 }, // Qty 0
       { symbol: "GME.US", name: "GameStop", quantity: 10, costPrice: 40, currentPrice: undefined }, // No currentPrice
       { symbol: "AMC.US", name: "AMC", quantity: -50, costPrice: 10, currentPrice: 15 }, // Short position handling
    ],
    liquidity: [], // Empty Array
    expenses: [] // Empty Array
  }
};

try {
  console.log("== 运行测试: 空数组/极端数据/缺字段时的防御 ==");

  // 1. holdings array test (testing the value fallbacks we patched)
  const holdingsOption = getHoldingsOption(mockExtremeDataProps);
  console.log('✅ getHoldingsOption 解析成功:', JSON.stringify(holdingsOption.series[0].data));

  // 2. Donuts Option test (testing empty liquidity data)
  const donutOption = getDonutOption(mockExtremeDataProps);
  console.log('✅ getDonutOption 空数组防御成功:', JSON.stringify(donutOption.series[0].data));

} catch (err: any) {
  console.error('❌ 测试发生崩溃:', err.message);
  process.exit(1);
}
