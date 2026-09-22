import {spawnSync} from 'node:child_process'
import {mkdirSync, readFileSync, writeFileSync, appendFileSync} from 'node:fs'

// Audit real production rendering with public data. Never fake an authenticated
// session or treat a redirect to login as an audit of the protected dashboard.
const routes = [
  ['home', '/'],
  ['catalogue', '/shop'],
  ['product', '/product/empower-electric-em60-c32a-dc-32a-2-pole-dc-miniature-circuit-breaker-500v'],
  ['cart', '/cart'],
  ['admin-login', '/admin/login'],
]
mkdirSync('lighthouse-reports', {recursive: true})
const rows = []
let failed = false
for (const [name, path] of routes) {
  for (const device of ['mobile', 'desktop']) {
    const output = `lighthouse-reports/${name}-${device}`
    const result = spawnSync('npx', ['--yes', 'lighthouse@13.5.0', `http://localhost:3000${path}`,
      '--chrome-flags=--headless --no-sandbox --disable-dev-shm-usage',
      '--only-categories=performance,accessibility,best-practices,seo',
      '--output=json', '--output=html', `--output-path=${output}`,
      ...(device === 'desktop' ? ['--preset=desktop'] : []),
    ], {stdio: 'inherit', timeout: 120000})
    try {
      const report = JSON.parse(readFileSync(`${output}.report.json`, 'utf8'))
      if (result.status !== 0 || report.runtimeError || new URL(report.finalDisplayedUrl).pathname !== path) {
        throw Error(report.runtimeError?.message || 'Audit failed or navigated to a different route')
      }
      const scores = ['performance', 'accessibility', 'best-practices', 'seo'].map(key => {
        const score = report.categories[key].score
        if (score === null) throw Error(`Missing ${key} score`)
        return Math.round(score * 100)
      })
      rows.push(`| ${name} | ${device} | ${scores.join(' | ')} |`)
    } catch (error) {
      failed = true
      rows.push(`| ${name} | ${device} | ERROR | — | — | — |`)
      console.error(error)
    }
  }
}
const summary = '# Production-build Lighthouse results\n\nThese are CI lab measurements, not Hostinger measurements. Admin login is not an authenticated dashboard audit. Private routes intentionally remain noindex.\n\n| Route | Device | Performance | Accessibility | Best practices | SEO |\n|---|---|---:|---:|---:|---:|\n' + rows.join('\n') + '\n'
writeFileSync('lighthouse-reports/summary.md', summary)
if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, summary)
if (failed) process.exitCode = 1
