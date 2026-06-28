export const CUBE_VERTEX_SHADER = `#version 300 es
precision highp float;

in vec3 aPosition;
in vec3 aNormal;
in vec3 aInstancePosition;
in vec3 aInstanceScale;
in vec4 aInstanceColor;

uniform mat4 uProjectionMatrix;
uniform mat4 uModelViewMatrix;
uniform mat3 uNormalMatrix;

out vec3 vNormal;
out vec4 vColor;

void main() {
  vec3 localPosition = aPosition * aInstanceScale;
  vec4 worldPosition = uModelViewMatrix * vec4(localPosition + aInstancePosition, 1.0);

  vNormal = normalize(uNormalMatrix * aNormal);
  vColor = aInstanceColor;
  gl_Position = uProjectionMatrix * worldPosition;
}
`;

export const CUBE_FRAGMENT_SHADER = `#version 300 es
precision highp float;

in vec3 vNormal;
in vec4 vColor;

out vec4 outColor;

void main() {
  vec3 normal = normalize(vNormal);
  vec3 lightDir = normalize(vec3(-0.35, 0.45, -1.0));
  float diffuse = max(dot(normal, -lightDir), 0.0);
  float ambient = 0.42;
  float light = ambient + diffuse * 0.72;

  outColor = vec4(vColor.rgb * light, vColor.a);
}
`;
