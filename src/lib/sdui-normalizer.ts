import { SDUIComponent } from '../types/terminal';

const ALLOWED_COMPONENTS = new Set([
  'Grid', 'MetricCard', 'DynamicChart', 'Flex', 'Box', 
  'Typography', 'Badge', 'ActionButton', 'ChartWidget', 
  'MetricsCard', 'EChartsPie', 'Timeline12X', 'SystemAlert', 
  'InterventionCard', 'ActionGroup'
]);

const ALLOWED_CHART_TYPES = new Set([
  'liquidity', 'expenses', 'privateAssets', 'publicHoldings', 'fixedAssets', 'options'
]);

const DANGEROUS_CLASS_REGEX = /\b(fixed|absolute|inset(-x|-y|-[trbl])?|z-\[\d+\]|z-[1-9]\d+|h-screen|w-screen|overflow-hidden)\b/g;

export function normalizeSDUISchema(schema: any, depth = 0): SDUIComponent[] {
  if (depth > 10) {
    if (process.env.NODE_ENV !== 'production') console.warn('[SDUI Normalizer] Max depth exceeded');
    return [];
  }
  
  if (!Array.isArray(schema)) {
    if (process.env.NODE_ENV !== 'production') console.warn('[SDUI Normalizer] Schema is not an array:', schema);
    return [];
  }

  const normalized: SDUIComponent[] = [];

  for (const block of schema) {
    if (!block || typeof block !== 'object') continue;

    const type = block.type || block.component;
    if (!type || typeof type !== 'string' || !ALLOWED_COMPONENTS.has(type)) {
      if (process.env.NODE_ENV !== 'production') console.warn(`[SDUI Normalizer] Removed disallowed component: ${type}`);
      continue;
    }

    let props = block.props;
    if (!props || typeof props !== 'object' || Array.isArray(props)) {
      props = {};
    }

    // Grid specific normalization
    if (type === 'Grid') {
      if (typeof props.columns === 'number' && ![1, 2, 3, 4].includes(props.columns)) {
        props.columns = 1;
      }
      if (typeof props.gap === 'number' && (props.gap < 0 || props.gap > 12)) {
        props.gap = 6;
      }
    }

    // DynamicChart specific normalization
    if (type === 'DynamicChart') {
      if (props.chartType && !ALLOWED_CHART_TYPES.has(props.chartType)) {
         if (process.env.NODE_ENV !== 'production') console.warn(`[SDUI Normalizer] Invalid chartType: ${props.chartType}`);
         props.chartType = 'liquidity';
      }
    }

    // ClassName normalization
    if (typeof props.className === 'string') {
       props.className = props.className.replace(DANGEROUS_CLASS_REGEX, '').trim();
    }

    let children: SDUIComponent[] | undefined = undefined;
    if (block.children) {
      children = normalizeSDUISchema(block.children, depth + 1);
      if (children.length === 0) {
        children = undefined;
      }
    }

    const normalizedBlock: SDUIComponent = {
      id: typeof block.id === 'string' ? block.id : `sdui-${Math.random().toString(36).substring(2, 9)}`,
      type,
      props,
    };
    if (children) {
      normalizedBlock.children = children;
    }

    normalized.push(normalizedBlock);
  }

  return normalized;
}
