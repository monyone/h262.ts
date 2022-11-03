import BitStream from "./bitstream";
import { BLOCK_COL, BLOCK_DCT_COEFFS, BLOCK_ROW } from "./constant";
import idct from "./idct";
import { CODED_BLOCK_PATTERN_VLC, DCT_COEFFICIENTS_ZERO_DC_VLC, DCT_COEFFICIENTS_ZERO_OTHER_VLC, DCT_DC_SIZE_CHROMINANCE_VLC, DCT_DC_SIZE_LUMINANCE_VLC, MACROBLOCK_ADDRESS_INCREMENT_VLC, MACROBLOCK_TYPE_VLC } from "./vlc";

enum StartCode {
  PictureStartCode = 0x100,
  MinSliceStartCode = 0x101,
  MaxSliceStartCode = 0x1AF,
  UserDataStartCode = 0x1B2,
  SequenceHeaderCode = 0x1B3,
  SequenceErrorCode = 0x1B4,
  ExtensionStartCode = 0x1B5,
  SequenceEndCode = 0x1B7,
  GroupStartCode = 0x1B8
};

enum ExtentionIdentifier {
  SequenceExtensionID = 0b0001,
  SequenceDisplayExtensionID = 0b0010,
  QuantMatrixExtensionID = 0b0011,
  CopyrightExtensionID = 0b0100,
  SequenceScalableExtensionID = 0b0101,
  PictureDisplayExtensionID = 0b0111,
  PictureCodingExtensionID = 0b1000,
  PictureSpatialScalableExtensionID = 0b1001,
  PictureTemporalScalableExtensionID = 0b1010
};

enum PictureCodingType {
  // 0b000 = PictureCodingType
  I = 0b001,
  P = 0b010,
  B = 0b011
  // 0b100 = Shall not be used
  // 0b101 = Reserved
  // 0b110 = Reserved
  // 0b110 = Reserved
};

type MacroBlockParametersFlags = {
  macroblock_quant: boolean;
  macroblock_motion_forward: boolean;
  macroblock_motion_backward: boolean;
  macroblock_pattern: boolean;
  macroblock_intra: boolean;
  spatial_temporal_weight_code_flag: boolean;
  permitted_spatial_temporal_weight_classes: boolean;
};

const macroblock_params: MacroBlockParametersFlags[][] = [
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

const zigzag = [
  [  0,  1,  5,  6, 14, 15, 27, 28],
  [  2,  4,  7, 13, 16, 26, 29, 42],
  [  3,  8, 12, 17, 25, 30, 41, 43],
  [  9, 11, 18, 24, 31, 40, 44, 53],
  [ 10, 19, 23, 32, 39, 45, 52, 54],
  [ 20, 22, 33, 38, 46, 51, 55, 60],
  [ 21, 34, 37, 47, 50, 56, 59, 61],
  [ 35, 36, 48, 49, 57, 58, 62, 63],
];
const alternate = [
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
  27, 29, 35, 38, 46, 56 ,69, 83,
];
const default_non_intra_quantiser_matrix = [  // from sequence header
  16, 16, 16, 16, 16, 16, 16, 16,
  16, 16, 16, 16, 16, 16, 16, 16,
  16, 16, 16, 16, 16, 16, 16, 16,
  16, 16, 16, 16, 16, 16, 16, 16,
  16, 16, 16, 16, 16, 16, 16, 16,
  16, 16, 16, 16, 16, 16, 16, 16,
  16, 16, 16, 16, 16, 16, 16, 16,
  16, 16, 16, 16, 16, 16, 16, 16,
];

export default class H262Decoder {
  // Decode Needed Gata
  #picture_coding_type: number | null = null; // from picture header
  #chroma_format: number | null = null; // from sequence extension
  #picture_structure: number | null = null; // from picture coding extension
  #frame_pred_frame_dct: boolean | null = null; // from picture coding extension
  #concealment_motion_vectors: boolean | null = null; // from picture coding extension
  #scalable_mode: number | null = null; // from sequence scalable extension
  #intra_quantiser_matrix: number[] =  default_intra_quantiser_matrix;
  #non_intra_quantiser_matrix: number[] = default_non_intra_quantiser_matrix;
  #quantizer_scale: number | null = null; // from slice
  // Getter
  get #block_count() {
    if (this.#chroma_format == null) { return null; }
    switch(this.#chroma_format) {
      case 0: return null;
      case 1: return 6;
      case 2: return 8;
      case 3: return 12;
      default: return null;
    }
  }

  // Parser
  #next_start_code(stream: BitStream): boolean {
    try {
      stream.skipUntilAligned();

      let fst = stream.readUint8();
      let snd = stream.readUint8();
      let thd = stream.readUint8();
   
      while (true) {
        if (fst === 0 && snd === 0 && thd === 1) {
          stream.retainUint24(1);
          return true;
        }

        fst = snd;
        snd = thd;
        thd = stream.readUint8();
      }
    } catch (e: unknown) {
      return false;
    }
  }

  #sequence_header(stream: BitStream) {
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
  }

  #user_data(stream: BitStream) {
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

  #sequence_extension(stream: BitStream) {
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

  #sequence_scalable_extension(stream: BitStream) {
    const extension_start_code_identifier = stream.readBits(4);
    if (extension_start_code_identifier !== ExtentionIdentifier.SequenceScalableExtensionID) { return null; }
    const scalable_mode = stream.readBits(2);
    const layer_id = stream.readBits(4);
    let lower_layer_prediction_horizontal_size: number | null = null;
    let lower_layer_prediction_vertical_size: number | null = null;
    let horizontal_subsampling_factor_m: number | null = null;
    let horizontal_subsampling_factor_n: number | null = null;
    let vertical_subsampling_factor_m: number | null = null;
    let vertical_subsampling_factor_n: number | null = null;
    if (scalable_mode === 0b01) { // "spatial scalability"
      lower_layer_prediction_horizontal_size = stream.readBits(14);
      stream.readBool();
      lower_layer_prediction_vertical_size = stream.readBits(14);
      horizontal_subsampling_factor_m = stream.readBits(5);
      horizontal_subsampling_factor_n = stream.readBits(5);
      vertical_subsampling_factor_m = stream.readBits(5);
      vertical_subsampling_factor_n = stream.readBits(5);
    } 
    let picture_mux_enable: boolean | null = null;
    let mux_to_progressive_sequence: boolean | null = null;
    let picture_mux_order: number | null = null;
    let picture_mux_factor: number | null = null;
    if (scalable_mode === 0b11) { // "Temporal scalability"
      picture_mux_enable = stream.readBool();
      if (picture_mux_enable) {
        mux_to_progressive_sequence = stream.readBool();
      }
      picture_mux_order = stream.readBits(3);
      picture_mux_factor = stream.readBits(3);
    }

    return {
      extension_start_code_identifier,
      scalable_mode,
      layer_id,
      lower_layer_prediction_horizontal_size,
      lower_layer_prediction_vertical_size,
      horizontal_subsampling_factor_m,
      horizontal_subsampling_factor_n,
      vertical_subsampling_factor_m,
      vertical_subsampling_factor_n,
      picture_mux_enable,
      mux_to_progressive_sequence,
      picture_mux_order,
      picture_mux_factor
    };
  }

  #picture_coding_extension(stream: BitStream) {
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
    const q_scale_type = stream.readBool();
    const intra_vlc_format = stream.readBool();
    const alternate_scan = stream.readBool();
    const repeat_first_field = stream.readBool();
    const chroma_420_type = stream.readBool();
    const progressive_frame = stream.readBool();
    const composite_display_flag = stream.readBool();
    let v_axis: boolean | null = null;
    let field_sequence: number | null = null;
    let sub_carrier: boolean | null = null;
    let burst_amplitude: number | null = null;
    let sub_carrier_phase: number | null = null;
    if (composite_display_flag) {
      v_axis = stream.readBool();
      field_sequence = stream.readBits(3);
      sub_carrier = stream.readBool();
      burst_amplitude = stream.readBits(7);
      sub_carrier_phase = stream.readUint8();
    }
    this.#next_start_code(stream);

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

  #group_of_pictures_header(stream: BitStream) {
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

  #picture_header(stream: BitStream) {
    const picture_start_code = stream.readUint32();
    if (picture_start_code !== StartCode.PictureStartCode) { return null; }
    const temporal_reference = stream.readBits(10);
    const picture_coding_type = stream.readBits(3);
    const vbv_delay = stream.readUint16();
    let full_pel_forward_vector = null;
    let forward_f_code = null;
    if (picture_coding_type === 2 || picture_coding_type == 3) {
      full_pel_forward_vector = stream.readBool(); // H.262 is zero
      forward_f_code = stream.readBits(3); // H.262 is 111
    }
    let full_pel_backward_vector = null;
    let backward_f_code = null;
    if (picture_coding_type === 3) {
      full_pel_backward_vector = stream.readBool(); // H.262 is zero
      backward_f_code = stream.readBits(3); // H.262 is 111
    }
    const extra_information_picture: number[] = [];
    while (stream.peekBits(1) === 1) {
      const extra_bit_picture = stream.readBits(1);
      extra_information_picture.push(stream.readUint8());
    }
    stream.readBits(1); // always zero
    this.#next_start_code(stream);

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

  #slice(stream: BitStream) {
    const slice_start_code = stream.readUint32();
    if (!(StartCode.MinSliceStartCode <= slice_start_code && slice_start_code <= StartCode.MaxSliceStartCode)) { return null; }

    /* TODO: implement and remove this condition! */
    if (this.#picture_coding_type == null || this.#picture_coding_type !== PictureCodingType.I) {
      return;
    }

    let slice_vertical_position = (slice_start_code & 0x000000FF) - 1;
    if (slice_vertical_position >= (2800 - 1)) {
      slice_vertical_position += (stream.readBits(3) << 7)
    }

    if (this.#scalable_mode != null && this.#scalable_mode === 0) {
      const priority_breakpoint = stream.readBits(7);
    }

    this.#quantizer_scale = stream.readBits(5);
    if (stream.peekBool()) {
      const intra_slice_flag = stream.readBool();
      const intra_slice = stream.readBool();
      const reserved_bits = stream.readBits(7);
      while (stream.peekBool()) {
        const extra_bit_slice = stream.readBool();
        const extra_information_slice = stream.readUint8();
      }
    }
    const extra_bit_slice = stream.readBool();
    try {
      do {
        this.#macroblock(stream);
      } while (stream.peekBits(23) !== 0);
    } catch (e: unknown) {}
  }

  #macroblock(stream: BitStream) {
    let macroblock_address_increment = 0;
    while(true) {
      const value = MACROBLOCK_ADDRESS_INCREMENT_VLC.get(stream);
      if (value == null) { return null; }
      if (value >= 34) {
        macroblock_address_increment += 33;
        continue;
      }
      macroblock_address_increment += value;
      break;
    }

    if (this.#picture_coding_type == null) { return null; }
    const macroblock_type = MACROBLOCK_TYPE_VLC[this.#picture_coding_type].get(stream);
    if (macroblock_type == null) { return null; }

    const {
      macroblock_quant,
      macroblock_motion_forward,
      macroblock_motion_backward,
      macroblock_intra,
      macroblock_pattern,
    } = macroblock_params[this.#picture_coding_type][macroblock_type];
    // TODO: Implement B frame and remove this!
    // spatial_temporal_weight_code (2bit)
    // frame_motion_type, field_motion_type

    let dct_type: boolean | null = null;
    if (this.#picture_structure === 0b11 && this.#frame_pred_frame_dct === false && (macroblock_intra || macroblock_pattern)) {
      dct_type = stream.readBool();
    }

    if (macroblock_quant) {
      this.#quantizer_scale = stream.readBits(5);
    }
    if (macroblock_motion_forward || (macroblock_intra && this.#concealment_motion_vectors)) {
      // mb
    }
    if (macroblock_motion_backward) {
      // mb
    }
    if (macroblock_intra && this.#concealment_motion_vectors) {
      stream.readBits(1);
    }

    let coded_block_pattern: number | null = null;
    if (macroblock_pattern) {
      coded_block_pattern = CODED_BLOCK_PATTERN_VLC.get(stream);
      if (coded_block_pattern == null) { return null; }

      if (this.#chroma_format === 2) {
        coded_block_pattern = (coded_block_pattern * (2 ** 2)) + stream.readBits(2);
      } else if (this.#chroma_format === 3) {
        coded_block_pattern = (coded_block_pattern * (2 ** 6)) + stream.readBits(6);
      }
    }
    if (!macroblock_intra && coded_block_pattern == null) { return null; }

    if (this.#block_count == null) { return null; }
    for (let i = 0; i < this.#block_count; i++) {
      const decoded = this.#block(i < 4, macroblock_params[this.#picture_coding_type][macroblock_type], stream);
      if (decoded == null) { return null; }
    }
  }

  #block(is_luminance: boolean, params: MacroBlockParametersFlags, stream: BitStream) {
    const { macroblock_intra } = params;
    let index = 0;
    const coeffs = [];
    for (let i = 0; i < BLOCK_DCT_COEFFS; i++) { coeffs.push(0); }

    // read coeff in VLC
    if (macroblock_intra) {
      const dct_dc_size = is_luminance ? DCT_DC_SIZE_LUMINANCE_VLC.get(stream) : DCT_DC_SIZE_CHROMINANCE_VLC.get(stream);
      if (dct_dc_size == null) { return null; }

      if (dct_dc_size !== 0) {
        let dct_dc_differential = stream.readBits(dct_dc_size);
        dct_dc_differential = (dct_dc_differential << (32 - dct_dc_size)) >> (32 - dct_dc_size)
        if ((dct_dc_differential & (1 << (dct_dc_size - 1))) === 0) {
          dct_dc_differential -= (1 << dct_dc_size) - 1;
        }
      } else {
        coeffs[0] = 0;
      }
      index++;
    } else {
      const result = DCT_COEFFICIENTS_ZERO_DC_VLC.get(stream);
      if (result == null) { return null; }

      let { run, level } = result;
      if (stream.readBool()) {
        level = -level;
      }

      index += run;
      coeffs[index] = level;
    }
    while (true) {
      const result = DCT_COEFFICIENTS_ZERO_OTHER_VLC.get(stream);
      if (result == null) { break; }

      const { eob, escape } = result;
      let { run, level } = result;

      if (eob) { break; }
      if (escape) {
        run = stream.readBits(6)
        level = (stream.readBits(12) << 20) >> 20;
      } else if (stream.readBool()) {
        level = -level;          
      }

      index += run;
      coeffs[index] = level;
    }

    // dequantize
    const dequant: number[][] = [];
    for (let i = 0; i < 8; i++) {
      dequant.push([]);
      for (let j = 0; j < 8; j++) { dequant[i].push(0); }
    }
    for (let i = 0; i < 8; i++) {
      for (let j = 0; j < 8; j++) {
        const order = zigzag[i][j];
        const matrix = macroblock_intra ? this.#intra_quantiser_matrix : this.#non_intra_quantiser_matrix;
        if (matrix == null) { continue; }

        if (macroblock_intra) {
          dequant[i][j] = (2 * coeffs[order]) * this.#quantizer_scale! * matrix[i * 8 + j] / 16;
        } else {
          dequant[i][j] = (2 * coeffs[order] + Math.sign(coeffs[order])) * this.#quantizer_scale! * matrix[i * 8 + j] / 16;
        }
        if (dequant[i][j] % 2 === 0) {
          dequant[i][j] -= Math.sign(dequant[i][j]);
        }
        dequant[i][j] = Math.max(-2048, Math.min(2047, dequant[i][j]));
      }
    }

    // fast idct
    const image = idct(dequant);
    return image;
  }

  public decode(payload: ArrayBuffer) {
    const stream = new BitStream(payload);

    while (this.#next_start_code(stream)) {
      switch(stream.peekUint32()) {
        case StartCode.SequenceHeaderCode: {
          const sequence = this.#sequence_header(stream);
          if (sequence == null) {
            this.#intra_quantiser_matrix = default_intra_quantiser_matrix;
            this.#non_intra_quantiser_matrix = default_non_intra_quantiser_matrix;
          } else {
            this.#intra_quantiser_matrix = sequence.intra_quantiser_matrix;
            this.#non_intra_quantiser_matrix = sequence.non_intra_quantiser_matrix;
          }
          break; 
        }
        case StartCode.UserDataStartCode:
          this.#user_data(stream);
          break;
        case StartCode.ExtensionStartCode:
          stream.readUint32();
          switch (stream.peekBits(4)) {
            case ExtentionIdentifier.SequenceExtensionID: {
              const extension = this.#sequence_extension(stream);
              this.#chroma_format = extension?.chroma_format ?? null;
              break;
            }
            case ExtentionIdentifier.SequenceScalableExtensionID: {
              const extension = this.#sequence_scalable_extension(stream);
              this.#scalable_mode = extension?.scalable_mode ?? null;
              break;
            }
            case ExtentionIdentifier.PictureCodingExtensionID: {
              const extension = this.#picture_coding_extension(stream);
              this.#picture_structure = extension?.picture_structure ?? null;
              this.#frame_pred_frame_dct = extension?.frame_pred_frame_dct ?? null;
              this.#concealment_motion_vectors = extension?.concealment_motion_vectors ?? null;
              break;
            }
            default:
              break;
          }
          break;
        case StartCode.GroupStartCode:
          this.#group_of_pictures_header(stream);
          break;
        case StartCode.SequenceEndCode:
          // if needed
          stream.readUint32();
          break;
        case StartCode.PictureStartCode: {
          const header = this.#picture_header(stream);
          this.#picture_coding_type = header?.picture_coding_type ?? null
          break;
        }
        default: {
          if (StartCode.MinSliceStartCode <= stream.peekUint32() && stream.peekUint32() <= StartCode.MaxSliceStartCode) {
            this.#slice(stream);
          }
          break;
        }
      }
    }
  }
}
