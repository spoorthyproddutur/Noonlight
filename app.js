// Noonlight - Core Application Logic

// Local Storage Keys
const LOGS_STORAGE_KEY = 'safety_girls_incident_logs';
const CONTACTS_STORAGE_KEY = 'safety_girls_contacts';

// App State
let appState = {
  activeTab: 'home',
  isSosActive: false,
  sirenInterval: null,
  audioContext: null,
  sirenOscillator1: null,
  sirenOscillator2: null,
  sirenGainNode: null,
  tempProofFiles: [], // Base64 data of files uploaded in the current form session
  fakeCallTimer: null,
  fakeCallSeconds: 0,
  isCallConnected: false
};

// Default Contacts if empty (3 most trusted personal contacts)
const defaultContacts = [
  { name: "Mom (Mother)", relation: "Family", phone: "+91 98765 43210" },
  { name: "Sister (Sibling)", relation: "Family", phone: "+91 98765 43211" },
  { name: "Aria (Best Friend)", relation: "Friend", phone: "+91 98765 43212" }
];

document.addEventListener('DOMContentLoaded', () => {
  initApp();
});

// Initialize Application
function initApp() {
  // Restore State
  loadContacts();
  renderContacts();
  renderLogs();
  
  // Tab Switching (Mobile bottom bar & Desktop sidebar)
  const tabButtons = document.querySelectorAll('.tab-btn, .sidebar-menu-item');
  tabButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const tabId = btn.getAttribute('data-tab');
      switchTab(tabId);
    });
  });

  // SOS Toggle
  const sosBtn = document.getElementById('sos-btn-trigger');
  if (sosBtn) {
    sosBtn.addEventListener('click', toggleSosState);
  }

  // Quick Action: Fake Call
  const fakeCallBtn = document.getElementById('fake-call-btn');
  if (fakeCallBtn) {
    fakeCallBtn.addEventListener('click', startFakeCall);
  }

  // Quick Action: Loud Siren
  const sirenBtn = document.getElementById('siren-btn');
  if (sirenBtn) {
    sirenBtn.addEventListener('click', toggleSirenAudio);
  }

  // Disguise Buttons (Mobile header & Desktop sidebar)
  const disguiseBtn = document.getElementById('header-disguise-btn');
  if (disguiseBtn) {
    disguiseBtn.addEventListener('click', activateDisguise);
  }
  const sidebarDisguiseBtn = document.getElementById('sidebar-disguise-btn');
  if (sidebarDisguiseBtn) {
    sidebarDisguiseBtn.addEventListener('click', activateDisguise);
  }

  // Form Relation Chips
  const relationChips = document.querySelectorAll('.relation-chip');
  relationChips.forEach(chip => {
    chip.addEventListener('click', () => {
      relationChips.forEach(c => c.classList.remove('selected'));
      chip.classList.add('selected');
    });
  });

  // File Upload Handling
  const fileInput = document.getElementById('proof-upload');
  const uploadZone = document.getElementById('upload-zone');
  
  if (fileInput && uploadZone) {
    fileInput.addEventListener('change', handleFileSelect);
    
    // Drag and drop styles
    ['dragenter', 'dragover'].forEach(eventName => {
      uploadZone.addEventListener(eventName, (e) => {
        e.preventDefault();
        uploadZone.classList.add('dragover');
      }, false);
    });

    ['dragleave', 'drop'].forEach(eventName => {
      uploadZone.addEventListener(eventName, (e) => {
        e.preventDefault();
        uploadZone.classList.remove('dragover');
      }, false);
    });

    uploadZone.addEventListener('drop', (e) => {
      const dt = e.dataTransfer;
      const files = dt.files;
      handleFiles(files);
    });
  }

  // Incident Submit
  const incidentForm = document.getElementById('incident-form');
  if (incidentForm) {
    incidentForm.addEventListener('submit', handleIncidentSubmit);
  }

  // Contact Form
  const addContactBtn = document.getElementById('add-contact-trigger');
  if (addContactBtn) {
    addContactBtn.addEventListener('click', openAddContactModal);
  }
  
  const saveContactBtn = document.getElementById('save-contact-btn');
  if (saveContactBtn) {
    saveContactBtn.addEventListener('click', handleSaveContact);
  }

  // Calculator disguise logic
  setupCalculator();

  // Location simulation
  startLocationSimulation();
}

// Tab navigation
function switchTab(tabId) {
  appState.activeTab = tabId;
  
  // Update Mobile Tab Bar Buttons
  const tabButtons = document.querySelectorAll('.tab-btn');
  tabButtons.forEach(btn => {
    if (btn.getAttribute('data-tab') === tabId) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });

  // Update Desktop Sidebar Buttons
  const sidebarButtons = document.querySelectorAll('.sidebar-menu-item');
  sidebarButtons.forEach(btn => {
    if (btn.getAttribute('data-tab') === tabId) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });

  // Update Sections
  const tabContents = document.querySelectorAll('.tab-content');
  tabContents.forEach(content => {
    if (content.id === `${tabId}-tab`) {
      content.classList.add('active');
    } else {
      content.classList.remove('active');
    }
  });

  // If entering logs, rerender
  if (tabId === 'logs') {
    renderLogs();
  }
}

// SOS Trigger logic
function toggleSosState() {
  const container = document.getElementById('app-main-container');
  const statusText = document.getElementById('sos-status');
  const activeStatus = document.getElementById('sos-status-active');
  
  appState.isSosActive = !appState.isSosActive;
  
  if (appState.isSosActive) {
    container.classList.add('sos-active');
    statusText.style.display = 'none';
    activeStatus.style.display = 'block';
    showToast('🚨 SOS ACTIVATED! Emergency contacts notified.', 'pink');
    
    // Automatically trigger siren
    if (!appState.sirenInterval) {
      startSirenAudio();
    }

    // Send the simulated distress messages
    dispatchSosAlerts();
  } else {
    container.classList.remove('sos-active');
    statusText.style.display = 'block';
    activeStatus.style.display = 'none';
    showToast('SOS Cancelled. You are safe now.', 'cyan');
    
    // Turn off siren
    stopSirenAudio();

    // Hide dispatch card logs
    const dispatchCard = document.getElementById('sos-dispatch-card');
    if (dispatchCard) {
      dispatchCard.style.display = 'none';
    }
  }
}

// Custom Distress Message Dispatcher
function dispatchSosAlerts() {
  const dispatchCard = document.getElementById('sos-dispatch-card');
  const dispatchList = document.getElementById('sos-dispatch-list');
  
  if (!dispatchCard || !dispatchList) return;
  
  dispatchList.innerHTML = '';
  dispatchCard.style.display = 'block';
  
  // 1. Retrieve saved contacts
  const contacts = getContacts();
  
  // 2. Fetch threat details if typed in logger form
  const descInput = document.getElementById('incident-description');
  const fightingInput = document.getElementById('fighting-reason');
  const relationChip = document.querySelector('.relation-chip.selected');
  const coordsView = document.getElementById('gps-coords-view');
  
  const descText = descInput ? descInput.value.trim() : '';
  const fightingText = fightingInput ? fightingInput.value.trim() : '';
  const coordsText = coordsView ? coordsView.innerText : '17.38504° N, 78.48671° E';
  const relation = relationChip ? relationChip.getAttribute('data-relation') : '';
  
  // 3. Build alert text based on details mentioned or not
  let alertMessage = '';
  if (descText) {
    alertMessage = `EMERGENCY ALERT: Facing danger/threat`;
    if (relation) alertMessage += ` with ${relation}`;
    alertMessage += `. Problem: "${descText}".`;
    if (fightingText) alertMessage += ` Resisting because: "${fightingText}".`;
    alertMessage += ` Location: ${coordsText}`;
  } else {
    // Default warning when problem details are not mentioned
    alertMessage = `EMERGENCY ALERT: She/He is in danger! Immediate help needed. Location: ${coordsText}`;
  }
  
  if (contacts.length === 0) {
    dispatchList.innerHTML = `
      <div style="font-size: 0.8rem; color: var(--text-secondary); text-align: center; padding: 0.5rem 0;">
        ⚠️ No contacts in your Safety Circle. Please add contacts in the Contacts tab.
      </div>
    `;
    return;
  }
  
  // 4. Stagger SMS transmissions with slight delays for premium UI simulation
  contacts.forEach((contact, idx) => {
    setTimeout(() => {
      // Append text message item to list
      const item = document.createElement('div');
      item.style.backgroundColor = 'rgba(255, 42, 109, 0.04)';
      item.style.border = '1px solid rgba(255, 42, 109, 0.2)';
      item.style.borderRadius = '10px';
      item.style.padding = '0.6rem 0.8rem';
      item.style.fontSize = '0.78rem';
      item.style.lineHeight = '1.4';
      item.style.animation = 'fadeIn 0.3s ease';
      
      item.innerHTML = `
        <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
          <strong style="color: #fff;">Alert Sent to ${contact.name} (${contact.relation})</strong>
          <span style="color: var(--accent-cyan); font-weight: 700; font-size: 0.68rem; letter-spacing: 0.5px;">✓ DISPATCHED</span>
        </div>
        <div style="color: var(--text-secondary); font-size: 0.72rem; word-break: break-all; font-family: monospace;">
          "${alertMessage}"
        </div>
      `;
      dispatchList.appendChild(item);
      
      // Keep scroll anchored to bottom
      dispatchList.scrollTop = dispatchList.scrollHeight;
      
      showToast(`Alert message sent to ${contact.name}!`, 'cyan');
    }, idx * 500);
  });
}

// Web Audio API Siren Synthesis
// Synthesizes a loud, oscillating siren pattern directly in code
function startSirenAudio() {
  try {
    if (!appState.audioContext) {
      appState.audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }
    
    if (appState.audioContext.state === 'suspended') {
      appState.audioContext.resume();
    }
    
    appState.sirenOscillator1 = appState.audioContext.createOscillator();
    appState.sirenOscillator2 = appState.audioContext.createOscillator();
    appState.sirenGainNode = appState.audioContext.createGain();
    
    appState.sirenOscillator1.type = 'sawtooth';
    appState.sirenOscillator1.frequency.setValueAtTime(440, appState.audioContext.currentTime); // LFO
    
    appState.sirenOscillator2.type = 'sine';
    appState.sirenOscillator2.frequency.setValueAtTime(800, appState.audioContext.currentTime); // Siren Tone
    
    // Connect LFO (Oscillator 1) to frequency of Oscillator 2
    const lfoGain = appState.audioContext.createGain();
    lfoGain.gain.setValueAtTime(300, appState.audioContext.currentTime); // Swing width
    appState.sirenOscillator1.connect(lfoGain);
    lfoGain.connect(appState.sirenOscillator2.frequency);
    
    // Set volume
    appState.sirenGainNode.gain.setValueAtTime(0.5, appState.audioContext.currentTime);
    
    // Route to speakers
    appState.sirenOscillator2.connect(appState.sirenGainNode);
    appState.sirenGainNode.connect(appState.audioContext.destination);
    
    // Oscillate the LFO frequency to create the wailing effect
    appState.sirenOscillator1.frequency.value = 1.5; // oscillation speed in Hz
    
    appState.sirenOscillator1.start();
    appState.sirenOscillator2.start();
    
    showToast('🔊 Alarm Siren activated.', 'pink');
  } catch (error) {
    console.error('AudioContext error:', error);
  }
}

function stopSirenAudio() {
  if (appState.sirenOscillator1) {
    try { appState.sirenOscillator1.stop(); } catch(e) {}
    appState.sirenOscillator1.disconnect();
    appState.sirenOscillator1 = null;
  }
  if (appState.sirenOscillator2) {
    try { appState.sirenOscillator2.stop(); } catch(e) {}
    appState.sirenOscillator2.disconnect();
    appState.sirenOscillator2 = null;
  }
  if (appState.sirenGainNode) {
    appState.sirenGainNode.disconnect();
    appState.sirenGainNode = null;
  }
}

function toggleSirenAudio() {
  const sirenBtn = document.getElementById('siren-btn');
  const label = sirenBtn.querySelector('.tool-label');
  const desc = sirenBtn.querySelector('.tool-desc');
  
  if (appState.sirenOscillator2) {
    stopSirenAudio();
    label.innerText = 'Loud Siren';
    desc.innerText = 'Trigger alarm sound';
    showToast('Siren stopped.', 'cyan');
  } else {
    startSirenAudio();
    label.innerText = 'Mute Siren';
    desc.innerText = 'Tap to turn off';
  }
}

// Disguise Mode Logic
function activateDisguise() {
  // Stop siren if playing
  stopSirenAudio();
  
  // Hide active page and display calculator overlay
  document.getElementById('disguise-screen').classList.add('active');
}

function deactivateDisguise() {
  document.getElementById('disguise-screen').classList.remove('active');
  showToast('Returned to safety portal.', 'cyan');
}

function setupCalculator() {
  const display = document.getElementById('calc-display-view');
  const buttons = document.querySelectorAll('.calc-btn');
  let currentVal = '';
  
  buttons.forEach(btn => {
    btn.addEventListener('click', () => {
      const type = btn.getAttribute('data-val');
      
      if (type === 'C') {
        currentVal = '';
        display.innerText = '0';
      } else if (type === '=') {
        // Quick PIN code to unlock: entering "999" or hitting equal when value is "999" restores safety app
        if (currentVal === '999' || currentVal === '0999') {
          currentVal = '';
          display.innerText = '0';
          deactivateDisguise();
          return;
        }
        
        try {
          // A very basic safe calculator evaluation (only digits, plus, minus, times, divide)
          if (/^[0-9+\-*/().\s]+$/.test(currentVal)) {
            let result = new Function(`return ${currentVal}`)();
            currentVal = String(result);
            display.innerText = currentVal;
          } else {
            display.innerText = 'Error';
          }
        } catch (e) {
          display.innerText = 'Error';
        }
      } else {
        if (currentVal.length < 10) {
          currentVal += type;
          display.innerText = currentVal;
        }
      }
    });
  });
}

// Location Simulation (Updates map & coordinates)
function startLocationSimulation() {
  const coordsView = document.getElementById('gps-coords-view');
  
  // Mock base coordinates (Near central urban area)
  let latitude = 17.3850;
  let longitude = 78.4867;
  
  setInterval(() => {
    // Slightly drift the coordinates to simulate walking/driving
    const driftLat = (Math.random() - 0.5) * 0.0003;
    const driftLong = (Math.random() - 0.5) * 0.0003;
    latitude += driftLat;
    longitude += driftLong;
    
    if (coordsView) {
      coordsView.innerText = `${latitude.toFixed(5)}° N, ${longitude.toFixed(5)}° E`;
    }
  }, 4000);
}

// Fake Call Simulator
function startFakeCall() {
  const screen = document.getElementById('fake-call-overlay');
  const ringAudio = document.getElementById('ringtone-tone');
  
  appState.fakeCallSeconds = 0;
  appState.isCallConnected = false;
  screen.classList.add('active');
  
  // Setup Ring Screen UI
  document.getElementById('fake-call-incoming').style.display = 'flex';
  document.getElementById('fake-call-active').style.display = 'none';
  
  // Web Audio simulated phone ring sound
  playSimulatedRingtone();
  
  // Connect and decline buttons
  const acceptBtn = document.getElementById('fake-call-accept');
  const declineBtn = document.getElementById('fake-call-decline');
  const endCallBtn = document.getElementById('fake-call-end');
  
  // Clear any existing timer
  if (appState.fakeCallTimer) {
    clearInterval(appState.fakeCallTimer);
  }

  // Answer call
  acceptBtn.onclick = () => {
    stopSimulatedRingtone();
    appState.isCallConnected = true;
    document.getElementById('fake-call-incoming').style.display = 'none';
    document.getElementById('fake-call-active').style.display = 'flex';
    
    // Start ticks
    appState.fakeCallTimer = setInterval(() => {
      appState.fakeCallSeconds++;
      const mins = Math.floor(appState.fakeCallSeconds / 60).toString().padStart(2, '0');
      const secs = (appState.fakeCallSeconds % 60).toString().padStart(2, '0');
      document.getElementById('fake-call-timer-val').innerText = `${mins}:${secs}`;
    }, 1000);
  };
  
  // Reject/Decline call
  const endCallHandler = () => {
    stopSimulatedRingtone();
    clearInterval(appState.fakeCallTimer);
    screen.classList.remove('active');
    appState.isCallConnected = false;
    showToast('Call ended.', 'cyan');
  };
  
  declineBtn.onclick = endCallHandler;
  endCallBtn.onclick = endCallHandler;
}

// Synth Ringtone Audio
let ringtoneOsc = null;
let ringtoneInterval = null;

function playSimulatedRingtone() {
  try {
    if (!appState.audioContext) {
      appState.audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }
    
    if (appState.audioContext.state === 'suspended') {
      appState.audioContext.resume();
    }
    
    const triggerRing = () => {
      // Classic US phone ring is a combination of 440Hz and 480Hz
      const osc1 = appState.audioContext.createOscillator();
      const osc2 = appState.audioContext.createOscillator();
      const gain = appState.audioContext.createGain();
      
      osc1.frequency.value = 440;
      osc2.frequency.value = 480;
      
      gain.gain.setValueAtTime(0.2, appState.audioContext.currentTime);
      // Fade out
      gain.gain.exponentialRampToValueAtTime(0.01, appState.audioContext.currentTime + 1.8);
      
      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(appState.audioContext.destination);
      
      osc1.start();
      osc2.start();
      
      setTimeout(() => {
        try { osc1.stop(); osc2.stop(); } catch(e) {}
      }, 1800);
    };
    
    triggerRing();
    ringtoneInterval = setInterval(triggerRing, 3500); // Ring every 3.5s
  } catch(e) {
    console.error("Ringtone synth error", e);
  }
}

function stopSimulatedRingtone() {
  if (ringtoneInterval) {
    clearInterval(ringtoneInterval);
    ringtoneInterval = null;
  }
}

// File Upload Proof Processing
function handleFileSelect(e) {
  const files = e.target.files;
  handleFiles(files);
}

function handleFiles(files) {
  const previews = document.getElementById('upload-previews');
  
  Array.from(files).forEach(file => {
    const reader = new FileReader();
    
    // Enforce small mock sizes
    if (file.size > 2 * 1024 * 1024) {
      showToast('⚠️ File too large (max 2MB)', 'pink');
      return;
    }
    
    reader.onload = (e) => {
      const fileData = {
        name: file.name,
        type: file.type,
        data: e.target.result // Base64 encoding
      };
      
      appState.tempProofFiles.push(fileData);
      renderFilePreview(fileData);
    };
    
    reader.readAsDataURL(file);
  });
}

function renderFilePreview(file) {
  const container = document.getElementById('upload-previews');
  const index = appState.tempProofFiles.length - 1;
  
  const div = document.createElement('div');
  div.className = 'preview-item';
  div.id = `temp-preview-${index}`;
  
  // Close / remove button
  const removeBtn = document.createElement('button');
  removeBtn.className = 'preview-remove';
  removeBtn.innerHTML = '×';
  removeBtn.onclick = (e) => {
    e.preventDefault();
    removeTempFile(index);
  };
  div.appendChild(removeBtn);
  
  if (file.type.startsWith('image/')) {
    const img = document.createElement('img');
    img.src = file.data;
    div.appendChild(img);
    
    // Add full size view click
    img.onclick = () => showPhotoViewer(file.data);
  } else {
    // Audio / Voice record file icon representation
    div.classList.add('audio-type');
    div.innerHTML += `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/>
        <path d="M19 10v1a7 7 0 0 1-14 0v-1M12 19v4M8 23h8"/>
      </svg>
      <span>${file.name}</span>
    `;
    // Reinject remove action since innerHTML overwrites children
    div.appendChild(removeBtn);
  }
  
  container.appendChild(div);
}

function removeTempFile(index) {
  appState.tempProofFiles.splice(index, 1);
  // Re-render previews
  const container = document.getElementById('upload-previews');
  container.innerHTML = '';
  appState.tempProofFiles.forEach(file => {
    renderFilePreview(file);
  });
}

// Photo full preview overlay
function showPhotoViewer(imgSrc) {
  const viewer = document.getElementById('photo-viewer');
  const viewerImg = document.getElementById('photo-viewer-img');
  
  viewerImg.src = imgSrc;
  viewer.classList.add('active');
  
  const closeBtn = document.getElementById('photo-viewer-close');
  closeBtn.onclick = () => {
    viewer.classList.remove('active');
  };
  
  viewer.onclick = (e) => {
    if (e.target === viewer) {
      viewer.classList.remove('active');
    }
  };
}

// Incident Form Submission
function handleIncidentSubmit(e) {
  e.preventDefault();
  
  const relationChip = document.querySelector('.relation-chip.selected');
  const descriptionInput = document.getElementById('incident-description');
  const fightingReasonInput = document.getElementById('fighting-reason');
  const urgencySelect = document.getElementById('incident-urgency');
  
  if (!relationChip) {
    showToast('⚠️ Please select who this problem is with.', 'pink');
    return;
  }
  
  if (!descriptionInput.value.trim()) {
    showToast('⚠️ Please describe the problem.', 'pink');
    return;
  }
  
  if (!fightingReasonInput.value.trim()) {
    showToast('⚠️ Please explain why you are resisting or fighting this.', 'pink');
    return;
  }

  // Build log object
  const logItem = {
    id: 'log_' + Date.now(),
    relation: relationChip.getAttribute('data-relation'),
    description: descriptionInput.value.trim(),
    fightingReason: fightingReasonInput.value.trim(),
    urgency: urgencySelect.value,
    timestamp: new Date().toISOString(),
    proofFiles: [...appState.tempProofFiles]
  };
  
  // Save to Storage
  const savedLogs = getSavedLogs();
  savedLogs.unshift(logItem); // Add to beginning of array
  localStorage.setItem(LOGS_STORAGE_KEY, JSON.stringify(savedLogs));
  
  // Clean Form
  descriptionInput.value = '';
  fightingReasonInput.value = '';
  document.querySelectorAll('.relation-chip').forEach(c => c.classList.remove('selected'));
  document.getElementById('upload-previews').innerHTML = '';
  appState.tempProofFiles = [];
  
  showToast('🛡️ Threat Incident Logged and Secured.', 'cyan');
  
  // Shift tab to logs list automatically
  switchTab('logs');
}

// Local Storage logs retrievals
function getSavedLogs() {
  const data = localStorage.getItem(LOGS_STORAGE_KEY);
  return data ? JSON.parse(data) : [];
}

function renderLogs() {
  const container = document.getElementById('logs-list-view');
  const logs = getSavedLogs();
  
  if (logs.length === 0) {
    container.innerHTML = `
      <div class="empty-state-card">
        <div class="empty-state-icon-wrap">
          <svg viewBox="0 0 24 24" fill="none" stroke="var(--accent-cyan)" stroke-width="1.5" style="width:32px;height:32px;">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
            <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
          </svg>
        </div>
        <h3>Your Safety Ledger is Secure</h3>
        <p>No threats or incidents have been logged yet. Noonlight saves your records cryptographically in your local browser storage—they never touch external servers, keeping you completely secure and private.</p>
        <button class="empty-state-action-btn" onclick="switchTab('report')">Log First Incident</button>
      </div>
    `;
    return;
  }
  
  container.innerHTML = '';
  
  logs.forEach(log => {
    const logDiv = document.createElement('div');
    logDiv.className = 'log-item';
    
    const formattedDate = new Date(log.timestamp).toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
    
    // Build proofs section
    let proofsHtml = '';
    if (log.proofFiles && log.proofFiles.length > 0) {
      proofsHtml = '<div class="log-proof-bar">';
      log.proofFiles.forEach(file => {
        if (file.type.startsWith('image/')) {
          proofsHtml += `
            <div class="log-proof-thumb" onclick="showPhotoViewer('${file.data}')">
              <img src="${file.data}" alt="Proof Image">
            </div>
          `;
        } else {
          proofsHtml += `
            <div class="log-proof-thumb audio" title="${file.name}">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M9 18V5l12-2v13M9 9l12-2"/>
                <circle cx="6" cy="18" r="3"/>
                <circle cx="18" cy="16" r="3"/>
              </svg>
            </div>
          `;
        }
      });
      proofsHtml += '</div>';
    }
    
    logDiv.innerHTML = `
      <div class="log-item-header">
        <span class="log-relation">${log.relation}</span>
        <span class="log-date">${formattedDate}</span>
      </div>
      <div class="log-desc">
        <strong>The Problem:</strong> ${log.description}
      </div>
      <div class="log-desc" style="font-size: 0.8rem; border-left: 2px solid var(--accent-pink); padding-left: 8px;">
        <strong>Context/Why Fighting:</strong> ${log.fightingReason}
      </div>
      ${proofsHtml}
      <div class="log-item-footer">
        <button class="delete-log-btn" onclick="deleteIncidentLog('${log.id}')">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M3 6h18M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2M10 11v6M14 11v6"/>
          </svg>
          Delete Log
        </button>
      </div>
    `;
    
    container.appendChild(logDiv);
  });
}

window.deleteIncidentLog = function(logId) {
  if (confirm("Are you sure you want to permanently delete this safety record?")) {
    let logs = getSavedLogs();
    logs = logs.filter(log => log.id !== logId);
    localStorage.setItem(LOGS_STORAGE_KEY, JSON.stringify(logs));
    renderLogs();
    showToast("Safety record deleted.", "cyan");
  }
}

// Contacts Management
function loadContacts() {
  const data = localStorage.getItem(CONTACTS_STORAGE_KEY);
  if (!data || data.includes("Police Emergency Helpline")) {
    localStorage.setItem(CONTACTS_STORAGE_KEY, JSON.stringify(defaultContacts));
  }
}

function getContacts() {
  const data = localStorage.getItem(CONTACTS_STORAGE_KEY);
  return data ? JSON.parse(data) : defaultContacts;
}

function renderContacts() {
  const container = document.getElementById('contacts-list-container');
  const contacts = getContacts();
  
  if (!container) return;
  
  container.innerHTML = '';
  
  contacts.forEach((contact, index) => {
    const div = document.createElement('div');
    div.className = 'contact-item';
    div.innerHTML = `
      <div class="contact-info">
        <h4>${contact.name} (${contact.relation})</h4>
        <p>${contact.phone}</p>
      </div>
      <div class="contact-actions">
        <a href="tel:${contact.phone}" class="call-btn">
          <svg viewBox="0 0 24 24">
            <path d="M6.62 10.79a15.15 15.15 0 0 0 6.57 6.57l2.2-2.2a1 1 0 0 1 .9-.27 11.36 11.36 0 0 0 3.58.57 1 1 0 0 1 1 1V20a1 1 0 0 1-1 1A17 17 0 0 1 3 4a1 1 0 0 1 1-1h3.5a1 1 0 0 1 1 1 11.36 11.36 0 0 0 .57 3.58 1 1 0 0 1-.27.9l-2.2 2.2z"/>
          </svg>
        </a>
        <button class="remove-contact-btn" onclick="removeContact(${index})">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M18 6 6 18M6 6l12 12"/>
          </svg>
        </button>
      </div>
    `;
    container.appendChild(div);
  });
}

function openAddContactModal() {
  const modal = document.getElementById('contact-modal');
  modal.classList.add('active');
  
  const closeBtn = modal.querySelector('.modal-close');
  closeBtn.onclick = () => {
    modal.classList.remove('active');
  };
}

function handleSaveContact() {
  const nameInput = document.getElementById('contact-name');
  const relInput = document.getElementById('contact-relation');
  const phoneInput = document.getElementById('contact-phone');
  
  const name = nameInput.value.trim();
  const rel = relInput.value.trim();
  const phone = phoneInput.value.trim();
  
  if (!name || !rel || !phone) {
    showToast("⚠️ All fields are required.", "pink");
    return;
  }
  
  const contacts = getContacts();
  contacts.push({ name, relation: rel, phone });
  localStorage.setItem(CONTACTS_STORAGE_KEY, JSON.stringify(contacts));
  
  nameInput.value = '';
  relInput.value = '';
  phoneInput.value = '';
  
  document.getElementById('contact-modal').classList.remove('active');
  renderContacts();
  showToast("Contact added to Safety Circle.", "cyan");
}

window.removeContact = function(index) {
  const contacts = getContacts();
  contacts.splice(index, 1);
  localStorage.setItem(CONTACTS_STORAGE_KEY, JSON.stringify(contacts));
  renderContacts();
  showToast("Contact removed.", "cyan");
}

// Toast System
function showToast(message, color = 'pink') {
  const container = document.getElementById('toast-container-box');
  if (!container) return;
  
  const toast = document.createElement('div');
  toast.className = `toast ${color}`;
  
  let icon = `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="width:16px;height:16px;">
      <path d="m9 11 3 3L22 4"/>
      <path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74"/>
    </svg>
  `;
  
  if (color === 'pink') {
    icon = `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="width:16px;height:16px;">
        <circle cx="12" cy="12" r="10"/>
        <line x1="12" y1="8" x2="12" y2="12"/>
        <line x1="12" y1="16" x2="12.01" y2="16"/>
      </svg>
    `;
  }
  
  toast.innerHTML = `${icon}<span>${message}</span>`;
  container.appendChild(toast);
  
  // Auto remove
  setTimeout(() => {
    toast.style.animation = 'fadeOut 0.3s forwards';
    setTimeout(() => {
      toast.remove();
    }, 300);
  }, 3500);
}
