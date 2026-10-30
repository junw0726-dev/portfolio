(() => {
  const frame=document.querySelector('#preview'),size=document.querySelector('#size'),page=document.querySelector('#page');let rotated=false;
  function resize(){let [w,h]=size.value.split(',').map(Number);if(rotated)[w,h]=[h,w];frame.style.width=w+'px';frame.style.height=h+'px';document.querySelector('.phone').style.maxWidth='100%';if(innerWidth<480){frame.style.width=Math.min(w,innerWidth)+'px';}}
  size.onchange=resize;document.querySelector('#rotate').onclick=()=>{rotated=!rotated;resize();};page.onchange=()=>frame.src=page.value;
  document.querySelector('#refresh').onclick=()=>{try{frame.contentWindow.location.reload();}catch{frame.src=page.value;}};window.addEventListener('resize',resize);resize();
})();
