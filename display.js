// ============================================================================
// QUEUEAPP - DISPLAY.JS (ENHANCED WITH UI TOGGLES)
// Live Display Screen & QR Controls Module with Customizable UI Options
// ============================================================================

// ============================================================================
// DISPLAY SETTINGS MANAGEMENT
// ============================================================================

const DEFAULT_DISPLAY_SETTINGS = {
  // QR Settings
  qr: {
    position: { top: '', bottom: '1rem', left: '', right: '1rem' },
    scale: 1,
    hidden: false
  },
  // UI Display Options
  ui: {
    showStats: true,           // Show stats section (Waiting/Seated counts)
    showPhoneNumbers: true,     // Show phone numbers in waiting queue
    highlightTop3: true,        // Highlight first 3 waiting customers
    cardStyle: 'enhanced',      // 'simple' or 'enhanced' (nested boxes)
    tableStyle: 'gradient',     // 'simple' or 'gradient' (separate box)
    waitingLayout: 'list',      // 'list' or 'grid'
    servingDisplayCount: 10     // Number of "NOW SERVING" cards to display (1-20)
  }
};

// Get display settings for a restaurant
const getDisplaySettings = (rid) => {
  const saved = localStorage.getItem(`display_settings_${rid}`);
  if (!saved) return JSON.parse(JSON.stringify(DEFAULT_DISPLAY_SETTINGS));
  
  try {
    const settings = JSON.parse(saved);
    // Merge with defaults to ensure all properties exist
    return {
      qr: { ...DEFAULT_DISPLAY_SETTINGS.qr, ...(settings.qr || {}) },
      ui: { ...DEFAULT_DISPLAY_SETTINGS.ui, ...(settings.ui || {}) }
    };
  } catch (e) {
    console.error('Failed to parse display settings:', e);
    return JSON.parse(JSON.stringify(DEFAULT_DISPLAY_SETTINGS));
  }
};

// Save display settings
const saveDisplaySettings = (rid, settings) => {
  try {
    localStorage.setItem(`display_settings_${rid}`, JSON.stringify(settings));
    console.log('✅ Display settings saved:', settings);
  } catch (e) {
    console.error('Failed to save display settings:', e);
  }
};

// ============================================================================
// LIVE DISPLAY SCREEN WITH CUSTOMIZABLE UI
// ============================================================================

async function showDisplay(rid, customerQueueNumber) {
  // Cleanup previous listener
  if (window.displayUnsubscribe) {
    window.displayUnsubscribe();
  }
  
  // Get current display settings
  const settings = getDisplaySettings(rid);
  
  // Set up real-time listener
  window.displayUnsubscribe = db.collection('restaurants').doc(rid).onSnapshot(doc => {
    if (!doc.exists) {
      render(`<div class="container text-center" style="padding-top:4rem"><h1 style="color:var(--danger)">Not found</h1></div>`);
      return;
    }
    
    const restaurant = doc.data();
    DB.restaurants[rid] = restaurant;
    DB.save();
    
    const waitingQueue = restaurant.queue.filter(q => q.status === 'waiting');
    const allocatedQueue = restaurant.queue.filter(q => q.status === 'allocated');
    
    // Get current display settings
    const currentSettings = getDisplaySettings(rid);
    
    // Use restaurant owner's custom serving display count (default: 10)
    const maxCards = currentSettings.ui.servingDisplayCount || 10;
    const justCalled = allocatedQueue.slice(-maxCards);
    
    // Filter waiting queue if customer-specific view
    const displayWaitingQueue = customerQueueNumber 
      ? waitingQueue.filter(q => q.queueNumber === customerQueueNumber)
      : waitingQueue;
    
    // Responsive card sizing
    const cardSize = justCalled.length <= 3 ? 'min(400px,100%)' : justCalled.length <= 6 ? 'min(320px,100%)' : 'min(250px,100%)';
    const cardPadding = justCalled.length <= 3 ? 'clamp(2rem,4vw,4rem)' : justCalled.length <= 6 ? 'clamp(1.5rem,3vw,3rem)' : 'clamp(1rem,2vw,2rem)';
    const queueFontSize = justCalled.length <= 3 ? 'clamp(6rem,15vw,12rem)' : justCalled.length <= 6 ? 'clamp(5rem,12vw,10rem)' : 'clamp(4rem,10vw,8rem)';
    const nameFontSize = justCalled.length <= 3 ? 'clamp(2rem,6vw,4rem)' : justCalled.length <= 6 ? 'clamp(1.75rem,5vw,3.5rem)' : 'clamp(1.5rem,4vw,3rem)';
    const tableFontSize = justCalled.length <= 3 ? 'clamp(3rem,8vw,6rem)' : justCalled.length <= 6 ? 'clamp(2.5rem,7vw,5rem)' : 'clamp(2rem,6vw,4rem)';
    const guestFontSize = justCalled.length <= 3 ? 'clamp(1.5rem,4vw,3rem)' : justCalled.length <= 6 ? 'clamp(1.25rem,3.5vw,2.5rem)' : 'clamp(1rem,3vw,2rem)';
    
    // Generate NOW SERVING cards based on card style setting
    const generateNowServingCard = (allocated, isMyTurn) => {
      if (currentSettings.ui.cardStyle === 'simple') {
        // ORIGINAL SIMPLE STYLE
        return `
          <div class="card text-center" style="background:${isMyTurn ? 'linear-gradient(135deg,#fbbf24 0%,#f59e0b 100%)' : 'white'};padding:${cardPadding};border:4px solid ${isMyTurn ? '#f59e0b' : 'white'};${isMyTurn ? 'animation:pulse-badge 1s infinite;box-shadow:0 0 30px rgba(251,191,36,0.8)' : ''};min-height:280px;display:flex;flex-direction:column;justify-content:center">
            <div style="font-size:${queueFontSize};font-weight:900;color:${isMyTurn ? 'white' : 'var(--success)'};line-height:1">${allocated.queueNumber}</div>
            <div style="font-size:${nameFontSize};font-weight:700;color:${isMyTurn ? 'white' : 'var(--gray-900)'};margin:clamp(0.5rem,1vw,1rem) 0">${allocated.name}</div>
            ${currentSettings.ui.tableStyle === 'simple' 
              ? `<div style="font-size:${tableFontSize};font-weight:800;color:${isMyTurn ? 'rgba(255,255,255,0.9)' : 'var(--gray-900)'}">${isMyTurn ? '🎉 YOUR TURN! 🎉' : ''}Table ${allocated.tableNo}</div>`
              : `<div style="background:${isMyTurn ? 'white' : 'linear-gradient(135deg,var(--success) 0%,#059669 100%)'};color:${isMyTurn ? 'var(--primary)' : 'white'};padding:clamp(1rem,2vw,1.5rem);border-radius:clamp(.75rem,1.5vw,1rem);box-shadow:0 4px 12px rgba(0,0,0,.2);margin-top:clamp(0.5rem,1vw,1rem)">
                  <div style="font-size:clamp(.875rem,2vw,1.25rem);font-weight:700;margin-bottom:.25rem">TABLE</div>
                  <div style="font-size:${tableFontSize};font-weight:900">${allocated.tableNo}</div>
                </div>`
            }
            <div style="font-size:${guestFontSize};color:${isMyTurn ? 'rgba(255,255,255,0.8)' : 'var(--gray-600)'};margin-top:clamp(0.5rem,1vw,1rem)">${allocated.guests} ${allocated.guests === 1 ? 'guest' : 'guests'}</div>
            ${isMyTurn && currentSettings.ui.tableStyle === 'simple' ? '' : isMyTurn ? `<div style="margin-top:clamp(1rem,2vw,1.5rem);background:white;color:var(--primary);padding:clamp(.75rem,1.5vw,1rem);border-radius:clamp(.5rem,1vw,.75rem);font-weight:900;font-size:clamp(1.25rem,3vw,2rem);animation:pulse 2s infinite">🎉 YOUR TURN! 🎉</div>` : ''}
          </div>
        `;
      } else {
        // ENHANCED STYLE WITH NESTED BOXES
        return `
          <div class="card text-center" style="background:${isMyTurn ? 'linear-gradient(135deg,#fbbf24 0%,#f59e0b 100%)' : 'white'};padding:${cardPadding};border:4px solid ${isMyTurn ? '#f59e0b' : 'var(--success)'}${isMyTurn ? ';animation:pulse 2s infinite;box-shadow:0 0 40px rgba(251,191,36,.8)' : ''}">
            <div style="font-size:${queueFontSize};font-weight:900;color:${isMyTurn ? 'white' : 'var(--success)'};margin-bottom:clamp(.5rem,1vw,1rem);text-shadow:${isMyTurn ? '0 4px 8px rgba(0,0,0,.3)' : 'none'}">
              ${allocated.queueNumber}
            </div>
            <div style="background:${isMyTurn ? 'rgba(255,255,255,.3)' : 'var(--gray-50)'};padding:clamp(1rem,2vw,1.5rem);border-radius:clamp(.75rem,1.5vw,1rem);margin-bottom:clamp(.75rem,1.5vw,1rem)">
              <div style="font-size:${nameFontSize};font-weight:700;color:${isMyTurn ? 'white' : 'var(--gray-900)'};margin-bottom:clamp(.5rem,1vw,1rem);text-shadow:${isMyTurn ? '0 2px 4px rgba(0,0,0,.2)' : 'none'}">
                ${allocated.name}
              </div>
              <div style="font-size:${guestFontSize};color:${isMyTurn ? 'rgba(255,255,255,.9)' : 'var(--gray-600)'};font-weight:600">
                👥 ${allocated.guests} Guest${allocated.guests !== 1 ? 's' : ''}
              </div>
            </div>
            ${currentSettings.ui.tableStyle === 'gradient' 
              ? `<div style="background:${isMyTurn ? 'white' : 'linear-gradient(135deg,var(--success) 0%,#059669 100%)'};color:${isMyTurn ? 'var(--primary)' : 'white'};padding:clamp(1rem,2vw,1.5rem);border-radius:clamp(.75rem,1.5vw,1rem);box-shadow:0 4px 12px rgba(0,0,0,.2)">
                  <div style="font-size:clamp(.875rem,2vw,1.25rem);font-weight:700;margin-bottom:.25rem">TABLE</div>
                  <div style="font-size:${tableFontSize};font-weight:900">${allocated.tableNo}</div>
                </div>`
              : `<div style="font-size:${tableFontSize};font-weight:800;color:${isMyTurn ? 'white' : 'var(--gray-900)'}">Table ${allocated.tableNo}</div>`
            }
            ${isMyTurn ? `
              <div style="margin-top:clamp(1rem,2vw,1.5rem);background:white;color:var(--primary);padding:clamp(.75rem,1.5vw,1rem);border-radius:clamp(.5rem,1vw,.75rem);font-weight:900;font-size:clamp(1.25rem,3vw,2rem);animation:pulse 2s infinite">
                🎉 YOUR TURN! 🎉
              </div>
            ` : ''}
          </div>
        `;
      }
    };
    
    // Generate WAITING QUEUE based on layout setting
    const generateWaitingQueue = () => {
      if (currentSettings.ui.waitingLayout === 'grid') {
        // GRID LAYOUT (NEW STYLE)
        return `
          <div class="card" style="background:linear-gradient(135deg,rgba(249,115,22,.9),rgba(234,88,12,.9));border:4px solid var(--primary);padding:clamp(2rem,4vw,4rem)">
            <h2 class="text-center" style="font-size:clamp(2rem,5vw,4rem);margin-bottom:clamp(1rem,2vw,2rem)">
              ⏳ WAITING QUEUE
            </h2>
            <div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(${cardSize},1fr));gap:clamp(1rem,2vw,2rem)">
              ${displayWaitingQueue.map(w => `
                <div class="card text-center" style="background:white;padding:${cardPadding}">
                  <div style="font-size:${queueFontSize};font-weight:900;color:var(--primary);margin-bottom:clamp(.5rem,1vw,1rem)">
                    ${w.queueNumber}
                  </div>
                  <div style="background:var(--gray-50);padding:clamp(1rem,2vw,1.5rem);border-radius:clamp(.75rem,1.5vw,1rem)">
                    <div style="font-size:${nameFontSize};font-weight:700;color:var(--gray-900);margin-bottom:clamp(.5rem,1vw,1rem)">
                      ${w.name}
                    </div>
                    ${currentSettings.ui.showPhoneNumbers ? `
                      <div style="font-size:clamp(1rem,2vw,1.3rem);color:var(--gray-600);font-family:monospace;margin-bottom:clamp(.3rem,.5vw,.5rem)">
                        ${w.phone}
                      </div>
                    ` : ''}
                    <div style="font-size:${guestFontSize};color:var(--gray-600);font-weight:600">
                      👥 ${w.guests} Guest${w.guests !== 1 ? 's' : ''}
                    </div>
                  </div>
                </div>
              `).join('')}
            </div>
          </div>
        `;
      } else {
        // LIST LAYOUT (ORIGINAL STYLE)
        return `
          <div class="card" style="background:rgba(249,115,22,.2);border:3px solid var(--primary);padding:clamp(1.5rem,3vw,3rem)">
            <h2 class="text-center" style="color:var(--primary);margin-bottom:clamp(1rem,2vw,2rem);font-size:clamp(2rem,5vw,4rem)">⏳ Waiting (${waitingQueue.length})</h2>
            <div style="max-height:60vh;overflow-y:auto">
              <div class="space-y">
                ${displayWaitingQueue.length > 0 ? displayWaitingQueue.slice(0, 15).map((w, i) => {
                  const isTop3 = currentSettings.ui.highlightTop3 && i < 3;
                  return `
                    <div class="card" style="background:${isTop3 ? 'rgba(249,115,22,.9)' : 'rgba(55,65,81,.8)'};padding:clamp(1rem,2vw,2rem);border:${isTop3 ? '3px solid var(--primary)' : '2px solid rgba(156,163,175,.3)'}">
                      <div style="display:flex;justify-content:space-between;align-items:center;gap:clamp(.75rem,1.5vw,1rem);flex-wrap:wrap">
                        <div style="flex:1">
                          <div style="font-size:clamp(3rem,8vw,6rem);font-weight:900;color:${isTop3 ? '#fff' : 'var(--primary)'}">${w.queueNumber}</div>
                          <div style="font-size:clamp(1.25rem,2.5vw,1.8rem);font-weight:600;color:${isTop3 ? '#fff' : 'rgba(255,255,255,.9)'};margin-top:.5rem">${w.name}</div>
                          ${currentSettings.ui.showPhoneNumbers ? `
                            <div style="font-size:clamp(1rem,2vw,1.3rem);color:${isTop3 ? 'rgba(255,255,255,.8)' : 'rgba(255,255,255,.6)'};font-family:monospace">${w.phone}</div>
                          ` : ''}
                          <div style="font-size:clamp(1.1rem,2.2vw,1.5rem);color:${isTop3 ? 'rgba(255,255,255,.9)' : 'rgba(255,255,255,.7)'};margin-top:.3rem">${w.guests} guest${w.guests !== 1 ? 's' : ''}</div>
                        </div>
                      </div>
                    </div>
                  `;
                }).join('') : (customerQueueNumber 
                  ? '<p class="text-center" style="color:rgba(255,255,255,.6);font-size:clamp(1.25rem,3vw,2rem);padding:2rem">Your queue details will appear here</p>'
                  : '<p class="text-center" style="color:rgba(255,255,255,.6);font-size:clamp(1.25rem,3vw,2rem);padding:2rem">No customers</p>'
                )}
              </div>
            </div>
          </div>
        `;
      }
    };
    
    render(`
      <div class="display-screen" style="position:relative">
        ${customerQueueNumber ? '' : `
          <div class="qr-controls" id="qrControls">
            <button class="qr-toggle-btn" onclick="toggleQRControls()" style="position:absolute;top:.5rem;right:.5rem">⚙️</button>
            <div class="qr-controls-content">
              <h3>🎛️ Display Settings</h3>
              
              <!-- QR Position Controls -->
              <div class="control-group">
                <label style="font-size:.875rem;display:block;margin-bottom:.5rem">QR Position:</label>
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:.5rem">
                  <button class="qr-control-btn small" onclick="setQRPosition('${rid}', 'top-left')">↖ Top Left</button>
                  <button class="qr-control-btn small" onclick="setQRPosition('${rid}', 'top-right')">↗ Top Right</button>
                  <button class="qr-control-btn small" onclick="setQRPosition('${rid}', 'bottom-left')">↙ Bottom Left</button>
                  <button class="qr-control-btn small" onclick="setQRPosition('${rid}', 'bottom-right')">↘ Bottom Right</button>
                </div>
              </div>
              
              <!-- QR Size Control -->
              <div class="control-group qr-size-control">
                <label>QR Size: <span id="qrSizeLabel">${Math.round(currentSettings.qr.scale * 250)}</span>px</label>
                <input type="range" class="qr-size-slider" id="qrSizeSlider" min="150" max="450" value="${Math.round(currentSettings.qr.scale * 250)}" step="10" oninput="updateQRSize('${rid}', this.value)">
              </div>
              
              <!-- QR Visibility -->
              <div class="control-group">
                <button class="qr-control-btn" onclick="toggleQRVisibility('${rid}')" id="qrVisibilityBtn">
                  ${currentSettings.qr.hidden ? '👁️ Show QR' : '👁️ Hide QR'}
                </button>
              </div>
              
              <hr style="border:none;border-top:1px solid rgba(255,255,255,.2);margin:1rem 0">
              
              <!-- SERVING DISPLAY COUNT -->
              <div class="control-group qr-size-control">
                <label>Serving Display: <span id="servingCountLabel">${currentSettings.ui.servingDisplayCount || 10}</span> cards</label>
                <input type="range" class="qr-size-slider" id="servingCountSlider" min="1" max="20" value="${currentSettings.ui.servingDisplayCount || 10}" step="1" oninput="updateServingCount('${rid}', this.value)">
                <div style="font-size:.75rem;color:rgba(255,255,255,.7);margin-top:.5rem">
                  Show last <strong>${currentSettings.ui.servingDisplayCount || 10}</strong> served customers
                </div>
              </div>
              
              <hr style="border:none;border-top:1px solid rgba(255,255,255,.2);margin:1rem 0">
              
              <!-- UI CUSTOMIZATION OPTIONS -->
              <div class="control-group">
                <label style="font-size:.875rem;display:block;margin-bottom:.75rem;color:#fbbf24;font-weight:700">📊 UI Options:</label>
                
                <!-- Show Stats Toggle -->
                <label style="display:flex;align-items:center;gap:.5rem;margin-bottom:.5rem;cursor:pointer;font-size:.875rem">
                  <input type="checkbox" id="showStats" ${currentSettings.ui.showStats ? 'checked' : ''} onchange="toggleUISetting('${rid}', 'showStats', this.checked)">
                  <span>Show Stats Section</span>
                </label>
                
                <!-- Show Phone Numbers Toggle -->
                <label style="display:flex;align-items:center;gap:.5rem;margin-bottom:.5rem;cursor:pointer;font-size:.875rem">
                  <input type="checkbox" id="showPhoneNumbers" ${currentSettings.ui.showPhoneNumbers ? 'checked' : ''} onchange="toggleUISetting('${rid}', 'showPhoneNumbers', this.checked)">
                  <span>Show Phone Numbers</span>
                </label>
                
                <!-- Highlight Top 3 Toggle -->
                <label style="display:flex;align-items:center;gap:.5rem;margin-bottom:.5rem;cursor:pointer;font-size:.875rem">
                  <input type="checkbox" id="highlightTop3" ${currentSettings.ui.highlightTop3 ? 'checked' : ''} onchange="toggleUISetting('${rid}', 'highlightTop3', this.checked)">
                  <span>Highlight Top 3 Waiting</span>
                </label>
              </div>
              
              <div class="control-group">
                <label style="font-size:.875rem;display:block;margin-bottom:.5rem">Card Style:</label>
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:.5rem">
                  <button class="qr-control-btn small ${currentSettings.ui.cardStyle === 'simple' ? 'active' : ''}" onclick="setUIOption('${rid}', 'cardStyle', 'simple')">Simple</button>
                  <button class="qr-control-btn small ${currentSettings.ui.cardStyle === 'enhanced' ? 'active' : ''}" onclick="setUIOption('${rid}', 'cardStyle', 'enhanced')">Enhanced</button>
                </div>
              </div>
              
              <div class="control-group">
                <label style="font-size:.875rem;display:block;margin-bottom:.5rem">Table Style:</label>
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:.5rem">
                  <button class="qr-control-btn small ${currentSettings.ui.tableStyle === 'simple' ? 'active' : ''}" onclick="setUIOption('${rid}', 'tableStyle', 'simple')">Simple</button>
                  <button class="qr-control-btn small ${currentSettings.ui.tableStyle === 'gradient' ? 'active' : ''}" onclick="setUIOption('${rid}', 'tableStyle', 'gradient')">Gradient</button>
                </div>
              </div>
              
              <div class="control-group">
                <label style="font-size:.875rem;display:block;margin-bottom:.5rem">Waiting Layout:</label>
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:.5rem">
                  <button class="qr-control-btn small ${currentSettings.ui.waitingLayout === 'list' ? 'active' : ''}" onclick="setUIOption('${rid}', 'waitingLayout', 'list')">List</button>
                  <button class="qr-control-btn small ${currentSettings.ui.waitingLayout === 'grid' ? 'active' : ''}" onclick="setUIOption('${rid}', 'waitingLayout', 'grid')">Grid</button>
                </div>
              </div>
              
              <hr style="border:none;border-top:1px solid rgba(255,255,255,.2);margin:1rem 0">
              
              <!-- Reset Button -->
              <div class="control-group">
                <button class="qr-control-btn" onclick="resetDisplaySettings('${rid}')" style="width:100%">🔄 Reset All Settings</button>
              </div>
              
              <div style="margin-top:.75rem;padding-top:.75rem;border-top:1px solid rgba(255,255,255,.2);font-size:.75rem;color:rgba(255,255,255,.7);text-align:center">
                💡 Drag QR to move freely<br>Changes save automatically
              </div>
            </div>
          </div>
        `}
        
        ${customerQueueNumber ? '' : `
          <div class="display-qr-fixed ${currentSettings.qr.hidden ? 'hidden' : ''}" id="displayQR" onmousedown="startDragQR(event)" ontouchstart="startDragQR(event)" style="${currentSettings.qr.position.top ? `top:${currentSettings.qr.position.top}` : ''}${currentSettings.qr.position.bottom ? `bottom:${currentSettings.qr.position.bottom}` : ''}${currentSettings.qr.position.left ? `left:${currentSettings.qr.position.left}` : ''}${currentSettings.qr.position.right ? `right:${currentSettings.qr.position.right}` : ''}">
            <div class="qr-card" style="background:linear-gradient(135deg,#fff7ed 0%,#ffedd5 100%);padding:clamp(1rem,3vw,2rem);border-radius:clamp(1rem,2vw,2rem);box-shadow:0 8px 32px rgba(0,0,0,.3);border:5px solid var(--primary);transform:scale(${currentSettings.qr.scale})">
              <div style="text-align:center;margin-bottom:1rem">
                <div class="qr-text" style="font-size:clamp(1.25rem,2.5vw,2.5rem);font-weight:900;color:var(--primary);margin-bottom:.5rem;animation:pulse-badge 1.5s infinite">
                  👉 SCAN HERE 👈
                </div>
                <div class="qr-text" style="font-size:clamp(.875rem,1.5vw,1.5rem);font-weight:700;color:var(--gray-900);margin-bottom:.5rem">
                  Welcome! 🎉
                </div>
                <div class="qr-text" style="font-size:clamp(.75rem,1.1vw,1.1rem);color:var(--gray-700);line-height:1.4">
                  Join our queue instantly with your phone
                </div>
              </div>
              <div style="background:white;padding:clamp(1rem,2vw,1.5rem);border-radius:clamp(1rem,1.5vw,1.5rem);box-shadow:0 4px 12px rgba(0,0,0,.1);position:relative;display:flex;justify-content:center">
                <div id="display-qr" style="background:white;display:inline-block"></div>
              </div>
              <div style="text-align:center;margin-top:1rem">
                <div class="qr-text" style="font-size:clamp(.875rem,1.3vw,1.3rem);color:var(--primary);font-weight:700">
                  📱 Open Camera & Scan
                </div>
                <div class="qr-text" style="font-size:clamp(.65rem,1vw,1rem);color:var(--gray-600);margin-top:.3rem">
                  No app needed!
                </div>
              </div>
            </div>
          </div>
        `}
        
        <div class="container">
          <!-- HEADER WITH HOME BUTTON -->
          <div class="text-center mb" style="padding-bottom:clamp(1rem,2vw,2rem);border-bottom:4px solid var(--primary);position:relative">
            ${customerQueueNumber ? '' : `
              <div style="position:absolute;top:0;left:0;right:0;display:flex;justify-content:flex-end;padding:.5rem">
                <button onclick="navigate('/r/${rid}/admin')" class="btn btn-primary" style="font-size:clamp(.75rem,2vw,1rem);padding:clamp(.5rem,1.5vw,1rem) clamp(1rem,2.5vw,1.5rem);display:flex;align-items:center;gap:.5rem;background:var(--primary);color:white;font-weight:700;box-shadow:0 4px 12px rgba(249,115,22,.4)">
                  <span style="font-size:clamp(1.1rem,2.5vw,1.5rem)">🏠</span>
                  <span>Home</span>
                </button>
              </div>
            `}
            <h1 style="color:var(--primary);margin-top:${customerQueueNumber ? '0' : 'clamp(2.5rem,5vw,4rem)'}">${restaurant.name}</h1>
            <p style="font-size:clamp(1.25rem,3vw,2rem);color:rgba(255,255,255,.7)">Queue Management</p>
            <div style="font-size:clamp(2rem,5vw,3rem);color:var(--primary);font-weight:700;margin-top:.5rem">
              ${new Date().toLocaleTimeString('en-US', {hour: '2-digit', minute: '2-digit'})}
            </div>
            <div style="font-size:clamp(1rem,2vw,1.25rem);color:#10b981;margin-top:.5rem">🔥 Live</div>
          </div>
          
          ${currentSettings.ui.showStats ? `
            <div class="card mb" style="background:rgba(168,85,247,.2);border:3px solid #9333ea;padding:clamp(1.5rem,3vw,3rem)">
              <h2 class="text-center" style="color:#c084fc;margin-bottom:clamp(1rem,2vw,2rem);font-size:clamp(1.75rem,4vw,3rem)">📊 Stats</h2>
              <div class="grid grid-2" style="gap:clamp(1rem,2vw,2rem)">
                <div class="card text-center" style="background:rgba(255,255,255,.1);padding:clamp(1.25rem,2.5vw,2rem)">
                  <div style="font-size:clamp(3.5rem,9vw,7rem);font-weight:900;color:var(--primary)">${waitingQueue.length}</div>
                  <div style="font-size:clamp(1.1rem,2vw,1.5rem);color:white;margin-top:.5rem">Waiting</div>
                </div>
                <div class="card text-center" style="background:rgba(255,255,255,.1);padding:clamp(1.25rem,2.5vw,2rem)">
                  <div style="font-size:clamp(3.5rem,9vw,7rem);font-weight:900;color:var(--success)">${allocatedQueue.length}</div>
                  <div style="font-size:clamp(1.1rem,2vw,1.5rem);color:white;margin-top:.5rem">Seated</div>
                </div>
              </div>
            </div>
          ` : ''}
          
          ${justCalled.length > 0 ? `
            <div class="card mb" style="background:linear-gradient(135deg,rgba(22,163,74,.9),rgba(21,128,61,.9));border:4px solid var(--success);padding:clamp(2rem,4vw,4rem)">
              <h2 class="text-center" style="font-size:clamp(2.5rem,6vw,5rem);margin-bottom:clamp(1rem,2vw,2rem)">
                <span style="font-size:clamp(4rem,10vw,8rem);animation:pulse 2s infinite">🔔</span><br>
                NOW SERVING
              </h2>
              <div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(${cardSize},1fr));gap:clamp(1rem,2vw,2rem)">
                ${justCalled.map(allocated => {
                  const isMyTurn = customerQueueNumber && allocated.queueNumber === customerQueueNumber;
                  return generateNowServingCard(allocated, isMyTurn);
                }).join('')}
              </div>
            </div>
          ` : ''}
          
          ${displayWaitingQueue.length > 0 ? generateWaitingQueue() : justCalled.length === 0 ? `
            <div class="card text-center" style="background:rgba(255,255,255,.1);padding:clamp(3rem,6vw,6rem)">
              <div style="font-size:clamp(4rem,12vw,8rem);margin-bottom:clamp(1rem,2vw,2rem)">😊</div>
              <h2 style="font-size:clamp(2rem,6vw,4rem);color:white">No Queue</h2>
              <p style="font-size:clamp(1.25rem,3vw,2rem);color:rgba(255,255,255,.7);margin-top:1rem">
                All customers served!
              </p>
            </div>
          ` : ''}
        </div>
      </div>
    `);
    
    // Generate QR code if not customer view
    if (!customerQueueNumber) {
      setTimeout(() => {
        generateQRCode('display-qr', rid);
      }, 100);
    }
  });
}

// ============================================================================
// QR CONTROLS & CUSTOMIZATION
// ============================================================================

const toggleQRControls = () => {
  const controls = document.getElementById('qrControls');
  if (controls) {
    controls.classList.toggle('minimized');
  }
};

const setQRPosition = (rid, position) => {
  const qr = document.getElementById('displayQR');
  if (!qr) return;
  
  const settings = getDisplaySettings(rid);
  
  switch(position) {
    case 'top-left':
      settings.qr.position = { top: '1rem', bottom: '', left: '1rem', right: '' };
      break;
    case 'top-right':
      settings.qr.position = { top: '1rem', bottom: '', left: '', right: '1rem' };
      break;
    case 'bottom-left':
      settings.qr.position = { top: '', bottom: '1rem', left: '1rem', right: '' };
      break;
    case 'bottom-right':
      settings.qr.position = { top: '', bottom: '1rem', left: '', right: '1rem' };
      break;
  }
  
  saveDisplaySettings(rid, settings);
  
  // Apply immediately
  Object.entries(settings.qr.position).forEach(([key, value]) => {
    qr.style[key] = value;
  });
};

const updateQRSize = (rid, size) => {
  const label = document.getElementById('qrSizeLabel');
  const qrCard = document.querySelector('#displayQR .qr-card');
  
  const scale = size / 250;
  
  if (label) label.textContent = size;
  if (qrCard) qrCard.style.transform = `scale(${scale})`;
  
  const settings = getDisplaySettings(rid);
  settings.qr.scale = scale;
  saveDisplaySettings(rid, settings);
};

const updateServingCount = (rid, count) => {
  const label = document.getElementById('servingCountLabel');
  
  if (label) label.textContent = count;
  
  const settings = getDisplaySettings(rid);
  settings.ui.servingDisplayCount = parseInt(count);
  saveDisplaySettings(rid, settings);
  
  console.log(`✅ Serving display count changed to: ${count} cards`);
  
  // Note: Display will auto-refresh via Firebase listener
};

const toggleQRVisibility = (rid) => {
  const qr = document.getElementById('displayQR');
  const btn = document.getElementById('qrVisibilityBtn');
  if (!qr) return;
  
  const settings = getDisplaySettings(rid);
  settings.qr.hidden = !settings.qr.hidden;
  saveDisplaySettings(rid, settings);
  
  if (settings.qr.hidden) {
    qr.classList.add('hidden');
    if (btn) btn.textContent = '👁️ Show QR';
  } else {
    qr.classList.remove('hidden');
    if (btn) btn.textContent = '👁️ Hide QR';
  }
};

// ============================================================================
// UI CUSTOMIZATION FUNCTIONS
// ============================================================================

const toggleUISetting = (rid, setting, value) => {
  const settings = getDisplaySettings(rid);
  settings.ui[setting] = value;
  saveDisplaySettings(rid, settings);
  
  console.log(`✅ UI Setting changed: ${setting} = ${value}`);
  
  // Trigger re-render by reloading the display
  // The Firebase listener will automatically re-render with new settings
};

const setUIOption = (rid, option, value) => {
  const settings = getDisplaySettings(rid);
  settings.ui[option] = value;
  saveDisplaySettings(rid, settings);
  
  console.log(`✅ UI Option changed: ${option} = ${value}`);
  
  // Update active button styling
  document.querySelectorAll(`button[onclick*="${option}"]`).forEach(btn => {
    btn.classList.remove('active');
  });
  event.target.classList.add('active');
};

const resetDisplaySettings = (rid) => {
  if (!confirm('Reset all display settings to default?\n\nThis will reset QR position, size, and all UI options.')) {
    return;
  }
  
  // Reset to default
  saveDisplaySettings(rid, JSON.parse(JSON.stringify(DEFAULT_DISPLAY_SETTINGS)));
  
  // Reload page to apply changes
  location.reload();
};

// ============================================================================
// QR DRAG FUNCTIONALITY
// ============================================================================

let isDraggingQR = false;
let qrOffsetX = 0;
let qrOffsetY = 0;

const startDragQR = (e) => {
  // Don't drag if clicking settings button
  if (e.target.closest('.qr-toggle-btn')) return;
  
  const qr = document.getElementById('displayQR');
  if (!qr) return;
  
  isDraggingQR = true;
  qr.classList.add('dragging');
  
  const touch = e.touches ? e.touches[0] : e;
  const rect = qr.getBoundingClientRect();
  
  qrOffsetX = touch.clientX - rect.left;
  qrOffsetY = touch.clientY - rect.top;
  
  document.addEventListener('mousemove', dragQR);
  document.addEventListener('mouseup', stopDragQR);
  document.addEventListener('touchmove', dragQR);
  document.addEventListener('touchend', stopDragQR);
  
  e.preventDefault();
};

const dragQR = (e) => {
  if (!isDraggingQR) return;
  
  const qr = document.getElementById('displayQR');
  if (!qr) return;
  
  const touch = e.touches ? e.touches[0] : e;
  
  const left = touch.clientX - qrOffsetX;
  const top = touch.clientY - qrOffsetY;
  
  qr.style.top = `${top}px`;
  qr.style.bottom = '';
  qr.style.left = `${left}px`;
  qr.style.right = '';
  
  e.preventDefault();
};

const stopDragQR = (e) => {
  if (!isDraggingQR) return;
  
  isDraggingQR = false;
  const qr = document.getElementById('displayQR');
  if (qr) {
    qr.classList.remove('dragging');
    
    // Save new position
    const rid = window.location.hash.split('/')[2];
    const settings = getDisplaySettings(rid);
    settings.qr.position = {
      top: qr.style.top,
      bottom: '',
      left: qr.style.left,
      right: ''
    };
    saveDisplaySettings(rid, settings);
  }
  
  document.removeEventListener('mousemove', dragQR);
  document.removeEventListener('mouseup', stopDragQR);
  document.removeEventListener('touchmove', dragQR);
  document.removeEventListener('touchend', stopDragQR);
};

// ============================================================================
// EXPORT TO WINDOW
// ============================================================================

window.showDisplay = showDisplay;
window.toggleQRControls = toggleQRControls;
window.setQRPosition = setQRPosition;
window.updateQRSize = updateQRSize;
window.updateServingCount = updateServingCount;
window.toggleQRVisibility = toggleQRVisibility;
window.toggleUISetting = toggleUISetting;
window.setUIOption = setUIOption;
window.resetDisplaySettings = resetDisplaySettings;
window.startDragQR = startDragQR;
window.dragQR = dragQR;
window.stopDragQR = stopDragQR;

console.log('✅ QueueApp Enhanced Display Module Loaded - UI Customization Enabled');
