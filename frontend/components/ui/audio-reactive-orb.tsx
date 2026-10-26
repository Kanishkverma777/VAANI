"use client";

import React, { useEffect, useRef } from "react";
import { Mic, Square } from "lucide-react";

export interface AudioReactiveOrbProps {
  /** Whether the microphone is actively recording/listening */
  isListening: boolean;
  /** Callback when user clicks the orb or the action button */
  onToggle: () => void;
  /** Custom diameter in pixels (default: 280) */
  size?: number;
  /** Optional prompt or status text */
  statusText?: string;
  /** Optional sub-text */
  hintText?: string;
  /** Custom class name */
  className?: string;
  /** Disable toggle */
  disabled?: boolean;
}

const VERTEX_SHADER = `
attribute vec2 position;
void main() {
  gl_Position = vec4(position, 0.0, 1.0);
}
`;

const FRAGMENT_SHADER = `
precision highp float;
uniform vec2 u_resolution;
uniform float u_time;
uniform float u_volume;
uniform float u_bass;
uniform float u_mid;
uniform float u_treble;
uniform float u_is_listening;

#define PI 3.14159265359

void main() {
  // Normalized UV coordinates (-0.5 to 0.5 centered)
  vec2 uv = (gl_FragCoord.xy - 0.5 * u_resolution.xy) / min(u_resolution.x, u_resolution.y);
  
  float dist = length(uv);
  float angle = atan(uv.y, uv.x); // -PI to PI (y > 0 is top)

  float vol = u_volume;
  float time = u_time;
  
  // Real-time audio ripple (delicate liquid shimmer around the perimeter)
  float wave = 0.0;
  if (u_is_listening > 0.5) {
    wave = sin(angle * 14.0 + time * 6.0) * (vol * 0.008 + u_treble * 0.006)
         + cos(angle * 8.0 - time * 4.0) * (u_mid * 0.007)
         + sin(angle * 4.0 + time * 2.5) * (u_bass * 0.009);
  } else {
    // Subtle living breath in idle state
    wave = sin(angle * 4.0 + time * 1.5) * 0.002 + cos(angle * 6.0 - time * 1.2) * 0.0015;
  }

  // Torus geometry: slender, elegant, photorealistic proportions matching reference image
  float baseR = 0.34;
  float tubeR = 0.028 * (1.0 + vol * 0.28);
  float currentR = baseR + wave + vol * 0.02;

  // Radial distance from central spine of the torus tube
  float d = abs(dist - currentR);

  // Volumetric Gaussian light distribution across cross-section
  float core = exp(-(d * d) / (2.0 * tubeR * tubeR * 0.22));
  float body = exp(-(d * d) / (2.0 * tubeR * tubeR * 0.85));
  float halo = exp(-d / (tubeR * 1.6)) * 0.55;
  float outerAtmosphere = exp(-d / (tubeR * 3.2)) * 0.32;

  // Specular Top Rim Crest (Razor-sharp incandescent gleam along the upper crest between 10 o'clock and 2 o'clock)
  float topFactor = smoothstep(-0.1, 0.85, sin(angle));
  float topHighlightDist = abs(dist - (currentR + tubeR * 0.22));
  float specularRim = pow(topFactor, 3.8) * exp(-(topHighlightDist * topHighlightDist) / (2.0 * 0.000075));
  
  // Secondary inner rim sheen
  float innerHighlightDist = abs(dist - (currentR - tubeR * 0.25));
  float innerRim = pow(topFactor, 2.8) * exp(-(innerHighlightDist * innerHighlightDist) / (2.0 * 0.00028)) * 0.45;

  // Photorealistic chromatic gradient matching reference image:
  // - Left (x < 0): Electric Sky Cyan / Aqua (#0ac2fa)
  // - Right (x > 0): Rich Neon Purple / Violet / Magenta (#a842f5)
  // - Top Rim: Brilliant Celestial White / Diamond Blue (#ffffff)
  // - Bottom: Deep Royal Sapphire (#1e4df5)
  float xFactor = clamp((uv.x / currentR) * 0.55 + 0.5, 0.0, 1.0);
  
  vec3 cyan = vec3(0.08, 0.78, 1.0);        // Electric Sky Cyan
  vec3 deepBlue = vec3(0.12, 0.30, 0.98);   // Deep Royal Sapphire
  vec3 purple = vec3(0.72, 0.24, 1.0);      // Rich Neon Purple
  vec3 magenta = vec3(0.92, 0.20, 0.95);    // Magenta
  vec3 whiteBlue = vec3(0.96, 0.98, 1.0);   // Pure Specular White

  // Horizontal gradient: Cyan on left, Purple/Magenta on right
  vec3 baseColor = mix(cyan, magenta, xFactor);
  
  // Bottom transition to deep royal blue
  float bottomFactor = smoothstep(0.0, -0.65, uv.y / currentR);
  baseColor = mix(baseColor, deepBlue, bottomFactor * 0.5);

  // Top transition to brilliant celestial white
  baseColor = mix(baseColor, whiteBlue, topFactor * 0.45);

  // Accumulate volumetric lighting passes
  vec3 col = vec3(0.0);

  // 1. Soft atmospheric bloom aura
  col += baseColor * outerAtmosphere * (0.7 + vol * 0.5);

  // 2. Torus volumetric body with deep diffusion
  col += baseColor * body * 0.95;

  // 3. High-intensity luminous core
  vec3 coreColor = mix(baseColor, vec3(1.0, 1.0, 1.0), 0.6);
  col += coreColor * core * (1.2 + vol * 0.6);

  // 4. Razor-sharp top specular rim (exact 3D glass reflection)
  vec3 specularColor = vec3(1.0, 1.0, 1.0) + vec3(0.1, 0.4, 1.0) * 0.3;
  col += specularColor * specularRim * (2.2 + vol * 0.9);
  col += whiteBlue * innerRim * 0.85;

  // 5. Ambient backlight glow focused only near the ring (NO square bleed)
  float glowCyan = exp(-length(uv - vec2(-currentR * 0.5, 0.0)) / 0.18) * 0.15;
  float glowPurple = exp(-length(uv - vec2(currentR * 0.5, 0.0)) / 0.18) * 0.15;
  float glowTop = exp(-length(uv - vec2(0.0, currentR * 0.7)) / 0.15) * 0.22;
  
  col += cyan * glowCyan * (1.0 + vol * 0.5);
  col += purple * glowPurple * (1.0 + vol * 0.5);
  col += whiteBlue * glowTop * (1.0 + vol * 0.6);

  // Hollow center mask with soft radial falloff into pure black
  float centerDarkness = smoothstep(currentR - tubeR * 0.8, 0.0, dist);
  col *= (1.0 - centerDarkness * 0.92);

  // Circular Vignette: GUARANTEES NO SQUARE BOX!
  // Any pixel beyond dist = 0.44 fades smoothly to exactly 0.0 alpha
  float vignette = smoothstep(0.46, 0.38, dist);
  col *= vignette;

  // Reinhard cinematic tone mapping to preserve velvety saturation
  col = col / (col + vec3(0.92));
  col = pow(col, vec3(0.94)); // Contrast curve

  // Output alpha strictly based on color intensity and vignette mask
  float alpha = clamp(dot(col, vec3(0.299, 0.587, 0.114)) * 3.2, 0.0, 1.0) * vignette;
  
  gl_FragColor = vec4(col, alpha);
}
`;

function createShader(gl: WebGLRenderingContext, type: number, source: string): WebGLShader | null {
  const shader = gl.createShader(type);
  if (!shader) return null;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    console.error("Shader compile error:", gl.getShaderInfoLog(shader));
    gl.deleteShader(shader);
    return null;
  }
  return shader;
}

function createProgram(
  gl: WebGLRenderingContext,
  vSource: string,
  fSource: string
): WebGLProgram | null {
  const vs = createShader(gl, gl.VERTEX_SHADER, vSource);
  const fs = createShader(gl, gl.FRAGMENT_SHADER, fSource);
  if (!vs || !fs) return null;

  const program = gl.createProgram();
  if (!program) return null;

  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.linkProgram(program);

  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.error("Program link error:", gl.getProgramInfoLog(program));
    gl.deleteProgram(program);
    return null;
  }
  return program;
}

export function AudioReactiveOrb({
  isListening,
  onToggle,
  size = 280,
  statusText,
  hintText,
  className = "",
  disabled = false,
}: AudioReactiveOrbProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const animationFrameRef = useRef<number>(0);
  const isListeningRef = useRef(isListening);
  isListeningRef.current = isListening;

  // Setup Web Audio API when recording begins
  useEffect(() => {
    let active = true;

    if (isListening) {
      const initAudio = async () => {
        try {
          if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            return;
          }
          const stream = await navigator.mediaDevices.getUserMedia({
            audio: {
              echoCancellation: true,
              noiseSuppression: true,
              autoGainControl: true,
            },
          });
          if (!active) {
            stream.getTracks().forEach((track) => track.stop());
            return;
          }
          mediaStreamRef.current = stream;

          const AudioCtx =
            window.AudioContext ||
            (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
          const ctx = new AudioCtx();
          audioCtxRef.current = ctx;

          const analyser = ctx.createAnalyser();
          analyser.fftSize = 256;
          analyser.smoothingTimeConstant = 0.75;
          analyserRef.current = analyser;

          const source = ctx.createMediaStreamSource(stream);
          source.connect(analyser);
        } catch (err) {
          console.warn("AudioReactiveOrb: Microphone stream access deferred:", err);
        }
      };

      initAudio();
    } else {
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((track) => track.stop());
        mediaStreamRef.current = null;
      }
      if (audioCtxRef.current && audioCtxRef.current.state !== "closed") {
        audioCtxRef.current.close().catch(() => {});
        audioCtxRef.current = null;
      }
      analyserRef.current = null;
    }

    return () => {
      active = false;
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((track) => track.stop());
        mediaStreamRef.current = null;
      }
      if (audioCtxRef.current && audioCtxRef.current.state !== "closed") {
        audioCtxRef.current.close().catch(() => {});
        audioCtxRef.current = null;
      }
      analyserRef.current = null;
    };
  }, [isListening]);

  // Main 60fps WebGL Shader Render Loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const gl = canvas.getContext("webgl", {
      alpha: true,
      antialias: true,
      depth: false,
      premultipliedAlpha: false,
    });

    if (!gl) {
      console.warn("AudioReactiveOrb: WebGL not available");
      return;
    }

    // Enable transparent alpha blending
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.clearColor(0.0, 0.0, 0.0, 0.0);

    const program = createProgram(gl, VERTEX_SHADER, FRAGMENT_SHADER);
    if (!program) return;

    // Full-screen quad buffer (-1 to 1)
    const positionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([
        -1.0, -1.0,
         1.0, -1.0,
        -1.0,  1.0,
        -1.0,  1.0,
         1.0, -1.0,
         1.0,  1.0,
      ]),
      gl.STATIC_DRAW
    );

    const positionLocation = gl.getAttribLocation(program, "position");
    gl.enableVertexAttribArray(positionLocation);
    gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);

    // Uniform locations
    const uResolution = gl.getUniformLocation(program, "u_resolution");
    const uTime = gl.getUniformLocation(program, "u_time");
    const uVolume = gl.getUniformLocation(program, "u_volume");
    const uBass = gl.getUniformLocation(program, "u_bass");
    const uMid = gl.getUniformLocation(program, "u_mid");
    const uTreble = gl.getUniformLocation(program, "u_treble");
    const uIsListening = gl.getUniformLocation(program, "u_is_listening");

    const dpr = Math.min(2, typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1);
    const pixelWidth = Math.round(size * dpr);
    const pixelHeight = Math.round(size * dpr);
    canvas.width = pixelWidth;
    canvas.height = pixelHeight;

    gl.viewport(0, 0, pixelWidth, pixelHeight);

    const freqArray = new Uint8Array(128);
    let startTime = performance.now();
    let currentVol = 0;
    let currentBass = 0;
    let currentMid = 0;
    let currentTreble = 0;

    const render = (now: number) => {
      const elapsed = (now - startTime) / 1000;

      // Extract frequency bins if recording
      let targetVol = 0;
      let targetBass = 0;
      let targetMid = 0;
      let targetTreble = 0;

      if (isListeningRef.current && analyserRef.current) {
        try {
          analyserRef.current.getByteFrequencyData(freqArray);
          
          // Bass: bins 0 to 8
          let bassSum = 0;
          for (let i = 0; i < 8; i++) bassSum += freqArray[i];
          targetBass = (bassSum / 8) / 255;

          // Mid: bins 8 to 48
          let midSum = 0;
          for (let i = 8; i < 48; i++) midSum += freqArray[i];
          targetMid = (midSum / 40) / 255;

          // Treble: bins 48 to 110
          let trebleSum = 0;
          for (let i = 48; i < 110; i++) trebleSum += freqArray[i];
          targetTreble = (trebleSum / 62) / 255;

          targetVol = targetBass * 0.45 + targetMid * 0.4 + targetTreble * 0.15;
        } catch {
          targetVol = 0;
        }
      } else if (isListeningRef.current) {
        // Fallback smooth simulation when listening before mic stream binds
        targetVol = 0.22 + 0.12 * Math.sin(elapsed * 5.0);
        targetMid = 0.18 + 0.10 * Math.cos(elapsed * 7.0);
      }

      // Smooth interpolation for natural fluid response
      currentVol += (targetVol - currentVol) * 0.2;
      currentBass += (targetBass - currentBass) * 0.2;
      currentMid += (targetMid - currentMid) * 0.2;
      currentTreble += (targetTreble - currentTreble) * 0.2;

      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.useProgram(program);

      gl.uniform2f(uResolution, pixelWidth, pixelHeight);
      gl.uniform1f(uTime, elapsed);
      gl.uniform1f(uVolume, currentVol);
      gl.uniform1f(uBass, currentBass);
      gl.uniform1f(uMid, currentMid);
      gl.uniform1f(uTreble, currentTreble);
      gl.uniform1f(uIsListening, isListeningRef.current ? 1.0 : 0.0);

      gl.drawArrays(gl.TRIANGLES, 0, 6);

      animationFrameRef.current = requestAnimationFrame(render);
    };

    animationFrameRef.current = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(animationFrameRef.current);
      if (positionBuffer) gl.deleteBuffer(positionBuffer);
      if (program) gl.deleteProgram(program);
    };
  }, [size]);

  return (
    <div className={`flex flex-col items-center justify-center select-none ${className}`}>
      {/* 3D Photorealistic Audio-Reactive Glass/Plasma Orb (No square artifact) */}
      <div
        className="relative flex items-center justify-center cursor-pointer group bg-transparent"
        style={{ width: size, height: size }}
        onClick={!disabled ? onToggle : undefined}
        role="button"
        tabIndex={0}
        aria-label={isListening ? "Stop recording" : "Start recording"}
        title={isListening ? "Click orb to stop recording" : "Click orb to start recording"}
      >
        <canvas
          ref={canvasRef}
          style={{ width: size, height: size, background: "transparent" }}
          className="relative z-10 block transition-transform duration-300 group-hover:scale-[1.015]"
        />
      </div>

      {/* Pill Button: Start Recording / Stop Recording (Exact Match with Reference Image) */}
      <div className="mt-4 flex flex-col items-center gap-2">
        <button
          type="button"
          onClick={onToggle}
          disabled={disabled}
          className={`inline-flex items-center gap-2.5 px-6 py-2.5 rounded-full text-xs font-semibold tracking-wide transition-all duration-200 shadow-xl disabled:opacity-50 ${
            isListening
              ? "bg-red-500 hover:bg-red-600 text-white shadow-red-500/25 scale-[1.02] ring-2 ring-red-400/40"
              : "bg-[#e4e4e7] hover:bg-white text-zinc-900 shadow-black/40 hover:scale-[1.02] ring-1 ring-white/10"
          }`}
        >
          {isListening ? (
            <>
              <Square className="w-3.5 h-3.5 fill-current animate-pulse text-white" />
              <span>Stop Recording</span>
            </>
          ) : (
            <>
              <Mic className="w-4 h-4 text-zinc-800" />
              <span>Start Recording</span>
            </>
          )}
        </button>

        {/* Dynamic Status / Hint */}
        {statusText && (
          <p className="text-xs font-medium text-white text-center mt-1">
            {statusText}
          </p>
        )}
        {hintText && (
          <p className="text-[11px] text-zinc-500 text-center max-w-sm">
            {hintText}
          </p>
        )}
      </div>
    </div>
  );
}

export default AudioReactiveOrb;
