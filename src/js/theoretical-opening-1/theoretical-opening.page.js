(function (window, document) {
    "use strict";
 
    if (document.readyState === "loading") {
        document.addEventListener(
            "DOMContentLoaded",
            initializePage
        );
    } else {
        initializePage();
    }
 
    function initializePage() {
        validateDependencies();
 
        initializeModule(
            window.TheoreticalOpeningConfig,
            "TheoreticalOpeningManager",
            "TheoreticalOpeningSelectBinding"
        );
 
        initializeModule(
            window.NomuTheoreticalOpeningConfig,
            "NomuTheoreticalOpeningManager",
            "NomuTheoreticalOpeningSelectBinding"
        );
    }
 
    function validateDependencies() {
        if (!window.PageViewManager) {
            throw new Error(
                "PageViewManager is required."
            );
        }
 
        if (!window.TheoreticalOpeningSchema) {
            throw new Error(
                "TheoreticalOpeningSchema is required."
            );
        }
 
        if (!window.TheoreticalOpeningRenderers) {
            throw new Error(
                "TheoreticalOpeningRenderers is required."
            );
        }
    }
 
    function initializeModule(
        baseConfig,
        managerGlobalName,
        bindingGlobalName
    ) {
        if (!baseConfig) {
            return;
        }
 
        var selectors =
            normalizeSelectors(
                baseConfig.selectors || {}
            );
 
        var views =
            baseConfig.views || {};
 
        var managerConfig =
            Object.assign(
                {},
                baseConfig,
                {
                    selectors:
                        selectors,
 
                    endpoint:
                        resolveEndpoint(
                            baseConfig
                        ),
 
                    initialView:
                        resolveInitialView(
                            baseConfig,
                            views
                        ),
 
                    mobileMaxWidth:
                        resolveMobileMaxWidth(
                            baseConfig
                        ),
 
                    viewTargets:
                        resolveViewTargets(
                            baseConfig,
                            selectors,
                            views
                        ),
 
                    columnVisibility:
                        Object.assign(
                            {},
                            window.TheoreticalOpeningSchema
                                .getColumnGroups(
                                    baseConfig
                                ),
                            baseConfig.columnGroups ||
                                {}
                        ),
 
                    defaultColumnVisibility:
                        Object.assign(
                            {},
                            window.TheoreticalOpeningSchema
                                .getColumnGroups(
                                    baseConfig
                                ),
                            baseConfig.columnGroups ||
                                {}
                        ),
 
                    columnGroupsByView:
                        window.TheoreticalOpeningSchema
                            .getColumnGroupsByView(
                                baseConfig
                            ),
 
                    getRequestData:
                        function (state) {
                            return resolveRequestData(
                                baseConfig,
                                selectors,
                                state
                            );
                        }
                }
            );
 
        if (!managerConfig.endpoint) {
            console.error(
                "[TheoreticalOpening] Endpoint is missing.",
                baseConfig
            );
 
            return;
        }
 
        if (
            !document.querySelector(
                selectors.table
            )
        ) {
            console.error(
                "[TheoreticalOpening] Table was not found:",
                selectors.table
            );
 
            return;
        }
 
        destroyExistingManager(
            managerGlobalName
        );
 
        var manager;
 
        try {
            manager =
                window.PageViewManager
                    .create({
                        config:
                            managerConfig,
 
                        renderers:
                            window.TheoreticalOpeningRenderers
                    })
                    .init();
        } catch (error) {
            console.error(
                "[TheoreticalOpening] Failed to initialize module:",
                error
            );
 
            return;
        }
 
        window[managerGlobalName] =
            manager;
 
        bindCustomSelect(
            manager,
            selectors,
            bindingGlobalName
        );
    }
 
    function normalizeSelectors(selectors) {
        return Object.assign(
            {},
            selectors,
            {
                sectorInput:
                    selectors.sectorInput ||
                    selectors.sector ||
                    "#sectorsList",
 
                sector:
                    selectors.sector ||
                    selectors.sectorInput ||
                    "#sectorsList",
 
                table:
                    selectors.table ||
                    "#theoreticalTableId",
 
                desktopView:
                    selectors.desktopView ||
                    "#theoreticalDesktopView",
 
                mobileView:
                    selectors.mobileView ||
                    "#theoreticalMobileView",
 
                mobileContainer:
                    selectors.mobileContainer ||
                    selectors.cardsContainer ||
                    selectors.mobileView ||
                    "#theoreticalMobileView",
 
                cardsContainer:
                    selectors.cardsContainer ||
                    selectors.mobileContainer ||
                    selectors.mobileView ||
                    "#theoreticalMobileView"
            }
        );
    }
 
    function resolveEndpoint(config) {
        if (config.endpoint) {
            return config.endpoint;
        }
 
        if (!config.endpoints) {
            return null;
        }
 
        return (
            config.endpoints.theoreticalOpening ||
            config.endpoints.data ||
            null
        );
    }
 
    function resolveInitialView(
        config,
        views
    ) {
        return (
            config.initialView ||
            views.defaultView ||
            "1"
        );
    }
 
    function resolveMobileMaxWidth(config) {
        return (
            config.mobileMaxWidth ||
            (
                config.breakpoints &&
                config.breakpoints.mobileMaxWidth
            ) ||
            767.98
        );
    }
 
    function resolveViewTargets(
        config,
        selectors,
        views
    ) {
        if (
            config.viewTargets &&
            Object.keys(
                config.viewTargets
            ).length
        ) {
            return config.viewTargets;
        }
 
        if (
            views.targets &&
            Object.keys(
                views.targets
            ).length
        ) {
            return views.targets;
        }
 
        return {
            "1":
                selectors.table
        };
    }
 
    function resolveRequestData(
        config,
        selectors,
        state
    ) {
        if (
            typeof config.getRequestData ===
            "function"
        ) {
            var configuredData =
                config.getRequestData(
                    state
                );
 
            if (
                configuredData &&
                typeof configuredData ===
                "object"
            ) {
                return configuredData;
            }
        }
 
        var sectorInput =
            document.querySelector(
                selectors.sectorInput
            );
 
        return {
            sector:
                sectorInput &&
                sectorInput.value
                    ? sectorInput.value
                    : "All",
 
            requestLocale:
                config.locale || ""
        };
    }
 
    function destroyExistingManager(
        managerGlobalName
    ) {
        var existingManager =
            window[managerGlobalName];
 
        if (
            existingManager &&
            typeof existingManager.destroy ===
            "function"
        ) {
            existingManager.destroy();
        }
 
        window[managerGlobalName] =
            null;
    }
 
    function bindCustomSelect(
        manager,
        selectors,
        bindingGlobalName
    ) {
        if (!manager) {
            return;
        }
 
        var existingBinding =
            window[bindingGlobalName];
 
        if (
            existingBinding &&
            typeof existingBinding.destroy ===
            "function"
        ) {
            existingBinding.destroy();
        }
 
        var sectorInput =
            document.querySelector(
                selectors.sectorInput
            );
 
        if (!sectorInput) {
            console.warn(
                "[TheoreticalOpening] Sector input was not found:",
                selectors.sectorInput
            );
 
            return;
        }
 
        var lastSector =
            getSectorValue(
                sectorInput
            );
 
        function refreshWhenChanged() {
            var currentSector =
                getSectorValue(
                    sectorInput
                );
 
            if (
                currentSector ===
                lastSector
            ) {
                return;
            }
 
            lastSector =
                currentSector;
 
            if (
                typeof manager.refresh ===
                "function"
            ) {
                manager.refresh();
            }
        }
 
        function handleDocumentClick(event) {
            var option =
                event.target.closest
                    ? event.target.closest(
                        ".form-select-option"
                    )
                    : null;
 
            if (!option) {
                return;
            }
 
            var field =
                option.closest(
                    '[data-field="sectorParameter"]'
                );
 
            if (!field) {
                return;
            }
 
            var input =
                field.querySelector(
                    'input[type="hidden"]'
                );
 
            if (
                input !==
                sectorInput
            ) {
                return;
            }
 
            /*
             * Allow select-utils.js to update the hidden
             * input before checking its new value.
             */
            window.setTimeout(
                refreshWhenChanged,
                0
            );
        }
 
        sectorInput.addEventListener(
            "change",
            refreshWhenChanged
        );
 
        document.addEventListener(
            "click",
            handleDocumentClick
        );
 
        window[bindingGlobalName] = {
            destroy:
                function () {
                    sectorInput.removeEventListener(
                        "change",
                        refreshWhenChanged
                    );
 
                    document.removeEventListener(
                        "click",
                        handleDocumentClick
                    );
                }
        };
    }
 
    function getSectorValue(input) {
        if (
            !input ||
            !input.value
        ) {
            return "All";
        }
 
        return input.value;
    }
})(window, document);