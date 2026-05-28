export const DASHBOARD_LAYOUT = {
  metric: {
    minHeight: '180px',
    className: 'min-h-[180px]'
  },
  chart: {
    sm: { chartHeight: '180px', className: 'min-h-[280px]' },
    md: { chartHeight: '240px', className: 'min-h-[340px]' },
    lg: { chartHeight: '300px', className: 'min-h-[400px]' },
    auto: { chartHeight: 'auto', className: 'min-h-[280px]' }
  },
  grid: {
    metrics: 'grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5 md:gap-6',
    charts: 'grid-cols-1 xl:grid-cols-2 2xl:grid-cols-3 gap-6',
    sections: 'grid-cols-1 gap-6'
  }
};
