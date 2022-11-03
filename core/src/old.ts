import BitStream from "./bitstream";

enum StartCode {
  PictureStartCode = 0x100,
  UserDataStartCode = 0x1B2,
  SequenceHeaderCode = 0x1B3,
  SequenceErrorCode = 0x1B4,
  ExtensionStartCode = 0x1B5,
  SequenceEndCode = 0x1B7,
  GroupStartCode = 0x1B8
}

export default class H262Decoder {

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

  #video_sequence(stream: BitStream) {
    if (!this.#next_start_code(stream)) {
      return null; 
    }
    console.log('start!')
     
    this.#sequence_header(stream);
    if (stream.peekUint32() === StartCode.ExtensionStartCode) {
      this.#sequence_extension(stream);
      do {
        this.#extensions_and_user_data(0, stream);
        do {
          if (stream.peekUint32() === StartCode.GroupStartCode) {
            this.#group_of_pictures_header(stream);
            this.#extensions_and_user_data(1, stream);
          }
          this.#picture_header(stream);
          this.#picture_coding_extension(stream);
          this.#extensions_and_user_data(2, stream);
          this.#picture_data(stream);
        } while (stream.peekUint32() === StartCode.PictureStartCode || stream.peekUint32() === StartCode.GroupStartCode);
      } while (stream.peekUint32() !== StartCode.SequenceEndCode);
    } else {
      /* ISO/IEC 11172-2 */
    }
    const sequence_end_code = stream.readUint32();

    return {
      sequence_end_code
    };
  }

  #sequence_header(stream: BitStream) {
    const sequence_header_code = stream.readUint32(); // 
    if (sequence_header_code !== StartCode.SequenceHeaderCode) { return null; }
    const horizontal_size_value = stream.readBits(12);
    const vertical_size_value = stream.readBits(12);
    const aspect_ratio_information = stream.readBits(4);
    const frame_rate_code = stream.readBits(4);
    const bit_rate_value = stream.readBits(18);
    const marker_bit = stream.readBool();
    const vbv_buffer_size_value = stream.readBits(10);
    const constrained_parameters_flag = stream.readBool();
    const load_intra_quantiser_matrix = stream.readBool();
    let intra_quantiser_matrix: number[] | null = null;
    if (load_intra_quantiser_matrix) {
      intra_quantiser_matrix = [];
      for (let i = 0; i < 64; i++) {
        intra_quantiser_matrix.push(stream.readUint8());
      }
    }
    const load_non_intra_quantiser_matrix = stream.readBool();
    let non_intra_quantiser_matrix: number[] | null = null;
    if (load_non_intra_quantiser_matrix) {
      non_intra_quantiser_matrix = [];
      for (let i = 0; i < 64; i++) {
        non_intra_quantiser_matrix.push(stream.readUint8());
      }
    }
    this.#next_start_code(stream);

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
    };
  }

  #sequence_extension(stream: BitStream) {
    const extension_start_code = stream.readUint32();
    if (extension_start_code !== StartCode.ExtensionStartCode) { return null; }
    const extension_start_code_identifier = stream.readBits(4);
    const profile_and_level_indication = stream.readUint8();
    const progressive_sequence = stream.readBool();
    const chroma_format = stream.readBits(2);
    const horizontal_size_extension = stream.readBits(2);
    const vertical_size_extension = stream.readBits(2);
    const bit_rate_extension = stream.readBits(2);
    const marker_bit = stream.readBool();
    const vbv_buffer_size_extension = stream.readUint8();
    const low_delay = stream.readBool();
    const frame_rate_extension_n = stream.readBits(2);
    const frame_rate_extension_d = stream.readBits(5);

    return {
      extension_start_code,
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

  #extensions_and_user_data(i: number, stream: BitStream) {
    while (true) {
      const code = stream.peekUint32();
      if (code !== StartCode.ExtensionStartCode && code !== StartCode.UserDataStartCode) {
        break;
      }

      if (i !== 0 && code === StartCode.ExtensionStartCode) {
        this.#extension_data(i, stream)
      }
      if (code === StartCode.UserDataStartCode) {
        this.#user_data(stream);
      }
    }
  }

  #extension_data(i: number, stream: BitStream) {
    while (stream.peekUint32() === StartCode.ExtensionStartCode) {
      const extension_start_code = stream.readUint32();
      if (i === 0) {
        if (stream.peekBits(4) === 0b0010) { // "Sequence Display Extension ID"
          this.#sequence_display_extension(stream);
        } else {
          this.#sequence_scalable_extension(stream);
        }
      } else if (i === 2) {
        if (stream.peekBits(4) === 0b0011) { // Quant Matrix Extension ID
          this.#quant_matrix_extension(stream);
        } else if (stream.peekBits(4) === 0b0100) { // Copyright Extension ID
          this.#copyright_extension(stream);
        } else if (stream.peekBits(4) === 0b0111) { // Picture Display Extension ID
          this.#picture_display_extension(stream);
        } else if (stream.peekBits(4) === 0b1001) { // Picture Spatial Scalable Extension ID
          this.#picture_spatial_scalable_extension(stream);
        } else {
          this.#picture_temporal_scalable_extension(stream);
        }
      }

      return {};
    }
  }

  #sequence_display_extension(stream: BitStream) {
    const extension_start_code_identifier = stream.readBits(4);
    const video_format = stream.readBits(3);
    const colour_description = stream.readBool();
    let colour_primaries: number | null = null;
    let transfer_characteristics: number | null = null;
    let matrix_coefficients: number | null = null;
    if (colour_description) {
      colour_primaries = stream.readUint8();
      transfer_characteristics = stream.readUint8()
      matrix_coefficients = stream.readUint8();
    }
    const display_horizontal_size = stream.readBits(14)
    const marker_bit = stream.readBool();
    const display_vertical_size = stream.readBits(14);
    this.#next_start_code(stream);

    return {
      extension_start_code_identifier,
      video_format,
      colour_description,
      colour_primaries,
      transfer_characteristics,
      matrix_coefficients,
      display_horizontal_size,
      display_vertical_size
    };
  }

  #sequence_scalable_extension(stream: BitStream) {
    const extension_start_code_identifier = stream.readBits(4);
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
      const marker_bit = stream.readBool();
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
    this.#next_start_code(stream);

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

  #copyright_extension(stream: BitStream) {
    const extension_start_code_identifier = stream.readBits(4);
    const copyright_flag = stream.readBool();
    const copyright_identifier = stream.readUint8();
    const original_or_copy = stream.readBool();
    stream.readBits(7);
    stream.readBool();
    const copyright_number_1 = stream.readBits(20);
    stream.readBool();
    const copyright_number_2 = stream.readBits(22);
    stream.readBool();
    const copyright_number_3 = stream.readBits(22);
    this.#next_start_code(stream);

    return {
      extension_start_code_identifier,
      copyright_flag,
      copyright_identifier,
      original_or_copy,
      copyright_number_1,
      copyright_number_2,
      copyright_number_3
    };
  }

  #quant_matrix_extension(stream: BitStream) {
    const extension_start_code_identifier = stream.readBits(4);
    const load_intra_quantiser_matrix = stream.readBool();
    let intra_quantiser_matrix: number[] | null = null;
    if (load_intra_quantiser_matrix) {
      intra_quantiser_matrix = [];
      for (let i = 0; i < 64; i++) { intra_quantiser_matrix.push(stream.readUint8()); }
    }
    const load_non_intra_quantiser_matrix = stream.readBool();
    let non_intra_quantiser_matrix: number[] | null = null;
    if ( load_non_intra_quantiser_matrix) {
      non_intra_quantiser_matrix = [];
      for (let i = 0; i < 64; i++) { non_intra_quantiser_matrix.push(stream.readUint8()); }
    }
    const load_chroma_intra_quantiser_matrix = stream.readBool();
    let chroma_intra_quantiser_matrix: number[] | null = null;
    if (load_chroma_intra_quantiser_matrix) {
      chroma_intra_quantiser_matrix = [];
      for (let i = 0; i < 64; i++) { chroma_intra_quantiser_matrix.push(stream.readUint8()); }
    }
    const load_chroma_non_intra_quantiser_matrix = stream.readBool();
    let chroma_non_intra_quantiser_matrix: number[] | null = null;
    if (load_chroma_non_intra_quantiser_matrix) {
      chroma_non_intra_quantiser_matrix = [];
      for (let i = 0; i < 64; i++) { chroma_non_intra_quantiser_matrix.push(stream.readUint8()); }
    }
    this.#next_start_code(stream);
    
    return {
      extension_start_code_identifier,
      load_intra_quantiser_matrix,
      intra_quantiser_matrix,
      load_non_intra_quantiser_matrix,
      non_intra_quantiser_matrix,
      load_chroma_intra_quantiser_matrix,
      chroma_intra_quantiser_matrix,
      load_chroma_non_intra_quantiser_matrix,
      chroma_non_intra_quantiser_matrix,
    };
  }

  #picture_display_extension(stream: BitStream) {
    /*
if ( progressive_sequence == 1) {
if ( repeat_first_field = = ‘1’ ) { if ( top_field_first == ‘1’ )
number_of_frame_centre_offsets = 3 else
number_of_frame_centre_offsets = 2 number_of_frame_centre_offsets = 1
values.
56
ITU-T Rec. H.262 (1995 E)
} else {
} } else {
} }
if (picture_structure == “field”) { number_of_frame_centre_offsets = 1
} else {
if (repeat_first_field == ‘1’ )
number_of_frame_centre_offsets = 3 else
number_of_frame_centre_offsets = 2
    */
    const extension_start_code_identifier = stream.readBits(4);
    for (let i = 0; i < 0 /*number_of_frame_centre_offsets*/; i++) {
      const frame_centre_horizontal_offset = stream.readUint16();
      stream.readBool();
      const frame_centre_vertical_offset = stream.readUint16();
      stream.readBool(); 
    }

    return {
      extension_start_code_identifier
    };
  }

  #picture_spatial_scalable_extension(stream: BitStream) {
    const extension_start_code_identifier = stream.readBits(4);
    const lower_layer_temporal_reference = stream.readBits(10);
    stream.readBool();
    const lower_layer_horizontal_offset = stream.readBits(15);
    stream.readBool();
    const lower_layer_vertical_offset = stream.readBits(15);
    const spatial_temporal_weight_code_table_index = stream.readBits(2);
    const lower_layer_progressive_frame = stream.readBool();
    const lower_layer_deinterlaced_field_select = stream.readBool();
    this.#next_start_code(stream);

    return {
      extension_start_code_identifier,
      lower_layer_temporal_reference,
      lower_layer_horizontal_offset,
      lower_layer_vertical_offset,
      spatial_temporal_weight_code_table_index,
      lower_layer_progressive_frame,
      lower_layer_deinterlaced_field_select
    };
  }

  #picture_temporal_scalable_extension(stream: BitStream) {
    const extension_start_code_identifier = stream.readBits(4);
    const reference_select_code = stream.readBits(2);
    const forward_temporal_reference = stream.readBits(10);
    const marker_bit = stream.readBool();
    const backward_temporal_reference = stream.readBits(10);
    this.#next_start_code(stream);

    return {
      extension_start_code_identifier,
      reference_select_code,
      forward_temporal_reference,
      backward_temporal_reference
    };
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

  #group_of_pictures_header(stream: BitStream) {
    const group_start_code = stream.readUint32();
    if (group_start_code !== StartCode.GroupStartCode) { return null;}
    const timecode = stream.readBits(25);
    const closed_gop = stream.readBool();
    const broken_link = stream.readBool();
    this.#next_start_code(stream);

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
      full_pel_backward_vector,
      forward_f_code,
      full_pel_forward_vector,
      backward_f_code,
      extra_information_picture
    };
  }

  #picture_coding_extension(stream: BitStream) {
    const extension_start_code = stream.readUint32();
    if (extension_start_code !== StartCode.ExtensionStartCode) { return null; }
    const extension_start_code_identifier = stream.readBits(4);
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
      extension_start_code,
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

  #picture_data(stream: BitStream) {
    do {
      this.#slice(stream);
      stream.readUint8();
    } while (0x101 <= stream.peekUint32() && stream.peekUint32() <= 0x1AF);
    this.#next_start_code(stream)
  }

  #slice(stream: BitStream) {
    const slice_start_code = stream.readUint32();
    if (!(0x101 <= slice_start_code && slice_start_code <= 0x1AF)) { return null; }

    const vertical_size = 0;
    if (vertical_size >= 2800) {
      const slice_vertical_position_extension = stream.readBits(3);
    }

    const scalable_mode = 0;
    if (scalable_mode === 0) {
      const priority_breakpoint = stream.readBits(7);
    }

    const quantiser_scale_code = stream.readBits(5);
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
    do {
      //macroblock
      stream.readUint8();
    } while (stream.peekUint32() !== 0);
    this.#next_start_code(stream);
  }

  public decode(payload: ArrayBuffer) {
    const stream = new BitStream(payload);

    while (true) {
      const result = this.#video_sequence(stream);
      if (!result) { break; }
    }
  }
}
