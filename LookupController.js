Application.controller('LookupController', [
	'$rootScope', '$scope', '$http', 'Transit', 'Data', '$timeout', 'Templates', 'relationship', '$modalInstance',
	function ($rootScope, $scope, $http, Transit, Data, $timeout, Templates, relationship, $modalInstance) {
		$scope.data = [];
		$scope.colDefs = [];
		$scope.controls = {};
		$scope.nextBatch = false;
		$scope.params = {};
		$scope.filters = [];

		$scope.options = {
			data: 'data',
			enableCellSelection: true,
			enableRowSelection: true,
			showFooter: true,
			footerTemplate: 'partials/lookupFooter.html',
			afterSelectionChange: function (row) {
				$modalInstance.close(row.entity);
				return;
			},
			columnDefs: 'colDefs'
		};

		$scope.$evalAsync(function () {
			$scope.getRows(relationship.parent_table);
			Data.get('@tables/' + relationship.parent_table).success(function (data) {
				$scope.table = data;
			});
		});

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
				$scope.refreshColDefs();
			});
		};

		$scope.refreshColDefs = function (specialColumns) {
			$scope.colDefs = [];
			if ($rootScope.config.parentColumns[relationship.name]) {
				$scope.colDefs = $rootScope.config.parentColumns[relationship.name];
			}
			else {
				if ($scope.data[0]) {
					var columns = _.keys($scope.data[0]);
					angular.forEach(columns, function (column) {
						if (column == '@metadata') {return;}
						var colDef = null;
						var words = _.words(_.humanize(column));
						var display = [];
						angular.forEach(words, function (word) {
							display.push(_.capitalize(word));
						});
						colDef = {
							field: column,
							displayName: display.join(' ')
						}

						if (colDef) {
							$scope.colDefs.push(colDef);
						}
					});
				}
				else {
					console.log('no data, no column keys');
				}
			}
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
		$scope.getPaginationObj = function (data) {
			var nextBatch = data.pop()['@metadata'].next_batch;
			return nextBatch;
		};
		$scope.setNextBatch = function (override) {
			$scope.nextBatch = override;
		};
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
		$scope.appendRows = function (url) {
			return Data.getUrl(url).success(function (data) {
				$scope.data = $scope.data.concat(data);
			});
		};
		$scope.controls.fetch = function () {
			if ($scope.nextBatch) {
				$scope.appendRows($scope.nextBatch);
			}
		};
		$scope.controls.search = function () {
			if (!$scope.filters.length) {
				$scope.controls.addFilter();
			}
			$scope.params.filters = !$scope.params.filters;
		};
		$scope.controls.addFilter = function () {
			$scope.filters.push({
				column: $scope.table.columns[0],
				operator: $rootScope.operators[0],
				text: ''
			});
		};
		$scope.controls.removeFilter = function (index) {
			$scope.filters.splice(index, 1);
		};
		$scope.controls.runSearch = function (filters) {
			var parsed = 'filter=';
			var filterArr = [];
			angular.forEach(filters, function (filter, index) {
				//column.name + operator.prefix + filter.text + operator.suffix
				//customers %{text}%
				filterArr[index] = filter.column.name + filter.operator.prefix + filter.text + filter.operator.suffix;
			});
			parsed += filterArr.join(' AND ');
			$scope.getRows(Data.auth.endpoint, parsed);
		};
		//addFilter
		//removeFilter
		//runSearch
	}
]);