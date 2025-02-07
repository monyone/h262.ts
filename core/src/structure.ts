import BitStream from "./util/bitstream";
import { BLOCK_COL, BLOCK_DCT_COEFFS, BLOCK_ROW } from "./constant";
import idct from "./idct";
import { CODED_BLOCK_PATTERN_VLC, DCT_COEFFICIENTS_ZERO_DC_VLC, DCT_COEFFICIENTS_ZERO_OTHER_VLC, DCT_DC_SIZE_CHROMINANCE_VLC, DCT_DC_SIZE_LUMINANCE_VLC, MACROBLOCK_ADDRESS_INCREMENT_VLC, MACROBLOCK_TYPE_VLC } from "./vlc";

export const StartCode = {
  PictureStartCode: 0x100,
  MinSliceStartCode: 0x101,
  MaxSliceStartCode: 0x1AF,
  UserDataStartCode: 0x1B2,
  SequenceHeaderCode: 0x1B3,
  SequenceErrorCode: 0x1B4,
  ExtensionStartCode: 0x1B5,
  SequenceEndCode: 0x1B7,
  GroupStartCode: 0x1B8
} as const;

export const ExtentionIdentifier = {
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

export const PictureCodingType = {
  // 0b000 = PictureCodingType
  I: 0b001,
  P: 0b010,
  B: 0b011
  // 0b100 = Shall not be used
  // 0b101 = Reserved
  // 0b110 = Reserved
  // 0b110 = Reserved
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
  [

  ],
  [

  ],
  [],
  [],
];

export const zigzagOrder = [
  [  0,  1,  5,  6, 14, 15, 27, 28],
  [  2,  4,  7, 13, 16, 26, 29, 42],
  [  3,  8, 12, 17, 25, 30, 41, 43],
  [  9, 11, 18, 24, 31, 40, 44, 53],
  [ 10, 19, 23, 32, 39, 45, 52, 54],
  [ 20, 22, 33, 38, 46, 51, 55, 60],
  [ 21, 34, 37, 47, 50, 56, 59, 61],
  [ 35, 36, 48, 49, 57, 58, 62, 63],
];
export const alternateOrder = [
  [  0,  4,  6, 20, 22, 36, 38, 52],
  [  1,  5,  7, 21, 23, 37, 39, 53],
  [  2,  8, 19, 24, 34, 40, 50, 54],
  [  3,  9, 18, 25, 35, 41, 51, 55],
  [ 10, 17, 26, 30, 42, 46, 56, 60],
  [ 11, 16, 27, 31, 43, 47, 57, 61],
  [ 12, 15, 28, 32, 44, 48, 58, 62],
  [ 13, 14, 29, 33, 45, 49, 59, 63],
];

const default_intra_quantiser_matrix = [
   8, 16, 19, 22, 26, 27, 29, 34,
  16, 16, 22, 24, 27, 29, 34, 37,
  19, 22, 26, 27, 29, 34, 34, 38,
  22, 22, 26, 27, 29, 34, 37, 40,
  22, 26, 27, 29, 32, 35, 40, 48,
  26, 27, 29, 32, 35, 40, 48, 58,
  26, 27, 29, 34, 38, 46, 56, 69,
  27, 29, 35, 38, 46, 56, 69, 83,
];

const default_non_intra_quantiser_matrix = [
  16, 16, 16, 16, 16, 16, 16, 16,
  16, 16, 16, 16, 16, 16, 16, 16,
  16, 16, 16, 16, 16, 16, 16, 16,
  16, 16, 16, 16, 16, 16, 16, 16,
  16, 16, 16, 16, 16, 16, 16, 16,
  16, 16, 16, 16, 16, 16, 16, 16,
  16, 16, 16, 16, 16, 16, 16, 16,
  16, 16, 16, 16, 16, 16, 16, 16,
];

//*
export const q_scale = [
  [0,2,4,6,8,10,12,14,16,18,20,22,24,26,28,30,32,34,36,38,40,42,44,46,48,50,52,54,56,58,60,62],
  [0,1,2,3,4,5,6,7,8,10,12,14,16,18,20,22,24,28,32,36,40,44,48,52,56,64,72,80,88,96,104,112],
];

export const findNextStartCode = (stream: BitStream): boolean => {
  try {
    stream.skipUntilAligned();
    while (true) {
      const start_code = stream.peekUint24();
      if (start_code === 0x000001) { return true; }

      stream.skipUint8();
    }
  } catch (e: unknown) {
    return false;
  }
}

export type SequenceHeader = {
  sequence_header_code: typeof StartCode.SequenceHeaderCode,
  horizontal_size_value: number,
  vertical_size_value: number,
  aspect_ratio_information: number,
  frame_rate_code: number,
  bit_rate_value: number,
  vbv_buffer_size_value: number,
  constrained_parameters_flag: boolean,
  load_intra_quantiser_matrix: boolean,
  intra_quantiser_matrix: number[],
  load_non_intra_quantiser_matrix: boolean,
  non_intra_quantiser_matrix: number[]
};
export const parseSeqenceHeader = (stream: BitStream): SequenceHeader | null => {
  const sequence_header_code = stream.readUint32();
  if (sequence_header_code !== StartCode.SequenceHeaderCode) { return null; }
  const horizontal_size_value = stream.readBits(12);
  const vertical_size_value = stream.readBits(12);
  const aspect_ratio_information = stream.readBits(4);
  const frame_rate_code = stream.readBits(4);
  const bit_rate_value = stream.readBits(18);
  stream.readBool();
  const vbv_buffer_size_value = stream.readBits(10);
  const constrained_parameters_flag = stream.readBool();
  const load_intra_quantiser_matrix = stream.readBool();
  let intra_quantiser_matrix: number[] = default_intra_quantiser_matrix;
  if (load_intra_quantiser_matrix) {
    intra_quantiser_matrix = [];
    for (let i = 0; i < BLOCK_DCT_COEFFS; i++) {
      intra_quantiser_matrix.push(stream.readUint8());
    }
  }
  const load_non_intra_quantiser_matrix = stream.readBool();
  let non_intra_quantiser_matrix: number[] = default_non_intra_quantiser_matrix;
  if (load_non_intra_quantiser_matrix) {
    non_intra_quantiser_matrix = [];
    for (let i = 0; i < BLOCK_DCT_COEFFS; i++) {
      non_intra_quantiser_matrix.push(stream.readUint8());
    }
  }

  return {
    sequence_header_code,
    horizontal_size_value,
    vertical_size_value,
    aspect_ratio_information,
    frame_rate_code,
    bit_rate_value,
    vbv_buffer_size_value,
    constrained_parameters_flag,
    load_intra_quantiser_matrix,
    intra_quantiser_matrix,
    load_non_intra_quantiser_matrix,
    non_intra_quantiser_matrix
  }
};

export type UserData = {
  user_data_start_code: typeof StartCode.UserDataStartCode;
  user_data: number[]
};
export const parseUserData = (stream: BitStream): UserData | null => {
  const user_data_start_code = stream.readUint32();
  if (user_data_start_code !== StartCode.UserDataStartCode) { return null; }
  const user_data = [];
  while (stream.peekUint24() !== 1) {
    user_data.push(stream.readUint8());
  }

  return {
    user_data_start_code,
    user_data
  };
}

export type SequenceExtension = {
  extension_start_code_identifier: typeof ExtentionIdentifier.SequenceExtensionID,
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
}
export const parseSequenceExtension = (stream: BitStream): SequenceExtension | null => {
  const extension_start_code_identifier = stream.readBits(4);
  if (extension_start_code_identifier !== ExtentionIdentifier.SequenceExtensionID) { return null; }
  const profile_and_level_indication = stream.readUint8();
  const progressive_sequence = stream.readBool();
  const chroma_format = stream.readBits(2);
  const horizontal_size_extension = stream.readBits(2);
  const vertical_size_extension = stream.readBits(2);
  const bit_rate_extension = stream.readBits(2);
  stream.readBool();
  const vbv_buffer_size_extension = stream.readUint8();
  const low_delay = stream.readBool();
  const frame_rate_extension_n = stream.readBits(2);
  const frame_rate_extension_d = stream.readBits(5);

  return {
    extension_start_code_identifier,
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

export const ScalableMode = {
  DATA_PARTITIONING: 0b00,
  SPATIAL_SCALABILITY: 0b01,
  SNR_SCALABILITY: 0b10,
  TEMPORAL_SCALABILITY: 0b11,
} as const;
export type ScalableExtension = {
  extension_start_code_identifier: typeof ExtentionIdentifier.SequenceScalableExtensionID,
  layer_id: number,
} & ({
  scalable_mode: typeof ScalableMode.DATA_PARTITIONING,
} | {
  scalable_mode: typeof ScalableMode.SPATIAL_SCALABILITY
  lower_layer_prediction_horizontal_size: number,
  lower_layer_prediction_vertical_size: number,
  horizontal_subsampling_factor_m: number,
  horizontal_subsampling_factor_n: number,
  vertical_subsampling_factor_m: number,
  vertical_subsampling_factor_n: number,
} | {
  scalable_mode: typeof ScalableMode.SNR_SCALABILITY,
} | {
  scalable_mode: typeof ScalableMode.TEMPORAL_SCALABILITY,
  picture_mux_order: number,
  picture_mux_factor: number,
} & ({
  picture_mux_enable: true,
  mux_to_progressive_sequence: boolean,
} | {
  picture_mux_enable: false,
}));
export const parseScalableExtension = (stream: BitStream): ScalableExtension | null => {
  const extension_start_code_identifier = stream.readBits(4);
  if (extension_start_code_identifier !== ExtentionIdentifier.SequenceScalableExtensionID) { return null; }
  const scalable_mode = stream.readBits(2) as (typeof ScalableMode)[keyof typeof ScalableMode];
  const layer_id = stream.readBits(4);

  switch (scalable_mode) {
    case ScalableMode.DATA_PARTITIONING: {
      return {
        extension_start_code_identifier,
        scalable_mode,
        layer_id,
      };
    }
    case ScalableMode.SPATIAL_SCALABILITY: {
      const lower_layer_prediction_horizontal_size = stream.readBits(14);
      const _ = stream.readBool(); // marker_bit
      const lower_layer_prediction_vertical_size = stream.readBits(14);
      const horizontal_subsampling_factor_m = stream.readBits(5);
      const horizontal_subsampling_factor_n = stream.readBits(5);
      const vertical_subsampling_factor_m = stream.readBits(5);
      const vertical_subsampling_factor_n = stream.readBits(5);

      return {
        extension_start_code_identifier,
        scalable_mode,
        layer_id,
        lower_layer_prediction_horizontal_size,
        lower_layer_prediction_vertical_size,
        horizontal_subsampling_factor_m,
        horizontal_subsampling_factor_n,
        vertical_subsampling_factor_m,
        vertical_subsampling_factor_n
      };
    }
    case ScalableMode.SNR_SCALABILITY: {
      return {
        extension_start_code_identifier,
        scalable_mode,
        layer_id,
      };
    }
    case ScalableMode.TEMPORAL_SCALABILITY: {
      const picture_mux_enable = stream.readBool();
      if (picture_mux_enable) {
        const mux_to_progressive_sequence = stream.readBool();
        const picture_mux_order = stream.readBits(3);
        const picture_mux_factor = stream.readBits(3);

        return {
          extension_start_code_identifier,
          scalable_mode,
          layer_id,
          picture_mux_enable,
          mux_to_progressive_sequence,
          picture_mux_order,
          picture_mux_factor
        };
      } else {
        const picture_mux_order = stream.readBits(3);
        const picture_mux_factor = stream.readBits(3);

        return {
          extension_start_code_identifier,
          scalable_mode,
          layer_id,
          picture_mux_enable,
          picture_mux_order,
          picture_mux_factor
        };
      }
    }
  }
}

export type PictureCodingExtension = {
  extension_start_code_identifier: typeof ExtentionIdentifier.PictureCodingExtensionID,
  f_code_0_0: number,
  f_code_0_1: number,
  f_code_1_0: number,
  f_code_1_1: number,
  intra_dc_precision: number,
  picture_structure: number,
  top_field_first: boolean,
  frame_pred_frame_dct: boolean,
  concealment_motion_vectors: boolean,
  q_scale_type: number,
  intra_vlc_format: boolean,
  alternate_scan: boolean,
  repeat_first_field: boolean,
  chroma_420_type: boolean,
  progressive_frame: boolean,
} & ({
  composite_display_flag: false
} | {
  composite_display_flag: true,
  v_axis: boolean,
  field_sequence: number,
  sub_carrier: boolean
  burst_amplitude: number
  sub_carrier_phase: number;
})
export const parsePictureCodingExtension = (stream: BitStream): PictureCodingExtension | null => {
  const extension_start_code_identifier = stream.readBits(4);
  if (extension_start_code_identifier !== ExtentionIdentifier.PictureCodingExtensionID) { return null; }
  const f_code_0_0 = stream.readBits(4);
  const f_code_0_1 = stream.readBits(4);
  const f_code_1_0 = stream.readBits(4);
  const f_code_1_1 = stream.readBits(4);
  const intra_dc_precision = stream.readBits(2);
  const picture_structure = stream.readBits(2);
  const top_field_first = stream.readBool();
  const frame_pred_frame_dct = stream.readBool();
  const concealment_motion_vectors = stream.readBool();
  const q_scale_type = stream.readBits(1);
  const intra_vlc_format = stream.readBool();
  const alternate_scan = stream.readBool();
  const repeat_first_field = stream.readBool();
  const chroma_420_type = stream.readBool();
  const progressive_frame = stream.readBool();
  const composite_display_flag = stream.readBool();
  if (!composite_display_flag) {
    return {
      extension_start_code_identifier,
      f_code_0_0,
      f_code_0_1,
      f_code_1_0,
      f_code_1_1,
      intra_dc_precision,
      picture_structure,
      top_field_first,
      frame_pred_frame_dct,
      concealment_motion_vectors,
      q_scale_type,
      intra_vlc_format,
      alternate_scan,
      repeat_first_field,
      chroma_420_type,
      progressive_frame,
      composite_display_flag,
    }
  }

  const v_axis = stream.readBool();
  const field_sequence = stream.readBits(3);
  const sub_carrier = stream.readBool();
  const burst_amplitude = stream.readBits(7);
  const sub_carrier_phase = stream.readUint8();
  return {
    extension_start_code_identifier,
    f_code_0_0,
    f_code_0_1,
    f_code_1_0,
    f_code_1_1,
    intra_dc_precision,
    picture_structure,
    top_field_first,
    frame_pred_frame_dct,
    concealment_motion_vectors,
    q_scale_type,
    intra_vlc_format,
    alternate_scan,
    repeat_first_field,
    chroma_420_type,
    progressive_frame,
    composite_display_flag,
    v_axis,
    field_sequence,
    sub_carrier,
    burst_amplitude,
    sub_carrier_phase
  }
}

export const parseGroupOfPicturesHeader = (stream: BitStream) => {
  const group_start_code = stream.readUint32();
  if (group_start_code !== StartCode.GroupStartCode) { return null;}
  const timecode = stream.readBits(25);
  const closed_gop = stream.readBool();
  const broken_link = stream.readBool();

  return {
    group_start_code,
    timecode,
    closed_gop,
    broken_link
  };
}

export type PictureHeader = {
  picture_start_code: typeof StartCode.PictureStartCode,
  temporal_reference: number,
  picture_coding_type: number,
  vbv_delay: number,
  full_pel_backward_vector: boolean | null,
  forward_f_code: number | null,
  full_pel_forward_vector: boolean | null,
  backward_f_code: number | null,
  extra_information_picture: number[]
}
export const parsePictureHeader = (stream: BitStream): PictureHeader | null => {
  const picture_start_code = stream.readUint32();
  if (picture_start_code !== StartCode.PictureStartCode) { return null; }
  const temporal_reference = stream.readBits(10);
  const picture_coding_type = stream.readBits(3);
  const vbv_delay = stream.readUint16();
  let full_pel_forward_vector = null;
  let forward_f_code = null;
  if (picture_coding_type === PictureCodingType.P || picture_coding_type == PictureCodingType.B) {
    full_pel_forward_vector = stream.readBool(); // H.262 is zero
    forward_f_code = stream.readBits(3); // H.262 is 111
  }
  let full_pel_backward_vector = null;
  let backward_f_code = null;
  if (picture_coding_type === PictureCodingType.B) {
    full_pel_backward_vector = stream.readBool(); // H.262 is zero
    backward_f_code = stream.readBits(3); // H.262 is 111
  }
  const extra_information_picture: number[] = [];
  while (stream.peekBits(1) === 1) {
    const extra_bit_picture = stream.readBits(1);
    extra_information_picture.push(stream.readUint8());
  }
  stream.readBits(1); // always zero

  return {
    picture_start_code,
    temporal_reference,
    picture_coding_type,
    vbv_delay,
    full_pel_backward_vector,
    forward_f_code,
    full_pel_forward_vector,
    backward_f_code,
    extra_information_picture
  };
}
