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
  let checkpoint = 0, completed = false;
  try { const s = JSON.parse(localStorage.getItem(SAVE)); if(s && Number.isInteger(s.chapter) && s.chapter>=0 && s.chapter<TOTAL_LEVELS){checkpoint=s.chapter;completed=!!s.completed;} } catch {}
  let mode='menu', chapter=checkpoint, player, enemies=[], sparks=[], ghosts=[], wave=0, score=0, combo=0, comboTime=0, clock=0, last=0, shake=0, freeze=0;
  const keys = new Set();
  const touch = matchMedia('(pointer:coarse)').matches || navigator.maxTouchPoints>0;
  document.body.classList.toggle('touch-mode', touch);
  // Save only chapter checkpoints: retries always begin with full health.
  function save(done=false){try{localStorage.setItem(SAVE,JSON.stringify({chapter,completed:done}));}catch{} }
  function show(label,title,body,button){$('#label').textContent=label;$('#title').textContent=title;$('#story').textContent=body;$('#start').textContent=button;$('#overlay').classList.remove('hidden');}
  function menu(){mode='menu';show('SAMUREXILE','SHADOW OF THE EXILE',completed?'The country remembers its guardian. Begin the legend again.':'An exile. A stolen name. A country worth fighting for.',completed?'PLAY AGAIN':checkpoint?'CONTINUE':'DRAW YOUR BLADE');}
  // Each chapter contains three waves. The last wave contains a unique boss.
  function start(n){chapter=n;checkpoint=n;save();wave=0;score=0;combo=0;comboTime=0;freeze=0;shake=0;sparks=[];ghosts=[];keys.clear();player={x:160,y:FLOOR,v:0,face:1,hp:8,inv:0,attack:0,cool:0,dash:0,dashCool:0,chain:0};nextWave();mode='brief';$('#chapter').textContent=`LEVEL ${n+1} / ${TOTAL_LEVELS}`;show(`${art[arcOf(n)].name.toUpperCase()} · ${n+1}/${TOTAL_LEVELS}`,levelTitle(n).toUpperCase(),levelStory(n),'FIGHT');}
  function nextWave(){wave++;enemies=[];for(let i=0;i<Math.min(6,2+wave+Math.floor(chapter/100));i++){const boss=(chapter+1)%50===0&&wave===3&&i===0;enemies.push({x:i%2?880+i*24:40-i*24,y:FLOOR,hp:boss?16+Math.min(8,arcOf(chapter)):2+Math.min(2,Math.floor(chapter/150)),type:boss?'boss':i%3===0?'spear':'guard',face:1,wind:0,cool:1+i*.25,hit:0,dead:false});} if(wave>1)player.hp=Math.min(8,player.hp+2);}
  function burst(x,y,color,count=12){for(let i=0;i<count;i++)sparks.push({x,y,vx:(Math.random()-.5)*320,vy:(Math.random()-.8)*250,life:.25+Math.random()*.3,color});}
  // A three-hit chain ends in a wider, heavier strike. Holding slash repeats it.
  function slash(){if(mode!=='play'||player.cool>0)return;player.chain=(player.chain+1)%3;const heavy=player.chain===0;player.cool=heavy?.34:.21;player.attack=.16;const reach=heavy?115:85;for(const e of enemies){if(e.dead)continue;if(Math.abs(e.x-player.x)<reach&&Math.abs(player.y-e.y)<85&&(e.x-player.x)*player.face>-20){e.hp-=heavy?2:1;e.hit=.2;e.x+=player.face*(e.type==='boss'?10:25);e.wind=0;combo++;comboTime=2;score+=50;shake=heavy?8:4;freeze=.035;burst(e.x,e.y-40,'#f5cd85');if(e.hp<=0){e.dead=true;score+=100;burst(e.x,e.y-35,'#e37b64',22);}}}}
  function jump(){if(mode==='play'&&player.y>=FLOOR-1)player.v=-510;}
  function dash(){if(mode==='play'&&player.dashCool<=0){player.dash=.16;player.dashCool=.75;player.inv=.23;}}
  const bindings={a:'left',arrowleft:'left',d:'right',arrowright:'right',w:'jump',arrowup:'jump',' ':'jump',j:'attack',k:'attack',shift:'dash',l:'dash'};
  function input(key,down){if(down){keys.add(key);if(key==='jump')jump();if(key==='dash')dash();if(key==='attack')slash();}else keys.delete(key);}
  document.addEventListener('keydown',e=>{const k=bindings[e.key.toLowerCase()];if(k){e.preventDefault();if(!e.repeat)input(k,true);}if(e.key==='Escape'&&mode==='play'){mode='pause';keys.clear();show('PAUSED','TAKE A BREATH','Your fight will wait.','RESUME');}});
  document.addEventListener('keyup',e=>input(bindings[e.key.toLowerCase()],false));
  // Pointer capture permits holding movement while another finger attacks.
  const dashButton=document.createElement('button');dashButton.dataset.key='dash';dashButton.textContent='DASH';dashButton.setAttribute('aria-label','Dash');document.querySelector('.act').append(dashButton);
  document.querySelectorAll('[data-key]').forEach(b=>{b.onpointerdown=e=>{e.preventDefault();b.setPointerCapture(e.pointerId);input(b.dataset.key,true);};['pointerup','pointercancel','lostpointercapture'].forEach(type=>b.addEventListener(type,()=>input(b.dataset.key,false)));});
  window.addEventListener('blur',()=>{keys.clear();if(mode==='play'){mode='pause';keys.clear();show('PAUSED','TAKE A BREATH','Your fight will wait.','RESUME');}});
  $('#start').onclick=()=>{if(mode==='menu')start(completed?0:checkpoint);else if(mode==='brief'||mode==='pause'){mode='play';$('#overlay').classList.add('hidden');}else if(mode==='dead')start(chapter);else if(mode==='clear')start(chapter+1);else{completed=true;menu();}};
  $('#restart').onclick=()=>{if(confirm('Restart this chapter?'))start(chapter);};
  $('#toggle').onclick=()=>document.body.classList.toggle('touch-mode');
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
  function update(dt){clock+=dt;if(mode!=='play')return;if(freeze>0){freeze-=dt;return;}for(const k of ['cool','inv','attack','dash','dashCool'])player[k]=Math.max(0,player[k]-dt);if(keys.has('attack'))slash();const move=(keys.has('right')?1:0)-(keys.has('left')?1:0);if(move)player.face=move;player.x+= (player.dash>0?player.face*870:move*280)*dt;player.x=Math.max(24,Math.min(936,player.x));player.v+=1400*dt;player.y=Math.min(FLOOR,player.y+player.v*dt);if(player.y===FLOOR)player.v=0;if(player.dash>0)ghosts.push({...player,life:.2});comboTime-=dt;if(comboTime<=0)combo=0;
    for(const e of enemies){if(e.dead)continue;e.cool-=dt;e.hit=Math.max(0,e.hit-dt);e.face=player.x>e.x?1:-1;const distance=Math.abs(e.x-player.x),range=e.type==='spear'?100:65;if(e.wind>0){e.wind-=dt;if(e.wind<=0){e.cool=e.type==='boss'?.7:1.2;burst(e.x+e.face*range,e.y-30,'#cc6c58',5);if(distance<range+15&&player.y>FLOOR-70&&player.inv<=0){player.hp--;player.inv=.8;shake=10;combo=0;}}}else if(distance<range&&e.cool<=0)e.wind=e.type==='boss'?.42:.65;else if(distance>range*.8&&e.hit<=0)e.x+=e.face*(e.type==='boss'?95:70+Math.min(40,arcOf(chapter)*4))*dt;}
    sparks.forEach(p=>{p.x+=p.vx*dt;p.y+=p.vy*dt;p.vy+=420*dt;p.life-=dt;});sparks=sparks.filter(p=>p.life>0);ghosts.forEach(p=>p.life-=dt);ghosts=ghosts.filter(p=>p.life>0);shake*=.87;
    if(player.hp<=0){mode='dead';keys.clear();show('THE BLADE FALLS','RISE AGAIN','Read the enemy’s warning. Dash through danger and answer with steel.','RETRY CHAPTER');}else if(enemies.every(e=>e.dead)){if(wave<3)nextWave();else if(chapter<TOTAL_LEVELS-1){mode='clear';chapter++;save();chapter--;show('LEVEL COMPLETE','THE ROAD OPENS',`Level ${chapter+1} cleared. Score: ${score}. The next level is saved.`,'CONTINUE');}else{mode='ending';completed=true;save(true);show('DAWN / HONOUR RESTORED','THE EXILE RETURNS','The commander falls. Aki brings the ledger, the original seal and the witnesses before the court. Ren is cleared, and the people recognise the guardian who fought for them.','FINISH');}}
  }
  function render(){ctx.save();ctx.translate((Math.random()-.5)*shake,(Math.random()-.5)*shake);scenery();if(player){ghosts.forEach(g=>fighter(g,true,g.life*2));if(player.inv<=0||Math.floor(clock*20)%2)fighter(player,true);}enemies.filter(e=>!e.dead).forEach(e=>fighter(e));sparks.forEach(p=>rect(p.x,p.y,4,3,p.color));ctx.restore();if(mode==='play'){rect(18,16,230,42,'#121d2be6');for(let i=0;i<8;i++)rect(30+i*25,29,18,13,i<player.hp?'#e99474':'#35434d');text(`WAVE ${wave}/3`,780,41);if(combo>1)text(`${combo} HIT COMBO`,380,70,25,'#ffe0a0');text(`SCORE ${score}`,30,82,16);const boss=enemies.find(e=>e.type==='boss'&&!e.dead);if(boss){rect(290,20,380,10,'#24313b');rect(290,20,380*boss.hp/(16+Math.min(8,arcOf(chapter))),10,'#d17465');}$('#status').textContent=player.dashCool>0?'DASH RECHARGING':'DASH READY · HOLD SLASH TO COMBO';}}
  function loop(t){const dt=Math.min((t-last)/1000||0,.033);last=t;update(dt);render();requestAnimationFrame(loop);}
  menu();requestAnimationFrame(loop);
})();
