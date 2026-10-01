---
name: voice
description: Run the VOICE writing workflow (Verified, Owned, Insightful, Clear, Engaging) to turn a topic or a rough draft into writing that does not read as AI-generated. Use when the user asks to write, rewrite, de-AI, humanise or tighten a piece (a brief, memo, email, speech, post or article), says "/voice", or asks to check a draft for AI tells, unverified claims, jargon or empty insight. Supports a full run or a single stage (verify, interview, redteam, clarify, engage).
argument-hint: "[full|verify|interview|redteam|clarify|engage] <topic, or path to a draft>"
---

# VOICE: writing that sounds like the author, not the model

AI drafts fail in five ways. Each VOICE stage fixes one:

| Stage | Fixes | Question | Who runs it |
|---|---|---|---|
| **V** Verified | Hallucination ("confidently drunk") | Is this real? | `voice-verifier` subagent |
| **O** Owned | Homogenisation ("broken record") | Does it have the author's fingerprints? | **You, in this conversation** (interview) |
| **I** Insightful | Fake insight ("smart and empty") | Is there a real "so what"? | `voice-insight` subagent + the author answers |
| **C** Clear | Jargon and fluff | Will the reader understand it? | `voice-clarity` subagent |
| **E** Engaging | No tension ("boring") | Will they want the next line? | `voice-engagement` subagent + **human sign-off** |

Subagents cannot talk to the user. Every stage that needs the author's answers (the O interview, the I defence, the E sign-off) runs here, in the main conversation. Subagents do the analysis; you relay and decide with the author.

## 0. Parse the request

From `$ARGUMENTS`:
- First word `verify | interview | redteam | clarify | engage` → run **only** that stage (see "Single-stage mode"). Otherwise run the full pipeline.
- The rest is either a **topic** or a **path to an existing draft**. Read the file if it is a path.

Then confirm, in one short message, the three things you need (skip any already stated):
1. **Reader**: who reads it and what they must do after.
2. **Register**: pick a profile from `references/registers.md` (e.g. chairman brief, WhatsApp, Toastmasters), or describe one.
3. **Length / format**.

Create a working folder `voice-work/<short-slug>/` in the current directory. Save every stage's output there (file names below) so the run can be resumed and audited. Do not commit this folder unless asked.

## 1. O — Owned (interview first, write later)

Do this **before** any drafting, even when a draft exists. A generic draft is the problem we are solving.

Rules:
- Ask **one question at a time**. Wait for the answer. Never batch questions.
- Aim for **5 fingerprints**: specific details only this author could supply (a named person, a place, a number they lived with, a mistake they made, a moment they changed their mind, a phrase someone actually said).
- If an answer is vague ("it was challenging"), ask one follow-up for the concrete instance ("What happened on the worst day?").
- Use the question bank in `references/interview.md`; adapt, do not recite.
- Stop at 5 strong fingerprints or when the author says "enough". Max ~8 questions.

Save to `fingerprints.md`: each fingerprint as a short bullet in the author's own words, plus a one-line note on where it could go in the piece.

## 2. I — Insightful (find the thesis, then attack it)

1. Ask the author to complete the triad, or propose one from the fingerprints for them to correct:
   > Most people believe **X**. I believe **Y**. The difference is **Z**.
2. Launch the `voice-insight` subagent with: the triad, the fingerprints, the reader, and the draft if any. It returns up to 3 "So what?" attacks and a verdict.
3. Put the attacks to the author **one at a time**. Their answers are raw material: keep their words.
4. If the verdict is `EMPTY` or `OBVIOUS` after their answers, say so plainly and help them sharpen Y. Do not proceed on a thesis the skeptic could not be satisfied with unless the author insists.

Save to `thesis.md`: final triad, attacks, the author's answers.

## 3. Draft

Now write (or rewrite) the piece yourself, in the chosen register:
- Build it around the thesis (Y) and spend the fingerprints as evidence. Every paragraph should be something only this author could have written.
- Prefer the author's phrasing from the interview over yours.
- Avoid every pattern in `references/ai-tells.md` from the first line. Do not write and then scrub.
- Mark any factual claim you are not sure of with `[check]`.

Save to `draft-v1.md`.

## 4. V — Verified

Launch `voice-verifier` on `draft-v1.md`. It returns a claims table (VERIFIED / UNVERIFIED / DISPUTED / OPINION with sources).

- Fix or cut every DISPUTED claim.
- For UNVERIFIED claims: ask the author whether they can vouch for it (first-hand knowledge counts, but label it as theirs), else soften or cut.
- Never invent a source, quote, statistic or citation to fill a gap.

Save the report as `verify-report.md`, the fixed text as `draft-v2.md`.

## 5. C and E — Clear, then Engaging

These two are independent reads of `draft-v2.md`: launch `voice-clarity` and `voice-engagement` **in parallel** (one message, two Agent calls).

- **Clarity** returns: the piece restated as if to a 9-year-old, places where a reader would have to guess, jargon with plain swaps, sentences over ~25 words.
- **Engagement** returns: AI tells found, fluff to cut, a stronger opening hook, where tension drops, and a proposed closing turn.

Merge their suggestions into `draft-v3.md`. When they conflict, clarity wins for executive and legal readers; engagement wins for speeches and posts. Keep the author's fingerprints and phrasing intact even if an agent suggests "smoother" wording.

## 6. HITL gate (mandatory)

No prompt replaces the author's taste. Present to the author:
1. The final text (`draft-v3.md`).
2. A **VOICE scorecard**, one line each: V (claims verified / open), O (fingerprints used, e.g. 4/5), I (thesis in one sentence), C (reading-level note), E (hook + closing turn).
3. The 3 edits you are least sure of, so they can overrule them.

Ask: approve, or what to change? Apply changes and repeat until approved. Only then save `final.md` and give it to the author. Never present the piece as final without this step.

## Single-stage mode

| Arg | Do this | Needs |
|---|---|---|
| `verify` | Step 4 only on the given text. Return the claims table and a fixed version. | Draft |
| `interview` | Step 1 only. Return `fingerprints.md`. | Topic |
| `redteam` | Step 2 only (triad + skeptic loop with the author). | Thesis or draft |
| `clarify` | Run `voice-clarity`, return its report and a revised version. | Draft |
| `engage` | Run `voice-engagement`, return its report and a revised version, then the HITL gate. | Draft |

## Ground rules

- British/Malaysian English spelling unless the author asks otherwise.
- Plain words, short sentences, active voice. Say the action and who owns it.
- No invented facts, quotes, names or numbers. Ever. A gap stays a visible gap (`[author to confirm: ...]`).
- Keep progress messages to one line per stage ("O done: 5 fingerprints. Moving to thesis.").
