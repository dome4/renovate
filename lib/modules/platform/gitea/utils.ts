import URL from 'url';
import { PlatformId } from '../../../constants';
import { CONFIG_GIT_URL_UNAVAILABLE } from '../../../constants/error-messages';
import { logger } from '../../../logger';
import type { HostRuleSearchResult } from '../../../types';
import * as hostRules from '../../../util/host-rules';
import { regEx } from '../../../util/regex';
import { parseUrl } from '../../../util/url';
import type { GitUrlOption } from '../types';
import type * as helper from './gitea-helper';

export function smartLinks(body: string): string {
  return body?.replace(regEx(/\]\(\.\.\/pull\//g), '](pulls/');
}

export function trimTrailingApiPath(url: string): string {
  return url?.replace(regEx(/api\/v1\/?$/g), '');
}

export function getRepoUrl(
  repo: helper.Repo,
  gitUrl: GitUrlOption | undefined,
  endpoint: string
): string {
  if (gitUrl === 'ssh') {
    if (!repo.ssh_url) {
      throw new Error(CONFIG_GIT_URL_UNAVAILABLE);
    }
    logger.debug({ url: repo.ssh_url }, `using SSH URL`);
    return repo.ssh_url;
  }

  // Find options for current host and determine Git endpoint
  const opts: HostRuleSearchResult = hostRules.find({
    hostType: PlatformId.Gitea,
    url: endpoint,
  });

  if (gitUrl === 'endpoint') {
    const { protocol, host, pathname } = parseUrl(endpoint) ?? {};
    const url = URL.format({
      protocol: protocol?.slice(0, -1) || 'https',
      auth: opts.token,
      host,
      pathname: pathname + repo.full_name + '.git',
    });
    logger.debug({ url }, 'using URL based on configured endpoint');
    return url;
  }

  if (!repo.clone_url) {
    throw new Error(CONFIG_GIT_URL_UNAVAILABLE);
  }

  logger.debug({ url: repo.clone_url }, `using HTTP URL`);
  const repoUrl = URL.parse(`${repo.clone_url}`);
  repoUrl.auth = opts.token || null;
  return URL.format(repoUrl);
}
