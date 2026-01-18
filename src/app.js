import { ui, setFilterFeedback, setFeedback, setNextVisible, disableOptions, showQuizArea, showFilters, showHome, showSummary, resetQuizUi, renderQuestionMedia, populateSelect } from './ui/index.js';
import { playCorrectTone, playWrongTone } from './audio/index.js';
import { normalizeQuestions, uniqueValues, shuffle, prepareQuestionForSession, normalizeFilterValue, getFilteredQuestions } from './data/questions.js';
import { initSummaryControls, renderSummary } from './summary/index.js';
import { applyBuildIdToManifestLink, registerServiceWorker, initBuildBadge } from './pwa/index.js';

const state = {
  allQuestions: [],
  questions: [],
  currentIndex: 0,
  answered: false,
  results: { responses: [], correct: 0, total: 0 },
  skillStats: [],
  skillSummaryVisible: false
};

const summaryFilter = { wrongOnly: false };
let filtersBound = false;

function resetResults() {
  state.results = { responses: [], correct: 0, total: 0 };
}

function resetSummaryUi() {
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
  if (ui.summaryListEl) ui.summaryListEl.innerHTML = '';
}

function showReadyState() {
  showQuizArea(false);
  showFilters(true);
  showHome(false);
  showSummary(false);
  state.questions = [];
  resetResults();
  resetQuizUi('');
  resetSummaryUi();
}

function handleGradeChange() {
  const rawGrade = ui.gradeSelect?.value || '';
  const grade = normalizeFilterValue(rawGrade);

  if (!rawGrade) {
    populateSelect(ui.subjectSelect, [], 'All subjects', '__all__');
    populateSelect(ui.topicSelect, [], 'All topics', '__all__');
    if (ui.subjectSelect) ui.subjectSelect.disabled = true;
    if (ui.topicSelect) ui.topicSelect.disabled = true;
    return;
  }

  const subjects = uniqueValues(state.allQuestions, 'subject', q => !grade || q.grade === grade);
  populateSelect(ui.subjectSelect, subjects, 'All subjects', '__all__');
  populateSelect(ui.topicSelect, [], 'All topics', '__all__');
  if (ui.subjectSelect) ui.subjectSelect.disabled = !subjects.length;
  if (ui.topicSelect) ui.topicSelect.disabled = true;

  if (subjects.length) handleSubjectChange();
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
  if (ui.topicSelect) ui.topicSelect.disabled = !topics.length;
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

  if (ui.questionEl) ui.questionEl.textContent = q.question;
  renderQuestionMedia(q);
  if (ui.optionsEl) ui.optionsEl.innerHTML = '';
  setFeedback('', '');
  setNextVisible(false);

  q.options.forEach((opt, optionIndex) => {
    const button = document.createElement('button');
    button.className = 'option';
    button.textContent = opt;
    button.addEventListener('click', () => chooseAnswer(optionIndex));
    ui.optionsEl?.appendChild(button);
  });
}

function chooseAnswer(optionIndex) {
  if (state.answered) return;
  state.answered = true;

  const q = state.questions[state.currentIndex];
  if (!q) return;
  disableOptions();

  const buttons = Array.from(ui.optionsEl?.querySelectorAll('button.option') || []);

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
  if (correct) state.results.correct += 1;

  buttons.forEach((btn, idx) => {
    btn.classList.remove('option-correct', 'option-wrong');
    if (correct && idx === optionIndex) btn.classList.add('option-correct');
    if (!correct && idx === optionIndex) btn.classList.add('option-wrong');
  });

  if (correct) playCorrectTone(); else playWrongTone();

  setFeedback('', '');
  setNextVisible(true);
}

function showSessionComplete() {
  state.answered = true;
  showQuizArea(false);
  renderSummary(state, ui, summaryFilter);
  showSummary(true);
  showHome(true);
}

function goToNextQuestion() {
  const nextIndex = state.currentIndex + 1;
  if (nextIndex < state.questions.length) {
    renderQuestion(nextIndex);
    return;
  }
  showSessionComplete();
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

  const pool = getFilteredQuestions({ grade, subject, topic }, state.allQuestions);
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
  } catch (err) {
    console.warn('Could not load questions.json, using fallback', err);
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

function bindCoreEvents() {
  ui.nextBtn?.addEventListener('click', goToNextQuestion);
  ui.homeBtn?.addEventListener('click', showReadyState);

  initSummaryControls(
    ui,
    summaryFilter,
    () => renderSummary(state, ui, summaryFilter),
    () => {
      state.skillSummaryVisible = !state.skillSummaryVisible;
      renderSummary(state, ui, summaryFilter);
    }
  );
}

applyBuildIdToManifestLink();
registerServiceWorker();
initBuildBadge(ui.buildBadgeEl);
bindCoreEvents();
loadQuestions();
