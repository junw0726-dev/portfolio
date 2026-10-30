import test from 'node:test';
import assert from 'node:assert/strict';
import worker from './worker.mjs';
import {createHash} from 'node:crypto';
export class MemoryStore {
  objects=new Map();
  async get(key){const value=this.objects.get(key);if(!value)return null;const bytes=value.bytes.slice();return {etag:value.etag,httpEtag:'"'+value.etag+'"',body:new Blob([bytes]).stream(),text:async()=>new TextDecoder().decode(bytes),json:async()=>JSON.parse(new TextDecoder().decode(bytes)),writeHttpMetadata(headers){for(const [k,v]of Object.entries(value.headers||{}))headers.set(k==='contentType'?'Content-Type':k==='cacheControl'?'Cache-Control':k,v);}};}
  async put(key,value,options={}){
    const bytes=new Uint8Array(await new Response(value).arrayBuffer());const old=this.objects.get(key);
    if(options.onlyIf?.etagMatches&&old?.etag!==options.onlyIf.etagMatches)return null;
    if(options.onlyIf?.etagDoesNotMatch==='*'&&old)return null;
    const etag=createHash('sha256').update(bytes).digest('hex');this.objects.set(key,{bytes,etag,headers:options.httpMetadata});return {etag};
  }
}
export const baseData=()=>({version:1,intro:'hello',copyright:'copy',biography:'bio',sections:[{title:'Experience',items:[{text:'One\nTwo',url:''}]}],contacts:[{text:'Email',url:'mailto:test@example.com'}],projects:[{id:'one',title:'Work',thumbnails:[{type:'image',src:'assets/work/1.png'}],blocks:[{type:'text',text:'Detail only',size:18}]}]});
export const makeEnv=()=>({ADMIN_PASSWORD:'test-password-only-1234',SESSION_SECRET:'test-session-secret-only-32-characters-long',PORTFOLIO_STORE:new MemoryStore(),LOGIN_LIMITER:{limit:async()=>({success:true})},ASSETS:{fetch:async()=>new Response('window.SITE_CONTENT = '+JSON.stringify(baseData())+';',{headers:{'Content-Type':'text/javascript'}})}});
const origin='https://portfolio.test';
async function call(env,path,init={}) {return worker.fetch(new Request(origin+path,init),env);}
async function auth(env) {
  const response=await call(env,'/api/login',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify({password:env.ADMIN_PASSWORD})});assert.equal(response.status,200);
  const cookie=response.headers.get('Set-Cookie').split(';')[0];const s=await call(env,'/api/session',{headers:{Cookie:cookie}});const {token}=await s.json();return {Cookie:cookie,Origin:origin,'X-Editor-Token':token};
}
test('anonymous users cannot modify data or open admin; site works before setup',async()=>{
  const env=makeEnv();assert.equal((await call(env,'/api/content',{method:'POST',body:'{}'})).status,401);
  assert.equal((await call(env,'/admin')).status,302);assert.equal((await call(env,'/site-content.js')).status,200);
  assert.equal((await call({},'/api/session')).status,503);
});
test('login checks password, signed cookies, origin, logout, and rate limit',async()=>{
  const env=makeEnv();let r=await call(env,'/api/login',{method:'POST',headers:{Origin:origin},body:JSON.stringify({password:'incorrect'})});assert.equal(r.status,401);
  assert.equal((await call(env,'/api/login',{method:'POST',headers:{Origin:'https://evil.test'},body:'{}'})).status,403);
  const headers=await auth(env);assert.equal((await call(env,'/api/session',{headers:{Cookie:headers.Cookie+'x'}})).status,401);
  assert.equal((await call(env,'/api/content',{method:'POST',headers:{...headers,'X-Editor-Token':'forged'},body:'{}'})).status,403);
  r=await call(env,'/api/logout',{method:'POST',headers});assert.match(r.headers.get('Set-Cookie'),/Max-Age=0/);
  env.LOGIN_LIMITER.limit=async()=>({success:false});assert.equal((await call(env,'/api/login',{method:'POST',headers:{Origin:origin},body:'{}'})).status,429);
});
test('separate thumbnails and blocks persist; fresh public content is uncached; stale saves are refused',async()=>{
  const env=makeEnv(),headers=await auth(env),data=baseData();
  assert.deepEqual(await(await call(env,'/api/content',{headers})).json(),{content:null,revision:''});
  let response=await call(env,'/api/content',{method:'POST',headers:{...headers,'X-Content-Revision':''},body:JSON.stringify(data)});assert.equal(response.status,200);const {revision}=await response.json();
  response=await call(env,'/site-content.js');assert.equal(response.headers.get('Cache-Control'),'no-store');assert.match(await response.text(),/Detail only/);
  data.intro='updated';assert.equal((await call(env,'/api/content',{method:'POST',headers:{...headers,'X-Content-Revision':''},body:JSON.stringify(data)})).status,409);
  assert.equal((await call(env,'/api/content',{method:'POST',headers:{...headers,'X-Content-Revision':revision},body:JSON.stringify(data)})).status,200);
  assert.ok(env.PORTFOLIO_STORE.objects.has('content/previous.json'));
  const saved=await(await call(env,'/api/content',{headers})).json();assert.equal(saved.content.intro,'updated');assert.equal(saved.content.projects[0].blocks[0].type,'text');
});
test('uploads validate image signatures and media routes never expose content backups',async()=>{
  const env=makeEnv(),headers=await auth(env);
  assert.equal((await call(env,'/api/upload',{method:'POST',headers,body:'<svg onload="x"/>'})).status,400);
  const png=Uint8Array.from([137,80,78,71,13,10,26,10,0]);const response=await call(env,'/api/upload',{method:'POST',headers,body:png});assert.equal(response.status,200);
  const {src}=await response.json(),image=await call(env,src);assert.equal(image.headers.get('Content-Type'),'image/png');assert.deepEqual(new Uint8Array(await image.arrayBuffer()),png);
  assert.equal((await call(env,'/media/current.json')).status,404);
  const data=baseData();data.contacts[0].url='javascript:alert(1)';assert.equal((await call(env,'/api/content',{method:'POST',headers:{...headers,'X-Content-Revision':''},body:JSON.stringify(data)})).status,400);
});
