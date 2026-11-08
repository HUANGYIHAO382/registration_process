# 医鸿 IPTV 数字人 · Vue3 网页 Demo

设计分辨率 **1920×1080**，整体等比缩放（默认按窗口自适应；设置里可改 100% / 自定义倍率）。

## 环境要求

- Node.js 18+（建议 20）
- 仅使用 **Vue 3**（本工程未引入 Vue 2 / Element Plus / Pinia / vue-router）

## 启动（请你本地执行）

在项目目录打开终端，依次执行：

```bash
cd e:\registration_process\apps\iptv-digital-human
npm install
npm run dev
```

成功后浏览器打开：`http://127.0.0.1:5173`

- 前端：Vite `5173`
- 代理/Mock：`8787`（由 `npm run dev` 一并拉起；`/api` 已代理）

可选云端 ASR/LLM：复制 `server/config.example.json` 为 `server/config.json`，填入 `apiKey` 并把对应 `enabled` 设为 `true`，刷新页面即可（**Key 不会出现在前端网络面板**）。

## 操作说明

| 操作 | 作用 |
|---|---|
| 空格 / Enter | 开始听 / 说完结束 / 说话时打断（半双工 L1） |
| Esc | 关闭设置；紧急红屏下退出演示告警 |
| 方向键 | 就诊人 / 时段列表移动焦点 |
| 数字 1/2/3 | 快捷切 ASR：浏览器 / 云端 / Mock |
| 底部输入框 | 文字兜底，与语音 final 同一链路 |
| 设置面板 | 画幅缩放、ASR/LLM、绑定流 A/B/C、导出实验 JSONL |

## 演示路径（对齐成功标准）

1. 首页 → **看病挂号** → 同意隐私 → 出码 → **模拟手机已确认**
2. 选就诊人 → 说症状（空格，或 Mock 通道）→ 看科室建议 → 选时段
3. 确认页看倒计时与「到院付」说明 → 成功凭证
4. 说「胸口疼」等危急词 → 红屏 120（Esc 退出演示）
5. 设置里切换通道；导出绑定实验 JSONL

## 目录（与方案 01 一致）

```text
src/
  core/                 会话状态机、安全、意图
  modules/voice|ai|api-switch|avatar|registration/
  pages/                S1–S7
  composables/          舞台缩放、遥控键、会话
server/                 代理 + Mock
```

## 画幅是否可控？

可控。舞台宽高写死 1920×1080，用 `transform: scale` 缩放：

- **自适应窗口（fit）**：默认
- **100% 原尺寸**：1:1，窗口不足可滚动
- **自定义**：50% / 75% / 125%

业务布局不随浏览器做流式折行，保证电视构图一致。
