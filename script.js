/* ==========================================================
   Body Scent — script.js (ใช้ร่วมกันทุกหน้า)
   - product.html : แสดงสินค้า + กรองตาม mood
   - order.html   : เติม items / total จาก URL และส่งออเดอร์
   - admin.html   : แสดงออเดอร์จาก CSV
   ทำงานตาม element ที่พบในหน้า ไม่ผูกกับชื่อไฟล์
   ========================================================== */

/* ---------- ค่าที่ต้องแก้ ---------- */
// URL ของ Apps Script Web app (ลงท้ายด้วย /exec)
const ORDER_API_URL = 'https://script.google.com/macros/s/AKfycbzbBSURnXV2_TryQuelJOYV7ROU7ezLvCTPMnoRzGw2mM-pzSXYCetLgr78DLfKWzoqqg/exec';
// URL ของ Google Sheet ที่ Publish to web เป็น CSV
const ADMIN_CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vRzfaDAhlCxa1IojwIAnRbvWjn_OmcwYQhD3V-PBtFQjKvPl6IkSyzi40w6ZzVpmThfSSHjvdgnUmSA/pub?gid=0&single=true&output=csv';

/* ---------- ค่าคงที่ ---------- */
const PRODUCTS_URL = 'products.json';

const MOODS = [
  { key: 'all', label: 'ทั้งหมด' },
  { key: 'fresh', label: 'Fresh' },
  { key: 'sweet', label: 'Sweet' },
  { key: 'confident', label: 'Confident' },
  { key: 'romance', label: 'Romance' }
];

/* ---------- ตัวช่วย ---------- */
function formatPrice(value) {
  return Number(value).toLocaleString('th-TH') + ' บาท';
}

function moodLabel(key) {
  var found = MOODS.find(function (m) { return m.key === key; });
  return found ? found.label : key;
}

// สร้าง element พร้อม class / text (ใช้ textContent เสมอ เพื่อกัน XSS)
function el(tag, className, text) {
  var node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

/* ==========================================================
   1) product.html
   ========================================================== */
var allProducts = [];

function initProductPage() {
  var filterBar = document.getElementById('filter-bar');
  var list = document.getElementById('product-list');
  if (!filterBar || !list) return;

  var params = new URLSearchParams(window.location.search);
  var requested = (params.get('mood') || 'all').toLowerCase();
  var validMood = MOODS.some(function (m) { return m.key === requested; });
  var activeMood = validMood ? requested : 'all';

  renderFilterBar(filterBar, activeMood, function (mood) {
    activeMood = mood;
    renderProducts(list, activeMood);
    updateFilterButtons(filterBar, activeMood);
    updateMoodInUrl(activeMood);
  });

  list.textContent = 'กำลังโหลดสินค้า...';

  fetch(PRODUCTS_URL)
    .then(function (res) {
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return res.json();
    })
    .then(function (data) {
      allProducts = Array.isArray(data) ? data : [];
      renderProducts(list, activeMood);
    })
    .catch(function (error) {
      console.error(error);
      list.textContent = 'ไม่สามารถโหลดสินค้าได้ กรุณาลองใหม่อีกครั้ง';
    });
}

function renderFilterBar(bar, activeMood, onSelect) {
  bar.textContent = '';
  MOODS.forEach(function (m) {
    var btn = el('button', 'filter-btn');
    btn.type = 'button';
    btn.dataset.mood = m.key;

    if (m.key !== 'all') {
      var dot = el('span', 'mood-dot');
      dot.dataset.mood = m.key;
      btn.appendChild(dot);
    }
    btn.appendChild(document.createTextNode(m.label));

    btn.addEventListener('click', function () { onSelect(m.key); });
    bar.appendChild(btn);
  });
  updateFilterButtons(bar, activeMood);
}

function updateFilterButtons(bar, activeMood) {
  bar.querySelectorAll('.filter-btn').forEach(function (btn) {
    var isActive = btn.dataset.mood === activeMood;
    btn.classList.toggle('is-active', isActive);
    btn.setAttribute('aria-pressed', isActive ? 'true' : 'false');
  });
}

function updateMoodInUrl(mood) {
  var url = new URL(window.location.href);
  if (mood === 'all') {
    url.searchParams.delete('mood');
  } else {
    url.searchParams.set('mood', mood);
  }
  window.history.replaceState(null, '', url);
}

function buildItemName(product) {
  // ตัวอย่าง: "น้ำหอมฉีดตัว Fresh 30ml" (โรลออนไม่มีไซส์ จะไม่ต่อท้าย)
  return product.size ? product.name + ' ' + product.size : product.name;
}

function buildOrderLink(product) {
  var query = new URLSearchParams({
    item: buildItemName(product),
    price: String(product.price)
  });
  return 'order.html?' + query.toString();
}

function renderProducts(list, mood) {
  var shown = allProducts.filter(function (p) {
    return mood === 'all' || p.mood === mood;
  });

  list.textContent = '';

  if (shown.length === 0) {
    list.textContent = 'ยังไม่มีสินค้าในหมวดนี้';
    return;
  }

  shown.forEach(function (p) {
    var card = el('article', 'card');
    card.dataset.mood = p.mood;

    var media = el('div', 'card__media');
    var img = document.createElement('img');
    img.src = p.image;
    img.alt = buildItemName(p);
    img.loading = 'lazy';
    media.appendChild(img);

    var body = el('div', 'card__body');

    var meta = el('div', 'card__meta');
    var dot = el('span', 'mood-dot');
    dot.dataset.mood = p.mood;
    meta.appendChild(dot);
    meta.appendChild(document.createTextNode(moodLabel(p.mood)));

    var title = el('h3', 'card__title', p.name);

    body.appendChild(meta);
    body.appendChild(title);

    if (p.size) {
      body.appendChild(el('p', 'card__desc', p.size));
    }

    var footer = el('div', 'card__footer');
    footer.appendChild(el('span', 'price', formatPrice(p.price)));

    var buy = el('a', 'btn btn--accent', 'สั่งซื้อ');
    buy.href = buildOrderLink(p);
    footer.appendChild(buy);

    body.appendChild(footer);
    card.appendChild(media);
    card.appendChild(body);
    list.appendChild(card);
  });
}

/* ==========================================================
   2) order.html
   ========================================================== */
function initOrderPage() {
  var form = document.getElementById('orderForm');
  if (!form) return;

  // เติม items และ total จาก URL ทันทีที่โหลดหน้า
  var params = new URLSearchParams(window.location.search);
  var item = params.get('item');
  var price = params.get('price');

  var itemsField = document.getElementById('items');
  var totalField = document.getElementById('total');

  if (itemsField && item) itemsField.value = item;
  if (totalField && price) totalField.value = price;

  form.addEventListener('submit', function (event) {
    event.preventDefault();
    submitOrder(form);
  });
}

function submitOrder(form) {
  var submitBtn = form.querySelector('[type="submit"]');
  if (submitBtn) submitBtn.disabled = true;

  var payload = {
    customerName: document.getElementById('customerName').value.trim(),
    contact: document.getElementById('contact').value.trim(),
    items: document.getElementById('items').value.trim(),
    total: document.getElementById('total').value.trim(),
    note: document.getElementById('note').value.trim()
  };

  fetch(ORDER_API_URL, {
    method: 'POST',
    body: JSON.stringify(payload)
  })
    .then(() => { window.location.href = 'thankyou.html'; })
    .catch(error => {
      console.error(error);
      alert('เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง');
      if (submitBtn) submitBtn.disabled = false;
    });
}

/* ==========================================================
   3) admin.html
   ========================================================== */

// parse CSV เอง: รองรับ "ข้อความมี, คอมมา", "" (ฟันหนูในฟันหนู) และขึ้นบรรทัดใหม่ในเครื่องหมายคำพูด
function parseCSV(text) {
  var rows = [];
  var row = [];
  var cell = '';
  var inQuotes = false;

  if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1); // ตัด BOM

  for (var i = 0; i < text.length; i++) {
    var ch = text[i];

    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cell += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      row.push(cell);
      cell = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
    } else {
      cell += ch;
    }
  }

  // แถวสุดท้ายที่ไม่มีขึ้นบรรทัดใหม่ปิดท้าย
  if (cell !== '' || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }

  // ตัดแถวว่างทั้งแถว
  return rows.filter(function (r) {
    return r.some(function (c) { return c.trim() !== ''; });
  });
}

function initAdminPage() {
  var tbody = document.querySelector('#ordersTable tbody');
  if (!tbody) return;

  showAdminMessage(tbody, 'กำลังโหลดข้อมูล...');

  fetch(ADMIN_CSV_URL, { cache: 'no-store' })
    .then(function (res) {
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return res.text();
    })
    .then(function (text) {
      var rows = parseCSV(text);

      // ถ้าแถวแรกเป็นหัวตาราง (คอลัมน์ A ไม่ใช่วันเวลา) ให้ข้าม
      if (rows.length > 0 && isNaN(Date.parse(rows[0][0]))) {
        rows.shift();
      }

      // แถวใหม่ถูกต่อท้ายชีตเสมอ จึงกลับลำดับให้ล่าสุดขึ้นก่อน
      rows.reverse();

      renderOrders(tbody, rows);
    })
    .catch(function (error) {
      console.error(error);
      showAdminMessage(tbody, 'ไม่สามารถโหลดข้อมูลได้ กรุณาลองใหม่อีกครั้ง');
    });
}

function showAdminMessage(tbody, message) {
  tbody.textContent = '';
  var tr = document.createElement('tr');
  var td = el('td', 'muted', message);
  td.colSpan = 6;
  tr.appendChild(td);
  tbody.appendChild(tr);
}

function renderOrders(tbody, rows) {
  if (rows.length === 0) {
    showAdminMessage(tbody, 'ยังไม่มีรายการสั่งซื้อ');
    return;
  }

  tbody.textContent = '';

  rows.forEach(function (r) {
    var tr = document.createElement('tr');

    // คอลัมน์: วันเวลา, ชื่อลูกค้า, เบอร์โทร/Line, รายการสินค้า, จำนวนเงินรวม, หมายเหตุ
    for (var i = 0; i < 6; i++) {
      tr.appendChild(el('td', '', r[i] !== undefined ? r[i] : ''));
    }
    tbody.appendChild(tr);
  });
}

/* ---------- เริ่มทำงาน ---------- */
document.addEventListener('DOMContentLoaded', function () {
  initProductPage();
  initOrderPage();
  initAdminPage();
});
