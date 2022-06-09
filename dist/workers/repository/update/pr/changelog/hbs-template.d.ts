declare const _default: "### Release Notes\n\n{{#each upgrades as |upgrade|}}\n\n{{#if upgrade.hasReleaseNotes}}\n\n<details>\n<summary>{{upgrade.releaseNotesSummaryTitle}}</summary>\n\n{{#each upgrade.releases as |release|}}\n\n{{#if release.releaseNotes}}\n\n### [`v{{{release.version}}}`]({{{release.releaseNotes.url}}})\n\n{{#if release.compare.url}}\n\n[Compare Source]({{release.compare.url}})\n\n{{/if}}\n\n{{{release.releaseNotes.body}}}\n\n{{/if}}\n\n{{/each}}\n\n</details>\n\n{{/if}}\n\n{{/each}}";
export default _default;
