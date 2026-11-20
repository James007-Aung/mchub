// MC Hub acquisition helper: ad-source tracking, consent, language, iPhone notice.
//
// 1) Ad source -> Play Store. Reads utm_* (and fbclid) from the page URL and
//    adds them to every Google Play link as the `referrer` parameter. Google
//    Play hands that to the app on install, and Firebase Analytics records it
//    on `first_open`, so installs show up by campaign with no Meta SDK and no
//    advertising ID. This works without cookies, so it runs even if the
//    visitor declines tracking.
// 2) Meta Pixel / GA4 load only after the visitor accepts, and only when an ID
//    is set in /assets/js/config.js.
(function () {
  "use strict";

  var CFG = window.MCHUB_CONFIG || {};
  var PKG = CFG.playPackage || "com.mchub.app";
  var UTM_KEYS = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"];
  var STORE_KEY = "mchub_utm";
  var CONSENT_KEY = "mchub_consent"; // "granted" | "denied"
  var LANG_KEY = "mchub_lang";

  function safeGet(store, key) {
    try { return window[store].getItem(key); } catch (e) { return null; }
  }
  function safeSet(store, key, val) {
    try { window[store].setItem(key, val); } catch (e) { /* private mode etc. */ }
  }

  // ---------- Ad source ----------
  function readCampaign() {
    var params = new URLSearchParams(location.search);
    var found = {};
    UTM_KEYS.forEach(function (k) {
      var v = params.get(k);
      if (v) found[k] = v.slice(0, 100);
    });
    if (!found.utm_source && params.get("fbclid")) {
      // Facebook adds fbclid to every outbound click, paid or not.
      found.utm_source = "facebook";
      found.utm_medium = found.utm_medium || "social";
    }
    if (found.utm_source) {
      safeSet("sessionStorage", STORE_KEY, JSON.stringify(found));
      return found;
    }
    var saved = safeGet("sessionStorage", STORE_KEY);
    if (saved) {
      try { return JSON.parse(saved); } catch (e) { /* ignore */ }
    }
    var ref = "";
    try { ref = document.referrer ? new URL(document.referrer).hostname : ""; } catch (e) { ref = ""; }
    if (ref && ref.indexOf("mymchub.com") === -1) {
      return { utm_source: ref.replace(/^www\./, ""), utm_medium: "referral", utm_campaign: "website" };
    }
    return { utm_source: "mymchub.com", utm_medium: "website", utm_campaign: "direct" };
  }

  var campaign = readCampaign();

  function referrerString() {
    var page = (location.pathname.replace(/\/+$/, "") || "/home").replace(/^\//, "").replace(/[^a-z0-9_-]/gi, "_");
    var parts = [];
    UTM_KEYS.forEach(function (k) {
      if (campaign[k]) parts.push(k + "=" + encodeURIComponent(campaign[k]));
    });
    if (!campaign.utm_content) parts.push("utm_content=" + encodeURIComponent(page || "home"));
    return parts.join("&");
  }

  function playUrl() {
    return "https://play.google.com/store/apps/details?id=" + encodeURIComponent(PKG) +
      "&referrer=" + encodeURIComponent(referrerString());
  }

  function isPlayLink(a) {
    var h = a.getAttribute("href") || "";
    return h.indexOf("play.google.com/store/apps/details") !== -1 || a.hasAttribute("data-play");
  }

  function tagPlayLinks(root) {
    (root || document).querySelectorAll("a").forEach(function (a) {
      if (isPlayLink(a)) a.setAttribute("href", playUrl());
    });
  }

  // Keep the campaign when moving between site pages (e.g. home -> /get/).
  function carryCampaignToInternalLinks(root) {
    var params = new URLSearchParams(location.search);
    var has = UTM_KEYS.some(function (k) { return params.get(k); });
    if (!has) return;
    (root || document).querySelectorAll('a[href^="/"]').forEach(function (a) {
      var href = a.getAttribute("href");
      if (href.indexOf("?") !== -1 || href.indexOf("#") === 0) return;
      a.setAttribute("href", href + "?" + UTM_KEYS
        .filter(function (k) { return campaign[k]; })
        .map(function (k) { return k + "=" + encodeURIComponent(campaign[k]); })
        .join("&"));
    });
  }

  // ---------- Trackers (consent-gated) ----------
  var pixelReady = false;

  function loadMetaPixel(id) {
    /* Standard Meta Pixel bootstrap */
    !function (f, b, e, v, n, t, s) {
      if (f.fbq) return; n = f.fbq = function () {
        n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments);
      };
      if (!f._fbq) f._fbq = n; n.push = n; n.loaded = !0; n.version = "2.0";
      n.queue = []; t = b.createElement(e); t.async = !0;
      t.src = v; s = b.getElementsByTagName(e)[0];
      s.parentNode.insertBefore(t, s);
    }(window, document, "script", "https://connect.facebook.net/en_US/fbevents.js");
    window.fbq("init", id);
    window.fbq("track", "PageView");
    pixelReady = true;
  }

  function loadGa4(id) {
    var s = document.createElement("script");
    s.async = true;
    s.src = "https://www.googletagmanager.com/gtag/js?id=" + encodeURIComponent(id);
    document.head.appendChild(s);
    window.dataLayer = window.dataLayer || [];
    window.gtag = function () { window.dataLayer.push(arguments); };
    window.gtag("js", new Date());
    window.gtag("config", id);
  }

  function startTrackers() {
    if (CFG.metaPixelId) loadMetaPixel(CFG.metaPixelId);
    if (CFG.ga4MeasurementId) loadGa4(CFG.ga4MeasurementId);
    if (isIOS()) track("IOSVisit", {});
  }

  function trackersConfigured() {
    return !!(CFG.metaPixelId || CFG.ga4MeasurementId);
  }

  function track(name, params) {
    params = params || {};
    if (pixelReady && window.fbq) window.fbq("trackCustom", name, params);
    if (window.gtag) window.gtag("event", name.replace(/([a-z])([A-Z])/g, "$1_$2").toLowerCase(), params);
  }

  function showConsentBanner() {
    var el = document.getElementById("consent");
    if (!el) return;
    el.hidden = false;
    el.querySelector("[data-consent=accept]").addEventListener("click", function () {
      safeSet("localStorage", CONSENT_KEY, "granted");
      el.hidden = true;
      startTrackers();
    });
    el.querySelector("[data-consent=decline]").addEventListener("click", function () {
      safeSet("localStorage", CONSENT_KEY, "denied");
      el.hidden = true;
    });
  }

  // ---------- Download clicks ----------
  function onPlayClick(e) {
    var a = e.target.closest && e.target.closest("a");
    if (!a || !isPlayLink(a)) return;
    a.setAttribute("href", playUrl());
    var params = {
      source: campaign.utm_source || "",
      campaign: campaign.utm_campaign || "",
      placement: a.getAttribute("data-play") || "link",
    };
    if (!pixelReady && !window.gtag) return; // nothing to report; let the link open normally
    if (pixelReady) window.fbq("track", "Lead", params); // standard event: easy to optimize ads for
    track("DownloadClick", params);
    // Give the events a moment to leave before the Play Store opens.
    if (!e.metaKey && !e.ctrlKey && a.target !== "_blank") {
      e.preventDefault();
      setTimeout(function () { location.href = a.href; }, 300);
    }
  }

  // ---------- iPhone visitors ----------
  function isIOS() {
    var ua = navigator.userAgent || "";
    return /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
  }

  function setupIOSNotice() {
    if (!isIOS()) return;
    document.documentElement.classList.add("is-ios");
    var btn = document.getElementById("ios-share");
    if (!btn) return;
    btn.addEventListener("click", function () {
      var url = location.origin + location.pathname;
      if (navigator.share) {
        navigator.share({ title: document.title, url: url }).catch(function () {});
      } else if (navigator.clipboard) {
        navigator.clipboard.writeText(url).then(function () {
          btn.classList.add("copied");
        }).catch(function () {});
      }
      track("IOSShare", {});
    });
  }

  // ---------- Language (pages that offer both) ----------
  // The page's inline <head> script picks the starting language (no flash);
  // this only wires the toggle button.
  function setupLanguage() {
    var toggle = document.getElementById("lang-toggle");
    if (!toggle) return;
    var html = document.documentElement;
    toggle.addEventListener("click", function () {
      var next = html.getAttribute("lang") === "my" ? "en" : "my";
      html.setAttribute("lang", next);
      safeSet("localStorage", LANG_KEY, next);
    });
  }

  // ---------- Boot ----------
  function boot() {
    setupLanguage();
    tagPlayLinks();
    carryCampaignToInternalLinks();
    setupIOSNotice();
    document.addEventListener("click", onPlayClick, true);

    if (trackersConfigured()) {
      var consent = safeGet("localStorage", CONSENT_KEY);
      if (consent === "granted") startTrackers();
      else if (consent !== "denied") showConsentBanner();
    }

    // The shared header loads later; tag its links once it appears.
    var header = document.getElementById("site-header");
    if (header && window.MutationObserver) {
      new MutationObserver(function () {
        tagPlayLinks(header);
        carryCampaignToInternalLinks(header);
      }).observe(header, { childList: true });
    }
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
