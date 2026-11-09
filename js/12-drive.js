/* ==========================================================================
   vch36 · js/12-drive.js
   HUD приборов, прицел, вождение
   Из index.html (4.2 «разбиение на модули»). Порядок загрузки задан в index.html
   тегами <script defer>; «use strict» сохранён — исходный код был модулем.
   ========================================================================== */
"use strict";

/* ============================================================================
   1.1  HUD: спидометр, тахометр, передача, прицел с зумом, авиагоризонт, карта
   ============================================================================
   Все приборы рисуются в двух 2D-canvas (приборы + мини-карта) и обновляются
   через vFrame(), т.е. на том же кадре, что и сцена. Числа берём из тех же
   источников, что и физика: Ce.forwardSpeed / Ce.input / an.rpm.
   ------------------------------------------------------------------------- */
const VCH_HUD={
  el:{},acc:0,mmAcc:0,rpm:0,gear:"Н",mmRange:120,
  init(){
    const q=x=>document.querySelector(x);
    this.el={
      dials:q("#dials"),minimap:q("#minimap"),gear:q("#gearval"),
      zoom:q("#zoomread"),cross:q("#crosshair"),
      rp:q("#rangepanel"),rscore:q("#rscore"),rtime:q("#rtime"),
      rleft:q("#rleft"),racc:q("#racc")
    };
    /* стабилизатор и окраска переезжают в правый стек (CSS делает их static) */
    const rb=document.querySelector(".right-badges");
    if(rb)for(const id of["stabilizer","liverybadge"]){
      const el=document.getElementById(id);
      if(el&&el.parentElement!==rb)rb.appendChild(el);
    }
    this.dctx=this.el.dials?this.el.dials.getContext("2d"):null;
    this.mctx=this.el.minimap?this.el.minimap.getContext("2d"):null;
  },
  tick(dt){
    if(!J.started)return;
    /* --- обороты: сглаженная нагрузка двигателя из звукового тракта --- */
    const load=an&&typeof an.rpm==="number"?an.rpm:0;
    this.rpm+=(load-this.rpm)*Math.min(1,dt*4.5);
    const rpm=620+this.rpm*1760;
    /* --- передача --- */
    const v=Ce.forwardSpeed||0;
    const gear=v>.4?"П":v<-.4?"З":"Н";
    if(gear!==this.gear){
      this.gear=gear;
      const g=this.el.gear;
      if(g){g.textContent=gear;g.className=gear==="П"?"fwd":gear==="З"?"rev":""}
    }
    /* --- приборы/карта: не чаще 20 и 8 раз в секунду --- */
    this.acc+=dt;this.mmAcc+=dt;
    if(this.acc>.05){this.acc=0;this.drawDials(Math.abs(v)*3.6,rpm)}
    if(this.mmAcc>.12){this.mmAcc=0;this.drawMap()}
    /* --- прицел: масштаб от зума, кратность в оптике --- */
    if(this.el.cross){
      const k=Te.clamp((J.cameraMode===2?(J.sightFov??15):J.zoom)/11.5,.55,2.4);
      this.el.cross.style.setProperty("--ch-scale",k.toFixed(2));
    }
    if(this.el.zoom){
      const scoped=J.cameraMode===2;
      this.el.zoom.classList.toggle("off",!scoped);
      if(scoped)this.el.zoom.textContent="×"+(55/(J.sightFov??15)).toFixed(1);
    }
  },
  /* один круглый прибор: дуга, риски, цифры, стрелка */
  dial(c,cx,cy,r,val,min,max,label,ticks,redFrom){
    const A0=Math.PI*.75,A1=Math.PI*2.25;
    c.save();
    c.beginPath();c.arc(cx,cy,r,0,Math.PI*2);
    c.fillStyle="rgba(9,13,17,.62)";c.fill();
    c.strokeStyle="rgba(140,170,195,.22)";c.lineWidth=1;c.stroke();
    /* красная зона */
    if(redFrom!=null){
      const t=(redFrom-min)/(max-min);
      c.beginPath();c.arc(cx,cy,r-2,A0+(A1-A0)*t,A1);
      c.strokeStyle="rgba(220,70,50,.55)";c.lineWidth=3;c.stroke();
    }
    /* риски и подписи */
    c.strokeStyle="rgba(190,210,225,.45)";c.fillStyle="rgba(190,210,225,.65)";
    c.font="8px Roboto Condensed, Arial Narrow, sans-serif";c.textAlign="center";c.textBaseline="middle";
    for(const t of ticks){
      const a=A0+(A1-A0)*(t-min)/(max-min);
      const c1=Math.cos(a),s1=Math.sin(a);
      c.beginPath();c.moveTo(cx+c1*(r-6),cy+s1*(r-6));c.lineTo(cx+c1*(r-12),cy+s1*(r-12));
      c.lineWidth=1;c.stroke();
      c.fillText(String(t),cx+c1*(r-21),cy+s1*(r-21));
    }
    /* стрелка */
    const tv=Te.clamp((val-min)/(max-min),0,1),a=A0+(A1-A0)*tv;
    c.beginPath();c.moveTo(cx+Math.cos(a+2.4)*5,cy+Math.sin(a+2.4)*5);
    c.lineTo(cx+Math.cos(a)*(r-14),cy+Math.sin(a)*(r-14));
    c.lineTo(cx+Math.cos(a-2.4)*5,cy+Math.sin(a-2.4)*5);
    c.closePath();c.fillStyle="#ffb45c";c.fill();
    c.beginPath();c.arc(cx,cy,3.2,0,Math.PI*2);c.fillStyle="#ffd9a3";c.fill();
    c.fillStyle="rgba(160,182,198,.85)";c.font="7.5px Roboto Condensed, Arial Narrow, sans-serif";
    c.fillText(label,cx,cy+r-4);
    c.restore();
  },
  drawDials(spd,rpm){
    const c=this.dctx;if(!c)return;
    const W=c.canvas.width,H=c.canvas.height;
    c.clearRect(0,0,W,H);
    const r=Math.min(W*.23,H*.42);
    this.dial(c,W*.27,H*.47,r,spd,0,60,"КМ/Ч",[0,20,40,60],55);
    this.dial(c,W*.73,H*.47,r,rpm,600,2600,"ОБ/МИН",[600,1400,2200,2600],2200);
    /* цифровой дубль под стрелкой */
    c.fillStyle="#eef4f8";c.textAlign="center";
    c.font="700 15px Roboto Condensed, Arial Narrow, sans-serif";
    c.fillText(String(Math.round(spd)),W*.27,H*.47+r+11);
    c.fillText(String(Math.round(rpm/10)*10),W*.73,H*.47+r+11);
  },
  /* мини-карта: танк в центре, карта вращается по курсу */
  drawMap(){
    const c=this.mctx;if(!c)return;
    const W=c.canvas.width,H=c.canvas.height,cx=W/2,cy=H/2,R=Math.min(W,H)/2-4;
    const scale=R/this.mmRange,K=cx/R;
    c.clearRect(0,0,W,H);
    c.save();c.beginPath();c.arc(cx,cy,R,0,Math.PI*2);c.clip();
    c.fillStyle="rgba(6,10,14,.55)";c.fillRect(0,0,W,H);
    const q=qt.group.quaternion,p=qt.group.position,
          f=new P(0,0,1).applyQuaternion(q),rt=new P(1,0,0).applyQuaternion(q);
    const toMap=(x,z)=>{
      const dx=x-p.x,dz=z-p.z;
      const u=dx*rt.x+dz*rt.z,v=dx*f.x+dz*f.z;
      return [cx+u*scale,cy-v*scale];
    };
    /* сетка 40 м */
    c.strokeStyle="rgba(120,160,190,.12)";c.lineWidth=1;
    const step=40*scale;
    const ox=((p.x*0)%step+step)%step;
    for(let gx=cx%step;gx<W;gx+=step){c.beginPath();c.moveTo(gx,0);c.lineTo(gx,H);c.stroke()}
    for(let gy=cy%step;gy<H;gy+=step){c.beginPath();c.moveTo(0,gy);c.lineTo(W,gy);c.stroke()}
    /* объекты мира */
    for(const pr of ba){
      if(!pr||!pr.alive||!pr.mesh)continue;
      const [x,y]=toMap(pr.mesh.position.x,pr.mesh.position.z);
      if(x<-6||y<-6||x>W+6||y>H+6)continue;
      if(pr.isTarget){
        c.fillStyle="#ff6a4a";c.beginPath();
        c.moveTo(x,y-4);c.lineTo(x+4,y);c.lineTo(x,y+4);c.lineTo(x-4,y);c.closePath();c.fill();
      }else{
        c.fillStyle=pr.kind==="barrel"?"rgba(255,170,90,.75)":pr.kind==="car"?"rgba(150,200,255,.55)":"rgba(170,190,205,.4)";
        c.fillRect(x-1.5,y-1.5,3,3);
      }
    }
    /* 3.2: следующее воротное кольцо трассы */
    const TRK=window.__vchUI&&window.__vchUI.track;
    if(TRK&&TRK.on&&TRK.gates.length){
      const g2=TRK.nextPos();
      if(g2){
        const [gx,gy]=toMap(g2.x,g2.z);
        c.strokeStyle="#7cf7b0";c.lineWidth=2;
        c.beginPath();c.arc(gx,gy,5,0,Math.PI*2);c.stroke();
      }
    }
    c.restore();
    /* рамка */
    c.beginPath();c.arc(cx,cy,R,0,Math.PI*2);
    c.strokeStyle="rgba(120,160,190,.28)";c.lineWidth=1;c.stroke();
    /* танк */
    c.save();c.translate(cx,cy);
    c.beginPath();c.moveTo(0,-7);c.lineTo(5,6);c.lineTo(0,3);c.lineTo(-5,6);c.closePath();
    c.fillStyle="#ffb45c";c.fill();
    c.strokeStyle="rgba(0,0,0,.5)";c.lineWidth=.8;c.stroke();
    c.restore();
    /* север (карта повёрнута по курсу танка) */
    const nx=-f.z,nz=-f.x;             /* вектор «на север» в экранных осях */
    const ang=Math.atan2(nz,nx);
    c.save();c.translate(cx+Math.cos(ang)*(R-11),cy+Math.sin(ang)*(R-11));
    c.fillStyle="rgba(160,200,230,.85)";c.font="8px Roboto Condensed, sans-serif";
    c.textAlign="center";c.textBaseline="middle";c.fillText("С",0,0);
    c.restore();
  }
};
