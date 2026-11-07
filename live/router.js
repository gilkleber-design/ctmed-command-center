(function(){'use strict';
const params=new URLSearchParams(location.search);
const view=params.get('view')||'maestro';
if(view==='publico'||view==='aluno'){
  const s=document.createElement('script');s.src='./cloud.js';document.head.appendChild(s);
}else if(view==='editor'){
  location.replace('./revisao.html');
}else{
  params.set('view',['maestro','gil','diego','tecnica'].includes(view)?view:'maestro');
  location.replace('./maestro.html?'+params.toString());
}
})();