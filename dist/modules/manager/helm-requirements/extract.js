"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.extractPackageFile = void 0;
const tslib_1 = require("tslib");
const is_1 = tslib_1.__importDefault(require("@sindresorhus/is"));
const js_yaml_1 = require("js-yaml");
const logger_1 = require("../../../logger");
const helm_1 = require("../../datasource/helm");
function extractPackageFile(content, fileName, config) {
    let deps = [];
    // TODO: fix type
    let doc;
    try {
        doc = (0, js_yaml_1.load)(content, { json: true }); // TODO #9610
    }
    catch (err) {
        logger_1.logger.debug({ fileName }, 'Failed to parse helm requirements.yaml');
        return null;
    }
    if (!(doc && is_1.default.array(doc.dependencies))) {
        logger_1.logger.debug({ fileName }, 'requirements.yaml has no dependencies');
        return null;
    }
    deps = doc.dependencies.map((dep) => {
        let currentValue; // Remove when #9610 has been implemented
        switch (typeof dep.version) {
            case 'number':
                currentValue = String(dep.version);
                break;
            case 'string':
                currentValue = dep.version;
        }
        const res = {
            depName: dep.name,
            currentValue,
        };
        if (!res.depName) {
            res.skipReason = 'invalid-name';
            return res;
        }
        if (!res.currentValue) {
            res.skipReason = 'invalid-version';
            return res;
        }
        if (!dep.repository) {
            res.skipReason = 'no-repository';
            return res;
        }
        res.registryUrls = [dep.repository];
        if (dep.repository.startsWith('@') || dep.repository.startsWith('alias:')) {
            const repoWithPrefixRemoved = dep.repository.slice(dep.repository[0] === '@' ? 1 : 6);
            const alias = config.aliases?.[repoWithPrefixRemoved];
            if (alias) {
                res.registryUrls = [alias];
                return res;
            }
            res.skipReason = 'placeholder-url';
        }
        else {
            try {
                const url = new URL(dep.repository);
                if (url.protocol === 'file:') {
                    res.skipReason = 'local-dependency';
                }
            }
            catch (err) {
                logger_1.logger.debug({ err }, 'Error parsing url');
                res.skipReason = 'invalid-url';
            }
        }
        return res;
    });
    const res = {
        deps,
        datasource: helm_1.HelmDatasource.id,
    };
    return res;
}
exports.extractPackageFile = extractPackageFile;
//# sourceMappingURL=extract.js.map