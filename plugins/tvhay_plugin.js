// =============================================================================
// VAAPP Plugin: TVHay  (https://tvhay.buzz)
// Author: TheVinhLy  |  Version: 1.0.0
//
// Luồng:
//   Danh sách  : /phim-moi | /phim-bo | /phim-le | /short-drama | /the-loai/x | /quoc-gia/x | /nam/yyyy  (?page=N)
//   Tìm kiếm   : /?view=tim-kiem&keyword=...&page=N
//   Chi tiết   : /phim/{slug}  → lấy danh sách tập đầy đủ từ trang xem /xem/{slug}/{tap}?sv=N
//   Trang xem  : script có  var linkHPro = "https://player.phimapi.com/player/?url=<m3u8>"
//                → lấy thẳng link m3u8 phát bằng ExoPlayer (không mở trang web → không popup quảng cáo)
// =============================================================================

var BASE = "https://tvhay.buzz";
var UA = "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36";

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------
function absUrl(u) {
    if (!u) return "";
    u = String(u).replace(/&amp;/g, "&").replace(/\\\//g, "/").trim();
    if (u.indexOf("//") === 0) return "https:" + u;
    if (u.indexOf("http") === 0) return u;
    if (u.charAt(0) === "/") return BASE + u;
    return BASE + "/" + u;
}

function decodeEntities(s) {
    return String(s || "")
        .replace(/&lt;/g, "<").replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"').replace(/&#0?39;/g, "'").replace(/&apos;/g, "'")
        .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&");
}

// Văn bản thuần: giải mã thực thể, bỏ thẻ, gọn khoảng trắng
function textOf(s) {
    var t = decodeEntities(s);
    t = t.replace(/<br\s*\/?>/gi, " ").replace(/<[^>]+>/g, " ");
    return decodeEntities(t).replace(/\s+/g, " ").trim();
}

// Mô tả phim: site lưu dạng "&lt;p&gt;...&lt;/p&gt;"
function cleanDesc(s) {
    var t = decodeEntities(s);
    t = t.replace(/<br\s*\/?>/gi, "\n").replace(/<\/p>/gi, "\n").replace(/<[^>]+>/g, "");
    return decodeEntities(t).replace(/[ \t]+/g, " ").replace(/\n\s*\n+/g, "\n").trim();
}

// Lấy ảnh từ thẻ <img>: ưu tiên thuộc tính lazy
function imgOf(block) {
    var m = block.match(/<img\b[^>]*?\s(?:data-src|data-lazy-src|data-original)=["']([^"']+)["']/i)
        || block.match(/<img\b[^>]*?\ssrc=["']([^"']+)["']/i);
    return m ? absUrl(m[1]) : "";
}

function slugFromPhim(href) {
    var m = String(href || "").match(/\/phim\/([^"'?#\s\/]+)/i);
    return m ? m[1] : "";
}

function pageFromUrl(url) {
    var m = String(url || "").match(/[?&]page=(\d+)/i);
    return m ? parseInt(m[1], 10) : 1;
}

// Danh sách thể loại / quốc gia (tên → slug) để tạo link bấm được ở trang chi tiết
var GENRES = [
    { name: "Âm Nhạc", slug: "am-nhac" }, { name: "Bí Ẩn", slug: "bi-an" }, { name: "Chiến Tranh", slug: "chien-tranh" },
    { name: "Chính Kịch", slug: "chinh-kich" }, { name: "Cổ Trang", slug: "co-trang" }, { name: "Gia Đình", slug: "gia-dinh" },
    { name: "Hài Hước", slug: "hai-huoc" }, { name: "Hành Động", slug: "hanh-dong" }, { name: "Hình Sự", slug: "hinh-su" },
    { name: "Học Đường", slug: "hoc-duong" }, { name: "Khoa Học", slug: "khoa-hoc" }, { name: "Kinh Dị", slug: "kinh-di" },
    { name: "Kinh Điển", slug: "kinh-dien" }, { name: "Lịch Sử", slug: "lich-su" }, { name: "Miền Tây", slug: "mien-tay" },
    { name: "Phim 18+", slug: "phim-18" }, { name: "Phim Ngắn", slug: "phim-ngan" }, { name: "Phiêu Lưu", slug: "phieu-luu" },
    { name: "Tài Liệu", slug: "tai-lieu" }, { name: "Tâm Lý", slug: "tam-ly" }, { name: "Thần Thoại", slug: "than-thoai" },
    { name: "Thể Thao", slug: "the-thao" }, { name: "Tình Cảm", slug: "tinh-cam" }, { name: "Trẻ Em", slug: "tre-em" },
    { name: "Viễn Tưởng", slug: "vien-tuong" }, { name: "Võ Thuật", slug: "vo-thuat" }
];

var COUNTRIES = [
    { name: "Âu Mỹ", value: "au-my" }, { name: "Anh", value: "anh" }, { name: "Ả Rập Xê Út", value: "a-rap-xe-ut" },
    { name: "Ấn Độ", value: "an-do" }, { name: "Ba Lan", value: "ba-lan" }, { name: "Bồ Đào Nha", value: "bo-dao-nha" },
    { name: "Brazil", value: "brazil" }, { name: "Canada", value: "canada" }, { name: "Châu Phi", value: "chau-phi" },
    { name: "Đài Loan", value: "dai-loan" }, { name: "Đan Mạch", value: "dan-mach" }, { name: "Đức", value: "duc" },
    { name: "Hà Lan", value: "ha-lan" }, { name: "Hàn Quốc", value: "han-quoc" }, { name: "Hồng Kông", value: "hong-kong" },
    { name: "Indonesia", value: "indonesia" }, { name: "Malaysia", value: "malaysia" }, { name: "Mexico", value: "mexico" },
    { name: "Na Uy", value: "na-uy" }, { name: "Nam Phi", value: "nam-phi" }, { name: "Nga", value: "nga" },
    { name: "Nhật Bản", value: "nhat-ban" }, { name: "Pháp", value: "phap" }, { name: "Philippines", value: "philippines" },
    { name: "Quốc Gia Khác", value: "quoc-gia-khac" }, { name: "Tây Ban Nha", value: "tay-ban-nha" }, { name: "Thái Lan", value: "thai-lan" },
    { name: "Thổ Nhĩ Kỳ", value: "tho-nhi-ky" }, { name: "Thụy Điển", value: "thuy-dien" }, { name: "Thụy Sĩ", value: "thuy-si" },
    { name: "Trung Quốc", value: "trung-quoc" }, { name: "UAE", value: "uae" }, { name: "Úc", value: "uc" },
    { name: "Ukraina", value: "ukraina" }, { name: "Việt Nam", value: "viet-nam" }, { name: "Ý", value: "y" }
];

function norm(s) {
    return String(s || "").toLowerCase().replace(/\s+/g, " ").trim();
}

// "Phiêu Lưu, Hành Động" → "[Phiêu Lưu](the-loai/phieu-luu), [Hành Động](the-loai/hanh-dong)"
function linkList(names, table, prefix, key) {
    var out = [];
    var parts = String(names || "").split(",");
    for (var i = 0; i < parts.length; i++) {
        var n = parts[i].trim();
        if (!n) continue;
        var slug = "";
        for (var j = 0; j < table.length; j++) {
            if (norm(table[j].name) === norm(n)) { slug = table[j][key]; break; }
        }
        out.push(slug ? "[" + n + "](" + prefix + "/" + slug + ")" : n);
    }
    return out.join(", ");
}

// =============================================================================
// NHÓM 1: CẤU HÌNH
// =============================================================================
function getManifest() {
    return JSON.stringify({
        "id": "tvhay",
        "name": "TVHay",
        "version": "1.0.0",
        "description": "Phim thuyết minh, lồng tiếng từ tvhay.buzz (phát thẳng, không popup)",
        "author": "TheVinhLy",
        "baseUrl": "https://tvhay.buzz",
        "iconUrl": "https://tvhay.buzz/favicon.png",
        "referrer": "https://tvhay.buzz/",
        "isEnabled": true,
        "isAdult": false,
        "type": "MOVIE",
        "layoutType": "HORIZONTAL",
        "playerType": "auto",
        "adblock": true,
        "debug": false
    });
}

function getHomeSections() {
    return JSON.stringify([
        { slug: "phim-moi", title: "Phim Mới", type: "Horizontal", path: "" },
        { slug: "phim-bo", title: "Phim Bộ", type: "Horizontal", path: "" },
        { slug: "phim-le", title: "Phim Lẻ", type: "Horizontal", path: "" },
        { slug: "short-drama", title: "Short Drama", type: "Horizontal", path: "" }
    ]);
}

function getPrimaryCategories() {
    return JSON.stringify([
        { name: "Phim Mới", slug: "phim-moi" },
        { name: "Phim Bộ", slug: "phim-bo" },
        { name: "Phim Lẻ", slug: "phim-le" },
        { name: "Short Drama", slug: "short-drama" }
    ]);
}

function getFilterConfig() {
    return JSON.stringify({ sort: [], category: [] });
}

// =============================================================================
// NHÓM 2: SINH URL
// =============================================================================
function withPage(url, page) {
    if (page > 1) url += (url.indexOf("?") >= 0 ? "&" : "?") + "page=" + page;
    return url;
}

function getUrlList(slug, filtersJson) {
    var filters = {};
    try { filters = JSON.parse(filtersJson || "{}"); } catch (e) {}
    var page = parseInt(filters.page, 10) || 1;

    // Bộ lọc ưu tiên: thể loại > quốc gia > năm
    if (filters.category) return withPage(BASE + "/the-loai/" + filters.category, page);
    if (filters.country) return withPage(BASE + "/quoc-gia/" + filters.country, page);
    if (filters.year) return withPage(BASE + "/nam/" + filters.year, page);

    slug = String(slug || "phim-moi").split("|")[0].trim();
    if (slug.indexOf("http") === 0) slug = slug.replace(/^https?:\/\/[^\/]+/i, "");
    slug = slug.replace(/^\/+|\/+$/g, "");
    if (!slug || slug === "home") slug = "phim-moi";
    if (/^\d{4}$/.test(slug)) slug = "nam/" + slug;
    return withPage(BASE + "/" + slug, page);
}

function getUrlSearch(keyword, filtersJson) {
    var filters = {};
    try { filters = JSON.parse(filtersJson || "{}"); } catch (e) {}
    var page = parseInt(filters.page, 10) || 1;
    var url = BASE + "/?view=tim-kiem&keyword=" + encodeURIComponent(String(keyword || "").trim());
    if (page > 1) url += "&page=" + page;
    return url;
}

// slug: slug phim ("su-thi-odyssey"), hoặc URL đầy đủ (id tập, trang xem)
function getUrlDetail(slug, datasend) {
    if (!slug) return "";
    slug = String(slug).split("|")[0];
    if (slug.indexOf("http") === 0) return slug;
    slug = slug.replace(/^\/+/, "");
    if (slug.indexOf("phim/") === 0 || slug.indexOf("xem/") === 0) return BASE + "/" + slug;
    return BASE + "/phim/" + slug;
}

function getUrlCategories() { return BASE + "/"; }
function getUrlCountries() { return BASE + "/"; }
function getUrlYears() { return BASE + "/"; }

// =============================================================================
// NHÓM 3: PARSER
// =============================================================================
function parseListResponse(html, apiUrl) {
    var empty = JSON.stringify({ items: [], pagination: { currentPage: 1, totalPages: 1 } });
    try {
        html = String(html || "");
        var items = [];
        var seen = {};

        var blocks = html.split(/<div\s+class="movie-item"[^>]*>/i);
        blocks.shift();

        for (var i = 0; i < blocks.length; i++) {
            var b = blocks[i];
            var hm = b.match(/<a[^>]+href="([^"]*\/phim\/[^"]+)"[^>]*>/i);
            if (!hm) continue;
            var slug = slugFromPhim(hm[1]);
            if (!slug || seen[slug]) continue;
            seen[slug] = true;

            var tm = b.match(/class="movie-title"[^>]*>([\s\S]*?)<\/div>/i)
                || hm[0].match(/title="([^"]+)"/i)
                || b.match(/alt="([^"]+)"/i);
            var title = tm ? textOf(tm[1]) : slug.replace(/-/g, " ");

            var lab = b.match(/class="movie-label"[^>]*>([\s\S]*?)<\/span>/i);
            var ep = b.match(/class="movie-ep-status"[^>]*>([\s\S]*?)<\/span>/i);
            var ym = b.match(/<span[^>]*font-weight:\s*bold[^>]*>\s*(\d{4})\s*<\/span>/i);

            items.push({
                id: slug,
                title: title,
                posterUrl: imgOf(b),
                year: ym ? parseInt(ym[1], 10) : 0,
                quality: lab ? textOf(lab[1]) : "",
                episode_current: ep ? textOf(ep[1]) : "",
                lang: lab ? textOf(lab[1]) : ""
            });
        }

        // Phân trang
        var url = String(apiUrl || "");
        var current = pageFromUrl(url);
        var cm = html.match(/<span\s+class="current"[^>]*>\s*(\d+)\s*<\/span>/i);
        if (cm) current = parseInt(cm[1], 10);
        var total = current;
        var pi = html.indexOf('class="pagination"');
        if (pi >= 0) {
            var seg = html.substring(pi, pi + 3000);
            var seg2 = seg.split(/<\/div>/i)[0];
            var re = /[?&]page=(\d+)/gi;
            var pm;
            while ((pm = re.exec(seg2)) !== null) {
                var n = parseInt(pm[1], 10);
                if (n < 10000 && n > total) total = n;
            }
        }
        return JSON.stringify({ items: items, pagination: { currentPage: current, totalPages: total } });
    } catch (e) {
        console.log("parseListResponse lỗi: " + e);
        return empty;
    }
}

function parseSearchResponse(html, apiUrl) {
    return parseListResponse(html, apiUrl);
}

// Giá trị của một dòng trong bảng thông tin: <li>Nhãn: <span class="meta-value ...">giá trị</span></li>
function metaValue(html, label) {
    var re = new RegExp("<li>\\s*" + label + "\\s*:\\s*<span[^>]*class=\"meta-value[^\"]*\"[^>]*>([\\s\\S]*?)<\\/span>", "i");
    var m = html.match(re);
    return m ? textOf(m[1]) : "";
}

function fetchPage(url) {
    try {
        var r = httpRequest(url, { method: "GET", headers: { "User-Agent": UA, "Referer": BASE + "/" } });
        return (r && r.body) ? String(r.body) : "";
    } catch (e) {
        console.log("fetchPage lỗi: " + e);
        return "";
    }
}

// Đọc danh sách server/tập từ trang xem: .source-container > .source-title + .ep-grid > a.ep-btn
function parseEpisodeBlock(html) {
    var servers = [];
    var parts = String(html || "").split(/<div\s+class="source-container"[^>]*>/i);
    parts.shift();
    for (var i = 0; i < parts.length; i++) {
        var p = parts[i];
        var tm = p.match(/class="source-title"[^>]*>([\s\S]*?)<\/div>/i);
        var name = tm ? textOf(tm[1]) : "Server " + (i + 1);
        var eps = [];
        var seen = {};
        var re = /<a[^>]+href="([^"]*\/xem\/[^"]+)"[^>]*class="ep-btn[^"]*"[^>]*>([\s\S]*?)<\/a>/gi;
        var m;
        while ((m = re.exec(p)) !== null) {
            var url = absUrl(m[1]);
            if (seen[url]) continue;
            seen[url] = true;
            var en = textOf(m[2]) || "Full";
            var sm = url.match(/\/xem\/[^\/]+\/([^?#]+)(?:\?sv=(\d+))?/i);
            eps.push({ id: url, name: en, slug: sm ? (sm[1] + (sm[2] ? "-sv" + sm[2] : "")) : en });
        }
        if (eps.length > 0) servers.push({ name: name || "Server", episodes: eps });
    }
    return servers;
}

function parseMovieDetail(html, apiUrl, datasend) {
    html = String(html || "");

    var id = slugFromPhim(apiUrl || "");
    if (!id) {
        var c = html.match(/<link[^>]+rel="canonical"[^>]+href="([^"]+)"/i);
        if (c) id = slugFromPhim(c[1]);
    }

    var h1 = html.match(/<h1[^>]*class="movie-name-vi"[^>]*>([\s\S]*?)<\/h1>/i);
    var title = h1 ? textOf(h1[1]) : "";
    if (!title) {
        var t2 = html.match(/<meta[^>]+property="og:title"[^>]+content="([^"]+)"/i);
        title = t2 ? textOf(t2[1]).replace(/\s*-\s*FHD.*$/i, "") : (id || "Phim");
    }
    var en = html.match(/<p[^>]*class="movie-name-en"[^>]*>([\s\S]*?)<\/p>/i);
    var originName = en ? textOf(en[1]) : "";

    // Poster: ảnh thật nằm ở og:image; ảnh trong trang đôi khi là bản lưu
    var og = html.match(/<meta[^>]+property="og:image"[^>]+content="([^"]+)"/i);
    var poster = og ? absUrl(og[1]) : "";
    if (!poster) {
        var pb = html.match(/class="poster-img-box"[\s\S]*?<\/div>/i);
        poster = pb ? imgOf(pb[0]) : "";
    }

    var dm = html.match(/class="movie-description"[^>]*>([\s\S]*?)<\/div>/i);
    var description = dm ? cleanDesc(dm[1]) : "";

    var status = metaValue(html, "Tình Trạng");
    var director = metaValue(html, "Đạo diễn");
    var yearStr = metaValue(html, "Năm Sản Xuất");
    var genres = metaValue(html, "Thể loại");
    var actors = metaValue(html, "Diễn viên");
    var country = metaValue(html, "Quốc gia");
    var duration = metaValue(html, "Thời lượng");
    var likes = metaValue(html, "Yêu thích");

    // ---- Danh sách tập: lấy từ trang xem (trang chi tiết chỉ liệt kê vài tập mới nhất) ----
    var watchHrefs = [];
    var wr = /href="([^"]*\/xem\/[^"]+)"/gi;
    var wm;
    while ((wm = wr.exec(html)) !== null) watchHrefs.push(absUrl(wm[1]));

    var servers = [];
    if (watchHrefs.length > 0) {
        // Ưu tiên nút "Xem Phim" (tập đầu), nếu không có thì tập đầu tiên tìm thấy
        var bw = html.match(/class="btn-action btn-watch"[^>]*>/i);
        var first = watchHrefs[0];
        var bwHref = html.match(/<a[^>]+href="([^"]*\/xem\/[^"]+)"[^>]*class="btn-action btn-watch"/i);
        if (bwHref) first = absUrl(bwHref[1]);
        var watchHtml = fetchPage(first);
        if (watchHtml) servers = parseEpisodeBlock(watchHtml);
    }
    // Dự phòng: dùng các tập "mới nhất" ở trang chi tiết
    if (servers.length === 0 && watchHrefs.length > 0) {
        var eps = [];
        var seenE = {};
        for (var k = watchHrefs.length - 1; k >= 0; k--) {
            var u = watchHrefs[k];
            if (seenE[u]) continue;
            seenE[u] = true;
            var sm = u.match(/\/xem\/[^\/]+\/([^?#]+)/i);
            var nm = sm ? sm[1].replace(/^tap-/i, "Tập ").replace(/-/g, " ") : "Full";
            eps.push({ id: u, name: nm, slug: sm ? sm[1] : "full" });
        }
        if (eps.length > 0) servers.push({ name: "Server 1", episodes: eps });
    }

    return JSON.stringify({
        id: id,
        title: title,
        originName: originName,
        posterUrl: poster,
        backdropUrl: poster,
        description: description,
        year: parseInt(yearStr, 10) || 0,
        quality: "HD",
        status: status,
        episode_current: status,
        lang: "",
        duration: duration,
        director: director && !/đang cập nhật/i.test(director) ? director : "",
        casts: actors && !/đang cập nhật/i.test(actors) ? actors : "",
        country: linkList(country, COUNTRIES, "quoc-gia", "value"),
        category: linkList(genres, GENRES, "the-loai", "slug"),
        servers: servers
    });
}

// ---- Trang xem → link phát ----
function m3u8FromPlayerLink(v) {
    v = String(v || "").replace(/\\\//g, "/").replace(/&amp;/g, "&");
    if (!v) return "";
    var m = v.match(/[?&]url=([^&"']+)/i);
    var u = m ? m[1] : v;
    try { u = decodeURIComponent(u); } catch (e) {}
    if (u.indexOf("//") === 0) u = "https:" + u;
    return /^https?:\/\//i.test(u) ? u : "";
}

function parseDetailResponse(html, apiUrl, datasend) {
    html = String(html || "");

    // 1) Link H.PRO / S.PRO trong script của trang xem
    var cand = [];
    var hm = html.match(/var\s+linkHPro\s*=\s*["']([^"']*)["']/i);
    var sm = html.match(/var\s+linkSPro\s*=\s*["']([^"']*)["']/i);
    if (hm) cand.push(hm[1]);
    if (sm) cand.push(sm[1]);
    for (var i = 0; i < cand.length; i++) {
        var u = m3u8FromPlayerLink(cand[i]);
        if (u && /\.m3u8/i.test(u)) {
            console.log("parseDetailResponse: m3u8=" + u);
            return JSON.stringify({
                url: u,
                isEmbed: false,
                mimeType: "application/x-mpegURL",
                headers: {
                    "Referer": "https://player.phimapi.com/",
                    "Origin": "https://player.phimapi.com",
                    "User-Agent": UA
                },
                subtitles: []
            });
        }
    }

    // 2) Bất kỳ link m3u8 / mp4 nào xuất hiện trong trang
    var any = html.replace(/\\\//g, "/").match(/https?:\/\/[^"'\s<>\\]+\.(?:m3u8|mp4)[^"'\s<>\\]*/i);
    if (any) {
        var au = any[0];
        return JSON.stringify({
            url: au,
            isEmbed: false,
            mimeType: /\.mp4/i.test(au) ? "video/mp4" : "application/x-mpegURL",
            headers: { "Referer": "https://player.phimapi.com/", "Origin": "https://player.phimapi.com", "User-Agent": UA },
            subtitles: []
        });
    }

    // 3) Dự phòng: iframe trình phát của site
    var fm = html.match(/<iframe[^>]+id="movie-iframe"[^>]+src="([^"]+)"/i)
        || html.match(/<iframe[^>]+src="([^"]+)"[^>]*id="movie-iframe"/i);
    if (fm) {
        console.log("parseDetailResponse: iframe " + fm[1]);
        return JSON.stringify({
            url: absUrl(fm[1]),
            isEmbed: true,
            headers: { "Referer": BASE + "/", "User-Agent": UA },
            subtitles: []
        });
    }

    console.log("parseDetailResponse: không tìm thấy link phát, url=" + apiUrl);
    return JSON.stringify({ url: "", isEmbed: false, headers: { "Referer": BASE + "/" }, subtitles: [] });
}

// Nếu App chuyển sang bước embed: lấy m3u8 từ trang player
function parseEmbedResponse(html, sourceUrl) {
    html = String(html || "").replace(/\\\//g, "/");
    var m = html.match(/https?:\/\/[^"'\s<>\\]+\.m3u8[^"'\s<>\\]*/i);
    if (m) {
        return JSON.stringify({
            url: m[0],
            isEmbed: false,
            mimeType: "application/x-mpegURL",
            headers: { "Referer": "https://player.phimapi.com/", "Origin": "https://player.phimapi.com", "User-Agent": UA }
        });
    }
    return JSON.stringify({ url: "", isEmbed: false });
}

// =============================================================================
// Thể loại / Quốc gia / Năm
// =============================================================================
function parseCategoriesResponse(html, apiUrl) {
    var res = [];
    for (var i = 0; i < GENRES.length; i++) res.push({ name: GENRES[i].name, slug: GENRES[i].slug });
    return JSON.stringify(res);
}

function parseCountriesResponse(html, apiUrl) {
    return JSON.stringify(COUNTRIES);
}

function parseYearsResponse(html, apiUrl) {
    var years = [];
    for (var y = 2026; y >= 2010; y--) years.push({ name: String(y), value: String(y) });
    return JSON.stringify(years);
}
