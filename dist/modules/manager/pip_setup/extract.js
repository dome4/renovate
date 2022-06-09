"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.extractPackageFile = void 0;
const pep440_1 = require("@renovatebot/pep440");
const good_enough_parser_1 = require("good-enough-parser");
const regex_1 = require("../../../util/regex");
const pypi_1 = require("../../datasource/pypi");
const python = good_enough_parser_1.lang.createLang('python');
// Optimize regex memory usage when we don't need named groups
function cleanupNamedGroups(regexSource) {
    return regexSource.replace(/\(\?<\w+>/g, '(?:');
}
const rangePattern = cleanupNamedGroups(pep440_1.RANGE_PATTERN);
const versionPattern = `(?:${rangePattern}(?:\\s*,\\s*${rangePattern})*)`;
const depNamePattern = '(?:[a-zA-Z][-_a-zA-Z0-9]*[a-zA-Z0-9])';
const depPattern = [
    '^',
    `(?<depName>${depNamePattern})`,
    `(?<extra>(?:\\[\\s*(?:${depNamePattern}(?:\\s*,\\s*${depNamePattern})*\\s*)\\])?)`,
    `(?<currentValue>${versionPattern})`,
].join('\\s*');
const extractRegex = (0, regex_1.regEx)(depPattern);
// Extract dependency string
function depStringHandler(ctx, token) {
    const depStr = token.value;
    const match = extractRegex.exec(depStr);
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
    const { depName, currentValue } = match.groups;
    const dep = {
        depName,
        currentValue,
        managerData: {
            lineNumber: token.line - 1,
        },
        datasource: pypi_1.PypiDatasource.id,
    };
    return { ...ctx, deps: [...ctx.deps, dep] };
}
// Add `skip-reason` for dependencies annotated
// with "# renovate: ignore" comment
function depSkipHandler(ctx) {
    const dep = ctx.deps[ctx.deps.length - 1];
    const deps = ctx.deps.slice(0, -1);
    deps.push({ ...dep, skipReason: 'ignored' });
    return { ...ctx, deps };
}
const incompleteDepString = good_enough_parser_1.query
    .str(new RegExp(cleanupNamedGroups(depPattern)))
    .op(/^\+|\*$/);
const depString = good_enough_parser_1.query
    .str(new RegExp(cleanupNamedGroups(depPattern)), depStringHandler)
    .opt(good_enough_parser_1.query
    .opt(good_enough_parser_1.query.op(','))
    .comment(/^#\s*renovate\s*:\s*ignore\s*$/, depSkipHandler));
const query = good_enough_parser_1.query.alt(incompleteDepString, depString);
function extractPackageFile(content, _packageFile, _config) {
    const res = python.query(content, query, { deps: [] });
    return res?.deps?.length ? res : null;
}
exports.extractPackageFile = extractPackageFile;
//# sourceMappingURL=extract.js.map