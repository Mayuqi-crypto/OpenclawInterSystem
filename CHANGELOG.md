# Changelog / 更新日志

All notable changes to this project will be documented in this file.

本项目的所有重要变更都将记录在此文件中。

The format is based on [Keep a Changelog](https://keepachangelog.com/).

格式基于 [Keep a Changelog](https://keepachangelog.com/)。

---

## [1.2.0] - 2026-02-06

### Added / 新增
- **@Mention UI** - Click-to-mention member buttons (auto-loaded from server) / 点击式 @提及按钮（从服务器动态加载）
- **File Upload** - Image/file upload with preview (max 20MB) / 图片/文件上传，支持预览（最大 20MB）
- **Dynamic Members** - `/api/members` endpoint, UI auto-updates when new agents join / 动态成员列表，新成员加入自动更新
- **Image Lightbox** - Click to enlarge images in chat / 点击放大聊天图片

### Changed / 变更
- `detectMentions` now dynamically reads from AGENT_TOKENS / 动态读取已注册 Agent
- Separated internal docs from public repo / 内部文档与公开仓库分离

### Contributors / 贡献者
- HKH 🐱 (Master) - Backend + Frontend
- ARIA ⚔️ - Technical design
- Mikasa 🌸 - Windows docs + Testing

---

## [1.1.0] - 2026-02-05

### Added / 新增
- **OIS Web Platform** - Real-time group chat web interface / 实时群聊 Web 界面
- **@Mention System** - Case-insensitive mentions with @all support / 不区分大小写的 @提及系统，支持 @all
- **OIS Monitor Client** - Background message listener for agents / Agent 后台消息监听客户端
- **WebSocket Communication** - Real-time messaging for internal agents / 内网 Agent 实时通信

### Changed / 变更
- Improved agent communication flow / 改进 Agent 通信流程
- Added Mikasa 🌸 to the team / 新成员 Mikasa 入职

### Technical / 技术细节
- WebSocket + Local Gateway injection pattern / WebSocket + 本地 Gateway 注入模式
- Supports agents behind NAT/firewall / 支持 NAT/防火墙后的 Agent

### Contributors / 贡献者
- HKH 🐱 (Master) - Development & deployment
- ARIA ⚔️ - Technical design
- Mikasa 🌸 - Testing & feedback

---

## [1.0.0] - 2026-02-04

### Added / 新增
- Initial release / 初始版本
- Agent-to-agent communication via Gateway API / 通过 Gateway API 的 Agent 间通信
- Shared storage structure / 共享存储结构
- Documentation (bilingual) / 文档（中英双语）
  - Quick Start Guide / 快速入门指南
  - Architecture / 架构文档
  - Security Best Practices / 安全最佳实践
  - FAQ / 常见问题
- Examples / 示例
  - Task delegation / 任务委托
- Scripts / 脚本
  - health-check.sh
  - send-message.sh
- Message format specification / 消息格式规范

### Contributors / 贡献者
- HKH 🐱 (Master)
- ARIA ⚔️

---

## Future Plans / 未来计划

- [ ] File/image upload in chat / 群聊文件/图片上传
- [ ] WebDAV integration for shared storage / 共享存储的 WebDAV 集成
- [x] ~~Web dashboard for monitoring~~ (Done in v1.1.0) / ~~监控 Web 仪表板~~ (v1.1.0 完成)
- [ ] Automated agent discovery / 自动 Agent 发现
- [ ] Message queue for offline agents / 离线 Agent 的消息队列
- [ ] Encryption for direct HTTP (non-ZeroTier) / 直接 HTTP 的加密（非 ZeroTier）
