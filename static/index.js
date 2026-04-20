let currentView = "storage";  
let currentFiles = [];
let allFiles = [];
let favoriteFiles = [];

function loadFiles() {
    currentView = "storage";

    setActive("nav-storage");
    document.querySelector(".categories").style.display = "flex";

    document.getElementById("emptyTrashBtn").style.display = "none";

    document.getElementById("fileList").innerHTML = "Loading...";


    fetch('/files')
    .then(res => res.json())
    .then(data => {
        allFiles = data.files;
        currentFiles = allFiles;
        displayFiles(currentFiles);

        if (data.total_storage_mb !== undefined) {
        updateStorage(data.total_storage_mb / 1024);
        }
    });
}


function previewFile(file) {
    let preview = document.getElementById("previewContent");

    let filename = file.name || file;

    if (filename.endsWith(".jpg") || filename.endsWith(".png")) {
        preview.innerHTML = `
            <img src="/download/${filename}" 
                 style="width:100%; border-radius:10px;">
        `;
    } 
    else if (filename.endsWith(".mp4")) {
        preview.innerHTML = `
            <video controls style="width:100%; border-radius:10px;">
                <source src="/download/${filename}" type="video/mp4">
            </video>
        `;
    }
    else if (filename.endsWith(".mp3")) {
        preview.innerHTML = `
            <audio controls style="width:100%">
                <source src="/download/${filename}">
            </audio>
        `;
    }
    else {
        preview.innerHTML = `<p>${filename}</p>`;
    }
}



let dropZone = document.getElementById("dropZone");
let fileInput = document.getElementById("fileInput");

fileInput.addEventListener("change", () => {
    uploadFile(fileInput.files[0]);
});

dropZone.onclick = () => fileInput.click();

dropZone.addEventListener("dragover", e => {
    e.preventDefault();
    dropZone.style.background = "#1e293b";
});

dropZone.addEventListener("drop", e => {
    e.preventDefault();
    uploadFile(e.dataTransfer.files[0]);
});


function uploadFile(file) {
    let formData = new FormData();
    formData.append("file", file);

    let xhr = new XMLHttpRequest();

    xhr.upload.addEventListener("progress", e => {
        if (e.lengthComputable) {
            let percent = Math.round((e.loaded / e.total) * 100);
            document.getElementById("uploadProgress").style.width = percent + "%";
        }
    });

    xhr.onload = () => {
        document.getElementById("uploadProgress").style.width = "0%";
        loadFiles();
    };

    xhr.open("POST", "/upload");
    xhr.send(formData);
}


function updateStorage(used) {
    let total = 100; // GB

    let percent = Math.min((used / total) * 100, 100);

    document.getElementById("storageCircle").style.background =
        `conic-gradient(#6366f1 ${percent}%, #334155 0%)`;

    document.getElementById("storageCircle").innerText =
        Math.round(percent) + "%";

    document.getElementById("storageText").innerText =
        used.toFixed(2) + "GB / 100GB";
}


function getIcon(filename) {
    filename = filename.toLowerCase();

    if (filename.endsWith(".jpg") || filename.endsWith(".png")) return "🖼";
    if (filename.endsWith(".mp4") || filename.endsWith(".avi")) return "🎬";
    if (filename.endsWith(".mp3") || filename.endsWith(".wav")) return "🎵";
    if (filename.endsWith(".pdf") || filename.endsWith(".doc")) return "📄";

    return "📁";
}


document.getElementById("search").addEventListener("input", function () {
    if (currentView !== "storage") return;

    let value = this.value.toLowerCase();

    let filtered = currentFiles.filter(file =>
        file.name.toLowerCase().includes(value)
    );

    displayFiles(filtered);
});


function loadTrash() {
    currentView = "trash";

    setActive("nav-trash");
    document.getElementById("emptyTrashBtn").style.display = "block";
    document.querySelector(".categories").style.display = "none";


    fetch('/trash')
    .then(res => res.json())
    .then(data => {

        currentFiles = data.files;

        let list = document.getElementById("fileList");
        list.innerHTML = "";

        data.files.forEach(file => {
            let li = document.createElement("li");

            li.innerHTML = `
                🗑 ${file.name}
                <button onclick="restoreFile('${file.name}')">Restore</button>
            `;

            list.appendChild(li);
        });
    });
}


function setActive(tab) {
    document.querySelectorAll(".sidebar li").forEach(el => {
        el.classList.remove("active");
    });

    document.getElementById(tab).classList.add("active");
}


function deleteFile(filename) {

    let confirmDelete = confirm("⚠️ Are you sure you want to move this file to Trash?");

    if (!confirmDelete) {
        return; 
    }

    fetch(`/delete/${filename}`, { method: 'DELETE' })
    .then(() => loadFiles());
}

function clearTrash() {
    fetch('/clear-trash', { method: 'DELETE' })
    .then(res => res.json())
    .then(data => {
        console.log(data);
        loadTrash();
    })
    .catch(err => console.error("Error:", err));
}


function restoreFile(filename) {
    fetch(`/restore/${filename}`, { method: 'POST' })
    .then(() => loadTrash());
}


function addToRecent(filename) {
    let recents = JSON.parse(localStorage.getItem("recents")) || [];

    recents = recents.filter(f => f !== filename);

    recents.unshift(filename);

    recents = recents.slice(0, 10);

    localStorage.setItem("recents", JSON.stringify(recents));
}


function loadRecents() {
    currentView = "recents";

    setActive("nav-recents");
    document.getElementById("emptyTrashBtn").style.display = "none";
    document.querySelector(".categories").style.display = "flex";

    let recentNames = JSON.parse(localStorage.getItem("recents")) || [];

    currentFiles = recentNames.map(name =>
        allFiles.find(f => f.name === name)
    ).filter(Boolean);

    displayFiles(currentFiles);
}


function displayFiles(files) {
    let list = document.getElementById("fileList");
    list.innerHTML = "";

    files.forEach(file => {
        let li = document.createElement("li");
        li.className = "list-group-item d-flex justify-content-between align-items-center";

       li.innerHTML = `
        <div>
            ${getIcon(file.name)} 
            <strong>${file.name}</strong> 
            <small>(${file.size} KB)</small>
        </div>

        <div style="display:flex; gap:8px;">
            <button class="btn btn-sm btn-primary"
                onclick="previewFile('${file.name}')">👁</button>

            <a class="btn btn-sm btn-success"
                href="/download/${file.name}" target="_blank">⬇</a>

            <button class="btn btn-sm btn-danger"
                onclick="deleteFile('${file.name}')">🗑</button>

            <button class="btn btn-sm btn-warning"
                onclick="toggleFavorite('${file.name}')">
                ${favoriteFiles.includes(file.name) ? "⭐" : "☆"}
            </button>
        </div>
        `;

        list.appendChild(li);
    });
}


function toggleFavorite(filename) {
    if (favoriteFiles.includes(filename)) {
        favoriteFiles = favoriteFiles.filter(f => f !== filename);
    } else {
        favoriteFiles.push(filename);
    }

    if (currentView === "storage") {
        displayFiles(allFiles);
    } else if (currentView === "favorites") {
        loadFavorites();
    }
}


function loadFavorites() {
    currentView = "favorites";

    setActive("nav-favorites");
    document.getElementById("emptyTrashBtn").style.display = "none";
    document.querySelector(".categories").style.display = "flex";

    currentFiles = allFiles.filter(file =>
        favoriteFiles.includes(file.name)
    );

    displayFiles(currentFiles);
}


function loadOverview() {
    currentView = "overview";

    setActive("nav-overview");

    document.querySelector(".categories").style.display = "none";

    document.getElementById("emptyTrashBtn").style.display = "none";

    currentFiles = allFiles;   

    let list = document.getElementById("fileList");
    list.innerHTML = "";

    let total = currentFiles.length;

    let images = currentFiles.filter(f => f.type === "image").length;
    let videos = currentFiles.filter(f => f.type === "video").length;
    let audio = currentFiles.filter(f => f.type === "audio").length;

    list.innerHTML = `
        <div class="row text-center">
            <div class="col">
                <div class="card p-3">📁<br>Total<br>${total}</div>
            </div>
            <div class="col">
                <div class="card p-3">🖼<br>Images<br>${images}</div>
            </div>
            <div class="col">
                <div class="card p-3">🎬<br>Videos<br>${videos}</div>
            </div>
            <div class="col">
                <div class="card p-3">🎵<br>Audio<br>${audio}</div>
            </div>
        </div>
    `;
    
    setTimeout(() => {
        document.querySelector(".categories").style.display = "none";
    }, 0);
}


function formatSize(kb) {
    if (kb > 1024 * 1024) return (kb / (1024 * 1024)).toFixed(2) + " GB";
    if (kb > 1024) return (kb / 1024).toFixed(2) + " MB";
    return kb + " KB";
}

function filterFiles(type) {

  
    if (currentView === "overview") return;

    let filtered =
        type === "all"
        ? currentFiles
        : currentFiles.filter(file => file.type === type);

    displayFiles(filtered);
}



//shamil



/*function toggleSidebar() {
  const sidebar = document.querySelector(".sidebar");
  const main = document.querySelector(".main");
  const overlay = document.querySelector(".overlay");

  if (!sidebar || !main || !overlay) return;

  // Desktop toggle
  sidebar.classList.toggle("hide");
  main.classList.toggle("full");

  // Mobile toggle
  sidebar.classList.toggle("active");
  overlay.classList.toggle("show");
}*/






function toggleSidebar() {
  const sidebar = document.querySelector(".sidebar");
  const overlay = document.querySelector(".overlay");

  sidebar.classList.toggle("show");
  overlay.classList.toggle("show");
}


/*shamil2*/


/*function updateStorage(used, total) {
    let percent = (used / total) * 100;

    let circle = document.getElementById("storageCircle");
    let text = document.getElementById("storageText");
    let percentText = document.getElementById("storagePercent");

    circle.style.background =
        `conic-gradient(#a855f7 ${percent}%, #2e1065 ${percent}%)`;

    /*percentText.innerText = Math.round(percent) + "%";
    percentText.innerText = percent.toFixed(2) + "%";
    text.innerText = `${used}GB / ${total}GB`;
}

/* Example */
/*updateStorage(0.01, 100);*/





function updateStorage(used, total) {

   
    if (!total || total === 0) total = 100;

    used = Number(used);
    total = Number(total);

    let percent = (used / total) * 100;

    if (isNaN(percent)) percent = 0;

   
    let circle = document.getElementById("storageCircle");
    let percentText = document.getElementById("storagePercent");
    let text = document.getElementById("storageText");

    
    let visiblePercent = percent < 2 ? 2 : percent;

   
    circle.style.background =
        `conic-gradient(#a855f7 ${visiblePercent}%, #2e1065 ${visiblePercent}%)`;

  
    if (percent < 1 && percent > 0) {
        /*percentText.innerText = "<1%";*/
        percentText.innerText = percent.toFixed(2) + "%";
    } else {
        percentText.innerText = percent.toFixed(2) + "%";
    }

    function formatSize(sizeGB) {
        if (sizeGB < 1) {
            return (sizeGB * 1024).toFixed(2) + " MB";
        } else {
            return sizeGB.toFixed(2) + " GB";
        }
    }

    text.innerText = `${formatSize(used)} / ${formatSize(total)}`;
}



updateStorage(0.0114, 100);  




const fileURL = URL.createObjectURL(file);
showPreview(fileURL, "image");







function showPreview(url, type) {
    let preview = document.getElementById("previewContent");

   
    preview.innerHTML = `
        <div style="text-align:center; padding:20px;">
            <div class="spinner-border text-light"></div>
            <p>Loading preview...</p>
        </div>
    `;

   
    let media;

    if (type === "image") {
        media = new Image();
        media.src = url;
    } else if (type === "video") {
        media = document.createElement("video");
        media.src = url;
        media.controls = true;
    }

   
    media.onload = () => {
        preview.innerHTML = "";
        preview.appendChild(media);
    };

  
    media.onloadeddata = () => {
        preview.innerHTML = "";
        preview.appendChild(media);
    };
}