// =============================================================================
// CôBe Phim (https://cobephim.ink) - Plugin v1.0.0
// Web Next.js (render sẵn HTML). Link m3u8 nằm trong trang xem phim (/phim/<slug>/tap-<id>)
// =============================================================================

var BASE = "https://cobephim.ink";
var UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";

function getManifest() {
    return JSON.stringify({
        "id": "cobephim",
        "name": "CôBe Phim",
        "version": "1.0.5",
        "description": "Xem phim lẻ, phim bộ tại cobephim.ink",
        "author": "TheVinhLy",
        "baseUrl": "https://cobephim.ink",
        "iconUrl": "https://raw.githubusercontent.com/TheVinhLy/repo/main/plugins/cobephim.ico",
        "referrer": "https://cobephim.ink/",
        "isEnabled": true,
        "isAdult": false,
        "type": "MOVIE",
        "layoutType": "HORIZONTAL",
        "playerType": "exoplayer",
        "debug": true
    });
}

function getHomeSections() {
    return JSON.stringify([
        { slug: 'phim-le', title: 'Phim Lẻ', type: 'Horizontal', path: '' },
        { slug: 'phim-bo', title: 'Phim Bộ', type: 'Horizontal', path: '' }
    ]);
}

function getPrimaryCategories() {
    return JSON.stringify([
        { name: 'Phim lẻ', slug: 'phim-le' },
        { name: 'Phim bộ', slug: 'phim-bo' }
    ]);
}

function getFilterConfig() {
    return JSON.stringify({});
}

// =============================================================================
// URL
// =============================================================================

function getUrlList(slug, filtersJson) {
    var filters = {};
    try { filters = JSON.parse(filtersJson || "{}"); } catch (e) {}
    var page = parseInt(filters.page || 1, 10) || 1;
    var path = slug || "phim-le";

    // App gọi getUrlList("tinh-cam") khi bấm chip thể loại -> tự suy ra đường dẫn
    if (filters.category) path = "the-loai/" + filters.category;
    else if (filters.country) path = "quoc-gia/" + filters.country;
    else if (path.indexOf("/") < 0 && ["phim-le", "phim-bo"].indexOf(path) < 0) {
        var countrySlugs = ["au-my", "anh", "trung-quoc", "viet-nam", "phap", "hong-kong", "han-quoc", "nhat-ban",
            "thai-lan", "dai-loan", "nga", "an-do", "indonesia", "philippines", "duc", "y", "tay-ban-nha", "canada",
            "uc", "quoc-gia-khac"];
        path = (countrySlugs.indexOf(path) >= 0 ? "quoc-gia/" : "the-loai/") + path;
    }

    var url = BASE + "/" + path;
    if (page > 1) url += "?page=" + page;
    return url;
}

function getUrlSearch(keyword, filtersJson) {
    var filters = {};
    try { filters = JSON.parse(filtersJson || "{}"); } catch (e) {}
    var page = parseInt(filters.page || 1, 10) || 1;
    var url = BASE + "/tim-kiem?q=" + encodeURIComponent(keyword || "");
    if (page > 1) url += "&page=" + page;
    return url;
}

// slug phim -> trang chi tiết ; link đầy đủ (episode.id) -> giữ nguyên
function getUrlDetail(slug, datasend) {
    if (!slug) return BASE;
    if (/^https?:\/\//i.test(slug)) return slug;
    return BASE + "/phim/" + slug;
}

function getUrlCategories() { return BASE + "/menu"; }
function getUrlCountries() { return BASE + "/menu"; }
function getUrlYears() { return BASE + "/"; }

// =============================================================================
// HELPERS
// =============================================================================

function decodeEntities(s) {
    return (s || "")
        .replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#x27;/g, "'")
        .replace(/&#39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
        .replace(/&nbsp;/g, " ");
}

function stripTags(s) {
    return decodeEntities((s || "").replace(/<!--.*?-->/g, "").replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
}

// Ảnh trên web đi qua wsrv.nl?url=<ảnh gốc> -> lấy ảnh gốc
function fixImage(u) {
    if (!u) return "";
    u = decodeEntities(u).trim();
    var m = u.match(/[?&]url=([^&\s]+)/);
    if (m) {
        try { u = decodeURIComponent(m[1]); } catch (e) { u = m[1]; }
    }
    if (u.indexOf("//") === 0) u = "https:" + u;
    return u;
}

function slugFromUrl(u) {
    var m = (u || "").match(/\/phim\/([^\/?#"']+)/);
    return m ? m[1] : "";
}

function firstImage(chunk) {
    var m = chunk.match(/<img[^>]*?\ssrcset="([^"\s,]+)/);
    if (m) return fixImage(m[1]);
    m = chunk.match(/<img[^>]*?\s(?:data-src|src)="([^"]+)"/);
    return m ? fixImage(m[1]) : "";
}

// =============================================================================
// PARSE LIST / SEARCH
// =============================================================================

function parseListResponse(html, apiUrl) {
    try {
        html = html || "";
        var movies = [];
        var seen = {};
        var re = /<a[^>]*class="v-thumbnail"[^>]*href="([^"]+)"[^>]*>|<a[^>]*href="([^"]+)"[^>]*class="v-thumbnail"[^>]*>/g;
        var starts = [];
        var m;
        while ((m = re.exec(html)) !== null) {
            starts.push({ idx: m.index, href: m[1] || m[2] });
        }
        for (var i = 0; i < starts.length; i++) {
            var end = (i + 1 < starts.length) ? starts[i + 1].idx : Math.min(html.length, starts[i].idx + 6000);
            var chunk = html.substring(starts[i].idx, end);
            var slug = slugFromUrl(starts[i].href);
            if (!slug || seen[slug]) continue;
            seen[slug] = true;

            var title = "";
            var t = chunk.match(/class="item-title[^"]*"[^>]*>\s*<a[^>]*title="([^"]*)"/);
            if (t) title = decodeEntities(t[1]);
            if (!title) {
                t = chunk.match(/<img[^>]*alt="([^"]*)"/);
                if (t) title = decodeEntities(t[1]);
            }
            if (!title) title = slug;

            var origin = "";
            t = chunk.match(/class="alias-title[^"]*"[^>]*>\s*<a[^>]*title="([^"]*)"/);
            if (t) origin = decodeEntities(t[1]);

            var badges = [];
            if (/thumb-4k-badge/.test(chunk)) badges.push("4K");
            t = chunk.match(/class="pin-new[^"]*"[^>]*>([^<]+)</);
            if (t && stripTags(t[1])) badges.push(stripTags(t[1]));
            t = chunk.match(/class="thumb-bilingual-badge"[^>]*>([^<]+)</);
            if (t) badges.push(stripTags(t[1]));

            movies.push({
                id: slug,
                title: title,
                originName: origin,
                posterUrl: firstImage(chunk),
                quality: badges.join(" · "),
                slug: slug
            });
        }

        var totalPages = 1;
        var pm = html.match(/<input[^>]*\smax="(\d+)"[^>]*type="number"|<input[^>]*type="number"[^>]*\smax="(\d+)"/);
        if (pm) totalPages = parseInt(pm[1] || pm[2], 10) || 1;
        var cur = 1;
        var cm = (apiUrl || "").match(/[?&]page=(\d+)/);
        if (cm) cur = parseInt(cm[1], 10) || 1;
        if (movies.length > 0 && totalPages < cur) totalPages = cur;

        return JSON.stringify({
            items: movies,
            pagination: { currentPage: cur, totalPages: totalPages, totalItems: movies.length, itemsPerPage: movies.length || 32 }
        });
    } catch (e) {
        console.log("parseListResponse error: " + e);
        return JSON.stringify({ items: [], pagination: { currentPage: 1, totalPages: 1, totalItems: 0, itemsPerPage: 0 } });
    }
}

function parseSearchResponse(html, apiUrl) {
    return parseListResponse(html, apiUrl);
}

// =============================================================================
// PARSE DETAIL
// =============================================================================

function collectLinks(html, kind, limit) {
    var re = new RegExp('<a[^>]*href="(?:https://cobephim\\.ink)?/' + kind + '/[^"]*"[^>]*>(.*?)</a>', "g");
    var out = [], seen = {}, m;
    while ((m = re.exec(html)) !== null) {
        var n = stripTags(m[1]).replace(/^[,\s]+|[,\s]+$/g, "");
        if (n && !seen[n]) { seen[n] = true; out.push(n); }
        if (limit && out.length >= limit) break;
    }
    return out;
}

// Lấy danh sách các bản chiếu / tập từ trang xem phim
function parseEpisodeItems(html, slug) {
    var eps = [];
    var seen = {};
    var re = /<a[^>]*href="((?:https:\/\/cobephim\.ink)?\/phim\/[^"\/]+\/tap-[^"#?]+)"[^>]*>([\s\S]*?)<\/a>/g;
    var m;
    while ((m = re.exec(html)) !== null) {
        var href = m[1];
        if (/tap-latest$/.test(href)) continue;
        if (href.indexOf("/phim/" + slug + "/") < 0) continue;
        if (seen[href]) continue;
        var inner = m[2];
        // chỉ lấy item trong danh sách tập (class="item ...")
        var tag = m[0].substring(0, m[0].indexOf(">") + 1);
        if (!/class="[^"]*\bitem\b/.test(tag)) continue;
        seen[href] = true;
        var name = "";
        var es = inner.match(/class="ep-sort[^"]*"[^>]*>([^<]+)</);
        if (es) name = stripTags(es[1]);
        var v = inner.match(/class="ver[^"]*"[\s\S]*?<span[^>]*>([^<]+)<\/span>/);
        if (!name && v) name = stripTags(v[1]);
        if (!name) {
            var tt = inner.match(/class="(?:ep-name|name|title|media-title)[^"]*"[^>]*>([\s\S]*?)<\/div>/);
            if (tt) name = stripTags(tt[1]);
        }
        if (!name) name = stripTags(inner);
        if (!name) name = href.replace(/.*\/tap-/, "Tập ");
        if (name.length > 40) name = name.substring(0, 40);
        eps.push({ name: name, href: href.indexOf("http") === 0 ? href : BASE + href });
    }
    return eps;
}


// Lấy danh sách tập từ các API cùng nguồn phát (KKPhim, NguonC)
function fetchServersFromApis(slug) {
    var out = [];
    try {
        var r1 = httpRequest("https://phimapi.com/phim/" + slug, { method: "GET", headers: { "User-Agent": UA } });
        console.log("phimapi status=" + (r1 && r1.status));
        var j1 = JSON.parse((r1 && r1.body) || "{}");
        out = buildServers(j1.episodes || [], "KKPhim");
    } catch (e1) { console.log("phimapi error: " + e1); }
    if (out.length === 0) {
        try {
            var r2 = httpRequest("https://phim.nguonc.com/api/film/" + slug, { method: "GET", headers: { "User-Agent": UA } });
            console.log("nguonc status=" + (r2 && r2.status));
            var j2 = JSON.parse((r2 && r2.body) || "{}");
            var mv = j2.movie || (j2.data && (j2.data.item || j2.data)) || {};
            out = buildServers(mv.episodes || j2.episodes || [], "NguonC");
        } catch (e2) { console.log("nguonc error: " + e2); }
    }
    console.log("api servers=" + out.length);
    return out;
}

function buildServers(list, tag) {
    var out = [];
    if (!list || !list.length) return out;
    for (var si = 0; si < list.length; si++) {
        var sd = list[si].server_data || list[si].items || [];
        var eps = [];
        for (var ei = 0; ei < sd.length; ei++) {
            var u = sd[ei].link_m3u8 || sd[ei].m3u8 || sd[ei].link_embed || sd[ei].embed;
            if (!u) continue;
            eps.push({
                name: sd[ei].name || sd[ei].episode_name || ("Tập " + (ei + 1)),
                slug: (sd[ei].slug || ("tap-" + (ei + 1))) + "-" + tag.toLowerCase() + si,
                id: u
            });
        }
        if (eps.length > 0) {
            var nm = String(list[si].server_name || list[si].name || ("Server " + (si + 1))).replace(/^\s*#\s*/, "");
            out.push({ name: nm + " (" + tag + ")", episodes: eps });
        }
    }
    return out;
}

function parseMovieDetail(html, apiUrl, datasend) {
    try {
        html = html || "";
        var slug = slugFromUrl(apiUrl) || slugFromUrl(html.match(/<link[^>]*rel="canonical"[^>]*href="([^"]+)"/) ? RegExp.$1 : "");

        var ld = null;
        var lm = html.match(/<script type="application\/ld\+json">([\s\S]*?"@type":"Movie"[\s\S]*?)<\/script>/);
        if (lm) { try { ld = JSON.parse(lm[1]); } catch (e) {} }

        var title = "";
        var t = html.match(/<h1[^>]*class="[^"]*media-name[^"]*"[^>]*>([\s\S]*?)<\/h1>/);
        if (t) title = stripTags(t[1]);
        if (!title && ld && ld.name) title = ld.name;
        if (!title) { t = html.match(/<title>([^<]*)<\/title>/); title = t ? stripTags(t[1]) : slug; }

        var origin = "";
        t = html.match(/class="alias-name"[^>]*>([\s\S]*?)<\/div>/);
        if (t) origin = stripTags(t[1]);

        var poster = "";
        t = html.match(/<meta[^>]*property="og:image"[^>]*content="([^"]+)"/);
        if (t) poster = fixImage(t[1]);
        if (!poster && ld && ld.image) poster = fixImage(typeof ld.image === "string" ? ld.image : ld.image.url);

        var desc = "";
        if (ld && ld.description) desc = ld.description;
        if (!desc) { t = html.match(/<meta[^>]*name="description"[^>]*content="([^"]*)"/); if (t) desc = decodeEntities(t[1]); }

        var year = "";
        t = html.match(/class="tag-classic"[^>]*>\s*<span[^>]*>(\d{4})</);
        if (t) year = t[1];
        var quality = "";
        t = html.match(/class="tag-quality"[^>]*>\s*<span[^>]*>([^<]+)</);
        if (t) quality = stripTags(t[1]);

        var categories = collectLinks(html, "the-loai", 10);
        var countries = collectLinks(html, "quoc-gia", 3);
        var actors = collectLinks(html, "dien-vien", 15);
        var directors = collectLinks(html, "dao-dien", 3);

        // Danh sách tập: ưu tiên đọc ngay trên trang chi tiết, nếu không có thì lấy từ trang xem phim (tap-latest)
        var episodes = [];
        var watchUrl = BASE + "/phim/" + slug + "/tap-latest";
        var addEps = function (items) {
            for (var i = 0; i < items.length; i++) {
                episodes.push({
                    name: items[i].name,
                    slug: items[i].href.replace(/.*\/phim\//, "").replace(/\//g, "-"),
                    id: items[i].href
                });
            }
        };
        addEps(parseEpisodeItems(html, slug));
        console.log("Episodes on detail page: " + episodes.length);
        if (episodes.length === 0) {
            try {
                var res = httpRequest(watchUrl, { method: "GET", headers: { "User-Agent": UA, "Referer": BASE + "/" } });
                if (res && res.body) addEps(parseEpisodeItems(res.body, slug));
                console.log("Episodes on watch page: " + episodes.length + " status=" + (res && res.status));
            } catch (e) {
                console.log("httpRequest watch page error: " + e);
            }
        }
        var servers = [];
        if (episodes.length > 0) {
            servers.push({ name: "CôBe Phim", episodes: episodes });
        } else {
            // Danh sách tập trên cobephim được tải bằng JS (HTML gốc không có) -> thử lần lượt API KKPhim, rồi NguonC
            servers = fetchServersFromApis(slug);
            if (servers.length === 0) {
                servers.push({ name: "CôBe Phim", episodes: [{ name: "Full", slug: slug + "-full", id: watchUrl }] });
            }
        }

        return JSON.stringify({
            id: slug,
            title: title,
            originName: origin,
            posterUrl: poster,
            backdropUrl: poster,
            description: desc,
            year: year,
            quality: quality,
            category: categories.join(", "),
            country: countries.join(", "),
            casts: actors.join(", "),
            director: directors.join(", "),
            servers: servers
        });
    } catch (e) {
        console.log("parseMovieDetail error: " + e);
        return "{}";
    }
}

// =============================================================================
// PARSE STREAM (trang xem phim -> m3u8)
// =============================================================================

var WORKING_HEADERS = null;

function pickVariant(masterUrl) {
    try {
        var sets = [
            { "User-Agent": UA, "Referer": BASE + "/", "Origin": BASE },
            { "User-Agent": UA },
            { "User-Agent": UA, "Referer": BASE + "/" }
        ];
        var res = null, body = "";
        for (var k = 0; k < sets.length; k++) {
            try { res = httpRequest(masterUrl, { method: "GET", headers: sets[k] }); } catch (e1) { res = null; }
            body = (res && res.body) || "";
            console.log("try headers#" + k + " status=" + (res && res.status) + " len=" + body.length);
            if (res && res.status === 200 && body.indexOf("#EXTM3U") >= 0) { WORKING_HEADERS = sets[k]; break; }
            body = "";
        }
        console.log(body.substring(0, 600));
        if (body.indexOf("#EXT-X-STREAM-INF") < 0) return masterUrl;
        var lines = body.split(/\r?\n/), best = null;
        for (var i = 0; i < lines.length; i++) {
            if (lines[i].indexOf("#EXT-X-STREAM-INF") !== 0) continue;
            var uri = ""; 
            for (var j = i + 1; j < lines.length; j++) { if (lines[j] && lines[j].charAt(0) !== "#") { uri = lines[j].trim(); break; } }
            if (!uri) continue;
            var h = 0, bw = 0, codec = "";
            var rm = lines[i].match(/RESOLUTION=(\d+)x(\d+)/); if (rm) h = parseInt(rm[2], 10);
            var bm = lines[i].match(/BANDWIDTH=(\d+)/); if (bm) bw = parseInt(bm[1], 10);
            var cm = lines[i].match(/CODECS="([^"]*)"/); if (cm) codec = cm[1];
            if (/hvc1|hev1|av01|dvh1/i.test(codec)) continue; // tránh HEVC/AV1 -> dễ đen màn hình
            if (h > 1080) continue;
            if (!best || h > best.h || (h === best.h && bw > best.bw)) best = { uri: uri, h: h, bw: bw };
        }
        if (!best) return masterUrl;
        var abs = best.uri;
        if (abs.indexOf("http") !== 0) {
            if (abs.charAt(0) === "/") abs = masterUrl.replace(/^(https?:\/\/[^\/]+).*/, "$1") + abs;
            else abs = masterUrl.replace(/[^\/]*(\?.*)?$/, "") + abs;
        }
        console.log("picked " + best.h + "p -> " + abs);
        return abs;
    } catch (e) { console.log("pickVariant error: " + e); return masterUrl; }
}

function parseDetailResponse(html, apiUrl, datasend) {
    try {
        html = html || "";
        var link = "", type = "";

        // Episode id là link m3u8/mp4 trực tiếp (lấy từ API) -> phát luôn
        var direct = (apiUrl || "").split("|")[0];
        if (/^https?:\/\/.+\.(m3u8|mp4)(\?.*)?$/i.test(direct)) {
            var dh = { "User-Agent": UA };
            var dl = /\.m3u8/i.test(direct) ? pickVariant(direct) : direct;
            if (WORKING_HEADERS) dh = WORKING_HEADERS;
            return JSON.stringify({ url: dl, isEmbed: false, headers: dh, subtitles: [] });
        }

        // 1) RSC payload: \"episode\":{...\"type\":\"m3u8\",\"link\":\"https://...\"}
        var m = html.match(/\\"type\\":\\"(\w+)\\",\\"link\\":\\"(https?:[^"\\]+)\\"/);
        if (m) { type = m[1]; link = m[2]; }
        if (!link) {
            m = html.match(/"type":"(\w+)","link":"(https?:[^"\\]+)"/);
            if (m) { type = m[1]; link = m[2]; }
        }
        if (!link) {
            // dạng khác: \"link\":\"...\" ở bất kỳ vị trí nào, chỉ nhận link không phải css/js
            var all = html.match(/\\"link\\":\\"(https?:[^"\\]+)\\"/g) || [];
            for (var q = 0; q < all.length; q++) {
                var lk = all[q].match(/\\"link\\":\\"(https?:[^"\\]+)\\"/)[1];
                if (/\.(css|js|png|jpg|webp|svg|ico)(\?|$)/i.test(lk)) continue;
                link = lk;
                var tm = html.substring(Math.max(0, html.indexOf(all[q]) - 200), html.indexOf(all[q])).match(/\\"type\\":\\"(\w+)\\"[^]*$/);
                type = tm ? tm[1] : (/\.m3u8/i.test(lk) ? "m3u8" : "embed");
                break;
            }
        }
        // 2) Bất kỳ m3u8 nào trong trang
        if (!link) {
            m = html.replace(/\\\//g, "/").match(/(https?:\/\/[^"'\\\s<>]+\.m3u8[^"'\\\s<>]*)/);
            if (m) { link = m[1]; type = "m3u8"; }
        }
        // 3) iframe embed (nếu nguồn không phải m3u8)
        if (!link) {
            m = html.match(/<iframe[^>]*id="embed-player"[^>]*\ssrc="(https?:[^"]+)"/);
            if (m) { link = decodeEntities(m[1]); type = "embed"; }
        }

        console.log("link=" + link + " type=" + type);
        if (!link) return "{}";
        link = link.replace(/\\u0026/g, "&").replace(/\\\//g, "/");

        var headers = { "User-Agent": UA, "Referer": BASE + "/", "Origin": BASE };
        if (/streamc/i.test(apiUrl || "")) headers = { "User-Agent": UA, "Referer": "https://embed.streamc.xyz/" };

        if (type === "embed" || (!/\.m3u8|\.mp4/i.test(link) && type !== "m3u8")) {
            return JSON.stringify({ url: link, isEmbed: true, headers: headers, subtitles: [] });
        }
        if (/\.m3u8/i.test(link)) { link = pickVariant(link); if (WORKING_HEADERS) headers = WORKING_HEADERS; }
        return JSON.stringify({ url: link, isEmbed: false, headers: headers, subtitles: [] });
    } catch (e) {
        console.log("parseDetailResponse error: " + e);
        return "{}";
    }
}

function parseEmbedResponse(html, sourceUrl) {
    try {
        var m = (html || "").replace(/\\\//g, "/").match(/(https?:\/\/[^"'\\\s<>]+\.(?:m3u8|mp4)[^"'\\\s<>]*)/);
        if (!m) return "{}";
        return JSON.stringify({
            url: m[1],
            isEmbed: false,
            headers: { "User-Agent": UA, "Referer": BASE + "/", "Origin": BASE }
        });
    } catch (e) { return "{}"; }
}

// =============================================================================
// THỂ LOẠI / QUỐC GIA / NĂM (khai báo sẵn)
// =============================================================================

function parseMenuLinks(html, kind) {
    var re = new RegExp('<a[^>]*href="(?:https://cobephim\\.ink)?/' + kind + '/([^"/?#]+)"[^>]*>([\\s\\S]*?)</a>', "g");
    var out = [], seen = {}, m;
    while ((m = re.exec(html || "")) !== null) {
        var n = stripTags(m[2]);
        if (n && !seen[m[1]]) { seen[m[1]] = true; out.push({ name: n, slug: m[1] }); }
    }
    return out;
}

function parseCategoriesResponse(html) {
    var real = parseMenuLinks(html, "the-loai");
    if (real.length > 0) return JSON.stringify(real);
    return JSON.stringify([
        { name: "Hành Động", slug: "hanh-dong" },
        { name: "Tình Cảm", slug: "tinh-cam" },
        { name: "Hài Hước", slug: "hai-huoc" },
        { name: "Cổ Trang", slug: "co-trang" },
        { name: "Tâm Lý", slug: "tam-ly" },
        { name: "Hình Sự", slug: "hinh-su" },
        { name: "Chiến Tranh", slug: "chien-tranh" },
        { name: "Thể Thao", slug: "the-thao" },
        { name: "Võ Thuật", slug: "vo-thuat" },
        { name: "Viễn Tưởng", slug: "vien-tuong" },
        { name: "Phiêu Lưu", slug: "phieu-luu" },
        { name: "Khoa Học", slug: "khoa-hoc" },
        { name: "Kinh Dị", slug: "kinh-di" },
        { name: "Âm Nhạc", slug: "am-nhac" },
        { name: "Thần Thoại", slug: "than-thoai" },
        { name: "Tài Liệu", slug: "tai-lieu" },
        { name: "Gia Đình", slug: "gia-dinh" },
        { name: "Chính Kịch", slug: "chinh-kich" },
        { name: "Bí Ẩn", slug: "bi-an" },
        { name: "Học Đường", slug: "hoc-duong" },
        { name: "Chiếu rạp", slug: "chieu-rap" },
        { name: "Hoạt Hình", slug: "hoat-hinh" }
    ]);
}

function parseCountriesResponse(html) {
    var real = parseMenuLinks(html, "quoc-gia");
    if (real.length > 0) return JSON.stringify(real);
    return JSON.stringify([
        { name: "Âu Mỹ", slug: "au-my" },
        { name: "Hàn Quốc", slug: "han-quoc" },
        { name: "Trung Quốc", slug: "trung-quoc" },
        { name: "Nhật Bản", slug: "nhat-ban" },
        { name: "Thái Lan", slug: "thai-lan" },
        { name: "Việt Nam", slug: "viet-nam" },
        { name: "Ấn Độ", slug: "an-do" },
        { name: "Hồng Kông", slug: "hong-kong" },
        { name: "Đài Loan", slug: "dai-loan" },
        { name: "Pháp", slug: "phap" },
        { name: "Anh", slug: "anh" }
    ]);
}

function parseYearsResponse(html) {
    return JSON.stringify([]);
}
