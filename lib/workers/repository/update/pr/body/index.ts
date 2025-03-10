import { platform } from '../../../../../modules/platform';
import { regEx } from '../../../../../util/regex';
import * as template from '../../../../../util/template';
import { ensureTrailingSlash } from '../../../../../util/url';
import type { BranchConfig } from '../../../../types';
import { getChangelogs } from './changelogs';
import { getPrConfigDescription } from './config-description';
import { getControls } from './controls';
import { getPrFooter } from './footer';
import { getPrHeader } from './header';
import { getPrExtraNotes, getPrNotes } from './notes';
import { getPrUpdatesTable } from './updates-table';

function massageUpdateMetadata(config: BranchConfig): void {
  config.upgrades.forEach((upgrade) => {
    const {
      homepage,
      sourceUrl,
      sourceDirectory,
      changelogUrl,
      dependencyUrl,
    } = upgrade;
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
    const references: string[] = [];
    if (homepage) {
      references.push(`[homepage](${homepage})`);
    }
    if (sourceUrl) {
      let fullUrl = sourceUrl;
      if (sourceDirectory) {
        fullUrl =
          ensureTrailingSlash(sourceUrl) +
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

interface PrBodyConfig {
  appendExtra?: string | null | undefined;
  rebasingNotice?: string;
}

const rebasingRegex = regEx(/\*\*Rebasing\*\*: .*/);

export async function getPrBody(
  branchConfig: BranchConfig,
  prBodyConfig?: PrBodyConfig
): Promise<string> {
  massageUpdateMetadata(branchConfig);
  const content = {
    header: getPrHeader(branchConfig),
    table: getPrUpdatesTable(branchConfig),
    notes: getPrNotes(branchConfig) + getPrExtraNotes(branchConfig),
    changelogs: getChangelogs(branchConfig),
    configDescription: await getPrConfigDescription(branchConfig),
    controls: await getControls(branchConfig),
    footer: getPrFooter(branchConfig),
  };

  let prBody = '';
  if (branchConfig.prBodyTemplate) {
    const prBodyTemplate = branchConfig.prBodyTemplate;
    prBody = template.compile(prBodyTemplate, content, false);
    prBody = prBody.trim();
    prBody = prBody.replace(regEx(/\n\n\n+/g), '\n\n');
    prBody = platform.massageMarkdown(prBody);

    if (prBodyConfig?.rebasingNotice) {
      prBody = prBody.replace(
        rebasingRegex,
        `**Rebasing**: ${prBodyConfig.rebasingNotice}`
      );
    }
  }
  return prBody;
}
