/* =========================================================
   SITE-WIDE SCRIPT — shared by every page
   ========================================================= */

/* ---------- Header: glass effect once the page scrolls ---------- */
(function(){
    const header = document.getElementById("siteHeader");
    if(!header) return;

    function updateHeader(){
        header.classList.toggle("scrolled", window.scrollY > 25);
    }

    window.addEventListener("scroll", updateHeader, { passive:true });
    updateHeader();
})();


/* ---------- Mobile menu ---------- */
(function(){
    const toggle = document.querySelector(".menu-toggle");
    const menu = document.querySelector(".mobile-menu");
    if(!toggle || !menu) return;

    function setOpen(open){
        menu.classList.toggle("open", open);
        toggle.classList.toggle("active", open);
        toggle.setAttribute("aria-expanded", String(open));
        document.body.classList.toggle("menu-open", open);
    }

    toggle.addEventListener("click", function(){
        setOpen(!menu.classList.contains("open"));
    });
    menu.querySelectorAll("a").forEach(function(link){
        link.addEventListener("click", function(){ setOpen(false); });
    });
    document.addEventListener("keydown", function(event){
        if(event.key === "Escape") setOpen(false);
    });
})();


/* ---------- Inner pages: fade sections in once as they scroll into view ---------- */
(function(){
    const items = document.querySelectorAll("[data-reveal]");
    if(!items.length) return;

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if(reduceMotion || !("IntersectionObserver" in window)) return;

    document.documentElement.classList.add("pg-reveal-ready");
    const observer = new IntersectionObserver(function(entries){
        entries.forEach(function(entry){
            if(!entry.isIntersecting) return;
            entry.target.classList.add("is-visible");
            observer.unobserve(entry.target);
        });
    }, { threshold:0.12, rootMargin:"0px 0px -6% 0px" });
    items.forEach(function(item){ observer.observe(item); });
})();


/* ---------- "Read more" toggles: fold longer copy until it is asked for ---------- */
(function(){
    document.querySelectorAll(".pg-more").forEach(function(block){
        const button = block.querySelector(".pg-more-toggle");
        const body = block.querySelector(".pg-more-body");
        const label = button.querySelector(".pg-more-label");
        const moreText = label.textContent;
        const lessText = button.dataset.less || "Show less";

        function set(open){
            block.classList.toggle("is-open", open);
            button.setAttribute("aria-expanded", String(open));
            label.textContent = open ? lessText : moreText;
            body.inert = !open;
        }

        block.classList.add("is-ready");
        button.hidden = false;
        set(false);
        button.addEventListener("click", function(){
            set(!block.classList.contains("is-open"));
        });
    });
})();


/* ---------- Selected Work: looping testimonial carousel ----------
   A copy of every card sits on each side of the real ones, so the row
   can keep sliding in either direction and quietly jump back to the
   matching real card once a slide ends. Advances on its own every few
   seconds (paused on hover, focus, drag, a hidden tab or reduced motion). */
(function(){
    document.querySelectorAll("[data-carousel]").forEach(function(section){
        const viewport = section.querySelector(".pg-tm-viewport");
        const track = section.querySelector(".pg-tm-track");
        const originals = Array.from(track.children);
        const count = originals.length;
        const arrows = section.querySelectorAll(".pg-tm-arrow");
        const dotsBox = section.querySelector(".pg-tm-dots");
        const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        if(count < 2) return;

        function copy(card){
            const c = card.cloneNode(true);
            c.setAttribute("aria-hidden", "true");
            c.removeAttribute("aria-label");
            c.inert = true;
            return c;
        }
        originals.slice().reverse().forEach(function(card){ track.prepend(copy(card)); });
        originals.forEach(function(card){ track.append(copy(card)); });
        section.classList.add("is-loop");

        let index = count;      // first real card
        let moving = false;
        let dragX = 0;

        const dots = originals.map(function(_, i){
            const dot = document.createElement("button");
            dot.type = "button";
            dot.className = "pg-tm-dot";
            dot.setAttribute("aria-label", "Show testimonial " + (i + 1));
            dot.addEventListener("click", function(){ go(count + i); });
            dotsBox.appendChild(dot);
            return dot;
        });

        function step(){
            const gap = parseFloat(getComputedStyle(track).columnGap) || 0;
            return track.children[0].getBoundingClientRect().width + gap;
        }
        function render(animate){
            track.classList.toggle("is-animating", animate && !reduceMotion);
            track.style.transform = "translate3d(" + (dragX - index * step()) + "px,0,0)";
        }
        function current(){
            return ((index - count) % count + count) % count;
        }
        function markDots(){
            const active = current();
            dots.forEach(function(dot, i){
                dot.classList.toggle("is-active", i === active);
                dot.setAttribute("aria-current", i === active ? "true" : "false");
            });
        }
        // once a slide lands on a copy, jump (without animating) to the real card it mirrors
        function settle(){
            moving = false;
            if(index >= 2 * count || index < count){
                index = count + current();
                render(false);
            }
        }
        function go(target){
            if(moving) return;
            index = target;
            dragX = 0;
            markDots();
            if(reduceMotion){ render(false); settle(); return; }
            moving = true;
            render(true);
            clearTimeout(go.fallback);
            go.fallback = setTimeout(settle, 900);
        }
        track.addEventListener("transitionend", function(event){
            if(event.target === track && event.propertyName === "transform"){
                clearTimeout(go.fallback);
                settle();
            }
        });

        arrows.forEach(function(arrow){
            arrow.addEventListener("click", function(){ go(index + Number(arrow.dataset.dir)); });
        });

        /* swipe / drag */
        let startX = null;
        viewport.addEventListener("pointerdown", function(event){
            if(moving || event.button > 0) return;
            startX = event.clientX;
            track.classList.add("is-dragging");
            viewport.setPointerCapture(event.pointerId);
        });
        viewport.addEventListener("pointermove", function(event){
            if(startX === null) return;
            dragX = event.clientX - startX;
            render(false);
        });
        function endDrag(){
            if(startX === null) return;
            startX = null;
            track.classList.remove("is-dragging");
            const moved = dragX;
            dragX = 0;
            if(Math.abs(moved) > 50) go(index + (moved < 0 ? 1 : -1));
            else render(true);
        }
        viewport.addEventListener("pointerup", endDrag);
        viewport.addEventListener("pointercancel", endDrag);

        /* auto-advance */
        let paused = false;
        ["mouseenter", "focusin", "pointerdown"].forEach(function(type){
            section.addEventListener(type, function(){ paused = true; });
        });
        section.addEventListener("mouseleave", function(){ paused = false; });
        section.addEventListener("focusout", function(event){
            if(!section.contains(event.relatedTarget)) paused = false;
        });
        if(!reduceMotion){
            setInterval(function(){
                if(!paused && !document.hidden) go(index + 1);
            }, 6000);
        }

        window.addEventListener("resize", function(){ render(false); });
        window.addEventListener("load", function(){ render(false); });
        markDots();
        render(false);
    });
})();


/* ---------- Resources: hovering an essay title swaps the photo beside the list ---------- */
(function(){
    document.querySelectorAll("[data-reads]").forEach(function(section){
        const rows = section.querySelectorAll(".pg-index-item");
        const photos = section.querySelectorAll(".pg-reads-frame img");
        const count = section.querySelector(".pg-reads-count strong");

        function show(index){
            rows.forEach(function(row){ row.classList.toggle("is-active", row.dataset.index === index); });
            photos.forEach(function(photo){ photo.classList.toggle("is-active", photo.dataset.index === index); });
            if(count) count.textContent = String(Number(index) + 1).padStart(2, "0");
        }
        rows.forEach(function(row){
            row.addEventListener("mouseenter", function(){ show(row.dataset.index); });
        });
    });
})();


/* ---------- Contact form — sends via Web3Forms, emailed to Jill ---------- */
(function(){
    const form = document.getElementById("contactForm");
    if(!form) return;

    const status = form.querySelector(".contact-status");
    const button = form.querySelector(".contact-submit");
    const accessKey = form.querySelector('input[name="access_key"]').value;

    function setStatus(message, type){
        status.textContent = message;
        status.className = "contact-status" + (type ? " is-" + type : "");
    }

    /* Checkbox groups send several values under one name; join them so the
       email shows "Executive Advisory, Workshops and Retreats" on one line. */
    function collect(){
        const raw = new FormData(form);
        const merged = new FormData();
        new Set(raw.keys()).forEach(function(key){
            merged.append(key, raw.getAll(key).join(", "));
        });
        return merged;
    }

    form.addEventListener("submit", async function(event){
        event.preventDefault();

        if(!form.reportValidity()) return;

        if(!accessKey || accessKey.indexOf("YOUR_") === 0){
            setStatus("The form isn’t connected to an inbox yet.", "error");
            return;
        }

        button.disabled = true;
        setStatus("Sending…");

        try{
            const response = await fetch(form.action, {
                method:"POST",
                headers:{ "Accept":"application/json" },
                body:collect()
            });
            const result = await response.json();

            if(!response.ok || !result.success){
                throw new Error(result.message || "Request failed");
            }

            form.reset();
            setStatus("Thank you, your message has been sent. I’ll be in touch soon.", "success");
        }catch(error){
            setStatus("Something went wrong sending your message. Please try again in a moment.", "error");
        }finally{
            button.disabled = false;
        }
    });
})();


/* =========================================================
   HOMEPAGE-STYLE SECTION ANIMATIONS (moved from index.html so every
   page that uses these sections gets the same motion)
   ========================================================= */

/* =========================================================
   CENTRAL MESSAGE — ONE-TIME, OUTSIDE-IN SCROLL REVEAL
   Runs once only. Smooth entrance from outside the viewport.
   ========================================================= */
(function(){
    const message = document.querySelector('.home-message');
    if(!message) return;

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if(reduceMotion){
        message.classList.add('message-once-visible');
        return;
    }

    document.body.classList.remove('message-motion-ready');
    document.body.classList.add('message-once-ready');

    let hasRevealed = false;

    function revealOnce(){
        if(hasRevealed) return;
        hasRevealed = true;
        message.classList.add('message-once-visible');
    }

    const rect = message.getBoundingClientRect();
    const alreadyInView = rect.top < window.innerHeight * 0.9 && rect.bottom > window.innerHeight * 0.12;

    if(alreadyInView){
        requestAnimationFrame(function(){
            requestAnimationFrame(revealOnce);
        });
        return;
    }

    if('IntersectionObserver' in window){
        const observer = new IntersectionObserver(function(entries){
            const entry = entries[0];
            if(entry && entry.isIntersecting){
                revealOnce();
                observer.disconnect();
            }
        }, {
            threshold:0.18,
            rootMargin:'0px 0px -6% 0px'
        });

        observer.observe(message);
    } else {
        revealOnce();
    }
})();

/* =========================================================
   TWO STORY CARDS — ONE-TIME SCROLL ENTRANCE
   ========================================================= */
(function(){
    const cards = Array.from(document.querySelectorAll('.home-story-card'));
    if(!cards.length) return;

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if(reduceMotion || !('IntersectionObserver' in window)){
        cards.forEach(card => card.classList.add('story-card-visible'));
        return;
    }

    document.documentElement.classList.add('js-story-reveal');

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if(entry.isIntersecting){
                entry.target.classList.add('story-card-visible');
                observer.unobserve(entry.target);
            }
        });
    }, {
        threshold:0.18,
        rootMargin:'0px 0px -8% 0px'
    });

    cards.forEach(card => observer.observe(card));
})();

/* =========================================================
   WAYS TO WORK — REVEAL EACH PANEL ONCE FROM THE RIGHT
   ========================================================= */
(function(){
    const panels = Array.from(document.querySelectorAll('.home-services .service-feature-inner'));
    if(!panels.length) return;

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if(reduceMotion || !('IntersectionObserver' in window)){
        panels.forEach(panel => panel.classList.add('service-slide-visible'));
        return;
    }

    document.documentElement.classList.add('services-slide-ready');

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if(!entry.isIntersecting) return;

            entry.target.classList.add('service-slide-visible');
            observer.unobserve(entry.target);
        });
    }, {
        threshold:0.22,
        rootMargin:'0px 0px -7% 0px'
    });

    panels.forEach(panel => {
        const rect = panel.getBoundingClientRect();
        const alreadyVisible = rect.top < window.innerHeight * 0.92 && rect.bottom > 0;

        if(alreadyVisible){
            requestAnimationFrame(() => {
                requestAnimationFrame(() => panel.classList.add('service-slide-visible'));
            });
        } else {
            observer.observe(panel);
        }
    });
})();
