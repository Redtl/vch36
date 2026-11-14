/* ==========================================================================
   vch36 · js/10-ai.js
   ИИ, пыль из-под гусениц, HUD/меню флота
   Из index.html (4.2 «разбиение на модули»). Порядок загрузки задан в index.html
   тегами <script defer>; «use strict» сохранён — исходный код был модулем.
   ========================================================================== */
"use strict";


/* ---- простой патрульный ИИ для неактивного танка --------------------------- */
const vchAiFwd=new w(0,0,1);
let vchObst=null;
/* статические мелкие пропсы (ящики, конусы) — для объезда патрулём */
function vchObstList(){
  if(vchObst)return vchObst;
  vchObst=[];
  for(const b of vn.physics.bodies){
    if(!b.shapes||!b.shapes.length)continue;
    if(b.mass>0)continue;
    let r=0;
    const a=b.aabb;
    if(a)r=Math.max(a.upperBound.x-a.lowerBound.x,a.upperBound.z-a.lowerBound.z)*.5;
    if(!(r>0)){
      for(const sh of b.shapes){
        const he=sh.halfExtents;
        if(he)r=Math.max(r,he.x,he.z);
        else if(sh.radius)r=Math.max(r,sh.radius);
      }
    }
    if(r>0&&r<16)vchObst.push({x:b.position.x,z:b.position.z,r:r});
  }
  return vchObst;
}
/* выбор самого свободного курса из 12 направлений вокруг base */

function vchAITick(dt){
  for(const t of VCH_TANKS){
    if(t===VCH_ACTIVE||t.aiEnabled===!1)continue;
    const b=t.phys.body,p=b.position;
    if(!isFinite(t.aiHdg))t.aiHdg=0;
    if(!isFinite(t.aiHT))t.aiHT=0;
    if(!isFinite(t.revT))t.revT=0;
    if(!isFinite(t.stuckT))t.stuckT=0;
    b.quaternion.vmult(vchAiFwd,vchAiFwd);
    const yawNow=Math.atan2(vchAiFwd.x,vchAiFwd.z);
    /* свободный патруль: новый курс раз в 8-12 с */
    t.aiHT+=dt;
    if(t.aiHT>8+Math.random()*4){
      t.aiHT=0;
      t.aiHdg=yawNow+(Math.random()<.5?-1:1)*(.6+Math.random()*1.3);
    }
    /* поле курса: притяжение к выбранному направлению, отталкивание от игрока,
       пропсов впереди и края карты — без «режимов», поэтому нет дёрганья */
    let vx=Math.sin(t.aiHdg),vz=Math.cos(t.aiHdg);
    const a=VCH_ACTIVE.phys.body.position,
          ddx=p.x-a.x,ddz=p.z-a.z,dd=Math.hypot(ddx,ddz)||1e-3;
    const nearPlayer=dd<14;
    if(nearPlayer){
      const k=Math.min(1,(14-dd)/8)*2.4;
      vx+=ddx/dd*k,vz+=ddz/dd*k;
    }
    const obs=vchObstList(),fx=Math.sin(yawNow),fz=Math.cos(yawNow);
    for(const o of obs){
      const ox=p.x-o.x,oz=p.z-o.z,od=Math.hypot(ox,oz)||1e-3,lim=o.r+5;
      if(od>lim)continue;
      if(ox*fx+oz*fz<-o.r)continue;                 /* трогаем только то, что впереди */
      const k=(lim-od)/lim*2.2;
      vx+=ox/od*k,vz+=oz/od*k;
    }
    if(Math.abs(p.x)>20)vx-=Math.sign(p.x)*1.4;
    if(Math.abs(p.z)>20)vz-=Math.sign(p.z)*1.4;
    /* игрок совсем рядом — жёстко уходим от него, не разбирая препятствий */
    if(dd<9){vx=ddx/dd*3,vz=ddz/dd*3}
    const mag=Math.hypot(vx,vz),
          want=Math.atan2(vx,vz);
    let e=want-yawNow;
    e=Math.atan2(Math.sin(e),Math.cos(e));
    /* yaw растёт против часовой (влево), поэтому руль берём со знаком минус */
    let steer=Math.abs(e)<.05?0:Math.max(-1,Math.min(1,-e*1.6)),
        thr=Math.abs(e)>.9?.22:(mag>.75?.52:.38);
    /* застрял: сдать назад, взять противоположный курс */
    const sp=Math.abs(t.phys.forwardSpeed||0);
    if(sp<.6)t.stuckT+=dt;
    else t.stuckT=Math.max(0,t.stuckT-dt*2);
    if(t.stuckT>1.3){
      t.revT+=dt;
      if(t.revT<1.5){
        if(!t.dodgeSign)t.dodgeSign=Math.random()<.5?1:-1;
        t.phys.setInput(-.6,t.dodgeSign*.85);continue;
      }
      t.revT=0,t.stuckT=0,t.dodgeSign=0;
      t.aiHdg=yawNow+Math.PI+(Math.random()-.5),t.aiHT=0;
      continue;
    }
    t.phys.setInput(thr,steer);
  }
}

/* ---- пыль из-под гусениц: для каждого танка -------------------------------- */
function vchDust(){
  const c=Ce,q=qt;
  for(const v of VCH_TANKS){Ce=v.phys;qt=v.rig;try{sb()}catch(e){}}
  Ce=c;qt=q;
}

/* ---- HUD / меню ------------------------------------------------------------ */
function vchTankUI(){
  const badges=document.querySelector(".right-badges");
  if(badges&&!document.getElementById("tankname")){
    const d=document.createElement("div");
    d.id="tankname";
    d.style.cssText="font-size:10px;letter-spacing:2.2px;padding:6px 11px;border:1px solid rgba(255,138,30,.35);border-radius:3px;background:#140c048c;color:#ffb066;backdrop-filter:blur(6px)";
    badges.insertBefore(d,badges.firstChild);
  }
  const help=document.getElementById("help");
  if(help&&help.innerHTML.indexOf("TAB")<0)
    help.innerHTML+='<br /><b>Tab</b> — переключение танка (ОБТ / Scorpion)';
  vchTankBadge();
}
window.addEventListener("keydown",e=>{
  if(e.code==="Tab"){
    e.preventDefault();
    if(window.__vchGarage&&window.__vchGarage.active)window.__vchGarage.cycleTank();
    else vchCycleTank();
  }
  /* L — ливрея: янтарь/графит (по референсу) <-> заводское хаки */
  if(e.code==="KeyL"&&!e.repeat){
    e.preventDefault();vchLiveryCycle();try{an.clank()}catch(_){}
    window.__vchGarage&&window.__vchGarage.syncLiveryUI&&window.__vchGarage.syncLiveryUI();
  }
},!0);

/* ---- загрузка и постановка Скорпиона --------------------------------------- */
let VCH_SCORPION_OK=!1,VCH_SCORPION_BUSY=null;
async function vchInitScorpion(forceRetry){
  if(VCH_SCORPION_OK)return;
  if(VCH_SCORPION_BUSY)return VCH_SCORPION_BUSY;
  const C=VCH_SC_CFG;
  VCH_SCORPION_BUSY=(async()=>{
  try{
    if(forceRetry&&typeof window.__vchLoadScorpionData==="function")window.__vchLoadScorpionData();
    const root=await vchScorpionGLB();
    const rig=mountScorpion(root);
    const px=12.0,pz=0.0;
    const py=ge(px,pz)+C.hullH;
    const phys=new Vw(vn.physics,{
      mass:C.mass,
      position:new w(px,py,pz),
      heightAt:ge,
      normalAt:(x,z)=>(vn.normalAt(x,z,Vo),{x:Vo.x,y:Vo.y,z:Vo.z}),
      wheelZ:C.roadZ,wheelX:[-C.halfTrack,C.halfTrack],wheelY:C.wheelLocalY,
      shapeHalf:[[1.74,.66,3.05],[1.22,.52,1.85]],
      settings:C.settings
    });
    phys.body.quaternion.setFromAxisAngle(new w(0,1,0),-0.55);
    rig.group.position.copy(phys.body.position);
    cn.add(rig.group);
    const tk={id:"scorpion",name:"SCORPION",phys,rig,aim:{},wpn:{ammo:22,ammoMax:22,reload:0,ammoRefill:0},
              aiEnabled:!0,aiHome:{x:px,z:pz},aiR:9,aiPhase:Math.random()*6.283,aiIdx:0,aiT:0,camScale:1.32,lookY:1.95};
    VCH_TANKS.push(tk);
    VCH_SCORPION_OK=!0;
    if(VCH_PENDING>0&&VCH_PENDING<VCH_TANKS.length)setActiveTank(VCH_PENDING);
    VCH_PENDING=-1;
    vchTankBadge();
    window.__scorpion={tank:tk,rig,info:rig.info};
    vWarmUp("scorpion");
    try{vchRocketInit(rig)}catch(e){console.error("rockets:",e)}
    try{rig.bakeFlatTracks&&rig.bakeFlatTracks()}catch(e){}
    try{window.__vchGarage&&window.__vchGarage.onScorpionReady&&window.__vchGarage.onScorpionReady(rig)}catch(e){console.error("garage scorp:",e)}
    /* Модель обрастает узлами ещё пару секунд после монтирования (75 → 182
       меша), поэтому полный прогрев — позже, пока висит стартовое меню.
       Прогрев занимает один проход компиляции, поэтому запускаем его в
       свободное время: пусть лучше подождёт, чем наложится на другой work. */
    const warmLater=(tag,ms)=>setTimeout(()=>{
      if(typeof J!=="undefined"&&J.started)return;      /* в бою не мешаем */
      if(window.requestIdleCallback)window.requestIdleCallback(()=>vchWarmAll(tag),{timeout:6000});
      else vchWarmAll(tag);
    },ms);
    warmLater("scorpion",6000);
    /* второй проход позже: часть материалов (износ Scorpion) доезжает не сразу */
    warmLater("late",15000);
  }catch(e){
    console.error("[scorpion]",e);
    const h=document.getElementById("tankhint");
    if(h){h.textContent="Scorpion не загрузился: "+e.message;h.style.color="#ff7a5c"}
    window.__vchGarage&&window.__vchGarage.onScorpionError&&window.__vchGarage.onScorpionError(e);
  }finally{
    VCH_SCORPION_BUSY=null;
  }
  })();
  return VCH_SCORPION_BUSY;
}
window.__vchRetryScorpion=()=>vchInitScorpion(!0);
vchTankUI();
window.__tanks=VCH_TANKS;window.__setActive=setActiveTank;window.__scorpCfg=VCH_SC_CFG;
/* 4.3: код подключается загрузчиком, поэтому следующий модуль (11-rockets.js)
   мог ещё не выполниться к моменту, когда GLB декодируется и понадобится
   vchRocketInit. Ждём конца цепочки. */
(function(){
  const start=vchInitScorpion;
  if(window.__vchScriptsDone)return start();
  const iv=setInterval(()=>{ if(window.__vchScriptsDone){ clearInterval(iv); start() } },40);
})();

function ip(r,t=!0){const _g=window.__vchGarage,_gOn=!!(_g&&_g.active);if(!_gOn||!(_g.isSettled&&_g.isSettled())){J.started?ib(r):Ce.setInput(0,0);if(J.started)vchAITick(r);qo+=r;let e=0;for(;qo>=Xo&&e<4;){for(const $v of VCH_TANKS)$v.phys.update(Xo);vn.physics.step(Xo);for(const $v of VCH_TANKS)VCH_stabilizeBody(Xo,$v.phys);qo-=Xo,e++}e===4&&(qo=0);for(const $v of VCH_TANKS){const $n=$v.phys.body,$q=$v.rig;$q.group.position.set($n.position.x,$n.position.y+($v.phys.recY||0)+($v.phys.impY||0),$n.position.z),$q.group.quaternion.copy(VCH_visualTilt($v.phys)),VCH_recoilPose(r,$v.phys,$q),$q.update(r,{speedL:$v.phys.speedL,speedR:$v.phys.speedR,probe:Jf,wheels:$v.phys.wheels})};vchRocketTick(r);J.started&&(J.camSwitch>0&&J.aimMode==="cursor"&&(J.camSwitch--,hh()),eb(r),turretKeys(r));for(let s=Ls.length-1;s>=0;s--)Ls[s].update(r),Ls[s].alive||Ls.splice(s,1);J.reload>0&&(J.reload-=r,J.reload<=0&&(J.reload=0,an.reload())),J.ammo===0&&J.ammoRefill>0&&(J.ammoRefill-=r,J.ammoRefill<=0&&(J.ammo=J.ammoMax,an.clank())),en.update(r),Vr&&Vr.update(r,pa.elapsedTime),vchDust();const i=vn.lights;i.sun.position.set(qt.group.position.x-52,62,qt.group.position.z-78),i.sun.target.position.copy(qt.group.position),i.sun.target.updateMatrixWorld()}if(!_gOn){vFrame(r);J.started&&X1(r);if(J.started){const s=Math.max(Math.abs(Ce.speedL||0),Math.abs(Ce.speedR||0));an.setEngine(Ce.forwardSpeed,J.smoothThrottle||0,!0,r,s)}J1(r),tb(),nb(r),j1(r),Q1(r),K1(r)}else{_g.tick(r)}t&&Zr.render(),J.frames=(J.frames||0)+1,Yo+=r,Pc++,Yo>.5&&(fn.fps.textContent=`${Math.round(Pc/Yo)} FPS · ${cn.children.length} объектов`,Yo=0,Pc=0)}const be={root:document.querySelector("#modeltools"),name:document.querySelector("#mt-name"),turret:document.querySelector("#mt-turret"),barrel:document.querySelector("#mt-barrel"),info:document.querySelector("#mt-info"),file:document.querySelector("#modelfile"),layer:document.querySelector("#droplayer")};function Gr(r,t){be.info&&(be.info.textContent=r,be.info.classList.toggle("err",!!t))}function bd(r,t,e,n){if(!r)return;r.innerHTML="";const i=document.createElement("option");i.value="",i.textContent=n?`авто: ${n}`:"авто (по имени)",r.appendChild(i);for(const s of t){const o=document.createElement("option");o.value=s.path,o.textContent=s.path,s.path===e&&(o.selected=!0),r.appendChild(o)}}function sp(r){if(!be.root)return;if(!r||!r.custom){be.root.classList.add("hidden");return}be.root.classList.remove("hidden");const t=r.info;be.name.textContent=Ee.name,Gr(`габарит ${t.size.x.toFixed(1)}×${t.size.y.toFixed(1)}×${t.size.z.toFixed(1)} м · башня: ${t.turret} · ствол: ${t.barrel} · катков: ${t.wheels}`,!1),bd(be.turret,Ee.nodes,Ee.opts.turretPath,t.turret),bd(be.barrel,Ee.nodes,Ee.opts.barrelPath,t.barrel)}function rb(r){if(r==="rot")Ee.opts.yaw=(Ee.opts.yaw||0)+Math.PI/2;else if(r==="scale+")Ee.opts.scale=Math.min(3,(Ee.opts.scale||1)*1.1);else if(r==="scale-")Ee.opts.scale=Math.max(.3,(Ee.opts.scale||1)/1.1);else if(r==="reset"){$f();return}else return;Ee.source&&Hr()}be.root&&(be.root.addEventListener("click",r=>{const t=r.target.closest("button");t&&t.dataset.act&&rb(t.dataset.act)}),be.turret?.addEventListener("change",()=>{Ee.opts.turretPath=be.turret.value||null,Hr()}),be.barrel?.addEventListener("change",()=>{Ee.opts.barrelPath=be.barrel.value||null,Hr()}),be.file?.addEventListener("change",()=>{be.file.files&&be.file.files[0]&&ah(be.file.files[0]),be.file.value=""}));let Lr=0;window.addEventListener("dragenter",r=>{r.dataTransfer&&(r.preventDefault(),Lr++,be.layer?.classList.remove("hidden"))});window.addEventListener("dragover",r=>{r.dataTransfer&&r.preventDefault()});window.addEventListener("dragleave",()=>{Lr=Math.max(0,Lr-1),Lr||be.layer?.classList.add("hidden")});window.addEventListener("drop",r=>{r.preventDefault(),Lr=0,be.layer?.classList.add("hidden");const t=r.dataTransfer&&r.dataTransfer.files&&r.dataTransfer.files[0];t&&ah(t)});window.addEventListener("resize",()=>{ye.aspect=window.innerWidth/window.innerHeight,ye.updateProjectionMatrix(),Jn.setSize(window.innerWidth,window.innerHeight),Zr.setSize(window.innerWidth,window.innerHeight)});document.querySelector("#launch").addEventListener("click",()=>{if(window.__vchGarage&&window.__vchGarage.launch){window.__vchGarage.launch();return}document.querySelector("#start").classList.add("gone"),document.querySelector("#hud").classList.remove("hidden"),J.started=!0,document.body.classList.add("playing"),an.init(),an.reload(),document.exitPointerLock?.(),J.aimMode="cursor",uh(),aimSync()});VCH_MAP_UI();let Lc=0;function ob(r){if(J.started)return;Lc+=r*.16;const t=13+Math.sin(pa.elapsedTime*.2)*2;ye.position.set(qt.group.position.x+Math.sin(Lc)*t,qt.group.position.y+3.2+Math.sin(pa.elapsedTime*.35)*.8,qt.group.position.z+Math.cos(Lc)*t),ye.lookAt(qt.group.position.x,qt.group.position.y+.4,qt.group.position.z)}
