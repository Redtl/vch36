/* ==========================================================================
   vch36 · js/07-audio.js
   звуковой движок и сэмплы
   Из index.html (4.2 «разбиение на модули»). Порядок загрузки задан в index.html
   тегами <script defer>; «use strict» сохранён — исходный код был модулем.
   ========================================================================== */
"use strict";
/* ======================= ЗВУКОВЫЕ АССЕТЫ (встроены) =======================
   Пять PCM-сэмплов лежат base64-константами в js/07a-audio-pcm.js — ровно те
   строки, что были в присланном index (49).html. Движок собирает из них
   AudioBuffer синхронно в init(), поэтому звук не зависит ни от сети, ни от
   Service Worker, ни от протокола (http:// и file:// звучат одинаково).
   Файлы audio/*.wav оставлены как копия тех же байтов для справки/экспорта.  */
/* ============================================================================
   ЗВУК — ВЕРСИЯ ИЗ ПРИСЛАННОГО index (49).html
   ----------------------------------------------------------------------------
   Возвращён ровно тот тракт, что звучал в присланной сборке:
     • выстрел = «кик» 2.4 + сэмпл выстрела .66 (+0.11 с) + слой воздуха .25,
       все три через общую шину с хай-шелфом 2200 Гц/+7.5 дБ;
     • широкий стерео-хвост выстрела, посыл раскрывается к +3.45 с;
     • взрыв = референс через explIn: вес 220 Гц +7 дБ, хай-шелф 2500 Гц +5 дБ,
       параллельная ветвь с сатурацией и компрессией, плюс удар 62 Гц и два
       шумовых всплеска;
     • двигатель — только запись (синтезированный слой молчит), грунт — запись;
     • impact()/crush() — прежние общие: один отклик поверхности, без разбора
       материала; событийных звуков (гильза/приземление/скрип) нет.
   Сэмплы — те же байты (audio/*.wav собраны из тех же PCM-констант), поэтому
   звучание совпадает с присланной версией.
   Объект VCH_AUD оставлен ради UI/API (window.__vchUI.aud), но профиль один:
   переключать больше нечего.
   ========================================================================== */
const VCH_AUD={profile:"v49",label:"ЗВУК ИЗ ВЕРСИИ 49",prof:{label:"ЗВУК ИЗ ВЕРСИИ 49"},
  load(){return this},
  set(){return this.profile}
};
class e1{constructor(){this.ctx=null,this.started=!1,this.clankTimer=0,this.rpm=0}init(){if(this.started){this.ctx.state==="suspended"&&this.ctx.resume().catch(()=>{});return}const t=window.AudioContext||window.webkitAudioContext;if(!t)return;const e=new t;this.ctx=e,this.master=e.createGain(),this.master.gain.value=.49;const n=e.createDynamicsCompressor();n.threshold.value=-14,n.knee.value=22,n.ratio.value=5,n.attack.value=.004,n.release.value=.24,this.master.connect(n).connect(e.destination),this.reverb=e.createConvolver(),this.reverb.buffer=this._makeIR(2.4,2.6),this.reverbGain=e.createGain(),this.reverbGain.gain.value=.55,this.reverbIn=e.createGain(),this.reverbIn.gain.value=1,this.reverbIn.connect(this.reverb).connect(this.reverbGain).connect(this.master),this.echoIn=e.createGain(),this.echoIn.gain.value=1,this.echo=e.createDelay(1.5),this.echo.delayTime.value=.31;const i=e.createGain();i.gain.value=.36;const s=e.createBiquadFilter();s.type="lowpass",s.frequency.value=1500;const o=e.createGain();o.gain.value=.5,this.echoIn.connect(this.echo),this.echo.connect(s).connect(i).connect(this.echo),this.echo.connect(o).connect(this.master),this.echo.connect(this.reverbIn),this.engineGain=e.createGain(),this.engineGain.gain.value=0;const a=e.createWaveShaper();a.curve=this._softClip(1.8),a.oversample="2x",this.engineFilter=e.createBiquadFilter(),this.engineFilter.type="lowpass",this.engineFilter.frequency.value=300,this.engineFilter.Q.value=1.1,this.oscSub=e.createOscillator(),this.oscSub.type="sine",this.oscSub.frequency.value=24,this.oscMain=e.createOscillator(),this.oscMain.type="sawtooth",this.oscMain.frequency.value=48,this.oscHarm=e.createOscillator(),this.oscHarm.type="square",this.oscHarm.frequency.value=96;const c=e.createGain();c.gain.value=.75;this.subGain=c;const l=e.createGain();l.gain.value=.5;const h=e.createGain();h.gain.value=.14,this.oscSub.connect(c).connect(a),this.oscMain.connect(l).connect(a),this.oscHarm.connect(h).connect(a),a.connect(this.engineFilter).connect(this.engineGain).connect(this.master),this.lfo=e.createOscillator(),this.lfo.type="sine",this.lfo.frequency.value=13,this.lfoGain=e.createGain(),this.lfoGain.gain.value=.32,this.engineGain.gain.value=0,this.lfo.connect(this.lfoGain).connect(this.engineGain.gain),this.noiseBuf=this._makeNoise(2.2),this.exhaustFilter=e.createBiquadFilter(),this.exhaustFilter.type="bandpass",this.exhaustFilter.frequency.value=220,this.exhaustFilter.Q.value=.6,this.exhaustGain=e.createGain(),this.exhaustGain.gain.value=0;const d=e.createBufferSource();d.buffer=this.noiseBuf,d.loop=!0,d.connect(this.exhaustFilter).connect(this.exhaustGain).connect(this.master),d.start(),this.turboOsc=e.createOscillator(),this.turboOsc.type="triangle",this.turboOsc.frequency.value=700,this.turboGain=e.createGain(),this.turboGain.gain.value=0,this.turboOsc.connect(this.turboGain).connect(this.master),this.rumbleFilter=e.createBiquadFilter(),this.rumbleFilter.type="lowpass",this.rumbleFilter.frequency.value=260,this.rumbleGain=e.createGain(),this.rumbleGain.gain.value=0,this.oscSub.start(),this.oscMain.start(),this.oscHarm.start(),this.lfo.start(),this.turboOsc.start(),this.engineGain.disconnect(),this.exhaustGain.disconnect(),this.turboGain.disconnect(),this.lfoGain.disconnect(),this.engineLoopBuf=this._makeEngineLoop(),this.engineSrc=e.createBufferSource();this.engineSrc.buffer=this.engineLoopBuf;this.engineSrc.loop=!0;this.engineWeight=e.createBiquadFilter();this.engineWeight.type="lowshelf";this.engineWeight.frequency.value=120;this.engineWeight.gain.value=4;this.engineTone=e.createBiquadFilter();this.engineTone.type="lowpass";this.engineTone.frequency.value=2200;this.engineTone.Q.value=.7;this.engineLevel=e.createGain();this.engineLevel.gain.value=0;this.engineSrc.connect(this.engineWeight).connect(this.engineTone).connect(this.engineLevel).connect(this.master);this.engineSrc.start(),this.soilBuf=this._makeSoilLoop(),this.soilSrc=e.createBufferSource();this.soilSrc.buffer=this.soilBuf;this.soilSrc.loop=!0;this.soilLevel=e.createGain();this.soilLevel.gain.value=0;this.soilSrc.connect(this.soilLevel).connect(this.master);this.soilSrc.start(),this.shotBuffer=this._makeShotBuffer(),this.kickBuffer=this._makeKick(),this.explosionBuffer=this._makeExplosionSample(),this._initShotFX(e),this._initExplosionFX(e),this.started=!0,e.state==="suspended"&&e.resume().catch(()=>{})}_softClip(t=2){const n=new Float32Array(1024);for(let i=0;i<1024;i++){const s=i/1023*2-1;n[i]=Math.tanh(s*t)/Math.tanh(t)}return n}_makeNoise(t){const e=this.ctx,n=Math.floor(e.sampleRate*t),i=e.createBuffer(2,n,e.sampleRate);for(let s=0;s<2;s++){const o=i.getChannelData(s);for(let a=0;a<n;a++)o[a]=Math.random()*2-1}return i}_makeIR(t=2.4,e=2.6){const n=this.ctx,i=Math.floor(n.sampleRate*t),s=n.createBuffer(2,i,n.sampleRate);for(let o=0;o<2;o++){const a=s.getChannelData(o);for(let c=0;c<i;c++){const l=c/i;a[c]=(Math.random()*2-1)*Math.pow(1-l,e)}for(const[c,l]of[[37,.5],[83,.34],[141,.24],[219,.16]]){const h=Math.floor(n.sampleRate*c/1e3);h<i&&(a[h]+=(Math.random()>.5?1:-1)*l)}}return s}setEngine(t,e,n,i=1/60,s=null){
  if(!this.started)return;
  Number.isFinite(t)||(t=0),Number.isFinite(e)||(e=0);
  const o=this.ctx.currentTime,a=Math.min(Math.abs(t)/12,1),c=Math.min(Math.abs(e),1),l=Math.max(a*.75,c*.9);
  this.rpm+=(l-this.rpm)*Math.min(1,i*3.2);
  const h=this.rpm;
  /* Real tank-idle recording: looped sample, pitch/brightness/level follow load.
     Level calibrated by A-weighted loudness: the mid-heavy recording sits ~14 dB
     lower than the old synthetic engine so it stays a background layer. */
  this.engineSrc.playbackRate.setTargetAtTime(.98+h*.28+c*.05,o,.18);
  this.engineTone.frequency.setTargetAtTime(2200+h*900+c*150,o,.22);
  this.engineLevel.gain.setTargetAtTime(n?.16+h*.085+c*.02:0,o,.22);
  /* Ground/soil: the exact reference loop, heard only while the tracks move.
     Follows forward speed AND track speed (turning in place still moves soil). */
  const motion=Math.max(a,Math.min(Math.abs(s||0)/12,1));
  this.soilLevel.gain.setTargetAtTime(n?motion*1.2:0,o,.18);
  /* Legacy synthetic layers stay silent: no turbo whine, no track rumble. */
  this.engineGain.gain.value=0,this.exhaustGain.gain.value=0;
  this.turboGain.gain.value=0,this.rumbleGain.gain.value=0,this.clankTimer=0;
}_trackClank(t=.1,e=.5){return;const n=this.ctx,i=n.currentTime,s=n.createBufferSource();s.buffer=this.noiseBuf,s.playbackRate.value=1+Math.random()*.4;const o=Math.random()*1.5,a=n.createBiquadFilter();a.type="bandpass",a.frequency.value=1700+e*2200+Math.random()*500,a.Q.value=4+Math.random()*4;const c=n.createGain();c.gain.setValueAtTime(1e-4,i),c.gain.exponentialRampToValueAtTime(t,i+.004),c.gain.exponentialRampToValueAtTime(1e-4,i+.055+Math.random()*.03),s.connect(a).connect(c).connect(this.master),s.start(i,o,.1);const l=n.createOscillator();l.type="triangle",l.frequency.setValueAtTime(1400+Math.random()*1600,i);const h=n.createGain();h.gain.setValueAtTime(1e-4,i),h.gain.exponentialRampToValueAtTime(t*.45,i+.003),h.gain.exponentialRampToValueAtTime(1e-4,i+.05),l.connect(h).connect(this.master),l.start(i),l.stop(i+.07)}_noiseBurst({dur:t=.4,type:e="lowpass",freq:n=800,q:i=1,gain:s=.6,sweepTo:o=null,delay:a=0,send:c=0}){if(!this.started)return;const l=this.ctx,h=l.currentTime+a,d=l.createBufferSource();d.buffer=this.noiseBuf,d.loop=!0;const u=l.createBiquadFilter();u.type=e,u.frequency.setValueAtTime(n,h),o&&u.frequency.exponentialRampToValueAtTime(o,h+t),u.Q.value=i;const f=l.createGain();if(f.gain.setValueAtTime(1e-4,h),f.gain.exponentialRampToValueAtTime(s,h+.006),f.gain.exponentialRampToValueAtTime(1e-4,h+t),d.connect(u).connect(f),f.connect(this.master),c>0){const m=l.createGain();m.gain.value=c,f.connect(m).connect(this.reverbIn),f.connect(m).connect(this.echoIn)}d.start(h,Math.random()*1.5),d.stop(h+t+.08)}_thump({freq:t=90,dur:e=.5,gain:n=.8,delay:i=0,send:s=0,slideTo:o=.35}){if(!this.started)return;const a=this.ctx,c=a.currentTime+i,l=a.createOscillator();l.type="sine",l.frequency.setValueAtTime(t,c),l.frequency.exponentialRampToValueAtTime(t*o,c+e);const h=a.createGain();if(h.gain.setValueAtTime(1e-4,c),h.gain.exponentialRampToValueAtTime(n,c+.012),h.gain.exponentialRampToValueAtTime(1e-4,c+e),l.connect(h).connect(this.master),s>0){const d=a.createGain();d.gain.value=s,h.connect(d).connect(this.reverbIn)}l.start(c),l.stop(c+e+.03)}fire(){
  if(!this.started||!this.shotBuffer||!this.kickBuffer)return;
  const ctx=this.ctx;
  if(ctx.state==="suspended")ctx.resume().catch(()=>{});
  const t0=ctx.currentTime+.004;
  /* 1. Reference kick at the very front of the shot, before the cannon (+0.11 s).
        No EQ, saturation or parallel compression: the recording is already a
        hard-clipped, dense ~50 Hz hit. Only a calibrated level (2.4) and a tiny
        high-passed room send, so the low end never smears into reverb. */
  const kick=ctx.createBufferSource();kick.buffer=this.kickBuffer;
  const kickGain=ctx.createGain();kickGain.gain.value=2.4;
  const kickSend=ctx.createGain();kickSend.gain.value=.04;
  const kickSendHP=ctx.createBiquadFilter();kickSendHP.type="highpass";kickSendHP.frequency.value=250;
  kick.connect(kickGain).connect(this.shotBus);
  kickGain.connect(kickSend).connect(kickSendHP).connect(this.reverbIn);
  kick.onended=()=>{kick.disconnect();kickGain.disconnect();kickSend.disconnect();kickSendHP.disconnect()};
  kick.start(t0);
  /* 2. One isolated shot from the reference recording follows the kick.
        Its own attack lands at +0.11 s; the long rolling tail stays intact. */
  const source=ctx.createBufferSource();source.buffer=this.shotBuffer;
  const level=ctx.createGain();level.gain.value=.66;
  source.connect(level).connect(this.shotBus);
  source.onended=()=>{source.disconnect();level.disconnect()};
  source.start(t0+.11);
  /* 3. Bright air/crack across the whole shot, through the same high shelf. */
  const air=ctx.createBufferSource();air.buffer=this.shotAirBuffer;
  const airGain=ctx.createGain();airGain.gain.value=.25;
  air.connect(airGain).connect(this.shotBus);
  air.onended=()=>{air.disconnect();airGain.disconnect()};
  air.start(t0);
  /* 4. Wide stereo reverb stays restrained at the attack and opens up
        gradually, so the END of the shot is wide and spacious. */
  const send=this.shotVerbSend.gain;
  send.cancelScheduledValues(t0);
  send.setValueAtTime(.02,t0);
  send.linearRampToValueAtTime(.06,t0+.8);
  send.linearRampToValueAtTime(.72,t0+2.2);
  send.linearRampToValueAtTime(.85,t0+3.45);
}
_makeKick(){
  /* Exact 0.494 s stereo kick from the user's reference WAV (44100 Hz).
     The interleaved 16-bit samples are copied verbatim into the AudioBuffer;
     the only thing Web Audio may do is resample for the device rate. */
  const ctx=this.ctx,bin=atob(VCH_KICK_PCM),frames=bin.length>>2;
  const buffer=ctx.createBuffer(2,frames,44100),L=buffer.getChannelData(0),R=buffer.getChannelData(1);
  for(let i=0;i<frames;i++){
    let l=bin.charCodeAt(i<<2)|(bin.charCodeAt((i<<2)+1)<<8);
    let r=bin.charCodeAt((i<<2)+2)|(bin.charCodeAt((i<<2)+3)<<8);
    if(l>=32768)l-=65536;if(r>=32768)r-=65536;
    L[i]=l/32768;R[i]=r/32768;
  }
  return buffer;
}
_makeCannon(){
  // Self-contained stereo cannon report: sharp crack, short pressure pulse,
  // rolling body and quiet outdoor reflections. No tonal "laser" sweep.
  const ctx=this.ctx, rate=ctx.sampleRate, duration=2.2;
  const length=Math.ceil(rate*duration), dry=new Float32Array(length);
  const buffer=ctx.createBuffer(2,length,rate);
  const coefficient=hz=>1-Math.exp(-2*Math.PI*hz/rate);
  const bassCut=coefficient(160), subCut=coefficient(45);
  const bodyCut=coefficient(650), airCut=coefficient(3500), crackCut=coefficient(1900);
  const random=seed=>()=>{
    seed^=seed<<13;seed^=seed>>>17;seed^=seed<<5;
    return (seed>>>0)/2147483648-1;
  };
  const bassNoise=random(36125), sharedLow=bassNoise();
  let peak=0;
  for(let channel=0;channel<2;channel++){
    const airNoise=random(82721+channel*7919);
    let bass=sharedLow,sub=sharedLow,body=0,air=0,crack=0;
    for(let i=0;i<length;i++){
      const t=i/rate, low=bassNoise(), high=airNoise();
      bass+=bassCut*(low-bass);sub+=subCut*(low-sub);
      body+=bodyCut*(high-body);air+=airCut*(high-air);crack+=crackCut*(high-crack);
      const attack=1-Math.exp(-t/.0008);
      const snap=(air-crack)*Math.exp(-t/.018)*.48;
      const report=(air-body)*Math.exp(-t/.075)*.78;
      const pressure=(bass-sub)*Math.exp(-t/.16)*2.8;
      const phase=2*Math.PI*(52*t+22*.032*(1-Math.exp(-t/.032)));
      const pulse=Math.sin(phase)*Math.exp(-t/.12)*.24;
      const roll=(body-bass)*(1-Math.exp(-t/.025))*Math.exp(-t/.32)*1.15;
      dry[i]=(snap+report+pressure+pulse+roll)*attack;
    }
    const data=buffer.getChannelData(channel);
    const delays=[.069,.127,.221,.377,.613].map((v,i)=>Math.round((v+(channel?-.004:.004)*(i%2?1:-1))*rate));
    const gains=[.22,.13,.085,.052,.028], reflections=new Float32Array(5);
    const echoCut=coefficient(channel?1200:1400);
    let echo=0;
    for(let i=0;i<length;i++){
      let reflected=0;
      for(let j=0;j<delays.length;j++){
        const index=i-delays[j];
        reflections[j]=index>=0?dry[index]:0;
        reflected+=reflections[j]*gains[j];
      }
      echo+=echoCut*(reflected-echo);
      const fade=Math.min(1,(duration-i/rate)/.15);
      data[i]=(dry[i]+echo)*fade;
      peak=Math.max(peak,Math.abs(data[i]));
    }
  }
  // Common normalization preserves the stereo image and prevents clipping.
  const normalize=.88/Math.max(peak,1e-6);
  for(let channel=0;channel<2;channel++){
    const data=buffer.getChannelData(channel);
    for(let i=0;i<length;i++)data[i]*=normalize;
  }
  return buffer;
}_makeShotSample(){
  /* Decode the embedded reference cut into an AudioBuffer. Web Audio
     resamples the 22050 Hz buffer to the context rate on playback. */
  const ctx=this.ctx,bin=atob(VCH_SHOT_REF_PCM),len=bin.length>>1;
  const buffer=ctx.createBuffer(1,len,22050),data=buffer.getChannelData(0);
  for(let i=0;i<len;i++){
    let v=bin.charCodeAt(i<<1)|(bin.charCodeAt((i<<1)+1)<<8);
    if(v>=32768)v-=65536;
    data[i]=v/32768;
  }
  return buffer;
}
_makeShotBuffer(){
  try{return this._makeShotSample()}
  catch(err){console.warn("shot reference unavailable, using synthetic cannon",err);return this._makeCannon()}
}
_makeShotAir(){
  /* Short 0.55 s bright crack: band-limited noise 2.6-11 kHz with a fast
     decay. No long hiss tail - the shot's HF bite stays at the attack. */
  const ctx=this.ctx,rate=ctx.sampleRate,dur=.55,len=Math.ceil(rate*dur);
  const buffer=ctx.createBuffer(2,len,rate);
  const hp=1-Math.exp(-2*Math.PI*2600/rate),lp=1-Math.exp(-2*Math.PI*11000/rate);
  let peak=0;
  for(let ch=0;ch<2;ch++){
    const d=buffer.getChannelData(ch);
    let seed=51871+ch*7919;
    const rnd=()=>{seed^=seed<<13;seed^=seed>>>17;seed^=seed<<5;return(seed>>>0)/2147483648-1};
    let low=0,smooth=0;
    for(let i=0;i<len;i++){
      const t=i/rate,w=rnd();
      low+=hp*(w-low);
      smooth+=lp*((w-low)-smooth);
      const attack=1-Math.exp(-t/.0008);
      const env=.85*Math.exp(-t/.035)+.15*Math.exp(-t/.14);
      const fade=Math.min(1,(dur-t)/.08);d[i]=smooth*env*attack*fade;
      peak=Math.max(peak,Math.abs(d[i]));
    }
  }
  const norm=.9/Math.max(peak,1e-6);
  for(let ch=0;ch<2;ch++){const d=buffer.getChannelData(ch);for(let i=0;i<len;i++)d[i]*=norm}
  return buffer;
}
_makeWideIR(t=3.8,e=2.1){
  /* Long, decorrelated stereo IR: opposite-polarity, differently timed early
     reflections on each side => a noticeably wider reverb tail. */
  const n=this.ctx,i=Math.floor(n.sampleRate*t),s=n.createBuffer(2,i,n.sampleRate);
  for(let o=0;o<2;o++){
    const a=s.getChannelData(o);
    for(let c=0;c<i;c++){const l=c/i;a[c]=(Math.random()*2-1)*Math.pow(1-l,e)*.32}
    const taps=o?[31,61,103,171,263,409,631]:[23,53,89,149,239,383,607];
    const gains=[.62,.45,.34,.26,.19,.13,.09];
    for(let k=0;k<taps.length;k++){
      const h=Math.floor(n.sampleRate*taps[k]/1e3);
      if(h<i)a[h]+=gains[k]*(o===1?.92:-.92);
    }
  }
  return s;
}
_initShotFX(e){
  /* Dedicated shot bus: high shelf for the whole shot, plus a separate
     wide stereo reverb whose send opens up towards the END of the shot. */
  this.shotBus=e.createGain();this.shotBus.gain.value=.75;
  this.shotTone=e.createBiquadFilter();this.shotTone.type="highshelf";
  this.shotTone.frequency.value=2200;this.shotTone.gain.value=7.5;
  this.shotBus.connect(this.shotTone).connect(this.master);
  this.shotVerbSend=e.createGain();this.shotVerbSend.gain.value=0;
  this.shotTone.connect(this.shotVerbSend);
  this.shotWideVerb=e.createConvolver();this.shotWideVerb.buffer=this._makeWideIR(3.4,2.0);
  this.shotVerbSend.connect(this.shotWideVerb);
  const split=e.createChannelSplitter(2);
  this.shotWideVerb.connect(split);
  const dL=e.createDelay(.1),dR=e.createDelay(.1);
  dL.delayTime.value=.003;dR.delayTime.value=.021;
  const pL=e.createStereoPanner(),pR=e.createStereoPanner();
  pL.pan.value=-.95;pR.pan.value=.95;
  const wide=e.createGain();wide.gain.value=2.3;
  split.connect(dL,0);dL.connect(pL).connect(wide);
  split.connect(dR,1);dR.connect(pR).connect(wide);
  const wideTone=e.createBiquadFilter();wideTone.type="lowpass";
  wideTone.frequency.value=2400;wideTone.Q.value=.7;
  wide.connect(wideTone).connect(this.master);
  this.shotAirBuffer=this._makeShotAir();
}
_makeEngineLoop(){
  const ctx=this.ctx,bin=atob(VCH_ENGINE_PCM),frames=bin.length>>1;
  const buffer=ctx.createBuffer(1,frames,22050),data=buffer.getChannelData(0);
  for(let i=0;i<frames;i++){
    let v=bin.charCodeAt(i<<1)|(bin.charCodeAt((i<<1)+1)<<8);
    if(v>=32768)v-=65536;
    data[i]=v/32768;
  }
  return buffer;
}
_makeExplosionSample(){
  const ctx=this.ctx,bin=atob(VCH_EXPLOSION_PCM),frames=bin.length>>2;
  const buffer=ctx.createBuffer(2,frames,22050);
  const L=buffer.getChannelData(0),R=buffer.getChannelData(1);
  for(let i=0;i<frames;i++){
    let l=bin.charCodeAt(i*4)|(bin.charCodeAt(i*4+1)<<8);
    let r=bin.charCodeAt(i*4+2)|(bin.charCodeAt(i*4+3)<<8);
    if(l>=32768)l-=65536;if(r>=32768)r-=65536;
    L[i]=l/32768;R[i]=r/32768;
  }
  return buffer;
}
_initExplosionFX(e){
  /* The exact "Big Bang" reference stays the core. Two parallel branches make
     its very sub-heavy signal dense and audible on ordinary speakers:
     low-mid weight + saturation/parallel compression for body, plus a short
     tight transient layer at playback time for the actual impact. */
  this.explIn=e.createGain();this.explIn.gain.value=1;
  const weight=e.createBiquadFilter();weight.type="peaking";
  weight.frequency.value=220;weight.Q.value=.8;weight.gain.value=7;
  const air=e.createBiquadFilter();air.type="highshelf";
  air.frequency.value=2500;air.gain.value=5;
  const dry=e.createGain();dry.gain.value=1.05;
  this.explIn.connect(weight).connect(air).connect(dry).connect(this.master);
  const drive=e.createWaveShaper();drive.curve=this._softClip(2.2);drive.oversample="2x";
  const squash=e.createDynamicsCompressor();
  squash.threshold.value=-26;squash.knee.value=8;squash.ratio.value=9;
  squash.attack.value=.002;squash.release.value=.10;
  const body=e.createBiquadFilter();body.type="lowpass";body.frequency.value=2800;
  const wet=e.createGain();wet.gain.value=.72;
  this.explIn.connect(drive).connect(squash).connect(body).connect(wet).connect(this.master);
}
_makeSoilLoop(){
  const ctx=this.ctx,bin=atob(VCH_SOIL_PCM),frames=bin.length>>1;
  const buffer=ctx.createBuffer(1,frames,44100),data=buffer.getChannelData(0);
  for(let i=0;i<frames;i++){
    let v=bin.charCodeAt(i<<1)|(bin.charCodeAt((i<<1)+1)<<8);
    if(v>=32768)v-=65536;
    data[i]=v/32768;
  }
  return buffer;
}
reload(){this._noiseBurst({dur:.12,type:"bandpass",freq:2200,q:3,gain:.16}),this._noiseBurst({dur:.16,type:"bandpass",freq:1100,q:3,gain:.2,delay:.22}),this._thump({freq:150,dur:.18,gain:.2,delay:.24})}explosion(t=1){
  /* Exact reference core + a short, tight low-mid punch for audible impact. */
  if(!this.started||!this.explosionBuffer)return;
  const ctx=this.ctx,src=ctx.createBufferSource();
  src.buffer=this.explosionBuffer;src.connect(this.explIn);
  src.onended=()=>{src.disconnect()};
  src.start(ctx.currentTime);
  const k=Math.min(1.3,.9+(t-1)*.2);
  this._thump({freq:62,dur:.26,gain:.68*k,slideTo:.4,send:.2});
  this._noiseBurst({dur:.12,type:"bandpass",freq:900,q:.7,gain:.55*k,send:.18});
  this._noiseBurst({dur:.055,type:"highpass",freq:2600,gain:.22*k});
}impact(){this._noiseBurst({dur:.3,type:"bandpass",freq:900,q:1.4,gain:.5,send:.25}),this._thump({freq:120,dur:.3,gain:.45})}clank(){this._noiseBurst({dur:.09,type:"bandpass",freq:3e3,q:6,gain:.14})}crush(){this.started&&(this._noiseBurst({dur:.45,type:"bandpass",freq:520,q:1.1,gain:.42,sweepTo:180,send:.2}),this._thump({freq:70,dur:.35,gain:.4,slideTo:.4}))}
/* --- вызовы из наших модулей (05-cases, 03-dynamics) — в эталоне их нет,
       поэтому оставляем пустые методы, чтобы не падать --- */
land(){}
squeak(){}
hatch(){}
}class n1 extends Js{constructor(t){super(t),this.dracoLoader=null,this.ktx2Loader=null,this.meshoptDecoder=null,this.pluginCallbacks=[],this.register(function(e){return new a1(e)}),this.register(function(e){return new c1(e)}),this.register(function(e){return new v1(e)}),this.register(function(e){return new _1(e)}),this.register(function(e){return new x1(e)}),this.register(function(e){return new h1(e)}),this.register(function(e){return new u1(e)}),this.register(function(e){return new d1(e)}),this.register(function(e){return new f1(e)}),this.register(function(e){return new o1(e)}),this.register(function(e){return new p1(e)}),this.register(function(e){return new l1(e)}),this.register(function(e){return new g1(e)}),this.register(function(e){return new m1(e)}),this.register(function(e){return new s1(e)}),this.register(function(e){return new y1(e)}),this.register(function(e){return new M1(e)})}load(t,e,n,i){const s=this;let o;if(this.resourcePath!=="")o=this.resourcePath;else if(this.path!==""){const l=Rr.extractUrlBase(t);o=Rr.resolveURL(l,this.path)}else o=Rr.extractUrlBase(t);this.manager.itemStart(t);const a=function(l){i?i(l):console.error(l),s.manager.itemError(t),s.manager.itemEnd(t)},c=new bf(this.manager);c.setPath(this.path),c.setResponseType("arraybuffer"),c.setRequestHeader(this.requestHeader),c.setWithCredentials(this.withCredentials),c.load(t,function(l){try{s.parse(l,o,function(h){e(h),s.manager.itemEnd(t)},a)}catch(h){a(h)}},n,a)}setDRACOLoader(t){return this.dracoLoader=t,this}setKTX2Loader(t){return this.ktx2Loader=t,this}setMeshoptDecoder(t){return this.meshoptDecoder=t,this}register(t){return this.pluginCallbacks.indexOf(t)===-1&&this.pluginCallbacks.push(t),this}unregister(t){return this.pluginCallbacks.indexOf(t)!==-1&&this.pluginCallbacks.splice(this.pluginCallbacks.indexOf(t),1),this}parse(t,e,n,i){let s;const o={},a={},c=new TextDecoder;if(typeof t=="string")s=JSON.parse(t);else if(t instanceof ArrayBuffer)if(c.decode(new Uint8Array(t,0,4))===Hf){try{o[ee.KHR_BINARY_GLTF]=new S1(t)}catch(d){i&&i(d);return}s=JSON.parse(o[ee.KHR_BINARY_GLTF].content)}else s=JSON.parse(c.decode(t));else s=t;if(s.asset===void 0||s.asset.version[0]<2){i&&i(new Error("THREE.GLTFLoader: Unsupported asset. glTF versions >=2.0 are supported."));return}const l=new U1(s,{path:e||this.resourcePath||"",crossOrigin:this.crossOrigin,requestHeader:this.requestHeader,manager:this.manager,ktx2Loader:this.ktx2Loader,meshoptDecoder:this.meshoptDecoder});l.fileLoader.setRequestHeader(this.requestHeader);for(let h=0;h<this.pluginCallbacks.length;h++){const d=this.pluginCallbacks[h](l);d.name||console.error("THREE.GLTFLoader: Invalid plugin found: missing name"),a[d.name]=d,o[d.name]=!0}if(s.extensionsUsed)for(let h=0;h<s.extensionsUsed.length;++h){const d=s.extensionsUsed[h],u=s.extensionsRequired||[];switch(d){case ee.KHR_MATERIALS_UNLIT:o[d]=new r1;break;case ee.KHR_DRACO_MESH_COMPRESSION:o[d]=new w1(s,this.dracoLoader);break;case ee.KHR_TEXTURE_TRANSFORM:o[d]=new b1;break;case ee.KHR_MESH_QUANTIZATION:o[d]=new E1;break;default:u.indexOf(d)>=0&&a[d]===void 0&&console.warn('THREE.GLTFLoader: Unknown extension "'+d+'".')}}l.setExtensions(o),l.setPlugins(a),l.parse(n,i)}parseAsync(t,e){const n=this;return new Promise(function(i,s){n.parse(t,e,i,s)})}}function i1(){let r={};return{get:function(t){return r[t]},add:function(t,e){r[t]=e},remove:function(t){delete r[t]},removeAll:function(){r={}}}}const ee={KHR_BINARY_GLTF:"KHR_binary_glTF",KHR_DRACO_MESH_COMPRESSION:"KHR_draco_mesh_compression",KHR_LIGHTS_PUNCTUAL:"KHR_lights_punctual",KHR_MATERIALS_CLEARCOAT:"KHR_materials_clearcoat",KHR_MATERIALS_DISPERSION:"KHR_materials_dispersion",KHR_MATERIALS_IOR:"KHR_materials_ior",KHR_MATERIALS_SHEEN:"KHR_materials_sheen",KHR_MATERIALS_SPECULAR:"KHR_materials_specular",KHR_MATERIALS_TRANSMISSION:"KHR_materials_transmission",KHR_MATERIALS_IRIDESCENCE:"KHR_materials_iridescence",KHR_MATERIALS_ANISOTROPY:"KHR_materials_anisotropy",KHR_MATERIALS_UNLIT:"KHR_materials_unlit",KHR_MATERIALS_VOLUME:"KHR_materials_volume",KHR_TEXTURE_BASISU:"KHR_texture_basisu",KHR_TEXTURE_TRANSFORM:"KHR_texture_transform",KHR_MESH_QUANTIZATION:"KHR_mesh_quantization",KHR_MATERIALS_EMISSIVE_STRENGTH:"KHR_materials_emissive_strength",EXT_MATERIALS_BUMP:"EXT_materials_bump",EXT_TEXTURE_WEBP:"EXT_texture_webp",EXT_TEXTURE_AVIF:"EXT_texture_avif",EXT_MESHOPT_COMPRESSION:"EXT_meshopt_compression",EXT_MESH_GPU_INSTANCING:"EXT_mesh_gpu_instancing"};class s1{constructor(t){this.parser=t,this.name=ee.KHR_LIGHTS_PUNCTUAL,this.cache={refs:{},uses:{}}}_markDefs(){const t=this.parser,e=this.parser.json.nodes||[];for(let n=0,i=e.length;n<i;n++){const s=e[n];s.extensions&&s.extensions[this.name]&&s.extensions[this.name].light!==void 0&&t._addNodeRef(this.cache,s.extensions[this.name].light)}}_loadLight(t){const e=this.parser,n="light:"+t;let i=e.cache.get(n);if(i)return i;const s=e.json,c=((s.extensions&&s.extensions[this.name]||{}).lights||[])[t];let l;const h=new Ft(16777215);c.color!==void 0&&h.setRGB(c.color[0],c.color[1],c.color[2],Ye);const d=c.range!==void 0?c.range:0;switch(c.type){case"directional":l=new wl(h),l.target.position.set(0,0,-1),l.add(l.target);break;case"point":l=new Ql(h),l.distance=d;break;case"spot":l=new by(h),l.distance=d,c.spot=c.spot||{},c.spot.innerConeAngle=c.spot.innerConeAngle!==void 0?c.spot.innerConeAngle:0,c.spot.outerConeAngle=c.spot.outerConeAngle!==void 0?c.spot.outerConeAngle:Math.PI/4,l.angle=c.spot.outerConeAngle,l.penumbra=1-c.spot.innerConeAngle/c.spot.outerConeAngle,l.target.position.set(0,0,-1),l.add(l.target);break;default:throw new Error("THREE.GLTFLoader: Unexpected light type: "+c.type)}return l.position.set(0,0,0),l.decay=2,ui(l,c),c.intensity!==void 0&&(l.intensity=c.intensity),l.name=e.createUniqueName(c.name||"light_"+t),i=Promise.resolve(l),e.cache.add(n,i),i}getDependency(t,e){if(t==="light")return this._loadLight(e)}createNodeAttachment(t){const e=this,n=this.parser,s=n.json.nodes[t],a=(s.extensions&&s.extensions[this.name]||{}).light;return a===void 0?null:this._loadLight(a).then(function(c){return n._getNodeRef(e.cache,a,c)})}}class r1{constructor(){this.name=ee.KHR_MATERIALS_UNLIT}getMaterialType(){return En}extendParams(t,e,n){const i=[];t.color=new Ft(1,1,1),t.opacity=1;const s=e.pbrMetallicRoughness;if(s){if(Array.isArray(s.baseColorFactor)){const o=s.baseColorFactor;t.color.setRGB(o[0],o[1],o[2],Ye),t.opacity=o[3]}s.baseColorTexture!==void 0&&i.push(n.assignTexture(t,"map",s.baseColorTexture,Ie))}return Promise.all(i)}}class o1{constructor(t){this.parser=t,this.name=ee.KHR_MATERIALS_EMISSIVE_STRENGTH}extendMaterialParams(t,e){const i=this.parser.json.materials[t];if(!i.extensions||!i.extensions[this.name])return Promise.resolve();const s=i.extensions[this.name].emissiveStrength;return s!==void 0&&(e.emissiveIntensity=s),Promise.resolve()}}class a1{constructor(t){this.parser=t,this.name=ee.KHR_MATERIALS_CLEARCOAT}getMaterialType(t){const n=this.parser.json.materials[t];return!n.extensions||!n.extensions[this.name]?null:$n}extendMaterialParams(t,e){const n=this.parser,i=n.json.materials[t];if(!i.extensions||!i.extensions[this.name])return Promise.resolve();const s=[],o=i.extensions[this.name];if(o.clearcoatFactor!==void 0&&(e.clearcoat=o.clearcoatFactor),o.clearcoatTexture!==void 0&&s.push(n.assignTexture(e,"clearcoatMap",o.clearcoatTexture)),o.clearcoatRoughnessFactor!==void 0&&(e.clearcoatRoughness=o.clearcoatRoughnessFactor),o.clearcoatRoughnessTexture!==void 0&&s.push(n.assignTexture(e,"clearcoatRoughnessMap",o.clearcoatRoughnessTexture)),o.clearcoatNormalTexture!==void 0&&(s.push(n.assignTexture(e,"clearcoatNormalMap",o.clearcoatNormalTexture)),o.clearcoatNormalTexture.scale!==void 0)){const a=o.clearcoatNormalTexture.scale;e.clearcoatNormalScale=new ct(a,a)}return Promise.all(s)}}class c1{constructor(t){this.parser=t,this.name=ee.KHR_MATERIALS_DISPERSION}getMaterialType(t){const n=this.parser.json.materials[t];return!n.extensions||!n.extensions[this.name]?null:$n}extendMaterialParams(t,e){const i=this.parser.json.materials[t];if(!i.extensions||!i.extensions[this.name])return Promise.resolve();const s=i.extensions[this.name];return e.dispersion=s.dispersion!==void 0?s.dispersion:0,Promise.resolve()}}class l1{constructor(t){this.parser=t,this.name=ee.KHR_MATERIALS_IRIDESCENCE}getMaterialType(t){const n=this.parser.json.materials[t];return!n.extensions||!n.extensions[this.name]?null:$n}extendMaterialParams(t,e){const n=this.parser,i=n.json.materials[t];if(!i.extensions||!i.extensions[this.name])return Promise.resolve();const s=[],o=i.extensions[this.name];return o.iridescenceFactor!==void 0&&(e.iridescence=o.iridescenceFactor),o.iridescenceTexture!==void 0&&s.push(n.assignTexture(e,"iridescenceMap",o.iridescenceTexture)),o.iridescenceIor!==void 0&&(e.iridescenceIOR=o.iridescenceIor),e.iridescenceThicknessRange===void 0&&(e.iridescenceThicknessRange=[100,400]),o.iridescenceThicknessMinimum!==void 0&&(e.iridescenceThicknessRange[0]=o.iridescenceThicknessMinimum),o.iridescenceThicknessMaximum!==void 0&&(e.iridescenceThicknessRange[1]=o.iridescenceThicknessMaximum),o.iridescenceThicknessTexture!==void 0&&s.push(n.assignTexture(e,"iridescenceThicknessMap",o.iridescenceThicknessTexture)),Promise.all(s)}}class h1{constructor(t){this.parser=t,this.name=ee.KHR_MATERIALS_SHEEN}getMaterialType(t){const n=this.parser.json.materials[t];return!n.extensions||!n.extensions[this.name]?null:$n}extendMaterialParams(t,e){const n=this.parser,i=n.json.materials[t];if(!i.extensions||!i.extensions[this.name])return Promise.resolve();const s=[];e.sheenColor=new Ft(0,0,0),e.sheenRoughness=0,e.sheen=1;const o=i.extensions[this.name];if(o.sheenColorFactor!==void 0){const a=o.sheenColorFactor;e.sheenColor.setRGB(a[0],a[1],a[2],Ye)}return o.sheenRoughnessFactor!==void 0&&(e.sheenRoughness=o.sheenRoughnessFactor),o.sheenColorTexture!==void 0&&s.push(n.assignTexture(e,"sheenColorMap",o.sheenColorTexture,Ie)),o.sheenRoughnessTexture!==void 0&&s.push(n.assignTexture(e,"sheenRoughnessMap",o.sheenRoughnessTexture)),Promise.all(s)}}class u1{constructor(t){this.parser=t,this.name=ee.KHR_MATERIALS_TRANSMISSION}getMaterialType(t){const n=this.parser.json.materials[t];return!n.extensions||!n.extensions[this.name]?null:$n}extendMaterialParams(t,e){const n=this.parser,i=n.json.materials[t];if(!i.extensions||!i.extensions[this.name])return Promise.resolve();const s=[],o=i.extensions[this.name];return o.transmissionFactor!==void 0&&(e.transmission=o.transmissionFactor),o.transmissionTexture!==void 0&&s.push(n.assignTexture(e,"transmissionMap",o.transmissionTexture)),Promise.all(s)}}class d1{constructor(t){this.parser=t,this.name=ee.KHR_MATERIALS_VOLUME}getMaterialType(t){const n=this.parser.json.materials[t];return!n.extensions||!n.extensions[this.name]?null:$n}extendMaterialParams(t,e){const n=this.parser,i=n.json.materials[t];if(!i.extensions||!i.extensions[this.name])return Promise.resolve();const s=[],o=i.extensions[this.name];e.thickness=o.thicknessFactor!==void 0?o.thicknessFactor:0,o.thicknessTexture!==void 0&&s.push(n.assignTexture(e,"thicknessMap",o.thicknessTexture)),e.attenuationDistance=o.attenuationDistance||1/0;const a=o.attenuationColor||[1,1,1];return e.attenuationColor=new Ft().setRGB(a[0],a[1],a[2],Ye),Promise.all(s)}}class f1{constructor(t){this.parser=t,this.name=ee.KHR_MATERIALS_IOR}getMaterialType(t){const n=this.parser.json.materials[t];return!n.extensions||!n.extensions[this.name]?null:$n}extendMaterialParams(t,e){const i=this.parser.json.materials[t];if(!i.extensions||!i.extensions[this.name])return Promise.resolve();const s=i.extensions[this.name];return e.ior=s.ior!==void 0?s.ior:1.5,Promise.resolve()}}class p1{constructor(t){this.parser=t,this.name=ee.KHR_MATERIALS_SPECULAR}getMaterialType(t){const n=this.parser.json.materials[t];return!n.extensions||!n.extensions[this.name]?null:$n}extendMaterialParams(t,e){const n=this.parser,i=n.json.materials[t];if(!i.extensions||!i.extensions[this.name])return Promise.resolve();const s=[],o=i.extensions[this.name];e.specularIntensity=o.specularFactor!==void 0?o.specularFactor:1,o.specularTexture!==void 0&&s.push(n.assignTexture(e,"specularIntensityMap",o.specularTexture));const a=o.specularColorFactor||[1,1,1];return e.specularColor=new Ft().setRGB(a[0],a[1],a[2],Ye),o.specularColorTexture!==void 0&&s.push(n.assignTexture(e,"specularColorMap",o.specularColorTexture,Ie)),Promise.all(s)}}class m1{constructor(t){this.parser=t,this.name=ee.EXT_MATERIALS_BUMP}getMaterialType(t){const n=this.parser.json.materials[t];return!n.extensions||!n.extensions[this.name]?null:$n}extendMaterialParams(t,e){const n=this.parser,i=n.json.materials[t];if(!i.extensions||!i.extensions[this.name])return Promise.resolve();const s=[],o=i.extensions[this.name];return e.bumpScale=o.bumpFactor!==void 0?o.bumpFactor:1,o.bumpTexture!==void 0&&s.push(n.assignTexture(e,"bumpMap",o.bumpTexture)),Promise.all(s)}}class g1{constructor(t){this.parser=t,this.name=ee.KHR_MATERIALS_ANISOTROPY}getMaterialType(t){const n=this.parser.json.materials[t];return!n.extensions||!n.extensions[this.name]?null:$n}extendMaterialParams(t,e){const n=this.parser,i=n.json.materials[t];if(!i.extensions||!i.extensions[this.name])return Promise.resolve();const s=[],o=i.extensions[this.name];return o.anisotropyStrength!==void 0&&(e.anisotropy=o.anisotropyStrength),o.anisotropyRotation!==void 0&&(e.anisotropyRotation=o.anisotropyRotation),o.anisotropyTexture!==void 0&&s.push(n.assignTexture(e,"anisotropyMap",o.anisotropyTexture)),Promise.all(s)}}class v1{constructor(t){this.parser=t,this.name=ee.KHR_TEXTURE_BASISU}loadTexture(t){const e=this.parser,n=e.json,i=n.textures[t];if(!i.extensions||!i.extensions[this.name])return null;const s=i.extensions[this.name],o=e.options.ktx2Loader;if(!o){if(n.extensionsRequired&&n.extensionsRequired.indexOf(this.name)>=0)throw new Error("THREE.GLTFLoader: setKTX2Loader must be called before loading KTX2 textures");return null}return e.loadTextureImage(t,s.source,o)}}class _1{constructor(t){this.parser=t,this.name=ee.EXT_TEXTURE_WEBP,this.isSupported=null}loadTexture(t){const e=this.name,n=this.parser,i=n.json,s=i.textures[t];if(!s.extensions||!s.extensions[e])return null;const o=s.extensions[e],a=i.images[o.source];let c=n.textureLoader;if(a.uri){const l=n.options.manager.getHandler(a.uri);l!==null&&(c=l)}return this.detectSupport().then(function(l){if(l)return n.loadTextureImage(t,o.source,c);if(i.extensionsRequired&&i.extensionsRequired.indexOf(e)>=0)throw new Error("THREE.GLTFLoader: WebP required by asset but unsupported.");return n.loadTexture(t)})}detectSupport(){return this.isSupported||(this.isSupported=new Promise(function(t){const e=new Image;e.src="data:image/webp;base64,UklGRiIAAABXRUJQVlA4IBYAAAAwAQCdASoBAAEADsD+JaQAA3AAAAAA",e.onload=e.onerror=function(){t(e.height===1)}})),this.isSupported}}class x1{constructor(t){this.parser=t,this.name=ee.EXT_TEXTURE_AVIF,this.isSupported=null}loadTexture(t){const e=this.name,n=this.parser,i=n.json,s=i.textures[t];if(!s.extensions||!s.extensions[e])return null;const o=s.extensions[e],a=i.images[o.source];let c=n.textureLoader;if(a.uri){const l=n.options.manager.getHandler(a.uri);l!==null&&(c=l)}return this.detectSupport().then(function(l){if(l)return n.loadTextureImage(t,o.source,c);if(i.extensionsRequired&&i.extensionsRequired.indexOf(e)>=0)throw new Error("THREE.GLTFLoader: AVIF required by asset but unsupported.");return n.loadTexture(t)})}detectSupport(){return this.isSupported||(this.isSupported=new Promise(function(t){const e=new Image;e.src="data:image/avif;base64,AAAAIGZ0eXBhdmlmAAAAAGF2aWZtaWYxbWlhZk1BMUIAAADybWV0YQAAAAAAAAAoaGRscgAAAAAAAAAAcGljdAAAAAAAAAAAAAAAAGxpYmF2aWYAAAAADnBpdG0AAAAAAAEAAAAeaWxvYwAAAABEAAABAAEAAAABAAABGgAAABcAAAAoaWluZgAAAAAAAQAAABppbmZlAgAAAAABAABhdjAxQ29sb3IAAAAAamlwcnAAAABLaXBjbwAAABRpc3BlAAAAAAAAAAEAAAABAAAAEHBpeGkAAAAAAwgICAAAAAxhdjFDgQAMAAAAABNjb2xybmNseAACAAIABoAAAAAXaXBtYQAAAAAAAAABAAEEAQKDBAAAAB9tZGF0EgAKCBgABogQEDQgMgkQAAAAB8dSLfI=",e.onload=e.onerror=function(){t(e.height===1)}})),this.isSupported}}class y1{constructor(t){this.name=ee.EXT_MESHOPT_COMPRESSION,this.parser=t}loadBufferView(t){const e=this.parser.json,n=e.bufferViews[t];if(n.extensions&&n.extensions[this.name]){const i=n.extensions[this.name],s=this.parser.getDependency("buffer",i.buffer),o=this.parser.options.meshoptDecoder;if(!o||!o.supported){if(e.extensionsRequired&&e.extensionsRequired.indexOf(this.name)>=0)throw new Error("THREE.GLTFLoader: setMeshoptDecoder must be called before loading compressed files");return null}return s.then(function(a){const c=i.byteOffset||0,l=i.byteLength||0,h=i.count,d=i.byteStride,u=new Uint8Array(a,c,l);return o.decodeGltfBufferAsync?o.decodeGltfBufferAsync(h,d,u,i.mode,i.filter).then(function(f){return f.buffer}):o.ready.then(function(){const f=new ArrayBuffer(h*d);return o.decodeGltfBuffer(new Uint8Array(f),h,d,u,i.mode,i.filter),f})})}else return null}}class M1{constructor(t){this.name=ee.EXT_MESH_GPU_INSTANCING,this.parser=t}createNodeMesh(t){const e=this.parser.json,n=e.nodes[t];if(!n.extensions||!n.extensions[this.name]||n.mesh===void 0)return null;const i=e.meshes[n.mesh];for(const l of i.primitives)if(l.mode!==Sn.TRIANGLES&&l.mode!==Sn.TRIANGLE_STRIP&&l.mode!==Sn.TRIANGLE_FAN&&l.mode!==void 0)return null;const o=n.extensions[this.name].attributes,a=[],c={};for(const l in o)a.push(this.parser.getDependency("accessor",o[l]).then(h=>(c[l]=h,c[l])));return a.length<1?null:(a.push(this.parser.createNodeMesh(t)),Promise.all(a).then(l=>{const h=l.pop(),d=h.isGroup?h.children:[h],u=l[0].count,f=[];for(const m of d){const v=new Xt,p=new P,g=new gn,_=new P(1,1,1),x=new xa(m.geometry,m.material,u);for(let y=0;y<u;y++)c.TRANSLATION&&p.fromBufferAttribute(c.TRANSLATION,y),c.ROTATION&&g.fromBufferAttribute(c.ROTATION,y),c.SCALE&&_.fromBufferAttribute(c.SCALE,y),x.setMatrixAt(y,v.compose(p,g,_));for(const y in c)if(y==="_COLOR_0"){const R=c[y];x.instanceColor=new xl(R.array,R.itemSize,R.normalized)}else y!=="TRANSLATION"&&y!=="ROTATION"&&y!=="SCALE"&&m.geometry.setAttribute(y,c[y]);ue.prototype.copy.call(x,m),this.parser.assignFinalMaterial(x),f.push(x)}return h.isGroup?(h.clear(),h.add(...f),h):f[0]}))}}const Hf="glTF",vr=12,fd={JSON:1313821514,BIN:5130562};class S1{constructor(t){this.name=ee.KHR_BINARY_GLTF,this.content=null,this.body=null;const e=new DataView(t,0,vr),n=new TextDecoder;if(this.header={magic:n.decode(new Uint8Array(t.slice(0,4))),version:e.getUint32(4,!0),length:e.getUint32(8,!0)},this.header.magic!==Hf)throw new Error("THREE.GLTFLoader: Unsupported glTF-Binary header.");if(this.header.version<2)throw new Error("THREE.GLTFLoader: Legacy binary file detected.");const i=this.header.length-vr,s=new DataView(t,vr);let o=0;for(;o<i;){const a=s.getUint32(o,!0);o+=4;const c=s.getUint32(o,!0);if(o+=4,c===fd.JSON){const l=new Uint8Array(t,vr+o,a);this.content=n.decode(l)}else if(c===fd.BIN){const l=vr+o;this.body=t.slice(l,l+a)}o+=a}if(this.content===null)throw new Error("THREE.GLTFLoader: JSON content not found.")}}class w1{constructor(t,e){if(!e)throw new Error("THREE.GLTFLoader: No DRACOLoader instance provided.");this.name=ee.KHR_DRACO_MESH_COMPRESSION,this.json=t,this.dracoLoader=e,this.dracoLoader.preload()}decodePrimitive(t,e){const n=this.json,i=this.dracoLoader,s=t.extensions[this.name].bufferView,o=t.extensions[this.name].attributes,a={},c={},l={};for(const h in o){const d=Tl[h]||h.toLowerCase();a[d]=o[h]}for(const h in t.attributes){const d=Tl[h]||h.toLowerCase();if(o[h]!==void 0){const u=n.accessors[t.attributes[h]],f=Ds[u.componentType];l[d]=f.name,c[d]=u.normalized===!0}}return e.getDependency("bufferView",s).then(function(h){return new Promise(function(d,u){i.decodeDracoFile(h,function(f){for(const m in f.attributes){const v=f.attributes[m],p=c[m];p!==void 0&&(v.normalized=p)}d(f)},a,l,Ye,u)})})}}class b1{constructor(){this.name=ee.KHR_TEXTURE_TRANSFORM}extendTexture(t,e){return(e.texCoord===void 0||e.texCoord===t.channel)&&e.offset===void 0&&e.rotation===void 0&&e.scale===void 0||(t=t.clone(),e.texCoord!==void 0&&(t.channel=e.texCoord),e.offset!==void 0&&t.offset.fromArray(e.offset),e.rotation!==void 0&&(t.rotation=e.rotation),e.scale!==void 0&&t.repeat.fromArray(e.scale),t.needsUpdate=!0),t}}class E1{constructor(){this.name=ee.KHR_MESH_QUANTIZATION}}class Gf extends qr{constructor(t,e,n,i){super(t,e,n,i)}copySampleValue_(t){const e=this.resultBuffer,n=this.sampleValues,i=this.valueSize,s=t*i*3+i;for(let o=0;o!==i;o++)e[o]=n[s+o];return e}interpolate_(t,e,n,i){const s=this.resultBuffer,o=this.sampleValues,a=this.valueSize,c=a*2,l=a*3,h=i-e,d=(n-e)/h,u=d*d,f=u*d,m=t*l,v=m-l,p=-2*f+3*u,g=f-u,_=1-p,x=g-u+d;for(let y=0;y!==a;y++){const R=o[v+y+a],A=o[v+y+c]*h,T=o[m+y+a],N=o[m+y]*h;s[y]=_*R+x*A+p*T+g*N}return s}}const T1=new gn;class A1 extends Gf{interpolate_(t,e,n,i){const s=super.interpolate_(t,e,n,i);return T1.fromArray(s).normalize().toArray(s),s}}const Sn={POINTS:0,LINES:1,LINE_LOOP:2,LINE_STRIP:3,TRIANGLES:4,TRIANGLE_STRIP:5,TRIANGLE_FAN:6},Ds={5120:Int8Array,5121:Uint8Array,5122:Int16Array,5123:Uint16Array,5125:Uint32Array,5126:Float32Array},pd={9728:nn,9729:pn,9984:Pd,9985:jo,9986:Mr,9987:fi},md={33071:Pi,33648:na,10497:vi},xc={SCALAR:1,VEC2:2,VEC3:3,VEC4:4,MAT2:4,MAT3:9,MAT4:16},Tl={POSITION:"position",NORMAL:"normal",TANGENT:"tangent",TEXCOORD_0:"uv",TEXCOORD_1:"uv1",TEXCOORD_2:"uv2",TEXCOORD_3:"uv3",COLOR_0:"color",WEIGHTS_0:"skinWeight",JOINTS_0:"skinIndex"},Ai={scale:"scale",translation:"position",rotation:"quaternion",weights:"morphTargetInfluences"},R1={CUBICSPLINE:void 0,LINEAR:Ur,STEP:Dr},yc={OPAQUE:"OPAQUE",MASK:"MASK",BLEND:"BLEND"};function C1(r){return r.DefaultMaterial===void 0&&(r.DefaultMaterial=new fe({color:16777215,emissive:0,metalness:1,roughness:1,transparent:!1,depthTest:!0,side:Yn})),r.DefaultMaterial}function Xi(r,t,e){for(const n in e.extensions)r[n]===void 0&&(t.userData.gltfExtensions=t.userData.gltfExtensions||{},t.userData.gltfExtensions[n]=e.extensions[n])}function ui(r,t){t.extras!==void 0&&(typeof t.extras=="object"?Object.assign(r.userData,t.extras):console.warn("THREE.GLTFLoader: Ignoring primitive type .extras, "+t.extras))}function P1(r,t,e){let n=!1,i=!1,s=!1;for(let l=0,h=t.length;l<h;l++){const d=t[l];if(d.POSITION!==void 0&&(n=!0),d.NORMAL!==void 0&&(i=!0),d.COLOR_0!==void 0&&(s=!0),n&&i&&s)break}if(!n&&!i&&!s)return Promise.resolve(r);const o=[],a=[],c=[];for(let l=0,h=t.length;l<h;l++){const d=t[l];if(n){const u=d.POSITION!==void 0?e.getDependency("accessor",d.POSITION):r.attributes.position;o.push(u)}if(i){const u=d.NORMAL!==void 0?e.getDependency("accessor",d.NORMAL):r.attributes.normal;a.push(u)}if(s){const u=d.COLOR_0!==void 0?e.getDependency("accessor",d.COLOR_0):r.attributes.color;c.push(u)}}return Promise.all([Promise.all(o),Promise.all(a),Promise.all(c)]).then(function(l){const h=l[0],d=l[1],u=l[2];return n&&(r.morphAttributes.position=h),i&&(r.morphAttributes.normal=d),s&&(r.morphAttributes.color=u),r.morphTargetsRelative=!0,r})}function L1(r,t){if(r.updateMorphTargets(),t.weights!==void 0)for(let e=0,n=t.weights.length;e<n;e++)r.morphTargetInfluences[e]=t.weights[e];if(t.extras&&Array.isArray(t.extras.targetNames)){const e=t.extras.targetNames;if(r.morphTargetInfluences.length===e.length){r.morphTargetDictionary={};for(let n=0,i=e.length;n<i;n++)r.morphTargetDictionary[e[n]]=n}else console.warn("THREE.GLTFLoader: Invalid extras.targetNames length. Ignoring names.")}}function I1(r){let t;const e=r.extensions&&r.extensions[ee.KHR_DRACO_MESH_COMPRESSION];if(e?t="draco:"+e.bufferView+":"+e.indices+":"+Mc(e.attributes):t=r.indices+":"+Mc(r.attributes)+":"+r.mode,r.targets!==void 0)for(let n=0,i=r.targets.length;n<i;n++)t+=":"+Mc(r.targets[n]);return t}function Mc(r){let t="";const e=Object.keys(r).sort();for(let n=0,i=e.length;n<i;n++)t+=e[n]+":"+r[e[n]]+";";return t}function Al(r){switch(r){case Int8Array:return 1/127;case Uint8Array:return 1/255;case Int16Array:return 1/32767;case Uint16Array:return 1/65535;default:throw new Error("THREE.GLTFLoader: Unsupported normalized accessor component type.")}}function N1(r){return r.search(/\.jpe?g($|\?)/i)>0||r.search(/^data\:image\/jpeg/)===0?"image/jpeg":r.search(/\.webp($|\?)/i)>0||r.search(/^data\:image\/webp/)===0?"image/webp":"image/png"}const D1=new Xt;class U1{constructor(t={},e={}){this.json=t,this.extensions={},this.plugins={},this.options=e,this.cache=new i1,this.associations=new Map,this.primitiveCache={},this.nodeCache={},this.meshCache={refs:{},uses:{}},this.cameraCache={refs:{},uses:{}},this.lightCache={refs:{},uses:{}},this.sourceCache={},this.textureCache={},this.nodeNamesUsed={};let n=!1,i=-1,s=!1,o=-1;if(typeof navigator<"u"){const a=navigator.userAgent;n=/^((?!chrome|android).)*safari/i.test(a)===!0;const c=a.match(/Version\/(\d+)/);i=n&&c?parseInt(c[1],10):-1,s=a.indexOf("Firefox")>-1,o=s?a.match(/Firefox\/([0-9]+)\./)[1]:-1}typeof createImageBitmap>"u"||n&&i<17||s&&o<98?this.textureLoader=new My(this.options.manager):this.textureLoader=new Ry(this.options.manager),this.textureLoader.setCrossOrigin(this.options.crossOrigin),this.textureLoader.setRequestHeader(this.options.requestHeader),this.fileLoader=new bf(this.options.manager),this.fileLoader.setResponseType("arraybuffer"),this.options.crossOrigin==="use-credentials"&&this.fileLoader.setWithCredentials(!0)}setExtensions(t){this.extensions=t}setPlugins(t){this.plugins=t}parse(t,e){const n=this,i=this.json,s=this.extensions;this.cache.removeAll(),this.nodeCache={},this._invokeAll(function(o){return o._markDefs&&o._markDefs()}),Promise.all(this._invokeAll(function(o){return o.beforeRoot&&o.beforeRoot()})).then(function(){return Promise.all([n.getDependencies("scene"),n.getDependencies("animation"),n.getDependencies("camera")])}).then(function(o){const a={scene:o[0][i.scene||0],scenes:o[0],animations:o[1],cameras:o[2],asset:i.asset,parser:n,userData:{}};return Xi(s,a,i),ui(a,i),Promise.all(n._invokeAll(function(c){return c.afterRoot&&c.afterRoot(a)})).then(function(){for(const c of a.scenes)c.updateMatrixWorld();t(a)})}).catch(e)}_markDefs(){const t=this.json.nodes||[],e=this.json.skins||[],n=this.json.meshes||[];for(let i=0,s=e.length;i<s;i++){const o=e[i].joints;for(let a=0,c=o.length;a<c;a++)t[o[a]].isBone=!0}for(let i=0,s=t.length;i<s;i++){const o=t[i];o.mesh!==void 0&&(this._addNodeRef(this.meshCache,o.mesh),o.skin!==void 0&&(n[o.mesh].isSkinnedMesh=!0)),o.camera!==void 0&&this._addNodeRef(this.cameraCache,o.camera)}}_addNodeRef(t,e){e!==void 0&&(t.refs[e]===void 0&&(t.refs[e]=t.uses[e]=0),t.refs[e]++)}_getNodeRef(t,e,n){if(t.refs[e]<=1)return n;const i=n.clone(),s=(o,a)=>{const c=this.associations.get(o);c!=null&&this.associations.set(a,c);for(const[l,h]of o.children.entries())s(h,a.children[l])};return s(n,i),i.name+="_instance_"+t.uses[e]++,i}_invokeOne(t){const e=Object.values(this.plugins);e.push(this);for(let n=0;n<e.length;n++){const i=t(e[n]);if(i)return i}return null}_invokeAll(t){const e=Object.values(this.plugins);e.unshift(this);const n=[];for(let i=0;i<e.length;i++){const s=t(e[i]);s&&n.push(s)}return n}getDependency(t,e){const n=t+":"+e;let i=this.cache.get(n);if(!i){switch(t){case"scene":i=this.loadScene(e);break;case"node":i=this._invokeOne(function(s){return s.loadNode&&s.loadNode(e)});break;case"mesh":i=this._invokeOne(function(s){return s.loadMesh&&s.loadMesh(e)});break;case"accessor":i=this.loadAccessor(e);break;case"bufferView":i=this._invokeOne(function(s){return s.loadBufferView&&s.loadBufferView(e)});break;case"buffer":i=this.loadBuffer(e);break;case"material":i=this._invokeOne(function(s){return s.loadMaterial&&s.loadMaterial(e)});break;case"texture":i=this._invokeOne(function(s){return s.loadTexture&&s.loadTexture(e)});break;case"skin":i=this.loadSkin(e);break;case"animation":i=this._invokeOne(function(s){return s.loadAnimation&&s.loadAnimation(e)});break;case"camera":i=this.loadCamera(e);break;default:if(i=this._invokeOne(function(s){return s!=this&&s.getDependency&&s.getDependency(t,e)}),!i)throw new Error("Unknown type: "+t);break}this.cache.add(n,i)}return i}getDependencies(t){let e=this.cache.get(t);if(!e){const n=this,i=this.json[t+(t==="mesh"?"es":"s")]||[];e=Promise.all(i.map(function(s,o){return n.getDependency(t,o)})),this.cache.add(t,e)}return e}loadBuffer(t){const e=this.json.buffers[t],n=this.fileLoader;if(e.type&&e.type!=="arraybuffer")throw new Error("THREE.GLTFLoader: "+e.type+" buffer type is not supported.");if(e.uri===void 0&&t===0)return Promise.resolve(this.extensions[ee.KHR_BINARY_GLTF].body);const i=this.options;return new Promise(function(s,o){n.load(Rr.resolveURL(e.uri,i.path),s,void 0,function(){o(new Error('THREE.GLTFLoader: Failed to load buffer "'+e.uri+'".'))})})}loadBufferView(t){const e=this.json.bufferViews[t];return this.getDependency("buffer",e.buffer).then(function(n){const i=e.byteLength||0,s=e.byteOffset||0;return n.slice(s,s+i)})}loadAccessor(t){const e=this,n=this.json,i=this.json.accessors[t];if(i.bufferView===void 0&&i.sparse===void 0){const o=xc[i.type],a=Ds[i.componentType],c=i.normalized===!0,l=new a(i.count*o);return Promise.resolve(new Ve(l,o,c))}const s=[];return i.bufferView!==void 0?s.push(this.getDependency("bufferView",i.bufferView)):s.push(null),i.sparse!==void 0&&(s.push(this.getDependency("bufferView",i.sparse.indices.bufferView)),s.push(this.getDependency("bufferView",i.sparse.values.bufferView))),Promise.all(s).then(function(o){const a=o[0],c=xc[i.type],l=Ds[i.componentType],h=l.BYTES_PER_ELEMENT,d=h*c,u=i.byteOffset||0,f=i.bufferView!==void 0?n.bufferViews[i.bufferView].byteStride:void 0,m=i.normalized===!0;let v,p;if(f&&f!==d){const g=Math.floor(u/f),_="InterleavedBuffer:"+i.bufferView+":"+i.componentType+":"+g+":"+i.count;let x=e.cache.get(_);x||(v=new l(a,g*f,i.count*f/h),x=new of(v,f/h),e.cache.add(_,x)),p=new Or(x,c,u%f/h,m)}else a===null?v=new l(i.count*c):v=new l(a,u,i.count*c),p=new Ve(v,c,m);if(i.sparse!==void 0){const g=xc.SCALAR,_=Ds[i.sparse.indices.componentType],x=i.sparse.indices.byteOffset||0,y=i.sparse.values.byteOffset||0,R=new _(o[1],x,i.sparse.count*g),A=new l(o[2],y,i.sparse.count*c);a!==null&&(p=new Ve(p.array.slice(),p.itemSize,p.normalized)),p.normalized=!1;for(let T=0,N=R.length;T<N;T++){const V=R[T];if(p.setX(V,A[T*c]),c>=2&&p.setY(V,A[T*c+1]),c>=3&&p.setZ(V,A[T*c+2]),c>=4&&p.setW(V,A[T*c+3]),c>=5)throw new Error("THREE.GLTFLoader: Unsupported itemSize in sparse BufferAttribute.")}p.normalized=m}return p})}loadTexture(t){const e=this.json,n=this.options,s=e.textures[t].source,o=e.images[s];let a=this.textureLoader;if(o.uri){const c=n.manager.getHandler(o.uri);c!==null&&(a=c)}return this.loadTextureImage(t,s,a)}loadTextureImage(t,e,n){const i=this,s=this.json,o=s.textures[t],a=s.images[e],c=(a.uri||a.bufferView)+":"+o.sampler;if(this.textureCache[c])return this.textureCache[c];const l=this.loadImageSource(e,n).then(function(h){h.flipY=!1,h.name=o.name||a.name||"",h.name===""&&typeof a.uri=="string"&&a.uri.startsWith("data:image/")===!1&&(h.name=a.uri);const u=(s.samplers||{})[o.sampler]||{};return h.magFilter=pd[u.magFilter]||pn,h.minFilter=pd[u.minFilter]||fi,h.wrapS=md[u.wrapS]||vi,h.wrapT=md[u.wrapT]||vi,i.associations.set(h,{textures:t}),h}).catch(function(){return null});return this.textureCache[c]=l,l}loadImageSource(t,e){const n=this,i=this.json,s=this.options;if(this.sourceCache[t]!==void 0)return this.sourceCache[t].then(d=>d.clone());const o=i.images[t],a=self.URL||self.webkitURL;let c=o.uri||"",l=!1;if(o.bufferView!==void 0)c=n.getDependency("bufferView",o.bufferView).then(function(d){l=!0;const u=new Blob([d],{type:o.mimeType});return c=a.createObjectURL(u),c});else if(o.uri===void 0)throw new Error("THREE.GLTFLoader: Image "+t+" is missing URI and bufferView");const h=Promise.resolve(c).then(function(d){return new Promise(function(u,f){let m=u;e.isImageBitmapLoader===!0&&(m=function(v){const p=new ke(v);p.needsUpdate=!0,u(p)}),e.load(Rr.resolveURL(d,s.path),m,void 0,f)})}).then(function(d){return l===!0&&a.revokeObjectURL(c),ui(d,o),d.userData.mimeType=o.mimeType||N1(o.uri),d}).catch(function(d){throw console.error("THREE.GLTFLoader: Couldn't load texture",c),d});return this.sourceCache[t]=h,h}assignTexture(t,e,n,i){const s=this;return this.getDependency("texture",n.index).then(function(o){if(!o)return null;if(n.texCoord!==void 0&&n.texCoord>0&&(o=o.clone(),o.channel=n.texCoord),s.extensions[ee.KHR_TEXTURE_TRANSFORM]){const a=n.extensions!==void 0?n.extensions[ee.KHR_TEXTURE_TRANSFORM]:void 0;if(a){const c=s.associations.get(o);o=s.extensions[ee.KHR_TEXTURE_TRANSFORM].extendTexture(o,a),s.associations.set(o,c)}}return i!==void 0&&(o.colorSpace=i),t[e]=o,o})}assignFinalMaterial(t){const e=t.geometry;let n=t.material;const i=e.attributes.tangent===void 0,s=e.attributes.color!==void 0,o=e.attributes.normal===void 0;if(t.isPoints){const a="PointsMaterial:"+n.uuid;let c=this.cache.get(a);c||(c=new df,zn.prototype.copy.call(c,n),c.color.copy(n.color),c.map=n.map,c.sizeAttenuation=!1,this.cache.add(a,c)),n=c}else if(t.isLine){const a="LineBasicMaterial:"+n.uuid;let c=this.cache.get(a);c||(c=new uf,zn.prototype.copy.call(c,n),c.color.copy(n.color),c.map=n.map,this.cache.add(a,c)),n=c}if(i||s||o){let a="ClonedMaterial:"+n.uuid+":";i&&(a+="derivative-tangents:"),s&&(a+="vertex-colors:"),o&&(a+="flat-shading:");let c=this.cache.get(a);c||(c=n.clone(),s&&(c.vertexColors=!0),o&&(c.flatShading=!0),i&&(c.normalScale&&(c.normalScale.y*=-1),c.clearcoatNormalScale&&(c.clearcoatNormalScale.y*=-1)),this.cache.add(a,c),this.associations.set(c,this.associations.get(n))),n=c}t.material=n}getMaterialType(){return fe}loadMaterial(t){const e=this,n=this.json,i=this.extensions,s=n.materials[t];let o;const a={},c=s.extensions||{},l=[];if(c[ee.KHR_MATERIALS_UNLIT]){const d=i[ee.KHR_MATERIALS_UNLIT];o=d.getMaterialType(),l.push(d.extendParams(a,s,e))}else{const d=s.pbrMetallicRoughness||{};if(a.color=new Ft(1,1,1),a.opacity=1,Array.isArray(d.baseColorFactor)){const u=d.baseColorFactor;a.color.setRGB(u[0],u[1],u[2],Ye),a.opacity=u[3]}d.baseColorTexture!==void 0&&l.push(e.assignTexture(a,"map",d.baseColorTexture,Ie)),a.metalness=d.metallicFactor!==void 0?d.metallicFactor:1,a.roughness=d.roughnessFactor!==void 0?d.roughnessFactor:1,d.metallicRoughnessTexture!==void 0&&(l.push(e.assignTexture(a,"metalnessMap",d.metallicRoughnessTexture)),l.push(e.assignTexture(a,"roughnessMap",d.metallicRoughnessTexture))),o=this._invokeOne(function(u){return u.getMaterialType&&u.getMaterialType(t)}),l.push(Promise.all(this._invokeAll(function(u){return u.extendMaterialParams&&u.extendMaterialParams(t,a)})))}s.doubleSided===!0&&(a.side=Nn);const h=s.alphaMode||yc.OPAQUE;if(h===yc.BLEND?(a.transparent=!0,a.depthWrite=!1):(a.transparent=!1,h===yc.MASK&&(a.alphaTest=s.alphaCutoff!==void 0?s.alphaCutoff:.5)),s.normalTexture!==void 0&&o!==En&&(l.push(e.assignTexture(a,"normalMap",s.normalTexture)),a.normalScale=new ct(1,1),s.normalTexture.scale!==void 0)){const d=s.normalTexture.scale;a.normalScale.set(d,d)}if(s.occlusionTexture!==void 0&&o!==En&&(l.push(e.assignTexture(a,"aoMap",s.occlusionTexture)),s.occlusionTexture.strength!==void 0&&(a.aoMapIntensity=s.occlusionTexture.strength)),s.emissiveFactor!==void 0&&o!==En){const d=s.emissiveFactor;a.emissive=new Ft().setRGB(d[0],d[1],d[2],Ye)}return s.emissiveTexture!==void 0&&o!==En&&l.push(e.assignTexture(a,"emissiveMap",s.emissiveTexture,Ie)),Promise.all(l).then(function(){const d=new o(a);return s.name&&(d.name=s.name),ui(d,s),e.associations.set(d,{materials:t}),s.extensions&&Xi(i,d,s),d})}createUniqueName(t){const e=me.sanitizeNodeName(t||"");return e in this.nodeNamesUsed?e+"_"+ ++this.nodeNamesUsed[e]:(this.nodeNamesUsed[e]=0,e)}loadGeometries(t){const e=this,n=this.extensions,i=this.primitiveCache;function s(a){return n[ee.KHR_DRACO_MESH_COMPRESSION].decodePrimitive(a,e).then(function(c){return gd(c,a,e)})}const o=[];for(let a=0,c=t.length;a<c;a++){const l=t[a],h=I1(l),d=i[h];if(d)o.push(d.promise);else{let u;l.extensions&&l.extensions[ee.KHR_DRACO_MESH_COMPRESSION]?u=s(l):u=gd(new Pe,l,e),i[h]={primitive:l,promise:u},o.push(u)}}return Promise.all(o)}loadMesh(t){const e=this,n=this.json,i=this.extensions,s=n.meshes[t],o=s.primitives,a=[];for(let c=0,l=o.length;c<l;c++){const h=o[c].material===void 0?C1(this.cache):this.getDependency("material",o[c].material);a.push(h)}return a.push(e.loadGeometries(o)),Promise.all(a).then(function(c){const l=c.slice(0,c.length-1),h=c[c.length-1],d=[];for(let f=0,m=h.length;f<m;f++){const v=h[f],p=o[f];let g;const _=l[f];if(p.mode===Sn.TRIANGLES||p.mode===Sn.TRIANGLE_STRIP||p.mode===Sn.TRIANGLE_FAN||p.mode===void 0)g=s.isSkinnedMesh===!0?new Tx(v,_):new Lt(v,_),g.isSkinnedMesh===!0&&g.normalizeSkinWeights(),p.mode===Sn.TRIANGLE_STRIP?g.geometry=hd(g.geometry,kd):p.mode===Sn.TRIANGLE_FAN&&(g.geometry=hd(g.geometry,ml));else if(p.mode===Sn.LINES)g=new Cx(v,_);else if(p.mode===Sn.LINE_STRIP)g=new Xl(v,_);else if(p.mode===Sn.LINE_LOOP)g=new Px(v,_);else if(p.mode===Sn.POINTS)g=new Lx(v,_);else throw new Error("THREE.GLTFLoader: Primitive mode unsupported: "+p.mode);Object.keys(g.geometry.morphAttributes).length>0&&L1(g,s),g.name=e.createUniqueName(s.name||"mesh_"+t),ui(g,s),p.extensions&&Xi(i,g,p),e.assignFinalMaterial(g),d.push(g)}for(let f=0,m=d.length;f<m;f++)e.associations.set(d[f],{meshes:t,primitives:f});if(d.length===1)return s.extensions&&Xi(i,d[0],s),d[0];const u=new Jt;s.extensions&&Xi(i,u,s),e.associations.set(u,{meshes:t});for(let f=0,m=d.length;f<m;f++)u.add(d[f]);return u})}loadCamera(t){let e;const n=this.json.cameras[t],i=n[n.type];if(!i){console.warn("THREE.GLTFLoader: Missing camera parameters.");return}return n.type==="perspective"?e=new tn(Te.radToDeg(i.yfov),i.aspectRatio||1,i.znear||1,i.zfar||2e6):n.type==="orthographic"&&(e=new va(-i.xmag,i.xmag,i.ymag,-i.ymag,i.znear,i.zfar)),n.name&&(e.name=this.createUniqueName(n.name)),ui(e,n),Promise.resolve(e)}loadSkin(t){const e=this.json.skins[t],n=[];for(let i=0,s=e.joints.length;i<s;i++)n.push(this._loadNodeShallow(e.joints[i]));return e.inverseBindMatrices!==void 0?n.push(this.getDependency("accessor",e.inverseBindMatrices)):n.push(null),Promise.all(n).then(function(i){const s=i.pop(),o=i,a=[],c=[];for(let l=0,h=o.length;l<h;l++){const d=o[l];if(d){a.push(d);const u=new Xt;s!==null&&u.fromArray(s.array,l*16),c.push(u)}else console.warn('THREE.GLTFLoader: Joint "%s" could not be found.',e.joints[l])}return new ql(a,c)})}loadAnimation(t){const e=this.json,n=this,i=e.animations[t],s=i.name?i.name:"animation_"+t,o=[],a=[],c=[],l=[],h=[];for(let d=0,u=i.channels.length;d<u;d++){const f=i.channels[d],m=i.samplers[f.sampler],v=f.target,p=v.node,g=i.parameters!==void 0?i.parameters[m.input]:m.input,_=i.parameters!==void 0?i.parameters[m.output]:m.output;v.node!==void 0&&(o.push(this.getDependency("node",p)),a.push(this.getDependency("accessor",g)),c.push(this.getDependency("accessor",_)),l.push(m),h.push(v))}return Promise.all([Promise.all(o),Promise.all(a),Promise.all(c),Promise.all(l),Promise.all(h)]).then(function(d){const u=d[0],f=d[1],m=d[2],v=d[3],p=d[4],g=[];for(let _=0,x=u.length;_<x;_++){const y=u[_],R=f[_],A=m[_],T=v[_],N=p[_];if(y===void 0)continue;y.updateMatrix&&y.updateMatrix();const V=n._createAnimationTracks(y,R,A,T,N);if(V)for(let M=0;M<V.length;M++)g.push(V[M])}return new py(s,void 0,g)})}createNodeMesh(t){const e=this.json,n=this,i=e.nodes[t];return i.mesh===void 0?null:n.getDependency("mesh",i.mesh).then(function(s){const o=n._getNodeRef(n.meshCache,i.mesh,s);return i.weights!==void 0&&o.traverse(function(a){if(a.isMesh)for(let c=0,l=i.weights.length;c<l;c++)a.morphTargetInfluences[c]=i.weights[c]}),o})}loadNode(t){const e=this.json,n=this,i=e.nodes[t],s=n._loadNodeShallow(t),o=[],a=i.children||[];for(let l=0,h=a.length;l<h;l++)o.push(n.getDependency("node",a[l]));const c=i.skin===void 0?Promise.resolve(null):n.getDependency("skin",i.skin);return Promise.all([s,Promise.all(o),c]).then(function(l){const h=l[0],d=l[1],u=l[2];u!==null&&h.traverse(function(f){f.isSkinnedMesh&&f.bind(u,D1)});for(let f=0,m=d.length;f<m;f++)h.add(d[f]);return h})}_loadNodeShallow(t){const e=this.json,n=this.extensions,i=this;if(this.nodeCache[t]!==void 0)return this.nodeCache[t];const s=e.nodes[t],o=s.name?i.createUniqueName(s.name):"",a=[],c=i._invokeOne(function(l){return l.createNodeMesh&&l.createNodeMesh(t)});return c&&a.push(c),s.camera!==void 0&&a.push(i.getDependency("camera",s.camera).then(function(l){return i._getNodeRef(i.cameraCache,s.camera,l)})),i._invokeAll(function(l){return l.createNodeAttachment&&l.createNodeAttachment(t)}).forEach(function(l){a.push(l)}),this.nodeCache[t]=Promise.all(a).then(function(l){let h;if(s.isBone===!0?h=new lf:l.length>1?h=new Jt:l.length===1?h=l[0]:h=new ue,h!==l[0])for(let d=0,u=l.length;d<u;d++)h.add(l[d]);if(s.name&&(h.userData.name=s.name,h.name=o),ui(h,s),s.extensions&&Xi(n,h,s),s.matrix!==void 0){const d=new Xt;d.fromArray(s.matrix),h.applyMatrix4(d)}else s.translation!==void 0&&h.position.fromArray(s.translation),s.rotation!==void 0&&h.quaternion.fromArray(s.rotation),s.scale!==void 0&&h.scale.fromArray(s.scale);return i.associations.has(h)||i.associations.set(h,{}),i.associations.get(h).nodes=t,h}),this.nodeCache[t]}loadScene(t){const e=this.extensions,n=this.json.scenes[t],i=this,s=new Jt;n.name&&(s.name=i.createUniqueName(n.name)),ui(s,n),n.extensions&&Xi(e,s,n);const o=n.nodes||[],a=[];for(let c=0,l=o.length;c<l;c++)a.push(i.getDependency("node",o[c]));return Promise.all(a).then(function(c){for(let h=0,d=c.length;h<d;h++)s.add(c[h]);const l=h=>{const d=new Map;for(const[u,f]of i.associations)(u instanceof zn||u instanceof ke)&&d.set(u,f);return h.traverse(u=>{const f=i.associations.get(u);f!=null&&d.set(u,f)}),d};return i.associations=l(s),s})}_createAnimationTracks(t,e,n,i,s){const o=[],a=t.name?t.name:t.uuid,c=[];Ai[s.path]===Ai.weights?t.traverse(function(u){u.morphTargetInfluences&&c.push(u.name?u.name:u.uuid)}):c.push(a);let l;switch(Ai[s.path]){case Ai.weights:l=Hs;break;case Ai.rotation:l=Gs;break;case Ai.position:case Ai.scale:l=Ws;break;default:switch(n.itemSize){case 1:l=Hs;break;case 2:case 3:default:l=Ws;break}break}const h=i.interpolation!==void 0?R1[i.interpolation]:Ur,d=this._getArrayFromAccessor(n);for(let u=0,f=c.length;u<f;u++){const m=new l(c[u]+"."+Ai[s.path],e.array,d,h);i.interpolation==="CUBICSPLINE"&&this._createCubicSplineTrackInterpolant(m),o.push(m)}return o}_getArrayFromAccessor(t){let e=t.array;if(t.normalized){const n=Al(e.constructor),i=new Float32Array(e.length);for(let s=0,o=e.length;s<o;s++)i[s]=e[s]*n;e=i}return e}_createCubicSplineTrackInterpolant(t){t.createInterpolant=function(n){const i=this instanceof Gs?A1:Gf;return new i(this.times,this.values,this.getValueSize()/3,n)},t.createInterpolant.isInterpolantFactoryMethodGLTFCubicSpline=!0}}function F1(r,t,e){const n=t.attributes,i=new Xe;if(n.POSITION!==void 0){const a=e.json.accessors[n.POSITION],c=a.min,l=a.max;if(c!==void 0&&l!==void 0){if(i.set(new P(c[0],c[1],c[2]),new P(l[0],l[1],l[2])),a.normalized){const h=Al(Ds[a.componentType]);i.min.multiplyScalar(h),i.max.multiplyScalar(h)}}else{console.warn("THREE.GLTFLoader: Missing min/max properties for accessor POSITION.");return}}else return;const s=t.targets;if(s!==void 0){const a=new P,c=new P;for(let l=0,h=s.length;l<h;l++){const d=s[l];if(d.POSITION!==void 0){const u=e.json.accessors[d.POSITION],f=u.min,m=u.max;if(f!==void 0&&m!==void 0){if(c.setX(Math.max(Math.abs(f[0]),Math.abs(m[0]))),c.setY(Math.max(Math.abs(f[1]),Math.abs(m[1]))),c.setZ(Math.max(Math.abs(f[2]),Math.abs(m[2]))),u.normalized){const v=Al(Ds[u.componentType]);c.multiplyScalar(v)}a.max(c)}else console.warn("THREE.GLTFLoader: Missing min/max properties for accessor POSITION.")}}i.expandByVector(a)}r.boundingBox=i;const o=new jn;i.getCenter(o.center),o.radius=i.min.distanceTo(i.max)/2,r.boundingSphere=o}function gd(r,t,e){const n=t.attributes,i=[];function s(o,a){return e.getDependency("accessor",o).then(function(c){r.setAttribute(a,c)})}for(const o in n){const a=Tl[o]||o.toLowerCase();a in r.attributes||i.push(s(n[o],a))}if(t.indices!==void 0&&!r.index){const o=e.getDependency("accessor",t.indices).then(function(a){r.setIndex(a)});i.push(o)}return re.workingColorSpace!==Ye&&"COLOR_0"in n&&console.warn(`THREE.GLTFLoader: Converting vertex colors from "srgb-linear" to "${re.workingColorSpace}" not supported.`),ui(r,t),F1(r,t,e),Promise.all(i).then(function(){return t.targets!==void 0?P1(r,t.targets,e):r})}const Wf=new n1,_r={turret:/(turret|tower|башн|turm)/i,barrel:/(barrel|ствол|пушк|orudie|орудие|kanone|gun)/i,wheel:/(wheel|кат(ок|к)|roller|ролик|колес|koleso)/i};new P;const ko=new gn;function qf(r){let t=!1;return r.traverse(e=>{e.isMesh&&(t=!0)}),t}function O1(r,t){const e=[];let n=r;for(;n&&n!==t;)e.unshift(n.name||"#"),n=n.parent;return e.join("/")}function Sc(r,t){let e=r;for(const n of t.split("/"))if(e=(e.children||[]).find(i=>(i.name||"#")===n),!e)return null;return e}function vd(r,t){let e=null;return r.traverse(n=>{e||n===r||!n.name||t.test(n.name)&&qf(n)&&(e=n)}),e}function Xf(r){const t=[];return r.traverse(e=>{e!==r&&e.name&&qf(e)&&t.push({name:e.name,path:O1(e,r)})}),t}function z1(r,t,e,n){let i=null,s=0;const o=new Xe,a=new P,c=new P;return r.traverse(l=>{if(!l.isMesh||!l.geometry)return;o.setFromObject(l),o.getSize(a),o.getCenter(c);const h=Math.min(a.x,a.y);a.z>.3*e.z&&a.z>2.2*h&&c.y>n+.42*e.y&&a.z>s&&(s=a.z,i=l)}),i}function B1(r,t={}){const e=t.length??Kt.length,n=t.groundY??Kt.groundY,i=r.clone(!0),s=new Jt,o=new Jt;s.add(o),o.add(i);const a=[];i.traverse(Z=>{Z.isLight&&a.push(Z)}),a.forEach(Z=>Z.parent&&Z.parent.remove(Z));let c=t.yaw||0;const l=()=>(s.updateMatrixWorld(!0),new Xe().setFromObject(i));let h=l(),d=h.getSize(new P);d.x>d.z*1.15&&(c+=Math.PI/2),o.rotation.y=c,h=l(),d=h.getSize(new P);const u=e/Math.max(d.z,1e-4)*(t.scale||1);o.scale.setScalar(u);const f=()=>{h=l();const Z=h.getCenter(new P);o.position.x-=Z.x,o.position.z-=Z.z,o.position.y+=n-h.min.y};f();let m=t.barrelPath&&Sc(i,t.barrelPath)||vd(i,_r.barrel);if(m||(m=z1(i,h,d,n)),m){const st=new Xe().setFromObject(m).getCenter(new P),Q=h.getCenter(new P);st.z<Q.z-.08*d.z&&(c+=Math.PI,o.rotation.y+=Math.PI,f(),h=l(),d=h.getSize(new P))}let v=t.turretPath&&Sc(i,t.turretPath)||vd(i,_r.turret);v===m&&(v=null),s.updateMatrixWorld(!0);const p=(Z,st)=>{st.updateMatrixWorld(!0);const Q=new Jt;return st.add(Q),Q.position.copy(st.worldToLocal(Z.clone())),Q.updateMatrixWorld(!0),Q},g=new Xe().setFromObject(i),_=v?new Xe().setFromObject(v):g,x=_.getCenter(new P),y=p(new P(x.x,v?_.min.y:x.y,x.z),o);v&&y.attach(v);let R,A;if(m){const Z=new Xe().setFromObject(m),st=Z.getSize(new P),Q=Z.getCenter(new P);A=new P(Q.x,Q.y,Z.min.z+.12*st.z),R=new P(Q.x,Q.y,Z.max.z)}else{const Z=g.getCenter(new P),st=g.max.y,Q=n+(st-n)*.62;A=new P(Z.x,Q,Z.z+g.max.z*.15),R=new P(Z.x,Q,g.max.z)}const T=p(A,y),N=new Jt;T.add(N),m&&N.attach(m);const V=new ue;N.add(V),N.updateMatrixWorld(!0),V.position.copy(N.worldToLocal(R.clone())),V.updateMatrixWorld(!0);const M=m?new Xe().setFromObject(m).getSize(new P).z:1.5,b=[],H=Xf(i).map(Z=>Z.path);for(const Z of H){const st=Sc(i,Z);if(!st||!_r.wheel.test(st.name)||_r.turret.test(st.name)||_r.barrel.test(st.name))continue;const Q=new Xe().setFromObject(st),Ot=Q.getCenter(new P),tt=Q.getSize(new P),ot=p(Ot,o);ot.attach(st),b.push({pivot:ot,radius:Math.max(.15,tt.y*.5)})}i.traverse(Z=>{if(Z.isMesh&&(Z.castShadow=!0,Z.receiveShadow=!0,Z.material)){const st=Array.isArray(Z.material)?Z.material:[Z.material];for(const Q of st)"envMapIntensity"in Q&&(Q.envMapIntensity=Math.max(Q.envMapIntensity??1,.8)),Q.side=Yn}});const D={trackOffsetL:0,trackOffsetR:0,recoil:0,recoilVel:0};function F(Z,st={}){const Q=st.speedL||0,Ot=st.speedR||0;D.trackOffsetL+=Q*Z,D.trackOffsetR+=Ot*Z;const tt=9.5;D.recoilVel+=(-135*D.recoil-tt*D.recoilVel)*Z,D.recoil+=D.recoilVel*Z,D.recoil<0&&(D.recoil=0,D.recoilVel<0&&(D.recoilVel*=-.25));const ot=Math.min(1.6,M/4.2);N.position.z=-D.recoil*ot;for(const _t of b)_t.pivot.rotation.x+=Q*Z/_t.radius}function z(Z=1){D.recoilVel=9.2*Z}function U(Z,st){return V.updateWorldMatrix(!0,!1),V.getWorldPosition(Z),T.getWorldQuaternion(ko),st.set(0,0,1).applyQuaternion(ko),Z}function K(Z=3){const st=[];V.updateWorldMatrix(!0,!1);const Q=new P().setFromMatrixPosition(V.matrixWorld);T.getWorldQuaternion(ko);for(let Ot=0;Ot<Z;Ot++){const tt=new P(Math.sin(Ot*2.1)*.18,-.04,.25);tt.applyQuaternion(ko).add(Q),st.push(tt)}return st}const it={size:l().getSize(new P),scale:u,barrel:m?m.name||"(без имени)":"— эвристика среза —",turret:v?v.name||"(без имени)":"— не найдена —",wheels:b.length,muzzleLen:M};return{group:s,turret:y,gunPivot:T,recoilGroup:N,muzzlePoint:V,tracks:{left:{userData:{update(){}}},right:{userData:{update(){}}}},wheels:{left:[],right:[]},materials:{},update:F,fireRecoil:z,getMuzzle:U,getMuzzleBrakepoints:K,state:D,custom:!0,info:it,source:r}}function k1(r){return new Promise((t,e)=>Wf.parse(r,"",t,e))}async function Yf(r){const t=(r.name||"").toLowerCase(),e=await r.arrayBuffer();if(t.endsWith(".glb")||t.endsWith(".gltf"))return(await k1(e)).scene;throw new Error("Нужен .glb или .gltf (встроенные текстуры). Формат: "+t.split(".").pop())}async function V1(r){return(await Wf.loadAsync(r)).scene}const $r=document.querySelector("#app"),Jn=new bx({canvas:$r,antialias:!0,powerPreference:"high-performance"});Jn.setPixelRatio(Math.min(window.devicePixelRatio,1.5));Jn.setSize(window.innerWidth,window.innerHeight);Jn.shadowMap.enabled=!0;Jn.shadowMap.type=Td;Jn.toneMapping=Rd;Jn.toneMappingExposure=1.02;const cn=new rf,jf=new vl(Jn);jf.compileEquirectangularShader();const ye=new tn(55,window.innerWidth/window.innerHeight,.25,1400);ye.position.set(0,6,-14);{const r=new rf,t=new Sa(50,32,20),e=new $e({side:Ze,uniforms:vSkyUniforms(),vertexShader:V_SKY_VS,fragmentShader:V_SKY_FS});r.add(new Lt(t,e));const n=jf.fromScene(r,.035);cn.environment=n.texture;cn.environmentIntensity=1.0;e.dispose(),t.dispose()}const Zr=new mw(Jn);Zr.addPass(new gw(cn,ye));const H1=new qs(new ct(window.innerWidth,window.innerHeight),.40,.78,.95);Zr.addPass(H1);vBuildPost();const vn=Jw(cn),an=new e1;let di=0,shakeT=0;const en=new t1(cn,{onShake:r=>{di=Math.min(1.4,di+r)}});vUpgradeEffects(en,cn);const{props:ba,fires:Vr}=Qw(cn,vn.physics,en);vSceneTune();vn.props=ba;vn.fires=Vr;let qt=kf();cn.add(qt.group);const VCH_InstCls=(()=>{const u=qt.undercarriage||{};const a=u.left||{},b=(qt.tracks&&qt.tracks.left)||{};const i=a.inst||b.inst;return i?i.constructor:null})();const Ee={source:null,name:"",nodes:[],opts:{yaw:0,scale:1,turretPath:null,barrelPath:null}};function Kf(r){const t=qt.group.position.clone(),e=qt.group.quaternion.clone();cn.remove(qt.group),qt=r,qt.group.position.copy(t),qt.group.quaternion.copy(e),cn.add(qt.group),qt.turret.rotation.y=J.turretYaw,qt.gunPivot.rotation.x=-J.elevation,J.camSwitch=2,VCH_ACTIVE&&(VCH_ACTIVE.rig=qt)}function Hr(){if(!Ee.source)return;const r=B1(Ee.source,Ee.opts);Kf(r),sp(r)}function fa(r,t){Ee.source=r,Ee.name=t||"model.glb",Ee.nodes=Xf(r),Ee.opts={yaw:0,scale:1,turretPath:null,barrelPath:null},Hr()}function $f(){Ee.source=null,Ee.name="",Kf(kf()),sp(null)}async function ah(r){try{Gr(`загрузка «${r.name}»…`);const t=await Yf(r);fa(t,r.name)}catch(t){Gr("ОШИБКА: "+t.message,!0),console.error(t)}}async function Zf(r){try{Gr(`загрузка ${r}…`);const t=await V1(r);fa(t,r.split("/").pop())}catch(t){Gr("ОШИБКА: "+t.message,!0),console.error(t)}}const wc=new Ui,_d=new w,xd=new w;function Jf(r,t,e,n=1.6){_d.set(r,t,e),xd.set(r,t-n,e),wc.reset();let i=n,s=!1;vn.physics.raycastClosest(_d,xd,{collisionFilterMask:is|VCH_RAMP,skipBackfaces:!0},wc)&&(i=wc.distance,s=!0);const o=ge(r,e),a=t-o;return a>=-.05&&a<n&&(!s||a<i)&&(i=Math.max(0,a),s=!0),s?i:n}let G1=ge(0,0)+1.16,Vo=new P,Ce=new Vw(vn.physics,{mass:65e3,position:new w(0,G1,0),heightAt:ge,normalAt:(r,t)=>(vn.normalAt(r,t,Vo),{x:Vo.x,y:Vo.y,z:Vo.z})}),Ls=[],Qf=new mn(.09,.13,1.6,8);Qf.rotateX(Math.PI/2);const W1=new fe({color:16756838,emissive:16742944,emissiveIntensity:6,metalness:.4,roughness:.4}),Ii=new P,ss=new P;class q1{constructor(t,e,n=1650){this.pos=t.clone(),this.prev=t.clone(),this.vel=e.clone().multiplyScalar(n),this.speed=n,this.alive=!0,this.age=0,this.mesh=new Lt(Qf,W1),this.mesh.position.copy(t),this.mesh.quaternion.setFromUnitVectors(new P(0,0,1),e.clone().normalize()),cn.add(this.mesh),this.trailTimer=0}update(t){const n=t/5;for(let i=0;i<5&&this.alive;i++){this.prev.copy(this.pos),this.vel.y-=9.82*n,this.pos.addScaledVector(this.vel,n),this.age+=n;const s=new w(this.prev.x,this.prev.y,this.prev.z),o=new w(this.pos.x,this.pos.y,this.pos.z),a=new Ui;if(vn.physics.raycastClosest(s,o,{collisionFilterMask:is|VCH_RAMP,skipBackfaces:!1},a)){this.impactProp(a.hitPointWorld,a.hitNormalWorld,a.body);return}const l=ge(this.pos.x,this.pos.z);if(this.pos.y<=l){const h=this.pos.clone();h.y=l;const d=vn.normalAt(h.x,h.z,new P);en.impact(h,d,1.4),en.spawnDebris(h,1),an.impact(),this.kill();return}this.age>6&&this.kill()}this.mesh.position.copy(this.pos),this.trailTimer+=t,this.trailTimer>.012&&(this.trailTimer=0,en.trail(this.pos))}impactProp(t,e,n){const i=new P(t.x,t.y,t.z),s=new P(e.x,e.y,e.z),o=this.vel.clone().normalize();if(n&&n.mass>0){const c=new w(o.x*2600,o.y*2600+1200,o.z*2600);n.applyImpulse(c,t)}const a=ba.find(c=>c.body===n&&c.alive);a?ch(a,i,o,a.kind==="tank"?2:3):(en.impact(i,s,1.6),en.spawnDebris(i,1),an.impact()),this.kill()}kill(){this.alive=!1,cn.remove(this.mesh),en.impactFlashSmall?.(this.pos)}}let bc=0;function X1(r){if(bc-=r,bc>0)return;bc=.08;const t=Math.abs(Ce.forwardSpeed||0),e=qt.group.position,n=new P(0,0,1).applyQuaternion(qt.group.quaternion);for(const i of ba){if(!i.alive||i.kind==="tank"||!i.destructible)continue;const s=i.mesh.position,o=s.x-e.x,a=s.z-e.z;if(Math.hypot(o,a)>5.8)continue;const l=o*n.x+a*n.z,h=Math.abs(-o*n.z+a*n.x);if(Math.abs(l)>4.8||h>2.4||s.y-e.y>1.8)continue;i.dynamic&&vchKnock(i,new P(n.x,0,n.z),Math.max(.8,t));const d=1.2+t*.55,u=i.kind==="barrel"?.12:i.kind==="crate"?.15:.9;
   /*
  Пропс, в который корпус физически упёрся, всё равно должен ломаться, даже когда
  удар уже остановил танк; иначе танк заклинивает навсегда.
 */
   if(t<u&&!i.dynamic){let touching=!1;
    for(const c of vn.physics.contacts)if(c.bi===Ce.body&&c.bj===i.body||c.bj===Ce.body&&c.bi===i.body){touching=!0;break}
    if(!touching)continue;}const f=new P(s.x,Math.max(s.y,e.y-.6),s.z);ch(i,f,new P(n.x,.15,n.z),d),an.crush(i.kind),en.spawnDebris(f,.85),en.trackDust(f,1,2)}}function ch(r,t,e,n){
 if(!r.destructible){en.impact(t,e.clone().negate(),1.1,.25),an.impact(r.kind);return}
 if(r.hp-=n,r.hp>0){en.impact(t,e.clone().negate(),1.1,.25),en.spawnDebris(t,.7),an.impact(r.kind),r.dynamic&&vchKnock(r,e,n);return}
 r.alive=!1,cn.remove(r.mesh),vn.physics.removeBody(r.body);
 /*
  Взрываются только топливные и автомобильные пропсы. Ящики и остальное просто
  разваливаются: щепа и сухой удар, без огненного шара, без звука взрыва и без
  цепной детонации.
 */
 if(r.kind==="barrel"||r.kind==="car"){
  const i=r.kind==="barrel"?1.5:1.15;
  en.explosion(t,i),an.explosion(i);
  if(r.kind==="car"&&Vr)Vr.addSpot(t.x,t.z,ge(t.x,t.z),22);
  /* цепной подрыв: соседние бочки/машины детонируют волной (60–240 мс),
     остальные свободные пропсы рядом получают толчок и разлетаются */
  if(r.kind==="barrel")for(const s of ba){
   if(!s.alive||s===r||!s.mesh)continue;
   const dd=s.mesh.position.distanceTo(t);
   if(dd>7)continue;
   if(s.kind==="barrel"||s.kind==="car")setTimeout(()=>{s.alive&&ch(s,s.mesh.position.clone(),e,9)},60+Math.random()*180);
   else if(s.dynamic)vchKnock(s,new P(s.mesh.position.x-t.x,0,s.mesh.position.z-t.z),3.2*(1-dd/7)+.6);
  }
 }else{
  en.impact(t,e.clone().negate(),1.4,.3),an.crush();
  for(let k=0;k<(r.kind==="crate"?7:4);k++)en.spawnDebris(t,r.kind==="crate"?1.15:.85);
  if(r.kind==="crate")for(let k=0;k<10;k++)en._get(en.pool).spawn({
   pos:t.clone().add(new P((Math.random()-.5)*.6,(Math.random()-.5)*.4,(Math.random()-.5)*.6)),
   vel:new P((Math.random()-.5)*6,1+Math.random()*3.5,(Math.random()-.5)*6),
   life:.55+Math.random()*.5,size0:.12,size1:.32,color:0x9b7448,drag:2.4,grav:-9,opacity:.75
  });
 }
}
function lh(){if(J.reload>0||J.ammo<=0){J.ammo<=0&&J.ammoRefill<=0&&an.clank();return}J.ammo--,J.reload=J.reloadTime,an.hatch(),qt.getMuzzle(Ii,ss);   /* 5.4: люк */const r=Ii.clone(),t=ss.clone().normalize();en.muzzleBurst(r,t,qt.getMuzzleBrakepoints(4)),an.fire(),qt.fireRecoil(1),Ce.applyRecoilImpulse(t,1),V_ejectSchedule(),Ls.push(new q1(r.clone().addScaledVector(t,.4),t,1650)),di=Math.min(1.5,di+.55),J.ammo===0&&(J.ammoRefill=8)}const J={started:!1,ammo:22,ammoMax:22,ammoRefill:0,reload:0,reloadTime:4.6,turretYaw:0,elevation:0,aimAzWorld:0,aimEl:0,aimMode:"cursor",cursor:{x:.5,y:.5},aimPoint:null,aimFrames:0,reticle:{x:.5,y:.5,visible:!0},stabilizer:!0,cameraMode:0,zoom:11.5,orbitYaw:0,orbitPitch:-.1,camFollow:0,helpVisible:!0,freezeCam:!1},Wn=new Set,Xs={left:!1,right:!1};window.addEventListener("keydown",r=>{const t=r.code;if(Wn.add(t),t==="Space"&&r.preventDefault(),t==="KeyO"){r.preventDefault(),be.file?.click();return}if(t==="KeyM"){r.preventDefault(),be.root?.classList.toggle("hidden");return}J.started&&(t==="KeyV"&&(J.stabilizer=!J.stabilizer,document.querySelector("#stabilizer").classList.toggle("off",!J.stabilizer),document.querySelector("#stabilizer").textContent=J.stabilizer?"СТАБИЛИЗАТОР ВКЛ":"СТАБИЛИЗАТОР ВЫКЛ",an.clank()),t==="Digit1"&&Pr(0),t==="Digit2"&&Pr(1),t==="Digit3"&&Pr(2),t==="KeyT"&&(J.aimMode=J.aimMode==="cursor"?"mouse":"cursor",J.aimMode==="mouse"?$r.requestPointerLock?.():document.exitPointerLock?.(),J.keyAimT=0,uh(),aimSync(),an.clank()),t==="KeyG"&&(showAimDot=!showAimDot,aimSync(),an.clank()),t==="KeyC"&&(Pr((J.cameraMode+1)%3),an.clank()),t==="KeyH"&&(J.helpVisible=!J.helpVisible,document.querySelector("#help").style.opacity=J.helpVisible?"1":"0"),t==="KeyR"&&VCH_FADE.to(()=>location.reload(),320))});window.addEventListener("keyup",r=>Wn.delete(r.code));let tp=!1;document.addEventListener("pointerlockchange",()=>{tp=document.pointerLockElement===$r});$r.addEventListener("contextmenu",r=>r.preventDefault());/* чувствительность мыши — общий множитель для обзора и наведения */
let VCH_SENS=1;
/* ==========================================================================
   7.1 · Привод башни: настройки наведения мышью

   sensX / sensY — чувствительность по осям (множитель к VCH_SENS);
   expo         — насколько ускоряется наведение при быстром движении мыши
                  (0 — линейно, 0.6 — на 60% быстрее на рывке);
   rateY/rateX  — максимальная скорость поворота башни и подъёма ствола, рад/с;
   accY / accX  — ускорение привода, рад/с² (разгон и торможение);
   kP           — с какой ошибки начинается торможение: при расхождении
                  меньше rateY/kP привод снижает скорость и подходит мягко;
   maxLag       — на сколько прицел может оторваться от ствола, рад.
                  Без этого мышь уводит цель на десятки градусов вперёд, а
                  башня секунды догоняет — управление кажется ватным.
   Значения лежат в localStorage["vch.aim.v1"], правятся ползунками во
   вкладке «УПРАВЛЕНИЕ» (F) и из консоли: __vchAim({rateY:1.2}).
   ========================================================================== */
const VCH_AIM={sensX:1,sensY:1,expo:.6,rateY:.95,rateX:.50,accY:6,accX:3.5,kP:7,maxLag:.18,
               pullTau:.8,       /* за сколько секунд «лишний» отрыв прицела стекает */
               maxBacklog:.7,    /* предел «долга»: дальше ввод всё-таки отбрасывается */
               cursorTau:.07};   /* сглаживание точки прицеливания в режиме курсора, с */
{ try{ const raw=localStorage.getItem("vch.aim.v1");
       if(raw){ const o=JSON.parse(raw);
         for(const k of Object.keys(VCH_AIM)) if(typeof o[k]==="number"&&isFinite(o[k])) VCH_AIM[k]=o[k] }
  }catch(e){}
  const save=()=>{ try{ localStorage.setItem("vch.aim.v1",JSON.stringify(VCH_AIM)) }catch(e){} };
  VCH_AIM.gain=m=>1+VCH_AIM.expo*Math.min(1,Math.abs(m)/40);   /* нелинейность */
  VCH_AIM.set=o=>{ for(const k of Object.keys(VCH_AIM))
                     if(typeof o[k]==="number"&&isFinite(o[k])) VCH_AIM[k]=o[k];
                   save(); return VCH_AIM };
  VCH_AIM.save=save;
  window.__vchAim=o=>o?VCH_AIM.set(o):VCH_AIM;
}
document.addEventListener("mousemove",r=>{if(J.started){if(Xs.right){J.orbitYaw-=r.movementX*.0045*VCH_SENS,J.orbitPitch=Te.clamp(J.orbitPitch-r.movementY*.0035*VCH_SENS,-.9,.75);return}if(J.aimMode==="cursor"&&tp&&document.exitPointerLock?.(),J.aimMode==="mouse"){
    /* оси раздельно и мягкая «экспонента»: мелкие поправки остаются
       точными, длинный рывок поворачивает быстрее */
    J.aimAzWorld+=r.movementX*.0011*VCH_SENS*VCH_AIM.sensX*VCH_AIM.gain(r.movementX),
    J.aimEl=Te.clamp(J.aimEl-r.movementY*.0011*.62*VCH_SENS*VCH_AIM.sensY*VCH_AIM.gain(r.movementY),Rl,Cl);
    return}J.cursor.x=r.clientX/window.innerWidth,J.cursor.y=r.clientY/window.innerHeight,hh(),aimSync()}});$r.addEventListener("mousedown",r=>{if(J.started){if(r.button===2){Xs.right=!0;return}r.button===0&&(Xs.left=!0,lh())}});window.addEventListener("mouseup",r=>{r.button===2&&(Xs.right=!1),r.button===0&&(Xs.left=!1)});window.addEventListener("wheel",r=>{J.started&&(J.cameraMode===2?(J.sightFov=Te.clamp((J.sightFov??15)+Math.sign(r.deltaY)*1.6,5,32),J.fovTarget=J.sightFov):J.zoom=Te.clamp(J.zoom+Math.sign(r.deltaY)*1.4,7,42))},{passive:!0});function Pr(r){
 /* 6.4: запоминаем вид между запусками */
 try{localStorage.setItem("vch36.cam",String(r))}catch(e){}
 J.cameraMode=r;const t=document.querySelector("#camlabel");t.textContent=["ВИД: КОМАНДИРСКИЙ","ВИД: ВНЕШНИЙ","ВИД: ПРИЦЕЛ НАВОДЧИКА"][r],document.querySelector("#scope").classList.toggle("off",r!==2),document.querySelector("#hud").classList.toggle("scoped",r===2),J.camSwitch=1,
 /* 6.1: не «прыгаем» фокусным расстоянием — задаём цель, кадр доводит её сам */
 J.fovTarget=r===2?(J.sightFov??15):55,J._fovInit||(ye.fov=J.fovTarget,J._fovInit=!0),
 aimSync()}let Ec=0;const Y1=document.querySelector("#range"),Ho=new P;function j1(r){if(Ec+=r,Ec<.12||J.cameraMode!==2)return;Ec=0,qt.getMuzzle(Ii,ss),Ho.copy(ss).normalize();let t=-1;const e=1400;for(let n=6;n<e;n+=4){const i=Ii.x+Ho.x*n,s=Ii.y+Ho.y*n,o=Ii.z+Ho.z*n;if(s<=ge(i,o)){t=n;break}}Y1.textContent=t>0?`${Math.round(t)} м`:"— м"}const Mn=r=>document.querySelector(r),fn={speed:Mn("#speed"),speedbar:Mn("#speedbar"),gear:Mn("#gear"),trackL:Mn("#trackL"),trackR:Mn("#trackR"),engine:Mn("#engine"),reloadbar:Mn("#reloadbar"),reloadtext:Mn("#reloadtext"),ammo:Mn("#ammo"),az:Mn("#az"),el:Mn("#el"),fps:Mn("#fpsthing")};let Tc=0;function K1(r){if(Tc+=r,Tc<.06)return;Tc=0;const t=Math.abs(Ce.forwardSpeed)*3.6;fn.speed.textContent=Math.round(t),fn.speedbar.style.width=`${Math.min(100,t/60*100)}%`;const e=Ce.input.throttle;fn.gear.textContent=Ce.forwardSpeed>.4?"ПЕРЕДНИЙ ХОД":Ce.forwardSpeed<-.4?"ЗАДНИЙ ХОД":"НЕЙТРАЛЬ (ПОВОРОТ НА МЕСТЕ)";const n=15.5,i=(o,a)=>{const c=Te.clamp(a/n,-1,1);o.style.width=`${Math.abs(c)*50}%`,o.style.left=c>=0?"50%":`${50-Math.abs(c)*50}%`};i(fn.trackL,Ce.speedL),i(fn.trackR,Ce.speedR),fn.engine.textContent=Ce.airborne?"ДВИГАТЕЛЬ: В ВОЗДУХЕ":Math.abs(e)>.05?"ДВИГАТЕЛЬ: НАГРУЗКА":"ДВИГАТЕЛЬ: ХОЛОСТОЙ ХОД";const s=1-J.reload/J.reloadTime;fn.reloadbar.style.width=`${Math.min(100,s*100)}%`,fn.reloadbar.classList.toggle("ready",J.reload<=0),fn.reloadtext.textContent=J.reload>0?`ЗАРЯЖАНИЕ… ${J.reload.toFixed(1)} с`:J.ammo>0?"ГОТОВ К ВЫСТРЕЛУ":"БК ИСЧЕРПАН",fn.ammo.textContent=J.ammo,fn.az.textContent=`${Te.radToDeg(J.turretYaw).toFixed(0)}°`,fn.el.textContent=`${Te.radToDeg(J.elevation).toFixed(1)}°`}const xr=new P,Yi=new P,Go=new P,camBase=new P;let yd=!1;const $1=new gn,Z1=new P;function J1(r){
 if(J.freezeCam)return;
 const t=qt.group.position;
 if(J.cameraMode===2){
  J.camFollow=0;
  qt.turret.updateWorldMatrix(!0,!1);
  const c=qt.turret.getWorldQuaternion($1),l=qt.turret.getWorldPosition(Z1),h=new P(0,0,1).applyQuaternion(c),d=new P(0,1,0).applyQuaternion(c);
  ye.position.copy(l).addScaledVector(d,1.02).addScaledVector(h,.15),qt.getMuzzle(Ii,ss),Go.copy(ye.position).addScaledVector(ss,200),ye.lookAt(Go),yd=!1;
  const u=J.sightFov??15;ye.fov+=(u-ye.fov)*Math.min(1,r*8),ye.updateProjectionMatrix();return;
 }
 ye.fov!==55&&(ye.fov+=(55-ye.fov)*Math.min(1,r*6),ye.updateProjectionMatrix());
 const e=Math.atan2(new P(0,0,1).applyQuaternion(qt.group.quaternion).x,new P(0,0,1).applyQuaternion(qt.group.quaternion).z),
       _cs=(VCH_ACTIVE&&VCH_ACTIVE.camScale)||1,
       n=(J.cameraMode===1?J.zoom*1.35:J.zoom)*_cs;
 /*
  Командирская и внешняя камера теперь панорамируют вместе с башней. Панорама —
  сглаженная доля поворота башни относительно корпуса; свободный обзор правой
  кнопкой остаётся дополнительным смещением. hh() убирает эту панораму из луча
  прицеливания, чтобы орудие никогда не догоняло собственную камеру.
 */
 const rel=Te.clamp(J.turretYaw-J.orbitYaw,-1.8,1.8),want=.85*rel;
 J.camFollow+= (want-J.camFollow)*Math.min(1,r*3.2);
 const i=e+J.orbitYaw+J.camFollow,
       s=J.orbitPitch+(J.cameraMode===1?.2:0);
 xr.copy(t).add(new P(0,(VCH_ACTIVE&&VCH_ACTIVE.lookY)||1.25,0));
 const o=Math.cos(s)*n;
 Yi.set(xr.x+Math.sin(i)*-o,xr.y+Math.sin(-s)*n+.6,xr.z+Math.cos(i)*-o);
 const g=ge(Yi.x,Yi.z)+1.15;if(Yi.y<g)Yi.y=g;
 /*
  Не зависящее от FPS сглаживание по базовому вектору (Kc), который никогда не несёт
  смещение тряски от ударов, поэтому Q1 не может попасть в обратную связь с
  «следованием». Сглаживается только вертикальная часть точки взгляда: корпус
  поднимается на пружинах мелкими шагами каждый кадр.
 */
 yd||(camBase.copy(Yi),Go.copy(xr),yd=!0);
 camBase.lerp(Yi,1-Math.exp(-r*5.5)),camBase.y=Math.max(camBase.y,g),ye.position.copy(camBase);
 Go.x=xr.x,Go.z=xr.z,Go.y+=(xr.y-Go.y)*(1-Math.exp(-r*7)),ye.lookAt(Go);
}
const Ac=new P;
/*
  Тряска от удара: затухающее низкочастотное качание вместо белого шума на каждый
  кадр. Белый шум читается как неприятная высокочастотная дрожь (именно эта
  вибрация и ощущалась при езде по ящикам); плавная осцилляция читается как один
  удар.
 */
function Q1(r){
 if((di=Math.max(0,di-r*2.2))<=.001){Ac.set(0,0,0),shakeT=0;return}
 shakeT+=r;
 const a=.11*di*di,t=shakeT;
 Ac.set((Math.sin(t*78)+.45*Math.sin(t*131+1.7))*a*.75,Math.sin(t*96+.8)*a,(Math.cos(t*67+2.2)+.45*Math.sin(t*119))*a*.75),
 ye.position.add(Ac)
}const Xn=new Jt;{const r=new ua(.75,1,32);r.rotateX(-Math.PI/2);const t=new En({color:16747042,transparent:!0,opacity:.75,side:Nn,depthWrite:!1}),e=new Lt(r,t);e.renderOrder=4,Xn.add(e);const n=new ua(.1,.17,20);n.rotateX(-Math.PI/2);const i=new Lt(n,t.clone());i.material.opacity=.95,i.renderOrder=4,Xn.add(i);const s=new En({color:16747042,transparent:!0,opacity:.9,depthWrite:!1});for(let o=0;o<4;o++){const a=new Di(.06,.5);a.rotateX(-Math.PI/2);const c=new Lt(a,s),l=o/4*Math.PI*2;c.position.set(Math.sin(l)*1.25,0,Math.cos(l)*1.25),c.rotation.y=l,c.renderOrder=4,Xn.add(c)}Xn.visible=!1,Xn.renderOrder=4,cn.add(Xn)}function tb(){const r=J.started&&J.aimMode==="cursor"&&J.aimPoint&&J.cameraMode!==2;if(Xn.visible=!!r,!r)return;const t=J.aimPoint,e=ge(t.x,t.z);Xn.position.set(t.x,Math.max(t.y,e)+.06,t.z);const n=ye.position.distanceTo(Xn.position);Xn.scale.setScalar(Te.clamp(n*.045,.5,3.2))}const Rl=-.16,Cl=.34,Rc=new zy,Md=new ct,Sd=new P,yr=new P,Wo=new P;function ep(r,t,e=1400){let n=e;const i=new w(r.x,r.y,r.z),s=new w(r.x+t.x*e,r.y+t.y*e,r.z+t.z*e),o=new Ui;if(vn.physics.raycastClosest(i,s,{collisionFilterMask:is|VCH_RAMP,skipBackfaces:!0},o)&&(n=Math.min(n,Math.max(.5,o.distance-.25))),t.y<.02)for(let a=3;a<n;a+=2.5){const c=r.x+t.x*a,l=r.y+t.y*a,h=r.z+t.z*a;if(l<=ge(c,h))return a}return n}function hh(){
 Md.set(J.cursor.x*2-1,-(J.cursor.y*2-1)),Rc.setFromCamera(Md,ye);
 const r=Rc.ray.origin,t=new P(Rc.ray.direction.x,Rc.ray.direction.y,Rc.ray.direction.z);
 /*
  Отменяем панораму камеры, следующей за башней: курсор продолжает целиться в
  системе корпуса и свободного обзора, поэтому движение камеры не может попасть в
  обратную связь с башней.
 */
 const ph=J.cameraMode===2?0:-(J.camFollow||0),cc=Math.cos(ph),ss=Math.sin(ph),
       dx=t.x*cc+t.z*ss,dz=-t.x*ss+t.z*cc;t.x=dx;t.z=dz;
 let e=ep(r,t,1600),n=r.x+t.x*e,i=r.y+t.y*e,sz=r.z+t.z*e;
 const o=qt.group.position;
 Math.hypot(n-o.x,sz-o.z)<9&&(e=Math.max(e,26),n=r.x+t.x*e,i=r.y+t.y*e,sz=r.z+t.z*e),
 J.aimPoint=J.aimPoint||new P,J.aimPoint.set(n,i,sz);
}
function uh(){const r=document.querySelector("#aimmode");r&&(r.textContent=J.aimMode==="cursor"?"НАВЕДЕНИЕ: КУРСОР":"НАВЕДЕНИЕ: МЫШЬ (ЗАХВАТ)")}
/* Переключатель режима наведения: «курсор» (прицел — точка на местности) и
   «мышь» (прямой привод башни, захват указателя). Захват включается только по
   жесту пользователя — браузер иначе не даст pointer lock, поэтому он
   запрашивается и здесь, и по клику по канвасу. */
function vchAimModeSet(m){
  J.aimMode=(m==="mouse")?"mouse":"cursor";
  try{ if(J.aimMode==="mouse"){ ($r.requestPointerLock&&document.pointerLockElement!==$r)&&$r.requestPointerLock() }
       else document.exitPointerLock&&document.exitPointerLock() }catch(e){}
  try{ localStorage.setItem("vch.aimMode",J.aimMode) }catch(e){}
  J.aimSmoothInited=0,uh();
  return J.aimMode;
}
window.__vchAimMode=m=>m?vchAimModeSet(m):J.aimMode;
{ try{ const sv=localStorage.getItem("vch.aimMode");
       if(sv==="mouse"||sv==="cursor")J.aimMode=sv }catch(e){}
  document.addEventListener("click",e=>{
    if(J.aimMode==="mouse"&&J.started&&!document.pointerLockElement&&$r){
      try{ if(e.target===$r||($r.contains&&$r.contains(e.target))) $r.requestPointerLock() }catch(_){}
    }});
}function eb(r){const t=new P(0,0,1).applyQuaternion(qt.group.quaternion),e=Math.atan2(t.x,t.z);if(J.aimMode==="cursor"){
   /* Цель раньше пересчитывалась каждый третий кадр (20 Гц на 60 fps) — башня
      шла ступеньками. Считаем каждый кадр: hh() это луч по рельефу, он дешёвый. */
   if(J.cameraMode!==2&&!(J.keyAimT>0)){J.aimFrames++;hh()}
   /* Точка прицеливания сглаживается: у горизонта луч по рельефу прыгает на
      сотни метров от малейшего движения курсора, и без сглаживания башня
      дёргается. Держим и сырую точку (прицел/дальномер), и сглаженную. */
   if(J.aimPoint){
     J.aimSmooth=J.aimSmooth||new P;
     if(!J.aimSmoothInited){J.aimSmooth.copy(J.aimPoint);J.aimSmoothInited=1}
     else{const k=1-Math.exp(-r/VCH_AIM.cursorTau);
          J.aimSmooth.lerp(J.aimPoint,Math.min(1,k))}
   }
   const AP=J.aimSmooth||J.aimPoint;
   if(AP){qt.turret.getWorldPosition(yr),yr.y+=.42;const c=AP.x-yr.x,l=AP.y-yr.y,h=AP.z-yr.z,d=Math.hypot(c,h);d>1.2&&(J.aimAzWorld=Math.atan2(c,h),J.aimEl=Te.clamp(Math.atan2(l,d),Rl,Cl))}
 }let n,o;
 if(J.stabilizer){
  /*
  Качку отката компенсирует узел стабилизатора под башней, поэтому система башни
  по-прежнему совпадает с системой группы корпуса.
 */
  const ce=Math.cos(J.aimEl),
        D=new P(Math.sin(J.aimAzWorld)*ce,Math.sin(J.aimEl),Math.cos(J.aimAzWorld)*ce);
  qHull.copy(qt.group.quaternion);
  const L=D.applyQuaternion(qHull.invert());
  n=Math.atan2(L.x,L.z),o=Math.asin(Te.clamp(L.y,-1,1));
 }else{J.aimAzWorld=J.turretYaw+e,n=J.turretYaw,o=J.aimEl}let i=n-J.turretYaw;i=Math.atan2(Math.sin(i),Math.cos(i));
 /*
  Прицел не должен уезжать от ствола: иначе цель накапливается десятками градусов
  и башня едет за ней секунды. Отрыв свыше maxLag стравливается с постоянной
  времени pullTau — не мгновенной отсечкой, а плавно: при мгновенной отсечке ввод
  просто выбрасывался (рывок мыши на 50° поворачивал башню всё равно на 10°).
 */
 if(J.aimMode!=="cursor"){
   const lm=VCH_AIM.maxLag,ex=Math.abs(i)-lm;
   if(ex>0){
     const sg=i<0?-1:1,over=Math.max(0,ex-VCH_AIM.maxBacklog);
     over>0&&(J.aimAzWorld-=sg*over,i-=sg*over);
     const ex2=Math.abs(i)-lm;
     if(ex2>0){ const pull=Math.min(ex2,ex2/VCH_AIM.pullTau*r);
                J.aimAzWorld-=sg*pull,i-=sg*pull }
   }
 }
 /* привод: желаемая скорость пропорциональна расхождению, но не быстрее
    rateY; сама скорость доводится с ограничением ускорения — башня
    разгоняется и тормозит, а не идёт «в упор» и не встаёт рывком */
 { const k=(J.aimMode==="cursor"?.95:1),      /* курсор: как было 0.85 рад/с */
         rY=VCH_AIM.rateY*k,rX=VCH_AIM.rateX*k;
   J.turretRate=J.turretRate||0;J.elevRate=J.elevRate||0;
   const wY=Te.clamp(i*VCH_AIM.kP,-rY,rY),
         wX=Te.clamp((o-J.elevation)*VCH_AIM.kP,-rX,rX);
   J.turretRate+=Te.clamp(wY-J.turretRate,-VCH_AIM.accY*r,VCH_AIM.accY*r);
   J.elevRate  +=Te.clamp(wX-J.elevRate,  -VCH_AIM.accX*r,VCH_AIM.accX*r);
   /* шаг не может перескочить цель: на низком FPS башня иначе проскакивает */
   let dY=J.turretRate*r,dX=J.elevRate*r,ge=o-J.elevation;
   dY=i>=0?Math.min(dY,i):Math.max(dY,i);
   dX=ge>=0?Math.min(dX,ge):Math.max(dX,ge);
   J.turretYaw+=dY;
   J.elevation+=dX;
 }
 J.turretYaw=Math.atan2(Math.sin(J.turretYaw),Math.cos(J.turretYaw));
 const slack=Math.min(1.0,Math.abs(Ce.pitch||0)+Math.abs(Ce.roll||0)+.1);
 J.elevation=Te.clamp(J.elevation,Rl-.03-slack,Cl+.03+slack),qt.turret.rotation.y=J.turretYaw,qt.gunPivot.rotation.x=-J.elevation}const qHull=new gn;
/*
  Z / X — поворот башни с клавиатуры вдобавок к наведению указателем. Опорное
  направление прицеливания (aimPoint, aimAzWorld) и невидимый виртуальный курсор
  поворачиваются на тот же угол, поэтому наведение указателем продолжает показывать
  туда, куда смотрит орудие, а башня удерживает новое положение после отпускания
  клавиш. Пока клавиши зажаты, периодический шаг «курсор→прицел» пропускается
  (J.keyAimT), чтобы они не боролись друг с другом; реальное движение мышью сразу
  пересчитывает прицел заново.
 */
const VCH_TURRET_KEY_RATE=.75;
const _tsv=new P;
function syncCursorToAim(){
 if(!J.aimPoint)return;
 const v=_tsv.copy(J.aimPoint).sub(ye.position),
       cf=J.camFollow||0,c=Math.cos(cf),s=Math.sin(cf),
       tx=v.x*c+v.z*s, tz=v.z*c-v.x*s;
 _tsv.set(ye.position.x+tx,ye.position.y+v.y,ye.position.z+tz).project(ye),
 _tsv.z<1&&isFinite(_tsv.x)&&isFinite(_tsv.y)&&(
   J.cursor.x=Te.clamp(_tsv.x*.5+.5,-1.5,2.5),J.cursor.y=Te.clamp(.5-_tsv.y*.5,-1.5,2.5))
}
function turretKeys(r){
 J.keyAimT=Math.max(0,(J.keyAimT||0)-r);
 if(!J.started||J.freezeCam)return;
 const kz=Wn.has("KeyZ"),kx=Wn.has("KeyX");
 if(kz===kx)return;
 J.keyAimT=.3;
 const dY=(kz?1:-1)*VCH_TURRET_KEY_RATE*r;
 J.turretYaw=Math.atan2(Math.sin(J.turretYaw+dY),Math.cos(J.turretYaw+dY)),
 qt.turret.rotation.y=J.turretYaw,J.aimAzWorld+=dY;
 if(J.aimMode==="cursor"&&J.aimPoint){
   const p=qt.group.position,ax=J.aimPoint.x-p.x,az=J.aimPoint.z-p.z,
         c=Math.cos(dY),s=Math.sin(dY);
   J.aimPoint.x=p.x+ax*c+az*s,J.aimPoint.z=p.z+az*c-ax*s,
   J.cameraMode!==2&&syncCursorToAim()
 }
}
let Cc=0;
const aimDot=document.querySelector("#aimdot");
/*
  Системный курсор во время игры скрыт (CSS: body.playing #app{cursor:none}),
  поэтому указателю нужен свой маркер. Он намеренно маленький и тусклый: яркий
  #crosshair показывает, куда реально попадёт орудие, а этот лишь отмечает
  указатель.
 */
let showAimDot=!1;
function aimSync(){
 if(!aimDot)return;
 const on=showAimDot&&J.started&&J.aimMode==="cursor"&&J.cameraMode!==2;
 aimDot.style.display=on?"block":"none";
 on&&(aimDot.style.left=J.cursor.x*window.innerWidth+"px",aimDot.style.top=J.cursor.y*window.innerHeight+"px")
}
function nb(r){if(Cc+=r,Cc<.033)return;Cc=0;const t=Ii,e=ss;qt.getMuzzle(t,e);const n=ep(t,e,1200);Sd.copy(t).addScaledVector(e,Math.min(n,1200)),Wo.copy(Sd).project(ye);const i=Wo.z>1,s=(Wo.x*.5+.5)*window.innerWidth,o=(-Wo.y*.5+.5)*window.innerHeight,a=document.querySelector("#crosshair");a&&(i||s<-80||o<-80||s>window.innerWidth+80||o>window.innerHeight+80?a.style.opacity="0":(a.style.opacity="0.95",a.style.left=`${s}px`,a.style.top=`${o}px`,a.style.transform="translate(-50%, -50%)"))}function ib(r){let t=0,e=0;(Wn.has("KeyW")||Wn.has("ArrowUp"))&&(t+=1),(Wn.has("KeyS")||Wn.has("ArrowDown"))&&(t-=1),(Wn.has("KeyA")||Wn.has("ArrowLeft"))&&(e-=1),(Wn.has("KeyD")||Wn.has("ArrowRight"))&&(e+=1);e=Te.clamp(e,-1,1),t=Te.clamp(t,-1,1);/* Shift — форсаж: тот же ход, но с прибавкой тяги (см. settings.accel×1.35) */
/* 6.3: ход и поворот складываем с виртуальным стиком */
const tt=te=>te,boost=(Wn.has("ShiftLeft")||Wn.has("ShiftRight"))?1.35:1;
if(VCH_TOUCH.on){t+=VCH_TOUCH.throttle;e+=VCH_TOUCH.steer;if(VCH_TOUCH.throttle>.6)boost=VCH_TOUCH.boost}
const n=Te.clamp(t,-1,1)*boost,i=J.smoothThrottle??0;J.smoothThrottle=i+(n-i)*Math.min(1,r*4.5);const s=J.smoothSteer??0;J.smoothSteer=s+(e-s)*Math.min(1,r*6),Ce.setInput(J.smoothThrottle,J.smoothSteer),Xs.left&&lh()}const wd=new P,_wdF=new P,_dustDrift=new P;
/* Пыль из-под гусениц. Эмиссия — покадрово на каждый трак, поэтому количество
   растёт со скоростью: пара клубов на ползком, плотная волна на полном газу.
   Каждому клубу передаётся часть кормового вектора скорости, чтобы шлейф
   тянулся за машиной, а не висел на месте. Разворот на месте тоже пылит —
   гусеницы буксуют, даже когда корпус стоит. */
function sb(r){
 const t=Math.abs(Ce.forwardSpeed),
       s=Math.max(t,(Math.abs(Ce.speedL||0)+Math.abs(Ce.speedR||0))*.22);
 if(s<.5||Ce.airborne)return;
 const q=qt.group.quaternion;
 _wdF.set(0,0,1).applyQuaternion(q);
 const cnt=1+Math.floor(s*.15),prob=Math.min(.85,.24+s*.05);
 for(const n of[-1,1]){
  _dustDrift.set(-_wdF.x*s*.17,0,-_wdF.z*s*.17);
  for(let i=0;i<cnt;i++){
   if(Math.random()>prob)continue;
   wd.set(n*Kt.trackHalfTrack,Kt.groundY+.08,-2.7+Math.random()*3.4).applyQuaternion(q).add(qt.group.position);
   en.trackDust(wd,1,1+s*.05,_dustDrift)
  }
 }
}
