import React, { useEffect, useState } from 'react';
import { useWealthStore } from '../hooks/useWealthStore';
import { useTranslation } from '../hooks/useTranslation';
import { MaterialIcon } from './ui/MaterialIcon';

export const ProfileReportView = ({ isOpen, onClose }: any) => {
  const { data, commitData } = useWealthStore();
  const { t } = useTranslation();
  const [localProfile, setLocalProfile] = useState<any>({});
  const [localPersona, setLocalPersona] = useState<any>({ tags: [], description: '' });
  const [localContext, setLocalContext] = useState('');
  const [localGoal, setLocalGoal] = useState<any>({});
  const [editingSection, setEditingSection] = useState<string | null>(null);
  const [initialSnapshot, setInitialSnapshot] = useState<any>(null);
  const wasOpenRef = React.useRef(false);

  useEffect(() => {
    if (isOpen && !wasOpenRef.current) {
      const profile = data?.userProfile || {};
      const persona = data?.userPersona || { tags: [], description: '' };
      const context = data?.insights?.global || '';
      const goal = data?.goal || { name: t('chat.defaultGoalName'), current: 0, target: 1, index: 0 };

      setLocalProfile(profile);
      setLocalPersona(persona);
      setLocalContext(context);
      setLocalGoal(goal);
      setEditingSection(null);
      setInitialSnapshot({ profile, persona, context, goal });
    }
    wasOpenRef.current = isOpen;
  }, [isOpen, data]);

  const handleClose = () => {
    const isDirty = initialSnapshot && (
      JSON.stringify(localProfile) !== JSON.stringify(initialSnapshot.profile) ||
      JSON.stringify(localPersona) !== JSON.stringify(initialSnapshot.persona) ||
      localContext !== initialSnapshot.context ||
      JSON.stringify(localGoal) !== JSON.stringify(initialSnapshot.goal)
    );

    if (isDirty) {
      if (window.confirm(t('profile.discardConfirm'))) {
        onClose();
      }
    } else {
      onClose();
    }
  };

  const handleSave = () => {
    const rawIndex = localGoal.index;
    let validIndex = data?.goal?.index || 0;

    if (typeof rawIndex === 'number' && !isNaN(rawIndex)) {
      validIndex = rawIndex;
    } else if (typeof rawIndex === 'string') {
      const parsed = parseFloat(rawIndex.replace(/[^0-9.-]+/g, ''));
      if (!isNaN(parsed)) {
        validIndex = parsed;
      }
    }

    const normalizedGoal = {
      ...localGoal,
      current: Number(localGoal.current) || 0,
      target: Number(localGoal.target) || 0,
      index: validIndex
    };

    commitData((prev: any) => ({
      ...prev,
      userPersona: {
        ...(prev?.userPersona || {}),
        ...localPersona
      },
      userProfile: {
        ...(prev?.userProfile || {}),
        ...localProfile
      },
      insights: {
        ...(prev?.insights || {}),
        global: localContext
      },
      goal: {
        ...(prev?.goal || {}),
        ...normalizedGoal
      }
    }));
    setEditingSection(null);
    onClose();
  };

  if (!isOpen) return null;

  const strategies = data?.lifeStrategiesLong?.length > 0
    ? data.lifeStrategiesLong
    : (data?.lifeStrategiesShort || []);
  const percent = localGoal.target > 0 ? Math.min(100, Math.round((localGoal.current / localGoal.target) * 100)) : 0;

  const hasProfile = Object.keys(localProfile).some(k => k !== 'name' && localProfile[k]);
  const hasPersonaTags = localPersona?.tags?.length > 0;
  const hasContext = localContext && localContext.length > 5;
  const hasStrategies = strategies && strategies.length > 0;
  const hasSync = !!data?._liveFetchedAt;

  const editButtonClass = (active: boolean) =>
    `aw-icon-button cursor-pointer ${active ? 'aw-icon-button-active' : ''}`;

  const SectionCard = ({ title, enTitle, fieldName, children, className = '' }: any) => {
    const isEditing = editingSection === fieldName;

    return (
      <section className={`aw-panel-muted p-6 ${className}`}>
        <div className="flex items-center justify-between gap-4 mb-5">
          <div className="min-w-0">
            <div className="aw-label aw-text-primary font-semibold truncate">{title}</div>
            <div className="aw-caption aw-text-tertiary font-mono uppercase mt-1">/ {enTitle}</div>
          </div>
          {fieldName && (
            <button
              type="button"
              onClick={() => setEditingSection(isEditing ? null : fieldName)}
              className={editButtonClass(isEditing)}
              aria-label={`${isEditing ? t('chat.stopEditing') : t('chat.edit')} ${title}`}
            >
              <MaterialIcon name="edit" size={20} />
            </button>
          )}
        </div>
        {typeof children === 'function' ? children(isEditing) : children}
      </section>
    );
  };

  const TextInput = ({ value, onChange, placeholder, type = 'text', className = '' }: any) => (
    <input
      type={type}
      value={value}
      onChange={onChange}
      className={`aw-form-input ${className}`}
      placeholder={placeholder}
    />
  );

  const TextArea = ({ value, onChange, placeholder, className = '' }: any) => (
    <textarea
      value={value}
      onChange={onChange}
      className={`aw-form-input resize-none custom-scroll ${className}`}
      placeholder={placeholder}
    />
  );

  const ProfileField = ({ label, value, field, placeholder }: any) => (
    <div className="flex flex-col gap-2">
      <label className="aw-form-label">{label}</label>
      {editingSection === 'profile' ? (
        <TextInput
          value={localProfile[field] || ''}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setLocalProfile({ ...localProfile, [field]: e.target.value })}
          placeholder={placeholder}
        />
      ) : (
        <div className="aw-body aw-text-primary py-1 break-words">{value || '—'}</div>
      )}
    </div>
  );

  const statusItems = [
    { label: t('profile.identity'), active: hasProfile },
    { label: t('profile.wealthContext'), active: hasContext },
    { label: t('profile.investmentPreference'), active: hasPersonaTags },
    { label: t('profile.riskAssessment'), active: false },
    { label: t('profile.lifeStrategy'), active: hasStrategies },
    { label: t('profile.dataMount'), active: hasSync },
  ];

  const sourceItems = [
    { label: t('profile.chatRecords'), meta: t('profile.agentExtract'), active: hasContext, icon: 'forum' },
    { label: t('profile.portfolio'), meta: t('profile.liveMounted'), active: hasSync, icon: 'monitoring' },
    { label: t('profile.marketInsight'), meta: t('profile.ragKnowledge'), active: hasStrategies, icon: 'public' },
    { label: t('profile.externalResearch'), meta: t('profile.waitingAccess'), active: false, icon: 'business_center' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto p-4 lg:p-8 custom-scroll">
      <div className="aw-modal-backdrop absolute inset-0" />

      <div className="aw-modal-shell aw-profile-shell relative flex flex-col overflow-hidden font-sans animate-in fade-in zoom-in-95 duration-200">
        <header className="aw-modal-header flex shrink-0 items-center justify-between gap-4 border-b px-6 py-5 sm:px-8">
          <div className="min-w-0">
            <h2 className="aw-title aw-text-primary flex items-center gap-3 font-bold">
              {t('profile.title')}
            </h2>
            <p className="aw-caption aw-text-tertiary mt-2 font-mono uppercase">
              {t('profile.subtitle')}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-3">
            <button type="button" onClick={handleClose} className="aw-button aw-button-ghost cursor-pointer">
              {t('profile.close')}
              <MaterialIcon name="close" size={20} />
            </button>
            <button type="button" onClick={handleSave} className="aw-button aw-button-primary cursor-pointer">
              {t('profile.save')}
            </button>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto custom-scroll p-6 lg:p-8">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 lg:gap-8">
            <aside className="space-y-6 lg:col-span-3">
              <section className="aw-panel-muted flex flex-col items-center p-8 text-center">
                <div className="aw-memory-avatar mb-5">
                  <MaterialIcon name="person" size={32} />
                </div>
                <h3 className="aw-title aw-text-primary font-bold">{localProfile.name || t('profile.unsetName')}</h3>
                <span className="aw-body aw-text-secondary mt-2">{t('profile.privateClient')}</span>
                <span className="aw-status-pill mt-4 font-mono uppercase">
                  <span className="aw-status-dot aw-status-info" />
                  {t('chat.privateClientStatus')}
                </span>
              </section>

              <section className="group">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <h4 className="aw-form-label">{t('profile.persona')}</h4>
                  <button
                    type="button"
                    onClick={() => setEditingSection(editingSection === 'persona' ? null : 'persona')}
                    className={editButtonClass(editingSection === 'persona')}
                    aria-label={t('profile.editPersona')}
                  >
                    <MaterialIcon name="edit" size={20} />
                  </button>
                </div>

                {editingSection === 'persona' ? (
                  <div className="space-y-4">
                    <TextArea
                      className="min-h-24"
                      value={localPersona.description || ''}
                      onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setLocalPersona({ ...localPersona, description: e.target.value })}
                      placeholder={t('chat.personaDescriptionPlaceholder')}
                    />
                    <div className="space-y-2">
                      <label className="aw-form-label">{t('profile.tags')}</label>
                      <TextInput
                        value={(localPersona.tags || []).join(', ')}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setLocalPersona({
                          ...localPersona,
                          tags: e.target.value.split(',').map(t => t.trim()).filter(Boolean)
                        })}
                        placeholder={t('chat.tagPlaceholder')}
                      />
                    </div>
                  </div>
                ) : (
                  <>
                    <p className="aw-body aw-text-secondary mb-5">
                      {localPersona.description || t('profile.personaEmpty')}
                    </p>
                    <div className="space-y-3">
                      <h4 className="aw-form-label">{t('profile.tags')}</h4>
                      <div className="flex flex-wrap gap-2">
                        {localPersona.tags?.length > 0 ? localPersona.tags.map((tag: string, index: number) => (
                          <span key={index} className="aw-status-pill">{tag}</span>
                        )) : (
                          <span className="aw-caption aw-text-tertiary">{t('profile.tagsPending')}</span>
                        )}
                      </div>
                    </div>
                  </>
                )}
              </section>

              <section className="space-y-3">
                <h4 className="aw-form-label">{t('profile.goalProgress')}</h4>
                <div className="aw-panel-muted p-5">
                  <div className="mb-5 flex items-center justify-between gap-3">
                    {editingSection === 'goal' ? (
                      <TextInput
                        value={localGoal.name || ''}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setLocalGoal({ ...localGoal, name: e.target.value })}
                        className="font-semibold"
                      />
                    ) : (
                      <span className="aw-body aw-text-primary font-bold">{localGoal.name || t('profile.defaultGoal')}</span>
                    )}
                    <button
                      type="button"
                      onClick={() => setEditingSection(editingSection === 'goal' ? null : 'goal')}
                      className={editButtonClass(editingSection === 'goal')}
                      aria-label={t('profile.editGoal')}
                    >
                      <MaterialIcon name="edit" size={20} />
                    </button>
                  </div>

                  {editingSection === 'goal' ? (
                    <div className="mb-4 space-y-4">
                      <div className="space-y-2">
                        <label className="aw-form-label">{t('profile.current')}</label>
                        <TextInput
                          type="number"
                          value={localGoal.current || 0}
                          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setLocalGoal({ ...localGoal, current: Number(e.target.value) })}
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="aw-form-label">{t('profile.target')}</label>
                        <TextInput
                          type="number"
                          value={localGoal.target || 0}
                          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setLocalGoal({ ...localGoal, target: Number(e.target.value) })}
                        />
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="mb-5">
                        <div className="mb-2 flex items-end gap-2 font-mono">
                          <span className="aw-metric aw-text-primary">{percent}</span>
                          <span className="aw-body aw-text-primary mb-1">%</span>
                          <span className="aw-caption aw-text-tertiary ml-auto mb-1 uppercase">{t('profile.goalProgress')}</span>
                        </div>
                        <div className="aw-progress-track">
                          <div className="aw-progress-fill" style={{ width: `${percent}%` }} />
                        </div>
                      </div>
                      <div className="mb-4 flex justify-between gap-4 font-mono">
                        <div className="flex flex-col">
                          <span className="aw-caption aw-text-tertiary mb-1 uppercase">{t('profile.current')}</span>
                          <span className="aw-body aw-text-secondary">¥ {(localGoal.current || 0).toLocaleString()}</span>
                        </div>
                        <div className="flex flex-col text-right">
                          <span className="aw-caption aw-text-tertiary mb-1 uppercase">{t('profile.target')}</span>
                          <span className="aw-body aw-text-primary">¥ {(localGoal.target || 0).toLocaleString()}</span>
                        </div>
                      </div>
                    </>
                  )}

                  <div className="flex items-center justify-between gap-3 border-t border-aw-border-subtle pt-3 font-mono">
                    <span className="aw-caption aw-text-tertiary">{t('profile.goalIndex')}:</span>
                    {editingSection === 'goal' ? (
                      <div className="flex items-center gap-1">
                        <input
                          type="text"
                          className="aw-form-input w-20 py-1 text-right font-bold text-aw-accent-mist"
                          value={localGoal.index || ''}
                          onChange={(e) => setLocalGoal({ ...localGoal, index: e.target.value })}
                          placeholder="1.00"
                        />
                        <span className="aw-body text-aw-accent-mist font-bold">x</span>
                      </div>
                    ) : (
                      <span className="aw-body text-aw-accent-mist font-bold">
                        {localGoal.index !== undefined && localGoal.index !== null ? `${localGoal.index}x` : t('profile.pendingCalculation')}
                      </span>
                    )}
                  </div>
                </div>
              </section>
            </aside>

            <section className="space-y-6 lg:col-span-6">
              <SectionCard title={t('profile.userProfile')} enTitle={t('chat.userProfileEn')} fieldName="profile">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <ProfileField label={t('profile.name')} field="name" value={localProfile.name} placeholder={t('profile.unsetName')} />
                  <ProfileField label={t('profile.location')} field="location" value={localProfile.location} placeholder="e.g. Asia / Hong Kong" />
                  <ProfileField label={t('profile.background')} field="background" value={localProfile.background} placeholder="e.g. Business Management" />
                  <ProfileField label={t('profile.wealthStage')} field="wealthStage" value={localProfile.wealthStage} placeholder="e.g. High Net Worth" />
                  <ProfileField label={t('profile.ageRange')} field="ageRange" value={localProfile.ageRange} placeholder="e.g. 40-50" />
                  <ProfileField label={t('profile.notes')} field="notes" value={localProfile.notes} placeholder="e.g. long-term client" />
                </div>
              </SectionCard>

              <SectionCard title={t('profile.longContext')} enTitle={t('chat.longContextEn')} fieldName="context">
                {(isEditing: boolean) => (
                  isEditing ? (
                    <TextArea
                      className="min-h-28"
                      value={localContext}
                      onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setLocalContext(e.target.value)}
                      placeholder={t('profile.contextPlaceholder')}
                    />
                  ) : (
                    <p className="aw-body aw-text-secondary whitespace-pre-wrap py-2">
                      {localContext || t('profile.contextEmpty')}
                    </p>
                  )
                )}
              </SectionCard>

              <SectionCard title={t('profile.wealthPreference')} enTitle={t('chat.wealthPreferenceEn')}>
                {hasPersonaTags ? (
                  <div className="aw-panel-muted flex flex-wrap gap-2 px-4 py-3">
                    {localPersona.tags.map((tag: string, index: number) => (
                      <span key={index} className="aw-status-pill font-mono">{tag}</span>
                    ))}
                  </div>
                ) : (
                  <div className="aw-panel-muted flex items-center justify-center py-6">
                    <div className="aw-caption aw-text-tertiary italic">{t('profile.preferencePending')}</div>
                  </div>
                )}
              </SectionCard>

              <SectionCard title={t('profile.riskTolerance')} enTitle={t('chat.riskToleranceEn')}>
                <div className="flex items-center gap-6 p-2">
                  <div className="aw-chart-state-icon h-12 w-12 shrink-0">
                    <MaterialIcon name="shield_lock" size={24} className="aw-text-tertiary" />
                  </div>
                  <div className="flex-1">
                    <div className="aw-body aw-text-primary font-bold">
                      {t('profile.riskPending')} <span className="aw-caption aw-text-tertiary ml-1 font-mono">( {t('profile.missingData')} )</span>
                    </div>
                    <div className="aw-caption aw-text-tertiary mt-1">
                      {t('profile.riskPendingDesc')}
                    </div>
                  </div>
                </div>
              </SectionCard>

              <SectionCard title={t('profile.lifeStrategyNotes')} enTitle="Life Strategy Notes">
                <ul className="mt-2 space-y-4">
                  {strategies.length > 0 ? strategies.map((strategy: any, index: number) => (
                    <li key={index} className="aw-body aw-text-secondary flex items-start gap-4">
                      <span className="aw-dot-mark mt-1" />
                      <span>{strategy.description || strategy.title}</span>
                    </li>
                  )) : (
                    <li className="aw-body aw-text-secondary flex items-start gap-4">
                      <span className="aw-dot-mark mt-1" />
                      <span>{t('profile.strategyPending')}</span>
                    </li>
                  )}
                </ul>
              </SectionCard>
            </section>

            <aside className="space-y-6 lg:col-span-3">
              <section className="aw-panel-muted flex flex-col items-center p-8">
                <span className="aw-section-kicker mb-6 w-full">{t('profile.memoryQuality')}</span>
                <div className="aw-memory-ring mb-6 mt-2">
                  <span className="aw-caption aw-text-tertiary text-center leading-relaxed">{t('profile.noQualityScore')}</span>
                </div>
                <div className="w-full text-center">
                  <div className="aw-body aw-text-primary mb-1 font-medium">{t('profile.longConversationPending')}</div>
                  <div className="aw-caption aw-text-tertiary">
                    {t('profile.qualityDesc')}
                  </div>
                </div>
              </section>

              <section className="aw-panel-muted p-6">
                <span className="aw-section-kicker mb-5 block">{t('profile.contextStatus')}</span>
                <div className="space-y-4">
                  {statusItems.map((item, index) => (
                    <div key={index} className="aw-context-row">
                      <span className="aw-caption aw-text-secondary w-16 shrink-0">{item.label}</span>
                      <div className="aw-context-bar">
                        <div className="aw-context-bar-fill" style={{ width: item.active ? '100%' : '0%' }} />
                      </div>
                      <span className={`aw-caption w-12 shrink-0 text-right font-mono ${item.active ? 'aw-text-primary' : 'aw-text-tertiary'}`}>
                        {item.active ? t('profile.active') : t('profile.pending')}
                      </span>
                    </div>
                  ))}
                  <div className="aw-caption aw-text-tertiary mt-3 text-center italic">{t('profile.estimatedByFields')}</div>
                </div>
              </section>

              <section className="aw-panel-muted p-6">
                <span className="aw-section-kicker mb-4 block">{t('profile.portfolioSync')}</span>
                <div className="flex items-center gap-3">
                  <div className="aw-chart-state-icon h-9 w-9 shrink-0">
                    <MaterialIcon name="schedule" size={20} className="aw-text-tertiary" />
                  </div>
                  <div className="min-w-0">
                    <div className="aw-caption aw-text-primary font-mono break-words">
                      {data?._liveFetchedAt ? new Date(data._liveFetchedAt).toLocaleString() : t('profile.noSyncRecord')}
                    </div>
                    <div className="aw-caption aw-text-tertiary mt-1">
                      {data?._liveFetchedAt ? t('profile.autoWritten') : t('profile.waitingMount')}
                    </div>
                  </div>
                </div>
              </section>

              <section className="aw-panel-muted p-6">
                <span className="aw-section-kicker mb-4 block">{t('profile.dataSources')}</span>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
                  {sourceItems.map((item, index) => (
                    <div key={index} className="aw-panel-muted flex items-center gap-3 p-3">
                      <MaterialIcon
                        name={item.icon}
                        size={20}
                        className={`${item.active ? 'text-aw-accent-mist' : 'aw-text-tertiary'} shrink-0`}
                      />
                      <div className="flex min-w-0 flex-col">
                        <div className="aw-caption aw-text-secondary mb-1">{item.label}</div>
                        <div className="aw-caption aw-text-tertiary font-mono">{item.meta}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            </aside>
          </div>
        </main>

        <footer className="aw-modal-footer relative z-10 flex shrink-0 items-center justify-between gap-4 border-t px-6 py-4 sm:px-8">
          <div className="aw-caption aw-text-secondary flex items-center gap-2 font-mono">
            <MaterialIcon name="verified_user" size={16} className="text-aw-accent-mist" />
            <span>{t('profile.privacyFooter')}</span>
          </div>
          <div className="aw-caption aw-text-tertiary font-mono">Powered by Arbitra Security</div>
        </footer>
      </div>
    </div>
  );
};
