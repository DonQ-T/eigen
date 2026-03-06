---
title: "TR-NMF: Temporally-Regularized Non-Negative Matrix Factorization"
date: 2026-03-05
author: "Matt Jacob"
description: "A research roadmap for developing a novel NMF variant that exploits temporal ordering in longitudinal data — objectives, reading list, and key gaps in the literature."
tags: ["NMF", "optimization", "research", "linear algebra"]
draft: false
---

**Goal**: Develop an NMF variant that exploits temporal ordering in the columns of $V$ to improve factorization quality for longitudinal data. Derive update rules, prove convergence, and benchmark against [Lee & Seung (2001)](https://papers.nips.cc/paper/1861-algorithms-for-non-negative-matrix-factorization) and existing NMF solvers.

---

## Objective 1: Understand Standard NMF

Learn the baseline algorithm and its convergence theory well enough to extend it.

**Core reading**:

1. [**Lee & Seung (1999)**](https://www.cs.columbia.edu/~blei/fogm/2020F/readings/LeeSeung1999.pdf) — *Learning the parts of objects by non-negative matrix factorization*, Nature. The paper that started it all. Short (3 pages). Why non-negativity forces parts-based decomposition.

2. [**Lee & Seung (2001)**](https://papers.nips.cc/paper/1861-algorithms-for-non-negative-matrix-factorization) — *Algorithms for Non-negative Matrix Factorization*, NeurIPS. **The most important paper in the reading list.** Multiplicative update rules, the auxiliary function convergence proof, and the diagonal rescaling interpretation. Work through every line of the proof — the auxiliary function technique is exactly what gets extended for regularized variants.

3. [**Supplementary proof guide (2025)**](https://arxiv.org/abs/2501.11341) — fills in gaps in Lee & Seung's original proof.

**Known limitations**:

- [**Lin (2007)**](https://www.csie.ntu.edu.tw/~cjlin/papers/multconv.pdf) — Lee & Seung's proof shows the objective decreases monotonically, but NOT that it converges to a stationary point (the iterates could cycle). Proposes projected gradient as a fix.

- [**Koulakis et al. (2020)**](https://arxiv.org/abs/2002.11323) — a modified MU that provably avoids saddle points and converges to second-order stationary points. State of the art for NMF convergence theory.

---

## Objective 2: Learn the Optimization Foundations

**Constrained optimization**:
- [Boyd & Vandenberghe, *Convex Optimization* (2004)](https://web.stanford.edu/~boyd/cvxbook/) — Ch. 4 (constrained problems), Ch. 9 (unconstrained minimization), Ch. 11 (interior point)
- [Tibshirani, *Proximal Gradient Descent and Acceleration*](https://www.stat.cmu.edu/~ryantibs/convexopt/lectures/prox-grad.pdf) — covers FISTA, $O(1/k^2)$ convergence vs $O(1/k)$ for vanilla proximal gradient

**Matrix calculus**:
- [The Matrix Cookbook (Petersen & Pedersen, 2012)](https://www.math.uwaterloo.ca/~hwolkowi/matrixcookbook.pdf) — derivatives of traces, Frobenius norm, Hadamard product identities

**Majorization-minimization**:
- [Hunter & Lange, *A Tutorial on MM Algorithms* (2004)](https://doi.org/10.1198/0003130042836) — the general framework behind Lee & Seung's proof (same idea as EM's Q-function). Clear, stats-friendly introduction.

---

## Objective 3: Survey Regularized NMF Variants

Understand what's been done so the contribution is clearly novel.

**Sparse NMF**:
- [**Hoyer (2004)**](https://www.jmlr.org/papers/volume5/hoyer04a/hoyer04a.pdf) — L1/L2 sparseness constraints on $W$ and/or $H$. Uses projected gradient descent instead of multiplicative updates.

**Graph-regularized NMF**:
- [**Cai et al. (2011)**](https://doi.org/10.1109/TPAMI.2010.231) — adds $\lambda \cdot \text{tr}(H L H^T)$ where $L$ is a graph Laplacian. **The direct template for the temporal variant** — the temporal penalty is the special case where the graph is a chain (path graph over ordered columns).

**General regularized MU**:
- [**Iterative Algorithm for Regularized NMF (2024)**](https://arxiv.org/abs/2410.22698) — generalizes MU to handle weighted norms, ridge, and Lasso. Recent, clean notation.

---

## Objective 4: Identify the Gap — Temporal Regularization

Two existing approaches, both with clear limitations:

- [**TRMF — Yu, Rao & Dhillon (2016)**](https://arxiv.org/abs/1509.08333) — temporal regularization for matrix factorization, but allows negative values. Designed for forecasting in high-dimensional time series. Uses autoregressive regularization, not smoothness.

- [**Chiovetto et al. (2016)**](https://pmc.ncbi.nlm.nih.gov/articles/PMC5593271/) — NMF with temporally constrained coefficients. Closest prior work, but uses a hard averaging constraint (each coefficient must equal the average of its neighbors). Not tunable, no convergence proof.

**The gap**: No one has done temporally-regularized *non-negative* MF with a tunable smoothness penalty and provable convergence. TRMF isn't non-negative. Chiovetto isn't tunable or proven. Graph-regularized NMF uses arbitrary graphs, not the temporal chain specifically.

---

## Objective 5: Formulate TR-NMF

The proposed objective function:

$$\min_{W,H \geq 0} \frac{1}{2}\lVert V - WH \rVert_F^2 + \frac{\lambda}{2} \lVert H D^T \rVert_F^2$$

where $D$ is the $(p-1) \times p$ first-difference matrix. The penalty expands as:

$$\lVert H D^T \rVert_F^2 = \sum_i \sum_{j=1}^{p-1}(H_{i,j+1} - H_{i,j})^2$$

This penalizes jagged temporal patterns in $H$. $\lambda = 0$ recovers standard NMF. $\lambda \to \infty$ forces perfectly flat $H$ rows. The matrix $D^T D$ is the discrete Laplacian on a path graph — the temporal chain specialization of Cai et al.'s general graph Laplacian.

**Key tasks**:
- Derive modified multiplicative update rules (split $\Phi = D^T D$ into positive and negative parts, following Cai et al.'s pattern)
- Prove convergence via auxiliary function construction
- Characterize the regularization path as $\lambda$ varies
- Develop cross-validation strategy for $\lambda$ selection

---

## Objective 6: Benchmark and Write

**Benchmark against**:

| Method | Loss | Optimizer |
|--------|------|-----------|
| Lee & Seung MU | Frobenius | Multiplicative updates |
| HALS | Frobenius | Hierarchical ALS |
| **TR-NMF** | **Frobenius + temporal** | **Modified MU** |
| Projected gradient | Frobenius | Projected gradient descent |

**Metrics**: reconstruction error, factor recovery accuracy (on synthetic data with known ground truth), stability across random starts ([cophenetic correlation](https://doi.org/10.1073/pnas.0308531101)), convergence speed.

**Target venues**: NeurIPS / ICML, SIAM Journal on Matrix Analysis, Annals of Applied Statistics, JMLR.

---

## Reading Order

| Order | Paper | Objective | Time |
|-------|-------|-----------|------|
| 1 | [Lee & Seung (1999)](https://www.cs.columbia.edu/~blei/fogm/2020F/readings/LeeSeung1999.pdf) | Intuition for NMF | 1 hour |
| 2 | [Lee & Seung (2001)](https://papers.nips.cc/paper/1861-algorithms-for-non-negative-matrix-factorization) | Update rules + convergence proof | 1 day |
| 3 | [Supplementary proof guide (2025)](https://arxiv.org/abs/2501.11341) | Fill proof gaps | 2 hours |
| 4 | [Hunter & Lange (2004)](https://doi.org/10.1198/0003130042836) | General MM framework | 3 hours |
| 5 | [Boyd & Vandenberghe Ch. 9](https://web.stanford.edu/~boyd/cvxbook/) | Optimization foundations | 1 day |
| 6 | [Tibshirani proximal gradient](https://www.stat.cmu.edu/~ryantibs/convexopt/lectures/prox-grad.pdf) | Proximal methods, FISTA | 3 hours |
| 7 | [Lin (2007)](https://www.csie.ntu.edu.tw/~cjlin/papers/multconv.pdf) | Known gaps in convergence | 3 hours |
| 8 | [Cai et al. (2011)](https://doi.org/10.1109/TPAMI.2010.231) | **Template for the proof** | 1 day |
| 9 | [Hoyer (2004)](https://www.jmlr.org/papers/volume5/hoyer04a/hoyer04a.pdf) | Alternative: projected gradient | 3 hours |
| 10 | [TRMF (Yu et al. 2016)](https://arxiv.org/abs/1509.08333) | Temporal MF (not NMF) | 3 hours |
| 11 | [Chiovetto et al. (2016)](https://pmc.ncbi.nlm.nih.gov/articles/PMC5593271/) | Temporal NMF (hard constraint) | 2 hours |
| 12 | [Koulakis et al. (2020)](https://arxiv.org/abs/2002.11323) | Second-order convergence | 1 day |

---

## Additional References

| Resource | Description |
|----------|-------------|
| [Matrix Cookbook](https://www.math.uwaterloo.ca/~hwolkowi/matrixcookbook.pdf) | Matrix calculus reference |
| [Regularized NMF (2024)](https://arxiv.org/abs/2410.22698) | General recipe for regularized MU |
| [mSOM 2nd-order NMF (2023)](https://arxiv.org/abs/2303.17992) | Second-order majorant algorithm |
| [NNDSVD initialization survey](https://arxiv.org/pdf/2109.03874) | Initialization strategies |
| [Boutsidis & Gallopoulos (2008)](https://doi.org/10.1016/j.patcog.2007.09.010) | NNDSVD original paper |
| [Brunet et al. (2004)](https://doi.org/10.1073/pnas.0308531101) | Cophenetic correlation for rank selection |
| [spOT-NMF (2025)](https://www.biorxiv.org/content/10.1101/2025.08.02.668292v1) | Optimal transport NMF |
