// Data
let students = [];
let groups = [];
let questions = [];
let history = [];
let currentQuestion = null;
let isSpinning = false;
let soundEnabled = true;
let audioContext = null;

let settings = {
    correctScore: 10,
    wrongScore: 0,
    spinDuration: 2
};

let stats = {
    totalDraws: 0,
    totalCorrect: 0
};

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    loadData();
    initTabs();
    initFileUpload();
    renderAll();
});

// Tab Navigation
function initTabs() {
    document.querySelectorAll('.nav-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
            document.querySelectorAll('.panel, .draw-panel').forEach(p => p.classList.remove('active'));
            tab.classList.add('active');
            document.getElementById(tab.dataset.panel + '-panel').classList.add('active');
        });
    });
}

// File Upload
function initFileUpload() {
    const uploadArea = document.getElementById('fileUpload');
    const fileInput = document.getElementById('fileInput');

    uploadArea.addEventListener('click', () => fileInput.click());
    uploadArea.addEventListener('dragover', (e) => {
        e.preventDefault();
        uploadArea.style.background = 'var(--white)';
    });
    uploadArea.addEventListener('dragleave', () => {
        uploadArea.style.background = 'var(--gray)';
    });
    uploadArea.addEventListener('drop', (e) => {
        e.preventDefault();
        uploadArea.style.background = 'var(--gray)';
        handleFile(e.dataTransfer.files[0]);
    });
    fileInput.addEventListener('change', (e) => {
        if (e.target.files[0]) handleFile(e.target.files[0]);
    });
}

// Students

function editStudent(index) {
    if (isSpinning) return;
    const student = students[index];
    const newScore = prompt(`调整 ${student.name} 的积分：`, student.score);
    if (newScore !== null && newScore.trim() && Number.isFinite(Number(newScore))) {
        students[index].score = Number(newScore);
        saveData();
        renderAll();
    }
}


// Questions
function addQuestion() {
    const text = document.getElementById('questionInput').value.trim();
    const options = [
        document.getElementById('option1').value.trim(),
        document.getElementById('option2').value.trim(),
        document.getElementById('option3').value.trim(),
        document.getElementById('option4').value.trim()
    ].filter(o => o);
    const correct = parseInt(document.getElementById('correctAnswer').value);

    if (!text) {
        showToast('ENTER QUESTION TEXT');
        return;
    }
    if (options.length < 2) {
        showToast('ADD AT LEAST 2 OPTIONS');
        return;
    }

    questions.push({ text, options, correct });

    document.getElementById('questionInput').value = '';
    document.getElementById('option1').value = '';
    document.getElementById('option2').value = '';
    document.getElementById('option3').value = '';
    document.getElementById('option4').value = '';

    saveData();
    renderQuestions();
    showToast('QUESTION ADDED');
}

function clearQuestions() {
    if (confirm('Clear all questions?')) {
        questions = [];
        saveData();
        renderQuestions();
        showToast('QUESTIONS CLEARED');
    }
}

function renderQuestions() {
    const list = document.getElementById('questionList');
    document.getElementById('questionCount').textContent = questions.length;

    if (questions.length === 0) {
        list.innerHTML = '<div class="empty-state"><div class="empty-state-text">No questions added</div></div>';
        return;
    }

    list.innerHTML = questions.map((q, i) => `
        <div class="question-item">
            <div class="question-item-header">${i + 1}. ${escapeHtml(q.text)}</div>
            <div class="question-item-options">
                ${q.options.map((o, j) => `
                    <span class="question-item-option ${j === q.correct ? 'correct' : ''}">${'ABCD'[j]}. ${escapeHtml(o)}</span>
                `).join('')}
            </div>
            <button class="btn" style="margin-top: 12px; padding: 8px 16px; font-size: 0.8rem;" onclick="deleteQuestion(${i})">DELETE</button>
        </div>
    `).join('');
}

function deleteQuestion(index) {
    questions.splice(index, 1);
    saveData();
    renderQuestions();
}


function showQuestion() {
    if (questions.length === 0) {
        showToast('NO QUESTIONS AVAILABLE');
        return;
    }

    currentQuestion = questions[Math.floor(Math.random() * questions.length)];
    document.getElementById('questionDisplay').style.display = 'block';
    document.getElementById('questionText').textContent = currentQuestion.text;

    const optionsEl = document.getElementById('questionOptions');
    optionsEl.innerHTML = currentQuestion.options.map((o, i) => `
        <div class="question-option" onclick="selectAnswer(${i})">
            <span class="option-letter">${'ABCD'[i]}</span>
            <span>${escapeHtml(o)}</span>
        </div>
    `).join('');
}

function selectAnswer(index) {
    const options = document.querySelectorAll('.question-option');
    options.forEach((o, i) => {
        o.classList.remove('correct', 'wrong');
        if (i === currentQuestion.correct) {
            o.classList.add('correct');
        } else if (i === index && index !== currentQuestion.correct) {
            o.classList.add('wrong');
        }
    });
}

// Leaderboard
function renderLeaderboardMini() {
    const sorted = [...students].sort((a, b) => b.score - a.score).slice(0, 5);
    const list = document.getElementById('leaderboardMini');

    if (sorted.length === 0) {
        list.innerHTML = '<div class="empty-state"><div class="empty-state-text">No data</div></div>';
        return;
    }

    list.innerHTML = sorted.map((s, i) => `
        <div class="leader-item ${i === 0 ? 'rank-1' : ''}">
            <span class="leader-rank">${i + 1}</span>
            <span class="leader-name">${escapeHtml(s.name)}</span>
            <span class="leader-score">${s.score}</span>
        </div>
    `).join('');
}

function renderLeaderboard() {
    const sorted = [...students].sort((a, b) => b.score - a.score);
    const list = document.getElementById('personalLeaderboard');

    if (sorted.length === 0) {
        list.innerHTML = '<div class="empty-state"><div class="empty-state-text">No data yet</div></div>';
        return;
    }

    list.innerHTML = sorted.slice(0, 20).map((s, i) => `
        <div class="leaderboard-item rank-${i < 3 ? i + 1 : 'other'}">
            <div class="lb-rank">#${i + 1}</div>
            <div class="lb-name">${escapeHtml(s.name)}${s.group !== null ? ` (${escapeHtml(groups[s.group]?.name || "未分组")})` : ''}</div>
            <div class="lb-score">${s.score}</div>
        </div>
    `).join('');
}

function updateStats() {
    document.getElementById('totalStudents').textContent = students.length;
    document.getElementById('totalDraws').textContent = stats.totalDraws;
    document.getElementById('totalCorrect').textContent = stats.totalCorrect;
    document.getElementById('accuracy').textContent = stats.totalDraws > 0
        ? Math.round(stats.totalCorrect / stats.totalDraws * 100) + '%'
        : '0%';
    document.getElementById('headerDraws').textContent = stats.totalDraws;
}

// Sound
function initAudio() {
    if (!audioContext) {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }
}

function playSpinSound() {
    initAudio();
    const osc = audioContext.createOscillator();
    const gain = audioContext.createGain();
    osc.connect(gain);
    gain.connect(audioContext.destination);
    osc.frequency.value = 150;
    gain.gain.value = 0.1;
    osc.start();
    osc.stop(audioContext.currentTime + 0.03);
}

function playWinSound() {
    initAudio();
    [440, 554, 659].forEach((freq, i) => {
        setTimeout(() => {
            const osc = audioContext.createOscillator();
            const gain = audioContext.createGain();
            osc.connect(gain);
            gain.connect(audioContext.destination);
            osc.frequency.value = freq;
            gain.gain.setValueAtTime(0.2, audioContext.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.2);
            osc.start();
            osc.stop(audioContext.currentTime + 0.2);
        }, i * 100);
    });
}

function toggleSound() {
    soundEnabled = !soundEnabled;
    document.getElementById('soundToggle').textContent = soundEnabled ? 'ON' : 'OFF';
    saveData();
}

// Confetti
function createConfetti() {
    const container = document.getElementById('confettiContainer');
    const colors = ['#D70050', '#000000', '#FFFFFF'];

    for (let i = 0; i < 60; i++) {
        const confetti = document.createElement('div');
        confetti.className = 'confetti';
        confetti.style.left = Math.random() * 100 + '%';
        confetti.style.background = colors[Math.floor(Math.random() * colors.length)];
        confetti.style.width = (Math.random() * 8 + 4) + 'px';
        confetti.style.height = confetti.style.width;
        confetti.style.border = '2px solid black';
        confetti.style.animationDelay = Math.random() * 0.3 + 's';
        container.appendChild(confetti);
    }

    setTimeout(() => container.innerHTML = '', 2500);
}

// Settings



function showToast(message) {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 2000);
}

// A person has one group. Drawn people stay in the roster for scoring,
// but are excluded from every candidate pool, including after reload.
let columns = ['all', 'all', 'all'];
let currentWinners = [];
let pendingDraw = null;

function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, c => ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'}[c]));
}

function availableStudents() {
    const drawnNames = new Set(history.map(h => h.name));
    return students.filter(s => !s.drawn && !drawnNames.has(s.name));
}

function poolName(pool) {
    return pool === 'all' ? '全部候选人' : pool === 'ungrouped' ? '未分组' : (groups[Number(pool)]?.name || '分组已删除');
}

function poolMembers(pool) {
    return availableStudents().filter(s => pool === 'all' || (pool === 'ungrouped' ? s.group === null : s.group === Number(pool)));
}

function groupOptions(selected, includeAll = false) {
    const options = [...(includeAll ? [['all', '全部候选人']] : []), ['ungrouped', '未分组'], ...groups.map((g, i) => [String(i), g.name])];
    return options.map(([value, label]) => `<option value="${value}" ${String(selected) === value ? 'selected' : ''}>${escapeHtml(label)}</option>`).join('');
}

function renderColumns() {
    document.getElementById('columnCount').textContent = `${columns.length} 列`;
    document.getElementById('removeColumn').disabled = isSpinning || columns.length <= 1;
    document.getElementById('addColumn').disabled = isSpinning || columns.length >= 6;
    document.getElementById('drawColumns').style.setProperty('--columns', columns.length);
    document.getElementById('drawColumns').innerHTML = columns.map((pool, i) => {
        const winner = currentWinners[i];
        return `<div class="draw-column"><label for="pool-${i}">第 ${i + 1} 列 · 抽取池</label><select id="pool-${i}" onchange="setColumnPool(${i}, this.value)" ${isSpinning ? 'disabled' : ''}>${groupOptions(pool, true)}</select><div class="pool-count">剩余 ${poolMembers(pool).length} 人</div><div class="slot-display ${winner ? 'winner' : ''}" id="slot-${i}"><span class="name-display" id="name-${i}">${winner ? escapeHtml(winner.name) : '准备就绪'}</span></div></div>`;
    }).join('');
    const error = drawError();
    document.getElementById('drawHint').textContent = error || `每次抽取 ${columns.length} 人，已抽中人员不会再次入选。`;
    document.getElementById('drawBtn').disabled = isSpinning || Boolean(error);
    document.getElementById('drawBtn').textContent = isSpinning ? '正在抽取…' : `开始抽取 ${columns.length} 人`;
}

function drawError() {
    const demand = new Map();
    for (const pool of columns) demand.set(pool, (demand.get(pool) || 0) + 1);
    for (const [pool, count] of demand) {
        if (pool !== 'all' && poolMembers(pool).length < count) return `「${poolName(pool)}」剩余 ${poolMembers(pool).length} 人，需要 ${count} 人；请调整抽取池或减少列数。`;
    }
    if (availableStudents().length < columns.length) return `候选人不足：剩余 ${availableStudents().length} 人，本次需要 ${columns.length} 人。`;
    return '';
}

function changeColumns(delta) {
    if (isSpinning) return;
    if (delta > 0 && columns.length < 6) columns.push('all');
    if (delta < 0 && columns.length > 1) columns.pop();
    clearResults();
    saveData();
    renderColumns();
}

function setColumnPool(index, pool) {
    if (isSpinning) return;
    columns[index] = pool;
    clearResults();
    saveData();
    renderColumns();
}

function clearResults() {
    currentWinners = [];
    document.getElementById('scoreActions').classList.remove('show');
    document.getElementById('questionDisplay').style.display = 'none';
}

function createGroup() {
    if (isSpinning) return;
    const input = document.getElementById('newGroupName');
    const name = input.value.trim();
    if (!name) return showToast('请输入分组名称');
    if (groups.some(g => g.name === name)) return showToast('分组名称已存在');
    groups.push({name, members: []});
    input.value = '';
    saveData();
    renderAll();
}

function renameGroup(index, value) {
    if (isSpinning) return;
    const name = value.trim();
    if (!name || groups.some((g, i) => i !== index && g.name === name)) {
        showToast('请输入不重复的分组名称');
        return renderGroups();
    }
    groups[index].name = name;
    saveData();
    renderAll();
}

function deleteGroup(index) {
    if (isSpinning || !confirm(`删除「${groups[index].name}」？成员将移至未分组，抽取记录保留。`)) return;
    groups.splice(index, 1);
    students.forEach(s => { if (s.group === index) s.group = null; else if (s.group > index) s.group--; });
    columns = columns.map(p => p === String(index) ? 'ungrouped' : /^\d+$/.test(p) && Number(p) > index ? String(Number(p) - 1) : p);
    clearResults();
    saveData();
    renderAll();
}

function moveStudent(index, pool) {
    if (isSpinning) return;
    students[index].group = pool === 'ungrouped' ? null : Number(pool);
    saveData();
    renderAll();
}

function addNames(text, group) {
    const known = new Set([...students.map(s => s.name), ...history.map(h => h.name)]);
    let added = 0;
    text.split(/\r?\n/).map(n => n.trim()).filter(Boolean).forEach(name => {
        if (known.has(name)) return;
        known.add(name);
        students.push({name, score: 0, group, drawn: false});
        added++;
    });
    saveData();
    renderAll();
    showToast(`已添加 ${added} 人；重复或已抽中姓名已跳过`);
}

function addStudents() {
    if (isSpinning) return;
    const input = document.getElementById('studentInput');
    const pool = document.getElementById('addGroup').value;
    addNames(input.value, pool === 'ungrouped' ? null : Number(pool));
    input.value = '';
}

function handleFile(file) {
    if (isSpinning || !file) return;
    const pool = document.getElementById('addGroup').value;
    const reader = new FileReader();
    reader.onload = e => {
        if (isSpinning) return showToast('正在抽取，请稍后重新导入');
        const group = pool === 'ungrouped' || !groups[Number(pool)] ? null : Number(pool);
        addNames(e.target.result, group);
    };
    reader.onerror = () => showToast('文件读取失败');
    reader.readAsText(file);
}

function clearStudents() {
    if (isSpinning || !confirm('清空剩余候选人？已抽取人员和历史记录保留。')) return;
    const available = new Set(availableStudents());
    students = students.filter(s => !available.has(s));
    saveData();
    renderAll();
}

function renderStudents() {
    const remaining = new Set(availableStudents());
    document.getElementById('studentCount').textContent = remaining.size;
    document.getElementById('headerTotal').textContent = remaining.size;
    const select = document.getElementById('addGroup');
    const selected = select.value || 'ungrouped';
    select.innerHTML = groupOptions(selected);
    document.getElementById('studentGrid').innerHTML = students.map((s, i) => remaining.has(s) ? `<div class="student-card"><div class="student-name">${escapeHtml(s.name)}</div><div class="student-score">${s.score} 分</div><select aria-label="${escapeHtml(s.name)}的分组" onchange="moveStudent(${i}, this.value)">${groupOptions(s.group === null ? 'ungrouped' : s.group)}</select><button class="btn" onclick="editStudent(${i})">调整积分</button></div>` : '').join('') || '<div class="empty-state">暂无候选人，请添加名单。</div>';
}

function randomizeGroups() {
    if (isSpinning) return;
    const count = Number(document.getElementById('groupCount').value);
    if (!Number.isInteger(count) || count < 1 || count > 20) return showToast('分组数量应为 1–20');
    if (students.length < count) return showToast('人数不足，无法分组');
    if (groups.length && !confirm('重新随机分组将替换当前分组及成员归属，是否继续？')) return;
    groups = Array.from({length: count}, (_, i) => ({name: `分组 ${i + 1}`, members: []}));
    const shuffled = [...students];
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    shuffled.forEach((s, i) => s.group = i % count);
    columns = columns.map((_, i) => String(i % count));
    clearResults();
    saveData();
    renderAll();
}

function clearGroups() {
    if (isSpinning || !confirm('清空全部分组？成员移至未分组，抽取记录保留。')) return;
    students.forEach(s => s.group = null);
    groups = [];
    columns = columns.map(() => 'all');
    clearResults();
    saveData();
    renderAll();
}

function renderGroups() {
    const available = new Set(availableStudents());
    document.getElementById('groupContainer').innerHTML = groups.map((g, i) => {
        const members = students.filter(s => s.group === i);
        return `<div class="group-card"><div class="group-header"><input type="text" aria-label="分组 ${i + 1} 名称" maxlength="60" value="${escapeHtml(g.name)}" onchange="renameGroup(${i}, this.value)"><button class="btn" onclick="deleteGroup(${i})">删除</button></div><div class="group-members"><p>剩余 ${members.filter(s => available.has(s)).length} / ${members.length} 人</p>${members.map(s => `<span class="group-member">${escapeHtml(s.name)}${available.has(s) ? '' : ' · 已抽中'}</span>`).join('') || '暂无成员，请在候选人页面添加。'}</div></div>`;
    }).join('') || '<div class="empty-state">暂无分组，请先创建。</div>';
    const scores = groups.map((g, i) => ({name: g.name, score: students.filter(s => s.group === i).reduce((sum, s) => sum + s.score, 0)})).sort((a, b) => b.score - a.score);
    document.getElementById('groupLeaderboard').innerHTML = scores.map((g, i) => `<div class="leader-item"><span class="leader-rank">${i + 1}</span><span class="leader-name">${escapeHtml(g.name)}</span><span>${g.score}</span></div>`).join('');
}

function startDraw() {
    if (isSpinning) return;
    const error = drawError();
    if (error) return showToast(error);
    clearResults();
    // Specific pools first: the unrestricted pool must not consume their last member.
    const order = columns.map((pool, index) => ({pool, index})).sort((a, b) => Number(a.pool === 'all') - Number(b.pool === 'all'));
    const used = new Set();
    pendingDraw = new Array(columns.length);
    for (const {pool, index} of order) {
        const candidates = poolMembers(pool).filter(s => !used.has(s.name));
        const winner = candidates[Math.floor(Math.random() * candidates.length)];
        used.add(winner.name);
        pendingDraw[index] = {student: winner, groupName: poolName(pool), actualGroup: winner.group === null ? '未分组' : groups[winner.group].name};
    }
    isSpinning = true;
    renderColumns();
    const pools = columns.map(poolMembers);
    document.querySelectorAll('#drawColumns .name-display').forEach(el => el.classList.add('spinning'));
    // Disable configuration for the entire animation, including other tabs.
    document.querySelectorAll('main button, main input, main select, main textarea').forEach(el => { el.dataset.drawDisabled = String(el.disabled); el.disabled = true; });
    if (soundEnabled) { try { playSpinSound(); } catch (e) { /* Audio is optional. */ } }
    const spin = setInterval(() => pools.forEach((pool, i) => {
        document.getElementById(`name-${i}`).textContent = pool[Math.floor(Math.random() * pool.length)].name;
    }), 60);
    setTimeout(() => { clearInterval(spin); finishDraw(); }, settings.spinDuration * 1000);
}

function finishDraw() {
    if (!pendingDraw) return;
    const time = new Date().toISOString();
    const round = history.reduce((max, h) => Math.max(max, h.round || 0), 0) + 1;
    currentWinners = pendingDraw.map(({student, groupName, actualGroup}, i) => {
        student.drawn = true;
        return {name: student.name, groupName, actualGroup, column: i + 1, round, time, correct: null, score: null};
    });
    history.unshift(...currentWinners);
    stats.totalDraws += currentWinners.length;
    pendingDraw = null;
    isSpinning = false;
    document.querySelectorAll('[data-draw-disabled]').forEach(el => { el.disabled = el.dataset.drawDisabled === 'true'; delete el.dataset.drawDisabled; });
    saveData();
    renderAll();
    renderScoreActions();
    if (soundEnabled) { try { playWinSound(); } catch (e) { /* Audio is optional. */ } }
    createConfetti();
}

function renderScoreActions() {
    const container = document.getElementById('scoreActions');
    container.classList.toggle('show', currentWinners.length > 0);
    container.innerHTML = currentWinners.map((h, i) => `<div class="score-row"><strong>${escapeHtml(h.name)}</strong>${h.correct === null ? `<button class="btn btn-correct" onclick="markAnswer(true, ${i})">答对 ${settings.correctScore >= 0 ? '+' : ''}${settings.correctScore}</button><button class="btn btn-wrong" onclick="markAnswer(false, ${i})">答错 ${settings.wrongScore >= 0 ? '+' : ''}${settings.wrongScore}</button>` : '<span>已评分</span>'}</div>`).join('') + '<button class="btn" onclick="showQuestion()">显示题目</button>';
}

function markAnswer(correct, index = 0) {
    const record = currentWinners[index];
    if (!record || record.correct !== null || isSpinning) return;
    record.correct = correct;
    record.score = correct ? settings.correctScore : settings.wrongScore;
    const student = students.find(s => s.name === record.name);
    if (student) student.score += record.score;
    if (correct) stats.totalCorrect++;
    saveData();
    renderAll();
    renderScoreActions();
}

function clearHistory() {
    if (isSpinning || history.length === 0) return;
    if (!confirm('仅清空抽取记录？名单、分组、积分和已抽中状态将保留，已抽中的人仍不会再次入选。')) return;
    const drawnNames = new Set(history.map(h => h.name));
    students.forEach(s => { if (drawnNames.has(s.name)) s.drawn = true; });
    history = [];
    clearResults();
    saveData();
    renderAll();
    showToast('抽取记录已清空，已抽中状态保留');
}

function renderHistory() {
    document.getElementById('historyCount').textContent = history.length;
    document.getElementById('clearHistoryBtn').disabled = isSpinning || history.length === 0;
    document.getElementById('historyList').innerHTML = history.map(h => {
        const date = new Date(h.time);
        const time = Number.isNaN(date.getTime()) ? h.time : date.toLocaleString('zh-CN', {hour12: false});
        return `<div class="history-item ${h.correct === true ? 'correct' : h.correct === false ? 'wrong' : ''}"><strong>${escapeHtml(h.name)}</strong><span>${h.round ? `第 ${h.round} 轮 · 第 ${h.column} 列 · ` : '历史记录 · '}${escapeHtml(h.groupName || '旧版抽取')}</span><small>${escapeHtml(time || '')}${h.actualGroup ? ` · 所属：${escapeHtml(h.actualGroup)}` : ''}</small>${h.score !== null && h.score !== undefined ? `<span>${h.correct ? '答对' : '答错'} · ${h.score} 分</span>` : '<small>已移出候选池</small>'}</div>`;
    }).join('') || '<div class="empty-state">暂无抽取记录</div>';
}

function saveSettings() {
    if (isSpinning) return;
    settings.correctScore = Math.max(1, Math.min(100, Number(document.getElementById('correctScore').value) || 10));
    settings.wrongScore = Math.max(-100, Math.min(100, Number(document.getElementById('wrongScore').value) || 0));
    settings.spinDuration = Math.max(1, Math.min(10, Number(document.getElementById('spinDuration').value) || 2));
    syncSettings();
    saveData();
    renderScoreActions();
}

function dataSnapshot() {
    return {version: 2, students, groups: groups.map((g, i) => ({...g, members: students.filter(s => s.group === i).map(s => s.name)})), questions, history, settings, stats, soundEnabled, columns};
}

function saveData() {
    try { localStorage.setItem('pickone_data', JSON.stringify(dataSnapshot())); }
    catch (e) { showToast('保存失败：浏览器存储不可用或已满，请立即导出数据备份。'); }
}

function applyData(data) {
    if (!data || !Array.isArray(data.students) || !Array.isArray(data.groups)) throw new Error('Invalid roster');
    const nextGroups = data.groups.map(g => {
        if (!g || typeof g.name !== 'string' || !g.name.trim()) throw new Error('Invalid group');
        return {name: g.name.trim(), members: []};
    });
    const nextHistory = data.history || [];
    if (!Array.isArray(nextHistory) || nextHistory.some(h => !h || typeof h.name !== 'string')) throw new Error('Invalid history');
    const names = new Set();
    const drawn = new Set(nextHistory.map(h => h.name));
    const nextStudents = data.students.map(s => {
        if (!s || typeof s.name !== 'string' || !s.name.trim() || names.has(s.name.trim())) throw new Error('Invalid candidate');
        const name = s.name.trim();
        names.add(name);
        return {name, score: Number.isFinite(s.score) ? s.score : 0, group: Number.isInteger(s.group) && s.group >= 0 && s.group < nextGroups.length ? s.group : null, drawn: s.drawn === true || drawn.has(name)};
    });
    const nextQuestions = data.questions || [];
    if (!Array.isArray(nextQuestions) || nextQuestions.some(q => !q || typeof q.text !== 'string' || !Array.isArray(q.options) || q.options.some(o => typeof o !== 'string') || !Number.isInteger(q.correct) || q.correct < 0 || q.correct >= q.options.length)) throw new Error('Invalid questions');
    const nextColumns = Array.isArray(data.columns) && data.columns.length >= 1 && data.columns.length <= 6 ? data.columns.map(p => ['all', 'ungrouped'].includes(p) || (/^\d+$/.test(String(p)) && nextGroups[Number(p)]) ? String(p) : 'all') : ['all', 'all', 'all'];
    students = nextStudents;
    groups = nextGroups;
    history = nextHistory.map(h => ({...h, round: Number.isInteger(h.round) && h.round > 0 ? h.round : 0, correct: typeof h.correct === 'boolean' ? h.correct : null, score: Number.isFinite(h.score) ? h.score : null}));
    questions = nextQuestions;
    columns = nextColumns;
    settings = {correctScore: Math.max(1, Math.min(100, Number(data.settings?.correctScore) || 10)), wrongScore: Math.max(-100, Math.min(100, Number(data.settings?.wrongScore) || 0)), spinDuration: Math.max(1, Math.min(10, Number(data.settings?.spinDuration) || 2))};
    stats = {totalDraws: Math.max(history.length, Number(data.stats?.totalDraws) || 0), totalCorrect: Math.max(history.filter(h => h.correct === true).length, Number(data.stats?.totalCorrect) || 0)};
    soundEnabled = data.soundEnabled !== false;
    clearResults();
    syncSettings();
}

function syncSettings() {
    ['correctScore', 'wrongScore', 'spinDuration'].forEach(key => document.getElementById(key).value = settings[key]);
    document.getElementById('soundToggle').textContent = soundEnabled ? 'ON' : 'OFF';
}

function loadData() {
    try {
        const data = localStorage.getItem('pickone_data');
        if (data) applyData(JSON.parse(data));
    } catch (e) { showToast('本地数据读取失败，原存档未改动，请检查备份。'); }
}

function exportData() {
    const blob = new Blob([JSON.stringify(dataSnapshot(), null, 2)], {type: 'application/json'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `luckyone_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    showToast('数据已导出');
}

function importData(event) {
    if (isSpinning) return;
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = e => {
        if (isSpinning) return showToast('正在抽取，请稍后重新导入');
        try {
            const data = JSON.parse(e.target.result);
            if (!confirm('导入备份将替换当前名单、分组和抽取记录，是否继续？')) return;
            applyData(data);
            saveData();
            renderAll();
            showToast('数据已导入');
        } catch (err) { showToast('导入失败：请使用有效的数据备份，当前数据未改动。'); }
        event.target.value = '';
    };
    reader.onerror = () => showToast('文件读取失败');
    reader.readAsText(file);
}

function resetAllData() {
    if (isSpinning) return;
    if (confirm('重置全部数据将删除所有名单、分组和抽取记录，且无法撤销。是否继续？')) {
        localStorage.removeItem('pickone_data');
        location.reload();
    }
}

function renderAll() {
    renderStudents();
    renderGroups();
    renderQuestions();
    renderHistory();
    renderLeaderboard();
    renderLeaderboardMini();
    updateStats();
    renderColumns();
}
