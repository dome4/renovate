"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.readOnlyIssueBody = void 0;
const regex_1 = require("../../../util/regex");
function readOnlyIssueBody(body) {
    return body
        .replace(' only once you click their checkbox below', '')
        .replace(' unless you click a checkbox below', '')
        .replace(' To discard all commits and start over, click on a checkbox.', '')
        .replace((0, regex_1.regEx)(/ Click (?:on |)a checkbox.*\./g), '')
        .replace((0, regex_1.regEx)(/\[ ] <!-- \w*-branch.*-->/g), '');
}
exports.readOnlyIssueBody = readOnlyIssueBody;
exports.default = readOnlyIssueBody;
//# sourceMappingURL=read-only-issue-body.js.map