import { useState, useRef, useEffect, useCallback } from 'react';
import { getSettings } from '../lib/settings';
import { useTranslation } from './useTranslation';

export type PlanStatus = 'idle' | 'thinking' | 'done';

export interface PlanState {
  status: PlanStatus;
  result: string;
  thinking: string;
}

export function useStrategyStream() {
  const { t } = useTranslation();
  const [nodePlans, setNodePlans] = useState<Record<string, PlanState>>({});
  const controllersRef = useRef<Map<string, AbortController>>(new Map());

  // Clean up all active streams on unmount
  useEffect(() => {
    return () => {
      controllersRef.current.forEach(controller => controller.abort());
      controllersRef.current.clear();
    };
  }, []);

  const executePlan = useCallback(async (typeStr: string, item: any, isLong: boolean, idx: number) => {
    const contentStr = encodeURIComponent(item.description || item.title || '');
    const contentHash = btoa(contentStr).slice(0, 15);
    const planKey = `${isLong ? 'long' : 'short'}-${idx}-${contentHash}`;

    // Abort existing if running
    if (controllersRef.current.has(planKey)) {
        controllersRef.current.get(planKey)?.abort();
    }
    const controller = new AbortController();
    controllersRef.current.set(planKey, controller);

    setNodePlans(prev => ({
      ...prev,
      [planKey]: { status: 'thinking', result: '', thinking: t('dashboard.strategyThinkingStart') }
    }));

    const prompt = `你是一个顶尖的人生战略推演系统（配有高级推演核心）。请对以下【${item.timeNode}】阶段的计划进行极度硬核的落地推演。
节点名称：[${item.title}]
节点说明：${item.description}

严格要求：
1. 必须开启思维链，利用 <think> 标签包裹你的所有深层推理、定点分析步骤。
2. <think> 闭合后，严格按照以下三段式输出真正的硬核执行成果（使用精简 Markdown，禁止口水话和废话）：
   - ⚡ 核心执行序列 (列出前3步绝对具体、可衡量的动作)
   - ⚠️ 漏洞与定点风控预警 (指出本项中最容易使目标崩盘的2个隐患)
   - 💎 资源杠杆锚点 (在这个阶段，最应该优先把资金或精力倾注在什么地方)`;

    try {
      const response = await fetch('/api/plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt,
          settings: getSettings(),
          customApiKey: localStorage.getItem('custom_gemini_api_key') || undefined
        }),
        signal: controller.signal
      });

      if (!response.body) throw new Error('No readable stream from /api/plan');
      
      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let accumulatedText = '';
      let buffer = '';
      let lastUpdateTime = 0; // 引入节流阀时间戳
      
      while (true) {
        if (controller.signal.aborted) throw new Error('AbortError');
        const { done, value } = await reader.read();
        if (done) break;
        
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        
        let hasUpdates = false;

        for (const line of lines) {
          if (line.startsWith('data: ') && line !== 'data: [DONE]') {
            try {
              const parsed = JSON.parse(line.slice(6));
              if (parsed.error) throw new Error(parsed.error);
              if (parsed.text) {
                accumulatedText += parsed.text;
                hasUpdates = true;
              }
            } catch (e) {
              // Ignore partial JSON parsing errors
            }
          }
        }

        // 核心修复：节流渲染 (Throttling)
        const now = Date.now();
        if (hasUpdates && now - lastUpdateTime > 60) {
            let thinkMatch = accumulatedText.match(/<think>([\s\S]*?)(?:<\/think>|$)/);
            let currentThinkLine = t('dashboard.strategyBuildingMap');
            
            if (thinkMatch) {
                const thinkContent = thinkMatch[1].trim();
                const thinkLines = thinkContent.split('\n').filter(l => l.trim().length > 0);
                if (thinkLines.length > 0) {
                   let lastLine = thinkLines[thinkLines.length - 1].replace(/[*#`]/g, '').trim();
                   if (lastLine.length > 40) lastLine = lastLine.substring(0, 40) + '...';
                   currentThinkLine = lastLine;
                }
            }
            
            const resText = accumulatedText.replace(/<think>[\s\S]*?(?:<\/think>|$)/, '').trim();

            setNodePlans(prev => ({
              ...prev,
              [planKey]: { status: 'thinking', result: resText, thinking: currentThinkLine }
            }));
            
            lastUpdateTime = now; // 重置节流阀
        }
      }

      // 确保流结束后，进行最后一次完整的高精度数据托底渲染
      if (controller.signal.aborted) throw new Error('AbortError');
      const finalResText = accumulatedText.replace(/<think>[\s\S]*?(?:<\/think>|$)/, '').trim();
      setNodePlans(prev => ({
        ...prev,
        [planKey]: { status: 'done', result: finalResText, thinking: t('dashboard.strategyComplete') }
      }));

    } catch (e: any) {
      if (e.name === 'AbortError' || e.message === 'AbortError') {
          // If aborted deliberately, don't show error to UI
          return;
      }
      let errMsg = e.message;
      if (errMsg.includes('503') || errMsg.includes('high demand') || errMsg.includes('UNAVAILABLE')) {
         errMsg = t('chat.errors.overloaded');
      } else if (errMsg.includes('API key not valid') || errMsg.includes('API_KEY_INVALID')) {
         errMsg = t('chat.errors.invalidApiKey');
      } else if (errMsg.includes('exceeded your current quota') || errMsg.includes('rate limits') || errMsg.includes('Quota exceeded') || errMsg.includes('429') || errMsg.includes('RESOURCE_EXHAUSTED') || errMsg.includes('monthly spending cap')) {
         errMsg = t('chat.errors.quota');
      } else if (errMsg.includes('{')) {
          try {
              const parsed = JSON.parse(errMsg.substring(errMsg.indexOf('{')));
              if (parsed.error?.message) errMsg = parsed.error.message;
          } catch {}
      }
      setNodePlans(prev => ({
        ...prev,
        [planKey]: { status: 'done', result: `⚠️ ${t('dashboard.strategyErrorPrefix')}: ${errMsg}`, thinking: t('dashboard.strategyDisconnected') }
      }));
    } finally {
        controllersRef.current.delete(planKey);
    }
  }, [t]);

  const clearNodePlans = useCallback(() => {
    controllersRef.current.forEach(c => c.abort());
    controllersRef.current.clear();
    setNodePlans({});
  }, []);

  return { nodePlans, executePlan, clearNodePlans };
}
