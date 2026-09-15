/* Ærlig prøve: sandheden er IKKE lineær i temperaturen.
   Tre realistiske former, ingen af dem identisk med nogen af modellerne. */
import { median, mad } from '/home/user/jej2j2j2je/src/statistik.js';
import * as M from './modeller.mjs';

const SANDHEDER={
  // Køleanlæg: flad under 10 °C (kondensering begrænset af min-tryk), stiger derefter kvadratisk
  koel:(t,aaben,we)=>(200+8*Math.max(0,t-10)+0.55*Math.max(0,t-10)**2)*(we?0.93:1),
  // Ventilation: tidsstyret, temperaturuafhængig i drift, men med køleflade over 18
  vent:(t,aaben,we)=>(we?70:180)+(t>18?22*(t-18):0),
  // Butik med både varme og køl: V-form med knæk ved 14, forskellige hældninger
  blandet:(t,aaben,we)=>(600-18*Math.max(0,14-t)+31*Math.max(0,t-14))*(we?0.88:1),
};

function serie(sandhed,fejl,froe,hetero){
  let s=froe;const rnd=()=>{s=(s*1103515245+12345)%2147483648;return s/2147483648;};
  const r=[];const start=new Date('2024-09-16T00:00:00Z');
  for(let i=0;i<730;i++){
    const d=new Date(start.getTime()+i*864e5);
    const ad=d.getMonth()*30.4+d.getDate();
    const t=Math.round((8.8+8.2*Math.sin((ad-115)/365*2*Math.PI)+(rnd()-0.5)*6)*10)/10;
    const we=d.getDay()===0||d.getDay()===6;
    let k=SANDHEDER[sandhed](t,true,we);
    if(fejl==='spring'&&i>=615) k+=k*0.18;
    if(fejl==='glidende'&&i>=615) k+=k*0.25*Math.min(1,(i-615)/60);
    if(fejl==='fald'&&i>=615) k*=0.12;
    const sp=hetero? k*0.04+hetero*Math.max(0,t) : k*0.10;
    r.push({dato:d.toISOString().slice(0,10),ugedag:d.getDay(),aaben:true,temperatur:t,
      kwh:Math.max(0,Math.round(k+(rnd()-0.5)*sp))});
  }
  return r;
}

function proev(bygModel,findCP,saeson){
  let fund=0,fejlSager=0,falsk=0,rene=0,bias=[];
  for(const sandhed of Object.keys(SANDHEDER)) for(const froe of [11,222,3333,44,5555,66,777,8888])
  for(const fejl of ['ingen','spring','glidende','fald']){
    const r=serie(sandhed,fejl,froe,4);
    const nu=r.slice(-120), foer=r.slice(0,-120);
    let ref=foer;
    if(saeson){const t=nu.map(x=>x.temperatur);const lav=Math.min(...t),hoej=Math.max(...t),luft=(hoej-lav)*0.15;
      const u=foer.filter(x=>x.temperatur>=lav-luft&&x.temperatur<=hoej+luft);if(u.length>=45)ref=u;}
    const mod=bygModel(ref,'temperatur');
    const res=nu.map(x=>x.kwh-mod.forudsig(x));
    const rr=ref.map(x=>x.kwh-mod.forudsig(x));
    const tt=ref.map(x=>x.temperatur).sort((a,b)=>a-b);
    const sk=[0.33,0.66].map(q=>tt[Math.floor(q*(tt.length-1))]);
    const sp=[0,1,2].map(i=>{const lo=i===0?-1e9:sk[i-1],hi=i===2?1e9:sk[i];
      const v=ref.filter(x=>x.temperatur>lo&&x.temperatur<=hi).map(x=>x.kwh-mod.forudsig(x));
      return v.length>=8?(mad(v)||1):null;});
    for(let i=0;i<3;i++) if(sp[i]==null) sp[i]=sp.find(x=>x!=null)||1;
    const std=nu.map((x,i)=>res[i]/Math.max(sp[x.temperatur<=sk[0]?0:x.temperatur<=sk[1]?1:2],1e-6));
    const cp=findCP(std);
    const seg=cp!=null?res.slice(cp):res;
    const forv=median(nu.slice(cp??0).map(x=>mod.forudsig(x)))||1;
    const afvig=median(seg)/forv;
    const opdaget=Math.abs(afvig)>0.05;
    if(fejl==='ingen'){rene++;if(opdaget)falsk++;
      // hvor forkert er normalen på en ren serie? det er modellens BIAS
      bias.push(Math.abs(median(res)/forv));}
    else {fejlSager++;if(opdaget)fund++;}
  }
  return {opdaget:fund/fejlSager,falsk:falsk/rene,bias:median(bias)};
}

console.log('SANDHEDEN ER IKKE LINEÆR — tre realistiske anlægsformer, vejrafhængig støj\n');
console.log('model                opdaget   falske alarmer   skævhed på ren serie');
for(const [n,f] of [['OLS (nuværende)',M.modelOLS],['TOWT',M.modelTOWT],['Medianregression',M.modelMedian],['k-NN',M.modelKNN]]){
  const r=proev(f,M.cpCUSUM,true);
  console.log(n.padEnd(21),(r.opdaget*100).toFixed(0).padStart(5)+' %',(r.falsk*100).toFixed(0).padStart(13)+' %',(r.bias*100).toFixed(1).padStart(18)+' %');
}
console.log('\nUDEN sæsonvalgt reference (hele perioden før):');
for(const [n,f] of [['OLS (nuværende)',M.modelOLS],['TOWT',M.modelTOWT],['k-NN',M.modelKNN]]){
  const r=proev(f,M.cpCUSUM,false);
  console.log(n.padEnd(21),(r.opdaget*100).toFixed(0).padStart(5)+' %',(r.falsk*100).toFixed(0).padStart(13)+' %',(r.bias*100).toFixed(1).padStart(18)+' %');
}
console.log('\nSKIFTEPUNKT (bedste model):');
for(const [n,f] of [['CUSUM (nuværende)',M.cpCUSUM],['Binær segmentering',M.cpBinaer],['BIC-straffet',M.cpBIC]]){
  const r=proev(M.modelTOWT,f,true);
  console.log(n.padEnd(21),(r.opdaget*100).toFixed(0).padStart(5)+' %',(r.falsk*100).toFixed(0).padStart(13)+' %');
}
