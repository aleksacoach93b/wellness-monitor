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
function parseCsv(text) {
  const rows=[]; let row=[], cell='', quoted=false
  for(let i=0;i<text.length;i++) { const c=text[i]; if(c==='"') { if(quoted && text[i+1]==='"') {cell+='"';i++} else quoted=!quoted } else if(!quoted && (c===',' || c==='\n')) { row.push(cell);cell='';if(c==='\n'){rows.push(row);row=[]} } else cell+=c }
  row.push(cell);rows.push(row)
  const [headers,...values]=rows
  return {headers,rows:values.filter(r=>r.some(Boolean)).map(r=>Object.fromEntries(headers.map((h,i)=>[h,r[i]??''])))}
}
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

  const emptyCsv=parseCsv(await fetch(base+'/api/surveys/test-survey/export/csv').then(r=>r.text()))
  check(emptyCsv.headers.includes('Focus test - Position') && emptyCsv.rows.length===0,'empty CSV retains a usable stable header')
  check((await request('/api/pvt/admin')).status===401,'admin auth required')
  const admin=await request('/api/pvt/admin',null,true)
  check(admin.status===200 && admin.data.ready,'admin reads migrated PVT')
  check(admin.data.surveys.length===1 && admin.data.surveys[0].questions[0].id==='focus-question','team-scoped native questions')
  const p='/api/kiosk/test-survey/pvt'
  check((await request(p)).data.questions[0].duration===30,'native question config sets duration')
  check((await request(p,{...start,password:'WRONG'})).status===401,'wrong access code rejected')
  check((await request(p,{...start,playerId:'other-player',password:'OP'})).status===401,'cross-team player rejected')
  check((await request(p,{...start,questionId:'sleep-question'})).status===404,'cannot run against ordinary question')
  check((await request(p,{...start,protocolVersion:'handheld-pvt-v2'})).status===409,'old visual protocol rejected for new starts')
  check((await request(p,start,false,{Origin:'https://untrusted.invalid'})).status===403,'cross-origin mutation rejected')
  const authResponse=await fetch(base+p,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'authorize',playerId:'test-player',password:'TP'})})
  const playerCookie=authResponse.headers.get('set-cookie')?.split(';')[0]
  check(authResponse.ok && playerCookie?.startsWith('wm_pvt_player='),'kiosk login issues server-verified player grant')
  const session=await request(p,{...start,password:undefined,context:{...start.context,posture:'standing',minutesAwake:75}},false,{Cookie:playerCookie})
  check(session.status===200 && session.data.duration===30 && session.data.token.length===64,'grant starts assigned test without second password')
  check(session.data.version===PVT_VERSION && (await db.pvtSession.findUnique({where:{id:session.data.id}})).protocolVersion===PVT_VERSION,'new donut attempts retain their actual visual version')
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
  check(linked.context.posture==='standing' && linked.context.minutesAwake===75,'standing and manual waking minutes survive completion and wellness submission')
  const csvResponse=await fetch(base+'/api/surveys/test-survey/export/csv')
  check(csvResponse.ok && csvResponse.headers.get('cache-control').includes('no-store'),'permanent CSV link works without login and prevents stale caching')
  const csv=await csvResponse.text()
  check(csv.includes('Focus test - Median RT ms') && csv.includes('250'),'CSV exposes numeric Focus metrics')
  const exported=parseCsv(csv).rows[0]
  check(exported['Sleep quality']==='8' && exported['Focus test - Attempt ID']===session.data.id && exported.responseId===repeated.data.id && exported.playerId==='test-player','one CSV row combines wellness and the explicit saved Focus attempt with stable IDs')
  check(exported['Focus test - Position']==='standing' && exported['Focus test - Minutes since waking']==='75' && exported['Focus test - Caffeine 0 or 1']==='0','main CSV exports waking context numerically')
  check(exported['Focus test - Early taps']==='0' && exported['Focus test - Slow responses count (exploratory)']==='0' && exported['Focus test - Response speed 1/s']==='4' && exported['Focus test - Status']==='COMPLETED','CSV preserves measured zeros and full server metrics')
  check(!csv.includes(session.data.token) && !csv.includes('tokenHash') && !csv.includes(start.context.deviceId),'main CSV omits credentials and device identifiers')
  const powerbi=await request('/api/surveys/test-survey/export/powerbi',null,true)
  check(powerbi.data.some(x=>x.questionText==='Focus test - Median RT ms'&&x.answerValue===250),'Power BI exposes numeric metrics')
  check(powerbi.data.some(x=>x.questionText==='Focus test - Minutes since waking'&&x.answerValue===75),'Power BI JSON and main CSV expose the same context')
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
  const copied=await db.pvtSession.findUnique({where:{id:session.data.id}})
  const {id:copiedId,...copiedFields}=copied
  const extra=await db.pvtSession.create({data:{...copiedFields,responseId:null,startedAt:new Date(Date.now()-60000),summary:{...copied.summary,medianRT:125}}})
  const ops=await request('/api/ops/today?surveyId=test-survey',null,true)
  check(ops.status===200 && ops.data.focusQuestions[0].id==='focus-question' && ops.data.focusAvailable,'Live Ops includes the native Focus module')
  const focus=ops.data.players.find(p=>p.id==='test-player').focus
  check(focus.attemptId===session.data.id && focus.linked && focus.medianRT===250 && focus.count===2,'Live Ops matches the exact wellness CSV result instead of another same-day attempt')
  await db.response.create({data:{id:'historical-without-focus',surveyId:'test-survey',playerId:'test-player',submittedAt:new Date(Date.now()-86400000),answers:{create:{questionId:'sleep-question',value:'7'}}}})
  const historyCsv=parseCsv(await fetch(base+'/api/surveys/test-survey/export/csv').then(r=>r.text()))
  check(historyCsv.rows.length===2 && historyCsv.rows.find(r=>r.responseId==='historical-without-focus')['Focus test - Median RT ms']==='' && historyCsv.rows.find(r=>r.responseId===repeated.data.id)['Focus test - Median RT ms']==='250','older unanswered Focus remains blank and unsubmitted repeats cannot overwrite the linked result')
  const legacyCsv=parseCsv(await fetch(base+'/api/surveys/test-survey/export/csv?legacy=1').then(r=>r.text()))
  check(!legacyCsv.headers.some(h=>h.includes('Exact spot')) && legacyCsv.headers.includes('Focus test - Position') && historyCsv.headers.some(h=>h.includes('Exact spot')),'legacy body-map option preserves Focus data and full body-map schema')
  await db.question.update({where:{id:'focus-question'},data:{text:'Focus test, "AM"'}})
  const quotedCsv=parseCsv(await fetch(base+'/api/surveys/test-survey/export/csv').then(r=>r.text()))
  check(quotedCsv.rows.find(r=>r.responseId===repeated.data.id)['Focus test, "AM" - Median RT ms']==='250','CSV correctly escapes quoted question labels without moving metric values')
  await db.question.update({where:{id:'focus-question'},data:{text:'Focus test'}})
  const historicalRows=Array.from({length:8},(_,i)=>{const startedAt=new Date(Date.now()-(26+i)*86400000);return {...copiedFields,id:'reference-history-'+i,responseId:null,startedAt,finishedAt:new Date(startedAt.getTime()+30000),localDate:new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Belgrade'}).format(startedAt)}})
  await db.pvtSession.createMany({data:historicalRows})
  const referenceHistory=await request('/api/pvt/admin',null,true)
  check(referenceHistory.data.baselines['reference-history-0'].days===7 && referenceHistory.data.baselines['reference-history-0'].reference===250 && !referenceHistory.data.sessions.some(s=>s.id==='reference-history-7'),'historical analysis calculates a full prior reference without exposing older rows in the 28-day view')
  await db.pvtSession.deleteMany({where:{teamId:'test-team',id:{startsWith:'reference-history-'}}})
  await db.pvtSession.delete({where:{id:extra.id}})
  await db.response.delete({where:{id:'historical-without-focus'}})
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
  await db.pvtAuthWindow.deleteMany({})
  check((await request(p,{...start,protocolVersion:'handheld-pvt-v3'})).status===409,'cached square clients must reload before starting')
  check((await request(p,{...start,protocolVersion:'handheld-pvt-v4'})).status===409,'cached donut clients must reload for integrity rules')
  // Simulate an already-issued pre-deployment session, not a new legacy start.
  const oldPage={data:(await request(p,start)).data}
  await db.pvtSession.update({where:{id:oldPage.data.id},data:{protocolVersion:'handheld-pvt-v3',startedAt:new Date(Date.now()-31000)}})
  const oldFinished=await request(p,{...finish,id:oldPage.data.id,token:oldPage.data.token})
  check(oldFinished.status===200 && oldFinished.data.summary.medianRT===250,'in-flight square session can finish after the donut release')
  const oldReceipt={...wellness,answers:[{questionId:'focus-question',value:JSON.stringify({kind:'PVT',attemptId:oldPage.data.id,token:oldPage.data.token,durationSeconds:30})}]}
  const oldResponse=await request('/api/responses',oldReceipt)
  check(oldResponse.status===200 && JSON.parse(oldResponse.data.answers[0].value).protocolVersion==='handheld-pvt-v3','old receipt retains version when submitted with wellness')
  const mixedCsv=parseCsv(await fetch(base+'/api/surveys/test-survey/export/csv').then(r=>r.text()))
  check(mixedCsv.rows.some(r=>r['Focus test - Protocol']==='handheld-pvt-v3'),'CSV keeps historical visual versions without relabelling')

  await db.pvtAuthWindow.deleteMany({})
  const existingResponse=await db.response.findFirst({where:{surveyId:'test-survey',playerId:'test-player'}})
  async function saveAttack(result, message) {
    const attempt=await request(p,start)
    check(attempt.status===200,message+' starts')
    await db.pvtSession.update({where:{id:attempt.data.id},data:{startedAt:new Date(Date.now()-31000)}})
    const body={action:'finish',id:attempt.data.id,token:attempt.data.token,result,summary:{medianRT:150,quality:'OK',repeatRequired:false}}
    const saved=await request(p,body)
    check(saved.status===200 && saved.data.status==='INVALID' && saved.data.summary.repeatRequired && saved.data.summary.quality==='INVALID',message+' is saved as invalid by the server')
    const retry=await request(p,{...body,result:e.result()})
    check(retry.data.status==='INVALID' && retry.data.summary.repeatRequired,message+' cannot be overwritten by a retry')
    const receipt=JSON.stringify({kind:'PVT',attemptId:attempt.data.id,token:attempt.data.token,durationSeconds:30,medianRT:150,quality:'OK'})
    const rejected=await request('/api/responses',{...wellness,answers:[{questionId:'focus-question',value:receipt}]})
    check(rejected.status===400 && rejected.data.error.includes('Repeat') && rejected.data.focusQuestionId==='focus-question',message+' cannot complete a wellness question')
    check((await db.response.findUnique({where:{id:existingResponse.id}}))?.id===existingResponse.id,message+' cannot replace existing wellness data')
    return attempt
  }
  const spam=new PvtEngine(30000,()=>0);spam.press(10);spam.press(20);spam.press(30)
  const spamAttempt=await saveAttack(spam.result(),'Three early taps')
  const idle=new PvtEngine(30000,()=>0)
  for(let n=0;n<=30000;n+=10){idle.tick(n);if(idle.trials.filter(t=>t.kind==='response').length<2 && idle.onset!==null&&n-idle.onset>=250)idle.press(n)}
  await saveAttack(idle.result(),'Two responses followed by idling')
  const prefix={...e.result(),trials:e.result().trials.slice(0,3)}
  await saveAttack(prefix,'A short prefix labelled as a full 30-second test')
  const gapped={...e.result(),trials:e.result().trials.slice(0,5)}
  await saveAttack(gapped,'Five good responses missing the final test window')
  // Even a receipt from an old COMPLETED session is rechecked before a new submission.
  await db.pvtSession.update({where:{id:spamAttempt.data.id},data:{status:'COMPLETED',protocolVersion:'handheld-pvt-v4',summary:{medianRT:150,responses:5,quality:'OK',flags:[]}}})
  const stale=await request('/api/responses',{...wellness,answers:[{questionId:'focus-question',value:JSON.stringify({kind:'PVT',attemptId:spamAttempt.data.id,token:spamAttempt.data.token})}]})
  check(stale.status===400 && stale.data.error.includes('Repeat'),'an old successful status cannot bypass raw-record revalidation')
  await db.pvtSession.update({where:{id:spamAttempt.data.id},data:{status:'INVALID'}})
  const afterAttacks=parseCsv(await fetch(base+'/api/surveys/test-survey/export/csv').then(r=>r.text()))
  check(afterAttacks.rows.length===1 && afterAttacks.rows[0].responseId===existingResponse.id && afterAttacks.rows[0]['Focus test - Median RT ms']==='250','invalid attempts never enter the main wellness CSV or overwrite its linked median')
  await db.pvtAuthWindow.deleteMany({})
  const sixty=await request('/api/kiosk/sixty-survey/pvt',{...start,questionId:'sixty-focus'})
  await db.pvtSession.update({where:{id:sixty.data.id},data:{startedAt:new Date(Date.now()-61000)}})
  const long=new PvtEngine(60000,()=>.5)
  for(let n=0;n<=60000;n+=10){long.tick(n);if(long.onset!==null&&n-long.onset>=150)long.press(n)}
  const sixtyFinish=await request('/api/kiosk/sixty-survey/pvt',{action:'finish',id:sixty.data.id,token:sixty.data.token,result:long.result()})
  check(sixtyFinish.status===200 && sixtyFinish.data.status==='COMPLETED' && !sixtyFinish.data.summary.repeatRequired && sixtyFinish.data.summary.medianRT===150,'a full legitimate 60-second 150ms test is accepted')
  const shortSixty=await request('/api/kiosk/sixty-survey/pvt',{...start,questionId:'sixty-focus'})
  await db.pvtSession.update({where:{id:shortSixty.data.id},data:{startedAt:new Date(Date.now()-61000)}})
  const fewSixty=await request('/api/kiosk/sixty-survey/pvt',{action:'finish',id:shortSixty.data.id,token:shortSixty.data.token,result:{...long.result(),trials:long.result().trials.slice(0,9)}})
  check(fewSixty.status===200 && fewSixty.data.summary.repeatReasons.includes('few-responses') && fewSixty.data.status==='INVALID','60-second attempts independently require ten responses')
  fs.writeFileSync('/tmp/pvt-test-admin-cookie',cookie,{mode:0o600})
  console.log(`PASS: ${checks} native integration assertions against isolated loopback fixture`)
} finally {await db.$disconnect();fs.rmSync(dir,{recursive:true,force:true})}
