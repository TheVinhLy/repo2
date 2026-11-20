// =============================================================================
// VAAPP Plugin: PornDos  (https://www.porndos.com)
// Author: TheVinhLy  |  Version: 1.0.20
// Luồng lấy link:
//   1. parseMovieDetail → lấy video_id số (vd "9456"), set episode.id = slug|data:9456
//   2. getUrlDetail(slug, datasend="9456") → trả URL embed: /embed/9456/
//   3. App fetch embed page (HTML nhỏ ~1KB)
//   4. parseDetailResponse → parse "file:\"https://cdn/okhls/ID//master.m3u8\""
// =============================================================================

var BASE = "https://www.porndos.com";

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

function decodeHtml(s) {
    return String(s || "")
        .replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#0?39;/g, "'")
        .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&nbsp;/g, " ")
        .replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
}

// Tên từ nội dung thẻ <a>; nếu rỗng lấy title/alt; cuối cùng lấy từ slug (bỏ hậu tố _c22/_p9/_s1)
function linkName(inner, tag, slug) {
    var n = decodeHtml(inner);
    if (!n) {
        var t = String(tag || "").match(/(?:title|alt)=["']([^"']+)["']/i) || String(inner || "").match(/alt=["']([^"']+)["']/i);
        n = t ? decodeHtml(t[1]) : "";
    }
    if (!n || /^https?:\/\//i.test(n)) {
        n = String(slug || "").replace(/_[cps]\d+$/i, "").replace(/[-_+]/g, " ").replace(/\b\w/g, function (c) { return c.toUpperCase(); });
    }
    return n;
}

// -----------------------------------------------------------------------------
// Lấy các bản mp4 từ flashvars của trang video:
//   video_url / video_alt_url / video_alt_url2 / video_alt_url3 (+ _text = "360p"...)
// Trả về mảng {q, url, label} sắp xếp chất lượng cao -> thấp
// -----------------------------------------------------------------------------
function parseFlashvars(html) {
    var out = [];
    var seen = {};
    var re = /(video_(?:alt_)?url\d*)\s*:\s*'([^']+)'/gi;
    var m;
    while ((m = re.exec(String(html || ""))) !== null) {
        var key = m[1];
        var u = m[2].replace(/^function\/\d+\//i, "");
        if (!/\.mp4|get_stream|get_file/i.test(u)) continue;
        u = absUrl(u);
        if (seen[u]) continue;
        seen[u] = true;
        var tm = String(html).match(new RegExp(key + "_text\\s*:\\s*'([^']+)'", "i"));
        var label = tm ? tm[1] : "";
        var qm = label.match(/(\d{3,4})/) || u.match(/-(\d{3,4})\.mp4/i);
        out.push({ q: qm ? parseInt(qm[1], 10) : 0, url: u, label: label || (qm ? qm[1] + "p" : "mp4") });
    }
    out.sort(function (a, b) { return b.q - a.q; });
    return out;
}

function b64encode(str) {
    var chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    var out = "";
    for (var i = 0; i < str.length; i += 3) {
        var c1 = str.charCodeAt(i);
        var c2 = i + 1 < str.length ? str.charCodeAt(i + 1) : NaN;
        var c3 = i + 2 < str.length ? str.charCodeAt(i + 2) : NaN;
        out += chars.charAt(c1 >> 2) + chars.charAt(((c1 & 3) << 4) | (isNaN(c2) ? 0 : c2 >> 4));
        out += isNaN(c2) ? "=" : chars.charAt(((c2 & 15) << 2) | (isNaN(c3) ? 0 : c3 >> 6));
        out += isNaN(c3) ? "=" : chars.charAt(c3 & 63);
    }
    return out;
}

// "/video/slug-name_v123/" → "slug-name_v123"
function pathToSlug(href) {
    var m = String(href).match(/\/video\/([^"'?#|\s\/]+)/i);
    return m ? m[1] : "";
}

function pageFromUrl(url) {
    url = String(url || "").split("|")[0];
    var m = url.match(/\/(\d+)\/?$/) || url.match(/[?&]page=(\d+)/i);
    return m ? parseInt(m[1], 10) : 1;
}

function buildPagedUrl(base, page) {
    base = String(base).replace(/\/\d+\/?$/, "").replace(/\/$/, "");
    return page > 1 ? base + "/" + page + "/" : base + "/";
}

// =============================================================================
// NHÓM 1: CẤU HÌNH
// =============================================================================
function getManifest() {
    return JSON.stringify({
        "id": "porndos",
        "name": "PornDos",
        "version": "1.0.20",
        "description": "Free HD Porn Videos từ porndos.com",
        "author": "TheVinhLy",
        "baseUrl": "https://www.porndos.com",
        "iconUrl": "https://raw.githubusercontent.com/TheVinhLy/repo/main/plugins/porndos.ico",
        "referrer": "https://www.porndos.com/",
        "isEnabled": true,
        "isAdult": true,
        "type": "MOVIE",
        "layoutType": "HORIZONTAL",
        "playerType": "embed",
        "adblock": false,
        "debug": false
    });
}

function getHomeSections() {
    return JSON.stringify([
        { slug: "home",           title: "Mới Nhất",     type: "Horizontal", path: "" },
        { slug: "videos_70",      title: "Tất Cả Video", type: "Horizontal", path: "" },
        { slug: "most-viewed_83", title: "Xem Nhiều",    type: "Horizontal", path: "" },
        { slug: "top-rated_52",   title: "Đánh Giá Cao", type: "Horizontal", path: "" }
    ]);
}

function getPrimaryCategories() {
    return JSON.stringify([
        { name: "Mới Nhất",       slug: "home" },
        { name: "Tất Cả Video",   slug: "videos_70" },
        { name: "Xem Nhiều",      slug: "most-viewed_83" },
        { name: "Đánh Giá Cao",   slug: "top-rated_52" },
        { name: "Thể Loại",       slug: "categories_84" },
        { name: "Diễn Viên",      slug: "pornstars_42" },
        { name: "Studios",        slug: "studios_91" }
    ]);
}

function getFilterConfig() {
    return JSON.stringify({ sort: [], category: [] });
}

// =============================================================================
// NHÓM 2: SINH URL
// =============================================================================
function getUrlList(slug, filtersJson) {
    var filters = JSON.parse(filtersJson || "{}");
    var page = filters.page || 1;
    slug = String(slug || "home").split("|")[0].replace(/^\/+|\/+$/g, "");

    if (slug === "home" || slug === "") {
        return page > 1 ? BASE + "/" + page + "/" : BASE + "/";
    }
    return buildPagedUrl(BASE + "/" + slug, page);
}

function getUrlSearch(keyword, filtersJson) {
    var page = JSON.parse(filtersJson || "{}").page || 1;
    var kw = encodeURIComponent(String(keyword || "").trim()).replace(/%20/g, "+");
    return buildPagedUrl(BASE + "/search/" + kw, page);
}

/**
 * Nhận slug = "slug-name_v123" hoặc URL đầy đủ.
 * datasend = video_id số (vd "9456") do parseMovieDetail gắn vào.
 *
 * → Nếu có datasend (video_id số): trả URL embed page /embed/{id}/
 *   App fetch embed page → parseDetailResponse lấy m3u8 thật
 * → Fallback: trả URL trang chi tiết video để parseDetailResponse xử lý
 */
function getUrlDetail(slug, datasend) {
    if (!slug) return "";
    slug = String(slug).split("|")[0];

    // Fallback
    if (slug.indexOf("http") === 0) return slug;
    slug = slug.replace(/^\/+/, "").replace(/^video\//, "");
    return BASE + "/video/" + slug + "/";
}

function getUrlCategories() { return BASE + "/categories_84/"; }
function getUrlCountries()  { return ""; }
function getUrlYears()      { return ""; }

// =============================================================================
// NHÓM 3: PARSER
// =============================================================================

function parseListResponse(html, apiUrl) {
    var empty = JSON.stringify({ items: [], pagination: { currentPage: 1, totalPages: 1 } });
    try {
        html = String(html || "");
        var url = String(apiUrl || "");
        var items = [];
        var seen = {};
        var m;

        // ---- Trang Categories ----
        if (/\/categories_?84/i.test(url) && !/\/category\//i.test(url)) {
            var catRe = /<a\s+href="(https?:\/\/www\.porndos\.com\/category\/[^"]+)"[^>]*>\s*<img[^>]+(?:data-src|src)="([^"]+)"[^>]+alt="([^"]+)"/gi;
            while ((m = catRe.exec(html)) !== null) {
                var cSlug = m[1].replace(BASE, "").replace(/^\/|\/$/g, "");
                if (!cSlug || seen[cSlug]) continue;
                seen[cSlug] = true;
                items.push({ id: cSlug, title: decodeHtml(m[3]), posterUrl: absUrl(m[2]), quality: "CAT" });
            }
            return JSON.stringify({ items: items, pagination: { currentPage: 1, totalPages: 1 } });
        }

        // ---- Trang Pornstars ----
        if (/\/pornstars/i.test(url)) {
            var psRe = /<a\s+href="(https?:\/\/www\.porndos\.com\/pornstar\/[^"]+)"[^>]*>\s*<img[^>]+(?:data-src|src)="([^"]+)"[^>]+alt="([^"]+)"/gi;
            while ((m = psRe.exec(html)) !== null) {
                var psSlug = m[1].replace(BASE, "").replace(/^\/|\/$/g, "");
                if (!psSlug || seen[psSlug]) continue;
                seen[psSlug] = true;
                items.push({ id: psSlug, title: decodeHtml(m[3]), posterUrl: absUrl(m[2]), quality: "ACTRESS" });
            }
            return JSON.stringify({ items: items, pagination: { currentPage: pageFromUrl(url), totalPages: 999 } });
        }

        // ---- Trang Studios ----
        if (/\/studios/i.test(url)) {
            var stRe = /<a\s+href="(https?:\/\/www\.porndos\.com\/studio\/[^"]+)"[^>]*>\s*<img[^>]+(?:data-src|src)="([^"]+)"[^>]+alt="([^"]+)"/gi;
            while ((m = stRe.exec(html)) !== null) {
                var stSlug = m[1].replace(BASE, "").replace(/^\/|\/$/g, "");
                if (!stSlug || seen[stSlug]) continue;
                seen[stSlug] = true;
                items.push({ id: stSlug, title: decodeHtml(m[3]), posterUrl: absUrl(m[2]), quality: "CAT" });
            }
            return JSON.stringify({ items: items, pagination: { currentPage: 1, totalPages: 1 } });
        }

        // ---- Danh sách video ----
        // Cấu trúc: <div class="item" ...><a href="/video/SLUG/"><img data-src="..." alt="TITLE">
        var blocks = html.split(/<div\s+class="item"/i);
        blocks.shift();

        for (var i = 0; i < blocks.length; i++) {
            var b = blocks[i];

            var hm = b.match(/href="(https?:\/\/www\.porndos\.com\/video\/[^"]+)"/i);
            if (!hm) continue;
            var slug = pathToSlug(hm[1]);
            if (!slug || seen[slug]) continue;

            var im = b.match(/(?:data-src|src)="(\/images\/thumb\/[^"]+)"/i);
            var tm = b.match(/alt="([^"]+)"/i);

            // Duration: <span class="right"><i ...></i> MM:SS</span>
            var dur = "";
            var durM = b.match(/<span[^>]*class="right"[^>]*>[\s\S]*?(\d{1,2}:\d{2}(?::\d{2})?)/i);
            if (durM) dur = durM[1];

            seen[slug] = true;
            items.push({
                id: slug,
                title: tm ? decodeHtml(tm[1]) : slug.replace(/_v\d+$/, "").replace(/-/g, " "),
                posterUrl: im ? absUrl(im[1]) : "",
                description: dur,
                quality: "HD"
            });
        }

        // Phân trang
        var current = pageFromUrl(url);
        var total = current;
        var pageRe = /href="[^"]*\/(\d+)\/"[^>]*title="Page \d+"/gi;
        var pm;
        while ((pm = pageRe.exec(html)) !== null) {
            var n = parseInt(pm[1], 10);
            if (n < 10000 && n > total) total = n;
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

/**
 * Parse trang chi tiết video.
 * KEY: lấy video_id số từ flashvars (vd video_id: '9456')
 * Gán vào episode.datasend để getUrlDetail biết gọi /embed/{id}/
 */
function parseMovieDetail(html, apiUrl, datasend) {
    html = String(html || "");

    var id = pathToSlug(apiUrl || "");
    if (!id) {
        var c = html.match(/<link[^>]+rel="canonical"[^>]+href="([^"]+)"/i);
        if (c) id = pathToSlug(c[1]);
    }

    // video_id số (dùng để build embed URL)
    var vidIdMatch = html.match(/video_id:\s*'(\d+)'/i);
    var vidId = vidIdMatch ? vidIdMatch[1] : "";
    console.log("parseMovieDetail: id=" + id + " vidId=" + vidId);

    // Title
    var t = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)
        || html.match(/<meta[^>]+property="og:title"[^>]+content="([^"]+)"/i);
    var title = t ? decodeHtml(t[1]) : "Video";

    // Poster
    var p = html.match(/<link[^>]+fetchpriority="high"[^>]+href="([^"]+\.webp)"/i)
        || html.match(/<meta[^>]+property="og:image"[^>]+content="([^"]+)"/i)
        || html.match(/preview_url:\s*'([^']+)'/i);
    var poster = p ? absUrl(p[1]) : "";

    // Description
    var d = html.match(/<meta[^>]+itemprop="description"[^>]+content="([^"]*)"/i)
        || html.match(/<meta[^>]+name="description"[^>]+content="([^"]*)"/i);

    // Duration
    var dur = html.match(/(\d{1,2}:\d{2}(?::\d{2})?)/);

    // Categories + Pornstars: luôn hiển thị TÊN (không để URL/slug)
    var cats = [];
    var seenC = {};
    var cr = /<a\s[^>]*href="(?:https?:\/\/www\.porndos\.com)?\/category\/([^"\/?#]+)\/?"[^>]*>([\s\S]*?)<\/a>/gi;
    var cm;
    while ((cm = cr.exec(html)) !== null) {
        var cs = cm[1];
        if (seenC[cs]) continue;
        var cn = linkName(cm[2], cm[0], cs);
        if (cn) { seenC[cs] = true; cats.push("[" + cn + "](category/" + cs + ")"); }
    }
    if (cats.length === 0) {
        var vcMatch = html.match(/video_categories:\s*'([^']+)'/i);
        if (vcMatch) {
            vcMatch[1].split(",").forEach(function(c) { c = c.trim(); if (c) cats.push(c); });
        }
    }

    var casts = [];
    var seenA = {};
    var ar = /<a\s[^>]*href="(?:https?:\/\/www\.porndos\.com)?\/pornstar\/([^"\/?#]+)\/?"[^>]*>([\s\S]*?)<\/a>/gi;
    var am;
    while ((am = ar.exec(html)) !== null) {
        var as = am[1];
        if (seenA[as]) continue;
        var an = linkName(am[2], am[0], as);
        if (an) { seenA[as] = true; casts.push("[" + an + "](pornstar/" + as + ")"); }
    }
    console.log("DETAIL cats=" + cats.length + " casts=" + casts.length + (cats[0] ? " vd " + cats[0] : ""));

    // Nếu có vidId → episode dùng datasend để truyền qua getUrlDetail → /embed/{id}/
    // Nếu không có vidId → fallback: episode.id = trang chi tiết, parseDetailResponse tự xử lý
    var episodeId, episodeDatasend;
    if (vidId) {
        episodeId = id;          // slug trang video (để getUrlDetail nhận slug, datasend=vidId)
        episodeDatasend = vidId; // video_id số
    } else {
        // Không có vidId → dùng URL trang chi tiết, parseDetailResponse sẽ parse lại
        episodeId = BASE + "/video/" + id + "/";
        episodeDatasend = "";
    }

    var epObj = { id: id, name: "Full", slug: id || "full", datasend: "" };

    // Mô tả chỉ 1 dòng ngắn để không đẩy/che các mục khác trên TV
    var descText = d ? decodeHtml(d[1]) : "";
    descText = descText.replace(/\s+/g, " ").trim();
    if (descText.length > 90) descText = descText.substring(0, 87).replace(/\s+\S*$/, "") + "...";

    return JSON.stringify({
        id: id,
        title: title,
        posterUrl: poster,
        backdropUrl: poster,
        description: descText,
        servers: [{
            name: "PornDos",
            episodes: [epObj]
        }],
        quality: "HD",
        status: "Full",
        duration: dur ? dur[1] : "",
        casts: casts.join(", "),
        // TV không hiện mục "Diễn viên" -> đưa diễn viên vào đầu mục Thể loại (nút bấm mở trang diễn viên)
        category: casts.concat(cats).join(", ")
    });
}

/**
 * Tìm link phát trong HTML (embed page hoặc trang video).
 * Ưu tiên m3u8 > mp4 > webm; bỏ qua clip xem trước /images/video/*.webm
 */
function findStream(html) {
    var h = String(html || "").replace(/\\\//g, "/").replace(/&amp;/g, "&");
    var found = { m3u8: "", mp4: "", webm: "", cdn: "" };

    // Playerjs: file:"[360p]url,[720p]url" hoặc file:"url"
    var fm = h.match(/["']?file["']?\s*[:=]\s*["']([^"']+)["']/i);
    if (fm) {
        var parts = fm[1].split(",");
        for (var i = 0; i < parts.length; i++) {
            var u = parts[i].replace(/^\[[^\]]*\]/, "").trim();
            if (/^(?:https?:)?\/\//i.test(u) || u.charAt(0) === "/") consider(u);
        }
    }
    // Mọi URL có đuôi media
    var re = /["'`(]((?:https?:)?\/\/[^"'`\s)]+?\.(m3u8|mp4|webm)(?:\?[^"'`\s)]*)?)["'`)]/gi;
    var m;
    while ((m = re.exec(h)) !== null) consider(m[1]);
    // src tương đối
    var re2 = /["'`](\/[^"'`\s]+?\.(m3u8|mp4|webm)(?:\?[^"'`\s]*)?)["'`]/gi;
    while ((m = re2.exec(h)) !== null) consider(m[1]);

    // Link CDN của VK/OK không có đuôi file (vd https://ok6-30.vkuser.net/?expires=...)
    var re3 = /["'`]((?:https?:)?\/\/[^"'`\s]*(?:vkuser\.net|okcdn\.ru|mycdn\.me|vkvideo\.ru)[^"'`\s]*)["'`]/gi;
    while ((m = re3.exec(h)) !== null) { if (!found.cdn) found.cdn = absUrl(m[1]); }

    function consider(u) {
        if (/\/images\/(?:video|thumb)\//i.test(u)) return; // clip xem trước
        var ext = (u.match(/\.(m3u8|mp4|webm)(?:[?#]|$)/i) || [])[1];
        if (!ext) return;
        ext = ext.toLowerCase();
        if (!found[ext]) found[ext] = absUrl(u);
    }
    return found.m3u8 || found.mp4 || found.cdn || found.webm || "";
}

function streamResult(url, ref) {
    ref = ref || (BASE + "/");
    var isM3u8 = /\.m3u8/i.test(url);
    return JSON.stringify({
        url: url,
        isEmbed: false,
        mimeType: isM3u8 ? "application/x-mpegURL" : (/\.webm/i.test(url) ? "video/webm" : "video/mp4"),
        headers: {
            "Referer": ref,
            "Origin": BASE,
            "User-Agent": "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36"
        },
        subtitles: []
    });
}

/**
 * Parse embed page (hoặc trang video) để lấy link phát thật.
 */
function parseDetailResponse(html, apiUrl, datasend) {
    html = String(html || "");
    console.log("parseDetailResponse: url=" + apiUrl + " len=" + html.length);

    // Trang video chính: mở trực tiếp trong WebView để trình phát của site tự chạy
    // (trang /embed/ khi mở riêng sẽ bị chuyển sang thorcdn.com; get_stream/*.mp4 trả "error" ngoài trình duyệt)
    var vp = String(apiUrl || "").split("|")[0];
    if (/\/video\/[^\/]+/i.test(vp)) {
        // Nhúng trang video của site vào khung toàn màn hình (trình phát của site tự chạy, chọn chất lượng ngay trong đó)
        var page = '<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
            '<style>html,body{margin:0;height:100%;background:#000;overflow:hidden}</style></head><body>' +
            '<iframe src="' + vp + '" style="position:absolute;top:0;left:0;width:100%;height:100%;border:0;background:#000" allow="autoplay; fullscreen" allowfullscreen></iframe>' +
            '</body></html>';
        console.log("parseDetailResponse: iframe trang video " + vp);
        return JSON.stringify({
            url: "data:text/html;base64," + b64encode(page),
            isEmbed: true,
            headers: { "Referer": BASE + "/" },
            subtitles: []
        });
    }
    if (/\/video\/[^\/]+/i.test(vp)) {
        console.log("parseDetailResponse: mở trang video " + vp);
        return JSON.stringify({
            url: vp,
            isEmbed: true,
            headers: {
                "Referer": BASE + "/",
                "User-Agent": "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36"
            },
            subtitles: []
        });
    }

    // Link get_stream/*.mp4 và m3u8 bị site chặn khi tải ngoài trình duyệt (trả "error").
    // Nên mở chính trang embed của site trong WebView, để trình phát của site tự chạy.
    var embedUrl0 = "";
    var em0 = String(apiUrl || "").match(/^(?:https?:\/\/www\.porndos\.com)?\/embed\/(\d+)/i);
    if (em0) {
        embedUrl0 = BASE + "/embed/" + em0[1] + "/";
    } else {
        var vm0 = html.match(/video_id:\s*'(\d+)'/i) || html.match(/\/embed\/(\d+)\/?/i);
        if (vm0) embedUrl0 = BASE + "/embed/" + vm0[1] + "/";
    }
    if (embedUrl0) {
        console.log("parseDetailResponse: embed=" + embedUrl0);
        return JSON.stringify({
            url: embedUrl0,
            isEmbed: true,
            headers: {
                "Referer": BASE + "/",
                "User-Agent": "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36"
            },
            subtitles: []
        });
    }

    var stream = findStream(html);
    if (stream) {
        console.log("parseDetailResponse: stream=" + stream);
        return streamResult(stream, String(apiUrl || "").indexOf("/embed/") >= 0 ? String(apiUrl).split("|")[0] : "");
    }

    // Trang video gốc → tìm /embed/ID/
    var embedMatch = html.match(/["']((?:https?:\/\/www\.porndos\.com)?\/embed\/(\d+)\/?)["']/i);
    if (embedMatch && String(apiUrl || "").indexOf("/embed/") < 0) {
        var embedUrl = embedMatch[1].indexOf("http") === 0 ? embedMatch[1] : BASE + embedMatch[1];
        console.log("parseDetailResponse: embed=" + embedUrl);
        return JSON.stringify({ url: embedUrl, isEmbed: true, headers: { "Referer": BASE + "/" }, subtitles: [] });
    }

    // Không thấy link: để App tự bóc tách từ trang embed, kèm log để debug
    console.log("KHÔNG THẤY LINK. head=" + html.replace(/\s+/g, " ").substring(0, 600));
    var fallbackUrl = String(apiUrl || "");
    if (fallbackUrl.indexOf("http") !== 0) fallbackUrl = "";
    return JSON.stringify({ url: fallbackUrl, isEmbed: !!fallbackUrl, headers: { "Referer": BASE + "/" }, subtitles: [] });
}

function parseEmbedResponse(html, sourceUrl) {
    html = String(html || "");
    console.log("parseEmbedResponse: url=" + sourceUrl + " len=" + html.length);
    var stream = findStream(html);
    if (stream) return streamResult(stream, String(sourceUrl || "").indexOf("/embed/") >= 0 ? sourceUrl : "");
    console.log("parseEmbedResponse: KHÔNG THẤY LINK head=" + html.replace(/\s+/g, " ").substring(0, 600));
    return JSON.stringify({ url: "", isEmbed: false });
}

// =============================================================================
// Categories/Countries/Years
// =============================================================================
function parseCategoriesResponse(html, apiUrl) {
    try {
        var res = [];
        var seen = {};
        var re = /<a\s+href="(https?:\/\/www\.porndos\.com\/category\/([^"\/]+)\/?)"\s*>\s*<img[^>]+alt="([^"]+)"/gi;
        var m;
        while ((m = re.exec(html)) !== null) {
            var slug = m[1].replace(BASE, "").replace(/^\/|\/$/g, "");
            var name = decodeHtml(m[3]);
            if (!name || seen[slug]) continue;
            seen[slug] = true;
            res.push({ name: name, slug: slug });
        }
        return JSON.stringify(res);
    } catch (e) { return "[]"; }
}

function parseCountriesResponse(html) { return "[]"; }
function parseYearsResponse(html) { return "[]"; }
