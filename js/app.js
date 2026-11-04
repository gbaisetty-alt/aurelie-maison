(() => {
  "use strict";

  const products = window.AURELIE_PRODUCTS || [];
  const $ = (sel, ctx = document) => ctx.querySelector(sel);
  const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
  const priceFmt = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0
  });

  const formatPrice = (value) => priceFmt.format(value);
  const byId = (id) => products.find((product) => product.id === id);
  const escapeHtml = (value = "") =>
    String(value).replace(/[&<>"']/g, (char) => (
      { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]
    ));

  /* ---------- Cart ---------- */
  const CART_KEY = "aurelie-cart-v1";
  let cart = loadCart();

  function loadCart() {
    try {
      const saved = JSON.parse(localStorage.getItem(CART_KEY));
      if (!Array.isArray(saved)) return [];
      return saved
        .filter((item) => item && byId(item.id) && Number.isFinite(item.qty) && item.qty > 0)
        .map((item) => ({
          id: item.id,
          size: typeof item.size === "string" ? item.size : byId(item.id).sizes[0],
          qty: Math.min(Math.floor(item.qty), 99)
        }));
    } catch (error) {
      return [];
    }
  }

  function saveCart() {
    try {
      localStorage.setItem(CART_KEY, JSON.stringify(cart));
    } catch (error) {
      /* Storage may be unavailable; the bag still works for this session. */
    }
  }

  const cartDrawer = $("#cart-drawer");
  const cartItemsEl = $("#cart-items");
  const cartFoot = $("#cart-foot");

  function renderCart() {
    const count = cart.reduce((sum, item) => sum + item.qty, 0);
    $$("[data-cart-count]").forEach((el) => {
      el.textContent = String(count);
    });

    if (!cartItemsEl) return;

    if (!cart.length) {
      cartItemsEl.innerHTML = `
        <div class="cart-empty">
          <p class="cart-empty__title">Your bag is empty.</p>
          <p>Pieces are made in considered numbers.<br>Begin with the collection.</p>
          <a class="btn" href="collection.html"><span>Explore the collection</span></a>
        </div>`;
      if (cartFoot) cartFoot.hidden = true;
      return;
    }

    if (cartFoot) cartFoot.hidden = false;
    cartItemsEl.innerHTML = "";

    cart.forEach((item) => {
      const product = byId(item.id);
      if (!product) return;
      const row = document.createElement("div");
      row.className = "cart-item";
      row.innerHTML = `
        <img class="cart-item__img" src="${product.image}" alt="${escapeHtml(product.alt)}" width="84" height="105" loading="lazy">
        <div class="cart-item__info">
          <div class="cart-item__top">
            <div>
              <p class="cart-item__name">${escapeHtml(product.name)}</p>
              <p class="cart-item__meta">${escapeHtml(product.category)} · ${escapeHtml(item.size)}</p>
            </div>
            <p class="cart-item__price">${formatPrice(product.price * item.qty)}</p>
          </div>
          <div class="cart-item__bottom">
            <div class="qty" role="group" aria-label="Quantity for ${escapeHtml(product.name)}">
              <button type="button" data-qty="-1" aria-label="Decrease quantity">−</button>
              <span>${item.qty}</span>
              <button type="button" data-qty="1" aria-label="Increase quantity">+</button>
            </div>
            <button type="button" class="cart-remove" data-remove>Remove</button>
          </div>
        </div>`;

      $$("[data-qty]", row).forEach((button) => {
        button.addEventListener("click", () => {
          changeQty(item.id, item.size, Number(button.dataset.qty));
        });
      });
      $("[data-remove]", row).addEventListener("click", () => {
        removeFromCart(item.id, item.size);
      });

      cartItemsEl.appendChild(row);
    });

    const subtotal = cart.reduce((sum, item) => {
      const product = byId(item.id);
      return product ? sum + product.price * item.qty : sum;
    }, 0);
    $$("[data-cart-subtotal]").forEach((el) => {
      el.textContent = formatPrice(subtotal);
    });
  }

  function addToCart(id, size) {
    const product = byId(id);
    if (!product) return;
    const chosenSize = size || product.sizes[0];
    const existing = cart.find((item) => item.id === id && item.size === chosenSize);
    if (existing) {
      existing.qty = Math.min(existing.qty + 1, 99);
    } else {
      cart.push({ id, size: chosenSize, qty: 1 });
    }
    saveCart();
    renderCart();
  }

  function changeQty(id, size, delta) {
    const item = cart.find((entry) => entry.id === id && entry.size === size);
    if (!item) return;
    item.qty = Math.min(Math.max(item.qty + delta, 0), 99);
    if (item.qty === 0) {
      cart = cart.filter((entry) => entry !== item);
    }
    saveCart();
    renderCart();
  }

  function removeFromCart(id, size) {
    cart = cart.filter((item) => !(item.id === id && item.size === size));
    saveCart();
    renderCart();
  }

  /* ---------- Overlays ---------- */
  const menuOverlay = $("#mobile-menu");
  const searchOverlay = $("#search");
  const modalOverlay = $("#product-modal");
  const menuToggle = $("[data-menu-open]");
  const overlayOrder = [modalOverlay, cartDrawer, searchOverlay, menuOverlay].filter(Boolean);
  let lastFocused = null;

  function activeOverlay() {
    return overlayOrder.find((overlay) => overlay.classList.contains("is-open"));
  }

  function syncScrollLock() {
    const anyOpen = Boolean(activeOverlay());
    document.documentElement.classList.toggle("is-locked", anyOpen);
  }

  function openOverlay(overlay, focusTarget) {
    if (!overlay) return;
    lastFocused = document.activeElement;
    overlay.classList.add("is-open");
    overlay.removeAttribute("inert");
    overlay.setAttribute("aria-hidden", "false");
    if (overlay === menuOverlay && menuToggle) menuToggle.setAttribute("aria-expanded", "true");
    syncScrollLock();
    const target = focusTarget || overlay.querySelector("button, a[href], input");
    if (target) {
      window.setTimeout(() => target.focus({ preventScroll: true }), 150);
    }
  }

  function closeOverlay(overlay) {
    if (!overlay) return;
    overlay.classList.remove("is-open");
    overlay.setAttribute("aria-hidden", "true");
    overlay.setAttribute("inert", "");
    if (overlay === menuOverlay && menuToggle) menuToggle.setAttribute("aria-expanded", "false");
    syncScrollLock();
    if (lastFocused && document.contains(lastFocused)) {
      lastFocused.focus({ preventScroll: true });
    }
    lastFocused = null;
  }

  function trapFocus(event, overlay) {
    const focusable = $$('a[href], button:not([disabled]), input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])', overlay)
      .filter((el) => el.getClientRects().length > 0);
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  document.addEventListener("keydown", (event) => {
    const overlay = activeOverlay();
    if (!overlay) return;
    if (event.key === "Escape") {
      event.preventDefault();
      closeOverlay(overlay);
    } else if (event.key === "Tab") {
      trapFocus(event, overlay);
    }
  });

  $$("[data-cart-open]").forEach((button) => {
    button.addEventListener("click", () => {
      openOverlay(cartDrawer, $(".drawer__head .icon-btn", cartDrawer));
    });
  });
  $$("[data-cart-close]").forEach((button) => {
    button.addEventListener("click", () => closeOverlay(cartDrawer));
  });

  $$("[data-search-open]").forEach((button) => {
    button.addEventListener("click", () => {
      const input = $("#search-input");
      if (input) input.value = "";
      renderSearch("");
      openOverlay(searchOverlay, input);
    });
  });
  $$("[data-search-close]").forEach((button) => {
    button.addEventListener("click", () => closeOverlay(searchOverlay));
  });

  if (menuToggle) {
    menuToggle.addEventListener("click", () => {
      openOverlay(menuOverlay, $("[data-menu-close]", menuOverlay));
    });
  }
  $$("[data-menu-close]").forEach((button) => {
    button.addEventListener("click", () => closeOverlay(menuOverlay));
  });
  $$("#mobile-menu a").forEach((link) => {
    link.addEventListener("click", () => closeOverlay(menuOverlay));
  });

  $$("[data-modal-close]").forEach((button) => {
    button.addEventListener("click", () => closeOverlay(modalOverlay));
  });

  /* ---------- Toast ---------- */
  const toast = $("#toast");
  let toastTimer = null;

  function showToast(message) {
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add("is-visible");
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => toast.classList.remove("is-visible"), 3400);
  }

  $$("[data-checkout]").forEach((button) => {
    button.addEventListener("click", () => {
      showToast("Checkout is not connected in this concept storefront.");
    });
  });

  /* ---------- Product cards ---------- */
  function productCard(product, index, animate) {
    const card = document.createElement("article");
    card.className = "product";
    if (animate) {
      card.classList.add("product-card-enter");
      card.style.setProperty("--d", String(Math.min(index, 8)));
    }
    card.innerHTML = `
      <button class="product__media" type="button" data-quickview="${product.id}"
        aria-label="View ${escapeHtml(product.name)}, ${escapeHtml(product.subtitle)}">
        <img src="${product.image}" alt="${escapeHtml(product.alt)}" width="1024" height="1280" loading="lazy">
        ${product.tag ? `<span class="product__tag">${escapeHtml(product.tag)}</span>` : ""}
        <span class="product__action">Quick view</span>
      </button>
      <div class="product__meta">
        <div>
          <p class="product__cat">${escapeHtml(product.category)}</p>
          <h3 class="product__name">${escapeHtml(product.name)}</h3>
        </div>
        <p class="product__price">${formatPrice(product.price)}</p>
      </div>`;
    return card;
  }

  const newArrivalsGrid = $("#new-arrivals");
  if (newArrivalsGrid) {
    products.slice(0, 4).forEach((product, index) => {
      newArrivalsGrid.appendChild(productCard(product, index, true));
    });
  }

  const collectionGrid = $("#collection-grid");
  let currentFilter = "All";
  let currentSort = "featured";

  function renderCollection() {
    if (!collectionGrid) return;
    let list = products.filter((product) => currentFilter === "All" || product.category === currentFilter);
    if (currentSort === "price-asc") list = list.slice().sort((a, b) => a.price - b.price);
    if (currentSort === "price-desc") list = list.slice().sort((a, b) => b.price - a.price);

    collectionGrid.innerHTML = "";
    list.forEach((product, index) => {
      collectionGrid.appendChild(productCard(product, index, true));
    });

    $$("[data-results-count]").forEach((el) => {
      el.textContent = `${list.length} ${list.length === 1 ? "piece" : "pieces"}`;
    });
  }

  $$(".filter").forEach((button) => {
    button.addEventListener("click", () => {
      $$(".filter").forEach((other) => {
        const isCurrent = other === button;
        other.classList.toggle("is-active", isCurrent);
        other.setAttribute("aria-pressed", String(isCurrent));
      });
      currentFilter = button.dataset.filter;
      renderCollection();
    });
  });

  const sortSelect = $("#sort");
  if (sortSelect) {
    sortSelect.addEventListener("change", () => {
      currentSort = sortSelect.value;
      renderCollection();
    });
  }

  if (collectionGrid) renderCollection();

  /* ---------- Quick view ---------- */
  let activeProduct = null;
  let activeSize = null;

  function renderSizes() {
    const sizesEl = $("#modal-sizes");
    if (!sizesEl || !activeProduct) return;
    sizesEl.innerHTML = "";
    activeProduct.sizes.forEach((size) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "size";
      button.textContent = size;
      button.setAttribute("aria-pressed", String(size === activeSize));
      if (size === activeSize) button.classList.add("is-selected");
      button.addEventListener("click", () => {
        activeSize = size;
        $$(".size", sizesEl).forEach((other) => {
          const selected = other === button;
          other.classList.toggle("is-selected", selected);
          other.setAttribute("aria-pressed", String(selected));
        });
      });
      sizesEl.appendChild(button);
    });
  }

  function openProduct(id) {
    const product = byId(id);
    if (!product) return;
    activeProduct = product;
    activeSize = product.sizes[0];

    $("#modal-image").src = product.image;
    $("#modal-image").alt = product.alt;
    $("#modal-category").textContent = product.category;
    $("#modal-name").textContent = product.name;
    $("#modal-subtitle").textContent = product.subtitle;
    $("#modal-price").textContent = formatPrice(product.price);
    $("#modal-desc").textContent = product.description;
    renderSizes();

    if (searchOverlay && searchOverlay.classList.contains("is-open")) {
      closeOverlay(searchOverlay);
    }
    openOverlay(modalOverlay, $(".modal__close", modalOverlay));
  }

  document.addEventListener("click", (event) => {
    const trigger = event.target.closest("[data-quickview]");
    if (!trigger) return;
    event.preventDefault();
    openProduct(trigger.dataset.quickview);
  });

  const modalAdd = $("#modal-add");
  if (modalAdd) {
    modalAdd.addEventListener("click", () => {
      if (!activeProduct) return;
      addToCart(activeProduct.id, activeSize);
      closeOverlay(modalOverlay);
      openOverlay(cartDrawer, $(".drawer__head .icon-btn", cartDrawer));
    });
  }

  /* ---------- Search ---------- */
  const searchInput = $("#search-input");
  const searchResults = $("#search-results");

  function renderSearch(query) {
    if (!searchResults) return;
    const term = query.trim().toLowerCase();

    if (!term) {
      const suggestions = ["Silk", "Coat", "Leather", "Gold"];
      searchResults.innerHTML = `
        <p class="search__hint">Suggested</p>
        <div class="search__chips">
          ${suggestions.map((word) => `<button type="button" class="search__chip" data-suggestion="${word}">${word}</button>`).join("")}
        </div>`;
      $$("[data-suggestion]", searchResults).forEach((chip) => {
        chip.addEventListener("click", () => {
          if (!searchInput) return;
          searchInput.value = chip.dataset.suggestion;
          renderSearch(searchInput.value);
          searchInput.focus();
        });
      });
      return;
    }

    const matches = products.filter((product) =>
      [product.name, product.subtitle, product.category, product.description]
        .join(" ")
        .toLowerCase()
        .includes(term)
    );

    if (!matches.length) {
      searchResults.innerHTML = `<p class="search__empty">No pieces found for “${escapeHtml(query.trim())}”. Try “silk”, “wool” or “leather”.</p>`;
      return;
    }

    searchResults.innerHTML = `<p class="search__group-label">${matches.length} ${matches.length === 1 ? "piece" : "pieces"}</p>`;

    matches.forEach((product) => {
      const result = document.createElement("button");
      result.type = "button";
      result.className = "search-result";
      result.dataset.quickview = product.id;
      result.innerHTML = `
        <img src="${product.image}" alt="" width="68" height="85" loading="lazy">
        <span>
          <span class="search-result__name">${escapeHtml(product.name)}</span>
          <span class="search-result__cat">${escapeHtml(product.category)} — ${escapeHtml(product.subtitle)}</span>
        </span>
        <span class="search-result__price">${formatPrice(product.price)}</span>`;
      searchResults.appendChild(result);
    });
  }

  if (searchInput) {
    searchInput.addEventListener("input", () => renderSearch(searchInput.value));
  }

  /* ---------- Lookbook slider ---------- */
  const lookbookTrack = $("#lookbook-track");
  if (lookbookTrack) {
    const prev = $("[data-lookbook-prev]");
    const next = $("[data-lookbook-next]");

    const step = () => {
      const first = lookbookTrack.querySelector(".look");
      if (!first) return lookbookTrack.clientWidth * 0.7;
      const gap = parseFloat(getComputedStyle(lookbookTrack).columnGap || "0") || 0;
      return first.getBoundingClientRect().width + gap;
    };

    const updateNav = () => {
      if (!prev || !next) return;
      prev.disabled = lookbookTrack.scrollLeft <= 4;
      next.disabled = lookbookTrack.scrollLeft >= lookbookTrack.scrollWidth - lookbookTrack.clientWidth - 4;
    };

    const scrollByCard = (direction) => {
      lookbookTrack.scrollBy({
        left: step() * direction,
        behavior: reducedMotion ? "auto" : "smooth"
      });
    };

    if (prev) prev.addEventListener("click", () => scrollByCard(-1));
    if (next) next.addEventListener("click", () => scrollByCard(1));
    lookbookTrack.addEventListener("scroll", () => window.requestAnimationFrame(updateNav), { passive: true });
    window.addEventListener("resize", updateNav);
    updateNav();
  }

  /* ---------- Newsletter ---------- */
  const newsletterForm = $("[data-newsletter]");
  if (newsletterForm) {
    newsletterForm.addEventListener("submit", (event) => {
      event.preventDefault();
      const input = $("input[type='email']", newsletterForm);
      const status = $("[data-newsletter-status]");
      const email = input ? input.value.trim() : "";
      const valid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

      if (!status) return;
      if (!valid) {
        status.textContent = "Please enter a valid email address.";
        status.classList.remove("is-success");
        if (input) input.focus();
        return;
      }
      status.textContent = "Thank you. You are on the list — à bientôt.";
      status.classList.add("is-success");
      newsletterForm.reset();
    });
  }

  /* ---------- Header, parallax ---------- */
  const header = $("#header");
  const parallaxImage = $("[data-parallax]");
  let scrollTicking = false;

  function updateOnScroll() {
    if (header) header.classList.toggle("is-scrolled", window.scrollY > 8);

    if (parallaxImage && !reducedMotion) {
      const rect = parallaxImage.parentElement.getBoundingClientRect();
      if (rect.bottom > 0 && rect.top < window.innerHeight) {
        const progress = (rect.top + rect.height / 2 - window.innerHeight / 2) / window.innerHeight;
        const shift = progress * -44;
        parallaxImage.style.transform = `translate3d(0, ${shift.toFixed(2)}px, 0)`;
      }
    }
    scrollTicking = false;
  }

  window.addEventListener("scroll", () => {
    if (!scrollTicking) {
      scrollTicking = true;
      window.requestAnimationFrame(updateOnScroll);
    }
  }, { passive: true });

  window.addEventListener("resize", () => {
    if (!scrollTicking) {
      scrollTicking = true;
      window.requestAnimationFrame(updateOnScroll);
    }
  });

  updateOnScroll();

  /* ---------- Reveal on scroll ---------- */
  const revealEls = $$(".reveal");
  if ("IntersectionObserver" in window && !reducedMotion) {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-in");
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12, rootMargin: "0px 0px -6% 0px" });
    revealEls.forEach((el) => observer.observe(el));
  } else {
    revealEls.forEach((el) => el.classList.add("is-in"));
  }

  /* ---------- Loader ---------- */
  const loader = $("#loader");
  let loaderDone = false;

  function finishLoader() {
    if (loaderDone) return;
    loaderDone = true;
    document.documentElement.classList.add("is-ready");
    if (loader) {
      window.setTimeout(() => loader.classList.add("is-done"), 200);
    }
  }

  if (reducedMotion) {
    finishLoader();
  } else {
    if (document.readyState === "complete") {
      window.setTimeout(finishLoader, 650);
    } else {
      window.addEventListener("load", () => window.setTimeout(finishLoader, 450));
    }
    window.setTimeout(finishLoader, 2600);
  }

  /* ---------- Custom cursor ---------- */
  const cursor = $("#cursor");
  if (cursor && finePointer && !reducedMotion) {
    document.documentElement.classList.add("has-cursor");
    let targetX = 0;
    let targetY = 0;
    let currentX = 0;
    let currentY = 0;
    let shown = false;

    window.addEventListener("pointermove", (event) => {
      targetX = event.clientX;
      targetY = event.clientY;
      if (!shown) {
        currentX = targetX;
        currentY = targetY;
        shown = true;
        cursor.classList.add("is-visible");
      }
    }, { passive: true });

    document.addEventListener("pointerover", (event) => {
      const interactive = event.target.closest("a, button, .look, [data-cursor]");
      cursor.classList.toggle("is-hover", Boolean(interactive));
    });

    document.addEventListener("mouseleave", () => {
      cursor.classList.remove("is-visible");
    });

    document.addEventListener("mouseenter", () => {
      if (shown) cursor.classList.add("is-visible");
    });

    const follow = () => {
      currentX += (targetX - currentX) * 0.2;
      currentY += (targetY - currentY) * 0.2;
      cursor.style.transform = `translate3d(${currentX}px, ${currentY}px, 0) translate(-50%, -50%)`;
      window.requestAnimationFrame(follow);
    };
    follow();
  }

  /* ---------- Init ---------- */
  renderCart();
  renderSearch("");
})();
