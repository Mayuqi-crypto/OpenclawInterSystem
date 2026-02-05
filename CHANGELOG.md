# Changelog / 更新日志

All notable changes to this project will be documented in this file.

本项目的所有重要变更都将记录在此文件中。

The format is based on [Keep a Changelog](https://keepachangelog.com/).

格式基于 [Keep a Changelog](https://keepachangelog.com/)。

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

- [ ] WebDAV integration for shared storage / 共享存储的 WebDAV 集成
- [ ] Web dashboard for monitoring / 监控 Web 仪表板
- [ ] Automated agent discovery / 自动 Agent 发现
- [ ] Message queue for offline agents / 离线 Agent 的消息队列
- [ ] Encryption for direct HTTP (non-ZeroTier) / 直接 HTTP 的加密（非 ZeroTier）
