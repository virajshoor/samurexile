/* Shadow of the Exile — canvas action game. All art is drawn locally.
   Coordinates are world pixels. Simulation uses seconds, capped after tab sleeps. */
(() => {
  'use strict';
  const $ = s => document.querySelector(s), canvas = $('#game'), ctx = canvas.getContext('2d');
  const WIDTH = 960, HEIGHT = 540, FLOOR = 438, SAVE = 'samurexile-v2';
  // Ten connected arcs; each contains 50 deterministic encounters.
  const arcs = [
    ['The Broken Seal','Accused of betraying the court, Ren escapes into the bamboo forest. A stolen seal is the only clue to the men who framed him.'],
    ['The Lantern Network','In the occupied villages, Ren meets courier Aki. Her lantern signals reveal a network smuggling families away from the rebels.'],
    ['The River Ledger','A ferryman carries a ledger of grain diverted from the starving provinces. Its entries connect the rebels to the court treasurer.'],
    ['Ashes of the Monastery','A monastery shelters the witnesses who authenticated the false decree. Its surviving abbot remembers the seal was taken by force.'],
    ['The Northern Pass','Ren and Aki escort the witnesses across a mountain pass while a hired captain closes the roads behind them.'],
    ['The House of Masks','In the capital, a mask maker hides the original seal. Her brother forged the copies under threat, leaving a mark on every counterfeit.'],
    ['The Silent Fleet','The treasurer plans to bring soldiers into the capital by river. Ren disrupts the fleet while Aki sends the evidence ahead.'],
    ['The Red Council','The conspirators turn on one another. A captured councilor names their commander and reveals the hour of the coup.'],
    ['The Night of Banners','The court is surrounded. Ren gathers the people he protected and clears a path to the castle before the banners rise.'],
    ['Dawn at the Gate','At the castle, Ren confronts the commander. The witnesses, ledger and original seal bring the truth before the court.']
  ];
  const TOTAL_LEVELS = 500;
  const arcOf = n => Math.floor(n / 50);
  const beatOf = n => Math.floor((n % 50) / 10);
  const beats = ['The first trail leads deeper into hostile territory.', 'A clue passes into the hands of the rebels.', 'Aki finds a route forward, but the enemy has anticipated the move.', 'The evidence is almost secure; the commander sends reinforcements.', 'The arc ends in a confrontation that opens the next road.'];
  const levelTitle = n => `${arcs[arcOf(n)][0]} · ${n % 50 + 1}`;
  const levelStory = n => `${arcs[arcOf(n)][1]} ${beats[beatOf(n)]} ${((n+1)%50===0)?'The enemy captain stands in the way.':''}`;
  // Permanent save contract. Never rename this key or reinterpret level numbers.
  // Add optional fields to schema v1; migrate older formats without deleting them.
  const SAVE_KEY = 'samurexile-save';
  const freshProgress = () => ({schemaVersion:1,currentLevel:1,highestUnlockedLevel:1,completed:false,ultimateUnlocked:false,seenCutscenes:[]});
  function validateProgress(s){
    if(!s || s.schemaVersion!==1 || !Number.isInteger(s.currentLevel) || s.currentLevel<1 || s.currentLevel>500 || !Number.isInteger(s.highestUnlockedLevel) || s.highestUnlockedLevel<s.currentLevel || s.highestUnlockedLevel>500)throw Error('Unsupported or invalid save');
    return {...s,completed:!!s.completed,ultimateUnlocked:!!s.ultimateUnlocked||s.highestUnlockedLevel>=4,seenCutscenes:Array.isArray(s.seenCutscenes)?s.seenCutscenes.filter(n=>Number.isInteger(n)&&n>=1&&n<=500):[]};
  }
  let storageWarning='', protectSave=false;
  function readProgress(){
    try {
      const stable=localStorage.getItem(SAVE_KEY);
      if(stable){const parsed=JSON.parse(stable);if(parsed.schemaVersion!==1){protectSave=true;storageWarning='This save uses a newer format. It has been preserved.';return freshProgress();}return validateProgress(parsed);}
      const old=JSON.parse(localStorage.getItem('samurexile-v2')||'null');
      const first=JSON.parse(localStorage.getItem('shadow-exile-save-v1')||'null');
      const n=old?.chapter??first?.stage;
      if(Number.isInteger(n)&&n>=0&&n<500){const p=freshProgress();p.currentLevel=n+1;p.highestUnlockedLevel=n+1;p.completed=!!(old?.completed||first?.complete);p.ultimateUnlocked=n>=3||p.completed;localStorage.setItem(SAVE_KEY,JSON.stringify(p));return p;}
    }catch{storageWarning='Save unavailable: export a backup before clearing browser data.';}
    return freshProgress();
  }
  let progress=readProgress();
  let checkpoint=progress.currentLevel-1, completed=progress.completed;
  let mode='menu', chapter=checkpoint, player, enemies=[], sparks=[], ghosts=[], wave=0, score=0, combo=0, comboTime=0, clock=0, last=0, shake=0, freeze=0;
  const keys = new Set();
  const touch = matchMedia('(pointer:coarse)').matches || navigator.maxTouchPoints>0;
  document.body.classList.toggle('touch-mode', touch);
  // Save only chapter checkpoints: retries always begin with full health.
  function save(done=false){
    progress={...progress,currentLevel:chapter+1,highestUnlockedLevel:Math.max(progress.highestUnlockedLevel,chapter+1),completed:progress.completed||done,ultimateUnlocked:progress.ultimateUnlocked||chapter>=3||done};
    if(protectSave)return;try{const previous=localStorage.getItem(SAVE_KEY);if(previous)localStorage.setItem(SAVE_KEY+'-backup',previous);localStorage.setItem(SAVE_KEY,JSON.stringify(progress));}catch{storageWarning='Browser storage is unavailable. Export your save.';}
  }
  function show(label,title,body,button){$('#label').textContent=label;$('#title').textContent=title;$('#story').textContent=body;$('#start').textContent=button;$('#overlay').classList.remove('hidden');}
  function menu(){mode='menu';show('SAMUREXILE','SHADOW OF THE EXILE',completed?'The country remembers its guardian. Begin the legend again.':'An exile. A stolen name. A country worth fighting for.',completed?'PLAY AGAIN':checkpoint?'CONTINUE':'DRAW YOUR BLADE');}
  // Each chapter contains three waves. The last wave contains a unique boss.
  function start(n){chapter=n;checkpoint=n;save();wave=0;score=0;combo=0;comboTime=0;freeze=0;shake=0;ultTime=0;film=null;skip.hidden=true;document.body.classList.remove('cinematic');sparks=[];ghosts=[];keys.clear();player={x:160,y:FLOOR,v:0,face:1,hp:8,inv:0,attack:0,cool:0,dash:0,dashCool:0,chain:0,charge:100};nextWave();mode='brief';$('#chapter').textContent=`LEVEL ${n+1} / ${TOTAL_LEVELS}`;show(`${art[arcOf(n)].name.toUpperCase()} · ${n+1}/${TOTAL_LEVELS}`,levelTitle(n).toUpperCase(),levelStory(n),'FIGHT');}
  function nextWave(){wave++;enemies=[];for(let i=0;i<Math.min(6,2+wave+Math.floor(chapter/100));i++){const boss=(chapter+1)%50===0&&wave===3&&i===0;enemies.push({x:i%2?880+i*24:40-i*24,y:FLOOR,hp:boss?16+Math.min(8,arcOf(chapter)):2+Math.min(2,Math.floor(chapter/150)),type:boss?'boss':i%3===0?'spear':'guard',face:1,wind:0,cool:1+i*.25,hit:0,dead:false});} if(wave>1)player.hp=Math.min(8,player.hp+2);}
  // Exactly ten authored interludes. Stable numeric IDs are stored in saves.
  const films=[
    [3,'THE MOON REMEMBERS','Ren: They took my name. They will not take my resolve.','Moonfall unlocked. Hit enemies to restore its charge.'],
    [50,'A LIGHT IN THE DARK','Aki: Follow the lanterns. There are still people who believe you.','Ren accepts the courier’s lantern and follows her to the village.'],
    [100,'THE EMPTY GRANARIES','Aki: The grain was never lost. Someone paid to make it disappear.','The river ledger will name the men who profited.'],
    [150,'INK DOES NOT LIE','Ren: This seal is mine. This order is not.','The ledger leads them to the witnesses at the monastery.'],
    [200,'THE LAST WITNESS','Abbot: I saw who carried the seal away. I will say it before the court.','Ren escorts the witness north while ash settles over the monastery.'],
    [250,'ACROSS THE PASS','Aki: You could leave. No one would blame you.','Ren: There are still people behind us. We keep walking.'],
    [300,'THE FACE BEHIND THE MASK','Mask maker: My brother marked every forgery. Look beneath the crest.','The original seal and the counterfeit mark now tell the same story.'],
    [350,'NO SHIPS AT DAWN','Aki: The fleet cannot reach the capital now.','Ren: Then the council will have to face us themselves.'],
    [400,'THE HOUR OF BETRAYAL','Councilor: At first light, the commander will raise the red banners.','Ren heads for the castle as Aki carries the evidence to the court.'],
    [500,'A NAME RETURNED','Aki: Let the court remember who stood for this country.','With the ledger, the seal and the witnesses, Ren’s name is restored.']
  ];
  let film=null,filmTime=0,ultTime=0,ultHit=false;
  const skip=document.createElement('button');skip.className='small cinema-skip';skip.textContent='SKIP SCENE';skip.hidden=true;document.querySelector('.screen').append(skip);
  function finishLevel(){keys.clear();if(chapter<499){mode='clear';const n=chapter;chapter++;save();chapter=n;show('LEVEL COMPLETE','THE ROAD OPENS',`Level ${chapter+1} cleared. Score: ${score}. Your next level is saved.`,'CONTINUE');}else{mode='ending';completed=true;save(true);show('DAWN / HONOUR RESTORED','THE EXILE RETURNS','The court clears Ren’s name. The guardian of the shadows is welcomed home.','FINISH');}}
  function finishFilm(){if(!film)return;const id=film[0];if(!progress.seenCutscenes.includes(id))progress.seenCutscenes.push(id);film=null;skip.hidden=true;document.body.classList.remove('cinematic');finishLevel();}
  skip.onclick=finishFilm;
  function levelCleared(){if(chapter===2)progress.ultimateUnlocked=true;save();const f=films.find(f=>f[0]===chapter+1);if(f){film=f;filmTime=0;mode='cutscene';keys.clear();$('#overlay').classList.add('hidden');skip.hidden=false;document.body.classList.add('cinematic');}else finishLevel();}
  function ultimate(){if(mode!=='play'||!progress.ultimateUnlocked||player.charge<100||ultTime>0)return;player.charge=0;ultTime=2.2;ultHit=false;player.inv=2.3;player.y=FLOOR;player.v=0;keys.clear();}
  const ultButton=document.createElement('button');ultButton.dataset.key='ultimate';ultButton.textContent='MOONFALL';ultButton.setAttribute('aria-label','Moonfall ultimate');document.querySelector('.act').append(ultButton);
  // Camera-only sword effects: combat damage resolves once at the impact beat.
  function updateUltimate(dt){ultTime=Math.max(0,ultTime-dt);player.inv=Math.max(player.inv,.2);if(ultTime<.95&&!ultHit){ultHit=true;shake=12;enemies.forEach(e=>{if(e.dead)return;e.hp-=e.type==='boss'?8:6;e.hit=.5;burst(e.x,e.y-40,'#f5dba1',18);if(e.hp<=0){e.dead=true;score+=100;}});} }
  function cinematicText(line,y){ctx.textAlign='center';const words=line.split(' ');let row='',lines=[];for(const word of words){if((row+word).length>65){lines.push(row.trim());row='';}row+=word+' ';}lines.push(row.trim());lines.forEach((l,i)=>text(l,480,y+i*24,18));ctx.textAlign='left';}
  function drawFilm(){scenery();const t=filmTime;ctx.save();ctx.translate(480,280);ctx.scale(1.18,1.18);ctx.translate(-480,-280);const ren={x:240+Math.min(100,t*30),y:FLOOR,face:1};fighter(ren,true);if(film[0]!==3){const companion={x:650-Math.min(50,t*15),y:FLOOR,face:-1,type:'guard'};fighter(companion);rect(companion.x-16,FLOOR-48,30,24,'#9b7861');lantern(companion.x-24,FLOOR-42);}if(film[0]===3){ctx.strokeStyle='#e7d19c';ctx.lineWidth=2;ctx.beginPath();ctx.arc(ren.x,FLOOR-38,48+Math.sin(t*2)*8,0,Math.PI*2);ctx.stroke();}ctx.restore();rect(0,0,960,68,'#0e1620');rect(0,428,960,112,'#0e1620');ctx.textAlign='center';text(film[1],480,42,24,'#e4be85');ctx.textAlign='left';cinematicText(t<3.8?film[2]:film[3],461);const fade=t<.5?1-t*2:t>7.5?(t-7.5)*2:0;if(fade>0)rect(0,0,960,540,`rgba(10,17,26,${Math.min(1,fade)})`);}
  function drawUltimate(){const elapsed=2.2-ultTime;rect(0,0,960,540,'#101b2b99');const cx=player.x,cy=player.y-38;ctx.strokeStyle='#f5ddb0';ctx.lineWidth=elapsed<1.25?3:7;ctx.beginPath();const radius=35+elapsed*100;ctx.arc(cx,cy,radius,-2.5,elapsed*5-2.5);ctx.stroke();if(elapsed>.55&&elapsed<1.25){for(let i=0;i<7;i++){const px=(cx+elapsed*850+i*70)%960;fighter({...player,x:px,attack:.1},true,.12+i*.04);}}if(elapsed>=1.25){for(let i=0;i<5;i++){ctx.strokeStyle=i%2?'#e19674':'#ffe9be';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(-100,100+i*74);ctx.lineTo(1060,30+i*74);ctx.stroke();}}rect(0,0,960,50,'#0e1620');ctx.textAlign='center';text('MOONFALL',480,34,25,'#f2d4a0');ctx.textAlign='left';}
  function burst(x,y,color,count=12){for(let i=0;i<count;i++)sparks.push({x,y,vx:(Math.random()-.5)*320,vy:(Math.random()-.8)*250,life:.25+Math.random()*.3,color});}
  // A three-hit chain ends in a wider, heavier strike. Holding slash repeats it.
  function slash(){if(mode!=='play'||player.cool>0||ultTime>0)return;player.chain=(player.chain+1)%3;const heavy=player.chain===0;player.cool=heavy?.34:.21;player.attack=.16;const reach=heavy?115:85;for(const e of enemies){if(e.dead)continue;if(Math.abs(e.x-player.x)<reach&&Math.abs(player.y-e.y)<85&&(e.x-player.x)*player.face>-20){e.hp-=heavy?2:1;e.hit=.2;e.x+=player.face*(e.type==='boss'?10:25);e.wind=0;player.charge=Math.min(100,player.charge+8);combo++;comboTime=2;score+=50;shake=heavy?8:4;freeze=.035;burst(e.x,e.y-40,'#f5cd85');if(e.hp<=0){e.dead=true;score+=100;burst(e.x,e.y-35,'#e37b64',22);}}}}
  function jump(){if(mode==='play'&&ultTime<=0&&player.y>=FLOOR-1)player.v=-510;}
  function dash(){if(mode==='play'&&ultTime<=0&&player.dashCool<=0){player.dash=.16;player.dashCool=.75;player.inv=.23;}}
  const bindings={a:'left',arrowleft:'left',d:'right',arrowright:'right',w:'jump',arrowup:'jump',' ':'jump',j:'attack',k:'attack',shift:'dash',l:'dash',u:'ultimate'};
  function input(key,down){if(down){keys.add(key);if(key==='jump')jump();if(key==='dash')dash();if(key==='attack')slash();if(key==='ultimate')ultimate();}else keys.delete(key);}
  document.addEventListener('keydown',e=>{const k=bindings[e.key.toLowerCase()];if(k){e.preventDefault();if(!e.repeat)input(k,true);}if(e.key==='Escape'&&mode==='play'){mode='pause';keys.clear();show('PAUSED','TAKE A BREATH','Your fight will wait.','RESUME');}});
  document.addEventListener('keyup',e=>input(bindings[e.key.toLowerCase()],false));
  // Pointer capture permits holding movement while another finger attacks.
  const dashButton=document.createElement('button');dashButton.dataset.key='dash';dashButton.textContent='DASH';dashButton.setAttribute('aria-label','Dash');document.querySelector('.act').append(dashButton);
  document.querySelectorAll('[data-key]').forEach(b=>{b.onpointerdown=e=>{e.preventDefault();b.setPointerCapture(e.pointerId);input(b.dataset.key,true);};['pointerup','pointercancel','lostpointercapture'].forEach(type=>b.addEventListener(type,()=>input(b.dataset.key,false)));});
  window.addEventListener('blur',()=>{keys.clear();if(mode==='play'){mode='pause';keys.clear();show('PAUSED','TAKE A BREATH','Your fight will wait.','RESUME');}});
  $('#start').onclick=()=>{if(mode==='menu')start(completed?0:checkpoint);else if(mode==='brief'||mode==='pause'){mode='play';$('#overlay').classList.add('hidden');}else if(mode==='dead')start(chapter);else if(mode==='clear')start(chapter+1);else{completed=true;menu();}};
  $('#restart').onclick=()=>{if(confirm('Restart this chapter?'))start(chapter);};
  $('#toggle').onclick=()=>document.body.classList.toggle('touch-mode');
  // Portable JSON backups use the same public schema as browser saves.
  const saveTools=document.createElement('button');saveTools.className='small';saveTools.textContent='SAVE';document.querySelector('.sidebuttons').append(saveTools);
  const saveDialog=document.createElement('dialog');saveDialog.className='save-dialog';saveDialog.innerHTML='<h2>PROGRESS BACKUP</h2><p>Save a copy before changing browsers or clearing site data.</p><button id="exportSave" class="small">EXPORT JSON</button> <button id="importSave" class="small">IMPORT JSON</button> <button id="closeSave" class="small">CLOSE</button><p id="saveMessage" role="status"></p>';
  document.body.append(saveDialog);
  const fileInput=document.createElement('input');fileInput.type='file';fileInput.accept='.json,application/json';fileInput.hidden=true;document.body.append(fileInput);
  saveTools.onclick=()=>{keys.clear();if(mode==='play'){mode='pause';show('PAUSED','TAKE A BREATH','Your fight will wait.','RESUME');}$('#saveMessage').textContent=storageWarning||`Saved level ${progress.currentLevel} / 500`;saveDialog.showModal();};
  $('#closeSave').onclick=()=>saveDialog.close();
  $('#exportSave').onclick=()=>{const url=URL.createObjectURL(new Blob([JSON.stringify(progress,null,2)],{type:'application/json'}));const link=document.createElement('a');link.href=url;link.download='samurexile-save.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
  $('#importSave').onclick=()=>fileInput.click();
  fileInput.onchange=async()=>{const file=fileInput.files[0];if(!file)return;try{if(file.size>100000)throw Error('Save file too large');const imported=validateProgress(JSON.parse(await file.text()));if(!confirm(`Restore level ${imported.currentLevel}? This replaces the current checkpoint.`))return;const old=localStorage.getItem(SAVE_KEY);if(old)localStorage.setItem(SAVE_KEY+'-backup',old);localStorage.setItem(SAVE_KEY,JSON.stringify(imported));protectSave=false;progress=imported;checkpoint=progress.currentLevel-1;completed=progress.completed;saveDialog.close();film=null;skip.hidden=true;document.body.classList.remove('cinematic');menu();}catch(e){$('#saveMessage').textContent=e.message||'Cannot import this save.';}finally{fileInput.value='';}};
  // Shape helpers keep the visual language consistent across all three biomes.
  function rect(x,y,w,h,c){ctx.fillStyle=c;ctx.fillRect(Math.round(x),Math.round(y),w,h);}
  function poly(points,c){ctx.fillStyle=c;ctx.beginPath();points.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.closePath();ctx.fill();}
  function text(t,x,y,size=18,c='#f3dec0'){ctx.fillStyle=c;ctx.font=`${size}px monospace`;ctx.fillText(t,x,y);}
  function roof(x,y,w){poly([[x-15,y+14],[x+w/2,y-20],[x+w+15,y+14]],'#17222b');rect(x-18,y+13,w+36,5,'#a37c58');}
  function lantern(x,y){ctx.save();ctx.shadowColor='#f09855';ctx.shadowBlur=24;rect(x-7,y,14,22,'#e6a05d');ctx.restore();rect(x-9,y,18,3,'#583a37');rect(x-9,y+20,18,3,'#583a37');rect(x,y+23,2,9,'#dc9767');}
  // One palette and landmark family per story arc. All props sit behind the
  // shared combat plane; scenery never changes collisions or attack ranges.
  const art = [
    {name:'Bamboo refuge',sky:['#121d32','#526579'],ground:'#253039',trim:'#a19678',cloth:'#667c72',motif:'seal'},
    {name:'Lantern village',sky:['#342337','#bb7463'],ground:'#342f38',trim:'#b79b7d',cloth:'#8e6666',motif:'lantern'},
    {name:'Ledger crossing',sky:['#142b40','#779ca2'],ground:'#343c43',trim:'#b2a481',cloth:'#537a87',motif:'ledger'},
    {name:'Ash monastery',sky:['#302737','#9a7a77'],ground:'#38343c',trim:'#b9a28c',cloth:'#877268',motif:'bell'},
    {name:'Northern pass',sky:['#1e304b','#a6b5c1'],ground:'#384b60',trim:'#d5dce0',cloth:'#76869b',motif:'pine'},
    {name:'Mask quarter',sky:['#29213e','#a57689'],ground:'#34313f',trim:'#c2a180',cloth:'#8b678b',motif:'mask'},
    {name:'Silent harbour',sky:['#132536','#526d83'],ground:'#323d46',trim:'#ae9979',cloth:'#51797c',motif:'sail'},
    {name:'Council courtyard',sky:['#322331','#9b6268'],ground:'#3f3841',trim:'#bd9b83',cloth:'#966467',motif:'crest'},
    {name:'Banner siege',sky:['#251f32','#a56e62'],ground:'#393138',trim:'#bd9476',cloth:'#9d5d56',motif:'banner'},
    {name:'Gate at dawn',sky:['#4a3b59','#e6ad83'],ground:'#41404a',trim:'#d7bc8d',cloth:'#9f7653',motif:'sun'}
  ];
  // Deterministic decoration changes within an arc, without randomising combat.
  function sceneSeed(i){return ((chapter+1)*73+i*157)%997;}
  function building(px,y,w=150){rect(px,y,w,FLOOR-y,'#4b3b40');roof(px,y-12,w);for(let j=0;j<3;j++){rect(px+18+j*40,y+24,24,50,'#c48f65');rect(px+28+j*40,y+24,3,50,'#5b4140');}rect(px+w/2-18,y+88,36,64,'#202b34');}
  function banner(px,y,color){rect(px,y,4,FLOOR-y,'#c0a278');poly([[px+4,y+6],[px+36,y+6],[px+32,y+68],[px+4,y+63]],color);rect(px+13,y+19,13,3,'#dbc19a');rect(px+18,y+13,3,18,'#dbc19a');}
  function pine(px,y){rect(px-3,y,7,FLOOR-y,'#36414a');for(let j=0;j<4;j++)poly([[px,y-10+j*29],[px-34-j*5,y+37+j*29],[px+34+j*5,y+37+j*29]],'#2b4952');}
  function boat(px,y,size){poly([[px,y],[px+size,y],[px+size-18,y+22],[px+20,y+22]],'#293743');rect(px+size*.48,y-120,4,120,'#ab997f');poly([[px+size*.48+4,y-117],[px+size*.9,y-83],[px+size*.48+4,y-40]],'#b2a390');}
  function castle(){rect(200,265,560,173,'#3c4048');for(let j=0;j<5;j++)for(let i=0;i<16;i++)rect(200+i*35+(j%2)*12,270+j*33,30,28,'#4e535a');rect(380,220,200,218,'#202b36');roof(360,205,240);roof(390,158,180);roof(420,118,120);rect(430,320,100,118,'#111923');}
  function scenery(){
    const a=arcOf(chapter), palette=art[a], variant=chapter%50;
    const sky=ctx.createLinearGradient(0,0,0,FLOOR);sky.addColorStop(0,palette.sky[0]);sky.addColorStop(1,palette.sky[1]);ctx.fillStyle=sky;ctx.fillRect(0,0,WIDTH,HEIGHT);
    ctx.fillStyle=a===9?'#ffe1ac':'#e6d3a4';ctx.beginPath();ctx.arc(745-variant%5*7,a===9?225:95,47,0,7);ctx.fill();
    for(let layer=0;layer<3;layer++){let pts=[[0,430]];for(let i=0;i<=12;i++)pts.push([i*80,215+layer*53-Math.sin(i*1.7+layer+variant*.08)*45]);pts.push([960,430]);poly(pts,['#344257','#273b4c','#1c303e'][layer]);}
    if(a===0){for(let i=0;i<16;i++){let px=i*68-20+variant%7;rect(px,40+i%3*35,8,400,'#122e31');rect(px+2,40+i%3*35,2,400,'#4b6660');for(let j=0;j<5;j++){rect(px-2,j*65+65,12,3,'#8d9673');poly([[px,95+j*54],[px+48,70+j*54],[px+18,98+j*54]],'#294a40');}}rect(822,389,25,30,'#9f5c51');rect(829,396,11,14,'#d0b88d');}
    if(a===1||a===5){for(let i=0;i<5;i++){const px=i*220-40;building(px,278+(i%2)*12,190);lantern(px+12,278);}if(a===5){for(let i=0;i<8;i++){const px=100+i*105;rect(px,240,20,28,'#d4c6ad');rect(px+3,248,5,4,'#674752');rect(px+12,248,5,4,'#674752');rect(px+7,258,6,3,'#9b5a5e');}rect(0,234,960,3,'#a88575');}}
    if(a===2||a===6){rect(0,320,960,118,'#345968');for(let i=0;i<32;i++)rect((i*67+clock*13)%960,330+i%6*15,26,2,'#6f9096');if(a===2){boat(240,352,160);building(50,275,140);for(let i=0;i<8;i++){rect(i*135,365,7,73,'#968875');rect(i*135,374,135,6,'#a99b80');}rect(700,391,38,30,'#6b5348');rect(706,397,26,3,'#d2b680');}else{for(let i=0;i<4;i++)boat(30+i*240,350,180);for(let i=0;i<9;i++)rect(i*115,389,7,49,'#9a8871');}}
    if(a===3){building(340,257,280);roof(320,217,320);rect(190,268,8,170,'#9b7b64');rect(148,267,90,6,'#ae8b69');poly([[165,278],[220,278],[228,322],[158,322]],'#aa9170');rect(176,323,34,4,'#d2b38b');for(let i=0;i<6;i++){rect(20+i*160,398,35,40,'#626366');rect(16+i*160,393,43,6,'#919083');}}
    if(a===4){for(let i=0;i<9;i++)pine(i*125-20,220+i%3*25);for(let i=0;i<12;i++)poly([[i*85,428],[i*85+24,401],[i*85+65,438]],'#a3b1bc');banner(800,280,'#657b8c');}
    if(a===7){building(220,254,520);roof(185,218,590);for(let i=0;i<6;i++){rect(245+i*80,279,12,159,'#905456');lantern(272+i*80,280);}banner(80,253,'#9c4d53');banner(875,253,'#9c4d53');}
    if(a===8||a===9){castle();for(let i=0;i<6;i++)banner(48+i*172,235+i%2*32,a===9?'#c49c61':'#9c4b50');lantern(148,290);lantern(810,290);if(a===8){for(let i=0;i<4;i++){rect(130+i*220,408,19,30,'#493435');poly([[128+i*220,407],[139+i*220,374],[151+i*220,407]],'#dd9758');}}}
    // A fixed, high-contrast floor preserves enemy silhouettes and jump readability.
    rect(0,FLOOR,WIDTH,102,palette.ground);rect(0,FLOOR,WIDTH,5,palette.trim);
    for(let i=0;i<60;i++)rect(sceneSeed(i)%960,FLOOR+12+(i*31)%82,12+(i%4)*5,2,a===4?'#8799a9':'#55545b');
    for(let i=0;i<22;i++){const px=(sceneSeed(i)+clock*(a===4?8:18))%980;rect(px,(i*73+clock*(a===4?25:8))%420,a===4?3:4,2,a===4?'#d7e1e6':a===8?'#e9b282':'#b9b499');}
  }
  // Articulated, silhouette-readable characters: separate guard, spear and boss gear.
  function fighter(e,hero=false,alpha=1){ctx.save();ctx.globalAlpha=alpha;ctx.translate(e.x,e.y);ctx.scale(e.face,1);let stride=hero&&(keys.has('left')||keys.has('right'))?Math.sin(clock*18)*7:Math.sin(clock*5)*2;const boss=e.type==='boss';const color=hero?'#4b8490':boss?'#9e554f':art[arcOf(chapter)].cloth;ctx.strokeStyle='#121b25';ctx.lineWidth=8;ctx.beginPath();ctx.moveTo(-7,-20);ctx.lineTo(-11+stride,0);ctx.moveTo(7,-20);ctx.lineTo(12-stride,0);ctx.stroke();poly([[-17,-48],[13,-48],[19,-19],[-20,-19]],color);rect(-18,-27,36,5,'#d7aa67');for(let i=0;i<3;i++)rect(-16,-44+i*6,29,2,'#243341');rect(-9,-65,19,19,'#d9b18b');rect(-12,-65,25,7,'#182732');if(hero){poly([[-26,-63],[0,-79],[28,-63]],'#bda674');rect(-27,-63,55,3,'#e0c294');poly([[-12,-51],[-34-Math.sin(clock*9)*6,-43],[-25,-37],[-9,-44]],'#be6657');}else{rect(-14,-68,28,9,boss?'#c28c50':'#4f5967');if(boss){poly([[-13,-68],[-24,-87],[-17,-61]],'#e9bd73');poly([[13,-68],[24,-87],[17,-61]],'#e9bd73');}}
    ctx.strokeStyle=e.wind>0?'#ffbe82':'#d9e5db';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(10,-36);ctx.lineTo(hero&&e.attack>0?82:e.type==='spear'?65:33,hero&&e.attack>0?-49:-66);ctx.stroke();if(hero&&e.attack>0){ctx.strokeStyle='#fff2c2';ctx.lineWidth=5;ctx.beginPath();ctx.arc(12,-39,70,-1.1,1);ctx.stroke();ctx.strokeStyle='#e78364';ctx.lineWidth=2;ctx.beginPath();ctx.arc(12,-39,78,-.8,.8);ctx.stroke();}ctx.restore();if(!hero&&e.wind>0)text('!',e.x-4,e.y-93,26,'#ffae77');}
  // Enemy attacks telegraph before resolving, giving the player time to dash away.
  function update(dt){clock+=dt;if(mode==='cutscene'){filmTime+=dt;if(filmTime>=8)finishFilm();return;}if(mode!=='play')return;if(ultTime>0){updateUltimate(dt);return;}if(freeze>0){freeze-=dt;return;}for(const k of ['cool','inv','attack','dash','dashCool'])player[k]=Math.max(0,player[k]-dt);if(keys.has('attack'))slash();const move=(keys.has('right')?1:0)-(keys.has('left')?1:0);if(move)player.face=move;player.x+= (player.dash>0?player.face*870:move*280)*dt;player.x=Math.max(24,Math.min(936,player.x));player.v+=1400*dt;player.y=Math.min(FLOOR,player.y+player.v*dt);if(player.y===FLOOR)player.v=0;if(player.dash>0)ghosts.push({...player,life:.2});comboTime-=dt;if(comboTime<=0)combo=0;
    for(const e of enemies){if(e.dead)continue;e.cool-=dt;e.hit=Math.max(0,e.hit-dt);e.face=player.x>e.x?1:-1;const distance=Math.abs(e.x-player.x),range=e.type==='spear'?100:65;if(e.wind>0){e.wind-=dt;if(e.wind<=0){e.cool=e.type==='boss'?.7:1.2;burst(e.x+e.face*range,e.y-30,'#cc6c58',5);if(distance<range+15&&player.y>FLOOR-70&&player.inv<=0){player.hp--;player.inv=.8;shake=10;combo=0;}}}else if(distance<range&&e.cool<=0)e.wind=e.type==='boss'?.42:.65;else if(distance>range*.8&&e.hit<=0)e.x+=e.face*(e.type==='boss'?95:70+Math.min(40,arcOf(chapter)*4))*dt;}
    sparks.forEach(p=>{p.x+=p.vx*dt;p.y+=p.vy*dt;p.vy+=420*dt;p.life-=dt;});sparks=sparks.filter(p=>p.life>0);ghosts.forEach(p=>p.life-=dt);ghosts=ghosts.filter(p=>p.life>0);shake*=.87;
    if(player.hp<=0){mode='dead';keys.clear();show('THE BLADE FALLS','RISE AGAIN','Read the enemy’s warning. Dash through danger and answer with steel.','RETRY CHAPTER');}else if(enemies.every(e=>e.dead)){if(wave<3)nextWave();else levelCleared();}
  }
  function render(){ultButton.disabled=mode!=='play'||!progress.ultimateUnlocked||player?.charge<100||ultTime>0;ultButton.textContent=progress.ultimateUnlocked?'MOONFALL':'LV 4';if(mode==='cutscene'){drawFilm();return;}ctx.save();ctx.translate((Math.random()-.5)*shake,(Math.random()-.5)*shake);scenery();if(player){ghosts.forEach(g=>fighter(g,true,g.life*2));if(player.inv<=0||Math.floor(clock*20)%2)fighter(player,true);}enemies.filter(e=>!e.dead).forEach(e=>fighter(e));sparks.forEach(p=>rect(p.x,p.y,4,3,p.color));ctx.restore();if(ultTime>0)drawUltimate();if(mode==='play'){rect(18,16,230,42,'#121d2be6');for(let i=0;i<8;i++)rect(30+i*25,29,18,13,i<player.hp?'#e99474':'#35434d');text(`WAVE ${wave}/3`,780,41);if(combo>1)text(`${combo} HIT COMBO`,380,70,25,'#ffe0a0');text(`SCORE ${score}`,30,82,16);if(progress.ultimateUnlocked){rect(30,94,180,6,'#344351');rect(30,94,180*player.charge/100,6,'#e6c48b');text(player.charge>=100?'U · MOONFALL READY':`MOONFALL ${Math.floor(player.charge)}%`,30,120,13);}const boss=enemies.find(e=>e.type==='boss'&&!e.dead);if(boss){rect(290,20,380,10,'#24313b');rect(290,20,380*boss.hp/(16+Math.min(8,arcOf(chapter))),10,'#d17465');}$('#status').textContent=player.dashCool>0?'DASH RECHARGING':'DASH READY · HOLD SLASH TO COMBO';}}
  function loop(t){const dt=Math.min((t-last)/1000||0,.033);last=t;update(dt);render();requestAnimationFrame(loop);}
  menu();requestAnimationFrame(loop);
})();
