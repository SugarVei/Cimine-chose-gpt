import * as THREE from 'three';
import { makeScreenTexture } from './screen.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const mapCamera = V(0, 20, 7);
const mapForward = V(0, -.945, -.327).normalize();
const mapUp = V(0, -mapForward.z, mapForward.y);
const mapFocal = 820;
const riser = .22;
const seatTop = .49;
const screenZ = -9.55;
const screenY = 3.24;
const screenW = 10.05;
const screenH = screenW / 2.4;
const { clamp, lerp, degToRad, radToDeg } = THREE.MathUtils;

// Each seat's design-space ray meets the actual top of its upholstered cushion.
function projectSeat(seat) {
  const ray = mapForward.clone().addScaledVector(mapUp, (500 - seat.y) / mapFocal);
  ray.x = (seat.x - 500) / mapFocal;
  return mapCamera.clone().addScaledVector(ray, (seat.row * riser + seatTop - mapCamera.y) / ray.y);
}

function textile(carpet = false) {
  const size = 128;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');
  const data = ctx.createImageData(size, size);
  let seed = 107;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      seed = (Math.imul(1664525, seed) + 1013904223) >>> 0;
      const noise = seed / 4294967295;
      const thread = Math.sin(Math.PI * .5 * (x + y)) * (carpet ? 4 : 2);
      const v = (carpet ? 188 : 210) + noise * (carpet ? 38 : 16) + thread;
      const i = 4 * (y * size + x);
      data.data.set([v, v, v, 255], i);
    }
  }
  ctx.putImageData(data, 0, 0);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(carpet ? 14 : 9, carpet ? 4 : 6);
  tex.anisotropy = 4;
  return tex;
}

function glowTexture(radial) {
  const c = document.createElement('canvas');
  c.width = 96;
  c.height = radial ? 96 : 128;
  const ctx = c.getContext('2d');
  const g = radial
    ? ctx.createRadialGradient(48, 48, 0, 48, 48, 48)
    : ctx.createLinearGradient(0, 0, 96, 0);
  const stops = radial
    ? [[0, .85], [.2, .4], [.55, .07], [1, 0]]
    : [[0, 0], [.16, .014], [.35, .09], [.46, .3], [.5, .7], [.54, .3], [.65, .09], [.84, .014], [1, 0]];
  for (const [p, a] of stops) g.addColorStop(p, 'rgba(255,221,179,' + a + ')');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, c.width, c.height);
  if (!radial) {
    ctx.globalCompositeOperation = 'destination-in';
    const end = ctx.createLinearGradient(0, 0, 0, 128);
    [[0,0],[.06,.6],[.13,1],[.87,1],[.94,.6],[1,0]].forEach(([p,a]) =>
      end.addColorStop(p, 'rgba(255,255,255,' + a + ')'));
    ctx.fillStyle = end;
    ctx.fillRect(0, 0, 96, 128);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// A continuous convex upholstery surface with soft rectangular shoulders.
function softForm(exponentY = .36, exponentXZ = .42) {
  const positions = [], uvs = [], indices = [];
  const nx = 32, ny = 20;
  const pow = (n, a) => Math.sign(n) * Math.pow(Math.abs(n) < 1e-7 ? 0 : Math.abs(n), a);
  for (let j = 0; j <= ny; ++j) {
    const latitude = Math.PI * (j / ny - .5);
    const ring = pow(Math.cos(latitude), exponentY);
    for (let i = 0; i <= nx; ++i) {
      const longitude = i / nx * 2 * Math.PI;
      positions.push(.5 * ring * pow(Math.sin(longitude), exponentXZ),
                     .5 * pow(Math.sin(latitude), exponentY),
                     .5 * ring * pow(Math.cos(longitude), exponentXZ));
      uvs.push(i / nx, j / ny);
      if (i < nx && j < ny) {
        const a = j * (nx + 1) + i, b = a + nx + 1;
        indices.push(a, a + 1, b, a + 1, b + 1, b);
      }
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  // The first and last longitude share a normal across the UV seam.
  const norms = geo.getAttribute('normal');
  for (let j = 0; j <= ny; ++j) {
    const i = j * (nx + 1);
    const n = new THREE.Vector3().fromBufferAttribute(norms, i)
      .add(new THREE.Vector3().fromBufferAttribute(norms, i + nx)).normalize();
    norms.setXYZ(i, n.x, n.y, n.z);
    norms.setXYZ(i + nx, n.x, n.y, n.z);
  }
  return geo;
}

export function createTheater(canvas, seats) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' });
  renderer.setClearColor(0x0c0c0c);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.02;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0c0c0c);
  scene.fog = new THREE.FogExp2(0x0c0d0f, .016);
  const camera = new THREE.PerspectiveCamera(55, 1, .055, 95);
  camera.rotation.order = 'YXZ';
  const structure = new THREE.Group();
  const ceiling = new THREE.Group();
  scene.add(structure, ceiling);

  const cloth = textile(), carpet = textile(true);
  const lampGlow = glowTexture(false), spotGlow = glowTexture(true);
  const standard = (color, roughness = .9, more = {}) => new THREE.MeshStandardMaterial({ color, roughness, ...more });
  const flat = (color, more = {}) => new THREE.MeshBasicMaterial({ color, ...more });
  const auditorium = standard(0x353337, .98, { map: carpet });
  const charcoal = standard(0x27272b, .91);
  const joint = standard(0x141518);
  const reveal = standard(0x474248, .79, { metalness: .17 });
  const clothMat = standard(0xffffff, .95, { map: cloth, bumpMap: cloth, bumpScale: .0005 });
  const rearMat = standard(0x47494c, .97, { map: cloth, bumpMap: cloth, bumpScale: .0005 });
  const seamMat = standard(0x313338, .92, { map: cloth });
  const metal = standard(0x28282a, .52, { metalness: .42 });
  const warm = flat(0xffedce, { toneMapped: false });
  const lampWhite = warm.color.clone();
  const amber = flat(0x9f7750);
  const warmGlow = flat(0xffdfb4, { map: lampGlow, transparent: true, opacity: .61, depthWrite: false, blending: THREE.AdditiveBlending });
  const acoustic = [
    standard(0x393636, .99, { map: cloth }),
    standard(0x343135, .98, { map: cloth }),
    standard(0x373436, .95, { map: cloth })
  ];
  const cube = new THREE.BoxGeometry(1, 1, 1), quad = new THREE.PlaneGeometry(1, 1);
  const pillow = softForm(.40, .43), tailored = softForm(.31, .38);
  const d = new THREE.Object3D();
  function matrix(x, y, z, w, h, depth, rx = 0, ry = 0) {
    d.position.set(x,y,z);
    d.scale.set(w,h,depth);
    d.rotation.set(rx,ry,0,'YXZ');
    d.updateMatrix();
    return d.matrix.clone();
  }

  // All repeated room furnishings share geometry and are issued in batches.
  const batches = new Map();
  function part(geo, material, transform, group = structure) {
    const key = group.id + ':' + geo.id + ':' + material.id;
    if (!batches.has(key)) batches.set(key, { geo, material, group, matrices: [] });
    batches.get(key).matrices.push(transform);
  }
  function box(x,y,z,w,h,depth,mat,group) {
    part(cube, mat, matrix(x,y,z,w,h,depth), group);
  }
  const centers = seats.map(projectSeat);
  const rows = Array.from({ length: 8 }, (_,r) => seats.findIndex(s => s.row === r));
  const zRows = rows.map(i => centers[i].z);
  const halfRoom = Math.max(6.18, ...centers.map(v => Math.abs(v.x) + .85));
  const front = screenZ - .46, rear = zRows[7] + 2.2, depth = rear - front;
  const roof = 6.46, midZ = (rear + front) / 2;

  box(0, -.46, midZ, halfRoom * 2 + .25, .64, depth, auditorium);
  box(0, roof/2, front, halfRoom * 2 + .4, roof, .22, charcoal);
  // Back wall lies behind the observer. Its inside surface alone is visible.
  part(quad, charcoal, matrix(0, roof/2, rear, halfRoom * 2, roof, 1, 0, Math.PI));
  for (let r = 0; r < 8; r++) {
    const f = r === 0 ? zRows[0] - .79 : (zRows[r] + zRows[r-1])/2;
    const b = r === 7 ? rear : (zRows[r] + zRows[r+1])/2;
    const floor = r * riser;
    const aisle = 1.02;
    for (const side of [-1,1]) {
      const w = halfRoom - aisle/2;
      box(side * (halfRoom - w/2), floor - .12, (f+b)/2, w, .24, b-f, auditorium);
      box(side * (halfRoom - w/2), floor - .032, f+.002, w, .055, .028, joint);
      // Aisle-edge low level lights outline each tread without illuminating the rows.
      box(side*(aisle/2 + .20), floor-.058, f-.013, .21, .014, .012, amber);
    }
    box(0, floor - .13, (f+b)/2, aisle, .26, b-f, auditorium);
    box(0, floor - .025, f, aisle, .046, .032, reveal);
  }

  const seatsMesh = new THREE.InstancedMesh(pillow, clothMat, seats.length);
  scene.add(seatsMesh);
  const originalColors = [];
  const color = new THREE.Color();
  for (let i = 0; i < seats.length; i++) {
    const s = seats[i], p = centers[i], y = s.row * riser;
    const spacing = Math.abs(centers[rows[s.row]+1].x - centers[rows[s.row]].x);
    const w = spacing * .89;
    // The seat top is exactly the registered point projected above.
    seatsMesh.setMatrixAt(i, matrix(p.x, p.y-.095, p.z, w*.87,.19,.68));
    originalColors.push(new THREE.Color(0x4b4c50).multiplyScalar(1 + .035 * Math.sin(i * 37)));
    seatsMesh.setColorAt(i, originalColors[i]);
    part(tailored, seamMat, matrix(p.x, y+.79, p.z+.33, w,.852,.244,.105));
    part(pillow, rearMat, matrix(p.x, y+.802, p.z+.354, w*.986,.826,.247,.105));
    // A deep, crowned front pad sits into the backing, leaving a welt at its perimeter.
    part(pillow, rearMat, matrix(p.x,y+.82,p.z+.258,w*.928,.765,.215,.11));
    part(tailored, charcoal, matrix(p.x,y+.34,p.z+.09,w*.89,.135,.55));
    box(p.x,y+.18,p.z+.06,w*.60,.32,.32, metal);
    for (const side of [-1,1]) {
      const armX = p.x + side * w*.465;
      part(tailored, seamMat, matrix(armX, y+.564, p.z+.055, .095,.103,.58));
      box(armX,y+.39,p.z+.11,.055,.27,.30, metal);
    }
  }
  seatsMesh.instanceMatrix.needsUpdate = true;

  const lampSpacing = .49;
  const lampCount = Math.ceil((rear-front) / lampSpacing);
  for (const side of [-1,1]) {
    const face = -side * Math.PI/2;
    const splay = Math.max(0,halfRoom - screenW/2 - .32);
    const wallAt = z => side * (halfRoom - splay * Math.max(0, 1-(z-front)/5.2));
    part(quad, charcoal, matrix(side*halfRoom, roof/2, midZ, depth, roof, 1, 0, face));
    for (let i = 0; i < lampCount; ++i) {
      const z = front + .4 + i*lampSpacing, frac = i/(lampCount-1);
      const x = wallAt(z);
      const tilt = z-front < 5.2 ? side*Math.atan(splay/5.2) : 0;
      const panel = (inset, y, width, height, length, mat) =>
        part(cube, mat, matrix(x-side*inset,y,z,width,height,length,0,tilt));
      panel(.018, roof*.49,.08,roof*.965,lampSpacing*1.025,acoustic[i%3]);
      panel(.055, roof-.30,.14,.28,lampSpacing*1.024,acoustic[0]);
      panel(.063, roof-.46,.14,.035,lampSpacing*1.024,reveal);
      panel(.042,.32,.1,.64,lampSpacing*1.024,joint);
      const fromFloor = .78 + 1.42*frac;
      const lampHeight = 2.50 + .85*frac;
      // Vertical acoustic battens form a dark reveal behind each integrated light.
      for (let k = -1; k <= 1; k++) {
        box(wallAt(z+k*.136)-side*.065, roof*.49, z+k*.136, .046, roof*.89, k === 0 ? .065 : .025, k === 0 ? joint : acoustic[1]);
      }
      const gy = fromFloor + lampHeight*.5;
      box(x-side*.097,gy,z,.038,lampHeight+.12,.055, metal);
      box(x-side*.123,gy,z,.024,lampHeight,.029,warm);
      part(quad, warmGlow, matrix(x-side*.151,gy,z,.59,lampHeight+.65,1,0,face+tilt));
      part(quad, warmGlow, matrix(x-side*.149,gy,z,.16,lampHeight+.21,1,0,face*.55));
    }
  }

  part(quad, joint, matrix(0, roof, midZ, halfRoom*2,depth,1,Math.PI/2), ceiling);
  const pool = flat(0xffdeb1, { map: spotGlow, transparent: true, opacity:.32, depthWrite:false, blending:THREE.AdditiveBlending });
  const disc = new THREE.CircleGeometry(1, 24);
  for (let n = 0; n < 5; ++n) {
    const z = front+1.5+n*3;
    box(0,roof-.05,z+.24,halfRoom*2,.09,.12, charcoal, ceiling);
    for (const side of [-1,1]) {
      const x = side*(halfRoom*.62);
      part(disc, metal, matrix(x,roof-.065,z,.118,.118,1,Math.PI/2), ceiling);
      part(disc, warm, matrix(x,roof-.078,z,.049,.049,1,Math.PI/2), ceiling);
      part(quad, pool, matrix(x,roof-.079,z,.54,.54,1,Math.PI/2), ceiling);
    }
  }

  // The projection surface is emissive, with a recessed extrusion, masked edges and dais.
  box(0,.19,front+.76,screenW+1.3,.46,1.35,charcoal);
  box(0,.418,front+.78,screenW+1.32,.065,1.38,standard(0x252629,.97, {map:carpet}));
  box(0,screenY,screenZ-.080,screenW+.16,screenH+.16,.14,joint);
  const screenMap = makeScreenTexture(THREE);
  const projectedFilm = flat(0xffffff, { map: screenMap, toneMapped:false, fog:false });
  part(quad, projectedFilm, matrix(0,screenY,screenZ+.003,screenW,screenH,1));
  for (const {geo,material,group,matrices} of batches.values()) {
    const mesh = new THREE.InstancedMesh(geo, material, matrices.length);
    matrices.forEach((m,i) => mesh.setMatrixAt(i,m));
    mesh.instanceMatrix.needsUpdate = true;
    group.add(mesh);
  }
  scene.add(new THREE.HemisphereLight(0xf6f3ee, 0x585767, 1.15));
  const frontLight = new THREE.DirectionalLight(0xd6e4df, 1.05);
  frontLight.position.set(-2,7,-8);
  scene.add(frontLight);
  const rim = new THREE.DirectionalLight(0xf6e8de, .78);
  rim.position.set(5, 4, 6);
  scene.add(rim);
  const screenWash = new THREE.PointLight(0x9ac9b1, 23, 16, 2);
  screenWash.position.set(0, screenY, screenZ + .5);
  scene.add(screenWash);
  const eye = new THREE.Vector3(), ctrlOne = mapCamera.clone().add(V(0,-.4,.5)), ctrlTwo = new THREE.Vector3();
  const position = new THREE.Vector3();
  let viewportW = 1000, viewportH = 1000, layout = { scale:1,ox:0,oy:0 };
  function resize(w,h,placement) {
    viewportW = Math.max(1,w);
    viewportH = Math.max(1,h);
    layout = placement;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.7, Math.sqrt(2800000 / (viewportW*viewportH))));
    renderer.setSize(viewportW,viewportH,false);
    camera.aspect = viewportW / viewportH;
  }
  let viewKey = -1;
  const viewFrom = new THREE.Vector3(), viewTo = new THREE.Vector3();
  function setViewSeat(seat, blend = 1, restart = false) {
    const key = seats.findIndex(s => s.row === seat.row && s.num === seat.num);
    if (key === -1) return;
    if (restart || viewKey !== key) {
      viewKey = key;
      viewFrom.copy(eye);
      viewTo.copy(centers[key]);
      viewTo.y = seats[key].row * riser + 1.17;
      viewTo.z += .09;
    }
    eye.lerpVectors(viewFrom,viewTo,clamp(blend,0,1));
    ctrlTwo.copy(eye).add(V(0,2.23,-.018));
  }
  function setSelection(group) {
    const picked = new Set(group.map(s => s.row * 12 + s.num));
    let nearest = -1;
    for (let i = 0; i < seats.length; i++) {
      const s = seats[i], selected = picked.has(s.row * 12 + s.num);
      seatsMesh.setColorAt(i, selected ? color.set(0x4181f0) : originalColors[i]);
      if (selected && (nearest < 0 || Math.abs(centers[i].x) < Math.abs(centers[nearest].x))) nearest = i;
    }
    seatsMesh.instanceColor.needsUpdate = true;
    if (nearest >= 0) setViewSeat(seats[nearest]);
  }
  setSelection([seats[80],seats[81]]);
  function render(flight, yaw = 0) {
    const t = clamp(flight,0,1);
    const u = 1-t;
    // Let the upholstery read first as the plan dissolves into the auditorium.
    const revealLight = THREE.MathUtils.smoothstep(t, .04, .72);
    projectedFilm.color.setScalar(lerp(.08,1,revealLight));
    warm.color.copy(lampWhite).multiplyScalar(lerp(.18,1,revealLight));
    warmGlow.opacity = lerp(.17,.61,revealLight);
    frontLight.intensity = lerp(2.15,1.05,revealLight);
    position.copy(mapCamera).multiplyScalar(u*u*u)
      .addScaledVector(ctrlOne,3*u*u*t).addScaledVector(ctrlTwo,3*u*t*t).addScaledVector(eye,t*t*t);
    camera.position.copy(position);
    // Aim the seated eye near the middle of the image, with headroom above the HUD.
    const hfov = degToRad(72);
    const endHalf = Math.max(Math.tan(degToRad(32)/2), Math.tan(hfov/2) / camera.aspect);
    const startHalf = viewportH / (2 * mapFocal * layout.scale);
    const focal = Math.exp(lerp(Math.log(startHalf),Math.log(endHalf),t));
    camera.fov = radToDeg(2*Math.atan(focal));
    const dist = Math.hypot(eye.x, eye.z-screenZ);
    const endPitch = Math.atan2(screenY-eye.y, dist) - Math.atan(.095*endHalf);
    const endYaw = Math.atan2(eye.x,eye.z-screenZ);
    camera.rotation.set(lerp(Math.asin(mapForward.y),endPitch,t),t*(endYaw+yaw),0,'YXZ');
    camera.updateProjectionMatrix();
    // Principal point is interpolated as well; registration survives any letterboxing.
    camera.projectionMatrix.elements[8] = (1 - 2*(layout.ox+500*layout.scale)/viewportW)*u;
    camera.projectionMatrix.elements[9] = (2*(layout.oy+500*layout.scale)/viewportH - 1)*u;
    camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();
    ceiling.visible = position.y < roof-.09;
    renderer.render(scene,camera);
  }
  function dispose() {
    const geometries = new Set(), materials = new Set();
    scene.traverse(o => {
      if (o.geometry) geometries.add(o.geometry);
      if (o.material) materials.add(o.material);
      if (o.isInstancedMesh) o.dispose();
    });
    geometries.forEach(g => g.dispose());
    materials.forEach(m => m.dispose());
    [cloth, carpet, spotGlow, lampGlow, screenMap].forEach(tex => tex.dispose());
    renderer.dispose();
  }
  return { resize, setSelection, setViewSeat, render, dispose };
}
