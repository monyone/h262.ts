import BitReader from "./reader.mts";

export default class BinaryTrie<T> {
  #value: T | null = null;
  #children: [BinaryTrie<T> | null, BinaryTrie<T> | null] = [null, null];

  public get isLeaf(): boolean {
    return this.#value != null;
  }

  public append(value: T, code: number, length: number): void {
    if (length === 0) {
      this.#value = value;
      return;
    }

    const next = (code & (1 << (length - 1))) >> (length - 1);
    if (this.#children[next] == null) {
      this.#children[next] = new BinaryTrie();
    }

    this.#children[next]!.append(value, code & ((1 << (length - 1)) - 1), length - 1);
  }

  public get(stream: BitReader): T | null {
    if (this.isLeaf) { return this.#value; }
    return this.#children[stream.read(1)]?.get(stream) ?? null;
  }
}
