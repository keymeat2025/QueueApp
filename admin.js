// ============================================================================
// QUEUEAPP - ADMIN.JS (CLEANED - MENU MANAGEMENT REMOVED)
// Restaurant & Platform Admin Module
// Includes: Admin dashboards, payments, cleanup, QR poster, upgrade modals
// NEW: Circular Progress Chart for Days Remaining
// REMOVED: All Menu Management Features
// ============================================================================

// ============================================================================
// RESTAURANT ADMIN DASHBOARD
// ============================================================================

async function showRestaurantAdmin(rid) {
  // Cleanup previous listener
  if (window.adminUnsubscribe) {
    window.adminUnsubscribe();
  }
  
  // Set up real-time listener
  window.adminUnsubscribe = db.collection('restaurants').doc(rid).onSnapshot(async (doc) => {
    if (!doc.exists) {
      render(`<div class="container text-center" style="padding-top:4rem"><h1 style="color:var(--danger)">Not found</h1></div>`);
      return;
    }
    
    const restaurant = doc.data();
    DB.restaurants[rid] = restaurant;
    DB.save();
    
    const waiting = restaurant.queue.filter(q => q.status === 'waiting');
    const allocated = restaurant.queue.filter(q => q.status === 'allocated');
    
    // Get analytics
    const analyticsResult = await FirebaseDB.getAnalytics(rid);
    const analytics = analyticsResult.success ? analyticsResult.analytics : {};
    const customersThisMonth = analytics.customersThisMonth || 0;
    const limit = restaurant.plan === 'free' ? 500 : 'unlimited';
    const percentage = restaurant.plan === 'free' ? Math.round((customersThisMonth / 500) * 100) : 0;
    
    const currentPlan = restaurant.plan || 'free';
    const planStatus = restaurant.planStatus || 'active';
    const planBadge = `<span class="badge ${currentPlan === 'premium' && planStatus === 'active' ? 'badge-primary' : planStatus === 'pending' ? 'badge-warning' : planStatus === 'rejected' ? 'badge-danger' : 'badge-secondary'}">${planStatus === 'pending' ? 'PENDING' : planStatus === 'rejected' ? 'REJECTED' : currentPlan.toUpperCase()}</span>`;
    
    const today = new Date().toISOString().slice(0, 10);
    const todayFormatted = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    const needsCleanup = restaurant.lastCleanupDate !== today;
    const queueCount = restaurant.queue.length;
    
    let cleanupAlert = '';
    if (currentPlan === 'free') {
      if (needsCleanup) {
        cleanupAlert = `
          <div class="alert alert-warning mb">
            <div style="display:flex;align-items:center;gap:clamp(.75rem,1.5vw,1rem);flex-wrap:wrap">
              <div style="font-size:clamp(1.5rem,4vw,2rem)">⚠️</div>
              <div style="flex:1">
                <p style="font-weight:700;margin-bottom:.5rem;font-size:clamp(.875rem,2vw,1rem)">Daily Cleanup Required</p>
                <p style="font-size:clamp(.75rem,1.5vw,.875rem);margin:0">Queue needs to be reset for today • Takes 2 seconds</p>
              </div>
              <button onclick="showCleanupChoiceModal('${rid}',${queueCount})" class="btn btn-primary" style="min-width:auto">Reset Queue Now</button>
            </div>
          </div>
        `;
      } else {
        cleanupAlert = `
          <div class="alert alert-success mb">
            <div style="display:flex;align-items:center;gap:clamp(.75rem,1.5vw,1rem);flex-wrap:wrap">
              <div style="font-size:clamp(1.5rem,4vw,2rem)">✅</div>
              <div style="flex:1">
                <p style="font-weight:700;margin-bottom:.25rem;font-size:clamp(.875rem,2vw,1rem)">Queue is Fresh!</p>
                <p style="font-size:clamp(.75rem,1.5vw,.875rem);margin:0">Already reset today • Next reset required tomorrow</p>
              </div>
            </div>
          </div>
        `;
      }
    } else if (currentPlan === 'premium' && planStatus === 'active') {
      cleanupAlert = `
        <div class="alert alert-info mb">
          <div style="display:flex;align-items:center;gap:clamp(.75rem,1.5vw,1rem);flex-wrap:wrap">
            <div style="font-size:clamp(1.5rem,4vw,2rem)">⚡</div>
            <div style="flex:1">
              <p style="font-weight:700;margin-bottom:.25rem;font-size:clamp(.875rem,2vw,1rem)">Automatic Cleanup Active</p>
              <p style="font-size:clamp(.75rem,1.5vw,.875rem);margin:0">Queue automatically resets at midnight • Zero effort required</p>
            </div>
          </div>
        </div>
      `;
    }
    
    // ===== 📊 PREMIUM EXPIRY PI CHART =====
    let premiumAlert = '';
    if (currentPlan === 'premium' && planStatus === 'active') {
      if (restaurant.planExpiryDate) {
        const now = Date.now();
        const expiryDate = restaurant.planExpiryDate;
        const daysRemaining = Math.ceil((expiryDate - now) / (1000 * 60 * 60 * 24));
        const totalDays = calculateTotalDays(restaurant);
        const daysElapsed = Math.max(0, totalDays - daysRemaining);
        const percentageRemaining = Math.max(0, Math.min(100, (daysRemaining / totalDays) * 100));
        const expiryDateFormatted = new Date(expiryDate).toLocaleDateString('en-US', { 
          year: 'numeric', 
          month: 'long', 
          day: 'numeric' 
        });
        
        if (daysRemaining > 0) {
          // Active Premium - Show PI CHART
          let alertColor = 'success';
          let alertBg = 'linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)';
          let chartColor = '#16a34a';
          let alertEmoji = '✅';
          let alertTitle = 'Premium Plan Active';
          
          // Change colors based on days remaining
          if (daysRemaining <= 3) {
            alertColor = 'danger';
            alertBg = 'linear-gradient(135deg, #fee2e2 0%, #fecaca 100%)';
            chartColor = '#dc2626';
            alertEmoji = '⚠️';
            alertTitle = 'Premium Expiring Soon!';
          } else if (daysRemaining <= 7) {
            alertColor = 'warning';
            alertBg = 'linear-gradient(135deg, #fef9c3 0%, #fef3c7 100%)';
            chartColor = '#ca8a04';
            alertEmoji = '⏰';
          }
          
          premiumAlert = `
            <div class="card mb" style="background:${alertBg};border:3px solid ${chartColor}">
              <div style="display:flex;align-items:center;gap:clamp(1rem,3vw,2rem);flex-wrap:wrap">
                
                <!-- PI CHART -->
                <div style="position:relative;width:clamp(120px,20vw,160px);height:clamp(120px,20vw,160px);flex-shrink:0">
                  <svg width="100%" height="100%" viewBox="0 0 200 200" style="transform:rotate(-90deg)">
                    <!-- Background circle -->
                    <circle cx="100" cy="100" r="80" fill="none" stroke="rgba(0,0,0,0.1)" stroke-width="20"/>
                    <!-- Progress circle -->
                    <circle cx="100" cy="100" r="80" fill="none" stroke="${chartColor}" stroke-width="20" 
                            stroke-dasharray="${(percentageRemaining / 100) * 502.65} 502.65" 
                            stroke-linecap="round"
                            style="transition:stroke-dasharray 1s ease"/>
                  </svg>
                  <!-- Center text -->
                  <div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);text-align:center">
                    <div style="font-size:clamp(1.5rem,4vw,2.5rem);font-weight:900;color:${chartColor};line-height:1">${daysRemaining}</div>
                    <div style="font-size:clamp(.625rem,1.5vw,.75rem);color:var(--gray-600);font-weight:600;margin-top:.25rem">DAYS</div>
                  </div>
                </div>
                
                <!-- Info Section -->
                <div style="flex:1;min-width:200px">
                  <div style="display:flex;align-items:center;gap:.75rem;margin-bottom:.75rem">
                    <div style="font-size:clamp(1.5rem,3vw,2rem)">${alertEmoji}</div>
                    <h3 style="margin:0;font-size:clamp(1rem,2.5vw,1.5rem);color:var(--gray-900)">${alertTitle}</h3>
                  </div>
                  
                  <div style="background:white;padding:1rem;border-radius:.75rem;margin-bottom:1rem">
                    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(100px,1fr));gap:1rem">
                      <div>
                        <div style="font-size:clamp(.625rem,1.5vw,.75rem);color:var(--gray-600);font-weight:600;margin-bottom:.25rem">DAYS LEFT</div>
                        <div style="font-size:clamp(1.25rem,3vw,1.75rem);font-weight:900;color:${chartColor}">${daysRemaining}</div>
                      </div>
                      <div>
                        <div style="font-size:clamp(.625rem,1.5vw,.75rem);color:var(--gray-600);font-weight:600;margin-bottom:.25rem">DAYS USED</div>
                        <div style="font-size:clamp(1.25rem,3vw,1.75rem);font-weight:900;color:var(--gray-500)">${daysElapsed}</div>
                      </div>
                      <div>
                        <div style="font-size:clamp(.625rem,1.5vw,.75rem);color:var(--gray-600);font-weight:600;margin-bottom:.25rem">TOTAL DAYS</div>
                        <div style="font-size:clamp(1.25rem,3vw,1.75rem);font-weight:900;color:var(--gray-700)">${totalDays}</div>
                      </div>
                    </div>
                  </div>
       
                  <p style="font-size:clamp(.75rem,1.5vw,.875rem);color:var(--gray-700);margin:0">
                    ${restaurant.subscriptionId ? `<strong>Subscription:</strong> ${restaurant.subscriptionId}<br>` : ''}
                    ${restaurant.subscriptionCycleNumber ? `<strong>Renewal Cycle:</strong> #${restaurant.subscriptionCycleNumber}<br>` : ''}
                    <strong>Expires:</strong> ${expiryDateFormatted}<br>
                    <strong>Benefits:</strong> Unlimited customers • Auto-cleanup • Analytics
                  </p>
                  
                  ${daysRemaining <= 7 ? `
                    <button onclick="navigate('/pricing')" class="btn btn-primary" style="margin-top:1rem;width:100%">
                      🔄 Renew Premium Now
                    </button>
                  ` : ''}
                </div>
                
              </div>
            </div>
          `;
        } else {
          // Expired Premium
          const daysExpired = Math.abs(daysRemaining);
          premiumAlert = `
            <div class="card mb" style="background:linear-gradient(135deg, #fee2e2 0%, #fecaca 100%);border:3px solid #dc2626">
              <div style="display:flex;align-items:center;gap:clamp(1rem,3vw,2rem);flex-wrap:wrap">
                
                <!-- EXPIRED PI CHART -->
                <div style="position:relative;width:clamp(120px,20vw,160px);height:clamp(120px,20vw,160px);flex-shrink:0">
                  <svg width="100%" height="100%" viewBox="0 0 200 200" style="transform:rotate(-90deg)">
                    <circle cx="100" cy="100" r="80" fill="none" stroke="rgba(220,38,38,0.2)" stroke-width="20"/>
                  </svg>
                  <div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);text-align:center">
                    <div style="font-size:clamp(2rem,5vw,3rem);line-height:1">❌</div>
                    <div style="font-size:clamp(.625rem,1.5vw,.75rem);color:var(--danger);font-weight:700;margin-top:.5rem">EXPIRED</div>
                  </div>
                </div>
                
                <!-- Expired Info -->
                <div style="flex:1;min-width:200px">
                  <h3 style="margin:0 0 .75rem 0;font-size:clamp(1rem,2.5vw,1.5rem);color:#dc2626">Premium Subscription Expired</h3>
                  
                  <div style="background:white;padding:1rem;border-radius:.75rem;margin-bottom:1rem">
                    <p style="font-size:clamp(.875rem,2vw,1rem);margin:0;color:var(--gray-700)">
                      Your Premium plan expired <strong style="color:#dc2626">${daysExpired} day${daysExpired !== 1 ? 's' : ''} ago</strong> on <strong>${expiryDateFormatted}</strong>
                    </p>
                  </div>
                  
                  <p style="font-size:clamp(.75rem,1.5vw,.875rem);color:var(--gray-700);margin:0 0 1rem 0">
                    Renew now to restore: Unlimited customers • Analytics • Auto-cleanup
                  </p>
                  
                  <button onclick="navigate('/pricing')" class="btn btn-danger" style="width:100%;font-size:clamp(.875rem,2vw,1rem);padding:clamp(.75rem,2vw,1rem)">
                    ⚡ Renew Premium Now
                  </button>
                </div>
                
              </div>
            </div>
          `;
        }
      } else {
        // Premium without expiry date (legacy/lifetime)
        premiumAlert = `
          <div class="alert alert-success mb">
            <div style="display:flex;align-items:center;gap:clamp(.75rem,1.5vw,1rem);flex-wrap:wrap">
              <div style="font-size:clamp(1.5rem,4vw,2rem)">✅</div>
              <div style="flex:1">
                <p style="font-weight:700;margin-bottom:.25rem;font-size:clamp(.875rem,2vw,1rem)">Premium Plan Active</p>
                <p style="font-size:clamp(.75rem,1.5vw,.875rem);margin:0">Enjoy unlimited customers & auto-cleanup!</p>
              </div>
            </div>
          </div>
        `;
      }
    }
    // ===== END PREMIUM EXPIRY PI CHART =====
    
    render(`
      <div style="min-height:100vh;background:var(--gray-100);padding:clamp(1rem,3vw,2rem)">
        <div class="container">
          <div class="card mb flex justify-between items-center flex-wrap gap-1">
            <div>
              <h1 onclick="navigateHome()" style="cursor:pointer;font-size:clamp(1.25rem,4vw,2rem)">QueueApp</h1>
              <p style="color:var(--gray-600);font-size:clamp(.875rem,2vw,1rem)">${restaurant.name} ${planBadge}</p>
              <p style="color:#10b981;font-size:clamp(.75rem,1.5vw,.875rem)">🔥 Live</p>
            </div>
            <div class="flex gap-1 flex-wrap">
              ${currentPlan === 'premium' && planStatus === 'active' ? `
                <button onclick="navigate('/r/${rid}/analytics')" class="btn btn-success">📊 Queue Data</button>
              ` : `
                <button onclick="showAnalyticsUpgradeModal('${rid}')" class="btn" style="background:#94a3b8;color:white;cursor:pointer;position:relative">
                  📊 Queue Data
                  <span style="position:absolute;top:-8px;right:-8px;background:linear-gradient(135deg,#f59e0b 0%,#ef4444 100%);color:white;font-size:.7rem;padding:.2rem .5rem;border-radius:999px;font-weight:700;box-shadow:0 2px 8px rgba(0,0,0,.2)">PRO</span>
                </button>
              `}
              <button onclick="navigate('/pricing')" class="btn" style="background:#2563eb;color:white">${currentPlan === 'free' && planStatus !== 'pending' ? 'Upgrade' : 'Plan'}</button>
              <button onclick="logout('${rid}')" class="btn btn-danger">Logout</button>
            </div>
          </div>
          
          ${planStatus === 'pending' ? `
            <div class="alert alert-warning mb">
              <div style="display:flex;align-items:center;gap:1rem;flex-wrap:wrap">
                <div style="font-size:clamp(1.5rem,4vw,2rem)">⏳</div>
                <div style="flex:1">
                  <p style="font-weight:700;margin-bottom:.25rem">Premium Upgrade Pending Review</p>
                  <p style="font-size:.875rem;margin:0">Your payment is being verified. This usually takes 2-24 hours.</p>
                </div>
              </div>
            </div>
          ` : ''}
          
          ${planStatus === 'rejected' && restaurant.paymentProof?.rejectionReason ? `
            <div class="alert alert-danger mb">
              <div style="display:flex;align-items:center;gap:1rem;flex-wrap:wrap">
                <div style="font-size:clamp(1.5rem,4vw,2rem)">❌</div>
                <div style="flex:1">
                  <p style="font-weight:700;margin-bottom:.5rem">Premium Upgrade Rejected</p>
                  <p style="font-size:.875rem;margin-bottom:.5rem"><strong>Reason:</strong> ${restaurant.paymentProof.rejectionReason}</p>
                  <p style="font-size:.875rem;margin:0">Please contact support or try upgrading again.</p>
                </div>
              </div>
              <div style="margin-top:1rem;display:flex;gap:.5rem;flex-wrap:wrap">
                <button onclick="navigate('/pricing')" class="btn btn-primary">Try Again</button>
                <a href="mailto:queueapphelpdesk@gmail.com?subject=Payment Rejection - ${rid}" class="btn btn-secondary">Contact Support</a>
              </div>
            </div>
          ` : ''}
          
          ${premiumAlert}
          
          ${cleanupAlert}
          
          <div class="alert alert-info mb">
            <div class="flex justify-between items-center flex-wrap gap-1">
              <div>
                <div style="font-size:clamp(1rem,2.5vw,1.25rem);font-weight:700;margin-bottom:.5rem">📅 Your Queue QR Code</div>
                <p style="margin:0;font-size:clamp(.75rem,1.5vw,.875rem)">${todayFormatted}</p>
                <p style="margin:0;font-size:clamp(.75rem,1.5vw,.875rem);color:#1e40af">🔄 Queue resets at midnight daily</p>
              </div>
              <div style="position:relative">
                <div class="qr-container">
                  <div id="daily-qr"></div>
                </div>
              </div>
            </div>
            <div class="flex gap-1 mt" style="flex-wrap:wrap">
              <button onclick="downloadQRCode('${rid}')" class="btn btn-secondary">💾 Download QR</button>
              <button onclick="copyQRLink('${rid}')" class="btn" style="background:#2563eb;color:white">🔗 Copy Link</button>
              <button onclick="showQRPosterModal('${rid}')" class="btn btn-success">📋 Print Poster</button>
            </div>
            <div class="mt">
              <p style="font-size:.875rem;color:#1e40af;font-weight:600">💡 How to use:</p>
              <ol style="font-size:.875rem;color:#1e40af;margin-left:1.5rem">
                <li>Print/display this QR at your entrance</li>
                <li>Customers scan to join queue instantly</li>
                <li>Queue resets daily at midnight automatically</li>
              </ol>
            </div>
          </div>
          
          ${restaurant.plan === 'free' ? `
            <div class="card mb" style="background:linear-gradient(135deg,#eff6ff 0%,#dbeafe 100%)">
              <h2 style="margin-bottom:1rem;font-size:clamp(1.25rem,3vw,2rem)">📊 Monthly Usage</h2>
              <div class="grid grid-3">
                <div class="card text-center" style="background:white">
                  <div style="font-size:clamp(2rem,6vw,3rem);font-weight:900;color:${percentage > 80 ? 'var(--danger)' : 'var(--primary)'}">${customersThisMonth}</div>
                  <p style="color:var(--gray-600);font-size:clamp(.75rem,1.5vw,.875rem)">This Month</p>
                </div>
                <div class="card text-center" style="background:white">
                  <div style="font-size:clamp(2rem,6vw,3rem);font-weight:900;color:var(--gray-600)">${limit}</div>
                  <p style="color:var(--gray-600);font-size:clamp(.75rem,1.5vw,.875rem)">Limit</p>
                </div>
                <div class="card text-center" style="background:white">
                  <div style="font-size:clamp(2rem,6vw,3rem);font-weight:900;color:${percentage > 80 ? 'var(--danger)' : 'var(--success)'}">${500 - customersThisMonth}</div>
                  <p style="color:var(--gray-600);font-size:clamp(.75rem,1.5vw,.875rem)">Remaining</p>
                </div>
              </div>
              <div class="progress-bar mt">
                <div class="progress-fill" style="background:${percentage > 80 ? 'var(--danger)' : 'var(--success)'};width:${percentage}%">${percentage}%</div>
              </div>
              ${percentage > 80 ? `
                <div class="alert alert-warning mt">
                  ⚠️ Approaching limit! 
                  <button onclick="navigate('/pricing')" class="btn btn-primary" style="margin-left:1rem">Upgrade</button>
                </div>
              ` : ''}
            </div>
          ` : ''}
          
          <div class="grid grid-2 mb">
            <div class="card" style="background:linear-gradient(135deg,#fff7ed 0%,#ffedd5 100%)">
              <div style="font-size:clamp(2rem,6vw,3rem);font-weight:900;color:var(--primary)">${waiting.length}</div>
              <p style="color:var(--gray-600)">Waiting</p>
            </div>
            <div class="card" style="background:linear-gradient(135deg,#f0fdf4 0%,#dcfce7 100%)">
              <div style="font-size:clamp(2rem,6vw,3rem);font-weight:900;color:var(--success)">${allocated.length}</div>
              <p style="color:var(--gray-600)">Seated</p>
            </div>
          </div>
          
          <div class="card mb">
            <h2 style="margin-bottom:1rem;font-size:clamp(1.25rem,3vw,2rem)">Waiting Queue</h2>
            <div class="space-y">
              ${waiting.length > 0 ? waiting.map(w => `
                <div class="card flex justify-between items-center flex-wrap gap-1" style="background:var(--gray-50)">
                  <div>
                    <div style="font-size:clamp(1.25rem,3vw,1.5rem);font-weight:700">${w.queueNumber}</div>
                    <p style="color:var(--gray-600);font-size:clamp(.75rem,1.5vw,.875rem)">${w.name} • ${w.phone} • ${w.guests} guests</p>
                  </div>
                  <div class="flex gap-1 items-center flex-wrap">
                    <input type="number" id="table-${w.queueNumber}" placeholder="Table #" style="width:100px;margin-bottom:0" min="1">
                    <button onclick="allocateTable('${rid}','${w.queueNumber}')" class="btn btn-success">Seat</button>
                  </div>
                </div>
              `).join('') : '<p class="text-center" style="color:var(--gray-600);padding:2rem">No customers</p>'}
            </div>
          </div>
          
          <div class="flex gap-1 flex-wrap">
            <button onclick="navigate('/r/${rid}/display')" class="btn" style="background:#2563eb;color:white">📺 Display</button>
            <button onclick="navigate('/r/${rid}/join')" class="btn" style="background:#9333ea;color:white">📱 Customer Entry</button>
            ${currentPlan === 'free' || needsCleanup ? `
              <button onclick="showCleanupChoiceModal('${rid}',${queueCount})" class="btn btn-warning">🔄 Reset</button>
            ` : ''}
          </div>
        </div>
      </div>
    `);
    
    setTimeout(() => generateQRCode('daily-qr', rid), 100);
  });
}

// Allocate table to customer
async function allocateTable(rid, queueNumber) {
  const tableNo = document.getElementById(`table-${queueNumber}`).value;
  
  if (!tableNo || tableNo < 1) {
    alert('⚠️ Enter valid table');
    return;
  }
  
  try {
    const result = await FirebaseDB.allocateTable(rid, queueNumber, tableNo);
    if (result.success) {
      DB.allocateTable(rid, queueNumber, tableNo);
      alert(`✅ Table ${tableNo} allocated!`);
    } else {
      throw new Error(result.error);
    }
  } catch (err) {
    alert(`❌ Error: ${err.message}`);
  }
}

// Logout
const logout = (rid) => {
  sessionStorage.removeItem(`loggedIn_${rid}`);
  alert('✅ Logged out');
  navigate('/');
};

// ============================================================================
// PAYMENT FLOWS
// ============================================================================

function showPaymentPage(rid) {
  const restaurant = DB.restaurants[rid];
  if (!restaurant) {
    render(`<div class="container text-center" style="padding-top:4rem"><h1 style="color:var(--danger)">Not found</h1></div>`);
    return;
  }
  
  render(`
    <div style="min-height:100vh;background:linear-gradient(135deg,#faf5ff 0%,#eff6ff 100%);padding:clamp(1rem,3vw,2rem)">
      <div class="card" style="max-width:800px;margin:0 auto">
        <div style="text-align:center;margin-bottom:1rem">
          <div style="display:inline-block;background:linear-gradient(135deg,#dc2626 0%,#ef4444 100%);color:white;padding:.75rem 2rem;border-radius:999px;font-size:clamp(.875rem,2vw,1rem);font-weight:700;animation:pulse 2s infinite;box-shadow:0 4px 12px rgba(220,38,38,.3)">
            🎉 FIRST TIME OFFER - 33% OFF!
          </div>
        </div>
        
        <h2>Upgrade to Premium</h2>
        <p style="color:var(--gray-600)">${restaurant.name}</p>
        
        <div class="card bg-gradient-primary text-center mb">
          <p>Total Amount</p>
          <div style="position:relative;display:inline-block">
            <div style="font-size:clamp(2rem,6vw,3rem);font-weight:900;text-decoration:line-through;opacity:.5">₹2,999</div>
            <div style="font-size:clamp(3rem,12vw,6rem);font-weight:900;color:white;text-shadow:0 4px 12px rgba(0,0,0,.2)">₹1,999</div>
          </div>
          <p style="opacity:.9">per month • 30 days</p>
          <div style="background:rgba(255,255,255,.2);display:inline-block;padding:.5rem 1rem;border-radius:999px;margin-top:.5rem">
            <span style="font-weight:700">💰 Save ₹1,000/month!</span>
          </div>
        </div>
        
        <div class="card text-center" style="background:linear-gradient(135deg,#fff7ed 0%,#ffedd5 100%);border:3px solid var(--primary)">
          <div style="display:inline-block;background:var(--primary);color:white;padding:.5rem 1.5rem;border-radius:999px;font-size:.875rem;font-weight:700;margin-bottom:1rem">
            SECURED PAYMENT
          </div>
          <p style="font-weight:600;font-size:clamp(1rem,3vw,1.25rem);color:var(--gray-700);margin-bottom:.5rem">Pay to</p>
          <p style="font-size:clamp(1.5rem,4vw,2rem);font-weight:900;color:var(--primary);margin-bottom:1rem">QueueApp</p>
          <div style="background:white;display:inline-block;padding:1rem;border-radius:1rem;margin-bottom:.5rem">
            <div style="font-size:clamp(1.25rem,3vw,1.5rem);font-weight:700;color:var(--gray-900)">
              Amount: <span style="color:var(--success)">₹1,999</span>
            </div>
          </div>
        </div>
        
        <div class="card text-center" style="background:var(--gray-50)">
          <p style="font-weight:600;margin-bottom:1rem">Scan QR Code to Pay</p>
          <div id="payment-qr" style="display:inline-block;padding:1rem;background:white;border-radius:1rem;box-shadow:0 4px 12px rgba(0,0,0,.1)"></div>
          <p style="font-size:.875rem;color:var(--gray-600);margin-top:1rem">Or pay directly with your UPI app</p>
          <div style="display:flex;gap:.5rem;justify-content:center;flex-wrap:wrap;margin-top:1rem">
            <a href="upi://pay?pa=sriramvasudev@okhdfcbank&pn=QueueApp&am=1999&cu=INR&tn=QueueApp-Premium-${rid}" class="btn" style="background:#5f259f;color:white;text-decoration:none">
              📱 PhonePe
            </a>
            <a href="tez://upi/pay?pa=sriramvasudev@okhdfcbank&pn=QueueApp&am=1999&cu=INR&tn=QueueApp-Premium-${rid}" class="btn" style="background:#1a73e8;color:white;text-decoration:none">
              💳 GPay
            </a>
            <a href="paytmmp://pay?pa=sriramvasudev@okhdfcbank&pn=QueueApp&am=1999&cu=INR&tn=QueueApp-Premium-${rid}" class="btn" style="background:#00baf2;color:white;text-decoration:none">
              💰 Paytm
            </a>
          </div>
        </div>
        
        <div class="alert alert-success" style="text-align:center">
          <p style="font-weight:700;margin-bottom:.5rem">⏰ Limited Time Offer!</p>
          <p style="font-size:.875rem;margin:0">This special price is available for first-time Premium upgrades only</p>
        </div>
        
        <button onclick="navigate('/payment/${rid}/upload')" class="btn btn-success w-full">
          I've Paid ₹1,999 → Upload Screenshot
        </button>
      </div>
    </div>
  `);
  
  setTimeout(() => {
    const upiString = `upi://pay?pa=sriramvasudev@okhdfcbank&pn=QueueApp&am=1999&cu=INR&tn=QueueApp-Premium-${rid}`;
    new QRCode(document.getElementById('payment-qr'), {
      text: upiString,
      width: 200,
      height: 200
    });
  }, 100);
}

function showUploadScreenshot(rid) {
  render(`
    <div style="min-height:100vh;background:linear-gradient(135deg,#f0fdf4 0%,#dcfce7 100%);padding:clamp(1rem,3vw,2rem)">
      <div class="card" style="max-width:800px;margin:0 auto">
        <h2 class="text-center">Upload Payment Proof</h2>
        <div class="space-y">
          <input type="text" id="transactionId" placeholder="Transaction ID / UTR">
          <div class="card text-center" style="border:2px dashed var(--gray-200);cursor:pointer" onclick="document.getElementById('screenshotFile').click()">
            <input type="file" id="screenshotFile" accept="image/*" onchange="previewScreenshot()" class="hidden">
            <button type="button" class="btn btn-primary" style="pointer-events:none">📷 Choose Screenshot</button>
          </div>
          <div id="screenshotPreview" class="hidden mt">
            <img id="previewImage" class="w-full" style="border:2px solid var(--gray-200);border-radius:1rem"/>
          </div>
          <button onclick="submitPaymentProof('${rid}')" class="btn btn-success w-full">Submit</button>
        </div>
      </div>
    </div>
  `);
}

window.previewScreenshot = () => {
  const file = document.getElementById('screenshotFile').files[0];
  if (file) {
    const reader = new FileReader();
    reader.onload = (e) => {
      document.getElementById('screenshotPreview').classList.remove('hidden');
      document.getElementById('previewImage').src = e.target.result;
    };
    reader.readAsDataURL(file);
  }
};

async function submitPaymentProof(rid) {
  const transactionId = document.getElementById('transactionId').value.trim();
  const fileInput = document.getElementById('screenshotFile');
  
  if (!transactionId || !fileInput.files[0]) {
    alert('⚠️ Fill all fields');
    return;
  }
  
  const reader = new FileReader();
  reader.onload = async (e) => {
    const internalTxnId = 'TXN-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9).toUpperCase();
    const restaurant = DB.restaurants[rid];

    // NEW: Subscription tracking
    const subscriptionId = getSubscriptionId(restaurant, rid);
    const cycleNumber = getNextCycleNumber(restaurant);
    const isRenewal = cycleNumber > 1;
    
    const paymentData = {
      subscriptionId: subscriptionId,           // NEW
      subscriptionCycleNumber: cycleNumber,     // NEW
      isRenewal: isRenewal,                     // NEW
      
      internalTransactionId: internalTxnId,
      utrNumber: transactionId,
      screenshot: e.target.result,
      amount: 1999,
      currency: 'INR',
      paymentMethod: 'UPI',
      customerDetails: {
        restaurantId: rid,
        restaurantName: restaurant?.name || 'N/A',
        ownerName: restaurant?.owner || 'N/A',
        email: restaurant?.email || 'N/A',
        phone: restaurant?.phone || 'N/A',
        city: restaurant?.city || 'N/A'
      },
      uploadedAt: new Date().toISOString(),
      uploadedTimestamp: Date.now(),
      status: 'pending',
      auditTrail: [{
        action: 'payment_proof_uploaded',
        timestamp: new Date().toISOString(),
        by: 'restaurant_owner',
        details: isRenewal 
          ? `Renewal payment submitted (Cycle #${cycleNumber})`
          : 'Payment proof submitted for verification'
      }]
    };
    
    await FirebaseDB.savePaymentProof(rid, paymentData);
    DB.savePaymentProof(rid, paymentData);

    // NEW: Update subscription tracking in Firebase
    try {
      const paymentHistory = restaurant.paymentHistory || [];
      paymentHistory.push({
        cycleNumber: cycleNumber,
        transactionId: internalTxnId,
        utrNumber: transactionId,
        amount: 1999,
        submittedAt: Date.now(),
        status: 'pending'
      });
      
      await db.collection('restaurants').doc(rid).update({
        subscriptionId: subscriptionId,
        subscriptionCycleNumber: cycleNumber,
        paymentHistory: paymentHistory
      });
      
      // Also update localStorage
      DB.restaurants[rid].subscriptionId = subscriptionId;
      DB.restaurants[rid].subscriptionCycleNumber = cycleNumber;
      DB.restaurants[rid].paymentHistory = paymentHistory;
      DB.save();
    } catch (err) {
      console.error('[Subscription Tracking] Error:', err);
      // Don't fail the payment if subscription tracking fails
    }
    
    alert(`✅ ${isRenewal ? 'Renewal' : 'Payment'} submitted!\n\nSubscription: ${subscriptionId}\nCycle: #${cycleNumber}\nTransaction: ${internalTxnId}\n\nVerification takes 2-24 hours.`);
    navigate(`/r/${rid}/admin`);
  };
  
  reader.readAsDataURL(fileInput.files[0]);
}

const handleUpgrade = (rid) => navigate(`/payment/${rid}`);

// ============================================================================
// PLATFORM ADMIN
// ============================================================================

async function showPlatformAdmin() {
  render(`
    <div style="min-height:100vh;background:var(--gray-100);display:flex;align-items:center;justify-content:center">
      <div class="text-center">
        <div style="font-size:clamp(2.5rem,8vw,4rem);margin-bottom:1rem;animation:pulse 2s infinite">📊</div>
        <h2 style="font-size:clamp(1.25rem,4vw,2rem)">Loading Platform Data...</h2>
        <p style="color:var(--gray-600);margin-top:.5rem">Setting up real-time sync...</p>
      </div>
    </div>
  `);
  
  if (window.platformAdminListener) {
    window.platformAdminListener();
    window.platformAdminListener = null;
  }
  
  window.platformAdminListener = db.collection('restaurants').onSnapshot((snapshot) => {
    snapshot.docs.forEach(doc => {
      DB.restaurants[doc.id] = doc.data();
    });
    DB.save();
    renderPlatformAdminDashboard();
  }, (err) => {
    alert('⚠️ Real-time sync error. Please refresh the page.');
  });
}

function renderPlatformAdminDashboard() {
  const restaurants = Object.entries(DB.restaurants);
  const pending = restaurants.filter(([_, r]) => r.planStatus === 'pending');
  const totalCustomers = restaurants.reduce((sum, [_, r]) => sum + (r.queue?.length || 0), 0);
  const totalRevenue = restaurants.filter(([_, r]) => r.plan === 'premium' && r.planStatus === 'active').length * 1999;
  
  render(`
    <div style="min-height:100vh;background:var(--gray-100);padding:clamp(1rem,3vw,2rem)">
      <div class="container">
        <div class="card mb flex justify-between items-center flex-wrap">
          <div>
            <h1>🏢 Platform Admin</h1>
            <p style="color:var(--gray-600)">Manage all restaurants</p>
            <p style="color:#10b981;font-size:.875rem">
              <span style="display:inline-block;width:8px;height:8px;background:#10b981;border-radius:50%;animation:pulse 2s infinite;margin-right:.5rem"></span>
              Live Sync Active
            </p>
          </div>
          <button onclick="adminLogout()" class="btn btn-danger">Logout</button>
        </div>
        
        <div class="grid grid-4 mb">
          <div class="card" style="background:linear-gradient(135deg,#eff6ff 0%,#dbeafe 100%)">
            <div style="font-size:clamp(2rem,6vw,3rem);font-weight:900;color:#2563eb">${restaurants.length}</div>
            <p>Restaurants</p>
          </div>
          <div class="card" style="background:linear-gradient(135deg,#f0fdf4 0%,#dcfce7 100%)">
            <div style="font-size:clamp(2rem,6vw,3rem);font-weight:900;color:var(--success)">${totalCustomers}</div>
            <p>Customers</p>
          </div>
          <div class="card" style="background:linear-gradient(135deg,#faf5ff 0%,#f3e8ff 100%)">
            <div style="font-size:clamp(2rem,6vw,3rem);font-weight:900;color:#9333ea">₹${totalRevenue.toLocaleString()}</div>
            <p>Revenue</p>
          </div>
          <div class="card" style="background:linear-gradient(135deg,#fefce8 0%,#fef9c3 100%)">
            <div style="font-size:clamp(2rem,6vw,3rem);font-weight:900;color:var(--warning)">${pending.length}</div>
            <p>Pending</p>
          </div>
        </div>
        
        <div class="alert alert-info mb" style="text-align:center">
          <p style="font-size:.875rem;margin:0">
            <strong>Last Updated:</strong> ${new Date().toLocaleTimeString()} • Data syncs automatically
          </p>
        </div>
        
        ${pending.length > 0 ? `
          <div class="card mb" style="border:2px solid var(--warning)">
            <h2 style="color:var(--warning);margin-bottom:1rem">⏳ Pending Payments (${pending.length})</h2>
            <div class="space-y">
              ${pending.map(([id, r]) => `
                <div class="card" style="background:#fef9c3">
                  <div class="flex justify-between items-start flex-wrap gap-1">
                    <div style="flex:1">
                      <h3>${r.name}</h3>
                      <p style="font-size:.875rem">ID: ${id} • ${r.owner}</p>
                      ${r.paymentProof?.internalTransactionId ? `
                        <p style="font-size:.875rem;font-weight:600;color:#2563eb">TXN: ${r.paymentProof.internalTransactionId}</p>
                      ` : ''}
                      <p style="font-size:.875rem">
                        UTR: ${r.paymentProof?.utrNumber || r.paymentProof?.transactionId || 'N/A'} • 
                        Amount: ₹${r.paymentProof?.amount || 1999}
                      </p>
                      ${r.paymentProof?.subscriptionId ? `
                        <p style="font-size:.875rem;font-weight:600;color:#16a34a">
                          📋 Subscription: ${r.paymentProof.subscriptionId}
                          ${r.paymentProof.isRenewal ? ` • 🔄 Renewal (Cycle #${r.paymentProof.subscriptionCycleNumber})` : ' • 🆕 New'}
                        </p>
                      ` : ''}
                      <p style="font-size:.75rem;color:var(--gray-600)">
                        Submitted: ${r.paymentProof?.uploadedAt ? new Date(r.paymentProof.uploadedAt).toLocaleString() : 'N/A'}
                      </p>
                    </div>
                    <div class="flex gap-1 flex-wrap">
                      <button onclick="viewScreenshot('${id}')" class="btn" style="background:#2563eb;color:white">View</button>
                      <button onclick="approvePayment('${id}')" class="btn btn-success">✓ Approve</button>
                      <button onclick="rejectPayment('${id}')" class="btn btn-danger">✗ Reject</button>
                    </div>
                  </div>
                </div>
              `).join('')}
            </div>
          </div>
        ` : ''}
        
        <div class="card">
          <h2 style="margin-bottom:1rem">All Restaurants</h2>
          <div class="space-y">
            ${restaurants.length > 0 ? restaurants.map(([id, r]) => `
              <div class="card" style="background:var(--gray-50)">
                <div class="flex justify-between items-center flex-wrap gap-1">
                  <div>
                    <h3>
                      ${r.name} 
                      ${r.plan === 'premium' && r.planStatus === 'active' 
                        ? '<span class="badge badge-primary">PREMIUM</span>' 
                        : r.planStatus === 'pending' 
                        ? '<span class="badge badge-warning">PENDING</span>' 
                        : '<span class="badge badge-secondary">FREE</span>'}
                    </h3>
                    <p style="font-size:.875rem">ID: ${id} • ${r.city} • ${r.queue?.length || 0} customers</p>
                  </div>
                  <div class="flex gap-1 flex-wrap">
                    <button onclick="navigate('/r/${id}/admin')" class="btn btn-secondary">Admin</button>
                    <button onclick="navigate('/r/${id}/display')" class="btn" style="background:#2563eb;color:white">Display</button>
                  </div>
                </div>
              </div>
            `).join('') : `
              <div class="card text-center" style="background:var(--gray-50);padding:4rem">
                <div style="font-size:4rem;margin-bottom:1rem">🏪</div>
                <h3 style="color:var(--gray-600)">No Restaurants Yet</h3>
                <p style="color:var(--gray-500);margin-top:.5rem">Restaurants will appear here once they sign up</p>
              </div>
            `}
          </div>
        </div>
      </div>
    </div>
  `);
}

window.viewScreenshot = (rid) => {
  const restaurant = DB.restaurants[rid];
  if (restaurant?.paymentProof?.screenshot) {
    window.open(restaurant.paymentProof.screenshot, '_blank');
  } else {
    alert('No screenshot');
  }
};

function approvePayment(rid) {
  const restaurant = DB.restaurants[rid];
  const paymentInfo = restaurant?.paymentProof;
  
  const confirmMsg = `✓ Approve Premium for ${restaurant?.name}?\n\nTransaction ID: ${paymentInfo?.internalTransactionId || 'N/A'}\nUTR: ${paymentInfo?.utrNumber || paymentInfo?.transactionId || 'N/A'}\nAmount: ₹${paymentInfo?.amount || 1999}\n\nThis will activate unlimited customers for 30 days.`;
  
  if (confirm(confirmMsg)) {
    const approvalData = {
      approvedAt: new Date().toISOString(),
      approvedTimestamp: Date.now(),
      approvedBy: sessionStorage.getItem('adminEmail') || 'platform_admin',
      approvalReason: 'Payment verified and approved'
    };
    
    if (!restaurant.paymentProof.auditTrail) {
      restaurant.paymentProof.auditTrail = [];
    }
    restaurant.paymentProof.auditTrail.push({
      action: 'payment_approved',
      timestamp: new Date().toISOString(),
      by: approvalData.approvedBy,
      details: 'Premium plan activated for 30 days'
    });
    
    Object.assign(restaurant.paymentProof, approvalData);
    DB.save();
    
    FirebaseDB.approvePremium(rid, approvalData);
    DB.approvePremium(rid);
    
    alert('✅ Premium activated! Restaurant owner can now use unlimited customers.');
    handleRoute();
  }
}

function rejectPayment(rid) {
  const reason = prompt('❌ Rejection Reason:\n\nPlease provide a reason for rejecting this payment (e.g., "Amount mismatch", "Invalid screenshot", "Payment not received")');
  
  if (!reason || reason.trim() === '') {
    alert('⚠️ Rejection reason is required');
    return;
  }
  
  if (confirm(`Reject payment with reason: "${reason}"?`)) {
    const restaurant = DB.restaurants[rid];
    const rejectionData = {
      rejectedAt: new Date().toISOString(),
      rejectedTimestamp: Date.now(),
      rejectedBy: sessionStorage.getItem('adminEmail') || 'platform_admin',
      rejectionReason: reason.trim()
    };
    
    if (restaurant.paymentProof && !restaurant.paymentProof.auditTrail) {
      restaurant.paymentProof.auditTrail = [];
    }
    if (restaurant.paymentProof) {
      restaurant.paymentProof.auditTrail.push({
        action: 'payment_rejected',
        timestamp: new Date().toISOString(),
        by: rejectionData.rejectedBy,
        details: 'Reason: ' + reason.trim()
      });
    }
    
    FirebaseDB.rejectPremium(rid, reason.trim(), rejectionData);
    DB.rejectPremium(rid, reason.trim());
    
    alert('❌ Payment rejected. Restaurant owner will see the reason.');
    handleRoute();
  }
}

async function adminLogout() {
  if (window.platformAdminListener) {
    window.platformAdminListener();
    window.platformAdminListener = null;
  }
  
  await FirebaseAdmin.signOut();
  sessionStorage.removeItem('adminAuth');
  sessionStorage.removeItem('adminEmail');
  
  alert('✅ Logged out');
  navigate('/');
}

// ============================================================================
// QR POSTER MODAL
// ============================================================================

function showQRPosterModal(rid) {
  const restaurant = DB.restaurants[rid];
  if (!restaurant) return;
  
  const modal = document.createElement('div');
  modal.className = 'poster-modal-overlay';
  modal.id = 'posterModal';
  modal.innerHTML = `
    <div class="poster-modal-content">
      <div class="poster-template4" id="posterTemplate">
        <div class="poster-restaurant-name">${restaurant.name}</div>
        <div class="poster-welcome-text">Welcome! 🎉</div>
        
        <div class="poster-main-message">
          <div class="poster-main-text">SKIP THE WAIT<br>JOIN QUEUE NOW</div>
        </div>
        
        <div class="poster-qr-container">
          <div id="poster-qr"></div>
        </div>
        
        <div class="poster-scan-me">👆 SCAN ME 👆</div>
        <div class="poster-powered-by">Powered by <strong>www.queueapp.in</strong></div>
      </div>
      
      <div class="poster-actions">
        <button onclick="downloadQRPoster('${rid}', '${restaurant.name}')" class="btn btn-success">💾 Download PNG</button>
        <button onclick="closePosterModal()" class="btn btn-secondary">✕ Close</button>
      </div>
    </div>
  `;
  
  document.body.appendChild(modal);
  
  setTimeout(() => {
    new QRCode(document.getElementById('poster-qr'), {
      text: getTodayQRCode(rid),
      width: 200,
      height: 200,
      colorDark: "#000000",
      colorLight: "#ffffff",
      correctLevel: QRCode.CorrectLevel.H
    });
  }, 100);
}

function downloadQRPoster(rid, restaurantName) {
  if (typeof html2canvas !== 'undefined') {
    const element = document.getElementById('posterTemplate');
    html2canvas(element, {
      scale: 2,
      backgroundColor: '#ffffff',
      width: element.offsetWidth,
      height: element.offsetHeight
    }).then(canvas => {
      const link = document.createElement('a');
      const filename = `QueueApp-Poster-${restaurantName.replace(/[^a-z0-9]/gi, '-')}.png`;
      link.download = filename;
      link.href = canvas.toDataURL('image/png');
      link.click();
    });
  } else {
    alert('💡 To download as PNG:\n\n1. Use Print button\n2. Select "Save as PDF"\n3. Or right-click the poster and "Save image as..."');
  }
}

function closePosterModal() {
  const modal = document.getElementById('posterModal');
  if (modal) modal.remove();
}

// QR Management Functions
window.copyQRLink = (rid) => {
  const url = getTodayQRCode(rid);
  navigator.clipboard.writeText(url).then(() => {
    alert('✅ Link copied to clipboard!');
  }).catch(() => {
    prompt('Copy this link:', url);
  });
};

window.printQRCode = () => window.print();

window.downloadQRCode = (rid) => {
  const canvas = document.querySelector('#daily-qr canvas');
  if (!canvas) return;
  const link = document.createElement('a');
  link.download = `QueueApp-QR-${new Date().toISOString().slice(0, 10)}.png`;
  link.href = canvas.toDataURL();
  link.click();
};

// ============================================================================
// ANALYTICS UPGRADE MODAL (Premium-only feature)
// ============================================================================

window.showAnalyticsUpgradeModal = function(rid) {
  const restaurant = DB.restaurants[rid];
  if (!restaurant) return;

  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.id = 'analyticsUpgradeModal';
  modal.innerHTML = `
    <div class="modal-content" style="max-width:650px">
      <div style="text-align:center;margin-bottom:2rem">
        <div style="font-size:clamp(3rem,10vw,5rem);margin-bottom:1rem">🔒</div>
        <h2 style="color:var(--warning);margin-bottom:1rem;font-size:clamp(1.5rem,4vw,2rem)">Premium Feature</h2>
        <p style="color:var(--gray-600);font-size:clamp(1rem,2.5vw,1.25rem)">
          Queue Data & Analytics is available for <strong>Premium users only</strong>
        </p>
      </div>

      <div class="card" style="background:linear-gradient(135deg,#eff6ff 0%,#dbeafe 100%);border:3px solid #3b82f6;margin-bottom:1.5rem">
        <h3 style="color:#1e40af;margin-bottom:1rem">📊 What You'll Get with Analytics:</h3>
        <div style="display:grid;gap:.75rem">
          <div style="display:flex;align-items:start;gap:.75rem;padding:.75rem;background:white;border-radius:.5rem">
            <div style="font-size:1.5rem">📈</div>
            <div>
              <p style="font-weight:700;margin-bottom:.25rem">Complete Customer History</p>
              <p style="font-size:.875rem;color:var(--gray-600);margin:0">View all past customers with full details</p>
            </div>
          </div>
          <div style="display:flex;align-items:start;gap:.75rem;padding:.75rem;background:white;border-radius:.5rem">
            <div style="font-size:1.5rem">🔄</div>
            <div>
              <p style="font-weight:700;margin-bottom:.25rem">Repeat Customer Insights</p>
              <p style="font-size:.875rem;color:var(--gray-600);margin:0">Identify loyal customers</p>
            </div>
          </div>
          <div style="display:flex;align-items:start;gap:.75rem;padding:.75rem;background:white;border-radius:.5rem">
            <div style="font-size:1.5rem">⏱️</div>
            <div>
              <p style="font-weight:700;margin-bottom:.25rem">Wait Time Analysis</p>
              <p style="font-size:.875rem;color:var(--gray-600);margin:0">Optimize your service</p>
            </div>
          </div>
          <div style="display:flex;align-items:start;gap:.75rem;padding:.75rem;background:white;border-radius:.5rem">
            <div style="font-size:1.5rem">💾</div>
            <div>
              <p style="font-weight:700;margin-bottom:.25rem">Export to Excel</p>
              <p style="font-size:.875rem;color:var(--gray-600);margin:0">Download complete data as CSV</p>
            </div>
          </div>
        </div>
      </div>

      <div class="card" style="background:linear-gradient(135deg,var(--primary) 0%,var(--secondary) 100%);color:white;text-align:center;margin-bottom:1.5rem;cursor:pointer" onclick="upgradeFromAnalytics('${rid}')">
        <div style="padding:1.5rem">
          <div style="font-size:2rem;margin-bottom:.5rem">⚡</div>
          <h3 style="margin-bottom:.75rem">Upgrade to Premium</h3>
          <div style="font-size:3rem;font-weight:900;margin:.5rem 0">₹1,999<span style="font-size:1.5rem;opacity:.9">/month</span></div>
          <p style="opacity:.9;margin-bottom:1rem">+ Unlimited customers + Auto cleanup</p>
          <button class="btn w-full" style="background:white;color:var(--primary);font-size:1.1rem;padding:1rem;pointer-events:none;font-weight:700">
            ⚡ Unlock Analytics Now
          </button>
        </div>
      </div>

      <button onclick="closeAnalyticsUpgradeModal()" class="btn btn-secondary w-full">Maybe Later</button>
    </div>
  `;
  
  document.body.appendChild(modal);
};

window.closeAnalyticsUpgradeModal = function() {
  const modal = document.getElementById('analyticsUpgradeModal');
  if (modal) modal.remove();
};

window.upgradeFromAnalytics = function(rid) {
  sessionStorage.setItem('upgrade_source', 'analytics_button');
  navigate('/pricing');
};

// ============================================================================
// CLEANUP MODALS (from archival.js integration)
// ============================================================================

window.showCleanupChoiceModal = function(rid, queueCount) {
  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.id = 'cleanupModal';
  modal.innerHTML = `
    <div class="modal-content">
      <h2 style="text-align:center;margin-bottom:1.5rem">Reset Today's Queue?</h2>
      <p style="text-align:center;color:var(--gray-600);margin-bottom:2rem">
        Current queue has <strong>${queueCount} customer${queueCount !== 1 ? 's' : ''}</strong>
      </p>
      
      <div class="grid grid-2" style="gap:1rem">
        <div class="card" style="border:2px solid var(--gray-200);cursor:pointer" onclick="performCleanup('${rid}',${queueCount},closeCleanupModal)">
          <div style="text-align:center;padding:1rem">
            <div style="font-size:2rem;margin-bottom:.5rem">🔄</div>
            <h3 style="font-size:1.1rem;margin-bottom:.5rem">Manual Reset</h3>
            <p style="font-size:.875rem;color:var(--gray-600);margin:0">Free • Reset now</p>
          </div>
        </div>
        
        <div class="card" style="background:linear-gradient(135deg,var(--primary) 0%,var(--secondary) 100%);color:white;cursor:pointer" onclick="upgradeFromCleanup('${rid}')">
          <div style="text-align:center;padding:1rem">
            <div style="font-size:2rem;margin-bottom:.5rem">⚡</div>
            <h3 style="font-size:1.1rem;margin-bottom:.5rem">Automatic Reset</h3>
            <p style="font-size:.875rem;opacity:.9;margin:0">Premium • Midnight auto-reset</p>
          </div>
        </div>
      </div>
      
      <button onclick="closeCleanupModal()" class="btn btn-secondary w-full mt">Cancel</button>
    </div>
  `;
  document.body.appendChild(modal);
};

window.performCleanup = function(rid, queueCount, closeFn) {
  const btn = event.target.closest('.card');
  const originalHTML = btn.innerHTML;
  btn.innerHTML = '<div style="text-align:center;padding:1rem"><div style="font-size:2rem">⏳</div><p>Resetting queue...</p></div>';
  
  window.FirebaseCleanup.dailyCleanup(rid, true).then(result => {
    if (result.success) {
      window.LocalStorageCleanup.dailyCleanup(rid, true);
      
      const cleanupCount = parseInt(localStorage.getItem(`cleanup_count_${rid}`) || '0') + 1;
      localStorage.setItem(`cleanup_count_${rid}`, cleanupCount.toString());
      
      if (closeFn) closeFn();
      showCleanupSuccessModal(rid, queueCount, false, cleanupCount);
    } else {
      alert(result.error === 'Already cleaned today' ? '✅ Queue already reset today!' : '❌ Error: ' + result.error);
      btn.innerHTML = originalHTML;
    }
  }).catch(err => {
    alert('❌ Error: ' + err.message);
    btn.innerHTML = originalHTML;
  });
};

window.showCleanupSuccessModal = function(rid, queueCount, wasClean, cleanupCount) {
  if (cleanupCount >= 3 && cleanupCount % 3 === 0) {
    showProgressiveUpgradeModal(rid, queueCount, cleanupCount);
    return;
  }
  
  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.id = 'successModal';
  modal.innerHTML = `
    <div class="modal-content">
      <div style="text-align:center;margin-bottom:2rem">
        <div style="font-size:5rem;animation:pulse 1.5s infinite">✅</div>
        <h2 style="color:var(--success);margin:1rem 0">Queue Reset Complete!</h2>
        <p style="color:var(--gray-600)">Successfully archived and cleared today's queue</p>
      </div>
      
      <div class="card" style="background:var(--gray-50);margin-bottom:1.5rem">
        <div class="grid grid-2" style="gap:1rem">
          <div style="text-align:center">
            <div style="font-size:2rem;font-weight:900;color:var(--primary)">${queueCount}</div>
            <p style="font-size:.875rem;color:var(--gray-600)">Archived</p>
          </div>
          <div style="text-align:center">
            <div style="font-size:2rem;font-weight:900;color:var(--success)">0</div>
            <p style="font-size:.875rem;color:var(--gray-600)">Current Queue</p>
          </div>
        </div>
      </div>
      
      <button onclick="closeSuccessModal()" class="btn btn-secondary w-full mt">Continue to Dashboard</button>
    </div>
  `;
  document.body.appendChild(modal);
};

window.showProgressiveUpgradeModal = function(rid, queueCount, cleanupCount) {
  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.id = 'successModal';
  modal.innerHTML = `
    <div class="modal-content">
      <div style="text-align:center;margin-bottom:2rem">
        <div style="font-size:5rem;animation:pulse 1.5s infinite">🎯</div>
        <h2 style="color:var(--primary);margin:1rem 0">${cleanupCount} Manual Resets & Counting!</h2>
        <p style="color:var(--gray-600);font-size:1.1rem;font-weight:600">Premium users never click this button</p>
      </div>
      
      <div class="card" style="background:linear-gradient(135deg,var(--primary) 0%,var(--secondary) 100%);color:white;text-align:center">
        <div style="font-size:1.5rem;margin-bottom:1rem">⚡</div>
        <h3 style="margin-bottom:1rem">Stop Clicking. Start Automating.</h3>
        <button onclick="upgradeFromProgressive('${rid}')" class="btn w-full mt" style="background:white;color:var(--primary)">
          ⚡ Upgrade to Premium Now
        </button>
      </div>
      
      <button onclick="closeSuccessModal()" class="btn btn-secondary w-full mt">Maybe Later</button>
    </div>
  `;
  document.body.appendChild(modal);
};

window.closeCleanupModal = function() {
  const modal = document.getElementById('cleanupModal');
  if (modal) modal.remove();
};

window.closeSuccessModal = function() {
  const modal = document.getElementById('successModal');
  if (modal) modal.remove();
  location.reload();
};

window.upgradeFromCleanup = function(rid) {
  sessionStorage.setItem('upgrade_source', 'cleanup_button');
  navigate('/pricing');
};

window.upgradeFromProgressive = function(rid) {
  sessionStorage.setItem('upgrade_source', 'progressive_nudge');
  navigate('/pricing');
};

// ============================================================================
// EXPORT TO WINDOW
// ============================================================================

window.showRestaurantAdmin = showRestaurantAdmin;
window.allocateTable = allocateTable;
window.logout = logout;
window.showPaymentPage = showPaymentPage;
window.showUploadScreenshot = showUploadScreenshot;
window.submitPaymentProof = submitPaymentProof;
window.handleUpgrade = handleUpgrade;
window.showPlatformAdmin = showPlatformAdmin;
window.renderPlatformAdminDashboard = renderPlatformAdminDashboard;
window.approvePayment = approvePayment;
window.rejectPayment = rejectPayment;
window.adminLogout = adminLogout;
window.showQRPosterModal = showQRPosterModal;
window.downloadQRPoster = downloadQRPoster;
window.closePosterModal = closePosterModal;

console.log('✅ QueueApp Admin Module Loaded (Cleaned)');
console.log('📊 Premium Expiry PI Chart: ENABLED');
console.log('🍽️ Menu Management: REMOVED');
