import { getUniversalAiClient } from "../utils/ai-universal";
import type { PortfolioReviewSession, PortfolioReviewReport } from "../../src/types/portfolio-review";
import { compactMarketContextForPrompt } from "./marketContext/promptContext";

/**
 * Executes a highly specialized, professional AI-driven Portfolio Review analysis
 * that returns a structured, bulletproof PortfolioReviewReport JSON.
 */
export async function analyzePortfolioReview(
  session: PortfolioReviewSession,
  settings?: any,
  userRiskPolicy?: {
    riskPreference?: string;
    maxDrawdownTolerance?: string;
    allowMargin?: boolean;
    allowOptions?: boolean;
    allowCrypto?: boolean;
  },
  reviewMemory?: any,
  previousReviewSummary?: any
): Promise<PortfolioReviewReport> {
  const ai = getUniversalAiClient(settings);

  // We check whether settings specifies an advanced model, otherwise we route via 'pro'
  const targetModel = settings?.provider === 'openai' ? 'pro' : 'pro';

  const currentSnapshot = session.currentSnapshot;
  const previousSnapshot = session.previousSnapshot;
  const deltas = session.deltas || [];
  const dataConfidence = currentSnapshot?.dataConfidence || 'low';
  const missingFields = currentSnapshot?.missingFields || [];
  const warnings = currentSnapshot?.warnings || [];

  const marketContext = session.marketContextSnapshot;
  const hasMarketContext = Boolean(marketContext);
  const marketContextCapturedAt = session.marketContextCapturedAt;

  const compactMarketContext = hasMarketContext
    ? compactMarketContextForPrompt(marketContext, marketContextCapturedAt)
    : null;

  const marketContextBoundaryNote = hasMarketContext
    ? "（注：本轮接入延迟/历史市场上下文，但未接入实时新闻与交易执行级报价）"
    : "（注：本轮未接入实时宏观与新闻数据）";

  const marketContextInstruction = hasMarketContext
    ? `
【本轮已接入的市场上下文边界】
1. 本轮包含创建复盘会话时冻结的 Market Context 快照。
2. 该 Market Context 来源于延迟/历史市场数据，可用于判断 risk mode、利率压力、美元压力、信用压力、商品冲击、波动率状态与跨资产信号。
3. 你可以在组合诊断、风险解释、触发条件设计中引用这些 marketContextSnapshot 信号。
4. 但你必须明确：这不是实时新闻流，不是交易执行级报价，不是最新政策/财报/突发事件数据。
5. 严禁把它表述为“实时行情显示”“最新新闻显示”“刚刚公布”“今日盘中已确认”等。
6. 若引用 Market Context，必须用“本轮冻结的延迟/历史市场上下文显示/提示/暗示”这类表达。
`
    : `
【本轮未接入市场上下文】
1. 本轮没有输入实时宏观行情、外部新闻、政策变化、财报日历或市场环境快照。
2. 如需评述市场或行业环境，只能使用条件假设表达。
`;

  const systemInstruction = `你是一个顶级独立持仓复盘与个人财富风险管理 AI 专家。
你的任务是根据用户的当前持仓快照、历史快照以及两者的持仓变化（Deltas），生成一份专业的、极具洞察力的结构化复盘诊断报告。

【关键要求】
1. 你的回复必须是且只能是符合 JSON 格式的字符串，且结构必须与要求的 PortfolioReviewReport 完全一致。不得输出 markdown 代码块（除JSON外），不得输出 any 多余的问候语、闲聊或解释。
2. 每一个建议、诊股或行动，都必须严格遵守【真实性公约与严格事实边界】：
   - 事实、推理、建议彻底分离。
   - 严禁承诺任何未来投资收益，更不得提供任何类似于“必涨/必跌/稳赚/绝对翻倍”等误导性保底描述。
   - 【严防事实幻觉与虚假外部数据依赖】：当前系统架构并没有接入实时的宏观变动、实时新闻流、最新财报或盘中报价。你绝对不得声称或伪装成已经核验了“最新二级市场盘中行情”、“最新财政政策”、“近期行业头条新闻”或“最新财报数据”等外部动态并作出了本次复盘。
   - ${hasMarketContext ? "由于接入了延迟/历史市场环境背景快照，你可以在诊断和建议中运用该快照包含的信息（如波动状态、跨资产信号和敏感敞口）。" : ""}如需评述市场或行业环境，你必须使用明确的主观条件式表达，且所有涉及未来动作触发条件的输出均应设计为假设性的条件触发逻辑（例如：“若后续市场整体进入 risk-off 状态”、“若该标的跌破用户设定观察位”），绝不要虚构和臆造具体的、不存在的最新大盘成交额、昨日头条新闻、美联储刚刚公布的降息决议、最新 CPI 指数或某公司突发公报。
   - 每个 Action Plan 的推荐行动项必须配有触发条件(triggerCondition)和失效/中止条件(invalidationCondition)。
3. 先进行“整体资产组合维度”的分析，再针对“每个主要持仓（PositionReviews）”进行多角度评估，最后给出“在当前的市场环境/数据输入边界下，最不应该做的 3 件事”以及“短期/中期/长期行动计划”。
4. 绝不能编造本期或上期持仓中根本不存在的股票代码、数量、成本价或变动动作。
5. 如果历史快照缺失（即 previousSnapshot 为空/未定义），你必须明确说明这是首次复盘，只能对当前静态资产架构进行全景分析，比对时属于首次建档，无对比动作。
6. 如果当前快照的可信度（dataConfidence）为 'low'，你必须在报告 of 页面上的 summary 总体概述中明确说明：由于缺失必要的持仓基础数据字段，本次分析可能存在偏差，信息置信度较低。
7. 【事实边界强制露出】：不管在什么情况下，在输出的 "summary" 字段最末尾，你都必须强制包含一句说明：“${marketContextBoundaryNote}”，以此将 AI 复盘的理性和事实性约束在当下真实的持仓快照与指定的数据边界中。
${marketContextInstruction}

【前后两轮对冲比对核校与交易纪律评价指令】
1. 如果存在【上期历史复盘与记忆交叉核对】信息：
   - 你必须仔细对比“本期持仓异动 Deltas”和“当前持仓快照”，评估用户是否延续、背道而驰、或是严格执行了上期行动计划中的关键条目（lastActionItems）。
   - 指出是否存在重复出现的、不理性或不合规的决策行为（例如上期交代需要极力避免(avoidActions)的事，本期反而变相违背了该边界），严肃评估其自主交易的对冲纪律。
   - 绝不要进行情绪化或道德审判，只聚焦于理性的交易逻辑、风控边界和偏离状态进行客观、中性的评议。
   - 在输出的 "summary" 总体复盘概述句中，必须包含至少一两句客观且具备穿透力的评价，指出“本轮相对上轮操作质量、计划落实度与行为偏差”。
2. 如果不存在任何上期历史复盘与记忆（即属于首次复盘/初始基准阶段）：
   - 在输出的 "summary" 总体复盘概述句中，必须明确包含：“说明本轮作为初始基准进行建档与安全防护分析”。

【输出 JSON 数据模型 (PortfolioReviewReport)】
{
  "summary": "总体复盘概述，字数控制在 250 字左右。需阐明核心基调、风险分布、本轮相比上轮决策与纪律评价（若为首次说明本轮作为初始基准），以及复盘的核心关注点。末尾必须附带字样：“${marketContextBoundaryNote}”。",
  "portfolioDiagnosis": {
    "portfolioType": "例如：科技偏度集中型组合、防守型高股息组合 等",
    "topRisks": [
      "具体风险项1（须包含对应的数据关联或持仓支撑描述，如：半导体板块仓位过重达 X%，集中度风险极高）",
      "具体风险项2"
    ],
    "topOpportunities": [
      "具体增值/优化机会1",
      "具体增值/优化机会2"
    ],
    "avoidActions": [
      "最不应该做的 3 件事（条目1）",
      "最不应该做的 3 件事（条目2）",
      "最不应该做的 3 件事（条目3）"
    ]
  },
  "positionReviews": [
    {
      "symbol": "资产代码，例如 BABA",
      "name": "资产名称",
      "accountName": "持有账户名称",
      "currentRole": "该持仓在当前组合中的主要角色定义（例如：长期压舱石、核心增长引擎、战术对冲标目的、纯投机摸彩）",
      "actionEvaluation": "对于本轮该标的变动（增减持/建仓/清仓/无变化）的合理性、合规性评估与推理逻辑",
      "recommendation": "增持 | 继续持有 | 观察等待 | 分批止盈 | 降低仓位 | 清仓 | 换仓 | 对冲 | 暂不适合操作",
      "recommendationStrength": "强 | 中 | 弱",
      "horizon": "短线 | 波段 | 中线 | 长线",
      "triggerConditions": [
        "触发该推荐操作的具体执行相对价格、假设信号或事件"
      ],
      "invalidationConditions": [
        "导致该操作建议应该被终止或暂停的反向条件或条件边界"
      ],
      "risks": [
        "该标的最核心单一风险点"
      ]
    }
  ],
  "actionPlan": {
    "shortTerm": [
      {
        "title": "短期行动建议标题",
        "rationale": "行动依据",
        "triggerCondition": "触发启动条件",
        "invalidationCondition": "中止执行条件",
        "priority": "high | medium | low"
      }
    ],
    "midTerm": [
      {
        "title": "中期行动建议标题",
        "rationale": "行动依据",
        "triggerCondition": "触发启动条件",
        "invalidationCondition": "中止执行条件",
        "priority": "high | medium | low"
      }
    ],
    "longTerm": [
      {
        "title": "长期行动建议标题",
        "rationale": "行动依据",
        "triggerCondition": "触发启动条件",
        "invalidationCondition": "中止执行条件",
        "priority": "high | medium | low"
      }
    ]
  },
  "nextReviewNeeds": [
    "若要进行下一次复盘，当前缺少的、后续需要重点监控并导入的必要维度（例如：需要补充期权希腊字母、美股保证金账户等数据）"
  ]
}`;

  const userRequestPrompt = `
请对以下多账户持仓复盘会话（PortfolioReviewSession）进行严格专业分析：

【重要事实边界限制（禁止突破）】
1. 本次复盘请求中，我们【没有】为你输入任何实时的、最新盘中行情波动、实时政策法规变化、最新行业新闻、昨日公司的财报日历。
2. ${hasMarketContext ? "本轮输入包含冻结的延迟/历史 Market Context 快照，但绝非实时行情交易报价，不要编造你已获取了实时最新的外部新闻、突发地缘政策。" : "本轮复盘没有输入任何外部宏观环境、行业新闻或大盘指数环境。"}
3. 你绝对不得假装已经获取、核验或掌握了最新外部资讯，严厉禁止捏造当前的外部经济或市场头条。
4. 在你输出的 "summary" 的最末尾，必须强制加上“${marketContextBoundaryNote}”，以维护报告真实性。

【本轮会话详情】
- 会话 ID: ${session.id}
- 会话创建时间: ${new Date(session.createdAt).toISOString()}

【当前持仓快照 (currentSnapshot)】
- 账户总数: ${currentSnapshot?.accountCount || 0}
- 持仓总数: ${currentSnapshot?.positionCount || 0}
- 总市值估值: ${currentSnapshot?.totalMarketValue || 0} USD
- 数据来源: ${currentSnapshot?.source || 'unknown'}
- 数据置信度: ${dataConfidence}
- 缺失基础字段: ${JSON.stringify(missingFields)}
- 数据异常/清洗警告: ${JSON.stringify(warnings)}
- 扁平化持仓池: ${JSON.stringify(currentSnapshot?.flattenedHoldings || [])}

【本轮冻结市场上下文 Market Context Snapshot】
${compactMarketContext ? JSON.stringify(compactMarketContext) : "【无 Market Context 快照：本轮仅基于持仓快照、历史变化和用户风险参数进行分析】"}

【历史持仓快照 (previousSnapshot)】
${previousSnapshot ? JSON.stringify({
    accountCount: previousSnapshot.accountCount,
    positionCount: previousSnapshot.positionCount,
    totalMarketValue: previousSnapshot.totalMarketValue,
    source: previousSnapshot.source,
    flattenedHoldings: previousSnapshot.flattenedHoldings || []
  }) : "【无历史对比快照：属于首次建档，无对比动作】"}

【持仓异动 Delta 对冲结果 (deltas)】
${deltas.length > 0
  ? JSON.stringify(deltas)
  : (!previousSnapshot
      ? "【首次复盘建档：无历史快照，无法判断新建仓/加仓/减仓/清仓动作。本轮仅作为基准快照。】"
      : "【与上一轮快照相比，未检测到可靠的持仓数量变化。】"
    )}

【上期历史复盘与记忆交叉核对 / Historical Review Memory Correlation】
${reviewMemory ? `- 上次复盘引入的重点防御行动细节（Review Memory）:
  * 观察到的偏好/认知行为偏差: ${JSON.stringify(reviewMemory.behavioralPatterns || [])}
  * 本地记录 of 常犯错误/规避动作: ${JSON.stringify(reviewMemory.recurringMistakes || [])}
  * 遗留计划的高/中优先级行动项 (Last Action Items): ${JSON.stringify(reviewMemory.lastActionItems || [])}
  * 上期设定的复盘补充需求与监控重点: ${JSON.stringify(reviewMemory.nextReviewFocus || [])}` : "- 【暂无本地已保存的复盘记忆：属于基础对冲建档首诊】"}

${previousReviewSummary ? `- 上一期复盘会话诊断总结 (Previous Review Session Summary):
  * 会话 ID: ${previousReviewSummary.id}
  * 上期复盘诊断结论: ${previousReviewSummary.summary}
  * 上期决策最需规避的 3 件事: ${JSON.stringify(previousReviewSummary.avoidActions || [])}` : "- 【暂无可以对应的上一期线上会话报告：当前正处于账户复盘的始祖初始基准阶段】"}

【用户的财富画像与风险参数】
${JSON.stringify(userRiskPolicy || { riskPreference: 'moderate', maxDrawdownTolerance: '20%' })}

请直接输出符合我上面要求格式的 JSON 数据。不要附带Markdown代码块的头尾 \`\`\`json / \`\`\`，必须直接是一个可直接进行 JSON.parse() 的完美 JSON 串。
`;

  try {
    const response = await ai.models.generateContent({
      model: targetModel,
      contents: [
        {
          role: "user",
          parts: [{ text: userRequestPrompt }]
        }
      ],
      config: {
        systemInstruction,
        temperature: 0.2 // 低温度保证高度严格的结构化
      }
    });

    let rawText = response.text || "";
    // Clean code block ticks robustly
    let cleanedText = rawText
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```$/i, '')
      .trim();

    try {
      const parsedReport: PortfolioReviewReport = JSON.parse(cleanedText);

      // Post-sanitization safety checks to prevent TS or rendering issues
      if (!parsedReport.summary) {
        parsedReport.summary = `AI 返回的结构化复盘摘要缺失，本报告仅保留可解析字段。请重新生成以获得完整结论。${marketContextBoundaryNote}`;
      } else {
        let temp = parsedReport.summary
          .replace(/（注：本轮未接入实时宏观与新闻数据）/g, '')
          .replace(/（注：本轮接入延迟\\?\/历史市场上下文，但未接入实时新闻与交易执行级报价）/g, '')
          .trim();
        parsedReport.summary = `${temp} ${marketContextBoundaryNote}`;
      }
      if (!parsedReport.portfolioDiagnosis) {
        parsedReport.portfolioDiagnosis = {
          portfolioType: "无法确认",
          topRisks: ["AI 未返回可验证的组合风险项，请重新生成报告。"],
          topOpportunities: [],
          avoidActions: ["不要基于不完整报告执行交易动作。"]
        };
      }
      if (!parsedReport.positionReviews) {
        parsedReport.positionReviews = [];
      }
      if (!parsedReport.actionPlan) {
        parsedReport.actionPlan = { shortTerm: [], midTerm: [], longTerm: [] };
      }
      if (!parsedReport.nextReviewNeeds) {
        parsedReport.nextReviewNeeds = [];
      }

      return parsedReport;
    } catch (parseError: any) {
      console.error("[PortfolioReviewAgent] Failed to parse JSON. Raw LLM response text was:", rawText);
      throw new Error(`AI 返回的内容格式不符合严格 JSON 要求: ${parseError.message || String(parseError)}`);
    }
  } catch (error: any) {
    console.error("[PortfolioReviewAgent] Error diagnosing portfolio:", error);
    throw error;
  }
}
