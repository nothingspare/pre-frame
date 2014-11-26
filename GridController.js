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

Application.controller('GridController', [
	'$rootScope', '$scope', '$http', 'Transit', 'Data',
	function ($rootScope, $scope, $http, Transit, Data) {
		//interfaces exposed to the user, and potentially firable from the container
		$rootScope.controls = {};

		//flags and data used by the template, but not displayed
		$rootScope.params = {};

		//a reference to the original objects requested by the server
		$scope.originalData = [];

		//grid data array
		$scope.data = [];

		//table definitions from an @tables/{endpoint} request, w/ added $scope.table.named attribute(columns index by name)
		$scope.table = {};

		//search filters array, contains filter objects: {columns:{},operator:{},text:''}
		$rootScope.filters = [];

		//operators applied to the text of a search filter
		$rootScope.operators = [{
				label: 'like',
				prefix: 'LIKE %',
				suffix: '%',
			}, {
				label: 'greater than',
				prefix: '>',
				suffix: '',
			}, {
				label: 'less than',
				prefix: '<',
				suffix: '',
			}, {
				label: 'equals',
				prefix: '=\'',
				suffix: '\'',
			}, {
				label: 'not equal',
				prefix: '!=\'',
				suffix: '\'',
		}];

		$scope.$watch('table', function (current, previous) {
			if (current && !angular.equals(current, previous)) {
				console.log(current.named);
			};
		});

		$scope.$watch('data', function (current) {
			if (current && !angular.equals(current, [])) {
				if ($scope.isPaginated(current)) {
					var nextBatch = $scope.getPaginationObj(current);
					$scope.setNextBatch(nextBatch);
				}
				else {
					$scope.setNextBatch(false);
				}
			}
		});
		$scope.$watch('originalData', function (current) {
			if (current && !angular.equals(current, [])) {
				if ($scope.isPaginated(current)) {
					//getting it also removes it, which is desirable here
					$scope.getPaginationObj(current);
				}
				console.log(current);
			}
		});

		//expects endpoint
		//returns $http promise
		$scope.getRows = function (endpoint, filters) {
			if (filters) {
				if (typeof filters == 'string') {
					endpoint += '?' + filters;
				}
				else {
					console.log('filtering by object not implemented');
				}
			}
			return Data.get(endpoint).success(function (rows) {
				$scope.data = rows;
				$scope.originalData = angular.copy(rows);
			});
		};

		//expects a full url
		//returns $http promise
		$scope.appendRows = function (url) {
			return Data.getUrl(url).success(function (data) {
				$scope.data = $scope.data.concat(data);
				$scope.originalData = $scope.originalData.concat(angular.copy(data));
			});
		};

		$scope.$on('AuthUpdate', function (event, auth) {
			$scope.getRows(auth.endpoint);
			Data.get('@tables/' + auth.endpoint).success(function (data) {
				$scope.table = data;
				angular.forEach($scope.table.columns, function (column, index) {
					$scope.table.named = _.indexBy($scope.table.columns, 'name');
				});
			});
		});

		$scope.options = {
			data: 'data',
			enableCellSelection: true,
			enableRowSelection: true,
			enableCellEditOnFocus: true,
			afterSelectionChange: function (row) {
				if (row.selected) {
					Transit.broadcast('RowSelected', row.entity);
				}
				else {
					Transit.broadcast('RowDeselected', row.entity);
				}
			},
			//columnDefs: [{field: 'name', displayName: 'name'}]
		};

		$scope.isPaginated = function (data) {
			if (data[data.length-1]) {
				var lastElement = data[data.length-1];
				if (lastElement['@metadata'] && lastElement['@metadata'].next_batch) {
					return true;
				}
			}
			return false;
		};
		$scope.nextBatch = false;
		$scope.getPaginationObj = function (data) {
			var nextBatch = data.pop()['@metadata'].next_batch;
			return nextBatch;
		};
		$scope.setNextBatch = function (override) {
			$scope.nextBatch = override;
		};

		$rootScope.controls.fetch = function () {
			$scope.appendRows($scope.nextBatch);
		};
		$rootScope.controls.insert = function () {
			console.log('insert');
		};
		$rootScope.controls.save = function () {
			console.log('save');
		};
		$rootScope.controls.del = function () {
			console.log('del');
		};
		$rootScope.controls.search = function () {
			$rootScope.params.filters = !$rootScope.params.filters;
			console.log('search');
		};
		$rootScope.controls.undo = function () {
			console.log('undo');
		};
		$rootScope.controls.addFilter = function () {
			$scope.filters.push({
				column: $scope.table.columns[0],
				operator: $rootScope.operators[0],
				text: ''
			});
		};
		$rootScope.controls.removeFilter = function (index) {
			$scope.filters.splice(index, 1);
		};
		$rootScope.controls.runSearch = function (filters) {
			var parsed = 'filter=';
			var filterArr = [];
			console.log(filters);
			angular.forEach(filters, function (filter, index) {
				//column.name + operator.prefix + filter.text + operator.suffix
				//customers %{text}%
				filterArr[index] = filter.column.name + filter.operator.prefix + filter.text + filter.operator.suffix;
			});
			parsed += filterArr.join(' AND ');
			$scope.getRows(Data.auth.endpoint, parsed);
		};


		//no expectations
		Transit.on('ControlsFetch', $rootScope.controls.fetch);
		//expects data to be row in grid
		Transit.on('ControlSelectRow', function (event, data) {
			$scope.options.selectRow(data, true);
		});
		//expects data to be row in grid
		Transit.on('ControlDeselectRow', function (event, data) {
			$scope.options.selectRow(data, false);
		});
		//expects data to be $scope.filters object
		Transit.on('ControlRunSearch', function (event, data) {
			$rootScope.controls.runSearch(data);
		});

		Transit.on('GetFrameState', function (event, data) {
			var snapshot = {
				table: $scope.table,
				operators: $scope.operators
			};
			Transit.broadcast(data, snapshot)
		});
	}
]);