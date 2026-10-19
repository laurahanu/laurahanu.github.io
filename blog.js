// Search and pagination for the blog list. Without JS every post simply shows.
(() => {
    const PAGE_SIZE = 5;
    const list = document.getElementById('post-list');
    const posts = Array.from(list.querySelectorAll('.post'));
    const search = document.getElementById('blog-search');
    const empty = document.getElementById('post-empty');
    const pager = document.getElementById('pagination');
    let page = 1;

    function button(label, target, opts = {}) {
        const b = document.createElement('button');
        b.type = 'button';
        b.textContent = label;
        b.dataset.page = target;
        if (opts.current) b.setAttribute('aria-current', 'page');
        if (opts.disabled) b.disabled = true;
        if (opts.ariaLabel) b.setAttribute('aria-label', opts.ariaLabel);
        return b;
    }

    function render() {
        const q = search.value.trim().toLowerCase();
        const matches = posts.filter((p) => !q || p.textContent.toLowerCase().includes(q));
        const pages = Math.max(1, Math.ceil(matches.length / PAGE_SIZE));
        page = Math.min(page, pages);
        const shown = new Set(matches.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE));
        posts.forEach((p) => { p.hidden = !shown.has(p); });
        empty.hidden = matches.length > 0;

        pager.replaceChildren();
        if (pages < 2) return;
        pager.append(button('← newer', page - 1, { disabled: page === 1, ariaLabel: 'Newer posts' }));
        for (let i = 1; i <= pages; i++) pager.append(button(String(i), i, { current: i === page, ariaLabel: `Page ${i}` }));
        pager.append(button('older →', page + 1, { disabled: page === pages, ariaLabel: 'Older posts' }));
    }

    search.addEventListener('input', () => {
        page = 1;
        render();
    });
    pager.addEventListener('click', (e) => {
        const b = e.target.closest('button');
        if (!b || b.disabled) return;
        page = Number(b.dataset.page);
        render();
        list.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
    render();
})();
