// Background trees: two asymmetric fractal trees drawn in shimmering dots, blue trunks fading through
// teal to green crowns, swaying in the wind and bending with the pointer, with the odd dot drifting down.
(() => {
    const STOPS = {
        light: [[86, 140, 196], [72, 165, 170], [104, 178, 108], [160, 188, 104], [226, 176, 98]],
        dark: [[120, 175, 235], [100, 205, 205], [160, 215, 145], [200, 225, 140], [250, 205, 130]],
    };
    const TREE_MAX = 11;
    const BANDS = 16;
    const POINTER_STRENGTH = 0.625;
    // Trees shrink (never grow) so the tallest crown stays in the bottom 60% of the window.
    const MAX_HEIGHT = 0.6;
    const isDark = () => document.body.classList.contains('dark-mode');
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const renderScale = () => (window.devicePixelRatio || 1) * (window.visualViewport?.scale || 1);

    function dot(ctx, x, y, size) {
        ctx.beginPath();
        ctx.arc(x, y, size / 2, 0, Math.PI * 2);
        ctx.fill();
    }

    function mixStops(stops, k) {
        k = Math.max(0, Math.min(1, k));
        const s = k * (stops.length - 1);
        const i = Math.min(Math.floor(s), stops.length - 2);
        const f = s - i, a = stops[i], b = stops[i + 1];
        return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f];
    }
    const rgba = (c, a) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`;
    // Colour position for a point at height y: trunk (0) to crown (1), with a little jitter so shades blend.
    const shade = (y, H) => ((1 - y / H) / MAX_HEIGHT) * 0.92 - 0.05 + (Math.random() - 0.5) * 0.25;

    function hash(n) {
        n = (n ^ 61) ^ (n >>> 16);
        n = n + (n << 3);
        n ^= n >>> 4;
        n = Math.imul(n, 0x27d4eb2d);
        n ^= n >>> 15;
        return (n >>> 0) / 4294967295;
    }

    const mouse = { x: 0.5, y: 0.5 };
    const parallax = { x: 0, y: 0 };
    const branches = Array.from({ length: TREE_MAX + 1 }, () => ({ x: 0.5, velocity: 0 }));
    window.addEventListener('pointermove', (e) => {
        mouse.x = Math.max(0, Math.min(1, e.clientX / window.innerWidth));
        mouse.y = Math.max(0, Math.min(1, e.clientY / window.innerHeight));
    }, { passive: true });

    function moveBranches(dt) {
        const ease = reduceMotion ? 1 : 1 - Math.exp(-3 * dt);
        parallax.x += ((reduceMotion ? 0 : (mouse.x - 0.5) * 24) - parallax.x) * ease;
        parallax.y += ((reduceMotion ? 0 : (mouse.y - 0.5) * 16) - parallax.y) * ease;
        // Damped springs: heavy limbs respond slowly, while fine twigs catch up sooner.
        // Small time steps keep the response consistent across different refresh rates.
        const steps = Math.max(1, Math.ceil(dt * 120));
        const step = dt / steps;
        branches.forEach((branch, depth) => {
            if (reduceMotion) {
                branch.x = mouse.x;
                branch.velocity = 0;
                return;
            }
            const frequency = 2.8 + depth * 0.4;
            for (let i = 0; i < steps; i++) {
                branch.velocity += ((mouse.x - branch.x) * frequency * frequency
                    - 1.3 * frequency * branch.velocity) * step;
                branch.x += branch.velocity * step;
            }
        });
    }

    function makeLayer() {
        const canvas = document.createElement('canvas');
        canvas.className = 'fractal-bg';
        canvas.setAttribute('aria-hidden', 'true');
        return { canvas, ctx: canvas.getContext('2d') };
    }
    // The trees fade a little each frame so the dots shimmer; falling dots go on their own layer,
    // cleared every frame, so they leave no trail.
    const trees = makeLayer(), drift = makeLayer();
    document.body.prepend(trees.canvas);
    trees.canvas.after(drift.canvas);
    const haze = document.createElement('div');
    haze.className = 'tree-haze';
    haze.setAttribute('aria-hidden', 'true');
    drift.canvas.after(haze);

    const segs = Array.from({ length: TREE_MAX + 1 }, () => []);
    const tips = [];
    const bands = Array.from({ length: BANDS }, () => []);
    // About one dot in ten is larger and fainter, giving the crowns a soft glow and some depth.
    const glow = Array.from({ length: BANDS }, () => []);
    const falling = [];
    let W, H, pixelRatio, fit = 1, fitted = false, last = null;

    // Wind: a gentle base sway, plus slow gusts that come and go. g(t) is near zero most of the time
    // and swells to 1 now and then; the cube keeps calm spells long and gusts brief.
    function gust(t) {
        const g = 0.5 + 0.5 * Math.sin(t * 0.21) * Math.sin(t * 0.077 + 1.7);
        return g * g * g;
    }
    const t0 = performance.now();
    let previousFrame = t0;

    function resize() {
        W = window.innerWidth;
        H = window.innerHeight;
        pixelRatio = renderScale();
        for (const { canvas, ctx } of [trees, drift]) {
            canvas.width = Math.round(W * pixelRatio);
            canvas.height = Math.round(H * pixelRatio);
            ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
        }
        fitted = false;
    }

    // Each fork has a leader that carries on longer and straighter and a shorter side branch that angles
    // out further, by a different amount at every fork, with the odd extra twig.
    function growTrees(t, calm = false) {
        const wide = W > 1000;
        const trunk = Math.min(H * 0.2, W * (wide ? 0.13 : 0.28));
        segs.forEach((s) => (s.length = 0));
        tips.length = 0;
        // A taller tree leaning in from the left, a smaller, wider one on the right.
        const plan = wide
            ? [{ x: W * 0.11, lean: 0.15, size: fit, spread: 1.0, seed: 11 },
                { x: W * 0.9, lean: -0.07, size: 0.82 * fit, spread: 1.15, seed: 2027 }]
            : [{ x: W / 2, lean: 0.04, size: 0.95 * fit, spread: 1, seed: 11 }];
        plan.forEach((tree, ti) => {
            // Gusts reach the left tree first and roll on to the right one a moment later.
            const g = calm ? 0 : gust(t - ti * 0.9);
            const sway = calm ? 0 : 0.006;
            const seed = tree.seed * 100003;
            const px = calm ? 0 : parallax.x, py = calm ? 0 : parallax.y;
            const grow = (x, y, len, ang, d, id, depth = 0) => {
                const fan = (0.42 + (branches[d].x - 0.5) * 0.4 * POINTER_STRENGTH) * tree.spread;
                ang += Math.sin(t * 1.2 - d * 0.45) * sway * d
                    // A gust leans the whole tree and sends a faster ripple up the branches,
                    + g * d * (0.004 + 0.004 * Math.sin(t * 2.6 - d * 0.6))
                    // while the twigs flutter on their own.
                    + (d > 6 ? Math.sin(t * 4.3 + id * 1.7) * 0.012 * g : 0);
                const x2 = x + Math.cos(ang) * len, y2 = y + Math.sin(ang) * len;
                // Neighbouring branches have gently varying depth; project shared joints together.
                // The trunk stays anchored, and the fitting pass ignores this small visual offset.
                const nextDepth = d === 0 ? 0 : Math.max(-1, Math.min(1, depth + (hash(id + seed + 17) - 0.5) * 0.28));
                segs[d].push(x + px * depth, y + py * depth, x2 + px * nextDepth, y2 + py * nextDepth);
                if (d >= TREE_MAX) { tips.push(x2 + px * nextDepth, y2 + py * nextDepth); return; }
                const r1 = hash(id * 2 + 1 + seed), r2 = hash(id * 2 + 2 + seed);
                const r3 = hash(id * 3 + 5 + seed), side = r3 < 0.5 ? -1 : 1;
                const bias = 0.15 + 0.55 * r1;
                const lead = 0.72 + 0.08 * r2, lateral = lead * (1 - bias * 0.45);
                grow(x2, y2, len * lead, ang + side * fan * (0.3 + 0.45 * (1 - bias)), d + 1, id * 2 + 1, nextDepth);
                // Side branches give up a level early, which keeps the crown open rather than clumped.
                grow(x2, y2, len * lateral, ang - side * fan * (0.8 + 0.5 * bias), Math.min(TREE_MAX, d + (bias > 0.45 ? 2 : 1)), id * 2 + 2, nextDepth);
                if (d >= 2 && d <= 8 && r3 > 0.84) {
                    grow(x2, y2, len * lateral * 0.75, ang + side * fan * 1.25, d + 2, id * 2 + 2 + 7919, nextDepth);
                }
            };
            grow(tree.x, H + 4, trunk * tree.size, -Math.PI / 2 + tree.lean, 0, 0);
        });
        return trunk;
    }

    function draw(t) {
        const dt = last === null ? 0 : Math.min(0.05, t - last);
        last = t;
        const ctx = trees.ctx, octx = drift.ctx;
        const dark = isDark();
        const stops = dark ? STOPS.dark : STOPS.light;
        // Light mode sits on a pale background, so the dots are a touch softer there.
        const alpha = dark ? 0.6 : 0.5;

        ctx.globalCompositeOperation = 'destination-out';
        // Fade the last frame so the dots shimmer. A strong fade matters: the canvas rounds alpha, and with
        // a gentle fade faint pixels get stuck (never reach zero), leaving a ghost wherever branches swayed.
        ctx.fillStyle = 'rgba(0,0,0,0.3)';
        ctx.fillRect(0, 0, W, H);
        ctx.globalCompositeOperation = 'source-over';

        // Size the trees from a windless version of them, so gusts bend the trees
        // without resizing them. Only the pointer (which changes how far branches spread) affects size.
        growTrees(t, true);
        let top = H;
        for (let i = 1; i < tips.length; i += 2) top = Math.min(top, tips[i]);
        const want = Math.min(1, (fit * MAX_HEIGHT * H) / Math.max(1, H - top + 6));
        // Shrink at once so the crowns never poke above the limit; grow back gently.
        // The first frame (or one after a resize) takes the fitted size directly.
        fit = !fitted || want < fit ? want : fit + (want - fit) * 0.05;
        fitted = true;
        const trunk = growTrees(t);

        bands.forEach((b) => (b.length = 0));
        glow.forEach((b) => (b.length = 0));
        const put = (x, y) => (Math.random() < 0.1 ? glow : bands)[Math.max(0, Math.min(BANDS - 1, (shade(y, H) * BANDS) | 0))].push(x, y);
        for (let d = 0; d <= TREE_MAX; d++) {
            const s = segs[d], w = Math.max(0.5, trunk * 0.09 * Math.pow(0.72, d));
            const density = 0.4 * Math.max(1, w * 0.6);
            for (let i = 0; i < s.length; i += 4) {
                const dx = s[i + 2] - s[i], dy = s[i + 3] - s[i + 1];
                const len = Math.hypot(dx, dy) || 1;
                const target = len * density;
                const n = (target | 0) + (Math.random() < target % 1 ? 1 : 0);
                for (let j = 0; j < n; j++) {
                    const u = Math.random(), v = (Math.random() + Math.random() - 1) * w * 1.1;
                    put(s[i] + dx * u - (dy / len) * v, s[i + 1] + dy * u + (dx / len) * v);
                }
            }
        }
        for (let i = 0; i < tips.length; i += 2) {
            for (let j = 0; j < 7; j++) {
                const a = Math.random() * Math.PI * 2, r = Math.random() * 6;
                put(tips[i] + Math.cos(a) * r, tips[i + 1] + Math.sin(a) * r);
            }
        }
        for (let b = 0; b < BANDS; b++) {
            const pts = bands[b];
            ctx.fillStyle = rgba(mixStops(stops, b / (BANDS - 1)), alpha);
            for (let i = 0; i < pts.length; i += 2) {
                const size = 1.1 + Math.random() * 0.8;
                dot(ctx, pts[i] + size / 2, pts[i + 1] + size / 2, size);
            }
            const big = glow[b];
            ctx.fillStyle = rgba(mixStops(stops, b / (BANDS - 1)), alpha * 0.4);
            for (let i = 0; i < big.length; i += 2) {
                const size = 2.4 + Math.random() * 1.4;
                dot(ctx, big[i], big[i + 1], size);
            }
        }

        // Now and then a dot lets go of a crown and flutters down, keeping the colour it had in the tree.
        octx.clearRect(0, 0, W, H);
        if (tips.length && falling.length < 25 && Math.random() < dt * 1.5) {
            const i = 2 * ((Math.random() * tips.length / 2) | 0);
            const vortex = Math.random() < 0.35 ? {
                start: t + 1.5 + Math.random() * 4,
                duration: 1.8 + Math.random() * 0.8,
                radius: 6 + Math.random() * 5,
                direction: Math.random() < 0.5 ? -1 : 1,
            } : null;
            falling.push({ x: tips[i], y: tips[i + 1], y0: tips[i + 1], vy: 0, phase: Math.random() * 10, size: 1.4 + Math.random() * 1.2, col: mixStops(stops, shade(tips[i + 1], H)), vortex });
        }
        for (let i = falling.length - 1; i >= 0; i--) {
            const f = falling[i];
            f.vy = Math.min(f.vy + 20 * dt, 16);
            f.x += (Math.sin(t * 1.1 + f.phase) * 14 + (branches[TREE_MAX].x - 0.5) * 30 * POINTER_STRENGTH) * dt;
            f.y += f.vy * dt;
            const fade = 1 - (f.y - f.y0) / (H - f.y0 + 1);
            if (fade <= 0) { falling.splice(i, 1); continue; }
            octx.fillStyle = rgba(f.col, alpha * Math.min(1, fade * 1.5));
            let x = f.x, y = f.y;
            if (f.vortex) {
                const progress = (t - f.vortex.start) / f.vortex.duration;
                if (progress > 0 && progress < 1) {
                    // A brief spiral fades in and out without a jump in the falling path.
                    const radius = f.vortex.radius * Math.sin(Math.PI * progress) ** 2;
                    const angle = f.phase + progress * Math.PI * 2 * f.vortex.direction;
                    x += Math.cos(angle) * radius;
                    y += Math.sin(angle) * radius;
                }
            }
            dot(octx, x + f.size / 2, y + f.size / 2, f.size);
        }
    }

    function frame(now) {
        // Track both browser zoom and pinch zoom, including changes without a window resize.
        if (pixelRatio !== renderScale()) resize();
        const dt = Math.min(0.05, Math.max(0, (now - previousFrame) / 1000));
        previousFrame = now;
        moveBranches(dt);
        draw(reduceMotion ? 12 : Math.max(0, now - t0) / 1000);
        requestAnimationFrame(frame);
    }

    window.addEventListener('resize', resize);
    resize();
    requestAnimationFrame(frame);
})();
