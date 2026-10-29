import * as THREE from "three";

const LOGO_URL = "/assets/images/vector-intelligence-logo.svg";
const WORDMARK_INK = "#101B2A";
// light wordmark so it reads on the graphite chest
const CHEST_INK = "#EEF2F8";
const TEXTURE_WIDTH = 2048;

/** Rasterizes the full brand logo from the site's own SVG into a texture. */
export async function loadLogoTexture() {
  const source = await (await fetch(LOGO_URL)).text();
  const [, , width, height] = source.match(/viewBox="([^"]+)"/)![1].split(/\s+/).map(Number);
  const textureHeight = Math.round((TEXTURE_WIDTH * height) / width);
  const svg = source
    .replace("<svg ", `<svg width="${TEXTURE_WIDTH}" height="${textureHeight}" `)
    .replace(`fill="${WORDMARK_INK}"`, `fill="${CHEST_INK}"`);
  const image = new Image();
  image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  await image.decode();

  const canvas = document.createElement("canvas");
  canvas.width = TEXTURE_WIDTH;
  canvas.height = textureHeight;
  canvas.getContext("2d")!.drawImage(image, 0, 0, canvas.width, canvas.height);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.flipY = false; // glTF UV convention
  texture.anisotropy = 8;
  return texture;
}

/** Printed, faintly backlit brand logo on the graphite chest. */
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
