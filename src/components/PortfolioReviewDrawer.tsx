import React, { useEffect } from 'react';
import { MaterialIcon } from './ui/MaterialIcon';
import { useWealthStore } from '../hooks/useWealthStore';
import { PortfolioReviewSession, PositionDelta } from '../types/portfolio-review';
import { useTranslation } from '../hooks/useTranslation';

const marketContextToneClass = {
  positive: 'aw-state-chip-success',
  neutral: 'aw-state-chip',
  warning: 'aw-state-chip-warning',
  muted: 'aw-state-chip'
};

function formatMarketRegime(regime: any | undefined, t: (key: string) => string): {
  label: string;
  tone: 'positive' | 'neutral' | 'warning' | 'muted';
  desc: string;
} {
  if (!regime || !regime.riskMode) {
    return { label: t('portfolioReview.unknown'), tone: 'muted', desc: t('portfolioReview.marketNoDataDesc') };
  }
  switch (regime.riskMode) {
    case 'risk_on':
      return { label: t('portfolioReview.riskOn'), tone: 'positive', desc: t('portfolioReview.riskOnDesc') };
    case 'risk_off':
      return { label: t('portfolioReview.riskOff'), tone: 'warning', desc: t('portfolioReview.riskOffDesc') };
    case 'neutral':
      return { label: t('portfolioReview.neutral'), tone: 'neutral', desc: t('portfolioReview.neutralDesc') };
    default:
      return { label: t('portfolioReview.unknown'), tone: 'muted', desc: t('portfolioReview.marketNoDataDesc') };
  }
}

function formatPressure(value: string | undefined, t: (key: string) => string) {
  if (!value) return t('portfolioReview.noData');
  switch (value) {
    case 'high':
      return t('portfolioReview.pressureHigh');
    case 'medium':
      return t('portfolioReview.pressureMedium');
    case 'low':
      return t('portfolioReview.pressureLow');
    case 'risk_on':
      return `${t('portfolioReview.riskOn')} / ${t('portfolioReview.riskOnLocal')}`;
    case 'risk_off':
      return `${t('portfolioReview.riskOff')} / ${t('portfolioReview.riskOffLocal')}`;
    case 'neutral':
      return t('portfolioReview.neutral');
    case 'unknown':
      return `${t('portfolioReview.unknown')} / ${t('portfolioReview.insufficientData')}`;
    case 'rising_rate_pressure':
      return t('portfolioReview.risingRatePressure');
    case 'falling_rate_pressure':
      return t('portfolioReview.fallingRatePressure');
    case 'strong_usd':
      return t('portfolioReview.strongUsd');
    case 'weak_usd':
      return t('portfolioReview.weakUsd');
    case 'elevated':
      return t('portfolioReview.elevated');
    case 'normal':
      return t('portfolioReview.normal');
    case 'inflationary':
      return t('portfolioReview.inflationary');
    case 'disinflationary':
      return t('portfolioReview.disinflationary');
    case 'mixed':
      return t('portfolioReview.mixed');
    case 'calm':
      return t('portfolioReview.calm');
    case 'stressed':
      return t('portfolioReview.stressed');
    default:
      return value.replace(/_/g, ' ');
  }
}

interface PortfolioReviewDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export function PortfolioReviewDrawer({ isOpen, onClose }: PortfolioReviewDrawerProps) {
  const { t, language } = useTranslation();
  const portfolioReviewSessions = useWealthStore(state => state.portfolioReviewSessions);
  const activeSessionId = useWealthStore(state => state.activePortfolioReviewSessionId);
  const analyzePortfolioReviewSession = useWealthStore(state => state.analyzePortfolioReviewSession);
  const portfolioReviewMemory = useWealthStore(state => state.portfolioReviewMemory);
  const savePortfolioReviewMemoryFromSession = useWealthStore(state => state.savePortfolioReviewMemoryFromSession);
  const updatePortfolioReviewSession = useWealthStore(state => state.updatePortfolioReviewSession);

  const data = useWealthStore(state => state.data);
  const marketContextStatus = useWealthStore(state => state.marketContextStatus);
  const marketContextError = useWealthStore(state => state.marketContextError);
  const fetchMarketContext = useWealthStore(state => state.fetchMarketContext);

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
      return new Date(timestamp).toLocaleString(language, {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      });
    } catch {
      return t('portfolioReview.unknownTime');
    }
  };

  const currentSnapshot = activeSession?.currentSnapshot;
  const previousSnapshot = activeSession?.previousSnapshot;
  const deltas = activeSession?.deltas || [];

  const getActionTypeBadge = (actionType: PositionDelta['actionType']) => {
    switch (actionType) {
      case 'new_position':
        return (
	          <span className="aw-state-chip aw-state-chip-success">
	            {t('portfolioReview.actionNew')}
	          </span>
        );
      case 'increase':
        return (
	          <span className="aw-state-chip aw-state-chip-info">
	            {t('portfolioReview.actionIncrease')}
	          </span>
        );
      case 'reduce':
        return (
	          <span className="aw-state-chip aw-state-chip-warning">
	            {t('portfolioReview.actionReduce')}
	          </span>
        );
      case 'exit':
        return (
	          <span className="aw-state-chip aw-state-chip-danger">
	            {t('portfolioReview.actionExit')}
	          </span>
        );
      case 'unchanged':
        return (
	          <span className="aw-state-chip">
	            {t('portfolioReview.actionHold')}
	          </span>
        );
      default:
        return (
	          <span className="aw-state-chip">
	            {t('portfolioReview.unknown')}
	          </span>
        );
    }
  };

  const getConfidenceBadge = (confidence: 'high' | 'medium' | 'low') => {
    switch (confidence) {
      case 'high':
        return (
	          <span className="aw-state-chip aw-state-chip-success">
	            <MaterialIcon name="check_circle" size={16} />
	            {t('portfolioReview.confidenceHigh')}
	          </span>
        );
      case 'medium':
        return (
	          <span className="aw-state-chip aw-state-chip-warning">
	            <MaterialIcon name="info" size={16} />
	            {t('portfolioReview.confidenceMedium')}
	          </span>
        );
      default:
        return (
	          <span className="aw-state-chip aw-state-chip-danger">
	            <MaterialIcon name="shield_alert" size={16} />
	            {t('portfolioReview.confidenceLow')}
	          </span>
        );
    }
  };

  const displayedMarketContext =
    activeSession?.marketContextSnapshot || data?.marketContext;

  const displayedMarketContextCapturedAt =
    activeSession?.marketContextCapturedAt || data?.marketContextLastFetchedAt;

  const isUsingFrozenMarketContext = Boolean(activeSession?.marketContextSnapshot);

  return (
    <>
      {/* Backdrop overlay */}
      <div 
        className="fixed inset-0 z-50 aw-drawer-backdrop transition-opacity" 
        onClick={onClose}
      />
      
      {/* Slide-out Panel container */}
      <div 
	        className="aw-drawer-shell aw-workbench-shell fixed inset-y-0 right-0 z-50 w-full max-w-4xl flex flex-col overflow-hidden text-sans transition-all duration-300"
      >
        {/* Header toolbar */}
	        <div className="aw-drawer-header aw-workbench-header px-6 py-5 border-b flex items-center justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
	              <h2 className="aw-label font-bold aw-text-primary tracking-normal">
	                {t('portfolioReview.title')}
	              </h2>
              {currentSnapshot && getConfidenceBadge(currentSnapshot.dataConfidence)}
            </div>
	            <p className="aw-caption aw-text-tertiary font-mono">
	              {t('portfolioReview.sessionId')}: {activeSession?.id || 'N/A'}
	            </p>
          </div>
          <button 
            onClick={onClose}
            className="aw-icon-button cursor-pointer"
          >
            <MaterialIcon name="close" size={20} />
          </button>
        </div>

        {/* Core details workspace body */}
	        <div className="aw-workbench-scroll flex-1 overflow-y-auto px-6 py-6 space-y-6">
          {!activeSession ? (
            <div className="py-20 flex flex-col items-center justify-center text-center space-y-3">
              <MaterialIcon name="help" size={32} className="text-aw-accent-mist opacity-40 animate-pulse" />
	              <div className="aw-body aw-text-secondary font-medium">
	                {t('portfolioReview.noSessionTitle')}
	              </div>
	              <p className="aw-caption aw-text-tertiary max-w-xs leading-relaxed">
	                {t('portfolioReview.noSessionDesc')}
	              </p>
            </div>
          ) : (
            <>
              {/* 截图导入持仓备用入口 / Screenshot Upload Fallback (Placeholder) */}
              <div className="bg-aw-surface-1/40 border border-aw-border-subtle rounded-xl p-3 flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
	                    <span className="aw-caption bg-aw-surface-3 text-aw-accent-mist px-1.5 py-0.5 rounded font-mono tracking-wider font-semibold">
	                      {t('portfolioReview.ocrImport')}
	                    </span>
	                    <span className="aw-caption aw-text-tertiary font-mono">{t('portfolioReview.comingSoon')}</span>
                  </div>
                  <p className="text-xs aw-text-tertiary leading-relaxed">
	                    {t('portfolioReview.ocrDesc')}
                  </p>
                </div>
                <button
                  disabled
                  className="w-full md:w-auto px-3 py-1.5 bg-aw-surface-2 border border-aw-border-subtle aw-text-tertiary rounded aw-caption font-mono whitespace-nowrap cursor-not-allowed"
                >
	                  {t('portfolioReview.ocrButton')} ({t('portfolioReview.comingSoon')})
                </button>
              </div>

              {/* Snapshot brief dashboard cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-aw-surface-1 border border-aw-border-subtle rounded-xl p-4 flex flex-col">
                  <span className="aw-caption aw-text-tertiary font-mono tracking-wider uppercase mb-1">
	                    {t('portfolioReview.totalMv')}
                  </span>
                  <span className="text-base md:text-lg font-mono font-bold text-aw-accent-mist">
                    ${currentSnapshot?.totalMarketValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0.00'}
                  </span>
                </div>
                <div className="bg-aw-surface-1 border border-aw-border-subtle rounded-xl p-4 flex flex-col">
                  <span className="aw-caption aw-text-tertiary font-mono tracking-wider uppercase mb-1">
	                    {t('portfolioReview.accounts')}
                  </span>
                  <span className="text-base md:text-lg font-mono font-bold aw-text-primary">
	                    {currentSnapshot?.accountCount || 0} <span className="text-xs aw-text-tertiary font-light">{t('portfolioReview.accountUnit')}</span>
                  </span>
                </div>
                <div className="bg-aw-surface-1 border border-aw-border-subtle rounded-xl p-4 flex flex-col">
                  <span className="aw-caption aw-text-tertiary font-mono tracking-wider uppercase mb-1">
	                    {t('portfolioReview.positions')}
                  </span>
                  <span className="text-base md:text-lg font-mono font-bold aw-text-primary">
	                    {currentSnapshot?.positionCount || 0} <span className="text-xs aw-text-tertiary font-light">{t('portfolioReview.positionUnit')}</span>
                  </span>
                </div>
                <div className="bg-aw-surface-1 border border-aw-border-subtle rounded-xl p-4 flex flex-col">
                  <span className="aw-caption aw-text-tertiary font-mono tracking-wider uppercase mb-1">
	                    {t('portfolioReview.source')}
                  </span>
                  <span className="text-base md:text-lg font-mono font-bold aw-text-primary uppercase tracking-wide">
	                    {currentSnapshot?.source === 'longbridge' ? t('portfolioReview.longbridgeLive') : t('portfolioReview.manualSummary')}
                  </span>
                </div>
              </div>

              {/* 本轮复盘参数 / Strategic Parameters Form */}
              <div className="bg-aw-surface-1 border border-aw-border rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between border-b border-aw-border-subtle pb-2">
                  <h4 className="text-xs font-bold aw-text-primary uppercase tracking-widest font-mono flex items-center gap-1.5">
                    <MaterialIcon name="auto_awesome" size={16} className="text-aw-accent-mist" />
	                    {t('portfolioReview.paramsTitle')}
                  </h4>
	                  <span className="aw-caption aw-text-tertiary font-mono">{t('portfolioReview.optionalHint')}</span>
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3">
                  {/* riskPreference */}
                  <div className="space-y-1">
	                    <label className="aw-caption aw-text-tertiary font-mono uppercase tracking-wider block">{t('portfolioReview.riskPreference')}</label>
                    <select
                      value={riskPreference}
                      onChange={(e) => updateParamsAndPersist({ riskPreference: e.target.value as any })}
                      className="w-full bg-aw-surface-0 border border-aw-border-subtle aw-text-primary text-xs rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-aw-border-strong transition-colors font-sans cursor-pointer"
                    >
	                      <option value="">{t('portfolioReview.unset')}</option>
	                      <option value="保守">{t('portfolioReview.conservative')}</option>
	                      <option value="中性">{t('portfolioReview.moderate')}</option>
	                      <option value="激进">{t('portfolioReview.aggressive')}</option>
	                      <option value="高波动可接受">{t('portfolioReview.highVolatilityOk')}</option>
                    </select>
                  </div>

                  {/* maxDrawdownTolerance */}
                  <div className="space-y-1">
	                    <label className="aw-caption aw-text-tertiary font-mono uppercase tracking-wider block">{t('portfolioReview.maxDrawdown')}</label>
                    <div className="relative">
                      <input
                        type="text"
                        value={maxDrawdownTolerance}
                        onChange={(e) => updateParamsAndPersist({ maxDrawdownTolerance: e.target.value })}
	                        placeholder={t('portfolioReview.drawdownPlaceholder')}
                        className="w-full bg-aw-surface-0 border border-aw-border-subtle aw-text-primary text-xs rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-aw-border-strong transition-colors font-mono"
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
	                    <label className="aw-caption aw-text-tertiary font-mono uppercase tracking-wider block">{t('portfolioReview.allowMargin')}</label>
                    <select
                      value={allowMargin}
                      onChange={(e) => updateParamsAndPersist({ allowMargin: e.target.value as any })}
                      className="w-full bg-aw-surface-0 border border-aw-border-subtle aw-text-primary text-xs rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-aw-border-strong transition-colors font-sans cursor-pointer"
                    >
	                      <option value="">{t('portfolioReview.unselected')}</option>
	                      <option value="是">{t('portfolioReview.yes')}</option>
	                      <option value="否">{t('portfolioReview.no')}</option>
                    </select>
                  </div>

                  {/* allowOptions */}
                  <div className="space-y-1">
	                    <label className="aw-caption aw-text-tertiary font-mono uppercase tracking-wider block">{t('portfolioReview.allowOptions')}</label>
                    <select
                      value={allowOptions}
                      onChange={(e) => updateParamsAndPersist({ allowOptions: e.target.value as any })}
                      className="w-full bg-aw-surface-0 border border-aw-border-subtle aw-text-primary text-xs rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-aw-border-strong transition-colors font-sans cursor-pointer"
                    >
	                      <option value="">{t('portfolioReview.unselected')}</option>
	                      <option value="是">{t('portfolioReview.yes')}</option>
	                      <option value="否">{t('portfolioReview.no')}</option>
                    </select>
                  </div>

                  {/* allowCrypto */}
                  <div className="space-y-1">
	                    <label className="aw-caption aw-text-tertiary font-mono uppercase tracking-wider block">{t('portfolioReview.allowCrypto')}</label>
                    <select
                      value={allowCrypto}
                      onChange={(e) => updateParamsAndPersist({ allowCrypto: e.target.value as any })}
                      className="w-full bg-aw-surface-0 border border-aw-border-subtle aw-text-primary text-xs rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-aw-border-strong transition-colors font-sans cursor-pointer"
                    >
	                      <option value="">{t('portfolioReview.unselected')}</option>
	                      <option value="是">{t('portfolioReview.yes')}</option>
	                      <option value="否">{t('portfolioReview.no')}</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* 市场环境上下文 / Market Context Panel */}
              <div className="bg-aw-surface-1 border border-aw-border rounded-xl p-4 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-aw-border-subtle pb-3">
                  <div className="space-y-0.5 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h4 className="text-xs font-bold aw-text-primary uppercase tracking-widest font-mono flex items-center gap-1.5">
                        <MaterialIcon name="monitoring" size={16} className="text-aw-accent-mist" />
	                        {t('portfolioReview.marketContextTitle')}
                      </h4>
                      {isUsingFrozenMarketContext ? (() => {
                        const capD = displayedMarketContextCapturedAt ? new Date(displayedMarketContextCapturedAt) : null;
                        const timeStr = capD ? `${String(capD.getHours()).padStart(2, '0')}:${String(capD.getMinutes()).padStart(2, '0')}` : '';
                        return (
	                          <span className="inline-flex items-center gap-1.5 px-1.5 py-0.5 rounded border border-aw-success/30 bg-aw-success/10 aw-caption text-aw-success font-sans leading-none select-none" title={t('portfolioReview.frozenTitle')}>
                            <span className="w-1 h-1 rounded-full bg-aw-success animate-pulse" />
	                          <span>{t('portfolioReview.frozen')}</span>
                            {timeStr && <span className="aw-text-tertiary font-mono">Captured {timeStr}</span>}
                          </span>
                        );
                      })() : (
	                        <span className="inline-flex items-center gap-1.5 px-1.5 py-0.5 rounded border border-aw-border-subtle bg-white/[0.03] aw-caption aw-text-secondary font-sans leading-none select-none" title={t('portfolioReview.freezeHint')}>
	                          <span className="w-1 h-1 rounded-full bg-aw-surface-3" />
	                          <span>{t('portfolioReview.notFrozen')}</span>
	                          <span className="aw-text-tertiary">{t('portfolioReview.freezeHint')}</span>
	                        </span>
                      )}
                    </div>
	                    <p className="aw-caption aw-text-tertiary truncate">{t('portfolioReview.marketContextDesc')}</p>
                  </div>
                  <div className="flex flex-col items-end">
                    <button
                      disabled={marketContextStatus === 'loading'}
                      onClick={() => fetchMarketContext({ forceRefresh: true })}
                      className={`px-3 py-1.5 border aw-caption font-sans font-medium rounded-lg transition-all select-none self-start sm:self-auto cursor-pointer ${
                        marketContextStatus === 'loading'
                          ? 'bg-aw-surface-2 border-aw-border-subtle aw-text-tertiary cursor-not-allowed'
                          : 'bg-aw-surface-2 hover:bg-aw-surface-3 border-aw-border-subtle hover:border-aw-border-strong aw-text-secondary hover:text-aw-text-primary'
                      }`}
                    >
	                      {marketContextStatus === 'loading' ? t('portfolioReview.refreshing') : t('portfolioReview.refreshMarket')}
                    </button>
                    {isUsingFrozenMarketContext && (
                      <span className="aw-caption aw-text-tertiary text-right block mt-1 select-none leading-tight font-sans max-w-[200px]">
	                        {t('portfolioReview.refreshGlobalOnly')}
                      </span>
                    )}
                  </div>
                </div>

                {!displayedMarketContext ? (
                  /* 无数据状态 */
                  <div className="py-6 flex flex-col items-center justify-center text-center space-y-2">
                    <MaterialIcon name="info" size={32} className="text-aw-accent-mist/20" />
	                    <div className="aw-text-primary/60 text-xs font-medium">{t('portfolioReview.waitingMarketContext')}</div>
                    <p className="aw-text-tertiary aw-caption max-w-md leading-relaxed select-none">
	                      {t('portfolioReview.waitingMarketContextDesc')}
                    </p>
                    {marketContextStatus === 'error' && marketContextError && (
                      <div className="text-aw-danger aw-caption bg-aw-danger/10 px-2.5 py-1 rounded border border-aw-danger/30 mt-1">
	                        {t('portfolioReview.refreshFailed')}: {marketContextError}
                      </div>
                    )}
                  </div>
                ) : (
                  /* 有数据状态 */
                  <div className="space-y-4">
                    {/* A. Regime Summary */}
                    {displayedMarketContext.regime && (() => {
	                      const regimeInfo = formatMarketRegime(displayedMarketContext.regime, t);
                      return (
                        <div className="bg-aw-surface-2 rounded-lg p-3 border border-aw-border-subtle space-y-2">
                          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-aw-border-subtle pb-1.5">
                            <div className="flex items-center gap-2">
                              <span className={`px-1.5 py-0.5 rounded aw-caption font-sans font-bold leading-none border ${marketContextToneClass[regimeInfo.tone]}`}>
                                {regimeInfo.label}
                              </span>
                              <span className="aw-caption aw-text-primary/90 font-sans">{regimeInfo.desc}</span>
                            </div>
                            <div className="aw-caption aw-text-tertiary font-mono flex flex-wrap items-center gap-1.5 select-none">
                              <span className="bg-white/5 px-1.5 py-0.5 rounded">{t('portfolioReview.freshness')}: {displayedMarketContext.freshness}</span>
                              <span className="bg-white/5 px-1.5 py-0.5 rounded">{t('portfolioReview.quality')}: {displayedMarketContext.dataQuality}</span>
                              {displayedMarketContextCapturedAt && (() => {
                                const d = new Date(displayedMarketContextCapturedAt);
                                const hh = String(d.getHours()).padStart(2, '0');
                                const mm = String(d.getMinutes()).padStart(2, '0');
                                return <span>{t('portfolioReview.updatedAt')} {hh}:{mm}</span>;
                              })()}
                            </div>
                          </div>
                          <p className="text-xs text-aw-accent-mist leading-relaxed font-sans whitespace-pre-wrap">{displayedMarketContext.regime.summary}</p>
                        </div>
                      );
                    })()}

                    {/* Quality Summary Optional Row */}
                    {displayedMarketContext.qualitySummary && (
                      <div className="bg-aw-surface-2 rounded-lg p-3 border border-aw-border-subtle space-y-1.5 text-xs font-mono">
                        <div className="flex items-center justify-between border-b border-aw-border-subtle pb-1.5">
                          <span className="aw-text-tertiary uppercase aw-caption">{t('portfolioReview.dataHealthTitle')}</span>
                          <span className={`aw-caption px-1.5 py-0.5 rounded ${
                            displayedMarketContext.qualitySummary.status === 'ready' ? 'text-aw-success bg-aw-success/10' :
                            displayedMarketContext.qualitySummary.status === 'degraded' ? 'text-aw-warning bg-aw-warning/10' :
                            'text-aw-danger bg-aw-danger/10'
                          }`}>
                            {displayedMarketContext.qualitySummary.status.toUpperCase()} · {displayedMarketContext.qualitySummary.confidence.toUpperCase() || t('portfolioReview.lowConfidenceShort')} {t('portfolioReview.confidence').toUpperCase()}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-xs aw-text-primary/95 pt-0.5">
                          <span>{t('portfolioReview.coverageRatio')}: {Math.round(displayedMarketContext.qualitySummary.coverageRatio * 100)}%</span>
                          <span>{t('portfolioReview.coreCoverageRatio')}: {Math.round(displayedMarketContext.qualitySummary.instrumentCoverageRatio * 100)}%</span>
                        </div>
                        <div className="flex flex-wrap gap-1.5 pt-1 border-t border-aw-border-subtle mt-1">
                          {(displayedMarketContext.qualitySummary.sourceHealth || []).map((sh: any) => (
                            <span 
                              key={`sh-${sh.source}`}
                              className={`px-1.5 py-0.5 rounded aw-caption border ${
                                sh.status === 'ok' ? 'text-aw-success border-aw-success/30 bg-aw-success/10' :
                                sh.status === 'partial' ? 'text-aw-warning border-aw-warning/30 bg-aw-warning/10' :
                                sh.status === 'not_configured' ? 'aw-text-tertiary border-aw-border-subtle bg-aw-surface-2' :
                                'text-aw-danger border-aw-danger/30 bg-aw-danger/10'
                              }`}
                            >
                              {sh.source}: {sh.status} {sh.expectedCount ? `(${sh.successCount}/${sh.expectedCount})` : ''}
                            </span>
                          ))}
                        </div>
                        {displayedMarketContext.qualitySummary.summary && (
                          <div className="aw-caption aw-text-tertiary leading-relaxed font-sans pt-1">
                            {displayedMarketContext.qualitySummary.summary}
                          </div>
                        )}
                      </div>
                    )}

                    {/* B. Factor Grid */}
                    {displayedMarketContext.regime && (
                      <div className="space-y-1.5">
	                        <span className="aw-caption aw-text-tertiary font-mono uppercase tracking-wider block">{t('portfolioReview.factorAppraisal')}</span>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                          {/* 1. 风险偏好 */}
                          <div className="bg-aw-surface-3 border border-aw-border-subtle p-2 rounded-lg flex flex-col justify-center min-w-0">
	                            <span className="aw-caption aw-text-tertiary">{t('portfolioReview.factorRiskBias')}</span>
                            <span className="text-xs font-mono font-bold text-aw-accent-mist mt-0.5">
	                              {formatPressure(displayedMarketContext.regime.riskMode, t)}
                            </span>
                          </div>
                          {/* 2. 利率压力 */}
                          <div className="bg-aw-surface-3 border border-aw-border-subtle p-2 rounded-lg flex flex-col justify-center min-w-0">
	                            <span className="aw-caption aw-text-tertiary">{t('portfolioReview.factorRate')}</span>
                            <span className={`text-xs font-mono font-bold mt-0.5 ${
                              displayedMarketContext.regime.ratePressure === 'rising_rate_pressure' ? 'text-aw-warning' : 'aw-text-secondary'
                            }`}>
	                              {formatPressure(displayedMarketContext.regime.ratePressure, t)}
                            </span>
                          </div>
                          {/* 3. 美元压力 */}
                          <div className="bg-aw-surface-3 border border-aw-border-subtle p-2 rounded-lg flex flex-col justify-center min-w-0">
	                            <span className="aw-caption aw-text-tertiary">{t('portfolioReview.factorDollar')}</span>
                            <span className={`text-xs font-mono font-bold mt-0.5 ${
                              displayedMarketContext.regime.dollarPressure === 'strong_usd' ? 'text-aw-warning' : 'aw-text-secondary'
                            }`}>
	                              {formatPressure(displayedMarketContext.regime.dollarPressure, t)}
                            </span>
                          </div>
                          {/* 4. 信用压力 */}
                          <div className="bg-aw-surface-3 border border-aw-border-subtle p-2 rounded-lg flex flex-col justify-center min-w-0">
	                            <span className="aw-caption aw-text-tertiary">{t('portfolioReview.factorCredit')}</span>
                            <span className={`text-xs font-mono font-bold mt-0.5 ${
                              displayedMarketContext.regime.creditStress === 'elevated' ? 'text-aw-warning' : 'aw-text-secondary'
                            }`}>
	                              {formatPressure(displayedMarketContext.regime.creditStress, t)}
                            </span>
                          </div>
                          {/* 5. 商品冲击 */}
                          <div className="bg-aw-surface-3 border border-aw-border-subtle p-2 rounded-lg flex flex-col justify-center min-w-0">
	                            <span className="aw-caption aw-text-tertiary">{t('portfolioReview.factorCommodity')}</span>
                            <span className={`text-xs font-mono font-bold mt-0.5 ${
                              displayedMarketContext.regime.commodityImpulse === 'inflationary' ? 'text-aw-warning' : 'aw-text-secondary'
                            }`}>
	                              {formatPressure(displayedMarketContext.regime.commodityImpulse, t)}
                            </span>
                          </div>
                          {/* 6. 波动状态 */}
                          <div className="bg-aw-surface-3 border border-aw-border-subtle p-2 rounded-lg flex flex-col justify-center min-w-0">
	                            <span className="aw-caption aw-text-tertiary">{t('portfolioReview.factorVolatility')}</span>
                            <span className={`text-xs font-mono font-bold mt-0.5 ${
                              displayedMarketContext.regime.volatilityState === 'stressed' ? 'text-aw-warning' : 'aw-text-secondary'
                            }`}>
	                              {formatPressure(displayedMarketContext.regime.volatilityState, t)}
                            </span>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* C. Cross-Asset Signals */}
                    <div className="space-y-1.5">
	                      <span className="aw-caption aw-text-tertiary font-mono uppercase tracking-wider block">{t('portfolioReview.crossAssetSignals')}</span>
                      {!displayedMarketContext.crossAssetSignals || displayedMarketContext.crossAssetSignals.length === 0 ? (
                        <div className="aw-caption aw-text-tertiary italic bg-aw-surface-3 py-2 px-3 rounded-lg border border-aw-border-subtle">
	                          {t('portfolioReview.noCrossAssetSignals')}
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {displayedMarketContext.crossAssetSignals.slice(0, 4).map((sig: any, sIdx: number) => (
                            <div key={sIdx} className="bg-aw-surface-2 border border-aw-border-subtle rounded-lg p-2.5 space-y-1.5">
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <span className="aw-text-primary text-xs font-semibold">{sig.title}</span>
                                <span className={`px-1.5 py-0.5 rounded aw-caption font-mono leading-none border uppercase tracking-wider ${
                                  sig.severity === 'critical' ? 'text-aw-danger border-aw-danger/30 bg-aw-danger/10' :
                                  sig.severity === 'warning' ? 'text-aw-warning border-aw-warning/30 bg-aw-warning/10' :
                                  sig.severity === 'watch' ? 'text-aw-info border-aw-info/30 bg-aw-info/10' :
                                  'aw-text-secondary border-aw-border-subtle bg-white/5'
                                }`}>
                                  {sig.severity}
                                </span>
                              </div>
                              <p className="aw-caption aw-text-secondary line-clamp-2 leading-relaxed">
                                {sig.interpretation}
                              </p>
                              {sig.affectedExposures && sig.affectedExposures.length > 0 && (
                                <div className="flex flex-wrap items-center gap-1 mt-1 pb-0.5">
	                                  <span className="aw-caption aw-text-tertiary uppercase font-mono mr-1">{t('portfolioReview.affectedExposures')}:</span>
                                  {sig.affectedExposures.slice(0, 3).map((exp: string, eIdx: number) => (
                                    <span key={eIdx} className="px-1.5 py-0.5 rounded bg-white/[0.03] border border-aw-border-subtle aw-text-secondary font-mono aw-caption">
                                      {exp}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* D. Warnings and Footer Static References */}
                    <div className="border-t border-aw-border-subtle pt-2.5 flex flex-col gap-1.5">
                      {displayedMarketContext.sourceSummary && displayedMarketContext.sourceSummary.length > 0 && (
                        <div className="aw-caption aw-text-tertiary font-mono leading-none">
	                          {t('portfolioReview.sourceLabel')}: {displayedMarketContext.sourceSummary.join(' · ')}
                        </div>
                      )}
                      
                      {/* Warnings */}
                      {displayedMarketContext.warnings && displayedMarketContext.warnings.length > 0 && (
                        <div className="space-y-0.5">
                          {displayedMarketContext.warnings.slice(0, 2).map((warn: string, wIdx: number) => (
                            <p key={wIdx} className="aw-caption aw-text-tertiary leading-normal flex items-start gap-1">
                              <span className="text-aw-accent-mist/70 select-none">•</span>
                              <span>{warn}</span>
                            </p>
                          ))}
                        </div>
                      )}

                      <p className="aw-caption aw-text-tertiary leading-normal flex items-start gap-1 font-sans mt-0.5 select-none">
                        <span className="text-aw-warning select-none shrink-0 inline-flex items-center gap-1">
                          <MaterialIcon name="warning" size={16} />
	                          [{t('portfolioReview.riskBoundaryLabel')}]
                        </span>
	                        <span>{t('portfolioReview.riskBoundaryDesc')}</span>
                      </p>

                      {marketContextStatus === 'error' && marketContextError && (
                        <div className="text-aw-danger aw-caption mt-1 select-none">
	                          {t('portfolioReview.refreshError')}: {marketContextError.length > 36 ? `${marketContextError.substring(0, 36)}...` : marketContextError}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Error Warning Box */}
              {activeSession.error && (
                <div className="border border-aw-danger/30 bg-aw-danger/10 rounded-xl p-4 space-y-1.5 animate-in fade-in slide-in-from-top-1 duration-200">
                  <h4 className="text-xs font-mono font-bold text-aw-danger uppercase tracking-widest flex items-center gap-1.5">
                    <MaterialIcon name="shield_alert" size={16} className="shrink-0" />
	                    {t('portfolioReview.reportErrorTitle')}
                  </h4>
                  <p className="text-xs text-aw-danger font-light leading-relaxed">
                    {activeSession.error}
                  </p>
                </div>
              )}

              {/* Tabs Switcher for Snapshot vs AI Report */}
              {activeSession.report && (
                <div className="flex border-b border-aw-border mt-2">
                  <button
                    onClick={() => setActiveTab('snapshot')}
                    className={`px-5 py-2.5 text-xs font-mono font-bold tracking-widest relative cursor-pointer ${
                      activeTab === 'snapshot' ? 'text-aw-accent-mist' : 'aw-text-tertiary hover:text-aw-text-primary'
                    }`}
                  >
	                    <span>01. {t('portfolioReview.snapshotAuditTab')}</span>
                    {activeTab === 'snapshot' && (
                      <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-aw-accent-mist" />
                    )}
                  </button>
                  <button
                    onClick={() => setActiveTab('report')}
                    className={`px-5 py-2.5 text-xs font-mono font-bold tracking-widest relative cursor-pointer flex items-center gap-1.5 ${
                      activeTab === 'report' ? 'text-aw-accent-mist' : 'aw-text-tertiary hover:text-aw-text-primary'
                    }`}
                  >
                    <MaterialIcon name="auto_awesome" size={16} className="text-aw-accent-mist" />
                    <span>02. {t('portfolioReview.reportTab')}</span>
                    {activeTab === 'report' && (
                      <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-aw-accent-mist" />
                    )}
                  </button>
                </div>
              )}

              {/* Main Content Area based on Status & Tab state */}
              {activeSession.status === 'analyzing' ? (
                <div className="py-24 flex flex-col items-center justify-center text-center space-y-4">
                  <div className="relative flex items-center justify-center">
                    <div className="w-14 h-14 rounded-full border-2 border-aw-border-subtle border-t-aw-accent-mist animate-spin" />
                    <MaterialIcon name="auto_awesome" size={20} className="absolute text-aw-accent-mist animate-pulse" />
                  </div>
                  <div className="text-aw-accent-mist text-xs font-semibold font-mono tracking-wider uppercase hover:animate-pulse">
                    {t('portfolioReview.analyzingTitle')}
                  </div>
                  <div className="aw-text-tertiary text-xs max-w-sm font-light leading-relaxed">
                    {t('portfolioReview.analyzingDesc')}
                  </div>
                </div>
              ) : activeTab === 'report' && activeSession.report ? (
                <div className="space-y-6">
                  {/* Summary Block */}
                  <div className="bg-aw-surface-1 border border-aw-border rounded-xl p-5 space-y-3">
                    <div className="flex items-center gap-2 border-b border-aw-border-subtle pb-2.5">
                      <MaterialIcon name="auto_awesome" size={16} className="text-aw-accent-mist" />
                      <h3 className="text-xs font-bold aw-text-primary tracking-wide uppercase font-mono">
                        {t('portfolioReview.executiveSummary')}
                      </h3>
                    </div>
                    <p className="aw-text-primary text-xs leading-relaxed font-light whitespace-pre-wrap">
                      {activeSession.report.summary}
                    </p>

                    {/* Review Memory Save Widget */}
                    <div className="border-t border-aw-border-subtle pt-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="space-y-0.5 max-w-sm sm:max-w-md">
                        <span className="aw-caption text-aw-accent-mist font-mono uppercase tracking-widest flex items-center gap-1.5 font-bold">
                          <MaterialIcon name="psychology" size={16} className="text-aw-accent-mist" />
                          {t('portfolioReview.reviewMemoryCore')}
                        </span>
                        <p className="aw-caption aw-text-tertiary font-light leading-relaxed">
                          {t('portfolioReview.reviewMemoryCoreDesc')}
                        </p>
                      </div>

                      <div className="shrink-0">
                        {portfolioReviewMemory?.lastReviewId === activeSession.id ? (
                          <div className="flex items-center gap-1.5 bg-aw-surface-3 px-2.5 py-1.5 rounded border border-aw-border animate-in fade-in duration-200">
                            <MaterialIcon name="check_circle" size={16} className="text-aw-success shrink-0" />
                            <span className="aw-caption aw-text-secondary font-light leading-none">
                              {t('portfolioReview.reviewMemorySaved')}
                            </span>
                          </div>
                        ) : (
                          <button
                            onClick={() => savePortfolioReviewMemoryFromSession(activeSession.id, riskPreference)}
                            className="px-3 py-1.5 bg-aw-surface-3 hover:bg-aw-surface-3 border border-aw-border-strong text-aw-accent-mist hover:text-aw-text-primary aw-caption font-mono tracking-wider font-semibold uppercase rounded transition-all cursor-pointer flex items-center gap-1.5"
                          >
                            <MaterialIcon name="auto_awesome" size={16} className="text-aw-accent-mist" />
                            <span>{t('portfolioReview.saveReviewMemory')}</span>
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Portfolio Qualitative Diagnosis Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Character & Avoid Actions */}
                    <div className="bg-aw-surface-1 border border-aw-border-subtle rounded-xl p-5 space-y-4">
                      <div>
                        <span className="aw-caption aw-text-tertiary font-mono uppercase tracking-wider block mb-1">
                          {t('portfolioReview.portfolioType')}
                        </span>
                        <span className="text-xs font-bold text-aw-accent-mist font-mono tracking-wide bg-aw-surface-3 px-2.5 py-1 rounded border border-aw-border inline-block">
                          {activeSession.report.portfolioDiagnosis.portfolioType}
                        </span>
                      </div>

                      <div className="space-y-2">
                        <span className="aw-caption text-aw-danger/90 font-mono uppercase tracking-widest flex items-center gap-1.5 font-bold">
                          <MaterialIcon name="do_not_disturb_on" size={16} className="text-aw-danger" />
                          {t('portfolioReview.criticalAvoids')}
                        </span>
                        <ul className="text-xs text-aw-danger font-light space-y-2 leading-relaxed">
                          {activeSession.report.portfolioDiagnosis.avoidActions.map((act, index) => (
                            <li key={index} className="flex items-start gap-2 bg-aw-danger/10 px-3 py-2 rounded-lg border border-aw-danger/30">
                              <span className="text-aw-danger font-mono aw-caption bg-aw-danger/10 w-4 h-4 rounded-full flex items-center justify-center shrink-0 mt-0.5">{index + 1}</span>
                              <span>{act}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>

                    {/* Risks & Opportunities list */}
                    <div className="bg-aw-surface-1 border border-aw-border-subtle rounded-xl p-5 space-y-4">
                      <div className="space-y-2">
                        <span className="aw-caption text-aw-warning/90 font-mono uppercase tracking-widest flex items-center gap-1.5 font-bold">
                          <MaterialIcon name="warning" size={16} className="text-aw-warning" />
                          {t('portfolioReview.keyRiskDrivers')}
                        </span>
                        <ul className="text-xs aw-text-secondary font-light space-y-2 leading-relaxed">
                          {activeSession.report.portfolioDiagnosis.topRisks.map((risk, index) => (
                            <li key={index} className="flex items-start gap-1.5 font-sans">
                              <span className="text-aw-warning shrink-0 mt-0.5 font-bold">•</span>
                              <span>{risk}</span>
                            </li>
                          ))}
                        </ul>
                      </div>

                      <div className="space-y-2 border-t border-aw-border-subtle pt-3">
                        <span className="aw-caption text-aw-success/90 font-mono uppercase tracking-widest flex items-center gap-1.5 font-bold">
                          <MaterialIcon name="diamond" size={16} className="text-aw-success" />
                          {t('portfolioReview.strategicOpportunities')}
                        </span>
                        <ul className="text-xs aw-text-secondary font-light space-y-2 leading-relaxed">
                          {activeSession.report.portfolioDiagnosis.topOpportunities.map((opp, index) => (
                            <li key={index} className="flex items-start gap-1.5">
                              <span className="text-aw-success shrink-0 mt-0.5 font-bold">•</span>
                              <span>{opp}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </div>

                  {/* Position Reviews Table */}
                  <div className="space-y-3">
                    <h3 className="text-xs font-bold aw-text-primary uppercase tracking-widest font-mono flex items-center gap-2">
                      <MaterialIcon name="monitoring" size={16} className="text-aw-accent-mist" />
                      {t('portfolioReview.singleAssetEvaluation')}
                    </h3>

                    <div className="border border-aw-border-subtle rounded-xl overflow-hidden bg-aw-surface-1">
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs border-collapse min-w-[800px]">
                          <thead>
                            <tr className="bg-aw-surface-3 border-b border-aw-border-subtle aw-text-tertiary font-mono aw-caption uppercase tracking-wider">
                              <th className="px-4 py-3 font-medium">{t('portfolioReview.assetColumn')}</th>
                              <th className="px-4 py-3 font-medium">{t('portfolioReview.roleColumn')}</th>
                              <th className="px-4 py-3 font-medium">{t('portfolioReview.ratingActionColumn')}</th>
                              <th className="px-4 py-3 font-medium">{t('portfolioReview.strengthColumn')}</th>
                              <th className="px-4 py-3 font-medium">{t('portfolioReview.horizonColumn')}</th>
                              <th className="px-4 py-3 font-medium">{t('portfolioReview.basisColumn')}</th>
                              <th className="px-4 py-3 font-medium text-right">{t('portfolioReview.contextColumn')}</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-aw-border-subtle font-light aw-text-primary">
                            {activeSession.report.positionReviews.length === 0 ? (
                              <tr>
                                <td colSpan={7} className="px-4 py-8 text-center aw-text-tertiary">
                                  {t('portfolioReview.noPositionReviews')}
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
                                          ? 'cursor-pointer hover:bg-aw-surface-3 hover:border-l-aw-accent-mist border-l-transparent' 
                                          : 'opacity-70 border-l-transparent'
                                      }`}
                                      title={isClickable ? t('portfolioReview.openHoldingAnalysisTitle') : t('portfolioReview.holdingNotMatchedTitle')}
                                    >
                                      <td className="px-4 py-3 font-mono font-semibold">
                                        <div className="flex flex-col">
                                          <span className="aw-text-primary text-xs">{pos.symbol}</span>
                                          {pos.name && pos.name !== pos.symbol && (
                                            <span className="aw-caption aw-text-tertiary font-sans truncate max-w-[120px]">{pos.name}</span>
                                          )}
                                          {pos.accountName && (
                                            <span className="aw-caption tracking-wide aw-text-tertiary font-mono">({pos.accountName})</span>
                                          )}
                                        </div>
                                      </td>
                                      <td className="px-4 py-3 aw-text-primary font-medium text-xs">
                                        {pos.currentRole}
                                      </td>
                                      <td className="px-4 py-3">
                                        <span className={`px-2 py-0.5 rounded aw-caption border font-medium ${
                                          ['增持', '继续持有'].includes(pos.recommendation)
                                            ? 'bg-aw-success/10 text-aw-success border-aw-success/30'
                                            : ['观察等待'].includes(pos.recommendation)
                                              ? 'bg-aw-warning/10 text-aw-warning border-aw-warning/30'
                                              : 'bg-aw-danger/10 text-aw-danger border-aw-danger/30'
                                        }`}>
                                          {pos.recommendation}
                                        </span>
                                      </td>
                                      <td className="px-4 py-3 font-medium">
                                        <span className={`aw-caption font-mono ${pos.recommendationStrength === '强' ? 'text-aw-accent-mist font-bold' : 'aw-text-tertiary'}`}>
                                          {pos.recommendationStrength}
                                        </span>
                                      </td>
                                      <td className="px-4 py-3 text-xs font-mono">
                                        {pos.horizon}
                                      </td>
                                      <td className="px-4 py-3 text-xs aw-text-primary max-w-[220px] truncate" title={pos.actionEvaluation}>
                                        {pos.actionEvaluation}
                                      </td>
                                      <td className="px-4 py-3 text-right">
                                        {isClickable ? (
                                          <span className="aw-caption font-mono text-aw-accent-mist opacity-60 group-hover:opacity-100 group-hover:underline transition-all whitespace-nowrap">
                                            {t('portfolioReview.viewSingleAssetAnalysis')} →
                                          </span>
                                        ) : (
                                          <span className="aw-caption font-mono aw-text-tertiary whitespace-nowrap" title={t('portfolioReview.holdingNotMatchedTitle')}>
                                            {t('portfolioReview.currentHoldingMissing')}
                                          </span>
                                        )}
                                      </td>
                                    </tr>
                                    {/* Deep details subrow */}
                                    <tr className="bg-aw-surface-3">
                                      <td colSpan={7} className="px-4 py-2 border-b border-aw-border-subtle font-sans leading-relaxed text-xs aw-text-tertiary">
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-1.5">
                                          <div>
                                            <strong className="font-mono text-aw-success/90 font-medium mr-1.5 inline-flex items-center gap-1">
                                              <MaterialIcon name="adjust" size={16} />
                                              {t('portfolioReview.triggerConditionsLabel')} [TriggerConditions]:
                                            </strong>
                                            <div className="inline-block">{pos.triggerConditions.join(' / ') || t('portfolioReview.noTriggerSignals')}</div>
                                          </div>
                                          <div>
                                            <strong className="font-mono text-aw-danger/90 font-medium mr-1.5 inline-flex items-center gap-1">
                                              <MaterialIcon name="warning" size={16} />
                                              {t('portfolioReview.invalidationConditionsLabel')} [InvalidationConditions]:
                                            </strong>
                                            <div className="inline-block">{pos.invalidationConditions.join(' / ') || t('portfolioReview.noInvalidationConditions')}</div>
                                          </div>
                                        </div>
                                        {pos.risks && pos.risks.length > 0 && (
                                          <div className="mt-1 border-t border-aw-border-subtle pt-1.5 flex items-start gap-1">
                                            <strong className="font-mono text-aw-warning/80 font-medium mr-1.5 shrink-0 inline-flex items-center gap-1">
                                              <MaterialIcon name="shield_alert" size={16} />
                                              {t('portfolioReview.singleAssetRisksLabel')} [Risks]:
                                            </strong>
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
                    <h3 className="text-xs font-bold aw-text-primary uppercase tracking-widest font-mono flex items-center gap-2">
                      <MaterialIcon name="layers" size={16} className="text-aw-accent-mist" />
                      {t('portfolioReview.actionPlanBlueprints')}
                    </h3>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {/* Short Term */}
                      <div className="bg-aw-surface-1 border border-aw-success/30 rounded-xl p-4 space-y-3 flex flex-col justify-between">
                        <div className="space-y-3">
                          <div className="flex items-center justify-between border-b border-aw-border pb-2">
                            <span className="aw-caption font-bold font-mono tracking-widest text-aw-success uppercase flex items-center gap-1.5">
                              <MaterialIcon name="security" size={16} className="text-aw-success" />
                              {t('portfolioReview.shortTermTitle')}
                            </span>
                            <span className="aw-caption aw-text-tertiary font-mono">{t('portfolioReview.shortTermRange')}</span>
                          </div>
                          <div className="space-y-3.5">
                            {activeSession.report.actionPlan.shortTerm.length === 0 ? (
                              <p className="aw-text-tertiary text-xs italic">{t('portfolioReview.noShortTermActions')}</p>
                            ) : (
                              activeSession.report.actionPlan.shortTerm.map((act, idx) => (
                                <div key={idx} className="space-y-1">
                                  <div className="flex items-center justify-between">
                                    <span className="aw-text-primary text-xs font-bold">{act.title}</span>
                                    <span className={`aw-caption font-mono px-1 rounded uppercase ${act.priority === 'high' ? 'bg-aw-danger/10 text-aw-danger' : 'bg-aw-surface-3/10 aw-text-tertiary'}`}>{act.priority}</span>
                                  </div>
                                  <p className="text-xs aw-text-tertiary leading-relaxed">{act.rationale}</p>
                                  {act.triggerCondition && (
                                    <div className="aw-caption text-aw-accent-mist/90 bg-aw-surface-3 px-2 py-1 rounded font-mono border border-aw-border-subtle mt-1">
                                      {t('portfolioReview.triggerConditionLabel')}: {act.triggerCondition}
                                    </div>
                                  )}
                                </div>
                              ))
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Mid Term */}
                      <div className="bg-aw-surface-1 border border-aw-border-subtle rounded-xl p-4 space-y-3 flex flex-col justify-between">
                        <div className="space-y-3">
                          <div className="flex items-center justify-between border-b border-aw-border pb-2">
                            <span className="aw-caption font-bold font-mono tracking-widest aw-text-primary uppercase flex items-center gap-1.5">
                              <MaterialIcon name="tune" size={16} className="aw-text-primary" />
                              {t('portfolioReview.midTermTitle')}
                            </span>
                            <span className="aw-caption aw-text-tertiary font-mono">{t('portfolioReview.midTermRange')}</span>
                          </div>
                          <div className="space-y-3.5">
                            {activeSession.report.actionPlan.midTerm.length === 0 ? (
                              <p className="aw-text-tertiary text-xs italic">{t('portfolioReview.noMidTermActions')}</p>
                            ) : (
                              activeSession.report.actionPlan.midTerm.map((act, idx) => (
                                <div key={idx} className="space-y-1">
                                  <div className="flex items-center justify-between">
                                    <span className="aw-text-primary text-xs font-bold">{act.title}</span>
                                    <span className={`aw-caption font-mono px-1 rounded uppercase ${act.priority === 'high' ? 'bg-aw-danger/10 text-aw-danger' : 'bg-aw-surface-3/10 aw-text-tertiary'}`}>{act.priority}</span>
                                  </div>
                                  <p className="text-xs aw-text-tertiary leading-relaxed">{act.rationale}</p>
                                  {act.triggerCondition && (
                                    <div className="aw-caption text-aw-accent-mist/90 bg-aw-surface-3 px-2 py-1 rounded font-mono border border-aw-border-subtle mt-1">
                                      {t('portfolioReview.triggerConditionLabel')}: {act.triggerCondition}
                                    </div>
                                  )}
                                </div>
                              ))
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Long Term */}
                      <div className="bg-aw-surface-1 border border-aw-info/30 rounded-xl p-4 space-y-3 flex flex-col justify-between">
                        <div className="space-y-3">
                          <div className="flex items-center justify-between border-b border-aw-border pb-2">
                            <span className="aw-caption font-bold font-mono tracking-widest text-aw-info uppercase flex items-center gap-1.5">
                              <MaterialIcon name="account_tree" size={16} className="text-aw-info" />
                              {t('portfolioReview.longTermTitle')}
                            </span>
                            <span className="aw-caption aw-text-tertiary font-mono">{t('portfolioReview.longTermRange')}</span>
                          </div>
                          <div className="space-y-3.5">
                            {activeSession.report.actionPlan.longTerm.length === 0 ? (
                              <p className="aw-text-tertiary text-xs italic">{t('portfolioReview.noLongTermActions')}</p>
                            ) : (
                              activeSession.report.actionPlan.longTerm.map((act, idx) => (
                                <div key={idx} className="space-y-1">
                                  <div className="flex items-center justify-between">
                                    <span className="aw-text-primary text-xs font-bold">{act.title}</span>
                                    <span className={`aw-caption font-mono px-1 rounded uppercase ${act.priority === 'high' ? 'bg-aw-danger/10 text-aw-danger' : 'bg-aw-surface-3/10 aw-text-tertiary'}`}>{act.priority}</span>
                                  </div>
                                  <p className="text-xs aw-text-tertiary leading-relaxed">{act.rationale}</p>
                                  {act.triggerCondition && (
                                    <div className="aw-caption text-aw-accent-mist/90 bg-aw-surface-3 px-2 py-1 rounded font-mono border border-aw-border-subtle mt-1">
                                      {t('portfolioReview.triggerConditionLabel')}: {act.triggerCondition}
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
                    <div className="border border-aw-border bg-aw-surface-1 rounded-xl p-4 space-y-2">
                      <h4 className="text-xs font-mono font-bold text-aw-accent-mist uppercase tracking-wider flex items-center gap-1.5">
                        <MaterialIcon name="info" size={16} className="shrink-0 text-aw-accent-mist/80" />
                        {t('portfolioReview.nextReviewNeedsTitle')}
                      </h4>
                      <ul className="text-xs aw-text-tertiary space-y-1.5 font-light leading-relaxed">
                        {activeSession.report.nextReviewNeeds.map((need, idx) => (
                          <li key={idx} className="flex items-start gap-1.5">
                            <span className="text-aw-accent-mist/60 font-bold">•</span>
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
                    <div className="border border-aw-warning/30 bg-aw-warning/10 rounded-xl p-4 space-y-2">
                      <h4 className="text-xs font-mono font-bold text-aw-warning/90 uppercase tracking-widest flex items-center gap-1.5">
                        <MaterialIcon name="shield_alert" size={16} className="shrink-0" />
                        {t('portfolioReview.warningsTitle')}
                      </h4>
                      <ul className="text-xs aw-text-tertiary space-y-1 font-light leading-relaxed">
                        {currentSnapshot.warnings.map((w, idx) => (
                          <li key={idx} className="flex items-start gap-1">
                            <span className="text-aw-warning/70 select-none">•</span>
                            <span>{w}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Time reference banner */}
                  <div className="bg-aw-surface-1 border border-aw-border-subtle rounded-xl px-4 py-3 flex flex-wrap items-center justify-between gap-3 text-xs">
                    <div className="flex items-center gap-2 aw-text-tertiary">
                      <MaterialIcon name="calendar_month" size={16} className="text-aw-accent-mist/50" />
                      <span>{t('portfolioReview.reviewCycle')}</span>
                    </div>
                    <div className="flex items-center gap-2 aw-text-primary font-mono">
                      {previousSnapshot ? (
                        <>
                          <span className="aw-text-tertiary">{formatDate(previousSnapshot.createdAt)}</span>
                          <span className="text-aw-accent-mist/50">➔</span>
                          <span>{formatDate(currentSnapshot?.createdAt || Date.now())}</span>
                        </>
                      ) : (
                        <span>{t('portfolioReview.firstSnapshotAt')} {formatDate(currentSnapshot?.createdAt || Date.now())}</span>
                      )}
                    </div>
                  </div>

                  {/* Deltas detailed audit logging list (Previous vs Current) */}
                  <div className="space-y-3">
                    <h3 className="text-xs font-bold aw-text-primary uppercase tracking-widest font-mono flex items-center gap-2">
                      <MaterialIcon name="monitoring" size={16} className="text-aw-accent-mist" />
                      {t('portfolioReview.deltaTableTitle')}
                    </h3>

                    <div className="border border-aw-border-subtle rounded-xl overflow-hidden bg-aw-surface-1">
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs border-collapse min-w-[700px]">
                          <thead>
                            <tr className="bg-aw-surface-3 border-b border-aw-border-subtle aw-text-tertiary font-mono aw-caption uppercase tracking-wider">
                              <th className="px-4 py-3 font-medium">{t('portfolioReview.accountColumn')}</th>
                              <th className="px-4 py-3 font-medium">{t('portfolioReview.assetCodeColumn')}</th>
                              <th className="px-4 py-3 font-medium">{t('portfolioReview.stepColumn')}</th>
                              <th className="px-4 py-3 font-medium text-right">{t('portfolioReview.previousQuantityColumn')}</th>
                              <th className="px-4 py-3 font-medium text-right">{t('portfolioReview.currentQuantityColumn')}</th>
                              <th className="px-4 py-3 font-medium text-right">{t('portfolioReview.quantityDeltaColumn')}</th>
                              <th className="px-4 py-3 font-medium text-right">{t('portfolioReview.previousMarketValueColumn')}</th>
                              <th className="px-4 py-3 font-medium text-right">{t('portfolioReview.currentMarketValueColumn')}</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-aw-border-subtle font-light aw-text-primary">
                            {deltas.length === 0 ? (
                              <tr>
                                <td colSpan={8} className="px-4 py-8 text-center aw-text-tertiary">
                                  {t('portfolioReview.noDeltas')}
                                </td>
                              </tr>
                            ) : (
                              deltas.map((delta, index) => (
                                <React.Fragment key={index}>
                                  <tr className="hover:bg-aw-surface-3 transition-colors">
                                    <td className="px-4 py-3 truncate max-w-[150px] font-medium aw-text-tertiary">
                                      {delta.accountName || delta.accountId || t('portfolioReview.defaultAccount')}
                                    </td>
                                    <td className="px-4 py-3 font-mono font-semibold">
                                      <div className="flex flex-col">
                                        <span className="aw-text-primary text-xs">{delta.symbol}</span>
                                        {delta.name && delta.name !== delta.symbol && (
                                          <span className="aw-caption aw-text-tertiary font-sans truncate max-w-[120px]">{delta.name}</span>
                                        )}
                                      </div>
                                    </td>
                                    <td className="px-4 py-3">
                                      {getActionTypeBadge(delta.actionType)}
                                    </td>
                                    <td className="px-4 py-3 text-right font-mono aw-text-tertiary">
                                      {delta.previousQuantity !== undefined ? delta.previousQuantity.toLocaleString() : '0'}
                                    </td>
                                    <td className="px-4 py-3 text-right font-mono">
                                      {delta.currentQuantity !== undefined ? delta.currentQuantity.toLocaleString() : '0'}
                                    </td>
                                    <td className={`px-4 py-3 text-right font-mono font-medium ${
                                      (delta.quantityDelta || 0) > 0 ? 'text-aw-success' : (delta.quantityDelta || 0) < 0 ? 'text-aw-danger' : 'aw-text-tertiary'
                                    }`}>
                                      {(delta.quantityDelta || 0) > 0 ? '+' : ''}{(delta.quantityDelta || 0).toLocaleString()}
                                    </td>
                                    <td className="px-4 py-3 text-right font-mono aw-text-tertiary">
                                      ${delta.previousMarketValue !== undefined ? delta.previousMarketValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0.00'}
                                    </td>
                                    <td className="px-4 py-3 text-right font-mono text-aw-accent-mist">
                                      ${delta.currentMarketValue !== undefined ? delta.currentMarketValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0.00'}
                                    </td>
                                  </tr>
                                  {/* Reason log sub-row */}
                                  <tr className="bg-aw-surface-3">
                                    <td colSpan={8} className="px-4 py-1.5 aw-caption aw-text-tertiary border-b border-aw-border-subtle font-sans leading-relaxed">
                                      <span className="font-mono text-aw-accent-mist/50 select-none mr-1.5">[DIAGNOSTIC]</span>
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
          <div className="p-6 bg-aw-surface-0 border-t border-aw-border space-y-3">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="space-y-0.5 text-center sm:text-left">
                <h4 className="text-xs font-bold aw-text-primary flex items-center justify-center sm:justify-start gap-1.5">
                  <MaterialIcon name="auto_awesome" size={16} className="text-aw-accent-mist" />
                  {t('portfolioReview.footerTitle')}
                </h4>
                <p className="aw-caption aw-text-tertiary leading-relaxed max-w-md">
                  {t('portfolioReview.footerDesc')}
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
                  className="w-full sm:w-auto px-5 py-2.5 bg-aw-surface-3 hover:bg-aw-surface-3 border border-aw-border-strong text-aw-accent-mist disabled:opacity-50 disabled:cursor-not-allowed text-xs font-mono tracking-wider font-semibold uppercase rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1.5"
                >
                  {activeSession.status === 'analyzing' ? (
                    <>
                      <div className="w-3 h-3 rounded-full border-2 border-aw-border border-t-aw-accent-mist animate-spin" />
                      <span>{t('portfolioReview.diagnosing')}</span>
                    </>
                  ) : activeSession.report ? (
                    <>
                      <MaterialIcon name="auto_awesome" size={16} className="text-aw-accent-mist" />
                      <span>{t('portfolioReview.regenerateReport')}</span>
                    </>
                  ) : (
                    <>
                      <MaterialIcon name="auto_awesome" size={16} className="text-aw-accent-mist" />
                      <span>{t('portfolioReview.generateReport')}</span>
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
