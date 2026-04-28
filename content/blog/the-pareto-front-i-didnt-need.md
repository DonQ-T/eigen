---
title: "The Pareto Front I Didn't Need"
date: 2026-04-30
author: "Matt Jacob"
description: "I spent most of the week building a 2D Pareto framework that scored every method against the constraint pattern on shape and magnitude axes simultaneously. It worked. Then I noticed it produced the exact same picks as a single-line check, and rewrote the whole thing around the smaller rule. A note on framework simplicity, and on resisting the urge to keep machinery just because you built it."
tags: ["NMF", "bioinformatics", "gene-expression", "similarity-metrics"]
draft: false
---

The previous post described a one-question test that picks a similarity method per cluster: *does raw MAE's top-20 also score high on shape?* If yes, raw MAE wins. If no, fall back to Pearson. Four clusters, four answers, one rule.

That isn't the framework I built first.

What I built first was a two-axis Pareto evaluation that scored every method on shape and magnitude simultaneously, drew a frontier through the dominant methods per cluster, and read the winner off the corner. It was a small but legitimate piece of methodology --- two principled axes, a defined combination rule, and four pretty scatter plots to show for it. It worked. It picked the same winners.

And then I realized: if the sophisticated framework and the embarrassingly small test agree on every cluster, the sophisticated framework is just the smaller test wearing a costume. So I deleted it from the deck and kept the one-liner.

This post is about that throwaway. What it was, why it produced the right answers, and why a simpler structure ended up doing the same job better.

## The Visual Decision Process I Was Trying to Codify

Before any math, the actual decision was being made with my eyes. For each (method, cluster) pair, I was looking at the top-20 genes overlaid on the constraint pattern in three different views:

- **Zoomed** --- y-axis fixed to the pattern's range. Shows whether the genes' expression curves *sit on* the pattern in absolute terms. Catches magnitude problems immediately.
- **Shared** --- y-axis spans the union of the pattern and the genes. Shows the gap if there is one --- whether the genes are 2$\times$ above the pattern, 10$\times$, or close.
- **Normalized** --- each gene min-max scaled to $(0, 1]$. Shows pure shape: do the genes rise and fall when the pattern does?

A method is a **winner** in my eye only when it looks good in *both* the zoomed view (right magnitude) AND the normalized view (right shape). A method that nails one and fails the other is partial credit at best.

That's it. That's the whole decision process. The dual-criterion gate is just an attempt to write that down formally so the picks are reproducible without my eyes in the room.

## Two Axes, Cleanly

For each (method, cluster) pair, I defined two scores from the method's top-20 genes:

**Shape axis.** Fraction of the top-20 with Pearson correlation $r > 0.9$ against the constraint pattern.

$$\text{shape}(\text{method}, \text{cluster}) = \frac{1}{N} \sum_{i=1}^{N} \mathbb{1}\!\left[\,r(g_i, p) > 0.9\,\right]$$

Range $[0, 1]$, higher is better. The choice of threshold isn't arbitrary --- it's strict enough that "fanning out" in the normalized view gets penalized, but loose enough that any actually-shape-correct gene clears it.

**Magnitude axis.** Mean absolute distance between the *centroid* of the top-20 and the constraint pattern, normalized by the pattern's range.

$$\text{mag}(\text{method}, \text{cluster}) = \frac{\frac{1}{T}\sum_{t=1}^{T} \left| \bar{g}_t - p_t \right|}{\max(p) - \min(p)}$$

Range $[0, \infty)$, lower is better. The range-normalization makes scores comparable across clusters with very different absolute scales --- a clusterFour spike (range $\approx 0.6$) and a clusterThree V (range $\approx 0.04$) end up on a common axis.

The two scores capture exactly what the eye does in the normalized view (shape axis) and the zoomed view (magnitude axis). Methods get plotted as points in the resulting plane.

## The Pareto Rule

A method is **viable** for a cluster if no other method strictly dominates it on both axes --- nothing else has both higher shape *and* lower magnitude error. Among the viable methods, the winner is the one closest to the **ideal corner** $(\text{shape} = 1, \text{magnitude} = 0)$.

If no method makes it close to the ideal corner --- if every method is partial credit --- the rule says fall back to highest shape, since the professor's verdict had already established shape as the priority.

That's the dual-criterion gate. Two axes, a frontier, a corner, and a fallback. Run it on each cluster.

## The Four Pictures

For each cluster, here's the resulting scatter --- methods plotted by shape (x) and magnitude error (y), with the ideal corner at upper-left:

<img src="/eigen/images/pattern-matching/dual_scatter_clusterTwo.png" alt="ClusterTwo scatter: methods plotted in shape vs magnitude plane, raw MAE alone in upper-left" style="max-width: 100%;">

*ClusterTwo. Raw MAE sits alone in the upper-left --- shape = 1.0, magnitude error tiny. No other method is competitive on both axes.*

<img src="/eigen/images/pattern-matching/dual_scatter_clusterThree.png" alt="ClusterThree scatter: methods plotted in shape vs magnitude plane" style="max-width: 100%;">

*ClusterThree. Same story. Raw MAE dominates; the normalized methods are off the magnitude axis because their picks live at five times the pattern's tiny range.*

<img src="/eigen/images/pattern-matching/dual_scatter_clusterFour.png" alt="ClusterFour scatter: methods plotted in shape vs magnitude plane, DTW in the wrong half of the shape axis" style="max-width: 100%;">

*ClusterFour. Raw MAE in the corner. DTW in the wrong half of the shape axis --- the n=4 anti-correlation failure shows up structurally as $r_{\text{med}} < 0$.*

<img src="/eigen/images/pattern-matching/dual_scatter_clusterOne.png" alt="ClusterOne scatter: no method dominates both axes; shape methods cluster on the right, raw MAE on the bottom" style="max-width: 100%;">

*ClusterOne. The exception. No method dominates both axes. Shape methods (Pearson, Fréchet, MSE) cluster around shape $\approx 0.9$ but with poor magnitude error. Raw MAE has good magnitude error but shape $= 0.35$. The frontier itself is the message: there is no single winner on this cluster.*

The first three clusters produce a clean answer: raw MAE alone in the corner. ClusterOne produces a clean *non-answer* --- the geometry tells you outright that nothing is dominating, and the fallback rule (highest shape under the professor's priority) kicks in. Pearson takes that cluster.

The four scatter plots are, honestly, satisfying to look at. They visualize the entire method-selection problem in two dimensions and let you point at a winner without saying anything else.

## Why I Deleted It

Then I stared at the four winners.

| Cluster | Pareto winner | Magnitude error | Shape score |
|---|---|---|---|
| clusterOne | Pearson (fallback) | high | 0.95 |
| clusterTwo | rawMAE | low | 1.00 |
| clusterThree | rawMAE | low | 1.00 |
| clusterFour | rawMAE | low | 1.00 |

The magnitude column does no work. On clusters Two, Three, and Four it's small because raw MAE explicitly minimizes it --- but the Pareto rule didn't *select* it for that. It selected raw MAE because it wins on *both* axes, and raw MAE wins on shape on those clusters too. On clusterOne, raw MAE's magnitude is fine but the shape collapse is what makes it lose. Magnitude isn't deciding anything.

So the rule simplifies. Drop the magnitude axis. Just ask: **of raw MAE's top-20 on this cluster, what fraction have Pearson > 0.9 against the pattern?** If high (1.00), use raw MAE; if low (0.35), fall back to Pearson. Same four answers.

That's the rawMAE-shape-test from the previous post. Two axes became one question.

The reason this works isn't subtle. The Pareto rule was using two axes to ask a single underlying question --- *did the magnitude metric also win on shape?* --- because that's the only configuration where raw MAE belongs in the upper-left corner. The shape-axis check answers that question directly. The magnitude axis was just along for the ride.

## What the Two Frameworks Show Each Other

This sounds, written out, like the sophisticated framework was useless. It wasn't. It served two purposes that the smaller test couldn't, and they're worth naming.

The first is **diagnostic geometry**. The clusterOne scatter plot says, *visually*, "no method dominates both axes." That's a richer signal than a single number. It tells you not just that the test failed, but the shape of the failure --- shape methods bunched on the right, magnitude methods on the bottom, a frontier with no corner. If the picks ever started disagreeing across runs, that scatter is where I'd look first. The single-number test would just hand back 0.35 with no map.

The second is **defensibility**. Walking a collaborator through "raw MAE is in the upper-left of this scatter on three of four clusters; on clusterOne it isn't, and here's why" is a more legible argument than "we ran a one-line test." The visualization carries the reasoning. The shorthand assumes the reasoning is already trusted.

So the two frameworks are doing two different jobs. The Pareto picture is for *understanding*. The one-question test is for *deciding*. Once I'd understood, I could decide more cheaply.

That's why the dual gate stays in the supporting analysis cell of the notebook. It's not the rule, but it's the proof of the rule. If someone wants to know why the picks are what they are, the scatter plots answer that better than any defensible-on-paper single-number test ever could.

The runner-up comparison closes the loop --- this is the picture you get on clusterOne if you *had* to pick between the two contenders:

<img src="/eigen/images/pattern-matching/winner_vs_runnerup_clusterOne.png" alt="ClusterOne Pearson winner vs raw MAE runner-up, in zoomed and normalized views" style="max-width: 100%;">

*ClusterOne, the only cluster where the rule contests itself. Top: Pearson's top-20 in zoomed and normalized views. Bottom: raw MAE's top-20 in the same two views. Pearson loses on magnitude (the curves sit below the pattern) but wins on shape (the normalized view traces the up-down-up shape). Raw MAE wins on magnitude but the normalized view fans out --- the genes are at the right level but going the wrong way at the wrong times.*

That picture is the dual-axis scatter plot's argument, made human.

## The Deeper Lesson

There's a tendency, when you've built a piece of machinery and it works, to keep it. Especially when it's principled, photogenic, and resolves an open question. The Pareto framework was all three. Throwing it out felt wrong.

But the test of a framework isn't whether it's principled or photogenic. It's whether it's the smallest thing that gives the right answer. If a single-number check returns the same picks on every cluster, the two-axis evaluation is decoration. Real decoration --- legitimately useful for explaining the picks --- but decoration. Calling it "the framework" instead of "the picture" was the mistake.

So the rule is the one-question test. The picture is the Pareto scatter. Both stay around, doing the work each is best at. The mistake would have been letting the prettier object drive the deliverable.

Sometimes the right framework is the one that got the answer first, even if it was clumsier. Sometimes the right framework is the one that fits in a sentence. The trick is being willing to swap from the first to the second once you notice they agree.

---

*This is the sixth post about the NMF chemo-immunotherapy project. Previously: [When the Wrong Method Picks the Right Genes](../when-the-wrong-method-picks-the-right-genes).*
