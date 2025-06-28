import fs from "fs";
import Decoder from "./decoder.mts";

const file = fs.readFileSync('./test.mpeg2');
const decoder = new Decoder();

process.stdout.write(Uint8Array.from(decoder.decode(file)));
