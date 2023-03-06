function initC1AnalysisManager(mapName) {

    // Setup output text
    let out = document.getElementById("status-string");
    function statusLog(text) {
        out.innerText = text;
    }

    // Parse inputs
    let json = "";
    try {
        json = JSON.parse(document.getElementById("c2parameters").value);
    } catch(err) {
        statusLog("JSON input error");
        return;
    }

    const mapDict = {
        "Baltic_Main": "Erangel",
        "Desert_Main": "Miramar",
        "Miramar": "Desert_Main",
        "Erangel": "Baltic_Main"
    };

    let centerX = json.x;
    let centerY = json.y;
    let limit = json.limit;
    let radius = json.radius;
    let map = mapDict[mapName];

    if(!centerX || !centerY || !limit || !radius || !map) {
        statusLog("Invalid input parameter");
        return;
    }



    // Config stuff
    const maxDistance = 111072;
    const CLUSTER_RANGE = 30;

    // Set up canvas and helper functions
    let canvas = document.getElementById("map");
    let ctx = canvas.getContext("2d");

    function getCursorPosition(canvas, event) {
        const rect = canvas.getBoundingClientRect()
        const x = event.clientX - rect.left
        const y = event.clientY - rect.top
        return [x, y];
    }
    
    canvas.addEventListener('mousedown', function(e) {
        let pos = getCursorPosition(canvas, e);
        let x = 816000 * (pos[0] - 50) / 1800;
        let y = 816000 * (pos[1] - 50) / 1800;
        console.log(`{"x":${Math.round(x)},"y":${Math.round(y)},"limit":7000,"radius":350}`);
    })

    function drawCircle(x, y, radius, r, g, b, a) {
        ctx.strokeStyle = `rgba(${r},${g},${b},${a})`
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, 2 * Math.PI);
        ctx.stroke();
    }

    function drawPixel(x, y, r, g, b, a) {
        ctx.strokeStyle = `rgba(${r},${g},${b},${a})`
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + 1, y + 1);
        ctx.stroke();
    }

    function drawText(text, x, y) {
        ctx.fillStyle = "white";
        ctx.font = "12px sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(text, x, y);
    }

    // Draw map image on canvas
    let mapImage = new Image();
    mapImage.onload = () => {
        ctx.drawImage(mapImage, 0, 0, 1800, 1800);
        drawCircle(1800 * (centerX / 816000), 1800 * (centerY / 816000), 1800 * (maxDistance / 816000), 255, 255, 255, 1.0);
    }
    mapImage.src = (mapName == "Baltic_Main") ? "../res/Erangel_PNG.png" : "../res/Miramar_PNG.png";



    // Other helper functions
    function generateGrid(width, height) {
        let grid = [];
        for(let y = 0; y < height; y++) {
            grid[y] = [];
            for(let x = 0; x < width; x++) {
                grid[y][x] = [];
            }
        }
        return grid;
    }

    // Treshold is in units of meters
    function getLocationsWithinDistance(locations, ignoreIdx, x, y, threshold) {
        let adjThresh = 1800 * threshold / 8000; // Convert to map units
        let out = [];

        for(let i = 0; i < locations.length; i++) {
            let loc = locations[i];
            let distance = Math.sqrt(
                Math.pow(loc.x - x, 2)
                + Math.pow(loc.y - y, 2)
            );
            if(distance < adjThresh && !ignoreIdx.includes(i)) {
                out.push(loc);
                ignoreIdx.push(i);
            }
        }

        return out;
    }

    // Draw boxes for a cluster
    function drawCluster(cluster, r, g, b, a) {
        ctx.fillStyle = `rgba(${r},${g},${b},${a})`
        let width = 2 * (1800 * CLUSTER_RANGE / 8000);

        cluster.forEach(loc => {
            ctx.fillRect(loc.x - (0.5 * width), loc.y - (0.5 * width), width, width);
        });   
    }

    // Gets average value of a cluster
    function clusterAverage(cluster) {
        let sum = 0;
        cluster.forEach(loc => sum += loc.value);
        return sum / cluster.length;
    }

    

    async function getC1sWithinRange() {
        statusLog("Getting C1s in range...");
        return fetch(`http://localhost:5000/analysis/c2within?radius=${radius}&limit=${limit}&map=${map}&centerX=${centerX}&centerY=${centerY}`)
            .then( response => response.json() )
            .then( json => {
                return json;
            } );
    }

    async function getLocationsAndPoints(matchesString) {
        let response = await fetch(`http://localhost:5000/analysis/telemetry/playerlocationsandpoints/atzone/batch?zoneNum=3&matches=${matchesString}`)
        return await response.json();
    }



    getC1sWithinRange().then(data => {
        statusLog(`Getting telemetry for ${data.body.length} games (About 1 game per second)...`);

        let idString = "";
        data.body.forEach(match => {
            idString += `${match.id},`;
        })
        idString = "[" + idString.substring(0, idString.length - 1) + "]";
        
        getLocationsAndPoints(idString)
            .then(data => {

                let locations = [];

                // Iterate through games and push (points earned / total points) to location matrix
                let games = data.body;
                let gameCount = Object.keys(games).length;
                Object.keys(games).forEach(gameId => {
                    let game = games[gameId];
                    if(game.hasOwnProperty("playerLocations")) {
                        Object.keys(game.playerLocations).forEach(playerName => {

                            let player = game.playerLocations[playerName];

                            // Only take player locations within maxDistance of c1 center (radius of c1)
                            let distance = Math.sqrt(
                                Math.pow(player.x - centerX, 2)
                                + Math.pow(player.y - centerY, 2)
                            );

                            if(distance < maxDistance) {
                                let drawX = -6 + Math.round((1800/816000) * player.x);
                                let drawY = -6 + Math.round((1800/816000) * player.y);
                                let value = game.pointsByPlayer.players[playerName].points;

                                locations.push({ x: drawX, y: drawY, value });
                            }
                        });
                    }
                });

                // Post loop
                let usedLocations = [];
                let clusters = [];

                // BFS exapnds a cluster with a certain search radius
                function buildCluster(locations, usedLocations, firstPoint) {
                    let list = [];

                    let newLocs = getLocationsWithinDistance(locations, usedLocations, firstPoint.x, firstPoint.y, CLUSTER_RANGE);
                    while(newLocs.length > 0) {
                        newLocs.forEach(loc => list.push(loc));
                        newNewLocs = [];
                        newLocs.forEach(loc => {
                            let temp = getLocationsWithinDistance(locations, usedLocations, loc.x, loc.y, CLUSTER_RANGE);
                            temp.forEach(tempLoc => newNewLocs.push(tempLoc));
                        })
                        newLocs = newNewLocs;
                    }

                    return list;
                }

                // Iterate over unused points to cluster every point
                for(let i = 0; i < locations.length; i++) {
                    if(!usedLocations.includes(i)) clusters.push(buildCluster(locations, usedLocations, locations[i]));
                }

                // Draw each cluster
                clusters.forEach(cluster => {
                    if(cluster.length > gameCount * 0.2) {
                        drawCluster(cluster, Math.min(255, 30 * Math.pow(clusterAverage(cluster), 1)), 0, 0, 1.0);
                        drawText(`${Math.round(100 * cluster.length / gameCount) / 100}`, cluster[0].x, cluster[0].y);
                    }
                })

                statusLog("Completed");
            });
    });
}