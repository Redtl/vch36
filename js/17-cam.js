/* ==========================================================================
   vch36 · js/17-cam.js
   камера: FOV, затемнение, тач-управление
   Из index.html (4.2 «разбиение на модули»). Порядок загрузки задан в index.html
   тегами <script defer>; «use strict» сохранён — исходный код был модулем.
   ========================================================================== */
"use strict";


/* ============================================================================
   6.1  Плавное фокусное расстояние
   ----------------------------------------------------------------------------
   Раньше Pr() ставил ye.fov мгновенно, и переключение «командирский → прицел»
   было резким скачком. Теперь Pr() задаёт только цель, а кадр тянет значение
   экспонентой (≈0.11 с до 90 %) и обновляет матрицу, когда разница заметна.
   ========================================================================== */
function VCH_camFX(dt){
  const tgt=(typeof window!=="undefined"&&window.__vchGarage&&window.__vchGarage.active)?44:J.fovTarget;
  if(!Number.isFinite(tgt))return;
  if(Math.abs(ye.fov-tgt)>.01){
    ye.fov+=(tgt-ye.fov)*Math.min(1,dt*9);
    ye.updateProjectionMatrix();
  }else if(ye.fov!==tgt){ye.fov=tgt;ye.updateProjectionMatrix()}
}

/* ============================================================================
   6.2  Затемнение при смене локации и перезапуске
   ========================================================================== */
const VCH_FADE={
  el:null,
  init(){this.el=document.getElementById("fade")},
  /* затемнить, выполнить действие, вернуть картинку */
  to(cb,ms=300){
    if(!this.el)this.init();
    if(!this.el){cb&&cb();return}
    this.el.classList.add("on");
    setTimeout(()=>{try{cb&&cb()}catch(e){}},ms);
  },
  from(ms=380){if(this.el)setTimeout(()=>this.el.classList.remove("on"),ms)},
  clear(){this.el&&this.el.classList.remove("on")}
};

/* ============================================================================
   6.3  Тач-управление: стик хода, огонь, пауза, смена вида
   ========================================================================== */
const VCH_TOUCH={
  on:!1,throttle:0,steer:0,pid:null,cx:0,cy:0,R:52,
  init(){
    const root=document.getElementById("touch");
    if(!root)return;
    const coarse=(window.matchMedia&&matchMedia("(pointer:coarse)").matches)||("ontouchstart" in window);
    if(!coarse){root.classList.add("hidden");return}
    this.on=!0;root.classList.remove("hidden");
    const stick=document.getElementById("tstick"),
          knob=document.getElementById("tknob"),
          fire=document.getElementById("tfire");
    const set=(dx,dy)=>{
      const d=Math.hypot(dx,dy)||1,k=Math.min(1,this.R/d);
      const kx=dx*k,ky=dy*k;
      knob.style.transform=`translate(${kx.toFixed(1)}px,${ky.toFixed(1)}px)`;
      this.steer=Te.clamp(kx/this.R,-1,1);
      this.throttle=Te.clamp(-ky/this.R,-1,1);
    };
    stick.addEventListener("pointerdown",e=>{
      e.preventDefault();this.pid=e.pointerId;stick.setPointerCapture(e.pointerId);
      const r=stick.getBoundingClientRect();this.cx=r.left+r.width/2;this.cy=r.top+r.height/2;
      set(e.clientX-this.cx,e.clientY-this.cy);
    });
    stick.addEventListener("pointermove",e=>{
      if(e.pointerId!==this.pid)return;
      e.preventDefault();set(e.clientX-this.cx,e.clientY-this.cy);
    });
    const end=e=>{
      if(this.pid!==null&&e.pointerId!==this.pid)return;
      this.pid=null;this.throttle=0;this.steer=0;
      knob.style.transform="translate(0,0)";
    };
    stick.addEventListener("pointerup",end);
    stick.addEventListener("pointercancel",end);
    stick.addEventListener("pointerleave",end);
    fire.addEventListener("pointerdown",e=>{
      e.preventDefault();fire.classList.add("act");
      try{Xs.left=!0;lh()}catch(err){}
    });
    const rel=e=>{fire.classList.remove("act");Xs.left=!1};
    fire.addEventListener("pointerup",rel);
    fire.addEventListener("pointercancel",rel);
    fire.addEventListener("pointerleave",rel);
    document.getElementById("tmenu")?.addEventListener("click",()=>VCH_PAUSE.toggle());
    document.getElementById("tcams")?.addEventListener("click",()=>Pr((J.cameraMode+1)%3));
    /* первым касанием разрешаем звук — иначе AudioContext остаётся suspended */
    window.addEventListener("pointerdown",()=>{try{an.init()}catch(e){}},{once:!0});
  }
};
