"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PackageFiles = void 0;
const logger_1 = require("../../logger");
class PackageFiles {
    static add(baseBranch, packageFiles) {
        logger_1.logger.debug({ baseBranch }, `PackageFiles.add() - Package file saved for branch`);
        this.data.set(baseBranch, packageFiles);
    }
    static clear() {
        logger_1.logger.debug({ baseBranches: [...this.data.keys()] }, 'PackageFiles.clear() - Package files deleted');
        this.data.clear();
    }
    static getDashboardMarkdown(config) {
        const title = `## Detected dependencies\n\n`;
        const none = 'None detected\n\n';
        const pad = this.data.size > 1; // padding condition for a multi base branch repo
        let deps = '';
        for (const [branch, packageFiles] of this.data) {
            deps += pad
                ? `<details><summary>Branch ${branch}</summary>\n<blockquote>\n\n`
                : '';
            if (packageFiles === null) {
                deps += none;
                deps += pad ? '</blockquote>\n</details>\n\n' : '';
                continue;
            }
            const managers = Object.keys(packageFiles);
            if (managers.length === 0) {
                deps += none;
                deps += pad ? '</blockquote>\n</details>\n\n' : '';
                continue;
            }
            const placeHolder = `no version found`;
            for (const manager of managers) {
                deps += `<details><summary>${manager}</summary>\n<blockquote>\n\n`;
                for (const packageFile of packageFiles[manager]) {
                    deps += `<details><summary>${packageFile.packageFile}</summary>\n\n`;
                    for (const dep of packageFile.deps) {
                        const ver = dep.currentValue;
                        const digest = dep.currentDigest;
                        const version = ver && digest
                            ? `${ver}@${digest}`
                            : `${digest ?? ver ?? placeHolder}`;
                        deps += ` - \`${dep.depName} ${version}\`\n`;
                    }
                    deps += '\n</details>\n\n';
                }
                deps += `</blockquote>\n</details>\n\n`;
            }
            deps += pad ? '</blockquote>\n</details>\n\n' : '';
        }
        return title + deps;
    }
}
exports.PackageFiles = PackageFiles;
PackageFiles.data = new Map();
//# sourceMappingURL=package-files.js.map