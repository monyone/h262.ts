import { BLOCK_DCT_COEFFS, ChromaFormat, PictureCodingType, PictureStructure, supportedChromaFormat, supportedPictureCodingType, supportedPictureStructure } from "./constants.mts";
import BitReader, { bool, array } from "./reader.mts";

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

export const ExtensionStartCode = {
  SequenceExtension: 0b0001,
  SequenceDisplayExtension: 0b0010,
  QuantMatrixExtension: 0b0011,
  CopyrightExtension: 0b0100,
  SequenceScalableExtension: 0b0101,
  PictureDisplayExtension: 0b0111,
  PictureCodingExtension: 0b1000,
  PictureSpatialScalableExtension: 0b1001,
  PictureTemporalScalableExtension: 0b1010
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
    {
      macroblock_quant: false,
      macroblock_motion_forward: true,
      macroblock_motion_backward: false,
      macroblock_pattern: true,
      macroblock_intra: false,
      spatial_temporal_weight_code_flag: false,
      permitted_spatial_temporal_weight_classes: false
    },
    {
      macroblock_quant: false,
      macroblock_motion_forward: false,
      macroblock_motion_backward: false,
      macroblock_pattern: true,
      macroblock_intra: false,
      spatial_temporal_weight_code_flag: false,
      permitted_spatial_temporal_weight_classes: false
    },
    {
      macroblock_quant: false,
      macroblock_motion_forward: true,
      macroblock_motion_backward: false,
      macroblock_pattern: false,
      macroblock_intra: false,
      spatial_temporal_weight_code_flag: false,
      permitted_spatial_temporal_weight_classes: false
    },
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
      macroblock_motion_forward: true,
      macroblock_motion_backward: false,
      macroblock_pattern: true,
      macroblock_intra: false,
      spatial_temporal_weight_code_flag: false,
      permitted_spatial_temporal_weight_classes: false
    },
    {
      macroblock_quant: true,
      macroblock_motion_forward: false,
      macroblock_motion_backward: false,
      macroblock_pattern: true,
      macroblock_intra: false,
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
    },
  ],
  // B
  [
    {
      macroblock_quant: false,
      macroblock_motion_forward: true,
      macroblock_motion_backward: true,
      macroblock_pattern: false,
      macroblock_intra: false,
      spatial_temporal_weight_code_flag: false,
      permitted_spatial_temporal_weight_classes: false
    },
    {
      macroblock_quant: false,
      macroblock_motion_forward: true,
      macroblock_motion_backward: true,
      macroblock_pattern: true,
      macroblock_intra: false,
      spatial_temporal_weight_code_flag: false,
      permitted_spatial_temporal_weight_classes: false
    },
    {
      macroblock_quant: false,
      macroblock_motion_forward: false,
      macroblock_motion_backward: true,
      macroblock_pattern: false,
      macroblock_intra: false,
      spatial_temporal_weight_code_flag: false,
      permitted_spatial_temporal_weight_classes: false
    },
    {
      macroblock_quant: false,
      macroblock_motion_forward: false,
      macroblock_motion_backward: true,
      macroblock_pattern: true,
      macroblock_intra: false,
      spatial_temporal_weight_code_flag: false,
      permitted_spatial_temporal_weight_classes: false
    },
    {
      macroblock_quant: false,
      macroblock_motion_forward: true,
      macroblock_motion_backward: false,
      macroblock_pattern: false,
      macroblock_intra: false,
      spatial_temporal_weight_code_flag: false,
      permitted_spatial_temporal_weight_classes: false
    },
    {
      macroblock_quant: false,
      macroblock_motion_forward: true,
      macroblock_motion_backward: false,
      macroblock_pattern: true,
      macroblock_intra: false,
      spatial_temporal_weight_code_flag: false,
      permitted_spatial_temporal_weight_classes: false
    },
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
      macroblock_motion_forward: true,
      macroblock_motion_backward: true,
      macroblock_pattern: true,
      macroblock_intra: false,
      spatial_temporal_weight_code_flag: false,
      permitted_spatial_temporal_weight_classes: false
    },
    {
      macroblock_quant: true,
      macroblock_motion_forward: true,
      macroblock_motion_backward: false,
      macroblock_pattern: true,
      macroblock_intra: false,
      spatial_temporal_weight_code_flag: false,
      permitted_spatial_temporal_weight_classes: false
    },
    {
      macroblock_quant: true,
      macroblock_motion_forward: false,
      macroblock_motion_backward: true,
      macroblock_pattern: true,
      macroblock_intra: false,
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
    },
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
  try {
    while (!reader.empty()) {
      const start_code = reader.peek(24);
      if (start_code === 0x000001) {
        reader.skip(24);
        return true;
      }
      reader.skip(8);
    }
  } catch {}
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
  from(reader: BitReader): UserData {
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
  chroma_format: (typeof ChromaFormat)[keyof typeof ChromaFormat],
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
    const chroma_format = supportedChromaFormat(reader.read(2));
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

export const ScalableMode = {
  DATA_PARTITIONING: 0b00,
  SPATIAL_SCALABILITY: 0b01,
  SNR_SCALABILITY: 0b10,
  TEMPORAL_SCALABILITY: 0b11,
} as const;
export type SequenceScalableExtension = {
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
export const SequenceScalableExtension = {
  from(reader: BitReader): SequenceScalableExtension {
    const scalable_mode = reader.read(2) as (typeof ScalableMode)[keyof typeof ScalableMode];
    const layer_id = reader.read(4);

    switch (scalable_mode) {
      case ScalableMode.DATA_PARTITIONING: {
        return {
          scalable_mode,
          layer_id,
        };
      }
      case ScalableMode.SPATIAL_SCALABILITY: {
        const lower_layer_prediction_horizontal_size = reader.read(14);
        reader.skip(1); // marker_bit
        const lower_layer_prediction_vertical_size = reader.read(14);
        const horizontal_subsampling_factor_m = reader.read(5);
        const horizontal_subsampling_factor_n = reader.read(5);
        const vertical_subsampling_factor_m = reader.read(5);
        const vertical_subsampling_factor_n = reader.read(5);

        return {
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
          scalable_mode,
          layer_id,
        };
      }
      case ScalableMode.TEMPORAL_SCALABILITY: {
        const picture_mux_enable = bool(reader.read(1));
        if (picture_mux_enable) {
          const mux_to_progressive_sequence = bool(reader.read(1));
          const picture_mux_order = reader.read(3);
          const picture_mux_factor = reader.read(3);

          return {
            scalable_mode,
            layer_id,
            picture_mux_enable,
            mux_to_progressive_sequence,
            picture_mux_order,
            picture_mux_factor
          };
        } else {
          const picture_mux_order = reader.read(3);
          const picture_mux_factor = reader.read(3);

          return {
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
};

export type PictureCodingExtension = {
  f_code_0_0: number,
  f_code_0_1: number,
  f_code_1_0: number,
  f_code_1_1: number,
  intra_dc_precision: number,
  picture_structure: (typeof PictureStructure)[keyof typeof PictureStructure],
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
});
export const PictureCodingExtension = {
  from(stream: BitReader): PictureCodingExtension {
    const f_code_0_0 = stream.read(4);
    const f_code_0_1 = stream.read(4);
    const f_code_1_0 = stream.read(4);
    const f_code_1_1 = stream.read(4);
    const intra_dc_precision = stream.read(2);
    const picture_structure = supportedPictureStructure(stream.read(2));
    const top_field_first = bool(stream.read(1));
    const frame_pred_frame_dct = bool(stream.read(1));
    const concealment_motion_vectors = bool(stream.read(1));
    const q_scale_type = stream.read(1);
    const intra_vlc_format = bool(stream.read(1));
    const alternate_scan = bool(stream.read(1));
    const repeat_first_field = bool(stream.read(1));
    const chroma_420_type = bool(stream.read(1));
    const progressive_frame = bool(stream.read(1));
    const composite_display_flag = bool(stream.read(1));
    if (!composite_display_flag) {
      return {
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

    const v_axis = bool(stream.read(1))
    const field_sequence = stream.read(3);
    const sub_carrier = bool(stream.read(1))
    const burst_amplitude = stream.read(7);
    const sub_carrier_phase = stream.read(8);
    return {
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
};

export type QuantMatrixExtension = {
  intra_quantiser_matrix: readonly number[],
  non_intra_quantiser_matrix: readonly number[],
  chroma_intra_quantiser_matrix: readonly number[],
  chroma_non_intra_quantiser_matrix: readonly number[],
};
export const QuantMatrixExtension = {
  from(reader: BitReader): QuantMatrixExtension {
    const load_intra_quantiser_matrix = bool(reader.read(1));
    const intra_quantiser_matrix = load_intra_quantiser_matrix ? array(BLOCK_DCT_COEFFS, 8, reader) : default_intra_quantiser_matrix
    const load_non_intra_quantiser_matrix = bool(reader.read(1));
    const non_intra_quantiser_matrix = load_non_intra_quantiser_matrix ? array(BLOCK_DCT_COEFFS, 8, reader) : default_non_intra_quantiser_matrix;
    const load_chroma_intra_quantiser_matrix = bool(reader.read(1));
    const chroma_intra_quantiser_matrix = load_chroma_intra_quantiser_matrix ? array(BLOCK_DCT_COEFFS, 8, reader) : default_intra_quantiser_matrix
    const load_chroma_non_intra_quantiser_matrix = bool(reader.read(1));
    const chroma_non_intra_quantiser_matrix = load_chroma_non_intra_quantiser_matrix ? array(BLOCK_DCT_COEFFS, 8, reader) : default_intra_quantiser_matrix

    return {
      intra_quantiser_matrix,
      non_intra_quantiser_matrix,
      chroma_intra_quantiser_matrix,
      chroma_non_intra_quantiser_matrix,
    };
  }
};

export type PictureDisplayExtension = {
  frame_centres: [frame_centre_horizontal_offset: number, frame_centre_vertical_offset: number][];
};
const number_of_frame_centre_offsets = (sequence_extension: SequenceExtension, picture_coding_extension: PictureCodingExtension): number => {
  if (sequence_extension.progressive_sequence) {
    if (picture_coding_extension.repeat_first_field) {
      if (picture_coding_extension.top_field_first) {
        return 3;
      } else {
        return 2;
      }
    } else {
      return 1;
    }
  } else if (picture_coding_extension.picture_structure === PictureStructure.TopField || picture_coding_extension.picture_structure === PictureStructure.BottomField) {
    return 1;
  } else if (picture_coding_extension.repeat_first_field) {
    return 3;
  } else {
    return 2;
  }
};
export const PictureDisplayExtension = {
  from(reader: BitReader, sequence_extension: SequenceExtension, picture_coding_extension: PictureCodingExtension): PictureDisplayExtension {
    const frame_centres: [number, number][] = Array.from({
      length: number_of_frame_centre_offsets(sequence_extension, picture_coding_extension)
    }, (_) => {
      const frame_centre_horizontal_offset = reader.read(16);
      reader.skip(1); // marker_bit
      const frame_centre_vertical_offset = reader.read(16);
      reader.skip(1); // marker_bit
      return [frame_centre_horizontal_offset, frame_centre_vertical_offset];
    });

    return {
      frame_centres
    };
  }
}

export type PictureTemporalScalableExtension = {
  reference_select_code: number;
  forward_temporal_reference: number;
  backward_temporal_reference: number;
};
export const PictureTemporalScalableExtension = {
  from(reader: BitReader): PictureTemporalScalableExtension {
    const reference_select_code = reader.read(2);
    const forward_temporal_reference = reader.read(10);
    reader.skip(1); // marker_bit
    const backward_temporal_reference = reader.read(10);

    return {
      reference_select_code,
      forward_temporal_reference,
      backward_temporal_reference,
    };
  }
};

export type PictureSpatialScalableExtension = {
  lower_layer_temporal_reference: number;
  lower_layer_horizontal_offset: number;
  lower_layer_vertical_offset: number;
  spatial_temporal_weight_code_table_index: number;
  lower_layer_progressive_frame: boolean;
  lower_layer_deinterlaced_field_select: boolean;
};
export const PictureSpatialScalableExtension = {
  from(reader: BitReader): PictureSpatialScalableExtension {
    const lower_layer_temporal_reference = reader.read(10);
    reader.skip(1); // marker_bit
    const lower_layer_horizontal_offset= reader.read(15);
    reader.skip(1); // marker_bit
    const lower_layer_vertical_offset = reader.read(15);
    const spatial_temporal_weight_code_table_index = reader.read(2);
    const lower_layer_progressive_frame = bool(reader.read(1));
    const lower_layer_deinterlaced_field_select = bool(reader.read(1));

    return {
      lower_layer_temporal_reference,
      lower_layer_horizontal_offset,
      lower_layer_vertical_offset,
      spatial_temporal_weight_code_table_index,
      lower_layer_progressive_frame,
      lower_layer_deinterlaced_field_select,
    };
  }
};

export type CopyrightExtension = {
  copyright_flag: boolean,
  copyright_identifier: number,
  original_or_copy: boolean,
  copyright_number_1: number,
  copyright_number_2: number,
  copyright_number_3: number,
};
export const CopyrightExtension = {
  from(reader: BitReader): CopyrightExtension {
    const copyright_flag = bool(reader.read(1));
    const copyright_identifier = reader.read(8);
    const original_or_copy = bool(reader.read(1));
    reader.skip(7); // reserved
    reader.skip(1); // marker_bit
    const copyright_number_1 = reader.read(20);
    reader.skip(1); // marker_bit
    const copyright_number_2 = reader.read(20);
    reader.skip(1); // marker_bit
    const copyright_number_3 = reader.read(20);

    return {
      copyright_flag,
      copyright_identifier,
      original_or_copy,
      copyright_number_1,
      copyright_number_2,
      copyright_number_3,
    };
  }
};

export type PictureHeader = {
  temporal_reference: number,
  vbv_delay: number,
} & ({
  picture_coding_type: (typeof PictureCodingType.I),
} | {
  picture_coding_type: (typeof PictureCodingType.P),
  full_pel_forward_vector: boolean,
  forward_f_code: number,
} | {
  picture_coding_type: (typeof PictureCodingType.B),
  full_pel_forward_vector: boolean,
  forward_f_code: number,
  full_pel_backward_vector: boolean,
  backward_f_code: number,
}) & {
  extra_information_picture: number[],
};
export const PictureHeader = {
  from(reader: BitReader): PictureHeader {
    const temporal_reference = reader.read(10);
    const picture_coding_type = supportedPictureCodingType(reader.read(3));
    const vbv_delay = reader.read(16);

    if (picture_coding_type === PictureCodingType.P) {
      const full_pel_forward_vector = bool(reader.read(1)); // H.262 is zero
      const forward_f_code = reader.read(3); // H.262 is 111
      const extra_information_picture: number[] = [];
      while (reader.peek(1) === 1) {
        reader.skip(1); // extra_bit_picture
        extra_information_picture.push(reader.read(8));
      }
      reader.skip(1); // extra_bit_picture

      return {
        temporal_reference,
        picture_coding_type,
        vbv_delay,
        full_pel_forward_vector,
        forward_f_code,
        extra_information_picture,
      };
    }
    if (picture_coding_type === PictureCodingType.B) {
      const full_pel_forward_vector = bool(reader.read(1)); // H.262 is zero
      const forward_f_code = reader.read(3); // H.262 is 111
      const full_pel_backward_vector = bool(reader.read(1)); // H.262 is zero
      const backward_f_code = reader.read(3); // H.262 is 111
      const extra_information_picture: number[] = [];
      while (reader.peek(1) === 1) {
        reader.skip(1); // extra_bit_picture
        extra_information_picture.push(reader.read(8));
      }
      reader.skip(1); // extra_bit_picture

      return {
        temporal_reference,
        picture_coding_type,
        vbv_delay,
        full_pel_forward_vector,
        forward_f_code,
        full_pel_backward_vector,
        backward_f_code,
        extra_information_picture,
      };
    }

    const extra_information_picture: number[] = [];
    while (reader.peek(1) === 1) {
      reader.skip(1); // extra_bit_picture
      extra_information_picture.push(reader.read(8));
    }
    reader.skip(1); // extra_bit_picture

    return {
      temporal_reference,
      picture_coding_type,
      vbv_delay,
      extra_information_picture,
    };
  }
};

export type GroupOfPicturesHeader = {
  drop_frame_flag: boolean,
  time_code_hours: number,
  time_code_minutes: number,
  time_code_seconds: number,
  time_code_pictures: number,
  closed_gop: boolean,
  broken_link: boolean,
};
export const GroupOfPicturesHeader = {
  from(reader: BitReader): GroupOfPicturesHeader {
    const drop_frame_flag = bool(reader.read(1));
    const time_code_hours = reader.read(5);
    const time_code_minutes = reader.read(6);
    reader.skip(1); // marker_bit
    const time_code_seconds = reader.read(6);
    const time_code_pictures = reader.read(6);
    const closed_gop = bool(reader.read(1));
    const broken_link = bool(reader.read(1));

    return {
      drop_frame_flag,
      time_code_hours,
      time_code_minutes,
      time_code_seconds,
      time_code_pictures,
      closed_gop,
      broken_link,
    }
  }
};

export type VideoSequenceExtensions = SequenceExtension | SequenceDisplayExtension | QuantMatrixExtension | SequenceScalableExtension | PictureDisplayExtension | PictureCodingExtension | PictureSpatialScalableExtension | PictureTemporalScalableExtension | CopyrightExtension;
export type VideoSequence = SequenceHeader | VideoSequenceExtensions | UserData | GroupOfPicturesHeader | PictureHeader;

export function* iterate(reader: BitReader): Iterable<VideoSequence> {
  while (!reader.empty()) {
    if (!skipUntilStartCode(reader)) { break; }

    const startcode = reader.read(8);
    console.log(startcode.toString(16));

    switch(startcode) {
      case StartCode.SequenceHeaderCode:
        yield SequenceHeader.from(reader);
        break;
      case StartCode.UserDataStartCode:
        yield UserData.from(reader);
        break;
      case StartCode.ExtensionStartCode: {
        const extension_start_code = reader.read(4);
        switch (extension_start_code) {
            case ExtensionStartCode.SequenceExtension: {
              yield SequenceExtension.from(reader);
              break;
            }
            case ExtensionStartCode.SequenceDisplayExtension: {
              yield SequenceDisplayExtension.from(reader);
              break;
            }
            case ExtensionStartCode.QuantMatrixExtension: {
              yield QuantMatrixExtension.from(reader);
              break;
            }
            case ExtensionStartCode.CopyrightExtension: {
              yield CopyrightExtension.from(reader);
              break;
            }
            case ExtensionStartCode.SequenceScalableExtension: {
              yield SequenceScalableExtension.from(reader);
              break;
            }
            case ExtensionStartCode.PictureDisplayExtension: {
              //yield PictureDisplayExtension.from(reader);
              break;
            }
            case ExtensionStartCode.PictureCodingExtension: {
              yield PictureCodingExtension.from(reader);
              break;
            }
            case ExtensionStartCode.PictureSpatialScalableExtension: {
              yield PictureSpatialScalableExtension.from(reader);
              break;
            }
            case ExtensionStartCode.PictureTemporalScalableExtension: {
              yield PictureTemporalScalableExtension.from(reader);
              break;
            }
            default:
              break;
        }
        break;
      }
      case StartCode.GroupStartCode:
        yield GroupOfPicturesHeader.from(reader);
        break;
      case StartCode.SequenceEndCode:
        break;
      case StartCode.PictureStartCode:
        yield PictureHeader.from(reader);
        break;
      default: {
        /*
        if (StartCode.MinSliceStartCode <= stream.peekUint32() && stream.peekUint32() <= StartCode.MaxSliceStartCode) {
          this.#slice(stream);
        }
        */
        break;
      }
    }
  }
}
