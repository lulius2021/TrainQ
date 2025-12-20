(() => {
  const root = document.documentElement;

  const store = {
    get(key, fallback) {
      try {
        const v = localStorage.getItem(key);
        return v ?? fallback;
      } catch {
        return fallback;
      }
    },
    set(key, value) {
      try {
        localStorage.setItem(key, value);
      } catch {}
    }
  };

  const i18n = {
    en: {
      skip: "Skip to content",

      nav_home: "Home",
      nav_demo: "Demo",
      nav_support: "Support",
      nav_privacy: "Privacy",
      nav_imprint: "Imprint",

      theme: "Theme",

      cta_view_demo: "View Demo",
      cta_view_demo_text: "View Demo",
      cta_learn_more: "Learn more",

      hero_kicker: "Adaptive training, planned around real schedules.",
      hero_title: "Train consistently\neven when life is busy.",
      hero_subtitle:
        "TrainQ combines adaptive training suggestions with smart planning so your workouts fit your week, not the other way around.",
      hero_visual_caption: "Placeholder screenshot: screenshot-dashboard.png",

      strip_1_k: "Adaptive",
      strip_1_v: "Choose what fits today",
      strip_2_k: "Planning",
      strip_2_v: "Stay consistent weekly",
      strip_3_k: "Insights",
      strip_3_v: "Time, volume, PRs",
      panel_chip: "Dashboard Preview",

      about_title: "Origins",
      about_text:
        "Smart, time-aware training suggestions and simple planning to keep your week consistent.",
      about_b1: "Time-aware session suggestions",
      about_b2: "Simple weekly planning & syncing",
      about_b3: "Progress insights & basic history",

      features_title: "A clear system for training and planning",
      features_subtitle:
        "Built to stay usable under time pressure — with structure that remains easy to understand.",

      f1_title: "Adaptive Training",
      f1_text:
        "Get multiple workout options based on time, focus, and constraints — so you can still train when plans change.",
      f2_title: "Smart Planning",
      f2_text:
        "Plan sessions realistically. Keep your week consistent without overcommitting.",
      f3_title: "Workout Clarity",
      f3_text:
        "Clear session structure, rest timing logic, and straightforward progress tracking.",
      f4_title: "Clean Insights",
      f4_text:
        "Practical summaries like session time, volume, and PRs — designed for quick review.",

      adaptive_title: "Adaptive Training & Smart Planning",
      adaptive_text:
        "TrainQ helps you choose a workout that matches your available time and equipment reality. The goal is consistency, not perfection — with a calm, premium experience designed for everyday use.",
      adaptive_b1: "Pick from multiple session options",
      adaptive_b2: "Adjust intensity and focus without re-planning everything",
      adaptive_b3: "Keep the week realistic and maintainable",
      shot_calendar_caption: "Placeholder screenshot: screenshot-calendar.png",

      pricing_title: "Free and Pro — simple, transparent",
      pricing_subtitle:
        "Start with Free. Upgrade to Pro if you want deeper control and more planning capacity.",

      free_title: "Free",
      free_desc: "Core experience to test the workflow.",
      free_b1: "Basic training sessions",
      free_b2: "Limited adaptive suggestions",
      free_b3: "Basic planning",

      pro_badge: "Pro",
      pro_title: "Pro",
      pro_desc: "More flexibility for serious consistency.",
      pro_b1: "More adaptive options and parameters",
      pro_b2: "Extended planning features",
      pro_b3: "Expanded insights and history",

      cmp_feature: "Feature",
      cmp_free: "Free",
      cmp_pro: "Pro",
      cmp_yes: "Yes",
      cmp_limited: "Limited",
      cmp_extended: "Extended",
      cmp_basic: "Basic",
      cmp_advanced: "Advanced",
      cmp_more: "More",
      cmp_standard: "Standard",
      cmp_priority: "Priority",
      cmp_row1: "Workout tracking",
      cmp_row2: "Adaptive training suggestions",
      cmp_row3: "Planning horizon",
      cmp_row4: "Insights (time, volume, PRs)",
      cmp_row5: "Support",

      philo_title: "Built for real life",
      philo_text:
        "TrainQ is designed for busy days: short windows, crowded gyms, and changing schedules. It focuses on clarity and consistency — without exaggeration.",
      ph1_title: "Calm UI",
      ph1_text: "Minimal surfaces, clear hierarchy, and readable spacing.",
      ph2_title: "Practical options",
      ph2_text: "Multiple session choices so you can adapt quickly.",
      ph3_title: "Trust-first",
      ph3_text: "No medical promises, no hype — just a solid training workflow.",
      shot_workout_caption: "Placeholder screenshot: screenshot-workout.png",

      bottom_cta_text: "Ready to explore the workflow?",
      footer_tagline: "Adaptive training and smart planning.",

      demo_title: "Demo",
      demo_subtitle:
        "This page is a placeholder. Connect your prototype, TestFlight link, or an embedded preview later.",
      demo_placeholder_title: "Demo placeholder",
      demo_placeholder_text:
        "Suggested options: 1) Link to TestFlight, 2) Embedded web demo, 3) Screens + flows.",
      demo_primary_disabled: "Demo link (coming soon)",
      demo_back_home: "Back to Home",
      demo_note:
        "Note: Keep demo claims factual. Avoid medical promises or unrealistic performance guarantees.",

      support_title: "Support",
      support_subtitle:
        "If you have questions about TrainQ, we are happy to help.",
      support_contact_title: "Contact",
      support_contact_text:
        "Please contact us by email. We respond as soon as possible.",
      support_contact_note:
        "Please include your device model, iOS version, and a short description of the issue.",
      support_faq_title: "FAQ (optional)",
      faq1_q: "How does adaptive training work?",
      faq1_a:
        "TrainQ can provide multiple workout options based on your available time and constraints. You choose what fits today.",
      faq2_q: "Can I use TrainQ without Pro?",
      faq2_a:
        "Yes. Free includes core functionality. Pro adds more flexibility and extended planning features.",
      faq3_q: "Does TrainQ give medical advice?",
      faq3_a:
        "No. TrainQ is a training and planning tool and does not provide medical guidance.",

      privacy_title: "Privacy Policy",
      privacy_updated: "Last updated: [DATE]",
      privacy_controller_title: "1. Controller",
      privacy_controller_text:
        "Controller within the meaning of the GDPR:\n[COMPANY NAME]\n[ADDRESS]\nEmail: privacy@trainq.app",
      privacy_scope_title: "2. Scope",
      privacy_scope_text:
        "This privacy policy explains how we process personal data when you use this website. It does not replace any app-specific privacy information, which may be provided inside the TrainQ app.",
      privacy_data_title: "3. Data we process on this website",
      privacy_data_b1:
        "Server logs: IP address (usually shortened), date/time, requested page, user agent, referrer (if provided).",
      privacy_data_b2:
        "Contact: If you email us, we process your email address and the information you provide.",
      privacy_purpose_title: "4. Purposes and legal bases",
      privacy_purpose_b1:
        "Website delivery and security (Art. 6(1)(f) GDPR — legitimate interest).",
      privacy_purpose_b2:
        "Handling support requests (Art. 6(1)(b) GDPR — contract / pre-contractual communication, and/or Art. 6(1)(f)).",
      privacy_processors_title: "5. Processors / hosting",
      privacy_processors_text:
        "We may use a hosting provider to deliver this website. The provider processes personal data on our behalf as a processor under Art. 28 GDPR.\nHosting provider: [HOSTING PROVIDER NAME, ADDRESS]",
      privacy_cookies_title: "6. Cookies",
      privacy_cookies_text:
        "This website uses only essential storage for language/theme preferences (localStorage). We do not use marketing cookies on this site.",
      privacy_retention_title: "7. Retention",
      privacy_retention_text:
        "Server logs are stored for [RETENTION PERIOD] and then deleted, unless required for security investigations. Support emails are kept as long as needed to resolve your request and meet legal obligations.",
      privacy_rights_title: "8. Your rights",
      privacy_rights_b1: "Access (Art. 15 GDPR)",
      privacy_rights_b2: "Rectification (Art. 16 GDPR)",
      privacy_rights_b3: "Erasure (Art. 17 GDPR)",
      privacy_rights_b4: "Restriction (Art. 18 GDPR)",
      privacy_rights_b5: "Data portability (Art. 20 GDPR)",
      privacy_rights_b6: "Objection (Art. 21 GDPR)",
      privacy_rights_b7: "Complaint to a supervisory authority (Art. 77 GDPR)",
      privacy_contact_title: "9. Contact",
      privacy_contact_text:
        "For privacy-related requests, contact: privacy@trainq.app",

      imprint_title: "Imprint / Impressum",
      imprint_subtitle:
        "Please replace placeholders with your legal entity information.",
      imprint_de_title: "Impressum (DE)",
      imprint_de_text:
        "Angaben gemäß § 5 TMG\n[FIRMENNAME]\n[ADRESSE]\n[VERTRETUNGSBERECHTIGTE PERSON]\n\nKontakt:\nE-Mail: support@trainq.app\nTelefon: [TELEFON] (optional)\n\nRegistereintrag (falls zutreffend):\n[REGISTERGERICHT]\n[REGISTERNUMMER]\n\nUmsatzsteuer-ID (falls zutreffend):\n[UST-ID]",
      imprint_en_title: "Imprint (EN)",
      imprint_en_text:
        "Information according to applicable laws:\n[COMPANY NAME]\n[ADDRESS]\nRepresented by: [REPRESENTATIVE]\n\nContact:\nEmail: support@trainq.app\nPhone: [PHONE] (optional)\n\nCompany register (if applicable):\n[REGISTER COURT]\n[REGISTER NUMBER]\n\nVAT ID (if applicable):\n[VAT ID]",
      imprint_disclaimer_title: "Disclaimer",
      imprint_disclaimer_text:
        "Content is provided for general information only. TrainQ is a training and planning tool and does not provide medical advice.",

      rail_nav_title: "Navigation",
      rail_k_2: "Adaptive",
      rail_k_3: "Clarity",
      rail_k_4: "Demo",
      rail_kpi_2: "Options, not pressure",
      rail_kpi_3: "Calm by design"
    },

    de: {
      skip: "Zum Inhalt springen",

      nav_home: "Start",
      nav_demo: "Demo",
      nav_support: "Support",
      nav_privacy: "Datenschutz",
      nav_imprint: "Impressum",

      theme: "Design",

      cta_view_demo: "Demo ansehen",
      cta_view_demo_text: "Demo ansehen",
      cta_learn_more: "Mehr erfahren",

      hero_kicker: "Adaptives Training, geplant für echte Termine.",
      hero_title: "Konstant trainieren\nauch wenn der Alltag voll ist.",
      hero_subtitle:
        "TrainQ verbindet adaptive Trainingsempfehlungen mit smarter Planung, damit Workouts in Ihre Woche passen — nicht umgekehrt.",
      hero_visual_caption: "Platzhalter-Screenshot: screenshot-dashboard.png",

      strip_1_k: "Adaptiv",
      strip_1_v: "Wählen, was heute passt",
      strip_2_k: "Planung",
      strip_2_v: "Wöchentlich konstant bleiben",
      strip_3_k: "Insights",
      strip_3_v: "Zeit, Volumen, PRs",
      panel_chip: "Dashboard Vorschau",

      features_title: "Ein klares System für Training und Planung",
      features_subtitle:
        "Entwickelt für stressige Tage — mit Struktur, die leicht verständlich bleibt.",

      f1_title: "Adaptives Training",
      f1_text:
        "Mehrere Workout-Optionen nach Zeit, Fokus und Rahmenbedingungen — damit Sie auch bei Planänderungen trainieren können.",
      f2_title: "Smarte Planung",
      f2_text:
        "Realistisch planen. Konsequent bleiben, ohne zu viel zu versprechen.",
      f3_title: "Workout-Klarheit",
      f3_text:
        "Klare Session-Struktur, sinnvolle Pausenlogik und unkompliziertes Tracking.",
      f4_title: "Saubere Insights",
      f4_text:
        "Praktische Übersichten wie Trainingszeit, Volumen und PRs — für schnellen Überblick.",

      adaptive_title: "Adaptives Training & Smarte Planung",
      adaptive_text:
        "TrainQ hilft Ihnen, ein Workout zu wählen, das zu Ihrer verfügbaren Zeit und der Geräte-Situation passt. Ziel ist Konstanz — mit einer ruhigen, hochwertigen Nutzererfahrung.",
      adaptive_b1: "Mehrere Session-Optionen zur Auswahl",
      adaptive_b2: "Intensität und Fokus anpassen, ohne alles neu zu planen",
      adaptive_b3: "Die Woche realistisch und machbar halten",
      shot_calendar_caption: "Platzhalter-Screenshot: screenshot-calendar.png",

      pricing_title: "Free und Pro — einfach, transparent",
      pricing_subtitle:
        "Starten Sie mit Free. Pro lohnt sich, wenn Sie mehr Kontrolle und Planungstiefe möchten.",

      free_title: "Free",
      free_desc: "Kernfunktionen, um den Ablauf zu testen.",
      free_b1: "Basis-Trainingseinheiten",
      free_b2: "Begrenzte adaptive Vorschläge",
      free_b3: "Grundlegende Planung",

      pro_badge: "Pro",
      pro_title: "Pro",
      pro_desc: "Mehr Flexibilität für echte Konstanz.",
      pro_b1: "Mehr adaptive Optionen und Parameter",
      pro_b2: "Erweiterte Planungsfunktionen",
      pro_b3: "Mehr Insights und Verlauf",

      cmp_feature: "Funktion",
      cmp_free: "Free",
      cmp_pro: "Pro",
      cmp_yes: "Ja",
      cmp_limited: "Begrenzt",
      cmp_extended: "Erweitert",
      cmp_basic: "Basis",
      cmp_advanced: "Erweitert",
      cmp_more: "Mehr",
      cmp_standard: "Standard",
      cmp_priority: "Priorisiert",
      cmp_row1: "Workout-Tracking",
      cmp_row2: "Adaptive Trainingsempfehlungen",
      cmp_row3: "Planungshorizont",
      cmp_row4: "Insights (Zeit, Volumen, PRs)",
      cmp_row5: "Support",

      philo_title: "Für den echten Alltag gebaut",
      philo_text:
        "TrainQ ist für volle Tage gedacht: kurze Zeitfenster, volle Gyms und wechselnde Pläne. Fokus auf Klarheit und Konstanz — ohne Übertreibung.",
      ph1_title: "Ruhiges UI",
      ph1_text: "Minimale Oberflächen, klare Hierarchie, gute Lesbarkeit.",
      ph2_title: "Praktische Optionen",
      ph2_text: "Mehrere Sessions, um schnell anpassen zu können.",
      ph3_title: "Vertrauen zuerst",
      ph3_text: "Keine medizinischen Versprechen, kein Hype — nur ein solides System.",
      shot_workout_caption: "Platzhalter-Screenshot: screenshot-workout.png",

      bottom_cta_text: "Möchten Sie den Ablauf ansehen?",
      footer_tagline: "Adaptives Training und smarte Planung.",

      about_title: "Was TrainQ bringt",
      about_text:
        "Smarte, zeitbezogene Trainingsempfehlungen und einfache Planung, damit Ihre Woche konsistent bleibt.",
      about_b1: "Zeitbezogene Trainingsempfehlungen",
      about_b2: "Einfache Wochenplanung & Synchronisation",
      about_b3: "Insights und Verlaufsmeldungen",

      demo_title: "Demo",
      demo_subtitle:
        "Diese Seite ist ein Platzhalter. Später können Sie hier einen Prototyp, TestFlight-Link oder eine Vorschau einbinden.",
      demo_placeholder_title: "Demo-Platzhalter",
      demo_placeholder_text:
        "Vorschläge: 1) TestFlight-Link, 2) Web-Demo einbetten, 3) Screens + Flow.",
      demo_primary_disabled: "Demo-Link (bald verfügbar)",
      demo_back_home: "Zurück zur Startseite",
      demo_note:
        "Hinweis: Aussagen bitte sachlich halten. Keine medizinischen Versprechen oder unrealistischen Garantien.",

      support_title: "Support",
      support_subtitle:
        "Wenn Sie Fragen zu TrainQ haben, helfen wir gerne weiter.",
      support_contact_title: "Kontakt",
      support_contact_text:
        "Bitte kontaktieren Sie uns per E-Mail. Wir antworten so schnell wie möglich.",
      support_contact_note:
        "Bitte nennen Sie Ihr Gerät, iOS-Version und eine kurze Problembeschreibung.",
      support_faq_title: "FAQ (optional)",
      faq1_q: "Wie funktioniert adaptives Training?",
      faq1_a:
        "TrainQ kann mehrere Workout-Optionen basierend auf Zeit und Rahmenbedingungen vorschlagen. Sie wählen, was heute passt.",
      faq2_q: "Kann ich TrainQ ohne Pro nutzen?",
      faq2_a:
        "Ja. Free enthält die Kernfunktionen. Pro bietet mehr Flexibilität und erweiterte Planung.",
      faq3_q: "Gibt TrainQ medizinische Beratung?",
      faq3_a:
        "Nein. TrainQ ist ein Trainings- und Planungstool und ersetzt keine medizinische Beratung.",

      privacy_title: "Datenschutzerklärung",
      privacy_updated: "Stand: [DATUM]",
      privacy_controller_title: "1. Verantwortlicher",
      privacy_controller_text:
        "Verantwortlicher im Sinne der DSGVO:\n[UNTERNEHMENSNAME]\n[ADRESSE]\nE-Mail: privacy@trainq.app",
      privacy_scope_title: "2. Geltungsbereich",
      privacy_scope_text:
        "Diese Datenschutzerklärung erläutert die Verarbeitung personenbezogener Daten bei Nutzung dieser Website. App-spezifische Informationen können zusätzlich in der TrainQ App bereitgestellt werden.",
      privacy_data_title: "3. Welche Daten wir auf dieser Website verarbeiten",
      privacy_data_b1:
        "Server-Logs: IP-Adresse (ggf. gekürzt), Datum/Uhrzeit, aufgerufene Seite, User-Agent, Referrer (falls übermittelt).",
      privacy_data_b2:
        "Kontakt: Wenn Sie uns per E-Mail kontaktieren, verarbeiten wir Ihre E-Mail-Adresse und die von Ihnen gemachten Angaben.",
      privacy_purpose_title: "4. Zwecke und Rechtsgrundlagen",
      privacy_purpose_b1:
        "Bereitstellung und Sicherheit der Website (Art. 6 Abs. 1 lit. f DSGVO — berechtigtes Interesse).",
      privacy_purpose_b2:
        "Bearbeitung von Support-Anfragen (Art. 6 Abs. 1 lit. b DSGVO — (vor-)vertragliche Kommunikation und/oder Art. 6 Abs. 1 lit. f).",
      privacy_processors_title: "5. Auftragsverarbeiter / Hosting",
      privacy_processors_text:
        "Wir können einen Hosting-Dienstleister einsetzen. Dieser verarbeitet Daten als Auftragsverarbeiter nach Art. 28 DSGVO.\nHosting: [HOSTER NAME, ADRESSE]",
      privacy_cookies_title: "6. Cookies",
      privacy_cookies_text:
        "Diese Website nutzt nur essentielle Speicherung für Sprach-/Design-Einstellungen (localStorage). Es werden keine Marketing-Cookies eingesetzt.",
      privacy_retention_title: "7. Speicherdauer",
      privacy_retention_text:
        "Server-Logs werden für [SPEICHERDAUER] gespeichert und anschließend gelöscht, sofern keine sicherheitsrelevante Auswertung erforderlich ist. Support-E-Mails werden so lange aufbewahrt, wie es zur Bearbeitung und zur Erfüllung gesetzlicher Pflichten notwendig ist.",
      privacy_rights_title: "8. Ihre Rechte",
      privacy_rights_b1: "Auskunft (Art. 15 DSGVO)",
      privacy_rights_b2: "Berichtigung (Art. 16 DSGVO)",
      privacy_rights_b3: "Löschung (Art. 17 DSGVO)",
      privacy_rights_b4: "Einschränkung (Art. 18 DSGVO)",
      privacy_rights_b5: "Datenübertragbarkeit (Art. 20 DSGVO)",
      privacy_rights_b6: "Widerspruch (Art. 21 DSGVO)",
      privacy_rights_b7: "Beschwerde bei einer Aufsichtsbehörde (Art. 77 DSGVO)",
      privacy_contact_title: "9. Kontakt",
      privacy_contact_text:
        "Für Datenschutz-Anfragen: privacy@trainq.app",

      imprint_title: "Impressum",
      imprint_subtitle:
        "Bitte Platzhalter durch Ihre rechtlichen Angaben ersetzen.",
      imprint_de_title: "Impressum (DE)",
      imprint_de_text:
        "Angaben gemäß § 5 TMG\n[FIRMENNAME]\n[ADRESSE]\n[VERTRETUNGSBERECHTIGTE PERSON]\n\nKontakt:\nE-Mail: support@trainq.app\nTelefon: [TELEFON] (optional)\n\nRegistereintrag (falls zutreffend):\n[REGISTERGERICHT]\n[REGISTERNUMMER]\n\nUmsatzsteuer-ID (falls zutreffend):\n[UST-ID]",
      imprint_en_title: "Imprint (EN)",
      imprint_en_text:
        "Information according to applicable laws:\n[COMPANY NAME]\n[ADDRESS]\nRepresented by: [REPRESENTATIVE]\n\nContact:\nEmail: support@trainq.app\nPhone: [PHONE] (optional)\n\nCompany register (if applicable):\n[REGISTER COURT]\n[REGISTER NUMBER]\n\nVAT ID (if applicable):\n[VAT ID]",
      imprint_disclaimer_title: "Hinweis",
      imprint_disclaimer_text:
        "Inhalte dienen der allgemeinen Information. TrainQ ist ein Trainings- und Planungstool und bietet keine medizinische Beratung.",

      rail_nav_title: "Navigation",
      rail_k_2: "Adaptiv",
      rail_k_3: "Klarheit",
      rail_k_4: "Demo",
      rail_kpi_2: "Optionen statt Druck",
      rail_kpi_3: "Ruhig by design"
    }
  };

  function escapeHtml(str) {
    return String(str)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function setTextOrHtml(el, value) {
    const v = String(value);
    if (v.includes("\n")) {
      el.innerHTML = v
        .split("\n")
        .map((line) => escapeHtml(line))
        .join("<br />");
    } else {
      el.textContent = v;
    }
  }

  function applyLang(lang) {
    const dict = i18n[lang] || i18n.en;
    root.setAttribute("lang", lang);
    root.dataset.lang = lang;

    document.querySelectorAll("[data-i18n]").forEach((el) => {
      const key = el.getAttribute("data-i18n");
      const val = dict[key];
      if (val == null) return;
      setTextOrHtml(el, val);
    });

    document.querySelectorAll('[data-action="lang"]').forEach((btn) => {
      btn.classList.toggle("is-active", btn.dataset.lang === lang);
    });

    // style hero kicker (make second half accent-colored)
    styleHeroKicker();
    // style hero title second line
    styleHeroTitle();

    store.set("trainq_lang", lang);
  }

  function styleHeroKicker() {
    const el = document.querySelector('[data-i18n="hero_kicker"]');
    if (!el) return;
    const t = el.textContent || "";
    const idx = t.indexOf(", ");
    if (idx === -1) return;
    const first = t.slice(0, idx + 1); // include comma
    const second = t.slice(idx + 2);
    el.innerHTML = escapeHtml(first) + ' ' + '<span class="kicker-accent">' + escapeHtml(second) + '</span>';
  }

  function styleHeroTitle() {
    const el = document.querySelector('[data-i18n="hero_title"]');
    if (!el) return;
    const t = el.textContent || "";
    // Prefer explicit newline split
    const parts = t.split("\n");
    if (parts.length >= 2) {
      const first = parts[0];
      const second = parts.slice(1).join(" ");
      el.innerHTML = escapeHtml(first) + '<br />' + '<span class="title-accent">' + escapeHtml(second) + '</span>';
      return;
    }

    // Fallback: try to split by common separators or known phrases (English/German)
    const re = /^(.*?)(?:\s*[—–-]?\s*)((?:even when|auch wenn).*)$/i;
    const m = t.match(re);
    if (m) {
      el.innerHTML = escapeHtml(m[1].trim()) + '<br />' + '<span class="title-accent">' + escapeHtml(m[2].trim()) + '</span>';
    }
  }


  function applyTheme(theme) {
    const isLight = theme === "light";
    root.classList.toggle("theme-light", isLight);
    root.classList.toggle("theme-dark", !isLight);
    store.set("trainq_theme", theme);
  }

  function toggleTheme() {
    const current = store.get("trainq_theme", "dark");
    applyTheme(current === "dark" ? "light" : "dark");
  }

  function setupYear() {
    const y = document.getElementById("year");
    if (y) y.textContent = String(new Date().getFullYear());
  }

  function setupMobileMenu() {
    const burger = document.querySelector('[data-action="toggle-menu"]');
    const mobile = document.querySelector("[data-mobile-nav]");
    if (!burger || !mobile) return;

    // Always start closed
    mobile.setAttribute("hidden", "");

    const close = () => mobile.setAttribute("hidden", "");
    const open = () => mobile.removeAttribute("hidden");
    const isOpen = () => !mobile.hasAttribute("hidden");

    burger.addEventListener("click", () => {
      if (isOpen()) close();
      else open();
    });

    mobile.querySelectorAll("a").forEach((a) => a.addEventListener("click", close));

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && isOpen()) close();
    });

    window.addEventListener("resize", () => {
      if (window.innerWidth > 760) close();
    });
  }

  function setupActions() {
    document.addEventListener("click", (e) => {
      const t = e.target.closest("[data-action]");
      if (!t) return;

      const action = t.getAttribute("data-action");
      if (action === "lang") applyLang(t.dataset.lang || "en");
      if (action === "toggle-theme") toggleTheme();
    });
  }

  function setupActiveNav() {
    const path = (location.pathname.split("/").pop() || "index.html").toLowerCase();
    const map = {
      "": "home",
      "index.html": "home",
      "demo.html": "demo",
      "support.html": "support",
      "privacy.html": "privacy",
      "imprint.html": "imprint"
    };
    const active = map[path] || "home";

    document.querySelectorAll("[data-nav]").forEach((el) => {
      el.classList.toggle("is-active", el.getAttribute("data-nav") === active);
    });
  }

  

  // Init
  const initialLang = store.get("trainq_lang", root.dataset.lang || "en");
  const initialTheme = store.get("trainq_theme", "dark");

  applyTheme(initialTheme);
  applyLang(initialLang);
  setupYear();
  setupActions();
  setupMobileMenu();
  setupActiveNav();
  
})();