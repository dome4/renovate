import { ProgrammingLanguage } from '../../../constants';
export { extractPackageFile } from '../pip_requirements/extract';
export { updateArtifacts } from './artifacts';
export declare const language = ProgrammingLanguage.Python;
export declare const supportsLockFileMaintenance = true;
export declare const supportedDatasources: string[];
export declare const defaultConfig: {
    fileMatch: any[];
    lockFileMaintenance: {
        enabled: boolean;
        branchTopic: string;
        commitMessageAction: string;
    };
};
