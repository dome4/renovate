"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BranchNameMigration = void 0;
const tslib_1 = require("tslib");
const is_1 = tslib_1.__importDefault(require("@sindresorhus/is"));
const abstract_migration_1 = require("../base/abstract-migration");
class BranchNameMigration extends abstract_migration_1.AbstractMigration {
    constructor() {
        super(...arguments);
        this.propertyName = 'branchName';
    }
    run(value) {
        if (is_1.default.string(value) && value.includes('{{managerBranchPrefix}}')) {
            this.rewrite(value.replace('{{managerBranchPrefix}}', '{{additionalBranchPrefix}}'));
        }
    }
}
exports.BranchNameMigration = BranchNameMigration;
//# sourceMappingURL=branch-name-migration.js.map