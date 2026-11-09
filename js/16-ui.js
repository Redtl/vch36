/* ==========================================================================
   vch36 · js/16-ui.js
   пауза, громкость, настройки, доска рекордов
   Из index.html (4.2 «разбиение на модули»). Порядок загрузки задан в index.html
   тегами <script defer>; «use strict» сохранён — исходный код был модулем.
   ========================================================================== */
"use strict";


/* ============================================================================
   1.2/1.3  ПАУЗА + громкость (частичный пункт 1.3: качество/чувствительность —
   следующим шагом, здесь то, что нужно стрельбищу и базовому комфорту)
   ========================================================================== */
const VCH_PAUSE={
  on:!1,
  toggle(force){
    this.on=force===undefined?!this.on:!!force;
    window.__vchPaused=this.on;      /* читается главным циклом (см. np) */
    document.body.classList.toggle("vch-modal",this.on);
    const m=document.getElementById("pausemenu");
    if(m)m.classList.toggle("hidden",!this.on);
    if(this.on){
      try{an.engineLevel.gain.value=0;an.soilLevel.gain.value=0}catch(e){}
      document.exitPointerLock?.();
    }
    return this.on;
  }
};
/* громкость: сохранение в localStorage (пункт 6.4 — начало) */
/* ============================================================================
   1.3  НАСТРОЙКИ: качество графики, чувствительность мыши, локация
   ----------------------------------------------------------------------------
   Всё лежит в одном объекте и в localStorage["vch36.settings"]. Качество —
   это ступень уже существующей лестницы V_Q_STEPS (0 высокая … 3 низкая),
   плюс режим «авто», в котором работает старый адаптер vAdapt(dt) по FPS.
   В ручном режиме адаптер отключается, иначе он будет спорить с игроком.
   ========================================================================== */
const VCH_SETTINGS={
  key:"vch36.settings",
  q:"auto",            /* "auto" | "0" высокое | "2" среднее | "3" низкое */
  sens:1,              /* множитель чувствительности мыши */
  load(){
    let d={};
    try{d=JSON.parse(localStorage.getItem(this.key)||"{}")||{}}catch(e){d={}}
    if(d.q===undefined)d.q="auto";
    this.q=String(d.q);
    this.sens=+d.sens>0?+d.sens:1;
    return this;
  },
  save(){
    try{localStorage.setItem(this.key,JSON.stringify({q:this.q,sens:this.sens}))}catch(e){}
  },
  /* качество: «авто» — отдаём управление vAdapt, иначе фиксируем ступень */
  applyQ(){
    const auto=this.q==="auto";
    window.__vchQFix=!auto;                 /* см. vAdapt(): ручной режим = стоп */
    VCH_SENS=this.sens;
    const sensEl=document.getElementById("pm-sens"),sensV=document.getElementById("pm-sensv");
    if(sensEl)sensEl.value=String(Math.round(this.sens*100));
    if(sensV)sensV.textContent=this.sens.toFixed(2);
    const seg=document.getElementById("pm-q");
    if(seg)for(const b of seg.children)b.classList.toggle("on",b.dataset.q===this.q);
    if(!auto&&typeof vApplyQ==="function")vApplyQ(parseInt(this.q,10)||0);
  },
  setQ(q){this.q=String(q);this.save();this.applyQ()},
  setSens(v){this.sens=Te.clamp(+v||1,.3,2.5);this.save();this.applyQ()},
  goMap(key){
    const cur=new URLSearchParams(location.search).get("map")||"polygon";
    if(cur===key)return;
    try{localStorage.setItem("vch36.map",key)}catch(e){}
    const u=new URL(location.href);u.searchParams.set("map",key);
    /* 6.2: сначала гасим картинку, потом перезагружаемся — без белой вспышки */
    VCH_FADE.to(()=>{location.href=u.href},320);
  }
};

const VCH_VOL={master:50,engine:100,shot:100,
  apply(){
    try{
      an.master.gain.value=this.master/100;
      an.shotBus.gain.value=.75*(this.shot/100);
      this._engineK=this.engine/100;
    }catch(e){}
  },
  save(){try{localStorage.setItem("vch36.vol",JSON.stringify({master:this.master,engine:this.engine,shot:this.shot}))}catch(e){}},
  load(){
    try{
      const j=JSON.parse(localStorage.getItem("vch36.vol")||"null");
      if(j){this.master=j.master??50;this.engine=j.engine??100;this.shot=j.shot??100}
    }catch(e){}
    const map=[["pm-vol","master"],["pm-eng","engine"],["pm-shot","shot"]];
    for(const [id,k] of map){
      const el=document.getElementById(id);
      if(el){
        el.value=this[k];
        el.addEventListener("input",()=>{this[k]=+el.value;this.apply();this.save()});
      }
    }
    this.apply();
  }
};
