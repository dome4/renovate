"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getRepoGitUrl = exports.getInvalidReviewers = exports.isInvalidReviewersResponse = exports.accumulateValues = exports.prInfo = exports.BITBUCKET_INVALID_REVIEWERS_EXCEPTION = void 0;
const tslib_1 = require("tslib");
// SEE for the reference https://github.com/renovatebot/renovate/blob/c3e9e572b225085448d94aa121c7ec81c14d3955/lib/platform/bitbucket/utils.js
const url_1 = tslib_1.__importDefault(require("url"));
const is_1 = tslib_1.__importDefault(require("@sindresorhus/is"));
const types_1 = require("../../../types");
const git = tslib_1.__importStar(require("../../../util/git"));
const bitbucket_server_1 = require("../../../util/http/bitbucket-server");
const pr_body_1 = require("../pr-body");
exports.BITBUCKET_INVALID_REVIEWERS_EXCEPTION = 'com.atlassian.bitbucket.pull.InvalidPullRequestReviewersException';
const bitbucketServerHttp = new bitbucket_server_1.BitbucketServerHttp();
// https://docs.atlassian.com/bitbucket-server/rest/6.0.0/bitbucket-rest.html#idp250
const prStateMapping = {
    MERGED: types_1.PrState.Merged,
    DECLINED: types_1.PrState.Closed,
    OPEN: types_1.PrState.Open,
};
function prInfo(pr) {
    return {
        version: pr.version,
        number: pr.id,
        bodyStruct: (0, pr_body_1.getPrBodyStruct)(pr.description),
        sourceBranch: pr.fromRef.displayId,
        targetBranch: pr.toRef.displayId,
        title: pr.title,
        state: prStateMapping[pr.state],
        createdAt: pr.createdDate,
    };
}
exports.prInfo = prInfo;
const addMaxLength = (inputUrl, limit = 100) => {
    const { search, ...parsedUrl } = url_1.default.parse(inputUrl, true); // eslint-disable-line @typescript-eslint/no-unused-vars
    const maxedUrl = url_1.default.format({
        ...parsedUrl,
        query: { ...parsedUrl.query, limit },
    });
    return maxedUrl;
};
function callApi(apiUrl, method, options) {
    /* istanbul ignore next */
    switch (method.toLowerCase()) {
        case 'post':
            return bitbucketServerHttp.postJson(apiUrl, options);
        case 'put':
            return bitbucketServerHttp.putJson(apiUrl, options);
        case 'patch':
            return bitbucketServerHttp.patchJson(apiUrl, options);
        case 'head':
            return bitbucketServerHttp.headJson(apiUrl, options);
        case 'delete':
            return bitbucketServerHttp.deleteJson(apiUrl, options);
        case 'get':
        default:
            return bitbucketServerHttp.getJson(apiUrl, options);
    }
}
async function accumulateValues(reqUrl, method = 'get', options, limit) {
    let accumulator = [];
    let nextUrl = addMaxLength(reqUrl, limit);
    while (typeof nextUrl !== 'undefined') {
        // TODO: fix typing (#9610)
        const { body } = await callApi(nextUrl, method, options);
        accumulator = [...accumulator, ...body.values];
        if (body.isLastPage !== false) {
            break;
        }
        const { search, ...parsedUrl } = url_1.default.parse(nextUrl, true); // eslint-disable-line @typescript-eslint/no-unused-vars
        nextUrl = url_1.default.format({
            ...parsedUrl,
            query: {
                ...parsedUrl.query,
                start: body.nextPageStart,
            },
        });
    }
    return accumulator;
}
exports.accumulateValues = accumulateValues;
function isInvalidReviewersResponse(err) {
    const errors = err?.response?.body?.errors ?? [];
    return (errors.length > 0 &&
        errors.every((error) => error.exceptionName === exports.BITBUCKET_INVALID_REVIEWERS_EXCEPTION));
}
exports.isInvalidReviewersResponse = isInvalidReviewersResponse;
function getInvalidReviewers(err) {
    const errors = err?.response?.body?.errors ?? [];
    let invalidReviewers = [];
    for (const error of errors) {
        if (error.exceptionName === exports.BITBUCKET_INVALID_REVIEWERS_EXCEPTION) {
            invalidReviewers = invalidReviewers.concat(error.reviewerErrors
                ?.map(({ context }) => context)
                .filter(is_1.default.nonEmptyString) ?? []);
        }
    }
    return invalidReviewers;
}
exports.getInvalidReviewers = getInvalidReviewers;
function getRepoGitUrl(repository, defaultEndpoint, info, opts) {
    let cloneUrl = info.links.clone?.find(({ name }) => name === 'http');
    if (!cloneUrl) {
        // Http access might be disabled, try to find ssh url in this case
        cloneUrl = info.links.clone?.find(({ name }) => name === 'ssh');
    }
    let gitUrl;
    if (!cloneUrl) {
        // Fallback to generating the url if the API didn't give us an URL
        const { host, pathname } = url_1.default.parse(defaultEndpoint);
        gitUrl = git.getUrl({
            protocol: defaultEndpoint.split(':')[0],
            auth: `${opts.username}:${opts.password}`,
            host: `${host}${pathname}${
            // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
            pathname.endsWith('/') ? '' : /* istanbul ignore next */ '/'}scm`,
            repository,
        });
    }
    else if (cloneUrl.name === 'http') {
        // Inject auth into the API provided URL
        const repoUrl = url_1.default.parse(cloneUrl.href);
        repoUrl.auth = `${opts.username}:${opts.password}`;
        gitUrl = url_1.default.format(repoUrl);
    }
    else {
        // SSH urls can be used directly
        gitUrl = cloneUrl.href;
    }
    return gitUrl;
}
exports.getRepoGitUrl = getRepoGitUrl;
//# sourceMappingURL=utils.js.map