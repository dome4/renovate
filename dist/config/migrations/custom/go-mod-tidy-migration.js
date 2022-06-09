"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GoModTidyMigration = void 0;
const abstract_migration_1 = require("../base/abstract-migration");
class GoModTidyMigration extends abstract_migration_1.AbstractMigration {
    constructor() {
        super(...arguments);
        this.deprecated = true;
        this.propertyName = 'gomodTidy';
    }
    run(value) {
        const postUpdateOptions = this.get('postUpdateOptions');
        if (value) {
            const newPostUpdateOptions = Array.isArray(postUpdateOptions)
                ? postUpdateOptions.concat(['gomodTidy'])
                : ['gomodTidy'];
            this.setHard('postUpdateOptions', newPostUpdateOptions);
        }
    }
}
exports.GoModTidyMigration = GoModTidyMigration;
//# sourceMappingURL=go-mod-tidy-migration.js.map