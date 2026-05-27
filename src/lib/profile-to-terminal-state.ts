import { TerminalState, DistributionItem, Goal, UserPersona } from '../types/terminal';

/**
 * Pure function to map clear, factual properties in updatedProfile directly into
 * core Terminal State metrics, distributions, active goals, and persona indicators.
 */
export function deriveTerminalStatePatchFromProfile(profile: any): Partial<TerminalState> {
  if (!profile) return {};

  const patch: Partial<TerminalState> = {};

  // 1. Calculate Metrics
  const metricsPatch: any = {};
  
  if (profile.financial && profile.financial.netWorth !== undefined) {
    metricsPatch.netWorth = Number(profile.financial.netWorth);
    metricsPatch.netWorthSummary = "净资产总计。基于用户画像及实盘资产，进行底层事实统一。";
  }

  // Calculate liquidity sum
  let domesticCash = 0;
  let domesticFunds = 0;
  let offshoreCash = 0;
  let hasLiquidityValues = false;

  if (profile.financial?.assets) {
    const assets = profile.financial.assets;
    if (assets.domesticCash !== undefined) {
      domesticCash = Number(assets.domesticCash) || 0;
      hasLiquidityValues = true;
    }
    if (assets.domesticFunds !== undefined) {
      domesticFunds = Number(assets.domesticFunds) || 0;
      hasLiquidityValues = true;
    }
    if (assets.offshoreCash !== undefined) {
      offshoreCash = Number(assets.offshoreCash) || 0;
      hasLiquidityValues = true;
    }
  }

  const liquidityVal = domesticCash + domesticFunds + offshoreCash;
  if (hasLiquidityValues) {
    metricsPatch.liquidity = liquidityVal;
    metricsPatch.liquiditySummary = "高流动性周转资金总计（包含境内现金、货基及海外手头外汇资金）。";
  }

  // Calculate Monthly Burn Rate and Cashflow Velocity for FCF & Safety Ratio
  const cashFlowVelocity = profile.financialFlow?.cashFlowVelocity;
  const monthlyBurnRate = profile.financialFlow?.monthlyBurnRate;

  let fcfVal: number | undefined = undefined;
  if (typeof cashFlowVelocity === 'number' && typeof monthlyBurnRate === 'number') {
    fcfVal = cashFlowVelocity - monthlyBurnRate;
  } else if (profile.financial?.fcf !== undefined) {
    fcfVal = Number(profile.financial.fcf);
  }

  if (fcfVal !== undefined) {
    metricsPatch.fcf = fcfVal;
    metricsPatch.fcfSummary = "月度自由现金流净流入。";
  }

  // Calculate safety ratio
  if (hasLiquidityValues && typeof monthlyBurnRate === 'number' && monthlyBurnRate > 0) {
    metricsPatch.safetyRatio = Number((liquidityVal / monthlyBurnRate).toFixed(2));
    metricsPatch.safetyRatioSummary = "流动性资产对月度日常消耗开支的覆盖月数。";
  } else if (profile.financialFlow?.savingsRate !== undefined) {
    // optional fallback or neutral indicator if safetyRatio lacks burn rate
    metricsPatch.safetyRatioSummary = "流动性备付保障系数。目前缺乏月度总支出指标无法计算精确倍数。";
  }

  if (Object.keys(metricsPatch).length > 0) {
    patch.metrics = metricsPatch;
  }

  // 2. Map Distributions (liquidity, privateAssets, fixedAssets)
  const distributionsPatch: any = {};

  // Liquidity items list mapping
  if (hasLiquidityValues) {
    const liquidityItems: DistributionItem[] = [];
    if (profile.financial?.assets?.domesticCash !== undefined) {
      liquidityItems.push({
        id: "liq_domestic_cash",
        name: "境内现金",
        value: Number(profile.financial.assets.domesticCash),
        category: "liquidity",
        type: "cash"
      });
    }
    if (profile.financial?.assets?.domesticFunds !== undefined) {
      liquidityItems.push({
        id: "liq_domestic_funds",
        name: "境内固收/货基",
        value: Number(profile.financial.assets.domesticFunds),
        category: "liquidity",
        type: "fund"
      });
    }
    if (profile.financial?.assets?.offshoreCash !== undefined) {
      liquidityItems.push({
        id: "liq_offshore_cash",
        name: "境外/外汇现金",
        value: Number(profile.financial.assets.offshoreCash),
        category: "liquidity",
        type: "cash"
      });
    }
    distributionsPatch.liquidity = liquidityItems;
  }

  // Private assets mapping
  const privateAssetItems: DistributionItem[] = [];
  if (profile.financial?.assets?.realEstate !== undefined) {
    privateAssetItems.push({
      id: "priv_real_estate",
      name: "住宅及商业房产",
      value: Number(profile.financial.assets.realEstate),
      category: "private",
      type: "realestate"
    });
  }

  const equity = profile.financial?.assets?.equity;
  if (equity && typeof equity === 'object') {
    if (equity.byteOptions !== undefined) {
      privateAssetItems.push({
        id: "priv_byte_options",
        name: "字节跳动限制性期权",
        value: Number(equity.byteOptions),
        category: "private",
        type: "options"
      });
    }
    if (equity.antSERs !== undefined) {
      privateAssetItems.push({
        id: "priv_ant_sers",
        name: "蚂蚁集团 SERs 股份",
        value: Number(equity.antSERs),
        category: "private",
        type: "options"
      });
    }
    if (equity.antIntlOptions !== undefined) {
      privateAssetItems.push({
        id: "priv_ant_intl_options",
        name: "蚂蚁国际授予期权",
        value: Number(equity.antIntlOptions),
        category: "private",
        type: "options"
      });
    }
  } else if (equity !== undefined && !isNaN(Number(equity))) {
    privateAssetItems.push({
      id: "priv_equity_direct",
      name: "未上市股份/期权授权",
      value: Number(equity),
      category: "private",
      type: "options"
    });
  }

  if (privateAssetItems.length > 0) {
    distributionsPatch.privateAssets = privateAssetItems;
  }

  // Fixed Assets (passionAssets per item mapping)
  const fixedAssetItems: DistributionItem[] = [];
  const passionAssets = profile.assetsExtra?.passionAssets || profile.passionAssets;
  if (Array.isArray(passionAssets)) {
    passionAssets.forEach((item: any, idx: number) => {
      fixedAssetItems.push({
        id: `fixed_passion_asset_${idx}`,
        name: item.type || item.name || `另类/兴趣资产 #${idx + 1}`,
        value: Number(item.value || item.amount || 0),
        category: "fixed",
        type: "passion",
        liquidity: item.liquidity || "low"
      });
    });
  }
  if (fixedAssetItems.length > 0) {
    distributionsPatch.fixedAssets = fixedAssetItems;
  }

  if (Object.keys(distributionsPatch).length > 0) {
    patch.distributions = distributionsPatch;
  }

  // 3. Goal Mapping
  const goalsArray = Array.isArray(profile.goals) 
    ? profile.goals 
    : (Array.isArray(profile.goals?.coreDynamicGoals) 
        ? profile.goals.coreDynamicGoals 
        : (Array.isArray(profile.financial?.goals) 
            ? profile.financial.goals 
            : []));

  if (goalsArray.length > 0) {
    const firstGoal = goalsArray[0];
    if (firstGoal) {
      const goalPatch: any = {};
      if (typeof firstGoal === 'string') {
        goalPatch.name = firstGoal;
      } else if (typeof firstGoal === 'object') {
        const goalName = firstGoal.goal || firstGoal.name || firstGoal.title;
        if (goalName) {
          goalPatch.name = goalName;
        }
        if (firstGoal.target !== undefined && !isNaN(Number(firstGoal.target))) {
          goalPatch.target = Number(firstGoal.target);
        } else if (firstGoal.targetValue !== undefined && !isNaN(Number(firstGoal.targetValue))) {
          goalPatch.target = Number(firstGoal.targetValue);
        }
        if (firstGoal.current !== undefined && !isNaN(Number(firstGoal.current))) {
          goalPatch.current = Number(firstGoal.current);
        } else if (firstGoal.value !== undefined && !isNaN(Number(firstGoal.value))) {
          goalPatch.current = Number(firstGoal.value);
        }
      }
      if (Object.keys(goalPatch).length > 0) {
        patch.goal = goalPatch;
      }
    }
  }

  // 4. User Persona Matching
  const tags: string[] = [];
  const descParts: string[] = [];

  if (profile.career) {
    const role = profile.career.currentRole;
    const ind = profile.career.industry;
    if (role) tags.push(role);
    if (ind) tags.push(ind);
    if (role && ind) {
      descParts.push(`身处${ind}行业的${role}`);
    } else if (role || ind) {
      descParts.push(`${role || ind}`);
    }
  }

  if (profile.preferences) {
    const style = profile.preferences.investmentStyle;
    const mood = profile.preferences.emotionState;
    if (style) {
      tags.push(style);
      descParts.push(`偏好${style}投资策略`);
    }
    if (mood) {
      tags.push(mood);
      descParts.push(`当前情绪倾向呈${mood}`);
    }
  }

  if (Array.isArray(profile.behavioralBiases)) {
    profile.behavioralBiases.forEach((bias: any) => {
      if (typeof bias === 'string') {
        tags.push(bias);
      }
    });
  }

  if (tags.length > 0 || descParts.length > 0) {
    patch.userPersona = {
      tags: Array.from(new Set(tags)).filter(Boolean),
      description: descParts.length > 0 ? descParts.join('，') + '。' : "暂无定制化风险行为特征描述。"
    } as UserPersona;
  }

  return patch;
}
