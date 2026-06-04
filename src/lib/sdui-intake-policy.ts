import { SDUIComponent } from '../types/terminal';
import { normalizeSDUISchema } from './sdui-normalizer';

function hasActionOrPrompt(widget: SDUIComponent): boolean {
  if (widget.props) {
    if (widget.props.actionIntent || widget.props.prompt) {
      return true;
    }
    if (Array.isArray(widget.props.actions)) {
      for (const act of widget.props.actions) {
        if (act && (act.actionIntent || act.prompt)) return true;
      }
    }
    if (Array.isArray(widget.props.buttons)) {
      for (const btn of widget.props.buttons) {
        if (btn && (btn.actionIntent || btn.prompt)) return true;
      }
    }
  }
  if (Array.isArray(widget.children)) {
    for (const child of widget.children) {
      if (hasActionOrPrompt(child)) return true;
    }
  }
  return false;
}

function getWidgetPriority(widget: SDUIComponent): number {
  if (typeof widget.props?.priority === 'number') {
    return widget.props.priority;
  }
  if (widget.type === 'InterventionCard') {
    const level = widget.props?.level;
    if (level === 'critical') return 10000;
    if (level === 'warning') return 5000;
  }
  if (hasActionOrPrompt(widget)) {
    return 1000;
  }
  return 100; // default priority
}

function extractTypographyTexts(children: SDUIComponent[] | undefined, texts: string[] = []): string[] {
  if (!children) return texts;
  for (const child of children) {
    if (child.type === 'Typography' && typeof child.props?.text === 'string') {
      texts.push(child.props.text);
    } else if (child.type === 'Typography' && typeof child.props?.children === 'string') {
      texts.push(child.props.children);
    }
    if (child.children) {
      extractTypographyTexts(child.children, texts);
    }
  }
  return texts;
}

function getWidgetFingerprint(widget: SDUIComponent): string {
  let rawText = '';
  if (typeof widget.props?.title === 'string' && widget.props.title.trim() !== '') {
    rawText = widget.props.title;
  } else if (typeof widget.props?.description === 'string' && widget.props.description.trim() !== '') {
    rawText = widget.props.description;
  } else {
    const extracted = extractTypographyTexts(widget.children);
    if (extracted.length > 0) {
      rawText = extracted.slice(0, 3).join('|');
    }
  }

  if (!rawText) {
    return `empty-fp-${Math.random().toString(36).substring(2, 9)}`;
  }

  return rawText.toLowerCase().replace(/\s+/g, '').slice(0, 100);
}

function cleanComponentActions(component: SDUIComponent): SDUIComponent {
  const cleanedChildren = component.children
    ? component.children.map(child => cleanComponentActions(child))
    : undefined;

  const props = { ...component.props };

  if (component.type === 'InterventionCard' && Array.isArray(props.actions)) {
    const validActions = props.actions
      .map((action: any) => {
        if (!action || typeof action !== 'object') return null;
        const label = action.label || action.text || '';
        const actionIntent = action.actionIntent || '';
        const prompt = action.prompt || '';
        if (!label || (!actionIntent && !prompt)) return null;

        return {
          label,
          actionIntent,
          prompt
        };
      })
      .filter((act): act is any => act !== null);

    props.actions = validActions.slice(0, 2);
  }

  if (component.type === 'ActionGroup' && Array.isArray(props.buttons)) {
    const validButtons = props.buttons
      .map((btn: any) => {
        if (!btn || typeof btn !== 'object') return null;
        const label = btn.label || btn.text || '';
        const actionIntent = btn.actionIntent || '';
        const prompt = btn.prompt || '';
        if (!label || (!actionIntent && !prompt)) return null;

        return {
          label,
          actionIntent,
          prompt
        };
      })
      .filter((btn): btn is any => btn !== null);

    props.buttons = validButtons.slice(0, 2);
  }

  const result: SDUIComponent = {
    ...component,
    props,
  };

  if (cleanedChildren) {
    result.children = cleanedChildren.filter(child => {
      if (child.type === 'ActionButton') {
        const label = child.props?.label || child.props?.text || '';
        const actionIntent = child.props?.actionIntent || child.props?.prompt || child.props?.text || '';
        const prompt = child.props?.prompt || '';
        return Boolean(label && (actionIntent || prompt));
      }
      return true;
    });
  }

  return result;
}

export function normalizeDynamicWidgetsForDashboard(rawWidgets: any): SDUIComponent[] {
  const rawCount = Array.isArray(rawWidgets) ? rawWidgets.length : 0;
  const normalized = normalizeSDUISchema(rawWidgets);
  const normalizedCount = normalized.length;

  // Process unique fingerprints keeping only highest priority ones
  const fingerprintedMap = new Map<string, { priority: number; widget: SDUIComponent }>();

  for (const widget of normalized) {
    const priority = getWidgetPriority(widget);
    const fingerprint = getWidgetFingerprint(widget);
    const existing = fingerprintedMap.get(fingerprint);

    if (!existing || priority > existing.priority) {
      // Clean components to obey action limits and structural correctness
      const cleaned = cleanComponentActions(widget);
      fingerprintedMap.set(fingerprint, { priority, widget: cleaned });
    }
  }

  // Sort unique widgets by priority descending
  const sortedAndDeduplicated = Array.from(fingerprintedMap.values())
    .sort((a, b) => b.priority - a.priority)
    .map(item => item.widget);

  // Apply limitation strategies:
  // 1. Max 1 InterventionCard
  // 2. Max 3 top-level widgets in total
  const finalWidgets: SDUIComponent[] = [];
  let interventionCardCount = 0;

  for (const widget of sortedAndDeduplicated) {
    if (widget.type === 'InterventionCard') {
      if (interventionCardCount >= 1) {
        continue;
      }
      interventionCardCount++;
    }
    finalWidgets.push(widget);
    if (finalWidgets.length >= 3) {
      break;
    }
  }

  const finalCount = finalWidgets.length;
  const droppedCount = rawCount - finalCount;

  if (process.env.NODE_ENV !== 'production' && finalCount > 0) {
    console.info(`[SDUI Intake Policy] Raw: ${rawCount}, Normalized: ${normalizedCount}, Final: ${finalCount}, Dropped: ${droppedCount}`);
  }

  return finalWidgets;
}
