# Magic Code 原生 Agent 方案

版本：2026-09-24  
定位：把 Magic Code 从“有 Agent 外观的聊天工作台”推进为“以视觉作品为工作区的原生 Agent”。

## 一、结论先行

真正的 Agent 不是设置页面，也不是一次模型请求。它至少包含以下运行闭环：

```text
用户目标
  -> Agent 读取上下文
  -> 制定下一步行动
  -> 请求工具 / 访问作品 / 修改文件
  -> 审批或拒绝
  -> 执行并回收结果
  -> 验证结果
  -> 继续循环、暂停等待，或完成交付
```

Magic Code 的核心差异不应该是“又一个能改代码的 Agent”，而是：

> Agent 每一步都能把用户的视觉指向、选区、批注和作品版本转换成可执行上下文，并把执行结果重新呈现在作品上。

因此，右侧预览不是一个附属 iframe，而是 Agent 的执行工作区；点选、框选和批注不是 UI 装饰，而是 Agent 的输入工具；版本、对比和回退不是历史页面，而是 Agent 的恢复机制。

## 二、从 X 上的实践讨论得到的共识

以下结论来自 X 上关于 Claude Code、Codex、AI coding agent 和 Agent harness 的实践讨论。X 内容适合作为行业经验信号，具体 API 边界以官方文档为准。

### 1. Harness 才是 Agent 的核心产品

讨论中反复出现的概念是 harness：它负责调用模型、解释 tool call、路由到正确执行环境、处理错误、审批、恢复和状态，而不是把这些责任交给模型自己。

对 Magic Code 的含义：不能只做 `fetch(model) -> assistant message`。需要一个明确的运行循环和事件流，模型只是循环中的决策器。

参考：[X：session / harness / sandbox 的拆分讨论](https://x.com/unikoukokun/status/2042158530049056993)

### 2. Session 必须是可恢复的追加日志

长任务不能依赖浏览器当前内存。会话应该记录输入、模型响应、工具调用、工具结果、审批、错误、版本和恢复点。容器或页面重启后，Agent 仍然可以从最后一个安全状态继续。

对 Magic Code 的含义：对话记录之外，还要保存 Agent turn、当前任务状态、工具调用状态和作品版本关联。

参考：[X：Agent session 作为追加日志和审计轨迹](https://x.com/unikoukokun/status/2042158530049056993)

### 3. 错误要分流，不能统一显示“失败”

成熟 harness 会区分：

- 临时错误：退避并重试；
- 模型可修复错误：把错误作为下一轮工具结果交给模型；
- 需要人判断：暂停并请求审批；
- 未知错误：记录完整上下文，进入诊断路径。

参考：[X：Agent harness 的错误处理与验证循环](https://x.com/lucas_flatwhite/status/2041478080611668446/photo/3)

### 4. 验证循环决定它是不是“生产 Agent”

“模型说完成了”不等于完成。必须有针对任务的验证：预览实际渲染、元素是否存在、布局是否溢出、导出文件能否打开、版本是否可回退。

对 Magic Code 的含义：每次视觉修改后至少执行 `render -> inspect -> compare -> report`，而不是只生成一段解释文本。

### 5. 审批、沙箱和回退是架构，不是设置页选项

当 Agent 可以写文件、访问网络或调用 MCP 时，人类审批必须位于工具执行边界，而不是只在聊天里提醒。每个有副作用的动作都应该拥有明确的权限、范围和回退点。

参考：[X：Human-in-the-loop 是架构边界](https://x.com/v_shakthi/status/2039889360955609385)

### 6. 长任务需要预算、隔离和新鲜上下文

长时间运行的 Agent 会受到 token、工具次数、上下文膨胀和环境状态的限制。实际产品需要 per-turn / per-session 的预算，必要时把独立工作委派给隔离的子 Agent，并在长任务后用新上下文进行整理和验证。

参考：[X：长运行 Agent 的上下文压缩、计划粘滞和恢复](https://x.com/systematicls/status/2038241033755168959)

## 三、官方 Agent 模型与 Magic Code 的对应关系

OpenAI 的 Agent 文档把 Agent 拆成 Agent、Environment、Session、Events/Items 四个概念，并明确把 harness 定义为拥有模型循环、工具路由、审批、追踪、恢复和运行状态的控制平面。[官方 Agents API 概览](https://developers.openai.com/api/docs/guides/agents-api/overview)  [官方 Sandbox Agents](https://developers.openai.com/api/docs/guides/agents/sandboxes)

对应到 Magic Code：

| 原生 Agent 概念 | Magic Code 实体 | 关键职责 |
| --- | --- | --- |
| Agent | Magic Visual Agent | 模型、指令、视觉工具、MCP、技能、权限 |
| Environment | Project Workspace | 项目文件、作品、预览服务、导出目录 |
| Session | Conversation Session | 可恢复任务、消息、turn、审批和上下文 |
| Events / Items | Agent Event Log | 思考状态、工具调用、结果、错误、版本、验证 |
| Harness | Visual Agent Runtime | 循环调度、审批、重试、恢复、预算和验证 |
| Artifact | Preview Artifact | HTML / 原型 / 文案 / 页面状态及其版本 |
| Visual Context | Target Packet | 点选、框选、批注、元素属性、坐标、版本 |

## 四、Magic Code 的 Agent 定义

### 4.1 Agent 的固定合同

每个 Magic Code Agent 运行必须有一份可审查的定义：

```ts
type MagicAgentDefinition = {
  name: string;
  model: ModelRoute;
  instructions: string;
  tools: ToolDefinition[];
  skills: SkillDefinition[];
  mcpServers: McpServerDefinition[];
  approvalPolicy: ApprovalPolicy;
  environment: EnvironmentPolicy;
  verification: VerificationPolicy;
};
```

设置页应该编辑这份合同，而不是单独摆放互不相干的开关。

### 4.2 视觉上下文包 Target Packet

用户点中一个按钮后，Agent 收到的不是“坐标 x=79, y=43”，而是结构化上下文：

```json
{
  "target": {
    "kind": "element",
    "elementId": "primary-cta",
    "name": "主行动按钮",
    "tag": "button",
    "visibleText": "预约工作室体验",
    "bounds": { "x": 79, "y": 43, "width": 168, "height": 48 },
    "style": { "color": "accent", "size": "normal" }
  },
  "artifact": { "projectId": "project-luma", "versionId": "v12" },
  "annotations": [],
  "userRequest": "把这个按钮改大一点"
}
```

这会成为 Magic Code 最重要的产品协议。它让点选、框选、批注、独立提问和版本对比共享同一份语义上下文。

## 五、运行时架构

```text
┌──────────────────── Magic Code 工作台 ────────────────────┐
│ Chat UI        Target Packet        Preview / Inspector   │
└───────────────┬─────────────────────┬────────────────────┘
                │                     │
                ▼                     ▼
        Agent Gateway          Artifact Adapter
                │                     │
                ▼                     ▼
        Visual Agent Runtime ── Version Store
          ├─ Model Adapter      ├─ snapshots
          ├─ Tool Registry      ├─ diff / compare
          ├─ Approval Gate      └─ rollback
          ├─ MCP Router
          ├─ Skill Loader
          ├─ Sandbox Adapter
          ├─ Verification Loop
          └─ Event / Session Store
```

### 5.1 Model Adapter

统一不同供应商的消息、流式事件、tool call、错误和 token 使用量。UI 不应该知道 Anthropic 的 content block 或 Google 的 candidates 结构。

### 5.2 Tool Registry

所有能力都注册为统一工具接口：

```ts
type AgentTool = {
  name: string;
  description: string;
  inputSchema: JsonSchema;
  risk: "read" | "write" | "network" | "external";
  execute(input: unknown, context: ToolContext): Promise<ToolResult>;
};
```

首批工具应包括：

- `inspect_artifact`：读取作品结构和元素属性；
- `select_target`：创建点选或框选 Target Packet；
- `apply_artifact_patch`：修改作品状态；
- `read_project_file` / `write_project_file`：读写项目文件；
- `create_version` / `restore_version` / `compare_versions`；
- `sync_annotations`；
- `export_artifact`；
- `web_search`；
- `mcp_call`。

### 5.3 Approval Gate

审批要发生在执行前，且必须显示：将要调用的工具、目标范围、输入摘要、预计副作用、允许一次还是允许本轮。

示例：

```text
Agent 想要写入 3 个项目文件，并覆盖当前预览版本。
范围：/workspace/luma/**
原因：同步右侧批注中的按钮样式修改
[仅允许这次] [允许本轮] [拒绝]
```

### 5.4 Verification Loop

视觉任务的默认完成条件：

1. 作品 patch 应用成功；
2. 预览重新渲染成功；
3. 目标元素仍然存在且属性符合请求；
4. 没有明显布局溢出或空白；
5. 新版本已保存；
6. Agent 向用户报告实际变化和验证结果。

### 5.5 Event / Session Store

每个 Agent turn 应记录：

```ts
type AgentEvent =
  | { type: "turn.started"; turnId: string }
  | { type: "model.delta"; text: string }
  | { type: "tool.requested"; tool: string; input: unknown; risk: string }
  | { type: "approval.requested"; approvalId: string }
  | { type: "tool.completed"; tool: string; output: unknown }
  | { type: "verification.completed"; checks: VerificationCheck[] }
  | { type: "version.created"; versionId: string }
  | { type: "turn.paused"; reason: string }
  | { type: "turn.completed"; summary: string }
  | { type: "turn.failed"; error: AgentError };
```

对话区应该渲染这些事件，而不是只显示最终 assistant 文本。

## 六、界面应该如何体现“原生 Agent”

### 中间对话区

- 显示当前 turn 的运行状态：理解目标、读取作品、调用工具、等待审批、验证中；
- 工具调用以可展开事件显示输入和结果；
- 支持暂停、继续、停止和重试；
- 对失败显示恢复动作，而不是一句“出错了”；
- 每个完成的 turn 显示版本、验证和导出结果。

### 右侧预览区

- 顶部显示当前 Agent 正在作用的作品版本；
- 点选、框选、批注直接生成 Target Packet；
- 工具执行期间显示变更范围和实时状态；
- 完成后提供 before / after、验证结果和回退；
- 预览区是 Agent 的可视化执行器，不是纯展示区。

### 左侧导航

- 项目和纯对话分离；
- 一个项目可以打开多个会话；
- 会话显示运行状态、暂停原因和最近版本；
- 设置只编辑 Agent 合同，不代替 Agent 运行时。

## 七、设置架构：从“栏目”改为“运行合同”

设置页建议按 Agent 生命周期组织：

1. **Agent**：名称、系统指令、默认模型、响应语言；
2. **Tools**：工具注册、风险等级、调用上限、MCP；
3. **Environment**：工作区、沙箱、网络、端口、文件范围；
4. **Approvals**：审批策略、写入前确认、MCP 审批、暂停策略；
5. **Sessions**：恢复、上下文压缩、事件保留、预算；
6. **Skills**：技能目录、启用条件、技能版本；
7. **Verification**：预览检查、版本检查、导出检查；
8. **Connections**：模型供应商、MCP endpoint、连接测试和错误日志；
9. **Appearance**：仅处理工作台表现，不混入运行权限。

这样每个栏目都对应运行时一个真实边界，而不是一个模板说明。

## 八、Magic Code MVP 路线

### P0：把现有演示升级为可解释运行时

- Agent Event 类型和本地追加日志；
- `run -> tool -> result -> verify -> complete` 状态机；
- 模型流式响应和工具事件显示；
- 当前作品修改仍可使用本地 demo executor；
- 没有 API Key 时明确显示“演示执行器”，不伪装成真实模型。

### P1：视觉 Agent 工具闭环

- Target Packet 标准化；
- `inspect_artifact`、`apply_artifact_patch`、`create_version`、`compare_versions`；
- 右侧预览实时反馈工具结果；
- 写入前审批、拒绝、重试、回退；
- HTML / Markdown / JSON 导出工具接入同一事件流。

### P2：项目环境和 MCP

- 本地项目目录作为 workspace；
- 只读 / 项目内可写沙箱；
- BoardUI MCP 作为真实 MCP server 连接，而不是开关；
- MCP 工具发现、allowed tools、连接错误和审批；
- 项目会话可暂停并恢复。

### P3：长任务与多 Agent

- token / 工具调用 / 时间预算；
- 视觉检查 Agent、文案 Agent、实现 Agent 的隔离子会话；
- 子 Agent 只返回结构化结果，不污染主会话上下文；
- 主 Agent 汇总、验证并决定是否应用。

## 九、当前实现与目标的差距

当前工作台已经具备：

- 多模型连接配置和本地持久化；
- 一个最小模型 API 路由；
- 项目、会话、作品版本和批注关联；
- 点选、框选、独立提问、导出和版本回退的交互基础。

仍需要从“演示状态”升级的部分：

- 当前主对话仍主要使用本地作品演化逻辑，尚未把所有修改转换为统一工具调用；
- API 路由当前返回最终文本，尚未流式暴露完整 tool events；
- MCP 配置界面已有，但需要实际连接、工具发现和审批执行器；
- 本地浏览器存储 API Key 只适合 MVP，生产版应使用服务端密钥或 vault；
- 沙箱、命令执行和真实文件 patch 还需要独立执行环境；
- 验证循环需要从 UI 状态提示升级为真实渲染检查和结构化检查结果。

## 十、验收标准

一个 Magic Code turn 只有满足以下条件才算完成：

- 用户目标和 Target Packet 已记录；
- Agent 明确展示当前阶段和下一步；
- 每次工具调用都有输入、风险和结果；
- 写入、网络和 MCP 调用经过审批策略；
- 作品修改产生新版本，可对比和回退；
- 预览执行了最少一轮验证；
- 失败可以重试、暂停、修复或恢复，而不是丢失上下文；
- 会话刷新或服务重启后可从最近安全事件继续；
- 最终回复说明实际修改、验证结果和仍需人工确认的事项。

## 十一、当前落地状态

本轮已经在工作台中落地 P0/P1 的运行时骨架：

- 会话新增持久化 Agent 事件流，记录 turn、视觉上下文、模型请求、工具执行、审批、版本和验证；
- 高风险指令会在工具执行前暂停，支持允许这次、拒绝和停止当前运行；
- 作品修改会创建版本，并将“工具完成 -> 预览验证 -> 版本保存 -> turn 完成”写入同一条事件链；
- 模型连接状态会真实反映到 Composer，不再固定显示演示模型；
- `/api/agent` 支持 OpenAI、OpenAI Compatible、Anthropic、Google 和本地 OpenAI 协议；
- 未配置凭据时明确回退到本地演示执行器，同时保留完整事件记录；
- 旧会话数据迁移时会自动补齐 `events`，不会清除已有项目、对话和版本。

尚未宣称为生产级的部分是独立沙箱、真实 MCP 工具发现 / 执行、流式 tool call 和服务端密钥托管。这些属于 P2 的执行基础设施，不应继续伪装成设置项已完成。

## 参考资料

- [X：Session、Harness、Sandbox 的分层讨论](https://x.com/unikoukokun/status/2042158530049056993)
- [X：Harness 错误处理与验证循环](https://x.com/lucas_flatwhite/status/2041478080611668446/photo/3)
- [X：长运行 Agent 的上下文与恢复](https://x.com/systematicls/status/2038241033755168959)
- [X：Human-in-the-loop 审批边界](https://x.com/v_shakthi/status/2039889360955609385)
- [X：Codex 的高目标上下文、工作树与技能](https://x.com/sch/status/2018398527177801999)
- [OpenAI Agents](https://developers.openai.com/api/docs/guides/agents)
- [OpenAI Agents API 概览](https://developers.openai.com/api/docs/guides/agents-api/overview)
- [OpenAI Sandbox Agents](https://developers.openai.com/api/docs/guides/agents/sandboxes)
- [OpenAI MCP connections](https://developers.openai.com/api/docs/guides/agents-api/tools/mcp)
- [OpenAI Skills](https://developers.openai.com/api/docs/guides/tools-skills)
