const $ = (s) => document.querySelector(s);
function toast(m) {
  const x = $("#toast");
  x.textContent = m;
  x.classList.add("show");
  setTimeout(() => x.classList.remove("show"), 3500);
}
async function req(url, opt = {}) {
  const r = await fetch(url, {
    credentials: "same-origin",
    ...opt,
    headers: {
      ...(opt.body instanceof FormData
        ? {}
        : { "Content-Type": "application/json" }),
      ...(opt.headers || {}),
    },
  });
  const d = r.headers.get("content-type")?.includes("json")
    ? await r.json()
    : {};
  if (!r.ok) throw Error(d.error || "درخواست انجام نشد.");
  return d;
}
function el(tag, text) {
  const e = document.createElement(tag);
  if (text) e.textContent = text;
  return e;
}
async function render() {
  try {
    const d = await req("/api/certificates"),
      list = $("#certList"),
      admin = $("#certAdminList");
    list.replaceChildren();
    admin.replaceChildren();
    if (!d.items.length) list.append(el("p", "هنوز مدرکی بارگذاری نشده است."));
    d.items.forEach((c) => {
      const card = el("article");
      card.className = "cert";
      const img = el("img");
      img.src = c.url;
      img.alt = c.label;
      img.loading = "lazy";
      card.append(img, el("p", c.label));
      list.append(card);
      const row = el("div"),
        name = el("span", c.label + " "),
        btn = el("button", "حذف");
      btn.type = "button";
      btn.onclick = async () => {
        if (!confirm("این مدرک حذف شود؟")) return;
        try {
          await req("/api/admin/certificates/" + c.id, { method: "DELETE" });
          toast("مدرک حذف شد.");
          render();
        } catch (e) {
          toast(e.message);
        }
      };
      row.append(name, btn);
      admin.append(row);
    });
    const me = await req("/api/me");
    if (me.user?.admin) $("#adminUpload").classList.remove("hidden");
  } catch (e) {
    $("#certList").textContent = e.message;
  }
}
$("#certForm").onsubmit = async (e) => {
  e.preventDefault();
  const fd = new FormData(e.target);
  try {
    await req("/api/admin/certificates", { method: "POST", body: fd });
    e.target.reset();
    toast("مدرک بارگذاری شد.");
    render();
  } catch (err) {
    toast(err.message);
  }
};
render();
