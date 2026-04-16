---
title: "Six Ways to Measure Similarity (and Why They Disagree)"
date: 2026-04-09
author: "Matt Jacob"
description: "We threw six similarity metrics at 17,856 genes and asked which ones match a biological expression pattern. Some methods agreed beautifully. Others didn't share a single gene. The math explains why."
tags: ["NMF", "bioinformatics", "similarity-metrics", "gene-expression"]
draft: false
---

Imagine a curve --- a temporal signature describing how gene expression should behave over time. It rises here, dips there, spikes at hour 3. Somewhere in a matrix of 17,856 genes, each measured at four timepoints, the genes that follow this curve are hiding. The task is to find them.

This sounds like a solved problem. Compute a similarity score between each gene and the pattern, sort, take the top 20. But which similarity score? Pearson correlation? Dynamic Time Warping? Cosine similarity? Mean Squared Error? Each one claims to measure "how similar are these two curves," and each one hands back a different list of genes.

The question isn't which metric is "correct." The question is what each metric *means* --- what property of the data it's actually measuring --- and whether that property is the one that matters.

## The Data

This extends the NMF-based analysis described in [a previous post](../nmf-chemoimmuno-analysis). NMF decomposition of single-cell TCR and gene expression data produced four clusters, each with a **constraint pattern** --- a biologically observed expression trend across four timepoints (0, 3, 6, and 9 hours post-stimulation):

| Cluster | Shape | LT Values (0, 3, 6, 9h) | Character |
|---------|-------|--------------------------|-----------|
| One | Spike at t=3 | 0.89, 2.57, 1.83, 2.02 | Sharp rise, partial recovery |
| Two | Steady increase | 0.04, 0.59, 0.80, 1.02 | Monotonic climb |
| Three | Flat with dip | 0.04, 0.00, 0.04, 0.03 | Near-constant, drops to zero at t=3 |
| Four | Extreme spike | 0.009, 0.49, 0.02, 0.02 | 70$\times$ spike at t=3, then collapse |

Previous work used NMF's own factor loadings to rank genes, but NMF uses non-negative factors --- a gene upregulated 2$\times$ and one downregulated 2$\times$ can get similar coefficients. We needed metrics that directly measure how well each gene's expression curve matches the constraint pattern.

### Normalization

Before computing any metric, each gene's expression time series is min-max normalized to $(0, 1]$:

$$x_{\text{norm}} = \frac{x - x_{\min} + \varepsilon}{x_{\max} - x_{\min} + \varepsilon}$$

The $\varepsilon$ offset prevents division by zero for constant-expression genes (which get mapped to 1.0 at all timepoints). This puts every gene on the same scale so metrics compare *shape* rather than raw magnitude. Whether this is the right thing to do turns out to be a deeper question than it appears --- more on that in the [next post](../when-correlation-lies-gene-expression-pattern-matching).

## The Six Metrics

### 1. Pearson Correlation

$$r = \frac{\sum(p_i - \bar{p})(g_i - \bar{g})}{\sqrt{\sum(p_i - \bar{p})^2 \cdot \sum(g_i - \bar{g})^2}}$$

Pearson is the cosine of the angle between the *mean-centered* versions of two vectors. Subtracting the mean strips away the overall expression level and isolates the temporal shape --- the pattern of relative increases and decreases.

The key properties: Pearson is **scale invariant** (multiplying all values by a constant doesn't change $r$) and **shift invariant** (adding a constant doesn't change $r$). The gene $[1, 12, 5, 7]$ and $[100, 1200, 500, 700]$ yield identical Pearson scores. For the question "does this gene go up and down at the same times as the pattern," it is exactly the right tool.

The limitation: with $n = 4$ timepoints, the t-test for significance has $n - 2 = 2$ degrees of freedom. Two random vectors in $\mathbb{R}^4$ have roughly a 20% chance of $|r| > 0.8$ purely by chance. Individual $r$ values shouldn't be overinterpreted --- the value lies in the *ranking* across all 17,856 genes, not in any single score.

### 2. Cosine Similarity

$$\cos(\theta) = \frac{\sum p_i \cdot g_i}{\sqrt{\sum p_i^2} \cdot \sqrt{\sum g_i^2}}$$

Same dot-product-over-magnitudes formula as Pearson, but *without* mean-centering first. This seems like a minor difference. It isn't.

Cosine similarity on raw vectors decomposes as:

$$\cos(\mathbf{p}, \mathbf{g}) = \frac{r \cdot \sigma_p \cdot \sigma_g + n \cdot \bar{p} \cdot \bar{g}}{\sqrt{\sum p_i^2} \cdot \sqrt{\sum g_i^2}}$$

The first term captures shape similarity (proportional to Pearson $r$). The second is a **baseline bias** that scales with the product of the means. When both vectors have large means relative to their variation --- think a housekeeping gene with high, stable expression --- the bias term dominates and cosine returns a high score even if the shapes don't match at all.

Take a flat housekeeping gene $[10, 10, 10, 10]$ against a spiking pattern. After normalization, the gene becomes $[1, 1, 1, 1]$. Pearson correctly returns undefined --- this gene has no shape. Cosine returns 0.788, suggesting a decent match. That's enough to rank it above thousands of genes with real temporal dynamics. A metric that thinks a flatline is a decent match to a spike has a problem.

### 3. Dynamic Time Warping (DTW)

DTW finds the optimal temporal alignment between two time series via dynamic programming:

$$C[i, j] = d(p_i, g_j) + \min\big(C[i{-}1, j],\; C[i, j{-}1],\; C[i{-}1, j{-}1]\big)$$

Think of it as stretching or compressing one series' time axis to best align it with the other. A gene that peaks at hour 6 instead of hour 3 would get a high MSE (the peaks don't line up point-by-point) but potentially a low DTW score, because DTW can warp $t = 6$ to align with $t = 3$.

The catch: with only 4 timepoints, the $4 \times 4$ cost matrix limits warping to at most 1--2 positions. The flexibility that makes DTW powerful on longer time series (15+ points) barely manifests here. In practice, DTW reduces to a slightly flexible version of pointwise distance, which is why it shows 16--17 out of 20 overlap with Pearson on most clusters.

Where DTW diverges is clusterTwo (the monotonic increase), where its warping captures slightly delayed increases that point-by-point methods penalize. With denser time sampling, DTW would add substantially more value.

### 4. Frechet Distance

$$C[i, j] = \max\Big(d(p_i, g_j),\; \min\big(C[i{-}1, j],\; C[i, j{-}1],\; C[i{-}1, j{-}1]\big)\Big)$$

The classic "dog-walking distance." A person walks along curve P, a dog along curve G, connected by a leash. Both can vary speed but neither can go backward. The Frechet distance is the shortest leash that lets both finish their respective curves.

The only structural difference from DTW: **max** instead of **sum**. DTW accumulates all pointwise errors. Frechet only cares about the *worst* single-point deviation. A gene that's slightly off everywhere gets low DTW and low Frechet. A gene that's perfect at 3 timepoints but wildly off at 1 gets low DTW (the good points dilute the bad one) but high Frechet (the worst point dominates).

At 4 timepoints, this distinction barely matters. The largest error term tends to dominate both metrics anyway. Frechet and MSE show 19--20 out of 20 overlap on most clusters. They're nearly redundant.

### 5. Mean Squared Error (MSE)

$$\text{MSE} = \frac{1}{n} \sum(p_i - g_i)^2$$

The simplest possible distance metric. Average squared difference between corresponding timepoints. No alignment, no angular measurement --- just the pointwise distance between two vectors.

MSE and Pearson are mathematically related:

$$\text{MSE} = \text{Var}(\mathbf{p}) + \text{Var}(\mathbf{g}) - 2r\,\sigma_p\sigma_g + (\bar{p} - \bar{g})^2$$

When two normalized vectors have similar variance and mean, this simplifies to roughly $\text{MSE} \approx 2\sigma^2(1 - r)$. The Pearson $r$ term dominates, which is why MSE and Pearson show 16--18 out of 20 overlap in practice. They're measuring nearly the same thing from complementary perspectives --- angular similarity vs Euclidean distance.

### 6. sMAPE (Symmetric Mean Absolute Percentage Error)

$$\text{sMAPE} = \frac{1}{n} \sum \frac{2\,|p_i - g_i|}{|p_i| + |g_i| + \varepsilon}$$

sMAPE measures *relative* error at each timepoint. A difference of 0.01 when both values are around 0.01 counts the same as a difference of 1.0 when both values are around 1.0.

This is where things break. When the pattern has a zero (or near-zero) at any timepoint:

$$\frac{2\,|0 - g_i|}{|0| + |g_i|} = \frac{2|g_i|}{|g_i|} = 2.0$$

The term saturates at the maximum possible value for *every* gene, regardless of $g_i$. The most biologically informative timepoint --- the one that defines the pattern's characteristic shape --- contributes a constant to every gene's score and provides zero discriminating power.

On clusterThree, whose pattern dips to zero at $t = 3$, this failure is catastrophic. sMAPE ends up ranking genes based solely on noise at the three non-informative timepoints, completely missing the biologically important dip. The result: **0 out of 20 overlap** with every other method.

## Where They Agree, and Where They Don't

### ClusterTwo: consensus

ClusterTwo (steady monotonic increase) is where all methods largely agree. Nine genes achieved unanimous 6/6 votes in the ensemble --- every method placed them in its top 20.

<img src="/eigen/images/pattern-matching-methods/overlap_6methods_LT_clusterTwoLT.png" alt="Overlap heatmap for clusterTwo showing high agreement across methods" style="max-width: 100%;">

*Overlap heatmap for clusterTwo. Most method pairs share 15--20 of their top-20 genes. Pearson, MSE, and Frechet form a tight core. DTW partially diverges (3--4 unique genes from warping). sMAPE shows moderate overlap.*

When the pattern is a clean, steady curve without extreme spikes or zeros, all six metrics converge on the same answer. The differences are in the details --- which 2--3 genes appear in one list but not another --- but the consensus is strong.

<img src="/eigen/images/pattern-matching-methods/Ensemble_LT_clusterTwoLT_constraint.png" alt="Ensemble top-20 genes for clusterTwo closely following the steady increase pattern" style="max-width: 100%;">

*Ensemble voting results for clusterTwo. Top-20 consensus genes (blue) tracked against the constraint pattern (red dashed). Opacity is proportional to vote count --- darker lines received more votes.*

### ClusterFour: total disagreement

ClusterFour (70$\times$ spike at $t = 3$) is where everything falls apart.

<img src="/eigen/images/pattern-matching-methods/overlap_6methods_LT_clusterFourLT.png" alt="Overlap heatmap for clusterFour showing zero agreement between method groups" style="max-width: 100%;">

*Overlap heatmap for clusterFour. Zero overlap between Pearson, DTW, and sMAPE. Cosine, Frechet, and MSE form a tight cluster (19--20 overlap) but are completely disconnected from Pearson and DTW.*

**Zero** shared genes between Pearson and MSE. Zero between DTW and anything else. The methods split into factions, and no method pair bridges the gap.

After normalization, clusterFour's pattern is effectively $[0, 1, 0, 0]$ --- a near-delta function. Matching a delta function requires exact agreement at one timepoint ($t = 3$), while the other three near-zero timepoints provide almost no discriminating information. Each metric projects "closeness to a spike" differently:

- **Pearson** finds any gene with a *relative* peak at $t = 3$, regardless of magnitude
- **MSE/Frechet** are dominated by the squared or max error at the spike value
- **Cosine** is dominated by the $t = 3$ component of the dot product
- **DTW** warps neighboring timepoints toward $t = 3$, changing which genes win
- **sMAPE** blows up at the near-zero values at $t = 0, 6, 9$

<img src="/eigen/images/pattern-matching-methods/Ensemble_LT_clusterFourLT_constraint.png" alt="Ensemble results for clusterFour showing scattered gene curves" style="max-width: 100%;">

*Ensemble results for clusterFour. No gene receives more than 3/6 votes. The gene curves are scattered --- the ensemble can't find agreement because the methods are measuring fundamentally different things on a delta-function pattern.*

ClusterFour needs either denser time sampling or a specialized peak-detection approach. Whole-series similarity matching breaks down when the series is dominated by a single point.

### The sMAPE disaster on ClusterThree

<img src="/eigen/images/pattern-matching-methods/sMAPE_LT_clusterThreeLT_constraint.png" alt="sMAPE top-20 genes for clusterThree showing complete mismatch with the pattern" style="max-width: 100%;">

*sMAPE's top-20 genes for clusterThree. These genes bear no resemblance to the flat-with-dip constraint pattern (red dashed). The zero at $t = 3$ saturated the sMAPE term to 2.0 for every gene, so the ranking is based entirely on noise at the other timepoints.*

Five of six methods agree on clusterThree (17--20 overlap among Pearson, DTW, Cosine, Frechet, and MSE). sMAPE shares zero genes with any of them. This is the clearest example of a metric failing not because of a bug or bad parameters, but because its mathematical formulation is structurally incompatible with the data.

## The Grouping Structure

Step back, and the overlap data reveals a clean taxonomy:

**Group 1: Shape/Distance (Pearson + MSE + Frechet).** After normalization, all three measure trajectory proximity --- Pearson via angular comparison, MSE via Euclidean distance, Frechet via worst-case deviation. The approximate relationship $\text{MSE} \approx 2\sigma^2(1-r)$ means they're mathematically coupled. 15--20 overlap consistently.

**Group 2: Alignment (DTW).** Overlaps with Group 1 when warping is irrelevant (clusters One and Three). Diverges when temporal flexibility matters (clusterTwo: 2--3 overlap). Genuinely different in what it measures, but that difference rarely manifests at 4 timepoints.

**Group 3: Context-Dependent (Cosine).** Behavior varies wildly by cluster geometry. Perfect agreement with Pearson on flat patterns (clusterThree: 20/20). Complete disagreement on high-variance patterns (clusterOne: 2/20). Its rankings depend on data geometry in ways that don't track biological relevance.

**Group 4: Percentage-Based (sMAPE).** Isolated whenever zeros are present. Structurally incompatible with patterns that pass through zero.

## The Ensemble

The ensemble strategy converts all metric scores to ranks, counts how many methods place each gene in the top 20, and sorts by vote count (ties broken by average rank). A gene appearing in 5 of 6 methods' top-20 lists is almost certainly following the pattern. A gene appearing in only 1 is either a false positive or a genuinely different kind of match that only one metric can detect.

The visualization encodes consensus as opacity --- darker lines are higher-vote genes. Dark blue lines hugging the red pattern are the answer. Faded, scattered lines are the noise.

And the ensemble works well when methods mostly agree (clusters Two and Three). It produces mediocre compromises when methods fundamentally disagree (clusterFour). On every cluster, some methods' votes are actively harmful --- dragging in genes that don't match because the metric was fooled by normalization artifacts, magnitude bias, or zero-value saturation.

Which raises the real question. If we know some methods are wrong on some clusters, can we detect that automatically and silence them before they vote? That's [where things got interesting](../when-correlation-lies-gene-expression-pattern-matching).

## What This Reveals About Similarity

There's a broader point buried in these results. Six metrics, all measuring "similarity," all returning confident answers, and on some clusters they don't share a single gene. The metrics aren't broken. They're just answering different questions.

Pearson asks about *shape*. MSE asks about *distance in normalized space*. DTW asks about *temporal alignment*. Cosine asks about *vector angle without centering*. sMAPE asks about *proportional deviation*. Frechet asks about *worst-case fit*. When those questions have the same answer, the methods agree. When the data geometry drives them apart --- a delta function, a zero crossing, a flat-with-noise pattern --- each metric follows its own definition of "similar" to a completely different set of genes.

The choice of similarity metric isn't a technical detail. It's a statement about what kind of match matters. And when that statement doesn't line up with the biological question, every ranking downstream inherits the mismatch.

---

*This is the second post about the NMF chemo-immunotherapy project. Previously: [NMF on Immune Cells: What Chemo-Immunotherapy Does to Your T-Cell Army](../nmf-chemoimmuno-analysis). Next: [When Correlation Lies: Finding Genes That Actually Match the Pattern](../when-correlation-lies-gene-expression-pattern-matching).*
