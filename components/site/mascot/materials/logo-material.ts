import * as THREE from "three";

const LOGO_URL = "/assets/images/vector-intelligence-logo.svg";
const WORDMARK_INK = "#101B2A";
// light wordmark so it reads on the graphite chest
const CHEST_INK = "#EEF2F8";
const TEXTURE_WIDTH = 2048;
const MARK_URL = "/assets/images/vector-intelligence-favicon.svg";
// the mark's area inside the icon's 1024 viewBox (MARK_ASPECT in scripts/mascot/badge.py)
const MARK_CROP = { x: 120, y: 309, width: 860, height: 470 };

function toTexture(canvas: HTMLCanvasElement) {
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.flipY = false; // glTF UV convention
  texture.anisotropy = 8;
  return texture;
}

async function loadSvg(svg: string) {
  const image = new Image();
  image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  await image.decode();
  return image;
}

/** Rasterizes the brand mark alone (the icon without the wordmark). */
export async function loadMarkTexture() {
  const source = await (await fetch(MARK_URL)).text();
  const image = await loadSvg(source.replace("<svg ", '<svg width="1024" height="1024" '));
  const canvas = document.createElement("canvas");
  canvas.width = 1024;
  canvas.height = Math.round((1024 * MARK_CROP.height) / MARK_CROP.width);
  canvas.getContext("2d")!.drawImage(image, MARK_CROP.x, MARK_CROP.y, MARK_CROP.width, MARK_CROP.height,
    0, 0, canvas.width, canvas.height);
  return toTexture(canvas);
}

/** Rasterizes the full brand logo from the site's own SVG, with a light wordmark for the dark chest. */
export async function loadLogoTexture() {
  const source = await (await fetch(LOGO_URL)).text();
  const [, , width, height] = source.match(/viewBox="([^"]+)"/)![1].split(/\s+/).map(Number);
  const textureHeight = Math.round((TEXTURE_WIDTH * height) / width);
  const svg = source
    .replace("<svg ", `<svg width="${TEXTURE_WIDTH}" height="${textureHeight}" `)
    .replace(`fill="${WORDMARK_INK}"`, `fill="${CHEST_INK}"`);
  const image = await loadSvg(svg);

  const canvas = document.createElement("canvas");
  canvas.width = TEXTURE_WIDTH;
  canvas.height = textureHeight;
  canvas.getContext("2d")!.drawImage(image, 0, 0, canvas.width, canvas.height);
  return toTexture(canvas);
}

/** Printed, faintly backlit brand logo (graphite chest, back of the head). */
export function createLogoMaterial(texture: THREE.Texture) {
  return new THREE.MeshPhysicalMaterial({
    map: texture,
    emissiveMap: texture,
    emissive: 0xffffff,
    emissiveIntensity: 0.55,
    roughness: 0.3,
    clearcoat: 0.4,
    clearcoatRoughness: 0.28,
    transparent: true,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -2,
  });
}
