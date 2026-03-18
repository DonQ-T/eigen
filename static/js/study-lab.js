/* ============================================
   Study Lab — Unified Flashcard + MCQ + Stats
   Single IIFE combining review, quiz, and
   analytics into a tabbed interface.
   ============================================ */

(function () {
  'use strict';

  // ============================================
  // SHARED STATE
  // ============================================

  var meta = null;

  // ============================================
  // SHARED UTILITIES
  // ============================================

  function today() {
    return new Date().toISOString().split('T')[0];
  }

  function addDays(dateStr, days) {
    var d = new Date(dateStr + 'T00:00:00');
    d.setDate(d.getDate() + days);
    return d.toISOString().split('T')[0];
  }

  function shuffle(arr) {
    for (var i = arr.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var tmp = arr[i];
      arr[i] = arr[j];
      arr[j] = tmp;
    }
    return arr;
  }

  /** Convert markdown-like text to HTML: bold, code, line breaks, bullet lists */
  function renderText(text) {
    if (!text) return '';
    var lines = text.split('\n');
    var html = '';
    var inList = false;

    for (var i = 0; i < lines.length; i++) {
      var line = lines[i];
      var bulletMatch = line.match(/^- (.+)/);

      if (bulletMatch) {
        if (!inList) { html += '<ul>'; inList = true; }
        html += '<li>' + inlineFormat(bulletMatch[1]) + '</li>';
      } else {
        if (inList) { html += '</ul>'; inList = false; }
        if (i > 0) html += '<br>';
        html += inlineFormat(line);
      }
    }
    if (inList) html += '</ul>';
    return html;
  }

  /** Inline formatting: **bold**, `code` */
  function inlineFormat(str) {
    str = str.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    str = str.replace(/`(.+?)`/g, '<code>$1</code>');
    return str;
  }

  /** Render KaTeX in an element if renderMathInElement is available */
  function renderMath(el) {
    if (typeof renderMathInElement === 'function') {
      renderMathInElement(el, {
        delimiters: [
          { left: '$$', right: '$$', display: true },
          { left: '$', right: '$', display: false }
        ]
      });
    }
  }

  // ============================================
  // STUDY LOG (sl-meta localStorage)
  // ============================================

  function loadMeta() {
    try {
      var raw = localStorage.getItem('sl-meta');
      if (raw) {
        var parsed = JSON.parse(raw);
        // Ensure all fields exist
        if (!parsed.streak) parsed.streak = { current: 0, best: 0, lastDate: null };
        if (!parsed.studyLog) parsed.studyLog = {};
        if (!parsed.lastTab) parsed.lastTab = 'stats';
        return parsed;
      }
    } catch (e) {
      // fall through to defaults
    }
    return {
      streak: { current: 0, best: 0, lastDate: null },
      studyLog: {},
      lastTab: 'stats'
    };
  }

  function saveMeta(m) {
    try {
      localStorage.setItem('sl-meta', JSON.stringify(m));
    } catch (e) {
      // localStorage full or unavailable
    }
  }

  function recordActivity(m, type, count) {
    var d = today();

    // Update study log
    if (!m.studyLog[d]) {
      m.studyLog[d] = { fc: 0, mcq: 0 };
    }
    m.studyLog[d][type] = (m.studyLog[d][type] || 0) + count;

    // Update streak
    var lastDate = m.streak.lastDate;
    if (lastDate !== d) {
      var yesterday = addDays(d, -1);
      if (lastDate === yesterday) {
        m.streak.current += 1;
      } else {
        m.streak.current = 1;
      }
      m.streak.lastDate = d;
      if (m.streak.current > m.streak.best) {
        m.streak.best = m.streak.current;
      }
    }

    saveMeta(m);
  }

  function updateStreakDisplay(m) {
    var el = document.getElementById('sl-streak-value');
    if (!el) return;
    var n = m.streak.current;
    if (n === 0) {
      el.textContent = 'Start a streak today';
    } else {
      el.textContent = n + ' day streak';
    }
  }

  // ============================================
  // TAB CONTROLLER
  // ============================================

  var activeTab = 'stats';

  function switchTab(tabName) {
    activeTab = tabName;

    // Hide all tab panels
    var panels = document.querySelectorAll('.sl-tab-panel');
    for (var i = 0; i < panels.length; i++) {
      panels[i].classList.add('sl-hidden');
    }

    // Show the target panel
    var target = document.getElementById('sl-tab-' + tabName);
    if (target) target.classList.remove('sl-hidden');

    // Update button active states
    var tabBtns = document.querySelectorAll('.sl-tab');
    for (var j = 0; j < tabBtns.length; j++) {
      if (tabBtns[j].getAttribute('data-tab') === tabName) {
        tabBtns[j].classList.add('sl-tab-active');
      } else {
        tabBtns[j].classList.remove('sl-tab-active');
      }
    }

    // Save last tab
    if (meta) {
      meta.lastTab = tabName;
      saveMeta(meta);
    }

    // Refresh stats when switching to stats tab
    if (tabName === 'stats') {
      statsRefresh();
    }

    // Re-render map when switching to map tab (updates mastery colors)
    if (tabName === 'map') {
      mapRender();
    }
  }

  // ============================================
  // REVIEW MODULE (Flashcards)
  // ============================================

  var fcAllCards = [];
  var fcProgress = {};
  var fcStudyQueue = [];
  var fcStudyIndex = 0;
  var fcIsFlipped = false;
  var fcRatingVisible = false;
  var fcSelectedChapters = new Set();

  var FC_STORAGE_KEY = 'fc-progress';

  // -- Persistence --

  function fcLoadProgress() {
    try {
      var raw = localStorage.getItem(FC_STORAGE_KEY);
      if (raw) fcProgress = JSON.parse(raw);
    } catch (e) {
      fcProgress = {};
    }
  }

  function fcSaveProgress() {
    try {
      localStorage.setItem(FC_STORAGE_KEY, JSON.stringify(fcProgress));
    } catch (e) {
      // localStorage full or unavailable
    }
  }

  // -- SM-2 Engine --

  function fcGetCardProgress(id) {
    if (fcProgress[id]) return fcProgress[id];
    return { easeFactor: 2.5, interval: 0, repetition: 0, nextReview: today() };
  }

  function fcApplyRating(id, quality) {
    var p = fcGetCardProgress(id);
    var ef = p.easeFactor;
    var interval = p.interval;
    var rep = p.repetition;

    if (quality < 2) {
      // Again (0) or Hard (1)
      rep = 0;
      interval = quality === 0 ? 0 : 1;
    } else {
      // Good (2) or Easy (3)
      if (rep === 0) {
        interval = 1;
      } else if (rep === 1) {
        interval = 6;
      } else {
        interval = Math.round(interval * ef);
      }
      if (quality === 3) {
        interval = Math.round(interval * 1.3);
      }
      rep += 1;
    }

    // Ease factor adjustment
    ef = ef + (0.1 - (3 - quality) * (0.08 + (3 - quality) * 0.02));
    if (ef < 1.3) ef = 1.3;

    var nextReview = addDays(today(), interval);

    fcProgress[id] = {
      easeFactor: ef,
      interval: interval,
      repetition: rep,
      nextReview: nextReview
    };

    fcSaveProgress();
  }

  /** Predict the interval that would result from a given rating */
  function fcPredictInterval(id, quality) {
    var p = fcGetCardProgress(id);
    var ef = p.easeFactor;
    var interval = p.interval;
    var rep = p.repetition;

    if (quality < 2) {
      return quality === 0 ? 0 : 1;
    }

    var newInterval;
    if (rep === 0) {
      newInterval = 1;
    } else if (rep === 1) {
      newInterval = 6;
    } else {
      newInterval = Math.round(interval * ef);
    }
    if (quality === 3) {
      newInterval = Math.round(newInterval * 1.3);
    }
    return newInterval;
  }

  function fcFormatInterval(days) {
    if (days === 0) return '< 1 min';
    if (days === 1) return '1d';
    if (days < 30) return days + 'd';
    if (days < 365) return Math.round(days / 30) + 'mo';
    return (days / 365).toFixed(1) + 'y';
  }

  // -- Data & Stats --

  function fcGetChapters() {
    var chapters = {};
    for (var i = 0; i < fcAllCards.length; i++) {
      var ch = fcAllCards[i].chapter || 'Unknown';
      chapters[ch] = (chapters[ch] || 0) + 1;
    }
    return chapters;
  }

  function fcGetFilteredCards() {
    if (fcSelectedChapters.size === 0) return fcAllCards;
    return fcAllCards.filter(function (c) {
      return fcSelectedChapters.has(String(c.chapter));
    });
  }

  function fcIsDue(card) {
    var p = fcProgress[card.id];
    if (!p) return true; // new card = due
    return p.nextReview <= today();
  }

  function fcGetDueCards() {
    return fcGetFilteredCards().filter(fcIsDue);
  }

  function fcComputeStats() {
    var filtered = fcGetFilteredCards();
    var due = 0;
    var learned = 0;
    var newCount = 0;

    for (var i = 0; i < filtered.length; i++) {
      var p = fcProgress[filtered[i].id];
      if (!p) {
        newCount++;
        due++; // new cards are due
      } else {
        if (p.repetition >= 1) learned++;
        if (p.nextReview <= today()) due++;
      }
    }

    return {
      total: filtered.length,
      due: due,
      learned: learned,
      newCards: newCount
    };
  }

  // -- View Switching --

  function fcShowView(viewId) {
    var views = ['fc-dashboard', 'fc-study-view', 'fc-browse-view'];
    for (var i = 0; i < views.length; i++) {
      var el = document.getElementById(views[i]);
      if (el) {
        if (views[i] === viewId) {
          el.classList.remove('fc-hidden');
        } else {
          el.classList.add('fc-hidden');
        }
      }
    }
    if (viewId === 'fc-dashboard') {
      fcUpdateDashboard();
    }
  }

  // -- Dashboard --

  function fcUpdateDashboard() {
    var stats = fcComputeStats();

    var elTotal = document.getElementById('fc-stat-total');
    var elDue = document.getElementById('fc-stat-due');
    var elLearned = document.getElementById('fc-stat-learned');
    var elNew = document.getElementById('fc-stat-new');

    if (elTotal) elTotal.textContent = stats.total;
    if (elDue) elDue.textContent = stats.due;
    if (elLearned) elLearned.textContent = stats.learned;
    if (elNew) elNew.textContent = stats.newCards;
  }

  function fcBuildChapterFilters() {
    var container = document.getElementById('fc-chapter-filters');
    if (!container) return;
    container.innerHTML = '';

    var chapters = fcGetChapters();
    var sortedKeys = Object.keys(chapters).sort(function(a, b) { return Number(a) - Number(b); });

    // "All" pill
    var allBtn = document.createElement('button');
    allBtn.className = 'sl-filter-pill' + (fcSelectedChapters.size === 0 ? ' sl-filter-pill-active' : '');
    allBtn.textContent = 'All';
    allBtn.addEventListener('click', function() {
      fcSelectedChapters.clear();
      fcUpdateFilterPills(container, chapters, sortedKeys);
      fcUpdateDashboard();
    });
    container.appendChild(allBtn);

    for (var i = 0; i < sortedKeys.length; i++) {
      var ch = sortedKeys[i];
      var btn = document.createElement('button');
      btn.className = 'sl-filter-pill' + (fcSelectedChapters.has(ch) ? ' sl-filter-pill-active' : '');
      btn.textContent = ch;
      btn.setAttribute('data-chapter', ch);

      btn.addEventListener('click', (function(chapter) {
        return function() {
          if (fcSelectedChapters.has(chapter)) {
            fcSelectedChapters.delete(chapter);
          } else {
            fcSelectedChapters.add(chapter);
          }
          // If all selected, treat as "all"
          if (fcSelectedChapters.size === sortedKeys.length) {
            fcSelectedChapters.clear();
          }
          fcUpdateFilterPills(container, chapters, sortedKeys);
          fcUpdateDashboard();
        };
      })(ch));

      container.appendChild(btn);
    }
  }

  function fcUpdateFilterPills(container, chapters, sortedKeys) {
    var pills = container.querySelectorAll('.sl-filter-pill');
    // First pill is "All"
    pills[0].classList.toggle('sl-filter-pill-active', fcSelectedChapters.size === 0);
    for (var i = 0; i < sortedKeys.length; i++) {
      pills[i + 1].classList.toggle('sl-filter-pill-active',
        fcSelectedChapters.size === 0 || fcSelectedChapters.has(sortedKeys[i]));
    }
  }

  // -- Study View --

  function fcStartStudy(onlyDue) {
    var cards;
    if (onlyDue) {
      cards = fcGetDueCards();
    } else {
      cards = fcGetFilteredCards().slice();
    }

    if (cards.length === 0) {
      alert('No cards to study. Check your chapter filters or come back when cards are due.');
      return;
    }

    fcStudyQueue = shuffle(cards);
    fcStudyIndex = 0;
    fcIsFlipped = false;
    fcRatingVisible = false;

    fcShowView('fc-study-view');
    fcShowCurrentCard();
  }

  function fcShowCurrentCard() {
    if (fcStudyIndex >= fcStudyQueue.length) {
      fcShowCompletion();
      return;
    }

    var card = fcStudyQueue[fcStudyIndex];
    fcIsFlipped = false;
    fcRatingVisible = false;

    var cardEl = document.getElementById('fc-card');
    if (cardEl) cardEl.classList.remove('fc-card-flipped');

    var frontEl = document.getElementById('fc-card-front');
    var backEl = document.getElementById('fc-card-back');
    var ratingRow = document.getElementById('fc-rating-row');
    var progressText = document.getElementById('fc-progress-text');

    if (frontEl) {
      frontEl.innerHTML = '<div class="fc-card-content">' +
        '<span class="fc-chapter-tag">' + (card.chapter || '') + '</span>' +
        renderText(card.front) +
        '</div>';
      renderMath(frontEl);
    }

    if (backEl) {
      backEl.innerHTML = '<div class="fc-card-content">' +
        renderText(card.back) +
        '</div>';
      renderMath(backEl);
    }

    if (ratingRow) ratingRow.classList.add('fc-hidden');

    if (progressText) {
      progressText.textContent = (fcStudyIndex + 1) + ' / ' + fcStudyQueue.length;
    }
  }

  function fcFlipCard() {
    if (fcStudyIndex >= fcStudyQueue.length) return;

    var cardEl = document.getElementById('fc-card');
    var ratingRow = document.getElementById('fc-rating-row');

    if (fcIsFlipped) {
      // Flip back to front
      fcIsFlipped = false;
      if (cardEl) cardEl.classList.remove('fc-card-flipped');
      if (ratingRow) ratingRow.classList.add('fc-hidden');
      fcRatingVisible = false;
    } else {
      // Flip to back
      fcIsFlipped = true;
      fcRatingVisible = true;
      if (cardEl) cardEl.classList.add('fc-card-flipped');
      if (ratingRow) {
        ratingRow.classList.remove('fc-hidden');
        fcUpdateRatingButtons();
      }
    }
  }

  function fcUpdateRatingButtons() {
    if (fcStudyIndex >= fcStudyQueue.length) return;
    var card = fcStudyQueue[fcStudyIndex];
    var labels = ['Again', 'Hard', 'Good', 'Easy'];

    var ratingRow = document.getElementById('fc-rating-row');
    if (!ratingRow) return;

    ratingRow.innerHTML = '';
    for (var q = 0; q < 4; q++) {
      var btn = document.createElement('button');
      btn.className = 'fc-rating-btn fc-btn';
      btn.setAttribute('data-quality', q);

      btn.textContent = labels[q];

      btn.addEventListener('click', (function (quality) {
        return function () { fcRateCard(quality); };
      })(q));

      ratingRow.appendChild(btn);
    }
  }

  function fcRateCard(quality) {
    if (!fcRatingVisible || fcStudyIndex >= fcStudyQueue.length) return;
    var card = fcStudyQueue[fcStudyIndex];
    fcApplyRating(card.id, quality);

    // Record activity in study log
    recordActivity(meta, 'fc', 1);
    updateStreakDisplay(meta);

    fcStudyIndex++;
    fcShowCurrentCard();
  }

  function fcShowCompletion() {
    var frontEl = document.getElementById('fc-card-front');
    var backEl = document.getElementById('fc-card-back');
    var cardEl = document.getElementById('fc-card');
    var ratingRow = document.getElementById('fc-rating-row');
    var progressText = document.getElementById('fc-progress-text');

    if (cardEl) cardEl.classList.remove('fc-card-flipped');

    if (frontEl) {
      frontEl.innerHTML = '<div class="fc-card-content">' +
        '<strong>Session complete!</strong><br><br>' +
        'You reviewed ' + fcStudyQueue.length + ' card' + (fcStudyQueue.length === 1 ? '' : 's') + '.' +
        '</div>';
    }
    if (backEl) backEl.innerHTML = '';
    if (ratingRow) ratingRow.classList.add('fc-hidden');
    if (progressText) progressText.textContent = 'Done';

    fcIsFlipped = false;
    fcRatingVisible = false;
  }

  // -- Browse View --

  function fcShowBrowse() {
    fcShowView('fc-browse-view');
    var searchInput = document.getElementById('fc-search-input');
    if (searchInput) searchInput.value = '';
    fcRenderBrowseList('');
  }

  function fcRenderBrowseList(query) {
    var list = document.getElementById('fc-browse-list');
    if (!list) return;
    list.innerHTML = '';

    var filtered = fcGetFilteredCards();
    var q = (query || '').toLowerCase();

    for (var i = 0; i < filtered.length; i++) {
      var card = filtered[i];
      var front = card.front || '';
      var back = card.back || '';

      if (q && front.toLowerCase().indexOf(q) === -1 && back.toLowerCase().indexOf(q) === -1) {
        continue;
      }

      var item = document.createElement('div');
      item.className = 'fc-browse-item';
      item.setAttribute('data-card-idx', i);

      var p = fcProgress[card.id];
      var statusText = p ? (p.repetition >= 1 ? 'Learned' : 'Seen') : 'New';

      var preview = front.replace(/\n/g, ' ').replace(/\*\*/g, '');
      if (preview.length > 120) preview = preview.substring(0, 120) + '...';

      item.innerHTML =
        '<div class="fc-browse-item-header">' +
          '<span class="fc-chapter-tag">' + (card.chapter || '') + '</span>' +
          '<span class="fc-browse-status">' + statusText + '</span>' +
        '</div>' +
        '<div class="fc-browse-preview">' + inlineFormat(preview) + '</div>' +
        '<div class="fc-browse-detail fc-hidden">' +
          '<div class="fc-browse-front"><strong>Q:</strong> ' + renderText(front) + '</div>' +
          '<div class="fc-browse-back"><strong>A:</strong> ' + renderText(back) + '</div>' +
        '</div>';

      item.addEventListener('click', function () {
        var detail = this.querySelector('.fc-browse-detail');
        var isExpanded = this.classList.contains('fc-browse-item-expanded');
        this.classList.toggle('fc-browse-item-expanded');
        if (detail) {
          detail.classList.toggle('fc-hidden');
          if (!isExpanded) renderMath(detail);
        }
      });

      list.appendChild(item);
    }

    if (list.children.length === 0) {
      list.innerHTML = '<div class="fc-browse-empty">No cards match your search.</div>';
    }
  }

  // -- FC Init --

  function fcInit(cards) {
    fcAllCards = cards;
    fcLoadProgress();
    fcBuildChapterFilters();
    fcUpdateDashboard();
    fcShowView('fc-dashboard');

    // Button events
    var studyBtn = document.getElementById('fc-study-btn');
    var studyAllBtn = document.getElementById('fc-study-all-btn');
    var browseBtn = document.getElementById('fc-browse-btn');
    var backBtn = document.getElementById('fc-back-btn');
    var flipBtn = document.getElementById('fc-flip-btn');
    var browseBackBtn = document.getElementById('fc-browse-back-btn');
    var searchInput = document.getElementById('fc-search-input');

    if (studyBtn) studyBtn.addEventListener('click', function () { fcStartStudy(true); });
    if (studyAllBtn) studyAllBtn.addEventListener('click', function () { fcStartStudy(false); });
    if (flipBtn) flipBtn.addEventListener('click', fcFlipCard);
    if (browseBtn) browseBtn.addEventListener('click', fcShowBrowse);
    if (backBtn) backBtn.addEventListener('click', function () { fcShowView('fc-dashboard'); });
    if (browseBackBtn) browseBackBtn.addEventListener('click', function () { fcShowView('fc-dashboard'); });

    if (searchInput) {
      searchInput.addEventListener('input', function () {
        fcRenderBrowseList(this.value);
      });
    }

    // Card flip on click
    var cardContainer = document.getElementById('fc-card-container');
    if (cardContainer) {
      cardContainer.addEventListener('click', fcFlipCard);
    }
  }

  // ============================================
  // QUIZ MODULE (MCQ)
  // ============================================

  var mcqAllQuestions = [];
  var mcqProgress = {};
  var mcqQuizQueue = [];
  var mcqQuizIndex = 0;
  var mcqHasAnswered = false;
  var mcqSelectedChapters = new Set();
  var mcqShuffledChoiceMap = [];

  var MCQ_STORAGE_KEY = 'mcq-progress';

  // -- Persistence --

  function mcqLoadProgress() {
    try {
      var raw = localStorage.getItem(MCQ_STORAGE_KEY);
      if (raw) mcqProgress = JSON.parse(raw);
    } catch (e) {
      mcqProgress = {};
    }
  }

  function mcqSaveProgress() {
    try {
      localStorage.setItem(MCQ_STORAGE_KEY, JSON.stringify(mcqProgress));
    } catch (e) {
      // localStorage full or unavailable
    }
  }

  function mcqResetProgress() {
    mcqProgress = {};
    mcqSaveProgress();
    mcqUpdateDashboard();
  }

  // -- Data & Stats --

  function mcqGetChapters() {
    var chapters = {};
    for (var i = 0; i < mcqAllQuestions.length; i++) {
      var ch = mcqAllQuestions[i].chapter || 'Unknown';
      chapters[ch] = (chapters[ch] || 0) + 1;
    }
    return chapters;
  }

  function mcqGetFilteredQuestions() {
    if (mcqSelectedChapters.size === 0) return mcqAllQuestions;
    return mcqAllQuestions.filter(function (q) {
      return mcqSelectedChapters.has(q.chapter);
    });
  }

  function mcqComputeStats() {
    var filtered = mcqGetFilteredQuestions();
    var attempted = 0;
    var correct = 0;

    for (var i = 0; i < filtered.length; i++) {
      var p = mcqProgress[filtered[i].id];
      if (p && p.answered) {
        attempted++;
        if (p.correct) correct++;
      }
    }

    return {
      total: filtered.length,
      attempted: attempted,
      correct: correct,
      accuracy: attempted > 0 ? Math.round((correct / attempted) * 100) : 0
    };
  }

  function mcqGetIncorrectQuestions() {
    var filtered = mcqGetFilteredQuestions();
    var incorrect = [];
    for (var i = 0; i < filtered.length; i++) {
      var p = mcqProgress[filtered[i].id];
      if (p && p.answered && !p.correct) {
        incorrect.push(filtered[i]);
      }
    }
    return incorrect;
  }

  // -- View Switching --

  function mcqShowView(viewId) {
    var views = ['mcq-dashboard', 'mcq-quiz-view', 'mcq-review-view'];
    for (var i = 0; i < views.length; i++) {
      var el = document.getElementById(views[i]);
      if (el) {
        if (views[i] === viewId) {
          el.classList.remove('mcq-hidden');
        } else {
          el.classList.add('mcq-hidden');
        }
      }
    }
    if (viewId === 'mcq-dashboard') {
      mcqUpdateDashboard();
    }
  }

  // -- Dashboard --

  function mcqUpdateDashboard() {
    var stats = mcqComputeStats();

    var elTotal = document.getElementById('mcq-stat-total');
    var elAttempted = document.getElementById('mcq-stat-attempted');
    var elCorrect = document.getElementById('mcq-stat-correct');
    var elAccuracy = document.getElementById('mcq-stat-accuracy');

    if (elTotal) elTotal.textContent = stats.total;
    if (elAttempted) elAttempted.textContent = stats.attempted;
    if (elCorrect) elCorrect.textContent = stats.correct;
    if (elAccuracy) elAccuracy.textContent = stats.accuracy + '%';
  }

  function mcqBuildChapterFilters() {
    var container = document.getElementById('mcq-chapter-filters');
    if (!container) return;
    container.innerHTML = '';

    var chapters = mcqGetChapters();
    var sortedKeys = Object.keys(chapters).sort(function (a, b) {
      return Number(a) - Number(b);
    });

    // "All" pill
    var allBtn = document.createElement('button');
    allBtn.className = 'sl-filter-pill' + (mcqSelectedChapters.size === 0 ? ' sl-filter-pill-active' : '');
    allBtn.textContent = 'All';
    allBtn.addEventListener('click', function() {
      mcqSelectedChapters.clear();
      mcqUpdateFilterPills(container, chapters, sortedKeys);
      mcqUpdateDashboard();
    });
    container.appendChild(allBtn);

    for (var i = 0; i < sortedKeys.length; i++) {
      var ch = sortedKeys[i];
      var numCh = Number(ch);
      var btn = document.createElement('button');
      btn.className = 'sl-filter-pill' + (mcqSelectedChapters.has(numCh) ? ' sl-filter-pill-active' : '');
      btn.textContent = ch;
      btn.setAttribute('data-chapter', ch);

      btn.addEventListener('click', (function(chapter) {
        return function() {
          if (mcqSelectedChapters.has(chapter)) {
            mcqSelectedChapters.delete(chapter);
          } else {
            mcqSelectedChapters.add(chapter);
          }
          if (mcqSelectedChapters.size === sortedKeys.length) {
            mcqSelectedChapters.clear();
          }
          mcqUpdateFilterPills(container, chapters, sortedKeys);
          mcqUpdateDashboard();
        };
      })(numCh));

      container.appendChild(btn);
    }
  }

  function mcqUpdateFilterPills(container, chapters, sortedKeys) {
    var pills = container.querySelectorAll('.sl-filter-pill');
    pills[0].classList.toggle('sl-filter-pill-active', mcqSelectedChapters.size === 0);
    for (var i = 0; i < sortedKeys.length; i++) {
      pills[i + 1].classList.toggle('sl-filter-pill-active',
        mcqSelectedChapters.size === 0 || mcqSelectedChapters.has(Number(sortedKeys[i])));
    }
  }

  // -- Quiz View --

  function mcqStartQuiz(reviewMode) {
    var questions;
    if (reviewMode) {
      questions = mcqGetIncorrectQuestions();
      if (questions.length === 0) {
        alert('No incorrect questions to review. Get some wrong first!');
        return;
      }
    } else {
      questions = mcqGetFilteredQuestions().slice();
    }

    if (questions.length === 0) {
      alert('No questions available. Check your chapter filters.');
      return;
    }

    shuffle(questions);

    // Limit to user-selected count (only in non-review mode)
    if (!reviewMode) {
      var countInput = document.getElementById('mcq-count-input');
      var count = countInput ? parseInt(countInput.value, 10) : 20;
      if (isNaN(count) || count < 1) count = 20;
      if (count < questions.length) {
        questions = questions.slice(0, count);
      }
    }

    mcqQuizQueue = questions;
    mcqQuizIndex = 0;
    mcqHasAnswered = false;

    mcqShowView('mcq-quiz-view');
    mcqShowCurrentQuestion();
  }

  function mcqShowCurrentQuestion() {
    if (mcqQuizIndex >= mcqQuizQueue.length) {
      mcqShowCompletion();
      return;
    }

    mcqHasAnswered = false;
    var q = mcqQuizQueue[mcqQuizIndex];

    // Update progress text
    var progressText = document.getElementById('mcq-progress-text');
    if (progressText) {
      progressText.textContent = (mcqQuizIndex + 1) + ' / ' + mcqQuizQueue.length;
    }

    // Render question text
    var questionEl = document.getElementById('mcq-question-text');
    if (questionEl) {
      questionEl.innerHTML = renderText(q.question);
      renderMath(questionEl);
    }

    // Shuffle choices: create a mapping from display position -> original index
    mcqShuffledChoiceMap = [];
    for (var i = 0; i < q.choices.length; i++) {
      mcqShuffledChoiceMap.push(i);
    }
    shuffle(mcqShuffledChoiceMap);

    // Render choice buttons
    var choicesEl = document.getElementById('mcq-choices');
    if (choicesEl) {
      choicesEl.innerHTML = '';
      var letters = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];

      for (var d = 0; d < mcqShuffledChoiceMap.length; d++) {
        var origIdx = mcqShuffledChoiceMap[d];
        var btn = document.createElement('button');
        btn.className = 'mcq-choice';
        btn.setAttribute('data-display-index', d);
        btn.setAttribute('data-original-index', origIdx);

        var letterSpan = document.createElement('span');
        letterSpan.className = 'mcq-choice-letter';
        letterSpan.textContent = letters[d];

        var textSpan = document.createElement('span');
        textSpan.className = 'mcq-choice-text';
        // Strip existing letter prefix (e.g. "A) ", "B) ") from choice text
        var choiceText = q.choices[origIdx].replace(/^[A-Z]\)\s*/, '');
        textSpan.innerHTML = renderText(choiceText);

        btn.appendChild(letterSpan);
        btn.appendChild(textSpan);

        btn.addEventListener('click', (function (displayIdx, originalIdx) {
          return function () { mcqSelectAnswer(displayIdx, originalIdx); };
        })(d, origIdx));

        choicesEl.appendChild(btn);
        renderMath(btn);
      }
    }

    // Hide explanation and next button
    var explanationEl = document.getElementById('mcq-explanation');
    if (explanationEl) {
      explanationEl.classList.add('mcq-hidden');
      explanationEl.innerHTML = '';
    }

    var nextBtn = document.getElementById('mcq-next-btn');
    if (nextBtn) nextBtn.classList.add('mcq-hidden');
  }

  function mcqSelectAnswer(displayIdx, originalIdx) {
    if (mcqHasAnswered) return;
    mcqHasAnswered = true;

    var q = mcqQuizQueue[mcqQuizIndex];
    var isCorrect = originalIdx === q.correct;

    // Save progress
    mcqProgress[q.id] = {
      answered: true,
      selectedChoice: originalIdx,
      correct: isCorrect
    };
    mcqSaveProgress();

    // Record activity in study log
    recordActivity(meta, 'mcq', 1);
    updateStreakDisplay(meta);

    // Cross-wire: bump flashcards on wrong answer
    if (!isCorrect) {
      crossWireBump(q);
    }

    // Highlight choices
    var choicesEl = document.getElementById('mcq-choices');
    if (choicesEl) {
      var buttons = choicesEl.querySelectorAll('.mcq-choice');
      for (var i = 0; i < buttons.length; i++) {
        var btn = buttons[i];
        var origIdx = parseInt(btn.getAttribute('data-original-index'), 10);

        btn.disabled = true;
        btn.classList.add('mcq-choice-disabled');

        if (origIdx === q.correct) {
          btn.classList.add('mcq-choice-correct');
        }
        if (origIdx === originalIdx && !isCorrect) {
          btn.classList.add('mcq-choice-wrong');
        }
      }
    }

    // Show explanation
    var explanationEl = document.getElementById('mcq-explanation');
    if (explanationEl && q.explanation) {
      explanationEl.innerHTML = '<strong>Explanation:</strong> ' + renderText(q.explanation);
      explanationEl.classList.remove('mcq-hidden');
      renderMath(explanationEl);
    }

    // Show next button
    var nextBtn = document.getElementById('mcq-next-btn');
    if (nextBtn) nextBtn.classList.remove('mcq-hidden');
  }

  function mcqNextQuestion() {
    if (!mcqHasAnswered) return;
    mcqQuizIndex++;
    mcqShowCurrentQuestion();
  }

  function mcqShowCompletion() {
    var questionEl = document.getElementById('mcq-question-text');
    var choicesEl = document.getElementById('mcq-choices');
    var explanationEl = document.getElementById('mcq-explanation');
    var nextBtn = document.getElementById('mcq-next-btn');
    var progressText = document.getElementById('mcq-progress-text');

    // Count results for this session
    var sessionCorrect = 0;
    for (var i = 0; i < mcqQuizQueue.length; i++) {
      var p = mcqProgress[mcqQuizQueue[i].id];
      if (p && p.correct) sessionCorrect++;
    }

    if (questionEl) {
      questionEl.innerHTML =
        '<div class="mcq-completion">' +
        '<strong>Quiz complete!</strong><br><br>' +
        'You got ' + sessionCorrect + ' / ' + mcqQuizQueue.length + ' correct ' +
        '(' + Math.round((sessionCorrect / mcqQuizQueue.length) * 100) + '%).' +
        '</div>';
    }
    if (choicesEl) choicesEl.innerHTML = '';
    if (explanationEl) {
      explanationEl.classList.add('mcq-hidden');
      explanationEl.innerHTML = '';
    }
    if (nextBtn) nextBtn.classList.add('mcq-hidden');
    if (progressText) progressText.textContent = 'Done';
  }

  // -- Review View --

  function mcqShowReview() {
    var incorrect = mcqGetIncorrectQuestions();

    if (incorrect.length === 0) {
      alert('No incorrect questions to review.');
      return;
    }

    mcqShowView('mcq-review-view');

    var listEl = document.getElementById('mcq-review-list');
    if (!listEl) return;
    listEl.innerHTML = '';

    for (var i = 0; i < incorrect.length; i++) {
      var q = incorrect[i];
      var p = mcqProgress[q.id];

      var item = document.createElement('div');
      item.className = 'mcq-review-item';

      var questionHtml = '<div class="mcq-review-question">' +
        '<span class="mcq-chapter-tag">' + (q.chapter || '') + '</span> ' +
        renderText(q.question) +
        '</div>';

      var yourAnswerRaw = p && typeof p.selectedChoice === 'number' && q.choices[p.selectedChoice]
        ? q.choices[p.selectedChoice]
        : 'N/A';
      var yourAnswer = yourAnswerRaw.replace(/^[A-Z]\)\s*/, '');
      var correctAnswer = (q.choices[q.correct] || 'N/A').replace(/^[A-Z]\)\s*/, '');

      var answersHtml =
        '<div class="mcq-review-answers">' +
        '<div style="margin-bottom:0.35rem;"><span class="mcq-review-answer mcq-review-answer-wrong">' +
        'Your answer: ' + renderText(yourAnswer) + '</span></div>' +
        '<div><span class="mcq-review-answer mcq-review-answer-correct">' +
        'Correct: ' + renderText(correctAnswer) + '</span></div>' +
        '</div>';

      var explanationHtml = q.explanation
        ? '<div class="mcq-review-explanation"><strong>Explanation:</strong> ' + renderText(q.explanation) + '</div>'
        : '';

      item.innerHTML = questionHtml + answersHtml + explanationHtml;
      listEl.appendChild(item);
      renderMath(item);
    }
  }

  // -- MCQ Init --

  function mcqInit(questions) {
    mcqAllQuestions = questions;
    mcqLoadProgress();
    mcqBuildChapterFilters();
    mcqUpdateDashboard();
    mcqShowView('mcq-dashboard');

    // Button events
    var startBtn = document.getElementById('mcq-start-btn');
    var reviewBtn = document.getElementById('mcq-review-btn');
    var resetBtn = document.getElementById('mcq-reset-btn');
    var nextBtn = document.getElementById('mcq-next-btn');
    var quitBtn = document.getElementById('mcq-quit-btn');
    var reviewBackBtn = document.getElementById('mcq-review-back-btn');

    if (startBtn) startBtn.addEventListener('click', function () { mcqStartQuiz(false); });
    if (reviewBtn) reviewBtn.addEventListener('click', mcqShowReview);
    if (resetBtn) resetBtn.addEventListener('click', function () {
      if (confirm('Reset all quiz progress? This cannot be undone.')) {
        mcqResetProgress();
      }
    });
    if (nextBtn) nextBtn.addEventListener('click', mcqNextQuestion);
    if (quitBtn) quitBtn.addEventListener('click', function () { mcqShowView('mcq-dashboard'); });
    if (reviewBackBtn) reviewBackBtn.addEventListener('click', function () { mcqShowView('mcq-dashboard'); });
  }

  // ============================================
  // STATS MODULE
  // ============================================

  function statsRefresh() {
    if (!meta) return;
    statsRenderOverview(meta);
    statsRenderMasteryRings();
    statsRenderHeatMap(meta);
  }

  function statsRenderOverview(m) {
    var container = document.getElementById('sl-stats-overview');
    if (!container) return;

    // Total cards
    var totalCards = fcAllCards.length;

    // Total questions
    var totalQuestions = mcqAllQuestions.length;

    // Cards due today
    var dueToday = 0;
    for (var i = 0; i < fcAllCards.length; i++) {
      if (fcIsDue(fcAllCards[i])) dueToday++;
    }

    // Quiz accuracy
    var mcqStats = mcqComputeStats();
    var accuracy = mcqStats.accuracy;

    // Streaks
    var currentStreak = m.streak.current;
    var bestStreak = m.streak.best;

    // Update DOM elements
    var elTotalCards = document.getElementById('sl-stat-cards');
    var elTotalQuestions = document.getElementById('sl-stat-questions');
    var elDueToday = document.getElementById('sl-stat-due');
    var elAccuracy = document.getElementById('sl-stat-accuracy');
    var elCurrentStreak = document.getElementById('sl-stat-streak');
    var elBestStreak = document.getElementById('sl-stat-best');

    if (elTotalCards) elTotalCards.textContent = totalCards;
    if (elTotalQuestions) elTotalQuestions.textContent = totalQuestions;
    if (elDueToday) elDueToday.textContent = dueToday;
    if (elAccuracy) elAccuracy.textContent = accuracy + '%';
    if (elCurrentStreak) elCurrentStreak.textContent = currentStreak;
    if (elBestStreak) elBestStreak.textContent = bestStreak;
  }

  function statsRenderMasteryRings() {
    var container = document.getElementById('sl-mastery-rings');
    if (!container) return;

    // Gather all unique chapters from both FC and MCQ
    var chapterSet = {};
    var i, ch;

    for (i = 0; i < fcAllCards.length; i++) {
      ch = fcAllCards[i].chapter;
      if (ch !== undefined && ch !== null) chapterSet[ch] = true;
    }
    for (i = 0; i < mcqAllQuestions.length; i++) {
      ch = mcqAllQuestions[i].chapter;
      if (ch !== undefined && ch !== null) chapterSet[ch] = true;
    }

    var chapters = Object.keys(chapterSet).sort(function (a, b) {
      return Number(a) - Number(b);
    });

    var circumference = 2 * Math.PI * 34; // ~213.628

    var html = '';
    for (i = 0; i < chapters.length; i++) {
      var chKey = chapters[i];

      // FC mastery for this chapter
      var fcSum = 0;
      var fcCount = 0;
      for (var f = 0; f < fcAllCards.length; f++) {
        if (String(fcAllCards[f].chapter) === String(chKey)) {
          var fp = fcProgress[fcAllCards[f].id];
          if (fp && fp.repetition >= 1) {
            var mastery = fp.easeFactor / 2.5;
            if (mastery < 0) mastery = 0;
            if (mastery > 1) mastery = 1;
            fcSum += mastery;
            fcCount++;
          }
        }
      }
      var fcMastery = fcCount > 0 ? fcSum / fcCount : 0;

      // MCQ accuracy for this chapter
      var mcqCorrect = 0;
      var mcqAttempted = 0;
      for (var m = 0; m < mcqAllQuestions.length; m++) {
        if (String(mcqAllQuestions[m].chapter) === String(chKey)) {
          var mp = mcqProgress[mcqAllQuestions[m].id];
          if (mp && mp.answered) {
            mcqAttempted++;
            if (mp.correct) mcqCorrect++;
          }
        }
      }
      var mcqAccuracy = mcqAttempted > 0 ? mcqCorrect / mcqAttempted : 0;

      // Combined mastery
      var combined = 0.6 * fcMastery + 0.4 * mcqAccuracy;
      var pct = Math.round(combined * 100);
      var filled = combined * circumference;
      var rest = circumference - filled;

      html +=
        '<div class="sl-mastery-item">' +
          '<svg viewBox="0 0 80 80" class="sl-ring-svg">' +
            '<circle cx="40" cy="40" r="34" fill="none" stroke="rgba(255,255,255,0.08)" stroke-width="6"/>' +
            '<circle cx="40" cy="40" r="34" fill="none" stroke="rgba(255,255,255,0.7)" stroke-width="6" ' +
              'stroke-dasharray="' + filled.toFixed(1) + ' ' + rest.toFixed(1) + '" stroke-dashoffset="0" stroke-linecap="round" transform="rotate(-90 40 40)"/>' +
          '</svg>' +
          '<div class="sl-mastery-label">Ch. ' + chKey + '</div>' +
          '<div class="sl-mastery-pct">' + pct + '%</div>' +
        '</div>';
    }

    container.innerHTML = html;
  }

  function statsRenderHeatMap(m) {
    var container = document.getElementById('sl-heat-map');
    if (!container) return;

    // Build 52 weeks x 7 days grid (364 cells), most recent on right
    var todayDate = new Date(today() + 'T00:00:00');

    // Find the end date (today) and start date (363 days ago)
    var endDate = new Date(todayDate);
    var startDate = new Date(todayDate);
    startDate.setDate(startDate.getDate() - 363);

    // Adjust start to the nearest previous Sunday (week start)
    var startDay = startDate.getDay(); // 0=Sun
    startDate.setDate(startDate.getDate() - startDay);

    // Build cells organized by week (column) and day (row)
    // We need to iterate week by week
    var weeks = [];
    var cursor = new Date(startDate);
    var monthLabels = [];
    var lastMonth = -1;

    while (cursor <= endDate) {
      var week = [];
      for (var dow = 0; dow < 7; dow++) {
        var dateStr = cursor.toISOString().split('T')[0];
        var curMonth = cursor.getMonth();

        // Track month transitions for labels
        if (dow === 0 && curMonth !== lastMonth) {
          var monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                            'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
          monthLabels.push({ weekIdx: weeks.length, label: monthNames[curMonth] });
          lastMonth = curMonth;
        }

        var count = 0;
        if (m.studyLog[dateStr]) {
          count = (m.studyLog[dateStr].fc || 0) + (m.studyLog[dateStr].mcq || 0);
        }

        var level = '';
        if (count >= 11) level = 'sl-heat-4';
        else if (count >= 6) level = 'sl-heat-3';
        else if (count >= 3) level = 'sl-heat-2';
        else if (count >= 1) level = 'sl-heat-1';

        var isFuture = cursor > todayDate;

        week.push({
          dateStr: dateStr,
          count: count,
          level: level,
          isFuture: isFuture
        });

        cursor.setDate(cursor.getDate() + 1);
      }
      weeks.push(week);
    }

    // Build HTML using CSS grid (7 rows, auto columns, column flow)
    var dayLabels = ['', 'Mon', '', 'Wed', '', 'Fri', ''];
    var html = '<div class="sl-heat-container">';

    // Month labels row
    html += '<div class="sl-heat-months" style="padding-left: 2rem;">';
    var monthPositions = {};
    for (var mi = 0; mi < monthLabels.length; mi++) {
      monthPositions[monthLabels[mi].weekIdx] = monthLabels[mi].label;
    }
    for (var wi = 0; wi < weeks.length; wi++) {
      var monthText = monthPositions[wi] || '';
      // Each month label takes the width of one column (13px + 3px gap)
      html += '<div class="sl-heat-month" style="width: 16px; flex-shrink: 0; text-align: left;">' + monthText + '</div>';
    }
    html += '</div>';

    // Body: day labels + grid
    html += '<div class="sl-heat-body">';

    // Day labels
    html += '<div class="sl-heat-days">';
    for (var dl = 0; dl < dayLabels.length; dl++) {
      html += '<div class="sl-heat-day-label">' + dayLabels[dl] + '</div>';
    }
    html += '</div>';

    // Heat grid — cells flow column-by-column (grid-auto-flow: column is set in CSS)
    html += '<div class="sl-heat-grid">';
    for (var w = 0; w < weeks.length; w++) {
      for (var d = 0; d < weeks[w].length; d++) {
        var cell = weeks[w][d];
        if (cell.isFuture) {
          html += '<div class="sl-heat-cell" style="opacity: 0;"></div>';
        } else {
          var title = cell.dateStr + ': ' + cell.count + ' activit' + (cell.count === 1 ? 'y' : 'ies');
          html += '<div class="sl-heat-cell ' + cell.level + '" title="' + title + '"></div>';
        }
      }
    }
    html += '</div>';

    html += '</div>'; // sl-heat-body
    html += '</div>'; // sl-heat-container

    container.innerHTML = html;
  }

  // ============================================
  // REFERENCE MODULE
  // ============================================

  var glossaryEntries = [];

  function refInit(entries) {
    glossaryEntries = entries;
    refRender('');
  }

  var chapterTitles = {
    1: 'Introduction',
    2: 'Linear Algebra',
    3: 'Probability & Information Theory',
    4: 'Numerical Computation',
    5: 'Machine Learning Basics',
    6: 'Deep Feedforward Networks',
    7: 'Regularization',
    8: 'Optimization',
    9: 'Convolutional Networks',
    10: 'Recurrent Networks'
  };

  function refRender(query) {
    var container = document.getElementById('sl-ref-list');
    if (!container) return;
    container.innerHTML = '';

    var q = (query || '').toLowerCase();
    var filtered = glossaryEntries;
    if (q) {
      filtered = glossaryEntries.filter(function(e) {
        return e.term.toLowerCase().indexOf(q) !== -1 ||
               e.definition.toLowerCase().indexOf(q) !== -1 ||
               (e.tags && e.tags.join(' ').toLowerCase().indexOf(q) !== -1);
      });
    }

    if (filtered.length === 0) {
      container.innerHTML = '<div class="sl-ref-empty">No matching terms found.</div>';
      return;
    }

    // Group entries by chapter
    var groups = {};
    for (var i = 0; i < filtered.length; i++) {
      var ch = filtered[i].chapter || 0;
      if (!groups[ch]) groups[ch] = [];
      groups[ch].push(filtered[i]);
    }

    var sortedChapters = Object.keys(groups).sort(function(a, b) {
      return Number(a) - Number(b);
    });

    // When searching, expand all groups; otherwise collapse them
    var isSearching = q.length > 0;

    for (var ci = 0; ci < sortedChapters.length; ci++) {
      var chapter = sortedChapters[ci];
      var entries = groups[chapter];
      var title = chapterTitles[Number(chapter)] || 'Chapter ' + chapter;

      var group = document.createElement('div');
      group.className = 'sl-ref-group';

      // Chapter header (clickable toggle)
      var header = document.createElement('button');
      header.className = 'sl-ref-group-header' + (isSearching ? ' sl-ref-group-open' : '');
      header.innerHTML =
        '<span class="sl-ref-group-title">Ch. ' + chapter + ' — ' + title + '</span>' +
        '<span class="sl-ref-group-count">' + entries.length + '</span>';

      var itemsDiv = document.createElement('div');
      itemsDiv.className = 'sl-ref-group-items' + (isSearching ? '' : ' sl-hidden');

      header.addEventListener('click', (function(items, btn) {
        return function() {
          items.classList.toggle('sl-hidden');
          btn.classList.toggle('sl-ref-group-open');
        };
      })(itemsDiv, header));

      group.appendChild(header);

      // Render entries within this chapter
      for (var j = 0; j < entries.length; j++) {
        var entry = entries[j];
        var item = document.createElement('div');
        item.className = 'sl-ref-item';

        var termHtml = '<div class="sl-ref-item-header">' +
          '<span class="sl-ref-term">' + inlineFormat(entry.term) + '</span>' +
          '<span class="sl-ref-section">§' + (entry.section || '') + '</span>' +
          '</div>';

        var defText = entry.definition || '';
        var defHtml = '<div class="sl-ref-definition">' + renderText(defText) + '</div>';

        var eqHtml = '';
        if (entry.equations && entry.equations.length > 0) {
          eqHtml = '<div class="sl-ref-equations">';
          for (var e = 0; e < entry.equations.length; e++) {
            eqHtml += '<div class="sl-ref-eq">' + entry.equations[e] + '</div>';
          }
          eqHtml += '</div>';
        }

        var linksHtml = '';
        if ((entry.relatedCards && entry.relatedCards.length > 0) ||
            (entry.relatedQuestions && entry.relatedQuestions.length > 0)) {
          var cardCount = entry.relatedCards ? entry.relatedCards.length : 0;
          var qCount = entry.relatedQuestions ? entry.relatedQuestions.length : 0;
          var parts = [];
          if (cardCount > 0) parts.push(cardCount + ' card' + (cardCount > 1 ? 's' : ''));
          if (qCount > 0) parts.push(qCount + ' question' + (qCount > 1 ? 's' : ''));
          linksHtml = '<div class="sl-ref-links">' + parts.join(' · ') + '</div>';
        }

        item.innerHTML = '<div class="sl-ref-item-collapsed">' + termHtml + '</div>' +
          '<div class="sl-ref-item-detail sl-hidden">' + defHtml + eqHtml + linksHtml + '</div>';

        item.addEventListener('click', function(evt) {
          evt.stopPropagation();
          var detail = this.querySelector('.sl-ref-item-detail');
          if (detail) {
            detail.classList.toggle('sl-hidden');
            if (!detail.classList.contains('sl-hidden')) {
              renderMath(detail);
            }
          }
        });

        itemsDiv.appendChild(item);
      }

      group.appendChild(itemsDiv);
      container.appendChild(group);
    }
  }

  // ============================================
  // EXPLORE MODULE (Chapter Deep Dive)
  // ============================================

  var mapData = null;
  var keyEquations = [];
  var exploreChapter = 1;

  function mapInit(data) {
    mapData = data;
    mapRender();
  }

  function mapRender() {
    var container = document.getElementById('sl-map-container');
    if (!container) return;

    // Build chapter selector + content area
    var chapters = [];
    for (var i = 1; i <= 10; i++) chapters.push(i);

    var html = '';

    // Chapter selector pills
    html += '<div class="sl-explore-chapters">';
    for (var i = 0; i < chapters.length; i++) {
      var ch = chapters[i];
      var active = ch === exploreChapter ? ' sl-explore-ch-active' : '';
      html += '<button class="sl-explore-ch-btn' + active + '" data-chapter="' + ch + '">' +
        'Ch. ' + ch + '</button>';
    }
    html += '</div>';

    // Chapter content
    html += '<div id="sl-explore-content"></div>';

    container.innerHTML = html;

    // Wire chapter buttons
    var btns = container.querySelectorAll('.sl-explore-ch-btn');
    for (var i = 0; i < btns.length; i++) {
      btns[i].addEventListener('click', function() {
        exploreChapter = Number(this.getAttribute('data-chapter'));
        // Update active state
        var allBtns = container.querySelectorAll('.sl-explore-ch-btn');
        for (var j = 0; j < allBtns.length; j++) {
          allBtns[j].classList.remove('sl-explore-ch-active');
        }
        this.classList.add('sl-explore-ch-active');
        renderChapterContent(exploreChapter);
      });
    }

    renderChapterContent(exploreChapter);
  }

  function renderChapterContent(ch) {
    var content = document.getElementById('sl-explore-content');
    if (!content) return;

    var title = chapterTitles[ch] || 'Chapter ' + ch;

    // Gather chapter data
    var chCards = fcAllCards.filter(function(c) { return c.chapter == ch; });
    var chQuestions = mcqAllQuestions.filter(function(q) { return q.chapter == ch; });

    // Calculate mastery
    var fcLearned = 0, fcTotal = chCards.length, fcEaseSum = 0, fcLearnedCount = 0;
    var fcDue = 0;
    for (var i = 0; i < chCards.length; i++) {
      var p = fcProgress[chCards[i].id];
      if (!p) { fcDue++; continue; }
      if (p.repetition >= 1) {
        fcLearned++;
        fcLearnedCount++;
        fcEaseSum += Math.min(p.easeFactor / 2.5, 1);
      }
      if (p.nextReview <= today()) fcDue++;
    }
    var fcMastery = fcLearnedCount > 0 ? fcEaseSum / fcLearnedCount : 0;

    var mcqAttempted = 0, mcqCorrect = 0;
    for (var i = 0; i < chQuestions.length; i++) {
      var qp = mcqProgress[chQuestions[i].id];
      if (qp && qp.answered) {
        mcqAttempted++;
        if (qp.correct) mcqCorrect++;
      }
    }
    var mcqAccuracy = mcqAttempted > 0 ? Math.round((mcqCorrect / mcqAttempted) * 100) : 0;
    var combinedMastery = Math.round((0.6 * fcMastery + 0.4 * (mcqAccuracy / 100)) * 100);

    var html = '';

    // Chapter header
    html += '<div class="sl-explore-header">';
    html += '<div class="sl-explore-title-row">';
    html += '<div>';
    html += '<div class="sl-explore-ch-num">Chapter ' + ch + '</div>';
    html += '<div class="sl-explore-ch-title">' + title + '</div>';
    html += '</div>';
    // Mastery ring
    var circumference = 2 * Math.PI * 30;
    var filled = (combinedMastery / 100) * circumference;
    html += '<div class="sl-explore-ring">';
    html += '<svg viewBox="0 0 70 70" width="70" height="70">';
    html += '<circle cx="35" cy="35" r="30" fill="none" stroke="rgba(255,255,255,0.08)" stroke-width="4"/>';
    html += '<circle cx="35" cy="35" r="30" fill="none" stroke="rgba(255,255,255,0.7)" stroke-width="4" ' +
      'stroke-dasharray="' + filled.toFixed(1) + ' ' + (circumference - filled).toFixed(1) + '" ' +
      'stroke-linecap="round" transform="rotate(-90 35 35)"/>';
    html += '<text x="35" y="38" text-anchor="middle" fill="var(--text)" ' +
      'font-family="var(--font-display)" font-size="14" font-weight="700">' + combinedMastery + '%</text>';
    html += '</svg>';
    html += '</div>';
    html += '</div>';
    html += '</div>';

    // Stats row
    html += '<div class="sl-explore-stats">';
    html += '<div class="sl-explore-stat"><span class="sl-explore-stat-val">' + fcTotal + '</span><span class="sl-explore-stat-lbl">Cards</span></div>';
    html += '<div class="sl-explore-stat"><span class="sl-explore-stat-val">' + fcDue + '</span><span class="sl-explore-stat-lbl">Due</span></div>';
    html += '<div class="sl-explore-stat"><span class="sl-explore-stat-val">' + fcLearned + '</span><span class="sl-explore-stat-lbl">Learned</span></div>';
    html += '<div class="sl-explore-stat"><span class="sl-explore-stat-val">' + chQuestions.length + '</span><span class="sl-explore-stat-lbl">Questions</span></div>';
    html += '<div class="sl-explore-stat"><span class="sl-explore-stat-val">' + mcqAccuracy + '%</span><span class="sl-explore-stat-lbl">Accuracy</span></div>';
    html += '</div>';

    // Concepts from concept map data
    if (mapData) {
      var chNodes = (mapData.nodes || []).filter(function(n) { return n.chapter == ch; });
      if (chNodes.length > 0) {
        html += '<div class="sl-section-label" style="margin-top: 2rem;">Key Concepts</div>';
        html += '<div class="sl-explore-concepts">';
        for (var i = 0; i < chNodes.length; i++) {
          var node = chNodes[i];
          html += '<div class="sl-explore-concept">';
          html += '<div class="sl-explore-concept-name">' + node.label + '</div>';
          if (node.description) {
            html += '<div class="sl-explore-concept-desc">' + node.description + '</div>';
          }
          html += '</div>';
        }
        html += '</div>';
      }
    }

    // Key equations from curated key-equations.json
    var chEquations = keyEquations.filter(function(eq) { return eq.chapter == ch; });
    if (chEquations.length > 0) {
      html += '<div class="sl-section-label" style="margin-top: 2rem;">Key Equations</div>';
      html += '<div class="sl-explore-equations">';
      for (var eqi = 0; eqi < chEquations.length; eqi++) {
        var keq = chEquations[eqi];
        html += '<div class="sl-explore-eq-card">';
        html += '<div class="sl-explore-eq-term">' + keq.name + '</div>';
        html += '<div class="sl-explore-eq-math">' + keq.equation + '</div>';
        if (keq.description) {
          html += '<div class="sl-explore-eq-desc">' + keq.description + '</div>';
        }
        html += '</div>';
      }
      html += '</div>';
    }

    // Recent flashcard performance
    var recentCards = chCards.filter(function(c) {
      var p = fcProgress[c.id];
      return p && p.repetition >= 1;
    }).sort(function(a, b) {
      var pa = fcProgress[a.id], pb = fcProgress[b.id];
      return pa.easeFactor - pb.easeFactor; // weakest first
    });

    if (recentCards.length > 0) {
      var weakest = recentCards.slice(0, Math.min(5, recentCards.length));
      html += '<div class="sl-section-label" style="margin-top: 2rem;">Weakest Cards</div>';
      html += '<div class="sl-explore-weak-list">';
      for (var i = 0; i < weakest.length; i++) {
        var card = weakest[i];
        var cp = fcProgress[card.id];
        var ease = cp ? cp.easeFactor.toFixed(1) : '—';
        var preview = (card.front || '').replace(/\n/g, ' ').replace(/\*\*/g, '');
        if (preview.length > 80) preview = preview.substring(0, 80) + '...';
        html += '<div class="sl-explore-weak-item">';
        html += '<span class="sl-explore-weak-text">' + inlineFormat(preview) + '</span>';
        html += '<span class="sl-explore-weak-ease">EF ' + ease + '</span>';
        html += '</div>';
      }
      html += '</div>';
    }

    content.innerHTML = html;
    renderMath(content);
  }

  // ============================================
  // CROSS-WIRE (Phase 1 stub)
  // ============================================

  function crossWireBump(question) {
    // Find flashcards in same chapter and section
    var chapter = question.chapter;
    var bumped = 0;
    for (var i = 0; i < fcAllCards.length; i++) {
      var card = fcAllCards[i];
      if (card.chapter == chapter && card.section === question.section) {
        var p = fcProgress[card.id];
        if (p) {
          p.nextReview = today();
          bumped++;
        }
      }
    }
    if (bumped > 0) fcSaveProgress();
  }

  // ============================================
  // KEYBOARD
  // ============================================

  function handleKeyboard(e) {
    // Don't intercept when typing in an input
    if (e.target.tagName === 'INPUT') return;

    var studyView = document.getElementById('fc-study-view');
    var browseView = document.getElementById('fc-browse-view');
    var quizView = document.getElementById('mcq-quiz-view');
    var reviewView = document.getElementById('mcq-review-view');

    var inFcStudy = studyView && !studyView.classList.contains('fc-hidden');
    var inFcBrowse = browseView && !browseView.classList.contains('fc-hidden');
    var inMcqQuiz = quizView && !quizView.classList.contains('mcq-hidden');
    var inMcqReview = reviewView && !reviewView.classList.contains('mcq-hidden');

    // Check active tab and sub-views
    if (activeTab === 'review') {
      if (inFcStudy) {
        if (e.key === 'Escape') {
          e.preventDefault();
          fcShowView('fc-dashboard');
          return;
        }
        if (e.code === 'Space') {
          e.preventDefault();
          fcFlipCard();
          return;
        }
        if (fcRatingVisible) {
          var fcKeyMap = { '1': 0, '2': 1, '3': 2, '4': 3 };
          if (fcKeyMap.hasOwnProperty(e.key)) {
            e.preventDefault();
            fcRateCard(fcKeyMap[e.key]);
            return;
          }
        }
        return;
      }
      if (inFcBrowse) {
        if (e.key === 'Escape') {
          e.preventDefault();
          fcShowView('fc-dashboard');
          return;
        }
        return;
      }
      // On fc-dashboard: fall through to tab shortcuts
    }

    if (activeTab === 'quiz') {
      if (inMcqQuiz) {
        if (e.key === 'Escape') {
          e.preventDefault();
          mcqShowView('mcq-dashboard');
          return;
        }
        if (!mcqHasAnswered) {
          var mcqKeyMap = { '1': 0, '2': 1, '3': 2, '4': 3 };
          if (mcqKeyMap.hasOwnProperty(e.key) && mcqQuizIndex < mcqQuizQueue.length) {
            var dIdx = mcqKeyMap[e.key];
            if (dIdx < mcqShuffledChoiceMap.length) {
              e.preventDefault();
              mcqSelectAnswer(dIdx, mcqShuffledChoiceMap[dIdx]);
            }
            return;
          }
        }
        if (mcqHasAnswered && (e.key === 'Enter' || e.code === 'Space')) {
          e.preventDefault();
          mcqNextQuestion();
          return;
        }
        return;
      }
      if (inMcqReview) {
        if (e.key === 'Escape') {
          e.preventDefault();
          mcqShowView('mcq-dashboard');
          return;
        }
        return;
      }
      // On mcq-dashboard: fall through to tab shortcuts
    }

    // Escape on dashboard does nothing
    if (e.key === 'Escape') return;

    // Tab shortcuts — only when on a dashboard (not in a sub-view)
    var inSubView = inFcStudy || inFcBrowse || inMcqQuiz || inMcqReview;
    if (!inSubView) {
      var tabMap = { '1': 'review', '2': 'quiz', '3': 'stats', '4': 'reference', '5': 'map' };
      if (tabMap.hasOwnProperty(e.key)) {
        e.preventDefault();
        switchTab(tabMap[e.key]);
        return;
      }
    }
  }

  // ============================================
  // INIT
  // ============================================

  function init() {
    var app = document.getElementById('sl-app');
    if (!app) return;

    // Load meta
    meta = loadMeta();
    updateStreakDisplay(meta);

    // Wire tab buttons
    var tabBtns = app.querySelectorAll('.sl-tab');
    for (var i = 0; i < tabBtns.length; i++) {
      tabBtns[i].addEventListener('click', (function (name) {
        return function () { switchTab(name); };
      })(tabBtns[i].getAttribute('data-tab')));
    }

    // Derive base path for data fetching
    var scriptEls = document.querySelectorAll('script[src*="study-lab"]');
    var basePath = '/';
    if (scriptEls.length) {
      var src = scriptEls[0].getAttribute('src');
      basePath = src.replace(/js\/study-lab\.js.*$/, '');
    }

    // Fetch both data files in parallel
    var fcPromise = fetch(basePath + 'data/flashcards.json')
      .then(function (res) { return res.json(); })
      .then(function (data) { return data.cards || data; })
      .catch(function (err) { console.error('Flashcards load error:', err); return []; });

    var mcqPromise = fetch(basePath + 'data/mcq.json')
      .then(function (res) { return res.json(); })
      .then(function (data) { return data.questions || data; })
      .catch(function (err) { console.error('MCQ load error:', err); return []; });

    var glossaryPromise = fetch(basePath + 'data/glossary.json')
      .then(function(res) { return res.json(); })
      .then(function(data) { return data.entries || data; })
      .catch(function(err) { console.error('Glossary load error:', err); return []; });

    var mapPromise = fetch(basePath + 'data/concept-map.json')
      .then(function(res) { return res.json(); })
      .catch(function(err) { console.error('Concept map load error:', err); return null; });

    var eqPromise = fetch(basePath + 'data/key-equations.json')
      .then(function(res) { return res.json(); })
      .then(function(data) { return data.equations || []; })
      .catch(function(err) { console.error('Key equations load error:', err); return []; });

    Promise.all([fcPromise, mcqPromise, glossaryPromise, mapPromise, eqPromise]).then(function (results) {
      fcInit(results[0]);
      mcqInit(results[1]);
      refInit(results[2]);
      if (results[3]) mapInit(results[3]);
      keyEquations = results[4] || [];

      // Wire reference search
      var refSearch = document.getElementById('sl-ref-search');
      if (refSearch) {
        refSearch.addEventListener('input', function() {
          refRender(this.value);
        });
      }

      // Show last used tab or default to stats
      var startTab = meta.lastTab || 'stats';
      switchTab(startTab);
    });

    // Single keyboard handler
    document.addEventListener('keydown', handleKeyboard);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
