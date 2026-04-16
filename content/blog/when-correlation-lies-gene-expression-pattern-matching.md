---
title: "When Correlation Lies: Finding Genes That Actually Match the Pattern"
date: 2026-04-16
author: "Matt Jacob"
description: "Six similarity metrics all agreed on the best-matching genes. They were all wrong. Here's how normalization erases magnitude, why Pearson r = 1.0 doesn't mean what you think, and why the simplest possible metric turned out to be the right one."
tags: ["NMF", "bioinformatics", "gene-expression", "similarity-metrics"]
draft: false
---

You have a pattern --- a curve describing how gene expression should behave across four timepoints. You have 17,856 genes. The question is simple: *which genes follow this pattern?*

Six similarity metrics say they know the answer. They rank every gene, surface their top picks, and you plot the results. Some of those top picks look nothing like the pattern. They're not even close. And yet the metrics --- Pearson correlation, DTW, cosine similarity, Frechet distance, MSE, sMAPE --- are returning scores that say these genes are excellent matches.

The metrics aren't buggy. They're doing exactly what they were asked to do. The problem is that what they were asked to do is not the same as what you actually want.

This is a story about a week of debugging that turned into a lesson about the gap between mathematical similarity and visual similarity --- and how the simplest possible fix was sitting there the whole time.

## The Setup

This is part of ongoing research with [Dr. Nancy Guo's group](https://doi.org/10.1158/2767-9764.CRC-22-0383) at Binghamton University, extending the NMF-based gene expression analysis described in [my previous post](../nmf-chemoimmuno-analysis). We have single-cell RNA-seq data from a lung cancer patient undergoing chemo-immunotherapy: ~17,856 genes measured at four timepoints (0, 3, 6, and 9 hours).

NMF decomposition produced four clusters, each with a **constraint pattern** --- a biologically observed expression trend that we expect certain genes to follow. The goal of the current phase: for each cluster, find the genes whose expression best matches the constraint pattern.

Last week, we implemented six similarity metrics and built a voting ensemble where each method casts votes for its top-20 genes. The ensemble worked beautifully on some clusters and fell apart on others. On clusterThree, for instance, only one method (sMAPE) picked genes that visually followed the pattern. The other five methods picked genes that were confidently, demonstrably wrong.

The professor's suggestion was intuitive: set score cutoffs. If a method's best score on a cluster doesn't meet some quality bar, silence it before it votes.

## Act 1: Why Fixed Thresholds Don't Work

The idea is clean. For each metric, define a threshold. Pearson correlation above 0.99. DTW distance below 0.08. If the method can't meet that bar on a given cluster, it doesn't get to vote there.

The problem reveals itself immediately when you look at the score distributions:

<img src="/eigen/images/pattern-matching/act1_threshold_sweep.png" alt="Score distributions for six methods across four clusters, showing why no single threshold line works" style="max-width: 100%;">

*Top-20 score distributions for each method across all four clusters. Large dots are the best (top-1) score per cluster. Any horizontal threshold line that silences the bad clusters also kills the good ones.*

The same method has wildly different score distributions on different clusters. A threshold tuned to silence MSE on clusterThree --- where it's picking wrong genes --- will also silence MSE on clusterOne, where it works fine. The score distributions are just too different across patterns with different scales, shapes, and difficulty levels.

We pushed this to its logical extreme: what thresholds would you need to force the "correct" answer on clusterThree (only sMAPE active)? For Pearson, you'd need $r > 1.001$. That's mathematically impossible --- Pearson correlation is bounded by $[-1, 1]$. To silence Pearson on clusterThree, you need a threshold that doesn't exist.

<img src="/eigen/images/pattern-matching/act1_forced_thresholds.png" alt="Forced thresholds that silence clusterThree also destroy other clusters" style="max-width: 100%;">

*Original thresholds (red dashed) vs forced thresholds (black solid) designed to isolate sMAPE on clusterThree. The forced thresholds cut through score distributions of clusters where those methods work fine --- collateral damage everywhere.*

Fixed thresholds are a dead end. You can't build a per-method quality floor when the floor keeps moving.

## Why the Metrics Are Confidently Wrong

Before jumping to the fix, it's worth understanding *why* six different similarity metrics all fail in the same way. The root cause is upstream of the metrics themselves.

### Normalization erases magnitude

All six methods operate on min-max normalized data. Before computing any similarity score, each gene's expression time series is mapped to the interval $(0, 1]$:

$$x_{\text{norm}} = \frac{x - x_{\min} + \epsilon}{x_{\max} - x_{\min} + \epsilon}$$

This is standard practice --- it puts all genes on a common scale so metrics aren't dominated by high-expression genes. But it has a consequence that's easy to overlook.

Consider a constraint pattern with values around 0.04 across the four timepoints. Gene A sits right on top of it --- expression values nearly identical. Gene B has the same *shape* but at 37$\times$ the magnitude --- values around 1.5. After min-max normalization, both genes map to $(0, 1]$ with the same temporal profile. The 37$\times$ difference in expression level is completely erased.

<img src="/eigen/images/pattern-matching/log_vs_normalization.png" alt="Log transform compresses but preserves distance; min-max normalization erases it entirely" style="max-width: 100%;">

*Three representations of two genes and a pattern. Left: raw values --- Gene A hugs the pattern, Gene B is 100$\times$ away. Center: log transform --- compressed, but Gene A is still closer. Right: after min-max normalization, all three curves collapse to the same line. The distance information is gone.*

The log transform (which was applied before normalization) compresses dynamic range but preserves the *ordering* of distances. A gene that's close stays closer than a gene that's far. Min-max normalization destroys even that. Every gene ends up in the same box, and the metrics can't tell them apart.

### Pearson doesn't care about magnitude (by design)

Pearson correlation is explicitly scale and shift invariant. The formula mean-centers and variance-normalizes both vectors before computing the dot product:

$$r = \frac{\sum(x_i - \bar{x})(y_i - \bar{y})}{\sqrt{\sum(x_i - \bar{x})^2 \sum(y_i - \bar{y})^2}}$$

Mean-centering erases the offset. Dividing by the standard deviation erases the scale. Two genes with expression values $[0.04, 0.00, 0.037, 0.035]$ and $[1.50, 0.00, 1.30, 1.20]$ will both get $r = 1.0$ against a pattern with the same shape, despite one being 37$\times$ larger.

<img src="/eigen/images/pattern-matching/pearson_visual_explanation.png" alt="Two genes both with Pearson r = 1.0 but at completely different expression levels" style="max-width: 100%;">

*Both Gene A and Gene B have Pearson $r = 1.0$ against the constraint pattern. Gene A (green) sits directly on the pattern. Gene B (blue) is 37$\times$ larger. Pearson can't distinguish them. Raw MAE can: Gene A has MAE $\approx 0$, Gene B has MAE $= 0.87$.*

This isn't a bug in Pearson correlation. It was designed to be scale-invariant --- that's the whole point. If you're asking "does this gene go up and down at the same times as the pattern," Pearson is the right tool. If you're asking "does this gene's expression curve *sit on top of* the pattern line on the plot," Pearson will lie to you with perfect confidence.

## Act 2: Data-Driven Gating

If we can't set fixed thresholds on raw scores, maybe we can evaluate the *output quality* of each method --- do its top genes actually match the pattern? --- and use that to automatically silence bad methods before they vote.

We tested three gate candidates. For each method $\times$ cluster combination, each gate produces a single quality score:

- **Gate A (Median Pearson):** Median correlation between the method's top-20 genes and the constraint pattern. Captures shape agreement.
- **Gate B (Gene Spread):** Average standard deviation of the top-20 genes across timepoints. Low spread means tight band around the pattern.
- **Gate C (Centroid MSE):** MSE between the *mean* of the top-20 gene curves and the constraint pattern. If the genes are scattered or clustered around the wrong shape, the centroid won't match.

Gate A failed immediately --- Pearson correlation is the problem, not the solution. Even methods that pick visually terrible genes still get high median Pearson values, because Pearson can't see magnitude mismatch. Gate B partially worked but was fooled by methods whose top genes were tightly grouped *in the wrong place*. Gate C had the right idea, but struggled across clusters because different patterns have different absolute scales.

The fix: normalize the centroid error by the pattern's range, producing a **relative centroid error** that's comparable across clusters:

$$\text{Gate C-norm} = \frac{\text{MSE}(\bar{g}_{\text{top20}},\ p)}{(\max(p) - \min(p))^2}$$

<img src="/eigen/images/pattern-matching/act2_gate_c_norm.png" alt="Relative centroid error sorted for all 24 method-cluster combinations" style="max-width: 100%;">

*All 24 method $\times$ cluster combinations ranked by relative centroid error. A natural gap separates methods that work (green) from methods that don't (red). This gate correctly identified that only sMAPE works on clusterThree.*

The normalized centroid gate found the right answer on clusterThree --- silencing everything except sMAPE. But it still couldn't fix clusterOne and clusterFour, where the underlying problem (magnitude blindness from normalization) affected *all* methods equally.

<img src="/eigen/images/pattern-matching/ensemble_gate_c_norm.png" alt="Gated ensemble results across four clusters" style="max-width: 100%;">

*Gated ensemble voting with the normalized centroid error gate. ClusterTwo and clusterThree look reasonable. ClusterOne and clusterFour still show genes far from the pattern --- gating can silence bad methods, but can't fix a method that was never looking at the right thing.*

Gating is a band-aid. It can stop bad methods from voting, but it can't create a good method out of a fundamentally flawed measurement. If every method is blind to magnitude, silencing some of them doesn't make the others see.

## Act 3: Just Measure the Distance

The entire problem comes from one decision: normalizing gene expression to $(0, 1]$ before computing similarity. What if we just... didn't?

**Raw-space MAE** --- Mean Absolute Error computed on the actual log-transformed expression values, with no normalization step:

$$\text{MAE}(g, p) = \frac{1}{T} \sum_{t=1}^{T} |g_t - p_t|$$

where $g$ is a gene's expression values and $p$ is the constraint pattern, both in log-transformed (but not normalized) space. This is literally "how far is this gene from the pattern line on the plot" --- the closest computational analog to what the human eye does when it judges a visual fit.

<img src="/eigen/images/pattern-matching/act3_raw_mae.png" alt="Raw MAE top-20 genes per cluster hugging the constraint pattern" style="max-width: 100%;">

*Raw-space MAE top-20 genes per cluster. Clusters Two, Three, and Four show dramatically better visual fits than any previous method --- the gene curves actually sit on the pattern line. ClusterOne is the exception: genes at the right magnitude don't follow the spike shape.*

Clusters Two, Three, and Four show exactly what you'd want: gene expression curves that hug the constraint pattern, matching both shape and magnitude. The overlap between raw MAE's top-20 and the normalized methods' top-20 was near zero for most clusters --- raw MAE is finding genuinely different genes, ones that the normalized methods couldn't see.

ClusterOne is the interesting exception. The constraint pattern has a dramatic spike at $t = 3$, and genes at the right *magnitude* (close to the pattern's absolute values) don't follow that spike shape. There are plenty of genes that spike at $t = 3$, but at the wrong expression level. ClusterOne is the case where shape and magnitude are in conflict --- the genes that move right are in the wrong place, and the genes in the right place don't move.

## The Open Question

This week's work surfaced a question that determines the entire methodological direction going forward:

**Do we care about expression level, or just temporal shape?**

If we care about magnitude --- "find me genes expressing at the same level as this pattern" --- then raw MAE is the right metric. It directly measures what the eye sees on a plot.

If we care about shape --- "find me genes that go up and down at the same times, regardless of expression level" --- then the normalized methods with gating are the right approach. Pearson correlation's scale invariance isn't a bug, it's the feature.

The answer depends on the biology. If the constraint patterns represent specific expression programs that operate at characteristic levels, magnitude matters. If they represent temporal dynamics that can occur at any expression level, shape is what counts.

We're waiting on the professor's decision. In the meantime, the technical lesson is clear: normalization is not a free operation. It makes an implicit claim about what kind of similarity matters, and if that claim doesn't match your actual question, every metric downstream will be answering the wrong thing.

---

*This is the third post about the NMF chemo-immunotherapy project. Previously: [Six Ways to Measure Similarity (and Why They Disagree)](../six-ways-to-measure-similarity-gene-expression).*
