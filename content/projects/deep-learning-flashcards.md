---
title: "Deep Learning Flashcards"
date: 2026-03-16
author: "Matt Jacob"
description: "Spaced-repetition flashcard bank for Goodfellow, Bengio & Courville's Deep Learning — with KaTeX math rendering and SM-2 scheduling."
tags: ["deep learning", "study", "interactive"]
js: "js/flashcards.js"
draft: true
---

An interactive flashcard bank for studying [*Deep Learning*](https://www.deeplearningbook.org/) by Goodfellow, Bengio & Courville. Cards cover definitions, theorems, and intuitions from each chapter, with full LaTeX math rendering.

The app uses the **SM-2 spaced repetition algorithm** — the same scheduler behind Anki — to optimize review timing. Cards you find easy appear less often; cards you struggle with come back sooner. All progress is saved in your browser's localStorage.

**Keyboard shortcuts:** Space to flip, 1–4 to rate (Again/Hard/Good/Easy), Escape to return to dashboard.

---

<div id="fc-app">

<!-- Dashboard -->
<div id="fc-dashboard">
  <div class="fc-stat-grid">
    <div class="fc-stat-card">
      <div class="fc-stat-value" id="fc-stat-total">0</div>
      <div class="fc-stat-label">Total</div>
    </div>
    <div class="fc-stat-card">
      <div class="fc-stat-value" id="fc-stat-due">0</div>
      <div class="fc-stat-label">Due</div>
    </div>
    <div class="fc-stat-card">
      <div class="fc-stat-value" id="fc-stat-learned">0</div>
      <div class="fc-stat-label">Learned</div>
    </div>
    <div class="fc-stat-card">
      <div class="fc-stat-value" id="fc-stat-new">0</div>
      <div class="fc-stat-label">New</div>
    </div>
  </div>

  <div class="fc-filters">
    <div class="fc-filters-label">Chapters</div>
    <div id="fc-chapter-filters"></div>
  </div>

  <div class="fc-btn-row">
    <button class="fc-btn fc-btn-primary" id="fc-study-btn">Study Due Cards</button>
    <button class="fc-btn" id="fc-study-all-btn">Study All</button>
    <button class="fc-btn" id="fc-browse-btn">Browse All Cards</button>
  </div>
</div>

<!-- Study View -->
<div id="fc-study-view" class="fc-hidden">
  <div class="fc-progress" id="fc-progress-text">1 / 20</div>
  <div class="fc-card-container" id="fc-card-container">
    <div class="fc-card" id="fc-card">
      <div class="fc-card-front" id="fc-card-front"></div>
      <div class="fc-card-back" id="fc-card-back"></div>
    </div>
  </div>
  <div class="fc-btn-row" style="justify-content: center; margin-top: 1rem;">
    <button class="fc-btn fc-btn-primary" id="fc-flip-btn">Flip</button>
  </div>
  <div class="fc-rating-row fc-hidden" id="fc-rating-row"></div>
  <div class="fc-btn-row" style="justify-content: center; margin-top: 1rem;">
    <button class="fc-btn" id="fc-back-btn">Back to Dashboard</button>
  </div>
</div>

<!-- Browse View -->
<div id="fc-browse-view" class="fc-hidden">
  <input type="text" class="fc-search" id="fc-search-input" placeholder="Search cards...">
  <div class="fc-browse-list" id="fc-browse-list"></div>
  <div class="fc-btn-row" style="justify-content: center; margin-top: 1rem;">
    <button class="fc-btn" id="fc-browse-back-btn">Back to Dashboard</button>
  </div>
</div>

</div>
