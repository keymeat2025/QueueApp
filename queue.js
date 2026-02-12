// ============================================================================
// QUEUEAPP - QUEUE.JS
// Customer Queue Operations Module
// ============================================================================

// ============================================================================
// JOIN QUEUE FLOW
// ============================================================================

// Show join queue page
async function showJoinQueue(rid) {
  let restaurant = DB.restaurants[rid];
  
  // If not in localStorage, fetch from Firebase
  if (!restaurant) {
    const result = await FirebaseDB.getRestaurant(rid);
    if (result.success) {
      restaurant = result.data;
      DB.restaurants[rid] = restaurant;
      DB.save();
    } else {
      render(`
        <div class="container text-center" style="padding-top:4rem">
          <h1 style="color:var(--danger)">Restaurant Not Found</h1>
          <button onclick="navigate('/')" class="btn btn-primary mt">Go Home</button>
        </div>
      `);
      return;
    }
  }
  
  render(`
    <div style="min-height:100vh;background:linear-gradient(135deg,var(--primary) 0%,var(--secondary) 100%);display:flex;align-items:center;justify-content:center;padding:clamp(1rem,3vw,2rem)">
      <div class="card" style="max-width:500px;width:100%">
        <h2 class="text-center mb">Join Queue</h2>
        <p class="text-center mb" style="color:var(--gray-600)">${restaurant.name}</p>
        <div class="space-y">
          <input type="text" id="customerName" placeholder="Your Name">
          <input type="tel" id="customerPhone" placeholder="Mobile" maxlength="10">
          <div>
            <label style="display:block;font-weight:600;margin-bottom:.75rem;text-align:center">Number of Guests</label>
            
            <!-- Wheel Picker Container -->
            <div class="wheel-picker-container">
              <div class="wheel-picker-overlay"></div>
              <div class="wheel-picker-highlight"></div>
              <div class="wheel-picker" id="guestPicker">
                ${Array.from({length: 30}, (_, i) => i + 1).map(n => `
                  <div class="wheel-item" data-value="${n}">${n}</div>
                `).join('')}
              </div>
              <div class="wheel-selected-value" id="selectedGuestCount">2</div>
            </div>
          </div>
          <button onclick="handleJoinQueue('${rid}')" class="btn btn-primary w-full">Join Queue</button>
        </div>
      </div>
    </div>
    
    <style>
      .wheel-picker-container {
        position: relative;
        height: 200px;
        overflow: hidden;
        background: var(--gray-50);
        border-radius: 1rem;
        margin: 1rem auto;
        max-width: 300px;
      }
      
      .wheel-picker {
        height: 100%;
        overflow-y: scroll;
        scroll-snap-type: y mandatory;
        scrollbar-width: none;
        -ms-overflow-style: none;
        padding: 80px 0;
        cursor: grab;
      }
      
      .wheel-picker::-webkit-scrollbar {
        display: none;
      }
      
      .wheel-picker:active {
        cursor: grabbing;
      }
      
      .wheel-item {
        height: 40px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 1.5rem;
        font-weight: 600;
        scroll-snap-align: center;
        transition: all 0.3s ease;
        color: var(--gray-400);
        user-select: none;
      }
      
      .wheel-item.active {
        color: var(--primary);
        font-size: 2rem;
        font-weight: 900;
        transform: scale(1.2);
      }
      
      .wheel-picker-highlight {
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        width: 90%;
        height: 40px;
        background: linear-gradient(135deg, var(--primary), var(--secondary));
        opacity: 0.15;
        border-radius: 0.5rem;
        pointer-events: none;
        z-index: 1;
      }
      
      .wheel-picker-overlay {
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: linear-gradient(to bottom, 
          var(--gray-50) 0%, 
          transparent 25%, 
          transparent 75%, 
          var(--gray-50) 100%);
        pointer-events: none;
        z-index: 2;
      }
      
      .wheel-selected-value {
        position: absolute;
        bottom: 1rem;
        left: 50%;
        transform: translateX(-50%);
        background: linear-gradient(135deg, var(--primary), var(--secondary));
        color: white;
        padding: 0.5rem 1.5rem;
        border-radius: 999px;
        font-weight: 700;
        font-size: 0.875rem;
        z-index: 3;
        pointer-events: none;
      }
      
      @media (max-width: 767px) {
        .wheel-picker-container {
          height: 180px;
        }
        
        .wheel-item {
          height: 36px;
          font-size: 1.25rem;
        }
        
        .wheel-item.active {
          font-size: 1.75rem;
        }
      }
    </style>
  `);
  
  // Initialize wheel picker
  setTimeout(() => {
    initWheelPicker();
  }, 100);
}

// Initialize wheel picker functionality
function initWheelPicker() {
  const picker = document.getElementById('guestPicker');
  const items = picker.querySelectorAll('.wheel-item');
  const selectedDisplay = document.getElementById('selectedGuestCount');
  
  // Initialize selected guests to 2 (default)
  window.selectedGuests = 2;
  
  // Function to update active item
  function updateActiveItem() {
    const pickerRect = picker.getBoundingClientRect();
    const centerY = pickerRect.top + pickerRect.height / 2;
    
    let closestItem = null;
    let closestDistance = Infinity;
    
    items.forEach(item => {
      const itemRect = item.getBoundingClientRect();
      const itemCenterY = itemRect.top + itemRect.height / 2;
      const distance = Math.abs(centerY - itemCenterY);
      
      if (distance < closestDistance) {
        closestDistance = distance;
        closestItem = item;
      }
      
      // Remove active class from all items
      item.classList.remove('active');
    });
    
    // Add active class to closest item
    if (closestItem) {
      closestItem.classList.add('active');
      const value = parseInt(closestItem.dataset.value);
      window.selectedGuests = value;
      selectedDisplay.textContent = `${value} Guest${value !== 1 ? 's' : ''}`;
    }
  }
  
  // Scroll to default position (2 guests)
  const defaultIndex = 1; // Index for 2 guests (0-indexed)
  picker.scrollTop = defaultIndex * 40; // 40px is the height of each item
  
  // Add scroll event listener
  picker.addEventListener('scroll', updateActiveItem);
  
  // Add touch/mouse support for better feel
  let isScrolling;
  picker.addEventListener('scroll', () => {
    clearTimeout(isScrolling);
    isScrolling = setTimeout(() => {
      // Snap to nearest item after scrolling stops
      updateActiveItem();
    }, 50);
  });
  
  // Initial update
  setTimeout(() => {
    updateActiveItem();
  }, 50);
}

// Remove old selectGuests function (no longer needed with wheel picker)
// window.selectGuests is now handled by the wheel picker

// Handle join queue form submission
async function handleJoinQueue(rid) {
  const name = document.getElementById('customerName').value.trim();
  const phone = document.getElementById('customerPhone').value.trim();
  const guests = window.selectedGuests || 2;
  
  if (!name || !phone) {
    alert('⚠️ Fill all fields');
    return;
  }
  
  const btn = event.target;
  btn.textContent = 'Joining...';
  btn.disabled = true;
  
  try {
    const result = await FirebaseDB.addToQueue(rid, {
      name: name,
      phone: phone,
      guests: guests
    });
    
    if (result.success) {
      // Update localStorage
      const restaurant = DB.restaurants[rid];
      if (restaurant) {
        const today = new Date().toISOString().slice(0, 10);
        const currentMonth = new Date().toISOString().slice(0, 7);
        
        if (!restaurant.analytics) {
          restaurant.analytics = {
            currentMonth: currentMonth,
            customersThisMonth: 0,
            lastResetDate: today,
            dailyStats: {}
          };
        }
        
        restaurant.queue.push({
          name: name,
          phone: phone,
          guests: guests,
          queueNumber: result.queueNumber,
          status: 'waiting',
          joinedAt: new Date().toISOString()
        });
        
        restaurant.analytics.customersThisMonth += 1;
        restaurant.analytics.dailyStats[today] = (restaurant.analytics.dailyStats[today] || 0) + 1;
        DB.save();
      }
      
      showLoadingSuccess(rid, result.queueNumber, result.customersThisMonth, result.limit);
    } else if (result.error === 'LIMIT_REACHED') {
      showUpgradeModal(rid, result);
      btn.textContent = 'Join Queue';
      btn.disabled = false;
    } else {
      throw new Error(result.error);
    }
  } catch (err) {
    alert(`❌ Error: ${err.message}`);
    btn.textContent = 'Join Queue';
    btn.disabled = false;
  }
}

// ============================================================================
// SUCCESS SCREEN
// ============================================================================

// Show loading success screen with countdown
function showLoadingSuccess(rid, queueNumber, customersThisMonth, limit) {
  render(`
    <div style="min-height:100vh;background:linear-gradient(135deg,var(--success) 0%,#059669 100%);display:flex;align-items:center;justify-content:center;color:white;padding:2rem">
      <div class="text-center" style="max-width:600px;margin:0 auto">
        <div style="font-size:clamp(5rem,15vw,8rem);margin-bottom:2rem;animation:pulse 1.5s infinite">✅</div>
        <h1 style="margin-bottom:2rem;font-size:clamp(2rem,6vw,3rem)">You're In!</h1>
        
        <div class="card" style="background:white;color:var(--gray-900);margin-bottom:2rem">
          <div style="font-size:clamp(4rem,12vw,6rem);font-weight:900;color:var(--success);margin-bottom:1rem">${queueNumber}</div>
          <p style="font-size:clamp(1.25rem,3vw,1.5rem);font-weight:600">Your Queue Number</p>
          ${limit !== 'unlimited' ? `
            <p style="font-size:.875rem;color:var(--gray-600);margin-top:1rem">Usage: ${customersThisMonth}/${limit} this month</p>
          ` : ''}
        </div>
        
        <div style="background:rgba(255,255,255,.2);padding:clamp(1rem,3vw,1.5rem);border-radius:1rem">
          <p style="font-size:clamp(1rem,2.5vw,1.25rem);margin-bottom:1rem">📺 Watch the display for your number</p>
          <p style="font-size:clamp(.875rem,2vw,1rem);opacity:.9">Loading your status in <span id="countdown" style="font-weight:900">3</span> seconds...</p>
        </div>
      </div>
    </div>
  `);
  
  let seconds = 3;
  const countdownInterval = setInterval(() => {
    seconds--;
    const countdownEl = document.getElementById('countdown');
    if (countdownEl) {
      countdownEl.textContent = seconds;
    }
    if (seconds <= 0) {
      clearInterval(countdownInterval);
      navigate(`/r/${rid}/status/${queueNumber}`);
    }
  }, 1000);
}

// ============================================================================
// LIMIT REACHED MODAL
// ============================================================================

// Show upgrade modal when limit reached
function showUpgradeModal(rid, result) {
  render(`
    <div style="min-height:100vh;background:rgba(0,0,0,.8);display:flex;align-items:center;justify-content:center;padding:2rem">
      <div class="card" style="max-width:600px;border:3px solid var(--warning)">
        <div class="text-center">
          <div style="font-size:clamp(3rem,10vw,5rem)">🚫</div>
          <h2 style="color:var(--warning);margin:1rem 0;font-size:clamp(1.25rem,4vw,2rem)">Monthly Limit Reached</h2>
          <p style="font-size:clamp(1rem,2.5vw,1.25rem);margin-bottom:1rem">Free plan limit of <strong>500 customers/month</strong> reached.</p>
          
          <div class="card" style="background:#fef9c3;margin:2rem 0">
            <div style="font-size:clamp(2rem,6vw,3rem);font-weight:900;color:var(--warning)">${result.customersUsed} / ${result.limit}</div>
            <p>Customers this month</p>
          </div>
          
          <p style="margin-bottom:2rem;color:var(--gray-600)">Restaurant needs Premium for unlimited customers.</p>
          
          <div class="flex gap-1 flex-wrap justify-center">
            <button onclick="navigate('/r/${rid}/join')" class="btn btn-secondary">← Back</button>
            <button onclick="navigate('/pricing')" class="btn btn-primary">Learn More</button>
          </div>
        </div>
      </div>
    </div>
  `);
}

// ============================================================================
// QUEUE STATUS PAGE
// ============================================================================

// Show queue status for specific customer

async function showQueueStatus(rid, queueNumber) {
  // Show loading
  render(`
    <div style="min-height:100vh;background:var(--primary);display:flex;align-items:center;justify-content:center;color:white;padding:2rem">
      <div class="text-center">
        <div style="font-size:clamp(2.5rem,8vw,4rem);margin-bottom:1rem;animation:pulse 2s infinite">⏳</div>
        <h2 style="font-size:clamp(1.25rem,4vw,2rem)">Loading your queue status...</h2>
      </div>
    </div>
  `);
  
  await new Promise(resolve => setTimeout(resolve, 500));
  
  // Cleanup previous listener
  if (window.statusUnsubscribe) {
    window.statusUnsubscribe();
  }
  
  // Set up real-time Firebase listener
  window.statusUnsubscribe = db.collection('restaurants').doc(rid).onSnapshot(doc => {
    if (!doc.exists) {
      render(`
        <div class="container text-center" style="padding-top:4rem">
          <h1 style="color:var(--danger)">Restaurant Not Found</h1>
          <button onclick="navigate('/')" class="btn btn-primary mt">Go Home</button>
        </div>
      `);
      return;
    }
    
    const restaurant = doc.data();
    DB.restaurants[rid] = restaurant;
    DB.save();
    
    const myQueue = restaurant.queue.find(q => q.queueNumber === queueNumber);
    
    // Queue number not found
    if (!myQueue) {
      render(`
        <div class="container text-center" style="padding-top:4rem">
          <h1>Queue Number Not Found</h1>
          <p style="color:var(--gray-600);margin:2rem 0">Queue #${queueNumber} not found. It may have been served or the queue was reset.</p>
          <button onclick="navigate('/r/${rid}/join')" class="btn btn-primary mt">Join Queue Again</button>
          <button onclick="navigate('/r/${rid}/display')" class="btn btn-secondary mt">View Display</button>
        </div>
      `);
      return;
    }
    
    // Check allocation and trigger notification
    const allocationKey = `allocated_${rid}_${queueNumber}`;
    const wasAllocated = sessionStorage.getItem(allocationKey);
    
    if (myQueue.status === 'allocated' && !wasAllocated) {
      sessionStorage.setItem(allocationKey, 'true');
      
      // Vibrate
      if ('vibrate' in navigator) {
        navigator.vibrate([200, 100, 200, 100, 200, 100, 200]);
      }
      
      // Play sound
      try {
        const audio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBSuBzvLZiTYIF2m98OScTgwOUKfk77RgGwU7k9nyzn0vBSR3yO/ekD8KE1604OyrWBUIRp/h8r9vIwUsgs/y2Ik2CBdpvfDjm0wMDlCn5O+zYBoFPJPZ8dB+MAUkd8jv35FAChNdtODsq1gVCEaf4fK/cCUFLILP8tmJNggXabzw45pMDA5Qp+TvsmAaBTyT2fHRgDEFJHfI79+RQAoTXbTg7KtYFQhGn+Hyv3ElBSyCz/LZiTYIF2m88OOaTAwOUKfk77JgGgU8k9nx0YAxBSR3yO/fkUAKE1204OyrWBUIRp/h8r9xJQUsgs/y2Yk2CBdpvPDjmkwMDlCn5O+yYBoFPJPZ8dGAMQUkd8jv35FAChNdtODsq1gVCEaf4fK/cSUFLILP8tmJNggXabzw45pMDA5Qp+TvsmAaBTyT2fHRgDEFJHfI79+RQAoTXbTg7KtYFQhGn+Hyv3ElBSyCz/LZiTYIF2m88OOaTAwOUKfk77JgGgU8k9nx0YAxBSR3yO/fkUAKE1204OyrWBUIRp/h8r9xJQUsgs/y2Ik2CBdpvPDjmkwMDlCn5O+yYBoFPJPZ8dGAMQUkd8jv35FAChNdtODsq1gVCEaf4fK/cSUFLILP8tmJNggXabzw45pMDA5Qp+TvsmAaBTyT2fHRgDEFJHfI79+RQAoTXbTg7KtYFQhGn+Hyv3ElBSyCz/LZiTYIF2m88OOaTAwOUKfk77JgGgU8k9nx0YAxBSR3yO/fkUAKE1204OyrWBUIRp/h8r9xJQUsgs/y2Ik2CBdpvPDjmkwMDlCn5O+yYBoFPJPZ8dGAMQUkd8jv35FAo=');
        audio.play().catch(() => {});
      } catch (e) {}
    }
    
    const isAllocated = myQueue.status === 'allocated';
    const statusText = isAllocated ? 'Seated' : 'Waiting';
    const statusColor = isAllocated ? 'var(--success)' : 'var(--primary)';
    const bgColor = isAllocated ? 'var(--success)' : 'var(--primary)';
    
    // Customer is allocated a table
    if (isAllocated) {
      render(`
        <div style="min-height:100vh;background:${bgColor};position:relative">
          
          <!-- STICKY HEADER (CUSTOMER VIEW - NO HOME BUTTON) -->
          <div style="position:sticky;top:0;background:rgba(0,0,0,.3);backdrop-filter:blur(10px);padding:1rem;z-index:100;border-bottom:3px solid white">
            <div style="max-width:1200px;margin:0 auto;display:flex;justify-content:space-between;align-items:center;gap:1rem;flex-wrap:wrap">
              <div style="color:white">
                <div style="font-size:clamp(1rem,2.5vw,1.5rem);font-weight:700">
                  Status: ${statusText} | Queue: #${queueNumber}
                </div>
              </div>
              <div style="display:flex;gap:.5rem;flex-wrap:wrap">
                <button onclick="navigate('/r/${rid}/display/${queueNumber}')" class="btn btn-secondary" style="font-size:.875rem;padding:.5rem 1rem;background:white;color:var(--success)">
                  📺 Display
                </button>
              </div>
            </div>
          </div>
          
          <!-- MAIN CONTENT -->
          <div style="display:flex;align-items:center;justify-content:center;color:white;padding:2rem;min-height:calc(100vh - 100px)">
            <div class="text-center" style="max-width:600px;margin:0 auto">
              <div style="font-size:clamp(5rem,15vw,8rem);margin-bottom:2rem;animation:pulse 1.5s infinite">✅</div>
              <h1 style="margin-bottom:2rem;font-size:clamp(2rem,6vw,3rem)">🎉 Table Ready!</h1>
              
              <div class="card" style="background:white;color:var(--gray-900)">
                <div style="font-size:clamp(6rem,20vw,12rem);font-weight:900;color:var(--success);margin-bottom:1rem">${myQueue.tableNo}</div>
                <p style="font-size:clamp(1.25rem,4vw,2rem);margin-bottom:1rem">Queue: ${queueNumber}</p>
                
                <div style="padding:1rem;background:var(--gray-50);border-radius:1rem;margin-top:1rem">
                  <p style="font-size:clamp(1.25rem,3vw,1.5rem);font-weight:600;color:var(--gray-700)">${myQueue.name}</p>
                  <p style="font-size:clamp(.875rem,2vw,1rem);color:var(--gray-600)">${myQueue.guests} guest${myQueue.guests !== 1 ? 's' : ''}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      `);
    } else {
      // Customer still waiting
      render(`
        <div style="min-height:100vh;background:${bgColor};position:relative">
          
          <!-- STICKY HEADER (CUSTOMER VIEW - NO HOME BUTTON) -->
          <div style="position:sticky;top:0;background:rgba(0,0,0,.3);backdrop-filter:blur(10px);padding:1rem;z-index:100;border-bottom:3px solid white">
            <div style="max-width:1200px;margin:0 auto;display:flex;justify-content:space-between;align-items:center;gap:1rem;flex-wrap:wrap">
              <div style="color:white">
                <div style="font-size:clamp(1rem,2.5vw,1.5rem);font-weight:700">
                  Status: ${statusText} | Queue: #${queueNumber}
                </div>
              </div>
              <div style="display:flex;gap:.5rem;flex-wrap:wrap">
                <button onclick="navigate('/r/${rid}/display/${queueNumber}')" class="btn btn-secondary" style="font-size:.875rem;padding:.5rem 1rem;background:white;color:var(--primary)">
                  📺 Display
                </button>
              </div>
            </div>
          </div>
          
          <!-- MAIN CONTENT -->
          <div style="display:flex;align-items:center;justify-content:center;color:white;padding:2rem;min-height:calc(100vh - 100px)">
            <div class="text-center" style="max-width:600px;margin:0 auto">
              <h1 style="margin-bottom:2rem;font-size:clamp(1.5rem,5vw,2.5rem)">Still in Queue</h1>
              
              <div class="card" style="background:white;color:var(--gray-900)">
                <div style="font-size:clamp(6rem,20vw,12rem);font-weight:900;color:var(--primary);margin-bottom:1rem">${queueNumber}</div>
                <p style="font-size:clamp(1.25rem,4vw,2rem);margin-bottom:1rem">Your Queue Number</p>
                
                <div style="padding:1rem;background:var(--gray-50);border-radius:1rem;margin-top:1rem">
                  <p style="font-size:clamp(1.25rem,3vw,1.5rem);font-weight:600;color:var(--gray-700)">${myQueue.name}</p>
                  <p style="font-size:clamp(.875rem,2vw,1rem);color:var(--gray-600)">${myQueue.guests} guest${myQueue.guests !== 1 ? 's' : ''}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      `);
    }
  });
}

// ============================================================================
// EXPORT TO WINDOW
// ============================================================================

window.showJoinQueue = showJoinQueue;
window.handleJoinQueue = handleJoinQueue;
window.showLoadingSuccess = showLoadingSuccess;
window.showUpgradeModal = showUpgradeModal;
window.showQueueStatus = showQueueStatus;
window.initWheelPicker = initWheelPicker;

console.log('✅ QueueApp Queue Module Loaded');
