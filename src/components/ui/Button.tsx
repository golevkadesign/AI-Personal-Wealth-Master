import React from 'react';
import { cn } from '../../lib/utils';
import { Loader2 } from 'lucide-react';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'terminal';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(({
  className,
  variant = 'primary',
  size = 'md',
  isLoading = false,
  children,
  disabled,
  ...props
}, ref) => {
  return (
    <button
      ref={ref}
      disabled={disabled || isLoading}
      className={cn(
        'inline-flex items-center justify-center rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-primary/50 font-body-md font-medium disabled:opacity-50 disabled:pointer-events-none',
        {
          'bg-primary-container text-background hover:opacity-90': variant === 'primary',
          'bg-transparent border border-primary-container text-primary-container hover:bg-primary-container/10': variant === 'secondary',
          'bg-transparent text-on-surface-variant hover:text-primary hover:bg-surface-variant/30': variant === 'ghost',
          'bg-surface-variant/30 text-on-surface font-data-md border border-outline-variant/50 hover:bg-surface-variant/50 uppercase tracking-widest rounded': variant === 'terminal',
          
          'px-3 py-1.5 text-sm': size === 'sm',
          'px-4 py-2 text-base': size === 'md',
          'px-6 py-3 text-lg': size === 'lg',
        },
        className
      )}
      {...props}
    >
      {isLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
      {children}
    </button>
  );
});
Button.displayName = 'Button';
