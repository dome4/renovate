"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UNKNOWN_ERROR = exports.BUNDLER_INVALID_CREDENTIALS = exports.WORKER_FILE_UPDATE_FAILED = exports.HOST_DISABLED = exports.IGNORABLE_HOST_ERROR = exports.EXTERNAL_HOST_ERROR = exports.MANAGER_LOCKFILE_ERROR = exports.NO_VULNERABILITY_ALERTS = exports.TEMPORARY_ERROR = exports.REPOSITORY_CHANGED = exports.REPOSITORY_UNINITIATED = exports.REPOSITORY_RENAMED = exports.REPOSITORY_NO_PACKAGE_FILES = exports.REPOSITORY_NOT_FOUND = exports.REPOSITORY_MIRRORED = exports.REPOSITORY_FORKED = exports.REPOSITORY_EMPTY = exports.REPOSITORY_NO_CONFIG = exports.REPOSITORY_DISABLED_BY_CONFIG = exports.REPOSITORY_CLOSED_ONBOARDING = exports.REPOSITORY_DISABLED = exports.REPOSITORY_CANNOT_FORK = exports.REPOSITORY_BLOCKED = exports.REPOSITORY_ARCHIVED = exports.REPOSITORY_ACCESS_FORBIDDEN = exports.CONFIG_GIT_URL_UNAVAILABLE = exports.CONFIG_SECRETS_INVALID = exports.CONFIG_SECRETS_EXPOSED = exports.CONFIG_PRESETS_INVALID = exports.CONFIG_VALIDATION = exports.PLATFORM_RATE_LIMIT_EXCEEDED = exports.PLATFORM_NOT_FOUND = exports.PLATFORM_INTEGRATION_UNAUTHORIZED = exports.PLATFORM_GPG_FAILED = exports.PLATFORM_BAD_CREDENTIALS = exports.PLATFORM_AUTHENTICATION_ERROR = exports.SYSTEM_INSUFFICIENT_MEMORY = exports.SYSTEM_INSUFFICIENT_DISK_SPACE = void 0;
// System error
exports.SYSTEM_INSUFFICIENT_DISK_SPACE = 'disk-space';
exports.SYSTEM_INSUFFICIENT_MEMORY = 'out-of-memory';
// Platform Error
exports.PLATFORM_AUTHENTICATION_ERROR = 'authentication-error';
exports.PLATFORM_BAD_CREDENTIALS = 'bad-credentials';
exports.PLATFORM_GPG_FAILED = 'gpg-failed';
exports.PLATFORM_INTEGRATION_UNAUTHORIZED = 'integration-unauthorized';
exports.PLATFORM_NOT_FOUND = 'platform-not-found';
exports.PLATFORM_RATE_LIMIT_EXCEEDED = 'rate-limit-exceeded';
// Config Error
exports.CONFIG_VALIDATION = 'config-validation';
exports.CONFIG_PRESETS_INVALID = 'config-presets-invalid';
exports.CONFIG_SECRETS_EXPOSED = 'config-secrets-exposed';
exports.CONFIG_SECRETS_INVALID = 'config-secrets-invalid';
exports.CONFIG_GIT_URL_UNAVAILABLE = 'config-git-url-unavailable';
// Repository Errors - causes repo to be considered as disabled
exports.REPOSITORY_ACCESS_FORBIDDEN = 'forbidden';
exports.REPOSITORY_ARCHIVED = 'archived';
exports.REPOSITORY_BLOCKED = 'blocked';
exports.REPOSITORY_CANNOT_FORK = 'cannot-fork';
exports.REPOSITORY_DISABLED = 'disabled';
exports.REPOSITORY_CLOSED_ONBOARDING = 'disabled-closed-onboarding';
exports.REPOSITORY_DISABLED_BY_CONFIG = 'disabled-by-config';
exports.REPOSITORY_NO_CONFIG = 'disabled-no-config';
exports.REPOSITORY_EMPTY = 'empty';
exports.REPOSITORY_FORKED = 'fork';
exports.REPOSITORY_MIRRORED = 'mirror';
exports.REPOSITORY_NOT_FOUND = 'not-found';
exports.REPOSITORY_NO_PACKAGE_FILES = 'no-package-files';
exports.REPOSITORY_RENAMED = 'renamed';
exports.REPOSITORY_UNINITIATED = 'uninitiated';
// Temporary Error
exports.REPOSITORY_CHANGED = 'repository-changed';
exports.TEMPORARY_ERROR = 'temporary-error';
exports.NO_VULNERABILITY_ALERTS = 'no-vulnerability-alerts';
// Manager Error
exports.MANAGER_LOCKFILE_ERROR = 'lockfile-error';
// Host error
exports.EXTERNAL_HOST_ERROR = 'external-host-error';
exports.IGNORABLE_HOST_ERROR = 'ignorable-host-error';
exports.HOST_DISABLED = 'host-disabled';
// Worker Error
exports.WORKER_FILE_UPDATE_FAILED = 'update-failure';
// Bundler Error
exports.BUNDLER_INVALID_CREDENTIALS = 'bundler-credentials';
// Unknown Error
exports.UNKNOWN_ERROR = 'unknown-error';
//# sourceMappingURL=error-messages.js.map