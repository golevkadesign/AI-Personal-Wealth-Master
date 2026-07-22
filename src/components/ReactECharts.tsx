import React, { useEffect, useRef } from 'react';
import { AW_CHART_TOKENS } from '../lib/design-tokens';

interface ReactEChartsProps {
  option: any;
  style?: React.CSSProperties;
  className?: string;
  onEvents?: Record<string, Function>;
}

export const ReactECharts: React.FC<ReactEChartsProps> = ({ option, style, className, onEvents }) => {
  const chartRef = useRef<HTMLDivElement>(null);
  const eventsRef = useRef(onEvents);
  eventsRef.current = onEvents;

  useEffect(() => {
    if (!chartRef.current) return;
    const target = chartRef.current;
    let disposed = false;
    let chartInstance: import('echarts/core').ECharts | undefined;

    const handleResize = () => chartInstance?.resize();
    window.addEventListener('resize', handleResize);

    void import('./charts/echarts-runtime').then(({ echarts }) => {
      if (disposed || !target.isConnected) return;
      chartInstance = echarts.getInstanceByDom(target) || echarts.init(target, 'dark', { renderer: 'canvas' });
      chartInstance.setOption({
        backgroundColor: 'transparent',
        textStyle: { fontFamily: 'Inter, sans-serif' },
        ...option,
        tooltip: {
          backgroundColor: AW_CHART_TOKENS.surface,
          borderColor: AW_CHART_TOKENS.border,
          textStyle: { color: AW_CHART_TOKENS.text },
          ...(option.tooltip || {}),
        },
      }, true);

      if (eventsRef.current) {
        Object.entries(eventsRef.current).forEach(([eventName, handler]) => {
          chartInstance?.off(eventName);
          chartInstance?.on(eventName, handler as any);
        });
      }
      chartInstance.resize();
    });

    return () => {
      disposed = true;
      window.removeEventListener('resize', handleResize);
      chartInstance?.dispose();
    };
  }, [option]);

  return <div ref={chartRef} className={className} style={{ width: '100%', height: '100%', ...style }} />;
};
