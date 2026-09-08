# AGENTS.md

## Project Overview

宝宝成长录是一个面向家庭使用的微信小程序，记录宝宝的成长、健康、疫苗、照片和家庭成员信息。

主要技术栈：

- Taro 4.2.1
- React 18 + TypeScript
- Webpack 5 + Sass
- Zustand
- 微信云开发（可选，未配置时使用本地演示数据）

## Repository Layout

- `src/app.ts`: 应用入口和启动初始化
- `src/app.config.ts`: 页面、窗口和底部 Tab 配置
- `src/app.scss`: 全局样式
- `src/pages/`: 页面组件，每个页面通常包含 `index.tsx`、`index.config.ts` 和可选的 `index.scss`
- `src/services/`: 云函数、认证和数据访问封装
- `src/stores/`: Zustand 状态
- `src/types/`: 领域类型定义
- `config/`: Taro 构建配置
- `dist/`: Taro 生成的小程序产物，不直接编辑
- `cloud/`: 微信云函数目录（如存在）

## Non-Negotiable Constraints

- 目标平台是微信小程序，页面代码必须能通过 `build:weapp`。
- UI 优先使用 `@tarojs/components` 的原生组件，如 `View`、`Button`、`Input`、`Picker`、`Form`。
- 不要在页面中新增 `@nutui/nutui-react-taro` 组件。当前 NutUI React Taro 版本与 Taro 4 的小程序模板编译存在兼容问题，可能产生 `Template tmpl_xx_xx not found`，导致页面节点不渲染。
- 不要使用浏览器专属 API（例如直接访问 `window`、`document`、`MutationObserver`），除非明确放在 H5 专用分支并做运行环境判断。
- 不要在运行时代码中直接访问未注入的 `process.env`。读取环境变量必须先判断 `typeof process !== 'undefined'`，并为未配置环境提供本地演示回退。
- 不要手动修改 `dist/`。修改 `src/` 或构建配置后重新生成产物。
- 保留用户已有的未提交改动，不使用破坏性 Git 命令覆盖它们。

## Development Commands

使用 pnpm，Node 版本以 `.nvmrc` 为准：

```bash
pnpm install
pnpm dev:weapp       # 微信小程序监听构建
pnpm build:weapp     # 微信小程序生产构建
pnpm build:h5        # 仅在需要验证 H5 时使用
pnpm lint
pnpm format:check
```

标准验证顺序：先运行 `pnpm lint` 和 `pnpm format:check`，再运行 `pnpm build:weapp`。构建成功后，将仓库根目录的 `dist/` 导入微信开发者工具。

如果开发者工具仍显示旧的 WXML 模板错误，先停止监听进程，清理开发者工具缓存并重新导入最新 `dist/`。不要根据旧 `dist` 的日志判断当前源码。

## TypeScript and React Conventions

- 页面组件使用函数组件和 Hooks；生命周期使用 `@tarojs/taro` 提供的 Hooks。
- 事件处理函数命名使用动词，例如 `submit`、`addRecord`、`handleChange`。
- 领域数据结构放入 `src/types/`，不要在多个页面重复声明。
- 服务层负责云函数调用和本地演示回退，页面只处理交互和展示。
- 异步操作必须处理加载状态和失败提示；不要吞掉真实错误。
- 保持组件和样式范围清晰，复用的页面样式放到 `src/app.scss`，页面专属样式放到页面目录。
- 遵循现有 Prettier 和 ESLint 配置，默认使用单引号、无分号风格。

### Cloud Function Formatting

- 云函数源码位于 `cloud/functions/<name>/index.ts`，公共数据库和权限工具可复用 `cloud/shared/` 中的 TypeScript 模块。
- 新增云函数时必须创建 `index.ts` 和 `package.json`。不要手写 `index.js`；运行入口由 `pnpm cloud:build` 统一生成到 `cloud/dist/functions/<name>/index.js`。
- `pnpm cloud:build` 会将每个函数及其 `cloud/shared/` 依赖打包为独立部署产物，并将 `wx-server-sdk` 保留为函数目录的外部依赖。微信开发者工具的云函数根目录固定为 `cloud/dist/functions/`。
- 云函数 TypeScript、构建脚本和 JSON 文件统一使用仓库根目录的 `.prettierrc`，格式化命令为 `pnpm format`，检查命令为 `pnpm format:check`。
- 云函数类型检查使用 `pnpm --dir cloud exec tsc --noEmit`，或根目录命令 `pnpm cloud:typecheck`。
- 云函数提交或上传前至少执行：`pnpm format:check`、`pnpm lint`、`pnpm --dir cloud exec tsc --noEmit` 和 `pnpm cloud:build`。
- 不要在云函数中直接信任前端传入的 `openid`、`userId` 或角色；身份必须通过 `cloud.getWXContext()` 获取并经过公共权限工具校验。

## Styling

- 使用 Sass 和现有全局设计风格；避免引入新的 CSS 框架或全局 reset。
- 适配小程序尺寸转换，避免依赖浏览器 CSS 特性。
- 可点击元素必须有清晰的尺寸、文字和状态；不要让按钮仅依赖默认浏览器样式。
- 新增全局规则前确认不会覆盖 Taro 原生组件的行为。

## Data and Environment

- 未配置云环境时，应用应继续使用 `src/services/auth.ts` 中的本地演示会话和 `Taro` storage。
- 云环境 ID 等配置放在 `.env.development` / `.env.production`，敏感信息不要提交；`.env.example` 只放变量名和示例值。
- `Taro.cloud.callFunction` 只能通过 `src/services/cloud.ts` 封装调用。
- 不要在客户端保存密钥或服务端凭证。

## Adding a Page or Feature

1. 在 `src/pages/<name>/` 创建页面组件和页面配置。
2. 将页面路径加入 `src/app.config.ts` 的 `pages`；需要底部导航时同步更新 `tabBar.list`。
3. 交互先使用 Taro 原生组件验证微信端渲染，再补充样式和服务层逻辑。
4. 为加载、空数据、失败和成功状态提供可见反馈。
5. 运行 lint、格式检查和微信构建，并在微信开发者工具中验证真实页面。

## Troubleshooting

- `Template tmpl_xx_xx not found`: 检查是否引入了 NutUI React Taro 或其他动态原生节点组件；优先替换为 `@tarojs/components`。
- Sass `@import` 弃用警告：使用 `@use`，但要区分警告和真正的构建错误。
- 构建输出疑似过期：停止 watch、清理开发者工具缓存后重新运行 `pnpm build:weapp`，再导入 `dist/`。

## Change Scope

保持改动聚焦于用户请求。不要顺手升级 Taro、替换构建器、重写状态管理或修改云函数权限。依赖升级必须同步更新 `package.json` 和 `pnpm-lock.yaml`，并通过微信构建验证。
