import React from 'react';
import { cn } from '../../lib/utils';
import { LucideIcon } from 'lucide-react';

interface SectionHeaderProps extends React.HTMLAttributes<HTMLDivElement> {
  title: string;
  icon?: LucideIcon;
  action?: React.ReactNode;
}

export const SectionHeader = React.forwardRef<HTMLDivElement, SectionHeaderProps>(({
  className,
  title,
  icon: Icon,
  action,
  ...props
}, ref) => {
  return (
    <div ref={ref} className={cn('flex justify-between items-end mb-lg', className)} {...props}>
      <div className="flex items-center gap-sm">
        {Icon && <Icon className="w-6 h-6 text-primary" />}
        <h2 className="font-headline-lg text-headline-lg text-on-surface tracking-tight">{title}</h2>
      </div>
      {action && <div>{action}</div>}
    </div>
  );
});
SectionHeader.displayName = 'SectionHeader';
