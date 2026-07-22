import React from 'react';
import { motion } from 'motion/react';
import Markdown from 'react-markdown';
import { useWealthStore } from '../hooks/useWealthStore';
import { MaterialIcon } from './ui/MaterialIcon';
import { useTranslation } from '../hooks/useTranslation';

interface LifeStrategyTimelineProps {
  nodePlans: Record<string, any>;
  handleInlineNodePlan: (typeStr: string, item: any, isLong: boolean, idx: number) => void;
}

export function LifeStrategyTimeline({
  nodePlans,
  handleInlineNodePlan
} : LifeStrategyTimelineProps) {
  const { t } = useTranslation();
  
  const lifeStrategiesShort = useWealthStore(state => state.data.lifeStrategiesShort);
  const lifeStrategiesLong = useWealthStore(state => state.data.lifeStrategiesLong);
  
  const renderTrack = (items: any[] | undefined, isLong: boolean) => {
    if (!items || items.length === 0) {
      return (
        <div className="aw-panel-muted aw-empty-timeline aw-caption aw-text-tertiary font-mono flex min-h-32 flex-col items-center justify-center gap-4 border-dashed px-4 py-5">
          <div className="aw-empty-timeline-rail" aria-hidden="true">
            {[0, 1, 2, 3].map((item) => (
              <span key={item} />
            ))}
          </div>
          <span>{t('dashboard.timelineEmpty')}</span>
        </div>
      );
    }

    return (
      <div className="aw-timeline-track">
        <div className="aw-timeline-scroll custom-scroll">
          <div className="aw-timeline-line" />

          {items.map((item: any, idx: number) => {
            const contentStr = encodeURIComponent(item.description || item.title || '');
            const contentHash = btoa(contentStr).slice(0, 15);
            const planKey = `${isLong ? 'long' : 'short'}-${idx}-${contentHash}`;
            const plan = nodePlans[planKey];

            return (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ type: "spring", stiffness: 400, damping: 25, delay: idx * 0.08 }}
                key={idx}
                className="aw-panel-muted aw-timeline-node"
              >
                <div className="flex justify-between items-center mb-4 z-10">
                  <div className="flex items-center gap-2">
                    <div className="aw-timeline-index">
                      {idx + 1}
                    </div>
                    <span className="aw-timeline-time">
                      {item.timeNode}
                    </span>
                  </div>
                  
                  <button 
                    onClick={() => plan?.status === 'thinking' ? null : handleInlineNodePlan(isLong ? t('dashboard.longStrategy') : t('dashboard.shortStrategy'), item, isLong, idx)}
                    disabled={plan?.status === 'thinking'}
                    className="aw-button aw-button-ghost aw-timeline-action cursor-pointer disabled:cursor-wait disabled:opacity-70"
                  >
                    {plan?.status === 'thinking' ? (
                      <MaterialIcon name="progress_activity" size={16} className="animate-spin" />
                    ) : (
                      <MaterialIcon name={plan?.status === 'done' ? 'refresh' : 'insights'} size={16} />
                    )}
                    {plan?.status === 'thinking' ? t('dashboard.thinking') : (plan?.status === 'done' ? t('dashboard.retry') : t('dashboard.insightAction'))}
                  </button>
                </div>

                <div className="mb-4">
                  <h4 className="aw-label aw-text-primary mb-2 font-semibold">
                    {item.title}
                  </h4>
                  <p className="aw-timeline-copy">
                    {item.description}
                  </p>
                </div>

                {plan && (
                  <div className="aw-timeline-plan">
                    {plan.status === 'thinking' && (
                      <div className="aw-timeline-plan-header">
                        <MaterialIcon name="memory" size={16} className="animate-pulse shrink-0" />
                        <span className="truncate">{plan.thinking || t('dashboard.deepParsing')}</span>
                      </div>
                    )}
                    {plan.result && (
                      <div className="aw-timeline-plan-body custom-scroll">
                        <Markdown>{plan.result}</Markdown>
                      </div>
                    )}
                  </div>
                )}
              </motion.div>
            );
          })}

        </div>
      </div>
    );
  };

  return (
    <div className="space-y-3 mb-5 w-full animate-fade-in">
      
      {/* Short Term Timeline Card */}
      <motion.div 
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 400, damping: 25 }}
        className="aw-panel aw-module-timeline p-4 sm:p-5 relative overflow-hidden group"
      >
        <div className="aw-section-header">
          <div className="flex items-center gap-2">
            <span className="aw-section-kicker">
              {t('dashboard.shortStrategy')}
            </span>
          </div>
          <span className="aw-caption aw-text-tertiary font-mono uppercase">
            {t('dashboard.horizon12')}
          </span>
        </div>
        {renderTrack(lifeStrategiesShort, false)}
      </motion.div>

      {/* Long Term Timeline Card */}
      <motion.div 
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 400, damping: 25, delay: 0.15 }}
        className="aw-panel aw-module-timeline p-4 sm:p-5 relative overflow-hidden group"
      >
        <div className="aw-section-header">
          <div className="flex items-center gap-2">
            <span className="aw-section-kicker">
              {t('dashboard.longStrategy')}
            </span>
          </div>
          <span className="aw-caption aw-text-tertiary font-mono uppercase">
            {t('dashboard.horizon10')}
          </span>
        </div>
        {renderTrack(lifeStrategiesLong, true)}
      </motion.div>

    </div>
  );
}
