---
target: Inicio
total_score: 25
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 2
target_identity: "file:C:\\Users\\camil\\Desktop\\CodingSht\\CLAUDE\\BULLMILTON\\src\\pages\\Dashboard\\DashboardPage.tsx"
target_fingerprint: "sha256:7bde20bb0269cc355a268a433a435be369b0ac4cd9db8eed9d5c5eb6f676311f"
target_path: "C:\\Users\\camil\\Desktop\\CodingSht\\CLAUDE\\BULLMILTON\\src\\pages\\Dashboard\\DashboardPage.tsx"
timestamp: 2026-10-12T16-19-11Z
slug: src-pages-dashboard-dashboardpage-tsx
---
Method: dual-agent (A: design review · B: detector + browser)

## Design Health Score: 25/40 (acceptable)
| # | Heuristic | Score | Key issue |
|---|---|---|---|
| 1 | Visibility of status | 3 | Income rows did not show their effect on "Te queda" |
| 2 | Match real world | 2 | "Te queda" is accrual, not bank cash; "Gastaste" meant share |
| 3 | User control | 3 | One-tap "Saltar" on recurring |
| 4 | Consistency | 2 | Two money models (queda vs debt) never referenced each other |
| 5 | Error prevention | 2 | False "Te pasaste" before income is registered |
| 6 | Recognition | 3 | Reconciling hero and debt card needed memory |
| 7 | Flexibility | 3 | No desktop shortcuts |
| 8 | Minimalist | 2 | Four money blocks on mobile, MonthSummary repeats hero |
| 9 | Error recovery | 3 | Human error toasts |
| 10 | Help | 2 | Primary number had no explanation |

## Design specificity
Ledger is product-specific; the new "Te queda" hero was a generic budgeting pattern and the two models did not meet.

## Detector
CLI: 0 errors, 1 advisory (Segmented.tsx:39 text-[0.8125rem] off the type ramp). Browser overlay injected at 375 and 1440: no anti-patterns. No overflow at 375. "Ver reportes" link 20px tall.

## Priority issues
- [P1] Two financial models never meet → rows now show "tu parte $X"; hero links to its own explanation. FIXED
- [P1] False overspend alarm and ambiguous accrual number → neutral "Llevas en gastos" state, "Tu parte de los gastos", ¿Cómo se calcula? sheet. FIXED
- [P2] Too many money blocks / MonthSummary redundancy → OPEN
- [P2] Bar semantics (filled = spent) → now filled = what's left, green. FIXED
- [P2] One-tap "Saltar" → confirm dialog. FIXED

## Persona red flags
Checkout sibling: no post-save confirmation of new "te queda" (toast only). First-timer: hero vs debt card relation. Screen-reader user: hero number now inside h1 via sr-only.

## Minor
Hero/ledger right edges misaligned on desktop; sheet sign legend at the bottom; sidebar width magic number.
