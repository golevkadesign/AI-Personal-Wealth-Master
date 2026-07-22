import * as echarts from 'echarts/core';
import { BarChart, LineChart, PieChart, RadarChart } from 'echarts/charts';
import {
  DataZoomComponent,
  DatasetComponent,
  GridComponent,
  LegendComponent,
  TooltipComponent,
  TransformComponent,
} from 'echarts/components';
import { LabelLayout, UniversalTransition } from 'echarts/features';
import { CanvasRenderer } from 'echarts/renderers';

echarts.use([
  BarChart,
  LineChart,
  PieChart,
  RadarChart,
  DataZoomComponent,
  DatasetComponent,
  GridComponent,
  LegendComponent,
  TooltipComponent,
  TransformComponent,
  LabelLayout,
  UniversalTransition,
  CanvasRenderer,
]);

export { echarts };
