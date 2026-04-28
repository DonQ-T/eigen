---
title: "When the Wrong Method Picks the Right Genes"
date: 2026-04-30
author: "Matt Jacob"
description: "Shape won the argument over magnitude. The strange part: the method that wins on shape for three of four clusters is the one that doesn't measure shape at all. One question per cluster decides which method to trust --- and the cluster where the question fails turns out to be the only one that needs a different metric."
tags: ["NMF", "bioinformatics", "gene-expression", "similarity-metrics"]
draft: false
---

The professor's verdict came back: **shape over magnitude**. Co-regulation is the biological story; absolute expression level is incidental. So the right move, in principle, is to use a metric whose math actually targets shape. Pearson correlation. Done.

Except.

The previous post left things in an awkward state. Of the four clusters, three were best-fit by raw MAE --- a *magnitude* metric. Only clusterOne pushed toward the shape methods, and even there, no single approach was clean. If shape is what we care about, why does a magnitude metric keep winning?

This week's job was to resolve that paradox. The resolution turned out to be a single question, asked once per cluster, that decides which method to use. The question is so small it almost disappears, but it ends up being the whole framework.

## The Verdict, and the Twist

Shape won the philosophical argument. NMF clusters represent co-regulated gene programs --- genes sharing an upstream regulator. Two genes downstream of the same transcription factor can express at very different absolute levels because of different promoter strengths or copy numbers. They still belong in the same cluster. So similarity, as far as the biology cares, is about *when* genes rise and fall, not *how much*.

That should make Pearson correlation the obvious choice. Pearson is the only one of the six original metrics whose math explicitly targets shape: it mean-centers and variance-normalizes both vectors before computing the dot product. Its scale invariance is the entire point.

But here's the twist. On three of the four clusters, raw MAE's top-20 picks happen to be **better shape-matches** than Pearson's. Not because raw MAE is somehow secretly a shape metric --- it isn't --- but because, on those three clusters, the genes that match the pattern's *amplitude* also happen to match its *shape*. Magnitude-correct picks turn out to be incidentally shape-correct too. So a magnitude metric, run on a cluster where shape and magnitude align in the gene population, ends up beating an explicit shape metric on shape itself.

The question becomes: how do you tell which clusters have that alignment, and which don't?

## A One-Question Test

The test is just this: **does raw MAE's top-20 also score high on shape?** Operationally, compute Pearson correlation between each of raw MAE's top-20 genes and the constraint pattern, and ask what fraction have $r > 0.9$.

That's it. One number per cluster.

- If the fraction is high, raw MAE has accidentally won shape too. The "free shape" trick is real on this cluster. Use raw MAE --- it gives you both axes for the price of one.
- If the fraction is low, raw MAE has only won magnitude. Magnitude isn't what we care about, so fall back to a method whose math directly targets shape. That's Pearson.

Run the test on the four clusters, and the answer comes out cleanly:

| Cluster | rawMAE top-20 shape score | Pick |
|---|---|---|
| clusterOne   | 0.35 | Pearson |
| clusterTwo   | 1.00 | rawMAE |
| clusterThree | 1.00 | rawMAE |
| clusterFour  | 1.00 | rawMAE |

ClusterOne is the lone holdout. Only 7 of raw MAE's top-20 picks for clusterOne have $r > 0.9$ against the pattern. The "free shape" accident doesn't happen there. So Pearson takes over for that cluster. For the other three, raw MAE wins on both axes.

This is the entire framework. One question, one number, four answers.

## ClusterOne, and Why Pearson Specifically

ClusterOne is the cluster where the genes at the pattern's magnitude don't follow the pattern's shape, and the genes that follow the shape don't sit at the right magnitude. The shape-magnitude alignment that makes raw MAE accidentally work elsewhere isn't there. Raw MAE's top-20 for clusterOne are at the right level but largely flat where the pattern spikes.

Among the methods that *do* target shape, the natural question is whether Pearson is the best choice or whether some other normalized method (Fréchet, MSE, sMAPE, cosine, DTW) might do better.

Two reasons to use Pearson specifically.

The first is mathematical. Of the six original metrics, **only Pearson explicitly defines shape correlation in its math**. The others are distance or angle metrics that happen to behave shape-like when run on min-max normalized data. Strip the upstream normalization step and they all become magnitude metrics again. Pearson stays Pearson regardless --- its scale invariance is in the formula itself, not in a preprocessing step.

The second is empirical. On clusterOne, look at top-20 overlap between Pearson and each alternative:

- Fréchet: 18/20
- MSE: 17/20
- DTW: 13/20
- sMAPE: 4/20
- Cosine: 0/20

Pearson, Fréchet, and MSE form a tight consensus on clusterOne --- different math, mostly the same gene picks. Pearson is the principled member of that consensus, the one whose mathematical objective actually targets the property we care about. The others are reaching the same answer for slightly suspicious reasons.

There's a clean way to *see* this. The trick is to translate every gene additively so its mean equals the pattern's mean --- a "mean-shift" --- and then plot the result. After mean-shifting, any pure offset between gene and pattern disappears, and what's left is the actual shape disagreement.

<img src="/eigen/images/pattern-matching/clusterOne_pearson_vs_each_meanshift.png" alt="ClusterOne Pearson top-20 compared to each alternative shape method, mean-shifted to remove offset" style="max-width: 100%;">

*ClusterOne. Each panel pairs Pearson's top-20 against another method's top-20, all mean-shifted to remove offset and force a pure-shape comparison. Pearson, Fréchet, and MSE trace the same up-down-up shape. sMAPE and cosine pick fundamentally different curves.*

The mean-shift is also what convinces me that raw MAE's clusterOne picks are genuinely the wrong choice, not just an offset issue. If raw MAE were finding shape-correct genes that happened to be slightly translated, mean-shifting them would line them up with the pattern. It doesn't. They stay flat.

<img src="/eigen/images/pattern-matching/clusterOne_shape_methods_meanshift.png" alt="Mean-shifted top-20 for six shape methods on clusterOne, with overlap counts" style="max-width: 100%;">

*Six methods' top-20 picks for clusterOne, all mean-shifted. Pearson and its near-neighbors (Fréchet, MSE) trace the up-down-up shape. The disagreement isn't about offset --- it's about which genes are actually shape-correct.*

So clusterOne uses Pearson, on principle and in agreement with its mathematical neighbors.

## DTW's Quiet Failure on n=4

A note worth making, since it surfaced as a footnote and deserves to be stated outright. On clusterFour, DTW picked top-20 genes whose median Pearson correlation against the constraint pattern was $r_{\text{med}} = -0.33$. **Anti-correlated.** DTW thought it was finding similar genes, and it was, in fact, returning genes that move in the opposite direction.

This is a known failure mode of dynamic time warping, and it shows up most clearly when the number of timepoints is small. DTW finds an alignment between the two sequences that minimizes pointwise distance after warping. With only four timepoints and a sharp spike at $t = 3$, the warping has very few constraints --- it can fold the trajectory backwards and pair the rising edge of one curve with the falling edge of another, then call them similar.

More timepoints would help. With $n = 4$, DTW just isn't doing what its name suggests.

The takeaway is narrow but important: **don't use DTW on n=4 spike patterns**. The other clusters are tame enough that DTW happens to behave; clusterFour is the case where the warping freedom hurts more than it helps.

## The Per-Cluster Picks

The four winners, by cluster:

**clusterTwo --- raw MAE.** Pattern is $0.37 \to 0.80 \to 1.22 \to 1.78$, a steady rise. ClusterTwo has the rarest shape class in the dataset (0.9% of genes follow $(+, +, +)$), so shape is genuinely selective. Raw MAE's top-20 are tight around the pattern in both axes.

<img src="/eigen/images/pattern-matching/gallery_clusterTwo_zoomed.png" alt="ClusterTwo: raw MAE winner alongside runner-up methods, zoomed view" style="max-width: 100%;">

*ClusterTwo. Raw MAE (winner) versus runners-up. The raw MAE picks hug both shape and magnitude tightly.*

**clusterThree --- raw MAE.** The V-shape: $0.041 \to 0 \to 0.037 \to 0.035$, with $t = 3$ near zero. Tiny pattern, tiny range. Normalized methods' shape-correct picks live at LT levels of 0.5–1.0 --- five times the pattern's range. Raw MAE finds genes that actually sit on the V.

<img src="/eigen/images/pattern-matching/gallery_clusterThree_zoomed.png" alt="ClusterThree: raw MAE winner alongside runner-up methods, zoomed view" style="max-width: 100%;">

*ClusterThree. The V-shape pattern is tiny in absolute magnitude. Raw MAE's picks sit on the V; normalized methods land at five times the pattern's range.*

**clusterFour --- raw MAE.** Pattern is $0.009 \to 0.638 \to 0.018 \to 0.024$, the sharp spike. The cluster where last week's gating failed silently. Raw MAE captures genes that actually spike at $t = 3$ alongside the pattern. DTW gets retired here, per the note above.

<img src="/eigen/images/pattern-matching/gallery_clusterFour_zoomed.png" alt="ClusterFour: raw MAE winner alongside runner-up methods, including DTW's anti-correlation failure" style="max-width: 100%;">

*ClusterFour. Raw MAE captures the spike; DTW's panel is the visible anti-correlation failure on n=4 --- genes pointing the wrong direction.*

**clusterOne --- Pearson.** The paradox cluster. Pearson, by mathematical principle and in consensus with Fréchet and MSE.

A different way to see all of this is to plot every method's top-20 in a (shape, magnitude) plane. For each method, the median Pearson correlation against the pattern is one axis; the median LT distance is the other. Methods up and to the left are good on both; methods elsewhere are trading one off for the other.

<img src="/eigen/images/pattern-matching/dual_scatter_clusterFour.png" alt="ClusterFour scatter: each method's top-20 plotted on a shape-vs-magnitude plane" style="max-width: 100%;">

*ClusterFour. Each method's top-20 occupies a region of the (shape, magnitude) plane. Raw MAE is alone in the upper-left corner --- shape-correct AND magnitude-correct. DTW is in the wrong half of the shape axis.*

## Deliverables

Four CSVs, one per cluster, each containing the full ranking of all 17,856 genes under that cluster's chosen method. ClusterOne ranked by Pearson, the other three by raw MAE. A combined file stacks all four into a single 71,424-row deliverable, ready for downstream pathway / GO enrichment analysis.

That part --- pathway enrichment --- is the next biological question. Do the four top-20 lists each hit a coherent pathway? Is the clusterOne signature actually a known TCR co-regulated module? Those questions don't change the method selection; they validate it.

## The Deeper Lesson

There's a temptation, when "use the right tool for the job" is the rule, to interpret it as "the tool whose math matches the question wins." That's the version of the lesson that got me to "use Pearson everywhere" before this week's analysis. Shape is the question, Pearson is the shape metric, end of story.

What this week showed is that a tool earns its place by what its picks look like, not by what its math claims to measure. A magnitude metric, on a cluster where the gene population happens to align magnitude with shape, can produce shape-correct picks that an explicit shape metric can't match. The fact that it does so for the wrong-sounding reason isn't disqualifying. It's just a feature of the data.

The framework I ended up with isn't "pick the metric whose math fits the question." It's "ask whether each metric's picks satisfy the question, and use the one that does." The rawMAE-shape-test is just that question, formalized as a single number per cluster. It's small. It's almost embarrassing in how small it is. But it correctly identifies clusterOne as the case where the principled fallback is needed, and it lets the other three clusters keep the metric whose picks are actually best, regardless of pedigree.

Sometimes the right tool is the one that, by accident of how the data is shaped, ends up doing the job you didn't quite hire it for. The trick is having a test small enough to notice when that's happening.

---

*This is the fifth post about the NMF chemo-immunotherapy project. Previously: [The Fork in the Road: Shape or Magnitude?](../fork-in-the-road-shape-or-magnitude).*
