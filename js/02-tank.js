/* ==========================================================================
   vch36 · js/02-tank.js
   модель ОБТ-36: корпус, башня, орудие, ходовая
   Из index.html (4.2 «разбиение на модули»). Порядок загрузки задан в index.html
   тегами <script defer>; «use strict» сохранён — исходный код был модулем.
   ========================================================================== */
"use strict";


/* ================= ЛИВРЕЯ / ОКРАСКА ========================================
   Референс: янтарно-жёлтые бронеплиты + графитовый силовой набор, красные
   торцы ракет. Палитра задаёт цвета базовых материалов Nw(); один и тот же
   набор материалов носят и ОБТ «36», и Scorpion, поэтому ливрея меняется
   целиком — клавишей L (см. vchLiveryCycle ниже).                          */
const VCH_LIVERY={
  amber:{ label:"ЯНТАРЬ / ГРАФИТ",          /* по референсу — по умолчанию */
    paint:0xd8a01c, paintLight:0xf2c94f, paintDark:0x3c434d, sleeve:0xce9a1e,
    paintWorn:0xcfa445, wheelHub:0x474e58, rubber:0x1c1e21, track:0x9aa0a8,
    steel:0x9aa1a9, steelDark:0x3f454e, capRed:0xb2332c },
  khaki:{ label:"ХАКИ (заводская)",
    paint:0x7c815b, paintLight:0x939969, paintDark:0x565b3d, sleeve:0x828759,
    paintWorn:0xa29d77, wheelHub:0x71764e, rubber:0x24241f, track:0xbdbeB6,
    steel:0x8d8e88, steelDark:0x3d3e39, capRed:0x8d2a26 }
};
const VCH_LIVERY_KEYS=["amber","khaki"];
let VCH_LIVERY_ON="amber";
const VCH_MATSETS=[];                     /* все созданные наборы материалов */
const VCH_LIVERY_SLOTS=["paint","paintLight","paintDark","sleeve","paintWorn",
                        "wheelHub","rubber","track","steel","steelDark","capRed"];
function vchLiverySpec(){return VCH_LIVERY[VCH_LIVERY_ON]||VCH_LIVERY.amber}
function vchLiveryApply(){
  const P=vchLiverySpec();
  for(const M of VCH_MATSETS){
    for(const k of VCH_LIVERY_SLOTS){
      const m=M[k];
      if(m&&m.color&&P[k]!==undefined)m.color.setHex(P[k]);
    }
  }
}
function vchLiveryCycle(){
  const i=VCH_LIVERY_KEYS.indexOf(VCH_LIVERY_ON);
  VCH_LIVERY_ON=VCH_LIVERY_KEYS[(i+1)%VCH_LIVERY_KEYS.length];
  vchLiveryApply();
  try{localStorage.setItem("vch36.livery",VCH_LIVERY_ON)}catch(e){}
  const b=document.getElementById("liverybadge");
  if(b){b.textContent="ОКРАСКА: "+vchLiverySpec().label;b.classList.remove("flash");
        void b.offsetWidth;b.classList.add("flash")}
  return vchLiverySpec().label;
}
window.__vchLivery={cycle:vchLiveryCycle,apply:vchLiveryApply,
                    get:()=>vchLiverySpec().label,set:k=>{if(VCH_LIVERY[k]){VCH_LIVERY_ON=k;vchLiveryApply();vchLiveryApply();}}};

function Nw(){
  const L=vchLiverySpec();
  const r=da({base:"#8f9270",grime:.6}),t=da({base:"#7c7f60",grime:1}),
        tk=VCH_trackTex();   // матовый обветренный металл траков
  const M={
    paint:new fe({color:L.paint,map:r,metalness:.18,roughness:.74,envMapIntensity:.45}),
    paintLight:new fe({color:L.paintLight,map:r,metalness:.16,roughness:.7,envMapIntensity:.5}),
    paintDark:new fe({color:L.paintDark,map:t,metalness:.3,roughness:.78,envMapIntensity:.35}),
    rubber:new fe({color:L.rubber,metalness:.04,roughness:.95}),
    track:new fe({color:L.track,map:tk,metalness:.24,roughness:.95,
                  bumpMap:tk,bumpScale:.018,flatShading:!0,envMapIntensity:.10}),
    sleeve:new fe({color:L.sleeve,map:r,metalness:.24,roughness:.66,envMapIntensity:.4}),
    steel:new fe({color:L.steel,metalness:.86,roughness:.36}),
    steelDark:new fe({color:L.steelDark,metalness:.74,roughness:.52}),
    /* красные торцы ракет (у Скорпиона это отдельный материал Rocket Cap) */
    capRed:new fe({color:L.capRed,metalness:.34,roughness:.44,envMapIntensity:.7}),
    darkHole:new fe({color:0x121211,metalness:.2,roughness:1}),
    optic:new fe({color:0x101f26,metalness:1,roughness:.08,emissive:0x0d3038,emissiveIntensity:1.2}),
    lampAmber:new fe({color:0xffe4a8,emissive:0xffc164,emissiveIntensity:1.15,roughness:.3,metalness:.2}),
    lampRed:new fe({color:0xff7a3c,emissive:0xe2540f,emissiveIntensity:2.4,roughness:.4}),
    canvas:new fe({color:0x8d7a58,map:t,metalness:.02,roughness:.98}),
    rust:new fe({color:0xa45f45,metalness:.25,roughness:.9}),
    mud:new fe({color:0x5b4a36,metalness:.02,roughness:1}),
    paintWorn:new fe({color:L.paintWorn,map:t,metalness:.14,roughness:.86,envMapIntensity:.3}),
    wheelHub:new fe({color:L.wheelHub,map:t,metalness:.44,roughness:.62}),
    stowage:new fe({color:0x9c7d55,map:t,metalness:.08,roughness:.92}),
    stowageDark:new fe({color:0x69513e,map:t,metalness:.1,roughness:.9})
  };
  if(VCH_MATSETS.indexOf(M)<0){VCH_MATSETS.push(M);while(VCH_MATSETS.length>8)VCH_MATSETS.shift()}
  vchLiveryApply();
  return typeof vApplySurf==="function"?vApplySurf(M):M
}

function ve(r,t,e=0,n=0,i=0,s){Of(r,e,n,i,1.25);const o=new Lt(r,t);return o.position.set(e,n,i),o.castShadow=!0,o.receiveShadow=!0,s&&s.add(o),o}function te(r,t,e,n,i,s,o,a=.055,c){const l=Math.max(.008,Math.min(a*1.15,Math.min(r,t,e)*.42));return ve(Bf(r,t,e,l),n,i,s,o,c)}function $t(r,t,e,n,i,s,o,a){return te(r,t,e,n,i,s,o,.020,a)}function In(r,t,e,n,i,s,o=16,a){const c=new mn(r,r,t,o,1);return c.rotateX(Math.PI/2),ve(c,e,n,i,s,a)}function Bo(r,t,e,n,i,s,o=16,a){const c=new mn(r,r,t,o,1);return c.rotateZ(Math.PI/2),ve(c,e,n,i,s,a)}function Gn(r,t,e,n,i,s,o=16,a){const c=new mn(r,r,t,o,1);return ve(c,e,n,i,s,a)}function qi(r,t,e,n,i=!0){Of(r,0,0,0,1.25);const s=new xa(r,t,e.length),o=new ue;for(let a=0;a<e.length;a++){const c=e[a];o.position.set(c.p[0],c.p[1],c.p[2]),o.rotation.set(c.r?c.r[0]:0,c.r?c.r[1]:0,c.r?c.r[2]:0),o.scale.setScalar(c.s||1),o.updateMatrix(),s.setMatrixAt(a,o.matrix)}return s.castShadow=i,s.receiveShadow=!0,s.instanceMatrix.needsUpdate=!0,n.add(s),s}function Dw(r){let t=0;for(const l of r)t+=l.attributes.position.count;const e=new Float32Array(t*3),n=new Float32Array(t*3);let i=0,s=0,o=0;const a=[];for(const l of r){const h=l.attributes.position,d=l.attributes.normal;if(e.set(h.array,i),i+=h.array.length,n.set(d.array,s),s+=d.array.length,l.index)for(let u=0;u<l.index.count;u++)a.push(l.index.array[u]+o);else for(let u=0;u<h.count;u++)a.push(u+o);o+=h.count}const c=new Pe;return c.setAttribute("position",new Ve(e,3)),c.setAttribute("normal",new Ve(n,3)),c.setIndex(a),c}

function refMark(r=256){
  const t=Qs(r),e=t.getContext("2d");
  e.clearRect(0,0,r,r);
  e.strokeStyle="#eceade",e.lineWidth=r*.085,e.lineJoin="round",e.lineCap="round";
  e.beginPath(),e.moveTo(r*.5,r*.18),e.lineTo(r*.85,r*.80),e.lineTo(r*.15,r*.80),e.closePath(),e.stroke();
  e.globalCompositeOperation="destination-out";
  for(let n=0;n<70;n++)e.fillRect(Vt(0,r),Vt(0,r),Vt(1,5),Vt(1,3));
  const n=new Ks(t);return n.colorSpace=Ie,n.anisotropy=8,n
}

function Uw(r){
 /* =====================================================================
    ТРАК — одна широкая стальная плита на звено, почти на весь шаг гусеницы,
    с кованым грунтозацепом на опорной стороне и проушинами шарнира, утоплен-
    ными в стык.  Местная система: X — поперёк трака (метры, вся ширина r),
    Y — наружная нормаль (от катков), Z — вдоль трака в долях шага (инстансер
    растягивает Z до реального шага, поэтому все числа по Z — доли шага).
    Прежнее звено было коротким толстым блоком с обжатием .93 и четырьмя
    угловыми лапами: 51 такое звено в ленте читались как ряд кирпичей.
    Теперь полотно непрерывное, а повторяется только шов шарнира, боковой
    выступ и грунтозацеп — то, что и видно на настоящей гусенице.
    ===================================================================== */
 const W=r/2,pitch=Kt.trackPitch,parts=[],
       RB=(w,h,d,rad,x,y,z)=>{const g=VCH_roundBox(w,h,d,rad);g.translate(x,y,z);return g},
       BOLT=(x,z)=>{const c=new mn(.014,.014,.010,6,1);c.translate(x,.020,z);rh(c);parts.push(c)};
 /*
  Тяжёлая штампованная плита: на всю ширину, но чуть короче шага, чтобы тонкий
  шов шарнира оставался виден и траки не слипались в один монолит.
 */
 parts.push(RB(r-.008,.050,.992,.014,0,-.006,0));
 /* вальцованные боковые кромки — рёбра жёсткости трака */
 for(const sx of[-1,1])parts.push(RB(.032,.030,.978,.009,sx*(W-.019),.010,0));
 /* кованый грунтозацеп на опорной стороне: тот самый выступ, который цепляется */
 parts.push(RB(r-.004,.060,.330,.014,0,.048,0));
 /* два низких ребра сцепления спереди и сзади от грунтозацепа (трак в стиле Т-72) */
 for(const sz of[-1,1])parts.push(RB(r-.150,.020,.100,.007,0,.028,sz*.350));
 /*
  проушины шарнира: одна центральная спереди и пара боковых сзади. Они стоят
  заподлицо с плитой и перекрывают шов, поэтому стык читается как шарнир, а не
  как щель и не как поленница блоков.
 */
 parts.push(RB(.170,.056,.190,.018,0,-.004,.436));
 for(const sx of[-1,1])parts.push(RB(.110,.056,.190,.018,sx*(W-.058),-.004,-.436));
 /*
  соединители: стальные накладки, прижимающие палец по внешнему краю. Держим
  заподлицо с плоскостями трака — выступают ровно настолько, чтобы рвать силуэт,
  но не читаться как шипы.
 */
 for(const sx of[-1,1])for(const sz of[-1,1])
  parts.push(RB(.028,.040,.080,.009,sx*(W-.014),-.001,sz*.462));
 /* шестигранные болты трака на опорной стороне */
 for(const sx of[-1,1])for(const sz of[-1,1])BOLT(sx*.170,sz*.170);
 const g=Dw(parts);
 /*
  плоские UV, у которых ось Z переведена в метры: карта изношенной стали
  сохраняет одинаковую плотность текселей вдоль и поперёк трака (прежняя карта
  была растянута примерно в 5 раз вдоль звеньев, из-за чего плита смазывалась в
  однородный брусок)
 */
 {const pos=g.attributes.position,nor=g.attributes.normal,
        uv=new Float32Array(pos.count*2),d=.22;
  for(let i=0;i<pos.count;i++){
   const x=pos.getX(i),y=pos.getY(i),z=pos.getZ(i)*pitch,
         ax=Math.abs(nor.getX(i)),ay=Math.abs(nor.getY(i)),az=Math.abs(nor.getZ(i));
   let u,v;
   if(ax>=ay&&ax>=az){u=z;v=y}else if(ay>=ax&&ay>=az){u=x;v=z}else{u=x;v=y}
   uv[i*2]=u/d;uv[i*2+1]=v/d}
  g.setAttribute("uv",new Ve(uv,2));}
 g.computeVertexNormals();
 return g
}

function Fw(r){
  const t=Kt.wheelRadius,
    /*
  закрытая шина: последняя точка повторяет первую, поэтому лате-профиль замыкается в
  настоящее кольцо со своей посадкой (раньше это была открытая полоса, то есть
  оболочка толщиной в бумагу)
 */
    e=ze([[t-.06,.150],[t-.014,.136],[t,.104],[t,-.104],[t-.014,-.136],[t-.06,-.150],[t-.06,.150]],30,"x"),
    /*
  плоскость диска: обод доходит до x=±.144 (вся ширина посадки шины), поэтому диск
  закрывает кольцевой зазор, а не оставляет щель и просвет внутри обода
 */
    n=ze(VCH_seal([[.09,.150],[.19,.147],[.28,.144],[t-.055,.144],[t-.055,.030],[t-.11,.014],[.30,.030],[.19,.078],[.09,.084]]),30,"x"),
    i=ze(VCH_seal([[.03,.205],[.10,.202],[.14,.178],[.145,.13],[.145,.10],[.03,.10]]),22,"x"),
    s=new mn(.022,.022,.05,6,1);s.rotateZ(Math.PI/2);
  return(o,a,c,l)=>{
    const h=new Jt;h.position.set(a,c,l),
    h.add(new Lt(e,r.rubber)),h.add(new Lt(n,r.paint)),h.add(new Lt(i,r.wheelHub));
    /*
  Зеркалим поворотом на 180° вокруг Y, а НЕ через scale.x=-1: отрицательный масштаб
  переворачивает обход треугольников, из-за чего внутренний диск отсекался как обратная
  сторона и сквозь шину просвечивало нутро («спицы» с другой стороны). Детали колеса —
  тела вращения вокруг X, поэтому поворот даёт точное зеркало.
 */
    const d=new Lt(n,r.paint);d.rotation.y=Math.PI,h.add(d);

    const u=new Lt(i,r.wheelHub);u.rotation.y=Math.PI,h.add(u);
    for(let f=0;f<8;f++){
      const m=f/8*oh,p=new Lt(s,r.steelDark);
      p.position.set(.152,Math.sin(m)*.225,Math.cos(m)*.225),h.add(p);
      const g=new Lt(s,r.steelDark);g.position.set(-.152,Math.sin(m)*.225,Math.cos(m)*.225),h.add(g)
    }
    return h.traverse(f=>{f.isMesh&&(f.castShadow=!0,f.receiveShadow=!0)}),o.add(h),h
  }
}

/* ведущее колесо — ПЕРЕДНЯЯ часть танка (станция ленивца в Kt, z > 0) */
function Ow(r,t,e,n,i){
  const s=new Jt;s.position.set(e,n,i);
  const o=Kt.idler.r;
  s.add(new Lt(ze(VCH_seal([[.07,.15],[.21,.142],[o-.11,.118],[o-.085,.078],[o-.085,-.078],[o-.11,-.118],[.21,-.142],[.07,-.15]]),26,"x"),r.steelDark));
  s.add(new Lt(ze(VCH_seal([[.03,.19],[.12,.186],[.165,.156],[.165,.10],[.03,.10]]),20,"x"),r.wheelHub));
  // Шаг зубьев должен совпадать с шагом трака: петля сэмплируется через
  // total/linkCount метров, поэтому за полный оборот этого колеса проходит
  // 2*pi*r / trackPitch зубьев (~14). 15 зубьев перекрывались и уходили из фазы
  // с траками.
  const teeth=Math.max(6,Math.round(2*Math.PI*o/Kt.trackPitch));
  const a=[];
  // R_x(h) переводит локальный +Z в (0,-sin h,cos h): ЗЕРКАЛЬНОЕ отражение радиуса
  // (0,sin h,cos h). Поэтому +h скручивает каждый зуб на 2h, и они сидят криво
  // вокруг звёздочки. -h оставляет +Z радиальным, а +Y тангенциальным.
  for(let l=0;l<teeth;l++){const h=l/teeth*oh;a.push({p:[0,Math.sin(h)*(o-.062),Math.cos(h)*(o-.062)],r:[-h,0,0]})}
  qi(Bf(.20,.124,.10,.02,1),r.steelDark,a,s,!0);
  const c=[];
  for(let l=0;l<6;l++){const h=l/6*oh;c.push({p:[.105,Math.sin(h)*.215,Math.cos(h)*.215],r:[-h,0,0]})}
  qi(VCH_roundBox(.05,.11,.14,.012),r.paintDark,c,s,!1);
  return s.traverse(l=>{l.isMesh&&(l.castShadow=!0,l.receiveShadow=!0)}),t.add(s),s
}

/* ленивец со спицами — ЗАДНЯЯ часть танка (станция ведущего колеса в Kt, z < 0) */
function zw(r,t,e,n,i){
  const s=new Jt;s.position.set(e,n,i);
  const o=Kt.sprocket.r;
  /* Обод ведущего колеса красится в цвет корпуса, как диск опорного катка:
     раньше здесь был steelDark, из-за чего ведущие читались тёмно-графитовыми
     пятнами на фоне янтарных (или хаки) опорных катков. Резины на ведущем
     нет — оно зубчатое, стальное, поэтому шины здесь не предусмотрено. */
  s.add(new Lt(ze(VCH_seal([[o-.095,.145],[o-.02,.13],[o,.094],[o,-.094],[o-.02,-.13],[o-.095,-.145]]),26,"x"),r.paint));
  s.add(new Lt(ze(VCH_seal([[.055,.16],[.15,.155],[.195,.124],[.195,.06],[.055,.06]]),20,"x"),r.wheelHub));
  const a=[];
  for(let l=0;l<6;l++){const h=l/6*oh+.2;a.push({p:[0,Math.sin(h)*(o*.55),Math.cos(h)*(o*.55)],r:[-h,0,0]})}
  qi(Bf(.19,.105,o*.86,.02,1),r.paint,a,s,!0);
  const c=[];
  for(let l=0;l<8;l++){const h=l/8*oh;c.push({p:[.145,Math.sin(h)*.135,Math.cos(h)*.135],r:[-h,0,0]})}
  qi(new mn(.018,.018,.04,6,1).rotateZ(Math.PI/2),r.steelDark,c,s,!1);
  return s.traverse(l=>{l.isMesh&&(l.castShadow=!0,l.receiveShadow=!0)}),t.add(s),s
}

function flat(g){const h=g.toNonIndexed();return h.computeVertexNormals(),h}

/* ===== Торсионная подвеска «как у референса» ===============================
   Каждый каток привязан к неподвижному кронштейну борта качающимся рычагом и
   ребристым пружинно-демпферным элементом. Все звенья пересобираются каждый
   кадр по ходу подвески, поэтому катки именно «висят» на корпусе, а не плывут
   сами по себе. Торсион и его подшипниковые узлы — статика корпуса. */
const VCH_SUS_RATE=24,VCH_SUS_MAXV=2.6;
/*
  диапазон скоростей (м/с) для передачи «качения» в полёт: ниже LO корпус
  качается через гребень, выше HI — улетает с него. Это примерно от 8 до 24 км/ч
 */
const VCH_EDGE_LO=2.2,VCH_EDGE_HI=6.6;
/* какая доля остаточного углового хода по дифференту и крену сохраняется в свободном полёте */
const VCH_AIR_HOLD=.12;
/*
  насколько сильно нос догоняет угол траектории в свободном полёте (0 — висит
  замороженным, 1 — полностью совпадает с вектором скорости)
 */
const VCH_AIR_ALIGN=.45;
/* за сколько секунд нос выходит на дугу после отрыва */
const VCH_AIR_TAU=.28;
/*
  ---- УДАР ПРИ ПРИЗЕМЛЕНИИ ----------------------------------------------
  65-тонный корпус, приходящий на 5 м/с, должен ОЩУЩАТЬСЯ: траки впиваются,
  подвеска гасит удар примерно за 0.1 с, корпус садится, нос продолжает
  проворачиваться через передние катки, и только потом пружины выбрасывают
  машину назад. Эти числа управляют отдельным визуальным каналом удара, никак не
  связанным с пружинами отката, поэтому поведение орудия остаётся ровно таким,
  как настроено.
 */
const VCH_LAND_TAU=.24,      /* с: возврат из полётной позы к опорной плоскости */
      VCH_LAND_KICK=.90,     /* рад/с продолжения «клювом» на каждый м/с удара */
      VCH_LAND_KICK_MAX=4.0,
      VCH_LAND_SQUASH=1.5,   /* м/с видимой просадки на каждый м/с удара */
      VCH_LAND_SQUASH_MAX=3.2,
      VCH_LAND_NOSE=.90,     /* рад/с видимого клевка носом на каждый м/с удара */
      VCH_LAND_NOSE_MAX=1.8,
      VCH_LAND_NOD=.10,      /* рад/с в пружину дифферента отката на каждый м/с удара */
      VCH_LAND_NOD_MAX=.8,
      VCH_IMPACT_KY=200,VCH_IMPACT_DY=15,VCH_IMPACT_YMAX=.075,   /* squat spring  */
      VCH_IMPACT_KP=190,VCH_IMPACT_DP=15,VCH_IMPACT_PMAX=.070;   /* nose spring */
/*
  насколько резко катки могут повторять рельеф сразу после приземления: 1 —
  обычная скорость перекладки, >1 — подвеска заметно «щёлкает» вверх
 */
let VCH_susK=1;
const VCH_lup=new P(0,1,0),VCH_la=new P,VCH_lb=new P,VCH_ld=new P,
      VCH_ln=new P,VCH_lq=new gn;
function VCH_setLink(m,a,b,w){
 VCH_ld.subVectors(b,a);
 const len=Math.max(.06,VCH_ld.length());
 VCH_ln.copy(VCH_ld).divideScalar(len);
 m.position.set((a.x+b.x)*.5,(a.y+b.y)*.5,(a.z+b.z)*.5);
 VCH_lq.setFromUnitVectors(VCH_lup,VCH_ln);
 m.quaternion.copy(VCH_lq);
 m.scale.set(w,len,w);
}

/*
  та же спираль, но замкнутая: вершина → основание → снова вершина, чтобы труба
  получила торцы (у открытой спирали просвечивала щель между витками).
 */
/*
  Два помощника против «просвечивающих» оболочек. Лате-профиль, у которого сечение не
  заканчивается на оси, превращается в открытую трубу: через дырку в середине видно
  фон. VCH_seal закрывает такое сечение плоскими торцами, VCH_sealLoop замыкает
  сечение, которое должно оставаться кольцом (аннулусом), и оно становится сплошной
  шайбой.
 */
function VCH_seal(pts,front=true,back=true){
 const out=[];if(back)out.push([0.0008,pts[0][1]]);
 for(const p of pts)out.push(p);
 if(front)out.push([0.0008,pts[pts.length-1][1]]);
 return out}
function VCH_sealLoop(pts){const out=pts.slice();out.push(pts[0]);return out}
function VCH_springClosedGeom(){
 const p=[],N=11;
 for(let i=0;i<=N*2;i++)p.push(new ct(i%2===0?.095:.060,-.5+i/(N*2)));
 p.push(new ct(.0006,.5));p.push(new ct(.0006,-.5));
 const g=new Kl(p,12);g.computeVertexNormals();return rh(g);
}
function VCH_setPin(m,a,b){
 const len=Math.max(.05,Math.abs(b.x-a.x));
 m.position.set((a.x+b.x)*.5,(a.y+b.y)*.5,(a.z+b.z)*.5);
 m.scale.set(len,1,1);
}
function VCH_poseLink(w){
 const L=w.link;if(!L)return;
 const wy=w.baseY+w.dy;
 VCH_la.set(L.px,L.py,L.pz);
 VCH_lb.set(L.wx,wy,L.wz);
 VCH_setLink(L.arm,VCH_la,VCH_lb,1);
 // Пята пружины стоит на 55 % длины рычага, поэтому качается ВМЕСТЕ с
 // катком.
 VCH_lb.set(L.wx,L.py+(wy-L.py)*.55,L.pz+(L.wz-L.pz)*.55);
 VCH_la.set(L.qx,L.qy,L.qz);
 VCH_setLink(L.spring,VCH_la,VCH_lb,1);
 L.foot.position.copy(VCH_lb);
 // короткая ось от внутреннего рычага к ступице катка (в обход ветви трака)
 VCH_la.set(L.wx,wy,L.wz);VCH_lb.set(L.hubX,wy,L.wz);
 VCH_setPin(L.pin,VCH_la,VCH_lb);
 L.hub.position.copy(VCH_lb);
}

function kf(){
  const r=Nw(),t=new Jt;t.rotation.order="YXZ";
  const e=new Jt;e.position.y=-.085,t.add(e);
  const n=new Jt;n.position.y=.22,e.add(n);   /* hull clear of track return run */
  const DECK=.755,TUB=.97,SPON=1.62;

  /* ---------------- hull ---------------- */
  /*
  Поднятое днище: нижний лист корпуса висел всего ~0.23 м над землёй, поэтому на
  гребнях и на обломках он скрёб и цеплялся за рельеф. Подъём полный по плоской
  части днища и сходит на нет к носу и задней диагонали, так что нос и наклонная
  корма сохраняют исходную форму.
 */
  const bellyLift=E=>.24*Math.min(1,Math.max(0,(-E-.38)/.34));
  const hs=(L,O,E,S,B)=>{const F=Math.min(.24,B-.04),G=E+bellyLift(E),H=G+.16;
    return[[-L,G],[L,G],[O,H],[O,F],[S,F],[S,B],[-S,B],[-S,F],[-O,F],[-O,H]]};
  const hull=[
    {at:-3.04,pts:hs(.83,.90,-.24,.93,.56)},
    {at:-2.97,pts:hs(.85,.92,-.32,1.04,.58)},
    {at:-2.82,pts:hs(.88,.95,-.56,1.38,.66)},
    {at:-2.64,pts:hs(.89,.96,-.73,1.52,.71)},
    {at:-2.20,pts:hs(.90,TUB,-.78,SPON,DECK)},
    {at:1.40,pts:hs(.90,TUB,-.78,SPON,DECK)},
    {at:2.12,pts:hs(.90,TUB,-.78,SPON,DECK)},
    {at:2.64,pts:hs(.88,.95,-.64,1.46,.32)},
    {at:2.68,pts:hs(.88,.95,-.62,.95,.30)},
    {at:2.92,pts:hs(.86,.94,-.52,.94,.14)},
    {at:3.04,pts:hs(.82,.91,-.44,.92,.07)}
  ];
  ve(flat(gr("z",hull,{radius:.016,segs:2,subdiv:1})),r.paint,0,0,0,n);
  // настил + швы панелей
  te(3.16,.05,4.40,r.paintLight,0,DECK+.015,-.38,.015,n);
  for(const L of[-1,1]){
    $t(.025,.028,4.20,r.paintDark,L*1.02,DECK+.04,-.42,n);
    $t(.025,.028,4.20,r.paintDark,L*1.52,DECK+.04,-.42,n);
    // бортовая броня надгусеничной полки
    te(.05,.52,4.30,r.paint,L*SPON,.51,-.04,.015,n);
    for(let O=0;O<6;O++)$t(.028,.05,.05,r.steelDark,L*1.605,.66,2.0-O*.90,n);
  }
  // моторная палуба + решётки
  te(2.40,.08,1.50,r.paintLight,0,DECK+.06,-2.16,.02,n);
  for(const L of[-1,1]){
    te(.96,.045,1.16,r.paintDark,L*.58,DECK+.105,-2.16,.012,n);
    const O=[];for(let E=0;E<9;E++)O.push({p:[L*.58,DECK+.13,-2.66+E*.125]});
    qi(VCH_roundBox(.90,.03,.052,.008),r.steelDark,O,n,!1)
  }
  $t(2.18,.03,.06,r.steelDark,0,DECK+.12,-1.44,n);
  // люки лобового листа, смотровой прибор
  // механика, курсовой пулемёт
  {
    const L=new Jt;L.position.set(0,.435,2.58),L.rotation.x=.72,n.add(L);
    for(const O of[-1,1]){
      te(.66,.06,.56,r.paintLight,O*.44,.03,.02,.018,L);
      $t(.54,.02,.44,r.paintDark,O*.44,.068,.02,L);
      Gn(.032,.09,r.steelDark,O*.44,.10,.18,8,L)
    }
    te(.40,.13,.16,r.paintDark,-.46,.10,-.40,.018,L);
    $t(.28,.055,.03,r.optic,-.46,.13,-.32,L);
    Gn(.12,.15,r.paintDark,.50,.10,-.38,12,L);
    In(.042,.28,r.steelDark,.50,.10,-.23,10,L);
    $t(.07,.02,.92,r.stowageDark,-.20,.045,.34,L)
  }
  for(const L of[-1,1]){
    const O=new Jt;O.position.set(L*.72,.315,2.72),O.rotation.x=.72,n.add(O);
    te(.26,.05,.30,r.paintDark,0,0,0,.015,O);
    for(let E=0;E<3;E++)$t(.20,.02,.03,r.darkHole,0,.035,-.09+E*.09,O)
  }
  $t(2.02,.03,.05,r.paintDark,0,.755,2.18,n);
  // фары на передних углах корпуса
  for(const L of[-1,1]){
    const O=new Jt;O.position.set(L*.86,.44,2.42),n.add(O);
    Gn(.045,.16,r.steelDark,0,.06,0,8,O);
    const E=new Jt;E.position.set(0,.18,.02),E.rotation.x=-.16,O.add(E);
    ve(ze(VCH_seal([[.02,-.09],[.112,-.082],[.136,-.02],[.136,.055],[.116,.085]],!1,!0),20,"z"),r.paintDark,0,0,0,E);
    In(.108,.03,r.lampAmber,0,0,.070,18,E);
    const S=new Lt(new Ri(.130,.014,6,18),r.steelDark);S.position.set(0,0,.056),E.add(S);
    ve(Wi([[-.145,-.03,.02],[-.14,.12,.055],[0,.175,.065],[.14,.12,.055],[.145,-.03,.02]],.013),r.steelDark,0,0,0,E)
  }
  // передние буксирные серьги
  for(const L of[-1,1]){
    te(.16,.17,.13,r.steelDark,L*.60,-.20,2.99,.02,n);
    const O=new Lt(new Ri(.115,.032,8,16),r.steelDark);
    O.position.set(L*.60,-.35,3.02),O.rotation.set(.15,0,0),O.castShadow=!0,n.add(O)
  }
  /* надгусеничные полки: боковые отбортовки плюс передние и задние брызговики */
  for(const L of[-1,1]){
    const mir=S=>S.map(B=>({at:B.at,pts:B.pts.map(([$,nt])=>[L*$,nt])}));
    const F=L<0;
    const fSec=(yT,yS,x0=.94,x1=1.66,x2=1.78,th=.042)=>[
      [x0,yT],[x1,yT],[x2,yS],[x2,yS-th],[x1-.015,yT-th],[x0,yT-th]
    ];
    const lip=[{at:2.14,pts:[[1.56,.29],[1.78,.17],[1.78,.11],[1.56,.23]]},
               {at:-2.22,pts:[[1.56,.29],[1.78,.17],[1.78,.11],[1.56,.23]]}];
    ve(flat(gr("z",mir(lip),{radius:.008,segs:1,subdiv:1,flip:F})),r.paintWorn,0,0,0,n);
    const front=[{at:2.10,pts:fSec(.30,.17)},
                 {at:2.78,pts:fSec(.28,.16)},
                 {at:2.98,pts:fSec(.25,.14)},
                 {at:3.06,pts:fSec(.21,.11)}];
    ve(flat(gr("z",mir(front),{radius:.01,segs:1,subdiv:1,flip:F})),r.paintWorn,0,0,0,n);
    $t(.70,.042,.036,r.steelDark,L*1.30,.21,3.065,n);
    const back=[{at:-2.18,pts:fSec(.30,.17)},
                {at:-2.76,pts:fSec(.28,.16)},
                {at:-2.94,pts:fSec(.25,.14)},
                {at:-3.02,pts:fSec(.21,.11)}];
    ve(flat(gr("z",mir(back),{radius:.01,segs:1,subdiv:1,flip:!F})),r.paintWorn,0,0,0,n);
    $t(.70,.042,.036,r.steelDark,L*1.30,.21,-3.025,n);
    // усилитель внешней кромки
    $t(.03,.05,4.40,r.paintDark,L*1.765,.15,-.04,n)
  }
  /* sponson stowage */
  for(const L of[-1,1]){
    // крепление канистр (передняя часть надгусеничной
    // полки)
    {
      const O=new Jt;O.position.set(L*1.70,.42,1.24),n.add(O);
      te(.17,.52,.40,r.paintDark,0,0,0,.02,O);
      $t(.03,.32,.24,r.steelDark,L*.085,0,0,O);
      ve(Wi([[L*.075,.17,-.10],[L*.075,.235,0],[L*.075,.17,.10]],.016),r.steelDark,0,0,0,O);
      $t(.03,.44,.05,r.steelDark,L*.085,0,-.14,O);
      $t(.03,.44,.05,r.steelDark,L*.085,0,.14,O)
    }
    for(const[O,E,S,B]of[[.36,.46,.66,r.stowage],[-.44,.48,.72,r.stowage],[-1.26,.42,.58,r.stowageDark]]){
      const $=new Jt;$.position.set(L*1.70,.36,O),n.add($);
      te(.21,E,S,B,0,0,0,.02,$);
      $t(.03,E*.66,S*.66,r.stowageDark,L*.105,0,0,$);
      $t(.03,.045,S*.92,r.steelDark,L*.105,E*.28,0,$)
    }
    // скатанный брезент на задней надгусеничной
    // полке
    {const O=Bo(.13,.86,r.canvas,L*1.28,DECK+.15,-1.92,14,n);O.rotation.y=Math.PI/2;
     for(const E of[-.30,.30]){const S=Bo(.137,.055,r.paintDark,L*1.28+E,DECK+.15,-1.92,14,n);S.rotation.y=Math.PI/2}}
    // шанцевый инструмент на передней надгусеничной
    // полке
    for(const[O,E]of[[1.36,1.62],[1.20,1.30]]){
      const S=Bo(.026,.72,r.steelDark,L*O,DECK+.06,E,8,n);S.rotation.x=Math.PI/2;
      $t(.05,.06,.06,r.paintDark,L*O,DECK+.09,E-.26,n);
      $t(.05,.06,.06,r.paintDark,L*O,DECK+.09,E+.26,n)
    }
    te(.20,.05,.30,r.steelDark,L*1.36,DECK+.07,1.98,.015,n)
  }

  /* rear plate */
  te(2.44,.66,.09,r.paintDark,0,.40,-3.05,.02,n);
  te(1.62,.56,.06,r.steelDark,0,.40,-3.10,.015,n);
  for(const L of[-1,1]){
    te(.74,.46,.04,r.darkHole,L*.40,.40,-3.13,.01,n);
    const O=[];for(let E=0;E<7;E++)O.push({p:[L*.40,.59-E*.063,-3.15]});
    qi(VCH_roundBox(.70,.032,.045,.008),r.steelDark,O,n,!1)
  }
  $t(.05,.52,.05,r.steelDark,0,.40,-3.16,n);
  for(const L of[-1,1]){
    In(.115,.26,r.steelDark,L*1.02,.36,-3.14,14,n);
    In(.088,.06,r.darkHole,L*1.02,.36,-3.28,14,n);
    const O=new Lt(new Ri(.113,.02,6,16),r.steelDark);O.position.set(L*1.02,.36,-3.24),O.castShadow=!0,n.add(O);
    Gn(.085,.09,r.paintDark,L*1.30,.66,-3.06,14,n).rotation.x=Math.PI/2;
    In(.062,.03,r.lampRed,L*1.30,.66,-3.12,14,n)
  }
  te(.20,.20,.13,r.steelDark,0,-.04,-3.06,.02,n);
  {const L=new Lt(new Ri(.090,.026,8,16),r.steelDark);L.position.set(0,-.13,-3.10),L.castShadow=!0,n.add(L)}
  te(.16,.16,.11,r.steelDark,-.66,-.04,-3.06,.02,n);
  {const L=new Lt(new Ri(.080,.024,8,14),r.steelDark);L.position.set(-.66,-.12,-3.09),L.castShadow=!0,n.add(L)}

  /* ---------------- turret ---------------- */
  /*
  Башня живёт на своём узле: стабилизатор орудия контрротирует этот узел ровно на
  качку корпуса от отката, поэтому картинка прицела стоит на месте, пока корпус
  под ней клюёт и кренится.
 */
  const vStab=new Jt,v=new Jt;v.position.set(0,DECK+.22,-.20),vStab.add(v),e.add(vStab);
  Gn(1.00,.10,r.steelDark,0,-.03,0,32,v);
  const tp=[[.46,1.58],[.88,1.20],[1.02,.40],[1.00,-.80],[.82,-1.42],[.40,-1.58],[-.40,-1.58],[-.82,-1.42],[-1.00,-.80],[-1.02,.40],[-.88,1.20],[-.46,1.58]];
  const sc=(L,O)=>L.map(([E,S])=>[E*O,S*O]);
  const ts=[{at:0,pts:sc(tp,.93)},{at:.075,pts:tp},{at:.58,pts:sc(tp,.985)},{at:.645,pts:sc(tp,.925)},{at:.92,pts:sc(tp,.735)}];
  ve(flat(gr("y",ts,{radius:.018,segs:2,subdiv:1,flip:!0})),r.paint,0,0,0,v);
  ve(flat(gr("y",[{at:.915,pts:sc(tp,.735)},{at:.95,pts:sc(tp,.72)}],{radius:.012,segs:2,subdiv:1,flip:!0})),r.paintLight,0,0,0,v);
  for(const L of[-1,1]){
    ve(Wi([[L*.90,.14,1.16],[L*1.00,.17,.40],[L*.98,.15,-.78],[L*.80,.17,-1.38]],.012),r.paintDark,0,0,0,v);
    for(const O of[.70,-.88]){
      const E=new Lt(new Ri(.078,.022,6,12,Math.PI),r.steelDark);
      E.position.set(L*.94,.58,O),E.rotation.set(0,L*Math.PI/2,0),E.castShadow=!0,v.add(E)
    }
    te(.10,.15,.24,r.paintDark,L*.95,.54,.66,.015,v);
    $t(.03,.075,.15,r.optic,L*1.00,.54,.66,v);
    // задний ящик ЗИП по борту
    te(.14,.34,.62,r.paintDark,L*.94,.42,-1.02,.02,v)
  }
  // командирская башенка
  {
    const L=new Jt;L.position.set(-.46,.94,-.40),v.add(L);
    ve(ze(VCH_seal([[.27,-.02],[.33,0],[.34,.10],[.32,.19],[.29,.225]]),24),r.paintLight,0,0,0,L);
    ve(ze(VCH_sealLoop([[.29,.215],[.305,.235],[.305,.258],[.29,.272]]),24),r.paintDark,0,0,0,L);
    Gn(.302,.032,r.paint,0,.245,0,24,L);
    for(let O=0;O<6;O++){
      const E=O/6*oh+.4;
      const S=te(.14,.11,.07,r.paintDark,Math.sin(E)*.30,.10,Math.cos(E)*.30,.012,L);S.rotation.y=E;
      const B=$t(.10,.055,.02,r.optic,Math.sin(E)*.335,.10,Math.cos(E)*.335,L);B.rotation.y=E
    }
    Gn(.022,.15,r.steelDark,.19,.31,-.10,6,L).rotation.z=.5
  }
  Gn(.26,.05,r.paintLight,.48,.965,-.30,20,v);
  Gn(.27,.02,r.paintDark,.48,.995,-.30,20,v);
  Gn(.03,.11,r.steelDark,.48,1.03,-.11,8,v);
  te(.26,.14,.24,r.paintDark,.46,1.02,.44,.02,v);
  $t(.19,.07,.03,r.optic,.46,1.04,.57,v);
  /* AA machine gun */
  {
    const L=new Jt;L.position.set(-.46,1.20,-.34),v.add(L);
    Gn(.055,.32,r.steelDark,0,-.16,0,10,L);
    te(.10,.10,.28,r.steelDark,0,.02,.06,.015,L);
    const O=new Jt;O.position.set(0,.15,.10),L.add(O);
    te(.15,.16,.60,r.steelDark,0,0,.10,.02,O);
    In(.028,.90,r.steelDark,0,.02,.84,10,O);
    In(.048,.30,r.steelDark,0,.02,.46,12,O);
    In(.038,.06,r.darkHole,0,.02,1.30,10,O);
    const E=te(.20,.22,.26,r.paintDark,-.17,-.02,.02,.02,O);E.rotation.z=.08;
    te(.07,.16,.10,r.paintDark,0,-.14,-.12,.015,O);
    te(.05,.05,.32,r.steelDark,0,-.02,-.32,.012,O);
    te(.17,.14,.05,r.paintDark,0,.13,.32,.012,O);
    $t(.03,.09,.03,r.steelDark,0,.20,.32,O)
  }
  for(const L of[-1,1]){
    ve(Wi([[L*.60,.955,.86],[L*.62,1.02,.70],[L*.62,1.02,.30],[L*.60,.955,.14]],.019),r.steelDark,0,0,0,v);
    ve(Wi([[L*.52,.955,-.86],[L*.54,1.01,-1.00],[L*.54,1.01,-1.30],[L*.52,.955,-1.44]],.016),r.steelDark,0,0,0,v)
  }
  for(const L of[-1,1]){
    const O=new Jt;O.position.set(L*.44,.44,-1.58),v.add(O);
    te(.60,.38,.26,r.paintDark,0,0,0,.025,O);
    $t(.50,.03,.04,r.steelDark,0,.16,-.14,O);
    $t(.44,.26,.02,r.paint,L*.02,0,-.145,O)
  }
  /*
  ---------------- люк выброса стреляной гильзы ---------------- Квадратный люк
  между двумя задними ящиками ЗИП. Его крышка распахивается за миг до того, как
  наружу вылетает пустая гильза (см. выброс ниже).
 */
  const casePort=new Jt;casePort.position.set(0,.44,-1.60),v.add(casePort);
  te(.30,.31,.06,r.steelDark,0,0,-.025,.012,casePort);
  te(.26,.26,.05,r.darkHole,0,0,.005,0,casePort);
  const caseFlap=new Jt;caseFlap.position.set(0,.145,.022),casePort.add(caseFlap);
  te(.27,.275,.032,r.paintDark,0,-.135,.012,.008,caseFlap);
  $t(.20,.205,.014,r.paint,0,-.135,.030,caseFlap);
  $t(.055,.03,.02,r.steelDark,0,-.258,.030,caseFlap);
  Gn(.05,.15,r.paintDark,.74,.88,-1.14,8,v);
  {const L=Gn(.012,1.30,r.steelDark,.74,1.58,-1.14,6,v);L.castShadow=!1}
  /* white outline triangle */
  {
    const L=new En({map:refMark(),transparent:!0,depthWrite:!1,toneMapped:!1});
    for(const O of[-1,1]){
      const E=new Lt(new Di(.48,.48),L);
      E.position.set(O*1.032,.33,.05),E.rotation.set(0,O*Math.PI/2,O*.032,"ZYX"),E.renderOrder=3,v.add(E)
    }
    const O=new Lt(new Di(.19,.19),L);
    O.position.set(.40,.22,1.235),O.rotation.set(-.36,.28,0),O.renderOrder=3,v.add(O)
  }
  /* ---------------- mantlet + gun ---------------- */
  const gunY=.49;
  const z=new Jt;z.position.set(0,gunY,1.42),v.add(z);
  te(.78,.62,.46,r.paint,0,0,-.18,.04,z);
  ve(ze(VCH_seal([[.18,-.24],[.235,-.18],[.25,.02],[.25,.22],[.22,.30]]),24,"z"),r.paintLight,0,0,.02,z);
  for(const L of[-1,1])Bo(.065,.18,r.steelDark,L*.35,0,-.12,10,z);
  {const VCH_collar=new Lt(new Ri(.205,.022,8,24),r.steelDark);VCH_collar.position.set(0,0,.30),VCH_collar.castShadow=!0,z.add(VCH_collar)}
  const U=new Jt;z.add(U);
  const K=new Jt;U.add(K);
  ve(ze(VCH_seal([[.14,.24],[.175,.32],[.175,.70],[.145,.80]]),26,"z"),r.sleeve,0,0,0,K);
  ve(ze(VCH_seal([[.092,.76],[.102,.86],[.096,1.55],[.084,2.10],[.080,2.28]]),24,"z"),r.paint,0,0,0,K);
  for(const L of[.86,1.52])ve(ze([[.099,L-.026],[.110,L-.014],[.110,L+.014],[.099,L+.026]],22,"z"),r.paintDark,0,0,0,K);
  const k=new Jt;k.position.z=2.26,K.add(k);
  /*
  дульный тормоз как ОДНО замкнутое кольцевое тело: внешняя оболочка → передний торец →
  стенка канала. В открытом виде его внутренняя стенка отсекалась как обратная сторона, и
  сквозь тормоз было видно насквозь.
 */
  ve(ze(VCH_sealLoop([[.088,-.02],[.090,-.02],[.145,.04],[.158,.12],[.158,.28],
                      [.145,.33],[.145,.39],[.158,.43],[.158,.58],[.138,.64],
                      [.112,.66],[.088,.66]]),26,"z"),r.paintDark,0,0,0,k);
  /* тёмный цилиндр с торцом внутри канала: дуло читается как глубокая дыра, а не как небо */
  In(.0875,.60,r.darkHole,0,0,.32,18,k);
  /* боковые окна сдува: тёмные заглушки, утопленные в оболочку, поэтому видно только заподлицо тёмное окно */
  for(let L=0;L<2;L++)for(const O of[-1,1]){
    Bo(.044,.014,r.darkHole,O*.1535,0,.19+L*.245,12,k)
  }
  {const L=new Lt(new Ri(.15,.016,6,20),r.steelDark);L.position.set(0,0,.36),k.add(L)}
  const it=new ue;it.position.set(0,0,.72),k.add(it);

  /* ---------------- running gear ---------------- */
  const Z=Fw(r),st=()=>({wheels:[],sprocket:null,idler:null,rollers:[],buf:Cw(),C:Pw(2+Kt.roadWheelZ.length+Kt.rollers.length)}),Q={left:st(),right:st()},Ot=Uw(Kt.trackWidth),tt={left:new Jt,right:new Jt},ot=(L,O)=>{const E=O*Kt.trackHalfTrack,S=Q[L],torX=E-O*.40;for(const nt of Kt.roadWheelZ){
   const X=Z(e,E,Kt.roadWheelY,nt),
         ax=torX,                          // внутрь от трака, в обход звеньев
         px=ax,py=.18,pz=nt+.40,          // шарнир балансира на борту корпуса
         qx=ax,qy=.36,qz=nt+.72;          // верхний кронштейн пружины на борту корпуса
   te(.18,.16,.18,r.steelDark,px,py,pz,.02,e);          // корпус подшипника шарнира
   te(.075,.32,.075,r.steelDark,px,py+.20,pz,.012,e);   // стойка вверх в корпус
   te(.14,.13,.14,r.steelDark,qx,qy,qz,.02,e);          // кронштейн пружины
   Bo(.085,.07,r.steelDark,px-O*.02,py,pz,12,e);        // бобышка шарнира
   const arm=ve(Bf(.13,1,.17,.028),r.steelDark,0,0,0,e),
         spring=ve(VCH_springClosedGeom(),r.steelDark,0,0,0,e),
         pin=Bo(.052,1,r.steelDark,0,0,0,10,e),
         hub=Bo(.095,.06,r.steelDark,E,Kt.roadWheelY,nt,12,e),
         foot=Bo(.070,.05,r.steelDark,0,0,0,10,e);
   const rec={obj:X,z:nt,baseY:Kt.roadWheelY,dy:0,
     link:{px:px,py:py,pz:pz,qx:qx,qy:qy,qz:qz,wx:ax,hubX:E,wz:nt,
           arm:arm,spring:spring,pin:pin,hub:hub,foot:foot}};
   S.wheels.push(rec);VCH_poseLink(rec);
  }
  /* Торсион: один непрерывный стержень вдоль корпуса с подшипником на каждой станции. */
  In(.046,5.6,r.steelDark,torX-O*.04,.18,0,12,e);
  for(const nt of Kt.roadWheelZ)te(.13,.17,.15,r.steelDark,torX-O*.04,.18,nt,.02,e);const EW=E+O*Kt.endWheelOffset;S.sprocket=zw(r,e,EW,Kt.sprocket.y,Kt.sprocket.z),S.idler=Ow(r,e,EW,Kt.idler.y,Kt.idler.z);Bo(.085,Kt.endWheelOffset+.12,r.steelDark,E+O*Kt.endWheelOffset*.5,Kt.sprocket.y,Kt.sprocket.z,16,e),Bo(.085,Kt.endWheelOffset+.12,r.steelDark,E+O*Kt.endWheelOffset*.5,Kt.idler.y,Kt.idler.z,16,e);
  /*
  Аккуратный корпусной подшипник для двух крайних колёс (ведущего и ленивца).
  Кронштейн стоит внутрь от полосы гусеницы, поэтому ничего не режет траки; до
  ступицы колеса доходит только короткая полуось. Тот же литейный язык, что у
  кронштейнов подвески катков.
 */
  for(const wz of [Kt.sprocket.z,Kt.idler.z]){
   const xIn=E-O*.34,wy=Kt.sprocket.y;
   te(.17,.20,.26,r.steelDark,xIn,.38,wz,.020,e).name='VCH_endmount';
   te(.085,.52,.13,r.steelDark,xIn,.12,wz,.012,e).name='VCH_endmount';
   Bo(.115,.09,r.steelDark,xIn,wy,wz,14,e).name='VCH_endmount';
   Bo(.060,Math.abs(EW-xIn)+.06,r.steelDark,(xIn+EW)/2,wy,wz,12,e).name='VCH_endmount';
   te(.10,.10,.16,r.steelDark,xIn,.46,wz,.012,e).name='VCH_endmount';
  }for(const nt of Kt.rollers){
   const X=ve(ze(VCH_seal([[.02,.11],[.07,.112],[Kt.rollerR-.01,.104],[Kt.rollerR,.045],[Kt.rollerR,-.045],[Kt.rollerR-.01,-.104],[.07,-.112],[.02,-.11]]),18,"x"),r.steelDark,E,Kt.rollerY,nt.z,e);
   te(.07,.30,.07,r.steelDark,E-O*.08,Kt.rollerY+.20,nt.z,.012,e);
   Bo(.075,.05,r.steelDark,E-O*.08,Kt.rollerY,nt.z,10,e);
   S.rollers.push(X)
  }const B=tt[L];B.position.x=E,e.add(B);const $=new xa(Ot,r.track,Kt.maxLinks);$.castShadow=!0,$.receiveShadow=!0,$.frustumCulled=!1,B.add($),S.inst=$,S.sampler=Iw(S.buf),S.offset=0,S.pitch=.15,S.dummy=new ue,S.mat=new Xt,S.quat=new gn,S.p={x:0,z:0,y:0,nz:0,ny:0,tx:0,tz:1,ty:0},S.sampleP={x:0,z:0,y:0,nz:0,ny:0,tx:0,tz:1,ty:0}};ot("left",-1),ot("right",1);
for(const O of[-1,1]){
  const S=O<0?Q.left:Q.right;S.side=O;_t(S);Lw(S.buf,S.C,S.C.length);S.sampler.build();
  S.linkCount=Math.min(Kt.maxLinks,Math.max(1,Math.round(S.sampler.total/Kt.trackPitch)));
  S.inst.count=S.linkCount;S.pitch=S.sampler.total/S.linkCount;
}function _t(L){const O=L.C;let E=0;O[E].x=L.side*Kt.endWheelOffset,O[E].z=Kt.idler.z,O[E].y=Kt.idler.y,O[E].r=Kt.idler.r,O[E].kind="idler",E++;for(const S of L.wheels)O[E].x=0,O[E].z=S.z,O[E].y=S.baseY+S.dy,O[E].r=Kt.wheelRadius,O[E].kind="wheel",E++;O[E].x=L.side*Kt.endWheelOffset,O[E].z=Kt.sprocket.z,O[E].y=Kt.sprocket.y,O[E].r=Kt.sprocket.r,O[E].kind="sprocket",E++;for(let S=Kt.rollers.length-1;S>=0;S--)O[E].x=0,O[E].z=Kt.rollers[S].z,O[E].y=Kt.rollerY,O[E].r=Kt.rollerR,O[E].kind="roller",E++}const lt={trackOffsetL:0,trackOffsetR:0,recoil:0,recoilVel:0,wheelDrop:0},It=new P;new P(1,0,0);const Nt=new P(0,1,0),Bt=new P(0,0,1);
function zt(L,O,E,S){if(!S)return;const B=Kt.wheelRadius,W=L.wheels,n=W.length;
 /*
  Сырая цель с зонда грунта. На краях пропсов она может скакать разрывом,
  поэтому напрямую больше НЕ применяется.
 */
 for(const $ of W){It.set(O*Kt.trackHalfTrack,$.baseY,$.z).applyMatrix4(e.matrixWorld);
  const nt=S(It.x,It.y,It.z,1.6);let X=B+Kt.trackShoe-nt;
  $.target=Te.clamp(X,-.19,Kt.wheelTravelUp)}
 // Натяжение трака. Натянутый трак перекрывает впадину, а не проваливается в неё,
 // поэтому каток не может висеть ниже линии между соседями больше чем на trackNotch.
 const d=L.tension||(L.tension=new Float64Array(n+2));d[0]=0;d[n+1]=0;
 for(let $=0;$<n;$++)d[$+1]=W[$].target;
 const notch=Kt.trackNotch;for(let pass=0;pass<12;pass++){let moved=0;
  for(let $=1;$<=n;$++){const floor=(d[$-1]+d[$+1])*.5-notch;
   if(d[$]<floor){const v=Math.min(Kt.wheelTravelUp,floor);moved+=Math.abs(v-d[$]),d[$]=v}}
  if(moved<1e-5)break}
 /*
  Один экспоненциальный фильтр плюс ограничение скорости перекладки: не зависит
  от FPS, быстро отрабатывает мелкие неровности, но ступенька на краю никогда не
  дёрнет каток рывком.
 */
 const dt=Te.clamp(E>0?E:1/60,.001,.05),
       alpha=1-Math.exp(-dt*VCH_SUS_RATE*VCH_susK),
       maxStep=VCH_SUS_MAXV*VCH_susK*dt;
 for(let $=0;$<n;$++){
  const nt=W[$],tgt=Te.clamp(d[$+1],-.19,Kt.wheelTravelUp),
        goal=nt.dy+(tgt-nt.dy)*alpha;
  nt.dy=Te.clamp(goal,nt.dy-maxStep,nt.dy+maxStep);
  nt.dy=Te.clamp(nt.dy,-.19,Kt.wheelTravelUp);
  nt.obj.position.y=nt.baseY+nt.dy;VCH_poseLink(nt)
 }}function rt(L,O,E,S){_t(L),Lw(L.buf,L.C,L.C.length),L.sampler.build(),L.offset=(L.offset+S*E)%L.sampler.total;const B=L.linkCount,$=L.sampler.total/B;L.pitch=$;const nt=L.inst,X=L.dummy,ht=.031;for(let dt=0;dt<B;dt++){const yt=dt*$+L.offset;L.sampler.at(yt,L.sampleP);const Yt=L.sampleP;Nt.set(0,Yt.ny,Yt.nz),Bt.set(Yt.tx,Yt.ty,Yt.tz),It.crossVectors(Nt,Bt).normalize(),Nt.crossVectors(Bt,It).normalize(),X.position.set(Yt.x+Nt.x*ht,Yt.y+Nt.y*ht,Yt.z+Nt.z*ht),L.mat.makeBasis(It,Nt,Bt),L.quat.setFromRotationMatrix(L.mat),X.quaternion.copy(L.quat),X.scale.set(1,1,$),X.updateMatrix(),nt.setMatrixAt(dt,X.matrix)}nt.instanceMatrix.needsUpdate=!0}function I(L,O={}){const E=O.probe,S=O.speedL||0,B=O.speedR||0;E&&(t.updateMatrixWorld(!0),zt(Q.left,-1,L,E),zt(Q.right,1,L,E));const $=S*L/Kt.wheelRadius,nt=B*L/Kt.wheelRadius;for(const ht of Q.left.wheels)ht.obj.rotation.x+=$;for(const ht of Q.right.wheels)ht.obj.rotation.x+=nt;Q.left.sprocket.rotation.x+=S*L/Kt.sprocket.r,Q.right.sprocket.rotation.x+=B*L/Kt.sprocket.r,Q.left.idler.rotation.x+=S*L/Kt.idler.r,Q.right.idler.rotation.x+=B*L/Kt.idler.r;for(const ht of Q.left.rollers)ht.rotation.x+=S*L/Kt.rollerR;for(const ht of Q.right.rollers)ht.rotation.x+=B*L/Kt.rollerR;const X=9.5;lt.recoilVel+=(-135*lt.recoil-X*lt.recoilVel)*L,lt.recoil+=lt.recoilVel*L,lt.recoil<0&&(lt.recoil=0,lt.recoilVel<0&&(lt.recoilVel*=-.25)),U.position.z=-lt.recoil,U.rotation.x=-lt.recoil*.075,z.position.y=gunY+Math.sin(lt.recoil*10)*lt.recoil*.055,lt.trackOffsetL+=S*L,lt.trackOffsetR+=B*L,rt(Q.left,-1,L,S),rt(Q.right,1,L,B)}function gt(L=1){lt.recoilVel=9.2*L}const ft=new gn;function ut(L,O){return it.updateWorldMatrix(!0,!1),it.getWorldPosition(L),K.getWorldQuaternion(ft),O.set(0,0,1).applyQuaternion(ft),L}function vt(L=3){const O=[];k.updateWorldMatrix(!0,!1);for(let E=0;E<L;E++){const S=new P(Math.sin(E*2.1)*.2,-.04,.3);S.applyMatrix4(k.matrixWorld),O.push(S)}return O}e.userData.__vchRole="chassis";v.userData.__vchRole="turret";z.userData.__vchRole="gunPivot";U.userData.__vchRole="recoilGroup";it.userData.__vchRole="muzzlePoint";VCH_applyAll(t);return{group:t,chassis:e,turret:v,turretStab:vStab,casePort:casePort,caseFlap:caseFlap,gunPivot:z,recoilGroup:U,muzzlePoint:it,muzzle:k,tracks:tt,wheels:{left:Q.left.wheels,right:Q.right.wheels},undercarriage:Q,materials:r,update:I,fireRecoil:gt,getMuzzle:ut,getMuzzleBrakepoints:vt,state:lt}}const Bw=2,is=1,kw=4,VCH_RAMP=8;new w(0,1,0);
