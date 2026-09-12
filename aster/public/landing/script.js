const coffees = [
  {
    name: "Yirgacheffe Halo Beriti",
    process: "washed",
    origin: "Gedeb, Äthiopien",
    score: "88.5",
    notes: "Jasmin, Bergamotte, Honig und seidige Süße.",
    price: 12.4,
    impact: "Bildungsfonds",
    image: "/landing/assets/5-800x1295.jpg",
  },
  {
    name: "Sidama Bensa Natural",
    process: "natural",
    origin: "Bensa, Äthiopien",
    score: "87.8",
    notes: "Waldbeere, Kakao-Nibs, reife Mango und cremiger Körper.",
    price: 11.8,
    impact: "Wasserzugang",
    image: "/landing/assets/6-800x1295.jpg",
  },
  {
    name: "Guji Uraga Honey",
    process: "honey",
    origin: "Uraga, Äthiopien",
    score: "89.1",
    notes: "Aprikose, Blütenhonig, schwarzer Tee und klare Säure.",
    price: 13.2,
    impact: "Frauenkooperativen",
    image: "/landing/assets/7-800x1295.jpg",
  },
  {
    name: "Limu Kossa Washed",
    process: "washed",
    origin: "Jimma, Äthiopien",
    score: "86.9",
    notes: "Zitrus, Karamell, Mandel und ausgewogene Struktur.",
    price: 10.9,
    impact: "Schulmaterial",
    image: "/landing/assets/8-800x1295.jpg",
  },
  {
    name: "Bench Maji Forest Natural",
    process: "natural",
    origin: "Mizan Teferi, Äthiopien",
    score: "88.0",
    notes: "Dunkle Kirsche, Gewürze, Nougat und langer Nachhall.",
    price: 12.1,
    impact: "Aufforstung",
    image: "/landing/assets/9-800x1295.jpg",
  },
  {
    name: "Arsi Highland Honey",
    process: "honey",
    origin: "Arsi, Äthiopien",
    score: "87.4",
    notes: "Pfirsich, Rohrzucker, Hibiskus und elegante Süße.",
    price: 11.6,
    impact: "Gesundheitsstationen",
    image: "/landing/assets/4-800x1295.jpg",
  },
];

const grid = document.querySelector("[data-coffee-grid]");
const filterButtons = document.querySelectorAll("[data-filter]");
const navToggle = document.querySelector("[data-nav-toggle]");
const nav = document.querySelector("[data-nav]");
const impactForm = document.querySelector("[data-impact-form]");
const contactForm = document.querySelector("[data-contact-form]");
const themeSwitcher = document.querySelector("[data-theme-switcher]");
const themeToggle = document.querySelector("[data-theme-toggle]");
const themeStylesheet = document.querySelector("[data-theme-stylesheet]");
const themeOptions = document.querySelectorAll("[data-theme-option]");

const themes = {
  classic: "/landing/styles.css",
  creamy: "/landing/alternative.css",
  sustainable: "/landing/sustainable.css",
  logo: "/landing/logo-variant.css",
};

const currencyFormatter = new Intl.NumberFormat("de-DE", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0,
});

function processLabel(process) {
  return {
    washed: "Gewaschen",
    natural: "Natural",
    honey: "Honey",
  }[process];
}

function renderCoffees(filter = "all") {
  const selectedCoffees = filter === "all" ? coffees : coffees.filter((coffee) => coffee.process === filter);

  grid.innerHTML = selectedCoffees
    .map(
      (coffee) => `
        <article class="coffee-card">
          <div class="coffee-visual">
            <img src="${coffee.image}" alt="${coffee.name}" decoding="async" />
          </div>
          <div class="coffee-body">
            <h3>${coffee.name}</h3>
            <p>${coffee.notes}</p>
            <div class="coffee-meta">
              <span>${processLabel(coffee.process)}</span>
              <span>${coffee.origin}</span>
              <span>SCA ${coffee.score}</span>
            </div>
            <div class="coffee-footer">
              <div>
                <strong>${coffee.price.toLocaleString("de-DE", { minimumFractionDigits: 2 })} €/kg</strong>
                <small>inkl. ${coffee.impact}</small>
              </div>
              <a class="button secondary" href="#contact" aria-label="${coffee.name} anfragen">Anfragen</a>
            </div>
          </div>
        </article>
      `,
    )
    .join("");
}

function updateImpact() {
  const formData = new FormData(impactForm);
  const quantity = Number(formData.get("quantity"));
  const price = Number(formData.get("price"));
  const share = Number(formData.get("share"));
  const contribution = quantity * price * (share / 100);
  const schoolSets = Math.floor(contribution / 15);
  const waterLiters = Math.floor(contribution * 2);

  impactForm.elements.shareOutput.value = share;
  document.querySelector("[data-impact-amount]").textContent = currencyFormatter.format(contribution);
  document.querySelector(
    "[data-impact-story]",
  ).textContent = `Finanziert rechnerisch ${schoolSets} Schulsets oder ${waterLiters.toLocaleString("de-DE")} Liter sauberes Trinkwasser.`;
}

function setTheme(theme) {
  if (!themes[theme]) {
    return;
  }

  document.body.dataset.theme = theme;
  themeStylesheet.href = themes[theme];
  themeOptions.forEach((option) => {
    const isActive = option.dataset.themeOption === theme;
    option.classList.toggle("active", isActive);
    option.setAttribute("aria-pressed", String(isActive));
  });
  localStorage.setItem("aster-caffe-theme", theme);
}

filterButtons.forEach((button) => {
  button.addEventListener("click", () => {
    filterButtons.forEach((item) => item.classList.remove("active"));
    button.classList.add("active");
    renderCoffees(button.dataset.filter);
  });
});

navToggle.addEventListener("click", () => {
  const isOpen = document.body.classList.toggle("nav-open");
  navToggle.setAttribute("aria-expanded", String(isOpen));
});

nav.addEventListener("click", (event) => {
  if (event.target instanceof HTMLAnchorElement) {
    document.body.classList.remove("nav-open");
    navToggle.setAttribute("aria-expanded", "false");
  }
});

impactForm.addEventListener("input", updateImpact);

contactForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const formData = new FormData(contactForm);
  const company = formData.get("company");
  const interest = formData.get("interest");
  const status = document.querySelector("[data-form-status]");

  localStorage.setItem(
    "aster-caffe-last-request",
    JSON.stringify({
      name: formData.get("name"),
      company,
      email: formData.get("email"),
      interest,
      message: formData.get("message"),
      createdAt: new Date().toISOString(),
    }),
  );

  status.textContent = `Danke! Die Anfrage für ${company} (${interest}) wurde lokal vorbereitet.`;
  contactForm.reset();
});

themeToggle.addEventListener("click", () => {
  const isOpen = themeSwitcher.classList.toggle("open");
  themeToggle.setAttribute("aria-expanded", String(isOpen));
});

themeOptions.forEach((option) => {
  option.addEventListener("click", () => {
    setTheme(option.dataset.themeOption);
    themeSwitcher.classList.remove("open");
    themeToggle.setAttribute("aria-expanded", "false");
  });
});

document.addEventListener("click", (event) => {
  if (!themeSwitcher.contains(event.target)) {
    themeSwitcher.classList.remove("open");
    themeToggle.setAttribute("aria-expanded", "false");
  }
});

setTheme(localStorage.getItem("aster-caffe-theme") || "logo");
renderCoffees();
updateImpact();
