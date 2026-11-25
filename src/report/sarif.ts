// The SARIF 2.1.0 report (SPEC.md Section 11.5), for GitHub code scanning and other viewers.
// Suppressed findings are left out.
import { docsUrlFor } from '../rules/index.js';
import type { Finding, Report, Rule, Severity } from '../rules/types.js';

const LEVELS: Readonly<Record<Severity, 'error' | 'warning' | 'note'>> = { error: 'error', warn: 'warning', info: 'note' };
export const SARIF_SCHEMA_URL = 'https://docs.oasis-open.org/sarif/sarif/v2.1.0/errata01/os/schemas/sarif-schema-2.1.0.json';
const REPO_URL = 'https://github.com/sprintsynergyio/qa-core-review';

/** 'A test with no assertion: it passes whatever the code does.' gives 'A test with no assertion'. */
function shortText(description: string): string {
  const end = description.search(/[.:](\s|$)/);
  return end > 0 ? description.slice(0, end) : description;
}

/** A path as a URI reference relative to the root: every part is percent-encoded. */
const uriOf = (file: string): string => file.split('/').map(encodeURIComponent).join('/');

/**
 * The report as a SARIF log: one run, one `rules` entry per rule that ran, one result per
 * finding that is not suppressed. `rules` gives the name, description and default level of
 * each rule id.
 */
export function formatSarif(report: Report, rules: ReadonlyArray<Pick<Rule, 'id' | 'name' | 'description' | 'defaultSeverity'>>): object {
  const open = report.findings.filter((finding) => !finding.suppressed);
  const known = new Map(rules.map((rule) => [rule.id, rule]));
  // A rule that gave a finding is listed even when it is not in rulesRun (a finding from the LLM review, for example).
  const ids = [...new Set([...report.rulesRun, ...open.map((finding) => finding.ruleId)])];
  const firstOf = new Map<string, Finding>();
  for (const finding of open) if (!firstOf.has(finding.ruleId)) firstOf.set(finding.ruleId, finding);
  const files = new Map(report.files.map((file) => [file.file, file]));

  return {
    $schema: SARIF_SCHEMA_URL,
    version: '2.1.0',
    runs: [{
      tool: {
        driver: {
          name: 'qa-core-review',
          version: report.tool.version,
          informationUri: REPO_URL,
          rules: ids.map((id) => {
            const rule = known.get(id);
            const description = rule?.description ?? firstOf.get(id)?.ruleName ?? id;
            return {
              id,
              name: rule?.name ?? firstOf.get(id)?.ruleName ?? id,
              shortDescription: { text: shortText(description) },
              fullDescription: { text: description },
              helpUri: docsUrlFor(id),
              defaultConfiguration: { level: LEVELS[rule?.defaultSeverity ?? firstOf.get(id)?.severity ?? 'warn'] },
            };
          }),
        },
      },
      results: open.map((finding) => {
        const file = files.get(finding.location.file);
        const { location } = finding;
        return {
          ruleId: finding.ruleId,
          ruleIndex: ids.indexOf(finding.ruleId),
          level: LEVELS[finding.severity],
          message: { text: finding.fix === '' ? finding.message : `${finding.message} ${finding.fix}` },
          locations: [{
            physicalLocation: {
              artifactLocation: { uri: uriOf(location.file), uriBaseId: '%SRCROOT%' },
              // SARIF wants an end that is not before the start. A finding with an empty range is one column wide.
              region: {
                startLine: location.startLine, startColumn: location.startColumn, endLine: Math.max(location.endLine, location.startLine),
                endColumn: location.endLine > location.startLine ? location.endColumn : Math.max(location.endColumn, location.startColumn),
              },
            },
          }],
          partialFingerprints: { 'qaCoreReview/v1': finding.id },
          properties: {
            language: file ? file.languageHint ?? file.language : null,
            framework: file?.runner ?? null,
            testTitle: file?.tests.find((test) => test.id === finding.testId)?.fullTitle ?? null,
            source: finding.source,
          },
        };
      }),
    }],
  };
}
