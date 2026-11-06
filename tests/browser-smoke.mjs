import { spawn } from 'node:child_process';
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

const artifacts = resolve('artifacts');
await mkdir(artifacts, { recursive: true });
if (typeof WebSocket === 'undefined') throw new Error('Browser checks require Node.js 22 or newer.');
const browserPath = process.env.CHROME_PATH || [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser',
].find(existsSync);
if (!browserPath) throw new Error('Set CHROME_PATH to the Chrome or Edge executable.');
const profile = await mkdtemp(resolve(artifacts, 'chrome-'));
let launchError;
const browser = spawn(browserPath, [
  '--headless=new', '--no-sandbox', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
  '--remote-debugging-port=0', `--user-data-dir=${profile}`,
  '--autoplay-policy=no-user-gesture-required', 'about:blank',
], { windowsHide: true, stdio: 'ignore' });
browser.once('error', (error) => { launchError = error; });
const sleep = ms => new Promise(r => setTimeout(r, ms));
let socket;
const errors = [];
const results = [];
try {
  let targets, debugPort;
  for (let i=0;i<80;i++) {
    if (launchError) throw launchError;
    try {
      debugPort = Number((await readFile(resolve(profile, 'DevToolsActivePort'), 'utf8')).split('\n')[0]);
      targets = await (await fetch(`http://127.0.0.1:${debugPort}/json`, { signal: AbortSignal.timeout(1000) })).json();
      if(targets.some((target) => target.type === 'page')) break;
    } catch {}
    await sleep(100);
  }
  if(!targets?.length) throw new Error('Chrome CDP did not become available');
  socket = new WebSocket(targets.find(t=>t.type==='page').webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Chrome connection timed out')), 10000);
    socket.onopen = () => { clearTimeout(timeout); resolve(); };
    socket.onerror = (error) => { clearTimeout(timeout); reject(error); };
  });
  let id=0;
  const pending=new Map();
  socket.onmessage=event=>{
    const message=JSON.parse(event.data);
    if(message.id){const p=pending.get(message.id);pending.delete(message.id);if(p)clearTimeout(p.timeout);message.error?p?.reject(message.error):p?.resolve(message.result);}
    if(message.method==='Runtime.exceptionThrown')errors.push(message.params.exceptionDetails.exception?.description||message.params.exceptionDetails.text);
    if(message.method==='Runtime.consoleAPICalled'&&message.params.type==='error')errors.push(message.params.args.map(a=>a.value||a.description).join(' '));
  };
  socket.onclose=()=>{for(const entry of pending.values()){clearTimeout(entry.timeout);entry.reject(new Error('Chrome connection closed'));}pending.clear();};
  const call=(method,params={})=>new Promise((resolve,reject)=>{const key=++id;const timeout=setTimeout(()=>{pending.delete(key);reject(new Error(`${method} timed out`));},10000);pending.set(key,{resolve,reject,timeout});socket.send(JSON.stringify({id:key,method,params}));});
  const evaluate=async expression=>{
    const result=await call('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true,userGesture:true});
    if(result.exceptionDetails)throw new Error(result.exceptionDetails.exception?.description||result.exceptionDetails.text);
    return result.result.value;
  };
  const check=(name,passed,details)=>{results.push({name,passed,...(details?{details}:{})});console.log(`${passed?'PASS':'FAIL'} ${name}${details?' '+JSON.stringify(details):''}`);};
  const key=async(code,key,type='keyDown')=>call('Input.dispatchKeyEvent',{type,code,key});
  const screenshot=async name=>{const {data}=await call('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});await writeFile(resolve(artifacts,name),Buffer.from(data,'base64'));console.log('SCREENSHOT',name);};
  const navigate = async () => {
    await evaluate('window.nebula?.destroy(); delete window.nebula');
    await call('Page.navigate', { url: 'http://localhost:4173' });
    for (let i=0;i<80;i++) { if (await evaluate("Boolean(window.nebula) && document.readyState !== 'loading'")) return; await sleep(100); }
    throw new Error('Game did not initialize after navigation');
  };
  await call('Page.enable');await call('Runtime.enable');
  await call('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});
  await navigate();
  await sleep(300);
  check('Initial menu and canvas loaded',await evaluate("window.nebula?.state==='menu' && !!document.querySelector('canvas').getContext('2d')"));
  check('Portuguese text encoding',await evaluate("document.title.includes('—') && document.getElementById('overlay-title').textContent.includes('ÓRION')"));
  check('Desktop has no horizontal overflow',await evaluate('document.documentElement.scrollWidth<=innerWidth'));
  await screenshot('desktop.png');
  await evaluate("document.getElementById('help-button').focus();document.getElementById('help-button').click();document.getElementById('manual-done').click()");
  await sleep(50);
  check('Closing manual from menu restores keyboard focus', await evaluate("document.activeElement.id==='help-button' && window.nebula.state==='menu'"));
  await evaluate("document.getElementById('play-button').click()");await sleep(100);
  check('Start button starts mission',await evaluate("window.nebula.state==='playing'"));
  await evaluate('window.nebula.player.invulnerable=999');
  const x=await evaluate('window.nebula.player.x');
  await key('KeyD','d');await sleep(300);await key('KeyD','d','keyUp');
  check('Keyboard movement',await evaluate(`window.nebula.player.x > ${x+30}`));
  await key('KeyD','d');await key('ArrowRight','ArrowRight');await key('KeyD','d','keyUp');
  check('Releasing a movement alias preserves the other held key',await evaluate('window.nebula.input.right'));
  await key('ArrowRight','ArrowRight','keyUp');
  await key('Space',' ');await sleep(300);await key('Space',' ','keyUp');
  check('Held fire emits projectiles',await evaluate('window.nebula.bullets.length>0'));
  await key('Space',' ');await key('KeyZ','z');await key('KeyZ','z','keyUp');
  check('Releasing Z preserves held Space',await evaluate('window.nebula.input.fire'));
  await key('Space',' ','keyUp');
  await key('KeyX','x');await sleep(1600);
  check('Held X charges cannon',await evaluate('window.nebula.player.charge>=.99'));
  await key('KeyX','x','keyUp');await sleep(80);
  check('Released X emits charged projectile',await evaluate('window.nebula.bullets.some(b=>b.charged)'));
  await sleep(1800);await screenshot('gameplay.png');
  await key('KeyP','p');await key('KeyP','p','keyUp');await sleep(80);
  check('P pauses and shows overlay',await evaluate("window.nebula.state==='paused' && !document.getElementById('game-overlay').hidden"));
  const pausedCanvas=await evaluate("document.getElementById('game').toDataURL()");
  await sleep(200);
  check('Paused canvas remains visually unchanged',await evaluate(`document.getElementById('game').toDataURL()===${JSON.stringify(pausedCanvas)}`));
  await evaluate("document.getElementById('play-button').click()");
  check('Resume button continues mission',await evaluate("window.nebula.state==='playing'"));
  await evaluate("document.getElementById('help-button').click()");
  check('Manual pauses active game',await evaluate("window.nebula.state==='paused' && document.getElementById('manual').open"));
  await evaluate("document.getElementById('manual-done').click()");await sleep(80);
  check('Closing manual resumes active game',await evaluate("window.nebula.state==='playing' && !document.getElementById('manual').open"));
  check('Resuming returns keyboard focus to battlefield',await evaluate("document.activeElement.id==='game'"));
  await evaluate(`window.__stops=[];window.__originalStop=OscillatorNode.prototype.stop;OscillatorNode.prototype.stop=function(when){window.__stops.push(when ?? 0);return window.__originalStop.call(this,when);};window.nebula._sound('victory')`);
  const pressed=await evaluate("document.getElementById('sound-button').getAttribute('aria-pressed')");
  await evaluate("document.getElementById('sound-button').click()");
  check('Sound toggle updates accessible state',await evaluate(`document.getElementById('sound-button').getAttribute('aria-pressed')!==${JSON.stringify(pressed)}`));
  check('Muting stops already scheduled audio',await evaluate('window.__stops.filter(time=>time===0).length>=4'));
  await evaluate('OscillatorNode.prototype.stop=window.__originalStop');
  await evaluate("window.dispatchEvent(new Event('blur'))");
  check('Losing focus pauses and clears controls',await evaluate("window.nebula.state==='paused' && Object.values(window.nebula.input).every(value=>!value)"));
  await evaluate("document.getElementById('play-button').click();window.nebula.elapsed=65.99;window.nebula.update(.05);for(let i=0;i<70;i++)window.nebula.update(.05)");
  await sleep(100);
  check('Boss enters the visible battlefield and updates HUD',await evaluate("!!window.nebula.boss && window.nebula.boss.x <= 1114 && !document.getElementById('boss-warning').hidden"));
  await screenshot('boss.png');
  await evaluate('window.nebula.boss.x=1020;window.nebula.boss.hp=1;window.nebula.bullets.push({x:window.nebula.boss.x,y:window.nebula.boss.y,vx:0,vy:0,radius:20,damage:2,life:1});window.nebula.update(.01)');
  check('Victory displays final result and full progress',await evaluate("window.nebula.state==='victory' && !document.getElementById('result-score').hidden && document.getElementById('mission-progress').style.width==='100%'"));
  await evaluate("document.getElementById('play-button').click()");
  await evaluate('window.nebula.player.hp=1;window.nebula.player.invulnerable=0;window.nebula._damagePlayer()');await sleep(80);
  check('Gameover overlay and final score',await evaluate("window.nebula.state==='gameover' && !document.getElementById('result-score').hidden"));
  await evaluate("document.getElementById('play-button').click()");
  check('Restart resets mission',await evaluate("window.nebula.state==='playing' && window.nebula.player.hp===4 && window.nebula.elapsed<1"));

  await call('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
  await call('Emulation.setTouchEmulationEnabled',{enabled:true,maxTouchPoints:5});
  await navigate();
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
  await evaluate('window.nebula.bullets=[];window.nebula.releaseInputs()');
  const chargePosition=await evaluate("(()=>{const r=document.querySelector('[data-action=charge]').getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2,id:7}})()");
  await call('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[chargePosition]});await sleep(500);
  await call('Input.dispatchTouchEvent',{type:'touchCancel',touchPoints:[]});await sleep(50);
  check('Canceled touch charge does not fire a beam',await evaluate('window.nebula.player.charge===0 && !window.nebula.input.charge && !window.nebula.bullets.some(b=>b.charged)'));
  await key('Space',' ');
  await touch('fire',100);
  check('Releasing touch fire preserves held keyboard fire',await evaluate('window.nebula.input.fire'));
  await key('Space',' ','keyUp');
  await screenshot('mobile-gameplay.png');
  await call('Emulation.setDeviceMetricsOverride',{width:320,height:568,deviceScaleFactor:1,mobile:true});
  check('Small phone has no horizontal overflow',await evaluate('document.documentElement.scrollWidth<=innerWidth'),await evaluate('({scroll:document.documentElement.scrollWidth,width:innerWidth})'));
  await call('Emulation.setDeviceMetricsOverride',{width:500,height:320,deviceScaleFactor:1,mobile:true});
  await evaluate("document.getElementById('arcade').requestFullscreen=undefined;document.getElementById('fullscreen-button').click();window.nebula.pause()");
  await sleep(100);
  check('Short landscape fullscreen fits pause controls',await evaluate("(()=>{const ids=['play-button','restart-button'];return ids.every(id=>{const r=document.getElementById(id).getBoundingClientRect();return r.top>=0&&r.bottom<=innerHeight})})()"));
  check('Short landscape fullscreen keeps HUD and exit button visible',await evaluate("(()=>{const ids=['fullscreen-button','pause-button'];return ids.every(id=>{const r=document.getElementById(id).getBoundingClientRect();return r.top>=0&&r.bottom<=innerHeight&&r.left>=0&&r.right<=innerWidth})})()"));
  check('Short landscape fullscreen keeps weapon bar visible',await evaluate("(()=>{const r=document.querySelector('.flight-bar').getBoundingClientRect();return r.top>=0&&r.bottom<=innerHeight})()"));
  await screenshot('landscape.png');
  await evaluate("document.getElementById('fullscreen-button').click()");
  check('Fullscreen fallback can be exited',await evaluate("!document.getElementById('arcade').classList.contains('expanded') && !document.fullscreenElement"));
  check('No browser errors',errors.length===0,errors);
  await writeFile(resolve(artifacts,'browser-results.json'),JSON.stringify({results,errors},null,2));
  if(results.some(r=>!r.passed))process.exitCode=1;
  await call('Browser.close').catch(()=>{});
} finally {
  socket?.close();browser.kill();
}
