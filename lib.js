// repair-system shared helpers.
// Plain global functions - every page loads this file. Auth uses the Supabase Auth
// REST endpoint directly, so supabase-js is not required anywhere.
// The session token lives in sessionStorage, so closing the tab signs you out.

const SUPABASE_URL = "https://qedqzmhorbanspbeikvo.supabase.co";
const SUPABASE_KEY = "sb_publishable_1DbnJIJzSeWLQ8Nh1eKC9Q_Pb-NHJW5";

// Repair types shown on the form, the label and the finish page.
const REPAIR_TYPES = ["Screen", "Back", "Charging", "FRP Lock", "Other"];

const TYPE_CODES = {
  "Screen": "LC",
  "Back": "LC",
  "Charging": "CH",
  "FRP Lock": "FR",
  "Other": "OT"
};

// Label size.
const LABEL_W_IN = 2.25;
const LABEL_H_IN = 1;

// ------------------------------------------------------------------ helpers

function esc(v) {
  if (v === null || v === undefined) return "";
  return String(v)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function gbp(v) {
  const n = Number(v);
  return isFinite(n) ? "£" + n.toFixed(2) : "£0.00";
}

function fmtDate(iso) {
  if (!iso) return "-";
  const d = new Date(iso);
  return isNaN(d.getTime()) ? "-" : d.toLocaleString();
}

function moneyValue(raw) {
  const n = Number(String(raw).replace(/[^\d.]/g, ""));
  return isFinite(n) ? Math.round(n * 100) / 100 : 0;
}

// Accepts a bare ID ("ZAB-LC106"), a pasted label link, or a link with a fragment.
function repairIdFrom(input) {
  if (!input) return "";
  const s = String(input).trim();
  if (!s) return "";
  const m = s.match(/repair\.html\?[^#]*?\bid=([^&#]+)/i);
  const id = m ? decodeURIComponent(m[1]) : s;
  return id.replace(/^#/, "").replace(/\s+/g, "");
}

// ZAB-LC106 : shop prefix - repair type code - 3 random digits.
function makeRepairId(typeName) {
  const code = TYPE_CODES[typeName] || "OT";
  const rand = String(Math.floor(Math.random() * 1000)).padStart(3, "0");
  return "ZAB-" + code + rand;
}

function repairUrl(repairId) {
  return window.location.origin + "/repair.html?id=" + encodeURIComponent(repairId);
}

// ------------------------------------------------------------ modal dialog

// One modal helper, used by every page that needs to show a message with a
// Print button. Pass an array of action buttons; the first one is primary.
function showModal(opts) {
  closeModal();

  const actions = opts.actions || [];
  const buttons = actions
    .map(function (a, i) {
      return (
        '<button class="' + (i === 0 ? "primary" : "secondary") + '"' +
        ' data-action="' + i + '">' + esc(a.label) + "</button>"
      );
    })
    .join("");

  const html =
    '<div class="modal-backdrop" data-modal>' +
      '<div class="modal-box" role="dialog" aria-modal="true">' +
        (opts.title ? "<h3>" + esc(opts.title) + "</h3>" : "") +
        (opts.bodyHtml || "") +
        (buttons ? '<div class="modal-actions">' + buttons + "</div>" : "") +
      "</div>" +
    "</div>";

  document.body.insertAdjacentHTML("beforeend", html);

  const box = document.querySelector("[data-modal]");

  // Action buttons
  box.querySelectorAll("[data-action]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      const action = actions[Number(btn.getAttribute("data-action"))];
      if (action && action.onClick) {
        // Let the handler close the modal itself when it wants to.
        action.onClick();
      }
      if (!action || action.keepOpen !== true) {
        closeModal();
      }
    });
  });

  // Escape key closes it
  document.addEventListener("keydown", escapeCloses);

  // Focus the first action button so Enter works straight away.
  const firstBtn = box.querySelector("[data-action]");
  if (firstBtn) firstBtn.focus();

  return box;
}

function escapeCloses(e) {
  if (e.key === "Escape") closeModal();
}

function closeModal() {
  document.querySelectorAll("[data-modal]").forEach(function (m) {
    m.remove();
  });
  document.removeEventListener("keydown", escapeCloses);
}

// --------------------------------------------------------------------- api

// Send the login token when we have one, otherwise fall back to the anon key.
// This keeps the shop working on day one (the tables are public) and starts
// enforcing Row Level Security the moment policies are turned on in Supabase.
function authHeaders(extra) {
  const token = sessionStorage.getItem("rs_access_token");
  return Object.assign(
    {
      "Content-Type": "application/json",
      "apikey": SUPABASE_KEY,
      "Authorization": "Bearer " + (token || SUPABASE_KEY)
    },
    extra || {}
  );
}

async function api(path, options) {
  options = options || {};

  const extra = options.body ? { "Prefer": "return=representation" } : {};

  const res = await fetch(SUPABASE_URL + "/rest/v1/" + path, {
    method: options.method || "GET",
    headers: authHeaders(extra),
    body: options.body ? JSON.stringify(options.body) : undefined
  });

  const text = await res.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch (e) { data = text; }

  return {
    ok: res.ok,
    status: res.status,
    data: data,
    message: data && typeof data === "object" ? (data.message || "") : ""
  };
}

// -------------------------------------------------------------------- auth

async function signIn(email, password) {
  const res = await fetch(SUPABASE_URL + "/auth/v1/token?grant_type=password", {
    method: "POST",
    headers: { "Content-Type": "application/json", "apikey": SUPABASE_KEY },
    body: JSON.stringify({ email: email, password: password })
  });

  const data = await res.json();

  if (!res.ok) {
    return { ok: false, error: (data && (data.msg || data.message)) || "Sign in failed." };
  }

  sessionStorage.setItem("rs_access_token", data.access_token);
  sessionStorage.setItem("rs_refresh_token", data.refresh_token || "");
  sessionStorage.setItem("rs_user_email", (data.user && data.user.email) || email);

  return { ok: true, email: (data.user && data.user.email) || email };
}

function isSignedIn() {
  return !!sessionStorage.getItem("rs_access_token");
}

function currentUser() {
  return sessionStorage.getItem("rs_user_email") || "shop";
}

function signOut() {
  sessionStorage.removeItem("rs_access_token");
  sessionStorage.removeItem("rs_refresh_token");
  sessionStorage.removeItem("rs_user_email");
  window.location.replace("login.html");
}

// Sends the browser to the login page when there is no session.
function requireSignIn() {
  if (!isSignedIn()) {
    window.location.replace("login.html");
    return false;
  }
  return true;
}

// ------------------------------------------------------------------- label

function barcodeUrl(repairId, width, height) {
  return "https://quickchart.io/barcode?type=code128&text=" +
    encodeURIComponent(repairId) +
    "&width=" + width + "&height=" + height + "&margin=0";
}

// Draws the on-screen label preview: repair type + name on top, barcode in the
// middle, repair ID underneath. Matches the printed label layout.
function drawLabel(canvas, type, name, repairId) {
  const dpi = 300;
  canvas.width = Math.round(LABEL_W_IN * dpi);
  canvas.height = Math.round(LABEL_H_IN * dpi);
  canvas.style.width = "100%";
  canvas.style.height = "auto";

  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#000000";

  const line1 = (type + " - " + name).toUpperCase();
  ctx.textAlign = "center";
  ctx.font = "bold 40px Arial";
  ctx.fillText(line1.slice(0, 32), canvas.width / 2, 52);

  const img = new Image();
  img.onload = function () {
    ctx.drawImage(img, (canvas.width - img.width) / 2, 74);
    ctx.font = "bold 46px Arial";
    ctx.fillText(repairId, canvas.width / 2, 264);
  };
  img.src = barcodeUrl(repairId, 600, 110);
}

// Opens a print window sized to exactly 2.25in x 1in.
function printLabel(type, name, repairId) {
  const w = window.open("", "", "width=420,height=340");
  if (!w) {
    alert("Pop-up blocked. Allow pop-ups for this site to print the label.");
    return;
  }

  const line1 = (type + " - " + name).toUpperCase().slice(0, 32);

  w.document.write([
    "<!DOCTYPE html><html><head><title>Label</title>",
    "<style>",
    "@page { size: " + LABEL_W_IN + "in " + LABEL_H_IN + "in; margin: 0; }",
    "html, body { margin:0; padding:0; }",
    ".label { width:" + LABEL_W_IN + "in; height:" + LABEL_H_IN + "in;",
    "         display:flex; flex-direction:column; align-items:center; justify-content:center;",
    "         font-family:Arial, Helvetica, sans-serif; }",
    ".label .line1 { font-size:9px; font-weight:bold; margin-bottom:3px; }",
    ".label img { height:32px; display:block; }",
    ".label .id { font-size:11px; font-weight:bold; margin-top:3px; letter-spacing:.5px; }",
    "</style></head>",
    "<body onload=\"setTimeout(function(){ window.print(); }, 350);\">",
    "<div class=\"label\">",
    "<div class=\"line1\">" + esc(line1) + "</div>",
    "<img src=\"" + barcodeUrl(repairId, 400, 32) + "\">",
    "<div class=\"id\">" + esc(repairId) + "</div>",
    "</div></body></html>"
  ].join("\n"));

  w.document.close();
}

// Centred summary shown after a repair is finished: the details, the barcode and
// a Print button. Built from the live row so it always matches what was saved.
// `onNext` is the page's own reset routine, called by the Next Repair button.
function showDoneModal(repair, label, onNext) {
  const c = repair.customers || {};

  showModal({
    title: label + " - Done",
    bodyHtml: `
      <div class="modal-rows">
        <div class="row"><span>Repair ID</span><strong>${esc(repair.repair_id)}</strong></div>
        <div class="row"><span>Repair Type</span><strong>${esc(repair.repair_type || "-")}</strong></div>
        <div class="row"><span>Customer</span><strong>${esc(c.name || "-")}</strong></div>
        <div class="row"><span>Phone</span><strong>${esc(c.phone || "-")}</strong></div>
        <div class="row"><span>Amount</span><strong>${gbp(repair.amount)}</strong></div>
        <div class="row"><span>Collected</span><span>${esc(fmtDate(repair.collected_at))}</span></div>
      </div>
      <div class="modal-barcode">
        <canvas id="doneLabelCanvas"></canvas>
        <p class="modal-code">${esc(repair.repair_id)}</p>
      </div>
    `,
    actions: [
      { label: "Print", onClick: function () {
          printLabel(repair.repair_type || "", c.name || "", repair.repair_id);
        } },
      { label: "Next Repair", onClick: onNext }
    ]
  });

  drawLabel(
    document.getElementById("doneLabelCanvas"),
    repair.repair_type || "",
    c.name || "",
    repair.repair_id
  );
}
