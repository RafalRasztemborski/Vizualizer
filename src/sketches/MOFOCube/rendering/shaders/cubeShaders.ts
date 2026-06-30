export const CUBE_VERTEX_SHADER = `#version 300 es
precision highp float;

in vec3 aPosition;
in vec3 aNormal;
in vec3 aInstancePosition;
in vec3 aInstanceScale;
in vec4 aInstanceColor;
in float aInstanceEdgeAlpha;

uniform mat4 uProjectionMatrix;
uniform mat4 uModelViewMatrix;

out vec3 vLocalNormal;
out vec3 vLocalPosition;
out vec4 vColor;
out float vEdgeAlpha;

void main() {
  vec3 localPosition = aPosition * aInstanceScale;
  vec4 worldPosition = uModelViewMatrix * vec4(localPosition + aInstancePosition, 1.0);

  vLocalNormal = aNormal;
  vLocalPosition = aPosition;
  vColor = aInstanceColor;
  vEdgeAlpha = aInstanceEdgeAlpha;
  gl_Position = uProjectionMatrix * worldPosition;
}
`;

export const CUBE_FRAGMENT_SHADER = `#version 300 es
precision highp float;

in vec3 vLocalNormal;
in vec3 vLocalPosition;
in vec4 vColor;
in float vEdgeAlpha;

uniform float uEdgeWeightPx;

out vec4 outColor;

float edgeMaskForCube(vec3 localPosition, vec3 normal) {
  if (uEdgeWeightPx <= 0.0) return 0.0;

  vec3 absNormal = abs(normal);
  vec2 faceUv;

  if (absNormal.x > absNormal.y && absNormal.x > absNormal.z) {
    faceUv = localPosition.yz;
  } else if (absNormal.y > absNormal.z) {
    faceUv = localPosition.xz;
  } else {
    faceUv = localPosition.xy;
  }

  vec2 distanceToEdge = vec2(0.5) - abs(faceUv);
  float edgeDistance = min(distanceToEdge.x, distanceToEdge.y);
  float edgeDistancePx = edgeDistance / max(fwidth(edgeDistance), 0.000001);
  return 1.0 - smoothstep(
    max(0.0, uEdgeWeightPx - 0.75),
    uEdgeWeightPx + 0.75,
    edgeDistancePx
  );
}

void main() {
  vec3 normal = normalize(vLocalNormal);
  float edgeMask = edgeMaskForCube(vLocalPosition, normal) * clamp(vEdgeAlpha, 0.0, 1.0);

  outColor = vec4(mix(vColor.rgb, vec3(0.0), edgeMask), vColor.a);
}
`;
