/* ============================================================================
   91-fx.js · ЭФФЕКТЫ ВЫСТРЕЛА И ВЗРЫВА
   ----------------------------------------------------------------------------
   Надстройка над готовой системой частиц (класс dd в 06-world.js, пул en).
   Ничего не переписывает: оборачивает en.muzzleBurst / en.explosion /
   en.update и добавляет то, чего в базе не было вообще.

   Чего не было и что здесь сделано:

   1. ЦВЕТ ЧАСТИЦЫ ПО ВРЕМЕНИ ЖИЗНИ. В базе sprite.material.color ставился
      один раз на spawn — частица не могла остывать. Отсюда главная неправда
      старого взрыва: он был оранжевым в момент удара и оставался оранжевым,
      пока не гас. Настоящий огонь за 0.4 с проходит белый -> жёлтый ->
      оранжевый -> тёмно-красный, и только потом на его месте остаётся дым.
      Теперь spawn понимает color1 и colorPow, а update их интерполирует.

   2. ОГОНЬ И УГОЛЬКИ — два отдельных пула с аддитивным блендингом. Базовые
      sparks на это не годились: их 260 штук на всё (трассеры, искры попаданий,
      сопло ракеты), и один взрыв съедал бы половину.

   3. УДАРНАЯ ВОЛНА. Экранное искажение отдельным полноэкранным пассом:
      кольцо расходящегося воздуха преломляет картинку. Три одновременные
      волны, центры проецируются из мировых координат в UV.

   4. ОПАЛЁННАЯ ЗЕМЛЯ. Декаль на грунте в точке взрыва, живёт ~40 с и
      плавно уходит. Без неё взрыв «ничего не оставляет» и место боя выглядит
      чистым через секунду после попадания.

   5. СВЕТ С ПРАВИЛЬНЫМ ЗАТУХАНИЕМ. Базовый flashLight гас по формуле
      intensity *= pow(.001, dt) и потом скачком обнулялся по таймеру —
      на глаз это щелчок, а не вспышка. Здесь своя кривая: резкий пик,
      быстрый спад, потом тлеющее оранжевое зарево.

   Порядок загрузки: файл идёт последним, поэтому все глобали (cn, ye, Jn,
   Zr, en, ge, vn, H1, V_post, dd, P, ct, cf, Wl, Ir, Ks, Ie, Lt, En, Di, gn)
   уже определены.
   ========================================================================== */
(function(){
"use strict";

if(typeof en === "undefined" || !en || typeof cn === "undefined" || !cn){
  console.warn("[91-fx] нет en/cn — надстройка не применена");
  return;
}

/* ---------- 0. Настройки ------------------------------------------------ */

const VFX = {
  /* выключатель: false — работает только базовая система из 06-world.js.
     Нужен чтобы мерить «до» и «после» в одном прогоне браузера. */
  enabled:true,

  /* размеры новых пулов: это спрайты, каждый — отдельный draw call,
     поэтому не раздуваем — 230 штук хватает на 3–4 одновременных взрыва */
  fireCount:130, emberCount:100, scorchMax:16,

  /* множители по видам эффекта (домножаются на VCH_FXK ступени качества) */
  boomFire:1.0, boomSmoke:1.0, boomEmber:1.0, boomShock:1.0,
  mzFire:1.0, mzSmoke:1.0, mzDust:1.0,
  rktFire:1.0,

  /* bloom: база была strength .40 / threshold .95 — то есть светилось
     почти только белое, огонь не горел вовсе. Опускаем порог, поднимаем силу. */
  bloomStrength:0.78, bloomThreshold:0.68, bloomRadius:0.86,

  /* ветер: постоянный снос дыма, чтобы столб валил, а не стоял столбом */
  windX:0.9, windZ:0.35,

  /* подсветка от вспышки (PointLight) */
  boomLight:1700, mzLight:2600, decay:0.42
};

/* ---------- 1. Текстуры ------------------------------------------------- */

function vfxFireTex(N){
  N = N || 128;
  const c = document.createElement("canvas"); c.width = c.height = N;
  const g = c.getContext("2d");
  const gr = g.createRadialGradient(N/2,N/2,0,N/2,N/2,N/2);
  gr.addColorStop(0.00,"rgba(255,255,248,1)");
  gr.addColorStop(0.14,"rgba(255,248,214,0.98)");
  gr.addColorStop(0.32,"rgba(255,206,110,0.84)");
  gr.addColorStop(0.55,"rgba(246,132,38,0.50)");
  gr.addColorStop(0.78,"rgba(158,48,12,0.18)");
  gr.addColorStop(1.00,"rgba(88,20,4,0)");
  g.fillStyle = gr; g.fillRect(0,0,N,N);
  const t = new Ks(c); t.colorSpace = Ie; return t;
}

/* Опалённая земля: тёмное пятно с рваным краем. Край специально неровный —
   круглое пятно читается как наклейка и выдаёт дешёвый эффект. */
function vfxScorchTex(N){
  N = N || 256;
  const c = document.createElement("canvas"); c.width = c.height = N;
  const g = c.getContext("2d");
  const gr = g.createRadialGradient(N/2,N/2,0,N/2,N/2,N/2);
  gr.addColorStop(0.00,"rgba(12,9,6,0.95)");
  gr.addColorStop(0.42,"rgba(22,16,10,0.74)");
  gr.addColorStop(0.68,"rgba(36,26,17,0.36)");
  gr.addColorStop(0.88,"rgba(46,36,24,0.10)");
  gr.addColorStop(1.00,"rgba(52,42,28,0)");
  g.fillStyle = gr; g.fillRect(0,0,N,N);
  g.globalCompositeOperation = "destination-out";
  for(let i=0;i<30;i++){
    const a = Math.random()*6.283, r = N*(0.28+Math.random()*0.22);
    const x = N/2+Math.cos(a)*r, y = N/2+Math.sin(a)*r, rr = N*(0.04+Math.random()*0.11);
    const gg = g.createRadialGradient(x,y,0,x,y,rr);
    gg.addColorStop(0,"rgba(0,0,0,"+(0.22+Math.random()*0.5).toFixed(3)+")");
    gg.addColorStop(1,"rgba(0,0,0,0)");
    g.fillStyle = gg; g.beginPath(); g.arc(x,y,rr,0,6.283); g.fill();
  }
  const t = new Ks(c); t.colorSpace = Ie; return t;
}

/* ---------- 2. Цвет частицы по времени жизни ---------------------------- */

const _fxSpawn  = dd.prototype.spawn;
const _fxUpdate = dd.prototype.update;

dd.prototype.spawn = function(t){
  const hasC = !!(t && (t.color1 !== undefined || t.flicker));
  this.sizePow = (t && t.sizePow !== undefined) ? t.sizePow : 0;
  const r = _fxSpawn.call(this, t);
  if(!hasC){ this.hasC = false; return r }
  /* Цвета берём ИЗ МАТЕРИАЛА после базового spawn: он уже перевёл hex в
     рабочее пространство движка. Своим переводом sRGB->linear мы бы разошлись
     с движком, если цветоуправление выключено. */
  const m = this.sprite.material;
  const c0 = [m.color.r, m.color.g, m.color.b];
  m.color.set(t.color1 !== undefined ? t.color1 : (t.color !== undefined ? t.color : 0xffffff));
  const c1 = [m.color.r, m.color.g, m.color.b];
  m.color.setRGB(c0[0], c0[1], c0[2]);
  this.c0 = c0; this.c1 = c1;
  this.cPow = (t.colorPow !== undefined) ? t.colorPow : 1;
  this.flA  = t.flicker || 0;
  this.flS  = 9 + Math.random()*26;
  this.flP  = Math.random()*6.283;
  this.hasC = true;
  return r;
};

dd.prototype.update = function(dt){
  _fxUpdate.call(this, dt);
  if(!this.alive) return;
  const e = this.life / this.maxLife;
  if(this.hasC){
    let k = (this.cPow === 1) ? e : Math.pow(e, this.cPow);
    if(k > 1) k = 1;
    let f = 1;
    if(this.flA > 0) f = 1 - this.flA*(0.5 + 0.5*Math.sin(this.life*this.flS + this.flP));
    const a = this.c0, b = this.c1;
    this.sprite.material.color.setRGB(
      (a[0] + (b[0]-a[0])*k)*f,
      (a[1] + (b[1]-a[1])*k)*f,
      (a[2] + (b[2]-a[2])*k)*f);
  }
  /* sizePow < 1 — быстрый рост в начале и почти никакого в конце: так
     ведёт себя расширяющийся огненный шар, у него давление падает быстро */
  if(this.sizePow > 0){
    const g = Math.pow(e, this.sizePow);
    this.sprite.scale.setScalar(this.size0 + (this.size1 - this.size0)*g);
  }
};

/* ---------- 3. Новые пулы, декали, ударные волны ------------------------ */

const _fireTex  = vfxFireTex(128);
const _emberTex = vfxFireTex(64);
const _scorchTex = vfxScorchTex(256);

en.fire = [];
en.ember = [];
for(let i=0;i<VFX.fireCount;i++){
  const p = new dd(cn, _fireTex, Ir);
  p.sprite.material.toneMapped = false;
  p.sprite.renderOrder = 8;
  en.fire.push(p);
}
for(let i=0;i<VFX.emberCount;i++){
  const p = new dd(cn, _emberTex, Ir);
  p.sprite.material.toneMapped = false;
  p.sprite.renderOrder = 9;
  en.ember.push(p);
}

/* --- опалённая земля --- */
const _scorchGeo = new Di(1,1);
en.__scorch = [];
for(let i=0;i<VFX.scorchMax;i++){
  const mat = new En({map:_scorchTex, transparent:true, depthWrite:false,
                      opacity:0, color:0xffffff, toneMapped:false});
  const mesh = new Lt(_scorchGeo, mat);
  mesh.visible = false; mesh.renderOrder = 2; mesh.frustumCulled = false;
  cn.add(mesh);
  en.__scorch.push({mesh:mesh, t:0, life:0, target:0.9});
}
const _upZ = new P(0,0,1), _scN = new P(), _scQ = new gn();
function vfxScorch(pos, scale){
  const arr = en.__scorch;
  if(!arr || !arr.length || typeof ge !== "function") return;
  let d = null;
  for(const o of arr) if(o.life <= 0){ d = o; break }
  if(!d){
    let worst = 0;
    for(const o of arr){ const k = o.life > 0 ? o.t/o.life : 2; if(k >= worst){ worst = k; d = o } }
  }
  const gy = ge(pos.x, pos.z);
  _scN.set(0,1,0);
  try{ if(typeof vn !== "undefined" && vn.normalAt) vn.normalAt(pos.x, pos.z, _scN) }catch(e){}
  if(_scN.lengthSq() < 1e-6) _scN.set(0,1,0); else _scN.normalize();
  _scQ.setFromUnitVectors(_upZ, _scN);
  d.mesh.position.set(pos.x, gy + 0.035, pos.z);
  d.mesh.quaternion.copy(_scQ);
  const sz = 3.0 + 5.4*scale;
  d.mesh.scale.set(sz, sz, 1);
  d.mesh.visible = true;
  d.life = 40; d.t = 0; d.target = 0.70;   /* 0.88 на глазу читалось как дыра в земле */
  d.mesh.material.opacity = 0;
}

/* --- подсветка: своя кривая вместо щелчка --- */
const _flash = {peak:0, t:0, dur:0};
const _fCol0 = [1,1,1], _fCol1 = [1,1,1];
try{
  const c = en.flashLight.color;
  c.set(0xfff1d2); _fCol0[0]=c.r; _fCol0[1]=c.g; _fCol0[2]=c.b;
  c.set(0xff7a26); _fCol1[0]=c.r; _fCol1[1]=c.g; _fCol1[2]=c.b;
  c.setRGB(1,1,1);
}catch(e){}

function vfxFlashSet(light, peak, dur){
  _flash.peak = peak; _flash.t = 0; _flash.dur = dur;
}
function vfxFlashUpdate(dt){
  const L = en.flashLight;
  if(!L) return;
  if(_flash.dur <= 0){ if(L.intensity !== 0) L.intensity = 0; return }
  _flash.t += dt;
  const k = _flash.t / _flash.dur;
  if(k >= 1){ _flash.dur = 0; L.intensity = 0; return }
  /* резкий пик, быстрый спад, затем тлеющее зарево; лёгкое дрожание —
     свет живого огня не бывает ровным */
  const f = Math.pow(1-k, 2.2) * (1 + 0.35*Math.exp(-k*9));
  const flick = 0.94 + 0.06*Math.sin(_flash.t*47);
  L.intensity = _flash.peak * f * flick;
  /* цвет уходит от белого к оранжевому по мере остывания */
  const m = Math.pow(k, 0.7);
  L.color.setRGB(
    _fCol0[0] + (_fCol1[0]-_fCol0[0])*m,
    _fCol0[1] + (_fCol1[1]-_fCol0[1])*m,
    _fCol0[2] + (_fCol1[2]-_fCol0[2])*m);
}

/* --- ударные волны --- */
en.__waves = [];
const _wv = new P(), _wcam = new P();
function vfxWave(pos, r1, dur, strength){
  const arr = en.__waves;
  if(!arr) return;
  const w = {pos:pos.clone(), r0:0.4, r1:r1, t:0, dur:dur, s0:strength, r:0.4, s:strength};
  if(arr.length >= 3){
    let old = 0;
    for(let i=1;i<arr.length;i++) if(arr[i].t/arr[i].dur > arr[old].t/arr[old].dur) old = i;
    arr[old] = w;
  } else arr.push(w);
}
function vfxWaveUpdate(dt){
  const arr = en.__waves;
  if(!arr) return;
  for(let i=arr.length-1;i>=0;i--){
    const w = arr[i];
    w.t += dt;
    if(w.t >= w.dur){ arr.splice(i,1); continue }
    const k = w.t / w.dur;
    w.r = w.r0 + (w.r1 - w.r0)*Math.pow(k, 0.55);
    w.s = w.s0 * Math.pow(1-k, 1.5);
  }
}

/* --- пасс искажения ударной волны --- */
const VFX_SHOCK_SHADER = {
  uniforms:{ tDiffuse:{value:null}, uRes:{value:new ct(1,1)},
             uW0:{value:new P(0,0,0)}, uW1:{value:new P(0,0,0)}, uW2:{value:new P(0,0,0)},
             uS0:{value:0}, uS1:{value:0}, uS2:{value:0} },
  vertexShader:
    "varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }",
  fragmentShader:[
    "uniform sampler2D tDiffuse;",
    "uniform vec2 uRes;",
    "uniform vec3 uW0,uW1,uW2;",
    "uniform float uS0,uS1,uS2;",
    "varying vec2 vUv;",
    "void wave(vec3 w,float s,vec2 uv,float asp,inout vec2 off,inout float rim){",
    "  if(s<=0.002) return;",
    "  vec2 d=uv-w.xy;",
    "  float dist=length(vec2(d.x*asp,d.y));",
    "  float r=w.z;",
    "  if(r<=0.0) return;",
    "  float t=(dist-r)/(r*0.30+0.012);",
    "  float band=exp(-t*t*3.0);",
    "  float dl=max(dist,1e-4);",
    "  vec2 dirn=vec2(d.x*asp,d.y)/dl;",
    "  off+=dirn*band*s*0.055;",
    "  rim+=band*s;",
    "}",
    "void main(){",
    "  vec2 uv=vUv;",
    "  float asp=uRes.x/max(uRes.y,1.0);",
    "  vec2 off=vec2(0.0); float rim=0.0;",
    "  wave(uW0,uS0,uv,asp,off,rim);",
    "  wave(uW1,uS1,uv,asp,off,rim);",
    "  wave(uW2,uS2,uv,asp,off,rim);",
    "  vec2 suv=clamp(uv+off,vec2(0.0008),vec2(0.9992));",
    "  vec3 col=texture2D(tDiffuse,suv).rgb;",
    "  col+=vec3(1.0,0.74,0.44)*rim*0.14;",
    "  gl_FragColor=vec4(col,1.0);",
    "}"
  ].join("\n")
};

let VFX_shockPass = null;
try{
  if(typeof Zr !== "undefined" && Zr && typeof fw !== "undefined"){
    VFX_shockPass = new fw(VFX_SHOCK_SHADER);
    let idx = -1;
    if(typeof V_post !== "undefined" && V_post && V_post.grade) idx = Zr.passes.indexOf(V_post.grade);
    if(idx >= 0) Zr.insertPass(VFX_shockPass, idx); else Zr.addPass(VFX_shockPass);
  }
}catch(e){ console.warn("[91-fx] пасс ударной волны не добавлен:", e) }

function vfxWaveUniforms(){
  if(!VFX_shockPass) return;
  const u = VFX_shockPass.uniforms;
  try{ Jn.getSize(u.uRes.value) }catch(e){}
  u.uS0.value = 0; u.uS1.value = 0; u.uS2.value = 0;
  const arr = en.__waves || [];
  if(!arr.length) return;
  /* Camera.updateMatrixWorld сам обновляет matrixWorldInverse — поэтому
     после этого вызова матрицы свежие, а не прошлого кадра */
  try{ ye.updateMatrixWorld() }catch(e){}
  const tanHalf = Math.tan((ye.fov * Math.PI/180)/2);
  for(let i=0;i<3 && i<arr.length;i++){
    const w = arr[i];
    _wv.copy(w.pos);
    _wcam.copy(_wv).applyMatrix4(ye.matrixWorldInverse);
    const depth = -_wcam.z;
    if(depth <= 0.2) continue;
    _wv.project(ye);
    if(_wv.z > 1) continue;
    const target = (i===0 ? u.uW0.value : (i===1 ? u.uW1.value : u.uW2.value));
    const strK   = (i===0 ? "uS0" : (i===1 ? "uS1" : "uS2"));
    /* радиус в вертикальных UV: на этой глубине кадр охватывает
       2*depth*tan(fov/2) метров по вертикали */
    const rUv = w.r / Math.max(0.001, 2*depth*tanHalf);
    target.set(_wv.x*0.5 + 0.5, _wv.y*0.5 + 0.5, rUv);
    u[strK].value = w.s * VFX.boomShock;
  }
}

/* ---------- 4. Взрыв ---------------------------------------------------- */

const _explBase = en.explosion.bind(en);
en.explosion = function(pos, scale){
  const s = Math.max(0.3, scale || 1);
  const K = (typeof VCH_FXK !== "undefined") ? VCH_FXK : 1;

  _explBase(pos, s);          /* база: искры, дым, обломки, кольцо, тряска */
  if(!VFX.enabled) return;

  /* 4.1 огненный шар: белое ядро, за 0.4 с остывает до тёмно-красного.
     sizePow 0.45 — расширяется рывком и сразу теряет напор. */
  const nF = Math.max(4, Math.round(20*s*K*VFX.boomFire));
  for(let i=0;i<nF;i++){
    const a = Math.random()*6.283, u = Math.random()*2-1, sq = Math.sqrt(Math.max(0,1-u*u));
    const sp = (2.4 + Math.random()*7.0)*Math.min(1.6, s);
    en._get(en.fire).spawn({
      pos:new P(pos.x + (Math.random()-.5)*1.1*s,
                pos.y + (Math.random()-.5)*0.9*s,
                pos.z + (Math.random()-.5)*1.1*s),
      vel:new P(Math.cos(a)*sq*sp, (0.5 + Math.random()*1.6)*sp, Math.sin(a)*sq*sp),
      life:0.32 + Math.random()*0.44,
      size0:1.0*s, size1:(4.0 + Math.random()*3.2)*s, sizePow:0.45,
      color:0xfff4cc, color1:0x63190a, colorPow:1.55,
      drag:5.5, grav:-2.2, opacity:0.95, rotVel:2.4
    });
  }

  /* 4.2 столб дыма: тёмный внизу, светлеет и расползается, сносится ветром */
  const nS = Math.max(3, Math.round(16*s*K*VFX.boomSmoke));
  for(let i=0;i<nS;i++){
    const a = Math.random()*6.283, rr = Math.random()*1.5*s;
    en._get(en.pool).spawn({
      pos:new P(pos.x + Math.cos(a)*rr, pos.y + Math.random()*1.0*s, pos.z + Math.sin(a)*rr),
      vel:new P(Math.cos(a)*(0.8+Math.random()*1.7) + VFX.windX,
                2.1 + Math.random()*3.3,
                Math.sin(a)*(0.8+Math.random()*1.7) + VFX.windZ),
      life:3.2 + Math.random()*3.4,
      size0:1.2*s, size1:(5.2 + Math.random()*4.6)*s, sizePow:0.75,
      color:0x2a2620, color1:0x8b8477, colorPow:1.0,
      drag:0.85, grav:-0.5, opacity:0.42, rotVel:1.2
    });
  }

  /* 4.3 угольки: летят дальше всего и живут дольше огня — именно они дают
     ощущение, что взрыв был горячим, а не просто ярким */
  const nE = Math.max(3, Math.round(18*s*K*VFX.boomEmber));
  for(let i=0;i<nE;i++){
    const a = Math.random()*6.283, sp = (5 + Math.random()*13)*Math.min(1.5, s);
    en._get(en.ember).spawn({
      pos:new P(pos.x, pos.y + 0.35, pos.z),
      vel:new P(Math.cos(a)*sp, 4 + Math.random()*9, Math.sin(a)*sp),
      life:1.3 + Math.random()*1.9,
      size0:0.16 + Math.random()*0.15, size1:0.05,
      color:0xffd489, color1:0x380b02, colorPow:1.15,
      drag:0.7, grav:7.5, opacity:0.95, flicker:0.55, rotVel:3
    });
  }

  /* 4.4 грунт: радиальный выброс пыли по земле — есть только если взрыв
     рядом с поверхностью, иначе пыль в воздухе неоткуда взяться */
  try{
    const gy = ge(pos.x, pos.z);
    if(pos.y - gy < 6.5){
      const nD = Math.max(4, Math.round(15*s*K));
      for(let i=0;i<nD;i++){
        const a = i/nD*6.283 + Math.random()*0.35;
        const sp = (7 + Math.random()*9)*Math.min(1.5, s);
        en._get(en.pool).spawn({
          pos:new P(pos.x, gy + 0.15 + Math.random()*0.3, pos.z),
          vel:new P(Math.cos(a)*sp, 1.1 + Math.random()*2.2, Math.sin(a)*sp),
          life:1.6 + Math.random()*1.6,
          size0:0.9*s, size1:(4.0 + Math.random()*3.0)*s,
          color:0x6d6152, color1:0x9c9083,
          drag:1.9, grav:-0.32, opacity:0.34, rotVel:1.4
        });
      }
      vfxScorch(pos, s);
    }
  }catch(e){}

  /* 4.5 свет и ударная волна */
  try{
    en.flashLight.position.copy(pos);
    vfxFlashSet(en.flashLight, VFX.boomLight*s, VFX.decay);
  }catch(e){}
  vfxWave(pos.clone(), 9.5*s, 0.72, 1.0*Math.min(1.4, s));
};

/* ---------- 5. Выстрел пушки -------------------------------------------- */

const _mzBase = en.muzzleBurst.bind(en);
en.muzzleBurst = function(pos, dir, brake){
  const K = (typeof VCH_FXK !== "undefined") ? VCH_FXK : 1;
  _mzBase(pos, dir, brake);       /* база: сноп искр, дым тормоза, вспышка */
  if(!VFX.enabled) return;

  /* 5.1 конус пламени: частицы ставятся ВДОЛЬ ствола на разном удалении,
     поэтому факел получается вытянутым, а не шаром у среза */
  const nF = Math.max(3, Math.round(9*K*VFX.mzFire));
  for(let i=0;i<nF;i++){
    const f = i/nF;
    const d = 0.22 + f*2.0;
    const spread = 0.12 + f*0.55;
    const v = dir.clone().multiplyScalar(7 + Math.random()*11);
    v.x += (Math.random()-.5)*spread*9;
    v.y += (Math.random()-.5)*spread*9 + 0.8;
    v.z += (Math.random()-.5)*spread*9;
    en._get(en.fire).spawn({
      pos:pos.clone().addScaledVector(dir, d),
      vel:v, life:0.055 + Math.random()*0.075,
      size0:(0.85 - 0.40*f)*1.7, size1:(2.3 - 1.0*f)*1.7, sizePow:0.7,
      color:0xfff8e2, color1:0xff6f16, colorPow:1.35,
      drag:9, grav:-1.4, opacity:0.95, rotVel:4
    });
  }

  /* 5.2 искры, которые гаснут на лету: цвет уходит от белого к красному,
     гравитация тянет вниз — они осыпаются, а не растворяются в воздухе */
  const nSp = Math.max(4, Math.round(16*K));
  for(let i=0;i<nSp;i++){
    const v = dir.clone().multiplyScalar(16 + Math.random()*40);
    v.x += (Math.random()-.5)*13; v.y += (Math.random()-.5)*13; v.z += (Math.random()-.5)*13;
    en._get(en.ember).spawn({
      pos:pos.clone().addScaledVector(dir, 0.4 + Math.random()*0.9),
      vel:v, life:0.22 + Math.random()*0.34,
      size0:0.20 + Math.random()*0.20, size1:0.04,
      color:0xfff3d0, color1:0x5e1403, colorPow:1.2,
      drag:2.6, grav:11, opacity:0.95, flicker:0.4, rotVel:3
    });
  }

  /* 5.3 дым, который остаётся после выстрела и стелется */
  const nSm = Math.max(2, Math.round(7*K*VFX.mzSmoke));
  for(let i=0;i<nSm;i++){
    const v = dir.clone().multiplyScalar(4 + Math.random()*7);
    v.x += (Math.random()-.5)*2.4 + VFX.windX*0.6;
    v.y += 0.5 + Math.random()*1.1;
    v.z += (Math.random()-.5)*2.4 + VFX.windZ*0.6;
    en._get(en.pool).spawn({
      pos:pos.clone().addScaledVector(dir, 0.8 + Math.random()*1.6),
      vel:v, life:1.6 + Math.random()*1.8,
      size0:0.42, size1:3.4 + Math.random()*1.6, sizePow:0.8,
      color:0xe8e2d4, color1:0xa89f8d,
      drag:1.7, grav:-0.28, opacity:0.32, rotVel:1.6
    });
  }

  /* 5.4 пыль с земли: при низком стволе пороховые газы взбивают грунт.
     Проверка на высоту обязательна — иначе на вершине холма пыль висит в воздухе */
  try{
    const gy = ge(pos.x, pos.z);
    const h = pos.y - gy;
    if(h < 5.0){
      const nD = Math.max(2, Math.round(9*K*VFX.mzDust));
      for(let i=0;i<nD;i++){
        const a = Math.random()*6.283, sp = 2.5 + Math.random()*4.5;
        en._get(en.pool).spawn({
          pos:new P(pos.x + Math.cos(a)*1.4, gy + 0.12 + Math.random()*0.25, pos.z + Math.sin(a)*1.4),
          vel:new P(Math.cos(a)*sp + dir.x*3.5, 0.9 + Math.random()*1.4, Math.sin(a)*sp + dir.z*3.5),
          life:1.3 + Math.random()*1.2,
          size0:0.6, size1:2.8 + Math.random()*1.4,
          color:0x7d7263, color1:0xa79c8b,
          drag:2.0, grav:-0.30, opacity:0.26, rotVel:1.5
        });
      }
    }
  }catch(e){}

  /* 5.5 подсветка и слабая волна у среза ствола */
  try{
    en.flashLight.position.copy(pos).addScaledVector(dir, 1.2);
    vfxFlashSet(en.flashLight, VFX.mzLight, 0.13);
  }catch(e){}
  vfxWave(pos.clone().addScaledVector(dir, 1.1), 4.2, 0.34, 0.5);
};

/* ---------- 6. Пуск ракеты ---------------------------------------------- */

function vfxRocketLaunch(pos, dir){
  if(!VFX.enabled) return;
  const K = (typeof VCH_FXK !== "undefined") ? VCH_FXK : 1;
  try{
    for(let i=0;i<Math.max(3, Math.round(10*K*VFX.rktFire));i++){
      const v = dir.clone().multiplyScalar(-(4 + Math.random()*10));
      v.x += (Math.random()-.5)*7; v.y += (Math.random()-.5)*7; v.z += (Math.random()-.5)*7;
      en._get(en.fire).spawn({
        pos:pos.clone().addScaledVector(dir, -0.3 - Math.random()*0.7),
        vel:v, life:0.14 + Math.random()*0.20,
        size0:0.55, size1:2.4 + Math.random()*1.4, sizePow:0.6,
        color:0xfff6dd, color1:0xd8500c, colorPow:1.3,
        drag:6, grav:-0.8, opacity:0.92, rotVel:3
      });
    }
    for(let i=0;i<Math.max(2, Math.round(9*K));i++){
      const a = Math.random()*6.283, sp = 3 + Math.random()*7;
      en._get(en.ember).spawn({
        pos:pos.clone().addScaledVector(dir, -0.5),
        vel:new P(Math.cos(a)*sp - dir.x*8, Math.random()*3 - dir.y*8, Math.sin(a)*sp - dir.z*8),
        life:0.5 + Math.random()*0.9,
        size0:0.14 + Math.random()*0.10, size1:0.04,
        color:0xffd79a, color1:0x3a0d02, colorPow:1.15,
        drag:1.6, grav:6, opacity:0.9, flicker:0.5, rotVel:3
      });
    }
    en.flashLight.position.copy(pos).addScaledVector(dir, -0.6);
    vfxFlashSet(en.flashLight, 900, 0.22);
    vfxWave(pos.clone(), 5.0, 0.45, 0.55);
  }catch(e){}
}

/* Оборачиваем пуск и дымный след. Обе функции объявлены как function name(){},
   то есть лежат на window и переприсваиваются. */
try{
  if(typeof vchRocketLaunch === "function"){
    const _rl = vchRocketLaunch;
    vchRocketLaunch = function(tube){
      const r = _rl(tube);
      try{ if(r && r.pos && r.dir) vfxRocketLaunch(r.pos, r.dir) }catch(e){}
      return r;
    };
  }
}catch(e){ console.warn("[91-fx] не удалось обернуть vchRocketLaunch", e) }

try{
  if(typeof vchRocketTrail === "function" && typeof VCH_RK !== "undefined"){
    const _rt = vchRocketTrail;
    vchRocketTrail = function(r, dt){
      _rt(r, dt);
      if(!r || !r.alive || !VFX.enabled) return;
      const K = (typeof VCH_FXK !== "undefined") ? VCH_FXK : 1;
      const burning = r.age > VCH_RK.ejectT && r.age < VCH_RK.ejectT + VCH_RK.burnT;
      const nozzle = r.pos.clone().addScaledVector(r.dir, -0.62);
      if(burning){
        /* факел работающего двигателя */
        for(let i=0;i<2;i++){
          en._get(en.fire).spawn({
            pos:nozzle,
            vel:r.vel.clone().multiplyScalar(-0.10).add(new P(
              (Math.random()-.5)*4, (Math.random()-.5)*4, (Math.random()-.5)*4)),
            life:0.07 + Math.random()*0.08,
            size0:0.42, size1:1.5 + Math.random()*0.7, sizePow:0.65,
            color:0xfff2cf, color1:0xc4460a, colorPow:1.35,
            drag:7, grav:-0.5, opacity:0.85, rotVel:3
          });
        }
        /* более плотный дым, чем давал базовый след */
        if(Math.random() < 0.55*K){
          en._get(en.pool).spawn({
            pos:nozzle,
            vel:r.vel.clone().multiplyScalar(-0.05).add(new P(
              (Math.random()-.5)*1.6, 0.4 + Math.random()*0.7, (Math.random()-.5)*1.6)),
            life:2.6 + Math.random()*2.0,
            size0:0.30, size1:2.6 + Math.random()*1.6, sizePow:0.8,
            color:0xc8c4bb, color1:0x8f8a80,
            drag:1.4, grav:-0.35, opacity:0.46, rotVel:1.4
          });
        }
      }
    };
  }
}catch(e){ console.warn("[91-fx] не удалось обернуть vchRocketTrail", e) }

/* ---------- 7. Кадр: обновление всего, что добавили --------------------- */

const _updBase = en.update.bind(en);
en.update = function(dt){
  _updBase(dt);                                  /* база + vFlash/vRing из 04-visual */
  for(const p of en.fire)  if(p.alive) p.update(dt);
  for(const p of en.ember) if(p.alive) p.update(dt);
  vfxFlashUpdate(dt);
  vfxWaveUpdate(dt);
  vfxWaveUniforms();
  const arr = en.__scorch;
  if(arr){
    for(const d of arr){
      if(d.life <= 0) continue;
      d.t += dt;
      const k = d.t / d.life;
      let o = d.target * Math.min(1, d.t/0.25);
      if(k > 0.8) o *= 1 - (k - 0.8)/0.2;
      if(d.t >= d.life){ d.life = 0; d.mesh.visible = false; o = 0 }
      d.mesh.material.opacity = Math.max(0, o);
    }
  }
};

/* ---------- 8. Bloom ---------------------------------------------------- */

const _bloom0 = {s:0, t:0, r:0};
try{
  if(typeof H1 !== "undefined" && H1){
    _bloom0.s = H1.strength; _bloom0.t = H1.threshold; _bloom0.r = H1.radius;
    H1.strength  = VFX.bloomStrength;
    H1.threshold = VFX.bloomThreshold;
    H1.radius    = VFX.bloomRadius;
  }
}catch(e){ console.warn("[91-fx] bloom не перенастроен", e) }

function vfxBloomApply(on){
  if(typeof H1 === "undefined" || !H1) return;
  if(on){
    H1.strength  = VFX.bloomStrength;
    H1.threshold = VFX.bloomThreshold;
    H1.radius    = VFX.bloomRadius;
  } else {
    H1.strength = _bloom0.s; H1.threshold = _bloom0.t; H1.radius = _bloom0.r;
  }
}
function vfxShockApply(on){
  if(VFX_shockPass) VFX_shockPass.enabled = !!on;
}

/* ---------- 9. Управление с консоли ------------------------------------- */

window.__vchFX = {
  cfg:VFX,
  shock:vfxShockApply, bloom:vfxBloomApply,
  off:function(){ VFX.enabled=false; vfxBloomApply(false); vfxShockApply(false);
                  return "базовые эффекты, bloom "+_bloom0.s+"/"+_bloom0.t },
  on: function(){ VFX.enabled=true;  vfxBloomApply(true);  vfxShockApply(true);
                  return "надстройка включена" },
  set:function(k,v){ if(k in VFX){ VFX[k] = v;
      if(k === "bloomStrength"  && typeof H1 !== "undefined") H1.strength  = VFX.bloomStrength;
      if(k === "bloomThreshold" && typeof H1 !== "undefined") H1.threshold = VFX.bloomThreshold;
      if(k === "bloomRadius"    && typeof H1 !== "undefined") H1.radius    = VFX.bloomRadius;
      return VFX[k] } return null },
  get:function(k){ return (k in VFX) ? VFX[k] : null },
  list:function(){ return JSON.parse(JSON.stringify(VFX)) },
  /* проверка из консоли: __vchFX.boom(2) — взрыв в 12 м перед танком */
  boom:function(s){ const p = new P(); qt.group.getWorldPosition(p);
    p.x += 12; p.y += 1.2; en.explosion(p, s||1.4); return "ok" },
  fire:function(){ const m = new P(), d = new P(0,0,1);
    qt.getMuzzle(m, d); en.muzzleBurst(m, d, qt.getMuzzleBrakepoints(4)); return "ok" }
};

console.log("[91-fx] эффекты выстрела и взрыва подключены");

})();
