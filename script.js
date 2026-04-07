let rawData = [];
let currentFile = "dbhc.txt";
let lastResult = [];

const input = document.getElementById("searchInput");
const tbody = document.getElementById("results");
const thead = document.getElementById("table-head");
const tabs = document.querySelectorAll(".tab");

/* =====================
   CHUẨN HÓA TIẾNG VIỆT
===================== */
function normalize(str) {
    return str
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/đ/g, "d")
        .replace(/[^a-z0-9 ]/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}

/* =====================
   LOAD FILE TXT
===================== */
async function loadFile(file) {
    input.value = "";
    tbody.innerHTML = "";
    rawData = [];

    const res = await fetch("data/" + file);
    const text = await res.text();

    rawData = text.split(/\r?\n/).filter(x => x.trim());

    buildHeader(file);
}

loadFile(currentFile);

/* =====================
   HEADER TABLE
===================== */
function buildHeader(file) {
    if (file === "dbhc.txt")
        thead.innerHTML = "<th>Mã</th><th>Phường / Xã</th><th>Tỉnh / Huyện</th>";
    else if (file === "kbnn.txt")
        thead.innerHTML = "<th>Tên Kho bạc</th><th>Mã</th><th>Tỉnh</th>";
    else if (file === "faq.txt") // Thêm tiêu đề cho file mới
        thead.innerHTML = "<th style='width: 25%'>Câu hỏi</th><th style='width: 55%'>Hướng dẫn xử lý</th><th style='width: 20%'>Hình ảnh</th>";
    else
        thead.innerHTML = "<th>Mã</th><th>Ngân hàng</th>";
}

/* =====================
   SEARCH DBHC (ƯU TIÊN CAO)
===================== */
function searchDBHC(keyword) {

    const q = normalize(keyword);
    const keys = q.split(" ");

    let results = [];

    for (let line of rawData) {

        const cols = line.split(/\t| {2,}/);

        const ma = cols[0] || "";
        const ten = cols[1] || "";
        const tinh = cols[2] || "";

        const nTen = normalize(ten);
        const nTinh = normalize(tinh);
        const full = normalize(ten + " " + tinh);

        let score = 0;

        /* ==========================
           1. ĐÚNG Y TUYỆT ĐỐI
        ========================== */
        if (nTen === q) score += 1000;

        /* ==========================
           2. ĐÚNG CỤM
        ========================== */
        if (nTen.includes(q)) score += 800;

        /* ==========================
           3. KHỚP ĐỦ TỪ ĐÚNG THỨ TỰ
        ========================== */
        if (full.includes(q)) score += 600;

        /* ==========================
           4. ĐẢO TỪ (PHỤ)
        ========================== */
        const tenWords = nTen.split(" ");
        if (keys.length === tenWords.length) {
            const a = [...keys].sort().join(" ");
            const b = [...tenWords].sort().join(" ");
            if (a === b) score += 300;
        }

        /* ==========================
           5. TỪ RỜI
        ========================== */
        keys.forEach(k => {
            if (nTen.includes(k)) score += 80;
            if (nTinh.includes(k)) score += 40;
        });

        /* ==========================
           6. MÃ
        ========================== */
        if (ma.includes(keyword)) score += 900;

        if (score > 0)
            results.push({ line, score });
    }

    results.sort((a, b) => b.score - a.score);
    return results;
}

/* =====================
   SEARCH KHÁC
===================== */
function searchNormal(keyword) {

    const q = normalize(keyword);
    const keys = q.split(" ");

    let results = [];

    for (let line of rawData) {

        const n = normalize(line);
        let score = 0;

        if (n.includes(q)) score += 80;

        keys.forEach(k => {
            if (n.includes(k)) score += 20;
        });

        if (score > 0)
            results.push({ line, score });
    }

    results.sort((a, b) => b.score - a.score);
    return results.slice(0, 50);
}

/* =====================
   INPUT SEARCH
===================== */
input.addEventListener("input", () => {

    tbody.innerHTML = "";
    lastResult = [];

    const keyword = input.value.trim();
    if (!keyword) return;

    let results = [];

    if (currentFile === "dbhc.txt")
        results = searchDBHC(keyword);
    else
        results = searchNormal(keyword);

    lastResult = results;

    const keys = normalize(keyword).split(" ");

    results.forEach(obj => {
    // Tách cột bằng Tab (\t) để không bị lỗi khi nội dung có dấu cách
    const cols = obj.line.split('\t'); 
    const tr = document.createElement("tr");

    cols.forEach((col, index) => {
        const td = document.createElement("td");
        let html = col;

        // Chỉ highlight nếu không phải là cột ảnh
        if (!(currentFile === "faq.txt" && index === 2)) {
            keys.forEach(k => {
                if (k.length > 1) {
                    const reg = new RegExp(`(${k})`, "gi");
                    html = html.replace(reg, "<mark>$1</mark>");
                }
            });
        }

        // Xử lý riêng hiển thị ảnh cho cột thứ 3 của file faq.txt
        if (currentFile === "faq.txt" && index === 2) {
            // Giả sử bạn để ảnh trong thư mục data/images/
            td.innerHTML = `<img src="data/images/${col}" style="width:100%; max-width:150px; border-radius:4px; cursor:pointer" onclick="window.open(this.src)">`;
        } else {
            td.innerHTML = html;
        }

        tr.appendChild(td);
    });

    // Sửa lại logic click copy một chút cho hợp lý với FAQ
    tr.onclick = () => {
        if (currentFile === "faq.txt") {
            navigator.clipboard.writeText(cols[1].replace(/<br>/g, '\n')); // Copy nội dung hướng dẫn
            alert("Đã copy hướng dẫn xử lý!");
        } else {
            navigator.clipboard.writeText(cols[0]);
            alert("Đã copy: " + cols[0]);
        }
    };

    tbody.appendChild(tr);
});
/* =====================
   TAB SWITCH
===================== */
tabs.forEach(tab => {
    tab.onclick = () => {
        tabs.forEach(t => t.classList.remove("active"));
        tab.classList.add("active");
        currentFile = tab.dataset.file;
        loadFile(currentFile);
    };
});
