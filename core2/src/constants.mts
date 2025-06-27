export const BLOCK_COL = 8;
export const BLOCK_ROW = 8;
export const BLOCK_SIZE = BLOCK_COL * BLOCK_ROW;
export const BLOCK_DCT_COEFFS = BLOCK_SIZE;

export const PictureCodingType = {
  I: 0b001,
  P: 0b010,
  B: 0b011
} as const;

export const ChromaFormat = {
  YUV420: 0b01,
  YUV422: 0b10,
  YUV444: 0b11,
} as const;
