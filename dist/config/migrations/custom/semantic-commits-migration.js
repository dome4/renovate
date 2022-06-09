"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SemanticCommitsMigration = void 0;
const tslib_1 = require("tslib");
const is_1 = tslib_1.__importDefault(require("@sindresorhus/is"));
const abstract_migration_1 = require("../base/abstract-migration");
class SemanticCommitsMigration extends abstract_migration_1.AbstractMigration {
    constructor() {
        super(...arguments);
        this.propertyName = 'semanticCommits';
    }
    run(value) {
        if (is_1.default.boolean(value)) {
            this.rewrite(value ? 'enabled' : 'disabled');
        }
        else if (value !== 'enabled' && value !== 'disabled') {
            this.rewrite('auto');
        }
    }
}
exports.SemanticCommitsMigration = SemanticCommitsMigration;
//# sourceMappingURL=semantic-commits-migration.js.map