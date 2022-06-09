"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.presets = void 0;
exports.presets = {
    additionalBranchPrefix: {
        description: 'Backwards-compatibility preset to restore additionalBranchPrefix settings for multiple managers which were removed in v25',
        buildkite: {
            additionalBranchPrefix: 'buildkite-',
        },
        cargo: {
            additionalBranchPrefix: 'rust-',
        },
        docker: {
            additionalBranchPrefix: 'docker-',
        },
        homebrew: {
            additionalBranchPrefix: 'homebrew-',
        },
        packageRules: [
            {
                matchDatasources: ['helm'],
                additionalBranchPrefix: 'helm-',
            },
        ],
    },
};
//# sourceMappingURL=compatibility.js.map