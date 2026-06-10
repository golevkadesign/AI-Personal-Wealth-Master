import React, { useEffect, useRef } from 'react';
import * as echarts from 'echarts';
import { AW_CHART_TOKENS } from '../lib/design-tokens';

interface ReactEChartsProps {
  option: any;
  style?: React.CSSProperties;
  className?: string;
  onEvents?: Record<string, Function>;
}

export const ReactECharts: React.FC<ReactEChartsProps> = ({ option, style, className, onEvents }) => {
  const chartRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!chartRef.current) return;

    let chartInstance = echarts.getInstanceByDom(chartRef.current);
    if (!chartInstance) {
      chartInstance = echarts.init(chartRef.current, 'dark', { renderer: 'canvas' });
    }

    chartInstance.setOption({
      backgroundColor: 'transparent',
      textStyle: { fontFamily: 'Inter, sans-serif' },
      ...option,
      tooltip: { 
        backgroundColor: AW_CHART_TOKENS.surface,
        borderColor: AW_CHART_TOKENS.border,
        textStyle: { color: AW_CHART_TOKENS.text },
        ...(option.tooltip || {})
      }
    }, true);

    if (onEvents) {
      Object.keys(onEvents).forEach((eventName) => {
        chartInstance?.off(eventName); // 防重复绑定
        chartInstance?.on(eventName, onEvents[eventName] as any);
      });
    }

    const handleResize = () => chartInstance?.resize();
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      chartInstance?.dispose();
    };
  }, [option]);

  return <div ref={chartRef} className={className} style={{ width: '100%', height: '100%', ...style }} />;
};
