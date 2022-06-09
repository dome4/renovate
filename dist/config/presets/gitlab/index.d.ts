import type { Preset, PresetConfig } from '../types';
export declare const Endpoint = "https://gitlab.com/api/v4/";
export declare function fetchJSONFile(repo: string, fileName: string, endpoint: string, tag?: string | null): Promise<Preset>;
export declare function getPresetFromEndpoint(repo: string, presetName: string, presetPath?: string, endpoint?: string, tag?: string | null): Promise<Preset | undefined>;
export declare function getPreset({ repo, presetPath, presetName, tag, }: PresetConfig): Promise<Preset | undefined>;
