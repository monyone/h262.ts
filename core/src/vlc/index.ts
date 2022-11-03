import BinaryTrie from "./trie";
import { macroblock_address_increment_table, macroblock_type_tables, coded_block_pattern_table, dct_dc_size_luminance_table, dct_dc_size_chrominance_table, DCTCefficientsParams, dct_coefficients_zero_dc_table, dct_coefficients_zero_other_table } from "./code";

export const MACROBLOCK_ADDRESS_INCREMENT_VLC = new BinaryTrie<number>();
macroblock_address_increment_table.forEach(([code, length], idx) => {
  MACROBLOCK_ADDRESS_INCREMENT_VLC.append(idx + 1, code, length)
});

export const MACROBLOCK_TYPE_VLC = macroblock_type_tables.map((_) => new BinaryTrie<number>());
macroblock_type_tables.forEach((table, type) => {
  table.forEach(([code, length], index) => {
    MACROBLOCK_TYPE_VLC[type].append(index, code, length)
  });
});

export const CODED_BLOCK_PATTERN_VLC = new BinaryTrie<number>();
coded_block_pattern_table.forEach(([code, length, value]) => {
  CODED_BLOCK_PATTERN_VLC.append(value, code, length);
});

export const DCT_DC_SIZE_LUMINANCE_VLC = new BinaryTrie<number>();
dct_dc_size_luminance_table.forEach(([code, length], index) => {
  DCT_DC_SIZE_LUMINANCE_VLC.append(index, code, length);
});

export const DCT_DC_SIZE_CHROMINANCE_VLC = new BinaryTrie<number>();
dct_dc_size_chrominance_table.forEach(([code, length], index) => {
  DCT_DC_SIZE_CHROMINANCE_VLC.append(index, code, length);
});

export const DCT_COEFFICIENTS_ZERO_DC_VLC = new BinaryTrie<DCTCefficientsParams>();
dct_coefficients_zero_dc_table.forEach(([code, length, value]) => {
  DCT_COEFFICIENTS_ZERO_DC_VLC.append(value, code, length);
});
export const DCT_COEFFICIENTS_ZERO_OTHER_VLC = new BinaryTrie<DCTCefficientsParams>();
dct_coefficients_zero_other_table.forEach(([code, length, value]) => {
  DCT_COEFFICIENTS_ZERO_OTHER_VLC.append(value, code, length);
});