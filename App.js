Application.run([
	'Transit', '$rootScope', 'Templates',
	function (Transit, $rootScope, Templates) {
		$rootScope.log = function (output) {
			console.log(output);
		};
		$rootScope.loadCss = function (css) {
			angular.forEach(css, function (url, name) {
				var el = angular.element('<link/>', {
					rel: 'stylesheet',
					type: 'text/css',
					href: url
				});
				angular.element('head').append(el);
			});
		};
		$rootScope.loadJs = function (js) {
			angular.forEach(js, function (url, name) {
				var el = angular.element('<script>', {
					type: 'text/javascript',
					src: url
				});
				angular.element('head').append(el);
			});
		};

		//broadcast when $rootScope.config updates
		$rootScope.$watch('config', function (current) {
			if (!current) {return;}
			$rootScope.$broadcast('ConfigUpdate', current);
		});

		//listen for init updates with new config data
		Transit.on('init', function (event, data) {
			var defaults = {
				auth: {
					username: 'demo',
					password: 'Password1',
					apiBase: 'https://eval.espressologic.com/rest/livedemo/demo/v1',
					endpoint: 'customer'
				},
				controls: {
					insert: true,
					save: true,
					del: true,
					search: true,
					fetch: true,
					undo: true
				},
				parentControls: {
					search: true,
					fetch: true
				},
				parentColumns: {
					//product: [{field:'name', displayName: 'NAMED'}]
				},
				controlBox: 'bottom',
				globalFeedback: true,
				css: {},
				js: {}
			};

			//merge data with default configs
			merge = $.extend(true, defaults, data);

			//set config
			$rootScope.config = merge;


			$rootScope.loadCss($rootScope.config.css);
			$rootScope.loadJs($rootScope.config.js);
		});

		//Template definitions
		Templates.add(
			'foreignKey',
			'<input ng-init="parentLookup(this.$eval(\'row\'), col.colDef.field)" ' + 
				'ng-class="\'colt\' + col.index" ng-model="COL_FIELD" ng-input="COL_FIELD"/>'
		);
	}
]);