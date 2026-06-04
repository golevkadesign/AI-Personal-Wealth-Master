import {
  AssistantResponseViewModel,
  AssistantResponseBlock,
  AssistantResponseMeta,
  AssistantResponseTone,
  AssistantJudgmentCard,
  AssistantJudgmentCardsBlock,
  AssistantSummaryBlock,
  AssistantBulletBlock,
  AssistantTableBlock,
  AssistantChipBlock,
  AssistantPromptBlock,
} from './chat-response-types';

/**
 * 保护 Code Fence，将文本中所有的代码块（``` ... ```）占位，
 * 避免其内部的列表、表格或 JSON 被误解析为普通 UI 元素。
 */
function maskCodeBlocks(text: string): { maskedText: string; codeBlocks: string[] } {
  const codeBlocks: string[] = [];
  const regex = /```[\s\S]*?```/g;
  const maskedText = text.replace(regex, (match) => {
    codeBlocks.push(match);
    return `__CODE_BLOCK_PLACEHOLDER_${codeBlocks.length - 1}__`;
  });
  return { maskedText, codeBlocks };
}

/**
 * 将被占位的代码块（占位符）还原回原文，确保数据无损
 */
function restoreCodeBlocks(text: string, codeBlocks: string[]): string {
  return text.replace(/__CODE_BLOCK_PLACEHOLDER_(\d+)__/g, (_, idx) => {
    const i = parseInt(idx, 10);
    return codeBlocks[i] !== undefined ? codeBlocks[i] : '';
  });
}

/**
 * 估算阅读时间
 */
function estimateReadMinutes(text: string): number {
  const charCount = text.length;
  const minutes = Math.ceil(charCount / 500);
  return Math.min(Math.max(minutes, 1), 10);
}

/**
 * 判定一段文本是否包含明确的列表或表格
 */
function hasStructuredListOrTable(text: string): boolean {
  // 检查是否含有标准 Markdown 表格的分隔符
  if (/\|[ :]*-[ -:|]*\|/.test(text)) {
    return true;
  }
  // 检查是否含有列表
  const lines = text.split('\n');
  let listCount = 0;
  for (const line of lines) {
    if (/^\s*([-*+]|\d+(\.|\u3001))\s+/.test(line)) {
      listCount++;
      if (listCount >= 3) return true;
    }
  }
  return false;
}

/**
 * 后置恢复 blocks 内的占位符
 */
function restoreBlocks(blocks: AssistantResponseBlock[], codeBlocks: string[]): AssistantResponseBlock[] {
  return blocks.map((block) => {
    switch (block.type) {
      case 'summary':
        return {
          ...block,
          items: block.items.map(item => restoreCodeBlocks(item, codeBlocks)),
        };
      case 'judgmentCards':
        return {
          ...block,
          cards: block.cards.map(card => ({
            ...card,
            title: restoreCodeBlocks(card.title, codeBlocks),
            body: restoreCodeBlocks(card.body, codeBlocks),
            evidence: card.evidence ? restoreCodeBlocks(card.evidence, codeBlocks) : undefined,
          })),
        };
      case 'bullets':
        return {
          ...block,
          items: block.items.map(item => restoreCodeBlocks(item, codeBlocks)),
        };
      case 'table':
        return {
          ...block,
          headers: block.headers.map(h => restoreCodeBlocks(h, codeBlocks)),
          rows: block.rows.map(row => row.map(cell => restoreCodeBlocks(cell, codeBlocks))),
        };
      case 'chips':
        return {
          ...block,
          chips: block.chips.map(chip => restoreCodeBlocks(chip, codeBlocks)),
        };
      case 'followupPrompts':
        return {
          ...block,
          prompts: block.prompts.map(p => restoreCodeBlocks(p, codeBlocks)),
        };
      case 'accordion':
        return {
          ...block,
          content: restoreCodeBlocks(block.content, codeBlocks),
        };
      case 'markdownFallback':
        return {
          ...block,
          content: restoreCodeBlocks(block.content, codeBlocks),
        };
      default:
        return block;
    }
  });
}

export function buildAssistantResponseViewModel(rawText: string): AssistantResponseViewModel {
  const safeRawText = typeof rawText === 'string'
    ? rawText
    : rawText == null
    ? ''
    : String(rawText);

  const fallbackModel = (isFallback: boolean = true, customBlocks?: AssistantResponseBlock[]): AssistantResponseViewModel => {
    const len = safeRawText.length;
    return {
      rawText: safeRawText,
      meta: {
        rawLength: len,
        estimatedReadMinutes: estimateReadMinutes(safeRawText),
        parsedAt: Date.now(),
        parserVersion: '1.0.0-diagnostics',
        isFallback,
        confidence: isFallback ? 'low' : 'medium',
      },
      title: '财富诊断报告',
      tone: 'neutral',
      blocks: customBlocks || [
        {
          type: 'markdownFallback',
          title: '详细诊断分析',
          content: safeRawText,
        },
      ],
      remainderMarkdown: safeRawText,
    };
  };

  if (!safeRawText.trim()) {
    return fallbackModel(true);
  }

  // 1. 保护代码块
  const { maskedText, codeBlocks } = maskCodeBlocks(safeRawText);

  // 2. 基础分行
  const lines = maskedText.split('\n');

  // 初始化容器
  const blocks: AssistantResponseBlock[] = [];
  const usedLineIndexes = new Set<number>();

  // --- A. SUMMARY SECTION ---
  let summaryBlock: AssistantSummaryBlock | null = null;
  const summaryHeaders = ['一句话结论', '先说结论', '核心结论', '结论', 'summary', '核心摘要', '摘要'];

  // 尝试寻找专有的 Summary 段落
  let foundSummaryIndex = -1;
  let summaryTitle = '核心结论';

  for (let i = 0; i < lines.length; i++) {
    const lineClean = lines[i].trim();
    const matchedHeader = summaryHeaders.find(h => 
      lineClean.toLowerCase().includes(h.toLowerCase()) && 
      (lineClean.startsWith('#') || lineClean.endsWith(':') || lineClean.endsWith('：'))
    );
    if (matchedHeader) {
      foundSummaryIndex = i;
      summaryTitle = lineClean.replace(/^[#\s*:：]+|[#\s*:：]+$/g, '').trim() || '核心结论';
      break;
    }
  }

  const extractedSummaryItems: string[] = [];
  if (foundSummaryIndex !== -1) {
    usedLineIndexes.add(foundSummaryIndex);
    let lineIdx = foundSummaryIndex + 1;
    while (lineIdx < lines.length && extractedSummaryItems.length < 2) {
      const line = lines[lineIdx].trim();
      // 如果进入了别的标题或表格，就停止
      if (line.startsWith('#') || line.startsWith('|')) {
        break;
      }
      if (line) {
        // 清理列表前缀
        const cleanItem = line.replace(/^\s*([-*+]|\d+(\.|\u3001))\s*/, '').trim();
        if (cleanItem) {
          extractedSummaryItems.push(cleanItem);
          usedLineIndexes.add(lineIdx);
        }
      }
      lineIdx++;
    }
  } else {
    // 默认兜底：如果没有显式 Summary 标题，抓取头 1-2 段不为空的简短非列表作为 summary
    let lineIdx = 0;
    while (lineIdx < lines.length && extractedSummaryItems.length < 2) {
      const line = lines[lineIdx].trim();
      if (line && !line.startsWith('#') && !line.startsWith('|') && !/^\s*([-*+]|\d+(\.|\u3001))\s*/.test(line)) {
        let cleanText = line;
        if (cleanText.length > 160) {
          cleanText = cleanText.substring(0, 160) + '…';
        }
        extractedSummaryItems.push(cleanText);
        // 注意：不作为 usedLine 彻底过滤掉，以便原文能在后面完美展示
      }
      lineIdx++;
    }
  }

  if (extractedSummaryItems.length > 0) {
    summaryBlock = {
      type: 'summary',
      title: summaryTitle,
      items: extractedSummaryItems,
    };
    blocks.push(summaryBlock);
  }

  // --- B. TABLE SECTION ---
  // 识别 Markdown 表格
  let i = 0;
  while (i < lines.length) {
    const line = lines[i].trim();
    if (line.startsWith('|') && i + 1 < lines.length) {
      const nextLine = lines[i + 1].trim();
      // 验证是否是分隔符行，如 | --- | --- |
      if (nextLine.startsWith('|') && /\|[ :]*-[ -:|]*\|/.test(nextLine)) {
        // 解析 Header
        const headers = line.split('|').map(s => s.trim()).filter((s, idx, arr) => idx > 0 && idx < arr.length - 1);
        const rows: string[][] = [];
        
        usedLineIndexes.add(i);
        usedLineIndexes.add(i + 1);

        let rowIdx = i + 2;
        while (rowIdx < lines.length) {
          const rowLine = lines[rowIdx].trim();
          if (rowLine.startsWith('|')) {
            const cells = rowLine.split('|').map(s => s.trim()).filter((_, idx, arr) => idx > 0 && idx < arr.length - 1);
            if (rows.length < 5) {
              rows.push(cells);
            }
            usedLineIndexes.add(rowIdx);
            rowIdx++;
          } else {
            break;
          }
        }

        if (headers.length > 0 && rows.length > 0) {
          blocks.push({
            type: 'table',
            title: '关键对照数据',
            headers,
            rows,
          } as AssistantTableBlock);
        }
        i = rowIdx - 1;
      }
    }
    i++;
  }

  // --- C. JUDGMENT CARDS SECTION ---
  // 提取风险、机会、动作判断卡
  const riskKeywords = ['风险', '回撤', '集中', '波动', '压力', '下行', '恶化', '异常', '危险'];
  const opportunityKeywords = ['机会', '改善', '利好', '修复', '上行', '增长', '配置价值', '弹性'];
  const actionKeywords = ['建议', '行动', '处理', '调整', '减持', '增配', '观察', '复盘', '推演', '检查'];

  const judgmentCards: AssistantJudgmentCard[] = [];
  let hasRisk = false;
  let hasOpportunity = false;
  let hasAction = false;

  const sentences: { text: string; idx: number }[] = [];
  lines.forEach((l, idx) => {
    if (usedLineIndexes.has(idx) || l.trim().startsWith('#') || l.trim().startsWith('|')) return;
    // 按分句切分
    const parts = l.split(/[。！；]/);
    parts.forEach(part => {
      const clean = part.trim();
      if (clean.length > 15 && clean.length < 150) {
        sentences.push({ text: clean, idx });
      }
    });
  });

  for (const s of sentences) {
    if (judgmentCards.length >= 3) break;

    // 匹配风险
    if (!hasRisk && riskKeywords.some(kw => s.text.includes(kw))) {
      judgmentCards.push({
        id: `risk-${s.idx}`,
        tone: 'risk',
        title: '风险警示',
        body: s.text,
      });
      hasRisk = true;
      continue;
    }

    // 匹配机会
    if (!hasOpportunity && opportunityKeywords.some(kw => s.text.includes(kw))) {
      judgmentCards.push({
        id: `opp-${s.idx}`,
        tone: 'opportunity',
        title: '成长研判',
        body: s.text,
      });
      hasOpportunity = true;
      continue;
    }

    // 匹配建议/行动
    if (!hasAction && actionKeywords.some(kw => s.text.includes(kw))) {
      judgmentCards.push({
        id: `action-${s.idx}`,
        tone: 'action',
        title: '策略建议',
        body: s.text,
      });
      hasAction = true;
      continue;
    }
  }

  if (judgmentCards.length > 0) {
    blocks.push({
      type: 'judgmentCards',
      title: '多维财务研判',
      cards: judgmentCards,
    } as AssistantJudgmentCardsBlock);
  }

  // --- D. CHIPS SECTION (CONDITIONAL TRIGGERS) ---
  const chipKeywords = ['>', '<', '≥', '≤', '超过', '低于', '跌破', '突破', '回撤', 'vix', '收益率', '现金流', '安全垫'];
  const matchedChips: string[] = [];
  
  for (let idx = 0; idx < lines.length; idx++) {
    if (usedLineIndexes.has(idx) || lines[idx].trim().startsWith('#')) continue;
    const line = lines[idx].trim();
    if (line.length > 4 && line.length < 32 && chipKeywords.some(kw => line.toLowerCase().includes(kw))) {
      matchedChips.push(line.replace(/^\s*([-*+]|\d+(\.|\u3001))\s*/, '').trim());
      if (matchedChips.length >= 6) break;
    }
  }

  if (matchedChips.length > 0) {
    blocks.push({
      type: 'chips',
      title: '核心触发指标',
      chips: matchedChips,
    } as AssistantChipBlock);
  }

  // --- E. BULLETS (LISTS) ---
  const bLines: string[] = [];
  for (let idx = 0; idx < lines.length; idx++) {
    if (usedLineIndexes.has(idx) || lines[idx].trim().startsWith('#')) continue;
    const line = lines[idx].trim();
    if (/^\s*([-*+]|\d+(\.|\u3001))\s+/.test(line)) {
      const item = line.replace(/^\s*([-*+]|\d+(\.|\u3001))\s*/, '').trim();
      if (item && item.length > 5 && item.length < 120) {
        bLines.push(item);
        if (bLines.length >= 5) break;
      }
    }
  }

  if (bLines.length > 0) {
    blocks.push({
      type: 'bullets',
      title: '佐证事实与研判点',
      items: bLines,
    } as AssistantBulletBlock);
  }

  // --- F. FOLLOW-UP PROMPTS ---
  const promptKeywords = ['你可以继续问', '您可以追问', '建议追问', '可进一步分析', '追问建议', '参考追问', '下一步分析'];
  let foundPromptFlagIdx = -1;
  const followupPrompts: string[] = [];

  for (let idx = 0; idx < lines.length; idx++) {
    const line = lines[idx].trim();
    if (promptKeywords.some(kw => line.includes(kw))) {
      foundPromptFlagIdx = idx;
      break;
    }
  }

  if (foundPromptFlagIdx !== -1) {
    let pIdx = foundPromptFlagIdx + 1;
    while (pIdx < lines.length && followupPrompts.length < 4) {
      const line = lines[pIdx].trim();
      if (line.startsWith('#') || line.startsWith('|')) {
        break;
      }
      if (line) {
        const cleanPrompt = line.replace(/^\s*([-*+]|\d+(\.|\u3001))\s*/, '').replace(/^[“"「'\s*]+|[”"」'\s*!！?？]+$/g, '').trim();
        if (cleanPrompt && cleanPrompt.length > 4 && cleanPrompt.length < 60) {
          followupPrompts.push(cleanPrompt);
          usedLineIndexes.add(pIdx);
        }
      }
      pIdx++;
    }
  }

  if (followupPrompts.length > 0) {
    blocks.push({
      type: 'followupPrompts',
      title: '高价值追问推演',
      prompts: followupPrompts,
    } as AssistantPromptBlock);
  }

  // Restore codes across all parsed blocks
  const finalProcessedBlocks = restoreBlocks(blocks, codeBlocks);

  // Fallback 过滤器：
  // 如果解析出的有效交互式 blocks 少于两个 (或者 rawText 字数低于 240字)，且没有显著的列表/表格等
  const interactiveBlocksCount = finalProcessedBlocks.filter(b => b.type !== 'summary').length;
  const wordCount = safeRawText.length;
  
  const keepCustomStructure = wordCount >= 240 || hasStructuredListOrTable(maskedText);
  if (interactiveBlocksCount < 2 && !keepCustomStructure) {
    return fallbackModel(true);
  }

  // 3. 计算 Tone
  let tone: AssistantResponseTone = 'neutral';
  if (hasRisk && hasOpportunity && hasAction) {
    tone = 'mixed';
  } else if (hasRisk) {
    tone = 'risk';
  } else if (hasOpportunity) {
    tone = 'opportunity';
  } else if (hasAction) {
    tone = 'action';
  }

  // 4. 余项 Markdown 处理
  // 我们在 viewModel.remainderMarkdown 中放置原始完整文本以零退化、零流失保护原始财务事实
  const remainderMarkdown = safeRawText;

  // Confidence 计算
  let confidence: 'low' | 'medium' | 'high' = 'medium';
  if (summaryBlock && interactiveBlocksCount >= 2) {
    confidence = 'high';
  } else if (interactiveBlocksCount === 0) {
    confidence = 'low';
  }

  return {
    rawText: safeRawText,
    meta: {
      rawLength: safeRawText.length,
      estimatedReadMinutes: estimateReadMinutes(safeRawText),
      parsedAt: Date.now(),
      parserVersion: '1.0.0-diagnostics',
      isFallback: false,
      confidence,
    },
    title: summaryBlock ? summaryBlock.title : '财富诊断分析',
    tone,
    blocks: finalProcessedBlocks,
    remainderMarkdown: safeRawText,
  };
}
