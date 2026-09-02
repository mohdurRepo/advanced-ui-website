(function (window) {
    "use strict";
 
    if (!window.FormatUtils) {
        throw new Error(
            "TheoreticalOpeningSchema requires FormatUtils."
        );
    }
 
    var Format =
        window.FormatUtils;
 
    function getLabels(config) {
        var labels =
            config && config.labels
                ? config.labels
                : {};
 
        return labels.table || labels;
    }
 
    function getFirstValue(
        row,
        keys,
        fallback
    ) {
        if (!row) {
            return fallback;
        }
 
        for (
            var index = 0;
            index < keys.length;
            index += 1
        ) {
            var value =
                row[keys[index]];
 
            if (
                value !== null &&
                value !== undefined &&
                value !== ""
            ) {
                return value;
            }
        }
 
        return fallback;
    }
 
    function getCompanyName(row) {
        return getFirstValue(
            row,
            [
                "companyName",
                "acrynomName",
                "company",
                "name",
                "issuerName"
            ],
            "-"
        );
    }
 
    function getCompanyCode(row) {
        return getFirstValue(
            row,
            [
                "symbol",
                "companyCode",
                "companySymbol",
                "companyRef",
                "issuerCode"
            ],
            "-"
        );
    }
 
    function getCompanyUrl(row) {
        return getFirstValue(
            row,
            [
                "companyURL",
                "companyUrl",
                "url"
            ],
            ""
        );
    }
 
    function getSectorName(row) {
        return getFirstValue(
            row,
            [
                "sectorName",
                "sector",
                "sectorDescription"
            ],
            ""
        );
    }
 
    function getPreviousClose(row) {
        return getFirstValue(
            row,
            [
                "prev_close",
                "previousClose",
                "previousClosePrice",
                "prevClose",
                "previousClosingPrice",
                "closePrice"
            ],
            null
        );
    }
 
    function getTheoreticalOpeningPrice(row) {
        return getFirstValue(
            row,
            [
                "top",
                "TOP",
                "theoreticalOpeningPrice",
                "theoreticalPrice",
                "indicativeOpeningPrice",
                "openingPrice"
            ],
            null
        );
    }
 
    function getTheoreticalOpeningVolume(row) {
        return getFirstValue(
            row,
            [
                "tov",
                "TOV",
                "theoreticalOpeningVolume",
                "theoreticalVolume",
                "indicativeOpeningVolume",
                "openingVolume"
            ],
            null
        );
    }
 
    function isEmptyValue(value) {
        return (
            value === null ||
            value === undefined ||
            value === ""
        );
    }
 
    function isZeroValue(value) {
        if (isEmptyValue(value)) {
            return false;
        }
 
        var normalizedValue =
            String(value)
                .replace(/,/g, "")
                .trim();
 
        if (normalizedValue === "") {
            return false;
        }
 
        var numericValue =
            Number(normalizedValue);
 
        return (
            !Number.isNaN(numericValue) &&
            numericValue === 0
        );
    }
 
    function formatPrice(
        value,
        config
    ) {
        if (
            isEmptyValue(value) ||
            isZeroValue(value)
        ) {
            return "-";
        }
 
        if (
            typeof Format.valueOrDashOnAuction ===
            "function"
        ) {
            return Format.valueOrDashOnAuction(
                value,
                config
            );
        }
 
        if (
            typeof Format.valueOrDash ===
            "function"
        ) {
            return Format.valueOrDash(
                value,
                config
            );
        }
 
        return value;
    }
 
    function formatQuantity(
        value,
        config
    ) {
        if (
            isEmptyValue(value) ||
            isZeroValue(value)
        ) {
            return "-";
        }
 
        if (
            typeof Format.quantityOrDashOnAuction ===
            "function"
        ) {
            return Format.quantityOrDashOnAuction(
                value,
                config
            );
        }
 
        if (
            typeof Format.formatQuantitySafe ===
            "function"
        ) {
            return Format.formatQuantitySafe(
                value
            );
        }
 
        if (
            typeof Format.volumeOrDash ===
            "function"
        ) {
            return Format.volumeOrDash(
                value,
                config
            );
        }
 
        return value;
    }
 
    function escapeHtml(value) {
        return String(
            value === null ||
            value === undefined
                ? ""
                : value
        )
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }
 
    function renderCompanyCell(
        row,
        helpers
    ) {
        var companyName =
            getCompanyName(row);
 
        var companyCode =
            getCompanyCode(row);
 
        var companyHtml;
 
        if (
            helpers &&
            typeof helpers.renderCompanyLink ===
            "function"
        ) {
            companyHtml =
                helpers.renderCompanyLink(
                    row,
                    false
                );
        } else {
            var companyUrl =
                getCompanyUrl(row);
 
            if (
                companyUrl &&
                companyUrl !== "#"
            ) {
                companyHtml =
                    '<a href="' +
                    escapeHtml(companyUrl) +
                    '">' +
                    escapeHtml(companyName) +
                    "</a>";
            } else {
                companyHtml =
                    escapeHtml(companyName);
            }
        }
 
        return (
            '<div class="company-name-value">' +
                '<div class="stock-name">' +
                    companyHtml +
                "</div>" +
                '<div class="stock-number">' +
                    escapeHtml(companyCode) +
                "</div>" +
            "</div>"
        );
    }
 
    function getSchema(config) {
        var labels =
            getLabels(config);
 
        return {
            groups: {
                previousClose:
                    true,
 
                theoreticalOpening:
                    true
            },
 
            views: {
                "1": [
                    {
                        key:
                            "companyName",
 
                        label:
                            labels.companyName ||
                            "Company Name",
 
                        data:
                            null,
 
                        width:
                            "40%",

 
                        orderable:
                            false,
 
                        mobile:
                            false,
 
                        isHtml:
                            true,
 
                        render:
                            function (
                                row,
                                helpers
                            ) {
                                return renderCompanyCell(
                                    row,
                                    helpers
                                );
                            }
                    },
 
                    {
                        key:
                            "previousClose",
 
                        group:
                            "previousClose",
 
                        groupLabel:
                            labels.previousClose ||
                            "Previous Close",
 
                        label:
                            labels.previousClose ||
                            "Previous Close",
 
                        data:
                            null,
 
                        width:
                            "20%",
 
                        className:
                            "numeric text-center",
 
                        orderable:
                            false,
 
                        mobile:
                            true,
 
                        render:
                            function (row) {
                                return formatPrice(
                                    getPreviousClose(row),
                                    config
                                );
                            }
                    },
 
                    {
                        key:
                            "theoreticalOpeningPrice",
 
                        group:
                            "theoreticalOpening",
 
                        groupLabel:
                            labels.theoreticalOpening ||
                            "",
 
                        label:
                            labels.top ||
                            "TOP",
 
                        data:
                            null,
 
                        width:
                            "20%",
 
                        className:
                            "numeric text-center",
 
                        orderable:
                            false,
 
                        mobile:
                            true,
 
                        render:
                            function (row) {
                                return formatPrice(
                                    getTheoreticalOpeningPrice(
                                        row
                                    ),
                                    config
                                );
                            }
                    },
 
                    {
                        key:
                            "theoreticalOpeningVolume",
 
                        group:
                            "theoreticalOpening",
 
                        groupLabel:
                            labels.theoreticalOpening ||
                            "",
 
                        label:
                            labels.tov ||
                            "TOV",
 
                        data:
                            null,
 
                        width:
                            "20%",
 
                        className:
                            "numeric text-center",
 
                        orderable:
                            false,
 
                        mobile:
                            true,
 
                        render:
                            function (row) {
                                return formatQuantity(
                                    getTheoreticalOpeningVolume(
                                        row
                                    ),
                                    config
                                );
                            }
                    }
                ]
            }
        };
    }
 
    function getViewColumns(
        config,
        view
    ) {
        var schema =
            getSchema(config);
 
        return (
            schema.views[view] ||
            schema.views["1"] ||
            []
        );
    }
 
    function getColumnGroups(config) {
        return getSchema(
            config
        ).groups;
    }
 
    function getColumnGroupsByView(config) {
        var schema =
            getSchema(config);
 
        var result = {};
 
        Object.keys(
            schema.views
        ).forEach(
            function (view) {
                result[view] = {};
 
                schema.views[
                    view
                ].forEach(
                    function (
                        column,
                        index
                    ) {
                        if (!column.group) {
                            return;
                        }
 
                        if (
                            !result[view][
                                column.group
                            ]
                        ) {
                            result[view][
                                column.group
                            ] = [];
                        }
 
                        result[view][
                            column.group
                        ].push(
                            index
                        );
                    }
                );
            }
        );
 
        return result;
    }
 
    function getRows(response) {
        if (Array.isArray(response)) {
            return response;
        }
 
        if (!response) {
            return [];
        }
 
        if (Array.isArray(response.data)) {
            return response.data;
        }
 
        if (
            response.data &&
            Array.isArray(
                response.data.content
            )
        ) {
            return response.data.content;
        }
 
        if (Array.isArray(response.rows)) {
            return response.rows;
        }
 
        if (Array.isArray(response.result)) {
            return response.result;
        }
 
        if (Array.isArray(response.content)) {
            return response.content;
        }
 
        return [];
    }
 
    window.TheoreticalOpeningSchema = {
        getSchema:
            getSchema,
 
        getViewColumns:
            getViewColumns,
 
        getColumnGroups:
            getColumnGroups,
 
        getColumnGroupsByView:
            getColumnGroupsByView,
 
        getRows:
            getRows,
 
        getCompanyName:
            getCompanyName,
 
        getCompanyCode:
            getCompanyCode,
 
        getCompanyUrl:
            getCompanyUrl,
 
        getSectorName:
            getSectorName,
 
        getPreviousClose:
            getPreviousClose,
 
        getTheoreticalOpeningPrice:
            getTheoreticalOpeningPrice,
 
        getTheoreticalOpeningVolume:
            getTheoreticalOpeningVolume
    };
})(window);