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

function isPlainComponent(type: string): boolean {
  return type === 'Typography' || type === 'Badge';
}

function extractInsightCandidates(widgets: SDUIComponent[]): SDUIComponent[] {
  const candidates: SDUIComponent[] = [];
  for (const widget of widgets) {
    if ((widget.type === 'Grid' || widget.type === 'Flex') && Array.isArray(widget.children) && widget.children.length > 0) {
      const subChildren = widget.children;
      // Filter out plain Typography/Badge if there are other richer elements in this Grid/Flex
      const nonPlainChildren = subChildren.filter(c => !isPlainComponent(c.type));
      if (nonPlainChildren.length > 0) {
        candidates.push(...nonPlainChildren);
      } else {
        candidates.push(...subChildren);
      }
    } else {
      candidates.push(widget);
    }
  }
  return candidates;
}

function cleanComponentActions(component: SDUIComponent): SDUIComponent {
  const cleanedChildren = component.children
    ? component.children.map(child => cleanComponentActions(child))
    : undefined;

  const props = { ...component.props };

  // 1. Clean InterventionCard.props.actions
  if (component.type === 'InterventionCard' && Array.isArray(props.actions)) {
    const validActions = props.actions
      .map((action: any) => {
        if (!action || typeof action !== 'object') return null;
        const label = action.label || action.text || '';
        const actionIntent = action.actionIntent || action.prompt || '';
        const prompt = action.prompt || '';
        if (!label || !actionIntent) return null;

        return {
          ...action,
          label,
          actionIntent,
          prompt
        };
      })
      .filter((act): act is any => act !== null);

    props.actions = validActions.slice(0, 2);
  }

  // 2. Clean ActionGroup.props.buttons
  if (component.type === 'ActionGroup' && Array.isArray(props.buttons)) {
    const validButtons = props.buttons
      .map((btn: any) => {
        if (!btn || typeof btn !== 'object') return null;
        const label = btn.label || btn.text || '';
        const actionIntent = btn.actionIntent || btn.prompt || '';
        const prompt = btn.prompt || '';
        if (!label || !actionIntent) return null;

        return {
          ...btn,
          label,
          actionIntent,
          prompt
        };
      })
      .filter((btn): btn is any => btn !== null);

    props.buttons = validButtons.slice(0, 2);
  }

  // 3. Clean ActionButton at root level if selected as a candidate itself
  if (component.type === 'ActionButton') {
    const label = props.label || props.text || '';
    const actionIntent = props.actionIntent || props.prompt || props.text || '';
    const prompt = props.prompt || '';
    if (label && actionIntent) {
      props.label = label;
      props.actionIntent = actionIntent;
      props.prompt = prompt;
    }
  }

  const result: SDUIComponent = {
    ...component,
    props,
  };

  // 4. Clean ActionButton children recursively
  if (cleanedChildren) {
    result.children = cleanedChildren.filter(child => {
      if (child.type === 'ActionButton') {
        const props = { ...child.props };
        const label = props.label || props.text || '';
        const actionIntent = props.actionIntent || props.prompt || props.text || '';
        const prompt = props.prompt || '';
        if (!label || !actionIntent) {
          return false;
        }
        child.props = {
          ...props,
          label,
          actionIntent,
          prompt
        };
      }
      return true;
    });
  }

  return result;
}

export function normalizeDynamicWidgetsForDashboard(rawWidgets: any): SDUIComponent[] {
  const rawTopLevel = Array.isArray(rawWidgets) ? rawWidgets.length : 0;
  const normalized = normalizeSDUISchema(rawWidgets);
  const normalizedCount = normalized.length;

  // Extract nested insight cards from Grid or Flex structures
  const candidates = extractInsightCandidates(normalized);
  const candidateCount = candidates.length;

  // Process unique fingerprints keeping only highest priority ones
  const fingerprintedMap = new Map<string, { priority: number; widget: SDUIComponent }>();

  for (const widget of candidates) {
    const cleaned = cleanComponentActions(widget);

    // If candidate widget itself is an ActionButton, ensure it has clean label & intent
    if (cleaned.type === 'ActionButton') {
      const label = cleaned.props?.label || cleaned.props?.text || '';
      const actionIntent = cleaned.props?.actionIntent || '';
      if (!label || !actionIntent) {
        continue;
      }
    }

    const priority = getWidgetPriority(cleaned);
    const fingerprint = getWidgetFingerprint(cleaned);
    const existing = fingerprintedMap.get(fingerprint);

    if (!existing || priority > existing.priority) {
      fingerprintedMap.set(fingerprint, { priority, widget: cleaned });
    }
  }

  // Sort unique widgets by priority descending
  const sortedAndDeduplicated = Array.from(fingerprintedMap.values())
    .sort((a, b) => b.priority - a.priority)
    .map(item => item.widget);

  // Apply limitation strategies:
  // 1. Max 1 InterventionCard
  // 2. Max 3 top-level / nested widgets in total
  const finalCards: SDUIComponent[] = [];
  let interventionCardCount = 0;

  for (const widget of sortedAndDeduplicated) {
    if (widget.type === 'InterventionCard') {
      if (interventionCardCount >= 1) {
        continue;
      }
      interventionCardCount++;
    }
    finalCards.push(widget);
    if (finalCards.length >= 3) {
      break;
    }
  }

  const finalCount = finalCards.length;
  const droppedCount = candidateCount - finalCount;

  if (process.env.NODE_ENV !== 'production' && finalCount > 0) {
    console.info(`[SDUI Intake Policy] RawTopLevel: ${rawTopLevel}, Candidate: ${candidateCount}, Normalized: ${normalizedCount}, Final: ${finalCount}, Dropped: ${droppedCount}`);
  }

  // Wrap output based on dynamic widget counts
  if (finalCount === 0) {
    return [];
  }
  if (finalCount === 1) {
    return [finalCards[0]];
  }
  
  // Return a standard Grid containing the top 1-3 insight cards
  return [
    {
      id: 'sdui-top-insights-grid',
      type: 'Grid',
      props: {
        columns: 3,
        gap: 4,
        className: 'w-full'
      },
      children: finalCards
    }
  ];
}
