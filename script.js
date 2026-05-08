/**
 * Claude Code Hero — Tab switching + WebGL Shader management
 */

// ── Tab switching ──
const hero = document.querySelector('.hero');
const tabs = document.querySelectorAll('.hero__tab');
const views = document.querySelectorAll('.hero__view');
const titleWord = document.querySelector('.hero__title-word');

const viewData = {
  dev: { word: 'developers' },
  design: { word: 'designers' },
  everyone: { word: 'everyone' },
};

let currentView = 'dev';

tabs.forEach(tab => {
  tab.addEventListener('click', () => {
    const target = tab.dataset.tab;
    if (target === currentView) return;

    tabs.forEach(t => t.classList.remove('hero__tab--active'));
    tab.classList.add('hero__tab--active');

    hero.dataset.view = target;
    titleWord.textContent = viewData[target].word;

    views.forEach(v => {
      v.hidden = !v.classList.contains(`hero__view--${target}`);
    });

    currentView = target;
    switchShader(target);
  });
});


// ── WebGL Shader Engine ──

const canvas = document.getElementById('shaderCanvas');
const gl = canvas.getContext('webgl');

let activeAnimId = null;
let activeProgram = null;

function resizeCanvas() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  if (gl) gl.viewport(0, 0, canvas.width, canvas.height);
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

// Shared vertex shader
const VERT_SRC = `
  attribute vec2 a_position;
  void main() {
    gl_Position = vec4(a_position, 0.0, 1.0);
  }
`;

// Compile helper
function compileShader(type, src) {
  const sh = gl.createShader(type);
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    console.error('Shader compile error:', gl.getShaderInfoLog(sh));
    return null;
  }
  return sh;
}

// Create program from fragment source
function createProgram(fragSrc) {
  const prog = gl.createProgram();
  gl.attachShader(prog, compileShader(gl.VERTEX_SHADER, VERT_SRC));
  gl.attachShader(prog, compileShader(gl.FRAGMENT_SHADER, fragSrc));
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    console.error('Program link error:', gl.getProgramInfoLog(prog));
    return null;
  }
  return prog;
}

// Set up fullscreen quad (shared)
const quadBuf = gl.createBuffer();
gl.bindBuffer(gl.ARRAY_BUFFER, quadBuf);
gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 1,-1, -1,1, -1,1, 1,-1, 1,1]), gl.STATIC_DRAW);


/* =========================================
   SHADER: Dev (ASCII binary matrix)
   ========================================= */

const DEV_FRAG = `
  precision mediump float;
  uniform float u_time;
  uniform vec2 u_resolution;
  uniform sampler2D u_ascii;

  vec3 mod289(vec3 x){return x - floor(x * (1.0/289.0))*289.0;}
  vec2 mod289(vec2 x){return x - floor(x * (1.0/289.0))*289.0;}
  vec3 permute(vec3 x){return mod289(((x*34.0)+1.0)*x);}
  float snoise(vec2 v){
    const vec4 C = vec4(0.211324865405187, 0.366025403784439, -0.577350269189626, 0.024390243902439);
    vec2 i = floor(v + dot(v, C.yy));
    vec2 x0 = v - i + dot(i, C.xx);
    vec2 i1;
    i1 = (x0.x > x0.y) ? vec2(1.0,0.0) : vec2(0.0,1.0);
    vec4 x12 = x0.xyxy + C.xxzz;
    x12.xy -= i1;
    vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0)) + i.x + vec3(0.0, i1.x, 1.0));
    vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy), dot(x12.zw,x12.zw)), 0.0);
    m = m*m; m = m*m;
    vec3 x = 2.0 * fract(p * C.www) - 1.0;
    vec3 h = abs(x) - 0.5;
    vec3 ox = floor(x + 0.5);
    vec3 a0 = x - ox;
    m *= 1.79284291400159 - 0.85373472095314 * (a0*a0+h*h);
    vec3 g;
    g.x = a0.x * x0.x + h.x * x0.y;
    g.y = a0.y * x12.x + h.y * x12.y;
    g.z = a0.z * x12.z + h.z * x12.w;
    return 130.0 * dot(m, g);
  }

  void main() {
    vec2 uv = gl_FragCoord.xy / u_resolution.xy;
    float waveFreq = 1.9500;
    float waveAmp  = 0.0400;
    float pixelSize = 40.0;
    float noiseMultiplier = 6.4000;
    float exponent = 2.5000;
    float totalChars = 2.0;
    float blurEffectVal = 0.0000;
    vec3 colorBajo = vec3(0.851, 0.467, 0.341);
    vec3 colorAlto = vec3(0.949, 0.949, 0.949);

    vec2 distortion = vec2(
      snoise(uv * waveFreq + u_time * 0.1),
      snoise(uv * waveFreq - u_time * 0.1)
    ) * waveAmp;
    vec2 distortedPos = gl_FragCoord.xy + (distortion * u_resolution.xy);
    vec2 cell = floor(distortedPos / pixelSize);
    vec2 cellUV = cell * pixelSize / u_resolution.xy;
    vec2 scaledUV = vec2(cellUV.x * noiseMultiplier, cellUV.y * 2.0);
    float n = snoise(scaledUV + u_time * 0.10);
    n = pow((n + 1.0) * 0.5, exponent);
    float charIndex = floor(n * totalChars);
    charIndex = min(charIndex, totalChars - 1.0);
    vec2 localUV = mod(distortedPos, pixelSize) / pixelSize;
    float charWidth = 1.0 / totalChars;
    vec2 asciiUV = vec2(
      charIndex * charWidth + localUV.x * charWidth,
      localUV.y
    );
    vec3 baseColor = mix(colorBajo, colorAlto, n);
    float intensity = (n * blurEffectVal);
    float r = texture2D(u_ascii, asciiUV + vec2(intensity, 0.0)).r;
    float g = texture2D(u_ascii, asciiUV).g;
    float b = texture2D(u_ascii, asciiUV - vec2(intensity, 0.0)).b;
    float blur1 = texture2D(u_ascii, asciiUV + vec2(0.0, intensity)).g;
    float blur2 = texture2D(u_ascii, asciiUV - vec2(0.0, intensity)).g;
    vec3 asciiShape = vec3(r, g, b);
    float blurFactor = (blur1 + blur2) * 0.01;
    vec3 finalColor = mix(asciiShape, vec3(blurFactor), 0.3) * baseColor;
    gl_FragColor = vec4(finalColor, 1.0);
  }
`;

/* =========================================
   SHADER: Design (CRT + Dithering over coffee image, no gradient)
   ========================================= */
const DESIGN_FRAG = `
  precision mediump float;
  uniform float u_time;
  uniform vec2 u_resolution;
  uniform sampler2D u_image;

  vec2 barrelDistort(vec2 uv, float amt) {
    vec2 cc = uv - 0.5;
    float dist = dot(cc, cc);
    return uv + cc * dist * amt;
  }

  float bayer4(vec2 pos) {
    int x = int(mod(pos.x, 4.0));
    int y = int(mod(pos.y, 4.0));
    int index = x + y * 4;
    if (index == 0) return 0.0/16.0;
    if (index == 1) return 8.0/16.0;
    if (index == 2) return 2.0/16.0;
    if (index == 3) return 10.0/16.0;
    if (index == 4) return 12.0/16.0;
    if (index == 5) return 4.0/16.0;
    if (index == 6) return 14.0/16.0;
    if (index == 7) return 6.0/16.0;
    if (index == 8) return 3.0/16.0;
    if (index == 9) return 11.0/16.0;
    if (index == 10) return 1.0/16.0;
    if (index == 11) return 9.0/16.0;
    if (index == 12) return 15.0/16.0;
    if (index == 13) return 7.0/16.0;
    if (index == 14) return 13.0/16.0;
    return 5.0/16.0;
  }

  void main() {
    vec2 uv = gl_FragCoord.xy / u_resolution.xy;
    float t = u_time;

    // 1. Barrel distortion (0.297)
    vec2 distUV = barrelDistort(uv, 0.297);

    // 2. Image at scale 1.0, shifted right to reveal subject
    vec2 imgUV = distUV + vec2(-0.22, 0.0);

    // 3. Glitch (0.12 intensity, speed 5)
    float blockY = floor(imgUV.y * 25.0 + t * 5.0);
    float glitchRand = fract(sin(blockY * 43758.5453) * 1.0);
    float glitchActive = step(1.0 - 0.12 * 0.5, glitchRand);
    float glitchShift = (fract(sin(blockY * 12345.67) * 43758.5) - 0.5) * 0.12 * 0.1;
    imgUV.x += glitchShift * glitchActive;

    // 4. Signal artifacts (0.45)
    float artifactTrigger = step(0.95, fract(sin(floor(t * 5.0) * 17.0) * 43758.5));
    float artifactBand = sin(imgUV.y * 200.0 + t * 50.0) * sin(imgUV.y * 10.0 + t * 3.0);
    float artifact = artifactBand * 0.45 * artifactTrigger;

    // 5. Chromatic aberration (2px)
    float caOff = 2.0 / u_resolution.x;
    float imgR = texture2D(u_image, imgUV + vec2(caOff + artifact * 0.01, 0.0)).r;
    float imgG = texture2D(u_image, imgUV + vec2(0.0, artifact * 0.005)).g;
    float imgB = texture2D(u_image, imgUV - vec2(caOff + artifact * 0.01, 0.0)).b;
    vec3 blended = vec3(imgR, imgG, imgB);

    // 6. Chroma retention (1.15)
    float lum = dot(blended, vec3(0.299, 0.587, 0.114));
    blended = mix(vec3(lum), blended, 1.15);

    // 7. Shoulder tone mapping (3.34)
    blended = blended / (blended + vec3(1.0 / 3.34));

    // 8. CRT scanlines + slot-mask (opacity 0.74)
    float scanline = 0.5 + 0.5 * sin(gl_FragCoord.y * 3.14159 / 3.0);
    scanline = mix(1.0, scanline, 0.17);
    float slotMask = 0.5 + 0.5 * sin(gl_FragCoord.x * 3.14159 / 3.0);
    vec3 crtColor = blended * scanline * slotMask;
    blended = mix(blended, crtColor, 0.74);

    // 9. Brightness + shadow lift
    blended *= 1.2;
    blended = max(blended, vec3(0.048));

    // 10. Dithering (bayer 4x4, opacity 0.68, levels 4, spread 0.82)
    vec2 ditherCoord = floor(gl_FragCoord.xy / 2.0);
    float dither = bayer4(ditherCoord);
    vec3 quantized = floor(blended * 4.0 + dither * 0.82) / 4.0;
    blended = mix(blended, quantized, 0.68);

    // 11. Bars pattern (opacity 0.12)
    float bars = 0.5 + 0.5 * sin(gl_FragCoord.x / 8.0 * 3.14159);
    blended = mix(blended, blended * bars, 0.12);

    // 12. Vignette (0.45)
    vec2 vig = uv * (1.0 - uv);
    float vigF = pow(vig.x * vig.y * 15.0, 0.45);
    blended *= vigF;

    // 13. Bloom (threshold 0.06)
    float bright = max(max(blended.r, blended.g), blended.b);
    vec3 bloom = blended * smoothstep(0.06, 0.5, bright) * 1.93;
    blended += bloom * 0.15;

    // 14. Flicker + persistence
    float flicker = 1.0 - 0.02 * sin(t * 12.0);
    blended *= flicker;
    blended = mix(blended, blended * 0.95, 0.18);

    gl_FragColor = vec4(blended, 1.0);
  }
`;

/* =========================================
   SHADER: Everyone (CRT + Dithering + Glitch over eye image)
   Same composition as Design but with eye image, more glitch
   ========================================= */
const EVERYONE_FRAG = `
  precision mediump float;
  uniform float u_time;
  uniform vec2 u_resolution;
  uniform sampler2D u_image;

  vec3 mod289v3(vec3 x){return x - floor(x * (1.0/289.0))*289.0;}
  vec2 mod289v2(vec2 x){return x - floor(x * (1.0/289.0))*289.0;}
  vec3 permute(vec3 x){return mod289v3(((x*34.0)+1.0)*x);}
  float snoise(vec2 v){
    const vec4 C = vec4(0.211324865405187, 0.366025403784439, -0.577350269189626, 0.024390243902439);
    vec2 i = floor(v + dot(v, C.yy));
    vec2 x0 = v - i + dot(i, C.xx);
    vec2 i1 = (x0.x > x0.y) ? vec2(1.0,0.0) : vec2(0.0,1.0);
    vec4 x12 = x0.xyxy + C.xxzz;
    x12.xy -= i1;
    vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0)) + i.x + vec3(0.0, i1.x, 1.0));
    vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy), dot(x12.zw,x12.zw)), 0.0);
    m = m*m; m = m*m;
    vec3 x = 2.0 * fract(p * C.www) - 1.0;
    vec3 h = abs(x) - 0.5;
    vec3 ox = floor(x + 0.5);
    vec3 a0 = x - ox;
    m *= 1.79284291400159 - 0.85373472095314 * (a0*a0+h*h);
    vec3 g;
    g.x = a0.x * x0.x + h.x * x0.y;
    g.y = a0.y * x12.x + h.y * x12.y;
    g.z = a0.z * x12.z + h.z * x12.w;
    return 130.0 * dot(m, g);
  }

  vec2 barrelDistort(vec2 uv, float amt) {
    vec2 cc = uv - 0.5;
    float dist = dot(cc, cc);
    return uv + cc * dist * amt;
  }

  float bayer4(vec2 pos) {
    int x = int(mod(pos.x, 4.0));
    int y = int(mod(pos.y, 4.0));
    int index = x + y * 4;
    if (index == 0) return 0.0/16.0;
    if (index == 1) return 8.0/16.0;
    if (index == 2) return 2.0/16.0;
    if (index == 3) return 10.0/16.0;
    if (index == 4) return 12.0/16.0;
    if (index == 5) return 4.0/16.0;
    if (index == 6) return 14.0/16.0;
    if (index == 7) return 6.0/16.0;
    if (index == 8) return 3.0/16.0;
    if (index == 9) return 11.0/16.0;
    if (index == 10) return 1.0/16.0;
    if (index == 11) return 9.0/16.0;
    if (index == 12) return 15.0/16.0;
    if (index == 13) return 7.0/16.0;
    if (index == 14) return 13.0/16.0;
    return 5.0/16.0;
  }

  void main() {
    vec2 uv = gl_FragCoord.xy / u_resolution.xy;
    float t = u_time;

    // 1. Barrel distortion (0.297)
    vec2 distUV = barrelDistort(uv, 0.297);

    // 2. Scale 0.91 from center + offset [-0.02, 0.01]
    vec2 scaledUV = (distUV - 0.5) / 0.91 + 0.5;
    scaledUV += vec2(-0.32, 0.01);

    // 3. Glitch (0.12 intensity, speed 5)
    float blockY = floor(scaledUV.y * 25.0 + t * 5.0);
    float glitchRand = fract(sin(blockY * 43758.5453) * 1.0);
    float glitchActive = step(1.0 - 0.12 * 0.5, glitchRand);
    float glitchShift = (fract(sin(blockY * 12345.67) * 43758.5) - 0.5) * 0.12 * 0.1;
    scaledUV.x += glitchShift * glitchActive;

    // 4. Signal artifacts (0.45)
    float artifactTrigger = step(0.95, fract(sin(floor(t * 5.0) * 17.0) * 43758.5));
    float artifactBand = sin(scaledUV.y * 200.0 + t * 50.0) * sin(scaledUV.y * 10.0 + t * 3.0);
    float artifact = artifactBand * 0.45 * artifactTrigger;

    // 5. Chromatic aberration (2px)
    float caOff = 2.0 / u_resolution.x;
    float imgR = texture2D(u_image, scaledUV + vec2(caOff + artifact * 0.01, 0.0)).r;
    float imgG = texture2D(u_image, scaledUV + vec2(0.0, artifact * 0.005)).g;
    float imgB = texture2D(u_image, scaledUV - vec2(caOff + artifact * 0.01, 0.0)).b;
    vec3 img = vec3(imgR, imgG, imgB);

    // 6. Hue shift +1 (very subtle warm nudge)
    img.r *= 1.005;
    img.b *= 0.995;

    // 7. Animated gradient base (muted warm darks, less red)
    vec2 gp = uv * 3.0;
    float n1 = snoise(gp + t * 0.15);
    float n2 = snoise(gp * 1.5 - t * 0.1);
    float warp = snoise(gp + vec2(n1, n2) * 0.3);
    vec3 gradC1 = vec3(0.16, 0.11, 0.12);
    vec3 gradC2 = vec3(0.3, 0.08, 0.06);
    vec3 grad = mix(gradC2, gradC1, smoothstep(-0.5, 1.0, warp));
    float gLum = dot(grad, vec3(0.299, 0.587, 0.114));
    grad = mix(vec3(gLum), grad, 1.0);

    // 8. Blend image over gradient
    float imgLum = dot(img, vec3(0.299, 0.587, 0.114));
    vec3 blended = mix(grad, img, smoothstep(0.0, 0.12, imgLum));

    // 9. Shoulder tone mapping (3.34)
    blended = blended / (blended + vec3(1.0 / 3.34));

    // 10. CRT scanlines + slot-mask (opacity 0.74)
    float scanline = 0.5 + 0.5 * sin(gl_FragCoord.y * 3.14159 / 3.0);
    scanline = mix(1.0, scanline, 0.17);
    float slotMask = 0.5 + 0.5 * sin(gl_FragCoord.x * 3.14159 / 3.0);
    vec3 crtColor = blended * scanline * slotMask;
    blended = mix(blended, crtColor, 0.74);

    // 11. Brightness + shadow lift
    blended *= 1.2;
    blended = max(blended, vec3(0.048));

    // 12. Dithering (bayer 4x4, opacity 0.68, levels 4, spread 0.82)
    vec2 ditherCoord = floor(gl_FragCoord.xy / 2.0);
    float dither = bayer4(ditherCoord);
    vec3 quantized = floor(blended * 4.0 + dither * 0.82) / 4.0;
    blended = mix(blended, quantized, 0.68);

    // 13. Bars pattern (opacity 0.12)
    float bars = 0.5 + 0.5 * sin(gl_FragCoord.x / 8.0 * 3.14159);
    blended = mix(blended, blended * bars, 0.12);

    // 14. Vignette (0.45)
    vec2 vig = uv * (1.0 - uv);
    float vigF = pow(vig.x * vig.y * 15.0, 0.45);
    blended *= vigF;

    // 15. Bloom (threshold 0.06)
    float bright = max(max(blended.r, blended.g), blended.b);
    vec3 bloom = blended * smoothstep(0.06, 0.5, bright) * 1.93;
    blended += bloom * 0.15;

    // 16. Flicker + persistence
    float flicker = 1.0 - 0.02 * sin(t * 12.0);
    blended *= flicker;
    blended = mix(blended, blended * 0.95, 0.18);

    gl_FragColor = vec4(blended, 1.0);
  }
`;


// ── Shader instances ──

const shaders = {};
let devAsciiTexture = null;

function createAsciiTexture() {
  const chars = '.10.01';
  const fontSize = 64;
  const cc = document.createElement('canvas');
  const ctx2d = cc.getContext('2d');
  cc.width = fontSize * chars.length;
  cc.height = fontSize;
  ctx2d.font = "400 " + fontSize + "px 'Space Mono', monospace";
  ctx2d.fillStyle = 'white';
  ctx2d.textBaseline = 'top';
  for (let i = 0; i < chars.length; i++) {
    ctx2d.fillText(chars[i], i * fontSize, 0);
  }

  const tex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, cc);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  return tex;
}

function loadImageTexture(src) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const tex = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      resolve(tex);
    };
    img.onerror = () => {
      console.warn('Failed to load image texture:', src);
      resolve(null);
    };
    img.src = src;
  });
}

function initShader(name, fragSrc, textureUniform, texture) {
  const prog = createProgram(fragSrc);
  if (!prog) return null;

  const info = {
    program: prog,
    uTime: gl.getUniformLocation(prog, 'u_time'),
    uRes: gl.getUniformLocation(prog, 'u_resolution'),
    posLoc: gl.getAttribLocation(prog, 'a_position'),
    startTime: Date.now(),
    uTexture: textureUniform ? gl.getUniformLocation(prog, textureUniform) : null,
    texture: texture || null,
  };

  shaders[name] = info;
  return info;
}

function startShader(name) {
  if (activeAnimId) cancelAnimationFrame(activeAnimId);

  const info = shaders[name];
  if (!info) return;

  gl.useProgram(info.program);
  gl.bindBuffer(gl.ARRAY_BUFFER, quadBuf);
  gl.enableVertexAttribArray(info.posLoc);
  gl.vertexAttribPointer(info.posLoc, 2, gl.FLOAT, false, 0, 0);

  // Bind this shader's texture
  if (info.uTexture && info.texture) {
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, info.texture);
    gl.uniform1i(info.uTexture, 0);
  }

  function render() {
    gl.uniform1f(info.uTime, (Date.now() - info.startTime) / 1000);
    gl.uniform2f(info.uRes, canvas.width, canvas.height);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
    activeAnimId = requestAnimationFrame(render);
  }
  render();
}

function switchShader(view) {
  startShader(view);
}


// ── Initialize ──

async function init() {
  // Create ASCII texture for dev shader (needs font loaded)
  devAsciiTexture = createAsciiTexture();

  // Load image textures in parallel
  const [coffeeTexture, eyeTexture] = await Promise.all([
    loadImageTexture('imagecoffee.png'),
    loadImageTexture('image_eye.png'),
  ]);

  // Init all shaders with their textures
  initShader('dev', DEV_FRAG, 'u_ascii', devAsciiTexture);
  initShader('design', DESIGN_FRAG, 'u_image', coffeeTexture);
  initShader('everyone', EVERYONE_FRAG, 'u_image', eyeTexture);

  // Start with dev
  startShader('dev');
}

// Wait for Space Mono font then init
document.fonts.ready.then(() => {
  init();
});
