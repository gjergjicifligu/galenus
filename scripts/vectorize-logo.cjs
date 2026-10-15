// Trace the supplied artwork's silhouette into real SVG geometry; no embedded raster.
const sharp = require('sharp');
const fs = require('node:fs');
(async()=>{
 const {data,info}=await sharp('public/logo-source.png').removeAlpha().raw().toBuffer({resolveWithObject:true});
 const w=info.width,h=info.height,c=info.channels;
 const mask=new Uint8Array(w*h);
 for(let i=0;i<w*h;i++)mask[i]=Math.min(data[i*c],data[i*c+1],data[i*c+2])<180?1:0;
 const edges=new Map(); const point=(x,y)=>y*(w+1)+x;
 function add(a,b){if(!edges.has(a))edges.set(a,[]);edges.get(a).push(b);}
 for(let y=0;y<h;y++)for(let x=0;x<w;x++)if(mask[y*w+x]){
   if(y===0||!mask[(y-1)*w+x])add(point(x,y),point(x+1,y));
   if(x===w-1||!mask[y*w+x+1])add(point(x+1,y),point(x+1,y+1));
   if(y===h-1||!mask[(y+1)*w+x])add(point(x+1,y+1),point(x,y+1));
   if(x===0||!mask[y*w+x-1])add(point(x,y+1),point(x,y));
 }
 const paths=[];
 while(edges.size){const start=edges.keys().next().value;let at=start;const points=[];
   do{points.push([at%(w+1),Math.floor(at/(w+1))]);const choices=edges.get(at);if(!choices)break;const next=choices.pop();if(!choices.length)edges.delete(at);at=next;}while(at!==start);
   if(points.length<5)continue;
   const simplified=points.filter((p,i)=>{const a=points[(i+points.length-1)%points.length],b=points[(i+1)%points.length];return (p[0]-a[0])*(b[1]-p[1])!==(p[1]-a[1])*(b[0]-p[0]);});
   paths.push('M'+simplified.map(p=>p.join(',')).join('L')+'Z');
 }
 const svg=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="135 173 815 735" role="img" aria-labelledby="title"><title id="title">Galenus Med Academy</title><defs><linearGradient id="brand" x1="350" y1="300" x2="700" y2="520" gradientUnits="userSpaceOnUse"><stop stop-color="#11B9BA"/><stop offset="1" stop-color="#023061"/></linearGradient><clipPath id="art"><path fill-rule="evenodd" clip-rule="evenodd" d="${paths.join('')}"/></clipPath></defs><g clip-path="url(#art)"><path fill="url(#brand)" d="M0 0H1080V735H0Z"/><path fill="#023061" d="M0 735H1080V855H0Z"/><path fill="#11B9BA" d="M265 735H365V855H265Z M0 855H1080V1080H0Z"/></g></svg>`;
 fs.writeFileSync('public/logo.svg',svg);
 await sharp(Buffer.from(svg)).resize(815).flatten({background:'#ffffff'}).png().toFile('test-results/logo-vector.png');
 console.log(`Traced ${paths.length} contours into SVG geometry.`);
})();
