
// ============================================================================
// QUEUEAPP - ANALYTICS MODULE
// Customer Data & Analytics Page
// ============================================================================

// Global filter state
let analyticsFilterState = {
    dateFrom: new Date().toISOString().slice(0, 10),
    dateTo: null,
    timeSlots: ['lunch', 'dinner'],
    searchQuery: ''
};

// ============================================================================
// MAIN ANALYTICS PAGE
// ============================================================================

async function showAnalytics(rid) {
    // Get restaurant data
    let r = DB.restaurants[rid];
    if (!r) {
        const res = await FirebaseDB.getRestaurant(rid);
        if (res.success) {
            r = res.data;
            DB.restaurants[rid] = r;
            DB.save();
        } else {
            render(`<div class="container text-center" style="padding-top:4rem"><h1 style="color:var(--danger)">Restaurant Not Found</h1><button onclick="navigate('/')" class="btn btn-primary mt">Go Home</button></div>`);
            return;
        }
    }

    // Reset filter state for this session
    analyticsFilterState = {
        dateFrom: new Date().toISOString().slice(0, 10),
        dateTo: null,
        timeSlots: ['lunch', 'dinner'],
        searchQuery: ''
    };

    // Get all queue data (current + archived if available)
    const allQueue = r.queue || [];
    
    renderAnalyticsPage(rid, r, allQueue);
}

// ============================================================================
// RENDER ANALYTICS PAGE
// ============================================================================

function renderAnalyticsPage(rid, r, allQueue) {
    // Apply filters
    const filteredQueue = applyFilters(allQueue, analyticsFilterState);
    
    // Calculate statistics
    const stats = calculateStats(filteredQueue);
    
    // Get repeat customers (from all data, not filtered)
    const repeatCustomers = getRepeatCustomers(allQueue);

    // Determine which time slots are active
    const isSlotActive = (slot) => analyticsFilterState.timeSlots.includes(slot);

    const html = `
<div style="min-height:100vh;background:var(--gray-50)">
    <nav>
        <div class="container nav-content">
            <h1 onclick="navigate('/r/${rid}/admin')" style="cursor:pointer">QueueApp</h1>
            <button class="mobile-menu-toggle" onclick="toggleMobileMenu()">☰</button>
            <div class="nav-buttons mobile-menu">
                <button onclick="navigate('/r/${rid}/admin')" class="btn btn-secondary">← Back to Dashboard</button>
            </div>
            <div class="nav-buttons">
                <button onclick="navigate('/r/${rid}/admin')" class="btn btn-secondary">← Back to Dashboard</button>
            </div>
        </div>
    </nav>

    <div class="container" style="padding:2rem 0">
        <!-- Header -->
        <div class="card flex justify-between items-center flex-wrap gap-1 mb">
            <div>
                <h1>📊 Customer Data & Analytics</h1>
                <p style="color:var(--gray-600)">${r.name} <span class="badge badge-primary">${r.plan.toUpperCase()}</span></p>
            </div>
        </div>

        <!-- Filter Section -->
        <div class="filter-section">
            <h3>🔍 Filter & Export Data</h3>
            <div class="grid grid-2 mb">
                <div>
                    <label style="display:block;font-weight:600;margin-bottom:.5rem">📅 Select Date</label>
                    <input type="date" id="dateFrom" value="${analyticsFilterState.dateFrom}" onchange="updateAnalyticsFilters('${rid}')">
                </div>
                <div>
                    <label style="display:block;font-weight:600;margin-bottom:.5rem">📅 To Date (Optional)</label>
                    <input type="date" id="dateTo" value="${analyticsFilterState.dateTo || ''}" placeholder="Leave empty for single day" onchange="updateAnalyticsFilters('${rid}')">
                </div>
            </div>

            <div class="mb">
                <label style="display:block;font-weight:600;margin-bottom:.5rem">Quick Time Filters:</label>
                <div style="display:flex;gap:.5rem;flex-wrap:wrap">
                    <button class="time-slot ${isSlotActive('morning') ? 'active' : ''}" onclick="toggleAnalyticsTimeSlot('morning', '${rid}')">🌅 Morning (6-11 AM)</button>
                    <button class="time-slot ${isSlotActive('lunch') ? 'active' : ''}" onclick="toggleAnalyticsTimeSlot('lunch', '${rid}')">🌞 Lunch (12-3 PM)</button>
                    <button class="time-slot ${isSlotActive('evening') ? 'active' : ''}" onclick="toggleAnalyticsTimeSlot('evening', '${rid}')">🌆 Evening (4-6 PM)</button>
                    <button class="time-slot ${isSlotActive('dinner') ? 'active' : ''}" onclick="toggleAnalyticsTimeSlot('dinner', '${rid}')">🌙 Dinner (6-11 PM)</button>
                    <button class="time-slot ${isSlotActive('late') ? 'active' : ''}" onclick="toggleAnalyticsTimeSlot('late', '${rid}')">🌃 Late Night (11 PM+)</button>
                </div>
            </div>

            <div style="display:flex;gap:1rem;flex-wrap:wrap">
                <button onclick="exportAnalyticsCSV('${rid}')" class="btn-success">📥 Download CSV</button>
                <button onclick="alert('📄 PDF export coming soon!\\n\\nWill include:\\n• Full customer list\\n• Statistics summary\\n• Charts and graphs')" class="btn-warning">📄 Download PDF</button>
                <button onclick="alert('📧 Email report coming soon!\\n\\nWill email you:\\n• Daily summary\\n• Customer details\\n• Analytics dashboard')" class="btn-secondary">📧 Email Report</button>
            </div>
        </div>

        <!-- Summary Statistics -->
        <div class="card">
            <h2>📊 Summary Statistics</h2>
            <div class="alert alert-info mb">
                <strong>Showing data for:</strong> ${formatDateRange(analyticsFilterState)} | ${getActiveTimeSlotsText(analyticsFilterState)} | Total: ${filteredQueue.length} customers
            </div>

            <div class="stats-grid">
                <div class="stat-card">
                    <div class="stat-number">${stats.totalCustomers}</div>
                    <div class="stat-label">Total Customers</div>
                </div>
                <div class="stat-card" style="background:linear-gradient(135deg,#fff7ed 0%,#ffedd5 100%)">
                    <div class="stat-number" style="color:#ea580c">${stats.avgWaitTime}</div>
                    <div class="stat-label">Avg Wait Time</div>
                </div>
                <div class="stat-card" style="background:linear-gradient(135deg,#f0fdf4 0%,#dcfce7 100%)">
                    <div class="stat-number" style="color:#16a34a">${stats.totalGuests}</div>
                    <div class="stat-label">Total Guests</div>
                </div>
                <div class="stat-card" style="background:linear-gradient(135deg,#fef9c3 0%,#fef3c7 100%)">
                    <div class="stat-number" style="color:#ca8a04">${stats.peakHours}</div>
                    <div class="stat-label">Peak Hours</div>
                </div>
            </div>
        </div>

        <!-- Detailed Customer Data Table -->
        <div class="card">
            <div class="flex justify-between items-center mb">
                <h2>👥 Customer Details</h2>
                <input type="text" id="searchBox" placeholder="🔍 Search by name or phone..." style="max-width:300px;margin:0" value="${analyticsFilterState.searchQuery}" oninput="updateAnalyticsFilters('${rid}')">
            </div>

            <div style="overflow-x:auto">
                <table>
                    <thead>
                        <tr>
                            <th>Queue #</th>
                            <th>Customer Name</th>
                            <th>Phone</th>
                            <th>Guests</th>
                            <th>Join Time</th>
                            <th>Seat Time</th>
                            <th>Wait Duration</th>
                            <th>Table #</th>
                            <th>Status</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${filteredQueue.length > 0 ? filteredQueue.slice(0, 50).map(c => {
                            const joinTime = new Date(c.joinedAt);
                            const seatTime = c.allocatedAt ? new Date(c.allocatedAt) : null;
                            const waitMinutes = seatTime ? Math.round((seatTime - joinTime) / 60000) : null;
                            const waitColor = waitMinutes ? (waitMinutes < 15 ? 'var(--success)' : waitMinutes < 25 ? 'var(--warning)' : 'var(--danger)') : '';
                            
                            return `
                            <tr>
                                <td><strong>${c.queueNumber}</strong></td>
                                <td>${c.name}</td>
                                <td>${c.phone}</td>
                                <td>${c.guests}</td>
                                <td>${joinTime.toLocaleTimeString('en-US', {hour: '2-digit', minute: '2-digit'})}</td>
                                <td>${seatTime ? seatTime.toLocaleTimeString('en-US', {hour: '2-digit', minute: '2-digit'}) : '-'}</td>
                                <td>${waitMinutes ? `<span style="color:${waitColor};font-weight:600">${waitMinutes}m</span>` : '-'}</td>
                                <td>${c.tableNo || '-'}</td>
                                <td><span class="badge badge-${c.status === 'allocated' ? 'success' : 'warning'}">${c.status === 'allocated' ? 'Seated' : 'Waiting'}</span></td>
                            </tr>
                            `;
                        }).join('') : '<tr><td colspan="9" style="text-align:center;padding:2rem;color:var(--gray-600)">No customers found for selected filters</td></tr>'}
                    </tbody>
                </table>
            </div>

            ${filteredQueue.length > 50 ? `
            <div class="mt" style="text-align:center;color:var(--gray-600);font-size:.875rem">
                Showing 50 of ${filteredQueue.length} customers • <button style="background:none;border:none;color:var(--primary);cursor:pointer;text-decoration:underline;font-weight:600" onclick="alert('Load more functionality coming soon!')">Load More</button>
            </div>
            ` : ''}
        </div>

        <!-- Analytics Charts -->
        <div class="grid grid-2">
            <div class="card">
                <h3>📈 Hourly Customer Flow</h3>
                <div class="chart-placeholder">
                    <div style="font-size:3rem;margin-bottom:1rem">📊</div>
                    <p style="color:var(--gray-600)">Peak: ${stats.peakHours} (${stats.peakCustomers} customers)</p>
                    <p style="color:var(--gray-600);font-size:.875rem">Bar chart showing customer distribution by hour</p>
                </div>
            </div>

            <div class="card">
                <h3>⏱️ Wait Time Analysis</h3>
                <div class="chart-placeholder" style="background:linear-gradient(135deg,#fef9c3 0%,#fef3c7 100%)">
                    <div style="font-size:3rem;margin-bottom:1rem">⏱️</div>
                    <p style="color:var(--gray-700)">Avg: ${stats.avgWaitTime}</p>
                    <p style="color:var(--gray-600);font-size:.875rem">Line chart showing wait times throughout the day</p>
                </div>
            </div>
        </div>

        <!-- Repeat Customer Insights -->
        ${repeatCustomers.length > 0 ? `
        <div class="card">
            <h3>🔄 Repeat Customer Insights</h3>
            <div class="alert alert-info">
                <strong>💡 Tip:</strong> These customers visited multiple times. Consider sending them loyalty rewards!
            </div>
            <div style="overflow-x:auto">
                <table>
                    <thead>
                        <tr>
                            <th>Customer Name</th>
                            <th>Phone</th>
                            <th>Total Visits</th>
                            <th>Last Visit</th>
                            <th>Avg Party Size</th>
                            <th>Action</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${repeatCustomers.slice(0, 10).map(rc => `
                        <tr>
                            <td><strong>${rc.name}</strong></td>
                            <td>${rc.phone}</td>
                            <td><span class="badge badge-primary">${rc.visits} visits</span></td>
                            <td>${new Date(rc.lastVisit).toLocaleDateString('en-US', {month: 'short', day: 'numeric', year: 'numeric'})}</td>
                            <td>${rc.avgGuests} guests</td>
                            <td><button class="btn-success" style="padding:.5rem 1rem;font-size:.875rem" onclick="alert('📱 Send Offer feature coming soon!\\n\\nWill send SMS/WhatsApp to:\\n${rc.name}\\n${rc.phone}')">📱 Send Offer</button></td>
                        </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        </div>
        ` : ''}

        <!-- Export Preview -->
        <div class="card" style="background:linear-gradient(135deg,#faf5ff 0%,#f3e8ff 100%);border:3px dashed #9333ea">
            <div style="text-align:center">
                <div style="font-size:3rem;margin-bottom:1rem">📦</div>
                <h3 style="color:#9333ea">Ready to Export</h3>
                <p style="color:var(--gray-700);margin-bottom:1.5rem">Download complete data with all timestamps and customer details</p>
                <div style="display:flex;gap:1rem;justify-content:center;flex-wrap:wrap">
                    <button onclick="exportAnalyticsCSV('${rid}')" class="btn-primary" style="font-size:1.1rem;padding:1rem 2rem">
                        <span style="font-size:1.5rem">📥</span>
                        Download CSV (Excel)
                    </button>
                    <button onclick="alert('📄 PDF Report coming soon!\\n\\nWill include:\\n• Customer list\\n• Statistics\\n• Charts')" class="btn-warning" style="font-size:1.1rem;padding:1rem 2rem">
                        <span style="font-size:1.5rem">📄</span>
                        Download PDF Report
                    </button>
                </div>
            </div>
        </div>

    </div>
</div>
    `;

    render(html);
}

// ============================================================================
// FILTER FUNCTIONS
// ============================================================================

function applyFilters(queue, filterState) {
    let filtered = [...queue];

    // Date filtering
    if (filterState.dateFrom) {
        const fromDate = new Date(filterState.dateFrom);
        fromDate.setHours(0, 0, 0, 0);
        filtered = filtered.filter(c => {
            const joinDate = new Date(c.joinedAt);
            joinDate.setHours(0, 0, 0, 0);
            return joinDate >= fromDate;
        });
    }

    if (filterState.dateTo) {
        const toDate = new Date(filterState.dateTo);
        toDate.setHours(23, 59, 59, 999);
        filtered = filtered.filter(c => {
            const joinDate = new Date(c.joinedAt);
            return joinDate <= toDate;
        });
    }

    // Time slot filtering
    if (filterState.timeSlots.length > 0) {
        filtered = filtered.filter(c => {
            const hour = new Date(c.joinedAt).getHours();
            return filterState.timeSlots.some(slot => {
                if (slot === 'morning') return hour >= 6 && hour < 12;
                if (slot === 'lunch') return hour >= 12 && hour < 16;
                if (slot === 'evening') return hour >= 16 && hour < 18;
                if (slot === 'dinner') return hour >= 18 && hour < 23;
                if (slot === 'late') return hour >= 23 || hour < 6;
                return false;
            });
        });
    }

    // Search filtering
    if (filterState.searchQuery) {
        const query = filterState.searchQuery.toLowerCase();
        filtered = filtered.filter(c => 
            c.name.toLowerCase().includes(query) || 
            c.phone.includes(query) ||
            c.queueNumber.toLowerCase().includes(query)
        );
    }

    return filtered;
}

function updateAnalyticsFilters(rid) {
    const dateFrom = document.getElementById('dateFrom').value;
    const dateTo = document.getElementById('dateTo').value;
    const searchQuery = document.getElementById('searchBox').value;

    analyticsFilterState.dateFrom = dateFrom;
    analyticsFilterState.dateTo = dateTo || null;
    analyticsFilterState.searchQuery = searchQuery;

    // Re-render
    const r = DB.restaurants[rid];
    if (r) {
        renderAnalyticsPage(rid, r, r.queue || []);
    }
}

function toggleAnalyticsTimeSlot(slot, rid) {
    const index = analyticsFilterState.timeSlots.indexOf(slot);
    if (index > -1) {
        analyticsFilterState.timeSlots.splice(index, 1);
    } else {
        analyticsFilterState.timeSlots.push(slot);
    }

    // Re-render
    const r = DB.restaurants[rid];
    if (r) {
        renderAnalyticsPage(rid, r, r.queue || []);
    }
}

// ============================================================================
// STATISTICS CALCULATION
// ============================================================================

function calculateStats(queue) {
    if (queue.length === 0) {
        return {
            totalCustomers: 0,
            avgWaitTime: 'N/A',
            totalGuests: 0,
            peakHours: 'N/A',
            peakCustomers: 0
        };
    }

    // Total customers
    const totalCustomers = queue.length;

    // Total guests
    const totalGuests = queue.reduce((sum, c) => sum + (c.guests || 0), 0);

    // Average wait time (only for seated customers)
    const seatedCustomers = queue.filter(c => c.allocatedAt);
    let avgWaitTime = 'N/A';
    if (seatedCustomers.length > 0) {
        const totalWaitMinutes = seatedCustomers.reduce((sum, c) => {
            const joinTime = new Date(c.joinedAt);
            const seatTime = new Date(c.allocatedAt);
            const waitMinutes = Math.round((seatTime - joinTime) / 60000);
            return sum + waitMinutes;
        }, 0);
        avgWaitTime = Math.round(totalWaitMinutes / seatedCustomers.length) + 'm';
    }

    // Peak hours
    const hourCounts = {};
    queue.forEach(c => {
        const hour = new Date(c.joinedAt).getHours();
        hourCounts[hour] = (hourCounts[hour] || 0) + 1;
    });
    
    let peakHour = 0;
    let peakCustomers = 0;
    Object.entries(hourCounts).forEach(([hour, count]) => {
        if (count > peakCustomers) {
            peakCustomers = count;
            peakHour = parseInt(hour);
        }
    });

    const peakHours = peakHour === 0 ? 'N/A' : `${peakHour % 12 || 12}-${(peakHour + 1) % 12 || 12}${peakHour >= 12 ? 'PM' : 'AM'}`;

    return {
        totalCustomers,
        avgWaitTime,
        totalGuests,
        peakHours,
        peakCustomers
    };
}

function getRepeatCustomers(queue) {
    const phoneMap = {};
    
    queue.forEach(c => {
        if (!phoneMap[c.phone]) {
            phoneMap[c.phone] = {
                name: c.name,
                phone: c.phone,
                visits: 0,
                totalGuests: 0,
                lastVisit: c.joinedAt
            };
        }
        phoneMap[c.phone].visits++;
        phoneMap[c.phone].totalGuests += c.guests || 0;
        if (new Date(c.joinedAt) > new Date(phoneMap[c.phone].lastVisit)) {
            phoneMap[c.phone].lastVisit = c.joinedAt;
        }
    });

    const repeatCustomers = Object.values(phoneMap)
        .filter(c => c.visits >= 2)
        .map(c => ({
            ...c,
            avgGuests: Math.round(c.totalGuests / c.visits)
        }))
        .sort((a, b) => b.visits - a.visits);

    return repeatCustomers;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function formatDateRange(filterState) {
    if (!filterState.dateFrom) return 'All Time';
    
    const fromDate = new Date(filterState.dateFrom).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
    });

    if (!filterState.dateTo) {
        return fromDate;
    }

    const toDate = new Date(filterState.dateTo).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
    });

    return `${fromDate} - ${toDate}`;
}

function getActiveTimeSlotsText(filterState) {
    if (filterState.timeSlots.length === 0) return 'All Day';
    
    const slotNames = {
        morning: 'Morning',
        lunch: 'Lunch',
        evening: 'Evening',
        dinner: 'Dinner',
        late: 'Late Night'
    };

    return filterState.timeSlots.map(s => slotNames[s] || s).join(' & ');
}

// ============================================================================
// EXPORT FUNCTIONS
// ============================================================================

function exportAnalyticsCSV(rid) {
    const r = DB.restaurants[rid];
    if (!r) {
        alert('❌ Restaurant data not found');
        return;
    }

    const queue = r.queue || [];
    const filteredQueue = applyFilters(queue, analyticsFilterState);

    if (filteredQueue.length === 0) {
        alert('⚠️ No data to export with current filters');
        return;
    }

    // CSV Header
    let csv = 'Queue Number,Customer Name,Phone,Guests,Join Date,Join Time,Seat Date,Seat Time,Wait Duration (minutes),Table Number,Status\n';

    // CSV Rows
    filteredQueue.forEach(c => {
        const joinTime = new Date(c.joinedAt);
        const seatTime = c.allocatedAt ? new Date(c.allocatedAt) : null;
        const waitMinutes = seatTime ? Math.round((seatTime - joinTime) / 60000) : '';

        csv += `"${c.queueNumber}",`;
        csv += `"${c.name}",`;
        csv += `"${c.phone}",`;
        csv += `${c.guests},`;
        csv += `"${joinTime.toLocaleDateString()}",`;
        csv += `"${joinTime.toLocaleTimeString()}",`;
        csv += `"${seatTime ? seatTime.toLocaleDateString() : ''}",`;
        csv += `"${seatTime ? seatTime.toLocaleTimeString() : ''}",`;
        csv += `${waitMinutes},`;
        csv += `"${c.tableNo || ''}",`;
        csv += `"${c.status}"\n`;
    });

    // Create download link
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    
    const filename = `QueueApp-${r.name.replace(/[^a-z0-9]/gi, '-')}-${new Date().toISOString().slice(0, 10)}.csv`;
    
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    alert(`✅ CSV Downloaded!\n\nFilename: ${filename}\nRecords: ${filteredQueue.length}\n\nOpen with Excel or Google Sheets`);
}

// ============================================================================
// EXPOSE FUNCTIONS TO GLOBAL SCOPE
// ============================================================================

window.showAnalytics = showAnalytics;
window.renderAnalyticsPage = renderAnalyticsPage;
window.updateAnalyticsFilters = updateAnalyticsFilters;
window.toggleAnalyticsTimeSlot = toggleAnalyticsTimeSlot;
window.exportAnalyticsCSV = exportAnalyticsCSV;
