// Package adminsync 将启动环境注入的 PB_ADMIN_PASSWORD 同步为 admin 账号口令。
//
// 语义:配置面「管理员密码」非空即权威——启动前若 admin 行已存在且口令不一致,
// 就地更新 password_hash(bcrypt,与 core user 服务同款)并递增 session_epoch
// (core 会话语义:改密即吊销全部已签发 JWT);口令一致则不动,昵称/头像等资料
// 零扰动。admin 行不存在时不动作,交 core CreateDefaultAdmin 按 env 播种;
// 口令为空时不动作(存量部署不受影响)。
//
// 与 fnos/qnap 的 .admin_reset 标记机制目标等价(配置面改密码即生效),差异只在
// 触发方式:openwrt 配置面改 UCI 后服务自动重启,启动时同步即生效,无需标记;
// 且就地改哈希不删行,用户资料/关联数据不随重启丢失。
package adminsync

import (
	"database/sql"
	"errors"
	"os"

	// 与 core(gorm 经 glebarez/sqlite)链接同一驱动包:driver 名 "sqlite"
	// 在 core 侧已注册,此处显式引用仅为表达直接依赖,不产生二次注册。
	_ "github.com/glebarez/go-sqlite"
	"golang.org/x/crypto/bcrypt"
)

const adminUser = "admin"

// Sync 保证 admin 口令与 password 一致,返回是否发生更新。
//
//   - password 空 / dbPath 空 → (false, nil) 不动作
//   - 业务库不存在            → (false, nil) core 首启按 PB_ADMIN_PASSWORD 播种
//   - admin 行不存在          → (false, nil) 交给 core 播种(生产门禁/向导语义不变)
//   - 口令已一致              → (false, nil) 幂等,零扰动
//   - 口令不一致              → 更新哈希+递增 session_epoch → (true, nil)
func Sync(dbPath, password string) (bool, error) {
	if password == "" || dbPath == "" {
		return false, nil
	}
	if _, err := os.Stat(dbPath); err != nil {
		return false, nil
	}
	db, err := sql.Open("sqlite", dbPath)
	if err != nil {
		return false, err
	}
	defer db.Close()

	var hash string
	err = db.QueryRow("SELECT password_hash FROM users WHERE username = ? LIMIT 1", adminUser).Scan(&hash)
	if errors.Is(err, sql.ErrNoRows) {
		return false, nil
	}
	if err != nil {
		return false, err
	}
	if bcrypt.CompareHashAndPassword([]byte(hash), []byte(password)) == nil {
		return false, nil
	}
	newHash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return false, err
	}
	if _, err := db.Exec(
		"UPDATE users SET password_hash = ?, session_epoch = COALESCE(session_epoch, 0) + 1 WHERE username = ?",
		string(newHash), adminUser,
	); err != nil {
		return false, err
	}
	return true, nil
}
