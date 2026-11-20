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

// Parsing (SPEC.md Section 7.2).
export { ERROR_RATIO_LIMIT, createTreeSitterService, errorRatio } from './parse/treesitter.js';
export type { GrammarInfo, GrammarManifest, ParseResult, SyntaxNode, SyntaxQuery, TreeSitterOptions } from './parse/treesitter.js';
export { JAVA_LEXICAL, JS_LEXICAL, PYTHON_LEXICAL, lexicalSyntaxFor, scanLines, segments } from './parse/lexical.js';
export type { LexicalSyntax, ScannedLine, Segment, StringDelimiter } from './parse/lexical.js';
export { LineIndex, spanOfNode, toLf } from './parse/positions.js';
export { ASSET_DIRS, assetPath, readAsset, readAssetText, readParserRuntime } from './assets.js';

// Rules, findings and the report (SPEC.md Sections 7.3 and 8.2).
export type {
  Confidence, Decision, FileResult, Finding, FindingDraft, Location, Report, Rule, RuleContext, Severity,
  SkippedRule, Source, TestResult, Verdict,
} from './rules/types.js';
export { missingCapabilities, selectRules, skipReason } from './engine/capabilities.js';
export type { RuleSelection } from './engine/capabilities.js';

export type { ResolvedConfig, RuleSetting } from './config/types.js';
