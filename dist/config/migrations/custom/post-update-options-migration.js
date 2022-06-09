"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PostUpdateOptionsMigration = void 0;
const tslib_1 = require("tslib");
const is_1 = tslib_1.__importDefault(require("@sindresorhus/is"));
const abstract_migration_1 = require("../base/abstract-migration");
class PostUpdateOptionsMigration extends abstract_migration_1.AbstractMigration {
    constructor() {
        super(...arguments);
        this.propertyName = 'postUpdateOptions';
    }
    run(value) {
        if (Array.isArray(value)) {
            const newValue = value
                .filter(is_1.default.nonEmptyString)
                .filter((option) => option !== 'gomodNoMassage');
            this.rewrite(newValue);
        }
    }
}
exports.PostUpdateOptionsMigration = PostUpdateOptionsMigration;
//# sourceMappingURL=post-update-options-migration.js.map