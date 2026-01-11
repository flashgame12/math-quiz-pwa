const questionEl = document.getElementById('question');
const optionsEl = document.getElementById('options');
const feedbackEl = document.getElementById('feedback');
const nextBtn = document.getElementById('next');
let questions = [];
let current = 0;

async function loadQuestions(){
  try{
    const res = await fetch('questions.json', {cache: 'no-store'});
    questions = await res.json();
  }catch(e){
    console.warn('Could not load questions.json, using fallback', e);
    questions = [];
  }
  if(!questions.length){
    questionEl.textContent = 'No questions available.';
    return;
  }
  showQuestion(0);
}

function showQuestion(i){
  current = i;
  const q = questions[i];
  questionEl.textContent = q.question;
  optionsEl.innerHTML = '';
  feedbackEl.textContent = '';
  nextBtn.hidden = true;

  q.options.forEach((opt, idx) => {
    const b = document.createElement('button');
    b.className = 'option';
    b.textContent = opt;
    b.addEventListener('click', () => chooseAnswer(idx));
    optionsEl.appendChild(b);
  });
}

function chooseAnswer(idx){
  const q = questions[current];
  const buttons = Array.from(optionsEl.querySelectorAll('button'));
  buttons.forEach(b => b.disabled = true);
  const correct = idx === q.answer;
  feedbackEl.textContent = correct ? 'Correct! 🎉' : `Oops — the right answer is ${q.options[q.answer]}`;
  feedbackEl.className = correct ? 'feedback correct' : 'feedback incorrect';
  nextBtn.hidden = false;
}

nextBtn.addEventListener('click', () => {
  const nextIndex = current + 1;
  if(nextIndex < questions.length){
    showQuestion(nextIndex);
  }else{
    // End — simple restart
    showQuestion(0);
  }
});

loadQuestions();
