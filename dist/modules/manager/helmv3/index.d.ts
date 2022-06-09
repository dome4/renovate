export { updateArtifacts } from './artifacts';
export { extractPackageFile } from './extract';
export { bumpPackageVersion } from './update';
export declare const supportsLockFileMaintenance = true;
export declare const defaultConfig: {
    aliases: {
        stable: string;
    };
    commitMessageTopic: string;
    fileMatch: string[];
};
export declare const supportedDatasources: string[];
