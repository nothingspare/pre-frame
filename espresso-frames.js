(function () {
	var espressoFrames = {
		events: transit,
		init: function (config) {
			transit.on('startup', function (event, data, source) {
				transit.broadcast('init', config, source);
			});
		}
	};
	
	window.espressoFrames = espressoFrames;
	return espressoFrames;
})();