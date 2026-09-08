const fs = require('fs')
const path = require('path')
const esbuild = require('esbuild')

const cloudRoot = path.resolve(__dirname, '..')
const sourceRoot = path.join(cloudRoot, 'functions')
const outputRoot = path.join(cloudRoot, 'dist', 'functions')

fs.rmSync(outputRoot, { recursive: true, force: true })
fs.mkdirSync(outputRoot, { recursive: true })

for (const name of fs.readdirSync(sourceRoot)) {
  const sourceDir = path.join(sourceRoot, name)
  const entryPoint = path.join(sourceDir, 'index.ts')
  if (!fs.statSync(sourceDir).isDirectory() || !fs.existsSync(entryPoint)) continue

  const outputDir = path.join(outputRoot, name)
  fs.mkdirSync(outputDir, { recursive: true })

  esbuild.buildSync({
    entryPoints: [entryPoint],
    outfile: path.join(outputDir, 'index.js'),
    bundle: true,
    platform: 'node',
    target: 'node18',
    format: 'cjs',
    external: ['wx-server-sdk'],
  })

  const packageJson = JSON.parse(fs.readFileSync(path.join(sourceDir, 'package.json'), 'utf8'))
  fs.writeFileSync(
    path.join(outputDir, 'package.json'),
    `${JSON.stringify({ ...packageJson, main: 'index.js' }, null, 2)}\n`,
  )
}
