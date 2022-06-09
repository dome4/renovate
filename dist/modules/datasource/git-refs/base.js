"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GitDatasource = void 0;
const tslib_1 = require("tslib");
const is_1 = tslib_1.__importDefault(require("@sindresorhus/is"));
const simple_git_1 = tslib_1.__importDefault(require("simple-git"));
const logger_1 = require("../../../logger");
const decorator_1 = require("../../../util/cache/package/decorator");
const config_1 = require("../../../util/git/config");
const url_1 = require("../../../util/git/url");
const regex_1 = require("../../../util/regex");
const datasource_1 = require("../datasource");
const refMatch = (0, regex_1.regEx)(/(?<hash>.*?)\s+refs\/(?<type>.*?)\/(?<value>.*)/);
const headMatch = (0, regex_1.regEx)(/(?<hash>.*?)\s+HEAD/);
// TODO: extract to a separate directory structure (#10532)
class GitDatasource extends datasource_1.Datasource {
    constructor(id) {
        super(id);
    }
    async getRawRefs({ packageName, }) {
        const git = (0, simple_git_1.default)((0, config_1.simpleGitConfig)());
        // fetch remote tags
        const lsRemote = await git.listRemote([
            (0, url_1.getRemoteUrlWithToken)(packageName, this.id),
        ]);
        if (!lsRemote) {
            return null;
        }
        const refs = lsRemote
            .trim()
            .split(regex_1.newlineRegex)
            .map((line) => line.trim())
            .map((line) => {
            let match = refMatch.exec(line);
            if (match?.groups) {
                return {
                    type: match.groups.type,
                    value: match.groups.value,
                    hash: match.groups.hash,
                };
            }
            match = headMatch.exec(line);
            if (match?.groups) {
                return {
                    type: '',
                    value: 'HEAD',
                    hash: match.groups.hash,
                };
            }
            logger_1.logger.trace(`malformed ref: ${line}`);
            return null;
        })
            .filter(is_1.default.truthy)
            .filter((ref) => ref.type !== 'pull' && !ref.value.endsWith('^{}'));
        return refs;
    }
}
GitDatasource.id = 'git';
tslib_1.__decorate([
    (0, decorator_1.cache)({
        namespace: `datasource-${GitDatasource.id}`,
        key: ({ packageName }) => packageName,
    })
], GitDatasource.prototype, "getRawRefs", null);
exports.GitDatasource = GitDatasource;
//# sourceMappingURL=base.js.map