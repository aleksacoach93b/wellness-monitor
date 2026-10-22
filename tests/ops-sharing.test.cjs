const {test,after}=require('node:test'), assert=require('node:assert/strict'), fs=require('node:fs'),os=require('node:os'),path=require('node:path'),ts=require('typescript')
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'ops-share-unit-'))
fs.symlinkSync(path.join(__dirname,'../node_modules'),path.join(dir,'node_modules'),'dir')
const compile=(file,name)=>fs.writeFileSync(path.join(dir,name+'.cjs'),ts.transpileModule(fs.readFileSync(path.join(__dirname,'..',file),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText)
compile('src/lib/opsShare/security.ts','security')
const security=require(path.join(dir,'security.cjs')), {NextRequest}=require('next/server')
after(()=>fs.rmSync(dir,{recursive:true,force:true}))
test('unpredictable session tokens, opaque hashes, production cookie flags and isolated paths',()=>{
 const tokens=new Set(Array.from({length:100},()=>security.newShareToken()));assert.equal(tokens.size,100)
 for(const token of tokens)assert.ok(security.SHARE_TOKEN.test(token))
 assert.equal(security.shareHash('x').length,64)
 const previous=process.env.NODE_ENV;process.env.NODE_ENV='production'
 try {const c=security.cookieOptions('example');assert.ok(c.secure&&c.httpOnly);assert.equal(c.sameSite,'strict');assert.equal(c.path,'/api/live-ops-share/example')}finally{process.env.NODE_ENV=previous}
})
test('only deployment proxy IP is trusted, device claims remain coarse and iPad hint does not become identity',()=>{
 const oldVercel=process.env.VERCEL,oldEnv=process.env.NODE_ENV;process.env.VERCEL='1';process.env.NODE_ENV='production'
 try {
 const req=(headers)=>new NextRequest('https://example.test/api',{headers})
 const windows=security.viewerMeta(req({'user-agent':'Mozilla Windows NT 10.0 Chrome/130.0','x-vercel-forwarded-for':'203.0.113.25','x-forwarded-for':'1.2.3.4'}));assert.equal(windows.ip,'203.0.113.25');assert.equal(windows.platform,'Windows');assert.equal(windows.device,'Computer')
 const ipad=security.viewerMeta(req({'user-agent':'Mozilla Macintosh AppleWebKit Safari'}),true);assert.equal(ipad.platform,'iPadOS');assert.equal(ipad.device,'Tablet')
 const samsung=security.viewerMeta(req({'user-agent':'Mozilla Android Mobile Chrome/120 SamsungBrowser/25.0'}));assert.equal(samsung.platform,'Android');assert.equal(samsung.browser,'Samsung Internet');assert.equal(samsung.device,'Phone')
 assert.equal(security.viewerMeta(req({'x-vercel-forwarded-for':'invalid'})).ip,'Unavailable')
 delete process.env.VERCEL;assert.equal(security.viewerMeta(req({'x-forwarded-for':'1.2.3.4'})).ip,'Unavailable')
 }finally{oldVercel===undefined?delete process.env.VERCEL:process.env.VERCEL=oldVercel;process.env.NODE_ENV=oldEnv}
})
test('origin and resource validation rejects cross-site writes and drops secret query arguments',()=>{
 const req=(origin,extra={})=>new NextRequest('http://127.0.0.1:4329/api?date=2026-10-22&password=secret&token=private',{headers:{host:'127.0.0.1:4329',...(origin?{origin}:{}),...extra}})
 assert.ok(security.shareSameOrigin(req('http://127.0.0.1:4329')))
 assert.equal(security.shareSameOrigin(req('https://attacker.test')),false)
 assert.equal(security.shareSameOrigin(req(null)),false)
 assert.equal(security.shareSameOrigin(req('http://127.0.0.1:4329',{'sec-fetch-site':'cross-site'})),false)
 assert.equal(security.safeResource(req(null),'today'),'today?date=2026-10-22')
})
test('JSON limit applies to chunked payload without Content-Length, plus malformed/empty input',async()=>{
 const request=body=>new NextRequest('http://example.test/api',{method:'POST',body,duplex:'half'})
 assert.deepEqual(await security.shareJson(request('{"x":1}'),32),{oversized:false,value:{x:1}})
 assert.deepEqual(await security.shareJson(request('{bad'),32),{oversized:false,value:null})
 const stream=new ReadableStream({start(c){c.enqueue(new Uint8Array(70));c.enqueue(new Uint8Array(70));c.close()}})
 assert.equal((await security.shareJson(request(stream),100)).oversized,true)
})
test('additive sharing DDL creates all tables on an existing schema, is repeatable, and cascades only sharing rows',async()=>{
 const runtime=process.env.PVT_TEST_RUNTIME
 if(!runtime)throw Error('PVT_TEST_RUNTIME must point to isolated PGlite dependencies')
 const {createRequire}=require('node:module'),dep=createRequire(path.join(runtime,'package.json')), {PGlite}=dep('@electric-sql/pglite')
 const db=await PGlite.create()
 try {
 await db.exec('CREATE TABLE teams (id TEXT PRIMARY KEY); INSERT INTO teams VALUES (\'fixture\'); CREATE TABLE responses (id TEXT PRIMARY KEY); INSERT INTO responses VALUES (\'preserved\');')
 const sql=[...fs.readFileSync(path.join(__dirname,'../src/lib/opsShare/schema.ts'),'utf8').matchAll(/`([^`]+)`/g)].map(m=>m[1])
 for(let pass=0;pass<2;pass++)for(const stmt of sql)await db.exec(stmt)
 await db.exec(`INSERT INTO ops_share_settings ("teamId","ownerAdminId","updatedAt") VALUES ('fixture','admin',now()); INSERT INTO ops_share_links (id,"teamId",token,label,"expiresAt") VALUES ('link','fixture','token','Coach',now()); INSERT INTO ops_share_sessions (id,"linkId","tokenHash",version,ip,"userAgent",device,browser,platform,"expiresAt") VALUES ('session','link','hash',1,'Unknown','Unknown','Unknown','Unknown','Unknown',now()); DELETE FROM teams WHERE id='fixture';`)
 assert.equal((await db.query('SELECT * FROM ops_share_sessions')).rows.length,0)
 assert.equal((await db.query('SELECT * FROM responses')).rows[0].id,'preserved')
 }finally{await db.close()}
})
