function skinChanger() {
    $(".right-sidebar .choose-skin li").on("click", function() {
        var a = $("body"),
            b = $(this),
            c = $(".right-sidebar .choose-skin li.active").data("theme");
        $(".right-sidebar .choose-skin li").removeClass("active"), a.removeClass("theme-" + c), b.addClass("active"), a.addClass("theme-" + b.data("theme"))
    }), $(".right-sidebar .bg_color li").on("click", function() {
        var a = $("body"),
            b = $(this),
            c = $(".right-sidebar .bg_color li.active").data("bbg");
        $(".right-sidebar .bg_color li").removeClass("active"), a.removeClass("bbg-" + c), b.addClass("active"), a.addClass("bbg-" + b.data("bbg"))
    })
}

function CustomScrollbar() {
    $.getScript('https://cdnjs.cloudflare.com/ajax/libs/jQuery-slimScroll/1.3.8/jquery.slimscroll.min.js', function()
    {
        $(".sidebar .menu .list").slimscroll({
            height: "calc(100vh - 65px)",
            color: "#eeeeee",
            position: "right",
            size: "1px",
            alwaysVisible: !1,
            borderRadius: "3px",
            railBorderRadius: "0"
        }), $(".navbar-right .dropdown-menu .body").slimscroll({
            height: "330px",
            color: "rgba(0,0,0,0.2)",
            size: "3px",
            alwaysVisible: !1,
            borderRadius: "3px",
            railBorderRadius: "0"
        }), $(".chat-widget").slimscroll({
            height: "310px",
            color: "rgba(0,0,0,0.4)",
            size: "2px",
            alwaysVisible: !1,
            borderRadius: "3px",
            railBorderRadius: "2px"
        }), $(".right-sidebar .slim_scroll").slimscroll({
            height: "calc(100vh - 70px)",
            color: "rgba(0,0,0,0.4)",
            size: "2px",
            alwaysVisible: !1,
            borderRadius: "3px",
            railBorderRadius: "0"
        })
    });
}

function CustomJs() {
    $(".light_dark input").on("change", function() 
    {
        "dark" == $(this).val() ? $("body").addClass("theme-dark") : $("body").removeClass("theme-dark")
    });
    
    $(".ls-toggle-btn").on("click", function() 
    {
        $("body").toggleClass("ls-toggle-menu")
    });
    
    /*$(".mobile_menu").on("click", function() 
    {
        $(".sidebar").toggleClass("open")
    });*/

    $(".boxs-close").on("click", function() 
    {
        $(this).parents(".card").addClass("closed").fadeOut()
    });
    
    /*$(".right_icon_toggle_btn").on("click", function() 
    {
        $("body").toggleClass("right_icon_toggle")
    });*/
    
    $(".list_btn").on("click", function() 
    {
        $(".chat_list").toggleClass("open")
    })
}
if ("undefined" == typeof jQuery) throw new Error("jQuery plugins need to be before this file");
$.AdminAero = {}, $.AdminAero.options = {
    colors: {
        red: "#ec3b57",
        pink: "#E91E63",
        purple: "#ba3bd0",
        deepPurple: "#673AB7",
        indigo: "#3F51B5",
        blue: "#2196f3",
        lightBlue: "#03A9F4",
        cyan: "#00bcd4",
        green: "#4CAF50",
        lightGreen: "#8BC34A",
        yellow: "#ffe821",
        orange: "#FF9800",
        deepOrange: "#f83600",
        grey: "#9E9E9E",
        blueGrey: "#607D8B",
        black: "#000000",
        blush: "#dd5e89",
        white: "#ffffff"
    },
    leftSideBar: {
        scrollColor: "rgba(0,0,0,0.5)",
        scrollWidth: "4px",
        scrollAlwaysVisible: !1,
        scrollBorderRadius: "0",
        scrollRailBorderRadius: "0"
    },
    dropdownMenu: {
        effectIn: "fadeIn",
        effectOut: "fadeOut"
    }
}, $.AdminAero.leftSideBar = 
{
    activate: function() 
    {
        var a = this,
            b = $("body"),
            c = $(".overlay");

        $(window).on("click", function(d) 
        {
            var e = $(d.target);
            "i" === d.target.nodeName.toLowerCase() && (e = $(d.target).parent()), !e.hasClass("bars") && a.isOpen() && 0 === e.parents("#leftsidebar").length && (e.hasClass("js-right-sidebar") || c.fadeOut(), b.removeClass("overlay-open"))
        });
        
        /*$.each($(".menu-toggle.toggled"), function(a, b) 
        {
            $(b).next().slideToggle(0)
        });*/
        
        $.each($(".menu .list li.active"), function(a, b) 
        {
            var c = $(b).find("a:eq(0)");
            c.addClass("toggled"), c.next().show()
        });
        
        /*$(".menu-toggle").on("click", function(a) 
        {
            var b = $(this),
                c = b.next();

            if ($(b.parents("ul")[0]).hasClass("list")) 
            {
                var d = $(a.target).hasClass("menu-toggle") ? a.target : $(a.target).parents(".menu-toggle");
                $.each($(".menu-toggle.toggled").not(d).next(), function(a, b) {
                    $(b).is(":visible") && ($(b).prev().toggleClass("toggled"), $(b).slideUp())
                })
            }
            b.toggleClass("toggled"), c.slideToggle(320)
        });*/
        a.checkStatuForResize(!0), $(window).resize(function() 
        {
            a.checkStatuForResize(!1)
        }), Waves.attach(".menu .list a", ["waves-block"]), Waves.init()
    },
    checkStatuForResize: function(a) {
        var b = $("body"),
            c = $(".navbar .navbar-header .bars"),
            d = b.width();
        a && b.find(".content, .sidebar").addClass("no-animate").delay(1e3).queue(function() {
            $(this).removeClass("no-animate").dequeue()
        }), d < 1170 ? (d > 767 && b.addClass("ls-toggle-menu"), b.addClass("ls-closed"), c.fadeIn()) : (b.removeClass("ls-closed ls-toggle-menu"), c.fadeOut())
    },
    isOpen: function() {
        return $("body").hasClass("overlay-open")
    }
}, $.AdminAero.rightSideBar = {
    activate: function() {
        var a = this,
            b = $("#rightsidebar"),
            c = $(".overlay");
        $(window).on("click", function(d) {
            var e = $(d.target);
            "i" === d.target.nodeName.toLowerCase() && (e = $(d.target).parent()), !e.hasClass("js-right-sidebar") && a.isOpen() && 0 === e.parents("#rightsidebar").length && (e.hasClass("bars") || c.fadeOut(), b.removeClass("open"))
        }), $(".js-right-sidebar").on("click", function() {
            b.toggleClass("open"), a.isOpen() ? c.fadeIn() : c.fadeOut()
        })
    },
    isOpen: function() {
        return $(".right-sidebar").hasClass("open")
    }
}, $.AdminAero.navbar = {
    activate: function() {
        var a = $("body"),
            b = $(".overlay");
        $(".bars").on("click", function() {
            a.toggleClass("overlay-open"), a.hasClass("overlay-open") ? b.fadeIn() : b.fadeOut()
        }), $('.nav [data-close="true"]').on("click", function() {
            var a = $(".navbar-toggle").is(":visible"),
                b = $(".navbar-collapse");
            a && b.slideUp(function() {
                b.removeClass("in").removeAttr("style")
            })
        })
    }
}, $.AdminAero.select = {
    activate: function() {
        $.fn.selectpicker && $("select:not(.ms)").selectpicker()
    }
};
var edge = "Microsoft Edge",
    ie10 = "Internet Explorer 10",
    ie11 = "Internet Explorer 11",
    opera = "Opera",
    firefox = "Mozilla Firefox",
    chrome = "Google Chrome",
    safari = "Safari";
$.AdminAero.browser = {
    activate: function() {
        var a = this;
        "" !== a.getClassName() && $("html").addClass(a.getClassName())
    },
    getBrowser: function() {
        var a = navigator.userAgent.toLowerCase();
        return /edge/i.test(a) ? edge : /rv:11/i.test(a) ? ie11 : /msie 10/i.test(a) ? ie10 : /opr/i.test(a) ? opera : /chrome/i.test(a) ? chrome : /firefox/i.test(a) ? firefox : navigator.userAgent.match(/Version\/[\d\.]+.*Safari/) ? safari : void 0
    },
    getClassName: function() {
        var a = this.getBrowser();
        return a === edge ? "edge" : a === ie11 ? "ie11" : a === ie10 ? "ie10" : a === opera ? "opera" : a === chrome ? "chrome" : a === firefox ? "firefox" : a === safari ? "safari" : ""
    }
}, $(function() {
    $.AdminAero.browser.activate(), $.AdminAero.leftSideBar.activate(), $.AdminAero.rightSideBar.activate(), $.AdminAero.navbar.activate(), $.AdminAero.select.activate(), setTimeout(function() {
        $(".page-loader-wrapper").fadeOut()
    }, 50)
}), window.Aero = {
    colors: {
        blue: "#46b6fe",
        "blue-darkest": "#2695dc",
        "blue-darker": "#3da8ec",
        "blue-dark": "#3866a6",
        "blue-light": "#5ebcf9",
        "blue-lighter": "#6fc6ff",
        "blue-lightest": "#9bd8ff",
        azure: "#45aaf2",
        "azure-darkest": "#0e2230",
        "azure-darker": "#1c4461",
        "azure-dark": "#3788c2",
        "azure-light": "#7dc4f6",
        "azure-lighter": "#c7e6fb",
        "azure-lightest": "#ecf7fe",
        indigo: "#9988ff",
        "indigo-darkest": "#141729",
        "indigo-darker": "#282e52",
        "indigo-dark": "#515da4",
        "indigo-light": "#939edc",
        "indigo-lighter": "#d1d5f0",
        "indigo-lightest": "#f0f1fa",
        purple: "#b588ff",
        "purple-darkest": "#21132f",
        "purple-darker": "#42265e",
        "purple-dark": "#844bbb",
        "purple-light": "#c08ef0",
        "purple-lighter": "#e4cff9",
        "purple-lightest": "#f6effd",
        pink: "#ff4dab",
        "pink-darkest": "#31161f",
        "pink-darker": "#622c3e",
        "pink-dark": "#c5577c",
        "pink-light": "#f999b9",
        "pink-lighter": "#fcd3e1",
        "pink-lightest": "#fef0f5",
        red: "#ee2558",
        "red-darkest": "#2e0f0c",
        "red-darker": "#5c1e18",
        "red-dark": "#b93d30",
        "red-light": "#ee8277",
        "red-lighter": "#f8c9c5",
        "red-lightest": "#fdedec",
        orange: "#FF9948",
        "orange-darkest": "#331e0e",
        "orange-darker": "#653c1b",
        "orange-dark": "#ca7836",
        "orange-light": "#feb67c",
        "orange-lighter": "#fee0c7",
        "orange-lightest": "#fff5ec",
        yellow: "#fdd932",
        "yellow-darkest": "#302703",
        "yellow-darker": "#604e06",
        "yellow-dark": "#c19d0c",
        "yellow-light": "#f5d657",
        "yellow-lighter": "#fbedb7",
        "yellow-lightest": "#fef9e7",
        lime: "#82c885",
        "lime-darkest": "#192a0b",
        "lime-darker": "#315415",
        "lime-dark": "#62a82a",
        "lime-light": "#a3e072",
        "lime-lighter": "#d7f2c2",
        "lime-lightest": "#f2fbeb",
        green: "#04BE5B",
        "green-darkest": "#132500",
        "green-darker": "#264a00",
        "green-dark": "#4b9500",
        "green-light": "#8ecf4d",
        "green-lighter": "#cfeab3",
        "green-lightest": "#eff8e6",
        teal: "#2bcbba",
        "teal-darkest": "#092925",
        "teal-darker": "#11514a",
        "teal-dark": "#22a295",
        "teal-light": "#6bdbcf",
        "teal-lighter": "#bfefea",
        "teal-lightest": "#eafaf8",
        cyan: "#5CC5CD",
        "cyan-darkest": "#052025",
        "cyan-darker": "#09414a",
        "cyan-dark": "#128293",
        "cyan-light": "#5dbecd",
        "cyan-lighter": "#b9e3ea",
        "cyan-lightest": "#e8f6f8",
        gray: "#868e96",
        "gray-darkest": "#1b1c1e",
        "gray-darker": "#36393c",
        "gray-dark": "#6b7278",
        "gray-light": "#aab0b6",
        "gray-lighter": "#dbdde0",
        "gray-lightest": "#f3f4f5",
        "gray-dark": "#343a40",
        "gray-dark-darkest": "#0a0c0d",
        "gray-dark-darker": "#15171a",
        "gray-dark-dark": "#2a2e33",
        "gray-dark-light": "#717579",
        "gray-dark-lighter": "#c2c4c6",
        "gray-dark-lightest": "#ebebec"
    }
}, $(function() {
    "use strict";
    skinChanger(), CustomScrollbar(), CustomJs()
}), $(function() {
    $('a[href="#search"]').on("click", function(a) {
        a.preventDefault(), $("#search").addClass("open"), $('#search > form > input[type="search"]').focus()
    }), $("#search, #search #close").on("click keyup", function(a) {
        a.target != this && "close" != a.target.id && 27 != a.keyCode || $(this).removeClass("open")
    }), $("form").submit(function(a) {
        return a.preventDefault(), !1
    })
}), $(function() {
    "#dark" == location.hash && ($("body").addClass("theme-dark"), $("#darktheme").prop("checked", !0), $(".menu ul.list a").each(function() {
        var a = $(this).attr("href") + "#dark";
        $(this).attr("href", a)
    }))
});
var Tawk_API = Tawk_API || {},
    Tawk_LoadStart = new Date;
! function() {
    var a = document.createElement("script"),
        b = document.getElementsByTagName("script")[0];
    a.async = !0, a.src = "assets/themes/aero/assets/bundles/default.js", a.charset = "UTF-8", a.setAttribute("crossorigin", "*"), b.parentNode.insertBefore(a, b)
}();