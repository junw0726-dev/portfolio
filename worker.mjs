const encoder = new TextEncoder();
const COOKIE = '__Host-portfolio-admin';
const CONTENT = 'content/current.json';
const MAX_IMAGE = 25 * 1024 * 1024;
const MAX_CONTENT = 5 * 1024 * 1024;
const json = (body, status = 200, extra = {}) => new Response(JSON.stringify(body), {status, headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff',...extra}});
const fail = (status, message) => {throw Object.assign(new Error(message), {status});};
const hex = bytes => [...new Uint8Array(bytes)].map(x=>x.toString(16).padStart(2,'0')).join('');
const b64 = bytes => btoa(String.fromCharCode(...new Uint8Array(bytes))).replaceAll('+','-').replaceAll('/','_').replace(/=+$/,'');
function equal(a,b) {if(a.length!==b.length)return false;let mismatch=0;for(let i=0;i<a.length;i++)mismatch|=a.charCodeAt(i)^b.charCodeAt(i);return mismatch===0;}
async function hmac(env, text) {
  const key = await crypto.subtle.importKey('raw',encoder.encode(env.SESSION_SECRET+'|'+env.ADMIN_PASSWORD),{name:'HMAC',hash:'SHA-256'},false,['sign']);
  return b64(await crypto.subtle.sign('HMAC',key,encoder.encode(text)));
}
const configured = env => typeof env.ADMIN_PASSWORD==='string' && env.ADMIN_PASSWORD.length>=12 && typeof env.SESSION_SECRET==='string' && env.SESSION_SECRET.length>=32 && env.PORTFOLIO_STORE;
function configuration(env) {
  const missing = [];
  if (!env.PORTFOLIO_STORE) missing.push('R2 연결 누락: Worker의 Bindings에서 변수명 PORTFOLIO_STORE를 portfolio-content 버킷에 연결하세요.');
  if (typeof env.ADMIN_PASSWORD !== 'string' || env.ADMIN_PASSWORD.length < 12) missing.push('ADMIN_PASSWORD 누락 또는 12자 미만: Runtime variables and secrets의 Production에 Secret으로 설정하세요.');
  if (typeof env.SESSION_SECRET !== 'string' || env.SESSION_SECRET.length < 32) missing.push('SESSION_SECRET 누락 또는 32자 미만: Runtime variables and secrets의 Production에 Secret으로 설정하세요.');
  if (missing.length) fail(503, missing.join('\n'));
}
async function session(request,env) {
  if(!configured(env))return null;
  const cookie=(request.headers.get('Cookie')||'').split(';').map(x=>x.trim()).find(x=>x.startsWith(COOKIE+'='))?.slice(COOKIE.length+1);
  if(!cookie || cookie.length>300)return null;
  const parts=cookie.split('.');if(parts.length!==3)return null;
  const [expires,nonce,signature]=parts;
  if(!/^\d+$/.test(expires) || Number(expires)<=Date.now() || Number(expires)>Date.now()+13*3600000 || !/^[a-f0-9]{32}$/.test(nonce))return null;
  if(!equal(await hmac(env,expires+'.'+nonce),signature))return null;
  return {token:await hmac(env,'csrf:'+cookie)};
}
function sameOrigin(request) {if(request.headers.get('Origin')!==new URL(request.url).origin)fail(403,'요청 출처가 올바르지 않습니다.');}
async function authenticated(request,env,mutate=false) {
  configuration(env);const s=await session(request,env);if(!s)fail(401,'로그인이 만료됐습니다. 다시 로그인하세요.');
  if(mutate){sameOrigin(request);if(!equal(s.token,request.headers.get('X-Editor-Token')||''))fail(403,'관리 화면을 새로고침하세요.');}return s;
}
async function limitedBody(request,limit) {
  if(Number(request.headers.get('Content-Length')||0)>limit)fail(413,'파일 크기가 허용 범위를 초과했습니다.');
  if(!request.body)return new Uint8Array();
  const reader=request.body.getReader(),chunks=[];let size=0;
  while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>limit){await reader.cancel();fail(413,'파일 크기가 허용 범위를 초과했습니다.');}chunks.push(value);}
  const out=new Uint8Array(size);let offset=0;for(const chunk of chunks){out.set(chunk,offset);offset+=chunk.length;}return out;
}
async function readJSON(request,limit) {try{return JSON.parse(new TextDecoder().decode(await limitedBody(request,limit)));}catch(e){if(e.status)throw e;fail(400,'올바른 JSON 데이터가 아닙니다.');}}
const link = v => !v || typeof v==='string' && v.length<=2048 && /^(https?:\/\/|mailto:|tel:)/i.test(v);
function text(value,max=200000) {if(typeof value!=='string'||value.length>max)fail(400,'텍스트가 올바르지 않거나 너무 깁니다.');}
function imageSource(value) {return typeof value==='string' && /^(?:\/?assets\/[a-zA-Z0-9_./-]+|\/media\/[a-f0-9]{64}\.(?:png|jpg|webp|gif))$/.test(value) && !value.includes('..');}
export function validate(data) {
  if(!data||data.version!==1||!Array.isArray(data.projects)||data.projects.length>500||!Array.isArray(data.sections)||data.sections.length>100||!Array.isArray(data.contacts)||data.contacts.length>100)fail(400,'콘텐츠 형식이 올바르지 않습니다.');
  for(const key of ['intro','copyright','biography'])text(data[key]);
  const itemText=item=>{if(!item||!link(item.url))fail(400,'링크 형식이 올바르지 않습니다.');text(item.text);};
  data.contacts.forEach(itemText);
  data.sections.forEach(section=>{text(section.title,500);if(!Array.isArray(section.items)||section.items.length>1000)fail(400,'섹션 항목을 확인하세요.');section.items.forEach(itemText);});
  data.projects.forEach(project=>{
    text(project.title,500);if(!project.title.trim()||!Array.isArray(project.thumbnails)||!project.thumbnails.length||project.thumbnails.length>200||!Array.isArray(project.blocks)||!project.blocks.length||project.blocks.length>500)fail(400,'작업물 제목과 썸네일, 상세 블록을 확인하세요.');
    for(const [items,thumbnail]of [[project.thumbnails,true],[project.blocks,false]])items.forEach(item=>{
      if(item?.type==='text'&&!thumbnail){itemText(item);if(item.size!==undefined&&(!Number.isFinite(item.size)||item.size<10||item.size>72))fail(400,'글자 크기는 10~72px입니다.');}
      else if(item?.type==='image'){if(!imageSource(item.src))fail(400,'이미지를 먼저 업로드하세요.');}
      else if(item?.type==='design'){
        const s=item.slot;if(!Array.isArray(s)||s.length!==10||!/^[a-z0-9]+$/i.test(s[0])||!/^[a-z0-9]+\.(png|jpg|webp|gif)$/i.test(s[1])||s.slice(2).some(x=>!Number.isFinite(x)||Math.abs(x)>2000))fail(400,'기존 커버 설정이 올바르지 않습니다.');
      }else fail(400,'지원하지 않는 블록입니다.');
    });
  });
}
function imageType(bytes) {
  if(bytes.length>=8&&[137,80,78,71,13,10,26,10].every((n,i)=>bytes[i]===n))return ['png','image/png'];
  if(bytes[0]===255&&bytes[1]===216&&bytes[2]===255)return ['jpg','image/jpeg'];
  if(bytes.length>=6&&['GIF87a','GIF89a'].includes(new TextDecoder().decode(bytes.slice(0,6))))return ['gif','image/gif'];
  if(bytes.length>=12&&new TextDecoder().decode(bytes.slice(0,4))==='RIFF'&&new TextDecoder().decode(bytes.slice(8,12))==='WEBP')return ['webp','image/webp'];
  fail(400,'PNG, JPG, GIF, WebP 이미지 파일을 선택하세요.');
}
async function route(request,env) {
  const url=new URL(request.url),path=url.pathname;
  if(path==='/api/session') {
    if(request.method!=='GET')return json({error:'허용하지 않는 요청'},405);
    configuration(env);const s=await session(request,env);return s?json({authenticated:true,token:s.token,mode:'online'}):json({authenticated:false},401);
  }
  if(path==='/api/login') {
    if(request.method!=='POST')return json({error:'허용하지 않는 요청'},405);
    configuration(env);sameOrigin(request);
    if(!env.LOGIN_LIMITER)fail(503,'로그인 시도 제한 연결이 누락됐습니다. 재배포 설정을 확인하세요.');
    const result=await env.LOGIN_LIMITER.limit({key:'portfolio-login:'+ (request.headers.get('CF-Connecting-IP')||'unknown')});if(!result.success)fail(429,'로그인 시도가 많습니다. 1분 뒤 다시 시도하세요.');
    const body=await readJSON(request,4096);if(typeof body.password!=='string'||!equal(await hmac(env,body.password),await hmac(env,env.ADMIN_PASSWORD)))fail(401,'비밀번호를 확인하세요.');
    const payload=(Date.now()+12*3600000)+'.'+hex(crypto.getRandomValues(new Uint8Array(16)));
    const cookie=payload+'.'+await hmac(env,payload);
    return json({authenticated:true},200,{'Set-Cookie':`${COOKIE}=${cookie}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=43200`});
  }
  if(path==='/api/logout') {if(request.method!=='POST')return json({error:'허용하지 않는 요청'},405);await authenticated(request,env,true);return json({ok:true},200,{'Set-Cookie':`${COOKIE}=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0`});}
  if(path==='/api/upload') {
    if(request.method!=='POST')return json({error:'허용하지 않는 요청'},405);
    await authenticated(request,env,true);const bytes=await limitedBody(request,MAX_IMAGE),[ext,type]=imageType(bytes);
    const digest=hex(await crypto.subtle.digest('SHA-256',bytes)),key='media/'+digest+'.'+ext;
    await env.PORTFOLIO_STORE.put(key,bytes,{httpMetadata:{contentType:type,cacheControl:'public, max-age=31536000, immutable'}});
    return json({src:'/'+key});
  }
  if(path==='/api/content') {
    await authenticated(request,env,request.method!=='GET');
    if(request.method==='GET'){const saved=await env.PORTFOLIO_STORE.get(CONTENT);return json({content:saved?await saved.json():null,revision:saved?.etag||''});}
    if(request.method!=='POST')return json({error:'허용하지 않는 요청'},405);
    const data=await readJSON(request,MAX_CONTENT);validate(data);
    const previous=await env.PORTFOLIO_STORE.get(CONTENT),expected=request.headers.get('X-Content-Revision');
    if(expected===null||(previous?.etag||'')!==expected)fail(409,'다른 창에서 내용이 바뀌었습니다. 백업 후 새로고침하고 다시 저장하세요.');
    if(previous)await env.PORTFOLIO_STORE.put('content/previous.json',previous.body,{httpMetadata:{contentType:'application/json'}});
    const saved=await env.PORTFOLIO_STORE.put(CONTENT,JSON.stringify(data),{httpMetadata:{contentType:'application/json'},onlyIf:previous?{etagMatches:expected}:{etagDoesNotMatch:'*'}});
    if(!saved)fail(409,'다른 창에서 먼저 저장했습니다. 새로고침하세요.');
    return json({saved:true,revision:saved.etag});
  }
  if(path==='/site-content.js'&&['GET','HEAD'].includes(request.method)) {
    const saved=env.PORTFOLIO_STORE?await env.PORTFOLIO_STORE.get(CONTENT):null;
    const response=saved?new Response('window.SITE_CONTENT = '+await saved.text()+';\n',{headers:{'Content-Type':'text/javascript; charset=utf-8'}}):await env.ASSETS.fetch(request);
    const headers=new Headers(response.headers);headers.set('Cache-Control','no-store');headers.set('X-Content-Type-Options','nosniff');return new Response(request.method==='HEAD'?null:response.body,{status:response.status,headers});
  }
  if(path.startsWith('/media/')) {
    if(!['GET','HEAD'].includes(request.method)||!/^\/media\/[a-f0-9]{64}\.(png|jpg|webp|gif)$/.test(path))return new Response('Not found',{status:404});
    const object=env.PORTFOLIO_STORE?await env.PORTFOLIO_STORE.get(path.slice(1)):null;if(!object)return new Response('Not found',{status:404});
    const headers=new Headers();object.writeHttpMetadata(headers);headers.set('X-Content-Type-Options','nosniff');headers.set('ETag',object.httpEtag);return new Response(request.method==='HEAD'?null:object.body,{headers});
  }
  if(path==='/admin/')return Response.redirect(new URL('/admin',url),302);
  if(['/admin','/admin.html'].includes(path)) {
    if(!await session(request,env))return Response.redirect(new URL('/login',url),302);
    return adminAsset(request,env,'/admin.html');
  }
  if(['/login','/login.html'].includes(path))return adminAsset(request,env,'/login.html');
  if(path.startsWith('/api/'))return json({error:'Not found'},404);
  return env.ASSETS.fetch(request);
}
async function adminAsset(request,env,path) {const response=await env.ASSETS.fetch(new Request(new URL(path,request.url),{method:'GET'}));const headers=new Headers(response.headers);headers.set('Cache-Control','no-store');headers.set('X-Frame-Options','DENY');headers.set('Referrer-Policy','same-origin');return new Response(response.body,{status:response.status,headers});}
export default {async fetch(request,env){try{return await route(request,env);}catch(e){if(!e.status)console.error('Portfolio request failed:',e.message);return json({error:e.status?e.message:'저장소 연결을 확인하세요. 잠시 후 다시 시도하세요.'},e.status||503);}}};
