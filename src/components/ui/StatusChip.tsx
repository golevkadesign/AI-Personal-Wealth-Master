import React from 'react';
import { cn } from '../../lib/utils';

export interface StatusChipProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'success' | 'warning' | 'error' | 'brand';
}

export const StatusChip = React.forwardRef<HTMLSpanElement, StatusChipProps>(({
  className,
  variant = 'default',
  children,
  ...props
}, ref) => {
  return (
    <span
      ref={ref}
      className={cn(
        'inline-flex items-center px-3 py-1 rounded-full font-body-sm text-[12px] whitespace-nowrap',
        {
          'bg-outline-variant/10 text-on-surface-variant border border-outline-variant/30': variant === 'default',
          'bg-[#A39167]/10 text-[#A39167] border border-[#A39167]/20': variant === 'brand', // specifically for memory active
          'bg-trend-up/10 text-trend-up border border-trend-up/20': variant === 'success', 
          'bg-secondary/10 text-secondary border border-secondary/20': variant === 'warning',
          'bg-error/10 text-error border border-error/20': variant === 'error',
        },
        className
      )}
      {...props}
    >
      {children}
    </span>
  );
});
StatusChip.displayName = 'StatusChip';
