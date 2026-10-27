#target aftereffects
#include "../src/data.jsxinc"
#include "../src/core.jsxinc"

// Run via File > Scripts > Run Script File in After Effects.
// Creates a new test composition. Does not replace or close the current project.
(function () {
    var assertions = 0;
    function check(condition, message) {
        if (!condition) { throw new Error(message); }
        assertions++;
    }
    function findProperty(group, matchName) {
        var i, p, found;
        for (i = 1; i <= group.numProperties; i++) {
            p = group.property(i);
            if (p.matchName === matchName) { return p; }
            if (p.numProperties) {
                found = findProperty(p, matchName);
                if (found) { return found; }
            }
        }
        return null;
    }
    function checkExpressions(group) {
        var i, p;
        for (i = 1; i <= group.numProperties; i++) {
            p = group.property(i);
            if (p.numProperties) { checkExpressions(p); }
            else if (p.canSetExpression && p.expressionEnabled) {
                p.valueAtTime(0.5, false);
                check(!p.expressionError, p.name + ': ' + p.expressionError);
            }
        }
    }
    try {
        if (!app.project) { app.newProject(); }
        var comp = app.project.items.addComp('MapCtrl - Smoke test', 1920, 1080, 1, 12, 30);
        comp.openInViewer();
        var built = MapCtrlCore.createMap({fill:[0.12,0.2,0.25],stroke:[0.04,0.07,0.1],strokeWidth:1});
        check(built.comp === comp, 'Map created in wrong composition.');
        check(!!MapCtrlCore.getMap(comp), 'Map controller is missing.');
        var layerCount = comp.numLayers;
        MapCtrlCore.createMap({});
        check(comp.numLayers === layerCount, 'A second build duplicated the map.');
        var i, stateCount = 0;
        for (i = 1; i <= comp.numLayers; i++) {
            if (comp.layer(i).comment.indexOf('mapctrl:v1|state|') === 0) { stateCount++; }
        }
        check(stateCount === 51, 'Expected 50 states and DC.');
        MapCtrlCore.setStateFill(['CA','TX','NY'], [0.25,0.85,0.72], {animate:true,duration:1,stagger:0.15,easing:true});
        MapCtrlCore.selectStates(['CA']);
        check(comp.selectedLayers.length === 1, 'State selection failed.');
        var fill = findProperty(comp.selectedLayers[0].property('ADBE Root Vectors Group'), 'ADBE Vector Fill Color');
        check(fill && fill.numKeys === 2, 'State fill needs two keyframes.');
        var pinA = MapCtrlCore.addPin([180,280], 'West', {color:[1,0.65,0.32],size:22,animate:true,duration:0.5});
        var pinB = MapCtrlCore.addPin([760,210], 'East', {color:[1,0.65,0.32],size:22});
        var pins = MapCtrlCore.getPins();
        check(pins.length === 2, 'Expected two pins.');
        var route = MapCtrlCore.createRoute([{pinId:pins[0].id},{point:[480,180]},{pinId:pins[1].id}],
            {color:[0.9,0.95,1],width:3,dash:10,gap:7,duration:2,animate:true,flow:20,easing:true});
        check(!!route, 'Route was not created.');
        var trim = findProperty(route.property('ADBE Root Vectors Group'), 'ADBE Vector Trim End');
        check(trim && trim.numKeys === 2, 'Route reveal needs two keyframes.');
        pinA.name = 'Renamed waypoint';
        pinA.moveToBeginning();
        pinA.property('ADBE Transform Group').property('ADBE Position').setValue([220,300]);
        comp.time = 0.5;
        checkExpressions(route);
        var routePath = findProperty(route.property('ADBE Root Vectors Group'), 'ADBE Vector Shape');
        check(routePath.valueAtTime(0.5, false).vertices.length === 3, 'Route waypoint count changed.');
        comp.time = 2.5;
        comp.openInViewer();
        alert('MapCtrl: ' + assertions + ' runtime checks passed.\n\nInspect the test comp, scrub the timeline, move pins, and run the UI checklist in docs/TESTING.md.');
    } catch (error) {
        alert('MapCtrl smoke test failed after ' + assertions + ' checks:\n' + error.toString() + '\nLine: ' + error.line);
    }
})();
