# How the formulas work

Source: `Strength_Now_-_12_Week_Craftsmanship_Powerbuilding_Program_-_Powerlifting-Sumo_Focus.xlsx`
(read-only inspection with openpyxl, `data_only=False` for formulas and `data_only=True` for
the cached values Excel last calculated). All quoted formulas are copied verbatim from the
workbook (openpyxl strips the leading `=`... no, it keeps it — quoted here exactly as stored).

## 1. Where the anchor numbers live

Each block sheet (`Block 1…4`, `Optional Test Block 4`) carries its **own** copy of the
lifter's numbers at the top of the sheet — it does **not** pull them from the `Home` sheet at
calculation time. Both tables are literal numbers, not formulas:

- `E4:G8` **"Training Max"** — `F6`=200 (SQUAT), `F7`=150 (BENCH), `F8`=250 (DEADLIFT), all `KG`.
  This is the number used for **volume/back-off sets** (e.g. `=MROUND($F$6*0.66,$C$7)`).
- `I4:K8` **"Training Max (Ranges)"** — `J6`=200, `J7`=150, `J8`=250, all `KG`. Same values in
  the seed file, but a structurally separate table. This is the number used for the **top set's
  BE/TE range in the last programmed week of the block** (e.g.
  `=MROUND($J$6*0.863*0.97,$C$8)`).

In the seed workbook `F6==J6`, `F7==J7`, `F8==J8` on every block sheet, and the training max is
**identical across all four block sheets** (200/150/250 kg squat/bench/deadlift, every block).
The `Home` sheet FAQ (`C37`) explicitly tells the athlete to bump the training max by hand
"2.5–5 kg (5–10 lbs) each block" — the spreadsheet does not do this automatically, so in this
example file the lifter simply never updated it. Anyone re-using this workbook should expect to
edit `F6:F8`/`J6:J8` on each block sheet manually.

Other per-block constants used throughout the formulas:
- `C7` = **S/D ROUNDING** (squat/deadlift rounding increment, 2.5 kg on every block sheet)
- `C8` = **B ROUNDING** (bench rounding increment, 2.5 kg on every block sheet)
- Both feed `MROUND(x, increment)` calls everywhere loads are computed.

The `Home` sheet has its own, independent 1RM estimator (`N9:O11`, Epley-style:
`=MROUND(IF($M9 > 0, ROUND(IF($L9 = "KG", $K9 * 2.20462, $K9) / (1.0278 - $M9 * 0.0278), 2), 0), $K$5)`)
that converts a recent 1–5RM (`K9:M11`) into an estimated 1RM. This is a helper for the athlete
to arrive at a training max; it is not wired into the block sheets' formulas at all — the block
sheets' `F6:F8`/`J6:J8` are independent hard-coded inputs.

## 2. Layout of a training day (applies to every block sheet)

Each block sheet is a 7-day microcycle template repeated for 4 "weeks" (local week 1–4, which
is weeks 1-4 / 5-8 / 9-12 / test-block depending on the sheet). Day header rows are fixed at
18, 44, 70, 96, 122, 149, 175. For a day starting at row `dr`:

| Offset from `dr` | Content |
|---|---|
| `dr-2` | "Micro Length" / "NOTES" header |
| `dr-1` | NOTES box (merged cell, one per week group, e.g. `E17:L22`) |
| `dr` | `DAY` / day number (day 2's number = `=C18 + 1`, etc. — pure counter) |
| `dr+5` | Week header row: WEEK label / weekday / date / MOTIVATION |
| `dr+6` | Column header row: SETS / REPS / LOAD / WEIGHT / LSRPE / BE Range / TE Range / Mean Weight |
| `dr+7 … dr+22` | Up to 16 exercise rows (blank rows left as template) |

Four week-groups sit side by side, columns `E` (week 1), `N` (week 2), `W` (week 3), `AF`
(week 4) — each group is 8 columns wide (SETS, REPS, LOAD, WEIGHT, LSRPE, BE Range, TE Range,
Mean Weight). The sheet actually contains **eight** week-groups per day (through `AO`, `AX`,
`BG`, `BP`, i.e. "week 5–8" of the same day), but those four extra groups are **hidden columns**
(`column_dimensions['AO'].hidden == True`, etc.) and are empty — leftover template structure
carried over from a longer master template, unused in a 4-week block sheet. Only `E/N/W/AF`
hold real data.

Only 4 of the 7 day-header rows are actually populated with exercises in every block
(`DAY 1`, `DAY 4`, `DAY 5`, `DAY 6`); `DAY 2`, `DAY 3`, `DAY 7` are empty in all four block
sheets — they are rest days baked into the template. See "Inconsistencies" below re: `Home`
claiming 5 training days/week.

## 3. Top-set BE/TE Range chain (the "suggested top-set weight" ranges)

For any row that is a top set (i.e. `LOAD` shows an RPE target like `"7 RPE"` rather than a
number), the **BE Range** (bottom of estimate) and **TE Range** (top of estimate) columns give a
suggested kg window for that top set, and they chain *backwards* from the last programmed week
of the block, which is pegged to the training max:

Block 1, Day 1, Squat top set (row 25):
```
Week 4 (last week): AK25 = MROUND($J$6*0.863*0.97, $C$8)   -> 167.5
                     AL25 = MROUND($J$6*0.863*1.03, $C$8)   -> 177.5
Week 3:              AB25 = MROUND(AK25*0.965, $C$7)        -> 162.5
                     AC25 = MROUND(AL25*0.965, $C$7)        -> 172.5
Week 2:              S25  = MROUND(AB25*0.965, $C$7)        -> 157.5
                     T25  = MROUND(AC25*0.965, $C$7)        -> 167.5
Week 1:              J25  = MROUND(S25*0.965, $C$7)         -> 152.5
                     K25  = MROUND(T25*0.965, $C$7)         -> 162.5
```
i.e. **week 4 = training-max × lift-specific % × (0.97 low / 1.03 high)**, and each earlier
week is **96.5% of the next week's number**, rounded to the lift's increment (`$C$7` for
squat/deadlift, `$C$8` for bench). This produces a steady ~3.5%/week ramp toward a heaviest
top set in the final week of the block — the opposite of "week 1 is heaviest"; week 1 is the
*lightest* top set and each week creeps up until the peg to the training max in the last week.

The lift-specific percentage against the training max (the multiplier on `$J$6/$J$7/$J$8`)
changes block to block and day to day — it is effectively "how close to max is the hardest top
set of the block":

| Day / lift | Block 1 (wk4) | Block 2 (wk4) | Block 3 (wk4) | Test Block 4 (last populated wk) |
|---|---|---|---|---|
| Day 1 Squat (`5→8 RPE` ramp) | 0.863 | 0.892 | 0.922 | 0.892 (wk3, week 4 blank) |
| Day 1 Bench | 0.955 | 0.955 | 0.955 | 0.922 (wk3) |
| Day 1 Deadlift | 0.863 | 0.892 | 0.922 | 0.892 (wk3) |
| Day 5 Squat (`5 RPE→8/4 RPE`) | 0.811 | 0.837 | (0.863, inferred by pattern) | 0.837×0.97 wk2 anchor / 0.863 wk3 anchor — see below |
| Day 6 Bench (3‑ct pause) | 0.922×0.97 | 0.922×0.985×0.97 | 0.922×0.985×0.97 | 0.892×0.985×0.97 (wk3) |

So the "% of training max" climbs roughly 3 points a block (86.3% → 89.2% → 92.2%) for the
main Day-1 top sets, consistent with the FAQ's advice to nudge training max/intensity up
gradually block over block. Test Block 4 restarts the ramp from a *lower* peg (89.2%/92.2% by
week 3) because it only programs 3 real weeks before the taper/meet — week 4 of every exercise
in Test Block 4 is blank (no sets/reps/load at all), i.e. week 4 is left for the athlete to
taper/compete rather than train.

One row is odd: Test Block 4, Day 5, Squat/Deadlift top sets use
`=MROUND($F$6*0.837*0.97,$C$8)` (week 2) — note this references `$F$6` (the **Training Max**
table) rather than `$J$6` (the **Training Max (Ranges)** table) that every other BE/TE-range
formula in the workbook uses. Since `F6==J6` numerically it has no visible effect in this file,
but it's an inconsistent reference that would only surface as a bug if a user ever set the two
tables to different values.

## 4. Volume / back-off set loads (non-top-set SBD rows)

Rows with a literal numeric `LOAD` (not an RPE string) are computed straight from the
**Training Max** table as a flat percentage, no ramp/chain involved:

```
Block 1, Day 1, Squat back-off (row 26):
  Week1: G26  = MROUND($F$6*0.66, $C$7)  -> 132.5
  Week2: P26  = MROUND($F$6*0.68, $C$7)  -> 135
  Week3: Y26  = MROUND($F$6*0.7,  $C$7)  -> 140
  Week4: AH26 = MROUND($F$6*0.64, $C$7)  -> 127.5   (deload/taper week, % drops back down)
```
The percentage rises week 1→3 and then **drops** in week 4 — the block's final week is a lighter
volume week even though the top-set intensity (BE/TE range, §3) is the heaviest of the block.
This pattern (rise, rise, drop) repeats for every SBD back-off row across squat/bench/deadlift
and across Block 1/2/3, with the absolute percentages increasing block-to-block, e.g. squat
back-off row 26 across blocks: Block1 `.66/.68/.70/.64`, Block2 `.68/.70/.72/.66`, Block3
`.70/.72/.74/.68` — a consistent **+0.02 (2 percentage points) per block**, same shape, higher
floor each block.

## 5. Back-off sets computed from the *user's entered top-set weight*, not the training max

A second style of back-off row references the **WEIGHT** cell of the top-set row directly
(column `H`/`Q`/`Z`/`AI` for weeks 1–4), rather than the training max table:

```
Block 1, Day 4, Bench back-off (row 104):
  Week1: G103... no — G104 = MROUND(H103*0.88, $C$8)
  Week2: P104 = MROUND(Q103*0.88, $C$8)
  Week3: Y104 = MROUND(Z103*0.88, $C$8)
  Week4: AH104 = MROUND(AI103*0.82, $C$8)
```
`H103` is the **WEIGHT** the athlete actually logs for the preceding top set (a free-text
field, comma-separated if multiple sets, e.g. `"140, 142.5, 145"`). Because the seed workbook
has no weight logged (it's a blank template), `H103` is empty and `MROUND(""*0.88, …)` evaluates
to Excel's `#VALUE!` error — this is expected and matches the prompt's description ("LOAD cells
… show `#VALUE!` when the top-set weight is empty"). This is the correct, by-design behavior of
an unfilled program, not a bug in the sheet.

This "% of last top-set weight" pattern also changes block to block. Example: Day 4's second
Bench row (close-grip-adjacent back-off, header col `G104`/`P104`/`Y104`/`AH104` off the Day-4
Bench top set) uses `0.88/0.88/0.88/0.82` in **Block 1 and Block 2**, but **Block 3** lowers it
to `0.86/0.86/0.86/0.80` — a real 2-point drop in relative back-off intensity for that specific
accessory-adjacent row in the final strength block, presumably because the top-set % of 1RM is
already higher there (92.2% vs 86.3%/89.2%), so the back-off is pulled down to manage fatigue.

Accessory rows outside the SBD lifts (QUADS, HAMSTRINGS, CHEST, ROW, TRICEPS, BICEPS, etc.) use
plain RPE targets as literal text (`"7 RPE"`, `"8 RPE"`, sometimes with a stray leading space
like `" 8 RPE"` in the source file — copied verbatim into `program.json`) — there is no
formula-driven load for accessories; the athlete self-selects weight to hit the listed RPE at
the listed sets×reps.

## 6. Mean Weight column

Every row's `Mean Weight` cell (`L`/`U`/`AD`/`AM`) is an array formula that parses the
comma-separated WEIGHT string the athlete logs and averages the numbers, e.g.:
```
=IFERROR(AVERAGE(1 * (TRIM(MID(SUBSTITUTE(H25, ",", REPT(" ", 99)),
  IF(_xlfn.SEQUENCE(LEN(H25) - LEN(SUBSTITUTE(H25, ",", "")) + 1, 1) = 1, 1,
  (_xlfn.SEQUENCE(LEN(H25) - LEN(SUBSTITUTE(H25, ",", "")) + 1, 1) - 1) * 99), 99)))), 0)
```
This is purely a logging aid (feeds the "Microcycle SBD Metrics"/tonnage summary further down
the sheet, rows 200+) and has no bearing on future prescriptions.

## 7. Rounding

- Squat & deadlift always round to `$C$7` (2.5 kg in the seed file).
- Bench always rounds to `$C$8` (also 2.5 kg in the seed file, so in practice indistinguishable,
  but the two are tracked as separate settings — "S/D ROUNDING" vs "B ROUNDING" — presumably so
  a user training in lb could set finer bench-specific rounding, e.g. 5 lb vs 2.5 lb).
- All rounding uses Excel `MROUND`, which rounds to the *nearest* multiple, not up or down.

## 8. Day/session count discrepancy (flagged inconsistency)

`Home!C12`/`C5`/every block sheet's `C12` ("DAY/SESSION") is hard-coded to **5**, and the
`Attempt Sheet!C5` also says 5. But the actual programmed structure in every block sheet has
only **4** training days (Day 1, 4, 5, 6) out of the 7-day microcycle template; Days 2, 3, and 7
are entirely empty rows. Either the "DAY/SESSION" field is a leftover generic default from the
master template that was never updated for this specific 4-day Powerlifting-Sumo variant, or it
is meant to count something else (not clarified anywhere in the workbook). Flagging as a real
inconsistency rather than resolving it by inference.

## 9. Other things worth flagging

- `E9`/`G9` block-focus/notes cell literally contains an en-dash `–` as a placeholder — not a
  formula error, just unused template filler.
- The RPE literal in Block 2/3's Day 5 & 6 top sets sometimes reads `"8 RPE or 4 RPE"` (e.g.
  Block 1 Day 5 Squat week 4) — a dual-target notation (an RPE for a straight top set, or an
  RPE-of-4-more-reps style back-off notation) baked into the LOAD text itself rather than a
  separate field; captured verbatim in `program.json`.
- The BLOCK SBD METRICS / MICROCYCLE SBD METRICS / MICROCYCLE ACCESSORY METRICS tables (rows
  ~10-14 and ~200-215 of each block sheet) are pure roll-ups (`SUMIFS`/`COUNTIFS` over the
  day rows) for total sets/reps/tonnage per lift and per muscle group; they don't feed back into
  any prescription and were not extracted row-by-row into `program.json` (only the day/exercise
  program data was), since the prompt's deliverable is the program structure, not derived
  reporting tables. They are visible in the raw sheet if needed later.
