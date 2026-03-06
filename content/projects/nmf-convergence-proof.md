---
title: "NMF: Derivation of Update Rules & Convergence Proof"
date: 2026-03-06
author: "Matt Jacob"
description: "A self-contained derivation of Lee & Seung's multiplicative update rules for Non-Negative Matrix Factorization, with full convergence proofs for both the Euclidean and divergence objectives."
tags: ["NMF", "optimization", "linear algebra", "convergence", "proofs"]
draft: false
---

A self-contained walk through the math behind NMF — deriving the multiplicative update rules from first principles and proving they converge, following [Lee & Seung (1999)](https://www.cs.columbia.edu/~blei/fogm/2020F/readings/LeeSeung1999.pdf) and [Lee & Seung (2001)](https://papers.nips.cc/paper/1861-algorithms-for-non-negative-matrix-factorization).

**Covers:**

- Problem setup and two objective functions (Frobenius norm, KL divergence)
- Matrix calculus preliminaries
- Derivation of multiplicative update rules for both objectives
- Full convergence proof via auxiliary functions (Euclidean case)
- Convergence sketch for the divergence case
- Summary of the proof architecture

<a href="/eigen/pdfs/nmf_proof.pdf" target="_blank" style="display: inline-block; margin-top: 1rem; padding: 0.5rem 1.2rem; border: 1px solid #ccc; border-radius: 4px; text-decoration: none; color: inherit;">Read the full proof (PDF)</a>
