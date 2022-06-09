import type { FetchPresetConfig, Preset } from './types';
export declare const PRESET_DEP_NOT_FOUND = "dep not found";
export declare const PRESET_INVALID = "invalid preset";
export declare const PRESET_INVALID_JSON = "invalid preset JSON";
export declare const PRESET_NOT_FOUND = "preset not found";
export declare const PRESET_PROHIBITED_SUBPRESET = "prohibited sub-preset";
export declare const PRESET_RENOVATE_CONFIG_NOT_FOUND = "preset renovate-config not found";
export declare function fetchPreset({ repo, filePreset, presetPath, endpoint: _endpoint, tag, fetch, }: FetchPresetConfig): Promise<Preset | undefined>;
export declare function parsePreset(content: string): Preset;
