Application.service('Data', [
	'$rootScope', '$http',
	function ($rootScope, $http) {
		var EspressoData = {
			auth: {
				username: '',
				password: '',
				apiBase: '',
				endpoint: '',
				apiKey: null
			},
			get: function (endpoint, params) {
				return $http.get(EspressoData.auth.apiBase + '/' + endpoint, EspressoData.getRequestConfig());
			},
			put: function (endpoint, objects) {
				return $http.put(EspressoData.auth.apiBase + '/' + endpoint, objects, EspressoData.getRequestConfig());
			},
			getUrl: function (fullUrl, params) {
				return $http.get(fullUrl, EspressoData.getRequestConfig());
			},
			getRequestConfig: function (merge) {
				if (merge) {console.log('not implemented yet');}
				return {
					headers: {
						Authorization: 'Espresso ' + EspressoData.auth.apiKey + ':1'
					}
				}
			},
			test: function () {
				console.log(EspressoData);
			}
		};
		$rootScope.$on('ConfigUpdate', function (event, data) {
			if (!angular.equals(EspressoData.auth, data.auth)) {
				if (!data.auth.apiKey) {
					$http.post(data.auth.apiBase + '/@authentication', {
						username: data.auth.username,
						password: data.auth.password
					}).success(function (auth) {
						EspressoData.auth = data.auth;
						EspressoData.auth.apiKey = auth.apikey;
						$rootScope.$broadcast('AuthUpdate', EspressoData.auth);
					});
				}
			}
		});
		return EspressoData;
	}
]);