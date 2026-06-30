import type p5 from 'p5';
import type { SketchParams } from '../../core/types';
import { clamp01 } from './helpers';
import { state } from './state';

export const TRAIL_VERTEX_SHADER = `
precision mediump float;

attribute vec3 aPosition;

void main() {
  gl_Position = vec4(aPosition.xy, 0.0, 1.0);
}
`;

export const TRAIL_FRAGMENT_SHADER = `
precision mediump float;

uniform float uAlpha;
uniform float uScanlineAmount;
uniform float uScanlineCount;
uniform float uTime;
uniform vec2 uResolution;
uniform vec3 uTopColor;
uniform vec3 uBottomColor;

void main() {
  float y = clamp(gl_FragCoord.y / max(uResolution.y, 1.0), 0.0, 1.0);
  vec3 color = mix(uBottomColor, uTopColor, y);
  float scan = sin((gl_FragCoord.y + uTime * 24.0) * uScanlineCount);
  float scanMask = mix(1.0, 0.58 + 0.42 * smoothstep(-0.2, 0.75, scan), uScanlineAmount);
  color *= scanMask;
  gl_FragColor = vec4(color, uAlpha);
}
`;

export function clearWebglTrail(
  p: p5,
  alpha: number,
  mode: SketchParams[string],
  scanlineAmount: number,
  scanlineCount: number,
  timeMs: number,
) {
  const gl = p.drawingContext as WebGLRenderingContext;

  p.push();
  p.resetMatrix();
  p.ortho(-p.width / 2, p.width / 2, -p.height / 2, p.height / 2, -1000, 1000);
  gl.disable(gl.DEPTH_TEST);
  gl.depthMask(false);
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
  p.noStroke();

  if (mode === 'gradient' && state.trailShader) {
    p.shader(state.trailShader);
    state.trailShader.setUniform('uAlpha', clamp01(alpha / 255));
    state.trailShader.setUniform('uScanlineAmount', scanlineAmount);
    state.trailShader.setUniform('uScanlineCount', scanlineCount);
    state.trailShader.setUniform('uTime', timeMs * 0.001);
    state.trailShader.setUniform('uResolution', [p.width, p.height]);
    state.trailShader.setUniform('uTopColor', [5 / 255, 10 / 255, 30 / 255]);
    state.trailShader.setUniform('uBottomColor', [0, 0, 0]);

    p.beginShape();
    p.vertex(-p.width / 2, -p.height / 2, 0);
    p.vertex(p.width / 2, -p.height / 2, 0);
    p.vertex(p.width / 2, p.height / 2, 0);
    p.vertex(-p.width / 2, p.height / 2, 0);
    p.endShape(p.CLOSE);
    p.resetShader();
  } else {
    p.fill(0, 0, 0, alpha);
    p.rect(-p.width, -p.height, p.width * 2, p.height * 2);
  }

  p.pop();

  gl.enable(gl.DEPTH_TEST);
  gl.depthMask(true);
  gl.clear(gl.DEPTH_BUFFER_BIT);
  p.perspective();
}

