import React, { Component, ErrorInfo, ReactNode } from 'react';
import { ShieldAlert } from 'lucide-react';

interface Props {
  children?: ReactNode;
}

interface State {
  hasError: boolean;
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
      return (
        <div 
          className="flex flex-col items-center justify-center p-6 rounded-xl h-full min-h-[160px]"
          style={{ 
            backgroundColor: 'var(--color-dash-surface)', 
            border: '1px dashed var(--color-dash-subtle)' 
          }}
        >
          <ShieldAlert 
            className="w-5 h-5 mb-3 opacity-80" 
            style={{ color: 'var(--color-dash-gold)' }}
          />
          <p className="text-xs font-mono text-center tracking-wide" style={{ color: 'var(--color-dash-gold)' }}>
            战略模组结构异常<br />
            <span className="text-[10px] opacity-60 mt-1.5 block">引擎正在自动校准...</span>
          </p>
        </div>
      );
    }

    return this.props.children;
  }
}
