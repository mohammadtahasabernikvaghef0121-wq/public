const $ = (s) => document.querySelector(s),
  $$ = (s) => [...document.querySelectorAll(s)];
let me = null,
  authMode = "login",
  toastTimer;
function toast(t) {
  const x = $("#toast");
  x.textContent = t;
  x.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => x.classList.remove("show"), 3400);
}
async function api(url, opt = {}) {
  let r;
  try {
    r = await fetch(url, {
      credentials: "same-origin",
      ...opt,
      headers: {
        ...(opt.body instanceof FormData
          ? {}
          : { "Content-Type": "application/json" }),
        ...(opt.headers || {}),
      },
    });
  } catch {
    throw Error("ارتباط با سرور برقرار نشد.");
  }
  let d;
  try {
    d = await r.json();
  } catch {
    throw Error("پاسخ سرور قابل خواندن نیست.");
  }
  if (!r.ok) throw Error(d.error || "درخواست ناموفق بود.");
  return d;
}
const esc = (s) =>
  String(s ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[
        c
      ])
  );
$("#menu").onclick = () => {
  const n = $("#nav"),
    v = n.classList.toggle("open");
  $("#menu").setAttribute("aria-expanded", v);
};
$("#nav").onclick = (e) => {
  if (e.target.closest("a")) $("#nav").classList.remove("open");
};
function openAuth() {
  if (!$("#authDialog").open) $("#authDialog").showModal();
}
$("#authNav").onclick = openAuth;
$("#startBtn").onclick = () =>
  me ? $("#dashboard").scrollIntoView({ behavior: "smooth" }) : openAuth();
$("#closeAuth").onclick = () => $("#authDialog").close();
$$("[data-auth]").forEach(
  (b) =>
    (b.onclick = () => {
      authMode = b.dataset.auth;
      $$("[data-auth]").forEach((x) => x.classList.toggle("active", x === b));
      $(".regfields").classList.toggle("hidden", authMode !== "register");
      $(
        "#authForm button[type=submit],#authForm button:not(.close)"
      ).textContent = authMode === "register" ? "ساخت حساب" : "ورود";
      $("#authForm .formmsg").textContent = "";
    })
);
$("#authForm").onsubmit = async (e) => {
  e.preventDefault();
  const f = new FormData(e.target),
    data = Object.fromEntries(f);
  try {
    const d = await api(
      "/api/" + (authMode === "register" ? "register" : "login"),
      { method: "POST", body: JSON.stringify(data) }
    );
    me = d.user;
    $("#authDialog").close();
    e.target.reset();
    await refresh();
    toast("با موفقیت وارد شدید.");
  } catch (err) {
    $("#authForm .formmsg").textContent = err.message;
  }
};
async function refresh() {
  const d = await api("/api/me");
  me = d.user;
  $("#authNav").textContent = me ? "حساب کاربری" : "ورود / ثبت‌نام";
  $("#dashboard").classList.toggle("hidden", !me);
  $("#reviewForm").classList.toggle("hidden", !me);
  if (me) {
    $("#welcome").textContent = "خوش آمدی، " + me.email.split("@")[0];
    const f = $("#profileForm");
    for (const k of ["age", "height", "weight", "goal"])
      f.elements[k].value = me[k] || "";
    $("#premiumInfo").textContent = me.premium
      ? "اشتراک ویژه فعال است."
      : "حساب رایگان";
    loadPlans();
    loadWeights();
  }
}
$("#logoutBtn").onclick = async () => {
  try {
    await api("/api/logout", { method: "POST", body: "{}" });
    me = null;
    await refresh();
    toast("از حساب خارج شدید.");
  } catch (e) {
    toast(e.message);
  }
};
$$(".tabs button[data-tab]").forEach(
  (b) =>
    (b.onclick = () => {
      $$(".tabs button[data-tab]").forEach((x) =>
        x.classList.toggle("active", x === b)
      );
      $$(".panel").forEach((x) =>
        x.classList.toggle("active", x.id === "tab-" + b.dataset.tab)
      );
      if (b.dataset.tab === "weights") loadWeights();
    })
);
$("#profileForm").onsubmit = async (e) => {
  e.preventDefault();
  try {
    const d = await api("/api/profile", {
      method: "PUT",
      body: JSON.stringify(Object.fromEntries(new FormData(e.target))),
    });
    me = d.user;
    toast("پروفایل ذخیره شد.");
    loadPlans();
  } catch (err) {
    toast(err.message);
  }
};
async function loadPlans() {
  if (!me) return;
  try {
    const d = await api("/api/plans");
    $("#workout").replaceChildren();
    const title = document.createElement("h3");
    title.textContent = "برنامه نمونه: " + d.title;
    $("#workout").append(title);
    d.workouts.forEach((day) => {
      const a = document.createElement("article"),
        h = document.createElement("h4"),
        ul = document.createElement("ul");
      h.textContent = day.day;
      day.items.forEach((s) => {
        const li = document.createElement("li");
        li.textContent = s;
        ul.append(li);
      });
      a.append(h, ul);
      $("#workout").append(a);
    });
    const meals = $("#meals");
    meals.replaceChildren();
    d.meals.forEach((m) => {
      const a = document.createElement("article"),
        h = document.createElement("h4"),
        q = document.createElement("p");
      h.textContent = m.name;
      q.textContent = m.text;
      a.append(h, q);
      meals.append(a);
    });
    const n = document.createElement("p");
    n.className = "notice";
    n.textContent = d.note;
    meals.append(n);
  } catch (e) {
    toast(e.message);
  }
}
$("#weightForm").elements.day.value = new Date().toISOString().slice(0, 10);
$("#weightForm").onsubmit = async (e) => {
  e.preventDefault();
  try {
    await api("/api/weights", {
      method: "POST",
      body: JSON.stringify(Object.fromEntries(new FormData(e.target))),
    });
    toast("وزن ثبت شد.");
    loadWeights();
  } catch (x) {
    toast(x.message);
  }
};
async function loadWeights() {
  if (!me) return;
  try {
    const d = await api("/api/weights"),
      items = d.items.slice().reverse(),
      svg = $("#chart");
    svg.replaceChildren();
    if (items.length < 1) {
      $("#weightList").textContent = "هنوز وزنی ثبت نشده است.";
      return;
    }
    const vals = items.map((x) => x.kg),
      min = Math.min(...vals) - 1,
      max = Math.max(...vals) + 1,
      x0 = 45,
      x1 = 670,
      y0 = 25,
      y1 = 205,
      pts = items.map((it, i) => [
        items.length === 1
          ? x0 + (x1 - x0) / 2
          : x0 + (i * (x1 - x0)) / (items.length - 1),
        y1 - ((it.kg - min) / (max - min)) * (y1 - y0),
      ]);
    const line = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "polyline"
    );
    line.setAttribute("points", pts.map((p) => p.join(",")).join(" "));
    line.setAttribute("fill", "none");
    line.setAttribute("stroke", "#7a0d1a");
    line.setAttribute("stroke-width", "4");
    svg.append(line);
    pts.forEach((p, i) => {
      const c = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "circle"
      );
      c.setAttribute("cx", p[0]);
      c.setAttribute("cy", p[1]);
      c.setAttribute("r", "5");
      c.setAttribute("fill", "#e0a91f");
      svg.append(c);
    });
    $("#weightList").textContent = items
      .map((x) => `${x.day}: ${x.kg} کیلو`)
      .join(" · ");
  } catch (e) {
    toast(e.message);
  }
}
$("#visionForm").onsubmit = async (e) => {
  e.preventDefault();
  const file = e.target.image.files[0];
  if (!file) return;
  if (file.size > 3 * 1024 * 1024)
    return toast("حداکثر حجم عکس ۳ مگابایت است.");
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type))
    return toast("فقط JPEG، PNG یا WEBP مجاز است.");
  const fr = new FileReader();
  fr.onload = async () => {
    const box = $("#visionResult");
    box.textContent = "در حال تحلیل…";
    try {
      const d = await api("/api/food/analyze", {
        method: "POST",
        body: JSON.stringify({ image: fr.result }),
      });
      box.textContent =
        d.answer +
        "\n\n" +
        d.disclaimer +
        (d.remaining === null
          ? ""
          : "\nسهمیه رایگان باقی‌مانده امروز: " + d.remaining);
    } catch (x) {
      box.textContent = x.message;
    }
  };
  fr.readAsDataURL(file);
};
$("#chatForm").onsubmit = async (e) => {
  e.preventDefault();
  const box = $("#chatResult");
  box.textContent = "در حال دریافت پاسخ…";
  try {
    const d = await api("/api/chat", {
      method: "POST",
      body: JSON.stringify({ message: e.target.message.value }),
    });
    box.textContent = d.answer;
    e.target.reset();
  } catch (x) {
    box.textContent = x.message;
  }
};
$("#reviewForm").onsubmit = async (e) => {
  e.preventDefault();
  try {
    await api("/api/reviews", {
      method: "POST",
      body: JSON.stringify(Object.fromEntries(new FormData(e.target))),
    });
    e.target.reset();
    await loadReviews();
    toast("دیدگاه ثبت شد.");
  } catch (x) {
    toast(x.message);
  }
};
async function loadReviews() {
  try {
    const d = await api("/api/reviews"),
      root = $("#reviewList");
    root.replaceChildren();
    if (!d.items.length) {
      const p = document.createElement("p");
      p.textContent = "هنوز دیدگاهی ثبت نشده است؛ شما اولین نفر باشید.";
      root.append(p);
      return;
    }
    d.items.forEach((v) => {
      const a = document.createElement("article"),
        s = document.createElement("strong"),
        st = document.createElement("div"),
        p = document.createElement("p");
      a.className = "review";
      s.textContent = v.name;
      st.className = "stars";
      st.textContent = "★".repeat(v.rating) + "☆".repeat(5 - v.rating);
      p.textContent = v.body;
      a.append(s, st, p);
      root.append(a);
    });
  } catch (e) {
    $("#reviewList").textContent = e.message;
  }
}
(async () => {
  try {
    const c = await api("/api/config");
    if (c.telegram) $("#telegram").href = c.telegram;
    else
      $("#telegram").textContent = "پشتیبانی با تنظیم TELEGRAM_URL فعال می‌شود";
    if (c.price) {
      $("#priceText").textContent =
        new Intl.NumberFormat("fa-IR").format(c.price) +
        " تومان · " +
        c.vipDays +
        " روز";
      $("#gatewayNote").textContent = c.paymentReady
        ? "قیمت نهایی و تخفیف احتمالی نخستین خرید در سرور محاسبه می‌شود."
        : "برای پرداخت، تنظیمات پذیرنده و BASE_URL لازم است.";
    } else
      $("#gatewayNote").textContent =
        "قیمت نمایش داده نمی‌شود؛ مدیر باید VIP_PRICE_TOMAN را تنظیم کند.";
    $("#buyBtn").onclick = async () => {
      if (!me) return openAuth();
      try {
        const d = await api("/api/checkout", { method: "POST", body: "{}" });
        location.href = d.url;
      } catch (e) {
        toast(e.message);
      }
    };
    if (!c.aiEnabled)
      toast(
        "قابلیت‌های هوش مصنوعی غیرفعال‌اند؛ مدیر باید OPENAI_API_KEY را تنظیم کند."
      );
  } catch (e) {
    toast(e.message);
  }
  try {
    await refresh();
  } catch (e) {}
  await loadReviews();
})();
