import BitReader, { bool } from "./reader.mts";
import { BLOCK_COL, BLOCK_DCT_COEFFS, BLOCK_ROW, ChromaFormat, PictureCodingType, UnsupportedError, xy } from "./constants.mts";
import idct from "./idct.mts";
import { CODED_BLOCK_PATTERN_VLC, DCT_COEFFICIENTS_ZERO_DC_VLC, DCT_COEFFICIENTS_ZERO_OTHER_VLC, DCT_DC_SIZE_CHROMINANCE_VLC, DCT_DC_SIZE_LUMINANCE_VLC, MACROBLOCK_ADDRESS_INCREMENT_VLC, MACROBLOCK_TYPE_VLC } from "./vlc.mts";
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
  ypos(x: number, y: number, { chroma_format, width }: DecodedFrame): number {
    switch (chroma_format) {
      case ChromaFormat.YUV420: return (y * width + x);
      default: throw new UnsupportedError('Unsupported ChromaFormat');
    }
  },
  upos(x: number, y: number, { chroma_format, height, width }: DecodedFrame): number {
    switch (chroma_format) {
      case ChromaFormat.YUV420: return (height * width) + (y * width / 2 + x);
      default: throw new UnsupportedError('Unsupported ChromaFormat');
    }
  },
  vpos(x: number, y: number, { chroma_format, height, width }: DecodedFrame): number {
    switch (chroma_format) {
      case ChromaFormat.YUV420: return (height * width) + (height * width / 4) + (y * width / 2 + x);
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

  #decoding_frame: DecodedFrame | null = null;

  #slice(slice_vertical_position: number, reader: BitReader) {
    if (this.#picture_header == null || this.#picture_coding_extension == null) { return; }

    this.#dct_dc_pred = [
      1 << (this.#picture_coding_extension.intra_dc_precision + 7),
      1 << (this.#picture_coding_extension.intra_dc_precision + 7),
      1 << (this.#picture_coding_extension.intra_dc_precision + 7),
    ];

    if (slice_vertical_position >= (2800 - 1)) {
      slice_vertical_position += (reader.read(3) << 7)
    }

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

    const macroblock_type = MACROBLOCK_TYPE_VLC[this.#picture_header.picture_coding_type].get(reader);
    if (macroblock_type == null) { return null; }
    const {
      macroblock_quant,
      macroblock_motion_forward,
      macroblock_motion_backward,
      macroblock_intra,
      macroblock_pattern,
    } = macroblockParams[this.#picture_header.picture_coding_type][macroblock_type];
    // TODO: Implement B frame and remove this!
    // spatial_temporal_weight_code (2bit)
    // frame_motion_type, field_motion_type

    let dct_type: boolean | null = null; // TODO: Field or Frame DCT
    if (this.#picture_coding_extension.picture_structure === 0b11 && this.#picture_coding_extension.frame_pred_frame_dct === false && (macroblock_intra || macroblock_pattern)) {
      dct_type = bool(reader.read(1));
    }

    if (macroblock_quant) {
      this.#quantizer_scale = reader.read(5);
    }
    if (macroblock_motion_forward || (macroblock_intra && this.#picture_coding_extension.concealment_motion_vectors)) {
      // mb
    }
    if (macroblock_motion_backward) {
      // mb
    }
    if (macroblock_intra && this.#picture_coding_extension.concealment_motion_vectors) {
      reader.skip(1); // TODO
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
    if (!macroblock_intra && coded_block_pattern == null) { return null; }

    for (let i = 0; i < 6/* this.#block_count */; i++) {
      const decoded = this.#block(i < 4, Math.max(0, i - 3), macroblockParams[this.#picture_header.picture_coding_type][macroblock_type], reader);
      if (decoded == null) { return null; }

      const rows = Math.ceil(this.#sequence_header.horizontal_size_value / 16);
      const sx = Math.floor(this.#macroblock_address % rows);
      const sy = Math.floor(this.#macroblock_address / rows);

      const frame = this.#decoding_frame!;
      for (let r = 0; r < BLOCK_ROW; r++) {
        for (let c = 0; c < BLOCK_COL; c++) {
          switch(i) {
            case 0: frame.yuv[DecodedFrame.ypos(sx * 16 + c + 0, sy * 16 + r + 0, frame)] = decoded[r][c]; break;
            case 1: frame.yuv[DecodedFrame.ypos(sx * 16 + c + 8, sy * 16 + r + 0, frame)] = decoded[r][c]; break;
            case 2: frame.yuv[DecodedFrame.ypos(sx * 16 + c + 0, sy * 16 + r + 8, frame)] = decoded[r][c]; break;
            case 3: frame.yuv[DecodedFrame.ypos(sx * 16 + c + 8, sy * 16 + r + 8, frame)] = decoded[r][c]; break;
            case 4: frame.yuv[DecodedFrame.upos(sx *  8 + c + 0, sy *  8 + r + 0, frame)] = decoded[r][c]; break;
            case 5: frame.yuv[DecodedFrame.vpos(sx *  8 + c + 0, sy *  8 + r + 0, frame)] = decoded[r][c]; break;
          }
        }
      }
    }

    this.#macroblock_address += macroblock_address_increment;
  }

  #block(is_luminance: boolean, yuv: number, params: MacroBlockParametersFlags, stream: BitReader) {
    if (this.#sequence_header == null || this.#picture_coding_extension == null) {
      return null;
    }

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
      if (result == null|| result.eob) { return null; }

      if (result.escape) {
        const run = stream.read(6)
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
      if (result == null || result.eob) { break; }

      if (result.escape) {
        const run = stream.read(6)
        const level = (stream.read(12) << 20) >> 20;
        index += run
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
          dequant[y][x] = (2 * coeffs[order] + Math.sign(coeffs[order])) * this.#quantizer_scale! * matrix[xy(x, y)] / 16;
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

  public decode(payload: Uint8Array) {
    const reader = new BitReader(payload);

    while (!reader.empty()) {
      if (!skipUntilStartCode(reader)) { break; }

      const startcode = reader.read(8);
      switch(startcode) {
        case StartCode.SequenceHeaderCode:
          this.#sequence_header = SequenceHeader.from(reader);
          this.#decoding_frame = null;
          break;
        case StartCode.UserDataStartCode:
          // Ignore
          break;
        case StartCode.ExtensionStartCode:
          switch (reader.read(4)) {
            case ExtensionStartCode.SequenceExtension: {
              this.#sequence_extension = SequenceExtension.from(reader);
              if (this.#sequence_header == null) { break; }
              this.#decoding_frame = {
                width: this.#sequence_header.horizontal_size_value,
                height: this.#sequence_header.vertical_size_value,
                chroma_format: this.#sequence_extension.chroma_format,
                yuv: new Uint8ClampedArray(this.#sequence_header.vertical_size_value * this.#sequence_header.horizontal_size_value * 3 / 2),
              }
              this.#macroblock_address = 0;
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

    console.error(this.#decoding_frame);

    return DecodedFrame.export(this.#decoding_frame!);
  }
}
