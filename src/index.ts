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
export { bodyHash, testId } from './model/hash.js';
export { createHelperIndex } from './model/helpers-index.js';
export { clipText, emptyTest, parseSuppression } from './model/build.js';

// The adapter interface and registry (SPEC.md Section 7.3).
export { AdapterRegistry, adapterProblems, builtinAdapters, builtinProfiles, createRegistry } from './adapters/index.js';
export { GENERIC_LANGUAGES, languageHintFor } from './adapters/generic/languages.js';
export { jsAdapter, jsGrammarFor } from './adapters/js/adapter.js';
export { VOCAB_SURFACE as JS_VOCAB_SURFACE } from './adapters/js/vocab.js';
export type {
  AdapterContext, AdapterProfile, DetectedProject, FrameworkDescriptor, FrameworkGuess, HelperDef, HelperIndex, LanguageAdapter,
  ParsedFile, ProjectMarker, ProjectProbe, SourceFile, SyntaxTree, TreeSitterService,
} from './adapters/types.js';

// Project detection and file discovery (SPEC.md Section 7.4).
export { detectFromMarkers } from './detect/markers.js';
export type { MarkerRules } from './detect/markers.js';
export { createProbe } from './detect/probe.js';
export { ROOT_DIR, applyOverrides, detectProjects, nearestOverride, nearestProject } from './detect/projects.js';
export { buildDetectReport, formatDetectPretty } from './detect/report.js';
export type { DetectReport } from './detect/report.js';
export { MAX_SOURCE_BYTES, discover, listFiles, readSourceFile } from './discover/files.js';
export type { DiscoverOptions, DiscoveredFile, Discovery, FileList } from './discover/files.js';

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

// Config (SPEC.md Section 12).
export { CONFIG_FILE_NAMES, ConfigError, findConfigFile, loadConfig, resolveConfig } from './config/load.js';
export type { LoadConfigOptions, LoadedConfig } from './config/load.js';
export { DEFAULT_EXCLUDE, defaultConfigFile } from './config/defaults.js';
export { SUPPORTED_KEYWORDS, validateSchema } from './config/validate.js';
export type { SchemaProblem } from './config/validate.js';
export { parseYaml } from './config/yaml.js';
export type {
  ConfigSuppression, FailOn, GenericEntry, GenericPatterns, LlmMode, OutputFormat, ProjectOverride, ResolvedConfig, RuleSetting,
} from './config/types.js';

// Glob matching (SPEC.md Section 7.6).
export { createGlobMatcher, globToRegExp, matchGlob, toPosixPath } from './util/glob.js';
