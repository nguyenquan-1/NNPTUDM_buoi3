const API_URL = "https://api.escuelajs.co/api/v1/products";

// Node 18+ có fetch sẵn. Node < 18: npm i node-fetch
let fetchFn = global.fetch;
if (!fetchFn) {
  fetchFn = (...args) => import("node-fetch").then(({ default: f }) => f(...args));
}

// Kéo toàn bộ products bằng limit/offset để có search/sort/paging chuẩn
async function fetchAllProducts() {
  const limit = 100;
  let offset = 0;
  const all = [];

  while (true) {
    const res = await fetchFn(`${API_URL}?limit=${limit}&offset=${offset}`);
    if (!res.ok) throw new Error(`API error ${res.status}: ${await res.text()}`);
    const chunk = await res.json();
    if (!Array.isArray(chunk) || chunk.length === 0) break;

    all.push(...chunk);
    if (chunk.length < limit) break;
    offset += limit;
  }
  return all;
}

exports.getAll = async (req, res) => {
  try {
    // ====== params từ query ======
    const q = String(req.query.q || "").trim().toLowerCase();
    const page = Math.max(1, Number(req.query.page || 1));
    const pageSizeRaw = Number(req.query.pageSize || 5);
    const pageSize = [5, 10, 20].includes(pageSizeRaw) ? pageSizeRaw : 5;

    const sortBy = ["price", "title"].includes(req.query.sortBy) ? req.query.sortBy : "";
    const order = req.query.order === "desc" ? "desc" : "asc";
    const wantJson = req.query.format === "json";

    // ====== 1) fetch all ======
    let products = await fetchAllProducts();

    // ====== 2) search theo title ======
    if (q) {
      products = products.filter(p =>
        String(p.title || "").toLowerCase().includes(q)
      );
    }

    // ====== 3) sort ======
    const dir = order === "desc" ? -1 : 1;
    if (sortBy === "price") {
      products.sort((a, b) => (Number(a.price) - Number(b.price)) * dir);
    } else if (sortBy === "title") {
      products.sort((a, b) =>
        String(a.title).localeCompare(String(b.title), "vi", { sensitivity: "base" }) * dir
      );
    }

    // ====== 4) paging ======
    const totalItems = products.length;
    const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
    const safePage = Math.min(page, totalPages);
    const start = (safePage - 1) * pageSize;
    const items = products.slice(start, start + pageSize);

    // ====== trả JSON ======
    if (wantJson) {
      return res.json({ items, totalItems, totalPages, page: safePage, pageSize, q, sortBy, order });
    }

    // ====== render HTML ======
    return res.send(`<!doctype html>
<html lang="vi">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>Dashboard Products</title>
  <link rel="stylesheet" href="/dashboard.css" />
</head>
<body>
  <div class="wrap">
    <h2>Dashboard - Products</h2>

    <div class="toolbar">
      <div>
        <label>Tìm theo title</label>
        <input id="q" placeholder="Nhập title..." />
      </div>

      <div>
        <label>Hiển thị / trang</label>
        <select id="pageSize">
          <option value="5">5</option>
          <option value="10">10</option>
          <option value="20">20</option>
        </select>
      </div>

      <div>
        <label>Sắp xếp</label>
        <div class="sortBtns">
          <button id="sortPrice">Giá ▲▼</button>
          <button id="sortTitle">Tên ▲▼</button>
          <button id="resetSort" class="ghost">Reset</button>
        </div>
      </div>
    </div>

    <div class="meta">
      <span>Tổng: <b id="totalItems">0</b> sản phẩm</span>
      <span>Trang: <b id="page">1</b> / <b id="totalPages">1</b></span>
    </div>

    <div class="tableScroll">
      <table class="productTable">
        <thead>
          <tr>
            <th style="width:70px">ID</th>
            <th style="width:280px">Title</th>
            <th style="width:120px">Price</th>
            <th style="width:180px">Category</th>
            <th style="width:360px">Images</th>
            <th>Description</th>
          </tr>
        </thead>
        <tbody id="tbody"></tbody>
      </table>
    </div>

    <div class="pagination">
      <button id="first">« Đầu</button>
      <button id="prev">‹ Trước</button>
      <span class="pageInfo">Trang <b id="page2">1</b> / <b id="totalPages2">1</b></span>
      <button id="next">Sau ›</button>
      <button id="last">Cuối »</button>
    </div>
  </div>

<script>
  const state = { q:"", pageSize:5, page:1, sortBy:"", order:"asc" };
  const $ = (id) => document.getElementById(id);

  function buildUrl(){
    const p = new URLSearchParams();
    p.set("format","json");
    p.set("q", state.q);
    p.set("pageSize", state.pageSize);
    p.set("page", state.page);
    if(state.sortBy) p.set("sortBy", state.sortBy);
    p.set("order", state.order);
    return window.location.pathname + "?" + p.toString();
  }

  function toggleSort(key){
    if(state.sortBy !== key){
      state.sortBy = key;
      state.order = "asc";
    } else {
      state.order = state.order === "asc" ? "desc" : "asc";
    }
    state.page = 1;
    load();
  }

  function resetSort(){
    state.sortBy = "";
    state.order = "asc";
    state.page = 1;
    load();
  }

  function renderRows(items){
    const tbody = $("tbody");
    if(!items || items.length === 0){
      tbody.innerHTML = '<tr><td class="empty" colspan="6">Không có dữ liệu phù hợp.</td></tr>';
      return;
    }

    tbody.innerHTML = items.map(p => {
      const imgs = (p.images || []).map(src => \`
        <div class="imgBox" title="\${src}">
          <img src="\${src}" alt="\${p.title}">
        </div>\`).join("");

      return \`
        <tr>
          <td>\${p.id}</td>
          <td class="cellTitle">\${p.title}</td>
          <td>$\${p.price}</td>
          <td>\${p.category?.name || ""}</td>
          <td><div class="imgList">\${imgs}</div></td>
          <td class="cellDesc">\${p.description || ""}</td>
        </tr>\`;
    }).join("");
  }

  async function load(){
    const res = await fetch(buildUrl());
    const data = await res.json();

    $("totalItems").textContent = data.totalItems;
    $("page").textContent = data.page;
    $("page2").textContent = data.page;
    $("totalPages").textContent = data.totalPages;
    $("totalPages2").textContent = data.totalPages;

    $("first").disabled = data.page <= 1;
    $("prev").disabled = data.page <= 1;
    $("next").disabled = data.page >= data.totalPages;
    $("last").disabled = data.page >= data.totalPages;

    renderRows(data.items);
  }

  $("q").addEventListener("input", (e) => {
    state.q = e.target.value;
    state.page = 1;
    load();
  });

  $("pageSize").addEventListener("change", (e) => {
    state.pageSize = Number(e.target.value);
    state.page = 1;
    load();
  });

  $("sortPrice").addEventListener("click", () => toggleSort("price"));
  $("sortTitle").addEventListener("click", () => toggleSort("title"));
  $("resetSort").addEventListener("click", resetSort);

  $("first").addEventListener("click", () => { state.page = 1; load(); });
  $("prev").addEventListener("click", () => { state.page = Math.max(1, state.page - 1); load(); });
  $("next").addEventListener("click", () => { state.page = state.page + 1; load(); });
  $("last").addEventListener("click", async () => {
    const res = await fetch(buildUrl());
    const data = await res.json();
    state.page = data.totalPages;
    load();
  });

  $("pageSize").value = "5";
  load();
</script>
</body>
</html>`);
  } catch (e) {
    console.error(e);
    res.status(500).send("Lỗi dashboard getAll: " + e.message);
  }
};
