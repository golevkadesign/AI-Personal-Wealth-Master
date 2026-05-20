export function getCurrencySymbol(currency?: string) {
  if (!currency) return '$';
  const c = currency.toUpperCase();
  if (c === 'USD') return '$';
  if (c === 'CNY' || c === 'RMB') return '¥';
  if (c === 'HKD') return 'HK$';
  return c + ' ';
}

export function getSDUIPieOption(data: any) {
  return { 
    tooltip: { trigger: 'item' }, 
    series: [{ type: 'pie', data, radius: ['40%', '70%'] }] 
  };
}

const SHADES_GOLD = ['#C9B284', '#A39167', '#8C8270', '#5A5141', '#373228', '#211E18'];

export function getDonutOption(data: any) {
  const arr = data?.distributions?.liquidity || [];
  return {
    tooltip: { 
      trigger: 'item', 
      backgroundColor: 'rgba(24, 26, 28, 0.9)',
      borderColor: 'rgba(201, 178, 132, 0.2)',
      textStyle: { color: '#E7D7B0', fontFamily: 'JetBrains Mono' },
      formatter: (p: any) => `${p.name}: ${getCurrencySymbol(arr[p.dataIndex]?.currency)}${(p.value || 0).toLocaleString()} (${p.percent}%)` 
    },
    legend: { 
      orient: 'vertical', 
      right: '0%', 
      top: 'middle',
      icon: 'circle',
      textStyle: { color: '#AFA692', fontSize: 11, fontFamily: 'sans-serif' },
      itemWidth: 8,
      itemHeight: 8,
      formatter: (name: string) => {
         const item = arr.find((a: any) => a.name === name);
         let pct = '';
         if (item && item.value) {
            const total = arr.reduce((sum: number, v: any) => sum + v.value, 0);
            pct = total > 0 ? `  ${((item.value / total) * 100).toFixed(1)}%` : '';
         }
         return `${name}${pct}`;
      }
    },
    color: SHADES_GOLD,
    series: [{
      type: 'pie', radius: ['55%', '75%'], center: ['35%', '50%'],
      itemStyle: { borderRadius: 4, borderColor: '#181A1C', borderWidth: 2 },
      label: { show: false }, data: arr.length ? arr : [{ name: '无数据', value: 0 }]
    }]
  };
}

export function getExpenseOption(data: any) {
  const arr = data?.distributions?.expenses || [];
  return {
    tooltip: { 
      trigger: 'item', 
      backgroundColor: 'rgba(24, 26, 28, 0.9)',
      borderColor: 'rgba(201, 178, 132, 0.2)',
      textStyle: { color: '#E7D7B0', fontFamily: 'JetBrains Mono' },
      formatter: (p: any) => `${p.name}: ${getCurrencySymbol(arr[p.dataIndex]?.currency)}${(p.value || 0).toLocaleString()} (${p.percent}%)` 
    },
    legend: { 
      orient: 'vertical', 
      right: '0%', 
      top: 'middle',
      icon: 'circle',
      textStyle: { color: '#AFA692', fontSize: 11, fontFamily: 'sans-serif' },
      itemWidth: 8,
      itemHeight: 8,
      formatter: (name: string) => {
         const item = arr.find((a: any) => a.name === name);
         let pct = '';
         if (item && item.value) {
            const total = arr.reduce((sum: number, v: any) => sum + v.value, 0);
            pct = total > 0 ? `  ${((item.value / total) * 100).toFixed(1)}%` : '';
         }
         return `${name}${pct}`;
      }
    },
    color: ['#A65D57', '#C9B284', '#6B8E6B', '#8C8270', '#D4AF37', '#5A5141'],
    series: [{
      type: 'pie', radius: ['55%', '75%'], center: ['35%', '50%'],
      itemStyle: { borderRadius: 4, borderColor: '#181A1C', borderWidth: 2 },
      label: { show: false }, data: arr.length ? arr : [{ name: '无数据', value: 0 }]
    }]
  };
}

export function getWaterfallOption(data: any) {
  const arr = data?.distributions?.privateAssets || [];
  const names = arr.map((v: any) => v.name).concat(['总计']);
  const total = arr.reduce((sum: number, v: any) => sum + v.value, 0);

  let currentSum = 0;
  const helpData = arr.map((v: any) => { const start = currentSum; currentSum += v.value; return start; }).concat([0]);
  const mainData = arr.map((v: any) => v.value).concat([total]);

  return {
    tooltip: { 
      trigger: 'axis', 
      axisPointer: { type: 'shadow' }, 
      backgroundColor: 'rgba(24, 26, 28, 0.9)',
      borderColor: 'rgba(201, 178, 132, 0.2)',
      textStyle: { color: '#E7D7B0', fontFamily: 'JetBrains Mono' },
      formatter: (p: any) => {
        const idx = p[1].dataIndex;
        const cur = idx < arr.length ? arr[idx].currency : arr[0]?.currency;
        return p[1].name + ' : ' + getCurrencySymbol(cur) + (p[1].value?.toLocaleString() || 0);
      }
    },
    grid: { left: '2%', right: '2%', bottom: '8%', top: '15%', containLabel: true },
    xAxis: { 
      type: 'category', 
      splitLine: { show: false }, 
      data: names.length > 1 ? names : ['无数据'], 
      axisLabel: { color: '#AFA692', fontSize: 11, interval: 0, formatter: (val: string) => val.length > 4 ? val.slice(0, 4) + '...' : val },
      axisLine: { lineStyle: { color: 'rgba(201, 178, 132, 0.2)' } }
    },
    yAxis: { 
      type: 'value', 
      splitLine: { lineStyle: { color: 'rgba(201, 178, 132, 0.1)', type: 'dashed' } }, 
      axisLabel: { color: '#AFA692', fontSize: 10, formatter: (val: number) => val >= 10000 ? (val / 10000) + 'w' : val } 
    },
    series: [
      { type: 'bar', stack: 'Total', itemStyle: { borderColor: 'transparent', color: 'transparent' }, data: helpData },
      {
        type: 'bar', stack: 'Total', 
        label: { show: true, position: 'top', formatter: (p: any) => p.value >= 10000 ? (p.value / 10000).toFixed(0) : (p.value?.toLocaleString() || '0'), color: '#C9B284', fontSize: 11, fontFamily: 'JetBrains Mono' },
        itemStyle: { color: (p: any) => p.dataIndex === names.length - 1 ? '#D4AF37' : '#C9B284', borderRadius: [2, 2, 0, 0] }, 
        data: mainData.length ? mainData : [0],
        barWidth: '40%'
      }
    ]
  };
}

export function getHoldingsOption(data: any) {
  const arr = data?.distributions?.publicHoldings || [];
  const sortedArr = [...arr].sort((a: any, b: any) => (a.value ?? a.marketValue ?? 0) - (b.value ?? b.marketValue ?? 0));
  
  const symbols = sortedArr.map((v: any) => v.name || v.symbol || '未知');
  const values = sortedArr.map((v: any) => v.value ?? v.marketValue ?? 0);
  const total = values.reduce((sum: number, v: number) => sum + v, 0);
  
  return {
    tooltip: { 
      trigger: 'axis', 
      axisPointer: { type: 'shadow' }, 
      backgroundColor: 'rgba(24, 26, 28, 0.9)',
      borderColor: 'rgba(201, 178, 132, 0.2)',
      textStyle: { color: '#E7D7B0', fontFamily: 'JetBrains Mono' },
      formatter: (p: any) => {
        const idx = p[0].dataIndex;
        return p[0].name + ' : ' + getCurrencySymbol(sortedArr[idx]?.currency) + (p[0].value?.toLocaleString() || 0);
      }
    },
    grid: { left: '2%', right: '12%', bottom: '0%', top: '5%', containLabel: true },
    xAxis: [{ type: 'value', splitLine: { show: false }, axisLabel: { show: false } }],
    yAxis: [{ 
      type: 'category', 
      data: symbols.length ? symbols : ['无数据'], 
      axisLabel: { color: '#AFA692', fontSize: 11, interval: 0 },
      axisLine: { lineStyle: { color: 'rgba(201, 178, 132, 0.2)' } },
      axisTick: { show: false }
    }],
    series: [{ 
      type: 'bar', 
      label: { show: true, position: 'right', formatter: (p: any) => total > 0 ? ((p.value / total) * 100).toFixed(1) + '%' : '0%', color: '#C9B284', fontSize: 11, fontFamily: 'JetBrains Mono' }, 
      barWidth: '35%', 
      data: values.length ? values : [0], 
      itemStyle: { color: '#A39167', borderRadius: [0, 4, 4, 0] } 
    }]
  };
}

export function getOptionsOption(data: any) {
  const arr = data?.distributions?.options || [];
  const symbols = arr.map((v: any) => v.name || v.symbol || '未知');
  const values = arr.map((v: any) => v.value ?? v.marketValue ?? 0);
  return {
    tooltip: { 
      trigger: 'axis', 
      axisPointer: { type: 'shadow' }, 
      backgroundColor: 'rgba(24, 26, 28, 0.9)',
      borderColor: 'rgba(201, 178, 132, 0.2)',
      textStyle: { color: '#E7D7B0', fontFamily: 'JetBrains Mono' },
      formatter: (p: any) => {
        const idx = p[0].dataIndex;
        return p[0].name + ' : ' + getCurrencySymbol(arr[idx]?.currency) + (p[0].value?.toLocaleString() || 0);
      }
    },
    grid: { left: '2%', right: '2%', bottom: '8%', top: '15%', containLabel: true },
    xAxis: [{ 
       type: 'category', 
       data: symbols.length ? symbols : ['无数据'], 
       axisLabel: { color: '#AFA692', fontSize: 11, interval: 0 },
       axisLine: { lineStyle: { color: 'rgba(201, 178, 132, 0.2)' } }
    }],
    yAxis: [{ 
       type: 'value', 
       splitLine: { lineStyle: { color: 'rgba(201, 178, 132, 0.1)', type: 'dashed' } }, 
       axisLabel: { color: '#AFA692', fontSize: 10, formatter: (val: number) => val >= 10000 ? (val / 10000) + 'w' : val }
    }],
    series: [{ 
       type: 'bar', 
       label: { show: true, position: 'top', formatter: (p: any) => p.value >= 10000 ? (p.value / 10000).toFixed(0) : (p.value?.toLocaleString() || '0'), color: '#8C8270', fontSize: 10, fontFamily: 'JetBrains Mono' }, 
       barWidth: '40%', 
       data: values.length ? values : [0], 
       itemStyle: { color: '#6B8E6B', borderRadius: [2, 2, 0, 0] } 
    }]
  };
}
