/** Ephemeral synthetic PostgreSQL-compatible fixture. Never opens a production URL. */
import { createRequire } from 'node:module'
import { execFileSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
const runtime = process.env.PVT_TEST_RUNTIME
if (!runtime) throw new Error('Set PVT_TEST_RUNTIME to a separate directory containing @electric-sql/pglite and @electric-sql/pglite-socket.')
const require = createRequire(path.join(path.resolve(runtime), 'package.json'))
const { PGlite } = require('@electric-sql/pglite')
const { PGLiteSocketServer } = require('@electric-sql/pglite-socket')
const root = fileURLToPath(new URL('../', import.meta.url))
const schema = execFileSync(process.execPath, [path.join(root, 'node_modules/prisma/build/index.js'), 'migrate', 'diff', '--from-empty', '--to-schema-datamodel', path.join(root, 'prisma/schema.prisma'), '--script'], { cwd: root, encoding: 'utf8', env: { ...process.env, DATABASE_URL: 'postgresql://unused:unused@127.0.0.1:1/unused' } })
const db = await PGlite.create()
await db.exec(schema)
await db.exec(`INSERT INTO teams (id,name,"createdAt","updatedAt") VALUES ('test-team','PVT Test Team',now(),now()), ('other-team','Other Test Team',now(),now());
INSERT INTO players (id,"teamId","firstName","lastName",password,"createdAt","updatedAt") VALUES ('test-player','test-team','Test','Player','TP',now(),now()), ('other-player','other-team','Other','Player','OP',now(),now());
INSERT INTO surveys (id,"teamId",title,"createdBy","createdAt","updatedAt") VALUES ('test-survey','test-team','Test Wellness','test-admin',now(),now()),('other-survey','other-team','Other Wellness','other-admin',now(),now());
INSERT INTO questions (id,"surveyId",text,type,options,required,"order","createdAt") VALUES ('focus-question','test-survey','Focus test','PVT','{"durationSeconds":30,"protocolVersion":"handheld-pvt-v3"}',true,0,now()),('sleep-question','test-survey','Sleep quality','SLIDER','[]',false,1,now()),('pain-question','test-survey','Painful areas?','BODY_MAP',NULL,false,2,now());
INSERT INTO pvt_configs (id,"teamId","surveyId",enabled,"durationSeconds","updatedAt") VALUES ('test-config','test-team','test-survey',true,60,now());`)
const server = new PGLiteSocketServer({ db, port: 55439, host: '127.0.0.1', maxConnections: 10 })
await server.start()
console.log('Ephemeral synthetic fixture ready on 127.0.0.1:55439. Use pgbouncer=true in test connections.')
async function stop() { await server.stop(); await db.close(); process.exit(0) }
process.on('SIGTERM', stop)
process.on('SIGINT', stop)
