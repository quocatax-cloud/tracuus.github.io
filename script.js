let rawData = [];
let currentFile = "dbhc.txt";
let lastResult = [];

const input = document.getElementById("searchInput");
const tbody = document.getElementById("results");
const thead = document.getElementById("table-head");
const tabs = document.querySelectorAll(".tab");

/* =====================
   1. CHUẨN HÓA TIẾNG VIỆT (Hỗ trợ tìm kiếm không dấu)
===================== */
function normalize(str) {
    if (!str) return "";
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
   2. LOAD FILE TXT (Thêm tham số chống Cache cho Mobile)
===================== */
async function loadFile(file) {
    input.value = "";
    tbody.innerHTML = "<tr><td colspan='3' style='text-align:center'>Đang tải dữ liệu...</td></tr>";
    rawData = [];

    try {
        // Thêm ?v=... để điện thoại luôn tải file mới nhất từ GitHub
        const res = await fetch(`data/${file}?v=${new Date().getTime()}`);
        if (!res.ok) throw new Error("Không tìm thấy file");
        const text = await res.text();

        rawData = text.split(/\r?\n/).filter(x => x.trim());
        buildHeader(file);
        tbody.innerHTML = ""; // Xóa dòng thông báo đang tải
    } catch (err) {
        tbody.innerHTML = `<tr><td colspan='3' style='color:red; text-align:center'>Lỗi: Không tải được file data/${file}</td></tr>`;
    }
}

// Khởi tạo lần đầu
loadFile(currentFile);

/* =====================
   3. HEADER TABLE (Cấu trúc lại tiêu đề)
===================== */
function buildHeader(file) {
    if (file === "dbhc.txt")
        thead.innerHTML = "<th>Mã</th><th>Phường / Xã</th><th>Tỉnh / Huyện</th>";
    else if (file === "kbnn.txt")
        thead.innerHTML = "<th>Tên Kho bạc</th><th>Mã</th><th>Tỉnh</th>";
    else if (file === "faq.txt")
        thead.innerHTML = "<th style='width:25%'>Câu hỏi</th><th style='width:55%'>Hướng dẫn xử lý</th><th style='width:20%'>Ảnh</th>";
    else
        thead.innerHTML = "<th>Mã</th><th>Ngân hàng</th>";
}

/* =====================
   4. LOGIC TÌM KIẾM
===================== */
function searchNormal(keyword) {
    const q = normalize(keyword);
    const keys = q.split(" ");
    let results = [];

    for (let line of rawData) {
        const n = normalize(line);
        let score = 0;
        if (n.includes(q)) score += 100; // Khớp chính xác cụm từ
        keys.forEach(k => {
            if (n.includes(k)) score += 20; // Khớp từng từ rời
        });

        if (score > 0) results.push({ line, score });
    }
    results.sort((a, b) => b.score - a.score);
    return results;
}

/* =====================
   5. HIỂN THỊ KẾT QUẢ & XỬ LÝ ẢNH
===================== */
input.addEventListener("input", () => {
    tbody.innerHTML = "";
    const keyword = input.value.trim();
    if (!keyword) return;

    let results = searchNormal(keyword);
    const keys = normalize(keyword).split(" ");

    results.forEach(obj => {
        const cols = obj.line.split('\t');
        const tr = document.createElement("tr");

        cols.forEach((col, index) => {
            const td = document.createElement("td");
            let html = col;

            // Highlight từ khóa (không highlight cột ảnh)
            if (!(currentFile === "faq.txt" && index === 2)) {
                keys.forEach(k => {
                    if (k.length > 1) {
                        const reg = new RegExp(`(${k})`, "gi");
                        html = html.replace(reg, "<mark>$1</mark>");
                    }
                });
                td.innerHTML = html;
            } else {
                // Hiển thị ảnh cho file FAQ
                td.innerHTML = `<img src="data/images/${col}" style="width:100px; border-radius:4px; cursor:pointer" onerror="this.style.display='none'" onclick="window.open(this.src)">`;
            }
            tr.appendChild(td);
        });

        // Click để Copy
        tr.onclick = () => {
            let textToCopy = (currentFile === "faq.txt") ? cols[1].replace(/<br>/g, '\n') : cols[0];
            navigator.clipboard.writeText(textToCopy).then(() => {
                alert("Đã copy nội dung!");
            });
        };
        tbody.appendChild(tr);
    });
});

/* =====================
   6. CHUYỂN TAB (Sửa lỗi cho điện thoại)
===================== */
tabs.forEach(tab => {
    tab.addEventListener("click", function() {
        tabs.forEach(t => t.classList.remove("active"));
        this.classList.add("active");
        currentFile = this.dataset.file;
        loadFile(currentFile);
    });
});
