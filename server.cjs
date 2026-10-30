const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const root = __dirname;
const token = crypto.randomBytes(24).toString('hex');
const types = {'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.png':'image/png','.svg':'image/svg+xml','.woff2':'font/woff2','.json':'application/json'};
const server = http.createServer(async (req,res) => {
  const send = (status, value) => {res.writeHead(status, {'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(value));};
  try {
    if (req.headers.host !== '127.0.0.1:8787' && req.headers.host !== 'localhost:8787') return send(403,{error:'로컬 주소로 접속하세요.'});
    if (req.method === 'GET' && req.url === '/api/session') {
      if (req.headers['sec-fetch-site'] === 'cross-site') return send(403,{error:'접근 거부'});
      return send(200,{token});
    }
    if (req.method === 'POST' && req.url === '/api/content') {
      if (req.headers['x-editor-token'] !== token || !['http://127.0.0.1:8787','http://localhost:8787'].includes(req.headers.origin)) return send(403,{error:'관리 페이지를 새로고침하세요.'});
      let chunks=[],size=0;
      for await (const chunk of req) {size+=chunk.length;if(size>150*1024*1024)return send(413,{error:'저장 파일이 150MB를 초과했습니다.'});chunks.push(chunk);}
      const data = JSON.parse(Buffer.concat(chunks));
      if (data.version!==1 || !Array.isArray(data.projects) || !Array.isArray(data.contacts) || !Array.isArray(data.sections)) return send(400,{error:'올바른 포트폴리오 데이터가 아닙니다.'});
      fs.writeFileSync(path.join(root,'site-content.js.tmp'),'window.SITE_CONTENT = '+JSON.stringify(data,null,2)+';\n','utf8');
      fs.copyFileSync(path.join(root,'site-content.js'),path.join(root,'site-content.backup.txt'));
      fs.renameSync(path.join(root,'site-content.js.tmp'),path.join(root,'site-content.js'));
      return send(200,{saved:true});
    }
    if (req.method!=='GET') return send(405,{error:'지원하지 않는 요청'});
    const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
    const file=path.resolve(root,'.'+(pathname==='/'?'/admin.html':pathname));
    if (!file.startsWith(root+path.sep) || /(?:server\.cjs|\.cmd|\.tmp|backup\.txt)$/.test(file)) return send(404,{error:'파일 없음'});
    const stat=fs.statSync(file);if(!stat.isFile())return send(404,{error:'파일 없음'});
    res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});fs.createReadStream(file).pipe(res);
  } catch(e) {send(e.code==='ENOENT'?404:400,{error:e.code==='ENOENT'?'파일 없음':'요청을 처리하지 못했습니다. '+e.message});}
});
server.listen(8787,'127.0.0.1',()=>console.log('관리: http://127.0.0.1:8787/admin.html\n웹: http://127.0.0.1:8787/index.html\n모바일 미리보기: http://127.0.0.1:8787/mobile.html\n종료: Ctrl+C'));
server.on('error',e=>{console.error('관리 서버 실행 실패:',e.message);process.exitCode=1;});
