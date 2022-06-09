import { ProgrammingLanguage } from '../../../constants';
import { extractPackageFile } from './extract';
declare const language = ProgrammingLanguage.Docker;
export { extractPackageFile, language };
export declare const defaultConfig: {
    fileMatch: string[];
};
export declare const supportedDatasources: string[];
