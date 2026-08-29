/*
 * SIAPP PTN — client system
 * Desain/UI tidak diubah. File ini hanya menangani koneksi DOM, validasi,
 * pembayaran, pengiriman data, dan rendering hasil dari server.
 */

const DB = [
  {ptn:"Institut Teknologi Bandung",prodi:"Teknik Pertambangan dan Perminyakan",peminat:2022,kuota:95,source:"SNPMB 2026"},
  {ptn:"Universitas Indonesia",prodi:"Pendidikan Dokter",peminat:1943,kuota:60,source:"SNPMB 2026"},
  {ptn:"Universitas Gadjah Mada",prodi:"Kedokteran",peminat:1899,kuota:53,source:"SNPMB 2026"},
  {ptn:"Institut Teknologi Bandung",prodi:"Sekolah Teknik Elektro dan Informatika-Komputasi",peminat:1847,kuota:52,source:"SNPMB 2026"},
  {ptn:"Universitas Airlangga",prodi:"Kedokteran",peminat:1659,kuota:60,source:"data peminat SNBP UNAIR 2026"},
  {ptn:"Universitas Airlangga",prodi:"Farmasi",peminat:1391,kuota:56,source:"data peminat SNBP UNAIR 2026"},
  {ptn:"Universitas Airlangga",prodi:"Ilmu Hukum",peminat:1089,kuota:77,source:"data peminat SNBP UNAIR 2026"},
  {ptn:"Universitas Airlangga",prodi:"Psikologi",peminat:1066,kuota:54,source:"data peminat SNBP UNAIR 2026"},
  {ptn:"Universitas Airlangga",prodi:"Manajemen",peminat:1001,kuota:56,source:"data peminat SNBP UNAIR 2026"},
  {ptn:"Universitas Airlangga",prodi:"Akuntansi",peminat:1043,kuota:53,source:"data peminat SNBP UNAIR 2026"},
  {ptn:"Universitas Airlangga",prodi:"Kesehatan Masyarakat",peminat:923,kuota:72,source:"data peminat SNBP UNAIR 2026"},
  {ptn:"Universitas Airlangga",prodi:"Teknologi Laboratorium Medik",peminat:976,kuota:30,source:"data peminat SNBP UNAIR 2026"},
  {ptn:"Universitas Airlangga",prodi:"Keperawatan",peminat:1022,kuota:72,source:"data peminat SNBP UNAIR 2026"},
  {ptn:"Universitas Airlangga",prodi:"Matematika",peminat:214,kuota:30,source:"data peminat SNBP 2025 / kuota SNBP 2026"},
  {ptn:"Universitas Airlangga",prodi:"Statistika",peminat:329,kuota:24,source:"data peminat SNBP 2025 / kuota SNBP 2026"},
  {ptn:"Universitas Airlangga",prodi:"Biologi",peminat:226,kuota:27,source:"data peminat SNBP 2025 / kuota SNBP 2026"},
  {ptn:"Universitas Airlangga",prodi:"Fisika",peminat:121,kuota:32,source:"data peminat SNBP 2025 / kuota SNBP 2026"},
  {ptn:"Universitas Airlangga",prodi:"Kimia",peminat:256,kuota:27,source:"data peminat SNBP 2025 / kuota SNBP 2026"},
  {ptn:"Universitas Airlangga",prodi:"Teknik Lingkungan",peminat:399,kuota:22,source:"data peminat SNBP 2025 / kuota SNBP 2026"},
  {ptn:"Universitas Airlangga",prodi:"Sistem Informasi",peminat:452,kuota:24,source:"data peminat SNBP 2025 / kuota SNBP 2026"}
];

const PAYMENT_API_URL = "/api/payment";
const PAYMENT_AMOUNT = 10000;
const PAYMENT_STORAGE_KEY = "snbp2027_request_id";

let subjects = [];
let subjectCounter = 0;
let achievementCounter = 0;
let paymentRequestId = sessionStorage.getItem(PAYMENT_STORAGE_KEY) || "";
let paymentPollTimer = null;
let paymentApproved = false;

function $(id) {
  return document.getElementById(id);
}

function setText(id, value) {
  const el = $(id);
  if (el) el.textContent = value;
}

function addSubject(name = "") {
  subjectCounter++;
  const subjectId = "subject" + subjectCounter;
  subjects.push([subjectId, name || ("Mata Pelajaran " + subjectCounter)]);
  renderSubjects();
}

function removeSubject(subjectId) {
  subjects = subjects.filter(([id]) => id !== subjectId);
  renderSubjects();
}

function renameSubject(subjectId, name) {
  const item = subjects.find(([id]) => id === subjectId);
  if (item) item[1] = name.trim() || "Mata Pelajaran";
}

function renderSubjects() {
  const box = $("subjects");
  if (!box) return;
  box.innerHTML = "";

  subjects.forEach(([id, name]) => {
    let cells = "";
    for (let s = 1; s <= 5; s++) {
      cells += `<input type="number" min="0" max="100" id="${id}${s}" placeholder="S${s}" oninput="updateSubject('${id}')">`;
    }

    const safeName = String(name).replace(/&/g, "&amp;").replace(/"/g, "&quot;")
      .replace(/</g, "&lt;").replace(/>/g, "&gt;");

    box.insertAdjacentHTML("beforeend", `<div class="subject-card">
      <div class="subject-title">
        <input type="text" value="${safeName}" aria-label="Nama mata pelajaran"
          oninput="renameSubject('${id}',this.value)" style="font-weight:bold;margin-bottom:10px">
        <button type="button" class="small-btn remove-btn" onclick="removeSubject('${id}')">Hapus</button>
      </div>
      <div class="sem-grid">${cells}</div>
      <div class="avg" id="${id}Avg">Rata-rata: —</div>
    </div>`);
  });
}

function getNumber(id) {
  const el = $(id);
  if (!el) return NaN;
  const raw = String(el.value ?? "").trim();
  return raw === "" ? NaN : Number(raw);
}

function values(subjectId) {
  const result = [];
  for (let s = 1; s <= 5; s++) {
    const el = $(`${subjectId}${s}`);
    if (!el) return [];
    const raw = String(el.value ?? "").trim();
    result.push(raw === "" ? NaN : Number(raw));
  }
  return result;
}

function avg(arr) {
  return arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
}

function updateSubject(subjectId) {
  const el = $(`${subjectId}Avg`);
  if (!el) return;
  const a = values(subjectId);
  const complete = a.length === 5 && a.every(v => Number.isFinite(v) && v >= 0 && v <= 100);
  el.textContent = complete ? "Rata-rata: " + avg(a).toFixed(2) : "Rata-rata: —";
}

function collectReportSubjects() {
  if (!subjects.length) {
    throw new Error("Raport wajib memiliki minimal satu mata pelajaran.");
  }

  return subjects.map(([id, name]) => {
    const subjectName = String(name || "").trim();
    const vals = values(id);
    if (!subjectName) {
      throw new Error("Nama mata pelajaran tidak boleh kosong.");
    }
    if (vals.length !== 5 || vals.some(v => !Number.isFinite(v) || v < 0 || v > 100)) {
      throw new Error(`Raport ${subjectName} harus diisi lengkap untuk Semester 1–5 dengan nilai 0–100.`);
    }
    return { name: subjectName, values: vals };
  });
}

function reportValues() {
  return collectReportSubjects().flatMap(subject => subject.values);
}

function overallAverage() {
  const all = subjects.flatMap(([id]) => values(id).filter(Number.isFinite));
  return avg(all);
}

function addAchievement() {
  achievementCounter++;
  const id = achievementCounter;
  const box = $("achievements");
  if (!box) return;

  const empty = box.querySelector(".achievement-empty");
  if (empty) empty.remove();

  const item = document.createElement("div");
  item.className = "achievement-item";
  item.dataset.id = id;
  item.innerHTML = `<div class="achievement-head"><strong>Prestasi ${id}</strong><button type="button" class="small-btn remove-btn" onclick="removeAchievement(${id})">Hapus</button></div>
    <div class="achievement-grid">
      <div class="field"><label>Nama Lomba</label><input type="text" class="achievement-name" placeholder="Contoh: Olimpiade Matematika"></div>
      <div class="field"><label>Peringkat</label><select class="achievement-rank"><option value="">Pilih peringkat</option><option value="juara1">Juara 1</option><option value="juara2">Juara 2</option><option value="juara3">Juara 3</option><option value="harapan">Harapan</option><option value="peserta">Peserta</option></select></div>
      <div class="field"><label>Tingkat</label><select class="achievement-level"><option value="">Pilih tingkat</option><option value="internasional">Internasional</option><option value="nasional">Nasional</option><option value="provinsi">Provinsi</option><option value="kabupaten">Kabupaten/Kota</option><option value="sekolah">Sekolah</option></select></div>
    </div>`;
  box.appendChild(item);
}

function removeAchievement(id) {
  const item = document.querySelector(`.achievement-item[data-id="${id}"]`);
  if (item) item.remove();

  if (!document.querySelector(".achievement-item")) {
    const box = $("achievements");
    if (box) box.innerHTML = '<div class="achievement-empty">Belum ada prestasi. Jika tidak memiliki prestasi, nilai Prestasi dihitung 0.</div>';
  }
}

function collectAchievements() {
  return [...document.querySelectorAll(".achievement-item")].map(item => ({
    name: item.querySelector(".achievement-name")?.value.trim() || "",
    rank: item.querySelector(".achievement-rank")?.value || "",
    level: item.querySelector(".achievement-level")?.value || ""
  }));
}

function findData(ptn, prodi) {
  const norm = s => String(s || "").trim().toLowerCase();
  return DB.find(x => norm(x.ptn) === norm(ptn) && norm(x.prodi) === norm(prodi));
}

function fillFromDB(n) {
  const ptnEl = $("ptn" + n);
  const prodiEl = $("prodi" + n);
  const info = $("info" + n);
  if (!ptnEl || !prodiEl || !info) return;

  const d = findData(ptnEl.value, prodiEl.value);
  if (d) {
    const peminat = $("peminat" + n);
    const kuota = $("kuota" + n);
    if (peminat) peminat.value = d.peminat;
    if (kuota) kuota.value = d.kuota;
    info.textContent = `✓ Data ${d.source}: ${d.peminat.toLocaleString("id-ID")} peminat / ${d.kuota} kursi.`;
  } else {
    info.textContent = "Data prodi belum ada di database bawaan. Isi peminat dan kuota 2026 secara manual.";
  }
}

function populateLists() {
  const ptnList = $("ptnList");
  const prodiList = $("prodiList");
  if (!ptnList || !prodiList) return;

  const ptns = [...new Set(DB.map(x => x.ptn))].sort();
  const prodis = [...new Set(DB.map(x => x.prodi))].sort();
  ptnList.innerHTML = ptns.map(x => `<option value="${escapeHtml(x)}">`).join("");
  prodiList.innerHTML = prodis.map(x => `<option value="${escapeHtml(x)}">`).join("");
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function clampScore(value) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.max(0, Math.min(100, n)) : null;
}

function matchScore(main) {
  // Komponen ini hanya informasi tambahan; tidak masuk bobot akhir.
  // Hindari lookup ID yang dulu menyebabkan null.value karena "math1",
  // "science1", dst. tidak pernah dibuat oleh sistem mata pelajaran dinamis.
  const keywords = {
    math: ["matematika", "math"],
    science: ["ipa", "sains", "fisika", "kimia", "biologi"],
    indo: ["bahasa indonesia", "indonesia"],
    english: ["bahasa inggris", "inggris", "english"]
  };
  const wanted = keywords[main] || [];
  const candidates = subjects
    .filter(([id, name]) => wanted.some(k => name.toLowerCase().includes(k)))
    .flatMap(([id]) => values(id));

  return clampScore(candidates.length ? avg(candidates) : overallAverage()) ?? 0;
}

function competitionScore(peminat, kuota) {
  if (!Number.isFinite(peminat) || !Number.isFinite(kuota) || kuota <= 0) return 0;
  const ratio = peminat / kuota;
  if (ratio <= 2) return 100;
  if (ratio <= 5) return 90;
  if (ratio <= 10) return 75;
  if (ratio <= 15) return 60;
  if (ratio <= 25) return 45;
  if (ratio <= 40) return 30;
  return 20;
}

function status(score) {
  if (score >= 70) return { text: "PILIHAN SUDAH TEPAT", cls: "strong" };
  if (score >= 41) return { text: "PERTIMBANGKAN GANTI PRODI", cls: "competitive" };
  return { text: "PERTIMBANGKAN GANTI PTN & PRODI", cls: "ambitious" };
}

function formatScore(value) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : 0;
}

function choiceHasAnyData(n) {
  const ids = [
    "ptn" + n, "prodi" + n, "peminat" + n, "kuota" + n,
    `alumni${n}_2024`, `alumni${n}_2025`, `alumni${n}_2026`
  ];
  return ids.some(id => {
    const el = $(id);
    return el && String(el.value ?? "").trim() !== "" && String(el.value ?? "").trim() !== "0";
  });
}

function collectChoice(n, schoolRanking) {
  const ptn = $("ptn" + n)?.value.trim() || "";
  const prodi = $("prodi" + n)?.value.trim() || "";
  const main = $("main" + n)?.value || "";
  const peminat = getNumber("peminat" + n);
  const kuota = getNumber("kuota" + n);

  if (!ptn || !prodi || !Number.isFinite(peminat) || !Number.isFinite(kuota) || peminat < 0 || kuota <= 0) {
    throw new Error(`Lengkapi PTN, prodi, peminat, dan daya tampung pilihan ${n}.`);
  }

  const alumniYears = [2024, 2025, 2026].map(year => {
    const v = getNumber(`alumni${n}_${year}`);
    return Number.isFinite(v) ? v : 0;
  });

  if (alumniYears.some(v => !Number.isFinite(v) || v < 0)) {
    throw new Error(`Data alumni pilihan ${n} tidak valid.`);
  }

  return {
    ptn, prodi, peminat, kuota, alumniYears,
    matchScore: matchScore(main),
    schoolRanking
  };
}

async function analyze() {
  if (!paymentApproved) {
    await checkPaymentStatus(true);
    if (!paymentApproved) {
      alert("Analisis hanya dapat dilakukan setelah pembayaran disetujui oleh pemilik.");
      return;
    }
  }

  try {
    const reportSubjects = collectReportSubjects();
    const reports = reportSubjects.flatMap(subject => subject.values);

    const achievements = collectAchievements();
    if (achievements.some(a => !a.name || !a.rank || !a.level)) {
      throw new Error("Data prestasi belum lengkap. Setiap prestasi wajib memiliki nama lomba, peringkat, dan tingkat.");
    }

    const schoolRanking = {
      2025: getRankingInput("schoolRank2025"),
      2026: getRankingInput("schoolRank2026")
    };

    const data = [];
    data.push(collectChoice(1, schoolRanking));

    if (choiceHasAnyData(2)) {
      data.push(collectChoice(2, schoolRanking));
    }

    const response = await fetch("/api/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({
        requestId: paymentRequestId,
        reportSubjects,
        reportValues: reports,
        achievements,
        schoolRanking,
        choices: data
      })
    });

    let result;
    try {
      result = await response.json();
    } catch {
      throw new Error("Server mengembalikan respons yang tidak valid.");
    }

    if (!response.ok || result.success !== true) {
      throw new Error(result.message || "Gagal melakukan analisis. Silakan coba lagi.");
    }

    if (!Array.isArray(result.results) || result.results.length !== data.length) {
      throw new Error("Hasil analisis dari server belum lengkap.");
    }

    result.results.forEach((r, i) => updateResult(i + 1, data[i], r));

    const first = result.results[0];
    setText("analysisRaport", formatScore(first.raportScore) + "/100");
    setText("analysisRaportContribution", formatScore(first.raportContribution) + "%");
    setText("analysisPrestasi", formatScore(first.prestasiScore) + "/100");
    setText("analysisPrestasiContribution", formatScore(first.prestasiContribution) + "%");
    setText("analysisAlumni", formatScore(first.alumniScore) + "/100");
    setText("analysisAlumniContribution", formatScore(first.alumniRankingContribution) + "%");
    setText("analysisFinal", formatScore(first.finalPercentage) + "%");

    const card1 = $("card1");
    const card2 = $("card2");
    if (card1) card1.classList.remove("best");
    if (card2) card2.classList.remove("best");

    if (result.results.length === 2) {
      if (card2) card2.classList.remove("hidden");

      const r1 = result.results[0];
      const r2 = result.results[1];
      const s1 = formatScore(r1.finalPercentage);
      const s2 = formatScore(r2.finalPercentage);

      setText("comparison", `Pilihan 1 — ${s1}% | Pilihan 2 — ${s2}%`);

      if (r1.finalPercentage > r2.finalPercentage) {
        card1?.classList.add("best");
        setText("recommendation", `Pilihan 1 (${r1.prodi}) memiliki persentase lebih tinggi. Pilihan 1 lebih kuat berdasarkan indikator dalam sistem.`);
      } else if (r2.finalPercentage > r1.finalPercentage) {
        card2?.classList.add("best");
        setText("recommendation", `Pilihan 2 (${r2.prodi}) memiliki persentase lebih tinggi. Pilihan 2 lebih kuat berdasarkan indikator dalam sistem.`);
      } else {
        setText("recommendation", "Kedua pilihan memiliki persentase yang sama berdasarkan indikator dalam sistem.");
      }
    } else {
      if (card2) card2.classList.add("hidden");
      const s1 = formatScore(result.results[0].finalPercentage);
      setText("comparison", `Pilihan 1 — ${s1}%`);
      setText("recommendation", "Hanya satu program studi yang dipilih, sehingga tidak dibuat perbandingan dengan pilihan kedua.");
    }

    const resultBox = $("result");
    if (resultBox) {
      resultBox.classList.remove("hidden");
      resultBox.scrollIntoView({ behavior: "smooth" });
    }
  } catch (e) {
    console.error("Analyze error:", e);
    alert(e.message || "Gagal melakukan analisis. Silakan coba lagi.");
  }
}

function updateResult(n, data, result) {
  setText("name" + n, data.prodi);
  setText("campus" + n, data.ptn);

  const final = formatScore(result.finalPercentage);
  setText("score" + n, final + "%");

  const battery = $("batteryFill" + n);
  if (battery) {
    battery.style.width = Math.max(0, Math.min(100, final)) + "%";
    battery.style.background = final <= 40 ? "#dc2626" : (final <= 70 ? "#f59e0b" : "#16a34a");
  }

  const st = status(final);
  const statusEl = $("status" + n);
  if (statusEl) {
    statusEl.textContent = st.text;
    statusEl.className = "status " + st.cls;
  }

  setText("academic" + n, formatScore(result.raportScore));
  const academicBar = $("academicBar" + n);
  if (academicBar) academicBar.style.width = Math.min(100, formatScore(result.raportScore)) + "%";

  setText("match" + n, formatScore(result.match));
  const matchBar = $("matchBar" + n);
  if (matchBar) matchBar.style.width = Math.min(100, formatScore(result.match)) + "%";

  setText("competition" + n, formatScore(result.competition));
  const competitionBar = $("competitionBar" + n);
  if (competitionBar) competitionBar.style.width = Math.min(100, formatScore(result.competition)) + "%";

  const stats = $("stats" + n);
  if (stats) {
    const ratio = Number(result.ratio);
    stats.innerHTML =
      `<div class="stat"><small>Peminat 2026</small><b>${Number(data.peminat).toLocaleString("id-ID")}</b></div>
       <div class="stat"><small>Daya tampung</small><b>${Number(data.kuota).toLocaleString("id-ID")}</b></div>
       <div class="stat"><small>Peminat/kursi</small><b>${Number.isFinite(ratio) ? ratio.toFixed(1) : "0.0"}</b></div>
       <div class="stat"><small>Keketatan kasar</small><b>${ratio > 0 ? (100 / ratio).toFixed(1) : "0.0"}%</b></div>
       <div class="stat"><small>Alumni</small><b>${formatScore(result.alumniScore)}</b></div>
       <div class="stat"><small>Ranking sekolah</small><b>${formatScore(result.schoolRankingScore)}</b></div>
       <div class="stat"><small>Nilai akhir</small><b>${final}%</b></div>`;
  }
}

function getRankingInput(id) {
  const el = $(id);
  if (!el) return 0;
  const raw = String(el.value ?? "").trim();
  if (raw === "") return 0;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 0 || value > 1000) {
    throw new Error("Ranking sekolah harus berupa bilangan bulat 1–1000, atau 0 jika tidak masuk Top 1000.");
  }
  return value;
}

function setAnalysisAvailability() {
  const btn = $("analyzeBtn");
  if (btn) {
    btn.disabled = !paymentApproved;
    btn.setAttribute("aria-disabled", String(!paymentApproved));
  }
}

function clearAnalysisResult() {
  const resultBox = $("result");
  if (resultBox) resultBox.classList.add("hidden");
}

function setPaymentGateVisible(visible) {
  const gate = $("paymentGate");
  if (gate) gate.style.display = visible ? "" : "none";
}

function setPaymentState(text, cls) {
  const el = $("paymentState");
  if (!el) return;
  el.textContent = text;
  el.className = "payment-state " + cls;
}

async function submitPayment() {
  const input = $("proofInput");
  const file = input?.files?.[0];

  if (!file) {
    alert("Pilih bukti pembayaran terlebih dahulu.");
    return;
  }
  if (!/^image\/(png|jpe?g|webp|gif)$/i.test(file.type)) {
    alert("Bukti pembayaran harus berupa PNG, JPG, JPEG, WEBP, atau GIF.");
    return;
  }
  if (file.size > 6 * 1024 * 1024) {
    alert("Ukuran bukti maksimal 6 MB.");
    return;
  }

  const btn = $("submitPaymentBtn");
  if (btn) {
    btn.disabled = true;
    btn.textContent = "Mengirim…";
  }

  try {
    const fd = new FormData();
    fd.append("proof", file, file.name);
    fd.append("amount", String(PAYMENT_AMOUNT));

    const response = await fetch(PAYMENT_API_URL, {
      method: "POST",
      body: fd,
      credentials: "same-origin"
    });

    const d = await response.json().catch(() => ({}));
    if (!response.ok || d.success !== true || !d.requestId) {
      throw new Error(d.message || `Server HTTP ${response.status}`);
    }

    paymentRequestId = d.requestId;
    paymentApproved = d.status === "approved";
    sessionStorage.setItem(PAYMENT_STORAGE_KEY, paymentRequestId);
    setPaymentState(paymentApproved ? "PEMBAYARAN DISETUJUI" : "MENUNGGU KONFIRMASI PEMILIK", paymentApproved ? "approved" : "review");

    if (paymentApproved) {
      setPaymentGateVisible(false);
      setAnalysisAvailability();
      clearInterval(paymentPollTimer);
    } else {
      setPaymentGateVisible(true);
      setAnalysisAvailability();
      alert("Bukti pembayaran berhasil diterima. Pemilik akan memeriksanya langsung.");
      startPaymentPolling();
    }
  } catch (e) {
    alert("Gagal mengirim bukti pembayaran: " + (e.message || "Koneksi ke server gagal."));
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = "Kirim Bukti Pembayaran";
    }
  }
}

async function checkPaymentStatus(silent = false) {
  if (!paymentRequestId) {
    paymentApproved = false;
    if (!silent) alert("Kirim bukti pembayaran terlebih dahulu.");
    return false;
  }

  try {
    const response = await fetch(PAYMENT_API_URL + "/" + encodeURIComponent(paymentRequestId), {
      credentials: "same-origin"
    });
    const d = await response.json().catch(() => ({}));

    if (!response.ok) {
      if (response.status === 404) {
        paymentRequestId = "";
        paymentApproved = false;
        sessionStorage.removeItem(PAYMENT_STORAGE_KEY);
        setPaymentGateVisible(true);
        clearAnalysisResult();
        setAnalysisAvailability();
      }
      throw new Error(d.message || `HTTP ${response.status}`);
    }

    if (d.status === "approved") {
      paymentApproved = true;
      setPaymentState("PEMBAYARAN DISETUJUI", "approved");
      clearInterval(paymentPollTimer);
      setPaymentGateVisible(false);
      setAnalysisAvailability();
    } else {
      paymentApproved = false;
      setPaymentGateVisible(true);
      setAnalysisAvailability();
      clearAnalysisResult();
      if (d.status === "rejected") {
        setPaymentState("PEMBAYARAN DITOLAK", "pending");
        clearInterval(paymentPollTimer);
        if (!silent) alert(d.message || "Bukti pembayaran ditolak. Silakan unggah bukti yang benar.");
      } else {
        setPaymentState("MENUNGGU KONFIRMASI PEMILIK", "review");
      }
    }
    return paymentApproved;
  } catch (e) {
    if (!silent) alert("Tidak dapat mengecek status server: " + (e.message || "Koneksi gagal."));
    return false;
  }
}

function startPaymentPolling() {
  clearInterval(paymentPollTimer);
  checkPaymentStatus(true);
  paymentPollTimer = setInterval(() => checkPaymentStatus(true), 5000);
}

window.addSubject = addSubject;
window.removeSubject = removeSubject;
window.renameSubject = renameSubject;
window.updateSubject = updateSubject;
window.addAchievement = addAchievement;
window.removeAchievement = removeAchievement;
window.analyze = analyze;
window.submitPayment = submitPayment;
window.checkPaymentStatus = checkPaymentStatus;

document.addEventListener("DOMContentLoaded", () => {
  addSubject("Matematika");

  const achievements = $("achievements");
  if (achievements) {
    achievements.innerHTML = '<div class="achievement-empty">Belum ada prestasi. Jika tidak memiliki prestasi, nilai Prestasi dihitung 0.</div>';
  }

  populateLists();

  ["1", "2"].forEach(n => {
    ["ptn", "prodi"].forEach(k => {
      const el = $(`${k}${n}`);
      if (el) el.addEventListener("change", () => fillFromDB(n));
    });
  });

  const proofInput = $("proofInput");
  if (proofInput) {
    proofInput.addEventListener("change", e => {
      const file = e.target.files?.[0];
      setText("proofName", file ? `Bukti dipilih: ${file.name}` : "Belum ada bukti yang dipilih.");
    });
  }

  setAnalysisAvailability();
  if (paymentRequestId) {
    startPaymentPolling();
  } else {
    setPaymentGateVisible(true);
  }
});
