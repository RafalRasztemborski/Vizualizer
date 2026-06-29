import type p5 from 'p5';
import type { BoxColor } from '../types';
import { CubeMesh } from './CubeMesh';
import { INSTANCE_FLOATS, InstanceBuffer } from './InstanceBuffer';
import {
  CUBE_FRAGMENT_SHADER,
  CUBE_VERTEX_SHADER,
} from './shaders/cubeShaders';

type AttributeLocations = {
  position: number;
  normal: number;
  instancePosition: number;
  instanceScale: number;
  instanceColor: number;
  instanceEdgeAlpha: number;
};

export class InstancedRenderer {
  private readonly gl: WebGL2RenderingContext;
  private readonly mesh: CubeMesh;
  private readonly instances = new InstanceBuffer();
  private readonly program: WebGLProgram;
  private readonly vao: WebGLVertexArrayObject;
  private readonly instanceBuffer: WebGLBuffer;
  private readonly modelViewMatrix = new Float32Array(16);
  private readonly attributes: AttributeLocations;
  private readonly uniforms: {
    projectionMatrix: WebGLUniformLocation;
    modelViewMatrix: WebGLUniformLocation;
    edgeWeightPx: WebGLUniformLocation;
  };

  constructor(gl: WebGL2RenderingContext) {
    this.gl = gl;
    this.mesh = new CubeMesh(gl);
    this.program = createProgram(gl, CUBE_VERTEX_SHADER, CUBE_FRAGMENT_SHADER);
    this.attributes = {
      position: gl.getAttribLocation(this.program, 'aPosition'),
      normal: gl.getAttribLocation(this.program, 'aNormal'),
      instancePosition: gl.getAttribLocation(this.program, 'aInstancePosition'),
      instanceScale: gl.getAttribLocation(this.program, 'aInstanceScale'),
      instanceColor: gl.getAttribLocation(this.program, 'aInstanceColor'),
      instanceEdgeAlpha: gl.getAttribLocation(this.program, 'aInstanceEdgeAlpha'),
    };
    this.uniforms = {
      projectionMatrix: requireUniform(gl, this.program, 'uProjectionMatrix'),
      modelViewMatrix: requireUniform(gl, this.program, 'uModelViewMatrix'),
      edgeWeightPx: requireUniform(gl, this.program, 'uEdgeWeightPx'),
    };

    const vao = gl.createVertexArray();
    const instanceBuffer = gl.createBuffer();
    if (!vao || !instanceBuffer) {
      throw new Error('Could not allocate instanced cube renderer buffers.');
    }

    this.vao = vao;
    this.instanceBuffer = instanceBuffer;
    this.configureVertexArray();
  }

  beginFrame() {
    this.instances.reset();
  }

  addInstance(
    x: number,
    y: number,
    z: number,
    sx: number,
    sy: number,
    sz: number,
    color: BoxColor,
  ) {
    this.instances.add(x, y, z, sx, sy, sz, color);
  }

  endFrame(p: p5, edgeWeightPx: number) {
    if (this.instances.count <= 0) return;

    const matrices = getP5Matrices(p, this.modelViewMatrix);
    const gl = this.gl;
    const previousProgram = gl.getParameter(gl.CURRENT_PROGRAM) as WebGLProgram | null;
    const previousVertexArray = gl.getParameter(gl.VERTEX_ARRAY_BINDING) as WebGLVertexArrayObject | null;
    const previousArrayBuffer = gl.getParameter(gl.ARRAY_BUFFER_BINDING) as WebGLBuffer | null;
    const previousElementArrayBuffer = gl.getParameter(gl.ELEMENT_ARRAY_BUFFER_BINDING) as WebGLBuffer | null;

    gl.useProgram(this.program);
    gl.bindVertexArray(this.vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.instanceBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, this.instances.floatData, gl.DYNAMIC_DRAW);

    gl.uniformMatrix4fv(this.uniforms.projectionMatrix, false, matrices.projection);
    gl.uniformMatrix4fv(this.uniforms.modelViewMatrix, false, matrices.modelView);
    gl.uniform1f(this.uniforms.edgeWeightPx, Math.max(0, edgeWeightPx));

    gl.enable(gl.DEPTH_TEST);
    gl.drawElementsInstanced(
      gl.TRIANGLES,
      this.mesh.indexCount,
      gl.UNSIGNED_SHORT,
      0,
      this.instances.count,
    );

    gl.bindVertexArray(previousVertexArray);
    gl.bindBuffer(gl.ARRAY_BUFFER, previousArrayBuffer);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, previousElementArrayBuffer);
    gl.useProgram(previousProgram);
  }

  dispose() {
    const gl = this.gl;
    this.mesh.dispose();
    gl.deleteBuffer(this.instanceBuffer);
    gl.deleteVertexArray(this.vao);
    gl.deleteProgram(this.program);
  }

  private configureVertexArray() {
    const gl = this.gl;
    const stride = INSTANCE_FLOATS * Float32Array.BYTES_PER_ELEMENT;

    gl.bindVertexArray(this.vao);

    gl.bindBuffer(gl.ARRAY_BUFFER, this.mesh.vertexBuffer);
    gl.enableVertexAttribArray(this.attributes.position);
    gl.vertexAttribPointer(
      this.attributes.position,
      3,
      gl.FLOAT,
      false,
      6 * Float32Array.BYTES_PER_ELEMENT,
      0,
    );
    gl.enableVertexAttribArray(this.attributes.normal);
    gl.vertexAttribPointer(
      this.attributes.normal,
      3,
      gl.FLOAT,
      false,
      6 * Float32Array.BYTES_PER_ELEMENT,
      3 * Float32Array.BYTES_PER_ELEMENT,
    );

    gl.bindBuffer(gl.ARRAY_BUFFER, this.instanceBuffer);
    configureInstanceAttribute(gl, this.attributes.instancePosition, 3, stride, 0);
    configureInstanceAttribute(
      gl,
      this.attributes.instanceScale,
      3,
      stride,
      3 * Float32Array.BYTES_PER_ELEMENT,
    );
    configureInstanceAttribute(
      gl,
      this.attributes.instanceColor,
      4,
      stride,
      6 * Float32Array.BYTES_PER_ELEMENT,
    );
    configureInstanceAttribute(
      gl,
      this.attributes.instanceEdgeAlpha,
      1,
      stride,
      10 * Float32Array.BYTES_PER_ELEMENT,
    );

    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.mesh.indexBuffer);
    gl.bindVertexArray(null);
    gl.bindBuffer(gl.ARRAY_BUFFER, null);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);
  }
}

function configureInstanceAttribute(
  gl: WebGL2RenderingContext,
  location: number,
  size: number,
  stride: number,
  offset: number,
) {
  if (location < 0) {
    throw new Error('Instanced cube shader attribute was optimized away.');
  }

  gl.enableVertexAttribArray(location);
  gl.vertexAttribPointer(location, size, gl.FLOAT, false, stride, offset);
  gl.vertexAttribDivisor(location, 1);
}

function createProgram(
  gl: WebGL2RenderingContext,
  vertexSource: string,
  fragmentSource: string,
) {
  const vertexShader = compileShader(gl, gl.VERTEX_SHADER, vertexSource);
  const fragmentShader = compileShader(gl, gl.FRAGMENT_SHADER, fragmentSource);
  const program = gl.createProgram();
  if (!program) throw new Error('Could not create instanced cube shader program.');

  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);
  gl.deleteShader(vertexShader);
  gl.deleteShader(fragmentShader);

  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const info = gl.getProgramInfoLog(program) || 'Unknown program link error.';
    gl.deleteProgram(program);
    throw new Error(info);
  }

  return program;
}

function compileShader(
  gl: WebGL2RenderingContext,
  type: number,
  source: string,
) {
  const shader = gl.createShader(type);
  if (!shader) throw new Error('Could not create instanced cube shader.');

  gl.shaderSource(shader, source);
  gl.compileShader(shader);

  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const info = gl.getShaderInfoLog(shader) || 'Unknown shader compile error.';
    gl.deleteShader(shader);
    throw new Error(info);
  }

  return shader;
}

function requireUniform(
  gl: WebGL2RenderingContext,
  program: WebGLProgram,
  name: string,
) {
  const location = gl.getUniformLocation(program, name);
  if (!location) throw new Error(`Missing shader uniform: ${name}`);
  return location;
}

function getP5Matrices(
  p: p5,
  modelViewOut: Float32Array,
) {
  const renderer = (p as any)._renderer;
  const model = matrixData(renderer?.uModelMatrix);
  const view = matrixData(renderer?.uViewMatrix);
  const projection = matrixData(renderer?.uPMatrix);
  multiplyP5Matrices(modelViewOut, model, view);

  return { projection, modelView: modelViewOut };
}

function matrixData(matrix: unknown) {
  const value = matrix as { mat4?: Float32Array; mat3?: Float32Array } | undefined;
  if (value?.mat4) return value.mat4;
  throw new Error('Could not read p5 WEBGL matrix state.');
}

function multiplyP5Matrices(
  out: Float32Array,
  left: Float32Array,
  right: Float32Array,
) {
  let b0 = left[0];
  let b1 = left[1];
  let b2 = left[2];
  let b3 = left[3];
  out[0] = b0 * right[0] + b1 * right[4] + b2 * right[8] + b3 * right[12];
  out[1] = b0 * right[1] + b1 * right[5] + b2 * right[9] + b3 * right[13];
  out[2] = b0 * right[2] + b1 * right[6] + b2 * right[10] + b3 * right[14];
  out[3] = b0 * right[3] + b1 * right[7] + b2 * right[11] + b3 * right[15];

  b0 = left[4];
  b1 = left[5];
  b2 = left[6];
  b3 = left[7];
  out[4] = b0 * right[0] + b1 * right[4] + b2 * right[8] + b3 * right[12];
  out[5] = b0 * right[1] + b1 * right[5] + b2 * right[9] + b3 * right[13];
  out[6] = b0 * right[2] + b1 * right[6] + b2 * right[10] + b3 * right[14];
  out[7] = b0 * right[3] + b1 * right[7] + b2 * right[11] + b3 * right[15];

  b0 = left[8];
  b1 = left[9];
  b2 = left[10];
  b3 = left[11];
  out[8] = b0 * right[0] + b1 * right[4] + b2 * right[8] + b3 * right[12];
  out[9] = b0 * right[1] + b1 * right[5] + b2 * right[9] + b3 * right[13];
  out[10] = b0 * right[2] + b1 * right[6] + b2 * right[10] + b3 * right[14];
  out[11] = b0 * right[3] + b1 * right[7] + b2 * right[11] + b3 * right[15];

  b0 = left[12];
  b1 = left[13];
  b2 = left[14];
  b3 = left[15];
  out[12] = b0 * right[0] + b1 * right[4] + b2 * right[8] + b3 * right[12];
  out[13] = b0 * right[1] + b1 * right[5] + b2 * right[9] + b3 * right[13];
  out[14] = b0 * right[2] + b1 * right[6] + b2 * right[10] + b3 * right[14];
  out[15] = b0 * right[3] + b1 * right[7] + b2 * right[11] + b3 * right[15];
}
