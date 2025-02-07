import BitStream from "./util/bitstream";
import { BLOCK_COL, BLOCK_DCT_COEFFS, BLOCK_ROW } from "./constant";
import idct from "./idct";
import { CODED_BLOCK_PATTERN_VLC, DCT_COEFFICIENTS_ZERO_DC_VLC, DCT_COEFFICIENTS_ZERO_OTHER_VLC, DCT_DC_SIZE_CHROMINANCE_VLC, DCT_DC_SIZE_LUMINANCE_VLC, MACROBLOCK_ADDRESS_INCREMENT_VLC, MACROBLOCK_TYPE_VLC } from "./vlc";
import { alternateOrder, ExtentionIdentifier, findNextStartCode, MacroBlockParametersFlags, macroblockParams, parseGroupOfPicturesHeader, parsePictureCodingExtension, parsePictureHeader, parseScalableExtension, parseSeqenceHeader, parseSequenceExtension, parseUserData, PictureCodingExtension, PictureCodingType, PictureHeader, q_scale, ScalableExtension, SequenceExtension, SequenceHeader, StartCode, zigzagOrder } from "./structure";

export default class H262Decoder {
  #sequence_header: SequenceHeader | null = null;
  #sequence_extension: SequenceExtension | null = null;
  #scalable_extension: ScalableExtension | null = null;
  #picture_coding_extension: PictureCodingExtension | null = null;
  #picture_header: PictureHeader | null = null;

  #dct_dc_pred: number[] = [];
  #quantizer_scale: number | null = null;
  #macroblock_address: number = 0;

  #y: Uint8ClampedArray[] = [];
  #u: Uint8ClampedArray[] = [];
  #v: Uint8ClampedArray[] = [];

  #slice(stream: BitStream) {
    const slice_start_code = stream.readUint32();
    if (!(StartCode.MinSliceStartCode <= slice_start_code && slice_start_code <= StartCode.MaxSliceStartCode)) { return null; }

    if (this.#picture_coding_extension == null) {
      return
    }

    /* TODO: implement and remove this condition! */
    if (this.#picture_header == null || this.#picture_header.picture_coding_type !== PictureCodingType.I) {
      return;
    }
    this.#dct_dc_pred = [
      1 << (this.#picture_coding_extension.intra_dc_precision + 7),
      1 << (this.#picture_coding_extension.intra_dc_precision + 7),
      1 << (this.#picture_coding_extension.intra_dc_precision + 7),
    ];

    let slice_vertical_position = (slice_start_code & 0x000000FF) - 1;
    if (slice_vertical_position >= (2800 - 1)) {
      slice_vertical_position += (stream.readBits(3) << 7)
    }

    if (this.#scalable_extension?.scalable_mode === 0) {
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
    if (this.#sequence_header == null || this.#sequence_extension == null || this.#picture_header == null || this.#picture_coding_extension == null) {
      return null;
    }

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

    const macroblock_type = MACROBLOCK_TYPE_VLC[this.#picture_header.picture_coding_type].get(stream);
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

    let dct_type: boolean | null = null;
    if (this.#picture_coding_extension.picture_structure === 0b11 && this.#picture_coding_extension.frame_pred_frame_dct === false && (macroblock_intra || macroblock_pattern)) {
      dct_type = stream.readBool();
    }

    if (macroblock_quant) {
      this.#quantizer_scale = stream.readBits(5);
    }
    if (macroblock_motion_forward || (macroblock_intra && this.#picture_coding_extension.concealment_motion_vectors)) {
      // mb
    }
    if (macroblock_motion_backward) {
      // mb
    }
    if (macroblock_intra && this.#picture_coding_extension.concealment_motion_vectors) {
      stream.readBits(1);
    }

    let coded_block_pattern: number | null = null;
    if (macroblock_pattern) {
      coded_block_pattern = CODED_BLOCK_PATTERN_VLC.get(stream);
      if (coded_block_pattern == null) { return null; }

      if (this.#sequence_extension.chroma_format === 2) {
        coded_block_pattern = (coded_block_pattern * (2 ** 2)) + stream.readBits(2);
      } else if (this.#sequence_extension.chroma_format === 3) {
        coded_block_pattern = (coded_block_pattern * (2 ** 6)) + stream.readBits(6);
      }
    }
    if (!macroblock_intra && coded_block_pattern == null) { return null; }

    for (let i = 0; i < 6/* this.#block_count */; i++) {
      const decoded = this.#block(i < 4, Math.max(0, i - 3), macroblockParams[this.#picture_header.picture_coding_type][macroblock_type], stream);
      if (decoded == null) { return null; }

      const rows = Math.floor(this.#sequence_header.horizontal_size_value / 16);
      const sx = Math.floor(this.#macroblock_address % rows);
      const sy = Math.floor(this.#macroblock_address / rows);

      for (let r = 0; r < BLOCK_ROW; r++) {
        for (let c = 0; c < BLOCK_COL; c++) {
          switch(i) {
            case 0: this.#y[sy * 16 + r + 0][sx * 16 + c + 0] = decoded[r][c]; break;
            case 1: this.#y[sy * 16 + r + 0][sx * 16 + c + 8] = decoded[r][c]; break;
            case 2: this.#y[sy * 16 + r + 8][sx * 16 + c + 0] = decoded[r][c]; break;
            case 3: this.#y[sy * 16 + r + 8][sx * 16 + c + 8] = decoded[r][c]; break;
            case 4: this.#u[sy *  8 + r + 0][sx *  8 + c + 0] = decoded[r][c]; break;
            case 5: this.#v[sy *  8 + r + 0][sx *  8 + c + 0] = decoded[r][c]; break;
          }
        }
      }
    }

    this.#macroblock_address += macroblock_address_increment;
  }

  #block(is_luminance: boolean, yuv: number, params: MacroBlockParametersFlags, stream: BitStream) {
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
        let dct_dc_differential = stream.readBits(dct_dc_size);
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
        const run = stream.readBits(6)
        const level = (stream.readBits(12) << 20) >> 20;
        index += run
        coeffs[index++] = level;
      } else {
        const { run, level } = result;
        index += run;
        coeffs[index++] = stream.readBool() ? -level : level;
      }
    }
    while (true) {
      const result = DCT_COEFFICIENTS_ZERO_OTHER_VLC.get(stream);
      if (result == null || result.eob) { break; }

      if (result.escape) {
        const run = stream.readBits(6)
        const level = (stream.readBits(12) << 20) >> 20;
        index += run
        coeffs[index++] = level;
      } else {
        const { run, level } = result;
        index += run;
        coeffs[index++] = stream.readBool() ? -level : level;
      }
    }

    // dequantize
    const dequant: number[][] = [];
    for (let i = 0; i < 8; i++) {
      dequant.push([]);
      for (let j = 0; j < 8; j++) { dequant[i].push(0); }
    }
    for (let i = 0; i < 8; i++) {
      for (let j = 0; j < 8; j++) {
        const order = (this.#picture_coding_extension.alternate_scan ? alternateOrder : zigzagOrder)[i][j];
        const matrix = macroblock_intra ? this.#sequence_header.intra_quantiser_matrix : this.#sequence_header.non_intra_quantiser_matrix
        if (matrix == null) { continue; }

        if (macroblock_intra) {
          if (i === 0 && j === 0) {
            dequant[i][j] = (coeffs[order]) * (1 << (3 - this.#picture_coding_extension.intra_dc_precision));
          } else {
            dequant[i][j] = (2 * coeffs[order]) * q_scale[this.#picture_coding_extension.q_scale_type][this.#quantizer_scale!] * matrix[i * 8 + j] / 32;
          }
        } else {
          dequant[i][j] = (2 * coeffs[order] + Math.sign(coeffs[order])) * this.#quantizer_scale! * matrix[i * 8 + j] / 16;
        }
        if (dequant[i][j] % 2 === 0) {
          dequant[i][j] += Math.sign(dequant[i][j]);
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

    let firstIFrameArrived = false;

    while (findNextStartCode(stream)) {
      switch(stream.peekUint32()) {
        case StartCode.SequenceHeaderCode: {
          this.#sequence_header = parseSeqenceHeader(stream);
          if (!this.#sequence_header) { break; }

          if (firstIFrameArrived) { return { y: this.#y, u: this.#u, v: this.#v }; }
          for (let i = 0; i < this.#sequence_header.vertical_size_value; i++) {
            this.#y.push(new Uint8ClampedArray(this.#sequence_header.horizontal_size_value));
          }
          this.#u = [];
          this.#v = [];
          for (let i = 0; i < Math.floor(this.#sequence_header.vertical_size_value / 2); i++) {
            this.#u.push(new Uint8ClampedArray(Math.floor(this.#sequence_header.horizontal_size_value) / 2));
            this.#v.push(new Uint8ClampedArray(Math.floor(this.#sequence_header.horizontal_size_value) / 2));
          }

          break;
        }
        case StartCode.UserDataStartCode:
          parseUserData(stream);
          break;
        case StartCode.ExtensionStartCode:
          stream.readUint32();
          switch (stream.peekBits(4)) {
            case ExtentionIdentifier.SequenceExtensionID: {
              this.#sequence_extension = parseSequenceExtension(stream);
              break;
            }
            case ExtentionIdentifier.SequenceScalableExtensionID: {
              this.#scalable_extension = parseScalableExtension(stream);
              break;
            }
            case ExtentionIdentifier.PictureCodingExtensionID: {
              this.#picture_coding_extension = parsePictureCodingExtension(stream);
              break;
            }
            default:
              break;
          }
          break;
        case StartCode.GroupStartCode:
          parseGroupOfPicturesHeader(stream);
          break;
        case StartCode.SequenceEndCode:
          // if needed
          stream.readUint32();
          break;
        case StartCode.PictureStartCode: {
          this.#picture_header = parsePictureHeader(stream);
          if (this.#picture_header?.picture_coding_type === PictureCodingType.I) {
            firstIFrameArrived = true;
          }
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
