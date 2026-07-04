// ---------- DATA MODEL ----------
let tasks = [];
let currentFilter = "all";
let pomodoroInterval = null;
let pomodoroSeconds = 25 * 60;
let pomodoroActive = false;
let chartInstance = null;

// Load from localStorage
function loadData() {
  const saved = localStorage.getItem("studyTasksFull");
  if(saved) {
    try {
      tasks = JSON.parse(saved);
      if(!Array.isArray(tasks)) tasks = [];
    } catch(e) { tasks = []; }
  } else {
    // sample demo data
    tasks = [
      { id: 1001, subject: "Mathematics", description: "Complete calculus exercises", dueDate: new Date(Date.now()+86400000).toISOString().slice(0,16), priority: "High", completed: false, completedDate: null, createdAt: new Date().toISOString() },
      { id: 1002, subject: "Physics", description: "Read thermodynamics", dueDate: new Date().toISOString().slice(0,16), priority: "Medium", completed: false, completedDate: null, createdAt: new Date().toISOString() }
    ];
  }
  updateStreak();
  render();
}
function saveToLocal() { localStorage.setItem("studyTasksFull", JSON.stringify(tasks)); }

function getTodayDateStr() { return new Date().toISOString().slice(0,10); }
function isOverdue(task) {
  if(task.completed) return false;
  if(!task.dueDate) return false;
  const taskDateOnly = task.dueDate.slice(0,10);
  return taskDateOnly < getTodayDateStr();
}
function updateStreak() {
  let streak = 0;
  const doneDates = tasks.filter(t => t.completed && t.completedDate).map(t => t.completedDate).sort();
  let last = null;
  for(let d of doneDates) {
    if(last === null) { streak=1; last=d; }
    else {
      const diff = (new Date(d) - new Date(last)) / (1000*3600*24);
      if(diff === 1) streak++;
      else if(diff > 1) streak=1;
      last=d;
    }
  }
  document.getElementById("streakCount").innerText = streak;
  return streak;
}
function addTaskObj(subject, desc, dueDate, dueTime, priority) {
  let fullDue = null;
  if(dueDate) fullDue = dueTime ? `${dueDate}T${dueTime}` : `${dueDate}T23:59`;
  const newTask = {
    id: Date.now(),
    subject: subject.trim() || "General",
    description: desc.trim(),
    dueDate: fullDue,
    priority: priority,
    completed: false,
    createdAt: new Date().toISOString(),
    completedDate: null
  };
  tasks.push(newTask);
  saveToLocal();
  render();
}

function render() {
  let filtered = [...tasks];
  if(currentFilter === "pending") filtered = tasks.filter(t => !t.completed);
  else if(currentFilter === "completed") filtered = tasks.filter(t => t.completed);
  else if(currentFilter === "high") filtered = tasks.filter(t => t.priority === "High" && !t.completed);
  else if(currentFilter === "overdue") filtered = tasks.filter(t => !t.completed && isOverdue(t));
  else filtered = tasks;
  
  const taskListEl = document.getElementById("taskList");
  if(!taskListEl) return;
  if(filtered.length === 0) { taskListEl.innerHTML = `<li class="p-5 text-center text-gray-400"><i class="fas fa-smile-wink"></i> No tasks found</li>`; }
  else {
    taskListEl.innerHTML = filtered.map(task => `
      <li class="task-item p-4 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 flex flex-wrap justify-between items-center gap-3 transition-all">
        <div class="flex-1 min-w-[160px]">
          <div class="flex items-center gap-2 flex-wrap">
            <span class="font-semibold ${task.completed ? 'line-through text-gray-400 dark:text-gray-500' : 'dark:text-gray-200'}">${escapeHtml(task.subject)}: ${escapeHtml(task.description)}</span>
            ${task.priority === 'High' ? '<span class="bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-300 text-xs px-2 py-0.5 rounded-full">🔥 High</span>' : task.priority === 'Medium' ? '<span class="bg-yellow-100 dark:bg-yellow-900/50 text-yellow-700 dark:text-yellow-300 text-xs px-2 rounded-full">⚡ Medium</span>' : '<span class="bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300 text-xs px-2 rounded-full">🍃 Low</span>'}
            ${!task.completed && isOverdue(task) ? '<span class="bg-rose-200 dark:bg-rose-900/50 text-rose-700 dark:text-rose-300 text-xs px-2 rounded-full">⚠️ Overdue</span>' : ''}
          </div>
          <div class="text-xs text-gray-500 dark:text-gray-400 mt-1">${task.dueDate ? `📅 ${new Date(task.dueDate).toLocaleString()}` : 'No deadline'} </div>
        </div>
        <div class="flex gap-2 items-center">
          <button onclick="toggleComplete(${task.id})" class="px-3 py-1.5 rounded-lg text-sm transition ${task.completed ? 'bg-gray-300 dark:bg-gray-600 text-gray-700 dark:text-gray-200' : 'bg-indigo-100 dark:bg-indigo-800/70 text-indigo-700 dark:text-indigo-200 hover:bg-indigo-200'}"><i class="fas ${task.completed ? 'fa-undo-alt' : 'fa-check-circle'}"></i> ${task.completed ? 'Undo' : 'Done'}</button>
          <button onclick="deleteTask(${task.id})" class="text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 bg-red-50 dark:bg-red-900/30 px-2 py-1 rounded-full"><i class="fas fa-trash"></i></button>
        </div>
      </li>
    `).join("");
  }
  // stats update
  const total = tasks.length;
  const completedCount = tasks.filter(t=>t.completed).length;
  const overdueCount = tasks.filter(t=>!t.completed && isOverdue(t)).length;
  document.getElementById("totalTasks").innerText = total;
  document.getElementById("completedTasks").innerText = completedCount;
  document.getElementById("overdueTasks").innerText = overdueCount;
  const percent = total === 0 ? 0 : (completedCount/total)*100;
  document.getElementById("progress").style.width = `${percent}%`;
  document.getElementById("completionPercent").innerText = `${Math.round(percent)}%`;
  updateStreak();
  if(chartInstance) chartInstance.destroy();
  const canvas = document.getElementById("completionChart");
  if(canvas && document.getElementById("analyticsContainer") && !document.getElementById("analyticsContainer").classList.contains("hidden")) {
    const ctx = canvas.getContext("2d");
    chartInstance = new Chart(ctx, { type: 'doughnut', data: { labels: ['Completed', 'Pending'], datasets: [{ data: [completedCount, total-completedCount], backgroundColor: ['#4f46e5', '#cbd5e1'], borderWidth: 0 }] }, options: { responsive: true, maintainAspectRatio: true } });
  }
  saveToLocal();
}
window.toggleComplete = (id) => {
  const idx = tasks.findIndex(t=>t.id===id);
  if(idx!==-1){
    tasks[idx].completed = !tasks[idx].completed;
    if(tasks[idx].completed) tasks[idx].completedDate = new Date().toISOString().slice(0,10);
    else tasks[idx].completedDate = null;
    saveToLocal();
    render();
  }
};
window.deleteTask = (id)=>{ tasks = tasks.filter(t=>t.id!==id); saveToLocal(); render(); };
function addTaskAndClear(){
  const subject = document.getElementById("subject").value;
  const desc = document.getElementById("taskInput").value;
  if(!desc.trim()){ alert("Please enter task description"); return; }
  const date = document.getElementById("dueDate").value;
  const time = document.getElementById("dueTime").value;
  const priority = document.getElementById("priority").value;
  addTaskObj(subject, desc, date, time, priority);
  document.getElementById("subject").value = "";
  document.getElementById("taskInput").value = "";
  document.getElementById("dueDate").value = "";
  document.getElementById("dueTime").value = "";
  document.getElementById("priority").value = "Medium";
}
function escapeHtml(str) { if(!str) return ''; return str.replace(/[&<>]/g, function(m){if(m==='&') return '&amp;'; if(m==='<') return '&lt;'; if(m==='>') return '&gt;'; return m;}); }
// Filters listeners dynamic
document.querySelectorAll("[data-filter]").forEach(btn => {
  btn.addEventListener("click", (e)=>{
    document.querySelectorAll("[data-filter]").forEach(b => b.classList.remove("active","bg-indigo-600","text-white"));
    btn.classList.add("active","bg-indigo-600","text-white");
    currentFilter = btn.getAttribute("data-filter");
    render();
  });
});
// Pomodoro logic
function updatePomodoroDisplay(){ document.getElementById("pomodoroDisplay").innerText = `${Math.floor(pomodoroSeconds/60)}:${(pomodoroSeconds%60).toString().padStart(2,'0')}`; }
window.startPomodoro = ()=>{ if(pomodoroInterval) clearInterval(pomodoroInterval); pomodoroActive=true; pomodoroInterval = setInterval(()=>{ if(pomodoroSeconds<=0){ clearInterval(pomodoroInterval); alert("🍅 Pomodoro finished! Great focus. Take a break."); resetPomodoro(); } else { pomodoroSeconds--; updatePomodoroDisplay(); } },1000); };
window.pausePomodoro = ()=>{ if(pomodoroInterval) clearInterval(pomodoroInterval); pomodoroActive=false; };
window.resetPomodoro = ()=>{ if(pomodoroInterval) clearInterval(pomodoroInterval); pomodoroSeconds=25*60; updatePomodoroDisplay(); pomodoroActive=false; };
// AI Suggestion
window.giveSuggestion = ()=>{
  const pending = tasks.filter(t=>!t.completed);
  if(pending.length===0) document.getElementById("aiText").innerHTML = "🎉 Masterful! No pending tasks. Start a new subject or reward yourself.";
  else { const highPrio = pending.filter(t=>t.priority==='High'); if(highPrio.length) document.getElementById("aiText").innerHTML = `🧠 Priority alert: Study "${highPrio[0].description}" (${highPrio[0].subject}). High impact!`; else document.getElementById("aiText").innerHTML = `📘 Today's focus: ${pending[0].subject} - ${pending[0].description}. Use pomodoro technique 🍅`; }
};
// Chat assistant
window.toggleChatbot = ()=>{ const div = document.getElementById("chatbotContainer"); div.classList.toggle("hidden"); if(!div.classList.contains("hidden") && document.getElementById("chatMessages").innerHTML==="") document.getElementById("chatMessages").innerHTML='<div class="text-gray-500">🤖 Hello! Ask me study tips, motivation, or how to manage tasks.</div>'; };
window.sendChatMessage = async () => {

  const input = document.getElementById("chatInput");
  const msg = input.value.trim();

  if (!msg) return;

  const container = document.getElementById("chatMessages");

  // User message
  container.innerHTML += `
    <div class="mb-2">
      <strong>You:</strong> ${msg}
    </div>
  `;

  input.value = "";

  // Loading
  container.innerHTML += `
    <div id="loading">
      🤖 Thinking...
    </div>
  `;

  container.scrollTop = container.scrollHeight;

  try {

    const response = await fetch(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        method: "POST",

        headers: {
          "Content-Type": "application/json",

          // 👇 APNI API KEY YAHA PASTE KARO
          "Authorization": "Bearer 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"
        },

        body: JSON.stringify({
          model: "llama-3.1-8b-instant",

          messages: [
            {
              role: "user",
              content: msg
            }
          ]
        })
      }
    );

    const data = await response.json();

    document.getElementById("loading").remove();

    const reply =
      data.choices?.[0]?.message?.content ||
      "No response";

    container.innerHTML += `
      <div class="mb-2 text-indigo-600">
        <strong>AI:</strong> ${reply}
      </div>
    `;

    container.scrollTop = container.scrollHeight;

  } catch (error) {

    console.log(error);

    document.getElementById("loading").remove();

    container.innerHTML += `
      <div class="text-red-500">
        Error connecting to AI
      </div>
    `;
  }
};// Import / Export functions (full)
function exportAllData(){ const dataStr = JSON.stringify({version:"2.0",exportDate:new Date(), tasks}); const blob = new Blob([dataStr],{type:"application/json"}); const url=URL.createObjectURL(blob); const a=document.createElement("a"); a.href=url; a.download=`study_plan_${Date.now()}.json`; a.click(); URL.revokeObjectURL(url);}
function triggerImportFile(){ document.getElementById("importFileInput").click(); }
window.handleFullImport = (event) => { const file = event.target.files[0]; if(!file) return; const reader = new FileReader(); reader.onload = e=>{ try { const content = e.target.result; let importedTasks=null; if(file.name.endsWith('.json')) { const parsed = JSON.parse(content); if(parsed.tasks && Array.isArray(parsed.tasks)) importedTasks = parsed.tasks; else if(Array.isArray(parsed)) importedTasks = parsed; } else if(file.name.endsWith('.csv')){ importedTasks = parseCSVtoTasks(content); } else { const guess = tryParseAny(content); if(guess) importedTasks = guess; } if(importedTasks && importedTasks.length){ tasks = importedTasks.map(t=>({...t, id:t.id||Date.now()+Math.random()})); saveToLocal(); render(); alert(`Imported ${tasks.length} tasks!`); } else throw new Error("no tasks"); } catch(err){ alert("Could not parse file. Ensure valid format."); } }; reader.readAsText(file); };
function parseCSVtoTasks(csv){ const lines = csv.split("\n"); const tasksArr=[]; for(let i=1;i<lines.length;i++){ if(lines[i].trim()){ const parts=lines[i].split(","); if(parts.length>=2){ tasksArr.push({ id:Date.now()+i, subject:parts[0]||"CSV", description:parts[1]||"Task", dueDate:parts[2]||null, priority:["Low","Medium","High"].includes(parts[3])?parts[3]:"Medium", completed:false, completedDate:null }); } } } return tasksArr;}
function tryParseAny(text){ if(text.includes('"tasks"')) try { const json=JSON.parse(text); if(json.tasks) return json.tasks; } catch(e){} return null; }
window.exportAsCSV = ()=>{ let csv = "Subject,Description,DueDate,Priority\n"; tasks.forEach(t=>{ csv+=`"${t.subject}","${t.description}",${t.dueDate||""},${t.priority}\n`; }); downloadBlob(csv,"tasks_export.csv","text/csv"); };
window.exportAsBackup = ()=>{ exportAllData(); };
window.exportAsText = ()=>{ let txt = "📚 AI STUDY PLAN EXPORT\n"; tasks.forEach(t=>{ txt+=`- ${t.subject}: ${t.description} [${t.priority}] ${t.completed?"✓":"✗"} ${t.dueDate||""}\n`; }); downloadBlob(txt,"study_plan.txt","text/plain"); };
window.exportAsHTML = ()=>{ let html = `<html><body><h1>Study Tasks</h1><ul>${tasks.map(t=>`<li>${t.subject} - ${t.description} (${t.priority}) ${t.completed?"✅":"⏳"}</li>`).join('')}</ul></body></html>`; downloadBlob(html,"study_report.html","text/html"); };
function downloadBlob(content, filename, mime){ const blob = new Blob([content],{type:mime}); const a=document.createElement("a"); a.href=URL.createObjectURL(blob); a.download=filename; a.click(); URL.revokeObjectURL(blob); }
window.clearAllTasks = ()=>{ if(confirm("Delete ALL tasks permanently?")){ tasks = []; saveToLocal(); render(); } };
// Analytics & Calendar
window.showAnalytics = ()=>{ document.getElementById("analyticsContainer").classList.remove("hidden"); document.getElementById("calendarContainer").classList.add("hidden"); const completedCount = tasks.filter(t=>t.completed).length; const ctx = document.getElementById("completionChart").getContext("2d"); if(chartInstance) chartInstance.destroy(); chartInstance = new Chart(ctx, { type: 'doughnut', data: { labels: ['Completed', 'Pending'], datasets: [{ data: [completedCount, tasks.length-completedCount], backgroundColor: ['#4f46e5', '#94a3b8'] }] } }); };
window.showCalendar = ()=>{ document.getElementById("analyticsContainer").classList.add("hidden"); document.getElementById("calendarContainer").classList.remove("hidden"); const calDiv = document.getElementById("calendarContainer"); const today = new Date(); const year = today.getFullYear(); const month = today.getMonth(); const firstDay = new Date(year, month, 1).getDay(); const daysInMonth = new Date(year, month+1, 0).getDate(); let html = `<div class="text-center font-bold mb-2">${today.toLocaleString('default', { month: 'long' })} ${year}</div><div class="calendar-grid">${['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d=>`<div class="text-center text-xs font-semibold">${d}</div>`).join('')}`; for(let i=0;i<firstDay;i++) html+=`<div></div>`; for(let d=1;d<=daysInMonth;d++){ const dateStr = `${year}-${String(month+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`; const tasksOnDay = tasks.filter(t=>t.dueDate && t.dueDate.startsWith(dateStr)); html+=`<div class="border rounded-lg p-2 text-center text-xs calendar-day bg-indigo-50 dark:bg-slate-700/60 hover:bg-indigo-100 dark:hover:bg-indigo-800/60 transition"><span class="font-bold">${d}</span>${tasksOnDay.length?`<div class="text-[10px] text-indigo-600 dark:text-indigo-400 mt-1">📌${tasksOnDay.length}</div>`:''}</div>`; } html+=`</div>`; calDiv.innerHTML = html; };
// Drag drop
const dropZone = document.getElementById("dropZone");
dropZone.addEventListener("dragover",(e)=>{ e.preventDefault(); dropZone.classList.add("drop-zone-active"); });
dropZone.addEventListener("dragleave",()=>{ dropZone.classList.remove("drop-zone-active"); });
dropZone.addEventListener("drop",(e)=>{ e.preventDefault(); dropZone.classList.remove("drop-zone-active"); const file = e.dataTransfer.files[0]; if(file){ const fakeEvent = { target: { files: [file] } }; handleFullImport(fakeEvent); } });
// Dark mode toggle (fully clickable)
const darkToggle = document.getElementById("darkModeToggle");
darkToggle.addEventListener("click", () => {
  document.body.classList.toggle("dark");
  const isDark = document.body.classList.contains("dark");
  localStorage.setItem("darkMode", isDark);
  const icon = darkToggle.querySelector("i");
  if(isDark) { icon.classList.remove("fa-moon"); icon.classList.add("fa-sun"); darkToggle.querySelector("span").innerText = "Light mode"; }
  else { icon.classList.remove("fa-sun"); icon.classList.add("fa-moon"); darkToggle.querySelector("span").innerText = "Dark mode"; }
});
if(localStorage.getItem("darkMode") === "true") document.body.classList.add("dark");
// initial active filter styling
document.querySelector("[data-filter='all']").classList.add("active","bg-indigo-600","text-white");
loadData();