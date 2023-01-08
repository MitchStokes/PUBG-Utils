function initDensityManager(mapName) {
    let IS_REMOTE = window.location.origin.includes('github');

    async function getMatchData() {
        return fetch( window.location.origin + (IS_REMOTE ? '/PUBG-Utils' : '') + '/res/twire_miner_c4.csv' )
            .then( response => response.text() )
            .then( text => {
                let lines = (IS_REMOTE ? text.split('\n') : text.split( '\r\n' ));
                let matchData = [];
                lines.forEach(line => {
                    let lineData = line.split( ',' );
                    let curObj = {};
                    curObj.matchId = lineData[0];
                    curObj.centerX = lineData[1];
                    curObj.centerY = lineData[2];
                    curObj.map = lineData[3];
                    curObj.time = lineData[4];
                    curObj.matchName = lineData[5];
                    curObj.matchLink = 'https://analytics.twire.gg/en/pubg/match/' + curObj.matchId;
                    matchData.push( curObj );
                });
                return matchData;
            } );
    }

    const mapDict = {
        "Baltic_Main": "Erangel",
        "Desert_Main": "Miramar",
        "Miramar": "Desert_Main",
        "Erangel": "Baltic_Main"
    };

    getMatchData().then(data => {
        const searchRadii = [50, 30, 20]; // Must be sorted largest to smallest
        const boxWidth = 50;

        let avgDensities = {};

        for(let x = 0; x <= 2000 - boxWidth; x += boxWidth) {
            for(let y = 0; y <= 2000 - boxWidth; y += boxWidth) {
                let found = [];
                let centerX = x + (boxWidth / 2);
                let centerY = y + (boxWidth / 2);

                for(let i = 0; i < searchRadii.length; i++) {
                    radius = searchRadii[i];

                    dataSource = (found.length > 0) ? found[i-1] : data
                    let thisIter = [];
                    dataSource.forEach(match => {
                        if( match['map'] == mapDict[mapName] ) {
                            matchX = 2000*match.centerX / 700;
                            matchY = 2000*match.centerY / 700;
                            let distance = Math.sqrt(Math.pow(matchX - centerX, 2) + Math.pow(matchY - centerY, 2));
                            if(distance < radius) {
                                thisIter.push(match);
                            }
                        }
                    });
                    found.push(thisIter);
                }

                let densities = [];
                for(let i = 0; i < found.length; i++) {
                    densities[i] = found[i].length / (Math.PI * Math.pow(searchRadii[i], 2));
                }
                avgDensities[`${x},${y}`] = densities.reduce((prev, cur) => prev + cur, 0) / densities.length;
            }
        }

        let maxDensity = 0;
        Object.keys(avgDensities).forEach(xy => {
            [x, y] = xy.split(",");
            maxDensity = Math.max(maxDensity, avgDensities[xy]);
            if(maxDensity == avgDensities[xy]) {
                console.log(xy);
            }
        })

        Object.keys(avgDensities).forEach(xy => {
            [x, y] = xy.split(",");
            let density = avgDensities[xy];

            var svgns = "http://www.w3.org/2000/svg";

            var rect = document.createElementNS( svgns,'rect' );
            rect.setAttributeNS( null, 'x', x );
            rect.setAttributeNS( null, 'y', y );
            rect.setAttributeNS( null, 'width', boxWidth );
            rect.setAttributeNS( null, 'height', boxWidth );
            rect.setAttributeNS( null, 'fill', `rgba(255,0,0,${Math.pow(density/maxDensity, 1)})` );
            document.getElementById( 'map' ).appendChild( rect );
        })
    });
}