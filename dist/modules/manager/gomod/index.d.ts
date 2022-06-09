import { ProgrammingLanguage } from '../../../constants';
import { updateArtifacts } from './artifacts';
import { extractPackageFile } from './extract';
import { updateDependency } from './update';
export declare const language = ProgrammingLanguage.Golang;
export { extractPackageFile, updateDependency, updateArtifacts };
export declare const defaultConfig: {
    fileMatch: string[];
};
export declare const supportedDatasources: string[];
