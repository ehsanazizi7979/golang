// The cube logo used as the favicon and in the header, matching the icon in
// the book's screenshots (see figure 14 on page 56).
window.addEventListener('DOMContentLoaded', () => {
    // Highlight the active navigation item, exactly what ui/static/js/main.js
    // does in the book.
    const nav = document.querySelector('nav');
    if (!nav) return;
    const links = nav.querySelectorAll('a');
    for (const link of links) {
        if (link.pathname === window.location.pathname) {
            link.style.color = '#63BA36';
            link.style.fontWeight = 'bold';
        }
    }
});
