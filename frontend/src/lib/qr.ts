/**
 * Lightweight, offline, zero-dependency QR code SVG generator for Rentu.
 * Generates valid ISO/IEC 18004 QR codes entirely in-browser without sending secrets to any external service.
 */

// Galois field tables for GF(256) with primitive polynomial 0x11D
const EXP: number[] = new Array(256);
const LOG: number[] = new Array(256);
(() => {
  let x = 1;
  for (let i = 0; i < 255; i++) {
    EXP[i] = x;
    LOG[x] = i;
    x = (x << 1) ^ (x >= 128 ? 0x11d : 0);
  }
  EXP[255] = EXP[0];
})();

function gfMul(x: number, y: number): number {
  if (x === 0 || y === 0) return 0;
  return EXP[(LOG[x] + LOG[y]) % 255];
}

function polyMul(p1: number[], p2: number[]): number[] {
  const result = new Array(p1.length + p2.length - 1).fill(0);
  for (let i = 0; i < p1.length; i++) {
    for (let j = 0; j < p2.length; j++) {
      result[i + j] ^= gfMul(p1[i], p2[j]);
    }
  }
  return result;
}

function getGeneratorPoly(numEcBytes: number): number[] {
  let poly = [1];
  for (let i = 0; i < numEcBytes; i++) {
    poly = polyMul(poly, [1, EXP[i]]);
  }
  return poly;
}

function computeEcBytes(data: number[], numEcBytes: number): number[] {
  const gen = getGeneratorPoly(numEcBytes);
  const result = [...data, ...new Array(numEcBytes).fill(0)];
  for (let i = 0; i < data.length; i++) {
    const factor = result[i];
    if (factor !== 0) {
      for (let j = 0; j < gen.length; j++) {
        result[i + j] ^= gfMul(gen[j], factor);
      }
    }
  }
  return result.slice(data.length);
}

// Version configs for byte mode, low error correction
interface QrVersion {
  version: number;
  size: number;
  totalBytes: number;
  dataBytes: number;
  ecBytes: number;
  alignment: number[];
}

const QR_VERSIONS: QrVersion[] = [
  { version: 1, size: 21, totalBytes: 26, dataBytes: 19, ecBytes: 7, alignment: [] },
  { version: 2, size: 25, totalBytes: 44, dataBytes: 34, ecBytes: 10, alignment: [6, 18] },
  { version: 3, size: 29, totalBytes: 70, dataBytes: 55, ecBytes: 15, alignment: [6, 22] },
  { version: 4, size: 33, totalBytes: 100, dataBytes: 80, ecBytes: 20, alignment: [6, 26] },
  { version: 5, size: 37, totalBytes: 134, dataBytes: 108, ecBytes: 26, alignment: [6, 30] },
];

function selectVersion(dataLength: number): QrVersion {
  // Byte mode header: 4 bits mode + 8 bits length = 12 bits -> ~2 bytes overhead
  const needed = dataLength + 3;
  for (const v of QR_VERSIONS) {
    if (v.dataBytes >= needed) return v;
  }
  return QR_VERSIONS[QR_VERSIONS.length - 1];
}

export function generateQrMatrix(text: string): boolean[][] {
  const utf8Bytes: number[] = [];
  for (let i = 0; i < text.length; i++) {
    let c = text.charCodeAt(i);
    if (c < 128) utf8Bytes.push(c);
    else if (c < 2048) {
      utf8Bytes.push(192 | (c >> 6));
      utf8Bytes.push(128 | (c & 63));
    } else {
      utf8Bytes.push(224 | (c >> 12));
      utf8Bytes.push(128 | ((c >> 6) & 63));
      utf8Bytes.push(128 | (c & 63));
    }
  }

  const ver = selectVersion(utf8Bytes.length);
  const size = ver.size;

  // Encode byte mode data stream: Mode indicator 0100 (byte), count indicator 8 bits
  let bits = '0100';
  bits += utf8Bytes.length.toString(2).padStart(8, '0');
  for (const b of utf8Bytes) {
    bits += b.toString(2).padStart(8, '0');
  }

  // Terminator
  const maxBits = ver.dataBytes * 8;
  if (bits.length + 4 <= maxBits) bits += '0000';
  else bits += '0'.repeat(maxBits - bits.length);

  // Pad to multiple of 8
  while (bits.length % 8 !== 0) bits += '0';

  // Pad bytes 0xEC, 0x11
  const padBytes = [0xec, 0x11];
  let padIdx = 0;
  while (bits.length < maxBits) {
    bits += padBytes[padIdx % 2].toString(2).padStart(8, '0');
    padIdx++;
  }

  const dataBytes: number[] = [];
  for (let i = 0; i < bits.length; i += 8) {
    dataBytes.push(parseInt(bits.slice(i, i + 8), 2));
  }

  const ecBytes = computeEcBytes(dataBytes, ver.ecBytes);
  const allCodewords = [...dataBytes, ...ecBytes];

  // Initialize grid: true = black, false = white, null = unpopulated
  const grid: (boolean | null)[][] = Array.from({ length: size }, () => new Array(size).fill(null));
  const isFunction: boolean[][] = Array.from({ length: size }, () => new Array(size).fill(false));

  const setModule = (r: number, c: number, val: boolean) => {
    grid[r][c] = val;
    isFunction[r][c] = true;
  };

  // 1. Finder patterns (top-left, top-right, bottom-left)
  const drawFinder = (top: number, left: number) => {
    for (let r = -1; r <= 7; r++) {
      for (let c = -1; c <= 7; c++) {
        const row = top + r;
        const col = left + c;
        if (row >= 0 && row < size && col >= 0 && col < size) {
          const isBlack = (r >= 0 && r <= 6 && (c === 0 || c === 6)) ||
                          (c >= 0 && c <= 6 && (r === 0 || r === 6)) ||
                          (r >= 2 && r <= 4 && c >= 2 && c <= 4);
          setModule(row, col, isBlack);
        }
      }
    }
  };
  drawFinder(0, 0);
  drawFinder(0, size - 7);
  drawFinder(size - 7, 0);

  // 2. Timing patterns
  for (let i = 8; i < size - 8; i++) {
    setModule(6, i, i % 2 === 0);
    setModule(i, 6, i % 2 === 0);
  }

  // 3. Alignment patterns (version >= 2)
  if (ver.alignment.length > 0) {
    const coords = ver.alignment;
    for (const r of coords) {
      for (const c of coords) {
        if (isFunction[r][c]) continue;
        for (let dr = -2; dr <= 2; dr++) {
          for (let dc = -2; dc <= 2; dc++) {
            const isBlack = Math.abs(dr) === 2 || Math.abs(dc) === 2 || (dr === 0 && dc === 0);
            setModule(r + dr, c + dc, isBlack);
          }
        }
      }
    }
  }

  // Dark module
  setModule(4 * ver.version + 9, 8, true);

  // 4. Reserve format bits around finder patterns
  for (let i = 0; i < 9; i++) {
    if (i !== 6) {
      if (!isFunction[8][i]) isFunction[8][i] = true;
      if (!isFunction[i][8]) isFunction[i][8] = true;
    }
  }
  for (let i = 0; i < 8; i++) {
    if (!isFunction[8][size - 1 - i]) isFunction[8][size - 1 - i] = true;
    if (!isFunction[size - 1 - i][8]) isFunction[size - 1 - i][8] = true;
  }

  // 5. Data placement (zigzag right to left, 2 columns at a time)
  let bitIdx = 0;
  let allBits = '';
  for (const b of allCodewords) {
    allBits += b.toString(2).padStart(8, '0');
  }

  let upward = true;
  for (let right = size - 1; right > 0; right -= 2) {
    if (right === 6) right--; // skip timing column
    const rows = upward
      ? Array.from({ length: size }, (_, i) => size - 1 - i)
      : Array.from({ length: size }, (_, i) => i);

    for (const r of rows) {
      for (const c of [right, right - 1]) {
        if (!isFunction[r][c]) {
          const bitVal = bitIdx < allBits.length ? allBits[bitIdx] === '1' : false;
          // Apply standard mask pattern 0: (r + c) % 2 === 0
          const mask = (r + c) % 2 === 0;
          grid[r][c] = mask ? !bitVal : bitVal;
          bitIdx++;
        }
      }
    }
    upward = !upward;
  }

  // 6. Format bits (Error Correction L = 01, Mask 0 = 000 -> 01000 with BCH code = 111011111000100 ^ 101010000010010 = 010001111010110)
  const formatStr = '010001111010110';
  let fIdx = 0;
  for (let i = 0; i <= 8; i++) {
    if (i !== 6) {
      grid[8][i] = formatStr[fIdx] === '1';
      fIdx++;
    }
  }
  for (let i = 7; i >= 0; i--) {
    if (i !== 6) {
      grid[i][8] = formatStr[fIdx] === '1';
      fIdx++;
    }
  }

  fIdx = 0;
  for (let i = size - 1; i >= size - 8; i--) {
    grid[i][8] = formatStr[fIdx] === '1';
    fIdx++;
  }
  for (let i = size - 7; i < size; i++) {
    grid[8][i] = formatStr[fIdx] === '1';
    fIdx++;
  }

  return grid.map(row => row.map(v => v === true));
}

/**
 * Generates an inline Data URI SVG for completely offline QR display
 */
export function generateQrDataUri(text: string): string {
  try {
    const matrix = generateQrMatrix(text);
    const size = matrix.length;
    const padding = 3;
    const totalSize = size + padding * 2;

    let paths = '';
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        if (matrix[r][c]) {
          paths += `M${c + padding},${r + padding}h1v1h-1z `;
        }
      }
    }

    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${totalSize} ${totalSize}" shape-rendering="crispEdges"><rect width="${totalSize}" height="${totalSize}" fill="#ffffff"/><path d="${paths}" fill="#0f172a"/></svg>`;
    return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
  } catch (err) {
    console.error('Failed to generate offline QR code:', err);
    return '';
  }
}
