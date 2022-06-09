"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isScheduledNow = exports.hasValidSchedule = exports.hasValidTimezone = void 0;
const tslib_1 = require("tslib");
const later_1 = tslib_1.__importDefault(require("@breejs/later"));
const mi_cron_1 = require("@cheap-glitch/mi-cron");
const is_1 = tslib_1.__importDefault(require("@sindresorhus/is"));
const luxon_1 = require("luxon");
const migration_1 = require("../../../../config/migration");
const logger_1 = require("../../../../logger");
const minutesChar = '*';
const scheduleMappings = {
    'every month': 'before 3am on the first day of the month',
    monthly: 'before 3am on the first day of the month',
};
function hasValidTimezone(timezone) {
    if (!luxon_1.DateTime.local().setZone(timezone).isValid) {
        return [false, `Invalid schedule: Unsupported timezone ${timezone}`];
    }
    return [true];
}
exports.hasValidTimezone = hasValidTimezone;
function hasValidSchedule(schedule) {
    let message = '';
    if (!schedule ||
        schedule === 'at any time' ||
        schedule[0] === 'at any time') {
        return [true];
    }
    // check if any of the schedules fail to parse
    const hasFailedSchedules = schedule.some((scheduleText) => {
        const parsedCron = (0, mi_cron_1.parseCron)(scheduleText);
        if (parsedCron !== undefined) {
            if (parsedCron.minutes.length !== 60 ||
                scheduleText.indexOf(minutesChar) !== 0) {
                message = `Invalid schedule: "${scheduleText}" has cron syntax, but doesn't have * as minutes`;
                return true;
            }
            // It was valid cron syntax and * as minutes
            return false;
        }
        const massagedText = (0, migration_1.fixShortHours)(scheduleMappings[scheduleText] || scheduleText);
        const parsedSchedule = later_1.default.parse.text(massagedText);
        if (parsedSchedule.error !== -1) {
            message = `Invalid schedule: Failed to parse "${scheduleText}"`;
            // It failed to parse
            return true;
        }
        if (parsedSchedule.schedules.some((s) => s.m)) {
            message = `Invalid schedule: "${scheduleText}" should not specify minutes`;
            return true;
        }
        if (!parsedSchedule.schedules.some((s) => !!s.M || s.d !== undefined || !!s.D || s.t_a !== undefined || !!s.t_b)) {
            message = `Invalid schedule: "${scheduleText}" has no months, days of week or time of day`;
            return true;
        }
        // It must be OK
        return false;
    });
    if (hasFailedSchedules) {
        // If any fail then we invalidate the whole thing
        return [false, message];
    }
    return [true];
}
exports.hasValidSchedule = hasValidSchedule;
function cronMatches(cron, now) {
    const parsedCron = (0, mi_cron_1.parseCron)(cron);
    // istanbul ignore if: doesn't return undefined but type will include undefined
    if (!parsedCron) {
        return false;
    }
    if (parsedCron.hours.indexOf(now.hour) === -1) {
        // Hours mismatch
        return false;
    }
    if (parsedCron.days.indexOf(now.day) === -1) {
        // Days mismatch
        return false;
    }
    if (parsedCron.weekDays.indexOf(now.weekday) === -1) {
        // Weekdays mismatch
        return false;
    }
    if (parsedCron.months.indexOf(now.month) === -1) {
        // Months mismatch
        return false;
    }
    // Match
    return true;
}
function isScheduledNow(config, scheduleKey = 'schedule') {
    let configSchedule = config[scheduleKey];
    logger_1.logger.debug(`Checking schedule(${String(configSchedule)}, ${config.timezone})`);
    if (!configSchedule ||
        configSchedule.length === 0 ||
        configSchedule[0] === '' ||
        configSchedule[0] === 'at any time') {
        logger_1.logger.debug('No schedule defined');
        return true;
    }
    if (!is_1.default.array(configSchedule)) {
        logger_1.logger.warn(`config schedule is not an array: ${JSON.stringify(configSchedule)}`);
        configSchedule = [configSchedule];
    }
    const validSchedule = hasValidSchedule(configSchedule);
    if (!validSchedule[0]) {
        logger_1.logger.warn(validSchedule[1]);
        return true;
    }
    let now = luxon_1.DateTime.local();
    logger_1.logger.trace(`now=${now.toISO()}`);
    // Adjust the time if repo is in a different timezone to renovate
    if (config.timezone) {
        logger_1.logger.debug({ timezone: config.timezone }, 'Found timezone');
        const validTimezone = hasValidTimezone(config.timezone);
        if (!validTimezone[0]) {
            logger_1.logger.warn(validTimezone[1]);
            return true;
        }
        logger_1.logger.debug('Adjusting now for timezone');
        now = now.setZone(config.timezone);
        logger_1.logger.trace(`now=${now.toISO()}`);
    }
    const currentDay = now.weekday;
    logger_1.logger.trace(`currentDay=${currentDay}`);
    // Get the number of seconds since midnight
    const currentSeconds = now
        .startOf('second')
        .diff(now.startOf('day'), 'seconds').seconds;
    logger_1.logger.trace(`currentSeconds=${currentSeconds}`);
    // Support a single string but massage to array for processing
    logger_1.logger.debug(`Checking ${configSchedule.length} schedule(s)`);
    // later is timezone agnostic (as in, it purely relies on the underlying UTC date/time that is stored in the Date),
    // which means we have to pass it a Date that has an underlying UTC date/time in the same timezone as the schedule
    const jsNow = now.setZone('utc', { keepLocalTime: true }).toJSDate();
    // We run if any schedule matches
    const isWithinSchedule = configSchedule.some((scheduleText) => {
        const cronSchedule = (0, mi_cron_1.parseCron)(scheduleText);
        if (cronSchedule) {
            // We have Cron syntax
            if (cronMatches(scheduleText, now)) {
                logger_1.logger.debug(`Matches schedule ${scheduleText}`);
                return true;
            }
        }
        else {
            // We have Later syntax
            const massagedText = scheduleMappings[scheduleText] || scheduleText;
            const parsedSchedule = later_1.default.parse.text((0, migration_1.fixShortHours)(massagedText));
            logger_1.logger.debug({ parsedSchedule }, `Checking schedule "${scheduleText}"`);
            if (later_1.default.schedule(parsedSchedule).isValid(jsNow)) {
                logger_1.logger.debug(`Matches schedule ${scheduleText}`);
                return true;
            }
        }
        return false;
    });
    if (!isWithinSchedule) {
        logger_1.logger.debug('Package not scheduled');
        return false;
    }
    return true;
}
exports.isScheduledNow = isScheduledNow;
//# sourceMappingURL=schedule.js.map