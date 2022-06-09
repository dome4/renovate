"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AbstractMigration = void 0;
const tslib_1 = require("tslib");
const is_1 = tslib_1.__importDefault(require("@sindresorhus/is"));
class AbstractMigration {
    constructor(originalConfig, migratedConfig) {
        this.deprecated = false;
        this.originalConfig = originalConfig;
        this.migratedConfig = migratedConfig;
    }
    get(key) {
        return this.migratedConfig[key] ?? this.originalConfig[key];
    }
    has(key) {
        return key in this.originalConfig;
    }
    setSafely(key, value) {
        if (is_1.default.nullOrUndefined(this.originalConfig[key]) &&
            is_1.default.nullOrUndefined(this.migratedConfig[key])) {
            this.migratedConfig[key] = value;
        }
    }
    setHard(key, value) {
        this.migratedConfig[key] = value;
    }
    rewrite(value) {
        if (!is_1.default.string(this.propertyName)) {
            throw new Error();
        }
        this.setHard(this.propertyName, value);
    }
    delete(property = this.propertyName) {
        if (!is_1.default.string(property)) {
            throw new Error();
        }
        delete this.migratedConfig[property];
    }
}
exports.AbstractMigration = AbstractMigration;
//# sourceMappingURL=abstract-migration.js.map