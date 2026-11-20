import * as THREE from '../vendor/three.module.min.js';

// Both renderers consume the same scene, camera and race simulation. The small
// software renderer is also useful on browsers without an available WebGL GPU.
const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
const toSRGB = n => n <= 0.0031308 ? 12.92 * n : 1.055 * Math.pow(Math.max(0, n), 1 / 2.4) - 0.055;
const rgb = (r, g, b) => `rgb(${Math.round(clamp(r, 0, 1) * 255)} ${Math.round(clamp(g, 0, 1) * 255)} ${Math.round(clamp(b, 0, 1) * 255)})`;

function settings(previous, next = {}) {
  const result = { ...previous, ...next };
  result.style = result.style === 'native' ? 'native' : 'pixel';
  result.raster = clamp(Number(result.raster) || 240, 160, 960);
  result.pixelFit = ['auto', 'fit', 'integer', 'off'].includes(result.pixelFit) ? result.pixelFit : 'auto';
  return result;
}

function softwareRenderer(canvas) {
  const ctx = canvas.getContext('2d', { alpha: false, desynchronized: true });
  if (!ctx) throw new Error('이 브라우저에서 2D 캔버스를 시작할 수 없습니다.');
  const geometryCache = new WeakMap();
  const materialCache = new WeakMap();
  const modelView = new THREE.Matrix4();
  const instance = new THREE.Matrix4();
  const instanceWorld = new THREE.Matrix4();
  const normalMatrix = new THREE.Matrix3();
  const center = new THREE.Vector3();
  const normal = new THREE.Vector3();
  const light = new THREE.Vector3(-0.35, 0.85, 0.4).normalize();
  const sceneLight = new THREE.Vector3();
  const commands = [];
  const pool = [];
  let width = 240, height = 135, count = 0;
  let fogR = 0.67, fogG = 0.83, fogB = 0.89, fogNear = 240, fogFar = 1500;
  let near = 0.3, far = 2000, projection, halfWidth, halfHeight;
  const clipInput = Array.from({ length: 4 }, () => ({ x: 0, y: 0, z: 0, u: 0, v: 0 }));
  const clipOutput = Array.from({ length: 4 }, () => ({ x: 0, y: 0, z: 0, u: 0, v: 0 }));

  function geometryData(geometry) {
    let cached = geometryCache.get(geometry);
    const position = geometry.attributes.position;
    if (!position) return null;
    if (cached && cached.version === position.version && cached.indexVersion === geometry.index?.version) return cached;
    const vertexCount = position.count;
    const positions = new Float32Array(vertexCount * 3);
    const transformed = new Float32Array(vertexCount * 3);
    for (let i = 0; i < vertexCount; i++) {
      positions[i * 3] = position.getX(i);
      positions[i * 3 + 1] = position.getY(i);
      positions[i * 3 + 2] = position.getZ(i);
    }
    const indexCount = geometry.index ? geometry.index.count : vertexCount;
    const indices = new Uint32Array(indexCount);
    for (let i = 0; i < indexCount; i++) indices[i] = geometry.index ? geometry.index.getX(i) : i;
    const triangleCount = Math.floor(indexCount / 3);
    const normals = new Float32Array(triangleCount * 3);
    for (let i = 0; i < triangleCount; i++) {
      const a = indices[i * 3] * 3, b = indices[i * 3 + 1] * 3, c = indices[i * 3 + 2] * 3;
      const ux = positions[b] - positions[a], uy = positions[b + 1] - positions[a + 1], uz = positions[b + 2] - positions[a + 2];
      const vx = positions[c] - positions[a], vy = positions[c + 1] - positions[a + 1], vz = positions[c + 2] - positions[a + 2];
      const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
      const inverse = 1 / (Math.hypot(nx, ny, nz) || 1);
      normals[i * 3] = nx * inverse; normals[i * 3 + 1] = ny * inverse; normals[i * 3 + 2] = nz * inverse;
    }
    if (!geometry.boundingSphere) geometry.computeBoundingSphere();
    cached = { positions, transformed, indices, normals, vertexCount, indexCount, version: position.version, indexVersion: geometry.index?.version };
    geometryCache.set(geometry, cached);
    return cached;
  }

  function materialData(material) {
    let value = materialCache.get(material);
    const color = material.color;
    if (!value || value.r !== color?.r || value.g !== color?.g || value.b !== color?.b) {
      value = {
        r: color?.r ?? 0.6, g: color?.g ?? 0.65, b: color?.b ?? 0.7,
        sr: toSRGB(color?.r ?? 0.6), sg: toSRGB(color?.g ?? 0.65), sb: toSRGB(color?.b ?? 0.7),
      };
      materialCache.set(material, value);
    }
    return value;
  }

  function nearClip(vertices) {
    let outputCount = 0;
    let previous = vertices[2], previousInside = previous.z <= -near;
    for (let i = 0; i < 3; i++) {
      const current = vertices[i], inside = current.z <= -near;
      if (inside !== previousInside) {
        const t = (-near - previous.z) / (current.z - previous.z);
        const out = clipOutput[outputCount++];
        out.x = previous.x + (current.x - previous.x) * t;
        out.y = previous.y + (current.y - previous.y) * t;
        out.z = -near;
        out.u = previous.u + (current.u - previous.u) * t;
        out.v = previous.v + (current.v - previous.v) * t;
      }
      if (inside) {
        const out = clipOutput[outputCount++];
        out.x = current.x; out.y = current.y; out.z = current.z; out.u = current.u; out.v = current.v;
      }
      previous = current; previousInside = inside;
    }
    return outputCount;
  }

  function addMesh(mesh, worldMatrix, instanceColor) {
    const geometry = mesh.geometry;
    const data = geometryData(geometry);
    if (!data) return;
    modelView.multiplyMatrices(currentCamera.matrixWorldInverse, worldMatrix);
    const m = modelView.elements;
    const bounds = geometry.boundingSphere;
    if (bounds) {
      center.copy(bounds.center).applyMatrix4(modelView);
      const radius = bounds.radius * worldMatrix.getMaxScaleOnAxis();
      if (center.z - radius > -near || -center.z - radius > far) return;
      const depth = Math.max(near, -center.z);
      if (Math.abs(center.x) > depth / projection[0] + radius * 1.5 || Math.abs(center.y) > depth / projection[5] + radius * 1.5) return;
    }
    normalMatrix.getNormalMatrix(worldMatrix);
    const nm = normalMatrix.elements;
    const vertices = data.transformed;
    for (let i = 0; i < data.vertexCount; i++) {
      const j = i * 3, x = data.positions[j], y = data.positions[j + 1], z = data.positions[j + 2];
      vertices[j] = m[0] * x + m[4] * y + m[8] * z + m[12];
      vertices[j + 1] = m[1] * x + m[5] * y + m[9] * z + m[13];
      vertices[j + 2] = m[2] * x + m[6] * y + m[10] * z + m[14];
    }
    const groups = geometry.groups.length ? geometry.groups : [{ start: 0, count: data.indexCount, materialIndex: 0 }];
    const drawStart = geometry.drawRange.start || 0;
    const drawEnd = Math.min(data.indexCount, drawStart + geometry.drawRange.count);
    for (const group of groups) {
      const material = Array.isArray(mesh.material) ? mesh.material[group.materialIndex] : mesh.material;
      if (!material || !material.visible || material.opacity <= 0) continue;
      const base = materialData(material);
      const image = material.map?.image;
      const uv = geometry.attributes.uv;
      const colors = material.vertexColors ? geometry.attributes.color : null;
      const texture = image && uv && (image.width || image.videoWidth) ? image : null;
      const start = Math.max(drawStart, group.start), end = Math.min(drawEnd, group.start + group.count);
      for (let i = start; i + 2 < end; i += 3) {
        const ia = data.indices[i], ib = data.indices[i + 1], ic = data.indices[i + 2];
        const a = ia * 3, b = ib * 3, c = ic * 3;
        const az = vertices[a + 2], bz = vertices[b + 2], cz = vertices[c + 2];
        if ((az > -near && bz > -near && cz > -near) || (az < -far && bz < -far && cz < -far)) continue;
        const ax = vertices[a], ay = vertices[a + 1], bx = vertices[b], by = vertices[b + 1], cx = vertices[c], cy = vertices[c + 1];
        const ux = bx - ax, uy = by - ay, uz = bz - az, vx = cx - ax, vy = cy - ay, vz = cz - az;
        const facing = (uy * vz - uz * vy) * ax + (uz * vx - ux * vz) * ay + (ux * vy - uy * vx) * az;
        if (material.side === THREE.FrontSide && facing >= 0) continue;
        if (material.side === THREE.BackSide && facing <= 0) continue;
        const indices = [ia, ib, ic];
        for (let k = 0; k < 3; k++) {
          const v = clipInput[k], vi = indices[k] * 3;
          v.x = vertices[vi]; v.y = vertices[vi + 1]; v.z = vertices[vi + 2];
          v.u = texture ? uv.getX(indices[k]) : 0; v.v = texture ? uv.getY(indices[k]) : 0;
        }
        const n = nearClip(clipInput);
        if (n < 3) continue;
        let command = pool[count];
        if (!command) pool[count] = command = { xy: new Float32Array(8), uv: new Float32Array(8) };
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity, depth = 0;
        for (let k = 0; k < n; k++) {
          const v = clipOutput[k];
          const w = projection[3] * v.x + projection[7] * v.y + projection[11] * v.z + projection[15];
          const px = ((projection[0] * v.x + projection[4] * v.y + projection[8] * v.z + projection[12]) / w + 1) * halfWidth;
          const py = (1 - (projection[1] * v.x + projection[5] * v.y + projection[9] * v.z + projection[13]) / w) * halfHeight;
          command.xy[k * 2] = px; command.xy[k * 2 + 1] = py;
          command.uv[k * 2] = v.u; command.uv[k * 2 + 1] = material.map?.flipY === false ? v.v : 1 - v.v;
          minX = Math.min(minX, px); minY = Math.min(minY, py); maxX = Math.max(maxX, px); maxY = Math.max(maxY, py);
          depth -= v.z;
        }
        if (maxX < -1 || minX > width + 1 || maxY < -1 || minY > height + 1 || (maxX - minX) * (maxY - minY) < 0.07) continue;
        command.depth = depth / n;
        command.order = mesh.renderOrder;
        command.n = n;
        command.opacity = material.opacity;
        command.texture = texture;
        const normalIndex = Math.floor(i / 3) * 3;
        const nx = data.normals[normalIndex], ny = data.normals[normalIndex + 1], nz = data.normals[normalIndex + 2];
        normal.set(nm[0] * nx + nm[3] * ny + nm[6] * nz, nm[1] * nx + nm[4] * ny + nm[7] * nz, nm[2] * nx + nm[5] * ny + nm[8] * nz).normalize();
        if (material.side === THREE.BackSide) normal.negate();
        const unlit = material.isMeshBasicMaterial || mesh.userData.unlit;
        const brightness = unlit ? 1 : clamp(0.63 + 0.35 * Math.max(0, normal.dot(light)) + 0.1 * Math.max(0, normal.y), 0.6, 1.08);
        let r = base.sr, g = base.sg, bl = base.sb;
        if (colors) {
          r *= toSRGB((colors.getX(ia) + colors.getX(ib) + colors.getX(ic)) / 3);
          g *= toSRGB((colors.getY(ia) + colors.getY(ib) + colors.getY(ic)) / 3);
          bl *= toSRGB((colors.getZ(ia) + colors.getZ(ib) + colors.getZ(ic)) / 3);
        }
        if (instanceColor) { r *= toSRGB(instanceColor.r); g *= toSRGB(instanceColor.g); bl *= toSRGB(instanceColor.b); }
        r *= brightness; g *= brightness; bl *= brightness;
        const fog = material.fog === false ? 0 : clamp((command.depth - fogNear) / (fogFar - fogNear), 0, 0.93);
        command.fog = fog;
        command.shade = brightness;
        command.fill = rgb(r + (fogR - r) * fog, g + (fogG - g) * fog, bl + (fogB - bl) * fog);
        commands[count++] = command;
      }
    }
  }

  function polygon(command, start = 0, end = command.n) {
    ctx.beginPath();
    ctx.moveTo(command.xy[start * 2], command.xy[start * 2 + 1]);
    for (let i = start + 1; i < end; i++) ctx.lineTo(command.xy[i * 2], command.xy[i * 2 + 1]);
    ctx.closePath();
  }

  function textureTriangle(command, a, b, c) {
    const image = command.texture, iw = image.width || image.videoWidth, ih = image.height || image.videoHeight;
    const u0 = command.uv[a * 2] * iw, v0 = command.uv[a * 2 + 1] * ih;
    const u1 = command.uv[b * 2] * iw, v1 = command.uv[b * 2 + 1] * ih;
    const u2 = command.uv[c * 2] * iw, v2 = command.uv[c * 2 + 1] * ih;
    const x0 = command.xy[a * 2], y0 = command.xy[a * 2 + 1];
    const x1 = command.xy[b * 2], y1 = command.xy[b * 2 + 1];
    const x2 = command.xy[c * 2], y2 = command.xy[c * 2 + 1];
    const determinant = u0 * (v1 - v2) + u1 * (v2 - v0) + u2 * (v0 - v1);
    if (Math.abs(determinant) < 1e-8) return;
    const inverse = 1 / determinant;
    const a0 = (x0 * (v1 - v2) + x1 * (v2 - v0) + x2 * (v0 - v1)) * inverse;
    const b0 = (y0 * (v1 - v2) + y1 * (v2 - v0) + y2 * (v0 - v1)) * inverse;
    const c0 = (x0 * (u2 - u1) + x1 * (u0 - u2) + x2 * (u1 - u0)) * inverse;
    const d0 = (y0 * (u2 - u1) + y1 * (u0 - u2) + y2 * (u1 - u0)) * inverse;
    const e0 = (x0 * (u1 * v2 - u2 * v1) + x1 * (u2 * v0 - u0 * v2) + x2 * (u0 * v1 - u1 * v0)) * inverse;
    const f0 = (y0 * (u1 * v2 - u2 * v1) + y1 * (u2 * v0 - u0 * v2) + y2 * (u0 * v1 - u1 * v0)) * inverse;
    ctx.save();
    ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.lineTo(x2, y2); ctx.closePath(); ctx.clip();
    ctx.transform(a0, b0, c0, d0, e0, f0);
    ctx.drawImage(image, 0, 0);
    ctx.restore();
  }

  let currentCamera;
  const instanceTint = new THREE.Color();

  return {
    resize(w, h) { width = w; height = h; canvas.width = w; canvas.height = h; ctx.imageSmoothingEnabled = false; },
    render(scene, camera) {
      currentCamera = camera;
      scene.updateMatrixWorld(); camera.updateMatrixWorld();
      camera.matrixWorldInverse.copy(camera.matrixWorld).invert();
      projection = camera.projectionMatrix.elements;
      halfWidth = width / 2; halfHeight = height / 2;
      near = Math.max(0.05, camera.near); far = Math.min(camera.far, 2400);
      if (scene.fog) {
        fogR = toSRGB(scene.fog.color.r); fogG = toSRGB(scene.fog.color.g); fogB = toSRGB(scene.fog.color.b);
        fogNear = scene.fog.near ?? 170;
        fogFar = scene.fog.far ?? 1 / Math.max(0.0001, scene.fog.density || 0.001);
      }
      ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1;
      const gradient = ctx.createLinearGradient(0, 0, 0, height);
      gradient.addColorStop(0, '#3199db'); gradient.addColorStop(0.53, '#b4e5ef'); gradient.addColorStop(1, '#d2e4db');
      ctx.fillStyle = gradient; ctx.fillRect(0, 0, width, height);
      count = 0;
      scene.traverseVisible(object => {
        if (object.isDirectionalLight) {
          sceneLight.setFromMatrixPosition(object.matrixWorld);
          object.target?.getWorldPosition(center);
          light.copy(sceneLight).sub(center).normalize();
        }
      });
      scene.traverseVisible(object => {
        if (!object.isMesh || object.name === 'arcade-sky' || object.userData.softwareHidden) return;
        if (object.isInstancedMesh) {
          for (let i = 0; i < object.count; i++) {
            object.getMatrixAt(i, instance);
            instanceWorld.multiplyMatrices(object.matrixWorld, instance);
            if (object.instanceColor) object.getColorAt(i, instanceTint);
            addMesh(object, instanceWorld, object.instanceColor ? instanceTint : null);
          }
        } else addMesh(object, object.matrixWorld, null);
      });
      commands.length = count;
      commands.sort((a, b) => a.order - b.order || b.depth - a.depth);
      for (const command of commands) {
        ctx.globalAlpha = command.opacity;
        polygon(command);
        ctx.fillStyle = command.fill;
        ctx.fill();
        // A subpixel seam cover prevents background cracks between adjacent
        // triangles without expanding the visible silhouette of tiny objects.
        ctx.lineWidth = 0.38; ctx.strokeStyle = command.fill; ctx.stroke();
        if (command.texture) {
          for (let i = 1; i + 1 < command.n; i++) textureTriangle(command, 0, i, i + 1);
          if (command.fog > 0.01) { polygon(command); ctx.globalAlpha = command.fog * command.opacity; ctx.fillStyle = rgb(fogR, fogG, fogB); ctx.fill(); }
        }
      }
      ctx.globalAlpha = 1;
    },
    dispose() { commands.length = 0; pool.length = 0; },
  };
}

export function createRenderer(canvas, initial = {}) {
  let options = settings({ style: 'pixel', raster: 240, pixelFit: 'auto', forceSoftware: false }, initial);
  let renderer = null, software = null, kind = 'software';
  let viewportWidth = 1280, viewportHeight = 720;
  if (!options.forceSoftware) {
    // Probe a separate canvas: a failed WebGL attempt must not consume the 2D
    // canvas context that keeps the game playable on a software-only browser.
    const probe = document.createElement('canvas');
    let context;
    try { context = probe.getContext('webgl2', { failIfMajorPerformanceCaveat: false, antialias: false }); } catch { /* software path below */ }
    if (context) {
      context.getExtension('WEBGL_lose_context')?.loseContext();
      try {
        renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: false, powerPreference: 'high-performance' });
        renderer.outputColorSpace = THREE.SRGBColorSpace;
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        renderer.toneMappingExposure = 1.2;
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        renderer.setPixelRatio(1);
        kind = 'webgl';
      } catch {
        // A context can disappear between the probe and creation. A fresh
        // canvas can safely acquire 2D even after that rare partial creation.
        const replacement = document.createElement('canvas');
        for (const attribute of canvas.attributes) replacement.setAttribute(attribute.name, attribute.value);
        replacement.style.cssText = canvas.style.cssText;
        canvas.replaceWith(replacement); canvas = replacement;
      }
    }
  }
  if (!renderer) software = softwareRenderer(canvas);

  function resize(width, height) {
    viewportWidth = Math.max(1, Number(width) || 1); viewportHeight = Math.max(1, Number(height) || 1);
    let w, h;
    if (options.style === 'pixel') {
      const longest = options.raster;
      if (viewportWidth >= viewportHeight) { w = Math.round(longest); h = Math.max(1, Math.round(longest * viewportHeight / viewportWidth)); }
      else { h = Math.round(longest); w = Math.max(1, Math.round(longest * viewportWidth / viewportHeight)); }
    } else {
      const factor = kind === 'webgl' ? Math.min(window.devicePixelRatio || 1, 1.5) : Math.min(1, 960 / Math.max(viewportWidth, viewportHeight));
      w = Math.max(1, Math.round(viewportWidth * factor)); h = Math.max(1, Math.round(viewportHeight * factor));
    }
    canvas.style.imageRendering = options.style === 'pixel' ? 'pixelated' : 'auto';
    if (options.style === 'pixel' && options.pixelFit === 'integer') {
      const scale = Math.max(1, Math.floor(Math.min(viewportWidth / w, viewportHeight / h)));
      canvas.style.width = `${w * scale}px`; canvas.style.height = `${h * scale}px`;
    } else { canvas.style.width = '100%'; canvas.style.height = '100%'; }
    if (renderer) renderer.setSize(w, h, false);
    else software.resize(w, h);
  }

  return {
    kind,
    get canvas() { return canvas; },
    resize,
    render(scene, camera) { if (renderer) renderer.render(scene, camera); else software.render(scene, camera); },
    setQuality(next) { options = settings(options, next); resize(viewportWidth, viewportHeight); },
    dispose() { renderer?.dispose(); software?.dispose(); },
  };
}
