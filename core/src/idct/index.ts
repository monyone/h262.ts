import { BLOCK_COL, BLOCK_ROW } from "../constant";

const slow = (x: number, y: number, dequent: number[][]) => {
  let result = 0;
  for (let v = 0; v < BLOCK_ROW; v++) {
    for (let u = 0; u < BLOCK_COL; u++) {
      const cu = u === 0 ? (1 / Math.sqrt(BLOCK_ROW)) : Math.sqrt(2 / BLOCK_ROW);
      const cv = v === 0 ? (1 / Math.sqrt(BLOCK_COL)) : Math.sqrt(2 / BLOCK_COL);
      const cosu = Math.cos(2 * Math.PI * u * (2 * x + 1) / (4 * BLOCK_ROW));
      const cosv = Math.cos(2 * Math.PI * v * (2 * y + 1) / (4 * BLOCK_COL));
      result += cu * cv * cosu * cosv * dequent[v][u];
    }
  }

  return result;
}

export default (dequant: number[][]) => {
  const idct: number[][] = [];
  for (let i = 0; i < BLOCK_ROW; i++) {
    idct.push([]);
    for (let j = 0; j < BLOCK_COL; j++) {
      idct[i].push(slow(j, i, dequant));
    }
  }

  return idct;
}
