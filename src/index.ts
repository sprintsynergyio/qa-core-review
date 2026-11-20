// Public API of qa-core-review.
export { VERSION } from './version.js';

// The normalized test model (SPEC.md Section 8.1).
export {
  ASSERTION_KINDS, CAPABILITIES, FRAMEWORK_IDS, LANGUAGE_IDS, MODIFIERS, PARSE_STATUSES, SELECTOR_STRATEGIES,
} from './model/types.js';
export type {
  AssertionKind, Capability, FrameworkId, LanguageId, Modifier, ParseStatus, SelectorStrategy, Span, Tier,
  NAssertion, NDataOp, NExpr, NFile, NHook, NImport, NMock, NResource, NSelector, NStep, NSuite, NSuppression,
  NTest, NTryBlock, NWait,
} from './model/types.js';
export { testId } from './model/hash.js';

// The adapter interface and registry (SPEC.md Section 7.3).
export { AdapterRegistry, adapterProblems, builtinAdapters, createRegistry } from './adapters/index.js';
export type {
  AdapterContext, DetectedProject, FrameworkDescriptor, FrameworkGuess, HelperDef, HelperIndex, LanguageAdapter,
  ParsedFile, ProjectMarker, ProjectProbe, SourceFile, SyntaxTree, TreeSitterService,
} from './adapters/types.js';

// Rules, findings and the report (SPEC.md Sections 7.3 and 8.2).
export type {
  Confidence, Decision, FileResult, Finding, FindingDraft, Location, Report, Rule, RuleContext, Severity,
  SkippedRule, Source, TestResult, Verdict,
} from './rules/types.js';
export { missingCapabilities, selectRules, skipReason } from './engine/capabilities.js';
export type { RuleSelection } from './engine/capabilities.js';

export type { ResolvedConfig, RuleSetting } from './config/types.js';
