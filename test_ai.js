// Proof test v3: checklist + open-model AI chat + security fixes
const { JSDOM } = require('jsdom');
const fs = require('fs');
const html = fs.readFileSync('./index.html','utf8');
let pass=0, fail=0;
const ok=(c,n)=>{ c?(pass++,console.log('  PASS '+n)):(fail++,console.log('  FAIL: '+n)); };
function makeDom(seed){
  return new JSDOM(html,{url:'http://localhost/',runScripts:'dangerously',beforeParse(w){
    w.confirm=()=>true;
    if(seed) for(const [k,v] of Object.entries(seed)) w.localStorage.setItem(k,v);
  }});
}
function submit(doc, formId, values){
  for(const [id,v] of Object.entries(values)) doc.getElementById(id).value=v;
  doc.getElementById(formId).dispatchEvent(new (doc.defaultView.Event)('submit',{bubbles:true,cancelable:true}));
}
(async()=>{
  const dom=makeDom(); const doc=dom.window.document;
  const sleep=ms=>new Promise(r=>setTimeout(r,ms));

  console.log('== 1. Core regression ==');
  submit(doc,'taskForm',{taskTitle:'Write Q3 report',taskCat:'work',taskPri:'high'});
  submit(doc,'taskForm',{taskTitle:'Call supplier',taskCat:'work',taskPri:'low'});
  submit(doc,'taskForm',{taskTitle:'Prep demo',taskCat:'sales',taskPri:'med'});
  submit(doc,'salesForm',{salesType:'closed',salesClient:'Acme',salesAmount:'4500'});
  submit(doc,'salesForm',{salesType:'lost',salesClient:'Beta'});
  ok(doc.querySelectorAll('#taskList li').length===3,'3 tasks added');
  ok(doc.getElementById('dSales').textContent==='50%','sales efficiency 50%');
  ok(doc.querySelectorAll('#dashChecklist li input[type=checkbox]').length===3,'dashboard checklist populated');

  console.log('== 2. Security hardening ==');
  submit(doc,'taskForm',{taskTitle:'<img src=x onerror=alert(1)>',taskCat:'work',taskPri:'med'});
  ok(!doc.querySelector('#taskList img'),'XSS in titles escaped');
  // corrupted cfg must not crash rendering
  dom.window.localStorage.setItem('eff_cfg','{{{not json');
  let crashed=false;
  try{ dom.window.eval('updateSyncStatus(); renderAll();'); }catch(e){ crashed=true; }
  ok(!crashed,'corrupted config does not crash app');
  dom.window.localStorage.setItem('eff_cfg', JSON.stringify({url:'not a url'}));
  try{ dom.window.eval('updateSyncStatus()'); crashed=false; }catch(e){ crashed=true; }
  ok(!crashed && doc.getElementById('syncStatus').textContent.includes('Local only'),'malformed Supabase URL handled');
  // AI tool input validation + attribute-injection defense
  let out = dom.window.eval(`runTool('add_task',{title:'Injected', priority:'x" onmouseover="alert(1)', category:'"><script>x</script>'})`);
  ok(out.includes('Task added'),'add_task accepts but sanitizes bad enums');
  const inj = [...doc.querySelectorAll('#taskList li')].find(li=>li.textContent.includes('Injected'));
  ok(inj && inj.querySelector('.tag.work') && inj.querySelector('.tag.med') && !doc.querySelector('#taskList [onmouseover]'),'class attribute injection neutralized (falls back to work/med)');
  ok(dom.window.eval(`runTool('add_deadline',{title:'X',due:'tomorrow'})`).includes('ERROR'),'add_deadline rejects bad date');
  ok(dom.window.eval(`runTool('add_meeting',{title:'X',when:'not-a-date'})`).includes('ERROR'),'add_meeting rejects bad datetime');
  ok(dom.window.eval(`runTool('log_sale',{type:'bribe'})`).includes('ERROR'),'log_sale rejects invalid type');
  ok(dom.window.eval(`runTool('delete_item',{table:'users;drop',title:'x'})`).includes('ERROR'),'delete_item rejects unknown table');

  console.log('== 3. Open-model AI chat (OpenAI-compatible) ==');
  async function sendChat(text){
    doc.getElementById('chatInput').value=text;
    doc.getElementById('chatForm').dispatchEvent(new (dom.window.Event)('submit',{bubbles:true,cancelable:true}));
    for(let i=0;i<150&&doc.getElementById('chatSend').disabled;i++) await sleep(20);
    await sleep(30);
  }
  const bubbles=()=>[...doc.querySelectorAll('#chatLog .msg')];
  dom.window.localStorage.setItem('eff_cfg','{}');
  await sendChat('hello');
  ok(bubbles().some(b=>b.className.includes('ai')&&b.textContent.includes('API key')),'missing key -> clear error');

  dom.window.localStorage.setItem('eff_cfg', JSON.stringify({aiProvider:'groq',aiKey:'gsk_test'}));
  let calls=[];
  dom.window.fetch=async(url,opts)=>{
    if(!String(url).includes('api.groq.com/openai/v1/chat/completions')) throw new Error('unexpected url '+url);
    ok(opts.headers['Authorization']==='Bearer gsk_test'||calls.length>0,'Bearer auth header sent');
    calls.push(JSON.parse(opts.body));
    const payload = calls.length===1
      ? {choices:[{message:{role:'assistant',content:'On it.',tool_calls:[{id:'c1',type:'function',function:{name:'add_task',arguments:'{"title":"Email the board","priority":"high","category":"work"}'}}]}}]}
      : {choices:[{message:{role:'assistant',content:'Done - Email the board is on your list.'}}]};
    return {ok:true,status:200,json:async()=>payload,text:async()=>''};
  };
  await sendChat('add a high priority task to email the board');
  ok(calls.length===2,'agent loop: 2 calls (tool then final)');
  ok(calls[0].model==='llama-3.3-70b-versatile','default open model used (Llama 3.3 70B)');
  ok(calls[0].messages[0].role==='system'&&calls[0].messages[0].content.includes('efficiency tracker'),'system prompt first');
  ok(calls[0].tools.length===7&&calls[0].tools[0].type==='function','7 tools in OpenAI format');
  const last=calls[1].messages[calls[1].messages.length-1];
  ok(last.role==='tool'&&last.tool_call_id==='c1'&&last.content.includes('Email the board'),'tool result sent back in OpenAI format');
  ok(doc.querySelector('#taskList').textContent.includes('Email the board'),'AI-added task in list');
  ok(bubbles().some(b=>b.className.includes('action')&&b.textContent.includes('Task added')),'action bubble shown');
  ok(bubbles().some(b=>b.textContent.includes('Done - Email the board')),'final reply rendered');

  console.log('== 4. get_data + parallel tools ==');
  calls=[];
  dom.window.fetch=async(url,opts)=>{
    calls.push(JSON.parse(opts.body));
    const payload = calls.length===1
      ? {choices:[{message:{role:'assistant',content:null,tool_calls:[
          {id:'c2',type:'function',function:{name:'get_data',arguments:'{}'}},
          {id:'c3',type:'function',function:{name:'complete_task',arguments:'{"title":"email the board"}'}}]}}]}
      : {choices:[{message:{role:'assistant',content:'You are at 50% sales efficiency; board email done.'}}]};
    return {ok:true,status:200,json:async()=>payload,text:async()=>''};
  };
  await sendChat('how am I doing? also finish the board email');
  const msgs4=calls[1].messages; const lastU=msgs4.map(m=>m.role).lastIndexOf('user');
  const toolMsgs=msgs4.slice(lastU+1).filter(m=>m.role==='tool');
  ok(toolMsgs.length===2,'parallel tool calls both answered');
  ok(toolMsgs.some(m=>m.content.includes('open_tasks')&&m.content.includes('sales_efficiency_7d')),'get_data snapshot returned');
  ok(doc.querySelector('#taskDoneList').textContent.includes('Email the board'),'fuzzy complete works');

  console.log('== 5. API error rollback ==');
  const histBefore=dom.window.eval('chatHistory.length');
  dom.window.fetch=async()=>({ok:false,status:401,text:async()=>'invalid key',json:async()=>null});
  await sendChat('this will fail');
  ok(bubbles().some(b=>b.textContent.includes('401')),'API error surfaced');
  ok(dom.window.eval('chatHistory.length')===histBefore,'history rolled back after failure');

  console.log('== 6. Provider switching ==');
  doc.getElementById('aiProvider').value='openrouter';
  doc.getElementById('aiProvider').dispatchEvent(new (dom.window.Event)('change',{bubbles:true}));
  ok(doc.getElementById('aiModel').value.includes('llama'),'provider switch sets default open model');
  dom.window.localStorage.setItem('eff_cfg', JSON.stringify({aiProvider:'custom',aiBase:'http://localhost:11434/v1',aiModel:'llama3.2'}));
  let customUrl='';
  dom.window.fetch=async(url,opts)=>{ customUrl=String(url); return {ok:true,status:200,json:async()=>({choices:[{message:{role:'assistant',content:'hi from ollama'}}]}),text:async()=>''}; };
  await sendChat('hi');
  ok(customUrl==='http://localhost:11434/v1/chat/completions','custom/Ollama endpoint used without key');
  ok(bubbles().some(b=>b.textContent.includes('hi from ollama')),'local model reply rendered');

  console.log('== 7. Card navigation regression ==');
  const click=el=>el.dispatchEvent(new dom.window.MouseEvent('click',{bubbles:true}));
  click(doc.querySelector('nav button[data-tab="dashboard"]'));
  click(doc.querySelector('.card[data-goto="tasks"]'));
  ok(doc.querySelector('.tab.active').id==='tab-tasks','Work Efficiency card -> Tasks');
  click(doc.querySelector('nav button[data-tab="dashboard"]'));
  click(doc.querySelector('.card[data-goto="sales"]'));
  ok(doc.querySelector('.tab.active').id==='tab-sales','Sales card -> Sales');

  console.log('== 8. Accounts (Supabase Auth) ==');
  // sync blocked when logged out
  dom.window.fetch = async()=>{ throw new Error('no network calls expected'); };
  await dom.window.eval('syncNow()');
  ok(doc.getElementById('toast').textContent.includes('Sign in first'),'sync blocked until signed in');

  // signup -> session saved, sync uses Bearer token
  const reqs = [];
  dom.window.fetch = async(url,opts)=>{
    reqs.push({url:String(url), headers:(opts&&opts.headers)||{}, body:(opts&&opts.body)||null});
    if(String(url).includes('/auth/v1/signup'))
      return {ok:true,status:200,json:async()=>({access_token:'AT1',refresh_token:'RT1',expires_in:3600,user:{id:'u1',email:'basil@test.com'}})};
    if(String(url).includes('/rest/v1/'))
      return {ok:true,status:opts.method==='GET'?200:204,json:async()=>[],text:async()=>''};
    return {ok:true,status:200,json:async()=>({})};
  };
  doc.getElementById('authEmail').value='basil@test.com';
  doc.getElementById('authPass').value='secret123';
  doc.getElementById('btnSignup').dispatchEvent(new dom.window.MouseEvent('click',{bubbles:true}));
  await sleep(300);
  ok(reqs.some(r=>r.url.includes('/auth/v1/signup')&&r.body.includes('basil@test.com')),'signup request sent');
  ok(JSON.parse(dom.window.localStorage.getItem('eff_session')).access_token==='AT1','session stored');
  ok(doc.getElementById('authStatus').textContent.includes('basil@test.com'),'UI shows signed-in email');
  ok(doc.getElementById('syncStatus').textContent.includes('basil@test.com'),'header shows cloud account');
  const rest = reqs.find(r=>r.url.includes('/rest/v1/'));
  ok(rest && rest.headers['Authorization']==='Bearer AT1','sync authenticates with user token (not anon key)');

  // expired token -> refresh flow
  const sess = JSON.parse(dom.window.localStorage.getItem('eff_session'));
  sess.expires_at = Date.now()-1000;
  dom.window.localStorage.setItem('eff_session', JSON.stringify(sess));
  reqs.length = 0;
  dom.window.fetch = async(url,opts)=>{
    reqs.push({url:String(url), headers:(opts&&opts.headers)||{}});
    if(String(url).includes('grant_type=refresh_token'))
      return {ok:true,status:200,json:async()=>({access_token:'AT2',refresh_token:'RT2',expires_in:3600,user:{id:'u1',email:'basil@test.com'}})};
    if(String(url).includes('/rest/v1/'))
      return {ok:true,status:opts.method==='GET'?200:204,json:async()=>[],text:async()=>''};
    return {ok:true,status:200,json:async()=>({})};
  };
  await dom.window.eval('syncNow()');
  ok(reqs.some(r=>r.url.includes('grant_type=refresh_token')),'expired session triggers refresh');
  const rest2 = reqs.filter(r=>r.url.includes('/rest/v1/'));
  ok(rest2.length && rest2.every(r=>r.headers['Authorization']==='Bearer AT2'),'refreshed token used for sync');

  // logout clears session
  doc.getElementById('btnLogout').dispatchEvent(new dom.window.MouseEvent('click',{bubbles:true}));
  await sleep(150);
  ok(!dom.window.localStorage.getItem('eff_session'),'logout clears session');
  ok(doc.getElementById('authStatus').textContent.includes('Not signed in'),'UI back to logged out');

  console.log(`\n===== RESULT: ${pass} passed, ${fail} failed =====`);
  process.exit(fail?1:0);
})().catch(e=>{console.error('Test crashed:',e);process.exit(1);});
