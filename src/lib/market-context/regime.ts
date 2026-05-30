import type {
  MarketInstrumentSnapshot,
  MarketRegime,
  CrossAssetSignal,
  MarketContext,
  MarketFactorSnapshot,
  MarketDataQuality
} from '../../types/market-context';

export function getInstrument(
  instruments: MarketInstrumentSnapshot[],
  symbolOrCategory: string
): MarketInstrumentSnapshot | undefined {
  if (!instruments || instruments.length === 0) return undefined;

  const target = symbolOrCategory.toLowerCase();

  // 1. Precise symbol match (case-insensitive)
  const preciseSymbol = instruments.find(ins => ins.symbol.toLowerCase() === target);
  if (preciseSymbol) return preciseSymbol;

  // 2. Loose label fuzzy match (case-insensitive)
  const fuzzyLabel = instruments.find(ins => ins.label.toLowerCase().includes(target));
  if (fuzzyLabel) return fuzzyLabel;

  // 3. Category match
  const categoryMatch = instruments.find(ins => ins.category.toLowerCase() === target);
  if (categoryMatch) return categoryMatch;

  return undefined;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isPositive(value: unknown, threshold = 0): boolean {
  return isFiniteNumber(value) && value > threshold;
}

function isNegative(value: unknown, threshold = 0): boolean {
  return isFiniteNumber(value) && value < -threshold;
}

export function inferRiskMode(
  instruments: MarketInstrumentSnapshot[],
  volState: MarketRegime['volatilityState']
): MarketRegime['riskMode'] {
  const spy = getInstrument(instruments, 'SPY');
  const qqq = getInstrument(instruments, 'QQQ');

  if (!spy && !qqq) {
    return 'unknown';
  }

  const spy3M = spy?.change3M;
  const qqq3M = qqq?.change3M;

  if (volState === 'stressed') {
    return 'risk_off';
  }

  // If one of both exists and are visibly negative
  if ((isFiniteNumber(spy3M) && spy3M < -5) || (isFiniteNumber(qqq3M) && qqq3M < -5)) {
    return 'risk_off';
  }

  // Risk on triggers
  if (isFiniteNumber(spy3M) && spy3M > 3 && isFiniteNumber(qqq3M) && qqq3M > 3) {
    return 'risk_on';
  }

  return 'neutral';
}

export function inferRatePressure(
  instruments: MarketInstrumentSnapshot[]
): MarketRegime['ratePressure'] {
  const tlt = getInstrument(instruments, 'TLT');
  if (!tlt) return 'unknown';

  const change3M = tlt.change3M;
  if (!isFiniteNumber(change3M)) return 'unknown';

  if (change3M < -5) {
    return 'rising_rate_pressure'; // Bond falls, yield rises
  }
  if (change3M > 5) {
    return 'falling_rate_pressure'; // Bond rises, yield falls
  }

  return 'neutral';
}

export function inferCreditStress(
  instruments: MarketInstrumentSnapshot[]
): MarketRegime['creditStress'] {
  const hyg = getInstrument(instruments, 'HYG');
  const lqd = getInstrument(instruments, 'LQD');

  if (!hyg || !lqd) return 'unknown';

  const hyg3M = hyg.change3M;
  const lqd3M = lqd.change3M;

  if (!isFiniteNumber(hyg3M) || !isFiniteNumber(lqd3M)) return 'unknown';

  // High-yield debt underperforms investment-grade by more than 3%
  if (lqd3M - hyg3M > 3) {
    return 'elevated';
  }

  return 'normal';
}

export function inferDollarPressure(
  instruments: MarketInstrumentSnapshot[]
): MarketRegime['dollarPressure'] {
  // Find DXY or any category === 'fx' targeting dollar
  let usdProxy = getInstrument(instruments, 'DXY');
  if (!usdProxy) {
    usdProxy = instruments.find(ins => ins.category === 'fx' && ins.label.toLowerCase().includes('dollar'));
  }
  if (!usdProxy) {
    usdProxy = instruments.find(ins => ins.category === 'fx' && ins.label.toLowerCase().includes('usd'));
  }

  if (!usdProxy) return 'unknown';

  const change3M = usdProxy.change3M;
  if (!isFiniteNumber(change3M)) return 'unknown';

  if (change3M > 3) {
    return 'strong_usd';
  }
  if (change3M < -3) {
    return 'weak_usd';
  }

  return 'neutral';
}

export function inferCommodityImpulse(
  instruments: MarketInstrumentSnapshot[]
): MarketRegime['commodityImpulse'] {
  // Look for oil/crude (USO/Brent) and copper (or gold)
  const oil = getInstrument(instruments, 'USO') || getInstrument(instruments, 'oil');
  const copper = getInstrument(instruments, 'copper') || getInstrument(instruments, 'HG=F');

  if (!oil || !copper) {
    return 'unknown';
  }

  const oil3M = oil.change3M;
  const copper3M = copper.change3M;

  if (!isFiniteNumber(oil3M) || !isFiniteNumber(copper3M)) {
    return 'unknown';
  }

  const oilUp = oil3M > 3;
  const copperUp = copper3M > 3;
  const oilDown = oil3M < -3;
  const copperDown = copper3M < -3;

  if (oilUp && copperUp) {
    return 'inflationary';
  }
  if (oilDown && copperDown) {
    return 'disinflationary';
  }
  if ((oilUp && copperDown) || (oilDown && copperUp)) {
    return 'mixed';
  }

  return 'unknown';
}

export function inferVolatilityState(
  instruments: MarketInstrumentSnapshot[]
): MarketRegime['volatilityState'] {
  const vix = getInstrument(instruments, 'VIX') || getInstrument(instruments, '^VIX');

  if (vix && isFiniteNumber(vix.close)) {
    if (vix.close >= 25) return 'stressed';
    if (vix.close <= 15) return 'calm';
    return 'normal';
  }

  // Fallback to stock volatility if VIX is not found
  const spy = getInstrument(instruments, 'SPY');
  const qqq = getInstrument(instruments, 'QQQ');

  const spyVol = spy?.volatility20D;
  const qqqVol = qqq?.volatility20D;

  if (isFiniteNumber(spyVol) && spyVol > 0.28) return 'stressed';
  if (isFiniteNumber(qqqVol) && qqqVol > 0.28) return 'stressed';

  if (!vix && !spyVol && !qqqVol) {
    return 'unknown';
  }

  return 'normal';
}

export function inferMarketRegime(
  instruments: MarketInstrumentSnapshot[]
): MarketRegime {
  if (!instruments || instruments.length === 0) {
    return {
      riskMode: 'unknown',
      ratePressure: 'unknown',
      dollarPressure: 'unknown',
      creditStress: 'unknown',
      commodityImpulse: 'unknown',
      volatilityState: 'unknown',
      summary: '当前跨资产数据不足，无法稳定判断市场环境。'
    };
  }

  const volatilityState = inferVolatilityState(instruments);
  const riskMode = inferRiskMode(instruments, volatilityState);
  const ratePressure = inferRatePressure(instruments);
  const creditStress = inferCreditStress(instruments);
  const dollarPressure = inferDollarPressure(instruments);
  const commodityImpulse = inferCommodityImpulse(instruments);

  // Generate fact-based brief Chinese summary
  let summary = '跨资产市场环境整体维持中度波动状态，大盘趋势并不明朗。';

  if (riskMode === 'risk_on' && volatilityState !== 'stressed' && ratePressure === 'neutral') {
    summary = '当前权益指数偏强、波动率正常，市场环境偏 risk-on。';
  } else if (riskMode === 'risk_off' || volatilityState === 'stressed') {
    summary = '当前成长股回撤与波动率压力并存，市场环境偏 risk-off。';
  } else if (ratePressure === 'rising_rate_pressure') {
    summary = '当前长债走弱，组合需关注利率压力对高估值成长资产的压制。';
  } else if (dollarPressure === 'strong_usd') {
    summary = '美元震荡走强，需防范跨国业务及新兴/港股账户的间接换汇压力。';
  } else if (commodityImpulse === 'inflationary') {
    summary = '商品及上游供应链资产偏强，反映出通胀中枢波动有回升隐忧。';
  }

  return {
    riskMode,
    ratePressure,
    dollarPressure,
    creditStress,
    commodityImpulse,
    volatilityState,
    summary
  };
}

export function inferCrossAssetSignals(
  instruments: MarketInstrumentSnapshot[],
  regime: MarketRegime
): CrossAssetSignal[] {
  const signals: CrossAssetSignal[] = [];

  // Signal 1: Rate pressure on growth
  if (regime.ratePressure === 'rising_rate_pressure') {
    const qqq = getInstrument(instruments, 'QQQ');
    const qqq3M = qqq?.change3M;
    if (!isFiniteNumber(qqq3M) || qqq3M <= 5) {
      signals.push({
        id: 'sig_rate_pressure_growth',
        title: '长债走弱提示成长股估值压力',
        severity: 'watch',
        evidence: ['TLT 3个月回报率显著下跌', `QQQ 3个月表现相对平缓 (${isFiniteNumber(qqq3M) ? qqq3M.toFixed(2) : '--'}%)`],
        affectedExposures: ['科技成长', '高估值股票', '纳斯达克暴露'],
        interpretation: '国债价格下跌代表市场中长端无风险利率持续攀升，通常会自上而下压缩成长股的高估值乘数，高仓位纳斯达克暴露需警惕估值剪刀差。',
        suggestedQuestions: ['利率上行期间，我的科技股和高估值资产会受到多大影响？', '如何通过短债或现金对冲长端利率波动损害？']
      });
    }
  }

  // Signal 2: Credit appetite downturn
  if (regime.creditStress === 'elevated') {
    signals.push({
      id: 'sig_credit_stress',
      title: '高收益债弱于投资级债，风险偏好可能降温',
      severity: 'warning',
      evidence: ['HYG 与 LQD 发生关键套利分歧', '高收益债（HYG）中短期走势明显弱于高质量企业债（LQD）'],
      affectedExposures: ['高Beta股票', '中小盘', '杠杆仓位'],
      interpretation: '高损益信用债与优质企业债的利差扩大是信贷压力上升的直接写照。如果股票市场仍在高位，这种信用分化通常暗示着未来股票波动性加剧和杠杆资金撤出。',
      suggestedQuestions: ['信贷利差扩大，对我的非公开资产和中小盘指数暴露有何负面警示？', '组合需要收缩杠杆比例来应对风险敞口暴露吗？']
    });
  }

  // Signal 3: Commodity shock
  if (regime.commodityImpulse === 'inflationary') {
    signals.push({
      id: 'sig_commodity_shock',
      title: '商品链条走强，通胀与成本压力需观察',
      severity: 'watch',
      evidence: ['原油/能源及工业金属（铜等）3M 趋势同向走强'],
      affectedExposures: ['成长股估值', '消费利润率', '能源相关资产'],
      interpretation: '大宗商品需求与估值冲高可能再次激发供应链通胀弹性。利率长期居高不下或将通过企业原料成本传导，压榨非能源类工业及科技消费类企业的净息差。',
      suggestedQuestions: ['通胀预期回升时，哪些实体资产或大宗商品基金能起到保值防线作用？', '如何通过行业轮动降低制造与消费型资产暴露？']
    });
  }

  // Signal 4: Safe haven shift / flight to safety
  const gold = getInstrument(instruments, 'GLD') || getInstrument(instruments, 'gold');
  const gold3M = gold?.change3M;
  if (regime.volatilityState === 'stressed' || (isFiniteNumber(gold3M) && gold3M > 5 && regime.riskMode !== 'risk_on')) {
    signals.push({
      id: 'sig_flight_to_safety',
      title: '避险资产走强，市场防御需求上升',
      severity: 'warning',
      evidence: [
        regime.volatilityState === 'stressed' ? '市场恐慌指数维持在 25 以上高位' : '黄金（GLD）近3个月收益强势上行而大盘走势分化'
      ],
      affectedExposures: ['风险资产', '高波动仓位', '现金管理'],
      interpretation: '当黄金代表的无息避险资产持续跑赢贝塔资产，或者波动率指数（VIX）发生突变时，说明机构多重配对交易正在降低方向性风险。散户应顺势审视重仓的低清偿性资产。',
      suggestedQuestions: ['当前黄金和防御类资产的配比，能否抵御接下来的阶段性权益回撤？', '在市场恐慌期，如何优化随时变现的流动现金储备？']
    });
  }

  // Signal 5: Strong dollar pressure
  if (regime.dollarPressure === 'strong_usd') {
    signals.push({
      id: 'sig_strong_dollar_stress',
      title: '美元走强可能压制海外风险资产',
      severity: 'watch',
      evidence: ['美元指数（DXY）走势强劲，多周期指标超买'],
      affectedExposures: ['港股', '中概', '商品', '非美元资产'],
      interpretation: '美联储利率前景支持美元维持高利率溢价，引发全球资本非自主回流。这会对离岸流动性环境（如香港恒生指数、中概股及新兴市场主本币债）形成中短期抽水效应。',
      suggestedQuestions: ['美元强势期间，我的港股通仓位或非美元本币资产应如何防范汇兑损失？', '增配美元货币基金是否是当下更具确定性的避险方案？']
    });
  }

  // Signal 6: Risk-on but credit/commodity diverges
  if (regime.riskMode === 'risk_on' && (regime.creditStress === 'elevated' || regime.commodityImpulse === 'inflationary')) {
    signals.push({
      id: 'sig_diverging_signals',
      title: '权益表面偏强，但跨资产信号存在背离',
      severity: 'info',
      evidence: ['指数表现强势', '但背后伴随高收益债信用转弱或上游资源价格过快上涨'],
      affectedExposures: ['追涨行为', '集中仓位', '短线风险'],
      interpretation: '跨资产市场的底部分裂往往先于股票指数见顶。流动性聚集在几个核心龙头股中，产生了牛市繁荣假象，但系统整体的风险承受力已被信用或通胀剪刀差严重蚀空。',
      suggestedQuestions: ['如果目前的指数走高属于虚假繁荣，我应该怎样逐步止盈仓位？', '有哪些宏观监测点能提前预测本轮牛熊拐点？']
    });
  }

  return signals.slice(0, 6);
}

export function createMarketContext(params: {
  instruments?: MarketInstrumentSnapshot[];
  generatedAt?: number;
  sourceSummary?: string[];
  freshness?: MarketContext['freshness'];
  warnings?: string[];
}): MarketContext {
  const instruments = params.instruments || [];
  const generatedAt = params.generatedAt || Date.now();
  const sourceSummary = params.sourceSummary || ['MarketContext pure inference layer'];
  const freshness = params.freshness || 'daily';

  // Find most recent asOf timestamp
  let asOf: number | undefined = undefined;
  if (instruments.length > 0) {
    asOf = Math.max(...instruments.map(ins => ins.asOf));
  }

  // Infer data quality
  let dataQuality: MarketDataQuality = 'low';
  if (instruments.length > 0) {
    if (instruments.length >= 6 && instruments.filter(ins => ins.dataQuality !== 'low').length >= 4) {
      dataQuality = 'high';
    } else {
      dataQuality = 'medium';
    }
  }

  const regime = inferMarketRegime(instruments);
  const crossAssetSignals = inferCrossAssetSignals(instruments, regime);

  // Derive simple factors lists from computed regime
  const factors: MarketFactorSnapshot[] = [
    {
      id: 'f_risk_appetite',
      label: '全球风险资产偏好',
      category: 'risk_appetite',
      value: regime.riskMode === 'risk_on' ? 'positive' : regime.riskMode === 'risk_off' ? 'negative' : 'neutral',
      confidence: dataQuality,
      evidence: ['基于权益市场3M平均动能推导']
    },
    {
      id: 'f_rate_pressure',
      label: '十年期无风险利率压力',
      category: 'rate_pressure',
      value: regime.ratePressure === 'rising_rate_pressure' ? 'negative' : regime.ratePressure === 'falling_rate_pressure' ? 'positive' : 'neutral',
      confidence: dataQuality,
      evidence: ['基于长期国库券TLT动能及利息压力推导']
    },
    {
      id: 'f_dollar_pressure',
      label: '美元指数汇兑壁垒',
      category: 'dollar_pressure',
      value: regime.dollarPressure === 'strong_usd' ? 'negative' : regime.dollarPressure === 'weak_usd' ? 'positive' : 'neutral',
      confidence: dataQuality,
      evidence: ['基于美元指数DXY近期外汇波幅测算']
    }
  ];

  // Merge warnings
  const internalWarnings: string[] = [];
  if (instruments.length === 0) {
    internalWarnings.push('暂无可用市场上下文数据');
  }
  if (freshness !== 'intraday') {
    internalWarnings.push('市场上下文为延迟或历史数据，不可作为交易执行报价');
  }

  const mergedWarnings = Array.from(new Set([...(params.warnings || []), ...internalWarnings]));

  return {
    generatedAt,
    asOf,
    freshness,
    sourceSummary,
    dataQuality,
    instruments,
    factors,
    regime,
    crossAssetSignals,
    warnings: mergedWarnings
  };
}
