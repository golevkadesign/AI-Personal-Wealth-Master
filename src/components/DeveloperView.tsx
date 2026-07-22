import React, { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { auth } from '../lib/firebase';
import { useWealthStore } from '../hooks/useWealthStore';
import { getSettings, saveSettings } from '../lib/settings';
import { DEFAULT_PROMPTS, DEFAULT_RAG_SCHEMA } from '../lib/defaultPrompts';
import { getLastSDUIIntakeDiagnostics } from '../lib/sdui-intake-policy';
import { DEVELOPER_PIPELINE_AGENT_IDS, getSharedAgentDefinition } from '../lib/agent-definitions';
import { useTranslation } from '../hooks/useTranslation';
import { MaterialIcon } from './ui/MaterialIcon';
import { useModalFocusTrap } from '../hooks/useModalFocusTrap';

const AGENTS = DEVELOPER_PIPELINE_AGENT_IDS.map(id => getSharedAgentDefinition(id));

interface DeveloperViewProps {
  isOpen: boolean;
  onClose: () => void;
  onClearData?: () => void;
}

type DeveloperTab = 'state' | 'pipeline';

export const DeveloperView: React.FC<DeveloperViewProps> = ({
  isOpen,
  onClose,
  onClearData
}) => {
  const { t } = useTranslation();
  const dialogRef = useModalFocusTrap<HTMLDivElement>({ active: isOpen, onEscape: onClose });
  const user = useWealthStore(s => s.user);
  const state = useWealthStore(s => s.data);
  const commitData = useWealthStore(s => s.commitData);
  const refreshDashboardProjection = useWealthStore(s => s.refreshDashboardProjection);
  const fetchMarketContext = useWealthStore(s => s.fetchMarketContext);
  const marketContextStatus = useWealthStore(s => s.marketContextStatus);
  const marketContextError = useWealthStore(s => s.marketContextError);

  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [editProfileData, setEditProfileData] = useState<any>({});
  const [selectedSection, setSelectedSection] = useState<string | null>(null);
  const [copiedUid, setCopiedUid] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [isCopiedMc, setIsCopiedMc] = useState(false);
  const [activeTab, setActiveTab] = useState<DeveloperTab>('state');
  const [activeAgentId, setActiveAgentId] = useState<string>('orchestrator');
  const [isEditingPrompt, setIsEditingPrompt] = useState(false);
  const [editContent, setEditContent] = useState('');
  const [localSettings, setLocalSettings] = useState(getSettings());

  useEffect(() => {
    if (isOpen) {
      setEditProfileData({
        name: user?.name || user?.displayName || auth.currentUser?.displayName || t('developerView.defaultName'),
        email: user?.email || auth.currentUser?.email || t('developerView.defaultEmail'),
        currency: user?.currency || '',
        riskProfile: user?.riskProfile || '',
        investmentHorizon: user?.investmentHorizon || '',
        dataSource: user?.dataSource || '',
        createdAt: user?.createdAt || '',
        updatedAt: user?.updatedAt || '',
        ...user
      });
      setIsEditingProfile(false);
      setSelectedSection(null);
      setCopiedUid(false);
      setLocalSettings(getSettings());
      setIsEditingPrompt(false);
    }
  }, [isOpen, user]);

  const activeAgent = AGENTS.find(agent => agent.id === activeAgentId) || AGENTS[0];

  const counts = useMemo(() => {
    const userCount = Object.keys(user || {}).length;
    const metricCount = Object.keys(state?.metrics || {}).length;
    const distributionCount = Object.values(state?.distributions || {}).reduce(
      (acc: number, value: any) => acc + (Array.isArray(value) ? value.length : 0),
      0
    );
    const insightCount = Object.keys(state?.insights || {}).filter(key => state?.insights?.[key]).length;
    const goalActive = state?.goal?.name ? 1 : 0;
    const widgetCount = state?.dynamicWidgets?.length ?? 0;
    const marketContextInstruments = Array.isArray(state?.marketContext?.instruments)
      ? state.marketContext.instruments
      : Array.isArray((state?.marketContext as any)?.keyInstruments)
        ? (state?.marketContext as any).keyInstruments
        : [];

    return {
      userProfile: `${userCount} ${t('developerView.fields')}`,
      metrics: `${metricCount} ${t('developerView.metrics')}`,
      distributions: `${distributionCount} ${t('developerView.items')}`,
      insights: `${insightCount} ${t('developerView.items')}`,
      goal: `${goalActive} ${t('developerView.active')}`,
      dynamicWidgets: `${widgetCount} ${t('developerView.widgets')}`,
      marketContext: state?.marketContext
        ? `${marketContextInstruments.length} ${t('developerView.instruments')}`
        : t('developerView.notLoaded')
    };
  }, [state, t, user]);

  const sduiDiagnostics = useMemo(() => {
    if (!isOpen) return null;
    return getLastSDUIIntakeDiagnostics();
  }, [isOpen, state?.dynamicWidgets]);

  const marketContext = state?.marketContext;
  const marketContextInstruments = Array.isArray(marketContext?.instruments)
    ? marketContext.instruments
    : Array.isArray((marketContext as any)?.keyInstruments)
      ? (marketContext as any).keyInstruments
      : [];
  const marketContextSignals = Array.isArray(marketContext?.crossAssetSignals) ? marketContext.crossAssetSignals : [];
  const marketContextWarnings = Array.isArray(marketContext?.warnings) ? marketContext.warnings : [];
  const marketContextSourceSummary = Array.isArray(marketContext?.sourceSummary) ? marketContext.sourceSummary : [];

  const jsonCodeLines = useMemo(() => {
    let subset: any;
    if (!selectedSection) {
      subset = {
        userProfile: `... ${counts.userProfile}`,
        metrics: `... ${counts.metrics}`,
        distributions: `... ${counts.distributions}`,
        insights: `... ${counts.insights}`,
        goal: `... ${counts.goal}`,
        dynamicWidgets: `... ${counts.dynamicWidgets}`,
        marketContext: `... ${counts.marketContext}`
      };
    } else if (selectedSection === 'userProfile') {
      subset = { userProfile: user || {} };
    } else if (selectedSection === 'metrics') {
      subset = { metrics: state?.metrics || {} };
    } else if (selectedSection === 'distributions') {
      subset = { distributions: state?.distributions || {} };
    } else if (selectedSection === 'insights') {
      subset = { insights: state?.insights || {} };
    } else if (selectedSection === 'goal') {
      subset = { goal: state?.goal || {} };
    } else if (selectedSection === 'dynamicWidgets') {
      subset = { dynamicWidgets: state?.dynamicWidgets || [] };
    } else {
      subset = {
        marketContext: state?.marketContext || null,
        marketContextLastFetchedAt: state?.marketContextLastFetchedAt || null,
        marketContextStatus,
        marketContextError
      };
    }
    return JSON.stringify(subset, null, 2).split('\n');
  }, [selectedSection, user, state, counts, marketContextStatus, marketContextError]);

  const profileFields = [
    { key: 'name', label: t('developerView.name'), type: 'text' },
    { key: 'email', label: t('developerView.email'), type: 'email' },
    { key: 'currency', label: t('developerView.currency'), type: 'text' },
    { key: 'riskProfile', label: t('developerView.riskProfile'), type: 'text' },
    { key: 'investmentHorizon', label: t('developerView.investmentHorizon'), type: 'text' },
    { key: 'dataSource', label: t('developerView.dataSource'), type: 'text' },
    { key: 'createdAt', label: t('developerView.createdAt'), type: 'text' },
    { key: 'updatedAt', label: t('developerView.updatedAt'), type: 'text' },
  ];

  const stateRows = [
    { id: 'userProfile', name: 'userProfile', count: counts.userProfile, icon: 'person', badge: 'valid', status: 'success' },
    { id: 'metrics', name: 'metrics', count: counts.metrics, icon: 'query_stats', badge: 'ok', status: 'success' },
    { id: 'distributions', name: 'distributions', count: counts.distributions, icon: 'donut_large', badge: 'ok', status: 'success' },
    { id: 'insights', name: 'insights', count: counts.insights, icon: 'auto_awesome', badge: 'ok', status: 'success' },
    { id: 'goal', name: 'goal', count: counts.goal, icon: 'track_changes', badge: 'partial', status: 'warning' },
    { id: 'dynamicWidgets', name: 'dynamicWidgets', count: counts.dynamicWidgets, icon: 'tune', badge: 'ok', status: 'success' },
    {
      id: 'marketContext',
      name: 'marketContext',
      count: counts.marketContext,
      icon: 'monitoring',
      badge: state?.marketContext ? (marketContextStatus === 'error' ? 'error' : 'ready') : 'empty',
      status: marketContextStatus === 'error' ? 'danger' : state?.marketContext ? 'success' : 'info'
    }
  ];

  const getCurrentAgentContent = (agent: typeof activeAgent) => {
    if (agent.type === 'rag') return localSettings.ragSchema || DEFAULT_RAG_SCHEMA;
    if (agent.type === 'llm') return localSettings.agentPrompts?.[agent.id] || (DEFAULT_PROMPTS as any)[agent.id] || '';
    return 'DETERMINISTIC_MIDDLEWARE_LAYER:\nThis node interprets and routes extracted context. No stochastic LLM prompt is executed here.';
  };

  const flashSaved = () => {
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3000);
  };

  const handleCopyUid = () => {
    const uid = auth.currentUser?.uid;
    if (!uid) return;
    navigator.clipboard.writeText(uid);
    setCopiedUid(true);
    setTimeout(() => setCopiedUid(false), 2000);
  };

  const handleSaveProfile = () => {
    commitData((prev: any) => ({
      ...prev,
      userProfile: editProfileData
    }));
    void refreshDashboardProjection('profile_update');
    setIsEditingProfile(false);
    flashSaved();
  };

  const handleEditPrompt = () => {
    setEditContent(getCurrentAgentContent(activeAgent));
    setIsEditingPrompt(true);
  };

  const handleSavePrompt = () => {
    const newSettings = { ...localSettings };
    if (activeAgent.type === 'rag') {
      newSettings.ragSchema = editContent;
    } else if (activeAgent.type === 'llm') {
      newSettings.agentPrompts = {
        ...newSettings.agentPrompts,
        [activeAgent.id]: editContent
      };
    }
    saveSettings(newSettings);
    setLocalSettings(newSettings);
    setIsEditingPrompt(false);
    flashSaved();
  };

  const handleRestoreDefault = () => {
    const newSettings = { ...localSettings };
    if (activeAgent.type === 'rag') {
      newSettings.ragSchema = DEFAULT_RAG_SCHEMA;
    } else if (activeAgent.type === 'llm' && newSettings.agentPrompts) {
      delete newSettings.agentPrompts[activeAgent.id];
    }
    saveSettings(newSettings);
    setLocalSettings(newSettings);
    setIsEditingPrompt(false);
    flashSaved();
  };

  const statusDotClass = (status: string) => {
    if (status === 'success') return 'aw-status-success';
    if (status === 'warning') return 'aw-status-warning';
    if (status === 'danger') return 'aw-status-danger';
    return 'aw-status-info';
  };

  const formatTime = (ts?: number) => {
    if (!ts) return t('developerView.never');
    try {
      return new Date(ts).toLocaleString();
    } catch {
      return t('developerView.invalidTime');
    }
  };

  const renderStateTab = () => (
    <div className="flex min-h-0 flex-1 flex-col md:flex-row overflow-hidden">
      <aside className="aw-dev-pane w-full md:w-[38%] max-h-[50%] md:max-h-full border-b md:border-b-0 md:border-r flex flex-col overflow-y-auto custom-scroll p-6 sm:p-7 shrink-0">
        <div className="flex items-center gap-2 mb-6 shrink-0">
          <MaterialIcon name="person" size={20} className="text-aw-accent-mist" />
          <h3 className="aw-section-kicker">{t('developerView.userProfileDebug')}</h3>
        </div>

        <div className="space-y-4 flex-1 pb-6">
          <div>
            <label className="aw-form-label block mb-2">{t('developerView.userId')}</label>
            <div className="aw-panel-muted flex items-center justify-between px-3 py-2">
              <span className="aw-caption aw-text-tertiary font-mono truncate">
                {auth.currentUser?.uid ? `${auth.currentUser.uid.slice(0, 14)}...` : t('developerView.unavailable')}
              </span>
              <button type="button" onClick={handleCopyUid} disabled={!auth.currentUser?.uid} className="aw-icon-button disabled:opacity-40" title={t('developerView.copyUserId')} aria-label={t('developerView.copyUserId')}>
                <MaterialIcon name={copiedUid ? 'check' : 'content_copy'} size={20} className={copiedUid ? 'text-aw-success' : ''} />
              </button>
            </div>
          </div>

          {profileFields.map(field => {
            const rawValue = editProfileData[field.key] || '';
            const displayValue = field.key === 'email' && !isEditingProfile && rawValue
              ? rawValue.replace(/(.{3})(.*)(@.*)/, "$1...$3")
              : rawValue;

            return (
              <div key={field.key}>
                <label className="aw-form-label block mb-2">{field.label}</label>
                <input
                  type={field.type}
                  value={displayValue}
                  disabled={!isEditingProfile}
                  readOnly={!isEditingProfile}
                  onChange={event => setEditProfileData((prev: any) => ({ ...prev, [field.key]: event.target.value }))}
                  className="aw-form-input font-mono"
                />
              </div>
            );
          })}
        </div>

        <div className="mt-auto border-t border-aw-border-subtle pt-6 shrink-0">
          <div className="aw-panel-muted p-4">
            <div className="flex items-start gap-3">
              <div className="aw-chart-state-icon h-8 w-8 shrink-0">
                <MaterialIcon name="edit" size={20} className="text-aw-accent-mist" />
              </div>
              <div>
                <h4 className="aw-body aw-text-primary font-medium">{t('developerView.updateProfile')}</h4>
                <p className="aw-caption aw-text-tertiary mt-1">{t('developerView.updateProfileDesc')}</p>
              </div>
            </div>
            <div className="mt-4 flex gap-2">
              {isEditingProfile ? (
                <>
                  <button type="button" onClick={handleSaveProfile} className="aw-button aw-button-primary flex-1 cursor-pointer">{t('developerView.saveInputs')}</button>
                  <button type="button" onClick={() => { setEditProfileData({ ...user }); setIsEditingProfile(false); }} className="aw-button aw-button-ghost cursor-pointer">{t('developerView.cancel')}</button>
                </>
              ) : (
                <button type="button" onClick={() => setIsEditingProfile(true)} className="aw-button aw-button-ghost w-full cursor-pointer">
                  <MaterialIcon name="edit" size={16} />
                  {t('developerView.editProfile')}
                </button>
              )}
            </div>
          </div>
        </div>
      </aside>

      <section className="flex-1 flex flex-col overflow-y-auto p-6 sm:p-7 custom-scroll">
        <div className="mb-2 flex items-center justify-between gap-4 shrink-0">
          <div className="flex items-center gap-2">
            <MaterialIcon name="database" size={20} className="text-aw-accent-mist" />
            <h3 className="aw-section-kicker">{t('developerView.dataInspector')}</h3>
          </div>
          <button type="button" onClick={() => setSelectedSection(null)} className="aw-button aw-button-ghost !min-h-8 cursor-pointer">
            <MaterialIcon name="refresh" size={16} />
            {t('developerView.refresh')}
          </button>
        </div>
        <p className="aw-caption aw-text-tertiary mb-6">{t('developerView.liveSnapshot')}</p>

        <div className="aw-panel-muted mb-5 p-4">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h4 className="aw-body aw-text-primary font-medium">{t('developerView.marketContextDebug')}</h4>
              <p className="aw-caption aw-text-tertiary mt-1">Delayed / historical market context, not execution-grade quote data.</p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                disabled={marketContextStatus === 'loading'}
                onClick={async () => {
                  try {
                    await fetchMarketContext({ forceRefresh: true });
                  } catch (error) {
                    console.error(error);
                  }
                }}
                className="aw-button aw-button-ghost !min-h-8 cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
              >
                {marketContextStatus === 'loading' ? t('developerView.refreshing') : t('developerView.forceRefresh')}
              </button>
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(JSON.stringify({
                    marketContext: state?.marketContext || null,
                    marketContextLastFetchedAt: state?.marketContextLastFetchedAt || null,
                    marketContextStatus,
                    marketContextError
                  }, null, 2));
                  setIsCopiedMc(true);
                  setTimeout(() => setIsCopiedMc(false), 2000);
                }}
                className="aw-button aw-button-ghost !min-h-8 cursor-pointer"
              >
                {isCopiedMc ? t('developerView.copied') : t('developerView.copyJson')}
              </button>
            </div>
          </div>

          <div className="aw-panel-muted mb-4 grid grid-cols-2 gap-3 p-3 font-mono sm:grid-cols-3">
            {[
              ['status', t('developerView.status'), marketContextStatus || t('developerView.idle')],
              ['freshness', t('developerView.freshness'), marketContext?.freshness || 'N/A'],
              ['dataQuality', t('developerView.dataQuality'), marketContext?.dataQuality || 'N/A'],
              ['riskMode', t('developerView.riskMode'), marketContext?.regime?.riskMode || t('developerView.unknown')],
              ['instruments', t('developerView.instruments'), String(marketContextInstruments.length)],
              ['signals', t('developerView.signals'), String(marketContextSignals.length)],
              ['lastFetched', t('developerView.lastFetched'), formatTime(state?.marketContextLastFetchedAt)],
            ].map(([id, label, value]) => (
              <div key={id} className={id === 'lastFetched' ? 'col-span-2 sm:col-span-3' : ''}>
                <div className="aw-caption aw-text-tertiary uppercase">{label}</div>
                <div className="aw-body aw-text-secondary mt-1 font-semibold">{value}</div>
              </div>
            ))}
          </div>

          {marketContextError && (
            <div className="aw-danger-panel mb-4 p-3 aw-caption text-aw-danger font-mono">
              {t('developerView.error')}: {marketContextError}
            </div>
          )}

          <div className="space-y-2 aw-caption aw-text-secondary font-mono">
            {marketContextSourceSummary.length > 0 && (
              <div><span className="aw-text-tertiary font-semibold">{t('developerView.sources')}:</span> {marketContextSourceSummary.slice(0, 2).join(', ')}</div>
            )}
            {marketContextWarnings.length > 0 ? (
              <div>
                <div className="aw-text-tertiary font-semibold mb-1">{t('developerView.recentWarnings')}:</div>
                <ul className="list-disc pl-4 space-y-1">
                  {marketContextWarnings.slice(0, 2).map((warning: string, index: number) => <li key={index}>{warning}</li>)}
                </ul>
              </div>
            ) : (
              <div className="aw-text-tertiary">No active warnings.</div>
            )}
          </div>
        </div>

        <div className="aw-panel-muted mb-5 p-4">
          <div className="mb-3 flex items-center gap-2">
            <MaterialIcon name="tune" size={20} className="text-aw-accent-mist" />
            <h4 className="aw-body aw-text-primary font-medium">{t('developerView.intakeDiagnostics')}</h4>
          </div>
          {sduiDiagnostics ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                ['Raw Top-Level', sduiDiagnostics.rawTopLevel],
                ['Normalized', sduiDiagnostics.normalizedCount],
                ['Candidates', sduiDiagnostics.candidateCount],
                ['Unique', sduiDiagnostics.uniqueCount],
                ['Final Kept', sduiDiagnostics.finalCount],
                ['Dropped', sduiDiagnostics.droppedCount],
                ['Intervention Kept', sduiDiagnostics.interventionCardsKept],
                ['Last Updated', new Date(sduiDiagnostics.generatedAt).toLocaleTimeString()],
              ].map(([label, value]) => (
                <div key={label} className="aw-panel-muted p-3 font-mono">
                  <div className="aw-caption aw-text-tertiary uppercase">{label}</div>
                  <div className="aw-body aw-text-primary mt-1 font-semibold">{value}</div>
                </div>
              ))}
            </div>
          ) : (
            <div className="aw-caption aw-text-tertiary font-mono italic">{t('developerView.noIntake')}</div>
          )}
        </div>

        <div className="space-y-2 mb-6 shrink-0">
          {stateRows.map(row => {
            const isSelected = selectedSection === row.id;
            return (
              <button
                type="button"
                key={row.id}
                onClick={() => setSelectedSection(isSelected ? null : row.id)}
                className={`aw-panel-muted flex w-full items-center justify-between gap-4 px-4 py-3 text-left transition-colors cursor-pointer ${isSelected ? 'border-aw-border-strong' : 'hover:border-aw-border-strong'}`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <MaterialIcon name={isSelected ? 'expand_more' : 'chevron_right'} size={16} className="aw-text-tertiary" />
                  <MaterialIcon name={row.icon} size={20} className="text-aw-accent-mist shrink-0" />
                  <span className="aw-body aw-text-secondary font-mono truncate">{row.name}</span>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="aw-caption aw-text-tertiary font-mono">{row.count}</span>
                  <span className="aw-status-pill font-mono uppercase">
                    <span className={`aw-status-dot ${statusDotClass(row.status)}`} />
                    {row.badge}
                  </span>
                </div>
              </button>
            );
          })}
        </div>

        <div className="aw-dev-code flex-1 min-h-44 overflow-auto p-4 custom-scroll">
          <div className="mb-3 flex justify-end">
            {selectedSection && (
              <button type="button" onClick={() => setSelectedSection(null)} className="aw-chat-meta-action">
                <MaterialIcon name="keyboard_backspace" size={16} />
                {t('developerView.showOverview')}
              </button>
            )}
          </div>
          <table className="w-full border-collapse select-text">
            <tbody>
              {jsonCodeLines.map((line, index) => (
                <tr key={index} className="hover:bg-aw-surface-3">
                  <td className="aw-dev-line-number w-10 pr-3 text-right align-top">{index + 1}</td>
                  <td className="pl-4 pb-1 whitespace-pre select-text">{line}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );

  const renderPipelineTab = () => (
    <div className="flex min-h-0 flex-1 flex-col md:flex-row overflow-hidden">
      <aside className="aw-dev-pane w-full md:w-[38%] max-h-[40%] md:max-h-full border-b md:border-b-0 md:border-r p-6 sm:p-7 flex flex-col overflow-y-auto custom-scroll shrink-0">
        <div className="mb-6 flex items-center gap-2 shrink-0">
          <MaterialIcon name="account_tree" size={20} className="text-aw-accent-mist" />
          <h3 className="aw-section-kicker">{t('developerView.intelligencePipeline')}</h3>
        </div>
        <div className="relative flex flex-col gap-3">
          {AGENTS.map((agent, index) => {
            const isActive = activeAgentId === agent.id;
            return (
              <button
                type="button"
                key={agent.id}
                onClick={() => { setActiveAgentId(agent.id); setIsEditingPrompt(false); }}
                className={`aw-panel-muted relative z-10 flex gap-4 p-3 text-left transition-colors cursor-pointer ${isActive ? 'border-aw-border-strong' : 'hover:border-aw-border-strong'}`}
              >
                <div className="aw-chart-state-icon h-6 w-6 shrink-0 text-aw-accent-mist aw-caption font-mono">{index + 1}</div>
                <div className="flex flex-1 flex-col min-w-0">
                  <div className="mb-1 flex items-center justify-between gap-3">
                    <span className="aw-body aw-text-primary font-medium truncate">{agent.name}</span>
                    <span className="aw-caption aw-text-tertiary font-mono uppercase">{agent.type}</span>
                  </div>
                  <span className="aw-caption aw-text-tertiary font-mono truncate">{agent.role}</span>
                </div>
              </button>
            );
          })}
        </div>
      </aside>

      <section className="flex-1 flex flex-col p-6 sm:p-7 overflow-hidden">
        <div className="mb-4 flex items-center gap-2 shrink-0">
          <MaterialIcon name="settings_suggest" size={20} className="text-aw-accent-mist" />
          <h3 className="aw-section-kicker">{t('developerView.nodeConfig')}</h3>
        </div>
        <div className="mb-4">
          <h4 className="aw-label aw-text-primary font-medium">{activeAgent.name}</h4>
          <p className="aw-caption aw-text-tertiary font-mono mt-1">{t('developerView.role')}: {activeAgent.role} | {t('developerView.type')}: {activeAgent.type}</p>
        </div>

        <div className="aw-dev-code flex-1 flex flex-col overflow-hidden">
          <div className="aw-modal-header flex min-h-10 items-center justify-between gap-4 px-4 shrink-0">
            <span className="aw-caption font-mono text-aw-accent-mist uppercase flex items-center gap-2">
              <MaterialIcon name="terminal" size={16} className="aw-text-tertiary" />
              {activeAgent.type === 'rag'
                ? t('developerView.memorySchema')
                : activeAgent.type === 'middleware'
                  ? t('developerView.runtimeLogic')
                  : t('developerView.systemPrompt')}
            </span>
            {activeAgent.type !== 'middleware' && (
              <div className="flex items-center gap-3">
                {isEditingPrompt ? (
                  <>
                    <button type="button" onClick={() => setIsEditingPrompt(false)} className="aw-chat-meta-action">{t('developerView.cancelEdit')}</button>
                    <button type="button" onClick={handleSavePrompt} className="aw-button aw-button-primary !min-h-7 !px-3">{t('developerView.save')}</button>
                  </>
                ) : (
                  <>
                    <button type="button" onClick={handleRestoreDefault} className="aw-chat-meta-action text-aw-danger">
                      <MaterialIcon name="delete" size={16} /> {t('developerView.reset')}
                    </button>
                    <button type="button" onClick={handleEditPrompt} className="aw-chat-meta-action text-aw-accent-mist">
                      <MaterialIcon name="edit" size={16} /> {t('developerView.edit')}
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
          <div className="flex-1 overflow-auto custom-scroll">
            {isEditingPrompt ? (
              <textarea
                value={editContent}
                onChange={event => setEditContent(event.target.value)}
                className="aw-form-input h-full resize-none rounded-none border-0 bg-transparent p-5 font-mono"
                placeholder={t('developerView.promptPlaceholder')}
              />
            ) : (
              <div className="p-5 aw-caption aw-text-secondary font-mono leading-relaxed whitespace-pre-wrap select-text">
                {getCurrentAgentContent(activeAgent)}
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="fixed inset-0 aw-modal-backdrop z-50"
            onClick={onClose}
          />

          <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none p-4 sm:p-6 md:p-8">
            <motion.div
              ref={dialogRef}
              role="dialog"
              aria-modal="true"
              aria-labelledby="aw-developer-title"
              tabIndex={-1}
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
              className="aw-modal-shell aw-dev-shell flex flex-col pointer-events-auto overflow-hidden select-none"
            >
              <header className="aw-modal-header min-h-16 px-4 sm:min-h-20 sm:px-8 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-6">
                  <div className="hidden sm:flex items-center gap-4 border-r border-aw-border-subtle pr-6">
                    <div className="aw-chart-state-icon h-10 w-10">
                      <MaterialIcon name="memory" size={24} className="text-aw-accent-mist animate-pulse" />
                    </div>
                    <div>
                      <h2 id="aw-developer-title" className="aw-label aw-text-primary font-serif font-medium">{t('developerView.title')}</h2>
                      <p className="aw-caption aw-text-tertiary font-mono uppercase mt-1">{t('developerView.subtitle')}</p>
                    </div>
                  </div>

                  <div className="aw-panel-muted flex p-1">
                    <button type="button" onClick={() => setActiveTab('state')} className={`aw-dev-tab cursor-pointer ${activeTab === 'state' ? 'aw-dev-tab-active' : ''}`}>
                      <MaterialIcon name="database" size={16} className="hidden sm:inline-flex" />
                      {t('developerView.stateData')}
                    </button>
                    <button type="button" onClick={() => setActiveTab('pipeline')} className={`aw-dev-tab cursor-pointer ${activeTab === 'pipeline' ? 'aw-dev-tab-active' : ''}`}>
                      <MaterialIcon name="account_tree" size={16} className="hidden sm:inline-flex" />
                      {t('developerView.pipeline')}
                    </button>
                  </div>
                </div>

                <button type="button" onClick={onClose} className="aw-icon-button cursor-pointer" aria-label={t('developerView.close')}>
                  <MaterialIcon name="close" size={20} />
                </button>
              </header>

              {activeTab === 'state' ? renderStateTab() : renderPipelineTab()}

              <footer className="aw-modal-footer min-h-20 px-6 sm:px-8 border-t flex items-center justify-between shrink-0 relative">
                {saveSuccess && (
                  <div className="absolute -top-12 left-1/2 -translate-x-1/2 aw-panel-muted px-4 py-2 aw-caption text-aw-success font-mono flex items-center gap-2 animate-bounce">
                    <MaterialIcon name="verified" size={16} />
                    {activeTab === 'state' ? t('developerView.stateSaved') : t('developerView.configSaved')}
                  </div>
                )}

                <div>
                  {onClearData && activeTab === 'state' && (
                    <button type="button" onClick={onClearData} className="aw-button border border-aw-danger text-aw-danger hover:bg-aw-danger/10 cursor-pointer">
                      {t('developerView.resetWorkspace')}
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-3">
                  <button type="button" onClick={onClose} className="aw-button aw-button-ghost cursor-pointer">{t('developerView.close')}</button>
                  {activeTab === 'state' && isEditingProfile && (
                    <button type="button" onClick={handleSaveProfile} className="aw-button aw-button-primary cursor-pointer">
                      {t('developerView.saveProfile')}
                    </button>
                  )}
                </div>
              </footer>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
};
