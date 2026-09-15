/* Fire normallastmodeller og tre skiftepunktsmetoder, scoret mod kendt facit.
   Alle implementeret direkte — ingen pakker, ingen netværk. */
import { median, mad, regression, theilSen, cusum } from '/home/user/jej2j2j2je/src/statistik.js';

/* ---------- NORMALLASTMODELLER ---------- */

// A) Nuværende: lineær eller knækket OLS ved 15 °C
export function modelOLS(ref, tempvar, knaek=15){
  const lin=regression(ref.map(r=>({...r,y:r.kwh})),[tempvar]);
  const har=ref.some(r=>r[tempvar]>knaek)&&ref.some(r=>r[tempvar]<knaek);
  if(har){
    const m=ref.map(r=>({...r,y:r.kwh,_h:Math.max(0,knaek-r[tempvar]),_k:Math.max(0,r[tempvar]-knaek)}));
    const kn=regression(m,['_h','_k']);
    if(kn&&(!lin||kn.rmse<lin.rmse*0.97))
      return {navn:'OLS knækket',forudsig:r=>kn.forudsig({_h:Math.max(0,knaek-r[tempvar]),_k:Math.max(0,r[tempvar]-knaek)})};
  }
  return {navn:'OLS lineær',forudsig:lin?lin.forudsig:()=>median(ref.map(r=>r.kwh))};
}

// B) TOWT — tid-på-ugen × temperaturbånd (LBNL/ASHRAE-standarden for M&V)
export function modelTOWT(ref, tempvar, baand=6){
  const t=ref.map(r=>r[tempvar]).sort((a,b)=>a-b);
  const skaer=Array.from({length:baand-1},(_,i)=>t[Math.floor((i+1)/baand*(t.length-1))]);
  const bin=v=>{let i=0;while(i<skaer.length&&v>skaer[i])i++;return i;};
  const dagtype=r=>(r.aaben===false?2:(r.ugedag===0||r.ugedag===6)?1:0);
  const celle={};
  for(const r of ref){const n=dagtype(r)+'|'+bin(r[tempvar]);(celle[n]||=[]).push(r.kwh);}
  const m={};for(const[k,v]of Object.entries(celle))if(v.length>=3)m[k]=median(v);
  const alle=median(ref.map(r=>r.kwh));
  return {navn:'TOWT',forudsig:r=>{
    const n=dagtype(r)+'|'+bin(r[tempvar]);
    if(m[n]!=null)return m[n];
    // nærmeste bånd i samme dagtype
    for(let d=1;d<baand;d++)for(const s of[-d,d]){const k2=dagtype(r)+'|'+(bin(r[tempvar])+s);if(m[k2]!=null)return m[k2];}
    return alle;}};
}

// C) Medianregression (kvantilregression, q=0.5) — robust over for skæv støj
export function modelMedian(ref, tempvar){
  // iterativt vægtede mindste kvadrater mod L1
  let b=theilSen(ref.map(r=>({x:r[tempvar],y:r.kwh})));
  if(!b) return {navn:'Medianregression',forudsig:()=>median(ref.map(r=>r.kwh))};
  let {haeldning:h,skaering:s}=b;
  for(let it=0;it<25;it++){
    const w=ref.map(r=>1/Math.max(1e-6,Math.abs(r.kwh-(s+h*r[tempvar]))));
    let sw=0,swx=0,swy=0,swxx=0,swxy=0;
    ref.forEach((r,i)=>{const q=w[i],x=r[tempvar],y=r.kwh;sw+=q;swx+=q*x;swy+=q*y;swxx+=q*x*x;swxy+=q*x*y;});
    const det=sw*swxx-swx*swx; if(Math.abs(det)<1e-9)break;
    h=(sw*swxy-swx*swy)/det; s=(swy-h*swx)/sw;
  }
  return {navn:'Medianregression',forudsig:r=>s+h*r[tempvar]};
}

// D) k-nærmeste nabo på (temperatur, dagtype) — kan pr. konstruktion ikke ekstrapolere
export function modelKNN(ref, tempvar, k=15){
  const dagtype=r=>(r.aaben===false?2:(r.ugedag===0||r.ugedag===6)?1:0);
  const punkter=ref.map(r=>({t:r[tempvar],d:dagtype(r),y:r.kwh}));
  return {navn:'k-NN',forudsig:r=>{
    const d=dagtype(r),t=r[tempvar];
    const kand=punkter.filter(p=>p.d===d); const brug=kand.length>=k?kand:punkter;
    const n=brug.map(p=>({...p,afs:Math.abs(p.t-t)})).sort((a,b)=>a.afs-b.afs).slice(0,k);
    return median(n.map(p=>p.y));}};
}

/* ---------- SKIFTEPUNKTSMETODER ---------- */

// 1) Nuværende: CUSUM-argmax på standardiserede residualer
export function cpCUSUM(y){const r=cusum(y,{minStyrke:2.5,minSegment:7});return r?r.indeks:null;}

// 2) Binær segmentering: prøv hvert punkt, tag den mindste samlede SSE
export function cpBinaer(y,minSeg=7){
  let bedst=null,bedstSSE=Infinity;
  const sse=(a)=>{const m=a.reduce((x,z)=>x+z,0)/a.length;return a.reduce((x,z)=>x+(z-m)**2,0);};
  const helSSE=sse(y);
  for(let i=minSeg;i<y.length-minSeg;i++){
    const s=sse(y.slice(0,i))+sse(y.slice(i));
    if(s<bedstSSE){bedstSSE=s;bedst=i;}
  }
  // kræv at delingen forklarer mindst 10 % mere
  return (bedst!=null&&bedstSSE<helSSE*0.9)?bedst:null;
}

// 3) Bayesiansk-inspireret: log-likelihood-ratio med straf for modelkompleksitet (BIC)
export function cpBIC(y,minSeg=7){
  const n=y.length;
  const varians=(a)=>{const m=a.reduce((x,z)=>x+z,0)/a.length;return Math.max(1e-9,a.reduce((x,z)=>x+(z-m)**2,0)/a.length);};
  const l0=-n/2*Math.log(varians(y));
  let bedst=null,bedstL=-Infinity;
  for(let i=minSeg;i<n-minSeg;i++){
    const l=-i/2*Math.log(varians(y.slice(0,i)))-(n-i)/2*Math.log(varians(y.slice(i)));
    if(l>bedstL){bedstL=l;bedst=i;}
  }
  // BIC-straf for de to ekstra parametre
  return (bedstL-l0 > Math.log(n))?bedst:null;
}
