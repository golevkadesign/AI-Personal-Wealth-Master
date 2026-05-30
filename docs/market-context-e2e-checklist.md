# Market Context E2E Checklist

本文档用于指导开发者或测试人员手动开展 Market Context（延迟市场上下文）与 AI 财富终端双轨事实边界的端到端（E2E）功能验收。

---

## 0. Preconditions (前置条件)

1. **本地启动应用：**
   ```bash
   npm run dev
   ```
2. **正常打开浏览器并访问：** `http://localhost:3000` 
3. 从控制台确认 Dashboard 以及图表正常加载。
4. **（可选，本地开发建议）** 绑定 Longbridge API。
5. **（可选，本地开发建议）** 在 Settings 中配置您的 AI API Key (如 Gemini Key)。

---

## 1. API Route Check (API 路由及探测脚本验收)

- **执行诊断脚本：**
  ```bash
  npm run check:market-context
  ```
- **验收要点：**
  - [ ] 输出包含 `📊 AI财富终端 - Market Context E2E 诊断报告` 字样；
  - [ ] `Success Status` 应为 `true`；
  - [ ] `/api/market-context` 应当成功返回 `qualitySummary` 核心数据，并且 `qualitySummary.status` 为 `ready`, `degraded`, `stale`, `failed` 之一；
  - [ ] `data.qualitySummary.sourceHealth` 应该在任何时候都返回包含 `stooq`, `fred`, `alpha_vantage` 三个核心源，并在未配置 FRED 或 Alpha Vantage Key 时将它们的 status 自动处理为 `not_configured`；
  - [ ] 配置有效的 FRED 或 Alpha Vantage API key 后，`macroEnhancements` 或者是 `warnings` 能够被正确获取/说明，无 key 时两源数据质量状态正常识别，不崩溃；
  - [ ] `data.regime` 宏观指标段落展现完整（如 `Risk Mode`, `Rate Pressure`, `DollarPressure`, `Credit Stress`, `Commodity Impulse`, `Volatility State`，并且 `Summary` 有内容）；
  - [ ] `Source Summary` 必须包含类似 `"Stooq delayed/historical daily market data"` 等延迟/历史日线数据源说明；
  - [ ] `Warnings` 中至少有一条带有“不是实时交易执行报价”的相关澄清描述；
  - [ ] `Instruments count` 应当大于 0，并能在下方 Snapshot 段看到前 8 个标的（Symbol, Category, Change3M, Quality 等）；
  - [ ] 具备明确提示：`Market Context is delayed/historical context, not execution-grade quote data.`

- **执行 Force-Refresh 诊断脚本：**
  ```bash
  npm run check:market-context:force
  ```
- **验收要点：**
  - [ ] 命令执行成功；
  - [ ] 正常情况下应顺利重新请求接口，若遭遇网络、三方源限流故障，脚本应降级返回并输出可读的 Stale/Low Quality Context Warning（或打印 Stale 状态），拒绝静默崩溃或未捕获的 Unhandled Rejection。

---

## 2. Dashboard Manual Refresh (控制台手动刷新)

- **操作：**
  - 在 Dashboard 顶部的 Control Bar 寻找刷新市场状态的刷新按钮（通常标有“刷新市场”或类似气泡指示）。点击后发起市场数据刷新。
- **验收要点：**
  - [ ] 按钮在 loading 状态时，具有过渡或加载中的 UI 反馈；
  - [ ] 成功刷新后，顶部的市场状态应根据 Regime 更新为 `Risk-on` / `Risk-off` / `Neutral` 等宏观表述；
  - [ ] 状态卡或面板副标题应清晰指出由 Stooq/延迟日线数据驱动（或者指出属于 daily / Stooq delayed / 精确的更新时间，如 `N 分钟前冻结`）；
  - [ ] 顶部不准包含任何将 Market Context 宣称为“盘中实时执行价”或“突发秒级实时新闻”的噱头话语；
  - [ ] 刷新过程中，整个 Dashboard 的 Grid 和已有持仓图表布局稳健、不漂移，未引起容器高度骤变或组件挤压。

---

## 3. Portfolio Review Freeze (持仓复盘时序冻结)

- **操作：**
  - 首先点击 Control Bar 刷新最新的 Market Context 作为快照。
  - 点击“开启本轮持仓复盘”（Portfolio Review）。
  - 打开 `PortfolioReviewDrawer` 面板。
- **验收要点：**
  - [ ] 在 `PortfolioReviewDrawer` 的 Market Context 相关卡片中，可以看到文案 `“已冻结到本轮复盘”`；
  - [ ] `Captured 时间` 准确，通常和前面的 `marketContextLastFetchedAt` 的时差在毫秒级；
  - [ ] 能观测到正确的 `Regime Summary`、`Factors` 指示。
  - [ ] `Cross-Asset Signals` 应当正常展现，且最多精简为 4 条；
  - [ ] 后续在 Dashboard 再次主动点击“刷新市场”导致全局数据更迭时，**已被冻结的 Portfolio Review Session 面板内的 macro context 不会随之发生变化**，确保快照绝对隔离。

---

## 4. Portfolio Review Agent (复盘 Agent 真实性验收)

- **操作：**
  - 在 `PortfolioReviewDrawer` 中输入提问或直接拉起 AI 生成复盘分析报告。
- **验收要点：**
  - [ ] 观察 AI 生成的报告内容，涉及市场大势、资产表现引用时，应能引用已冻结的 Market Context 快照；
  - [ ] **必须保证** AI 在面对 `failed` 或 `degraded` 的 market context 质量状态时，不得将其当作高置信行情进行推演，应客观提示用户市场数据可能不完整或缺失；
  - [ ] **严禁** 出现 AI 将其解释为“当下两分钟前发生的突发内卷政策”、“交易所实时 Level 2 盘中报价”等表述；
  - [ ] **严禁** 出现 AI 把它当作最新突发新闻进行煽动性或恐慌性投资引诱；
  - [ ] 生成报告的末尾，应遵循预设 Prompt 契约，若快照存在，则显式附加以下备注：
    > *“本轮接入延迟/历史市场上下文，但未接入实时新闻与交易执行级报价”*
  - [ ] 如果该 session 未注入 marketContextSnapshot，则末尾应明确注明：
    > *“本轮未接入实时宏观与新闻数据”*

---

## 5. AI Drawer (全局 AI 对话调试)

- **操作：**
  - 在侧边 AI 主对话框内输入：“*结合当前市场环境，分析我的持仓风险，请给我最详尽的市场背景配合。注意我不需要任何买卖指令，只需揭晓风险来源。*”
- **验收要点：**
  - [ ] 后端主链路 `Thinking` 到 `Progress` 全过程稳定流畅，无断开，流式文本顺畅；
  - [ ] SSE 产生的 response 中包含 `externalData.marketContext` 结构；
  - [ ] 展开 Debug 面板或调取浏览器 Network 面板，可见 Eager Merge 将其顺利提交至 React 的 `data.marketContext`，无需通过前端自动轮询发起 secondary call。
  - [ ] AI 的最终 Markdown 回复包含市场大盘解析。如果引用了 Market Context 数据，必须使用诸如 `“根据本轮延迟/历史市场上下文...”` 的客观字眼。
  - [ ] **不得** 用 `marketContext` 的宏观日线数据来重新推演或捏造缺失 `MARKET_DATA` 的任意标的硬核价格。
  - [ ] **禁止在 updateGlobalState 响应中输出 `dashboardSchema` 字段**。确认前端 Dashboard 的布局依然采用 canonical 体系（不被 AI 的 JSON patch 大面积改写或强制缩减）。

---

## 6. Failure / Degraded Behavior (降级与网络容错机制)

- **操作：**
  - 本地暂时切断外网（断开 Wi-Fi 或修改 Host 让 Stooq 的域名请求失败），或利用测试环境强制模拟 Stooq 请求失败（如让 `buildMarketContext()` 在内部抛出 error）。
- **验收要点：**
  - [ ] /api/market-context 请求降级响应，整个 WebServer 不会发生未捕获退出（Unhandled Runtime Exit / Uncaught Base Exception）；
  - [ ] 在存有以往缓存的情况下，API 理应能够返回缓存的旧数据（通常 15 分钟内）；
  - [ ] 在无缓存、冷启动且服务端三方接口均无法访问的环境中，系统应当优雅地返回空或包含 `degraded`、`low quality` 的默认数据结构，客户端 UI 与 Agent 将显示 `“等待市场数据”` 或 `“市场上下文未初始化”`，而不产生页面白屏或功能卡死；
  - [ ] AI 不得在这种降级姿态下编造不存在的神奇宏观数字。

---

## 7. Regression Checks (无损回归检查)

- **操作：**
  - 执行 TypeScript 与 Vite 生产环境下总回归：
    ```bash
    npm run lint
    npm run build
    ```
- **验收要点：**
  - [ ] TypeScript 类型检查（`tsc --noEmit`）顺利，没有任何 TS Warning / TS Error；
  - [ ] React 19 + esbuild 生产构建打包快速正常通过，未发现包依赖缺失。

---

## 8. Must Not Happens (黑名单及绝对不可重现问题)

- **高敏行为审计：**
  1. [ ] **禁止** AI 越权向 `updateGlobalState` 发送 `dashboardSchema` 字段（检查 `ai-state-permissions.ts` 已物理屏蔽）；
  2. [ ] **禁止** AI 自行改写或覆写 `publicHoldingAccounts` 中用户的银行余额事实；
  3. [ ] **禁止** AI 通过 `marketContext` 计算或调整 `publicHoldings` 的实时真实市值；
  4. [ ] **禁止** AI 在文本中宣传获取到了最新的突发实盘宏观美妙音画及秒级原创新闻；
  5. [ ] **禁止** API 意外泄露用户的 Private Settings，如 AI API Keys 与 交易执行级密钥。
