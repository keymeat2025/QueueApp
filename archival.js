/**
 * QueueApp - Archive & Cleanup Module
 * Handles daily queue cleanup, archival storage, and auto-split for large datasets
 * Date-based cutover: Dec 2025 uses old system, Jan 2026+ uses new collection-based system
 */

// ==================== FIREBASE ARCHIVE FUNCTIONS ====================

/**
 * Daily cleanup with date-based system selection
 * OLD SYSTEM (before 2026-01): Stores in restaurant document's queueArchive field
 * NEW SYSTEM (2026-01+): Stores in separate archives/ collection with auto-split
 */
window.FirebaseCleanup = {
  async dailyCleanup(rid, isManual = false) {
    try {
      const td = new Date().toISOString().slice(0, 10);
      const month = td.slice(0, 7);
      const USE_NEW_SYSTEM = month >= '2026-01';
      
      return await db.runTransaction(async trans => {
        const rref = db.collection('restaurants').doc(rid);
        const doc = await trans.get(rref);
        if (!doc.exists) return { success: false, error: 'Not found' };
        
        const r = doc.data();
        if (r.lastCleanupDate === td) return { success: false, error: 'Already cleaned today' };
        if (r.plan === 'free' && !isManual) return { success: false, error: 'FREE plan requires manual cleanup' };
        
        const queue = r.queue || [];
        const customers = queue.map(c => ({
          queueNumber: c.queueNumber,
          name: c.name,
          phone: c.phone,
          guests: c.guests,
          joinedAt: c.joinedAt,
          allocatedAt: c.allocatedAt || null,
          tableNo: c.tableNo || null,
          status: c.status
        }));
        
        const archiveData = {
          date: td,
          summary: {
            totalCustomers: queue.length,
            served: queue.filter(q => q.status === 'allocated').length,
            waiting: queue.filter(q => q.status === 'waiting').length
          },
          customers: customers,
          archivedAt: new Date().toISOString(),
          cleanupType: isManual ? 'manual' : 'auto'
        };
        
        if (USE_NEW_SYSTEM) {
          // NEW SYSTEM: Store in archives/ collection with auto-split
          const dataSize = new Blob([JSON.stringify(archiveData)]).size;
          const maxSafeSize = 900 * 1024; // 900KB with 100KB buffer
          
          if (dataSize > maxSafeSize) {
            // Auto-split into multiple documents
            const maxCustomersPerPart = Math.floor((900 * 1024) / 200); // ~200 bytes per customer
            let partNumber = 1;
            let offset = 0;
            
            while (offset < customers.length) {
              const chunk = customers.slice(offset, offset + maxCustomersPerPart);
              const hasMore = (offset + maxCustomersPerPart) < customers.length;
              
              const partDocId = partNumber === 1 
                ? `${rid}-${td}` 
                : `${rid}-${td}-part${partNumber}`;
              
              const partData = {
                restaurantId: rid,
                restaurantName: r.name,
                date: td,
                partNumber: partNumber,
                totalParts: Math.ceil(customers.length / maxCustomersPerPart),
                summary: {
                  totalCustomers: chunk.length,
                  totalInAllParts: customers.length,
                  served: chunk.filter(c => c.status === 'allocated').length,
                  waiting: chunk.filter(c => c.status === 'waiting').length
                },
                customers: chunk,
                hasMoreParts: hasMore,
                nextPart: hasMore ? `${rid}-${td}-part${partNumber + 1}` : null,
                archivedAt: new Date().toISOString(),
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
              };
              
              trans.set(db.collection('archives').doc(partDocId), partData);
              
              offset += maxCustomersPerPart;
              partNumber++;
            }
          } else {
            // Single document storage
            const archiveRef = db.collection('archives').doc(`${rid}-${td}`);
            
            const archiveContent = {
              restaurantId: rid,
              restaurantName: r.name,
              date: td,
              summary: archiveData.summary,
              customers: archiveData.customers,
              archivedAt: archiveData.archivedAt,
              createdAt: firebase.firestore.FieldValue.serverTimestamp(),
              hasMoreParts: false
            };
            
            trans.set(archiveRef, archiveContent);
          }
          
          trans.update(rref, {
            queue: [],
            lastCleanupDate: td,
            lastCleanup: firebase.firestore.FieldValue.serverTimestamp()
          });
          
        } else {
          // OLD SYSTEM: Store in restaurant document's queueArchive field
          const qa = r.queueArchive || {};
          qa[td] = archiveData;
          trans.update(rref, {
            queue: [],
            queueArchive: qa,
            lastCleanupDate: td,
            lastCleanup: firebase.firestore.FieldValue.serverTimestamp()
          });
        }
        
        return { success: true };
      });
    } catch (err) {
      return { success: false, error: err.message };
    }
  }
};

// ==================== LOCALSTORAGE ARCHIVE FUNCTIONS ====================

/**
 * LocalStorage cleanup with same date-based logic
 */
window.LocalStorageCleanup = {
  dailyCleanup(rid, isManual = false) {
    const r = DB.restaurants[rid];
    if (!r) return { success: false, error: 'Not found' };
    
    const td = new Date().toISOString().slice(0, 10);
    const month = td.slice(0, 7);
    const USE_NEW_SYSTEM = month >= '2026-01';
    
    if (r.lastCleanupDate === td) return { success: false, error: 'Already cleaned today' };
    if (r.plan === 'free' && !isManual) return { success: false, error: 'FREE plan requires manual cleanup' };
    
    const customers = r.queue.map(c => ({
      queueNumber: c.queueNumber,
      name: c.name,
      phone: c.phone,
      guests: c.guests,
      joinedAt: c.joinedAt,
      allocatedAt: c.allocatedAt || null,
      tableNo: c.tableNo || null,
      status: c.status
    }));
    
    const archiveData = {
      date: td,
      summary: {
        totalCustomers: r.queue.length,
        served: r.queue.filter(q => q.status === 'allocated').length,
        waiting: r.queue.filter(q => q.status === 'waiting').length
      },
      customers: customers,
      archivedAt: new Date().toISOString(),
      cleanupType: isManual ? 'manual' : 'auto'
    };
    
    if (USE_NEW_SYSTEM) {
      // NEW SYSTEM: Store in separate localStorage keys
      const dataSize = new Blob([JSON.stringify(archiveData)]).size;
      const maxSafeSize = 900 * 1024;
      
      if (dataSize > maxSafeSize) {
        // Auto-split into multiple localStorage keys
        const maxCustomersPerPart = Math.floor((900 * 1024) / 200);
        let partNumber = 1;
        let offset = 0;
        
        while (offset < customers.length) {
          const chunk = customers.slice(offset, offset + maxCustomersPerPart);
          const hasMore = (offset + maxCustomersPerPart) < customers.length;
          
          const partKey = partNumber === 1 
            ? `archive_${rid}_${td}` 
            : `archive_${rid}_${td}_part${partNumber}`;
          
          const partData = {
            restaurantId: rid,
            restaurantName: r.name,
            date: td,
            partNumber: partNumber,
            totalParts: Math.ceil(customers.length / maxCustomersPerPart),
            summary: {
              totalCustomers: chunk.length,
              totalInAllParts: customers.length
            },
            customers: chunk,
            hasMoreParts: hasMore
          };
          
          localStorage.setItem(partKey, JSON.stringify(partData));
          
          offset += maxCustomersPerPart;
          partNumber++;
        }
      } else {
        // Single localStorage key
        const archiveKey = `archive_${rid}_${td}`;
        const archiveContent = {
          restaurantId: rid,
          restaurantName: r.name,
          date: td,
          summary: archiveData.summary,
          customers: archiveData.customers,
          archivedAt: archiveData.archivedAt,
          hasMoreParts: false
        };
        localStorage.setItem(archiveKey, JSON.stringify(archiveContent));
      }
    } else {
      // OLD SYSTEM: Store in restaurant's queueArchive object
      const qa = r.queueArchive || {};
      qa[td] = archiveData;
      r.queueArchive = qa;
    }
    
    r.queue = [];
    r.lastCleanupDate = td;
    DB.save();
    return { success: true };
  }
};

// ==================== UI FUNCTIONS ====================

/**
 * Show cleanup choice modal - Manual vs Upgrade to Premium
 */
window.showCleanupChoiceModal = function(rid, qc) {
  const md = document.createElement('div');
  md.className = 'modal-overlay';
  md.id = 'cleanupModal';
  md.innerHTML = `
    <div class="modal-content">
      <h2 style="text-align:center;margin-bottom:1.5rem;font-size:clamp(1.25rem,4vw,2rem)">Reset Today's Queue?</h2>
      <p style="text-align:center;color:var(--gray-600);margin-bottom:2rem">Current queue has <strong>${qc} customer${qc !== 1 ? 's' : ''}</strong></p>
      
      <div class="grid grid-2" style="gap:1rem">
        <div class="card" style="border:2px solid var(--gray-200);cursor:pointer;transition:all .3s ease" onclick="performCleanup('${rid}',${qc},closeCleanupModal)">
          <div style="text-align:center;padding:1rem">
            <div style="font-size:2rem;margin-bottom:.5rem">🔄</div>
            <h3 style="font-size:1.1rem;margin-bottom:.5rem">Manual Reset</h3>
            <p style="font-size:.875rem;color:var(--gray-600);margin:0">Free • Reset now</p>
          </div>
        </div>
        
        <div class="card" style="background:linear-gradient(135deg,var(--primary) 0%,var(--secondary) 100%);color:white;border:2px solid var(--primary);cursor:pointer;transition:all .3s ease" onclick="upgradeFromCleanup('${rid}')">
          <div style="text-align:center;padding:1rem">
            <div style="font-size:2rem;margin-bottom:.5rem">⚡</div>
            <h3 style="font-size:1.1rem;margin-bottom:.5rem">Automatic Reset</h3>
            <p style="font-size:.875rem;opacity:.9;margin:0">Premium • Midnight auto-reset</p>
          </div>
        </div>
      </div>
      
      <div style="margin-top:1.5rem;padding-top:1.5rem;border-top:2px solid var(--gray-200)">
        <p style="font-size:.875rem;color:var(--gray-600);margin-bottom:.75rem"><strong>Premium Benefits:</strong></p>
        <ul style="font-size:.875rem;color:var(--gray-600);margin-left:1.5rem">
          <li>Automatic cleanup at midnight</li>
          <li>Unlimited customers/month</li>
          <li>Advanced analytics</li>
        </ul>
      </div>
      
      <button onclick="closeCleanupModal()" class="btn btn-secondary w-full mt">Cancel</button>
    </div>
  `;
  document.body.appendChild(md);
};

/**
 * Perform cleanup - calls Firebase and localStorage cleanup
 */
window.performCleanup = function(rid, qc, closeFn) {
  const btn = event.target.closest('.card');
  const orig = btn.innerHTML;
  btn.innerHTML = '<div style="text-align:center;padding:1rem"><div style="font-size:2rem">⏳</div><p>Resetting queue...</p></div>';
  
  window.FirebaseCleanup.dailyCleanup(rid, true).then(res => {
    if (res.success) {
      window.LocalStorageCleanup.dailyCleanup(rid, true);
      
      // Track cleanup count for progressive nudges
      const cnt = parseInt(localStorage.getItem(`cleanup_count_${rid}`) || '0') + 1;
      localStorage.setItem(`cleanup_count_${rid}`, cnt.toString());
      
      if (closeFn) closeFn();
      showCleanupSuccessModal(rid, qc, false, cnt);
    } else {
      alert(res.error === 'Already cleaned today' ? '✅ Queue already reset today!' : '❌ Error: ' + res.error);
      btn.innerHTML = orig;
    }
  }).catch(err => {
    alert('❌ Error: ' + err.message);
    btn.innerHTML = orig;
  });
};

/**
 * Show success modal after cleanup
 */
window.showCleanupSuccessModal = function(rid, qc, wasClean, cnt) {
  // Show progressive upgrade modal every 3rd cleanup
  if (cnt >= 3 && cnt % 3 === 0) {
    showProgressiveUpgradeModal(rid, qc, cnt);
    return;
  }
  
  const md = document.createElement('div');
  md.className = 'modal-overlay';
  md.id = 'successModal';
  md.innerHTML = `
    <div class="modal-content">
      <div style="text-align:center;margin-bottom:2rem">
        <div style="font-size:clamp(3rem,10vw,5rem);animation:pulse 1.5s infinite">✅</div>
        <h2 style="color:var(--success);margin:1rem 0;font-size:clamp(1.25rem,4vw,2rem)">
          ${wasClean ? 'Queue Already Fresh!' : 'Queue Reset Complete!'}
        </h2>
        <p style="color:var(--gray-600)">
          ${wasClean ? 'Your queue was already reset today' : 'Successfully archived and cleared today\'s queue'}
        </p>
      </div>
      
      ${!wasClean ? `
        <div class="card" style="background:var(--gray-50);margin-bottom:1.5rem">
          <div class="grid grid-2" style="gap:1rem">
            <div style="text-align:center">
              <div style="font-size:clamp(1.5rem,4vw,2rem);font-weight:900;color:var(--primary)">${qc}</div>
              <p style="font-size:.875rem;color:var(--gray-600)">Archived</p>
            </div>
            <div style="text-align:center">
              <div style="font-size:clamp(1.5rem,4vw,2rem);font-weight:900;color:var(--success)">0</div>
              <p style="font-size:.875rem;color:var(--gray-600)">Current Queue</p>
            </div>
          </div>
        </div>
      ` : ''}
      
      <div class="card" style="background:linear-gradient(135deg,#fef9c3 0%,#fef3c7 100%);border:2px solid var(--warning);text-align:center;cursor:pointer" onclick="upgradeFromSuccess('${rid}')">
        <div style="font-size:1.5rem;margin-bottom:.5rem">⚡</div>
        <p style="font-weight:700;margin-bottom:.5rem">Tired of daily resets?</p>
        <p style="font-size:.875rem;color:var(--gray-700);margin-bottom:1rem">Premium users get automatic cleanup at midnight</p>
        <button class="btn btn-primary w-full" style="pointer-events:none">⚡ Make It Automatic - Upgrade Now</button>
      </div>
      
      <button onclick="closeSuccessModal()" class="btn btn-secondary w-full mt">Continue to Dashboard</button>
    </div>
  `;
  document.body.appendChild(md);
};

/**
 * Show progressive upgrade modal (every 3rd cleanup)
 */
window.showProgressiveUpgradeModal = function(rid, qc, cnt) {
  const ord = getOrdinalSuffix(cnt);
  const md = document.createElement('div');
  md.className = 'modal-overlay';
  md.id = 'successModal';
  md.innerHTML = `
    <div class="modal-content">
      <div style="text-align:center;margin-bottom:2rem">
        <div style="font-size:clamp(3rem,10vw,5rem);animation:pulse 1.5s infinite">🎯</div>
        <h2 style="color:var(--primary);margin:1rem 0;font-size:clamp(1.25rem,4vw,2rem)">
          ${cnt}${ord} Manual Reset & Counting!
        </h2>
        <p style="color:var(--gray-600);font-size:clamp(.875rem,2.5vw,1.1rem);font-weight:600">
          Premium users never click this button
        </p>
      </div>
      
      <div class="card" style="background:var(--gray-50);margin-bottom:1.5rem">
        <div class="grid grid-2" style="gap:1rem">
          <div style="text-align:center">
            <div style="font-size:clamp(1.5rem,4vw,2rem);font-weight:900;color:var(--warning)">${cnt}</div>
            <p style="font-size:.875rem;color:var(--gray-600)">Manual Resets</p>
          </div>
          <div style="text-align:center">
            <div style="font-size:clamp(1.5rem,4vw,2rem);font-weight:900;color:var(--success)">0</div>
            <p style="font-size:.875rem;color:var(--gray-600)">Effort Required</p>
          </div>
        </div>
      </div>
      
      <div class="card" style="background:linear-gradient(135deg,var(--primary) 0%,var(--secondary) 100%);color:white;text-align:center">
        <div style="font-size:1.5rem;margin-bottom:1rem">⚡</div>
        <h3 style="margin-bottom:1rem">Stop Clicking. Start Automating.</h3>
        <ul style="text-align:left;margin:1rem auto;max-width:300px;font-size:.875rem">
          <li>✅ Automatic cleanup at midnight</li>
          <li>✅ Unlimited customers/month</li>
          <li>✅ Advanced analytics</li>
          <li>✅ Priority support</li>
        </ul>
        <button onclick="upgradeFromProgressive('${rid}')" class="btn w-full mt" style="background:white;color:var(--primary);font-size:clamp(1rem,2.5vw,1.1rem);padding:clamp(.875rem,2vw,1rem) clamp(1.5rem,3vw,2rem)">
          ⚡ Upgrade to Premium Now
        </button>
      </div>
      
      <button onclick="closeSuccessModal()" class="btn btn-secondary w-full mt">Maybe Later</button>
    </div>
  `;
  document.body.appendChild(md);
};

/**
 * Helper: Get ordinal suffix (1st, 2nd, 3rd, etc.)
 */
window.getOrdinalSuffix = function(n) {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return (s[(v - 20) % 10] || s[v] || s[0]);
};

/**
 * Close cleanup modal
 */
window.closeCleanupModal = function() {
  const m = document.getElementById('cleanupModal');
  if (m) m.remove();
};

/**
 * Close success modal and reload page
 */
window.closeSuccessModal = function() {
  const m = document.getElementById('successModal');
  if (m) m.remove();
  location.reload();
};

/**
 * Upgrade flows - track source for analytics
 */
window.upgradeFromCleanup = function(rid) {
  sessionStorage.setItem('upgrade_source', 'cleanup_button');
  navigate('/pricing');
};

window.upgradeFromSuccess = function(rid) {
  sessionStorage.setItem('upgrade_source', 'cleanup_success');
  navigate('/pricing');
};

window.upgradeFromProgressive = function(rid) {
  sessionStorage.setItem('upgrade_source', 'progressive_nudge');
  navigate('/pricing');
};

console.log('✅ QueueApp Archival Module Loaded');
