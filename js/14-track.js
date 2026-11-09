/* ==========================================================================
   vch36 · js/14-track.js
   режим «трасса»
   Из index.html (4.2 «разбиение на модули»). Порядок загрузки задан в index.html
   тегами <script defer>; «use strict» сохранён — исходный код был модулем.
   ========================================================================== */
"use strict";


/* ============================================================================
   3.2  ТРАССА: ворота, время, штраф за опрокидывание
   ----------------------------------------------------------------------------
   Кольцо из 10 ворот по полигону. Порядок строгий: засчитываются только ворота
   с текущим номером, поэтому срезать нельзя. Время идёт с первого кадра заезда;
   опрокидывание корпуса (вектор «вверх» ушёл ниже 0.35 от мировой вертикали и
   держится так дольше 1.2 с) добавляет 5 с к итогу. Рекорд — в
   localStorage["vch36.track.best"]. Ворота — три бокса (две стойки и
   перекладина) со светящимся материалом: следующий ореол пульсирует, пройденные
   гаснут.
   ========================================================================== */
const VCH_TRACK={
  key:"vch36.track.best",
  on:!1,gates:[],idx:0,time:0,penalty:0,rollT:0,hudAcc:0,flash:0,
  /* маршрут: кольцо по полигону, радиус чередуется 78/96 м */
  route(){
    const r=[],N=10;
    for(let i=0;i<N;i++){
      const a=i/N*Math.PI*2,rad=(i%2)?96:78;
      r.push({x:Math.cos(a)*rad,z:Math.sin(a)*rad,yaw:a+Math.PI/2});
    }
    return r;
  },
  gateMat(){return new fe({color:0x184b33,emissive:0x2aff7f,emissiveIntensity:.5,
                            roughness:.6,metalness:.1})},
  makeGate(g,i){
    const w=4.6,h=6.0,mat=this.gateMat(),meshes=[],
          px=Math.cos(g.yaw),pz=-Math.sin(g.yaw),            /* поперёк маршрута */
          y=ge(g.x,g.z);
    for(const side of[-1,1]){
      const m=new Lt(new _e(.3,h,.3),mat);
      m.position.set(g.x+px*w*side,y+h/2,g.z+pz*w*side);
      m.castShadow=!1;m.receiveShadow=!1;cn.add(m);meshes.push(m);
    }
    const bar=new Lt(new _e(w*2+.4,.3,.3),mat);
    bar.position.set(g.x,y+h,g.z);bar.rotation.y=g.yaw;
    bar.castShadow=!1;cn.add(bar);meshes.push(bar);
    return {x:g.x,z:g.z,mat,meshes,i};
  },
  highlight(){
    const pulse=1.25+.35*Math.sin(performance.now()*.006);
    for(const g of this.gates){
      const k=g.i===this.idx?pulse:g.i<this.idx?.12:.5;
      g.mat.emissiveIntensity=k;
      g.mat.color.setHex(g.i<this.idx?0x14301f:0x184b33);
    }
  },
  start(){
    this.clear();
    this.gates=this.route().map((g,i)=>this.makeGate(g,i));
    this.idx=0;this.time=0;this.penalty=0;this.rollT=0;this.hudAcc=0;this.on=!0;
    this.highlight();this.hud(!0);
    document.getElementById("trackpanel")?.classList.remove("hidden");
    document.getElementById("trackover")?.classList.add("hidden");
    try{an.clank()}catch(e){}
  },
  clear(){
    for(const g of this.gates)for(const m of g.meshes){cn.remove(m);m.geometry.dispose()}
    this.gates=[];this.on=!1;this.idx=0;this.time=0;this.penalty=0;this.rollT=0;
    document.getElementById("trackpanel")?.classList.add("hidden");
    document.getElementById("trackover")?.classList.add("hidden");
  },
  finish(why){
    const total=this.time+this.penalty;
    const best=this.best();
    const rec=!best||total<best;
    if(rec){try{localStorage.setItem(this.key,String(+total.toFixed(2)))}catch(e){}}
    const q=x=>document.getElementById(x);
    if(q("to-why"))q("to-why").textContent=why||"ФИНИШ";
    if(q("to-time"))q("to-time").textContent=total.toFixed(2)+" с";
    if(q("to-pen"))q("to-pen").textContent=this.penalty.toFixed(0)+" с";
    if(q("to-best"))q("to-best").textContent=(rec?"★ ":"")+(rec?total:best).toFixed(2)+" с";
    q("trackover")?.classList.remove("hidden");
    document.body.classList.add("vch-modal");
    this.on=!1;
    try{an.clank()}catch(e){}
  },
  best(){try{return +localStorage.getItem(this.key)||0}catch(e){return 0}},
  stop(why){
    if(!this.on)return;
    this.finish(why||"ОСТАНОВЛЕНО");
    this.on=!1;
  },
  hud(force){
    const q=x=>document.getElementById(x);
    if(q("tgate"))q("tgate").textContent=Math.min(this.idx+1,this.gates.length)+"/"+this.gates.length;
    if(q("ttime"))q("ttime").textContent=this.time.toFixed(1);
    if(q("tpen"))q("tpen").textContent=this.penalty.toFixed(0)+" с"+(this.flash>0?" ▲":"");
  },
  tick(dt){
    if(!this.on)return;
    this.time+=dt;this.flash=Math.max(0,this.flash-dt);
    /* --- опрокидывание --- */
    try{
      const q=new gn(),up=new P(0,1,0);
      qt.group.getWorldQuaternion(q);up.applyQuaternion(q);
      if(up.y<.35){
        this.rollT+=dt;
        if(this.rollT>1.2){this.rollT=0;this.penalty+=5;this.flash=1.6;an.clank()}
      }else this.rollT=0;
    }catch(e){}
    /* --- ворота по порядку --- */
    const g=this.gates[this.idx];
    if(g){
      const p=qt.group.position,
            d=Math.hypot(p.x-g.x,p.z-g.z);
      if(d<7){
        this.idx++;
        try{an.clank()}catch(e){}
        this.highlight();this.hud(!0);
        if(this.idx>=this.gates.length){this.finish("ФИНИШ");return}
      }
    }else{
      /* подсветка следующего ореола — раз в кадр дёшево, но пульс считаем 6 Гц */
      this.hudAcc+=dt;
      if(this.hudAcc>.16){this.hudAcc=0;this.highlight()}
    }
    this.hudAcc+=dt;
    if(this.hudAcc>.1){this.hudAcc=0;this.hud()}
  },
  /* ближайшие ворота — для миникарты */
  nextPos(){const g=this.gates[this.idx];return g?{x:g.x,z:g.z}:null}
};
