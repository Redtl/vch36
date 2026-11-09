/* ==========================================================================
   vch36 · js/15-battle.js
   режим «бой»
   Из index.html (4.2 «разбиение на модули»). Порядок загрузки задан в index.html
   тегами <script defer>; «use strict» сохранён — исходный код был модулем.
   ========================================================================== */
"use strict";


/* ============================================================================
   3.3  БОЙ: 1–3 ИИ-танка, прочность, урон, победа/поражение
   ----------------------------------------------------------------------------
   Противник — кинематическое тело (mass 0, тип KINEMATIC), которое мы двигаем
   сами: держит дистанцию 38–65 м, доворачивает корпус на игрока и стреляет раз
   в 5–7 с. Снаряд летит «вслепую» с задержкой dist/230 с и попадает с шансом
   ~60 %: так у игрока есть время уехать, а не получать урон мгновенно.
   Урон игроку 6–12 при прочности 100. Противник — обычный разрушаемый объект в
   массиве ba (kind:"enemy"), поэтому попадания считает штатный ch(); хук ниже
   только начисляет уничтожение и проверяет условия победы.
   ========================================================================== */
const VCH_AI={
  on:!1,enemies:[],incoming:[],max:3,kills:0,shots:0,hits:0,time:0,
  hp:100,hpMax:100,over:!1,acc:0,diff:2,key:"vch36.battle.best",
  /* ---- внешний вид: тот же силуэт, что у мишени, но в «вражеской» окраске ---- */
  buildEnemy(){
    const g=new Jt(),
          hull=new fe({color:0x6b3a30,metalness:.35,roughness:.72}),
          dark=new fe({color:0x2a2426,metalness:.5,roughness:.62}),
          mark=new fe({color:0xd8452e,emissive:0x5a1208,emissiveIntensity:.9,roughness:.6});
    const h=new Lt(new _e(3.2,.95,5.6),hull);h.position.y=.9;g.add(h);
    const skirt=new Lt(new _e(3.6,.42,5.8),dark);skirt.position.y=.42;g.add(skirt);
    const t=new Lt(new _e(2.3,.82,2.7),hull);t.position.set(0,1.66,-.35);g.add(t);
    const gun=new Lt(new mn(.16,.2,3.8,10),dark);
    gun.rotation.x=Math.PI/2;gun.position.set(0,1.76,2.05);g.add(gun);
    const flag=new Lt(new _e(1.1,.5,.07),mark);flag.position.set(0,1.95,-1.7);g.add(flag);
    const lamp=new Lt(new _e(.3,.18,.12),mark);lamp.position.set(1.1,1.15,2.5);g.add(lamp);
    g.traverse(o=>{if(o.isMesh){o.castShadow=!0;o.receiveShadow=!0}});
    return g;
  },
  spawn(x,z,diff){
    const g=this.buildEnemy();
    cn.add(g);
    const y=ge(x,z);
    g.position.set(x,y,z);
    const body=new Et({mass:0,type:(Et.KINEMATIC!==undefined?Et.KINEMATIC:Et.STATIC),
      position:new w(x,y+1,z),angularDamping:.4,linearDamping:.05});
    body.addShape(new ns(new w(1.75,.75,3.0)),new w(0,.75,0));
    body.collisionFilterGroup=is;body.collisionFilterMask=7|VCH_RAMP;
    try{vn.physics.addBody(body)}catch(e){}
    const rec={mesh:g,body,hp:3,destructible:!0,kind:"enemy",dynamic:!1,alive:!0,
               isTarget:!1,points:0,fireT:2+Math.random()*3,speed:6.2+diff*.9,dir:0};
    g.userData.prop=rec;
    ba.push(rec);
    return rec;
  },
  start(n){
    this.clear();
    this.diff=Te.clamp(n||2,1,3);
    const p=qt.group.position;
    for(let i=0;i<this.diff;i++){
      const a=(i/this.diff)*Math.PI*2+.6,rad=88+i*9;
      this.enemies.push(this.spawn(p.x+Math.cos(a)*rad,p.z+Math.sin(a)*rad,this.diff));
    }
    this.on=!0;this.over=!1;this.kills=0;this.shots=0;this.hits=0;this.time=0;
    this.hp=this.hpMax;this.incoming.length=0;this.acc=0;
    document.getElementById("battlepanel")?.classList.remove("hidden");
    document.getElementById("battleover")?.classList.add("hidden");
    document.body.classList.remove("vch-modal");
    this.hud(!0);
    try{an.clank()}catch(e){}
    return this.enemies.length;
  },
  clear(){
    for(const e of this.enemies){
      try{if(e.mesh)cn.remove(e.mesh)}catch(err){}
      try{if(e.body)vn.physics.removeBody(e.body)}catch(err){}
      e.alive=!1;
      const i=ba.indexOf(e);if(i>=0)ba.splice(i,1);
    }
    this.enemies.length=0;this.incoming.length=0;this.on=!1;this.over=!1;
    document.getElementById("battlepanel")?.classList.add("hidden");
    document.getElementById("battleover")?.classList.add("hidden");
  },
  alive(){return this.enemies.filter(e=>e.alive).length},
  /* попадание игрока по противнику (вызывается из хука ch) */
  onHit(){this.hits++},
  onKill(rec,point){
    if(this.over)return;
    this.kills++;
    try{if(point)en.explosion(point,1.4)}catch(e){}
    try{an.explosion(1.3)}catch(e){}
    this.hud(!0);
    if(this.alive()===0)this.finish(!0);
  },
  damagePlayer(n){
    if(this.over)return;
    this.hp=Math.max(0,this.hp-n);
    try{Vr&&Vr.addSpot?.(qt.group.position.x,qt.group.position.z,ge(qt.group.position.x,qt.group.position.z),14)}catch(e){}
    this.hud(!0);
    if(this.hp<=0)this.finish(!1);
  },
  finish(win){
    this.over=!0;this.on=!1;
    let best=0;
    try{best=+localStorage.getItem(this.key)||0}catch(e){}
    const rec=win&&(!best||this.time<best);
    if(rec){try{localStorage.setItem(this.key,String(+this.time.toFixed(2)))}catch(e){}}
    const q=x=>document.getElementById(x);
    if(q("bo-title"))q("bo-title").textContent=win?"ПОБЕДА":"ПОРАЖЕНИЕ";
    if(q("bo-why"))q("bo-why").textContent=win?"ВСЕ ЦЕЛИ УНИЧТОЖЕНЫ":(rec?"":"МАШИНА ПОДБИТА");
    if(q("bo-time"))q("bo-time").textContent=this.time.toFixed(1)+" с"+((win&&rec)?" ★":"");
    if(q("bo-kills"))q("bo-kills").textContent=String(this.kills)+"/"+this.enemies.length;
    if(q("bo-acc"))q("bo-acc").textContent=this.shots?Math.round(this.hits/this.shots*100)+"%":"—";
    q("battleover")?.classList.remove("hidden");
    document.body.classList.add("vch-modal");
    try{an.clank()}catch(e){}
  },
  hud(force){
    const q=x=>document.getElementById(x);
    if(q("benem"))q("benem").textContent=this.alive()+"/"+this.enemies.length;
    if(q("bhp"))q("bhp").textContent=String(Math.round(this.hp));
    if(q("bhpbar"))q("bhpbar").style.width=Math.max(0,this.hp/this.hpMax*100).toFixed(0)+"%";
    if(q("btime"))q("btime").textContent=this.time.toFixed(1);
  },
  tick(dt){
    if(!this.on)return;
    this.time+=dt;
    const p=qt.group.position;
    for(const e of this.enemies){
      if(!e.alive)continue;
      const ex=e.mesh.position.x,ez=e.mesh.position.z,
            dx=p.x-ex,dz=p.z-ez,d=Math.hypot(dx,dz)||1,
            yaw=Math.atan2(dx,dz);
      /* --- доворот корпуса (плавно) и ход: держим дистанцию 38–65 м --- */
      let cur=e.mesh.rotation.y,dv=yaw-cur;
      while(dv>Math.PI)dv-=Math.PI*2;while(dv<-Math.PI)dv+=Math.PI*2;
      const ny=cur+Te.clamp(dv,-1.1*dt,1.1*dt);
      e.mesh.rotation.y=ny;
      let mv=0;
      if(d>65)mv=1;else if(d<38)mv=-1;
      if(mv!==0&&Math.abs(dv)<1.25){
        const nx=ex+Math.sin(ny)*e.speed*mv*dt,nz=ez+Math.cos(ny)*e.speed*mv*dt;
        e.mesh.position.set(nx,ge(nx,nz),nz);
        if(e.body){
          e.body.position.set(nx,e.mesh.position.y+1,nz);
          e.body.aabbNeedsUpdate=!0;
          try{e.body.quaternion.setFromAxisAngle(new w(0,1,0),ny)}catch(err){}
        }
      }
      /* --- огонь --- */
      e.fireT-=dt;
      if(e.fireT<=0&&d<95&&Math.abs(dv)<.35){
        e.fireT=5+Math.random()*2.5;
        const mz=new P(e.mesh.position.x,1.8,e.mesh.position.z),
              tgt=new P(p.x,1.2,p.z),dir=tgt.clone().sub(mz).normalize();
        try{en.muzzleBurst(mz,dir)}catch(err){}
        try{an.explosion(.55)}catch(err){}
        this.incoming.push({t:d/230,dmg:6+Math.random()*6});
      }
    }
    /* --- прилёт снарядов противника --- */
    for(let i=this.incoming.length-1;i>=0;i--){
      const s2=this.incoming[i];s2.t-=dt;
      if(s2.t<=0){
        this.incoming.splice(i,1);
        if(Math.random()<.6)this.damagePlayer(s2.dmg);
      }
    }
    this.acc+=dt;
    if(this.acc>.1){this.acc=0;this.hud()}
  }
};
