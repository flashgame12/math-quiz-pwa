export const FALLBACK_SKILL = 'Other skills';

export function normalizeQuestions(data) {
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

export function uniqueValues(list, key, predicate) {
  const values = new Set();
  list.forEach(item => {
    if (!item) return;
    if (predicate && !predicate(item)) return;
    const value = item[key];
    if (typeof value === 'string' && value.trim()) values.add(value.trim());
  });
  return Array.from(values).sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));
}

export function shuffle(list) {
  const arr = list.slice();
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export function prepareQuestionForSession(question) {
  const answerText = question.options[question.answer];
  const shuffledOptions = shuffle(question.options);
  const newAnswerIndex = answerText ? shuffledOptions.indexOf(answerText) : -1;
  return { ...question, options: shuffledOptions, answer: newAnswerIndex >= 0 ? newAnswerIndex : 0 };
}

export function normalizeFilterValue(value) {
  return value === '__all__' ? '' : (value || '');
}

export function getFilteredQuestions(filters, allQuestions) {
  return allQuestions.filter(q =>
    (!filters.grade || q.grade === filters.grade) &&
    (!filters.subject || q.subject === filters.subject) &&
    (!filters.topic || q.topic === filters.topic)
  );
}

export function toSkillLabel(topic) {
  const label = typeof topic === 'string' ? topic.trim() : '';
  return label || FALLBACK_SKILL;
}
