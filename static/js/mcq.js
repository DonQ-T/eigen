/* ============================================
   Multiple Choice Quiz App
   Fetches question data from /data/mcq.json
   Stores per-question progress in localStorage
   KaTeX math rendering via global renderMathInElement
   ============================================ */

(function () {
  'use strict';

  // ============================================
  // STATE
  // ============================================

  var allQuestions = [];
  var progress = {};
  var quizQueue = [];
  var quizIndex = 0;
  var hasAnswered = false;
  var selectedChapters = new Set();
  var shuffledChoiceMap = []; // maps display index -> original index for current question

  var STORAGE_KEY = 'mcq-progress';

  // ============================================
  // UTILITIES
  // ============================================

  function shuffle(arr) {
    for (var i = arr.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var tmp = arr[i];
      arr[i] = arr[j];
      arr[j] = tmp;
    }
    return arr;
  }

  /** Convert text to HTML: bold, code, line breaks, bullet lists */
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
  // PERSISTENCE
  // ============================================

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

  function resetProgress() {
    progress = {};
    saveProgress();
    updateDashboard();
  }

  // ============================================
  // DATA & STATS
  // ============================================

  function getChapters() {
    var chapters = {};
    for (var i = 0; i < allQuestions.length; i++) {
      var ch = allQuestions[i].chapter || 'Unknown';
      chapters[ch] = (chapters[ch] || 0) + 1;
    }
    return chapters;
  }

  function getFilteredQuestions() {
    if (selectedChapters.size === 0) return allQuestions;
    return allQuestions.filter(function (q) {
      return selectedChapters.has(q.chapter);
    });
  }

  function computeStats() {
    var filtered = getFilteredQuestions();
    var attempted = 0;
    var correct = 0;

    for (var i = 0; i < filtered.length; i++) {
      var p = progress[filtered[i].id];
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

  function getIncorrectQuestions() {
    var filtered = getFilteredQuestions();
    var incorrect = [];
    for (var i = 0; i < filtered.length; i++) {
      var p = progress[filtered[i].id];
      if (p && p.answered && !p.correct) {
        incorrect.push(filtered[i]);
      }
    }
    return incorrect;
  }

  // ============================================
  // VIEW SWITCHING
  // ============================================

  function showView(viewId) {
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
      updateDashboard();
    }
  }

  // ============================================
  // DASHBOARD
  // ============================================

  function updateDashboard() {
    var stats = computeStats();

    var elTotal = document.getElementById('mcq-stat-total');
    var elAttempted = document.getElementById('mcq-stat-attempted');
    var elCorrect = document.getElementById('mcq-stat-correct');
    var elAccuracy = document.getElementById('mcq-stat-accuracy');

    if (elTotal) elTotal.textContent = stats.total;
    if (elAttempted) elAttempted.textContent = stats.attempted;
    if (elCorrect) elCorrect.textContent = stats.correct;
    if (elAccuracy) elAccuracy.textContent = stats.accuracy + '%';
  }

  function buildChapterFilters() {
    var container = document.getElementById('mcq-chapter-filters');
    if (!container) return;
    container.innerHTML = '';

    var chapters = getChapters();
    var sortedKeys = Object.keys(chapters).sort(function (a, b) {
      return Number(a) - Number(b);
    });

    for (var i = 0; i < sortedKeys.length; i++) {
      var ch = sortedKeys[i];
      var label = document.createElement('label');
      label.className = 'mcq-chapter-filter';

      var checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.value = ch;
      checkbox.checked = selectedChapters.size === 0 || selectedChapters.has(ch);

      checkbox.addEventListener('change', (function (chapter) {
        return function (e) {
          var numCh = Number(chapter);
          if (e.target.checked) {
            selectedChapters.add(numCh);
          } else {
            selectedChapters.delete(numCh);
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
  // QUIZ VIEW
  // ============================================

  function startQuiz(reviewMode) {
    var questions;
    if (reviewMode) {
      questions = getIncorrectQuestions();
      if (questions.length === 0) {
        alert('No incorrect questions to review. Get some wrong first!');
        return;
      }
    } else {
      questions = getFilteredQuestions().slice();
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

    quizQueue = questions;
    quizIndex = 0;
    hasAnswered = false;

    showView('mcq-quiz-view');
    showCurrentQuestion();
  }

  function showCurrentQuestion() {
    if (quizIndex >= quizQueue.length) {
      showCompletion();
      return;
    }

    hasAnswered = false;
    var q = quizQueue[quizIndex];

    // Update progress text
    var progressText = document.getElementById('mcq-progress-text');
    if (progressText) {
      progressText.textContent = (quizIndex + 1) + ' / ' + quizQueue.length;
    }

    // Render question text
    var questionEl = document.getElementById('mcq-question-text');
    if (questionEl) {
      questionEl.innerHTML = renderText(q.question);
      renderMath(questionEl);
    }

    // Shuffle choices: create a mapping from display position -> original index
    shuffledChoiceMap = [];
    for (var i = 0; i < q.choices.length; i++) {
      shuffledChoiceMap.push(i);
    }
    shuffle(shuffledChoiceMap);

    // Render choice buttons
    var choicesEl = document.getElementById('mcq-choices');
    if (choicesEl) {
      choicesEl.innerHTML = '';
      var letters = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];

      for (var d = 0; d < shuffledChoiceMap.length; d++) {
        var origIdx = shuffledChoiceMap[d];
        var btn = document.createElement('button');
        btn.className = 'mcq-choice';
        btn.setAttribute('data-display-index', d);
        btn.setAttribute('data-original-index', origIdx);

        var letterSpan = document.createElement('span');
        letterSpan.className = 'mcq-choice-letter';
        letterSpan.textContent = letters[d];

        var textSpan = document.createElement('span');
        textSpan.className = 'mcq-choice-text';
        textSpan.innerHTML = renderText(q.choices[origIdx]);

        btn.appendChild(letterSpan);
        btn.appendChild(textSpan);

        btn.addEventListener('click', (function (displayIdx, originalIdx) {
          return function () { selectAnswer(displayIdx, originalIdx); };
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

  function selectAnswer(displayIdx, originalIdx) {
    if (hasAnswered) return;
    hasAnswered = true;

    var q = quizQueue[quizIndex];
    var isCorrect = originalIdx === q.correct;

    // Save progress
    progress[q.id] = {
      answered: true,
      selectedChoice: originalIdx,
      correct: isCorrect
    };
    saveProgress();

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

  function nextQuestion() {
    if (!hasAnswered) return;
    quizIndex++;
    showCurrentQuestion();
  }

  function showCompletion() {
    var questionEl = document.getElementById('mcq-question-text');
    var choicesEl = document.getElementById('mcq-choices');
    var explanationEl = document.getElementById('mcq-explanation');
    var nextBtn = document.getElementById('mcq-next-btn');
    var progressText = document.getElementById('mcq-progress-text');

    // Count results for this session
    var sessionCorrect = 0;
    for (var i = 0; i < quizQueue.length; i++) {
      var p = progress[quizQueue[i].id];
      if (p && p.correct) sessionCorrect++;
    }

    if (questionEl) {
      questionEl.innerHTML =
        '<div class="mcq-completion">' +
        '<strong>Quiz complete!</strong><br><br>' +
        'You got ' + sessionCorrect + ' / ' + quizQueue.length + ' correct ' +
        '(' + Math.round((sessionCorrect / quizQueue.length) * 100) + '%).' +
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

  // ============================================
  // REVIEW VIEW
  // ============================================

  function showReview() {
    var incorrect = getIncorrectQuestions();

    if (incorrect.length === 0) {
      alert('No incorrect questions to review.');
      return;
    }

    showView('mcq-review-view');

    var listEl = document.getElementById('mcq-review-list');
    if (!listEl) return;
    listEl.innerHTML = '';

    for (var i = 0; i < incorrect.length; i++) {
      var q = incorrect[i];
      var p = progress[q.id];
      var letters = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];

      var item = document.createElement('div');
      item.className = 'mcq-review-item';

      var questionHtml = '<div class="mcq-review-question">' +
        '<span class="mcq-chapter-tag">' + (q.chapter || '') + '</span> ' +
        renderText(q.question) +
        '</div>';

      var yourAnswer = p && typeof p.selectedChoice === 'number' && q.choices[p.selectedChoice]
        ? q.choices[p.selectedChoice]
        : 'N/A';
      var correctAnswer = q.choices[q.correct] || 'N/A';

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

  // ============================================
  // KEYBOARD SHORTCUTS
  // ============================================

  function handleKeyboard(e) {
    var quizView = document.getElementById('mcq-quiz-view');

    // Escape: back to dashboard from any view
    if (e.key === 'Escape') {
      showView('mcq-dashboard');
      e.preventDefault();
      return;
    }

    // Quiz view shortcuts
    if (quizView && !quizView.classList.contains('mcq-hidden')) {
      // 1-4 to select answer
      if (!hasAnswered) {
        var keyMap = { '1': 0, '2': 1, '3': 2, '4': 3 };
        if (keyMap.hasOwnProperty(e.key) && quizIndex < quizQueue.length) {
          var displayIdx = keyMap[e.key];
          var q = quizQueue[quizIndex];
          if (displayIdx < shuffledChoiceMap.length) {
            e.preventDefault();
            selectAnswer(displayIdx, shuffledChoiceMap[displayIdx]);
          }
          return;
        }
      }

      // Enter or Space for next
      if (hasAnswered && (e.key === 'Enter' || e.code === 'Space')) {
        e.preventDefault();
        nextQuestion();
        return;
      }
    }
  }

  // ============================================
  // INIT
  // ============================================

  function init() {
    // Check that at least the dashboard element exists
    var dashboard = document.getElementById('mcq-dashboard');
    if (!dashboard) return;

    loadProgress();

    // Fetch question data — derive base path so it works under any subpath
    var scriptEls = document.querySelectorAll('script[src*="mcq.js"]');
    var basePath = '/';
    if (scriptEls.length) {
      var src = scriptEls[0].getAttribute('src');
      basePath = src.replace(/js\/mcq\.js.*$/, '');
    }

    fetch(basePath + 'data/mcq.json')
      .then(function (res) {
        if (!res.ok) throw new Error('Failed to load questions: ' + res.status);
        return res.json();
      })
      .then(function (data) {
        allQuestions = data.questions || data;
        buildChapterFilters();
        updateDashboard();
        showView('mcq-dashboard');
      })
      .catch(function (err) {
        console.error(err);
        if (dashboard) {
          dashboard.innerHTML = '<p style="color:red;">Error loading questions: ' + err.message + '</p>';
        }
      });

    // Button events
    var startBtn = document.getElementById('mcq-start-btn');
    var reviewBtn = document.getElementById('mcq-review-btn');
    var resetBtn = document.getElementById('mcq-reset-btn');
    var nextBtn = document.getElementById('mcq-next-btn');
    var quitBtn = document.getElementById('mcq-quit-btn');
    var reviewBackBtn = document.getElementById('mcq-review-back-btn');

    if (startBtn) startBtn.addEventListener('click', function () { startQuiz(false); });
    if (reviewBtn) reviewBtn.addEventListener('click', showReview);
    if (resetBtn) resetBtn.addEventListener('click', function () {
      if (confirm('Reset all quiz progress? This cannot be undone.')) {
        resetProgress();
      }
    });
    if (nextBtn) nextBtn.addEventListener('click', nextQuestion);
    if (quitBtn) quitBtn.addEventListener('click', function () { showView('mcq-dashboard'); });
    if (reviewBackBtn) reviewBackBtn.addEventListener('click', function () { showView('mcq-dashboard'); });

    // Keyboard shortcuts
    document.addEventListener('keydown', handleKeyboard);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
