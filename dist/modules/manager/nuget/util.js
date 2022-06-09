"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getConfiguredRegistries = exports.getDefaultRegistries = exports.getRandomString = void 0;
const tslib_1 = require("tslib");
const crypto_random_string_1 = tslib_1.__importDefault(require("crypto-random-string"));
const upath_1 = tslib_1.__importDefault(require("upath"));
const xmldoc_1 = require("xmldoc");
const logger_1 = require("../../../logger");
const fs_1 = require("../../../util/fs");
const regex_1 = require("../../../util/regex");
const nuget_1 = require("../../datasource/nuget");
async function readFileAsXmlDocument(file) {
    try {
        return new xmldoc_1.XmlDocument(await (0, fs_1.readLocalFile)(file, 'utf8'));
    }
    catch (err) {
        logger_1.logger.debug({ err }, `failed to parse '${file}' as XML document`);
        return undefined;
    }
}
/* istanbul ignore next */
function getRandomString() {
    return (0, crypto_random_string_1.default)({ length: 16 });
}
exports.getRandomString = getRandomString;
const defaultRegistries = nuget_1.defaultRegistryUrls.map((registryUrl) => ({ url: registryUrl }));
function getDefaultRegistries() {
    return [...defaultRegistries];
}
exports.getDefaultRegistries = getDefaultRegistries;
async function getConfiguredRegistries(packageFile) {
    // Valid file names taken from https://github.com/NuGet/NuGet.Client/blob/f64621487c0b454eda4b98af853bf4a528bef72a/src/NuGet.Core/NuGet.Configuration/Settings/Settings.cs#L34
    const nuGetConfigFileNames = ['nuget.config', 'NuGet.config', 'NuGet.Config'];
    // normalize paths, otherwise startsWith can fail because of path delimitter mismatch
    const nuGetConfigPath = await (0, fs_1.findUpLocal)(nuGetConfigFileNames, upath_1.default.dirname(packageFile));
    if (!nuGetConfigPath) {
        return undefined;
    }
    logger_1.logger.debug({ nuGetConfigPath }, 'found NuGet.config');
    const nuGetConfig = await readFileAsXmlDocument(nuGetConfigPath);
    if (!nuGetConfig) {
        return undefined;
    }
    const packageSources = nuGetConfig.childNamed('packageSources');
    if (!packageSources) {
        return undefined;
    }
    const registries = getDefaultRegistries();
    for (const child of packageSources.children) {
        if (child.type === 'element') {
            if (child.name === 'clear') {
                logger_1.logger.debug(`clearing registry URLs`);
                registries.length = 0;
            }
            else if (child.name === 'add') {
                const isHttpUrl = (0, regex_1.regEx)(/^https?:\/\//i).test(child.attr.value);
                if (isHttpUrl) {
                    let registryUrl = child.attr.value;
                    if (child.attr.protocolVersion) {
                        registryUrl += `#protocolVersion=${child.attr.protocolVersion}`;
                    }
                    logger_1.logger.debug({ registryUrl }, 'adding registry URL');
                    registries.push({
                        name: child.attr.key,
                        url: registryUrl,
                    });
                }
                else {
                    logger_1.logger.debug({ registryUrl: child.attr.value }, 'ignoring local registry URL');
                }
            }
            // child.name === 'remove' not supported
        }
    }
    return registries;
}
exports.getConfiguredRegistries = getConfiguredRegistries;
//# sourceMappingURL=util.js.map