export const BLOCK_COL = 8;
export const BLOCK_ROW = 8;
export const BLOCK_SIZE = BLOCK_COL * BLOCK_ROW;
export const BLOCK_DCT_COEFFS = BLOCK_SIZE;

export const xy = (x: number, y: number): number => {
  return y * BLOCK_ROW + x;
}

export class UnsupportedError extends Error {
  constructor(message: string, option?: ErrorOptions) {
    super(message, option);
    this.name = this.constructor.name;
  }
}

export const PictureCodingType = {
  I: 0b001,
  P: 0b010,
  B: 0b011,
} as const;
export const supportedPictureCodingType = (code: number): (typeof PictureCodingType)[keyof typeof PictureCodingType] => {
  switch (code) {
    case PictureCodingType.I: return code;
    case PictureCodingType.P: return code;
    case PictureCodingType.B: return code;
    default: throw new UnsupportedError(`Unsupported PictureCodingType: ${code}`);
  }
}

export const ChromaFormat = {
  YUV420: 0b01,
  YUV422: 0b10,
  YUV444: 0b11,
} as const;
export const supportedChromaFormat = (format: number): (typeof ChromaFormat)[keyof typeof ChromaFormat] => {
  switch (format) {
    case ChromaFormat.YUV420: return format;
    case ChromaFormat.YUV422: return format;
    case ChromaFormat.YUV444: return format;
    default: throw new UnsupportedError(`Unsupported ChromaFormat: ${format}`);
  }
}

export const YUVFormatType = {
  Y: 0,
  U: 1,
  V: 2,
} as const;

export const PictureStructure = {
  TopField: 0b01,
  BottomField: 0b10,
  FramePicture: 0b11,
} as const;
export const supportedPictureStructure = (structure: number): (typeof PictureStructure)[keyof typeof PictureStructure] => {
  switch (structure) {
    case PictureStructure.TopField: return structure;
    case PictureStructure.BottomField: return structure;
    case PictureStructure.FramePicture: return structure;
    default: throw new UnsupportedError(`Unsupported PictureStructure: ${structure}`);
  }
}
