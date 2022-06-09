import { ProgrammingLanguage } from '../../../constants';
import { updateArtifacts } from './artifacts';
import { extractPackageFile } from './extract';
import { getRangeStrategy } from './range';
import { updateLockedDependency } from './update-locked';
declare const language = ProgrammingLanguage.Ruby;
export declare const supportsLockFileMaintenance = true;
export { extractPackageFile, // Mandatory unless extractAllPackageFiles is used instead
updateArtifacts, // Optional
getRangeStrategy, // Optional
language, // Optional
updateLockedDependency, };
export declare const defaultConfig: {
    fileMatch: string[];
    versioning: string;
};
export declare const supportedDatasources: string[];
