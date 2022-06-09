"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Http = exports.HttpError = void 0;
const tslib_1 = require("tslib");
const crypto_1 = tslib_1.__importDefault(require("crypto"));
const deepmerge_1 = tslib_1.__importDefault(require("deepmerge"));
const got_1 = tslib_1.__importStar(require("got"));
Object.defineProperty(exports, "HttpError", { enumerable: true, get: function () { return got_1.RequestError; } });
const error_messages_1 = require("../../constants/error-messages");
const expose_cjs_1 = require("../../expose.cjs");
const logger_1 = require("../../logger");
const external_host_error_1 = require("../../types/errors/external-host-error");
const memCache = tslib_1.__importStar(require("../cache/memory"));
const clone_1 = require("../clone");
const url_1 = require("../url");
const auth_1 = require("./auth");
const hooks_1 = require("./hooks");
const host_rules_1 = require("./host-rules");
const queue_1 = require("./queue");
// TODO: refactor code to remove this (#9651)
require("./legacy");
function cloneResponse(response) {
    const { body, statusCode, headers } = response;
    // clone body and headers so that the cached result doesn't get accidentally mutated
    // Don't use json clone for buffers
    return {
        statusCode,
        body: body instanceof Buffer ? body.slice() : (0, clone_1.clone)(body),
        headers: (0, clone_1.clone)(headers),
        authorization: !!response.authorization,
    };
}
function applyDefaultHeaders(options) {
    const renovateVersion = expose_cjs_1.pkg.version;
    options.headers = {
        ...options.headers,
        'user-agent': process.env.RENOVATE_USER_AGENT ??
            `RenovateBot/${renovateVersion} (https://github.com/renovatebot/renovate)`,
    };
}
// Note on types:
// options.requestType can be either 'json' or 'buffer', but `T` should be
// `Buffer` in the latter case.
// We don't declare overload signatures because it's immediately wrapped by
// `request`.
async function gotRoutine(url, options, requestStats) {
    logger_1.logger.trace({ url, options }, 'got request');
    let duration = 0;
    let statusCode = 0;
    try {
        // Cheat the TS compiler using `as` to pick a specific overload.
        // Otherwise it doesn't typecheck.
        const resp = await (0, got_1.default)(url, { ...options, hooks: hooks_1.hooks });
        statusCode = resp.statusCode;
        duration =
            resp.timings.phases.total ??
                /* istanbul ignore next: can't be tested */ 0;
        return resp;
    }
    catch (error) {
        if (error instanceof got_1.RequestError) {
            statusCode =
                error.response?.statusCode ??
                    /* istanbul ignore next: can't be tested */ 0;
            duration =
                error.timings?.phases.total ??
                    /* istanbul ignore next: can't be tested */ 0;
        }
        throw error;
    }
    finally {
        const httpRequests = memCache.get('http-requests') || [];
        httpRequests.push({ ...requestStats, duration, statusCode });
        memCache.set('http-requests', httpRequests);
    }
}
class Http {
    constructor(hostType, options = {}) {
        this.hostType = hostType;
        this.options = (0, deepmerge_1.default)(options, { context: { hostType } });
    }
    async request(requestUrl, httpOptions = {}) {
        let url = requestUrl.toString();
        if (httpOptions?.baseUrl) {
            url = (0, url_1.resolveBaseUrl)(httpOptions.baseUrl, url);
        }
        let options = (0, deepmerge_1.default)({
            method: 'get',
            ...this.options,
            hostType: this.hostType,
        }, httpOptions);
        if (process.env.NODE_ENV === 'test') {
            options.retry = 0;
        }
        options.hooks = {
            beforeRedirect: [auth_1.removeAuthorization],
        };
        applyDefaultHeaders(options);
        options = (0, host_rules_1.applyHostRules)(url, options);
        if (options.enabled === false) {
            throw new Error(error_messages_1.HOST_DISABLED);
        }
        options = (0, auth_1.applyAuthorization)(options);
        const cacheKey = crypto_1.default
            .createHash('md5')
            .update('got-' +
            JSON.stringify({
                url,
                headers: options.headers,
                method: options.method,
            }))
            .digest('hex');
        let resPromise;
        // Cache GET requests unless useCache=false
        if ((options.method === 'get' || options.method === 'head') &&
            options.useCache !== false) {
            resPromise = memCache.get(cacheKey);
        }
        // istanbul ignore else: no cache tests
        if (!resPromise) {
            const startTime = Date.now();
            const queueTask = () => {
                const queueDuration = Date.now() - startTime;
                return gotRoutine(url, options, {
                    method: options.method ?? 'get',
                    url,
                    queueDuration,
                });
            };
            const queue = (0, queue_1.getQueue)(url);
            resPromise = queue?.add(queueTask) ?? queueTask();
            if (options.method === 'get' || options.method === 'head') {
                memCache.set(cacheKey, resPromise); // always set if it's a get or a head
            }
        }
        try {
            const res = await resPromise;
            res.authorization = !!options?.headers?.authorization;
            return cloneResponse(res);
        }
        catch (err) {
            const { abortOnError, abortIgnoreStatusCodes } = options;
            if (abortOnError && !abortIgnoreStatusCodes?.includes(err.statusCode)) {
                throw new external_host_error_1.ExternalHostError(err);
            }
            throw err;
        }
    }
    get(url, options = {}) {
        return this.request(url, options);
    }
    head(url, options = {}) {
        return this.request(url, { ...options, method: 'head' });
    }
    requestBuffer(url, httpOptions) {
        return this.request(url, {
            ...httpOptions,
            responseType: 'buffer',
        });
    }
    getBuffer(url, options = {}) {
        return this.requestBuffer(url, options);
    }
    async requestJson(url, options) {
        const { body, ...jsonOptions } = options;
        if (body) {
            jsonOptions.json = body;
        }
        const res = await this.request(url, {
            ...jsonOptions,
            responseType: 'json',
        });
        return { ...res, body: res.body };
    }
    getJson(url, options) {
        return this.requestJson(url, { ...options });
    }
    headJson(url, options) {
        return this.requestJson(url, { ...options, method: 'head' });
    }
    postJson(url, options) {
        return this.requestJson(url, { ...options, method: 'post' });
    }
    putJson(url, options) {
        return this.requestJson(url, { ...options, method: 'put' });
    }
    patchJson(url, options) {
        return this.requestJson(url, { ...options, method: 'patch' });
    }
    deleteJson(url, options) {
        return this.requestJson(url, { ...options, method: 'delete' });
    }
    stream(url, options) {
        const combinedOptions = {
            method: 'get',
            ...this.options,
            hostType: this.hostType,
            ...options,
        };
        let resolvedUrl = url;
        // istanbul ignore else: needs test
        if (options?.baseUrl) {
            resolvedUrl = (0, url_1.resolveBaseUrl)(options.baseUrl, url);
        }
        applyDefaultHeaders(combinedOptions);
        return got_1.default.stream(resolvedUrl, combinedOptions);
    }
}
exports.Http = Http;
//# sourceMappingURL=index.js.map