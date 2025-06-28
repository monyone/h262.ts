export default class BitReader {
  private bits: number[];
  private data: Uint8Array;
  private offset: number;

  public constructor(data: Uint8Array) {
    this.bits = [];
    this.data = data;
    this.offset = 0;
  }

  public empty(): boolean {
    return this.offset >= this.data.length && this.bits.length === 0;
  }

  private fill(): void {
    if (this.offset >= this.data.length) { return; }
    this.bits.push((this.data[this.offset] & 0b10000000) >> 7);
    this.bits.push((this.data[this.offset] & 0b01000000) >> 6);
    this.bits.push((this.data[this.offset] & 0b00100000) >> 5);
    this.bits.push((this.data[this.offset] & 0b00010000) >> 4);
    this.bits.push((this.data[this.offset] & 0b00001000) >> 3);
    this.bits.push((this.data[this.offset] & 0b00000100) >> 2);
    this.bits.push((this.data[this.offset] & 0b00000010) >> 1);
    this.bits.push((this.data[this.offset] & 0b00000001) >> 0);
    this.offset += 1;
  }

  private fulfill(bits: number): void {
    while (this.offset < this.data.byteLength && this.bits.length < bits) {
      this.fill();
    }
    if (this.bits.length < bits) { throw new Error('EOF Exception'); }
  }

  public skip(bits: number): void {
    this.fulfill(bits);
    this.bits.splice(0, bits);
  }

  public skipUntilAligned() {
    this.skip(this.bits.length % 8);
  }

  public read(bits: number): number {
    this.fulfill(bits);
    let result = 0;
    for (let i = 0; i < bits; i++) {
      result *= 2;
      result += this.bits[i];
    }
    this.bits.splice(0, bits);
    return result;
  }

  public peek(bits: number): number {
    this.fulfill(bits);
    let result = 0;
    for (let i = 0; i < bits; i++) {
      result *= 2;
      result += this.bits[i];
    }
    return result;
  }
}

export const bool = (value: number): boolean => {
  return value !== 0;
}
export const array = (length: number, bits: number, reader: BitReader): number[] => {
  const result: number[] = [];
  for (let i = 0; i < length; i++) {
    result.push(reader.read(bits));
  }
  return result;
}
