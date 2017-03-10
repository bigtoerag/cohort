
import d3 from 'd3';
import AggResponseTabifyTabifyProvider from 'ui/agg_response/tabify/tabify';
var module = require('ui/modules').get('cohort');

module.controller('cohort_controller', function($scope, $element, Private) {

    const tabifyAggResponse = Private(AggResponseTabifyTabifyProvider);
    const round = function(v){ return Math.round(v * 100) / 100; };

    const formatTypes = {
        custom : d3.time.format("%Y/%m/%d %H:%M:%S"),
        ms     : d3.time.format("%Y/%m/%d %H:%M:%S,%L"),
        s      : d3.time.format("%Y/%m/%d %H:%M:%S"),
        m      : d3.time.format("%Y/%m/%d %H:%M"),
        h      : d3.time.format("%Y/%m/%d %H:%M"),
        d      : d3.time.format("%Y/%m/%d"),
        w      : d3.time.format("%Y/%m/%d"),
        M      : d3.time.format("%Y/%m"),
        y      : d3.time.format("%Y"),
    };

    $scope.$watchMulti(['esResponse', 'vis.params'], function ([resp]) {
        if (!resp) {
            return;
        }

        var formatTime = getFormatTime($scope);
        var data = processData($scope.vis, resp);
        var valueFn = getValueFunction($scope);

        var $div = $element.empty(),
            $closest = $div.closest('div.visualize-chart'),
            margin = { top: 40, right: 80, bottom: 40, left: 50 },
            width = $closest.width() - margin.left - margin.right,
            height = $closest.height() - margin.top - margin.bottom,
            id = $div.attr('id');

        if ($scope.vis.params.table) {
            showTable($scope, id, width, data, valueFn, formatTime);
        } else {
            showGraph($scope, id, margin, width, height, data, valueFn, formatTime);
        }

    });

    function showTable($scope, id, width, data, valueFn, formatTime) {

        var periodMeans = d3.nest().key(function(d) { return d.period; }).entries(data).map(function(d){
            return round(d3.mean(d.values, valueFn));
        });

        var groupedData = d3.nest().key(function(d) { return formatTime(d.date); }).entries(data);

        var fixedColumns = ["Total", "Date"];
        var columns = d3.map(data, function(d){return d.period; }).keys();
        var allColumns = fixedColumns.concat(columns);
        var rowsData = d3.map(data, function(d){return d.date; }).keys();

        var table = d3.select("#" + id).append('table')
            .attr("width", width)
            .attr("class", "cohort_table");

        var thead = table.append('thead');
        var tbody = table.append('tbody');
        var tfoot = table.append('tfoot');

        thead.append('tr')
            .selectAll('th')
            .data(allColumns)
            .enter()
            .append('th')
            .text(function (column) { return column; });

        var rows = tbody.selectAll('tr')
            .data(groupedData)
            .enter()
            .append('tr');

        var colorScale = getColorScale($scope, data, valueFn);

        var cells = rows.selectAll('td')
            .data(function(row){
                var date = row.key;
                var total;
                var vals = columns.map(function(period){
                    var val;
                    row.values.map(function(d) {
                        if (period == d.period){
                            total = d.total;
                            val = valueFn(d);
                        }
                    });
                    return val;
                });

                return [total, date].concat(vals);
            })
            .enter()
            .append('td')
            .style("background-color", function(d,i) {
                if (i >= 2) { // skip first and second columns
                    return colorScale(d);
                }
            })
            .text(function (d) { return d; });

        var allMeans = ["-", "Mean"].concat(periodMeans);

        tfoot.append('tr')
            .selectAll('td')
            .data(allMeans)
            .enter()
            .append('td')
            .text(function (d) { return d; });
    }

    function showGraph($scope, id, margin, width, height, data, valueFn, formatTime) {

        var svg = d3.select("#" + id)
            .append("svg")
            .attr("width", width + margin.left + margin.right)
            .attr("height", height + margin.top + margin.bottom);

        var g = svg.append("g").attr("transform", "translate(" + margin.left + "," + margin.top + ")");

        var x = d3.scale.linear().range([0, width]),
            y = d3.scale.linear().range([height, 0]),
            z = d3.scale.category20();

        var line = d3.svg.line()
            // .curve(d3.curveBasis)
            .x(function(d) { return x(d.period); })
            .y(function(d) { return y(valueFn(d)); });

        var xAxis = d3.svg.axis()
            .scale(x)
            .orient("bottom").ticks(5);

        var yAxis = d3.svg.axis()
            .scale(y)
            .orient("left").ticks(5);

        var tooltip = d3.select("body")
            .append("div")
            .attr("class", "tooltip")
            .style("opacity", 0);

        x.domain(d3.extent(data, function(d) { return d.period; }));
        y.domain([0, d3.max(data, valueFn)]);

        var dataNest = d3.nest()
            .key(function(d) { return formatTime(d.date); })
            .entries(data);

        z.domain(dataNest.map(function(d) { return d.key; }));

        g.selectAll("dot_x")
            .data(data)
            .enter()
            .append("circle")
            .attr("r", 5)
            .attr("cx", function(d) { return x(d.period); })
            .attr("cy", function(d) { return y(valueFn(d)); })
            .style("fill", function(d) { return z(formatTime(d.date)); })
            .style("opacity", 1)
            .on("mouseover", function(d) {
                tooltip.transition()
                   .duration(100)
                   .style("opacity", .9);
                tooltip.html(formatTime(d.date) + " ( " + d.period + " ) <br/>" + round(valueFn(d)) )
                    .style("background", z(formatTime(d.date)))
                    .style("left", (d3.event.pageX + 5) + "px")
                    .style("top", (d3.event.pageY - 35) + "px");
                })
            .on("mouseout", function(d) {
                tooltip.transition()
                    .duration(500)
                    .style("opacity", 0);
            });

        g.append("g")
            .attr("class", "axis axis--x")
            .attr("transform", "translate(0," + height + ")")
            .call(xAxis);

        g.append("g")
            .attr("class", "axis axis--y")
            .call(yAxis)
            .append("text")
            .attr("y", 6)
            .attr("x", 6)
            .attr("dy", ".45em")
            .style("font", "10px sans-serif")
            .style("text-anchor", "start")
            .text($scope.vis.params.percentual ? "Percentual %" : "Total Count");;

        var cohortDate = g.selectAll(".cohortDate")
            .data(dataNest)
            .enter()
            .append("g")
            .attr("class", "cohortDate");

        cohortDate.append("path")
            .attr("class", "line")
            .attr("d", function(d) { return line(d.values); })
            .style("stroke", function(d) { return z(d.key); });

        var legend = g.append('g')
            .attr("class", "legend")
            .attr("x", 10)
            .attr("y", 35)
            .attr("height", 100)
            .attr("width", 100);

        legend.selectAll("rect")
            .data(dataNest)
            .enter()
            .append("rect")
            .attr("x", 10)
            .attr("y", function(d, i){ return i *  20 + 20;})
            .attr("width", 10)
            .attr("height", 10)
            .style("fill", function(d) { return z(d.key); });

        legend.selectAll("text")
            .data(dataNest)
            .enter()
            .append("text")
            .attr("x", 30)
            .attr("y", function(d, i){ return i *  20 + 28;})
            .style("font", "10px sans-serif")
            .text(function(d) { return d.key; });
    }

    function getValueFunction($scope) {

        var cumulative = function(d) { return d.cumValue; };
        var absolute = function(d) { return d.value; };
        var value = $scope.vis.params.cumulative ? cumulative : absolute;

        var percent = function(d) { return round( (value(d) / d.total) * 100 ); };
        var valueFn = $scope.vis.params.percentual ? percent : value;

        return valueFn;

    }

    function getFormatTime($scope) {
        var schema = $scope.vis.aggs.filter(function(agg) { return agg.schema.name == "cohort_date"; });
        var interval = schema[0].params.interval.val;
        console.log("schema", schema, interval);
        return formatTypes[interval];
    }

    function getColorScale($scope, data, valueFn) {
        if ($scope.vis.params.mapColors) {

            var domain = d3.extent(data, valueFn);
            domain.splice(1, 0, d3.mean(domain));

            return d3.scale.linear().domain(domain).range(["#ff4e61","#ffef7d","#32c77c"]);

        } else {
            return function(d) { };
        }
    }

    function processData($vis, resp) {
        var esData = tabifyAggResponse($vis, resp);
        var data = esData.tables[0].rows.map(function(row) {
            return {
                "date": new Date(row[0]),
                "total": row[1],
                "period": row[2],
                "value": row[3]
            };
         });

        var cumulativeData = {};
        data.forEach(function(d) {
            var lastValue = cumulativeData[d.date] ? cumulativeData[d.date] : 0;
            d.cumValue = lastValue + d.value;
            cumulativeData[d.date] = d.cumValue;
        });

        return data;
    }
});

