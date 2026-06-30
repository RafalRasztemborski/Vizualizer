export class CubeMesh {
  readonly vertexBuffer: WebGLBuffer;
  readonly indexBuffer: WebGLBuffer;
  readonly indexCount: number;

  constructor(private readonly gl: WebGL2RenderingContext) {
    const vertexData = new Float32Array([
      // position        normal
      -0.5, -0.5, 0.5, 0, 0, 1,
      0.5, -0.5, 0.5, 0, 0, 1,
      0.5, 0.5, 0.5, 0, 0, 1,
      -0.5, 0.5, 0.5, 0, 0, 1,

      0.5, -0.5, -0.5, 0, 0, -1,
      -0.5, -0.5, -0.5, 0, 0, -1,
      -0.5, 0.5, -0.5, 0, 0, -1,
      0.5, 0.5, -0.5, 0, 0, -1,

      -0.5, -0.5, -0.5, -1, 0, 0,
      -0.5, -0.5, 0.5, -1, 0, 0,
      -0.5, 0.5, 0.5, -1, 0, 0,
      -0.5, 0.5, -0.5, -1, 0, 0,

      0.5, -0.5, 0.5, 1, 0, 0,
      0.5, -0.5, -0.5, 1, 0, 0,
      0.5, 0.5, -0.5, 1, 0, 0,
      0.5, 0.5, 0.5, 1, 0, 0,

      -0.5, 0.5, 0.5, 0, 1, 0,
      0.5, 0.5, 0.5, 0, 1, 0,
      0.5, 0.5, -0.5, 0, 1, 0,
      -0.5, 0.5, -0.5, 0, 1, 0,

      -0.5, -0.5, -0.5, 0, -1, 0,
      0.5, -0.5, -0.5, 0, -1, 0,
      0.5, -0.5, 0.5, 0, -1, 0,
      -0.5, -0.5, 0.5, 0, -1, 0,
    ]);

    const indices = new Uint16Array([
      0, 1, 2, 0, 2, 3,
      4, 5, 6, 4, 6, 7,
      8, 9, 10, 8, 10, 11,
      12, 13, 14, 12, 14, 15,
      16, 17, 18, 16, 18, 19,
      20, 21, 22, 20, 22, 23,
    ]);

    const vertexBuffer = gl.createBuffer();
    const indexBuffer = gl.createBuffer();
    if (!vertexBuffer || !indexBuffer) {
      throw new Error('Could not allocate cube mesh buffers.');
    }

    gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, vertexData, gl.STATIC_DRAW);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indices, gl.STATIC_DRAW);

    this.vertexBuffer = vertexBuffer;
    this.indexBuffer = indexBuffer;
    this.indexCount = indices.length;
  }

  dispose() {
    this.gl.deleteBuffer(this.vertexBuffer);
    this.gl.deleteBuffer(this.indexBuffer);
  }
}
