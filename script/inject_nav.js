fetch('nav.html')
.then(res => res.text())
.then(text => {
    let oldelem = document.querySelector("nav#navbar");
    //let newelem = document.createElement("div");
    oldelem.innerHTML = text;
    //oldelem.parentNode.replaceChild(newelem,oldelem);
})