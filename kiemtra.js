/* =====================================================================
   Tab "Kiểm tra số liệu cân đối - Đà Nẵng"
   Lõi đối chiếu chuyển từ userscript KBNN Pro v8.0.8 (QuocTM-HTV).
   Chỉ tương tác qua file Excel: báo cáo số dư 12 COA và bộ TLPC.
   Không lưu gì vào trình duyệt: tải lại trang là về cài đặt ban đầu.
   ===================================================================== */
(function () {
    'use strict';

    // ---------------------------------------------------------------
    // CÀI ĐẶT CỐ ĐỊNH (người dùng không sửa được)
    // ---------------------------------------------------------------
    const FIXED = {
        nguong: 1000,                 // chênh quá số đồng này ở một cấp thì xét lệch số tiền
        tolLamTron: 0.00001,          // % đã khớp: chênh ≤ max(nguong, 0,001% PS có) là do làm tròn
        tkThu: ['7111', '7114'],       // tài khoản thu đối chiếu TLPC
        tkGTGC: ['7113'],              // ghi thu ghi chi: chỉ liệt kê, không đối chiếu
        tkTreo: ['3391', '3969', '3911', '3399'],
        maxShow: 300
    };
    const PASS_HASH = '2ad5e49bfd82ec05b86129f27f305af4ebf0a4e187d5c85b174e49dcbece5622';
    const DEFAULT_TLPC_URL = 'data/BO_QUY_TAC_TLPC_DANANG_2026.xlsx';
    const DEFAULT_TLPC_NAME = 'BO_QUY_TAC_TLPC_DANANG_2026.xlsx';
    const DATA_URL = 'kiemtra-data.js';

    // =================================================================
    // LÕI ĐỐI CHIẾU
    // =================================================================
    function makeCore(D, XLSX) {
        const escHtml = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
        const norm = s => String(s == null ? '' : s).normalize('NFC').replace(/\s+/g, ' ').trim().toLowerCase();
        const fmtNum = n => (n === null || n === undefined || isNaN(n)) ? '—' : Math.round(Number(n)).toLocaleString('vi-VN');
        const pad3 = n => String(n).padStart(3, '0');
        const extractMaSo = text => {
            const m = String(text == null ? '' : text).trim().match(/^(\d+)/);
            return m ? m[1] : String(text == null ? '' : text).trim();
        };
        const splitDvsd = s => {
            const str = String(s || '').trim();
            const i = str.indexOf('_');
            return i > 0 ? { code: str.slice(0, i).trim(), name: str.slice(i + 1).trim() } : { code: extractMaSo(str), name: str };
        };
        const parseMoney = text => {
            let s = String(text == null ? '' : text).trim();
            if (!s) return 0;
            const neg = /^-/.test(s) || (/^\(/.test(s) && /\)$/.test(s));
            s = s.replace(/[.,]\d{1,2}\)?$/, '');
            const v = parseInt(s.replace(/[^\d]/g, ''), 10) || 0;
            return neg ? -v : v;
        };

        // ---- MLNS ----
        const TM = {}, MUC = {}, MUC_CHILD = {}, CHUONG = {};
        D.MLNS_MUC.forEach(([c, n]) => { MUC[c] = n; });
        D.MLNS_TM.forEach(([c, n, m]) => { TM[c] = { n, m }; (MUC_CHILD[m] = MUC_CHILD[m] || []).push(c); });
        D.MLNS_CHUONG.forEach(([c, n]) => { CHUONG[String(parseInt(c, 10))] = n; });
        const tenNDKT = c => (TM[c] && TM[c].n) || MUC[c] || '';
        const tenChuong = c => CHUONG[String(parseInt(c, 10))] || '';

        // ---- ĐBHC ----
        const DB_CODE = {}, DB_NAME = {};
        D.DBHC_DN.forEach(([c, n]) => { DB_CODE[c] = n; DB_NAME[norm(n)] = c; });
        const tenDBHC = code => DB_CODE[code] || '';
        function resolveDbhcText(t) {
            const n = norm(t);
            if (!n || n.includes('tất cả') || n.includes('còn lại') || /^\d{1,3}$/.test(n)) return { kind: 'general' };
            const m = n.match(/^(\d{5})/);
            if (m) return { kind: 'code', code: m[1] };
            const c = DB_NAME[n];
            return c ? { kind: 'code', code: c } : { kind: 'unknown' };
        }

        // ---- Nhóm cơ quan thu ----
        const NHOM = {
            THUE_TP: 'Thuế TP', THUE_CS: 'Thuế cơ sở', CQ_TP: 'Cơ quan TP',
            CQ_XA: 'Cơ quan cấp xã', TW: 'Cơ quan TW', HQ: 'Hải quan', KHAC: 'Khác'
        };
        const nhomLabel = n => n.startsWith('DV:') ? `ĐVSD ${n.slice(3)}` : (NHOM[n] || n);
        function inferNhomCQT(text) {
            let s = norm(text);
            const out = new Set();
            if (!s) return [];
            if (/^[\d\s,;]+$/.test(s)) { s.split(/[\s,;]+/).filter(Boolean).forEach(c => out.add('DV:' + c)); return [...out]; }
            (s.match(/\d{7}/g) || []).forEach(c => out.add('DV:' + c));
            const take = (re, n) => { if (re.test(s)) { out.add(n); s = s.replace(re, ' '); } };
            take(/hải quan/g, 'HQ');
            take(/thuế\s*(thành phố|tp(?![a-z]))/g, 'THUE_TP');
            take(/thuế\s*cơ sở/g, 'THUE_CS');
            take(/trung ương|(^|[^a-z])tw(?![a-z])/g, 'TW');
            take(/cấp xã|xã quản lý/g, 'CQ_XA');
            take(/thành phố|(^|[^a-z])tp(?![a-z])|sở tài chính|^sở\s/g, 'CQ_TP');
            return [...out];
        }
        function inferNhomDVSD(name) {
            const n = norm(name);
            if (/hải quan/.test(n)) return 'HQ';
            if (/thuế\s*(thành phố|tp(?![a-z]))/.test(n)) return 'THUE_TP';
            if (/thuế\s*cơ sở/.test(n)) return 'THUE_CS';
            if (/^bộ\s|trung ương|^tòa án|^viện kiểm sát|^công an/.test(n)) return 'TW';
            if (/^sở\s|ủy ban nhân dân thành phố|hội đồng nhân dân thành phố|thành phố đà nẵng$/.test(n)) return 'CQ_TP';
            if (/(^|\s)xã(\s|$)|(^|\s)phường(\s|$)|đặc khu/.test(n)) return 'CQ_XA';
            return 'KHAC';
        }

        // ---- Danh mục TLPC ----
        function parseNdktSpec(s) {
            const iv = []; let tier = 0;
            String(s || '').split(/[,;]+/).forEach(part => {
                const p = part.trim(); if (!p) return;
                let m = p.match(/^(\d+)\s*-\s*(\d+)$/);
                if (m) { const a = +m[1], b = +m[2]; iv.push([Math.min(a, b), Math.max(a, b)]); tier = 1; return; }
                m = p.match(/^\d+$/);
                if (m) iv.push([+p, +p]);
            });
            return { iv, tier };
        }
        const _prepCache = new WeakMap();
        function prepDM(rows) {
            if (_prepCache.has(rows)) return _prepCache.get(rows);
            const list = rows.map(r => {
                const nd = parseNdktSpec(r.ndkt);
                return Object.assign({}, r, {
                    _iv: nd.iv, _tier: nd.tier, _db: resolveDbhcText(r.dbhc),
                    _w: (r.den - r.tu), _nh: new Set(r.nhom || []),
                    _rk: `${+r.tw}/${+r.tinh}/${+r.xa}`
                });
            });
            _prepCache.set(rows, list);
            return list;
        }
        function findConflicts(rows) {
            const P = prepDM(rows);
            const scope = r => r._db.kind === 'code' ? r._db.code : r._db.kind;
            const res = {};
            for (let i = 0; i < P.length; i++) {
                const A = P[i];
                for (let k = i + 1; k < P.length; k++) {
                    const B = P[k];
                    if (A._tier !== B._tier || A._rk === B._rk || A._w !== B._w) continue;
                    if (A.den < B.tu || B.den < A.tu) continue;
                    if (scope(A) !== scope(B)) continue;
                    if (!A._iv.some(([a1, b1]) => B._iv.some(([a2, b2]) => a1 <= b2 && a2 <= b1))) continue;
                    const nhOver = !A._nh.size || !B._nh.size || [...A._nh].some(n => B._nh.has(n));
                    if (!nhOver) continue;
                    (res[A.id] = res[A.id] || []).push(B.id);
                    (res[B.id] = res[B.id] || []).push(A.id);
                }
            }
            return res;
        }

        // ---- Đối chiếu một nhóm ----
        // Ô "Cơ quan thu" để trống = dòng áp dụng cho mọi cơ quan thu.
        function matchCore(P, q) {
            const nd = parseInt(q.ndkt, 10);
            const c1 = P.filter(r => r._iv.some(([a, b]) => nd >= a && nd <= b));
            if (!c1.length) return { kind: 'NF', loai: 'NDKT' };
            const c2 = c1.filter(r => q.chuong >= r.tu && q.chuong <= r.den);
            if (!c2.length) {
                const ranges = [...new Set(c1.map(r => `${pad3(r.tu)}-${pad3(r.den)}`))].sort();
                return { kind: 'NF', loai: 'CHUONG', ranges };
            }
            const spec = c2.filter(r => r._db.kind === 'code' && r._db.code === q.dbhc);
            const gen = c2.filter(r => r._db.kind === 'general');
            if (!spec.length && !gen.length) {
                return { kind: 'NF', loai: 'DBHC', dbhcs: [...new Set(c2.map(r => r.dbhc))] };
            }
            const cqOk = r => !r._nh.size || [...r._nh].some(n => q.dvSet.has(n));
            let pool = [spec.filter(cqOk), gen.filter(cqOk)].find(x => x.length);
            let cqtKhac = false;
            if (!pool) { pool = spec.length ? spec : gen; cqtKhac = true; }
            if (pool.some(r => r._tier === 0)) pool = pool.filter(r => r._tier === 0);
            if (new Set(pool.map(r => r._rk)).size > 1) {
                const w = Math.min(...pool.map(r => r._w));
                const p2 = pool.filter(r => r._w === w);
                if (new Set(p2.map(r => r._rk)).size > 1) return { kind: 'MO_HO', options: p2, cqtKhac, pool: p2 };
                pool = p2;
            }
            return { kind: 'OK', row: pool[0], cqtKhac, pool };
        }
        // Lệch thật: % làm tròn khác quy định, có cấp khác, hoặc số tiền chênh vượt ngưỡng làm tròn.
        // Chênh làm tròn: % đã khớp, chỉ lệch vài đồng do TABMIS làm tròn từng chứng từ.
        function compareRates(g, exp, nguong) {
            const diff = {}, pctKeys = [], dongKeys = [];
            const tol = Math.max(nguong, Math.round(Math.abs(g.tong) * FIXED.tolLamTron));
            ['tw', 'tinh', 'xa'].forEach(k => {
                const ky = Math.round(g.tong * (+exp[k]) / 100);
                diff[k] = g.cap[k] - ky;
                if (Math.round(g.pct[k]) !== Math.round(+exp[k])) pctKeys.push(k);
                else if (Math.abs(diff[k]) > nguong) dongKeys.push(k);
            });
            const khac = !!g.cap.khac;
            const lamTron = !pctKeys.length && !khac && dongKeys.length > 0 && dongKeys.every(k => Math.abs(diff[k]) <= tol);
            const lechKeys = lamTron ? [] : pctKeys.concat(dongKeys, khac ? ['khac'] : []);
            return { diff, lechKeys, pctKeys, dongKeys, tol, lamTron, lech: lechKeys.length > 0 };
        }
        // Cơ quan thu là tiêu chí xác định TLPC: nếu danh mục chỉ có quy định cho
        // cơ quan thu khác thì luôn báo "Thiếu CQT", kể cả khi tỉ lệ trùng.
        function evaluateGroup(g, P, nguong) {
            if (g.nhom === 'HQ') {
                const exp = { tw: 100, tinh: 0, xa: 0 };
                const c = compareRates(g, exp, nguong);
                return Object.assign({ kind: c.lech ? 'LECH' : (c.lamTron ? 'LAM_TRON' : 'DUNG'), exp, src: 'Quy tắc Hải quan: 100% TW' }, c);
            }
            const m = matchCore(P, { ndkt: g.ndkt, chuong: g.chuongNum, dbhc: g.dbhc, dvSet: g.dvSet });
            if (m.kind === 'NF') return m;
            if (m.cqtKhac) {
                const refs = [], seen = new Set();
                m.pool.forEach(r => { const k = r._rk + '|' + (r.nhom || []).join(','); if (!seen.has(k)) { seen.add(k); refs.push(r); } });
                if (m.kind === 'OK') {
                    const r = m.row;
                    const exp = { tw: +r.tw, tinh: +r.tinh, xa: +r.xa };
                    return Object.assign({ kind: 'NF', loai: 'CQT', refs, exp, row: r }, compareRates(g, exp, nguong));
                }
                return { kind: 'NF', loai: 'CQT', refs };
            }
            if (m.kind === 'MO_HO') {
                const khop = m.options.filter(r => !compareRates(g, r, nguong).lech);
                return Object.assign(m, { khop });
            }
            const r = m.row;
            const exp = { tw: +r.tw, tinh: +r.tinh, xa: +r.xa };
            const c = compareRates(g, exp, nguong);
            const kind = c.lech ? 'LECH' : (r.status === 'pending' ? 'TAM_KHOP' : (c.lamTron ? 'LAM_TRON' : 'DUNG'));
            return Object.assign({ kind, exp, row: r, cqtKhac: false }, c);
        }

        // ---- Gợi ý tỉ lệ (chỉ để tham khảo) ----
        function suggestRates(g, P) {
            const out = [];
            if (g.ev && g.ev.loai === 'CQT' && g.ev.refs) {
                g.ev.refs.slice(0, 3).forEach(r => out.push({
                    tw: +r.tw, tinh: +r.tinh, xa: +r.xa,
                    title: `Quy định cùng NDKT, chương của ${(r.nhom || []).map(nhomLabel).join(', ') || r.cqt || 'mọi CQT'}`,
                    conf: 'Khác cơ quan thu'
                }));
            }
            const tm = TM[g.ndkt];
            if (tm && MUC_CHILD[tm.m]) {
                const tally = {};
                MUC_CHILD[tm.m].filter(c => c !== g.ndkt).forEach(c => {
                    const m = matchCore(P, { ndkt: c, chuong: g.chuongNum, dbhc: g.dbhc, dvSet: g.dvSet });
                    if (m.kind !== 'OK' || m.cqtKhac) return;
                    const k = m.row._rk;
                    (tally[k] = tally[k] || { n: 0, codes: [] }).n++;
                    tally[k].codes.push(c);
                });
                const ent = Object.entries(tally).sort((a, b) => b[1].n - a[1].n);
                const tong = ent.reduce((s, e) => s + e[1].n, 0);
                ent.slice(0, 3).forEach(([k, v]) => {
                    const [tw, tinh, xa] = k.split('/').map(Number);
                    out.push({
                        tw, tinh, xa,
                        title: `Các tiểu mục cùng mục ${tm.m} (${MUC[tm.m] || ''}): ${v.codes.slice(0, 6).join(', ')}${v.codes.length > 6 ? '…' : ''}`,
                        conf: ent.length === 1 ? `Đồng nhất ở ${v.n} tiểu mục` : `${v.n}/${tong} tiểu mục, mục không đồng nhất`
                    });
                });
            }
            return out;
        }

        // ---- Phân tích TLPC toàn báo cáo ----
        const isTk = (tk, list) => list.some(p => tk.startsWith(p));
        function runTLPC(fullData, colMap, dmRows) {
            const groups = {};
            const gtgc = [];
            fullData.forEach(item => {
                const tk = item.maTaiKhoan;
                const thu = isTk(tk, FIXED.tkThu), gt = isTk(tk, FIXED.tkGTGC);
                if (!thu && !gt) return;
                const ndkt = String(item.rowData[colMap.NDKT] || '').trim();
                const soTien = parseMoney(item.rowData[colMap.PSCO]);
                if (!soTien || !ndkt) return;
                const chuong = String(item.rowData[colMap.CHUONG] || '').trim();
                const cap = String(item.rowData[colMap.CAP] || '').trim();
                const dv = String(item.rowData[colMap.DVSD] || '').trim();
                const dbhc = extractMaSo(item.rowData[colMap.DBHC]);
                if (gt) {
                    const sd = splitDvsd(dv);
                    gtgc.push({ tk, ndkt, chuong, cap, dvCode: sd.code, dvName: sd.name, dbhc, tien: soTien });
                    return;
                }
                const key = `${ndkt}_${chuong}_${dv}_${dbhc}`;
                if (!groups[key]) {
                    const sd = splitDvsd(dv);
                    const nh = inferNhomDVSD(sd.name);
                    groups[key] = {
                        key, ndkt, chuong, chuongNum: parseInt(chuong, 10) || 0, dv, dvCode: sd.code, dvName: sd.name,
                        dbhc, nhom: nh, dvSet: new Set([nh, 'DV:' + sd.code]), tks: new Set(),
                        tong: 0, cap: { tw: 0, tinh: 0, xa: 0, khac: 0 }
                    };
                }
                const g = groups[key];
                g.tks.add(tk.slice(0, 4));
                g.tong += soTien;
                if (cap === '1') g.cap.tw += soTien;
                else if (cap === '2') g.cap.tinh += soTien;
                else if (cap === '3' || cap === '4') g.cap.xa += soTien;
                else g.cap.khac += soTien;
            });

            const P = prepDM(dmRows);
            const res = { lech: [], nf: [], xacnhan: [], dung: [], lamTron: [], tamKhop: 0, tongNhom: 0, gtgc, tongTien: 0 };
            Object.values(groups).forEach(g => {
                if (!g.tong) return;
                res.tongNhom++;
                res.tongTien += g.tong;
                g.pct = {
                    tw: g.cap.tw / g.tong * 100, tinh: g.cap.tinh / g.tong * 100,
                    xa: g.cap.xa / g.tong * 100, khac: g.cap.khac / g.tong * 100
                };
                const e = evaluateGroup(g, P, FIXED.nguong);
                g.ev = e;
                if (e.kind === 'DUNG') res.dung.push(g);
                else if (e.kind === 'LAM_TRON') res.lamTron.push(g);
                else if (e.kind === 'LECH') res.lech.push(g);
                else if (e.kind === 'NF') { g.sg = suggestRates(g, P); res.nf.push(g); }
                else { if (e.kind === 'TAM_KHOP') res.tamKhop++; res.xacnhan.push(g); }
            });
            const byTien = (a, b) => Math.abs(b.tong) - Math.abs(a.tong);
            res.lech.sort(byTien); res.nf.sort(byTien); res.xacnhan.sort(byTien); res.dung.sort(byTien); res.lamTron.sort(byTien);
            gtgc.sort((a, b) => Math.abs(b.tien) - Math.abs(a.tien));
            return res;
        }

        // ---- Kiểm tra ĐBHC (giữ nguyên logic gốc) ----
        function checkDBHC(fullData, colMap) {
            const groups = {};
            fullData.forEach(item => {
                const tk = item.maTaiKhoan;
                const chuong = item.rowData[colMap.CHUONG] || '';
                const dvsd = item.rowData[colMap.DVSD] || '';
                const soTien = parseFloat(item.rawTien) || 0;
                if (chuong === '011' || chuong === '11' || dvsd.toLowerCase().includes('bộ quốc phòng')) return;
                if ((tk.startsWith('1') || tk.startsWith('8')) && soTien > 0) {
                    const cap = item.rowData[colMap.CAP] || '';
                    const dbhc = item.rowData[colMap.DBHC] || '';
                    const ndkt = item.rowData[colMap.NDKT] || '';
                    const key = `${tk}_${cap}_${dvsd}`;
                    (groups[key] = groups[key] || []).push({ dbhc, tk, cap, dvsd, ndkt, soTien });
                }
            });
            const out = [];
            for (const key in groups) {
                const items = groups[key];
                const freq = {};
                items.forEach(it => { if (it.dbhc) freq[it.dbhc] = (freq[it.dbhc] || 0) + 1; });
                if (Object.keys(freq).length <= 1) continue;
                let maxFreq = 0, maxFreqCount = 0, majority = '';
                for (const db in freq) if (freq[db] > maxFreq) maxFreq = freq[db];
                for (const db in freq) if (freq[db] === maxFreq) { maxFreqCount++; majority = db; }
                items.forEach(it => {
                    if (it.dbhc && freq[it.dbhc] < maxFreq) {
                        out.push({ tk: it.tk, ndkt: it.ndkt, cap: it.cap, dv: it.dvsd, dbhcSai: it.dbhc, dbhcDung: majority, soTien: it.soTien, note: `Nên là ${majority} (${maxFreq} dòng cùng TK, cấp, ĐVSD dùng mã này)` });
                    } else if (it.dbhc && maxFreqCount > 1) {
                        out.push({ tk: it.tk, ndkt: it.ndkt, cap: it.cap, dv: it.dvsd, dbhcSai: it.dbhc, dbhcDung: '', soTien: it.soTien, note: 'Các mã ĐBHC xuất hiện ngang nhau, không xác định được mã đúng' });
                    }
                });
            }
            return out;
        }
        function checkTKTreo(fullData, colMap) {
            const out = [];
            fullData.forEach(item => {
                if (!FIXED.tkTreo.includes(item.maTaiKhoan)) return;
                const v = parseFloat(item.rawTien) || 0;
                if (v > 0) out.push({ tk: item.maTaiKhoan, dvsd: item.rowData[colMap.DVSD] || '', sodu: v });
            });
            return out;
        }

        // ---- Đọc báo cáo số dư 12 COA ----
        function readReport(buf) {
            const wb = XLSX.read(new Uint8Array(buf), { type: 'array' });
            const ws = wb.Sheets[wb.SheetNames[0]];
            const A = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '', raw: true, blankrows: false });
            let hi = -1;
            for (let i = 0; i < Math.min(60, A.length); i++) {
                if (A[i].some(c => norm(c) === 'mã tài khoản' || norm(c) === 'mã tk')) { hi = i; break; }
            }
            if (hi < 0) throw new Error('Không thấy dòng tiêu đề có cột “Mã tài khoản”. Hãy chọn file Báo cáo chi tiết số dư theo 12 phân đoạn COA xuất từ TABMIS.');
            const colMap = { TK: -1, NDKT: -1, CAP: -1, DVSD: -1, DBHC: -1, CHUONG: -1, CTMT: -1, PSCO: -1, DUCUOI: -1 };
            A[hi].forEach((cell, idx) => {
                const h = norm(cell);
                if (!h) return;
                if (h.includes('tài khoản') || h === 'mã tk') colMap.TK = idx;
                else if (h.includes('ndkt') || h.includes('nội dung kinh tế') || h.includes('tiểu mục')) colMap.NDKT = idx;
                else if (h.includes('cấp ngân sách') || h.includes('cấp ns')) colMap.CAP = idx;
                else if (h.includes('đơn vị')) colMap.DVSD = idx;
                else if (h.includes('địa bàn') || h.includes('đbhc')) colMap.DBHC = idx;
                else if (h.includes('ctmt') || h.includes('chương trình')) colMap.CTMT = idx;
                else if (h.includes('chương')) colMap.CHUONG = idx;
                if (h.includes('phát sinh có') && h.includes('vnd')) colMap.PSCO = idx;
                if (h.includes('dư cuối') && !h.includes('nguyên tệ')) colMap.DUCUOI = idx;
            });
            const LB = { TK: 'Mã tài khoản', NDKT: 'Mã NDKT', CAP: 'Mã cấp ngân sách', DVSD: 'Mã đơn vị sử dụng ngân sách', DBHC: 'Mã địa bàn', CHUONG: 'Mã chương', PSCO: 'Phát sinh có VND', DUCUOI: 'Dư cuối kỳ VND' };
            const thieu = Object.keys(LB).filter(k => colMap[k] < 0).map(k => LB[k]);
            if (thieu.length) throw new Error('File thiếu cột: ' + thieu.join(', ') + '. Hãy xuất lại báo cáo đủ 12 phân đoạn COA.');

            const cell = v => typeof v === 'number' ? String(Math.round(v)) : String(v == null ? '' : v).trim();
            const padCode = (v, n) => /^\d+$/.test(v) && v.length < n ? v.padStart(n, '0') : v;
            const fullData = [];
            for (let i = hi + 1; i < A.length; i++) {
                const r = A[i];
                const tk = cell(r[colMap.TK]);
                if (!/^\d+$/.test(tk)) continue; // bỏ dòng tổng, dòng trống
                const rowData = r.map(cell);
                rowData[colMap.CHUONG] = padCode(rowData[colMap.CHUONG], 3);
                rowData[colMap.NDKT] = padCode(rowData[colMap.NDKT], 4);
                fullData.push({ maTaiKhoan: tk, rowData, rawTien: rowData[colMap.DUCUOI] });
            }
            if (!fullData.length) throw new Error('File không có dòng số liệu nào dưới dòng tiêu đề.');

            const head = A.slice(0, hi).map(r => r.filter(Boolean).join(' ')).join('\n');
            const D_ = '(\\d{1,2}\\/\\d{1,2}\\/\\d{4})';
            const mKy = head.match(new RegExp('từ ngày hiệu lực\\s*:?\\s*' + D_ + '[\\s\\S]{0,40}?đến ngày hiệu lực\\s*:?\\s*' + D_, 'iu'));
            const mKs = head.match(new RegExp('ngày kết sổ\\s*:?\\s*' + D_, 'iu'));
            const mKb = head.match(/mã kho bạc\s*:?\s*([\d,\s]+)/iu);
            const meta = {
                tieuDe: (A[0] || []).filter(Boolean).join(' ').trim(),
                tuNgay: mKy ? mKy[1] : '', denNgay: mKy ? mKy[2] : '',
                ketSo: mKs ? mKs[1] : '', maKB: mKb ? mKb[1].replace(/\s+/g, '').replace(/,+$/, '') : '',
                soDong: fullData.length
            };
            return { fullData, colMap, meta };
        }

        // ---- Đọc bộ TLPC từ Excel ----
        function parseImport(buf) {
            const wb = XLSX.read(new Uint8Array(buf), { type: 'array' });
            const name = wb.SheetNames.find(n => norm(n).replace(/\s/g, '') === 'danhmuc');
            if (!name) throw new Error('File không có sheet “DanhMuc”. Dùng đúng mẫu: bấm “Tải TLPC mặc định” để xem mẫu.');
            const json = XLSX.utils.sheet_to_json(wb.Sheets[name], { defval: '', raw: true });
            const nk = k => norm(k).replace(/\s+/g, '');
            if (!json.length) throw new Error('Sheet “DanhMuc” không có dòng nào.');
            const cols = new Set(Object.keys(json[0]).map(nk));
            const can = ['nộidungkinhtế', 'từchương', 'đếnchương', 'địabànhànhchính', 'cơquanthu', 'nhómcqt', '%tw', '%tỉnh', '%xã'];
            const thieu = can.filter(c => !cols.has(c));
            if (thieu.length) throw new Error('Sheet “DanhMuc” thiếu cột: ' + thieu.join(', ') + '. Dùng đúng mẫu của file TLPC mặc định.');
            const pick = (row, keys) => { for (const k of keys) if (row[k] !== undefined && row[k] !== '') return row[k]; return ''; };
            const NHOM_BY_LABEL = {}; Object.entries(NHOM).forEach(([k, v]) => { NHOM_BY_LABEL[norm(v)] = k; NHOM_BY_LABEL[norm(k)] = k; });
            const ok = [], bad = [], warn = [];
            let id = 0;
            json.forEach((raw, i) => {
                const row = {}; Object.keys(raw).forEach(k => { row[nk(k)] = raw[k]; });
                const ndkt = String(pick(row, ['nộidungkinhtế', 'ndkt', 'mãndkt'])).trim();
                if (!ndkt) return;
                const dong = `Dòng ${i + 2}`;
                let tw = parseFloat(pick(row, ['%tw', 'tw'])) || 0, tinh = parseFloat(pick(row, ['%tỉnh', '%tinh', 'tỉnh'])) || 0, xa = parseFloat(pick(row, ['%xã', '%xa', 'xã'])) || 0;
                if (tw <= 1 && tinh <= 1 && xa <= 1 && Math.abs(tw + tinh + xa - 1) < 0.001) { tw *= 100; tinh *= 100; xa *= 100; }
                tw = Math.round(tw * 100) / 100; tinh = Math.round(tinh * 100) / 100; xa = Math.round(xa * 100) / 100;
                const tu = parseInt(pick(row, ['từchương']), 10), den = parseInt(pick(row, ['đếnchương']), 10);
                const cqt = String(pick(row, ['cơquanthu'])).trim();
                const nhRaw = String(pick(row, ['nhómcqt'])).trim();
                let nhom;
                if (nhRaw) {
                    const toks = nhRaw.split(/[,;]+/).map(x => x.trim()).filter(Boolean);
                    nhom = [];
                    toks.forEach(x => {
                        const v = /^dv:/i.test(x) ? 'DV:' + x.slice(3).trim() : /^\d+$/.test(x) ? 'DV:' + x : (NHOM_BY_LABEL[norm(x)] || null);
                        if (v) nhom.push(v); else warn.push(`${dong}: nhóm CQT “${x}” không nhận ra, bị bỏ qua`);
                    });
                } else nhom = inferNhomCQT(cqt);
                const reasons = [];
                if (!parseNdktSpec(ndkt).iv.length) reasons.push('NDKT sai');
                if (!(tu >= 1 && den <= 999 && tu <= den)) reasons.push('chương sai');
                if (Math.abs(tw + tinh + xa - 100) >= 0.01) reasons.push(`tổng tỉ lệ ${+(tw + tinh + xa).toFixed(2)}%`);
                if (reasons.length) { bad.push(`${dong}: ${reasons.join(', ')}`); return; }
                if ((cqt || nhRaw) && !nhom.length) warn.push(`${dong}: có ghi cơ quan thu “${cqt || nhRaw}” nhưng không nhận ra nhóm, dòng này đang áp dụng cho MỌI cơ quan thu`);
                const dbhc = String(pick(row, ['địabànhànhchính', 'đbhc', 'địabàn'])).trim() || 'Tất cả các địa bàn phường/ xã';
                if (resolveDbhcText(dbhc).kind === 'unknown') warn.push(`${dong}: địa bàn “${dbhc}” không có trong danh sách 94 ĐBHC Đà Nẵng, dòng này sẽ không khớp được`);
                ok.push({
                    id: 'r' + (++id), excelRow: i + 2, ndkt, tu, den, dbhc,
                    cqt, nhom, tw, tinh, xa, status: norm(pick(row, ['trạngthái'])).includes('chờ') ? 'pending' : 'ok',
                    note: String(pick(row, ['ghichú'])).trim(), nhomQT: String(pick(row, ['nhómquytắc'])).trim()
                });
            });
            if (!ok.length) throw new Error('Không đọc được dòng hợp lệ nào trong sheet “DanhMuc”.' + (bad.length ? ' ' + bad.slice(0, 3).join('; ') : ''));
            const cf = findConflicts(ok);
            const nConf = Object.keys(cf).length;
            if (nConf) warn.push(`${nConf} dòng xung đột: cùng phạm vi NDKT, chương, ĐBHC, cơ quan thu nhưng khác tỉ lệ. Tool sẽ báo “Danh mục mơ hồ” khi gặp`);
            return {
                rows: ok, bad, warn,
                stats: { total: ok.length, pending: ok.filter(r => r.status === 'pending').length, moiCQT: ok.filter(r => !r.nhom.length).length }
            };
        }

        return {
            escHtml, norm, fmtNum, pad3, tenNDKT, tenChuong, tenDBHC, nhomLabel, NHOM, TM,
            parseNdktSpec, prepDM, findConflicts, matchCore, evaluateGroup, runTLPC, checkDBHC, checkTKTreo,
            readReport, parseImport, resolveDbhcText, inferNhomDVSD, dbhcCount: D.DBHC_DN.length
        };
    }

    // Cho phép chạy thử lõi ngoài trình duyệt
    if (typeof module !== 'undefined' && module.exports) { module.exports = { makeCore, FIXED }; return; }

    // =================================================================
    // GIAO DIỆN
    // =================================================================
    const $ = (s, r) => (r || document).querySelector(s);
    const S = {
        unlocked: false, C: null, booting: false,
        dmDefault: null, dmCustom: null,
        report: null, res: null, dbhcErr: [], treo: [],
        tab: 'lech', q: '', busy: ''
    };
    const dm = () => S.dmCustom || S.dmDefault;

    // ---- SHA-256 (dùng crypto.subtle, có bản dự phòng) ----
    function sha256Fallback(str) {
        const K = [0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da, 0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070, 0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2];
        const bytes = Array.from(new TextEncoder().encode(str));
        const l = bytes.length * 8;
        bytes.push(0x80);
        while (bytes.length % 64 !== 56) bytes.push(0);
        for (let i = 7; i >= 0; i--) bytes.push(i >= 4 ? 0 : (l >>> (i * 8)) & 0xff);
        let H = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19];
        const rotr = (x, n) => (x >>> n) | (x << (32 - n));
        for (let o = 0; o < bytes.length; o += 64) {
            const w = [];
            for (let i = 0; i < 16; i++) w[i] = (bytes[o + i * 4] << 24) | (bytes[o + i * 4 + 1] << 16) | (bytes[o + i * 4 + 2] << 8) | bytes[o + i * 4 + 3];
            for (let i = 16; i < 64; i++) {
                const s0 = rotr(w[i - 15], 7) ^ rotr(w[i - 15], 18) ^ (w[i - 15] >>> 3);
                const s1 = rotr(w[i - 2], 17) ^ rotr(w[i - 2], 19) ^ (w[i - 2] >>> 10);
                w[i] = (w[i - 16] + s0 + w[i - 7] + s1) | 0;
            }
            let [a, b, c, d, e, f, g, h] = H;
            for (let i = 0; i < 64; i++) {
                const t1 = (h + (rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25)) + ((e & f) ^ (~e & g)) + K[i] + w[i]) | 0;
                const t2 = ((rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22)) + ((a & b) ^ (a & c) ^ (b & c))) | 0;
                h = g; g = f; f = e; e = (d + t1) | 0; d = c; c = b; b = a; a = (t1 + t2) | 0;
            }
            H = H.map((v, i) => (v + [a, b, c, d, e, f, g, h][i]) | 0);
        }
        return H.map(v => (v >>> 0).toString(16).padStart(8, '0')).join('');
    }
    async function sha256(str) {
        try {
            if (window.crypto && crypto.subtle) {
                const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
                return Array.from(new Uint8Array(b)).map(x => x.toString(16).padStart(2, '0')).join('');
            }
        } catch (e) { /* dùng bản dự phòng */ }
        return sha256Fallback(str);
    }

    // ---- Nạp tài nguyên ----
    function loadScript(src) {
        return new Promise((ok, fail) => {
            const s = document.createElement('script');
            s.src = src; s.onload = ok; s.onerror = () => fail(new Error('Không tải được ' + src));
            document.head.appendChild(s);
        });
    }
    async function boot() {
        if (S.C || S.booting) return;
        S.booting = true; render();
        try {
            if (typeof XLSX === 'undefined') throw new Error('Chưa tải được thư viện đọc Excel. Kiểm tra mạng rồi tải lại trang.');
            if (!window.KT_DATA) await loadScript(DATA_URL);
            S.C = makeCore(window.KT_DATA, XLSX);
            try {
                const r = await fetch(DEFAULT_TLPC_URL, { cache: 'no-cache' });
                if (!r.ok) throw new Error('HTTP ' + r.status);
                const p = S.C.parseImport(await r.arrayBuffer());
                S.dmDefault = Object.assign({ name: DEFAULT_TLPC_NAME, src: 'default' }, p);
            } catch (e) {
                S.dmDefault = null;
                S.bootErr = `Không đọc được bộ TLPC mặc định (${DEFAULT_TLPC_URL}): ${e.message}. Nếu đang mở file trên máy, hãy mở qua địa chỉ GitHub Pages; hoặc bấm “Tải lên bộ TLPC” để dùng file của anh/chị.`;
            }
        } catch (e) {
            S.bootErr = e.message;
        }
        S.booting = false; render();
    }

    // ---- Xử lý file ----
    function readFile(file) {
        return new Promise((ok, fail) => {
            const fr = new FileReader();
            fr.onload = () => ok(fr.result); fr.onerror = () => fail(new Error('Không đọc được file'));
            fr.readAsArrayBuffer(file);
        });
    }
    const nextFrame = () => new Promise(r => setTimeout(r, 30));
    async function onReport(file) {
        if (!file || !S.C) return;
        S.busy = `Đang đọc ${file.name}…`; S.reportErr = ''; render();
        await nextFrame();
        try {
            const buf = await readFile(file);
            const rep = S.C.readReport(buf);
            S.report = Object.assign(rep, { fileName: file.name });
            analyze();
            S.tab = pickTab();
            toast(`Đã kiểm tra ${fmt(S.res.tongNhom)} nhóm thu từ ${fmt(rep.meta.soDong)} dòng báo cáo`);
        } catch (e) {
            S.reportErr = e.message;
        }
        S.busy = ''; render();
    }
    async function onTLPC(file) {
        if (!file || !S.C) return;
        S.busy = `Đang đọc bộ TLPC ${file.name}…`; S.dmErr = ''; render();
        await nextFrame();
        try {
            const p = S.C.parseImport(await readFile(file));
            S.dmCustom = Object.assign({ name: file.name, src: 'custom' }, p);
            if (S.report) analyze();
            toast(`Đang dùng bộ TLPC ${file.name}: ${p.stats.total} dòng`);
        } catch (e) {
            S.dmErr = e.message;
        }
        S.busy = ''; render();
    }
    function resetTLPC() {
        S.dmCustom = null; S.dmErr = '';
        if (S.report) analyze();
        toast('Đã về bộ TLPC mặc định');
        render();
    }
    function analyze() {
        if (!S.report || !dm()) { S.res = null; return; }
        const { fullData, colMap } = S.report;
        S.res = S.C.runTLPC(fullData, colMap, dm().rows);
        S.dbhcErr = S.C.checkDBHC(fullData, colMap);
        S.treo = S.C.checkTKTreo(fullData, colMap);
    }
    function pickTab() {
        const r = S.res; if (!r) return 'lech';
        if (r.lech.length) return 'lech';
        if (r.nf.length) return 'nf';
        if (r.xacnhan.length) return 'xn';
        if (S.dbhcErr.length) return 'dbhc';
        if (S.treo.length) return 'treo';
        return 'dung';
    }

    // ---- Tiện ích hiển thị ----
    const esc = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    const fmt = n => (n === null || n === undefined || isNaN(n)) ? '—' : Math.round(Number(n)).toLocaleString('vi-VN');
    const pct = v => `${+(+v).toFixed(2)}%`.replace('.', ',');
    function toast(msg) {
        const t = $('#kt-toast'); if (!t) return;
        t.textContent = msg; t.hidden = false;
        clearTimeout(toast._t); toast._t = setTimeout(() => { t.hidden = true; }, 3200);
    }
    const nhomTxt = r => (r.nhom && r.nhom.length) ? r.nhom.map(S.C.nhomLabel).join(', ') : 'Mọi cơ quan thu';
    const dbhcTxt = r => {
        const k = S.C.resolveDbhcText(r.dbhc).kind;
        if (k !== 'general') return r.dbhc;
        return S.C.norm(r.dbhc).includes('còn lại') ? 'Các phường, xã còn lại' : 'Mọi địa bàn';
    };
    const dmRowTxt = r => `NDKT ${esc(r.ndkt.length > 40 ? r.ndkt.slice(0, 40) + '…' : r.ndkt)}, chương ${S.C.pad3(r.tu)}–${S.C.pad3(r.den)}, ${esc(dbhcTxt(r))}, ${esc(nhomTxt(r))}`;

    function matchesQ(g) {
        const q = S.C.norm(S.q); if (!q) return true;
        const hay = S.C.norm([g.ndkt, g.chuong, g.dbhc, g.dvCode, g.dvName, S.C.tenNDKT(g.ndkt), S.C.tenDBHC(g.dbhc)].join(' '));
        return q.split(' ').every(w => hay.includes(w));
    }

    function codeCells(g, miss) {
        const m = k => miss === k ? ' is-miss' : '';
        const tag = k => miss === k ? '<span class="kt-misstag">Chưa có trong DM</span>' : '';
        const tNd = S.C.tenNDKT(g.ndkt), tCh = S.C.tenChuong(g.chuong), tDb = S.C.tenDBHC(g.dbhc);
        return `
            <div class="kt-c kt-c-nd${m('NDKT')}" data-l="NDKT"><b class="kt-code">${esc(g.ndkt)}</b><span class="kt-sub" title="${esc(tNd)}">${esc(tNd) || 'Không có trong MLNS'}</span>${tag('NDKT')}</div>
            <div class="kt-c${m('CHUONG')}" data-l="Chương"><b class="kt-code">${esc(g.chuong)}</b><span class="kt-sub" title="${esc(tCh)}">${esc(tCh)}</span>${tag('CHUONG')}</div>
            <div class="kt-c${m('DBHC')}" data-l="ĐBHC"><b class="kt-code">${esc(g.dbhc)}</b><span class="kt-sub">${esc(tDb)}</span>${tag('DBHC')}</div>
            <div class="kt-c kt-c-dv${m('CQT')}" data-l="Đơn vị thu"><span class="kt-dv" title="${esc(g.dvCode + ' ' + g.dvName)}">${esc(g.dvName)}</span><span class="kt-chip">${esc(S.C.nhomLabel(g.nhom))}</span>${g.tks && g.tks.has('7114') ? '<span class="kt-chip kt-chip-q">Có TK 7114</span>' : ''}${tag('CQT')}</div>
            <div class="kt-c kt-c-tien" data-l="PS có (đồng)"><b class="kt-num">${fmt(g.tong)}</b></div>`;
    }
    function rateTable(g, exp, diff, lechKeys, expLabel) {
        const lb = { tw: 'TW', tinh: 'TP', xa: 'Xã' };
        const head = `<tr><th></th><th>Thực tế</th>${exp ? `<th>${expLabel || 'Quy định'}</th>` : ''}${diff ? '<th>Chênh (đồng)</th>' : ''}</tr>`;
        const rows = ['tw', 'tinh', 'xa'].map(k => {
            const bad = lechKeys && lechKeys.includes(k);
            return `<tr${bad ? ' class="is-bad"' : ''}><th>${lb[k]}</th><td title="${g.pct[k].toFixed(4)}%">${Math.round(g.pct[k])}%</td>${exp ? `<td>${pct(exp[k])}</td>` : ''}${diff ? `<td>${diff[k] > 0 ? '+' : ''}${fmt(diff[k])}</td>` : ''}</tr>`;
        }).join('');
        const khac = g.pct.khac ? `<tr class="is-bad"><th>Cấp khác</th><td>${Math.round(g.pct.khac)}%</td></tr>` : '';
        return `<table class="kt-rt">${head}${rows}${khac}</table>`;
    }
    const ccHtml = r => `<div class="kt-cc"><span>Dòng ${r.excelRow} bộ TLPC: ${dmRowTxt(r)}${r.status === 'pending' ? ', <i>chờ xác nhận</i>' : ''}</span>${r.note ? `<span class="kt-note">${esc(r.note)}</span>` : ''}</div>`;
    const more = n => n > FIXED.maxShow ? `<p class="kt-more">Đang hiện ${FIXED.maxShow}/${fmt(n)} nhóm có số tiền lớn nhất. Gõ vào ô lọc để xem nhóm khác, hoặc xuất Excel để xem đủ.</p>` : '';
    const empty = msg => `<div class="kt-empty">${msg}</div>`;
    const HEAD7 = (c6, c7) => `<div class="kt-row kt-head" aria-hidden="true"><div>NDKT</div><div>Chương</div><div>ĐBHC</div><div>Đơn vị thu</div><div class="kt-r">PS có (đồng)</div><div>${c6}</div><div>${c7}</div></div>`;

    const NF_LABEL = { NDKT: 'Thiếu NDKT', CHUONG: 'Thiếu chương', CQT: 'Thiếu CQT', DBHC: 'Thiếu ĐBHC' };
    function nfMsg(g) {
        const e = g.ev;
        if (e.loai === 'NDKT') return `Bộ TLPC chưa có NDKT <b>${esc(g.ndkt)}</b>.${S.C.TM[g.ndkt] ? '' : ' <b>Mã này không có trong MLNS</b>, kiểm tra lại hạch toán.'}`;
        if (e.loai === 'CHUONG') return `NDKT ${esc(g.ndkt)} chỉ có quy định cho chương <b>${e.ranges.map(esc).join(', ')}</b>.`;
        if (e.loai === 'CQT') {
            const list = e.refs.map(r => `<li><b>${esc(nhomTxt(r))}</b>: ${pct(r.tw)} / ${pct(r.tinh)} / ${pct(r.xa)} (dòng ${r.excelRow})</li>`).join('');
            const trung = e.exp ? (e.lech ? 'Tỉ lệ thực tế cũng khác quy định đó.' : 'Tỉ lệ thực tế trùng quy định đó, nhưng khác cơ quan thu nên chưa đủ căn cứ kết luận đúng.') : '';
            return `Chưa có quy định khi <b>${esc(S.C.nhomLabel(g.nhom))}</b> thu khoản này. Bộ TLPC chỉ có cho:<ul>${list}</ul>${trung}`;
        }
        return `Chỉ có quy định cho ĐBHC: ${e.dbhcs.map(esc).join('; ')}. Không có dòng “Các phường, xã còn lại” hoặc “Tất cả”.`;
    }
    const sgHtml = g => (g.sg && g.sg.length) ? `<details class="kt-sg"><summary>Gợi ý tỉ lệ tham khảo (${g.sg.length})</summary><ul>${g.sg.map(s => `<li><b>${pct(s.tw)} / ${pct(s.tinh)} / ${pct(s.xa)}</b> ${esc(s.title)} <i>${esc(s.conf)}</i></li>`).join('')}</ul></details>` : '';

    // ---- Các bảng kết quả ----
    function viewLech(L) {
        if (!S.res.lech.length) return empty('Không có nhóm nào lệch tỉ lệ so với bộ TLPC.');
        if (!L.length) return empty('Không có nhóm nào khớp ô lọc.');
        return HEAD7('Tỉ lệ phân chia', 'Căn cứ') + L.slice(0, FIXED.maxShow).map(g => {
            const e = g.ev;
            return `<article class="kt-row is-lech">${codeCells(g)}<div class="kt-c" data-l="Tỉ lệ">${rateTable(g, e.exp, e.diff, e.lechKeys)}</div>
                <div class="kt-c" data-l="Căn cứ">${lechWhy(e)}${e.row ? ccHtml(e.row) : `<div class="kt-cc">${esc(e.src)}</div>`}</div></article>`;
        }).join('') + more(L.length);
    }
    function lechWhy(e) {
        if (e.pctKeys && e.pctKeys.length) return '<span class="kt-badge kt-b-LECH">Tỉ lệ lệch</span>';
        if (e.lechKeys && e.lechKeys.includes('khac')) return '<span class="kt-badge kt-b-LECH">Có cấp ngân sách khác</span>';
        return `<span class="kt-badge kt-b-LECH">Lệch số tiền</span><div class="kt-why">% đã khớp nhưng chênh vượt ngưỡng làm tròn ${fmt(e.tol)} đồng, cần kiểm tra.</div>`;
    }
    function viewLamTron(L) {
        if (!S.res.lamTron.length) return empty('Không có nhóm nào chỉ chênh do làm tròn.');
        if (!L.length) return empty('Không có nhóm nào khớp ô lọc.');
        return HEAD7('Tỉ lệ phân chia', 'Căn cứ') + L.slice(0, FIXED.maxShow).map(g => {
            const e = g.ev;
            const maxD = Math.max(...e.dongKeys.map(k => Math.abs(e.diff[k])));
            return `<article class="kt-row is-lt">${codeCells(g)}<div class="kt-c" data-l="Tỉ lệ">${rateTable(g, e.exp, e.diff, null)}</div>
                <div class="kt-c" data-l="Căn cứ"><div class="kt-why">Chênh lớn nhất ${fmt(maxD)} đồng, trong ngưỡng làm tròn ${fmt(e.tol)} đồng.</div>${e.row ? ccHtml(e.row) : `<div class="kt-cc">${esc(e.src)}</div>`}</div></article>`;
        }).join('') + more(L.length);
    }
    function viewNF(L) {
        if (!S.res.nf.length) return empty('Mọi nhóm thu đều có quy định trong bộ TLPC.');
        if (!L.length) return empty('Không có nhóm nào khớp ô lọc.');
        return HEAD7('Tỉ lệ thực tế', 'Thiếu gì trong bộ TLPC') + L.slice(0, FIXED.maxShow).map(g => {
            const e = g.ev;
            const tbl = e.loai === 'CQT' && e.exp ? rateTable(g, e.exp, null, e.lechKeys, 'QĐ (CQT khác)') : rateTable(g);
            return `<article class="kt-row is-nf">${codeCells(g, e.loai)}<div class="kt-c" data-l="Tỉ lệ">${tbl}</div>
                <div class="kt-c" data-l="Lý do"><span class="kt-badge kt-b-${e.loai}">${NF_LABEL[e.loai]}</span><div class="kt-why">${nfMsg(g)}</div>${sgHtml(g)}</div></article>`;
        }).join('') + more(L.length);
    }
    function viewXN(L) {
        if (!S.res.xacnhan.length) return empty('Không có nhóm nào cần xác nhận.');
        if (!L.length) return empty('Không có nhóm nào khớp ô lọc.');
        return HEAD7('Tỉ lệ', 'Cần làm') + L.slice(0, FIXED.maxShow).map(g => {
            const e = g.ev;
            let body;
            if (e.kind === 'TAM_KHOP') {
                body = `<span class="kt-badge kt-b-TAM">Tạm khớp</span><div class="kt-why">Tỉ lệ khớp dòng quy tắc đang <b>chờ xác nhận</b>. Khi đã có căn cứ, đổi trạng thái dòng này thành “Đã xác nhận” trong file TLPC.</div>${ccHtml(e.row)}`;
            } else {
                const opts = e.options.map(r => `<li>${pct(r.tw)} / ${pct(r.tinh)} / ${pct(r.xa)}, dòng ${r.excelRow} (${esc(nhomTxt(r))})${e.khop.includes(r) ? ' <b class="kt-ok">khớp thực tế</b>' : ''}</li>`).join('');
                body = `<span class="kt-badge kt-b-MOHO">Bộ TLPC mơ hồ</span><div class="kt-why">Có ${e.options.length} dòng cùng phạm vi nhưng khác tỉ lệ:<ul>${opts}</ul>Sửa hoặc xóa dòng sai trong file TLPC rồi tải lên lại.</div>`;
            }
            return `<article class="kt-row is-xn">${codeCells(g)}<div class="kt-c" data-l="Tỉ lệ">${rateTable(g, e.exp || null, null, e.lechKeys)}</div><div class="kt-c" data-l="Cần làm">${body}</div></article>`;
        }).join('') + more(L.length);
    }
    function viewDung(L) {
        if (!S.res.dung.length) return empty('Chưa có nhóm nào khớp quy định.');
        if (!L.length) return empty('Không có nhóm nào khớp ô lọc.');
        return HEAD7('Tỉ lệ', 'Căn cứ') + L.slice(0, FIXED.maxShow).map(g => {
            const e = g.ev;
            return `<article class="kt-row is-dung">${codeCells(g)}<div class="kt-c" data-l="Tỉ lệ">${rateTable(g, e.exp, null, null)}</div>
                <div class="kt-c" data-l="Căn cứ">${e.row ? ccHtml(e.row) : `<div class="kt-cc">${esc(e.src)}</div>`}</div></article>`;
        }).join('') + more(L.length);
    }
    function viewDBHC() {
        const q = S.C.norm(S.q);
        const L = S.dbhcErr.filter(e => !q || S.C.norm([e.tk, e.ndkt, e.dv, e.dbhcSai].join(' ')).includes(q));
        if (!S.dbhcErr.length) return empty('Không có ĐBHC sai lệch trong các TK đầu 1 và 8.');
        if (!L.length) return empty('Không có dòng nào khớp ô lọc.');
        return `<div class="kt-tbl"><table><thead><tr><th>Mã TK</th><th>NDKT</th><th>Cấp</th><th>ĐVSD</th><th>ĐBHC đang ghi</th><th class="kt-r">Dư cuối (đồng)</th><th>Ghi chú</th></tr></thead><tbody>
            ${L.slice(0, FIXED.maxShow).map(e => `<tr><td class="kt-code">${esc(e.tk)}</td><td class="kt-code">${esc(e.ndkt || '–')}</td><td>${esc(e.cap)}</td><td>${esc(e.dv)}</td><td class="kt-code kt-badtxt">${esc(e.dbhcSai)}<span class="kt-sub">${esc(S.C.tenDBHC(e.dbhcSai))}</span></td><td class="kt-r kt-num">${fmt(e.soTien)}</td><td>${esc(e.note)}</td></tr>`).join('')}
            </tbody></table></div>` + more(L.length);
    }
    function viewTreo() {
        if (!S.treo.length) return empty(`Các tài khoản ${FIXED.tkTreo.join(', ')} đều có dư cuối bằng 0.`);
        return `<div class="kt-tbl"><table><thead><tr><th>Mã TK</th><th>Đơn vị sử dụng</th><th class="kt-r">Dư cuối (đồng)</th></tr></thead><tbody>
            ${S.treo.map(e => `<tr><td class="kt-code">${esc(e.tk)}</td><td>${esc(e.dvsd)}</td><td class="kt-r kt-num kt-badtxt">${fmt(e.sodu)}</td></tr>`).join('')}</tbody></table></div>`;
    }
    function viewGTGC() {
        const G = S.res.gtgc;
        if (!G.length) return empty('Không có phát sinh có trên TK 7113 (ghi thu ghi chi).');
        const q = S.C.norm(S.q);
        const L = G.filter(e => !q || S.C.norm([e.ndkt, e.chuong, e.dbhc, e.dvCode, e.dvName].join(' ')).includes(q));
        return `<p class="kt-lead">Ghi thu ghi chi hạch toán TK 7113, tool không đối chiếu tỉ lệ phân chia. Danh sách để tham khảo.</p>
            <div class="kt-tbl"><table><thead><tr><th>TK</th><th>NDKT</th><th>Chương</th><th>Cấp</th><th>ĐVSD</th><th>ĐBHC</th><th class="kt-r">PS có (đồng)</th></tr></thead><tbody>
            ${L.slice(0, FIXED.maxShow).map(e => `<tr><td class="kt-code">${esc(e.tk)}</td><td><b class="kt-code">${esc(e.ndkt)}</b><span class="kt-sub">${esc(S.C.tenNDKT(e.ndkt))}</span></td><td class="kt-code">${esc(e.chuong)}</td><td>${esc(e.cap)}</td><td>${esc(e.dvName)}</td><td class="kt-code">${esc(e.dbhc)}<span class="kt-sub">${esc(S.C.tenDBHC(e.dbhc))}</span></td><td class="kt-r kt-num">${fmt(e.tien)}</td></tr>`).join('')}
            </tbody></table></div>` + more(L.length);
    }

    // ---- Xuất kết quả ----
    function exportResult() {
        if (!S.res) return;
        const r = S.res, C = S.C;
        const base = g => [g.ndkt, C.tenNDKT(g.ndkt), g.chuong, g.dbhc, C.tenDBHC(g.dbhc), g.dvCode, g.dvName, C.nhomLabel(g.nhom), g.tong, g.cap.tw, g.cap.tinh, g.cap.xa, g.cap.khac,
            +g.pct.tw.toFixed(2), +g.pct.tinh.toFixed(2), +g.pct.xa.toFixed(2)];
        const H = ['NDKT', 'Tên NDKT', 'Chương', 'ĐBHC', 'Tên ĐBHC', 'Mã ĐVSD', 'Tên ĐVSD', 'Nhóm CQT', 'PS có', 'Cấp 1 (TW)', 'Cấp 2 (TP)', 'Cấp 3-4 (Xã)', 'Cấp khác', '%TW thực tế', '%TP thực tế', '%Xã thực tế'];
        const qd = e => e && e.exp ? [e.exp.tw, e.exp.tinh, e.exp.xa] : ['', '', ''];
        const rowRef = e => e && e.row ? [e.row.excelRow, e.row.ndkt, `${e.row.tu}-${e.row.den}`, e.row.dbhc, nhomTxt(e.row), e.row.note] : ['', '', '', '', '', e && e.src || ''];
        const H_QD = ['%TW quy định', '%TP quy định', '%Xã quy định'];
        const H_REF = ['Dòng TLPC', 'NDKT (TLPC)', 'Chương (TLPC)', 'ĐBHC (TLPC)', 'CQT (TLPC)', 'Căn cứ / ghi chú'];
        const strip = h => h.replace(/<li>/g, '; ').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').replace(/^;\s*/, '').trim();
        const sheets = [
            ['Lech', [H.concat(H_QD, ['Chênh TW', 'Chênh TP', 'Chênh Xã'], H_REF)].concat(r.lech.map(g => base(g).concat(qd(g.ev), [g.ev.diff.tw, g.ev.diff.tinh, g.ev.diff.xa], rowRef(g.ev))))],
            ['KhongCoTrongTLPC', [H.concat(['Lý do', 'Chi tiết'])].concat(r.nf.map(g => base(g).concat([NF_LABEL[g.ev.loai], strip(nfMsg(g))])))],
            ['CanXacNhan', [H.concat(['Loại'], H_QD, H_REF)].concat(r.xacnhan.map(g => base(g).concat([g.ev.kind === 'TAM_KHOP' ? 'Tạm khớp' : 'TLPC mơ hồ'], qd(g.ev), rowRef(g.ev))))],
            ['ChenhLamTron', [H.concat(H_QD, ['Chênh TW', 'Chênh TP', 'Chênh Xã', 'Ngưỡng làm tròn'], H_REF)].concat(r.lamTron.map(g => base(g).concat(qd(g.ev), [g.ev.diff.tw, g.ev.diff.tinh, g.ev.diff.xa, g.ev.tol], rowRef(g.ev))))],
            ['Dung', [H.concat(H_QD, H_REF)].concat(r.dung.map(g => base(g).concat(qd(g.ev), rowRef(g.ev))))],
            ['LoiDBHC', [['Mã TK', 'NDKT', 'Cấp', 'ĐVSD', 'ĐBHC đang ghi', 'ĐBHC nên là', 'Dư cuối', 'Ghi chú']].concat(S.dbhcErr.map(e => [e.tk, e.ndkt, e.cap, e.dv, e.dbhcSai, e.dbhcDung, e.soTien, e.note]))],
            ['TKTreo', [['Mã TK', 'Đơn vị sử dụng', 'Dư cuối']].concat(S.treo.map(e => [e.tk, e.dvsd, e.sodu]))],
            ['GhiThuGhiChi_7113', [['TK', 'NDKT', 'Tên NDKT', 'Chương', 'Cấp', 'Mã ĐVSD', 'Tên ĐVSD', 'ĐBHC', 'PS có']].concat(r.gtgc.map(e => [e.tk, e.ndkt, C.tenNDKT(e.ndkt), e.chuong, e.cap, e.dvCode, e.dvName, e.dbhc, e.tien]))]
        ];
        const m = S.report.meta;
        const info = [['Kiểm tra số liệu cân đối - Đà Nẵng'], ['File báo cáo', S.report.fileName], ['Kỳ báo cáo', m.tuNgay ? `${m.tuNgay} - ${m.denNgay}` : ''], ['Mã kho bạc', m.maKB], ['Bộ TLPC', dm().name + (dm().src === 'default' ? ' (mặc định)' : ' (tải lên)')],
            ['Số nhóm thu', r.tongNhom], ['Đúng', r.dung.length], ['Lệch', r.lech.length], ['Chênh làm tròn', r.lamTron.length], ['Không có trong TLPC', r.nf.length], ['Cần xác nhận', r.xacnhan.length], ['Lỗi ĐBHC', S.dbhcErr.length], ['TK treo', S.treo.length], ['Ghi thu ghi chi 7113', r.gtgc.length],
            ['Xuất lúc', new Date().toLocaleString('vi-VN')]];
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(info), 'TongHop');
        sheets.forEach(([n, aoa]) => {
            const ws = XLSX.utils.aoa_to_sheet(aoa);
            ws['!cols'] = aoa[0].map((h, i) => ({ wch: Math.min(48, Math.max(8, String(h).length + 2, ...aoa.slice(1, 60).map(r => String(r[i] == null ? '' : r[i]).length))) }));
            XLSX.utils.book_append_sheet(wb, ws, n);
        });
        const ky = (m.denNgay || '').split('/').reverse().join('');
        XLSX.writeFile(wb, `KIEM_TRA_CAN_DOI_${ky || 'BAOCAO'}.xlsx`);
        toast('Đã xuất kết quả ra Excel');
    }

    // ---- Khung giao diện ----
    function renderLock() {
        return `<div class="kt-lock">
            <svg class="kt-lockic" viewBox="0 0 24 24" aria-hidden="true"><rect x="4.5" y="10.5" width="15" height="10" rx="2.5"/><path d="M8 10.5V7.5a4 4 0 0 1 8 0v3"/></svg>
            <h3>Kiểm tra số liệu cân đối</h3>
            <p>Nhập mật khẩu để mở tab này.</p>
            <form id="kt-lockform" autocomplete="off">
                <label class="sr-only" for="kt-pass">Mật khẩu</label>
                <input id="kt-pass" type="password" placeholder="Mật khẩu" autocomplete="current-password" spellcheck="false" autocapitalize="characters">
                <button type="submit" class="kt-btn kt-btn-pri">Mở khóa</button>
            </form>
            <p class="kt-lockerr" id="kt-lockerr" role="alert">${esc(S.lockErr || '')}</p>
        </div>`;
    }
    function renderSources() {
        const rep = S.report, d = dm();
        const repBox = rep ? `<div class="kt-file">
                <div><b>${esc(rep.fileName)}</b>
                <span class="kt-sub">${rep.meta.tuNgay ? `Kỳ ${esc(rep.meta.tuNgay)} đến ${esc(rep.meta.denNgay)}` : 'Không đọc được kỳ báo cáo'}${rep.meta.ketSo ? `, kết sổ ${esc(rep.meta.ketSo)}` : ''}${rep.meta.maKB ? `, KB ${esc(rep.meta.maKB)}` : ''}, ${fmt(rep.meta.soDong)} dòng</span></div>
                <label class="kt-btn">Chọn báo cáo khác<input type="file" accept=".xlsx,.xls" data-in="report" hidden></label></div>`
            : `<label class="kt-drop" id="kt-drop">
                <input type="file" accept=".xlsx,.xls" data-in="report" hidden>
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 15V4m0 0-4 4m4-4 4 4M5 15v3a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-3"/></svg>
                <span><b>Chọn hoặc kéo thả file báo cáo</b><span class="kt-sub">Báo cáo chi tiết số dư theo 12 phân đoạn COA (Excel xuất từ TABMIS)</span></span>
            </label>`;
        const warnList = (d && (d.bad.length || d.warn.length)) ? `<details class="kt-warn"><summary>${d.bad.length ? `${d.bad.length} dòng bị bỏ qua` : ''}${d.bad.length && d.warn.length ? ', ' : ''}${d.warn.length ? `${d.warn.length} cảnh báo` : ''}</summary><ul>${d.bad.concat(d.warn).slice(0, 60).map(x => `<li>${esc(x)}</li>`).join('')}</ul></details>` : '';
        const dmBox = d ? `<div class="kt-file">
                <div><b>${d.src === 'default' ? 'Bộ quy tắc NQ15 (mặc định)' : esc(d.name)}</b>
                <span class="kt-sub">${d.src === 'default' ? esc(d.name) + ', ' : 'Bộ tải lên, chỉ dùng đến khi tải lại trang. '}${d.stats.total} dòng: ${d.stats.total - d.stats.pending} đã xác nhận, ${d.stats.pending} chờ xác nhận, ${d.stats.moiCQT} dòng áp dụng mọi cơ quan thu</span>${warnList}</div>
                <div class="kt-acts">
                    <a class="kt-btn" href="${DEFAULT_TLPC_URL}" download="${DEFAULT_TLPC_NAME}">Tải TLPC mặc định</a>
                    <label class="kt-btn">Tải lên bộ TLPC<input type="file" accept=".xlsx,.xls" data-in="tlpc" hidden></label>
                    ${S.dmCustom && S.dmDefault ? '<button type="button" class="kt-btn" data-act="reset">Về mặc định</button>' : ''}
                </div></div>`
            : `<div class="kt-file"><div><b>Chưa có bộ TLPC</b><span class="kt-sub">Tải lên file TLPC (sheet “DanhMuc”) để đối chiếu.</span></div>
                <div class="kt-acts"><a class="kt-btn" href="${DEFAULT_TLPC_URL}" download="${DEFAULT_TLPC_NAME}">Tải TLPC mặc định</a><label class="kt-btn">Tải lên bộ TLPC<input type="file" accept=".xlsx,.xls" data-in="tlpc" hidden></label></div></div>`;
        return `<div class="kt-src">
            <section class="kt-srcb"><h4>Báo cáo số dư</h4>${repBox}${S.reportErr ? `<p class="kt-err" role="alert">${esc(S.reportErr)}</p>` : ''}</section>
            <section class="kt-srcb"><h4>Bộ tỉ lệ phân chia</h4>${dmBox}${S.dmErr ? `<p class="kt-err" role="alert">${esc(S.dmErr)}</p>` : ''}</section>
        </div>`;
    }
    function renderBalance() {
        const r = S.res;
        const seg = [
            ['dung', r.dung.length, 'đúng'], ['lt', r.lamTron.length, 'chênh làm tròn'], ['xn', r.xacnhan.length, 'cần xác nhận'],
            ['nf', r.nf.length, 'không có trong TLPC'], ['lech', r.lech.length, 'lệch']
        ];
        const tot = r.tongNhom || 1;
        const bar = seg.filter(s => s[1]).map(([k, n, l]) => `<button type="button" class="kt-seg kt-s-${k}" style="flex-grow:${n}" data-tab="${k}" title="${n} nhóm ${l}" aria-label="${n} nhóm ${l}"></button>`).join('');
        const leg = seg.map(([k, n, l]) => `<button type="button" class="kt-leg kt-s-${k}${S.tab === k ? ' is-on' : ''}" data-tab="${k}"><i></i><b>${fmt(n)}</b> ${l}</button>`).join('');
        const allOk = !r.lech.length && !r.nf.length;
        return `<div class="kt-bal">
            <div class="kt-baltop">
                <p class="kt-verdict">${allOk ? `${fmt(r.tongNhom)} nhóm thu đều có quy định và không lệch tỉ lệ${r.xacnhan.length ? `, ${fmt(r.xacnhan.length)} nhóm cần xác nhận` : ''}` : `${fmt(r.lech.length + r.nf.length)} trên ${fmt(r.tongNhom)} nhóm thu cần xử lý`}</p>
                <p class="kt-sub">Tổng phát sinh có TK ${FIXED.tkThu.join(', ')}: <b class="kt-num">${fmt(r.tongTien)}</b> đồng</p>
            </div>
            <div class="kt-bar" role="group" aria-label="Phân bố kết quả">${bar}</div>
            <div class="kt-legs">${leg}</div>
        </div>`;
    }
    function renderTabs() {
        const r = S.res;
        const T = [['lech', 'Lệch phân chia', r.lech.length, 1], ['nf', 'Không có trong TLPC', r.nf.length, 1], ['xn', 'Cần xác nhận', r.xacnhan.length, 0], ['lt', 'Chênh làm tròn', r.lamTron.length, 0], ['dung', 'Đúng', r.dung.length, 0],
            ['dbhc', 'Lỗi ĐBHC', S.dbhcErr.length, 1], ['treo', 'TK treo', S.treo.length, 1], ['gtgc', 'Ghi thu ghi chi', r.gtgc.length, 0]];
        return `<div class="kt-tabs" role="tablist">${T.map(([k, l, n, warn]) => `<button type="button" role="tab" aria-selected="${S.tab === k}" class="kt-tab${S.tab === k ? ' is-on' : ''}" data-tab="${k}">${l}<span class="kt-cnt${warn && n ? ' is-warn' : ''}">${fmt(n)}</span></button>`).join('')}</div>`;
    }
    function renderView() {
        const r = S.res;
        switch (S.tab) {
            case 'lech': return viewLech(r.lech.filter(matchesQ));
            case 'nf': return viewNF(r.nf.filter(matchesQ));
            case 'xn': return viewXN(r.xacnhan.filter(matchesQ));
            case 'dung': return viewDung(r.dung.filter(matchesQ));
            case 'lt': return viewLamTron(r.lamTron.filter(matchesQ));
            case 'dbhc': return viewDBHC();
            case 'treo': return viewTreo();
            case 'gtgc': return viewGTGC();
        }
        return '';
    }
    const NOTE = {
        lech: 'Có quy định trong bộ TLPC nhưng phân chia sai: % làm tròn khác quy định, có cấp ngân sách khác, hoặc % khớp mà số tiền chênh vượt ngưỡng làm tròn.',
        lt: 'Tỉ lệ đã khớp quy định, chỉ chênh vài đồng do TABMIS làm tròn từng chứng từ. Không phải phân chia sai, để riêng cho đỡ rối.',
        nf: 'Bộ TLPC chưa có quy định cho khoản này. Ô tô đỏ là phần còn thiếu. Gợi ý tỉ lệ chỉ để tham khảo.',
        xn: 'Khớp dòng quy tắc đang chờ xác nhận, hoặc bộ TLPC có nhiều dòng cùng phạm vi khác tỉ lệ.',
        dung: 'Tỉ lệ thực tế khớp dòng quy tắc đã xác nhận.',
        dbhc: 'TK đầu 1 và 8 có dư cuối dương: trong cùng TK, cấp, ĐVSD, mã ĐBHC ít xuất hiện hơn bị coi là sai. Bỏ qua chương 011 và Bộ Quốc phòng.',
        treo: `Tài khoản trung gian ${FIXED.tkTreo.join(', ')} còn dư cuối dương.`,
        gtgc: ''
    };
    function renderSettings() {
        const d = dm();
        return `<details class="kt-fixed"><summary>Cài đặt áp dụng (cố định)</summary>
            <dl>
                <dt>Tài khoản đối chiếu TLPC</dt><dd>${FIXED.tkThu.join(', ')} theo cột Phát sinh có VND. TK 7113 (ghi thu ghi chi) chỉ liệt kê, không đối chiếu.</dd>
                <dt>Ngưỡng lệch</dt><dd>Tỉ lệ làm tròn thành số nguyên trước khi so (16,67% thành 17%). Nếu % đã khớp mà một cấp chênh so với số tính theo tỉ lệ: chênh không quá ${fmt(FIXED.nguong)} đồng hoặc 0,001% PS có (lấy số lớn hơn) thì xếp vào “Chênh làm tròn”; vượt ngưỡng đó thì vẫn báo lệch.</dd>
                <dt>Cơ quan thu</dt><dd>Dòng quy tắc có ghi cơ quan thu chỉ áp dụng cho đơn vị cùng nhóm. Đơn vị khác nhóm luôn báo “Thiếu CQT”, kể cả khi tỉ lệ trùng. Dòng để trống cơ quan thu áp dụng cho mọi cơ quan thu.</dd>
                <dt>Thứ tự ưu tiên</dt><dd>ĐBHC cụ thể trước “Các phường, xã còn lại”, mã NDKT cụ thể trước khoảng mã, rồi lọc theo cơ quan thu, rồi khoảng chương hẹp nhất.</dd>
                <dt>Nhóm đơn vị thu</dt><dd>Tự suy luận từ tên ĐVSD: Thuế TP, Thuế cơ sở, Cơ quan TW, Cơ quan TP, Cơ quan cấp xã. Đơn vị tên có chữ Hải quan áp dụng 100% TW.</dd>
                <dt>Địa bàn</dt><dd>${S.C.dbhcCount} phường, xã, đặc khu TP Đà Nẵng.</dd>
                <dt>Bộ TLPC</dt><dd>${d ? esc(d.name) : 'Chưa có'}. Bộ tải lên chỉ dùng trong lần mở trang này; tải lại trang là về bộ mặc định.</dd>
            </dl></details>`;
    }
    function render() {
        const root = $('#kt'); if (!root) return;
        const keepFocus = document.activeElement && document.activeElement.id === 'kt-q';
        const caret = keepFocus ? document.activeElement.selectionStart : 0;
        let body;
        if (!S.unlocked) body = renderLock();
        else if (S.booting || !S.C) body = `<div class="kt-loading">Đang tải dữ liệu tra cứu…</div>${S.bootErr ? `<p class="kt-err">${esc(S.bootErr)}</p>` : ''}`;
        else {
            body = `${S.bootErr ? `<p class="kt-err" role="alert">${esc(S.bootErr)}</p>` : ''}${renderSources()}`;
            if (S.busy) body += `<div class="kt-loading">${esc(S.busy)}</div>`;
            else if (S.res) {
                body += renderBalance() + renderTabs() + `<div class="kt-tools">
                    <input id="kt-q" type="search" placeholder="Lọc theo NDKT, chương, ĐBHC, đơn vị…" value="${esc(S.q)}" aria-label="Lọc kết quả" autocomplete="off" spellcheck="false">
                    <button type="button" class="kt-btn" data-act="export">Xuất kết quả Excel</button></div>
                    ${NOTE[S.tab] ? `<p class="kt-lead">${NOTE[S.tab]}</p>` : ''}
                    <div class="kt-view">${renderView()}</div>`;
            } else if (S.report && !dm()) body += `<p class="kt-lead">Tải lên bộ TLPC để bắt đầu đối chiếu.</p>`;
            body += renderSettings();
        }
        root.innerHTML = `<header class="kt-top">
                <div><h3>Kiểm tra số liệu cân đối - Đà Nẵng</h3>
                <p class="kt-sub">Đối chiếu tỉ lệ phân chia nguồn thu theo NQ15, kiểm tra ĐBHC và tài khoản treo từ báo cáo số dư 12 COA</p></div>
                ${S.unlocked ? '<button type="button" class="kt-btn kt-btn-ghost" data-act="lock">Khóa</button>' : ''}
            </header>${body}<div class="kt-toast" id="kt-toast" role="status" hidden></div>`;
        if (keepFocus) { const q = $('#kt-q'); if (q) { q.focus(); q.setSelectionRange(caret, caret); } }
        if (!S.unlocked) { const p = $('#kt-pass'); if (p && S.shown) p.focus(); }
    }

    // ---- Sự kiện ----
    function bind(root) {
        root.addEventListener('submit', async e => {
            if (e.target.id !== 'kt-lockform') return;
            e.preventDefault();
            const v = ($('#kt-pass').value || '').replace(/\s+/g, '').toUpperCase();
            if (!v) return;
            if (await sha256(v) === PASS_HASH) {
                S.unlocked = true; S.lockErr = '';
                render(); boot();
            } else {
                S.lockErr = 'Mật khẩu chưa đúng. Kiểm tra lại rồi nhập lại.';
                render();
                const p = $('#kt-pass'); if (p) { p.focus(); }
            }
        });
        root.addEventListener('change', e => {
            const inp = e.target.closest('input[type=file][data-in]'); if (!inp) return;
            const f = inp.files && inp.files[0];
            if (inp.dataset.in === 'report') onReport(f); else onTLPC(f);
            inp.value = '';
        });
        root.addEventListener('input', e => {
            if (e.target.id !== 'kt-q') return;
            S.q = e.target.value;
            clearTimeout(bind._t);
            bind._t = setTimeout(() => {
                const v = $('.kt-view'); if (v && S.res) v.innerHTML = renderView();
            }, 150);
        });
        root.addEventListener('click', e => {
            const t = e.target.closest('[data-tab]');
            if (t) { S.tab = t.dataset.tab; render(); return; }
            const a = e.target.closest('[data-act]'); if (!a) return;
            const act = a.dataset.act;
            if (act === 'export') exportResult();
            else if (act === 'reset') resetTLPC();
            else if (act === 'lock') { S.unlocked = false; render(); }
        });
        root.addEventListener('keydown', e => {
            if (!e.target.classList || !e.target.classList.contains('kt-tab')) return;
            if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
            const tabs = [...root.querySelectorAll('.kt-tab')];
            const i = tabs.indexOf(e.target) + (e.key === 'ArrowRight' ? 1 : -1);
            const n = tabs[(i + tabs.length) % tabs.length];
            S.tab = n.dataset.tab; render(); const f = root.querySelector(`.kt-tab[data-tab="${S.tab}"]`); if (f) f.focus();
        });
        ['dragenter', 'dragover'].forEach(ev => root.addEventListener(ev, e => {
            const d = e.target.closest('#kt-drop'); if (!d) return;
            e.preventDefault(); d.classList.add('is-over');
        }));
        root.addEventListener('dragleave', e => { const d = e.target.closest('#kt-drop'); if (d) d.classList.remove('is-over'); });
        root.addEventListener('drop', e => {
            const d = e.target.closest('#kt-drop'); if (!d) return;
            e.preventDefault(); d.classList.remove('is-over');
            const f = e.dataTransfer.files && e.dataTransfer.files[0]; if (f) onReport(f);
        });
    }

    // ---- Bật/tắt tab, không đụng vào logic của các tab cũ ----
    function setOn(on) {
        const root = $('#kt'), btn = $('#tabKt');
        if (!root || !btn) return;
        root.hidden = !on;
        document.body.classList.toggle('kt-on', on);
        btn.classList.toggle('active', on);
        btn.setAttribute('aria-selected', on ? 'true' : 'false');
        if (on) {
            document.querySelectorAll('.tabs .tab.active').forEach(b => b.classList.remove('active'));
            const m = $('#tabMlns');
            if (m) { m.classList.remove('active', 'is-on', 'on'); m.setAttribute('aria-selected', 'false'); }
            S.shown = true; render();
        }
    }
    function init() {
        const root = $('#kt'), btn = $('#tabKt');
        if (!root || !btn) return;
        bind(root);
        btn.addEventListener('click', () => setOn(true));
        // Bấm bất kỳ tab cũ nào thì rời tab này; các tab cũ tự xử lý phần còn lại
        document.addEventListener('click', e => {
            const t = e.target.closest('.tabs button');
            if (t && t !== btn && document.body.classList.contains('kt-on')) setOn(false);
        }, true);
        render();
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
