import { TerragruntDependencyTypes } from './common';
export declare const keyValueExtractionRegex: RegExp;
export declare function getTerragruntDependencyType(value: string): TerragruntDependencyTypes;
export declare function checkFileContainsDependency(content: string, checkList: string[]): boolean;
