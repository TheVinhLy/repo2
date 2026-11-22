// =============================================================================
// VAAPP Plugin: Phim4K  (https://phim4k.top)
// Author: TheVinhLy  |  Version: 1.0.1
//
// Luồng:
//   Danh sách : /phim-le/ | /phim-bo/ | /phim-chieu-rap/ | /phim-hot/   (trang: /page/N/)
//               lọc: ?genre=slug  ?region=slug  ?year=YYYY
//   Tìm kiếm  : /tim-kiem?q=...
//   Chi tiết  : /phim/{slug}   (máy chủ khác: ?sv=N)
//   Trang xem : /xem-phim/{slug}?tap=...&sv=N
//               có <script id="rx-player-data">{"m3u8":"...","embed":"..."}</script>
//               → phát thẳng m3u8 bằng ExoPlayer (không mở trang web → không popup/quảng cáo TVC)
// =============================================================================

var BASE = "https://phim4k.top";
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

function textOf(s) {
    var t = decodeEntities(s);
    t = t.replace(/<br\s*\/?>/gi, " ").replace(/<[^>]+>/g, " ");
    return decodeEntities(t).replace(/\s+/g, " ").trim();
}

function shortText(s, n) {
    s = String(s || "").replace(/\s+/g, " ").trim();
    return s.length > n ? s.substring(0, n - 3).trim() + "..." : s;
}

// Ảnh: ưu tiên thuộc tính lazy; bỏ ảnh data: / placeholder
function imgOf(block) {
    var re = /<img\b[^>]*>/gi;
    var m;
    while ((m = re.exec(block)) !== null) {
        var tag = m[0];
        var a = tag.match(/\s(?:data-src|data-lazy-src|data-original)=["']([^"']+)["']/i)
            || tag.match(/\ssrc=["']([^"']+)["']/i);
        if (a && a[1].indexOf("data:") !== 0) return absUrl(a[1]);
    }
    return "";
}

function slugFromPhim(href) {
    var m = String(href || "").match(/\/phim\/([^"'?#\s\/]+)/i);
    return m ? m[1] : "";
}

function pageFromUrl(url) {
    var m = String(url || "").match(/\/page\/(\d+)/i) || String(url || "").match(/[?&]page=(\d+)/i);
    return m ? parseInt(m[1], 10) : 1;
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

// =============================================================================
// NHÓM 1: CẤU HÌNH
// =============================================================================
function getManifest() {
    return JSON.stringify({
        "id": "phim4k",
        "name": "Phim4K",
        "version": "1.0.1",
        "description": "Phim lẻ, phim bộ, chiếu rạp từ phim4k.top (phát thẳng, không popup)",
        "author": "TheVinhLy",
        "baseUrl": "https://phim4k.top",
        "iconUrl": "https://raw.githubusercontent.com/TheVinhLy/repo2/main/plugins/phim4k.ico",
        "referrer": "https://phim4k.top/",
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
        { slug: "phim-hot", title: "Phim Hot", type: "Horizontal", path: "" },
        { slug: "phim-chieu-rap", title: "Phim Chiếu Rạp", type: "Horizontal", path: "" },
        { slug: "phim-bo", title: "Phim Bộ", type: "Horizontal", path: "" },
        { slug: "phim-le", title: "Phim Lẻ", type: "Horizontal", path: "" }
    ]);
}

function getPrimaryCategories() {
    return JSON.stringify([
        { name: "Phim Lẻ", slug: "phim-le" },
        { name: "Phim Bộ", slug: "phim-bo" },
        { name: "Chiếu Rạp", slug: "phim-chieu-rap" },
        { name: "Phim Hot", slug: "phim-hot" }
    ]);
}

function getFilterConfig() {
    return JSON.stringify({ sort: [], category: [] });
}

// =============================================================================
// NHÓM 2: SINH URL
// =============================================================================
function listUrl(path, page, query) {
    var url = BASE + "/" + path.replace(/^\/+|\/+$/g, "") + "/";
    if (page > 1) url += "page/" + page + "/";
    if (query) url += "?" + query;
    return url;
}

function getUrlList(slug, filtersJson) {
    var filters = {};
    try { filters = JSON.parse(filtersJson || "{}"); } catch (e) {}
    var page = parseInt(filters.page, 10) || 1;

    slug = String(slug || "phim-le").split("|")[0].trim();
    if (slug.indexOf("http") === 0) slug = slug.replace(/^https?:\/\/[^\/]+/i, "");
    slug = slug.replace(/^\/+|\/+$/g, "");
    if (!slug || slug === "home") slug = "phim-le";

    // Bộ lọc: thể loại / quốc gia / năm (ghép được với nhau)
    var q = [];
    if (filters.category) q.push("genre=" + encodeURIComponent(filters.category));
    if (filters.country) q.push("region=" + encodeURIComponent(filters.country));
    if (filters.year) q.push("year=" + encodeURIComponent(filters.year));
    if (q.length > 0) {
        var section = /^(phim-le|phim-bo|phim-chieu-rap|phim-hot)$/.test(slug) ? slug : "phim-le";
        return listUrl(section, page, q.join("&"));
    }

    if (/^\d{4}$/.test(slug)) return listUrl("phim-le", page, "year=" + slug);
    return listUrl(slug, page, "");
}

function getUrlSearch(keyword, filtersJson) {
    var filters = {};
    try { filters = JSON.parse(filtersJson || "{}"); } catch (e) {}
    var page = parseInt(filters.page, 10) || 1;
    var url = BASE + "/tim-kiem?q=" + encodeURIComponent(String(keyword || "").trim());
    if (page > 1) url += "&page=" + page;
    return url;
}

// slug: slug phim, hoặc URL đầy đủ (id tập = link trang xem)
function getUrlDetail(slug, datasend) {
    if (!slug) return "";
    slug = String(slug).split("|")[0];
    if (slug.indexOf("http") === 0) return slug.replace(/&amp;/g, "&");
    slug = slug.replace(/^\/+/, "");
    if (slug.indexOf("phim/") === 0 || slug.indexOf("xem-phim/") === 0) return BASE + "/" + slug;
    return BASE + "/phim/" + slug;
}

function getUrlCategories() { return BASE + "/phim-le/"; }
function getUrlCountries() { return BASE + "/phim-le/"; }
function getUrlYears() { return BASE + "/phim-le/"; }

// =============================================================================
// NHÓM 3: PARSER
// =============================================================================
function parseListResponse(html, apiUrl) {
    var empty = JSON.stringify({ items: [], pagination: { currentPage: 1, totalPages: 1 } });
    try {
        html = String(html || "");
        var items = [];
        var seen = {};

        var blocks = html.split(/<div\s+class="sw-item"[^>]*>/i);
        blocks.shift();

        for (var i = 0; i < blocks.length; i++) {
            var b = blocks[i];
            var hm = b.match(/<a[^>]+href="([^"]*\/phim\/[^"]+)"[^>]*>/i);
            if (!hm) continue;
            var slug = slugFromPhim(hm[1]);
            if (!slug || seen[slug]) continue;
            seen[slug] = true;

            var tm = b.match(/class="item-title[^"]*"[^>]*>\s*<a[^>]*title="([^"]+)"/i)
                || b.match(/class="item-title[^"]*"[^>]*>[\s\S]*?<a[^>]*>([\s\S]*?)<\/a>/i)
                || b.match(/alt="([^"]+)"/i);
            var title = tm ? textOf(tm[1]) : slug.replace(/-/g, " ");

            var tags = [];
            var tr = /<span\s+class="tag-small"[^>]*>([\s\S]*?)<\/span>/gi;
            var tmm;
            while ((tmm = tr.exec(b)) !== null) tags.push(textOf(tmm[1]));
            var lab = b.match(/<i\s+class="rect[^"]*"[^>]*>([\s\S]*?)<\/i>/i);

            var ym = slug.match(/-((?:19|20)\d{2})$/);

            items.push({
                id: slug,
                title: title,
                posterUrl: imgOf(b),
                year: ym ? parseInt(ym[1], 10) : 0,
                quality: tags.length > 1 ? tags[tags.length - 1] : "",
                episode_current: tags.length > 0 ? tags[0] : "",
                lang: lab ? textOf(lab[1]) : ""
            });
        }

        // Phân trang
        var current = pageFromUrl(apiUrl);
        var total = current;
        var mm = html.match(/class="[^"]*rx-jump-page[^"]*"[^>]*\smax="(\d+)"/i)
            || html.match(/\smax="(\d+)"[^>]*class="[^"]*rx-jump-page/i);
        if (mm) total = parseInt(mm[1], 10);
        var cm = html.match(/class="[^"]*rx-jump-page[^"]*"[^>]*\svalue="(\d+)"/i);
        if (cm) current = parseInt(cm[1], 10);
        if (!mm) {
            var re = /\/page\/(\d+)\//gi, pm;
            while ((pm = re.exec(html)) !== null) {
                var n = parseInt(pm[1], 10);
                if (n < 100000 && n > total) total = n;
            }
        }
        if (total < current) total = current;
        return JSON.stringify({ items: items, pagination: { currentPage: current, totalPages: total } });
    } catch (e) {
        console.log("parseListResponse lỗi: " + e);
        return empty;
    }
}

function parseSearchResponse(html, apiUrl) {
    return parseListResponse(html, apiUrl);
}

// "Thể loại:" → [{name,href}]
function metaLinks(html, label) {
    var re = new RegExp('<span>\\s*' + label + '\\s*:\\s*</span>\\s*<div>([\\s\\S]*?)</div>', "i");
    var m = html.match(re);
    var out = [];
    if (!m) return out;
    var ar = /<a[^>]+href="https?:\/\/[^\/"]+\/([^"]+?)\/?"[^>]*>([\s\S]*?)<\/a>/gi, am;
    while ((am = ar.exec(m[1])) !== null) out.push({ name: textOf(am[2]), path: am[1] });
    return out;
}

function metaText(html, label) {
    var re = new RegExp('<span>\\s*' + label + '\\s*:\\s*</span>\\s*<div[^>]*>([\\s\\S]*?)</div>', "i");
    var m = html.match(re);
    return m ? textOf(m[1]) : "";
}

function mdLinks(arr) {
    var out = [];
    for (var i = 0; i < arr.length; i++) {
        if (!arr[i].name) continue;
        out.push("[" + arr[i].name.replace(/[\[\]]/g, "") + "](" + arr[i].path + ")");
    }
    return out;
}

// Tập phim trong một trang chi tiết (phim bộ: .tph-ep ; phim lẻ: .rx-watch-ver)
function parseEpisodes(html) {
    var eps = [];
    var seen = {};
    var re = /<a[^>]+class="(?:tph-ep|rx-watch-ver)[^"]*"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
    var re2 = /<a[^>]+href="([^"]+)"[^>]*class="(?:tph-ep|rx-watch-ver)[^"]*"[^>]*>([\s\S]*?)<\/a>/gi;
    var list = [re, re2];
    for (var k = 0; k < list.length; k++) {
        var m;
        while ((m = list[k].exec(html)) !== null) {
            var url = absUrl(m[1]);
            if (url.indexOf("/xem-phim/") < 0 || seen[url]) continue;
            seen[url] = true;
            var nm = textOf(m[2]) || "Full";
            var sm = url.match(/[?&]tap=([^&#]+)/i);
            var svm = url.match(/[?&]sv=(\d+)/i);
            eps.push({ id: url, name: nm, slug: (sm ? sm[1] : nm) + (svm ? "-sv" + svm[1] : "") });
        }
        if (eps.length > 0) break;
    }
    return eps;
}

function parseServerTabs(html) {
    var out = [];
    var re = /<a[^>]+class="tph-server[^"]*"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi, m;
    var seen = {};
    while ((m = re.exec(html)) !== null) {
        var url = absUrl(m[1]);
        if (seen[url]) continue;
        seen[url] = true;
        var name = textOf(m[2].replace(/<svg[\s\S]*?<\/svg>/gi, "").replace(/<span[^>]*class="tph-svcount"[\s\S]*?<\/span>/gi, ""));
        out.push({ name: name || "Server", url: url });
    }
    return out;
}

function parseMovieDetail(html, apiUrl, datasend) {
    html = String(html || "");

    var id = slugFromPhim(apiUrl || "");
    if (!id) {
        var c = html.match(/<link[^>]+rel="canonical"[^>]+href="([^"]+)"/i);
        if (c) id = slugFromPhim(c[1]);
    }

    var h1 = html.match(/<h1[^>]*class="tph-title"[^>]*>([\s\S]*?)<\/h1>/i);
    var title = h1 ? textOf(h1[1]) : "";
    if (!title) {
        var t2 = html.match(/<meta[^>]+property="og:title"[^>]+content="([^"]+)"/i);
        title = t2 ? textOf(t2[1]).replace(/\s*\|\s*Phim4k.*$/i, "") : (id || "Phim");
    }
    var on = html.match(/<div[^>]*class="tph-origin"[^>]*>([\s\S]*?)<\/div>/i);
    var originName = on ? textOf(on[1]) : "";

    var og = html.match(/<meta[^>]+property="og:image"[^>]+content="([^"]+)"/i);
    var poster = og ? absUrl(og[1]) : "";

    var dm = html.match(/class="tph-plot-txt"[^>]*>([\s\S]*?)<\/div>/i);
    var description = dm ? textOf(dm[1]) : "";
    if (!description) {
        var od = html.match(/<meta[^>]+property="og:description"[^>]+content="([^"]*)"/i);
        description = od ? textOf(od[1]) : "";
    }

    // Huy hiệu: chất lượng / tình trạng / ngôn ngữ
    var badges = [];
    var br = /<span\s+class="tph-badge([^"]*)"[^>]*>([\s\S]*?)<\/span>/gi, bm;
    var imdb = "";
    while ((bm = br.exec(html)) !== null) {
        var cls = bm[1], tx = textOf(bm[2]);
        if (/imdb/.test(cls)) { imdb = tx; continue; }
        badges.push(tx);
    }
    var quality = "", status = "", lang = [];
    for (var i = 0; i < badges.length; i++) {
        if (/^(HD|FHD|4K|CAM|SD|TS|HDCAM)$/i.test(badges[i])) quality = badges[i];
        else if (/vietsub|thuyết minh|lồng tiếng/i.test(badges[i])) lang.push(badges[i]);
        else status = badges[i];
    }

    var yearStr = metaText(html, "Năm");
    var genres = metaLinks(html, "Thể loại");
    var directors = metaLinks(html, "Đạo diễn");
    var countries = metaLinks(html, "Quốc gia");

    // Diễn viên → chip bấm được: [Tên](dien-vien/slug)
    var casts = [];
    var ar = /<a\s+class="rx-actor"[^>]*href="https?:\/\/[^\/"]+\/(dien-vien\/[^"\/?#]+)\/?"[^>]*title="([^"]*)"/gi, am;
    var seenA = {};
    while ((am = ar.exec(html)) !== null) {
        if (seenA[am[1]]) continue;
        seenA[am[1]] = true;
        casts.push({ name: textOf(am[2]), path: am[1] });
    }
    var castMd = mdLinks(casts.slice(0, 12));
    var genreMd = mdLinks(genres);

    // ---- Máy chủ & tập ----
    var servers = [];
    var tabs = parseServerTabs(html);
    var firstEps = parseEpisodes(html);

    if (tabs.length > 1 && firstEps.length > 0 && html.indexOf('class="tph-ep') >= 0) {
        // Phim bộ nhiều máy chủ: mỗi máy chủ có danh sách tập riêng (?sv=N)
        for (var t = 0; t < tabs.length; t++) {
            var eps = [];
            if (t === 0) eps = firstEps;
            else {
                var h2 = fetchPage(tabs[t].url);
                if (h2) eps = parseEpisodes(h2);
            }
            if (eps.length > 0) servers.push({ name: tabs[t].name, episodes: eps });
        }
    } else if (html.indexOf('class="rx-watch-ver') >= 0 && html.indexOf('class="tph-ep') < 0) {
        // Phim lẻ: mỗi "bản chiếu" là một máy chủ chỉ có 1 tập
        for (var e = 0; e < firstEps.length; e++) {
            var nm = firstEps[e].name.replace(/\s*•.*$/, "").trim() || "VS" + (e + 1);
            servers.push({ name: nm, episodes: [{ id: firstEps[e].id, name: "Full", slug: firstEps[e].slug }] });
        }
    } else if (firstEps.length > 0) {
        servers.push({ name: tabs.length ? tabs[0].name : "VS1", episodes: firstEps });
    }

    // Dự phòng: nút "Xem Ngay"
    if (servers.length === 0) {
        var wm = html.match(/<a[^>]+class="tph-watch"[^>]*href="([^"]+)"/i)
            || html.match(/<a[^>]+href="([^"]+)"[^>]*class="tph-watch"/i);
        if (wm) servers.push({ name: "VS1", episodes: [{ id: absUrl(wm[1]), name: "Full", slug: "full" }] });
    }

    // Mô tả ngắn (TV box hay bị che thông tin) — chỉ giữ 1-2 dòng
    var short = shortText(description, 160);

    return JSON.stringify({
        id: id,
        title: title,
        originName: originName,
        posterUrl: poster,
        backdropUrl: poster,
        description: short,
        year: parseInt(yearStr, 10) || 0,
        quality: quality || "HD",
        status: status,
        episode_current: status,
        lang: lang.join(", "),
        duration: "",
        director: directors.map(function (d) { return d.name; }).join(", "),
        casts: castMd.join(", "),
        country: mdLinks(countries).join(", "),
        // TV box ẩn hàng "Diễn viên" → đưa tên diễn viên vào chip thể loại
        category: castMd.concat(genreMd).join(", "),
        servers: servers
    });
}

// ---- Trang xem → link phát ----
function parseDetailResponse(html, apiUrl, datasend) {
    html = String(html || "");

    var hdr = { "Referer": BASE + "/", "Origin": BASE, "User-Agent": UA };

    // 1) JSON của trình phát: {"m3u8":"...","embed":"..."}
    var jm = html.match(/<script[^>]+id="rx-player-data"[^>]*>([\s\S]*?)<\/script>/i);
    var data = null;
    if (jm) { try { data = JSON.parse(jm[1]); } catch (e) { data = null; } }
    if (data) {
        var m3 = String(data.m3u8 || "").replace(/\\\//g, "/");
        if (/^https?:\/\//i.test(m3)) {
            return JSON.stringify({
                url: m3,
                isEmbed: false,
                mimeType: "application/x-mpegURL",
                headers: hdr,
                subtitles: data.sub ? [{ url: absUrl(data.sub), name: "Vietsub", lang: "vi" }] : []
            });
        }
        var em = String(data.embed || "").replace(/\\\//g, "/");
        if (/^https?:\/\//i.test(em)) {
            var mq = em.match(/[?&]url=([^&"']+)/i);
            if (mq) {
                var u = mq[1];
                try { u = decodeURIComponent(u); } catch (e2) {}
                if (/\.m3u8/i.test(u)) {
                    return JSON.stringify({ url: u, isEmbed: false, mimeType: "application/x-mpegURL", headers: hdr, subtitles: [] });
                }
            }
            return JSON.stringify({ url: em, isEmbed: true, headers: hdr, subtitles: [] });
        }
    }

    // 2) Bất kỳ link m3u8 / mp4 nào trong trang
    var any = html.replace(/\\\//g, "/").match(/https?:\/\/[^"'\s<>\\]+\.(?:m3u8|mp4)(?:\?[^"'\s<>\\]*)?/i);
    if (any && any[0].indexOf("video888") < 0) {
        return JSON.stringify({
            url: any[0],
            isEmbed: false,
            mimeType: /\.mp4/i.test(any[0]) ? "video/mp4" : "application/x-mpegURL",
            headers: hdr,
            subtitles: []
        });
    }

    console.log("parseDetailResponse: không tìm thấy link phát, url=" + apiUrl);
    return JSON.stringify({ url: "", isEmbed: false, headers: hdr, subtitles: [] });
}

function parseEmbedResponse(html, sourceUrl) {
    html = String(html || "").replace(/\\\//g, "/");
    var m = html.match(/https?:\/\/[^"'\s<>\\]+\.m3u8[^"'\s<>\\]*/i);
    if (m) {
        return JSON.stringify({
            url: m[0], isEmbed: false, mimeType: "application/x-mpegURL",
            headers: { "Referer": BASE + "/", "User-Agent": UA }
        });
    }
    return JSON.stringify({ url: "", isEmbed: false });
}

// =============================================================================
// Thể loại / Quốc gia / Năm  (đọc từ menu lọc của trang danh sách)
// =============================================================================
function collectFilter(html, param) {
    var res = [];
    var seen = {};
    var re = new RegExp('<a[^>]+href="[^"]*[?&]' + param + '=([^"&]+)"[^>]*>([\\s\\S]*?)</a>', "gi"), m;
    while ((m = re.exec(String(html || ""))) !== null) {
        var v = decodeURIComponent(m[1]);
        var n = textOf(m[2]);
        if (!n || seen[v]) continue;
        seen[v] = true;
        res.push({ name: n, value: v });
    }
    return res;
}

function parseCategoriesResponse(html, apiUrl) {
    var list = collectFilter(html, "genre");
    var out = [];
    for (var i = 0; i < list.length; i++) out.push({ name: list[i].name, slug: list[i].value });
    return JSON.stringify(out);
}

function parseCountriesResponse(html, apiUrl) {
    return JSON.stringify(collectFilter(html, "region"));
}

function parseYearsResponse(html, apiUrl) {
    var list = collectFilter(html, "year");
    if (list.length === 0) {
        for (var y = 2026; y >= 1987; y--) list.push({ name: String(y), value: String(y) });
    }
    return JSON.stringify(list);
}
