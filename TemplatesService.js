Application.service('Templates', [
	'$rootScope', '$http',
	function ($rootScope, $http) {
		var Templates = {
			byName: {},
			get: function (name, params) {
				return Templates.byName[name];
			},
			add: function (name, template) {
				Templates.byName[name] = template;
			}
		}
		return Templates;
	}
]);