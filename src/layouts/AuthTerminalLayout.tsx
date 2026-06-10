import React from 'react';
import { motion } from 'motion/react';
import { loginWithGoogle } from '../lib/firebase';
import { useTranslation } from '../hooks/useTranslation';
import { MaterialIcon } from '../components/ui/MaterialIcon';

const ArbitraMark = ({ loading = false }: { loading?: boolean }) => (
  <div className="relative flex h-24 w-24 items-center justify-center rounded-full border border-aw-border-default bg-aw-surface-2">
    <motion.div
      className="absolute inset-3 rounded-full border border-dashed border-aw-border-subtle"
      animate={loading ? { rotate: 360 } : { rotate: 0 }}
      transition={{ repeat: loading ? Infinity : 0, duration: 18, ease: 'linear' }}
    />
    <div className="absolute h-px w-28 bg-gradient-to-r from-transparent via-aw-border-strong to-transparent" />
    <div className="absolute h-28 w-px bg-gradient-to-b from-transparent via-aw-border-strong to-transparent" />
    <div className="relative flex h-14 w-14 items-center justify-center rounded-full border border-aw-border-strong bg-aw-surface-1">
      <MaterialIcon name="account_balance" size={32} className="text-aw-accent-mist" />
    </div>
  </div>
);

const SecurityBadge = ({ icon, text }: { icon: string; text: string }) => (
  <div className="inline-flex items-center gap-1.5 rounded-md border border-aw-border-subtle bg-aw-surface-2 px-3 py-1 aw-label">
    <MaterialIcon name={icon} size={16} />
    {text}
  </div>
);

const GoogleGlyph = () => (
  <svg className="h-5 w-5 shrink-0" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
    <path d="M5.84 14.1c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.08H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.92l2.85-2.22.81-.6z" fill="#FBBC05" />
    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.08l3.66 2.84c.87-2.6 3.3-4.54 6.16-4.54z" fill="#EA4335" />
  </svg>
);

const TerminalFrame = ({ children }: { children: React.ReactNode }) => (
  <div className="aw-app-shell relative flex min-h-screen items-center justify-center overflow-hidden px-5 py-8 text-aw-text-primary select-none">
    <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-aw-border-strong to-transparent" />
    <div className="pointer-events-none absolute inset-0 opacity-[0.05] aw-bg-grid" />
    <div className="pointer-events-none absolute left-6 top-6 hidden aw-caption uppercase tracking-widest sm:block">
      SYS.LOC_01 / SECURE_SHELL
    </div>
    <div className="pointer-events-none absolute bottom-6 right-6 hidden aw-caption uppercase tracking-widest sm:block">
      INITIALIZATION_COMPLETE
    </div>
    {children}
  </div>
);

interface AuthTerminalLayoutProps {
  loadingAuth: boolean;
}

export const AuthTerminalLayout: React.FC<AuthTerminalLayoutProps> = ({ loadingAuth }) => {
  const { t } = useTranslation();

  if (loadingAuth) {
    return (
      <TerminalFrame>
        <motion.div
          initial={{ opacity: 0, scale: 0.97 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.45, ease: 'easeOut' }}
          className="aw-panel relative flex w-full max-w-sm flex-col items-center p-8 text-center sm:p-10"
        >
          <ArbitraMark loading />

          <div className="mt-7 w-full">
            <div className="h-1 overflow-hidden rounded-full border border-aw-border-subtle bg-aw-surface-2">
              <motion.div
                animate={{ x: ['-100%', '240%'] }}
                transition={{ repeat: Infinity, duration: 1.8, ease: 'easeInOut' }}
                className="h-full w-1/3 rounded-full bg-aw-accent-mist"
              />
            </div>
            <div className="mt-2 flex justify-end">
              <span className="aw-caption uppercase tracking-widest">Secure link syncing</span>
            </div>
          </div>

          <h2 className="aw-title mt-7">{t('auth.authenticating')}</h2>
          <p className="aw-body mt-2 mb-7">Syncing encrypted profile and workspace</p>

          <div className="flex w-full flex-wrap justify-center gap-2">
            <SecurityBadge icon="encrypted" text="Encrypted" />
            <SecurityBadge icon="lock" text="Secure" />
            <SecurityBadge icon="visibility_off" text="Private" />
          </div>
        </motion.div>
      </TerminalFrame>
    );
  }

  return (
    <TerminalFrame>
      <motion.div
        initial={{ opacity: 0, y: 14, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
        className="aw-panel relative w-full max-w-md overflow-hidden p-8 text-center sm:p-12"
      >
        <div className="relative z-10 flex flex-col items-center">
          <ArbitraMark />

          <h1 className="aw-title mt-7">Arbitra Terminal</h1>
          <p className="aw-section-kicker mt-2">Secure Authentication Required</p>
          <p className="aw-body mt-6 mb-8 max-w-[280px]">
            Private wealth intelligence workspace.
          </p>

          <motion.button
            whileHover={{ scale: 1.012, y: -1 }}
            whileTap={{ scale: 0.988 }}
            onClick={loginWithGoogle}
            className="aw-button aw-button-primary w-full justify-center py-4"
          >
            <GoogleGlyph />
            {t('auth.signIn')}
          </motion.button>

          <div className="mt-8 flex max-w-[280px] items-start gap-3 text-left">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-aw-border-subtle bg-aw-surface-2">
              <MaterialIcon name="lock" size={16} />
            </div>
            <p className="aw-caption leading-relaxed">
              Your profile and workspace stay encrypted and private.
            </p>
          </div>
        </div>
      </motion.div>
    </TerminalFrame>
  );
};
