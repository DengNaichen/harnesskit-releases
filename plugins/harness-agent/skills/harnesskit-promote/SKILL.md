---
name: harnesskit-promote
description: 维护当前仓库 Observation，并经用户确认把稳定提议写入仓库权威产物。用于 Backend 要求维护或原生 Git 提交准备。
---

# HarnessKit: Promotion

Promotion 有两种入口：Observation receipt 明确要求的 maintenance-only，以及 native Git preparation。
两者共用一次 Backend snapshot 与一次有界 preparation；只有 native Git preparation 可以询问用户和写仓库。

## 0. 选择模式

- 明确以 maintenance-only 调用时，不运行 `harnesskit repository artifacts-ready`，不询问用户、不写
  repository、不记录 promoted/declined，完成 Backend preparation 后返回空的 modified artifact paths。
- 其他调用均为 native Git preparation。在读取 remote、调用 MCP、询问用户或写文件前，把工具 cwd/workdir
  设为 Agent 反馈指明的 Repository，并运行固定命令 `harnesskit repository artifacts-ready`。记录命令是否成功且
  stdout 精确为 `true`；其他结果只让用户确认与文件写入 NotApplicable，仍继续完成第1、2节的Backend维护。

## 1. 确认 Repository

把工具 cwd/workdir 设为当前 Repository，运行固定命令 `harnesskit repository remote`。不得增加前后命令、
改写 argv、猜测 remote、扫描其他 remote 或暴露原始 URL。helper 失败或输出为空时直接失败。

使用非空规范 remote 恰好调用一次 MCP `get_repository_observation_promotion_snapshot`，只提交 required
`canonical_remote`。snapshot 必须同时包含 `revision`、Backend 已有界选择的
`maintenance_observation_ids`，以及完整三态 `observations`。每条 Observation 包含
`observation_id`、`content`、nullable `owner`、`status` 与 nullable
`promotion_candidate {candidate_id, proposed_content}`。snapshot、认证、网络或合同失败时直接结束，不重试。

## 2. 有界 preparation

基于 snapshot 做语义去重、合并、内容修订、owner 重分类、状态维护与 proposal 生成：

- `active` 表示仍应 Recall；`covered` 表示已被 repository owner artifact 表达；`superseded` 表示被更新、
  合并或更准确的 Observation 取代。
- `updates` 只提交实际变化的 Observation；每项包含 required `observation_id`、`content`、nullable `owner`、
  `status` 与 nullable `promotion_candidate {proposed_content}`。
- proposal 只属于 owner 非 null 的 Active Observation。owner 必须是当前 schema 6 manifest 的 exact root
  registration；目标 artifact 只从该 registration 推导，不上传 path。
- Glossary Observation 使用 owner `glossary`。proposal 必须保持 one term、one or two sentences 与可选
  `_Avoid_`，并对当前 `docs/GLOSSARY.md` 做 semantic deduplicate 和 conflict check。
- 临时冲突不能静默任选一条；尚无充分证据收敛时保持冲突 Observation 为 Active，不生成含糊 proposal。

`maintenance_observation_ids` 必须原样、完整且仅一次提交 snapshot 给出的有界列表。不得自行扩张 batch、
读取 count/bytes、不得自行计算维护阈值、不得循环读取 snapshot 或在同轮继续处理剩余积压。

当 maintenance 列表非空或 updates 非空时，至多调用一次 MCP
`prepare_repository_observation_promotions`，提交 required `canonical_remote`、`expected_revision`、
`maintenance_observation_ids` 和 `updates`。Backend revision/CAS、认证、网络、语义或 preparation 失败时直接
结束，不重试、不保存本地恢复状态。

maintenance-only 到此结束。不得继续读取 candidate、询问用户或写 repository。native Git模式若第0节
readiness不是精确`true`，也到此返回空paths；不得询问用户、写repository或记录decision。

## 3. 用户确认与写入

native Git preparation 使用 preparation response 返回的 `candidates`；若本轮没有调用 preparation，则使用
snapshot 中已有的非 null candidates。每项最终 candidate 包含 `observation_id`、`content`、`owner`、
`candidate_id` 与 `proposed_content`。

对每项 candidate，从当前 schema 6 manifest 精确解析 owner 的 target artifact；registration 无效时不询问、
不写文件、不记录决定。逐条向用户展示 target artifact 与 proposed content，并接受 accept、rewrite、decline
或 defer：

- accept/rewrite：只有完整文件编辑成功后才加入 `promoted`，并同时保存实际写入的最终
  `applied_content`。
- decline：不写文件，只把 candidate ID 加入 `declined`。
- defer、含糊决定、registration 无效或写入失败：不产生 decision。

处理完全部 candidates 后，只有至少一个决定时才调用一次且至多一次 MCP
`record_repository_observation_promotions`。提交 required `canonical_remote`、
`promoted: [{candidate_id, applied_content}]` 与 `declined: [candidate_id]`；两数组都必须存在，同一 ID 不得
重复或同时出现。MCP 失败时直接报告并停止，同轮不重试。

## 4. 交回

不写 sidecar，不运行项目测试，不 stage，不调用 Refresher，不运行 ready，不创建 commit。只返回本轮实际
修改成功的 artifact paths，按路径排序并去重；没有实际文件修改时返回空列表。

任何模式都不得调用 REST、HTTP client 或 `curl` 写入，不得读取、导出或记录 credential，也不得启动
daemon、timer、后台任务、outbox 或失败恢复流程。
