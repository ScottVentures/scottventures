jQuery( document ).ready(function( $ ) {


	"use strict";


        // Page loading animation

        $("#preloader").animate({
            'opacity': '0'
        }, 600, function(){
            setTimeout(function(){
                $("#preloader").css("visibility", "hidden").fadeOut();
            }, 300);
        });
        

        $(window).scroll(function() {
          var scroll = $(window).scrollTop();
          var box = $('.header-text').height();
          var header = $('header').height();

          if (scroll >= box - header) {
            $("header").addClass("background-header");
          } else {
            $("header").removeClass("background-header");
          }
        });
        if ($('.owl-clients').length) {
            $('.owl-clients').owlCarousel({
                loop: true,
                nav: false,
                dots: true,
                items: 1,
                margin: 30,
                autoplay: true,
                autoplayTimeout: 4000,
                autoplayHoverPause: true,
                smartSpeed: 700,
                responsive: {
                    0: {
                        items: 1,
                        margin: 0
                    },
                    460: {
                        items: 1,
                        margin: 0
                    },
                    576: {
                        items: 3,
                        margin: 20
                    },
                    992: {
                        items: 5,
                        margin: 30
                    }
                }
            });
        }
		if ($('.owl-testimonials').length) {
            $('.owl-testimonials').owlCarousel({
                loop: true,
                nav: false,
                dots: true,
                items: 1,
                margin: 30,
                autoplay: true,
                autoplayTimeout: 5000,
                autoplayHoverPause: true,
                smartSpeed: 700,
                responsive: {
                    0: {
                        items: 1,
                        margin: 0
                    },
                    460: {
                        items: 1,
                        margin: 0
                    },
                    576: {
                        items: 2,
                        margin: 20
                    },
                    992: {
                        items: 2,
                        margin: 30
                    }
                }
            });
        }
        if ($('.owl-banner').length) {
            var $bannerCarousel = $('.owl-banner');
            $bannerCarousel.owlCarousel({
                loop: true,
                nav: false,
                dots: true,
                items: 1,
                margin: 0,
                autoplay: true,
                autoplayTimeout: 6000,
                autoplayHoverPause: true,
                smartSpeed: 900,
                responsive: {
                    0: {
                        items: 1,
                        margin: 0
                    },
                    460: {
                        items: 1,
                        margin: 0
                    },
                    576: {
                        items: 1,
                        margin: 20
                    },
                    992: {
                        items: 1,
                        margin: 30
                    }
                }
            });

            // Video slides: a slide can carry a <video class="banner-video">
            // instead of (or in front of) a background image — see
            // index.html's "banner-item-video" example. Rather than the
            // slideshow's own timer cutting the clip off mid-play, landing
            // on that slide pauses the automatic rotation, plays the video
            // muted (autoplay requires that), and only once the clip
            // actually finishes does the slideshow move on and resume its
            // normal timed loop.
            //
            // Two things this has to work around, both specific to loop
            // mode: (1) 'translated.owl.carousel' (which fires once a
            // transition visually finishes) turned out to fire
            // inconsistently once the fade animation above is combined
            // with loop mode and a jump of more than one slide — some
            // transitions never fired it at all — so this listens on the
            // reliable 'changed.owl.carousel' instead. (2) for an
            // infinite loop, Owl clones slides at both ends of the stage
            // so it can scroll "past the end" seamlessly, which means the
            // element actually on screen for a given slide is sometimes a
            // *clone* of it, not the original — so this always acts on
            // whichever DOM node is actually marked active, never on "the"
            // video slide by index, or it can end up playing an
            // off-screen original while a paused clone sits on screen.
            // 'changed' fires just before Owl finishes updating which
            // item carries the active class, so the lookup is deferred
            // one tick (a plain setTimeout, confirmed by hand to always
            // be enough here) rather than done in the same tick.
            $bannerCarousel.on('changed.owl.carousel', function (e) {
                if (!e.namespace || e.property.name !== 'position') return;
                setTimeout(function () {
                    var $activeVideo = $bannerCarousel.find('.owl-item.active .banner-video');

                    // Stop + rewind every video that isn't the one now on
                    // screen, so switching away (by dot, swipe, or the
                    // timer) never leaves a clip running silently behind
                    // the scenes.
                    $bannerCarousel.find('.banner-video').not($activeVideo).each(function () {
                        this.pause();
                        try { this.currentTime = 0; } catch (err) { /* not loaded yet */ }
                    });

                    if ($activeVideo.length) {
                        $bannerCarousel.trigger('stop.owl.autoplay');
                        var videoEl = $activeVideo[0];
                        var playPromise = videoEl.play();
                        if (playPromise && typeof playPromise.catch === 'function') {
                            playPromise.catch(function () {
                                // Autoplay was blocked, or there's no video
                                // file there yet (a 404 on the <source>,
                                // e.g. before the real clip is uploaded) —
                                // don't leave the slideshow stuck waiting
                                // for an 'ended' event that will never
                                // come. The poster frame just sits there
                                // instead and the loop carries on.
                                $bannerCarousel.trigger('play.owl.autoplay');
                            });
                        }

                        // Safety net: a missing/undecodable source can, in
                        // some browsers, resolve to NETWORK_NO_SOURCE
                        // without ever firing 'error', 'loadstart', or
                        // settling the play() promise above — nothing to
                        // hook into at all. Without this, that leaves the
                        // whole homepage hero frozen on a dead slide
                        // forever the moment the video file is missing,
                        // slow, or blocked. So a few seconds after landing
                        // here, check whether the clip actually started
                        // (readyState/currentTime moved) and if not, treat
                        // it exactly like a failed slide: force the
                        // carousel onward and resume the normal loop. A
                        // real, healthy clip is unaffected — this timer is
                        // a no-op once playback has actually begun, and is
                        // cleared the moment we leave this slide for any
                        // other reason ('ended', a swipe, a dot click).
                        // Note: videoEl.paused is NOT useful here — the
                        // spec has play() flip it to false synchronously
                        // the moment it's called, whether or not the clip
                        // ever actually produces a frame. currentTime is
                        // the reliable signal: a clip that's genuinely
                        // playing will have advanced well past 0 within a
                        // few seconds; one that never started (bad source,
                        // stalled, blocked) sits at exactly 0 the whole
                        // time.
                        window.clearTimeout($bannerCarousel.data('svVideoWatchdog'));
                        var watchdogToken = window.setTimeout(function () {
                            var stillOnThisSlide = $bannerCarousel.find('.owl-item.active .banner-video')[0] === videoEl;
                            var neverStarted = videoEl.currentTime === 0 && !videoEl.ended;
                            if (stillOnThisSlide && neverStarted) {
                                $bannerCarousel.owlCarousel('next');
                                $bannerCarousel.trigger('play.owl.autoplay');
                            }
                        }, 4000);
                        $bannerCarousel.data('svVideoWatchdog', watchdogToken);
                    } else {
                        window.clearTimeout($bannerCarousel.data('svVideoWatchdog'));
                        // Landing on any non-video slide always makes sure
                        // autoplay is running — covers leaving a video
                        // slide early (a dot click, a swipe) while it's
                        // still playing, which otherwise never gets an
                        // 'ended' or blocked-play() event to resume it
                        // from. Calling play on an already-running
                        // autoplay is a harmless no-op (it just resets the
                        // interval), so this is safe every time.
                        $bannerCarousel.trigger('play.owl.autoplay');
                    }
                }, 0);
            });
            // 'ended' and 'error' don't bubble on media elements, so these
            // have to be bound directly to each <video> rather than
            // delegated from the carousel the way the click handler below
            // is — delegation would silently never fire.
            $bannerCarousel.find('.banner-video').on('ended', function () {
                window.clearTimeout($bannerCarousel.data('svVideoWatchdog'));
                // The plugin's documented method-call form (rather than
                // guessing at 'next's internal event/namespace) — see
                // sources/js/vision.js's bundled owlCarousel jQuery plugin.
                $bannerCarousel.owlCarousel('next');
                $bannerCarousel.trigger('play.owl.autoplay');
            }).on('error', function () {
                // A video that fails to load entirely (missing file,
                // unsupported codec) gets the same safety net as a
                // blocked play() call above — never leave the slideshow
                // stuck on a dead slide.
                window.clearTimeout($bannerCarousel.data('svVideoWatchdog'));
                $bannerCarousel.trigger('play.owl.autoplay');
            });

            // A slide's own sound toggle (see index.html) — the video
            // plays muted so autoplay is never blocked, but a viewer who
            // wants sound can turn it on for as long as that slide is up.
            $bannerCarousel.on('click', '.banner-sound-toggle', function () {
                var $btn = $(this);
                var video = $btn.closest('.banner-item-video').find('.banner-video')[0];
                if (!video) return;
                video.muted = !video.muted;
                $btn.toggleClass('is-muted', video.muted);
                $btn.find('i').toggleClass('fa-volume-off', video.muted).toggleClass('fa-volume-up', !video.muted);
            });
        }

        // The "All Articles / Featured" filter on the Articles and
        // Learning Materials pages used to run through Isotope's JS
        // masonry engine, which measures card widths after the page
        // loads and lays cards out with computed inline positions.
        // That measurement raced with web fonts, the AdSense script,
        // and each card's own image loading, so it regularly settled
        // on the wrong column count (2-per-row instead of 3) until a
        // resize forced a re-layout. The column count is now a plain
        // CSS grid (see .filters-content .row.grid in articles.css),
        // so it's correct on first paint with nothing to race. This
        // just needs to show/hide cards for the filter buttons.
        $('.filters ul li').click(function(){
          $('.filters ul li').removeClass('active');
          $(this).addClass('active');
          var data = $(this).attr('data-filter');
          var $items = $('.filters-content .row.grid > .all');
          if (!data || data === '*') {
            $items.removeClass('is-hidden');
          } else {
            var cls = data.replace('.', '');
            $items.each(function () {
              $(this).toggleClass('is-hidden', !$(this).hasClass(cls));
            });
          }
        });
        $('.accordion > li:eq(0) a').addClass('active').next().slideDown();

        $('.accordion a').click(function(j) {
            var dropDown = $(this).closest('li').find('.content');

            $(this).closest('.accordion').find('.content').not(dropDown).slideUp();

            if ($(this).hasClass('active')) {
                $(this).removeClass('active');
            } else {
                $(this).closest('.accordion').find('a.active').removeClass('active');
                $(this).addClass('active');
            }

            dropDown.stop(false, true).slideToggle();

            j.preventDefault();
        });
 
});
