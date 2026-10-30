(() => {
  let data = structuredClone(window.SITE_CONTENT), tab = 'projects', selected = 0, dirty = false, token = '', online = false, revision = '', saving = false;
  const editor = document.querySelector('#editor'), status = document.querySelector('#status');
  const imageInput = document.querySelector('#image-input');
  let uploadTarget;
  const el = (tag, text, cls) => {const e=document.createElement(tag);if(text!==undefined)e.textContent=text;if(cls)e.className=cls;return e;};
  const button = (text, action, cls) => {const b=el('button',text,cls);b.type='button';b.onclick=action;return b;};
  const changed = () => {dirty=true;status.textContent='저장하지 않은 변경사항이 있습니다.';};
  function field(parent, label, value, update, type='text') {
    const id='field-'+crypto.randomUUID();const l=el('label',label);l.htmlFor=id;
    const input=el(type==='textarea'?'textarea':'input');input.id=id;
    if(type!=='textarea')input.type=type;input.value=value??'';
    input.oninput=()=>{update(input.value);changed();};parent.append(l,input);return input;
  }
  const bar=(title,...buttons)=>{const b=el('div',undefined,'bar');b.append(el('h2',title),...buttons);return b;};
  function tools(items,index,render) {
    const out=el('div',undefined,'tools');
    const move=offset=>{const n=index+offset;if(n<0||n>=items.length)return;[items[index],items[n]]=[items[n],items[index]];changed();render();};
    const up=button('↑',()=>move(-1)),down=button('↓',()=>move(1));up.disabled=index===0;down.disabled=index===items.length-1;
    out.append(up,down,button('삭제',()=>{items.splice(index,1);changed();render();},'danger'));return out;
  }
  const src=item=>item?.type==='design'?'assets/design/'+item.slot[1]:item?.src;
  function upload(items, render) {uploadTarget={items,render};imageInput.value='';imageInput.click();}
  imageInput.onchange=async()=>{
    const target=uploadTarget;if(!target)return;
    try {
      status.textContent='이미지를 등록하고 있습니다…';
      for(const file of imageInput.files){
        if(!['image/png','image/jpeg','image/webp','image/gif'].includes(file.type))throw Error('PNG, JPG, WebP, GIF 이미지를 선택하세요.');
        if(file.size>25*1024*1024)throw Error('이미지 한 개는 25MB 이하여야 합니다.');
        const url=await new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result);r.onerror=reject;r.readAsDataURL(file);});
        target.items.push({type:'image',src:url,alt:file.name,fit:'cover'});
      }
      changed();target.render();
    }catch(e){status.textContent=e.message;}
  };
  function imageBlock(item,items,index,render) {
    const box=el('div',undefined,'block'),head=el('div',undefined,'block-head');
    head.append(el('span',`${index+1} · ${item.type==='design'?'기존 Figma 커버':'이미지'}`),tools(items,index,render));box.append(head);
    const image=el('img',undefined,'thumb');image.src=src(item);image.alt=item.alt||'';box.append(image);
    if(item.type==='design')box.append(el('p','원본 Figma 크롭과 배치를 유지합니다. 삭제 후 새 이미지를 추가할 수 있습니다.','hint'));
    else {
      field(box,'이미지 설명',item.alt,v=>item.alt=v);
      const label=el('label','이미지 맞춤'),select=el('select');
      for(const [value,text] of [['cover','채우기 (썸네일)'],['contain','전체 보기']]){const o=el('option',text);o.value=value;select.append(o);}select.value=item.fit||'cover';select.onchange=()=>{item.fit=select.value;changed();};box.append(label,select);
    }
    return box;
  }
  function projectEditor(parent) {
    if(!data.projects.length){parent.append(el('div','작업물을 추가해 주세요.','empty'));return;}
    selected=Math.min(selected,data.projects.length-1);const project=data.projects[selected];
    const panel=el('section',undefined,'panel');field(panel,'작업물 제목',project.title,v=>project.title=v);
    const order=el('div',undefined,'bar');order.append(el('span','작업물 순서'),tools(data.projects,selected,render));panel.append(order);
    panel.append(bar('썸네일 슬라이드',button('사진 등록',()=>upload(project.thumbnails,render))));
    panel.append(el('p','갤러리에서 3초 간격으로 바뀌는 이미지입니다. 상세 내용과 별도로 저장됩니다.','hint'));
    project.thumbnails.forEach((item,i)=>panel.append(imageBlock(item,project.thumbnails,i,render)));
    if(!project.thumbnails.length)panel.append(el('p','썸네일 사진을 1장 이상 등록해 주세요.','empty'));
    panel.append(bar('팝업 상세 내용',button('+ 사진',()=>upload(project.blocks,render)),button('+ 텍스트박스',()=>{project.blocks.push({type:'text',text:'',size:18,align:'left',url:''});changed();render();})));
    panel.append(el('p','위에서 아래 순서로 표시됩니다. 이미지와 텍스트박스를 자유롭게 배치하세요.','hint'));
    project.blocks.forEach((item,i)=>{
      if(item.type!=='text'){panel.append(imageBlock(item,project.blocks,i,render));return;}
      const box=el('div',undefined,'block'),head=el('div',undefined,'block-head');head.append(el('span',`${i+1} · 텍스트박스`),tools(project.blocks,i,render));box.append(head);
      field(box,'내용 (줄바꿈 가능)',item.text,v=>item.text=v,'textarea');
      const row=el('div',undefined,'row'),left=el('div'),right=el('div');field(left,'글자 크기 (px)',item.size||18,v=>item.size=Number(v),'number');
      const label=el('label','정렬'),select=el('select');for(const [value,text]of [['left','왼쪽'],['center','중앙'],['right','오른쪽']]){const o=el('option',text);o.value=value;select.append(o);}select.value=item.align||'left';select.onchange=()=>{item.align=select.value;changed();};right.append(label,select);row.append(left,right);box.append(row);
      field(box,'링크 (선택)',item.url,v=>item.url=v);panel.append(box);
    });parent.append(panel);
  }
  function renderProjects() {
    editor.append(el('h1','작업물 관리'),el('p','사진과 이야기를 각각 편집하세요.','sub'));
    editor.append(bar(`${data.projects.length} PROJECTS`,button('+ 작업물 추가',()=>{data.projects.push({id:crypto.randomUUID(),title:'새 작업물',thumbnails:[],blocks:[]});selected=data.projects.length-1;changed();render();},'primary')));
    const layout=el('div',undefined,'project-layout'),list=el('div',undefined,'project-list'),detail=el('div');
    data.projects.forEach((p,i)=>{const b=button('',()=>{selected=i;render();},'project-pick'+(i===selected?' active':''));if(p.thumbnails.length){const img=el('img');img.src=src(p.thumbnails[0]);img.alt='';b.append(img);}b.append(el('span',p.title));list.append(b);});
    projectEditor(detail);layout.append(list,detail);editor.append(layout);
  }
  function renderAbout() {
    editor.append(el('h1','About 편집'),el('p','소개와 경력, 수상, 전시를 텍스트박스로 관리합니다.','sub'));
    const bio=el('section',undefined,'panel');field(bio,'소개 글',data.biography,v=>data.biography=v,'textarea');editor.append(bio);
    editor.append(bar('오른쪽 정보 영역',button('+ 섹션 추가',()=>{data.sections.push({title:'새 섹션',items:[]});changed();render();})));
    data.sections.forEach((section,i)=>{
      const box=el('section',undefined,'panel'),head=el('div',undefined,'block-head');head.append(el('h2',section.title),tools(data.sections,i,render));box.append(head);
      field(box,'섹션 제목',section.title,v=>section.title=v);
      section.items.forEach((item,j)=>{const block=el('div',undefined,'block'),h=el('div',undefined,'block-head');h.append(el('span',`텍스트박스 ${j+1}`),tools(section.items,j,render));block.append(h);field(block,'내용 (줄바꿈 가능)',item.text,v=>item.text=v,'textarea');field(block,'링크 (선택)',item.url,v=>item.url=v);box.append(block);});
      box.append(button('+ 텍스트박스 추가',()=>{section.items.push({text:'',url:''});changed();render();}));editor.append(box);
    });
  }
  function renderContacts() {
    editor.append(el('h1','Contact 편집'),el('p','각 줄의 내용과 링크를 설정하세요. 링크를 비우면 클릭되지 않는 일반 텍스트로 표시됩니다.','sub'));
    const box=el('section',undefined,'panel');
    data.contacts.forEach((item,i)=>{const block=el('div',undefined,'block'),h=el('div',undefined,'block-head');h.append(el('span',`${i+1}번째 줄`),tools(data.contacts,i,render));block.append(h);field(block,'표시할 내용',item.text,v=>item.text=v);field(block,'링크 (https://, mailto:, tel:)',item.url,v=>item.url=v);box.append(block);});
    box.append(button('+ 한 줄 추가',()=>{data.contacts.push({text:'',url:''});changed();render();}));editor.append(box);
  }
  function download(name,type,value) {const url=URL.createObjectURL(new Blob([value],{type})),a=el('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
  function renderSettings() {
    editor.append(el('h1','메인 · 백업'),el('p','변경한 전체 콘텐츠와 업로드 이미지를 백업할 수 있습니다.','sub'));
    const box=el('section',undefined,'panel');field(box,'메인 문구',data.intro,v=>data.intro=v);field(box,'저작권 문구',data.copyright,v=>data.copyright=v);editor.append(box);
    const backup=el('section',undefined,'panel');backup.append(el('h2','콘텐츠 백업'));
    backup.append(el('p','백업 파일에는 모든 텍스트와 이미지 참조가 포함됩니다. 온라인 사진 원본은 R2에 보관됩니다. 가져오기는 편집 화면에만 적용되며, 웹에 저장을 눌러야 웹에 반영됩니다.','hint'));
    const actions=el('div',undefined,'backup');actions.append(button('JSON 백업 다운로드',()=>download('portfolio-content.json','application/json',JSON.stringify(data,null,2))),button('JSON 백업 가져오기',()=>document.querySelector('#import-input').click()),button('웹 콘텐츠 파일 다운로드',()=>download('site-content.js','text/javascript','window.SITE_CONTENT = '+JSON.stringify(data,null,2)+';\n')));backup.append(actions);editor.append(backup);
  }
  function render() {
    editor.replaceChildren();document.querySelectorAll('[data-tab]').forEach(b=>b.classList.toggle('selected',b.dataset.tab===tab));
    ({projects:renderProjects,about:renderAbout,contacts:renderContacts,settings:renderSettings})[tab]();
  }
  document.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>{tab=b.dataset.tab;render();});
  document.querySelector('#import-input').onchange=async event=>{
    try{const file=event.target.files[0];if(!file)return;const next=JSON.parse(await file.text());validate(next);data=next;selected=0;changed();render();}catch(e){status.textContent='가져오기 실패: '+e.message;}event.target.value='';
  };
  function validate(value) {
    if(value.version!==1||!Array.isArray(value.projects)||!Array.isArray(value.contacts)||!Array.isArray(value.sections))throw Error('올바른 백업 파일이 아닙니다.');
    const safeURL=url=>!url||/^(https?:\/\/|mailto:|tel:)/i.test(url);
    value.projects.forEach(p=>{if(!p.title?.trim())throw Error('작업물 제목을 입력하세요.');if(!Array.isArray(p.thumbnails)||!p.thumbnails.length)throw Error(p.title+': 썸네일을 등록하세요.');if(!Array.isArray(p.blocks)||!p.blocks.length)throw Error(p.title+': 상세 사진 또는 텍스트를 추가하세요.');[...p.thumbnails,...p.blocks].forEach(item=>{if(!['image','design','text'].includes(item.type))throw Error('지원하지 않는 블록입니다.');if(item.type==='image'&&!/^(assets\/|\/media\/[a-f0-9]{64}\.(png|jpg|webp|gif)$|data:image\/(png|jpeg|webp|gif);base64,)/.test(item.src))throw Error('올바른 이미지가 아닙니다.');if(!safeURL(item.url))throw Error('링크는 https://, mailto:, tel: 형식으로 입력하세요.');});});
    [...value.contacts,...value.sections.flatMap(s=>s.items)].forEach(item=>{if(typeof item.text!=='string'||!safeURL(item.url))throw Error('텍스트와 링크를 확인하세요.');});
  }
  async function uploadInlineImages(snapshot) {
    const cache = new Map();
    for (const project of snapshot.projects) for (const item of [...project.thumbnails, ...project.blocks]) {
      if (item.type !== 'image' || !item.src.startsWith('data:')) continue;
      const source = item.src;
      if (!cache.has(source)) {
        status.textContent = `사진 업로드 중… ${cache.size + 1}`;
        const blob = await (await fetch(source)).blob();
        const response = await fetch('/api/upload', {method:'POST', headers:{'Content-Type':blob.type,'X-Editor-Token':token}, body:blob});
        const result = await response.json();
        if (!response.ok) throw Error(result.error || '사진 업로드 실패');
        cache.set(source, result.src);
      }
      item.src = cache.get(source);
    }
  }
  document.querySelector('#save').onclick=async()=>{
    const b=document.querySelector('#save');
    if(saving)return;
    try {
      validate(data);
      if(!token)throw Error('로그인 상태를 확인하고 관리 페이지를 다시 열어주세요.');
      saving=true;b.disabled=true;document.querySelector('.shell').inert=true;
      const snapshot=structuredClone(data);
      if(online)await uploadInlineImages(snapshot);
      status.textContent='웹에 저장 중…';
      const response=await fetch('/api/content',{method:'POST',headers:{'Content-Type':'application/json','X-Editor-Token':token,...(online?{'X-Content-Revision':revision}:{})},body:JSON.stringify(snapshot)});
      const result=await response.json();if(!response.ok)throw Error(result.error);
      data=snapshot;revision=result.revision||'';dirty=false;render();
      if(online){status.textContent='게시했습니다. 공개 웹에 바로 반영됩니다.';try{new BroadcastChannel('portfolio-published').postMessage('published');}catch{}}
      else status.textContent='저장했습니다. 웹을 새로고침하세요.';
    } catch(e){status.textContent='저장 실패: '+e.message;}
    finally{saving=false;b.disabled=false;document.querySelector('.shell').inert=false;}
  };
  window.addEventListener('beforeunload',e=>{if(dirty||saving){e.preventDefault();e.returnValue='';}});
  document.querySelector('#logout').onclick=async()=>{
    if(dirty&&!confirm('저장하지 않은 변경사항이 있습니다. 로그아웃할까요?'))return;
    const response=await fetch('/api/logout',{method:'POST',headers:{'X-Editor-Token':token}});
    if(response.ok){dirty=false;location.replace('/login');}else status.textContent='로그아웃하지 못했습니다. 다시 시도하세요.';
  };
  async function boot() {
    document.querySelector('#save').disabled=true;
    try {
      const response=await fetch('/api/session',{cache:'no-store'}),session=await response.json();
      if(response.status===401&&session.authenticated===false){location.replace('/login');return;}
      if(!response.ok)throw Error(session.error||'연결 실패');
      token=session.token;online=session.mode==='online';
      if(online){
        const result=await fetch('/api/content',{cache:'no-store'});const saved=await result.json();if(!result.ok)throw Error(saved.error);
        if(saved.content)data=saved.content;revision=saved.revision||'';
        document.querySelector('.storage-note').textContent='사진과 글을 편집한 뒤 웹에 저장을 누르면 공개 사이트에 반영됩니다.';
        document.querySelector('#logout').hidden=false;
      }
      status.textContent=online?'로그인됨 · 온라인 저장소 연결 완료':'연결됨 · 로컬 파일에 저장합니다.';
      render();document.querySelector('#save').disabled=false;
    } catch(e) {status.textContent=e.message+' · 온라인 관리 페이지는 /admin에서 열어주세요.';}
  }
  render();boot();
})();
