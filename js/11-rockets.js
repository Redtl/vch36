/* ==========================================================================
   vch36 · js/11-rockets.js
   ракетная установка: кассеты, пуск, полёт, подрыв
   Из index.html (4.2 «разбиение на модули»). Порядок загрузки задан в index.html
   тегами <script defer>; «use strict» сохранён — исходный код был модулем.
   ========================================================================== */
"use strict";
/* ============================================================================
   РАКЕТНАЯ УСТАНОВКА СКОРПИОНА
   В башне лежит Rocket_Module_Low: пять стеллажей Rocket_01..05_Low, в каждом
   по две пусковые ячейки (левый и правый борт). Итого 10 готовых ракет.
   Управление: ПРОБЕЛ — удержание = захват и наведение (башня доворачивается на
   цель), отпускание = залп по захваченной цели. Цели — всё, что ломается.
   Полёт: газогенераторный выброс из ячейки вверх, затем запуск двигателя,
   тяга + аэродинамическое сопротивление + гравитация, наведение по методу
   пропорциональной навигации с ограничением перегрузки и скорости доворота
   корпуса; подрыв по контактному/неконтактному взрывателю.
   ========================================================================== */
const VCH_RK={
  ready:!1, rig:null, racks:[], tubes:[], missiles:[], puffs:[], puffI:0,
  range:170, lockTime:.8, reload:26, gap:.12,
  ejectT:.42, ejectV:16,
  thrust:1900, burnT:1.6, dryM:10.2, fuelM:4.6, pitchT:1.0, maxGPitch:26, turnRateV:3.4,
  kDrag:.0058, pn:3.4, maxG:34, turnRate:3.2, fuze:4.2, life:16, blastR:5.5,
  /* навесная траектория: после схода с направляющей ракета уходит вверх и
     выходит на цель сверху. Набор тем сильнее, чем дальше цель; если цель
     ниже точки пуска — горки нет, иначе ракета пролетает над низиной. */
  climbT:1.8, climbG:30, climbSpan:120, diveDist:70, launchUp:.9, pnDist:95, pnHerr:.34,
  ceilingK:.15,          /* потолок горки — доля от дальности до цели */
  ceilingMax:15,         /* м · жёсткий потолок: выше ракета не успевает спикировать */
  fadeOut:25,            /* м до предела дальности, где горка уже не нужна */
  held:!1, wasHeld:!1, lock:0, state:"idle", salvo:[], fireT:0,
  pods:[], podsUp:0, elevT:35, elev:0, deployT:.55, stowT:.7, straighten:3.0, turnRateV:5.0, turnRateW:2.6, pitchG:22,
  target:null, tpos:new P(), tvel:new P(), reloadT:0, hint:"", shotsFired:0, lastHit:null
};
window.__vchRK=VCH_RK;
const VCH_RK_UP=new P(0,1,0),VCH_RK_Z=new P(0,0,1);
/* Пусковые установки: две коробки по 5 труб на подъёмниках в корме башни.
   В походном положении лежат на задней плите, при удержании ПРОБЕЛА
   выезжают вверх и открывают трубы. Размеры — в системе координат башни. */
const VCH_RK_POD={w:.70,h:.40,d:.80,x:1.00,z:-1.34,y:.19,rise:.55,tubes:5};

/* ---- инициализация по ригу Скорпиона ------------------------------------- */
/* ================= РАКЕТНАЯ КАССЕТА ИЗ МОДЕЛИ (v30) =========================
   В Scorpion4.glb есть готовый узел Rocket_Module_Low: силовой корпус,
   пять ракет Rocket_01..05_Low, пенал Rockets_case_Low, лобовая плита и
   осевой привод. Ниша закрыта бронёй Side_armor_01..03_Low + Side_cap_Low.
   Механика — только ВРАЩЕНИЕ вокруг одной поперечной оси (X башни):
   ось проходит через центры окружностей-цапф по бокам кассет (Side cap_Low),
   кассета откидывается НОСОМ ВВЕРХ (торцы ракет вверх), корма опускается
   в нишу, и остаётся в этом положении на время стрельбы. Ничего не выдвигается. */
const VCH_RK_SC={
  roll:1.05,          /* угол откидывания кассеты, рад (60°) — встаёт над башней */
  rollT:1.10,         /* время хода, с */
  coverAng:0,         /* отдельных бронекрышек нет: кассета выходит из-под брони сама */
  coverT:.65,
  mirror:!1,          /* обе кассеты откидываются одинаково (носом вверх) */
  axis:"x",           /* ось вращения: "x" поперёк машины, через цапфы */
  origin:"sidecap",   /* точка оси: центры окружностей по бокам кассет (Side cap_Low) */
  sign:-1,            /* нос (торцы ракет) вверх, корма опускается в нишу */
  push:0              /* вылет торцов из плиты, м (по референсу заподлицо) */
};
function vchSetAxisAngle(o,axis,ang){
  o.rotation.x=axis==="x"?ang:0;
  o.rotation.y=axis==="y"?ang:0;
  o.rotation.z=axis==="z"?ang:0;
}
function vchAxisPoint(host,mod,bb,key){
  const c=bb.getCenter(new P());
  /* у узлов glb своя точка вставки не смещена — берём центр их габарита */
  const partCenter=k=>{
    const key=vchScNorm(k);
    let hit=null;
    const scan=root=>root.traverse(o=>{
      if(hit)return;
      const n=vchScNorm(o.name||"");
      if(n===key||n.indexOf(key)===0)hit=o;
    });
    scan(mod); if(!hit)scan(host);
    if(!hit)return null;
    return new Xe().setFromObject(hit).getCenter(new P());
  };
  if(key==="impeller"){
    const p=partCenter("impeller axe")||partCenter("impeller");
    if(p)return p;
  }
  /* цапфенные окружности по бокам кассет: ось идёт через их центры;
   узел Side cap_Low — две шайбы (левая и правая), их общий центр совпадает
   с центром каждой по (x,y), поэтому одной точки хватает на обе кассеты */
  if(key==="sidecap"||key==="cap"||key==="circle"||key==="trunnion"){
    const p=partCenter("Side cap");
    if(p)return p;
  }
  if(key==="front")return new P(c.x,bb.min.y,bb.max.z);
  if(key==="rear")return new P(c.x,bb.min.y,bb.min.z);
  if(key==="case"){
    const p=partCenter("Rockets_case_Low");
    if(p)return p;
  }
  return c;
}

/* ================= ДВЕ КАССЕТЫ ИЗ ОДНОГО МЕША (v32) ========================
   В Scorpion4.glb кассеты сделаны одним узлом Rocket_Module_Low: вершины
   лежат только в двух полосах |x| = 0.8…1.7 м (слева и справа от оси
   башни), а каждая Rocket_0N_Low — это сразу две ракеты, левая и правая.
   Поэтому меш разрезается плоскостью x = 0 на две половины; каждая
   половина становится самостоятельной кассетой со своей осью вращения,
   своими пятью ракетами и своим креном наружу.                            */
/* нарезка геометрии по знаку x в системе башни */
function vchRocketPodSplit(host, mod){
  host.updateWorldMatrix(!0, !0);
  const invHost = new (host.matrixWorld.constructor)().copy(host.matrixWorld).invert();
  const meshes = [];
  mod.traverse(o => {
    if (o.isMesh && o.geometry && o.geometry.attributes && o.geometry.attributes.position) meshes.push(o);
  });
  const rocketTag = o => {
    let p = o;
    while (p && p !== mod.parent) {
      const m = /^rocket0(\d)/.exec(vchScNorm(p && p.name || ""));
      if (m) return +m[1];
      p = p.parent;
    }
    return 0;
  };
  /* имя ближайшего узла-предка (для пометки лобовой плиты) */
  const lidTag = o => {
    let p = o;
    while (p && p !== mod.parent) {
      const n = vchScNorm(p && p.name || "");
      if (n) return n;
      p = p.parent;
    }
    return "";
  };
  const sides = { 1: { items: [], min: [1e9, 1e9, 1e9], max: [-1e9, -1e9, -1e9],
                       lidMin: [1e9, 1e9, 1e9], lidMax: [-1e9, -1e9, -1e9] },
                 "-1": { items: [], min: [1e9, 1e9, 1e9], max: [-1e9, -1e9, -1e9],
                         lidMin: [1e9, 1e9, 1e9], lidMax: [-1e9, -1e9, -1e9] } };
  const v = new P();
  for (const m of meshes) {
    const geo = m.geometry, pos = geo.attributes.position, idx = geo.index;
    const M = new (host.matrixWorld.constructor)().multiplyMatrices(invHost, m.matrixWorld);
    const tri = idx ? idx.count / 3 : pos.count / 3;
    const buckets = { 1: [], "-1": [] };
    for (let t = 0; t < tri; t++) {
      let cx = 0;
      for (let k = 0; k < 3; k++) {
        const i0 = idx ? idx.getX(t * 3 + k) : (t * 3 + k);
        cx += v.fromBufferAttribute(pos, i0).applyMatrix4(M).x;
      }
      buckets[(cx / 3) >= 0 ? 1 : -1].push(t);
    }
    for (const key of [1, -1]) {
      const ts = buckets[key];
      if (!ts.length) continue;
      const g = new (geo.constructor)();
      for (const nm of Object.keys(geo.attributes)) {
        const a = geo.attributes[nm];
        const arr = new a.array.constructor(ts.length * 3 * a.itemSize);
        let w = 0;
        for (const t of ts) for (let k = 0; k < 3; k++) {
          const i0 = idx ? idx.getX(t * 3 + k) : (t * 3 + k);
          for (let c = 0; c < a.itemSize; c++) arr[w++] = a.array[i0 * a.itemSize + c];
        }
        g.setAttribute(nm, new (a.constructor)(arr, a.itemSize, a.normalized));
      }
      const S = sides[key];
      const isLid = lidTag(m).indexOf("frontarmorplate") === 0;
      const ap = g.attributes.position;
      for (let k = 0; k < ap.count; k++) {
        v.fromBufferAttribute(ap, k).applyMatrix4(M);
        const val = [v.x, v.y, v.z];
        for (let c = 0; c < 3; c++) {
          if (val[c] < S.min[c]) S.min[c] = val[c];
          if (val[c] > S.max[c]) S.max[c] = val[c];
          if (isLid) {
            if (val[c] < S.lidMin[c]) S.lidMin[c] = val[c];
            if (val[c] > S.lidMax[c]) S.lidMax[c] = val[c];
          }
        }
      }
      S.items.push({ geo: g, W: m.matrixWorld.clone(), mat: m.material, tag: rocketTag(m),
                     ctor: m.constructor, lid: isLid });
    }
  }
  return sides;
}
function vchRocketModulesFind(host){
  const out = [];
  host.traverse(o => {
    if (vchScNorm(o && o.name || "").indexOf("rocketmodule") !== 0) return;
    for (const p of out) if (p === o.parent) return;
    out.push(o);
  });
  return out;
}
function vchRocketCassetteMake(host){
  const mods = vchRocketModulesFind(host);
  if (!mods.length) return null;
  host.updateWorldMatrix(!0, !0);
  const pods = [];
  for (const mod of mods) {
    const sides = vchRocketPodSplit(host, mod);
    for (const key of [1, -1]) {
      const S = sides[key];
      if (!S.items.length) continue;
      const cx = (S.min[0] + S.max[0]) * .5, cy = (S.min[1] + S.max[1]) * .5, cz = (S.min[2] + S.max[2]) * .5;
      /* ось вращения — по VCH_RK_SC.origin; "inner" = внутренняя нижняя кромка */
      let ox = cx, oy = cy;
      if (VCH_RK_SC.origin === "inner" || VCH_RK_SC.origin === "outer") {
        ox = VCH_RK_SC.origin === "inner" ? (key > 0 ? S.min[0] : S.max[0]) : (key > 0 ? S.max[0] : S.min[0]);
        oy = S.min[1];
      }
      const pivot = new Jt(); pivot.name = "VCH_Cassette" + (key > 0 ? "L" : "R");
      pivot.position.set(ox, oy, cz);
      host.add(pivot); pivot.updateWorldMatrix(!0, !0);
      if (VCH_RK_SC.origin === "impeller" || VCH_RK_SC.origin === "case" ||
          VCH_RK_SC.origin === "sidecap" || VCH_RK_SC.origin === "trunnion") {
        const p = vchAxisPoint(host, mod, new Xe().setFromObject(mod), VCH_RK_SC.origin);
        pivot.position.copy(host.worldToLocal(p.clone()));
        pivot.updateWorldMatrix(!0, !0);
      }
      const invP = new (host.matrixWorld.constructor)().copy(pivot.matrixWorld).invert();
      /* лобовая плита (FrontArmorPlate) — жёсткая часть кассеты: крышки НЕ
         откидываются, плита едет вместе с корпусом кассеты как одно целое */
      const lid = null;
      const byRocket = {};
      for (const it of S.items) {
        const mesh = new (it.ctor)(it.geo, it.mat);
        const local = new (host.matrixWorld.constructor)().multiplyMatrices(invP, it.W);
        local.decompose(mesh.position, mesh.quaternion, mesh.scale);
        if (it.tag) (byRocket[it.tag] = byRocket[it.tag] || []).push({ mesh, W: it.W });
        else pivot.add(mesh);
      }
      /* ракеты: группа на каждую, со своей точкой старта и своей видимостью */
      const rockets = [];
      const tags = Object.keys(byRocket).map(Number).sort((a, b) => a - b);
      for (const tag of tags) {
        const list = byRocket[tag];
        const mn = [1e9, 1e9, 1e9], mx = [-1e9, -1e9, -1e9];
        const vv = new P();
        for (const e of list) {
          const a = e.mesh.geometry.attributes.position;
          for (let k = 0; k < a.count; k++) {
            vv.fromBufferAttribute(a, k).applyMatrix4(e.W).applyMatrix4(invP);
            const val = [vv.x, vv.y, vv.z];
            for (let c = 0; c < 3; c++) { if (val[c] < mn[c]) mn[c] = val[c]; if (val[c] > mx[c]) mx[c] = val[c]; }
          }
        }
        const grp = new Jt(); grp.name = "VCH_Rocket" + (key > 0 ? "L" : "R") + tag;
        grp.position.set((mn[0] + mx[0]) * .5, (mn[1] + mx[1]) * .5, (mn[2] + mx[2]) * .5);
        grp.userData.p0 = grp.position.clone();
        /* ракеты остаются в трубах на штатных местах: вместе с кассетой
           поднимается нос с торцами ракет, ничего никуда не скользит     */
        grp.userData.slide = 0;
        pivot.add(grp); grp.updateWorldMatrix(!0, !0);
        const invG = new (host.matrixWorld.constructor)().copy(grp.matrixWorld).invert();
        for (const e of list) {
          /* матрицу запекаем в геометрию: у части ракет в GLB трансформ со
             сдвигом/зеркалом, decompose() его терял — ракеты левой кассеты
             вставали криво относительно труб */
          const local = new (host.matrixWorld.constructor)().multiplyMatrices(invG, e.W);
          e.mesh.geometry.applyMatrix4(local);
          e.mesh.position.set(0, 0, 0); e.mesh.quaternion.identity(); e.mesh.scale.set(1, 1, 1);
          grp.add(e.mesh);
        }
        rockets.push(grp);
      }
      pods.push({ pivot, mod, rockets, covers: [], lid, side: key, t: 0, roll: 0, elev: 0 });
    }
    /* исходный узел прячем: геометрия уже разложена по кассетам */
    mod.visible = !1;
    mod.userData.__vchHidden = !0;
  }
  if (!pods.length) return null;
  return { pods, covers: [] };
}

function vchRocketInit(rig){
  const RK = VCH_RK;
  RK.ready = !1; RK.rig = rig; RK.tubes.length = 0; RK.missiles.length = 0;
  if (RK.cassette && RK.pods.length) { RK.ready = !0; return }
  vchRocketPodClear();
  if (!rig || !rig.scorpion) return;
  const host = rig.turret || rig.chassis || rig.group;
  host.updateWorldMatrix(!0, !0);
  const make = vchRocketCassetteMake(host);
  if (!make || !make.pods.length) return;
  RK.modules = make.pods;
  RK.covers = make.covers;
  RK.cassette = make.pods[0];
  for (const pod of make.pods) {
    RK.pods.push(pod);
    for (let i = 0; i < pod.rockets.length; i++) {
      const rn = pod.rockets[i];
      RK.tubes.push({ pod, node: pod.pivot, z: 0, tip: rn, i, side: pod.side, spent: !1, rocket: rn });
    }
  }
  if (!RK.tubes.length) return;
  RK.ready = !0;
  vchRocketSmokeInit();
  vchRocketHUD();
  const help = document.getElementById("help");
  if (help && help.innerHTML.indexOf("ПРОБЕЛ") < 0)
    help.innerHTML += '<br /><b>ПРОБЕЛ</b> (Scorpion) — удержание: кассеты откидываются и берут цель, отпускание: залп';
}
/* ---- две пусковые установки ----------------------------------------------
   Корпус установки, рёбра, верхняя плита с пятью гнёздами и готовыми
   ракетами в трубах. Все размеры — в координатах башни (метры).          */
/* снять кассету с петель/pivot и вернуть меши модели на штатные места */
function vchCassetteDetach(C,host){
  if(!C)return;
  /* вернуть исходный узел модели и снять все pivot-кассеты */
  try{
    const RK=VCH_RK;
    for(const p of (RK.pods&&RK.pods.length?RK.pods:[])){
      if(p.mod){p.mod.visible=!0;p.mod.userData.__vchHidden=!1}
      if(p.pivot&&p.pivot.parent)p.pivot.parent.remove(p.pivot);
    }
    if(!RK.pods||!RK.pods.length){
      if(C.mod){C.mod.visible=!0}
      if(C.pivot&&C.pivot.parent)C.pivot.parent.remove(C.pivot);
    }
    RK.covers=[];
    return;
  }catch(e){}
  /* сначала вернуть все углы в нуль, иначе остаточный поворот «запечётся»
     в локальную матрицу меша и при следующей сборке кассета уедет */
  const cvl=VCH_RK.covers||C.covers||[];
  for(const cv of cvl)if(cv.hinge)cv.hinge.rotation.set(0,0,0);
  for(const p of (VCH_RK.pods.length?VCH_RK.pods:[C]))if(p.pivot)p.pivot.rotation.set(0,0,0);
  host.updateWorldMatrix(!0,!0);
  for(const cv of cvl){
    if(!cv.hinge)continue;
    host.attach(cv.node);
    if(cv.hinge.parent)cv.hinge.parent.remove(cv.hinge);
  }
  for(const p of (VCH_RK.pods.length?VCH_RK.pods:[C])){
    if(!p.pivot)continue;
    host.attach(p.mod);
    if(p.pivot.parent)p.pivot.parent.remove(p.pivot);
  }
  VCH_RK.covers=[];
  host.updateWorldMatrix(!0,!0);
}
/* пересобрать кассету с другой осью/точкой оси — для подбора по референсу */
function vchRocketCassetteRebuild(){
  const RK=VCH_RK,rig=RK.rig;
  if(!rig)return null;
  const host=rig.turret||rig.chassis||rig.group;
  if(RK.cassette)vchCassetteDetach(RK.cassette,host);
  RK.cassette=null;RK.modules=[];RK.covers=[];RK.pods.length=0;RK.tubes.length=0;
  vchRocketInit(rig);
  return RK.cassette?{axis:VCH_RK_SC.axis,origin:VCH_RK_SC.origin,
    rockets:RK.cassette.rockets.length,covers:RK.cassette.covers.length}:null;
}
function vchRocketPodClear(){
  const RK=VCH_RK;
  for(const pod of RK.pods){
    if(pod.pivot&&pod.pivot.parent)pod.pivot.parent.remove(pod.pivot);
    if(pod.node&&pod.node.parent&&pod.node!==pod.pivot)pod.node.parent.remove(pod.node);
    if(pod.socket&&pod.socket.parent)pod.socket.parent.remove(pod.socket);
  }
  RK.pods.length=0;
  RK.cassette=null;
}


/* ---- дымный шлейф: собственный пул спрайтов ------------------------------ */
const VCH_RK_PUFFS=520;
function vchRocketSmokeInit(){
  const RK=VCH_RK;
  if(RK.puffs.length)return;
  const tex=en&&en.dustTex?en.dustTex:(en&&en.smokeTex?en.smokeTex:El(128,"rgba(255,255,255,.9)"));
  for(let i=0;i<VCH_RK_PUFFS;i++){
    const s=new cf(new Wl({map:tex,color:0xd2d0cb,transparent:!0,opacity:0,
                           depthWrite:!1,depthTest:!0,toneMapped:!0}));
    s.visible=!1;s.renderOrder=4;cn.add(s);
    RK.puffs.push({s,life:0,max:1,size:1,vel:new P(),drag:1});
  }
}
function vchRocketPuff(pos,vel,opt){
  const RK=VCH_RK;
  if(!RK.puffs.length)vchRocketSmokeInit();
  let pf=null;
  for(let i=0;i<RK.puffs.length;i++){
    const q=RK.puffs[(RK.puffI+i)%RK.puffs.length];
    if(q.life<=0){pf=q;RK.puffI=(RK.puffI+i+1)%RK.puffs.length;break}
  }
  if(!pf){pf=RK.puffs[RK.puffI];RK.puffI=(RK.puffI+1)%RK.puffs.length}
  pf.max=opt.life;pf.life=opt.life;pf.size=opt.size;pf.drag=opt.drag===undefined?1.6:opt.drag;
  pf.vel.copy(vel);
  pf.s.position.copy(pos);
  pf.s.scale.setScalar(opt.size0);
  pf.s.material.color.setHex(opt.color);
  pf.s.material.opacity=opt.opacity;
  pf.s.visible=!0;
}
function vchRocketSmokeUpdate(dt){
  const RK=VCH_RK;
  for(const pf of RK.puffs){
    if(pf.life<=0)continue;
    pf.life-=dt;
    if(pf.life<=0){pf.s.visible=!1;continue}
    const k=1-pf.life/pfm(pf);
    pf.s.position.addScaledVector(pf.vel,dt);
    pf.vel.multiplyScalar(Math.max(0,1-pf.drag*dt));
    pf.vel.y-=.35*dt;
    pf.s.scale.setScalar(pf.size*(0.35+k*1.9));
    pf.s.material.opacity=Math.max(0,(1-k)*(1-k)*.62);
  }
}
function pfm(pf){return pf.max}

/* ---- меш ракеты ---------------------------------------------------------- */
function vchRocketMesh(){
  const RK=VCH_RK,rig=RK.rig,M=(rig&&rig.materials)||{};
  const body=M.paintLight||new fe({color:0xb8bcaa,metalness:.28,roughness:.62});
  const dark=M.steelDark||new fe({color:0x3d3e39,metalness:.72,roughness:.5});
  const R=.062,L=.86;
  const g=new Jt();
  const cyl=(rt,rb,h,seg)=>{const c=new mn(rt,rb,h,seg,1);c.rotateX(Math.PI/2);return c};
  const b=new Lt(cyl(R,R,L,14),body);g.add(b);
  const nose=new Lt(cyl(.004,R,.20,14),body);nose.position.z=L*.5+.10;g.add(nose);
  const noz=new Lt(cyl(.052,R*.98,.09,12),dark);noz.position.z=-L*.5-.045;g.add(noz);
  for(let i=0;i<4;i++){
    const f=new Lt(Bf(.010,.13,.20,.003),dark);
    f.position.set(0,0,-L*.5+.16);
    f.rotation.z=i*Math.PI*.5;
    f.position.x=Math.sin(i*Math.PI*.5)*.085;
    f.position.y=Math.cos(i*Math.PI*.5)*.085;
    g.add(f);
  }
  const fl=new Lt(cyl(.001,.055,.5,10),
      new fe({color:0xffe0a8,emissive:0xff8a24,emissiveIntensity:3.2,
              transparent:!0,opacity:.9,depthWrite:!1}));
  fl.position.z=-L*.5-.30;fl.visible=!1;g.add(fl);
  g.userData.flame=fl;
  g.traverse(o=>{if(o.isMesh)o.castShadow=!0,o.frustumCulled=!1});
  return g;
}

/* ---- захват цели --------------------------------------------------------- */
function vchRocketPick(){
  const RK=VCH_RK,rig=RK.rig;
  if(!rig||!ba)return null;
  rig.group.updateWorldMatrix(!0,!1);
  const base=new P(0,0,0);rig.group.getWorldPosition(base);
  /* конус захвата — по оси башни: цель выбирается там, куда наведено орудие */
  const q=new gn();
  if(rig.turret)rig.turret.getWorldQuaternion(q);else q.copy(rig.group.quaternion);
  const fwd=new P(0,0,1).applyQuaternion(q);fwd.y=0;
  if(fwd.lengthSq()<1e-6)return null;fwd.normalize();
  let best=null,bs=1e9;
  const tp=new P();
  for(const pr of ba){
    if(!pr||!pr.alive||!pr.destructible||!pr.mesh)continue;
    pr.mesh.getWorldPosition(tp);
    const dx=tp.x-base.x,dz=tp.z-base.z,d=Math.hypot(dx,dz);
    if(d<6||d>RK.range)continue;
    const cos=(dx*fwd.x+dz*fwd.z)/(d||1);
    const ang=Math.acos(Te.clamp(cos,-1,1));
    if(ang>1.05)continue;                       /* конус ±60° от оси корпуса */
    const score=ang*2.2+d/RK.range;
    if(score<bs){bs=score;best=pr}
  }
  return best;
}
function vchRocketTargetPos(pr,out){
  if(!pr||!pr.mesh)return out.set(0,0,0);
  pr.mesh.getWorldPosition(out);
  return out;
}

/* ---- пуск ---------------------------------------------------------------- */
function vchRocketLaunch(tube){
  const RK=VCH_RK,rig=RK.rig;
  if(!rig)return null;
  /* точка старта — сам меш ракеты из модели */
  const rn=tube&&tube.rocket?tube.rocket:null;
  const pos=new P();
  if(rn&&rn.getWorldPosition)rn.getWorldPosition(pos);
  else (rig.group||rig.chassis).getWorldPosition(pos);
  pos.y+=.12;
  /* направление: на цель с подъёмом (ракета управляемая, довернёт сама) */
  const aim=new P().subVectors(RK.tpos,pos);
  if(aim.lengthSq()<1)aim.set(0,0,1).applyQuaternion((rig.group||rig.chassis).quaternion);
  if(!(aim.lengthSq()>0))aim.set(0,0,1);
  aim.y=Math.max(aim.y,2);
  aim.normalize();
  const dir=aim.clone().addScaledVector(new P(0,1,0),RK.launchUp).normalize();
  const mesh=vchRocketMesh();
  mesh.position.copy(pos);
  cn.add(mesh);
  const r={
    mesh,pos:pos.clone(),prev:pos.clone(),
    vel:dir.clone().multiplyScalar(RK.ejectV),
    dir:dir.clone(),quat:new gn(),age:0,fuel:1,alive:!0,launchY:pos.y,
    target:RK.target,mass:RK.dryM+RK.fuelM,smokeAcc:0,hitP:new P(),tube,dist:0,
    tlast:RK.tpos.clone(),tseen:!0
  };
  r.quat.setFromUnitVectors(VCH_RK_Z,r.dir);
  mesh.quaternion.copy(r.quat);
  RK.missiles.push(r);
  RK.shotsFired++;
  /* звук пуска: шипение газа + низкий удар */
  if(an&&an._noiseBurst)an._noiseBurst({dur:.55,type:"bandpass",freq:520,q:1.05,gain:.34,sweepTo:2400,send:.25});
  if(an&&an._thump)an._thump({freq:78,dur:.4,gain:.4,slideTo:.55});
  for(let i=0;i<12;i++){
    vchRocketPuff(pos,new P((Math.random()-.5)*2.2,-2-Math.random()*3,(Math.random()-.5)*2.2),
      {life:.7+Math.random()*.5,size:.55,size0:.35,color:0xbdbcb6,opacity:.5,drag:2.2});
  }
  if(di!==undefined)di=Math.min(1.4,di+.18);
  return r;
}

/* ---- подрыв -------------------------------------------------------------- */
function vchRocketBoom(point,normal,body,scale){
  const RK=VCH_RK,s=scale||1.35;
  if(en){
    en.explosion(point.clone(),s);
    en.spawnDebris(point.clone(),1.15);
    en.impact(point.clone(),(normal&&normal.clone())||new P(0,1,0),1.2,1);
  }
  if(an&&an.explosion)an.explosion(1.15*s);
  if(di!==undefined)di=Math.min(1.45,di+.55*s);
  let direct=null;
  if(body&&ba)direct=ba.find(p=>p.body===body&&p.alive)||null;
  if(direct)ch(direct,point.clone(),(normal&&normal.clone())||new P(0,1,0),1e6);
  /* осколки и фугасное действие по соседям */
  if(ba)for(const pr of ba){
    if(!pr||!pr.alive||!pr.destructible||pr===direct)continue;
    const d=pr.mesh.position.distanceTo(point);
    if(d<RK.blastR)ch(pr,point.clone(),(normal&&normal.clone())||new P(0,1,0),
                      Math.max(14,110*(1-d/RK.blastR)));
  }
  RK.lastHit={x:+point.x.toFixed(1),y:+point.y.toFixed(1),z:+point.z.toFixed(1)};
}

/* ---- физика полёта -------------------------------------------------------
   Порядок: гравитация -> тяга (с газодинамическим вектором на старте) ->
   наведение (пропорциональная навигация, только поперёк скорости) ->
   аэродинамическое сопротивление -> интегрирование -> ориентация корпуса
   по вектору скорости -> столкновения и взрыватель.                        */
function vchRocketStep(r,dt){
  const RK=VCH_RK;
  const SUB=6,h=dt/SUB;
  for(let n=0;n<SUB;n++){
    if(!r.alive)return;
    r.age+=h;
    /* --- цель --- */
    let tpos=null,tvel=null,los=null,dist=1e9;
    if(r.target&&r.target.alive&&r.target.mesh){
      tpos=vchRocketTargetPos(r.target,r.hitP);
      r.tlast.copy(tpos);r.tseen=!0;
      const bv=r.target.body&&r.target.body.velocity;
      if(bv)tvel=new P(bv.x,bv.y,bv.z);
    }else if(r.tseen){
      r.tlast.y-=2.2*h;tpos=r.tlast;
    }
    if(tpos){
      const toT=new P().subVectors(tpos,r.pos);
      dist=toT.length()||1;
      los=toT.clone().divideScalar(dist);
    }
    r.los=los;r.range=dist;
    const t0=r.age-RK.ejectT;
    const burning=t0>0&&t0<RK.burnT;
    /* --- силы: тяга строго по оси корпуса --- */
    const acc=new P(0,-9.81,0);
    if(burning){
      r.fuel=Math.max(0,1-t0/RK.burnT);
      r.mass=RK.dryM+RK.fuelM*r.fuel;
      acc.addScaledVector(r.dir,RK.thrust/r.mass);
    }
    /* --- наведение ------------------------------------------------------
       Угол атаки не создаём: корпус всегда смотрит по вектору скорости,
       поэтому управляем ТОЛЬКО поперечной составляющей ускорения и
       ограничиваем угловую скорость доворота траектории (wMax). Так ракета
       не «летит боком»: сначала плавно ложится на линию визирования, потом
       работает пропорциональная навигация.                                */
    if(los&&r.age>RK.ejectT*.55){
      const sp=Math.max(r.vel.length(),1e-3);
      const vh=r.vel.clone().divideScalar(sp);
      const aStr=los.clone().addScaledVector(vh,-los.dot(vh))
                    .multiplyScalar(sp*RK.straighten);
      const aCmd=aStr.clone();
      let aPN=null;
      const herr=Math.acos(Te.clamp(los.dot(vh),-1,1));
      /* ПН включаем только на конечном участке и при малой ошибке курса:
         иначе на большом начальном рассогласовании она «заваливает» ракету
         в землю. На маршруте работает чистое выравнивание на линию визирования. */
      if(sp>55&&dist<RK.pnDist&&herr<RK.pnHerr){
        const vrel=tvel?tvel.clone().sub(r.vel):r.vel.clone().negate();
        const Vc=los.dot(vrel);
        const omega=new P().crossVectors(los,vrel).divideScalar(Math.max(dist,6));
        aPN=new P().crossVectors(omega,los).multiplyScalar(RK.pn*Math.max(Vc,90));
        aCmd.add(aPN);
      }
      /* набор высоты: первые climbT секунд горения, пока цель дальше diveDist
         и не ниже точки пуска, команду добавляет перегрузку вверх. Так
         траектория становится навесной, а не стелющейся у самой земли. */
      if(RK.climbT>0&&t0>0&&t0<RK.climbT&&dist>RK.diveDist&&(tpos.y-r.launchY)>-3){
        /* потолок горки: чем ближе цель, тем ниже апогей, иначе на предельной
           дальности ракета не успевает выйти на цель и клюёт в землю */
        /* потолок: и доля от дальности, и жёсткий предел. Выше 15 м ракета
           уже не успевает выйти на цель — клюёт в землю, не добрав 25 м. */
        const gh0=ge(r.pos.x,r.pos.z);
        const ceil=Math.min(RK.ceilingK*dist,RK.ceilingMax);
        if(r.pos.y-gh0 < ceil)
          aCmd.addScaledVector(VCH_RK_UP,
            RK.climbG*9.81*Math.min(1,(dist-RK.diveDist)/RK.climbSpan));
      }
      r.dbg={str:+aStr.y.toFixed(1),pn:aPN?+aPN.y.toFixed(1):null};
      const late=r.age>RK.ejectT+RK.pitchT*1.15;   /* доворот закончен */
      const wMax=late?RK.turnRateW:RK.turnRateV;   /* рад/с по траектории */
      const gMax=(late?RK.maxG:RK.pitchG)*9.81;
      const aMax=Math.min(gMax,Math.max(20,wMax*sp));
      if(aCmd.length()>aMax)aCmd.setLength(aMax);
      aCmd.addScaledVector(vh,-aCmd.dot(vh));      /* только поперёк скорости */
      /* защита от «втыкания» в грунт на маршруте (не на конечном участке) */
      const gh=ge(r.pos.x,r.pos.z),alt=r.pos.y-gh;
      if(dist>25&&alt<9&&r.vel.y<0)aCmd.y=Math.max(aCmd.y,-r.vel.y*2.6);
      if(dist>9&&alt<3.2){
        aCmd.y=Math.max(aCmd.y,0);
        aCmd.y+=9.81*1.4;
      }
      acc.add(aCmd);
      r.cmd=aCmd.length();
    }
    const v=r.vel.length();
    if(v>1e-3)acc.addScaledVector(r.vel,-RK.kDrag*v/r.mass);
    r.vel.addScaledVector(acc,h);
    r.prev.copy(r.pos);
    r.pos.addScaledVector(r.vel,h);
    r.dist+=r.prev.distanceTo(r.pos);
    /* --- ориентация корпуса: нос строго по вектору скорости --- */
    let want=r.vel.clone();
    if(want.lengthSq()<1e-4)want.copy(r.dir);
    want.normalize();
    if(r.age<RK.ejectT*.5)want.copy(r.dir);
    const cur=r.dir.clone();
    const ang=cur.angleTo(want);
    if(ang>1e-5){
      const noseRate=r.age<RK.ejectT+RK.pitchT*1.15?6.0:RK.turnRate;
      const step=Math.min(ang,noseRate*h);
      const axis=new P().crossVectors(cur,want);
      if(axis.lengthSq()>1e-8){
        axis.normalize();
        const dq=new gn().setFromAxisAngle(axis,step);
        cur.applyQuaternion(dq);r.quat.premultiply(dq);
      }else{r.quat.setFromUnitVectors(VCH_RK_Z,want);cur.copy(want)}
      r.dir.copy(cur);
    }
    r.mesh.position.copy(r.pos);
    r.mesh.quaternion.copy(r.quat);
    const fl=r.mesh.userData.flame;
    if(fl){fl.visible=burning;if(burning)fl.scale.setScalar(.85+Math.random()*.3)}
    /* --- столкновение с миром --- */
    const from=new w(r.prev.x,r.prev.y,r.prev.z),to=new w(r.pos.x,r.pos.y,r.pos.z),res=new Ui();
    if(vn.physics.raycastClosest(from,to,{collisionFilterMask:is|VCH_RAMP,skipBackfaces:!1},res)){
      const pt=new P(res.hitPointWorld.x,res.hitPointWorld.y,res.hitPointWorld.z);
      const nm=new P(res.hitNormalWorld.x,res.hitNormalWorld.y,res.hitNormalWorld.z);
      vchRocketBoom(pt,nm,res.body,1.35);r.alive=!1;return;
    }
    const gh2=ge(r.pos.x,r.pos.z);
    if(r.pos.y<=gh2+.05){
      vchRocketBoom(new P(r.pos.x,gh2+.05,r.pos.z),new P(0,1,0),null,1.25);
      r.alive=!1;return;
    }
    /* --- неконтактный взрыватель --- */
    if(tpos&&r.age>RK.ejectT*.9&&r.pos.distanceTo(tpos)<RK.fuze){
      const nm=r.vel.clone().setLength(1).negate();
      vchRocketBoom(tpos.clone(),nm,r.target&&r.target.alive?r.target.body:null,1.45);
      r.alive=!1;return;
    }
    if(r.age>RK.life){
      vchRocketBoom(r.pos.clone(),new P(0,1,0),null,.9);r.alive=!1;return;
    }
  }
}

/* ---- дым по пройденному пути --------------------------------------------- */
function vchRocketTrail(r,dt){
  if(!r.alive)return;
  const nozzle=r.pos.clone().addScaledVector(r.dir,-0.55);
  const burning=r.age>VCH_RK.ejectT&&r.age<VCH_RK.ejectT+VCH_RK.burnT;
  r.smokeAcc+=r.vel.length()*dt;
  r.smokeT=(r.smokeT||0)+dt;
  let guard=0;
  while((r.smokeAcc>3.2||r.smokeT>0.035)&&guard++<4){
    if(r.smokeAcc>3.2)r.smokeAcc-=3.2;
    r.smokeT=0;
    vchRocketPuff(nozzle,r.vel.clone().multiplyScalar(-.04),
      {life:2.5+Math.random()*1.6,size:1.5+Math.random()*1.1,size0:.22,
       color:burning?0xb7b4ac:0xcac7c0,opacity:.5+Math.random()*.12,drag:1.5});
  }
  if(burning){
    if(Math.random()<0.55&&en&&en.sparks){
      const sp=en._get(en.sparks);
      sp.spawn({pos:nozzle.clone(),vel:r.vel.clone().multiplyScalar(.22)
          .add(new P((Math.random()-.5)*3,(Math.random()-.5)*3,(Math.random()-.5)*3)),
        life:.10+Math.random()*.09,size0:.5,size1:1.5,color:0xffb45a,drag:5,grav:1,opacity:.95});
    }
  }
}

/* ---- HUD ----------------------------------------------------------------- */
function vchRocketHUD(){
  const RK=VCH_RK;
  if(RK.box&&RK.hint)return;
  const mk=css=>{const d=document.createElement("div");d.style.cssText=css;document.body.appendChild(d);return d};
  RK.box=mk("position:fixed;left:-99px;top:-99px;width:38px;height:38px;display:none;"+
     "pointer-events:none;z-index:38;border:1.5px solid rgba(255,138,30,.92);border-radius:4px;"+
     "box-shadow:0 0 10px rgba(255,138,30,.45);transform:translate(-50%,-50%)");
  RK.hint=mk("position:fixed;left:50%;bottom:86px;transform:translateX(-50%);display:none;"+
     "font:600 13px/1.35 ui-monospace,Consolas,monospace;letter-spacing:.06em;color:#ffb163;"+
     "text-shadow:0 0 8px rgba(0,0,0,.9),0 0 18px rgba(255,120,20,.35);"+
     "background:rgba(8,10,12,.42);border:1px solid rgba(255,138,30,.28);border-radius:5px;"+
     "padding:5px 12px;white-space:nowrap;pointer-events:none;z-index:38");
}
function vchRocketHudUpdate(){
  const RK=VCH_RK;
  if(!RK.box||!RK.hint)return;
  const active=VCH_ACTIVE&&VCH_ACTIVE.id==="scorpion";
  const ready=RK.tubes.filter(t=>!t.spent).length,total=RK.tubes.length;
  let showHint=active&&(RK.held||RK.lock>0||RK.reloadT>0||ready<total||RK.state==="firing"||RK.podsUp>0.01);
  let txt="";
  if(RK.salvo.length||RK.state==="firing")txt="ПУСК РАКЕТ · "+ready+"/"+total;
  else if(RK.reloadT>0)txt="ПЕРЕЗАРЯДКА РАКЕТ · "+Math.ceil(RK.reloadT)+" с · "+ready+"/"+total;
  else if(RK.held&&RK.podsUp<0.98)txt="РАЗВОРОТ РАКЕТНОЙ КАССЕТЫ…";
  else if(RK.held&&RK.target){
    txt=RK.lock>=RK.lockTime?"ЦЕЛЬ ЗАХВАЧЕНА · отпустите ПРОБЕЛ":"ЗАХВАТ ЦЕЛИ… "+Math.round(100*RK.lock/RK.lockTime)+"%";
  }else if(RK.held)txt="ПОИСК ЦЕЛИ…";
  else if(active)txt="РАКЕТЫ "+ready+"/"+total+" · ПРОБЕЛ — кассета и захват";
  if(!txt){RK.hint.style.display="none"}else{
    RK.hint.style.display=showHint?"block":"none";
    if(RK.hint.textContent!==txt)RK.hint.textContent=txt;
  }
  /* рамка на цели */
  if(RK.target&&RK.target.alive&&RK.target.mesh&&(RK.held||RK.lock>0)){
    const p=new P();RK.target.mesh.getWorldPosition(p);p.y+=.7;
    p.project(ye);
    if(p.z<1&&Math.abs(p.x)<1.1&&Math.abs(p.y)<1.1){
      RK.box.style.display="block";
      RK.box.style.left=((p.x*.5+.5)*window.innerWidth)+"px";
      RK.box.style.top=((-p.y*.5+.5)*window.innerHeight)+"px";
      const locked=RK.lock>=RK.lockTime;
      RK.box.style.borderColor=locked?"rgba(255,60,30,.95)":"rgba(255,170,60,.75)";
      RK.box.style.width=RK.box.style.height=(locked?"52px":"34px");
    }else RK.box.style.display="none";
  }else RK.box.style.display="none";
}

/* ---- звук подъёмника установок ------------------------------------------- */
function vchRocketServo(up){
  if(!an)return;
  if(an._noiseBurst)an._noiseBurst({dur:.52,type:"bandpass",freq:up?300:520,q:.85,
                                     gain:.20,sweepTo:up?1200:260,send:.22});
  if(an._thump)an._thump({freq:up?62:52,dur:.26,gain:.15,slideTo:.7});
}

/* ---- ближайшая ломающаяся цель рядом с точкой ---------------------------- */
function vchRocketPickNear(pos,rad,skip){
  if(!ba||!pos)return null;
  let best=null,bd=rad;
  const p=new P();
  for(const pr of ba){
    if(!pr||!pr.alive||!pr.destructible||!pr.mesh||pr===skip)continue;
    pr.mesh.getWorldPosition(p);
    const d=p.distanceTo(pos);
    if(d<bd){bd=d;best=pr}
  }
  return best;
}

/* ---- звук пролёта ракеты мимо камеры ------------------------------------- */
function vchRocketWhoosh(r,dt){
  const RK=VCH_RK;
  RK.whooshT=Math.max(0,(RK.whooshT||0)-dt);
  if(r.whooshed||!an||!ye||!ye.position||r.age<.5)return;
  if(r.pos.distanceTo(ye.position)>16)return;
  r.whooshed=!0;
  if(RK.whooshT>0||!an._noiseBurst)return;
  RK.whooshT=.6;
  an._noiseBurst({dur:.55,type:"bandpass",freq:1550,q:.55,gain:.30,sweepTo:220,send:.30});
}

/* ---- покадровый тик ------------------------------------------------------ */
function vchRocketTick(dt){
  const RK=VCH_RK;
  if(!RK.ready||!RK.rig)return;
  if(typeof window!=="undefined"&&window.__rkFreeze)return;   /* стоп-кадр для тестов */
  const active=VCH_ACTIVE&&VCH_ACTIVE.id==="scorpion";
  const held=active&&J.started&&Wn.has("Space");
  RK.held=held;
  /* --- захват --- */
  if(held){
    if(!RK.wasHeld){RK.lock=0;RK.target=vchRocketPick();RK.state=RK.target?"locking":"idle"}
    if(!RK.target||!RK.target.alive)RK.target=vchRocketPick();
    if(RK.target){
      RK.state="locking";
      RK.lock=Math.min(RK.lockTime,RK.lock+dt);
      /* наведение: подсовываем штатной системе наведения точку цели и держим
         приоритет клавиатуры, чтобы мышь не перебивала автонаведение */
      vchRocketTargetPos(RK.target,RK.tpos);
      if(J.aimPoint)J.aimPoint.copy(RK.tpos);
      J.keyAimT=.22;
      if(RK.lock>=RK.lockTime){
        RK.state="locked";
        if(!RK.lockBeep){RK.lockBeep=!0;if(an&&an.clank)an.clank()}
      }
    }else RK.lock=Math.max(0,RK.lock-dt*2);
  }else{
    RK.lockBeep=!1;
  }
  /* --- пуск по отпусканию пробела --- */
  if(!held&&RK.wasHeld){
    const ok=RK.target&&RK.target.alive&&RK.lock>=RK.lockTime*0.999;
    if(ok)vchRocketSalvo();
    else{RK.lock=0;RK.target=null;RK.state="idle"}
    RK.lock=0;
  }
  RK.wasHeld=held;
  /* --- угол возвышения установок по дальности до цели --- */
  if(held&&RK.target&&RK.target.alive&&RK.target.mesh){
    const tp=vchRocketTargetPos(RK.target,RK.tpos);
    const rp=new P();(RK.rig.group||RK.rig.chassis).getWorldPosition(rp);
    const d=Math.hypot(tp.x-rp.x,tp.z-rp.z);
    RK.elevT=Te.clamp(26+d*0.22,26,60);
  }
  /* --- установки: выезд по удержанию, наклон, уборка после залпа ---
     Каждая работает независимо: отстреляла свои пять труб — уехала,
     не дожидаясь соседней.                                                 */
  /* --- кассеты: откидывание наружу-вверх, каждая независимо --------------- */
  let upMin = 1, rollA = 0, servoSnd = 0, clankSnd = 0;
  for (const C of RK.pods) {
    const before = C.t;
    const upWanted = held || RK.salvo.some(t => t.pod === C);
    C.t = Te.clamp(C.t + (upWanted ? dt / VCH_RK_SC.rollT : -dt / (VCH_RK_SC.rollT * 1.2)), 0, 1);
    const e = C.t * C.t * (3 - 2 * C.t);
    /* знак общий для обеих кассет: нос (торцы ракет) вверх, корма в нишу */
    const sgn = VCH_RK_SC.sign * (VCH_RK_SC.mirror && C.side ? C.side : 1);
    C.roll = VCH_RK_SC.roll * e * sgn;
    vchSetAxisAngle(C.pivot, VCH_RK_SC.axis, C.roll);
    /* крышки на кассетах не открываются: лобовая плита жёстко закреплена
       на корпусе кассеты и просто поворачивается вместе с ним (см. сборку) */
    /* ракеты не скользят (slide=0): стоят в трубах, торцы смотрят по оси кассеты */
    const eOut = Te.clamp((C.t - .35) / .65, 0, 1);
    const eSm = eOut * eOut * (3 - 2 * eOut);
    for (const g of C.rockets) {
      const p0 = g.userData.p0;
      if (!p0) continue;
      g.position.set(p0.x, p0.y, p0.z - (g.userData.slide || 0) * eSm);
    }
    if (before <= .0001 && C.t > .0001) servoSnd = 1;
    if (before < .9999 && C.t >= .9999) clankSnd = 1;
    if (before > .0001 && C.t <= .0001) servoSnd = -1;
    upMin = Math.min(upMin, C.t);
    if (Math.abs(C.roll) > Math.abs(rollA)) rollA = C.roll;
  }
  /* бронекрышки ниши открываются в начале хода кассеты */
  const eAll = RK.pods.length ? RK.pods[0].t * RK.pods[0].t * (3 - 2 * RK.pods[0].t) : 0;
  const ce = Te.clamp(eAll / VCH_RK_SC.coverT, 0, 1);
  for (const cv of (RK.covers || [])) cv.hinge.rotation.x = cv.ang * ce;
  if (servoSnd > 0) vchRocketServo(!0);
  if (servoSnd < 0) vchRocketServo(!1);
  if (clankSnd && an && an.clank) an.clank();
  if (RK.pods.length) { RK.elev = rollA * 180 / Math.PI; RK.podsUp = upMin; }
  /* --- очередь пуска --- */
  if(RK.salvo.length){
    RK.fireT-=dt;
    if(RK.fireT<=0){
      const tube=RK.salvo.shift();
      /* цель могла быть уничтожена предыдущими ракетами залпа — тогда
         оставшиеся ракеты переносим на ближайший ломающийся объект рядом */
      if((!RK.target||!RK.target.alive)&&RK.salvoPos){
        const nt=vchRocketPickNear(RK.salvoPos,45,RK.target);
        if(nt){RK.target=nt;vchRocketTargetPos(nt,RK.tpos)}
      }
      if(tube&&tube.pod)tube.pod.kick=Math.min(1.2,(tube.pod.kick||0)+.8);
      vchRocketLaunch(tube);
      RK.fireT=RK.gap;
    }
  }
  if(RK.state==="firing"&&!RK.salvo.length)RK.state="idle";
  /* --- ракеты --- */
  for(let i=RK.missiles.length-1;i>=0;i--){
    const r=RK.missiles[i];
    vchRocketStep(r,dt);
    vchRocketTrail(r,dt);
    vchRocketWhoosh(r,dt);
    if(!r.alive){
      if(r.mesh.parent)r.mesh.parent.remove(r.mesh);
      RK.missiles.splice(i,1);
    }
  }
  vchRocketSmokeUpdate(dt);
  /* --- перезарядка --- */
  const ready=RK.tubes.filter(t=>!t.spent).length;
  if(ready===0&&RK.reloadT<=0&&RK.reload>0&&!RK.salvo.length)RK.reloadT=RK.reload;
  if(RK.reloadT>0){
    RK.reloadT-=dt;
    if(RK.reloadT<=0){
      RK.reloadT=0;
      for(const t of RK.tubes){t.spent=!1;if(t.tip)t.tip.visible=!0}
      if(an&&an.reload)an.reload();
    }
  }
  vchRocketHudUpdate();
}
function vchRocketSalvo(){
  const RK=VCH_RK;
  const targets=RK.tubes.filter(t=>!t.spent)
      .sort((x,y)=>x.side-y.side||x.i-y.i);   /* залп с левой установки, затем с правой */
  if(!targets.length){if(an&&an.clank)an.clank();return}
  RK.salvoPos=(RK.tpos&&RK.tpos.lengthSq()>0)?RK.tpos.clone():null;
  for(const t of targets){
    t.spent=!0;
    if(t.tip)t.tip.visible=!1;                /* гнездо пустое */
    RK.salvo.push(t);
  }
  RK.fireT=0;
  RK.state="firing";
  if(an&&an.clank)an.clank();
}

{const r=new URLSearchParams(location.search).get("model");r&&Zf(r)}qt.turret.rotation.y=0;Pr(0);uh();J.aimPoint=new P;np();setTimeout(()=>vWarmUp("boot"),700);setInterval(()=>{J.started||ob(1/30)},33);window.__tank={get tank(){return qt},get vehicle(){return Ce},get tanks(){return VCH_TANKS},get active(){return VCH_ACTIVE},world:vn,map:VCH_MAP,state:J,audio:an,effects:en,scene:cn,camera:ye,renderer:Jn,composer:Zr,shells:Ls,rockets:VCH_RK,loadModelFile:ah,loadModelUrl:Zf,useSourceModel:fa,useProceduralModel:$f,modelCtl:Ee,rebuildCustomModel:Hr,groundProbe:Jf,async loadModelBuffer(r,t){const e=await Yf(new File([r],t||"model.glb"));fa(e,t||"model.glb")},frame:(r=1/60,t=!1)=>ip(r,t),setCameraMode:Pr,fire:lh,recoil:VCH_RECOIL,
/* отладочные хуки выброса стреляной гильзы */
eject:{get cases(){return V_CASES.length},get pending(){return V_caseDelay},
       spawn:V_ejectSpawn,queue:V_ejectSchedule}};
/* ракеты: доступ к установкам для тестов (см. tools/test_rocket*.py) */
try{
  const _rk=VCH_RK;
  Object.defineProperty(_rk,"podInfo",{get(){return _rk.pods.map(p=>({side:p.side,t:+p.t.toFixed(3),
    roll:+(p.roll||0).toFixed(3),covers:(p.covers||[]).length,rockets:(p.rockets||[]).length,
    spent:(p.rockets||[]).filter(r=>r.visible===!1).length}))}});
  _rk.scParams=VCH_RK_SC;
  _rk.rebuildCassette=vchRocketCassetteRebuild;
  Object.defineProperty(_rk,"moduleInfo",{get(){const C=_rk.pods;if(!C||!C.length)return null;
    const one=p=>{const b=new Xe().setFromObject(p.pivot);
      return {side:p.side,t:+p.t.toFixed(3),roll:+(p.roll*180/Math.PI).toFixed(1),
        y:[+b.min.y.toFixed(2),+b.max.y.toFixed(2)],rockets:p.rockets.length}};
    return {pods:C.map(one),covers:(_rk.covers||[]).map(c=>c.key)}}});
}catch(e){}
