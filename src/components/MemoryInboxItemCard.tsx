import React from 'react';
import type { MemoryCandidateStatus, MemoryInboxItem } from '../types/workbench';
import { useInteractionStore } from '../hooks/useInteractionStore';
import { useTranslation } from '../hooks/useTranslation';
import { MaterialIcon } from './ui/MaterialIcon';

interface MemoryInboxItemCardProps {
  item: MemoryInboxItem;
  compact?: boolean;
  className?: string;
}

function translateMaybeKey(value: string, t: (key: string) => string) {
  const prefixes = ['workbench.', 'portfolioIntelligence.'];
  if (value.includes(', ')) {
    return value.split(', ').map((item) => translateMaybeKey(item, t)).join(', ');
  }
  if (prefixes.some((prefix) => value.startsWith(prefix))) return t(value);
  return value;
}

function memoryStatusClass(status: MemoryCandidateStatus) {
  if (status === 'rejected' || status === 'revoked') return 'text-aw-danger';
  if (status === 'accepted' || status === 'merged') return 'text-aw-success';
  if (status === 'temporary') return 'text-aw-info';
  return 'text-aw-warning';
}

export function MemoryInboxItemCard({
  item,
  compact = false,
  className = '',
}: MemoryInboxItemCardProps) {
  const { t } = useTranslation();
  const decideMemoryInboxItem = useInteractionStore((state) => state.decideMemoryInboxItem);
  const [sourcesOpen, setSourcesOpen] = React.useState(false);
  const [isEditing, setIsEditing] = React.useState(false);
  const [draft, setDraft] = React.useState({
    title: item.candidate.title,
    body: item.candidate.body,
  });

  React.useEffect(() => {
    if (!isEditing) {
      setDraft({
        title: item.candidate.title,
        body: item.candidate.body,
      });
    }
  }, [isEditing, item.candidate.body, item.candidate.title]);

  const canDecide = item.status === 'pending';
  const canRevoke = item.status === 'accepted' || item.status === 'merged';
  const paddingClass = compact ? 'px-3 py-2' : 'p-3';
  const sourceRefs = item.candidate.sourceRefs || [];
  const impactLabels = [
    item.candidate.structuredPatch?.identity ? t('profile.userProfile') : '',
    item.candidate.structuredPatch?.lifeConstraints ? t('profile.lifeStrategy') : '',
    item.candidate.structuredPatch?.riskPreferences ? t('profile.riskTolerance') : '',
    item.candidate.structuredPatch?.allocationPolicy ? t('profile.wealthPreference') : '',
    item.candidate.structuredPatch?.behavioralPatterns ? t('profile.persona') : '',
  ].filter(Boolean);

  const submitEdit = () => {
    decideMemoryInboxItem(item.id, {
      decision: 'edit_and_accept',
      editedTitle: draft.title.trim() || item.candidate.title,
      editedBody: draft.body.trim() || item.candidate.body,
    });
    setIsEditing(false);
  };

  return (
    <div className={`aw-panel-muted space-y-3 ${paddingClass} ${className}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          {isEditing ? (
            <div className="space-y-2">
              <label className="block">
                <span className="aw-caption aw-text-tertiary font-mono uppercase">
                  {t('workbench.memory.editedTitle')}
                </span>
                <input
                  value={draft.title}
                  onChange={(event) => setDraft((prev) => ({ ...prev, title: event.target.value }))}
                  className="aw-form-input mt-1 w-full font-mono"
                />
              </label>
              <label className="block">
                <span className="aw-caption aw-text-tertiary font-mono uppercase">
                  {t('workbench.memory.editedBody')}
                </span>
                <textarea
                  value={draft.body}
                  onChange={(event) => setDraft((prev) => ({ ...prev, body: event.target.value }))}
                  className="aw-form-input custom-scroll mt-1 min-h-20 w-full resize-none"
                />
              </label>
            </div>
          ) : (
            <>
              <strong className="block aw-body aw-text-primary">
                {translateMaybeKey(item.candidate.title, t)}
              </strong>
              <p className="mt-1 aw-caption aw-text-secondary leading-relaxed">
                {translateMaybeKey(item.candidate.body, t)}
              </p>
            </>
          )}
        </div>
        <span className={`aw-caption shrink-0 font-mono uppercase ${memoryStatusClass(item.status)}`}>
          {t(`workbench.memory.status.${item.status}`)}
        </span>
      </div>

      <div className="flex flex-wrap gap-2">
        <span className="aw-status-pill font-mono">{t(`workbench.memory.types.${item.candidate.type}`)}</span>
        <span className="aw-status-pill font-mono">{t(`workbench.confidenceLevels.${item.candidate.confidence}`)}</span>
        <button
          type="button"
          className="aw-status-pill cursor-pointer font-mono"
          onClick={() => setSourcesOpen((prev) => !prev)}
        >
          <MaterialIcon name="database" size={16} />
          {sourcesOpen ? t('workbench.memory.hideSources') : t('workbench.memory.viewSources')}
        </button>
        {item.willAffectProfile && (
          <span className="aw-status-pill font-mono text-aw-success">
            <MaterialIcon name="manage_accounts" size={16} />
            {t('workbench.memory.affectsProfile')}
          </span>
        )}
        {item.willRefreshDashboard && (
          <span className="aw-status-pill font-mono text-aw-info">
            <MaterialIcon name="auto_graph" size={16} />
            {t('workbench.memory.refreshesDashboard')}
          </span>
        )}
      </div>

      {(item.willAffectProfile || item.willRefreshDashboard) && (
        <div className="aw-memory-impact" aria-label={t('workbench.memory.acceptanceImpact')}>
          <MaterialIcon name="conversion_path" size={16} />
          <div className="min-w-0">
            <strong>{t('workbench.memory.acceptanceImpact')}</strong>
            <p>
              {impactLabels.length > 0 ? impactLabels.join(' · ') : t('workbench.memory.profileProjection')}
              {item.willRefreshDashboard ? ` · ${t('workbench.memory.dashboardRefresh')}` : ''}
            </p>
          </div>
        </div>
      )}

      {sourcesOpen && (
        <div className="aw-panel-muted px-3 py-2">
          <p className="aw-caption aw-text-tertiary font-mono uppercase">{t('workbench.memory.sourceTrace')}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {sourceRefs.length > 0 ? sourceRefs.map((sourceRef) => (
              <span key={sourceRef} className="aw-status-pill font-mono">
                {sourceRef}
              </span>
            )) : (
              <span className="aw-caption aw-text-tertiary">{t('portfolioIntelligence.noSource')}</span>
            )}
          </div>
        </div>
      )}

      {canDecide && !isEditing && (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="aw-button aw-button-ghost !min-h-8 !px-3"
            onClick={() => decideMemoryInboxItem(item.id, 'reject')}
          >
            {t('workbench.memory.reject')}
          </button>
          <button
            type="button"
            className="aw-button aw-button-ghost !min-h-8 !px-3"
            onClick={() => decideMemoryInboxItem(item.id, 'mark_temporary')}
          >
            {t('workbench.memory.markTemporary')}
          </button>
          <button
            type="button"
            className="aw-button aw-button-ghost !min-h-8 !px-3"
            onClick={() => setIsEditing(true)}
          >
            {t('workbench.memory.edit')}
          </button>
          <button
            type="button"
            className="aw-button aw-button-ghost !min-h-8 !px-3"
            onClick={() => decideMemoryInboxItem(item.id, 'merge')}
          >
            {t('workbench.memory.merge')}
          </button>
          <button
            type="button"
            className="aw-button aw-button-primary !min-h-8 !px-3"
            onClick={() => decideMemoryInboxItem(item.id, 'accept')}
          >
            {t('workbench.memory.accept')}
          </button>
        </div>
      )}

      {canDecide && isEditing && (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="aw-button aw-button-ghost !min-h-8 !px-3"
            onClick={() => setIsEditing(false)}
          >
            {t('workbench.memory.cancelEdit')}
          </button>
          <button
            type="button"
            className="aw-button aw-button-primary !min-h-8 !px-3"
            onClick={submitEdit}
          >
            {t('workbench.memory.editAndAccept')}
          </button>
        </div>
      )}

      {!canDecide && (
        <div className="flex flex-wrap items-center gap-2">
          <p className="aw-caption aw-text-tertiary font-mono uppercase">
            {t('workbench.memory.decisionApplied')}
          </p>
          {canRevoke && (
            <button
              type="button"
              className="aw-button aw-button-ghost !min-h-8 !px-3"
              onClick={() => decideMemoryInboxItem(item.id, 'revoke')}
            >
              {t('workbench.memory.revoke')}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
