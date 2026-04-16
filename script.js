// ====== ELEMENTS ======
const diskSelector = document.getElementById('diskSelector');
const diskCountDisplay = document.getElementById('diskCountDisplay');
const moveCountDisplay = document.getElementById('moveCount');
const minMovesDisplay = document.getElementById('minMoves');
const timerDisplay = document.getElementById('timerDisplay');
const progressBar = document.getElementById('progressBar');
const bestScoreDisplay = document.getElementById('bestScoreDisplay');

const btnNewGame = document.getElementById('btnNewGame');
const btnRestart = document.getElementById('btnRestart');
const btnPause = document.getElementById('btnPause');
const btnResume = document.getElementById('btnResume');
const btnHint = document.getElementById('btnHint');
const btnAutoSolve = document.getElementById('btnAutoSolve');
const themeToggle = document.getElementById('themeToggle');

const gameArena = document.getElementById('gameArena');
const stacks = [
    document.getElementById('stack-0'),
    document.getElementById('stack-1'),
    document.getElementById('stack-2')
];

const winModal = document.getElementById('winModal');
const pauseModal = document.getElementById('pauseModal');
const winMoves = document.getElementById('winMoves');
const winMinMoves = document.getElementById('winMinMoves');
const winTime = document.getElementById('winTime');
const newBestBadge = document.getElementById('newBestBadge');
const starRating = document.getElementById('starRating');
const btnPlayAgain = document.getElementById('btnPlayAgain');

// ====== STATE ======
let numDisks = 3;
let pegs = [[], [], []];
let moves = 0;
let minMovesLimit = 0;
let bestScore = localStorage.getItem('hanoiBestScore') || null;

let timerInterval = null;
let secondsElapsed = 0;
let isPlaying = false;
let isPaused = false;
let isAutoSolving = false;

// Audio Context setup (Lazy load)
let audioCtx;

// ====== INITIALIZATION ======
function initGame() {
    numDisks = parseInt(diskSelector.value);
    diskCountDisplay.textContent = numDisks;
    minMovesLimit = Math.pow(2, numDisks) - 1;
    minMovesDisplay.textContent = minMovesLimit;

    stopTimer();
    secondsElapsed = 0;
    moves = 0;
    isPlaying = false;
    isPaused = false;
    isAutoSolving = false;

    updateTimerDisplay();
    updateDashboard();

    if (bestScore) bestScoreDisplay.textContent = bestScore;

    // Reset arrays
    pegs = [[], [], []];
    for (let i = numDisks; i >= 1; i--) {
        pegs[0].push(i);
    }

    winModal.classList.add('hidden');
    pauseModal.classList.add('hidden');
    btnPause.textContent = 'Pause';

    renderGame();
}

function updateDashboard() {
    moveCountDisplay.textContent = moves;
    const progress = Math.min((moves / minMovesLimit) * 100, 100);
    progressBar.style.width = isPlaying || moves > 0 ? `${progress}%` : '0%';
}

function renderGame() {
    // Clear DOM
    stacks.forEach(stack => stack.innerHTML = '');

    pegs.forEach((peg, pegIndex) => {
        peg.forEach((diskSize, diskIndex) => {
            const diskDiv = document.createElement('div');
            diskDiv.classList.add('disk');
            diskDiv.setAttribute('data-size', diskSize);
            diskDiv.setAttribute('data-peg', pegIndex);

            // Only top disk is draggable visually
            const isTopDisk = diskIndex === peg.length - 1;
            diskDiv.draggable = isTopDisk && !isAutoSolving && !isPaused;

            if (isTopDisk) {
                diskDiv.addEventListener('dragstart', handleDragStart);
                diskDiv.addEventListener('dragend', handleDragEnd);
            }

            stacks[pegIndex].appendChild(diskDiv);
        });
    });
}

// ====== AUDIO ======
function playSound(type) {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended') audioCtx.resume();

    const osc = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();
    osc.connect(gainNode);
    gainNode.connect(audioCtx.destination);

    if (type === 'move') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(440, audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(880, audioCtx.currentTime + 0.1);
        gainNode.gain.setValueAtTime(0.5, audioCtx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.1);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.1);
    } else if (type === 'error') {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(150, audioCtx.currentTime);
        osc.frequency.linearRampToValueAtTime(100, audioCtx.currentTime + 0.2);
        gainNode.gain.setValueAtTime(0.5, audioCtx.currentTime);
        gainNode.gain.linearRampToValueAtTime(0.01, audioCtx.currentTime + 0.2);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.2);
    } else if (type === 'win') {
        osc.type = 'square';
        osc.frequency.setValueAtTime(523.25, audioCtx.currentTime);
        osc.frequency.setValueAtTime(659.25, audioCtx.currentTime + 0.1);
        osc.frequency.setValueAtTime(783.99, audioCtx.currentTime + 0.2);
        osc.frequency.setValueAtTime(1046.50, audioCtx.currentTime + 0.3);

        gainNode.gain.setValueAtTime(0.3, audioCtx.currentTime);
        gainNode.gain.linearRampToValueAtTime(0, audioCtx.currentTime + 0.6);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.6);
    }
}

// ====== DRAG AND DROP ======

let draggedDiskSize = null;
let sourcePegIndex = null;
let draggedElement = null;

function handleDragStart(e) {
    if (isAutoSolving || isPaused) {
        e.preventDefault();
        return;
    }
    draggedElement = e.target;
    draggedDiskSize = parseInt(e.target.getAttribute('data-size'));
    sourcePegIndex = parseInt(e.target.getAttribute('data-peg'));
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', draggedDiskSize);
    setTimeout(() => {
        draggedElement.classList.add('dragging');
    }, 0);
}

function handleDragEnd(e) {
    if (draggedElement) {
        draggedElement.classList.remove('dragging');
        draggedElement = null;
    }
    document.querySelectorAll('.rod-container').forEach(r => r.classList.remove('drag-over'));
}

const rodContainers = document.querySelectorAll('.rod-container');
rodContainers.forEach(container => {
    container.addEventListener('dragover', e => {
        if (isAutoSolving || isPaused) return;
        e.preventDefault();
        container.classList.add('drag-over');
    });

    container.addEventListener('dragleave', e => {
        container.classList.remove('drag-over');
    });

    container.addEventListener('drop', e => {
        e.preventDefault();
        container.classList.remove('drag-over');
        if (isAutoSolving || isPaused) return;

        const targetPegIndex = parseInt(container.getAttribute('data-rod'));
        attemptMove(sourcePegIndex, targetPegIndex);
    });
});

function attemptMove(sourceIndex, targetIndex) {
    if (sourceIndex === targetIndex) return;

    const sourcePeg = pegs[sourceIndex];
    const targetPeg = pegs[targetIndex];
    const targetTopSize = targetPeg.length > 0 ? targetPeg[targetPeg.length - 1] : Number.MAX_SAFE_INTEGER;

    const movingDiskSize = sourcePeg[sourcePeg.length - 1];

    if (movingDiskSize < targetTopSize) {
        // VALID
        sourcePeg.pop();
        targetPeg.push(movingDiskSize);
        moves++;
        clearHints();

        if (!isPlaying) {
            isPlaying = true;
            startTimer();
            if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        }

        playSound('move');
        updateDashboard();
        renderGame();
        checkWinCondition();
    } else {
        // INVALID
        playSound('error');
        const visualDisk = document.querySelector(`.disk[data-size="${movingDiskSize}"]`);
        if (visualDisk) {
            visualDisk.classList.add('invalid-shake');
            setTimeout(() => {
                visualDisk.classList.remove('invalid-shake');
            }, 400);
        }
    }
}

// ====== WIN CONDITION ======
function checkWinCondition() {
    if (pegs[2].length === numDisks) {
        stopTimer();
        isPlaying = false;

        setTimeout(() => {
            playSound('win');
            showWinModal();
        }, 300);
    }
}

function showWinModal() {
    winMoves.textContent = moves;
    winMinMoves.textContent = minMovesLimit;
    winTime.textContent = timerDisplay.textContent;

    if (moves === minMovesLimit) {
        starRating.innerHTML = '⭐⭐⭐<br><div style="font-size:1.2rem;color:gold">Perfect!</div>';
    } else if (moves <= minMovesLimit * 1.5) {
        starRating.innerHTML = '⭐⭐<br><div style="font-size:1.2rem;color:silver">Good!</div>';
    } else {
        starRating.innerHTML = '⭐<br><div style="font-size:1.2rem;color:#cd7f32">Try Again!</div>';
    }

    newBestBadge.classList.add('hidden');
    if (!bestScore || moves < bestScore) {
        bestScore = moves;
        localStorage.setItem('hanoiBestScore', bestScore);
        bestScoreDisplay.textContent = bestScore;
        newBestBadge.classList.remove('hidden');
    }

    winModal.classList.remove('hidden');
}

// ====== TIMER ======
function startTimer() {
    if (timerInterval) clearInterval(timerInterval);
    timerInterval = setInterval(() => {
        secondsElapsed++;
        updateTimerDisplay();
    }, 1000);
}

function stopTimer() {
    if (timerInterval) clearInterval(timerInterval);
    timerInterval = null;
}

function updateTimerDisplay() {
    const mins = Math.floor(secondsElapsed / 60).toString().padStart(2, '0');
    const secs = (secondsElapsed % 60).toString().padStart(2, '0');
    timerDisplay.textContent = `${mins}:${secs}`;
}

// ====== CONTROLS ======
diskSelector.addEventListener('input', () => {
    if (isPlaying && moves > 0 && !isAutoSolving) {
        if (!confirm("Changing disk count resets the game. Proceed?")) {
            diskSelector.value = numDisks;
            return;
        }
    }
    initGame();
});

btnNewGame.addEventListener('click', initGame);
btnRestart.addEventListener('click', initGame);
btnPlayAgain.addEventListener('click', initGame);

btnPause.addEventListener('click', () => {
    if (!isPlaying && moves === 0) return;
    if (isAutoSolving) return;

    isPaused = true;
    stopTimer();
    pauseModal.classList.remove('hidden');
});

btnResume.addEventListener('click', () => {
    if (isAutoSolving) return;
    isPaused = false;
    pauseModal.classList.add('hidden');
    if (isPlaying) startTimer();
    renderGame();
});

themeToggle.addEventListener('click', () => {
    document.body.classList.toggle('light-mode');
    themeToggle.textContent = document.body.classList.contains('light-mode') ? '🌙' : '☀️';
});

// ====== HINT SYSTEM ======
function getHint() {
    if (isAutoSolving || isPaused || pegs[2].length === numDisks) return;
    clearHints();

    let tops = pegs.map(p => p.length > 0 ? p[p.length - 1] : Infinity);
    let smallest = Math.min(...tops);
    if (smallest === Infinity) return;

    let sourceForSmallest = tops.indexOf(smallest);
    let targetForSmallest = (sourceForSmallest + (numDisks % 2 === 0 ? 1 : 2)) % 3;

    let bestMove = null;
    if (tops[targetForSmallest] > smallest) {
        bestMove = { from: sourceForSmallest, to: targetForSmallest, disk: smallest };
    } else {
        targetForSmallest = (sourceForSmallest + (numDisks % 2 === 0 ? 2 : 1)) % 3;
        if (tops[targetForSmallest] > smallest) bestMove = { from: sourceForSmallest, to: targetForSmallest, disk: smallest };
    }

    if (bestMove) {
        const visualDisk = document.querySelector(`.disk[data-size="${bestMove.disk}"]`);
        if (visualDisk) visualDisk.classList.add('hint');
        document.getElementById(`rod-${bestMove.to}`).classList.add('target-hint');
    }
}

function clearHints() {
    document.querySelectorAll('.hint').forEach(el => el.classList.remove('hint'));
    document.querySelectorAll('.target-hint').forEach(el => el.classList.remove('target-hint'));
}

btnHint.addEventListener('click', getHint);

// ====== AUTO SOLVE ======
class Solver {
    constructor(disks) {
        this.moves = [];
        this.solve(disks, 0, 2, 1);
    }
    solve(n, from, to, aux) {
        if (n === 0) return;
        this.solve(n - 1, from, aux, to);
        this.moves.push({ from, to });
        this.solve(n - 1, aux, to, from);
    }
}

async function startAutoSolve() {
    if (isAutoSolving) return;
    if (moves > 0 && pegs[2].length < numDisks) {
        if (!confirm("Auto Solve restarts the game. Continue?")) return;
    }

    initGame();
    isAutoSolving = true;
    renderGame();

    const solver = new Solver(numDisks);
    const delay = ms => new Promise(res => setTimeout(res, ms));

    for (let step of solver.moves) {
        if (!isAutoSolving) break;

        const movingDiskSize = pegs[step.from][pegs[step.from].length - 1];
        const visualDisk = document.querySelector(`.disk[data-size="${movingDiskSize}"]`);

        if (visualDisk) visualDisk.classList.add('hint');
        document.getElementById(`rod-${step.to}`).classList.add('target-hint');

        await delay(200);
        if (!isAutoSolving) break;

        attemptMove(step.from, step.to);
        await delay(200);
    }
}

btnAutoSolve.addEventListener('click', startAutoSolve);

// Boot
window.onload = initGame;