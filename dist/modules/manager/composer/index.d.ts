import { ProgrammingLanguage } from '../../../constants';
import { updateArtifacts } from './artifacts';
import { extractPackageFile } from './extract';
import { getRangeStrategy } from './range';
import { updateLockedDependency } from './update-locked';
declare const language = ProgrammingLanguage.PHP;
export declare const supportsLockFileMaintenance = true;
export { extractPackageFile, updateArtifacts, language, getRangeStrategy, updateLockedDependency, };
export declare const defaultConfig: {
    fileMatch: string[];
    versioning: string;
};
export declare const supportedDatasources: string[];
