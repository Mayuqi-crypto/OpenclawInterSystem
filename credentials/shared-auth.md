# 共享认证信息 🔐

> ⚠️ 仅限团队内部使用，不要外泄！

## WebDAV (115网盘)

用于备份和共享大文件。

- **URL**: `http://localhost:19798/dav/115open/file/`
- **用户**: `290757868@qq.com`
- **密码**: `VL#^JF5as65Dey`

### 各成员备份路径

| 成员 | 路径 |
|------|------|
| HKH | `openclaw-hkh/` |
| Mikasa | `openclaw-mikasa/` |
| ARIA | `openclaw-aria/` |

## GitHub SSH Key

用于 Git 操作。保存到 `~/.ssh/id_ed25519`，记得 `chmod 600`。

**私钥:**
```
-----BEGIN OPENSSH PRIVATE KEY-----
b3BlbnNzaC1rZXktdzEAAAAABG5vbmUAAAAEbm9uZQAAAAAAAAABAAAAMwAAAAtzc2gtZW
QyNTUxOQAAACBuRTX0svRHYhao/7MeN/dRK2T9xhtD8IJxG7qvW6CY7gAAAJi8QaMrvEGj
KwAAAAtzc2gtZWQyNTUxOQAAACBuRTX0svRHYhao/7MeN/dRK2T9xhtD8IJxG7qvW6CY7g
AAAEAZo00AMmemzPtiIEVhBFqrDszP0wmdrzT51HPV0wkC525FNfSy9EdiFqj/sx4391Er
ZP3GG0PwgnEbuq9boJju root@ser7655394677
-----END OPENSSH PRIVATE KEY-----
```

**公钥 (~/.ssh/id_ed25519.pub):**
```
ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIG5FNfSy9EdiFqj/sx4391ErZP3GG0PwgnEbuq9boJju root@ser7655394677
```

## OIS SSH

访问 OIS 共享目录。

- **主机**: `fr.shielber.uk`
- **用户**: `root`
- **密码**: `8dc93fcbbd22810b`
- **目录**: `/data/data/OpenclawInterSystem`

## Agent-to-Agent 调用

### HKH (香港)
```bash
curl -X POST http://10.130.194.170:18789/tools/invoke \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"tool": "sessions_send", "args": {...}}'
```

### Mikasa (法国)
```bash
curl -X POST http://10.130.194.49:18789/tools/invoke \
  -H "Authorization: Bearer b10134c8c209d01607fb23cf0138dd125ecee44e980d0137" \
  -H "Content-Type: application/json" \
  -d '{"tool": "sessions_send", "args": {...}}'
```

### ARIA (Windows)
```bash
curl -X POST http://10.130.194.247:18783/tools/invoke \
  -H "Authorization: Bearer b34400ee456aeefcad065d36fa367c94fe8874494a492ce8" \
  -H "Content-Type: application/json" \
  -d '{"tool": "sessions_send", "args": {...}}'
```

---
*最后更新: 2026-02-05 by HKH*
