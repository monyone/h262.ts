import Decoder from '@monyone/h262';
import fs from 'fs';

const decoder = new Decoder();

const buffer = fs.readFileSync(process.argv[2]);
console.log(process.argv[2])
decoder.decode(buffer)!;

/*
process.stdout.write(Buffer.from(y));
process.stdout.write(Buffer.from(u));
process.stdout.write(Buffer.from(v));
*/
