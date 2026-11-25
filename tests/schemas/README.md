# Schemas for tests

Third-party schemas that the report tests check the output against (`tests/reports.test.mjs`).
Both files are kept byte for byte as published. They are used by tests only and are not part of
the npm package.

| File | What it is | Source | License |
| --- | --- | --- | --- |
| `sarif-2.1.0.json` | The official JSON schema of SARIF 2.1.0 (Errata 01, OASIS Standard) | https://raw.githubusercontent.com/oasis-tcs/sarif-spec/main/sarif-2.1/schema/sarif-schema-2.1.0.json, also published as https://docs.oasis-open.org/sarif/sarif/v2.1.0/errata01/os/schemas/sarif-schema-2.1.0.json | OASIS IPR Policy, see https://github.com/oasis-tcs/sarif-spec/blob/main/LICENSE.md |
| `junit.xsd` | The JUnit XML schema of the Jenkins xUnit plugin (`junit-10.xsd`) | https://raw.githubusercontent.com/jenkinsci/xunit-plugin/master/src/main/resources/org/jenkinsci/plugins/xunit/types/model/xsd/junit-10.xsd | MIT, the license text is at the top of the file |

Downloaded on 2026-11-25.

sha256:

```
c3b4bb2d6093897483348925aaa73af03b3e3f4bd4ca38cef26dcb4212a2682e  sarif-2.1.0.json
a1a816f58d1bf95ebabf371994df0b9246dee66ea9572fbec4f9296f1b2c0ff6  junit.xsd
```

## How they are used

- **SARIF:** `sarifErrors` in `tests/helpers/schema.mjs` validates with Ajv. The schema is written
  for JSON Schema draft 04, which this Ajv does not read, so the helper adapts two keywords in
  memory (it drops the draft marker and renames `id` to `$id`). The file on disk is not changed.
- **JUnit:** `tests/helpers/xml.mjs` holds a small XML reader and a structural check that reads
  the XSD: which elements, attributes and text each element may hold, which attributes are
  required, and the pattern of the time type. It does not check the order or the number of child
  elements. There is no XML dependency.
- **Two additions to the XSD:** the report puts `file` and `line` on every `<testcase>`, as
  SPEC.md Section 11.7 asks. The XSD does not have them. GitLab and other CI systems read them,
  and readers that do not know them ignore them. The tests allow exactly these two.
