# FilesCodeBox OpenWrt / iStoreOS

[![CI](https://github.com/filescodebox/openwrt/actions/workflows/ci.yml/badge.svg)](https://github.com/filescodebox/openwrt/actions/workflows/ci.yml)
[![Release](https://github.com/filescodebox/openwrt/actions/workflows/release.yml/badge.svg)](https://github.com/filescodebox/openwrt/releases)
[![License](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](./LICENSE)

FilesCodeBox（文件快递柜，匿名口令分享文本/文件）的 **OpenWrt / iStoreOS 原生包**：单进程 Go 二进制 + 内置 Web 界面，procd 托管、开机自启，以 ipk 一键安装。

- 单端口 `12345` 同时服务 Web 界面与 API（前端 dist 内置于包中）
- 匿名取件/直传依赖的 Redis 由包依赖自动安装（`redis-server`，OpenWrt 官方源）
- JWT 密钥自动生成并持久化，开箱即用、重启不失效
- 配置走 UCI（`/etc/config/filescodebox`），高级项支持 drop-in `config.yaml`
- 双架构：`x86_64`（iStoreOS 主流）/ `aarch64_generic`（ARM SBC）

> 内存建议 ≥512MB（Go 服务 + Redis）。纯软路由小内存设备不适用。

## 安装

### iStore（iStoreOS）

iStore → 手动安装 → 粘贴 ipk 下载 URL（本仓 [Releases](https://github.com/filescodebox/openwrt/releases) 对应架构资产），或上传本地 ipk 文件。

### opkg（任意 OpenWrt/iStoreOS）

```sh
# x86_64 设备
wget -O /tmp/filescodebox.ipk https://github.com/filescodebox/openwrt/releases/download/v0.1.0/filescodebox_0.1.0-1_x86_64.ipk
opkg install /tmp/filescodebox.ipk
```

（aarch64 设备换 `aarch64_generic` 包。）安装即自动启用并启动，浏览器访问 `http://<路由器IP>:12345`。

- 默认管理员 `admin/admin123`——**装完先改密码**（UCI `main.admin_password` 或登录后修改）
- 彻底卸载：`opkg remove filescodebox`（数据保留在 `/etc/filescodebox/`，确认无用后手动删除）

## 配置

`/etc/config/filescodebox`（UCI），改完执行 `/etc/init.d/filescodebox reload`：

| 选项 | 默认 | 说明 |
|---|---|---|
| `main.enabled` | `1` | 服务总开关 |
| `main.port` | `12345` | 监听端口 |
| `main.host` | `0.0.0.0` | 监听地址 |
| `main.data_dir` | `/etc/filescodebox/data` | SQLite+上传文件+JWT 密钥；**大量文件建议指到数据盘**（如 `/mnt/sda1/filescodebox`） |
| `main.open_upload` | `1` | 允许匿名上传 |
| `main.admin_password` | 空 | 管理员密码（留空=默认 `admin123`，务必修改） |
| `main.base_url` | 空 | 站点对外 URL（直链下载/presign 需要，局域网直访可留空） |
| `redis.enabled` | `1` | 关闭后服务可用但匿名取件不可用 |
| `redis.host` / `redis.port` | `127.0.0.1:6379` | Redis 地址（`redis-server` 包默认值） |
| `redis.password` | 空 | Redis 密码 |

UCI 之外的配置项（S3/OIDC/联邦/mcp 等）：把 [configs/config.yaml](./configs/config.yaml) 复制为 `/etc/filescodebox/config.yaml` 修改后重启服务即可（UCI 注入的环境变量优先级更高）。完整配置说明见 [server 仓](https://github.com/filescodebox/server) `configs/` 与 `docs/ENVIRONMENT_VARIABLES.md`。

服务管理：

```sh
/etc/init.d/filescodebox start|stop|restart|reload|enable|disable
logread | grep filescodebox   # 日志(procd stdout→syslog)
```

## 从源码构建

```sh
go build -o dist/filescodebox ./cmd/filescodebox   # CGO_ENABLED=0,纯 Go sqlite
./scripts/build-frontend.sh                        # 前端 dist → dist/www
./scripts/build-ipk.sh x86_64 0.1.0                # → dist/filescodebox_0.1.0-1_x86_64.ipk
```

CI 每次推送在 OpenWrt rootfs 容器（`openwrt/rootfs:x86-64-23.05.6`，对齐 iStoreOS 基线）内真实 `opkg install` + 服务启动 + `/ping` 探活。

## 架构

```
/etc/init.d/filescodebox   procd init:UCI→FCB_* env 注入
/usr/bin/filescodebox      BootstrapWithOptions(WithStaticDir) 单进程业务+UI
/usr/share/filescodebox/www 内置前端(Vite 构建产物)
/etc/config/filescodebox   UCI 配置(conffile)
/etc/filescodebox/         数据目录(SQLite/上传文件/.jwt_secret)
```

依赖 `github.com/filescodebox/core`（正式 tag 钉版）。工作区内开发经 hub `go.work` 联编本地 core，`GOWORK=off` 强制钉版构建。

## 生态

[filescodebox](https://github.com/filescodebox/filescodebox)（装配仓）· [core](https://github.com/filescodebox/core)（业务核心）· [server](https://github.com/filescodebox/server)（独立部署壳）· [frontend](https://github.com/filescodebox/frontend) · [fnos](https://github.com/filescodebox/fnos)（飞牛 fnOS 适配）· [desktop](https://github.com/filescodebox/desktop)（桌面端）· [charts](https://github.com/filescodebox/charts)（Helm）

## License

[Apache-2.0](./LICENSE) — Copyright 2026 FilesCodeBox
