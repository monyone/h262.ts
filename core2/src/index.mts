import fs from "fs";
import BitReader from "./reader.mts";
import { iterate, SequenceHeader, skipUntilStartCode, StartCode } from "./types.mts";

const file = fs.readFileSync('./test.mpeg2');
const reader = new BitReader(file);

for (const sequence of iterate(reader)) {
  console.dir(sequence);
}
