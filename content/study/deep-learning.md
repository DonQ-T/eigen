---
title: "Deep Learning Study Lab"
date: 2026-03-17
author: "Matt Jacob"
description: "Unified study tools for Goodfellow, Bengio & Courville's Deep Learning — flashcards, quizzes, and progress tracking with spaced repetition."
tags: ["deep learning", "study", "interactive"]
js: "js/study-lab.js"
draft: false
---

A unified study environment for [*Deep Learning*](https://www.deeplearningbook.org/) by Goodfellow, Bengio & Courville. Combines spaced-repetition flashcards, multiple choice quizzes, and progress tracking in one place.

All progress is saved in your browser's localStorage. **Keyboard shortcuts:** 1–5 to switch tabs, then use tab-specific shortcuts (Space to flip cards, 1–4 to rate/answer, Escape to go back).

---

<div id="sl-app">

<!-- Streak Bar -->
<div class="sl-streak-bar">
  <span class="sl-streak-icon">&#9670;</span>
  <span id="sl-streak-value">0 day streak</span>
</div>

<!-- Tab Navigation -->
<div class="sl-tabs">
  <button class="sl-tab sl-tab-active" data-tab="review">Review</button>
  <button class="sl-tab" data-tab="quiz">Quiz</button>
  <button class="sl-tab" data-tab="stats">Stats</button>
  <button class="sl-tab" data-tab="reference">Reference</button>
  <button class="sl-tab" data-tab="map">Explore</button>
</div>

<!-- ==================== REVIEW TAB ==================== -->
<div id="sl-tab-review" class="sl-tab-panel">
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
</div>

<!-- ==================== QUIZ TAB ==================== -->
<div id="sl-tab-quiz" class="sl-tab-panel sl-hidden">
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
</div>

<!-- ==================== STATS TAB ==================== -->
<div id="sl-tab-stats" class="sl-tab-panel sl-hidden">

<div class="sl-section-label">Overview</div>
<div id="sl-stats-overview" class="sl-stats-grid">
  <div class="sl-stat-card">
    <div class="sl-stat-value" id="sl-stat-cards">0</div>
    <div class="sl-stat-label">Total Cards</div>
  </div>
  <div class="sl-stat-card">
    <div class="sl-stat-value" id="sl-stat-questions">0</div>
    <div class="sl-stat-label">Total Questions</div>
  </div>
  <div class="sl-stat-card">
    <div class="sl-stat-value" id="sl-stat-due">0</div>
    <div class="sl-stat-label">Cards Due</div>
  </div>
  <div class="sl-stat-card">
    <div class="sl-stat-value" id="sl-stat-accuracy">0%</div>
    <div class="sl-stat-label">Quiz Accuracy</div>
  </div>
  <div class="sl-stat-card">
    <div class="sl-stat-value" id="sl-stat-streak">0</div>
    <div class="sl-stat-label">Current Streak</div>
  </div>
  <div class="sl-stat-card">
    <div class="sl-stat-value" id="sl-stat-best">0</div>
    <div class="sl-stat-label">Best Streak</div>
  </div>
</div>

<div class="sl-section-label" style="margin-top: 2.5rem;">Mastery by Chapter</div>
<div id="sl-mastery-rings" class="sl-mastery-grid"></div>

<div class="sl-section-label" style="margin-top: 2.5rem;">Study Activity</div>
<div id="sl-heat-map"></div>

</div>

<!-- ==================== REFERENCE TAB (Phase 2) ==================== -->
<div id="sl-tab-reference" class="sl-tab-panel sl-hidden">
  <input type="text" class="fc-search" id="sl-ref-search" placeholder="Search terms, definitions, equations...">
  <div id="sl-ref-list"></div>
</div>

<!-- ==================== EXPLORE TAB ==================== -->
<div id="sl-tab-map" class="sl-tab-panel sl-hidden">
  <div id="sl-map-container"></div>
</div>

</div>
