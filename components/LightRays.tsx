"use client";

import { useRef, useEffect, useState } from "react";
import { Renderer, Program, Triangle, Mesh } from "ogl";
import { cn } from "@/lib/utils";

export type RaysOrigin =
    | "top-center"
    | "top-center-offset"
    | "top-left"
    | "top-right"
    | "right"
    | "left"
    | "bottom-center"
    | "bottom-right"
    | "bottom-left";

interface LightRaysProps {
    raysOrigin?: RaysOrigin;
    raysColor?: string;
    raysSpeed?: number;
    lightSpread?: number;
    rayLength?: number;
    pulsating?: boolean;
    fadeDistance?: number;
    saturation?: number;
    followMouse?: boolean;
    mouseInfluence?: number;
    noiseAmount?: number;
    distortion?: number;
    className?: string;
}

const DEFAULT_COLOR = "#ffffff";

const hexToRgb = (hex: string): [number, number, number] => {
    const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return m
        ? [
            parseInt(m[1], 16) / 255,
            parseInt(m[2], 16) / 255,
            parseInt(m[3], 16) / 255,
        ]
        : [1, 1, 1];
};

const getAnchorAndDir = (
    origin: RaysOrigin,
    w: number,
    h: number
): { anchor: [number, number]; dir: [number, number] } => {
    const outside = 0.2;
    switch (origin) {
        case "top-left":
            return { anchor: [0, -outside * h], dir: [0.7071, 0.7071] };
        case "top-right":
            return { anchor: [w, -outside * h], dir: [-0.7071, 0.7071] };
        case "top-center-offset":
            return { anchor: [0.5 * w + 0.2 * w, -outside * h], dir: [-0.196, 0.98] };
        case "left":
            return { anchor: [-outside * w, 0.5 * h], dir: [1, 0] };
        case "right":
            return { anchor: [(1 + outside) * w, 0.5 * h], dir: [-1, 0] };
        case "bottom-left":
            return { anchor: [0, (1 + outside) * h], dir: [0.7071, -0.7071] };
        case "bottom-center":
            return { anchor: [0.5 * w, (1 + outside) * h], dir: [0, -1] };
        case "bottom-right":
            return { anchor: [w, (1 + outside) * h], dir: [-0.7071, -0.7071] };
        case "top-center":
        default:
            return { anchor: [0.5 * w, -outside * h], dir: [0, 1] };
    }
};

const vert = `
attribute vec2 position;
varying vec2 vUv;
void main() {
  vUv = position * 0.5 + 0.5;
  gl_Position = vec4(position, 0.0, 1.0);
}`;

const frag = `precision highp float;

uniform float iTime;
uniform vec2  iResolution;

uniform vec2  rayPos;
uniform vec2  rayDir;
uniform vec3  raysColor;
uniform float raysSpeed;
uniform float lightSpread;
uniform float rayLength;
uniform float pulsating;
uniform float fadeDistance;
uniform float saturation;
uniform vec2  mousePos;
uniform float mouseInfluence;
uniform float noiseAmount;
uniform float distortion;

varying vec2 vUv;

float noise(vec2 st) {
  return fract(sin(dot(st.xy, vec2(12.9898, 78.233))) * 43758.5453123);
}

float rayStrength(vec2 raySource, vec2 rayRefDirection, vec2 coord,
                  float seedA, float seedB, float speed) {
  vec2 sourceToCoord = coord - raySource;
  float dist = length(sourceToCoord);
  vec2 dirNorm = dist > 0.0001 ? normalize(sourceToCoord) : rayRefDirection;
  float cosAngle = dot(dirNorm, rayRefDirection);

  float distortedAngle = cosAngle + distortion * sin(iTime * 2.0 + dist * 0.01) * 0.2;
  
  float spreadFactor = distortedAngle > 0.0 ? pow(distortedAngle, 1.0 / max(lightSpread, 0.001)) : 0.0;

  float maxDistance = max(iResolution.x, iResolution.y) * max(rayLength, 0.001);
  float lengthFalloff = clamp((maxDistance - dist) / maxDistance, 0.0, 1.0);
  
  float fadeDist = max(iResolution.x, iResolution.y) * max(fadeDistance, 0.001);
  float fadeFalloff = clamp((fadeDist - dist) / fadeDist, 0.0, 1.0);
  float pulse = pulsating > 0.5 ? (0.8 + 0.2 * sin(iTime * speed * 3.0)) : 1.0;

  float baseStrength = clamp(
    (0.45 + 0.15 * sin(distortedAngle * seedA + iTime * speed)) +
    (0.3 + 0.2 * cos(-distortedAngle * seedB + iTime * speed)),
    0.0, 1.0
  );

  return baseStrength * lengthFalloff * fadeFalloff * spreadFactor * pulse;
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 coord = vec2(fragCoord.x, max(iResolution.y, 1.0) - fragCoord.y);
  
  vec2 finalRayDir = rayDir;
  if (mouseInfluence > 0.0) {
    vec2 mouseScreenPos = mousePos * iResolution.xy;
    vec2 mouseDiff = mouseScreenPos - rayPos;
    if (length(mouseDiff) > 0.001) {
      vec2 mouseDirection = normalize(mouseDiff);
      finalRayDir = normalize(mix(rayDir, mouseDirection, clamp(mouseInfluence, 0.0, 1.0)));
    }
  }

  float s1 = rayStrength(rayPos, finalRayDir, coord, 36.2214, 21.11349, 1.5 * raysSpeed);
  float s2 = rayStrength(rayPos, finalRayDir, coord, 22.3991, 18.0234, 1.1 * raysSpeed);

  float totalStrength = s1 * 0.5 + s2 * 0.4;

  if (noiseAmount > 0.0) {
    float n = noise(coord * 0.01 + iTime * 0.1);
    totalStrength *= (1.0 - noiseAmount + noiseAmount * n);
  }

  float brightness = 1.0 - (coord.y / max(iResolution.y, 1.0));
  float intensity = totalStrength * (0.2 + brightness * 0.8);

  vec3 col = raysColor * intensity;

  if (saturation != 1.0) {
    float gray = dot(col, vec3(0.299, 0.587, 0.114));
    col = mix(vec3(gray), col, saturation);
  }

  fragColor = vec4(col, clamp(intensity, 0.0, 1.0));
}

void main() {
  vec4 color;
  mainImage(color, gl_FragCoord.xy);
  gl_FragColor = color;
}`;

const LightRays: React.FC<LightRaysProps> = ({
    raysOrigin = "top-center",
    raysColor = DEFAULT_COLOR,
    raysSpeed = 1,
    lightSpread = 1,
    rayLength = 2,
    pulsating = false,
    fadeDistance = 1.0,
    saturation = 1.0,
    followMouse = true,
    mouseInfluence = 0.1,
    noiseAmount = 0.0,
    distortion = 0.0,
    className = "",
}) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const uniformsRef = useRef<any>(null);
    const rendererRef = useRef<Renderer | null>(null);
    const meshRef = useRef<any>(null);
    const animationIdRef = useRef<number | null>(null);

    const mouseRef = useRef({ x: 0.5, y: 0.5 });
    const smoothMouseRef = useRef({ x: 0.5, y: 0.5 });

    const raysOriginRef = useRef(raysOrigin);
    raysOriginRef.current = raysOrigin;

    const followMouseRef = useRef(followMouse);
    followMouseRef.current = followMouse;

    const mouseInfluenceRef = useRef(mouseInfluence);
    mouseInfluenceRef.current = mouseInfluence;

    const [isVisible, setIsVisible] = useState(false);

    // Visibility observer to pause rendering when offscreen
    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;

        const observer = new IntersectionObserver(
            ([entry]) => {
                setIsVisible(entry.isIntersecting);
            },
            { threshold: 0 }
        );

        observer.observe(container);

        return () => {
            observer.disconnect();
        };
    }, []);

    // WebGL context initialization
    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;

        let renderer: Renderer | null = null;
        try {
            renderer = new Renderer({
                dpr: Math.min(window.devicePixelRatio, 2),
                alpha: true,
                premultipliedAlpha: false,
            });
        } catch (err) {
            console.warn("WebGL initialization failed:", err);
            return;
        }

        rendererRef.current = renderer;
        const gl = renderer.gl;
        gl.canvas.style.display = "block";
        gl.canvas.style.width = "100%";
        gl.canvas.style.height = "100%";

        container.replaceChildren(gl.canvas);

        const uniforms = {
            iTime: { value: 0 },
            iResolution: { value: [1, 1] },
            rayPos: { value: [0, 0] },
            rayDir: { value: [0, 1] },
            raysColor: { value: hexToRgb(raysColor) },
            raysSpeed: { value: raysSpeed },
            lightSpread: { value: lightSpread },
            rayLength: { value: rayLength },
            pulsating: { value: pulsating ? 1.0 : 0.0 },
            fadeDistance: { value: fadeDistance },
            saturation: { value: saturation },
            mousePos: { value: [0.5, 0.5] },
            mouseInfluence: { value: mouseInfluence },
            noiseAmount: { value: noiseAmount },
            distortion: { value: distortion },
        };
        uniformsRef.current = uniforms;

        const geometry = new Triangle(gl);
        const program = new Program(gl, {
            vertex: vert,
            fragment: frag,
            uniforms,
        });
        const mesh = new Mesh(gl, { geometry, program });
        meshRef.current = mesh;

        const updatePlacement = () => {
            if (!containerRef.current || !rendererRef.current || !uniformsRef.current) return;

            const wCSS = containerRef.current.clientWidth;
            const hCSS = containerRef.current.clientHeight;
            if (wCSS === 0 || hCSS === 0) return;

            const r = rendererRef.current;
            r.dpr = Math.min(window.devicePixelRatio, 2);
            r.setSize(wCSS, hCSS);

            const w = wCSS * r.dpr;
            const h = hCSS * r.dpr;

            uniformsRef.current.iResolution.value = [w, h];

            const { anchor, dir } = getAnchorAndDir(raysOriginRef.current, w, h);
            uniformsRef.current.rayPos.value = anchor;
            uniformsRef.current.rayDir.value = dir;
        };

        const resizeObserver = new ResizeObserver(() => {
            updatePlacement();
        });
        resizeObserver.observe(container);

        window.addEventListener("resize", updatePlacement);
        updatePlacement();

        return () => {
            resizeObserver.disconnect();
            window.removeEventListener("resize", updatePlacement);

            if (renderer) {
                try {
                    const canvas = renderer.gl.canvas;
                    const loseContextExt = renderer.gl.getExtension("WEBGL_lose_context");
                    if (loseContextExt) {
                        loseContextExt.loseContext();
                    }
                    if (canvas && canvas.parentNode) {
                        canvas.parentNode.removeChild(canvas);
                    }
                } catch (error) {
                    console.warn("Error during WebGL cleanup:", error);
                }
            }

            rendererRef.current = null;
            uniformsRef.current = null;
            meshRef.current = null;
        };
    }, []);

    // Animation frame loop: active only when element is visible
    useEffect(() => {
        if (!isVisible) {
            if (animationIdRef.current) {
                cancelAnimationFrame(animationIdRef.current);
                animationIdRef.current = null;
            }
            return;
        }

        const loop = (t: number) => {
            if (!rendererRef.current || !uniformsRef.current || !meshRef.current) {
                return;
            }

            uniformsRef.current.iTime.value = t * 0.001;

            if (followMouseRef.current && mouseInfluenceRef.current > 0.0) {
                const smoothing = 0.92;
                smoothMouseRef.current.x =
                    smoothMouseRef.current.x * smoothing +
                    mouseRef.current.x * (1 - smoothing);
                smoothMouseRef.current.y =
                    smoothMouseRef.current.y * smoothing +
                    mouseRef.current.y * (1 - smoothing);

                uniformsRef.current.mousePos.value = [
                    smoothMouseRef.current.x,
                    smoothMouseRef.current.y,
                ];
            }

            try {
                rendererRef.current.render({ scene: meshRef.current });
                animationIdRef.current = requestAnimationFrame(loop);
            } catch (error) {
                console.warn("WebGL rendering error:", error);
            }
        };

        animationIdRef.current = requestAnimationFrame(loop);

        return () => {
            if (animationIdRef.current) {
                cancelAnimationFrame(animationIdRef.current);
                animationIdRef.current = null;
            }
        };
    }, [isVisible]);

    // Live uniforms update without context destruction
    useEffect(() => {
        if (!uniformsRef.current) return;
        const u = uniformsRef.current;

        u.raysColor.value = hexToRgb(raysColor);
        u.raysSpeed.value = raysSpeed;
        u.lightSpread.value = lightSpread;
        u.rayLength.value = rayLength;
        u.pulsating.value = pulsating ? 1.0 : 0.0;
        u.fadeDistance.value = fadeDistance;
        u.saturation.value = saturation;
        u.mouseInfluence.value = mouseInfluence;
        u.noiseAmount.value = noiseAmount;
        u.distortion.value = distortion;

        if (containerRef.current && rendererRef.current) {
            const wCSS = containerRef.current.clientWidth;
            const hCSS = containerRef.current.clientHeight;
            if (wCSS > 0 && hCSS > 0) {
                const dpr = rendererRef.current.dpr;
                const { anchor, dir } = getAnchorAndDir(raysOrigin, wCSS * dpr, hCSS * dpr);
                u.rayPos.value = anchor;
                u.rayDir.value = dir;
            }
        }
    }, [
        raysColor,
        raysSpeed,
        lightSpread,
        raysOrigin,
        rayLength,
        pulsating,
        fadeDistance,
        saturation,
        mouseInfluence,
        noiseAmount,
        distortion,
    ]);

    // Mouse movement tracking
    useEffect(() => {
        if (!followMouse) return;

        const handleMouseMove = (e: MouseEvent) => {
            if (!containerRef.current) return;
            const rect = containerRef.current.getBoundingClientRect();
            if (rect.width === 0 || rect.height === 0) return;
            const x = (e.clientX - rect.left) / rect.width;
            const y = (e.clientY - rect.top) / rect.height;
            if (Number.isFinite(x) && Number.isFinite(y)) {
                mouseRef.current = { x, y };
            }
        };

        window.addEventListener("mousemove", handleMouseMove);
        return () => window.removeEventListener("mousemove", handleMouseMove);
    }, [followMouse]);

    return (
        <div
            ref={containerRef}
            className={cn(
                "pointer-events-none relative z-[3] h-full w-full overflow-hidden",
                className
            )}
        />
    );
};

export default LightRays;
