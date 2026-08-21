---
name: whoop-coros-training-recovery
description: Analyze training, recovery, sleep, and physiological response by combining COROS workout data with continuous WHOOP recovery data. Use when asked about workout impact, recovery trends, HRV/RHR changes, training load, overreaching, personal strain thresholds, or comparisons across days/weeks/months.
---

# WHOOP + COROS Training & Recovery Analysis

## Purpose

Use WHOOP as the continuous physiological source of truth and COROS as the workout-detail source of truth.

The user wears WHOOP continuously. COROS is worn for workouts only. Therefore:

- WHOOP is authoritative for:
  - Recovery score
  - HRV
  - Resting heart rate
  - Sleep duration, stages, efficiency, consistency, performance
  - Respiratory rate
  - Daily/cycle strain
  - All-day physiological load
- COROS is authoritative for:
  - Workout type
  - Workout duration
  - Distance
  - Pace or speed
  - Workout heart rate
  - Elevation and route-derived workout detail
  - Detailed activity data and FIT files when useful
  - COROS training-load assessment as a workout-load perspective
- Do not use COROS daily-health, resting-HR, sleep, or recovery metrics for longitudinal recovery analysis unless the user explicitly asks. Those data are incomplete because COROS is not worn continuously.

## Core analysis model

Always reason in this direction:

**COROS workout -> WHOOP physiological response that night and the next morning**

For each relevant workout or day:

1. Identify the workout(s) from COROS.
2. Pull WHOOP workout/day strain for the same day.
3. Pull that night's WHOOP sleep.
4. Pull the following morning's WHOOP recovery.
5. Compare against the user's recent baseline and preceding days.
6. Attribute cautiously: separate workout load from sleep loss and other confounders.

## Tool workflow

Use Executor MCP integrations when available.

### WHOOP

Discover and use tools equivalent to:

- `workout.getWorkoutCollection`
- `cycle.getCycleCollection`
- `sleep.getSleepCollection`
- `recovery.getRecoveryCollection`

Paginate when needed. WHOOP collection endpoints may cap `limit` at 25, so fetch additional pages with `nextToken`.

### COROS

Discover and use tools equivalent to:

- `querysportrecords`
- `querytrainingloadassessment`
- `getactivitydetail`
- `analyzeactivitydetail`
- `downloadactivityfitfiles`

Use detailed activity/FIT data only when the user's question benefits from HR-zone, elevation, segment, cadence, or other granular analysis.

## Date alignment

Be careful with date semantics.

- A workout belongs to the local calendar day when it occurred.
- WHOOP recovery on date D reflects the sleep that ended on the morning of D.
- To assess the effect of a workout on date D, usually compare it with:
  - recovery on D before the workout, when useful,
  - sleep during the night D -> D+1,
  - recovery on D+1.

For multiple workouts on the same day, analyze the combined day load as well as the individual sessions.

## Metrics to calculate

When data are available, calculate:

### Acute response
- Recovery change
- HRV absolute and percent change
- Resting-HR absolute and percent change
- Sleep performance change
- Sleep duration and efficiency
- Respiratory-rate change
- Extra sleep need from recent strain
- Next-day rebound

### Workout load
- WHOOP workout strain
- WHOOP total day strain
- Duration
- Average and max HR
- Distance
- Pace/speed
- Time in HR zones, when available
- COROS short-term load, long-term load, and load ratio

### Cumulative load
- Consecutive training days
- Multiple workouts in one day
- Rolling 3-day and 7-day training exposure when enough data exist
- Recent sleep debt
- Repeated low-recovery mornings
- Whether recovery normalizes after rest or improved sleep

## Personal threshold analysis

Do not assume generic population thresholds are the user's thresholds.

Look for nonlinear or threshold-like behavior in their own history, such as:

- recovery remaining stable up to a certain strain level and then dropping sharply,
- HRV falling disproportionately above a certain average HR, duration, or time in high zones,
- similar-duration workouts producing different recovery depending on intensity,
- cumulative load causing a stronger response than a single workout,
- high strain being tolerated when sleep is good but not when sleep is poor.

When possible, compare:
- high vs moderate strain days,
- long-low-intensity vs shorter-high-intensity sessions,
- single hard days vs back-to-back training,
- workouts followed by good vs poor sleep.

## Statistical guidance

Use statistics as descriptive evidence, not proof of causation.

When enough paired days exist:
- compute correlation between day strain and next-day recovery,
- day strain and next-day HRV,
- day strain and next-day RHR,
- workout average HR/duration and next-day metrics,
- optionally repeat after removing obvious outliers.

Always report:
- approximate sample size,
- whether one extreme day dominates the result,
- that correlation does not prove causation.

Prefer robust pattern descriptions over false precision when the sample is small.

## Confounders

Explicitly consider:
- unusually poor or short sleep,
- large sleep debt,
- travel,
- illness,
- alcohol if known,
- heat,
- unusually late workouts,
- multiple workouts,
- missing sensor data.

Do not automatically blame a workout for a poor recovery if sleep or another obvious factor is present.

## Interpretation rules

- HRV and RHR are often more useful for tracking physiological response than a single composite recovery score.
- A low recovery after a hard workout is more convincing when HRV falls and RHR rises in parallel.
- A rapid next-day rebound after better sleep suggests acute load rather than persistent maladaptation.
- Long duration alone is not equivalent to high intensity.
- Distinguish cardiovascular intensity from total duration and mechanical workload.
- Treat isolated abnormal SpO2 or other suspicious sensor values cautiously and do not overinterpret them without corroboration.

## Output style

Lead with the strongest finding.

Use concrete examples with dates and numbers when helpful.

Clearly distinguish:
- what the data show,
- what is a plausible interpretation,
- what is uncertain.

Prefer concise prose over a dump of metrics.

For a broad analysis, usually cover:
1. strongest workout/recovery relationship,
2. whether the pattern generalizes,
3. role of sleep,
4. cumulative-load pattern,
5. personal threshold hypothesis,
6. data limitations.

Do not make medical diagnoses.

## Examples of triggering requests

Use this skill for requests such as:
- "Analyze my training this week."
- "Why is my recovery bad today?"
- "How did yesterday's ride affect me?"
- "Am I tolerating my running volume?"
- "Compare this month with last month."
- "Find connections between my hard workouts and recovery."
- "What kind of sessions hurt my HRV the most?"
- "Can you estimate my personal strain threshold?"
