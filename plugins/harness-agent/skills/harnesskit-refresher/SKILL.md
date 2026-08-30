---
name: harnesskit-refresher
description: 根据已暂存差异最小同步并暂存仓库权威产物。用于原生 Git 提交准备的刷新阶段。
---

# HarnessKit: Refresher

1. 切换到 Agent 反馈指明的仓库并读取仓库指令。运行
   `harnesskit refresher diff --root /absolute/repository`，不要用普通 `git diff` 代替。该命令
   比较 HEAD tree 与当前 index `write-tree`。只有 `HEAD` 是有效 symbolic ref 且该 ref 尚不存在的
   真实 unborn repository 才使用 empty tree；valid detached HEAD 正常读取其 tree。detached missing
   object、corrupt HEAD/ref 或任意 `HEAD^{tree}` object error 都明确失败，绝不能把 index 当成全新增。
   完整 staged diff 上限为 1 MiB；超过上限会明确失败且不输出 partial diff。失败时 fail-open no-op，
   不猜测或用 partial input 刷新。
2. 查找 `.harnesskit/audit/artifact-manifest.json`。不存在、不可读或无效时有界 no-op；不猜测路径。
3. 解析 manifest，只支持 schema 6 的 `artifacts[]`；其他 schema 版本有界 no-op。把每条 artifact
   的 `path` 去掉其 owner 的固定相对路径。owner 到固定相对 path 的映射与 `src/manifest.rs`
   完全一致，不允许动态路径：

   - `agents` → `AGENTS.md`
   - `agents-routing` → `AGENTS.md`
   - `architecture` → `docs/ARCHITECTURE.md`
   - `coding` → `docs/rules/CODING.md`
   - `design-system` → `docs/DESIGN_SYSTEM.md`
   - `development` → `docs/DEVELOPMENT.md`
   - `glossary` → `docs/GLOSSARY.md`
   - `interaction-design` → `docs/INTERACTION_DESIGN.md`
   - `reliability` → `docs/rules/RELIABILITY.md`
   - `security` → `docs/rules/SECURITY.md`
   - `validation` → `docs/VALIDATION.md`

   严格有效性边界：manifest 必须通过 repository-root-anchored no-follow regular-file read；manifest
   本身或任一 parent 是 symlink（Windows 为 reparse point）、缺失或非预期类型时整体 no-op。顶层只能
   包含 `schema_version` 与 `artifacts`，两者都 required 且 schema 必须精确为 6；`artifacts` 必须是
   array，artifact object 只能包含 `path` 与 `owner`，两字段都 required；owner 必须来自上述十一项。

   `<safe-prefix>` 明确定义为 empty（repository root），或满足以下全部条件的非空 repository-relative
   string：不得包含 JavaScript whitespace U+0009–U+000D、U+0020、U+00A0、U+1680、
   U+2000–U+200A、U+2028、U+2029、U+202F、U+205F、U+3000、U+FEFF；不得包含控制字符
   U+0000–U+001F 或 U+007F；不得以 `/` 或 `\` 开头，不得包含 `\` 或 `:`，第二个 byte 不得是
   `:`（因此拒绝 Windows drive/prefix）；以 `/` 分段后不得有空、`.` 或 `..` segment。artifact path
   必须精确等于该 owner 的 fixed path，或精确等于 `<safe-prefix>/<fixed-path>`，不允许其他 suffix、
   动态 path 或大小写替代。`glossary` 只允许精确根路径 `docs/GLOSSARY.md`，不允许范围前缀。

   所有 artifact path 必须按 Rust `str::chars()` 的 Unicode scalar value 字典序严格递增，因此同时
   exact-string 唯一；不使用 locale、case-fold 或 byte sort。`agents` 和 `agents-routing` 不能在同一
   scope prefix 同时登记。每个非空 scope prefix 还必须从 repository root 对每层执行 no-follow
   lookup 并解析为已存在 directory；missing、regular file、symlink，或 Windows reparse point 都使
   整个 manifest no-op。任一边界不满足都整体有界 no-op，不使用部分 manifest。

   Refresher must never automatically maintain Glossary。`glossary` 只参与上述 manifest 完整有效性检查。
   manifest 整体有效后，必须把所有 `owner=glossary` 条目从 read、update 与 stage 候选集合中排除；
   Refresher must not read, update, or stage Glossary；不得读取、修改或暂存
   `docs/GLOSSARY.md`，也不得因为 staged diff 命中根范围而把它重新加入候选。

   对有效条目，得到该条的范围前缀（根为空），
   按最长前缀匹配路由 staged diff 中的非 Harness Agent
   路径：路径等于某个非空前缀或以该前缀加 `/` 开头时命中该范围，多个前缀同时匹配取
   最长的那个；读取根 `AGENTS.md`、命中路径上各级已登记的 `AGENTS.md` 链，以及最深
   命中前缀已登记的 Architecture 产物。
4. diff 同时命中多个范围、没有命中任何范围，或修改 root/shared build、workspace、
   schema、generator、公共入口时，再读取根一级（前缀为空）已登记的相关 artifact。
   普通范围内改动不要扫描其他范围的 Architecture。
5. 除已明确排除的 Glossary 外，只读取仓库内现存、非 symlink 的上述 Markdown。manifest、范围 mapping 或目标无效时有界 no-op，
   不猜测路径。
6. 对照 staged diff 最小更新实际发生漂移的 Architecture、AGENTS 或全仓 rules。
   不请求用户确认，不做无关整理，也不运行项目测试。
7. 用 `git add -- <paths>` 整文件显式暂存且只暂存本 skill 实际修改的非 Glossary artifact paths，并报告排序、
   去重后的路径。无漂移时有界 no-op。
8. 不调用 Memory Skill、Promotion、ready 或 commit，不重试 preparation，不保存 pending/ready、
   receipt、marker 或 outbox。由宿主 Agent 完成本轮后自行运行原生 Git。
