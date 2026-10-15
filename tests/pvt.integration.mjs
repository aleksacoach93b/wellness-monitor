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
const {PVT_VERSION}=createRequire(import.meta.url)(path.join(dir,'protocol.cjs'))
const {PvtEngine}=createRequire(import.meta.url)(path.join(dir,'engine.cjs'))
let checks=0
function check(value,message){assert.ok(value,message);checks++}
const adminToken=await new SignJWT({email:'test@example.invalid',role:'TEAM_ADMIN',teamId:'test-team'}).setProtectedHeader({alg:'HS256'}).setSubject('test-admin').setIssuedAt().setExpirationTime('1h').sign(new TextEncoder().encode('pvt-local-test-only'))
const cookie='wm_admin_session='+adminToken
async function request(url,body,auth=false,headers={}){const response=await fetch(base+url,{method:body?'POST':'GET',headers:{...(body?{'Content-Type':'application/json'}:{}),...(auth?{Cookie:cookie}:{}),...headers},...(body?{body:JSON.stringify(body)}:{})});return {status:response.status,data:await response.json().catch(()=>({error:'Non-JSON response at '+url}))}}
const start={questionId:'focus-question',action:'start',protocolVersion:PVT_VERSION,playerId:'test-player',password:'TP',practice:false,context:{posture:'seated',caffeine:false,minutesAwake:30,deviceId:'12345678-1234-4234-8234-123456789012'}}
try {
  check((await db.team.findUnique({where:{id:'test-team'}}))?.name==='PVT Test Team','synthetic fixture required')
  await db.pvtSession.deleteMany({where:{teamId:'test-team'}})
  await db.response.deleteMany({where:{surveyId:'test-survey'}})
  await db.pvtAuthWindow.deleteMany({})
  await db.survey.deleteMany({where:{id:{in:['legacy-survey','race-survey','sixty-survey']},teamId:'test-team'}})

  check((await request('/api/pvt/admin')).status===401,'admin auth required')
  const admin=await request('/api/pvt/admin',null,true)
  check(admin.status===200 && admin.data.ready,'admin reads migrated PVT')
  check(admin.data.surveys.length===1 && admin.data.surveys[0].questions[0].id==='focus-question','team-scoped native questions')
  const p='/api/kiosk/test-survey/pvt'
  check((await request(p)).data.questions[0].duration===30,'native question config sets duration')
  check((await request(p,{...start,password:'WRONG'})).status===401,'wrong access code rejected')
  check((await request(p,{...start,playerId:'other-player',password:'OP'})).status===401,'cross-team player rejected')
  check((await request(p,{...start,questionId:'sleep-question'})).status===404,'cannot run against ordinary question')
  check((await request(p,{...start,protocolVersion:'handheld-pvt-v2'})).status===400,'old visual protocol rejected for new starts')
  check((await request(p,start,false,{Origin:'https://untrusted.invalid'})).status===403,'cross-origin mutation rejected')
  const authResponse=await fetch(base+p,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'authorize',playerId:'test-player',password:'TP'})})
  const playerCookie=authResponse.headers.get('set-cookie')?.split(';')[0]
  check(authResponse.ok && playerCookie?.startsWith('wm_pvt_player='),'kiosk login issues server-verified player grant')
  const session=await request(p,{...start,password:undefined},false,{Cookie:playerCookie})
  check(session.status===200 && session.data.duration===30 && session.data.token.length===64,'grant starts assigned test without second password')
  const e=new PvtEngine(30000,()=>.5)
  for(let n=0;n<=30000;n+=10){e.tick(n);if(e.onset!==null&&n-e.onset>=250)e.press(n)}
  const finish={action:'finish',id:session.data.id,token:session.data.token,result:e.result()}
  check((await request(p,{...finish,token:'f'.repeat(64)})).status===401,'invalid result token rejected')
  check((await request(p,finish)).status===400,'wall clock rejects implausibly early completion')
  await db.pvtSession.update({where:{id:session.data.id},data:{startedAt:new Date(Date.now()-31000)}})
  const saved=await request(p,finish)
  check(saved.status===200 && saved.data.summary.medianRT===250,'server recomputes result')
  check((await request(p,{...finish,result:{...finish.result,interruption:'cancelled'}})).data.summary.quality==='OK','retry cannot overwrite result')
  const question=await db.question.findUnique({where:{id:'focus-question'}})
  const sleep=await db.question.findUnique({where:{id:'sleep-question'}})
  const pain=await db.question.findUnique({where:{id:'pain-question'}})
  const update=await fetch(base+'/api/surveys/test-survey',{method:'PUT',headers:{Cookie:cookie,'Content-Type':'application/json'},body:JSON.stringify({title:'Test Wellness',questions:[{...question,options:JSON.stringify({durationSeconds:60,protocolVersion:PVT_VERSION})},sleep,pain]})})
  check(update.status===409,'editor cannot change duration after first official start')
  const receipt=JSON.stringify({kind:'PVT',attemptId:session.data.id,token:session.data.token,durationSeconds:30,medianRT:1})
  const wellness={surveyId:'test-survey',playerId:'test-player',answers:[{questionId:'focus-question',value:receipt},{questionId:'sleep-question',value:'8'},{questionId:'pain-question',value:'No'}]}
  check((await request('/api/responses',{...wellness,answers:[]})).status===400,'required Focus cannot be skipped')
  check((await request('/api/responses',{...wellness,playerId:'other-player'})).status===400,'receipt cannot attach to another team player')
  check((await request('/api/responses',{...wellness,answers:[{questionId:'focus-question',value:JSON.stringify({kind:'PVT',attemptId:session.data.id,token:'f'.repeat(64)})}]})).status===400,'forged receipt rejected')
  const submitted=await request('/api/responses',wellness)
  check(submitted.status===200,'wellness and native Focus submit together')
  const stored=JSON.parse(submitted.data.answers.find(a=>a.questionId==='focus-question').value)
  check(stored.medianRT===250 && !stored.token,'answer uses verified server summary and omits token')
  const firstResponseId=submitted.data.id
  const repeated=await request('/api/responses',wellness)
  check(repeated.status===200 && repeated.data.id!==firstResponseId,'legacy same-day resubmission preserved')
  check(await db.response.count({where:{surveyId:'test-survey',playerId:'test-player'}})===1,'one daily response retained')
  const linked=await db.pvtSession.findUnique({where:{id:session.data.id}})
  check(linked.responseId===repeated.data.id && linked.summary.medianRT===250,'resubmit preserves attempt and updates link')
  const csv=await fetch(base+'/api/surveys/test-survey/export/csv',{headers:{Cookie:cookie}}).then(r=>r.text())
  check(csv.includes('Focus test - Median RT ms') && csv.includes('250'),'CSV exposes numeric Focus metrics')
  const powerbi=await request('/api/surveys/test-survey/export/powerbi',null,true)
  check(powerbi.data.some(x=>x.questionText==='Focus test - Median RT ms'&&x.answerValue===250),'Power BI exposes numeric metrics')
  const practice=await request(p,{...start,practice:true})
  const interrupted=await request(p,{action:'finish',id:practice.data.id,token:practice.data.token,result:{trials:[],elapsedMs:0,maxFrameGapMs:0,interruption:'cancelled'}})
  check(interrupted.status===200,'interruption retained separately')
  check((await request('/api/responses',{...wellness,answers:[{questionId:'focus-question',value:JSON.stringify({kind:'PVT',attemptId:practice.data.id,token:practice.data.token,durationSeconds:30})}]})).status===400,'practice/interruption cannot complete question')
  const list=await request('/api/pvt/admin',null,true)
  check(list.data.sessions.length===2 && !JSON.stringify(list.data).includes('tokenHash'),'coach sees both attempts without secrets')
  const raw=await request('/api/pvt/admin/'+session.data.id,null,true)
  check(raw.data.raw.trials.length>0 && !raw.data.tokenHash,'scoped raw event export')
  const otherAdmin=await new SignJWT({email:'other@example.invalid',role:'TEAM_ADMIN',teamId:'other-team'}).setProtectedHeader({alg:'HS256'}).setSubject('other-admin').setIssuedAt().setExpirationTime('1h').sign(new TextEncoder().encode('pvt-local-test-only'))
  check((await request('/api/pvt/admin/'+session.data.id,null,false,{Cookie:'wm_admin_session='+otherAdmin})).status===404,'raw data is isolated by team')
  for(let i=0;i<12;i++) await request(p,{...start,password:'WRONG'})
  check((await request(p,start)).status===429,'failed-start rate limit')
  await db.pvtAuthWindow.deleteMany({})
  await db.survey.create({data:{id:'legacy-survey',teamId:'test-team',title:'Legacy Wellness',createdBy:'test-admin',questions:{create:{id:'legacy-question',text:'Fatigue',type:'SCALE'}}}})
  check((await request('/api/responses',{surveyId:'legacy-survey',playerId:'test-player',answers:[{questionId:'legacy-question',value:'5'}]})).status===200,'ordinary wellness surveys still submit')
  await db.response.delete({where:{id:repeated.data.id}})
  check((await db.pvtSession.findUnique({where:{id:session.data.id}})).responseId===null,'response deletion cannot delete PVT history')
  await db.survey.create({data:{id:'race-survey',teamId:'test-team',title:'Race Wellness',createdBy:'test-admin',questions:{create:{id:'race-focus',text:'Focus test',type:'PVT',options:JSON.stringify({durationSeconds:30,protocolVersion:PVT_VERSION})}}}})
  const [raceStart,raceUpdate]=await Promise.all([
    request('/api/kiosk/race-survey/pvt',{...start,questionId:'race-focus'}),
    fetch(base+'/api/surveys/race-survey',{method:'PUT',headers:{Cookie:cookie,'Content-Type':'application/json'},body:JSON.stringify({title:'Race Wellness',questions:[{id:'race-focus',text:'Focus test',type:'PVT',required:true,order:0,options:JSON.stringify({durationSeconds:60,protocolVersion:PVT_VERSION})}]})}),
  ])
  check(raceStart.status===200,'concurrent native start succeeds')
  check((raceUpdate.status===200&&raceStart.data.duration===60)||(raceUpdate.status===409&&raceStart.data.duration===30),'concurrent editor/start cannot split assigned duration')
  await db.survey.create({data:{id:'sixty-survey',teamId:'test-team',title:'60-second Wellness',createdBy:'test-admin',questions:{create:{id:'sixty-focus',text:'Focus test',type:'PVT',options:JSON.stringify({durationSeconds:60,protocolVersion:PVT_VERSION})}}}})
  check((await request('/api/kiosk/sixty-survey/pvt',{...start,questionId:'sixty-focus'})).data.duration===60,'native question assigns 60 seconds')
  fs.writeFileSync('/tmp/pvt-test-admin-cookie',cookie,{mode:0o600})
  console.log(`PASS: ${checks} native integration assertions against isolated loopback fixture`)
} finally {await db.$disconnect();fs.rmSync(dir,{recursive:true,force:true})}
