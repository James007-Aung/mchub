// Simple helper to set active nav link
(function () {
  const path = location.pathname.replace(/\/$/, '');
  document.querySelectorAll('nav a[data-path]').forEach(a => {
    const p = a.getAttribute('data-path');
    if (p === path || (p === '/' && (path === '' || path === '/index.html'))) {
      a.classList.add('active');
    }
  });
})();

// Delete form submit (Phase 1 -> Cloud Function endpoint)
// Replace YOUR_FIREBASE_PROJECT_ID below before going live.
async function submitDeleteRequest(e) {
  e.preventDefault();
  const form = e.target;
  const data = Object.fromEntries(new FormData(form).entries());
  const endpoint =
    'https://asia-southeast1-YOUR_FIREBASE_PROJECT_ID.cloudfunctions.net/webDeleteRequest';

  const okBox = document.getElementById('okBox');
  const errBox = document.getElementById('errBox');
  okBox.textContent = ''; okBox.className = 'notice ok'; okBox.style.display = 'none';
  errBox.textContent = ''; errBox.className = 'notice err'; errBox.style.display = 'none';

  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!res.ok) throw new Error('Request failed');
    okBox.textContent = 'Request received. We\'ll process deletion shortly.';
    okBox.style.display = 'block';
    form.reset();
  } catch (err) {
    errBox.textContent = 'Could not send request. Please try again later.';
    errBox.style.display = 'block';
  }
}
