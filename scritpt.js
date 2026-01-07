function navigateTo(page) {
  window.location.href = page;
}

// Firebase configuration
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_AUTH_DOMAIN",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_STORAGE_BUCKET",
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
  appId: "YOUR_APP_ID",
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);

// Recaptcha verifier
window.recaptchaVerifier = new firebase.auth.RecaptchaVerifier('recaptcha-container', {
  'size': 'normal',
  'callback': (response) => {},
  'expired-callback': () => {}
});

function sendOTP() {
  const phoneNumber = document.getElementById('phone-number').value;
  const appVerifier = window.recaptchaVerifier;

  firebase.auth().signInWithPhoneNumber(phoneNumber, appVerifier)
    .then((result) => {
      confirmationResult = result;
      alert('OTP sent!');
    }).catch((error) => {
      console.error("Error during sending OTP", error);
      alert('Failed to send OTP. Please try again.');
    });
}

function verifyOTP() {
  const otp = document.getElementById('otp').value;
  confirmationResult.confirm(otp).then((result) => {
    const user = result.user;
    alert('OTP verified successfully!');
  }).catch((error) => {
    console.error("Error during verifying OTP", error);
    alert('Failed to verify OTP. Please try again.');
  });
}

function signInWithGoogle() {
  const provider = new firebase.auth.GoogleAuthProvider();
  firebase.auth().signInWithPopup(provider).then((result) => {
    const user = result.user;
    alert('Signed in successfully with Google!');
  }).catch((error) => {
    console.error("Error during Google sign-in", error);
    alert('Failed to sign in with Google. Please try again.');
  });
}

function navigateTo(page) {
  window.location.href = page;
}

document.getElementById('trip-form').addEventListener('submit', function(event) {
  event.preventDefault();
  const pickup = document.getElementById('pickup').value;
  const dropoff = document.getElementById('dropoff').value;
  const datetime = document.getElementById('datetime').value;

  // Add your booking logic here
  alert(`Trip booked from ${pickup} to ${dropoff} at ${datetime}`);
});

function scheduleLater() {
  alert('Trip scheduled for later');
}
