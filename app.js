// Data Management
let challenges = [];
let payouts = [];
let balanceHistory = {};
let rEntries = [];

const GOAL_AMOUNT = 50000;
const R_GOAL = 20;

// Charts
let payoutChart = null;
let challengeDetailChart = null;
let rMiniChart = null;
let rHistoryChart = null;

// Current challenge being viewed
let currentChallengeId = null;

// GitHub Sync
let githubToken = null;
let gistId = null;

// Initialize App
document.addEventListener('DOMContentLoaded', () => {
    loadData();
    loadGitHubConfig();
    initCharts();
    updateDashboard();
    updateRTracker();
    renderChallenges();
    renderPayouts();
    renderScalingTable();
    setDefaultDates();
    updateSyncButtonState();
    startMidnightTimer();
});

// Local Storage Management
function saveData() {
    localStorage.setItem('challenges', JSON.stringify(challenges));
    localStorage.setItem('payouts', JSON.stringify(payouts));
    localStorage.setItem('balanceHistory', JSON.stringify(balanceHistory));
    localStorage.setItem('rEntries', JSON.stringify(rEntries));
}

function loadData() {
    const savedChallenges = localStorage.getItem('challenges');
    const savedPayouts = localStorage.getItem('payouts');
    const savedBalanceHistory = localStorage.getItem('balanceHistory');
    const savedREntries = localStorage.getItem('rEntries');

    if (savedChallenges) challenges = JSON.parse(savedChallenges);
    if (savedPayouts) payouts = JSON.parse(savedPayouts);
    if (savedBalanceHistory) balanceHistory = JSON.parse(savedBalanceHistory);
    if (savedREntries) rEntries = JSON.parse(savedREntries);
}

function setDefaultDates() {
    const today = new Date().toISOString().split('T')[0];
    const startDateInput = document.getElementById('startDate');
    const balanceDateInput = document.getElementById('balanceDate');
    const payoutDateInput = document.getElementById('payoutDate');
    const rDateInput = document.getElementById('rDate');

    if (startDateInput) startDateInput.value = today;
    if (balanceDateInput) balanceDateInput.value = today;
    if (payoutDateInput) payoutDateInput.value = today;
    if (rDateInput) rDateInput.value = today;
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
    return challenges
        .filter(challenge => challenge.status === 'funded')
        .reduce((sum, challenge) => {
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

            // Load scaling data
            const hasScalingCheckbox = document.getElementById('hasScaling');
            const scalingTargetInput = document.getElementById('scalingTarget');
            if (challenge.hasScaling) {
                hasScalingCheckbox.checked = true;
                scalingTargetInput.value = challenge.scalingTarget || '';
                toggleScalingFields();
            }
        }
    } else {
        title.textContent = 'Add Challenge Account';
        setDefaultDates();
    }

    modal.classList.add('active');
}

function toggleScalingFields() {
    const hasScaling = document.getElementById('hasScaling').checked;
    const scalingFields = document.getElementById('scalingFields');
    const scalingTarget = document.getElementById('scalingTarget');

    if (hasScaling) {
        scalingFields.style.display = 'block';
        scalingTarget.required = true;
    } else {
        scalingFields.style.display = 'none';
        scalingTarget.required = false;
        scalingTarget.value = '';
    }
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

    // Get scaling data
    const hasScaling = document.getElementById('hasScaling').checked;
    const scalingTarget = hasScaling ? parseFloat(document.getElementById('scalingTarget').value) : null;

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
        startedAsFunded: existingIndex < 0 ? (status === 'funded') : challenges[existingIndex].startedAsFunded,
        // Scaling data
        hasScaling,
        scalingTarget
    };

    if (existingIndex >= 0) {
        challenges[existingIndex] = challenge;

        // Ensure balance history exists for existing challenges
        if (!balanceHistory[id]) {
            balanceHistory[id] = [{
                date: startDate,
                balance: initialBalance,
                notes: 'Initial balance',
                timestamp: new Date().toISOString()
            }];
        }

        // If current balance changed, add new entry
        if (balanceHistory[id].length > 0) {
            const latestEntry = [...balanceHistory[id]].sort((a, b) => new Date(b.date) - new Date(a.date))[0];
            if (latestEntry.balance !== currentBalance) {
                balanceHistory[id].push({
                    date: new Date().toISOString().split('T')[0],
                    balance: currentBalance,
                    notes: 'Balance updated',
                    timestamp: new Date().toISOString()
                });
            }
        }
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

    // Reset filter to "All Accounts" to ensure the saved challenge is visible
    const filterDropdown = document.getElementById('challengeFilterBy');
    if (filterDropdown) {
        filterDropdown.value = 'all';
    }

    renderChallenges();
    renderScalingTable();
    closeModal('addChallengeModal');
}

function deleteChallenge(challengeId) {
    if (confirm('Are you sure you want to delete this challenge? This action cannot be undone.')) {
        challenges = challenges.filter(c => c.id !== challengeId);
        delete balanceHistory[challengeId];
        saveData();
        updateDashboard();
        renderChallenges();
        renderScalingTable();
    }
}

function renderChallenges() {
    const grid = document.getElementById('challengesGrid');
    const sortBy = document.getElementById('challengeSortBy')?.value || 'name-asc';
    const filterBy = document.getElementById('challengeFilterBy')?.value || 'all';

    if (challenges.length === 0) {
        grid.innerHTML = '<div class="empty-state"><p>No challenges yet. Add your first challenge to start tracking!</p></div>';
        return;
    }

    // Filter challenges
    let filteredChallenges = challenges;

    if (filterBy === 'active') {
        filteredChallenges = challenges.filter(c => c.status === 'active');
    } else if (filterBy === 'funded') {
        filteredChallenges = challenges.filter(c => c.status === 'funded');
    } else if (filterBy === 'passed') {
        filteredChallenges = challenges.filter(c => c.status === 'passed');
    } else if (filterBy === 'failed') {
        filteredChallenges = challenges.filter(c => c.status === 'failed');
    } else if (filterBy === 'scaling') {
        filteredChallenges = challenges.filter(c => c.hasScaling);
    }

    // Sort challenges
    const sortedChallenges = [...filteredChallenges].sort((a, b) => {
        if (sortBy === 'name-asc') {
            return a.name.localeCompare(b.name);
        } else if (sortBy === 'name-desc') {
            return b.name.localeCompare(a.name);
        } else if (sortBy === 'balance-desc') {
            return parseFloat(b.currentBalance) - parseFloat(a.currentBalance);
        } else if (sortBy === 'balance-asc') {
            return parseFloat(a.currentBalance) - parseFloat(b.currentBalance);
        } else if (sortBy === 'percent-desc') {
            const aPercent = ((parseFloat(a.currentBalance) - parseFloat(a.initialBalance)) / parseFloat(a.initialBalance)) * 100;
            const bPercent = ((parseFloat(b.currentBalance) - parseFloat(b.initialBalance)) / parseFloat(b.initialBalance)) * 100;
            return bPercent - aPercent;
        } else if (sortBy === 'percent-asc') {
            const aPercent = ((parseFloat(a.currentBalance) - parseFloat(a.initialBalance)) / parseFloat(a.initialBalance)) * 100;
            const bPercent = ((parseFloat(b.currentBalance) - parseFloat(b.initialBalance)) / parseFloat(b.initialBalance)) * 100;
            return aPercent - bPercent;
        } else if (sortBy === 'date-desc') {
            return new Date(b.startDate) - new Date(a.startDate);
        } else if (sortBy === 'date-asc') {
            return new Date(a.startDate) - new Date(b.startDate);
        }
        return 0;
    });

    // Check if filtered results are empty
    if (sortedChallenges.length === 0) {
        grid.innerHTML = '<div class="empty-state"><p>No challenges match the selected filter.</p></div>';
        return;
    }

    grid.innerHTML = sortedChallenges.map(challenge => {
        const profit = parseFloat(challenge.currentBalance) - parseFloat(challenge.initialBalance);
        const profitPercent = (profit / parseFloat(challenge.initialBalance)) * 100;
        const profitClass = profit >= 0 ? 'positive' : 'negative';
        const profitSign = profit >= 0 ? '+' : '';
        const hasScalingClass = challenge.hasScaling ? 'has-scaling' : '';
        const scalingBadge = challenge.hasScaling ? `<span class="scaling-badge">📈 Scaling: ${challenge.scalingTarget}%</span>` : '';

        return `
            <div class="challenge-card ${challenge.status} ${hasScalingClass}" onclick="showChallengeDetail('${challenge.id}')" style="cursor: pointer;">
                <div class="challenge-header">
                    <div>
                        <div class="challenge-title">${challenge.name}</div>
                        <div class="challenge-provider">${challenge.provider || 'No provider'}</div>
                    </div>
                    <span class="challenge-status ${challenge.status}">${challenge.status}</span>
                </div>

                ${scalingBadge}

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
}

function updateCharts() {
    updatePayoutChart();
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

// Import/Export Data
function exportData() {
    const data = {
        challenges,
        payouts,
        balanceHistory,
        rEntries,
        timerStartDate: localStorage.getItem('timerStartDate'),
        exportDate: new Date().toISOString(),
        version: '1.5'
    };

    const dataStr = JSON.stringify(data, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);

    const link = document.createElement('a');
    link.href = url;
    link.download = `trading-goals-backup-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    alert('Data exported successfully! Save this file to import on another device.');
}

function importData(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const data = JSON.parse(e.target.result);

            // Validate data structure
            if (!data.challenges || !data.payouts || !data.balanceHistory) {
                throw new Error('Invalid data format');
            }

            // Ask for confirmation before overwriting
            const rEntriesInfo = data.rEntries ? `\n- ${data.rEntries.length} R-Multiple entries` : '';
            const confirmMsg = `This will replace all current data with the imported data.\n\nImported data contains:\n- ${data.challenges.length} challenges\n- ${data.payouts.length} payouts${rEntriesInfo}\n- Exported on: ${new Date(data.exportDate).toLocaleString()}\n\nDo you want to continue?`;

            if (!confirm(confirmMsg)) {
                event.target.value = ''; // Reset file input
                return;
            }

            // Import data
            challenges = data.challenges;
            payouts = data.payouts;
            balanceHistory = data.balanceHistory;
            rEntries = data.rEntries || [];

            // Restore timer start date if it exists
            if (data.timerStartDate) {
                localStorage.setItem('timerStartDate', data.timerStartDate);
                const timerInput = document.getElementById('timerStartDate');
                if (timerInput) {
                    timerInput.value = data.timerStartDate;
                }
            }

            // Save to localStorage
            saveData();

            // Update UI
            updateDashboard();
            updateRTracker();
            renderChallenges();
            renderPayouts();

            alert('Data imported successfully!');
            event.target.value = ''; // Reset file input
        } catch (error) {
            alert('Error importing data: ' + error.message + '\n\nPlease make sure you selected a valid backup file.');
            event.target.value = ''; // Reset file input
        }
    };

    reader.readAsText(file);
}

// R-Multiple Tracker Functions
function calculateCurrentR() {
    return rEntries.reduce((sum, entry) => sum + parseFloat(entry.value), 0);
}

function updateRTracker() {
    const currentR = calculateCurrentR();
    const progress = (currentR / R_GOAL) * 100;
    const progressCapped = Math.min(Math.max(progress, 0), 100);

    // Update display
    const rCurrentElement = document.getElementById('rCurrent');
    rCurrentElement.textContent = `${currentR.toFixed(1)}R`;
    rCurrentElement.className = currentR >= 0 ? 'r-current' : 'r-current negative';

    // Update progress bar
    const rProgressBar = document.getElementById('rProgressBar');
    rProgressBar.style.width = `${progressCapped}%`;
    rProgressBar.className = currentR >= 0 ? 'r-progress-bar' : 'r-progress-bar negative';

    // Update progress text
    document.getElementById('rProgressText').textContent = `${progress.toFixed(1)}%`;

    // Update mini chart
    updateRMiniChart();
}

function updateRMiniChart() {
    if (!rMiniChart) {
        const ctx = document.getElementById('rMiniChart');
        rMiniChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: [],
                datasets: [{
                    label: 'Cumulative R',
                    data: [],
                    borderColor: '#34d399',
                    backgroundColor: 'rgba(52, 211, 153, 0.1)',
                    fill: true,
                    tension: 0.4,
                    pointRadius: 3,
                    pointHoverRadius: 5
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        backgroundColor: '#1e293b',
                        titleColor: '#f1f5f9',
                        bodyColor: '#f1f5f9',
                        borderColor: '#4f46e5',
                        borderWidth: 1
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            color: '#e0e7ff',
                            callback: function(value) {
                                return value + 'R';
                            }
                        },
                        grid: {
                            color: 'rgba(99, 102, 241, 0.2)'
                        }
                    },
                    x: {
                        ticks: {
                            color: '#e0e7ff',
                            maxRotation: 0,
                            autoSkip: true,
                            maxTicksLimit: 6
                        },
                        grid: {
                            display: false
                        }
                    }
                }
            }
        });
    }

    // Calculate cumulative R over time
    const sortedEntries = [...rEntries].sort((a, b) => new Date(a.date) - new Date(b.date));
    let cumulative = 0;
    const labels = [];
    const data = [];

    sortedEntries.forEach(entry => {
        cumulative += parseFloat(entry.value);
        labels.push(formatDate(entry.date));
        data.push(cumulative);
    });

    rMiniChart.data.labels = labels;
    rMiniChart.data.datasets[0].data = data;
    rMiniChart.data.datasets[0].borderColor = cumulative >= 0 ? '#34d399' : '#f87171';
    rMiniChart.data.datasets[0].backgroundColor = cumulative >= 0 ? 'rgba(52, 211, 153, 0.1)' : 'rgba(248, 113, 113, 0.1)';
    rMiniChart.update();
}

function showAddRModal() {
    document.getElementById('rForm').reset();
    setDefaultDates();
    document.getElementById('addRModal').classList.add('active');
}

function saveREntry(event) {
    event.preventDefault();

    const value = parseFloat(document.getElementById('rValue').value);
    const date = document.getElementById('rDate').value;
    const notes = document.getElementById('rNotes').value;

    const entry = {
        id: Date.now().toString(),
        value,
        date,
        notes,
        timestamp: new Date().toISOString()
    };

    rEntries.push(entry);
    rEntries.sort((a, b) => new Date(a.date) - new Date(b.date));

    saveData();
    updateRTracker();
    closeModal('addRModal');
}

function showRHistoryModal() {
    updateRHistoryStats();
    updateRHistoryChart();
    renderREntries();
    document.getElementById('rHistoryModal').classList.add('active');
}

function updateRHistoryStats() {
    const currentR = calculateCurrentR();
    const totalEntries = rEntries.length;
    const wins = rEntries.filter(e => parseFloat(e.value) > 0).length;
    const winRate = totalEntries > 0 ? (wins / totalEntries) * 100 : 0;

    document.getElementById('historyCurrentR').textContent = `${currentR.toFixed(1)}R`;
    document.getElementById('historyCurrentR').className = currentR >= 0 ? 'detail-stat-value positive' : 'detail-stat-value negative';
    document.getElementById('historyTotalEntries').textContent = totalEntries;
    document.getElementById('historyWinRate').textContent = `${winRate.toFixed(1)}%`;
}

function updateRHistoryChart() {
    const ctx = document.getElementById('rHistoryChart');

    if (rHistoryChart) {
        rHistoryChart.destroy();
    }

    const sortedEntries = [...rEntries].sort((a, b) => new Date(a.date) - new Date(b.date));
    let cumulative = 0;
    const labels = [];
    const data = [];

    sortedEntries.forEach(entry => {
        cumulative += parseFloat(entry.value);
        labels.push(formatDate(entry.date));
        data.push(cumulative);
    });

    // Add goal line
    if (sortedEntries.length > 0) {
        labels.unshift('Start');
        data.unshift(0);
    }

    rHistoryChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Cumulative R',
                data: data,
                borderColor: '#34d399',
                backgroundColor: 'rgba(52, 211, 153, 0.1)',
                fill: true,
                tension: 0.4,
                pointRadius: 5,
                pointHoverRadius: 7,
                pointBackgroundColor: '#34d399',
                pointBorderColor: '#fff',
                pointBorderWidth: 2
            }, {
                label: 'Goal (20R)',
                data: Array(labels.length).fill(R_GOAL),
                borderColor: '#6366f1',
                borderDash: [5, 5],
                fill: false,
                pointRadius: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: {
                    labels: {
                        color: '#f1f5f9'
                    }
                },
                tooltip: {
                    backgroundColor: '#1e293b',
                    titleColor: '#f1f5f9',
                    bodyColor: '#f1f5f9',
                    borderColor: '#334155',
                    borderWidth: 1
                }
            },
            scales: {
                y: {
                    ticks: {
                        color: '#94a3b8',
                        callback: function(value) {
                            return value + 'R';
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

function renderREntries() {
    const list = document.getElementById('rEntriesList');

    if (rEntries.length === 0) {
        list.innerHTML = '<div class="empty-state">No R entries yet.</div>';
        return;
    }

    const sortedEntries = [...rEntries].sort((a, b) => new Date(b.date) - new Date(a.date));

    list.innerHTML = sortedEntries.map(entry => {
        const value = parseFloat(entry.value);
        const valueClass = value >= 0 ? 'positive' : 'negative';
        const valueSign = value >= 0 ? '+' : '';

        return `
            <div class="balance-entry">
                <div class="balance-entry-info">
                    <div class="balance-entry-amount ${valueClass}">${valueSign}${value.toFixed(1)}R</div>
                    <div class="balance-entry-date">${formatDate(entry.date)}</div>
                    ${entry.notes ? `<div class="balance-entry-notes">${entry.notes}</div>` : ''}
                </div>
                <div class="balance-entry-actions">
                    <button class="btn btn-danger btn-small" onclick="deleteREntry('${entry.id}')">Delete</button>
                </div>
            </div>
        `;
    }).join('');
}

function deleteREntry(entryId) {
    if (!confirm('Are you sure you want to delete this R entry?')) return;

    rEntries = rEntries.filter(e => e.id !== entryId);
    saveData();
    updateRTracker();
    updateRHistoryStats();
    updateRHistoryChart();
    renderREntries();
}

function resetRTracker() {
    // Confirmation dialog to prevent accidental deletion
    const confirmReset = confirm(
        'Are you sure you want to reset the R-Multiple Tracker?\n\n' +
        'This will:\n' +
        '- Clear all R entries and history\n' +
        '- Reset progress to 0%\n' +
        '- Delete all R-Multiple data\n\n' +
        'This action cannot be undone!'
    );

    if (!confirmReset) {
        return; // User cancelled
    }

    // Double confirmation for extra safety
    const doubleConfirm = confirm(
        'FINAL CONFIRMATION\n\n' +
        'You are about to permanently delete all R-Multiple tracking data.\n\n' +
        'Click OK to proceed with the reset, or Cancel to keep your data.'
    );

    if (!doubleConfirm) {
        return; // User cancelled on second confirmation
    }

    // Clear all R entries
    rEntries = [];
    saveData();

    // Update all R-related displays
    updateRTracker();
    renderREntries();

    // Close history modal if it's open
    const historyModal = document.getElementById('rHistoryModal');
    if (historyModal && historyModal.classList.contains('active')) {
        closeModal('rHistoryModal');
    }

    alert('R-Multiple Tracker has been reset successfully.');
}

// GitHub Gist Cloud Sync
function loadGitHubConfig() {
    const savedToken = localStorage.getItem('githubToken');
    const savedGistId = localStorage.getItem('gistId');

    if (savedToken) githubToken = savedToken;
    if (savedGistId) gistId = savedGistId;
}

function saveGitHubConfig() {
    if (githubToken) {
        localStorage.setItem('githubToken', githubToken);
    }
    if (gistId) {
        localStorage.setItem('gistId', gistId);
    }
}

function toggleSyncMenu() {
    const menu = document.getElementById('syncMenu');
    menu.style.display = menu.style.display === 'none' ? 'block' : 'none';
}

// Close sync menu when clicking outside
document.addEventListener('click', (event) => {
    const menu = document.getElementById('syncMenu');
    const button = document.getElementById('syncButton');

    if (menu && button && !menu.contains(event.target) && !button.contains(event.target)) {
        menu.style.display = 'none';
    }
});

function showGitHubSetup() {
    toggleSyncMenu();
    document.getElementById('githubToken').value = '';
    document.getElementById('githubSetupModal').classList.add('active');
}

async function saveGitHubToken(event) {
    event.preventDefault();

    const token = document.getElementById('githubToken').value.trim();

    if (!token) {
        alert('Please enter a GitHub token');
        return;
    }

    // Test the token before saving
    try {
        const testResponse = await fetch('https://api.github.com/user', {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Accept': 'application/vnd.github+json',
                'X-GitHub-Api-Version': '2022-11-28'
            }
        });

        if (!testResponse.ok) {
            const errorData = await testResponse.json().catch(() => ({}));
            alert('❌ Token validation failed: ' + (errorData.message || 'Invalid token') + '\n\nPlease check your token and try again.');
            return;
        }

        const userData = await testResponse.json();
        console.log('GitHub user verified:', userData.login);

        githubToken = token;
        saveGitHubConfig();
        updateSyncButtonState();
        closeModal('githubSetupModal');

        alert('✅ GitHub token saved and verified!\n\nLogged in as: ' + userData.login + '\n\nYou can now sync your data to the cloud.');
    } catch (error) {
        console.error('Token validation error:', error);
        alert('❌ Failed to validate token: ' + error.message + '\n\nPlease check your internet connection and try again.');
    }
}

function updateSyncButtonState() {
    const syncToCloudBtn = document.getElementById('syncToCloudBtn');
    const syncFromCloudBtn = document.getElementById('syncFromCloudBtn');
    const disconnectBtn = document.getElementById('disconnectBtn');
    const syncButton = document.getElementById('syncButton');

    if (githubToken) {
        syncToCloudBtn.disabled = false;
        syncFromCloudBtn.disabled = false;
        disconnectBtn.disabled = false;
        syncButton.textContent = '☁️ Sync ✓';
        syncButton.style.background = 'rgba(16, 185, 129, 0.2)';
        syncButton.style.color = '#10b981';
    } else {
        syncToCloudBtn.disabled = true;
        syncFromCloudBtn.disabled = true;
        disconnectBtn.disabled = true;
        syncButton.textContent = '☁️ Sync';
        syncButton.style.background = '';
        syncButton.style.color = '';
    }
}

async function syncToCloud() {
    if (!githubToken) {
        alert('Please setup GitHub sync first');
        return;
    }

    toggleSyncMenu();

    const data = {
        challenges,
        payouts,
        balanceHistory,
        rEntries,
        timerStartDate: localStorage.getItem('timerStartDate'),
        syncDate: new Date().toISOString(),
        version: '1.5'
    };

    try {
        if (gistId) {
            // Update existing gist
            console.log('Updating gist:', gistId);
            console.log('Data to sync:', {
                challenges: data.challenges.length,
                payouts: data.payouts.length,
                rEntries: data.rEntries.length,
                syncDate: data.syncDate
            });

            const response = await fetch(`https://api.github.com/gists/${gistId}`, {
                method: 'PATCH',
                headers: {
                    'Authorization': `Bearer ${githubToken}`,
                    'Accept': 'application/vnd.github+json',
                    'X-GitHub-Api-Version': '2022-11-28',
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    files: {
                        'trading-goals-data.json': {
                            content: JSON.stringify(data, null, 2)
                        }
                    }
                })
            });

            console.log('Update response:', response.status, response.statusText);

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                console.error('Update failed:', errorData);

                // If gist not found (404), clear the saved gistId and create a new one
                if (response.status === 404) {
                    console.log('Gist not found (was it deleted?), creating a new one...');
                    gistId = null;
                    localStorage.removeItem('gistId');
                    // Retry the sync, which will create a new gist since gistId is now null
                    return syncToCloud();
                }

                throw new Error(`Failed to update gist: ${errorData.message || response.statusText}`);
            }

            const result = await response.json();
            console.log('Gist updated successfully:', result.updated_at);

            alert(`✅ Data synced to cloud successfully!\n\nSynced:\n- ${data.challenges.length} challenges\n- ${data.payouts.length} payouts\n- ${data.rEntries.length} R entries\n\n📋 Gist ID: ${gistId.substring(0, 8)}...`);
        } else {
            // Create new gist
            const requestBody = {
                description: 'Forex Trading Goal Tracker - Cloud Sync Data',
                public: false,
                files: {
                    'trading-goals-data.json': {
                        content: JSON.stringify(data, null, 2)
                    }
                }
            };

            console.log('Creating gist with request:', {
                url: 'https://api.github.com/gists',
                method: 'POST',
                hasToken: !!githubToken,
                tokenPrefix: githubToken ? githubToken.substring(0, 7) + '...' : 'none',
                bodySize: JSON.stringify(requestBody).length
            });

            const response = await fetch('https://api.github.com/gists', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${githubToken}`,
                    'Accept': 'application/vnd.github+json',
                    'X-GitHub-Api-Version': '2022-11-28',
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(requestBody)
            });

            console.log('Response status:', response.status, response.statusText);

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                console.error('GitHub API Error:', errorData);
                console.error('Response headers:', [...response.headers.entries()]);

                let errorMsg = `Failed to create gist: ${errorData.message || response.statusText}`;
                if (errorData.message === 'Bad credentials') {
                    errorMsg += '\n\n⚠️ Your GitHub token appears to be invalid or expired.\n\nPlease check:\n1. Token was copied correctly (no extra spaces)\n2. Token has "gist" permission\n3. Token has not expired';
                } else if (errorData.documentation_url) {
                    errorMsg += '\n\nSee: ' + errorData.documentation_url;
                }
                throw new Error(errorMsg);
            }

            const result = await response.json();
            gistId = result.id;
            saveGitHubConfig();

            alert(`✅ Data synced to cloud successfully!\n\nYour data is now backed up to a private GitHub Gist.\n\n📋 Gist ID: ${gistId.substring(0, 8)}...\n\n⚠️ Important: Use "Pull from Cloud" on your other devices to sync this data.`);
        }
    } catch (error) {
        console.error('Sync error:', error);
        alert('❌ Failed to sync data: ' + error.message + '\n\nPlease check your GitHub token and try again.');
    }
}

async function syncFromCloud() {
    if (!githubToken) {
        alert('Please setup GitHub sync first.');
        return;
    }

    toggleSyncMenu();

    try {
        let gistData = null;

        // If we don't have a gist ID, search for it
        if (!gistId) {
            console.log('No gist ID found, searching for Trading Goals gist...');

            const listResponse = await fetch('https://api.github.com/gists', {
                headers: {
                    'Authorization': `Bearer ${githubToken}`,
                    'Accept': 'application/vnd.github+json',
                    'X-GitHub-Api-Version': '2022-11-28'
                }
            });

            console.log('List gists response:', listResponse.status);

            if (!listResponse.ok) {
                const errorData = await listResponse.json().catch(() => ({}));
                console.error('Failed to list gists:', errorData);
                throw new Error('Failed to list gists: ' + (errorData.message || listResponse.statusText));
            }

            const gists = await listResponse.json();
            console.log('Found gists:', gists.length, 'total');
            console.log('Gist descriptions:', gists.map(g => ({ desc: g.description, files: Object.keys(g.files) })));

            // Find all matching gists
            const matchingGists = gists.filter(g =>
                g.description === 'Forex Trading Goal Tracker - Cloud Sync Data' &&
                g.files['trading-goals-data.json']
            );

            if (matchingGists.length === 0) {
                alert(`❌ No cloud data found.\n\nSearched ${gists.length} gists but couldn't find "Forex Trading Goal Tracker - Cloud Sync Data".\n\nPlease use "Push to Cloud" from your primary device first.`);
                return;
            }

            // Use the most recently updated gist (in case of duplicates)
            const tradingGoalsGist = matchingGists.sort((a, b) =>
                new Date(b.updated_at) - new Date(a.updated_at)
            )[0];

            if (matchingGists.length > 1) {
                console.warn(`⚠️ Found ${matchingGists.length} duplicate gists! Using the most recent one.`);
                console.warn('Duplicate gist IDs:', matchingGists.map(g => g.id));
            }

            console.log('Found gist:', tradingGoalsGist.id, 'updated:', tradingGoalsGist.updated_at);
            gistId = tradingGoalsGist.id;
            saveGitHubConfig();
        }

        // Validate gistId
        if (!gistId || typeof gistId !== 'string' || gistId.trim() === '') {
            throw new Error('Invalid gist ID. Please disconnect and reconnect GitHub sync.');
        }

        // Always fetch the specific gist to get full content (list response may be truncated)
        console.log('Fetching gist:', gistId);

        const response = await fetch(`https://api.github.com/gists/${gistId}`, {
            headers: {
                'Authorization': `Bearer ${githubToken}`,
                'Accept': 'application/vnd.github+json',
                'X-GitHub-Api-Version': '2022-11-28'
            },
            cache: 'no-store'
        });

        console.log('Fetch response:', response.status, response.headers.get('last-modified'));

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));

            // If gist not found (404), clear the saved gistId
            if (response.status === 404) {
                console.log('Gist not found, clearing saved gistId');
                gistId = null;
                localStorage.removeItem('gistId');
                throw new Error('Gist not found. It may have been deleted. Please push to cloud again to create a new backup.');
            }

            throw new Error(`Failed to fetch gist: ${errorData.message || response.statusText}`);
        }

        gistData = await response.json();
        console.log('Gist last updated:', gistData.updated_at);

        // Check if content is truncated (GitHub truncates large files)
        const file = gistData.files['trading-goals-data.json'];
        let fileContent;

        if (file.truncated) {
            // Content is truncated, fetch from raw_url
            // Note: raw URLs are direct file URLs and don't need/support Authorization header
            console.log('Content is truncated, fetching from raw_url:', file.raw_url);

            const rawResponse = await fetch(file.raw_url, {
                cache: 'no-store'
            });

            if (!rawResponse.ok) {
                throw new Error(`Failed to fetch raw content: ${rawResponse.status} ${rawResponse.statusText}`);
            }

            fileContent = await rawResponse.text();
            console.log('Fetched full content from raw_url, size:', fileContent.length);
        } else {
            // Content is not truncated, use it directly
            fileContent = file.content;
            console.log('Using content directly, size:', fileContent.length);
        }

        const data = JSON.parse(fileContent);

        console.log('Pulled data from cloud:', {
            challenges: data.challenges?.length || 0,
            payouts: data.payouts?.length || 0,
            rEntries: data.rEntries?.length || 0,
            syncDate: data.syncDate
        });

        // Show confirmation with data info
        const confirmMsg = `Pull data from cloud?\n\nCloud data contains:\n- ${data.challenges?.length || 0} challenges\n- ${data.payouts?.length || 0} payouts\n- ${data.rEntries?.length || 0} R-Multiple entries\n- Synced: ${new Date(data.syncDate).toLocaleString()}\n\nThis will replace your current local data.`;

        if (!confirm(confirmMsg)) {
            return;
        }

        console.log('Before import - current data:', {
            challenges: challenges.length,
            payouts: payouts.length,
            rEntries: rEntries.length
        });

        // Import cloud data
        challenges = data.challenges || [];
        payouts = data.payouts || [];
        balanceHistory = data.balanceHistory || {};
        rEntries = data.rEntries || [];

        // Restore timer start date if it exists
        if (data.timerStartDate) {
            localStorage.setItem('timerStartDate', data.timerStartDate);
            const timerInput = document.getElementById('timerStartDate');
            if (timerInput) {
                timerInput.value = data.timerStartDate;
            }
        }

        console.log('After import - new data:', {
            challenges: challenges.length,
            payouts: payouts.length,
            rEntries: rEntries.length
        });

        // Save to localStorage
        saveData();
        console.log('Data saved to localStorage');

        // Update UI
        updateDashboard();
        updateRTracker();
        renderChallenges();
        renderPayouts();

        console.log('UI updated');

        alert(`✅ Data pulled from cloud successfully!\n\nImported:\n- ${data.challenges?.length || 0} challenges\n- ${data.payouts?.length || 0} payouts\n- ${data.rEntries?.length || 0} R entries\n\n📋 Gist ID: ${gistId.substring(0, 8)}...`);
    } catch (error) {
        console.error('Sync error:', error);
        alert('❌ Failed to pull data: ' + error.message + '\n\nPlease check your connection and try again.');
    }
}

function disconnectGitHub() {
    if (!confirm('Disconnect GitHub sync?\n\nYour data will remain in the cloud, but you won\'t be able to sync until you reconnect.')) {
        return;
    }

    toggleSyncMenu();

    githubToken = null;
    gistId = null;
    localStorage.removeItem('githubToken');
    localStorage.removeItem('gistId');

    updateSyncButtonState();
    alert('GitHub sync disconnected.');
}

// Midnight Timer
function updateMidnightTimer() {
    const now = new Date();
    const startDateInput = document.getElementById('timerStartDate');

    if (!startDateInput || !startDateInput.value) {
        return;
    }

    const startDate = new Date(startDateInput.value);
    const elapsed = now - startDate;

    // If the selected time is in the future, show 00:00:00
    if (elapsed < 0) {
        const timerElement = document.getElementById('midnightTimer');
        if (timerElement) {
            timerElement.textContent = '00:00:00';
        }
        return;
    }

    const hours = Math.floor(elapsed / (1000 * 60 * 60));
    const minutes = Math.floor((elapsed % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((elapsed % (1000 * 60)) / 1000);

    const formattedTime = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

    const timerElement = document.getElementById('midnightTimer');
    if (timerElement) {
        timerElement.textContent = formattedTime;
    }
}

function updateTimerStartDate() {
    const startDateInput = document.getElementById('timerStartDate');
    if (startDateInput && startDateInput.value) {
        localStorage.setItem('timerStartDate', startDateInput.value);
        updateMidnightTimer();
    }
}

function loadTimerStartDate() {
    const startDateInput = document.getElementById('timerStartDate');
    if (!startDateInput) return;

    // Try to load saved date from localStorage
    const savedDate = localStorage.getItem('timerStartDate');

    if (savedDate) {
        startDateInput.value = savedDate;
    } else {
        // Set to midnight tonight (00:00:00 of today)
        const midnight = new Date();
        midnight.setHours(0, 0, 0, 0);

        // Format for datetime-local input (YYYY-MM-DDTHH:mm)
        const year = midnight.getFullYear();
        const month = String(midnight.getMonth() + 1).padStart(2, '0');
        const day = String(midnight.getDate()).padStart(2, '0');
        const hours = String(midnight.getHours()).padStart(2, '0');
        const minutes = String(midnight.getMinutes()).padStart(2, '0');

        const formattedDate = `${year}-${month}-${day}T${hours}:${minutes}`;
        startDateInput.value = formattedDate;
        localStorage.setItem('timerStartDate', formattedDate);
    }
}

function startMidnightTimer() {
    loadTimerStartDate();
    updateMidnightTimer(); // Update immediately
    setInterval(updateMidnightTimer, 1000); // Update every second
}

// Scaling Progress Table
function renderScalingTable() {
    const tbody = document.getElementById('scalingTableBody');
    const sortBy = document.getElementById('scalingSortBy').value;
    const filterBy = document.getElementById('scalingFilterBy').value;

    // Filter funded accounts
    let fundedAccounts = challenges.filter(c => c.status === 'funded');

    // Apply additional filters
    if (filterBy === 'scaling-only') {
        fundedAccounts = fundedAccounts.filter(c => c.hasScaling);
    } else if (filterBy === 'near-target') {
        fundedAccounts = fundedAccounts.filter(c => {
            if (!c.hasScaling || !c.scalingTarget) return false;
            const currentGainPercent = ((c.currentBalance - c.initialBalance) / c.initialBalance) * 100;
            const targetGainPercent = parseFloat(c.scalingTarget);
            const progress = (currentGainPercent / targetGainPercent) * 100;
            return progress > 80;
        });
    } else if (filterBy === 'in-progress') {
        fundedAccounts = fundedAccounts.filter(c => {
            if (!c.hasScaling || !c.scalingTarget) return false;
            return c.currentBalance > c.initialBalance;
        });
    }

    // Calculate progress for each account
    const accountsWithProgress = fundedAccounts.map(account => {
        const hasScaling = account.hasScaling && account.scalingTarget;
        const current = parseFloat(account.currentBalance);
        const initial = parseFloat(account.initialBalance);

        // Calculate percentage-based values
        const targetGainPercent = hasScaling ? parseFloat(account.scalingTarget) : 0;
        const targetBalance = hasScaling ? initial * (1 + targetGainPercent / 100) : 0;
        const currentGainPercent = ((current - initial) / initial) * 100;
        const remainingPercent = hasScaling ? targetGainPercent - currentGainPercent : 0;
        const remainingBalance = hasScaling ? targetBalance - current : 0;
        const progress = hasScaling && targetGainPercent > 0
            ? (currentGainPercent / targetGainPercent) * 100
            : 0;

        return {
            ...account,
            targetBalance,
            targetGainPercent,
            currentGainPercent,
            remainingBalance,
            remainingPercent,
            progress: Math.max(0, Math.min(100, progress))
        };
    });

    // Sort accounts
    accountsWithProgress.sort((a, b) => {
        switch (sortBy) {
            case 'progress-desc':
                return b.progress - a.progress;
            case 'progress-asc':
                return a.progress - b.progress;
            case 'remaining-asc':
                return a.remainingPercent - b.remainingPercent;
            case 'remaining-desc':
                return b.remainingPercent - a.remainingPercent;
            case 'name-asc':
                return a.name.localeCompare(b.name);
            default:
                return 0;
        }
    });

    // Render table
    if (accountsWithProgress.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="empty-state">No funded accounts match the selected filters</td></tr>';
        return;
    }

    tbody.innerHTML = accountsWithProgress.map(account => {
        const progressClass = account.progress >= 80 ? 'high-progress' : account.progress >= 50 ? 'medium-progress' : 'low-progress';
        const hasScalingDisplay = account.hasScaling ? '' : ' (No Scaling)';

        return `
            <tr class="scaling-row">
                <td>
                    <div class="account-name-cell">
                        <strong>${account.name}</strong>${hasScalingDisplay}
                    </div>
                </td>
                <td>${account.provider || '-'}</td>
                <td>£${formatNumber(parseFloat(account.currentBalance))}</td>
                <td>${account.hasScaling && account.targetGainPercent ? '£' + formatNumber(account.targetBalance) + ' (' + account.targetGainPercent.toFixed(1) + '%)' : '-'}</td>
                <td class="${account.remainingPercent < 0 ? 'positive' : ''}">
                    ${account.hasScaling && account.targetGainPercent ? account.remainingPercent.toFixed(1) + '%' : '-'}
                </td>
                <td class="${account.currentGainPercent >= account.targetGainPercent ? 'positive' : ''}">
                    ${account.hasScaling || account.currentGainPercent !== 0 ? account.currentGainPercent.toFixed(2) + '%' : '-'}
                </td>
                <td>
                    ${account.hasScaling && account.targetGainPercent ? `
                        <div class="progress-cell">
                            <div class="progress-bar-small">
                                <div class="progress-fill ${progressClass}" style="width: ${account.progress}%"></div>
                            </div>
                            <span class="progress-text">${account.progress.toFixed(1)}%</span>
                        </div>
                    ` : '-'}
                </td>
            </tr>
        `;
    }).join('');
}

// Note: Modals only close via buttons or ESC key, not by clicking outside
