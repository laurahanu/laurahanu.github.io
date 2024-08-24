const darkModeToggle = document.getElementById('darkModeToggle');
const body = document.body;

darkModeToggle.addEventListener('click', () => {
    body.classList.toggle('dark-mode');
    // Optionally, save the user's preference in localStorage
    localStorage.setItem('darkMode', body.classList.contains('dark-mode'));
});

// Check for saved dark mode preference on page load
if (localStorage.getItem('darkMode') === 'true') {
    body.classList.add('dark-mode');
}

const keywords = [
    "computer vision",
    "NLP",
    "multi-modal",
    "video understanding",
    "generative models",
    "llms",
    "distributed systems",
];

let currentKeywordIndex = 0;
const keywordDisplay = document.getElementById('keyword-display');

function changeKeyword() {
    keywordDisplay.style.opacity = 0;

    setTimeout(() => {
        keywordDisplay.textContent = keywords[currentKeywordIndex];
        keywordDisplay.style.opacity = 1;

        currentKeywordIndex = (currentKeywordIndex + 1) % keywords.length;
    }, 500);
}
changeKeyword();
setInterval(changeKeyword, 2000);

document.addEventListener('DOMContentLoaded', function () {
    const yearSpan = document.querySelector('.copyright-footer p');
    const currentYear = new Date().getFullYear();
    yearSpan.innerHTML = `&copy; ${currentYear} Laura Hanu`;
});