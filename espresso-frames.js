(function () {
	var espressoFrames = {
		events: transit,
		replies: {},
		config: {},
		init: function (config) {
			var frame = $.extend({}, espressoFrames);
			transit.on('startup', function (event, data, source) {
				transit.broadcast('init', config, source);
			});

			//set frame config
			frame.config = config;

			return frame;
		},
		reply: function (eventName, data) {
			transit.reply(eventName, data, '#' + this.config.id)
		},
	};
	
	window.espressoFrames = espressoFrames;
	return espressoFrames;
})();