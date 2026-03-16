#!/usr/bin/env node
/**
 * 重置壁纸图库和种子标志位
 * 用法: node scripts/reset-wallpapers.js
 */

const Database = require('better-sqlite3')
const path = require('path')

const DB_PATH = path.join(__dirname, '..', 'data', 'cloudmusic.db')
const db = new Database(DB_PATH)

// 1. 清除种子标志位
const delFlags = db.prepare("DELETE FROM user_settings WHERE key IN ('seeded_canvas', 'seeded_pure')").run()
console.log(`✓ 已删除种子标志位 (${delFlags.changes} 条)`)

// 2. 清空壁纸图库
const delWalls = db.prepare('DELETE FROM wallpaper_gallery').run()
console.log(`✓ 已清空壁纸图库 (${delWalls.changes} 条)`)

// 3. 验证
const flags = db.prepare("SELECT * FROM user_settings WHERE key LIKE 'seeded%'").all()
const wallCount = db.prepare('SELECT COUNT(*) as cnt FROM wallpaper_gallery').get().cnt
console.log(`\n验证:`)
console.log(`  种子标志位: ${flags.length === 0 ? '无 ✓' : '异常 ✗ ' + JSON.stringify(flags)}`)
console.log(`  壁纸数量: ${wallCount === 0 ? '0 ✓' : wallCount + ' ✗'}`)

db.close()
console.log('\n🎉 重置完成！刷新前端即可测试首次导入。')
