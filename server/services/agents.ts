import { getUniversalAiClient } from "../utils/ai-universal";
import { DEFAULT_PROMPTS } from "../../src/lib/defaultPrompts";

export async function runAnalysisAgent(userTier: string, contextData: any, history: any[], section: string, query: string, settings?: any, attachments: any[] = []) {
  const ai = getUniversalAiClient(settings);
  
  let systemPrompt = "";
  const customPrompts = settings?.agentPrompts || {};

  // 精心设计的各个子Agent的Prompt Engineering
  switch (section) {
    case "Debt Focus":
      systemPrompt = customPrompts.debt || DEFAULT_PROMPTS.debt;
      break;
    case "High Net Worth":
      systemPrompt = customPrompts.hnw || DEFAULT_PROMPTS.hnw;
      break;
    case "Market Analysis":
      systemPrompt = customPrompts.market || DEFAULT_PROMPTS.market;
      break;
    case "Devil Advocate":
      systemPrompt = customPrompts.devil || DEFAULT_PROMPTS.devil;
      break;
    default:
      systemPrompt = customPrompts.general || DEFAULT_PROMPTS.general;
      break;
  }

  const authenticityPact = `【真实性公约】: 你是一个严格的专业财务终端。
在分析用户证券投资资产时，若上下文提供了多账户结构 livePortfolioAccounts，请优先按账户维度进行诊断评估；只有当其为空或缺失时，你才 fallback 使用合并后的或历史的 publicHoldings/livePortfolio。
你只能使用下面提供了 \`上下文数据\` 的数值作为硬核持仓资产事实：
- [marketData] / [livePortfolio] / [livePortfolioAccounts] 中的价格、市值、数量可以作为标的和账户的真实实时事实。如果数据中没有某个标的的当前股价，你必须回答『无法获取该标的的实时行情』，严禁虚构任何实时价格和市值。若使用了数据，必须标注数据来源。
- [marketContext]（如果存在于上下文数据中）是冻结的延迟/历史市场上下文，只能用于判断：risk Mode、利率压力、美元压力、信用压力、商品冲击、波动率状态与跨资产信号和板块大势。
- 严禁将 marketContext 表述为：“实时新闻事实”、“最新突发政策”、“盘中交易执行级报价”或“刚刚公布的财报和经济数据”。
- 如果引用 marketContext，你必须使用“根据本轮延迟/历史市场上下文提示/表明/主观提示...”这类客观限定词。
- marketContext 绝不能用于改写用户个人的资产 facts，不能用它来反推或计算用户缺少的标的股价或市值。
- 严禁虚构任何不存在的账户市值、最新财务报表或大盘动态。\n\n`;

  try {
    let parts: any[] = [{ text: `${authenticityPact}系统设定：\n${systemPrompt}\n\n当前用户所处层级：${userTier}\n\n历史对话记录：\n${JSON.stringify(history)}\n\n上下文数据：\n${JSON.stringify(contextData)}\n\n用户的需求/提问：\n${query}` }];
    if (attachments && attachments.length > 0) {
       attachments.forEach((att: any) => {
          if (att.data) parts.push({ inlineData: { data: att.data, mimeType: att.mimeType } });
       });
    }

    let timeoutId: any;
    const response = await Promise.race([
      ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: [
          {
            role: "user",
            parts
          }
        ],
        config: {
          temperature: 0.2, // 保持专业性和稳定性
          tools: [{ googleSearch: {} }],
        }
      }),
      new Promise<any>((_, reject) => { timeoutId = setTimeout(() => reject(new Error('Agent AI Timeout')), 60000); })
    ]).finally(() => clearTimeout(timeoutId));
    return response.text;
  } catch (error: any) {
    console.error(`Agent Error (${section}):`, error);
    const isFatal = error.message?.includes('API_KEY_INVALID') || error.message?.includes('API key not valid') || error.message?.includes('exceeded your current quota') || error.message?.includes('Quota exceeded') || error.message?.includes('429') || error.message?.includes('RESOURCE_EXHAUSTED') || error.message?.includes('monthly spending cap');
    if (isFatal) {
      throw error;
    }
    return `[专家分析服务异常] 无法获取 ${section} 板块的结论。`;
  }
}
