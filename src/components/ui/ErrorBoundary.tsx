import React, { Component, ErrorInfo, ReactNode } from 'react';
import { MaterialIcon } from './MaterialIcon';
import { useTranslation } from '../../hooks/useTranslation';

interface Props {
  children?: ReactNode;
}

interface State {
  hasError: boolean;
}

function ErrorBoundaryFallback() {
  const { t } = useTranslation();

  return (
    <div className="aw-panel flex flex-col items-center justify-center p-6 h-full min-h-[160px] border-dashed">
      <MaterialIcon name="shield_alert" size={24} className="mb-3 text-aw-state-warning" />
      <p className="aw-label text-center">
        {t('chat.widgetError')}<br />
        <span className="aw-caption mt-1.5 block">{t('chat.autoCalibrating')}</span>
      </p>
    </div>
  );
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false
  };

  public static getDerivedStateFromError(_: Error): State {
    // Update state so the next render will show the fallback UI.
    return { hasError: true };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error in widget:", error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return <ErrorBoundaryFallback />;
    }

    return this.props.children;
  }
}
