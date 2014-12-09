(function () {
			/*
			transit.ping({
				selector: '#demoFrame',
				broadcast: 'FirstPing',
				//onReply: 'FirstPing_reply',
				data: {
					lookFor: 'some data'
				}
			});
			*/
	var transit = {
		//A message event.data attribute marking it as broadcast by transit
		flag: 'transit',
		appends: {},
		uniques: {},
		pings: {},
		on: function (eventName, callback) {
			var handler = function (event) {
				if (transit.isTransitMessage(event) && transit.isEvent(eventName, event)) {
					callback(event, event.data.message, event.source);
					transit.afterOn(eventName, callback);
				}
			};
			window.addEventListener('message', handler, false);
		},
		//expects: params.selector, params.broadcast, params.onReply (reply callback)
			//if a window object is passed as the second argument, params.selector is not required
		//optional: params.replyName (reply event name), params.data, params.handle
		ping: function (params, win) {
			var key, replyName, isHandleSet, data;
			
			if (win) {
				params.selector = 'parent';
			}
			key = params.selector + '.' + params.broadcast;
			if (params.handle) {
				key = params.handle;
			}

			replyName = key + '_' + transit.flag + 'Reply';
			if (params.replyName) {
				replyName = params.replyName;
			}

			data = $.extend({}, params.data);
			if (!params.data) {
				data = {};
			}

			if (transit.pings[key]) { isHandleSet = true; }
			transit.pings[key] = params;
			data.replyTo = replyName;

			if (!win) {
				transit.broadcast(transit.pings[key].broadcast, data, transit.pings[key].selector);
			}
			else {
				transit.broadcast(transit.pings[key].broadcast, data, win);
			}

			if (!isHandleSet) {
				transit.on(replyName, transit.pings[key].onReply);
			}
		},
		reply: function (eventName, callback, win) {
			transit.on(eventName, function (event, data) {
				var reply = callback(event, data);
				transit.broadcast(data.replyTo, reply, win);
			}, true);
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
			if (!data.message && message != false) {
				console.log('broadcast data empty', message);
			}
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