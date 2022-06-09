"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseDepsEdnFile = void 0;
const tslib_1 = require("tslib");
const is_1 = tslib_1.__importDefault(require("@sindresorhus/is"));
const moo_1 = tslib_1.__importDefault(require("moo"));
const logger_1 = require("../../../logger");
const lexerStates = {
    main: {
        comma: { match: ',' },
        lineComment: { match: /;.*?$/ },
        leftParen: { match: '(' },
        rightParen: { match: ')' },
        leftSquare: { match: '[' },
        rightSquare: { match: ']' },
        leftFigure: { match: '{' },
        rightFigure: { match: '}' },
        longDoubleQuoted: {
            match: '"""',
            push: 'longDoubleQuoted',
        },
        doubleQuoted: {
            match: '"',
            push: 'doubleQuoted',
        },
        // https://clojure.org/reference/reader#_reader_forms
        keyword: {
            match: /:(?:[a-zA-Z*+!_'?<>=.-][a-zA-Z0-9*+!_'?<>=.-]*)(?:\/(?:[a-zA-Z*+!_'?<>=.-][a-zA-Z0-9*+!_'?<>=.-]*))?/,
            value: (x) => x.slice(1),
        },
        symbol: {
            match: /(?:[a-zA-Z*+!_'?<>=.-][a-zA-Z0-9*+!_'?<>=.-]*)(?:\/(?:[a-zA-Z*+!_'?<>=.-][a-zA-Z0-9*+!_'?<>=.-]*))?/,
        },
        double: {
            match: /(?:[0-9]+\.[0-9]*|[0-9]*\.[0-9]+)(?:[eE][+-]?[0-9]+)?|(?:[0-9]+[eE][+-]?[0-9]+)/,
        },
        rational: { match: /[0-9]+\/[0-9]+/ },
        integer: { match: /(?:0x[0-9a-fA-F]+|[0-9]+r[0-9a-zA-Z]+|[0-9]+)/ },
        unknown: moo_1.default.fallback,
    },
    longDoubleQuoted: {
        stringFinish: { match: '"""', pop: 1 },
        stringContent: moo_1.default.fallback,
    },
    doubleQuoted: {
        stringFinish: { match: '"', pop: 1 },
        stringContent: moo_1.default.fallback,
    },
};
const lexer = moo_1.default.states(lexerStates);
function parseDepsEdnFile(content) {
    lexer.reset(content);
    const tokens = [...lexer];
    lexer.reset();
    const stack = [];
    let state = { type: 'root', data: null };
    const metadata = new WeakMap();
    const popState = () => {
        const savedState = stack.pop();
        if (!savedState) {
            return false;
        }
        if (savedState.type === 'root') {
            savedState.data = state.data;
            state = savedState;
            return false;
        }
        if (savedState.type === 'record') {
            if (savedState.skipKey) {
                savedState.currentKey = null;
                savedState.skipKey = false;
            }
            else if (savedState.currentKey) {
                savedState.data[savedState.currentKey] = state.data;
                savedState.currentKey = null;
            }
            else {
                savedState.skipKey = true;
            }
        }
        if (savedState.type === 'array') {
            savedState.data.push(state.data);
        }
        state = savedState;
        return true;
    };
    for (const token of tokens) {
        const tokenType = token.type;
        const stateType = state.type;
        // istanbul ignore else: token type comprehension
        if (tokenType === 'lineComment' ||
            tokenType === 'unknown' ||
            tokenType === 'doubleQuoted' ||
            tokenType === 'longDoubleQuoted' ||
            tokenType === 'stringFinish' ||
            tokenType === 'comma') {
            continue;
        }
        else if (tokenType === 'rightParen' ||
            tokenType === 'rightSquare' ||
            tokenType === 'rightFigure') {
            if (state.type === 'record' || state.type === 'array') {
                const { startIndex } = state;
                const endIndex = token.offset + token.value.length;
                const replaceString = content.slice(startIndex, endIndex);
                metadata.set(state.data, { replaceString });
            }
            if (!popState()) {
                break;
            }
        }
        else if (tokenType === 'leftParen' || tokenType === 'leftSquare') {
            stack.push(state);
            state = {
                type: 'array',
                startIndex: token.offset,
                data: [],
            };
        }
        else if (tokenType === 'leftFigure') {
            stack.push(state);
            state = {
                type: 'record',
                startIndex: token.offset,
                data: {},
                skipKey: false,
                currentKey: null,
            };
        }
        else if (tokenType === 'symbol' ||
            tokenType === 'keyword' ||
            tokenType === 'stringContent' ||
            tokenType === 'double' ||
            tokenType === 'rational' ||
            tokenType === 'integer') {
            if (stateType === 'record') {
                if (state.skipKey) {
                    state.currentKey = null;
                    state.skipKey = false;
                }
                else if (state.currentKey) {
                    state.data[state.currentKey] = token.value;
                    state.currentKey = null;
                }
                else {
                    state.currentKey = token.value;
                }
            }
            else if (stateType === 'array') {
                state.data.push(token.value);
            }
            else if (stateType === 'root') {
                state.data = token.value;
            }
        }
        else {
            const unknownType = tokenType;
            logger_1.logger.debug({ unknownType }, `Unknown token type for "deps.edn"`);
        }
    }
    while (stack.length) {
        popState();
    }
    if (is_1.default.plainObject(state.data)) {
        return { data: state.data, metadata };
    }
    return null;
}
exports.parseDepsEdnFile = parseDepsEdnFile;
//# sourceMappingURL=parser.js.map