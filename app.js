const ui = {
  questionEl: document.getElementById('question'),
  optionsEl: document.getElementById('options'),
  feedbackEl: document.getElementById('feedback'),
  nextBtn: document.getElementById('next')
};

// Single source of truth for cache-busting across manifest + service worker.
// Bump this when you deploy changes that iOS Safari might aggressively cache.
const BUILD_ID = '2026-01-11';

const state = {
  questions: [],
  currentIndex: 0,
  answered: false
};

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
      question: q.question,
      options: q.options.map(String),
      answer: q.answer
    }));
}

async function loadQuestions() {
  try {
    const res = await fetch('questions.json', { cache: 'no-store' });
    const data = await res.json();
    state.questions = normalizeQuestions(data);
  } catch (e) {
    console.warn('Could not load questions.json, using fallback', e);
    state.questions = [];
  }

  if (!state.questions.length) {
    ui.questionEl.textContent = 'No questions available.';
    ui.optionsEl.innerHTML = '';
    setFeedback('', '');
    setNextVisible(false);
    return;
  }

  renderQuestion(0);
}

function renderQuestion(index) {
  state.currentIndex = index;
  state.answered = false;
  const q = state.questions[index];

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
  disableOptions();

  const correct = optionIndex === q.answer;
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
  // End — simple restart
  renderQuestion(0);
}

ui.nextBtn.addEventListener('click', goToNextQuestion);

applyBuildIdToManifestLink();
registerServiceWorker();

loadQuestions();
