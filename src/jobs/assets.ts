export type SkyMode = 'skybox' | 'skymap' | null;

export const skyboxFaces = [
  'front',
  'back',
  'left',
  'right',
  'top',
  'bottom',
] as const;
export type SkyboxFace = (typeof skyboxFaces)[number];

export const jobAssetFiles = {
  scene: 'scene.json',
  octree: 'scene.octree2',
  emittergrid: 'scene.emittergrid',
  skymap: 'skymap',
  skyboxFront: 'skybox.front',
  skyboxBack: 'skybox.back',
  skyboxLeft: 'skybox.left',
  skyboxRight: 'skybox.right',
  skyboxTop: 'skybox.top',
  skyboxBottom: 'skybox.bottom',
} as const;
export type JobAsset = keyof typeof jobAssetFiles;

export function getSkyboxAssetName(face: SkyboxFace): JobAsset {
  return `skybox${face[0].toUpperCase()}${face.slice(1)}` as JobAsset;
}
