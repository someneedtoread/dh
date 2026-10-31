// Донхуа: пункт бокового меню Lampa, каталог китайской анимации (TMDB: жанр 16, язык zh).
// Устроен как встроенное «Аниме»: Router 'category' со своим источником, полки грузятся пачками при прокрутке.
(function () {
    'use strict';
    if (window.plugin_donghua_ready) return;
    window.plugin_donghua_ready = true;

    var BASE = 'with_original_language=zh&with_genres=16';
    var year = new Date().getFullYear();
    var today = year + '-' + ('0' + (new Date().getMonth() + 1)).slice(-2) + '-' + ('0' + new Date().getDate()).slice(-2);
    var fresh = (year - 1) + '-01-01';

    function shelves() {
        return [
            {title: 'Популярные сериалы', url: 'discover/tv?' + BASE + '&sort_by=popularity.desc'},
            {title: 'Популярные фильмы', url: 'discover/movie?' + BASE + '&sort_by=popularity.desc'},
            {title: 'Новые сериалы', url: 'discover/tv?' + BASE + '&first_air_date.gte=' + fresh + '&first_air_date.lte=' + today + '&sort_by=first_air_date.desc&vote_count.gte=1'},
            {title: 'Новые фильмы', url: 'discover/movie?' + BASE + '&primary_release_date.gte=' + fresh + '&primary_release_date.lte=' + today + '&sort_by=primary_release_date.desc&vote_count.gte=1'},
            {title: 'Сериалы с высоким рейтингом', url: 'discover/tv?' + BASE + '&sort_by=vote_average.desc&vote_count.gte=100'},
            {title: 'Фильмы с высоким рейтингом', url: 'discover/movie?' + BASE + '&sort_by=vote_average.desc&vote_count.gte=100'}
        ];
    }

    function tmdb() { return Lampa.Api.sources.tmdb; }

    function part(shelf) {
        return function (call) {
            tmdb().list({url: shelf.url, page: 1}, function (json) {
                json.title = shelf.title;
                json.url = shelf.url;
                json.source = 'tmdb';
                call(json);
            }, function () { call(); });
        };
    }

    function Source() {
        var t = tmdb();
        for (var k in t) if (Object.prototype.hasOwnProperty.call(t, k)) this[k] = t[k];

        this.category = function (params, oncomplite, onerror) {
            var parts = shelves().map(part);
            function load(ok, fail) { Lampa.Api.partNext(parts, 3, ok, fail); }
            load(oncomplite, onerror);
            return load;
        };
    }

    function open() {
        Lampa.Activity.push({
            url: '',
            title: 'Донхуа',
            component: 'category',
            source: 'donghua',
            page: 1
        });
    }

    // Меню Lampa собирается уже после события ready, поэтому ждём пункт «Аниме» и ставим свой рядом.
    function addMenu() {
        var anime = $('[data-action="anime"]');
        if (!anime.length || $('[data-donghua]').length) return;
        var btn = anime.first().clone();
        btn.removeAttr('data-action').attr('data-donghua', '1');
        btn.find('.menu__text').text('Донхуа');
        btn.on('hover:enter', open);
        // Меню Lampa переставляет пункты по списку menu_sort: новое имя уходит в конец. Ставим его в списке сразу после «Аниме».
        var sort = Lampa.Storage.get('menu_sort', '[]');
        var name = 'Донхуа';
        var base = anime.first().find('.menu__text').text().trim();
        sort = sort.filter(function (n) { return n !== name; });
        var at = sort.indexOf(base);
        if (at >= 0) sort.splice(at + 1, 0, name); else sort.push(name);
        Lampa.Storage.set('menu_sort', sort);
        btn.insertAfter(anime.first());
        if (Lampa.Noty) Lampa.Noty.show('Донхуа: пункт меню добавлен');
    }

    function start() {
        Lampa.Api.sources.donghua = new Source();
        setInterval(addMenu, 1000);
    }

    if (window.appready) start();
    else Lampa.Listener.follow('app', function (e) { if (e.type == 'ready') start(); });
})();

// Без рекламы перед фильмом. Lampa показывает её чужим плеером (VASTPlayer из vast.js или Google IMA) и грузит его,
// только если его ещё нет на странице. Ставим заглушки, которые сразу падают: на ошибку Lampa сама переходит к фильму
// (остаётся заставка «Реклама» на ~4 с). Проверку Premium подменить нельзя: Account.hasPremium защищён от записи.
// Зачем: реклама и фильм на миг делят единственный видеодекодер телевизора, от этого копится утечка и видео встаёт.
(function () {
    'use strict';
    // Отключено 31.10.2026 по просьбе Тимура (откат после поломки видео): чтобы включить обратно, убрать следующую строку.
    return;
    if (window.plugin_noads_ready) return;
    window.plugin_noads_ready = true;

    function blocked() { throw new Error('ads off'); }

    function lock(target, name, value) {
        try {
            Object.defineProperty(target, name, { value: value, writable: false, configurable: false });
        } catch (e) {}
    }

    lock(window, 'VASTPlayer', blocked);
    if (!window.google) window.google = {};
    lock(window.google, 'ima', { AdDisplayContainer: blocked, AdsLoader: blocked, AdsRequest: blocked });
})();

// Постеры TMDB. Свои зеркала Lampa (imagetmdb.com и поддомены) с 30.10.2026 ведут на парковку доменов,
// image.tmdb.org домашний DNS отдаёт как 127.0.0.1, imagetmdb.cub.red не резолвится. Картинки берём через wsrv.nl
// по протоколу страницы: Lampa открыта по http, а https к Cloudflare с телевизора рвётся (по http картинка приходит целиком).
// Свойство закрыто от записи: Lampa ставит своё TMDB.image при старте, порядок загрузки плагина не важен.
(function () {
    'use strict';
    if (window.plugin_tmdbimg_ready) return;
    window.plugin_tmdbimg_ready = true;

    function image(url) {
        url = String(url || '').replace(/^\/+/, '').replace(/\/+/g, '/');
        return (location.protocol == 'https:' ? 'https' : 'http') + '://wsrv.nl/?url=' + encodeURIComponent('image.tmdb.org/' + url);
    }

    function install() {
        if (!window.Lampa || !Lampa.TMDB) return false;
        try {
            Object.defineProperty(Lampa.TMDB, 'image', { get: function () { return image; }, set: function () {}, configurable: false });
        } catch (e) {}
        return true;
    }

    if (!install()) var timer = setInterval(function () { if (install()) clearInterval(timer); }, 200);
})();
