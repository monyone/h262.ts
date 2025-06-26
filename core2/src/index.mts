import fs from "fs";
import BitReader from "./reader.mts";
import { SequenceHeader, skipUntilStartCode, StartCode } from "./types.mts";

const file = fs.readFileSync('./test.mpeg2');
const reader = new BitReader(file);

while (!reader.empty()) {
  if (!skipUntilStartCode(reader)) { continue; }

  const startcode = reader.read(8);
  console.log(startcode.toString(16));
  if (startcode === StartCode.SequenceHeaderCode) {
    console.dir(SequenceHeader.from(reader));
  }
}
