Application.controller('GridController', [
	'$rootScope', '$scope', '$http', 'Transit', 'Data', '$timeout', 'Templates', '$modal',
	function ($rootScope, $scope, $http, Transit, Data, $timeout, Templates, $modal) {
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
				Transit.ping({
					broadcast: 'EventAfterSearch',
					data: {rows: rows},
					onReply: function (event, data) {
						if (data && data.rows) {
							$scope.data = data.rows;
							$scope.originalData = angular.copy(data.rows);
							$scope.refreshColDefs();
						}
					},
				}, window.parent);

				$scope.data = rows;
				$scope.originalData = angular.copy(rows);
				$scope.refreshColDefs();
				$(window).resize();
			});
		};

		$scope.refreshColDefs = function () {
			$scope.colDefs = [];
			if ($rootScope.config.columns) {
				$scope.colDefs = $rootScope.config.columns;
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
							displayName: display.join(' '),
						}

						if ($scope.table && $scope.table.named) {
							colDef.cellClass = 'generic-type-' + $scope.table.named[column].generic_type;
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

		//expects a full url
		//returns $http promise
		$scope.appendRows = function (url) {
			return Data.getUrl(url).success(function (data) {
				$scope.data = $scope.data.concat(data);
				$scope.originalData = $scope.originalData.concat(angular.copy(data));
			});
		};

		//a collection of columns and the foreign key they are a part of
		$scope.foreignColumns = {};

		//expects parents array from @tables request
		$scope.getForeignKeys = function (parents) {
			angular.forEach(parents, function (parent) {
				angular.forEach(parent.parent_columns, function (column) {
					$scope.foreignColumns[column] = parent;
				});
			});
		};

		$scope.parentLookup = function (ngRow, column) {
			//grab the index
			var index = $scope.data.indexOf(ngRow.entity);

			$scope.lookupModal = $modal.open({
				templateUrl: 'partials/parentLookup.html',
				controller: 'LookupController',
				size: 'lg',
				resolve: {
					relationship: function () { return $scope.foreignColumns[column] }
					//row: ngRow.entity,
					//index: index
				}
			});

			$scope.lookupModal.result.then(function (record) {
				Transit.ping({
					broadcast: 'ControlParentLookupSelection',
					data: record,
					onReply: function (event, data) {
						if (data && data.row) {
							angular.forEach($scope.foreignColumns[column].child_columns, function (column, i) {
								$scope.data[index][column] = record[$scope.foreignColumns[column].parent_columns[i]];
							});
							
							$scope.setRowAction(index, 'UPDATE', false);
						}
					},
				}, window.parent);
				angular.forEach($scope.foreignColumns[column].child_columns, function (column, i) {
					$scope.data[index][column] = record[$scope.foreignColumns[column].parent_columns[i]];
				});
				
				$scope.setRowAction(index, 'UPDATE', false);
			});

			//blur the dom element, required because of strange ng grid behaviors
			$timeout(function () {
				$('input').blur(); //prevents direct editing
			});

			Transit.ping({
				broadcast: 'CheckParentLookup',
				data: {},
				onReply: function (event, data) {
					if (!data) {
						$scope.lookupModal.dismiss();						
					}
				},
			}, window.parent);
		};

		//watcher and modifier of default column definitions
		//for example, by default foreign keys ought to behave differently than standard columns
		$scope.$watch('colDefs', function (current, previous) {
			var colDefKeys = _.indexBy(current, 'field');

			angular.forEach(current, function (definition, index) {
				//foreign key
				if ($scope.foreignColumns[definition.field]) {
					current[index].editableCellTemplate = Templates.get('foreignKey', $scope.foreignColumns[definition.field]);
				}
			});
		}, true);

		$scope.$on('AuthUpdate', function (event, auth) {
			$scope.getRows(auth.endpoint);
			Data.get('@tables/' + auth.endpoint).success(function (data) {
				$scope.table = data;
				$scope.getForeignKeys($scope.table.parents);
				angular.forEach($scope.table.columns, function (column, index) {
					$scope.table.named = _.indexBy($scope.table.columns, 'name');
				});
			});
		});

		$scope.selected = {};

		$scope.options = {
			data: 'data',
			enableCellSelection: true,
			enableRowSelection: true,
			enableCellEdit: true,
			showSelectionCheckbox: true,
			showFooter: true,
			footerTemplate: 'gridFooter.html',
			rowTemplate: '<div ' +
				'ng-style="{ \'cursor\': row.cursor }" ' +
				'ng-repeat="col in renderedColumns" ' +
				'ng-class="col.colIndex()" ' +
				'class="ngCell {{col.cellClass}} {{row.entity[\'@metadata\'].action && \'modified\'}}">' +
					'<div class="ngVerticalBar" ng-style="{height: rowHeight}" ng-class="{ ngVerticalBarVisible: !$last }">&nbsp;</div><div ng-cell></div>' +
				'</div>',
			beforeSelectionChange: function (row) {
				Transit.broadcast('EventBeforeSelection', row.entity);
				return true;
			},
			afterSelectionChange: function (row) {
				if (row.selected) {
					Transit.broadcast('EventRowSelected', row.entity);
					var index = $scope.data.indexOf(row.entity);
					$scope.selected[index] = $scope.data[index];
				}
				else {
					Transit.broadcast('EventRowDeselected', row.entity);
					delete $scope.selected[row.rowIndex];
				}
			},
			columnDefs: 'colDefs'
		};
		$scope.colDefs = [];

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
		$scope.addRow = function (row) {
			var defaultRowAttributes = _.object(_.keys($scope.table.named), []);
			angular.forEach(defaultRowAttributes, function (element, index) {
				if (!row[index]) {
					row[index] = null;
				}
			});
			$scope.populateMetadata(row);
			$scope.data.unshift(row);
			//populate the original data so the indexes align, side effect is undo doesn't remove inserted objects
			$scope.originalData.unshift(angular.copy(row));
			Transit.broadcast('EventRowInserted', row);
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

		$scope.$on('ngGridEventStartCellEdit', function (event, data) {
			Transit.ping({
				broadcast: 'CheckStartEdit',
				data: {test:true},
				onReply: function (event, data) {
					if (data === false) {
						$('*').blur();
					}
				}
			}, window.parent);
		});

		$scope.$on('ngGridEventDigestCell', function (event, data) {
			console.log('digesting grid');
		});
		$scope.$on('ngGridEventEndCellEdit', function (event, data) {
			var row = event.targetScope.$eval('row');
			var data = {
				row: row.entity,
				index: $scope.data.indexOf(row.entity),
				isSelected: row.selected,
				isChanged: false
			};
			if (!angular.equals(data.row, $scope.originalData[data.index])) {
				data.isChanged = true;
				$scope.setRowAction(data.index, 'UPDATE', false);
			}
			Transit.broadcast('EventRowEdit', data);
			console.log(event.targetScope.row.entity);
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
							$scope.selected.splice(i, 1);
						}
					}
				});
			});
			$scope.forceGridRefresh();
		};

		$(window).resize(function () {
			$scope.$evalAsync(function () {
				console.log($('.ngRow').length)
				var controlHeight = 60
				var maxHeight = $scope.data.length * '30';
				var height = $(window).height() - controlHeight;
				if (maxHeight < height) {
					height = maxHeight + controlHeight;
				}
				$('.ngGrid').height(height);
			});
		});

		$scope.alertMessage = null;
		$scope.prevAlert = null;
		$scope.alert = function (message, timeout) {
			if (!timeout) { timeout = 2500; }
			$scope.alertMessage = message;
			if ($scope.prevAlert) {
				$timeout.cancel($scope.prevAlert);
			}
			$scope.prevAlert = $timeout(function () {
				$scope.alertMessage = null;
			}, timeout);
		};
		$scope.modal = function (message) {
			return $modal.open({
				template: message,
				windowClass: 'alert-modal',
				controller: function () {}
			});
		};

		$rootScope.controls.fetch = function () {
			if ($scope.nextBatch) {
				$scope.appendRows($scope.nextBatch);
				$scope.alert('Fetching ...');
			}
		};
		$scope.isRowInsertAllowed = true;
		$rootScope.controls.insert = function (row) {
			Transit.ping({
				broadcast: 'CheckAddRow',
				data: {},
				onReply: function (event, data) {
					if (!data) {
						$scope.isRowInsertAllowed = true;
					}
				}
			});

			$timeout(function () {
				if (!$scope.isRowInsertAllowed) {return;}
				if (!row) {
					row = {};
				}
				$scope.addRow(row);

			}, 150);
		};

		$rootScope.controls.save = function () {
			var inserts = $scope.findInserts($scope.data, $scope.originalData);
			var updates = $scope.findUpdates($scope.data, $scope.originalData);

			var batch = _.extend({}, inserts, updates);

			//if we have any batch attributes, save them
			if (!angular.equals({}, batch)) {
				$scope.alert('Saving ...');
				$scope.save(_.values(batch)).success(function (data) {
					$scope.replaceLocalInserts(inserts, data.txsummary);
					$scope.replaceLocalUpdates(updates, data.txsummary);
					console.log(updates, data);
					var modified = {};
					angular.forEach(data.txsummary, function (element, index) {
						if ($scope.isValidRow(element)) {
							if (!modified[element['@metadata'].verb]) { modified[element['@metadata'].verb] = 0; }
							modified[element['@metadata'].verb]++
						}
					});
					var alertFragments = [];
					angular.forEach(modified, function (count, action) {
						alertFragments.push(action + ': ' + count);
					});
					$scope.alert('[Objects Modified] ' + alertFragments.join(', '), 4000);
				})['error'](function (err) {
					$scope.modal(err.errorMessage);
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
				})['error'](function (err) {
					console.log(err);
					$scope.modal(err.errorMessage);
				});
			}
		};
		$rootScope.controls.search = function () {
			if (!$scope.filters.length) {
				$rootScope.controls.addFilter();
			}
			$rootScope.params.filters = !$rootScope.params.filters;
		};
		$rootScope.controls.undo = function () {
			$scope.data = angular.copy($scope.originalData);
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
		$scope.isSearchRunnable = true;
		$rootScope.controls.runSearch = function (filters) {
			Transit.ping({
				broadcast: 'CheckBeforeSearch',
				data: $scope.filters,
				onReply: function (event, data) {
					if (!data) {
						$scope.isSearchRunnable = false;
					}
				},
			}, window.parent);

			$timeout(function () {
				$scope.alert('Searching ...');
				if (!$scope.isSearchRunnable) { return; }
				var parsed = 'filter=';
				var filterArr = [];
				angular.forEach(filters, function (filter, index) {
					//column.name + operator.prefix + filter.text + operator.suffix
					//customers %{text}%
					filterArr[index] = filter.column.name + filter.operator.prefix + filter.text + filter.operator.suffix;
				});
				parsed += filterArr.join(' AND ');
				$scope.getRows(Data.auth.endpoint, parsed);
			}, 150);
		};


		//no expectations
		Transit.on('ControlSave', $rootScope.controls.save);
		//no expectations
		Transit.on('ControlDel', $rootScope.controls.del);
		//no expectations
		Transit.on('ControlFetch', $rootScope.controls.fetch);
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
			console.log('search', data);
			$rootScope.controls.runSearch(data);
		});
		//expects data.index and a data.row object
		Transit.on('ControlUpdateRow', function (event, data) {
			$scope.data[data.index] = _.extend($scope.data[data.index], data.row);
		});
		//expects a new data.row object
		Transit.on('ControlInsertRow', function (event, data) {
			$scope.controls.insert(data.row);
		});

		Transit.on('GetFrameState', function (event, data) {
			var snapshot = {
				table: $scope.table,
				operators: $scope.operators
			};
			Transit.broadcast(data, snapshot);
		});
		Transit.on('GetAllRows', function (event, data) {
			Transit.broadcast(data, $scope.data);
		});
		//Transit.on('GetSelectedRows', function (event, data) {});
		Transit.on('GetFilters', function (event, data) {
			Transit.broadcast(data, $scope.filters);
		});
	}
]);