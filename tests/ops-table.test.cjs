const {test,after}=require('node:test'), assert=require('node:assert/strict'), fs=require('node:fs'), os=require('node:os'), path=require('node:path'), ts=require('typescript')
const React=require('react'),{renderToStaticMarkup}=require('react-dom/server')
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'ops-table-'))
fs.symlinkSync(path.join(__dirname,'../node_modules'),path.join(dir,'node_modules'),'dir')
for(const [file,name] of [['src/components/opsShare/OpsAccess.tsx','OpsAccess'],['src/lib/opsTableColumns.ts','opsTableColumns'],['src/components/admin/ops/OpsWellnessTable.tsx','OpsWellnessTable']]){
 const source=fs.readFileSync(path.join(__dirname,'..',file),'utf8')
 const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText.replace('require("@/lib/opsTableColumns")','require("./opsTableColumns")').replace('require("@/components/opsShare/OpsAccess")','require("./OpsAccess")')
 fs.writeFileSync(path.join(dir,name+'.js'),js)
}
after(()=>fs.rmSync(dir,{recursive:true,force:true}))
const {normalizeOpsColumns,DEFAULT_OPS_COLUMNS,groupSpans,enabledColumns}=require(path.join(dir,'opsTableColumns.js'))
const Table=require(path.join(dir,'OpsWellnessTable.js')).default
const legacy=DEFAULT_OPS_COLUMNS.filter(c=>c.id!=='rhr').map(c=>c.id==='fatigue'?{...c,label:'My fatigue',questionId:'fatigue-question'}:c.id==='wake'?{...c,enabled:false}:c)
test('existing saved layouts gain RHR directly after Focus without resetting preferences',()=>{const cols=normalizeOpsColumns(legacy);assert.equal(cols[cols.findIndex(c=>c.id==='focus')+1].id,'rhr');assert.equal(cols.find(c=>c.id==='rhr').enabled,true);assert.equal(cols.find(c=>c.id==='fatigue').label,'My fatigue');assert.equal(cols.find(c=>c.id==='fatigue').questionId,'fatigue-question');assert.equal(cols.find(c=>c.id==='wake').enabled,false);assert.deepEqual(normalizeOpsColumns(cols),cols);assert.equal(groupSpans(enabledColumns(cols)).reduce((n,g)=>n+g.span,0),enabledColumns(cols).length)})
test('an explicit RHR visibility preference remains saved',()=>{const cols=normalizeOpsColumns([...legacy,{id:'rhr',enabled:false,label:'Resting pulse'}]);assert.equal(cols.find(c=>c.id==='rhr').enabled,false);assert.equal(cols.find(c=>c.id==='rhr').label,'Resting pulse')})
const player={id:'fixture',firstName:'Test',lastName:'Player',image:null,status:'done',submittedAt:null,rank:null,wellness:null,focus:{medianRT:273,quality:'OK',duration:30,baselineDays:0,deltaPercent:null,count:1,linked:true,surveyId:'s',questionId:'f'},restingHr:[{questionId:'h',label:'Resting HR',bpm:68,position:'lying',measuredAt:'2026-10-17T08:00:00Z'}]}
const render=p=>renderToStaticMarkup(React.createElement(Table,{players:[p],columns:legacy}))
test('table shows only Focus median and the saved HR alongside it',()=>{const html=render(player),text=html.replace(/<[^>]*>/g,'');assert.match(html,/>Focus test<\/th><th[^>]*[^]*?>RHR<\/th>/);assert.match(text,/273 ms68 bpm/);for(const detail of ['reference days','In wellness CSV','Awaiting wellness','30s · OK'])assert.equal(text.includes(detail),false)})
test('missing measurements remain blank rather than showing fabricated zeros',()=>{const html=render({...player,focus:null,restingHr:[]});assert.equal(html.includes('0 ms'),false);assert.equal(html.includes('0 bpm'),false);assert.ok(html.includes('ops-t-muted'))})

test('staff table preserves numbers but exposes no administrator links',()=>{const {OpsAccessContext}=require(path.join(dir,'OpsAccess.js'));const html=renderToStaticMarkup(React.createElement(OpsAccessContext.Provider,{value:{readOnly:true,apiBase:'/api/live-ops-share/example',request:fetch}},React.createElement(Table,{players:[player],columns:legacy})));assert.match(html,/273 ms/);assert.match(html,/68/);assert.equal(html.includes('/admin/'),false)})
