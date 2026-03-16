const { spawn } = require('child_process')
const net = require('net')
const path = require('path')

const rootDir = path.resolve(__dirname, '..')
const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm'
const apiPort = Number(process.env.PORT || 3000)
const children = []

function isPortInUse(port, host = '127.0.0.1') {
  return new Promise((resolve) => {
    const socket = net.createConnection({ port, host })

    socket.once('connect', () => {
      socket.end()
      resolve(true)
    })

    socket.once('error', () => {
      resolve(false)
    })
  })
}

function startProcess(name, command, args, cwd) {
  const child = spawn(command, args, {
    cwd,
    stdio: ['ignore', 'inherit', 'inherit'],
    env: process.env
  })

  child.on('exit', (code, signal) => {
    if (signal) {
      console.log(`[${name}] exited with signal ${signal}`)
      return
    }
    if (code !== 0) {
      console.error(`[${name}] exited with code ${code}`)
      shutdown(code || 1)
    }
  })

  children.push(child)
  return child
}

function shutdown(exitCode = 0) {
  while (children.length) {
    const child = children.pop()
    if (child && !child.killed) child.kill('SIGTERM')
  }
  process.exit(exitCode)
}

process.on('SIGINT', () => shutdown(0))
process.on('SIGTERM', () => shutdown(0))

async function main() {
  const apiRunning = await isPortInUse(apiPort)

  if (apiRunning) {
    console.log(`[api] port ${apiPort} already in use, reusing existing server`)
  } else {
    startProcess('api', process.execPath, ['server.js'], rootDir)
  }

  startProcess('web', npmCommand, ['--prefix', 'frontend', 'run', 'dev'], rootDir)
}

main().catch((error) => {
  console.error('[dev:all] failed to start:', error)
  shutdown(1)
})
