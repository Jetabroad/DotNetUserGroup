"use strict";

function controllerProviderDecorator($controllerProvider, $controllerIntrospectorProvider) {
    var register = $controllerProvider.register;
    $controllerProvider.register = function(name, ctrl) {
        return $controllerIntrospectorProvider.register(name, ctrl), register.apply(this, arguments);
    };
}

function $controllerIntrospectorProvider() {
    var controllers = [], onControllerRegistered = null;
    return {
        register: function(name, constructor) {
            angular.isArray(constructor) && (constructor = constructor[constructor.length - 1]), 
            constructor.$routeConfig && (onControllerRegistered ? onControllerRegistered(name, constructor.$routeConfig) : controllers.push({
                name: name,
                config: constructor.$routeConfig
            }));
        },
        $get: [ "$componentLoader", function($componentLoader) {
            return function(newOnControllerRegistered) {
                for (onControllerRegistered = function(name, constructor) {
                    return name = $componentLoader.component(name), newOnControllerRegistered(name, constructor);
                }; controllers.length > 0; ) {
                    var rule = controllers.pop();
                    onControllerRegistered(rule.name, rule.config);
                }
            };
        } ]
    };
}

function routerFactory($$rootRouter, $rootScope, $location, $$grammar, $controllerIntrospector) {
    $controllerIntrospector(function(name, config) {
        $$grammar.config(name, config);
    }), $rootScope.$watch(function() {
        return $location.path();
    }, function(newUrl) {
        $$rootRouter.navigate(newUrl);
    });
    var nav = $$rootRouter.navigate;
    return $$rootRouter.navigate = function(url) {
        return nav.call(this, url).then(function(newUrl) {
            newUrl && $location.path(newUrl);
        });
    }, $$rootRouter;
}

function ngViewportDirective($animate, $injector, $q, $router) {
    function invoke(method, context, instruction) {
        return $injector.invoke(method, context, instruction.locals);
    }
    function viewportLink(scope, $element, attrs, ctrls, $transclude) {
        function cleanupLastView() {
            previousLeaveAnimation && ($animate.cancel(previousLeaveAnimation), previousLeaveAnimation = null), 
            currentScope && (currentScope.$destroy(), currentScope = null), currentElement && (previousLeaveAnimation = $animate.leave(currentElement), 
            previousLeaveAnimation.then(function() {
                previousLeaveAnimation = null;
            }), currentElement = null);
        }
        var currentScope, newScope, currentController, currentElement, previousLeaveAnimation, previousInstruction, viewportName = attrs.ngViewport || "default", parentCtrl = ctrls[0], myCtrl = ctrls[1], router = parentCtrl && parentCtrl.$$router || rootRouter;
        router.registerViewport({
            canDeactivate: function(instruction) {
                return currentController && currentController.canDeactivate ? invoke(currentController.canDeactivate, currentController, instruction) : !0;
            },
            activate: function(instruction) {
                var nextInstruction = serializeInstruction(instruction);
                if (nextInstruction !== previousInstruction) {
                    instruction.locals.$scope = newScope = scope.$new(), myCtrl.$$router = instruction.router, 
                    myCtrl.$$template = instruction.template;
                    var componentName = instruction.component, clone = $transclude(newScope, function(clone) {
                        $animate.enter(clone, null, currentElement || $element), cleanupLastView();
                    }), newController = instruction.controller;
                    newScope[componentName] = newController;
                    var result;
                    if (currentController && currentController.deactivate && (result = $q.when(invoke(currentController.deactivate, currentController, instruction))), 
                    currentController = newController, currentElement = clone, currentScope = newScope, 
                    previousInstruction = nextInstruction, newController.activate) {
                        var activationResult = $q.when(invoke(newController.activate, newController, instruction));
                        return result ? result.then(activationResult) : activationResult;
                    }
                    return result;
                }
            }
        }, viewportName);
    }
    function serializeInstruction(instruction) {
        return JSON.stringify({
            path: instruction.path,
            component: instruction.component,
            params: Object.keys(instruction.params).reduce(function(acc, key) {
                return "childRoute" !== key && (acc[key] = instruction.params[key]), acc;
            }, {})
        });
    }
    var rootRouter = $router;
    return {
        restrict: "AE",
        transclude: "element",
        terminal: !0,
        priority: 400,
        require: [ "?^^ngViewport", "ngViewport" ],
        link: viewportLink,
        controller: function() {},
        controllerAs: "$$ngViewport"
    };
}

function ngViewportFillContentDirective($compile) {
    return {
        restrict: "EA",
        priority: -400,
        require: "ngViewport",
        link: function(scope, $element, attrs, ctrl) {
            var template = ctrl.$$template;
            $element.html(template);
            var link = $compile($element.contents());
            link(scope);
        }
    };
}

function makeComponentString(name) {
    return [ '<router-component component-name="', name, '">', "</router-component>" ].join("");
}

function ngLinkDirective($router, $location, $parse) {
    function ngLinkDirectiveLinkFn(scope, elt, attrs, ctrl) {
        var router = ctrl && ctrl.$$router || rootRouter;
        if (router) {
            var url, link = attrs.ngLink || "", parts = link.match(LINK_MICROSYNTAX_RE), routeName = parts[1], routeParams = parts[2];
            if (routeParams) {
                var routeParamsGetter = $parse(routeParams);
                if (routeParamsGetter.constant) {
                    var params = routeParamsGetter();
                    url = "." + router.generate(routeName, params), elt.attr("href", url);
                } else scope.$watch(function() {
                    return routeParamsGetter(scope);
                }, function(params) {
                    url = "." + router.generate(routeName, params), elt.attr("href", url);
                }, !0);
            } else url = "." + router.generate(routeName), elt.attr("href", url);
        }
    }
    var rootRouter = $router;
    return {
        require: "?^^ngViewport",
        restrict: "A",
        link: ngLinkDirectiveLinkFn
    };
}

function anchorLinkDirective($router) {
    return {
        restrict: "E",
        link: function(scope, element) {
            if ("a" === element[0].nodeName.toLowerCase()) {
                var hrefAttrName = "[object SVGAnimatedString]" === Object.prototype.toString.call(element.prop("href")) ? "xlink:href" : "href";
                element.on("click", function(event) {
                    var href = element.attr(hrefAttrName);
                    href || event.preventDefault(), $router.recognize(href) && ($router.navigate(href), 
                    event.preventDefault());
                });
            }
        }
    };
}

function setupRoutersStepFactory() {
    return function(instruction) {
        return instruction.router.makeDescendantRouters(instruction);
    };
}

function initLocalsStepFactory() {
    return function(instruction) {
        return instruction.router.traverseInstruction(instruction, function(instruction) {
            return instruction.locals = {
                $router: instruction.router,
                $routeParams: instruction.params || {}
            };
        });
    };
}

function initControllersStepFactory($controller, $componentLoader) {
    return function(instruction) {
        return instruction.router.traverseInstruction(instruction, function(instruction) {
            var ctrl, controllerName = $componentLoader.controllerName(instruction.component), locals = instruction.locals;
            try {
                ctrl = $controller(controllerName, locals);
            } catch (e) {
                console.warn && console.warn("Could not instantiate controller", controllerName), 
                ctrl = $controller(angular.noop, locals);
            }
            return instruction.controller = ctrl;
        });
    };
}

function runCanDeactivateHookStepFactory() {
    return function(instruction) {
        return instruction.router.canDeactivatePorts(instruction);
    };
}

function runCanActivateHookStepFactory($injector) {
    function invoke(method, context, instruction) {
        return $injector.invoke(method, context, {
            $routeParams: instruction.params
        });
    }
    return function(instruction) {
        return instruction.router.traverseInstruction(instruction, function(instruction) {
            var controller = instruction.controller;
            return !controller.canActivate || invoke(controller.canActivate, controller, instruction);
        });
    };
}

function loadTemplatesStepFactory($componentLoader, $templateRequest) {
    return function(instruction) {
        return instruction.router.traverseInstruction(instruction, function(instruction) {
            var componentTemplateUrl = $componentLoader.template(instruction.component);
            return $templateRequest(componentTemplateUrl).then(function(templateHtml) {
                return instruction.template = templateHtml;
            });
        });
    };
}

function activateStepValue(instruction) {
    return instruction.router.activatePorts(instruction);
}

function pipelineProvider() {
    var stepConfiguration, protoStepConfiguration = [ "$setupRoutersStep", "$initLocalsStep", "$initControllersStep", "$runCanDeactivateHookStep", "$runCanActivateHookStep", "$loadTemplatesStep", "$activateStep" ];
    return {
        steps: protoStepConfiguration.slice(0),
        config: function(newConfig) {
            protoStepConfiguration = newConfig;
        },
        $get: [ "$injector", "$q", function($injector, $q) {
            return stepConfiguration = protoStepConfiguration.map(function(step) {
                return $injector.get(step);
            }), {
                process: function(instruction) {
                    function processOne(result) {
                        if (0 === steps.length) return result;
                        var step = steps.shift();
                        return $q.when(step(instruction)).then(processOne);
                    }
                    var steps = stepConfiguration.slice(0);
                    return processOne();
                }
            };
        } ]
    };
}

function $componentLoaderProvider() {
    var DEFAULT_SUFFIX = "Controller", componentToCtrl = function(name) {
        return name[0].toUpperCase() + name.substr(1) + DEFAULT_SUFFIX;
    }, componentToTemplate = function(name) {
        var dashName = dashCase(name);
        return "./components/" + dashName + "/" + dashName + ".html";
    }, ctrlToComponent = function(name) {
        return name[0].toLowerCase() + name.substr(1, name.length - DEFAULT_SUFFIX.length - 1);
    };
    return {
        $get: function() {
            return {
                controllerName: componentToCtrl,
                template: componentToTemplate,
                component: ctrlToComponent
            };
        },
        setCtrlNameMapping: function(newFn) {
            return componentToCtrl = newFn, this;
        },
        setComponentFromCtrlMapping: function(newFn) {
            return ctrlToComponent = newFn, this;
        },
        setTemplateMapping: function(newFn) {
            return componentToTemplate = newFn, this;
        }
    };
}

function privatePipelineFactory($pipeline) {
    return $pipeline;
}

function dashCase(str) {
    return str.replace(/([A-Z])/g, function($1) {
        return "-" + $1.toLowerCase();
    });
}

!function(a, b) {
    "object" == typeof module && "object" == typeof module.exports ? module.exports = a.document ? b(a, !0) : function(a) {
        if (!a.document) throw new Error("jQuery requires a window with a document");
        return b(a);
    } : b(a);
}("undefined" != typeof window ? window : this, function(a, b) {
    function s(a) {
        var b = "length" in a && a.length, c = n.type(a);
        return "function" === c || n.isWindow(a) ? !1 : 1 === a.nodeType && b ? !0 : "array" === c || 0 === b || "number" == typeof b && b > 0 && b - 1 in a;
    }
    function x(a, b, c) {
        if (n.isFunction(b)) return n.grep(a, function(a, d) {
            return !!b.call(a, d, a) !== c;
        });
        if (b.nodeType) return n.grep(a, function(a) {
            return a === b !== c;
        });
        if ("string" == typeof b) {
            if (w.test(b)) return n.filter(b, a, c);
            b = n.filter(b, a);
        }
        return n.grep(a, function(a) {
            return g.call(b, a) >= 0 !== c;
        });
    }
    function D(a, b) {
        for (;(a = a[b]) && 1 !== a.nodeType; ) ;
        return a;
    }
    function G(a) {
        var b = F[a] = {};
        return n.each(a.match(E) || [], function(a, c) {
            b[c] = !0;
        }), b;
    }
    function I() {
        l.removeEventListener("DOMContentLoaded", I, !1), a.removeEventListener("load", I, !1), 
        n.ready();
    }
    function K() {
        Object.defineProperty(this.cache = {}, 0, {
            get: function() {
                return {};
            }
        }), this.expando = n.expando + K.uid++;
    }
    function P(a, b, c) {
        var d;
        if (void 0 === c && 1 === a.nodeType) if (d = "data-" + b.replace(O, "-$1").toLowerCase(), 
        c = a.getAttribute(d), "string" == typeof c) {
            try {
                c = "true" === c ? !0 : "false" === c ? !1 : "null" === c ? null : +c + "" === c ? +c : N.test(c) ? n.parseJSON(c) : c;
            } catch (e) {}
            M.set(a, b, c);
        } else c = void 0;
        return c;
    }
    function Z() {
        return !0;
    }
    function $() {
        return !1;
    }
    function _() {
        try {
            return l.activeElement;
        } catch (a) {}
    }
    function ja(a, b) {
        return n.nodeName(a, "table") && n.nodeName(11 !== b.nodeType ? b : b.firstChild, "tr") ? a.getElementsByTagName("tbody")[0] || a.appendChild(a.ownerDocument.createElement("tbody")) : a;
    }
    function ka(a) {
        return a.type = (null !== a.getAttribute("type")) + "/" + a.type, a;
    }
    function la(a) {
        var b = ga.exec(a.type);
        return b ? a.type = b[1] : a.removeAttribute("type"), a;
    }
    function ma(a, b) {
        for (var c = 0, d = a.length; d > c; c++) L.set(a[c], "globalEval", !b || L.get(b[c], "globalEval"));
    }
    function na(a, b) {
        var c, d, e, f, g, h, i, j;
        if (1 === b.nodeType) {
            if (L.hasData(a) && (f = L.access(a), g = L.set(b, f), j = f.events)) {
                delete g.handle, g.events = {};
                for (e in j) for (c = 0, d = j[e].length; d > c; c++) n.event.add(b, e, j[e][c]);
            }
            M.hasData(a) && (h = M.access(a), i = n.extend({}, h), M.set(b, i));
        }
    }
    function oa(a, b) {
        var c = a.getElementsByTagName ? a.getElementsByTagName(b || "*") : a.querySelectorAll ? a.querySelectorAll(b || "*") : [];
        return void 0 === b || b && n.nodeName(a, b) ? n.merge([ a ], c) : c;
    }
    function pa(a, b) {
        var c = b.nodeName.toLowerCase();
        "input" === c && T.test(a.type) ? b.checked = a.checked : ("input" === c || "textarea" === c) && (b.defaultValue = a.defaultValue);
    }
    function sa(b, c) {
        var d, e = n(c.createElement(b)).appendTo(c.body), f = a.getDefaultComputedStyle && (d = a.getDefaultComputedStyle(e[0])) ? d.display : n.css(e[0], "display");
        return e.detach(), f;
    }
    function ta(a) {
        var b = l, c = ra[a];
        return c || (c = sa(a, b), "none" !== c && c || (qa = (qa || n("<iframe frameborder='0' width='0' height='0'/>")).appendTo(b.documentElement), 
        b = qa[0].contentDocument, b.write(), b.close(), c = sa(a, b), qa.detach()), ra[a] = c), 
        c;
    }
    function xa(a, b, c) {
        var d, e, f, g, h = a.style;
        return c = c || wa(a), c && (g = c.getPropertyValue(b) || c[b]), c && ("" !== g || n.contains(a.ownerDocument, a) || (g = n.style(a, b)), 
        va.test(g) && ua.test(b) && (d = h.width, e = h.minWidth, f = h.maxWidth, h.minWidth = h.maxWidth = h.width = g, 
        g = c.width, h.width = d, h.minWidth = e, h.maxWidth = f)), void 0 !== g ? g + "" : g;
    }
    function ya(a, b) {
        return {
            get: function() {
                return a() ? void delete this.get : (this.get = b).apply(this, arguments);
            }
        };
    }
    function Fa(a, b) {
        if (b in a) return b;
        for (var c = b[0].toUpperCase() + b.slice(1), d = b, e = Ea.length; e--; ) if (b = Ea[e] + c, 
        b in a) return b;
        return d;
    }
    function Ga(a, b, c) {
        var d = Aa.exec(b);
        return d ? Math.max(0, d[1] - (c || 0)) + (d[2] || "px") : b;
    }
    function Ha(a, b, c, d, e) {
        for (var f = c === (d ? "border" : "content") ? 4 : "width" === b ? 1 : 0, g = 0; 4 > f; f += 2) "margin" === c && (g += n.css(a, c + R[f], !0, e)), 
        d ? ("content" === c && (g -= n.css(a, "padding" + R[f], !0, e)), "margin" !== c && (g -= n.css(a, "border" + R[f] + "Width", !0, e))) : (g += n.css(a, "padding" + R[f], !0, e), 
        "padding" !== c && (g += n.css(a, "border" + R[f] + "Width", !0, e)));
        return g;
    }
    function Ia(a, b, c) {
        var d = !0, e = "width" === b ? a.offsetWidth : a.offsetHeight, f = wa(a), g = "border-box" === n.css(a, "boxSizing", !1, f);
        if (0 >= e || null == e) {
            if (e = xa(a, b, f), (0 > e || null == e) && (e = a.style[b]), va.test(e)) return e;
            d = g && (k.boxSizingReliable() || e === a.style[b]), e = parseFloat(e) || 0;
        }
        return e + Ha(a, b, c || (g ? "border" : "content"), d, f) + "px";
    }
    function Ja(a, b) {
        for (var c, d, e, f = [], g = 0, h = a.length; h > g; g++) d = a[g], d.style && (f[g] = L.get(d, "olddisplay"), 
        c = d.style.display, b ? (f[g] || "none" !== c || (d.style.display = ""), "" === d.style.display && S(d) && (f[g] = L.access(d, "olddisplay", ta(d.nodeName)))) : (e = S(d), 
        "none" === c && e || L.set(d, "olddisplay", e ? c : n.css(d, "display"))));
        for (g = 0; h > g; g++) d = a[g], d.style && (b && "none" !== d.style.display && "" !== d.style.display || (d.style.display = b ? f[g] || "" : "none"));
        return a;
    }
    function Ka(a, b, c, d, e) {
        return new Ka.prototype.init(a, b, c, d, e);
    }
    function Sa() {
        return setTimeout(function() {
            La = void 0;
        }), La = n.now();
    }
    function Ta(a, b) {
        var c, d = 0, e = {
            height: a
        };
        for (b = b ? 1 : 0; 4 > d; d += 2 - b) c = R[d], e["margin" + c] = e["padding" + c] = a;
        return b && (e.opacity = e.width = a), e;
    }
    function Ua(a, b, c) {
        for (var d, e = (Ra[b] || []).concat(Ra["*"]), f = 0, g = e.length; g > f; f++) if (d = e[f].call(c, b, a)) return d;
    }
    function Va(a, b, c) {
        var d, e, f, g, h, i, j, k, l = this, m = {}, o = a.style, p = a.nodeType && S(a), q = L.get(a, "fxshow");
        c.queue || (h = n._queueHooks(a, "fx"), null == h.unqueued && (h.unqueued = 0, i = h.empty.fire, 
        h.empty.fire = function() {
            h.unqueued || i();
        }), h.unqueued++, l.always(function() {
            l.always(function() {
                h.unqueued--, n.queue(a, "fx").length || h.empty.fire();
            });
        })), 1 === a.nodeType && ("height" in b || "width" in b) && (c.overflow = [ o.overflow, o.overflowX, o.overflowY ], 
        j = n.css(a, "display"), k = "none" === j ? L.get(a, "olddisplay") || ta(a.nodeName) : j, 
        "inline" === k && "none" === n.css(a, "float") && (o.display = "inline-block")), 
        c.overflow && (o.overflow = "hidden", l.always(function() {
            o.overflow = c.overflow[0], o.overflowX = c.overflow[1], o.overflowY = c.overflow[2];
        }));
        for (d in b) if (e = b[d], Na.exec(e)) {
            if (delete b[d], f = f || "toggle" === e, e === (p ? "hide" : "show")) {
                if ("show" !== e || !q || void 0 === q[d]) continue;
                p = !0;
            }
            m[d] = q && q[d] || n.style(a, d);
        } else j = void 0;
        if (n.isEmptyObject(m)) "inline" === ("none" === j ? ta(a.nodeName) : j) && (o.display = j); else {
            q ? "hidden" in q && (p = q.hidden) : q = L.access(a, "fxshow", {}), f && (q.hidden = !p), 
            p ? n(a).show() : l.done(function() {
                n(a).hide();
            }), l.done(function() {
                var b;
                L.remove(a, "fxshow");
                for (b in m) n.style(a, b, m[b]);
            });
            for (d in m) g = Ua(p ? q[d] : 0, d, l), d in q || (q[d] = g.start, p && (g.end = g.start, 
            g.start = "width" === d || "height" === d ? 1 : 0));
        }
    }
    function Wa(a, b) {
        var c, d, e, f, g;
        for (c in a) if (d = n.camelCase(c), e = b[d], f = a[c], n.isArray(f) && (e = f[1], 
        f = a[c] = f[0]), c !== d && (a[d] = f, delete a[c]), g = n.cssHooks[d], g && "expand" in g) {
            f = g.expand(f), delete a[d];
            for (c in f) c in a || (a[c] = f[c], b[c] = e);
        } else b[d] = e;
    }
    function Xa(a, b, c) {
        var d, e, f = 0, g = Qa.length, h = n.Deferred().always(function() {
            delete i.elem;
        }), i = function() {
            if (e) return !1;
            for (var b = La || Sa(), c = Math.max(0, j.startTime + j.duration - b), d = c / j.duration || 0, f = 1 - d, g = 0, i = j.tweens.length; i > g; g++) j.tweens[g].run(f);
            return h.notifyWith(a, [ j, f, c ]), 1 > f && i ? c : (h.resolveWith(a, [ j ]), 
            !1);
        }, j = h.promise({
            elem: a,
            props: n.extend({}, b),
            opts: n.extend(!0, {
                specialEasing: {}
            }, c),
            originalProperties: b,
            originalOptions: c,
            startTime: La || Sa(),
            duration: c.duration,
            tweens: [],
            createTween: function(b, c) {
                var d = n.Tween(a, j.opts, b, c, j.opts.specialEasing[b] || j.opts.easing);
                return j.tweens.push(d), d;
            },
            stop: function(b) {
                var c = 0, d = b ? j.tweens.length : 0;
                if (e) return this;
                for (e = !0; d > c; c++) j.tweens[c].run(1);
                return b ? h.resolveWith(a, [ j, b ]) : h.rejectWith(a, [ j, b ]), this;
            }
        }), k = j.props;
        for (Wa(k, j.opts.specialEasing); g > f; f++) if (d = Qa[f].call(j, a, k, j.opts)) return d;
        return n.map(k, Ua, j), n.isFunction(j.opts.start) && j.opts.start.call(a, j), n.fx.timer(n.extend(i, {
            elem: a,
            anim: j,
            queue: j.opts.queue
        })), j.progress(j.opts.progress).done(j.opts.done, j.opts.complete).fail(j.opts.fail).always(j.opts.always);
    }
    function qb(a) {
        return function(b, c) {
            "string" != typeof b && (c = b, b = "*");
            var d, e = 0, f = b.toLowerCase().match(E) || [];
            if (n.isFunction(c)) for (;d = f[e++]; ) "+" === d[0] ? (d = d.slice(1) || "*", 
            (a[d] = a[d] || []).unshift(c)) : (a[d] = a[d] || []).push(c);
        };
    }
    function rb(a, b, c, d) {
        function g(h) {
            var i;
            return e[h] = !0, n.each(a[h] || [], function(a, h) {
                var j = h(b, c, d);
                return "string" != typeof j || f || e[j] ? f ? !(i = j) : void 0 : (b.dataTypes.unshift(j), 
                g(j), !1);
            }), i;
        }
        var e = {}, f = a === mb;
        return g(b.dataTypes[0]) || !e["*"] && g("*");
    }
    function sb(a, b) {
        var c, d, e = n.ajaxSettings.flatOptions || {};
        for (c in b) void 0 !== b[c] && ((e[c] ? a : d || (d = {}))[c] = b[c]);
        return d && n.extend(!0, a, d), a;
    }
    function tb(a, b, c) {
        for (var d, e, f, g, h = a.contents, i = a.dataTypes; "*" === i[0]; ) i.shift(), 
        void 0 === d && (d = a.mimeType || b.getResponseHeader("Content-Type"));
        if (d) for (e in h) if (h[e] && h[e].test(d)) {
            i.unshift(e);
            break;
        }
        if (i[0] in c) f = i[0]; else {
            for (e in c) {
                if (!i[0] || a.converters[e + " " + i[0]]) {
                    f = e;
                    break;
                }
                g || (g = e);
            }
            f = f || g;
        }
        return f ? (f !== i[0] && i.unshift(f), c[f]) : void 0;
    }
    function ub(a, b, c, d) {
        var e, f, g, h, i, j = {}, k = a.dataTypes.slice();
        if (k[1]) for (g in a.converters) j[g.toLowerCase()] = a.converters[g];
        for (f = k.shift(); f; ) if (a.responseFields[f] && (c[a.responseFields[f]] = b), 
        !i && d && a.dataFilter && (b = a.dataFilter(b, a.dataType)), i = f, f = k.shift()) if ("*" === f) f = i; else if ("*" !== i && i !== f) {
            if (g = j[i + " " + f] || j["* " + f], !g) for (e in j) if (h = e.split(" "), h[1] === f && (g = j[i + " " + h[0]] || j["* " + h[0]])) {
                g === !0 ? g = j[e] : j[e] !== !0 && (f = h[0], k.unshift(h[1]));
                break;
            }
            if (g !== !0) if (g && a["throws"]) b = g(b); else try {
                b = g(b);
            } catch (l) {
                return {
                    state: "parsererror",
                    error: g ? l : "No conversion from " + i + " to " + f
                };
            }
        }
        return {
            state: "success",
            data: b
        };
    }
    function Ab(a, b, c, d) {
        var e;
        if (n.isArray(b)) n.each(b, function(b, e) {
            c || wb.test(a) ? d(a, e) : Ab(a + "[" + ("object" == typeof e ? b : "") + "]", e, c, d);
        }); else if (c || "object" !== n.type(b)) d(a, b); else for (e in b) Ab(a + "[" + e + "]", b[e], c, d);
    }
    function Jb(a) {
        return n.isWindow(a) ? a : 9 === a.nodeType && a.defaultView;
    }
    var c = [], d = c.slice, e = c.concat, f = c.push, g = c.indexOf, h = {}, i = h.toString, j = h.hasOwnProperty, k = {}, l = a.document, m = "2.1.4", n = function(a, b) {
        return new n.fn.init(a, b);
    }, o = /^[\s\uFEFF\xA0]+|[\s\uFEFF\xA0]+$/g, p = /^-ms-/, q = /-([\da-z])/gi, r = function(a, b) {
        return b.toUpperCase();
    };
    n.fn = n.prototype = {
        jquery: m,
        constructor: n,
        selector: "",
        length: 0,
        toArray: function() {
            return d.call(this);
        },
        get: function(a) {
            return null != a ? 0 > a ? this[a + this.length] : this[a] : d.call(this);
        },
        pushStack: function(a) {
            var b = n.merge(this.constructor(), a);
            return b.prevObject = this, b.context = this.context, b;
        },
        each: function(a, b) {
            return n.each(this, a, b);
        },
        map: function(a) {
            return this.pushStack(n.map(this, function(b, c) {
                return a.call(b, c, b);
            }));
        },
        slice: function() {
            return this.pushStack(d.apply(this, arguments));
        },
        first: function() {
            return this.eq(0);
        },
        last: function() {
            return this.eq(-1);
        },
        eq: function(a) {
            var b = this.length, c = +a + (0 > a ? b : 0);
            return this.pushStack(c >= 0 && b > c ? [ this[c] ] : []);
        },
        end: function() {
            return this.prevObject || this.constructor(null);
        },
        push: f,
        sort: c.sort,
        splice: c.splice
    }, n.extend = n.fn.extend = function() {
        var a, b, c, d, e, f, g = arguments[0] || {}, h = 1, i = arguments.length, j = !1;
        for ("boolean" == typeof g && (j = g, g = arguments[h] || {}, h++), "object" == typeof g || n.isFunction(g) || (g = {}), 
        h === i && (g = this, h--); i > h; h++) if (null != (a = arguments[h])) for (b in a) c = g[b], 
        d = a[b], g !== d && (j && d && (n.isPlainObject(d) || (e = n.isArray(d))) ? (e ? (e = !1, 
        f = c && n.isArray(c) ? c : []) : f = c && n.isPlainObject(c) ? c : {}, g[b] = n.extend(j, f, d)) : void 0 !== d && (g[b] = d));
        return g;
    }, n.extend({
        expando: "jQuery" + (m + Math.random()).replace(/\D/g, ""),
        isReady: !0,
        error: function(a) {
            throw new Error(a);
        },
        noop: function() {},
        isFunction: function(a) {
            return "function" === n.type(a);
        },
        isArray: Array.isArray,
        isWindow: function(a) {
            return null != a && a === a.window;
        },
        isNumeric: function(a) {
            return !n.isArray(a) && a - parseFloat(a) + 1 >= 0;
        },
        isPlainObject: function(a) {
            return "object" !== n.type(a) || a.nodeType || n.isWindow(a) ? !1 : a.constructor && !j.call(a.constructor.prototype, "isPrototypeOf") ? !1 : !0;
        },
        isEmptyObject: function(a) {
            var b;
            for (b in a) return !1;
            return !0;
        },
        type: function(a) {
            return null == a ? a + "" : "object" == typeof a || "function" == typeof a ? h[i.call(a)] || "object" : typeof a;
        },
        globalEval: function(a) {
            var b, c = eval;
            a = n.trim(a), a && (1 === a.indexOf("use strict") ? (b = l.createElement("script"), 
            b.text = a, l.head.appendChild(b).parentNode.removeChild(b)) : c(a));
        },
        camelCase: function(a) {
            return a.replace(p, "ms-").replace(q, r);
        },
        nodeName: function(a, b) {
            return a.nodeName && a.nodeName.toLowerCase() === b.toLowerCase();
        },
        each: function(a, b, c) {
            var d, e = 0, f = a.length, g = s(a);
            if (c) {
                if (g) for (;f > e && (d = b.apply(a[e], c), d !== !1); e++) ; else for (e in a) if (d = b.apply(a[e], c), 
                d === !1) break;
            } else if (g) for (;f > e && (d = b.call(a[e], e, a[e]), d !== !1); e++) ; else for (e in a) if (d = b.call(a[e], e, a[e]), 
            d === !1) break;
            return a;
        },
        trim: function(a) {
            return null == a ? "" : (a + "").replace(o, "");
        },
        makeArray: function(a, b) {
            var c = b || [];
            return null != a && (s(Object(a)) ? n.merge(c, "string" == typeof a ? [ a ] : a) : f.call(c, a)), 
            c;
        },
        inArray: function(a, b, c) {
            return null == b ? -1 : g.call(b, a, c);
        },
        merge: function(a, b) {
            for (var c = +b.length, d = 0, e = a.length; c > d; d++) a[e++] = b[d];
            return a.length = e, a;
        },
        grep: function(a, b, c) {
            for (var d, e = [], f = 0, g = a.length, h = !c; g > f; f++) d = !b(a[f], f), d !== h && e.push(a[f]);
            return e;
        },
        map: function(a, b, c) {
            var d, f = 0, g = a.length, h = s(a), i = [];
            if (h) for (;g > f; f++) d = b(a[f], f, c), null != d && i.push(d); else for (f in a) d = b(a[f], f, c), 
            null != d && i.push(d);
            return e.apply([], i);
        },
        guid: 1,
        proxy: function(a, b) {
            var c, e, f;
            return "string" == typeof b && (c = a[b], b = a, a = c), n.isFunction(a) ? (e = d.call(arguments, 2), 
            f = function() {
                return a.apply(b || this, e.concat(d.call(arguments)));
            }, f.guid = a.guid = a.guid || n.guid++, f) : void 0;
        },
        now: Date.now,
        support: k
    }), n.each("Boolean Number String Function Array Date RegExp Object Error".split(" "), function(a, b) {
        h["[object " + b + "]"] = b.toLowerCase();
    });
    var t = function(a) {
        function ga(a, b, d, e) {
            var f, h, j, k, l, o, r, s, w, x;
            if ((b ? b.ownerDocument || b : v) !== n && m(b), b = b || n, d = d || [], k = b.nodeType, 
            "string" != typeof a || !a || 1 !== k && 9 !== k && 11 !== k) return d;
            if (!e && p) {
                if (11 !== k && (f = _.exec(a))) if (j = f[1]) {
                    if (9 === k) {
                        if (h = b.getElementById(j), !h || !h.parentNode) return d;
                        if (h.id === j) return d.push(h), d;
                    } else if (b.ownerDocument && (h = b.ownerDocument.getElementById(j)) && t(b, h) && h.id === j) return d.push(h), 
                    d;
                } else {
                    if (f[2]) return H.apply(d, b.getElementsByTagName(a)), d;
                    if ((j = f[3]) && c.getElementsByClassName) return H.apply(d, b.getElementsByClassName(j)), 
                    d;
                }
                if (c.qsa && (!q || !q.test(a))) {
                    if (s = r = u, w = b, x = 1 !== k && a, 1 === k && "object" !== b.nodeName.toLowerCase()) {
                        for (o = g(a), (r = b.getAttribute("id")) ? s = r.replace(ba, "\\$&") : b.setAttribute("id", s), 
                        s = "[id='" + s + "'] ", l = o.length; l--; ) o[l] = s + ra(o[l]);
                        w = aa.test(a) && pa(b.parentNode) || b, x = o.join(",");
                    }
                    if (x) try {
                        return H.apply(d, w.querySelectorAll(x)), d;
                    } catch (y) {} finally {
                        r || b.removeAttribute("id");
                    }
                }
            }
            return i(a.replace(R, "$1"), b, d, e);
        }
        function ha() {
            function b(c, e) {
                return a.push(c + " ") > d.cacheLength && delete b[a.shift()], b[c + " "] = e;
            }
            var a = [];
            return b;
        }
        function ia(a) {
            return a[u] = !0, a;
        }
        function ja(a) {
            var b = n.createElement("div");
            try {
                return !!a(b);
            } catch (c) {
                return !1;
            } finally {
                b.parentNode && b.parentNode.removeChild(b), b = null;
            }
        }
        function ka(a, b) {
            for (var c = a.split("|"), e = a.length; e--; ) d.attrHandle[c[e]] = b;
        }
        function la(a, b) {
            var c = b && a, d = c && 1 === a.nodeType && 1 === b.nodeType && (~b.sourceIndex || C) - (~a.sourceIndex || C);
            if (d) return d;
            if (c) for (;c = c.nextSibling; ) if (c === b) return -1;
            return a ? 1 : -1;
        }
        function ma(a) {
            return function(b) {
                var c = b.nodeName.toLowerCase();
                return "input" === c && b.type === a;
            };
        }
        function na(a) {
            return function(b) {
                var c = b.nodeName.toLowerCase();
                return ("input" === c || "button" === c) && b.type === a;
            };
        }
        function oa(a) {
            return ia(function(b) {
                return b = +b, ia(function(c, d) {
                    for (var e, f = a([], c.length, b), g = f.length; g--; ) c[e = f[g]] && (c[e] = !(d[e] = c[e]));
                });
            });
        }
        function pa(a) {
            return a && "undefined" != typeof a.getElementsByTagName && a;
        }
        function qa() {}
        function ra(a) {
            for (var b = 0, c = a.length, d = ""; c > b; b++) d += a[b].value;
            return d;
        }
        function sa(a, b, c) {
            var d = b.dir, e = c && "parentNode" === d, f = x++;
            return b.first ? function(b, c, f) {
                for (;b = b[d]; ) if (1 === b.nodeType || e) return a(b, c, f);
            } : function(b, c, g) {
                var h, i, j = [ w, f ];
                if (g) {
                    for (;b = b[d]; ) if ((1 === b.nodeType || e) && a(b, c, g)) return !0;
                } else for (;b = b[d]; ) if (1 === b.nodeType || e) {
                    if (i = b[u] || (b[u] = {}), (h = i[d]) && h[0] === w && h[1] === f) return j[2] = h[2];
                    if (i[d] = j, j[2] = a(b, c, g)) return !0;
                }
            };
        }
        function ta(a) {
            return a.length > 1 ? function(b, c, d) {
                for (var e = a.length; e--; ) if (!a[e](b, c, d)) return !1;
                return !0;
            } : a[0];
        }
        function ua(a, b, c) {
            for (var d = 0, e = b.length; e > d; d++) ga(a, b[d], c);
            return c;
        }
        function va(a, b, c, d, e) {
            for (var f, g = [], h = 0, i = a.length, j = null != b; i > h; h++) (f = a[h]) && (!c || c(f, d, e)) && (g.push(f), 
            j && b.push(h));
            return g;
        }
        function wa(a, b, c, d, e, f) {
            return d && !d[u] && (d = wa(d)), e && !e[u] && (e = wa(e, f)), ia(function(f, g, h, i) {
                var j, k, l, m = [], n = [], o = g.length, p = f || ua(b || "*", h.nodeType ? [ h ] : h, []), q = !a || !f && b ? p : va(p, m, a, h, i), r = c ? e || (f ? a : o || d) ? [] : g : q;
                if (c && c(q, r, h, i), d) for (j = va(r, n), d(j, [], h, i), k = j.length; k--; ) (l = j[k]) && (r[n[k]] = !(q[n[k]] = l));
                if (f) {
                    if (e || a) {
                        if (e) {
                            for (j = [], k = r.length; k--; ) (l = r[k]) && j.push(q[k] = l);
                            e(null, r = [], j, i);
                        }
                        for (k = r.length; k--; ) (l = r[k]) && (j = e ? J(f, l) : m[k]) > -1 && (f[j] = !(g[j] = l));
                    }
                } else r = va(r === g ? r.splice(o, r.length) : r), e ? e(null, g, r, i) : H.apply(g, r);
            });
        }
        function xa(a) {
            for (var b, c, e, f = a.length, g = d.relative[a[0].type], h = g || d.relative[" "], i = g ? 1 : 0, k = sa(function(a) {
                return a === b;
            }, h, !0), l = sa(function(a) {
                return J(b, a) > -1;
            }, h, !0), m = [ function(a, c, d) {
                var e = !g && (d || c !== j) || ((b = c).nodeType ? k(a, c, d) : l(a, c, d));
                return b = null, e;
            } ]; f > i; i++) if (c = d.relative[a[i].type]) m = [ sa(ta(m), c) ]; else {
                if (c = d.filter[a[i].type].apply(null, a[i].matches), c[u]) {
                    for (e = ++i; f > e && !d.relative[a[e].type]; e++) ;
                    return wa(i > 1 && ta(m), i > 1 && ra(a.slice(0, i - 1).concat({
                        value: " " === a[i - 2].type ? "*" : ""
                    })).replace(R, "$1"), c, e > i && xa(a.slice(i, e)), f > e && xa(a = a.slice(e)), f > e && ra(a));
                }
                m.push(c);
            }
            return ta(m);
        }
        function ya(a, b) {
            var c = b.length > 0, e = a.length > 0, f = function(f, g, h, i, k) {
                var l, m, o, p = 0, q = "0", r = f && [], s = [], t = j, u = f || e && d.find.TAG("*", k), v = w += null == t ? 1 : Math.random() || .1, x = u.length;
                for (k && (j = g !== n && g); q !== x && null != (l = u[q]); q++) {
                    if (e && l) {
                        for (m = 0; o = a[m++]; ) if (o(l, g, h)) {
                            i.push(l);
                            break;
                        }
                        k && (w = v);
                    }
                    c && ((l = !o && l) && p--, f && r.push(l));
                }
                if (p += q, c && q !== p) {
                    for (m = 0; o = b[m++]; ) o(r, s, g, h);
                    if (f) {
                        if (p > 0) for (;q--; ) r[q] || s[q] || (s[q] = F.call(i));
                        s = va(s);
                    }
                    H.apply(i, s), k && !f && s.length > 0 && p + b.length > 1 && ga.uniqueSort(i);
                }
                return k && (w = v, j = t), r;
            };
            return c ? ia(f) : f;
        }
        var b, c, d, e, f, g, h, i, j, k, l, m, n, o, p, q, r, s, t, u = "sizzle" + 1 * new Date(), v = a.document, w = 0, x = 0, y = ha(), z = ha(), A = ha(), B = function(a, b) {
            return a === b && (l = !0), 0;
        }, C = 1 << 31, D = {}.hasOwnProperty, E = [], F = E.pop, G = E.push, H = E.push, I = E.slice, J = function(a, b) {
            for (var c = 0, d = a.length; d > c; c++) if (a[c] === b) return c;
            return -1;
        }, K = "checked|selected|async|autofocus|autoplay|controls|defer|disabled|hidden|ismap|loop|multiple|open|readonly|required|scoped", L = "[\\x20\\t\\r\\n\\f]", M = "(?:\\\\.|[\\w-]|[^\\x00-\\xa0])+", N = M.replace("w", "w#"), O = "\\[" + L + "*(" + M + ")(?:" + L + "*([*^$|!~]?=)" + L + "*(?:'((?:\\\\.|[^\\\\'])*)'|\"((?:\\\\.|[^\\\\\"])*)\"|(" + N + "))|)" + L + "*\\]", P = ":(" + M + ")(?:\\((('((?:\\\\.|[^\\\\'])*)'|\"((?:\\\\.|[^\\\\\"])*)\")|((?:\\\\.|[^\\\\()[\\]]|" + O + ")*)|.*)\\)|)", Q = new RegExp(L + "+", "g"), R = new RegExp("^" + L + "+|((?:^|[^\\\\])(?:\\\\.)*)" + L + "+$", "g"), S = new RegExp("^" + L + "*," + L + "*"), T = new RegExp("^" + L + "*([>+~]|" + L + ")" + L + "*"), U = new RegExp("=" + L + "*([^\\]'\"]*?)" + L + "*\\]", "g"), V = new RegExp(P), W = new RegExp("^" + N + "$"), X = {
            ID: new RegExp("^#(" + M + ")"),
            CLASS: new RegExp("^\\.(" + M + ")"),
            TAG: new RegExp("^(" + M.replace("w", "w*") + ")"),
            ATTR: new RegExp("^" + O),
            PSEUDO: new RegExp("^" + P),
            CHILD: new RegExp("^:(only|first|last|nth|nth-last)-(child|of-type)(?:\\(" + L + "*(even|odd|(([+-]|)(\\d*)n|)" + L + "*(?:([+-]|)" + L + "*(\\d+)|))" + L + "*\\)|)", "i"),
            bool: new RegExp("^(?:" + K + ")$", "i"),
            needsContext: new RegExp("^" + L + "*[>+~]|:(even|odd|eq|gt|lt|nth|first|last)(?:\\(" + L + "*((?:-\\d)?\\d*)" + L + "*\\)|)(?=[^-]|$)", "i")
        }, Y = /^(?:input|select|textarea|button)$/i, Z = /^h\d$/i, $ = /^[^{]+\{\s*\[native \w/, _ = /^(?:#([\w-]+)|(\w+)|\.([\w-]+))$/, aa = /[+~]/, ba = /'|\\/g, ca = new RegExp("\\\\([\\da-f]{1,6}" + L + "?|(" + L + ")|.)", "ig"), da = function(a, b, c) {
            var d = "0x" + b - 65536;
            return d !== d || c ? b : 0 > d ? String.fromCharCode(d + 65536) : String.fromCharCode(d >> 10 | 55296, 1023 & d | 56320);
        }, ea = function() {
            m();
        };
        try {
            H.apply(E = I.call(v.childNodes), v.childNodes), E[v.childNodes.length].nodeType;
        } catch (fa) {
            H = {
                apply: E.length ? function(a, b) {
                    G.apply(a, I.call(b));
                } : function(a, b) {
                    for (var c = a.length, d = 0; a[c++] = b[d++]; ) ;
                    a.length = c - 1;
                }
            };
        }
        c = ga.support = {}, f = ga.isXML = function(a) {
            var b = a && (a.ownerDocument || a).documentElement;
            return b ? "HTML" !== b.nodeName : !1;
        }, m = ga.setDocument = function(a) {
            var b, e, g = a ? a.ownerDocument || a : v;
            return g !== n && 9 === g.nodeType && g.documentElement ? (n = g, o = g.documentElement, 
            e = g.defaultView, e && e !== e.top && (e.addEventListener ? e.addEventListener("unload", ea, !1) : e.attachEvent && e.attachEvent("onunload", ea)), 
            p = !f(g), c.attributes = ja(function(a) {
                return a.className = "i", !a.getAttribute("className");
            }), c.getElementsByTagName = ja(function(a) {
                return a.appendChild(g.createComment("")), !a.getElementsByTagName("*").length;
            }), c.getElementsByClassName = $.test(g.getElementsByClassName), c.getById = ja(function(a) {
                return o.appendChild(a).id = u, !g.getElementsByName || !g.getElementsByName(u).length;
            }), c.getById ? (d.find.ID = function(a, b) {
                if ("undefined" != typeof b.getElementById && p) {
                    var c = b.getElementById(a);
                    return c && c.parentNode ? [ c ] : [];
                }
            }, d.filter.ID = function(a) {
                var b = a.replace(ca, da);
                return function(a) {
                    return a.getAttribute("id") === b;
                };
            }) : (delete d.find.ID, d.filter.ID = function(a) {
                var b = a.replace(ca, da);
                return function(a) {
                    var c = "undefined" != typeof a.getAttributeNode && a.getAttributeNode("id");
                    return c && c.value === b;
                };
            }), d.find.TAG = c.getElementsByTagName ? function(a, b) {
                return "undefined" != typeof b.getElementsByTagName ? b.getElementsByTagName(a) : c.qsa ? b.querySelectorAll(a) : void 0;
            } : function(a, b) {
                var c, d = [], e = 0, f = b.getElementsByTagName(a);
                if ("*" === a) {
                    for (;c = f[e++]; ) 1 === c.nodeType && d.push(c);
                    return d;
                }
                return f;
            }, d.find.CLASS = c.getElementsByClassName && function(a, b) {
                return p ? b.getElementsByClassName(a) : void 0;
            }, r = [], q = [], (c.qsa = $.test(g.querySelectorAll)) && (ja(function(a) {
                o.appendChild(a).innerHTML = "<a id='" + u + "'></a><select id='" + u + "-\f]' msallowcapture=''><option selected=''></option></select>", 
                a.querySelectorAll("[msallowcapture^='']").length && q.push("[*^$]=" + L + "*(?:''|\"\")"), 
                a.querySelectorAll("[selected]").length || q.push("\\[" + L + "*(?:value|" + K + ")"), 
                a.querySelectorAll("[id~=" + u + "-]").length || q.push("~="), a.querySelectorAll(":checked").length || q.push(":checked"), 
                a.querySelectorAll("a#" + u + "+*").length || q.push(".#.+[+~]");
            }), ja(function(a) {
                var b = g.createElement("input");
                b.setAttribute("type", "hidden"), a.appendChild(b).setAttribute("name", "D"), a.querySelectorAll("[name=d]").length && q.push("name" + L + "*[*^$|!~]?="), 
                a.querySelectorAll(":enabled").length || q.push(":enabled", ":disabled"), a.querySelectorAll("*,:x"), 
                q.push(",.*:");
            })), (c.matchesSelector = $.test(s = o.matches || o.webkitMatchesSelector || o.mozMatchesSelector || o.oMatchesSelector || o.msMatchesSelector)) && ja(function(a) {
                c.disconnectedMatch = s.call(a, "div"), s.call(a, "[s!='']:x"), r.push("!=", P);
            }), q = q.length && new RegExp(q.join("|")), r = r.length && new RegExp(r.join("|")), 
            b = $.test(o.compareDocumentPosition), t = b || $.test(o.contains) ? function(a, b) {
                var c = 9 === a.nodeType ? a.documentElement : a, d = b && b.parentNode;
                return a === d || !(!d || 1 !== d.nodeType || !(c.contains ? c.contains(d) : a.compareDocumentPosition && 16 & a.compareDocumentPosition(d)));
            } : function(a, b) {
                if (b) for (;b = b.parentNode; ) if (b === a) return !0;
                return !1;
            }, B = b ? function(a, b) {
                if (a === b) return l = !0, 0;
                var d = !a.compareDocumentPosition - !b.compareDocumentPosition;
                return d ? d : (d = (a.ownerDocument || a) === (b.ownerDocument || b) ? a.compareDocumentPosition(b) : 1, 
                1 & d || !c.sortDetached && b.compareDocumentPosition(a) === d ? a === g || a.ownerDocument === v && t(v, a) ? -1 : b === g || b.ownerDocument === v && t(v, b) ? 1 : k ? J(k, a) - J(k, b) : 0 : 4 & d ? -1 : 1);
            } : function(a, b) {
                if (a === b) return l = !0, 0;
                var c, d = 0, e = a.parentNode, f = b.parentNode, h = [ a ], i = [ b ];
                if (!e || !f) return a === g ? -1 : b === g ? 1 : e ? -1 : f ? 1 : k ? J(k, a) - J(k, b) : 0;
                if (e === f) return la(a, b);
                for (c = a; c = c.parentNode; ) h.unshift(c);
                for (c = b; c = c.parentNode; ) i.unshift(c);
                for (;h[d] === i[d]; ) d++;
                return d ? la(h[d], i[d]) : h[d] === v ? -1 : i[d] === v ? 1 : 0;
            }, g) : n;
        }, ga.matches = function(a, b) {
            return ga(a, null, null, b);
        }, ga.matchesSelector = function(a, b) {
            if ((a.ownerDocument || a) !== n && m(a), b = b.replace(U, "='$1']"), !(!c.matchesSelector || !p || r && r.test(b) || q && q.test(b))) try {
                var d = s.call(a, b);
                if (d || c.disconnectedMatch || a.document && 11 !== a.document.nodeType) return d;
            } catch (e) {}
            return ga(b, n, null, [ a ]).length > 0;
        }, ga.contains = function(a, b) {
            return (a.ownerDocument || a) !== n && m(a), t(a, b);
        }, ga.attr = function(a, b) {
            (a.ownerDocument || a) !== n && m(a);
            var e = d.attrHandle[b.toLowerCase()], f = e && D.call(d.attrHandle, b.toLowerCase()) ? e(a, b, !p) : void 0;
            return void 0 !== f ? f : c.attributes || !p ? a.getAttribute(b) : (f = a.getAttributeNode(b)) && f.specified ? f.value : null;
        }, ga.error = function(a) {
            throw new Error("Syntax error, unrecognized expression: " + a);
        }, ga.uniqueSort = function(a) {
            var b, d = [], e = 0, f = 0;
            if (l = !c.detectDuplicates, k = !c.sortStable && a.slice(0), a.sort(B), l) {
                for (;b = a[f++]; ) b === a[f] && (e = d.push(f));
                for (;e--; ) a.splice(d[e], 1);
            }
            return k = null, a;
        }, e = ga.getText = function(a) {
            var b, c = "", d = 0, f = a.nodeType;
            if (f) {
                if (1 === f || 9 === f || 11 === f) {
                    if ("string" == typeof a.textContent) return a.textContent;
                    for (a = a.firstChild; a; a = a.nextSibling) c += e(a);
                } else if (3 === f || 4 === f) return a.nodeValue;
            } else for (;b = a[d++]; ) c += e(b);
            return c;
        }, d = ga.selectors = {
            cacheLength: 50,
            createPseudo: ia,
            match: X,
            attrHandle: {},
            find: {},
            relative: {
                ">": {
                    dir: "parentNode",
                    first: !0
                },
                " ": {
                    dir: "parentNode"
                },
                "+": {
                    dir: "previousSibling",
                    first: !0
                },
                "~": {
                    dir: "previousSibling"
                }
            },
            preFilter: {
                ATTR: function(a) {
                    return a[1] = a[1].replace(ca, da), a[3] = (a[3] || a[4] || a[5] || "").replace(ca, da), 
                    "~=" === a[2] && (a[3] = " " + a[3] + " "), a.slice(0, 4);
                },
                CHILD: function(a) {
                    return a[1] = a[1].toLowerCase(), "nth" === a[1].slice(0, 3) ? (a[3] || ga.error(a[0]), 
                    a[4] = +(a[4] ? a[5] + (a[6] || 1) : 2 * ("even" === a[3] || "odd" === a[3])), a[5] = +(a[7] + a[8] || "odd" === a[3])) : a[3] && ga.error(a[0]), 
                    a;
                },
                PSEUDO: function(a) {
                    var b, c = !a[6] && a[2];
                    return X.CHILD.test(a[0]) ? null : (a[3] ? a[2] = a[4] || a[5] || "" : c && V.test(c) && (b = g(c, !0)) && (b = c.indexOf(")", c.length - b) - c.length) && (a[0] = a[0].slice(0, b), 
                    a[2] = c.slice(0, b)), a.slice(0, 3));
                }
            },
            filter: {
                TAG: function(a) {
                    var b = a.replace(ca, da).toLowerCase();
                    return "*" === a ? function() {
                        return !0;
                    } : function(a) {
                        return a.nodeName && a.nodeName.toLowerCase() === b;
                    };
                },
                CLASS: function(a) {
                    var b = y[a + " "];
                    return b || (b = new RegExp("(^|" + L + ")" + a + "(" + L + "|$)")) && y(a, function(a) {
                        return b.test("string" == typeof a.className && a.className || "undefined" != typeof a.getAttribute && a.getAttribute("class") || "");
                    });
                },
                ATTR: function(a, b, c) {
                    return function(d) {
                        var e = ga.attr(d, a);
                        return null == e ? "!=" === b : b ? (e += "", "=" === b ? e === c : "!=" === b ? e !== c : "^=" === b ? c && 0 === e.indexOf(c) : "*=" === b ? c && e.indexOf(c) > -1 : "$=" === b ? c && e.slice(-c.length) === c : "~=" === b ? (" " + e.replace(Q, " ") + " ").indexOf(c) > -1 : "|=" === b ? e === c || e.slice(0, c.length + 1) === c + "-" : !1) : !0;
                    };
                },
                CHILD: function(a, b, c, d, e) {
                    var f = "nth" !== a.slice(0, 3), g = "last" !== a.slice(-4), h = "of-type" === b;
                    return 1 === d && 0 === e ? function(a) {
                        return !!a.parentNode;
                    } : function(b, c, i) {
                        var j, k, l, m, n, o, p = f !== g ? "nextSibling" : "previousSibling", q = b.parentNode, r = h && b.nodeName.toLowerCase(), s = !i && !h;
                        if (q) {
                            if (f) {
                                for (;p; ) {
                                    for (l = b; l = l[p]; ) if (h ? l.nodeName.toLowerCase() === r : 1 === l.nodeType) return !1;
                                    o = p = "only" === a && !o && "nextSibling";
                                }
                                return !0;
                            }
                            if (o = [ g ? q.firstChild : q.lastChild ], g && s) {
                                for (k = q[u] || (q[u] = {}), j = k[a] || [], n = j[0] === w && j[1], m = j[0] === w && j[2], 
                                l = n && q.childNodes[n]; l = ++n && l && l[p] || (m = n = 0) || o.pop(); ) if (1 === l.nodeType && ++m && l === b) {
                                    k[a] = [ w, n, m ];
                                    break;
                                }
                            } else if (s && (j = (b[u] || (b[u] = {}))[a]) && j[0] === w) m = j[1]; else for (;(l = ++n && l && l[p] || (m = n = 0) || o.pop()) && ((h ? l.nodeName.toLowerCase() !== r : 1 !== l.nodeType) || !++m || (s && ((l[u] || (l[u] = {}))[a] = [ w, m ]), 
                            l !== b)); ) ;
                            return m -= e, m === d || m % d === 0 && m / d >= 0;
                        }
                    };
                },
                PSEUDO: function(a, b) {
                    var c, e = d.pseudos[a] || d.setFilters[a.toLowerCase()] || ga.error("unsupported pseudo: " + a);
                    return e[u] ? e(b) : e.length > 1 ? (c = [ a, a, "", b ], d.setFilters.hasOwnProperty(a.toLowerCase()) ? ia(function(a, c) {
                        for (var d, f = e(a, b), g = f.length; g--; ) d = J(a, f[g]), a[d] = !(c[d] = f[g]);
                    }) : function(a) {
                        return e(a, 0, c);
                    }) : e;
                }
            },
            pseudos: {
                not: ia(function(a) {
                    var b = [], c = [], d = h(a.replace(R, "$1"));
                    return d[u] ? ia(function(a, b, c, e) {
                        for (var f, g = d(a, null, e, []), h = a.length; h--; ) (f = g[h]) && (a[h] = !(b[h] = f));
                    }) : function(a, e, f) {
                        return b[0] = a, d(b, null, f, c), b[0] = null, !c.pop();
                    };
                }),
                has: ia(function(a) {
                    return function(b) {
                        return ga(a, b).length > 0;
                    };
                }),
                contains: ia(function(a) {
                    return a = a.replace(ca, da), function(b) {
                        return (b.textContent || b.innerText || e(b)).indexOf(a) > -1;
                    };
                }),
                lang: ia(function(a) {
                    return W.test(a || "") || ga.error("unsupported lang: " + a), a = a.replace(ca, da).toLowerCase(), 
                    function(b) {
                        var c;
                        do if (c = p ? b.lang : b.getAttribute("xml:lang") || b.getAttribute("lang")) return c = c.toLowerCase(), 
                        c === a || 0 === c.indexOf(a + "-"); while ((b = b.parentNode) && 1 === b.nodeType);
                        return !1;
                    };
                }),
                target: function(b) {
                    var c = a.location && a.location.hash;
                    return c && c.slice(1) === b.id;
                },
                root: function(a) {
                    return a === o;
                },
                focus: function(a) {
                    return a === n.activeElement && (!n.hasFocus || n.hasFocus()) && !!(a.type || a.href || ~a.tabIndex);
                },
                enabled: function(a) {
                    return a.disabled === !1;
                },
                disabled: function(a) {
                    return a.disabled === !0;
                },
                checked: function(a) {
                    var b = a.nodeName.toLowerCase();
                    return "input" === b && !!a.checked || "option" === b && !!a.selected;
                },
                selected: function(a) {
                    return a.parentNode && a.parentNode.selectedIndex, a.selected === !0;
                },
                empty: function(a) {
                    for (a = a.firstChild; a; a = a.nextSibling) if (a.nodeType < 6) return !1;
                    return !0;
                },
                parent: function(a) {
                    return !d.pseudos.empty(a);
                },
                header: function(a) {
                    return Z.test(a.nodeName);
                },
                input: function(a) {
                    return Y.test(a.nodeName);
                },
                button: function(a) {
                    var b = a.nodeName.toLowerCase();
                    return "input" === b && "button" === a.type || "button" === b;
                },
                text: function(a) {
                    var b;
                    return "input" === a.nodeName.toLowerCase() && "text" === a.type && (null == (b = a.getAttribute("type")) || "text" === b.toLowerCase());
                },
                first: oa(function() {
                    return [ 0 ];
                }),
                last: oa(function(a, b) {
                    return [ b - 1 ];
                }),
                eq: oa(function(a, b, c) {
                    return [ 0 > c ? c + b : c ];
                }),
                even: oa(function(a, b) {
                    for (var c = 0; b > c; c += 2) a.push(c);
                    return a;
                }),
                odd: oa(function(a, b) {
                    for (var c = 1; b > c; c += 2) a.push(c);
                    return a;
                }),
                lt: oa(function(a, b, c) {
                    for (var d = 0 > c ? c + b : c; --d >= 0; ) a.push(d);
                    return a;
                }),
                gt: oa(function(a, b, c) {
                    for (var d = 0 > c ? c + b : c; ++d < b; ) a.push(d);
                    return a;
                })
            }
        }, d.pseudos.nth = d.pseudos.eq;
        for (b in {
            radio: !0,
            checkbox: !0,
            file: !0,
            password: !0,
            image: !0
        }) d.pseudos[b] = ma(b);
        for (b in {
            submit: !0,
            reset: !0
        }) d.pseudos[b] = na(b);
        return qa.prototype = d.filters = d.pseudos, d.setFilters = new qa(), g = ga.tokenize = function(a, b) {
            var c, e, f, g, h, i, j, k = z[a + " "];
            if (k) return b ? 0 : k.slice(0);
            for (h = a, i = [], j = d.preFilter; h; ) {
                (!c || (e = S.exec(h))) && (e && (h = h.slice(e[0].length) || h), i.push(f = [])), 
                c = !1, (e = T.exec(h)) && (c = e.shift(), f.push({
                    value: c,
                    type: e[0].replace(R, " ")
                }), h = h.slice(c.length));
                for (g in d.filter) !(e = X[g].exec(h)) || j[g] && !(e = j[g](e)) || (c = e.shift(), 
                f.push({
                    value: c,
                    type: g,
                    matches: e
                }), h = h.slice(c.length));
                if (!c) break;
            }
            return b ? h.length : h ? ga.error(a) : z(a, i).slice(0);
        }, h = ga.compile = function(a, b) {
            var c, d = [], e = [], f = A[a + " "];
            if (!f) {
                for (b || (b = g(a)), c = b.length; c--; ) f = xa(b[c]), f[u] ? d.push(f) : e.push(f);
                f = A(a, ya(e, d)), f.selector = a;
            }
            return f;
        }, i = ga.select = function(a, b, e, f) {
            var i, j, k, l, m, n = "function" == typeof a && a, o = !f && g(a = n.selector || a);
            if (e = e || [], 1 === o.length) {
                if (j = o[0] = o[0].slice(0), j.length > 2 && "ID" === (k = j[0]).type && c.getById && 9 === b.nodeType && p && d.relative[j[1].type]) {
                    if (b = (d.find.ID(k.matches[0].replace(ca, da), b) || [])[0], !b) return e;
                    n && (b = b.parentNode), a = a.slice(j.shift().value.length);
                }
                for (i = X.needsContext.test(a) ? 0 : j.length; i-- && (k = j[i], !d.relative[l = k.type]); ) if ((m = d.find[l]) && (f = m(k.matches[0].replace(ca, da), aa.test(j[0].type) && pa(b.parentNode) || b))) {
                    if (j.splice(i, 1), a = f.length && ra(j), !a) return H.apply(e, f), e;
                    break;
                }
            }
            return (n || h(a, o))(f, b, !p, e, aa.test(a) && pa(b.parentNode) || b), e;
        }, c.sortStable = u.split("").sort(B).join("") === u, c.detectDuplicates = !!l, 
        m(), c.sortDetached = ja(function(a) {
            return 1 & a.compareDocumentPosition(n.createElement("div"));
        }), ja(function(a) {
            return a.innerHTML = "<a href='#'></a>", "#" === a.firstChild.getAttribute("href");
        }) || ka("type|href|height|width", function(a, b, c) {
            return c ? void 0 : a.getAttribute(b, "type" === b.toLowerCase() ? 1 : 2);
        }), c.attributes && ja(function(a) {
            return a.innerHTML = "<input/>", a.firstChild.setAttribute("value", ""), "" === a.firstChild.getAttribute("value");
        }) || ka("value", function(a, b, c) {
            return c || "input" !== a.nodeName.toLowerCase() ? void 0 : a.defaultValue;
        }), ja(function(a) {
            return null == a.getAttribute("disabled");
        }) || ka(K, function(a, b, c) {
            var d;
            return c ? void 0 : a[b] === !0 ? b.toLowerCase() : (d = a.getAttributeNode(b)) && d.specified ? d.value : null;
        }), ga;
    }(a);
    n.find = t, n.expr = t.selectors, n.expr[":"] = n.expr.pseudos, n.unique = t.uniqueSort, 
    n.text = t.getText, n.isXMLDoc = t.isXML, n.contains = t.contains;
    var u = n.expr.match.needsContext, v = /^<(\w+)\s*\/?>(?:<\/\1>|)$/, w = /^.[^:#\[\.,]*$/;
    n.filter = function(a, b, c) {
        var d = b[0];
        return c && (a = ":not(" + a + ")"), 1 === b.length && 1 === d.nodeType ? n.find.matchesSelector(d, a) ? [ d ] : [] : n.find.matches(a, n.grep(b, function(a) {
            return 1 === a.nodeType;
        }));
    }, n.fn.extend({
        find: function(a) {
            var b, c = this.length, d = [], e = this;
            if ("string" != typeof a) return this.pushStack(n(a).filter(function() {
                for (b = 0; c > b; b++) if (n.contains(e[b], this)) return !0;
            }));
            for (b = 0; c > b; b++) n.find(a, e[b], d);
            return d = this.pushStack(c > 1 ? n.unique(d) : d), d.selector = this.selector ? this.selector + " " + a : a, 
            d;
        },
        filter: function(a) {
            return this.pushStack(x(this, a || [], !1));
        },
        not: function(a) {
            return this.pushStack(x(this, a || [], !0));
        },
        is: function(a) {
            return !!x(this, "string" == typeof a && u.test(a) ? n(a) : a || [], !1).length;
        }
    });
    var y, z = /^(?:\s*(<[\w\W]+>)[^>]*|#([\w-]*))$/, A = n.fn.init = function(a, b) {
        var c, d;
        if (!a) return this;
        if ("string" == typeof a) {
            if (c = "<" === a[0] && ">" === a[a.length - 1] && a.length >= 3 ? [ null, a, null ] : z.exec(a), 
            !c || !c[1] && b) return !b || b.jquery ? (b || y).find(a) : this.constructor(b).find(a);
            if (c[1]) {
                if (b = b instanceof n ? b[0] : b, n.merge(this, n.parseHTML(c[1], b && b.nodeType ? b.ownerDocument || b : l, !0)), 
                v.test(c[1]) && n.isPlainObject(b)) for (c in b) n.isFunction(this[c]) ? this[c](b[c]) : this.attr(c, b[c]);
                return this;
            }
            return d = l.getElementById(c[2]), d && d.parentNode && (this.length = 1, this[0] = d), 
            this.context = l, this.selector = a, this;
        }
        return a.nodeType ? (this.context = this[0] = a, this.length = 1, this) : n.isFunction(a) ? "undefined" != typeof y.ready ? y.ready(a) : a(n) : (void 0 !== a.selector && (this.selector = a.selector, 
        this.context = a.context), n.makeArray(a, this));
    };
    A.prototype = n.fn, y = n(l);
    var B = /^(?:parents|prev(?:Until|All))/, C = {
        children: !0,
        contents: !0,
        next: !0,
        prev: !0
    };
    n.extend({
        dir: function(a, b, c) {
            for (var d = [], e = void 0 !== c; (a = a[b]) && 9 !== a.nodeType; ) if (1 === a.nodeType) {
                if (e && n(a).is(c)) break;
                d.push(a);
            }
            return d;
        },
        sibling: function(a, b) {
            for (var c = []; a; a = a.nextSibling) 1 === a.nodeType && a !== b && c.push(a);
            return c;
        }
    }), n.fn.extend({
        has: function(a) {
            var b = n(a, this), c = b.length;
            return this.filter(function() {
                for (var a = 0; c > a; a++) if (n.contains(this, b[a])) return !0;
            });
        },
        closest: function(a, b) {
            for (var c, d = 0, e = this.length, f = [], g = u.test(a) || "string" != typeof a ? n(a, b || this.context) : 0; e > d; d++) for (c = this[d]; c && c !== b; c = c.parentNode) if (c.nodeType < 11 && (g ? g.index(c) > -1 : 1 === c.nodeType && n.find.matchesSelector(c, a))) {
                f.push(c);
                break;
            }
            return this.pushStack(f.length > 1 ? n.unique(f) : f);
        },
        index: function(a) {
            return a ? "string" == typeof a ? g.call(n(a), this[0]) : g.call(this, a.jquery ? a[0] : a) : this[0] && this[0].parentNode ? this.first().prevAll().length : -1;
        },
        add: function(a, b) {
            return this.pushStack(n.unique(n.merge(this.get(), n(a, b))));
        },
        addBack: function(a) {
            return this.add(null == a ? this.prevObject : this.prevObject.filter(a));
        }
    }), n.each({
        parent: function(a) {
            var b = a.parentNode;
            return b && 11 !== b.nodeType ? b : null;
        },
        parents: function(a) {
            return n.dir(a, "parentNode");
        },
        parentsUntil: function(a, b, c) {
            return n.dir(a, "parentNode", c);
        },
        next: function(a) {
            return D(a, "nextSibling");
        },
        prev: function(a) {
            return D(a, "previousSibling");
        },
        nextAll: function(a) {
            return n.dir(a, "nextSibling");
        },
        prevAll: function(a) {
            return n.dir(a, "previousSibling");
        },
        nextUntil: function(a, b, c) {
            return n.dir(a, "nextSibling", c);
        },
        prevUntil: function(a, b, c) {
            return n.dir(a, "previousSibling", c);
        },
        siblings: function(a) {
            return n.sibling((a.parentNode || {}).firstChild, a);
        },
        children: function(a) {
            return n.sibling(a.firstChild);
        },
        contents: function(a) {
            return a.contentDocument || n.merge([], a.childNodes);
        }
    }, function(a, b) {
        n.fn[a] = function(c, d) {
            var e = n.map(this, b, c);
            return "Until" !== a.slice(-5) && (d = c), d && "string" == typeof d && (e = n.filter(d, e)), 
            this.length > 1 && (C[a] || n.unique(e), B.test(a) && e.reverse()), this.pushStack(e);
        };
    });
    var E = /\S+/g, F = {};
    n.Callbacks = function(a) {
        a = "string" == typeof a ? F[a] || G(a) : n.extend({}, a);
        var b, c, d, e, f, g, h = [], i = !a.once && [], j = function(l) {
            for (b = a.memory && l, c = !0, g = e || 0, e = 0, f = h.length, d = !0; h && f > g; g++) if (h[g].apply(l[0], l[1]) === !1 && a.stopOnFalse) {
                b = !1;
                break;
            }
            d = !1, h && (i ? i.length && j(i.shift()) : b ? h = [] : k.disable());
        }, k = {
            add: function() {
                if (h) {
                    var c = h.length;
                    !function g(b) {
                        n.each(b, function(b, c) {
                            var d = n.type(c);
                            "function" === d ? a.unique && k.has(c) || h.push(c) : c && c.length && "string" !== d && g(c);
                        });
                    }(arguments), d ? f = h.length : b && (e = c, j(b));
                }
                return this;
            },
            remove: function() {
                return h && n.each(arguments, function(a, b) {
                    for (var c; (c = n.inArray(b, h, c)) > -1; ) h.splice(c, 1), d && (f >= c && f--, 
                    g >= c && g--);
                }), this;
            },
            has: function(a) {
                return a ? n.inArray(a, h) > -1 : !(!h || !h.length);
            },
            empty: function() {
                return h = [], f = 0, this;
            },
            disable: function() {
                return h = i = b = void 0, this;
            },
            disabled: function() {
                return !h;
            },
            lock: function() {
                return i = void 0, b || k.disable(), this;
            },
            locked: function() {
                return !i;
            },
            fireWith: function(a, b) {
                return !h || c && !i || (b = b || [], b = [ a, b.slice ? b.slice() : b ], d ? i.push(b) : j(b)), 
                this;
            },
            fire: function() {
                return k.fireWith(this, arguments), this;
            },
            fired: function() {
                return !!c;
            }
        };
        return k;
    }, n.extend({
        Deferred: function(a) {
            var b = [ [ "resolve", "done", n.Callbacks("once memory"), "resolved" ], [ "reject", "fail", n.Callbacks("once memory"), "rejected" ], [ "notify", "progress", n.Callbacks("memory") ] ], c = "pending", d = {
                state: function() {
                    return c;
                },
                always: function() {
                    return e.done(arguments).fail(arguments), this;
                },
                then: function() {
                    var a = arguments;
                    return n.Deferred(function(c) {
                        n.each(b, function(b, f) {
                            var g = n.isFunction(a[b]) && a[b];
                            e[f[1]](function() {
                                var a = g && g.apply(this, arguments);
                                a && n.isFunction(a.promise) ? a.promise().done(c.resolve).fail(c.reject).progress(c.notify) : c[f[0] + "With"](this === d ? c.promise() : this, g ? [ a ] : arguments);
                            });
                        }), a = null;
                    }).promise();
                },
                promise: function(a) {
                    return null != a ? n.extend(a, d) : d;
                }
            }, e = {};
            return d.pipe = d.then, n.each(b, function(a, f) {
                var g = f[2], h = f[3];
                d[f[1]] = g.add, h && g.add(function() {
                    c = h;
                }, b[1 ^ a][2].disable, b[2][2].lock), e[f[0]] = function() {
                    return e[f[0] + "With"](this === e ? d : this, arguments), this;
                }, e[f[0] + "With"] = g.fireWith;
            }), d.promise(e), a && a.call(e, e), e;
        },
        when: function(a) {
            var i, j, k, b = 0, c = d.call(arguments), e = c.length, f = 1 !== e || a && n.isFunction(a.promise) ? e : 0, g = 1 === f ? a : n.Deferred(), h = function(a, b, c) {
                return function(e) {
                    b[a] = this, c[a] = arguments.length > 1 ? d.call(arguments) : e, c === i ? g.notifyWith(b, c) : --f || g.resolveWith(b, c);
                };
            };
            if (e > 1) for (i = new Array(e), j = new Array(e), k = new Array(e); e > b; b++) c[b] && n.isFunction(c[b].promise) ? c[b].promise().done(h(b, k, c)).fail(g.reject).progress(h(b, j, i)) : --f;
            return f || g.resolveWith(k, c), g.promise();
        }
    });
    var H;
    n.fn.ready = function(a) {
        return n.ready.promise().done(a), this;
    }, n.extend({
        isReady: !1,
        readyWait: 1,
        holdReady: function(a) {
            a ? n.readyWait++ : n.ready(!0);
        },
        ready: function(a) {
            (a === !0 ? --n.readyWait : n.isReady) || (n.isReady = !0, a !== !0 && --n.readyWait > 0 || (H.resolveWith(l, [ n ]), 
            n.fn.triggerHandler && (n(l).triggerHandler("ready"), n(l).off("ready"))));
        }
    }), n.ready.promise = function(b) {
        return H || (H = n.Deferred(), "complete" === l.readyState ? setTimeout(n.ready) : (l.addEventListener("DOMContentLoaded", I, !1), 
        a.addEventListener("load", I, !1))), H.promise(b);
    }, n.ready.promise();
    var J = n.access = function(a, b, c, d, e, f, g) {
        var h = 0, i = a.length, j = null == c;
        if ("object" === n.type(c)) {
            e = !0;
            for (h in c) n.access(a, b, h, c[h], !0, f, g);
        } else if (void 0 !== d && (e = !0, n.isFunction(d) || (g = !0), j && (g ? (b.call(a, d), 
        b = null) : (j = b, b = function(a, b, c) {
            return j.call(n(a), c);
        })), b)) for (;i > h; h++) b(a[h], c, g ? d : d.call(a[h], h, b(a[h], c)));
        return e ? a : j ? b.call(a) : i ? b(a[0], c) : f;
    };
    n.acceptData = function(a) {
        return 1 === a.nodeType || 9 === a.nodeType || !+a.nodeType;
    }, K.uid = 1, K.accepts = n.acceptData, K.prototype = {
        key: function(a) {
            if (!K.accepts(a)) return 0;
            var b = {}, c = a[this.expando];
            if (!c) {
                c = K.uid++;
                try {
                    b[this.expando] = {
                        value: c
                    }, Object.defineProperties(a, b);
                } catch (d) {
                    b[this.expando] = c, n.extend(a, b);
                }
            }
            return this.cache[c] || (this.cache[c] = {}), c;
        },
        set: function(a, b, c) {
            var d, e = this.key(a), f = this.cache[e];
            if ("string" == typeof b) f[b] = c; else if (n.isEmptyObject(f)) n.extend(this.cache[e], b); else for (d in b) f[d] = b[d];
            return f;
        },
        get: function(a, b) {
            var c = this.cache[this.key(a)];
            return void 0 === b ? c : c[b];
        },
        access: function(a, b, c) {
            var d;
            return void 0 === b || b && "string" == typeof b && void 0 === c ? (d = this.get(a, b), 
            void 0 !== d ? d : this.get(a, n.camelCase(b))) : (this.set(a, b, c), void 0 !== c ? c : b);
        },
        remove: function(a, b) {
            var c, d, e, f = this.key(a), g = this.cache[f];
            if (void 0 === b) this.cache[f] = {}; else {
                n.isArray(b) ? d = b.concat(b.map(n.camelCase)) : (e = n.camelCase(b), b in g ? d = [ b, e ] : (d = e, 
                d = d in g ? [ d ] : d.match(E) || [])), c = d.length;
                for (;c--; ) delete g[d[c]];
            }
        },
        hasData: function(a) {
            return !n.isEmptyObject(this.cache[a[this.expando]] || {});
        },
        discard: function(a) {
            a[this.expando] && delete this.cache[a[this.expando]];
        }
    };
    var L = new K(), M = new K(), N = /^(?:\{[\w\W]*\}|\[[\w\W]*\])$/, O = /([A-Z])/g;
    n.extend({
        hasData: function(a) {
            return M.hasData(a) || L.hasData(a);
        },
        data: function(a, b, c) {
            return M.access(a, b, c);
        },
        removeData: function(a, b) {
            M.remove(a, b);
        },
        _data: function(a, b, c) {
            return L.access(a, b, c);
        },
        _removeData: function(a, b) {
            L.remove(a, b);
        }
    }), n.fn.extend({
        data: function(a, b) {
            var c, d, e, f = this[0], g = f && f.attributes;
            if (void 0 === a) {
                if (this.length && (e = M.get(f), 1 === f.nodeType && !L.get(f, "hasDataAttrs"))) {
                    for (c = g.length; c--; ) g[c] && (d = g[c].name, 0 === d.indexOf("data-") && (d = n.camelCase(d.slice(5)), 
                    P(f, d, e[d])));
                    L.set(f, "hasDataAttrs", !0);
                }
                return e;
            }
            return "object" == typeof a ? this.each(function() {
                M.set(this, a);
            }) : J(this, function(b) {
                var c, d = n.camelCase(a);
                if (f && void 0 === b) {
                    if (c = M.get(f, a), void 0 !== c) return c;
                    if (c = M.get(f, d), void 0 !== c) return c;
                    if (c = P(f, d, void 0), void 0 !== c) return c;
                } else this.each(function() {
                    var c = M.get(this, d);
                    M.set(this, d, b), -1 !== a.indexOf("-") && void 0 !== c && M.set(this, a, b);
                });
            }, null, b, arguments.length > 1, null, !0);
        },
        removeData: function(a) {
            return this.each(function() {
                M.remove(this, a);
            });
        }
    }), n.extend({
        queue: function(a, b, c) {
            var d;
            return a ? (b = (b || "fx") + "queue", d = L.get(a, b), c && (!d || n.isArray(c) ? d = L.access(a, b, n.makeArray(c)) : d.push(c)), 
            d || []) : void 0;
        },
        dequeue: function(a, b) {
            b = b || "fx";
            var c = n.queue(a, b), d = c.length, e = c.shift(), f = n._queueHooks(a, b), g = function() {
                n.dequeue(a, b);
            };
            "inprogress" === e && (e = c.shift(), d--), e && ("fx" === b && c.unshift("inprogress"), 
            delete f.stop, e.call(a, g, f)), !d && f && f.empty.fire();
        },
        _queueHooks: function(a, b) {
            var c = b + "queueHooks";
            return L.get(a, c) || L.access(a, c, {
                empty: n.Callbacks("once memory").add(function() {
                    L.remove(a, [ b + "queue", c ]);
                })
            });
        }
    }), n.fn.extend({
        queue: function(a, b) {
            var c = 2;
            return "string" != typeof a && (b = a, a = "fx", c--), arguments.length < c ? n.queue(this[0], a) : void 0 === b ? this : this.each(function() {
                var c = n.queue(this, a, b);
                n._queueHooks(this, a), "fx" === a && "inprogress" !== c[0] && n.dequeue(this, a);
            });
        },
        dequeue: function(a) {
            return this.each(function() {
                n.dequeue(this, a);
            });
        },
        clearQueue: function(a) {
            return this.queue(a || "fx", []);
        },
        promise: function(a, b) {
            var c, d = 1, e = n.Deferred(), f = this, g = this.length, h = function() {
                --d || e.resolveWith(f, [ f ]);
            };
            for ("string" != typeof a && (b = a, a = void 0), a = a || "fx"; g--; ) c = L.get(f[g], a + "queueHooks"), 
            c && c.empty && (d++, c.empty.add(h));
            return h(), e.promise(b);
        }
    });
    var Q = /[+-]?(?:\d*\.|)\d+(?:[eE][+-]?\d+|)/.source, R = [ "Top", "Right", "Bottom", "Left" ], S = function(a, b) {
        return a = b || a, "none" === n.css(a, "display") || !n.contains(a.ownerDocument, a);
    }, T = /^(?:checkbox|radio)$/i;
    !function() {
        var a = l.createDocumentFragment(), b = a.appendChild(l.createElement("div")), c = l.createElement("input");
        c.setAttribute("type", "radio"), c.setAttribute("checked", "checked"), c.setAttribute("name", "t"), 
        b.appendChild(c), k.checkClone = b.cloneNode(!0).cloneNode(!0).lastChild.checked, 
        b.innerHTML = "<textarea>x</textarea>", k.noCloneChecked = !!b.cloneNode(!0).lastChild.defaultValue;
    }();
    var U = "undefined";
    k.focusinBubbles = "onfocusin" in a;
    var V = /^key/, W = /^(?:mouse|pointer|contextmenu)|click/, X = /^(?:focusinfocus|focusoutblur)$/, Y = /^([^.]*)(?:\.(.+)|)$/;
    n.event = {
        global: {},
        add: function(a, b, c, d, e) {
            var f, g, h, i, j, k, l, m, o, p, q, r = L.get(a);
            if (r) for (c.handler && (f = c, c = f.handler, e = f.selector), c.guid || (c.guid = n.guid++), 
            (i = r.events) || (i = r.events = {}), (g = r.handle) || (g = r.handle = function(b) {
                return typeof n !== U && n.event.triggered !== b.type ? n.event.dispatch.apply(a, arguments) : void 0;
            }), b = (b || "").match(E) || [ "" ], j = b.length; j--; ) h = Y.exec(b[j]) || [], 
            o = q = h[1], p = (h[2] || "").split(".").sort(), o && (l = n.event.special[o] || {}, 
            o = (e ? l.delegateType : l.bindType) || o, l = n.event.special[o] || {}, k = n.extend({
                type: o,
                origType: q,
                data: d,
                handler: c,
                guid: c.guid,
                selector: e,
                needsContext: e && n.expr.match.needsContext.test(e),
                namespace: p.join(".")
            }, f), (m = i[o]) || (m = i[o] = [], m.delegateCount = 0, l.setup && l.setup.call(a, d, p, g) !== !1 || a.addEventListener && a.addEventListener(o, g, !1)), 
            l.add && (l.add.call(a, k), k.handler.guid || (k.handler.guid = c.guid)), e ? m.splice(m.delegateCount++, 0, k) : m.push(k), 
            n.event.global[o] = !0);
        },
        remove: function(a, b, c, d, e) {
            var f, g, h, i, j, k, l, m, o, p, q, r = L.hasData(a) && L.get(a);
            if (r && (i = r.events)) {
                for (b = (b || "").match(E) || [ "" ], j = b.length; j--; ) if (h = Y.exec(b[j]) || [], 
                o = q = h[1], p = (h[2] || "").split(".").sort(), o) {
                    for (l = n.event.special[o] || {}, o = (d ? l.delegateType : l.bindType) || o, m = i[o] || [], 
                    h = h[2] && new RegExp("(^|\\.)" + p.join("\\.(?:.*\\.|)") + "(\\.|$)"), g = f = m.length; f--; ) k = m[f], 
                    !e && q !== k.origType || c && c.guid !== k.guid || h && !h.test(k.namespace) || d && d !== k.selector && ("**" !== d || !k.selector) || (m.splice(f, 1), 
                    k.selector && m.delegateCount--, l.remove && l.remove.call(a, k));
                    g && !m.length && (l.teardown && l.teardown.call(a, p, r.handle) !== !1 || n.removeEvent(a, o, r.handle), 
                    delete i[o]);
                } else for (o in i) n.event.remove(a, o + b[j], c, d, !0);
                n.isEmptyObject(i) && (delete r.handle, L.remove(a, "events"));
            }
        },
        trigger: function(b, c, d, e) {
            var f, g, h, i, k, m, o, p = [ d || l ], q = j.call(b, "type") ? b.type : b, r = j.call(b, "namespace") ? b.namespace.split(".") : [];
            if (g = h = d = d || l, 3 !== d.nodeType && 8 !== d.nodeType && !X.test(q + n.event.triggered) && (q.indexOf(".") >= 0 && (r = q.split("."), 
            q = r.shift(), r.sort()), k = q.indexOf(":") < 0 && "on" + q, b = b[n.expando] ? b : new n.Event(q, "object" == typeof b && b), 
            b.isTrigger = e ? 2 : 3, b.namespace = r.join("."), b.namespace_re = b.namespace ? new RegExp("(^|\\.)" + r.join("\\.(?:.*\\.|)") + "(\\.|$)") : null, 
            b.result = void 0, b.target || (b.target = d), c = null == c ? [ b ] : n.makeArray(c, [ b ]), 
            o = n.event.special[q] || {}, e || !o.trigger || o.trigger.apply(d, c) !== !1)) {
                if (!e && !o.noBubble && !n.isWindow(d)) {
                    for (i = o.delegateType || q, X.test(i + q) || (g = g.parentNode); g; g = g.parentNode) p.push(g), 
                    h = g;
                    h === (d.ownerDocument || l) && p.push(h.defaultView || h.parentWindow || a);
                }
                for (f = 0; (g = p[f++]) && !b.isPropagationStopped(); ) b.type = f > 1 ? i : o.bindType || q, 
                m = (L.get(g, "events") || {})[b.type] && L.get(g, "handle"), m && m.apply(g, c), 
                m = k && g[k], m && m.apply && n.acceptData(g) && (b.result = m.apply(g, c), b.result === !1 && b.preventDefault());
                return b.type = q, e || b.isDefaultPrevented() || o._default && o._default.apply(p.pop(), c) !== !1 || !n.acceptData(d) || k && n.isFunction(d[q]) && !n.isWindow(d) && (h = d[k], 
                h && (d[k] = null), n.event.triggered = q, d[q](), n.event.triggered = void 0, h && (d[k] = h)), 
                b.result;
            }
        },
        dispatch: function(a) {
            a = n.event.fix(a);
            var b, c, e, f, g, h = [], i = d.call(arguments), j = (L.get(this, "events") || {})[a.type] || [], k = n.event.special[a.type] || {};
            if (i[0] = a, a.delegateTarget = this, !k.preDispatch || k.preDispatch.call(this, a) !== !1) {
                for (h = n.event.handlers.call(this, a, j), b = 0; (f = h[b++]) && !a.isPropagationStopped(); ) for (a.currentTarget = f.elem, 
                c = 0; (g = f.handlers[c++]) && !a.isImmediatePropagationStopped(); ) (!a.namespace_re || a.namespace_re.test(g.namespace)) && (a.handleObj = g, 
                a.data = g.data, e = ((n.event.special[g.origType] || {}).handle || g.handler).apply(f.elem, i), 
                void 0 !== e && (a.result = e) === !1 && (a.preventDefault(), a.stopPropagation()));
                return k.postDispatch && k.postDispatch.call(this, a), a.result;
            }
        },
        handlers: function(a, b) {
            var c, d, e, f, g = [], h = b.delegateCount, i = a.target;
            if (h && i.nodeType && (!a.button || "click" !== a.type)) for (;i !== this; i = i.parentNode || this) if (i.disabled !== !0 || "click" !== a.type) {
                for (d = [], c = 0; h > c; c++) f = b[c], e = f.selector + " ", void 0 === d[e] && (d[e] = f.needsContext ? n(e, this).index(i) >= 0 : n.find(e, this, null, [ i ]).length), 
                d[e] && d.push(f);
                d.length && g.push({
                    elem: i,
                    handlers: d
                });
            }
            return h < b.length && g.push({
                elem: this,
                handlers: b.slice(h)
            }), g;
        },
        props: "altKey bubbles cancelable ctrlKey currentTarget eventPhase metaKey relatedTarget shiftKey target timeStamp view which".split(" "),
        fixHooks: {},
        keyHooks: {
            props: "char charCode key keyCode".split(" "),
            filter: function(a, b) {
                return null == a.which && (a.which = null != b.charCode ? b.charCode : b.keyCode), 
                a;
            }
        },
        mouseHooks: {
            props: "button buttons clientX clientY offsetX offsetY pageX pageY screenX screenY toElement".split(" "),
            filter: function(a, b) {
                var c, d, e, f = b.button;
                return null == a.pageX && null != b.clientX && (c = a.target.ownerDocument || l, 
                d = c.documentElement, e = c.body, a.pageX = b.clientX + (d && d.scrollLeft || e && e.scrollLeft || 0) - (d && d.clientLeft || e && e.clientLeft || 0), 
                a.pageY = b.clientY + (d && d.scrollTop || e && e.scrollTop || 0) - (d && d.clientTop || e && e.clientTop || 0)), 
                a.which || void 0 === f || (a.which = 1 & f ? 1 : 2 & f ? 3 : 4 & f ? 2 : 0), a;
            }
        },
        fix: function(a) {
            if (a[n.expando]) return a;
            var b, c, d, e = a.type, f = a, g = this.fixHooks[e];
            for (g || (this.fixHooks[e] = g = W.test(e) ? this.mouseHooks : V.test(e) ? this.keyHooks : {}), 
            d = g.props ? this.props.concat(g.props) : this.props, a = new n.Event(f), b = d.length; b--; ) c = d[b], 
            a[c] = f[c];
            return a.target || (a.target = l), 3 === a.target.nodeType && (a.target = a.target.parentNode), 
            g.filter ? g.filter(a, f) : a;
        },
        special: {
            load: {
                noBubble: !0
            },
            focus: {
                trigger: function() {
                    return this !== _() && this.focus ? (this.focus(), !1) : void 0;
                },
                delegateType: "focusin"
            },
            blur: {
                trigger: function() {
                    return this === _() && this.blur ? (this.blur(), !1) : void 0;
                },
                delegateType: "focusout"
            },
            click: {
                trigger: function() {
                    return "checkbox" === this.type && this.click && n.nodeName(this, "input") ? (this.click(), 
                    !1) : void 0;
                },
                _default: function(a) {
                    return n.nodeName(a.target, "a");
                }
            },
            beforeunload: {
                postDispatch: function(a) {
                    void 0 !== a.result && a.originalEvent && (a.originalEvent.returnValue = a.result);
                }
            }
        },
        simulate: function(a, b, c, d) {
            var e = n.extend(new n.Event(), c, {
                type: a,
                isSimulated: !0,
                originalEvent: {}
            });
            d ? n.event.trigger(e, null, b) : n.event.dispatch.call(b, e), e.isDefaultPrevented() && c.preventDefault();
        }
    }, n.removeEvent = function(a, b, c) {
        a.removeEventListener && a.removeEventListener(b, c, !1);
    }, n.Event = function(a, b) {
        return this instanceof n.Event ? (a && a.type ? (this.originalEvent = a, this.type = a.type, 
        this.isDefaultPrevented = a.defaultPrevented || void 0 === a.defaultPrevented && a.returnValue === !1 ? Z : $) : this.type = a, 
        b && n.extend(this, b), this.timeStamp = a && a.timeStamp || n.now(), void (this[n.expando] = !0)) : new n.Event(a, b);
    }, n.Event.prototype = {
        isDefaultPrevented: $,
        isPropagationStopped: $,
        isImmediatePropagationStopped: $,
        preventDefault: function() {
            var a = this.originalEvent;
            this.isDefaultPrevented = Z, a && a.preventDefault && a.preventDefault();
        },
        stopPropagation: function() {
            var a = this.originalEvent;
            this.isPropagationStopped = Z, a && a.stopPropagation && a.stopPropagation();
        },
        stopImmediatePropagation: function() {
            var a = this.originalEvent;
            this.isImmediatePropagationStopped = Z, a && a.stopImmediatePropagation && a.stopImmediatePropagation(), 
            this.stopPropagation();
        }
    }, n.each({
        mouseenter: "mouseover",
        mouseleave: "mouseout",
        pointerenter: "pointerover",
        pointerleave: "pointerout"
    }, function(a, b) {
        n.event.special[a] = {
            delegateType: b,
            bindType: b,
            handle: function(a) {
                var c, d = this, e = a.relatedTarget, f = a.handleObj;
                return (!e || e !== d && !n.contains(d, e)) && (a.type = f.origType, c = f.handler.apply(this, arguments), 
                a.type = b), c;
            }
        };
    }), k.focusinBubbles || n.each({
        focus: "focusin",
        blur: "focusout"
    }, function(a, b) {
        var c = function(a) {
            n.event.simulate(b, a.target, n.event.fix(a), !0);
        };
        n.event.special[b] = {
            setup: function() {
                var d = this.ownerDocument || this, e = L.access(d, b);
                e || d.addEventListener(a, c, !0), L.access(d, b, (e || 0) + 1);
            },
            teardown: function() {
                var d = this.ownerDocument || this, e = L.access(d, b) - 1;
                e ? L.access(d, b, e) : (d.removeEventListener(a, c, !0), L.remove(d, b));
            }
        };
    }), n.fn.extend({
        on: function(a, b, c, d, e) {
            var f, g;
            if ("object" == typeof a) {
                "string" != typeof b && (c = c || b, b = void 0);
                for (g in a) this.on(g, b, c, a[g], e);
                return this;
            }
            if (null == c && null == d ? (d = b, c = b = void 0) : null == d && ("string" == typeof b ? (d = c, 
            c = void 0) : (d = c, c = b, b = void 0)), d === !1) d = $; else if (!d) return this;
            return 1 === e && (f = d, d = function(a) {
                return n().off(a), f.apply(this, arguments);
            }, d.guid = f.guid || (f.guid = n.guid++)), this.each(function() {
                n.event.add(this, a, d, c, b);
            });
        },
        one: function(a, b, c, d) {
            return this.on(a, b, c, d, 1);
        },
        off: function(a, b, c) {
            var d, e;
            if (a && a.preventDefault && a.handleObj) return d = a.handleObj, n(a.delegateTarget).off(d.namespace ? d.origType + "." + d.namespace : d.origType, d.selector, d.handler), 
            this;
            if ("object" == typeof a) {
                for (e in a) this.off(e, b, a[e]);
                return this;
            }
            return (b === !1 || "function" == typeof b) && (c = b, b = void 0), c === !1 && (c = $), 
            this.each(function() {
                n.event.remove(this, a, c, b);
            });
        },
        trigger: function(a, b) {
            return this.each(function() {
                n.event.trigger(a, b, this);
            });
        },
        triggerHandler: function(a, b) {
            var c = this[0];
            return c ? n.event.trigger(a, b, c, !0) : void 0;
        }
    });
    var aa = /<(?!area|br|col|embed|hr|img|input|link|meta|param)(([\w:]+)[^>]*)\/>/gi, ba = /<([\w:]+)/, ca = /<|&#?\w+;/, da = /<(?:script|style|link)/i, ea = /checked\s*(?:[^=]|=\s*.checked.)/i, fa = /^$|\/(?:java|ecma)script/i, ga = /^true\/(.*)/, ha = /^\s*<!(?:\[CDATA\[|--)|(?:\]\]|--)>\s*$/g, ia = {
        option: [ 1, "<select multiple='multiple'>", "</select>" ],
        thead: [ 1, "<table>", "</table>" ],
        col: [ 2, "<table><colgroup>", "</colgroup></table>" ],
        tr: [ 2, "<table><tbody>", "</tbody></table>" ],
        td: [ 3, "<table><tbody><tr>", "</tr></tbody></table>" ],
        _default: [ 0, "", "" ]
    };
    ia.optgroup = ia.option, ia.tbody = ia.tfoot = ia.colgroup = ia.caption = ia.thead, 
    ia.th = ia.td, n.extend({
        clone: function(a, b, c) {
            var d, e, f, g, h = a.cloneNode(!0), i = n.contains(a.ownerDocument, a);
            if (!(k.noCloneChecked || 1 !== a.nodeType && 11 !== a.nodeType || n.isXMLDoc(a))) for (g = oa(h), 
            f = oa(a), d = 0, e = f.length; e > d; d++) pa(f[d], g[d]);
            if (b) if (c) for (f = f || oa(a), g = g || oa(h), d = 0, e = f.length; e > d; d++) na(f[d], g[d]); else na(a, h);
            return g = oa(h, "script"), g.length > 0 && ma(g, !i && oa(a, "script")), h;
        },
        buildFragment: function(a, b, c, d) {
            for (var e, f, g, h, i, j, k = b.createDocumentFragment(), l = [], m = 0, o = a.length; o > m; m++) if (e = a[m], 
            e || 0 === e) if ("object" === n.type(e)) n.merge(l, e.nodeType ? [ e ] : e); else if (ca.test(e)) {
                for (f = f || k.appendChild(b.createElement("div")), g = (ba.exec(e) || [ "", "" ])[1].toLowerCase(), 
                h = ia[g] || ia._default, f.innerHTML = h[1] + e.replace(aa, "<$1></$2>") + h[2], 
                j = h[0]; j--; ) f = f.lastChild;
                n.merge(l, f.childNodes), f = k.firstChild, f.textContent = "";
            } else l.push(b.createTextNode(e));
            for (k.textContent = "", m = 0; e = l[m++]; ) if ((!d || -1 === n.inArray(e, d)) && (i = n.contains(e.ownerDocument, e), 
            f = oa(k.appendChild(e), "script"), i && ma(f), c)) for (j = 0; e = f[j++]; ) fa.test(e.type || "") && c.push(e);
            return k;
        },
        cleanData: function(a) {
            for (var b, c, d, e, f = n.event.special, g = 0; void 0 !== (c = a[g]); g++) {
                if (n.acceptData(c) && (e = c[L.expando], e && (b = L.cache[e]))) {
                    if (b.events) for (d in b.events) f[d] ? n.event.remove(c, d) : n.removeEvent(c, d, b.handle);
                    L.cache[e] && delete L.cache[e];
                }
                delete M.cache[c[M.expando]];
            }
        }
    }), n.fn.extend({
        text: function(a) {
            return J(this, function(a) {
                return void 0 === a ? n.text(this) : this.empty().each(function() {
                    (1 === this.nodeType || 11 === this.nodeType || 9 === this.nodeType) && (this.textContent = a);
                });
            }, null, a, arguments.length);
        },
        append: function() {
            return this.domManip(arguments, function(a) {
                if (1 === this.nodeType || 11 === this.nodeType || 9 === this.nodeType) {
                    var b = ja(this, a);
                    b.appendChild(a);
                }
            });
        },
        prepend: function() {
            return this.domManip(arguments, function(a) {
                if (1 === this.nodeType || 11 === this.nodeType || 9 === this.nodeType) {
                    var b = ja(this, a);
                    b.insertBefore(a, b.firstChild);
                }
            });
        },
        before: function() {
            return this.domManip(arguments, function(a) {
                this.parentNode && this.parentNode.insertBefore(a, this);
            });
        },
        after: function() {
            return this.domManip(arguments, function(a) {
                this.parentNode && this.parentNode.insertBefore(a, this.nextSibling);
            });
        },
        remove: function(a, b) {
            for (var c, d = a ? n.filter(a, this) : this, e = 0; null != (c = d[e]); e++) b || 1 !== c.nodeType || n.cleanData(oa(c)), 
            c.parentNode && (b && n.contains(c.ownerDocument, c) && ma(oa(c, "script")), c.parentNode.removeChild(c));
            return this;
        },
        empty: function() {
            for (var a, b = 0; null != (a = this[b]); b++) 1 === a.nodeType && (n.cleanData(oa(a, !1)), 
            a.textContent = "");
            return this;
        },
        clone: function(a, b) {
            return a = null == a ? !1 : a, b = null == b ? a : b, this.map(function() {
                return n.clone(this, a, b);
            });
        },
        html: function(a) {
            return J(this, function(a) {
                var b = this[0] || {}, c = 0, d = this.length;
                if (void 0 === a && 1 === b.nodeType) return b.innerHTML;
                if ("string" == typeof a && !da.test(a) && !ia[(ba.exec(a) || [ "", "" ])[1].toLowerCase()]) {
                    a = a.replace(aa, "<$1></$2>");
                    try {
                        for (;d > c; c++) b = this[c] || {}, 1 === b.nodeType && (n.cleanData(oa(b, !1)), 
                        b.innerHTML = a);
                        b = 0;
                    } catch (e) {}
                }
                b && this.empty().append(a);
            }, null, a, arguments.length);
        },
        replaceWith: function() {
            var a = arguments[0];
            return this.domManip(arguments, function(b) {
                a = this.parentNode, n.cleanData(oa(this)), a && a.replaceChild(b, this);
            }), a && (a.length || a.nodeType) ? this : this.remove();
        },
        detach: function(a) {
            return this.remove(a, !0);
        },
        domManip: function(a, b) {
            a = e.apply([], a);
            var c, d, f, g, h, i, j = 0, l = this.length, m = this, o = l - 1, p = a[0], q = n.isFunction(p);
            if (q || l > 1 && "string" == typeof p && !k.checkClone && ea.test(p)) return this.each(function(c) {
                var d = m.eq(c);
                q && (a[0] = p.call(this, c, d.html())), d.domManip(a, b);
            });
            if (l && (c = n.buildFragment(a, this[0].ownerDocument, !1, this), d = c.firstChild, 
            1 === c.childNodes.length && (c = d), d)) {
                for (f = n.map(oa(c, "script"), ka), g = f.length; l > j; j++) h = c, j !== o && (h = n.clone(h, !0, !0), 
                g && n.merge(f, oa(h, "script"))), b.call(this[j], h, j);
                if (g) for (i = f[f.length - 1].ownerDocument, n.map(f, la), j = 0; g > j; j++) h = f[j], 
                fa.test(h.type || "") && !L.access(h, "globalEval") && n.contains(i, h) && (h.src ? n._evalUrl && n._evalUrl(h.src) : n.globalEval(h.textContent.replace(ha, "")));
            }
            return this;
        }
    }), n.each({
        appendTo: "append",
        prependTo: "prepend",
        insertBefore: "before",
        insertAfter: "after",
        replaceAll: "replaceWith"
    }, function(a, b) {
        n.fn[a] = function(a) {
            for (var c, d = [], e = n(a), g = e.length - 1, h = 0; g >= h; h++) c = h === g ? this : this.clone(!0), 
            n(e[h])[b](c), f.apply(d, c.get());
            return this.pushStack(d);
        };
    });
    var qa, ra = {}, ua = /^margin/, va = new RegExp("^(" + Q + ")(?!px)[a-z%]+$", "i"), wa = function(b) {
        return b.ownerDocument.defaultView.opener ? b.ownerDocument.defaultView.getComputedStyle(b, null) : a.getComputedStyle(b, null);
    };
    !function() {
        function g() {
            f.style.cssText = "-webkit-box-sizing:border-box;-moz-box-sizing:border-box;box-sizing:border-box;display:block;margin-top:1%;top:1%;border:1px;padding:1px;width:4px;position:absolute", 
            f.innerHTML = "", d.appendChild(e);
            var g = a.getComputedStyle(f, null);
            b = "1%" !== g.top, c = "4px" === g.width, d.removeChild(e);
        }
        var b, c, d = l.documentElement, e = l.createElement("div"), f = l.createElement("div");
        f.style && (f.style.backgroundClip = "content-box", f.cloneNode(!0).style.backgroundClip = "", 
        k.clearCloneStyle = "content-box" === f.style.backgroundClip, e.style.cssText = "border:0;width:0;height:0;top:0;left:-9999px;margin-top:1px;position:absolute", 
        e.appendChild(f), a.getComputedStyle && n.extend(k, {
            pixelPosition: function() {
                return g(), b;
            },
            boxSizingReliable: function() {
                return null == c && g(), c;
            },
            reliableMarginRight: function() {
                var b, c = f.appendChild(l.createElement("div"));
                return c.style.cssText = f.style.cssText = "-webkit-box-sizing:content-box;-moz-box-sizing:content-box;box-sizing:content-box;display:block;margin:0;border:0;padding:0", 
                c.style.marginRight = c.style.width = "0", f.style.width = "1px", d.appendChild(e), 
                b = !parseFloat(a.getComputedStyle(c, null).marginRight), d.removeChild(e), f.removeChild(c), 
                b;
            }
        }));
    }(), n.swap = function(a, b, c, d) {
        var e, f, g = {};
        for (f in b) g[f] = a.style[f], a.style[f] = b[f];
        e = c.apply(a, d || []);
        for (f in b) a.style[f] = g[f];
        return e;
    };
    var za = /^(none|table(?!-c[ea]).+)/, Aa = new RegExp("^(" + Q + ")(.*)$", "i"), Ba = new RegExp("^([+-])=(" + Q + ")", "i"), Ca = {
        position: "absolute",
        visibility: "hidden",
        display: "block"
    }, Da = {
        letterSpacing: "0",
        fontWeight: "400"
    }, Ea = [ "Webkit", "O", "Moz", "ms" ];
    n.extend({
        cssHooks: {
            opacity: {
                get: function(a, b) {
                    if (b) {
                        var c = xa(a, "opacity");
                        return "" === c ? "1" : c;
                    }
                }
            }
        },
        cssNumber: {
            columnCount: !0,
            fillOpacity: !0,
            flexGrow: !0,
            flexShrink: !0,
            fontWeight: !0,
            lineHeight: !0,
            opacity: !0,
            order: !0,
            orphans: !0,
            widows: !0,
            zIndex: !0,
            zoom: !0
        },
        cssProps: {
            "float": "cssFloat"
        },
        style: function(a, b, c, d) {
            if (a && 3 !== a.nodeType && 8 !== a.nodeType && a.style) {
                var e, f, g, h = n.camelCase(b), i = a.style;
                return b = n.cssProps[h] || (n.cssProps[h] = Fa(i, h)), g = n.cssHooks[b] || n.cssHooks[h], 
                void 0 === c ? g && "get" in g && void 0 !== (e = g.get(a, !1, d)) ? e : i[b] : (f = typeof c, 
                "string" === f && (e = Ba.exec(c)) && (c = (e[1] + 1) * e[2] + parseFloat(n.css(a, b)), 
                f = "number"), void (null != c && c === c && ("number" !== f || n.cssNumber[h] || (c += "px"), 
                k.clearCloneStyle || "" !== c || 0 !== b.indexOf("background") || (i[b] = "inherit"), 
                g && "set" in g && void 0 === (c = g.set(a, c, d)) || (i[b] = c))));
            }
        },
        css: function(a, b, c, d) {
            var e, f, g, h = n.camelCase(b);
            return b = n.cssProps[h] || (n.cssProps[h] = Fa(a.style, h)), g = n.cssHooks[b] || n.cssHooks[h], 
            g && "get" in g && (e = g.get(a, !0, c)), void 0 === e && (e = xa(a, b, d)), "normal" === e && b in Da && (e = Da[b]), 
            "" === c || c ? (f = parseFloat(e), c === !0 || n.isNumeric(f) ? f || 0 : e) : e;
        }
    }), n.each([ "height", "width" ], function(a, b) {
        n.cssHooks[b] = {
            get: function(a, c, d) {
                return c ? za.test(n.css(a, "display")) && 0 === a.offsetWidth ? n.swap(a, Ca, function() {
                    return Ia(a, b, d);
                }) : Ia(a, b, d) : void 0;
            },
            set: function(a, c, d) {
                var e = d && wa(a);
                return Ga(a, c, d ? Ha(a, b, d, "border-box" === n.css(a, "boxSizing", !1, e), e) : 0);
            }
        };
    }), n.cssHooks.marginRight = ya(k.reliableMarginRight, function(a, b) {
        return b ? n.swap(a, {
            display: "inline-block"
        }, xa, [ a, "marginRight" ]) : void 0;
    }), n.each({
        margin: "",
        padding: "",
        border: "Width"
    }, function(a, b) {
        n.cssHooks[a + b] = {
            expand: function(c) {
                for (var d = 0, e = {}, f = "string" == typeof c ? c.split(" ") : [ c ]; 4 > d; d++) e[a + R[d] + b] = f[d] || f[d - 2] || f[0];
                return e;
            }
        }, ua.test(a) || (n.cssHooks[a + b].set = Ga);
    }), n.fn.extend({
        css: function(a, b) {
            return J(this, function(a, b, c) {
                var d, e, f = {}, g = 0;
                if (n.isArray(b)) {
                    for (d = wa(a), e = b.length; e > g; g++) f[b[g]] = n.css(a, b[g], !1, d);
                    return f;
                }
                return void 0 !== c ? n.style(a, b, c) : n.css(a, b);
            }, a, b, arguments.length > 1);
        },
        show: function() {
            return Ja(this, !0);
        },
        hide: function() {
            return Ja(this);
        },
        toggle: function(a) {
            return "boolean" == typeof a ? a ? this.show() : this.hide() : this.each(function() {
                S(this) ? n(this).show() : n(this).hide();
            });
        }
    }), n.Tween = Ka, Ka.prototype = {
        constructor: Ka,
        init: function(a, b, c, d, e, f) {
            this.elem = a, this.prop = c, this.easing = e || "swing", this.options = b, this.start = this.now = this.cur(), 
            this.end = d, this.unit = f || (n.cssNumber[c] ? "" : "px");
        },
        cur: function() {
            var a = Ka.propHooks[this.prop];
            return a && a.get ? a.get(this) : Ka.propHooks._default.get(this);
        },
        run: function(a) {
            var b, c = Ka.propHooks[this.prop];
            return this.options.duration ? this.pos = b = n.easing[this.easing](a, this.options.duration * a, 0, 1, this.options.duration) : this.pos = b = a, 
            this.now = (this.end - this.start) * b + this.start, this.options.step && this.options.step.call(this.elem, this.now, this), 
            c && c.set ? c.set(this) : Ka.propHooks._default.set(this), this;
        }
    }, Ka.prototype.init.prototype = Ka.prototype, Ka.propHooks = {
        _default: {
            get: function(a) {
                var b;
                return null == a.elem[a.prop] || a.elem.style && null != a.elem.style[a.prop] ? (b = n.css(a.elem, a.prop, ""), 
                b && "auto" !== b ? b : 0) : a.elem[a.prop];
            },
            set: function(a) {
                n.fx.step[a.prop] ? n.fx.step[a.prop](a) : a.elem.style && (null != a.elem.style[n.cssProps[a.prop]] || n.cssHooks[a.prop]) ? n.style(a.elem, a.prop, a.now + a.unit) : a.elem[a.prop] = a.now;
            }
        }
    }, Ka.propHooks.scrollTop = Ka.propHooks.scrollLeft = {
        set: function(a) {
            a.elem.nodeType && a.elem.parentNode && (a.elem[a.prop] = a.now);
        }
    }, n.easing = {
        linear: function(a) {
            return a;
        },
        swing: function(a) {
            return .5 - Math.cos(a * Math.PI) / 2;
        }
    }, n.fx = Ka.prototype.init, n.fx.step = {};
    var La, Ma, Na = /^(?:toggle|show|hide)$/, Oa = new RegExp("^(?:([+-])=|)(" + Q + ")([a-z%]*)$", "i"), Pa = /queueHooks$/, Qa = [ Va ], Ra = {
        "*": [ function(a, b) {
            var c = this.createTween(a, b), d = c.cur(), e = Oa.exec(b), f = e && e[3] || (n.cssNumber[a] ? "" : "px"), g = (n.cssNumber[a] || "px" !== f && +d) && Oa.exec(n.css(c.elem, a)), h = 1, i = 20;
            if (g && g[3] !== f) {
                f = f || g[3], e = e || [], g = +d || 1;
                do h = h || ".5", g /= h, n.style(c.elem, a, g + f); while (h !== (h = c.cur() / d) && 1 !== h && --i);
            }
            return e && (g = c.start = +g || +d || 0, c.unit = f, c.end = e[1] ? g + (e[1] + 1) * e[2] : +e[2]), 
            c;
        } ]
    };
    n.Animation = n.extend(Xa, {
        tweener: function(a, b) {
            n.isFunction(a) ? (b = a, a = [ "*" ]) : a = a.split(" ");
            for (var c, d = 0, e = a.length; e > d; d++) c = a[d], Ra[c] = Ra[c] || [], Ra[c].unshift(b);
        },
        prefilter: function(a, b) {
            b ? Qa.unshift(a) : Qa.push(a);
        }
    }), n.speed = function(a, b, c) {
        var d = a && "object" == typeof a ? n.extend({}, a) : {
            complete: c || !c && b || n.isFunction(a) && a,
            duration: a,
            easing: c && b || b && !n.isFunction(b) && b
        };
        return d.duration = n.fx.off ? 0 : "number" == typeof d.duration ? d.duration : d.duration in n.fx.speeds ? n.fx.speeds[d.duration] : n.fx.speeds._default, 
        (null == d.queue || d.queue === !0) && (d.queue = "fx"), d.old = d.complete, d.complete = function() {
            n.isFunction(d.old) && d.old.call(this), d.queue && n.dequeue(this, d.queue);
        }, d;
    }, n.fn.extend({
        fadeTo: function(a, b, c, d) {
            return this.filter(S).css("opacity", 0).show().end().animate({
                opacity: b
            }, a, c, d);
        },
        animate: function(a, b, c, d) {
            var e = n.isEmptyObject(a), f = n.speed(b, c, d), g = function() {
                var b = Xa(this, n.extend({}, a), f);
                (e || L.get(this, "finish")) && b.stop(!0);
            };
            return g.finish = g, e || f.queue === !1 ? this.each(g) : this.queue(f.queue, g);
        },
        stop: function(a, b, c) {
            var d = function(a) {
                var b = a.stop;
                delete a.stop, b(c);
            };
            return "string" != typeof a && (c = b, b = a, a = void 0), b && a !== !1 && this.queue(a || "fx", []), 
            this.each(function() {
                var b = !0, e = null != a && a + "queueHooks", f = n.timers, g = L.get(this);
                if (e) g[e] && g[e].stop && d(g[e]); else for (e in g) g[e] && g[e].stop && Pa.test(e) && d(g[e]);
                for (e = f.length; e--; ) f[e].elem !== this || null != a && f[e].queue !== a || (f[e].anim.stop(c), 
                b = !1, f.splice(e, 1));
                (b || !c) && n.dequeue(this, a);
            });
        },
        finish: function(a) {
            return a !== !1 && (a = a || "fx"), this.each(function() {
                var b, c = L.get(this), d = c[a + "queue"], e = c[a + "queueHooks"], f = n.timers, g = d ? d.length : 0;
                for (c.finish = !0, n.queue(this, a, []), e && e.stop && e.stop.call(this, !0), 
                b = f.length; b--; ) f[b].elem === this && f[b].queue === a && (f[b].anim.stop(!0), 
                f.splice(b, 1));
                for (b = 0; g > b; b++) d[b] && d[b].finish && d[b].finish.call(this);
                delete c.finish;
            });
        }
    }), n.each([ "toggle", "show", "hide" ], function(a, b) {
        var c = n.fn[b];
        n.fn[b] = function(a, d, e) {
            return null == a || "boolean" == typeof a ? c.apply(this, arguments) : this.animate(Ta(b, !0), a, d, e);
        };
    }), n.each({
        slideDown: Ta("show"),
        slideUp: Ta("hide"),
        slideToggle: Ta("toggle"),
        fadeIn: {
            opacity: "show"
        },
        fadeOut: {
            opacity: "hide"
        },
        fadeToggle: {
            opacity: "toggle"
        }
    }, function(a, b) {
        n.fn[a] = function(a, c, d) {
            return this.animate(b, a, c, d);
        };
    }), n.timers = [], n.fx.tick = function() {
        var a, b = 0, c = n.timers;
        for (La = n.now(); b < c.length; b++) a = c[b], a() || c[b] !== a || c.splice(b--, 1);
        c.length || n.fx.stop(), La = void 0;
    }, n.fx.timer = function(a) {
        n.timers.push(a), a() ? n.fx.start() : n.timers.pop();
    }, n.fx.interval = 13, n.fx.start = function() {
        Ma || (Ma = setInterval(n.fx.tick, n.fx.interval));
    }, n.fx.stop = function() {
        clearInterval(Ma), Ma = null;
    }, n.fx.speeds = {
        slow: 600,
        fast: 200,
        _default: 400
    }, n.fn.delay = function(a, b) {
        return a = n.fx ? n.fx.speeds[a] || a : a, b = b || "fx", this.queue(b, function(b, c) {
            var d = setTimeout(b, a);
            c.stop = function() {
                clearTimeout(d);
            };
        });
    }, function() {
        var a = l.createElement("input"), b = l.createElement("select"), c = b.appendChild(l.createElement("option"));
        a.type = "checkbox", k.checkOn = "" !== a.value, k.optSelected = c.selected, b.disabled = !0, 
        k.optDisabled = !c.disabled, a = l.createElement("input"), a.value = "t", a.type = "radio", 
        k.radioValue = "t" === a.value;
    }();
    var Ya, Za, $a = n.expr.attrHandle;
    n.fn.extend({
        attr: function(a, b) {
            return J(this, n.attr, a, b, arguments.length > 1);
        },
        removeAttr: function(a) {
            return this.each(function() {
                n.removeAttr(this, a);
            });
        }
    }), n.extend({
        attr: function(a, b, c) {
            var d, e, f = a.nodeType;
            return a && 3 !== f && 8 !== f && 2 !== f ? typeof a.getAttribute === U ? n.prop(a, b, c) : (1 === f && n.isXMLDoc(a) || (b = b.toLowerCase(), 
            d = n.attrHooks[b] || (n.expr.match.bool.test(b) ? Za : Ya)), void 0 === c ? d && "get" in d && null !== (e = d.get(a, b)) ? e : (e = n.find.attr(a, b), 
            null == e ? void 0 : e) : null !== c ? d && "set" in d && void 0 !== (e = d.set(a, c, b)) ? e : (a.setAttribute(b, c + ""), 
            c) : void n.removeAttr(a, b)) : void 0;
        },
        removeAttr: function(a, b) {
            var c, d, e = 0, f = b && b.match(E);
            if (f && 1 === a.nodeType) for (;c = f[e++]; ) d = n.propFix[c] || c, n.expr.match.bool.test(c) && (a[d] = !1), 
            a.removeAttribute(c);
        },
        attrHooks: {
            type: {
                set: function(a, b) {
                    if (!k.radioValue && "radio" === b && n.nodeName(a, "input")) {
                        var c = a.value;
                        return a.setAttribute("type", b), c && (a.value = c), b;
                    }
                }
            }
        }
    }), Za = {
        set: function(a, b, c) {
            return b === !1 ? n.removeAttr(a, c) : a.setAttribute(c, c), c;
        }
    }, n.each(n.expr.match.bool.source.match(/\w+/g), function(a, b) {
        var c = $a[b] || n.find.attr;
        $a[b] = function(a, b, d) {
            var e, f;
            return d || (f = $a[b], $a[b] = e, e = null != c(a, b, d) ? b.toLowerCase() : null, 
            $a[b] = f), e;
        };
    });
    var _a = /^(?:input|select|textarea|button)$/i;
    n.fn.extend({
        prop: function(a, b) {
            return J(this, n.prop, a, b, arguments.length > 1);
        },
        removeProp: function(a) {
            return this.each(function() {
                delete this[n.propFix[a] || a];
            });
        }
    }), n.extend({
        propFix: {
            "for": "htmlFor",
            "class": "className"
        },
        prop: function(a, b, c) {
            var d, e, f, g = a.nodeType;
            return a && 3 !== g && 8 !== g && 2 !== g ? (f = 1 !== g || !n.isXMLDoc(a), f && (b = n.propFix[b] || b, 
            e = n.propHooks[b]), void 0 !== c ? e && "set" in e && void 0 !== (d = e.set(a, c, b)) ? d : a[b] = c : e && "get" in e && null !== (d = e.get(a, b)) ? d : a[b]) : void 0;
        },
        propHooks: {
            tabIndex: {
                get: function(a) {
                    return a.hasAttribute("tabindex") || _a.test(a.nodeName) || a.href ? a.tabIndex : -1;
                }
            }
        }
    }), k.optSelected || (n.propHooks.selected = {
        get: function(a) {
            var b = a.parentNode;
            return b && b.parentNode && b.parentNode.selectedIndex, null;
        }
    }), n.each([ "tabIndex", "readOnly", "maxLength", "cellSpacing", "cellPadding", "rowSpan", "colSpan", "useMap", "frameBorder", "contentEditable" ], function() {
        n.propFix[this.toLowerCase()] = this;
    });
    var ab = /[\t\r\n\f]/g;
    n.fn.extend({
        addClass: function(a) {
            var b, c, d, e, f, g, h = "string" == typeof a && a, i = 0, j = this.length;
            if (n.isFunction(a)) return this.each(function(b) {
                n(this).addClass(a.call(this, b, this.className));
            });
            if (h) for (b = (a || "").match(E) || []; j > i; i++) if (c = this[i], d = 1 === c.nodeType && (c.className ? (" " + c.className + " ").replace(ab, " ") : " ")) {
                for (f = 0; e = b[f++]; ) d.indexOf(" " + e + " ") < 0 && (d += e + " ");
                g = n.trim(d), c.className !== g && (c.className = g);
            }
            return this;
        },
        removeClass: function(a) {
            var b, c, d, e, f, g, h = 0 === arguments.length || "string" == typeof a && a, i = 0, j = this.length;
            if (n.isFunction(a)) return this.each(function(b) {
                n(this).removeClass(a.call(this, b, this.className));
            });
            if (h) for (b = (a || "").match(E) || []; j > i; i++) if (c = this[i], d = 1 === c.nodeType && (c.className ? (" " + c.className + " ").replace(ab, " ") : "")) {
                for (f = 0; e = b[f++]; ) for (;d.indexOf(" " + e + " ") >= 0; ) d = d.replace(" " + e + " ", " ");
                g = a ? n.trim(d) : "", c.className !== g && (c.className = g);
            }
            return this;
        },
        toggleClass: function(a, b) {
            var c = typeof a;
            return "boolean" == typeof b && "string" === c ? b ? this.addClass(a) : this.removeClass(a) : this.each(n.isFunction(a) ? function(c) {
                n(this).toggleClass(a.call(this, c, this.className, b), b);
            } : function() {
                if ("string" === c) for (var b, d = 0, e = n(this), f = a.match(E) || []; b = f[d++]; ) e.hasClass(b) ? e.removeClass(b) : e.addClass(b); else (c === U || "boolean" === c) && (this.className && L.set(this, "__className__", this.className), 
                this.className = this.className || a === !1 ? "" : L.get(this, "__className__") || "");
            });
        },
        hasClass: function(a) {
            for (var b = " " + a + " ", c = 0, d = this.length; d > c; c++) if (1 === this[c].nodeType && (" " + this[c].className + " ").replace(ab, " ").indexOf(b) >= 0) return !0;
            return !1;
        }
    });
    var bb = /\r/g;
    n.fn.extend({
        val: function(a) {
            var b, c, d, e = this[0];
            return arguments.length ? (d = n.isFunction(a), this.each(function(c) {
                var e;
                1 === this.nodeType && (e = d ? a.call(this, c, n(this).val()) : a, null == e ? e = "" : "number" == typeof e ? e += "" : n.isArray(e) && (e = n.map(e, function(a) {
                    return null == a ? "" : a + "";
                })), b = n.valHooks[this.type] || n.valHooks[this.nodeName.toLowerCase()], b && "set" in b && void 0 !== b.set(this, e, "value") || (this.value = e));
            })) : e ? (b = n.valHooks[e.type] || n.valHooks[e.nodeName.toLowerCase()], b && "get" in b && void 0 !== (c = b.get(e, "value")) ? c : (c = e.value, 
            "string" == typeof c ? c.replace(bb, "") : null == c ? "" : c)) : void 0;
        }
    }), n.extend({
        valHooks: {
            option: {
                get: function(a) {
                    var b = n.find.attr(a, "value");
                    return null != b ? b : n.trim(n.text(a));
                }
            },
            select: {
                get: function(a) {
                    for (var b, c, d = a.options, e = a.selectedIndex, f = "select-one" === a.type || 0 > e, g = f ? null : [], h = f ? e + 1 : d.length, i = 0 > e ? h : f ? e : 0; h > i; i++) if (c = d[i], 
                    !(!c.selected && i !== e || (k.optDisabled ? c.disabled : null !== c.getAttribute("disabled")) || c.parentNode.disabled && n.nodeName(c.parentNode, "optgroup"))) {
                        if (b = n(c).val(), f) return b;
                        g.push(b);
                    }
                    return g;
                },
                set: function(a, b) {
                    for (var c, d, e = a.options, f = n.makeArray(b), g = e.length; g--; ) d = e[g], 
                    (d.selected = n.inArray(d.value, f) >= 0) && (c = !0);
                    return c || (a.selectedIndex = -1), f;
                }
            }
        }
    }), n.each([ "radio", "checkbox" ], function() {
        n.valHooks[this] = {
            set: function(a, b) {
                return n.isArray(b) ? a.checked = n.inArray(n(a).val(), b) >= 0 : void 0;
            }
        }, k.checkOn || (n.valHooks[this].get = function(a) {
            return null === a.getAttribute("value") ? "on" : a.value;
        });
    }), n.each("blur focus focusin focusout load resize scroll unload click dblclick mousedown mouseup mousemove mouseover mouseout mouseenter mouseleave change select submit keydown keypress keyup error contextmenu".split(" "), function(a, b) {
        n.fn[b] = function(a, c) {
            return arguments.length > 0 ? this.on(b, null, a, c) : this.trigger(b);
        };
    }), n.fn.extend({
        hover: function(a, b) {
            return this.mouseenter(a).mouseleave(b || a);
        },
        bind: function(a, b, c) {
            return this.on(a, null, b, c);
        },
        unbind: function(a, b) {
            return this.off(a, null, b);
        },
        delegate: function(a, b, c, d) {
            return this.on(b, a, c, d);
        },
        undelegate: function(a, b, c) {
            return 1 === arguments.length ? this.off(a, "**") : this.off(b, a || "**", c);
        }
    });
    var cb = n.now(), db = /\?/;
    n.parseJSON = function(a) {
        return JSON.parse(a + "");
    }, n.parseXML = function(a) {
        var b, c;
        if (!a || "string" != typeof a) return null;
        try {
            c = new DOMParser(), b = c.parseFromString(a, "text/xml");
        } catch (d) {
            b = void 0;
        }
        return (!b || b.getElementsByTagName("parsererror").length) && n.error("Invalid XML: " + a), 
        b;
    };
    var eb = /#.*$/, fb = /([?&])_=[^&]*/, gb = /^(.*?):[ \t]*([^\r\n]*)$/gm, hb = /^(?:about|app|app-storage|.+-extension|file|res|widget):$/, ib = /^(?:GET|HEAD)$/, jb = /^\/\//, kb = /^([\w.+-]+:)(?:\/\/(?:[^\/?#]*@|)([^\/?#:]*)(?::(\d+)|)|)/, lb = {}, mb = {}, nb = "*/".concat("*"), ob = a.location.href, pb = kb.exec(ob.toLowerCase()) || [];
    n.extend({
        active: 0,
        lastModified: {},
        etag: {},
        ajaxSettings: {
            url: ob,
            type: "GET",
            isLocal: hb.test(pb[1]),
            global: !0,
            processData: !0,
            async: !0,
            contentType: "application/x-www-form-urlencoded; charset=UTF-8",
            accepts: {
                "*": nb,
                text: "text/plain",
                html: "text/html",
                xml: "application/xml, text/xml",
                json: "application/json, text/javascript"
            },
            contents: {
                xml: /xml/,
                html: /html/,
                json: /json/
            },
            responseFields: {
                xml: "responseXML",
                text: "responseText",
                json: "responseJSON"
            },
            converters: {
                "* text": String,
                "text html": !0,
                "text json": n.parseJSON,
                "text xml": n.parseXML
            },
            flatOptions: {
                url: !0,
                context: !0
            }
        },
        ajaxSetup: function(a, b) {
            return b ? sb(sb(a, n.ajaxSettings), b) : sb(n.ajaxSettings, a);
        },
        ajaxPrefilter: qb(lb),
        ajaxTransport: qb(mb),
        ajax: function(a, b) {
            function x(a, b, f, h) {
                var j, r, s, u, w, x = b;
                2 !== t && (t = 2, g && clearTimeout(g), c = void 0, e = h || "", v.readyState = a > 0 ? 4 : 0, 
                j = a >= 200 && 300 > a || 304 === a, f && (u = tb(k, v, f)), u = ub(k, u, v, j), 
                j ? (k.ifModified && (w = v.getResponseHeader("Last-Modified"), w && (n.lastModified[d] = w), 
                w = v.getResponseHeader("etag"), w && (n.etag[d] = w)), 204 === a || "HEAD" === k.type ? x = "nocontent" : 304 === a ? x = "notmodified" : (x = u.state, 
                r = u.data, s = u.error, j = !s)) : (s = x, (a || !x) && (x = "error", 0 > a && (a = 0))), 
                v.status = a, v.statusText = (b || x) + "", j ? o.resolveWith(l, [ r, x, v ]) : o.rejectWith(l, [ v, x, s ]), 
                v.statusCode(q), q = void 0, i && m.trigger(j ? "ajaxSuccess" : "ajaxError", [ v, k, j ? r : s ]), 
                p.fireWith(l, [ v, x ]), i && (m.trigger("ajaxComplete", [ v, k ]), --n.active || n.event.trigger("ajaxStop")));
            }
            "object" == typeof a && (b = a, a = void 0), b = b || {};
            var c, d, e, f, g, h, i, j, k = n.ajaxSetup({}, b), l = k.context || k, m = k.context && (l.nodeType || l.jquery) ? n(l) : n.event, o = n.Deferred(), p = n.Callbacks("once memory"), q = k.statusCode || {}, r = {}, s = {}, t = 0, u = "canceled", v = {
                readyState: 0,
                getResponseHeader: function(a) {
                    var b;
                    if (2 === t) {
                        if (!f) for (f = {}; b = gb.exec(e); ) f[b[1].toLowerCase()] = b[2];
                        b = f[a.toLowerCase()];
                    }
                    return null == b ? null : b;
                },
                getAllResponseHeaders: function() {
                    return 2 === t ? e : null;
                },
                setRequestHeader: function(a, b) {
                    var c = a.toLowerCase();
                    return t || (a = s[c] = s[c] || a, r[a] = b), this;
                },
                overrideMimeType: function(a) {
                    return t || (k.mimeType = a), this;
                },
                statusCode: function(a) {
                    var b;
                    if (a) if (2 > t) for (b in a) q[b] = [ q[b], a[b] ]; else v.always(a[v.status]);
                    return this;
                },
                abort: function(a) {
                    var b = a || u;
                    return c && c.abort(b), x(0, b), this;
                }
            };
            if (o.promise(v).complete = p.add, v.success = v.done, v.error = v.fail, k.url = ((a || k.url || ob) + "").replace(eb, "").replace(jb, pb[1] + "//"), 
            k.type = b.method || b.type || k.method || k.type, k.dataTypes = n.trim(k.dataType || "*").toLowerCase().match(E) || [ "" ], 
            null == k.crossDomain && (h = kb.exec(k.url.toLowerCase()), k.crossDomain = !(!h || h[1] === pb[1] && h[2] === pb[2] && (h[3] || ("http:" === h[1] ? "80" : "443")) === (pb[3] || ("http:" === pb[1] ? "80" : "443")))), 
            k.data && k.processData && "string" != typeof k.data && (k.data = n.param(k.data, k.traditional)), 
            rb(lb, k, b, v), 2 === t) return v;
            i = n.event && k.global, i && 0 === n.active++ && n.event.trigger("ajaxStart"), 
            k.type = k.type.toUpperCase(), k.hasContent = !ib.test(k.type), d = k.url, k.hasContent || (k.data && (d = k.url += (db.test(d) ? "&" : "?") + k.data, 
            delete k.data), k.cache === !1 && (k.url = fb.test(d) ? d.replace(fb, "$1_=" + cb++) : d + (db.test(d) ? "&" : "?") + "_=" + cb++)), 
            k.ifModified && (n.lastModified[d] && v.setRequestHeader("If-Modified-Since", n.lastModified[d]), 
            n.etag[d] && v.setRequestHeader("If-None-Match", n.etag[d])), (k.data && k.hasContent && k.contentType !== !1 || b.contentType) && v.setRequestHeader("Content-Type", k.contentType), 
            v.setRequestHeader("Accept", k.dataTypes[0] && k.accepts[k.dataTypes[0]] ? k.accepts[k.dataTypes[0]] + ("*" !== k.dataTypes[0] ? ", " + nb + "; q=0.01" : "") : k.accepts["*"]);
            for (j in k.headers) v.setRequestHeader(j, k.headers[j]);
            if (k.beforeSend && (k.beforeSend.call(l, v, k) === !1 || 2 === t)) return v.abort();
            u = "abort";
            for (j in {
                success: 1,
                error: 1,
                complete: 1
            }) v[j](k[j]);
            if (c = rb(mb, k, b, v)) {
                v.readyState = 1, i && m.trigger("ajaxSend", [ v, k ]), k.async && k.timeout > 0 && (g = setTimeout(function() {
                    v.abort("timeout");
                }, k.timeout));
                try {
                    t = 1, c.send(r, x);
                } catch (w) {
                    if (!(2 > t)) throw w;
                    x(-1, w);
                }
            } else x(-1, "No Transport");
            return v;
        },
        getJSON: function(a, b, c) {
            return n.get(a, b, c, "json");
        },
        getScript: function(a, b) {
            return n.get(a, void 0, b, "script");
        }
    }), n.each([ "get", "post" ], function(a, b) {
        n[b] = function(a, c, d, e) {
            return n.isFunction(c) && (e = e || d, d = c, c = void 0), n.ajax({
                url: a,
                type: b,
                dataType: e,
                data: c,
                success: d
            });
        };
    }), n._evalUrl = function(a) {
        return n.ajax({
            url: a,
            type: "GET",
            dataType: "script",
            async: !1,
            global: !1,
            "throws": !0
        });
    }, n.fn.extend({
        wrapAll: function(a) {
            var b;
            return n.isFunction(a) ? this.each(function(b) {
                n(this).wrapAll(a.call(this, b));
            }) : (this[0] && (b = n(a, this[0].ownerDocument).eq(0).clone(!0), this[0].parentNode && b.insertBefore(this[0]), 
            b.map(function() {
                for (var a = this; a.firstElementChild; ) a = a.firstElementChild;
                return a;
            }).append(this)), this);
        },
        wrapInner: function(a) {
            return this.each(n.isFunction(a) ? function(b) {
                n(this).wrapInner(a.call(this, b));
            } : function() {
                var b = n(this), c = b.contents();
                c.length ? c.wrapAll(a) : b.append(a);
            });
        },
        wrap: function(a) {
            var b = n.isFunction(a);
            return this.each(function(c) {
                n(this).wrapAll(b ? a.call(this, c) : a);
            });
        },
        unwrap: function() {
            return this.parent().each(function() {
                n.nodeName(this, "body") || n(this).replaceWith(this.childNodes);
            }).end();
        }
    }), n.expr.filters.hidden = function(a) {
        return a.offsetWidth <= 0 && a.offsetHeight <= 0;
    }, n.expr.filters.visible = function(a) {
        return !n.expr.filters.hidden(a);
    };
    var vb = /%20/g, wb = /\[\]$/, xb = /\r?\n/g, yb = /^(?:submit|button|image|reset|file)$/i, zb = /^(?:input|select|textarea|keygen)/i;
    n.param = function(a, b) {
        var c, d = [], e = function(a, b) {
            b = n.isFunction(b) ? b() : null == b ? "" : b, d[d.length] = encodeURIComponent(a) + "=" + encodeURIComponent(b);
        };
        if (void 0 === b && (b = n.ajaxSettings && n.ajaxSettings.traditional), n.isArray(a) || a.jquery && !n.isPlainObject(a)) n.each(a, function() {
            e(this.name, this.value);
        }); else for (c in a) Ab(c, a[c], b, e);
        return d.join("&").replace(vb, "+");
    }, n.fn.extend({
        serialize: function() {
            return n.param(this.serializeArray());
        },
        serializeArray: function() {
            return this.map(function() {
                var a = n.prop(this, "elements");
                return a ? n.makeArray(a) : this;
            }).filter(function() {
                var a = this.type;
                return this.name && !n(this).is(":disabled") && zb.test(this.nodeName) && !yb.test(a) && (this.checked || !T.test(a));
            }).map(function(a, b) {
                var c = n(this).val();
                return null == c ? null : n.isArray(c) ? n.map(c, function(a) {
                    return {
                        name: b.name,
                        value: a.replace(xb, "\r\n")
                    };
                }) : {
                    name: b.name,
                    value: c.replace(xb, "\r\n")
                };
            }).get();
        }
    }), n.ajaxSettings.xhr = function() {
        try {
            return new XMLHttpRequest();
        } catch (a) {}
    };
    var Bb = 0, Cb = {}, Db = {
        0: 200,
        1223: 204
    }, Eb = n.ajaxSettings.xhr();
    a.attachEvent && a.attachEvent("onunload", function() {
        for (var a in Cb) Cb[a]();
    }), k.cors = !!Eb && "withCredentials" in Eb, k.ajax = Eb = !!Eb, n.ajaxTransport(function(a) {
        var b;
        return k.cors || Eb && !a.crossDomain ? {
            send: function(c, d) {
                var e, f = a.xhr(), g = ++Bb;
                if (f.open(a.type, a.url, a.async, a.username, a.password), a.xhrFields) for (e in a.xhrFields) f[e] = a.xhrFields[e];
                a.mimeType && f.overrideMimeType && f.overrideMimeType(a.mimeType), a.crossDomain || c["X-Requested-With"] || (c["X-Requested-With"] = "XMLHttpRequest");
                for (e in c) f.setRequestHeader(e, c[e]);
                b = function(a) {
                    return function() {
                        b && (delete Cb[g], b = f.onload = f.onerror = null, "abort" === a ? f.abort() : "error" === a ? d(f.status, f.statusText) : d(Db[f.status] || f.status, f.statusText, "string" == typeof f.responseText ? {
                            text: f.responseText
                        } : void 0, f.getAllResponseHeaders()));
                    };
                }, f.onload = b(), f.onerror = b("error"), b = Cb[g] = b("abort");
                try {
                    f.send(a.hasContent && a.data || null);
                } catch (h) {
                    if (b) throw h;
                }
            },
            abort: function() {
                b && b();
            }
        } : void 0;
    }), n.ajaxSetup({
        accepts: {
            script: "text/javascript, application/javascript, application/ecmascript, application/x-ecmascript"
        },
        contents: {
            script: /(?:java|ecma)script/
        },
        converters: {
            "text script": function(a) {
                return n.globalEval(a), a;
            }
        }
    }), n.ajaxPrefilter("script", function(a) {
        void 0 === a.cache && (a.cache = !1), a.crossDomain && (a.type = "GET");
    }), n.ajaxTransport("script", function(a) {
        if (a.crossDomain) {
            var b, c;
            return {
                send: function(d, e) {
                    b = n("<script>").prop({
                        async: !0,
                        charset: a.scriptCharset,
                        src: a.url
                    }).on("load error", c = function(a) {
                        b.remove(), c = null, a && e("error" === a.type ? 404 : 200, a.type);
                    }), l.head.appendChild(b[0]);
                },
                abort: function() {
                    c && c();
                }
            };
        }
    });
    var Fb = [], Gb = /(=)\?(?=&|$)|\?\?/;
    n.ajaxSetup({
        jsonp: "callback",
        jsonpCallback: function() {
            var a = Fb.pop() || n.expando + "_" + cb++;
            return this[a] = !0, a;
        }
    }), n.ajaxPrefilter("json jsonp", function(b, c, d) {
        var e, f, g, h = b.jsonp !== !1 && (Gb.test(b.url) ? "url" : "string" == typeof b.data && !(b.contentType || "").indexOf("application/x-www-form-urlencoded") && Gb.test(b.data) && "data");
        return h || "jsonp" === b.dataTypes[0] ? (e = b.jsonpCallback = n.isFunction(b.jsonpCallback) ? b.jsonpCallback() : b.jsonpCallback, 
        h ? b[h] = b[h].replace(Gb, "$1" + e) : b.jsonp !== !1 && (b.url += (db.test(b.url) ? "&" : "?") + b.jsonp + "=" + e), 
        b.converters["script json"] = function() {
            return g || n.error(e + " was not called"), g[0];
        }, b.dataTypes[0] = "json", f = a[e], a[e] = function() {
            g = arguments;
        }, d.always(function() {
            a[e] = f, b[e] && (b.jsonpCallback = c.jsonpCallback, Fb.push(e)), g && n.isFunction(f) && f(g[0]), 
            g = f = void 0;
        }), "script") : void 0;
    }), n.parseHTML = function(a, b, c) {
        if (!a || "string" != typeof a) return null;
        "boolean" == typeof b && (c = b, b = !1), b = b || l;
        var d = v.exec(a), e = !c && [];
        return d ? [ b.createElement(d[1]) ] : (d = n.buildFragment([ a ], b, e), e && e.length && n(e).remove(), 
        n.merge([], d.childNodes));
    };
    var Hb = n.fn.load;
    n.fn.load = function(a, b, c) {
        if ("string" != typeof a && Hb) return Hb.apply(this, arguments);
        var d, e, f, g = this, h = a.indexOf(" ");
        return h >= 0 && (d = n.trim(a.slice(h)), a = a.slice(0, h)), n.isFunction(b) ? (c = b, 
        b = void 0) : b && "object" == typeof b && (e = "POST"), g.length > 0 && n.ajax({
            url: a,
            type: e,
            dataType: "html",
            data: b
        }).done(function(a) {
            f = arguments, g.html(d ? n("<div>").append(n.parseHTML(a)).find(d) : a);
        }).complete(c && function(a, b) {
            g.each(c, f || [ a.responseText, b, a ]);
        }), this;
    }, n.each([ "ajaxStart", "ajaxStop", "ajaxComplete", "ajaxError", "ajaxSuccess", "ajaxSend" ], function(a, b) {
        n.fn[b] = function(a) {
            return this.on(b, a);
        };
    }), n.expr.filters.animated = function(a) {
        return n.grep(n.timers, function(b) {
            return a === b.elem;
        }).length;
    };
    var Ib = a.document.documentElement;
    n.offset = {
        setOffset: function(a, b, c) {
            var d, e, f, g, h, i, j, k = n.css(a, "position"), l = n(a), m = {};
            "static" === k && (a.style.position = "relative"), h = l.offset(), f = n.css(a, "top"), 
            i = n.css(a, "left"), j = ("absolute" === k || "fixed" === k) && (f + i).indexOf("auto") > -1, 
            j ? (d = l.position(), g = d.top, e = d.left) : (g = parseFloat(f) || 0, e = parseFloat(i) || 0), 
            n.isFunction(b) && (b = b.call(a, c, h)), null != b.top && (m.top = b.top - h.top + g), 
            null != b.left && (m.left = b.left - h.left + e), "using" in b ? b.using.call(a, m) : l.css(m);
        }
    }, n.fn.extend({
        offset: function(a) {
            if (arguments.length) return void 0 === a ? this : this.each(function(b) {
                n.offset.setOffset(this, a, b);
            });
            var b, c, d = this[0], e = {
                top: 0,
                left: 0
            }, f = d && d.ownerDocument;
            return f ? (b = f.documentElement, n.contains(b, d) ? (typeof d.getBoundingClientRect !== U && (e = d.getBoundingClientRect()), 
            c = Jb(f), {
                top: e.top + c.pageYOffset - b.clientTop,
                left: e.left + c.pageXOffset - b.clientLeft
            }) : e) : void 0;
        },
        position: function() {
            if (this[0]) {
                var a, b, c = this[0], d = {
                    top: 0,
                    left: 0
                };
                return "fixed" === n.css(c, "position") ? b = c.getBoundingClientRect() : (a = this.offsetParent(), 
                b = this.offset(), n.nodeName(a[0], "html") || (d = a.offset()), d.top += n.css(a[0], "borderTopWidth", !0), 
                d.left += n.css(a[0], "borderLeftWidth", !0)), {
                    top: b.top - d.top - n.css(c, "marginTop", !0),
                    left: b.left - d.left - n.css(c, "marginLeft", !0)
                };
            }
        },
        offsetParent: function() {
            return this.map(function() {
                for (var a = this.offsetParent || Ib; a && !n.nodeName(a, "html") && "static" === n.css(a, "position"); ) a = a.offsetParent;
                return a || Ib;
            });
        }
    }), n.each({
        scrollLeft: "pageXOffset",
        scrollTop: "pageYOffset"
    }, function(b, c) {
        var d = "pageYOffset" === c;
        n.fn[b] = function(e) {
            return J(this, function(b, e, f) {
                var g = Jb(b);
                return void 0 === f ? g ? g[c] : b[e] : void (g ? g.scrollTo(d ? a.pageXOffset : f, d ? f : a.pageYOffset) : b[e] = f);
            }, b, e, arguments.length, null);
        };
    }), n.each([ "top", "left" ], function(a, b) {
        n.cssHooks[b] = ya(k.pixelPosition, function(a, c) {
            return c ? (c = xa(a, b), va.test(c) ? n(a).position()[b] + "px" : c) : void 0;
        });
    }), n.each({
        Height: "height",
        Width: "width"
    }, function(a, b) {
        n.each({
            padding: "inner" + a,
            content: b,
            "": "outer" + a
        }, function(c, d) {
            n.fn[d] = function(d, e) {
                var f = arguments.length && (c || "boolean" != typeof d), g = c || (d === !0 || e === !0 ? "margin" : "border");
                return J(this, function(b, c, d) {
                    var e;
                    return n.isWindow(b) ? b.document.documentElement["client" + a] : 9 === b.nodeType ? (e = b.documentElement, 
                    Math.max(b.body["scroll" + a], e["scroll" + a], b.body["offset" + a], e["offset" + a], e["client" + a])) : void 0 === d ? n.css(b, c, g) : n.style(b, c, d, g);
                }, b, f ? d : void 0, f, null);
            };
        });
    }), n.fn.size = function() {
        return this.length;
    }, n.fn.andSelf = n.fn.addBack, "function" == typeof define && define.amd && define("jquery", [], function() {
        return n;
    });
    var Kb = a.jQuery, Lb = a.$;
    return n.noConflict = function(b) {
        return a.$ === n && (a.$ = Lb), b && a.jQuery === n && (a.jQuery = Kb), n;
    }, typeof b === U && (a.jQuery = a.$ = n), n;
}), function(window, document, undefined) {
    function minErr(module, ErrorConstructor) {
        return ErrorConstructor = ErrorConstructor || Error, function() {
            var paramPrefix, i, SKIP_INDEXES = 2, templateArgs = arguments, code = templateArgs[0], message = "[" + (module ? module + ":" : "") + code + "] ", template = templateArgs[1];
            for (message += template.replace(/\{\d+\}/g, function(match) {
                var index = +match.slice(1, -1), shiftedIndex = index + SKIP_INDEXES;
                return shiftedIndex < templateArgs.length ? toDebugString(templateArgs[shiftedIndex]) : match;
            }), message += "\nhttp://errors.angularjs.org/1.4.0/" + (module ? module + "/" : "") + code, 
            i = SKIP_INDEXES, paramPrefix = "?"; i < templateArgs.length; i++, paramPrefix = "&") message += paramPrefix + "p" + (i - SKIP_INDEXES) + "=" + encodeURIComponent(toDebugString(templateArgs[i]));
            return new ErrorConstructor(message);
        };
    }
    function isArrayLike(obj) {
        if (null == obj || isWindow(obj)) return !1;
        var length = "length" in Object(obj) && obj.length;
        return obj.nodeType === NODE_TYPE_ELEMENT && length ? !0 : isString(obj) || isArray(obj) || 0 === length || "number" == typeof length && length > 0 && length - 1 in obj;
    }
    function forEach(obj, iterator, context) {
        var key, length;
        if (obj) if (isFunction(obj)) for (key in obj) "prototype" == key || "length" == key || "name" == key || obj.hasOwnProperty && !obj.hasOwnProperty(key) || iterator.call(context, obj[key], key, obj); else if (isArray(obj) || isArrayLike(obj)) {
            var isPrimitive = "object" != typeof obj;
            for (key = 0, length = obj.length; length > key; key++) (isPrimitive || key in obj) && iterator.call(context, obj[key], key, obj);
        } else if (obj.forEach && obj.forEach !== forEach) obj.forEach(iterator, context, obj); else if (isBlankObject(obj)) for (key in obj) iterator.call(context, obj[key], key, obj); else if ("function" == typeof obj.hasOwnProperty) for (key in obj) obj.hasOwnProperty(key) && iterator.call(context, obj[key], key, obj); else for (key in obj) hasOwnProperty.call(obj, key) && iterator.call(context, obj[key], key, obj);
        return obj;
    }
    function forEachSorted(obj, iterator, context) {
        for (var keys = Object.keys(obj).sort(), i = 0; i < keys.length; i++) iterator.call(context, obj[keys[i]], keys[i]);
        return keys;
    }
    function reverseParams(iteratorFn) {
        return function(value, key) {
            iteratorFn(key, value);
        };
    }
    function nextUid() {
        return ++uid;
    }
    function setHashKey(obj, h) {
        h ? obj.$$hashKey = h : delete obj.$$hashKey;
    }
    function baseExtend(dst, objs, deep) {
        for (var h = dst.$$hashKey, i = 0, ii = objs.length; ii > i; ++i) {
            var obj = objs[i];
            if (isObject(obj) || isFunction(obj)) for (var keys = Object.keys(obj), j = 0, jj = keys.length; jj > j; j++) {
                var key = keys[j], src = obj[key];
                deep && isObject(src) ? (isObject(dst[key]) || (dst[key] = isArray(src) ? [] : {}), 
                baseExtend(dst[key], [ src ], !0)) : dst[key] = src;
            }
        }
        return setHashKey(dst, h), dst;
    }
    function extend(dst) {
        return baseExtend(dst, slice.call(arguments, 1), !1);
    }
    function merge(dst) {
        return baseExtend(dst, slice.call(arguments, 1), !0);
    }
    function toInt(str) {
        return parseInt(str, 10);
    }
    function inherit(parent, extra) {
        return extend(Object.create(parent), extra);
    }
    function noop() {}
    function identity($) {
        return $;
    }
    function valueFn(value) {
        return function() {
            return value;
        };
    }
    function isUndefined(value) {
        return "undefined" == typeof value;
    }
    function isDefined(value) {
        return "undefined" != typeof value;
    }
    function isObject(value) {
        return null !== value && "object" == typeof value;
    }
    function isBlankObject(value) {
        return null !== value && "object" == typeof value && !getPrototypeOf(value);
    }
    function isString(value) {
        return "string" == typeof value;
    }
    function isNumber(value) {
        return "number" == typeof value;
    }
    function isDate(value) {
        return "[object Date]" === toString.call(value);
    }
    function isFunction(value) {
        return "function" == typeof value;
    }
    function isRegExp(value) {
        return "[object RegExp]" === toString.call(value);
    }
    function isWindow(obj) {
        return obj && obj.window === obj;
    }
    function isScope(obj) {
        return obj && obj.$evalAsync && obj.$watch;
    }
    function isFile(obj) {
        return "[object File]" === toString.call(obj);
    }
    function isFormData(obj) {
        return "[object FormData]" === toString.call(obj);
    }
    function isBlob(obj) {
        return "[object Blob]" === toString.call(obj);
    }
    function isBoolean(value) {
        return "boolean" == typeof value;
    }
    function isPromiseLike(obj) {
        return obj && isFunction(obj.then);
    }
    function isTypedArray(value) {
        return TYPED_ARRAY_REGEXP.test(toString.call(value));
    }
    function isElement(node) {
        return !(!node || !(node.nodeName || node.prop && node.attr && node.find));
    }
    function makeMap(str) {
        var i, obj = {}, items = str.split(",");
        for (i = 0; i < items.length; i++) obj[items[i]] = !0;
        return obj;
    }
    function nodeName_(element) {
        return lowercase(element.nodeName || element[0] && element[0].nodeName);
    }
    function arrayRemove(array, value) {
        var index = array.indexOf(value);
        return index >= 0 && array.splice(index, 1), index;
    }
    function copy(source, destination, stackSource, stackDest) {
        function putValue(key, val, destination, stackSource, stackDest) {
            var result = copy(val, null, stackSource, stackDest);
            isObject(val) && (stackSource.push(val), stackDest.push(result)), destination[key] = result;
        }
        if (isWindow(source) || isScope(source)) throw ngMinErr("cpws", "Can't copy! Making copies of Window or Scope instances is not supported.");
        if (isTypedArray(destination)) throw ngMinErr("cpta", "Can't copy! TypedArray destination cannot be mutated.");
        if (destination) {
            if (source === destination) throw ngMinErr("cpi", "Can't copy! Source and destination are identical.");
            if (stackSource = stackSource || [], stackDest = stackDest || [], isObject(source)) {
                var index = stackSource.indexOf(source);
                if (-1 !== index) return stackDest[index];
                stackSource.push(source), stackDest.push(destination);
            }
            var result, key;
            if (isArray(source)) {
                destination.length = 0;
                for (var i = 0; i < source.length; i++) result = copy(source[i], null, stackSource, stackDest), 
                isObject(source[i]) && (stackSource.push(source[i]), stackDest.push(result)), destination.push(result);
            } else {
                var h = destination.$$hashKey;
                if (isArray(destination) ? destination.length = 0 : forEach(destination, function(value, key) {
                    delete destination[key];
                }), isBlankObject(source)) for (key in source) putValue(key, source[key], destination, stackSource, stackDest); else if (source && "function" == typeof source.hasOwnProperty) for (key in source) source.hasOwnProperty(key) && putValue(key, source[key], destination, stackSource, stackDest); else for (key in source) hasOwnProperty.call(source, key) && putValue(key, source[key], destination, stackSource, stackDest);
                setHashKey(destination, h);
            }
        } else if (destination = source, source) if (isArray(source)) destination = copy(source, [], stackSource, stackDest); else if (isTypedArray(source)) destination = new source.constructor(source); else if (isDate(source)) destination = new Date(source.getTime()); else if (isRegExp(source)) destination = new RegExp(source.source, source.toString().match(/[^\/]*$/)[0]), 
        destination.lastIndex = source.lastIndex; else if (isObject(source)) {
            var emptyObject = Object.create(getPrototypeOf(source));
            destination = copy(source, emptyObject, stackSource, stackDest);
        }
        return destination;
    }
    function shallowCopy(src, dst) {
        if (isArray(src)) {
            dst = dst || [];
            for (var i = 0, ii = src.length; ii > i; i++) dst[i] = src[i];
        } else if (isObject(src)) {
            dst = dst || {};
            for (var key in src) ("$" !== key.charAt(0) || "$" !== key.charAt(1)) && (dst[key] = src[key]);
        }
        return dst || src;
    }
    function equals(o1, o2) {
        if (o1 === o2) return !0;
        if (null === o1 || null === o2) return !1;
        if (o1 !== o1 && o2 !== o2) return !0;
        var length, key, keySet, t1 = typeof o1, t2 = typeof o2;
        if (t1 == t2 && "object" == t1) {
            if (!isArray(o1)) {
                if (isDate(o1)) return isDate(o2) ? equals(o1.getTime(), o2.getTime()) : !1;
                if (isRegExp(o1)) return isRegExp(o2) ? o1.toString() == o2.toString() : !1;
                if (isScope(o1) || isScope(o2) || isWindow(o1) || isWindow(o2) || isArray(o2) || isDate(o2) || isRegExp(o2)) return !1;
                keySet = createMap();
                for (key in o1) if ("$" !== key.charAt(0) && !isFunction(o1[key])) {
                    if (!equals(o1[key], o2[key])) return !1;
                    keySet[key] = !0;
                }
                for (key in o2) if (!(key in keySet || "$" === key.charAt(0) || o2[key] === undefined || isFunction(o2[key]))) return !1;
                return !0;
            }
            if (!isArray(o2)) return !1;
            if ((length = o1.length) == o2.length) {
                for (key = 0; length > key; key++) if (!equals(o1[key], o2[key])) return !1;
                return !0;
            }
        }
        return !1;
    }
    function concat(array1, array2, index) {
        return array1.concat(slice.call(array2, index));
    }
    function sliceArgs(args, startIndex) {
        return slice.call(args, startIndex || 0);
    }
    function bind(self, fn) {
        var curryArgs = arguments.length > 2 ? sliceArgs(arguments, 2) : [];
        return !isFunction(fn) || fn instanceof RegExp ? fn : curryArgs.length ? function() {
            return arguments.length ? fn.apply(self, concat(curryArgs, arguments, 0)) : fn.apply(self, curryArgs);
        } : function() {
            return arguments.length ? fn.apply(self, arguments) : fn.call(self);
        };
    }
    function toJsonReplacer(key, value) {
        var val = value;
        return "string" == typeof key && "$" === key.charAt(0) && "$" === key.charAt(1) ? val = undefined : isWindow(value) ? val = "$WINDOW" : value && document === value ? val = "$DOCUMENT" : isScope(value) && (val = "$SCOPE"), 
        val;
    }
    function toJson(obj, pretty) {
        return "undefined" == typeof obj ? undefined : (isNumber(pretty) || (pretty = pretty ? 2 : null), 
        JSON.stringify(obj, toJsonReplacer, pretty));
    }
    function fromJson(json) {
        return isString(json) ? JSON.parse(json) : json;
    }
    function timezoneToOffset(timezone, fallback) {
        var requestedTimezoneOffset = Date.parse("Jan 01, 1970 00:00:00 " + timezone) / 6e4;
        return isNaN(requestedTimezoneOffset) ? fallback : requestedTimezoneOffset;
    }
    function addDateMinutes(date, minutes) {
        return date = new Date(date.getTime()), date.setMinutes(date.getMinutes() + minutes), 
        date;
    }
    function convertTimezoneToLocal(date, timezone, reverse) {
        reverse = reverse ? -1 : 1;
        var timezoneOffset = timezoneToOffset(timezone, date.getTimezoneOffset());
        return addDateMinutes(date, reverse * (timezoneOffset - date.getTimezoneOffset()));
    }
    function startingTag(element) {
        element = jqLite(element).clone();
        try {
            element.empty();
        } catch (e) {}
        var elemHtml = jqLite("<div>").append(element).html();
        try {
            return element[0].nodeType === NODE_TYPE_TEXT ? lowercase(elemHtml) : elemHtml.match(/^(<[^>]+>)/)[1].replace(/^<([\w\-]+)/, function(match, nodeName) {
                return "<" + lowercase(nodeName);
            });
        } catch (e) {
            return lowercase(elemHtml);
        }
    }
    function tryDecodeURIComponent(value) {
        try {
            return decodeURIComponent(value);
        } catch (e) {}
    }
    function parseKeyValue(keyValue) {
        var key_value, key, obj = {};
        return forEach((keyValue || "").split("&"), function(keyValue) {
            if (keyValue && (key_value = keyValue.replace(/\+/g, "%20").split("="), key = tryDecodeURIComponent(key_value[0]), 
            isDefined(key))) {
                var val = isDefined(key_value[1]) ? tryDecodeURIComponent(key_value[1]) : !0;
                hasOwnProperty.call(obj, key) ? isArray(obj[key]) ? obj[key].push(val) : obj[key] = [ obj[key], val ] : obj[key] = val;
            }
        }), obj;
    }
    function toKeyValue(obj) {
        var parts = [];
        return forEach(obj, function(value, key) {
            isArray(value) ? forEach(value, function(arrayValue) {
                parts.push(encodeUriQuery(key, !0) + (arrayValue === !0 ? "" : "=" + encodeUriQuery(arrayValue, !0)));
            }) : parts.push(encodeUriQuery(key, !0) + (value === !0 ? "" : "=" + encodeUriQuery(value, !0)));
        }), parts.length ? parts.join("&") : "";
    }
    function encodeUriSegment(val) {
        return encodeUriQuery(val, !0).replace(/%26/gi, "&").replace(/%3D/gi, "=").replace(/%2B/gi, "+");
    }
    function encodeUriQuery(val, pctEncodeSpaces) {
        return encodeURIComponent(val).replace(/%40/gi, "@").replace(/%3A/gi, ":").replace(/%24/g, "$").replace(/%2C/gi, ",").replace(/%3B/gi, ";").replace(/%20/g, pctEncodeSpaces ? "%20" : "+");
    }
    function getNgAttribute(element, ngAttr) {
        var attr, i, ii = ngAttrPrefixes.length;
        for (i = 0; ii > i; ++i) if (attr = ngAttrPrefixes[i] + ngAttr, isString(attr = element.getAttribute(attr))) return attr;
        return null;
    }
    function angularInit(element, bootstrap) {
        var appElement, module, config = {};
        forEach(ngAttrPrefixes, function(prefix) {
            var name = prefix + "app";
            !appElement && element.hasAttribute && element.hasAttribute(name) && (appElement = element, 
            module = element.getAttribute(name));
        }), forEach(ngAttrPrefixes, function(prefix) {
            var candidate, name = prefix + "app";
            !appElement && (candidate = element.querySelector("[" + name.replace(":", "\\:") + "]")) && (appElement = candidate, 
            module = candidate.getAttribute(name));
        }), appElement && (config.strictDi = null !== getNgAttribute(appElement, "strict-di"), 
        bootstrap(appElement, module ? [ module ] : [], config));
    }
    function bootstrap(element, modules, config) {
        isObject(config) || (config = {});
        var defaultConfig = {
            strictDi: !1
        };
        config = extend(defaultConfig, config);
        var doBootstrap = function() {
            if (element = jqLite(element), element.injector()) {
                var tag = element[0] === document ? "document" : startingTag(element);
                throw ngMinErr("btstrpd", "App Already Bootstrapped with this Element '{0}'", tag.replace(/</, "&lt;").replace(/>/, "&gt;"));
            }
            modules = modules || [], modules.unshift([ "$provide", function($provide) {
                $provide.value("$rootElement", element);
            } ]), config.debugInfoEnabled && modules.push([ "$compileProvider", function($compileProvider) {
                $compileProvider.debugInfoEnabled(!0);
            } ]), modules.unshift("ng");
            var injector = createInjector(modules, config.strictDi);
            return injector.invoke([ "$rootScope", "$rootElement", "$compile", "$injector", function(scope, element, compile, injector) {
                scope.$apply(function() {
                    element.data("$injector", injector), compile(element)(scope);
                });
            } ]), injector;
        }, NG_ENABLE_DEBUG_INFO = /^NG_ENABLE_DEBUG_INFO!/, NG_DEFER_BOOTSTRAP = /^NG_DEFER_BOOTSTRAP!/;
        return window && NG_ENABLE_DEBUG_INFO.test(window.name) && (config.debugInfoEnabled = !0, 
        window.name = window.name.replace(NG_ENABLE_DEBUG_INFO, "")), window && !NG_DEFER_BOOTSTRAP.test(window.name) ? doBootstrap() : (window.name = window.name.replace(NG_DEFER_BOOTSTRAP, ""), 
        angular.resumeBootstrap = function(extraModules) {
            return forEach(extraModules, function(module) {
                modules.push(module);
            }), doBootstrap();
        }, void (isFunction(angular.resumeDeferredBootstrap) && angular.resumeDeferredBootstrap()));
    }
    function reloadWithDebugInfo() {
        window.name = "NG_ENABLE_DEBUG_INFO!" + window.name, window.location.reload();
    }
    function getTestability(rootElement) {
        var injector = angular.element(rootElement).injector();
        if (!injector) throw ngMinErr("test", "no injector found for element argument to getTestability");
        return injector.get("$$testability");
    }
    function snake_case(name, separator) {
        return separator = separator || "_", name.replace(SNAKE_CASE_REGEXP, function(letter, pos) {
            return (pos ? separator : "") + letter.toLowerCase();
        });
    }
    function bindJQuery() {
        var originalCleanData;
        if (!bindJQueryFired) {
            var jqName = jq();
            jQuery = window.jQuery, isDefined(jqName) && (jQuery = null === jqName ? undefined : window[jqName]), 
            jQuery && jQuery.fn.on ? (jqLite = jQuery, extend(jQuery.fn, {
                scope: JQLitePrototype.scope,
                isolateScope: JQLitePrototype.isolateScope,
                controller: JQLitePrototype.controller,
                injector: JQLitePrototype.injector,
                inheritedData: JQLitePrototype.inheritedData
            }), originalCleanData = jQuery.cleanData, jQuery.cleanData = function(elems) {
                var events;
                if (skipDestroyOnNextJQueryCleanData) skipDestroyOnNextJQueryCleanData = !1; else for (var elem, i = 0; null != (elem = elems[i]); i++) events = jQuery._data(elem, "events"), 
                events && events.$destroy && jQuery(elem).triggerHandler("$destroy");
                originalCleanData(elems);
            }) : jqLite = JQLite, angular.element = jqLite, bindJQueryFired = !0;
        }
    }
    function assertArg(arg, name, reason) {
        if (!arg) throw ngMinErr("areq", "Argument '{0}' is {1}", name || "?", reason || "required");
        return arg;
    }
    function assertArgFn(arg, name, acceptArrayAnnotation) {
        return acceptArrayAnnotation && isArray(arg) && (arg = arg[arg.length - 1]), assertArg(isFunction(arg), name, "not a function, got " + (arg && "object" == typeof arg ? arg.constructor.name || "Object" : typeof arg)), 
        arg;
    }
    function assertNotHasOwnProperty(name, context) {
        if ("hasOwnProperty" === name) throw ngMinErr("badname", "hasOwnProperty is not a valid {0} name", context);
    }
    function getter(obj, path, bindFnToScope) {
        if (!path) return obj;
        for (var key, keys = path.split("."), lastInstance = obj, len = keys.length, i = 0; len > i; i++) key = keys[i], 
        obj && (obj = (lastInstance = obj)[key]);
        return !bindFnToScope && isFunction(obj) ? bind(lastInstance, obj) : obj;
    }
    function getBlockNodes(nodes) {
        var node = nodes[0], endNode = nodes[nodes.length - 1], blockNodes = [ node ];
        do {
            if (node = node.nextSibling, !node) break;
            blockNodes.push(node);
        } while (node !== endNode);
        return jqLite(blockNodes);
    }
    function createMap() {
        return Object.create(null);
    }
    function setupModuleLoader(window) {
        function ensure(obj, name, factory) {
            return obj[name] || (obj[name] = factory());
        }
        var $injectorMinErr = minErr("$injector"), ngMinErr = minErr("ng"), angular = ensure(window, "angular", Object);
        return angular.$$minErr = angular.$$minErr || minErr, ensure(angular, "module", function() {
            var modules = {};
            return function(name, requires, configFn) {
                var assertNotHasOwnProperty = function(name, context) {
                    if ("hasOwnProperty" === name) throw ngMinErr("badname", "hasOwnProperty is not a valid {0} name", context);
                };
                return assertNotHasOwnProperty(name, "module"), requires && modules.hasOwnProperty(name) && (modules[name] = null), 
                ensure(modules, name, function() {
                    function invokeLater(provider, method, insertMethod, queue) {
                        return queue || (queue = invokeQueue), function() {
                            return queue[insertMethod || "push"]([ provider, method, arguments ]), moduleInstance;
                        };
                    }
                    if (!requires) throw $injectorMinErr("nomod", "Module '{0}' is not available! You either misspelled the module name or forgot to load it. If registering a module ensure that you specify the dependencies as the second argument.", name);
                    var invokeQueue = [], configBlocks = [], runBlocks = [], config = invokeLater("$injector", "invoke", "push", configBlocks), moduleInstance = {
                        _invokeQueue: invokeQueue,
                        _configBlocks: configBlocks,
                        _runBlocks: runBlocks,
                        requires: requires,
                        name: name,
                        provider: invokeLater("$provide", "provider"),
                        factory: invokeLater("$provide", "factory"),
                        service: invokeLater("$provide", "service"),
                        value: invokeLater("$provide", "value"),
                        constant: invokeLater("$provide", "constant", "unshift"),
                        decorator: invokeLater("$provide", "decorator"),
                        animation: invokeLater("$animateProvider", "register"),
                        filter: invokeLater("$filterProvider", "register"),
                        controller: invokeLater("$controllerProvider", "register"),
                        directive: invokeLater("$compileProvider", "directive"),
                        config: config,
                        run: function(block) {
                            return runBlocks.push(block), this;
                        }
                    };
                    return configFn && config(configFn), moduleInstance;
                });
            };
        });
    }
    function serializeObject(obj) {
        var seen = [];
        return JSON.stringify(obj, function(key, val) {
            if (val = toJsonReplacer(key, val), isObject(val)) {
                if (seen.indexOf(val) >= 0) return "<<already seen>>";
                seen.push(val);
            }
            return val;
        });
    }
    function toDebugString(obj) {
        return "function" == typeof obj ? obj.toString().replace(/ \{[\s\S]*$/, "") : "undefined" == typeof obj ? "undefined" : "string" != typeof obj ? serializeObject(obj) : obj;
    }
    function publishExternalAPI(angular) {
        extend(angular, {
            bootstrap: bootstrap,
            copy: copy,
            extend: extend,
            merge: merge,
            equals: equals,
            element: jqLite,
            forEach: forEach,
            injector: createInjector,
            noop: noop,
            bind: bind,
            toJson: toJson,
            fromJson: fromJson,
            identity: identity,
            isUndefined: isUndefined,
            isDefined: isDefined,
            isString: isString,
            isFunction: isFunction,
            isObject: isObject,
            isNumber: isNumber,
            isElement: isElement,
            isArray: isArray,
            version: version,
            isDate: isDate,
            lowercase: lowercase,
            uppercase: uppercase,
            callbacks: {
                counter: 0
            },
            getTestability: getTestability,
            $$minErr: minErr,
            $$csp: csp,
            reloadWithDebugInfo: reloadWithDebugInfo
        }), angularModule = setupModuleLoader(window);
        try {
            angularModule("ngLocale");
        } catch (e) {
            angularModule("ngLocale", []).provider("$locale", $LocaleProvider);
        }
        angularModule("ng", [ "ngLocale" ], [ "$provide", function($provide) {
            $provide.provider({
                $$sanitizeUri: $$SanitizeUriProvider
            }), $provide.provider("$compile", $CompileProvider).directive({
                a: htmlAnchorDirective,
                input: inputDirective,
                textarea: inputDirective,
                form: formDirective,
                script: scriptDirective,
                select: selectDirective,
                style: styleDirective,
                option: optionDirective,
                ngBind: ngBindDirective,
                ngBindHtml: ngBindHtmlDirective,
                ngBindTemplate: ngBindTemplateDirective,
                ngClass: ngClassDirective,
                ngClassEven: ngClassEvenDirective,
                ngClassOdd: ngClassOddDirective,
                ngCloak: ngCloakDirective,
                ngController: ngControllerDirective,
                ngForm: ngFormDirective,
                ngHide: ngHideDirective,
                ngIf: ngIfDirective,
                ngInclude: ngIncludeDirective,
                ngInit: ngInitDirective,
                ngNonBindable: ngNonBindableDirective,
                ngPluralize: ngPluralizeDirective,
                ngRepeat: ngRepeatDirective,
                ngShow: ngShowDirective,
                ngStyle: ngStyleDirective,
                ngSwitch: ngSwitchDirective,
                ngSwitchWhen: ngSwitchWhenDirective,
                ngSwitchDefault: ngSwitchDefaultDirective,
                ngOptions: ngOptionsDirective,
                ngTransclude: ngTranscludeDirective,
                ngModel: ngModelDirective,
                ngList: ngListDirective,
                ngChange: ngChangeDirective,
                pattern: patternDirective,
                ngPattern: patternDirective,
                required: requiredDirective,
                ngRequired: requiredDirective,
                minlength: minlengthDirective,
                ngMinlength: minlengthDirective,
                maxlength: maxlengthDirective,
                ngMaxlength: maxlengthDirective,
                ngValue: ngValueDirective,
                ngModelOptions: ngModelOptionsDirective
            }).directive({
                ngInclude: ngIncludeFillContentDirective
            }).directive(ngAttributeAliasDirectives).directive(ngEventDirectives), $provide.provider({
                $anchorScroll: $AnchorScrollProvider,
                $animate: $AnimateProvider,
                $$animateQueue: $$CoreAnimateQueueProvider,
                $$AnimateRunner: $$CoreAnimateRunnerProvider,
                $browser: $BrowserProvider,
                $cacheFactory: $CacheFactoryProvider,
                $controller: $ControllerProvider,
                $document: $DocumentProvider,
                $exceptionHandler: $ExceptionHandlerProvider,
                $filter: $FilterProvider,
                $interpolate: $InterpolateProvider,
                $interval: $IntervalProvider,
                $http: $HttpProvider,
                $httpParamSerializer: $HttpParamSerializerProvider,
                $httpParamSerializerJQLike: $HttpParamSerializerJQLikeProvider,
                $httpBackend: $HttpBackendProvider,
                $location: $LocationProvider,
                $log: $LogProvider,
                $parse: $ParseProvider,
                $rootScope: $RootScopeProvider,
                $q: $QProvider,
                $$q: $$QProvider,
                $sce: $SceProvider,
                $sceDelegate: $SceDelegateProvider,
                $sniffer: $SnifferProvider,
                $templateCache: $TemplateCacheProvider,
                $templateRequest: $TemplateRequestProvider,
                $$testability: $$TestabilityProvider,
                $timeout: $TimeoutProvider,
                $window: $WindowProvider,
                $$rAF: $$RAFProvider,
                $$asyncCallback: $$AsyncCallbackProvider,
                $$jqLite: $$jqLiteProvider,
                $$HashMap: $$HashMapProvider,
                $$cookieReader: $$CookieReaderProvider
            });
        } ]);
    }
    function jqNextId() {
        return ++jqId;
    }
    function camelCase(name) {
        return name.replace(SPECIAL_CHARS_REGEXP, function(_, separator, letter, offset) {
            return offset ? letter.toUpperCase() : letter;
        }).replace(MOZ_HACK_REGEXP, "Moz$1");
    }
    function jqLiteIsTextNode(html) {
        return !HTML_REGEXP.test(html);
    }
    function jqLiteAcceptsData(node) {
        var nodeType = node.nodeType;
        return nodeType === NODE_TYPE_ELEMENT || !nodeType || nodeType === NODE_TYPE_DOCUMENT;
    }
    function jqLiteBuildFragment(html, context) {
        var tmp, tag, wrap, i, fragment = context.createDocumentFragment(), nodes = [];
        if (jqLiteIsTextNode(html)) nodes.push(context.createTextNode(html)); else {
            for (tmp = tmp || fragment.appendChild(context.createElement("div")), tag = (TAG_NAME_REGEXP.exec(html) || [ "", "" ])[1].toLowerCase(), 
            wrap = wrapMap[tag] || wrapMap._default, tmp.innerHTML = wrap[1] + html.replace(XHTML_TAG_REGEXP, "<$1></$2>") + wrap[2], 
            i = wrap[0]; i--; ) tmp = tmp.lastChild;
            nodes = concat(nodes, tmp.childNodes), tmp = fragment.firstChild, tmp.textContent = "";
        }
        return fragment.textContent = "", fragment.innerHTML = "", forEach(nodes, function(node) {
            fragment.appendChild(node);
        }), fragment;
    }
    function jqLiteParseHTML(html, context) {
        context = context || document;
        var parsed;
        return (parsed = SINGLE_TAG_REGEXP.exec(html)) ? [ context.createElement(parsed[1]) ] : (parsed = jqLiteBuildFragment(html, context)) ? parsed.childNodes : [];
    }
    function JQLite(element) {
        if (element instanceof JQLite) return element;
        var argIsString;
        if (isString(element) && (element = trim(element), argIsString = !0), !(this instanceof JQLite)) {
            if (argIsString && "<" != element.charAt(0)) throw jqLiteMinErr("nosel", "Looking up elements via selectors is not supported by jqLite! See: http://docs.angularjs.org/api/angular.element");
            return new JQLite(element);
        }
        argIsString ? jqLiteAddNodes(this, jqLiteParseHTML(element)) : jqLiteAddNodes(this, element);
    }
    function jqLiteClone(element) {
        return element.cloneNode(!0);
    }
    function jqLiteDealoc(element, onlyDescendants) {
        if (onlyDescendants || jqLiteRemoveData(element), element.querySelectorAll) for (var descendants = element.querySelectorAll("*"), i = 0, l = descendants.length; l > i; i++) jqLiteRemoveData(descendants[i]);
    }
    function jqLiteOff(element, type, fn, unsupported) {
        if (isDefined(unsupported)) throw jqLiteMinErr("offargs", "jqLite#off() does not support the `selector` argument");
        var expandoStore = jqLiteExpandoStore(element), events = expandoStore && expandoStore.events, handle = expandoStore && expandoStore.handle;
        if (handle) if (type) forEach(type.split(" "), function(type) {
            if (isDefined(fn)) {
                var listenerFns = events[type];
                if (arrayRemove(listenerFns || [], fn), listenerFns && listenerFns.length > 0) return;
            }
            removeEventListenerFn(element, type, handle), delete events[type];
        }); else for (type in events) "$destroy" !== type && removeEventListenerFn(element, type, handle), 
        delete events[type];
    }
    function jqLiteRemoveData(element, name) {
        var expandoId = element.ng339, expandoStore = expandoId && jqCache[expandoId];
        if (expandoStore) {
            if (name) return void delete expandoStore.data[name];
            expandoStore.handle && (expandoStore.events.$destroy && expandoStore.handle({}, "$destroy"), 
            jqLiteOff(element)), delete jqCache[expandoId], element.ng339 = undefined;
        }
    }
    function jqLiteExpandoStore(element, createIfNecessary) {
        var expandoId = element.ng339, expandoStore = expandoId && jqCache[expandoId];
        return createIfNecessary && !expandoStore && (element.ng339 = expandoId = jqNextId(), 
        expandoStore = jqCache[expandoId] = {
            events: {},
            data: {},
            handle: undefined
        }), expandoStore;
    }
    function jqLiteData(element, key, value) {
        if (jqLiteAcceptsData(element)) {
            var isSimpleSetter = isDefined(value), isSimpleGetter = !isSimpleSetter && key && !isObject(key), massGetter = !key, expandoStore = jqLiteExpandoStore(element, !isSimpleGetter), data = expandoStore && expandoStore.data;
            if (isSimpleSetter) data[key] = value; else {
                if (massGetter) return data;
                if (isSimpleGetter) return data && data[key];
                extend(data, key);
            }
        }
    }
    function jqLiteHasClass(element, selector) {
        return element.getAttribute ? (" " + (element.getAttribute("class") || "") + " ").replace(/[\n\t]/g, " ").indexOf(" " + selector + " ") > -1 : !1;
    }
    function jqLiteRemoveClass(element, cssClasses) {
        cssClasses && element.setAttribute && forEach(cssClasses.split(" "), function(cssClass) {
            element.setAttribute("class", trim((" " + (element.getAttribute("class") || "") + " ").replace(/[\n\t]/g, " ").replace(" " + trim(cssClass) + " ", " ")));
        });
    }
    function jqLiteAddClass(element, cssClasses) {
        if (cssClasses && element.setAttribute) {
            var existingClasses = (" " + (element.getAttribute("class") || "") + " ").replace(/[\n\t]/g, " ");
            forEach(cssClasses.split(" "), function(cssClass) {
                cssClass = trim(cssClass), -1 === existingClasses.indexOf(" " + cssClass + " ") && (existingClasses += cssClass + " ");
            }), element.setAttribute("class", trim(existingClasses));
        }
    }
    function jqLiteAddNodes(root, elements) {
        if (elements) if (elements.nodeType) root[root.length++] = elements; else {
            var length = elements.length;
            if ("number" == typeof length && elements.window !== elements) {
                if (length) for (var i = 0; length > i; i++) root[root.length++] = elements[i];
            } else root[root.length++] = elements;
        }
    }
    function jqLiteController(element, name) {
        return jqLiteInheritedData(element, "$" + (name || "ngController") + "Controller");
    }
    function jqLiteInheritedData(element, name, value) {
        element.nodeType == NODE_TYPE_DOCUMENT && (element = element.documentElement);
        for (var names = isArray(name) ? name : [ name ]; element; ) {
            for (var i = 0, ii = names.length; ii > i; i++) if ((value = jqLite.data(element, names[i])) !== undefined) return value;
            element = element.parentNode || element.nodeType === NODE_TYPE_DOCUMENT_FRAGMENT && element.host;
        }
    }
    function jqLiteEmpty(element) {
        for (jqLiteDealoc(element, !0); element.firstChild; ) element.removeChild(element.firstChild);
    }
    function jqLiteRemove(element, keepData) {
        keepData || jqLiteDealoc(element);
        var parent = element.parentNode;
        parent && parent.removeChild(element);
    }
    function jqLiteDocumentLoaded(action, win) {
        win = win || window, "complete" === win.document.readyState ? win.setTimeout(action) : jqLite(win).on("load", action);
    }
    function getBooleanAttrName(element, name) {
        var booleanAttr = BOOLEAN_ATTR[name.toLowerCase()];
        return booleanAttr && BOOLEAN_ELEMENTS[nodeName_(element)] && booleanAttr;
    }
    function getAliasedAttrName(element, name) {
        var nodeName = element.nodeName;
        return ("INPUT" === nodeName || "TEXTAREA" === nodeName) && ALIASED_ATTR[name];
    }
    function createEventHandler(element, events) {
        var eventHandler = function(event, type) {
            event.isDefaultPrevented = function() {
                return event.defaultPrevented;
            };
            var eventFns = events[type || event.type], eventFnsLength = eventFns ? eventFns.length : 0;
            if (eventFnsLength) {
                if (isUndefined(event.immediatePropagationStopped)) {
                    var originalStopImmediatePropagation = event.stopImmediatePropagation;
                    event.stopImmediatePropagation = function() {
                        event.immediatePropagationStopped = !0, event.stopPropagation && event.stopPropagation(), 
                        originalStopImmediatePropagation && originalStopImmediatePropagation.call(event);
                    };
                }
                event.isImmediatePropagationStopped = function() {
                    return event.immediatePropagationStopped === !0;
                }, eventFnsLength > 1 && (eventFns = shallowCopy(eventFns));
                for (var i = 0; eventFnsLength > i; i++) event.isImmediatePropagationStopped() || eventFns[i].call(element, event);
            }
        };
        return eventHandler.elem = element, eventHandler;
    }
    function $$jqLiteProvider() {
        this.$get = function() {
            return extend(JQLite, {
                hasClass: function(node, classes) {
                    return node.attr && (node = node[0]), jqLiteHasClass(node, classes);
                },
                addClass: function(node, classes) {
                    return node.attr && (node = node[0]), jqLiteAddClass(node, classes);
                },
                removeClass: function(node, classes) {
                    return node.attr && (node = node[0]), jqLiteRemoveClass(node, classes);
                }
            });
        };
    }
    function hashKey(obj, nextUidFn) {
        var key = obj && obj.$$hashKey;
        if (key) return "function" == typeof key && (key = obj.$$hashKey()), key;
        var objType = typeof obj;
        return key = "function" == objType || "object" == objType && null !== obj ? obj.$$hashKey = objType + ":" + (nextUidFn || nextUid)() : objType + ":" + obj;
    }
    function HashMap(array, isolatedUid) {
        if (isolatedUid) {
            var uid = 0;
            this.nextUid = function() {
                return ++uid;
            };
        }
        forEach(array, this.put, this);
    }
    function anonFn(fn) {
        var fnText = fn.toString().replace(STRIP_COMMENTS, ""), args = fnText.match(FN_ARGS);
        return args ? "function(" + (args[1] || "").replace(/[\s\r\n]+/, " ") + ")" : "fn";
    }
    function annotate(fn, strictDi, name) {
        var $inject, fnText, argDecl, last;
        if ("function" == typeof fn) {
            if (!($inject = fn.$inject)) {
                if ($inject = [], fn.length) {
                    if (strictDi) throw isString(name) && name || (name = fn.name || anonFn(fn)), $injectorMinErr("strictdi", "{0} is not using explicit annotation and cannot be invoked in strict mode", name);
                    fnText = fn.toString().replace(STRIP_COMMENTS, ""), argDecl = fnText.match(FN_ARGS), 
                    forEach(argDecl[1].split(FN_ARG_SPLIT), function(arg) {
                        arg.replace(FN_ARG, function(all, underscore, name) {
                            $inject.push(name);
                        });
                    });
                }
                fn.$inject = $inject;
            }
        } else isArray(fn) ? (last = fn.length - 1, assertArgFn(fn[last], "fn"), $inject = fn.slice(0, last)) : assertArgFn(fn, "fn", !0);
        return $inject;
    }
    function createInjector(modulesToLoad, strictDi) {
        function supportObject(delegate) {
            return function(key, value) {
                return isObject(key) ? void forEach(key, reverseParams(delegate)) : delegate(key, value);
            };
        }
        function provider(name, provider_) {
            if (assertNotHasOwnProperty(name, "service"), (isFunction(provider_) || isArray(provider_)) && (provider_ = providerInjector.instantiate(provider_)), 
            !provider_.$get) throw $injectorMinErr("pget", "Provider '{0}' must define $get factory method.", name);
            return providerCache[name + providerSuffix] = provider_;
        }
        function enforceReturnValue(name, factory) {
            return function() {
                var result = instanceInjector.invoke(factory, this);
                if (isUndefined(result)) throw $injectorMinErr("undef", "Provider '{0}' must return a value from $get factory method.", name);
                return result;
            };
        }
        function factory(name, factoryFn, enforce) {
            return provider(name, {
                $get: enforce !== !1 ? enforceReturnValue(name, factoryFn) : factoryFn
            });
        }
        function service(name, constructor) {
            return factory(name, [ "$injector", function($injector) {
                return $injector.instantiate(constructor);
            } ]);
        }
        function value(name, val) {
            return factory(name, valueFn(val), !1);
        }
        function constant(name, value) {
            assertNotHasOwnProperty(name, "constant"), providerCache[name] = value, instanceCache[name] = value;
        }
        function decorator(serviceName, decorFn) {
            var origProvider = providerInjector.get(serviceName + providerSuffix), orig$get = origProvider.$get;
            origProvider.$get = function() {
                var origInstance = instanceInjector.invoke(orig$get, origProvider);
                return instanceInjector.invoke(decorFn, null, {
                    $delegate: origInstance
                });
            };
        }
        function loadModules(modulesToLoad) {
            var moduleFn, runBlocks = [];
            return forEach(modulesToLoad, function(module) {
                function runInvokeQueue(queue) {
                    var i, ii;
                    for (i = 0, ii = queue.length; ii > i; i++) {
                        var invokeArgs = queue[i], provider = providerInjector.get(invokeArgs[0]);
                        provider[invokeArgs[1]].apply(provider, invokeArgs[2]);
                    }
                }
                if (!loadedModules.get(module)) {
                    loadedModules.put(module, !0);
                    try {
                        isString(module) ? (moduleFn = angularModule(module), runBlocks = runBlocks.concat(loadModules(moduleFn.requires)).concat(moduleFn._runBlocks), 
                        runInvokeQueue(moduleFn._invokeQueue), runInvokeQueue(moduleFn._configBlocks)) : isFunction(module) ? runBlocks.push(providerInjector.invoke(module)) : isArray(module) ? runBlocks.push(providerInjector.invoke(module)) : assertArgFn(module, "module");
                    } catch (e) {
                        throw isArray(module) && (module = module[module.length - 1]), e.message && e.stack && -1 == e.stack.indexOf(e.message) && (e = e.message + "\n" + e.stack), 
                        $injectorMinErr("modulerr", "Failed to instantiate module {0} due to:\n{1}", module, e.stack || e.message || e);
                    }
                }
            }), runBlocks;
        }
        function createInternalInjector(cache, factory) {
            function getService(serviceName, caller) {
                if (cache.hasOwnProperty(serviceName)) {
                    if (cache[serviceName] === INSTANTIATING) throw $injectorMinErr("cdep", "Circular dependency found: {0}", serviceName + " <- " + path.join(" <- "));
                    return cache[serviceName];
                }
                try {
                    return path.unshift(serviceName), cache[serviceName] = INSTANTIATING, cache[serviceName] = factory(serviceName, caller);
                } catch (err) {
                    throw cache[serviceName] === INSTANTIATING && delete cache[serviceName], err;
                } finally {
                    path.shift();
                }
            }
            function invoke(fn, self, locals, serviceName) {
                "string" == typeof locals && (serviceName = locals, locals = null);
                var length, i, key, args = [], $inject = createInjector.$$annotate(fn, strictDi, serviceName);
                for (i = 0, length = $inject.length; length > i; i++) {
                    if (key = $inject[i], "string" != typeof key) throw $injectorMinErr("itkn", "Incorrect injection token! Expected service name as string, got {0}", key);
                    args.push(locals && locals.hasOwnProperty(key) ? locals[key] : getService(key, serviceName));
                }
                return isArray(fn) && (fn = fn[length]), fn.apply(self, args);
            }
            function instantiate(Type, locals, serviceName) {
                var instance = Object.create((isArray(Type) ? Type[Type.length - 1] : Type).prototype || null), returnedValue = invoke(Type, instance, locals, serviceName);
                return isObject(returnedValue) || isFunction(returnedValue) ? returnedValue : instance;
            }
            return {
                invoke: invoke,
                instantiate: instantiate,
                get: getService,
                annotate: createInjector.$$annotate,
                has: function(name) {
                    return providerCache.hasOwnProperty(name + providerSuffix) || cache.hasOwnProperty(name);
                }
            };
        }
        strictDi = strictDi === !0;
        var INSTANTIATING = {}, providerSuffix = "Provider", path = [], loadedModules = new HashMap([], !0), providerCache = {
            $provide: {
                provider: supportObject(provider),
                factory: supportObject(factory),
                service: supportObject(service),
                value: supportObject(value),
                constant: supportObject(constant),
                decorator: decorator
            }
        }, providerInjector = providerCache.$injector = createInternalInjector(providerCache, function(serviceName, caller) {
            throw angular.isString(caller) && path.push(caller), $injectorMinErr("unpr", "Unknown provider: {0}", path.join(" <- "));
        }), instanceCache = {}, instanceInjector = instanceCache.$injector = createInternalInjector(instanceCache, function(serviceName, caller) {
            var provider = providerInjector.get(serviceName + providerSuffix, caller);
            return instanceInjector.invoke(provider.$get, provider, undefined, serviceName);
        });
        return forEach(loadModules(modulesToLoad), function(fn) {
            instanceInjector.invoke(fn || noop);
        }), instanceInjector;
    }
    function $AnchorScrollProvider() {
        var autoScrollingEnabled = !0;
        this.disableAutoScrolling = function() {
            autoScrollingEnabled = !1;
        }, this.$get = [ "$window", "$location", "$rootScope", function($window, $location, $rootScope) {
            function getFirstAnchor(list) {
                var result = null;
                return Array.prototype.some.call(list, function(element) {
                    return "a" === nodeName_(element) ? (result = element, !0) : void 0;
                }), result;
            }
            function getYOffset() {
                var offset = scroll.yOffset;
                if (isFunction(offset)) offset = offset(); else if (isElement(offset)) {
                    var elem = offset[0], style = $window.getComputedStyle(elem);
                    offset = "fixed" !== style.position ? 0 : elem.getBoundingClientRect().bottom;
                } else isNumber(offset) || (offset = 0);
                return offset;
            }
            function scrollTo(elem) {
                if (elem) {
                    elem.scrollIntoView();
                    var offset = getYOffset();
                    if (offset) {
                        var elemTop = elem.getBoundingClientRect().top;
                        $window.scrollBy(0, elemTop - offset);
                    }
                } else $window.scrollTo(0, 0);
            }
            function scroll(hash) {
                hash = isString(hash) ? hash : $location.hash();
                var elm;
                hash ? (elm = document.getElementById(hash)) ? scrollTo(elm) : (elm = getFirstAnchor(document.getElementsByName(hash))) ? scrollTo(elm) : "top" === hash && scrollTo(null) : scrollTo(null);
            }
            var document = $window.document;
            return autoScrollingEnabled && $rootScope.$watch(function() {
                return $location.hash();
            }, function(newVal, oldVal) {
                (newVal !== oldVal || "" !== newVal) && jqLiteDocumentLoaded(function() {
                    $rootScope.$evalAsync(scroll);
                });
            }), scroll;
        } ];
    }
    function mergeClasses(a, b) {
        return a || b ? a ? b ? (isArray(a) && (a = a.join(" ")), isArray(b) && (b = b.join(" ")), 
        a + " " + b) : a : b : "";
    }
    function extractElementNode(element) {
        for (var i = 0; i < element.length; i++) {
            var elm = element[i];
            if (elm.nodeType === ELEMENT_NODE) return elm;
        }
    }
    function splitClasses(classes) {
        isString(classes) && (classes = classes.split(" "));
        var obj = createMap();
        return forEach(classes, function(klass) {
            klass.length && (obj[klass] = !0);
        }), obj;
    }
    function prepareAnimateOptions(options) {
        return isObject(options) ? options : {};
    }
    function $$AsyncCallbackProvider() {
        this.$get = [ "$$rAF", "$timeout", function($$rAF, $timeout) {
            return $$rAF.supported ? function(fn) {
                return $$rAF(fn);
            } : function(fn) {
                return $timeout(fn, 0, !1);
            };
        } ];
    }
    function Browser(window, document, $log, $sniffer) {
        function completeOutstandingRequest(fn) {
            try {
                fn.apply(null, sliceArgs(arguments, 1));
            } finally {
                if (outstandingRequestCount--, 0 === outstandingRequestCount) for (;outstandingRequestCallbacks.length; ) try {
                    outstandingRequestCallbacks.pop()();
                } catch (e) {
                    $log.error(e);
                }
            }
        }
        function getHash(url) {
            var index = url.indexOf("#");
            return -1 === index ? "" : url.substr(index + 1);
        }
        function cacheStateAndFireUrlChange() {
            cacheState(), fireUrlChange();
        }
        function getCurrentState() {
            try {
                return history.state;
            } catch (e) {}
        }
        function cacheState() {
            cachedState = getCurrentState(), cachedState = isUndefined(cachedState) ? null : cachedState, 
            equals(cachedState, lastCachedState) && (cachedState = lastCachedState), lastCachedState = cachedState;
        }
        function fireUrlChange() {
            (lastBrowserUrl !== self.url() || lastHistoryState !== cachedState) && (lastBrowserUrl = self.url(), 
            lastHistoryState = cachedState, forEach(urlChangeListeners, function(listener) {
                listener(self.url(), cachedState);
            }));
        }
        var self = this, location = (document[0], window.location), history = window.history, setTimeout = window.setTimeout, clearTimeout = window.clearTimeout, pendingDeferIds = {};
        self.isMock = !1;
        var outstandingRequestCount = 0, outstandingRequestCallbacks = [];
        self.$$completeOutstandingRequest = completeOutstandingRequest, self.$$incOutstandingRequestCount = function() {
            outstandingRequestCount++;
        }, self.notifyWhenNoOutstandingRequests = function(callback) {
            0 === outstandingRequestCount ? callback() : outstandingRequestCallbacks.push(callback);
        };
        var cachedState, lastHistoryState, lastBrowserUrl = location.href, baseElement = document.find("base"), reloadLocation = null;
        cacheState(), lastHistoryState = cachedState, self.url = function(url, replace, state) {
            if (isUndefined(state) && (state = null), location !== window.location && (location = window.location), 
            history !== window.history && (history = window.history), url) {
                var sameState = lastHistoryState === state;
                if (lastBrowserUrl === url && (!$sniffer.history || sameState)) return self;
                var sameBase = lastBrowserUrl && stripHash(lastBrowserUrl) === stripHash(url);
                return lastBrowserUrl = url, lastHistoryState = state, !$sniffer.history || sameBase && sameState ? (sameBase || (reloadLocation = url), 
                replace ? location.replace(url) : sameBase ? location.hash = getHash(url) : location.href = url) : (history[replace ? "replaceState" : "pushState"](state, "", url), 
                cacheState(), lastHistoryState = cachedState), self;
            }
            return reloadLocation || location.href.replace(/%27/g, "'");
        }, self.state = function() {
            return cachedState;
        };
        var urlChangeListeners = [], urlChangeInit = !1, lastCachedState = null;
        self.onUrlChange = function(callback) {
            return urlChangeInit || ($sniffer.history && jqLite(window).on("popstate", cacheStateAndFireUrlChange), 
            jqLite(window).on("hashchange", cacheStateAndFireUrlChange), urlChangeInit = !0), 
            urlChangeListeners.push(callback), callback;
        }, self.$$applicationDestroyed = function() {
            jqLite(window).off("hashchange popstate", cacheStateAndFireUrlChange);
        }, self.$$checkUrlChange = fireUrlChange, self.baseHref = function() {
            var href = baseElement.attr("href");
            return href ? href.replace(/^(https?\:)?\/\/[^\/]*/, "") : "";
        }, self.defer = function(fn, delay) {
            var timeoutId;
            return outstandingRequestCount++, timeoutId = setTimeout(function() {
                delete pendingDeferIds[timeoutId], completeOutstandingRequest(fn);
            }, delay || 0), pendingDeferIds[timeoutId] = !0, timeoutId;
        }, self.defer.cancel = function(deferId) {
            return pendingDeferIds[deferId] ? (delete pendingDeferIds[deferId], clearTimeout(deferId), 
            completeOutstandingRequest(noop), !0) : !1;
        };
    }
    function $BrowserProvider() {
        this.$get = [ "$window", "$log", "$sniffer", "$document", function($window, $log, $sniffer, $document) {
            return new Browser($window, $document, $log, $sniffer);
        } ];
    }
    function $CacheFactoryProvider() {
        this.$get = function() {
            function cacheFactory(cacheId, options) {
                function refresh(entry) {
                    entry != freshEnd && (staleEnd ? staleEnd == entry && (staleEnd = entry.n) : staleEnd = entry, 
                    link(entry.n, entry.p), link(entry, freshEnd), freshEnd = entry, freshEnd.n = null);
                }
                function link(nextEntry, prevEntry) {
                    nextEntry != prevEntry && (nextEntry && (nextEntry.p = prevEntry), prevEntry && (prevEntry.n = nextEntry));
                }
                if (cacheId in caches) throw minErr("$cacheFactory")("iid", "CacheId '{0}' is already taken!", cacheId);
                var size = 0, stats = extend({}, options, {
                    id: cacheId
                }), data = {}, capacity = options && options.capacity || Number.MAX_VALUE, lruHash = {}, freshEnd = null, staleEnd = null;
                return caches[cacheId] = {
                    put: function(key, value) {
                        if (!isUndefined(value)) {
                            if (capacity < Number.MAX_VALUE) {
                                var lruEntry = lruHash[key] || (lruHash[key] = {
                                    key: key
                                });
                                refresh(lruEntry);
                            }
                            return key in data || size++, data[key] = value, size > capacity && this.remove(staleEnd.key), 
                            value;
                        }
                    },
                    get: function(key) {
                        if (capacity < Number.MAX_VALUE) {
                            var lruEntry = lruHash[key];
                            if (!lruEntry) return;
                            refresh(lruEntry);
                        }
                        return data[key];
                    },
                    remove: function(key) {
                        if (capacity < Number.MAX_VALUE) {
                            var lruEntry = lruHash[key];
                            if (!lruEntry) return;
                            lruEntry == freshEnd && (freshEnd = lruEntry.p), lruEntry == staleEnd && (staleEnd = lruEntry.n), 
                            link(lruEntry.n, lruEntry.p), delete lruHash[key];
                        }
                        delete data[key], size--;
                    },
                    removeAll: function() {
                        data = {}, size = 0, lruHash = {}, freshEnd = staleEnd = null;
                    },
                    destroy: function() {
                        data = null, stats = null, lruHash = null, delete caches[cacheId];
                    },
                    info: function() {
                        return extend({}, stats, {
                            size: size
                        });
                    }
                };
            }
            var caches = {};
            return cacheFactory.info = function() {
                var info = {};
                return forEach(caches, function(cache, cacheId) {
                    info[cacheId] = cache.info();
                }), info;
            }, cacheFactory.get = function(cacheId) {
                return caches[cacheId];
            }, cacheFactory;
        };
    }
    function $TemplateCacheProvider() {
        this.$get = [ "$cacheFactory", function($cacheFactory) {
            return $cacheFactory("templates");
        } ];
    }
    function $CompileProvider($provide, $$sanitizeUriProvider) {
        function parseIsolateBindings(scope, directiveName, isController) {
            var LOCAL_REGEXP = /^\s*([@&]|=(\*?))(\??)\s*(\w*)\s*$/, bindings = {};
            return forEach(scope, function(definition, scopeName) {
                var match = definition.match(LOCAL_REGEXP);
                if (!match) throw $compileMinErr("iscp", "Invalid {3} for directive '{0}'. Definition: {... {1}: '{2}' ...}", directiveName, scopeName, definition, isController ? "controller bindings definition" : "isolate scope definition");
                bindings[scopeName] = {
                    mode: match[1][0],
                    collection: "*" === match[2],
                    optional: "?" === match[3],
                    attrName: match[4] || scopeName
                };
            }), bindings;
        }
        function parseDirectiveBindings(directive, directiveName) {
            var bindings = {
                isolateScope: null,
                bindToController: null
            };
            if (isObject(directive.scope) && (directive.bindToController === !0 ? (bindings.bindToController = parseIsolateBindings(directive.scope, directiveName, !0), 
            bindings.isolateScope = {}) : bindings.isolateScope = parseIsolateBindings(directive.scope, directiveName, !1)), 
            isObject(directive.bindToController) && (bindings.bindToController = parseIsolateBindings(directive.bindToController, directiveName, !0)), 
            isObject(bindings.bindToController)) {
                var controller = directive.controller, controllerAs = directive.controllerAs;
                if (!controller) throw $compileMinErr("noctrl", "Cannot bind to controller without directive '{0}'s controller.", directiveName);
                if (!identifierForController(controller, controllerAs)) throw $compileMinErr("noident", "Cannot bind to controller without identifier for directive '{0}'.", directiveName);
            }
            return bindings;
        }
        function assertValidDirectiveName(name) {
            var letter = name.charAt(0);
            if (!letter || letter !== lowercase(letter)) throw $compileMinErr("baddir", "Directive name '{0}' is invalid. The first character must be a lowercase letter", name);
            if (name !== name.trim()) throw $compileMinErr("baddir", "Directive name '{0}' is invalid. The name should not contain leading or trailing whitespaces", name);
        }
        var hasDirectives = {}, Suffix = "Directive", COMMENT_DIRECTIVE_REGEXP = /^\s*directive\:\s*([\w\-]+)\s+(.*)$/, CLASS_DIRECTIVE_REGEXP = /(([\w\-]+)(?:\:([^;]+))?;?)/, ALL_OR_NOTHING_ATTRS = makeMap("ngSrc,ngSrcset,src,srcset"), REQUIRE_PREFIX_REGEXP = /^(?:(\^\^?)?(\?)?(\^\^?)?)?/, EVENT_HANDLER_ATTR_REGEXP = /^(on[a-z]+|formaction)$/;
        this.directive = function registerDirective(name, directiveFactory) {
            return assertNotHasOwnProperty(name, "directive"), isString(name) ? (assertValidDirectiveName(name), 
            assertArg(directiveFactory, "directiveFactory"), hasDirectives.hasOwnProperty(name) || (hasDirectives[name] = [], 
            $provide.factory(name + Suffix, [ "$injector", "$exceptionHandler", function($injector, $exceptionHandler) {
                var directives = [];
                return forEach(hasDirectives[name], function(directiveFactory, index) {
                    try {
                        var directive = $injector.invoke(directiveFactory);
                        isFunction(directive) ? directive = {
                            compile: valueFn(directive)
                        } : !directive.compile && directive.link && (directive.compile = valueFn(directive.link)), 
                        directive.priority = directive.priority || 0, directive.index = index, directive.name = directive.name || name, 
                        directive.require = directive.require || directive.controller && directive.name, 
                        directive.restrict = directive.restrict || "EA";
                        var bindings = directive.$$bindings = parseDirectiveBindings(directive, directive.name);
                        isObject(bindings.isolateScope) && (directive.$$isolateBindings = bindings.isolateScope), 
                        directives.push(directive);
                    } catch (e) {
                        $exceptionHandler(e);
                    }
                }), directives;
            } ])), hasDirectives[name].push(directiveFactory)) : forEach(name, reverseParams(registerDirective)), 
            this;
        }, this.aHrefSanitizationWhitelist = function(regexp) {
            return isDefined(regexp) ? ($$sanitizeUriProvider.aHrefSanitizationWhitelist(regexp), 
            this) : $$sanitizeUriProvider.aHrefSanitizationWhitelist();
        }, this.imgSrcSanitizationWhitelist = function(regexp) {
            return isDefined(regexp) ? ($$sanitizeUriProvider.imgSrcSanitizationWhitelist(regexp), 
            this) : $$sanitizeUriProvider.imgSrcSanitizationWhitelist();
        };
        var debugInfoEnabled = !0;
        this.debugInfoEnabled = function(enabled) {
            return isDefined(enabled) ? (debugInfoEnabled = enabled, this) : debugInfoEnabled;
        }, this.$get = [ "$injector", "$interpolate", "$exceptionHandler", "$templateRequest", "$parse", "$controller", "$rootScope", "$document", "$sce", "$animate", "$$sanitizeUri", function($injector, $interpolate, $exceptionHandler, $templateRequest, $parse, $controller, $rootScope, $document, $sce, $animate, $$sanitizeUri) {
            function safeAddClass($element, className) {
                try {
                    $element.addClass(className);
                } catch (e) {}
            }
            function compile($compileNodes, transcludeFn, maxPriority, ignoreDirective, previousCompileContext) {
                $compileNodes instanceof jqLite || ($compileNodes = jqLite($compileNodes)), forEach($compileNodes, function(node, index) {
                    node.nodeType == NODE_TYPE_TEXT && node.nodeValue.match(/\S+/) && ($compileNodes[index] = jqLite(node).wrap("<span></span>").parent()[0]);
                });
                var compositeLinkFn = compileNodes($compileNodes, transcludeFn, $compileNodes, maxPriority, ignoreDirective, previousCompileContext);
                compile.$$addScopeClass($compileNodes);
                var namespace = null;
                return function(scope, cloneConnectFn, options) {
                    assertArg(scope, "scope"), options = options || {};
                    var parentBoundTranscludeFn = options.parentBoundTranscludeFn, transcludeControllers = options.transcludeControllers, futureParentElement = options.futureParentElement;
                    parentBoundTranscludeFn && parentBoundTranscludeFn.$$boundTransclude && (parentBoundTranscludeFn = parentBoundTranscludeFn.$$boundTransclude), 
                    namespace || (namespace = detectNamespaceForChildElements(futureParentElement));
                    var $linkNode;
                    if ($linkNode = "html" !== namespace ? jqLite(wrapTemplate(namespace, jqLite("<div>").append($compileNodes).html())) : cloneConnectFn ? JQLitePrototype.clone.call($compileNodes) : $compileNodes, 
                    transcludeControllers) for (var controllerName in transcludeControllers) $linkNode.data("$" + controllerName + "Controller", transcludeControllers[controllerName].instance);
                    return compile.$$addScopeInfo($linkNode, scope), cloneConnectFn && cloneConnectFn($linkNode, scope), 
                    compositeLinkFn && compositeLinkFn(scope, $linkNode, $linkNode, parentBoundTranscludeFn), 
                    $linkNode;
                };
            }
            function detectNamespaceForChildElements(parentElement) {
                var node = parentElement && parentElement[0];
                return node && "foreignobject" !== nodeName_(node) && node.toString().match(/SVG/) ? "svg" : "html";
            }
            function compileNodes(nodeList, transcludeFn, $rootElement, maxPriority, ignoreDirective, previousCompileContext) {
                function compositeLinkFn(scope, nodeList, $rootElement, parentBoundTranscludeFn) {
                    var nodeLinkFn, childLinkFn, node, childScope, i, ii, idx, childBoundTranscludeFn, stableNodeList;
                    if (nodeLinkFnFound) {
                        var nodeListLength = nodeList.length;
                        for (stableNodeList = new Array(nodeListLength), i = 0; i < linkFns.length; i += 3) idx = linkFns[i], 
                        stableNodeList[idx] = nodeList[idx];
                    } else stableNodeList = nodeList;
                    for (i = 0, ii = linkFns.length; ii > i; ) if (node = stableNodeList[linkFns[i++]], 
                    nodeLinkFn = linkFns[i++], childLinkFn = linkFns[i++], nodeLinkFn) {
                        if (nodeLinkFn.scope) {
                            childScope = scope.$new(), compile.$$addScopeInfo(jqLite(node), childScope);
                            var destroyBindings = nodeLinkFn.$$destroyBindings;
                            destroyBindings && (nodeLinkFn.$$destroyBindings = null, childScope.$on("$destroyed", destroyBindings));
                        } else childScope = scope;
                        childBoundTranscludeFn = nodeLinkFn.transcludeOnThisElement ? createBoundTranscludeFn(scope, nodeLinkFn.transclude, parentBoundTranscludeFn, nodeLinkFn.elementTranscludeOnThisElement) : !nodeLinkFn.templateOnThisElement && parentBoundTranscludeFn ? parentBoundTranscludeFn : !parentBoundTranscludeFn && transcludeFn ? createBoundTranscludeFn(scope, transcludeFn) : null, 
                        nodeLinkFn(childLinkFn, childScope, node, $rootElement, childBoundTranscludeFn, nodeLinkFn);
                    } else childLinkFn && childLinkFn(scope, node.childNodes, undefined, parentBoundTranscludeFn);
                }
                for (var attrs, directives, nodeLinkFn, childNodes, childLinkFn, linkFnFound, nodeLinkFnFound, linkFns = [], i = 0; i < nodeList.length; i++) attrs = new Attributes(), 
                directives = collectDirectives(nodeList[i], [], attrs, 0 === i ? maxPriority : undefined, ignoreDirective), 
                nodeLinkFn = directives.length ? applyDirectivesToNode(directives, nodeList[i], attrs, transcludeFn, $rootElement, null, [], [], previousCompileContext) : null, 
                nodeLinkFn && nodeLinkFn.scope && compile.$$addScopeClass(attrs.$$element), childLinkFn = nodeLinkFn && nodeLinkFn.terminal || !(childNodes = nodeList[i].childNodes) || !childNodes.length ? null : compileNodes(childNodes, nodeLinkFn ? (nodeLinkFn.transcludeOnThisElement || !nodeLinkFn.templateOnThisElement) && nodeLinkFn.transclude : transcludeFn), 
                (nodeLinkFn || childLinkFn) && (linkFns.push(i, nodeLinkFn, childLinkFn), linkFnFound = !0, 
                nodeLinkFnFound = nodeLinkFnFound || nodeLinkFn), previousCompileContext = null;
                return linkFnFound ? compositeLinkFn : null;
            }
            function createBoundTranscludeFn(scope, transcludeFn, previousBoundTranscludeFn, elementTransclusion) {
                var boundTranscludeFn = function(transcludedScope, cloneFn, controllers, futureParentElement, containingScope) {
                    return transcludedScope || (transcludedScope = scope.$new(!1, containingScope), 
                    transcludedScope.$$transcluded = !0), transcludeFn(transcludedScope, cloneFn, {
                        parentBoundTranscludeFn: previousBoundTranscludeFn,
                        transcludeControllers: controllers,
                        futureParentElement: futureParentElement
                    });
                };
                return boundTranscludeFn;
            }
            function collectDirectives(node, directives, attrs, maxPriority, ignoreDirective) {
                var match, className, nodeType = node.nodeType, attrsMap = attrs.$attr;
                switch (nodeType) {
                  case NODE_TYPE_ELEMENT:
                    addDirective(directives, directiveNormalize(nodeName_(node)), "E", maxPriority, ignoreDirective);
                    for (var attr, name, nName, ngAttrName, value, isNgAttr, nAttrs = node.attributes, j = 0, jj = nAttrs && nAttrs.length; jj > j; j++) {
                        var attrStartName = !1, attrEndName = !1;
                        attr = nAttrs[j], name = attr.name, value = trim(attr.value), ngAttrName = directiveNormalize(name), 
                        (isNgAttr = NG_ATTR_BINDING.test(ngAttrName)) && (name = name.replace(PREFIX_REGEXP, "").substr(8).replace(/_(.)/g, function(match, letter) {
                            return letter.toUpperCase();
                        }));
                        var directiveNName = ngAttrName.replace(/(Start|End)$/, "");
                        directiveIsMultiElement(directiveNName) && ngAttrName === directiveNName + "Start" && (attrStartName = name, 
                        attrEndName = name.substr(0, name.length - 5) + "end", name = name.substr(0, name.length - 6)), 
                        nName = directiveNormalize(name.toLowerCase()), attrsMap[nName] = name, (isNgAttr || !attrs.hasOwnProperty(nName)) && (attrs[nName] = value, 
                        getBooleanAttrName(node, nName) && (attrs[nName] = !0)), addAttrInterpolateDirective(node, directives, value, nName, isNgAttr), 
                        addDirective(directives, nName, "A", maxPriority, ignoreDirective, attrStartName, attrEndName);
                    }
                    if (className = node.className, isObject(className) && (className = className.animVal), 
                    isString(className) && "" !== className) for (;match = CLASS_DIRECTIVE_REGEXP.exec(className); ) nName = directiveNormalize(match[2]), 
                    addDirective(directives, nName, "C", maxPriority, ignoreDirective) && (attrs[nName] = trim(match[3])), 
                    className = className.substr(match.index + match[0].length);
                    break;

                  case NODE_TYPE_TEXT:
                    addTextInterpolateDirective(directives, node.nodeValue);
                    break;

                  case NODE_TYPE_COMMENT:
                    try {
                        match = COMMENT_DIRECTIVE_REGEXP.exec(node.nodeValue), match && (nName = directiveNormalize(match[1]), 
                        addDirective(directives, nName, "M", maxPriority, ignoreDirective) && (attrs[nName] = trim(match[2])));
                    } catch (e) {}
                }
                return directives.sort(byPriority), directives;
            }
            function groupScan(node, attrStart, attrEnd) {
                var nodes = [], depth = 0;
                if (attrStart && node.hasAttribute && node.hasAttribute(attrStart)) {
                    do {
                        if (!node) throw $compileMinErr("uterdir", "Unterminated attribute, found '{0}' but no matching '{1}' found.", attrStart, attrEnd);
                        node.nodeType == NODE_TYPE_ELEMENT && (node.hasAttribute(attrStart) && depth++, 
                        node.hasAttribute(attrEnd) && depth--), nodes.push(node), node = node.nextSibling;
                    } while (depth > 0);
                } else nodes.push(node);
                return jqLite(nodes);
            }
            function groupElementsLinkFnWrapper(linkFn, attrStart, attrEnd) {
                return function(scope, element, attrs, controllers, transcludeFn) {
                    return element = groupScan(element[0], attrStart, attrEnd), linkFn(scope, element, attrs, controllers, transcludeFn);
                };
            }
            function applyDirectivesToNode(directives, compileNode, templateAttrs, transcludeFn, jqCollection, originalReplaceDirective, preLinkFns, postLinkFns, previousCompileContext) {
                function addLinkFns(pre, post, attrStart, attrEnd) {
                    pre && (attrStart && (pre = groupElementsLinkFnWrapper(pre, attrStart, attrEnd)), 
                    pre.require = directive.require, pre.directiveName = directiveName, (newIsolateScopeDirective === directive || directive.$$isolateScope) && (pre = cloneAndAnnotateFn(pre, {
                        isolateScope: !0
                    })), preLinkFns.push(pre)), post && (attrStart && (post = groupElementsLinkFnWrapper(post, attrStart, attrEnd)), 
                    post.require = directive.require, post.directiveName = directiveName, (newIsolateScopeDirective === directive || directive.$$isolateScope) && (post = cloneAndAnnotateFn(post, {
                        isolateScope: !0
                    })), postLinkFns.push(post));
                }
                function getControllers(directiveName, require, $element, elementControllers) {
                    var value;
                    if (isString(require)) {
                        var match = require.match(REQUIRE_PREFIX_REGEXP), name = require.substring(match[0].length), inheritType = match[1] || match[3], optional = "?" === match[2];
                        if ("^^" === inheritType ? $element = $element.parent() : (value = elementControllers && elementControllers[name], 
                        value = value && value.instance), !value) {
                            var dataName = "$" + name + "Controller";
                            value = inheritType ? $element.inheritedData(dataName) : $element.data(dataName);
                        }
                        if (!value && !optional) throw $compileMinErr("ctreq", "Controller '{0}', required by directive '{1}', can't be found!", name, directiveName);
                    } else if (isArray(require)) {
                        value = [];
                        for (var i = 0, ii = require.length; ii > i; i++) value[i] = getControllers(directiveName, require[i], $element, elementControllers);
                    }
                    return value || null;
                }
                function setupControllers($element, attrs, transcludeFn, controllerDirectives, isolateScope, scope) {
                    var elementControllers = createMap();
                    for (var controllerKey in controllerDirectives) {
                        var directive = controllerDirectives[controllerKey], locals = {
                            $scope: directive === newIsolateScopeDirective || directive.$$isolateScope ? isolateScope : scope,
                            $element: $element,
                            $attrs: attrs,
                            $transclude: transcludeFn
                        }, controller = directive.controller;
                        "@" == controller && (controller = attrs[directive.name]);
                        var controllerInstance = $controller(controller, locals, !0, directive.controllerAs);
                        elementControllers[directive.name] = controllerInstance, hasElementTranscludeDirective || $element.data("$" + directive.name + "Controller", controllerInstance.instance);
                    }
                    return elementControllers;
                }
                function nodeLinkFn(childLinkFn, scope, linkNode, $rootElement, boundTranscludeFn, thisLinkFn) {
                    function controllersBoundTransclude(scope, cloneAttachFn, futureParentElement) {
                        var transcludeControllers;
                        return isScope(scope) || (futureParentElement = cloneAttachFn, cloneAttachFn = scope, 
                        scope = undefined), hasElementTranscludeDirective && (transcludeControllers = elementControllers), 
                        futureParentElement || (futureParentElement = hasElementTranscludeDirective ? $element.parent() : $element), 
                        boundTranscludeFn(scope, cloneAttachFn, transcludeControllers, futureParentElement, scopeToChild);
                    }
                    var i, ii, linkFn, controller, isolateScope, elementControllers, transcludeFn, $element, attrs;
                    if (compileNode === linkNode ? (attrs = templateAttrs, $element = templateAttrs.$$element) : ($element = jqLite(linkNode), 
                    attrs = new Attributes($element, templateAttrs)), newIsolateScopeDirective && (isolateScope = scope.$new(!0)), 
                    boundTranscludeFn && (transcludeFn = controllersBoundTransclude, transcludeFn.$$boundTransclude = boundTranscludeFn), 
                    controllerDirectives && (elementControllers = setupControllers($element, attrs, transcludeFn, controllerDirectives, isolateScope, scope)), 
                    newIsolateScopeDirective && (compile.$$addScopeInfo($element, isolateScope, !0, !(templateDirective && (templateDirective === newIsolateScopeDirective || templateDirective === newIsolateScopeDirective.$$originalDirective))), 
                    compile.$$addScopeClass($element, !0), isolateScope.$$isolateBindings = newIsolateScopeDirective.$$isolateBindings, 
                    initializeDirectiveBindings(scope, attrs, isolateScope, isolateScope.$$isolateBindings, newIsolateScopeDirective, isolateScope)), 
                    elementControllers) {
                        var bindings, controllerForBindings, scopeDirective = newIsolateScopeDirective || newScopeDirective;
                        scopeDirective && elementControllers[scopeDirective.name] && (bindings = scopeDirective.$$bindings.bindToController, 
                        controller = elementControllers[scopeDirective.name], controller && controller.identifier && bindings && (controllerForBindings = controller, 
                        thisLinkFn.$$destroyBindings = initializeDirectiveBindings(scope, attrs, controller.instance, bindings, scopeDirective)));
                        for (i in elementControllers) {
                            controller = elementControllers[i];
                            var controllerResult = controller();
                            controllerResult !== controller.instance && (controller.instance = controllerResult, 
                            $element.data("$" + directive.name + "Controller", controllerResult), controller === controllerForBindings && (thisLinkFn.$$destroyBindings(), 
                            thisLinkFn.$$destroyBindings = initializeDirectiveBindings(scope, attrs, controllerResult, bindings, scopeDirective)));
                        }
                    }
                    for (i = 0, ii = preLinkFns.length; ii > i; i++) linkFn = preLinkFns[i], invokeLinkFn(linkFn, linkFn.isolateScope ? isolateScope : scope, $element, attrs, linkFn.require && getControllers(linkFn.directiveName, linkFn.require, $element, elementControllers), transcludeFn);
                    var scopeToChild = scope;
                    for (newIsolateScopeDirective && (newIsolateScopeDirective.template || null === newIsolateScopeDirective.templateUrl) && (scopeToChild = isolateScope), 
                    childLinkFn && childLinkFn(scopeToChild, linkNode.childNodes, undefined, boundTranscludeFn), 
                    i = postLinkFns.length - 1; i >= 0; i--) linkFn = postLinkFns[i], invokeLinkFn(linkFn, linkFn.isolateScope ? isolateScope : scope, $element, attrs, linkFn.require && getControllers(linkFn.directiveName, linkFn.require, $element, elementControllers), transcludeFn);
                }
                previousCompileContext = previousCompileContext || {};
                for (var newScopeDirective, directive, directiveName, $template, linkFn, directiveValue, terminalPriority = -Number.MAX_VALUE, controllerDirectives = previousCompileContext.controllerDirectives, newIsolateScopeDirective = previousCompileContext.newIsolateScopeDirective, templateDirective = previousCompileContext.templateDirective, nonTlbTranscludeDirective = previousCompileContext.nonTlbTranscludeDirective, hasTranscludeDirective = !1, hasTemplate = !1, hasElementTranscludeDirective = previousCompileContext.hasElementTranscludeDirective, $compileNode = templateAttrs.$$element = jqLite(compileNode), replaceDirective = originalReplaceDirective, childTranscludeFn = transcludeFn, i = 0, ii = directives.length; ii > i; i++) {
                    directive = directives[i];
                    var attrStart = directive.$$start, attrEnd = directive.$$end;
                    if (attrStart && ($compileNode = groupScan(compileNode, attrStart, attrEnd)), $template = undefined, 
                    terminalPriority > directive.priority) break;
                    if ((directiveValue = directive.scope) && (directive.templateUrl || (isObject(directiveValue) ? (assertNoDuplicate("new/isolated scope", newIsolateScopeDirective || newScopeDirective, directive, $compileNode), 
                    newIsolateScopeDirective = directive) : assertNoDuplicate("new/isolated scope", newIsolateScopeDirective, directive, $compileNode)), 
                    newScopeDirective = newScopeDirective || directive), directiveName = directive.name, 
                    !directive.templateUrl && directive.controller && (directiveValue = directive.controller, 
                    controllerDirectives = controllerDirectives || createMap(), assertNoDuplicate("'" + directiveName + "' controller", controllerDirectives[directiveName], directive, $compileNode), 
                    controllerDirectives[directiveName] = directive), (directiveValue = directive.transclude) && (hasTranscludeDirective = !0, 
                    directive.$$tlb || (assertNoDuplicate("transclusion", nonTlbTranscludeDirective, directive, $compileNode), 
                    nonTlbTranscludeDirective = directive), "element" == directiveValue ? (hasElementTranscludeDirective = !0, 
                    terminalPriority = directive.priority, $template = $compileNode, $compileNode = templateAttrs.$$element = jqLite(document.createComment(" " + directiveName + ": " + templateAttrs[directiveName] + " ")), 
                    compileNode = $compileNode[0], replaceWith(jqCollection, sliceArgs($template), compileNode), 
                    childTranscludeFn = compile($template, transcludeFn, terminalPriority, replaceDirective && replaceDirective.name, {
                        nonTlbTranscludeDirective: nonTlbTranscludeDirective
                    })) : ($template = jqLite(jqLiteClone(compileNode)).contents(), $compileNode.empty(), 
                    childTranscludeFn = compile($template, transcludeFn))), directive.template) if (hasTemplate = !0, 
                    assertNoDuplicate("template", templateDirective, directive, $compileNode), templateDirective = directive, 
                    directiveValue = isFunction(directive.template) ? directive.template($compileNode, templateAttrs) : directive.template, 
                    directiveValue = denormalizeTemplate(directiveValue), directive.replace) {
                        if (replaceDirective = directive, $template = jqLiteIsTextNode(directiveValue) ? [] : removeComments(wrapTemplate(directive.templateNamespace, trim(directiveValue))), 
                        compileNode = $template[0], 1 != $template.length || compileNode.nodeType !== NODE_TYPE_ELEMENT) throw $compileMinErr("tplrt", "Template for directive '{0}' must have exactly one root element. {1}", directiveName, "");
                        replaceWith(jqCollection, $compileNode, compileNode);
                        var newTemplateAttrs = {
                            $attr: {}
                        }, templateDirectives = collectDirectives(compileNode, [], newTemplateAttrs), unprocessedDirectives = directives.splice(i + 1, directives.length - (i + 1));
                        newIsolateScopeDirective && markDirectivesAsIsolate(templateDirectives), directives = directives.concat(templateDirectives).concat(unprocessedDirectives), 
                        mergeTemplateAttributes(templateAttrs, newTemplateAttrs), ii = directives.length;
                    } else $compileNode.html(directiveValue);
                    if (directive.templateUrl) hasTemplate = !0, assertNoDuplicate("template", templateDirective, directive, $compileNode), 
                    templateDirective = directive, directive.replace && (replaceDirective = directive), 
                    nodeLinkFn = compileTemplateUrl(directives.splice(i, directives.length - i), $compileNode, templateAttrs, jqCollection, hasTranscludeDirective && childTranscludeFn, preLinkFns, postLinkFns, {
                        controllerDirectives: controllerDirectives,
                        newIsolateScopeDirective: newIsolateScopeDirective,
                        templateDirective: templateDirective,
                        nonTlbTranscludeDirective: nonTlbTranscludeDirective
                    }), ii = directives.length; else if (directive.compile) try {
                        linkFn = directive.compile($compileNode, templateAttrs, childTranscludeFn), isFunction(linkFn) ? addLinkFns(null, linkFn, attrStart, attrEnd) : linkFn && addLinkFns(linkFn.pre, linkFn.post, attrStart, attrEnd);
                    } catch (e) {
                        $exceptionHandler(e, startingTag($compileNode));
                    }
                    directive.terminal && (nodeLinkFn.terminal = !0, terminalPriority = Math.max(terminalPriority, directive.priority));
                }
                return nodeLinkFn.scope = newScopeDirective && newScopeDirective.scope === !0, nodeLinkFn.transcludeOnThisElement = hasTranscludeDirective, 
                nodeLinkFn.elementTranscludeOnThisElement = hasElementTranscludeDirective, nodeLinkFn.templateOnThisElement = hasTemplate, 
                nodeLinkFn.transclude = childTranscludeFn, previousCompileContext.hasElementTranscludeDirective = hasElementTranscludeDirective, 
                nodeLinkFn;
            }
            function markDirectivesAsIsolate(directives) {
                for (var j = 0, jj = directives.length; jj > j; j++) directives[j] = inherit(directives[j], {
                    $$isolateScope: !0
                });
            }
            function addDirective(tDirectives, name, location, maxPriority, ignoreDirective, startAttrName, endAttrName) {
                if (name === ignoreDirective) return null;
                var match = null;
                if (hasDirectives.hasOwnProperty(name)) for (var directive, directives = $injector.get(name + Suffix), i = 0, ii = directives.length; ii > i; i++) try {
                    directive = directives[i], (maxPriority === undefined || maxPriority > directive.priority) && -1 != directive.restrict.indexOf(location) && (startAttrName && (directive = inherit(directive, {
                        $$start: startAttrName,
                        $$end: endAttrName
                    })), tDirectives.push(directive), match = directive);
                } catch (e) {
                    $exceptionHandler(e);
                }
                return match;
            }
            function directiveIsMultiElement(name) {
                if (hasDirectives.hasOwnProperty(name)) for (var directive, directives = $injector.get(name + Suffix), i = 0, ii = directives.length; ii > i; i++) if (directive = directives[i], 
                directive.multiElement) return !0;
                return !1;
            }
            function mergeTemplateAttributes(dst, src) {
                var srcAttr = src.$attr, dstAttr = dst.$attr, $element = dst.$$element;
                forEach(dst, function(value, key) {
                    "$" != key.charAt(0) && (src[key] && src[key] !== value && (value += ("style" === key ? ";" : " ") + src[key]), 
                    dst.$set(key, value, !0, srcAttr[key]));
                }), forEach(src, function(value, key) {
                    "class" == key ? (safeAddClass($element, value), dst["class"] = (dst["class"] ? dst["class"] + " " : "") + value) : "style" == key ? ($element.attr("style", $element.attr("style") + ";" + value), 
                    dst.style = (dst.style ? dst.style + ";" : "") + value) : "$" == key.charAt(0) || dst.hasOwnProperty(key) || (dst[key] = value, 
                    dstAttr[key] = srcAttr[key]);
                });
            }
            function compileTemplateUrl(directives, $compileNode, tAttrs, $rootElement, childTranscludeFn, preLinkFns, postLinkFns, previousCompileContext) {
                var afterTemplateNodeLinkFn, afterTemplateChildLinkFn, linkQueue = [], beforeTemplateCompileNode = $compileNode[0], origAsyncDirective = directives.shift(), derivedSyncDirective = inherit(origAsyncDirective, {
                    templateUrl: null,
                    transclude: null,
                    replace: null,
                    $$originalDirective: origAsyncDirective
                }), templateUrl = isFunction(origAsyncDirective.templateUrl) ? origAsyncDirective.templateUrl($compileNode, tAttrs) : origAsyncDirective.templateUrl, templateNamespace = origAsyncDirective.templateNamespace;
                return $compileNode.empty(), $templateRequest($sce.getTrustedResourceUrl(templateUrl)).then(function(content) {
                    var compileNode, tempTemplateAttrs, $template, childBoundTranscludeFn;
                    if (content = denormalizeTemplate(content), origAsyncDirective.replace) {
                        if ($template = jqLiteIsTextNode(content) ? [] : removeComments(wrapTemplate(templateNamespace, trim(content))), 
                        compileNode = $template[0], 1 != $template.length || compileNode.nodeType !== NODE_TYPE_ELEMENT) throw $compileMinErr("tplrt", "Template for directive '{0}' must have exactly one root element. {1}", origAsyncDirective.name, templateUrl);
                        tempTemplateAttrs = {
                            $attr: {}
                        }, replaceWith($rootElement, $compileNode, compileNode);
                        var templateDirectives = collectDirectives(compileNode, [], tempTemplateAttrs);
                        isObject(origAsyncDirective.scope) && markDirectivesAsIsolate(templateDirectives), 
                        directives = templateDirectives.concat(directives), mergeTemplateAttributes(tAttrs, tempTemplateAttrs);
                    } else compileNode = beforeTemplateCompileNode, $compileNode.html(content);
                    for (directives.unshift(derivedSyncDirective), afterTemplateNodeLinkFn = applyDirectivesToNode(directives, compileNode, tAttrs, childTranscludeFn, $compileNode, origAsyncDirective, preLinkFns, postLinkFns, previousCompileContext), 
                    forEach($rootElement, function(node, i) {
                        node == compileNode && ($rootElement[i] = $compileNode[0]);
                    }), afterTemplateChildLinkFn = compileNodes($compileNode[0].childNodes, childTranscludeFn); linkQueue.length; ) {
                        var scope = linkQueue.shift(), beforeTemplateLinkNode = linkQueue.shift(), linkRootElement = linkQueue.shift(), boundTranscludeFn = linkQueue.shift(), linkNode = $compileNode[0];
                        if (!scope.$$destroyed) {
                            if (beforeTemplateLinkNode !== beforeTemplateCompileNode) {
                                var oldClasses = beforeTemplateLinkNode.className;
                                previousCompileContext.hasElementTranscludeDirective && origAsyncDirective.replace || (linkNode = jqLiteClone(compileNode)), 
                                replaceWith(linkRootElement, jqLite(beforeTemplateLinkNode), linkNode), safeAddClass(jqLite(linkNode), oldClasses);
                            }
                            childBoundTranscludeFn = afterTemplateNodeLinkFn.transcludeOnThisElement ? createBoundTranscludeFn(scope, afterTemplateNodeLinkFn.transclude, boundTranscludeFn) : boundTranscludeFn, 
                            afterTemplateNodeLinkFn(afterTemplateChildLinkFn, scope, linkNode, $rootElement, childBoundTranscludeFn, afterTemplateNodeLinkFn);
                        }
                    }
                    linkQueue = null;
                }), function(ignoreChildLinkFn, scope, node, rootElement, boundTranscludeFn) {
                    var childBoundTranscludeFn = boundTranscludeFn;
                    scope.$$destroyed || (linkQueue ? linkQueue.push(scope, node, rootElement, childBoundTranscludeFn) : (afterTemplateNodeLinkFn.transcludeOnThisElement && (childBoundTranscludeFn = createBoundTranscludeFn(scope, afterTemplateNodeLinkFn.transclude, boundTranscludeFn)), 
                    afterTemplateNodeLinkFn(afterTemplateChildLinkFn, scope, node, rootElement, childBoundTranscludeFn, afterTemplateNodeLinkFn)));
                };
            }
            function byPriority(a, b) {
                var diff = b.priority - a.priority;
                return 0 !== diff ? diff : a.name !== b.name ? a.name < b.name ? -1 : 1 : a.index - b.index;
            }
            function assertNoDuplicate(what, previousDirective, directive, element) {
                if (previousDirective) throw $compileMinErr("multidir", "Multiple directives [{0}, {1}] asking for {2} on: {3}", previousDirective.name, directive.name, what, startingTag(element));
            }
            function addTextInterpolateDirective(directives, text) {
                var interpolateFn = $interpolate(text, !0);
                interpolateFn && directives.push({
                    priority: 0,
                    compile: function(templateNode) {
                        var templateNodeParent = templateNode.parent(), hasCompileParent = !!templateNodeParent.length;
                        return hasCompileParent && compile.$$addBindingClass(templateNodeParent), function(scope, node) {
                            var parent = node.parent();
                            hasCompileParent || compile.$$addBindingClass(parent), compile.$$addBindingInfo(parent, interpolateFn.expressions), 
                            scope.$watch(interpolateFn, function(value) {
                                node[0].nodeValue = value;
                            });
                        };
                    }
                });
            }
            function wrapTemplate(type, template) {
                switch (type = lowercase(type || "html")) {
                  case "svg":
                  case "math":
                    var wrapper = document.createElement("div");
                    return wrapper.innerHTML = "<" + type + ">" + template + "</" + type + ">", wrapper.childNodes[0].childNodes;

                  default:
                    return template;
                }
            }
            function getTrustedContext(node, attrNormalizedName) {
                if ("srcdoc" == attrNormalizedName) return $sce.HTML;
                var tag = nodeName_(node);
                return "xlinkHref" == attrNormalizedName || "form" == tag && "action" == attrNormalizedName || "img" != tag && ("src" == attrNormalizedName || "ngSrc" == attrNormalizedName) ? $sce.RESOURCE_URL : void 0;
            }
            function addAttrInterpolateDirective(node, directives, value, name, allOrNothing) {
                var trustedContext = getTrustedContext(node, name);
                allOrNothing = ALL_OR_NOTHING_ATTRS[name] || allOrNothing;
                var interpolateFn = $interpolate(value, !0, trustedContext, allOrNothing);
                if (interpolateFn) {
                    if ("multiple" === name && "select" === nodeName_(node)) throw $compileMinErr("selmulti", "Binding to the 'multiple' attribute is not supported. Element: {0}", startingTag(node));
                    directives.push({
                        priority: 100,
                        compile: function() {
                            return {
                                pre: function(scope, element, attr) {
                                    var $$observers = attr.$$observers || (attr.$$observers = {});
                                    if (EVENT_HANDLER_ATTR_REGEXP.test(name)) throw $compileMinErr("nodomevents", "Interpolations for HTML DOM event attributes are disallowed.  Please use the ng- versions (such as ng-click instead of onclick) instead.");
                                    var newValue = attr[name];
                                    newValue !== value && (interpolateFn = newValue && $interpolate(newValue, !0, trustedContext, allOrNothing), 
                                    value = newValue), interpolateFn && (attr[name] = interpolateFn(scope), ($$observers[name] || ($$observers[name] = [])).$$inter = !0, 
                                    (attr.$$observers && attr.$$observers[name].$$scope || scope).$watch(interpolateFn, function(newValue, oldValue) {
                                        "class" === name && newValue != oldValue ? attr.$updateClass(newValue, oldValue) : attr.$set(name, newValue);
                                    }));
                                }
                            };
                        }
                    });
                }
            }
            function replaceWith($rootElement, elementsToRemove, newNode) {
                var i, ii, firstElementToRemove = elementsToRemove[0], removeCount = elementsToRemove.length, parent = firstElementToRemove.parentNode;
                if ($rootElement) for (i = 0, ii = $rootElement.length; ii > i; i++) if ($rootElement[i] == firstElementToRemove) {
                    $rootElement[i++] = newNode;
                    for (var j = i, j2 = j + removeCount - 1, jj = $rootElement.length; jj > j; j++, 
                    j2++) jj > j2 ? $rootElement[j] = $rootElement[j2] : delete $rootElement[j];
                    $rootElement.length -= removeCount - 1, $rootElement.context === firstElementToRemove && ($rootElement.context = newNode);
                    break;
                }
                parent && parent.replaceChild(newNode, firstElementToRemove);
                var fragment = document.createDocumentFragment();
                fragment.appendChild(firstElementToRemove), jqLite(newNode).data(jqLite(firstElementToRemove).data()), 
                jQuery ? (skipDestroyOnNextJQueryCleanData = !0, jQuery.cleanData([ firstElementToRemove ])) : delete jqLite.cache[firstElementToRemove[jqLite.expando]];
                for (var k = 1, kk = elementsToRemove.length; kk > k; k++) {
                    var element = elementsToRemove[k];
                    jqLite(element).remove(), fragment.appendChild(element), delete elementsToRemove[k];
                }
                elementsToRemove[0] = newNode, elementsToRemove.length = 1;
            }
            function cloneAndAnnotateFn(fn, annotation) {
                return extend(function() {
                    return fn.apply(null, arguments);
                }, fn, annotation);
            }
            function invokeLinkFn(linkFn, scope, $element, attrs, controllers, transcludeFn) {
                try {
                    linkFn(scope, $element, attrs, controllers, transcludeFn);
                } catch (e) {
                    $exceptionHandler(e, startingTag($element));
                }
            }
            function initializeDirectiveBindings(scope, attrs, destination, bindings, directive, newScope) {
                var onNewScopeDestroyed;
                forEach(bindings, function(definition, scopeName) {
                    var lastValue, parentGet, parentSet, compare, attrName = definition.attrName, optional = definition.optional, mode = definition.mode;
                    switch (mode) {
                      case "@":
                        attrs.$observe(attrName, function(value) {
                            destination[scopeName] = value;
                        }), attrs.$$observers[attrName].$$scope = scope, attrs[attrName] && (destination[scopeName] = $interpolate(attrs[attrName])(scope));
                        break;

                      case "=":
                        if (optional && !attrs[attrName]) return;
                        parentGet = $parse(attrs[attrName]), compare = parentGet.literal ? equals : function(a, b) {
                            return a === b || a !== a && b !== b;
                        }, parentSet = parentGet.assign || function() {
                            throw lastValue = destination[scopeName] = parentGet(scope), $compileMinErr("nonassign", "Expression '{0}' used with directive '{1}' is non-assignable!", attrs[attrName], directive.name);
                        }, lastValue = destination[scopeName] = parentGet(scope);
                        var parentValueWatch = function(parentValue) {
                            return compare(parentValue, destination[scopeName]) || (compare(parentValue, lastValue) ? parentSet(scope, parentValue = destination[scopeName]) : destination[scopeName] = parentValue), 
                            lastValue = parentValue;
                        };
                        parentValueWatch.$stateful = !0;
                        var unwatch;
                        unwatch = definition.collection ? scope.$watchCollection(attrs[attrName], parentValueWatch) : scope.$watch($parse(attrs[attrName], parentValueWatch), null, parentGet.literal), 
                        onNewScopeDestroyed = onNewScopeDestroyed || [], onNewScopeDestroyed.push(unwatch);
                        break;

                      case "&":
                        if (!attrs.hasOwnProperty(attrName) && optional) break;
                        if (parentGet = $parse(attrs[attrName]), parentGet === noop && optional) break;
                        destination[scopeName] = function(locals) {
                            return parentGet(scope, locals);
                        };
                    }
                });
                var destroyBindings = onNewScopeDestroyed ? function() {
                    for (var i = 0, ii = onNewScopeDestroyed.length; ii > i; ++i) onNewScopeDestroyed[i]();
                } : noop;
                return newScope && destroyBindings !== noop ? (newScope.$on("$destroy", destroyBindings), 
                noop) : destroyBindings;
            }
            var Attributes = function(element, attributesToCopy) {
                if (attributesToCopy) {
                    var i, l, key, keys = Object.keys(attributesToCopy);
                    for (i = 0, l = keys.length; l > i; i++) key = keys[i], this[key] = attributesToCopy[key];
                } else this.$attr = {};
                this.$$element = element;
            };
            Attributes.prototype = {
                $normalize: directiveNormalize,
                $addClass: function(classVal) {
                    classVal && classVal.length > 0 && $animate.addClass(this.$$element, classVal);
                },
                $removeClass: function(classVal) {
                    classVal && classVal.length > 0 && $animate.removeClass(this.$$element, classVal);
                },
                $updateClass: function(newClasses, oldClasses) {
                    var toAdd = tokenDifference(newClasses, oldClasses);
                    toAdd && toAdd.length && $animate.addClass(this.$$element, toAdd);
                    var toRemove = tokenDifference(oldClasses, newClasses);
                    toRemove && toRemove.length && $animate.removeClass(this.$$element, toRemove);
                },
                $set: function(key, value, writeAttr, attrName) {
                    var nodeName, node = this.$$element[0], booleanKey = getBooleanAttrName(node, key), aliasedKey = getAliasedAttrName(node, key), observer = key;
                    if (booleanKey ? (this.$$element.prop(key, value), attrName = booleanKey) : aliasedKey && (this[aliasedKey] = value, 
                    observer = aliasedKey), this[key] = value, attrName ? this.$attr[key] = attrName : (attrName = this.$attr[key], 
                    attrName || (this.$attr[key] = attrName = snake_case(key, "-"))), nodeName = nodeName_(this.$$element), 
                    "a" === nodeName && "href" === key || "img" === nodeName && "src" === key) this[key] = value = $$sanitizeUri(value, "src" === key); else if ("img" === nodeName && "srcset" === key) {
                        for (var result = "", trimmedSrcset = trim(value), srcPattern = /(\s+\d+x\s*,|\s+\d+w\s*,|\s+,|,\s+)/, pattern = /\s/.test(trimmedSrcset) ? srcPattern : /(,)/, rawUris = trimmedSrcset.split(pattern), nbrUrisWith2parts = Math.floor(rawUris.length / 2), i = 0; nbrUrisWith2parts > i; i++) {
                            var innerIdx = 2 * i;
                            result += $$sanitizeUri(trim(rawUris[innerIdx]), !0), result += " " + trim(rawUris[innerIdx + 1]);
                        }
                        var lastTuple = trim(rawUris[2 * i]).split(/\s/);
                        result += $$sanitizeUri(trim(lastTuple[0]), !0), 2 === lastTuple.length && (result += " " + trim(lastTuple[1])), 
                        this[key] = value = result;
                    }
                    writeAttr !== !1 && (null === value || value === undefined ? this.$$element.removeAttr(attrName) : this.$$element.attr(attrName, value));
                    var $$observers = this.$$observers;
                    $$observers && forEach($$observers[observer], function(fn) {
                        try {
                            fn(value);
                        } catch (e) {
                            $exceptionHandler(e);
                        }
                    });
                },
                $observe: function(key, fn) {
                    var attrs = this, $$observers = attrs.$$observers || (attrs.$$observers = createMap()), listeners = $$observers[key] || ($$observers[key] = []);
                    return listeners.push(fn), $rootScope.$evalAsync(function() {
                        !listeners.$$inter && attrs.hasOwnProperty(key) && fn(attrs[key]);
                    }), function() {
                        arrayRemove(listeners, fn);
                    };
                }
            };
            var startSymbol = $interpolate.startSymbol(), endSymbol = $interpolate.endSymbol(), denormalizeTemplate = "{{" == startSymbol || "}}" == endSymbol ? identity : function(template) {
                return template.replace(/\{\{/g, startSymbol).replace(/}}/g, endSymbol);
            }, NG_ATTR_BINDING = /^ngAttr[A-Z]/;
            return compile.$$addBindingInfo = debugInfoEnabled ? function($element, binding) {
                var bindings = $element.data("$binding") || [];
                isArray(binding) ? bindings = bindings.concat(binding) : bindings.push(binding), 
                $element.data("$binding", bindings);
            } : noop, compile.$$addBindingClass = debugInfoEnabled ? function($element) {
                safeAddClass($element, "ng-binding");
            } : noop, compile.$$addScopeInfo = debugInfoEnabled ? function($element, scope, isolated, noTemplate) {
                var dataName = isolated ? noTemplate ? "$isolateScopeNoTemplate" : "$isolateScope" : "$scope";
                $element.data(dataName, scope);
            } : noop, compile.$$addScopeClass = debugInfoEnabled ? function($element, isolated) {
                safeAddClass($element, isolated ? "ng-isolate-scope" : "ng-scope");
            } : noop, compile;
        } ];
    }
    function directiveNormalize(name) {
        return camelCase(name.replace(PREFIX_REGEXP, ""));
    }
    function tokenDifference(str1, str2) {
        var values = "", tokens1 = str1.split(/\s+/), tokens2 = str2.split(/\s+/);
        outer: for (var i = 0; i < tokens1.length; i++) {
            for (var token = tokens1[i], j = 0; j < tokens2.length; j++) if (token == tokens2[j]) continue outer;
            values += (values.length > 0 ? " " : "") + token;
        }
        return values;
    }
    function removeComments(jqNodes) {
        jqNodes = jqLite(jqNodes);
        var i = jqNodes.length;
        if (1 >= i) return jqNodes;
        for (;i--; ) {
            var node = jqNodes[i];
            node.nodeType === NODE_TYPE_COMMENT && splice.call(jqNodes, i, 1);
        }
        return jqNodes;
    }
    function identifierForController(controller, ident) {
        if (ident && isString(ident)) return ident;
        if (isString(controller)) {
            var match = CNTRL_REG.exec(controller);
            if (match) return match[3];
        }
    }
    function $ControllerProvider() {
        var controllers = {}, globals = !1;
        this.register = function(name, constructor) {
            assertNotHasOwnProperty(name, "controller"), isObject(name) ? extend(controllers, name) : controllers[name] = constructor;
        }, this.allowGlobals = function() {
            globals = !0;
        }, this.$get = [ "$injector", "$window", function($injector, $window) {
            function addIdentifier(locals, identifier, instance, name) {
                if (!locals || !isObject(locals.$scope)) throw minErr("$controller")("noscp", "Cannot export controller '{0}' as '{1}'! No $scope object provided via `locals`.", name, identifier);
                locals.$scope[identifier] = instance;
            }
            return function(expression, locals, later, ident) {
                var instance, match, constructor, identifier;
                if (later = later === !0, ident && isString(ident) && (identifier = ident), isString(expression)) {
                    if (match = expression.match(CNTRL_REG), !match) throw $controllerMinErr("ctrlfmt", "Badly formed controller string '{0}'. Must match `__name__ as __id__` or `__name__`.", expression);
                    constructor = match[1], identifier = identifier || match[3], expression = controllers.hasOwnProperty(constructor) ? controllers[constructor] : getter(locals.$scope, constructor, !0) || (globals ? getter($window, constructor, !0) : undefined), 
                    assertArgFn(expression, constructor, !0);
                }
                if (later) {
                    var controllerPrototype = (isArray(expression) ? expression[expression.length - 1] : expression).prototype;
                    instance = Object.create(controllerPrototype || null), identifier && addIdentifier(locals, identifier, instance, constructor || expression.name);
                    var instantiate;
                    return instantiate = extend(function() {
                        var result = $injector.invoke(expression, instance, locals, constructor);
                        return result !== instance && (isObject(result) || isFunction(result)) && (instance = result, 
                        identifier && addIdentifier(locals, identifier, instance, constructor || expression.name)), 
                        instance;
                    }, {
                        instance: instance,
                        identifier: identifier
                    });
                }
                return instance = $injector.instantiate(expression, locals, constructor), identifier && addIdentifier(locals, identifier, instance, constructor || expression.name), 
                instance;
            };
        } ];
    }
    function $DocumentProvider() {
        this.$get = [ "$window", function(window) {
            return jqLite(window.document);
        } ];
    }
    function $ExceptionHandlerProvider() {
        this.$get = [ "$log", function($log) {
            return function(exception, cause) {
                $log.error.apply($log, arguments);
            };
        } ];
    }
    function serializeValue(v) {
        return isObject(v) ? isDate(v) ? v.toISOString() : toJson(v) : v;
    }
    function $HttpParamSerializerProvider() {
        this.$get = function() {
            return function(params) {
                if (!params) return "";
                var parts = [];
                return forEachSorted(params, function(value, key) {
                    null === value || isUndefined(value) || (isArray(value) ? forEach(value, function(v, k) {
                        parts.push(encodeUriQuery(key) + "=" + encodeUriQuery(serializeValue(v)));
                    }) : parts.push(encodeUriQuery(key) + "=" + encodeUriQuery(serializeValue(value))));
                }), parts.join("&");
            };
        };
    }
    function $HttpParamSerializerJQLikeProvider() {
        this.$get = function() {
            return function(params) {
                function serialize(toSerialize, prefix, topLevel) {
                    null === toSerialize || isUndefined(toSerialize) || (isArray(toSerialize) ? forEach(toSerialize, function(value) {
                        serialize(value, prefix + "[]");
                    }) : isObject(toSerialize) && !isDate(toSerialize) ? forEachSorted(toSerialize, function(value, key) {
                        serialize(value, prefix + (topLevel ? "" : "[") + key + (topLevel ? "" : "]"));
                    }) : parts.push(encodeUriQuery(prefix) + "=" + encodeUriQuery(serializeValue(toSerialize))));
                }
                if (!params) return "";
                var parts = [];
                return serialize(params, "", !0), parts.join("&");
            };
        };
    }
    function defaultHttpResponseTransform(data, headers) {
        if (isString(data)) {
            var tempData = data.replace(JSON_PROTECTION_PREFIX, "").trim();
            if (tempData) {
                var contentType = headers("Content-Type");
                (contentType && 0 === contentType.indexOf(APPLICATION_JSON) || isJsonLike(tempData)) && (data = fromJson(tempData));
            }
        }
        return data;
    }
    function isJsonLike(str) {
        var jsonStart = str.match(JSON_START);
        return jsonStart && JSON_ENDS[jsonStart[0]].test(str);
    }
    function parseHeaders(headers) {
        function fillInParsed(key, val) {
            key && (parsed[key] = parsed[key] ? parsed[key] + ", " + val : val);
        }
        var i, parsed = createMap();
        return isString(headers) ? forEach(headers.split("\n"), function(line) {
            i = line.indexOf(":"), fillInParsed(lowercase(trim(line.substr(0, i))), trim(line.substr(i + 1)));
        }) : isObject(headers) && forEach(headers, function(headerVal, headerKey) {
            fillInParsed(lowercase(headerKey), trim(headerVal));
        }), parsed;
    }
    function headersGetter(headers) {
        var headersObj;
        return function(name) {
            if (headersObj || (headersObj = parseHeaders(headers)), name) {
                var value = headersObj[lowercase(name)];
                return void 0 === value && (value = null), value;
            }
            return headersObj;
        };
    }
    function transformData(data, headers, status, fns) {
        return isFunction(fns) ? fns(data, headers, status) : (forEach(fns, function(fn) {
            data = fn(data, headers, status);
        }), data);
    }
    function isSuccess(status) {
        return status >= 200 && 300 > status;
    }
    function $HttpProvider() {
        var defaults = this.defaults = {
            transformResponse: [ defaultHttpResponseTransform ],
            transformRequest: [ function(d) {
                return !isObject(d) || isFile(d) || isBlob(d) || isFormData(d) ? d : toJson(d);
            } ],
            headers: {
                common: {
                    Accept: "application/json, text/plain, */*"
                },
                post: shallowCopy(CONTENT_TYPE_APPLICATION_JSON),
                put: shallowCopy(CONTENT_TYPE_APPLICATION_JSON),
                patch: shallowCopy(CONTENT_TYPE_APPLICATION_JSON)
            },
            xsrfCookieName: "XSRF-TOKEN",
            xsrfHeaderName: "X-XSRF-TOKEN",
            paramSerializer: "$httpParamSerializer"
        }, useApplyAsync = !1;
        this.useApplyAsync = function(value) {
            return isDefined(value) ? (useApplyAsync = !!value, this) : useApplyAsync;
        };
        var interceptorFactories = this.interceptors = [];
        this.$get = [ "$httpBackend", "$$cookieReader", "$cacheFactory", "$rootScope", "$q", "$injector", function($httpBackend, $$cookieReader, $cacheFactory, $rootScope, $q, $injector) {
            function $http(requestConfig) {
                function transformResponse(response) {
                    var resp = extend({}, response);
                    return response.data ? resp.data = transformData(response.data, response.headers, response.status, config.transformResponse) : resp.data = response.data, 
                    isSuccess(response.status) ? resp : $q.reject(resp);
                }
                function executeHeaderFns(headers, config) {
                    var headerContent, processedHeaders = {};
                    return forEach(headers, function(headerFn, header) {
                        isFunction(headerFn) ? (headerContent = headerFn(config), null != headerContent && (processedHeaders[header] = headerContent)) : processedHeaders[header] = headerFn;
                    }), processedHeaders;
                }
                function mergeHeaders(config) {
                    var defHeaderName, lowercaseDefHeaderName, reqHeaderName, defHeaders = defaults.headers, reqHeaders = extend({}, config.headers);
                    defHeaders = extend({}, defHeaders.common, defHeaders[lowercase(config.method)]);
                    defaultHeadersIteration: for (defHeaderName in defHeaders) {
                        lowercaseDefHeaderName = lowercase(defHeaderName);
                        for (reqHeaderName in reqHeaders) if (lowercase(reqHeaderName) === lowercaseDefHeaderName) continue defaultHeadersIteration;
                        reqHeaders[defHeaderName] = defHeaders[defHeaderName];
                    }
                    return executeHeaderFns(reqHeaders, shallowCopy(config));
                }
                if (!angular.isObject(requestConfig)) throw minErr("$http")("badreq", "Http request configuration must be an object.  Received: {0}", requestConfig);
                var config = extend({
                    method: "get",
                    transformRequest: defaults.transformRequest,
                    transformResponse: defaults.transformResponse,
                    paramSerializer: defaults.paramSerializer
                }, requestConfig);
                config.headers = mergeHeaders(requestConfig), config.method = uppercase(config.method), 
                config.paramSerializer = isString(config.paramSerializer) ? $injector.get(config.paramSerializer) : config.paramSerializer;
                var serverRequest = function(config) {
                    var headers = config.headers, reqData = transformData(config.data, headersGetter(headers), undefined, config.transformRequest);
                    return isUndefined(reqData) && forEach(headers, function(value, header) {
                        "content-type" === lowercase(header) && delete headers[header];
                    }), isUndefined(config.withCredentials) && !isUndefined(defaults.withCredentials) && (config.withCredentials = defaults.withCredentials), 
                    sendReq(config, reqData).then(transformResponse, transformResponse);
                }, chain = [ serverRequest, undefined ], promise = $q.when(config);
                for (forEach(reversedInterceptors, function(interceptor) {
                    (interceptor.request || interceptor.requestError) && chain.unshift(interceptor.request, interceptor.requestError), 
                    (interceptor.response || interceptor.responseError) && chain.push(interceptor.response, interceptor.responseError);
                }); chain.length; ) {
                    var thenFn = chain.shift(), rejectFn = chain.shift();
                    promise = promise.then(thenFn, rejectFn);
                }
                return promise.success = function(fn) {
                    return assertArgFn(fn, "fn"), promise.then(function(response) {
                        fn(response.data, response.status, response.headers, config);
                    }), promise;
                }, promise.error = function(fn) {
                    return assertArgFn(fn, "fn"), promise.then(null, function(response) {
                        fn(response.data, response.status, response.headers, config);
                    }), promise;
                }, promise;
            }
            function createShortMethods(names) {
                forEach(arguments, function(name) {
                    $http[name] = function(url, config) {
                        return $http(extend({}, config || {}, {
                            method: name,
                            url: url
                        }));
                    };
                });
            }
            function createShortMethodsWithData(name) {
                forEach(arguments, function(name) {
                    $http[name] = function(url, data, config) {
                        return $http(extend({}, config || {}, {
                            method: name,
                            url: url,
                            data: data
                        }));
                    };
                });
            }
            function sendReq(config, reqData) {
                function done(status, response, headersString, statusText) {
                    function resolveHttpPromise() {
                        resolvePromise(response, status, headersString, statusText);
                    }
                    cache && (isSuccess(status) ? cache.put(url, [ status, response, parseHeaders(headersString), statusText ]) : cache.remove(url)), 
                    useApplyAsync ? $rootScope.$applyAsync(resolveHttpPromise) : (resolveHttpPromise(), 
                    $rootScope.$$phase || $rootScope.$apply());
                }
                function resolvePromise(response, status, headers, statusText) {
                    status = Math.max(status, 0), (isSuccess(status) ? deferred.resolve : deferred.reject)({
                        data: response,
                        status: status,
                        headers: headersGetter(headers),
                        config: config,
                        statusText: statusText
                    });
                }
                function resolvePromiseWithResult(result) {
                    resolvePromise(result.data, result.status, shallowCopy(result.headers()), result.statusText);
                }
                function removePendingReq() {
                    var idx = $http.pendingRequests.indexOf(config);
                    -1 !== idx && $http.pendingRequests.splice(idx, 1);
                }
                var cache, cachedResp, deferred = $q.defer(), promise = deferred.promise, reqHeaders = config.headers, url = buildUrl(config.url, config.paramSerializer(config.params));
                if ($http.pendingRequests.push(config), promise.then(removePendingReq, removePendingReq), 
                !config.cache && !defaults.cache || config.cache === !1 || "GET" !== config.method && "JSONP" !== config.method || (cache = isObject(config.cache) ? config.cache : isObject(defaults.cache) ? defaults.cache : defaultCache), 
                cache && (cachedResp = cache.get(url), isDefined(cachedResp) ? isPromiseLike(cachedResp) ? cachedResp.then(resolvePromiseWithResult, resolvePromiseWithResult) : isArray(cachedResp) ? resolvePromise(cachedResp[1], cachedResp[0], shallowCopy(cachedResp[2]), cachedResp[3]) : resolvePromise(cachedResp, 200, {}, "OK") : cache.put(url, promise)), 
                isUndefined(cachedResp)) {
                    var xsrfValue = urlIsSameOrigin(config.url) ? $$cookieReader()[config.xsrfCookieName || defaults.xsrfCookieName] : undefined;
                    xsrfValue && (reqHeaders[config.xsrfHeaderName || defaults.xsrfHeaderName] = xsrfValue), 
                    $httpBackend(config.method, url, reqData, done, reqHeaders, config.timeout, config.withCredentials, config.responseType);
                }
                return promise;
            }
            function buildUrl(url, serializedParams) {
                return serializedParams.length > 0 && (url += (-1 == url.indexOf("?") ? "?" : "&") + serializedParams), 
                url;
            }
            var defaultCache = $cacheFactory("$http");
            defaults.paramSerializer = isString(defaults.paramSerializer) ? $injector.get(defaults.paramSerializer) : defaults.paramSerializer;
            var reversedInterceptors = [];
            return forEach(interceptorFactories, function(interceptorFactory) {
                reversedInterceptors.unshift(isString(interceptorFactory) ? $injector.get(interceptorFactory) : $injector.invoke(interceptorFactory));
            }), $http.pendingRequests = [], createShortMethods("get", "delete", "head", "jsonp"), 
            createShortMethodsWithData("post", "put", "patch"), $http.defaults = defaults, $http;
        } ];
    }
    function createXhr() {
        return new window.XMLHttpRequest();
    }
    function $HttpBackendProvider() {
        this.$get = [ "$browser", "$window", "$document", function($browser, $window, $document) {
            return createHttpBackend($browser, createXhr, $browser.defer, $window.angular.callbacks, $document[0]);
        } ];
    }
    function createHttpBackend($browser, createXhr, $browserDefer, callbacks, rawDocument) {
        function jsonpReq(url, callbackId, done) {
            var script = rawDocument.createElement("script"), callback = null;
            return script.type = "text/javascript", script.src = url, script.async = !0, callback = function(event) {
                removeEventListenerFn(script, "load", callback), removeEventListenerFn(script, "error", callback), 
                rawDocument.body.removeChild(script), script = null;
                var status = -1, text = "unknown";
                event && ("load" !== event.type || callbacks[callbackId].called || (event = {
                    type: "error"
                }), text = event.type, status = "error" === event.type ? 404 : 200), done && done(status, text);
            }, addEventListenerFn(script, "load", callback), addEventListenerFn(script, "error", callback), 
            rawDocument.body.appendChild(script), callback;
        }
        return function(method, url, post, callback, headers, timeout, withCredentials, responseType) {
            function timeoutRequest() {
                jsonpDone && jsonpDone(), xhr && xhr.abort();
            }
            function completeRequest(callback, status, response, headersString, statusText) {
                timeoutId !== undefined && $browserDefer.cancel(timeoutId), jsonpDone = xhr = null, 
                callback(status, response, headersString, statusText), $browser.$$completeOutstandingRequest(noop);
            }
            if ($browser.$$incOutstandingRequestCount(), url = url || $browser.url(), "jsonp" == lowercase(method)) {
                var callbackId = "_" + (callbacks.counter++).toString(36);
                callbacks[callbackId] = function(data) {
                    callbacks[callbackId].data = data, callbacks[callbackId].called = !0;
                };
                var jsonpDone = jsonpReq(url.replace("JSON_CALLBACK", "angular.callbacks." + callbackId), callbackId, function(status, text) {
                    completeRequest(callback, status, callbacks[callbackId].data, "", text), callbacks[callbackId] = noop;
                });
            } else {
                var xhr = createXhr();
                xhr.open(method, url, !0), forEach(headers, function(value, key) {
                    isDefined(value) && xhr.setRequestHeader(key, value);
                }), xhr.onload = function() {
                    var statusText = xhr.statusText || "", response = "response" in xhr ? xhr.response : xhr.responseText, status = 1223 === xhr.status ? 204 : xhr.status;
                    0 === status && (status = response ? 200 : "file" == urlResolve(url).protocol ? 404 : 0), 
                    completeRequest(callback, status, response, xhr.getAllResponseHeaders(), statusText);
                };
                var requestError = function() {
                    completeRequest(callback, -1, null, null, "");
                };
                if (xhr.onerror = requestError, xhr.onabort = requestError, withCredentials && (xhr.withCredentials = !0), 
                responseType) try {
                    xhr.responseType = responseType;
                } catch (e) {
                    if ("json" !== responseType) throw e;
                }
                xhr.send(post);
            }
            if (timeout > 0) var timeoutId = $browserDefer(timeoutRequest, timeout); else isPromiseLike(timeout) && timeout.then(timeoutRequest);
        };
    }
    function $InterpolateProvider() {
        var startSymbol = "{{", endSymbol = "}}";
        this.startSymbol = function(value) {
            return value ? (startSymbol = value, this) : startSymbol;
        }, this.endSymbol = function(value) {
            return value ? (endSymbol = value, this) : endSymbol;
        }, this.$get = [ "$parse", "$exceptionHandler", "$sce", function($parse, $exceptionHandler, $sce) {
            function escape(ch) {
                return "\\\\\\" + ch;
            }
            function unescapeText(text) {
                return text.replace(escapedStartRegexp, startSymbol).replace(escapedEndRegexp, endSymbol);
            }
            function stringify(value) {
                if (null == value) return "";
                switch (typeof value) {
                  case "string":
                    break;

                  case "number":
                    value = "" + value;
                    break;

                  default:
                    value = toJson(value);
                }
                return value;
            }
            function $interpolate(text, mustHaveExpression, trustedContext, allOrNothing) {
                function parseStringifyInterceptor(value) {
                    try {
                        return value = getValue(value), allOrNothing && !isDefined(value) ? value : stringify(value);
                    } catch (err) {
                        $exceptionHandler($interpolateMinErr.interr(text, err));
                    }
                }
                allOrNothing = !!allOrNothing;
                for (var startIndex, endIndex, exp, index = 0, expressions = [], parseFns = [], textLength = text.length, concat = [], expressionPositions = []; textLength > index; ) {
                    if (-1 == (startIndex = text.indexOf(startSymbol, index)) || -1 == (endIndex = text.indexOf(endSymbol, startIndex + startSymbolLength))) {
                        index !== textLength && concat.push(unescapeText(text.substring(index)));
                        break;
                    }
                    index !== startIndex && concat.push(unescapeText(text.substring(index, startIndex))), 
                    exp = text.substring(startIndex + startSymbolLength, endIndex), expressions.push(exp), 
                    parseFns.push($parse(exp, parseStringifyInterceptor)), index = endIndex + endSymbolLength, 
                    expressionPositions.push(concat.length), concat.push("");
                }
                if (trustedContext && concat.length > 1 && $interpolateMinErr.throwNoconcat(text), 
                !mustHaveExpression || expressions.length) {
                    var compute = function(values) {
                        for (var i = 0, ii = expressions.length; ii > i; i++) {
                            if (allOrNothing && isUndefined(values[i])) return;
                            concat[expressionPositions[i]] = values[i];
                        }
                        return concat.join("");
                    }, getValue = function(value) {
                        return trustedContext ? $sce.getTrusted(trustedContext, value) : $sce.valueOf(value);
                    };
                    return extend(function(context) {
                        var i = 0, ii = expressions.length, values = new Array(ii);
                        try {
                            for (;ii > i; i++) values[i] = parseFns[i](context);
                            return compute(values);
                        } catch (err) {
                            $exceptionHandler($interpolateMinErr.interr(text, err));
                        }
                    }, {
                        exp: text,
                        expressions: expressions,
                        $$watchDelegate: function(scope, listener) {
                            var lastValue;
                            return scope.$watchGroup(parseFns, function(values, oldValues) {
                                var currValue = compute(values);
                                isFunction(listener) && listener.call(this, currValue, values !== oldValues ? lastValue : currValue, scope), 
                                lastValue = currValue;
                            });
                        }
                    });
                }
            }
            var startSymbolLength = startSymbol.length, endSymbolLength = endSymbol.length, escapedStartRegexp = new RegExp(startSymbol.replace(/./g, escape), "g"), escapedEndRegexp = new RegExp(endSymbol.replace(/./g, escape), "g");
            return $interpolate.startSymbol = function() {
                return startSymbol;
            }, $interpolate.endSymbol = function() {
                return endSymbol;
            }, $interpolate;
        } ];
    }
    function $IntervalProvider() {
        this.$get = [ "$rootScope", "$window", "$q", "$$q", function($rootScope, $window, $q, $$q) {
            function interval(fn, delay, count, invokeApply) {
                var hasParams = arguments.length > 4, args = hasParams ? sliceArgs(arguments, 4) : [], setInterval = $window.setInterval, clearInterval = $window.clearInterval, iteration = 0, skipApply = isDefined(invokeApply) && !invokeApply, deferred = (skipApply ? $$q : $q).defer(), promise = deferred.promise;
                return count = isDefined(count) ? count : 0, promise.then(null, null, hasParams ? function() {
                    fn.apply(null, args);
                } : fn), promise.$$intervalId = setInterval(function() {
                    deferred.notify(iteration++), count > 0 && iteration >= count && (deferred.resolve(iteration), 
                    clearInterval(promise.$$intervalId), delete intervals[promise.$$intervalId]), skipApply || $rootScope.$apply();
                }, delay), intervals[promise.$$intervalId] = deferred, promise;
            }
            var intervals = {};
            return interval.cancel = function(promise) {
                return promise && promise.$$intervalId in intervals ? (intervals[promise.$$intervalId].reject("canceled"), 
                $window.clearInterval(promise.$$intervalId), delete intervals[promise.$$intervalId], 
                !0) : !1;
            }, interval;
        } ];
    }
    function $LocaleProvider() {
        this.$get = function() {
            return {
                id: "en-us",
                NUMBER_FORMATS: {
                    DECIMAL_SEP: ".",
                    GROUP_SEP: ",",
                    PATTERNS: [ {
                        minInt: 1,
                        minFrac: 0,
                        maxFrac: 3,
                        posPre: "",
                        posSuf: "",
                        negPre: "-",
                        negSuf: "",
                        gSize: 3,
                        lgSize: 3
                    }, {
                        minInt: 1,
                        minFrac: 2,
                        maxFrac: 2,
                        posPre: "¤",
                        posSuf: "",
                        negPre: "(¤",
                        negSuf: ")",
                        gSize: 3,
                        lgSize: 3
                    } ],
                    CURRENCY_SYM: "$"
                },
                DATETIME_FORMATS: {
                    MONTH: "January,February,March,April,May,June,July,August,September,October,November,December".split(","),
                    SHORTMONTH: "Jan,Feb,Mar,Apr,May,Jun,Jul,Aug,Sep,Oct,Nov,Dec".split(","),
                    DAY: "Sunday,Monday,Tuesday,Wednesday,Thursday,Friday,Saturday".split(","),
                    SHORTDAY: "Sun,Mon,Tue,Wed,Thu,Fri,Sat".split(","),
                    AMPMS: [ "AM", "PM" ],
                    medium: "MMM d, y h:mm:ss a",
                    "short": "M/d/yy h:mm a",
                    fullDate: "EEEE, MMMM d, y",
                    longDate: "MMMM d, y",
                    mediumDate: "MMM d, y",
                    shortDate: "M/d/yy",
                    mediumTime: "h:mm:ss a",
                    shortTime: "h:mm a",
                    ERANAMES: [ "Before Christ", "Anno Domini" ],
                    ERAS: [ "BC", "AD" ]
                },
                pluralCat: function(num) {
                    return 1 === num ? "one" : "other";
                }
            };
        };
    }
    function encodePath(path) {
        for (var segments = path.split("/"), i = segments.length; i--; ) segments[i] = encodeUriSegment(segments[i]);
        return segments.join("/");
    }
    function parseAbsoluteUrl(absoluteUrl, locationObj) {
        var parsedUrl = urlResolve(absoluteUrl);
        locationObj.$$protocol = parsedUrl.protocol, locationObj.$$host = parsedUrl.hostname, 
        locationObj.$$port = toInt(parsedUrl.port) || DEFAULT_PORTS[parsedUrl.protocol] || null;
    }
    function parseAppUrl(relativeUrl, locationObj) {
        var prefixed = "/" !== relativeUrl.charAt(0);
        prefixed && (relativeUrl = "/" + relativeUrl);
        var match = urlResolve(relativeUrl);
        locationObj.$$path = decodeURIComponent(prefixed && "/" === match.pathname.charAt(0) ? match.pathname.substring(1) : match.pathname), 
        locationObj.$$search = parseKeyValue(match.search), locationObj.$$hash = decodeURIComponent(match.hash), 
        locationObj.$$path && "/" != locationObj.$$path.charAt(0) && (locationObj.$$path = "/" + locationObj.$$path);
    }
    function beginsWith(begin, whole) {
        return 0 === whole.indexOf(begin) ? whole.substr(begin.length) : void 0;
    }
    function stripHash(url) {
        var index = url.indexOf("#");
        return -1 == index ? url : url.substr(0, index);
    }
    function trimEmptyHash(url) {
        return url.replace(/(#.+)|#$/, "$1");
    }
    function stripFile(url) {
        return url.substr(0, stripHash(url).lastIndexOf("/") + 1);
    }
    function serverBase(url) {
        return url.substring(0, url.indexOf("/", url.indexOf("//") + 2));
    }
    function LocationHtml5Url(appBase, basePrefix) {
        this.$$html5 = !0, basePrefix = basePrefix || "";
        var appBaseNoFile = stripFile(appBase);
        parseAbsoluteUrl(appBase, this), this.$$parse = function(url) {
            var pathUrl = beginsWith(appBaseNoFile, url);
            if (!isString(pathUrl)) throw $locationMinErr("ipthprfx", 'Invalid url "{0}", missing path prefix "{1}".', url, appBaseNoFile);
            parseAppUrl(pathUrl, this), this.$$path || (this.$$path = "/"), this.$$compose();
        }, this.$$compose = function() {
            var search = toKeyValue(this.$$search), hash = this.$$hash ? "#" + encodeUriSegment(this.$$hash) : "";
            this.$$url = encodePath(this.$$path) + (search ? "?" + search : "") + hash, this.$$absUrl = appBaseNoFile + this.$$url.substr(1);
        }, this.$$parseLinkUrl = function(url, relHref) {
            if (relHref && "#" === relHref[0]) return this.hash(relHref.slice(1)), !0;
            var appUrl, prevAppUrl, rewrittenUrl;
            return (appUrl = beginsWith(appBase, url)) !== undefined ? (prevAppUrl = appUrl, 
            rewrittenUrl = (appUrl = beginsWith(basePrefix, appUrl)) !== undefined ? appBaseNoFile + (beginsWith("/", appUrl) || appUrl) : appBase + prevAppUrl) : (appUrl = beginsWith(appBaseNoFile, url)) !== undefined ? rewrittenUrl = appBaseNoFile + appUrl : appBaseNoFile == url + "/" && (rewrittenUrl = appBaseNoFile), 
            rewrittenUrl && this.$$parse(rewrittenUrl), !!rewrittenUrl;
        };
    }
    function LocationHashbangUrl(appBase, hashPrefix) {
        var appBaseNoFile = stripFile(appBase);
        parseAbsoluteUrl(appBase, this), this.$$parse = function(url) {
            function removeWindowsDriveName(path, url, base) {
                var firstPathSegmentMatch, windowsFilePathExp = /^\/[A-Z]:(\/.*)/;
                return 0 === url.indexOf(base) && (url = url.replace(base, "")), windowsFilePathExp.exec(url) ? path : (firstPathSegmentMatch = windowsFilePathExp.exec(path), 
                firstPathSegmentMatch ? firstPathSegmentMatch[1] : path);
            }
            var withoutHashUrl, withoutBaseUrl = beginsWith(appBase, url) || beginsWith(appBaseNoFile, url);
            "#" === withoutBaseUrl.charAt(0) ? (withoutHashUrl = beginsWith(hashPrefix, withoutBaseUrl), 
            isUndefined(withoutHashUrl) && (withoutHashUrl = withoutBaseUrl)) : withoutHashUrl = this.$$html5 ? withoutBaseUrl : "", 
            parseAppUrl(withoutHashUrl, this), this.$$path = removeWindowsDriveName(this.$$path, withoutHashUrl, appBase), 
            this.$$compose();
        }, this.$$compose = function() {
            var search = toKeyValue(this.$$search), hash = this.$$hash ? "#" + encodeUriSegment(this.$$hash) : "";
            this.$$url = encodePath(this.$$path) + (search ? "?" + search : "") + hash, this.$$absUrl = appBase + (this.$$url ? hashPrefix + this.$$url : "");
        }, this.$$parseLinkUrl = function(url, relHref) {
            return stripHash(appBase) == stripHash(url) ? (this.$$parse(url), !0) : !1;
        };
    }
    function LocationHashbangInHtml5Url(appBase, hashPrefix) {
        this.$$html5 = !0, LocationHashbangUrl.apply(this, arguments);
        var appBaseNoFile = stripFile(appBase);
        this.$$parseLinkUrl = function(url, relHref) {
            if (relHref && "#" === relHref[0]) return this.hash(relHref.slice(1)), !0;
            var rewrittenUrl, appUrl;
            return appBase == stripHash(url) ? rewrittenUrl = url : (appUrl = beginsWith(appBaseNoFile, url)) ? rewrittenUrl = appBase + hashPrefix + appUrl : appBaseNoFile === url + "/" && (rewrittenUrl = appBaseNoFile), 
            rewrittenUrl && this.$$parse(rewrittenUrl), !!rewrittenUrl;
        }, this.$$compose = function() {
            var search = toKeyValue(this.$$search), hash = this.$$hash ? "#" + encodeUriSegment(this.$$hash) : "";
            this.$$url = encodePath(this.$$path) + (search ? "?" + search : "") + hash, this.$$absUrl = appBase + hashPrefix + this.$$url;
        };
    }
    function locationGetter(property) {
        return function() {
            return this[property];
        };
    }
    function locationGetterSetter(property, preprocess) {
        return function(value) {
            return isUndefined(value) ? this[property] : (this[property] = preprocess(value), 
            this.$$compose(), this);
        };
    }
    function $LocationProvider() {
        var hashPrefix = "", html5Mode = {
            enabled: !1,
            requireBase: !0,
            rewriteLinks: !0
        };
        this.hashPrefix = function(prefix) {
            return isDefined(prefix) ? (hashPrefix = prefix, this) : hashPrefix;
        }, this.html5Mode = function(mode) {
            return isBoolean(mode) ? (html5Mode.enabled = mode, this) : isObject(mode) ? (isBoolean(mode.enabled) && (html5Mode.enabled = mode.enabled), 
            isBoolean(mode.requireBase) && (html5Mode.requireBase = mode.requireBase), isBoolean(mode.rewriteLinks) && (html5Mode.rewriteLinks = mode.rewriteLinks), 
            this) : html5Mode;
        }, this.$get = [ "$rootScope", "$browser", "$sniffer", "$rootElement", "$window", function($rootScope, $browser, $sniffer, $rootElement, $window) {
            function setBrowserUrlWithFallback(url, replace, state) {
                var oldUrl = $location.url(), oldState = $location.$$state;
                try {
                    $browser.url(url, replace, state), $location.$$state = $browser.state();
                } catch (e) {
                    throw $location.url(oldUrl), $location.$$state = oldState, e;
                }
            }
            function afterLocationChange(oldUrl, oldState) {
                $rootScope.$broadcast("$locationChangeSuccess", $location.absUrl(), oldUrl, $location.$$state, oldState);
            }
            var $location, LocationMode, appBase, baseHref = $browser.baseHref(), initialUrl = $browser.url();
            if (html5Mode.enabled) {
                if (!baseHref && html5Mode.requireBase) throw $locationMinErr("nobase", "$location in HTML5 mode requires a <base> tag to be present!");
                appBase = serverBase(initialUrl) + (baseHref || "/"), LocationMode = $sniffer.history ? LocationHtml5Url : LocationHashbangInHtml5Url;
            } else appBase = stripHash(initialUrl), LocationMode = LocationHashbangUrl;
            $location = new LocationMode(appBase, "#" + hashPrefix), $location.$$parseLinkUrl(initialUrl, initialUrl), 
            $location.$$state = $browser.state();
            var IGNORE_URI_REGEXP = /^\s*(javascript|mailto):/i;
            $rootElement.on("click", function(event) {
                if (html5Mode.rewriteLinks && !event.ctrlKey && !event.metaKey && !event.shiftKey && 2 != event.which && 2 != event.button) {
                    for (var elm = jqLite(event.target); "a" !== nodeName_(elm[0]); ) if (elm[0] === $rootElement[0] || !(elm = elm.parent())[0]) return;
                    var absHref = elm.prop("href"), relHref = elm.attr("href") || elm.attr("xlink:href");
                    isObject(absHref) && "[object SVGAnimatedString]" === absHref.toString() && (absHref = urlResolve(absHref.animVal).href), 
                    IGNORE_URI_REGEXP.test(absHref) || !absHref || elm.attr("target") || event.isDefaultPrevented() || $location.$$parseLinkUrl(absHref, relHref) && (event.preventDefault(), 
                    $location.absUrl() != $browser.url() && ($rootScope.$apply(), $window.angular["ff-684208-preventDefault"] = !0));
                }
            }), trimEmptyHash($location.absUrl()) != trimEmptyHash(initialUrl) && $browser.url($location.absUrl(), !0);
            var initializing = !0;
            return $browser.onUrlChange(function(newUrl, newState) {
                $rootScope.$evalAsync(function() {
                    var defaultPrevented, oldUrl = $location.absUrl(), oldState = $location.$$state;
                    $location.$$parse(newUrl), $location.$$state = newState, defaultPrevented = $rootScope.$broadcast("$locationChangeStart", newUrl, oldUrl, newState, oldState).defaultPrevented, 
                    $location.absUrl() === newUrl && (defaultPrevented ? ($location.$$parse(oldUrl), 
                    $location.$$state = oldState, setBrowserUrlWithFallback(oldUrl, !1, oldState)) : (initializing = !1, 
                    afterLocationChange(oldUrl, oldState)));
                }), $rootScope.$$phase || $rootScope.$digest();
            }), $rootScope.$watch(function() {
                var oldUrl = trimEmptyHash($browser.url()), newUrl = trimEmptyHash($location.absUrl()), oldState = $browser.state(), currentReplace = $location.$$replace, urlOrStateChanged = oldUrl !== newUrl || $location.$$html5 && $sniffer.history && oldState !== $location.$$state;
                (initializing || urlOrStateChanged) && (initializing = !1, $rootScope.$evalAsync(function() {
                    var newUrl = $location.absUrl(), defaultPrevented = $rootScope.$broadcast("$locationChangeStart", newUrl, oldUrl, $location.$$state, oldState).defaultPrevented;
                    $location.absUrl() === newUrl && (defaultPrevented ? ($location.$$parse(oldUrl), 
                    $location.$$state = oldState) : (urlOrStateChanged && setBrowserUrlWithFallback(newUrl, currentReplace, oldState === $location.$$state ? null : $location.$$state), 
                    afterLocationChange(oldUrl, oldState)));
                })), $location.$$replace = !1;
            }), $location;
        } ];
    }
    function $LogProvider() {
        var debug = !0, self = this;
        this.debugEnabled = function(flag) {
            return isDefined(flag) ? (debug = flag, this) : debug;
        }, this.$get = [ "$window", function($window) {
            function formatError(arg) {
                return arg instanceof Error && (arg.stack ? arg = arg.message && -1 === arg.stack.indexOf(arg.message) ? "Error: " + arg.message + "\n" + arg.stack : arg.stack : arg.sourceURL && (arg = arg.message + "\n" + arg.sourceURL + ":" + arg.line)), 
                arg;
            }
            function consoleLog(type) {
                var console = $window.console || {}, logFn = console[type] || console.log || noop, hasApply = !1;
                try {
                    hasApply = !!logFn.apply;
                } catch (e) {}
                return hasApply ? function() {
                    var args = [];
                    return forEach(arguments, function(arg) {
                        args.push(formatError(arg));
                    }), logFn.apply(console, args);
                } : function(arg1, arg2) {
                    logFn(arg1, null == arg2 ? "" : arg2);
                };
            }
            return {
                log: consoleLog("log"),
                info: consoleLog("info"),
                warn: consoleLog("warn"),
                error: consoleLog("error"),
                debug: function() {
                    var fn = consoleLog("debug");
                    return function() {
                        debug && fn.apply(self, arguments);
                    };
                }()
            };
        } ];
    }
    function ensureSafeMemberName(name, fullExpression) {
        if ("__defineGetter__" === name || "__defineSetter__" === name || "__lookupGetter__" === name || "__lookupSetter__" === name || "__proto__" === name) throw $parseMinErr("isecfld", "Attempting to access a disallowed field in Angular expressions! Expression: {0}", fullExpression);
        return name;
    }
    function ensureSafeObject(obj, fullExpression) {
        if (obj) {
            if (obj.constructor === obj) throw $parseMinErr("isecfn", "Referencing Function in Angular expressions is disallowed! Expression: {0}", fullExpression);
            if (obj.window === obj) throw $parseMinErr("isecwindow", "Referencing the Window in Angular expressions is disallowed! Expression: {0}", fullExpression);
            if (obj.children && (obj.nodeName || obj.prop && obj.attr && obj.find)) throw $parseMinErr("isecdom", "Referencing DOM nodes in Angular expressions is disallowed! Expression: {0}", fullExpression);
            if (obj === Object) throw $parseMinErr("isecobj", "Referencing Object in Angular expressions is disallowed! Expression: {0}", fullExpression);
        }
        return obj;
    }
    function ensureSafeFunction(obj, fullExpression) {
        if (obj) {
            if (obj.constructor === obj) throw $parseMinErr("isecfn", "Referencing Function in Angular expressions is disallowed! Expression: {0}", fullExpression);
            if (obj === CALL || obj === APPLY || obj === BIND) throw $parseMinErr("isecff", "Referencing call, apply or bind in Angular expressions is disallowed! Expression: {0}", fullExpression);
        }
    }
    function ifDefined(v, d) {
        return "undefined" != typeof v ? v : d;
    }
    function plusFn(l, r) {
        return "undefined" == typeof l ? r : "undefined" == typeof r ? l : l + r;
    }
    function isStateless($filter, filterName) {
        var fn = $filter(filterName);
        return !fn.$stateful;
    }
    function findConstantAndWatchExpressions(ast, $filter) {
        var allConstants, argsToWatch;
        switch (ast.type) {
          case AST.Program:
            allConstants = !0, forEach(ast.body, function(expr) {
                findConstantAndWatchExpressions(expr.expression, $filter), allConstants = allConstants && expr.expression.constant;
            }), ast.constant = allConstants;
            break;

          case AST.Literal:
            ast.constant = !0, ast.toWatch = [];
            break;

          case AST.UnaryExpression:
            findConstantAndWatchExpressions(ast.argument, $filter), ast.constant = ast.argument.constant, 
            ast.toWatch = ast.argument.toWatch;
            break;

          case AST.BinaryExpression:
            findConstantAndWatchExpressions(ast.left, $filter), findConstantAndWatchExpressions(ast.right, $filter), 
            ast.constant = ast.left.constant && ast.right.constant, ast.toWatch = ast.left.toWatch.concat(ast.right.toWatch);
            break;

          case AST.LogicalExpression:
            findConstantAndWatchExpressions(ast.left, $filter), findConstantAndWatchExpressions(ast.right, $filter), 
            ast.constant = ast.left.constant && ast.right.constant, ast.toWatch = ast.constant ? [] : [ ast ];
            break;

          case AST.ConditionalExpression:
            findConstantAndWatchExpressions(ast.test, $filter), findConstantAndWatchExpressions(ast.alternate, $filter), 
            findConstantAndWatchExpressions(ast.consequent, $filter), ast.constant = ast.test.constant && ast.alternate.constant && ast.consequent.constant, 
            ast.toWatch = ast.constant ? [] : [ ast ];
            break;

          case AST.Identifier:
            ast.constant = !1, ast.toWatch = [ ast ];
            break;

          case AST.MemberExpression:
            findConstantAndWatchExpressions(ast.object, $filter), ast.computed && findConstantAndWatchExpressions(ast.property, $filter), 
            ast.constant = ast.object.constant && (!ast.computed || ast.property.constant), 
            ast.toWatch = [ ast ];
            break;

          case AST.CallExpression:
            allConstants = ast.filter ? isStateless($filter, ast.callee.name) : !1, argsToWatch = [], 
            forEach(ast.arguments, function(expr) {
                findConstantAndWatchExpressions(expr, $filter), allConstants = allConstants && expr.constant, 
                expr.constant || argsToWatch.push.apply(argsToWatch, expr.toWatch);
            }), ast.constant = allConstants, ast.toWatch = ast.filter && isStateless($filter, ast.callee.name) ? argsToWatch : [ ast ];
            break;

          case AST.AssignmentExpression:
            findConstantAndWatchExpressions(ast.left, $filter), findConstantAndWatchExpressions(ast.right, $filter), 
            ast.constant = ast.left.constant && ast.right.constant, ast.toWatch = [ ast ];
            break;

          case AST.ArrayExpression:
            allConstants = !0, argsToWatch = [], forEach(ast.elements, function(expr) {
                findConstantAndWatchExpressions(expr, $filter), allConstants = allConstants && expr.constant, 
                expr.constant || argsToWatch.push.apply(argsToWatch, expr.toWatch);
            }), ast.constant = allConstants, ast.toWatch = argsToWatch;
            break;

          case AST.ObjectExpression:
            allConstants = !0, argsToWatch = [], forEach(ast.properties, function(property) {
                findConstantAndWatchExpressions(property.value, $filter), allConstants = allConstants && property.value.constant, 
                property.value.constant || argsToWatch.push.apply(argsToWatch, property.value.toWatch);
            }), ast.constant = allConstants, ast.toWatch = argsToWatch;
            break;

          case AST.ThisExpression:
            ast.constant = !1, ast.toWatch = [];
        }
    }
    function getInputs(body) {
        if (1 == body.length) {
            var lastExpression = body[0].expression, candidate = lastExpression.toWatch;
            return 1 !== candidate.length ? candidate : candidate[0] !== lastExpression ? candidate : undefined;
        }
    }
    function isAssignable(ast) {
        return ast.type === AST.Identifier || ast.type === AST.MemberExpression;
    }
    function assignableAST(ast) {
        return 1 === ast.body.length && isAssignable(ast.body[0].expression) ? {
            type: AST.AssignmentExpression,
            left: ast.body[0].expression,
            right: {
                type: AST.NGValueParameter
            },
            operator: "="
        } : void 0;
    }
    function isLiteral(ast) {
        return 0 === ast.body.length || 1 === ast.body.length && (ast.body[0].expression.type === AST.Literal || ast.body[0].expression.type === AST.ArrayExpression || ast.body[0].expression.type === AST.ObjectExpression);
    }
    function isConstant(ast) {
        return ast.constant;
    }
    function ASTCompiler(astBuilder, $filter) {
        this.astBuilder = astBuilder, this.$filter = $filter;
    }
    function ASTInterpreter(astBuilder, $filter) {
        this.astBuilder = astBuilder, this.$filter = $filter;
    }
    function setter(obj, path, setValue, fullExp) {
        ensureSafeObject(obj, fullExp);
        for (var key, element = path.split("."), i = 0; element.length > 1; i++) {
            key = ensureSafeMemberName(element.shift(), fullExp);
            var propertyObj = ensureSafeObject(obj[key], fullExp);
            propertyObj || (propertyObj = {}, obj[key] = propertyObj), obj = propertyObj;
        }
        return key = ensureSafeMemberName(element.shift(), fullExp), ensureSafeObject(obj[key], fullExp), 
        obj[key] = setValue, setValue;
    }
    function isPossiblyDangerousMemberName(name) {
        return "constructor" == name;
    }
    function getValueOf(value) {
        return isFunction(value.valueOf) ? value.valueOf() : objectValueOf.call(value);
    }
    function $ParseProvider() {
        var cacheDefault = createMap(), cacheExpensive = createMap();
        this.$get = [ "$filter", "$sniffer", function($filter, $sniffer) {
            function expressionInputDirtyCheck(newValue, oldValueOfValue) {
                return null == newValue || null == oldValueOfValue ? newValue === oldValueOfValue : "object" == typeof newValue && (newValue = getValueOf(newValue), 
                "object" == typeof newValue) ? !1 : newValue === oldValueOfValue || newValue !== newValue && oldValueOfValue !== oldValueOfValue;
            }
            function inputsWatchDelegate(scope, listener, objectEquality, parsedExpression, prettyPrintExpression) {
                var lastResult, inputExpressions = parsedExpression.inputs;
                if (1 === inputExpressions.length) {
                    var oldInputValueOf = expressionInputDirtyCheck;
                    return inputExpressions = inputExpressions[0], scope.$watch(function(scope) {
                        var newInputValue = inputExpressions(scope);
                        return expressionInputDirtyCheck(newInputValue, oldInputValueOf) || (lastResult = parsedExpression(scope, undefined, undefined, [ newInputValue ]), 
                        oldInputValueOf = newInputValue && getValueOf(newInputValue)), lastResult;
                    }, listener, objectEquality, prettyPrintExpression);
                }
                for (var oldInputValueOfValues = [], oldInputValues = [], i = 0, ii = inputExpressions.length; ii > i; i++) oldInputValueOfValues[i] = expressionInputDirtyCheck, 
                oldInputValues[i] = null;
                return scope.$watch(function(scope) {
                    for (var changed = !1, i = 0, ii = inputExpressions.length; ii > i; i++) {
                        var newInputValue = inputExpressions[i](scope);
                        (changed || (changed = !expressionInputDirtyCheck(newInputValue, oldInputValueOfValues[i]))) && (oldInputValues[i] = newInputValue, 
                        oldInputValueOfValues[i] = newInputValue && getValueOf(newInputValue));
                    }
                    return changed && (lastResult = parsedExpression(scope, undefined, undefined, oldInputValues)), 
                    lastResult;
                }, listener, objectEquality, prettyPrintExpression);
            }
            function oneTimeWatchDelegate(scope, listener, objectEquality, parsedExpression) {
                var unwatch, lastValue;
                return unwatch = scope.$watch(function(scope) {
                    return parsedExpression(scope);
                }, function(value, old, scope) {
                    lastValue = value, isFunction(listener) && listener.apply(this, arguments), isDefined(value) && scope.$$postDigest(function() {
                        isDefined(lastValue) && unwatch();
                    });
                }, objectEquality);
            }
            function oneTimeLiteralWatchDelegate(scope, listener, objectEquality, parsedExpression) {
                function isAllDefined(value) {
                    var allDefined = !0;
                    return forEach(value, function(val) {
                        isDefined(val) || (allDefined = !1);
                    }), allDefined;
                }
                var unwatch, lastValue;
                return unwatch = scope.$watch(function(scope) {
                    return parsedExpression(scope);
                }, function(value, old, scope) {
                    lastValue = value, isFunction(listener) && listener.call(this, value, old, scope), 
                    isAllDefined(value) && scope.$$postDigest(function() {
                        isAllDefined(lastValue) && unwatch();
                    });
                }, objectEquality);
            }
            function constantWatchDelegate(scope, listener, objectEquality, parsedExpression) {
                var unwatch;
                return unwatch = scope.$watch(function(scope) {
                    return parsedExpression(scope);
                }, function(value, old, scope) {
                    isFunction(listener) && listener.apply(this, arguments), unwatch();
                }, objectEquality);
            }
            function addInterceptor(parsedExpression, interceptorFn) {
                if (!interceptorFn) return parsedExpression;
                var watchDelegate = parsedExpression.$$watchDelegate, regularWatch = watchDelegate !== oneTimeLiteralWatchDelegate && watchDelegate !== oneTimeWatchDelegate, fn = regularWatch ? function(scope, locals, assign, inputs) {
                    var value = parsedExpression(scope, locals, assign, inputs);
                    return interceptorFn(value, scope, locals);
                } : function(scope, locals, assign, inputs) {
                    var value = parsedExpression(scope, locals, assign, inputs), result = interceptorFn(value, scope, locals);
                    return isDefined(value) ? result : value;
                };
                return parsedExpression.$$watchDelegate && parsedExpression.$$watchDelegate !== inputsWatchDelegate ? fn.$$watchDelegate = parsedExpression.$$watchDelegate : interceptorFn.$stateful || (fn.$$watchDelegate = inputsWatchDelegate, 
                fn.inputs = parsedExpression.inputs ? parsedExpression.inputs : [ parsedExpression ]), 
                fn;
            }
            var $parseOptions = {
                csp: $sniffer.csp,
                expensiveChecks: !1
            }, $parseOptionsExpensive = {
                csp: $sniffer.csp,
                expensiveChecks: !0
            };
            return function(exp, interceptorFn, expensiveChecks) {
                var parsedExpression, oneTime, cacheKey;
                switch (typeof exp) {
                  case "string":
                    exp = exp.trim(), cacheKey = exp;
                    var cache = expensiveChecks ? cacheExpensive : cacheDefault;
                    if (parsedExpression = cache[cacheKey], !parsedExpression) {
                        ":" === exp.charAt(0) && ":" === exp.charAt(1) && (oneTime = !0, exp = exp.substring(2));
                        var parseOptions = expensiveChecks ? $parseOptionsExpensive : $parseOptions, lexer = new Lexer(parseOptions), parser = new Parser(lexer, $filter, parseOptions);
                        parsedExpression = parser.parse(exp), parsedExpression.constant ? parsedExpression.$$watchDelegate = constantWatchDelegate : oneTime ? parsedExpression.$$watchDelegate = parsedExpression.literal ? oneTimeLiteralWatchDelegate : oneTimeWatchDelegate : parsedExpression.inputs && (parsedExpression.$$watchDelegate = inputsWatchDelegate), 
                        cache[cacheKey] = parsedExpression;
                    }
                    return addInterceptor(parsedExpression, interceptorFn);

                  case "function":
                    return addInterceptor(exp, interceptorFn);

                  default:
                    return noop;
                }
            };
        } ];
    }
    function $QProvider() {
        this.$get = [ "$rootScope", "$exceptionHandler", function($rootScope, $exceptionHandler) {
            return qFactory(function(callback) {
                $rootScope.$evalAsync(callback);
            }, $exceptionHandler);
        } ];
    }
    function $$QProvider() {
        this.$get = [ "$browser", "$exceptionHandler", function($browser, $exceptionHandler) {
            return qFactory(function(callback) {
                $browser.defer(callback);
            }, $exceptionHandler);
        } ];
    }
    function qFactory(nextTick, exceptionHandler) {
        function callOnce(self, resolveFn, rejectFn) {
            function wrap(fn) {
                return function(value) {
                    called || (called = !0, fn.call(self, value));
                };
            }
            var called = !1;
            return [ wrap(resolveFn), wrap(rejectFn) ];
        }
        function Promise() {
            this.$$state = {
                status: 0
            };
        }
        function simpleBind(context, fn) {
            return function(value) {
                fn.call(context, value);
            };
        }
        function processQueue(state) {
            var fn, deferred, pending;
            pending = state.pending, state.processScheduled = !1, state.pending = undefined;
            for (var i = 0, ii = pending.length; ii > i; ++i) {
                deferred = pending[i][0], fn = pending[i][state.status];
                try {
                    isFunction(fn) ? deferred.resolve(fn(state.value)) : 1 === state.status ? deferred.resolve(state.value) : deferred.reject(state.value);
                } catch (e) {
                    deferred.reject(e), exceptionHandler(e);
                }
            }
        }
        function scheduleProcessQueue(state) {
            !state.processScheduled && state.pending && (state.processScheduled = !0, nextTick(function() {
                processQueue(state);
            }));
        }
        function Deferred() {
            this.promise = new Promise(), this.resolve = simpleBind(this, this.resolve), this.reject = simpleBind(this, this.reject), 
            this.notify = simpleBind(this, this.notify);
        }
        function all(promises) {
            var deferred = new Deferred(), counter = 0, results = isArray(promises) ? [] : {};
            return forEach(promises, function(promise, key) {
                counter++, when(promise).then(function(value) {
                    results.hasOwnProperty(key) || (results[key] = value, --counter || deferred.resolve(results));
                }, function(reason) {
                    results.hasOwnProperty(key) || deferred.reject(reason);
                });
            }), 0 === counter && deferred.resolve(results), deferred.promise;
        }
        var $qMinErr = minErr("$q", TypeError), defer = function() {
            return new Deferred();
        };
        Promise.prototype = {
            then: function(onFulfilled, onRejected, progressBack) {
                var result = new Deferred();
                return this.$$state.pending = this.$$state.pending || [], this.$$state.pending.push([ result, onFulfilled, onRejected, progressBack ]), 
                this.$$state.status > 0 && scheduleProcessQueue(this.$$state), result.promise;
            },
            "catch": function(callback) {
                return this.then(null, callback);
            },
            "finally": function(callback, progressBack) {
                return this.then(function(value) {
                    return handleCallback(value, !0, callback);
                }, function(error) {
                    return handleCallback(error, !1, callback);
                }, progressBack);
            }
        }, Deferred.prototype = {
            resolve: function(val) {
                this.promise.$$state.status || (val === this.promise ? this.$$reject($qMinErr("qcycle", "Expected promise to be resolved with value other than itself '{0}'", val)) : this.$$resolve(val));
            },
            $$resolve: function(val) {
                var then, fns;
                fns = callOnce(this, this.$$resolve, this.$$reject);
                try {
                    (isObject(val) || isFunction(val)) && (then = val && val.then), isFunction(then) ? (this.promise.$$state.status = -1, 
                    then.call(val, fns[0], fns[1], this.notify)) : (this.promise.$$state.value = val, 
                    this.promise.$$state.status = 1, scheduleProcessQueue(this.promise.$$state));
                } catch (e) {
                    fns[1](e), exceptionHandler(e);
                }
            },
            reject: function(reason) {
                this.promise.$$state.status || this.$$reject(reason);
            },
            $$reject: function(reason) {
                this.promise.$$state.value = reason, this.promise.$$state.status = 2, scheduleProcessQueue(this.promise.$$state);
            },
            notify: function(progress) {
                var callbacks = this.promise.$$state.pending;
                this.promise.$$state.status <= 0 && callbacks && callbacks.length && nextTick(function() {
                    for (var callback, result, i = 0, ii = callbacks.length; ii > i; i++) {
                        result = callbacks[i][0], callback = callbacks[i][3];
                        try {
                            result.notify(isFunction(callback) ? callback(progress) : progress);
                        } catch (e) {
                            exceptionHandler(e);
                        }
                    }
                });
            }
        };
        var reject = function(reason) {
            var result = new Deferred();
            return result.reject(reason), result.promise;
        }, makePromise = function(value, resolved) {
            var result = new Deferred();
            return resolved ? result.resolve(value) : result.reject(value), result.promise;
        }, handleCallback = function(value, isResolved, callback) {
            var callbackOutput = null;
            try {
                isFunction(callback) && (callbackOutput = callback());
            } catch (e) {
                return makePromise(e, !1);
            }
            return isPromiseLike(callbackOutput) ? callbackOutput.then(function() {
                return makePromise(value, isResolved);
            }, function(error) {
                return makePromise(error, !1);
            }) : makePromise(value, isResolved);
        }, when = function(value, callback, errback, progressBack) {
            var result = new Deferred();
            return result.resolve(value), result.promise.then(callback, errback, progressBack);
        }, $Q = function Q(resolver) {
            function resolveFn(value) {
                deferred.resolve(value);
            }
            function rejectFn(reason) {
                deferred.reject(reason);
            }
            if (!isFunction(resolver)) throw $qMinErr("norslvr", "Expected resolverFn, got '{0}'", resolver);
            if (!(this instanceof Q)) return new Q(resolver);
            var deferred = new Deferred();
            return resolver(resolveFn, rejectFn), deferred.promise;
        };
        return $Q.defer = defer, $Q.reject = reject, $Q.when = when, $Q.all = all, $Q;
    }
    function $$RAFProvider() {
        this.$get = [ "$window", "$timeout", function($window, $timeout) {
            function flush() {
                for (var i = 0; i < taskQueue.length; i++) {
                    var task = taskQueue[i];
                    task && (taskQueue[i] = null, task());
                }
                taskCount = taskQueue.length = 0;
            }
            function queueFn(asyncFn) {
                var index = taskQueue.length;
                return taskCount++, taskQueue.push(asyncFn), 0 === index && (cancelLastRAF = rafFn(flush)), 
                function() {
                    index >= 0 && (taskQueue[index] = null, index = null, 0 === --taskCount && cancelLastRAF && (cancelLastRAF(), 
                    cancelLastRAF = null, taskQueue.length = 0));
                };
            }
            var requestAnimationFrame = $window.requestAnimationFrame || $window.webkitRequestAnimationFrame, cancelAnimationFrame = $window.cancelAnimationFrame || $window.webkitCancelAnimationFrame || $window.webkitCancelRequestAnimationFrame, rafSupported = !!requestAnimationFrame, rafFn = rafSupported ? function(fn) {
                var id = requestAnimationFrame(fn);
                return function() {
                    cancelAnimationFrame(id);
                };
            } : function(fn) {
                var timer = $timeout(fn, 16.66, !1);
                return function() {
                    $timeout.cancel(timer);
                };
            };
            queueFn.supported = rafSupported;
            var cancelLastRAF, taskCount = 0, taskQueue = [];
            return queueFn;
        } ];
    }
    function $RootScopeProvider() {
        function createChildScopeClass(parent) {
            function ChildScope() {
                this.$$watchers = this.$$nextSibling = this.$$childHead = this.$$childTail = null, 
                this.$$listeners = {}, this.$$listenerCount = {}, this.$$watchersCount = 0, this.$id = nextUid(), 
                this.$$ChildScope = null;
            }
            return ChildScope.prototype = parent, ChildScope;
        }
        var TTL = 10, $rootScopeMinErr = minErr("$rootScope"), lastDirtyWatch = null, applyAsyncId = null;
        this.digestTtl = function(value) {
            return arguments.length && (TTL = value), TTL;
        }, this.$get = [ "$injector", "$exceptionHandler", "$parse", "$browser", function($injector, $exceptionHandler, $parse, $browser) {
            function destroyChildScope($event) {
                $event.currentScope.$$destroyed = !0;
            }
            function Scope() {
                this.$id = nextUid(), this.$$phase = this.$parent = this.$$watchers = this.$$nextSibling = this.$$prevSibling = this.$$childHead = this.$$childTail = null, 
                this.$root = this, this.$$destroyed = !1, this.$$listeners = {}, this.$$listenerCount = {}, 
                this.$$watchersCount = 0, this.$$isolateBindings = null;
            }
            function beginPhase(phase) {
                if ($rootScope.$$phase) throw $rootScopeMinErr("inprog", "{0} already in progress", $rootScope.$$phase);
                $rootScope.$$phase = phase;
            }
            function clearPhase() {
                $rootScope.$$phase = null;
            }
            function incrementWatchersCount(current, count) {
                do current.$$watchersCount += count; while (current = current.$parent);
            }
            function decrementListenerCount(current, count, name) {
                do current.$$listenerCount[name] -= count, 0 === current.$$listenerCount[name] && delete current.$$listenerCount[name]; while (current = current.$parent);
            }
            function initWatchVal() {}
            function flushApplyAsync() {
                for (;applyAsyncQueue.length; ) try {
                    applyAsyncQueue.shift()();
                } catch (e) {
                    $exceptionHandler(e);
                }
                applyAsyncId = null;
            }
            function scheduleApplyAsync() {
                null === applyAsyncId && (applyAsyncId = $browser.defer(function() {
                    $rootScope.$apply(flushApplyAsync);
                }));
            }
            Scope.prototype = {
                constructor: Scope,
                $new: function(isolate, parent) {
                    var child;
                    return parent = parent || this, isolate ? (child = new Scope(), child.$root = this.$root) : (this.$$ChildScope || (this.$$ChildScope = createChildScopeClass(this)), 
                    child = new this.$$ChildScope()), child.$parent = parent, child.$$prevSibling = parent.$$childTail, 
                    parent.$$childHead ? (parent.$$childTail.$$nextSibling = child, parent.$$childTail = child) : parent.$$childHead = parent.$$childTail = child, 
                    (isolate || parent != this) && child.$on("$destroy", destroyChildScope), child;
                },
                $watch: function(watchExp, listener, objectEquality, prettyPrintExpression) {
                    var get = $parse(watchExp);
                    if (get.$$watchDelegate) return get.$$watchDelegate(this, listener, objectEquality, get, watchExp);
                    var scope = this, array = scope.$$watchers, watcher = {
                        fn: listener,
                        last: initWatchVal,
                        get: get,
                        exp: prettyPrintExpression || watchExp,
                        eq: !!objectEquality
                    };
                    return lastDirtyWatch = null, isFunction(listener) || (watcher.fn = noop), array || (array = scope.$$watchers = []), 
                    array.unshift(watcher), incrementWatchersCount(this, 1), function() {
                        arrayRemove(array, watcher) >= 0 && incrementWatchersCount(scope, -1), lastDirtyWatch = null;
                    };
                },
                $watchGroup: function(watchExpressions, listener) {
                    function watchGroupAction() {
                        changeReactionScheduled = !1, firstRun ? (firstRun = !1, listener(newValues, newValues, self)) : listener(newValues, oldValues, self);
                    }
                    var oldValues = new Array(watchExpressions.length), newValues = new Array(watchExpressions.length), deregisterFns = [], self = this, changeReactionScheduled = !1, firstRun = !0;
                    if (!watchExpressions.length) {
                        var shouldCall = !0;
                        return self.$evalAsync(function() {
                            shouldCall && listener(newValues, newValues, self);
                        }), function() {
                            shouldCall = !1;
                        };
                    }
                    return 1 === watchExpressions.length ? this.$watch(watchExpressions[0], function(value, oldValue, scope) {
                        newValues[0] = value, oldValues[0] = oldValue, listener(newValues, value === oldValue ? newValues : oldValues, scope);
                    }) : (forEach(watchExpressions, function(expr, i) {
                        var unwatchFn = self.$watch(expr, function(value, oldValue) {
                            newValues[i] = value, oldValues[i] = oldValue, changeReactionScheduled || (changeReactionScheduled = !0, 
                            self.$evalAsync(watchGroupAction));
                        });
                        deregisterFns.push(unwatchFn);
                    }), function() {
                        for (;deregisterFns.length; ) deregisterFns.shift()();
                    });
                },
                $watchCollection: function(obj, listener) {
                    function $watchCollectionInterceptor(_value) {
                        newValue = _value;
                        var newLength, key, bothNaN, newItem, oldItem;
                        if (!isUndefined(newValue)) {
                            if (isObject(newValue)) if (isArrayLike(newValue)) {
                                oldValue !== internalArray && (oldValue = internalArray, oldLength = oldValue.length = 0, 
                                changeDetected++), newLength = newValue.length, oldLength !== newLength && (changeDetected++, 
                                oldValue.length = oldLength = newLength);
                                for (var i = 0; newLength > i; i++) oldItem = oldValue[i], newItem = newValue[i], 
                                bothNaN = oldItem !== oldItem && newItem !== newItem, bothNaN || oldItem === newItem || (changeDetected++, 
                                oldValue[i] = newItem);
                            } else {
                                oldValue !== internalObject && (oldValue = internalObject = {}, oldLength = 0, changeDetected++), 
                                newLength = 0;
                                for (key in newValue) newValue.hasOwnProperty(key) && (newLength++, newItem = newValue[key], 
                                oldItem = oldValue[key], key in oldValue ? (bothNaN = oldItem !== oldItem && newItem !== newItem, 
                                bothNaN || oldItem === newItem || (changeDetected++, oldValue[key] = newItem)) : (oldLength++, 
                                oldValue[key] = newItem, changeDetected++));
                                if (oldLength > newLength) {
                                    changeDetected++;
                                    for (key in oldValue) newValue.hasOwnProperty(key) || (oldLength--, delete oldValue[key]);
                                }
                            } else oldValue !== newValue && (oldValue = newValue, changeDetected++);
                            return changeDetected;
                        }
                    }
                    function $watchCollectionAction() {
                        if (initRun ? (initRun = !1, listener(newValue, newValue, self)) : listener(newValue, veryOldValue, self), 
                        trackVeryOldValue) if (isObject(newValue)) if (isArrayLike(newValue)) {
                            veryOldValue = new Array(newValue.length);
                            for (var i = 0; i < newValue.length; i++) veryOldValue[i] = newValue[i];
                        } else {
                            veryOldValue = {};
                            for (var key in newValue) hasOwnProperty.call(newValue, key) && (veryOldValue[key] = newValue[key]);
                        } else veryOldValue = newValue;
                    }
                    $watchCollectionInterceptor.$stateful = !0;
                    var newValue, oldValue, veryOldValue, self = this, trackVeryOldValue = listener.length > 1, changeDetected = 0, changeDetector = $parse(obj, $watchCollectionInterceptor), internalArray = [], internalObject = {}, initRun = !0, oldLength = 0;
                    return this.$watch(changeDetector, $watchCollectionAction);
                },
                $digest: function() {
                    var watch, value, last, watchers, length, dirty, next, current, logIdx, asyncTask, ttl = TTL, target = this, watchLog = [];
                    beginPhase("$digest"), $browser.$$checkUrlChange(), this === $rootScope && null !== applyAsyncId && ($browser.defer.cancel(applyAsyncId), 
                    flushApplyAsync()), lastDirtyWatch = null;
                    do {
                        for (dirty = !1, current = target; asyncQueue.length; ) {
                            try {
                                asyncTask = asyncQueue.shift(), asyncTask.scope.$eval(asyncTask.expression, asyncTask.locals);
                            } catch (e) {
                                $exceptionHandler(e);
                            }
                            lastDirtyWatch = null;
                        }
                        traverseScopesLoop: do {
                            if (watchers = current.$$watchers) for (length = watchers.length; length--; ) try {
                                if (watch = watchers[length]) if ((value = watch.get(current)) === (last = watch.last) || (watch.eq ? equals(value, last) : "number" == typeof value && "number" == typeof last && isNaN(value) && isNaN(last))) {
                                    if (watch === lastDirtyWatch) {
                                        dirty = !1;
                                        break traverseScopesLoop;
                                    }
                                } else dirty = !0, lastDirtyWatch = watch, watch.last = watch.eq ? copy(value, null) : value, 
                                watch.fn(value, last === initWatchVal ? value : last, current), 5 > ttl && (logIdx = 4 - ttl, 
                                watchLog[logIdx] || (watchLog[logIdx] = []), watchLog[logIdx].push({
                                    msg: isFunction(watch.exp) ? "fn: " + (watch.exp.name || watch.exp.toString()) : watch.exp,
                                    newVal: value,
                                    oldVal: last
                                }));
                            } catch (e) {
                                $exceptionHandler(e);
                            }
                            if (!(next = current.$$watchersCount && current.$$childHead || current !== target && current.$$nextSibling)) for (;current !== target && !(next = current.$$nextSibling); ) current = current.$parent;
                        } while (current = next);
                        if ((dirty || asyncQueue.length) && !ttl--) throw clearPhase(), $rootScopeMinErr("infdig", "{0} $digest() iterations reached. Aborting!\nWatchers fired in the last 5 iterations: {1}", TTL, watchLog);
                    } while (dirty || asyncQueue.length);
                    for (clearPhase(); postDigestQueue.length; ) try {
                        postDigestQueue.shift()();
                    } catch (e) {
                        $exceptionHandler(e);
                    }
                },
                $destroy: function() {
                    if (!this.$$destroyed) {
                        var parent = this.$parent;
                        this.$broadcast("$destroy"), this.$$destroyed = !0, this === $rootScope && $browser.$$applicationDestroyed(), 
                        incrementWatchersCount(this, -this.$$watchersCount);
                        for (var eventName in this.$$listenerCount) decrementListenerCount(this, this.$$listenerCount[eventName], eventName);
                        parent && parent.$$childHead == this && (parent.$$childHead = this.$$nextSibling), 
                        parent && parent.$$childTail == this && (parent.$$childTail = this.$$prevSibling), 
                        this.$$prevSibling && (this.$$prevSibling.$$nextSibling = this.$$nextSibling), this.$$nextSibling && (this.$$nextSibling.$$prevSibling = this.$$prevSibling), 
                        this.$destroy = this.$digest = this.$apply = this.$evalAsync = this.$applyAsync = noop, 
                        this.$on = this.$watch = this.$watchGroup = function() {
                            return noop;
                        }, this.$$listeners = {}, this.$parent = this.$$nextSibling = this.$$prevSibling = this.$$childHead = this.$$childTail = this.$root = this.$$watchers = null;
                    }
                },
                $eval: function(expr, locals) {
                    return $parse(expr)(this, locals);
                },
                $evalAsync: function(expr, locals) {
                    $rootScope.$$phase || asyncQueue.length || $browser.defer(function() {
                        asyncQueue.length && $rootScope.$digest();
                    }), asyncQueue.push({
                        scope: this,
                        expression: expr,
                        locals: locals
                    });
                },
                $$postDigest: function(fn) {
                    postDigestQueue.push(fn);
                },
                $apply: function(expr) {
                    try {
                        return beginPhase("$apply"), this.$eval(expr);
                    } catch (e) {
                        $exceptionHandler(e);
                    } finally {
                        clearPhase();
                        try {
                            $rootScope.$digest();
                        } catch (e) {
                            throw $exceptionHandler(e), e;
                        }
                    }
                },
                $applyAsync: function(expr) {
                    function $applyAsyncExpression() {
                        scope.$eval(expr);
                    }
                    var scope = this;
                    expr && applyAsyncQueue.push($applyAsyncExpression), scheduleApplyAsync();
                },
                $on: function(name, listener) {
                    var namedListeners = this.$$listeners[name];
                    namedListeners || (this.$$listeners[name] = namedListeners = []), namedListeners.push(listener);
                    var current = this;
                    do current.$$listenerCount[name] || (current.$$listenerCount[name] = 0), current.$$listenerCount[name]++; while (current = current.$parent);
                    var self = this;
                    return function() {
                        var indexOfListener = namedListeners.indexOf(listener);
                        -1 !== indexOfListener && (namedListeners[indexOfListener] = null, decrementListenerCount(self, 1, name));
                    };
                },
                $emit: function(name, args) {
                    var namedListeners, i, length, empty = [], scope = this, stopPropagation = !1, event = {
                        name: name,
                        targetScope: scope,
                        stopPropagation: function() {
                            stopPropagation = !0;
                        },
                        preventDefault: function() {
                            event.defaultPrevented = !0;
                        },
                        defaultPrevented: !1
                    }, listenerArgs = concat([ event ], arguments, 1);
                    do {
                        for (namedListeners = scope.$$listeners[name] || empty, event.currentScope = scope, 
                        i = 0, length = namedListeners.length; length > i; i++) if (namedListeners[i]) try {
                            namedListeners[i].apply(null, listenerArgs);
                        } catch (e) {
                            $exceptionHandler(e);
                        } else namedListeners.splice(i, 1), i--, length--;
                        if (stopPropagation) return event.currentScope = null, event;
                        scope = scope.$parent;
                    } while (scope);
                    return event.currentScope = null, event;
                },
                $broadcast: function(name, args) {
                    var target = this, current = target, next = target, event = {
                        name: name,
                        targetScope: target,
                        preventDefault: function() {
                            event.defaultPrevented = !0;
                        },
                        defaultPrevented: !1
                    };
                    if (!target.$$listenerCount[name]) return event;
                    for (var listeners, i, length, listenerArgs = concat([ event ], arguments, 1); current = next; ) {
                        for (event.currentScope = current, listeners = current.$$listeners[name] || [], 
                        i = 0, length = listeners.length; length > i; i++) if (listeners[i]) try {
                            listeners[i].apply(null, listenerArgs);
                        } catch (e) {
                            $exceptionHandler(e);
                        } else listeners.splice(i, 1), i--, length--;
                        if (!(next = current.$$listenerCount[name] && current.$$childHead || current !== target && current.$$nextSibling)) for (;current !== target && !(next = current.$$nextSibling); ) current = current.$parent;
                    }
                    return event.currentScope = null, event;
                }
            };
            var $rootScope = new Scope(), asyncQueue = $rootScope.$$asyncQueue = [], postDigestQueue = $rootScope.$$postDigestQueue = [], applyAsyncQueue = $rootScope.$$applyAsyncQueue = [];
            return $rootScope;
        } ];
    }
    function $$SanitizeUriProvider() {
        var aHrefSanitizationWhitelist = /^\s*(https?|ftp|mailto|tel|file):/, imgSrcSanitizationWhitelist = /^\s*((https?|ftp|file|blob):|data:image\/)/;
        this.aHrefSanitizationWhitelist = function(regexp) {
            return isDefined(regexp) ? (aHrefSanitizationWhitelist = regexp, this) : aHrefSanitizationWhitelist;
        }, this.imgSrcSanitizationWhitelist = function(regexp) {
            return isDefined(regexp) ? (imgSrcSanitizationWhitelist = regexp, this) : imgSrcSanitizationWhitelist;
        }, this.$get = function() {
            return function(uri, isImage) {
                var normalizedVal, regex = isImage ? imgSrcSanitizationWhitelist : aHrefSanitizationWhitelist;
                return normalizedVal = urlResolve(uri).href, "" === normalizedVal || normalizedVal.match(regex) ? uri : "unsafe:" + normalizedVal;
            };
        };
    }
    function adjustMatcher(matcher) {
        if ("self" === matcher) return matcher;
        if (isString(matcher)) {
            if (matcher.indexOf("***") > -1) throw $sceMinErr("iwcard", "Illegal sequence *** in string matcher.  String: {0}", matcher);
            return matcher = escapeForRegexp(matcher).replace("\\*\\*", ".*").replace("\\*", "[^:/.?&;]*"), 
            new RegExp("^" + matcher + "$");
        }
        if (isRegExp(matcher)) return new RegExp("^" + matcher.source + "$");
        throw $sceMinErr("imatcher", 'Matchers may only be "self", string patterns or RegExp objects');
    }
    function adjustMatchers(matchers) {
        var adjustedMatchers = [];
        return isDefined(matchers) && forEach(matchers, function(matcher) {
            adjustedMatchers.push(adjustMatcher(matcher));
        }), adjustedMatchers;
    }
    function $SceDelegateProvider() {
        this.SCE_CONTEXTS = SCE_CONTEXTS;
        var resourceUrlWhitelist = [ "self" ], resourceUrlBlacklist = [];
        this.resourceUrlWhitelist = function(value) {
            return arguments.length && (resourceUrlWhitelist = adjustMatchers(value)), resourceUrlWhitelist;
        }, this.resourceUrlBlacklist = function(value) {
            return arguments.length && (resourceUrlBlacklist = adjustMatchers(value)), resourceUrlBlacklist;
        }, this.$get = [ "$injector", function($injector) {
            function matchUrl(matcher, parsedUrl) {
                return "self" === matcher ? urlIsSameOrigin(parsedUrl) : !!matcher.exec(parsedUrl.href);
            }
            function isResourceUrlAllowedByPolicy(url) {
                var i, n, parsedUrl = urlResolve(url.toString()), allowed = !1;
                for (i = 0, n = resourceUrlWhitelist.length; n > i; i++) if (matchUrl(resourceUrlWhitelist[i], parsedUrl)) {
                    allowed = !0;
                    break;
                }
                if (allowed) for (i = 0, n = resourceUrlBlacklist.length; n > i; i++) if (matchUrl(resourceUrlBlacklist[i], parsedUrl)) {
                    allowed = !1;
                    break;
                }
                return allowed;
            }
            function generateHolderType(Base) {
                var holderType = function(trustedValue) {
                    this.$$unwrapTrustedValue = function() {
                        return trustedValue;
                    };
                };
                return Base && (holderType.prototype = new Base()), holderType.prototype.valueOf = function() {
                    return this.$$unwrapTrustedValue();
                }, holderType.prototype.toString = function() {
                    return this.$$unwrapTrustedValue().toString();
                }, holderType;
            }
            function trustAs(type, trustedValue) {
                var Constructor = byType.hasOwnProperty(type) ? byType[type] : null;
                if (!Constructor) throw $sceMinErr("icontext", "Attempted to trust a value in invalid context. Context: {0}; Value: {1}", type, trustedValue);
                if (null === trustedValue || trustedValue === undefined || "" === trustedValue) return trustedValue;
                if ("string" != typeof trustedValue) throw $sceMinErr("itype", "Attempted to trust a non-string value in a content requiring a string: Context: {0}", type);
                return new Constructor(trustedValue);
            }
            function valueOf(maybeTrusted) {
                return maybeTrusted instanceof trustedValueHolderBase ? maybeTrusted.$$unwrapTrustedValue() : maybeTrusted;
            }
            function getTrusted(type, maybeTrusted) {
                if (null === maybeTrusted || maybeTrusted === undefined || "" === maybeTrusted) return maybeTrusted;
                var constructor = byType.hasOwnProperty(type) ? byType[type] : null;
                if (constructor && maybeTrusted instanceof constructor) return maybeTrusted.$$unwrapTrustedValue();
                if (type === SCE_CONTEXTS.RESOURCE_URL) {
                    if (isResourceUrlAllowedByPolicy(maybeTrusted)) return maybeTrusted;
                    throw $sceMinErr("insecurl", "Blocked loading resource from url not allowed by $sceDelegate policy.  URL: {0}", maybeTrusted.toString());
                }
                if (type === SCE_CONTEXTS.HTML) return htmlSanitizer(maybeTrusted);
                throw $sceMinErr("unsafe", "Attempting to use an unsafe value in a safe context.");
            }
            var htmlSanitizer = function(html) {
                throw $sceMinErr("unsafe", "Attempting to use an unsafe value in a safe context.");
            };
            $injector.has("$sanitize") && (htmlSanitizer = $injector.get("$sanitize"));
            var trustedValueHolderBase = generateHolderType(), byType = {};
            return byType[SCE_CONTEXTS.HTML] = generateHolderType(trustedValueHolderBase), byType[SCE_CONTEXTS.CSS] = generateHolderType(trustedValueHolderBase), 
            byType[SCE_CONTEXTS.URL] = generateHolderType(trustedValueHolderBase), byType[SCE_CONTEXTS.JS] = generateHolderType(trustedValueHolderBase), 
            byType[SCE_CONTEXTS.RESOURCE_URL] = generateHolderType(byType[SCE_CONTEXTS.URL]), 
            {
                trustAs: trustAs,
                getTrusted: getTrusted,
                valueOf: valueOf
            };
        } ];
    }
    function $SceProvider() {
        var enabled = !0;
        this.enabled = function(value) {
            return arguments.length && (enabled = !!value), enabled;
        }, this.$get = [ "$parse", "$sceDelegate", function($parse, $sceDelegate) {
            if (enabled && 8 > msie) throw $sceMinErr("iequirks", "Strict Contextual Escaping does not support Internet Explorer version < 11 in quirks mode.  You can fix this by adding the text <!doctype html> to the top of your HTML document.  See http://docs.angularjs.org/api/ng.$sce for more information.");
            var sce = shallowCopy(SCE_CONTEXTS);
            sce.isEnabled = function() {
                return enabled;
            }, sce.trustAs = $sceDelegate.trustAs, sce.getTrusted = $sceDelegate.getTrusted, 
            sce.valueOf = $sceDelegate.valueOf, enabled || (sce.trustAs = sce.getTrusted = function(type, value) {
                return value;
            }, sce.valueOf = identity), sce.parseAs = function(type, expr) {
                var parsed = $parse(expr);
                return parsed.literal && parsed.constant ? parsed : $parse(expr, function(value) {
                    return sce.getTrusted(type, value);
                });
            };
            var parse = sce.parseAs, getTrusted = sce.getTrusted, trustAs = sce.trustAs;
            return forEach(SCE_CONTEXTS, function(enumValue, name) {
                var lName = lowercase(name);
                sce[camelCase("parse_as_" + lName)] = function(expr) {
                    return parse(enumValue, expr);
                }, sce[camelCase("get_trusted_" + lName)] = function(value) {
                    return getTrusted(enumValue, value);
                }, sce[camelCase("trust_as_" + lName)] = function(value) {
                    return trustAs(enumValue, value);
                };
            }), sce;
        } ];
    }
    function $SnifferProvider() {
        this.$get = [ "$window", "$document", function($window, $document) {
            var vendorPrefix, match, eventSupport = {}, android = toInt((/android (\d+)/.exec(lowercase(($window.navigator || {}).userAgent)) || [])[1]), boxee = /Boxee/i.test(($window.navigator || {}).userAgent), document = $document[0] || {}, vendorRegex = /^(Moz|webkit|ms)(?=[A-Z])/, bodyStyle = document.body && document.body.style, transitions = !1, animations = !1;
            if (bodyStyle) {
                for (var prop in bodyStyle) if (match = vendorRegex.exec(prop)) {
                    vendorPrefix = match[0], vendorPrefix = vendorPrefix.substr(0, 1).toUpperCase() + vendorPrefix.substr(1);
                    break;
                }
                vendorPrefix || (vendorPrefix = "WebkitOpacity" in bodyStyle && "webkit"), transitions = !!("transition" in bodyStyle || vendorPrefix + "Transition" in bodyStyle), 
                animations = !!("animation" in bodyStyle || vendorPrefix + "Animation" in bodyStyle), 
                !android || transitions && animations || (transitions = isString(bodyStyle.webkitTransition), 
                animations = isString(bodyStyle.webkitAnimation));
            }
            return {
                history: !(!$window.history || !$window.history.pushState || 4 > android || boxee),
                hasEvent: function(event) {
                    if ("input" === event && 11 >= msie) return !1;
                    if (isUndefined(eventSupport[event])) {
                        var divElm = document.createElement("div");
                        eventSupport[event] = "on" + event in divElm;
                    }
                    return eventSupport[event];
                },
                csp: csp(),
                vendorPrefix: vendorPrefix,
                transitions: transitions,
                animations: animations,
                android: android
            };
        } ];
    }
    function $TemplateRequestProvider() {
        this.$get = [ "$templateCache", "$http", "$q", function($templateCache, $http, $q) {
            function handleRequestFn(tpl, ignoreRequestError) {
                function handleError(resp) {
                    if (!ignoreRequestError) throw $compileMinErr("tpload", "Failed to load template: {0} (HTTP status: {1} {2})", tpl, resp.status, resp.statusText);
                    return $q.reject(resp);
                }
                handleRequestFn.totalPendingRequests++;
                var transformResponse = $http.defaults && $http.defaults.transformResponse;
                isArray(transformResponse) ? transformResponse = transformResponse.filter(function(transformer) {
                    return transformer !== defaultHttpResponseTransform;
                }) : transformResponse === defaultHttpResponseTransform && (transformResponse = null);
                var httpOptions = {
                    cache: $templateCache,
                    transformResponse: transformResponse
                };
                return $http.get(tpl, httpOptions)["finally"](function() {
                    handleRequestFn.totalPendingRequests--;
                }).then(function(response) {
                    return $templateCache.put(tpl, response.data), response.data;
                }, handleError);
            }
            return handleRequestFn.totalPendingRequests = 0, handleRequestFn;
        } ];
    }
    function $$TestabilityProvider() {
        this.$get = [ "$rootScope", "$browser", "$location", function($rootScope, $browser, $location) {
            var testability = {};
            return testability.findBindings = function(element, expression, opt_exactMatch) {
                var bindings = element.getElementsByClassName("ng-binding"), matches = [];
                return forEach(bindings, function(binding) {
                    var dataBinding = angular.element(binding).data("$binding");
                    dataBinding && forEach(dataBinding, function(bindingName) {
                        if (opt_exactMatch) {
                            var matcher = new RegExp("(^|\\s)" + escapeForRegexp(expression) + "(\\s|\\||$)");
                            matcher.test(bindingName) && matches.push(binding);
                        } else -1 != bindingName.indexOf(expression) && matches.push(binding);
                    });
                }), matches;
            }, testability.findModels = function(element, expression, opt_exactMatch) {
                for (var prefixes = [ "ng-", "data-ng-", "ng\\:" ], p = 0; p < prefixes.length; ++p) {
                    var attributeEquals = opt_exactMatch ? "=" : "*=", selector = "[" + prefixes[p] + "model" + attributeEquals + '"' + expression + '"]', elements = element.querySelectorAll(selector);
                    if (elements.length) return elements;
                }
            }, testability.getLocation = function() {
                return $location.url();
            }, testability.setLocation = function(url) {
                url !== $location.url() && ($location.url(url), $rootScope.$digest());
            }, testability.whenStable = function(callback) {
                $browser.notifyWhenNoOutstandingRequests(callback);
            }, testability;
        } ];
    }
    function $TimeoutProvider() {
        this.$get = [ "$rootScope", "$browser", "$q", "$$q", "$exceptionHandler", function($rootScope, $browser, $q, $$q, $exceptionHandler) {
            function timeout(fn, delay, invokeApply) {
                isFunction(fn) || (invokeApply = delay, delay = fn, fn = noop);
                var timeoutId, args = sliceArgs(arguments, 3), skipApply = isDefined(invokeApply) && !invokeApply, deferred = (skipApply ? $$q : $q).defer(), promise = deferred.promise;
                return timeoutId = $browser.defer(function() {
                    try {
                        deferred.resolve(fn.apply(null, args));
                    } catch (e) {
                        deferred.reject(e), $exceptionHandler(e);
                    } finally {
                        delete deferreds[promise.$$timeoutId];
                    }
                    skipApply || $rootScope.$apply();
                }, delay), promise.$$timeoutId = timeoutId, deferreds[timeoutId] = deferred, promise;
            }
            var deferreds = {};
            return timeout.cancel = function(promise) {
                return promise && promise.$$timeoutId in deferreds ? (deferreds[promise.$$timeoutId].reject("canceled"), 
                delete deferreds[promise.$$timeoutId], $browser.defer.cancel(promise.$$timeoutId)) : !1;
            }, timeout;
        } ];
    }
    function urlResolve(url) {
        var href = url;
        return msie && (urlParsingNode.setAttribute("href", href), href = urlParsingNode.href), 
        urlParsingNode.setAttribute("href", href), {
            href: urlParsingNode.href,
            protocol: urlParsingNode.protocol ? urlParsingNode.protocol.replace(/:$/, "") : "",
            host: urlParsingNode.host,
            search: urlParsingNode.search ? urlParsingNode.search.replace(/^\?/, "") : "",
            hash: urlParsingNode.hash ? urlParsingNode.hash.replace(/^#/, "") : "",
            hostname: urlParsingNode.hostname,
            port: urlParsingNode.port,
            pathname: "/" === urlParsingNode.pathname.charAt(0) ? urlParsingNode.pathname : "/" + urlParsingNode.pathname
        };
    }
    function urlIsSameOrigin(requestUrl) {
        var parsed = isString(requestUrl) ? urlResolve(requestUrl) : requestUrl;
        return parsed.protocol === originUrl.protocol && parsed.host === originUrl.host;
    }
    function $WindowProvider() {
        this.$get = valueFn(window);
    }
    function $$CookieReader($document) {
        function safeDecodeURIComponent(str) {
            try {
                return decodeURIComponent(str);
            } catch (e) {
                return str;
            }
        }
        var rawDocument = $document[0] || {}, lastCookies = {}, lastCookieString = "";
        return function() {
            var cookieArray, cookie, i, index, name, currentCookieString = rawDocument.cookie || "";
            if (currentCookieString !== lastCookieString) for (lastCookieString = currentCookieString, 
            cookieArray = lastCookieString.split("; "), lastCookies = {}, i = 0; i < cookieArray.length; i++) cookie = cookieArray[i], 
            index = cookie.indexOf("="), index > 0 && (name = safeDecodeURIComponent(cookie.substring(0, index)), 
            lastCookies[name] === undefined && (lastCookies[name] = safeDecodeURIComponent(cookie.substring(index + 1))));
            return lastCookies;
        };
    }
    function $$CookieReaderProvider() {
        this.$get = $$CookieReader;
    }
    function $FilterProvider($provide) {
        function register(name, factory) {
            if (isObject(name)) {
                var filters = {};
                return forEach(name, function(filter, key) {
                    filters[key] = register(key, filter);
                }), filters;
            }
            return $provide.factory(name + suffix, factory);
        }
        var suffix = "Filter";
        this.register = register, this.$get = [ "$injector", function($injector) {
            return function(name) {
                return $injector.get(name + suffix);
            };
        } ], register("currency", currencyFilter), register("date", dateFilter), register("filter", filterFilter), 
        register("json", jsonFilter), register("limitTo", limitToFilter), register("lowercase", lowercaseFilter), 
        register("number", numberFilter), register("orderBy", orderByFilter), register("uppercase", uppercaseFilter);
    }
    function filterFilter() {
        return function(array, expression, comparator) {
            if (!isArrayLike(array)) {
                if (null == array) return array;
                throw minErr("filter")("notarray", "Expected array but received: {0}", array);
            }
            var predicateFn, matchAgainstAnyProp, expressionType = getTypeForFilter(expression);
            switch (expressionType) {
              case "function":
                predicateFn = expression;
                break;

              case "boolean":
              case "null":
              case "number":
              case "string":
                matchAgainstAnyProp = !0;

              case "object":
                predicateFn = createPredicateFn(expression, comparator, matchAgainstAnyProp);
                break;

              default:
                return array;
            }
            return Array.prototype.filter.call(array, predicateFn);
        };
    }
    function hasCustomToString(obj) {
        return isFunction(obj.toString) && obj.toString !== Object.prototype.toString;
    }
    function createPredicateFn(expression, comparator, matchAgainstAnyProp) {
        var predicateFn, shouldMatchPrimitives = isObject(expression) && "$" in expression;
        return comparator === !0 ? comparator = equals : isFunction(comparator) || (comparator = function(actual, expected) {
            return isUndefined(actual) ? !1 : null === actual || null === expected ? actual === expected : isObject(expected) || isObject(actual) && !hasCustomToString(actual) ? !1 : (actual = lowercase("" + actual), 
            expected = lowercase("" + expected), -1 !== actual.indexOf(expected));
        }), predicateFn = function(item) {
            return shouldMatchPrimitives && !isObject(item) ? deepCompare(item, expression.$, comparator, !1) : deepCompare(item, expression, comparator, matchAgainstAnyProp);
        };
    }
    function deepCompare(actual, expected, comparator, matchAgainstAnyProp, dontMatchWholeObject) {
        var actualType = getTypeForFilter(actual), expectedType = getTypeForFilter(expected);
        if ("string" === expectedType && "!" === expected.charAt(0)) return !deepCompare(actual, expected.substring(1), comparator, matchAgainstAnyProp);
        if (isArray(actual)) return actual.some(function(item) {
            return deepCompare(item, expected, comparator, matchAgainstAnyProp);
        });
        switch (actualType) {
          case "object":
            var key;
            if (matchAgainstAnyProp) {
                for (key in actual) if ("$" !== key.charAt(0) && deepCompare(actual[key], expected, comparator, !0)) return !0;
                return dontMatchWholeObject ? !1 : deepCompare(actual, expected, comparator, !1);
            }
            if ("object" === expectedType) {
                for (key in expected) {
                    var expectedVal = expected[key];
                    if (!isFunction(expectedVal) && !isUndefined(expectedVal)) {
                        var matchAnyProperty = "$" === key, actualVal = matchAnyProperty ? actual : actual[key];
                        if (!deepCompare(actualVal, expectedVal, comparator, matchAnyProperty, matchAnyProperty)) return !1;
                    }
                }
                return !0;
            }
            return comparator(actual, expected);

          case "function":
            return !1;

          default:
            return comparator(actual, expected);
        }
    }
    function getTypeForFilter(val) {
        return null === val ? "null" : typeof val;
    }
    function currencyFilter($locale) {
        var formats = $locale.NUMBER_FORMATS;
        return function(amount, currencySymbol, fractionSize) {
            return isUndefined(currencySymbol) && (currencySymbol = formats.CURRENCY_SYM), isUndefined(fractionSize) && (fractionSize = formats.PATTERNS[1].maxFrac), 
            null == amount ? amount : formatNumber(amount, formats.PATTERNS[1], formats.GROUP_SEP, formats.DECIMAL_SEP, fractionSize).replace(/\u00A4/g, currencySymbol);
        };
    }
    function numberFilter($locale) {
        var formats = $locale.NUMBER_FORMATS;
        return function(number, fractionSize) {
            return null == number ? number : formatNumber(number, formats.PATTERNS[0], formats.GROUP_SEP, formats.DECIMAL_SEP, fractionSize);
        };
    }
    function formatNumber(number, pattern, groupSep, decimalSep, fractionSize) {
        if (isObject(number)) return "";
        var isNegative = 0 > number;
        number = Math.abs(number);
        var isInfinity = number === 1 / 0;
        if (!isInfinity && !isFinite(number)) return "";
        var numStr = number + "", formatedText = "", hasExponent = !1, parts = [];
        if (isInfinity && (formatedText = "∞"), !isInfinity && -1 !== numStr.indexOf("e")) {
            var match = numStr.match(/([\d\.]+)e(-?)(\d+)/);
            match && "-" == match[2] && match[3] > fractionSize + 1 ? number = 0 : (formatedText = numStr, 
            hasExponent = !0);
        }
        if (isInfinity || hasExponent) fractionSize > 0 && 1 > number && (formatedText = number.toFixed(fractionSize), 
        number = parseFloat(formatedText)); else {
            var fractionLen = (numStr.split(DECIMAL_SEP)[1] || "").length;
            isUndefined(fractionSize) && (fractionSize = Math.min(Math.max(pattern.minFrac, fractionLen), pattern.maxFrac)), 
            number = +(Math.round(+(number.toString() + "e" + fractionSize)).toString() + "e" + -fractionSize);
            var fraction = ("" + number).split(DECIMAL_SEP), whole = fraction[0];
            fraction = fraction[1] || "";
            var i, pos = 0, lgroup = pattern.lgSize, group = pattern.gSize;
            if (whole.length >= lgroup + group) for (pos = whole.length - lgroup, i = 0; pos > i; i++) (pos - i) % group === 0 && 0 !== i && (formatedText += groupSep), 
            formatedText += whole.charAt(i);
            for (i = pos; i < whole.length; i++) (whole.length - i) % lgroup === 0 && 0 !== i && (formatedText += groupSep), 
            formatedText += whole.charAt(i);
            for (;fraction.length < fractionSize; ) fraction += "0";
            fractionSize && "0" !== fractionSize && (formatedText += decimalSep + fraction.substr(0, fractionSize));
        }
        return 0 === number && (isNegative = !1), parts.push(isNegative ? pattern.negPre : pattern.posPre, formatedText, isNegative ? pattern.negSuf : pattern.posSuf), 
        parts.join("");
    }
    function padNumber(num, digits, trim) {
        var neg = "";
        for (0 > num && (neg = "-", num = -num), num = "" + num; num.length < digits; ) num = "0" + num;
        return trim && (num = num.substr(num.length - digits)), neg + num;
    }
    function dateGetter(name, size, offset, trim) {
        return offset = offset || 0, function(date) {
            var value = date["get" + name]();
            return (offset > 0 || value > -offset) && (value += offset), 0 === value && -12 == offset && (value = 12), 
            padNumber(value, size, trim);
        };
    }
    function dateStrGetter(name, shortForm) {
        return function(date, formats) {
            var value = date["get" + name](), get = uppercase(shortForm ? "SHORT" + name : name);
            return formats[get][value];
        };
    }
    function timeZoneGetter(date, formats, offset) {
        var zone = -1 * offset, paddedZone = zone >= 0 ? "+" : "";
        return paddedZone += padNumber(Math[zone > 0 ? "floor" : "ceil"](zone / 60), 2) + padNumber(Math.abs(zone % 60), 2);
    }
    function getFirstThursdayOfYear(year) {
        var dayOfWeekOnFirst = new Date(year, 0, 1).getDay();
        return new Date(year, 0, (4 >= dayOfWeekOnFirst ? 5 : 12) - dayOfWeekOnFirst);
    }
    function getThursdayThisWeek(datetime) {
        return new Date(datetime.getFullYear(), datetime.getMonth(), datetime.getDate() + (4 - datetime.getDay()));
    }
    function weekGetter(size) {
        return function(date) {
            var firstThurs = getFirstThursdayOfYear(date.getFullYear()), thisThurs = getThursdayThisWeek(date), diff = +thisThurs - +firstThurs, result = 1 + Math.round(diff / 6048e5);
            return padNumber(result, size);
        };
    }
    function ampmGetter(date, formats) {
        return date.getHours() < 12 ? formats.AMPMS[0] : formats.AMPMS[1];
    }
    function eraGetter(date, formats) {
        return date.getFullYear() <= 0 ? formats.ERAS[0] : formats.ERAS[1];
    }
    function longEraGetter(date, formats) {
        return date.getFullYear() <= 0 ? formats.ERANAMES[0] : formats.ERANAMES[1];
    }
    function dateFilter($locale) {
        function jsonStringToDate(string) {
            var match;
            if (match = string.match(R_ISO8601_STR)) {
                var date = new Date(0), tzHour = 0, tzMin = 0, dateSetter = match[8] ? date.setUTCFullYear : date.setFullYear, timeSetter = match[8] ? date.setUTCHours : date.setHours;
                match[9] && (tzHour = toInt(match[9] + match[10]), tzMin = toInt(match[9] + match[11])), 
                dateSetter.call(date, toInt(match[1]), toInt(match[2]) - 1, toInt(match[3]));
                var h = toInt(match[4] || 0) - tzHour, m = toInt(match[5] || 0) - tzMin, s = toInt(match[6] || 0), ms = Math.round(1e3 * parseFloat("0." + (match[7] || 0)));
                return timeSetter.call(date, h, m, s, ms), date;
            }
            return string;
        }
        var R_ISO8601_STR = /^(\d{4})-?(\d\d)-?(\d\d)(?:T(\d\d)(?::?(\d\d)(?::?(\d\d)(?:\.(\d+))?)?)?(Z|([+-])(\d\d):?(\d\d))?)?$/;
        return function(date, format, timezone) {
            var fn, match, text = "", parts = [];
            if (format = format || "mediumDate", format = $locale.DATETIME_FORMATS[format] || format, 
            isString(date) && (date = NUMBER_STRING.test(date) ? toInt(date) : jsonStringToDate(date)), 
            isNumber(date) && (date = new Date(date)), !isDate(date) || !isFinite(date.getTime())) return date;
            for (;format; ) match = DATE_FORMATS_SPLIT.exec(format), match ? (parts = concat(parts, match, 1), 
            format = parts.pop()) : (parts.push(format), format = null);
            var dateTimezoneOffset = date.getTimezoneOffset();
            return timezone && (dateTimezoneOffset = timezoneToOffset(timezone, date.getTimezoneOffset()), 
            date = convertTimezoneToLocal(date, timezone, !0)), forEach(parts, function(value) {
                fn = DATE_FORMATS[value], text += fn ? fn(date, $locale.DATETIME_FORMATS, dateTimezoneOffset) : value.replace(/(^'|'$)/g, "").replace(/''/g, "'");
            }), text;
        };
    }
    function jsonFilter() {
        return function(object, spacing) {
            return isUndefined(spacing) && (spacing = 2), toJson(object, spacing);
        };
    }
    function limitToFilter() {
        return function(input, limit, begin) {
            return limit = Math.abs(Number(limit)) === 1 / 0 ? Number(limit) : toInt(limit), 
            isNaN(limit) ? input : (isNumber(input) && (input = input.toString()), isArray(input) || isString(input) ? (begin = !begin || isNaN(begin) ? 0 : toInt(begin), 
            begin = 0 > begin && begin >= -input.length ? input.length + begin : begin, limit >= 0 ? input.slice(begin, begin + limit) : 0 === begin ? input.slice(limit, input.length) : input.slice(Math.max(0, begin + limit), begin)) : input);
        };
    }
    function orderByFilter($parse) {
        return function(array, sortPredicate, reverseOrder) {
            function comparator(o1, o2) {
                for (var i = 0; i < sortPredicate.length; i++) {
                    var comp = sortPredicate[i](o1, o2);
                    if (0 !== comp) return comp;
                }
                return 0;
            }
            function reverseComparator(comp, descending) {
                return descending ? function(a, b) {
                    return comp(b, a);
                } : comp;
            }
            function isPrimitive(value) {
                switch (typeof value) {
                  case "number":
                  case "boolean":
                  case "string":
                    return !0;

                  default:
                    return !1;
                }
            }
            function objectToString(value) {
                return null === value ? "null" : "function" == typeof value.valueOf && (value = value.valueOf(), 
                isPrimitive(value)) ? value : "function" == typeof value.toString && (value = value.toString(), 
                isPrimitive(value)) ? value : "";
            }
            function compare(v1, v2) {
                var t1 = typeof v1, t2 = typeof v2;
                return t1 === t2 && "object" === t1 && (v1 = objectToString(v1), v2 = objectToString(v2)), 
                t1 === t2 ? ("string" === t1 && (v1 = v1.toLowerCase(), v2 = v2.toLowerCase()), 
                v1 === v2 ? 0 : v2 > v1 ? -1 : 1) : t2 > t1 ? -1 : 1;
            }
            return isArrayLike(array) ? (sortPredicate = isArray(sortPredicate) ? sortPredicate : [ sortPredicate ], 
            0 === sortPredicate.length && (sortPredicate = [ "+" ]), sortPredicate = sortPredicate.map(function(predicate) {
                var descending = !1, get = predicate || identity;
                if (isString(predicate)) {
                    if (("+" == predicate.charAt(0) || "-" == predicate.charAt(0)) && (descending = "-" == predicate.charAt(0), 
                    predicate = predicate.substring(1)), "" === predicate) return reverseComparator(compare, descending);
                    if (get = $parse(predicate), get.constant) {
                        var key = get();
                        return reverseComparator(function(a, b) {
                            return compare(a[key], b[key]);
                        }, descending);
                    }
                }
                return reverseComparator(function(a, b) {
                    return compare(get(a), get(b));
                }, descending);
            }), slice.call(array).sort(reverseComparator(comparator, reverseOrder))) : array;
        };
    }
    function ngDirective(directive) {
        return isFunction(directive) && (directive = {
            link: directive
        }), directive.restrict = directive.restrict || "AC", valueFn(directive);
    }
    function nullFormRenameControl(control, name) {
        control.$name = name;
    }
    function FormController(element, attrs, $scope, $animate, $interpolate) {
        var form = this, controls = [], parentForm = form.$$parentForm = element.parent().controller("form") || nullFormCtrl;
        form.$error = {}, form.$$success = {}, form.$pending = undefined, form.$name = $interpolate(attrs.name || attrs.ngForm || "")($scope), 
        form.$dirty = !1, form.$pristine = !0, form.$valid = !0, form.$invalid = !1, form.$submitted = !1, 
        parentForm.$addControl(form), form.$rollbackViewValue = function() {
            forEach(controls, function(control) {
                control.$rollbackViewValue();
            });
        }, form.$commitViewValue = function() {
            forEach(controls, function(control) {
                control.$commitViewValue();
            });
        }, form.$addControl = function(control) {
            assertNotHasOwnProperty(control.$name, "input"), controls.push(control), control.$name && (form[control.$name] = control);
        }, form.$$renameControl = function(control, newName) {
            var oldName = control.$name;
            form[oldName] === control && delete form[oldName], form[newName] = control, control.$name = newName;
        }, form.$removeControl = function(control) {
            control.$name && form[control.$name] === control && delete form[control.$name], 
            forEach(form.$pending, function(value, name) {
                form.$setValidity(name, null, control);
            }), forEach(form.$error, function(value, name) {
                form.$setValidity(name, null, control);
            }), forEach(form.$$success, function(value, name) {
                form.$setValidity(name, null, control);
            }), arrayRemove(controls, control);
        }, addSetValidityMethod({
            ctrl: this,
            $element: element,
            set: function(object, property, controller) {
                var list = object[property];
                if (list) {
                    var index = list.indexOf(controller);
                    -1 === index && list.push(controller);
                } else object[property] = [ controller ];
            },
            unset: function(object, property, controller) {
                var list = object[property];
                list && (arrayRemove(list, controller), 0 === list.length && delete object[property]);
            },
            parentForm: parentForm,
            $animate: $animate
        }), form.$setDirty = function() {
            $animate.removeClass(element, PRISTINE_CLASS), $animate.addClass(element, DIRTY_CLASS), 
            form.$dirty = !0, form.$pristine = !1, parentForm.$setDirty();
        }, form.$setPristine = function() {
            $animate.setClass(element, PRISTINE_CLASS, DIRTY_CLASS + " " + SUBMITTED_CLASS), 
            form.$dirty = !1, form.$pristine = !0, form.$submitted = !1, forEach(controls, function(control) {
                control.$setPristine();
            });
        }, form.$setUntouched = function() {
            forEach(controls, function(control) {
                control.$setUntouched();
            });
        }, form.$setSubmitted = function() {
            $animate.addClass(element, SUBMITTED_CLASS), form.$submitted = !0, parentForm.$setSubmitted();
        };
    }
    function stringBasedInputType(ctrl) {
        ctrl.$formatters.push(function(value) {
            return ctrl.$isEmpty(value) ? value : value.toString();
        });
    }
    function textInputType(scope, element, attr, ctrl, $sniffer, $browser) {
        baseInputType(scope, element, attr, ctrl, $sniffer, $browser), stringBasedInputType(ctrl);
    }
    function baseInputType(scope, element, attr, ctrl, $sniffer, $browser) {
        var type = lowercase(element[0].type);
        if (!$sniffer.android) {
            var composing = !1;
            element.on("compositionstart", function(data) {
                composing = !0;
            }), element.on("compositionend", function() {
                composing = !1, listener();
            });
        }
        var listener = function(ev) {
            if (timeout && ($browser.defer.cancel(timeout), timeout = null), !composing) {
                var value = element.val(), event = ev && ev.type;
                "password" === type || attr.ngTrim && "false" === attr.ngTrim || (value = trim(value)), 
                (ctrl.$viewValue !== value || "" === value && ctrl.$$hasNativeValidators) && ctrl.$setViewValue(value, event);
            }
        };
        if ($sniffer.hasEvent("input")) element.on("input", listener); else {
            var timeout, deferListener = function(ev, input, origValue) {
                timeout || (timeout = $browser.defer(function() {
                    timeout = null, input && input.value === origValue || listener(ev);
                }));
            };
            element.on("keydown", function(event) {
                var key = event.keyCode;
                91 === key || key > 15 && 19 > key || key >= 37 && 40 >= key || deferListener(event, this, this.value);
            }), $sniffer.hasEvent("paste") && element.on("paste cut", deferListener);
        }
        element.on("change", listener), ctrl.$render = function() {
            element.val(ctrl.$isEmpty(ctrl.$viewValue) ? "" : ctrl.$viewValue);
        };
    }
    function weekParser(isoWeek, existingDate) {
        if (isDate(isoWeek)) return isoWeek;
        if (isString(isoWeek)) {
            WEEK_REGEXP.lastIndex = 0;
            var parts = WEEK_REGEXP.exec(isoWeek);
            if (parts) {
                var year = +parts[1], week = +parts[2], hours = 0, minutes = 0, seconds = 0, milliseconds = 0, firstThurs = getFirstThursdayOfYear(year), addDays = 7 * (week - 1);
                return existingDate && (hours = existingDate.getHours(), minutes = existingDate.getMinutes(), 
                seconds = existingDate.getSeconds(), milliseconds = existingDate.getMilliseconds()), 
                new Date(year, 0, firstThurs.getDate() + addDays, hours, minutes, seconds, milliseconds);
            }
        }
        return NaN;
    }
    function createDateParser(regexp, mapping) {
        return function(iso, date) {
            var parts, map;
            if (isDate(iso)) return iso;
            if (isString(iso)) {
                if ('"' == iso.charAt(0) && '"' == iso.charAt(iso.length - 1) && (iso = iso.substring(1, iso.length - 1)), 
                ISO_DATE_REGEXP.test(iso)) return new Date(iso);
                if (regexp.lastIndex = 0, parts = regexp.exec(iso)) return parts.shift(), map = date ? {
                    yyyy: date.getFullYear(),
                    MM: date.getMonth() + 1,
                    dd: date.getDate(),
                    HH: date.getHours(),
                    mm: date.getMinutes(),
                    ss: date.getSeconds(),
                    sss: date.getMilliseconds() / 1e3
                } : {
                    yyyy: 1970,
                    MM: 1,
                    dd: 1,
                    HH: 0,
                    mm: 0,
                    ss: 0,
                    sss: 0
                }, forEach(parts, function(part, index) {
                    index < mapping.length && (map[mapping[index]] = +part);
                }), new Date(map.yyyy, map.MM - 1, map.dd, map.HH, map.mm, map.ss || 0, 1e3 * map.sss || 0);
            }
            return NaN;
        };
    }
    function createDateInputType(type, regexp, parseDate, format) {
        return function(scope, element, attr, ctrl, $sniffer, $browser, $filter) {
            function isValidDate(value) {
                return value && !(value.getTime && value.getTime() !== value.getTime());
            }
            function parseObservedDateValue(val) {
                return isDefined(val) ? isDate(val) ? val : parseDate(val) : undefined;
            }
            badInputChecker(scope, element, attr, ctrl), baseInputType(scope, element, attr, ctrl, $sniffer, $browser);
            var previousDate, timezone = ctrl && ctrl.$options && ctrl.$options.timezone;
            if (ctrl.$$parserName = type, ctrl.$parsers.push(function(value) {
                if (ctrl.$isEmpty(value)) return null;
                if (regexp.test(value)) {
                    var parsedDate = parseDate(value, previousDate);
                    return timezone && (parsedDate = convertTimezoneToLocal(parsedDate, timezone)), 
                    parsedDate;
                }
                return undefined;
            }), ctrl.$formatters.push(function(value) {
                if (value && !isDate(value)) throw $ngModelMinErr("datefmt", "Expected `{0}` to be a date", value);
                return isValidDate(value) ? (previousDate = value, previousDate && timezone && (previousDate = convertTimezoneToLocal(previousDate, timezone, !0)), 
                $filter("date")(value, format, timezone)) : (previousDate = null, "");
            }), isDefined(attr.min) || attr.ngMin) {
                var minVal;
                ctrl.$validators.min = function(value) {
                    return !isValidDate(value) || isUndefined(minVal) || parseDate(value) >= minVal;
                }, attr.$observe("min", function(val) {
                    minVal = parseObservedDateValue(val), ctrl.$validate();
                });
            }
            if (isDefined(attr.max) || attr.ngMax) {
                var maxVal;
                ctrl.$validators.max = function(value) {
                    return !isValidDate(value) || isUndefined(maxVal) || parseDate(value) <= maxVal;
                }, attr.$observe("max", function(val) {
                    maxVal = parseObservedDateValue(val), ctrl.$validate();
                });
            }
        };
    }
    function badInputChecker(scope, element, attr, ctrl) {
        var node = element[0], nativeValidation = ctrl.$$hasNativeValidators = isObject(node.validity);
        nativeValidation && ctrl.$parsers.push(function(value) {
            var validity = element.prop(VALIDITY_STATE_PROPERTY) || {};
            return validity.badInput && !validity.typeMismatch ? undefined : value;
        });
    }
    function numberInputType(scope, element, attr, ctrl, $sniffer, $browser) {
        if (badInputChecker(scope, element, attr, ctrl), baseInputType(scope, element, attr, ctrl, $sniffer, $browser), 
        ctrl.$$parserName = "number", ctrl.$parsers.push(function(value) {
            return ctrl.$isEmpty(value) ? null : NUMBER_REGEXP.test(value) ? parseFloat(value) : undefined;
        }), ctrl.$formatters.push(function(value) {
            if (!ctrl.$isEmpty(value)) {
                if (!isNumber(value)) throw $ngModelMinErr("numfmt", "Expected `{0}` to be a number", value);
                value = value.toString();
            }
            return value;
        }), isDefined(attr.min) || attr.ngMin) {
            var minVal;
            ctrl.$validators.min = function(value) {
                return ctrl.$isEmpty(value) || isUndefined(minVal) || value >= minVal;
            }, attr.$observe("min", function(val) {
                isDefined(val) && !isNumber(val) && (val = parseFloat(val, 10)), minVal = isNumber(val) && !isNaN(val) ? val : undefined, 
                ctrl.$validate();
            });
        }
        if (isDefined(attr.max) || attr.ngMax) {
            var maxVal;
            ctrl.$validators.max = function(value) {
                return ctrl.$isEmpty(value) || isUndefined(maxVal) || maxVal >= value;
            }, attr.$observe("max", function(val) {
                isDefined(val) && !isNumber(val) && (val = parseFloat(val, 10)), maxVal = isNumber(val) && !isNaN(val) ? val : undefined, 
                ctrl.$validate();
            });
        }
    }
    function urlInputType(scope, element, attr, ctrl, $sniffer, $browser) {
        baseInputType(scope, element, attr, ctrl, $sniffer, $browser), stringBasedInputType(ctrl), 
        ctrl.$$parserName = "url", ctrl.$validators.url = function(modelValue, viewValue) {
            var value = modelValue || viewValue;
            return ctrl.$isEmpty(value) || URL_REGEXP.test(value);
        };
    }
    function emailInputType(scope, element, attr, ctrl, $sniffer, $browser) {
        baseInputType(scope, element, attr, ctrl, $sniffer, $browser), stringBasedInputType(ctrl), 
        ctrl.$$parserName = "email", ctrl.$validators.email = function(modelValue, viewValue) {
            var value = modelValue || viewValue;
            return ctrl.$isEmpty(value) || EMAIL_REGEXP.test(value);
        };
    }
    function radioInputType(scope, element, attr, ctrl) {
        isUndefined(attr.name) && element.attr("name", nextUid());
        var listener = function(ev) {
            element[0].checked && ctrl.$setViewValue(attr.value, ev && ev.type);
        };
        element.on("click", listener), ctrl.$render = function() {
            var value = attr.value;
            element[0].checked = value == ctrl.$viewValue;
        }, attr.$observe("value", ctrl.$render);
    }
    function parseConstantExpr($parse, context, name, expression, fallback) {
        var parseFn;
        if (isDefined(expression)) {
            if (parseFn = $parse(expression), !parseFn.constant) throw minErr("ngModel")("constexpr", "Expected constant expression for `{0}`, but saw `{1}`.", name, expression);
            return parseFn(context);
        }
        return fallback;
    }
    function checkboxInputType(scope, element, attr, ctrl, $sniffer, $browser, $filter, $parse) {
        var trueValue = parseConstantExpr($parse, scope, "ngTrueValue", attr.ngTrueValue, !0), falseValue = parseConstantExpr($parse, scope, "ngFalseValue", attr.ngFalseValue, !1), listener = function(ev) {
            ctrl.$setViewValue(element[0].checked, ev && ev.type);
        };
        element.on("click", listener), ctrl.$render = function() {
            element[0].checked = ctrl.$viewValue;
        }, ctrl.$isEmpty = function(value) {
            return value === !1;
        }, ctrl.$formatters.push(function(value) {
            return equals(value, trueValue);
        }), ctrl.$parsers.push(function(value) {
            return value ? trueValue : falseValue;
        });
    }
    function classDirective(name, selector) {
        return name = "ngClass" + name, [ "$animate", function($animate) {
            function arrayDifference(tokens1, tokens2) {
                var values = [];
                outer: for (var i = 0; i < tokens1.length; i++) {
                    for (var token = tokens1[i], j = 0; j < tokens2.length; j++) if (token == tokens2[j]) continue outer;
                    values.push(token);
                }
                return values;
            }
            function arrayClasses(classVal) {
                var classes = [];
                return isArray(classVal) ? (forEach(classVal, function(v) {
                    classes = classes.concat(arrayClasses(v));
                }), classes) : isString(classVal) ? classVal.split(" ") : isObject(classVal) ? (forEach(classVal, function(v, k) {
                    v && (classes = classes.concat(k.split(" ")));
                }), classes) : classVal;
            }
            return {
                restrict: "AC",
                link: function(scope, element, attr) {
                    function addClasses(classes) {
                        var newClasses = digestClassCounts(classes, 1);
                        attr.$addClass(newClasses);
                    }
                    function removeClasses(classes) {
                        var newClasses = digestClassCounts(classes, -1);
                        attr.$removeClass(newClasses);
                    }
                    function digestClassCounts(classes, count) {
                        var classCounts = element.data("$classCounts") || createMap(), classesToUpdate = [];
                        return forEach(classes, function(className) {
                            (count > 0 || classCounts[className]) && (classCounts[className] = (classCounts[className] || 0) + count, 
                            classCounts[className] === +(count > 0) && classesToUpdate.push(className));
                        }), element.data("$classCounts", classCounts), classesToUpdate.join(" ");
                    }
                    function updateClasses(oldClasses, newClasses) {
                        var toAdd = arrayDifference(newClasses, oldClasses), toRemove = arrayDifference(oldClasses, newClasses);
                        toAdd = digestClassCounts(toAdd, 1), toRemove = digestClassCounts(toRemove, -1), 
                        toAdd && toAdd.length && $animate.addClass(element, toAdd), toRemove && toRemove.length && $animate.removeClass(element, toRemove);
                    }
                    function ngClassWatchAction(newVal) {
                        if (selector === !0 || scope.$index % 2 === selector) {
                            var newClasses = arrayClasses(newVal || []);
                            if (oldVal) {
                                if (!equals(newVal, oldVal)) {
                                    var oldClasses = arrayClasses(oldVal);
                                    updateClasses(oldClasses, newClasses);
                                }
                            } else addClasses(newClasses);
                        }
                        oldVal = shallowCopy(newVal);
                    }
                    var oldVal;
                    scope.$watch(attr[name], ngClassWatchAction, !0), attr.$observe("class", function(value) {
                        ngClassWatchAction(scope.$eval(attr[name]));
                    }), "ngClass" !== name && scope.$watch("$index", function($index, old$index) {
                        var mod = 1 & $index;
                        if (mod !== (1 & old$index)) {
                            var classes = arrayClasses(scope.$eval(attr[name]));
                            mod === selector ? addClasses(classes) : removeClasses(classes);
                        }
                    });
                }
            };
        } ];
    }
    function addSetValidityMethod(context) {
        function setValidity(validationErrorKey, state, controller) {
            state === undefined ? createAndSet("$pending", validationErrorKey, controller) : unsetAndCleanup("$pending", validationErrorKey, controller), 
            isBoolean(state) ? state ? (unset(ctrl.$error, validationErrorKey, controller), 
            set(ctrl.$$success, validationErrorKey, controller)) : (set(ctrl.$error, validationErrorKey, controller), 
            unset(ctrl.$$success, validationErrorKey, controller)) : (unset(ctrl.$error, validationErrorKey, controller), 
            unset(ctrl.$$success, validationErrorKey, controller)), ctrl.$pending ? (cachedToggleClass(PENDING_CLASS, !0), 
            ctrl.$valid = ctrl.$invalid = undefined, toggleValidationCss("", null)) : (cachedToggleClass(PENDING_CLASS, !1), 
            ctrl.$valid = isObjectEmpty(ctrl.$error), ctrl.$invalid = !ctrl.$valid, toggleValidationCss("", ctrl.$valid));
            var combinedState;
            combinedState = ctrl.$pending && ctrl.$pending[validationErrorKey] ? undefined : ctrl.$error[validationErrorKey] ? !1 : ctrl.$$success[validationErrorKey] ? !0 : null, 
            toggleValidationCss(validationErrorKey, combinedState), parentForm.$setValidity(validationErrorKey, combinedState, ctrl);
        }
        function createAndSet(name, value, controller) {
            ctrl[name] || (ctrl[name] = {}), set(ctrl[name], value, controller);
        }
        function unsetAndCleanup(name, value, controller) {
            ctrl[name] && unset(ctrl[name], value, controller), isObjectEmpty(ctrl[name]) && (ctrl[name] = undefined);
        }
        function cachedToggleClass(className, switchValue) {
            switchValue && !classCache[className] ? ($animate.addClass($element, className), 
            classCache[className] = !0) : !switchValue && classCache[className] && ($animate.removeClass($element, className), 
            classCache[className] = !1);
        }
        function toggleValidationCss(validationErrorKey, isValid) {
            validationErrorKey = validationErrorKey ? "-" + snake_case(validationErrorKey, "-") : "", 
            cachedToggleClass(VALID_CLASS + validationErrorKey, isValid === !0), cachedToggleClass(INVALID_CLASS + validationErrorKey, isValid === !1);
        }
        var ctrl = context.ctrl, $element = context.$element, classCache = {}, set = context.set, unset = context.unset, parentForm = context.parentForm, $animate = context.$animate;
        classCache[INVALID_CLASS] = !(classCache[VALID_CLASS] = $element.hasClass(VALID_CLASS)), 
        ctrl.$setValidity = setValidity;
    }
    function isObjectEmpty(obj) {
        if (obj) for (var prop in obj) return !1;
        return !0;
    }
    var REGEX_STRING_REGEXP = /^\/(.+)\/([a-z]*)$/, VALIDITY_STATE_PROPERTY = "validity", lowercase = function(string) {
        return isString(string) ? string.toLowerCase() : string;
    }, hasOwnProperty = Object.prototype.hasOwnProperty, uppercase = function(string) {
        return isString(string) ? string.toUpperCase() : string;
    }, manualLowercase = function(s) {
        return isString(s) ? s.replace(/[A-Z]/g, function(ch) {
            return String.fromCharCode(32 | ch.charCodeAt(0));
        }) : s;
    }, manualUppercase = function(s) {
        return isString(s) ? s.replace(/[a-z]/g, function(ch) {
            return String.fromCharCode(-33 & ch.charCodeAt(0));
        }) : s;
    };
    "i" !== "I".toLowerCase() && (lowercase = manualLowercase, uppercase = manualUppercase);
    var msie, jqLite, jQuery, angularModule, slice = [].slice, splice = [].splice, push = [].push, toString = Object.prototype.toString, getPrototypeOf = Object.getPrototypeOf, ngMinErr = minErr("ng"), angular = window.angular || (window.angular = {}), uid = 0;
    msie = document.documentMode, noop.$inject = [], identity.$inject = [];
    var skipDestroyOnNextJQueryCleanData, isArray = Array.isArray, TYPED_ARRAY_REGEXP = /^\[object (Uint8(Clamped)?)|(Uint16)|(Uint32)|(Int8)|(Int16)|(Int32)|(Float(32)|(64))Array\]$/, trim = function(value) {
        return isString(value) ? value.trim() : value;
    }, escapeForRegexp = function(s) {
        return s.replace(/([-()\[\]{}+?*.$\^|,:#<!\\])/g, "\\$1").replace(/\x08/g, "\\x08");
    }, csp = function() {
        if (isDefined(csp.isActive_)) return csp.isActive_;
        var active = !(!document.querySelector("[ng-csp]") && !document.querySelector("[data-ng-csp]"));
        if (!active) try {
            new Function("");
        } catch (e) {
            active = !0;
        }
        return csp.isActive_ = active;
    }, jq = function() {
        if (isDefined(jq.name_)) return jq.name_;
        var el, i, prefix, name, ii = ngAttrPrefixes.length;
        for (i = 0; ii > i; ++i) if (prefix = ngAttrPrefixes[i], el = document.querySelector("[" + prefix.replace(":", "\\:") + "jq]")) {
            name = el.getAttribute(prefix + "jq");
            break;
        }
        return jq.name_ = name;
    }, ngAttrPrefixes = [ "ng-", "data-ng-", "ng:", "x-ng-" ], SNAKE_CASE_REGEXP = /[A-Z]/g, bindJQueryFired = !1, NODE_TYPE_ELEMENT = 1, NODE_TYPE_ATTRIBUTE = 2, NODE_TYPE_TEXT = 3, NODE_TYPE_COMMENT = 8, NODE_TYPE_DOCUMENT = 9, NODE_TYPE_DOCUMENT_FRAGMENT = 11, version = {
        full: "1.4.0",
        major: 1,
        minor: 4,
        dot: 0,
        codeName: "jaracimrman-existence"
    };
    JQLite.expando = "ng339";
    var jqCache = JQLite.cache = {}, jqId = 1, addEventListenerFn = function(element, type, fn) {
        element.addEventListener(type, fn, !1);
    }, removeEventListenerFn = function(element, type, fn) {
        element.removeEventListener(type, fn, !1);
    };
    JQLite._data = function(node) {
        return this.cache[node[this.expando]] || {};
    };
    var SPECIAL_CHARS_REGEXP = /([\:\-\_]+(.))/g, MOZ_HACK_REGEXP = /^moz([A-Z])/, MOUSE_EVENT_MAP = {
        mouseleave: "mouseout",
        mouseenter: "mouseover"
    }, jqLiteMinErr = minErr("jqLite"), SINGLE_TAG_REGEXP = /^<(\w+)\s*\/?>(?:<\/\1>|)$/, HTML_REGEXP = /<|&#?\w+;/, TAG_NAME_REGEXP = /<([\w:]+)/, XHTML_TAG_REGEXP = /<(?!area|br|col|embed|hr|img|input|link|meta|param)(([\w:]+)[^>]*)\/>/gi, wrapMap = {
        option: [ 1, '<select multiple="multiple">', "</select>" ],
        thead: [ 1, "<table>", "</table>" ],
        col: [ 2, "<table><colgroup>", "</colgroup></table>" ],
        tr: [ 2, "<table><tbody>", "</tbody></table>" ],
        td: [ 3, "<table><tbody><tr>", "</tr></tbody></table>" ],
        _default: [ 0, "", "" ]
    };
    wrapMap.optgroup = wrapMap.option, wrapMap.tbody = wrapMap.tfoot = wrapMap.colgroup = wrapMap.caption = wrapMap.thead, 
    wrapMap.th = wrapMap.td;
    var JQLitePrototype = JQLite.prototype = {
        ready: function(fn) {
            function trigger() {
                fired || (fired = !0, fn());
            }
            var fired = !1;
            "complete" === document.readyState ? setTimeout(trigger) : (this.on("DOMContentLoaded", trigger), 
            JQLite(window).on("load", trigger));
        },
        toString: function() {
            var value = [];
            return forEach(this, function(e) {
                value.push("" + e);
            }), "[" + value.join(", ") + "]";
        },
        eq: function(index) {
            return jqLite(index >= 0 ? this[index] : this[this.length + index]);
        },
        length: 0,
        push: push,
        sort: [].sort,
        splice: [].splice
    }, BOOLEAN_ATTR = {};
    forEach("multiple,selected,checked,disabled,readOnly,required,open".split(","), function(value) {
        BOOLEAN_ATTR[lowercase(value)] = value;
    });
    var BOOLEAN_ELEMENTS = {};
    forEach("input,select,option,textarea,button,form,details".split(","), function(value) {
        BOOLEAN_ELEMENTS[value] = !0;
    });
    var ALIASED_ATTR = {
        ngMinlength: "minlength",
        ngMaxlength: "maxlength",
        ngMin: "min",
        ngMax: "max",
        ngPattern: "pattern"
    };
    forEach({
        data: jqLiteData,
        removeData: jqLiteRemoveData
    }, function(fn, name) {
        JQLite[name] = fn;
    }), forEach({
        data: jqLiteData,
        inheritedData: jqLiteInheritedData,
        scope: function(element) {
            return jqLite.data(element, "$scope") || jqLiteInheritedData(element.parentNode || element, [ "$isolateScope", "$scope" ]);
        },
        isolateScope: function(element) {
            return jqLite.data(element, "$isolateScope") || jqLite.data(element, "$isolateScopeNoTemplate");
        },
        controller: jqLiteController,
        injector: function(element) {
            return jqLiteInheritedData(element, "$injector");
        },
        removeAttr: function(element, name) {
            element.removeAttribute(name);
        },
        hasClass: jqLiteHasClass,
        css: function(element, name, value) {
            return name = camelCase(name), isDefined(value) ? void (element.style[name] = value) : element.style[name];
        },
        attr: function(element, name, value) {
            var nodeType = element.nodeType;
            if (nodeType !== NODE_TYPE_TEXT && nodeType !== NODE_TYPE_ATTRIBUTE && nodeType !== NODE_TYPE_COMMENT) {
                var lowercasedName = lowercase(name);
                if (BOOLEAN_ATTR[lowercasedName]) {
                    if (!isDefined(value)) return element[name] || (element.attributes.getNamedItem(name) || noop).specified ? lowercasedName : undefined;
                    value ? (element[name] = !0, element.setAttribute(name, lowercasedName)) : (element[name] = !1, 
                    element.removeAttribute(lowercasedName));
                } else if (isDefined(value)) element.setAttribute(name, value); else if (element.getAttribute) {
                    var ret = element.getAttribute(name, 2);
                    return null === ret ? undefined : ret;
                }
            }
        },
        prop: function(element, name, value) {
            return isDefined(value) ? void (element[name] = value) : element[name];
        },
        text: function() {
            function getText(element, value) {
                if (isUndefined(value)) {
                    var nodeType = element.nodeType;
                    return nodeType === NODE_TYPE_ELEMENT || nodeType === NODE_TYPE_TEXT ? element.textContent : "";
                }
                element.textContent = value;
            }
            return getText.$dv = "", getText;
        }(),
        val: function(element, value) {
            if (isUndefined(value)) {
                if (element.multiple && "select" === nodeName_(element)) {
                    var result = [];
                    return forEach(element.options, function(option) {
                        option.selected && result.push(option.value || option.text);
                    }), 0 === result.length ? null : result;
                }
                return element.value;
            }
            element.value = value;
        },
        html: function(element, value) {
            return isUndefined(value) ? element.innerHTML : (jqLiteDealoc(element, !0), void (element.innerHTML = value));
        },
        empty: jqLiteEmpty
    }, function(fn, name) {
        JQLite.prototype[name] = function(arg1, arg2) {
            var i, key, nodeCount = this.length;
            if (fn !== jqLiteEmpty && (2 == fn.length && fn !== jqLiteHasClass && fn !== jqLiteController ? arg1 : arg2) === undefined) {
                if (isObject(arg1)) {
                    for (i = 0; nodeCount > i; i++) if (fn === jqLiteData) fn(this[i], arg1); else for (key in arg1) fn(this[i], key, arg1[key]);
                    return this;
                }
                for (var value = fn.$dv, jj = value === undefined ? Math.min(nodeCount, 1) : nodeCount, j = 0; jj > j; j++) {
                    var nodeValue = fn(this[j], arg1, arg2);
                    value = value ? value + nodeValue : nodeValue;
                }
                return value;
            }
            for (i = 0; nodeCount > i; i++) fn(this[i], arg1, arg2);
            return this;
        };
    }), forEach({
        removeData: jqLiteRemoveData,
        on: function jqLiteOn(element, type, fn, unsupported) {
            if (isDefined(unsupported)) throw jqLiteMinErr("onargs", "jqLite#on() does not support the `selector` or `eventData` parameters");
            if (jqLiteAcceptsData(element)) {
                var expandoStore = jqLiteExpandoStore(element, !0), events = expandoStore.events, handle = expandoStore.handle;
                handle || (handle = expandoStore.handle = createEventHandler(element, events));
                for (var types = type.indexOf(" ") >= 0 ? type.split(" ") : [ type ], i = types.length; i--; ) {
                    type = types[i];
                    var eventFns = events[type];
                    eventFns || (events[type] = [], "mouseenter" === type || "mouseleave" === type ? jqLiteOn(element, MOUSE_EVENT_MAP[type], function(event) {
                        var target = this, related = event.relatedTarget;
                        (!related || related !== target && !target.contains(related)) && handle(event, type);
                    }) : "$destroy" !== type && addEventListenerFn(element, type, handle), eventFns = events[type]), 
                    eventFns.push(fn);
                }
            }
        },
        off: jqLiteOff,
        one: function(element, type, fn) {
            element = jqLite(element), element.on(type, function onFn() {
                element.off(type, fn), element.off(type, onFn);
            }), element.on(type, fn);
        },
        replaceWith: function(element, replaceNode) {
            var index, parent = element.parentNode;
            jqLiteDealoc(element), forEach(new JQLite(replaceNode), function(node) {
                index ? parent.insertBefore(node, index.nextSibling) : parent.replaceChild(node, element), 
                index = node;
            });
        },
        children: function(element) {
            var children = [];
            return forEach(element.childNodes, function(element) {
                element.nodeType === NODE_TYPE_ELEMENT && children.push(element);
            }), children;
        },
        contents: function(element) {
            return element.contentDocument || element.childNodes || [];
        },
        append: function(element, node) {
            var nodeType = element.nodeType;
            if (nodeType === NODE_TYPE_ELEMENT || nodeType === NODE_TYPE_DOCUMENT_FRAGMENT) {
                node = new JQLite(node);
                for (var i = 0, ii = node.length; ii > i; i++) {
                    var child = node[i];
                    element.appendChild(child);
                }
            }
        },
        prepend: function(element, node) {
            if (element.nodeType === NODE_TYPE_ELEMENT) {
                var index = element.firstChild;
                forEach(new JQLite(node), function(child) {
                    element.insertBefore(child, index);
                });
            }
        },
        wrap: function(element, wrapNode) {
            wrapNode = jqLite(wrapNode).eq(0).clone()[0];
            var parent = element.parentNode;
            parent && parent.replaceChild(wrapNode, element), wrapNode.appendChild(element);
        },
        remove: jqLiteRemove,
        detach: function(element) {
            jqLiteRemove(element, !0);
        },
        after: function(element, newElement) {
            var index = element, parent = element.parentNode;
            newElement = new JQLite(newElement);
            for (var i = 0, ii = newElement.length; ii > i; i++) {
                var node = newElement[i];
                parent.insertBefore(node, index.nextSibling), index = node;
            }
        },
        addClass: jqLiteAddClass,
        removeClass: jqLiteRemoveClass,
        toggleClass: function(element, selector, condition) {
            selector && forEach(selector.split(" "), function(className) {
                var classCondition = condition;
                isUndefined(classCondition) && (classCondition = !jqLiteHasClass(element, className)), 
                (classCondition ? jqLiteAddClass : jqLiteRemoveClass)(element, className);
            });
        },
        parent: function(element) {
            var parent = element.parentNode;
            return parent && parent.nodeType !== NODE_TYPE_DOCUMENT_FRAGMENT ? parent : null;
        },
        next: function(element) {
            return element.nextElementSibling;
        },
        find: function(element, selector) {
            return element.getElementsByTagName ? element.getElementsByTagName(selector) : [];
        },
        clone: jqLiteClone,
        triggerHandler: function(element, event, extraParameters) {
            var dummyEvent, eventFnsCopy, handlerArgs, eventName = event.type || event, expandoStore = jqLiteExpandoStore(element), events = expandoStore && expandoStore.events, eventFns = events && events[eventName];
            eventFns && (dummyEvent = {
                preventDefault: function() {
                    this.defaultPrevented = !0;
                },
                isDefaultPrevented: function() {
                    return this.defaultPrevented === !0;
                },
                stopImmediatePropagation: function() {
                    this.immediatePropagationStopped = !0;
                },
                isImmediatePropagationStopped: function() {
                    return this.immediatePropagationStopped === !0;
                },
                stopPropagation: noop,
                type: eventName,
                target: element
            }, event.type && (dummyEvent = extend(dummyEvent, event)), eventFnsCopy = shallowCopy(eventFns), 
            handlerArgs = extraParameters ? [ dummyEvent ].concat(extraParameters) : [ dummyEvent ], 
            forEach(eventFnsCopy, function(fn) {
                dummyEvent.isImmediatePropagationStopped() || fn.apply(element, handlerArgs);
            }));
        }
    }, function(fn, name) {
        JQLite.prototype[name] = function(arg1, arg2, arg3) {
            for (var value, i = 0, ii = this.length; ii > i; i++) isUndefined(value) ? (value = fn(this[i], arg1, arg2, arg3), 
            isDefined(value) && (value = jqLite(value))) : jqLiteAddNodes(value, fn(this[i], arg1, arg2, arg3));
            return isDefined(value) ? value : this;
        }, JQLite.prototype.bind = JQLite.prototype.on, JQLite.prototype.unbind = JQLite.prototype.off;
    }), HashMap.prototype = {
        put: function(key, value) {
            this[hashKey(key, this.nextUid)] = value;
        },
        get: function(key) {
            return this[hashKey(key, this.nextUid)];
        },
        remove: function(key) {
            var value = this[key = hashKey(key, this.nextUid)];
            return delete this[key], value;
        }
    };
    var $$HashMapProvider = [ function() {
        this.$get = [ function() {
            return HashMap;
        } ];
    } ], FN_ARGS = /^function\s*[^\(]*\(\s*([^\)]*)\)/m, FN_ARG_SPLIT = /,/, FN_ARG = /^\s*(_?)(\S+?)\1\s*$/, STRIP_COMMENTS = /((\/\/.*$)|(\/\*[\s\S]*?\*\/))/gm, $injectorMinErr = minErr("$injector");
    createInjector.$$annotate = annotate;
    var $animateMinErr = minErr("$animate"), ELEMENT_NODE = 1, NG_ANIMATE_CLASSNAME = "ng-animate", $$CoreAnimateRunnerProvider = function() {
        this.$get = [ "$q", "$$rAF", function($q, $$rAF) {
            function AnimateRunner() {}
            return AnimateRunner.all = noop, AnimateRunner.chain = noop, AnimateRunner.prototype = {
                end: noop,
                cancel: noop,
                resume: noop,
                pause: noop,
                complete: noop,
                then: function(pass, fail) {
                    return $q(function(resolve) {
                        $$rAF(function() {
                            resolve();
                        });
                    }).then(pass, fail);
                }
            }, AnimateRunner;
        } ];
    }, $$CoreAnimateQueueProvider = function() {
        var postDigestQueue = new HashMap(), postDigestElements = [];
        this.$get = [ "$$AnimateRunner", "$rootScope", function($$AnimateRunner, $rootScope) {
            function addRemoveClassesPostDigest(element, add, remove) {
                var data = postDigestQueue.get(element);
                data || (postDigestQueue.put(element, data = {}), postDigestElements.push(element)), 
                add && forEach(add.split(" "), function(className) {
                    className && (data[className] = !0);
                }), remove && forEach(remove.split(" "), function(className) {
                    className && (data[className] = !1);
                }), postDigestElements.length > 1 || $rootScope.$$postDigest(function() {
                    forEach(postDigestElements, function(element) {
                        var data = postDigestQueue.get(element);
                        if (data) {
                            var existing = splitClasses(element.attr("class")), toAdd = "", toRemove = "";
                            forEach(data, function(status, className) {
                                var hasClass = !!existing[className];
                                status !== hasClass && (status ? toAdd += (toAdd.length ? " " : "") + className : toRemove += (toRemove.length ? " " : "") + className);
                            }), forEach(element, function(elm) {
                                toAdd && jqLiteAddClass(elm, toAdd), toRemove && jqLiteRemoveClass(elm, toRemove);
                            }), postDigestQueue.remove(element);
                        }
                    }), postDigestElements.length = 0;
                });
            }
            return {
                enabled: noop,
                on: noop,
                off: noop,
                pin: noop,
                push: function(element, event, options, domOperation) {
                    return domOperation && domOperation(), options = options || {}, options.from && element.css(options.from), 
                    options.to && element.css(options.to), (options.addClass || options.removeClass) && addRemoveClassesPostDigest(element, options.addClass, options.removeClass), 
                    new $$AnimateRunner();
                }
            };
        } ];
    }, $AnimateProvider = [ "$provide", function($provide) {
        var provider = this;
        this.$$registeredAnimations = Object.create(null), this.register = function(name, factory) {
            if (name && "." !== name.charAt(0)) throw $animateMinErr("notcsel", "Expecting class selector starting with '.' got '{0}'.", name);
            var key = name + "-animation";
            provider.$$registeredAnimations[name.substr(1)] = key, $provide.factory(key, factory);
        }, this.classNameFilter = function(expression) {
            if (1 === arguments.length && (this.$$classNameFilter = expression instanceof RegExp ? expression : null, 
            this.$$classNameFilter)) {
                var reservedRegex = new RegExp("(\\s+|\\/)" + NG_ANIMATE_CLASSNAME + "(\\s+|\\/)");
                if (reservedRegex.test(this.$$classNameFilter.toString())) throw $animateMinErr("nongcls", '$animateProvider.classNameFilter(regex) prohibits accepting a regex value which matches/contains the "{0}" CSS class.', NG_ANIMATE_CLASSNAME);
            }
            return this.$$classNameFilter;
        }, this.$get = [ "$$animateQueue", function($$animateQueue) {
            function domInsert(element, parentElement, afterElement) {
                if (afterElement) {
                    var afterNode = extractElementNode(afterElement);
                    !afterNode || afterNode.parentNode || afterNode.previousElementSibling || (afterElement = null);
                }
                afterElement ? afterElement.after(element) : parentElement.prepend(element);
            }
            return {
                on: $$animateQueue.on,
                off: $$animateQueue.off,
                pin: $$animateQueue.pin,
                enabled: $$animateQueue.enabled,
                cancel: function(runner) {
                    runner.end && runner.end();
                },
                enter: function(element, parent, after, options) {
                    return parent = parent && jqLite(parent), after = after && jqLite(after), parent = parent || after.parent(), 
                    domInsert(element, parent, after), $$animateQueue.push(element, "enter", prepareAnimateOptions(options));
                },
                move: function(element, parent, after, options) {
                    return parent = parent && jqLite(parent), after = after && jqLite(after), parent = parent || after.parent(), 
                    domInsert(element, parent, after), $$animateQueue.push(element, "move", prepareAnimateOptions(options));
                },
                leave: function(element, options) {
                    return $$animateQueue.push(element, "leave", prepareAnimateOptions(options), function() {
                        element.remove();
                    });
                },
                addClass: function(element, className, options) {
                    return options = prepareAnimateOptions(options), options.addClass = mergeClasses(options.addclass, className), 
                    $$animateQueue.push(element, "addClass", options);
                },
                removeClass: function(element, className, options) {
                    return options = prepareAnimateOptions(options), options.removeClass = mergeClasses(options.removeClass, className), 
                    $$animateQueue.push(element, "removeClass", options);
                },
                setClass: function(element, add, remove, options) {
                    return options = prepareAnimateOptions(options), options.addClass = mergeClasses(options.addClass, add), 
                    options.removeClass = mergeClasses(options.removeClass, remove), $$animateQueue.push(element, "setClass", options);
                },
                animate: function(element, from, to, className, options) {
                    return options = prepareAnimateOptions(options), options.from = options.from ? extend(options.from, from) : from, 
                    options.to = options.to ? extend(options.to, to) : to, className = className || "ng-inline-animate", 
                    options.tempClasses = mergeClasses(options.tempClasses, className), $$animateQueue.push(element, "animate", options);
                }
            };
        } ];
    } ], $compileMinErr = minErr("$compile");
    $CompileProvider.$inject = [ "$provide", "$$sanitizeUriProvider" ];
    var PREFIX_REGEXP = /^((?:x|data)[\:\-_])/i, $controllerMinErr = minErr("$controller"), CNTRL_REG = /^(\S+)(\s+as\s+(\w+))?$/, APPLICATION_JSON = "application/json", CONTENT_TYPE_APPLICATION_JSON = {
        "Content-Type": APPLICATION_JSON + ";charset=utf-8"
    }, JSON_START = /^\[|^\{(?!\{)/, JSON_ENDS = {
        "[": /]$/,
        "{": /}$/
    }, JSON_PROTECTION_PREFIX = /^\)\]\}',?\n/, $interpolateMinErr = angular.$interpolateMinErr = minErr("$interpolate");
    $interpolateMinErr.throwNoconcat = function(text) {
        throw $interpolateMinErr("noconcat", "Error while interpolating: {0}\nStrict Contextual Escaping disallows interpolations that concatenate multiple expressions when a trusted value is required.  See http://docs.angularjs.org/api/ng.$sce", text);
    }, $interpolateMinErr.interr = function(text, err) {
        return $interpolateMinErr("interr", "Can't interpolate: {0}\n{1}", text, err.toString());
    };
    var PATH_MATCH = /^([^\?#]*)(\?([^#]*))?(#(.*))?$/, DEFAULT_PORTS = {
        http: 80,
        https: 443,
        ftp: 21
    }, $locationMinErr = minErr("$location"), locationPrototype = {
        $$html5: !1,
        $$replace: !1,
        absUrl: locationGetter("$$absUrl"),
        url: function(url) {
            if (isUndefined(url)) return this.$$url;
            var match = PATH_MATCH.exec(url);
            return (match[1] || "" === url) && this.path(decodeURIComponent(match[1])), (match[2] || match[1] || "" === url) && this.search(match[3] || ""), 
            this.hash(match[5] || ""), this;
        },
        protocol: locationGetter("$$protocol"),
        host: locationGetter("$$host"),
        port: locationGetter("$$port"),
        path: locationGetterSetter("$$path", function(path) {
            return path = null !== path ? path.toString() : "", "/" == path.charAt(0) ? path : "/" + path;
        }),
        search: function(search, paramValue) {
            switch (arguments.length) {
              case 0:
                return this.$$search;

              case 1:
                if (isString(search) || isNumber(search)) search = search.toString(), this.$$search = parseKeyValue(search); else {
                    if (!isObject(search)) throw $locationMinErr("isrcharg", "The first argument of the `$location#search()` call must be a string or an object.");
                    search = copy(search, {}), forEach(search, function(value, key) {
                        null == value && delete search[key];
                    }), this.$$search = search;
                }
                break;

              default:
                isUndefined(paramValue) || null === paramValue ? delete this.$$search[search] : this.$$search[search] = paramValue;
            }
            return this.$$compose(), this;
        },
        hash: locationGetterSetter("$$hash", function(hash) {
            return null !== hash ? hash.toString() : "";
        }),
        replace: function() {
            return this.$$replace = !0, this;
        }
    };
    forEach([ LocationHashbangInHtml5Url, LocationHashbangUrl, LocationHtml5Url ], function(Location) {
        Location.prototype = Object.create(locationPrototype), Location.prototype.state = function(state) {
            if (!arguments.length) return this.$$state;
            if (Location !== LocationHtml5Url || !this.$$html5) throw $locationMinErr("nostate", "History API state support is available only in HTML5 mode and only in browsers supporting HTML5 History API");
            return this.$$state = isUndefined(state) ? null : state, this;
        };
    });
    var $parseMinErr = minErr("$parse"), CALL = Function.prototype.call, APPLY = Function.prototype.apply, BIND = Function.prototype.bind, OPERATORS = createMap();
    forEach("+ - * / % === !== == != < > <= >= && || ! = |".split(" "), function(operator) {
        OPERATORS[operator] = !0;
    });
    var ESCAPE = {
        n: "\n",
        f: "\f",
        r: "\r",
        t: "	",
        v: "",
        "'": "'",
        '"': '"'
    }, Lexer = function(options) {
        this.options = options;
    };
    Lexer.prototype = {
        constructor: Lexer,
        lex: function(text) {
            for (this.text = text, this.index = 0, this.tokens = []; this.index < this.text.length; ) {
                var ch = this.text.charAt(this.index);
                if ('"' === ch || "'" === ch) this.readString(ch); else if (this.isNumber(ch) || "." === ch && this.isNumber(this.peek())) this.readNumber(); else if (this.isIdent(ch)) this.readIdent(); else if (this.is(ch, "(){}[].,;:?")) this.tokens.push({
                    index: this.index,
                    text: ch
                }), this.index++; else if (this.isWhitespace(ch)) this.index++; else {
                    var ch2 = ch + this.peek(), ch3 = ch2 + this.peek(2), op1 = OPERATORS[ch], op2 = OPERATORS[ch2], op3 = OPERATORS[ch3];
                    if (op1 || op2 || op3) {
                        var token = op3 ? ch3 : op2 ? ch2 : ch;
                        this.tokens.push({
                            index: this.index,
                            text: token,
                            operator: !0
                        }), this.index += token.length;
                    } else this.throwError("Unexpected next character ", this.index, this.index + 1);
                }
            }
            return this.tokens;
        },
        is: function(ch, chars) {
            return -1 !== chars.indexOf(ch);
        },
        peek: function(i) {
            var num = i || 1;
            return this.index + num < this.text.length ? this.text.charAt(this.index + num) : !1;
        },
        isNumber: function(ch) {
            return ch >= "0" && "9" >= ch && "string" == typeof ch;
        },
        isWhitespace: function(ch) {
            return " " === ch || "\r" === ch || "	" === ch || "\n" === ch || "" === ch || " " === ch;
        },
        isIdent: function(ch) {
            return ch >= "a" && "z" >= ch || ch >= "A" && "Z" >= ch || "_" === ch || "$" === ch;
        },
        isExpOperator: function(ch) {
            return "-" === ch || "+" === ch || this.isNumber(ch);
        },
        throwError: function(error, start, end) {
            end = end || this.index;
            var colStr = isDefined(start) ? "s " + start + "-" + this.index + " [" + this.text.substring(start, end) + "]" : " " + end;
            throw $parseMinErr("lexerr", "Lexer Error: {0} at column{1} in expression [{2}].", error, colStr, this.text);
        },
        readNumber: function() {
            for (var number = "", start = this.index; this.index < this.text.length; ) {
                var ch = lowercase(this.text.charAt(this.index));
                if ("." == ch || this.isNumber(ch)) number += ch; else {
                    var peekCh = this.peek();
                    if ("e" == ch && this.isExpOperator(peekCh)) number += ch; else if (this.isExpOperator(ch) && peekCh && this.isNumber(peekCh) && "e" == number.charAt(number.length - 1)) number += ch; else {
                        if (!this.isExpOperator(ch) || peekCh && this.isNumber(peekCh) || "e" != number.charAt(number.length - 1)) break;
                        this.throwError("Invalid exponent");
                    }
                }
                this.index++;
            }
            this.tokens.push({
                index: start,
                text: number,
                constant: !0,
                value: Number(number)
            });
        },
        readIdent: function() {
            for (var start = this.index; this.index < this.text.length; ) {
                var ch = this.text.charAt(this.index);
                if (!this.isIdent(ch) && !this.isNumber(ch)) break;
                this.index++;
            }
            this.tokens.push({
                index: start,
                text: this.text.slice(start, this.index),
                identifier: !0
            });
        },
        readString: function(quote) {
            var start = this.index;
            this.index++;
            for (var string = "", rawString = quote, escape = !1; this.index < this.text.length; ) {
                var ch = this.text.charAt(this.index);
                if (rawString += ch, escape) {
                    if ("u" === ch) {
                        var hex = this.text.substring(this.index + 1, this.index + 5);
                        hex.match(/[\da-f]{4}/i) || this.throwError("Invalid unicode escape [\\u" + hex + "]"), 
                        this.index += 4, string += String.fromCharCode(parseInt(hex, 16));
                    } else {
                        var rep = ESCAPE[ch];
                        string += rep || ch;
                    }
                    escape = !1;
                } else if ("\\" === ch) escape = !0; else {
                    if (ch === quote) return this.index++, void this.tokens.push({
                        index: start,
                        text: rawString,
                        constant: !0,
                        value: string
                    });
                    string += ch;
                }
                this.index++;
            }
            this.throwError("Unterminated quote", start);
        }
    };
    var AST = function(lexer, options) {
        this.lexer = lexer, this.options = options;
    };
    AST.Program = "Program", AST.ExpressionStatement = "ExpressionStatement", AST.AssignmentExpression = "AssignmentExpression", 
    AST.ConditionalExpression = "ConditionalExpression", AST.LogicalExpression = "LogicalExpression", 
    AST.BinaryExpression = "BinaryExpression", AST.UnaryExpression = "UnaryExpression", 
    AST.CallExpression = "CallExpression", AST.MemberExpression = "MemberExpression", 
    AST.Identifier = "Identifier", AST.Literal = "Literal", AST.ArrayExpression = "ArrayExpression", 
    AST.Property = "Property", AST.ObjectExpression = "ObjectExpression", AST.ThisExpression = "ThisExpression", 
    AST.NGValueParameter = "NGValueParameter", AST.prototype = {
        ast: function(text) {
            this.text = text, this.tokens = this.lexer.lex(text);
            var value = this.program();
            return 0 !== this.tokens.length && this.throwError("is an unexpected token", this.tokens[0]), 
            value;
        },
        program: function() {
            for (var body = []; ;) if (this.tokens.length > 0 && !this.peek("}", ")", ";", "]") && body.push(this.expressionStatement()), 
            !this.expect(";")) return {
                type: AST.Program,
                body: body
            };
        },
        expressionStatement: function() {
            return {
                type: AST.ExpressionStatement,
                expression: this.filterChain()
            };
        },
        filterChain: function() {
            for (var token, left = this.expression(); token = this.expect("|"); ) left = this.filter(left);
            return left;
        },
        expression: function() {
            return this.assignment();
        },
        assignment: function() {
            var result = this.ternary();
            return this.expect("=") && (result = {
                type: AST.AssignmentExpression,
                left: result,
                right: this.assignment(),
                operator: "="
            }), result;
        },
        ternary: function() {
            var alternate, consequent, test = this.logicalOR();
            return this.expect("?") && (alternate = this.expression(), this.consume(":")) ? (consequent = this.expression(), 
            {
                type: AST.ConditionalExpression,
                test: test,
                alternate: alternate,
                consequent: consequent
            }) : test;
        },
        logicalOR: function() {
            for (var left = this.logicalAND(); this.expect("||"); ) left = {
                type: AST.LogicalExpression,
                operator: "||",
                left: left,
                right: this.logicalAND()
            };
            return left;
        },
        logicalAND: function() {
            for (var left = this.equality(); this.expect("&&"); ) left = {
                type: AST.LogicalExpression,
                operator: "&&",
                left: left,
                right: this.equality()
            };
            return left;
        },
        equality: function() {
            for (var token, left = this.relational(); token = this.expect("==", "!=", "===", "!=="); ) left = {
                type: AST.BinaryExpression,
                operator: token.text,
                left: left,
                right: this.relational()
            };
            return left;
        },
        relational: function() {
            for (var token, left = this.additive(); token = this.expect("<", ">", "<=", ">="); ) left = {
                type: AST.BinaryExpression,
                operator: token.text,
                left: left,
                right: this.additive()
            };
            return left;
        },
        additive: function() {
            for (var token, left = this.multiplicative(); token = this.expect("+", "-"); ) left = {
                type: AST.BinaryExpression,
                operator: token.text,
                left: left,
                right: this.multiplicative()
            };
            return left;
        },
        multiplicative: function() {
            for (var token, left = this.unary(); token = this.expect("*", "/", "%"); ) left = {
                type: AST.BinaryExpression,
                operator: token.text,
                left: left,
                right: this.unary()
            };
            return left;
        },
        unary: function() {
            var token;
            return (token = this.expect("+", "-", "!")) ? {
                type: AST.UnaryExpression,
                operator: token.text,
                prefix: !0,
                argument: this.unary()
            } : this.primary();
        },
        primary: function() {
            var primary;
            this.expect("(") ? (primary = this.filterChain(), this.consume(")")) : this.expect("[") ? primary = this.arrayDeclaration() : this.expect("{") ? primary = this.object() : this.constants.hasOwnProperty(this.peek().text) ? primary = copy(this.constants[this.consume().text]) : this.peek().identifier ? primary = this.identifier() : this.peek().constant ? primary = this.constant() : this.throwError("not a primary expression", this.peek());
            for (var next; next = this.expect("(", "[", "."); ) "(" === next.text ? (primary = {
                type: AST.CallExpression,
                callee: primary,
                arguments: this.parseArguments()
            }, this.consume(")")) : "[" === next.text ? (primary = {
                type: AST.MemberExpression,
                object: primary,
                property: this.expression(),
                computed: !0
            }, this.consume("]")) : "." === next.text ? primary = {
                type: AST.MemberExpression,
                object: primary,
                property: this.identifier(),
                computed: !1
            } : this.throwError("IMPOSSIBLE");
            return primary;
        },
        filter: function(baseExpression) {
            for (var args = [ baseExpression ], result = {
                type: AST.CallExpression,
                callee: this.identifier(),
                arguments: args,
                filter: !0
            }; this.expect(":"); ) args.push(this.expression());
            return result;
        },
        parseArguments: function() {
            var args = [];
            if (")" !== this.peekToken().text) do args.push(this.expression()); while (this.expect(","));
            return args;
        },
        identifier: function() {
            var token = this.consume();
            return token.identifier || this.throwError("is not a valid identifier", token), 
            {
                type: AST.Identifier,
                name: token.text
            };
        },
        constant: function() {
            return {
                type: AST.Literal,
                value: this.consume().value
            };
        },
        arrayDeclaration: function() {
            var elements = [];
            if ("]" !== this.peekToken().text) do {
                if (this.peek("]")) break;
                elements.push(this.expression());
            } while (this.expect(","));
            return this.consume("]"), {
                type: AST.ArrayExpression,
                elements: elements
            };
        },
        object: function() {
            var property, properties = [];
            if ("}" !== this.peekToken().text) do {
                if (this.peek("}")) break;
                property = {
                    type: AST.Property,
                    kind: "init"
                }, this.peek().constant ? property.key = this.constant() : this.peek().identifier ? property.key = this.identifier() : this.throwError("invalid key", this.peek()), 
                this.consume(":"), property.value = this.expression(), properties.push(property);
            } while (this.expect(","));
            return this.consume("}"), {
                type: AST.ObjectExpression,
                properties: properties
            };
        },
        throwError: function(msg, token) {
            throw $parseMinErr("syntax", "Syntax Error: Token '{0}' {1} at column {2} of the expression [{3}] starting at [{4}].", token.text, msg, token.index + 1, this.text, this.text.substring(token.index));
        },
        consume: function(e1) {
            if (0 === this.tokens.length) throw $parseMinErr("ueoe", "Unexpected end of expression: {0}", this.text);
            var token = this.expect(e1);
            return token || this.throwError("is unexpected, expecting [" + e1 + "]", this.peek()), 
            token;
        },
        peekToken: function() {
            if (0 === this.tokens.length) throw $parseMinErr("ueoe", "Unexpected end of expression: {0}", this.text);
            return this.tokens[0];
        },
        peek: function(e1, e2, e3, e4) {
            return this.peekAhead(0, e1, e2, e3, e4);
        },
        peekAhead: function(i, e1, e2, e3, e4) {
            if (this.tokens.length > i) {
                var token = this.tokens[i], t = token.text;
                if (t === e1 || t === e2 || t === e3 || t === e4 || !e1 && !e2 && !e3 && !e4) return token;
            }
            return !1;
        },
        expect: function(e1, e2, e3, e4) {
            var token = this.peek(e1, e2, e3, e4);
            return token ? (this.tokens.shift(), token) : !1;
        },
        constants: {
            "true": {
                type: AST.Literal,
                value: !0
            },
            "false": {
                type: AST.Literal,
                value: !1
            },
            "null": {
                type: AST.Literal,
                value: null
            },
            undefined: {
                type: AST.Literal,
                value: undefined
            },
            "this": {
                type: AST.ThisExpression
            }
        }
    }, ASTCompiler.prototype = {
        compile: function(expression, expensiveChecks) {
            var self = this, ast = this.astBuilder.ast(expression);
            this.state = {
                nextId: 0,
                filters: {},
                expensiveChecks: expensiveChecks,
                fn: {
                    vars: [],
                    body: [],
                    own: {}
                },
                assign: {
                    vars: [],
                    body: [],
                    own: {}
                },
                inputs: []
            }, findConstantAndWatchExpressions(ast, self.$filter);
            var assignable, extra = "";
            if (this.stage = "assign", assignable = assignableAST(ast)) {
                this.state.computing = "assign";
                var result = this.nextId();
                this.recurse(assignable, result), extra = "fn.assign=" + this.generateFunction("assign", "s,v,l");
            }
            var toWatch = getInputs(ast.body);
            self.stage = "inputs", forEach(toWatch, function(watch, key) {
                var fnKey = "fn" + key;
                self.state[fnKey] = {
                    vars: [],
                    body: [],
                    own: {}
                }, self.state.computing = fnKey;
                var intoId = self.nextId();
                self.recurse(watch, intoId), self.return_(intoId), self.state.inputs.push(fnKey), 
                watch.watchId = key;
            }), this.state.computing = "fn", this.stage = "main", this.recurse(ast);
            var fnString = '"' + this.USE + " " + this.STRICT + '";\n' + this.filterPrefix() + "var fn=" + this.generateFunction("fn", "s,l,a,i") + extra + this.watchFns() + "return fn;", fn = new Function("$filter", "ensureSafeMemberName", "ensureSafeObject", "ensureSafeFunction", "ifDefined", "plus", "text", fnString)(this.$filter, ensureSafeMemberName, ensureSafeObject, ensureSafeFunction, ifDefined, plusFn, expression);
            return this.state = this.stage = undefined, fn.literal = isLiteral(ast), fn.constant = isConstant(ast), 
            fn;
        },
        USE: "use",
        STRICT: "strict",
        watchFns: function() {
            var result = [], fns = this.state.inputs, self = this;
            return forEach(fns, function(name) {
                result.push("var " + name + "=" + self.generateFunction(name, "s"));
            }), fns.length && result.push("fn.inputs=[" + fns.join(",") + "];"), result.join("");
        },
        generateFunction: function(name, params) {
            return "function(" + params + "){" + this.varsPrefix(name) + this.body(name) + "};";
        },
        filterPrefix: function() {
            var parts = [], self = this;
            return forEach(this.state.filters, function(id, filter) {
                parts.push(id + "=$filter(" + self.escape(filter) + ")");
            }), parts.length ? "var " + parts.join(",") + ";" : "";
        },
        varsPrefix: function(section) {
            return this.state[section].vars.length ? "var " + this.state[section].vars.join(",") + ";" : "";
        },
        body: function(section) {
            return this.state[section].body.join("");
        },
        recurse: function(ast, intoId, nameId, recursionFn, create, skipWatchIdCheck) {
            var left, right, args, expression, self = this;
            if (recursionFn = recursionFn || noop, !skipWatchIdCheck && isDefined(ast.watchId)) return intoId = intoId || this.nextId(), 
            void this.if_("i", this.lazyAssign(intoId, this.computedMember("i", ast.watchId)), this.lazyRecurse(ast, intoId, nameId, recursionFn, create, !0));
            switch (ast.type) {
              case AST.Program:
                forEach(ast.body, function(expression, pos) {
                    self.recurse(expression.expression, undefined, undefined, function(expr) {
                        right = expr;
                    }), pos !== ast.body.length - 1 ? self.current().body.push(right, ";") : self.return_(right);
                });
                break;

              case AST.Literal:
                expression = this.escape(ast.value), this.assign(intoId, expression), recursionFn(expression);
                break;

              case AST.UnaryExpression:
                this.recurse(ast.argument, undefined, undefined, function(expr) {
                    right = expr;
                }), expression = ast.operator + "(" + this.ifDefined(right, 0) + ")", this.assign(intoId, expression), 
                recursionFn(expression);
                break;

              case AST.BinaryExpression:
                this.recurse(ast.left, undefined, undefined, function(expr) {
                    left = expr;
                }), this.recurse(ast.right, undefined, undefined, function(expr) {
                    right = expr;
                }), expression = "+" === ast.operator ? this.plus(left, right) : "-" === ast.operator ? this.ifDefined(left, 0) + ast.operator + this.ifDefined(right, 0) : "(" + left + ")" + ast.operator + "(" + right + ")", 
                this.assign(intoId, expression), recursionFn(expression);
                break;

              case AST.LogicalExpression:
                intoId = intoId || this.nextId(), self.recurse(ast.left, intoId), self.if_("&&" === ast.operator ? intoId : self.not(intoId), self.lazyRecurse(ast.right, intoId)), 
                recursionFn(intoId);
                break;

              case AST.ConditionalExpression:
                intoId = intoId || this.nextId(), self.recurse(ast.test, intoId), self.if_(intoId, self.lazyRecurse(ast.alternate, intoId), self.lazyRecurse(ast.consequent, intoId)), 
                recursionFn(intoId);
                break;

              case AST.Identifier:
                intoId = intoId || this.nextId(), nameId && (nameId.context = "inputs" === self.stage ? "s" : this.assign(this.nextId(), this.getHasOwnProperty("l", ast.name) + "?l:s"), 
                nameId.computed = !1, nameId.name = ast.name), ensureSafeMemberName(ast.name), self.if_("inputs" === self.stage || self.not(self.getHasOwnProperty("l", ast.name)), function() {
                    self.if_("inputs" === self.stage || "s", function() {
                        create && 1 !== create && self.if_(self.not(self.nonComputedMember("s", ast.name)), self.lazyAssign(self.nonComputedMember("s", ast.name), "{}")), 
                        self.assign(intoId, self.nonComputedMember("s", ast.name));
                    });
                }, intoId && self.lazyAssign(intoId, self.nonComputedMember("l", ast.name))), (self.state.expensiveChecks || isPossiblyDangerousMemberName(ast.name)) && self.addEnsureSafeObject(intoId), 
                recursionFn(intoId);
                break;

              case AST.MemberExpression:
                left = nameId && (nameId.context = this.nextId()) || this.nextId(), intoId = intoId || this.nextId(), 
                self.recurse(ast.object, left, undefined, function() {
                    self.if_(self.notNull(left), function() {
                        ast.computed ? (right = self.nextId(), self.recurse(ast.property, right), self.addEnsureSafeMemberName(right), 
                        create && 1 !== create && self.if_(self.not(self.computedMember(left, right)), self.lazyAssign(self.computedMember(left, right), "{}")), 
                        expression = self.ensureSafeObject(self.computedMember(left, right)), self.assign(intoId, expression), 
                        nameId && (nameId.computed = !0, nameId.name = right)) : (ensureSafeMemberName(ast.property.name), 
                        create && 1 !== create && self.if_(self.not(self.nonComputedMember(left, ast.property.name)), self.lazyAssign(self.nonComputedMember(left, ast.property.name), "{}")), 
                        expression = self.nonComputedMember(left, ast.property.name), (self.state.expensiveChecks || isPossiblyDangerousMemberName(ast.property.name)) && (expression = self.ensureSafeObject(expression)), 
                        self.assign(intoId, expression), nameId && (nameId.computed = !1, nameId.name = ast.property.name)), 
                        recursionFn(intoId);
                    });
                }, !!create);
                break;

              case AST.CallExpression:
                intoId = intoId || this.nextId(), ast.filter ? (right = self.filter(ast.callee.name), 
                args = [], forEach(ast.arguments, function(expr) {
                    var argument = self.nextId();
                    self.recurse(expr, argument), args.push(argument);
                }), expression = right + "(" + args.join(",") + ")", self.assign(intoId, expression), 
                recursionFn(intoId)) : (right = self.nextId(), left = {}, args = [], self.recurse(ast.callee, right, left, function() {
                    self.if_(self.notNull(right), function() {
                        self.addEnsureSafeFunction(right), forEach(ast.arguments, function(expr) {
                            self.recurse(expr, self.nextId(), undefined, function(argument) {
                                args.push(self.ensureSafeObject(argument));
                            });
                        }), left.name ? (self.state.expensiveChecks || self.addEnsureSafeObject(left.context), 
                        expression = self.member(left.context, left.name, left.computed) + "(" + args.join(",") + ")") : expression = right + "(" + args.join(",") + ")", 
                        expression = self.ensureSafeObject(expression), self.assign(intoId, expression), 
                        recursionFn(intoId);
                    });
                }));
                break;

              case AST.AssignmentExpression:
                if (right = this.nextId(), left = {}, !isAssignable(ast.left)) throw $parseMinErr("lval", "Trying to assing a value to a non l-value");
                this.recurse(ast.left, undefined, left, function() {
                    self.if_(self.notNull(left.context), function() {
                        self.recurse(ast.right, right), self.addEnsureSafeObject(self.member(left.context, left.name, left.computed)), 
                        expression = self.member(left.context, left.name, left.computed) + ast.operator + right, 
                        self.assign(intoId, expression), recursionFn(intoId || expression);
                    });
                }, 1);
                break;

              case AST.ArrayExpression:
                args = [], forEach(ast.elements, function(expr) {
                    self.recurse(expr, self.nextId(), undefined, function(argument) {
                        args.push(argument);
                    });
                }), expression = "[" + args.join(",") + "]", this.assign(intoId, expression), recursionFn(expression);
                break;

              case AST.ObjectExpression:
                args = [], forEach(ast.properties, function(property) {
                    self.recurse(property.value, self.nextId(), undefined, function(expr) {
                        args.push(self.escape(property.key.type === AST.Identifier ? property.key.name : "" + property.key.value) + ":" + expr);
                    });
                }), expression = "{" + args.join(",") + "}", this.assign(intoId, expression), recursionFn(expression);
                break;

              case AST.ThisExpression:
                this.assign(intoId, "s"), recursionFn("s");
                break;

              case AST.NGValueParameter:
                this.assign(intoId, "v"), recursionFn("v");
            }
        },
        getHasOwnProperty: function(element, property) {
            var key = element + "." + property, own = this.current().own;
            return own.hasOwnProperty(key) || (own[key] = this.nextId(!1, element + "&&(" + this.escape(property) + " in " + element + ")")), 
            own[key];
        },
        assign: function(id, value) {
            return id ? (this.current().body.push(id, "=", value, ";"), id) : void 0;
        },
        filter: function(filterName) {
            return this.state.filters.hasOwnProperty(filterName) || (this.state.filters[filterName] = this.nextId(!0)), 
            this.state.filters[filterName];
        },
        ifDefined: function(id, defaultValue) {
            return "ifDefined(" + id + "," + this.escape(defaultValue) + ")";
        },
        plus: function(left, right) {
            return "plus(" + left + "," + right + ")";
        },
        return_: function(id) {
            this.current().body.push("return ", id, ";");
        },
        if_: function(test, alternate, consequent) {
            if (test === !0) alternate(); else {
                var body = this.current().body;
                body.push("if(", test, "){"), alternate(), body.push("}"), consequent && (body.push("else{"), 
                consequent(), body.push("}"));
            }
        },
        not: function(expression) {
            return "!(" + expression + ")";
        },
        notNull: function(expression) {
            return expression + "!=null";
        },
        nonComputedMember: function(left, right) {
            return left + "." + right;
        },
        computedMember: function(left, right) {
            return left + "[" + right + "]";
        },
        member: function(left, right, computed) {
            return computed ? this.computedMember(left, right) : this.nonComputedMember(left, right);
        },
        addEnsureSafeObject: function(item) {
            this.current().body.push(this.ensureSafeObject(item), ";");
        },
        addEnsureSafeMemberName: function(item) {
            this.current().body.push(this.ensureSafeMemberName(item), ";");
        },
        addEnsureSafeFunction: function(item) {
            this.current().body.push(this.ensureSafeFunction(item), ";");
        },
        ensureSafeObject: function(item) {
            return "ensureSafeObject(" + item + ",text)";
        },
        ensureSafeMemberName: function(item) {
            return "ensureSafeMemberName(" + item + ",text)";
        },
        ensureSafeFunction: function(item) {
            return "ensureSafeFunction(" + item + ",text)";
        },
        lazyRecurse: function(ast, intoId, nameId, recursionFn, create, skipWatchIdCheck) {
            var self = this;
            return function() {
                self.recurse(ast, intoId, nameId, recursionFn, create, skipWatchIdCheck);
            };
        },
        lazyAssign: function(id, value) {
            var self = this;
            return function() {
                self.assign(id, value);
            };
        },
        stringEscapeRegex: /[^ a-zA-Z0-9]/g,
        stringEscapeFn: function(c) {
            return "\\u" + ("0000" + c.charCodeAt(0).toString(16)).slice(-4);
        },
        escape: function(value) {
            if (isString(value)) return "'" + value.replace(this.stringEscapeRegex, this.stringEscapeFn) + "'";
            if (isNumber(value)) return value.toString();
            if (value === !0) return "true";
            if (value === !1) return "false";
            if (null === value) return "null";
            if ("undefined" == typeof value) return "undefined";
            throw $parseMinErr("esc", "IMPOSSIBLE");
        },
        nextId: function(skip, init) {
            var id = "v" + this.state.nextId++;
            return skip || this.current().vars.push(id + (init ? "=" + init : "")), id;
        },
        current: function() {
            return this.state[this.state.computing];
        }
    }, ASTInterpreter.prototype = {
        compile: function(expression, expensiveChecks) {
            var self = this, ast = this.astBuilder.ast(expression);
            this.expression = expression, this.expensiveChecks = expensiveChecks, findConstantAndWatchExpressions(ast, self.$filter);
            var assignable, assign;
            (assignable = assignableAST(ast)) && (assign = this.recurse(assignable));
            var inputs, toWatch = getInputs(ast.body);
            toWatch && (inputs = [], forEach(toWatch, function(watch, key) {
                var input = self.recurse(watch);
                watch.input = input, inputs.push(input), watch.watchId = key;
            }));
            var expressions = [];
            forEach(ast.body, function(expression) {
                expressions.push(self.recurse(expression.expression));
            });
            var fn = 0 === ast.body.length ? function() {} : 1 === ast.body.length ? expressions[0] : function(scope, locals) {
                var lastValue;
                return forEach(expressions, function(exp) {
                    lastValue = exp(scope, locals);
                }), lastValue;
            };
            return assign && (fn.assign = function(scope, value, locals) {
                return assign(scope, locals, value);
            }), inputs && (fn.inputs = inputs), fn.literal = isLiteral(ast), fn.constant = isConstant(ast), 
            fn;
        },
        recurse: function(ast, context, create) {
            var left, right, args, self = this;
            if (ast.input) return this.inputs(ast.input, ast.watchId);
            switch (ast.type) {
              case AST.Literal:
                return this.value(ast.value, context);

              case AST.UnaryExpression:
                return right = this.recurse(ast.argument), this["unary" + ast.operator](right, context);

              case AST.BinaryExpression:
                return left = this.recurse(ast.left), right = this.recurse(ast.right), this["binary" + ast.operator](left, right, context);

              case AST.LogicalExpression:
                return left = this.recurse(ast.left), right = this.recurse(ast.right), this["binary" + ast.operator](left, right, context);

              case AST.ConditionalExpression:
                return this["ternary?:"](this.recurse(ast.test), this.recurse(ast.alternate), this.recurse(ast.consequent), context);

              case AST.Identifier:
                return ensureSafeMemberName(ast.name, self.expression), self.identifier(ast.name, self.expensiveChecks || isPossiblyDangerousMemberName(ast.name), context, create, self.expression);

              case AST.MemberExpression:
                return left = this.recurse(ast.object, !1, !!create), ast.computed || (ensureSafeMemberName(ast.property.name, self.expression), 
                right = ast.property.name), ast.computed && (right = this.recurse(ast.property)), 
                ast.computed ? this.computedMember(left, right, context, create, self.expression) : this.nonComputedMember(left, right, self.expensiveChecks, context, create, self.expression);

              case AST.CallExpression:
                return args = [], forEach(ast.arguments, function(expr) {
                    args.push(self.recurse(expr));
                }), ast.filter && (right = this.$filter(ast.callee.name)), ast.filter || (right = this.recurse(ast.callee, !0)), 
                ast.filter ? function(scope, locals, assign, inputs) {
                    for (var values = [], i = 0; i < args.length; ++i) values.push(args[i](scope, locals, assign, inputs));
                    var value = right.apply(undefined, values, inputs);
                    return context ? {
                        context: undefined,
                        name: undefined,
                        value: value
                    } : value;
                } : function(scope, locals, assign, inputs) {
                    var value, rhs = right(scope, locals, assign, inputs);
                    if (null != rhs.value) {
                        ensureSafeObject(rhs.context, self.expression), ensureSafeFunction(rhs.value, self.expression);
                        for (var values = [], i = 0; i < args.length; ++i) values.push(ensureSafeObject(args[i](scope, locals, assign, inputs), self.expression));
                        value = ensureSafeObject(rhs.value.apply(rhs.context, values), self.expression);
                    }
                    return context ? {
                        value: value
                    } : value;
                };

              case AST.AssignmentExpression:
                return left = this.recurse(ast.left, !0, 1), right = this.recurse(ast.right), function(scope, locals, assign, inputs) {
                    var lhs = left(scope, locals, assign, inputs), rhs = right(scope, locals, assign, inputs);
                    return ensureSafeObject(lhs.value, self.expression), lhs.context[lhs.name] = rhs, 
                    context ? {
                        value: rhs
                    } : rhs;
                };

              case AST.ArrayExpression:
                return args = [], forEach(ast.elements, function(expr) {
                    args.push(self.recurse(expr));
                }), function(scope, locals, assign, inputs) {
                    for (var value = [], i = 0; i < args.length; ++i) value.push(args[i](scope, locals, assign, inputs));
                    return context ? {
                        value: value
                    } : value;
                };

              case AST.ObjectExpression:
                return args = [], forEach(ast.properties, function(property) {
                    args.push({
                        key: property.key.type === AST.Identifier ? property.key.name : "" + property.key.value,
                        value: self.recurse(property.value)
                    });
                }), function(scope, locals, assign, inputs) {
                    for (var value = {}, i = 0; i < args.length; ++i) value[args[i].key] = args[i].value(scope, locals, assign, inputs);
                    return context ? {
                        value: value
                    } : value;
                };

              case AST.ThisExpression:
                return function(scope) {
                    return context ? {
                        value: scope
                    } : scope;
                };

              case AST.NGValueParameter:
                return function(scope, locals, assign, inputs) {
                    return context ? {
                        value: assign
                    } : assign;
                };
            }
        },
        "unary+": function(argument, context) {
            return function(scope, locals, assign, inputs) {
                var arg = argument(scope, locals, assign, inputs);
                return arg = isDefined(arg) ? +arg : 0, context ? {
                    value: arg
                } : arg;
            };
        },
        "unary-": function(argument, context) {
            return function(scope, locals, assign, inputs) {
                var arg = argument(scope, locals, assign, inputs);
                return arg = isDefined(arg) ? -arg : 0, context ? {
                    value: arg
                } : arg;
            };
        },
        "unary!": function(argument, context) {
            return function(scope, locals, assign, inputs) {
                var arg = !argument(scope, locals, assign, inputs);
                return context ? {
                    value: arg
                } : arg;
            };
        },
        "binary+": function(left, right, context) {
            return function(scope, locals, assign, inputs) {
                var lhs = left(scope, locals, assign, inputs), rhs = right(scope, locals, assign, inputs), arg = plusFn(lhs, rhs);
                return context ? {
                    value: arg
                } : arg;
            };
        },
        "binary-": function(left, right, context) {
            return function(scope, locals, assign, inputs) {
                var lhs = left(scope, locals, assign, inputs), rhs = right(scope, locals, assign, inputs), arg = (isDefined(lhs) ? lhs : 0) - (isDefined(rhs) ? rhs : 0);
                return context ? {
                    value: arg
                } : arg;
            };
        },
        "binary*": function(left, right, context) {
            return function(scope, locals, assign, inputs) {
                var arg = left(scope, locals, assign, inputs) * right(scope, locals, assign, inputs);
                return context ? {
                    value: arg
                } : arg;
            };
        },
        "binary/": function(left, right, context) {
            return function(scope, locals, assign, inputs) {
                var arg = left(scope, locals, assign, inputs) / right(scope, locals, assign, inputs);
                return context ? {
                    value: arg
                } : arg;
            };
        },
        "binary%": function(left, right, context) {
            return function(scope, locals, assign, inputs) {
                var arg = left(scope, locals, assign, inputs) % right(scope, locals, assign, inputs);
                return context ? {
                    value: arg
                } : arg;
            };
        },
        "binary===": function(left, right, context) {
            return function(scope, locals, assign, inputs) {
                var arg = left(scope, locals, assign, inputs) === right(scope, locals, assign, inputs);
                return context ? {
                    value: arg
                } : arg;
            };
        },
        "binary!==": function(left, right, context) {
            return function(scope, locals, assign, inputs) {
                var arg = left(scope, locals, assign, inputs) !== right(scope, locals, assign, inputs);
                return context ? {
                    value: arg
                } : arg;
            };
        },
        "binary==": function(left, right, context) {
            return function(scope, locals, assign, inputs) {
                var arg = left(scope, locals, assign, inputs) == right(scope, locals, assign, inputs);
                return context ? {
                    value: arg
                } : arg;
            };
        },
        "binary!=": function(left, right, context) {
            return function(scope, locals, assign, inputs) {
                var arg = left(scope, locals, assign, inputs) != right(scope, locals, assign, inputs);
                return context ? {
                    value: arg
                } : arg;
            };
        },
        "binary<": function(left, right, context) {
            return function(scope, locals, assign, inputs) {
                var arg = left(scope, locals, assign, inputs) < right(scope, locals, assign, inputs);
                return context ? {
                    value: arg
                } : arg;
            };
        },
        "binary>": function(left, right, context) {
            return function(scope, locals, assign, inputs) {
                var arg = left(scope, locals, assign, inputs) > right(scope, locals, assign, inputs);
                return context ? {
                    value: arg
                } : arg;
            };
        },
        "binary<=": function(left, right, context) {
            return function(scope, locals, assign, inputs) {
                var arg = left(scope, locals, assign, inputs) <= right(scope, locals, assign, inputs);
                return context ? {
                    value: arg
                } : arg;
            };
        },
        "binary>=": function(left, right, context) {
            return function(scope, locals, assign, inputs) {
                var arg = left(scope, locals, assign, inputs) >= right(scope, locals, assign, inputs);
                return context ? {
                    value: arg
                } : arg;
            };
        },
        "binary&&": function(left, right, context) {
            return function(scope, locals, assign, inputs) {
                var arg = left(scope, locals, assign, inputs) && right(scope, locals, assign, inputs);
                return context ? {
                    value: arg
                } : arg;
            };
        },
        "binary||": function(left, right, context) {
            return function(scope, locals, assign, inputs) {
                var arg = left(scope, locals, assign, inputs) || right(scope, locals, assign, inputs);
                return context ? {
                    value: arg
                } : arg;
            };
        },
        "ternary?:": function(test, alternate, consequent, context) {
            return function(scope, locals, assign, inputs) {
                var arg = test(scope, locals, assign, inputs) ? alternate(scope, locals, assign, inputs) : consequent(scope, locals, assign, inputs);
                return context ? {
                    value: arg
                } : arg;
            };
        },
        value: function(value, context) {
            return function() {
                return context ? {
                    context: undefined,
                    name: undefined,
                    value: value
                } : value;
            };
        },
        identifier: function(name, expensiveChecks, context, create, expression) {
            return function(scope, locals, assign, inputs) {
                var base = locals && name in locals ? locals : scope;
                create && 1 !== create && base && !base[name] && (base[name] = {});
                var value = base ? base[name] : undefined;
                return expensiveChecks && ensureSafeObject(value, expression), context ? {
                    context: base,
                    name: name,
                    value: value
                } : value;
            };
        },
        computedMember: function(left, right, context, create, expression) {
            return function(scope, locals, assign, inputs) {
                var rhs, value, lhs = left(scope, locals, assign, inputs);
                return null != lhs && (rhs = right(scope, locals, assign, inputs), ensureSafeMemberName(rhs, expression), 
                create && 1 !== create && lhs && !lhs[rhs] && (lhs[rhs] = {}), value = lhs[rhs], 
                ensureSafeObject(value, expression)), context ? {
                    context: lhs,
                    name: rhs,
                    value: value
                } : value;
            };
        },
        nonComputedMember: function(left, right, expensiveChecks, context, create, expression) {
            return function(scope, locals, assign, inputs) {
                var lhs = left(scope, locals, assign, inputs);
                create && 1 !== create && lhs && !lhs[right] && (lhs[right] = {});
                var value = null != lhs ? lhs[right] : undefined;
                return (expensiveChecks || isPossiblyDangerousMemberName(right)) && ensureSafeObject(value, expression), 
                context ? {
                    context: lhs,
                    name: right,
                    value: value
                } : value;
            };
        },
        inputs: function(input, watchId) {
            return function(scope, value, locals, inputs) {
                return inputs ? inputs[watchId] : input(scope, value, locals);
            };
        }
    };
    var Parser = function(lexer, $filter, options) {
        this.lexer = lexer, this.$filter = $filter, this.options = options, this.ast = new AST(this.lexer), 
        this.astCompiler = options.csp ? new ASTInterpreter(this.ast, $filter) : new ASTCompiler(this.ast, $filter);
    };
    Parser.prototype = {
        constructor: Parser,
        parse: function(text) {
            return this.astCompiler.compile(text, this.options.expensiveChecks);
        }
    };
    var objectValueOf = (createMap(), createMap(), Object.prototype.valueOf), $sceMinErr = minErr("$sce"), SCE_CONTEXTS = {
        HTML: "html",
        CSS: "css",
        URL: "url",
        RESOURCE_URL: "resourceUrl",
        JS: "js"
    }, $compileMinErr = minErr("$compile"), urlParsingNode = document.createElement("a"), originUrl = urlResolve(window.location.href);
    $$CookieReader.$inject = [ "$document" ], $FilterProvider.$inject = [ "$provide" ], 
    currencyFilter.$inject = [ "$locale" ], numberFilter.$inject = [ "$locale" ];
    var DECIMAL_SEP = ".", DATE_FORMATS = {
        yyyy: dateGetter("FullYear", 4),
        yy: dateGetter("FullYear", 2, 0, !0),
        y: dateGetter("FullYear", 1),
        MMMM: dateStrGetter("Month"),
        MMM: dateStrGetter("Month", !0),
        MM: dateGetter("Month", 2, 1),
        M: dateGetter("Month", 1, 1),
        dd: dateGetter("Date", 2),
        d: dateGetter("Date", 1),
        HH: dateGetter("Hours", 2),
        H: dateGetter("Hours", 1),
        hh: dateGetter("Hours", 2, -12),
        h: dateGetter("Hours", 1, -12),
        mm: dateGetter("Minutes", 2),
        m: dateGetter("Minutes", 1),
        ss: dateGetter("Seconds", 2),
        s: dateGetter("Seconds", 1),
        sss: dateGetter("Milliseconds", 3),
        EEEE: dateStrGetter("Day"),
        EEE: dateStrGetter("Day", !0),
        a: ampmGetter,
        Z: timeZoneGetter,
        ww: weekGetter(2),
        w: weekGetter(1),
        G: eraGetter,
        GG: eraGetter,
        GGG: eraGetter,
        GGGG: longEraGetter
    }, DATE_FORMATS_SPLIT = /((?:[^yMdHhmsaZEwG']+)|(?:'(?:[^']|'')*')|(?:E+|y+|M+|d+|H+|h+|m+|s+|a|Z|G+|w+))(.*)/, NUMBER_STRING = /^\-?\d+$/;
    dateFilter.$inject = [ "$locale" ];
    var lowercaseFilter = valueFn(lowercase), uppercaseFilter = valueFn(uppercase);
    orderByFilter.$inject = [ "$parse" ];
    var htmlAnchorDirective = valueFn({
        restrict: "E",
        compile: function(element, attr) {
            return attr.href || attr.xlinkHref ? void 0 : function(scope, element) {
                if ("a" === element[0].nodeName.toLowerCase()) {
                    var href = "[object SVGAnimatedString]" === toString.call(element.prop("href")) ? "xlink:href" : "href";
                    element.on("click", function(event) {
                        element.attr(href) || event.preventDefault();
                    });
                }
            };
        }
    }), ngAttributeAliasDirectives = {};
    forEach(BOOLEAN_ATTR, function(propName, attrName) {
        function defaultLinkFn(scope, element, attr) {
            scope.$watch(attr[normalized], function(value) {
                attr.$set(attrName, !!value);
            });
        }
        if ("multiple" != propName) {
            var normalized = directiveNormalize("ng-" + attrName), linkFn = defaultLinkFn;
            "checked" === propName && (linkFn = function(scope, element, attr) {
                attr.ngModel !== attr[normalized] && defaultLinkFn(scope, element, attr);
            }), ngAttributeAliasDirectives[normalized] = function() {
                return {
                    restrict: "A",
                    priority: 100,
                    link: linkFn
                };
            };
        }
    }), forEach(ALIASED_ATTR, function(htmlAttr, ngAttr) {
        ngAttributeAliasDirectives[ngAttr] = function() {
            return {
                priority: 100,
                link: function(scope, element, attr) {
                    if ("ngPattern" === ngAttr && "/" == attr.ngPattern.charAt(0)) {
                        var match = attr.ngPattern.match(REGEX_STRING_REGEXP);
                        if (match) return void attr.$set("ngPattern", new RegExp(match[1], match[2]));
                    }
                    scope.$watch(attr[ngAttr], function(value) {
                        attr.$set(ngAttr, value);
                    });
                }
            };
        };
    }), forEach([ "src", "srcset", "href" ], function(attrName) {
        var normalized = directiveNormalize("ng-" + attrName);
        ngAttributeAliasDirectives[normalized] = function() {
            return {
                priority: 99,
                link: function(scope, element, attr) {
                    var propName = attrName, name = attrName;
                    "href" === attrName && "[object SVGAnimatedString]" === toString.call(element.prop("href")) && (name = "xlinkHref", 
                    attr.$attr[name] = "xlink:href", propName = null), attr.$observe(normalized, function(value) {
                        return value ? (attr.$set(name, value), void (msie && propName && element.prop(propName, attr[name]))) : void ("href" === attrName && attr.$set(name, null));
                    });
                }
            };
        };
    });
    var nullFormCtrl = {
        $addControl: noop,
        $$renameControl: nullFormRenameControl,
        $removeControl: noop,
        $setValidity: noop,
        $setDirty: noop,
        $setPristine: noop,
        $setSubmitted: noop
    }, SUBMITTED_CLASS = "ng-submitted";
    FormController.$inject = [ "$element", "$attrs", "$scope", "$animate", "$interpolate" ];
    var formDirectiveFactory = function(isNgForm) {
        return [ "$timeout", function($timeout) {
            var formDirective = {
                name: "form",
                restrict: isNgForm ? "EAC" : "E",
                controller: FormController,
                compile: function(formElement, attr) {
                    formElement.addClass(PRISTINE_CLASS).addClass(VALID_CLASS);
                    var nameAttr = attr.name ? "name" : isNgForm && attr.ngForm ? "ngForm" : !1;
                    return {
                        pre: function(scope, formElement, attr, controller) {
                            if (!("action" in attr)) {
                                var handleFormSubmission = function(event) {
                                    scope.$apply(function() {
                                        controller.$commitViewValue(), controller.$setSubmitted();
                                    }), event.preventDefault();
                                };
                                addEventListenerFn(formElement[0], "submit", handleFormSubmission), formElement.on("$destroy", function() {
                                    $timeout(function() {
                                        removeEventListenerFn(formElement[0], "submit", handleFormSubmission);
                                    }, 0, !1);
                                });
                            }
                            var parentFormCtrl = controller.$$parentForm;
                            nameAttr && (setter(scope, controller.$name, controller, controller.$name), attr.$observe(nameAttr, function(newValue) {
                                controller.$name !== newValue && (setter(scope, controller.$name, undefined, controller.$name), 
                                parentFormCtrl.$$renameControl(controller, newValue), setter(scope, controller.$name, controller, controller.$name));
                            })), formElement.on("$destroy", function() {
                                parentFormCtrl.$removeControl(controller), nameAttr && setter(scope, attr[nameAttr], undefined, controller.$name), 
                                extend(controller, nullFormCtrl);
                            });
                        }
                    };
                }
            };
            return formDirective;
        } ];
    }, formDirective = formDirectiveFactory(), ngFormDirective = formDirectiveFactory(!0), ISO_DATE_REGEXP = /\d{4}-[01]\d-[0-3]\dT[0-2]\d:[0-5]\d:[0-5]\d\.\d+([+-][0-2]\d:[0-5]\d|Z)/, URL_REGEXP = /^(ftp|http|https):\/\/(\w+:{0,1}\w*@)?(\S+)(:[0-9]+)?(\/|\/([\w#!:.?+=&%@!\-\/]))?$/, EMAIL_REGEXP = /^[a-z0-9!#$%&'*+\/=?^_`{|}~.-]+@[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)*$/i, NUMBER_REGEXP = /^\s*(\-|\+)?(\d+|(\d*(\.\d*)))\s*$/, DATE_REGEXP = /^(\d{4})-(\d{2})-(\d{2})$/, DATETIMELOCAL_REGEXP = /^(\d{4})-(\d\d)-(\d\d)T(\d\d):(\d\d)(?::(\d\d)(\.\d{1,3})?)?$/, WEEK_REGEXP = /^(\d{4})-W(\d\d)$/, MONTH_REGEXP = /^(\d{4})-(\d\d)$/, TIME_REGEXP = /^(\d\d):(\d\d)(?::(\d\d)(\.\d{1,3})?)?$/, inputType = {
        text: textInputType,
        date: createDateInputType("date", DATE_REGEXP, createDateParser(DATE_REGEXP, [ "yyyy", "MM", "dd" ]), "yyyy-MM-dd"),
        "datetime-local": createDateInputType("datetimelocal", DATETIMELOCAL_REGEXP, createDateParser(DATETIMELOCAL_REGEXP, [ "yyyy", "MM", "dd", "HH", "mm", "ss", "sss" ]), "yyyy-MM-ddTHH:mm:ss.sss"),
        time: createDateInputType("time", TIME_REGEXP, createDateParser(TIME_REGEXP, [ "HH", "mm", "ss", "sss" ]), "HH:mm:ss.sss"),
        week: createDateInputType("week", WEEK_REGEXP, weekParser, "yyyy-Www"),
        month: createDateInputType("month", MONTH_REGEXP, createDateParser(MONTH_REGEXP, [ "yyyy", "MM" ]), "yyyy-MM"),
        number: numberInputType,
        url: urlInputType,
        email: emailInputType,
        radio: radioInputType,
        checkbox: checkboxInputType,
        hidden: noop,
        button: noop,
        submit: noop,
        reset: noop,
        file: noop
    }, inputDirective = [ "$browser", "$sniffer", "$filter", "$parse", function($browser, $sniffer, $filter, $parse) {
        return {
            restrict: "E",
            require: [ "?ngModel" ],
            link: {
                pre: function(scope, element, attr, ctrls) {
                    ctrls[0] && (inputType[lowercase(attr.type)] || inputType.text)(scope, element, attr, ctrls[0], $sniffer, $browser, $filter, $parse);
                }
            }
        };
    } ], CONSTANT_VALUE_REGEXP = /^(true|false|\d+)$/, ngValueDirective = function() {
        return {
            restrict: "A",
            priority: 100,
            compile: function(tpl, tplAttr) {
                return CONSTANT_VALUE_REGEXP.test(tplAttr.ngValue) ? function(scope, elm, attr) {
                    attr.$set("value", scope.$eval(attr.ngValue));
                } : function(scope, elm, attr) {
                    scope.$watch(attr.ngValue, function(value) {
                        attr.$set("value", value);
                    });
                };
            }
        };
    }, ngBindDirective = [ "$compile", function($compile) {
        return {
            restrict: "AC",
            compile: function(templateElement) {
                return $compile.$$addBindingClass(templateElement), function(scope, element, attr) {
                    $compile.$$addBindingInfo(element, attr.ngBind), element = element[0], scope.$watch(attr.ngBind, function(value) {
                        element.textContent = value === undefined ? "" : value;
                    });
                };
            }
        };
    } ], ngBindTemplateDirective = [ "$interpolate", "$compile", function($interpolate, $compile) {
        return {
            compile: function(templateElement) {
                return $compile.$$addBindingClass(templateElement), function(scope, element, attr) {
                    var interpolateFn = $interpolate(element.attr(attr.$attr.ngBindTemplate));
                    $compile.$$addBindingInfo(element, interpolateFn.expressions), element = element[0], 
                    attr.$observe("ngBindTemplate", function(value) {
                        element.textContent = value === undefined ? "" : value;
                    });
                };
            }
        };
    } ], ngBindHtmlDirective = [ "$sce", "$parse", "$compile", function($sce, $parse, $compile) {
        return {
            restrict: "A",
            compile: function(tElement, tAttrs) {
                var ngBindHtmlGetter = $parse(tAttrs.ngBindHtml), ngBindHtmlWatch = $parse(tAttrs.ngBindHtml, function(value) {
                    return (value || "").toString();
                });
                return $compile.$$addBindingClass(tElement), function(scope, element, attr) {
                    $compile.$$addBindingInfo(element, attr.ngBindHtml), scope.$watch(ngBindHtmlWatch, function() {
                        element.html($sce.getTrustedHtml(ngBindHtmlGetter(scope)) || "");
                    });
                };
            }
        };
    } ], ngChangeDirective = valueFn({
        restrict: "A",
        require: "ngModel",
        link: function(scope, element, attr, ctrl) {
            ctrl.$viewChangeListeners.push(function() {
                scope.$eval(attr.ngChange);
            });
        }
    }), ngClassDirective = classDirective("", !0), ngClassOddDirective = classDirective("Odd", 0), ngClassEvenDirective = classDirective("Even", 1), ngCloakDirective = ngDirective({
        compile: function(element, attr) {
            attr.$set("ngCloak", undefined), element.removeClass("ng-cloak");
        }
    }), ngControllerDirective = [ function() {
        return {
            restrict: "A",
            scope: !0,
            controller: "@",
            priority: 500
        };
    } ], ngEventDirectives = {}, forceAsyncEvents = {
        blur: !0,
        focus: !0
    };
    forEach("click dblclick mousedown mouseup mouseover mouseout mousemove mouseenter mouseleave keydown keyup keypress submit focus blur copy cut paste".split(" "), function(eventName) {
        var directiveName = directiveNormalize("ng-" + eventName);
        ngEventDirectives[directiveName] = [ "$parse", "$rootScope", function($parse, $rootScope) {
            return {
                restrict: "A",
                compile: function($element, attr) {
                    var fn = $parse(attr[directiveName], null, !0);
                    return function(scope, element) {
                        element.on(eventName, function(event) {
                            var callback = function() {
                                fn(scope, {
                                    $event: event
                                });
                            };
                            forceAsyncEvents[eventName] && $rootScope.$$phase ? scope.$evalAsync(callback) : scope.$apply(callback);
                        });
                    };
                }
            };
        } ];
    });
    var ngIfDirective = [ "$animate", function($animate) {
        return {
            multiElement: !0,
            transclude: "element",
            priority: 600,
            terminal: !0,
            restrict: "A",
            $$tlb: !0,
            link: function($scope, $element, $attr, ctrl, $transclude) {
                var block, childScope, previousElements;
                $scope.$watch($attr.ngIf, function(value) {
                    value ? childScope || $transclude(function(clone, newScope) {
                        childScope = newScope, clone[clone.length++] = document.createComment(" end ngIf: " + $attr.ngIf + " "), 
                        block = {
                            clone: clone
                        }, $animate.enter(clone, $element.parent(), $element);
                    }) : (previousElements && (previousElements.remove(), previousElements = null), 
                    childScope && (childScope.$destroy(), childScope = null), block && (previousElements = getBlockNodes(block.clone), 
                    $animate.leave(previousElements).then(function() {
                        previousElements = null;
                    }), block = null));
                });
            }
        };
    } ], ngIncludeDirective = [ "$templateRequest", "$anchorScroll", "$animate", "$sce", function($templateRequest, $anchorScroll, $animate, $sce) {
        return {
            restrict: "ECA",
            priority: 400,
            terminal: !0,
            transclude: "element",
            controller: angular.noop,
            compile: function(element, attr) {
                var srcExp = attr.ngInclude || attr.src, onloadExp = attr.onload || "", autoScrollExp = attr.autoscroll;
                return function(scope, $element, $attr, ctrl, $transclude) {
                    var currentScope, previousElement, currentElement, changeCounter = 0, cleanupLastIncludeContent = function() {
                        previousElement && (previousElement.remove(), previousElement = null), currentScope && (currentScope.$destroy(), 
                        currentScope = null), currentElement && ($animate.leave(currentElement).then(function() {
                            previousElement = null;
                        }), previousElement = currentElement, currentElement = null);
                    };
                    scope.$watch($sce.parseAsResourceUrl(srcExp), function(src) {
                        var afterAnimation = function() {
                            !isDefined(autoScrollExp) || autoScrollExp && !scope.$eval(autoScrollExp) || $anchorScroll();
                        }, thisChangeId = ++changeCounter;
                        src ? ($templateRequest(src, !0).then(function(response) {
                            if (thisChangeId === changeCounter) {
                                var newScope = scope.$new();
                                ctrl.template = response;
                                var clone = $transclude(newScope, function(clone) {
                                    cleanupLastIncludeContent(), $animate.enter(clone, null, $element).then(afterAnimation);
                                });
                                currentScope = newScope, currentElement = clone, currentScope.$emit("$includeContentLoaded", src), 
                                scope.$eval(onloadExp);
                            }
                        }, function() {
                            thisChangeId === changeCounter && (cleanupLastIncludeContent(), scope.$emit("$includeContentError", src));
                        }), scope.$emit("$includeContentRequested", src)) : (cleanupLastIncludeContent(), 
                        ctrl.template = null);
                    });
                };
            }
        };
    } ], ngIncludeFillContentDirective = [ "$compile", function($compile) {
        return {
            restrict: "ECA",
            priority: -400,
            require: "ngInclude",
            link: function(scope, $element, $attr, ctrl) {
                return /SVG/.test($element[0].toString()) ? ($element.empty(), void $compile(jqLiteBuildFragment(ctrl.template, document).childNodes)(scope, function(clone) {
                    $element.append(clone);
                }, {
                    futureParentElement: $element
                })) : ($element.html(ctrl.template), void $compile($element.contents())(scope));
            }
        };
    } ], ngInitDirective = ngDirective({
        priority: 450,
        compile: function() {
            return {
                pre: function(scope, element, attrs) {
                    scope.$eval(attrs.ngInit);
                }
            };
        }
    }), ngListDirective = function() {
        return {
            restrict: "A",
            priority: 100,
            require: "ngModel",
            link: function(scope, element, attr, ctrl) {
                var ngList = element.attr(attr.$attr.ngList) || ", ", trimValues = "false" !== attr.ngTrim, separator = trimValues ? trim(ngList) : ngList, parse = function(viewValue) {
                    if (!isUndefined(viewValue)) {
                        var list = [];
                        return viewValue && forEach(viewValue.split(separator), function(value) {
                            value && list.push(trimValues ? trim(value) : value);
                        }), list;
                    }
                };
                ctrl.$parsers.push(parse), ctrl.$formatters.push(function(value) {
                    return isArray(value) ? value.join(ngList) : undefined;
                }), ctrl.$isEmpty = function(value) {
                    return !value || !value.length;
                };
            }
        };
    }, VALID_CLASS = "ng-valid", INVALID_CLASS = "ng-invalid", PRISTINE_CLASS = "ng-pristine", DIRTY_CLASS = "ng-dirty", UNTOUCHED_CLASS = "ng-untouched", TOUCHED_CLASS = "ng-touched", PENDING_CLASS = "ng-pending", $ngModelMinErr = new minErr("ngModel"), NgModelController = [ "$scope", "$exceptionHandler", "$attrs", "$element", "$parse", "$animate", "$timeout", "$rootScope", "$q", "$interpolate", function($scope, $exceptionHandler, $attr, $element, $parse, $animate, $timeout, $rootScope, $q, $interpolate) {
        this.$viewValue = Number.NaN, this.$modelValue = Number.NaN, this.$$rawModelValue = undefined, 
        this.$validators = {}, this.$asyncValidators = {}, this.$parsers = [], this.$formatters = [], 
        this.$viewChangeListeners = [], this.$untouched = !0, this.$touched = !1, this.$pristine = !0, 
        this.$dirty = !1, this.$valid = !0, this.$invalid = !1, this.$error = {}, this.$$success = {}, 
        this.$pending = undefined, this.$name = $interpolate($attr.name || "", !1)($scope);
        var parserValid, parsedNgModel = $parse($attr.ngModel), parsedNgModelAssign = parsedNgModel.assign, ngModelGet = parsedNgModel, ngModelSet = parsedNgModelAssign, pendingDebounce = null, ctrl = this;
        this.$$setOptions = function(options) {
            if (ctrl.$options = options, options && options.getterSetter) {
                var invokeModelGetter = $parse($attr.ngModel + "()"), invokeModelSetter = $parse($attr.ngModel + "($$$p)");
                ngModelGet = function($scope) {
                    var modelValue = parsedNgModel($scope);
                    return isFunction(modelValue) && (modelValue = invokeModelGetter($scope)), modelValue;
                }, ngModelSet = function($scope, newValue) {
                    isFunction(parsedNgModel($scope)) ? invokeModelSetter($scope, {
                        $$$p: ctrl.$modelValue
                    }) : parsedNgModelAssign($scope, ctrl.$modelValue);
                };
            } else if (!parsedNgModel.assign) throw $ngModelMinErr("nonassign", "Expression '{0}' is non-assignable. Element: {1}", $attr.ngModel, startingTag($element));
        }, this.$render = noop, this.$isEmpty = function(value) {
            return isUndefined(value) || "" === value || null === value || value !== value;
        };
        var parentForm = $element.inheritedData("$formController") || nullFormCtrl, currentValidationRunId = 0;
        addSetValidityMethod({
            ctrl: this,
            $element: $element,
            set: function(object, property) {
                object[property] = !0;
            },
            unset: function(object, property) {
                delete object[property];
            },
            parentForm: parentForm,
            $animate: $animate
        }), this.$setPristine = function() {
            ctrl.$dirty = !1, ctrl.$pristine = !0, $animate.removeClass($element, DIRTY_CLASS), 
            $animate.addClass($element, PRISTINE_CLASS);
        }, this.$setDirty = function() {
            ctrl.$dirty = !0, ctrl.$pristine = !1, $animate.removeClass($element, PRISTINE_CLASS), 
            $animate.addClass($element, DIRTY_CLASS), parentForm.$setDirty();
        }, this.$setUntouched = function() {
            ctrl.$touched = !1, ctrl.$untouched = !0, $animate.setClass($element, UNTOUCHED_CLASS, TOUCHED_CLASS);
        }, this.$setTouched = function() {
            ctrl.$touched = !0, ctrl.$untouched = !1, $animate.setClass($element, TOUCHED_CLASS, UNTOUCHED_CLASS);
        }, this.$rollbackViewValue = function() {
            $timeout.cancel(pendingDebounce), ctrl.$viewValue = ctrl.$$lastCommittedViewValue, 
            ctrl.$render();
        }, this.$validate = function() {
            if (!isNumber(ctrl.$modelValue) || !isNaN(ctrl.$modelValue)) {
                var viewValue = ctrl.$$lastCommittedViewValue, modelValue = ctrl.$$rawModelValue, prevValid = ctrl.$valid, prevModelValue = ctrl.$modelValue, allowInvalid = ctrl.$options && ctrl.$options.allowInvalid;
                ctrl.$$runValidators(modelValue, viewValue, function(allValid) {
                    allowInvalid || prevValid === allValid || (ctrl.$modelValue = allValid ? modelValue : undefined, 
                    ctrl.$modelValue !== prevModelValue && ctrl.$$writeModelToScope());
                });
            }
        }, this.$$runValidators = function(modelValue, viewValue, doneCallback) {
            function processParseErrors() {
                var errorKey = ctrl.$$parserName || "parse";
                return parserValid !== undefined ? (parserValid || (forEach(ctrl.$validators, function(v, name) {
                    setValidity(name, null);
                }), forEach(ctrl.$asyncValidators, function(v, name) {
                    setValidity(name, null);
                })), setValidity(errorKey, parserValid), parserValid) : (setValidity(errorKey, null), 
                !0);
            }
            function processSyncValidators() {
                var syncValidatorsValid = !0;
                return forEach(ctrl.$validators, function(validator, name) {
                    var result = validator(modelValue, viewValue);
                    syncValidatorsValid = syncValidatorsValid && result, setValidity(name, result);
                }), syncValidatorsValid ? !0 : (forEach(ctrl.$asyncValidators, function(v, name) {
                    setValidity(name, null);
                }), !1);
            }
            function processAsyncValidators() {
                var validatorPromises = [], allValid = !0;
                forEach(ctrl.$asyncValidators, function(validator, name) {
                    var promise = validator(modelValue, viewValue);
                    if (!isPromiseLike(promise)) throw $ngModelMinErr("$asyncValidators", "Expected asynchronous validator to return a promise but got '{0}' instead.", promise);
                    setValidity(name, undefined), validatorPromises.push(promise.then(function() {
                        setValidity(name, !0);
                    }, function(error) {
                        allValid = !1, setValidity(name, !1);
                    }));
                }), validatorPromises.length ? $q.all(validatorPromises).then(function() {
                    validationDone(allValid);
                }, noop) : validationDone(!0);
            }
            function setValidity(name, isValid) {
                localValidationRunId === currentValidationRunId && ctrl.$setValidity(name, isValid);
            }
            function validationDone(allValid) {
                localValidationRunId === currentValidationRunId && doneCallback(allValid);
            }
            currentValidationRunId++;
            var localValidationRunId = currentValidationRunId;
            return processParseErrors() && processSyncValidators() ? void processAsyncValidators() : void validationDone(!1);
        }, this.$commitViewValue = function() {
            var viewValue = ctrl.$viewValue;
            $timeout.cancel(pendingDebounce), (ctrl.$$lastCommittedViewValue !== viewValue || "" === viewValue && ctrl.$$hasNativeValidators) && (ctrl.$$lastCommittedViewValue = viewValue, 
            ctrl.$pristine && this.$setDirty(), this.$$parseAndValidate());
        }, this.$$parseAndValidate = function() {
            function writeToModelIfNeeded() {
                ctrl.$modelValue !== prevModelValue && ctrl.$$writeModelToScope();
            }
            var viewValue = ctrl.$$lastCommittedViewValue, modelValue = viewValue;
            if (parserValid = isUndefined(modelValue) ? undefined : !0) for (var i = 0; i < ctrl.$parsers.length; i++) if (modelValue = ctrl.$parsers[i](modelValue), 
            isUndefined(modelValue)) {
                parserValid = !1;
                break;
            }
            isNumber(ctrl.$modelValue) && isNaN(ctrl.$modelValue) && (ctrl.$modelValue = ngModelGet($scope));
            var prevModelValue = ctrl.$modelValue, allowInvalid = ctrl.$options && ctrl.$options.allowInvalid;
            ctrl.$$rawModelValue = modelValue, allowInvalid && (ctrl.$modelValue = modelValue, 
            writeToModelIfNeeded()), ctrl.$$runValidators(modelValue, ctrl.$$lastCommittedViewValue, function(allValid) {
                allowInvalid || (ctrl.$modelValue = allValid ? modelValue : undefined, writeToModelIfNeeded());
            });
        }, this.$$writeModelToScope = function() {
            ngModelSet($scope, ctrl.$modelValue), forEach(ctrl.$viewChangeListeners, function(listener) {
                try {
                    listener();
                } catch (e) {
                    $exceptionHandler(e);
                }
            });
        }, this.$setViewValue = function(value, trigger) {
            ctrl.$viewValue = value, (!ctrl.$options || ctrl.$options.updateOnDefault) && ctrl.$$debounceViewValueCommit(trigger);
        }, this.$$debounceViewValueCommit = function(trigger) {
            var debounce, debounceDelay = 0, options = ctrl.$options;
            options && isDefined(options.debounce) && (debounce = options.debounce, isNumber(debounce) ? debounceDelay = debounce : isNumber(debounce[trigger]) ? debounceDelay = debounce[trigger] : isNumber(debounce["default"]) && (debounceDelay = debounce["default"])), 
            $timeout.cancel(pendingDebounce), debounceDelay ? pendingDebounce = $timeout(function() {
                ctrl.$commitViewValue();
            }, debounceDelay) : $rootScope.$$phase ? ctrl.$commitViewValue() : $scope.$apply(function() {
                ctrl.$commitViewValue();
            });
        }, $scope.$watch(function() {
            var modelValue = ngModelGet($scope);
            if (modelValue !== ctrl.$modelValue && (ctrl.$modelValue === ctrl.$modelValue || modelValue === modelValue)) {
                ctrl.$modelValue = ctrl.$$rawModelValue = modelValue, parserValid = undefined;
                for (var formatters = ctrl.$formatters, idx = formatters.length, viewValue = modelValue; idx--; ) viewValue = formatters[idx](viewValue);
                ctrl.$viewValue !== viewValue && (ctrl.$viewValue = ctrl.$$lastCommittedViewValue = viewValue, 
                ctrl.$render(), ctrl.$$runValidators(modelValue, viewValue, noop));
            }
            return modelValue;
        });
    } ], ngModelDirective = [ "$rootScope", function($rootScope) {
        return {
            restrict: "A",
            require: [ "ngModel", "^?form", "^?ngModelOptions" ],
            controller: NgModelController,
            priority: 1,
            compile: function(element) {
                return element.addClass(PRISTINE_CLASS).addClass(UNTOUCHED_CLASS).addClass(VALID_CLASS), 
                {
                    pre: function(scope, element, attr, ctrls) {
                        var modelCtrl = ctrls[0], formCtrl = ctrls[1] || nullFormCtrl;
                        modelCtrl.$$setOptions(ctrls[2] && ctrls[2].$options), formCtrl.$addControl(modelCtrl), 
                        attr.$observe("name", function(newValue) {
                            modelCtrl.$name !== newValue && formCtrl.$$renameControl(modelCtrl, newValue);
                        }), scope.$on("$destroy", function() {
                            formCtrl.$removeControl(modelCtrl);
                        });
                    },
                    post: function(scope, element, attr, ctrls) {
                        var modelCtrl = ctrls[0];
                        modelCtrl.$options && modelCtrl.$options.updateOn && element.on(modelCtrl.$options.updateOn, function(ev) {
                            modelCtrl.$$debounceViewValueCommit(ev && ev.type);
                        }), element.on("blur", function(ev) {
                            modelCtrl.$touched || ($rootScope.$$phase ? scope.$evalAsync(modelCtrl.$setTouched) : scope.$apply(modelCtrl.$setTouched));
                        });
                    }
                };
            }
        };
    } ], DEFAULT_REGEXP = /(\s+|^)default(\s+|$)/, ngModelOptionsDirective = function() {
        return {
            restrict: "A",
            controller: [ "$scope", "$attrs", function($scope, $attrs) {
                var that = this;
                this.$options = copy($scope.$eval($attrs.ngModelOptions)), this.$options.updateOn !== undefined ? (this.$options.updateOnDefault = !1, 
                this.$options.updateOn = trim(this.$options.updateOn.replace(DEFAULT_REGEXP, function() {
                    return that.$options.updateOnDefault = !0, " ";
                }))) : this.$options.updateOnDefault = !0;
            } ]
        };
    }, ngNonBindableDirective = ngDirective({
        terminal: !0,
        priority: 1e3
    }), ngOptionsMinErr = minErr("ngOptions"), NG_OPTIONS_REGEXP = /^\s*([\s\S]+?)(?:\s+as\s+([\s\S]+?))?(?:\s+group\s+by\s+([\s\S]+?))?(?:\s+disable\s+when\s+([\s\S]+?))?\s+for\s+(?:([\$\w][\$\w]*)|(?:\(\s*([\$\w][\$\w]*)\s*,\s*([\$\w][\$\w]*)\s*\)))\s+in\s+([\s\S]+?)(?:\s+track\s+by\s+([\s\S]+?))?$/, ngOptionsDirective = [ "$compile", "$parse", function($compile, $parse) {
        function parseOptionsExpression(optionsExp, selectElement, scope) {
            function Option(selectValue, viewValue, label, group, disabled) {
                this.selectValue = selectValue, this.viewValue = viewValue, this.label = label, 
                this.group = group, this.disabled = disabled;
            }
            var match = optionsExp.match(NG_OPTIONS_REGEXP);
            if (!match) throw ngOptionsMinErr("iexp", "Expected expression in form of '_select_ (as _label_)? for (_key_,)?_value_ in _collection_' but got '{0}'. Element: {1}", optionsExp, startingTag(selectElement));
            var valueName = match[5] || match[7], keyName = match[6], selectAs = / as /.test(match[0]) && match[1], trackBy = match[9], valueFn = $parse(match[2] ? match[1] : valueName), selectAsFn = selectAs && $parse(selectAs), viewValueFn = selectAsFn || valueFn, trackByFn = trackBy && $parse(trackBy), getTrackByValueFn = trackBy ? function(value, locals) {
                return trackByFn(scope, locals);
            } : function(value) {
                return hashKey(value);
            }, getTrackByValue = function(value, key) {
                return getTrackByValueFn(value, getLocals(value, key));
            }, displayFn = $parse(match[2] || match[1]), groupByFn = $parse(match[3] || ""), disableWhenFn = $parse(match[4] || ""), valuesFn = $parse(match[8]), locals = {}, getLocals = keyName ? function(value, key) {
                return locals[keyName] = key, locals[valueName] = value, locals;
            } : function(value) {
                return locals[valueName] = value, locals;
            };
            return {
                trackBy: trackBy,
                getTrackByValue: getTrackByValue,
                getWatchables: $parse(valuesFn, function(values) {
                    var watchedArray = [];
                    return values = values || [], Object.keys(values).forEach(function(key) {
                        var locals = getLocals(values[key], key), selectValue = getTrackByValueFn(values[key], locals);
                        if (watchedArray.push(selectValue), match[2] || match[1]) {
                            var label = displayFn(scope, locals);
                            watchedArray.push(label);
                        }
                        if (match[4]) {
                            var disableWhen = disableWhenFn(scope, locals);
                            watchedArray.push(disableWhen);
                        }
                    }), watchedArray;
                }),
                getOptions: function() {
                    var optionValuesKeys, optionItems = [], selectValueMap = {}, optionValues = valuesFn(scope) || [];
                    if (!keyName && isArrayLike(optionValues)) optionValuesKeys = optionValues; else {
                        optionValuesKeys = [];
                        for (var itemKey in optionValues) optionValues.hasOwnProperty(itemKey) && "$" !== itemKey.charAt(0) && optionValuesKeys.push(itemKey);
                    }
                    for (var optionValuesLength = optionValuesKeys.length, index = 0; optionValuesLength > index; index++) {
                        var key = optionValues === optionValuesKeys ? index : optionValuesKeys[index], value = optionValues[key], locals = getLocals(value, key), viewValue = viewValueFn(scope, locals), selectValue = getTrackByValueFn(viewValue, locals), label = displayFn(scope, locals), group = groupByFn(scope, locals), disabled = disableWhenFn(scope, locals), optionItem = new Option(selectValue, viewValue, label, group, disabled);
                        optionItems.push(optionItem), selectValueMap[selectValue] = optionItem;
                    }
                    return {
                        items: optionItems,
                        selectValueMap: selectValueMap,
                        getOptionFromViewValue: function(value) {
                            return selectValueMap[getTrackByValue(value)];
                        },
                        getViewValueFromOption: function(option) {
                            return trackBy ? angular.copy(option.viewValue) : option.viewValue;
                        }
                    };
                }
            };
        }
        var optionTemplate = document.createElement("option"), optGroupTemplate = document.createElement("optgroup");
        return {
            restrict: "A",
            terminal: !0,
            require: [ "select", "?ngModel" ],
            link: function(scope, selectElement, attr, ctrls) {
                function updateOptionElement(option, element) {
                    option.element = element, element.disabled = option.disabled, option.value !== element.value && (element.value = option.selectValue), 
                    option.label !== element.label && (element.label = option.label, element.textContent = option.label);
                }
                function addOrReuseElement(parent, current, type, templateElement) {
                    var element;
                    return current && lowercase(current.nodeName) === type ? element = current : (element = templateElement.cloneNode(!1), 
                    current ? parent.insertBefore(element, current) : parent.appendChild(element)), 
                    element;
                }
                function removeExcessElements(current) {
                    for (var next; current; ) next = current.nextSibling, jqLiteRemove(current), current = next;
                }
                function skipEmptyAndUnknownOptions(current) {
                    var emptyOption_ = emptyOption && emptyOption[0], unknownOption_ = unknownOption && unknownOption[0];
                    if (emptyOption_ || unknownOption_) for (;current && (current === emptyOption_ || current === unknownOption_); ) current = current.nextSibling;
                    return current;
                }
                function updateOptions() {
                    var previousValue = options && selectCtrl.readValue();
                    options = ngOptions.getOptions();
                    var groupMap = {}, currentElement = selectElement[0].firstChild;
                    if (providedEmptyOption && selectElement.prepend(emptyOption), currentElement = skipEmptyAndUnknownOptions(currentElement), 
                    options.items.forEach(function(option) {
                        var group, groupElement, optionElement;
                        option.group ? (group = groupMap[option.group], group || (groupElement = addOrReuseElement(selectElement[0], currentElement, "optgroup", optGroupTemplate), 
                        currentElement = groupElement.nextSibling, groupElement.label = option.group, group = groupMap[option.group] = {
                            groupElement: groupElement,
                            currentOptionElement: groupElement.firstChild
                        }), optionElement = addOrReuseElement(group.groupElement, group.currentOptionElement, "option", optionTemplate), 
                        updateOptionElement(option, optionElement), group.currentOptionElement = optionElement.nextSibling) : (optionElement = addOrReuseElement(selectElement[0], currentElement, "option", optionTemplate), 
                        updateOptionElement(option, optionElement), currentElement = optionElement.nextSibling);
                    }), Object.keys(groupMap).forEach(function(key) {
                        removeExcessElements(groupMap[key].currentOptionElement);
                    }), removeExcessElements(currentElement), ngModelCtrl.$render(), !ngModelCtrl.$isEmpty(previousValue)) {
                        var nextValue = selectCtrl.readValue();
                        (ngOptions.trackBy && !equals(previousValue, nextValue) || previousValue !== nextValue) && (ngModelCtrl.$setViewValue(nextValue), 
                        ngModelCtrl.$render());
                    }
                }
                var ngModelCtrl = ctrls[1];
                if (ngModelCtrl) {
                    for (var emptyOption, selectCtrl = ctrls[0], multiple = attr.multiple, i = 0, children = selectElement.children(), ii = children.length; ii > i; i++) if ("" === children[i].value) {
                        emptyOption = children.eq(i);
                        break;
                    }
                    var providedEmptyOption = !!emptyOption, unknownOption = jqLite(optionTemplate.cloneNode(!1));
                    unknownOption.val("?");
                    var options, ngOptions = parseOptionsExpression(attr.ngOptions, selectElement, scope), renderEmptyOption = function() {
                        providedEmptyOption || selectElement.prepend(emptyOption), selectElement.val(""), 
                        emptyOption.prop("selected", !0), emptyOption.attr("selected", !0);
                    }, removeEmptyOption = function() {
                        providedEmptyOption || emptyOption.remove();
                    }, renderUnknownOption = function() {
                        selectElement.prepend(unknownOption), selectElement.val("?"), unknownOption.prop("selected", !0), 
                        unknownOption.attr("selected", !0);
                    }, removeUnknownOption = function() {
                        unknownOption.remove();
                    };
                    multiple ? (ngModelCtrl.$isEmpty = function(value) {
                        return !value || 0 === value.length;
                    }, selectCtrl.writeValue = function(value) {
                        options.items.forEach(function(option) {
                            option.element.selected = !1;
                        }), value && value.forEach(function(item) {
                            var option = options.getOptionFromViewValue(item);
                            option && !option.disabled && (option.element.selected = !0);
                        });
                    }, selectCtrl.readValue = function() {
                        var selectedValues = selectElement.val() || [], selections = [];
                        return forEach(selectedValues, function(value) {
                            var option = options.selectValueMap[value];
                            option.disabled || selections.push(options.getViewValueFromOption(option));
                        }), selections;
                    }, ngOptions.trackBy && scope.$watchCollection(function() {
                        return isArray(ngModelCtrl.$viewValue) ? ngModelCtrl.$viewValue.map(function(value) {
                            return ngOptions.getTrackByValue(value);
                        }) : void 0;
                    }, function() {
                        ngModelCtrl.$render();
                    })) : (selectCtrl.writeValue = function(value) {
                        var option = options.getOptionFromViewValue(value);
                        option && !option.disabled ? selectElement[0].value !== option.selectValue && (removeUnknownOption(), 
                        removeEmptyOption(), selectElement[0].value = option.selectValue, option.element.selected = !0, 
                        option.element.setAttribute("selected", "selected")) : null === value || providedEmptyOption ? (removeUnknownOption(), 
                        renderEmptyOption()) : (removeEmptyOption(), renderUnknownOption());
                    }, selectCtrl.readValue = function() {
                        var selectedOption = options.selectValueMap[selectElement.val()];
                        return selectedOption && !selectedOption.disabled ? (removeEmptyOption(), removeUnknownOption(), 
                        options.getViewValueFromOption(selectedOption)) : null;
                    }, ngOptions.trackBy && scope.$watch(function() {
                        return ngOptions.getTrackByValue(ngModelCtrl.$viewValue);
                    }, function() {
                        ngModelCtrl.$render();
                    })), providedEmptyOption ? (emptyOption.remove(), $compile(emptyOption)(scope), 
                    emptyOption.removeClass("ng-scope")) : emptyOption = jqLite(optionTemplate.cloneNode(!1)), 
                    updateOptions(), scope.$watchCollection(ngOptions.getWatchables, updateOptions);
                }
            }
        };
    } ], ngPluralizeDirective = [ "$locale", "$interpolate", "$log", function($locale, $interpolate, $log) {
        var BRACE = /{}/g, IS_WHEN = /^when(Minus)?(.+)$/;
        return {
            link: function(scope, element, attr) {
                function updateElementText(newText) {
                    element.text(newText || "");
                }
                var lastCount, numberExp = attr.count, whenExp = attr.$attr.when && element.attr(attr.$attr.when), offset = attr.offset || 0, whens = scope.$eval(whenExp) || {}, whensExpFns = {}, startSymbol = $interpolate.startSymbol(), endSymbol = $interpolate.endSymbol(), braceReplacement = startSymbol + numberExp + "-" + offset + endSymbol, watchRemover = angular.noop;
                forEach(attr, function(expression, attributeName) {
                    var tmpMatch = IS_WHEN.exec(attributeName);
                    if (tmpMatch) {
                        var whenKey = (tmpMatch[1] ? "-" : "") + lowercase(tmpMatch[2]);
                        whens[whenKey] = element.attr(attr.$attr[attributeName]);
                    }
                }), forEach(whens, function(expression, key) {
                    whensExpFns[key] = $interpolate(expression.replace(BRACE, braceReplacement));
                }), scope.$watch(numberExp, function(newVal) {
                    var count = parseFloat(newVal), countIsNaN = isNaN(count);
                    if (countIsNaN || count in whens || (count = $locale.pluralCat(count - offset)), 
                    count !== lastCount && !(countIsNaN && isNumber(lastCount) && isNaN(lastCount))) {
                        watchRemover();
                        var whenExpFn = whensExpFns[count];
                        isUndefined(whenExpFn) ? (null != newVal && $log.debug("ngPluralize: no rule defined for '" + count + "' in " + whenExp), 
                        watchRemover = noop, updateElementText()) : watchRemover = scope.$watch(whenExpFn, updateElementText), 
                        lastCount = count;
                    }
                });
            }
        };
    } ], ngRepeatDirective = [ "$parse", "$animate", function($parse, $animate) {
        var NG_REMOVED = "$$NG_REMOVED", ngRepeatMinErr = minErr("ngRepeat"), updateScope = function(scope, index, valueIdentifier, value, keyIdentifier, key, arrayLength) {
            scope[valueIdentifier] = value, keyIdentifier && (scope[keyIdentifier] = key), scope.$index = index, 
            scope.$first = 0 === index, scope.$last = index === arrayLength - 1, scope.$middle = !(scope.$first || scope.$last), 
            scope.$odd = !(scope.$even = 0 === (1 & index));
        }, getBlockStart = function(block) {
            return block.clone[0];
        }, getBlockEnd = function(block) {
            return block.clone[block.clone.length - 1];
        };
        return {
            restrict: "A",
            multiElement: !0,
            transclude: "element",
            priority: 1e3,
            terminal: !0,
            $$tlb: !0,
            compile: function($element, $attr) {
                var expression = $attr.ngRepeat, ngRepeatEndComment = document.createComment(" end ngRepeat: " + expression + " "), match = expression.match(/^\s*([\s\S]+?)\s+in\s+([\s\S]+?)(?:\s+as\s+([\s\S]+?))?(?:\s+track\s+by\s+([\s\S]+?))?\s*$/);
                if (!match) throw ngRepeatMinErr("iexp", "Expected expression in form of '_item_ in _collection_[ track by _id_]' but got '{0}'.", expression);
                var lhs = match[1], rhs = match[2], aliasAs = match[3], trackByExp = match[4];
                if (match = lhs.match(/^(?:(\s*[\$\w]+)|\(\s*([\$\w]+)\s*,\s*([\$\w]+)\s*\))$/), 
                !match) throw ngRepeatMinErr("iidexp", "'_item_' in '_item_ in _collection_' should be an identifier or '(_key_, _value_)' expression, but got '{0}'.", lhs);
                var valueIdentifier = match[3] || match[1], keyIdentifier = match[2];
                if (aliasAs && (!/^[$a-zA-Z_][$a-zA-Z0-9_]*$/.test(aliasAs) || /^(null|undefined|this|\$index|\$first|\$middle|\$last|\$even|\$odd|\$parent|\$root|\$id)$/.test(aliasAs))) throw ngRepeatMinErr("badident", "alias '{0}' is invalid --- must be a valid JS identifier which is not a reserved name.", aliasAs);
                var trackByExpGetter, trackByIdExpFn, trackByIdArrayFn, trackByIdObjFn, hashFnLocals = {
                    $id: hashKey
                };
                return trackByExp ? trackByExpGetter = $parse(trackByExp) : (trackByIdArrayFn = function(key, value) {
                    return hashKey(value);
                }, trackByIdObjFn = function(key) {
                    return key;
                }), function($scope, $element, $attr, ctrl, $transclude) {
                    trackByExpGetter && (trackByIdExpFn = function(key, value, index) {
                        return keyIdentifier && (hashFnLocals[keyIdentifier] = key), hashFnLocals[valueIdentifier] = value, 
                        hashFnLocals.$index = index, trackByExpGetter($scope, hashFnLocals);
                    });
                    var lastBlockMap = createMap();
                    $scope.$watchCollection(rhs, function(collection) {
                        var index, length, nextNode, collectionLength, key, value, trackById, trackByIdFn, collectionKeys, block, nextBlockOrder, elementsToRemove, previousNode = $element[0], nextBlockMap = createMap();
                        if (aliasAs && ($scope[aliasAs] = collection), isArrayLike(collection)) collectionKeys = collection, 
                        trackByIdFn = trackByIdExpFn || trackByIdArrayFn; else {
                            trackByIdFn = trackByIdExpFn || trackByIdObjFn, collectionKeys = [];
                            for (var itemKey in collection) collection.hasOwnProperty(itemKey) && "$" !== itemKey.charAt(0) && collectionKeys.push(itemKey);
                        }
                        for (collectionLength = collectionKeys.length, nextBlockOrder = new Array(collectionLength), 
                        index = 0; collectionLength > index; index++) if (key = collection === collectionKeys ? index : collectionKeys[index], 
                        value = collection[key], trackById = trackByIdFn(key, value, index), lastBlockMap[trackById]) block = lastBlockMap[trackById], 
                        delete lastBlockMap[trackById], nextBlockMap[trackById] = block, nextBlockOrder[index] = block; else {
                            if (nextBlockMap[trackById]) throw forEach(nextBlockOrder, function(block) {
                                block && block.scope && (lastBlockMap[block.id] = block);
                            }), ngRepeatMinErr("dupes", "Duplicates in a repeater are not allowed. Use 'track by' expression to specify unique keys. Repeater: {0}, Duplicate key: {1}, Duplicate value: {2}", expression, trackById, value);
                            nextBlockOrder[index] = {
                                id: trackById,
                                scope: undefined,
                                clone: undefined
                            }, nextBlockMap[trackById] = !0;
                        }
                        for (var blockKey in lastBlockMap) {
                            if (block = lastBlockMap[blockKey], elementsToRemove = getBlockNodes(block.clone), 
                            $animate.leave(elementsToRemove), elementsToRemove[0].parentNode) for (index = 0, 
                            length = elementsToRemove.length; length > index; index++) elementsToRemove[index][NG_REMOVED] = !0;
                            block.scope.$destroy();
                        }
                        for (index = 0; collectionLength > index; index++) if (key = collection === collectionKeys ? index : collectionKeys[index], 
                        value = collection[key], block = nextBlockOrder[index], block.scope) {
                            nextNode = previousNode;
                            do nextNode = nextNode.nextSibling; while (nextNode && nextNode[NG_REMOVED]);
                            getBlockStart(block) != nextNode && $animate.move(getBlockNodes(block.clone), null, jqLite(previousNode)), 
                            previousNode = getBlockEnd(block), updateScope(block.scope, index, valueIdentifier, value, keyIdentifier, key, collectionLength);
                        } else $transclude(function(clone, scope) {
                            block.scope = scope;
                            var endNode = ngRepeatEndComment.cloneNode(!1);
                            clone[clone.length++] = endNode, $animate.enter(clone, null, jqLite(previousNode)), 
                            previousNode = endNode, block.clone = clone, nextBlockMap[block.id] = block, updateScope(block.scope, index, valueIdentifier, value, keyIdentifier, key, collectionLength);
                        });
                        lastBlockMap = nextBlockMap;
                    });
                };
            }
        };
    } ], NG_HIDE_CLASS = "ng-hide", NG_HIDE_IN_PROGRESS_CLASS = "ng-hide-animate", ngShowDirective = [ "$animate", function($animate) {
        return {
            restrict: "A",
            multiElement: !0,
            link: function(scope, element, attr) {
                scope.$watch(attr.ngShow, function(value) {
                    $animate[value ? "removeClass" : "addClass"](element, NG_HIDE_CLASS, {
                        tempClasses: NG_HIDE_IN_PROGRESS_CLASS
                    });
                });
            }
        };
    } ], ngHideDirective = [ "$animate", function($animate) {
        return {
            restrict: "A",
            multiElement: !0,
            link: function(scope, element, attr) {
                scope.$watch(attr.ngHide, function(value) {
                    $animate[value ? "addClass" : "removeClass"](element, NG_HIDE_CLASS, {
                        tempClasses: NG_HIDE_IN_PROGRESS_CLASS
                    });
                });
            }
        };
    } ], ngStyleDirective = ngDirective(function(scope, element, attr) {
        scope.$watch(attr.ngStyle, function(newStyles, oldStyles) {
            oldStyles && newStyles !== oldStyles && forEach(oldStyles, function(val, style) {
                element.css(style, "");
            }), newStyles && element.css(newStyles);
        }, !0);
    }), ngSwitchDirective = [ "$animate", function($animate) {
        return {
            require: "ngSwitch",
            controller: [ "$scope", function() {
                this.cases = {};
            } ],
            link: function(scope, element, attr, ngSwitchController) {
                var watchExpr = attr.ngSwitch || attr.on, selectedTranscludes = [], selectedElements = [], previousLeaveAnimations = [], selectedScopes = [], spliceFactory = function(array, index) {
                    return function() {
                        array.splice(index, 1);
                    };
                };
                scope.$watch(watchExpr, function(value) {
                    var i, ii;
                    for (i = 0, ii = previousLeaveAnimations.length; ii > i; ++i) $animate.cancel(previousLeaveAnimations[i]);
                    for (previousLeaveAnimations.length = 0, i = 0, ii = selectedScopes.length; ii > i; ++i) {
                        var selected = getBlockNodes(selectedElements[i].clone);
                        selectedScopes[i].$destroy();
                        var promise = previousLeaveAnimations[i] = $animate.leave(selected);
                        promise.then(spliceFactory(previousLeaveAnimations, i));
                    }
                    selectedElements.length = 0, selectedScopes.length = 0, (selectedTranscludes = ngSwitchController.cases["!" + value] || ngSwitchController.cases["?"]) && forEach(selectedTranscludes, function(selectedTransclude) {
                        selectedTransclude.transclude(function(caseElement, selectedScope) {
                            selectedScopes.push(selectedScope);
                            var anchor = selectedTransclude.element;
                            caseElement[caseElement.length++] = document.createComment(" end ngSwitchWhen: ");
                            var block = {
                                clone: caseElement
                            };
                            selectedElements.push(block), $animate.enter(caseElement, anchor.parent(), anchor);
                        });
                    });
                });
            }
        };
    } ], ngSwitchWhenDirective = ngDirective({
        transclude: "element",
        priority: 1200,
        require: "^ngSwitch",
        multiElement: !0,
        link: function(scope, element, attrs, ctrl, $transclude) {
            ctrl.cases["!" + attrs.ngSwitchWhen] = ctrl.cases["!" + attrs.ngSwitchWhen] || [], 
            ctrl.cases["!" + attrs.ngSwitchWhen].push({
                transclude: $transclude,
                element: element
            });
        }
    }), ngSwitchDefaultDirective = ngDirective({
        transclude: "element",
        priority: 1200,
        require: "^ngSwitch",
        multiElement: !0,
        link: function(scope, element, attr, ctrl, $transclude) {
            ctrl.cases["?"] = ctrl.cases["?"] || [], ctrl.cases["?"].push({
                transclude: $transclude,
                element: element
            });
        }
    }), ngTranscludeDirective = ngDirective({
        restrict: "EAC",
        link: function($scope, $element, $attrs, controller, $transclude) {
            if (!$transclude) throw minErr("ngTransclude")("orphan", "Illegal use of ngTransclude directive in the template! No parent directive that requires a transclusion found. Element: {0}", startingTag($element));
            $transclude(function(clone) {
                $element.empty(), $element.append(clone);
            });
        }
    }), scriptDirective = [ "$templateCache", function($templateCache) {
        return {
            restrict: "E",
            terminal: !0,
            compile: function(element, attr) {
                if ("text/ng-template" == attr.type) {
                    var templateUrl = attr.id, text = element[0].text;
                    $templateCache.put(templateUrl, text);
                }
            }
        };
    } ], noopNgModelController = {
        $setViewValue: noop,
        $render: noop
    }, SelectController = [ "$element", "$scope", "$attrs", function($element, $scope, $attrs) {
        var self = this, optionsMap = new HashMap();
        self.ngModelCtrl = noopNgModelController, self.unknownOption = jqLite(document.createElement("option")), 
        self.renderUnknownOption = function(val) {
            var unknownVal = "? " + hashKey(val) + " ?";
            self.unknownOption.val(unknownVal), $element.prepend(self.unknownOption), $element.val(unknownVal);
        }, $scope.$on("$destroy", function() {
            self.renderUnknownOption = noop;
        }), self.removeUnknownOption = function() {
            self.unknownOption.parent() && self.unknownOption.remove();
        }, self.readValue = function() {
            return self.removeUnknownOption(), $element.val();
        }, self.writeValue = function(value) {
            self.hasOption(value) ? (self.removeUnknownOption(), $element.val(value), "" === value && self.emptyOption.prop("selected", !0)) : null == value && self.emptyOption ? (self.removeUnknownOption(), 
            $element.val("")) : self.renderUnknownOption(value);
        }, self.addOption = function(value, element) {
            assertNotHasOwnProperty(value, '"option value"'), "" === value && (self.emptyOption = element);
            var count = optionsMap.get(value) || 0;
            optionsMap.put(value, count + 1);
        }, self.removeOption = function(value) {
            var count = optionsMap.get(value);
            count && (1 === count ? (optionsMap.remove(value), "" === value && (self.emptyOption = undefined)) : optionsMap.put(value, count - 1));
        }, self.hasOption = function(value) {
            return !!optionsMap.get(value);
        };
    } ], selectDirective = function() {
        return {
            restrict: "E",
            require: [ "select", "?ngModel" ],
            controller: SelectController,
            link: function(scope, element, attr, ctrls) {
                var ngModelCtrl = ctrls[1];
                if (ngModelCtrl) {
                    var selectCtrl = ctrls[0];
                    if (selectCtrl.ngModelCtrl = ngModelCtrl, ngModelCtrl.$render = function() {
                        selectCtrl.writeValue(ngModelCtrl.$viewValue);
                    }, element.on("change", function() {
                        scope.$apply(function() {
                            ngModelCtrl.$setViewValue(selectCtrl.readValue());
                        });
                    }), attr.multiple) {
                        selectCtrl.readValue = function() {
                            var array = [];
                            return forEach(element.find("option"), function(option) {
                                option.selected && array.push(option.value);
                            }), array;
                        }, selectCtrl.writeValue = function(value) {
                            var items = new HashMap(value);
                            forEach(element.find("option"), function(option) {
                                option.selected = isDefined(items.get(option.value));
                            });
                        };
                        var lastView, lastViewRef = NaN;
                        scope.$watch(function() {
                            lastViewRef !== ngModelCtrl.$viewValue || equals(lastView, ngModelCtrl.$viewValue) || (lastView = shallowCopy(ngModelCtrl.$viewValue), 
                            ngModelCtrl.$render()), lastViewRef = ngModelCtrl.$viewValue;
                        }), ngModelCtrl.$isEmpty = function(value) {
                            return !value || 0 === value.length;
                        };
                    }
                }
            }
        };
    }, optionDirective = [ "$interpolate", function($interpolate) {
        function chromeHack(optionElement) {
            optionElement[0].hasAttribute("selected") && (optionElement[0].selected = !0);
        }
        return {
            restrict: "E",
            priority: 100,
            compile: function(element, attr) {
                if (isUndefined(attr.value)) {
                    var interpolateFn = $interpolate(element.text(), !0);
                    interpolateFn || attr.$set("value", element.text());
                }
                return function(scope, element, attr) {
                    var selectCtrlName = "$selectController", parent = element.parent(), selectCtrl = parent.data(selectCtrlName) || parent.parent().data(selectCtrlName);
                    selectCtrl && selectCtrl.ngModelCtrl && (interpolateFn ? scope.$watch(interpolateFn, function(newVal, oldVal) {
                        attr.$set("value", newVal), oldVal !== newVal && selectCtrl.removeOption(oldVal), 
                        selectCtrl.addOption(newVal, element), selectCtrl.ngModelCtrl.$render(), chromeHack(element);
                    }) : (selectCtrl.addOption(attr.value, element), selectCtrl.ngModelCtrl.$render(), 
                    chromeHack(element)), element.on("$destroy", function() {
                        selectCtrl.removeOption(attr.value), selectCtrl.ngModelCtrl.$render();
                    }));
                };
            }
        };
    } ], styleDirective = valueFn({
        restrict: "E",
        terminal: !1
    }), requiredDirective = function() {
        return {
            restrict: "A",
            require: "?ngModel",
            link: function(scope, elm, attr, ctrl) {
                ctrl && (attr.required = !0, ctrl.$validators.required = function(modelValue, viewValue) {
                    return !attr.required || !ctrl.$isEmpty(viewValue);
                }, attr.$observe("required", function() {
                    ctrl.$validate();
                }));
            }
        };
    }, patternDirective = function() {
        return {
            restrict: "A",
            require: "?ngModel",
            link: function(scope, elm, attr, ctrl) {
                if (ctrl) {
                    var regexp, patternExp = attr.ngPattern || attr.pattern;
                    attr.$observe("pattern", function(regex) {
                        if (isString(regex) && regex.length > 0 && (regex = new RegExp("^" + regex + "$")), 
                        regex && !regex.test) throw minErr("ngPattern")("noregexp", "Expected {0} to be a RegExp but was {1}. Element: {2}", patternExp, regex, startingTag(elm));
                        regexp = regex || undefined, ctrl.$validate();
                    }), ctrl.$validators.pattern = function(value) {
                        return ctrl.$isEmpty(value) || isUndefined(regexp) || regexp.test(value);
                    };
                }
            }
        };
    }, maxlengthDirective = function() {
        return {
            restrict: "A",
            require: "?ngModel",
            link: function(scope, elm, attr, ctrl) {
                if (ctrl) {
                    var maxlength = -1;
                    attr.$observe("maxlength", function(value) {
                        var intVal = toInt(value);
                        maxlength = isNaN(intVal) ? -1 : intVal, ctrl.$validate();
                    }), ctrl.$validators.maxlength = function(modelValue, viewValue) {
                        return 0 > maxlength || ctrl.$isEmpty(viewValue) || viewValue.length <= maxlength;
                    };
                }
            }
        };
    }, minlengthDirective = function() {
        return {
            restrict: "A",
            require: "?ngModel",
            link: function(scope, elm, attr, ctrl) {
                if (ctrl) {
                    var minlength = 0;
                    attr.$observe("minlength", function(value) {
                        minlength = toInt(value) || 0, ctrl.$validate();
                    }), ctrl.$validators.minlength = function(modelValue, viewValue) {
                        return ctrl.$isEmpty(viewValue) || viewValue.length >= minlength;
                    };
                }
            }
        };
    };
    return window.angular.bootstrap ? void console.log("WARNING: Tried to load angular more than once.") : (bindJQuery(), 
    publishExternalAPI(angular), void jqLite(document).ready(function() {
        angularInit(document, bootstrap);
    }));
}(window, document), !window.angular.$$csp() && window.angular.element(document).find("head").prepend('<style type="text/css">@charset "UTF-8";[ng\\:cloak],[ng-cloak],[data-ng-cloak],[x-ng-cloak],.ng-cloak,.x-ng-cloak,.ng-hide:not(.ng-hide-animate){display:none !important;}ng\\:form{display:block;}.ng-animate-shim{visibility:hidden;}.ng-anchor{position:absolute;}</style>'), 
angular.module("ngNewRouter", []).factory("$router", routerFactory).value("$routeParams", {}).provider("$componentLoader", $componentLoaderProvider).provider("$pipeline", pipelineProvider).factory("$$pipeline", privatePipelineFactory).factory("$setupRoutersStep", setupRoutersStepFactory).factory("$initLocalsStep", initLocalsStepFactory).factory("$initControllersStep", initControllersStepFactory).factory("$runCanDeactivateHookStep", runCanDeactivateHookStepFactory).factory("$runCanActivateHookStep", runCanActivateHookStepFactory).factory("$loadTemplatesStep", loadTemplatesStepFactory).value("$activateStep", activateStepValue).directive("ngViewport", ngViewportDirective).directive("ngViewport", ngViewportFillContentDirective).directive("ngLink", ngLinkDirective).directive("a", anchorLinkDirective), 
angular.module("ng").provider("$controllerIntrospector", $controllerIntrospectorProvider).config(controllerProviderDecorator), 
controllerProviderDecorator.$inject = [ "$controllerProvider", "$controllerIntrospectorProvider" ], 
routerFactory.$inject = [ "$$rootRouter", "$rootScope", "$location", "$$grammar", "$controllerIntrospector" ], 
ngViewportDirective.$inject = [ "$animate", "$injector", "$q", "$router" ], ngViewportFillContentDirective.$inject = [ "$compile" ];

var LINK_MICROSYNTAX_RE = /^(.+?)(?:\((.*)\))?$/;

ngLinkDirective.$inject = [ "$router", "$location", "$parse" ], anchorLinkDirective.$inject = [ "$router" ], 
initControllersStepFactory.$inject = [ "$controller", "$componentLoader" ], runCanActivateHookStepFactory.$inject = [ "$injector" ], 
loadTemplatesStepFactory.$inject = [ "$componentLoader", "$templateRequest" ], privatePipelineFactory.$inject = [ "$pipeline" ], 
angular.module("ngNewRouter").factory("$$rootRouter", [ "$q", "$$grammar", "$$pipeline", function($q, $$grammar, $$pipeline) {
    function createClass(ctor, object, staticObject, superClass) {
        return $defineProperty(object, "constructor", {
            value: ctor,
            configurable: !0,
            enumerable: !1,
            writable: !0
        }), arguments.length > 3 ? ("function" == typeof superClass && (ctor.__proto__ = superClass), 
        ctor.prototype = $create(getProtoParent(superClass), getDescriptors(object))) : ctor.prototype = object, 
        $defineProperty(ctor, "prototype", {
            configurable: !1,
            writable: !1
        }), $defineProperties(ctor, getDescriptors(staticObject));
    }
    function getProtoParent(superClass) {
        if ("function" == typeof superClass) {
            var prototype = superClass.prototype;
            if (Object(prototype) === prototype || null === prototype) return superClass.prototype;
            throw new TypeError("super prototype must be an Object or null");
        }
        if (null === superClass) return null;
        throw new TypeError("Super expression must either be null or a function, not " + typeof superClass + ".");
    }
    function getDescriptors(object) {
        for (var descriptors = {}, names = $getOwnPropertyNames(object), i = 0; i < names.length; i++) {
            var name = names[i];
            descriptors[name] = $getOwnPropertyDescriptor(object, name);
        }
        return descriptors;
    }
    function superDescriptor(homeObject, name) {
        var proto = $getPrototypeOf(homeObject);
        do {
            var result = $getOwnPropertyDescriptor(proto, name);
            if (result) return result;
            proto = $getPrototypeOf(proto);
        } while (proto);
        return void 0;
    }
    function superCall(self, homeObject, name, args) {
        return superGet(self, homeObject, name).apply(self, args);
    }
    function superGet(self, homeObject, name) {
        var descriptor = superDescriptor(homeObject, name);
        return descriptor ? descriptor.get ? descriptor.get.call(self) : descriptor.value : void 0;
    }
    function forEach(obj, fn) {
        Object.keys(obj).forEach(function(key) {
            return fn(obj[key], key);
        });
    }
    function mapObjAsync(obj, fn) {
        return $q.all(mapObj(obj, fn));
    }
    function mapObj(obj, fn) {
        var result = [];
        return Object.keys(obj).forEach(function(key) {
            return result.push(fn(obj[key], key));
        }), result;
    }
    function boolToPromise(value) {
        return value ? $q.when(value) : $q.reject();
    }
    var $defineProperty = Object.defineProperty, $defineProperties = Object.defineProperties, $create = Object.create, $getOwnPropertyDescriptor = Object.getOwnPropertyDescriptor, $getOwnPropertyNames = Object.getOwnPropertyNames, $getPrototypeOf = Object.getPrototypeOf, Router = function(grammar, pipeline, parent, name) {
        this.name = name, this.parent = parent || null, this.navigating = !1, this.ports = {}, 
        this.children = {}, this.registry = grammar, this.pipeline = pipeline;
    };
    createClass(Router, {
        childRouter: function() {
            var name = void 0 !== arguments[0] ? arguments[0] : "default";
            return this.children[name] || (this.children[name] = new ChildRouter(this, name)), 
            this.children[name];
        },
        registerViewport: function(view) {
            var name = void 0 !== arguments[1] ? arguments[1] : "default";
            return this.ports[name] = view, this.renavigate();
        },
        config: function(mapping) {
            return this.registry.config(this.name, mapping), this.renavigate();
        },
        navigate: function(url) {
            var $__0 = this;
            if (this.navigating) return $q.when();
            this.lastNavigationAttempt = url;
            var instruction = this.recognize(url);
            return instruction ? (this._startNavigating(), instruction.router = this, this.pipeline.process(instruction).then(function() {
                return $__0._finishNavigating();
            }, function() {
                return $__0._finishNavigating();
            }).then(function() {
                return instruction.canonicalUrl;
            })) : $q.reject();
        },
        _startNavigating: function() {
            this.navigating = !0;
        },
        _finishNavigating: function() {
            this.navigating = !1;
        },
        makeDescendantRouters: function(instruction) {
            this.traverseInstructionSync(instruction, function(instruction, childInstruction) {
                childInstruction.router = instruction.router.childRouter(childInstruction.component);
            });
        },
        traverseInstructionSync: function(instruction, fn) {
            var $__0 = this;
            forEach(instruction.viewports, function(childInstruction, viewportName) {
                return fn(instruction, childInstruction);
            }), forEach(instruction.viewports, function(childInstruction) {
                return $__0.traverseInstructionSync(childInstruction, fn);
            });
        },
        traverseInstruction: function(instruction, fn) {
            return instruction ? mapObjAsync(instruction.viewports, function(childInstruction, viewportName) {
                return boolToPromise(fn(childInstruction, viewportName));
            }).then(function() {
                return mapObjAsync(instruction.viewports, function(childInstruction, viewportName) {
                    return childInstruction.router.traverseInstruction(childInstruction, fn);
                });
            }) : $q.when();
        },
        activatePorts: function(instruction) {
            return this.queryViewports(function(port, name) {
                return port.activate(instruction.viewports[name]);
            }).then(function() {
                return mapObjAsync(instruction.viewports, function(instruction) {
                    return instruction.router.activatePorts(instruction);
                });
            });
        },
        canDeactivatePorts: function(instruction) {
            return this.traversePorts(function(port, name) {
                return boolToPromise(port.canDeactivate(instruction.viewports[name]));
            });
        },
        traversePorts: function(fn) {
            var $__0 = this;
            return this.queryViewports(fn).then(function() {
                return mapObjAsync($__0.children, function(child) {
                    return child.traversePorts(fn);
                });
            });
        },
        queryViewports: function(fn) {
            return mapObjAsync(this.ports, fn);
        },
        recognize: function(url) {
            return this.registry.recognize(url);
        },
        renavigate: function() {
            var renavigateDestination = this.previousUrl || this.lastNavigationAttempt;
            return !this.navigating && renavigateDestination ? this.navigate(renavigateDestination) : $q.when();
        },
        generate: function(name, params) {
            return this.registry.generate(name, params);
        }
    }, {}), Object.defineProperty(Router, "parameters", {
        get: function() {
            return [ [ Grammar ], [ Pipeline ], [], [] ];
        }
    }), Object.defineProperty(Router.prototype.generate, "parameters", {
        get: function() {
            return [ [ $traceurRuntime.type.string ], [] ];
        }
    });
    var RootRouter = function(grammar, pipeline) {
        superCall(this, $RootRouter.prototype, "constructor", [ grammar, pipeline, null, "/" ]);
    }, $RootRouter = RootRouter;
    createClass(RootRouter, {}, {}, Router), Object.defineProperty(RootRouter, "parameters", {
        get: function() {
            return [ [ Grammar ], [ Pipeline ] ];
        }
    });
    var ChildRouter = function(parent, name) {
        superCall(this, $ChildRouter.prototype, "constructor", [ parent.registry, parent.pipeline, parent, name ]), 
        this.parent = parent;
    }, $ChildRouter = ChildRouter;
    return createClass(ChildRouter, {}, {}, Router), new RootRouter($$grammar, $$pipeline);
} ]), angular.module("ngNewRouter").factory("$$grammar", [ "$q", function($q) {
    function createClass(ctor, object, staticObject, superClass) {
        return $defineProperty(object, "constructor", {
            value: ctor,
            configurable: !0,
            enumerable: !1,
            writable: !0
        }), arguments.length > 3 ? ("function" == typeof superClass && (ctor.__proto__ = superClass), 
        ctor.prototype = $create(getProtoParent(superClass), getDescriptors(object))) : ctor.prototype = object, 
        $defineProperty(ctor, "prototype", {
            configurable: !1,
            writable: !1
        }), $defineProperties(ctor, getDescriptors(staticObject));
    }
    function getProtoParent(superClass) {
        if ("function" == typeof superClass) {
            var prototype = superClass.prototype;
            if (Object(prototype) === prototype || null === prototype) return superClass.prototype;
            throw new TypeError("super prototype must be an Object or null");
        }
        if (null === superClass) return null;
        throw new TypeError("Super expression must either be null or a function, not " + typeof superClass + ".");
    }
    function getDescriptors(object) {
        for (var descriptors = {}, names = $getOwnPropertyNames(object), i = 0; i < names.length; i++) {
            var name = names[i];
            descriptors[name] = $getOwnPropertyDescriptor(object, name);
        }
        return descriptors;
    }
    function copy(obj) {
        return JSON.parse(JSON.stringify(obj));
    }
    function forEach(obj, fn) {
        Object.keys(obj).forEach(function(key) {
            return fn(obj[key], key);
        });
    }
    function mapObj(obj, fn) {
        var result = [];
        return Object.keys(obj).forEach(function(key) {
            return result.push(fn(obj[key], key));
        }), result;
    }
    var $defineProperty = Object.defineProperty, $defineProperties = Object.defineProperties, $create = Object.create, $getOwnPropertyDescriptor = Object.getOwnPropertyDescriptor, $getOwnPropertyNames = Object.getOwnPropertyNames, RouteRecognizer = (Object.getPrototypeOf, 
    function() {
        function isArray(test) {
            return "[object Array]" === Object.prototype.toString.call(test);
        }
        function StaticSegment(string) {
            this.string = string;
        }
        function DynamicSegment(name) {
            this.name = name;
        }
        function StarSegment(name) {
            this.name = name;
        }
        function EpsilonSegment() {}
        function parse(route, names, types) {
            "/" === route.charAt(0) && (route = route.substr(1));
            for (var segments = route.split("/"), results = [], i = 0, l = segments.length; l > i; i++) {
                var match, segment = segments[i];
                (match = segment.match(/^:([^\/]+)$/)) ? (results.push(new DynamicSegment(match[1])), 
                names.push(match[1]), types.dynamics++) : (match = segment.match(/^\*([^\/]+)$/)) ? (results.push(new StarSegment(match[1])), 
                names.push(match[1]), types.stars++) : "" === segment ? results.push(new EpsilonSegment()) : (results.push(new StaticSegment(segment)), 
                types.statics++);
            }
            return results;
        }
        function State(charSpec) {
            this.charSpec = charSpec, this.nextStates = [];
        }
        function sortSolutions(states) {
            return states.sort(function(a, b) {
                if (a.types.stars !== b.types.stars) return a.types.stars - b.types.stars;
                if (a.types.stars) {
                    if (a.types.statics !== b.types.statics) return b.types.statics - a.types.statics;
                    if (a.types.dynamics !== b.types.dynamics) return b.types.dynamics - a.types.dynamics;
                }
                return a.types.dynamics !== b.types.dynamics ? a.types.dynamics - b.types.dynamics : a.types.statics !== b.types.statics ? b.types.statics - a.types.statics : 0;
            });
        }
        function recognizeChar(states, ch) {
            for (var nextStates = [], i = 0, l = states.length; l > i; i++) {
                var state = states[i];
                nextStates = nextStates.concat(state.match(ch));
            }
            return nextStates;
        }
        function RecognizeResults(queryParams) {
            this.queryParams = queryParams || {};
        }
        function findHandler(state, path, queryParams) {
            for (var handlers = state.handlers, regex = state.regex, captures = path.match(regex), currentCapture = 1, result = new RecognizeResults(queryParams), i = 0, l = handlers.length; l > i; i++) {
                for (var handler = handlers[i], names = handler.names, params = {}, j = 0, m = names.length; m > j; j++) params[names[j]] = captures[currentCapture++];
                result.push({
                    handler: handler.handler,
                    params: params,
                    isDynamic: !!names.length
                });
            }
            return result;
        }
        function addSegment(currentState, segment) {
            return segment.eachChar(function(ch) {
                currentState = currentState.put(ch);
            }), currentState;
        }
        var map = function() {
            function Target(path, matcher, delegate) {
                this.path = path, this.matcher = matcher, this.delegate = delegate;
            }
            function Matcher(target) {
                this.routes = {}, this.children = {}, this.target = target;
            }
            function generateMatch(startingPath, matcher, delegate) {
                return function(path, nestedCallback) {
                    var fullPath = startingPath + path;
                    return nestedCallback ? void nestedCallback(generateMatch(fullPath, matcher, delegate)) : new Target(startingPath + path, matcher, delegate);
                };
            }
            function addRoute(routeArray, path, handler) {
                for (var len = 0, i = 0, l = routeArray.length; l > i; i++) len += routeArray[i].path.length;
                path = path.substr(len);
                var route = {
                    path: path,
                    handler: handler
                };
                routeArray.push(route);
            }
            function eachRoute(baseRoute, matcher, callback, binding) {
                var routes = matcher.routes;
                for (var path in routes) if (routes.hasOwnProperty(path)) {
                    var routeArray = baseRoute.slice();
                    addRoute(routeArray, path, routes[path]), matcher.children[path] ? eachRoute(routeArray, matcher.children[path], callback, binding) : callback.call(binding, routeArray);
                }
            }
            return Target.prototype = {
                to: function(target, callback) {
                    var delegate = this.delegate;
                    if (delegate && delegate.willAddRoute && (target = delegate.willAddRoute(this.matcher.target, target)), 
                    this.matcher.add(this.path, target), callback) {
                        if (0 === callback.length) throw new Error("You must have an argument in the function passed to `to`");
                        this.matcher.addChild(this.path, target, callback, this.delegate);
                    }
                    return this;
                }
            }, Matcher.prototype = {
                add: function(path, handler) {
                    this.routes[path] = handler;
                },
                addChild: function(path, target, callback, delegate) {
                    var matcher = new Matcher(target);
                    this.children[path] = matcher;
                    var match = generateMatch(path, matcher, delegate);
                    delegate && delegate.contextEntered && delegate.contextEntered(target, match), callback(match);
                }
            }, function(callback, addRouteCallback) {
                var matcher = new Matcher();
                callback(generateMatch("", matcher, this.delegate)), eachRoute([], matcher, function(route) {
                    addRouteCallback ? addRouteCallback(this, route) : this.add(route);
                }, this);
            };
        }(), specials = [ "/", ".", "*", "+", "?", "|", "(", ")", "[", "]", "{", "}", "\\" ], escapeRegex = new RegExp("(\\" + specials.join("|\\") + ")", "g");
        StaticSegment.prototype = {
            eachChar: function(callback) {
                for (var ch, string = this.string, i = 0, l = string.length; l > i; i++) ch = string.charAt(i), 
                callback({
                    validChars: ch
                });
            },
            regex: function() {
                return this.string.replace(escapeRegex, "\\$1");
            },
            generate: function() {
                return this.string;
            }
        }, DynamicSegment.prototype = {
            eachChar: function(callback) {
                callback({
                    invalidChars: "/",
                    repeat: !0
                });
            },
            regex: function() {
                return "([^/]+)";
            },
            generate: function(params) {
                return params[this.name];
            }
        }, StarSegment.prototype = {
            eachChar: function(callback) {
                callback({
                    invalidChars: "",
                    repeat: !0
                });
            },
            regex: function() {
                return "(.+)";
            },
            generate: function(params) {
                return params[this.name];
            }
        }, EpsilonSegment.prototype = {
            eachChar: function() {},
            regex: function() {
                return "";
            },
            generate: function() {
                return "";
            }
        }, State.prototype = {
            get: function(charSpec) {
                for (var nextStates = this.nextStates, i = 0, l = nextStates.length; l > i; i++) {
                    var child = nextStates[i], isEqual = child.charSpec.validChars === charSpec.validChars;
                    if (isEqual = isEqual && child.charSpec.invalidChars === charSpec.invalidChars) return child;
                }
            },
            put: function(charSpec) {
                var state;
                return (state = this.get(charSpec)) ? state : (state = new State(charSpec), this.nextStates.push(state), 
                charSpec.repeat && state.nextStates.push(state), state);
            },
            match: function(ch) {
                for (var child, charSpec, chars, nextStates = this.nextStates, returned = [], i = 0, l = nextStates.length; l > i; i++) child = nextStates[i], 
                charSpec = child.charSpec, "undefined" != typeof (chars = charSpec.validChars) ? -1 !== chars.indexOf(ch) && returned.push(child) : "undefined" != typeof (chars = charSpec.invalidChars) && -1 === chars.indexOf(ch) && returned.push(child);
                return returned;
            }
        };
        var oCreate = Object.create || function(proto) {
            function F() {}
            return F.prototype = proto, new F();
        };
        RecognizeResults.prototype = oCreate({
            splice: Array.prototype.splice,
            slice: Array.prototype.slice,
            push: Array.prototype.push,
            length: 0,
            queryParams: null
        });
        var RouteRecognizer = function() {
            this.rootState = new State(), this.names = {};
        };
        return RouteRecognizer.prototype = {
            add: function(routes, options) {
                for (var name, currentState = this.rootState, regex = "^", types = {
                    statics: 0,
                    dynamics: 0,
                    stars: 0
                }, handlers = [], allSegments = [], isEmpty = !0, i = 0, l = routes.length; l > i; i++) {
                    var route = routes[i], names = [], segments = parse(route.path, names, types);
                    allSegments = allSegments.concat(segments);
                    for (var j = 0, m = segments.length; m > j; j++) {
                        var segment = segments[j];
                        segment instanceof EpsilonSegment || (isEmpty = !1, currentState = currentState.put({
                            validChars: "/"
                        }), regex += "/", currentState = addSegment(currentState, segment), regex += segment.regex());
                    }
                    var handler = {
                        handler: route.handler,
                        names: names
                    };
                    handlers.push(handler);
                }
                isEmpty && (currentState = currentState.put({
                    validChars: "/"
                }), regex += "/"), currentState.handlers = handlers, currentState.regex = new RegExp(regex + "$"), 
                currentState.types = types, (name = options && options.as) && (this.names[name] = {
                    segments: allSegments,
                    handlers: handlers
                });
            },
            handlersFor: function(name) {
                var route = this.names[name], result = [];
                if (!route) throw new Error("There is no route named " + name);
                for (var i = 0, l = route.handlers.length; l > i; i++) result.push(route.handlers[i]);
                return result;
            },
            hasRoute: function(name) {
                return !!this.names[name];
            },
            generate: function(name, params) {
                var route = this.names[name], output = "";
                if (!route) throw new Error("There is no route named " + name);
                for (var segments = route.segments, i = 0, l = segments.length; l > i; i++) {
                    var segment = segments[i];
                    segment instanceof EpsilonSegment || (output += "/", output += segment.generate(params));
                }
                return "/" !== output.charAt(0) && (output = "/" + output), params && params.queryParams && (output += this.generateQueryString(params.queryParams, route.handlers)), 
                output;
            },
            generateQueryString: function(params, handlers) {
                var pairs = [], keys = [];
                for (var key in params) params.hasOwnProperty(key) && keys.push(key);
                keys.sort();
                for (var i = 0, len = keys.length; len > i; i++) {
                    key = keys[i];
                    var value = params[key];
                    if (null != value) {
                        var pair = encodeURIComponent(key);
                        if (isArray(value)) for (var j = 0, l = value.length; l > j; j++) {
                            var arrayPair = key + "[]=" + encodeURIComponent(value[j]);
                            pairs.push(arrayPair);
                        } else pair += "=" + encodeURIComponent(value), pairs.push(pair);
                    }
                }
                return 0 === pairs.length ? "" : "?" + pairs.join("&");
            },
            parseQueryString: function(queryString) {
                for (var pairs = queryString.split("&"), queryParams = {}, i = 0; i < pairs.length; i++) {
                    var value, pair = pairs[i].split("="), key = decodeURIComponent(pair[0]), keyLength = key.length, isArray = !1;
                    1 === pair.length ? value = "true" : (keyLength > 2 && "[]" === key.slice(keyLength - 2) && (isArray = !0, 
                    key = key.slice(0, keyLength - 2), queryParams[key] || (queryParams[key] = [])), 
                    value = pair[1] ? decodeURIComponent(pair[1]) : ""), isArray ? queryParams[key].push(value) : queryParams[key] = value;
                }
                return queryParams;
            },
            recognize: function(path) {
                var pathLen, i, l, queryStart, states = [ this.rootState ], queryParams = {}, isSlashDropped = !1;
                if (queryStart = path.indexOf("?"), -1 !== queryStart) {
                    var queryString = path.substr(queryStart + 1, path.length);
                    path = path.substr(0, queryStart), queryParams = this.parseQueryString(queryString);
                }
                for (path = decodeURI(path), "/" !== path.charAt(0) && (path = "/" + path), pathLen = path.length, 
                pathLen > 1 && "/" === path.charAt(pathLen - 1) && (path = path.substr(0, pathLen - 1), 
                isSlashDropped = !0), i = 0, l = path.length; l > i && (states = recognizeChar(states, path.charAt(i)), 
                states.length); i++) ;
                var solutions = [];
                for (i = 0, l = states.length; l > i; i++) states[i].handlers && solutions.push(states[i]);
                states = sortSolutions(solutions);
                var state = solutions[0];
                return state && state.handlers ? (isSlashDropped && "(.+)$" === state.regex.source.slice(-5) && (path += "/"), 
                findHandler(state, path, queryParams)) : void 0;
            }
        }, RouteRecognizer.prototype.map = map, RouteRecognizer.VERSION = "VERSION_STRING_PLACEHOLDER", 
        RouteRecognizer;
    }()), CHILD_ROUTE_SUFFIX = "/*childRoute", Grammar = function() {
        this.rules = {};
    };
    createClass(Grammar, {
        config: function(name, config) {
            "app" === name && (name = "/"), this.rules[name] || (this.rules[name] = new CanonicalRecognizer(name)), 
            this.rules[name].config(config);
        },
        recognize: function(url) {
            var componentName = void 0 !== arguments[1] ? arguments[1] : "/", $__0 = this;
            if ("undefined" != typeof url) {
                var componentRecognizer = this.rules[componentName];
                if (componentRecognizer) {
                    var context = componentRecognizer.recognize(url);
                    if (context) {
                        var lastContextChunk = context[context.length - 1], lastHandler = lastContextChunk.handler, lastParams = lastContextChunk.params, instruction = {
                            viewports: {},
                            params: lastParams
                        };
                        if (lastParams && lastParams.childRoute) {
                            var childUrl = "/" + lastParams.childRoute;
                            instruction.canonicalUrl = lastHandler.rewroteUrl.substr(0, lastHandler.rewroteUrl.length - (lastParams.childRoute.length + 1)), 
                            forEach(lastHandler.components, function(componentName, viewportName) {
                                instruction.viewports[viewportName] = $__0.recognize(childUrl, componentName);
                            }), instruction.canonicalUrl += instruction.viewports[Object.keys(instruction.viewports)[0]].canonicalUrl;
                        } else instruction.canonicalUrl = lastHandler.rewroteUrl, forEach(lastHandler.components, function(componentName, viewportName) {
                            instruction.viewports[viewportName] = {
                                viewports: {}
                            };
                        });
                        return forEach(instruction.viewports, function(instruction, componentName) {
                            instruction.component = lastHandler.components[componentName], instruction.params = lastParams;
                        }), instruction;
                    }
                }
            }
        },
        generate: function(name, params) {
            var solution, path = "";
            do {
                if (solution = null, forEach(this.rules, function(recognizer) {
                    recognizer.hasRoute(name) && (path = recognizer.generate(name, params) + path, solution = recognizer);
                }), !solution) return "";
                name = solution.name;
            } while ("/" !== solution.name);
            return path;
        }
    }, {}), Object.defineProperty(Grammar.prototype.recognize, "parameters", {
        get: function() {
            return [ [ $traceurRuntime.type.string ], [] ];
        }
    });
    var CanonicalRecognizer = function(name) {
        this.name = name, this.rewrites = {}, this.recognizer = new RouteRecognizer();
    };
    return createClass(CanonicalRecognizer, {
        config: function(mapping) {
            var $__0 = this;
            mapping instanceof Array ? mapping.forEach(function(nav) {
                return $__0.configOne(nav);
            }) : this.configOne(mapping);
        },
        getCanonicalUrl: function(url) {
            return "." === url[0] && (url = url.substr(1)), ("" === url || "/" !== url[0]) && (url = "/" + url), 
            forEach(this.rewrites, function(toUrl, fromUrl) {
                "/" === fromUrl ? "/" === url && (url = toUrl) : 0 === url.indexOf(fromUrl) && (url = url.replace(fromUrl, toUrl));
            }), url;
        },
        configOne: function(mapping) {
            var $__0 = this;
            if (mapping.redirectTo) {
                if (this.rewrites[mapping.path]) throw new Error('"' + mapping.path + '" already maps to "' + this.rewrites[mapping.path] + '"');
                return void (this.rewrites[mapping.path] = mapping.redirectTo);
            }
            if (mapping.component) {
                if (mapping.components) throw new Error('A route config should have either a "component" or "components" property, but not both.');
                mapping.components = mapping.component, delete mapping.component;
            }
            "string" == typeof mapping.components && (mapping.components = {
                "default": mapping.components
            });
            var aliases;
            mapping.as ? aliases = [ mapping.as ] : (aliases = mapObj(mapping.components, function(componentName, viewportName) {
                return viewportName + ":" + componentName;
            }), mapping.components["default"] && aliases.push(mapping.components["default"])), 
            aliases.forEach(function(alias) {
                return $__0.recognizer.add([ {
                    path: mapping.path,
                    handler: mapping
                } ], {
                    as: alias
                });
            });
            var withChild = copy(mapping);
            withChild.path += CHILD_ROUTE_SUFFIX, this.recognizer.add([ {
                path: withChild.path,
                handler: withChild
            } ]);
        },
        recognize: function(url) {
            var canonicalUrl = this.getCanonicalUrl(url), context = this.recognizer.recognize(canonicalUrl);
            return context && (context[0].handler.rewroteUrl = canonicalUrl), context;
        },
        generate: function(name, params) {
            return this.recognizer.generate(name, params);
        },
        hasRoute: function(name) {
            return this.recognizer.hasRoute(name);
        }
    }, {}), new Grammar();
} ]), function(window, angular, undefined) {
    function isValidDottedPath(path) {
        return null != path && "" !== path && "hasOwnProperty" !== path && MEMBER_NAME_REGEX.test("." + path);
    }
    function lookupDottedPath(obj, path) {
        if (!isValidDottedPath(path)) throw $resourceMinErr("badmember", 'Dotted member path "@{0}" is invalid.', path);
        for (var keys = path.split("."), i = 0, ii = keys.length; ii > i && obj !== undefined; i++) {
            var key = keys[i];
            obj = null !== obj ? obj[key] : undefined;
        }
        return obj;
    }
    function shallowClearAndCopy(src, dst) {
        dst = dst || {}, angular.forEach(dst, function(value, key) {
            delete dst[key];
        });
        for (var key in src) !src.hasOwnProperty(key) || "$" === key.charAt(0) && "$" === key.charAt(1) || (dst[key] = src[key]);
        return dst;
    }
    var $resourceMinErr = angular.$$minErr("$resource"), MEMBER_NAME_REGEX = /^(\.[a-zA-Z_$@][0-9a-zA-Z_$@]*)+$/;
    angular.module("ngResource", [ "ng" ]).provider("$resource", function() {
        var provider = this;
        this.defaults = {
            stripTrailingSlashes: !0,
            actions: {
                get: {
                    method: "GET"
                },
                save: {
                    method: "POST"
                },
                query: {
                    method: "GET",
                    isArray: !0
                },
                remove: {
                    method: "DELETE"
                },
                "delete": {
                    method: "DELETE"
                }
            }
        }, this.$get = [ "$http", "$q", function($http, $q) {
            function encodeUriSegment(val) {
                return encodeUriQuery(val, !0).replace(/%26/gi, "&").replace(/%3D/gi, "=").replace(/%2B/gi, "+");
            }
            function encodeUriQuery(val, pctEncodeSpaces) {
                return encodeURIComponent(val).replace(/%40/gi, "@").replace(/%3A/gi, ":").replace(/%24/g, "$").replace(/%2C/gi, ",").replace(/%20/g, pctEncodeSpaces ? "%20" : "+");
            }
            function Route(template, defaults) {
                this.template = template, this.defaults = extend({}, provider.defaults, defaults), 
                this.urlParams = {};
            }
            function resourceFactory(url, paramDefaults, actions, options) {
                function extractParams(data, actionParams) {
                    var ids = {};
                    return actionParams = extend({}, paramDefaults, actionParams), forEach(actionParams, function(value, key) {
                        isFunction(value) && (value = value()), ids[key] = value && value.charAt && "@" == value.charAt(0) ? lookupDottedPath(data, value.substr(1)) : value;
                    }), ids;
                }
                function defaultResponseInterceptor(response) {
                    return response.resource;
                }
                function Resource(value) {
                    shallowClearAndCopy(value || {}, this);
                }
                var route = new Route(url, options);
                return actions = extend({}, provider.defaults.actions, actions), Resource.prototype.toJSON = function() {
                    var data = extend({}, this);
                    return delete data.$promise, delete data.$resolved, data;
                }, forEach(actions, function(action, name) {
                    var hasBody = /^(POST|PUT|PATCH)$/i.test(action.method);
                    Resource[name] = function(a1, a2, a3, a4) {
                        var data, success, error, params = {};
                        switch (arguments.length) {
                          case 4:
                            error = a4, success = a3;

                          case 3:
                          case 2:
                            if (!isFunction(a2)) {
                                params = a1, data = a2, success = a3;
                                break;
                            }
                            if (isFunction(a1)) {
                                success = a1, error = a2;
                                break;
                            }
                            success = a2, error = a3;

                          case 1:
                            isFunction(a1) ? success = a1 : hasBody ? data = a1 : params = a1;
                            break;

                          case 0:
                            break;

                          default:
                            throw $resourceMinErr("badargs", "Expected up to 4 arguments [params, data, success, error], got {0} arguments", arguments.length);
                        }
                        var isInstanceCall = this instanceof Resource, value = isInstanceCall ? data : action.isArray ? [] : new Resource(data), httpConfig = {}, responseInterceptor = action.interceptor && action.interceptor.response || defaultResponseInterceptor, responseErrorInterceptor = action.interceptor && action.interceptor.responseError || undefined;
                        forEach(action, function(value, key) {
                            "params" != key && "isArray" != key && "interceptor" != key && (httpConfig[key] = copy(value));
                        }), hasBody && (httpConfig.data = data), route.setUrlParams(httpConfig, extend({}, extractParams(data, action.params || {}), params), action.url);
                        var promise = $http(httpConfig).then(function(response) {
                            var data = response.data, promise = value.$promise;
                            if (data) {
                                if (angular.isArray(data) !== !!action.isArray) throw $resourceMinErr("badcfg", "Error in resource configuration for action `{0}`. Expected response to contain an {1} but got an {2} (Request: {3} {4})", name, action.isArray ? "array" : "object", angular.isArray(data) ? "array" : "object", httpConfig.method, httpConfig.url);
                                action.isArray ? (value.length = 0, forEach(data, function(item) {
                                    "object" == typeof item ? value.push(new Resource(item)) : value.push(item);
                                })) : (shallowClearAndCopy(data, value), value.$promise = promise);
                            }
                            return value.$resolved = !0, response.resource = value, response;
                        }, function(response) {
                            return value.$resolved = !0, (error || noop)(response), $q.reject(response);
                        });
                        return promise = promise.then(function(response) {
                            var value = responseInterceptor(response);
                            return (success || noop)(value, response.headers), value;
                        }, responseErrorInterceptor), isInstanceCall ? promise : (value.$promise = promise, 
                        value.$resolved = !1, value);
                    }, Resource.prototype["$" + name] = function(params, success, error) {
                        isFunction(params) && (error = success, success = params, params = {});
                        var result = Resource[name].call(this, params, this, success, error);
                        return result.$promise || result;
                    };
                }), Resource.bind = function(additionalParamDefaults) {
                    return resourceFactory(url, extend({}, paramDefaults, additionalParamDefaults), actions);
                }, Resource;
            }
            var noop = angular.noop, forEach = angular.forEach, extend = angular.extend, copy = angular.copy, isFunction = angular.isFunction;
            return Route.prototype = {
                setUrlParams: function(config, params, actionUrl) {
                    var val, encodedVal, self = this, url = actionUrl || self.template, urlParams = self.urlParams = {};
                    forEach(url.split(/\W/), function(param) {
                        if ("hasOwnProperty" === param) throw $resourceMinErr("badname", "hasOwnProperty is not a valid parameter name.");
                        !new RegExp("^\\d+$").test(param) && param && new RegExp("(^|[^\\\\]):" + param + "(\\W|$)").test(url) && (urlParams[param] = !0);
                    }), url = url.replace(/\\:/g, ":"), params = params || {}, forEach(self.urlParams, function(_, urlParam) {
                        val = params.hasOwnProperty(urlParam) ? params[urlParam] : self.defaults[urlParam], 
                        angular.isDefined(val) && null !== val ? (encodedVal = encodeUriSegment(val), url = url.replace(new RegExp(":" + urlParam + "(\\W|$)", "g"), function(match, p1) {
                            return encodedVal + p1;
                        })) : url = url.replace(new RegExp("(/?):" + urlParam + "(\\W|$)", "g"), function(match, leadingSlashes, tail) {
                            return "/" == tail.charAt(0) ? tail : leadingSlashes + tail;
                        });
                    }), self.defaults.stripTrailingSlashes && (url = url.replace(/\/+$/, "") || "/"), 
                    url = url.replace(/\/\.(?=\w+($|\?))/, "."), config.url = url.replace(/\/\\\./, "/."), 
                    forEach(params, function(value, key) {
                        self.urlParams[key] || (config.params = config.params || {}, config.params[key] = value);
                    });
                }
            }, resourceFactory;
        } ];
    });
}(window, window.angular);