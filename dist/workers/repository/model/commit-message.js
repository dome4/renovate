"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CommitMessage = void 0;
const tslib_1 = require("tslib");
const is_1 = tslib_1.__importDefault(require("@sindresorhus/is"));
/**
 * @see https://git-scm.com/docs/git-commit#_discussion
 *
 * [optional prefix]: <suject>
 * [optional body]
 * [optional footer]
 */
class CommitMessage {
    constructor() {
        this._body = '';
        this._footer = '';
        this._subject = '';
    }
    static formatPrefix(prefix) {
        if (!prefix) {
            return '';
        }
        if (prefix.endsWith(CommitMessage.SEPARATOR)) {
            return prefix;
        }
        return `${prefix}${CommitMessage.SEPARATOR}`;
    }
    toJSON() {
        return {
            body: this._body,
            footer: this._footer,
            subject: this._subject,
        };
    }
    toString() {
        const parts = [
            this.title,
            this._body,
            this._footer,
        ];
        return parts.filter(is_1.default.nonEmptyStringAndNotWhitespace).join('\n\n');
    }
    get title() {
        return [CommitMessage.formatPrefix(this.prefix), this.formatSubject()]
            .join(' ')
            .trim();
    }
    set body(value) {
        this._body = this.normalizeInput(value);
    }
    set footer(value) {
        this._footer = this.normalizeInput(value);
    }
    set subject(value) {
        this._subject = this.normalizeInput(value);
        this._subject = this._subject?.replace(CommitMessage.EXTRA_WHITESPACES, ' ');
    }
    formatSubject() {
        if (!this._subject) {
            return '';
        }
        if (this.prefix) {
            return this._subject.charAt(0).toLowerCase() + this._subject.slice(1);
        }
        return this._subject.charAt(0).toUpperCase() + this._subject.slice(1);
    }
    normalizeInput(value) {
        return value?.trim() ?? '';
    }
}
exports.CommitMessage = CommitMessage;
CommitMessage.SEPARATOR = ':';
CommitMessage.EXTRA_WHITESPACES = /\s+/g;
//# sourceMappingURL=commit-message.js.map