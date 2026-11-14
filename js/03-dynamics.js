/* ==========================================================================
   vch36 · js/03-dynamics.js
   откат, стабилизатор, привязка корпуса к рельефу
   Из index.html (4.2 «разбиение на модули»). Порядок загрузки задан в index.html
   тегами <script defer>; «use strict» сохранён — исходный код был модулем.
   ========================================================================== */
"use strict";

/* ===== ОТКАТ: ПРУЖИНЫ КОРПУСА ==============================================
   Направление выстрела переводится в локальную систему корпуса, и только
   потом бьют пружины отката: вперёд/назад → дифферент, влево/вправо → крен,
   вверх/вниз → подброс по вертикали.
   Все параметры правятся на ходу из консоли: __tank.recoil.pitch / .roll / .heave.
   push   — импульс на 65-т корпус (Н·с); lever — высота линии выстрела (м)
   art    — угловой толчок в артикуляцию по рельефу (рад/с)
   pitch  — толчок пружины дифферента на единицу наведения вперёд/назад (рад/с)
   roll   — толчок пружины крена на единицу наведения влево/вправо (рад/с)
   heave  — толчок вертикальной пружины на единицу наведения вверх/вниз (м/с)
   pk/pd, rk/rd, hk/hd — жёсткость / демпфирование (дифферент, крен, подброс)
   pMax/rMax — ограничители угла (рад); yMin/yMax — ограничители хода по Y (м)
   ========================================================================== */
const VCH_RECOIL={push:34e3,lever:.55,art:0.85,
 /*
  быстрый режим: корпус качается на торсионах. Демпфирование слабое, поэтому он
  делает два-три качка, а не защёлкивается сразу в покой.
 */
 pitch:.80,roll:1.05,heave:.72,
 pk:46,pd:4.40,rk:46,rd:4.40,hk:62,hd:4.30,
 /*
  медленный режим: тот же 65-тонный корпус ещё долго успокаивается на пружинах
  после первого отскока — именно этот длинный хвост и читается как масса.
 */
 pitch2:.42,roll2:.55,
 p2k:10.4,p2d:3.40,r2k:10.4,r2d:3.40,
 /*
  механизм отката примерно через 0.3 с возвращается в накат и толкает корпус
  второй раз, в обратную сторону.
 */
 counterDelay:.30,counterGain:.28,
 pMax:.115,rMax:.155,yMin:-.115,yMax:.055,
 /*
  после выстрела траки на мгновение «отпускают» бок, поэтому корпус
  действительно сносит в сторону от выстрела, а не только прокачивает назад
 */
 slipTime:.42,slipGrip:.12};
class Vw{
constructor(t,{mass:e=65e3,position:n=new w(0,1.4,0),heightAt:i=null,normalAt:s=null,wheelZ:zZ=null,wheelX:zX=null,wheelY:zY=-.22,shapeHalf:zS=null,settings:zT=null}={}){
 this.world=t,this.heightAt=i,this.normalAt=s;
 const o=new jr("tank");
 this.body=new Et({mass:e,material:o,position:n.clone(),linearDamping:.06,angularDamping:.34,allowSleep:!1});
 this.body.collisionFilterGroup=Bw,this.body.collisionFilterMask=is|kw|Bw;
 const HS=zS||[[1.55,.60,3.20],[1.05,.44,1.60]];
 this.body.addShape(new ns(new w(HS[0][0],HS[0][1],HS[0][2])),new w(0,-.02,0));
 HS[1]&&this.body.addShape(new ns(new w(HS[1][0],HS[1][1],HS[1][2])),new w(0,1.12,-.20));
 t.addBody(this.body);
 this.settings=Object.assign({restLength:.95,wheelRadius:.34,stiffness:158e3,damping:52e3,
   maxSpeed:15.5,maxReverse:7.5,accel:5.6,reverseAccel:3.0,
   rollK:3.0e5,rollD:2.2e5,rollDead:.012,yawGain:11,yawMax:18},zT||{});
 const a=zZ||[2.4,1.44,.48,-.48,-1.44,-2.4],c=zX||[-1.36,1.36];
 this.wheels=[];
 for(const l of c)for(const h of a)this.wheels.push({local:new w(l,zY,h),side:l<0?-1:1,contact:!1,compression:0,normalForce:0,slip:0});
 this._rayFrom=new w,this._rayTo=new w,this._down=new w,this._fwd=new w,this._right=new w,
 this._vel=new w,this._force=new w,this._ray=new Ui,this._probeRay=new Ui,
 this._probeFrom=new w,this._probeTo=new w,this._relPoint=new w,
 this._tmpA=new w,this._tmpB=new w,this._up=new w(0,1,0),this._curUp=new w,
 this._desUp=new w,this._axis=new w,this._fwdLocal=new w(0,0,1);
 this.speedL=0,this.speedR=0,this.forwardSpeed=0,this.yawRate=0,
 this.input={throttle:0,steer:0},this._prevYaw=0,this.offGround=0,this.airborne=!1,
 this._q=new gn,this._e=new Bn,this.pitch=0,this.roll=0,
 this.artP=0,this.artR=0,this.artPV=0,this.artRV=0,
  /* направленные пружины отката (дифферент, крен, подброс) */
  this.recP=0,this.recPV=0,this.recR=0,this.recRV=0,this.recY=0,this.recYV=0,
  /* медленный тяжёлый режим пружин: длинная качка, которая идёт после первого толчка */
  this.recP2=0,this.recPV2=0,this.recR2=0,this.recRV2=0,
  /* отложенный толчок наката (орудие возвращается в накат) */
  this.cntT=0,this.cntP=0,this.cntR=0,this.cntY=0,
  /* таймер срыва траков: >0, пока корпусу разрешено скользить боком */
  this.slip=0,
  /*
  канал удара при приземлении: видимая просадка плюс клевок носом и угловая
  скорость, с которой корпус входит в грунт (см. VCH_LAND_*)
 */
  this.impY=0,this.impYV=0,this.impP=0,this.impPV=0,this.impR=0,this.impRV=0,
  this.landT=-1,this.airVy=0,this.susBoost=0;
}
setInput(t,e){this.input.throttle=Te.clamp(t,-1,1),this.input.steer=Te.clamp(e,-1,1)}
applyRecoilImpulse(t,e=1){
 const R=VCH_RECOIL,
       dir=new P(t.x,t.y,t.z).normalize(),
       invHullQ=new gn(this.body.quaternion.x,this.body.quaternion.y,this.body.quaternion.z,this.body.quaternion.w).invert(),
       localDir=dir.clone().applyQuaternion(invHullQ),
       lat=Te.clamp(localDir.x,-1,1),     /* + right, - left  */
       fwd=Te.clamp(localDir.z,-1,1),     /* + ahead, - behind */
       up=Te.clamp(localDir.y,-1,1),      /* + up, - down */
       /*
  Кривая отклика: выстрел всего в ~20° от оси всё равно заметно кренит корпус, а
  выстрел строго в борт остаётся на полной силе.
 */
       latK=Math.sign(lat)*Math.pow(Math.abs(lat),.80),
       fwdK=Math.sign(fwd)*Math.pow(Math.abs(fwd),.80),
       i=new w(-dir.x,-dir.y,-dir.z).scale(R.push*e),s=new w(0,R.lever*e,0);
 /*
  Раскладываем вектор выстрела по осям корпуса, чтобы реакция шла за ОРУДИЕМ, а
  не за корпусом: вперёд/назад — дифферент, влево/вправо — крен, возвышение —
  насколько сильно корпус вбивает в катки.
 */
 this.body.applyImpulse(i,s),
 this.artPV-=R.art*fwdK*e,
 this.artRV+=R.art*latK*e,
 /*
  толкаем оба режима пружин: лёгкий качается быстро, тяжёлый держит успокоение,
  поэтому корпус продолжает «дышать» после первого отскока
 */
 this.recPV-=R.pitch*fwdK*e,
 this.recRV+=R.roll*latK*e,
 this.recYV-=R.heave*(.80+.40*Math.max(0,up))*e,
 this.recPV2-=R.pitch2*fwdK*e,
 this.recRV2+=R.roll2*latK*e,
 /*
  Выстрел в борт сносит корпус боком: траки на миг теряют поперечное сцепление,
  иначе сила сцепления съедает весь боковой импульс и любой выстрел, как ни
  целься, только толкает танк ровно назад.
 */
 this.slip=R.slipTime*e*(.30+.70*Math.abs(lat)),
 /*
  Взводим толчок наката: ствол выходит из отката и через долю секунды бьёт в
  накат, толкая корпус в другую сторону.
 */
 this.cntT=R.counterDelay,
 this.cntP=R.pitch*R.counterGain*fwdK*e,
 this.cntR=-R.roll*R.counterGain*latK*e,
 this.cntY=R.heave*R.counterGain*.70*e;
}
update(t,e){
 const n=this.settings,i=this.body,dt=t>0?t:1/60,mass=i.mass;
 i.quaternion.vmult(this._fwdLocal,this._fwd),this._fwd.y=0;
 this._fwd.lengthSquared()<1e-6?this._fwd.set(0,0,1):this._fwd.normalize();
 this._right.set(this._fwd.z,0,-this._fwd.x);
 const {throttle:s,steer:o}=this.input;
 let Fz=0,contacts=0,f=0,m=0,d=0,u=0,propN=0,frontC=0,rearC=0,
     frontY=0,frontN=0,frontZ=0,rearY=0,rearN=0,rearZ=0,
     leftY=0,leftN=0,leftX=0,rightY=0,rightN=0,rightX=0;
 const vy=i.velocity.y,R=n.restLength+n.wheelRadius,invDt=1/(dt>0?dt:1/60);
 /*
  ---- КРОМКА = f(СКОРОСТИ) ------------------------------------------------ На
  малой скорости, подползая к гребню, корпус обязан ПЕРЕКАЧИТЬСЯ через край:
  передние катки выходят на пустоту, опорная плоскость клюёт носом, и корпус
  идёт за ней через кромку. На 40 км/ч это выглядело неправильно — танк должен
  СЛЕТАТЬ с кромки. Поэтому члены «перекачки» гаснут со скоростью, и после
  отрыва траков корпус сохраняет то положение, с которым покинул рампу
  (свободный полёт), вместо того чтобы догонять землю под собой. VCH_EDGE_LO/HI
  — диапазон скоростей (м/с), в котором происходит эта передача.
 */
/*
  после приземления подвеска на короткое время ужесточается, чтобы вертикальная
  скорость СРАЗУ превратилась в силу — 65-тонная машина останавливается за ~0.25
  с, а не продавливается вниз три четверти секунды
 */
const sK=n.stiffness*(1+this.susBoost*.55),
      sD=n.damping*(1+this.susBoost*1.0),
      spd=Math.abs(this.forwardSpeed||0),
      edgeK=Te.clamp((spd-VCH_EDGE_LO)/(VCH_EDGE_HI-VCH_EDGE_LO),0,1),
      seeSaw=1-edgeK*edgeK*(3-2*edgeK);
for(const y of this.wheels){
  i.quaternion.vmult(y.local,this._rayFrom),this._rayFrom.vadd(i.position,this._rayFrom);
  this._down.set(0,-1,0),this._down.scale(R,this._tmpB);
  this._rayTo.copy(this._rayFrom).vadd(this._tmpB,this._rayTo);
  let A=1/0,T=!1,
      surfY=this.heightAt?this.heightAt(this._rayFrom.x,this._rayFrom.z):this._rayFrom.y-R;
  if(this.heightAt){
   const d0=this._rayFrom.y-surfY;
   if(d0<=R){A=d0,T=!0}
  }
  this._ray.reset();
  if(this.world.raycastClosest(this._rayFrom,this._rayTo,{collisionFilterMask:is|VCH_RAMP,skipBackfaces:!0},this._ray)){
   const py=this._rayFrom.y-this._ray.distance;if(py>surfY)surfY=py;
   if(this._ray.distance<A){A=this._ray.distance,T=!0}
  }
  /*
  Рампы живут в своей группе коллизий, поэтому этот дополнительный зонд дешёвый.
  Он стартует ВЫШЕ катков и ловит верх клина даже тогда, когда начало катка уже
  под поверхностью — иначе танк проваливается в крутую рампу, а корма как будто
  висит в воздухе.
 */
  this._probeFrom.set(this._rayFrom.x,this._rayFrom.y+4,this._rayFrom.z);
  this._probeTo.set(this._rayFrom.x,this._rayFrom.y-4,this._rayFrom.z);
  this._probeRay.reset();
  if(this.world.raycastClosest(this._probeFrom,this._probeTo,
     {collisionFilterMask:VCH_RAMP,skipBackfaces:!1},this._probeRay)){
   const ry=this._probeRay.hitPointWorld.y;if(ry>surfY)surfY=ry;
  }
  const dSurf=this._rayFrom.y-surfY;
  if(dSurf<=R&&dSurf<A){A=dSurf,T=!0}
  /*
  ПЕРЕКАЧКА: видимый корпус подгоняется к поверхности под ВСЕМИ катками, а не
  только под теми, что ещё в пределах хода подвески. Как только передние катки
  проходят край рампы, высота поверхности под ними падает, и опорная плоскость —
  а с ней и корпус — проворачивается носом вниз через гребень, вместо того чтобы
  сползти вниз плашмя.
 */
  const wgt=T?1:.7*seeSaw;
  y.local.z>0?(frontY+=surfY*wgt,frontN+=wgt,frontZ+=y.local.z*wgt)
             :(rearY+=surfY*wgt,rearN+=wgt,rearZ+=y.local.z*wgt);
  y.local.x>0?(rightY+=surfY*wgt,rightN+=wgt,rightX+=y.local.x*wgt)
             :(leftY+=surfY*wgt,leftN+=wgt,leftX+=y.local.x*wgt);
  if(!T){y.contact=!1,y.compression=0,y.normalForce=0,y.lastCy=void 0;continue}
  y.contact=!0,contacts++;
  y.local.z>0?frontC++:rearC++;
  const cy=this._rayFrom.y-A;
  /*
  Вертикальная скорость поверхности под этим катком (рельеф И пропсы).
  Демпфирование тела, которое просто следует за поднимающимся склоном, тормозило
  подъём и давало корпусу тонуть в горке. Гасить можно только движение
  ОТНОСИТЕЛЬНО поверхности, поэтому приземление по-прежнему получает твёрдый
  тяжёлый удар.
 */
  const gv=y.lastCy===void 0?0:Te.clamp((cy-y.lastCy)*invDt,-18,18);
  y.lastCy=cy;
  const relVy=vy-gv;
  const z=R-A;y.compression=z;
  if(z>0){const k=Te.clamp(sK*z-sD*relVy,0,n.stiffness*R*4);y.normalForce=k,Fz+=k}
  if(this.heightAt&&cy-this.heightAt(this._rayFrom.x,this._rayFrom.z)>.15)propN++;
  i.getVelocityAtWorldPoint(this._rayFrom,this._vel);
  const Z=this._vel.dot(this._fwd);
  y.side<0?(f+=Z,d++):(m+=Z,u++),y.slip=Math.abs(this._vel.dot(this._right));
 }
 contacts>0?this.offGround=0:this.offGround+=dt;
 this.airborne=this.offGround>.12;
 this.speedL=d?f/d:0,this.speedR=u?m/u:0;
 const grip=Te.clamp(contacts/6,0,1),vF=i.velocity.dot(this._fwd),vLat=i.velocity.dot(this._right);
 this.forwardSpeed=vF;
 /*
  Опора, тяга, сцепление и рыскание действуют через центр масс: контакты
  остаются спокойными и не могут звенеть. Масса и инерция берутся из силы, а не
  из сервопривода.
 */
 this._force.set(0,Fz,0),i.applyForce(this._force);
 const resist=n.accel/n.maxSpeed+.60*(1-Math.min(1,Math.abs(s)*3)),
       want=(s>=0?s*n.accel:s*n.reverseAccel)-resist*vF,
       acc=Te.clamp(want,-5.5,5.5)*grip;
 this._fwd.scale(mass*acc,this._force),i.applyForce(this._force);
 this.slip>0&&(this.slip=Math.max(0,this.slip-dt)),
 this._right.scale(-vLat*mass*.86*grip*(this.slip>0?VCH_RECOIL.slipGrip:1),this._force),i.applyImpulse(this._force);
 const vAbs=Math.min(1,Math.abs(vF)/n.maxSpeed),maxYaw=1.25-.5*vAbs,
       tgtYaw=-o*maxYaw*(.35+.65*grip);
 i.applyTorque(new w(0,Te.clamp((tgtYaw-i.angularVelocity.y)*mass*n.yawGain,-mass*n.yawMax,mass*n.yawMax),0));
 /*
  Пружина выравнивания с постоянным усилением и мёртвой зоной: физический корпус
  остаётся собранным, а весь видимый характер несёт артикуляция под ним.
 */
 this._desUp.set(0,1,0);
 if(this.normalAt&&grip>0){
  const nr=this.normalAt(i.position.x,i.position.z);
  this._desUp.set(Te.clamp(nr.x*.55,-.10,.10),1,Te.clamp(nr.z*.55,-.10,.10)).normalize();
 }
 i.quaternion.vmult(this._up,this._curUp),this._curUp.cross(this._desUp,this._axis);
 const mag=this._axis.length(),excess=Math.max(0,mag-n.rollDead);
 if(mag>1e-6)this._axis.scale(excess/mag,this._axis);
 i.torque.x+=this._axis.x*n.rollK-i.angularVelocity.x*n.rollD;
 i.torque.z+=this._axis.z*n.rollK-i.angularVelocity.z*n.rollD;
 const av=i.angularVelocity;
 av.x=Te.clamp(av.x,-2,2),av.z=Te.clamp(av.z,-2,2),av.length()>5&&av.scale(5/av.length(),av);
 /*
  ---- КОРПУС СЛЕДУЕТ ЗА РЕЛЬЕФОМ ---- Основной источник — нормаль рельефа,
  переведённая в систему корпуса. Контакты катков лишь уточняют её на рампах и
  пропсах (там, где heightAt ничего не видит), а члены маневрирования добавляют
  сверху приседание, клевок и крен наружу. ----
 */
 let tp=0,tr=0;
 if(this.normalAt){
  const nr=this.normalAt(i.position.x,i.position.z),
        lx=nr.x*this._fwd.z-nr.z*this._fwd.x,
        lz=nr.x*this._fwd.x+nr.z*this._fwd.z,
        ly=Math.max(.3,nr.y);
  tp=Math.atan2(lz,ly),tr=Math.atan2(-lx,ly);
 }
 /*
  Рампы и пропсы уточняют позу только там, где сам рельеф почти плоский; на
  настоящем склоне нормаль должна выигрывать, иначе зонды катков, вылетевшие за
  пределы, тянули бы корпус обратно к горизонтали.
 */
 const flat=Math.max(0,1-Math.hypot(tp,tr)/.15),
       cpP=frontN&&rearN?-(frontY/frontN-rearY/rearN)/Math.max(.8,frontZ/frontN-rearZ/rearN):tp,
       cpR=rightN&&leftN?(rightY/rightN-leftY/leftN)/Math.max(.8,rightX/rightN-leftX/leftN):tr,
       dev=Math.hypot(cpP-tp,cpR-tr),
       probeW=Math.max(flat,Te.clamp(propN/6,0,1),Te.clamp(dev/.20,0,1));
 if(frontN&&rearN)tp+=probeW*Te.clamp(cpP-tp,-.36,.36);
 if(rightN&&leftN)tr+=probeW*Te.clamp(cpR-tr,-.36,.36);
 /*
  Перевес через настоящую кромку: только когда потеряла контакт ЦЕЛАЯ группа
  катков одной оси. Ограничитель по probeW, чтобы крутые естественные склоны
  сохраняли позу по нормали рельефа.
 */
 const lossF=frontC===0&&rearC>0?1:0,
       lossR=rearC===0&&frontC>0?1:0;
 tp+=Te.clamp(propN/6,0,1)*(lossF-lossR)*.18*seeSaw;
 tp+=Te.clamp(-acc*.008,-.038,.038),tr+=Te.clamp(-o*vAbs*.070,-.070,.070);
 tp=Te.clamp(tp,-.60,.60),tr=Te.clamp(tr,-.60,.60);
 /*
  В воздухе: держим положение на отрыве и даём дуге быть чистой баллистикой.
  Нормаль рельефа под летящим корпусом бессмысленна, но старый код всё равно её
  догонял — именно из-за этого анимация прыжка щёлкала в горизонталь посреди
  полёта.
 */
 if(this.offGround>0){
  /*
  запоминаем положение в момент отрыва траков, чтобы поза отрыва уцелела первые
  кадры, а не была съедена пружиной
 */
  if(!this._wasAir){this._wasAir=!0,this.airAttP=this.artP,this.airAttR=this.artR,this.airT=0}
  this.airT=(this.airT||0)+dt,this.airVy=i.velocity.y;
  /*
  летим по дуге: нос догоняет угол траектории (набор высоты — нос вверх,
  снижение — нос вниз), а не висит горизонтально. Смешивание идёт по
  VCH_AIR_TAU, чтобы поза отрыва уцелела, а остаточная угловая скорость
  сохраняется — это и читается как «баллистика».
 */
  const vv=i.velocity,
        gamma=Te.clamp(Math.atan2(-vv.y,Math.max(3,Math.hypot(vv.x,vv.z)))*VCH_AIR_ALIGN,-.30,.30),
        kA=1-Math.exp(-this.airT/VCH_AIR_TAU);
  tp=Te.clamp(this.airAttP*(1-kA)+gamma*kA+this.artPV*VCH_AIR_HOLD,-.60,.60);
  tr=Te.clamp(this.airAttR+this.artRV*VCH_AIR_HOLD,-.60,.60);
 } else{
  if(this._wasAir){
   /*
  ---- КАСАНИЕ ---------------------------------------------- Дуга не
  заканчивается на контакте. Те траки, что первыми дошли до земли, принимают
  удар, корпус продолжает проворачиваться через них носом вниз, подвеска съедает
  вертикальную скорость и выбрасывает корпус обратно. Всё ниже управляется
  скоростью удара: мягкий съезд остаётся мягким, а прыжок на 50 км/ч
  действительно приземляется.
 */
   this._wasAir=!1,this.airT=0;
   const hit=Te.clamp(-this.airVy,0,16);
   this.landT=0;
   try{an.land(hit)}catch(e){}          /* 5.4: лязг приземления */
   this.impYV-=Math.min(hit*VCH_LAND_SQUASH,VCH_LAND_SQUASH_MAX);        /* squat  */
   /*
  Первыми бьют передние траки, поэтому корпус ими ПОДТАЛКИВАЕТСЯ НОСОМ ВВЕРХ,
  пока корма ещё падает, — знак, противоположный свободной дуге. Клевок носом
  вниз здесь и вбивал передний лист в землю.
 */
   this.impPV-=Math.min(hit*VCH_LAND_NOSE,VCH_LAND_NOSE_MAX);            /* nose lifts  */
   this.artPV-=Math.min(hit*VCH_LAND_KICK,VCH_LAND_KICK_MAX);            /* rock back   */
   this.recPV-=Math.min(hit*VCH_LAND_NOD,VCH_LAND_NOD_MAX);              /* long rock   */
   VCH_susK=1+3.4*Te.clamp(hit/6,0,1);                                   /* wheels snap up               */
   this.susBoost=Te.clamp(hit/6,0,1);                                    /* springs go hard               */
   if(hit>1.6&&typeof en!=="undefined"&&en){
    if(en.onShake)en.onShake(Te.clamp(hit*.030,0,.22));
    if(en.trackDust)for(let d=0;d<8;d++)
     en.trackDust(new P(i.position.x+(Math.random()-.5)*2.6,i.position.y-1.0,
                        i.position.z+(Math.random()-.5)*3.4),1,1.3);
   }
  }
  /*
  всё ещё перекатываемся через передние траки: отдаём позу опорной плоскости за
  VCH_LAND_TAU, а не щёлкаем в неё за один кадр
 */
  if(this.landT>=0){
   this.landT+=dt;
   const kL=1-Math.exp(-this.landT/VCH_LAND_TAU);
   if(kL<.995){
    tp=tp*kL+(this.airAttP+this.artPV*VCH_AIR_HOLD)*(1-kL);
    tr=tr*kL+(this.airAttR+this.artRV*VCH_AIR_HOLD)*(1-kL);
   } else this.landT=-1;
  }
 }
 const kS=90,kD=19;
 this.artPV+=((tp-this.artP)*kS-this.artPV*kD)*dt,this.artP+=this.artPV*dt;
 this.artRV+=((tr-this.artR)*kS-this.artRV*kD)*dt,this.artR+=this.artRV*dt;
 this.artP=Te.clamp(this.artP,-.62,.62),this.artR=Te.clamp(this.artR,-.62,.62);
 /*
  ---- направленная пружинная подвеска отката ---- Пружины дифферента, крена и
  подброса держим отдельно от артикуляции по рельефу; знаки пружин задаёт
  направление выстрела в applyRecoilImpulse().
 */
 if(this.cntT>0&&(this.cntT-=dt)<=0)
  this.recPV+=this.cntP,this.recRV+=this.cntR,this.recYV+=this.cntY,
  this.recPV2+=this.cntP*.55,this.recRV2+=this.cntR*.55;
 this.recPV+=(-VCH_RECOIL.pk*this.recP-VCH_RECOIL.pd*this.recPV)*dt,this.recP+=this.recPV*dt;
 this.recRV+=(-VCH_RECOIL.rk*this.recR-VCH_RECOIL.rd*this.recRV)*dt,this.recR+=this.recRV*dt;
 this.recYV+=(-VCH_RECOIL.hk*this.recY-VCH_RECOIL.hd*this.recYV)*dt,this.recY+=this.recYV*dt;
 this.recPV2+=(-VCH_RECOIL.p2k*this.recP2-VCH_RECOIL.p2d*this.recPV2)*dt,this.recP2+=this.recPV2*dt;
 this.recRV2+=(-VCH_RECOIL.r2k*this.recR2-VCH_RECOIL.r2d*this.recRV2)*dt,this.recR2+=this.recRV2*dt;
 if(this.recP>VCH_RECOIL.pMax||this.recP<-VCH_RECOIL.pMax)
  this.recP=Te.clamp(this.recP,-VCH_RECOIL.pMax,VCH_RECOIL.pMax),this.recPV*=-.35;
 if(this.recR>VCH_RECOIL.rMax||this.recR<-VCH_RECOIL.rMax)
  this.recR=Te.clamp(this.recR,-VCH_RECOIL.rMax,VCH_RECOIL.rMax),this.recRV*=-.35;
 if(this.recY>VCH_RECOIL.yMax||this.recY<VCH_RECOIL.yMin)
  this.recY=Te.clamp(this.recY,VCH_RECOIL.yMin,VCH_RECOIL.yMax),this.recYV*=-.35;
 /*
  пружины удара при приземлении: жёсткие и быстрые, поэтому просадка и клевок
  носом происходят за ~0.1 с, а откачиваются за ~0.3 с (один небольшой перелёт)
 */
 this.impYV+=(-VCH_IMPACT_KY*this.impY-VCH_IMPACT_DY*this.impYV)*dt,this.impY+=this.impYV*dt,
 this.impY=Te.clamp(this.impY,-VCH_IMPACT_YMAX,.038),
 this.impPV+=(-VCH_IMPACT_KP*this.impP-VCH_IMPACT_DP*this.impPV)*dt,this.impP+=this.impPV*dt,
 this.impP=Te.clamp(this.impP,-VCH_IMPACT_PMAX,VCH_IMPACT_PMAX),
 VCH_susK+= (1-VCH_susK)*Math.min(1,dt*7),
 this.susBoost*=Math.max(0,1-dt*4.2);
 const p2m=VCH_RECOIL.pMax*.55,r2m=VCH_RECOIL.rMax*.55;
 if(this.recP2>p2m||this.recP2<-p2m)
  this.recP2=Te.clamp(this.recP2,-p2m,p2m),this.recPV2*=-.30;
 if(this.recR2>r2m||this.recR2<-r2m)
  this.recR2=Te.clamp(this.recR2,-r2m,r2m),this.recRV2*=-.30;
 const g=Math.atan2(this._fwd.x,this._fwd.z);
 let _=g-this._prevYaw;_>Math.PI&&(_-=2*Math.PI),_<-Math.PI&&(_+=2*Math.PI);
 this.yawRate=dt>0?_/dt:0,this._prevYaw=g;
 this._q.set(i.quaternion.x,i.quaternion.y,i.quaternion.z,i.quaternion.w),
 this._e.setFromQuaternion(this._q,"YXZ"),this.pitch=this.artP,this.roll=this.artR;
}
}

/* ключ локации: ?map= в адресе, иначе сохранённый в меню выбор */
const _VCH_RAW_MAP=(new URLSearchParams(location.search).get("map")||(()=>{try{return localStorage.getItem("vch36.map")||"aleksandrovsk"}catch(e){return "aleksandrovsk"}})()).toLowerCase();
const VCH_MAP_KEY=(_VCH_RAW_MAP==="space"||_VCH_RAW_MAP==="nord"||_VCH_RAW_MAP==="aleksandrovsk")?_VCH_RAW_MAP:"aleksandrovsk";
const VCH_MAP=VCH_MAP_KEY==="space"?2:VCH_MAP_KEY==="nord"?5:4;
function ge(r,t){return VCH_MAP===5?VCH_NORD_h(r,t):VCH_MAP===4?VCH_ALEKS_h(r,t):VCH_sbH(r,t)}
function Hw(r,t,e=new P){const i=ge(r-.6,t),s=ge(r+.6,t),o=ge(r,t-.6),a=ge(r,t+.6);return e.set(i-s,2*.6,o-a).normalize()}function Gw(r){const t=new Sa(900,48,28),e=new $e({side:Ze,depthWrite:!1,dithering:!0,uniforms:vSkyUniforms(),vertexShader:V_SKY_VS,fragmentShader:V_SKY_FS}),n=new Lt(t,e);return n.frustumCulled=!1,r.add(n),V_sky=n,n}
