export default class BitStream {
  private bits: number[];
  private data: Uint8Array;
  private offset: number;

  public constructor(data: ArrayBuffer) {
    this.bits = [];
    this.data = new Uint8Array(data);
    this.offset = 0;
  }

  public empty(): boolean {
    return this.offset >= this.data.length && this.bits.length === 0;
  }

  public bitLength(): number {
    return this.bits.length + (this.data.length - this.offset) * 8;
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

  private poll(): number {
    if (this.empty()) { throw Error('Empty BitStream Polled!'); }
    if (this.bits.length === 0) { this.fill(); }
    return this.bits.shift() ?? 0
  }

  public skipBits(length: number): void {
    while (length > 0) {
      this.poll();
      length -= 1;
    }
  }

  public readBits(length: number): number {
    let bits = 0;
    while (length > 0) {
      bits *= 2;
      bits += this.poll();
      length -= 1;
    }
    return bits;
  }

  public readUint8(): number {
    return this.readBits(8);
  }

  public readUint16(): number {
    return this.readBits(16);
  }

  public readUint24(): number {
    return this.readBits(24);
  }

  public readUint32(): number {
    return this.readBits(32);
  }

  public readBool() {
    return this.readBits(1) === 1;
  }

  public retainBits(value: number, length: number) {
    for (let i = 0; i < length; i++) {
      const bit = value % 2;
      this.bits.unshift(bit);
      value = Math.floor(value / 2);
    }
  }

  public retainBool(value: boolean) {
    this.retainBits(value ? 1 : 0, 1);
  }

  public retainUint8(value: number) {
    this.retainBits(value, 8);
  }

  public retainUint16(value: number) {
    this.retainBits(value, 16);
  }

  public retainUint24(value: number) {
    this.retainBits(value, 24);
  }

  public retainUint32(value: number) {
    this.retainBits(value, 32);
  }

  public skipUntilAligned() {
    this.skipBits(this.bits.length % 8);
  }

  public peekBits(length: number) {
    const value = this.readBits(length);
    this.retainBits(value, length);
    return value;
  }

  public peekBool() {
    const value = this.readBool();
    this.retainBool(value);
    return value;
  }

  public peekUint8() {
    const value = this.readUint8();
    this.retainUint8(value);
    return value;
  }

  public peekUint16() {
    const value = this.readUint16();
    this.retainUint16(value);
    return value;
  }

  public peekUint24() {
    const value = this.readUint24();
    this.retainUint24(value);
    return value;
  }

  public peekUint32() {
    const value = this.readUint32();
    this.retainUint32(value);
    return value;
  }
}