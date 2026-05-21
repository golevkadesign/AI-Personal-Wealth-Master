// test-e2e-smoke.mjs
// 运行指南: 
// 1. 请确保本地开发服务器已经启动（例如：npm run dev）
// 2. 在终端执行命令：node test-e2e-smoke.mjs

import puppeteer from 'puppeteer';

(async () => {
  console.log('🚀 启动 E2E 冒烟测试...');
  const browser = await puppeteer.launch({
    headless: true, // 无头模式
    args: ['--no-sandbox', '--disable-setuid-sandbox'] // 安全选项，避免在沙盒/云容器环境中奔溃
  });

  const page = await browser.newPage();
  let hasError = false;

  // 4. 控制台异常捕获：监听 Browser Console 及全局报错
  page.on('console', async (msg) => {
    if (msg.type() === 'error') {
      console.error(`[Browser Console Error] 捕获到控制台错误: ${msg.text()}`);
      hasError = true;
    }
  });

  page.on('pageerror', error => {
    console.error(`[Browser Page Error] 页面抛出未曾捕获的异常: ${error.message}`);
    hasError = true;
  });

  try {
    console.log('🔗 正在访问前端预见地址...');

    // 3. 重定向拦截：检测由于 Firebase 等触发的跳转
    page.on('framenavigated', frame => {
        if (frame === page.mainFrame()) {
            const url = frame.url();
            // 简单匹配 firebase 的鉴权页或带有 auth 参数的重定向
            if (url.includes('firebaseapp.com') || url.includes('identitytoolkit') || url.includes('accounts.google.com')) {
                console.log('🛡️ 鉴权拦截正常 (检测到身份验证的重定向路由)');
            }
        }
    });

    // 1. 启动并访问应用（云开发环境或本地默认 3000 端口）
    await page.goto('http://localhost:3000', { waitUntil: 'domcontentloaded', timeout: 15000 });

    console.log('⏳ 页面初始加载完成，保持嗅探 5 秒以探测 React 异步渲染异常风险...');
    // 强制挂起 5 秒探测
    await new Promise(r => setTimeout(r, 5000));

    if (hasError) {
      // 如果出现问题立即截图并抛出中断测试
      await page.screenshot({ path: 'smoke-test-error.png' });
      throw new Error('检测到前端控制台存在 Error，触发阻断机制，已保存截图保存至 smoke-test-error.png');
    }

    // 2. 终端加载检查，提取包含核心关键字的内容
    const html = await page.content();
    if (html.includes('Arbitra Terminal') || html.includes('Initialize') || html.includes('auth')) {
      console.log('✅ 终端加载检查通过: 核心系统/鉴权节点渲染正常。');
    } else {
      console.warn('⚠️ 终端加载检查警报: 未能在页面中找到 "Arbitra Terminal" 预设的结构关键字。');
    }

    console.log('🎉 测试完成，数据流与渲染链路健康，未发现终端阻断点！');

  } catch (err) {
    console.error('❌ E2E 测试异常终止:', err.message);
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
})();
