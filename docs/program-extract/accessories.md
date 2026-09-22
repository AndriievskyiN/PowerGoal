# Variation and Accessory Options / Attempt Sheet / Nutrition & Recovery

Source: `Strength_Now_-_12_Week_Craftsmanship_Powerbuilding_Program_-_Powerlifting-Sumo_Focus.xlsx`,
sheets `Variation and Accessory Options`, `Attempt Sheet`, `Nutrition & Recovery`. Read-only;
raw cell dumps are quoted below.

## Variation and Accessory Options

A flat reference table (no formulas, all literal text) organised in three columns:

### Squat - Bench - Deadlift

**Squat Variations** (B7:B8 — only 1 option listed)
- Competition Squat

**Bench Press Variations** (B14:B18)
- Competition Bench Press
- Competition 3 Count Pause Bench Press
- Competition 2 Count Pause Bench Press
- Close Grip Bench Press (2 fingers in)

**Deadlift Variations** (B21:B23)
- Sumo Deadlift
- Sumo Pause Deadlift

### Upper Body

**Chest Accessory Options** (F7:F12)
- Weighted Dips
- Incline Dumbbell Bench Press
- Pec Fly of Choice
- Chest Press Machine
- Feet Up Dumbbell Bench Press

**Row / Horizontal Pull Accessory Options** (F14:F17)
- Chest Supported Row of Choice
- Single Arm Cable Row
- Single Arm Dumbbell Row

**Pulldown / Vertical Pull Accessory Options** (F21:F25)
- Pulldown of Choice
- Weighted Pull Ups
- Weighted Chin Ups
- Machine Pulldown

**Upper Back / Rear Delts Accessory Options** (F28:F30)
- Rear Delt Fly of Choice
- Facepulls w/ External Rotation

**Shoulder Accessory Options** (F35:F38)
- Lateral Raise of Choice
- Dumbbell Shoulder Press
- Machine Shoulder Press

**Bicep Accessory Options** (F42:F46)
- Incline Dumbbell Curls
- Bicep Curl Machine
- Hammer Curls
- EZ Bar Curl

**Tricep Accessory Options** (F49:F52)
- Tricep Rope Pressdown
- Single Arm Tricep Pressdown
- Single Arm Tricep Overhead Extension

### Lower Body

**Quad Accessory Options** (J7:J12)
- Pendalum [sic] Squat
- Belt Squat
- Leg Press
- Hack Squat
- Single Leg Press

**Hamstring Accessory Options** (J14:J17)
- Hamstring Curl Machine (note: sheet has a leading space in the literal text, " Hamstring Curl Machine")
- Dumbbell Romanian Deadlift
- 45 Degree Hyperextensions

**Glute Accessory Options** (J21:J23)
- Barbell Glute Bridge
- Machine Glute Bridge

**Adductor Accessory Options** (J28:J29)
- Hip Adduction Machine

**Abductor Accessory Options** (J35:J36)
- Hip Abduction Machine

**Calf Accessory Options** (J42:J44)
- Seated Calf Raise Machine
- Standing Calf Raise Machine

**Abdominal Accessory Options** (J49:J50)
- Weighted Cable Crunches

These options map directly onto the `TYPE` column used in the block sheets (e.g. `QUADS`,
`HAMSTRINGS`, `CHEST`, `PULLDOWN`, `ROW`, `TRICEPS`, `BICEPS`, `UPPER BACK`, `REAR DELTS`,
`SHOULDERS`, `ABDOMINALS`, `HAMSTRINGS/GLUTES`) — the block sheets pick one literal exercise
`NAME` per `TYPE` (sometimes a "/"-joined pair meaning "pick one", e.g. `"Belt Squat/Leg
Press/Hack Squat"`), and this sheet is the pool those choices are drawn from. Note "Squat
Variations" only lists Competition Squat even though the block sheets exclusively use
Competition Squat for the main lift — consistent, no unused options there.

## Attempt Sheet

A single-page meet-day attempt calculator, driven off a separate 1RM entry (not linked to the
`Home` or block-sheet training max cells — this is a standalone worksheet):

- Header: athlete, weight class (`93kg`), day/session (`5`), division (`OPEN`), LB rounding
  (`1`), KG rounding (`2.5`).
- **1RM inputs** (one column each for Squat/Bench/Deadlift): `MAX` (kg or lb, user picks units)
  auto-converts to both `1RM KG` and `1RM LBS`, e.g.
  `C12 = IF(E11 = "LBS", MROUND(C11 / 2.20462, $C$8), C11)`. Seed values: Squat 200 kg (440 lb),
  Bench 150 kg (330 lb), Deadlift 250 kg (551 lb — note: `O12` uses `$C$7` not `$C$8` in its
  MROUND, an inconsistent rounding reference vs. the squat/bench formulas, though it has no
  visible effect since both roundings are 2.5 kg in this file).
- **Three attempt tiers** per lift, each row computed as `%1RM × 1RM`, `MROUND`'d to the
  athlete's rounding setting:
  - Opener tier: Low/First/High = 90% / 91% / 92% of 1RM
  - Second tier: Low/Second/High = 95% / 96% / 97% of 1RM
  - Third tier: Low/Third/High = 99% / 100% / 101% of 1RM
  - "Jump" rows show the kg/lb/% gap between the chosen attempt and the previous one, e.g.
    `="+" & (IF(NOT(ISBLANK(C22)), C22 - C16, "")) & " KG"`.
- **Warm-up tables**: three 10-row NUMBER/KG/LBS/REPS grids (one per lift), entirely blank in
  the seed file — pure user-fill scaffolding, no formulas.
- **Gameday Plan** (G3) and **Meet Day Checklist** (Q3) are section headers only; no populated
  checklist items or plan text exist in the sheet — purely a blank template area for the athlete
  to fill in by hand (not a data-validation checklist; just an empty labeled region).

## Nutrition & Recovery

- **Macronutrient Targets** table (`B6:J12`): five profiles — DAILY INTAKE, HEAVY TRAINING,
  LIGHT TRAINING, REST DAY, REFEED DAY — each with PROTEIN/CARBS/FAT/CALORIE low-high ranges.
  In the seed file all five profiles carry **identical placeholder numbers**
  (180–220 g protein, 300–350 g carb, 50–70 g fat, 3000–4000 kcal) — i.e. the template ships with
  one generic range copy-pasted across all five day types rather than genuinely different
  targets per training load; the athlete is expected to differentiate them.
- **Weekly tracking log**, one block per week for weeks 1–4 (`B14` "WEEK" counter increments via
  `=C14+1`ology chain), each block:
  - `TRACKING DAY START` (`D4`, fixed anchor date `2026-03-01`) plus `=$D$4 + (C14 - 1) * 7`
    seeds each week's Sunday; each day of the week auto-fills date + weekday name
    (`=TEXT(B16, "dddd")`).
  - Per-day columns: TARGET (which macro profile to use that day — matched against the profiles
    table via `XMATCH`), WEIGHT, PROTEIN, CARBS, FATS, CALORIES, CARDIO CALORIES.
  - Hidden helper columns `L:P` compute an index into the profile table and boolean
    "Protein/Carbs/Fats/Calories Good" flags by checking the day's logged macro against the
    matched profile's low/high band, e.g.
    `=OR(AND(OR(INDEX($C$8:$C$12,L16)<=F16, ISBLANK(...)), OR(INDEX($D$8:$D$12,L16)>=F16, ISBLANK(...))), COUNTBLANK(F16) > 0)`
    (defaults to "good" / TRUE if the cell is blank or the profile bound is blank).
  - Weekly AVERAGE and STD. DEV rows auto-summarize the 7 logged days.
  - A "COMMENTS OR NOTES" free-text header per week (no content pre-filled).
  - Only **week 1, day 1 (Sunday 2026-03-01)** has sample data actually entered
    (`WEIGHT=220`, `PROTEIN=220`, `CARBS=351`, `FATS=71`, `CALORIES=3500`); every other day in
    weeks 1–4 is blank, so most of the "Good" flags evaluate to `#N/A` (because `TARGET` is
    blank, so `XMATCH` fails) or `""` for the averages. This is a template, not a completed diet
    log.

Nothing in the `Nutrition & Recovery` sheet references the block-sheet training percentages or
vice versa — it's an independent tracker, only sharing the athlete's identity/weight-class
convention with the rest of the workbook.
