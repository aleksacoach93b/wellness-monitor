// Full camera lifecycle matrix. All video is owned canvas output; no OS camera.
const { spawn } = require('node:child_process')
const path = require('node:path')
const scenarios = [
  'android-samsung-metadata',
  'android-samsung-after-hold',
  'android-samsung-flat',
  'stable',
  'slow',
  'ignored',
  'mismatch',
  'switch',
  'flat',
  'exposure',
  'exposure-ignored',
  'exposure-unsupported',
  'exposure-no-effect',
  'android',
  'android-ignored',
  'android-rollback',
  'android-unsupported',
  'android-cancel',
  'iphone-controls',
  'android-dim-auto',
  'android-gain',
  'android-gain-ignored',
  'android-gain-no-effect',
  'android-gain-limit',
  'android-gain-cancel',
  'enumeration-race',
  'repeat-failure',
  'repeat-success',
  'android-repeat',
  'android-gain-repeat',
  'interrupt-retry',
  'frames-retry',
  'background-retry',
  'permission-retry',
  'camera-ended',
  'wake-race',
  'callback-race',
  'network-idle',
  'network-stale-start',
  'network-start-retry',
  'network-save-retry',
]
const selected = process.env.RHR_SCENARIOS?.split(',') || scenarios
for (const scenario of selected)
  if (!scenarios.includes(scenario))
    throw Error('Unknown scenario: ' + scenario)
let index = 0
const failures = []
async function worker() {
  while (index < selected.length) {
    const scenario = selected[index++]
    const code = await new Promise((resolve) => {
      const child = spawn(
        process.execPath,
        [path.join(__dirname, 'rhr.camera-browser.cjs')],
        {
          env: { ...process.env, RHR_SCENARIO: scenario },
          stdio: ['ignore', 'pipe', 'pipe'],
        },
      )
      let output = ''
      child.stdout.on('data', (data) => {
        output += data
      })
      child.stderr.on('data', (data) => {
        output += data
      })
      child.on('error', (error) => {
        output += error.message
      })
      child.on('close', (code) => {
        console.log(JSON.stringify({ scenario, pass: code === 0 }))
        if (code !== 0) console.error(output)
        resolve(code)
      })
    })
    if (code !== 0) failures.push(scenario)
  }
}
Promise.all(Array.from({ length: 3 }, worker)).then(() => {
  console.log(JSON.stringify({ scenarios: selected.length, failed: failures }))
  if (failures.length) process.exitCode = 1
})
