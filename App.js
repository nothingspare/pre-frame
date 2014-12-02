Application.run([
	'Transit', '$rootScope', 'Templates',
	function (Transit, $rootScope, Templates) {
		$rootScope.log = function (output) {
			console.log(output);
		};

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

		//Template definitions
		Templates.add('foreignKey', '<input ng-init="parentLookup(this.$eval(\'row\'))" ng-class="\'colt\' + col.index" ng-model="COL_FIELD" ng-input="COL_FIELD"/>');
	}
]);