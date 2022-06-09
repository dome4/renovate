"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getPrBody = void 0;
const tslib_1 = require("tslib");
const platform_1 = require("../../../../../modules/platform");
const regex_1 = require("../../../../../util/regex");
const template = tslib_1.__importStar(require("../../../../../util/template"));
const url_1 = require("../../../../../util/url");
const changelogs_1 = require("./changelogs");
const config_description_1 = require("./config-description");
const controls_1 = require("./controls");
const footer_1 = require("./footer");
const header_1 = require("./header");
const notes_1 = require("./notes");
const updates_table_1 = require("./updates-table");
function massageUpdateMetadata(config) {
    config.upgrades.forEach((upgrade) => {
        const { homepage, sourceUrl, sourceDirectory, changelogUrl, dependencyUrl, } = upgrade;
        let depNameLinked = upgrade.depName;
        const primaryLink = homepage || sourceUrl || dependencyUrl;
        if (primaryLink) {
            depNameLinked = `[${depNameLinked}](${primaryLink})`;
        }
        const otherLinks = [];
        if (homepage && sourceUrl) {
            otherLinks.push(`[source](${sourceUrl})`);
        }
        if (changelogUrl) {
            otherLinks.push(`[changelog](${changelogUrl})`);
        }
        if (otherLinks.length) {
            depNameLinked += ` (${otherLinks.join(', ')})`;
        }
        upgrade.depNameLinked = depNameLinked;
        const references = [];
        if (homepage) {
            references.push(`[homepage](${homepage})`);
        }
        if (sourceUrl) {
            let fullUrl = sourceUrl;
            if (sourceDirectory) {
                fullUrl =
                    (0, url_1.ensureTrailingSlash)(sourceUrl) +
                        'tree/HEAD/' +
                        sourceDirectory.replace('^/?/', '');
            }
            references.push(`[source](${fullUrl})`);
        }
        if (changelogUrl) {
            references.push(`[changelog](${changelogUrl})`);
        }
        upgrade.references = references.join(', ');
    });
}
const rebasingRegex = (0, regex_1.regEx)(/\*\*Rebasing\*\*: .*/);
async function getPrBody(branchConfig, prBodyConfig) {
    massageUpdateMetadata(branchConfig);
    const content = {
        header: (0, header_1.getPrHeader)(branchConfig),
        table: (0, updates_table_1.getPrUpdatesTable)(branchConfig),
        notes: (0, notes_1.getPrNotes)(branchConfig) + (0, notes_1.getPrExtraNotes)(branchConfig),
        changelogs: (0, changelogs_1.getChangelogs)(branchConfig),
        configDescription: await (0, config_description_1.getPrConfigDescription)(branchConfig),
        controls: await (0, controls_1.getControls)(branchConfig),
        footer: (0, footer_1.getPrFooter)(branchConfig),
    };
    let prBody = '';
    if (branchConfig.prBodyTemplate) {
        const prBodyTemplate = branchConfig.prBodyTemplate;
        prBody = template.compile(prBodyTemplate, content, false);
        prBody = prBody.trim();
        prBody = prBody.replace((0, regex_1.regEx)(/\n\n\n+/g), '\n\n');
        prBody = platform_1.platform.massageMarkdown(prBody);
        if (prBodyConfig?.rebasingNotice) {
            prBody = prBody.replace(rebasingRegex, `**Rebasing**: ${prBodyConfig.rebasingNotice}`);
        }
    }
    return prBody;
}
exports.getPrBody = getPrBody;
//# sourceMappingURL=index.js.map