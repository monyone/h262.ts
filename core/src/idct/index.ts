import { BLOCK_COL, BLOCK_ROW } from "../constant";

const fast_idct = (array: number[]): number[] => {
  if (array.length === 1) { return array; }
  const s_front = array.filter((_, index) => index < array.length / 2);
  const s_tail = array.filter((_, index) => index >= array.length / 2);
  for (let i = 1; i < s_tail.length; i++) { s_tail[i] += s_tail[i - 1]; }

  const k_front = fast_idct(s_front);
  const k_tail = fast_idct(s_tail).map((x, index) => x / (2 * Math.cos(Math.PI / ((2 * array.length)) * (2 * index + 1))));

  const t_front = k_front.map((value, index) => value - k_tail[index]);
  const t_tail = k_tail.map((value, index) => value + k_front[index]);

  return [... t_front, ... t_tail];
}

export default (dequant: number[][]) => {
  const col_idct: number[][] = dequant.map(array => fast_idct(array));
  const rows: number[][] = [];
  for (let i = 0; i < BLOCK_COL; i++) {
    rows.push([]);
    for (let j = 0; j < BLOCK_ROW; j++) {
      rows[i].push(col_idct[j][i]);
    }
  }
  return rows.map(array => fast_idct(array));
}
