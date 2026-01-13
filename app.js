const ui = {
  questionEl: document.getElementById('question'),
  optionsEl: document.getElementById('options'),
  feedbackEl: document.getElementById('feedback'),
  nextBtn: document.getElementById('next'),
  buildBadgeEl: document.getElementById('build-badge'),
  filtersForm: document.getElementById('filters'),
  gradeSelect: document.getElementById('grade'),
  subjectSelect: document.getElementById('subject'),
  topicSelect: document.getElementById('topic'),
  countInput: document.getElementById('count'),
  startBtn: document.getElementById('start'),
  filterFeedbackEl: document.getElementById('filter-feedback'),
  quizArea: document.getElementById('quiz-area'),
  homeBtn: document.getElementById('home'),
  summaryEl: document.getElementById('summary'),
  summaryScoreEl: document.getElementById('summary-score'),
  summaryCorrectEl: document.getElementById('summary-correct'),
  summaryWrongEl: document.getElementById('summary-wrong'),
  summaryTotalEl: document.getElementById('summary-total'),
  summaryListEl: document.getElementById('summary-list')
};

// Single source of truth for cache-busting across manifest + service worker.
// Bump this when you deploy changes that iOS Safari might aggressively cache.
const BUILD_ID = '10';

function getServiceWorkerVersionFromController() {
  try {
    const controller = navigator.serviceWorker?.controller;
    if (!controller?.scriptURL) return null;
    const url = new URL(controller.scriptURL);
    return url.searchParams.get('v');
  } catch {
    return null;
  }
}

function renderBuildBadge() {
  if (!ui.buildBadgeEl) return;

  const swVersion = getServiceWorkerVersionFromController();
  const swLabel = swVersion ? `sw ${swVersion}` : (navigator.serviceWorker ? 'sw —' : 'sw off');
  ui.buildBadgeEl.textContent = `v${BUILD_ID}`;
  ui.buildBadgeEl.title = `build ${BUILD_ID} • ${swLabel} (click to copy)`;
}

async function copyBuildInfoToClipboard() {
  const swVersion = getServiceWorkerVersionFromController();
  const text = [
    `build=${BUILD_ID}`,
    `sw=${swVersion || 'none'}`,
    `url=${window.location.href}`
  ].join(' ');

  try {
    await navigator.clipboard.writeText(text);
    ui.buildBadgeEl.textContent = 'copied';
    setTimeout(renderBuildBadge, 900);
  } catch {
    // Clipboard can fail on iOS depending on context; fall back to just selecting.
    ui.buildBadgeEl.textContent = text;
  }
}

function initBuildBadge() {
  if (!ui.buildBadgeEl) return;

  renderBuildBadge();
  ui.buildBadgeEl.addEventListener('click', () => void copyBuildInfoToClipboard());

  if (navigator.serviceWorker) {
    navigator.serviceWorker.addEventListener('controllerchange', () => renderBuildBadge());
  }
}

const state = {
  allQuestions: [],
  questions: [],
  currentIndex: 0,
  answered: false,
  results: {
    responses: [],
    correct: 0,
    total: 0
  }
};

let filtersBound = false;

function setFilterFeedback(message) {
  if (!ui.filterFeedbackEl) return;
  ui.filterFeedbackEl.textContent = message;
}

function setFeedback(message, variant) {
  ui.feedbackEl.textContent = message;
  ui.feedbackEl.className = variant ? `feedback ${variant}` : 'feedback';
}

function setNextVisible(visible) {
  ui.nextBtn.hidden = !visible;
}

function disableOptions() {
  ui.optionsEl.querySelectorAll('button').forEach(b => { b.disabled = true; });
}

function showQuizArea(show) {
  if (!ui.quizArea) return;
  ui.quizArea.hidden = !show;
}

function showFilters(show) {
  if (!ui.filtersForm) return;
  ui.filtersForm.hidden = !show;
  ui.filtersForm.style.display = show ? 'grid' : 'none';
}

function showHome(show) {
  if (!ui.homeBtn) return;
  ui.homeBtn.hidden = !show;
}

function showSummary(show) {
  if (!ui.summaryEl) return;
  ui.summaryEl.hidden = !show;
}

function resetQuizUi(message) {
  ui.questionEl.textContent = message;
  ui.optionsEl.innerHTML = '';
  setFeedback('', '');
  setNextVisible(false);
  state.answered = false;
}

function resetResults() {
  state.results = { responses: [], correct: 0, total: 0 };
}

function applyBuildIdToManifestLink() {
  const manifestLink = document.querySelector('link[rel="manifest"]');
  if (!manifestLink) return;

  const href = manifestLink.getAttribute('href') || 'manifest.json';
  // Resolve relative to document URL so this works in subfolders.
  const url = new URL(href, window.location.href);
  url.searchParams.set('v', BUILD_ID);
  manifestLink.setAttribute('href', url.toString());
}

function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  window.addEventListener('load', () => {
    const swUrl = new URL('service-worker.js', window.location.href);
    swUrl.searchParams.set('v', BUILD_ID);
    navigator.serviceWorker.register(swUrl.toString())
      .catch(err => console.log('Service Worker registration failed:', err));
  });
}

function normalizeQuestions(data) {
  if (!Array.isArray(data)) return [];
  return data
    .filter(q => q && typeof q.question === 'string' && Array.isArray(q.options) && typeof q.answer === 'number')
    .map(q => ({
      grade: String(q.grade || '').trim(),
      subject: String(q.subject || '').trim(),
      topic: String(q.topic || '').trim(),
      question: q.question,
      options: q.options.map(String),
      answer: q.answer
    }));
}

function uniqueValues(list, key, predicate) {
  const values = new Set();
  list.forEach(item => {
    if (!item) return;
    if (predicate && !predicate(item)) return;
    const value = item[key];
    if (typeof value === 'string' && value.trim()) {
      values.add(value.trim());
    }
  });
  return Array.from(values).sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));
}

function populateSelect(selectEl, values, placeholder, defaultValue = '') {
  if (!selectEl) return;
  const previousValue = selectEl.value;
  selectEl.innerHTML = '';

  const defaultOption = document.createElement('option');
  defaultOption.value = defaultValue;
  defaultOption.textContent = placeholder;
  selectEl.appendChild(defaultOption);

  values.forEach(value => {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = value;
    selectEl.appendChild(option);
  });

  const canRestore = previousValue && values.includes(previousValue);
  selectEl.value = canRestore ? previousValue : defaultValue;
  selectEl.disabled = !values.length && !defaultValue;
}

function shuffle(list) {
  const arr = list.slice();
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function normalizeFilterValue(value) {
  return value === '__all__' ? '' : (value || '');
}

function handleGradeChange() {
  const rawGrade = ui.gradeSelect?.value || '';
  const grade = normalizeFilterValue(rawGrade);

  if (!rawGrade) {
    // Keep subject/topic gated until a grade is chosen so filters stay in a clear hierarchy.
    populateSelect(ui.subjectSelect, [], 'All subjects', '__all__');
    populateSelect(ui.topicSelect, [], 'All topics', '__all__');
    ui.subjectSelect.disabled = true;
    ui.topicSelect.disabled = true;
    return;
  }

  const subjects = uniqueValues(state.allQuestions, 'subject', q => !grade || q.grade === grade);
  populateSelect(ui.subjectSelect, subjects, 'All subjects', '__all__');
  populateSelect(ui.topicSelect, [], 'All topics', '__all__');
  ui.subjectSelect.disabled = !subjects.length;
  ui.topicSelect.disabled = true;

  if (subjects.length) {
    // Auto-refresh topics for the current subject selection when grade changes.
    handleSubjectChange();
  }
}

function handleSubjectChange() {
  const grade = normalizeFilterValue(ui.gradeSelect?.value || '');
  const subject = normalizeFilterValue(ui.subjectSelect?.value || '');
  const topics = uniqueValues(
    state.allQuestions,
    'topic',
    q => (!grade || q.grade === grade) && (!subject || q.subject === subject)
  );
  populateSelect(ui.topicSelect, topics, 'All topics', '__all__');
  ui.topicSelect.disabled = !topics.length;
}

function buildFilters() {
  const grades = uniqueValues(state.allQuestions, 'grade');
  populateSelect(ui.gradeSelect, grades, 'All grades', '__all__');

  if (!filtersBound) {
    ui.gradeSelect?.addEventListener('change', () => {
      setFilterFeedback('');
      handleGradeChange();
    });
    ui.subjectSelect?.addEventListener('change', () => {
      setFilterFeedback('');
      handleSubjectChange();
    });
    ui.filtersForm?.addEventListener('submit', startSession);
    filtersBound = true;
  }

  handleGradeChange();
}

function getFilteredQuestions(filters) {
  return state.allQuestions.filter(q =>
    (!filters.grade || q.grade === filters.grade) &&
    (!filters.subject || q.subject === filters.subject) &&
    (!filters.topic || q.topic === filters.topic)
  );
}

function showReadyState() {
  showQuizArea(false);
  showFilters(true);
  showHome(false);
  showSummary(false);
  state.questions = [];
  resetResults();
  resetQuizUi('Choose filters to begin.');
}

function renderSummary() {
  if (!ui.summaryEl) return;

  const total = state.results.total || state.questions.length || 0;
  const correct = state.results.correct;
  const wrong = Math.max(total - correct, 0);
  const percent = total ? Math.round((correct / total) * 100) : 0;

  if (ui.summaryScoreEl) ui.summaryScoreEl.textContent = `${percent}%`;
  if (ui.summaryCorrectEl) ui.summaryCorrectEl.textContent = String(correct);
  if (ui.summaryWrongEl) ui.summaryWrongEl.textContent = String(wrong);
  if (ui.summaryTotalEl) ui.summaryTotalEl.textContent = String(total);

  if (ui.summaryListEl) {
    ui.summaryListEl.innerHTML = '';
    state.results.responses.forEach((resp, idx) => {
      const item = document.createElement('div');
      item.className = 'summary-item';

      const qEl = document.createElement('div');
      qEl.className = 'summary-question';
      qEl.textContent = `${idx + 1}. ${resp.question}`;
      item.appendChild(qEl);

      const meta = document.createElement('div');
      meta.className = 'summary-meta';
      const userAnswer = resp.options[resp.chosen] ?? '—';
      const correctAnswer = resp.options[resp.correctIndex] ?? '—';
      if (resp.correct) {
        meta.innerHTML = `<span class="summary-correct">Correct</span> • Your answer: ${userAnswer}`;
      } else {
        meta.innerHTML = `<span class="summary-wrong">Wrong</span> • Your answer: ${userAnswer} • Correct: ${correctAnswer}`;
      }
      item.appendChild(meta);

      ui.summaryListEl.appendChild(item);
    });
  }
}

function showSessionComplete() {
  state.answered = true;
  showQuizArea(false);
  renderSummary();
  showSummary(true);
  showHome(true);
}

function startSession(event) {
  event.preventDefault();

  if (!state.allQuestions.length) {
    setFilterFeedback('No questions available yet.');
    return;
  }

  const grade = normalizeFilterValue(ui.gradeSelect?.value || '');
  const subject = normalizeFilterValue(ui.subjectSelect?.value || '');
  const topic = normalizeFilterValue(ui.topicSelect?.value || '');
  const requested = parseInt(ui.countInput?.value, 10) || 0;

  if (requested < 1) {
    setFilterFeedback('Choose at least one question.');
    state.questions = [];
    showQuizArea(false);
    return;
  }

  const pool = getFilteredQuestions({ grade, subject, topic });

  if (!pool.length) {
    setFilterFeedback('No questions match that selection yet.');
    state.questions = [];
    showQuizArea(false);
    resetQuizUi('No questions found for that selection.');
    return;
  }

  const shuffled = shuffle(pool);
  const count = Math.min(requested, shuffled.length);

  state.questions = shuffled.slice(0, count);
  state.currentIndex = 0;
  state.answered = false;
  resetResults();
  state.results.total = count;

  showQuizArea(true);
  showFilters(false);
  showHome(true);
  showSummary(false);
  renderQuestion(0);
}

async function loadQuestions() {
  try {
    const res = await fetch('questions.json', { cache: 'no-store' });
    const data = await res.json();
    state.allQuestions = normalizeQuestions(data);
  } catch (e) {
    console.warn('Could not load questions.json, using fallback', e);
    state.allQuestions = [];
  }

  if (!state.allQuestions.length) {
    resetQuizUi('No questions available.');
    showQuizArea(false);
    return;
  }

  buildFilters();
  setFilterFeedback('Select filters to begin.');
  showReadyState();
}

function renderQuestion(index) {
  if (!state.questions.length) {
    showReadyState();
    return;
  }

  showSummary(false);
  state.currentIndex = index;
  state.answered = false;
  const q = state.questions[index];

  if (!q) {
    showSessionComplete();
    return;
  }

  ui.questionEl.textContent = q.question;
  ui.optionsEl.innerHTML = '';
  setFeedback('', '');
  setNextVisible(false);

  q.options.forEach((opt, optionIndex) => {
    const button = document.createElement('button');
    button.className = 'option';
    button.textContent = opt;
    button.addEventListener('click', () => chooseAnswer(optionIndex));
    ui.optionsEl.appendChild(button);
  });
}

function chooseAnswer(optionIndex) {
  if (state.answered) return;
  state.answered = true;

  const q = state.questions[state.currentIndex];
  if (!q) return;
  disableOptions();

  const correct = optionIndex === q.answer;
  state.results.responses.push({
    question: q.question,
    options: q.options,
    chosen: optionIndex,
    correctIndex: q.answer,
    correct
  });
  if (correct) {
    state.results.correct += 1;
  }
  setFeedback(
    correct ? 'Correct! 🎉' : `Oops — the right answer is ${q.options[q.answer]}`,
    correct ? 'correct' : 'incorrect'
  );
  setNextVisible(true);
}

function goToNextQuestion() {
  const nextIndex = state.currentIndex + 1;
  if (nextIndex < state.questions.length) {
    renderQuestion(nextIndex);
    return;
  }
  showSessionComplete();
}

ui.nextBtn.addEventListener('click', goToNextQuestion);
ui.homeBtn?.addEventListener('click', () => {
  showReadyState();
});

applyBuildIdToManifestLink();
registerServiceWorker();
initBuildBadge();

loadQuestions();
