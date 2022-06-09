"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sanitizeUrls = exports.validateLogLevel = exports.withSanitizer = exports.sanitizeValue = exports.ProblemStream = void 0;
const tslib_1 = require("tslib");
const stream_1 = require("stream");
const is_1 = tslib_1.__importDefault(require("@sindresorhus/is"));
const bunyan_1 = tslib_1.__importDefault(require("bunyan"));
const fs_extra_1 = tslib_1.__importDefault(require("fs-extra"));
const got_1 = require("got");
const clone_1 = require("../util/clone");
const sanitize_1 = require("../util/sanitize");
const excludeProps = ['pid', 'time', 'v', 'hostname'];
class ProblemStream extends stream_1.Stream {
    constructor() {
        super();
        this._problems = [];
        this.readable = false;
        this.writable = true;
    }
    write(data) {
        const problem = { ...data };
        for (const prop of excludeProps) {
            delete problem[prop];
        }
        this._problems.push(problem);
        return true;
    }
    getProblems() {
        return this._problems;
    }
    clearProblems() {
        this._problems = [];
    }
}
exports.ProblemStream = ProblemStream;
const templateFields = ['prBody'];
const contentFields = [
    'content',
    'contents',
    'packageLockParsed',
    'yarnLockParsed',
];
function prepareError(err) {
    const response = {
        ...err,
    };
    // Required as message is non-enumerable
    if (!response.message && err.message) {
        response.message = err.message;
    }
    // Required as stack is non-enumerable
    if (!response.stack && err.stack) {
        response.stack = err.stack;
    }
    // handle got error
    if (err instanceof got_1.RequestError) {
        const options = {
            headers: (0, clone_1.clone)(err.options.headers),
            url: err.options.url?.toString(),
            hostType: err.options.context.hostType,
        };
        response.options = options;
        options.username = err.options.username;
        options.password = err.options.password;
        options.method = err.options.method;
        options.http2 = err.options.http2;
        // istanbul ignore else
        if (err.response) {
            response.response = {
                statusCode: err.response?.statusCode,
                statusMessage: err.response?.statusMessage,
                body: err.name === 'TimeoutError' ? undefined : (0, clone_1.clone)(err.response.body),
                headers: (0, clone_1.clone)(err.response.headers),
                httpVersion: err.response.httpVersion,
            };
        }
    }
    return response;
}
exports.default = prepareError;
function isNested(value) {
    return is_1.default.array(value) || is_1.default.object(value);
}
function sanitizeValue(value, seen = new WeakMap()) {
    if (is_1.default.string(value)) {
        return (0, sanitize_1.sanitize)(sanitizeUrls(value));
    }
    if (is_1.default.date(value)) {
        return value;
    }
    if (is_1.default.function_(value)) {
        return '[function]';
    }
    if (is_1.default.buffer(value)) {
        return '[content]';
    }
    if (is_1.default.error(value)) {
        const err = prepareError(value);
        return sanitizeValue(err, seen);
    }
    if (is_1.default.array(value)) {
        const length = value.length;
        const arrayResult = Array(length);
        seen.set(value, arrayResult);
        for (let idx = 0; idx < length; idx += 1) {
            const val = value[idx];
            arrayResult[idx] =
                isNested(val) && seen.has(val)
                    ? seen.get(val)
                    : sanitizeValue(val, seen);
        }
        return arrayResult;
    }
    if (is_1.default.object(value)) {
        const objectResult = {};
        seen.set(value, objectResult);
        for (const [key, val] of Object.entries(value)) {
            let curValue;
            if (!val) {
                curValue = val;
            }
            else if (sanitize_1.redactedFields.includes(key)) {
                curValue = '***********';
            }
            else if (contentFields.includes(key)) {
                curValue = '[content]';
            }
            else if (templateFields.includes(key)) {
                curValue = '[Template]';
            }
            else if (key === 'secrets') {
                curValue = {};
                Object.keys(val).forEach((secretKey) => {
                    curValue[secretKey] = '***********';
                });
            }
            else {
                curValue = seen.has(val) ? seen.get(val) : sanitizeValue(val, seen);
            }
            objectResult[key] = curValue;
        }
        return objectResult;
    }
    return value;
}
exports.sanitizeValue = sanitizeValue;
function withSanitizer(streamConfig) {
    if (streamConfig.type === 'rotating-file') {
        throw new Error("Rotating files aren't supported");
    }
    const stream = streamConfig.stream;
    if (stream?.writable) {
        const write = (chunk, enc, cb) => {
            const raw = sanitizeValue(chunk);
            const result = streamConfig.type === 'raw'
                ? raw
                : JSON.stringify(raw, bunyan_1.default.safeCycles()).replace(/\n?$/, '\n'); // TODO #12874
            stream.write(result, enc, cb);
        };
        return {
            ...streamConfig,
            type: 'raw',
            stream: { write },
        };
    }
    if (streamConfig.path) {
        const fileStream = fs_extra_1.default.createWriteStream(streamConfig.path, {
            flags: 'a',
            encoding: 'utf8',
        });
        return withSanitizer({ ...streamConfig, stream: fileStream });
    }
    throw new Error("Missing 'stream' or 'path' for bunyan stream");
}
exports.withSanitizer = withSanitizer;
/**
 * A function that terminates exeution if the log level that was entered is
 *  not a valid value for the Bunyan logger.
 * @param logLevelToCheck
 * @returns returns undefined when the logLevelToCheck is valid. Else it stops execution.
 */
function validateLogLevel(logLevelToCheck) {
    const allowedValues = [
        'trace',
        'debug',
        'info',
        'warn',
        'error',
        'fatal',
    ];
    if (is_1.default.undefined(logLevelToCheck) ||
        (is_1.default.string(logLevelToCheck) &&
            allowedValues.includes(logLevelToCheck))) {
        // log level is in the allowed values or its undefined
        return;
    }
    const logger = bunyan_1.default.createLogger({
        name: 'renovate',
        streams: [
            {
                level: 'fatal',
                stream: process.stdout,
            },
        ],
    });
    logger.fatal(`${logLevelToCheck} is not a valid log level. terminating...`);
    process.exit(1);
}
exports.validateLogLevel = validateLogLevel;
// Can't use `util/regex` because of circular reference to logger
const urlRe = /[a-z]{3,9}:\/\/[-;:&=+$,\w]+@[a-z0-9.-]+/gi;
const urlCredRe = /\/\/[^@]+@/g;
function sanitizeUrls(text) {
    return text.replace(urlRe, (url) => {
        return url.replace(urlCredRe, '//**redacted**@');
    });
}
exports.sanitizeUrls = sanitizeUrls;
//# sourceMappingURL=utils.js.map