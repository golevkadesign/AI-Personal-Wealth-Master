import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'motion/react';
import { logout } from '../lib/firebase';
import { useTranslation } from '../hooks/useTranslation';
import { useWealthStore } from '../hooks/useWealthStore';
import { MaterialIcon } from './ui/MaterialIcon';

interface TerminalHeaderProps {
  user: any;
  setShowProfileReport: (show: boolean) => void;
  setShowDeveloperView: (show: boolean) => void;
  onAskArbitra: () => void;
  setShowSettingsModal: (show: boolean) => void;
}

export function TerminalHeader({
  user,
  setShowProfileReport,
  setShowDeveloperView,
  onAskArbitra,
  setShowSettingsModal
}: TerminalHeaderProps) {
  const { t, language, setLanguage } = useTranslation();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [avatarLoadFailed, setAvatarLoadFailed] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const {
    data,
    publicHoldingAccountsSyncStatus,
    marketContextStatus,
    marketContextError,
  } = useWealthStore();

  const publicHoldingAccounts = data.publicHoldingAccounts || (data.distributions as any)?.publicHoldingAccounts || [];
  const dynamicWidgetCount = data.dynamicWidgets?.length || 0;

  const syncDotClass =
    publicHoldingAccountsSyncStatus === 'loading' ? 'aw-status-warning animate-pulse' :
    publicHoldingAccountsSyncStatus === 'success' ? 'aw-status-success' :
    publicHoldingAccountsSyncStatus === 'error' ? 'aw-status-danger' : '';

  const accountDotClass = publicHoldingAccounts.length > 0 ? 'aw-status-warning' : '';

  const aiDotClass = dynamicWidgetCount > 0 ? 'aw-status-info' : '';

  const marketDotClass =
    marketContextStatus === 'loading' ? 'aw-status-warning animate-pulse' :
    marketContextStatus === 'error' ? 'aw-status-danger' :
    data.marketContext ? (
      data.marketContext.regime?.riskMode === 'risk_on' ? 'aw-status-success' :
      data.marketContext.regime?.riskMode === 'risk_off' ? 'aw-status-warning' :
      'aw-status-info'
    ) : '';

  const hasAvatarUrl = typeof user?.photoURL === 'string' && user.photoURL.trim().length > 0;
  const shouldShowAvatarImage = hasAvatarUrl && !avatarLoadFailed;
  const avatarFallbackLabel = (user?.displayName || user?.email || 'User').trim().slice(0, 1).toUpperCase();

  useEffect(() => {
    setAvatarLoadFailed(false);
  }, [user?.photoURL]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsDropdownOpen(false);
      }
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  return (
    <header className="sticky top-0 z-40 aw-terminal-header transition-colors">
      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 h-[72px] flex justify-between items-center">
        
        {/* Brand Area */}
        <div className="flex min-w-0 items-center gap-3 sm:gap-4 select-none shrink">
          <div className="aw-panel-muted w-10 h-10 flex items-center justify-center relative overflow-hidden group">
            <div className="absolute left-3 top-3 h-4 w-5 -rotate-12 aw-brand-mark-outline" />
            <div className="absolute right-2.5 top-2.5 h-4 w-4 rotate-12 aw-brand-mark-fill" />
          </div>
          <div className="flex min-w-0 flex-col justify-center">
            <h1 className="aw-label font-semibold aw-text-primary tracking-normal leading-none font-sans truncate">
              {t('nav.brandName')}
            </h1>
            <span className="aw-caption font-mono uppercase aw-text-tertiary mt-1 font-medium hidden min-[430px]:block truncate">
              {t('nav.brandSubtitle')}
            </span>
          </div>
        </div>

        {/* Mid-Status Area (xl devices only) —— 优雅融入 Header 单行内部 */}
        <div className="hidden xl:flex flex-1 items-center justify-center min-w-0 px-6">
          <div className="flex items-center gap-2 min-w-0 overflow-hidden aw-caption font-mono select-none">
            <div className="aw-status-pill shrink-0">
              <span className="aw-status-dot aw-status-success" />
              <span className="font-sans">{t('nav.systemOk')}</span>
            </div>

            <div className="aw-status-pill shrink-0">
              <span className={`aw-status-dot ${syncDotClass}`} />
              <span className="font-sans">
                {publicHoldingAccountsSyncStatus === 'loading' ? t('nav.syncing') :
                 publicHoldingAccountsSyncStatus === 'success' ? t('nav.synced') :
                 publicHoldingAccountsSyncStatus === 'error' ? t('nav.syncError') : t('nav.awaitingData')}
              </span>
            </div>

            <div className="aw-status-pill shrink-0">
              <span className={`aw-status-dot ${accountDotClass}`} />
              <span className="font-sans">
                {publicHoldingAccounts.length > 0 ? `${publicHoldingAccounts.length} ${t('nav.accounts')}` : t('nav.awaitingAccount')}
              </span>
            </div>

            <div className="aw-status-pill shrink-0">
              <span className={`aw-status-dot ${aiDotClass}`} />
              <span className="font-sans">
                {dynamicWidgetCount > 0 ? `${t('nav.aiInsights')} ${dynamicWidgetCount}` : t('nav.aiIdle')}
              </span>
            </div>

            <div className="aw-status-pill shrink-0 min-w-0" title={
              marketContextStatus === 'error' && marketContextError ? marketContextError : 
              data.marketContext ? `${data.marketContext.freshness} · ${t('nav.marketSourceDelayed')}` : t('nav.marketStatus')
            }>
              <span className={`aw-status-dot ${marketDotClass}`} />
              <span className="font-sans truncate max-w-[124px]">
                {marketContextStatus === 'loading' ? t('nav.marketRefreshing') :
                 marketContextStatus === 'error' ? t('nav.marketError') :
	                 data.marketContext ? (
	                   data.marketContext.regime?.riskMode === 'risk_on' ? t('nav.riskOn') :
	                   data.marketContext.regime?.riskMode === 'risk_off' ? t('nav.riskOff') :
	                   data.marketContext.regime?.riskMode === 'neutral' ? t('nav.neutral') : t('nav.neutral')
	                 ) : t('nav.marketWaiting')}
              </span>
            </div>
          </div>
        </div>
        
        {/* Actions Area */}
        <div className="flex items-center gap-2 sm:gap-3 lg:gap-4">
          
          {/* Sparkly Premium AI Button */}
          <motion.button 
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={onAskArbitra}
            className="aw-button aw-button-primary cursor-pointer"
            title={t('nav.askArbitra')}
            aria-label={t('nav.askArbitra')}
          >
            <MaterialIcon name="auto_awesome" size={20} filled className="shrink-0" />
            <span className="hidden min-[430px]:inline">{t('nav.askArbitra')}</span>
          </motion.button>

          <div className="h-6 w-px bg-aw-border-subtle mx-0.5"></div>

          {/* Avatar dropdown trigger & menu */}
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
              className="w-10 h-10 aw-avatar-button flex items-center justify-center overflow-hidden shrink-0 transition-all ml-1 duration-200 cursor-pointer focus:outline-none"
              title={user.displayName || t('nav.accountMenu')}
              aria-label={t('nav.accountMenu')}
            >
              {shouldShowAvatarImage ? (
                <img
                  src={user.photoURL}
                  alt={t('nav.userAvatar')}
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                  onError={() => setAvatarLoadFailed(true)}
                />
              ) : (
                <span className="aw-caption aw-text-primary font-mono font-semibold flex items-center justify-center">
                  {avatarFallbackLabel || <MaterialIcon name="account_circle" size={20} />}
                </span>
              )}
            </button>

            {isDropdownOpen && (
              <div 
                className="absolute right-0 mt-3 w-64 aw-panel overflow-hidden z-50 text-sans font-normal backdrop-blur-md animate-in fade-in slide-in-from-top-3 duration-200"
              >
                {/* User info info cards */}
                <div className="p-4 border-b border-aw-border-subtle bg-aw-surface-3 flex items-center gap-3">
                  <div className="w-8 h-8 aw-avatar-frame flex items-center justify-center overflow-hidden shrink-0">
                    {shouldShowAvatarImage ? (
                      <img
                        src={user.photoURL}
                        alt={t('nav.userAvatarMini')}
                        className="w-full h-full object-cover animate-fade-in"
                        referrerPolicy="no-referrer"
                        onError={() => setAvatarLoadFailed(true)}
                      />
                    ) : (
                      <span className="aw-caption aw-text-primary font-mono font-semibold">
                        {avatarFallbackLabel || <MaterialIcon name="account_circle" size={20} />}
                      </span>
                    )}
                  </div>
                  <div className="flex flex-col min-w-0">
                    <div className="aw-body font-semibold aw-text-primary truncate pr-1">
                      {user.displayName || t('nav.defaultUserName')}
                    </div>
                    <div className="aw-caption font-mono aw-text-tertiary truncate leading-tight mt-0.5">
                      {user.email || t('nav.defaultUserEmail')}
                    </div>
                  </div>
                </div>

                {/* Dropdown Menu List Items */}
                <div className="p-1.5 space-y-1">
                  {/* Memory Profile Toggle Option */}
                  <button
                    onClick={() => {
                      setIsDropdownOpen(false);
                      setShowProfileReport(true);
                    }}
                    className="w-full aw-button aw-button-ghost !justify-start !px-3 !py-2 !min-h-9 text-left cursor-pointer"
                  >
                    <MaterialIcon name="database" size={20} />
                    <span>{t('nav.memoryProfile')}</span>
                  </button>

                  {/* Developer View Toggle Option */}
                  <button
                    onClick={() => {
                      setIsDropdownOpen(false);
                      setShowDeveloperView(true);
                    }}
                    className="w-full aw-button aw-button-ghost !justify-start !px-3 !py-2 !min-h-9 text-left cursor-pointer"
                  >
                    <MaterialIcon name="developer_board" size={20} />
                    <span>{t('nav.developer')}</span>
                  </button>

                  {/* Toggle Interface Language Option */}
                  <button
                    onClick={() => {
                      setLanguage(language === 'zh-CN' ? 'en-US' : 'zh-CN');
                    }}
                    className="w-full aw-button aw-button-ghost !justify-between !px-3 !py-2 !min-h-9 text-left cursor-pointer"
                  >
                    <div className="flex items-center gap-2.5">
                      <MaterialIcon name="language" size={20} />
                      <span>{t('nav.language')}</span>
                    </div>
                    <span className="aw-caption font-mono font-semibold bg-aw-surface-3 border border-aw-border-subtle aw-text-secondary px-1.5 py-0.5 aw-mini-token uppercase leading-none text-center">
                      {language === 'zh-CN' ? t('nav.switchToEnglish') : t('nav.switchToChinese')}
                    </span>
                  </button>

                  {/* Settings Modal Toggle Option */}
                  <button
                    onClick={() => {
                      setIsDropdownOpen(false);
                      setShowSettingsModal(true);
                    }}
                    className="w-full aw-button aw-button-ghost !justify-start !px-3 !py-2 !min-h-9 text-left cursor-pointer"
                  >
                    <MaterialIcon name="settings" size={20} />
                    <span>{t('nav.settings')}</span>
                  </button>

                  <div className="h-px bg-aw-border-subtle my-1 mx-2" />

                  {/* Ultimate Logout Option */}
                  <button
                    onClick={() => {
                      setIsDropdownOpen(false);
                      logout();
                    }}
                    className="w-full aw-button aw-button-ghost !justify-start !px-3 !py-2 !min-h-9 text-left cursor-pointer hover:!text-aw-danger"
                  >
                    <MaterialIcon name="logout" size={20} />
                    <span>{t('nav.logout')}</span>
                  </button>

                </div>
              </div>
            )}
          </div>

        </div>
      </div>
    </header>
  );
}
