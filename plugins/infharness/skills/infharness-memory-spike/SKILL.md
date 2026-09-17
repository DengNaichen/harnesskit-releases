---
name: infharness-memory-spike
description: 仅在 InfHarness turn gate 明确委派时，筛选并追加当前 root session 中值得跨会话保留的仓库观察。
---

# InfHarness: Observation

仅在 InfHarness SessionStart turn gate 明确委派时执行，仅对 primary/root agent 生效。没有该委派时立即停止，不调用工具、不访问网络、不修改文件。每个 root turn 至多执行一次；不得由 subagent、自主检查或用户直接调用。筛选普通 Repository Observation 与 confirmed Glossary Evidence 两类平级候选，并把保留项连同 nullable owner 放入同一个 Observation batch；成功写入达到维护阈值时，委派同一个 Agent 执行现有 Refresher 的本地整理流程。

Memory Spike 负责 append 前的普通候选 gate。正常 Refresher 文档刷新与 append 的维护阈值是两个独立入口，
都由同一 root agent 整理当前已认证 user、Repository 与 exact branch 的 Observation。最多 20 条且 content
累计不超过 32 KiB UTF-8 bytes 是每次维护的 batch 边界，不是候选准入条件，也不是正常刷新必须等待的触发点。

## 筛选

1. 完成当前用户任务后、发送 final 前复核 repository-scoped delta。可以使用完整 root session 的
   证据形成跨 turn 结论，不要求决定性证据只来自当前 turn。
2. 只保留会明显改变未来 Agent 对当前 Repository 的设计、实现、验证、运维或工程协作判断，并且
   有明确会话证据、无法从稳定产物轻易重读的内容。
3. 以用户最新明确结论为准。排除已被纠正、明确拒绝、已经过时、包含敏感信息、纯进度、一次性
   操作日志、未采纳提议、猜测或隐藏推理的内容。
4. 只发送筛选后的自包含结论，不发送完整仓库、完整对话或 transcript。batch 内做语义去重，不声称
   完成跨 batch 去重。

## 候选分类

完成通用筛选后，每个候选必须按内容职责归入以下两类平级候选之一，并在 append 时直接给出 owner。

### 普通 Repository Observation

普通 Repository Observation 回答会影响未来 Agent 工程判断的事实、决定、约束、失败模式、工程偏好或
持久未知。其中“未来修改必须怎样做”以及“何时必须或不得采取某项行动”是行为约束，属于普通
Repository Observation。能可靠归属现有 artifact owner 时使用该 exact owner；只值得 Recall 或暂时无法可靠归属时使用 null。例如：

`Workspace 必须从 authenticated actor 派生。`

### confirmed Glossary Evidence

confirmed Glossary Evidence 只回答“代码库特有概念是什么”。它必须是用户在当前完整 root session 中明确
确认的新规范术语、对既有定义的精确修订，或明确的避免用词；必须能表达为 one term、one or two sentences
的定义及可选 `_Avoid_`，owner 固定为 `glossary`。例如：

`Workspace 是成员、Repository 与权限归属的组织边界。`

不得因出现领域名词就把一句话判为 Glossary Evidence。

### 混合内容

同一句同时包含概念定义和行为约束时，拆成两个自包含 Observation；不得把行为规则塞进术语定义，也不得为了保留原句而模糊两类 owner。

两类候选都写成 `{content, owner}`；不上传 kind、status、proposal、target path、branch、session、author 或时间。batch 内一起去重并进入同一个 Observation batch；same root turn 仍然 at most one append batch，不单独追加第二批。

## 无候选

两类都没有候选时不调用 helper、Skill 或 MCP，直接发送原本的 final。

## 有候选

只向用户已配置且已认证的 `infharness` MCP server 发送本次筛选后的 Observation batch。模型调用
`append_repository_observations` 时只生成 `observations`；InfHarness PreToolUse 会在同一次执行前用本地
Git 整体覆盖 top-level `canonical_remote` 与 `client_context`。不得由模型猜测、读取或生成这两个字段。
append 至多调用一次。只在该调用成功且返回布尔值 `maintain_required: true` 时，读取同一分发目录的
[`infharness-refresher`](../infharness-refresher/SKILL.md)，明确以“仅执行本地整理与云端写回”的阈值入口
委派给当前 root agent，并完成其中一个 bounded batch。此入口不需要 Git diff、不重新 append、不创建
第二个 agent。false、字段缺失、非布尔值或 append 失败时，不触发阈值维护。

具体工具选择、Skill 调用语法与调用编排由当前宿主 Agent 决定；本 Skill 不为 Codex、Claude Code、
Cursor 或 InfCode 维护独立执行策略。

## 失败与回答边界

- Observation append 非幂等；只保证 at-most-once 尝试，不宣称 exactly-once。
- append 或 Hook context 注入失败时不重试，不声称写入成功。
- 无论成功或失败，都不修改、补充、重发或重复原答复，不向用户报告 gate、筛选、写入或阈值。
- Observation 筛选与 append 本身不修改 Repository 或 Git 状态；阈值委派后的文档修改与暂存仅由
  Refresher 的既有 owner 边界负责。不保存本地 receipt，不创建 outbox，不启动后台任务、daemon、timer、cron。
- 模型不发送 session ID、turn ID、时间、author、credential、branch、HEAD 或其他运行元数据。
