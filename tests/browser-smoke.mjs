import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const artifacts = resolve('artifacts');
await mkdir(artifacts, { recursive: true });
const browser = spawn('C:/Program Files/Google/Chrome/Application/chrome.exe', [
  '--headless=new', '--no-sandbox', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
  '--remote-debugging-port=9223', `--user-data-dir=${resolve(artifacts, 'chrome-profile')}`,
  '--remote-allow-origins=*', '--autoplay-policy=no-user-gesture-required', 'about:blank',
], { windowsHide: true, stdio: 'ignore' });
const sleep = ms => new Promise(r => setTimeout(r, ms));
let socket;
const errors = [];
const results = [];
try {
  let targets;
  for (let i=0;i<80;i++) {
    try { targets = await (await fetch('http://127.0.0.1:9223/json')).json(); if(targets.length) break; } catch {}
    await sleep(100);
  }
  if(!targets?.length) throw new Error('Chrome CDP did not become available');
  socket = new WebSocket(targets.find(t=>t.type==='page').webSocketDebuggerUrl);
  await new Promise((r,j)=>{socket.onopen=r;socket.onerror=j;});
  let id=0;
  const pending=new Map();
  socket.onmessage=event=>{
    const message=JSON.parse(event.data);
    if(message.id){const p=pending.get(message.id);pending.delete(message.id);message.error?p?.reject(message.error):p?.resolve(message.result);}
    if(message.method==='Runtime.exceptionThrown')errors.push(message.params.exceptionDetails.exception?.description||message.params.exceptionDetails.text);
    if(message.method==='Runtime.consoleAPICalled'&&message.params.type==='error')errors.push(message.params.args.map(a=>a.value||a.description).join(' '));
  };
  const call=(method,params={})=>new Promise((resolve,reject)=>{const key=++id;pending.set(key,{resolve,reject});socket.send(JSON.stringify({id:key,method,params}));});
  const evaluate=async expression=>{
    const result=await call('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true,userGesture:true});
    if(result.exceptionDetails)throw new Error(result.exceptionDetails.exception?.description||result.exceptionDetails.text);
    return result.result.value;
  };
  const check=(name,passed,details)=>{results.push({name,passed,...(details?{details}:{})});console.log(`${passed?'PASS':'FAIL'} ${name}${details?' '+JSON.stringify(details):''}`);};
  const key=async(code,key,type='keyDown')=>call('Input.dispatchKeyEvent',{type,code,key});
  const screenshot=async name=>{const {data}=await call('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});await writeFile(resolve(artifacts,name),Buffer.from(data,'base64'));console.log('SCREENSHOT',name);};
  await call('Page.enable');await call('Runtime.enable');
  await call('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});
  await call('Page.navigate',{url:'http://localhost:4173'});
  for(let i=0;i<80;i++){if(await evaluate('Boolean(window.nebula)'))break;await sleep(100);}
  await sleep(300);
  check('Initial menu and canvas loaded',await evaluate("window.nebula?.state==='menu' && !!document.querySelector('canvas').getContext('2d')"));
  check('Portuguese text encoding',await evaluate("document.title.includes('—') && document.getElementById('overlay-title').textContent.includes('ÓRION')"));
  check('Desktop has no horizontal overflow',await evaluate('document.documentElement.scrollWidth<=innerWidth'));
  await screenshot('desktop.png');
  await evaluate("document.getElementById('play-button').click()");await sleep(100);
  check('Start button starts mission',await evaluate("window.nebula.state==='playing'"));
  await evaluate('window.nebula.player.invulnerable=999');
  const x=await evaluate('window.nebula.player.x');
  await key('KeyD','d');await sleep(300);await key('KeyD','d','keyUp');
  check('Keyboard movement',await evaluate(`window.nebula.player.x > ${x+30}`));
  await key('Space',' ');await sleep(300);await key('Space',' ','keyUp');
  check('Held fire emits projectiles',await evaluate('window.nebula.bullets.length>0'));
  await key('KeyX','x');await sleep(1600);
  check('Held X charges cannon',await evaluate('window.nebula.player.charge>=.99'));
  await key('KeyX','x','keyUp');await sleep(80);
  check('Released X emits charged projectile',await evaluate('window.nebula.bullets.some(b=>b.charged)'));
  await sleep(1800);await screenshot('gameplay.png');
  await key('KeyP','p');await key('KeyP','p','keyUp');await sleep(80);
  check('P pauses and shows overlay',await evaluate("window.nebula.state==='paused' && !document.getElementById('game-overlay').hidden"));
  await evaluate("document.getElementById('play-button').click()");
  check('Resume button continues mission',await evaluate("window.nebula.state==='playing'"));
  await evaluate("document.getElementById('help-button').click()");
  check('Manual pauses active game',await evaluate("window.nebula.state==='paused' && document.getElementById('manual').open"));
  await evaluate("document.getElementById('manual-done').click()");await sleep(80);
  check('Closing manual resumes active game',await evaluate("window.nebula.state==='playing' && !document.getElementById('manual').open"));
  const pressed=await evaluate("document.getElementById('sound-button').getAttribute('aria-pressed')");
  await evaluate("document.getElementById('sound-button').click()");
  check('Sound toggle updates accessible state',await evaluate(`document.getElementById('sound-button').getAttribute('aria-pressed')!==${JSON.stringify(pressed)}`));
  await evaluate('window.nebula.player.hp=1;window.nebula.player.invulnerable=0;window.nebula._damagePlayer()');await sleep(80);
  check('Gameover overlay and final score',await evaluate("window.nebula.state==='gameover' && !document.getElementById('result-score').hidden"));
  await evaluate("document.getElementById('play-button').click()");
  check('Restart resets mission',await evaluate("window.nebula.state==='playing' && window.nebula.player.hp===4 && window.nebula.elapsed<1"));

  await call('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
  await call('Emulation.setTouchEmulationEnabled',{enabled:true,maxTouchPoints:5});
  await call('Page.navigate',{url:'http://localhost:4173'});
  for(let i=0;i<50;i++){if(await evaluate('Boolean(window.nebula)'))break;await sleep(100);}
  await sleep(300);
  check('Mobile has no horizontal overflow',await evaluate('document.documentElement.scrollWidth<=innerWidth'),await evaluate('({scroll:document.documentElement.scrollWidth,width:innerWidth})'));
  await screenshot('mobile.png');
  await evaluate("document.getElementById('play-button').click();window.nebula.player.invulnerable=999");
  const touch=async(action,duration)=>{
    const p=await evaluate(`(()=>{const b=document.querySelector('[data-action="${action}"]');b.scrollIntoView({block:'center'});const r=b.getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2,width:r.width,height:r.height,display:getComputedStyle(b).display}})()`);
    await call('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:p.x,y:p.y,id:1}]});await sleep(duration);
    const during=await evaluate('({x:window.nebula.player.x,y:window.nebula.player.y,charge:window.nebula.player.charge,bullets:window.nebula.bullets.length})');
    await call('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await sleep(50);
    return{p,during};
  };
  for(const action of ['up','down','left','right']){
    const before=await evaluate('({x:window.nebula.player.x,y:window.nebula.player.y})');
    const {p,during}=await touch(action,200);
    const passed=action==='up'?during.y<before.y:action==='down'?during.y>before.y:action==='left'?during.x<before.x:during.x>before.x;
    check(`Mobile touch ${action}`,passed,{before,after:during,rect:p});
  }
  check('Mobile touch fire',(await touch('fire',300)).during.bullets>0);
  check('Mobile touch charge',(await touch('charge',1600)).during.charge>=.99);
  check('Mobile release charge emits beam',await evaluate('window.nebula.bullets.some(b=>b.charged)'));
  await screenshot('mobile-gameplay.png');
  check('No browser errors',errors.length===0,errors);
  await writeFile(resolve(artifacts,'browser-results.json'),JSON.stringify({results,errors},null,2));
  if(results.some(r=>!r.passed))process.exitCode=1;
  await call('Browser.close').catch(()=>{});
} finally {
  socket?.close();browser.kill();
}
