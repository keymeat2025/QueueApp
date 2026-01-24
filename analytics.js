
// ============================================================================
// QUEUEAPP - ANALYTICS MODULE (🔒 SECURED WITH PREMIUM ACCESS CONTROL)
// Customer Data & Analytics Page - Premium Feature Only
// ============================================================================

// ============================================================================
// 🔐 SECURITY LAYER - PREMIUM ACCESS VALIDATION
// ============================================================================

/**
 * Security Guard - Validates premium access before allowing analytics functions
 * Returns true if user has active premium subscription, false otherwise
 */
function validatePremiumAccess(rid, functionName = 'analytics') {
    const r = DB.restaurants[rid];
    
    if (!r) {
        console.error(`[SECURITY] Restaurant ${rid} not found - blocking ${functionName}`);
        showPremiumAccessDenied(rid, 'Restaurant not found');
        return false;
    }
    
    if (r.plan !== 'premium') {
        console.warn(`[SECURITY] Blocked ${functionName} - User has ${r.plan} plan (Premium required)`);
        showPremiumAccessDenied(rid, `${functionName} requires Premium subscription`);
        return false;
    }
    
    if (r.planStatus !== 'active') {
        console.warn(`[SECURITY] Blocked ${functionName} - Plan status: ${r.planStatus}`);
        showPremiumAccessDenied(rid, `Premium plan is ${r.planStatus}`);
        return false;
    }
    
    // ===== 🔒 EXPIRY DATE VALIDATION =====
    if (r.planExpiryDate) {
        const now = Date.now();
        const expiryDate = r.planExpiryDate;
        
        if (expiryDate < now) {
            const daysExpired = Math.floor((now - expiryDate) / (1000 * 60 * 60 * 24));
            console.warn(`[SECURITY] Blocked ${functionName} - Premium expired ${daysExpired} days ago`);
            showPremiumAccessDenied(rid, `Premium subscription expired ${daysExpired} day${daysExpired > 1 ? 's' : ''} ago. Please renew to continue.`);
            return false;
        }
        
        // Log days remaining for monitoring
        const daysRemaining = Math.ceil((expiryDate - now) / (1000 * 60 * 60 * 24));
        console.log(`[SECURITY] ✅ Premium access granted for ${functionName} (${daysRemaining} days remaining)`);
    } else {
        console.log(`[SECURITY] ✅ Premium access granted for ${functionName} (No expiry date set)`);
    }
    
    return true;
}

/**
 * Show premium access denied modal and redirect to dashboard
 */
function showPremiumAccessDenied(rid, reason) {
    console.error(`[SECURITY VIOLATION] Unauthorized analytics access attempt - ${reason}`);
    
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.style.zIndex = '99999';
    modal.innerHTML = `
        <div class="modal-content" style="max-width:500px;text-align:center">
            <div style="font-size:4rem;margin-bottom:1rem">🔒</div>
            <h2 style="color:var(--danger);margin-bottom:1rem">Premium Feature</h2>
            <p style="color:var(--gray-700);margin-bottom:2rem">
                ${reason}<br><br>
                Customer analytics requires an active Premium subscription.
            </p>
            <div style="background:linear-gradient(135deg,#fef9c3 0%,#fef3c7 100%);padding:1.5rem;border-radius:1rem;margin-bottom:2rem">
                <h3 style="color:var(--primary);margin-bottom:1rem">📊 Premium Analytics Includes:</h3>
                <ul style="text-align:left;margin:0 auto;max-width:300px;color:var(--gray-700)">
                    <li>✅ Complete customer history</li>
                    <li>✅ Advanced filtering & search</li>
                    <li>✅ CSV export to Excel</li>
                    <li>✅ Repeat customer insights</li>
                    <li>✅ Wait time analysis</li>
                </ul>
            </div>
            <div class="flex gap-1 justify-center">
                <button onclick="navigate('/r/${rid}/admin')" class="btn btn-secondary">
                    ← Dashboard
                </button>
                <button onclick="upgradeFromAnalyticsBlock('${rid}')" class="btn btn-primary">
                    ⚡ Upgrade to Premium
                </button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
    
    setTimeout(() => {
        navigate(`/r/${rid}/admin`);
        modal.remove();
    }, 5000);
}

/**
 * Track analytics access attempt for conversion tracking
 */
function upgradeFromAnalyticsBlock(rid) {
    sessionStorage.setItem('upgrade_source', 'analytics_access_blocked');
    navigate('/pricing');
}

// ============================================================================
// END SECURITY LAYER
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
    // ===== 🔒 SECURITY CHECK =====
    if (!validatePremiumAccess(rid, 'showAnalytics')) {
        console.error('[SECURITY] showAnalytics blocked - Premium access required');
        return;
    }
    // ===== END SECURITY CHECK =====
    
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

    // Get all queue data (current + archived) - FIXED: Pass both params and await
    const allQueue = await getCompleteQueueData(r, rid);
    
    renderAnalyticsPage(rid, r, allQueue);
}

// ============================================================================
// GET COMPLETE QUEUE DATA (CURRENT + ARCHIVED)
// ============================================================================

async function getCompleteQueueData(restaurant, rid) {
    // ===== 🔒 SECURITY CHECK =====
    if (!validatePremiumAccess(rid, 'getCompleteQueueData')) {
        console.error('[SECURITY] getCompleteQueueData blocked');
        return [];
    }
    // ===== END SECURITY CHECK =====
    
    // Validate parameters
    if (!restaurant || !rid) {
        console.error('Invalid parameters:', { restaurant, rid });
        return []; // Return empty array instead of undefined
    }

    let allCustomers = [];
    
    // 1. Current queue
    if (restaurant.queue && restaurant.queue.length > 0) {
        allCustomers = [...restaurant.queue];
    }
    
    // 2. OLD FORMAT: queueArchive in restaurant doc
    if (restaurant.queueArchive && Object.keys(restaurant.queueArchive).length > 0) {
        Object.keys(restaurant.queueArchive).forEach(date => {
            const archive = restaurant.queueArchive[date];
            if (archive.customers && Array.isArray(archive.customers)) {
                archive.customers.forEach(c => {
                    allCustomers.push({
                        ...c,
                        _fromArchive: true,
                        _archiveDate: date,
                        _archiveSource: 'old'
                    });
                });
            }
        });
    }
    
    // 3. NEW FORMAT: Archives collection (with auto-split support)
    try {
        const archivesSnapshot = await db.collection('archives')
            .where('restaurantId', '==', rid)
            .get();
        
        if (!archivesSnapshot.empty) {
            for (const doc of archivesSnapshot.docs) {
                const archive = doc.data();
                
                // Handle multi-part archives
                if (archive.customers && Array.isArray(archive.customers)) {
                    archive.customers.forEach(c => {
                        allCustomers.push({
                            ...c,
                            _fromArchive: true,
                            _archiveDate: archive.date,
                            _archiveSource: 'new',
                            _archivePart: archive.partNumber || 1
                        });
                    });
                }
            }
        }
    } catch (error) {
        console.error('Error loading archives:', error);
        // Don't throw - just log and continue with what we have
    }
    
    return allCustomers; // Always return an array
}

// ============================================================================
// RENDER ANALYTICS PAGE
// ============================================================================

function renderAnalyticsPage(rid, r, allQueue) {
    // ===== 🔒 SECURITY CHECK =====
    if (!validatePremiumAccess(rid, 'renderAnalyticsPage')) {
        console.error('[SECURITY] renderAnalyticsPage blocked');
        return;
    }
    // ===== END SECURITY CHECK =====
    
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
        <div class="card mb">
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
                    <button class="btn ${isSlotActive('morning') ? 'btn-primary' : 'btn-secondary'}" style="padding:.5rem 1rem;font-size:.875rem" onclick="toggleAnalyticsTimeSlot('morning', '${rid}')">🌅 Morning (6-11 AM)</button>
                    <button class="btn ${isSlotActive('lunch') ? 'btn-primary' : 'btn-secondary'}" style="padding:.5rem 1rem;font-size:.875rem" onclick="toggleAnalyticsTimeSlot('lunch', '${rid}')">🌞 Lunch (12-3 PM)</button>
                    <button class="btn ${isSlotActive('evening') ? 'btn-primary' : 'btn-secondary'}" style="padding:.5rem 1rem;font-size:.875rem" onclick="toggleAnalyticsTimeSlot('evening', '${rid}')">🌆 Evening (4-6 PM)</button>
                    <button class="btn ${isSlotActive('dinner') ? 'btn-primary' : 'btn-secondary'}" style="padding:.5rem 1rem;font-size:.875rem" onclick="toggleAnalyticsTimeSlot('dinner', '${rid}')">🌙 Dinner (6-11 PM)</button>
                    <button class="btn ${isSlotActive('late') ? 'btn-primary' : 'btn-secondary'}" style="padding:.5rem 1rem;font-size:.875rem" onclick="toggleAnalyticsTimeSlot('late', '${rid}')">🌃 Late Night (11 PM+)</button>
                </div>
            </div>

            <div style="display:flex;gap:1rem;flex-wrap:wrap">
                <button onclick="exportAnalyticsCSV('${rid}')" class="btn btn-success">📥 Download CSV</button>
                <button onclick="alert('📄 PDF export coming soon!\\n\\nWill include:\\n• Full customer list\\n• Statistics summary\\n• Charts and graphs')" class="btn btn-warning">📄 Download PDF</button>
                <button onclick="alert('📧 Email report coming soon!\\n\\nWill email you:\\n• Daily summary\\n• Customer details\\n• Analytics dashboard')" class="btn btn-secondary">📧 Email Report</button>
            </div>
        </div>

        <!-- Summary Statistics -->
        <div class="card mb">
            <h2>📊 Summary Statistics</h2>
            <div class="alert alert-info mb">
                <strong>Showing data for:</strong> ${formatDateRange(analyticsFilterState)} | ${getActiveTimeSlotsText(analyticsFilterState)} | Total: ${filteredQueue.length} customers
            </div>

            <div class="grid grid-4 mb">
                <div class="card text-center" style="background:linear-gradient(135deg,#eff6ff 0%,#dbeafe 100%)">
                    <div style="font-size:clamp(2rem,6vw,3rem);font-weight:900;color:#2563eb">${stats.totalCustomers}</div>
                    <div style="color:var(--gray-600);font-size:.875rem">Total Customers</div>
                </div>
                <div class="card text-center" style="background:linear-gradient(135deg,#fff7ed 0%,#ffedd5 100%)">
                    <div style="font-size:clamp(2rem,6vw,3rem);font-weight:900;color:#ea580c">${stats.avgWaitTime}</div>
                    <div style="color:var(--gray-600);font-size:.875rem">Avg Wait Time</div>
                </div>
                <div class="card text-center" style="background:linear-gradient(135deg,#f0fdf4 0%,#dcfce7 100%)">
                    <div style="font-size:clamp(2rem,6vw,3rem);font-weight:900;color:#16a34a">${stats.totalGuests}</div>
                    <div style="color:var(--gray-600);font-size:.875rem">Total Guests</div>
                </div>
                <div class="card text-center" style="background:linear-gradient(135deg,#fef9c3 0%,#fef3c7 100%)">
                    <div style="font-size:clamp(2rem,6vw,3rem);font-weight:900;color:#ca8a04">${stats.peakHours}</div>
                    <div style="color:var(--gray-600);font-size:.875rem">Peak Hours</div>
                </div>
            </div>
        </div>

        <!-- Detailed Customer Data Table -->
        <div class="card mb">
            <div class="flex justify-between items-center mb">
                <h2>👥 Customer Details</h2>
                <input type="text" id="searchBox" placeholder="🔍 Search by name or phone..." style="max-width:300px;margin:0" value="${analyticsFilterState.searchQuery}" oninput="updateAnalyticsFilters('${rid}')">
            </div>

            <div style="overflow-x:auto">
                <table style="width:100%;border-collapse:collapse">
                    <thead>
                        <tr style="background:var(--gray-100);text-align:left">
                            <th style="padding:.75rem;border-bottom:2px solid var(--gray-200)">Queue #</th>
                            <th style="padding:.75rem;border-bottom:2px solid var(--gray-200)">Customer Name</th>
                            <th style="padding:.75rem;border-bottom:2px solid var(--gray-200)">Phone</th>
                            <th style="padding:.75rem;border-bottom:2px solid var(--gray-200)">Guests</th>
                            <th style="padding:.75rem;border-bottom:2px solid var(--gray-200)">Join Time</th>
                            <th style="padding:.75rem;border-bottom:2px solid var(--gray-200)">Seat Time</th>
                            <th style="padding:.75rem;border-bottom:2px solid var(--gray-200)">Wait Duration</th>
                            <th style="padding:.75rem;border-bottom:2px solid var(--gray-200)">Table #</th>
                            <th style="padding:.75rem;border-bottom:2px solid var(--gray-200)">Status</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${filteredQueue.length > 0 ? filteredQueue.slice(0, 50).map(c => {
                            const joinTime = new Date(c.joinedAt);
                            const seatTime = c.allocatedAt ? new Date(c.allocatedAt) : null;
                            const waitMinutes = seatTime ? Math.round((seatTime - joinTime) / 60000) : null;
                            const waitColor = waitMinutes ? (waitMinutes < 15 ? 'var(--success)' : waitMinutes < 25 ? 'var(--warning)' : 'var(--danger)') : '';
                            
                            return `
                            <tr style="border-bottom:1px solid var(--gray-200)">
                                <td style="padding:.75rem"><strong>${c.queueNumber}</strong></td>
                                <td style="padding:.75rem">${c.name}</td>
                                <td style="padding:.75rem">${c.phone}</td>
                                <td style="padding:.75rem">${c.guests}</td>
                                <td style="padding:.75rem">${joinTime.toLocaleTimeString('en-US', {hour: '2-digit', minute: '2-digit'})}</td>
                                <td style="padding:.75rem">${seatTime ? seatTime.toLocaleTimeString('en-US', {hour: '2-digit', minute: '2-digit'}) : '-'}</td>
                                <td style="padding:.75rem">${waitMinutes !== null && waitMinutes >= 0 && waitMinutes < 300 ? `<span style="color:${waitColor};font-weight:600">${waitMinutes}m</span>` : '-'}</td>
                                <td style="padding:.75rem">${c.tableNo || '-'}</td>
                                <td style="padding:.75rem"><span class="badge badge-${c.status === 'allocated' ? 'success' : 'warning'}">${c.status === 'allocated' ? 'Seated' : 'Waiting'}</span></td>
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
        <div class="grid grid-2 mb">
            <div class="card">
                <h3>📈 Hourly Customer Flow</h3>
                <div style="text-align:center;padding:2rem;background:var(--gray-50);border-radius:1rem">
                    <div style="font-size:3rem;margin-bottom:1rem">📊</div>
                    <p style="color:var(--gray-700);font-weight:600">Peak: ${stats.peakHours}</p>
                    <p style="color:var(--gray-600)">${stats.peakCustomers} customers</p>
                    <p style="color:var(--gray-500);font-size:.875rem;margin-top:1rem">Bar chart showing customer distribution by hour</p>
                </div>
            </div>

            <div class="card">
                <h3>⏱️ Wait Time Analysis</h3>
                <div style="text-align:center;padding:2rem;background:linear-gradient(135deg,#fef9c3 0%,#fef3c7 100%);border-radius:1rem">
                    <div style="font-size:3rem;margin-bottom:1rem">⏱️</div>
                    <p style="color:var(--gray-700);font-weight:600">Average: ${stats.avgWaitTime}</p>
                    <p style="color:var(--gray-600);font-size:.875rem;margin-top:1rem">Line chart showing wait times throughout the day</p>
                </div>
            </div>
        </div>

        <!-- Repeat Customer Insights -->
        ${repeatCustomers.length > 0 ? `
        <div class="card mb">
            <h3>🔄 Repeat Customer Insights</h3>
            <div class="alert alert-info mb">
                <strong>💡 Tip:</strong> These customers visited multiple times. Consider sending them loyalty rewards!
            </div>
            <div style="overflow-x:auto">
                <table style="width:100%;border-collapse:collapse">
                    <thead>
                        <tr style="background:var(--gray-100);text-align:left">
                            <th style="padding:.75rem;border-bottom:2px solid var(--gray-200)">Customer Name</th>
                            <th style="padding:.75rem;border-bottom:2px solid var(--gray-200)">Phone</th>
                            <th style="padding:.75rem;border-bottom:2px solid var(--gray-200)">Total Visits</th>
                            <th style="padding:.75rem;border-bottom:2px solid var(--gray-200)">Last Visit</th>
                            <th style="padding:.75rem;border-bottom:2px solid var(--gray-200)">Avg Party Size</th>
                            <th style="padding:.75rem;border-bottom:2px solid var(--gray-200)">Action</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${repeatCustomers.slice(0, 10).map(rc => `
                        <tr style="border-bottom:1px solid var(--gray-200)">
                            <td style="padding:.75rem"><strong>${rc.name}</strong></td>
                            <td style="padding:.75rem">${rc.phone}</td>
                            <td style="padding:.75rem"><span class="badge badge-primary">${rc.visits} visits</span></td>
                            <td style="padding:.75rem">${new Date(rc.lastVisit).toLocaleDateString('en-US', {month: 'short', day: 'numeric', year: 'numeric'})}</td>
                            <td style="padding:.75rem">${rc.avgGuests} guests</td>
                            <td style="padding:.75rem"><button class="btn btn-success" style="padding:.5rem 1rem;font-size:.875rem" onclick="alert('📱 Send Offer feature coming soon!\\n\\nWill send SMS/WhatsApp to:\\n${rc.name}\\n${rc.phone}')">📱 Send Offer</button></td>
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
                    <button onclick="exportAnalyticsCSV('${rid}')" class="btn btn-primary" style="font-size:1.1rem;padding:1rem 2rem">
                        <span style="font-size:1.5rem">📥</span>
                        Download CSV (Excel)
                    </button>
                    <button onclick="alert('📄 PDF Report coming soon!\\n\\nWill include:\\n• Customer list\\n• Statistics\\n• Charts')" class="btn btn-warning" style="font-size:1.1rem;padding:1rem 2rem">
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

async function updateAnalyticsFilters(rid) {
    // ===== 🔒 SECURITY CHECK =====
    if (!validatePremiumAccess(rid, 'updateAnalyticsFilters')) {
        console.error('[SECURITY] Filter update blocked');
        return;
    }
    // ===== END SECURITY CHECK =====
    
    const dateFrom = document.getElementById('dateFrom').value;
    const dateTo = document.getElementById('dateTo').value;
    const searchQuery = document.getElementById('searchBox').value;

    analyticsFilterState.dateFrom = dateFrom;
    analyticsFilterState.dateTo = dateTo || null;
    analyticsFilterState.searchQuery = searchQuery;

    // Re-render with complete data
    const r = DB.restaurants[rid];
    if (r) {
        const allQueue = await getCompleteQueueData(r, rid);
        renderAnalyticsPage(rid, r, allQueue);
    }
}

async function toggleAnalyticsTimeSlot(slot, rid) {
    // ===== 🔒 SECURITY CHECK =====
    if (!validatePremiumAccess(rid, 'toggleAnalyticsTimeSlot')) {
        console.error('[SECURITY] Time slot toggle blocked');
        return;
    }
    // ===== END SECURITY CHECK =====
    
    const index = analyticsFilterState.timeSlots.indexOf(slot);
    if (index > -1) {
        analyticsFilterState.timeSlots.splice(index, 1);
    } else {
        analyticsFilterState.timeSlots.push(slot);
    }

    // Re-render with complete data
    const r = DB.restaurants[rid];
    if (r) {
        const allQueue = await getCompleteQueueData(r, rid);
        renderAnalyticsPage(rid, r, allQueue);
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

    // Average wait time (only for seated customers) - WITH VALIDATION
    const seatedCustomers = queue.filter(c => c.allocatedAt);
    let avgWaitTime = 'N/A';
    if (seatedCustomers.length > 0) {
        const validWaitTimes = [];
        seatedCustomers.forEach(c => {
            const joinTime = new Date(c.joinedAt);
            const seatTime = new Date(c.allocatedAt);
            const waitMinutes = Math.round((seatTime - joinTime) / 60000);
            // Only include valid wait times (positive and < 5 hours)
            if (waitMinutes >= 0 && waitMinutes < 300) {
                validWaitTimes.push(waitMinutes);
            }
        });
        if (validWaitTimes.length > 0) {
            const totalWaitMinutes = validWaitTimes.reduce((sum, wt) => sum + wt, 0);
            avgWaitTime = Math.round(totalWaitMinutes / validWaitTimes.length) + 'm';
        }
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

async function exportAnalyticsCSV(rid) {
    // ===== 🔒 SECURITY CHECK =====
    if (!validatePremiumAccess(rid, 'exportAnalyticsCSV')) {
        console.error('[SECURITY] CSV export blocked - Premium required');
        alert('🔒 CSV Export is a Premium Feature\n\nUpgrade to Premium to export your customer data to Excel.');
        return;
    }
    // ===== END SECURITY CHECK =====
    
    const r = DB.restaurants[rid];
    if (!r) {
        alert('❌ Restaurant data not found');
        return;
    }

    // Get complete queue data (current + archived)
    const allQueue = await getCompleteQueueData(r, rid);
    const filteredQueue = applyFilters(allQueue, analyticsFilterState);

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
        
        // Calculate wait time with validation
        let waitMinutes = '';
        if (seatTime) {
            const wt = Math.round((seatTime - joinTime) / 60000);
            // Only include valid wait times
            if (wt >= 0 && wt < 300) {
                waitMinutes = wt;
            }
        }

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
// EXPOSE FUNCTIONS TO GLOBAL SCOPE (WITH SECURITY WRAPPERS)
// ============================================================================

window.showAnalytics = showAnalytics;
window.getCompleteQueueData = getCompleteQueueData;
window.renderAnalyticsPage = renderAnalyticsPage;
window.updateAnalyticsFilters = updateAnalyticsFilters;
window.toggleAnalyticsTimeSlot = toggleAnalyticsTimeSlot;
window.exportAnalyticsCSV = exportAnalyticsCSV;

// Expose security helpers for integration
window.validatePremiumAccess = validatePremiumAccess;
window.showPremiumAccessDenied = showPremiumAccessDenied;
window.upgradeFromAnalyticsBlock = upgradeFromAnalyticsBlock;

console.log('✅ QueueApp Analytics Module Loaded');
console.log('🔒 Premium Access Control: ENABLED');
console.log('🛡️ All 6 analytics functions protected by subscription validation');
