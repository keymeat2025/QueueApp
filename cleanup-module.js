// QueueApp Cleanup Module - Tiered Strategy (Free: Manual, Premium: Auto)
// Version: 1.0
// Include this file in your main HTML: <script src="cleanup-module.js"></script>

(function() {
    'use strict';
    
    // ============================================
    // CLEANUP MODAL FUNCTIONS
    // ============================================
    
    /**
     * Shows choice modal for cleanup (Manual vs Premium Auto)
     */
    window.showCleanupChoiceModal = function(restaurantId, queueCount) {
        const modal = document.createElement('div');
        modal.id = 'cleanupModal';
        modal.className = 'modal-overlay';
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h2 style="text-align: center;">🧹 Reset Queue</h2>
                    <p style="text-align: center; color: var(--gray-600); margin-top: 0.5rem;">Choose how to reset your queue</p>
                </div>
                <div class="modal-body">
                    <div class="choice-card choice-card-free" onclick="performCleanup('${restaurantId}', ${queueCount}, closeCleanupModal)">
                        <div style="display: flex; align-items: center; gap: 1rem;">
                            <div style="font-size: 3rem;">🖱️</div>
                            <div style="flex: 1;">
                                <h3 style="margin-bottom: 0.5rem;">Manual Reset (Free)</h3>
                                <p style="color: var(--gray-600); font-size: 0.875rem; margin: 0;">Click to reset queue now</p>
                            </div>
                        </div>
                    </div>
                    
                    <div class="choice-card choice-card-premium" onclick="upgradeFromCleanup('${restaurantId}')">
                        <div style="display: flex; align-items: center; gap: 1rem;">
                            <div style="font-size: 3rem;">⚡</div>
                            <div style="flex: 1;">
                                <h3 style="margin-bottom: 0.5rem; color: var(--primary);">Automatic Reset (PREMIUM)</h3>
                                <p style="color: var(--gray-700); font-size: 0.875rem; margin-bottom: 0.5rem;">Resets automatically at midnight - no daily action needed!</p>
                                <ul style="font-size: 0.75rem; color: var(--gray-600); margin: 0; padding-left: 1.5rem;">
                                    <li>Zero manual work</li>
                                    <li>Unlimited customers</li>
                                    <li>Advanced analytics</li>
                                </ul>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="modal-footer">
                    <button onclick="closeCleanupModal()" class="btn btn-secondary">Cancel</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    };
    
    /**
     * Performs the actual cleanup operation
     */
    window.performCleanup = async function(restaurantId, queueCount, closeModal) {
        // Show loading state
        const modal = document.getElementById('cleanupModal');
        if (modal) {
            modal.innerHTML = `
                <div class="modal-content">
                    <div class="modal-body" style="text-align: center; padding: 4rem 2rem;">
                        <div style="font-size: 5rem; animation: pulse 1.5s infinite;">🧹</div>
                        <h2 style="margin: 1rem 0;">Resetting Queue...</h2>
                        <p style="color: var(--gray-600);">Archiving ${queueCount} customer${queueCount !== 1 ? 's' : ''}...</p>
                    </div>
                </div>
            `;
        }
        
        // Perform cleanup
        try {
            const result = await window.FirebaseDB.dailyCleanup(restaurantId, true);
            
            // Update cleanup count
            const currentCount = parseInt(localStorage.getItem(`cleanup_count_${restaurantId}`) || '0');
            localStorage.setItem(`cleanup_count_${restaurantId}`, currentCount + 1);
            
            if (result.success) {
                if (closeModal) closeModal();
                showCleanupSuccessModal(restaurantId, queueCount, result.alreadyCleaned);
            } else {
                throw new Error(result.error);
            }
        } catch (error) {
            alert(`❌ Cleanup failed: ${error.message}`);
            if (closeModal) closeModal();
        }
    };
    
    /**
     * Shows success modal after cleanup
     */
    window.showCleanupSuccessModal = function(restaurantId, queueCount, wasAlreadyClean) {
        const cleanupCount = parseInt(localStorage.getItem(`cleanup_count_${restaurantId}`) || '0');
        
        // Check if we should show progressive nudge (every 3rd cleanup)
        if (cleanupCount > 0 && cleanupCount % 3 === 0) {
            showProgressiveUpgradeModal(restaurantId, queueCount, cleanupCount);
            return;
        }
        
        const modal = document.createElement('div');
        modal.id = 'successModal';
        modal.className = 'modal-overlay';
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header" style="background: linear-gradient(135deg, #dcfce7 0%, #bbf7d0 100%);">
                    <div style="text-align: center;">
                        <div style="font-size: 5rem;">✅</div>
                        <h2 style="color: var(--success); margin: 0.5rem 0;">Queue Reset Complete!</h2>
                    </div>
                </div>
                <div class="modal-body">
                    <div class="card" style="background: var(--gray-50); text-align: center; margin-bottom: 1.5rem;">
                        ${wasAlreadyClean ? `
                            <p style="font-size: 1.25rem; color: var(--gray-700);">Queue was already clean for today</p>
                        ` : `
                            <p style="font-size: 1.25rem; color: var(--gray-700); margin-bottom: 0.5rem;">
                                <strong>${queueCount}</strong> customer${queueCount !== 1 ? 's' : ''} archived
                            </p>
                            <p style="font-size: 0.875rem; color: var(--gray-600);">Queue is ready for new customers</p>
                        `}
                    </div>
                    
                    <div class="card" style="background: linear-gradient(135deg, #fff7ed 0%, #ffedd5 100%); border: 2px solid var(--primary);">
                        <div style="text-align: center;">
                            <h3 style="color: var(--primary); margin-bottom: 0.5rem;">Tired of daily resets?</h3>
                            <p style="font-size: 0.875rem; color: var(--gray-700); margin-bottom: 1rem;">Premium users never click this button - their queue resets automatically at midnight!</p>
                            <button onclick="upgradeFromSuccess('${restaurantId}')" class="btn btn-primary" style="font-size: 1.1rem;">
                                ⚡ Make It Automatic - Upgrade Now
                            </button>
                        </div>
                    </div>
                </div>
                <div class="modal-footer">
                    <button onclick="closeSuccessModal()" class="btn btn-secondary w-full">Continue to Dashboard</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    };
    
    /**
     * Shows progressive upgrade modal (after 3+ cleanups)
     */
    window.showProgressiveUpgradeModal = function(restaurantId, queueCount, cleanupCount) {
        const ordinal = getOrdinalSuffix(cleanupCount);
        
        const modal = document.createElement('div');
        modal.id = 'successModal';
        modal.className = 'modal-overlay';
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header" style="background: linear-gradient(135deg, #fef9c3 0%, #fde047 100%);">
                    <div style="text-align: center;">
                        <div style="font-size: 5rem; animation: bounce 0.6s ease;">🎯</div>
                        <h2 style="color: var(--warning); margin: 0.5rem 0;">That's Your ${ordinal} Manual Reset!</h2>
                    </div>
                </div>
                <div class="modal-body">
                    <div class="card" style="background: var(--gray-50); text-align: center; margin-bottom: 1.5rem;">
                        <p style="font-size: 1.5rem; font-weight: 700; color: var(--gray-900); margin-bottom: 0.5rem;">
                            You've manually reset ${cleanupCount} times
                        </p>
                        <p style="font-size: 1rem; color: var(--gray-600);">Premium users <strong>never</strong> do this!</p>
                    </div>
                    
                    <div class="card" style="background: linear-gradient(135deg, var(--primary) 0%, var(--secondary) 100%); color: white; text-align: center;">
                        <div style="font-size: 4rem; margin-bottom: 1rem;">⚡</div>
                        <h3 style="margin-bottom: 1rem;">Stop Clicking. Start Automating.</h3>
                        <div style="text-align: left; margin: 1.5rem 0;">
                            <p style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.75rem;">
                                <span style="font-size: 1.25rem;">✓</span>
                                <span>Auto cleanup at midnight daily</span>
                            </p>
                            <p style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.75rem;">
                                <span style="font-size: 1.25rem;">✓</span>
                                <span>Unlimited customers</span>
                            </p>
                            <p style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.75rem;">
                                <span style="font-size: 1.25rem;">✓</span>
                                <span>Advanced analytics</span>
                            </p>
                            <p style="display: flex; align-items: center; gap: 0.5rem;">
                                <span style="font-size: 1.25rem;">✓</span>
                                <span>Zero manual work</span>
                            </p>
                        </div>
                        <button onclick="upgradeFromProgressive('${restaurantId}')" class="btn w-full" style="background: white; color: var(--primary); font-size: 1.25rem; padding: 1rem 2rem; margin-top: 1rem;">
                            🚀 Upgrade to Premium Now
                        </button>
                        <p style="font-size: 0.875rem; margin-top: 1rem; opacity: 0.9;">Just ₹1,999/month • Cancel anytime</p>
                    </div>
                </div>
                <div class="modal-footer">
                    <button onclick="closeSuccessModal()" class="btn btn-secondary w-full">Maybe Later</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    };
    
    /**
     * Cleanup history viewer
     */
    window.viewCleanupHistory = function(restaurantId) {
        const restaurant = window.DB.restaurants[restaurantId];
        const archive = restaurant?.queueArchive || {};
        const entries = Object.entries(archive).sort((a, b) => b[0].localeCompare(a[0])).slice(0, 30);
        
        const modal = document.createElement('div');
        modal.id = 'historyModal';
        modal.className = 'modal-overlay';
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h2>📜 Cleanup History</h2>
                    <p style="color: var(--gray-600); font-size: 0.875rem; margin-top: 0.5rem;">Last 30 cleanups</p>
                </div>
                <div class="modal-body">
                    ${entries.length > 0 ? `
                        <div class="space-y">
                            ${entries.map(([date, data]) => `
                                <div class="card" style="background: var(--gray-50);">
                                    <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem;">
                                        <div>
                                            <p style="font-weight: 700; margin-bottom: 0.25rem;">${new Date(date).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
                                            <p style="font-size: 0.875rem; color: var(--gray-600);">
                                                Total: ${data.totalCustomers} • Served: ${data.served} • Waiting: ${data.waiting}
                                            </p>
                                        </div>
                                        <span class="badge ${data.cleanupType === 'auto' ? 'badge-primary' : 'badge-secondary'}">
                                            ${data.cleanupType === 'auto' ? '⚡ AUTO' : '🖱️ MANUAL'}
                                        </span>
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                    ` : `
                        <div class="card text-center" style="background: var(--gray-50); padding: 3rem;">
                            <div style="font-size: 3rem; margin-bottom: 1rem;">📭</div>
                            <p style="color: var(--gray-600);">No cleanup history yet</p>
                        </div>
                    `}
                </div>
                <div class="modal-footer">
                    <button onclick="closeHistoryModal()" class="btn btn-primary w-full">Close</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    };
    
    // ============================================
    // UPGRADE NAVIGATION FUNCTIONS
    // ============================================
    
    window.upgradeFromCleanup = function(restaurantId) {
        sessionStorage.setItem('upgrade_source', 'cleanup_button');
        window.navigate('/pricing');
    };
    
    window.upgradeFromSuccess = function(restaurantId) {
        sessionStorage.setItem('upgrade_source', 'cleanup_success');
        window.navigate('/pricing');
    };
    
    window.upgradeFromProgressive = function(restaurantId) {
        sessionStorage.setItem('upgrade_source', 'progressive_nudge');
        window.navigate('/pricing');
    };
    
    // ============================================
    // MODAL CLOSE FUNCTIONS
    // ============================================
    
    window.closeCleanupModal = function() {
        const modal = document.getElementById('cleanupModal');
        if (modal) modal.remove();
    };
    
    window.closeSuccessModal = function() {
        const modal = document.getElementById('successModal');
        if (modal) modal.remove();
    };
    
    window.closeHistoryModal = function() {
        const modal = document.getElementById('historyModal');
        if (modal) modal.remove();
    };
    
    // ============================================
    // HELPER FUNCTIONS
    // ============================================
    
    function getOrdinalSuffix(num) {
        const j = num % 10, k = num % 100;
        if (j === 1 && k !== 11) return num + "st";
        if (j === 2 && k !== 12) return num + "nd";
        if (j === 3 && k !== 13) return num + "rd";
        return num + "th";
    }
    
    console.log('✅ QueueApp Cleanup Module loaded');
})();
