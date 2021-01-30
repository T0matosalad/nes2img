import { PNGImage } from "https://raw.githubusercontent.com/d2verb/dpng/master/mod.ts";

function findCROM(rom: Uint8Array) {
  // 4: Size of PRG ROM in 16 KB units
  const promSize = rom[4];

  // 5: Size of CHR ROM in 8 KB units (Value 0 means the board uses CHR RAM)
  const cromSize = rom[5];
  if (cromSize == 0) {
    throw new Error("CHR ROM not found.");
  }

  // Header (16 bytes)
  // Trainer, if present (0 or 512 bytes)
  let cromStart = 16 + 16384 * promSize;

  // 76543210
  // ||||||||
  // |||||||+- Mirroring: 0: horizontal (vertical arrangement) (CIRAM A10 = PPU A11)
  // |||||||              1: vertical (horizontal arrangement) (CIRAM A10 = PPU A10)
  // ||||||+-- 1: Cartridge contains battery-backed PRG RAM ($6000-7FFF) or other persistent memory
  // |||||+--- 1: 512-byte trainer at $7000-$71FF (stored before PRG data)
  // ||||+---- 1: Ignore mirroring control or above mirroring bit; instead provide four-screen VRAM
  // ++++----- Lower nybble of mapper number
  if ((rom[6] & 0b00000100) != 0) {
    // Trainer, if present (0 or 512 bytes)
    cromStart += 512;
  }

  // CHR ROM data, if present (8192 * y bytes)
  const cromEnd = cromStart + 8192 * cromSize;
  const crom = rom.slice(cromStart, cromEnd);

  return crom;
}

function genSprite(data: Uint8Array) {
  const sprite = new Array(8).fill(0).map(() => new Array(8).fill(0));

  // Channel A
  for (let y = 0; y < 8; y++) {
    const line = data[y];
    for (let x = 0; x < 8; x++) {
      const pixel = (line >> x) & 1;
      // A = pixel
      sprite[y][x] = pixel;
    }
  }

  // Channel B
  for (let y = 0; y < 8; y++) {
    const line = data[y + 8];
    for (let x = 0; x < 8; x++) {
      const pixel = (line >> x) & 1;
      // B = pixel
      // sprite[y][x] = 0bBA
      sprite[y][x] |= pixel << 1;
    }
  }

  return sprite;
}

function spriteToPng(sprite: number[][], filename: string) {
  const png = new PNGImage(8, 8);
  const rgb = [
    png.createRGBColor({ r: 211, g: 211, b: 211, a: 1 }),
    png.createRGBColor({ r: 169, g: 169, b: 169, a: 1 }),
    png.createRGBColor({ r: 105, g: 105, b: 105, a: 1 }),
    png.createRGBColor({ r: 0, g: 0, b: 0, a: 1 }),
  ];

  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < 8; x++) {
      png.setPixel(x, y, rgb[sprite[y][x]]);
    }
  }

  Deno.writeFileSync(filename, png.getBuffer());
}

Deno.readTextFile(Deno.args[0]).then((content: string) => {
  const rom = new TextEncoder().encode(content);
  const crom = findCROM(rom);

  for (let i = 0; i < crom.length; i += 16) {
    const sprite = genSprite(crom.slice(i, i + 16));
    const no = i / 16;
    spriteToPng(sprite, "sprites/sprite" + no + ".png");
  }
});
