---
name: infharness-guide
description: >-
  InfHarness 产品使用指南。普通编码、局部优化和一般技术问答不触发。
---

# InfHarness 使用指南

把用户的目标对应到 InfHarness 已提供的能力，读取当前 MCP 指南后完成请求。具体流程由服务端资源维护，本 Skill 负责入口选择与发现。

## 选择入口

| 用户目标或典型表达 | `infharness_context` 的 `context` |
| --- | --- |
| “给这个仓库建立最佳实践”“按这个技术栈完善工程规范”：基于已落地脚手架或现有项目骨架建立指导文档 | `best-practice` |
| “给现有项目配置 Harness 上下文”“让 Agent 理解这个仓库”：依据项目事实建立 AGENTS 和相关上下文文档 | `bootstrap` |
| “评估这个仓库的 Harness”“给项目的 Agent 工程能力打分”：评估已注册 Repository | `scoring` |
| “让 Agent 改完文件自动格式化并检查质量”：配置现有项目的 Agent 生命周期 Hooks | `agent-hooks` |

用户明确要求建立最佳实践时优先选择 `best-practice`，不要仅因输出包含 AGENTS 或 rules 就改走 `bootstrap`。技术栈和目录以用户要求及仓库证据为准；缺少应用骨架时，按资源中的前提处理，不猜测框架。

询问产品有哪些能力时，不传 `context` 获取当前目录，再说明相关用途。只问用法时解释流程，不执行落盘、评分提交或安装。只有目标存在影响结果的歧义时才澄清；不要要求用户选择工具名。

## 如何使用 MCP 工具

先在宿主当前可用工具中查找已配置的 InfHarness MCP。采用延迟加载的宿主，先用其工具发现机制搜索下表中的工具名，再读取实际 schema。表中使用服务端工具名；宿主可能添加 server 前缀，调用时使用实际暴露的名称，不猜测前缀或 server 标识。

| 工具或宿主能力 | 什么时候用 | 如何调用与处理结果 |
| --- | --- | --- |
| `infharness_context` | 查询产品工作流，或进入上表中已确定的能力 | 查询目录传 `{}`；例如最佳实践传 `{"context":"best-practice"}`。从返回的 `documents` 中找到入口及相关资源 URI。此调用只发现文档，不执行工作流。 |
| 宿主提供的 MCP resource 读取能力 | 获得入口 URI 后，或指南要求继续读取子资源时 | 指定提供目录的同一 server 和返回的 URI，读取正文。例如读取 `infharness://context/best-practice`。这是 MCP 的资源读取能力，不是名为 `best-practice` 的产品工具；具体调用名称和参数以宿主为准。 |
| `submit_repository_harness_score` | 用户要求评分，且已读评分资源、完成本地评估后 | 按当前 schema 提交 `canonical_remote`、`rubric_version`、`score`、`dimensions`，以及可选 `suggestions`。它保存评价，不代替 Agent 计算；读取成功结果后才能声称已提交。无需传 Workspace。 |
| `list_workspaces` | 用户任务需要显式 Workspace，且尚无已确认的目标 ID 时 | 传 `{}`，取得当前用户可访问的 Workspace ID 与名称。列表不代表用户已选定目标；不要把它作为上下文读取或 Repository 评分的前置步骤。 |
| `list_workspace_hooks` | 用户要查找已保存的团队 Hook | 传明确的 `workspace_id`，按需使用名称过滤和分页参数；返回摘要与稳定 Hook ID，完整字段以实际 schema 为准。 |
| `get_workspace_hook` | 已知 Hook ID，需要读取完整内容时 | 传 `hook_id`，读取返回的文件和配置；读取不等于执行或安装。 |
| `save_workspace_hook` | 用户明确要求将 Hook 保存到团队 Workspace 时 | 按实际 schema 提交明确的 Workspace、名称、请求 ID、支持的 bundle 格式、配置路径和文件。保存是云端写入，不等于向成员设备分发或本地安装；遵循工具的重放与冲突约定。 |
| `append_repository_observations` | 现有生命周期明确委派记忆收集时 | 由 `infharness-memory-spike` 指导调用；业务输入为 `observations`，来源身份由 Hook 注入。本指南不单独触发它。 |
| `get_repository_observation_promotion_snapshot` → `prepare_repository_observation_promotions` → `record_repository_observation_promotions` | 现有生命周期明确委派观察维护时 | 由 `infharness-refresher` 管理读取批次、准备候选、本地应用和确认结果。不得跳过本地应用直接确认，也不凭本表自行启动维护。 |

例如“给这个仓库建立最佳实践”：发现 `infharness_context` → 传 `{"context":"best-practice"}` → 读取返回的入口资源正文 → 按正文读取适用 Profile 和参考资料 → 在目标仓库执行并验证。仅拿到 URI 不算读过指南，也不要把 URI 当作网页地址或本地路径。

服务端当前返回的目录、指南和工具 schema 是具体步骤的依据。仅加载当前任务需要的资源；团队 Hook 的保存/读取与项目 `agent-hooks` 配置是不同操作，根据用户请求选择。

读取指南不会修改仓库；实际文件读写与验证由本地 Agent 执行。沿用用户已授权的任务范围及目标仓库的工作约定。指南中出现其他能力不意味着应一并执行。

## 能力边界

- `bootstrap` 资源指导本地上下文编写，不创建云端 Bootstrap Job；MCP 不提供 Job 或远端交付工具。
- `scoring` 按当前评分指南在本地评估，再通过对应 MCP 工具提交。Repository 归属决定 Workspace，不额外要求选择 Workspace；未注册时按返回结果说明，不自动注册。
- `agent-hooks` 针对 Agent 生命周期，不是 Git hooks。先读取资源中的宿主支持范围，不把某一宿主的示例宣称为所有宿主均可用。
- 记忆收集与文档刷新由现有生命周期委派和专用 Skills 管理。加载本指南不触发 Observation append 或 Refresher，也不绕过它们的触发条件。

## 无法继续时

按实际观察说明卡在哪一步：未发现 MCP server 或工具、认证失败、服务端未提供所需能力、宿主无法读取 resource，或项目缺少必要信息。给出与该原因对应的下一步；不把连接问题解释成“不知道如何为项目建立最佳实践”。

工具或资源读取失败时，不凭此 Skill 的概述假装已经执行服务端流程。保留已完成的本地结果，明确尚未完成的部分；不擅自安装插件、改写 MCP 配置或启动登录。
