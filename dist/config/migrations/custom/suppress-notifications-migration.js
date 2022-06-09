"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SuppressNotificationsMigration = void 0;
const tslib_1 = require("tslib");
const is_1 = tslib_1.__importDefault(require("@sindresorhus/is"));
const abstract_migration_1 = require("../base/abstract-migration");
class SuppressNotificationsMigration extends abstract_migration_1.AbstractMigration {
    constructor() {
        super(...arguments);
        this.propertyName = 'suppressNotifications';
    }
    run(value) {
        if (is_1.default.nonEmptyArray(value) && value.includes('prEditNotification')) {
            const newValue = value.filter((item) => item !== 'prEditNotification');
            this.rewrite(newValue);
        }
    }
}
exports.SuppressNotificationsMigration = SuppressNotificationsMigration;
//# sourceMappingURL=suppress-notifications-migration.js.map