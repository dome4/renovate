"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.IgnoreNpmrcFileMigration = void 0;
const tslib_1 = require("tslib");
const is_1 = tslib_1.__importDefault(require("@sindresorhus/is"));
const abstract_migration_1 = require("../base/abstract-migration");
class IgnoreNpmrcFileMigration extends abstract_migration_1.AbstractMigration {
    constructor() {
        super(...arguments);
        this.deprecated = true;
        this.propertyName = 'ignoreNpmrcFile';
    }
    run() {
        const npmrc = this.get('npmrc');
        if (!is_1.default.string(npmrc)) {
            this.setHard('npmrc', '');
        }
    }
}
exports.IgnoreNpmrcFileMigration = IgnoreNpmrcFileMigration;
//# sourceMappingURL=ignore-npmrc-file-migration.js.map