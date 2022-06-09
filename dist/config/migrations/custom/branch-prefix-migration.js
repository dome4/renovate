"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BranchPrefixMigration = void 0;
const tslib_1 = require("tslib");
const is_1 = tslib_1.__importDefault(require("@sindresorhus/is"));
const abstract_migration_1 = require("../base/abstract-migration");
class BranchPrefixMigration extends abstract_migration_1.AbstractMigration {
    constructor() {
        super(...arguments);
        this.propertyName = 'branchPrefix';
    }
    run(value) {
        if (is_1.default.string(value) && value.includes('{{')) {
            const templateIndex = value.indexOf(`{{`);
            this.rewrite(value.substring(0, templateIndex));
            this.setHard('additionalBranchPrefix', value.substring(templateIndex));
        }
    }
}
exports.BranchPrefixMigration = BranchPrefixMigration;
//# sourceMappingURL=branch-prefix-migration.js.map