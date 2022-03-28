let IS_REMOTE = window.location.origin.includes('github');

async function getMatchData() {
    return fetch( window.location.origin + (IS_REMOTE ? '/PUBG-Utils' : '') + '/res/match_data.csv' )
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

getMatchData().then(data => {
    data.forEach(match => {
        if( match['map'] == 'Erangel' ) {
            var svgns = "http://www.w3.org/2000/svg";

            var rect = document.createElementNS( svgns,'rect' );
            rect.setAttributeNS( null, 'x', (2000/700) * match.centerX );
            rect.setAttributeNS( null, 'y', (2000/700) * match.centerY );
            rect.setAttributeNS( null, 'width', 15 );
            rect.setAttributeNS( null, 'height', 15 );
            rect.setAttributeNS( null, 'fill', '#' + Math.round( 0xffffff * Math.random()).toString(16) );
            rect.addEventListener( 'click', function() {
                window.open( match.matchLink, "_blank" );
            } );

            document.getElementById( 'map' ).appendChild( rect );
        }
    });
    
});