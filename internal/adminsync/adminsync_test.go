package adminsync

import (
	"database/sql"
	"path/filepath"
	"testing"

	_ "github.com/glebarez/go-sqlite"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"golang.org/x/crypto/bcrypt"
)

// newDB 建带 users 表的真实 sqlite 库(core 同款列名:password_hash/session_epoch),
// 预置 admin(可选口令)与一个普通用户,返回库路径。
func newDB(t *testing.T, adminPassword string) string {
	t.Helper()
	path := filepath.Join(t.TempDir(), "fileCodeBox.db")
	db, err := sql.Open("sqlite", path)
	require.NoError(t, err)
	defer db.Close()
	_, err = db.Exec(`CREATE TABLE users (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		username TEXT NOT NULL,
		password_hash TEXT NOT NULL DEFAULT '',
		session_epoch INTEGER DEFAULT 0,
		nickname TEXT DEFAULT ''
	)`)
	require.NoError(t, err)
	if adminPassword != "" {
		hash, err := bcrypt.GenerateFromPassword([]byte(adminPassword), bcrypt.MinCost)
		require.NoError(t, err)
		_, err = db.Exec(`INSERT INTO users (username, password_hash, nickname) VALUES (?, ?, ?)`,
			"admin", string(hash), "管小理")
		require.NoError(t, err)
	}
	_, err = db.Exec(`INSERT INTO users (username, password_hash, nickname) VALUES ('user1', 'x', '甲')`)
	require.NoError(t, err)
	return path
}

func readAdmin(t *testing.T, path string) (hash string, epoch int, nickname string) {
	t.Helper()
	db, err := sql.Open("sqlite", path)
	require.NoError(t, err)
	defer db.Close()
	require.NoError(t, db.QueryRow(
		`SELECT password_hash, session_epoch, nickname FROM users WHERE username = 'admin'`,
	).Scan(&hash, &epoch, &nickname))
	return
}

func TestSyncNoopCases(t *testing.T) {
	path := newDB(t, "old-pass-1")

	// 口令为空:不动
	changed, err := Sync(path, "")
	require.NoError(t, err)
	assert.False(t, changed)

	// dbPath 为空:不动
	changed, err = Sync("", "whatever")
	require.NoError(t, err)
	assert.False(t, changed)

	// 库不存在:core 首启播种,不动
	changed, err = Sync(filepath.Join(t.TempDir(), "none.db"), "whatever")
	require.NoError(t, err)
	assert.False(t, changed)
}

func TestSyncNoAdminRow(t *testing.T) {
	path := newDB(t, "") // 无 admin 行
	changed, err := Sync(path, "seed-pass-1")
	require.NoError(t, err)
	assert.False(t, changed, "admin 行不存在应交 core 播种,Sync 不动作")
}

func TestSyncIdempotentWhenMatch(t *testing.T) {
	path := newDB(t, "same-pass-1")
	before, epochBefore, nickBefore := readAdmin(t, path)

	changed, err := Sync(path, "same-pass-1")
	require.NoError(t, err)
	assert.False(t, changed)

	after, epochAfter, nickAfter := readAdmin(t, path)
	assert.Equal(t, before, after, "口令一致时哈希零扰动")
	assert.Equal(t, epochBefore, epochAfter, "口令一致不吊销会话")
	assert.Equal(t, nickBefore, nickAfter)
}

func TestSyncUpdatesPasswordAndBumpsEpoch(t *testing.T) {
	path := newDB(t, "old-pass-1")
	_, epochBefore, nickBefore := readAdmin(t, path)

	changed, err := Sync(path, "new-pass-2")
	require.NoError(t, err)
	assert.True(t, changed)

	hash, epochAfter, nickAfter := readAdmin(t, path)
	assert.NoError(t, bcrypt.CompareHashAndPassword([]byte(hash), []byte("new-pass-2")), "新口令应可校验")
	assert.Error(t, bcrypt.CompareHashAndPassword([]byte(hash), []byte("old-pass-1")), "旧口令应失效")
	assert.Equal(t, epochBefore+1, epochAfter, "改密须递增 session_epoch(吊销已签发 JWT)")
	assert.Equal(t, nickBefore, nickAfter, "资料零扰动")

	// 幂等:再同步一次不动
	changed, err = Sync(path, "new-pass-2")
	require.NoError(t, err)
	assert.False(t, changed)
}

func TestSyncLeavesOtherUsersAlone(t *testing.T) {
	path := newDB(t, "old-pass-1")
	_, err := Sync(path, "new-pass-2")
	require.NoError(t, err)

	db, err := sql.Open("sqlite", path)
	require.NoError(t, err)
	defer db.Close()
	var hash, nick string
	require.NoError(t, db.QueryRow(
		`SELECT password_hash, nickname FROM users WHERE username = 'user1'`,
	).Scan(&hash, &nick))
	assert.Equal(t, "x", hash)
	assert.Equal(t, "甲", nick)
}
