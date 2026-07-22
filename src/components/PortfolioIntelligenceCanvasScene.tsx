import React from 'react';
import { AW_CHART_TOKENS } from '../lib/design-tokens';
import {
  PortfolioIntelligenceMap,
} from '../types/portfolio-intelligence';
import { ReactECharts } from './ReactECharts';

interface PortfolioIntelligenceCanvasSceneProps {
  intelligenceMap: PortfolioIntelligenceMap;
  compact?: boolean;
}

export function PortfolioIntelligenceCanvasScene({
  intelligenceMap,
  compact = false,
}: PortfolioIntelligenceCanvasSceneProps) {
  const option = React.useMemo(() => {
    const axes = intelligenceMap.axes;
    const maxAxisValue = Math.max(
      100,
      ...axes.flatMap((axis) => [axis.value, axis.projectedValue]),
    );
    const currentValues = axes.map((axis) => Math.max(0, axis.value));
    const projectedValues = axes.map((axis) => Math.max(0, axis.projectedValue));
    const positionWeightByAxis = axes.map((axis) => {
      return intelligenceMap.positions
        .filter((position) => position.axis === axis.id)
        .reduce((sum, position) => sum + Math.max(0, position.weight), 0);
    });

    return {
      color: axes.map((axis) => axis.color),
      tooltip: {
        trigger: 'item',
      },
      radar: {
        center: ['50%', compact ? '55%' : '53%'],
        radius: compact ? '70%' : '76%',
        splitNumber: 5,
        indicator: axes.map((axis) => ({
          name: axis.labelKey,
          max: maxAxisValue,
        })),
        axisName: {
          show: false,
        },
        axisLine: {
          lineStyle: {
            color: AW_CHART_TOKENS.borderSubtle,
          },
        },
        splitLine: {
          lineStyle: {
            color: AW_CHART_TOKENS.borderSubtle,
          },
        },
        splitArea: {
          show: true,
          areaStyle: {
            color: ['rgb(238 243 234 / 0.018)', 'rgb(238 243 234 / 0.006)'],
          },
        },
      },
      series: [
        {
          name: 'Current Exposure',
          type: 'radar',
          symbol: 'circle',
          symbolSize: compact ? 4 : 5,
          data: [
            {
              value: currentValues,
              name: 'Current Exposure',
              lineStyle: {
                color: AW_CHART_TOKENS.success,
                width: 1.8,
              },
              areaStyle: {
                color: 'rgb(168 201 163 / 0.14)',
              },
              itemStyle: {
                color: AW_CHART_TOKENS.success,
              },
            },
            {
              value: projectedValues,
              name: 'Projected Exposure',
              lineStyle: {
                color: AW_CHART_TOKENS.info,
                width: 1.4,
                type: 'dashed',
              },
              areaStyle: {
                color: 'rgb(159 182 217 / 0.08)',
              },
              itemStyle: {
                color: AW_CHART_TOKENS.info,
              },
            },
          ],
        },
        {
          name: 'Axis Weight',
          type: 'bar',
          coordinateSystem: 'polar',
          roundCap: true,
          barWidth: compact ? 4 : 6,
          data: positionWeightByAxis.map((value, index) => ({
            value,
            itemStyle: {
              color: axes[index]?.color || AW_CHART_TOKENS.success,
              opacity: 0.34,
            },
          })),
          polarIndex: 0,
          silent: true,
        },
      ],
      polar: {
        center: ['50%', compact ? '55%' : '53%'],
        radius: compact ? '74%' : '80%',
      },
      angleAxis: {
        type: 'category',
        data: axes.map((axis) => axis.id),
        show: false,
      },
      radiusAxis: {
        show: false,
        max: Math.max(maxAxisValue, ...positionWeightByAxis, 100),
      },
    };
  }, [compact, intelligenceMap]);

  return (
    <div
      className="aw-pim-canvas"
      data-arbitra-portfolio-intelligence-canvas="true"
      aria-hidden="true"
    >
      <ReactECharts option={option} className="h-full w-full" />
    </div>
  );
}
