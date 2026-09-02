(function (window, document) {
    "use strict";
 
    var Format =
        window.FormatUtils;
 
    var Schema =
        window.TheoreticalOpeningSchema;
 
    if (!Format) {
        throw new Error(
            "TheoreticalOpeningRenderers requires FormatUtils."
        );
    }
 
    if (!Schema) {
        throw new Error(
            "TheoreticalOpeningRenderers requires TheoreticalOpeningSchema."
        );
    }
 
    function getLabels(config) {
        return (
            config &&
            config.labels
                ? config.labels
                : {}
        );
    }
 
    function getMobileLabels(config) {
        var labels =
            getLabels(config);
 
        return (
            labels.mobile ||
            {}
        );
    }
 
    function escapeHtml(value) {
        if (
            typeof Format.escapeHtml ===
            "function"
        ) {
            return Format.escapeHtml(
                value == null
                    ? ""
                    : value
            );
        }
 
        return String(
            value == null
                ? ""
                : value
        )
            .replace(
                /&/g,
                "&amp;"
            )
            .replace(
                /</g,
                "&lt;"
            )
            .replace(
                />/g,
                "&gt;"
            )
            .replace(
                /"/g,
                "&quot;"
            )
            .replace(
                /'/g,
                "&#039;"
            );
    }
 
    function sanitizeLabel(value) {
        if (
            typeof Format.sanitizeLabel ===
            "function"
        ) {
            return Format.sanitizeLabel(
                value || ""
            );
        }
 
        return value || "";
    }
 
    function valueOrDash(value) {
        if (
            typeof Format.valueOrDashOnAuction ===
            "function"
        ) {
            return Format.valueOrDashOnAuction(
                value
            );
        }
 
        if (
            typeof Format.valueOrDash ===
            "function"
        ) {
            return Format.valueOrDash(
                value
            );
        }
 
        return (
            value === null ||
            value === undefined ||
            value === ""
        )
            ? "-"
            : value;
    }
 
    function getCompanyName(row) {
        return (
            row.companyName ||
            row.company ||
            row.name ||
            row.acrynomName ||
            "-"
        );
    }
 
    function getCompanyCode(row) {
        return (
            row.companyCode ||
            row.companySymbol ||
            row.symbol ||
            row.companyRef ||
            ""
        );
    }
 
    function getCompanyUrl(row) {
        return (
            row.companyUrl ||
            row.companyURL ||
            row.url ||
            "#"
        );
    }
 
    function getSectorName(row) {
        return (
            row.sectorName ||
            row.sector ||
            ""
        );
    }
 
    function renderCompanyLink(
        row,
        multiline
    ) {
        var name =
            getCompanyName(row);
 
        var code =
            getCompanyCode(row);
 
        var url =
            getCompanyUrl(row);
 
        var html =
            '<a class="ellipsis" href="' +
            escapeHtml(url) +
            '">' +
            escapeHtml(name) +
            "</a>";
 
        if (
            multiline &&
            code
        ) {
            html +=
                "<br />" +
                escapeHtml(code);
        }
 
        return html;
    }
 
    var helpers = {
        renderCompanyLink:
            renderCompanyLink,
 
        valueOrDash:
            valueOrDash
    };
 
    function shouldShowColumn(
        column,
        state
    ) {
        if (!column.group) {
            return true;
        }
 
        if (
            !state ||
            !state.columnVisibility
        ) {
            return true;
        }
 
        return (
            state.columnVisibility[
                column.group
            ] !== false
        );
    }
 
    function buildDataTableColumn(
        column
    ) {
        return {
            data:
                column.data,
 
            width:
                column.width,
 
            className:
                column.className,
 
            orderable:
                column.orderable !== false,
 
            render:
                function (
                    data,
                    type,
                    row
                ) {
                    if (
                        typeof column.render ===
                        "function"
                    ) {
                        return column.render(
                            row,
                            helpers,
                            type
                        );
                    }
 
                    if (
                        type &&
                        type !== "display"
                    ) {
                        return data == null
                            ? ""
                            : data;
                    }
 
                    return escapeHtml(
                        valueOrDash(data)
                    );
                }
        };
    }
 
    function buildCardField(
        column,
        row,
        state,
        config
    ) {
        var value;
 
        if (!column.mobile) {
            return "";
        }
 
        if (
            !shouldShowColumn(
                column,
                state
            )
        ) {
            return "";
        }
 
        if (
            typeof column.render ===
            "function"
        ) {
            value =
                column.render(
                    row,
                    helpers,
                    "display"
                );
        } else {
            value =
                row[column.data];
        }
 
        var formattedValue =
            value === null ||
            value === undefined ||
            value === ""
                ? "-"
                : value;
 
        return (
            '<div class="mobile-field-cell" data-field="' +
            escapeHtml(
                column.group ||
                column.key ||
                ""
            ) +
            '">' +
 
                "<label>" +
                    escapeHtml(
                        sanitizeLabel(
                            column.label ||
                            column.key ||
                            ""
                        )
                    ) +
                "</label>" +
 
                "<label>" +
                    (
                        column.isHtml
                            ? formattedValue
                            : escapeHtml(
                                  formattedValue
                              )
                    ) +
                "</label>" +
 
            "</div>"
        );
    }
 
    function buildMobileGroupedFields(
        columns,
        row,
        state,
        config
    ) {
        var groupedColumns = {};
        var groupOrder = [];
 
        columns.forEach(
            function (column) {
                var groupKey;
 
                if (!column.mobile) {
                    return;
                }
 
                if (
                    !shouldShowColumn(
                        column,
                        state
                    )
                ) {
                    return;
                }
 
                groupKey =
                    column.group ||
                    column.key;
 
                if (
                    !groupedColumns[
                        groupKey
                    ]
                ) {
                    groupedColumns[
                        groupKey
                    ] = {
                        label:
                            column.groupLabel ||
                            "",
 
                        columns:
                            []
                    };
 
                    groupOrder.push(
                        groupKey
                    );
                }
 
                groupedColumns[
                    groupKey
                ].columns.push(
                    column
                );
            }
        );
 
        return groupOrder
            .map(
                function (groupKey) {
                    var group =
                        groupedColumns[
                            groupKey
                        ];
 
                    return (
                        '<div class="mobile-field-group">' +
 
                            (
                                group.label
                                    ? (
                                        '<p class="mobile-field-group-title">' +
                                            escapeHtml(
                                                sanitizeLabel(
                                                    group.label
                                                )
                                            ) +
                                        "</p>"
                                    )
                                    : ""
                            ) +
 
                            '<div class="mobile-field-grid">' +
 
                                group.columns
                                    .map(
                                        function (
                                            column
                                        ) {
                                            return buildCardField(
                                                column,
                                                row,
                                                state,
                                                config
                                            );
                                        }
                                    )
                                    .join("") +
 
                            "</div>" +
 
                        "</div>"
                    );
                }
            )
            .join("");
    }
    function buildCard(
            row,
            state,
            config
        ) {
            var view =
                state.activeView ||
                "1";
     
            var columns =
                Schema.getViewColumns(
                    config,
                    view
                );
     
            var companyCode =
                getCompanyCode(row);
     
            var companyName =
                getCompanyName(row);
     
            var companyUrl =
                getCompanyUrl(row);
     
            return (
                '<div class="company-wrapper">' +
     
                    '<div class="company-card-box" data-company-card>' +
     
                        '<div class="company-main" data-card-toggle>' +
     
                            '<div class="company-name-value">' +
     
                                '<label class="stock-number">' +
                                    escapeHtml(
                                        companyCode
                                    ) +
                                "</label>" +
     
                                '<a href="' +
                                    escapeHtml(
                                        companyUrl
                                    ) +
                                '" class="stock-name-link">' +
                                    escapeHtml(
                                        companyName
                                    ) +
                                "</a>" +
     
                            "</div>" +
     
                            '<div class="company-market-value">' +
     
                                '<label class="current-market-value">' +
                                    escapeHtml(
                                        valueOrDash(
                                            getPrimaryValue(
                                                row
                                            )
                                        )
                                    ) +
                                "</label>" +
     
                                '<label class="current-market-percent">' +
                                    escapeHtml(
                                        valueOrDash(
                                            getSecondaryValue(
                                                row
                                            )
                                        )
                                    ) +
                                "</label>" +
     
                            "</div>" +
     
                        "</div>" +
     
                        '<div class="company-extra company-market-value">' +
     
                            buildMobileGroupedFields(
                                columns,
                                row,
                                state,
                                config
                            ) +
     
                        "</div>" +
     
                    "</div>" +
     
                "</div>"
            );
        }
     
        function getPrimaryValue(row) {
            if (
                row.theoreticalOpeningPrice !==
                undefined
            ) {
                return row.theoreticalOpeningPrice;
            }
     
            if (
                row.theoreticalPrice !==
                undefined
            ) {
                return row.theoreticalPrice;
            }
     
            if (
                row.top !==
                undefined
            ) {
                return row.top;
            }
     
            return null;
        }
     
        function getSecondaryValue(row) {
            if (
                row.theoreticalOpeningVolume !==
                undefined
            ) {
                return row.theoreticalOpeningVolume;
            }
     
            if (
                row.theoreticalVolume !==
                undefined
            ) {
                return row.theoreticalVolume;
            }
     
            if (
                row.tov !==
                undefined
            ) {
                return row.tov;
            }
     
            return null;
        }
     
        function groupBySector(rows) {
            return rows.reduce(
                function (
                    result,
                    row
                ) {
                    var sectorName =
                        getSectorName(row) ||
                        "Other";
     
                    if (
                        !result[
                            sectorName
                        ]
                    ) {
                        result[
                            sectorName
                        ] = [];
                    }
     
                    result[
                        sectorName
                    ].push(
                        row
                    );
     
                    return result;
                },
                {}
            );
        }
     
        window.TheoreticalOpeningRenderers = {
            getTableColumns:
                function (
                    view,
                    state,
                    config
                ) {
                    return Schema
                        .getViewColumns(
                            config,
                            view
                        )
                        .map(
                            buildDataTableColumn
                        );
                },
     
            getTableOptions:
                function (
                    view,
                    state,
                    config
                ) {
                    return {
                        rowGroup: {
                            dataSrc:
                                "sectorName"
                        },
     
                        ordering:
                            false,
     
                        searching:
                            false,
     
                        paging:
                            false,
     
                        info:
                            false,
     
                        autoWidth:
                            false,
     
                        responsive:
                            false,
     
                        deferRender:
                            true
                    };
                },
     
            afterTableInit:
                function (
                    target,
                    instance,
                    state,
                    config
                ) {
                    // Reserved for shared PageViewManager lifecycle.
                },
     
            afterTableRefresh:
                function (
                    target,
                    instance,
                    state,
                    config
                ) {
                    // Reserved for shared PageViewManager lifecycle.
                },
     
            afterAdjust:
                function (
                    instance,
                    state,
                    config
                ) {
                    // Reserved for shared PageViewManager lifecycle.
                },
     
            afterMobileRender:
                function (
                    container,
                    state,
                    config
                ) {
                    // Reserved for shared PageViewManager lifecycle.
                },
     
            renderMobile:
                function (
                    rows,
                    state,
                    config
                ) {
                    var labels =
                        getLabels(config);
     
                    var mobileLabels =
                        getMobileLabels(config);
     
                    if (
                        !Array.isArray(rows) ||
                        !rows.length
                    ) {
                        return (
                            '<div class="datatable-for-mobile d-block d-md-none p-0">' +
     
                                '<div class="empty-state">' +
                                    escapeHtml(
                                        labels.noData ||
                                        "No data available"
                                    ) +
                                "</div>" +
     
                            "</div>"
                        );
                    }
     
                    var grouped =
                        groupBySector(
                            rows
                        );
     
                    var html =
                        '<div class="datatable-for-mobile d-block d-md-none p-0">' +
     
                            '<div class="list-view-section">' +
     
                                '<div class="list-view-top-section">' +
     
                                    "<h5>" +
                                        escapeHtml(
                                            mobileLabels.symbolCompany ||
                                            "Symbol & Company"
                                        ) +
                                    "</h5>" +
     
                                    "<h5>" +
                                        escapeHtml(
                                            mobileLabels.priceVolume ||
                                            mobileLabels.priceChange ||
                                            "TOP / TOV"
                                        ) +
                                    "</h5>" +
     
                                "</div>" +
     
                            "</div>" +
     
                            '<div class="mw-stock-list">';
     
                    Object.keys(
                        grouped
                    ).forEach(
                        function (
                            sectorName
                        ) {
                            html +=
                                '<label class="sector-title">' +
                                    escapeHtml(
                                        sectorName
                                    ) +
                                "</label>";
     
                            grouped[
                                sectorName
                            ].forEach(
                                function (row) {
                                    html +=
                                        buildCard(
                                            row,
                                            state,
                                            config
                                        );
                                }
                            );
                        }
                    );
     
                    html +=
                            "</div>" +
                        "</div>";
     
                    return html;
                },
     
 onMobileClick:
            function (
                event,
                els
            ) {
                if (
                    event.target.closest(
                        ".form-control-shell"
                    )
                ) {
                    return;
                }
 
                if (
                    event.target.closest(
                        ".form-popover"
                    )
                ) {
                    return;
                }
 
                var toggle =
                    event.target.closest(
                        "[data-card-toggle]"
                    );
 
                if (!toggle) {
                    return;
                }
 
                var card =
                    toggle.closest(
                        "[data-company-card]"
                    );
 
                if (
                    !card ||
                    !els.mobileContainer
                ) {
                    return;
                }
 
                els.mobileContainer
                    .querySelectorAll(
                        ".company-card-box.active"
                    )
                    .forEach(
                        function (item) {
                            if (
                                item !==
                                card
                            ) {
                                item.classList.remove(
                                    "active"
                                );
                            }
                        }
                    );
 
                card.classList.toggle(
                    "active"
                );
            }
    };
 
})(window, document);