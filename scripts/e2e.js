const { spawn } = require('child_process')
const path = require('path')
const assert = require('assert')
const { chromium } = require('playwright-core')

const rootDir = path.resolve(__dirname, '..')
const port = Number(process.env.E2E_PORT || 3100)
const baseUrl = `http://127.0.0.1:${port}`
const cachePrefix = 'cm_cache_'
const cacheTtl = Date.now() + 60 * 60 * 1000

const svgImage = (label, color) => `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="800" height="400" viewBox="0 0 800 400">
  <rect width="800" height="400" fill="${color}" />
  <text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" font-size="42" fill="#ffffff">${label}</text>
</svg>`

const fakeProfile = {
  userId: 1,
  nickname: 'E2E Tester',
  avatarUrl: 'https://mock.local/avatar.jpg'
}

const playlists = Array.from({ length: 4 }, (_, index) => ({
  id: 1000 + index,
  userId: 1,
  name: `测试歌单 ${index + 1}`,
  trackCount: 60,
  coverImgUrl: `https://mock.local/playlist-${index + 1}.jpg`,
  description: `描述 ${index + 1}`,
  playCount: 100000 + index * 1000
}))

const songs = Array.from({ length: 60 }, (_, index) => ({
  id: 2000 + index,
  name: `测试歌曲 ${index + 1}`,
  dt: 180000 + index * 1000,
  ar: [{ name: '测试歌手' }],
  al: {
    name: '测试专辑',
    picUrl: `https://mock.local/song-${(index % 10) + 1}.jpg`
  }
}))

const discoverCache = {
  banners: Array.from({ length: 3 }, (_, index) => ({
    imageUrl: `https://mock.local/banner-${index + 1}.jpg`
  })),
  recPlaylists: playlists,
  newSongs: songs.slice(0, 12).map((song) => ({
    id: song.id,
    name: song.name,
    picUrl: song.al.picUrl,
    song: {
      ...song,
      album: song.al,
      artists: song.ar
    }
  })),
  toplists: playlists.map((playlist, index) => ({
    ...playlist,
    updateFrequency: `每周更新 ${index + 1}`
  })),
  hotSearches: [
    { searchWord: '测试热搜 1' },
    { searchWord: '测试热搜 2' },
    { searchWord: '测试热搜 3' }
  ],
  dailySongs: songs.slice(0, 18)
}

function startServer() {
  return new Promise((resolve, reject) => {
    const server = spawn(process.execPath, ['server.js'], {
      cwd: rootDir,
      env: { ...process.env, PORT: String(port) },
      stdio: ['ignore', 'pipe', 'pipe']
    })

    const onData = (chunk) => {
      const text = chunk.toString()
      process.stdout.write(text)
      if (text.includes(`server running on http://localhost:${port}`)) {
        cleanup()
        resolve(server)
      }
    }

    const onError = (chunk) => {
      process.stderr.write(chunk.toString())
    }

    const onExit = (code) => {
      cleanup()
      reject(new Error(`E2E server exited early with code ${code}`))
    }

    const cleanup = () => {
      server.stdout.off('data', onData)
      server.stderr.off('data', onError)
      server.off('exit', onExit)
    }

    server.stdout.on('data', onData)
    server.stderr.on('data', onError)
    server.on('exit', onExit)
  })
}

async function mockApi(page) {
  await page.route('https://mock.local/**', async (route) => {
    const url = new URL(route.request().url())
    const name = url.pathname.replace('/', '').split('.')[0] || 'mock'
    const family = name.split('-')[0]
    const colorMap = {
      avatar: '#3b82f6',
      banner: '#ef4444',
      playlist: '#10b981',
      song: '#8b5cf6'
    }

    await route.fulfill({
      status: 200,
      contentType: 'image/svg+xml',
      body: svgImage(name, colorMap[family] || '#6b7280')
    })
  })

  await page.route(`${baseUrl}/api/**`, async (route) => {
    const url = new URL(route.request().url())
    const apiPath = url.pathname.replace('/api/', '')
    const id = Number(url.searchParams.get('id'))

    if (apiPath === 'login/status') {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: { profile: fakeProfile } }) })
    }
    if (apiPath === 'user/playlist') {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ playlist: playlists }) })
    }
    if (apiPath === 'likelist') {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ids: [] }) })
    }
    if (apiPath === 'playlist/detail') {
      const playlist = playlists.find((item) => item.id === id) || playlists[0]
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ playlist }) })
    }
    if (apiPath === 'playlist/track/all') {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ songs }) })
    }
    if (apiPath === 'recommend/songs') {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: { dailySongs: discoverCache.dailySongs } }) })
    }
    if (apiPath === 'banner') {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ banners: discoverCache.banners }) })
    }
    if (apiPath === 'personalized') {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ result: discoverCache.recPlaylists }) })
    }
    if (apiPath === 'personalized/newsong') {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ result: discoverCache.newSongs }) })
    }
    if (apiPath === 'toplist') {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ list: discoverCache.toplists }) })
    }
    if (apiPath === 'search/hot/detail') {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: discoverCache.hotSearches }) })
    }

    return route.continue()
  })
}

async function testDiscover(page) {
  await page.goto(`${baseUrl}/#/`, { waitUntil: 'networkidle' })
  await page.waitForSelector('.banner-slide.active')
  await page.waitForSelector('.daily-scroll .song-card')

  const imageState = await page.evaluate(() => ({
    banner: Array.from(document.querySelectorAll('.banner-slide img')).every((img) => img.complete),
    daily: Array.from(document.querySelectorAll('.daily-scroll .song-card img')).slice(0, 6).every((img) => img.complete)
  }))
  assert(imageState.banner, 'banner images should be preloaded')
  assert(imageState.daily, 'daily images should be preloaded')

  const startState = await page.evaluate(() => ({
    bannerIndex: Array.from(document.querySelectorAll('.banner-slide')).findIndex((node) => node.classList.contains('active')),
    dailyScrollLeft: document.querySelector('.daily-scroll').scrollLeft
  }))

  await page.waitForTimeout(5400)

  const advancedState = await page.evaluate(() => ({
    bannerIndex: Array.from(document.querySelectorAll('.banner-slide')).findIndex((node) => node.classList.contains('active')),
    dailyScrollLeft: document.querySelector('.daily-scroll').scrollLeft
  }))

  assert.notStrictEqual(advancedState.bannerIndex, startState.bannerIndex, 'banner should auto advance on the shared interval')
  assert(advancedState.dailyScrollLeft > startState.dailyScrollLeft, 'daily list should auto scroll with banner cadence')

  const smoothDaily = await page.evaluate(async () => {
    const scroller = document.querySelector('.daily-scroll')
    const arrow = document.querySelector('.scroll-arrow-right')
    const start = scroller.scrollLeft
    const behavior = getComputedStyle(scroller).scrollBehavior
    arrow.click()
    await new Promise((resolve) => setTimeout(resolve, 740))
    const end = scroller.scrollLeft
    return { start, end, behavior }
  })

  assert.strictEqual(smoothDaily.behavior, 'smooth', 'daily scroller should expose smooth scroll behavior')
  assert(smoothDaily.end > smoothDaily.start, 'daily smooth scroll should move after manual interaction')
}

async function testPlaylists(page) {
  await page.goto(`${baseUrl}/#/playlists`, { waitUntil: 'networkidle' })
  await page.waitForSelector('.pl-card')

  await page.locator('.pl-card').first().click()
  await page.waitForSelector('.playlist-detail.open')
  await page.waitForSelector('.detail-panel-toggle')

  const detailScroll = await page.evaluate(async () => {
    const panel = document.querySelector('.playlist-detail')
    const start = panel.scrollTop
    const behavior = getComputedStyle(panel).scrollBehavior
    panel.scrollTo({ top: 600, behavior: 'smooth' })
    await new Promise((resolve) => setTimeout(resolve, 740))
    const end = panel.scrollTop
    return { start, end, behavior }
  })

  assert.strictEqual(detailScroll.behavior, 'smooth', 'playlist detail should expose smooth scroll behavior')
  assert(detailScroll.end > detailScroll.start, 'playlist detail should move after smooth scroll request')
}

async function main() {
  console.log('Starting E2E server...')
  const server = await startServer()
  console.log('Server ready, launching browser...')
  const browser = await chromium.launch({
    executablePath: '/usr/bin/google-chrome',
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-dev-shm-usage',
      '--disable-background-timer-throttling',
      '--disable-renderer-backgrounding',
      '--disable-backgrounding-occluded-windows'
    ]
  })

  try {
    console.log('Browser ready, creating context...')
    const context = await browser.newContext({ viewport: { width: 1440, height: 1200 } })
    await context.addInitScript(({ entries }) => {
      for (const [key, value] of entries) {
        window.sessionStorage.setItem(key, value)
      }
    }, {
      entries: Object.entries(discoverCache).map(([key, data]) => [
        `${cachePrefix}${key}`,
        JSON.stringify({ data, expiry: cacheTtl })
      ])
    })

    const page = await context.newPage()
    await mockApi(page)
    console.log('Running discover assertions...')
    await testDiscover(page)
    console.log('Running playlists assertions...')
    await testPlaylists(page)
    console.log('E2E passed')
  } finally {
    await browser.close()
    server.kill('SIGTERM')
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
