// Shared navigation behaviour injected into every page.
// Handles: scroll-hide, hamburger menu, profile dropdown, edit profile modal.
// Wrapped in an IIFE to avoid polluting the global scope with internal variables.

(function () {
  const nav        = document.getElementById('navbar');
  const hamburger  = document.getElementById('hamburger');
  const mobileMenu = document.getElementById('mobileMenu');

  // ── Scroll hide/show ────────────────────────────────────────────────────────
  // Hides the navbar when scrolling down, reveals it when scrolling up.
  // requestAnimationFrame batches scroll events for smooth performance
  // and avoids layout thrashing from too many repaints.
  let lastScrollY = window.scrollY;
  let ticking = false;

  window.addEventListener('scroll', () => {
    if (!ticking) {
      requestAnimationFrame(() => {
        const current = window.scrollY;
        // Only hide after 80px to prevent flickering near the top of the page
        if (current > lastScrollY && current > 80) {
          nav.classList.add('hidden');
          hamburger?.classList.remove('open');
          mobileMenu?.classList.remove('open');
          closeProfileMenu();
        } else {
          nav.classList.remove('hidden');
        }
        lastScrollY = current;
        ticking = false;
      });
      ticking = true;
    }
  });

  // ── Hamburger menu toggle ───────────────────────────────────────────────────
  // Visible only on mobile (≤640px via CSS). Toggles the full-screen mobile menu.
  window.toggleMenu = function () {
    hamburger.classList.toggle('open');
    mobileMenu.classList.toggle('open');
  };

  // Automatically close the mobile menu when the user navigates to another page
  mobileMenu?.querySelectorAll('a').forEach(link => {
    link.addEventListener('click', () => {
      hamburger.classList.remove('open');
      mobileMenu.classList.remove('open');
    });
  });

  // ── User avatar ─────────────────────────────────────────────────────────────
  // Display the first letter of the username as the avatar initial.
  // Session.get() reads from localStorage — no API call needed here.
  const user = Session.get();
  if (user) {
    const initial = user.username.charAt(0).toUpperCase();
    const avatar  = document.getElementById('navAvatar');
    if (avatar) {
      avatar.textContent = initial;
      avatar.title = user.username;
    }
    // Mirror the initial and full username into the dropdown header
    const miniAvatar = document.getElementById('dropdownAvatar');
    const dropName   = document.getElementById('dropdownName');
    if (miniAvatar) miniAvatar.textContent = initial;
    if (dropName)   dropName.textContent   = user.username;
  }

  // ── Profile dropdown ────────────────────────────────────────────────────────
  window.toggleProfileMenu = function (e) {
    e?.stopPropagation(); // Prevent the document click listener from immediately closing it
    document.getElementById('profileDropdown')?.classList.toggle('open');
  };

  function closeProfileMenu() {
    document.getElementById('profileDropdown')?.classList.remove('open');
  }

  // Close dropdown when clicking anywhere outside the profile button
  document.addEventListener('click', (e) => {
    const dropdown = document.getElementById('profileDropdown');
    const profile  = document.getElementById('navProfile');
    if (dropdown?.classList.contains('open') && !profile?.contains(e.target)) {
      closeProfileMenu();
    }
    // Also close the mobile menu when clicking outside the navbar
    if (mobileMenu?.classList.contains('open') && !nav.contains(e.target)) {
      hamburger.classList.remove('open');
      mobileMenu.classList.remove('open');
    }
  });

  // ── Edit profile modal ──────────────────────────────────────────────────────
  // The modal is created once and injected into the DOM dynamically,
  // so it doesn't need to be duplicated in every HTML file.
  const modal = document.createElement('div');
  modal.className = 'profile-modal-overlay';
  modal.id = 'profileModal';
  modal.innerHTML = `
    <div class="profile-modal-box">
      <h3>✏️ Edit Profile</h3>
      <div class="form-group">
        <label>Height (cm)</label>
        <input type="number" id="editHeight" placeholder="e.g. 175"/>
      </div>
      <div class="form-group">
        <label>Weight (kg)</label>
        <input type="number" id="editWeight" placeholder="e.g. 70"/>
      </div>
      <div id="profileSaveAlert" class="alert"></div>
      <div class="profile-modal-actions">
        <button class="btn btn-green" onclick="saveProfileEdit()">Save Changes</button>
        <button class="btn btn-outline" onclick="closeEditProfile()">Cancel</button>
      </div>
      <hr style="border:none;border-top:1px solid var(--border);margin:1.2rem 0 1rem"/>
      <button class="btn btn-red" style="width:100%" onclick="document.getElementById('deleteConfirmWrap').style.display='block'">🗑️ Delete Account</button>
      <div id="deleteConfirmWrap" style="display:none;margin-top:0.8rem;text-align:center;font-size:0.85rem;color:var(--red)">
        Are you sure? This cannot be undone.
        <div style="display:flex;gap:0.5rem;margin-top:0.6rem;justify-content:center">
          <button class="btn btn-red btn-sm" onclick="confirmDeleteAccount()">Yes, delete</button>
          <button class="btn btn-outline btn-sm" onclick="document.getElementById('deleteConfirmWrap').style.display='none'">No, keep it</button>
        </div>
      </div>
    </div>`;
  document.body.appendChild(modal);

  // Close modal when clicking the dark overlay background
  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeEditProfile();
  });

  // Open the edit profile modal and reset its state each time
  window.openEditProfile = function () {
    closeProfileMenu();
    const u = Session.get();
    document.getElementById('editHeight').value = u?.height || '';
    document.getElementById('editWeight').value = u?.weight || '';
    document.getElementById('profileSaveAlert').className = 'alert';
    // Always hide the delete confirmation on open to prevent accidental deletions
    document.getElementById('deleteConfirmWrap').style.display = 'none';
    document.getElementById('profileModal').classList.add('open');
  };

  window.closeEditProfile = function () {
    document.getElementById('profileModal').classList.remove('open');
  };

  // ── Delete account ──────────────────────────────────────────────────────────
  // Calls the backend to delete the user row (which cascades to meals),
  // then clears the local session and redirects to the login page.
  window.confirmDeleteAccount = async function () {
    const u = Session.get();
    if (!u) return;

    try {
      await API.deleteAccount(u.username);
    } catch (err) {
      console.error('Delete account error:', err.message);
    }

    Session.clear();
    window.location.href = '/index.html';
  };

  // ── Save profile edits ──────────────────────────────────────────────────────
  window.saveProfileEdit = async function () {
    const height  = document.getElementById('editHeight').value.trim();
    const weight  = document.getElementById('editWeight').value.trim();
    const alertEl = document.getElementById('profileSaveAlert');

    if (!height || !weight) {
      alertEl.textContent = 'Please fill in both fields';
      alertEl.className   = 'alert alert-error show';
      return;
    }

    // Validate numeric ranges — height max 272cm (tallest recorded human),
    // weight min 20kg to prevent accidental near-zero entries
    if (isNaN(height) || height < 50 || height > 272) {
      alertEl.textContent = 'Height must be a number between 50 and 272 cm';
      alertEl.className   = 'alert alert-error show';
      return;
    }

    if (isNaN(weight) || weight < 20 || weight > 500) {
      alertEl.textContent = 'Weight must be a number between 20 and 500 kg';
      alertEl.className   = 'alert alert-error show';
      return;
    }

    const u = Session.get();
    try {
      // Send updated values to the backend and refresh the session with the response
      const data = await API.updateProfile(u.username, { height, weight });
      Session.save({ ...u, ...data.user });

      alertEl.textContent = '✓ Profile updated!';
      alertEl.className   = 'alert alert-success show';
      // Auto-close the modal after a short delay so the user sees the confirmation
      setTimeout(() => window.closeEditProfile(), 1200);
    } catch (err) {
      alertEl.textContent = err.message;
      alertEl.className   = 'alert alert-error show';
    }
  };

})();
