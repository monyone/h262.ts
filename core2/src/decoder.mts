import BitReader, { bool } from "./reader.mts";
import { BLOCK_COL, BLOCK_DCT_COEFFS, BLOCK_ROW, ChromaFormat, PictureCodingType, PictureStructure, UnsupportedError, xy, YUVFormatType } from "./constants.mts";
import idct from "./idct.mts";
import { CODED_BLOCK_PATTERN_VLC, DCT_COEFFICIENTS_ZERO_DC_VLC, DCT_COEFFICIENTS_ZERO_OTHER_VLC, DCT_DC_SIZE_CHROMINANCE_VLC, DCT_DC_SIZE_LUMINANCE_VLC, MACROBLOCK_ADDRESS_INCREMENT_VLC, MACROBLOCK_TYPE_VLC, MOTION_CODE_VLC } from "./vlc.mts";
import { alternateOrder, ExtensionStartCode, type MacroBlockParametersFlags, macroblockParams, PictureCodingExtension, PictureHeader, q_scale, ScalableMode, SequenceExtension, SequenceHeader, SequenceScalableExtension, skipUntilStartCode, StartCode, zigzagOrder } from "./types.mts";

export type DecodedFrame = {
  width: number,
  height: number,
  chroma_format: (typeof ChromaFormat)[keyof typeof ChromaFormat],
  yuv: Uint8ClampedArray,
};
export const DecodedFrame = {
  export(frame: DecodedFrame): Uint8Array {
    return Uint8Array.from(frame.yuv);
  },
  y_get(x: number, y: number, frame: DecodedFrame) {
    const val1 = frame.yuv[DecodedFrame.pos(YUVFormatType.Y, Math.ceil(x),  Math.ceil(y),  frame)];
    const val2 = frame.yuv[DecodedFrame.pos(YUVFormatType.Y, Math.ceil(x),  Math.floor(y), frame)];
    const val3 = frame.yuv[DecodedFrame.pos(YUVFormatType.Y, Math.floor(x), Math.ceil(y),  frame)];
    const val4 = frame.yuv[DecodedFrame.pos(YUVFormatType.Y, Math.floor(x), Math.floor(y), frame)];
    return Math.round((val1 + val2 + val3 + val4) / 4);
  },
  u_get(x: number, y: number, frame: DecodedFrame) {
    const val1 = frame.yuv[DecodedFrame.pos(YUVFormatType.U, Math.ceil(x),  Math.ceil(y),  frame)];
    const val2 = frame.yuv[DecodedFrame.pos(YUVFormatType.U, Math.ceil(x),  Math.floor(y), frame)];
    const val3 = frame.yuv[DecodedFrame.pos(YUVFormatType.U, Math.floor(x), Math.ceil(y),  frame)];
    const val4 = frame.yuv[DecodedFrame.pos(YUVFormatType.U, Math.floor(x), Math.floor(y), frame)];
    return Math.round((val1 + val2 + val3 + val4) / 4);
  },
  v_get(x: number, y: number, frame: DecodedFrame) {
    const val1 = frame.yuv[DecodedFrame.pos(YUVFormatType.V, Math.ceil(x),  Math.ceil(y),  frame)];
    const val2 = frame.yuv[DecodedFrame.pos(YUVFormatType.V, Math.ceil(x),  Math.floor(y), frame)];
    const val3 = frame.yuv[DecodedFrame.pos(YUVFormatType.V, Math.floor(x), Math.ceil(y),  frame)];
    const val4 = frame.yuv[DecodedFrame.pos(YUVFormatType.V, Math.floor(x), Math.floor(y), frame)];
    return Math.round((val1 + val2 + val3 + val4) / 4);
  },
  in_range(type: (typeof YUVFormatType)[keyof typeof YUVFormatType], x: number, y: number, { chroma_format, width, height }: DecodedFrame): boolean {
    switch (chroma_format) {
      case ChromaFormat.YUV420:
        switch (type) {
          case YUVFormatType.Y: return 0 <= y && y < height && 0 <= x && x < width;
          case YUVFormatType.U: return 0 <= y && y < Math.floor(height / 2) && 0 <= x && x < Math.floor(width / 2);
          case YUVFormatType.V: return 0 <= y && y < Math.floor(height / 2) && 0 <= x && x < Math.floor(width / 2);
        }
      default: throw new UnsupportedError('Unsupported ChromaFormat');
    }
  },
  pos(type: (typeof YUVFormatType)[keyof typeof YUVFormatType], x: number, y: number, { chroma_format, width, height }: DecodedFrame) {
    switch (chroma_format) {
      case ChromaFormat.YUV420:
        switch (type) {
          case YUVFormatType.Y: return (y * width + x);
          case YUVFormatType.U: return (height * width) + (y * width / 2 + x);
          case YUVFormatType.V: return (height * width) + (height * width / 4) + (y * width / 2 + x);
        }
      default: throw new UnsupportedError('Unsupported ChromaFormat');
    }
  }
}

export default class H262Decoder {
  #sequence_header: SequenceHeader | null = null;
  #sequence_extension: SequenceExtension | null = null;
  #picture_coding_extension: PictureCodingExtension | null = null;
  #picture_header: PictureHeader | null = null;

  #dct_dc_pred: number[] = [];
  #quantizer_scale: number | null = null;
  #macroblock_address: number = 0;
  #forward_motion_vector: [number, number] = [0, 0];

  #decoded_frame: DecodedFrame | null = null;
  #decoding_frame: DecodedFrame | null = null;

  #slice(slice_vertical_position: number, reader: BitReader) {
    if (this.#picture_header == null || this.#picture_coding_extension == null) { return; }

    this.#dct_dc_pred = [
      1 << (this.#picture_coding_extension.intra_dc_precision + 7),
      1 << (this.#picture_coding_extension.intra_dc_precision + 7),
      1 << (this.#picture_coding_extension.intra_dc_precision + 7),
    ];
    // At the start of each slice.
    this.#forward_motion_vector = [0, 0];

    if (slice_vertical_position > 2800) {
      slice_vertical_position += (reader.read(3) << 7)
    }
    const mb_row = slice_vertical_position - 1;
    const mb_width = Math.ceil(this.#sequence_header!.horizontal_size_value / 16);

    // scalable_mode: DATA_PARTITIONING => priority_breakpoint (7bit)

    this.#quantizer_scale = reader.read(5);
    if (bool(reader.peek(1))) {
      const intra_slice_flag = bool(reader.read(1));
      const intra_slice = bool(reader.read(1));
      reader.skip(7); // reserved_bits
      while (bool(reader.peek(1))) {
        const extra_bit_slice = bool(reader.read(1));
        const extra_information_slice = reader.read(8);
      }
    }
    reader.skip(1); // extra_bit_slice

    this.#macroblock_address = mb_row * mb_width - 1;
    try {
      do {
        this.#macroblock(reader);
      } while (reader.peek(23) !== 0);
    } catch (e: unknown) {}
  }

  #macroblock(reader: BitReader) {
    if (this.#sequence_header == null || this.#sequence_extension == null || this.#picture_header == null || this.#picture_coding_extension == null) {
      return null;
    }

    let macroblock_address_increment = 0;
    while(true) {
      const value = MACROBLOCK_ADDRESS_INCREMENT_VLC.get(reader);
      if (value == null) { return null; }
      if (value >= 34) {
        macroblock_address_increment += 33;
        continue;
      }
      macroblock_address_increment += value;
      break;
    }
    if (macroblock_address_increment >= 2) {
      this.#dct_dc_pred = [
        1 << (this.#picture_coding_extension.intra_dc_precision + 7),
        1 << (this.#picture_coding_extension.intra_dc_precision + 7),
        1 << (this.#picture_coding_extension.intra_dc_precision + 7),
      ];
      // In a P-picture when a macroblock is skipped.
      if (this.#picture_header.picture_coding_type === PictureCodingType.P) {
        this.#forward_motion_vector = [0, 0];
      }
    }
    this.#macroblock_address += macroblock_address_increment;

    const macroblock_type = MACROBLOCK_TYPE_VLC[this.#picture_header.picture_coding_type].get(reader);
    if (macroblock_type == null) { return null; }
    const {
      macroblock_quant,
      macroblock_motion_forward,
      macroblock_motion_backward,
      macroblock_intra,
      macroblock_pattern,
    } = macroblockParams[this.#picture_header.picture_coding_type][macroblock_type];
    // TODO: spatial_temporal_weight_code (2bit)
    const motion_type = (macroblock_motion_forward || macroblock_motion_backward) && !(this.#picture_coding_extension.picture_structure === PictureStructure.FramePicture && this.#picture_coding_extension.frame_pred_frame_dct === true) ? reader.read(2) : null;

    let dct_type: boolean | null = null; // TODO: Field or Frame DCT
    if (this.#picture_coding_extension.picture_structure === PictureStructure.FramePicture && this.#picture_coding_extension.frame_pred_frame_dct === false && (macroblock_intra || macroblock_pattern)) {
      dct_type = bool(reader.read(1));
    }

    if (!macroblock_intra) {
      this.#dct_dc_pred = [
        1 << (this.#picture_coding_extension.intra_dc_precision + 7),
        1 << (this.#picture_coding_extension.intra_dc_precision + 7),
        1 << (this.#picture_coding_extension.intra_dc_precision + 7),
      ];
    }

    // Whenever an intra macroblock is decoded which has no concealment motion vectors.
    if (macroblock_intra && !this.#picture_coding_extension.concealment_motion_vectors) {
      this.#forward_motion_vector = [0, 0];
    }
    // In a P-picture when a non-intra macroblock is decoded in which macroblock_motion_forward is zero.
    if (this.#picture_header.picture_coding_type === PictureCodingType.P && !macroblock_intra && !macroblock_motion_forward) {
      this.#forward_motion_vector = [0, 0];
    }

    if (macroblock_quant) {
      this.#quantizer_scale = reader.read(5);
    }
    if (macroblock_motion_forward || (macroblock_intra && this.#picture_coding_extension.concealment_motion_vectors)) {
      // mb
      // motion_vector(0, 0)
      const r_size_0 = this.#picture_coding_extension.f_code[0][0] - 1;
      const f_0 = 1 << (r_size_0);
      const high_0 = 16 * f_0 - 1;
      const low_0 = -16 * f_0;
      const range_0 = 32 * f_0;
      const motion_code_0 = MOTION_CODE_VLC.get(reader)!;
      const has_motion_residual_0 = r_size_0 !== 0 && motion_code_0 !== 0;
      const motion_residual_0 = has_motion_residual_0 ? reader.read(r_size_0) : null;
      const delta_0 = motion_residual_0 != null ? Math.sign(motion_code_0) * ((Math.abs(motion_code_0) - 1) * f_0 + motion_residual_0 + 1) : motion_code_0;
      let vector_0 = this.#forward_motion_vector[0] + delta_0;
      if (vector_0 < low_0) { vector_0 += range_0; }
      if (vector_0 > high_0) { vector_0 -= range_0; }

      const r_size_1 = this.#picture_coding_extension.f_code[0][1] - 1;
      const f_1 = 1 << (r_size_1);
      const high_1 = 16 * f_1 - 1;
      const low_1 = -16 * f_1;
      const range_1 = 32 * f_1;
      const motion_code_1 = MOTION_CODE_VLC.get(reader)!;
      const has_motion_residual_1 = r_size_1 !== 0 && motion_code_1 !== 0;
      const motion_residual_1 = has_motion_residual_1 ? reader.read(r_size_1) : null;
      const delta_1 = motion_residual_1 != null ? Math.sign(motion_code_1) * ((Math.abs(motion_code_1) - 1) * f_1 + motion_residual_1 + 1) : motion_code_1;
      let vector_1 = this.#forward_motion_vector[1] + delta_1;
      if (vector_1 < low_1) { vector_1 += range_1; }
      if (vector_1 > high_1) { vector_1 -= range_1; }

      this.#forward_motion_vector = [vector_0, vector_1];
    }
    if (macroblock_motion_backward) {
      // mb
      // motion_vector(0, 1)
    }
    if (macroblock_intra && this.#picture_coding_extension.concealment_motion_vectors) {
      reader.skip(1);
    }

    let coded_block_pattern: number | null = null;
    if (macroblock_pattern) {
      coded_block_pattern = CODED_BLOCK_PATTERN_VLC.get(reader);
      if (coded_block_pattern == null) { return null; }

      if (this.#sequence_extension.chroma_format === ChromaFormat.YUV422) {
        coded_block_pattern = (coded_block_pattern * (2 ** 2)) + reader.read(2);
      } else if (this.#sequence_extension.chroma_format === ChromaFormat.YUV444) {
        coded_block_pattern = (coded_block_pattern * (2 ** 6)) + reader.read(6);
      }
    }

    for (let i = 0; i < 6/* this.#block_count */; i++) {
      const is_coded = (macroblock_intra && coded_block_pattern == null) || (coded_block_pattern != null && (coded_block_pattern & (1 << (5 - i))) !== 0);

      const decoded = is_coded ? this.#block(i < 4, Math.max(0, i - 3), macroblockParams[this.#picture_header.picture_coding_type][macroblock_type], reader) : [];
      if (decoded == null) { return null; }

      const rows = Math.ceil(this.#sequence_header.horizontal_size_value / 16);
      const sx = Math.floor(this.#macroblock_address % rows);
      const sy = Math.floor(this.#macroblock_address / rows);

      const frame = this.#decoding_frame!;
      const prev = this.#decoded_frame!;
      if (macroblock_intra) {
        if (!is_coded) { continue; }
        for (let r = 0; r < BLOCK_ROW; r++) {
          for (let c = 0; c < BLOCK_COL; c++) {
            switch(i) {
              case 0: if (DecodedFrame.in_range(YUVFormatType.Y, sx * 16 + c + 0, sy * 16 + r + 0, frame)) { frame.yuv[DecodedFrame.pos(YUVFormatType.Y, sx * 16 + c + 0, sy * 16 + r + 0, frame)] = decoded[r][c]; } break;
              case 1: if (DecodedFrame.in_range(YUVFormatType.Y, sx * 16 + c + 8, sy * 16 + r + 0, frame)) { frame.yuv[DecodedFrame.pos(YUVFormatType.Y, sx * 16 + c + 8, sy * 16 + r + 0, frame)] = decoded[r][c]; } break;
              case 2: if (DecodedFrame.in_range(YUVFormatType.Y, sx * 16 + c + 0, sy * 16 + r + 8, frame)) { frame.yuv[DecodedFrame.pos(YUVFormatType.Y, sx * 16 + c + 0, sy * 16 + r + 8, frame)] = decoded[r][c]; } break;
              case 3: if (DecodedFrame.in_range(YUVFormatType.Y, sx * 16 + c + 8, sy * 16 + r + 8, frame)) { frame.yuv[DecodedFrame.pos(YUVFormatType.Y, sx * 16 + c + 8, sy * 16 + r + 8, frame)] = decoded[r][c]; } break;
              case 4: if (DecodedFrame.in_range(YUVFormatType.U, sx *  8 + c + 0, sy *  8 + r + 0, frame)) { frame.yuv[DecodedFrame.pos(YUVFormatType.U, sx *  8 + c + 0, sy *  8 + r + 0, frame)] = decoded[r][c]; } break;
              case 5: if (DecodedFrame.in_range(YUVFormatType.V, sx *  8 + c + 0, sy *  8 + r + 0, frame)) { frame.yuv[DecodedFrame.pos(YUVFormatType.V, sx *  8 + c + 0, sy *  8 + r + 0, frame)] = decoded[r][c]; } break;
            }
          }
        }
      } else {
        for (let r = 0; r < BLOCK_ROW; r++) {
          for (let c = 0; c < BLOCK_COL; c++) {
            switch(i) {
              case 0: if (DecodedFrame.in_range(YUVFormatType.Y, sx * 16 + c + 0, sy * 16 + r + 0, frame)) { frame.yuv[DecodedFrame.pos(YUVFormatType.Y, sx * 16 + c + 0, sy * 16 + r + 0, frame)] = (is_coded ? decoded[r][c] : 0) + prev.yuv[DecodedFrame.pos(YUVFormatType.Y, sx * 16 + c + 0 + Math.floor(this.#forward_motion_vector[0] / 2), sy * 16 + r + 0 + Math.floor(this.#forward_motion_vector[1] / 2), prev)]; } break;
              case 1: if (DecodedFrame.in_range(YUVFormatType.Y, sx * 16 + c + 8, sy * 16 + r + 0, frame)) { frame.yuv[DecodedFrame.pos(YUVFormatType.Y, sx * 16 + c + 8, sy * 16 + r + 0, frame)] = (is_coded ? decoded[r][c] : 0) + prev.yuv[DecodedFrame.pos(YUVFormatType.Y, sx * 16 + c + 8 + Math.floor(this.#forward_motion_vector[0] / 2), sy * 16 + r + 0 + Math.floor(this.#forward_motion_vector[1] / 2), prev)]; } break;
              case 2: if (DecodedFrame.in_range(YUVFormatType.Y, sx * 16 + c + 0, sy * 16 + r + 8, frame)) { frame.yuv[DecodedFrame.pos(YUVFormatType.Y, sx * 16 + c + 0, sy * 16 + r + 8, frame)] = (is_coded ? decoded[r][c] : 0) + prev.yuv[DecodedFrame.pos(YUVFormatType.Y, sx * 16 + c + 0 + Math.floor(this.#forward_motion_vector[0] / 2), sy * 16 + r + 8 + Math.floor(this.#forward_motion_vector[1] / 2), prev)]; } break;
              case 3: if (DecodedFrame.in_range(YUVFormatType.Y, sx * 16 + c + 8, sy * 16 + r + 8, frame)) { frame.yuv[DecodedFrame.pos(YUVFormatType.Y, sx * 16 + c + 8, sy * 16 + r + 8, frame)] = (is_coded ? decoded[r][c] : 0) + prev.yuv[DecodedFrame.pos(YUVFormatType.Y, sx * 16 + c + 8 + Math.floor(this.#forward_motion_vector[0] / 2), sy * 16 + r + 8 + Math.floor(this.#forward_motion_vector[1] / 2), prev)]; } break;
              case 4: if (DecodedFrame.in_range(YUVFormatType.U, sx *  8 + c + 0, sy *  8 + r + 0, frame)) { frame.yuv[DecodedFrame.pos(YUVFormatType.U, sx *  8 + c + 0, sy *  8 + r + 0, frame)] = (is_coded ? decoded[r][c] : 0) + prev.yuv[DecodedFrame.pos(YUVFormatType.U, sx *  8 + c + 0 + Math.floor(this.#forward_motion_vector[0] / 4), sy *  8 + r + 0 + Math.floor(this.#forward_motion_vector[1] / 4), prev)]; } break;
              case 5: if (DecodedFrame.in_range(YUVFormatType.V, sx *  8 + c + 0, sy *  8 + r + 0, frame)) { frame.yuv[DecodedFrame.pos(YUVFormatType.V, sx *  8 + c + 0, sy *  8 + r + 0, frame)] = (is_coded ? decoded[r][c] : 0) + prev.yuv[DecodedFrame.pos(YUVFormatType.V, sx *  8 + c + 0 + Math.floor(this.#forward_motion_vector[0] / 4), sy *  8 + r + 0 + Math.floor(this.#forward_motion_vector[1] / 4), prev)]; } break;
            }
          }
        }
      }
    }
  }

  #block(is_luminance: boolean, yuv: number, params: MacroBlockParametersFlags, stream: BitReader) {
    if (this.#sequence_header == null || this.#picture_coding_extension == null) { return null; }

    const { macroblock_intra } = params;
    let index = 0;
    const coeffs = Array.from({ length: BLOCK_DCT_COEFFS }, () => 0);

    // read coeff in VLC
    if (macroblock_intra) {
      const dct_dc_size = is_luminance ? DCT_DC_SIZE_LUMINANCE_VLC.get(stream) : DCT_DC_SIZE_CHROMINANCE_VLC.get(stream);
      if (dct_dc_size == null) { return null; }

      if (dct_dc_size !== 0) {
        let dct_dc_differential = stream.read(dct_dc_size);
        if ((dct_dc_differential & (1 << (dct_dc_size - 1))) === 0) {
          dct_dc_differential -= (1 << dct_dc_size) - 1;
        }
        this.#dct_dc_pred[yuv] = this.#dct_dc_pred[yuv] + dct_dc_differential;
        coeffs[0] = this.#dct_dc_pred[yuv];
      } else {
        coeffs[0] = this.#dct_dc_pred[yuv];
      }
      index += 1;
    } else {
      const result = DCT_COEFFICIENTS_ZERO_DC_VLC.get(stream);
      if (result == null) { return null; }

      if (result.escape) {
        const run = stream.read(6);
        const level = (stream.read(12) << 20) >> 20;
        index += run
        coeffs[index++] = level;
      } else {
        const { run, level } = result;
        index += run;
        coeffs[index++] = bool(stream.read(1)) ? -level : level;
      }
    }
    while (true) {
      const result = DCT_COEFFICIENTS_ZERO_OTHER_VLC.get(stream);
      if (result == null) { return null; }
      if (result.eob) { break; }

      if (result.escape) {
        const run = stream.read(6);
        const level = (stream.read(12) << 20) >> 20;
        index += run;
        coeffs[index++] = level;
      } else {
        const { run, level } = result;
        index += run;
        coeffs[index++] = bool(stream.read(1)) ? -level : level;
      }
    }

    // dequantize
    const dequant: number[][] = [];
    for (let i = 0; i < 8; i++) {
      dequant.push([]);
      for (let j = 0; j < 8; j++) { dequant[i].push(0); }
    }
    for (let y = 0; y < 8; y++) {
      for (let x = 0; x < 8; x++) {
        const order = (this.#picture_coding_extension.alternate_scan ? alternateOrder : zigzagOrder)[y][x];
        const matrix = macroblock_intra ? this.#sequence_header.intra_quantiser_matrix : this.#sequence_header.non_intra_quantiser_matrix
        if (matrix == null) { continue; }

        if (macroblock_intra) {
          if (y === 0 && x === 0) {
            dequant[y][x] = (coeffs[order]) * (1 << (3 - this.#picture_coding_extension.intra_dc_precision));
          } else {
            dequant[y][x] = (2 * coeffs[order]) * q_scale[this.#picture_coding_extension.q_scale_type][this.#quantizer_scale!] * matrix[xy(x, y)] / 32;
          }
        } else {
          dequant[y][x] = (2 * coeffs[order] + Math.sign(coeffs[order])) * q_scale[this.#picture_coding_extension.q_scale_type][this.#quantizer_scale!] * matrix[xy(x, y)] / 32;
        }
        if (dequant[y][x] % 2 === 0) {
          dequant[y][x] += Math.sign(dequant[y][x]);
        }
        dequant[y][x] = Math.max(-2048, Math.min(2047, dequant[y][x]));
      }
    }
    // fast idct
    const image = idct(dequant);
    return image;
  }

  public *decode(payload: Uint8Array): Iterable<Uint8Array> {
    const reader = new BitReader(payload);

    while (!reader.empty()) {
      if (!skipUntilStartCode(reader)) { break; }

      const startcode = reader.read(8);
      switch(startcode) {
        case StartCode.SequenceHeaderCode:
          this.#sequence_header = SequenceHeader.from(reader);
          break;
        case StartCode.UserDataStartCode:
          // Ignore
          break;
        case StartCode.ExtensionStartCode:
          switch (reader.read(4)) {
            case ExtensionStartCode.SequenceExtension: {
              this.#sequence_extension = SequenceExtension.from(reader);
              break;
            }
            case ExtensionStartCode.PictureCodingExtension: {
              this.#picture_coding_extension = PictureCodingExtension.from(reader);
              break;
            }
            default:
              break;
          }
          break;
        case StartCode.GroupStartCode:
          // ignore
          break;
        case StartCode.PictureStartCode:
          this.#picture_header = PictureHeader.from(reader);
          if (this.#sequence_header == null || this.#sequence_extension == null) { break; }

          // Next
          if (this.#decoding_frame) {
            yield DecodedFrame.export(this.#decoding_frame!);
          }
          this.#decoded_frame = this.#decoding_frame;
          this.#decoding_frame = {
            width: this.#sequence_header.horizontal_size_value,
            height: this.#sequence_header.vertical_size_value,
            chroma_format: this.#sequence_extension.chroma_format,
            yuv: this.#decoding_frame ? Uint8ClampedArray.from(this.#decoding_frame.yuv) : new Uint8ClampedArray(this.#sequence_header.vertical_size_value * this.#sequence_header.horizontal_size_value * 3 / 2),
          }
          this.#macroblock_address = 0;
          break;
        case StartCode.SequenceEndCode:
          // ignore
          break;
        default: {
          const is_slice = StartCode.MinSliceStartCode <= startcode && startcode <= StartCode.MaxSliceStartCode;
          if (this.#decoding_frame != null && is_slice) {
            this.#slice(startcode, reader);
          }
          break;
        }
      }
    }

    yield DecodedFrame.export(this.#decoding_frame!);
  }
}
