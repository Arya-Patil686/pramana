"use client";

import { useState, useEffect } from "react";

interface WebGLSupport {
  supported: boolean;
  tier: "high" | "low" | "none";
}

export function useWebGLSupport(): WebGLSupport {
  const [support, setSupport] = useState<WebGLSupport>({
    supported: true, // optimistic default for SSR
    tier: "high",
  });

  /*
     Probing runs in an animation frame rather than in the effect body. Two
     reasons: creating a WebGL context is a synchronous GPU call and doing it
     during hydration stalls the first paint, and setting state straight from
     an effect body triggers the cascading render React 19 warns about.
  */
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      try {
        const canvas = document.createElement("canvas");
        const gl = canvas.getContext("webgl2") || canvas.getContext("webgl");

        if (!gl) {
          setSupport({ supported: false, tier: "none" });
          return;
        }

        // Check for high-tier: look at max texture size and renderer
        const debugInfo = gl.getExtension("WEBGL_debug_renderer_info");
        const renderer = debugInfo
          ? gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL)
          : "";
        const maxTextureSize = gl.getParameter(gl.MAX_TEXTURE_SIZE);

        // Low-tier heuristics: integrated GPU or small max texture
        const isLowTier =
          maxTextureSize < 8192 || /SwiftShader|Mesa|Intel.*HD/i.test(renderer);

        setSupport({
          supported: true,
          tier: isLowTier ? "low" : "high",
        });

        canvas.remove();
      } catch {
        setSupport({ supported: false, tier: "none" });
      }
    });
    return () => cancelAnimationFrame(frame);
  }, []);

  return support;
}
