"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.matchesHelmValuesInlineImage = exports.matchesHelmValuesDockerHeuristic = void 0;
const object_1 = require("../../../util/object");
const regex_1 = require("../../../util/regex");
const parentKeyRe = (0, regex_1.regEx)(/image$/i);
/**
 * Type guard to determine whether a given partial Helm values.yaml object potentially
 * defines a Helm Docker dependency.
 *
 * There is no exact standard of how Docker dependencies are defined in Helm
 * values.yaml files (as of February 26th 2021), this function defines a
 * heuristic based on the most commonly used format in the Helm charts:
 *
 * image:
 *   repository: 'something'
 *   tag: v1.0.0
 * renovateImage:
 *   repository: 'something'
 *   tag: v1.0.0
 */
function matchesHelmValuesDockerHeuristic(parentKey, data) {
    return !!(parentKeyRe.test(parentKey) &&
        data &&
        typeof data === 'object' &&
        (0, object_1.hasKey)('repository', data) &&
        (0, object_1.hasKey)('tag', data));
}
exports.matchesHelmValuesDockerHeuristic = matchesHelmValuesDockerHeuristic;
function matchesHelmValuesInlineImage(parentKey, data) {
    return !!(parentKeyRe.test(parentKey) && data && typeof data === 'string');
}
exports.matchesHelmValuesInlineImage = matchesHelmValuesInlineImage;
//# sourceMappingURL=util.js.map