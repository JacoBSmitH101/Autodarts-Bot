//placeholder code that will loop and crash every 10 seconds
setInterval(function () {
    console.log("Crashing in 10 seconds");
    setTimeout(function () {
        console.log("Crashing now");
        process.exit(1);
    }, 10000);
}, 10000);
