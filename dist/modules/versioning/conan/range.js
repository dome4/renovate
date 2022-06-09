"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.bumpRange = exports.widenRange = exports.replaceRange = exports.fixParsedRange = exports.getPatch = exports.getMinor = exports.getMajor = void 0;
const tslib_1 = require("tslib");
const semver = tslib_1.__importStar(require("semver"));
const semver_utils_1 = require("semver-utils");
const logger_1 = require("../../../logger");
const common_1 = require("./common");
// always include prereleases
function getMajor(version) {
    const cleanedVersion = (0, common_1.cleanVersion)(version);
    const options = (0, common_1.getOptions)(version);
    options.includePrerelease = true;
    const cleanerVersion = (0, common_1.makeVersion)(cleanedVersion, options);
    if (typeof cleanerVersion === 'string') {
        return Number(cleanerVersion.split('.')[0]);
    }
    return null;
}
exports.getMajor = getMajor;
// always include prereleases
function getMinor(version) {
    const cleanedVersion = (0, common_1.cleanVersion)(version);
    const options = (0, common_1.getOptions)(version);
    options.includePrerelease = true;
    const cleanerVersion = (0, common_1.makeVersion)(cleanedVersion, options);
    if (typeof cleanerVersion === 'string') {
        return Number(cleanerVersion.split('.')[1]);
    }
    return null;
}
exports.getMinor = getMinor;
// always include prereleases
function getPatch(version) {
    const cleanedVersion = (0, common_1.cleanVersion)(version);
    const options = (0, common_1.getOptions)(version);
    options.includePrerelease = true;
    const cleanerVersion = (0, common_1.makeVersion)(cleanedVersion, options);
    if (typeof cleanerVersion === 'string') {
        const newVersion = semver.valid(semver.coerce(cleanedVersion, options), options);
        return Number(newVersion?.split('.')[2]);
    }
    return null;
}
exports.getPatch = getPatch;
function fixParsedRange(range) {
    const ordValues = [];
    // don't bump or'd single version values
    const originalSplit = range.split(' ');
    for (let i = 0; i < originalSplit.length; i += 1) {
        if (!(0, common_1.containsOperators)(originalSplit[i]) &&
            !originalSplit[i].includes('||')) {
            if (i !== 0 && originalSplit[i - 1].includes('||')) {
                ordValues.push(`|| ${originalSplit[i]}`);
            }
            else if (i !== originalSplit.length && originalSplit[i + 1] === '||') {
                ordValues.push(`${originalSplit[i]} ||`);
            }
        }
        else {
            ordValues.push(originalSplit[i]);
        }
    }
    const parsedRange = (0, semver_utils_1.parseRange)(range);
    const cleanRange = range.replace(/([<=>^~])( )?/g, '');
    const splitRange = cleanRange.split(' ');
    const semverRange = [];
    for (let i = 0; i < splitRange.length; i += 1) {
        if (!splitRange[i].includes('||')) {
            const splitVersion = splitRange[i].split('.');
            const major = splitVersion[0];
            const minor = splitVersion[1];
            const patch = splitVersion[2];
            const operator = ordValues[i].includes('||')
                ? '||'
                : parsedRange[i].operator;
            const NewSemVer = {
                major,
            };
            let full = `${operator || ''}${major}`;
            if (minor) {
                NewSemVer.minor = minor;
                full = `${full}.${minor}`;
                if (patch) {
                    NewSemVer.patch = patch;
                    full = `${full}.${patch}`;
                }
            }
            if (operator) {
                NewSemVer.operator = operator;
                full = range.includes(`${operator} `)
                    ? `${operator} ${full.replace(operator, '')}`
                    : `${operator}${full.replace(operator, '')}`;
            }
            full = ordValues[i].includes('||') ? ordValues[i] : full;
            NewSemVer.semver = full;
            semverRange.push(NewSemVer);
        }
    }
    return semverRange;
}
exports.fixParsedRange = fixParsedRange;
function replaceRange({ currentValue, newVersion, }) {
    const parsedRange = (0, semver_utils_1.parseRange)(currentValue);
    const element = parsedRange[parsedRange.length - 1];
    const toVersionMajor = getMajor(newVersion);
    const toVersionMinor = getMinor(newVersion);
    const toVersionPatch = getPatch(newVersion);
    const suffix = semver.prerelease(newVersion)
        ? '-' + String(semver.prerelease(newVersion)?.[0])
        : '';
    if (element.operator === '~>') {
        return `~> ${toVersionMajor}.${toVersionMinor}.0`;
    }
    if (element.operator === '=') {
        return `=${newVersion}`;
    }
    if (element.operator === '~') {
        if (suffix.length) {
            return `~${toVersionMajor}.${toVersionMinor}.${toVersionPatch}${suffix}`;
        }
        return `~${toVersionMajor}.${toVersionMinor}.0`;
    }
    if (element.operator === '<=') {
        let res;
        if (element.patch || suffix.length) {
            res = `<=${newVersion}`;
        }
        else if (element.minor) {
            res = `<=${toVersionMajor}.${toVersionMinor}`;
        }
        else {
            res = `<=${toVersionMajor}`;
        }
        if (currentValue.includes('<= ')) {
            res = res.replace('<=', '<= ');
        }
        return res;
    }
    if (element.operator === '<' && toVersionMajor) {
        let res;
        if (currentValue.endsWith('.0.0')) {
            const newMajor = toVersionMajor + 1;
            res = `<${newMajor}.0.0`;
        }
        else if (element.patch) {
            res = `<${semver.inc(newVersion, 'patch')}`;
        }
        else if (element.minor && toVersionMinor) {
            res = `<${toVersionMajor}.${toVersionMinor + 1}`;
        }
        else {
            res = `<${toVersionMajor + 1}`;
        }
        if (currentValue.includes('< ')) {
            res = res.replace(/</g, '< ');
        }
        return res;
    }
    if (element.operator === '>') {
        let res;
        if (currentValue.endsWith('.0.0') && toVersionMajor) {
            const newMajor = toVersionMajor + 1;
            res = `>${newMajor}.0.0`;
        }
        else if (element.patch) {
            res = `>${toVersionMajor}.${toVersionMinor}.${toVersionPatch}`;
        }
        else if (element.minor) {
            res = `>${toVersionMajor}.${toVersionMinor}`;
        }
        else {
            res = `>${toVersionMajor}`;
        }
        if (currentValue.includes('> ')) {
            res = res.replace(/</g, '> ');
        }
        return res;
    }
    if (!element.operator) {
        if (element.minor) {
            if (element.minor === 'x') {
                return `${toVersionMajor}.x`;
            }
            if (element.minor === '*') {
                return `${toVersionMajor}.*`;
            }
            if (element.patch === 'x') {
                return `${toVersionMajor}.${toVersionMinor}.x`;
            }
            if (element.patch === '*') {
                return `${toVersionMajor}.${toVersionMinor}.*`;
            }
            return `${newVersion}`;
        }
        return `${toVersionMajor}`;
    }
    return newVersion;
}
exports.replaceRange = replaceRange;
function widenRange({ currentValue, currentVersion, newVersion }, options) {
    const parsedRange = (0, semver_utils_1.parseRange)(currentValue);
    const element = parsedRange[parsedRange.length - 1];
    if ((0, common_1.matchesWithOptions)(newVersion, currentValue, options)) {
        return currentValue;
    }
    const newValue = replaceRange({
        currentValue,
        rangeStrategy: 'replace',
        currentVersion,
        newVersion,
    });
    if (element.operator?.startsWith('<')) {
        const splitCurrent = currentValue.split(element.operator);
        splitCurrent.pop();
        return splitCurrent.join(element.operator) + newValue;
    }
    if (parsedRange.length > 1) {
        const previousElement = parsedRange[parsedRange.length - 2];
        if (previousElement.operator === '-') {
            const splitCurrent = currentValue.split('-');
            splitCurrent.pop();
            return splitCurrent.join('-') + '- ' + newValue;
        }
        if (element.operator?.startsWith('>')) {
            logger_1.logger.warn(`Complex ranges ending in greater than are not supported`);
            return null;
        }
    }
    return `${currentValue} || ${newValue}`;
}
exports.widenRange = widenRange;
function bumpRange({ currentValue, currentVersion, newVersion }, options) {
    if (!(0, common_1.containsOperators)(currentValue) && currentValue.includes('||')) {
        return widenRange({
            currentValue,
            rangeStrategy: 'widen',
            currentVersion,
            newVersion,
        }, options);
    }
    const parsedRange = (0, semver_utils_1.parseRange)(currentValue);
    const element = parsedRange[parsedRange.length - 1];
    const toVersionMajor = getMajor(newVersion);
    const toVersionMinor = getMinor(newVersion);
    const suffix = semver.prerelease(newVersion)
        ? '-' + String(semver.prerelease(newVersion)?.[0])
        : '';
    if (parsedRange.length === 1) {
        if (!element.operator) {
            return replaceRange({
                currentValue,
                rangeStrategy: 'replace',
                currentVersion,
                newVersion,
            });
        }
        if (element.operator.startsWith('~')) {
            const split = currentValue.split('.');
            if (suffix.length) {
                return `${element.operator}${newVersion}`;
            }
            if (split.length === 1) {
                // ~4
                return `${element.operator}${toVersionMajor}`;
            }
            if (split.length === 2) {
                // ~4.1
                return `${element.operator}${toVersionMajor}.${toVersionMinor}`;
            }
            return `${element.operator}${newVersion}`;
        }
        if (element.operator === '=') {
            return `=${newVersion}`;
        }
        if (element.operator === '>=') {
            return currentValue.includes('>= ')
                ? `>= ${newVersion}`
                : `>=${newVersion}`;
        }
        if (element.operator.startsWith('<')) {
            return currentValue;
        }
    }
    else {
        const newRange = fixParsedRange(currentValue);
        const versions = newRange.map((x) => {
            // don't bump or'd single version values
            if (x.operator === '||') {
                return x.semver;
            }
            if (x.operator) {
                const bumpedSubRange = bumpRange({
                    currentValue: x.semver,
                    rangeStrategy: 'bump',
                    currentVersion,
                    newVersion,
                }, options);
                if (bumpedSubRange &&
                    (0, common_1.matchesWithOptions)(newVersion, bumpedSubRange, options)) {
                    return bumpedSubRange;
                }
            }
            return replaceRange({
                currentValue: x.semver,
                rangeStrategy: 'replace',
                currentVersion,
                newVersion,
            });
        });
        return versions.filter((x) => x !== null && x !== '').join(' ');
    }
    logger_1.logger.debug('Unsupported range type for rangeStrategy=bump: ' + currentValue);
    return null;
}
exports.bumpRange = bumpRange;
//# sourceMappingURL=range.js.map