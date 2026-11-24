// A small vector title treatment painted directly into the projector texture.
const letterPaths = {
  A: 'M0 100 28 0 53 0 77 100 55 100 50 77 29 77 22 100Z M33 58 46 58 41 28Z',
  V: 'M0 0 23 0 39 73 56 0 79 0 52 100 25 100Z',
  E: 'M0 0 64 0 64 18 22 18 22 39 56 39 55 57 22 57 22 82 65 82 64 100 0 100Z',
  N: 'M0 100 0 0 23 0 53 60 53 0 73 0 73 100 51 100 20 39 20 100Z',
  G: 'M15 0 56 0 70 12 70 30 49 30 49 21 46 17 27 17 22 23 22 76 27 82 49 82 49 61 37 61 37 45 70 45 70 100 57 96 51 100 15 100 0 85 0 16Z',
  R: 'M0 0 52 0 69 15 69 45 54 56 77 100 52 100 33 61 22 61 22 100 0 100Z M22 18 22 43 41 43 47 38 47 23 42 18Z',
  S: 'M14 0 55 0 68 13 68 28 47 28 47 22 43 17 27 17 21 22 21 33 25 37 53 44 68 57 68 85 53 100 14 100 0 87 0 71 21 71 21 78 26 83 42 83 47 78 47 65 43 61 15 54 0 42 0 15Z',
};

const widths = { A: 77, V: 79, E: 65, N: 73, G: 70, R: 77, S: 68 };

function drawWordmark(ctx, width, height) {
  const title = 'AVENGERS';
  const shape = new Path2D();
  let pen = 0;
  for (let i = 0; i < title.length; i++) {
    const ch = title[i];
    const first = i === 0;
    const matrix = new DOMMatrix([first ? 1.07 : 1, 0, -0.205, first ? 1.27 : 1, pen + 17, first ? -18 : 0]);
    shape.addPath(new Path2D(letterPaths[ch]), matrix);
    pen += widths[ch] + (first ? 4 : 5);
  }

  ctx.save();
  const scale = width * 0.641 / pen;
  ctx.translate(width * 0.5 - pen * scale / 2, height * 0.5 - scale * 58);
  ctx.scale(scale, scale * 0.91);
  ctx.lineJoin = 'bevel';

  ctx.save();
  ctx.translate(1, 6);
  ctx.shadowColor = 'rgba(0,0,0,.95)';
  ctx.shadowBlur = 14;
  ctx.shadowOffsetY = 5;
  ctx.fillStyle = '#030807';
  ctx.fill(shape, 'evenodd');
  ctx.restore();
  // Slightly offset copies are the graphite sidewall below the silver face.
  for (let d = 6; d >= 1; d--) {
    ctx.save();
    ctx.translate(d * 0.45, d);
    ctx.strokeStyle = d === 6 ? '#476054' : '#182522';
    ctx.lineWidth = 2.3;
    ctx.stroke(shape);
    ctx.fillStyle = '#101a17';
    ctx.fill(shape, 'evenodd');
    ctx.restore();
  }
  const chrome = ctx.createLinearGradient(0, -17, 13, 110);
  [[0,'#e9ece7'],[.12,'#f5f4ed'],[.32,'#aab6b2'],[.49,'#74817e'],[.5,'#586361'],[.65,'#9ca5a2'],[.85,'#dce0d8'],[1,'#80968d']].forEach(([p,c])=>chrome.addColorStop(p,c));
  ctx.fillStyle = chrome;
  ctx.fill(shape, 'evenodd');
  ctx.save();
  ctx.clip(shape, 'evenodd');
  const glint = ctx.createLinearGradient(0, 0, pen, 13);
  [[0,'#fff7e52c'],[.20,'#0c1a1d31'],[.27,'#ffffff50'],[.38,'#13242613'],[.64,'#06120e45'],[.78,'#f4fff740'],[1,'#04232236']].forEach(([p,c])=>glint.addColorStop(p,c));
  ctx.fillStyle=glint;
  ctx.fillRect(-10,-20,pen+50,152);
  // The bevel has a bright upper lip and a darker incised lower edge.
  ctx.lineWidth=2.5;
  ctx.strokeStyle='#e5ebe290';
  ctx.stroke(shape);
  ctx.translate(0, 1.6);
  ctx.lineWidth=.75;
  ctx.strokeStyle='#354b405c';
  ctx.stroke(shape);
  ctx.restore();
  ctx.restore();

  const sub='DOOMSDAY';
  ctx.save();
  ctx.font = '700 49px "Segoe UI",Arial,sans-serif';
  ctx.textBaseline='alphabetic';
  const advances = [...sub].map(c=>ctx.measureText(c).width);
  const tracking=18;
  let x=(width-advances.reduce((a,b)=>a+b,0)-tracking*(sub.length-1))/2;
  const baseline = height*.5+scale*73;
  const green=ctx.createLinearGradient(0,baseline-38,0,baseline);
  green.addColorStop(0,'#d3eeca'); green.addColorStop(.31,'#92dba5'); green.addColorStop(1,'#5aab7b');
  ctx.fillStyle=green;
  ctx.shadowColor='#152f24'; ctx.shadowBlur=4; ctx.shadowOffsetY=3;
  [...sub].forEach((c,i)=>{ctx.fillText(c,x,baseline);x+=advances[i]+tracking;});
  ctx.restore();
}

export function makeScreenTexture(THREE) {
  const canvas=document.createElement('canvas');
  const W=canvas.width=1840, H=canvas.height=800;
  const ctx=canvas.getContext('2d');
  let seed=86724;
  const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  const gradient=(x0,y0,x1,y1,stops)=>{
    const g=ctx.createLinearGradient(x0,y0,x1,y1);
    stops.forEach(([at,color])=>g.addColorStop(at,color)); return g;
  };
  const polygon=(points)=>{
    const p=new Path2D(); p.moveTo(...points[0]);
    for(let i=1;i<points.length;i++) p.lineTo(...points[i]);
    p.closePath(); return p;
  };
  const face=(pts,ax,ay,bx,by,colors)=>{
    const p=polygon(pts);
    ctx.fillStyle=gradient(ax,ay,bx,by,colors);
    ctx.fill(p);
    ctx.save(); ctx.clip(p);
    // Fine brushed machining and a few shallow diagonal surface scratches.
    for(let i=0;i<420;i++) {
      const x=random()*W, y=random()*H, l=4+random()**2*110;
      ctx.strokeStyle=`rgba(193,231,207,${random()*.072})`; ctx.lineWidth=.7;
      ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+l,y-l*.72);ctx.stroke();
    }
    ctx.strokeStyle='#a1c6af33';ctx.lineWidth=1.7;ctx.stroke(p);
    ctx.restore();
  };
  const seam=(points,color,thickness)=>{
    ctx.save();ctx.lineJoin='bevel';ctx.lineCap='round';
    ctx.beginPath();ctx.moveTo(...points[0]);points.slice(1).forEach(p=>ctx.lineTo(...p));
    ctx.lineWidth=thickness*2.5;ctx.strokeStyle=color;ctx.shadowColor=color;ctx.shadowBlur=16;ctx.globalAlpha=.4;ctx.stroke();
    ctx.shadowBlur=0;ctx.globalAlpha=1;ctx.lineWidth=thickness;ctx.stroke();ctx.restore();
  };
  ctx.fillStyle='#07100d';ctx.fillRect(0,0,W,H);
  const underlight=ctx.createRadialGradient(W*.52,H*.5,0,W*.52,H*.5,W*.59);
  underlight.addColorStop(0,'#46785b');underlight.addColorStop(.48,'#213f32');underlight.addColorStop(1,'#07100d');
  ctx.fillStyle=underlight;ctx.fillRect(0,0,W,H);

  // Peripheral armor panels. Their long beveled diagonals lead into the A.
  face([[-15,-5],[600,-5],[375,123],[-15,463]],0,0,364,394,[[0,'#07110f'],[.47,'#1e342e'],[.9,'#526358'],[1,'#23362e']]);
  face([[-15,480],[406,128],[619,-8],[838,-8],[571,224],[-15,688]],60,120,596,610,[[0,'#14241e'],[.5,'#0b1714'],[1,'#33483d']]);
  face([[1298,-8],[1490,-8],[1848,166],[1848,393],[1713,336]],1304,0,1774,403,[[0,'#375446'],[.5,'#13291f'],[1,'#090e0c']]);
  face([[1845,412],[1845,807],[1335,807],[1530,630]],1430,311,1800,800,[[0,'#52685a'],[.55,'#1e302a'],[1,'#101713']]);
  face([[360,803],[666,540],[789,520],[527,804]],350,500,745,775,[[0,'#0b1913'],[.42,'#263e31'],[1,'#0d1512']]);

  // Deep channels and broad, overlapping facets form a massive extruded A.
  const outer=[[194,845],[1006,-97],[1205,-97],[1414,845],[1183,845],[1145,658],[697,658],[565,845]];
  const inner=[[850,475],[1066,181],[1115,475]];
  const body=polygon(outer);body.addPath(polygon(inner));
  ctx.save();ctx.translate(18,17);ctx.shadowColor='#000';ctx.shadowBlur=38;ctx.fillStyle='#020705';ctx.fill(body,'evenodd');ctx.restore();
  ctx.fillStyle='#0d1a14';ctx.fill(body,'evenodd');
  face([[200,826],[1008,-96],[1122,-96],[417,825]],404,23,1100,651,[[0,'#0e1916'],[.29,'#355749'],[.49,'#577460'],[.62,'#243d31'],[1,'#12211b']]);
  face([[419,826],[1125,-96],[1184,-96],[1066,180],[849,475],[698,657],[561,826]],504,253,1050,587,[[0,'#13251d'],[.35,'#1c392b'],[.62,'#314c3b'],[1,'#09130f']]);
  face([[1188,-96],[1404,826],[1301,826],[1123,102]],1110,320,1390,411,[[0,'#1a2b23'],[.22,'#394d40'],[.4,'#192a23'],[.78,'#345342'],[1,'#13221a']]);
  face([[1119,109],[1293,826],[1187,826],[1144,655],[1114,478],[1068,181]],1030,200,1270,650,[[0,'#253c30'],[.62,'#101913'],[1,'#293e31']]);
  face([[850,480],[1532,480],[1388,555],[788,555]],959,471,1059,575,[[0,'#526b56'],[.3,'#334a3b'],[1,'#15281d']]);
  face([[785,558],[1383,558],[1118,654],[710,654]],810,478,1094,698,[[0,'#122119'],[.55,'#263d2d'],[1,'#101d17']]);
  seam([[195,830],[1011,-90]],'#99cdaf',2);
  seam([[420,827],[1124,-93]],'#588c6f',1.7);
  seam([[1188,-88],[1407,828]],'#75b88b',2.2);
  seam([[1069,185],[1114,469]],'#4e8968',1.7);
  seam([[855,481],[1518,481]],'#99d0a7',1.8);
  seam([[44,439],[404,129],[538,45]],'#406f54',1);

  // Restrained photographic haze, film grain and peripheral falloff.
  for(let i=0;i<37;i++) {
    const x=random()*W, y=random()*H, r=50+random()*190;
    const g=ctx.createRadialGradient(x,y,0,x,y,r);
    g.addColorStop(0,i%3?'#92c5a207':'#020b0b17');g.addColorStop(1,'#0a100d00');
    ctx.fillStyle=g;ctx.fillRect(x-r,y-r,r*2,r*2);
  }
  const falloff=ctx.createRadialGradient(W*.48,H*.48,H*.24,W*.49,H*.54,W*.64);
  falloff.addColorStop(0,'#06120b08');falloff.addColorStop(.63,'#04100b14');falloff.addColorStop(1,'#030a07bd');
  ctx.fillStyle=falloff;ctx.fillRect(0,0,W,H);
  drawWordmark(ctx,W,H);
  const small=document.createElement('canvas');small.width=small.height=180;
  const grain=small.getContext('2d'); const noise=grain.createImageData(180,180);
  for(let i=0;i<noise.data.length;i+=4){const tone=random()*255;noise.data[i]=noise.data[i+1]=noise.data[i+2]=tone;noise.data[i+3]=11;}
  grain.putImageData(noise,0,0);
  ctx.fillStyle=ctx.createPattern(small,'repeat');ctx.fillRect(0,0,W,H);
  const texture=new THREE.CanvasTexture(canvas);
  texture.colorSpace=THREE.SRGBColorSpace;
  texture.anisotropy=4;
  return texture;
}
