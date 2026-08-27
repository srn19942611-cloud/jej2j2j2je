(function () {
  "use strict";

  const STORAGE_KEY = "dk-car-import-calc-v1";

  const ids = [
    "make", "model", "year", "km", "co2", "mobileUrl",
    "priceEur", "fxRate", "extraDeCost",
    "dkMarketPrice", "expectedSalePct",
    "bracketThreshold", "lowRate", "highRate", "deduction",
    "co2Band1", "co2Band2", "co2Band3", "manualTaxOverride",
    "transport", "toldsyn", "plates", "recon", "sellingCost", "buffer"
  ];

  const el = {};
  ids.forEach((id) => (el[id] = document.getElementById(id)));

  const fmtDKK = (n) =>
    (isFinite(n) ? n : 0).toLocaleString("da-DK", { maximumFractionDigits: 0 }) + " kr";
  const fmtPct = (n) => (isFinite(n) ? n : 0).toLocaleString("da-DK", { maximumFractionDigits: 1 }) + " %";

  function num(id, fallback = 0) {
    const v = parseFloat(el[id].value);
    return isNaN(v) ? fallback : v;
  }

  function co2Surcharge(g) {
    const band1 = num("co2Band1", 294);
    const band2 = num("co2Band2", 587);
    const band3 = num("co2Band3", 1115);
    if (!g || g <= 0) return 0;
    const t1 = Math.min(g, 107);
    const t2 = Math.max(Math.min(g, 137) - 107, 0);
    const t3 = Math.max(g - 137, 0);
    return t1 * band1 + t2 * band2 + t3 * band3;
  }

  function taxFromValue(V, co2Add) {
    const threshold = num("bracketThreshold", 71500);
    const low = num("lowRate", 25) / 100;
    const high = num("highRate", 150) / 100;
    const ded = num("deduction", 25000);
    const base = low * Math.min(V, threshold) + high * Math.max(V - threshold, 0);
    return Math.max(base + co2Add - ded, 0);
  }

  function reverseSolveTax(P, co2Add) {
    const threshold = num("bracketThreshold", 71500);
    const low = num("lowRate", 25) / 100;
    const high = num("highRate", 150) / 100;
    const ded = num("deduction", 25000);

    if (!P || P <= 0) return { V: 0, tax: 0 };

    let V = (P - co2Add + ded) / (1 + low);
    let tax = taxFromValue(Math.max(V, 0), co2Add);

    if (V > threshold || V < 0) {
      const thresholdTaxPart = low * threshold - high * threshold;
      V = (P - co2Add + ded - thresholdTaxPart) / (1 + high);
      tax = taxFromValue(Math.max(V, 0), co2Add);
    }

    if (V < 0) {
      V = P;
      tax = 0;
    }

    return { V: Math.max(V, 0), tax: Math.max(tax, 0) };
  }

  function renderTaxBreakdown() {
    const P = num("dkMarketPrice", 0);
    const g = num("co2", 0);
    const co2Add = co2Surcharge(g);
    const { V, tax: computedTax } = reverseSolveTax(P, co2Add);

    const manual = el.manualTaxOverride.value.trim();
    const useManual = manual !== "" && !isNaN(parseFloat(manual));
    const tax = useManual ? parseFloat(manual) : computedTax;

    const rows = [
      ["Bilbasen-pris (dansk værdi, inkl. afgift)", fmtDKK(P)],
      ["Anslået bilværdi ekskl. afgift", fmtDKK(V)],
      ["CO2-tillæg (" + (g || 0) + " g/km)", fmtDKK(co2Add)],
      ["Bundfradrag", "&minus;" + fmtDKK(num("deduction", 25000))],
    ];

    let html = '<table class="breakdown-table">';
    rows.forEach(([k, v]) => {
      html += `<tr><td>${k}</td><td>${v}</td></tr>`;
    });
    html += `<tr class="total"><td>${useManual ? "Registreringsafgift (manuel)" : "Registreringsafgift (beregnet)"}</td><td>${fmtDKK(tax)}</td></tr>`;
    html += "</table>";
    document.getElementById("taxBreakdown").innerHTML = html;

    return tax;
  }

  function slug(s) {
    return (s || "")
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9æøå ]/g, "")
      .replace(/\s+/g, "-");
  }

  function bilbasenUrlFor(make, model) {
    let url = "https://www.bilbasen.dk/brugt/bil";
    if (make) {
      url += "/" + slug(make);
      if (model) url += "/" + slug(model);
    }
    return url;
  }

  function updateLinks() {
    const make = el.make.value.trim();
    const model = el.model.value.trim();
    document.getElementById("openMobile").href = "https://www.mobile.de/";
    document.getElementById("openBilbasen").href = bilbasenUrlFor(make, model);
  }

  // Best-effort split of a free-text query like "BMW 320d 2019" into make/model/year.
  // A trailing 4-digit token (19xx/20xx) is treated as the year; the first remaining
  // word is the make, the rest is the model.
  function parseSearchQuery(query) {
    const tokens = query.trim().split(/\s+/).filter(Boolean);
    let year = "";
    if (tokens.length && /^(19|20)\d{2}$/.test(tokens[tokens.length - 1])) {
      year = tokens.pop();
    }
    const make = tokens.shift() || "";
    const model = tokens.join(" ");
    return { make, model, year };
  }

  // Parses a price pasted straight from a listing ("15.700 €", "kr. 239.995,-", "€15700")
  // using German/Danish number formatting (. = thousands, , = decimal).
  function parseMoneyPaste(raw) {
    let s = (raw || "").replace(/[^0-9.,-]/g, "");
    if (!s) return null;
    s = s.replace(/\./g, "").replace(/,/g, ".");
    const val = parseFloat(s);
    return isNaN(val) ? null : Math.round(val);
  }

  function wireMoneyPaste(id) {
    el[id].addEventListener("paste", (e) => {
      const raw = (e.clipboardData || window.clipboardData).getData("text");
      const val = parseMoneyPaste(raw);
      if (val === null) return;
      e.preventDefault();
      el[id].value = val;
      calcAll();
    });
  }

  function showToast(msg) {
    const t = document.getElementById("toast");
    t.textContent = msg;
    t.classList.add("show");
    setTimeout(() => t.classList.remove("show"), 1800);
  }

  function calcAll() {
    const tax = renderTaxBreakdown();

    const priceEur = num("priceEur", 0);
    const fx = num("fxRate", 7.46);
    const extraDeEur = num("extraDeCost", 0);
    const purchaseDKK = (priceEur + extraDeEur) * fx;

    const transport = num("transport", 0);
    const toldsyn = num("toldsyn", 0);
    const plates = num("plates", 0);
    const recon = num("recon", 0);
    const sellingCost = num("sellingCost", 0);
    const bufferPct = num("buffer", 0) / 100;

    const subtotal = purchaseDKK + tax + transport + toldsyn + plates + recon + sellingCost;
    const buffer = subtotal * bufferPct;
    const totalCost = subtotal + buffer;

    const marketPrice = num("dkMarketPrice", 0);
    const salePct = num("expectedSalePct", 95) / 100;
    const salePrice = marketPrice * salePct;

    const profit = salePrice - totalCost;
    const margin = salePrice > 0 ? (profit / salePrice) * 100 : 0;
    const roi = totalCost > 0 ? (profit / totalCost) * 100 : 0;
    const breakeven = totalCost;

    document.getElementById("resTotalCost").textContent = fmtDKK(totalCost);
    document.getElementById("resSalePrice").textContent = fmtDKK(salePrice);
    document.getElementById("resProfit").textContent = fmtDKK(profit);
    document.getElementById("resMargin").textContent = fmtPct(margin);
    document.getElementById("resRoi").textContent = fmtPct(roi);
    document.getElementById("resBreakeven").textContent = fmtDKK(breakeven);

    const table = document.getElementById("costTable");
    const rows = [
      ["Købspris (DE, omregnet)", fmtDKK(purchaseDKK)],
      ["Registreringsafgift", fmtDKK(tax)],
      ["Transport", fmtDKK(transport)],
      ["Toldsyn", fmtDKK(toldsyn)],
      ["Nummerplader/indreg.", fmtDKK(plates)],
      ["Klargøring", fmtDKK(recon)],
      ["Salgsomkostninger", fmtDKK(sellingCost)],
      ["Buffer (" + num("buffer", 0) + "%)", fmtDKK(buffer)],
    ];
    let html = "";
    rows.forEach(([k, v]) => (html += `<tr><td>${k}</td><td>${v}</td></tr>`));
    html += `<tr class="total"><td>Total investering</td><td>${fmtDKK(totalCost)}</td></tr>`;
    table.innerHTML = html;

    const box = document.getElementById("verdictBox");
    const text = document.getElementById("verdictText");
    const sub = document.getElementById("verdictSub");
    box.classList.remove("good", "warn", "bad");

    if (!marketPrice || !purchaseDKK) {
      box.classList.add("warn");
      text.textContent = "Udfyld pris & Bilbasen-værdi";
      sub.textContent = "Indtast tysk pris og dansk markedsværdi for at se resultatet";
    } else if (margin >= 12) {
      box.classList.add("good");
      text.textContent = "God forretning";
      sub.textContent = `Forventet fortjeneste ${fmtDKK(profit)} (${fmtPct(margin)} margin)`;
    } else if (margin >= 0) {
      box.classList.add("warn");
      text.textContent = "Marginal / risikabel";
      sub.textContent = `Kun ${fmtPct(margin)} margin — lille buffer til fejlskøn`;
    } else {
      box.classList.add("bad");
      text.textContent = "Dårlig forretning";
      sub.textContent = `Forventet underskud ${fmtDKK(profit)}`;
    }

    updateLinks();
    saveState();
  }

  function saveState() {
    try {
      const data = {};
      ids.forEach((id) => (data[id] = el[id].value));
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (e) { /* private mode / storage unavailable */ }
  }

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const data = JSON.parse(raw);
      ids.forEach((id) => {
        if (data[id] !== undefined && el[id]) el[id].value = data[id];
      });
    } catch (e) { /* ignore corrupt local storage */ }
  }

  ids.forEach((id) => {
    el[id].addEventListener("input", calcAll);
  });

  document.getElementById("copySearch").addEventListener("click", () => {
    const text = [el.make.value, el.model.value, el.year.value].filter(Boolean).join(" ");
    if (!text) {
      showToast("Udfyld mærke/model først");
      return;
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard
        .writeText(text)
        .then(() => showToast('Kopieret: "' + text + '" — indsæt i mobile.de søgefelt'))
        .catch(() => showToast("Kunne ikke kopiere"));
    } else {
      showToast("Kopiering understøttes ikke her");
    }
  });

  ["priceEur", "extraDeCost", "dkMarketPrice"].forEach(wireMoneyPaste);

  function runSearch() {
    const query = document.getElementById("searchQuery").value.trim();
    if (!query) {
      showToast("Skriv mærke og model først, fx “BMW 320d”");
      return;
    }
    const { make, model, year } = parseSearchQuery(query);
    el.make.value = make;
    el.model.value = model;
    if (year) el.year.value = year;

    window.open("https://www.mobile.de/", "_blank", "noopener");
    window.open(bilbasenUrlFor(make, model), "_blank", "noopener");

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(query).catch(() => {});
    }
    showToast('Åbnede mobile.de + Bilbasen. Søgetekst kopieret — indsæt i mobile.de’s søgefelt.');

    calcAll();
    document.querySelector(".rail .card").scrollIntoView({ behavior: "smooth", block: "start" });
  }

  document.getElementById("searchBtn").addEventListener("click", runSearch);
  document.getElementById("searchQuery").addEventListener("keydown", (e) => {
    if (e.key === "Enter") runSearch();
  });

  document.getElementById("resetBtn").addEventListener("click", () => {
    if (!confirm("Ryd alle indtastede felter?")) return;
    try { localStorage.removeItem(STORAGE_KEY); } catch (e) {}
    ids.forEach((id) => (el[id].value = ""));
    el.fxRate.value = "7.46";
    el.expectedSalePct.value = "95";
    el.bracketThreshold.value = "71500";
    el.lowRate.value = "25";
    el.highRate.value = "150";
    el.deduction.value = "25000";
    el.co2Band1.value = "294";
    el.co2Band2.value = "587";
    el.co2Band3.value = "1115";
    el.transport.value = "3850";
    el.toldsyn.value = "800";
    el.plates.value = "1700";
    el.recon.value = "0";
    el.sellingCost.value = "0";
    el.buffer.value = "5";
    calcAll();
  });

  loadState();
  calcAll();
})();
