/* ============================================
   Lil Beans - Daily Goal Tracker App
   Planet of the Lil Beans
   ============================================ */

(function () {
  'use strict';

  // --- Configuration ---
  const DAILY_GOALS = [
    { id: 'eat-healthy', icon: '\u{1F966}', text: 'Eat something healthy', points: 2 },
    { id: 'workout', icon: '\u{1F3C3}', text: 'Get moving & exercise', points: 2 },
    { id: 'be-nice', icon: '\u{1F31F}', text: 'Be nice to someone', points: 2 },
    { id: 'help-someone', icon: '\u{1F91D}', text: 'Help someone today', points: 2 },
    { id: 'give-hug', icon: '\u{1F917}', text: 'Give a hug', points: 2 },
  ];

  const BEAN_STAGES = [
    { name: 'Lil Seed', cssClass: 'seed', minPoints: 0, icon: '\u{1FAB4}' },
    { name: 'Sprout', cssClass: 'sprout', minPoints: 10, icon: '\u{1F331}' },
    { name: 'Lil Bean', cssClass: 'lil-bean', minPoints: 25, icon: '\u{1F33F}' },
    { name: 'Growing Bean', cssClass: 'growing-bean', minPoints: 50, icon: '\u{1F343}' },
    { name: 'Big Bean', cssClass: 'big-bean', minPoints: 100, icon: '\u{1F333}' },
    { name: 'Super Bean', cssClass: 'super-bean', minPoints: 200, icon: '\u{2B50}' },
  ];

  const CELEBRATION_MESSAGES = [
    'You did it! \u{1F389}',
    'Way to grow! \u{1F331}',
    'Super Bean! \u{1F31F}',
    'Amazing job! \u{1F60D}',
    'You rock! \u{1F48A}',
    'Bean-tastic! \u{1F49A}',
  ];

  const STORAGE_KEY = 'lilbeans_data';

  // --- State ---
  let appState = {
    name: '',
    totalPoints: 0,
    dailyLog: {},
    streak: 0,
    lastCompletedDate: null,
  };

  // --- DOM References ---
  const $ = (sel) => document.querySelector(sel);
  const welcomeScreen = $('#welcome-screen');
  const dashboardScreen = $('#dashboard-screen');
  const childNameInput = $('#child-name');
  const startBtn = $('#start-btn');
  const continueBtn = $('#continue-btn');
  const savedNameSpan = $('#saved-name');
  const greetingEl = $('#greeting');
  const totalPointsEl = $('#total-points');
  const goalsList = $('#goals-list');
  const dateDisplay = $('#date-display');
  const stageLabel = $('#stage-label');
  const mainBeanBody = $('#main-bean-body');
  const mainBeanLeaf = $('#main-bean-leaf');
  const progressBar = $('#progress-bar');
  const progressLabel = $('#progress-label');
  const stageTimeline = $('#stage-timeline');
  const streakCount = $('#streak-count');
  const streakSection = $('#streak-section');
  const dailySummary = $('#daily-summary');
  const summaryText = $('#summary-text');
  const celebrationOverlay = $('#celebration-overlay');
  const celebrationMessage = $('#celebration-message');
  const confettiContainer = $('#confetti-container');
  const resetBtn = $('#reset-btn');
  const pointsBadge = $('#points-badge');

  // --- Utilities ---
  function getTodayKey() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  function formatDate(dateStr) {
    const parts = dateStr.split('-');
    const d = new Date(parts[0], parts[1] - 1, parts[2]);
    return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  }

  function saveState() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(appState));
    } catch (e) {
      // localStorage unavailable
    }
  }

  function loadState() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        appState = JSON.parse(saved);
        return true;
      }
    } catch (e) {
      // localStorage unavailable
    }
    return false;
  }

  function getStageForPoints(points) {
    let stage = BEAN_STAGES[0];
    for (let i = BEAN_STAGES.length - 1; i >= 0; i--) {
      if (points >= BEAN_STAGES[i].minPoints) {
        stage = BEAN_STAGES[i];
        break;
      }
    }
    return stage;
  }

  function getNextStage(currentStage) {
    const idx = BEAN_STAGES.indexOf(currentStage);
    if (idx < BEAN_STAGES.length - 1) {
      return BEAN_STAGES[idx + 1];
    }
    return null;
  }

  function getStageIndex(stage) {
    return BEAN_STAGES.indexOf(stage);
  }

  // --- Stars ---
  function createStars() {
    const container = $('#stars');
    const count = 60;
    for (let i = 0; i < count; i++) {
      const star = document.createElement('div');
      star.className = 'star';
      star.style.left = Math.random() * 100 + '%';
      star.style.top = Math.random() * 100 + '%';
      const size = Math.random() * 3 + 1;
      star.style.width = size + 'px';
      star.style.height = size + 'px';
      star.style.setProperty('--duration', (Math.random() * 3 + 2) + 's');
      star.style.animationDelay = Math.random() * 3 + 's';
      container.appendChild(star);
    }
  }

  // --- Streak Calculation ---
  function calculateStreak() {
    const today = getTodayKey();
    const sortedDates = Object.keys(appState.dailyLog).sort().reverse();

    if (sortedDates.length === 0) {
      appState.streak = 0;
      return;
    }

    let streak = 0;
    const checkDate = new Date();

    // Check if today is completed (all goals)
    const todayLog = appState.dailyLog[today];
    const todayComplete = todayLog && todayLog.length === DAILY_GOALS.length;

    if (!todayComplete) {
      // Check yesterday
      checkDate.setDate(checkDate.getDate() - 1);
    }

    while (true) {
      const key = `${checkDate.getFullYear()}-${String(checkDate.getMonth() + 1).padStart(2, '0')}-${String(checkDate.getDate()).padStart(2, '0')}`;
      const log = appState.dailyLog[key];
      if (log && log.length === DAILY_GOALS.length) {
        streak++;
        checkDate.setDate(checkDate.getDate() - 1);
      } else {
        break;
      }
    }

    appState.streak = streak;
  }

  // --- Render Functions ---
  function renderBean() {
    const stage = getStageForPoints(appState.totalPoints);
    const nextStage = getNextStage(stage);

    stageLabel.textContent = stage.name;

    // Update bean body class
    mainBeanBody.className = 'bean-body ' + stage.cssClass;

    // Progress bar
    if (nextStage) {
      const pointsInStage = appState.totalPoints - stage.minPoints;
      const pointsNeeded = nextStage.minPoints - stage.minPoints;
      const pct = Math.min((pointsInStage / pointsNeeded) * 100, 100);
      progressBar.style.width = pct + '%';
      progressLabel.textContent = `${pointsInStage} / ${pointsNeeded} to ${nextStage.name}`;
    } else {
      progressBar.style.width = '100%';
      progressLabel.textContent = 'Max level reached! You\'re a Super Bean!';
    }
  }

  function renderTimeline() {
    stageTimeline.innerHTML = '';
    const currentStage = getStageForPoints(appState.totalPoints);
    const currentIdx = getStageIndex(currentStage);

    BEAN_STAGES.forEach((stage, i) => {
      const item = document.createElement('div');
      item.className = 'stage-item';
      if (i < currentIdx) item.classList.add('reached');
      if (i === currentIdx) item.classList.add('current');

      const dot = document.createElement('div');
      dot.className = 'stage-dot';
      dot.textContent = stage.icon;

      const name = document.createElement('div');
      name.className = 'stage-name';
      name.textContent = stage.name;

      item.appendChild(dot);
      item.appendChild(name);
      stageTimeline.appendChild(item);
    });
  }

  function renderGoals() {
    goalsList.innerHTML = '';
    const today = getTodayKey();
    const completedToday = appState.dailyLog[today] || [];

    DAILY_GOALS.forEach((goal) => {
      const isCompleted = completedToday.includes(goal.id);

      const card = document.createElement('div');
      card.className = 'goal-card' + (isCompleted ? ' completed' : '');
      card.dataset.goalId = goal.id;

      card.innerHTML = `
        <div class="goal-icon">${goal.icon}</div>
        <div class="goal-info">
          <div class="goal-text">${goal.text}</div>
          <div class="goal-points">+${goal.points} growing points</div>
        </div>
        <div class="goal-check">${isCompleted ? '\u2713' : ''}</div>
      `;

      card.addEventListener('click', () => toggleGoal(goal, card));
      goalsList.appendChild(card);
    });

    dateDisplay.textContent = formatDate(today);
  }

  function renderStreak() {
    calculateStreak();
    streakCount.textContent = appState.streak;
    if (appState.streak === 0) {
      streakSection.style.opacity = '0.5';
    } else {
      streakSection.style.opacity = '1';
    }
  }

  function renderDashboard() {
    greetingEl.textContent = `Hi, ${appState.name}!`;
    totalPointsEl.textContent = appState.totalPoints;
    renderBean();
    renderTimeline();
    renderGoals();
    renderStreak();
    checkDailySummary();
  }

  function checkDailySummary() {
    const today = getTodayKey();
    const completedToday = appState.dailyLog[today] || [];

    if (completedToday.length === DAILY_GOALS.length) {
      dailySummary.classList.remove('hidden');
      const pointsEarned = DAILY_GOALS.reduce((sum, g) => sum + g.points, 0);
      summaryText.textContent = `You completed all ${DAILY_GOALS.length} goals and earned ${pointsEarned} growing points today!`;
    } else {
      dailySummary.classList.add('hidden');
    }
  }

  // --- Goal Toggle ---
  function toggleGoal(goal, cardEl) {
    const today = getTodayKey();
    if (!appState.dailyLog[today]) {
      appState.dailyLog[today] = [];
    }

    const completedToday = appState.dailyLog[today];
    const idx = completedToday.indexOf(goal.id);
    const previousStage = getStageForPoints(appState.totalPoints);

    if (idx === -1) {
      // Complete the goal
      completedToday.push(goal.id);
      appState.totalPoints += goal.points;

      // Animate
      cardEl.classList.add('completed', 'just-completed');
      cardEl.querySelector('.goal-check').textContent = '\u2713';
      setTimeout(() => cardEl.classList.remove('just-completed'), 400);

      // Points fly animation
      showPointsFly(cardEl, goal.points);

      // Check for stage up
      const newStage = getStageForPoints(appState.totalPoints);
      if (getStageIndex(newStage) > getStageIndex(previousStage)) {
        setTimeout(() => showCelebration(`You grew into a ${newStage.name}! ${newStage.icon}`), 600);
      }

      // Check all goals completed
      if (completedToday.length === DAILY_GOALS.length) {
        setTimeout(() => {
          showCelebration(CELEBRATION_MESSAGES[Math.floor(Math.random() * CELEBRATION_MESSAGES.length)]);
        }, completedToday.length === DAILY_GOALS.length && getStageIndex(newStage) > getStageIndex(previousStage) ? 2500 : 600);
      }
    } else {
      // Uncomplete the goal
      completedToday.splice(idx, 1);
      appState.totalPoints = Math.max(0, appState.totalPoints - goal.points);

      cardEl.classList.remove('completed');
      cardEl.querySelector('.goal-check').textContent = '';
    }

    saveState();
    totalPointsEl.textContent = appState.totalPoints;
    renderBean();
    renderTimeline();
    renderStreak();
    checkDailySummary();
  }

  // --- Animations ---
  function showPointsFly(el, points) {
    const rect = el.getBoundingClientRect();
    const fly = document.createElement('div');
    fly.className = 'points-fly';
    fly.textContent = `+${points}`;
    fly.style.left = rect.right - 60 + 'px';
    fly.style.top = rect.top + 'px';
    document.body.appendChild(fly);
    setTimeout(() => fly.remove(), 1000);
  }

  function showCelebration(message) {
    celebrationMessage.textContent = message;
    celebrationOverlay.classList.remove('hidden');
    launchConfetti();
    setTimeout(() => {
      celebrationOverlay.classList.add('hidden');
      confettiContainer.innerHTML = '';
    }, 2500);
  }

  function launchConfetti() {
    confettiContainer.innerHTML = '';
    const colors = ['#FF6B8A', '#FFE66D', '#7BC67E', '#64B5F6', '#FF8C42', '#CE93D8', '#4ADE80'];
    for (let i = 0; i < 50; i++) {
      const piece = document.createElement('div');
      piece.className = 'confetti-piece';
      piece.style.left = Math.random() * 100 + '%';
      piece.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
      piece.style.setProperty('--fall-duration', (Math.random() * 1.5 + 1) + 's');
      piece.style.animationDelay = Math.random() * 0.5 + 's';
      piece.style.borderRadius = Math.random() > 0.5 ? '50%' : '2px';
      const size = Math.random() * 8 + 6;
      piece.style.width = size + 'px';
      piece.style.height = size + 'px';
      confettiContainer.appendChild(piece);
    }
  }

  // --- Screen Navigation ---
  function showDashboard() {
    welcomeScreen.classList.add('hidden');
    dashboardScreen.classList.remove('hidden');
    renderDashboard();
  }

  // --- Event Listeners ---
  startBtn.addEventListener('click', () => {
    const name = childNameInput.value.trim();
    if (!name) {
      childNameInput.focus();
      childNameInput.style.borderColor = '#FF6B8A';
      setTimeout(() => { childNameInput.style.borderColor = ''; }, 1000);
      return;
    }
    appState.name = name;
    saveState();
    showDashboard();
  });

  childNameInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') startBtn.click();
  });

  continueBtn.addEventListener('click', () => {
    showDashboard();
  });

  resetBtn.addEventListener('click', () => {
    if (confirm('Start over? This will reset all your growing points and progress.')) {
      localStorage.removeItem(STORAGE_KEY);
      appState = {
        name: '',
        totalPoints: 0,
        dailyLog: {},
        streak: 0,
        lastCompletedDate: null,
      };
      dashboardScreen.classList.add('hidden');
      welcomeScreen.classList.remove('hidden');
      childNameInput.value = '';
      continueBtn.classList.add('hidden');
      document.getElementById('name-entry').classList.remove('hidden');
    }
  });

  // --- Badge bounce on point change ---
  const observer = new MutationObserver(() => {
    pointsBadge.style.transform = 'scale(1.2)';
    setTimeout(() => { pointsBadge.style.transform = 'scale(1)'; }, 200);
  });
  observer.observe(totalPointsEl, { childList: true });

  // --- Init ---
  function init() {
    createStars();
    const hasData = loadState();

    if (hasData && appState.name) {
      savedNameSpan.textContent = appState.name;
      continueBtn.classList.remove('hidden');
      document.getElementById('name-entry').classList.add('hidden');
    }
  }

  init();
})();
