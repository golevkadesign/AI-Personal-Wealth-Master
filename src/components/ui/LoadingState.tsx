import React from 'react';
import { cn } from '../../lib/utils';
import { Loader2 } from 'lucide-react';

interface LoadingStateProps extends React.HTMLAttributes<HTMLDivElement> {
  message?: string;
}

export const LoadingState = React.forwardRef<HTMLDivElement, LoadingStateProps>(({
  className,
  message = '正在加载...',
  ...props
}, ref) => {
  return (
    <div ref={ref} className={cn('w-full flex-col flex items-center justify-center p-xl min-h-[200px]', className)} {...props}>
      <Loader2 className="w-10 h-10 text-primary animate-spin mb-md" />
      <p className="font-body-md text-body-md text-on-surface-variant animate-pulse">{message}</p>
    </div>
  );
});
LoadingState.displayName = 'LoadingState';
