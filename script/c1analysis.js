function initC1AnalysisManager(mapName) {



    let centerX = 640000;
    let centerY = 460609;
    let limit = 7000;
    let radius = 350;
    let map = mapName;

    const maxDistance = 201950;
    const TRICKLE_VALUE = 20;



    let canvas = document.getElementById("newmap");
    let ctx = canvas.getContext("2d");

    function drawPixel(x, y, r, g, b, a) {
        ctx.strokeStyle = `rgba(${r},${g},${b},${a})`
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + 1, y + 1);
        ctx.stroke();
    }

    function drawCircle(x, y, radius, r, g, b, a) {
        ctx.strokeStyle = `rgba(${r},${g},${b},${a})`
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, 2 * Math.PI);
        ctx.stroke();
    }

    let mapImage = new Image();
    mapImage.onload = () => {
        ctx.drawImage(mapImage, 0, 0, 2000, 2000);
        drawCircle(2000 * (centerX / 816000), 2000 * (centerY / 816000), 2000 * (maxDistance / 816000), 255, 255, 255, 1.0);
    }
    mapImage.src = (mapName == "Baltic_Main") ? "../res/Erangel_PNG.png" : "../res/Miramar_PNG.png";

    

    async function getC1sWithinRange() {
        console.log("Getting C1s in range...");
        return fetch(`http://localhost:5000/analysis/c1within?radius=${radius}&limit=${limit}&map=${map}&centerX=${centerX}&centerY=${centerY}`)
            .then( response => response.json() )
            .then( json => {
                return json;
            } );
    }

    async function getLocationsAndPoints(matchesString) {
        let response = await fetch(`http://localhost:5000/analysis/telemetry/playerlocationsandpoints/atzone/batch?zoneNum=2&matches=${matchesString}`)
        return await response.json();
    }

    getC1sWithinRange().then(data => {
        console.log(`Found ${data.body.length} games in range.`);
        console.log("Getting telemetry for each game...");

        let idString = "";
        data.body.forEach(match => {
            idString += `${match.id},`;
        })
        idString = "[" + idString.substring(0, idString.length - 1) + "]";

        getLocationsAndPoints(idString)
            .then(data => {
                // Initialize location matrix matrix
                let matrix = [];
                for(let i = 0; i < 2000; i++) {
                    matrix[i] = [];
                    for(let j = 0; j < 2000; j++) {
                        matrix[i][j] = [];
                    }
                }

                // Iterate through games and push (points earned / total points) to location matrix
                let games = data.body;
                let gameCount = Object.keys(games).length;
                Object.keys(games).forEach(gameId => {
                    let game = games[gameId];
                    if(game.hasOwnProperty("playerLocations")) {
                        Object.keys(game.playerLocations).forEach(playerName => {
                            let player = game.playerLocations[playerName];

                            let distance = Math.sqrt(
                                Math.pow(player.x - centerX, 2)
                                + Math.pow(player.y - centerY, 2)
                            );
                            
                            if(distance < maxDistance) {
                                let drawX = -10 + Math.round((2000/816000) * player.x);
                                let drawY = -10 + Math.round((2000/816000) * player.y);
                                let value = game.pointsByPlayer.players[playerName].points / game.totalPoints;

                                for(let xOffset = -TRICKLE_VALUE; xOffset <= TRICKLE_VALUE; xOffset++) {
                                    let x = drawX + xOffset;
                                    if(x < 0 || x > 1999) continue;

                                    for(let yOffset = -TRICKLE_VALUE; yOffset <= TRICKLE_VALUE; yOffset++) {
                                        let y = drawY + yOffset;
                                        if(y < 0 || y > 1999) continue;

                                        matrix[x][y].push(value);
                                    }
                                }
                            }
                        });
                    }
                });

                // Refine location matrix to require a minimum amount of data points to assign a good ranking
                let maxValue = 0;
                for(let x = 0; x < matrix.length; x++) {
                    for(let y = 0; y < matrix[x].length; y++) {
                        if(matrix[x][y].length > 0) {

                            let sum = 0;
                            matrix[x][y].forEach(element => {
                                sum += element;
                            });
                            let value = (matrix[x][y].length > 0.1 * (gameCount * 4)) ? sum / matrix[x][y].length : 0;

                            matrix[x][y] = value;
                            maxValue = Math.max(value, maxValue);
                        } else {
                            matrix[x][y] = 0;
                        }
                    }
                }

                for(let x = 0; x < matrix.length; x++) {
                    for(let y = 0; y < matrix[x].length; y++) {
                        let value = matrix[x][y] / maxValue;
                        drawPixel(x, y, 255, 0, 255 * Math.pow(value, 3), Math.pow(value, 3));
                    }
                }
            });
    });
}