const ui = {
  questionEl: document.getElementById('question'),
  questionMediaEl: document.getElementById('question-media'),
  questionImageEl: document.getElementById('question-image'),
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
  summaryListEl: document.getElementById('summary-list'),
  summaryWrongToggleEl: document.getElementById('summary-wrong-toggle'),
  summaryCountEl: document.getElementById('summary-count'),
  skillSummaryToggleEl: document.getElementById('skill-summary-toggle'),
  skillSummaryEl: document.getElementById('skill-summary'),
  skillSummaryListEl: document.getElementById('skill-summary-list')
};

// Single source of truth for cache-busting across manifest + service worker.
// Bump this when you deploy changes that iOS Safari might aggressively cache.
const BUILD_ID = '20';

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
  },
  skillStats: [],
  skillSummaryVisible: false
};

const summaryFilter = {
  wrongOnly: false
};

let filtersBound = false;
let summaryFiltersBound = false;
let skillSummaryBound = false;

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

let audioCtx;
function getAudioCtx() {
  audioCtx = audioCtx || new AudioContext();
  return audioCtx;
}


function playToneDoubleBeep() {
  const ctx = getAudioCtx();
  const now = ctx.currentTime;
  const beep = (offset, freq) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(freq, now + offset);
    gain.gain.setValueAtTime(0.12, now + offset);
    gain.gain.exponentialRampToValueAtTime(0.001, now + offset + 0.18);
    osc.connect(gain).connect(ctx.destination);
    osc.start(now + offset);
    osc.stop(now + offset + 0.2);
  };
  beep(0, 480);
  beep(0.18, 360);
}

function playWrongTone() {
  try {
    playToneDoubleBeep();
  } catch (e) {
    console.warn('Audio playback failed', e);
  }
}

function playToneCorrectBell() {
  const ctx = getAudioCtx();
  const now = ctx.currentTime;
  const tones = [
    { freq: 880, dur: 0.32, gain: 0.18, offset: 0 },
    { freq: 1320, dur: 0.24, gain: 0.14, offset: 0.06 },
    { freq: 1760, dur: 0.18, gain: 0.1, offset: 0.12 }
  ];

  tones.forEach(t => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(t.freq, now + t.offset);
    gain.gain.setValueAtTime(t.gain, now + t.offset);
    gain.gain.exponentialRampToValueAtTime(0.001, now + t.offset + t.dur);
    osc.connect(gain).connect(ctx.destination);
    osc.start(now + t.offset);
    osc.stop(now + t.offset + t.dur + 0.02);
  });
}
function playCorrectTone() {
  try {
    playToneCorrectBell();
  } catch (e) {
    console.warn('Audio playback failed', e);
  }
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
      answer: q.answer,
      image: typeof q.image === 'string' ? q.image.trim() : '',
      imageAlt: typeof q.imageAlt === 'string' ? q.imageAlt.trim() : ''
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

const FALLBACK_SKILL = 'Other skills';

function toSkillLabel(topic) {
  const label = typeof topic === 'string' ? topic.trim() : '';
  return label || FALLBACK_SKILL;
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

function prepareQuestionForSession(question) {
  const answerText = question.options[question.answer];
  const shuffledOptions = shuffle(question.options);
  const newAnswerIndex = answerText ? shuffledOptions.indexOf(answerText) : -1;

  return {
    ...question,
    options: shuffledOptions,
    answer: newAnswerIndex >= 0 ? newAnswerIndex : 0
  };
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
  resetQuizUi('');
  summaryFilter.wrongOnly = false;
  if (ui.summaryWrongToggleEl) {
    ui.summaryWrongToggleEl.disabled = false;
    ui.summaryWrongToggleEl.textContent = 'Show wrong only';
  }
  if (ui.summaryCountEl) ui.summaryCountEl.textContent = '';
  state.skillSummaryVisible = false;
  state.skillStats = [];
  if (ui.skillSummaryToggleEl) {
    ui.skillSummaryToggleEl.hidden = true;
    ui.skillSummaryToggleEl.disabled = true;
    ui.skillSummaryToggleEl.textContent = 'Show per-skill mastery';
  }
  if (ui.skillSummaryEl) {
    ui.skillSummaryEl.hidden = true;
    if (ui.skillSummaryListEl) ui.skillSummaryListEl.innerHTML = '';
  }
}

function applySummaryFilter(responses) {
  if (!Array.isArray(responses)) return [];
  return summaryFilter.wrongOnly ? responses.filter(resp => !resp.correct) : responses;
}

function updateSummaryCount(shown, total) {
  if (!ui.summaryCountEl) return;
  if (!total) {
    ui.summaryCountEl.textContent = '';
    return;
  }

  ui.summaryCountEl.textContent = summaryFilter.wrongOnly
    ? `Showing wrong only (${shown})`
    : `Showing all (${shown}/${total})`;
}

function updateWrongToggleUi(hasWrong) {
  if (!ui.summaryWrongToggleEl) return;

  ui.summaryWrongToggleEl.disabled = !hasWrong;

  if (!hasWrong) {
    summaryFilter.wrongOnly = false;
  }

  ui.summaryWrongToggleEl.textContent = summaryFilter.wrongOnly ? 'Show all' : 'Show wrong only';
}

function createSummaryItem(resp, idx) {
  const item = document.createElement('div');
  item.className = 'summary-item';

  const toggle = document.createElement('button');
  toggle.type = 'button';
  toggle.className = 'summary-row-toggle';
  toggle.setAttribute('aria-expanded', 'false');

  const title = document.createElement('div');
  title.className = 'summary-row-title';
  title.textContent = `${idx + 1}. ${resp.question}`;

  const isCorrect = !!resp.correct;
  const chip = document.createElement('span');
  chip.className = `summary-chip ${isCorrect ? 'chip-correct' : 'chip-wrong'}`;
  chip.textContent = isCorrect ? 'Correct' : 'Wrong';

  const caret = document.createElement('span');
  caret.className = 'summary-caret';
  caret.setAttribute('aria-hidden', 'true');

  toggle.appendChild(title);
  toggle.appendChild(chip);
  toggle.appendChild(caret);

  const body = document.createElement('div');
  body.className = 'summary-row-body';
  body.hidden = true;

  const optionsWrap = document.createElement('div');
  optionsWrap.className = 'summary-options';
  (resp.options || []).forEach((opt, optIdx) => {
    const optEl = document.createElement('div');
    const isCorrectOpt = optIdx === resp.correctIndex;
    const isChosenOpt = optIdx === resp.chosen;
    optEl.className = 'summary-option';
    if (isCorrectOpt) optEl.classList.add('summary-option-correct');
    if (isChosenOpt && !resp.correct) optEl.classList.add('summary-option-wrong');
    optEl.textContent = opt;
    optionsWrap.appendChild(optEl);
  });

  if (resp.options?.length) {
    body.appendChild(optionsWrap);
  }

  if (resp.topic) {
    const topicLine = document.createElement('div');
    topicLine.className = 'summary-topic';
    topicLine.textContent = `Topic: ${resp.topic}`;
    body.appendChild(topicLine);
  }

  toggle.addEventListener('click', () => {
    const nextOpen = body.hidden;
    body.hidden = !nextOpen;
    item.classList.toggle('open', nextOpen);
    toggle.setAttribute('aria-expanded', String(nextOpen));
  });

  item.appendChild(toggle);
  item.appendChild(body);
  return item;
}

function renderSummaryList(responses) {
  if (!ui.summaryListEl) return;
  ui.summaryListEl.innerHTML = '';

  if (!responses.length) {
    const empty = document.createElement('div');
    empty.className = 'summary-empty';
    empty.textContent = summaryFilter.wrongOnly ? 'No wrong answers to show.' : 'Nothing to show yet.';
    ui.summaryListEl.appendChild(empty);
    return;
  }

  responses.forEach((resp, idx) => {
    ui.summaryListEl.appendChild(createSummaryItem(resp, idx));
  });
}

function updateSkillSummary(stats) {
  const hasStats = Array.isArray(stats) && stats.length > 0;

  if (ui.skillSummaryToggleEl) {
    ui.skillSummaryToggleEl.hidden = !hasStats;
    ui.skillSummaryToggleEl.disabled = !hasStats;
    ui.skillSummaryToggleEl.textContent = state.skillSummaryVisible ? 'Hide per-skill mastery' : 'Show per-skill mastery';
  }

  if (!ui.skillSummaryEl || !ui.skillSummaryListEl) return;

  if (!state.skillSummaryVisible || !hasStats) {
    ui.skillSummaryEl.hidden = true;
    ui.skillSummaryListEl.innerHTML = '';
    return;
  }

  renderSkillSummary(stats);
}

function bindSkillSummaryToggle() {
  if (skillSummaryBound) return;
  if (!ui.skillSummaryToggleEl) return;

  ui.skillSummaryToggleEl.addEventListener('click', () => {
    state.skillSummaryVisible = !state.skillSummaryVisible;
    updateSkillSummary(state.skillStats);
  });

  skillSummaryBound = true;
}

function bindSummaryFilters() {
  if (summaryFiltersBound) return;
  if (!ui.summaryWrongToggleEl) return;

  ui.summaryWrongToggleEl.addEventListener('click', () => {
    summaryFilter.wrongOnly = !summaryFilter.wrongOnly;
    updateWrongToggleUi(true);
    renderSummary();
  });

  summaryFiltersBound = true;
}

function renderSummary() {
  if (!ui.summaryEl) return;
  bindSummaryFilters();
  bindSkillSummaryToggle();

  const total = state.results.total || state.questions.length || 0;
  const correct = state.results.correct;
  const wrong = Math.max(total - correct, 0);
  const percent = total ? Math.round((correct / total) * 100) : 0;

  if (ui.summaryScoreEl) ui.summaryScoreEl.textContent = `${percent}%`;
  if (ui.summaryCorrectEl) ui.summaryCorrectEl.textContent = String(correct);
  if (ui.summaryWrongEl) ui.summaryWrongEl.textContent = String(wrong);
  if (ui.summaryTotalEl) ui.summaryTotalEl.textContent = String(total);

  state.skillStats = buildSkillStats(state.results.responses);
  updateSkillSummary(state.skillStats);

  const hasWrong = state.results.responses.some(resp => !resp.correct);
  updateWrongToggleUi(hasWrong);

  const filtered = applySummaryFilter(state.results.responses);
  updateSummaryCount(filtered.length, state.results.responses.length);
  renderSummaryList(filtered);
}

function buildSkillStats(responses) {
  const stats = new Map();

  responses.forEach(resp => {
    const skill = toSkillLabel(resp.topic);
    const current = stats.get(skill) || { skill, correct: 0, total: 0 };
    current.total += 1;
    if (resp.correct) current.correct += 1;
    stats.set(skill, current);
  });

  return Array.from(stats.values())
    .map(entry => ({
      ...entry,
      percent: entry.total ? Math.round((entry.correct / entry.total) * 100) : 0
    }))
    .sort((a, b) => (b.percent - a.percent) || (b.total - a.total) || a.skill.localeCompare(b.skill));
}

function renderSkillSummary(stats) {
  if (!ui.skillSummaryEl || !ui.skillSummaryListEl) return;

  if (!stats.length) {
    ui.skillSummaryEl.hidden = true;
    ui.skillSummaryListEl.innerHTML = '';
    return;
  }

  ui.skillSummaryEl.hidden = false;
  ui.skillSummaryListEl.innerHTML = '';

  stats.forEach(stat => {
    const card = document.createElement('div');
    card.className = 'skill-card';

    const top = document.createElement('div');
    top.className = 'skill-card-top';

    const name = document.createElement('div');
    name.className = 'skill-name';
    name.textContent = stat.skill;

    const score = document.createElement('div');
    const scoreBand = stat.percent >= 85 ? 'good' : (stat.percent >= 60 ? 'medium' : 'low');
    score.className = `skill-score ${scoreBand}`;
    score.textContent = `${stat.percent}%`;

    top.appendChild(name);
    top.appendChild(score);
    card.appendChild(top);

    const sub = document.createElement('div');
    sub.className = 'skill-subtext';
    sub.textContent = `${stat.correct} of ${stat.total} correct`;
    card.appendChild(sub);

    const bar = document.createElement('div');
    bar.className = 'skill-bar';
    const fill = document.createElement('div');
    fill.className = 'skill-bar-fill';
    fill.style.width = `${stat.percent}%`;
    bar.appendChild(fill);
    card.appendChild(bar);

    ui.skillSummaryListEl.appendChild(card);
  });
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

  const count = Math.min(requested, pool.length);
  state.questions = shuffle(pool)
    .slice(0, count)
    .map(q => prepareQuestionForSession(q));
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
  setFilterFeedback('');
  showReadyState();
}

function renderQuestionMedia(question) {
  if (!ui.questionMediaEl || !ui.questionImageEl) return;
  const src = question.image || '';

  if (!src) {
    ui.questionMediaEl.hidden = true;
    ui.questionImageEl.removeAttribute('src');
    ui.questionImageEl.alt = '';
    return;
  }

  ui.questionMediaEl.hidden = false;
  ui.questionImageEl.alt = question.imageAlt || 'Question image';
  ui.questionImageEl.src = src;
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
  renderQuestionMedia(q);
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

  const buttons = Array.from(ui.optionsEl.querySelectorAll('button.option'));

  const correct = optionIndex === q.answer;
  state.results.responses.push({
    question: q.question,
    options: q.options,
    chosen: optionIndex,
    correctIndex: q.answer,
    topic: q.topic,
    image: q.image,
    imageAlt: q.imageAlt,
    correct
  });
  if (correct) {
    state.results.correct += 1;
    playCorrectTone();
  }

  buttons.forEach((btn, idx) => {
    btn.classList.remove('option-correct', 'option-wrong');
    if (correct && idx === optionIndex) {
      btn.classList.add('option-correct');
    }
    if (!correct && idx === optionIndex) {
      btn.classList.add('option-wrong');
    }
  });

  if (!correct) {
    playWrongTone();
  }

  setFeedback('', '');
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
