(function () {
	var transit = {
		//A message event.data attribute marking it as broadcast by transit
		flag: 'transit',
		appends: {},
		on: function (eventName, callback) {
			window.addEventListener('message', function (event) {
				if (transit.isTransitMessage(event) && transit.isEvent(eventName, event)) {
					callback(event, event.data.message, event.source);
					transit.afterOn(eventName, callback);
				}
			}, false);
		},
		broadcast: function (eventName, message, win) {
			if (typeof win == 'string') {
				var $el = $(win);
				if ($el[0]) {
					win = $el[0].contentWindow; 
				}
			}
			if (!win) { win = window.parent; }
			var data = {};
			data[transit.flag] = true;
			data.name = eventName;
			data.message = message;
			data = transit.extend(data, transit.getAppends());
			win.postMessage(data, '*');
			transit.afterBroadcast(eventName, message, win);
		},
		afterBroadcast: function (eventName, message, win) {},
		afterOn: function (eventName, callback) {},
		isTransitMessage: function (event) {
			return event.data && event.data[transit.flag];
		},
		isEvent: function (eventName, event) {
			return event.data.name === eventName;
		},
		addAppend: function (name, value) {
			transit.appends[name] = value;
		},
		getAppends: function () {
			return transit.appends;
		},
		extend: function (destination, obj) {
			for (var index in obj) { 
				if (obj.hasOwnProperty(index)) {
					destination[index] = obj[index];
				}
			}
			return destination;
		}
	};
	
	window.transit = transit;
	return transit;
})();