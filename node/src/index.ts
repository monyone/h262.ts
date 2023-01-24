import Decoder from '@monyone/h262.ts';
import fs from 'fs';

const decoder = new Decoder();

const buffer = fs.readFileSync(process.argv[2]);
const { y, u, v } = decoder.decode(buffer)!;

y.forEach((_) => { process.stdout.write(new Uint8Array(_)); })
u.forEach((_) => { process.stdout.write(new Uint8Array(_)); })
v.forEach((_) => { process.stdout.write(new Uint8Array(_)); })