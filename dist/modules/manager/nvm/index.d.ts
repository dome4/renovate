import { ProgrammingLanguage } from '../../../constants';
export { extractPackageFile } from './extract';
export declare const language = ProgrammingLanguage.NodeJS;
export declare const defaultConfig: {
    fileMatch: string[];
    versioning: string;
    pinDigests: boolean;
};
export declare const supportedDatasources: string[];
