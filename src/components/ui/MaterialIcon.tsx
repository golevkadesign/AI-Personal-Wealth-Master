import React from 'react';

type MaterialIconProps = {
  name: string;
  size?: 16 | 20 | 24 | 32;
  filled?: boolean;
  className?: string;
  title?: string;
  'aria-hidden'?: boolean;
};

export function MaterialIcon({
  name,
  size = 20,
  filled = false,
  className = '',
  title,
  'aria-hidden': ariaHidden = true,
}: MaterialIconProps) {
  return (
    <span
      className={`material-symbols-rounded aw-icon ${filled ? 'aw-icon-filled' : ''} ${className}`.trim()}
      style={{ fontSize: size }}
      title={title}
      aria-hidden={ariaHidden}
    >
      {name}
    </span>
  );
}
