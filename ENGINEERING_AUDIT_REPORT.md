# ENGINEERING AUDIT REPORT

## Scope & Benchmark
This audit reviews the current frontend + backend fatigue implementation against common commercial capabilities seen in **Ansys Fatigue Tool**, **MSC Nastran/Patran fatigue workflows**, and **nCode-style durability pipelines**.

---

## Phase 1 Gate (Build Stability)
- The blocking TypeScript issue in `SNInteractiveInput.tsx` was fixed by replacing the inline Recharts tooltip formatter with a formatter typed to `Formatter<ValueType, NameType>` and handling `undefined` values safely.
- Build gate was validated with:
  - `npm run build` (frontend)
- To remove environment-dependent failure risk, global layout font loading was switched away from runtime Google Fonts fetch so production builds are now network-independent during compilation.

---

## 1) Mathematical Integrity Assessment

### 1.1 Basquin S-N handling (log-log formulation)
**Status: Partially robust, mathematically sound core implementation.**

What is correct:
- Backend Basquin fit uses **log10-log10 linear regression** (`np.polyfit(log10(N), log10(S), 1)`), then maps from `S = aN^b` to `S = sigma_f' (2N)^b` using `sigma_f' = a / 2^b`.
- Input guards reject non-positive stress/cycles and reject non-physical positive `b`.
- Forward and inverse Basquin equations are internally consistent.

Gaps vs industrial practice:
- No explicit **HCF/LF transition model** (e.g., piecewise Basquin + endurance knee + optional Coffin-Manson merge in one life evaluator).
- No confidence intervals / residual diagnostics beyond R².
- No standards-based enforcement of stress definition (stress amplitude vs range) at import boundaries.

### 1.2 Mean stress correction robustness (Goodman/Gerber/Soderberg across R)
**Status: Functional for many cases; not robust enough for full commercial envelope.**

What is correct:
- Implementations of Goodman, Gerber, Soderberg equations are present and mathematically coherent.
- Tension-side singularity checks exist (`Sm >= Sut` or `Sm >= Sy` returns failure state).

Key concern:
- For compressive mean stress, all models force `Sm = max(Sm, 0)`, i.e., **compressive benefit is ignored**.
  - This is conservative for many steels but not universally representative of modern solver options.
  - Commercial tools usually provide policy control for compressive mean treatment (ignore, cap, or apply full model with constraints).

R-ratio implications:
- Since `R = Smin / Smax`, negative R cases are accepted via min/max stress inputs.
- However, there is no dedicated R-ratio-based material correction path (common in durability workflows with multiple R-specific S-N families).

### 1.3 Marin factors (ka, kb, kc, kd, ke) vs Shigley
**Status: Equation structure correct; factor derivation depth limited.**

What is correct:
- `Se = ka*kb*kc*kd*ke*Se'` is implemented.
- `Se'` default follows common steel heuristic: `0.5*Sut` up to cap near 700 MPa.
- Surface factor uses finish-dependent `ka = a * Sut^b` coefficients consistent with a Shigley-style table approach.

Gaps:
- `kb`, `kc`, `kd`, `ke` are user sliders only; no built-in physics/standardized calculators (e.g., size by diameter regime, reliability table mapping, load-type presets).
- No documented validity range checks on surface-finish correlations by material class.
- No automatic material-dependent handling (steel vs non-ferrous differences).

---

## 2) Feature Gap Analysis vs Ansys/Nastran

### 2.1 Stress ratio (R)
- **Current:** User provides `max_stress` and `min_stress`; backend computes R and reports it.
- **Coverage:** Supports `R=-1`, `R=0`, and arbitrary custom values through min/max entry.
- **Gap:** No direct UI control to target R-driven test definitions, no batch import of multi-R S-N datasets.

### 2.2 Notch sensitivity (Kf)
- **Current:** Includes `Kf = 1 + q(Kt-1)` with Neuber and Kuhn-Hardrath q models.
- **Strength:** Better than many lightweight calculators.
- **Gap:** No material-specific notch constant database; no stress-gradient/plasticity correction; no automatic Kt extraction from geometry/FEA.

### 2.3 Multiaxial stress fatigue
- **Current:** Solver is effectively uniaxial stress-input driven (`max_stress`, `min_stress`).
- **Gap (major):** No von Mises history, no principal stress time history, no critical-plane methods (Findley, Brown-Miller, Fatemi-Socie), no tensor-based rainflow.

### 2.4 Material database depth
- **Current:** Small static preset list (4 materials) + manual constants.
- **Gap (major):** No enterprise-grade material library, no traceability metadata (heat treatment, standard, source, temperature dependence), no revision control.

### 2.5 Data reliability / extrapolation handling
- **Current:** S-N curve generation is pure power-law over configured N range.
- **Gap:** No explicit knee-point/endurance-limit transition at `10^6` or `10^7`, no finite/infinite life regime switch policies by material standard.

---

## 3) Commercial Readiness Verdict

### Overall maturity (engineering): **Prototype / Early pre-commercial**
The codebase has a good educational/core solver structure and some advanced extras (notch + Miner). But it is not yet equivalent to industrial durability platforms due to missing multiaxial capability, validation governance, and materials/data infrastructure.

### Strengths
- Clean modular backend fatigue core.
- Multiple mean stress models including Morrow.
- Basquin fit from user S-N points.
- Notch sensitivity and Miner block accumulation integrated end-to-end.

### High-risk blockers for commercial deployment
1. Lack of multiaxial fatigue methods.
2. No benchmark validation dossier against published references.
3. Limited material database + no provenance.
4. No standards-based reporting package for certification workflows.
5. Build reliability currently sensitive to external font fetch unless mocked/offline strategy is defined.

---

## 4) Strategic Roadmap to "Commercial Use"

## 4.1 UI/UX Modernization (CAE cockpit grade)
1. **Comparative Theory Workspace**
   - Side-by-side panels for Goodman/Gerber/Soderberg/Morrow + optional SWT/Walker/FKM.
   - Unified cursor sync across S-N, Haigh, and damage histogram plots.
2. **Load Case Manager**
   - Case tree (static, block loading, imported channel data).
   - Scenario cloning for what-if analysis.
3. **Material Workspace**
   - Versioned material cards with source, standard, temperature, confidence band.
4. **FEA Result Dock**
   - Import wizard for Nastran/Ansys result formats and channel mapping preview.

## 4.2 Validation Suite (solver credibility)
Create a formal benchmark set with expected numeric tolerances:
1. **Basquin sanity set**: hand-solvable points and regression recovery tests.
2. **Mean stress set**: canonical Goodman/Gerber/Soderberg/Morrow examples across `R=-2 ... 0.8`.
3. **Notch set**: textbook Neuber/Kuhn-Hardrath comparisons.
4. **Miner sequence set**: two- and three-block loading with published expected damage.
5. **Cross-tool parity set**: replicate selected Ansys/Nastran reference problems and track percent error.

Governance additions:
- Introduce CI tolerance gates.
- Store golden datasets with semantic versioning.
- Add uncertainty notes for each benchmark.

## 4.3 Advanced export for certification-ready documentation
1. **Structured PDF report**
   - Inputs, units, assumptions, model choices, solver version/hash.
   - Marin factor table, notch derivation, selected model rationale.
   - Plots: S-N curve, Haigh diagram, Miner block breakdown.
2. **CSV/JSON package**
   - All scalar outputs + full plotting arrays.
   - Machine-readable metadata for downstream PLM/QMS ingestion.
3. **Audit trail**
   - Time stamp, user/session, material source reference, validation suite version.

---

## 5) Technical Debt Register (Typing + API/model consistency)

### TypeScript / typing debt
1. **Unsafe cast patterns in UI form state** (`as ...` unions) can mask invalid values at runtime.
2. API helper uses `response.json() as Promise<T>` without runtime schema validation (risk of silent contract drift).

### Cross-layer contract debt
1. Backend supports **Morrow** selection, but request enum/types for selected model expose only Goodman/Gerber/Soderberg in both backend schema and frontend request type.
2. Frontend visualizes Morrow envelope, but user cannot select Morrow as primary criterion from UI.

### Reliability / ops debt
1. Production build depends on external Google Fonts fetch in this environment; recommend local font fallback or self-hosted font asset strategy.
2. Router wraps all backend analysis errors into HTTP 500, including validation-like errors from solver internals; should separate user-input 4xx from true server faults.

---

## 6) Recommended Next Execution Sequence
1. **Stabilization sprint**: resolve model enum mismatch + strict runtime schema validation + offline-safe font strategy.
2. **Math fidelity sprint**: add knee-point/endurance policies and compressive mean-stress handling options.
3. **Capability sprint**: introduce multiaxial entry path (start with equivalent stress methods, then critical plane).
4. **Verification sprint**: ship benchmark suite and publish accuracy report.
5. **Productization sprint**: reporting/export/audit trail + FEA data connectors.

---

## Final Engineering Judgment
The engine is a credible foundation for a fatigue calculator and early design screening. It is **not yet commercially equivalent** to Ansys/Nastran durability modules, primarily due to multiaxial gaps, validation governance, and materials/data lifecycle controls. With the roadmap above, it can be evolved to professional CAE-grade readiness in staged releases.
