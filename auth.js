
// ============================================================================
// QUEUEAPP - AUTH.JS
// Authentication & User Management Module
// ============================================================================

// ============================================================================
// LOGIN FLOWS
// ============================================================================

// Show main login page
function showLogin() {
  render(`
    <div style="min-height:100vh;background:linear-gradient(135deg,#3b82f6 0%,#9333ea 100%);display:flex;align-items:center;justify-content:center;padding:2rem">
      <div class="card" style="max-width:500px;width:100%">
        <h2 class="text-center mb">Restaurant Login</h2>
        <div class="space-y">
          <input type="text" id="loginRestaurantId" placeholder="Restaurant ID">
          <input type="tel" id="loginPhone" placeholder="Phone" maxlength="10">
          <button onclick="handleLogin(event)" class="btn btn-primary w-full">Login</button>
          <p class="text-center" style="font-size:.875rem">
            No account? 
            <button onclick="navigate('/signup')" style="background:none;border:none;color:var(--primary);font-weight:600;text-decoration:underline;cursor:pointer;padding:.5rem">Sign Up</button>
          </p>
        </div>
      </div>
    </div>
  `);
}

// Handle login form submission
async function handleLogin(e) {
  if (!checkInternet()) return;
  
  const rid = document.getElementById('loginRestaurantId').value.trim();
  const phone = document.getElementById('loginPhone').value.trim();
  
  if (!rid || !phone) {
    alert('⚠️ Fill all fields');
    return;
  }
  
  const btn = e.target;
  btn.textContent = 'Logging in...';
  btn.disabled = true;
  
  try {
    const result = await FirebaseDB.getRestaurant(rid);
    
    if (!result.success) {
      alert('❌ Restaurant ID not found');
      btn.textContent = 'Login';
      btn.disabled = false;
      return;
    }
    
    if (result.data.phone.trim() !== phone.trim()) {
      alert('❌ Invalid phone number');
      btn.textContent = 'Login';
      btn.disabled = false;
      return;
    }
    
    // Sync to localStorage
    DB.restaurants[rid] = result.data;
    DB.save();
    
    // Set session
    sessionStorage.setItem(`loggedIn_${rid}`, 'true');
    
    // Navigate to admin
    setTimeout(() => navigate(`/r/${rid}/admin`), 100);
  } catch (err) {
    alert(`❌ Login failed: ${err.message}\n\nPlease check your internet connection and try again.`);
    btn.textContent = 'Login';
    btn.disabled = false;
  }
}

// Show restaurant-specific login page (when accessing protected routes)
function showRestaurantLogin(rid) {
  render(`
    <div style="min-height:100vh;background:linear-gradient(135deg,#3b82f6 0%,#9333ea 100%);display:flex;align-items:center;justify-content:center;padding:2rem">
      <div class="card" style="max-width:500px;width:100%">
        <h2 class="text-center mb">Login Required</h2>
        <input type="tel" id="restaurantLoginPhone" placeholder="Phone" maxlength="10">
        <button onclick="handleRestaurantLogin('${rid}')" class="btn btn-primary w-full mt">Login</button>
      </div>
    </div>
  `);
}

// Handle restaurant-specific login
async function handleRestaurantLogin(rid) {
  if (!checkInternet()) return;
  
  const phone = document.getElementById('restaurantLoginPhone').value.trim();
  
  if (!phone) {
    alert('⚠️ Enter phone number');
    return;
  }
  
  try {
    const result = await FirebaseDB.getRestaurant(rid);
    
    if (!result.success) {
      alert('❌ Restaurant not found');
      return;
    }
    
    if (result.data.phone.trim() !== phone.trim()) {
      alert('❌ Invalid phone number');
      return;
    }
    
    // Sync to localStorage
    DB.restaurants[rid] = result.data;
    DB.save();
    
    // Set session
    sessionStorage.setItem(`loggedIn_${rid}`, 'true');
    
    // Re-run route handler
    handleRoute();
  } catch (err) {
    alert(`❌ Error: ${err.message}\n\nPlease check your internet connection.`);
  }
}

// ============================================================================
// SIGNUP FLOW
// ============================================================================

// Show signup page
function showSignup() {
  render(`
    <div style="min-height:100vh;background:linear-gradient(135deg,var(--primary) 0%,var(--secondary) 100%);display:flex;align-items:center;justify-content:center;padding:2rem">
      <div class="card" style="max-width:700px;width:100%">
        <h2 class="text-center mb">Register Restaurant</h2>
        <div class="space-y">
          <input type="text" id="restaurantName" placeholder="Restaurant Name">
          <input type="text" id="ownerName" placeholder="Owner Name">
          <input type="email" id="email" placeholder="Email">
          <input type="tel" id="phone" placeholder="Phone (10 digits)" maxlength="10">
          <input type="text" id="city" placeholder="Location (e.g., Mumbai - Andheri)">
          <div class="flex gap-1" style="align-items:flex-start">
            <input type="checkbox" id="agreeTerms" style="width:auto;margin-top:.25rem">
            <label for="agreeTerms" style="font-size:.875rem;margin-bottom:0">I agree to Terms & Privacy</label>
          </div>
          <button onclick="handleSignup(event)" class="btn btn-primary w-full">Register</button>
          <p class="text-center" style="font-size:.875rem">
            Have account? 
            <button onclick="navigate('/login')" style="background:none;border:none;color:var(--primary);font-weight:600;text-decoration:underline;cursor:pointer;padding:.5rem">Login</button>
          </p>
        </div>
      </div>
    </div>
  `);
}

// Handle signup form submission
async function handleSignup(e) {
  if (!checkInternet()) return;
  
  const name = document.getElementById('restaurantName').value.trim();
  const owner = document.getElementById('ownerName').value.trim();
  const email = document.getElementById('email').value.trim();
  const phone = document.getElementById('phone').value.trim();
  const city = document.getElementById('city').value.trim();
  const agreeTerms = document.getElementById('agreeTerms').checked;
  
  if (!name || !owner || !email || !phone || !city) {
    alert('⚠️ Fill all fields');
    return;
  }
  
  if (!agreeTerms) {
    alert('⚠️ Agree to terms');
    return;
  }
  
  const btn = e.target;
  btn.textContent = 'Registering...';
  btn.disabled = true;
  
  try {
    // Generate restaurant ID
    const rid = name.substring(0, 3).toUpperCase().replace(/[^A-Z]/g, 'X') + Math.floor(Math.random() * 10000);
    
    const result = await FirebaseDB.addRestaurant(rid, {
      name: name,
      owner: owner,
      email: email,
      phone: phone,
      city: city
    });
    
    if (result.success) {
      // Sync to localStorage
      DB.addRestaurant(rid, {
        name: name,
        owner: owner,
        email: email,
        phone: phone,
        city: city
      });
      
      // Set session
      sessionStorage.setItem(`loggedIn_${rid}`, 'true');
      
      alert(`✅ Success! ID: ${rid}\n\nFREE plan: 500/month\n\nSave your ID!`);
      navigate(`/r/${rid}/admin`);
    } else {
      alert(`❌ Failed: ${result.error}`);
      btn.textContent = 'Register';
      btn.disabled = false;
    }
  } catch (err) {
    alert(`❌ Error: ${err.message}`);
    btn.textContent = 'Register';
    btn.disabled = false;
  }
}

// ============================================================================
// PLATFORM ADMIN AUTHENTICATION
// ============================================================================

// Show platform admin password prompt
function showAdminPasswordPrompt() {
  render(`
    <div style="min-height:100vh;background:linear-gradient(135deg,#111827 0%,#1f2937 100%);display:flex;align-items:center;justify-content:center;padding:2rem">
      <div class="card" style="max-width:500px;width:100%">
        <h2 class="text-center mb">🔐 Admin Login</h2>
        <div class="space-y">
          <input type="email" id="adminEmail" placeholder="Email" autocomplete="email">
          <input type="password" id="adminPassword" placeholder="Password" autocomplete="current-password">
          <button onclick="firebaseAdminLogin(event)" class="btn w-full" style="background:var(--gray-900);color:white">Sign In</button>
          <div id="adminLoginError" class="hidden alert alert-warning"></div>
        </div>
      </div>
    </div>
  `);
}

// Handle Firebase admin login
async function firebaseAdminLogin(e) {
  const email = document.getElementById('adminEmail').value.trim();
  const password = document.getElementById('adminPassword').value.trim();
  const errorDiv = document.getElementById('adminLoginError');
  
  if (!email || !password) {
    errorDiv.textContent = '⚠️ Enter email and password';
    errorDiv.classList.remove('hidden');
    return;
  }
  
  const btn = e.target;
  btn.textContent = 'Signing in...';
  btn.disabled = true;
  
  try {
    const result = await FirebaseAdmin.signIn(email, password);
    
    if (result.success) {
      sessionStorage.setItem('adminAuth', 'yes');
      sessionStorage.setItem('adminEmail', result.user.email);
      window.location.hash = '/admin';
      setTimeout(handleRoute, 100);
    } else {
      errorDiv.textContent = `❌ ${result.error}`;
      errorDiv.classList.remove('hidden');
      btn.textContent = 'Sign In';
      btn.disabled = false;
    }
  } catch (err) {
    errorDiv.textContent = `❌ ${err.message}`;
    errorDiv.classList.remove('hidden');
    btn.textContent = 'Sign In';
    btn.disabled = false;
  }
}

// Check if platform admin is authenticated
const checkFirebaseAdminAuth = () => {
  return FirebaseAdmin.getCurrentUser() && sessionStorage.getItem('adminAuth') === 'yes';
};

// ============================================================================
// EXPORT TO WINDOW
// ============================================================================

window.showLogin = showLogin;
window.handleLogin = handleLogin;
window.showRestaurantLogin = showRestaurantLogin;
window.handleRestaurantLogin = handleRestaurantLogin;
window.showSignup = showSignup;
window.handleSignup = handleSignup;
window.showAdminPasswordPrompt = showAdminPasswordPrompt;
window.firebaseAdminLogin = firebaseAdminLogin;
window.checkFirebaseAdminAuth = checkFirebaseAdminAuth;

console.log('✅ QueueApp Auth Module Loaded');
