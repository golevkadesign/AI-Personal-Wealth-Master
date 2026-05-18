import { format, subDays } from 'date-fns';

// --- 纯数学指标计算函数 ---
const calculateMA = (data: any[], period: number) => { if (data.length < period) return data.map(d => ({ ...d, [`MA${period}`]: null })); let result = []; for (let i = 0; i < data.length; i++) { if (i < period - 1) { result.push({ ...data[i], [`MA${period}`]: null }); continue; } let sum = 0; for (let j = 0; j < period; j++) { sum += data[i - j].close; } result.push({ ...data[i], [`MA${period}`]: sum / period }); } return result; };
const calculateRSI = (data: any[], period = 14) => { if (data.length < period) return data.map(d => ({ ...d, RSI: null })); let gains = [], losses = []; for (let i = 1; i < data.length; i++) { let change = data[i].close - data[i - 1].close; gains.push(Math.max(0, change)); losses.push(Math.max(0, -change)); } let avgGain = gains.slice(0, period).reduce((a, b) => a + b, 0) / period; let avgLoss = losses.slice(0, period).reduce((a, b) => a + b, 0) / period; let result = data.map(d => ({...d, RSI: null})); for (let i = period; i < data.length; i++) { let cg = gains[i - 1]; let cl = losses[i - 1]; avgGain = (avgGain * (period - 1) + cg) / period; avgLoss = (avgLoss * (period - 1) + cl) / period; let rs = avgLoss === 0 ? 100 : avgGain / avgLoss; result[i].RSI = 100 - 100 / (1 + rs); } return result; };
const calculateMACD = (data: any[], fast=12, slow=26, sig=9) => { if(data.length<slow) return data.map(d=>({...d, MACD:null, Signal:null, Histogram:null})); const ema = (d: any[], p: number) => { let k=2/(p+1); let arr=new Array(d.length).fill(null); let s=0; for(let i=0;i<p;i++) s+=d[i].close; arr[p-1]=s/p; for(let i=p;i<d.length;i++) arr[i]=d[i].close*k+arr[i-1]*(1-k); return arr; }; const f=ema(data, fast); const s=ema(data, slow); let macd=data.map((d,i)=>({...d, MACD_Line: (f[i]&&s[i])?f[i]-s[i]:null})); let v=macd.filter(d=>d.MACD_Line!==null).map(d=>({close:d.MACD_Line})); let sl=ema(v, sig); let off=macd.length-v.length; return macd.map((d,i)=>{ if(i<off) return {...d,Signal_Line:null,MACD_Histogram:null}; const signal=sl[i-off]; return {...d,Signal_Line:signal,MACD_Histogram:(d.MACD_Line!==null&&signal!==null)?d.MACD_Line-signal:null}; }); };
const calculateBB = (data: any[], p=20, mult=2) => { if(data.length<p) return data.map(d=>({...d, BB_Upper:null, BB_Lower:null})); return data.map((d,i)=>{ if(i<p-1) return {...d, BB_Upper:null, BB_Lower:null}; const slice=data.slice(i-p+1, i+1); const sum=slice.reduce((a,b)=>a+b.close,0); const mean=sum/p; const sqDiff=slice.map(v=>Math.pow(v.close-mean,2)); const std=Math.sqrt(sqDiff.reduce((a,b)=>a+b,0)/p); return {...d, BB_Middle:mean, BB_Upper:mean+std*mult, BB_Lower:mean-std*mult}; }); };
const calculateADX = (data: any[], p=14) => { if(data.length<p*2) return data.map(d=>({...d, ADX:null})); let res=data.map(d=>({...d, tr:0, dmP:0, dmM:0})); for(let i=1;i<data.length;i++){ const h=data[i].high, l=data[i].low, pc=data[i-1].close; const tr=Math.max(h-l, Math.abs(h-pc), Math.abs(l-pc)); const up=data[i].high-data[i-1].high; const down=data[i-1].low-data[i].low; res[i]={...res[i], tr, dmP:(up>down&&up>0)?up:0, dmM:(down>up&&down>0)?down:0}; } let trS=0, dmPS=0, dmMS=0; for(let i=1;i<=p;i++){ trS+=res[i].tr; dmPS+=res[i].dmP; dmMS+=res[i].dmM; } trS-=trS/p; let dxs=new Array(data.length).fill(null); for(let i=p+1;i<data.length;i++){ let c=res[i]; trS=trS-(trS/p)+c.tr; dmPS=dmPS-(dmPS/p)+c.dmP; dmMS=dmMS-(dmMS/p)+c.dmM; const diP=(dmPS/trS)*100; const diM=(dmMS/trS)*100; dxs[i]=(Math.abs(diP-diM)/(diP+diM))*100; res[i].DI_Plus=diP; res[i].DI_Minus=diM; } let final=res.map(d=>({...d, ADX:null})); let start=p*2; if(start<data.length){ let sum=0; for(let i=p+1;i<=start;i++) sum+=dxs[i]; let prev=sum/p; final[start].ADX=prev; for(let i=start+1;i<data.length;i++){ let curr=(prev*(p-1)+dxs[i])/p; final[i].ADX=curr; prev=curr; } } return final; };

const calculateSignals = (data: any[], config: any) => {
    const maF = `MA${config.maFast}`; const maS = `MA${config.maSlow}`;
    return data.map((d, i) => {
        if (i < 50) return { ...d, signal: 'hold' }; 
        const prev = data[i - 1];
        let signal = 'hold';
        if (d.ADX > config.adxThreshold) {
             if (d[maF] > d[maS] && prev[maF] <= prev[maS] && d.DI_Plus > d.DI_Minus) { signal = 'buy'; }
             else if (d[maF] < d[maS] && prev[maF] >= prev[maS] && d.DI_Minus > d.DI_Plus) { signal = 'sell'; }
        } else {
            if (d.low <= d.BB_Lower && d.RSI < config.rsiOversold) { signal = 'buy'; }
            else if (d.high >= d.BB_Upper && d.RSI > config.rsiOverbought) { signal = 'sell'; }
        }
        return { ...d, signal };
    });
}

// 核心抓取与清洗引擎
const getYahooSymbol = (sym: string) => sym.trim().toUpperCase().replace(/\.US$/i, '');

export const analyzeStock = async (rawSymbol: string) => {
    const symbol = getYahooSymbol(rawSymbol);
    try {
        // Node 端直接 fetch，无需跨域代理
        const res = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?range=6mo&interval=1d`, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            }
        });
        if (!res.ok) {
            console.error(`Yahoo Finance fetch failed for ${symbol}: ${res.status} ${res.statusText}`);
            return null;
        }
        const json = await res.json();
        const result = json.chart?.result?.[0];
        if (!result) return null;

        const quotes = result.indicators.quote[0];
        const timestamps = result.timestamp;
        
        let history = timestamps.map((ts: number, i: number) => ({
            date: format(new Date(ts * 1000), 'yyyy-MM-dd'),
            open: quotes.open[i], high: quotes.high[i], low: quotes.low[i], close: quotes.close[i], volume: quotes.volume[i]
        })).filter((d: any) => d.close !== null);

        const currentPrice = result.meta.regularMarketPrice;
        const percentChange = ((currentPrice - result.meta.chartPreviousClose) / result.meta.chartPreviousClose) * 100;

        // 硬编码一套默认指标参数跑量化计算
        const config = { maFast: 5, maSlow: 20, rsiPeriod: 14, bbPeriod: 20, bbStdDev: 2, adxPeriod: 14, adxThreshold: 25, rsiOverbought: 70, rsiOversold: 30 };
        
        let processed = calculateMA(history, config.maFast);
        processed = calculateMA(processed, config.maSlow);
        processed = calculateRSI(processed, config.rsiPeriod);
        processed = calculateMACD(processed);
        processed = calculateBB(processed, config.bbPeriod, config.bbStdDev);
        processed = calculateADX(processed, config.adxPeriod);
        processed = calculateSignals(processed, config);

        const last = processed[processed.length - 1];
        const bbW = (last.BB_Upper - last.BB_Lower) || (currentPrice * 0.05);

        return {
            currentPrice,
            changePercent: percentChange,
            trend: last[`MA${config.maFast}`] > last[`MA${config.maSlow}`] ? 'up' : 'down',
            rsi: last.RSI || 0,
            macdHist: last.MACD_Histogram || 0,
            adx: last.ADX || 0,
            signal: last.signal || 'hold',
            buyPrice: last.BB_Lower || (currentPrice * 0.95),
            sellPrice: last.BB_Upper || (currentPrice * 1.05)
        };
    } catch (e) {
        console.error(`QuantEngine Error for ${symbol}:`, e);
        return null;
    }
};

// 提取出的 Yahoo 兜底抓取函数 (增加了 User-Agent 伪装)
const fetchFromYahooFallback = async (symbol: string) => {
    console.log(`[QuantEngine] 降级使用 Yahoo 公共数据源获取 ${symbol} 历史数据...`);
    const res = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?range=1y&interval=1d`, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' } // 💥 关键修复
    });
    if (!res.ok) return null;
    const json = await res.json();
    const result = json.chart?.result?.[0];
    if (!result) return null;
    
    const quotes = result.indicators.quote[0];
    return result.timestamp.map((ts: number, i: number) => {
        const d = new Date(ts * 1000);
        return [
            `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`,
            quotes.open[i], quotes.close[i], quotes.low[i], quotes.high[i]
        ];
    }).filter((item: any[]) => item[1] != null && item[2] != null && item[3] != null && item[4] != null).slice(-150);
};

// 预留的长桥抓取通道
const fetchFromLongbridge = async (symbol: string, lbConfig: any): Promise<any[]> => {
    console.log(`[QuantEngine] ⚡ 使用长桥(Longbridge)实盘专线获取 ${symbol} 历史数据...`);
    // TODO: 结合你本地的 test-lb2.ts 或 Longbridge SDK，在这里发起真实的长桥 OpenAPI K 线请求
    // 返回格式必须同样是: [ [日期字符串, open, close, low, high], ... ]
    return []; 
};

export const fetchStockHistory = async (rawSymbol: string, useLongbridge: boolean = false, lbConfig?: any) => {
    const symbol = getYahooSymbol(rawSymbol);
    try {
        if (useLongbridge) {
            try {
                const lbHistory = await fetchFromLongbridge(symbol, lbConfig);
                if (lbHistory && lbHistory.length > 0) return lbHistory;
            } catch (e) {
                console.warn(`[QuantEngine] 长桥获取 ${symbol} 失败，准备降级兜底...`, e);
            }
        }
        // 如果未绑定长桥，或长桥拉取失败，安全降级到 Yahoo
        return await fetchFromYahooFallback(symbol);
    } catch (e) {
        console.error(`[QuantEngine] ${symbol} 所有历史数据源拉取均失败:`, e);
        return null;
    }
};
