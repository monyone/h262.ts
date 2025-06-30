import fs from "fs";
import Decoder from "./decoder.mts";

const file = fs.readFileSync('./test.mpeg2');
const decoder = new Decoder();

for (const frame of decoder.decode(file)) {
  process.stdout.write(frame);
}
