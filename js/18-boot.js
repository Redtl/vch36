/* ==========================================================================
   vch36 · js/18-boot.js
   инициализация UI, клавиши, Service Worker
   Из index.html (4.2 «разбиение на модули»). Порядок загрузки задан в index.html
   тегами <script defer>; «use strict» сохранён — исходный код был модулем.
   ========================================================================== */
"use strict";



/* ---- инициализация UI и клавиш -------------------------------------------- */
(function vchUIInit(){
  VCH_HUD.init();
  VCH_VOL.load();
  VCH_FADE.init();
  VCH_TOUCH.init();
  VCH_FADE.from(300);                 /* старт «из затемнения» */
  const q=x=>document.getElementById(x);

  /* ---- 6.4: восстанавливаем окраску и вид камеры ---- */
  try{
    const liv=localStorage.getItem("vch36.livery");
    if(liv&&VCH_LIVERY_KEYS.includes(liv)&&liv!==VCH_LIVERY_ON){VCH_LIVERY_ON=liv;vchLiveryApply()}
    const cam=parseInt(localStorage.getItem("vch36.cam")||"0",10);
    if(cam>0&&cam<3)Pr(cam);
  }catch(e){}

  /* ---- 1.3: качество / чувствительность / локация ---- */
  VCH_SETTINGS.load().applyQ();
  const qseg=q("pm-q");
  if(qseg)for(const b of qseg.children)
    b.addEventListener("click",()=>VCH_SETTINGS.setQ(b.dataset.q));
  const sens=q("pm-sens");
  if(sens){
    sens.value=String(Math.round(VCH_SETTINGS.sens*100));
    sens.addEventListener("input",()=>{
      VCH_SETTINGS.sens=Te.clamp(+sens.value/100,.3,2.5);
      VCH_SENS=VCH_SETTINGS.sens;                 /* сразу, без перезагрузки */
      const l=q("pm-sensv");if(l)l.textContent=VCH_SETTINGS.sens.toFixed(2);
    });
    sens.addEventListener("change",()=>VCH_SETTINGS.save());
  }
  /* звук один — профиль из присланной версии (index (49).html), переключать нечего */
  const mseg=q("pm-map"),curMap=(typeof VCH_MAP_KEY==="string")?VCH_MAP_KEY:(new URLSearchParams(location.search).get("map")||"aleksandrovsk");
  if(mseg){
    for(const b of mseg.children){
      b.classList.toggle("on",b.dataset.map===curMap);
      b.addEventListener("click",()=>VCH_SETTINGS.goMap(b.dataset.map));
    }
  }
  q("ro-again")?.addEventListener("click",()=>{q("rangeover")?.classList.add("hidden");VCH_RANGE.start()});
  q("ro-close")?.addEventListener("click",()=>{q("rangeover")?.classList.add("hidden");VCH_RANGE.clear()});
  q("pm-resume")?.addEventListener("click",()=>VCH_PAUSE.toggle(!1));
  q("pm-garage")?.addEventListener("click",()=>{VCH_PAUSE.toggle(!1);window.__vchGarage&&window.__vchGarage.open&&window.__vchGarage.open()});
  q("pm-range")?.addEventListener("click",()=>{VCH_PAUSE.toggle(!1);VCH_TRACK.clear();VCH_RANGE.start()});
  q("pm-track")?.addEventListener("click",()=>{VCH_PAUSE.toggle(!1);VCH_RANGE.clear();VCH_TRACK.start()});
  q("pm-battle")?.addEventListener("click",()=>{VCH_PAUSE.toggle(!1);VCH_RANGE.clear();VCH_TRACK.clear();VCH_AI.start(2)});
  q("bo-again")?.addEventListener("click",()=>{VCH_AI.start(VCH_AI.diff||2)});
  q("bo-close")?.addEventListener("click",()=>{VCH_AI.clear();document.body.classList.remove("vch-modal")});
  q("to-again")?.addEventListener("click",()=>{VCH_TRACK.start()});
  q("to-close")?.addEventListener("click",()=>{VCH_TRACK.clear();document.body.classList.remove("vch-modal")});
  q("pm-reset")?.addEventListener("click",()=>{VCH_RANGE.resetRecords();
    try{localStorage.removeItem(VCH_TRACK.key)}catch(e){};});
  window.addEventListener("keydown",e=>{
    const inGarage=typeof J!=="undefined"&&!J.started;
    if(e.code==="Escape"){
      e.preventDefault();
      if(inGarage){window.__vchGarage&&window.__vchGarage.closeHelp&&window.__vchGarage.closeHelp();return}
      if(!document.getElementById("rangeover")?.classList.contains("hidden")){
        document.getElementById("rangeover").classList.add("hidden");VCH_RANGE.clear();return;
      }
      if(!document.getElementById("battleover")?.classList.contains("hidden")){
        document.getElementById("battleover").classList.add("hidden");
        VCH_AI.clear();document.body.classList.remove("vch-modal");return;
      }
      if(!document.getElementById("trackover")?.classList.contains("hidden")){
        document.getElementById("trackover").classList.add("hidden");
        VCH_TRACK.clear();document.body.classList.remove("vch-modal");return;
      }
      VCH_PAUSE.toggle();
    }
    if(inGarage)return;
    if(e.code==="KeyB"&&!e.repeat){
      e.preventDefault();
      if(VCH_AI.on)VCH_AI.clear();
      else{VCH_PAUSE.toggle(!1);VCH_RANGE.clear();VCH_TRACK.clear();VCH_AI.start(2)}
    }
    if(e.code==="KeyK"&&!e.repeat){
      e.preventDefault();
      if(VCH_TRACK.on)VCH_TRACK.stop("ОСТАНОВЛЕНО ИГРОКОМ");
      else{VCH_PAUSE.toggle(!1);VCH_RANGE.clear();VCH_AI.clear();VCH_TRACK.start()}
    }
    if(e.code==="KeyP"&&!e.repeat){
      e.preventDefault();
      if(VCH_RANGE.on)VCH_RANGE.stop("ОСТАНОВЛЕНО ИГРОКОМ");
      else{VCH_PAUSE.toggle(!1);VCH_TRACK.clear();VCH_AI.clear();VCH_RANGE.start()}
    }
  },!0);
})();

/* доска рекордов/настройки доступны и из консоли */
window.__vchUI={hud:VCH_HUD,range:VCH_RANGE,pause:VCH_PAUSE,vol:VCH_VOL,settings:VCH_SETTINGS,track:VCH_TRACK,ai:VCH_AI,aud:VCH_AUD,audio:an,scene:cn,world:vn,chassis:Ce,rig:()=>qt,props:ba,destroy:(...a)=>ch(...a),crushTick:(...a)=>X1(...a),camFov:()=>ye.fov,tw:()=>({ok:VCH_TWok,bad:VCH_TWbad,err:VCH_TWerr,live:!!VCH_TW}),touch:VCH_TOUCH,fade:VCH_FADE,cam:(m)=>{Pr(m);return ye.fov}};

/* ---- метка сборки: по ней видно, какой код реально запущен ---------------- */
window.__vchBuild="50 · репозиторий vch36 · модули + рассвет";
{const el=document.getElementById("pm-build");
 if(el)el.textContent=(window.__vchBuild||"").toUpperCase();}
try{console.log("%c[vch] сборка "+window.__vchBuild,"color:#ff8a1f;font-weight:bold")}catch(_){}

/* ---- Service Worker: офлайн-кэш оболочки (2.1) ---------------------------
   Регистрация с updateViaCache:"none" + перезагрузка при смене контроллера:
   новая сборка подхватывается с первого же открытия, без «кэш на один
   перезапуск отстаёт». Кнопка сброса: __vchCacheReset(). */
if("serviceWorker" in navigator && location.protocol.startsWith("http")){
  const hadController=!!navigator.serviceWorker.controller;
  navigator.serviceWorker.addEventListener("controllerchange",()=>{
    if(!hadController)return;
    if(sessionStorage.getItem("vch.sw.reloaded"))return;
    sessionStorage.setItem("vch.sw.reloaded","1");
    location.reload();
  });
  const swRegister=()=>{
    navigator.serviceWorker.register("sw.js",{updateViaCache:"none"}).catch(err=>console.warn("[sw]",err));
  };
  /* 4.3: код подключается загрузчиком, поэтому событие load могло уже пройти */
  if(document.readyState==="complete")swRegister();
  else window.addEventListener("load",swRegister);
}
/* Полный сброс кэша (консоль или пауза): снимает SW, чистит Cache Storage.
   После перезагрузки браузер гарантированно берёт файлы с сервера. */
window.__vchCacheReset=async function(){
  try{
    const regs=await navigator.serviceWorker.getRegistrations();
    await Promise.all(regs.map(r=>r.unregister()));
    const keys=await caches.keys();
    await Promise.all(keys.map(k=>caches.delete(k)));
    sessionStorage.removeItem("vch.sw.reloaded");
  }catch(err){console.warn("[vch] сброс кэша",err)}
  location.reload();
};

/* 4.2: все модули загружены — разрешаем кадры (см. np() в 08-scorpion.js). */
window.__vchBooted=!0;
