import React, { useEffect } from 'react';
import { X, Calendar, Layers, Activity, ShieldAlert, BadgeInfo, CheckCircle, HelpCircle, Sparkles } from 'lucide-react';
import { useWealthStore } from '../hooks/useWealthStore';
import { PortfolioReviewSession, PositionDelta } from '../types/portfolio-review';

interface PortfolioReviewDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export function PortfolioReviewDrawer({ isOpen, onClose }: PortfolioReviewDrawerProps) {
  const portfolioReviewSessions = useWealthStore(state => state.portfolioReviewSessions);
  const activeSessionId = useWealthStore(state => state.activePortfolioReviewSessionId);
  const analyzePortfolioReviewSession = useWealthStore(state => state.analyzePortfolioReviewSession);
  const portfolioReviewMemory = useWealthStore(state => state.portfolioReviewMemory);
  const savePortfolioReviewMemoryFromSession = useWealthStore(state => state.savePortfolioReviewMemoryFromSession);
  const updatePortfolioReviewSession = useWealthStore(state => state.updatePortfolioReviewSession);

  // Find the currently active session
  const activeSession = portfolioReviewSessions.find(s => s.id === activeSessionId);

  const [activeTab, setActiveTab] = React.useState<'snapshot' | 'report'>('snapshot');

  const [riskPreference, setRiskPreference] = React.useState<'保守' | '中性' | '激进' | '高波动可接受' | ''>('');
  const [maxDrawdownTolerance, setMaxDrawdownTolerance] = React.useState<string>('');
  const [allowMargin, setAllowMargin] = React.useState<'是' | '否' | ''>('');
  const [allowOptions, setAllowOptions] = React.useState<'是' | '否' | ''>('');
  const [allowCrypto, setAllowCrypto] = React.useState<'是' | '否' | ''>('');

  // Update helper
  const updateParamsAndPersist = (updates: {
    riskPreference?: '保守' | '中性' | '激进' | '高波动可接受' | '';
    maxDrawdownTolerance?: string;
    allowMargin?: '是' | '否' | '';
    allowOptions?: '是' | '否' | '';
    allowCrypto?: '是' | '否' | '';
  }) => {
    if (!activeSession) return;
    const nextParams = {
      ...(activeSession.reviewParams || {}),
      ...updates
    };

    updatePortfolioReviewSession(activeSession.id, { reviewParams: nextParams });

    if (updates.riskPreference !== undefined) {
      setRiskPreference(updates.riskPreference);
    }
    if (updates.maxDrawdownTolerance !== undefined) {
      setMaxDrawdownTolerance(updates.maxDrawdownTolerance);
    }
    if (updates.allowMargin !== undefined) {
      setAllowMargin(updates.allowMargin);
    }
    if (updates.allowOptions !== undefined) {
      setAllowOptions(updates.allowOptions);
    }
    if (updates.allowCrypto !== undefined) {
      setAllowCrypto(updates.allowCrypto);
    }
  };

  useEffect(() => {
    if (activeSession) {
      setRiskPreference(activeSession.reviewParams?.riskPreference || '');
      setMaxDrawdownTolerance(activeSession.reviewParams?.maxDrawdownTolerance || '');
      setAllowMargin(activeSession.reviewParams?.allowMargin || '');
      setAllowOptions(activeSession.reviewParams?.allowOptions || '');
      setAllowCrypto(activeSession.reviewParams?.allowCrypto || '');
    }
  }, [activeSessionId]);

  // Automatically switch tab when report lands or session has report
  useEffect(() => {
    if (activeSession?.report) {
      setActiveTab('report');
    } else {
      setActiveTab('snapshot');
    }
  }, [activeSessionId, activeSession?.report]);

  // Handle closing drawer with Escape key
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape' && isOpen) {
        onClose();
      }
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const formatDate = (timestamp: number) => {
    try {
      return new Date(timestamp).toLocaleString('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      });
    } catch {
      return '未知时间';
    }
  };

  const currentSnapshot = activeSession?.currentSnapshot;
  const previousSnapshot = activeSession?.previousSnapshot;
  const deltas = activeSession?.deltas || [];

  const getActionTypeBadge = (actionType: PositionDelta['actionType']) => {
    switch (actionType) {
      case 'new_position':
        return (
          <span className="px-2 py-0.5 rounded text-[10px] uppercase font-semibold font-mono tracking-wide bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            新建仓 / New
          </span>
        );
      case 'increase':
        return (
          <span className="px-2 py-0.5 rounded text-[10px] uppercase font-semibold font-mono tracking-wide bg-blue-500/10 text-blue-400 border border-blue-500/20">
            加仓 / Buy
          </span>
        );
      case 'reduce':
        return (
          <span className="px-2 py-0.5 rounded text-[10px] uppercase font-semibold font-mono tracking-wide bg-amber-500/10 text-amber-400 border border-amber-500/20">
            减仓 / Sell
          </span>
        );
      case 'exit':
        return (
          <span className="px-2 py-0.5 rounded text-[10px] uppercase font-semibold font-mono tracking-wide bg-rose-500/10 text-rose-400 border border-rose-500/20">
            清仓 / Exit
          </span>
        );
      case 'unchanged':
        return (
          <span className="px-2 py-0.5 rounded text-[10px] uppercase font-semibold font-mono tracking-wide bg-[#8C8370]/10 text-[#8C8370] border border-[#8C8370]/20">
            无变化 / Hold
          </span>
        );
      default:
        return (
          <span className="px-2 py-0.5 rounded text-[10px] uppercase font-semibold font-mono tracking-wide bg-zinc-500/10 text-zinc-400 border border-zinc-500/20">
            未知 / Unknown
          </span>
        );
    }
  };

  const getConfidenceBadge = (confidence: 'high' | 'medium' | 'low') => {
    switch (confidence) {
      case 'high':
        return (
          <span className="inline-flex items-center gap-1 text-[10px] font-mono px-1.5 py-0.5 rounded bg-emerald-500/5 border border-emerald-500/15 text-emerald-400">
            <CheckCircle className="w-3 h-3 text-emerald-500/70" />
            HIGH CONFIDENCE
          </span>
        );
      case 'medium':
        return (
          <span className="inline-flex items-center gap-1 text-[10px] font-mono px-1.5 py-0.5 rounded bg-amber-500/5 border border-amber-500/15 text-amber-400">
            <BadgeInfo className="w-3 h-3 text-amber-500/70" />
            MEDIUM CONFIDENCE
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 text-[10px] font-mono px-1.5 py-0.5 rounded bg-rose-500/5 border border-rose-500/15 text-rose-400">
            <ShieldAlert className="w-3 h-3 text-rose-500/70" />
            LOW CONFIDENCE
          </span>
        );
    }
  };

  return (
    <>
      {/* Backdrop overlay */}
      <div 
        className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm transition-opacity" 
        onClick={onClose}
      />
      
      {/* Slide-out Panel container */}
      <div 
        className="fixed inset-y-0 right-0 z-50 w-full max-w-4xl bg-[#0B0F19] border-l border-[#C9B284]/15 shadow-2xl flex flex-col overflow-hidden text-sans transition-all duration-300"
      >
        {/* Header toolbar */}
        <div className="px-6 py-5 border-b border-[#C9B284]/10 bg-[#0E1115] flex items-center justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-white tracking-wide">
                本轮持仓复盘 / Portfolio Review
              </h2>
              {currentSnapshot && getConfidenceBadge(currentSnapshot.dataConfidence)}
            </div>
            <p className="text-[#8C8370] text-xs font-mono">
              SESSION ID: {activeSession?.id || 'N/A'}
            </p>
          </div>
          <button 
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center border border-[#C9B284]/10 text-[#8C8370] hover:text-[#E7D7B0] hover:bg-[#C9B284]/5 transition-all duration-200 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Core details workspace body */}
        <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
          {!activeSession ? (
            <div className="py-20 flex flex-col items-center justify-center text-center space-y-3">
              <HelpCircle className="w-12 h-12 text-[#C9B284]/20 animate-pulse" />
              <div className="text-[#E7D7B0]/60 text-sm font-medium">
                无法加载当前持仓复盘会话
              </div>
              <p className="text-[#8C8370] text-xs max-w-xs leading-relaxed">
                数据快照缺失，或底层会话对象不完整，请重新点击“生成本轮持仓复盘”重试。
              </p>
            </div>
          ) : (
            <>
              {/* 截图导入持仓备用入口 / Screenshot Upload Fallback (Placeholder) */}
              <div className="bg-[#10141D]/40 border border-[#C9B284]/5 rounded-xl p-3 flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] bg-[#C9B284]/15 text-[#C9B284] px-1.5 py-0.5 rounded font-mono tracking-wider font-semibold">
                      截图导入 / OCR IMPORT
                    </span>
                    <span className="text-[9px] text-[#8C8370] font-mono">COMING SOON</span>
                  </div>
                  <p className="text-[11px] text-[#8C8370] leading-relaxed">
                    当前复盘优先使用已同步的券商 API 多账户数据。截图导入将作为 API 不可用时的备用方式。
                  </p>
                </div>
                <button
                  disabled
                  className="w-full md:w-auto px-3 py-1.5 bg-zinc-800/10 border border-zinc-700/20 text-zinc-500 rounded text-[10.5px] font-mono whitespace-nowrap cursor-not-allowed"
                >
                  截图导入持仓（即将支持）
                </button>
              </div>

              {/* Snapshot brief dashboard cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-[#10141D] border border-[#C9B284]/10 rounded-xl p-4 flex flex-col">
                  <span className="text-[10px] text-[#8C8370] font-mono tracking-wider uppercase mb-1">
                    总估值 / Total MV
                  </span>
                  <span className="text-base md:text-lg font-mono font-bold text-[#C9B284]">
                    ${currentSnapshot?.totalMarketValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0.00'}
                  </span>
                </div>
                <div className="bg-[#10141D] border border-[#C9B284]/10 rounded-xl p-4 flex flex-col">
                  <span className="text-[10px] text-[#8C8370] font-mono tracking-wider uppercase mb-1">
                    关联账户数 / Accounts
                  </span>
                  <span className="text-base md:text-lg font-mono font-bold text-white">
                    {currentSnapshot?.accountCount || 0} <span className="text-[11px] text-[#8C8370] font-light">个</span>
                  </span>
                </div>
                <div className="bg-[#10141D] border border-[#C9B284]/10 rounded-xl p-4 flex flex-col">
                  <span className="text-[10px] text-[#8C8370] font-mono tracking-wider uppercase mb-1">
                    总持仓标的 / Positions
                  </span>
                  <span className="text-base md:text-lg font-mono font-bold text-white">
                    {currentSnapshot?.positionCount || 0} <span className="text-[11px] text-[#8C8370] font-light">席</span>
                  </span>
                </div>
                <div className="bg-[#10141D] border border-[#C9B284]/10 rounded-xl p-4 flex flex-col">
                  <span className="text-[10px] text-[#8C8370] font-mono tracking-wider uppercase mb-1">
                    核心数据源 / Source
                  </span>
                  <span className="text-base md:text-lg font-mono font-bold text-[#E7D7B0] uppercase tracking-wide">
                    {currentSnapshot?.source === 'longbridge' ? '长桥实盘' : '手动汇总'}
                  </span>
                </div>
              </div>

              {/* 本轮复盘参数 / Strategic Parameters Form */}
              <div className="bg-[#10141D] border border-[#C9B284]/15 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between border-b border-[#C9B284]/10 pb-2">
                  <h4 className="text-xs font-bold text-[#E7D7B0] uppercase tracking-widest font-mono flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-[#C9B284]" />
                    本轮复盘参数 / Strategic Parameters
                  </h4>
                  <span className="text-[10px] text-[#8C8370] font-mono">（选填）将作为本次 AI 精准诊断依据</span>
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3">
                  {/* riskPreference */}
                  <div className="space-y-1">
                    <label className="text-[10px] text-[#8C8370] font-mono uppercase tracking-wider block">风险偏好 / Risk</label>
                    <select
                      value={riskPreference}
                      onChange={(e) => updateParamsAndPersist({ riskPreference: e.target.value as any })}
                      className="w-full bg-[#121419] border border-[#1A1D20] text-[#E7D7B0] text-xs rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-[#C9B284]/50 transition-colors font-sans cursor-pointer"
                    >
                      <option value="">未填写</option>
                      <option value="保守">保守 / Conservative</option>
                      <option value="中性">中性 / Moderate</option>
                      <option value="激进">激进 / Aggressive</option>
                      <option value="高波动可接受">高波动可接受</option>
                    </select>
                  </div>

                  {/* maxDrawdownTolerance */}
                  <div className="space-y-1">
                    <label className="text-[10px] text-[#8C8370] font-mono uppercase tracking-wider block">最大回撤 / Drawdown</label>
                    <div className="relative">
                      <input
                        type="text"
                        value={maxDrawdownTolerance}
                        onChange={(e) => updateParamsAndPersist({ maxDrawdownTolerance: e.target.value })}
                        placeholder="自定义 e.g. 10%"
                        className="w-full bg-[#121419] border border-[#1A1D20] text-[#E7D7B0] text-xs rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-[#C9B284]/50 transition-colors font-mono"
                        list="drawdown-options"
                      />
                      <datalist id="drawdown-options">
                        <option value="5%" />
                        <option value="10%" />
                        <option value="20%" />
                      </datalist>
                    </div>
                  </div>

                  {/* allowMargin */}
                  <div className="space-y-1">
                    <label className="text-[10px] text-[#8C8370] font-mono uppercase tracking-wider block">是否融资 / Margin</label>
                    <select
                      value={allowMargin}
                      onChange={(e) => updateParamsAndPersist({ allowMargin: e.target.value as any })}
                      className="w-full bg-[#121419] border border-[#1A1D20] text-[#E7D7B0] text-xs rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-[#C9B284]/50 transition-colors font-sans cursor-pointer"
                    >
                      <option value="">未选择</option>
                      <option value="是">是 / Yes</option>
                      <option value="否">否 / No</option>
                    </select>
                  </div>

                  {/* allowOptions */}
                  <div className="space-y-1">
                    <label className="text-[10px] text-[#8C8370] font-mono uppercase tracking-wider block">是否期权 / Options</label>
                    <select
                      value={allowOptions}
                      onChange={(e) => updateParamsAndPersist({ allowOptions: e.target.value as any })}
                      className="w-full bg-[#121419] border border-[#1A1D20] text-[#E7D7B0] text-xs rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-[#C9B284]/50 transition-colors font-sans cursor-pointer"
                    >
                      <option value="">未选择</option>
                      <option value="是">是 / Yes</option>
                      <option value="否">否 / No</option>
                    </select>
                  </div>

                  {/* allowCrypto */}
                  <div className="space-y-1">
                    <label className="text-[10px] text-[#8C8370] font-mono uppercase tracking-wider block">是否加密 / Crypto</label>
                    <select
                      value={allowCrypto}
                      onChange={(e) => updateParamsAndPersist({ allowCrypto: e.target.value as any })}
                      className="w-full bg-[#121419] border border-[#1A1D20] text-[#E7D7B0] text-xs rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-[#C9B284]/50 transition-colors font-sans cursor-pointer"
                    >
                      <option value="">未选择</option>
                      <option value="是">是 / Yes</option>
                      <option value="否">否 / No</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Error Warning Box */}
              {activeSession.error && (
                <div className="border border-rose-950/40 bg-rose-950/10 rounded-xl p-4 space-y-1.5 animate-in fade-in slide-in-from-top-1 duration-200">
                  <h4 className="text-[11px] font-mono font-bold text-rose-400 uppercase tracking-widest flex items-center gap-1.5">
                    <ShieldAlert className="w-4 h-4 shrink-0" />
                    AI 报告生成失败 / Error Generating Report
                  </h4>
                  <p className="text-xs text-rose-300 font-light leading-relaxed">
                    {activeSession.error}
                  </p>
                </div>
              )}

              {/* Tabs Switcher for Snapshot vs AI Report */}
              {activeSession.report && (
                <div className="flex border-b border-[#C9B284]/15 mt-2">
                  <button
                    onClick={() => setActiveTab('snapshot')}
                    className={`px-5 py-2.5 text-xs font-mono font-bold tracking-widest relative cursor-pointer ${
                      activeTab === 'snapshot' ? 'text-[#C9B284]' : 'text-[#8C8370] hover:text-white'
                    }`}
                  >
                    <span>01. 快照核对 / Snapshot Auditing</span>
                    {activeTab === 'snapshot' && (
                      <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#C9B284]" />
                    )}
                  </button>
                  <button
                    onClick={() => setActiveTab('report')}
                    className={`px-5 py-2.5 text-xs font-mono font-bold tracking-widest relative cursor-pointer flex items-center gap-1.5 ${
                      activeTab === 'report' ? 'text-[#C9B284]' : 'text-[#8C8370] hover:text-white'
                    }`}
                  >
                    <Sparkles className="w-3 h-3 text-[#C9B284]" />
                    <span>02. 深度复盘报告 / AI Strategic Review</span>
                    {activeTab === 'report' && (
                      <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#C9B284]" />
                    )}
                  </button>
                </div>
              )}

              {/* Main Content Area based on Status & Tab state */}
              {activeSession.status === 'analyzing' ? (
                <div className="py-24 flex flex-col items-center justify-center text-center space-y-4">
                  <div className="relative flex items-center justify-center">
                    <div className="w-14 h-14 rounded-full border-2 border-[#C9B284]/10 border-t-[#C9B284] animate-spin" />
                    <Sparkles className="absolute w-5 h-5 text-[#C9B284] animate-pulse" />
                  </div>
                  <div className="text-[#C9B284] text-xs font-semibold font-mono tracking-wider uppercase hover:animate-pulse">
                    正在分析多账户实盘异动并构建诊断报告...
                  </div>
                  <div className="text-[#8C8370] text-[11px] max-w-sm font-light leading-relaxed">
                    我们正在安全整合您的实盘持仓组合，分析底层标的之行业集中特征、风险变动与对冲效能。模型正在生成符合真实性公约的专业级评估。
                  </div>
                </div>
              ) : activeTab === 'report' && activeSession.report ? (
                <div className="space-y-6">
                  {/* Summary Block */}
                  <div className="bg-[#10141D] border border-[#C9B284]/15 rounded-xl p-5 space-y-3">
                    <div className="flex items-center gap-2 border-b border-[#C9B284]/10 pb-2.5">
                      <Sparkles className="w-4 h-4 text-[#C9B284]" />
                      <h3 className="text-xs font-bold text-[#E7D7B0] tracking-wide uppercase font-mono">
                        AI 深度财务诊断结论 / Executive Summary
                      </h3>
                    </div>
                    <p className="text-white text-xs leading-relaxed font-light whitespace-pre-wrap">
                      {activeSession.report.summary}
                    </p>

                    {/* Review Memory Save Widget */}
                    <div className="border-t border-[#C9B284]/10 pt-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="space-y-0.5 max-w-sm sm:max-w-md">
                        <span className="text-[9px] text-[#C9B284] font-mono uppercase tracking-widest block font-bold">
                          🧠 复盘策略记忆库 / REVIEW MEMORY CORE
                        </span>
                        <p className="text-[10px] text-[#8C8370] font-light leading-relaxed">
                          将避开警告与追踪要点存入工作记忆。下次复盘、行情或AI巡检将深度匹配这些核心防御策略。
                        </p>
                      </div>

                      <div className="shrink-0">
                        {portfolioReviewMemory?.lastReviewId === activeSession.id ? (
                          <div className="flex items-center gap-1.5 bg-[#C9B284]/5 px-2.5 py-1.5 rounded border border-[#C9B284]/20 animate-in fade-in duration-200">
                            <CheckCircle className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                            <span className="text-[10px] text-zinc-300 font-light leading-none">
                              已保存为复盘记忆，下次复盘会引用这些行动项与风险提醒。
                            </span>
                          </div>
                        ) : (
                          <button
                            onClick={() => savePortfolioReviewMemoryFromSession(activeSession.id, riskPreference)}
                            className="px-3 py-1.5 bg-[#C9B284]/10 hover:bg-[#C9B284]/15 border border-[#C9B284]/35 text-[#C9B284] hover:text-white text-[10.5px] font-mono tracking-wider font-semibold uppercase rounded transition-all cursor-pointer flex items-center gap-1.5"
                          >
                            <Sparkles className="w-3 h-3 text-[#C9B284]" />
                            <span>保存为复盘记忆</span>
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Portfolio Qualitative Diagnosis Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Character & Avoid Actions */}
                    <div className="bg-[#10141D] border border-[#C9B284]/10 rounded-xl p-5 space-y-4">
                      <div>
                        <span className="text-[10px] text-[#8C8370] font-mono uppercase tracking-wider block mb-1">
                          资产配置特色类型 / Portfolio Type
                        </span>
                        <span className="text-xs font-bold text-[#C9B284] font-mono tracking-wide bg-[#C9B284]/5 px-2.5 py-1 rounded border border-[#C9B284]/20 inline-block">
                          {activeSession.report.portfolioDiagnosis.portfolioType}
                        </span>
                      </div>

                      <div className="space-y-2">
                        <span className="text-[10px] text-rose-400/90 font-mono uppercase tracking-widest block font-bold">
                          🛑 避开警告：当前最不该做的 3 件事 / CRITICAL AVOIDS
                        </span>
                        <ul className="text-xs text-rose-300 font-light space-y-2 leading-relaxed">
                          {activeSession.report.portfolioDiagnosis.avoidActions.map((act, index) => (
                            <li key={index} className="flex items-start gap-2 bg-rose-500/5 px-3 py-2 rounded-lg border border-rose-500/10">
                              <span className="text-rose-400 font-mono text-[9px] bg-rose-500/10 w-4 h-4 rounded-full flex items-center justify-center shrink-0 mt-0.5">{index + 1}</span>
                              <span>{act}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>

                    {/* Risks & Opportunities list */}
                    <div className="bg-[#10141D] border border-[#C9B284]/10 rounded-xl p-5 space-y-4">
                      <div className="space-y-2">
                        <span className="text-[10px] text-amber-400/90 font-mono uppercase tracking-widest block font-bold">
                          ⚠️ 尾部头寸及黑天鹅风险 / Key Risk Drivers
                        </span>
                        <ul className="text-xs text-zinc-300 font-light space-y-2 leading-relaxed">
                          {activeSession.report.portfolioDiagnosis.topRisks.map((risk, index) => (
                            <li key={index} className="flex items-start gap-1.5 font-sans">
                              <span className="text-amber-500 shrink-0 mt-0.5 font-bold">•</span>
                              <span>{risk}</span>
                            </li>
                          ))}
                        </ul>
                      </div>

                      <div className="space-y-2 border-t border-[#C9B284]/5 pt-3">
                        <span className="text-[10px] text-emerald-400/90 font-mono uppercase tracking-widest block font-bold">
                          💎 回报/对冲等结构性机会 / Strategic Opportunities
                        </span>
                        <ul className="text-xs text-zinc-300 font-light space-y-2 leading-relaxed">
                          {activeSession.report.portfolioDiagnosis.topOpportunities.map((opp, index) => (
                            <li key={index} className="flex items-start gap-1.5">
                              <span className="text-emerald-500 shrink-0 mt-0.5 font-bold">•</span>
                              <span>{opp}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </div>

                  {/* Position Reviews Table */}
                  <div className="space-y-3">
                    <h3 className="text-xs font-bold text-[#E7D7B0] uppercase tracking-widest font-mono flex items-center gap-2">
                      <Activity className="w-4 h-4 text-[#C9B284]" />
                      底层各标的个股复盘与评级 / Single Asset Evaluation
                    </h3>

                    <div className="border border-[#C9B284]/10 rounded-xl overflow-hidden bg-[#10141D]">
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs border-collapse min-w-[800px]">
                          <thead>
                            <tr className="bg-black/30 border-b border-[#C9B284]/10 text-[#8C8370] font-mono text-[10px] uppercase tracking-wider">
                              <th className="px-4 py-3 font-medium">个股标的 / Asset</th>
                              <th className="px-4 py-3 font-medium">配置定位 / Role</th>
                              <th className="px-4 py-3 font-medium">评级操作 / Action</th>
                              <th className="px-4 py-3 font-medium">星级强度</th>
                              <th className="px-4 py-3 font-medium">规划周期 / Horizon</th>
                              <th className="px-4 py-3 font-medium">评测依据 / Basis</th>
                              <th className="px-4 py-3 font-medium text-right">操作 / Context</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-[#C9B284]/5 font-light text-white">
                            {activeSession.report.positionReviews.length === 0 ? (
                              <tr>
                                <td colSpan={7} className="px-4 py-8 text-center text-[#8C8370]">
                                  没有检测到包含在会话中的单票评估。
                                </td>
                              </tr>
                            ) : (
                              activeSession.report.positionReviews.map((pos, idx) => {
                                const holding = currentSnapshot?.flattenedHoldings?.find(h => {
                                  const matchesSymbol = h.symbol?.toUpperCase() === pos.symbol?.toUpperCase();
                                  if (!matchesSymbol) return false;
                                  if (pos.accountName) {
                                    return h.accountName === pos.accountName;
                                  }
                                  return true;
                                }) || currentSnapshot?.flattenedHoldings?.find(h => h.symbol?.toUpperCase() === pos.symbol?.toUpperCase());

                                const isClickable = !!holding;

                                return (
                                  <React.Fragment key={idx}>
                                    <tr 
                                      onClick={() => {
                                        if (holding) {
                                          useWealthStore.getState().setSelectedHolding(holding);
                                        }
                                      }}
                                      className={`group transition-all border-l-2 ${
                                        isClickable 
                                          ? 'cursor-pointer hover:bg-[#C9B284]/5 hover:border-l-[#C9B284] border-l-transparent' 
                                          : 'opacity-70 border-l-transparent'
                                      }`}
                                      title={isClickable ? '点击打开该持仓深度诊断与量化分析' : '未在当前快照中匹配到对应持仓（或多账户数据中无此标的）'}
                                    >
                                      <td className="px-4 py-3 font-mono font-semibold">
                                        <div className="flex flex-col">
                                          <span className="text-white text-xs">{pos.symbol}</span>
                                          {pos.name && pos.name !== pos.symbol && (
                                            <span className="text-[10px] text-[#8C8370] font-sans truncate max-w-[120px]">{pos.name}</span>
                                          )}
                                          {pos.accountName && (
                                            <span className="text-[9px] tracking-wide text-zinc-500 font-mono">({pos.accountName})</span>
                                          )}
                                        </div>
                                      </td>
                                      <td className="px-4 py-3 text-[#E7D7B0] font-medium text-xs">
                                        {pos.currentRole}
                                      </td>
                                      <td className="px-4 py-3">
                                        <span className={`px-2 py-0.5 rounded text-[10px] border font-medium ${
                                          ['增持', '继续持有'].includes(pos.recommendation)
                                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                                            : ['观察等待'].includes(pos.recommendation)
                                              ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                                              : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                                        }`}>
                                          {pos.recommendation}
                                        </span>
                                      </td>
                                      <td className="px-4 py-3 font-medium">
                                        <span className={`text-[10px] font-mono ${pos.recommendationStrength === '强' ? 'text-[#C9B284] font-bold' : 'text-[#8C8370]'}`}>
                                          {pos.recommendationStrength}
                                        </span>
                                      </td>
                                      <td className="px-4 py-3 text-xs font-mono">
                                        {pos.horizon}
                                      </td>
                                      <td className="px-4 py-3 text-[11px] text-[#E7D7B0] max-w-[220px] truncate" title={pos.actionEvaluation}>
                                        {pos.actionEvaluation}
                                      </td>
                                      <td className="px-4 py-3 text-right">
                                        {isClickable ? (
                                          <span className="text-[10px] font-mono text-[#C9B284] opacity-60 group-hover:opacity-100 group-hover:underline transition-all whitespace-nowrap">
                                            查看单票分析 →
                                          </span>
                                        ) : (
                                          <span className="text-[10px] font-mono text-zinc-600 whitespace-nowrap" title="当前持仓不包含此单票数据（多账户中可能未导入或无该个股）">
                                            未找到当前持仓
                                          </span>
                                        )}
                                      </td>
                                    </tr>
                                    {/* Deep details subrow */}
                                    <tr className="bg-black/15">
                                      <td colSpan={7} className="px-4 py-2 border-b border-[#C9B284]/5 font-sans leading-relaxed text-[11px] text-[#8C8370]">
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-1.5">
                                          <div>
                                            <strong className="font-mono text-emerald-400/90 font-medium mr-1.5">🎯 推荐触发条件 [TriggerConditions]：</strong>
                                            <div className="inline-block">{pos.triggerConditions.join(' / ') || '暂无特定市场信号'}</div>
                                          </div>
                                          <div>
                                            <strong className="font-mono text-rose-400/90 font-medium mr-1.5">⚠️ 中止/失效边界 [InvalidationConditions]：</strong>
                                            <div className="inline-block">{pos.invalidationConditions.join(' / ') || '未设置特定失效阀值'}</div>
                                          </div>
                                        </div>
                                        {pos.risks && pos.risks.length > 0 && (
                                          <div className="mt-1 border-t border-[#C9B284]/5 pt-1.5 flex items-start gap-1">
                                            <strong className="font-mono text-amber-400/80 font-medium mr-1.5 shrink-0">💣 单票最大合规/尾部风险 [Risks]：</strong>
                                            <span>{pos.risks.join(' | ')}</span>
                                          </div>
                                        )}
                                      </td>
                                    </tr>
                                  </React.Fragment>
                                );
                              })
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>

                  {/* Strategy Steps Plan */}
                  <div className="space-y-3">
                    <h3 className="text-xs font-bold text-[#E7D7B0] uppercase tracking-widest font-mono flex items-center gap-2">
                      <Layers className="w-4 h-4 text-[#C9B284]" />
                      实盘战术蓝图及启动点 / Action Plan Blueprints
                    </h3>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {/* Short Term */}
                      <div className="bg-[#10141D] border border-emerald-500/10 rounded-xl p-4 space-y-3 flex flex-col justify-between">
                        <div className="space-y-3">
                          <div className="flex items-center justify-between border-b border-[#C9B284]/15 pb-2">
                            <span className="text-[10px] font-bold font-mono tracking-widest text-emerald-400 uppercase">
                              ⚔️ 战术紧急防御 / SHORT-TERM
                            </span>
                            <span className="text-[9px] text-[#8C8370] font-mono">0-2 WEEKS</span>
                          </div>
                          <div className="space-y-3.5">
                            {activeSession.report.actionPlan.shortTerm.length === 0 ? (
                              <p className="text-zinc-500 text-xs italic">无短期战术安排</p>
                            ) : (
                              activeSession.report.actionPlan.shortTerm.map((act, idx) => (
                                <div key={idx} className="space-y-1">
                                  <div className="flex items-center justify-between">
                                    <span className="text-white text-xs font-bold">{act.title}</span>
                                    <span className={`text-[8px] font-mono px-1 rounded uppercase ${act.priority === 'high' ? 'bg-rose-500/15 text-rose-400' : 'bg-zinc-500/10 text-[#8C8370]'}`}>{act.priority}</span>
                                  </div>
                                  <p className="text-[11px] text-[#8C8370] leading-relaxed">{act.rationale}</p>
                                  {act.triggerCondition && (
                                    <div className="text-[9.5px] text-[#C9B284]/90 bg-[#C9B284]/5 px-2 py-1 rounded font-mono border border-[#C9B284]/10 mt-1">
                                      触发条件: {act.triggerCondition}
                                    </div>
                                  )}
                                </div>
                              ))
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Mid Term */}
                      <div className="bg-[#10141D] border border-[#C9B284]/10 rounded-xl p-4 space-y-3 flex flex-col justify-between">
                        <div className="space-y-3">
                          <div className="flex items-center justify-between border-b border-[#C9B284]/15 pb-2">
                            <span className="text-[10px] font-bold font-mono tracking-widest text-[#E7D7B0] uppercase">
                              ⛵ 仓位中周期调节 / MID-TERM
                            </span>
                            <span className="text-[9px] text-[#8C8370] font-mono">2W-3 MONTHS</span>
                          </div>
                          <div className="space-y-3.5">
                            {activeSession.report.actionPlan.midTerm.length === 0 ? (
                              <p className="text-zinc-500 text-xs italic">无中周期调节安排</p>
                            ) : (
                              activeSession.report.actionPlan.midTerm.map((act, idx) => (
                                <div key={idx} className="space-y-1">
                                  <div className="flex items-center justify-between">
                                    <span className="text-white text-xs font-bold">{act.title}</span>
                                    <span className={`text-[8px] font-mono px-1 rounded uppercase ${act.priority === 'high' ? 'bg-rose-500/15 text-rose-400' : 'bg-zinc-500/10 text-[#8C8370]'}`}>{act.priority}</span>
                                  </div>
                                  <p className="text-[11px] text-[#8C8370] leading-relaxed">{act.rationale}</p>
                                  {act.triggerCondition && (
                                    <div className="text-[9.5px] text-[#C9B284]/90 bg-[#C9B284]/5 px-2 py-1 rounded font-mono border border-[#C9B284]/10 mt-1">
                                      触发条件: {act.triggerCondition}
                                    </div>
                                  )}
                                </div>
                              ))
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Long Term */}
                      <div className="bg-[#10141D] border border-blue-500/10 rounded-xl p-4 space-y-3 flex flex-col justify-between">
                        <div className="space-y-3">
                          <div className="flex items-center justify-between border-b border-[#C9B284]/15 pb-2">
                            <span className="text-[10px] font-bold font-mono tracking-widest text-blue-400 uppercase">
                              🌳 跨周期结构重构 / LONG-TERM
                            </span>
                            <span className="text-[9px] text-[#8C8370] font-mono">3+ MONTHS</span>
                          </div>
                          <div className="space-y-3.5">
                            {activeSession.report.actionPlan.longTerm.length === 0 ? (
                              <p className="text-zinc-500 text-xs italic">无战略性长期安排</p>
                            ) : (
                              activeSession.report.actionPlan.longTerm.map((act, idx) => (
                                <div key={idx} className="space-y-1">
                                  <div className="flex items-center justify-between">
                                    <span className="text-white text-xs font-bold">{act.title}</span>
                                    <span className={`text-[8px] font-mono px-1 rounded uppercase ${act.priority === 'high' ? 'bg-rose-500/15 text-rose-400' : 'bg-zinc-500/10 text-[#8C8370]'}`}>{act.priority}</span>
                                  </div>
                                  <p className="text-[11px] text-[#8C8370] leading-relaxed">{act.rationale}</p>
                                  {act.triggerCondition && (
                                    <div className="text-[9.5px] text-[#C9B284]/90 bg-[#C9B284]/5 px-2 py-1 rounded font-mono border border-[#C9B284]/10 mt-1">
                                      触发条件: {act.triggerCondition}
                                    </div>
                                  )}
                                </div>
                              ))
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Future reviewing needs */}
                  {activeSession.report.nextReviewNeeds && activeSession.report.nextReviewNeeds.length > 0 && (
                    <div className="border border-[#C9B284]/15 bg-[#10141D] rounded-xl p-4 space-y-2">
                      <h4 className="text-[11.5px] font-mono font-bold text-[#C9B284] uppercase tracking-wider flex items-center gap-1.5">
                        <BadgeInfo className="w-4 h-4 shrink-0 text-[#C9B284]/80" />
                        下次深度对冲审查需预备的数据监控点 / Under Surveillance
                      </h4>
                      <ul className="text-[11px] text-[#8C8370] space-y-1.5 font-light leading-relaxed">
                        {activeSession.report.nextReviewNeeds.map((need, idx) => (
                          <li key={idx} className="flex items-start gap-1.5">
                            <span className="text-[#C9B284]/60 font-bold">•</span>
                            <span>{need}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              ) : (
                <>
                  {/* Warnings and notices block */}
                  {currentSnapshot && currentSnapshot.warnings && currentSnapshot.warnings.length > 0 && (
                    <div className="border border-amber-950/40 bg-amber-950/10 rounded-xl p-4 space-y-2">
                      <h4 className="text-[11px] font-mono font-bold text-amber-400/90 uppercase tracking-widest flex items-center gap-1.5">
                        <ShieldAlert className="w-4 h-4 shrink-0" />
                        数据源检查警告 / Warnings
                      </h4>
                      <ul className="text-[11px] text-[#8C8370] space-y-1 font-light leading-relaxed">
                        {currentSnapshot.warnings.map((w, idx) => (
                          <li key={idx} className="flex items-start gap-1">
                            <span className="text-amber-500/70 select-none">•</span>
                            <span>{w}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Time reference banner */}
                  <div className="bg-[#10141D] border border-[#C9B284]/10 rounded-xl px-4 py-3 flex flex-wrap items-center justify-between gap-3 text-xs">
                    <div className="flex items-center gap-2 text-[#8C8370]">
                      <Calendar className="w-4 h-4 text-[#C9B284]/50" />
                      <span>本次复盘同步周期</span>
                    </div>
                    <div className="flex items-center gap-2 text-white font-mono">
                      {previousSnapshot ? (
                        <>
                          <span className="text-[#8C8370]">{formatDate(previousSnapshot.createdAt)}</span>
                          <span className="text-[#C9B284]/50">➔</span>
                          <span>{formatDate(currentSnapshot?.createdAt || Date.now())}</span>
                        </>
                      ) : (
                        <span>首次复盘快照于 {formatDate(currentSnapshot?.createdAt || Date.now())}</span>
                      )}
                    </div>
                  </div>

                  {/* Deltas detailed audit logging list (Previous vs Current) */}
                  <div className="space-y-3">
                    <h3 className="text-xs font-bold text-[#E7D7B0] uppercase tracking-widest font-mono flex items-center gap-2">
                      <Activity className="w-4 h-4 text-[#C9B284]" />
                      持仓异动比对表 / Portfolio Transaction Deltas
                    </h3>

                    <div className="border border-[#C9B284]/10 rounded-xl overflow-hidden bg-[#10141D]">
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs border-collapse min-w-[700px]">
                          <thead>
                            <tr className="bg-black/30 border-b border-[#C9B284]/10 text-[#8C8370] font-mono text-[10px] uppercase tracking-wider">
                              <th className="px-4 py-3 font-medium">关联账户 / Account</th>
                              <th className="px-4 py-3 font-medium">资产代码 / Asset</th>
                              <th className="px-4 py-3 font-medium">异动动作 / Step</th>
                              <th className="px-4 py-3 font-medium text-right">上次持仓</th>
                              <th className="px-4 py-3 font-medium text-right">本次持仓</th>
                              <th className="px-4 py-3 font-medium text-right">数量变化</th>
                              <th className="px-4 py-3 font-medium text-right">上次市值</th>
                              <th className="px-4 py-3 font-medium text-right">本次市值</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-[#C9B284]/5 font-light text-white">
                            {deltas.length === 0 ? (
                              <tr>
                                <td colSpan={8} className="px-4 py-8 text-center text-[#8C8370]">
                                  未检测到任何持仓数据变动。由于这是首次生成快照，下一次持仓更新时将对冲对比并计算具体买入与卖出动作。
                                </td>
                              </tr>
                            ) : (
                              deltas.map((delta, index) => (
                                <React.Fragment key={index}>
                                  <tr className="hover:bg-[#161B26]/40 transition-colors">
                                    <td className="px-4 py-3 truncate max-w-[150px] font-medium text-[#8C8370]">
                                      {delta.accountName || delta.accountId || '默认账户'}
                                    </td>
                                    <td className="px-4 py-3 font-mono font-semibold">
                                      <div className="flex flex-col">
                                        <span className="text-white text-xs">{delta.symbol}</span>
                                        {delta.name && delta.name !== delta.symbol && (
                                          <span className="text-[10px] text-[#8C8370] font-sans truncate max-w-[120px]">{delta.name}</span>
                                        )}
                                      </div>
                                    </td>
                                    <td className="px-4 py-3">
                                      {getActionTypeBadge(delta.actionType)}
                                    </td>
                                    <td className="px-4 py-3 text-right font-mono text-[#8C8370]">
                                      {delta.previousQuantity !== undefined ? delta.previousQuantity.toLocaleString() : '0'}
                                    </td>
                                    <td className="px-4 py-3 text-right font-mono">
                                      {delta.currentQuantity !== undefined ? delta.currentQuantity.toLocaleString() : '0'}
                                    </td>
                                    <td className={`px-4 py-3 text-right font-mono font-medium ${
                                      (delta.quantityDelta || 0) > 0 ? 'text-emerald-400' : (delta.quantityDelta || 0) < 0 ? 'text-rose-400' : 'text-[#8C8370]'
                                    }`}>
                                      {(delta.quantityDelta || 0) > 0 ? '+' : ''}{(delta.quantityDelta || 0).toLocaleString()}
                                    </td>
                                    <td className="px-4 py-3 text-right font-mono text-[#8C8370]">
                                      ${delta.previousMarketValue !== undefined ? delta.previousMarketValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0.00'}
                                    </td>
                                    <td className="px-4 py-3 text-right font-mono text-[#C9B284]">
                                      ${delta.currentMarketValue !== undefined ? delta.currentMarketValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0.00'}
                                    </td>
                                  </tr>
                                  {/* Reason log sub-row */}
                                  <tr className="bg-black/10">
                                    <td colSpan={8} className="px-4 py-1.5 text-[10.5px] text-[#8C8370] border-b border-[#C9B284]/5 font-sans leading-relaxed">
                                      <span className="font-mono text-[#C9B284]/50 select-none mr-1.5">[DIAGNOSTIC]</span>
                                      {delta.reason}
                                    </td>
                                  </tr>
                                </React.Fragment>
                              ))
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </>
          )}
        </div>

        {/* Footer static button command bar */}
        {activeSession && (
          <div className="p-6 bg-[#0E1115] border-t border-[#C9B284]/15 space-y-3">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="space-y-0.5 text-center sm:text-left">
                <h4 className="text-xs font-bold text-white flex items-center justify-center sm:justify-start gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-[#C9B284]" />
                  智能生成 AI 实盘复盘报告 / AI Diagnosis Report
                </h4>
                <p className="text-[10px] text-[#8C8370] leading-relaxed max-w-md">
                  整合全量账户实盘数据资产，穿透底层个股、期权与行业贝塔因子做中观对冲审查。
                </p>
              </div>

              <div className="w-full sm:w-auto shrink-0">
                <button
                  disabled={activeSession.status === 'analyzing'}
                  onClick={() => {
                    const rp = activeSession.reviewParams || {};
                    const pRiskPreference = rp.riskPreference || riskPreference;
                    const pMaxDrawdownTolerance = rp.maxDrawdownTolerance || maxDrawdownTolerance;
                    const pAllowMargin = rp.allowMargin === '是' ? true : rp.allowMargin === '否' ? false : (allowMargin === '是' ? true : allowMargin === '否' ? false : undefined);
                    const pAllowOptions = rp.allowOptions === '是' ? true : rp.allowOptions === '否' ? false : (allowOptions === '是' ? true : allowOptions === '否' ? false : undefined);
                    const pAllowCrypto = rp.allowCrypto === '是' ? true : rp.allowCrypto === '否' ? false : (allowCrypto === '是' ? true : allowCrypto === '否' ? false : undefined);

                    analyzePortfolioReviewSession(activeSession.id, {
                      riskPreference: pRiskPreference,
                      maxDrawdownTolerance: pMaxDrawdownTolerance,
                      allowMargin: pAllowMargin,
                      allowOptions: pAllowOptions,
                      allowCrypto: pAllowCrypto,
                    });
                  }}
                  className="w-full sm:w-auto px-5 py-2.5 bg-[#C9B284]/10 hover:bg-[#C9B284]/20 border border-[#C9B284]/30 text-[#C9B284] disabled:opacity-50 disabled:cursor-not-allowed text-xs font-mono tracking-wider font-semibold uppercase rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1.5"
                >
                  {activeSession.status === 'analyzing' ? (
                    <>
                      <div className="w-3 h-3 rounded-full border-2 border-[#C9B284]/15 border-t-[#C9B284] animate-spin" />
                      <span>正在诊断中...</span>
                    </>
                  ) : activeSession.report ? (
                    <>
                      <Sparkles className="w-3.5 h-3.5 text-[#C9B284]" />
                      <span>重新生成报告</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-3.5 h-3.5 text-[#C9B284]" />
                      <span>生成 AI 复盘报告</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
