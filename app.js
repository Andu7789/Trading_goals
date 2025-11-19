// Data Management
let challenges = [];
let payouts = [];
let balanceHistory = {};

const GOAL_AMOUNT = 50000;

// Charts
let payoutChart = null;
let balanceChart = null;
let challengeDetailChart = null;

// Current challenge being viewed
let currentChallengeId = null;

// Initialize App
document.addEventListener('DOMContentLoaded', () => {
    loadData();
    initCharts();
    updateDashboard();
    renderChallenges();
    renderPayouts();
    setDefaultDates();
});

// Local Storage Management
function saveData() {
    localStorage.setItem('challenges', JSON.stringify(challenges));
    localStorage.setItem('payouts', JSON.stringify(payouts));
    localStorage.setItem('balanceHistory', JSON.stringify(balanceHistory));
}

function loadData() {
    const savedChallenges = localStorage.getItem('challenges');
    const savedPayouts = localStorage.getItem('payouts');
    const savedBalanceHistory = localStorage.getItem('balanceHistory');

    if (savedChallenges) challenges = JSON.parse(savedChallenges);
    if (savedPayouts) payouts = JSON.parse(savedPayouts);
    if (savedBalanceHistory) balanceHistory = JSON.parse(savedBalanceHistory);
}

function setDefaultDates() {
    const today = new Date().toISOString().split('T')[0];
    const startDateInput = document.getElementById('startDate');
    const balanceDateInput = document.getElementById('balanceDate');
    const payoutDateInput = document.getElementById('payoutDate');

    if (startDateInput) startDateInput.value = today;
    if (balanceDateInput) balanceDateInput.value = today;
    if (payoutDateInput) payoutDateInput.value = today;
}

// Dashboard Updates
function updateDashboard() {
    const totalPayouts = calculateTotalPayouts();
    const unrealizedProfit = calculateUnrealizedProfit();
    const remaining = GOAL_AMOUNT - totalPayouts;
    const progressPercent = (totalPayouts / GOAL_AMOUNT) * 100;

    // Update main goal metrics
    document.getElementById('totalPayouts').textContent = `£${formatNumber(totalPayouts)}`;
    document.getElementById('remaining').textContent = `£${formatNumber(remaining)}`;
    document.getElementById('unrealizedProfit').textContent = `£${formatNumber(unrealizedProfit)}`;
    document.getElementById('progressPercent').textContent = `${progressPercent.toFixed(1)}%`;

    // Update progress bar
    const progressBar = document.getElementById('progressBar');
    progressBar.style.width = `${Math.min(progressPercent, 100)}%`;

    // Update stats cards
    const activeChallenges = challenges.filter(c => c.status === 'active').length;

    // Filter out challenges that started as funded accounts for success rate calculation
    const eligibleChallenges = challenges.filter(c => !c.startedAsFunded);

    const completedChallenges = eligibleChallenges.filter(c => c.status === 'passed' || c.status === 'funded').length;
    const totalEligibleChallenges = eligibleChallenges.length;
    const successRate = totalEligibleChallenges > 0 ? ((completedChallenges / totalEligibleChallenges) * 100) : 0;
    const avgPayout = payouts.length > 0 ? (totalPayouts / payouts.length) : 0;

    document.getElementById('activeChallenges').textContent = activeChallenges;
    document.getElementById('completedChallenges').textContent = completedChallenges;
    document.getElementById('successRate').textContent = `${successRate.toFixed(1)}%`;
    document.getElementById('avgPayout').textContent = `£${formatNumber(avgPayout)}`;

    updateCharts();
}

function calculateTotalPayouts() {
    return payouts.reduce((sum, payout) => sum + parseFloat(payout.amount), 0);
}

function calculateUnrealizedProfit() {
    return challenges.reduce((sum, challenge) => {
        const profit = parseFloat(challenge.currentBalance) - parseFloat(challenge.initialBalance);
        return sum + (profit > 0 ? profit : 0);
    }, 0);
}

function formatNumber(num) {
    return num.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

// Challenge Management
function showAddChallengeModal(challengeId = null) {
    const modal = document.getElementById('addChallengeModal');
    const form = document.getElementById('challengeForm');
    const title = document.getElementById('challengeModalTitle');

    form.reset();

    if (challengeId) {
        title.textContent = 'Edit Challenge Account';
        const challenge = challenges.find(c => c.id === challengeId);
        if (challenge) {
            document.getElementById('challengeId').value = challenge.id;
            document.getElementById('challengeName').value = challenge.name;
            document.getElementById('challengeProvider').value = challenge.provider;
            document.getElementById('initialBalance').value = challenge.initialBalance;
            document.getElementById('currentBalance').value = challenge.currentBalance;
            document.getElementById('challengeStatus').value = challenge.status;
            document.getElementById('startDate').value = challenge.startDate;
        }
    } else {
        title.textContent = 'Add Challenge Account';
        setDefaultDates();
    }

    modal.classList.add('active');
}

function saveChallengeAccount(event) {
    event.preventDefault();

    const id = document.getElementById('challengeId').value || Date.now().toString();
    const name = document.getElementById('challengeName').value;
    const provider = document.getElementById('challengeProvider').value;
    const initialBalance = parseFloat(document.getElementById('initialBalance').value);
    const currentBalance = parseFloat(document.getElementById('currentBalance').value);
    const status = document.getElementById('challengeStatus').value;
    const startDate = document.getElementById('startDate').value;

    const existingIndex = challenges.findIndex(c => c.id === id);

    const challenge = {
        id,
        name,
        provider,
        initialBalance,
        currentBalance,
        status,
        startDate,
        createdAt: new Date().toISOString(),
        // Mark if this account started as funded (not a challenge to complete)
        startedAsFunded: existingIndex < 0 ? (status === 'funded') : challenges[existingIndex].startedAsFunded
    };

    if (existingIndex >= 0) {
        challenges[existingIndex] = challenge;
    } else {
        challenges.push(challenge);
        // Initialize balance history for new challenge
        balanceHistory[id] = [{
            date: startDate,
            balance: initialBalance,
            notes: 'Initial balance',
            timestamp: new Date().toISOString()
        }];
        if (currentBalance !== initialBalance) {
            balanceHistory[id].push({
                date: new Date().toISOString().split('T')[0],
                balance: currentBalance,
                notes: 'Current balance',
                timestamp: new Date().toISOString()
            });
        }
    }

    saveData();
    updateDashboard();
    renderChallenges();
    closeModal('addChallengeModal');
}

function deleteChallenge(challengeId) {
    if (confirm('Are you sure you want to delete this challenge? This action cannot be undone.')) {
        challenges = challenges.filter(c => c.id !== challengeId);
        delete balanceHistory[challengeId];
        saveData();
        updateDashboard();
        renderChallenges();
    }
}

function renderChallenges() {
    const grid = document.getElementById('challengesGrid');

    if (challenges.length === 0) {
        grid.innerHTML = '<div class="empty-state"><p>No challenges yet. Add your first challenge to start tracking!</p></div>';
        return;
    }

    grid.innerHTML = challenges.map(challenge => {
        const profit = parseFloat(challenge.currentBalance) - parseFloat(challenge.initialBalance);
        const profitPercent = (profit / parseFloat(challenge.initialBalance)) * 100;
        const profitClass = profit >= 0 ? 'positive' : 'negative';
        const profitSign = profit >= 0 ? '+' : '';

        return `
            <div class="challenge-card ${challenge.status}" onclick="showChallengeDetail('${challenge.id}')" style="cursor: pointer;">
                <div class="challenge-header">
                    <div>
                        <div class="challenge-title">${challenge.name}</div>
                        <div class="challenge-provider">${challenge.provider || 'No provider'}</div>
                    </div>
                    <span class="challenge-status ${challenge.status}">${challenge.status}</span>
                </div>

                <div class="challenge-balance">
                    <div class="balance-label">Current Balance</div>
                    <div class="balance-amount">£${formatNumber(parseFloat(challenge.currentBalance))}</div>
                    <div class="balance-change ${profitClass}">
                        ${profitSign}£${formatNumber(Math.abs(profit))} (${profitSign}${profitPercent.toFixed(2)}%)
                    </div>
                </div>

                <div class="challenge-progress">
                    <div style="display: flex; justify-content: space-between; font-size: 0.85rem; color: var(--text-secondary);">
                        <span>Initial: £${formatNumber(parseFloat(challenge.initialBalance))}</span>
                        <span>${challenge.startDate || 'No date'}</span>
                    </div>
                </div>

                <div class="challenge-actions">
                    <button class="btn btn-secondary btn-small" onclick="event.stopPropagation(); showBalanceModal('${challenge.id}')">
                        Record Balance
                    </button>
                    <button class="btn btn-secondary btn-small" onclick="event.stopPropagation(); showAddChallengeModal('${challenge.id}')">
                        Edit
                    </button>
                    <button class="btn btn-danger btn-small" onclick="event.stopPropagation(); deleteChallenge('${challenge.id}')">
                        Delete
                    </button>
                </div>
            </div>
        `;
    }).join('');
}

// Balance Tracking
function showBalanceModal(challengeId) {
    const modal = document.getElementById('addBalanceModal');
    const challenge = challenges.find(c => c.id === challengeId);

    if (!challenge) return;

    document.getElementById('balanceChallengeId').value = challengeId;
    document.getElementById('balanceAmount').value = challenge.currentBalance;
    setDefaultDates();

    modal.classList.add('active');
}

function saveBalanceEntry(event) {
    event.preventDefault();

    const challengeId = document.getElementById('balanceChallengeId').value;
    const date = document.getElementById('balanceDate').value;
    const balance = parseFloat(document.getElementById('balanceAmount').value);
    const notes = document.getElementById('balanceNotes').value;

    // Update challenge current balance
    const challenge = challenges.find(c => c.id === challengeId);
    if (challenge) {
        challenge.currentBalance = balance;
    }

    // Add to balance history
    if (!balanceHistory[challengeId]) {
        balanceHistory[challengeId] = [];
    }

    balanceHistory[challengeId].push({
        date,
        balance,
        notes,
        timestamp: new Date().toISOString()
    });

    // Sort by date
    balanceHistory[challengeId].sort((a, b) => new Date(a.date) - new Date(b.date));

    saveData();
    updateDashboard();
    renderChallenges();
    closeModal('addBalanceModal');

    // Clear form
    document.getElementById('balanceForm').reset();
}

// Payout Management
function showAddPayoutModal() {
    const modal = document.getElementById('addPayoutModal');
    document.getElementById('payoutForm').reset();
    setDefaultDates();
    modal.classList.add('active');
}

function savePayout(event) {
    event.preventDefault();

    const amount = parseFloat(document.getElementById('payoutAmount').value);
    const date = document.getElementById('payoutDate').value;
    const source = document.getElementById('payoutSource').value;
    const notes = document.getElementById('payoutNotes').value;

    const payout = {
        id: Date.now().toString(),
        amount,
        date,
        source,
        notes,
        createdAt: new Date().toISOString()
    };

    payouts.push(payout);
    payouts.sort((a, b) => new Date(b.date) - new Date(a.date));

    saveData();
    updateDashboard();
    renderPayouts();
    closeModal('addPayoutModal');
}

function deletePayout(payoutId) {
    if (confirm('Are you sure you want to delete this payout?')) {
        payouts = payouts.filter(p => p.id !== payoutId);
        saveData();
        updateDashboard();
        renderPayouts();
    }
}

function renderPayouts() {
    const list = document.getElementById('payoutsList');

    if (payouts.length === 0) {
        list.innerHTML = '<div class="empty-state"><p>No payouts recorded yet. Record your first payout to track your progress!</p></div>';
        return;
    }

    list.innerHTML = payouts.map(payout => `
        <div class="payout-item">
            <div class="payout-info">
                <div class="payout-amount-large">£${formatNumber(parseFloat(payout.amount))}</div>
                <div class="payout-details">
                    <span>${formatDate(payout.date)}</span>
                    ${payout.source ? `<span>• ${payout.source}</span>` : ''}
                    ${payout.notes ? `<span>• ${payout.notes}</span>` : ''}
                </div>
            </div>
            <div class="payout-actions">
                <button class="btn btn-danger btn-small" onclick="deletePayout('${payout.id}')">Delete</button>
            </div>
        </div>
    `).join('');
}

function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

// Charts
function initCharts() {
    const payoutCtx = document.getElementById('payoutChart').getContext('2d');
    const balanceCtx = document.getElementById('balanceChart').getContext('2d');

    const chartOptions = {
        responsive: true,
        maintainAspectRatio: true,
        plugins: {
            legend: {
                labels: {
                    color: '#f1f5f9'
                }
            }
        },
        scales: {
            y: {
                beginAtZero: true,
                ticks: {
                    color: '#94a3b8',
                    callback: function(value) {
                        return '£' + value.toLocaleString();
                    }
                },
                grid: {
                    color: '#334155'
                }
            },
            x: {
                ticks: {
                    color: '#94a3b8'
                },
                grid: {
                    color: '#334155'
                }
            }
        }
    };

    payoutChart = new Chart(payoutCtx, {
        type: 'line',
        data: {
            labels: [],
            datasets: [{
                label: 'Cumulative Payouts',
                data: [],
                borderColor: '#10b981',
                backgroundColor: 'rgba(16, 185, 129, 0.1)',
                fill: true,
                tension: 0.4
            }]
        },
        options: chartOptions
    });

    balanceChart = new Chart(balanceCtx, {
        type: 'line',
        data: {
            labels: [],
            datasets: []
        },
        options: {
            ...chartOptions,
            plugins: {
                legend: {
                    labels: {
                        color: '#f1f5f9'
                    }
                }
            }
        }
    });
}

function updateCharts() {
    updatePayoutChart();
    updateBalanceChart();
}

function updatePayoutChart() {
    if (!payoutChart) return;

    const sortedPayouts = [...payouts].sort((a, b) => new Date(a.date) - new Date(b.date));

    let cumulative = 0;
    const labels = [];
    const data = [];

    // Add starting point
    if (sortedPayouts.length > 0) {
        labels.push('Start');
        data.push(0);
    }

    sortedPayouts.forEach(payout => {
        cumulative += parseFloat(payout.amount);
        labels.push(formatDate(payout.date));
        data.push(cumulative);
    });

    // Add goal line
    if (sortedPayouts.length > 0) {
        labels.push('Goal');
        data.push(GOAL_AMOUNT);
    }

    payoutChart.data.labels = labels;
    payoutChart.data.datasets[0].data = data;
    payoutChart.update();
}

function updateBalanceChart() {
    if (!balanceChart) return;

    const datasets = [];
    const colors = [
        '#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6',
        '#ec4899', '#14b8a6', '#f97316', '#06b6d4', '#84cc16'
    ];

    challenges.forEach((challenge, index) => {
        const history = balanceHistory[challenge.id] || [];
        if (history.length > 0) {
            const sortedHistory = [...history].sort((a, b) => new Date(a.date) - new Date(b.date));

            datasets.push({
                label: challenge.name,
                data: sortedHistory.map(entry => entry.balance),
                borderColor: colors[index % colors.length],
                backgroundColor: 'transparent',
                tension: 0.4
            });
        }
    });

    // Get all unique dates
    const allDates = new Set();
    Object.values(balanceHistory).forEach(history => {
        history.forEach(entry => allDates.add(entry.date));
    });

    const sortedDates = Array.from(allDates).sort((a, b) => new Date(a) - new Date(b));

    balanceChart.data.labels = sortedDates.map(date => formatDate(date));
    balanceChart.data.datasets = datasets;
    balanceChart.update();
}

// Challenge Detail View
function showChallengeDetail(challengeId) {
    const challenge = challenges.find(c => c.id === challengeId);
    if (!challenge) return;

    currentChallengeId = challengeId;

    // Update modal title and stats
    document.getElementById('challengeDetailTitle').textContent = challenge.name;

    const profit = parseFloat(challenge.currentBalance) - parseFloat(challenge.initialBalance);
    const profitPercent = (profit / parseFloat(challenge.initialBalance)) * 100;
    const profitClass = profit >= 0 ? 'positive' : 'negative';
    const profitSign = profit >= 0 ? '+' : '';

    document.getElementById('detailCurrentBalance').textContent = `£${formatNumber(parseFloat(challenge.currentBalance))}`;
    document.getElementById('detailInitialBalance').textContent = `£${formatNumber(parseFloat(challenge.initialBalance))}`;

    const profitLossElement = document.getElementById('detailProfitLoss');
    profitLossElement.textContent = `${profitSign}£${formatNumber(Math.abs(profit))}`;
    profitLossElement.className = `detail-stat-value ${profitClass}`;

    const returnElement = document.getElementById('detailReturn');
    returnElement.textContent = `${profitSign}${profitPercent.toFixed(2)}%`;
    returnElement.className = `detail-stat-value ${profitClass}`;

    // Render balance history
    renderBalanceHistory(challengeId);

    // Initialize or update chart
    updateChallengeDetailChart(challengeId);

    // Show modal
    document.getElementById('challengeDetailModal').classList.add('active');
}

function renderBalanceHistory(challengeId) {
    const list = document.getElementById('balanceHistoryList');
    const history = balanceHistory[challengeId] || [];

    if (history.length === 0) {
        list.innerHTML = '<div class="empty-state">No balance entries yet.</div>';
        return;
    }

    const sortedHistory = [...history].sort((a, b) => new Date(b.date) - new Date(a.date));

    list.innerHTML = sortedHistory.map((entry, index) => {
        const nextEntry = sortedHistory[index + 1];
        let changeHtml = '';

        if (nextEntry) {
            const change = parseFloat(entry.balance) - parseFloat(nextEntry.balance);
            const changeClass = change >= 0 ? 'positive' : 'negative';
            const changeSign = change >= 0 ? '+' : '';
            changeHtml = `
                <div class="balance-entry-change ${changeClass}">
                    ${changeSign}£${formatNumber(Math.abs(change))}
                </div>
            `;
        }

        return `
            <div class="balance-entry">
                <div class="balance-entry-info">
                    <div class="balance-entry-amount">£${formatNumber(parseFloat(entry.balance))}</div>
                    <div class="balance-entry-date">${formatDate(entry.date)}</div>
                    ${entry.notes ? `<div class="balance-entry-notes">${entry.notes}</div>` : ''}
                </div>
                ${changeHtml}
                <div class="balance-entry-actions">
                    <button class="btn btn-danger btn-small" onclick="deleteBalanceEntry('${challengeId}', '${entry.timestamp || entry.date}')">Delete</button>
                </div>
            </div>
        `;
    }).join('');
}

function updateChallengeDetailChart(challengeId) {
    const history = balanceHistory[challengeId] || [];

    if (history.length === 0) return;

    const sortedHistory = [...history].sort((a, b) => new Date(a.date) - new Date(b.date));
    const labels = sortedHistory.map(entry => formatDate(entry.date));
    const data = sortedHistory.map(entry => parseFloat(entry.balance));

    const ctx = document.getElementById('challengeDetailChart');

    if (challengeDetailChart) {
        challengeDetailChart.destroy();
    }

    challengeDetailChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Balance',
                data: data,
                borderColor: '#10b981',
                backgroundColor: 'rgba(16, 185, 129, 0.1)',
                fill: true,
                tension: 0.4,
                pointRadius: 5,
                pointHoverRadius: 7,
                pointBackgroundColor: '#10b981',
                pointBorderColor: '#fff',
                pointBorderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    backgroundColor: '#1e293b',
                    titleColor: '#f1f5f9',
                    bodyColor: '#f1f5f9',
                    borderColor: '#334155',
                    borderWidth: 1,
                    padding: 12,
                    displayColors: false,
                    callbacks: {
                        label: function(context) {
                            return '£' + formatNumber(context.parsed.y);
                        }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: false,
                    ticks: {
                        color: '#94a3b8',
                        callback: function(value) {
                            return '£' + value.toLocaleString();
                        }
                    },
                    grid: {
                        color: '#334155'
                    }
                },
                x: {
                    ticks: {
                        color: '#94a3b8',
                        maxRotation: 45,
                        minRotation: 45
                    },
                    grid: {
                        color: '#334155'
                    }
                }
            }
        }
    });
}

function showBalanceModalFromDetail() {
    if (currentChallengeId) {
        showBalanceModal(currentChallengeId);
    }
}

function deleteBalanceEntry(challengeId, timestamp) {
    if (!confirm('Are you sure you want to delete this balance entry?')) return;

    const history = balanceHistory[challengeId] || [];
    balanceHistory[challengeId] = history.filter(entry => {
        const entryTimestamp = entry.timestamp || entry.date;
        return entryTimestamp !== timestamp;
    });

    // Update challenge current balance to the latest entry
    const challenge = challenges.find(c => c.id === challengeId);
    if (challenge && balanceHistory[challengeId].length > 0) {
        const sortedHistory = [...balanceHistory[challengeId]].sort((a, b) => new Date(b.date) - new Date(a.date));
        challenge.currentBalance = sortedHistory[0].balance;
    }

    saveData();
    updateDashboard();
    renderChallenges();

    // Refresh detail view if it's open
    if (currentChallengeId === challengeId) {
        renderBalanceHistory(challengeId);
        updateChallengeDetailChart(challengeId);
        showChallengeDetail(challengeId); // Refresh stats
    }
}

// Modal Management
function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    modal.classList.remove('active');
}

// Note: Modals only close via buttons or ESC key, not by clicking outside
