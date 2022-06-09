"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GoProxyDatasource = void 0;
const tslib_1 = require("tslib");
const is_1 = tslib_1.__importDefault(require("@sindresorhus/is"));
const moo_1 = tslib_1.__importDefault(require("moo"));
const p_all_1 = tslib_1.__importDefault(require("p-all"));
const logger_1 = require("../../../logger");
const decorator_1 = require("../../../util/cache/package/decorator");
const regex_1 = require("../../../util/regex");
const datasource_1 = require("../datasource");
const base_1 = require("./base");
const common_1 = require("./common");
const releases_direct_1 = require("./releases-direct");
const parsedGoproxy = {};
class GoProxyDatasource extends datasource_1.Datasource {
    constructor() {
        super(GoProxyDatasource.id);
        this.direct = new releases_direct_1.GoDirectDatasource();
    }
    async getReleases(config) {
        const { packageName } = config;
        logger_1.logger.trace(`goproxy.getReleases(${packageName})`);
        const goproxy = process.env.GOPROXY;
        const proxyList = this.parseGoproxy(goproxy);
        const noproxy = GoProxyDatasource.parseNoproxy();
        let result = null;
        if (noproxy?.test(packageName)) {
            logger_1.logger.debug(`Fetching ${packageName} via GONOPROXY match`);
            result = await this.direct.getReleases(config);
            return result;
        }
        for (const { url, fallback } of proxyList) {
            try {
                if (url === 'off') {
                    break;
                }
                else if (url === 'direct') {
                    result = await this.direct.getReleases(config);
                    break;
                }
                const versions = await this.listVersions(url, packageName);
                const queue = versions.map((version) => async () => {
                    try {
                        return await this.versionInfo(url, packageName, version);
                    }
                    catch (err) {
                        logger_1.logger.trace({ err }, `Can't obtain data from ${url}`);
                        return { version };
                    }
                });
                const releases = await (0, p_all_1.default)(queue, { concurrency: 5 });
                if (releases.length) {
                    const datasource = await base_1.BaseGoDatasource.getDatasource(packageName);
                    const sourceUrl = (0, common_1.getSourceUrl)(datasource);
                    result = { releases, sourceUrl };
                    break;
                }
            }
            catch (err) {
                const statusCode = err?.response?.statusCode;
                const canFallback = fallback === common_1.GoproxyFallback.Always
                    ? true
                    : statusCode === 404 || statusCode === 410;
                const msg = canFallback
                    ? 'Goproxy error: trying next URL provided with GOPROXY'
                    : 'Goproxy error: skipping other URLs provided with GOPROXY';
                logger_1.logger.debug({ err }, msg);
                if (!canFallback) {
                    break;
                }
            }
        }
        return result;
    }
    /**
     * Parse `GOPROXY` to the sequence of url + fallback strategy tags.
     *
     * @example
     * parseGoproxy('foo.example.com|bar.example.com,baz.example.com')
     * // [
     * //   { url: 'foo.example.com', fallback: '|' },
     * //   { url: 'bar.example.com', fallback: ',' },
     * //   { url: 'baz.example.com', fallback: '|' },
     * // ]
     *
     * @see https://golang.org/ref/mod#goproxy-protocol
     */
    parseGoproxy(input = process.env.GOPROXY) {
        if (!is_1.default.string(input)) {
            return [];
        }
        if (parsedGoproxy[input]) {
            return parsedGoproxy[input];
        }
        const result = input
            .split((0, regex_1.regEx)(/([^,|]*(?:,|\|))/))
            .filter(Boolean)
            .map((s) => s.split(/(?=,|\|)/)) // TODO: #12872 lookahead
            .map(([url, separator]) => ({
            url,
            fallback: separator === ','
                ? common_1.GoproxyFallback.WhenNotFoundOrGone
                : common_1.GoproxyFallback.Always,
        }));
        parsedGoproxy[input] = result;
        return result;
    }
    static parseNoproxy(input = process.env.GONOPROXY || process.env.GOPRIVATE) {
        if (!is_1.default.string(input)) {
            return null;
        }
        if (this.parsedNoproxy[input] !== undefined) {
            return this.parsedNoproxy[input];
        }
        this.lexer.reset(input);
        const noproxyPattern = [...this.lexer].map(({ value }) => value).join('');
        const result = noproxyPattern
            ? (0, regex_1.regEx)(`^(?:${noproxyPattern})(?:/.*)?$`)
            : null;
        this.parsedNoproxy[input] = result;
        return result;
    }
    /**
     * Avoid ambiguity when serving from case-insensitive file systems.
     *
     * @see https://golang.org/ref/mod#goproxy-protocol
     */
    encodeCase(input) {
        return input.replace((0, regex_1.regEx)(/([A-Z])/g), (x) => `!${x.toLowerCase()}`);
    }
    async listVersions(baseUrl, packageName) {
        const url = `${baseUrl}/${this.encodeCase(packageName)}/@v/list`;
        const { body } = await this.http.get(url);
        return body
            .split((0, regex_1.regEx)(/\s+/))
            .filter(Boolean)
            .filter((x) => x.indexOf('+') === -1);
    }
    async versionInfo(baseUrl, packageName, version) {
        const url = `${baseUrl}/${this.encodeCase(packageName)}/@v/${version}.info`;
        const res = await this.http.getJson(url);
        const result = {
            version: res.body.Version,
        };
        if (res.body.Time) {
            result.releaseTimestamp = res.body.Time;
        }
        return result;
    }
    static getCacheKey({ packageName }) {
        const goproxy = process.env.GOPROXY;
        const noproxy = GoProxyDatasource.parseNoproxy();
        return `${packageName}@@${goproxy}@@${noproxy?.toString()}`;
    }
}
GoProxyDatasource.id = 'go-proxy';
// https://golang.org/pkg/path/#Match
GoProxyDatasource.lexer = moo_1.default.states({
    main: {
        separator: {
            match: /\s*?,\s*?/,
            value: (_) => '|',
        },
        asterisk: {
            match: '*',
            value: (_) => '[^\\/]*',
        },
        qmark: {
            match: '?',
            value: (_) => '[^\\/]',
        },
        characterRangeOpen: {
            match: '[',
            push: 'characterRange',
            value: (_) => '[',
        },
        trailingSlash: {
            match: /\/$/,
            value: (_) => '',
        },
        char: {
            match: /[^*?\\[\n]/,
            value: (s) => s.replace((0, regex_1.regEx)('\\.', 'g'), '\\.'),
        },
        escapedChar: {
            match: /\\./,
            value: (s) => s.slice(1),
        },
    },
    characterRange: {
        char: /[^\\\]\n]/,
        escapedChar: {
            match: /\\./,
            value: (s) => s.slice(1),
        },
        characterRangeEnd: {
            match: ']',
            pop: 1,
        },
    },
});
GoProxyDatasource.parsedNoproxy = {};
tslib_1.__decorate([
    (0, decorator_1.cache)({
        namespace: `datasource-${GoProxyDatasource.id}`,
        key: (config) => GoProxyDatasource.getCacheKey(config),
    })
], GoProxyDatasource.prototype, "getReleases", null);
exports.GoProxyDatasource = GoProxyDatasource;
//# sourceMappingURL=releases-goproxy.js.map