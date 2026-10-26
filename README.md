# longtermism

一个面向 macOS 的个人生活规划应用：用艾森豪威尔矩阵安排轻重缓急，用项目考察期尝试一种生活方式。

当前实现采用 **Swift / AppKit 原生窗口 + WKWebView 网页界面**。界面与交互沿用已验证的原型，数据通过原生桥接保存到本机。没有 Go、Wails 或第三方运行时依赖，不需要登录。

## 开发

需要 macOS 13.3 或更新版本、Node.js 20+，以及 Apple Command Line Tools（或完整 Xcode）。首次配置可运行 `xcode-select --install`。不需要 `npm install`。

在项目目录运行：

```sh
cd /Users/chengwen/git/longtermism
npm run dev
```

命令会编译并打开 **longtermism 开发版**。

- 修改 `web/` 中的 HTML、CSS、JavaScript：保存后窗口自动刷新，已保存的数据保持不变。
- 正在填写表单时：先保留表单，关闭后再自动刷新。
- 修改 `native/` 中的 Swift：重新编译并重启窗口。已保存数据保留，未提交的表单不保留。
- 编译失败时：错误显示在终端，原窗口保留，修复后再次保存即可重试。
- `⌘N`：记下一件事；`⌘R`：保存已提交的数据后刷新；`⌘Q`：保存完成后退出。
- 退出应用或在终端按 `Ctrl+C`，开发服务随之停止。退出前请提交表单并确认“已保存”。

默认仅监听 `http://127.0.0.1:4317`；端口被占用时可运行 `LONGTERMISM_PORT=4318 npm run dev`。

### 调试方式

开发窗口启用了 Web Inspector。在 Safari 的“开发”菜单中选择 longtermism 对应页面，可以检查界面、JavaScript 控制台和断点（需要先在 Safari 设置中显示开发者功能）。Swift 层错误输出在启动终端；需要调试原生层时可用 LLDB 附加到该进程。

只调整网页界面时可运行：

```sh
npm run dev:web
```

打开终端打印的本地地址。浏览器预览使用自身的 localStorage，**不与桌面版共享数据**。根目录 `index.html` 也可以直接打开并跳转到 `web/`，但推荐开发服务方式；不同浏览器对本地文件存储的支持可能不同。

## 构建可独立运行的应用

```sh
npm run build
```

产物：`build/longtermism.app`。双击即可运行，也可以复制到“应用程序”目录。正式构建包含全部界面资源，运行时不需要 Node.js、开发服务或网络。

目前构建目标为当前 Mac 的处理器架构，最低 macOS 13.3。使用本地临时签名，尚未配置 Developer ID 签名、Apple 公证、自动更新或 App Store 发布。

## 数据与恢复

项目目录及产品名称统一为 `longtermism`，使用火箭图标。开发配置统一使用 `LONGTERMISM_PORT`、`LONGTERMISM_DEV_URL`、`LONGTERMISM_DATA_DIR`；旧 `FIELD_*` 变量作为兼容别名继续接受，新变量优先。

为保留已有数据和系统偏好，`local.field` / `local.field.dev` 应用标识、原存储目录、浏览器存储键和窗口尺寸键保持稳定。这些是兼容标识，不是遗漏的产品名称。历史原型保留当时名称。

| 运行方式 | 数据位置 |
| --- | --- |
| longtermism 开发版 | `~/Library/Application Support/field-development/state.json` |
| longtermism.app | `~/Library/Application Support/field/state.json` |
| 浏览器预览 | 当前浏览器、当前来源的 `field.preview.v1` localStorage |

可从应用的 **longtermism → 打开数据文件夹** 访问存储目录。开发测试还可指定 `LONGTERMISM_DATA_DIR=/绝对路径 npm run dev`，该变量不影响正式版。

首次打开生成标注为“示例”的数据。之后每次有效修改都会自动保存，刷新、退出或重开不会重置。界面的“重置”需要再次确认，会将当前数据替换成示例。

原生保存采用原子写入，`state.previous.json` 保留上一次写入前的数据快照（不是完整历史备份）。读取失败或格式不兼容时会显示错误，原文件不会被示例覆盖。需要恢复时，先退出应用，另行备份现有文件，再用检查过的 `state.previous.json` 替换 `state.json`。保存失败时界面会持续显示错误和重试按钮。

## 代码结构

```text
native/main.swift       macOS 窗口、菜单、可信页面桥接、本地文件读写
web/index.html          共享界面入口
web/styles.css          布局与样式
web/model.js            日期计算、唯一 ID、保存格式校验
web/app.js              矩阵、行动、考察计划、回顾与交互
web/calendar.js         月度考察时间轴、月份切换与筛选
web/storage.js          保存队列、读写适配、失败反馈
web/dev.js              开发模式自动刷新
scripts/dev.mjs         本机服务、文件监听、编译与进程管理
scripts/build.mjs       编译 Swift、打包 .app、临时签名
scripts/check.mjs       JavaScript 语法检查
scripts/icon.swift      从共享火箭 SVG 生成 macOS 图标
web/rocket.svg          侧栏、浏览器与应用图标的共享图形
prototypes/             迁移前的独立原型，保留供设计对照
```

现有任务的分类、完成状态和计划关联共用同一份数据；回顾后可创建下一周期，上一周期和行动保留。考察期限为一周、两周或一个日历月；按原型规则，一个月到下个月对应日期的前一天结束，月底日期先截到下个月有效日期。

侧栏「考察日历」提供月度时间轴，展示考察项目起止日期、持续天数、行动完成数，以及当月覆盖天数和同时进行的项目数。支持跨月查看、历史周期筛选和点击进入详情。统计口径见 `docs/trial-calendar.md`。

当前不包含按具体时间安排的日历排程、Agent、Obsidian、Apple 日历/提醒事项接入、iPhone/iPad 客户端或多设备同步。

## 验证

```sh
npm run check
npm test
npm run build
```

使用 Node 内置测试工具检查日期边界、持久化 ID、数据格式、连续保存顺序与错误重试。实际界面验证记录见 `docs/desktop-validation.md`。无生产级端到端测试框架。

## 项目画布看板

进入考察计划详情，切换到「画布看板」：

- 点击「创建节点」或双击画布空白处，填写节点标题与内容。
- 拖动节点标题调整位置；聚焦标题后也可用方向键移动，Shift 加速。
- 依次点击两个节点左右的圆形连接点建立连线；按 Esc 取消待连接状态。相同节点间不会重复连线。
- 点击连线后可删除连线；选中节点可编辑或删除，删除节点时会确认并移除相关连线。
- 使用缩放按钮和画布滚动查看不同区域。

每个考察周期的画布独立保存在原有本机数据中，旧数据无需迁移。节点内容、位置与连线在刷新或重开后保留。已归档周期的画布只读，新周期从空白画布开始。
# longtermism
