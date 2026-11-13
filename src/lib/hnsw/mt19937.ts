// std::mt19937_64, the generator vecdex draws node levels from. Reproducing it exactly is what
// lets the page build, from the same seed, the same graph vecdex builds.

const N = 312;
const M = 156;
const MATRIX_A = 0xb5026f5aa96619e9n;
const UPPER_MASK = 0xffffffff80000000n;
const LOWER_MASK = 0x7fffffffn;

export class Mt19937_64 {
  private readonly state = new BigUint64Array(N);
  private index = N;

  constructor(seed: bigint) {
    this.state[0] = BigInt.asUintN(64, seed);
    for (let i = 1; i < N; i++) {
      const prev = this.state[i - 1] ?? 0n;
      this.state[i] = BigInt.asUintN(64, 6364136223846793005n * (prev ^ (prev >> 62n)) + BigInt(i));
    }
  }

  /** The next 64-bit output, as std::mt19937_64::operator() returns it. */
  next(): bigint {
    if (this.index >= N) this.twist();
    let x = this.state[this.index++] ?? 0n;
    x ^= (x >> 29n) & 0x5555555555555555n;
    x ^= (x << 17n) & 0x71d67fffeda60000n;
    x ^= (x << 37n) & 0xfff7eee000000000n;
    x ^= x >> 43n;
    return BigInt.asUintN(64, x);
  }

  private twist(): void {
    const s = this.state;
    for (let i = 0; i < N; i++) {
      const x = ((s[i] ?? 0n) & UPPER_MASK) | ((s[(i + 1) % N] ?? 0n) & LOWER_MASK);
      let xA = x >> 1n;
      if (x & 1n) xA ^= MATRIX_A;
      s[i] = (s[(i + M) % N] ?? 0n) ^ xA;
    }
    this.index = 0;
  }
}
