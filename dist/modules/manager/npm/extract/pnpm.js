"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.detectPnpmWorkspaces = exports.findPnpmWorkspace = exports.extractPnpmFilters = void 0;
const tslib_1 = require("tslib");
const is_1 = tslib_1.__importDefault(require("@sindresorhus/is"));
const find_packages_1 = tslib_1.__importDefault(require("find-packages"));
const js_yaml_1 = require("js-yaml");
const upath_1 = tslib_1.__importDefault(require("upath"));
const global_1 = require("../../../../config/global");
const logger_1 = require("../../../../logger");
const fs_1 = require("../../../../util/fs");
async function extractPnpmFilters(fileName) {
    try {
        const contents = (0, js_yaml_1.load)(await (0, fs_1.readLocalFile)(fileName, 'utf8'), {
            json: true,
        });
        if (!Array.isArray(contents.packages) ||
            !contents.packages.every((item) => is_1.default.string(item))) {
            logger_1.logger.trace({ fileName }, 'Failed to find required "packages" array in pnpm-workspace.yaml');
            return undefined;
        }
        return contents.packages;
    }
    catch (err) {
        logger_1.logger.trace({ fileName, err }, 'Failed to parse pnpm-workspace.yaml');
        return undefined;
    }
}
exports.extractPnpmFilters = extractPnpmFilters;
async function findPnpmWorkspace(packageFile) {
    // search for pnpm-workspace.yaml
    const workspaceYamlPath = await (0, fs_1.findLocalSiblingOrParent)(packageFile, 'pnpm-workspace.yaml');
    if (!workspaceYamlPath) {
        logger_1.logger.trace({ packageFile }, 'Failed to locate pnpm-workspace.yaml in a parent directory.');
        return null;
    }
    // search for pnpm-lock.yaml next to pnpm-workspace.yaml
    const pnpmLockfilePath = (0, fs_1.getSiblingFileName)(workspaceYamlPath, 'pnpm-lock.yaml');
    if (!(await (0, fs_1.localPathExists)(pnpmLockfilePath))) {
        logger_1.logger.trace({ workspaceYamlPath, packageFile }, 'Failed to find a pnpm-lock.yaml sibling for the workspace.');
        return null;
    }
    return {
        lockFilePath: pnpmLockfilePath,
        workspaceYamlPath,
    };
}
exports.findPnpmWorkspace = findPnpmWorkspace;
async function detectPnpmWorkspaces(packageFiles) {
    logger_1.logger.debug(`Detecting pnpm Workspaces`);
    const packagePathCache = new Map();
    for (const p of packageFiles) {
        const { packageFile, pnpmShrinkwrap } = p;
        // check if pnpmShrinkwrap-file has already been provided
        if (pnpmShrinkwrap) {
            logger_1.logger.trace({ packageFile, pnpmShrinkwrap }, 'Found an existing pnpm shrinkwrap file; skipping pnpm monorepo check.');
            continue;
        }
        // search for corresponding pnpm workspace
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
        const pnpmWorkspace = await findPnpmWorkspace(packageFile);
        if (pnpmWorkspace === null) {
            continue;
        }
        const { workspaceYamlPath, lockFilePath } = pnpmWorkspace;
        // check if package matches workspace filter
        if (!packagePathCache.has(workspaceYamlPath)) {
            const filters = await extractPnpmFilters(workspaceYamlPath);
            const { localDir } = global_1.GlobalConfig.get();
            const packages = await (0, find_packages_1.default)(upath_1.default.dirname(upath_1.default.join(localDir, workspaceYamlPath)), { patterns: filters });
            const packagePaths = packages.map((pkg) => upath_1.default.join(pkg.dir, 'package.json'));
            packagePathCache.set(workspaceYamlPath, packagePaths);
        }
        const packagePaths = packagePathCache.get(workspaceYamlPath);
        const isPackageInWorkspace = packagePaths?.some((p) => 
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
        p.endsWith(packageFile));
        if (isPackageInWorkspace) {
            p.pnpmShrinkwrap = lockFilePath;
        }
        else {
            logger_1.logger.trace({ packageFile, workspaceYamlPath }, `Didn't find the package in the pnpm workspace`);
        }
    }
}
exports.detectPnpmWorkspaces = detectPnpmWorkspaces;
//# sourceMappingURL=pnpm.js.map