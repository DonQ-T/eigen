---
title: "Deep Learning Multiple Choice"
date: 2026-03-16
author: "Matt Jacob"
description: "151 multiple choice questions covering chapters 1–10 of Goodfellow, Bengio & Courville's Deep Learning — with KaTeX math, explanations, and progress tracking."
tags: ["deep learning", "study", "interactive"]
js: "js/mcq.js"
draft: true
---

A multiple choice quiz bank for studying [*Deep Learning*](https://www.deeplearningbook.org/) by Goodfellow, Bengio & Courville. Questions test conceptual understanding, formula recall, and application across chapters 1–10, with full LaTeX math rendering and detailed explanations.

All progress is saved in your browser's localStorage. Questions and answer choices are shuffled each session.

**Keyboard shortcuts:** 1–4 to select an answer, Enter/Space for next question, Escape to return to dashboard.

---

<div id="mcq-app">

<!-- Dashboard -->
<div id="mcq-dashboard">
  <div class="mcq-stat-grid">
    <div class="mcq-stat-card">
      <div class="mcq-stat-value" id="mcq-stat-total">0</div>
      <div class="mcq-stat-label">Total</div>
    </div>
    <div class="mcq-stat-card">
      <div class="mcq-stat-value" id="mcq-stat-attempted">0</div>
      <div class="mcq-stat-label">Attempted</div>
    </div>
    <div class="mcq-stat-card">
      <div class="mcq-stat-value" id="mcq-stat-correct">0</div>
      <div class="mcq-stat-label">Correct</div>
    </div>
    <div class="mcq-stat-card">
      <div class="mcq-stat-value" id="mcq-stat-accuracy">0%</div>
      <div class="mcq-stat-label">Accuracy</div>
    </div>
  </div>

  <div class="mcq-filters">
    <div class="mcq-filters-label">Chapters</div>
    <div id="mcq-chapter-filters"></div>
  </div>

  <div class="fc-btn-row" style="align-items: center; gap: 1rem;">
    <label style="color: var(--text-secondary); font-size: 0.9rem;">Questions per quiz:</label>
    <input type="number" id="mcq-count-input" class="mcq-count-input" value="20" min="1" max="151">
  </div>

  <div class="fc-btn-row">
    <button class="fc-btn fc-btn-primary" id="mcq-start-btn">Start Quiz</button>
    <button class="fc-btn" id="mcq-review-btn">Review Mistakes</button>
    <button class="fc-btn" id="mcq-reset-btn">Reset Progress</button>
  </div>
</div>

<!-- Quiz View -->
<div id="mcq-quiz-view" class="mcq-hidden">
  <div class="mcq-progress" id="mcq-progress-text">1 / 20</div>
  <div class="mcq-question-card">
    <div id="mcq-question-text"></div>
  </div>
  <div id="mcq-choices" class="mcq-choices"></div>
  <div id="mcq-explanation" class="mcq-explanation mcq-hidden"></div>
  <div class="fc-btn-row" style="justify-content: center; margin-top: 1rem;">
    <button class="fc-btn fc-btn-primary mcq-hidden" id="mcq-next-btn">Next</button>
  </div>
  <div class="fc-btn-row" style="justify-content: center; margin-top: 0.5rem;">
    <button class="fc-btn" id="mcq-quit-btn">Back to Dashboard</button>
  </div>
</div>

<!-- Review View -->
<div id="mcq-review-view" class="mcq-hidden">
  <div id="mcq-review-list" class="mcq-review-list"></div>
  <div class="fc-btn-row" style="justify-content: center; margin-top: 1rem;">
    <button class="fc-btn" id="mcq-review-back-btn">Back to Dashboard</button>
  </div>
</div>

</div>
