(function() {
	'use strict';

	var app = angular.module('app', ['ngAnimate']);

	app.factory('Website', function($q, $http) {
		return {
			// 入力されたURLを格納
			top: '',
			// チェックしたページとそのページ内のリンクを格納
			pages: [],
			// URLベースでアクセス可否を格納
			cache: [],
			result: {
				success: [],
				warning: [],
				error: []
			},
			// どのURLをチェック中か等
			message: '',
			// pagesをループさせる際のインデックス
			current: 0,
			complete: false,
			// Viewから呼ばれる関数
			check: function(url) {
				var self = this;
				var set = function(url) {
					// ユーザーの入力URLを保存
					self.top = url;
					// 入力URLをpagesに追加
					var newPage = {
						url: url,
						enabled: null,
						inner: [],
						count: {
							success: 0,
							warning: 0,
							error: 0
						}
					};
					self.pages.push(newPage);
				};
				// サイト内をクロールする関数（未チェックのURLがなくなるまで再帰的に呼ばれる）
				var crawl = function() {
					// 1ページ内をスクレイピングしてURLを取得する関数
					var search = function(url) {
						var d = $q.defer();
						// 配列内の重複チェック関数
						var isDuplicated = function(str, array) {
							var duplicated = false;
							angular.forEach(array, function(value) {
								if (value === str) {
									duplicated = true;
								}
							});
							return duplicated;
						};
						// あるURLのアクセス可否を調べる関数
						var isAccessible = function(url) {
							var d = $q.defer();
							var api = 'api/headers.php';
							var query = {
								params: {
									url: url
								}
							};
							var callback = function(response) {
								switch (response.data.status) {
									case 200:
										d.resolve(response.data.status);
										break;
									case 404:
										d.reject(response.data.status);
										break;
									default:
										// status が false なら
										if (!response.data.status) {
											// エラーにする処理
										}
										d.notify(response.data.status);
										break;
								}
							};
							$http.get(api, query).then(callback);
							return d.promise;
						};
						var api = 'api/scraping.php';
						var query = {
							params: {
								url: url
							}
						};
						var callback = function(response) {
							var data = response.data;
							if (data.status) {
								angular.forEach(data.originals, function(href) {
									var absoluteUrl = getAbsoluteUrl(href, data.url);
									var addInnerPage = function() {
										// 現在のページにまだ存在しないURLなら
										if (!isDuplicated(href, self.pages[self.current].inner)) {
											// ページ内URLに追加
											var newUrl = {
												url: href,
												absoluteUrl: absoluteUrl,
												enabled: null,
												status: null
											};
											self.pages[self.current].inner.push(newUrl);
										}
									};
									var checkCache = function() {
										// cache に追加済みかチェック
										var cached = false;
										angular.forEach(self.cache, function(cache) {
											if (cache.url === absoluteUrl) {
												cached = cache;
												return;
											}
										});
										var index = self.current;
										var innerIndex = self.pages[self.current].inner.length - 1;
										if (cached) {
											// cache に追加済みの場合はページ内URLの enabled を更新
											self.pages[index].inner[innerIndex].enabled = cached.enabled;
											self.pages[index].inner[innerIndex].status = cached.status;
											self.pages[index].count[cached.enabled]++;
										} else {
											var pushToCache = function(enabled, result) {
												// cache に追加
												var newUrl = {
													url: absoluteUrl,
													enabled: enabled,
													status: result
												};
												self.cache.push(newUrl);
											};
											var success = function(result) {
												self.pages[index].inner[innerIndex].enabled = 'success';
												self.pages[index].inner[innerIndex].status = result;
												self.pages[index].count.success++;
												self.result.success.push({
													url: self.pages[index].inner[innerIndex].absoluteUrl,
													status: result
												});
												pushToCache('success', result);
											};
											var failed = function(result) {
												self.pages[index].inner[innerIndex].enabled = 'error';
												self.pages[index].inner[innerIndex].status = result;
												self.pages[index].count.error++;
												self.result.error.push({
													url: self.pages[index].inner[innerIndex].absoluteUrl,
													status: result
												});
												pushToCache('error', result);
											};
											var notify = function(result) {
												self.pages[index].inner[innerIndex].enabled = 'warning';
												self.pages[index].inner[innerIndex].status = result;
												self.pages[index].count.warning++;
												self.result.warning.push({
													url: self.pages[index].inner[innerIndex].absoluteUrl,
													status: result
												});
												pushToCache('warning', result);
											};
											// cache に未追加の場合はアクセス可否をチェック
											isAccessible(absoluteUrl).then(success, failed, notify);
										}
									};
									var addPage = function() {
										// pages に追加済みかチェック
										var dFlg = false;
										angular.forEach(self.pages, function(item) {
											if (item.url === absoluteUrl) {
												dFlg = true;
											}
										});
										// サイト内のURLかどうかチェック
										var isInnerSite = absoluteUrl.indexOf(self.top) === 0;
										// 画像ファイルかどうかチェック
										var isImageFile = absoluteUrl.search(/(.jpg|.gif|.png)$/i) !== -1;
										// 条件に合致すれば pages に追加
										if (isInnerSite && !dFlg && !isImageFile) {
											var newPage = {
												url: absoluteUrl,
												enabled: null,
												inner: [],
												count: {
													success: 0,
													warning: 0,
													error: 0
												}
											};
											self.pages.push(newPage);
										}
									};
									addInnerPage();
									checkCache();
									addPage();
								});
								d.resolve();
							} else {
								d.reject();
							}
						};
						$http.get(api, query).then(callback);
						return d.promise;
					};
					var success = function() {
						self.pages[self.current].enabled = true;
						hasNextPage();
					};
					var failed = function() {
						self.pages[self.current].enabled = false;
						hasNextPage();
					};
					var hasNextPage = function() {
						self.current++;
						if (typeof self.pages[self.current] !== 'undefined') {
							crawl();
						} else {
							self.message = '';
							self.complete = true;
						}
					};
					self.message = self.pages[self.current].url;
					search(self.pages[self.current].url).then(success, failed);
				};
				set(url);
				crawl();
			}
		};
	});

	app.controller('AppController', ['$scope', 'Website', function AppController($scope, Website) {
		var setHeight = function(selectors) {
			var winHeight = document.documentElement.clientHeight;
			var displayHeight = winHeight - 57 - 47;
			angular.forEach(selectors, function(selector) {
				angular.element(document.querySelectorAll(selector)).css('height', displayHeight + 'px');
			});
		};
		$scope.Website = Website;
		$scope.$watch('Website.message', function() {
			setHeight(['.display']);
		});
		setHeight(['.display', '.notification']);
		$scope.checkChildRadio = function(index) {
			if ($scope.selectedResultBox.id == index + 1) {
				return $scope.closeResultBox(index);
			} else {
				return $scope.selectedResultBox.id = index + 1;
			}
		};
		$scope.selectedResultBox = { id: 0 };
		$scope.checkSelectedResultBox = function(index) {
			return $scope.selectedResultBox.id == index + 1;
		};
		$scope.closeResultBox = function(index) {
			return $scope.selectedResultBox.id = 0;
		};
		$scope.summary = function() {
			return $scope.selectedResultBox.id > 0;
		};
		window.addEventListener('resize', function() {
			setHeight(['.display', '.notification']);
		});
	}]);

	app.filter('deleteDomain', function(Website) {
		return function(input) {
			var result = input.replace(Website.top, '');
			return result ? result : Website.top;
		};
	});

	// 任意のウェブページのURLとhref属性の値から絶対URLを返す
	var getAbsoluteUrl;
	window.onload = function() {
		getAbsoluteUrl = (function() {
			// 事前にiframeを追加しとく
			var work = document.createElement('iframe');
			work.style.display = 'none';
			document.body.appendChild(work);
			// 実際の関数部分
			return function(path, base) {
				var wdoc = work.contentWindow.document;
				var url = path;
				wdoc.open();
				wdoc.write('<head><base href="' + base + '"><\/head><body><a href="' + path + '"><\/a><\/body>');
				wdoc.close();
				url = wdoc.getElementsByTagName('a')[0].href;
				return url;
			};
		})();
	};
})();
