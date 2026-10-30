(() => {
  const form=document.querySelector('#login-form'),status=document.querySelector('#login-status');
  form.onsubmit=async event=>{
    event.preventDefault();const button=form.querySelector('button');button.disabled=true;status.textContent='로그인 중…';
    try{const response=await fetch('/api/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({password:document.querySelector('#password').value})});const data=await response.json();if(!response.ok)throw Error(data.error);location.replace('/admin');}
    catch(e){status.textContent=e.message;}finally{button.disabled=false;}
  };
})();
