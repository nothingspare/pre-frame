Application.run([
	'Transit', '$rootScope',
	function (Transit, $rootScope) {
		//broadcast when $rootScope.config updates
		$rootScope.$watch('config', function (current) {
			if (!current) {return;}
			$rootScope.$broadcast('ConfigUpdate', current);
		});

		//listen for init updates with new config data
		Transit.on('init', function (event, data) {
			var defaults = {
				controls: {
					insert: true,
					save: true,
					del: true,
					search: true,
					fetch: true,
					undo: true
				}
			};

			//merge data with default configs
			merge = $.extend(true, defaults, data);

			//set config
			$rootScope.config = merge;
		});
	}
]);