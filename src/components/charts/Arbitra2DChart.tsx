import React from 'react';
import { AW_CHART_TOKENS, getAwChartPalette, readCssToken } from '../../lib/design-tokens';
import { useTranslation } from '../../hooks/useTranslation';
import { ReactECharts } from '../ReactECharts';
import { MaterialIcon } from '../ui/MaterialIcon';

export type ThreeChartVariant = 'auto' | 'bars' | 'donut' | 'radial' | 'route' | 'evidence';

export interface ArbitraChartDatum {
  name: string;
  value: number;
  color?: string;
  currency?: string;
  meta?: unknown;
}

interface Arbitra2DChartProps {
  option?: any;
  type?: string;
  data?: ArbitraChartDatum[];
  variant?: ThreeChartVariant;
  className?: string;
  compact?: boolean;
  onDataClick?: (params: any) => void;
}

const FALLBACK_PALETTE: string[] = [...AW_CHART_TOKENS.palette];

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function cleanColor(input: string | undefined, fallback: string = AW_CHART_TOKENS.success) {
  const value = (input || '').trim();
  if (!value) return fallback;
  if (/^#[0-9a-f]{8}$/i.test(value)) return value.slice(0, 7);
  if (/^#([0-9a-f]{6}|[0-9a-f]{3})$/i.test(value)) return value;
  if (value.startsWith('rgb')) {
    const nums = value.match(/[\d.]+/g);
    if (nums && nums.length >= 3) {
      const toHex = (channel: number) => clamp(Math.round(channel), 0, 255).toString(16).padStart(2, '0');
      return `#${toHex(Number(nums[0]))}${toHex(Number(nums[1]))}${toHex(Number(nums[2]))}`;
    }
  }
  return fallback;
}

function getSeries(option: any) {
  const series = option?.series;
  return Array.isArray(series) ? series : series ? [series] : [];
}

function numericValue(input: any): number {
  if (typeof input === 'number') return Number.isFinite(input) ? input : 0;
  if (input && typeof input === 'object') return numericValue(input.value);
  return 0;
}

function axisData(axis: any): string[] {
  const item = Array.isArray(axis) ? axis[0] : axis;
  return Array.isArray(item?.data) ? item.data.map((value: any) => String(value)) : [];
}

function dataFromOption(option: any, palette: string[]): ArbitraChartDatum[] {
  const series = getSeries(option);
  const pie = series.find((item: any) => item?.type === 'pie');
  if (pie) {
    return (pie.data || []).map((item: any, index: number) => ({
      name: String(item?.name || `item-${index + 1}`),
      value: numericValue(item),
      color: cleanColor(item?.itemStyle?.color || palette[index % palette.length]),
      meta: item,
    }));
  }

  const visibleSeries = series.find((item: any) => item?.type === 'bar' && item?.itemStyle?.color !== 'transparent') || series[0];
  const values = Array.isArray(visibleSeries?.data) ? visibleSeries.data.map(numericValue) : [];
  const labels = axisData(option?.yAxis).length ? axisData(option?.yAxis) : axisData(option?.xAxis);
  return values.map((value: number, index: number) => ({
    name: labels[index] || `item-${index + 1}`,
    value,
    color: cleanColor(visibleSeries?.itemStyle?.color || palette[index % palette.length]),
  }));
}

function normalizeData(input: ArbitraChartDatum[], variant: ThreeChartVariant, palette: string[]): ArbitraChartDatum[] {
  const filtered = input
    .filter(Boolean)
    .map((item, index) => ({
      ...item,
      name: item.name || `item-${index + 1}`,
      value: Number.isFinite(Number(item.value)) ? Number(item.value) : 0,
      color: cleanColor(item.color, palette[index % palette.length]),
    }));

  return filtered;
}

function inferVariant(type: string | undefined, option: any, requested: ThreeChartVariant): ThreeChartVariant {
  if (requested && requested !== 'auto') return requested;
  if (type === 'liquidity' || type === 'expenses') return 'donut';
  if (type === 'publicHoldings') return 'donut';
  if (type === 'options' || type === 'privateAssets') return 'bars';
  if (getSeries(option).some((item: any) => item?.type === 'pie')) return 'donut';
  return 'bars';
}

function commonTextColor() {
  return readCssToken('--aw-text-tertiary', AW_CHART_TOKENS.textMuted);
}

function commonAxisStyle() {
  const axis = readCssToken('--aw-border-subtle', AW_CHART_TOKENS.borderSubtle);
  const text = commonTextColor();
  return {
    axisLine: { lineStyle: { color: axis } },
    axisTick: { lineStyle: { color: axis } },
    axisLabel: { color: text, fontFamily: 'Inter, sans-serif', fontSize: 12 },
    splitLine: { lineStyle: { color: axis, type: 'dashed' } },
  };
}

function mergeAxisStyle(axisStyle: ReturnType<typeof commonAxisStyle>, axis: any) {
  return {
    ...axisStyle,
    ...axis,
    axisLine: {
      ...axisStyle.axisLine,
      ...(axis?.axisLine || {}),
      lineStyle: { ...axisStyle.axisLine.lineStyle, ...(axis?.axisLine?.lineStyle || {}) },
    },
    axisTick: {
      ...axisStyle.axisTick,
      ...(axis?.axisTick || {}),
      lineStyle: { ...axisStyle.axisTick.lineStyle, ...(axis?.axisTick?.lineStyle || {}) },
    },
    axisLabel: { ...axisStyle.axisLabel, ...(axis?.axisLabel || {}) },
    splitLine: {
      ...axisStyle.splitLine,
      ...(axis?.splitLine || {}),
      lineStyle: { ...axisStyle.splitLine.lineStyle, ...(axis?.splitLine?.lineStyle || {}) },
    },
  };
}

function enhanceExternalOption(option: any, palette: string[]) {
  const axisStyle = commonAxisStyle();
  const series = getSeries(option).map((item: any, index: number) => {
    if (item?.type === 'pie') {
      return {
        ...item,
        color: item.color || palette,
        label: item.label || { show: false },
        labelLine: item.labelLine || { show: false },
        itemStyle: {
          borderColor: readCssToken('--aw-card-bg', AW_CHART_TOKENS.surface),
          borderWidth: 2,
          ...(item.itemStyle || {}),
        },
      };
    }
    if (item?.type === 'bar') {
      return {
        ...item,
        barMaxWidth: item.barMaxWidth || 10,
        itemStyle: {
          borderRadius: [999, 999, 0, 0],
          color: item.itemStyle?.color || palette[index % palette.length],
          ...(item.itemStyle || {}),
        },
      };
    }
    if (item?.type === 'line') {
      return {
        ...item,
        smooth: item.smooth ?? true,
        symbol: item.symbol || 'circle',
        symbolSize: item.symbolSize || 5,
        lineStyle: {
          width: 1.6,
          color: item.lineStyle?.color || palette[index % palette.length],
          ...(item.lineStyle || {}),
        },
      };
    }
    return item;
  });

  return {
    ...option,
    color: option.color || palette,
    grid: option.grid || { left: 8, right: 8, top: 14, bottom: 12, containLabel: true },
    xAxis: option.xAxis
      ? Array.isArray(option.xAxis)
        ? option.xAxis.map((axis: any) => mergeAxisStyle(axisStyle, axis))
        : mergeAxisStyle(axisStyle, option.xAxis)
      : option.xAxis,
    yAxis: option.yAxis
      ? Array.isArray(option.yAxis)
        ? option.yAxis.map((axis: any) => mergeAxisStyle(axisStyle, axis))
        : mergeAxisStyle(axisStyle, option.yAxis)
      : option.yAxis,
    series,
  };
}

function buildDonutOption(data: ArbitraChartDatum[], compact: boolean, palette: string[]) {
  const hasVisibleData = data.some((item) => Math.max(0, item.value) > 0);

  return {
    color: data.map((item, index) => item.color || palette[index % palette.length]),
    tooltip: hasVisibleData
      ? {
          trigger: 'item',
          formatter: '{b}<br/>{c} ({d}%)',
        }
      : { show: false },
    series: [
      {
        type: 'pie',
        radius: compact ? ['55%', '78%'] : ['50%', '76%'],
        center: ['50%', '52%'],
        minAngle: 4,
        avoidLabelOverlap: true,
        label: { show: false },
        labelLine: { show: false },
        itemStyle: {
          borderColor: readCssToken('--aw-card-bg', AW_CHART_TOKENS.surface),
          borderWidth: compact ? 2 : 3,
        },
        data: data.map((item) => ({
          name: item.name,
          value: Math.max(0, item.value),
          itemStyle: { color: item.color },
          meta: item.meta,
        })),
      },
    ],
  };
}

function buildBarOption(data: ArbitraChartDatum[], compact: boolean, palette: string[]) {
  const axisStyle = commonAxisStyle();
  return {
    color: palette,
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      formatter: (params: any[]) => {
        const point = params?.[0];
        return point ? `${point.name}<br/>${Number(point.value).toLocaleString()}` : '';
      },
    },
    grid: compact
      ? { left: 4, right: 4, top: 6, bottom: 4, containLabel: false }
      : { left: 8, right: 8, top: 12, bottom: 10, containLabel: true },
    xAxis: {
      type: 'category',
      data: data.map((item) => item.name),
      ...axisStyle,
      axisLabel: compact ? { show: false } : axisStyle.axisLabel,
      axisTick: { show: false },
    },
    yAxis: {
      type: 'value',
      ...axisStyle,
      axisLabel: compact ? { show: false } : axisStyle.axisLabel,
    },
    series: [
      {
        type: 'bar',
        data: data.map((item, index) => ({
          name: item.name,
          value: item.value,
          itemStyle: { color: item.color || palette[index % palette.length] },
          meta: item.meta,
        })),
        barMaxWidth: compact ? 7 : 10,
        itemStyle: {
          borderRadius: [999, 999, 0, 0],
        },
      },
    ],
  };
}

function buildRadarOption(data: ArbitraChartDatum[], compact: boolean, palette: string[]) {
  const max = Math.max(...data.map((item) => Math.abs(item.value)), 100);
  return {
    color: palette,
    tooltip: { trigger: 'item' },
    radar: {
      center: ['50%', '52%'],
      radius: compact ? '68%' : '72%',
      splitNumber: 4,
      indicator: data.slice(0, compact ? 6 : 8).map((item) => ({ name: item.name, max })),
      axisName: {
        show: false,
      },
      axisLine: { lineStyle: { color: readCssToken('--aw-border-subtle', AW_CHART_TOKENS.borderSubtle) } },
      splitLine: { lineStyle: { color: readCssToken('--aw-border-subtle', AW_CHART_TOKENS.borderSubtle) } },
      splitArea: { show: false },
    },
    series: [
      {
        type: 'radar',
        symbol: 'circle',
        symbolSize: compact ? 4 : 5,
        lineStyle: { width: 1.6, color: palette[0] },
        areaStyle: { color: `${palette[0]}22` },
        data: [
          {
            value: data.slice(0, compact ? 6 : 8).map((item) => Math.max(0, item.value)),
            name: 'profile',
          },
        ],
      },
    ],
  };
}

function buildRouteOption(data: ArbitraChartDatum[], compact: boolean, palette: string[], evidence = false) {
  const values = data.map((item) => Math.max(0, item.value));
  return {
    color: [evidence ? palette[3] : palette[0], palette[2]],
    tooltip: { trigger: 'axis' },
    grid: { left: 4, right: 4, top: 8, bottom: 4, containLabel: false },
    xAxis: {
      type: 'category',
      show: false,
      boundaryGap: false,
      data: data.map((item) => item.name),
    },
    yAxis: {
      type: 'value',
      show: false,
      min: 0,
    },
    series: [
      {
        type: 'line',
        smooth: true,
        symbol: 'circle',
        symbolSize: compact ? 4 : 5,
        data: values,
        lineStyle: { width: 1.5, color: evidence ? palette[3] : palette[0] },
        itemStyle: { color: evidence ? palette[3] : palette[0] },
        areaStyle: { color: `${evidence ? palette[3] : palette[0]}18` },
      },
    ],
  };
}

function buildGeneratedOption(data: ArbitraChartDatum[], variant: ThreeChartVariant, compact: boolean, palette: string[]) {
  if (variant === 'donut') return buildDonutOption(data, compact, palette);
  if (variant === 'radial') return buildRadarOption(data, compact, palette);
  if (variant === 'route' || variant === 'evidence') return buildRouteOption(data, compact, palette, variant === 'evidence');
  return buildBarOption(data, compact, palette);
}

export function Arbitra2DChart({
  option,
  type,
  data,
  variant = 'auto',
  className,
  compact = false,
  onDataClick,
}: Arbitra2DChartProps) {
  const { t } = useTranslation();
  const palette = React.useMemo(() => {
    const tokens = getAwChartPalette();
    return (tokens.length ? tokens : FALLBACK_PALETTE).map((color, index) => cleanColor(color, FALLBACK_PALETTE[index % FALLBACK_PALETTE.length]));
  }, []);

  const resolvedChart = React.useMemo(() => {
    const resolvedVariant = inferVariant(type, option, variant);
    if (option) return { option: enhanceExternalOption(option, palette), hasData: true };
    const resolvedData = normalizeData(data || dataFromOption(option, palette), resolvedVariant, palette);
    return {
      option: buildGeneratedOption(resolvedData, resolvedVariant, compact, palette),
      hasData: resolvedData.some((item) => Math.abs(item.value) > 0),
    };
  }, [compact, data, option, palette, type, variant]);

  const chartEvents = React.useMemo(() => (onDataClick ? { click: onDataClick } : undefined), [onDataClick]);

  return (
    <div
      className={`aw-2d-chart aw-legacy-2d-chart ${compact ? 'aw-2d-chart-compact' : ''} ${className || ''}`}
      data-arbitra-2d-chart="true"
      data-chart-type={type || variant}
    >
      {resolvedChart.hasData ? (
        <ReactECharts option={resolvedChart.option} onEvents={chartEvents} className="h-full w-full" />
      ) : (
        <div className="aw-2d-chart-empty" role="status">
          <div className="aw-2d-chart-empty-copy">
            <MaterialIcon name="query_stats" size={20} />
            <span>{t('charts.awaitingContext')}</span>
          </div>
        </div>
      )}
    </div>
  );
}
