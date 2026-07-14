(function () {
  "use strict";

  /* ----- theme toggle ----- */
  var root = document.documentElement;
  var toggle = document.querySelector("[data-theme-toggle]");
  if (toggle) {
    toggle.addEventListener("click", function () {
      var next = root.dataset.theme === "dark" ? "light" : "dark";
      root.dataset.theme = next;
      try { localStorage.setItem("theme", next); } catch (e) {}
    });
  }

  /* ----- language switch ----- */
  // Clicking a language link stores an explicit preference that overrides
  // the browser-language auto-detection done inline in <head>.
  document.querySelectorAll(".lang-switch a[data-lang]").forEach(function (link) {
    link.addEventListener("click", function () {
      try { localStorage.setItem("lang", link.dataset.lang); } catch (e) {}
    });
  });

  /* ----- search ----- */
  var input = document.getElementById("search-input");
  var list = document.getElementById("search-results");
  var index = null;

  function loadIndex() {
    if (index) return Promise.resolve(index);
    return fetch(input.dataset.index)
      .then(function (r) { return r.json(); })
      .then(function (data) { index = data; return index; })
      .catch(function () { index = []; return index; });
  }

  function close() {
    if (list) { list.hidden = true; list.innerHTML = ""; }
  }

  function render(items, query) {
    list.innerHTML = "";
    if (!query) { close(); return; }
    if (!items.length) {
      var empty = document.createElement("li");
      empty.className = "search-empty";
      empty.textContent = "E486: Pattern not found";
      list.appendChild(empty);
    }
    items.slice(0, 8).forEach(function (item) {
      var li = document.createElement("li");
      var a = document.createElement("a");
      a.href = item.url;
      var title = document.createElement("span");
      title.className = "search-title";
      title.textContent = item.title;
      var date = document.createElement("span");
      date.className = "search-date";
      date.textContent = item.date;
      a.appendChild(title);
      a.appendChild(date);
      li.appendChild(a);
      list.appendChild(li);
    });
    list.hidden = false;
  }

  if (input && list) {
    input.addEventListener("input", function () {
      var q = input.value.trim().toLowerCase();
      loadIndex().then(function (idx) {
        if (!q) { close(); return; }
        var hits = idx.filter(function (p) {
          return (
            p.title.toLowerCase().indexOf(q) !== -1 ||
            (p.summary && p.summary.toLowerCase().indexOf(q) !== -1) ||
            (p.tags || []).some(function (t) { return t.toLowerCase().indexOf(q) !== -1; })
          );
        });
        render(hits, q);
      });
    });

    input.addEventListener("focus", loadIndex);

    input.addEventListener("keydown", function (e) {
      if (e.key === "ArrowDown" && !list.hidden) {
        e.preventDefault();
        var first = list.querySelector("a");
        if (first) first.focus();
      } else if (e.key === "Escape") {
        close();
        input.blur();
      }
    });

    list.addEventListener("keydown", function (e) {
      var links = Array.prototype.slice.call(list.querySelectorAll("a"));
      var i = links.indexOf(document.activeElement);
      if (e.key === "ArrowDown" && i < links.length - 1) {
        e.preventDefault();
        links[i + 1].focus();
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        if (i > 0) links[i - 1].focus();
        else input.focus();
      } else if (e.key === "Escape") {
        close();
        input.focus();
      }
    });

    document.addEventListener("click", function (e) {
      if (!e.target.closest("#search")) close();
    });

    document.addEventListener("keydown", function (e) {
      if (e.key !== "/" || e.metaKey || e.ctrlKey || e.altKey) return;
      var el = document.activeElement;
      if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable)) return;
      e.preventDefault();
      input.focus();
      input.select();
    });
  }

  /* ----- code tabs ----- */
  document.querySelectorAll(".codetabs").forEach(function (block) {
    var tabs = Array.prototype.slice.call(block.querySelectorAll(".codetabs-tab"));
    var panels = Array.prototype.slice.call(block.querySelectorAll(".codetabs-panel"));

    function select(index, focus) {
      tabs.forEach(function (tab, i) {
        var active = i === index;
        tab.setAttribute("aria-selected", active ? "true" : "false");
        tab.tabIndex = active ? 0 : -1;
        if (panels[i]) panels[i].hidden = !active;
      });
      if (focus) tabs[index].focus();
    }

    tabs.forEach(function (tab, i) {
      tab.addEventListener("click", function () { select(i, false); });
      tab.addEventListener("keydown", function (e) {
        var next;
        if (e.key === "ArrowRight") next = (i + 1) % tabs.length;
        else if (e.key === "ArrowLeft") next = (i - 1 + tabs.length) % tabs.length;
        else if (e.key === "Home") next = 0;
        else if (e.key === "End") next = tabs.length - 1;
        else return;
        e.preventDefault();
        select(next, true);
      });
    });
  });

  /* ----- table-of-contents scrollspy ----- */
  var tocLinks = document.querySelectorAll("#TableOfContents a");
  var prose = document.querySelector(".prose");
  if (tocLinks.length && prose && "IntersectionObserver" in window) {
    var byId = {};
    tocLinks.forEach(function (a) {
      byId[decodeURIComponent(a.hash.slice(1))] = a;
    });
    var observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          var link = byId[entry.target.id];
          if (!link) return;
          tocLinks.forEach(function (a) { a.classList.remove("is-active"); });
          link.classList.add("is-active");
        });
      },
      { rootMargin: "0% 0% -72% 0%" }
    );
    prose.querySelectorAll("h2[id], h3[id]").forEach(function (h) {
      observer.observe(h);
    });
  }
})();
