"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateBranchConfig = void 0;
const tslib_1 = require("tslib");
const is_1 = tslib_1.__importDefault(require("@sindresorhus/is"));
const luxon_1 = require("luxon");
const markdown_table_1 = tslib_1.__importDefault(require("markdown-table"));
const semver_1 = tslib_1.__importDefault(require("semver"));
const config_1 = require("../../../config");
const error_messages_1 = require("../../../constants/error-messages");
const logger_1 = require("../../../logger");
const regex_1 = require("../../../util/regex");
const sanitize_1 = require("../../../util/sanitize");
const template = tslib_1.__importStar(require("../../../util/template"));
const commit_message_1 = require("../model/commit-message");
function isTypesGroup(branchUpgrades) {
    return (branchUpgrades.some(({ depName }) => depName?.startsWith('@types/')) &&
        new Set(branchUpgrades.map(({ depName }) => depName?.replace(/^@types\//, ''))).size === 1);
}
function sortTypesGroup(upgrades) {
    const isTypesUpgrade = ({ depName }) => depName?.startsWith('@types/');
    const regularUpgrades = upgrades.filter((upgrade) => !isTypesUpgrade(upgrade));
    const typesUpgrades = upgrades.filter(isTypesUpgrade);
    upgrades.splice(0, upgrades.length);
    upgrades.push(...regularUpgrades, ...typesUpgrades);
}
function getTableValues(upgrade) {
    if (!upgrade.commitBodyTable) {
        return null;
    }
    const { datasource, packageName, depName, currentVersion, newVersion } = upgrade;
    const name = packageName || depName;
    if (datasource && name && currentVersion && newVersion) {
        return [datasource, name, currentVersion, newVersion];
    }
    logger_1.logger.debug({
        datasource,
        packageName,
        depName,
        currentVersion,
        newVersion,
    }, 'Cannot determine table values');
    return null;
}
function generateBranchConfig(upgrades) {
    let branchUpgrades = upgrades;
    if (!branchUpgrades.every((upgrade) => upgrade.pendingChecks)) {
        // If the branch isn't pending, then remove any upgrades within which *are*
        branchUpgrades = branchUpgrades.filter((upgrade) => !upgrade.pendingChecks);
    }
    logger_1.logger.trace({ config: branchUpgrades }, 'generateBranchConfig');
    let config = {
        upgrades: [],
    };
    const hasGroupName = branchUpgrades[0].groupName !== null;
    logger_1.logger.trace(`hasGroupName: ${hasGroupName}`);
    // Use group settings only if multiple upgrades or lazy grouping is disabled
    const depNames = [];
    const newValue = [];
    const toVersions = [];
    const toValues = new Set();
    branchUpgrades.forEach((upg) => {
        if (!depNames.includes(upg.depName)) {
            depNames.push(upg.depName);
        }
        if (!toVersions.includes(upg.newVersion)) {
            toVersions.push(upg.newVersion);
        }
        toValues.add(upg.newValue);
        if (upg.commitMessageExtra) {
            const extra = template.compile(upg.commitMessageExtra, upg);
            if (!newValue.includes(extra)) {
                newValue.push(extra);
            }
        }
    });
    const groupEligible = depNames.length > 1 ||
        toVersions.length > 1 ||
        (!toVersions[0] && newValue.length > 1);
    if (newValue.length > 1 && !groupEligible) {
        branchUpgrades[0].commitMessageExtra = `to v${toVersions[0]}`;
    }
    const typesGroup = depNames.length > 1 && !hasGroupName && isTypesGroup(branchUpgrades);
    logger_1.logger.trace(`groupEligible: ${groupEligible}`);
    const useGroupSettings = hasGroupName && groupEligible;
    logger_1.logger.trace(`useGroupSettings: ${useGroupSettings}`);
    let releaseTimestamp;
    for (const branchUpgrade of branchUpgrades) {
        let upgrade = { ...branchUpgrade };
        if (upgrade.currentDigest) {
            upgrade.currentDigestShort =
                upgrade.currentDigestShort ||
                    upgrade.currentDigest.replace('sha256:', '').substring(0, 7);
        }
        if (upgrade.newDigest) {
            upgrade.newDigestShort =
                upgrade.newDigestShort ||
                    upgrade.newDigest.replace('sha256:', '').substring(0, 7);
        }
        if (upgrade.isDigest || upgrade.isPinDigest) {
            upgrade.displayFrom = upgrade.currentDigestShort;
            upgrade.displayTo = upgrade.newDigestShort;
        }
        else if (upgrade.isLockfileUpdate) {
            upgrade.displayFrom = upgrade.currentVersion;
            upgrade.displayTo = upgrade.newVersion;
        }
        else if (!upgrade.isLockFileMaintenance) {
            upgrade.displayFrom = upgrade.currentValue;
            upgrade.displayTo = upgrade.newValue;
        }
        upgrade.displayFrom ?? (upgrade.displayFrom = '');
        upgrade.displayTo ?? (upgrade.displayTo = '');
        const pendingVersionsLength = upgrade.pendingVersions?.length;
        if (pendingVersionsLength) {
            upgrade.displayPending = `\`${upgrade.pendingVersions.slice(-1).pop()}\``;
            if (pendingVersionsLength > 1) {
                upgrade.displayPending += ` (+${pendingVersionsLength - 1})`;
            }
        }
        else {
            upgrade.displayPending = '';
        }
        upgrade.prettyDepType =
            upgrade.prettyDepType || upgrade.depType || 'dependency';
        if (useGroupSettings) {
            // Now overwrite original config with group config
            upgrade = (0, config_1.mergeChildConfig)(upgrade, upgrade.group);
            upgrade.isGroup = true;
        }
        else {
            delete upgrade.groupName;
        }
        // Delete group config regardless of whether it was applied
        delete upgrade.group;
        // istanbul ignore else
        if (toVersions.length > 1 &&
            toValues.size > 1 &&
            newValue.length > 1 &&
            !typesGroup) {
            logger_1.logger.trace({ toVersions });
            logger_1.logger.trace({ toValues });
            delete upgrade.commitMessageExtra;
            upgrade.recreateClosed = true;
        }
        else if (newValue.length > 1 && upgrade.isDigest) {
            logger_1.logger.trace({ newValue });
            delete upgrade.commitMessageExtra;
            upgrade.recreateClosed = true;
        }
        else if (semver_1.default.valid(toVersions[0])) {
            upgrade.isRange = false;
        }
        // Use templates to generate strings
        if (upgrade.semanticCommits === 'enabled' && !upgrade.commitMessagePrefix) {
            logger_1.logger.trace('Upgrade has semantic commits enabled');
            let semanticPrefix = upgrade.semanticCommitType;
            if (upgrade.semanticCommitScope) {
                semanticPrefix += `(${template.compile(upgrade.semanticCommitScope, upgrade)})`;
            }
            upgrade.commitMessagePrefix = commit_message_1.CommitMessage.formatPrefix(semanticPrefix);
            upgrade.toLowerCase =
                (0, regex_1.regEx)(/[A-Z]/).exec(upgrade.semanticCommitType) === null &&
                    !upgrade.semanticCommitType.startsWith(':');
        }
        // Compile a few times in case there are nested templates
        upgrade.commitMessage = template.compile(upgrade.commitMessage || '', upgrade);
        upgrade.commitMessage = template.compile(upgrade.commitMessage, upgrade);
        upgrade.commitMessage = template.compile(upgrade.commitMessage, upgrade);
        // istanbul ignore if
        if (upgrade.commitMessage !== (0, sanitize_1.sanitize)(upgrade.commitMessage)) {
            logger_1.logger.debug({ branchName: config.branchName }, 'Secrets exposed in commit message');
            throw new Error(error_messages_1.CONFIG_SECRETS_EXPOSED);
        }
        upgrade.commitMessage = upgrade.commitMessage.trim(); // Trim exterior whitespace
        upgrade.commitMessage = upgrade.commitMessage.replace((0, regex_1.regEx)(/\s+/g), ' '); // Trim extra whitespace inside string
        upgrade.commitMessage = upgrade.commitMessage.replace((0, regex_1.regEx)(/to vv(\d)/), 'to v$1');
        if (upgrade.toLowerCase) {
            // We only need to lowercase the first line
            const splitMessage = upgrade.commitMessage.split(regex_1.newlineRegex);
            splitMessage[0] = splitMessage[0].toLowerCase();
            upgrade.commitMessage = splitMessage.join('\n');
        }
        if (upgrade.commitBody) {
            upgrade.commitMessage = `${upgrade.commitMessage}\n\n${template.compile(upgrade.commitBody, upgrade)}`;
        }
        logger_1.logger.trace(`commitMessage: ` + JSON.stringify(upgrade.commitMessage));
        if (upgrade.prTitle) {
            upgrade.prTitle = template.compile(upgrade.prTitle, upgrade);
            upgrade.prTitle = template.compile(upgrade.prTitle, upgrade);
            upgrade.prTitle = template
                .compile(upgrade.prTitle, upgrade)
                .trim()
                .replace((0, regex_1.regEx)(/\s+/g), ' ');
            // istanbul ignore if
            if (upgrade.prTitle !== (0, sanitize_1.sanitize)(upgrade.prTitle)) {
                logger_1.logger.debug({ branchName: config.branchName }, 'Secrets were exposed in PR title');
                throw new Error(error_messages_1.CONFIG_SECRETS_EXPOSED);
            }
            if (upgrade.toLowerCase) {
                upgrade.prTitle = upgrade.prTitle.toLowerCase();
            }
        }
        else {
            [upgrade.prTitle] = upgrade.commitMessage.split(regex_1.newlineRegex);
        }
        upgrade.prTitle += upgrade.hasBaseBranches ? ' ({{baseBranch}})' : '';
        if (upgrade.isGroup) {
            upgrade.prTitle +=
                upgrade.updateType === 'major' && upgrade.separateMajorMinor
                    ? ' (major)'
                    : '';
            upgrade.prTitle +=
                upgrade.updateType === 'minor' && upgrade.separateMinorPatch
                    ? ' (minor)'
                    : '';
            upgrade.prTitle +=
                upgrade.updateType === 'patch' && upgrade.separateMinorPatch
                    ? ' (patch)'
                    : '';
        }
        // Compile again to allow for nested templates
        upgrade.prTitle = template.compile(upgrade.prTitle, upgrade);
        logger_1.logger.trace(`prTitle: ` + JSON.stringify(upgrade.prTitle));
        config.upgrades.push(upgrade);
        if (upgrade.releaseTimestamp) {
            if (releaseTimestamp) {
                const existingStamp = luxon_1.DateTime.fromISO(releaseTimestamp);
                const upgradeStamp = luxon_1.DateTime.fromISO(upgrade.releaseTimestamp);
                if (upgradeStamp > existingStamp) {
                    releaseTimestamp = upgrade.releaseTimestamp;
                }
            }
            else {
                releaseTimestamp = upgrade.releaseTimestamp;
            }
        }
    }
    if (typesGroup) {
        if (config.upgrades[0].depName?.startsWith('@types/')) {
            logger_1.logger.debug('Found @types - reversing upgrades to use depName in PR');
            sortTypesGroup(config.upgrades);
            config.upgrades[0].recreateClosed = false;
            config.hasTypes = true;
        }
    }
    else {
        config.upgrades.sort((a, b) => {
            if (a.fileReplacePosition && b.fileReplacePosition) {
                // This is because we need to replace from the bottom of the file up
                return a.fileReplacePosition > b.fileReplacePosition ? -1 : 1;
            }
            // make sure that ordering is consistent :
            // items without position will be first in the list.
            if (a.fileReplacePosition) {
                return 1;
            }
            if (b.fileReplacePosition) {
                return -1;
            }
            if (a.depName < b.depName) {
                return -1;
            }
            if (a.depName > b.depName) {
                return 1;
            }
            return 0;
        });
    }
    // Now assign first upgrade's config as branch config
    config = { ...config, ...config.upgrades[0], releaseTimestamp }; // TODO: fixme (#9666)
    config.reuseLockFiles = config.upgrades.every((upgrade) => upgrade.updateType !== 'lockFileMaintenance');
    config.dependencyDashboardApproval = config.upgrades.some((upgrade) => upgrade.dependencyDashboardApproval);
    config.dependencyDashboardPrApproval = config.upgrades.some((upgrade) => upgrade.prCreation === 'approval');
    config.prBodyColumns = [
        ...new Set(config.upgrades.reduce((existing, upgrade) => existing.concat(upgrade.prBodyColumns), [])),
    ].filter(is_1.default.nonEmptyString);
    config.automerge = config.upgrades.every((upgrade) => upgrade.automerge);
    // combine all labels
    config.labels = [
        ...new Set(config.upgrades
            .map((upgrade) => upgrade.labels || [])
            .reduce((a, b) => a.concat(b), [])),
    ];
    config.addLabels = [
        ...new Set(config.upgrades
            .map((upgrade) => upgrade.addLabels || [])
            .reduce((a, b) => a.concat(b), [])),
    ];
    if (config.upgrades.some((upgrade) => upgrade.updateType === 'major')) {
        config.updateType = 'major';
    }
    config.constraints = {};
    for (const upgrade of config.upgrades || []) {
        if (upgrade.constraints) {
            config.constraints = { ...config.constraints, ...upgrade.constraints };
        }
    }
    const tableRows = config.upgrades
        .map((upgrade) => getTableValues(upgrade))
        .filter(Boolean);
    if (tableRows.length) {
        let table = [];
        table.push(['datasource', 'package', 'from', 'to']);
        table = table.concat(tableRows);
        config.commitMessage += '\n\n' + (0, markdown_table_1.default)(table) + '\n';
    }
    return config;
}
exports.generateBranchConfig = generateBranchConfig;
//# sourceMappingURL=generate.js.map