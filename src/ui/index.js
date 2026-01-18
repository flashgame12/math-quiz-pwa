export const ui = {
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

export function setFilterFeedback(message) {
  if (!ui.filterFeedbackEl) return;
  ui.filterFeedbackEl.textContent = message;
}

export function setFeedback(message, variant) {
  if (!ui.feedbackEl) return;
  ui.feedbackEl.textContent = message;
  ui.feedbackEl.className = variant ? `feedback ${variant}` : 'feedback';
}

export function setNextVisible(visible) {
  if (!ui.nextBtn) return;
  ui.nextBtn.hidden = !visible;
}

export function disableOptions() {
  ui.optionsEl?.querySelectorAll('button').forEach(btn => {
    btn.disabled = true;
  });
}

export function showQuizArea(show) {
  if (!ui.quizArea) return;
  ui.quizArea.hidden = !show;
}

export function showFilters(show) {
  if (!ui.filtersForm) return;
  ui.filtersForm.hidden = !show;
  ui.filtersForm.style.display = show ? 'grid' : 'none';
}

export function showHome(show) {
  if (!ui.homeBtn) return;
  ui.homeBtn.hidden = !show;
}

export function showSummary(show) {
  if (!ui.summaryEl) return;
  ui.summaryEl.hidden = !show;
}

export function resetQuizUi(message) {
  if (ui.questionEl) ui.questionEl.textContent = message;
  if (ui.optionsEl) ui.optionsEl.innerHTML = '';
  setFeedback('', '');
  setNextVisible(false);
}

export function renderQuestionMedia(question) {
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

export function populateSelect(selectEl, values, placeholder, defaultValue = '') {
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
