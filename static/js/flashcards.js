/* ============================================
   Flashcard App with SM-2 Spaced Repetition
   Fetches card data from /data/flashcards.json
   Stores per-card progress in localStorage
   KaTeX math rendering via global renderMathInElement
   ============================================ */

(function () {
  'use strict';

  // ============================================
  // STATE
  // ============================================

  var allCards = [];
  var progress = {};
  var studyQueue = [];
  var studyIndex = 0;
  var isFlipped = false;
  var ratingVisible = false;
  var selectedChapters = new Set();

  var STORAGE_KEY = 'fc-progress';

  // ============================================
  // UTILITIES
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

  /** Convert card text to HTML: bold, code, line breaks, bullet lists */
  function renderCardText(text) {
    if (!text) return '';
    // Split on literal \n (the JSON string has actual newline chars)
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
    // Bold: **text**
    str = str.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    // Inline code: `text`
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
  // SM-2 ENGINE
  // ============================================

  function getCardProgress(id) {
    if (progress[id]) return progress[id];
    return { easeFactor: 2.5, interval: 0, repetition: 0, nextReview: today() };
  }

  function applyRating(id, quality) {
    var p = getCardProgress(id);
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

    progress[id] = {
      easeFactor: ef,
      interval: interval,
      repetition: rep,
      nextReview: nextReview
    };

    saveProgress();
  }

  /** Predict the interval that would result from a given rating */
  function predictInterval(id, quality) {
    var p = getCardProgress(id);
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

  function formatInterval(days) {
    if (days === 0) return '< 1 min';
    if (days === 1) return '1d';
    if (days < 30) return days + 'd';
    if (days < 365) return Math.round(days / 30) + 'mo';
    return (days / 365).toFixed(1) + 'y';
  }

  function loadProgress() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (raw) progress = JSON.parse(raw);
    } catch (e) {
      progress = {};
    }
  }

  function saveProgress() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
    } catch (e) {
      // localStorage full or unavailable
    }
  }

  // ============================================
  // DATA & STATS
  // ============================================

  function getChapters() {
    var chapters = {};
    for (var i = 0; i < allCards.length; i++) {
      var ch = allCards[i].chapter || 'Unknown';
      chapters[ch] = (chapters[ch] || 0) + 1;
    }
    return chapters;
  }

  function getFilteredCards() {
    if (selectedChapters.size === 0) return allCards;
    return allCards.filter(function (c) {
      return selectedChapters.has(c.chapter);
    });
  }

  function isDue(card) {
    var p = progress[card.id];
    if (!p) return true; // new card = due
    return p.nextReview <= today();
  }

  function getDueCards() {
    return getFilteredCards().filter(isDue);
  }

  function computeStats() {
    var filtered = getFilteredCards();
    var due = 0;
    var learned = 0;
    var newCount = 0;

    for (var i = 0; i < filtered.length; i++) {
      var p = progress[filtered[i].id];
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

  // ============================================
  // VIEW SWITCHING
  // ============================================

  function showView(viewId) {
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
      updateDashboard();
    }
  }

  // ============================================
  // DASHBOARD
  // ============================================

  function updateDashboard() {
    var stats = computeStats();

    var elTotal = document.getElementById('fc-stat-total');
    var elDue = document.getElementById('fc-stat-due');
    var elLearned = document.getElementById('fc-stat-learned');
    var elNew = document.getElementById('fc-stat-new');

    if (elTotal) elTotal.textContent = stats.total;
    if (elDue) elDue.textContent = stats.due;
    if (elLearned) elLearned.textContent = stats.learned;
    if (elNew) elNew.textContent = stats.newCards;
  }

  function buildChapterFilters() {
    var container = document.getElementById('fc-chapter-filters');
    if (!container) return;
    container.innerHTML = '';

    var chapters = getChapters();
    var sortedKeys = Object.keys(chapters).sort();

    for (var i = 0; i < sortedKeys.length; i++) {
      var ch = sortedKeys[i];
      var label = document.createElement('label');
      label.className = 'fc-chapter-filter';

      var checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.value = ch;
      checkbox.checked = selectedChapters.size === 0 || selectedChapters.has(ch);

      checkbox.addEventListener('change', (function (chapter) {
        return function (e) {
          if (e.target.checked) {
            selectedChapters.add(chapter);
          } else {
            selectedChapters.delete(chapter);
          }
          // If all are checked or none are checked, treat as "all"
          var allChecked = container.querySelectorAll('input[type="checkbox"]');
          var checkedCount = container.querySelectorAll('input[type="checkbox"]:checked').length;
          if (checkedCount === allChecked.length || checkedCount === 0) {
            selectedChapters.clear();
          }
          updateDashboard();
        };
      })(ch));

      label.appendChild(checkbox);
      label.appendChild(document.createTextNode(' ' + ch + ' (' + chapters[ch] + ')'));
      container.appendChild(label);
    }
  }

  // ============================================
  // STUDY VIEW
  // ============================================

  function startStudy(onlyDue) {
    var cards;
    if (onlyDue) {
      cards = getDueCards();
    } else {
      cards = getFilteredCards().slice();
    }

    if (cards.length === 0) {
      alert('No cards to study. Check your chapter filters or come back when cards are due.');
      return;
    }

    studyQueue = shuffle(cards);
    studyIndex = 0;
    isFlipped = false;
    ratingVisible = false;

    showView('fc-study-view');
    showCurrentCard();
  }

  function showCurrentCard() {
    if (studyIndex >= studyQueue.length) {
      showCompletion();
      return;
    }

    var card = studyQueue[studyIndex];
    isFlipped = false;
    ratingVisible = false;

    var cardEl = document.getElementById('fc-card');
    if (cardEl) cardEl.classList.remove('fc-card-flipped');

    var frontEl = document.getElementById('fc-card-front');
    var backEl = document.getElementById('fc-card-back');
    var ratingRow = document.getElementById('fc-rating-row');
    var progressText = document.getElementById('fc-progress-text');

    if (frontEl) {
      frontEl.innerHTML = '<div class="fc-card-content">' +
        '<span class="fc-chapter-tag">' + (card.chapter || '') + '</span>' +
        renderCardText(card.front) +
        '</div>';
      renderMath(frontEl);
    }

    if (backEl) {
      backEl.innerHTML = '<div class="fc-card-content">' +
        renderCardText(card.back) +
        '</div>';
      renderMath(backEl);
    }

    if (ratingRow) ratingRow.classList.add('fc-hidden');

    if (progressText) {
      progressText.textContent = (studyIndex + 1) + ' / ' + studyQueue.length;
    }
  }

  function flipCard() {
    if (studyIndex >= studyQueue.length) return;

    var cardEl = document.getElementById('fc-card');
    var ratingRow = document.getElementById('fc-rating-row');

    if (isFlipped) {
      // Flip back to front
      isFlipped = false;
      if (cardEl) cardEl.classList.remove('fc-card-flipped');
      if (ratingRow) ratingRow.classList.add('fc-hidden');
      ratingVisible = false;
    } else {
      // Flip to back
      isFlipped = true;
      ratingVisible = true;
      if (cardEl) cardEl.classList.add('fc-card-flipped');
      if (ratingRow) {
        ratingRow.classList.remove('fc-hidden');
        updateRatingButtons();
      }
    }
  }

  function updateRatingButtons() {
    if (studyIndex >= studyQueue.length) return;
    var card = studyQueue[studyIndex];
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
        return function () { rateCard(quality); };
      })(q));

      ratingRow.appendChild(btn);
    }
  }

  function rateCard(quality) {
    if (!ratingVisible || studyIndex >= studyQueue.length) return;
    var card = studyQueue[studyIndex];
    applyRating(card.id, quality);

    studyIndex++;
    showCurrentCard();
  }

  function showCompletion() {
    var frontEl = document.getElementById('fc-card-front');
    var backEl = document.getElementById('fc-card-back');
    var cardEl = document.getElementById('fc-card');
    var ratingRow = document.getElementById('fc-rating-row');
    var progressText = document.getElementById('fc-progress-text');

    if (cardEl) cardEl.classList.remove('fc-card-flipped');

    if (frontEl) {
      frontEl.innerHTML = '<div class="fc-card-content">' +
        '<strong>Session complete!</strong><br><br>' +
        'You reviewed ' + studyQueue.length + ' card' + (studyQueue.length === 1 ? '' : 's') + '.' +
        '</div>';
    }
    if (backEl) backEl.innerHTML = '';
    if (ratingRow) ratingRow.classList.add('fc-hidden');
    if (progressText) progressText.textContent = 'Done';

    isFlipped = false;
    ratingVisible = false;
  }

  // ============================================
  // BROWSE VIEW
  // ============================================

  function showBrowse() {
    showView('fc-browse-view');
    var searchInput = document.getElementById('fc-search-input');
    if (searchInput) searchInput.value = '';
    renderBrowseList('');
  }

  function renderBrowseList(query) {
    var list = document.getElementById('fc-browse-list');
    if (!list) return;
    list.innerHTML = '';

    var filtered = getFilteredCards();
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

      var p = progress[card.id];
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
          '<div class="fc-browse-front"><strong>Q:</strong> ' + renderCardText(front) + '</div>' +
          '<div class="fc-browse-back"><strong>A:</strong> ' + renderCardText(back) + '</div>' +
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

  // ============================================
  // KEYBOARD SHORTCUTS
  // ============================================

  function handleKeyboard(e) {
    // Only act if study view or browse view is visible
    var studyView = document.getElementById('fc-study-view');
    var browseView = document.getElementById('fc-browse-view');

    // Escape: back to dashboard from any view
    if (e.key === 'Escape') {
      showView('fc-dashboard');
      e.preventDefault();
      return;
    }

    // Study view shortcuts
    if (studyView && !studyView.classList.contains('fc-hidden')) {
      if (e.code === 'Space') {
        e.preventDefault();
        flipCard();
        return;
      }

      if (ratingVisible) {
        var keyMap = { '1': 0, '2': 1, '3': 2, '4': 3 };
        if (keyMap.hasOwnProperty(e.key)) {
          e.preventDefault();
          rateCard(keyMap[e.key]);
          return;
        }
      }
    }
  }

  // ============================================
  // INIT
  // ============================================

  function init() {
    var container = document.getElementById('fc-app');
    if (!container) return;

    loadProgress();

    // Fetch card data — derive base path so it works under /eigen/ or any subpath
    var scriptEls = document.querySelectorAll('script[src*="flashcards.js"]');
    var basePath = '/';
    if (scriptEls.length) {
      var src = scriptEls[0].getAttribute('src');
      basePath = src.replace(/js\/flashcards\.js.*$/, '');
    }
    fetch(basePath + 'data/flashcards.json')
      .then(function (res) {
        if (!res.ok) throw new Error('Failed to load flashcards: ' + res.status);
        return res.json();
      })
      .then(function (data) {
        allCards = data.cards || data;
        buildChapterFilters();
        updateDashboard();
        showView('fc-dashboard');
      })
      .catch(function (err) {
        console.error(err);
        var dash = document.getElementById('fc-dashboard');
        if (dash) {
          dash.innerHTML = '<p style="color:red;">Error loading flashcards: ' + err.message + '</p>';
        }
      });

    // Button events
    var studyBtn = document.getElementById('fc-study-btn');
    var studyAllBtn = document.getElementById('fc-study-all-btn');
    var browseBtn = document.getElementById('fc-browse-btn');
    var backBtn = document.getElementById('fc-back-btn');
    var flipBtn = document.getElementById('fc-flip-btn');
    var browseBackBtn = document.getElementById('fc-browse-back-btn');
    var searchInput = document.getElementById('fc-search-input');

    if (studyBtn) studyBtn.addEventListener('click', function () { startStudy(true); });
    if (studyAllBtn) studyAllBtn.addEventListener('click', function () { startStudy(false); });
    if (flipBtn) flipBtn.addEventListener('click', flipCard);
    if (browseBtn) browseBtn.addEventListener('click', showBrowse);
    if (backBtn) backBtn.addEventListener('click', function () { showView('fc-dashboard'); });
    if (browseBackBtn) browseBackBtn.addEventListener('click', function () { showView('fc-dashboard'); });

    if (searchInput) {
      searchInput.addEventListener('input', function () {
        renderBrowseList(this.value);
      });
    }

    // Card flip on click
    var cardContainer = document.getElementById('fc-card-container');
    if (cardContainer) {
      cardContainer.addEventListener('click', flipCard);
    }

    // Keyboard shortcuts
    document.addEventListener('keydown', handleKeyboard);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
