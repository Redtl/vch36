/* ===== 90 · РАССВЕТ «АЛЕКСАНДРОВСК» (VCH_NIGHT) ===== */
"use strict";
/* =========================================================================
   90 · НОЧНОЙ ВАРИАНТ «АЛЕКСАНДРОВСКА»  (надстройка над дневным файлом)

   Панорама: Poly Haven · qwantani_sunrise_puresky · CC0 · скачана 4k (4096x2048),
   сжата до 2048x1024 RGBE: звёздное небо с Млечным путём, тёплое свечение
   городка у горизонта. Данные — base64 в том же формате, что встроенное небо
   карты 01 (VCHE1 + w,h + RGBE), поэтому файл работает и с file:// без сети,
   и не зависит от того, как браузер грузит страницу.

   Что подменяется:
     · купол неба (Gw → V_sky) — ShaderMaterial с equirect-сэмплом панорамы;
     · scene.environment — PMREM прямо из equirect (fromEquirectangular),
       поэтому отражения на металле соответствуют небу в кадре;
     · свет: луна = направление самой яркой части HDRI, синий hemi,
       холодный fill, тёмный туман, ночная экспозиция;
     · тёплые точечные фонари у стен/зданий (без теней);
     · подпись локации в HUD и на стартовом экране.
   ========================================================================= */
"use strict";
window.__VCH_NIGHT__ = true;

const VCH_NIGHT_SKY = {src:"Poly Haven · qwantani_sunrise_puresky", lic:"CC0", w:4096, h:2048,
  moon:[0.8076340316792885,0.037573682709270494,0.5884857595907661],
  get data(){return (typeof VCH_NIGHT_SKY_DATA_B64!=="undefined")?VCH_NIGHT_SKY_DATA_B64:window.VCH_NIGHT_SKY_DATA_B64}};

const VCH_NIGHT = {
  az:0.95,            /* поворот панорамы: солнце (0.628 рад) оказывается над морем по курсу спавна */
  el:0.0,             /* наклон панорамы: горизонт HDRI совпадает с игровым */
  gain:0.32,          /* яркость неба в кадре; было 0.74 — солнце в данных HDRI
                         выжигало кадр: при взгляде на него выгорало 24.6% пикселей,
                         на машине 12%. Освещение техники от этого не зависит
                         (IBL считается из панорамы без gain), поэтому небо можно
                         гасить свободно: при 0.32 в солнце выгорает 11%, на
                         машине 0%. Диск солнца (moonDisk) и дымка тумана (glow)
                         в этот пересвет почти не вносят — проверено по отдельности.
                         Правится ползунком «Небо HDRI» во вкладке СВЕТ (F) */
  contrast:1.05,      /* контраст неба: гасит дымку (pow в линейном) */
  sharpen:0.55,       /* unsharp по панораме: облака не «мылятся» на куполе */
  texel:[1/4096, 1/2048],  /* заменяется реальным размером панорамы в domeMat() */
  tint:[1.05,1.01,0.96],  /* лёгкое тепло: HDRI у зенита очень «циановая» */
  sat:0.82,           /* насыщенность неба: тонмаппинг игры её подкручивает */
  zenithDim:[0.99,1.00,1.03],  /* лёгкий градиент к зениту, без ночного затемнения */
  envGain:0.85,       /* яркость окружения (environmentIntensity) для всех материалов */
  exposure:1.02,      /* toneMappingExposure (дневной файл: 1.02) */
  moonCol:0xffdcb8, moonI:2.40,   /* диск солнца на небе (в шейдере купола) */
  /* Отдельная сила направленного источника: он же рисует тени. Нельзя брать
     moonI — при нужной для теней силе (около 8) диск на небе сгорает в белое
     пятно. Физически это один источник, но яркость диска и освещённость
     сцены масштабируются по-разному, поэтому два ключа. */
  sunI:8.0,
  moonDisk:16.0, moonSize:0.012,  /* диск солнца в шейдере неба (HDR) и его радиус, cos */
  stars:0.0, starDensity:165.0, starSize:0.085,   /* звёзд на рассвете нет */
  fog:0xc9cfd6, fogD:0.0007,
  lampCol:0xffc98a, lampI:0.0, lampDist:28, lampH:4.2,
  /* ---- task 18 · свет только от HDRI ------------------------------------
     Надстройка «Рассвет» ставила панораму на купол неба, но сцену освещали
     четыре искусственных источника (hemi 1.0, ambient 0.19, fill 0.5,
     bounce 0.38) плюс солнце, которое каждый кадр переставлялось в 10-ai.js
     на фиксированное смещение (-52,62,-78) — то есть не туда, где солнце
     нарисовано в HDRI. Из-за этого танк и карта освещались «сами по себе»,
     а тени домов не совпадали с панорамой.
     Теперь: искусственные источники по умолчанию выключены, солнце держит
     направление из HDRI, окружение строится из той же откорректированной
     панорамы, что видна в кадре (VCH_NIGHT_envSrc). Ползунки оставлены,
     чтобы при желании вернуть подсветку теней.                            */
  hemiSky:0xa8c4e8, hemiGround:0x6d5f4e, hemiI:0.00,
  fillCol:0xffe0c0, fillI:0.00,
  ambI:0.00,          /* AmbientLight — 0: весь свет от панорамы */
  bounceI:0.00,       /* направленный «отражённый от грунта» — 0 */
  sunDist:190,        /* расстояние от цели до солнца (влияет на near/far теней) */
  /* Солнце в панораме стоит почти у горизонта (высота 2.2°): физически верно,
     но освещённость горизонтальной поверхности при этом всего sin(2°) = 3%,
     тени от домов не читаются вообще. sunLift задаёт минимальную высоту
     солнца над горизонтом в градусах — свет остаётся «рассветным» (длинные
     тени), но тени видно. 0 = строго по панораме. */
  sunLift:16,
  shadowSpan:70,      /* полуохват тень-камеры, м: было 110 на всю карту (250 м) */
  /* bias 0 — при -0.0006 тени от домов практически исчезали (замер: 14% кадра
     вместо 45%). От acne держит один normalBias. */
  shadowBias:0, shadowNormalBias:0.03, shadowMap:2048,
  mapEnv:1.15,        /* envMapIntensity материалов карты Александровск */
  envW:1024           /* ширина панорамы для окружения: PMREM всё равно
                         сворачивает её в куб 256, большего не нужно, зато
                         пересчёт при движении ползунков идёт за десятки мс */
};
const VCH_LAMP_SITES = [[25.2, 16.8, -6.0], [-5.8, -32.2, 0.0], [-35.8, -1.8, 0.0], [34.2, -19.2, -6.0], [-9.8, 41.2, 0.0], [20.2, 41.8, -0.0], [26.2, -39.8, 0.0], [-36.8, -39.2, 6.0], [-2.2, -56.2, 6.0], [-59.8, -1.8, 0.0], [59.2, 17.8, -6.0], [-34.8, 51.2, 0.0], [-5.2, 62.2, 6.0], [49.2, 41.8, -0.0], [68.2, -9.2, -6.0], [-58.8, -39.2, 6.0], [-81.8, -5.2, 0.0], [24.2, -78.2, -0.0], [-38.8, -72.2, 6.0], [-71.2, 45.8, -0.0], [84.2, 32.2, 6.0], [-78.8, -47.2, 6.0], [-10.8, -93.8, 0.0], [78.2, 58.8, 6.0], [-99.8, 19.8, 0.0], [-33.8, -99.8, 0.0]];

let VCH_NIGHT_TEX = null, VCH_NIGHT_MAT = null, VCH_NIGHT_ENV = null,
    VCH_NIGHT_STATE = "idle", VCH_LAMPS = [];

/* -------------------- 1. панорама: base64 → RGBA float ------------------- */
/* Данные — тот же контейнер VCHE1, но сжатый gzip (4k-панорама целиком весит
   33 МБ). Разжимаем своим inflate в главном потоке; если браузер не дал
   DecompressionStream — внятная ошибка, а не «молча дневное небо». */
function VCH_NIGHT_gunzip(u8){
  /* gzip:def late — используем DecompressionStream, он есть во всех
     актуальных Chrome/Firefox/Safari (16.4+) */
  const st = new Blob([u8]).stream().pipeThrough(new DecompressionStream("gzip"));
  return new Response(st).arrayBuffer();
}
/* RGBE → Float32 RGBA (как VCH_MAP01_HDR из 06d) */
function VCH_NIGHT_decode(b64){
  const s = atob(b64), n = s.length, raw = new Uint8Array(n);
  for(let i=0;i<n;i++)raw[i]=s.charCodeAt(i);
  return VCH_NIGHT_gunzip(raw).then(buf=>{
    const b = new Uint8Array(buf);
    if(String.fromCharCode(b[0],b[1],b[2],b[3],b[4]) !== "VCHE1") throw new Error("VCHE1: нет сигнатуры");
    const w = b[5] | (b[6] << 8), h = b[7] | (b[8] << 8);
    const rgb = b.subarray(9);
    if(rgb.length !== w*h*4) throw new Error("VCHE1: размер данных");
    const out = new Float32Array(w*h*4);
    /* 4.3: 4096x2048 = 8.4 млн пикселей, и Math.pow на каждом стоил больше
       секунды прямо в стартовом меню. Степень двойки целочисленная, поэтому
       все 256 значений считаются один раз в таблицу. */
    const EXP = window.__vchNightExp || (window.__vchNightExp = (function(){
      const t = new Float32Array(256);
      for(let e=0;e<256;e++) t[e] = e>0 ? Math.pow(2,e-136) : 0;
      return t;
    })());
    for(let i=0,p=0;i<w*h;i++,p+=4){
      const f = EXP[rgb[p+3]];
      out[i*4] = rgb[p]*f; out[i*4+1] = rgb[p+1]*f; out[i*4+2] = rgb[p+2]*f; out[i*4+3] = 1;
    }
    const tex = new hf(out,w,h,bn,Un);  /* DataTexture, RGBA, FloatType */
    tex.mapping = Vc;                   /* EquirectangularReflectionMapping */
    tex.colorSpace = Ye;                /* LinearSRGBColorSpace */
    tex.flipY = false;                  /* первая строка данных — зенит */
    tex.minFilter = pn; tex.magFilter = pn;
    tex.generateMipmaps = false;
    tex.needsUpdate = true;
    return tex;
  });
}

/* ----------------------------- 2. купол неба ---------------------------- */
function VCH_NIGHT_domeMat(tex){
  const uniforms = {
    tSky:{value:tex}, uRot:{value:VCH_NIGHT.az}, uTilt:{value:VCH_NIGHT.el},
    uGain:{value:VCH_NIGHT.gain}, uTime:{value:0},
    uPow:{value:VCH_NIGHT.contrast},
    uSharpen:{value:VCH_NIGHT.sharpen},
    uStars:{value:VCH_NIGHT.stars}, uStarD:{value:VCH_NIGHT.starDensity},
    uStarS:{value:VCH_NIGHT.starSize},
    uTexel:{value:new ct(1/(tex.image?tex.image.width:VCH_NIGHT_SKY.w),
                          1/(tex.image?tex.image.height:VCH_NIGHT_SKY.h))},
    uMoon:{value:(()=>{const v=new Ft(0.8076340316792885,0.037573682709270494,0.5884857595907661);return v.multiplyScalar(1/Math.hypot(0.8076340316792885,0.037573682709270494,0.5884857595907661))})()},
    uMoonCol:{value:new Ft(1.0,0.97,0.90)}, uMoonI:{value:VCH_NIGHT.moonDisk},
    uTint:{value:new Ft(VCH_NIGHT.tint[0],VCH_NIGHT.tint[1],VCH_NIGHT.tint[2])},
    uZen:{value:new Ft(VCH_NIGHT.zenithDim[0],VCH_NIGHT.zenithDim[1],VCH_NIGHT.zenithDim[2])},
    uSat:{value:VCH_NIGHT.sat}
  };
  return new $e({
    side:Ze, depthWrite:false, dithering:true, uniforms:uniforms,
    vertexShader:[
      "varying vec3 vDir;",
      "void main(){ vDir=normalize(position);",
      "  gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }"
    ].join("\n"),
    fragmentShader:[
      "uniform sampler2D tSky; uniform float uRot,uTilt,uGain,uTime,uPow,uMoonI,uMoonSize,uSharpen;",
      "uniform vec2 uTexel; uniform vec3 uTint,uZen,uMoon,uMoonCol; uniform float uStars,uStarD,uStarS,uSat;",
      "varying vec3 vDir;",
      /* хеши: свои, чтобы не зависеть от шейдеров движка */
      "float h13(vec3 p){ p=fract(p*0.1031); p+=dot(p,p.yzx+33.33); return fract((p.x+p.y)*p.z); }",
      "vec3 h33(vec3 p){ p=fract(p*vec3(0.1031,0.1030,0.0973)); p+=dot(p,p.yxz+33.33);",
      "  return fract((p.xxy+p.yxx)*p.zyx); }",
      /* звёздное поле в равнопромежуточной развёртке: точки рисуются в экранном
         разрешении, поэтому не «мылятся», как запечённые в 2k-панораму */
      "float stars(vec2 uv, float dens, float size, float keep){",
      "  vec2 g=vec2(uv.x*dens, uv.y*dens*0.5);",
      "  vec2 ci=floor(g), cf=fract(g);",
      "  vec3 hh=h33(vec3(ci,keep));",
      "  if(hh.z<0.62) return 0.0;",
      "  vec2 sp=hh.xy*0.8+0.1;",
      "  float d=length((cf-sp)*vec2(1.0,1.0));",
      "  float r=size*(0.55+0.75*hh.z);",
      "  float core=smoothstep(r,0.0,d);",
      "  float spike=smoothstep(r*0.35,0.0,d)*0.6;",
      "  return (core+spike)*(0.35+0.65*h13(vec3(ci,keep+7.0)));",
      "}",
      "vec3 skyDir(vec3 d){",
      "  float c=cos(uRot),s=sin(uRot);",
      "  vec3 r=vec3(d.x*c-d.z*s, d.y, d.x*s+d.z*c);",          /* поворот по азимуту */
      "  float ct=cos(uTilt),st=sin(uTilt);",
      "  r=vec3(r.x, r.y*ct-r.z*st, r.y*st+r.z*ct);",           /* и наклон */
      "  return normalize(r);",
      "}",
      "void main(){",
      "  vec3 d=normalize(vDir);",
      "  vec3 sd=skyDir(d);",
      /* equirect: u по atan2(z,x), v по acos(y); строка 0 = зенит (flipY=false) */
      "  float u=atan(sd.z,sd.x)*0.15915494+0.5;",
      "  float v=acos(clamp(sd.y,-1.0,1.0))*0.31830989;",
      /* 4 отсчёта внутри текселя + unsharp по двум масштабам: купол растягивает
         панораму в 2–3 раза, без этого звёзды расплываются в «мыло» */
      "  vec2 uv=vec2(u,v); vec2 o=uTexel*0.25; vec2 q=uTexel*0.75;",
      "  vec3 s0=texture2D(tSky,uv-vec2(o.x,o.y)).rgb;",
      "  vec3 s1=texture2D(tSky,uv+vec2(o.x,-o.y)).rgb;",
      "  vec3 s2=texture2D(tSky,uv+vec2(-o.x,o.y)).rgb;",
      "  vec3 s3=texture2D(tSky,uv+vec2(o.x,o.y)).rgb;",
      "  vec3 fine=(s0+s1+s2+s3)*0.25;",
      "  vec3 b0=texture2D(tSky,uv-vec2(q.x,q.y)).rgb;",
      "  vec3 b1=texture2D(tSky,uv+vec2(q.x,-q.y)).rgb;",
      "  vec3 b2=texture2D(tSky,uv+vec2(-q.x,q.y)).rgb;",
      "  vec3 b3=texture2D(tSky,uv+vec2(q.x,q.y)).rgb;",
      "  vec3 blur=(fine+(b0+b1+b2+b3)*0.25)*0.5;",
"  vec3 col=max(fine+(fine-blur)*uSharpen, vec3(0.0));",
      /* контраст в линейном: дымку придавливает, звёзды/HDR-диск оставляет */
      "  col=pow(max(col,vec3(1e-5)),vec3(uPow))*uGain;",
      /* звёзды: два слоя (яркие редкие + слабые частые), гаснут у горизонта
         и в местах, где панорама сама светлая (городская засветка) */
      "  float skyLum=dot(col,vec3(0.2126,0.7152,0.0722));",
      "  float vis=smoothstep(0.02,0.16,d.y)*(1.0-smoothstep(0.005,0.06,skyLum));",
      "  vec2 suv=vec2(u,v);",
      "  float st=stars(suv,uStarD,uStarS,3.0)*1.0+stars(suv+vec2(0.37,0.11),uStarD*1.9,uStarS*0.72,11.0)*0.55;",
      "  float tw=0.78+0.22*sin(uTime*1.7+dot(suv,vec2(91.7,57.3)));",
      "  col+=vec3(0.92,0.95,1.05)*st*vis*tw*uStars*0.55;",
      "  col*=mix(vec3(1.04,0.93,0.84),uTint,smoothstep(-0.01,0.12,d.y));",
      /* градиент к зениту: гасит серую пыль панорамы, ночь становится глубже */
      "  col*=mix(vec3(1.0),uZen,smoothstep(0.06,0.55,d.y));",
      /* насыщенность: тонмаппинг игры выкручивает циан у зенита */
      "  col=mix(vec3(dot(col,vec3(0.2126,0.7152,0.0722))),col,uSat);",
      /* тёплое свечение города у горизонта и почти чёрный грунт ниже */
      "  float hh=d.y;",
      "  col+=vec3(0.050,0.030,0.013)*exp(-abs(hh)*13.0)*smoothstep(-0.06,0.0,hh);",
      "  col=mix(col,col*0.55,smoothstep(0.0,-0.10,hh));",
      /* солнце: диск поворачивается вместе с панорамой (skyDir), поэтому попадает
         ровно туда, где оно нарисовано в HDRI; сияние — тоже */
      "  float dm=dot(sd,normalize(skyDir(normalize(uMoon))));",
      "  float disk=smoothstep(cos(uMoonSize),cos(uMoonSize*0.86),dm);",
      "  float glow=pow(max(dm,0.0),900.0)*0.20+pow(max(dm,0.0),90.0)*0.035;",
      "  col+=uMoonCol*(disk*uMoonI+glow*0.22);",
      "  gl_FragColor=vec4(max(col,0.0),1.0);",
      "}"
    ].join("\n")
  });
}
function VCH_NIGHT_domeApply(){
  if(!V_sky || !VCH_NIGHT_MAT) return false;
  const old = V_sky.material;
  V_sky.material = VCH_NIGHT_MAT;
  V_sky.frustumCulled = false;
  V_sky.userData = V_sky.userData || {};
  V_sky.userData.vchNight = true;
  if(old && old !== VCH_NIGHT_MAT && old.dispose) { try{ old.dispose() }catch(e){} }
  return true;
}

/* --------------------------- 3. окружение (PMREM) ----------------------- */
/* Раньше PMREM строился из «сырой» панорамы: ползунки оттенка, насыщенности,
   контраста и яркости правили только купол неба, а на танк и карту шёл
   неоткорректированный свет — именно поэтому «свет от HDRI» на поверхностях
   не читался. Здесь панорама пересчитывается теми же формулами, что и в
   шейдере купола (поворот az/el, pow*gain, tint, zenithDim, насыщенность,
   свечение горизонта, диск солнца), и уже из неё считается IBL.
   Разрешение envW намеренно ниже исходного 4096: PMREM всё равно сворачивает
   панораму до грубых уровней, а пересчёт в 4 раза дешевле — это позволяет
   пересобирать окружение при движении ползунков.                           */
let VCH_NIGHT_ENVSRC = null;
function VCH_NIGHT_envSrc(){
  if(!VCH_NIGHT_TEX || !VCH_NIGHT_TEX.image || !VCH_NIGHT_TEX.image.data) return null;
  const img = VCH_NIGHT_TEX.image, sw = img.width, sh = img.height, sd = img.data;
  const W = Math.max(256, VCH_NIGHT.envW|0), H = W>>1;
  const out = new Float32Array(W*H*4);
  const ca=Math.cos(VCH_NIGHT.az), sa=Math.sin(VCH_NIGHT.az);
  const ct=Math.cos(VCH_NIGHT.el), st=Math.sin(VCH_NIGHT.el);
  const gain=VCH_NIGHT.gain, pw=VCH_NIGHT.contrast, sat=VCH_NIGHT.sat;
  const t0=VCH_NIGHT.tint, zn=VCH_NIGHT.zenithDim;
  const size=VCH_NIGHT.moonSize, diskI=VCH_NIGHT.moonDisk;
  const c0=Math.cos(size), c1=Math.cos(size*0.86);
  const mr=1.0, mg=0.97, mb=0.90;          /* цвет диска — как uMoonCol в куполе */
  /* направление на солнце в системе панорамы: skyDir(normalize(moon)) */
  const mv=VCH_NIGHT_SKY.moon, ml=Math.hypot(mv[0],mv[1],mv[2])||1;
  const ax=mv[0]/ml, ay=mv[1]/ml, av=mv[2]/ml;
  const smooth=(a,b,x)=>{ let t=(x-a)/(b-a); t=t<0?0:t>1?1:t; return t*t*(3-2*t) };
  const bx=ax*ca-av*sa, by=ay, bz=ax*sa+av*ca;
  const cx2=bx, cy2=by*ct-bz*st, cz2=by*st+bz*ct;
  const cl=Math.hypot(cx2,cy2,cz2)||1;
  const Mx=cx2/cl, My=cy2/cl, Mz=cz2/cl;
  const TP=Math.PI*2, IP=1/Math.PI, HPI=0.5/Math.PI;
  for(let y=0;y<H;y++){
    const v=(y+0.5)/H, th=v*Math.PI, sy=Math.cos(th), sr=Math.sin(th);
    for(let x=0;x<W;x++){
      const u=(x+0.5)/W, ph=(u-0.5)*TP;
      const dx=sr*Math.cos(ph), dy=sy, dz=sr*Math.sin(ph);
      /* skyDir(): сначала поворот по az, потом наклон по el — как в куполе */
      const rx=dx*ca-dz*sa, ry=dy, rz=dx*sa+dz*ca;
      const tx=rx, ty=ry*ct-rz*st, tz=ry*st+rz*ct;
      let uu=Math.atan2(tz,tx)*HPI+0.5;
      let vv=Math.acos(ty<-1?-1:(ty>1?1:ty))*IP;
      let px=(uu*sw)|0, py=(vv*sh)|0;
      if(px<0)px=0; else if(px>=sw)px=sw-1;
      if(py<0)py=0; else if(py>=sh)py=sh-1;
      const si=(py*sw+px)*4;
      let R=sd[si], G=sd[si+1], B=sd[si+2];
      if(pw!==1){
        R=Math.pow(R>1e-5?R:1e-5,pw); G=Math.pow(G>1e-5?G:1e-5,pw); B=Math.pow(B>1e-5?B:1e-5,pw);
      }
      R*=gain; G*=gain; B*=gain;
      const k1=smooth(-0.01,0.12,dy);
      R*=1.04+(t0[0]-1.04)*k1; G*=0.93+(t0[1]-0.93)*k1; B*=0.84+(t0[2]-0.84)*k1;
      const k2=smooth(0.06,0.55,dy);
      R*=1+(zn[0]-1)*k2; G*=1+(zn[1]-1)*k2; B*=1+(zn[2]-1)*k2;
      if(sat!==1){ const L=0.2126*R+0.7152*G+0.0722*B; R=L+(R-L)*sat; G=L+(G-L)*sat; B=L+(B-L)*sat }
      const e=Math.exp(-Math.abs(dy)*13.0)*smooth(-0.06,0.0,dy);
      R+=0.050*e; G+=0.030*e; B+=0.013*e;
      const k3=1-0.45*smooth(0.0,-0.10,dy);
      R*=k3; G*=k3; B*=k3;
      const dm=tx*Mx+ty*My+tz*Mz;
      if(dm>0.90){
        const disk=smooth(c0,c1,dm);
        const glow=(Math.pow(dm,900.0)*0.20+Math.pow(dm,90.0)*0.035)*0.22;
        const add=disk*diskI+glow;
        R+=mr*add; G+=mg*add; B+=mb*add;
      }
      const o=(y*W+x)*4;
      out[o]=R>0?R:0; out[o+1]=G>0?G:0; out[o+2]=B>0?B:0; out[o+3]=1;
    }
  }
  const tex = new hf(out,W,H,bn,Un);
  tex.mapping = Vc; tex.colorSpace = Ye; tex.flipY = false;
  tex.minFilter = pn; tex.magFilter = pn; tex.generateMipmaps = false;
  tex.needsUpdate = true;
  return tex;
}
function VCH_NIGHT_buildEnv(){
  try{
    let src = null;
    try{ src = VCH_NIGHT_envSrc() }catch(e){ console.warn("[sunrise] envSrc",e) }
    if(!src) src = VCH_NIGHT_TEX;            /* если пересчёт не удался — сырая панорама */
    if(!src) return null;
    const pm = new vl(Jn);                    /* PMREMGenerator */
    const env = pm.fromEquirectangular(src);
    pm.dispose();
    if(src !== VCH_NIGHT_TEX && src.dispose) { try{ src.dispose() }catch(e){} }
    if(VCH_NIGHT_ENV && VCH_NIGHT_ENV.dispose) { try{ VCH_NIGHT_ENV.dispose() }catch(e){} }
    VCH_NIGHT_ENV = env.texture;
    cn.environment = env.texture;
    cn.environmentIntensity = VCH_NIGHT.envGain;
    return env.texture;
  }catch(e){ console.warn("[sunrise] env",e); return null }
}

/* ------------------------------- 4. свет -------------------------------- */
let VCH_NIGHT_SUN_DIR = null;
function VCH_NIGHT_lights(){
  const m = VCH_NIGHT_SKY.moon;
  /* свет ставим ровно туда, где солнце нарисовано в панораме (с учётом az/el) */
  const ca=Math.cos(VCH_NIGHT.az), sa=Math.sin(VCH_NIGHT.az);
  const lift = Math.sin((VCH_NIGHT.sunLift||0)*Math.PI/180);
  const dir = new P(m[0]*ca-m[2]*sa, Math.max(m[1], lift), m[0]*sa+m[2]*ca).normalize();
  VCH_NIGHT_SUN_DIR = dir;
  const sun = vSunLight();
  if(sun){
    /* куда именно светить — решает VCH_NIGHT_shadowFollow() каждый кадр:
       центр цели = танк (с округлением до текселя), смещение = это направление */
    sun.color.setHex(VCH_NIGHT.moonCol);
    sun.intensity = VCH_NIGHT.sunI;
    if(sun.shadow){
      const sh = sun.shadow, span = VCH_NIGHT.shadowSpan, D = VCH_NIGHT.sunDist;
      sh.camera.left = -span; sh.camera.right = span;
      sh.camera.top = span;  sh.camera.bottom = -span;
      sh.camera.near = Math.max(1, D - span*2 - 60);
      sh.camera.far  = D + span*2 + 60;
      const ms = Math.max(512, VCH_NIGHT.shadowMap|0);
      if(sh.mapSize.width !== ms){
        sh.mapSize.set(ms,ms);
        if(sh.map){ sh.map.dispose(); sh.map = null }
      }
      sh.camera.updateProjectionMatrix();
      sh.bias = VCH_NIGHT.shadowBias; sh.normalBias = VCH_NIGHT.shadowNormalBias;
    }
  }
  /* Искусственный свет. Раньше hemi/ambient/fill/bounce несли бóльшую часть
     освещённости, из-за чего HDRI на поверхностях почти не читался. По
     умолчанию всё выключено: сцену освещают солнце из панорамы и IBL.
     Ползунки оставлены — ими возвращают подсветку теней, если нужно. */
  const hemi = cn.children.find(o=>o.isHemisphereLight);
  if(hemi){
    hemi.color.setHex(VCH_NIGHT.hemiSky);
    hemi.groundColor.setHex(VCH_NIGHT.hemiGround);
    hemi.intensity = VCH_NIGHT.hemiI;
  }
  for(const o of cn.children) if(o.isAmbientLight) o.intensity = VCH_NIGHT.ambI;
  /* fill и bounce — два оставшихся направленных источника без теней */
  let nth = 0;
  for(const o of cn.children){
    if(o.isDirectionalLight && o !== sun){
      const isFill = (nth++)===0;
      o.intensity = isFill ? VCH_NIGHT.fillI : VCH_NIGHT.bounceI;
      o.color.setHex(isFill ? VCH_NIGHT.fillCol : 0xffd9b0);
      if(o.target){ o.target.position.set(0,0,0); o.target.updateMatrixWorld() }
    }
  }
  if(VCH_ALEKS.scene3 && VCH_ALEKS.scene3.fog){
    const f = VCH_ALEKS.scene3.fog;
    if(f.color) f.color.setHex(VCH_NIGHT.fog);
    f.density = VCH_NIGHT.fogD;
  }
  Jn.toneMappingExposure = VCH_NIGHT.exposure;
}

/* ------------------- 4b. тени: камера следует за танком ------------------ */
/* 10-ai.js каждый кадр ставит солнце в «танк + (-52,62,-78)» — то есть вовсе
   не туда, где солнце нарисовано в HDRI. Поэтому тени домов лежали не по
   панораме. Перехватываем renderer.render: это выполняется уже после игрового
   кадра, поэтому наше направление не затирается. Центр тень-камеры — танк,
   округлённый до текселя: иначе при движении тени «ползут» и дрожат.       */
function VCH_NIGHT_shadowFollow(){
  if(!VCH_NIGHT_GUARD || !VCH_NIGHT_SUN_DIR) return;
  const sun = vSunLight();
  if(!sun || !sun.castShadow || !sun.shadow) return;
  /* Живой танк — window.__scorpion.rig.group. Глобальный qt в этом бандле
     указывает на другой объект (он стоит в 0,0 и не двигается), поэтому
     брать позицию из него нельзя: тень-камера осталась бы на спавне. */
  let tx=0, ty=0, tz=0, g=null;
  try{ const R = (typeof window !== "undefined") ? window.__scorpion : null;
       if(R && R.rig && R.rig.group && R.rig.group.position) g = R.rig.group;
       else if(typeof qt !== "undefined" && qt && qt.group) g = qt.group;
       if(g && g.position){ tx=g.position.x; ty=g.position.y; tz=g.position.z } }catch(e){}
  const span = VCH_NIGHT.shadowSpan, D = VCH_NIGHT.sunDist;
  const ms = sun.shadow.mapSize.width || 2048;
  const texel = (span*2)/ms;
  const cx = Math.round(tx/texel)*texel,
        cy = Math.round(ty/texel)*texel,
        cz = Math.round(tz/texel)*texel;
  sun.target.position.set(cx, cy, cz);
  sun.target.updateMatrixWorld();
  sun.position.set(cx + VCH_NIGHT_SUN_DIR.x*D,
                   cy + VCH_NIGHT_SUN_DIR.y*D,
                   cz + VCH_NIGHT_SUN_DIR.z*D);
}
let VCH_NIGHT_HOOKED = false;
function VCH_NIGHT_hookRender(){
  if(VCH_NIGHT_HOOKED || typeof Jn === "undefined" || !Jn || !Jn.render) return;
  const orig = Jn.render.bind(Jn);
  Jn.render = function(scene, camera){
    try{ VCH_NIGHT_shadowFollow() }catch(e){}
    return orig(scene, camera);
  };
  VCH_NIGHT_HOOKED = true;
}
/* envMapIntensity материалов карты: в 06e он принудительно 1.0 при сборке,
   а значение ползунка «HDRI на карте» нужно уметь менять на ходу */
function VCH_NIGHT_mapEnv(){
  let n = 0;
  if(typeof VCH_ALEKS === "undefined" || !VCH_ALEKS || !VCH_ALEKS.group) return 0;
  VCH_ALEKS.group.traverse(o=>{
    if(!o.isMesh || !o.material) return;
    const arr = Array.isArray(o.material) ? o.material : [o.material];
    for(const m of arr){
      if(m && m.envMapIntensity !== undefined){
        m.envMapIntensity = VCH_NIGHT.mapEnv; m.needsUpdate = true; n++;
      }
    }
  });
  return n;
}

/* --------------------- 5. тёплые фонари у стен/зданий ------------------- */
/* Мачта + плафон + точечный свет. Материалы общие (2 вызова отрисовки на все
   26 ламп — инстанс-совместимые объекты не нужны), теней у ламп нет. */
let VCH_LAMP_GEO = null, VCH_LAMP_MAT = null, VCH_BULB_MAT = null, VCH_LAMP_HEAD = null, VCH_GLOW_TEX = null;
function VCH_NIGHT_glowTex(){
  if(VCH_GLOW_TEX) return VCH_GLOW_TEX;
  const N = 64, c = Qs(N), g = c.getContext("2d");
  const gr = g.createRadialGradient(N/2,N/2,0,N/2,N/2,N/2);
  gr.addColorStop(0,"rgba(255,226,180,0.90)");
  gr.addColorStop(0.25,"rgba(255,196,130,0.34)");
  gr.addColorStop(1,"rgba(255,170,90,0)");
  g.fillStyle = gr; g.fillRect(0,0,N,N);
  const t = new Ks(c); t.colorSpace = Ie;
  VCH_GLOW_TEX = t; return t;
}
/* одна лампа: мачта от грунта + плафон + свечение + точечный свет.
   Высота берётся у игрового геометра ge() (та же функция, что держит подвеску),
   поэтому опора всегда стоит на земле — независимо от того, какая это точка карты. */
function VCH_NIGHT_makeLamp(x,z){
  if(!VCH_LAMP_GEO){
    VCH_LAMP_GEO = new mn(0.085,0.075,1,7,1);      /* мачта: единичная высота, масштабируем */
    VCH_LAMP_MAT = new fe({color:0x14161a, roughness:0.72, metalness:0.55});
    VCH_BULB_MAT = new fe({color:0xffd2a0, roughness:0.45, metalness:0.0,
                           emissive:0xffcf96, emissiveIntensity:2.4});
    VCH_LAMP_HEAD = new _e(0.34,0.16,0.22);
  }
  const gy = (typeof ge === "function") ? ge(x,z) : 0;
  const h  = VCH_NIGHT.lampH;
  const pole = new Lt(VCH_LAMP_GEO, VCH_LAMP_MAT);
  pole.position.set(x, gy + h/2, z);
  pole.scale.set(1,h,1);
  pole.castShadow = false; pole.receiveShadow = false;
  cn.add(pole);
  const bulb = new Lt(VCH_LAMP_HEAD, VCH_BULB_MAT);
  bulb.position.set(x, gy + h, z);
  cn.add(bulb);
  const glow = new cf(new Wl({map:VCH_NIGHT_glowTex(), transparent:true,
                              depthWrite:false, blending:2, opacity:0.62}));
  glow.position.set(x, gy + h, z);
  glow.scale.setScalar(2.8);
  cn.add(glow);
  const L = new Ql(VCH_NIGHT.lampCol, VCH_NIGHT.lampI, VCH_NIGHT.lampDist, 1.6);
  L.position.set(x, gy + h - 0.35, z);
  L.castShadow = false;
  cn.add(L);
  return L;
}
function VCH_NIGHT_lamps(){
  if(VCH_LAMPS.length) return VCH_LAMPS;
  if(VCH_NIGHT.lampI<=0) return VCH_LAMPS;   /* днём фонари не нужны */
  for(const site of VCH_LAMP_SITES) VCH_LAMPS.push(VCH_NIGHT_makeLamp(site[0], site[1]));
  return VCH_LAMPS;
}


/* ------------------------- 5b. туман (аэрозоль) ------------------------- */
/* Реалистичный туман без второго рендера и без пост-прохода: в шейдеры всех
   материалов карты вставляется аналитическая аэрозольная перспектива.
     · плотность спадает с высотой — над водой и у горизонта дымка, в низинах
       приземная мгла;
     · цвет зависит от направления на солнце: к солнцу тёплый, от солнца
       холодный, у самого солнца — светящаяся дымка (forward scattering).
   Поэтому туман «стоит» ровно в том свете, что и рассвет в HDRI.
   Считается в том же месте, где штатный fog_fragment (после тонмаппинга),
   поэтому цвета задаются обычными «экранными» значениями. */
const VCH_FOG = {
  on:true,
  base:0.0042,       /* ровная дымка: 1/0.0042 ~ 240 м до e-раз (было 0.010) */
  mist:0.014,        /* плотность приземного тумана у самой земли (было 0.050) */
  scaleH:3.4,        /* высота, на которой приземный туман слабеет в e раз */
  h0:0.0,            /* уровень, от которого считается высота */
  sunPow:4.0,        /* как резко дымка теплеет к солнцу */
  glow:0.50,         /* светящаяся дымка вокруг солнца */
  glowPow:48.0,
  colSun:0xd9b08c,   /* дымка «в солнце»  */
  colSky:0x93a0ad,   /* дымка «от солнца» */
  colMist:0x8a919b,  /* приземная мгла */
  horizon:0.55       /* подмешивание тёплого к самому горизонту */
};
const VCH_FOG_U = {
  uFogSun:{value:new P(0,1,0)},
  uFogCamPos:{value:new P()},
  uFogRight:{value:new P(1,0,0)}, uFogUp:{value:new P(0,1,0)}, uFogFwd:{value:new P(0,0,-1)},
  uFogColSun:{value:new Ft(VCH_FOG.colSun)},
  uFogColSky:{value:new Ft(VCH_FOG.colSky)},
  uFogColMist:{value:new Ft(VCH_FOG.colMist)},
  uFogBase:{value:VCH_FOG.base}, uFogMist:{value:VCH_FOG.mist},
  uFogScaleH:{value:VCH_FOG.scaleH}, uFogH0:{value:VCH_FOG.h0},
  uFogSunPow:{value:VCH_FOG.sunPow}, uFogGlow:{value:VCH_FOG.glow},
  uFogGlowPow:{value:VCH_FOG.glowPow}, uFogHorizon:{value:VCH_FOG.horizon}
};
/* объявления — в глобальную область, тело — на место штатного fog_fragment */
const VCH_FOG_DECL = [
  "varying vec3 vFogView;",
  "uniform vec3 uFogSun,uFogCamPos,uFogRight,uFogUp,uFogFwd;",
  "uniform vec3 uFogColSun,uFogColSky,uFogColMist;",
  "uniform float uFogBase,uFogMist,uFogScaleH,uFogH0,uFogSunPow,uFogGlow,uFogGlowPow,uFogHorizon;"
].join("\n");
const VCH_FOG_BODY = [
  "{",
  "  float fdist=length(vFogView);",
  "  vec3 fdv=vFogView/max(fdist,1e-4);",
  "  vec3 fraw=uFogRight*fdv.x+uFogUp*fdv.y+uFogFwd*fdv.z;",
  "  float fraw2=dot(fraw,fraw);",
  "  vec3 fdw=(fraw2>1e-8)?fraw*inversesqrt(fraw2):uFogFwd;",
  "  float fk=1.0/max(uFogScaleH,0.1);",
  "  float fy0=uFogCamPos.y-uFogH0;",
  "  float fy1=fy0+fdw.y*fdist;",
  "  float fa0=exp(-max(fy0,0.0)*fk);",
  "  float fa1=exp(-max(fy1,0.0)*fk);",
  "  float ftM=abs(fdw.y)<1e-5 ? uFogMist*fa0*fdist : uFogMist*(fa0-fa1)/max(fk*fdw.y,1e-5);",
  "  ftM=max(ftM,0.0);",
  "  float ftau=exp(-(ftM+uFogBase*fdist));",
  "  float ffsun=clamp(dot(fdw,uFogSun),0.0,1.0);",
  "  vec3 fcol=mix(uFogColSky,uFogColSun,pow(ffsun,uFogSunPow));",
  "  fcol=mix(fcol,uFogColSun,uFogHorizon*(1.0-exp(-max(fdist-30.0,0.0)*0.006))*pow(ffsun,1.5));",
  "  fcol=mix(fcol,uFogColMist,clamp(ftM/max(ftM+uFogBase*fdist,1e-4),0.0,1.0)*0.45);",
  "  float ffog=clamp(1.0-ftau,0.0,1.0);",
  "  if(!(ffog>0.0)) ffog=0.0;",
  "  gl_FragColor.rgb=mix(gl_FragColor.rgb,fcol,ffog);",
  "  gl_FragColor.rgb+=uFogColSun*uFogGlow*pow(ffsun,uFogGlowPow)*ffog;",
  "}"
].join("\n");

const VCH_FOG_SEEN = new WeakSet();
function VCH_FOG_patch(m){
  if(!m || VCH_FOG_SEEN.has(m)) return 0;
  /* купол неба не туманим: он сам — «бесконечность» */
  if(m.uniforms && m.uniforms.tSky) return 0;
  if(!m.isMeshStandardMaterial && !m.isMeshPhysicalMaterial && !m.isMeshBasicMaterial &&
     !m.isMeshLambertMaterial && !m.isMeshPhongMaterial && !m.isMeshToonMaterial &&
     !m.isMeshMatcapMaterial) return 0;
  VCH_FOG_SEEN.add(m);
  const prev = m.onBeforeCompile;   /* цепочкой: у техники уже есть свой onBeforeCompile */
  m.onBeforeCompile = function(shader, rnd){
    if(prev) prev.call(this, shader, rnd);
    const vs = shader.vertexShader, fs = shader.fragmentShader;
    if(vs.indexOf("#include <project_vertex>") < 0) return;
    if(fs.indexOf("void main() {") < 0) return;
    Object.assign(shader.uniforms, VCH_FOG_U);
    shader.vertexShader = vs
      .replace("void main() {", "varying vec3 vFogView;\nvoid main() {")
      .replace("#include <project_vertex>", "#include <project_vertex>\n\tvFogView = mvPosition.xyz;");
    let f2;
    if(fs.indexOf("#include <fog_fragment>") >= 0) f2 = fs.replace("#include <fog_fragment>", VCH_FOG_BODY);
    else {
      const i = fs.lastIndexOf("}");
      f2 = fs.slice(0,i) + "\n" + VCH_FOG_BODY + "\n" + fs.slice(i);
    }
    f2 = f2.replace("void main() {", VCH_FOG_DECL + "\nvoid main() {");
    shader.fragmentShader = f2;
  };
  const prevKey = m.customProgramCacheKey;
  m.customProgramCacheKey = function(){ return (prevKey?prevKey.call(this):"") + "vchfog" };
  m.needsUpdate = true;
  return 1;
}
let VCH_FOG_PATCHED = 0, VCH_FOG_LAST = 0;
function VCH_FOG_install(){
  if(window.__vchFogDisable) return VCH_FOG_PATCHED;   /* A/B-проверка: туман выключен */
  if(!VCH_FOG.on || !cn) return VCH_FOG_PATCHED;
  cn.traverse(o=>{
    if(!o.material) return;
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    for(const m of mats) VCH_FOG_PATCHED += VCH_FOG_patch(m);
  });
  return VCH_FOG_PATCHED;
}
/* камера/солнце/параметры — каждый кадр */
function VCH_FOG_update(){
  if(!VCH_FOG.on || !cn) return;
  const cm = VCH_FOG_cam();
  if(!cm) return;
  const e = cm.matrixWorld.elements;
  VCH_FOG_U.uFogCamPos.value.copy(cm.position);
  VCH_FOG_U.uFogRight.value.set(e[0],e[1],e[2]).normalize();
  VCH_FOG_U.uFogUp.value.set(e[4],e[5],e[6]).normalize();
  VCH_FOG_U.uFogFwd.value.set(-e[8],-e[9],-e[10]).normalize();
  const m = VCH_NIGHT_SKY.moon, az = VCH_NIGHT.az;
  const ca = Math.cos(az), sa = Math.sin(az);
  VCH_FOG_U.uFogSun.value.set(m[0]*ca-m[2]*sa, Math.max(m[1],0.04), m[0]*sa+m[2]*ca).normalize();
  VCH_FOG_U.uFogBase.value = VCH_FOG.base;
  VCH_FOG_U.uFogMist.value = VCH_FOG.mist;
  VCH_FOG_U.uFogScaleH.value = VCH_FOG.scaleH;
  VCH_FOG_U.uFogH0.value = VCH_FOG.h0;
  VCH_FOG_U.uFogSunPow.value = VCH_FOG.sunPow;
  VCH_FOG_U.uFogGlow.value = VCH_FOG.glow;
  VCH_FOG_U.uFogGlowPow.value = VCH_FOG.glowPow;
  VCH_FOG_U.uFogHorizon.value = VCH_FOG.horizon;
  VCH_FOG_U.uFogColSun.value.setHex(VCH_FOG.colSun);
  VCH_FOG_U.uFogColSky.value.setHex(VCH_FOG.colSky);
  VCH_FOG_U.uFogColMist.value.setHex(VCH_FOG.colMist);
}
/* камера: у движка она лежит в __vchLook.camera() (для проверок) либо ищем сами */
let VCH_FOG_CAM = null;
function VCH_FOG_cam(){
  if(VCH_FOG_CAM && VCH_FOG_CAM.parent) return VCH_FOG_CAM;
  if(window.__vchLook && window.__vchLook.camera) VCH_FOG_CAM = window.__vchLook.camera();
  return VCH_FOG_CAM;
}

/* --------------------------- 6. подпись локации ------------------------- */
function VCH_NIGHT_label(){
  const set = () => {
    const a = document.getElementById("maplabel");
    if(a && !/РАССВЕТ/.test(a.textContent)) a.textContent = "ЛОКАЦИЯ: АЛЕКСАНДРОВСК · РАССВЕТ";
    const b = document.getElementById("mapname");
    if(b && !/РАССВЕТ/.test(b.textContent)) b.textContent = "АЛЕКСАНДРОВСК · РАССВЕТ";
    const c = document.getElementById("startloc");
    if(c && !/HDRI/.test(c.textContent))
      c.textContent = "ВЫБРАННАЯ ЛОКАЦИЯ: АЛЕКСАНДРОВСК · РАССВЕТ · HDRI: Poly Haven qwantani_sunrise_puresky 4K (CC0)";
  };
  set();
  try{
    const mo = new MutationObserver(set);
    for(const id of ["maplabel","mapname","startloc"]){
      const el = document.getElementById(id);
      if(el && !el.__vchNightObs){ el.__vchNightObs = 1; mo.observe(el,{childList:true,characterData:true,subtree:true}) }
    }
  }catch(e){}
}


/* Свет карты ставится в VCH_ALEKS_insert() ПОСЛЕ нашей настройки
   (sun.intensity = max(...,2.7), туман 0xc9cfd6), поэтому ночь включаем
   только когда модель собрана — и дальше сторозим значения каждый кадр. */
let VCH_NIGHT_GUARD = false;
function VCH_NIGHT_afterMap(){
  const go = () => {
    if(typeof VCH_ALEKS === "undefined"){ setTimeout(go,120); return }
    if(VCH_ALEKS.state === "ready"){
      VCH_NIGHT_lights();
      VCH_NIGHT_hookRender();
      VCH_NIGHT_shadowFollow();
      VCH_NIGHT_mapEnv();
      VCH_NIGHT_lamps();
      VCH_FOG_install();
      VCH_NIGHT_GUARD = true;
      console.log("[sunrise] свет применён после сборки карты (солнце "+vSunLight().intensity.toFixed(2)+", фонарей "+VCH_LAMPS.length+")");
    }else setTimeout(go,120);
  };
  go();
}
/* если что-то (перезапуск сцены, вставка карты) вернуло дневные значения — вернуть ночь */
function VCH_NIGHT_guard(){
  if(!VCH_NIGHT_GUARD) return;
  const sun = vSunLight();
  if(sun && sun.intensity > VCH_NIGHT.sunI*1.05) VCH_NIGHT_lights();
  if(VCH_ALEKS.scene3 && VCH_ALEKS.scene3.fog){
    const f = VCH_ALEKS.scene3.fog;
    if(f.color && f.color.getHex() !== VCH_NIGHT.fog){ f.color.setHex(VCH_NIGHT.fog); f.density = VCH_NIGHT.fogD }
  }
  if(Math.abs(Jn.toneMappingExposure - VCH_NIGHT.exposure) > 1e-3) Jn.toneMappingExposure = VCH_NIGHT.exposure;
  if(cn.environmentIntensity !== VCH_NIGHT.envGain) cn.environmentIntensity = VCH_NIGHT.envGain;
}

/* ----------------------------- 7. применение ---------------------------- */
function VCH_NIGHT_apply(){
  if(VCH_NIGHT_STATE !== "idle") return VCH_NIGHT_STATE;
  if(typeof VCH_MAP === "undefined") return "wait";
  if(VCH_MAP !== 4) return "skip";   /* надстройка включается только на Александровске */
  VCH_NIGHT_STATE = "loading";
  /* даём движку отрисовать первый кадр, распаковка панорамы — следующим тиком */
  Promise.resolve().then(()=>VCH_NIGHT_decode(VCH_NIGHT_SKY.data)).then(tex=>{
    VCH_NIGHT_TEX = tex;
    VCH_NIGHT_MAT = VCH_NIGHT_domeMat(VCH_NIGHT_TEX);
    VCH_NIGHT_domeApply();
    VCH_NIGHT_buildEnv();
    VCH_NIGHT_label();
    VCH_NIGHT_afterMap();
    VCH_NIGHT_STATE = "ready";
    console.log("[sunrise] HDRI "+VCH_NIGHT_SKY.w+"x"+VCH_NIGHT_SKY.h+" ("+VCH_NIGHT_SKY.src+"), луна "+
      VCH_NIGHT_SKY.moon.map(v=>v.toFixed(2)).join(",")+", фонарей "+VCH_LAMPS.length);
  }).catch(e=>{
    VCH_NIGHT_STATE = "error";
    console.error("[sunrise] панорама",e);
  });
  return VCH_NIGHT_STATE;
}

/* купол пересоздаётся при смене локации/перезапуске (Gw) — возвращаем свой */
function VCH_NIGHT_tick(){
  try{ VCH_NIGHT_guard() }catch(e){}
  try{ VCH_NIGHT_shadowFollow() }catch(e){}
  try{ VCH_FOG_update() }catch(e){}
  const now = performance.now();
  if(VCH_FOG.on && VCH_NIGHT_GUARD && now - VCH_FOG_LAST >= 900){ VCH_FOG_LAST = now; VCH_FOG_install() }
  if(V_sky && VCH_NIGHT_MAT && (!V_sky.userData || !V_sky.userData.vchNight)) VCH_NIGHT_domeApply();
  if(V_sky && V_sky.material && V_sky.material.uniforms && V_sky.material.uniforms.uTime)
    V_sky.material.uniforms.uTime.value = performance.now()*0.001;
  requestAnimationFrame(VCH_NIGHT_tick);
}

function VCH_NIGHT_boot(){
  if(typeof cn === "undefined" || typeof V_sky === "undefined" || typeof VCH_MAP === "undefined"){
    setTimeout(VCH_NIGHT_boot,150); return;
  }
  VCH_NIGHT_apply();
  VCH_NIGHT_tick();
}
VCH_NIGHT_boot();

/* подстройка на ходу (консоль/проверки): __vchNight.tune({gain:1.4}) */
window.__vchNight = {
  tune:(o)=>{
    Object.assign(VCH_NIGHT,o||{});
    if(VCH_NIGHT_MAT){
      const u=VCH_NIGHT_MAT.uniforms;
      u.uGain.value=VCH_NIGHT.gain; u.uRot.value=VCH_NIGHT.az; u.uTilt.value=VCH_NIGHT.el;
      u.uPow.value=VCH_NIGHT.contrast;
      u.uSharpen.value=VCH_NIGHT.sharpen;
      u.uZen.value.setRGB(VCH_NIGHT.zenithDim[0],VCH_NIGHT.zenithDim[1],VCH_NIGHT.zenithDim[2]);
      u.uSat.value=VCH_NIGHT.sat;
      u.uStars.value=VCH_NIGHT.stars; u.uStarD.value=VCH_NIGHT.starDensity;
      u.uStarS.value=VCH_NIGHT.starSize;
      u.uMoonI.value=VCH_NIGHT.moonDisk;
      u.uTint.value.setRGB(VCH_NIGHT.tint[0],VCH_NIGHT.tint[1],VCH_NIGHT.tint[2]);
    }
    if(o && o.fog){ Object.assign(VCH_FOG,o.fog); VCH_FOG_install() }
    /* пересвет/PMREM пересобираем только если тронули свет — иначе сцена на кадр
       остаётся с уничтоженным окружением (чёрный/пустой кадр) */
    const RELIGHT = ["moonI","moonCol","sunI","hemiI","hemiSky","hemiGround","fillI","fillCol",
                     "exposure","envGain","az","el","fogD","fog","gain","contrast","sharpen",
                     "tint","zenithDim","sat","stars","moonDisk",
                     /* task 18 */
                     "ambI","bounceI","sunDist","sunLift","shadowSpan","shadowBias",
                     "shadowNormalBias","shadowMap","mapEnv","envW"];
    const need = !!o && Object.keys(o).some(k=>RELIGHT.indexOf(k)>=0 && k!=="fog");
    if(VCH_NIGHT_STATE==="ready"){
      if(need){ VCH_NIGHT_lights(); VCH_NIGHT_buildEnv(); VCH_NIGHT_mapEnv() }
      VCH_FOG_update()
    }
    return JSON.parse(JSON.stringify(VCH_NIGHT, (k,v)=>k==="data"?undefined:v));
  },
  cfg:VCH_NIGHT, fog:VCH_FOG, fogupdate:()=>VCH_FOG_update(),
  sky:VCH_NIGHT_SKY, lamps:()=>VCH_LAMPS.length,
  /* для проверок: где стоит каждая лампа относительно грунта */
  /* поставить одну лампу в произвольной точке (проверка «стоит ли на земле») */
  debugLamp:(x,z)=>{ const L=VCH_NIGHT_makeLamp(x,z); VCH_LAMPS.push(L);
    const g=(typeof ge==="function")?ge(x,z):0;
    return {x:x,z:z,ground:g,poleBottom:g,poleTop:g+VCH_NIGHT.lampH}; },
  lampList:()=>VCH_LAMPS.map(L=>{const g=(typeof ge==="function")?ge(L.position.x,L.position.z):NaN;
    return {x:+L.position.x.toFixed(1), z:+L.position.z.toFixed(1), y:L.position.y, g:g, b:g};}),
  state:()=>VCH_NIGHT_STATE, apply:VCH_NIGHT_apply, env:()=>VCH_NIGHT_buildEnv(),
  tex:()=>VCH_NIGHT_TEX
};

/* =========================================================================
   8 · ПАНЕЛЬ КАРТИНКИ: ТУМАН / СВЕТ  (клавиша F)

   Туман считается своим шейдером (VCH_FOG: ровная дымка base, приземный
   туман mist с высотой слоя scaleH) плюс штатный FogExp2 сцены (VCH_NIGHT.fogD).
   Свет: экспозиция (VCH_NIGHT.exposure), окружение (envGain — яркость HDRI
   в отражениях и ambient), солнце (moonI), hemi, fill, блеск брони
   (VCH_REFLECT_GAIN — множитель к envMapIntensity набора материалов танка)
   и второй ACES в грейдинге (uTM). Всё правится на ходу, перезапуск не нужен.
   Значения запоминаются в localStorage (vch36.tune.v1).
   ========================================================================= */
(function vchTunePanel(){
  const KEY_STORE = "vch36.tune.v1";

  /* --- туман --- */
  const FOG = [
    {k:"base",    t:"Дымка (даль)",          min:0,    max:0.030,  step:0.0002, fmt:v=>v.toFixed(4)},
    {k:"mist",    t:"Приземный туман",       min:0,    max:0.090,  step:0.001,  fmt:v=>v.toFixed(3)},
    {k:"scaleH",  t:"Высота слоя тумана, м", min:0.5,  max:14,     step:0.1,    fmt:v=>v.toFixed(1)},
    {k:"glow",    t:"Свечение у солнца",     min:0,    max:1.2,    step:0.02,   fmt:v=>v.toFixed(2)},
    {k:"horizon", t:"Подсветка горизонта",   min:0,    max:1.0,    step:0.02,   fmt:v=>v.toFixed(2)},
    {k:"fogD",    t:"Дымка сцены (FogExp2)", min:0,    max:0.0040, step:0.00005,fmt:v=>v.toFixed(5)}
  ];
  /* --- свет/экспозиция --- */
  const LIT = [
    {k:"exposure", t:"Экспозиция",           min:0.40, max:1.60, step:0.01, fmt:v=>v.toFixed(2)},
    {k:"gain",     t:"Небо HDRI",            min:0.20, max:1.20, step:0.01, fmt:v=>v.toFixed(2)},
    {k:"moonDisk", t:"Диск солнца",          min:0,    max:20.0, step:0.5,  fmt:v=>v.toFixed(1)},
    {k:"envGain",  t:"Окружение (небо IBL)", min:0,    max:2.50, step:0.05, fmt:v=>v.toFixed(2)},
    {k:"moonI",    t:"Солнце",               min:0,    max:4.00, step:0.05, fmt:v=>v.toFixed(2)},
    {k:"sunI",     t:"Свет и тени",          min:0,    max:16.0, step:0.25, fmt:v=>v.toFixed(2)},
    {k:"hemiI",    t:"Небо (hemi)",          min:0,    max:2.00, step:0.05, fmt:v=>v.toFixed(2)},
    {k:"fillI",    t:"Подсветка (fill)",     min:0,    max:1.50, step:0.02, fmt:v=>v.toFixed(2)},
    {k:"ambI",     t:"Остат. свет (ambient)",min:0,    max:1.00, step:0.02, fmt:v=>v.toFixed(2)},
    {k:"bounceI",  t:"Отсвет от грунта",     min:0,    max:1.00, step:0.02, fmt:v=>v.toFixed(2)},
    {k:"mapEnv",   t:"HDRI на карте",        min:0,    max:2.50, step:0.05, fmt:v=>v.toFixed(2)},
    {k:"shadowSpan",t:"Охват теней, м",      min:30,   max:150,  step:5,    fmt:v=>v.toFixed(0)},
    {k:"sunLift",  t:"Высота солнца, °",    min:0,    max:60,   step:1,    fmt:v=>v.toFixed(0)},
    {k:"refl",     t:"Блеск брони",          min:0.10, max:1.50, step:0.02, fmt:v=>v.toFixed(2)},
    {k:"tm",       t:"Мягкий ACES (2-й)",    min:0,    max:1.00, step:0.02, fmt:v=>v.toFixed(2)},
    {k:"contrast", t:"Контраст",             min:0.80, max:1.50, step:0.01, fmt:v=>v.toFixed(2)}
  ];

  const GRADE = {tm:1.0, contrast:1.12};        /* значения грейдинга (uniform'ы пасса) */
  const DEF = {
    base:VCH_FOG.base, mist:VCH_FOG.mist, scaleH:VCH_FOG.scaleH,
    glow:VCH_FOG.glow, horizon:VCH_FOG.horizon, fogD:VCH_NIGHT.fogD,
    exposure:VCH_NIGHT.exposure, envGain:VCH_NIGHT.envGain, moonI:VCH_NIGHT.moonI,
    sunI:VCH_NIGHT.sunI,
    gain:VCH_NIGHT.gain, moonDisk:VCH_NIGHT.moonDisk,
    hemiI:VCH_NIGHT.hemiI, fillI:VCH_NIGHT.fillI,
    ambI:VCH_NIGHT.ambI, bounceI:VCH_NIGHT.bounceI,
    mapEnv:VCH_NIGHT.mapEnv, shadowSpan:VCH_NIGHT.shadowSpan, sunLift:VCH_NIGHT.sunLift,
    refl:(typeof VCH_REFLECT_GAIN === "number") ? VCH_REFLECT_GAIN : 1,
    tm:GRADE.tm, contrast:GRADE.contrast
  };

  const get = k => {
    switch(k){
      case "fogD":     return VCH_NIGHT.fogD;
      case "exposure": return VCH_NIGHT.exposure;
      case "gain":     return VCH_NIGHT.gain;
      case "moonDisk": return VCH_NIGHT.moonDisk;
      case "envGain":  return VCH_NIGHT.envGain;
      case "moonI":    return VCH_NIGHT.moonI;
      case "sunI":     return VCH_NIGHT.sunI;
      case "hemiI":    return VCH_NIGHT.hemiI;
      case "fillI":    return VCH_NIGHT.fillI;
      case "ambI":     return VCH_NIGHT.ambI;
      case "bounceI":  return VCH_NIGHT.bounceI;
      case "mapEnv":   return VCH_NIGHT.mapEnv;
      case "shadowSpan": return VCH_NIGHT.shadowSpan;
      case "sunLift":   return VCH_NIGHT.sunLift;
      case "refl":     return (typeof VCH_REFLECT_GAIN === "number") ? VCH_REFLECT_GAIN : 1;
      case "tm":       return GRADE.tm;
      case "contrast": return GRADE.contrast;
      default:         return VCH_FOG[k];
    }
  };
  const set = (k,v) => {
    switch(k){
      case "fogD":     VCH_NIGHT.fogD = v; break;
      case "exposure": VCH_NIGHT.exposure = v; break;
      case "gain":     VCH_NIGHT.gain = v; break;
      case "moonDisk": VCH_NIGHT.moonDisk = v; break;
      case "envGain":  VCH_NIGHT.envGain = v; break;
      case "moonI":    VCH_NIGHT.moonI = v; break;
      case "sunI":     VCH_NIGHT.sunI = v; break;
      case "hemiI":    VCH_NIGHT.hemiI = v; break;
      case "fillI":    VCH_NIGHT.fillI = v; break;
      case "ambI":     VCH_NIGHT.ambI = v; break;
      case "bounceI":  VCH_NIGHT.bounceI = v; break;
      case "mapEnv":   VCH_NIGHT.mapEnv = v; break;
      case "shadowSpan": VCH_NIGHT.shadowSpan = v; break;
      case "sunLift":   VCH_NIGHT.sunLift = v; break;
      case "refl":     try{ VCH_REFLECT_GAIN = v }catch(e){} break;
      case "tm":       GRADE.tm = v; break;
      case "contrast": GRADE.contrast = v; break;
      default:         VCH_FOG[k] = v;
    }
  };

  /* мягкая перестановка света: без пересборки теней и без PMREM */
  function applyLight(){
    try{ Jn.toneMappingExposure = VCH_NIGHT.exposure }catch(e){}
    /* яркость самой панорамы и диск солнца — uniform'ы купола */
    try{
      const u = VCH_NIGHT_MAT && VCH_NIGHT_MAT.uniforms;
      if(u && u.uGain)   u.uGain.value   = VCH_NIGHT.gain;
      if(u && u.uMoonI)  u.uMoonI.value  = VCH_NIGHT.moonDisk;
    }catch(e){}
    try{ if(cn) cn.environmentIntensity = VCH_NIGHT.envGain }catch(e){}
    try{
      const sun = (typeof vSunLight === "function") ? vSunLight() : null;
      if(sun) sun.intensity = VCH_NIGHT.sunI;
      const hemi = cn.children.find(o=>o.isHemisphereLight);
      if(hemi) hemi.intensity = VCH_NIGHT.hemiI;
      for(const o of cn.children) if(o.isAmbientLight) o.intensity = VCH_NIGHT.ambI;
      let nth = 0;
      for(const o of cn.children){
        if(o.isDirectionalLight && o !== sun){
          o.intensity = (nth++)===0 ? VCH_NIGHT.fillI : VCH_NIGHT.bounceI;
        }
      }
      /* охват тень-камеры меняет и near/far — переставить свет целиком */
      if(typeof VCH_NIGHT_lights === "function") VCH_NIGHT_lights();
      if(typeof VCH_NIGHT_mapEnv === "function") VCH_NIGHT_mapEnv();
    }catch(e){}
    /* Оттенок/насыщенность/контраст/яркость теперь идут и в окружение (task 18),
       поэтому панораму для IBL нужно пересчитать. Собираем не на каждое
       деление ползунка, а по окончании движения — иначе кадр встаёт. */
    scheduleEnv();
    /* блеск брони — пересчитать наборы материалов */
    try{ for(const M of VCH_MATSETS) if(window.__vchLook && window.__vchLook.reflect) window.__vchLook.reflect(M) }catch(e){}
    applyGrade();
  }
  let VCH_ENV_TIMER = 0;
  function scheduleEnv(){
    if(VCH_ENV_TIMER) clearTimeout(VCH_ENV_TIMER);
    VCH_ENV_TIMER = setTimeout(()=>{
      VCH_ENV_TIMER = 0;
      try{ if(typeof VCH_NIGHT_buildEnv === "function") VCH_NIGHT_buildEnv() }catch(e){}
    }, 140);
  }
  function applyGrade(){
    try{
      const u = V_gradePass && V_gradePass.uniforms;
      if(u && u.uTM) u.uTM.value = GRADE.tm;
      if(u && u.uContrast) u.uContrast.value = GRADE.contrast;
    }catch(e){}
  }
  function applyFog(){
    try{
      if(typeof VCH_ALEKS !== "undefined" && VCH_ALEKS.scene3 && VCH_ALEKS.scene3.fog)
        VCH_ALEKS.scene3.fog.density = VCH_NIGHT.fogD;
    }catch(e){}
    try{ VCH_FOG_update() }catch(e){}
  }
  function applyAll(){ applyFog(); applyLight(); }
  function save(){
    try{ const o={v:2}; for(const p of FOG) o[p.k]=get(p.k); for(const p of LIT) o[p.k]=get(p.k);
         localStorage.setItem(KEY_STORE, JSON.stringify(o)) }catch(e){}
  }
  /* сохранённые значения (если игрок уже подбирал картинку в браузере) */
  try{
    const raw = localStorage.getItem(KEY_STORE);
    if(raw){
      const o = JSON.parse(raw);
      for(const p of FOG) if(typeof o[p.k] === "number" && isFinite(o[p.k])) set(p.k, o[p.k]);
      /* task 18: в записях старее v2 лежат hemi/fill, которые полностью
         перебивали свет панорамы. Туман из старой записи берём, а свет —
         новыми значениями (искусственные источники выключены). */
      if(o.v === 2)
        for(const p of LIT) if(typeof o[p.k] === "number" && isFinite(o[p.k])) set(p.k, o[p.k]);
    }
  }catch(e){}

  /* ------------------------------ разметка ------------------------------ */
  const box = document.createElement("div");
  box.id = "fogpanel";
  box.style.cssText = "position:fixed;top:150px;right:22px;width:252px;z-index:70;display:none;"
    + "padding:12px 14px 10px;background:rgba(10,14,18,.76);border:1px solid rgba(255,255,255,.14);"
    + "border-left:2px solid #ff8a22;border-radius:3px;backdrop-filter:blur(8px);"
    + "font-family:Bahnschrift,Roboto Condensed,Arial Narrow,sans-serif;color:#cfd6dc;"
    + "font-size:10.5px;letter-spacing:.05em;text-shadow:none";
  box.innerHTML =
      '<div style="color:#ff8a22;font-weight:700;font-size:11px;letter-spacing:.16em">КАРТИНКА · F</div>'
    + '<div style="color:#8e9aa3;font-size:9.5px;line-height:1.45;margin:4px 0 9px">'
    + 'правка на ходу; из консоли — <b style="color:#cfd6dc">__vchTune.set({envGain:1.0})</b></div>';

  /* вкладки */
  const tabs = document.createElement("div");
  tabs.style.cssText = "display:flex;gap:6px;margin-bottom:10px";
  const pages = [];
  const mkTab = (name) => {
    const b = document.createElement("button");
    b.type = "button"; b.textContent = name;
    b.style.cssText = "flex:1;cursor:pointer;background:#1a1f23;color:#cfd6db;border:1px solid #333c43;"
      + "padding:5px 4px;font-size:10px;letter-spacing:.14em;font-family:inherit";
    b.addEventListener("click", ()=>{
      for(const t of tabs.children){ t.style.background="#1a1f23"; t.style.borderColor="#333c43"; t.style.color="#cfd6db" }
      b.style.background = "#263039"; b.style.borderColor = "#ff8a22"; b.style.color = "#fff";
      pages.forEach((p,i)=>{ p.style.display = (tabs.children[i] === b) ? "block" : "none" });
    });
    tabs.appendChild(b); return b;
  };
  mkTab("ТУМАН"); mkTab("СВЕТ");
  box.appendChild(tabs);
  tabs.children[0].style.background = "#263039";
  tabs.children[0].style.borderColor = "#ff8a22";
  tabs.children[0].style.color = "#fff";

  const rows = [];
  const mkPage = (spec, visible) => {
    const page = document.createElement("div");
    page.style.display = visible ? "block" : "none";
    for(const p of spec){
      const row = document.createElement("div");
      row.style.cssText = "margin-bottom:7px";
      row.innerHTML = '<div style="display:flex;justify-content:space-between;color:#9fb0be;font-size:9.5px;'
        + 'letter-spacing:.08em;margin-bottom:3px"><span>'+p.t+'</span><span style="color:#ffc75a"></span></div>';
      const inp = document.createElement("input");
      inp.type = "range"; inp.min = p.min; inp.max = p.max; inp.step = p.step;
      inp.style.cssText = "width:100%;margin:0;accent-color:#ff8a22;cursor:pointer";
      inp.addEventListener("input", ()=>{
        set(p.k, parseFloat(inp.value));
        row.querySelector("span:last-child").textContent = p.fmt(get(p.k));
        applyAll(); save();
      });
      row.appendChild(inp);
      page.appendChild(row);
      rows.push({p, inp, row});
    }
    box.appendChild(page);
    pages.push(page);
    return page;
  };
  mkPage(FOG, true);
  mkPage(LIT, false);
  /* ---- вкладка 3: посадка ленты Скорпиона на ведущем колесе ---- */
  mkTab("СКОРПИОН");
  mkTab("УПРАВЛЕНИЕ");
  const scPage = document.createElement("div");
  scPage.style.display = "none";
  scPage.innerHTML = '<div style="color:#8e9aa3;font-size:9.5px;line-height:1.45;margin-bottom:9px">'
    + 'посадка ленты на ведущем колесе Скорпиона:<br>'
    + '<b style="color:#cfd6dc">0</b> — по сплошному телу колеса, '
    + '<b style="color:#cfd6dc">1</b> — по кончикам зубьев.<br>'
    + 'Значение хранится в браузере.</div>';
  const scRow = document.createElement("div");
  scRow.style.cssText = "margin-bottom:7px";
  scRow.innerHTML = '<div style="display:flex;justify-content:space-between;color:#9fb0be;font-size:9.5px;'
    + 'letter-spacing:.08em;margin-bottom:3px"><span>ПОСАДКА</span><span style="color:#ffc75a"></span></div>';
  const scInp = document.createElement("input");
  scInp.type = "range"; scInp.min = 0; scInp.max = 1; scInp.step = 0.01;
  scInp.style.cssText = "width:100%;margin:0;accent-color:#ff8a22;cursor:pointer";
  scInp.value = (window.__scorpCfg && typeof window.__scorpCfg.gearSeat === "number")
    ? window.__scorpCfg.gearSeat : 0.45;
  scRow.querySelector("span:last-child").textContent = (+scInp.value).toFixed(2);
  scInp.addEventListener("input", ()=>{
    const v = parseFloat(scInp.value);
    for(const R of (window.__vchScRigs||[])) R.seat(v);
    if(window.__scorpCfg) window.__scorpCfg.gearSeat = v;
    scRow.querySelector("span:last-child").textContent = v.toFixed(2);
  });
  scRow.appendChild(scInp);
  scPage.appendChild(scRow);
  /* ---- тот же таб: сглаживание («шейд смуз») катков Скорпиона ---- */
  scPage.insertAdjacentHTML("beforeend",
      '<div style="color:#8e9aa3;font-size:9.5px;line-height:1.45;margin:11px 0 9px">'
    + 'сглаживание нормалей катков и кронштейнов Скорпиона:<br>'
    + '<b style="color:#cfd6dc">0</b> — как в модели (грани), '
    + '<b style="color:#cfd6dc">45…90</b> — мягче. Грани, повёрнутые друг к другу '
    + 'круче этого угла, острыми и остаются.</div>');
  const smRow = document.createElement("div");
  smRow.style.cssText = "margin-bottom:7px";
  smRow.innerHTML = '<div style="display:flex;justify-content:space-between;color:#9fb0be;font-size:9.5px;'
    + 'letter-spacing:.08em;margin-bottom:3px"><span>СГЛАЖИВАНИЕ</span><span style="color:#ffc75a"></span></div>';
  const smInp = document.createElement("input");
  smInp.type = "range"; smInp.min = 0; smInp.max = 90; smInp.step = 1;
  smInp.style.cssText = "width:100%;margin:0;accent-color:#ff8a22;cursor:pointer";
  let smVal = 62;
  try{ const sv = localStorage.getItem("vch.scSmooth");
       if(sv != null && isFinite(+sv)) smVal = +sv }catch(e){}
  smInp.value = smVal;
  smRow.querySelector("span:last-child").textContent = smVal.toFixed(0) + "°";
  smInp.addEventListener("input", ()=>{
    const v = parseFloat(smInp.value);
    for(const R of (window.__vchScRigs||[])) if(R.smooth) R.smooth(v);
    smRow.querySelector("span:last-child").textContent = v.toFixed(0) + "°";
  });
  smRow.appendChild(smInp);
  scPage.appendChild(smRow);
  /* ---- тот же таб: фаска (bevel) по всей модели Скорпиона ---- */
  scPage.insertAdjacentHTML("beforeend",
      '<div style="color:#8e9aa3;font-size:9.5px;line-height:1.45;margin:11px 0 9px">'
    + 'фаска по всей модели Скорпиона (кроме катков — у них своё '
    + 'сглаживание):<br>'
    + '<b style="color:#cfd6dc">0</b> — рёбра модели как есть, '
    + '<b style="color:#cfd6dc">5</b> — рабочая фаска, '
    + '<b style="color:#cfd6dc">10+</b> — сглаживание съедает сетку («мыло»). '
    + 'Считается по нормалям, силуэт не меняется.</div>');
  const bvRow = document.createElement("div");
  bvRow.style.cssText = "margin-bottom:7px";
  bvRow.innerHTML = '<div style="display:flex;justify-content:space-between;color:#9fb0be;font-size:9.5px;'
    + 'letter-spacing:.08em;margin-bottom:3px"><span>ФАСКА,°</span><span style="color:#ffc75a"></span></div>';
  const bvInp = document.createElement("input");
  bvInp.type = "range"; bvInp.min = 0; bvInp.max = 30; bvInp.step = 1;
  bvInp.style.cssText = "width:100%;margin:0;accent-color:#ff8a22;cursor:pointer";
  let bvVal = 5;
  try{ const sv = localStorage.getItem("vch.scBevel");
       if(sv != null && isFinite(+sv)) bvVal = +sv }catch(e){}
  bvInp.value = bvVal;
  bvRow.querySelector("span:last-child").textContent = bvVal.toFixed(0);
  bvInp.addEventListener("input", ()=>{
    const v = parseFloat(bvInp.value);
    for(const R of (window.__vchScRigs||[])) if(R.bevel) R.bevel(v);
    bvRow.querySelector("span:last-child").textContent = v.toFixed(0);
  });
  bvRow.appendChild(bvInp);
  scPage.appendChild(bvRow);
  box.appendChild(scPage); pages.push(scPage);

  /* ---- вкладка 4: привод башни (наведение мышью) ------------------------ */
  const ctlPage = document.createElement("div");
  ctlPage.style.display = "none";
  ctlPage.innerHTML = '<div style="color:#8e9aa3;font-size:9.5px;line-height:1.45;margin-bottom:9px">'
    + 'привод башни Скорпиона. Скорость — максимальная, плавность — как быстро '
    + 'привод набирает и сбрасывает её, отрыв — на сколько прицел может '
    + 'уехать от ствола: дальше этого угла «лишний» ввод плавно стравливается, '
    + 'чтобы башня не тащилась за прицелом секунды. Режим переключается '
    + 'клавишей T.</div>';
  const CTL = [
    {k:"sensX",  t:"Чувств. горизонт.", min:.3, max:2.5, step:.05, fmt:v=>v.toFixed(2)},
    {k:"sensY",  t:"Чувств. вертикаль", min:.3, max:2.5, step:.05, fmt:v=>v.toFixed(2)},
    {k:"rateY",  t:"Скорость башни,°/с", min:.3, max:2.2, step:.05, fmt:v=>(v*57.3).toFixed(0)},
    {k:"rateX",  t:"Скорость ствола,°/с", min:.15,max:1.2, step:.05, fmt:v=>(v*57.3).toFixed(0)},
    {k:"accY",   t:"Плавность",         min:1,   max:16,  step:.5,  fmt:v=>v.toFixed(1)},
    {k:"maxLag", t:"Отрыв прицела,°",   min:0,   max:.6,  step:.02, fmt:v=>(v*57.3).toFixed(0)}
  ];
  const ctlRefs=[];
  for(const c of CTL){
    const row=document.createElement("div");
    row.style.cssText="margin-bottom:7px";
    row.innerHTML='<div style="display:flex;justify-content:space-between;color:#9fb0be;font-size:9.5px;'
      +'letter-spacing:.08em;margin-bottom:3px"><span>'+c.t+'</span><span style="color:#ffc75a"></span></div>';
    const inp=document.createElement("input");
    inp.type="range"; inp.min=c.min; inp.max=c.max; inp.step=c.step;
    inp.style.cssText="width:100%;margin:0;accent-color:#ff8a22;cursor:pointer";
    inp.value=(typeof VCH_AIM!=="undefined"&&VCH_AIM[c.k]!=null)?VCH_AIM[c.k]:c.min;
    row.querySelector("span:last-child").textContent=c.fmt(+inp.value);
    inp.addEventListener("input",()=>{
      const v=parseFloat(inp.value);
      if(typeof VCH_AIM!=="undefined"){ VCH_AIM[c.k]=v; VCH_AIM.save&&VCH_AIM.save() }
      if(c.k==="accY"&&typeof VCH_AIM!=="undefined") VCH_AIM.accX=Math.max(1,v*.58);
      row.querySelector("span:last-child").textContent=c.fmt(v);
    });
    row.appendChild(inp); ctlPage.appendChild(row);
    ctlRefs.push({c,row,inp});
  }
  /* переключатель режима наведения (клавиша T) */
  const amRow=document.createElement("div");
  amRow.style.cssText="margin:9px 0 7px";
  amRow.innerHTML='<div style="display:flex;justify-content:space-between;color:#9fb0be;font-size:9.5px;'
    +'letter-spacing:.08em;margin-bottom:4px"><span>РЕЖИМ НАВЕДЕНИЯ</span></div>';
  const amBtn=document.createElement("button");
  amBtn.type="button";
  amBtn.style.cssText="width:100%;cursor:pointer;background:#1a1f23;color:#cfd6db;border:1px solid #333c43;"
    +"padding:6px 4px;font-size:10px;letter-spacing:.12em;font-family:inherit";
  const amLabel=()=>{
    const m=(typeof J!=="undefined")?J.aimMode:"cursor";
    amBtn.textContent=m==="cursor"?"КУРСОР → МЫШЬ (ЗАХВАТ)":"МЫШЬ (ЗАХВАТ) → КУРСОР";
  };
  amLabel();
  amBtn.addEventListener("click",()=>{
    if(typeof vchAimModeSet==="function"){
      vchAimModeSet((typeof J!=="undefined"&&J.aimMode==="cursor")?"mouse":"cursor");
      amLabel();
    }
  });
  amRow.appendChild(amBtn); ctlPage.appendChild(amRow);
  /* возврат привода к заводским значениям */
  const rsRow=document.createElement("div");
  rsRow.style.cssText="margin:4px 0 2px";
  const rsBtn=document.createElement("button");
  rsBtn.type="button";
  rsBtn.textContent="СБРОС ПРИВОДА";
  rsBtn.style.cssText="width:100%;cursor:pointer;background:#1a1f23;color:#cfd6db;border:1px solid #333c43;"
    +"padding:6px 4px;font-size:10px;letter-spacing:.12em;font-family:inherit";
  rsBtn.addEventListener("click",()=>{
    const D={sensX:1,sensY:1,expo:.6,rateY:.95,rateX:.50,accY:6,accX:3.5,kP:7,maxLag:.18,pullTau:.8,cursorTau:.07};
    if(typeof VCH_AIM==="undefined")return;
    for(const k in D)VCH_AIM[k]=D[k];
    VCH_AIM.save&&VCH_AIM.save();
    for(const r of ctlRefs){ r.inp.value=VCH_AIM[r.c.k];
      r.row.querySelector("span:last-child").textContent=r.c.fmt(VCH_AIM[r.c.k]) }
  });
  rsRow.appendChild(rsBtn); ctlPage.appendChild(rsRow);
  box.appendChild(ctlPage); pages.push(ctlPage);

  function sync(){
    for(const r of rows){
      r.inp.value = get(r.p.k);
      r.row.querySelector("span:last-child").textContent = r.p.fmt(get(r.p.k));
    }
  }

  /* кнопки */
  const btns = document.createElement("div");
  btns.style.cssText = "display:flex;gap:6px;margin-top:10px";
  const mk = (t, fn) => {
    const b = document.createElement("button");
    b.textContent = t; b.type = "button";
    b.style.cssText = "flex:1;cursor:pointer;background:#1a1f23;color:#cfd6db;border:1px solid #333c43;"
      + "padding:5px 4px;font-size:10px;letter-spacing:.08em;font-family:inherit";
    b.onmouseenter = ()=>{ b.style.background="#263039"; b.style.borderColor="#ff8a22"; b.style.color="#fff" };
    b.onmouseleave = ()=>{ b.style.background="#1a1f23"; b.style.borderColor="#333c43"; b.style.color="#cfd6db" };
    b.addEventListener("click", fn);
    btns.appendChild(b); return b;
  };
  mk("СБРОС", ()=>{ for(const k in DEF) set(k, DEF[k]); sync(); applyAll(); save(); });
  mk("ТЕМНЕЕ", ()=>{
    set("exposure", Math.max(0.40, get("exposure")*0.94));
    set("envGain",  Math.max(0,    get("envGain")*0.85));
    set("refl",     Math.max(0.10, get("refl")*0.85));
    sync(); applyAll(); save();
  });
  mk("ЛЕГЧЕ ТУМАН", ()=>{
    set("base", Math.max(0, get("base")*0.6));
    set("mist", Math.max(0, get("mist")*0.6));
    set("fogD", Math.max(0, get("fogD")*0.6));
    sync(); applyAll(); save();
  });
  box.appendChild(btns);
  document.body.appendChild(box);
  sync(); applyAll();
  /* грейдинг мог быть пересоздан сменой качества — подклеиваем раз в секунду */
  setInterval(applyGrade, 1000);

  window.addEventListener("keydown", e=>{
    if(e.code !== "KeyF" || e.repeat) return;
    const t = e.target;
    if(t && /^(INPUT|SELECT|TEXTAREA)$/.test(t.tagName||"")) return;
    e.preventDefault();
    box.style.display = (box.style.display === "none") ? "block" : "none";
  }, true);

  try{
    const help = document.getElementById("help");
    if(help && help.innerHTML.indexOf("КАРТИНКА") < 0)
      help.innerHTML += '<br /><b>F</b> — панель «туман / свет»';
  }catch(e){}

  const all = () => { const o={}; for(const p of FOG) o[p.k]=get(p.k); for(const p of LIT) o[p.k]=get(p.k); return o };
  window.__vchTune = {
    cfg:VCH_FOG, night:VCH_NIGHT, grade:GRADE, defaults:DEF,
    get:all,
    set:(o)=>{ for(const k in (o||{})) if(typeof o[k]==="number") set(k,o[k]); sync(); applyAll(); save(); return all() },
    reset:()=>{ for(const k in DEF) set(k,DEF[k]); sync(); applyAll(); save(); return all() },
    fogOff:()=>window.__vchTune.set({base:0,mist:0,fogD:0}),
    show:()=>{ box.style.display="block" }, hide:()=>{ box.style.display="none" }
  };
  /* старое имя оставлено, чтобы не ломать привычки */
  window.__vchFog = window.__vchTune;
  console.log("[sunrise] туман: base "+VCH_FOG.base+", mist "+VCH_FOG.mist+", fogD "+VCH_NIGHT.fogD
    + " | свет: экспозиция "+VCH_NIGHT.exposure+", окружение "+VCH_NIGHT.envGain
    + ", солнце "+VCH_NIGHT.sunI+", блеск брони "+get("refl")
    + " (панель — клавиша F, API — __vchTune)");
})();
