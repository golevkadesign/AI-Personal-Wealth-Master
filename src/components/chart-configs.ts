export function getCurrencySymbol(currency?: string) {
  if (!currency) return '$';
  const c = currency.toUpperCase();
  if (c === 'USD') return '$';
  if (c === 'CNY' || c === 'RMB') return '¥';
  if (c === 'HKD') return 'HK$';
  return c + ' ';
}

export function getHoldingMarketValue(v: any): number {
  if (!v) return 0;
  
  const valueNum = Number(v.value);
  const marketValueNum = Number(v.marketValue);
  const market_valueNum = Number(v.market_value);
  const totalMarketValueNum = Number(v.totalMarketValue);
  const currentValueNum = Number(v.currentValue);

  if (!isNaN(valueNum) && valueNum !== 0) return valueNum;
  if (!isNaN(marketValueNum) && marketValueNum !== 0) return marketValueNum;
  if (!isNaN(market_valueNum) && market_valueNum !== 0) return market_valueNum;
  if (!isNaN(totalMarketValueNum) && totalMarketValueNum !== 0) return totalMarketValueNum;
  if (!isNaN(currentValueNum) && currentValueNum !== 0) return currentValueNum;
  
  const qty = Number(v.quantity) || 0;
  const price = Number(v.currentPrice) || Number(v.current_price) || Number(v.lastPrice) || Number(v.costPrice) || 0;
  
  // fallback compute
  return qty * price;
}

export function getSDUIPieOption(data: any, t: (key: string) => string) {
  return { 
    tooltip: { 
      trigger: 'item',
      backgroundColor: 'rgba(26, 29, 31, 0.95)',
      borderColor: 'rgba(201, 178, 132, 0.28)',
      borderWidth: 1,
      textStyle: { color: '#E7D7B0', fontFamily: 'Inter' }
    }, 
    series: [{ 
      type: 'pie', 
      data, 
      radius: ['45%', '75%'],
      itemStyle: { borderRadius: 4, borderColor: '#121415', borderWidth: 2 }
    }] 
  };
}

export function getDonutOption(data: any, t: (key: string) => string) {
  const originalArr = data?.distributions?.liquidity || [];
  const arr = JSON.parse(JSON.stringify(originalArr)); // 深拷贝
  
  const publicHoldings = data?.distributions?.publicHoldings || [];
  const totalMarketValue = publicHoldings.reduce((sum: number, h: any) => {
    return sum + getHoldingMarketValue(h);
  }, 0);

  if (totalMarketValue > 0) {
    const targetNames = ['股票', '证券', '公开市场', '投资', '美股', '港股'];
    let found = false;
    for (const item of arr) {
      if (targetNames.includes(item.name)) {
        item.value = totalMarketValue;
        found = true;
        break;
      }
    }
    if (!found) {
      arr.push({ name: t('charts.publicMarketsLive'), value: totalMarketValue, currency: 'USD' });
    }
  }

  return {
    tooltip: { 
      trigger: 'item', 
      backgroundColor: 'rgba(26, 29, 31, 0.95)',
      borderColor: 'rgba(201, 178, 132, 0.28)',
      borderWidth: 1,
      textStyle: { color: '#E7D7B0', fontFamily: 'Inter' },
      formatter: (p: any) => `${p.name}: ${getCurrencySymbol(arr[p.dataIndex]?.currency)}${(p.value || 0).toLocaleString()} (${p.percent}%)` 
    },
    legend: { 
      orient: 'vertical', 
      left: 'left', 
      textStyle: { color: '#A39167', fontFamily: 'JetBrains Mono', fontSize: 11 }, 
      top: 'middle',
      icon: 'circle'
    },
    color: ['#C9B284', '#A39167', '#8C8270', '#E7D7B0', '#D4AF37'],
    series: [{
      type: 'pie', 
      radius: ['55%', '75%'], 
      center: ['70%', '50%'],
      itemStyle: { borderRadius: 6, borderColor: '#121415', borderWidth: 2 },
      label: { show: false }, 
      data: arr.length ? arr : [{ name: t('charts.noData'), value: 0 }]
    }]
  };
}

export function getExpenseOption(data: any, t: (key: string) => string) {
  const arr = data?.distributions?.expenses || [];
  return {
    tooltip: { 
      trigger: 'item', 
      backgroundColor: 'rgba(26, 29, 31, 0.95)',
      borderColor: 'rgba(201, 178, 132, 0.28)',
      borderWidth: 1,
      textStyle: { color: '#E7D7B0', fontFamily: 'Inter' },
      formatter: (p: any) => `${p.name}: ${getCurrencySymbol(arr[p.dataIndex]?.currency)}${(p.value || 0).toLocaleString()} (${p.percent}%)` 
    },
    legend: { 
      orient: 'vertical', 
      left: 'left', 
      textStyle: { color: '#A39167', fontFamily: 'JetBrains Mono', fontSize: 11 }, 
      top: 'middle',
      icon: 'circle'
    },
    color: ['#C9B284', '#A39167', '#8C8270', '#E7D7B0', '#6B8E6B', '#A65D57'],
    series: [{
      type: 'pie', 
      radius: ['55%', '75%'], 
      center: ['70%', '50%'],
      itemStyle: { borderRadius: 6, borderColor: '#121415', borderWidth: 2 },
      label: { show: false }, 
      data: arr.length ? arr : [{ name: t('charts.noData'), value: 0 }]
    }]
  };
}

export function getWaterfallOption(data: any, t: (key: string) => string) {
  const arr = data?.distributions?.privateAssets || [];
  const names = arr.map((v: any) => v.name).concat([t('charts.totalNetPresentValue')]);
  const total = arr.reduce((sum: number, v: any) => sum + v.value, 0);

  let currentSum = 0;
  const helpData = arr.map((v: any) => { const start = currentSum; currentSum += v.value; return start; }).concat([0]);
  const mainData = arr.map((v: any) => v.value).concat([total]);

  return {
    tooltip: { 
      trigger: 'axis', 
      backgroundColor: 'rgba(26, 29, 31, 0.95)',
      borderColor: 'rgba(201, 178, 132, 0.28)',
      borderWidth: 1,
      textStyle: { color: '#E7D7B0', fontFamily: 'Inter' },
      axisPointer: { type: 'shadow' }, 
      formatter: (p: any) => {
        const idx = p[1].dataIndex;
        const cur = idx < arr.length ? arr[idx].currency : arr[0]?.currency;
        return p[1].name + ' : ' + getCurrencySymbol(cur) + (p[1].value?.toLocaleString() || 0);
      }
    },
    grid: { left: '3%', right: '4%', bottom: '15%', top: '15%', containLabel: true },
    xAxis: { 
      type: 'category', 
      splitLine: { show: false }, 
      data: names.length > 1 ? names : [t('charts.noData')], 
      axisLabel: { color: '#A39167', fontFamily: 'Inter', interval: 0, formatter: (val: string) => val.length > 4 ? val.slice(0, 4) + '...' : val } 
    },
    yAxis: { 
      type: 'value', 
      splitLine: { lineStyle: { color: 'rgba(201, 178, 132, 0.08)', type: 'dashed' } }, 
      axisLabel: { show: false } 
    },
    series: [
      { type: 'bar', stack: 'Total', itemStyle: { borderColor: 'transparent', color: 'transparent' }, data: helpData },
      {
        type: 'bar', 
        stack: 'Total', 
        label: { 
          show: true, 
          position: 'top', 
          formatter: (p: any) => p.value >= 10000 ? (p.value / 10000).toFixed(1) + 'w' : (p.value?.toLocaleString() || '0'), 
          color: '#E7D7B0', 
          fontFamily: 'JetBrains Mono',
          fontSize: 10 
        },
        itemStyle: { 
          color: (p: any) => p.dataIndex === names.length - 1 ? '#E7D7B0' : '#C9B284', 
          borderRadius: [4, 4, 0, 0] 
        }, 
        data: mainData.length ? mainData : [0]
      }
    ]
  };
}

export function getHoldingsOption(data: any, t: (key: string) => string) {
  const arr = data?.distributions?.publicHoldings || [];

  // Sort array by value to make horizontal chart look better (descending)
  const sortedArr = [...arr].sort((a: any, b: any) => getHoldingMarketValue(a) - getHoldingMarketValue(b));
  
  const symbols = sortedArr.map((v: any) => v.name || v.symbol || t('charts.unknown'));
  const values = sortedArr.map((v: any) => getHoldingMarketValue(v));
  
  return {
    tooltip: { 
      trigger: 'axis', 
      backgroundColor: 'rgba(26, 29, 31, 0.95)',
      borderColor: 'rgba(201, 178, 132, 0.28)',
      borderWidth: 1,
      textStyle: { color: '#E7D7B0', fontFamily: 'Inter' },
      axisPointer: { type: 'shadow' }, 
      formatter: (p: any) => {
        const idx = p[0].dataIndex;
        const val = p[0].value || 0;
        return p[0].name + ' : ' + getCurrencySymbol(sortedArr[idx]?.currency) + val.toLocaleString('en-US', { maximumFractionDigits: 2 });
      }
    },
    grid: { left: '3%', right: '15%', bottom: '5%', top: '5%', containLabel: true },
    dataZoom: [
      {
        type: 'inside',
        yAxisIndex: 0,
        start: sortedArr.length > 8 ? Math.floor((1 - 8 / sortedArr.length) * 100) : 0, 
        end: 100
      },
      {
        type: 'slider',
        yAxisIndex: 0,
        show: sortedArr.length > 8,
        width: 10,
        right: 0,
        borderColor: 'transparent',
        backgroundColor: '#1E2124',
        fillerColor: 'rgba(201, 178, 132, 0.25)',
        handleSize: '100%',
      }
    ],
    xAxis: [{ type: 'value', splitLine: { lineStyle: { color: 'rgba(201, 178, 132, 0.08)', type: 'dashed' } }, axisLabel: { show: false } }],
    yAxis: [{ type: 'category', data: symbols.length ? symbols : [t('charts.noData')], axisLabel: { color: '#A39167', fontFamily: 'Inter', interval: 0, width: 80, overflow: 'truncate' } }],
    series: [{ 
      type: 'bar', 
      label: { 
        show: true, 
        position: 'right', 
        formatter: (p: any) => {
          const val = Number(p.value) || 0;
          return val >= 10000 ? (val / 10000).toFixed(1) + 'w' : (val.toLocaleString('en-US', { maximumFractionDigits: 0 }));
        },
        color: '#C9B284', 
        fontFamily: 'JetBrains Mono',
        fontSize: 10 
      }, 
      barWidth: '55%', 
      data: values.length ? values : [0], 
      itemStyle: { color: '#C9B284', borderRadius: [0, 4, 4, 0] } 
    }]
  };
}

export function getOptionsOption(data: any, t: (key: string) => string) {
  const arr = data?.distributions?.options || [];
  const symbols = arr.map((v: any) => v.name || v.symbol || t('charts.unknown'));
  const values = arr.map((v: any) => v.value ?? v.marketValue ?? 0);
  return {
    tooltip: { 
      trigger: 'axis', 
      backgroundColor: 'rgba(26, 29, 31, 0.95)',
      borderColor: 'rgba(201, 178, 132, 0.28)',
      borderWidth: 1,
      textStyle: { color: '#E7D7B0', fontFamily: 'Inter' },
      axisPointer: { type: 'shadow' }, 
      formatter: (p: any) => {
        const idx = p[0].dataIndex;
        return p[0].name + ' : ' + getCurrencySymbol(arr[idx]?.currency) + (p[0].value?.toLocaleString() || 0);
      }
    },
    grid: { left: '3%', right: '4%', bottom: '15%', top: '15%', containLabel: true },
    dataZoom: [
      {
        type: 'inside',
        start: 0,
        end: arr.length > 5 ? Math.floor((5 / arr.length) * 100) : 100
      },
      {
        type: 'slider',
        show: arr.length > 5,
        height: 10,
        bottom: 0,
        borderColor: 'transparent',
        backgroundColor: '#1E2124',
        fillerColor: 'rgba(201, 178, 132, 0.25)',
        handleSize: '100%',
      }
    ],
    xAxis: [{ type: 'category', data: symbols.length ? symbols : [t('charts.noData')], axisLabel: { color: '#A39167', fontFamily: 'Inter', interval: 0, rotate: symbols.length > 4 ? 30 : 0 } }],
    yAxis: [{ type: 'value', splitLine: { lineStyle: { color: 'rgba(201, 178, 132, 0.08)', type: 'dashed' } }, axisLabel: { show: false } }],
    series: [{ 
      type: 'bar', 
      label: { 
        show: true, 
        position: 'top', 
        formatter: (p: any) => p.value >= 10000 ? (p.value / 10000).toFixed(1) + 'w' : (p.value?.toLocaleString() || '0'), 
        color: '#A39167', 
        fontFamily: 'JetBrains Mono',
        fontSize: 10 
      }, 
      barWidth: '40%', 
      data: values.length ? values : [0], 
      itemStyle: { color: '#8C8270', borderRadius: [4, 4, 0, 0] } 
    }]
  };
}
