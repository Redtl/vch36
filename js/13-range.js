/* ==========================================================================
   vch36 · js/13-range.js
   режим «стрельбище»
   Из index.html (4.2 «разбиение на модули»). Порядок загрузки задан в index.html
   тегами <script defer>; «use strict» сохранён — исходный код был модулем.
   ========================================================================== */
"use strict";


/* ============================================================================
   3.1  РЕЖИМ «СТРЕЛЬБИЩЕ»
   ============================================================================
   Мишени — обычные статические пропы (они попадают в общий массив ba и в
   физический мир), поэтому снаряд бьёт по ним штатным impactProp → ch().
   Очки/таймер/рекорды ведутся здесь; рекорды — в localStorage.            */
const VCH_RANGE={
  on:!1,score:0,hits:0,shots:0,time:0,limit:180,targets:[],key:"vch36.range.best",
  /* ---- геометрия мишеней ---- */
  buildShield(){
    const g=new Jt(),steel=new fe({color:0x9aa1a9,metalness:.55,roughness:.55}),
          red=new fe({color:0xb2332c,metalness:.25,roughness:.6});
    const board=new Lt(new _e(2.4,1.9,.22),steel);board.position.y=1.45;g.add(board);
    const stripe=new Lt(new _e(2.44,.36,.24),red);stripe.position.y=1.95;g.add(stripe);
    for(const sx of[-1,1]){const leg=new Lt(new _e(.18,1.5,.18),steel);leg.position.set(sx*.88,.55,0);g.add(leg)}
    g.traverse(o=>{if(o.isMesh){o.castShadow=!0;o.receiveShadow=!0}});
    return g;
  },
  buildBlock(){
    const g=new Jt(),con=new fe({color:0x9d9c93,metalness:.05,roughness:.9});
    const b=new Lt(new _e(2.6,1.5,1.5),con);b.position.y=.75;g.add(b);
    const top=new Lt(new _e(2.2,.35,.7),new fe({color:0x8b8a82,metalness:.05,roughness:.92}));
    top.position.set(0,1.6,.2);g.add(top);
    g.traverse(o=>{if(o.isMesh){o.castShadow=!0;o.receiveShadow=!0}});
    return g;
  },
  buildTank(){
    const g=new Jt(),
          hull=new fe({color:0x5c6150,metalness:.35,roughness:.7}),
          dark=new fe({color:0x2c2f33,metalness:.5,roughness:.6}),
          red=new fe({color:0x8d2a26,metalness:.2,roughness:.65});
    const h=new Lt(new _e(3.0,.9,5.4),hull);h.position.y=.85;g.add(h);
    const skirt=new Lt(new _e(3.5,.42,5.6),dark);skirt.position.y=.4;g.add(skirt);
    const t=new Lt(new _e(2.2,.8,2.6),hull);t.position.set(0,1.6,-.3);g.add(t);
    const gun=new Lt(new mn(.15,.19,3.6,10),dark);
    gun.rotation.x=Math.PI/2;gun.position.set(0,1.7,2.0);g.add(gun);
    const mark=new Lt(new _e(1.0,.5,.06),red);mark.position.set(0,1.85,-1.62);g.add(mark);
    g.traverse(o=>{if(o.isMesh){o.castShadow=!0;o.receiveShadow=!0}});
    return g;
  },
  spawn(kind,x,z,yaw){
    const g=kind==="tank"?this.buildTank():kind==="shield"?this.buildShield():this.buildBlock();
    const hp=kind==="tank"?3:kind==="shield"?1:2.2,
          points=kind==="tank"?300:kind==="shield"?100:150;
    cn.add(g);
    const b=VCH_bounds(g);
    VCH_place(g,x,z,b.hx,b.hz,yaw,b.bottom);
    const body=new Et({mass:0,type:Et.STATIC,
      position:new w(g.position.x,g.position.y,g.position.z),angularDamping:.4,linearDamping:.05});
    body.quaternion.set(g.quaternion.x,g.quaternion.y,g.quaternion.z,g.quaternion.w);
    for(const pt of VCH_parts(g))
      body.addShape(new ns(new w(pt.half.x,pt.half.y,pt.half.z)),
                    new w(pt.off.x,pt.off.y,pt.off.z),
                    new Fe(pt.quat.x,pt.quat.y,pt.quat.z,pt.quat.w));
    body.collisionFilterGroup=is;body.collisionFilterMask=7|VCH_RAMP;
    vn.physics.addBody(body);
    const rec={mesh:g,body,hp,destructible:!0,kind:"target",dynamic:!1,alive:!0,
               isTarget:!0,points,tkind:kind};
    g.userData.prop=rec;
    rec.groundY=g.position.y;
    try{VCH_settle(rec)}catch(e){}
    ba.push(rec);
    this.targets.push(rec);
    return rec;
  },
  start(){
    this.clear();
    this.on=!0;this.score=0;this.hits=0;this.shots=0;this.time=0;
    this.endedReason="";
    /* мишени веером перед танком (танк стартует в начале координат, +Z — вперёд) */
    const plan=[
      ["shield",-20,34,0.15],["shield",0,36,0],["shield",20,34,-0.15],
      ["block",-30,50,0.35],["block",-10,52,0.05],["block",10,52,-0.05],["block",30,50,-0.35],
      ["tank",-22,68,0.2],["tank",0,72,0],["tank",22,68,-0.2],
      ["shield",-38,64,0.5],["shield",38,64,-0.5]
    ];
    for(const [k,x,z,y] of plan)this.spawn(k,x,z,y);
    this.updateHUD();
    const rp=document.getElementById("rangepanel");
    if(rp)rp.classList.remove("hidden");
    const ov=document.getElementById("rangeover");
    if(ov)ov.classList.add("hidden");
    try{an.clank()}catch(e){}
    return this.targets.length;
  },
  clear(){
    for(const t of this.targets){
      if(!t)continue;
      try{if(t.mesh){cn.remove(t.mesh)}}catch(e){}
      try{if(t.body)vn.physics.removeBody(t.body)}catch(e){}
      t.alive=!1;
      const i=ba.indexOf(t);if(i>=0)ba.splice(i,1);
    }
    this.targets.length=0;
  },
  stop(reason){
    if(!this.on)return;
    this.on=!1;
    this.endedReason=reason||"ЗАЕЗД ЗАВЕРШЁН";
    const left=this.targets.filter(t=>t.alive).length;
    const acc=this.shots?Math.round(this.hits/this.shots*100):null;
    const run={score:this.score,time:+this.time.toFixed(1),
               acc,date:new Date().toLocaleDateString("ru-RU")};
    const top=this.saveRun(run);
    this.showResults(run,top,left);
    const rp=document.getElementById("rangepanel");
    if(rp)rp.classList.add("hidden");
  },
  tick(dt){
    if(!this.on)return;
    this.time+=dt;
    const left=this.targets.filter(t=>t.alive).length;
    if(left===0){this.stop("ВСЕ ЦЕЛИ ПОРАЖЕНЫ");return}
    if(this.time>=this.limit){this.stop("ВРЕМЯ ВЫШЛО");return}
    this.hudAcc=(this.hudAcc||0)+dt;
    if(this.hudAcc>.1){this.hudAcc=0;this.updateHUD()}
  },
  updateHUD(){
    const el=VCH_HUD.el;
    const left=this.targets.filter(t=>t.alive).length;
    if(el.rscore)el.rscore.textContent=this.score;
    if(el.rtime)el.rtime.textContent=this.time.toFixed(1);
    if(el.rleft)el.rleft.textContent=left+"/"+this.targets.length;
    if(el.racc)el.racc.textContent=this.shots?Math.round(this.hits/this.shots*100)+"%":"—";
  },
  onShot(){if(this.on)this.shots++},
  onKill(rec,point){
    if(!this.on)return;
    this.hits++;
    this.score+=rec.points||100;
    this.updateHUD();
    try{en.explosion(point||rec.mesh.position,1.1);an.explosion(1.1)}catch(e){}
  },
  records(){try{return JSON.parse(localStorage.getItem(this.key)||"[]")}catch(e){return[]}},
  saveRun(run){
    const list=this.records();
    list.push(run);
    list.sort((a,b)=>b.score-a.score||a.time-b.time);
    const top=list.slice(0,5);
    try{localStorage.setItem(this.key,JSON.stringify(top))}catch(e){}
    return top;
  },
  resetRecords(){try{localStorage.removeItem(this.key)}catch(e){}},
  showResults(run,top,left){
    const q=x=>document.getElementById(x);
    const ov=q("rangeover");if(!ov)return;
    q("ro-why").textContent=this.endedReason+(left?" · ОСТАЛОСЬ ЦЕЛЕЙ: "+left:"");
    q("ro-score").textContent=run.score;
    q("ro-time").textContent=run.time.toFixed(1)+" с";
    q("ro-acc").textContent=run.acc==null?"—":run.acc+"%";
    const best=top[0];
    q("ro-best").textContent=best?(best===run?"НОВЫЙ РЕКОРД!":"ЛУЧШИЙ: "+best.score+" очк. / "+best.time.toFixed(1)+" с"):"";
    const tb=q("ro-table");tb.innerHTML="";
    top.forEach((r,i)=>{
      const tr=document.createElement("tr");
      tr.innerHTML=`<td>${i+1}</td><td>${r.score}</td><td>${r.time.toFixed(1)} с</td><td>${r.date||""}</td>`;
      tb.appendChild(tr);
    });
    ov.classList.remove("hidden");document.body.classList.add("vch-modal");
  }
};
/* бонус за уничтожение мишени: оборачиваем функцию урона ch() */
(function vchRangeHook(){
  const base=ch;
  ch=function(rec,point,dir,dmg){
    const wasAlive=rec&&rec.alive,isT=rec&&rec.isTarget;
    const wasHP=rec&&rec.hp;
    base(rec,point,dir,dmg);
    if(isT&&wasAlive&&!rec.alive)VCH_RANGE.onKill(rec,point);
    /* 3.3: попадание/уничтожение ИИ-танка */
    if(rec&&rec.kind==="enemy"&&wasAlive){
      const AI=window.__vchUI&&window.__vchUI.ai;
      if(AI){
        if(rec.hp<wasHP)AI.onHit();
        if(!rec.alive)AI.onKill(rec,point);
      }
    }
  };
  /* выстрелы считаем по звуку выстрела — единая точка для всех видов оружия */
  const fireBase=an.fire.bind(an);
  an.fire=function(){VCH_RANGE.onShot();if(window.__vchUI&&window.__vchUI.ai)window.__vchUI.ai.shots++;return fireBase()};
})();
