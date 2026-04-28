---
title: "The Fork in the Road: Shape or Magnitude?"
date: 2026-04-23
author: "Matt Jacob"
description: "Last week ended on a question the math couldn't decide. This week's job was to make the question concrete enough for a human to. Two competing methodologies, one paradox cluster, and the gotcha that makes shape itself a weak filter on n=4 timepoints."
tags: ["NMF", "bioinformatics", "gene-expression", "similarity-metrics"]
draft: false
---

The previous post ended with a question the math couldn't answer: should similarity mean *shape* (the gene rises and falls when the pattern does) or *magnitude* (the gene's expression curve sits at the same level on the plot)? Six normalized methods all picked shape, by accident of preprocessing. Raw MAE picked magnitude, also kind of by accident, and won on three of four clusters. ClusterOne didn't work for either approach.

What I wanted to do this week was *answer* that question. What I actually did was something more useful: I made the question concrete. Built two competing methodologies side by side, ran both on every cluster, and surfaced the tradeoffs cleanly enough that someone with biological context --- the professor --- could pick.

What surfaced along the way was a gotcha I hadn't appreciated. With four timepoints, "shape" itself is not a strong filter. On one cluster it's a *terrible* filter. And the gating idea I'd been treating as a fix can be silently fooled by a pattern's own geometry.

## The Setup, Restated

Four constraint patterns, one per cluster, each with values at $t = 0, 3, 6, 9$. ~17,856 genes per cluster. The job: rank the genes by similarity to the pattern.

The previous post ([When Correlation Lies](../when-correlation-lies-gene-expression-pattern-matching)) established that all six original methods --- Pearson, DTW, cosine, Fréchet, MSE, sMAPE --- run on min-max normalized data and therefore measure shape only. Raw MAE skips the normalization, runs on log-transformed expression directly, and so measures actual distance on the plot.

Two paths forward, depending on what "similarity" should mean:

- **Path A --- shape-based.** Take the six normalized methods, fix the gating problem from last week, ensemble them. Output: genes that move *like* the pattern, regardless of expression level.
- **Path B --- magnitude-aware.** Use raw MAE. Output: genes whose curves sit *on* the pattern.

This week was about running both paths cleanly on every cluster, then asking: where does each path help, where does it fail, and which cluster reveals the most about the underlying biology?

## Act 1: The 4-Timepoint Gotcha

Before either path, there's a problem with the very idea of "shape" on this dataset.

With four timepoints, each gene has three transitions: $t_0 \to t_3$, $t_3 \to t_6$, $t_6 \to t_9$. Collapse each to its sign --- up, down, or flat --- and you get at most $3^3 = 27$ shape classes. In practice only about 8 are populated (genes with mixed flat-transitions are rare). Every gene falls into one of those 8 buckets. So does the constraint pattern.

Any shape-based metric is, at the coarsest level, sorting all 17,856 genes into those 8 bins and then tiebreaking within the bin matching the pattern.

Here's the count of genes that share each constraint pattern's sign class:

<img src="/eigen/images/pattern-matching/sign_pattern_distribution.png" alt="Bar chart of how many genes share the constraint pattern's sign class for each cluster" style="max-width: 100%;">

*For each cluster, the count of genes whose three transitions match the constraint pattern's transitions in sign. ClusterThree has 6,326 such genes --- 35.4% of the whole dataset.*

The clusterThree number is the damning one. Its constraint pattern --- a V-shape with a near-zero dip at $t = 3$ --- shares its sign class with **6,326 genes**. More than a third of the dataset trivially passes the shape filter before any tiebreaking begins. Whatever a shape-based method ranks within that bucket is essentially the secondary criterion driving the result, not the shape itself.

ClusterTwo is the opposite: only 0.9% of genes follow $(+, +, +)$, the steady-increase pattern. There, shape is selective. Whatever a shape method picks, it had real work to do.

ClusterOne and clusterFour share $(+, -, +)$ --- a spike pattern --- but the magnitudes are wildly different. The shape itself doesn't carry the spike's *height*. Two genes with the same sign class can have a 100$\times$ difference in spike amplitude and look identical to a shape-only method.

The takeaway is unsettling. With four timepoints, "shape" is a low-dimensional descriptor. On a cluster like clusterThree, it's not enough to discriminate. The methods that look like they're measuring something sophisticated are, structurally, doing something close to a coarse bucket sort.

## Act 2: Path A --- Patching the Shape-Based Pipeline

Last week I'd bolted a gate onto the ensemble: relative centroid error, normalized by the pattern's range. The gate's job is to silence methods whose top-20 lands far from the pattern, before they vote.

The gate worked on clusterTwo and clusterThree --- it correctly silenced methods that picked off-pattern genes. ClusterOne, the gate didn't matter much; all six methods picked similar genes anyway. But clusterFour broke it.

ClusterFour's pattern has a sharp spike at $t = 3$ --- $0.009 \to 0.638 \to 0.018 \to 0.024$, a 70$\times$ jump and back. The pattern range is enormous. The gate normalizes error by $(\max(p) - \min(p))^2$, so a method whose top-20 are completely flat genes still ends up with a "moderate" relative error after dividing by that big denominator. The gate doesn't fire. Six out of six methods pass through and vote, even though all six have picked genes that don't spike at all.

Here's the result. Each panel shows the top-20 genes from one of eight methods (six normalized, plus raw MAE and a magnitude-aware variant) overlaid on the clusterFour constraint pattern:

<img src="/eigen/images/pattern-matching/eightways_clusterFour.png" alt="ClusterFour top-20 genes from eight different methods, most of which picked flat genes that miss the spike" style="max-width: 100%;">

*ClusterFour --- the spike at $t = 3$ is visible in the constraint pattern (red). Most normalized methods pick flat genes. The shape-based gate doesn't fire because the pattern's large range hides the centroid error.*

This is the failure mode I want to be honest about. The gate is a band-aid that *looks* like a fix because it works on two clusters. On a cluster where the gate's own normalization gets fooled by the pattern's geometry, gating doesn't help. Worse, it gives a false signal that the pipeline is working.

Here is the gated ensemble run cluster by cluster, top-20 genes overlaid:

<img src="/eigen/images/pattern-matching/pathA_shape_based.png" alt="Path A composite: gated shape-based ensemble across all four clusters" style="max-width: 100%;">

*Path A. Gated shape-based ensemble. ClusterTwo and clusterThree look clean. ClusterOne is mediocre. ClusterFour is genuinely broken --- the genes are flat against a spike pattern, and the gate didn't catch it.*

Path A is the right answer if --- and only if --- shape is what the biology cares about. Even then, clusterFour needs more than a centroid-error gate to get sensible picks.

## Act 3: Path B --- Just Use Raw MAE Everywhere

The other extreme. No normalization, no ensemble, no gate. Just rank every gene by mean absolute error against the pattern in log-transformed space.

<img src="/eigen/images/pattern-matching/pathB_magnitude_based.png" alt="Path B composite: raw MAE top-20 genes for all four clusters" style="max-width: 100%;">

*Path B. Raw MAE top-20 across all four clusters. ClusterTwo, Three, and Four look excellent --- the genes hug the constraint pattern in both shape and magnitude. ClusterOne is the case where this approach doesn't work: genes at the right magnitude don't follow the spike.*

ClusterTwo, clusterThree, and clusterFour are the cleanest fits I've seen on this dataset. In each, the top-20 genes sit on the constraint pattern --- they have the right shape *and* the right magnitude. ClusterFour, where Path A's gate failed silently, is here exactly what you'd want: genes that spike at $t = 3$ alongside the pattern.

The interesting case is again clusterOne.

## The ClusterOne Paradox

ClusterOne's pattern is $0.85 \to 2.55 \to 1.85 \to 2.05$ --- moderate baseline, spike at $t = 3$, partial recovery, slight final rise. Shape class $(+, -, +)$.

Plenty of genes in the dataset spike at $t = 3$. Plenty of genes sit at expression levels around 2. But there's almost no overlap between those two groups. Genes at the right magnitude are flat. Genes that spike are at the wrong magnitude.

Here's raw MAE's top-20 for clusterOne:

<img src="/eigen/images/pattern-matching/raw_composite_clusterOne.png" alt="ClusterOne raw MAE top-20: genes at the right magnitude but flat where the pattern spikes" style="max-width: 100%;">

*ClusterOne, raw MAE top-20. The genes match the magnitude well --- they live at the right expression level on the y-axis --- but they barely move where the pattern spikes. Magnitude without shape.*

And Path A, the shape ensemble, picks the inverse: genes that spike with the right sign pattern, but at expression levels well below the pattern's plateau.

ClusterOne is the diagnostic case. When shape and magnitude are *aligned* in the underlying gene population, both paths converge on similar picks (clusters Two, Three). When they're not aligned --- when the genes that spike right are at the wrong level --- the two paths split, and they each win on their own axis. There's no single right answer. There's a choice of axis.

## Why I Can't Decide

This is a methodological question that depends on a biological one I can't answer.

If the constraint patterns represent **co-regulation** --- "these genes share an upstream regulator, so they rise and fall together" --- then magnitude is incidental. Two genes can share a transcription factor and express at completely different levels because they have different promoter strengths. The right metric is shape. The WGCNA / Eisen tradition leans this direction: same upstream signal, different absolute levels, all considered "co-expressed."

If the constraint patterns represent **functional thresholds** --- "this gene needs to be at level $X$ to do its job" --- then magnitude carries information. A gene that hits the right shape at one-tenth the amplitude isn't doing the same thing biologically as one that hits both. The right metric is raw MAE.

The math has nothing to say about which interpretation applies. The constraint patterns came out of NMF, which decomposes by additive contribution, not by mechanistic role. Whether the resulting patterns mean "shared upstream regulator" or "shared expression level required for function" is a question about the underlying biology of TCR signaling under chemo-immunotherapy, not a question about similarity metrics.

So this week's deliverable, honestly, is the question, fully formed, with both answers worked out. Path A run end-to-end. Path B run end-to-end. ClusterOne flagged as the case neither path resolves cleanly. The professor and the group decide which axis matters --- and from there, whether to refine Path A's gate, commit to Path B, or build something hybrid.

## The Deeper Lesson

There's a temptation, when a method seems to be working, to keep adding machinery to make it work better. Tune the gate. Add another layer. Build an ensemble of ensembles. The instinct is technical: more sophistication, better results.

But sometimes the right move is the opposite. Run the simplest version of every reasonable approach, lay them out side by side, and let the disagreements tell you what question you actually need to answer. Two paths, four clusters, one paradox case --- that arrangement is more informative than any single sophisticated pipeline I could have built. It surfaces the choice that the math has been quietly making on its own all along.

The clusterFour gate failure is a small example of the same lesson. It's not that the gate idea is wrong. It's that I was relying on a single quality metric to silence bad methods, and the metric got fooled by the very thing it was supposed to be measuring. The fix isn't a better gate. The fix is admitting that on a pattern with a 70$\times$ range, no normalized centroid error is going to behave the way it does on a pattern with a 1.5$\times$ range.

Some weeks the answer is a result. Some weeks the answer is a clean, well-posed question. This is one of the latter.

---

*This is the fourth post about the NMF chemo-immunotherapy project. Previously: [When Correlation Lies](../when-correlation-lies-gene-expression-pattern-matching).*
