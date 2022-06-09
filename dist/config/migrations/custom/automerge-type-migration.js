"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AutomergeTypeMigration = void 0;
const tslib_1 = require("tslib");
const is_1 = tslib_1.__importDefault(require("@sindresorhus/is"));
const abstract_migration_1 = require("../base/abstract-migration");
class AutomergeTypeMigration extends abstract_migration_1.AbstractMigration {
    constructor() {
        super(...arguments);
        this.propertyName = 'automergeType';
    }
    run(value) {
        if (is_1.default.string(value) && value.startsWith('branch-')) {
            this.rewrite('branch');
        }
    }
}
exports.AutomergeTypeMigration = AutomergeTypeMigration;
//# sourceMappingURL=automerge-type-migration.js.map