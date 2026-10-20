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

export enum JobAssetType {
  Scene = 'scene',
  Octree = 'octree',
  EmitterGrid = 'emittergrid',
  Skymap = 'skymap',
  SkyboxFront = 'skyboxFront',
  SkyboxBack = 'skyboxBack',
  SkyboxLeft = 'skyboxLeft',
  SkyboxRight = 'skyboxRight',
  SkyboxTop = 'skyboxTop',
  SkyboxBottom = 'skyboxBottom',
}

export function getAssetFilename(assetType: JobAssetType, fileType?: string) {
  switch (assetType) {
    case JobAssetType.Skymap:
    case JobAssetType.SkyboxFront:
    case JobAssetType.SkyboxBack:
    case JobAssetType.SkyboxLeft:
    case JobAssetType.SkyboxRight:
    case JobAssetType.SkyboxTop:
    case JobAssetType.SkyboxBottom: {
      if (!fileType) {
        throw new Error(`Missing file type for asset type ${assetType}`);
      }
      return `${assetType}.${fileType.toLowerCase()}`;
    }
    case JobAssetType.Scene:
      return 'scene.json';
    case JobAssetType.Octree:
      return 'scene.octree2';
    case JobAssetType.EmitterGrid:
      return 'scene.emittergrid';
  }
}

export enum SkyboxAssetKey {
  SkyboxFront = 'skyboxFront',
  SkyboxBack = 'skyboxBack',
  SkyboxLeft = 'skyboxLeft',
  SkyboxRight = 'skyboxRight',
  SkyboxTop = 'skyboxTop',
  SkyboxBottom = 'skyboxBottom',
}

export function getSkyboxAssetKey(face: SkyboxFace): SkyboxAssetKey {
  return `skybox${face[0].toUpperCase()}${face.slice(1)}` as SkyboxAssetKey;
}

export enum SkymapFileType {
  HDR = 'hdr',
  PNG = 'png',
  JPG = 'jpg',
}
