import { BLOCK_DCT_COEFFS, PictureCodingType } from "./constants.mts";
import BitReader from "./reader.mts";

const bool = (value: number): boolean => {
  return value !== 0;
}
const array = (length: number, bits: number, reader: BitReader): number[] => {
  const result: number[] = [];
  for (let i = 0; i < length; i++) {
    result.push(reader.read(bits));
  }
  return result;
}

export const StartCode = {
  PictureStartCode: 0x00,
  MinSliceStartCode: 0x01,
  MaxSliceStartCode: 0xAF,
  UserDataStartCode: 0xB2,
  SequenceHeaderCode: 0xB3,
  SequenceErrorCode: 0xB4,
  ExtensionStartCode: 0xB5,
  SequenceEndCode: 0xB7,
  GroupStartCode: 0xB8
} as const;

export const ExtensionStartCodeIdentifier = {
  SequenceExtensionID: 0b0001,
  SequenceDisplayExtensionID: 0b0010,
  QuantMatrixExtensionID: 0b0011,
  CopyrightExtensionID: 0b0100,
  SequenceScalableExtensionID: 0b0101,
  PictureDisplayExtensionID: 0b0111,
  PictureCodingExtensionID: 0b1000,
  PictureSpatialScalableExtensionID: 0b1001,
  PictureTemporalScalableExtensionID: 0b1010
} as const;


export type MacroBlockParametersFlags = {
  macroblock_quant: boolean;
  macroblock_motion_forward: boolean;
  macroblock_motion_backward: boolean;
  macroblock_pattern: boolean;
  macroblock_intra: boolean;
  spatial_temporal_weight_code_flag: boolean;
  permitted_spatial_temporal_weight_classes: boolean;
};

export const macroblockParams: MacroBlockParametersFlags[][] = [
  [],
  // I
  [
    {
      macroblock_quant: false,
      macroblock_motion_forward: false,
      macroblock_motion_backward: false,
      macroblock_pattern: false,
      macroblock_intra: true,
      spatial_temporal_weight_code_flag: false,
      permitted_spatial_temporal_weight_classes: false
    },
    {
      macroblock_quant: true,
      macroblock_motion_forward: false,
      macroblock_motion_backward: false,
      macroblock_pattern: false,
      macroblock_intra: true,
      spatial_temporal_weight_code_flag: false,
      permitted_spatial_temporal_weight_classes: false
    }
  ],
  // P
  [

  ],
  // B
  [

  ],
  [],
  [],
] as const;

export const zigzagOrder = [
  [  0,  1,  5,  6, 14, 15, 27, 28],
  [  2,  4,  7, 13, 16, 26, 29, 42],
  [  3,  8, 12, 17, 25, 30, 41, 43],
  [  9, 11, 18, 24, 31, 40, 44, 53],
  [ 10, 19, 23, 32, 39, 45, 52, 54],
  [ 20, 22, 33, 38, 46, 51, 55, 60],
  [ 21, 34, 37, 47, 50, 56, 59, 61],
  [ 35, 36, 48, 49, 57, 58, 62, 63],
] as const;
export const alternateOrder = [
  [  0,  4,  6, 20, 22, 36, 38, 52],
  [  1,  5,  7, 21, 23, 37, 39, 53],
  [  2,  8, 19, 24, 34, 40, 50, 54],
  [  3,  9, 18, 25, 35, 41, 51, 55],
  [ 10, 17, 26, 30, 42, 46, 56, 60],
  [ 11, 16, 27, 31, 43, 47, 57, 61],
  [ 12, 15, 28, 32, 44, 48, 58, 62],
  [ 13, 14, 29, 33, 45, 49, 59, 63],
] as const;

const default_intra_quantiser_matrix = [
   8, 16, 19, 22, 26, 27, 29, 34,
  16, 16, 22, 24, 27, 29, 34, 37,
  19, 22, 26, 27, 29, 34, 34, 38,
  22, 22, 26, 27, 29, 34, 37, 40,
  22, 26, 27, 29, 32, 35, 40, 48,
  26, 27, 29, 32, 35, 40, 48, 58,
  26, 27, 29, 34, 38, 46, 56, 69,
  27, 29, 35, 38, 46, 56, 69, 83,
] as const;

const default_non_intra_quantiser_matrix = [
  16, 16, 16, 16, 16, 16, 16, 16,
  16, 16, 16, 16, 16, 16, 16, 16,
  16, 16, 16, 16, 16, 16, 16, 16,
  16, 16, 16, 16, 16, 16, 16, 16,
  16, 16, 16, 16, 16, 16, 16, 16,
  16, 16, 16, 16, 16, 16, 16, 16,
  16, 16, 16, 16, 16, 16, 16, 16,
  16, 16, 16, 16, 16, 16, 16, 16,
] as const;

export const q_scale = [
  [0,2,4,6,8,10,12,14,16,18,20,22,24,26,28,30,32,34,36,38,40,42,44,46,48,50,52,54,56,58,60,62],
  [0,1,2,3,4,5,6,7,8,10,12,14,16,18,20,22,24,28,32,36,40,44,48,52,56,64,72,80,88,96,104,112],
] as const;

export const skipUntilStartCode = (reader: BitReader): boolean => {
  reader.skipUntilAligned();
  while (!reader.empty()) {
    const start_code = reader.peek(24);
    if (start_code === 0x000001) {
      reader.skip(24);
      return true;
    }
    reader.skip(8);
  }
  return false;
}

export type SequenceHeader = {
  horizontal_size_value: number,
  vertical_size_value: number,
  aspect_ratio_information: number,
  frame_rate_code: number,
  bit_rate_value: number,
  vbv_buffer_size_value: number,
  constrained_parameters_flag: boolean,
  intra_quantiser_matrix: readonly number[],
  non_intra_quantiser_matrix: readonly number[]
};
export const SequenceHeader = {
  from(reader: BitReader): SequenceHeader {
    const horizontal_size_value = reader.read(12);
    const vertical_size_value = reader.read(12);
    const aspect_ratio_information = reader.read(4);
    const frame_rate_code = reader.read(4);
    const bit_rate_value = reader.read(18);
    reader.skip(1); // marker_bit
    const vbv_buffer_size_value = reader.read(10);
    const constrained_parameters_flag = bool(reader.read(1));
    const load_intra_quantiser_matrix = bool(reader.read(1));
    const intra_quantiser_matrix = load_intra_quantiser_matrix ? array(BLOCK_DCT_COEFFS, 8, reader) : default_intra_quantiser_matrix
    const load_non_intra_quantiser_matrix = bool(reader.read(1));
    const non_intra_quantiser_matrix = load_non_intra_quantiser_matrix ? array(BLOCK_DCT_COEFFS, 8, reader) : default_non_intra_quantiser_matrix;

    return {
      horizontal_size_value,
      vertical_size_value,
      aspect_ratio_information,
      frame_rate_code,
      bit_rate_value,
      vbv_buffer_size_value,
      constrained_parameters_flag,
      intra_quantiser_matrix,
      non_intra_quantiser_matrix
    };
  }
};

export type UserData = {
  user_data: number[]
};
export const UserData = {
  async from(reader: BitReader): Promise<UserData> {
    const user_data: number[] = [];
    while ((reader.peek(24)) !== 0x000001) {
      user_data.push(reader.read(8));
    }

    return {
      user_data
    };
  }
};

export type SequenceExtension = {
  profile_and_level_indication: number,
  progressive_sequence: boolean,
  chroma_format: number,
  horizontal_size_extension: number,
  vertical_size_extension: number,
  bit_rate_extension: number,
  vbv_buffer_size_extension: number,
  low_delay: boolean,
  frame_rate_extension_n: number,
  frame_rate_extension_d: number
};
export const SequenceExtension = {
  from(reader: BitReader): SequenceExtension {
    const profile_and_level_indication = reader.read(8);
    const progressive_sequence = bool(reader.read(1));
    const chroma_format = reader.read(2);
    const horizontal_size_extension = reader.read(2);
    const vertical_size_extension = reader.read(2);
    const bit_rate_extension = reader.read(2);
    reader.read(1); // marker_bit
    const vbv_buffer_size_extension = reader.read(8);
    const low_delay = bool(reader.read(1));
    const frame_rate_extension_n = reader.read(2);
    const frame_rate_extension_d = reader.read(5);

    return {
      profile_and_level_indication,
      progressive_sequence,
      chroma_format,
      horizontal_size_extension,
      vertical_size_extension,
      bit_rate_extension,
      vbv_buffer_size_extension,
      low_delay,
      frame_rate_extension_n,
      frame_rate_extension_d
    };
  }
};

export type SequenceDisplayExtension = {
  video_format: number,
} & ({
  colour_description: false,
} | {
  colour_description: true,
  colour_primaries: number,
  transfer_characteristics: number,
  matrix_coefficients: number,
}) & {
  display_horizontal_size: number,
  display_vertical_size: number,
};
export const SequenceDisplayExtension = {
  from(reader: BitReader): SequenceDisplayExtension {
    const video_format = reader.read(3);
    const colour_description = bool(reader.read(1));
    const colour = colour_description ? {
      colour_description,
      colour_primaries: reader.read(8),
      transfer_characteristics: reader.read(8),
      matrix_coefficients: reader.read(8),
    } : { colour_description };
    const display_horizontal_size = reader.read(14);
    reader.skip(1); // marker_bit
    const display_vertical_size = reader.read(14);

    return {
      video_format,
      ... colour,
      display_horizontal_size,
      display_vertical_size,
    }
  }
};

export type GroupOfPicturesHeader = {
  time_code: number,
  closed_gop: boolean,
  broken_link: boolean,
};
export const GroupOfPicturesHeader = {
  from(reader: BitReader): GroupOfPicturesHeader {
    const time_code = reader.read(25);
    const closed_gop = bool(reader.read(1));
    const broken_link = bool(reader.read(1));

    return {
      time_code,
      closed_gop,
      broken_link,
    }
  }
};
