import { ProgrammingLanguage } from '../../../constants';
import { extractAllPackageFiles, extractPackageFile } from './extract';
declare const language = ProgrammingLanguage.Docker;
export { extractAllPackageFiles, extractPackageFile, language };
export declare const defaultConfig: {
    fileMatch: string[];
};
export declare const supportedDatasources: string[];
