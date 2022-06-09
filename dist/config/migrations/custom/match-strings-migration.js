"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MatchStringsMigration = void 0;
const tslib_1 = require("tslib");
const is_1 = tslib_1.__importDefault(require("@sindresorhus/is"));
const regex_1 = require("../../../util/regex");
const abstract_migration_1 = require("../base/abstract-migration");
class MatchStringsMigration extends abstract_migration_1.AbstractMigration {
    constructor() {
        super(...arguments);
        this.propertyName = 'matchStrings';
    }
    run(value) {
        if (Array.isArray(value)) {
            const newValue = value
                .filter(is_1.default.nonEmptyString)
                .map((matchString) => matchString.replace((0, regex_1.regEx)(/\(\?<lookupName>/g), '(?<packageName>'));
            this.rewrite(newValue);
        }
    }
}
exports.MatchStringsMigration = MatchStringsMigration;
//# sourceMappingURL=match-strings-migration.js.map