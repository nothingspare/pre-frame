Application.controller('GridController', [
	'$rootScope', '$scope', '$http', 'Transit', 'Data', '$timeout',
	function ($rootScope, $scope, $http, Transit, Data, $timeout) {
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
				//console.log(current.named);
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

		$scope.selected = {};
		$scope.$watch('selected', function (current) {
			console.log(current);
		});

		$scope.options = {
			data: 'data',
			enableCellSelection: true,
			enableRowSelection: true,
			enableCellEditOnFocus: true,
			showSelectionCheckbox: true,
			afterSelectionChange: function (row) {
				if (row.selected) {
					Transit.broadcast('RowSelected', row.entity);
					$scope.selected[row.rowIndex] = $scope.data[row.rowIndex];
				}
				else {
					Transit.broadcast('RowDeselected', row.entity);
					delete $scope.selected[row.rowIndex];
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
		$scope.populateMetadata = function (row) {
			var metadata = {
				action: 'INSERT',
				//href: Data.auth.apiBase + '/' + Data.auth.endpoint,
			};
			row['@metadata'] = metadata;
			return row;
		};
		$scope.addRow = function () {
			var row = _.object(_.keys($scope.table.named), []);
			angular.forEach(row, function (element, index) {
				row[index] = null;
			});
			$scope.populateMetadata(row);
			$scope.data.unshift(row);
			//populate the original data so the indexes align, side effect is undo doesn't remove inserted objects
			$scope.originalData.unshift(angular.copy(row));
			return row;
		};
		$scope.isValidRow = function (row) {
			return row && row['@metadata'] && row['@metadata'];
		};
		$scope.isUnsavedInsertedRow = function (row) {
			return row['@metadata'].action == 'INSERT';
		};
		$scope.isSavedInsertedRow = function (row) {
			return row['@metadata'].verb == 'INSERT';
		};
		$scope.isRowUpdating = function (row) {
			return row['@metadata'].action == 'UPDATE';
		};
		$scope.isRowDeleting = function (row) {
			return row['@metadata'].action == 'DELETE';
		};
		$scope.findInserts = function (arr, original) {
			var changed = {};
			angular.forEach(arr, function (element, index) {
				if ($scope.isValidRow(element) && $scope.isUnsavedInsertedRow(element)) {
					changed[index] = element;
				}
			});
			return changed;
		};
		$scope.findUpdates = function (arr, original) {
			console.log(arr);
			var changed = {};
			angular.forEach(arr, function (element, index) {
				if ($scope.isValidRow(element) && $scope.isRowUpdating(element)) {
					changed[index] = element;
				}
			});
			return changed;
		};
		$scope.findDels = function (arr, original) {
			var changed = {};
			angular.forEach(arr, function (element, index) {
				if ($scope.isValidRow(element) && $scope.isRowDeleting(element)) {
					changed[index] = element;
				}
			});
			return changed;
		};
		$scope.save = function (rows) {
			return Data.put(Data.auth.endpoint, rows);
		};
		$scope.replaceLocalInserts = function (inserts, summary) {
			angular.forEach(inserts, function (element, index) {
				$scope.data.splice(index, 1);
				$scope.originalData.splice(index, 1);
			});

			angular.forEach(summary, function (element, index) {
				if ($scope.isSavedInsertedRow(element) && element['@metadata'].resource == Data.auth.endpoint) {
					$scope.data.unshift(element);
					$scope.originalData.unshift(element);
				}
			});
			$scope.forceGridRefresh();
		};
		$scope.forceGridRefresh = function () {
			$scope.data.push({});
			$timeout(function () {
				$scope.data.pop();
			});
		};
		$scope.setRowAction = function (index, action, force) {
			//if override && action attribute exists
			if (!force && $scope.data[index]['@metadata'].action) {
				//don't update the action
				return;
			}
			$scope.data[index]['@metadata'].action = action;
		};
		$scope.$on('ngGridEventEndCellEdit', function (event) {
			var row = event.targetScope.$eval('row');
			var data = {
				row: row.entity,
				index: row.rowIndex,
				isSelected: row.selected,
				isChanged: false
			};
			if (!angular.equals(data.row, $scope.originalData[data.index])) {
				data.isChanged = true;
				$scope.setRowAction(data.index, 'UPDATE', false);
			}
			Transit.broadcast('RowEdit', data);
		});
		$scope.replaceLocalUpdates = function (updates, summary) {
			angular.forEach(summary, function (element, index) {
				angular.forEach(updates, function (e, i) {
					if ($scope.isValidRow(e) && $scope.isValidRow(element)) {
						if (e['@metadata'].href == element['@metadata'].href) {
							$scope.data[i] = element;
							$scope.originalData[i] = angular.copy(element);
						}
					}
				});
			});
			$scope.forceGridRefresh();
		};
		$scope.removeLocalDels = function (dels, summary) {
			angular.forEach(summary, function (element, index) {
				angular.forEach(dels, function (e, i) {
					if (e['@metadata'].action != 'DELETE') { console.log('test'); return;}
					if ($scope.isValidRow(e) && $scope.isValidRow(element)) {
						if (e['@metadata'].href == element['@metadata'].href) {
							$scope.data.splice(i, 1);
							$scope.originalData.splice(i, 1);
						}
					}
				});
			});
			$scope.forceGridRefresh();
		};

		$rootScope.controls.fetch = function () {
			if ($scope.nextBatch) {
				$scope.appendRows($scope.nextBatch);
			}
		};
		$rootScope.controls.insert = function () {
			$scope.addRow();
		};
		$rootScope.controls.save = function () {
			var inserts = $scope.findInserts($scope.data, $scope.originalData);
			var updates = $scope.findUpdates($scope.data, $scope.originalData);

			var batch = _.extend({}, inserts, updates);

			//if we have any batch attributes, save them
			if (!angular.equals({}, batch)) {
				$scope.save(_.values(batch)).success(function (data) {
					$scope.replaceLocalInserts(inserts, data.txsummary);
					$scope.replaceLocalUpdates(updates, data.txsummary);
					console.log(updates, data);
				})['error'](function (err) {
					console.log(err);
				});
			}
		};
		$rootScope.controls.del = function () {
			angular.forEach($scope.selected, function (element, index) {
				$scope.setRowAction(index, 'DELETE', false);
			});
			if (!angular.equals({}, $scope.selected)) {
				$scope.save(_.values($scope.selected)).success(function (data) {
					$scope.removeLocalDels($scope.selected, data.txsummary);
					console.log(data);
				})['error'](function (err) {
					console.log(err);
				});
			}
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
			angular.forEach(filters, function (filter, index) {
				//column.name + operator.prefix + filter.text + operator.suffix
				//customers %{text}%
				filterArr[index] = filter.column.name + filter.operator.prefix + filter.text + filter.operator.suffix;
			});
			parsed += filterArr.join(' AND ');
			$scope.getRows(Data.auth.endpoint, parsed);
		};


		//no expectations
		Transit.on('ControlSave', $rootScope.controls.save);
		//no expectations
		Transit.on('ControlDel', $rootScope.controls.del);
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
		//expects index and row object
		Transit.on('ControlUpdateRow', function (event, data) {});

		Transit.on('GetFrameState', function (event, data) {
			var snapshot = {
				table: $scope.table,
				operators: $scope.operators
			};
			Transit.broadcast(data, snapshot)
		});
		Transit.on('GetAllRows', function (event, data) {});
		Transit.on('GetSelectedRows', function (event, data) {});
		Transit.on('GetFilters', function (event, data) {});
	}
]);