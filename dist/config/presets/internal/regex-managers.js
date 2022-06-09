"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.presets = void 0;
exports.presets = {
    dockerfileVersions: {
        description: 'Update _VERSION variables in Dockerfiles',
        regexManagers: [
            {
                fileMatch: ['(^|/|\\.)Dockerfile$', '(^|/)Dockerfile[^/]*$'],
                matchStrings: [
                    '# renovate: datasource=(?<datasource>[a-z-]+?) depName=(?<depName>[^\\s]+?)(?: (lookupName|packageName)=(?<packageName>[^\\s]+?))?(?: versioning=(?<versioning>[a-z-0-9]+?))?\\s(?:ENV|ARG) .+?_VERSION="?(?<currentValue>.+?)"?\\s',
                ],
            },
        ],
    },
};
//# sourceMappingURL=regex-managers.js.map