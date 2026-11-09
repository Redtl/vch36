/* ==========================================================================
   vch36 · js/09-fleet.js
   реестр танков и переключение
   Из index.html (4.2 «разбиение на модули»). Порядок загрузки задан в index.html
   тегами <script defer>; «use strict» сохранён — исходный код был модулем.
   ========================================================================== */
"use strict";


/* ============================================================================
   VCH · РЕЕСТР ТАНКОВ (ОБТ-36 + Scorpion), переключение, ИИ, пыль
   ========================================================================== */
const VCH_TANKS=[];
let VCH_ACTIVE=null,VCH_PENDING=-1;
const VCH_OBT={id:"obt",name:"ОБТ «36»",phys:Ce,rig:qt,aim:{},wpn:{},aiEnabled:!0};
VCH_TANKS.push(VCH_OBT);VCH_ACTIVE=VCH_OBT;

function vchSaveState(t){
  if(!t)return;
  t.aim.turretYaw=J.turretYaw;t.aim.elevation=J.elevation;
  t.aim.aimAzWorld=J.aimAzWorld;t.aim.keyAimT=J.keyAimT;
  t.aim.smoothThrottle=J.smoothThrottle;t.aim.smoothSteer=J.smoothSteer;
  t.aim.stabilizer=J.stabilizer;
  t.wpn.ammo=J.ammo;t.wpn.ammoMax=J.ammoMax;t.wpn.reload=J.reload;t.wpn.ammoRefill=J.ammoRefill;
}
function vchRestoreState(t){
  const a=t.aim||{},p=t.wpn||{};
  const num=(v,d)=>(typeof v==="number"&&isFinite(v))?v:d;
  J.turretYaw=num(a.turretYaw,J.turretYaw);
  J.elevation=num(a.elevation,J.elevation);
  J.aimAzWorld=num(a.aimAzWorld,J.aimAzWorld);
  J.keyAimT=num(a.keyAimT,0);
  J.smoothThrottle=0;J.smoothSteer=0;
  J.stabilizer=a.stabilizer!==undefined?a.stabilizer:J.stabilizer;
  J.ammo=num(p.ammo,J.ammoMax||22);J.ammoMax=num(p.ammoMax,22);
  J.reload=num(p.reload,0);J.ammoRefill=num(p.ammoRefill,0);
}
function vchTankBadge(){
  const el=document.getElementById("tankname");
  if(el){
    const extra=VCH_TANKS.length>1?"  ·  TAB — СМЕНА ТАНКА":"";
    el.textContent="ТАНК: "+(VCH_ACTIVE?VCH_ACTIVE.name:"—")+extra;
  }
  /* плашка в левом верхнем углу — по активному танку */
  const bl=document.querySelector("#topbar .brand-line"),
        bs=document.querySelector("#topbar .brand-sub");
  if(bl&&bs&&VCH_ACTIVE){
    const sc=VCH_ACTIVE.id==="scorpion";
    bl.innerHTML=sc?"SCORPION":"ОБТ&nbsp;«36»";
    bs.innerHTML=sc?"ТЯЖЁЛЫЙ ТАНК":"Т-36М «ГРОЗА» · 125&nbsp;мм&nbsp;2А82";
  }
}
function setActiveTank(idx){
  const t=VCH_TANKS[idx];
  if(!t||t===VCH_ACTIVE)return!1;
  vchSaveState(VCH_ACTIVE);
  VCH_ACTIVE.phys.setInput(0,0);
  VCH_ACTIVE=t;
  Ce=t.phys;qt=t.rig;
  vchRestoreState(t);
  if(qt.turret)qt.turret.rotation.y=J.turretYaw;
  if(qt.gunPivot)qt.gunPivot.rotation.x=-J.elevation;
  if(qt.turretStab&&qt.turretStab.quaternion)qt.turretStab.quaternion.set(0,0,0,1);
  J.camSwitch=2;
  vchTankBadge();
  return!0;
}
function vchCycleTank(){
  if(VCH_TANKS.length<2)return;
  setActiveTank((VCH_TANKS.indexOf(VCH_ACTIVE)+1)%VCH_TANKS.length);
}
