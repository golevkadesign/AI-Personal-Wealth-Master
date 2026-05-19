import { z } from 'zod';
import { TerminalState } from '../types/terminal';

const ALLOWED_SDUI_COMPONENTS = new Set([
  'ActionButton',
  'ActionGroup',
  'Badge',
  'Box',
  'ChartWidget',
  'DynamicChart',
  'EChartsPie',
  'Flex',
  'Grid',
  'InterventionCard',
  'MetricCard',
  'MetricsCard',
  'SystemAlert',
  'Timeline12X',
  'Typography',
]);

const MAX_SDUI_DEPTH = 5;
const MAX_SDUI_NODES = 40;
const MAX_CHILDREN_PER_NODE = 12;
const MAX_STRING_LENGTH = 3000;
const MAX_CLASS_TOKENS = 24;

// 核心预处理：容错转换，保留 undefined 穿透
const laxNumber = z.preprocess((val) => {
  if (val === undefined || val === null) return undefined;
  if (typeof val === 'string') {
    const parsed = parseFloat(val.replace(/,/g, ''));
    return isNaN(parsed) ? undefined : parsed;
  }
  return Number(val);
}, z.number().optional().catch(undefined));

const laxString = z.preprocess((val) => {
  if (val === undefined || val === null) return undefined;
  return String(val);
}, z.string().optional().catch(undefined));

const laxStringArray = z.preprocess((val) => {
  if (val === undefined || val === null) return undefined;
  if (!Array.isArray(val)) return undefined;
  return val.map(String);
}, z.array(z.string()).optional().catch(undefined));

const optionalArray = <T extends z.ZodTypeAny>(schema: T) => z.preprocess((val) => {
  if (val === undefined || val === null) return undefined;
  return Array.isArray(val) ? val : undefined;
}, z.array(schema).optional().catch(undefined));

const DistributionItemSchema = z.object({
  id: laxString,
  name: laxString,
  value: laxNumber,
  currency: laxString,
  category: laxString,
  type: laxString,
}).catchall(z.any()); // 允许保留大模型下发的额外有用字段

const MetricsSchema = z.object({
  netWorth: laxNumber,
  netWorthSummary: laxString,
  liquidity: laxNumber,
  liquiditySummary: laxString,
  safetyRatio: laxNumber,
  safetyRatioSummary: laxString,
  fcf: laxNumber,
  fcfSummary: laxString,
}).catchall(z.any());

const UserPersonaSchema = z.object({
  tags: laxStringArray,
  description: laxString,
}).catchall(z.any());

const GoalSchema = z.object({
  name: laxString,
  current: laxNumber,
  target: laxNumber,
  index: laxNumber,
}).catchall(z.any());

const InsightsSchema = z.object({
  global: laxString,
  private: laxString,
  public: z.any().optional(), // keeping original format (sometimes array)
}).catchall(z.any());

const LifeStrategySchema = z.object({
  title: laxString,
  description: laxString,
  timeNode: laxString,
}).catchall(z.any());

const SnapshotSchema = z.object({
  timestamp: laxNumber,
  metrics: z.any().optional(),
  distributions: z.any().optional(),
}).catchall(z.any());

function sanitizeClassName(value: unknown) {
  if (typeof value !== 'string') return undefined;
  const safeTokens = value
    .split(/\s+/)
    .filter(token => /^[a-zA-Z0-9_:/.[\]()%#-]+$/.test(token))
    .slice(0, MAX_CLASS_TOKENS);

  return safeTokens.length > 0 ? safeTokens.join(' ') : undefined;
}

function sanitizeSduiProp(value: any): any {
  if (value === undefined || value === null) return undefined;
  if (typeof value === 'string') return value.slice(0, MAX_STRING_LENGTH);
  if (typeof value === 'number') return Number.isFinite(value) ? value : undefined;
  if (typeof value === 'boolean') return value;
  if (Array.isArray(value)) {
    return value.slice(0, MAX_CHILDREN_PER_NODE).map(sanitizeSduiProp).filter(v => v !== undefined);
  }
  if (typeof value === 'object') {
    const clean: Record<string, any> = {};
    for (const [key, childValue] of Object.entries(value).slice(0, 40)) {
      if (key.startsWith('on') || key === 'style' || key === 'dangerouslySetInnerHTML' || key === 'ref') {
        continue;
      }
      const sanitized = sanitizeSduiProp(childValue);
      if (sanitized !== undefined) clean[key] = sanitized;
    }
    return clean;
  }
  return undefined;
}

function sanitizeSduiProps(rawProps: any) {
  if (!rawProps || typeof rawProps !== 'object' || Array.isArray(rawProps)) return {};
  const clean: Record<string, any> = {};

  for (const [key, value] of Object.entries(rawProps).slice(0, 40)) {
    if (key.startsWith('on') || key === 'style' || key === 'dangerouslySetInnerHTML' || key === 'ref') {
      continue;
    }

    const sanitized = key === 'className' ? sanitizeClassName(value) : sanitizeSduiProp(value);
    if (sanitized !== undefined) clean[key] = sanitized;
  }

  return clean;
}

function sanitizeSduiTree(input: any, depth = 0, counter = { count: 0 }): any | undefined {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return undefined;
  if (depth > MAX_SDUI_DEPTH || counter.count >= MAX_SDUI_NODES) return undefined;

  const type = typeof input.type === 'string' ? input.type : (typeof input.component === 'string' ? input.component : '');
  if (!ALLOWED_SDUI_COMPONENTS.has(type)) return undefined;

  counter.count += 1;

  const node: Record<string, any> = {
    type,
    props: sanitizeSduiProps(input.props),
  };

  if (typeof input.id === 'string' && input.id.trim()) {
    node.id = input.id.slice(0, 128);
  }

  if (Array.isArray(input.children) && depth < MAX_SDUI_DEPTH) {
    const children = input.children
      .slice(0, MAX_CHILDREN_PER_NODE)
      .map((child: any) => sanitizeSduiTree(child, depth + 1, counter))
      .filter(Boolean);
    if (children.length > 0) node.children = children;
  }

  return node;
}

const SduiArraySchema = z.preprocess((val) => {
  if (!Array.isArray(val)) return undefined;
  const counter = { count: 0 };
  const clean = val
    .slice(0, MAX_CHILDREN_PER_NODE)
    .map(item => sanitizeSduiTree(item, 0, counter))
    .filter(Boolean);
  return clean.length > 0 ? clean : undefined;
}, z.array(z.any()).optional().catch(undefined));

// 组合出增量更新的 Schema
const TerminalStatePatchSchema = z.object({
  userPersona: UserPersonaSchema.optional(),
  userProfile: z.record(z.string(), z.any()).optional(),
  metrics: MetricsSchema.optional(),
  distributions: z.object({
    liquidity: optionalArray(DistributionItemSchema),
    expenses: optionalArray(DistributionItemSchema),
    privateAssets: optionalArray(DistributionItemSchema),
    publicHoldings: optionalArray(DistributionItemSchema),
    fixedAssets: optionalArray(DistributionItemSchema),
    options: optionalArray(DistributionItemSchema),
  }).catchall(z.any()).optional(),
  goal: GoalSchema.optional(),
  insights: InsightsSchema.optional(),
  lifeStrategiesShort: optionalArray(LifeStrategySchema),
  lifeStrategiesLong: optionalArray(LifeStrategySchema),
  dynamicWidgets: SduiArraySchema,
  dashboardSchema: SduiArraySchema,
  historicalSnapshots: optionalArray(SnapshotSchema),
  _liveSources: optionalArray(z.string()),
}).strip();

function stripUndefinedDeep(value: any): any {
  if (Array.isArray(value)) {
    return value.map(stripUndefinedDeep).filter(item => item !== undefined);
  }
  if (value && typeof value === 'object') {
    const clean: Record<string, any> = {};
    for (const [key, childValue] of Object.entries(value)) {
      const nextValue = stripUndefinedDeep(childValue);
      if (nextValue !== undefined) clean[key] = nextValue;
    }
    return clean;
  }
  return value === undefined ? undefined : value;
}

export function sanitizeTerminalState(rawPayload: any): Partial<TerminalState> {
  if (!rawPayload || typeof rawPayload !== 'object') return {};
  
  // 使用 safeParse 进行防御性清洗
  const result = TerminalStatePatchSchema.safeParse(rawPayload);
  if (!result.success) {
    console.warn("Zod Sanitizer Warning: rejected unsafe terminal patch", result.error);
    return {};
  }
  
  return stripUndefinedDeep(result.data) as Partial<TerminalState>;
}
