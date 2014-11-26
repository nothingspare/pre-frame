Application.service('Transit', [
	'$rootScope',
	function ($rootScope) {
		var Transit = angular.extend({}, window.transit);
		window.transit.afterBroadcast = function () {
			$rootScope.$evalAsync();
		};
		window.transit.afterOn = function () {
			$rootScope.$evalAsync();
		};
		return window.transit;
	}
]);