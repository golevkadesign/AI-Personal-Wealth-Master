import React from 'react';
import { cn } from '../../lib/utils';

export interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  size?: 'sm' | 'md' | 'lg';
}

export const IconButton = React.forwardRef<HTMLButtonElement, IconButtonProps>(({
  className,
  size = 'md',
  children,
  ...props
}, ref) => {
  return (
    <button
      ref={ref}
      className={cn(
        'inline-flex items-center justify-center rounded-full text-on-surface-variant hover:text-primary hover:bg-surface-variant/30 transition-colors focus:outline-none focus:ring-2 focus:ring-primary/50 disabled:opacity-50 disabled:pointer-events-none',
        {
          'p-1': size === 'sm',
          'p-2': size === 'md',
          'p-3': size === 'lg',
        },
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
});
IconButton.displayName = 'IconButton';
