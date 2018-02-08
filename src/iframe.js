/**
 * Manages iframe and it's content
 * @param $
 * @param settings
 * @param uiUtils
 * @param gmApi
 * @param log
 * @param selector
 * @param uiValidationUtils
 * @param localization
 * @returns {{showDetailedMenu: showDetailedMenu, showSelectorMenu: showSelectorMenu, showSliderMenu: showSliderMenu, showBlockPreview: showBlockPreview, showSettingsMenu: showSettingsMenu, setButtonPosition: setButtonPosition, onCloseMenu: CustomEvent, onShowMenuItem: CustomEvent, removeIframe: removeIframe, resizeSliderMenuToAdvanced: resizeSliderMenuToAdvanced, resizeSliderMenuToNormal: resizeSliderMenuToNormal}}
 * @constructor
 */
/* global StringUtils, Ioc, DetailedMenuController, SelectorMenuController, SliderMenuController, BlockPreviewController, SettingsMenuController */

/*
 * globals generated by gulp tasks/compile.js:
 * RESOURCE_TEMPLATE_DETAILEDMENU, RESOURCE_TEMPLATE_SELECTORMENU,
 * RESOURCE_TEMPLATE_SLIDERMENU, RESOURCE_TEMPLATE_BLOCKPREVIEW,
 * RESOURCE_TEMPLATE_SETTINGSMENU, RESOURCE_CSS_IFRAME,
 * RESOURCE_CSS_SELECTOR
 */

var IframeController = function ($, settings, uiUtils, gmApi, log, selector, uiValidationUtils, localization) { // jshint ignore:line
    var iframe = null;
    var iframeElement = null;
    var currentItem = null;
    var iframeMaxWidth = 320;
    var iframeMaxHeight = 407;
    var menuMaxWidth = 668;
    var settingsMaxWidth = 458;
    var iframePositionOffset = 5;
    var sliderMenuHeight = {advanced: 420, normal: 291};
    var buttonPosition = null;

    var views = {};

    var selectorStyles = RESOURCE_CSS_SELECTOR;

    if (gmApi.GM_addStyle) {
        gmApi.GM_addStyle(selectorStyles);
    } else {
        if(document.querySelector('.adg-styles')) {
            return false;
        }

        var selectorStyleTag = CommonUtils.createElement('style');
        selectorStyleTag.classList.add('adg-styles');

        if (selectorStyleTag.styleSheet) {
            selectorStyleTag.styleSheet.cssText = selectorStyles;
        } else {
            selectorStyleTag.appendChild(document.createTextNode(selectorStyles));
        }

        document.getElementsByTagName("head")[0].appendChild(selectorStyleTag);
    }

    views[settings.MenuItemsNames.DetailedMenu] = RESOURCE_TEMPLATE_DETAILEDMENU;
    views[settings.MenuItemsNames.SelectorMenu] = RESOURCE_TEMPLATE_SELECTORMENU;
    views[settings.MenuItemsNames.SliderMenu] = RESOURCE_TEMPLATE_SLIDERMENU;
    views[settings.MenuItemsNames.BlockPreview] = RESOURCE_TEMPLATE_BLOCKPREVIEW;
    views[settings.MenuItemsNames.SettingsMenu] = RESOURCE_TEMPLATE_SETTINGSMENU;

    var IFRAME_CSS = RESOURCE_CSS_IFRAME;

    if(window.innerWidth < menuMaxWidth) menuMaxWidth = window.innerWidth;
    if(window.innerWidth < settingsMaxWidth) settingsMaxWidth = window.innerWidth;

    var onCloseMenu = new CustomEvent();
    var onShowMenuItem = new CustomEvent();

    var createIframe = function (onIframeLoadCallback) {
        log.debug('Creating iframe');
        iframe = CommonUtils.createElement('iframe');

        // IE hack for prevent access denied error
        // see: https://stackoverflow.com/questions/1886547/access-is-denied-javascript-error-when-trying-to-access-the-document-object-of
        if (navigator.userAgent.match(/msie/i)) {
            iframe.src= "javascript:'<script>window.onload=function(){document.write(\\'<script>document.domain=\\\"" + document.domain + "\\\";<\\\\/script>\\');document.close();};<\/script>'";
        }

        var iframePosition = getIframePosition();
        var css = {
            left: iframePosition.left + 'px',
            top: iframePosition.top + 'px'
        };
        var attributes = {
            id: settings.Constants.IFRAME_ID,
            'class': selector.ignoreClassName(),
            frameBorder: 0,
            allowTransparency: 'true'
        };
        Object.keys(css).forEach(function (item) {
            iframe.style[item] = css[item];
        });
        Object.keys(attributes).forEach(function (item) {
            iframe.setAttribute(item, attributes[item]);
        });
        var iframeAlreadyLoaded = false;
        $(iframe).on('load', function () {
            if (iframeAlreadyLoaded) {
                //IE calls load each time when we use document.close
                return;
            }
            iframeAlreadyLoaded = true;
            appendDefaultStyle();
            onIframeLoadCallback();
        });

        if (CommonUtils.checkShadowDomSupport()) {
            iframeElement = CommonUtils.createElement('div');
            createShadowRootElement(iframeElement).appendChild(iframe);
        } else {
            iframeElement = iframe;
        }

        document.documentElement.appendChild(iframeElement);
    };

    var createShadowRootElement = function(iframeElement) {
        var shadowiframeElement = iframeElement.attachShadow({mode: 'closed'});
        shadowiframeElement.innerHTML = '<style>' + IFRAME_CSS + '</style>';
        return shadowiframeElement;
    };

    var getIframePosition = function() {
        var viewPort = uiValidationUtils.getViewPort();

        if (!buttonPosition) {
            return {
                left: 0,
                top: 0
            };
        }

        var defaultPosition = {
            left: buttonPosition.left,
            top: buttonPosition.top
        };
        var sides = [
            { //left top
                left: buttonPosition.left - iframeMaxWidth - iframePositionOffset,
                top: buttonPosition.top - iframeMaxHeight - iframePositionOffset
            },
            { //right top
                left: buttonPosition.left + iframePositionOffset,
                checkLeft: buttonPosition.left + iframeMaxWidth + iframePositionOffset,
                top: buttonPosition.top - iframeMaxHeight - iframePositionOffset
            },
            { //bottom right
                left: buttonPosition.left + iframePositionOffset,
                checkLeft: buttonPosition.left + iframeMaxWidth + iframePositionOffset,
                checkTop: buttonPosition.top + iframeMaxHeight + iframePositionOffset,
                top: buttonPosition.top + iframePositionOffset
            },
            { //bottom left
                left: buttonPosition.left - iframeMaxWidth - iframePositionOffset,
                checkTop: buttonPosition.top + iframeMaxHeight + iframePositionOffset,
                top: buttonPosition.top + iframePositionOffset
            }
        ];

        for (var i = 0; i < sides.length; i++) {
            var currentSide = sides[i];
            var left = currentSide.checkLeft ? currentSide.checkLeft : currentSide.left;
            var top = currentSide.checkTop ? currentSide.checkTop : currentSide.top;

            if (left < 0 || left > viewPort.width) {
                continue;
            }
            if (top < 0 || top > viewPort.height) {
                continue;
            }
            return currentSide;
        }

        return defaultPosition;
    };

    var specifyIframePosition = function () {
        var viewPort = uiValidationUtils.getViewPort();
        var frameElement = iframe;
        if ((frameElement.offsetLeft + frameElement.offsetWidth) > viewPort.width) {
            frameElement.style.left = Math.max(0, (viewPort.width - frameElement.offsetWidth - iframePositionOffset)) + 'px';
        }
        if (frameElement.offsetLeft < 0) {
            frameElement.style.left = iframePositionOffset + 'px';
        }
        if ((frameElement.offsetTop + frameElement.offsetHeight) > viewPort.height) {
            frameElement.style.top = Math.max(0, (viewPort.height - frameElement.offsetHeight - iframePositionOffset)) + 'px';
        }
        if (frameElement.offsetHeight < 0) {
            frameElement.style.top = iframePositionOffset + 'px';
        }

    };

    var appendDefaultStyle = function () {
        try {
            log.info('Iframe loaded writing styles');
            var doc = iframe.contentDocument;
            doc.open();
            doc.write('<html><head><style type="text/css">' + getStyleNonce() + IFRAME_CSS + '</style></head></html>');
            doc.close();
            iframe.style.setProperty('display', 'block', 'important');
        } catch (ex) {
            log.error(ex);
        }
    };

    var getStyleNonce = function () {
        var adgSettings = settings.getAdguardSettings();
        if (adgSettings === null) {
            return '';
        }
        return 'nonce="' + adgSettings.nonce + '"';
    };

    var showMenuItem = function (viewName, controller, width, height, options) {
        log.debug(StringUtils.format("Showing menu item: {0}", viewName));
        if (currentItem === viewName) {
            return;
        }
        var onIframeLoad = function () {
            var frameElement = iframe;

            var view = CommonUtils.createElement(views[viewName]);
            appendContent(view);
            localize();
            specifyIframePosition();
            if (!options) {
                options = {};
            }
            controller.init(frameElement, options);
            currentItem = viewName;
            onShowMenuItem.notify();
            if (options.dragElement) {
                uiUtils.makeIframeDraggable(iframe, iframe.contentDocument.querySelector(options.dragElement));
            }

            resizeIframe(width, height);
        };

        if (!iframe) {
            createIframe(onIframeLoad);
            return;
        }
        onIframeLoad();
    };

    var setButtonPosition = function (coords) {
        buttonPosition = coords;
    };

    var showDetailedMenu = function () {
        var controller = Ioc.get(DetailedMenuController);
        var options = {dragElement: '.menu-head'};
        showMenuItem(settings.MenuItemsNames.DetailedMenu, controller, iframeMaxWidth, 'auto', options);
        setCloseEventIfNotHitIframe(true);
    };

    var showSelectorMenu = function () {
        var controller = Ioc.get(SelectorMenuController);
        var options = {dragElement: '.head'};
        showMenuItem(settings.MenuItemsNames.SelectorMenu, controller, menuMaxWidth, 160, options);
        setCloseEventIfNotHitIframe(false);
    };

    var showSliderMenu = function (element) {
        var controller = Ioc.get(SliderMenuController);
        var options = {element: element, dragElement: '.head'};
        showMenuItem(settings.MenuItemsNames.SliderMenu, controller, menuMaxWidth, 'auto', options);
        setCloseEventIfNotHitIframe(true);
    };

    var showBlockPreview = function (element, path, currentElement) {
        var controller = Ioc.get(BlockPreviewController);
        var options = {element: element, path: path, dragElement: '.head', currentElement: currentElement};
        showMenuItem(settings.MenuItemsNames.BlockPreview, controller, menuMaxWidth, 'auto', options);
        setCloseEventIfNotHitIframe(true);
    };

    var showSettingsMenu = function () {
        var controller = Ioc.get(SettingsMenuController);
        var options = {dragElement: '.head'};
        showMenuItem(settings.MenuItemsNames.SettingsMenu, controller, 400, 360, options);
        setCloseEventIfNotHitIframe(true);
    };

    var localize = function () {
        var elements = iframe.contentDocument.querySelectorAll("[i18n]");
        for (var i = 0; i < elements.length; i++) {
            var message = localization.getMessage(elements[i].getAttribute("i18n"));
            localization.translateElement(elements[i], message);
        }
    };

    var resizeIframe = function(width, height) {
        var frame = iframe;

        // setting iframe height dynamically based on inner content
        if (height === 'auto' || !height) {
            height = frame.contentWindow.document.body.querySelector('.main').clientHeight || iframeMaxHeight;
        }

        if (width) {
            frame.width = width;
            frame.style.setProperty('width', width + 'px', 'important');
        }

        if (height) {
            frame.height = height;
            frame.style.setProperty('height', height + 'px', 'important');
        }
    };

    var resizeSliderMenuToAdvanced = function () {
        resizeIframe(null, sliderMenuHeight.advanced);
    };

    var resizeSliderMenuToNormal = function () {
        resizeIframe(null, sliderMenuHeight.normal);
    };

    var appendContent = function (view) {
        var body = iframe.contentDocument.body;
        for (var i = 0; i < body.children.length; i++) {
            body.removeChild(body.children[i]);
        }
        body.appendChild(view);
    };

    var setCloseEventIfNotHitIframe = function (setEvent) {
        document.removeEventListener('click', removeIframe);

        if(setEvent) {
            window.setTimeout(function () {
                document.addEventListener('click', removeIframe);
            }, 150);
        }
    };

    // e.isTrusted checking for prevent programmatically events
    // see: https://github.com/AdguardTeam/AdguardAssistant/issues/134
    var removeIframe = function(e) {
        if (e && e.isTrusted === false) return false;
        document.removeEventListener('click', removeIframe);
        document.documentElement.removeChild(iframeElement);
        iframe = null;
        iframeElement = null;
        currentItem = null;
        selector.close();
        onCloseMenu.notify();
    };

    return {
        showDetailedMenu: showDetailedMenu,
        showSelectorMenu: showSelectorMenu,
        showSliderMenu: showSliderMenu,
        showBlockPreview: showBlockPreview,
        showSettingsMenu: showSettingsMenu,
        setButtonPosition: setButtonPosition,
        onCloseMenu: onCloseMenu,
        onShowMenuItem: onShowMenuItem,
        removeIframe: removeIframe,
        resizeSliderMenuToAdvanced: resizeSliderMenuToAdvanced,
        resizeSliderMenuToNormal: resizeSliderMenuToNormal,
        resizeIframe: resizeIframe
    };
};
