/* BodyBlueprint - shared script. Data is saved in the browser (localStorage). */
const $ = id => document.getElementById(id);
const KEY = "bodyblueprint-site-v1";
let D = { profile: null, goal: null, logs: {} };
try { const s = localStorage.getItem(KEY); if (s) D = Object.assign(D, JSON.parse(s)); } catch (e) {}
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(D)); } catch (e) {} };

const clamp = (x, a = 0, b = 100) => Math.max(a, Math.min(b, x));
const round2 = x => Math.round(x * 100) / 100;
const dateKey = (ago = 0) => {
  const d = new Date(); d.setDate(d.getDate() - ago);
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
};
const todayLog = () => D.logs[dateKey()] || (D.logs[dateKey()] = {});

/* Formulas */
const calcBmi = (kg, cm) => kg / ((cm / 100) * (cm / 100));
const calcBmr = (kg, cm, age, sex) => 10 * kg + 6.25 * cm - 5 * age + (sex === "male" ? 5 : -161); // Mifflin-St Jeor
const category = b => b < 18.5 ? { name: "Underweight", color: "#3b82f6" }
                    : b < 25 ? { name: "Normal", color: "#22b07d" }
                    : b < 30 ? { name: "Overweight", color: "#e8a317" } : { name: "Obese", color: "#dc4b4b" };
function sleepHours(bed, wake) {
  const [bh, bm] = bed.split(":").map(Number), [wh, wm] = wake.split(":").map(Number);
  let m = (wh * 60 + wm) - (bh * 60 + bm); if (m <= 0) m += 1440; return m / 60;
}
const goalLiters = () => D.goal || (D.profile ? round2(D.profile.weight * 0.03) : 2.5);

/* Sub-scores (0-100) and daily wellness score */
const bmiScore = kg => { const b = calcBmi(kg, D.profile.height); const d = b < 18.5 ? 18.5 - b : b > 24.9 ? b - 24.9 : 0; return clamp(100 - d * 12); };
const hydScore = l => clamp(l.water / goalLiters() * 100);
const slpScore = h => h > 9 ? clamp(100 - (h - 9) * 15) : clamp(h / 8 * 100);
function dayScore(l) {
  if (!D.profile || l.water === undefined || l.hours === undefined) return null;
  const b = bmiScore(l.weight || D.profile.weight), h = hydScore(l), s = slpScore(l.hours);
  return { bmi: b, hyd: h, sleep: s, total: Math.round(0.30 * b + 0.35 * h + 0.35 * s) };
}

/* ---------- BMI & BMR page ---------- */
if ($("calcBtn")) {
  const showBmi = () => {
    const p = D.profile, bmi = calcBmi(p.weight, p.height), bmr = calcBmr(p.weight, p.height, p.age, p.sex), c = category(bmi);
    $("bmiVal").textContent = bmi.toFixed(1) + " kg/m²";
    $("bmrVal").textContent = Math.round(bmr).toLocaleString() + " kcal/day";
    $("bmiInfo").textContent = c.name + " (WHO adult category)";
    $("bmiInfo").style.color = c.color; $("bmiInfo").style.fontWeight = "700";
    const m = Math.round(bmr * 1.4);
    $("calInfo").textContent = "Estimated maintenance for light activity: about " + m.toLocaleString() +
      " kcal/day. Cutting: about " + (m - 500).toLocaleString() + ". Bulking: about " + (m + 300).toLocaleString() + ".";
  };
  if (D.profile) {
    $("height").value = D.profile.height; $("weight").value = D.profile.weight;
    $("age").value = D.profile.age; $("sex").value = D.profile.sex; showBmi();
  }
  $("calcBtn").onclick = () => {
    const height = parseFloat($("height").value), weight = parseFloat($("weight").value),
          age = parseFloat($("age").value), sex = $("sex").value;
    if (!(height >= 50 && height <= 250) || !(weight >= 10 && weight <= 400) || !(age >= 1 && age <= 120) || !sex) {
      $("bmiInfo").textContent = "Please enter a valid height (50-250 cm), weight (10-400 kg), age and sex."; return;
    }
    D.profile = { height, weight, age, sex }; todayLog().weight = weight; save(); showBmi();
  };
}

/* ---------- Water page ---------- */
if ($("waterMeter")) {
  const drawWater = () => {
    const c = todayLog().water || 0, g = goalLiters(), pct = clamp(c / g * 100);
    $("goal").value = g; $("consumed").value = c; $("waterMeter").value = pct;
    $("waterText").textContent = c.toFixed(2) + " L of " + g + " L consumed (" + Math.round(pct) + "%)";
    $("goalHint").textContent = D.profile ? "Suggested goal for your weight: " + round2(D.profile.weight * 0.03) + " L (30 ml per kg)."
                                          : "Tip: calculate your BMI first to get a goal based on your weight.";
    save();
  };
  document.querySelectorAll("[data-add]").forEach(b => b.onclick = () => {
    const l = todayLog(); l.water = round2((l.water || 0) + parseFloat(b.dataset.add)); drawWater();
  });
  $("resetWater").onclick = () => { todayLog().water = 0; drawWater(); };
  $("goal").addEventListener("change", () => { const g = parseFloat($("goal").value); if (g >= 0.5) D.goal = round2(g); drawWater(); });
  $("consumed").addEventListener("change", () => { const c = parseFloat($("consumed").value); todayLog().water = c >= 0 ? round2(c) : 0; drawWater(); });
  drawWater();
}

/* ---------- Sleep page ---------- */
if ($("saveSleep")) {
  const upd = () => { $("duration").value = ($("bed").value && $("wake").value) ? sleepHours($("bed").value, $("wake").value).toFixed(1) : ""; };
  const t = D.logs[dateKey()];
  if (t && t.bed) { $("bed").value = t.bed; $("wake").value = t.wake; $("quality").value = t.quality || ""; }
  upd();
  $("bed").addEventListener("input", upd); $("wake").addEventListener("input", upd);
  $("saveSleep").onclick = () => {
    const msg = $("sleepMsg");
    if (!$("bed").value || !$("wake").value) { msg.textContent = "Please enter both bedtime and wake-up time."; msg.style.color = "#b3261e"; return; }
    const h = round2(sleepHours($("bed").value, $("wake").value)), l = todayLog();
    l.bed = $("bed").value; l.wake = $("wake").value; l.hours = h; l.quality = $("quality").value ? Number($("quality").value) : 0; save();
    msg.textContent = "Saved: " + h.toFixed(1) + " hours of sleep. " +
      (h < 7 ? "That is under the recommended 7 to 9 hours." : h <= 9 ? "That is within the recommended 7 to 9 hours." : "That is above the usual 7 to 9 hours.");
    msg.style.color = h >= 7 && h <= 9 ? "#22b07d" : "#c27a00";
  };
}

/* ---------- Wellness page ---------- */
if ($("scoreVal")) {
  const renderTips = (l, s) => {
    const t = [];
    if (s) {
      const bmi = calcBmi(l.weight || D.profile.weight, D.profile.height);
      if (l.hours < 7 && s.hyd < 85) t.push("Sleep deficit detected: increase water intake and plan an earlier bedtime to offset fatigue.");
      else if (l.hours < 7) t.push("You slept under 7 hours. Aim for 7 to 9 hours to support energy and metabolism.");
      if (l.hours > 9) t.push("You slept more than 9 hours. A steady schedule can help you feel more rested.");
      if (s.hyd < 60) t.push("Hydration is below target. Try a glass of water with each meal and between tasks.");
      if (bmi < 18.5) t.push("Your BMI is in the underweight band. Consider balanced meals with enough energy and protein.");
      if (bmi >= 25) t.push("Your BMI is above the normal band. Gradual changes in activity and nutrition tend to work best.");
      if (l.quality && l.quality <= 2) t.push("You rated your rest as low. A consistent schedule and less screen time before bed may help.");
      if (!t.length) t.push("Hydration and sleep targets met! Maintain physical activity to match your BMR baseline.");
    } else {
      t.push("Drink water regularly throughout the day.", "Maintain a consistent sleep schedule.",
             "Complete your BMI, water and sleep logs to get personalized suggestions.");
    }
    $("tipsList").innerHTML = t.map(x => "<li>" + x + "</li>").join("");
  };
  const renderHistory = () => {
    let r = "";
    for (let i = 6; i >= 0; i--) {
      const k = dateKey(i), l = D.logs[k] || {}, sc = dayScore(l);
      r += "<tr><td>" + k + "</td><td>" + (l.hours !== undefined ? l.hours.toFixed(1) + " h" : "-") +
        "</td><td>" + (l.water !== undefined ? l.water.toFixed(2) + " L" : "-") +
        "</td><td>" + (l.weight ? l.weight + " kg" : "-") + "</td><td>" + (sc ? sc.total : "-") + "</td></tr>";
    }
    $("historyBody").innerHTML = r;
  };
  const renderWellness = () => {
    const l = D.logs[dateKey()] || {}, s = dayScore(l), miss = [];
    if (!D.profile) miss.push("calculate your BMI on the BMI & BMR page");
    if (l.water === undefined) miss.push("log your water on the Water page");
    if (l.hours === undefined) miss.push("save your sleep on the Sleep page");
    $("missingMsg").textContent = miss.length ? "To get your score, " + miss.join(", ") + "." : "";
    $("bmiScoreVal").textContent = D.profile ? Math.round(bmiScore(l.weight || D.profile.weight)) + " / 100" : "Not calculated";
    $("hydVal").textContent = l.water !== undefined ? Math.round(hydScore(l)) + " / 100" : "Not calculated";
    $("sleepVal").textContent = l.hours !== undefined ? Math.round(slpScore(l.hours)) + " / 100" : "Not calculated";
    if (s) {
      $("scoreVal").textContent = s.total + " / 100"; $("scoreMeter").value = s.total;
      const st = s.total >= 80 ? ["Optimal Balance", "#22b07d"] : s.total >= 60 ? ["Good, room to improve", "#c27a00"] : ["Needs Attention", "#dc4b4b"];
      $("statusVal").textContent = st[0]; $("statusVal").style.color = st[1];
    } else {
      $("scoreVal").textContent = "Not calculated"; $("scoreMeter").value = 0;
      $("statusVal").textContent = "Not available"; $("statusVal").style.color = "";
    }
    renderTips(l, s); renderHistory();
  };
  $("sampleBtn").onclick = () => {
    if (!D.profile) D.profile = { height: 175, weight: 72, age: 20, sex: "male" };
    const hrs = [6, 5.5, 7, 6.5, 8, 7.5, 5, 6, 7, 7.5, 6.5, 8, 7, 7.5],
          wat = [1.4, 1.6, 1.9, 1.5, 2.2, 2.0, 1.2, 1.7, 1.8, 2.1, 1.6, 2.3, 2.0, 2.1];
    for (let i = 13; i >= 1; i--)
      D.logs[dateKey(i)] = { hours: hrs[13 - i], water: wat[13 - i], weight: round2(72.8 - i * 0.05 + (i % 3) * 0.2), quality: 2 + (i % 4) };
    save(); renderWellness();
  };
  $("clearBtn").onclick = () => {
    if (confirm("Delete all saved BodyBlueprint data from this browser?")) { D = { profile: null, goal: null, logs: {} }; save(); renderWellness(); }
  };
  renderWellness();
}