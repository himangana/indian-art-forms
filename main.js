const paintings = window.paintings || [];
const catalog = window.datasetCatalog || { states: [] };
const descriptions = window.artFormDescriptions || {};

const stateSelect = document.querySelector("#state-select");
const artSelect = document.querySelector("#artform-select");
const artDetail = document.querySelector("#artform-detail");
const datasetGallery = document.querySelector("#dataset-gallery");
const imageDetail = document.querySelector("#image-detail");
const mapSelection = document.querySelector("#map-selection");
const mapStage = document.querySelector("#map-stage");
const mapArtTooltip = document.querySelector("#map-art-tooltip");
let tooltipHideTimer;
// Later copies verified as byte-identical to an image already listed elsewhere.
const duplicateImagePaths = new Set([
  "mizoram/bamboo%20craft/01-puanchei.jpg",
  "jharkhand/sohrai/009.jpg",
  "sikkim/thangka/004.jpg"
]);
let currentGalleryImages = [];
let currentGalleryIndex = 0;

const escapeHtml = (value = "") => String(value).replace(/[&<>"']/g, (char) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
}[char]));
const pretty = (value = "") => String(value).replaceAll("_", " ");
const normalizeRegion = (value) => String(value).toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]/g, "");
const getDescription = (state, art) => descriptions[state]?.[art] || null;
// Cleaning helpers: metadata arrives as HTML and Commons-style file names.
const plain = (html = "") => new DOMParser().parseFromString(String(html), "text/html").body.textContent.replace(/\s+/g, " ").trim();
const cleanTitle = (t = "") => String(t).replace(/^File:/i, "").replace(/\.(jpe?g|png|webp|gif|tiff?)$/i, "").replace(/_/g, " ").trim();
const cleanSummary = (t = "") => String(t).replace(/\s*In this archive[\s\S]*$/, "").trim();
const cleanRegion = (t = "") => String(t).replace(/\s*\(dataset folder association[^)]*\)\.?/i, "").trim();
const isPlaceholder = (t = "") => /^(To be documented|No specific history|Requires community)/.test(String(t));
// This is a painting site: leave out crafts/sculpture and empty folders. Edit the pattern to change.
const nonPainting = /sculpt|craft|weaving|shawl|textile|carving|puanchei/i;
catalog.states = catalog.states
  .map((s) => ({ ...s, artForms: s.artForms.filter((a) => !nonPainting.test(a.name) && a.images.length) }))
  .filter((s) => s.artForms.length);

function stateForMapLabel(label) {
  const key = normalizeRegion(label);
  const aliases = {
    andamanandnicobarislands: "Andaman_Nicobar",
    dadraandnagarhavelianddamananddiu: "Dadra_Nagar_Haveli_Daman_Diu",
    jammuandkashmir: "Jammu_Kashmir"
  };
  const alias = aliases[key];
  if (alias && catalog.states.some((state) => state.name === alias)) return alias;
  return catalog.states.find((state) => normalizeRegion(pretty(state.name)) === key)?.name || null;
}

function paintingForCollection(stateName, artName) {
  const stateKey = normalizeRegion(pretty(stateName));
  const artKey = normalizeRegion(pretty(artName));
  return paintings.find((painting) => {
    const paintingState = catalog.states.find((state) => normalizeRegion(pretty(state.name)) === normalizeRegion(painting.state));
    if (!paintingState || paintingState.name !== stateName) return false;
    if (painting.id === "pattachitra") return artKey.includes("pattachitra");
    if (painting.id === "tanjore") return artKey.includes("tanjore") || artKey.includes("thanjavur");
    return normalizeRegion(painting.title).includes(artKey) && stateKey === normalizeRegion(painting.state);
  }) || null;
}

function featuredArtForRegion(stateName) {
  const painting = paintings.find((entry) => normalizeRegion(entry.state) === normalizeRegion(pretty(stateName)));
  if (painting?.id === "pattachitra") return "Pattachitra";
  if (painting?.id === "tanjore") return "Tanjore";
  return "";
}

function artFormsForRegion(stateName) {
  const state = catalog.states.find((entry) => entry.name === stateName);
  return state?.artForms.map((art) => pretty(art.name)).join(", ") || "No art forms listed";
}

function positionArtTooltip(target, event) {
  if (!mapStage || !mapArtTooltip) return;
  const stageRect = mapStage.getBoundingClientRect();
  const targetRect = target.getBoundingClientRect();
  const pointerX = Number.isFinite(event?.clientX) ? event.clientX : targetRect.left + targetRect.width / 2;
  const pointerY = Number.isFinite(event?.clientY) ? event.clientY : targetRect.top + targetRect.height / 2;
  const gap = 14;
  let left = pointerX - stageRect.left + gap;
  let top = pointerY - stageRect.top + gap;
  const width = mapArtTooltip.offsetWidth;
  const height = mapArtTooltip.offsetHeight;
  if (left + width > stageRect.width - 8) left = pointerX - stageRect.left - width - gap;
  if (top + height > stageRect.height - 8) top = pointerY - stageRect.top - height - gap;
  left = Math.max(8, Math.min(left, stageRect.width - width - 8));
  top = Math.max(8, Math.min(top, stageRect.height - height - 8));
  mapArtTooltip.style.left = `${left}px`;
  mapArtTooltip.style.top = `${top}px`;
}

function showRegionArtForms(stateName, target, event) {
  if (mapSelection) {
    mapSelection.classList.add("is-hovered");
    mapSelection.textContent = `${pretty(stateName)} · Art forms: ${artFormsForRegion(stateName)}`;
  }
  if (!mapArtTooltip) return;
  clearTimeout(tooltipHideTimer);
  const state = catalog.states.find((entry) => entry.name === stateName);
  const forms = state?.artForms.map((art) => pretty(art.name)) || [];
  mapArtTooltip.innerHTML = `
    <div class="map-art-tooltip__top"><span class="map-art-tooltip__seal" aria-hidden="true">✦</span><span class="map-art-tooltip__eyebrow">Regional collection</span></div>
    <h4 class="map-art-tooltip__title">${escapeHtml(pretty(stateName))}</h4>
    <p class="map-art-tooltip__label">Painting traditions</p>
    <ul class="map-art-tooltip__forms">${forms.map((form) => `<li>${escapeHtml(form)}</li>`).join("") || "<li>Art forms coming soon</li>"}</ul>
    <p class="map-art-tooltip__action"><span aria-hidden="true">↘</span> Click to explore this collection</p>`;
  mapArtTooltip.hidden = false;
  positionArtTooltip(target, event);
  requestAnimationFrame(() => mapArtTooltip.classList.add("is-visible"));
}

function hideArtTooltip() {
  if (!mapArtTooltip) return;
  mapArtTooltip.classList.remove("is-visible");
  clearTimeout(tooltipHideTimer);
  tooltipHideTimer = setTimeout(() => { mapArtTooltip.hidden = true; }, 180);
}

function selectRegion(stateName) {
  if (!catalog.states.some((state) => state.name === stateName)) return;
  hideArtTooltip();
  stateSelect.value = stateName;
  renderArtOptions(featuredArtForRegion(stateName));
  const controls = stateSelect.closest(".dataset-controls");
  controls?.scrollIntoView({ behavior: "smooth", block: "start" });
  stateSelect.focus({ preventScroll: true });
}

function findPinAnchor(shape) {
  const box = shape.getBBox();
  const center = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  if (typeof shape.isPointInFill !== "function" || typeof shape.ownerSVGElement?.createSVGPoint !== "function") return center;
  const svg = shape.ownerSVGElement;
  try {
    const svgPoint = svg.createSVGPoint();
    const isInside = (x, y) => {
      svgPoint.x = x;
      svgPoint.y = y;
      return shape.isPointInFill(svgPoint);
    };
    if (isInside(center.x, center.y)) return center;
    let nearest = null;
    let nearestDistance = Infinity;
    const divisions = 18;
    for (let row = 0; row < divisions; row += 1) {
      for (let column = 0; column < divisions; column += 1) {
        const x = box.x + box.width * (column + .5) / divisions;
        const y = box.y + box.height * (row + .5) / divisions;
        if (!isInside(x, y)) continue;
        const distance = (x - center.x) ** 2 + (y - center.y) ** 2;
        if (distance < nearestDistance) {
          nearest = { x, y };
          nearestDistance = distance;
        }
      }
    }
    return nearest || center;
  } catch {
    return center;
  }
}

function renderRegionPins() {
  const svg = document.querySelector(".india-map");
  if (!svg) return;
  svg.querySelector(".state-pin-layer")?.remove();
  const layer = document.createElementNS("http://www.w3.org/2000/svg", "g");
  layer.setAttribute("class", "state-pin-layer");
  layer.setAttribute("aria-label", "Clickable State and Union Territory collection pins");
  document.querySelectorAll(".india-map .state[data-state-name]").forEach((shape) => {
    const stateName = shape.dataset.stateName;
    const anchor = findPinAnchor(shape);
    const marker = document.createElementNS("http://www.w3.org/2000/svg", "g");
    marker.setAttribute("class", "state-map-pin");
    marker.setAttribute("transform", `translate(${anchor.x} ${anchor.y})`);
    marker.setAttribute("role", "button");
    marker.setAttribute("tabindex", "0");
    marker.setAttribute("aria-controls", "state-select dataset-gallery");
    const regionInfo = `${pretty(stateName)} · Art forms: ${artFormsForRegion(stateName)}`;
    marker.setAttribute("aria-label", `${regionInfo} — click to browse paintings`);
    marker.dataset.stateName = stateName;
    marker.innerHTML = '<circle class="state-pin-hit" r="7"/><path class="state-pin-shape" d="M0 6.8C-.8 5.4-4.7.6-4.7-2.1a4.7 4.7 0 1 1 9.4 0C4.7.6.8 5.4 0 6.8Z"/><circle class="state-pin-center" cy="-2.1" r="1.35"/>';
    const chooseRegion = () => selectRegion(stateName);
    marker.addEventListener("pointerenter", (event) => showRegionArtForms(stateName, marker, event));
    marker.addEventListener("pointermove", (event) => positionArtTooltip(marker, event));
    marker.addEventListener("pointerleave", () => { hideArtTooltip(); updateMapSelection(); });
    marker.addEventListener("focus", () => showRegionArtForms(stateName, marker));
    marker.addEventListener("blur", () => { hideArtTooltip(); updateMapSelection(); });
    marker.addEventListener("click", chooseRegion);
    marker.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        chooseRegion();
      }
    });
    layer.append(marker);
  });
  svg.append(layer);
}

function updateMapSelection() {
  const selectedName = stateSelect.value;
  const selected = catalog.states.find((state) => state.name === selectedName);
  document.querySelectorAll(".india-map .state").forEach((shape) => {
    const mappedName = shape.dataset.stateName || stateForMapLabel(shape.getAttribute("aria-label") || "");
    const isSelected = mappedName === selectedName;
    shape.classList.toggle("selected", isSelected);
    shape.setAttribute("aria-pressed", String(isSelected));
  });
  document.querySelectorAll(".india-map .state-map-pin").forEach((pin) => {
    const isSelected = pin.dataset.stateName === selectedName;
    pin.classList.toggle("selected", isSelected);
    pin.setAttribute("aria-pressed", String(isSelected));
  });
  if (mapSelection && selected) {
    const artName = artSelect.value;
    mapSelection.classList.remove("is-hovered");
    mapSelection.textContent = `Selected: ${pretty(selected.name)}${artName ? ` · ${pretty(artName)}` : ""}`;
  }
}

function setupInteractiveMap() {
  document.querySelectorAll(".india-map .state").forEach((shape, index) => {
    const label = shape.getAttribute("aria-label") || "";
    const name = stateForMapLabel(label);
    if (!name) {
      shape.setAttribute("aria-disabled", "true");
      return;
    }
    shape.dataset.stateName = name;
    shape.classList.add(`palette-${index % 6}`);
    shape.setAttribute("tabindex", "-1"); // pins are the keyboard/screen-reader targets
    shape.setAttribute("aria-hidden", "true");
    shape.setAttribute("aria-label", `${pretty(name)} · Art forms: ${artFormsForRegion(name)} — click to browse paintings`);
    shape.querySelector("title")?.remove();
    shape.addEventListener("pointerenter", (event) => showRegionArtForms(name, shape, event));
    shape.addEventListener("pointermove", (event) => positionArtTooltip(shape, event));
    shape.addEventListener("pointerleave", () => { hideArtTooltip(); updateMapSelection(); });
    shape.addEventListener("focus", () => showRegionArtForms(name, shape));
    shape.addEventListener("blur", () => { hideArtTooltip(); updateMapSelection(); });
    const chooseRegion = () => {
      selectRegion(name);
    };
    shape.addEventListener("click", chooseRegion);
    shape.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        chooseRegion();
      }
    });
  });
}

function renderStateOptions() {
  stateSelect.innerHTML = catalog.states.map((state) => `<option value="${escapeHtml(state.name)}">${escapeHtml(pretty(state.name))}</option>`).join("");
  const initialState = catalog.states.find((state) => state.name === "Tamil_Nadu") || catalog.states[0];
  if (initialState) {
    stateSelect.value = initialState.name;
    renderArtOptions(initialState.name === "Tamil_Nadu" ? "Tanjore" : "");
  }
}

function renderArtOptions(preferredName = "") {
  const state = catalog.states.find((entry) => entry.name === stateSelect.value);
  if (!state) return;
  artSelect.innerHTML = state.artForms.map((art) => `<option value="${escapeHtml(art.name)}">${escapeHtml(pretty(art.name))}</option>`).join("");
  const preferred = state.artForms.find((art) => normalizeRegion(pretty(art.name)) === normalizeRegion(pretty(preferredName)));
  if (preferred) artSelect.value = preferred.name;
  renderArtForm();
  updateMapSelection();
}

function featuredImage(painting) {
  if (!painting) return null;
  return {
    file: "Featured photograph",
    src: painting.image,
    featured: true,
    metadata: {
      title: `${painting.title} · Featured photograph`,
      description: "A featured photograph of this tradition.",
      state: painting.state,
      art_form: painting.title
    }
  };
}

function renderArtForm() {
  const stateName = stateSelect.value;
  const state = catalog.states.find((entry) => entry.name === stateName);
  const art = state?.artForms.find((entry) => entry.name === artSelect.value);
  if (!art) return;
  const info = getDescription(stateName, art.name);
  const ownerImage = featuredImage(paintingForCollection(stateName, art.name));
  const images = ownerImage ? [ownerImage, ...art.images] : art.images;
  currentGalleryImages = images.filter((image) => {
    const imagePath = String(image.src || "").toLowerCase();
    return ![...duplicateImagePaths].some((duplicatePath) => imagePath.endsWith(duplicatePath));
  });
  currentGalleryIndex = 0;
  imageDetail.hidden = true;
  imageDetail.innerHTML = "";
  const sourceLinks = (info?.sources || []).map((source, index) => `<a href="${escapeHtml(source)}" target="_blank" rel="noopener noreferrer">Source ${index + 1}<span class="sr-only"> (opens in a new tab)</span></a>`).join(" · ");
  artDetail.innerHTML = `
    <div class="artform-heading"><p class="eyebrow">${escapeHtml(pretty(stateName))}</p><h3>${escapeHtml(pretty(art.name))}</h3></div>
    ${info ? `<p class="artform-summary">${escapeHtml(cleanSummary(info.description))}</p>
      <div class="artform-facts">
        ${[
          ["History &amp; region", `${info.region ? `<strong>${escapeHtml(cleanRegion(info.region))}</strong><br>` : ""}${escapeHtml(info.history)}`, info.history],
          ["Visual characteristics", escapeHtml(info.characteristics), info.characteristics],
          ["Themes &amp; motifs", escapeHtml(info.themes), info.themes],
          ["Materials &amp; technique", escapeHtml(info.materials_technique), info.materials_technique],
          ["Cultural significance", escapeHtml(info.cultural_significance), info.cultural_significance]
        ].filter(([, , raw]) => !isPlaceholder(raw)).map(([h, body]) => `<section><h4>${h}</h4><p>${body}</p></section>`).join("")}
      </div>
      <p class="artform-sources"><strong>Research sources:</strong> ${sourceLinks || "No source links recorded."}</p>
      ${info.manual_review ? `<p class="review-note">This is a broad category, so these notes stay general rather than tying it to one origin.</p>` : ""}`
      : `<p class="artform-summary">No art-form description is available for this folder yet.</p>`}`;
  datasetGallery.innerHTML = "";
  if (!currentGalleryImages.length) {
    datasetGallery.innerHTML = '<p class="dataset-gallery-empty">No images are available for this art form yet.</p>';
    return;
  }
  renderGalleryDeck();
}

function renderGalleryDeck() {
  const image = currentGalleryImages[currentGalleryIndex];
  if (!image) return;
  const meta = image.metadata || {};
  const label = cleanTitle(meta.title) || `${pretty(artSelect.value)} painting`;
  const credit = [plain(meta.artist), plain(meta.license)].filter(Boolean).join(" · ");
  const fallback = /^https?:\/\//i.test(meta.image_url || "") ? meta.image_url : "";
  datasetGallery.innerHTML = `
    <div class="image-deck" aria-label="Painting image deck">
      <button class="deck-arrow" type="button" data-gallery-prev aria-label="Previous image"${currentGalleryIndex === 0 ? " disabled" : ""}><span aria-hidden="true">←</span></button>
      <button class="dataset-image${image.featured ? " is-featured" : ""}" type="button" data-image-index="${currentGalleryIndex}" aria-label="View image information: ${escapeHtml(label)}">
        <span class="dataset-image-frame"><img src="${escapeHtml(image.src)}"${fallback ? ` data-fallback-src="${escapeHtml(fallback)}"` : ""} alt="${escapeHtml(label)}"><span class="magnifier" aria-hidden="true"></span>${image.featured ? `<span class="featured-ribbon">Featured</span>` : ""}</span>
        <span class="dataset-image-caption">${escapeHtml(label)}</span>
        ${credit ? `<span class="dataset-image-credit">${escapeHtml(credit)}</span>` : ""}
      </button>
      <button class="deck-arrow" type="button" data-gallery-next aria-label="Next image"${currentGalleryIndex >= currentGalleryImages.length - 1 ? " disabled" : ""}><span aria-hidden="true">→</span></button>
    </div>
    <p class="deck-meta"><span>${currentGalleryIndex + 1} / ${currentGalleryImages.length}</span><span class="hint-desktop">Hover to magnify · ← → to browse</span><span class="hint-touch">Swipe to browse · tap for details</span></p>`;
  datasetGallery.querySelector("img")?.addEventListener("error", (event) => {
    const img = event.currentTarget;
    const fb = img.dataset.fallbackSrc;
    if (fb && !img.dataset.fallbackTried) { img.dataset.fallbackTried = "true"; img.src = fb; return; }
    img.closest(".dataset-image")?.classList.add("image-unavailable");
  });
  setupMagnifier();
}

// Wow factor: a round loupe that magnifies the painting under the pointer.
function setupMagnifier() {
  const frame = datasetGallery.querySelector(".dataset-image-frame");
  const img = frame?.querySelector("img");
  const lens = frame?.querySelector(".magnifier");
  if (!frame || !img || !lens) return;
  const zoom = 2.6, size = 150;
  frame.addEventListener("pointermove", (e) => {
    if (e.pointerType === "touch" || !img.naturalWidth) return;
    const r = frame.getBoundingClientRect();
    const x = e.clientX - r.left, y = e.clientY - r.top;
    const s = Math.min(r.width / img.naturalWidth, r.height / img.naturalHeight); // gallery uses object-fit: contain
    const rw = img.naturalWidth * s, rh = img.naturalHeight * s;
    const ox = (r.width - rw) / 2, oy = (r.height - rh) / 2;
    if (x < ox || x > ox + rw || y < oy || y > oy + rh) { lens.classList.remove("is-on"); return; }
    lens.style.backgroundImage = `url("${img.currentSrc || img.src}")`;
    lens.style.backgroundSize = `${rw * zoom}px ${rh * zoom}px`;
    lens.style.backgroundPosition = `${size / 2 - (x - ox) * zoom}px ${size / 2 - (y - oy) * zoom}px`;
    lens.style.left = `${x - size / 2}px`;
    lens.style.top = `${y - size / 2}px`;
    lens.classList.add("is-on");
  });
  frame.addEventListener("pointerleave", () => lens.classList.remove("is-on"));
}

function showImageMetadata(index) {
  const state = catalog.states.find((entry) => entry.name === stateSelect.value);
  const art = state?.artForms.find((entry) => entry.name === artSelect.value);
  if (!art) return;
  const image = currentGalleryImages[index];
  if (!image) return;
  const meta = image.metadata || {};
  const title = cleanTitle(meta.title) || image.file;
  const rows = [
    ["Artist / creator", plain(meta.artist)], ["Description", plain(meta.description)], ["License", plain(meta.license)],
    ["Dimensions", meta.width && meta.height ? `${meta.width} × ${meta.height}` : ""],
    ["File", image.file], ["State or Union Territory", pretty(state.name)], ["Art form", pretty(art.name)]
  ].filter(([, value]) => value);
  const source = meta.source_url ? `<a href="${escapeHtml(meta.source_url)}" target="_blank" rel="noopener noreferrer">Open image source record</a>` : "Source record not listed in the supplied metadata.";
  imageDetail.hidden = false;
  imageDetail.innerHTML = `<div><p class="eyebrow">Image information</p><h4>${escapeHtml(title)}</h4><dl>${rows.map(([term, value]) => `<div><dt>${escapeHtml(term)}</dt><dd>${escapeHtml(value)}</dd></div>`).join("")}</dl><p class="artform-sources">${source}</p></div>`;
  imageDetail.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

setupInteractiveMap();
renderRegionPins();
renderStateOptions();
stateSelect.addEventListener("change", () => renderArtOptions());
artSelect.addEventListener("change", () => {
  renderArtForm();
  updateMapSelection();
});
datasetGallery.addEventListener("click", (event) => {
  if (event.target.closest("[data-gallery-prev]")) {
    currentGalleryIndex = Math.max(0, currentGalleryIndex - 1);
    renderGalleryDeck();
    (datasetGallery.querySelector("[data-gallery-prev]:not(:disabled)") || datasetGallery.querySelector(".dataset-image"))?.focus();
    return;
  }
  if (event.target.closest("[data-gallery-next]")) {
    currentGalleryIndex = Math.min(currentGalleryImages.length - 1, currentGalleryIndex + 1);
    renderGalleryDeck();
    (datasetGallery.querySelector("[data-gallery-next]:not(:disabled)") || datasetGallery.querySelector(".dataset-image"))?.focus();
    return;
  }
  const card = event.target.closest("[data-image-index]");
  if (card) showImageMetadata(Number(card.dataset.imageIndex));
});

// Keyboard and swipe browsing
const stepGallery = (delta) => {
  const next = Math.min(currentGalleryImages.length - 1, Math.max(0, currentGalleryIndex + delta));
  if (next === currentGalleryIndex) return false;
  currentGalleryIndex = next;
  renderGalleryDeck();
  return true;
};
datasetGallery.addEventListener("keydown", (e) => {
  if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
  if (stepGallery(e.key === "ArrowRight" ? 1 : -1)) datasetGallery.querySelector(".dataset-image")?.focus();
});
let touchStartX = null;
datasetGallery.addEventListener("touchstart", (e) => { touchStartX = e.touches[0].clientX; }, { passive: true });
datasetGallery.addEventListener("touchend", (e) => {
  if (touchStartX === null) return;
  const dx = e.changedTouches[0].clientX - touchStartX;
  touchStartX = null;
  if (Math.abs(dx) > 50) stepGallery(dx < 0 ? 1 : -1);
}, { passive: true });
