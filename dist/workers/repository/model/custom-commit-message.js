"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CustomCommitMessage = void 0;
const commit_message_1 = require("./commit-message");
class CustomCommitMessage extends commit_message_1.CommitMessage {
    constructor() {
        super(...arguments);
        this._prefix = '';
    }
    get prefix() {
        return this._prefix;
    }
    set prefix(value) {
        this._prefix = this.normalizeInput(value);
    }
    toJSON() {
        const json = super.toJSON();
        return {
            ...json,
            prefix: this._prefix,
        };
    }
}
exports.CustomCommitMessage = CustomCommitMessage;
//# sourceMappingURL=custom-commit-message.js.map