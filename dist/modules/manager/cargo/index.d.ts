import { ProgrammingLanguage } from '../../../constants';
import { updateArtifacts } from './artifacts';
import { extractPackageFile } from './extract';
declare const language = ProgrammingLanguage.Rust;
export declare const supportsLockFileMaintenance = true;
export { extractPackageFile, updateArtifacts, language };
export declare const defaultConfig: {
    commitMessageTopic: string;
    fileMatch: string[];
    versioning: string;
    rangeStrategy: string;
};
export declare const supportedDatasources: string[];
