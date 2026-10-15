// Run only against the isolated synthetic fixture described in docs/HANDHELD_PVT.md.
import assert from 'node:assert/strict'
import { PrismaClient } from '@prisma/client'
import { SignJWT } from 'jose'
import ts from 'typescript'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { createRequire } from 'node:module'
const base = process.env.PVT_TEST_BASE_URL
const database = process.env.PVT_TEST_DATABASE_URL
if (!base || !database || new URL(base).hostname !== '127.0.0.1' || new URL(database).hostname !== '127.0.0.1') throw new Error('Explicit loopback test URLs required; never run against production.')
const db = new PrismaClient({ datasourceUrl: database })
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pvt-integration-'))
for (const file of ['protocol','engine']) fs.writeFileSync(path.join(dir,file+'.cjs'),ts.transpileModule(fs.readFileSync(new URL('../src/lib/pvt/'+file+'.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText.replace("require(\"./protocol\")","require(\"./protocol.cjs\")"))
const {PvtEngine}=createRequire(import.meta.url)(path.join(dir,'engine.cjs'))
let checks=0
function check(value,message){assert.ok(value,message);checks++}
const adminToken=await new SignJWT({email:'test@example.invalid',role:'TEAM_ADMIN',teamId:'test-team'}).setProtectedHeader({alg:'HS256'}).setSubject('test-admin').setIssuedAt().setExpirationTime('1h').sign(new TextEncoder().encode('pvt-local-test-only'))
const cookie='wm_admin_session='+adminToken
async function request(url,body,auth=false,headers={}){const response=await fetch(base+url,{method:body?'POST':'GET',headers:{...(body?{'Content-Type':'application/json'}:{}),...(auth?{Cookie:cookie}:{}),...headers},...(body?{body:JSON.stringify(body)}:{})});return {status:response.status,data:await response.json().catch(()=>({error:'Non-JSON response at '+url}))}}
const start={action:'start',playerId:'test-player',password:'TP',practice:false,context:{posture:'seated',caffeine:false,minutesAwake:30,deviceId:'12345678-1234-4234-8234-123456789012'}}
try {
  check((await db.team.findUnique({where:{id:'test-team'}}))?.name==='PVT Test Team','synthetic fixture required')
  check((await request('/api/pvt/admin')).status===401,'admin auth required')
  const admin=await request('/api/pvt/admin',null,true)
  check(admin.status===200 && admin.data.ready,'admin reads migrated PVT')
  check(admin.data.surveys.length===1 && admin.data.surveys[0].id==='test-survey','team scoping')
  check(!JSON.stringify(admin.data).includes('tokenHash'),'tokens never appear in coach response')
  check((await request('/api/pvt/admin',{surveyId:'other-survey',enabled:true,durationSeconds:60},true)).status===404,'cross-team settings rejected')
  check((await request('/api/pvt/admin',{surveyId:'test-survey',enabled:true,durationSeconds:90},true)).status===200,'coach can select 90s')
  check((await request('/api/pvt/admin',{surveyId:'test-survey',enabled:true,durationSeconds:60},true)).status===200,'coach can select 60s')
  check((await request('/api/pvt/admin',{surveyId:'test-survey',enabled:true,durationSeconds:30},true)).status===400,'unsupported duration rejected')
  const p='/api/kiosk/test-survey/pvt'
  check((await request(p)).data.duration===60,'player receives coach duration')
  check((await request(p,{...start,password:'WRONG'})).status===401,'wrong access code rejected')
  check((await request(p,{...start,playerId:'other-player',password:'OP'})).status===401,'cross-team player rejected')
  check((await request(p,start,false,{Origin:'https://untrusted.invalid'})).status===403,'cross-origin mutation rejected')
  const session=await request(p,start)
  check(session.status===200 && session.data.token.length===64,'server authorises an attempt')
  check((await request('/api/pvt/admin',{surveyId:'test-survey',enabled:true,durationSeconds:180},true)).status===409,'daily protocol locked after first official start')
  const e=new PvtEngine(60000,()=>.5)
  for(let n=0;n<=60000;n+=10){e.tick(n);if(e.onset!==null&&n-e.onset>=250)e.press(n)}
  const finish={action:'finish',id:session.data.id,token:session.data.token,result:e.result()}
  check((await request(p,{...finish,token:'f'.repeat(64)})).status===401,'invalid result token rejected')
  check((await request(p,finish)).status===400,'wall clock prevents implausibly early completion')
  // Age only this synthetic fixture's start to test persistence without waiting a minute.
  await db.pvtSession.update({where:{id:session.data.id},data:{startedAt:new Date(Date.now()-61000)}})
  const saved=await request(p,finish)
  check(saved.status===200 && saved.data.summary.medianRT===250,'server recomputes and saves result')
  const duplicate=await request(p,{...finish,result:{...finish.result,interruption:'cancelled'}})
  check(duplicate.status===200 && duplicate.data.summary.quality==='OK','retry cannot overwrite first result')
  check(await db.pvtSession.count({where:{id:session.data.id}})===1,'idempotency retains one record')
  const practice=await request(p,{...start,practice:true})
  check(practice.status===200,'practice separately authorises')
  const interrupted=await request(p,{action:'finish',id:practice.data.id,token:practice.data.token,result:{trials:[],elapsedMs:0,maxFrameGapMs:0,interruption:'cancelled'}})
  check(interrupted.status===200,'interruption saved without losing official attempt')
  const practiceRow=await db.pvtSession.findUnique({where:{id:practice.data.id}})
  check(practiceRow.practice && practiceRow.status==='INTERRUPTED','practice and interruption persisted')
  for(let i=0;i<12;i++) await request(p,{...start,password:'WRONG'})
  check((await request(p,start)).status===429,'database-backed failed-start rate limit')
  await db.pvtAuthWindow.deleteMany({}) // only isolated fixture
  await db.question.create({data:{id:'test-question',surveyId:'test-survey',text:'Sleep quality',type:'SCALE'}})
  const wellness=await request('/api/responses',{surveyId:'test-survey',playerId:'test-player',answers:[{questionId:'test-question',value:'8'}]})
  check(wellness.status===200,'legacy wellness submission still works')
  check(await db.pvtSession.count({where:{playerId:'test-player'}})===2,'wellness save does not replace PVT history')
  const list=await request('/api/pvt/admin',null,true)
  check(list.data.sessions.length===2 && list.data.sessions.every(s=>s.playerId==='test-player'),'coach sees team attempts and repeats')
  await db.survey.create({data:{id:'race-survey',teamId:'test-team',title:'Race fixture',createdBy:'test-admin'}})
  await db.pvtConfig.create({data:{surveyId:'race-survey',teamId:'test-team',enabled:true,durationSeconds:60}})
  const [racedStart,racedSetting]=await Promise.all([
    request('/api/kiosk/race-survey/pvt',start,false,{Origin:base}),
    request('/api/pvt/admin',{surveyId:'race-survey',enabled:true,durationSeconds:90},true,{Origin:base}),
  ])
  check(racedStart.status===200,'same-origin browser start succeeds')
  check((racedSetting.status===200 && racedStart.data.duration===90) || (racedSetting.status===409 && racedStart.data.duration===60),'concurrent start/configuration cannot split the daily protocol')
  fs.writeFileSync('/tmp/pvt-test-admin-cookie',cookie,{mode:0o600})
  console.log(`PASS: ${checks} integration assertions against isolated loopback fixture`)
} finally {await db.$disconnect();fs.rmSync(dir,{recursive:true,force:true})}
