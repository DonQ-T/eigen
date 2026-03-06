---
title: "TR-NMF: Temporally-Regularized Non-Negative Matrix Factorization"
date: 2026-03-05
author: "Matt Jacob"
description: "A research plan for developing a novel NMF variant that exploits temporal ordering in longitudinal biological data — with derived update rules, convergence proof strategy, and a full reading roadmap."
tags: ["NMF", "optimization", "research", "linear algebra", "bioinformatics"]
draft: false
---

**Goal**: Develop an NMF variant that exploits temporal ordering in the columns of $V$ to improve factorization quality for longitudinal biological data. Derive update rules, prove convergence, and benchmark against [Lee & Seung (2001)](https://papers.nips.cc/paper/1861-algorithms-for-non-negative-matrix-factorization) and [MEGPath](https://doi.org/10.1145/3233547.3233579) on chemo-immunotherapy matrices from the [NMF analysis project](/eigen/blog/nmf-chemoimmuno-analysis/).

**Thesis in one sentence**: When the columns of $V$ have a known ordering (timepoints), penalizing non-smooth temporal patterns in $H$ yields lower reconstruction error and more interpretable factors than standard NMF, with provable convergence guarantees.

---

## Phase 0: Mathematical Foundations

### Optimization on constrained sets

Prerequisites: gradient descent, projected gradient descent, proximal operators and proximal gradient methods, Lagrange multipliers and KKT conditions, convergence of iterative algorithms (to stationary point vs global optimum), rates ($O(1/k)$ vs $O(1/k^2)$).

**Read**:
- [Boyd & Vandenberghe, *Convex Optimization* (2004)](https://web.stanford.edu/~boyd/cvxbook/) — Ch. 4 (equality/inequality constrained), Ch. 9 (unconstrained minimization), Ch. 11 (interior point)
- [Tibshirani, *Proximal Gradient Descent and Acceleration*](https://www.stat.cmu.edu/~ryantibs/convexopt/lectures/prox-grad.pdf) — covers FISTA, which achieves $O(1/k^2)$ convergence vs $O(1/k)$ for vanilla proximal gradient

### Matrix calculus

Derivatives of matrix expressions come up constantly.

- [The Matrix Cookbook (Petersen & Pedersen, 2012)](https://www.math.uwaterloo.ca/~hwolkowi/matrixcookbook.pdf) — derivatives of traces, Frobenius norm, Hadamard product identities

### Auxiliary functions and majorization-minimization

[Lee & Seung's](https://papers.nips.cc/paper/1861-algorithms-for-non-negative-matrix-factorization) convergence proof uses auxiliary functions — the same idea as EM's Q-function. The general framework is Majorization-Minimization (MM): construct a function $G(\theta \mid \theta_{\text{old}})$ that upper-bounds $f(\theta)$ and touches it at $\theta_{\text{old}}$, minimize $G$ instead of $f$, prove $f$ decreases monotonically at each step.

- [Hunter & Lange, *A Tutorial on MM Algorithms* (2004)](https://doi.org/10.1198/0003130042836) — clear, stats-friendly introduction with many examples

---

## Phase 1: Standard NMF — The Baseline

### The original papers

Read in this order:

1. [**Lee & Seung (1999)**](https://doi.org/10.1038/44565) — *Learning the parts of objects by non-negative matrix factorization*, Nature. The paper that started it all. Short (3 pages). Read for intuition: why non-negativity forces parts-based decomposition.

2. [**Lee & Seung (2001)**](https://papers.nips.cc/paper/1861-algorithms-for-non-negative-matrix-factorization) — *Algorithms for Non-negative Matrix Factorization*, NeurIPS. **The most important paper in the reading list.** Contains: multiplicative update rules for Frobenius and KL-divergence, the auxiliary function convergence proof, and the diagonal rescaling interpretation (MU = gradient descent with optimally chosen diagonal preconditioner). Work through every line of the proof — the auxiliary function technique is exactly what gets extended for the regularized version.

3. [**Supplementary proof guide (2025)**](https://arxiv.org/abs/2501.11341) — fills in gaps in Lee & Seung's original proof. Very helpful when working through the auxiliary function construction.

### The standard update rules

**Problem**: $\min_{W,H \geq 0} F(W,H) = \frac{1}{2}\|V - WH\|_F^2$

Taking derivatives:

$$\nabla_H F = -W^T V + W^T W H$$

$$\nabla_W F = -V H^T + W H H^T$$

Lee & Seung's multiplicative updates:

$$H \leftarrow H \odot \frac{W^T V}{W^T W H}$$

$$W \leftarrow W \odot \frac{V H^T}{W H H^T}$$

where $\odot$ is element-wise multiplication and division is element-wise.

**Exercises**: Verify on paper that (1) if $H_{ij} > 0$ initially, it stays positive; (2) at a fixed point, $\nabla_H F = 0$; (3) this is equivalent to gradient descent with step size $\eta_{ij} = H_{ij} / (W^T W H)\_{ij}$ — an element-wise adaptive learning rate.

### The convergence proof

Lee & Seung construct an auxiliary function $G(h, h^t)$ such that $G(h, h^t) \geq F(h)$ for all $h$ (upper bound) and $G(h^t, h^t) = F(h^t)$ (tight at current point). Then $h^{t+1} = \arg\min_h G(h, h^t)$ guarantees $F(h^{t+1}) \leq F(h^t)$.

The specific auxiliary function uses a diagonal matrix to separate the positive and negative parts of $W^T W$:

$$G(h, h^t) = F(h^t) + (h - h^t)^T \nabla F(h^t) + \frac{1}{2}(h - h^t)^T K(h^t)(h - h^t)$$

where $K(h^t) = \text{diag}((W^T W H)_i / h^t_i)$.

### Known limitations

- [**Lin (2007)**](https://www.csie.ntu.edu.tw/~cjlin/papers/multconv.pdf) — shows Lee & Seung's proof has a gap: it proves the objective decreases monotonically, but NOT that it converges to a stationary point (the iterates could cycle). Proposes projected gradient as a fix. Important context — a stronger proof should address this gap.

- [**Koulakis et al. (2020)**](https://arxiv.org/abs/2002.11323) — shows a modified MU that provably avoids saddle points and converges to second-order stationary points. State of the art for NMF convergence theory.

---

## Phase 2: Regularized NMF — Existing Approaches

### Sparse NMF

- [**Hoyer (2004)**](https://www.jmlr.org/papers/volume5/hoyer04a/hoyer04a.pdf) — adds L1/L2 sparseness constraints on $W$ and/or $H$. Uses projected gradient descent (not multiplicative updates). Key insight: the projection operator onto the intersection of non-negative, fixed L1 norm, and fixed L2 norm is tractable.

### Graph-regularized NMF

- [**Cai et al. (2011)**](https://doi.org/10.1109/TPAMI.2010.231) — adds $\lambda \cdot \text{tr}(H L H^T)$ where $L$ is a graph Laplacian encoding sample similarity. Derives multiplicative updates with the regularizer. **Study how they modify the update rule** — the temporal penalty follows the same pattern, with the graph being specifically the temporal chain.

### Regularized NMF with multiplicative updates (general recipe)

- [**Iterative Algorithm for Regularized NMF (2024)**](https://arxiv.org/abs/2410.22698) — generalizes MU to handle weighted norms, ridge, and Lasso regularization. Recent paper, clean notation.

### Temporal regularization (not NMF-specific)

- [**TRMF — Yu, Rao & Dhillon (2016)**](https://arxiv.org/abs/1509.08333) — the closest existing work. BUT: allows negative values (it's MF, not NMF), designed for forecasting (large $p$), uses autoregressive temporal regularization. Their penalty regularizes the latent temporal factors with an AR model. Ours is simpler (smoothness) but enforces non-negativity, which they don't.

- [**Chiovetto et al. (2016)**](https://pmc.ncbi.nlm.nih.gov/articles/PMC5593271/) — closest NMF-specific temporal work. Adds a hard constraint: each coefficient must equal the average of its neighbors. Not a tunable penalty — it's a hard averaging rule baked into the update. **The contribution**: replace the hard constraint with a soft, $\lambda$-controlled penalty, derive proper updates, prove convergence.

---

## Phase 3: The Contribution — TR-NMF

### The formulation

$$\min_{W,H \geq 0} \underbrace{\frac{1}{2}\|V - WH\|_F^2}\_{\text{reconstruction}} + \underbrace{\frac{\lambda}{2} \|H D^T\|_F^2}\_{\text{temporal smoothness}}$$

where $D$ is the $(p-1) \times p$ first-difference matrix:

$$D = \begin{pmatrix} -1 & 1 & 0 & 0 \\\ 0 & -1 & 1 & 0 \\\ 0 & 0 & -1 & 1 \end{pmatrix}$$

For a 4-column matrix, $D$ is $3 \times 4$.

The penalty $\|HD^T\|_F^2 = \text{tr}(H D^T D H^T) = \sum_i \sum_{j=1}^{p-1}(H_{i,j+1} - H_{i,j})^2$ penalizes consecutive-column differences in each row of $H$. Large $\lambda$ forces smoother temporal patterns. $\lambda = 0$ recovers standard NMF.

**Why this penalty**:
- Convex in $H$ (quadratic), so combining it with the Frobenius reconstruction term gives a well-behaved sub-problem
- $D^T D$ is a known matrix (tridiagonal, positive semi-definite) — the discrete Laplacian on a path graph. This connects to graph regularization literature ([Cai et al. 2011](https://doi.org/10.1109/TPAMI.2010.231)), where the graph is specifically the temporal chain
- The penalty is on $H$ (temporal patterns), not $W$ (loadings). Temporal programs should be smooth, but clonotype memberships have no reason to be

### Derive the gradient

Let $\Phi = D^T D$ (the $p \times p$ temporal Laplacian). For $p = 4$:

$$\Phi = D^T D = \begin{pmatrix} 1 & -1 & 0 & 0 \\\ -1 & 2 & -1 & 0 \\\ 0 & -1 & 2 & -1 \\\ 0 & 0 & -1 & 1 \end{pmatrix}$$

Gradient with respect to $H$:

$$\nabla_H F = -W^T V + W^T W H + \lambda H \Phi$$

Gradient with respect to $W$ (unchanged — penalty doesn't involve $W$):

$$\nabla_W F = -V H^T + W H H^T$$

### Derive the multiplicative updates

**This is the core technical contribution.** Follow the Lee & Seung / Cai et al. pattern: split the gradient into positive and negative parts.

The challenge: $\Phi$ has both positive and negative entries. Decompose $\Phi = \Phi^+ - \Phi^-$ where $\Phi^+_{ij} = \max(\Phi_{ij}, 0)$ and $\Phi^-_{ij} = \max(-\Phi_{ij}, 0)$.

For our $\Phi$:

$$\Phi^+ = \begin{pmatrix} 1&0&0&0 \\\ 0&2&0&0 \\\ 0&0&2&0 \\\ 0&0&0&1 \end{pmatrix}, \quad \Phi^- = \begin{pmatrix} 0&1&0&0 \\\ 1&0&1&0 \\\ 0&1&0&1 \\\ 0&0&1&0 \end{pmatrix}$$

Then $\nabla_H F = \underbrace{(W^T W H + \lambda H \Phi^+)}\_{\text{positive part}} - \underbrace{(W^T V + \lambda H \Phi^-)}\_{\text{negative part}}$

The multiplicative updates:

$$\boxed{H \leftarrow H \odot \frac{W^T V + \lambda H \Phi^-}{W^T W H + \lambda H \Phi^+}}$$

$$\boxed{W \leftarrow W \odot \frac{V H^T}{W H H^T}}$$

**Exercises**: Verify that (1) at a fixed point, the numerator equals the denominator so $\nabla F = 0$; (2) $H$ stays non-negative if initialized non-negative; (3) when $\lambda = 0$, this reduces to standard Lee & Seung.

### Prove convergence

**Strategy**: Construct an auxiliary function for the regularized objective, following Lee & Seung (2001) and [Cai et al. (2011)](https://doi.org/10.1109/TPAMI.2010.231).

Need to show: there exists $G(H, H^t)$ such that (1) $G(H, H^t) \geq F(H)$ for all $H \geq 0$, (2) $G(H^t, H^t) = F(H^t)$, and (3) $H^{t+1} = \arg\min_H G(H, H^t)$ gives the multiplicative update above.

The key technical step: bounding the $\lambda H \Phi$ term using the diagonal construction. Since $\Phi^+$ is diagonal, the bound

$$h^T \Phi h \leq h^T \text{diag}\left(\frac{(\Phi^+ h^t)_i}{h^t_i}\right) h$$

may work, but needs careful verification. **This is where the actual mathematical work lives.** Study Cai et al. (2011) Theorem 1 proof closely — they do exactly this for graph Laplacian $L$, which has the same positive/negative structure.

**Stretch goal**: Go beyond monotone decrease. Use the framework from [Koulakis et al. (2020)](https://arxiv.org/abs/2002.11323) to show convergence to a second-order stationary point, or use [Lin (2007)](https://www.csie.ntu.edu.tw/~cjlin/papers/multconv.pdf)'s projected gradient framework to show convergence to a first-order stationary point.

### Characterize the regularization path

As $\lambda$ increases from 0 to $\infty$:
- $\lambda = 0$: standard NMF
- $\lambda \to \infty$: $H$ rows become constant (perfectly flat) — no temporal variation, similar to the scRNA null result
- Intermediate $\lambda$: the interesting regime

**Experiments**:
1. Sweep $\lambda \in \{0, 0.01, 0.1, 1, 10, 100\}$ on the TCR bio-filtered matrix (416 $\times$ 4)
2. Plot reconstruction error vs $\lambda$ (expect U-shaped)
3. Plot Factor 3 week-6 peak height vs $\lambda$ — does moderate smoothing sharpen or blur the peak?
4. Compare factor stability ([cophenetic correlation](https://doi.org/10.1073/pnas.0308531101) across random starts) at each $\lambda$ — the hypothesis is that temporal regularization reduces sensitivity to initialization

### Cross-validation for $\lambda$ selection

Hold out one column (= one timepoint), fit on the rest, measure prediction error on held-out entries. The $\lambda$ that minimizes held-out error is optimal. For the 4-column case, leave-one-column-out CV is natural: fit on 3 timepoints, predict the 4th. Run for each held-out column and average.

---

## Phase 4: Implementation & Benchmarking

### Reference implementation

Start in R. The core algorithm is ~50 lines:

```r
tr_nmf <- function(V, k, lambda, max_iter = 1000, tol = 1e-6) {
  # Initialize W, H (NNDSVD or random)
  # Build D, Phi = D^T D, split into Phi_pos and Phi_neg
  # Loop:
  #   H <- H * (t(W) %*% V + lambda * H %*% Phi_neg) /
  #            (t(W) %*% W %*% H + lambda * H %*% Phi_pos + epsilon)
  #   W <- W * (V %*% t(H)) / (W %*% H %*% t(H) + epsilon)
  #   Check convergence
  # Return W, H, error history
}
```

### Benchmark design

| Method | Loss | Optimizer | Source |
|--------|------|-----------|--------|
| Lee & Seung MU | Frobenius | Multiplicative updates | R NMF package |
| MEGPath | LAD | Simulated annealing | Existing C++ binary |
| **TR-NMF** | **Frobenius + temporal** | **Modified MU** | **New R code** |
| Projected gradient | Frobenius | Projected gradient descent | New R code |
| TR-NMF + NNDSVD | Frobenius + temporal | Modified MU, NNDSVD init | New R code |

Test matrices (all already exported):
- TCR bio-filtered: 416 $\times$ 4
- TCR baseline: 2,541 $\times$ 4
- scRNA improved: 2,000 $\times$ 4
- (Future) Cluster-level pseudobulk: 2,000 $\times$ 52

Metrics: reconstruction error (NMAE, LAD), factor interpretability (does Factor 3 peak at week 6?), stability across random starts (cophenetic correlation), convergence speed (iterations to tolerance).

---

## Phase 5: Paper & Target Venues

### Structure

1. **Introduction**: Longitudinal biological data has ordered columns; standard NMF ignores this structure
2. **Related work**: Lee & Seung, TRMF (allows negatives), Chiovetto (hard constraint), graph-regularized NMF (arbitrary graph, not temporal chain)
3. **Method**: Formulation, update rules, convergence proof
4. **Experiments**: Benchmarks on chemo-immunotherapy data + simulated data
5. **Discussion**: When does temporal regularization help? When doesn't it?

### Target venues

- **Bioinformatics** (Oxford) — framed as a tool for longitudinal scRNA-seq
- **NeurIPS / ICML** — framed as an algorithmic contribution with theory
- **SIAM Journal on Matrix Analysis** — if the convergence proof is the main result
- **Annals of Applied Statistics** — framed as methodology for biological applications

---

## Reading Order

| Order | Paper | Why | Time |
|-------|-------|-----|------|
| 1 | [Lee & Seung (1999)](https://doi.org/10.1038/44565) | Intuition for NMF | 1 hour |
| 2 | [Lee & Seung (2001)](https://papers.nips.cc/paper/1861-algorithms-for-non-negative-matrix-factorization) | Update rules + convergence proof | 1 day |
| 3 | [Supplementary proof guide (2025)](https://arxiv.org/abs/2501.11341) | Fill proof gaps | 2 hours |
| 4 | [Hunter & Lange (2004)](https://doi.org/10.1198/0003130042836) | General MM framework | 3 hours |
| 5 | [Boyd & Vandenberghe Ch. 9](https://web.stanford.edu/~boyd/cvxbook/) | Unconstrained optimization | 1 day |
| 6 | [Tibshirani proximal gradient](https://www.stat.cmu.edu/~ryantibs/convexopt/lectures/prox-grad.pdf) | Proximal methods, FISTA | 3 hours |
| 7 | [Lin (2007)](https://www.csie.ntu.edu.tw/~cjlin/papers/multconv.pdf) | Known gaps in Lee & Seung proof | 3 hours |
| 8 | [Cai et al. (2011)](https://doi.org/10.1109/TPAMI.2010.231) | **Template for the proof** | 1 day |
| 9 | [Hoyer (2004)](https://www.jmlr.org/papers/volume5/hoyer04a/hoyer04a.pdf) | Alternative: projected gradient | 3 hours |
| 10 | [TRMF (Yu et al. 2016)](https://arxiv.org/abs/1509.08333) | Temporal regularization (not NMF) | 3 hours |
| 11 | [Chiovetto et al. (2016)](https://pmc.ncbi.nlm.nih.gov/articles/PMC5593271/) | Temporal NMF (hard constraint) | 2 hours |
| 12 | [Koulakis et al. (2020)](https://arxiv.org/abs/2002.11323) | Second-order convergence | 1 day |

~2 weeks of focused reading before deriving.

---

## Additional References

| Resource | Link |
|----------|------|
| [Matrix Cookbook](https://www.math.uwaterloo.ca/~hwolkowi/matrixcookbook.pdf) | Matrix calculus reference |
| [Regularized NMF (2024)](https://arxiv.org/abs/2410.22698) | General recipe for regularized MU |
| [mSOM 2nd-order NMF (2023)](https://arxiv.org/abs/2303.17992) | Second-order majorant algorithm |
| [NNDSVD initialization survey](https://arxiv.org/pdf/2109.03874) | Initialization strategies |
| [Boutsidis & Gallopoulos (2008)](https://doi.org/10.1016/j.patcog.2007.09.010) | NNDSVD original paper |
| [Brunet et al. (2004)](https://doi.org/10.1073/pnas.0308531101) | Cophenetic correlation for rank selection |
| [spOT-NMF (2025)](https://www.biorxiv.org/content/10.1101/2025.08.02.668292v1) | Optimal transport NMF |
