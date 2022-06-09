"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SemanticCommitMessage = void 0;
const commit_message_1 = require("./commit-message");
/**
 * @see https://www.conventionalcommits.org/en/v1.0.0/#summary
 *
 * <type>[optional scope]: <description>
 * [optional body]
 * [optional footer]
 */
class SemanticCommitMessage extends commit_message_1.CommitMessage {
    constructor() {
        super(...arguments);
        this._scope = '';
        this._type = '';
    }
    static is(value) {
        return value instanceof SemanticCommitMessage;
    }
    static fromString(value) {
        const match = value.match(SemanticCommitMessage.REGEXP);
        if (!match) {
            return undefined;
        }
        const { groups = {} } = match;
        const message = new SemanticCommitMessage();
        message.type = groups.type;
        message.scope = groups.scope;
        message.subject = groups.description;
        return message;
    }
    toJSON() {
        const json = super.toJSON();
        return {
            ...json,
            scope: this._scope,
            type: this._type,
        };
    }
    set scope(value) {
        this._scope = this.normalizeInput(value);
    }
    set type(value) {
        this._type = this.normalizeInput(value);
    }
    get prefix() {
        if (this._type && !this._scope) {
            return this._type;
        }
        if (this._scope) {
            return `${this._type}(${this._scope})`;
        }
        return '';
    }
}
exports.SemanticCommitMessage = SemanticCommitMessage;
SemanticCommitMessage.REGEXP = /^(?<type>[\w]+)(\((?<scope>[\w-]+)\))?(?<breaking>!)?: ((?<issue>([A-Z]+-|#)[\d]+) )?(?<description>.*)/;
//# sourceMappingURL=semantic-commit-message.js.map