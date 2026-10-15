// Apply the actual additive SQL to the pre-feature production schema in memory.
import { createRequire } from 'node:module'
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import assert from 'node:assert/strict'
const require = createRequire(path.join(process.env.PVT_TEST_RUNTIME || '/tmp/wellness-pvt-test-runtime', 'package.json'))
const { PGlite } = require('@electric-sql/pglite')
const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'pvt-migration-'))
const baseline = execFileSync('git', ['show', '11a0c7b60c255fe330cf67bea337eac93803de78:prisma/schema.prisma'], { encoding: 'utf8' })
fs.writeFileSync(path.join(directory,'before.prisma'),baseline)
const sql = execFileSync(process.execPath, ['node_modules/prisma/build/index.js','migrate','diff','--from-empty','--to-schema-datamodel',path.join(directory,'before.prisma'),'--script'],{encoding:'utf8',env:{...process.env,DATABASE_URL:'postgresql://unused:unused@127.0.0.1:1/unused'}})
const db = await PGlite.create()
try {
  await db.exec(sql)
  await db.exec(`INSERT INTO teams (id,name,"createdAt","updatedAt") VALUES ('team','Before migration',now(),now()); INSERT INTO surveys (id,"teamId",title,"createdBy","createdAt","updatedAt") VALUES ('survey','team','Existing wellness','admin',now(),now()); INSERT INTO questions (id,"surveyId",text,type,required,"order","createdAt") VALUES ('old','survey','Fatigue','SCALE',true,0,now()); INSERT INTO responses (id,"surveyId","playerName","submittedAt") VALUES ('old-response','survey','Existing player',now()); INSERT INTO answers (id,"responseId","questionId",value) VALUES ('old-answer','old-response','old','5');`)
  await db.exec(fs.readFileSync('prisma/manual-migrations/2026-10-handheld-pvt.sql','utf8'))
  assert.equal((await db.query('SELECT value FROM answers WHERE id=\'old-answer\'')).rows[0].value,'5')
  await db.exec(`INSERT INTO questions (id,"surveyId",text,type,required,"order","createdAt") VALUES ('focus','survey','Focus test','PVT',false,1,now());`)
  assert.equal((await db.query("SELECT count(*)::int AS n FROM questions")).rows[0].n,2)
  assert.equal((await db.query("SELECT count(*)::int AS n FROM information_schema.tables WHERE table_schema='public' AND table_name LIKE 'pvt_%'")).rows[0].n,3)
  console.log('PASS: real additive migration preserves existing answers and supports native PVT questions')
} finally { await db.close(); fs.rmSync(directory,{recursive:true,force:true}) }
