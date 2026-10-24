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
