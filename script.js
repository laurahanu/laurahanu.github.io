(() => {
    const toggle = document.getElementById('darkModeToggle');

    function setTheme(dark) {
        document.body.classList.toggle('dark-mode', dark);
        const label = dark ? 'Switch to light mode' : 'Switch to dark mode';
        toggle.setAttribute('aria-label', label);
        toggle.title = label;
    }

    setTheme(localStorage.getItem('darkMode') === 'true');
    toggle.addEventListener('click', () => {
        const dark = !document.body.classList.contains('dark-mode');
        setTheme(dark);
        localStorage.setItem('darkMode', dark);
    });

    document.querySelector('.copyright-footer p').textContent = `© ${new Date().getFullYear()} Laura Hanu`;
})();
