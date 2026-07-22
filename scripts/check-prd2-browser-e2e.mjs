import { spawn } from 'node:child_process';
import process from 'node:process';
import puppeteer from 'puppeteer';

const EXTERNAL_BASE_URL = process.env.PRD2_E2E_BASE_URL?.replace(/\/$/, '');
const PORT = Number(process.env.PRD2_E2E_PORT || (4300 + Math.floor(Math.random() * 500)));
const BASE_URL = EXTERNAL_BASE_URL || `http://127.0.0.1:${PORT}`;

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForHealth() {
  const deadline = Date.now() + 45_000;
  let lastError;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`${BASE_URL}/api/health`);
      if (res.ok) return;
    } catch (error) {
      lastError = error;
    }
    await wait(500);
  }
  throw new Error(`Local app did not become healthy: ${lastError?.message || 'timeout'}`);
}

async function assertStaticAssetsReady() {
  const indexRes = await fetch(`${BASE_URL}/`);
  const indexHtml = await indexRes.text();
  const assetRefs = Array.from(indexHtml.matchAll(/(?:src|href)="([^"]+)"/g)).map((match) => match[1]);
  if (assetRefs.length === 0) throw new Error('No built asset refs found in index.html');

  for (const ref of assetRefs) {
    const res = await fetch(`${BASE_URL}${ref}`);
    const contentType = res.headers.get('content-type') || '';
    const isStyle = ref.endsWith('.css');
    const isScript = ref.endsWith('.js');
    if (!res.ok) throw new Error(`Built asset failed: ${ref} -> ${res.status}`);
    if (isStyle && !contentType.includes('text/css')) {
      throw new Error(`CSS asset has wrong MIME: ${ref} -> ${contentType}`);
    }
    if (isScript && !contentType.includes('javascript')) {
      throw new Error(`JS asset has wrong MIME: ${ref} -> ${contentType}`);
    }
  }
}

function startApp() {
  if (EXTERNAL_BASE_URL) return null;

  const child = spawn(process.execPath, ['dist/server.js'], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      PORT: String(PORT),
      HOST: '127.0.0.1',
      NODE_ENV: 'production',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  let output = '';
  child.stdout.on('data', (chunk) => { output += chunk.toString(); });
  child.stderr.on('data', (chunk) => { output += chunk.toString(); });
  child.on('exit', (code) => {
    if (code !== 0 && code !== null) {
      console.error(output);
    }
  });

  return child;
}

async function clickAskArbitra(page) {
  const clicked = await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll('button'));
    const target = buttons.find((button) => {
      const label = `${button.getAttribute('aria-label') || ''} ${button.textContent || ''}`;
      return /Arbitra|询问|Ask/i.test(label);
    });
    if (!target) return false;
    target.click();
    return true;
  });
  if (!clicked) throw new Error('Ask Arbitra button was not found');
}

async function main() {
  const child = startApp();
  let browser;
  try {
    await waitForHealth();
    browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
    const page = await browser.newPage();
    const pageErrors = [];
    const assetResponses = [];
    page.on('pageerror', (error) => pageErrors.push(error.message));
    page.on('console', (message) => {
      if (message.type() === 'error') pageErrors.push(message.text());
    });
    page.on('response', (response) => {
      const url = response.url();
      if (!url.startsWith(BASE_URL) || !url.includes('/assets/')) return;
      const contentType = response.headers()['content-type'] || '';
      if (!response.ok() || contentType.includes('text/html')) {
        assetResponses.push(`${response.status()} ${contentType} ${url}`);
      }
    });
    page.setDefaultTimeout(45_000);
    await page.setCacheEnabled(false);
    await page.setViewport({ width: 1440, height: 1000 });
    await assertStaticAssetsReady();
    await page.goto(`${BASE_URL}/?test=1`, { waitUntil: 'networkidle2' });
    if (await page.title() !== 'ARBITRA | Wealth Operating System') {
      throw new Error(`Unexpected document title: ${await page.title()}`);
    }
    try {
      await page.waitForSelector('button[aria-label], button', { visible: true });
    } catch (error) {
      const bodyText = await page.evaluate(() => document.body?.innerText?.slice(0, 1000) || '');
      throw new Error(`Dashboard buttons did not render. Body: ${bodyText}; Page errors: ${pageErrors.join(' | ')}; Asset responses: ${assetResponses.join(' | ')}`);
    }

    await clickAskArbitra(page);
    await page.waitForFunction(() => document.documentElement.dataset.arbitraWorkbenchOpen === 'true');
    await page.waitForSelector('[data-aw-workbench="true"] textarea', { visible: true });

    const workbenchA11y = await page.evaluate(() => {
      const workbench = document.querySelector('[data-aw-workbench="true"]');
      return {
        role: workbench?.getAttribute('role'),
        ariaModal: workbench?.getAttribute('aria-modal'),
        signalCount: document.querySelectorAll('.aw-workbench-signal-card').length,
        railTabCount: document.querySelectorAll('.aw-workbench-rail-tabs [role="tab"]').length,
      };
    });
    if (workbenchA11y.role !== 'dialog' || workbenchA11y.ariaModal !== 'true') {
      throw new Error(`Workbench must be an accessible dialog: ${JSON.stringify(workbenchA11y)}`);
    }
    if (workbenchA11y.signalCount !== 3 || workbenchA11y.railTabCount !== 4) {
      throw new Error(`Workbench information architecture drifted: ${JSON.stringify(workbenchA11y)}`);
    }

    await page.type('[data-aw-workbench="true"] textarea', '请运行一次 PRD2 Workbench 浏览器回归。');
    await page.waitForSelector('[data-aw-workbench="true"] form button[type="submit"]', { visible: true });
    await page.click('[data-aw-workbench="true"] form button[type="submit"]');

    try {
      await page.waitForFunction(() => {
        const dataset = document.documentElement.dataset;
        return dataset.arbitraWorkbenchRunStatus === 'ready' &&
          Number(dataset.arbitraWorkbenchChatHistoryCount || 0) >= 1 &&
          Array.from(document.querySelectorAll('.ai-message')).some((node) => (
            node.textContent?.includes('Workbench 综合回合')
          ));
      });
    } catch (error) {
      const debugState = await page.evaluate(() => ({
        open: document.documentElement.dataset.arbitraWorkbenchOpen,
        runStatus: document.documentElement.dataset.arbitraWorkbenchRunStatus,
        runError: document.documentElement.dataset.arbitraWorkbenchRunError,
        chatHistoryCount: document.documentElement.dataset.arbitraWorkbenchChatHistoryCount,
        workbenchText: document.querySelector('[data-aw-workbench="true"]')?.textContent?.slice(0, 1600),
        messageCount: document.querySelectorAll('.ai-message').length,
        lastMessage: Array.from(document.querySelectorAll('.ai-message')).at(-1)?.textContent?.slice(0, 800),
      }));
      throw new Error(`Native chat did not complete. State: ${JSON.stringify(debugState)}; Page errors: ${pageErrors.join(' | ')}`);
    }
    await page.waitForFunction(() => (
      Number(document.querySelector('[data-aw-response-widgets="true"]')?.getAttribute('data-aw-response-widget-count') || 0) > 0
    ));

    const afterReply = await page.evaluate(() => ({
      open: document.documentElement.dataset.arbitraWorkbenchOpen,
      runStatus: document.documentElement.dataset.arbitraWorkbenchRunStatus,
      chatHistoryCount: document.documentElement.dataset.arbitraWorkbenchChatHistoryCount,
      visibleWidgetTypes: document.documentElement.dataset.arbitraWorkbenchVisibleWidgetTypes,
      responseWidgetCount: document.querySelector('[data-aw-response-widgets="true"]')?.getAttribute('data-aw-response-widget-count'),
      responseWidgetTypes: document.querySelector('[data-aw-response-widgets="true"]')?.getAttribute('data-aw-response-widget-types'),
      assistantText: Array.from(document.querySelectorAll('.ai-message')).at(-1)?.textContent?.slice(0, 160),
      assistantTextFull: Array.from(document.querySelectorAll('.ai-message')).at(-1)?.textContent || '',
    }));

    if (afterReply.open !== 'true') throw new Error('Workbench should be open after reply');
    if (afterReply.runStatus !== 'ready') throw new Error(`Workbench run should be ready, got ${afterReply.runStatus}`);
    if (Number(afterReply.chatHistoryCount || 0) < 1) throw new Error('Chat history should be retained after reply');
    if (Number(afterReply.responseWidgetCount || 0) < 1) throw new Error('Assistant reply should render response widgets');
    if (!afterReply.assistantText?.includes('Workbench 综合回合')) throw new Error('Assistant reply should use zh-CN native Workbench synthesis');
    if (/sovereign_profile|public_holdings|market_context|rail_outputs|strategic_brief/.test(afterReply.assistantTextFull || '')) {
      throw new Error(`Assistant copy leaked protocol fact IDs: ${afterReply.assistantTextFull}`);
    }
    delete afterReply.assistantTextFull;

    await page.mouse.click(24, Math.floor(1000 / 2));
    await page.waitForFunction(() => document.documentElement.dataset.arbitraWorkbenchOpen === 'false');

    await clickAskArbitra(page);
    await page.waitForFunction(() => (
      document.documentElement.dataset.arbitraWorkbenchOpen === 'true' &&
      Number(document.documentElement.dataset.arbitraWorkbenchChatHistoryCount || 0) >= 1
    ));

    const afterReopen = await page.evaluate(() => ({
      open: document.documentElement.dataset.arbitraWorkbenchOpen,
      chatHistoryCount: document.documentElement.dataset.arbitraWorkbenchChatHistoryCount,
      responseWidgetCount: document.querySelector('[data-aw-response-widgets="true"]')?.getAttribute('data-aw-response-widget-count'),
      responseWidgetTypes: document.querySelector('[data-aw-response-widgets="true"]')?.getAttribute('data-aw-response-widget-types'),
    }));

    if (Number(afterReopen.responseWidgetCount || 0) < 1) {
      throw new Error('Assistant response widgets should survive close/reopen');
    }

    await page.mouse.click(24, Math.floor(1000 / 2));
    await page.waitForFunction(() => document.documentElement.dataset.arbitraWorkbenchOpen === 'false');
    await page.click('button[aria-label="账户菜单"]');
    const openedSettings = await page.evaluate(() => {
      const button = Array.from(document.querySelectorAll('button')).find((item) => item.textContent?.includes('控制面板'));
      button?.click();
      return Boolean(button);
    });
    if (!openedSettings) throw new Error('Settings entry was not found');
    await page.waitForSelector('[role="dialog"][aria-modal="true"]', { visible: true });
    const settingsState = await page.evaluate(() => {
      const dialog = document.querySelector('[role="dialog"][aria-modal="true"]');
      return {
        label: dialog?.getAttribute('aria-labelledby'),
        text: dialog?.textContent || '',
        bodyOverflow: getComputedStyle(document.body).overflow,
      };
    });
    if (!settingsState.label || settingsState.bodyOverflow !== 'hidden') {
      throw new Error(`Settings accessibility contract failed: ${JSON.stringify(settingsState)}`);
    }
    if (/1 minute ago|Not Configured|Model \(Fast|Model \(Advanced/.test(settingsState.text)) {
      throw new Error(`Settings leaked untranslated UI copy: ${settingsState.text.slice(0, 600)}`);
    }

    const mobilePage = await browser.newPage();
    await mobilePage.setViewport({ width: 390, height: 844 });
    await mobilePage.goto(`${BASE_URL}/?test=1`, { waitUntil: 'networkidle2' });
    await mobilePage.waitForSelector('.aw-pim-card', { visible: true });
    const mobileLayout = await mobilePage.evaluate(() => {
      const pim = document.querySelector('.aw-pim-card')?.getBoundingClientRect();
      return {
        pimHeight: pim ? Math.round(pim.height) : null,
        overflowX: document.documentElement.scrollWidth > window.innerWidth,
        rawEmptyKeyCount: (document.body.innerText.match(/__empty_state/g) || []).length,
      };
    });
    await mobilePage.close();
    if (!mobileLayout.pimHeight || mobileLayout.pimHeight > 480) {
      throw new Error(`Mobile portfolio empty state is too tall: ${JSON.stringify(mobileLayout)}`);
    }
    if (mobileLayout.overflowX || mobileLayout.rawEmptyKeyCount > 0) {
      throw new Error(`Mobile layout contract failed: ${JSON.stringify(mobileLayout)}`);
    }

    console.log(JSON.stringify({
      status: 'ok',
      checked: [
        'test-mode-dashboard-loads',
        'ask-arbitra-opens-workbench',
        'native-chat-completes',
        'assistant-response-widgets-render',
        'close-reopen-preserves-chat-and-widgets',
        'workbench-dialog-and-rail-structure',
        'protocol-ids-hidden-from-assistant-copy',
        'settings-dialog-and-runtime-i18n',
        'mobile-empty-state-height-and-overflow',
      ],
      afterReply,
      afterReopen,
      workbenchA11y,
      mobileLayout,
    }));
  } finally {
    if (browser) await browser.close();
    child?.kill('SIGTERM');
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
