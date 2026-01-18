import { toSkillLabel } from '../data/questions.js';

let summaryFiltersBound = false;
let skillSummaryBound = false;

export function initSummaryControls(ui, summaryFilter, onFilterChange, onSkillToggle) {
  if (!summaryFiltersBound && ui.summaryWrongToggleEl) {
    ui.summaryWrongToggleEl.addEventListener('click', () => {
      summaryFilter.wrongOnly = !summaryFilter.wrongOnly;
      onFilterChange();
    });
    summaryFiltersBound = true;
  }

  if (!skillSummaryBound && ui.skillSummaryToggleEl) {
    ui.skillSummaryToggleEl.addEventListener('click', () => {
      onSkillToggle();
    });
    skillSummaryBound = true;
  }
}

function applySummaryFilter(responses, summaryFilter) {
  if (!Array.isArray(responses)) return [];
  return summaryFilter.wrongOnly ? responses.filter(resp => !resp.correct) : responses;
}

function updateSummaryCount(ui, summaryFilter, shown, total) {
  if (!ui.summaryCountEl) return;
  if (!total) {
    ui.summaryCountEl.textContent = '';
    return;
  }

  ui.summaryCountEl.textContent = summaryFilter.wrongOnly
    ? `Showing wrong only (${shown})`
    : `Showing all (${shown}/${total})`;
}

function updateWrongToggleUi(ui, summaryFilter, hasWrong) {
  if (!ui.summaryWrongToggleEl) return;
  ui.summaryWrongToggleEl.disabled = !hasWrong;
  if (!hasWrong) summaryFilter.wrongOnly = false;
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

  if (resp.options?.length) body.appendChild(optionsWrap);

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

function renderSummaryList(ui, summaryFilter, responses) {
  if (!ui.summaryListEl) return;
  ui.summaryListEl.innerHTML = '';

  if (!responses.length) {
    const empty = document.createElement('div');
    empty.className = 'summary-empty';
    empty.textContent = summaryFilter.wrongOnly ? 'No wrong answers to show.' : 'Nothing to show yet.';
    ui.summaryListEl.appendChild(empty);
    return;
  }

  responses.forEach((resp, idx) => ui.summaryListEl.appendChild(createSummaryItem(resp, idx)));
}

export function buildSkillStats(responses) {
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

function renderSkillSummary(ui, stats) {
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

function updateSkillSummary(ui, state) {
  const hasStats = Array.isArray(state.skillStats) && state.skillStats.length > 0;

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

  renderSkillSummary(ui, state.skillStats);
}

export function renderSummary(state, ui, summaryFilter) {
  if (!ui.summaryEl) return;

  const total = state.results.total || state.questions.length || 0;
  const correct = state.results.correct;
  const wrong = Math.max(total - correct, 0);
  const percent = total ? Math.round((correct / total) * 100) : 0;

  if (ui.summaryScoreEl) ui.summaryScoreEl.textContent = `${percent}%`;
  if (ui.summaryCorrectEl) ui.summaryCorrectEl.textContent = String(correct);
  if (ui.summaryWrongEl) ui.summaryWrongEl.textContent = String(wrong);
  if (ui.summaryTotalEl) ui.summaryTotalEl.textContent = String(total);

  state.skillStats = buildSkillStats(state.results.responses);
  updateSkillSummary(ui, state);

  const hasWrong = state.results.responses.some(resp => !resp.correct);
  updateWrongToggleUi(ui, summaryFilter, hasWrong);

  const filtered = applySummaryFilter(state.results.responses, summaryFilter);
  updateSummaryCount(ui, summaryFilter, filtered.length, state.results.responses.length);
  renderSummaryList(ui, summaryFilter, filtered);
}
