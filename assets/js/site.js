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

/* START ANCHOR: Header Inject + Hamburger */
(function () {
  const mount = document.getElementById("site-header");
  if (!mount) return;

  fetch("/partials/header.html", { cache: "no-store" })
    .then(res => res.text())
    .then(html => {
      mount.innerHTML = html;

      // Hamburger toggle
      const toggle = mount.querySelector(".nav-toggle");
      const links  = mount.querySelector(".nav-links");
      if (toggle && links) {
        toggle.addEventListener("click", () => {
          links.classList.toggle("active");
        });
        // Close on outside click (desktop & mobile)
        document.addEventListener("click", (e) => {
          if (!mount.contains(e.target) && links.classList.contains("active")) {
            links.classList.remove("active");
          }
        });
      }

      // Active link highlighting using data-path
      const here = location.pathname.replace(/\/+$/, "") || "/";
      mount.querySelectorAll("[data-path]").forEach(a => {
        const want = a.getAttribute("data-path");
        if (want === here) a.classList.add("active");
      });
    })
    .catch(() => {
      // Fallback: if partial fails to load, do nothing (page still works)
    });
})();
/* END ANCHOR: Header Inject + Hamburger */
// START ANCHOR: Scroll Down JS
document.addEventListener("DOMContentLoaded", () => {
  const scrollBtn = document.querySelector(".scroll-down");
  if (scrollBtn) {
    scrollBtn.addEventListener("click", () => {
      const hero = document.querySelector(".hero");
      if (hero && hero.nextElementSibling) {
        hero.nextElementSibling.scrollIntoView({ behavior: "smooth" });
      }
    });
  }
});
// END ANCHOR: Scroll Down JS
