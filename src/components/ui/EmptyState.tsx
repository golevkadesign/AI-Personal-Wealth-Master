import React from 'react';
import { cn } from '../../lib/utils';
import { LucideIcon } from 'lucide-react';

interface EmptyStateProps extends React.HTMLAttributes<HTMLDivElement> {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
}

export const EmptyState = React.forwardRef<HTMLDivElement, EmptyStateProps>(({
  className,
  icon: Icon,
  title,
  description,
  action,
  ...props
}, ref) => {
  return (
    <div ref={ref} className={cn('w-full glass-panel rounded-xl p-xxl flex flex-col items-center justify-center text-center gap-xl min-h-[400px]', className)} {...props}>
      <div className="relative">
        <div className="absolute inset-0 bg-primary/10 blur-3xl rounded-full"></div>
        <div className="w-24 h-24 rounded-full border border-outline-variant/30 flex items-center justify-center bg-surface-container/50 relative z-10 backdrop-blur-sm">
          <Icon className="w-12 h-12 text-on-surface-variant stroke-[1.5]" />
        </div>
      </div>
      <div className="flex flex-col gap-sm items-center max-w-sm">
        <h3 className="font-headline-md text-headline-md text-on-surface">{title}</h3>
        {description && <p className="font-body-md text-body-md text-on-surface-variant">{description}</p>}
      </div>
      {action && <div className="mt-sm">{action}</div>}
    </div>
  );
});
EmptyState.displayName = 'EmptyState';
