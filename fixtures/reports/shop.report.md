<!-- qa-core-review -->
## Test review

1 test needs changes, 1 needs review, 3 pass. 1 file has findings outside its tests.

| Verdict | Where | Lang | Test | Rules |
| --- | --- | --- | --- | --- |
| fail | `tests/cart.spec.ts:15` | TS | Cart > opens | QCR-T001, QCR-T002 |
| review | `tests/cart.spec.ts:9` | TS | Cart > adds an item @​smoke \| &lt;b>bold&lt;/b> &amp; \`code\` "quoted" | QCR-T002 |
| review | `tests/cart.spec.ts:6` | TS | (file) | QCR-T003, QCR-T004 |

Not reviewed (no static adapter, and LLM mode is off): `specs/CartSpec.scala`.

<details>
<summary>fail: tests/cart.spec.ts:15 Cart &gt; opens</summary>

- **QCR-T001** (error), line 15: This test checks nothing. Evidence: `opens`. Fix: Add an assertion.
- **QCR-T002** (warn), line 17: Hard wait of 500 ms. Evidence: `page.waitForTimeout(500)`.

</details>

<details>
<summary>review: tests/cart.spec.ts:9 Cart &gt; adds an item @​smoke | &lt;b&gt;bold&lt;/b&gt; &amp; `code` "quoted"</summary>

- **QCR-T002** (warn), line 11: Hard wait of 3000 ms. Evidence: `page.waitForTimeout(3000)`.

</details>

<details>
<summary>review: tests/cart.spec.ts:6 (file)</summary>

- **QCR-T003** (info), line 1: One of 3 files. Evidence: `tests/cart.spec.ts with spaces`.
- **QCR-T004** (warn), line 6: Hard wait of 250 ms in a hook. Evidence: `page.waitForTimeout(250)`. Fix: Wait for a condition.

</details>

Reviewed by [qa-core-review](https://github.com/sprintsynergyio/qa-core-review), an open-source tool by SprintSynergy.
