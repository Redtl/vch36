/* ==========================================================================
   vch36 · js/05-cases.js
   выброс стреляной гильзы
   Из index.html (4.2 «разбиение на модули»). Порядок загрузки задан в index.html
   тегами <script defer>; «use strict» сохранён — исходный код был модулем.
   ========================================================================== */
"use strict";

/*
  ===== ВЫБРОС СТРЕЛЯНОЙ ГИЛЬЗЫ =============================================
  Через секунду после выстрела пустая гильза 125 мм выбрасывается из квадратного
  люка в задней части башни: крышка откидывается, латунная гильза кувыркается
  наружу, пару раз подпрыгивает на земле и остаётся лежать.
 */
const V_CASE_BRASS=new fe({color:0xc9a24a,metalness:.93,roughness:.34,envMapIntensity:1.15}),
      V_CASE_BRASS2=new fe({color:0x9c7730,metalness:.90,roughness:.46}),
      V_CASE_DARK=new fe({color:0x2a2723,metalness:.55,roughness:.62}),
      V_CASES=[],V_FLAP={phase:0,t:0,ang:0};
let V_caseDelay=0;
/* геометрия гильзы: лате-профиль вдоль +Y, с центровкой по своей середине */
const V_CASE_GEO=(()=>{
  /*
  Один замкнутый лате-профиль: плоское донце → закраина → канавка → корпус → плечо → шейка → дульце.
  Повторяющиеся точки держат кромки закраины и плеча чёткими, поэтому латунь показывает чистые кольца,
  а не размытые полосы.
 */
  const P=[[0.0006,-.220],[0.066,-.220],[0.066,-.220],[0.086,-.2155],[0.0925,-.2085],
           [0.0925,-.1965],[0.0925,-.1965],[0.0815,-.1905],[0.0755,-.1815],[0.0735,-.1705],
           [0.0755,-.1585],[0.0755,-.1585],[0.0755,-.0800],[0.0745,.0100],[0.0725,.0620],
           [0.0700,.0880],[0.0600,.1280],[0.0560,.1560],[0.0560,.1560],[0.0555,.2010],
           [0.0555,.2010],[0.0520,.2090],[0.0480,.2145],[0.0480,.2145],
           /* полая шейка: дульце → внутренняя стенка → внутреннее дно */ 
           [0.0330,.2145],[0.0330,.2145],[0.0330,.1520],[0.0330,.1520],[0.0006,.1520]];
  const pts=new Array(P.length);
  for(let i=0;i<P.length;i++)pts[i]=new ct(Math.max(4e-4,P[i][0]),P[i][1]);
  const g=new Kl(pts,24);g.computeVertexNormals();return rh(g)
})();
function V_makeCase(){
  const g=new Jt();g.userData.vCase=!0;
  const body=new Lt(V_CASE_GEO,V_CASE_BRASS);
  body.castShadow=!0;body.receiveShadow=!0;g.add(body);
  const cap=new Lt(ze([[0.0006,0],[0.0278,0]],16),V_CASE_BRASS2);
  cap.position.y=-.2192;g.add(cap);                               /* primer face */
  const bore=new Lt(ze([[0.0006,0],[0.0328,0]],16),V_CASE_DARK);
  bore.position.y=.1524;g.add(bore);                              /* sooty case floor */
  return g;
}
/* один выстрел = одна гильза, выброс через 1.0 с */
function V_ejectSchedule(){V_caseDelay=1.0;V_boltKick()}

/* --- откат казённика -------------------------------------------------------
   Скорпион: back_plate_01_Low и Main_frame_01_Low — детали казённика, лежат
   на башне (tower_Low) позади оси цапф. Ствол смотрит в локальный +X башни,
   поэтому откат идёт по −X. Обе детали идут ОДНОВРЕМЕННО: назад сразу после
   выстрела, гильза вылетает при откате, потом детали возвращаются.          */
const V_BOLT={rig:null,nodes:[],base:[],axis:new P(-1,0,0),
              stroke:.45,        /* ход назад, локальные единицы модели */
              out:.10,back:.18,  /* с · время отката и возврата */
              phase:0,t:0,hold:0};
function V_boltSet(u){                     /* u: 0 — на месте, 1 — назад */
  for(let i=0;i<V_BOLT.nodes.length;i++)
    V_BOLT.nodes[i].position.copy(V_BOLT.base[i])
      .addScaledVector(V_BOLT.axis,V_BOLT.stroke*u);
}
function V_boltBind(){
  if(V_BOLT.phase!==0&&V_BOLT.nodes.length)V_boltSet(0);   /* прежний танк — на место */
  V_BOLT.nodes.length=0;V_BOLT.base.length=0;
  V_BOLT.phase=0;V_BOLT.t=0;V_BOLT.hold=0;V_BOLT.rig=qt||null;
  if(!qt||!qt.group)return;
  const want=["back_plate_01_low","main_frame_01_low"];
  qt.group.traverse(o=>{
    if(!o.isMesh)return;
    const n=(o.name||"").toLowerCase();
    if(want.indexOf(n)>=0){V_BOLT.nodes.push(o);V_BOLT.base.push(o.position.clone())}
  });
}
function V_boltKick(){
  if(V_BOLT.rig!==qt)V_boltBind();
  if(!V_BOLT.nodes.length)return;
  V_BOLT.phase=1;V_BOLT.t=0;V_BOLT.hold=0;
}
function V_boltTick(dt){
  if(V_BOLT.rig!==qt)V_boltBind();
  if(!V_BOLT.nodes.length||V_BOLT.phase===0)return;
  V_BOLT.t+=dt;
  if(V_BOLT.phase===1){                                    /* назад */
    const u=Math.min(1,V_BOLT.t/V_BOLT.out);
    V_boltSet(u<.5?2*u*u:1-Math.pow(-2*u+2,2)/2);
    if(u>=1){V_BOLT.phase=2;V_BOLT.t=0}
  }else if(V_BOLT.phase===2){                              /* стоим, ждём гильзу */
    V_boltSet(1);
    if(V_BOLT.hold>0){V_BOLT.hold-=dt;if(V_BOLT.hold<=0){V_BOLT.phase=3;V_BOLT.t=0}}
  }else{                                                   /* вперёд */
    const u=Math.min(1,V_BOLT.t/V_BOLT.back);
    V_boltSet(1-Math.pow(1-u,3));
    if(u>=1){V_BOLT.phase=0;V_BOLT.t=0;V_boltSet(0)}
  }
}
function V_ejectSpawn(){
  if(!qt||!qt.casePort)return;
  const port=qt.casePort;
  port.updateWorldMatrix(!0,!1);
  const pos=new P();port.getWorldPosition(pos);
  const q=new gn();port.getWorldQuaternion(q);
  const back=new P(0,0,-1).applyQuaternion(q),
        up=new P(0,1,0).applyQuaternion(q),
        side=new P(1,0,0).applyQuaternion(q);
  const vBody=Ce&&Ce.body?Ce.body.velocity:null;
  const rs=()=>.86+Math.random()*.30;
  const vel=back.clone().multiplyScalar(2.20*rs()).addScaledVector(up,2.90*rs()).addScaledVector(side,2.60*rs());
  if(vBody)vel.x+=vBody.x*.85,vel.y+=Math.max(0,vBody.y)*.5,vel.z+=vBody.z*.85;
  const mesh=V_makeCase();
  mesh.position.copy(pos).addScaledVector(back,.22).addScaledVector(up,.085);
  mesh.quaternion.copy(q).multiply(new gn().setFromAxisAngle(new P(1,0,0),1.24));  /* case leaves tilted, tumbles */
  mesh.scale.setScalar(1.15);
  cn.add(mesh);
  if(en&&en._get)en._get(en.pool).spawn({pos:pos.clone().addScaledVector(up,.06),vel:back.clone().multiplyScalar(1.1).addScaledVector(up,.85),life:.62+Math.random()*.2,size0:.14,size1:1.05,color:10130052,drag:2.6,grav:-.5,opacity:.17});
  V_CASES.push({m:mesh,vel,ang:new P(5+Math.random()*4,4+Math.random()*5,7+Math.random()*5),
                t:0,rest:!1,sleep:0});
  if(V_CASES.length>36){const old=V_CASES.shift();cn.remove(old.m)}
  V_BOLT.hold=.12;                       /* гильза ушла — казённик закрывается */
}
function V_clink(gain,freq){
  if(!an||!an.started||!an._noiseBurst)return;
  an._noiseBurst({dur:.13,type:"bandpass",freq:freq||2600,q:4.5,gain:gain||.16});
}
function V_ejectTick(dt){
  /* --- scheduled ejection --- */
  if(V_caseDelay>0){
    V_caseDelay-=dt;
    if(V_caseDelay<=0){V_caseDelay=0;V_FLAP.phase=1;V_FLAP.t=0;V_clink(.08,3100)}
  }
  /* --- hatch flap animation --- */
  const fp=qt&&qt.caseFlap;
  if(fp){
    V_FLAP.t+=dt;
    if(V_FLAP.phase===1){
      V_FLAP.ang=1.95*Math.min(1,V_FLAP.t/.10);
      if(V_FLAP.t>=.10){V_FLAP.phase=2;V_FLAP.t=0;V_ejectSpawn()}
    }else if(V_FLAP.phase===2){
      V_FLAP.ang=1.95;
      if(V_FLAP.t>=.52){V_FLAP.phase=3;V_FLAP.t=0}
    }else if(V_FLAP.phase===3){
      V_FLAP.ang=1.95*(1-Math.min(1,V_FLAP.t/.30));
      if(V_FLAP.t>=.30){V_FLAP.phase=0;V_FLAP.t=0;V_FLAP.ang=0;V_clink(.055,2100)}
    }
    fp.rotation.x=V_FLAP.ang;
  }
  V_boltTick(dt);
  /* --- cases in flight / on the ground --- */
  const spin=new gn(),axis=new P();
  for(let i=V_CASES.length-1;i>=0;i--){
    const c=V_CASES[i];c.t+=dt;
    if(!c.rest){
      c.vel.y-=9.81*dt;
      c.m.position.addScaledVector(c.vel,dt);
      const w=c.ang.length();
      if(w>1e-3){
        axis.copy(c.ang).divideScalar(w);
        spin.setFromAxisAngle(axis,w*dt);
        c.m.quaternion.premultiply(spin);
      }
      const cxp=c.m.position.x,cyp=c.m.position.y,czp=c.m.position.z,
            hd=Jf(cxp,cyp,czp,4.0),                        /* real surface under the case */
            gy=hd<3.99?cyp-hd:ge(cxp,czp),                 /* откат к аналитической высоте */
            R=.10;
      if(c.m.position.y<gy+R){
        c.m.position.y=gy+R;
        if(c.vel.y<-1.0){
          c.vel.y*=-.33;c.vel.x*=.60;c.vel.z*=.60;c.ang.multiplyScalar(.5);
          V_clink(.14,2300+Math.random()*1200);
        }else{
          /* успокоение: кладём гильзу плашмя на грунт */
          c.vel.set(0,0,0);c.ang.set(0,0,0);c.rest=!0;
          const yaw=Math.random()*Math.PI*2,
                qTilt=new gn().setFromAxisAngle(new P(1,0,0),Math.PI/2),
                qYaw=new gn().setFromAxisAngle(new P(0,1,0),yaw);
          c.m.quaternion.copy(qYaw).multiply(qTilt);
          c.m.position.y=gy+.086;
          V_clink(.10,1700+Math.random()*600);
        }
      }
    }
    if(c.t>26){cn.remove(c.m);V_CASES.splice(i,1)}
  }
}
let V_riEl=null,V_riWorld=null,V_riDot=null,V_riTxt=null;
/*
  Мелкий тихий индикатор отдачи: точка наклоняется туда же, куда кренится
  корпус, поэтому выстрел в борт читается даже когда камера стоит за танком.
 */
/* Авиагоризонт вместо прежней «точки отдачи»: круг с линией горизонта,
   которая наклоняется по крену корпуса и уезжает по дифференту, неподвижное
   перекрестие и светящаяся точка отклонения (отдача + качка). По прибору
   видно и крен машины на склоне, и куда уводит выстрел.                    */
function vRecoilIndicator(){
  if(!V_riEl){
    V_riEl=document.createElement("div");V_riEl.id="recoilind";
    V_riEl.innerHTML=
      '<div class="ri-world"><div class="ri-sky"></div><div class="ri-ground"></div>'+
      '<div class="ri-line"></div><div class="ri-pip"></div></div>'+
      '<div class="ri-cross"></div><div class="ri-dot"></div>'+
      '<div class="ri-txt"></div>';
    document.body.appendChild(V_riEl);
    V_riWorld=V_riEl.querySelector(".ri-world");
    V_riDot=V_riEl.querySelector(".ri-dot");
    V_riTxt=V_riEl.querySelector(".ri-txt");
  }
  const p=(Ce.recP||0)+(Ce.recP2||0),r=(Ce.recR||0)+(Ce.recR2||0),
        k=1/VCH_RECOIL.pMax,mag=Math.min(1,Math.hypot(p,r)*k);
  /* дифферент/крен корпуса (рад) → наклон и сдвиг линии горизонта */
  const pitch=(Ce.pitch||0)+p,roll=(Ce.roll||0)+r;
  const vis=Math.max(mag,Math.min(1,Math.abs(pitch)*6+Math.abs(roll)*4));
  if(vis<.06){V_riEl.style.opacity="0";return}
  V_riEl.style.opacity=String(Math.min(1,.45+vis*1.1));
  if(V_riWorld){
    const dy=Te.clamp(pitch*70,-26,26),deg=Te.clamp(roll*57.3,-70,70);
    V_riWorld.style.transform=`translate(0,${dy.toFixed(1)}px) rotate(${deg.toFixed(1)}deg)`;
  }
  if(V_riDot)V_riDot.style.transform=`translate(${(-r*k*23).toFixed(1)}px,${(p*k*23).toFixed(1)}px)`;
  if(V_riTxt)
    V_riTxt.textContent=`КРЕН ${(roll*57.3).toFixed(0)}° · ДИФФ ${(-pitch*57.3).toFixed(1)}°`;
}
/* 5.4: скрип гусениц. Разворот на месте и снос на скорости — единственные
   случаи, когда траки «трутся» по грунту боком; событие выдаём не чаще
   ~4 раз в секунду, иначе шум сливается в шипение. */
let VCH_sqT=0;
function VCH_trackFX(dt){
  if(!an||!an.started||!J.started)return;
  VCH_sqT-=dt;
  const yaw=Math.abs(Ce.yawRate||0),slip=Math.abs(Ce.slip||0);
  if(VCH_sqT>0)return;
  const k=Te.clamp(yaw/2.0,0,1)*.65+Te.clamp(slip/1.2,0,1)*.45;
  if(k>.12){try{an.squeak(.3+k*.7)}catch(e){}VCH_sqT=.22+Math.random()*.16}
}
function vFrame(dt){
  if(V_sky)V_sky.material.uniforms.uTime.value=performance.now()*.001;
  vEnsureTankLights();vExhaust(dt);vAdapt(dt);vRecoilIndicator();V_ejectTick(dt);
  /* HUD и стрельбище живут в том же кадре, что и сцена.
     Через window, потому что vFrame успевает выполниться до объявления
     VCH_HUD (TDZ у const), а typeof на TDZ-переменной сам бросает. */
  VCH_trackFX(dt);if(typeof VCH_camFX=="function")VCH_camFX(dt);
  if(typeof vchPropDyn=="function")vchPropDyn(dt);   /* 3.4: катящиеся бочки */
  if(typeof VCH_NORD_tick=="function")VCH_NORD_tick(dt);
  if(window.__vchUI){window.__vchUI.hud.tick(dt);window.__vchUI.range.tick(dt);window.__vchUI.track.tick(dt);window.__vchUI.ai.tick(dt)}
}
function vSceneTune(){
  if(typeof Vr!="undefined"&&Vr&&Vr.glows){
    const stex=vSparkTex(128);
    for(const g of Vr.glows)if(g.sprite){g.sprite.material.map=stex;g.sprite.material.needsUpdate=!0}
  }
  cn.traverse(o=>{
    const m=o.material;if(!m)return;
    for(const mm of Array.isArray(m)?m:[m]){
      for(const k of["map","bumpMap","roughnessMap","normalMap","emissiveMap"])
        if(mm[k]&&mm[k].anisotropy<8)mm[k].anisotropy=8;
      /*
  Один мягкий, единый отклик поверхности: ничто в сцене не должно превращаться в
  зеркало или в острую искру света, поэтому у каждого материала остаётся хотя бы
  небольшая шероховатость и он ровно принимает подсветку неба.
 */
      if(mm.isMeshStandardMaterial){
        mm.roughness=Math.max(mm.roughness??1,.32);
        mm.envMapIntensity=Math.max(mm.envMapIntensity??1,.85);
      }
    }
  })
}
function Ww(r){const t=new Sy(0xa9c8f0,0x6b6154,.80);r.add(t);const e=new wl(0xffeacb,3.40);e.position.set(-52,62,-78),e.castShadow=!0,e.shadow.mapSize.set(VQ.shadow,VQ.shadow),e.shadow.camera.near=45,e.shadow.camera.far=185;const n=34;e.shadow.camera.left=-n,e.shadow.camera.right=n,e.shadow.camera.top=n,e.shadow.camera.bottom=-n,/*
  Мягкие тени PCF: 2048 px на тот же фрустум 68 м даёт 3.3 см на тексель — полутень остаётся
  шириной в несколько пикселей, что читается как мягкая, но не размывает весь кадр.
 */
  e.shadow.bias=-55e-5,e.shadow.normalBias=.038,r.add(e),r.add(e.target);const i=new wl(0x9fbdf5,.78);i.position.set(64,34,72),r.add(i);const s=new wl(0xffc98f,.38);s.position.set(28,7,44),r.add(s);return r.add(new Ay(0x4a5666,.19)),{sun:e,hemi:t,fill:i,bounce:s}}function qw(r){const n=new Di(420,420,168,168);n.rotateX(-Math.PI/2);const i=n.attributes.position,s=new Float32Array(i.count*3),o=new Ft;for(let h=0;h<i.count;h++){const d=i.getX(h),u=i.getZ(h),f=ge(d,u);i.setY(h,f);const m=Te.clamp(.5+f*.12,0,1);o.setRGB(.62+m*.1,.58+m*.1,.5+m*.08);const v=Math.sin(d*1.7)*Math.cos(u*1.3)*.03;o.offsetHSL(0,0,v),s[h*3]=o.r,s[h*3+1]=o.g,s[h*3+2]=o.b}n.setAttribute("color",new Ve(s,3)),n.computeVertexNormals();{const nm=n.attributes.normal,nv=new P;for(let h=0;h<i.count;h++){Hw(i.getX(h),i.getZ(h),nv);nm.setXYZ(h,nv.x,nv.y,nv.z)}nm.needsUpdate=!0}const a=groundMaps();const c=new fe({map:a.map,normalMap:a.norm,normalScale:new ct(.55,.55),roughnessMap:a.rough,vertexColors:!0,roughness:.96,metalness:.02,envMapIntensity:.55,dithering:!0}),l=new Lt(n,c);return l.receiveShadow=!0,r.add(l),l}function Xw(r,t){const e=vBuildingTex(),n=new fe({map:e.map,normalMap:e.norm,normalScale:new ct(.45,.45),roughnessMap:e.rough,roughness:.92,metalness:.08,color:0x94989c}),i=new fe({map:e.map,normalMap:e.norm,normalScale:new ct(.45,.45),roughnessMap:e.rough,roughness:.92,metalness:.08,color:0x6d7278}),s=new Jt;r.add(s);const o=Vf(9137),a=[];for(let c=0;c<34;c++){const l=c/34*Math.PI*2+o()*.3,h=62+o()*92,d=Math.cos(l)*h,u=Math.sin(l)*h,f=10+o()*16,m=10+o()*16,v=12+o()*34,p=ge(d,u)-1,g=new Lt(new _e(f,v,m),o()>.5?n:i);g.position.set(d,p+v/2,u),g.rotation.y=o()*.6-.3,g.castShadow=!0,g.receiveShadow=!0,s.add(g);for(let _=0;_<3;_++){const x=f*(.25+o()*.4),y=2+o()*5,R=new Lt(new _e(x,y,m*(.3+o()*.5)),vConcreteMaterial());R.position.set(d+(o()-.5)*f*.7,p+v+y/2-.4,u+(o()-.5)*m*.7),R.rotation.y=o()*1.2,R.castShadow=!0,s.add(R)}for(let _=0;_<4;_++){
   const x=1.2+o()*2.6,grp=new Jt,y=new Lt(new _e(x,x*.7,x*1.3),vConcreteMaterial()),
         px=d+(o()-.5)*(f+8),pz=u+(o()-.5)*(m+8),rx=o(),ry=o(),rz=o();
   y.rotation.set(rx,ry*3,rz),y.castShadow=!0,y.receiveShadow=!0,grp.add(y);
   const bb=VCH_bounds(grp);
   VCH_place(grp,px,pz,bb.hx,bb.hz,ry*3,bb.bottom),s.add(grp);
  }a.push({x:d,z:u,w:f,d:m,h:v})}return{group:s,buildings:a}}function Vf(r){return function(){r|=0,r=r+1831565813|0;let t=Math.imul(r^r>>>15,1|r);return t=t+Math.imul(t^t>>>7,61|t)^t,((t^t>>>14)>>>0)/4294967296}}function Yw(){return vConcreteMaterial()}function jw(){return vCrateMaterial()}function Kw(){return vRustMaterial()}/*
  Физическое тело держим собранным (стабильные контакты, без дребезга);
  отрисованный корпус собирается отдельно из рыскания и пружинной позы подвески.
 */
const VCH_UP2=new P(0,1,0),VCH_tiltE=new Bn(0,0,0,"YXZ"),VCH_tiltQ=new gn(),
      VCH_yawQ=new gn(),VCH_poseQ=new gn(),VCH_tFwd=new w;
/*
  Ощущение стабилизатора: настоящий не может заморозить башню в момент выстрела.
  VCH_STAB_GAIN — какая доля качки корпуса компенсируется (0 — башня едет вместе
  с корпусом, 1 — прежнее поведение, башня заморожена в мировых координатах);
  VCH_STAB_TAU — за сколько секунд прицел возвращается в покой.
 */
const VCH_STAB_GAIN=.50,VCH_STAB_TAU=.13,
      VCH_stabTarget=new gn(),VCH_stabTmp=new gn(),VCH_stabId=new gn();
function VCH_hullYaw(v=Ce){
 v.body.quaternion.vmult(new w(0,0,1),VCH_tFwd),VCH_tFwd.y=0;
 VCH_tFwd.lengthSquared()<1e-6?VCH_tFwd.set(0,0,1):VCH_tFwd.normalize();
 return Math.atan2(VCH_tFwd.x,VCH_tFwd.z);
}
/* Видимый корпус: только рыскание плюс артикулированные дифферент и крен. Никакого дребезга твёрдого тела. */
function VCH_visualTilt(v=Ce){
 VCH_tiltE.set(v.artP||0,0,v.artR||0,"YXZ"),VCH_tiltQ.setFromEuler(VCH_tiltE);
 VCH_yawQ.setFromAxisAngle(VCH_UP2,VCH_hullYaw(v));
 return VCH_poseQ.copy(VCH_yawQ).multiply(VCH_tiltQ);
}
/*
  Направленная качка отката, приложенная ниже трансформа корпуса, чтобы зонды
  катков видели тот же дифферент и крен, что и отрисованное шасси.
 */
 function VCH_recoilPose(dt,v=Ce,rg=qt){
  const p=(v.recP||0)+(v.recP2||0)+(v.impP||0),r=(v.recR||0)+(v.recR2||0)+(v.impR||0),ch=rg.chassis;
  if(ch){ch.rotation.x=p;ch.rotation.z=r;}
  else{p&&rg.group.rotateX(p);r&&rg.group.rotateZ(r);}
  const st=rg.turretStab;
  if(st){
   const h=Te.clamp(dt>0?dt:1/60,.001,.05);
   if(J.stabilizer&&ch&&(p||r))
     VCH_stabTarget.copy(VCH_stabId).slerp(VCH_stabTmp.copy(ch.quaternion).invert(),VCH_STAB_GAIN);
   else VCH_stabTarget.copy(VCH_stabId);
   st.quaternion.slerp(VCH_stabTarget,1-Math.exp(-h/VCH_STAB_TAU));
  }
 }
/* Стабилизатор только для физики: невидимый, поэтому может быть жёстким, не выглядя деревянным. */
function VCH_stabilizeBody(dt,v=Ce){
 const b=v.body;if(!b)return;
 let nx=0,nz=0;
 if(v.normalAt){const nr=v.normalAt(b.position.x,b.position.z);
  nx=Te.clamp(nr.x*.35,-.06,.06),nz=Te.clamp(nr.z*.35,-.06,.06);}
 const qT=new gn().setFromUnitVectors(VCH_UP2,new P(nx,1,nz).normalize()),
       qY=new gn().setFromAxisAngle(VCH_UP2,VCH_hullYaw(v)),
       q=qT.multiply(qY),cur=new gn(b.quaternion.x,b.quaternion.y,b.quaternion.z,b.quaternion.w);
 cur.dot(q)<0&&q.set(-q.x,-q.y,-q.z,-q.w);
 cur.slerp(q,Math.min(1,dt*7)),
 b.quaternion.set(cur.x,cur.y,cur.z,cur.w),
 b.angularVelocity.x*=.6,b.angularVelocity.z*=.6,b.aabbNeedsUpdate=!0;
}
