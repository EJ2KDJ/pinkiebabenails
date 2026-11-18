// Promotions are optional. The panel remains hidden when the endpoint has no active offers.
(async function loadPromos() {
    const section = document.getElementById('monthly-promos');
    const list = document.getElementById('promos-list');
    if (!section || !list) return;

    try {
        const response = await fetch('/api/promos', { headers: { Accept: 'application/json' } });
        if (!response.ok) return;
        const data = await response.json();
        if (!Array.isArray(data.promos)) return;

        const today = new Date();
        const promos = data.promos.filter((promo) =>
            promo && typeof promo.title === 'string' && promo.title.trim() &&
            (!promo.endsOn || (Number.isFinite(Date.parse(promo.endsOn)) && new Date(promo.endsOn + (promo.endsOn.length === 10 ? 'T23:59:59' : '')) >= today))
        );
        if (!promos.length) return;

        for (const promo of promos) {
            const card = document.createElement('article');
            card.className = 'promo-card';
            if (promo.imageUrl && typeof promo.imageUrl === 'string') {
                const image = document.createElement('img');
                try {
                    const target = new URL(promo.imageUrl, window.location.origin);
                    if (!['http:', 'https:'].includes(target.protocol)) throw new Error('Invalid image');
                    image.src = target.href;
                    image.alt = promo.title;
                    image.loading = 'lazy';
                    card.appendChild(image);
                } catch (_) { /* Ignore invalid promo imagery. */ }
            }
            const heading = document.createElement('h4');
            heading.textContent = promo.title;
            card.appendChild(heading);
            if (promo.description) {
                const description = document.createElement('p');
                description.textContent = String(promo.description);
                card.appendChild(description);
            }
            if (promo.endsOn) {
                const date = new Date(promo.endsOn + (promo.endsOn.length === 10 ? 'T12:00:00' : ''));
                if (!Number.isNaN(date.getTime())) {
                    const end = document.createElement('small');
                    end.textContent = 'Until ' + date.toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' });
                    card.appendChild(end);
                }
            }
            list.appendChild(card);
        }
        section.hidden = list.children.length === 0;
    } catch (error) {
        console.warn('Promotions unavailable:', error);
    }
})();
