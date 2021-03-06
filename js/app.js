DATA = {
	providers : {
		youtube : 1,
		soundcloud : 2,
		lastfm : 3
	},
	getItem : function(id, callback) {
		if(!window.chrome.storage) callback(JSON.parse(window.localStorage.getItem(id)));
		else window.chrome.storage.sync.get(id, function(items) {
			callback(items[id]);
		});
	},
	setItem : function(id, value, callback) {
		var onChange = function() {
				var collection = id.split(':')[0];
				!DATA[collection] && (collection += 's');
				DATA[collection] && DATA[collection].onChange && DATA[collection].onChange(id.substr(id.split(':')[0].length + 1) || true);
				callback && callback();
			};
		
		if(!window.chrome.storage) {
			window.localStorage.setItem(id, JSON.stringify(value));
			onChange();
		} else {
			var items = {};
			items[id] = value;
			window.chrome.storage.sync.set(items, onChange);
		}
	},
	removeItem : function(id, callback) {
		var onChange = function() {
				var collection = id.split(':')[0];
				!DATA[collection] && (collection += 's');
				DATA[collection] && DATA[collection].onChange && DATA[collection].onChange(id.substr(id.split(':')[0].length + 1) || true);
				callback && callback();
			};

		if(!window.chrome.storage) {
			window.localStorage.removeItem(id);
			onChange();
		} else window.chrome.storage.sync.remove(id, onChange);
	},
	playlists : {
		getAll : function(callback) {
			DATA.getItem('playlists', function(playlists) {
				var data = [],
					cb = function() {
						count--;
						if(count > 0) return;
						callback(data);
					};

				if(!playlists || !playlists.length) return callback(data);
				var count = playlists.length;
				playlists.forEach(function(id, index) {
					DATA.getItem('playlist:' + id, function(p) {
						p.id = id;
						p.dataKey = 'playlist:' + id;
						p.link = '/playlist/' + id;
						data[index] = p;
						cb();
					});
				});
			});
		},
		get : function(id, callback) {
			var dataKey = 'playlist:' + id;
			DATA.getItem(dataKey, function(playlist) {
				var cb = function() {
						count--;
						if(count > 0) return;
						callback(playlist);
					};

				if(!playlist) return callback && callback();
				playlist.dataKey = dataKey;
				if(!playlist.songs.length) return callback(playlist);
				var count = playlist.songs.length;
				playlist.songs.forEach(function(id, index) {
					DATA.getItem('song:' + id, function(s) {
						s.provider = parseInt(id.split(':')[0], 10);
						s.provider_id = id.split(':')[1];
						playlist.songs[index] = s;
						cb();
					});
				});
			});
		},
		add : function(title, callback) {
			DATA.getItem('playlists', function(playlists) {
				playlists = playlists || [];
				var newId = 1;
				playlists.forEach(function(id) {
					id >= newId && (newId = id + 1);
				});
				playlists.unshift(newId);
				DATA.setItem('playlist:' + newId, {
					title : LIB.escapeHTML(title),
					songs : []
				}, function() {
					DATA.setItem('playlists', playlists, function() {
						callback && callback(newId);
					});
				});
			});
		},
		remove : function(id, callback) {
			DATA.getItem('playlists', function(playlists) {
				var index = playlists.indexOf(id);
				if(index === -1) return callback && callback();
				playlists.splice(index, 1);
				DATA.setItem('playlists', playlists, function() {
					DATA.removeItem('playlist:' + id, callback);
				});
			});
		},
		reorder : function(playlistId, below, album, callback) {
			var dataKey = album ? 'albums' : 'playlists';
			DATA.getItem(dataKey, function(playlists) {
				var ids = [],
					indexes = [],
					reordered = [];

				playlists.forEach(function(id, i) {
					id === below && reordered.push(playlistId);
					id !== playlistId && reordered.push(id);
				});
				below === null && reordered.push(playlistId);
				DATA.setItem(dataKey, reordered, callback);
			});
		},
		addSongs : function(id, songs, callback, index) {
			var cb = function(playlist) {
					DATA.setItem('playlist:' + id, playlist, callback);
				};

			DATA.getItem('playlist:' + id, function(playlist) {
				index = index === 0 || index > 0 ? index : playlist.songs.length;
				var count = songs.length;
				
				songs.forEach(function(s) {
					var id = parseInt(s.provider, 10) + ':' + LIB.escapeHTML(s.provider_id),
						add = function() {
							playlist.songs.splice(index, 0, id);
							index++;
							count--;
							if(count > 0) return;
							cb(playlist);
						};

					DATA.getItem('song:' + id, function(song) {
						if(song) return add();
						song = {
							title : LIB.escapeHTML(s.title),
							time : parseInt(s.time, 10)
						};
						s.artist && (song.artist = {
							mbid : LIB.escapeHTML(s.artist.mbid),
							name : LIB.escapeHTML(s.artist.name)
						});
						DATA.setItem('song:' + id, song, add);
					});
				});
			});
		},
		removeSong : function(id, index, provider, provider_id, callback) {
			DATA.getItem('playlist:' + id, function(playlist) {
				var sid = playlist.songs[index];
				if(!sid || parseInt(sid.split(':')[0], 10) !== provider || sid.split(':')[1] !== provider_id) return callback(playlist.songs);
				playlist.songs.splice(index, 1);
				DATA.setItem('playlist:' + id, playlist, callback);
			});
		},
		reorderSongs : function(id, songs, callback, index) {
			DATA.getItem('playlist:' + id, function(playlist) {
				var ids = [],
					indexes = [],
					reordered = [];

				songs.forEach(function(s) {
					var id = s.provider + ':' + s.provider_id;
					if(playlist.songs[s.index] !== id) return;
					ids.push(id);
					indexes.push(s.index);
				});
				playlist.songs.forEach(function(id, i) {
					i === index && ids.forEach(function(id) {
						reordered.push(id);
					});
					indexes.indexOf(i) === -1 && reordered.push(id);
				});
				index === null && ids.forEach(function(id) {
					reordered.push(id);
				});
				playlist.songs = reordered;
				DATA.setItem('playlist:' + id, playlist, callback);
			});
		}
	},
	albums : {
		getAll : function(callback) {
			DATA.getItem('albums', function(albums) {
				var data = [],
					cb = function() {
						count--;
						if(count > 0) return;
						callback(data);
					};

				if(!albums || !albums.length) return callback(data);
				var count = albums.length;
				albums.forEach(function(id, index) {
					DATA.getItem('album:' + id, function(a) {
						a.id = id;
						a.dataKey = 'album:' + id;
						a.fullTitle = a.artist.name + ' - ' + a.title;
						a.link = '/album/' + id;
						data[index] = a;
						cb();
					});
				});
			});
		},
		get : function(id, callback) {
			var dataKey = 'album:' + id;
			DATA.getItem(dataKey, function(album) {
				if(!album) return callback(null);
				var cb = function() {
						count--;
						if(count > 0) return;
						callback(album);
					};

				album.dataKey = dataKey;
				album.stored = true;
				album.artist.link = '/artist/' + album.artist.mbid;
				if(!album.songs.length) return callback(album);
				var count = album.songs.length;
				album.songs.forEach(function(id, index) {
					DATA.getItem('song:' + id, function(s) {
						s.provider = parseInt(id.split(':')[0], 10);
						s.provider_id = id.split(':')[1];
						album.songs[index] = s;
						cb();
					});
				});
			});
		},
		add : function(data, callback) {
			DATA.getItem('albums', function(albums) {
				albums = albums || [];
				if(albums.indexOf(data.id) !== -1) return callback && callback(data.id);
				albums.unshift(data.id);
				var album = {
						artist : {
							mbid : LIB.escapeHTML(data.artist.mbid),
							name : LIB.escapeHTML(data.artist.name)
						},
						title : LIB.escapeHTML(data.title),
						image : LIB.escapeHTML(data.image),
						songs : [],
						tags : []
					},
					count = data.songs.length,
					cb = function() {
						DATA.setItem('album:' + data.id, album, function() {
							DATA.setItem('albums', albums, function() {
								callback && callback(data.id);
							});
						});
					};

				data.tags.forEach(function(t) {
					album.tags.push(LIB.escapeHTML(t.name));
				});
				if(count === 0) return cb();
				data.songs.forEach(function(s, index) {
					var id = DATA.providers.lastfm + ':' + LIB.escapeHTML(s.provider_id),
						add = function() {
							album.songs[index] = id;
							count--;
							if(count > 0) return;
							cb();
						};

					DATA.getItem('song:' + id, function(song) {
						if(song) return add();
						DATA.setItem('song:' + id, {
							title : LIB.escapeHTML(s.title),
							time : parseInt(s.time, 10),
							artist : {
								mbid : LIB.escapeHTML(s.artist.mbid),
								name : LIB.escapeHTML(s.artist.name)
							}
						}, add);
					});
				});
			});
		},
		remove : function(id, callback) {
			DATA.getItem('albums', function(albums) {
				var index = albums.indexOf(id);
				if(index === -1) return callback && callback();
				albums.splice(index, 1);
				DATA.setItem('albums', albums, function() {
					DATA.removeItem('album:' + id, callback);
				});
			});
		}
	},
	loved : {
		getAll : function(callback) {
			DATA.getItem('loved', function(loved) {
				var cb = function() {
						count--;
						if(count > 0) return;
						callback(loved);
					};

				loved = loved || [];
				if(!loved.length) return callback(loved);
				var count = loved.length;
				loved.forEach(function(id, index) {
					DATA.getItem('song:' + id, function(s) {
						s.provider = parseInt(id.split(':')[0], 10);
						s.provider_id = id.split(':')[1];
						loved[index] = s;
						cb();
					});
				});
			});
		},
		add : function(songs, callback) {
			DATA.getItem('loved', function(loved) {
				loved = loved || [];

				var index = 0, //TODO: This will be used for adding into a defined position (dragging)
					count = songs.length;
				
				songs.forEach(function(s) {
					var id = parseInt(s.provider, 10) + ':' + LIB.escapeHTML(s.provider_id),
						add = function() {
							loved.splice(index, 0, id);
							index++;
							count--;
							if(count > 0) return;
							DATA.setItem('loved', loved, callback);
						};

					if(loved.indexOf(id) !== -1) {
						count--;
						return;
					}

					DATA.getItem('song:' + id, function(song) {
						if(song) return add();
						song = {
							title : LIB.escapeHTML(s.title),
							time : parseInt(s.time, 10)
						};
						s.artist && (song.artist = {
							mbid : LIB.escapeHTML(s.artist.mbid),
							name : LIB.escapeHTML(s.artist.name)
						});
						DATA.setItem('song:' + id, song, add);
					});
				});
			});
		},
		remove : function(id, callback) {
			DATA.getItem('loved', function(loved) {
				loved = loved || [];
				var index = loved.indexOf(id);
				if(index === -1) return callback && callback();
				loved.splice(index, 1);
				DATA.setItem('loved', loved, callback);
			});
		},
		check : function(id, callback) {
			DATA.getItem('loved', function(loved) {
				loved = loved || [];
				var index = loved.indexOf(id);
				if(index === -1) return callback(false);
				callback(true);
			});
		}
	}
};

TEMPLATE = {
	playlist : {
		data : function(params, callback) {
			var id = parseInt(params[0], 10);
			delete TEMPLATE.playlist.selectedSongs;
			if(!id) return callback({
				title : L.newPlaylist.replace(/{{date}}/, LIB.formatDate(new Date()))
			});
			DATA.playlists.get(id, function(p) {
				if(!p) return ROUTER.update('/');
				callback(p);
			});
		},
		render : function(data) {
			var form = $('section form');
			form.submit(TEMPLATE.playlist.search);
			$('section div.half menu li a').each(function(i, a) {
				a = $(a);
				a.click(function() {
					$('li', a.parents('menu').first()).removeClass('selected');
					a.parent().addClass('selected');
					var p = i + 1,
						pi = $('input[name="provider"]', form); 
					
					if(parseInt(pi.val(), 10) === p) return;
					pi.val(p);
					form.submit();
				});
			});
			var actions = $('div.header menu.actions');
			$('a.remove', actions).click(function() {
				$(this).parent().hide().next().show();
			});
			$('a.cancel', actions).click(function() {
				$(this).parent().hide().prev().show();
			});
			$('a.ok', actions).click(function() {
				DATA.playlists.remove(parseInt(data.dataKey.split(':')[1], 10), function() {
					ROUTER.update('/');
				});
			});
			$('aside menu li' + (data.dataKey ? '[key="' + data.dataKey + '"]' : '.create')).addClass('selected');
			TEMPLATE.playlist.renderSongs(data);
			$('section input').first().focus();
			$(window).bind('mousedown', TEMPLATE.playlist.resetSelection);
			ROUTER.onUnload = function() {
				$(window).unbind('mousedown', TEMPLATE.playlist.resetSelection);
			};
		},
		renderSongs : function(playlist) {
			var dest = $('section table').first(),
				songs = playlist.songs;

			dest.empty();
			if(!songs || !songs.length) {
				var tr = $('<tr><td class="empty">' + L.emptyPlaylist + '</td></tr>');
				TEMPLATE.song.hookDrop(tr);
				return dest.append(tr);
			}
			DATA.getItem('loved', function(loved) {
				loved = loved || [];
				songs.forEach(function(s, i) {
					s.num = LIB.addZero(i + 1);
					loved.indexOf(s.provider + ':' + s.provider_id) !== -1 && (s.love = true);
					TEMPLATE.playlist.song(s, dest, playlist);
				});
				TEMPLATE.playlist.setPlayingSong();
			});
		},
		search : function(e) {
			LIB.cancelHandler(e);
			var dest = $('section div.border table').first(),
				query = $(e.target.query).val(),
				provider = parseInt($(e.target.provider).val(), 10) || DATA.providers.youtube;

			if(query === '') return;
			$(e.target).next().show();
			dest.empty();
			switch(provider) {
				case DATA.providers.youtube:
					var renderYT = function(feed, query, page, r, count, dest) {
							if(r.entry) {
								r.entry.forEach(function(e) {
									if(count === 100 /*|| (e.app$control && e.app$control.yt$state && e.app$control.yt$state.name === 'restricted')*/) return;
									var s = {
											num : LIB.addZero(count + 1),
											id : 'searchYT' + feed + (query || '') + count,
											provider : DATA.providers.youtube,
											provider_id : e.id.$t.substr(e.id.$t.lastIndexOf('/') + 1),
											title : e.title.$t,
											time : parseInt(e.media$group.yt$duration ? e.media$group.yt$duration.seconds : 0, 10),
											search : true
										};
									
									e.yt$hd && (s.hd = true);
									TEMPLATE.playlist.song(s, dest);
									count++;
								});
								
								page++;
								if(count < 100 && r.openSearch$totalResults.$t > page * 50) {
									setTimeout(function() {
										YT.search(feed, query, page, function(r) {
											renderYT(feed, query, page, r, count, dest);
										});
									}, 10 * page);
								}
							} else if(page === 0 && count === 0) dest.text("no youtube videos found.");
						};
					
					YT.search('videos', query, 0, function(r) {
						renderYT('videos', query, 0, r, 0, dest);
						dest.parent().show();
					});
				break;
				case DATA.providers.soundcloud:
					SC.search(query, function(r) {
						r.forEach(function(t, i) {
							var s = {
									num : LIB.addZero(i + 1),
									id : 'searchSC' + query + i,
									provider : DATA.providers.soundcloud,
									provider_id : t.id,
									title : t.user.username + ' - ' + t.title,
									time : Math.round(t.duration / 1000),
									search : true
								};

							TEMPLATE.playlist.song(s, dest);
						});
						if(r.length === 0) {
							dest.text("no soundcloud songs found.");
						} else {
							SC.reqArtworks();
						}
						dest.parent().show();
					});
				break;
			}
		},
		song : function(song, dest, playlist) {
			var tr = $(Handlebars.partials.song(song)),
				h1 = $('section .header h1'),
				pf = function() {
					PLAYER.queue = playlist.songs;
					PLAYER.queueDataKey = playlist.dataKey;
					PLAYER.load(tr[0].rowIndex);
					$('li.title a', 'footer').attr('href', '/playlist/' + playlist.id);
				},
				cf = function(play) {
					if(!song.search) {
						if(song.provider !== DATA.providers.lastfm) return play && pf();
						return TEMPLATE.song.bestMatch(song, function(match) {
							if(!match) return tr.addClass('error');
							play && pf();
						});
					}

					var dataKey = h1.attr("key"),
						add = function() {
							var id = dataKey.split(':')[1];
							DATA.playlists.addSongs(id, [song], function() {
								DATA.playlists.get(id, function(playlist) {
									TEMPLATE.playlist.renderSongs(playlist);
								});
							});
						};
					
					if(dataKey === 'undefined') return DATA.playlists.add(h1.attr("value"), function(id) {
						dataKey = 'playlist:' + id; 
						h1.attr("key", dataKey);
						add();
					});
					add();
				};

			$(tr).dblclick(cf);
			$('a.play', tr).click(cf);
			TEMPLATE.song.hookDrag(tr, song);
			!song.search && TEMPLATE.song.hookLove(tr, song);
			if(!song.search && !song.album) {
				$('a.remove', tr).click(function() {
					var dataKey = h1.attr("key");
					if(dataKey === 'undefined') return;
					var id = dataKey.split(':')[1];
					DATA.playlists.removeSong(id, tr[0].rowIndex, song.provider, song.provider_id, function() {
						DATA.playlists.get(id, function(playlist) {
							TEMPLATE.playlist.renderSongs(playlist);
						});
					});
				});
				TEMPLATE.song.hookDrop(tr, song);
			}
			dest.append(tr);
			!song.search && song.provider === DATA.providers.lastfm && setTimeout(function() {
				cf();
			}, tr[0].rowIndex * 50);
		},
		resetSelection : function() {
			var sel = TEMPLATE.playlist.selectedSongs;
			if(!sel) return;
			sel.forEach(function(s) {
				s.tr.removeClass('selected');
			});
			delete TEMPLATE.playlist.selectedSongs;
		},
		setPlayingSong : function() {
			if(!PLAYER.current) return;
			var t = $('section#playlist table').first();
			!t.length && (t = $('section#album table').first());
			!t.length && (t = $('section#loved table').first());
			if(!t.length || PLAYER.queueDataKey !== $('section .header h1').attr("key")) return;
			$('tr', t).removeClass('playing');
			$('tr a.play i', t).attr('class', 'icon-play');
			var tr = $('tr:nth-child(' + (PLAYER.queueId + 1) + ')', t);
			tr.addClass('playing');
			$('a.play i', tr).attr('class', 'icon-headphones');
		}
	},
	song : {
		hookDrag : function(tr, song) {
			LIB.preventSelection(tr, function(e) {
				var sel = TEMPLATE.playlist.selectedSongs,
					data = {
						song : song,
						tr : tr
					};

				!sel && (sel = []);
				var already = false;
				sel.forEach(function(s, i) {
					if(already !== false) return;
					s.tr[0].parentNode === tr[0].parentNode && s.tr[0].rowIndex === tr[0].rowIndex && (already = i);
				});
				if(e.metaKey || e.controlKey || e.shiftKey) { //case for e.shiftKey should be different...
					if(already !== false) {
						sel[already].tr.removeClass('selected');
						sel.splice(already, 1);
					} else {
						tr.addClass('selected');
						sel.push(data);
					}
				} else if(already === false) {
					TEMPLATE.playlist.resetSelection();
					tr.addClass('selected');
					sel = [data];
				}
				sel.sort(function(a, b) {
					var x = a.tr[0].rowIndex,
						y = b.tr[0].rowIndex;

					return ((x < y) ? -1 : ((x > y) ? 1 : 0));
				});
				TEMPLATE.playlist.selectedSongs = sel;

				var ltr;
				LIB.drag(e, {
					title : sel.length > 1 ? sel.length + ' songs' : sel.length ? sel[0].song.title : '',
					type : 'songs',
					data : sel
				}, function() {
					if(song.album || song.loved) return;
					ltr = $('<tr class="ltr"><td colspan="3"/></tr>');
					$('section table').first().append(ltr);
					TEMPLATE.song.hookDrop(ltr);
				}, function() {
					ltr && ltr.remove();
					ltr = null;
				});
			});
		},
		hookDrop : function(tr, song) {
			tr[0].drop = {
				types : ['songs'],
				check : function(o) {
					var sel = TEMPLATE.playlist.selectedSongs,
						inSel = false;

					sel.forEach(function(s) {
						if(inSel) return;
						s.tr[0].parentNode === tr[0].parentNode && s.tr[0].rowIndex === tr[0].rowIndex && (inSel = 1);
					});
					return inSel === false && (sel[sel.length - 1].song.search || sel[sel.length - 1].tr[0].rowIndex !== tr[0].rowIndex - 1);
				},
				cb : function(o) {
					var h1 = $('section .header h1'),
						dataKey = h1.attr("key"),
						songs_add = [],
						songs_reorder = [],
						add = function() {
							if(!songs_add.length) return done();
							var cb = function() {
									DATA.playlists.addSongs(dataKey.split(':')[1], songs_add, done, song ? tr[0].rowIndex : null);
								};

							if(dataKey === 'undefined') return DATA.playlists.add(h1.attr("value"), function(id) {
								dataKey = 'playlist:' + id; 
								h1.attr("key", dataKey);
								cb();
							});
							cb();
						},
						done = function() {
							DATA.playlists.get(dataKey.split(':')[1], function(playlist) {
								TEMPLATE.playlist.renderSongs(playlist);
							});
						};
					
					o.data.forEach(function(d) {
						if(d.song.search || d.song.album || d.song.loved) songs_add.push(d.song);
						else {
							d.song.index = d.tr[0].rowIndex;
							songs_reorder.push(d.song);
						}
					});

					TEMPLATE.playlist.resetSelection();

					if(!songs_reorder.length) return add();
					DATA.playlists.reorderSongs(dataKey.split(':')[1], songs_reorder, add, song ? tr[0].rowIndex : null);
				}
			}
		},
		bestMatch : function(s, callback) {
			if(s.bestMatch) return callback && callback(s.bestMatch);
			var title = s.artist.name + ' ' + s.title,
				getWords = function(str) {
					var ws = [];
					str.split(' ').forEach(function(w) {
						w = w.toLowerCase().trim();
						ws.indexOf(w) === -1 && ws.push(w);
					});
					return ws;
				},
				words = getWords(title),
				titleWords = getWords(s.title),
				badWords = function() {
					var bw = [
							'cover',
							'live',
							'edit',
							'remix',
							'reversed',
							'backwards',
							'lesson',
							'tribute'
						], l = bw.length;

					for(var x=0; x<l; x++) {
						if(words.indexOf(bw[x]) !== -1) {
							bw.splice(x, 1);
							x--;
							l--;
						}
					}
					return bw;
				}(),
				songs = [],
				c = 0,
				process = function() {
					c++;
					if(c < 2) return;
					songs.forEach(function(ss) {
						var sWords = getWords(ss.title.replace(/ - /g, ' ').replace(/ \/ /g, ' ')),
							wCount = 0,
							titleWCount = 0,
							bwCount = 0;

						words.forEach(function(w) {
							if(sWords.indexOf(w) === -1) return;
							wCount++; 
							titleWords.indexOf(w) !== -1 && titleWCount++;
							
						});

						badWords.forEach(function(w) {
							sWords.indexOf(w) !== -1 && bwCount++;		
						});

						ss.timeDiff = Math.abs(ss.time - s.time);
						ss.wCount = wCount;
						ss.bwCount = bwCount;
						ss.exactMatch = wCount === sWords.length;
						ss.titleMatch = titleWCount === titleWords.length;
					});
					songs.sort(function(a, b) {
						return b.bwCount > a.bwCount ? -1 : (b.bwCount < a.bwCount ? 1 : 
							(a.exactMatch > b.exactMatch ? -1 : (a.exactMatch < b.exactMatch ? 1 : 
								(a.titleMatch > b.titleMatch ? -1 : (a.titleMatch < b.titleMatch ? 1 : 
									(a.wCount > b.wCount ? -1 : (a.wCount < b.wCount ? 1 : 
										(b.timeDiff > a.timeDiff ? -1 : (b.timeDiff < a.timeDiff ? 1 : 
											(a.hd > b.hd ? -1 : (a.hd < b.hd ? 1 :
												(b.providerRanking > a.providerRanking ? -1 : (b.providerRanking < a.providerRanking ? 1 :
							0)))))))))))));
					});
					songs[0] && songs[0].wCount >= titleWords.length && (s.bestMatch = songs[0]);
					callback && callback(s.bestMatch);
				};

			YT.search('videos', title, 0, function(r) {
				if(r.entry) {
					r.entry.forEach(function(e, i) {
						songs.push({
							providerRanking : i,
							provider : DATA.providers.youtube,
							provider_id : e.id.$t.substr(e.id.$t.lastIndexOf('/') + 1),
							title : e.title.$t,
							time : parseInt(e.media$group.yt$duration ? e.media$group.yt$duration.seconds : 0, 10),
							hd : e.yt$hd ? true : false
						});
					});
					process();
				}
			});
			SC.search(title, function(r) {
				r.forEach(function(t, i) {
					songs.push({
						providerRanking : i,
						provider : DATA.providers.soundcloud,
						provider_id : t.id,
						title : t.user.username + ' - ' + t.title,
						time : Math.round(t.duration / 1000)
					});
				});
				process();
			});
		},
		hookLove : function(tr, song) {
			$('a.love', tr).click(function() {
				var i = $('i', this),
					id = song.provider + ':' + song.provider_id,
					cb = function(loved) {
						return function() {
							i.attr('class', 'icon-' + (loved ? 'ok' : 'heart'));
						}
					};
							
				DATA.loved.check(id, function(loved) {
					if(loved) return DATA.loved.remove(id, cb(false));
					else DATA.loved.add([song], cb(true));
				});
			});
		}
	},
	album : {
		data : function(params, callback) {
			var id = params[0];
			delete TEMPLATE.playlist.selectedSongs;
			DATA.albums.get(id, function(album) {
				var cb = function(album) {
						DATA.getItem('loved', function(loved) {
							loved = loved || [];
							album.id = id;
							album.songs.forEach(function(s, i) {
								s.num = LIB.addZero(i + 1);
								s.album = true;
								loved.indexOf(s.provider + ':' + s.provider_id) !== -1 && (s.love = true);
							});
							album.tags.forEach(function(t, i) {
								album.tags[i] = {
									name : t.substr(0, 1).toUpperCase() + t.substr(1),
									link : '/explore/' + t
								};
							});
							callback(album);
						});
					};

				if(album) return cb(album);
				LASTFM.getAlbum(id, function(a) {
					if(!a) return ROUTER.update('/');
					LASTFM.getArtist(null, function(artist) {
						var album = {
								dataKey : 'album:' + id,
								artist : {
									mbid : LIB.escapeHTML(artist.mbid),
									name : LIB.escapeHTML(artist.name),
									link : '/artist/' + LIB.escapeHTML(artist.mbid)
								},
								title : LIB.escapeHTML(a.name),
								image : LIB.escapeHTML(a.image[3]['#text']),
								songs : [],
								tags : []
							};

						(a.tracks.track.length ? a.tracks.track : [a.tracks.track]).forEach(function(t) {
							if(!t.mbid) return;
							album.songs.push({
								provider : DATA.providers.lastfm,
								provider_id : t.mbid,
								title : LIB.escapeHTML(t.name),
								time : parseInt(t.duration, 10),
								artist : {
									mbid : LIB.escapeHTML(t.artist.mbid),
									name : LIB.escapeHTML(t.artist.name)
								}
							});
						});
						a.toptags.tag && (a.toptags.tag.length ? a.toptags.tag : [a.toptags.tag]).forEach(function(t) {
							album.tags.push(LIB.escapeHTML(t.name));
						});
						cb(album);
					}, a.artist);
				});
			});
		},
		render : function(data) {
			data.songs.forEach(function(s, i) {
				var tr = $('section table tr:nth-child(' + (i + 1) + ')'),
					cf = function(play) {
						TEMPLATE.song.bestMatch(s, function(match) {
							if(!match) return tr.addClass('error');
							if(!play) return;
							PLAYER.queue = data.songs;
							PLAYER.queueDataKey = data.dataKey;
							PLAYER.load(i);
							$('li.title a', 'footer').attr('href', '/album/' + data.id);
						});
					};

				tr.dblclick(cf);
				$('a.play', tr).click(cf);
				TEMPLATE.song.hookDrag(tr, s);
				TEMPLATE.song.hookLove(tr, s);
				setTimeout(function() {
					cf();
				}, i * 50);
			});
			TEMPLATE.playlist.setPlayingSong();
			$('section button.store, section button.remove').click(function() {
				var cb = function() {
						ROUTER.update('/album/' + data.id, true);
					};

				if(data.stored) DATA.albums.remove(data.id, cb);
				else DATA.albums.add(data, cb)
			});
			$('aside menu li[key="' + data.dataKey + '"]').addClass('selected');        
			$('section div.cover').html('<iframe src="/image.html#' + data.image + '" />');
			!data.songs.length && LASTFM.getTopAlbums(data.artist.name, function(albums) {
				var c = 0,
					dest = $('div.empty div');

				dest.empty();
				albums.forEach(function(a, i) {
					if(c >= 8 || !a.mbid || a.mbid === data.id) return;
					var div = $(Handlebars.partials.album({
							title : a.name,
							link : '/album/' + a.mbid,
							mini : true
						}));

					dest.append(div);
					setTimeout(function() {
						$('div.img iframe', div).attr('src', '/image.html#' + a.image[2]['#text']);
					}, i * 150);
					c++;
				});
				c > 0 && dest.parent().show().fadeIn('fast');
			}, 16);
			LASTFM.similarArtistsAlbums(data.artist.mbid, function(albums) {
				var dest = $('section div.similarAlbums'),
					c = 0;

				dest.empty();
				albums.forEach(function(a, i) {
					if(c > 5 || !a.mbid || data.id === a.mbid) return;
					var div = $(Handlebars.partials.album({
							title : a.name,
							link : '/album/' + a.mbid,
							mini : true
						}));

					dest.append(div);
					setTimeout(function() {
						$('div.img iframe', div).attr('src', '/image.html#' + a.image[1]['#text']);
					}, i * 150);
					c++;
				});
				LIB.handleLinks(dest);
			}, 0, 12);
			$(window).bind('mousedown', TEMPLATE.playlist.resetSelection);
			ROUTER.onUnload = function() {
				$(window).unbind('mousedown', TEMPLATE.playlist.resetSelection);
			};
		}
	},
	loved : {
		data : function(params, callback) {
			DATA.loved.getAll(function(songs) {
				songs.forEach(function(s, i) {
					s.num = LIB.addZero(i + 1);
					s.loved = true;
				});
				callback({
					songs : songs
				});
			});
		},
		render : function(data) {
			data.songs.forEach(function(s, i) {
				var tr = $('section table tr:nth-child(' + (i + 1) + ')'),
					pf = function() {
						PLAYER.queue = data.songs;
						PLAYER.queueDataKey = data.dataKey;
						PLAYER.load(i);
						$('li.title a', 'footer').attr('href', '/loved');
					},
					cf = function(play) {
						if(s.provider !== DATA.providers.lastfm) return play && pf();
						TEMPLATE.song.bestMatch(s, function(match) {
							if(!match) return tr.addClass('error');
							play && pf();
						});
					};

				tr.dblclick(cf);
				$('a.play', tr).click(cf);
				TEMPLATE.song.hookDrag(tr, s);
				$('a.remove', tr).click(function() {
					DATA.loved.remove(s.provider + ':' + s.provider_id);
				});
				s.provider === DATA.providers.lastfm && setTimeout(function() {
					cf();
				}, i * 50);
			});
			TEMPLATE.playlist.setPlayingSong();
			$('aside menu li.loved').addClass('selected');
			$(window).bind('mousedown', TEMPLATE.playlist.resetSelection);
			ROUTER.onUnload = function() {
				$(window).unbind('mousedown', TEMPLATE.playlist.resetSelection);
			};
		}
	},
	explore : {
		data : function(params, callback) {
			callback({
				tag : params[0]
			});
		},
		render : function(data) {
			var dest = $('section div.padding'),
				page = 1,
				getAlbums = function() {
					if(data.tag) {
						LASTFM.getTagAlbums(data.tag, renderAlbums, page);
					} else {
						LASTFM.getTopArtistsAlbums(renderAlbums, page);
					}
				},
				renderAlbums = function(albums) {
					DATA.getItem('albums', function(userAlbums) {
						userAlbums = userAlbums || [];
						albums.forEach(function(a, i) {
							if(!a.mbid || userAlbums.indexOf(a.mbid) !== -1) return;
							var div = $(Handlebars.partials.album({
									title : a.artist.name + ' - ' + a.name,
									link : '/album/' + a.mbid
								}));

							dest.append(div);
							setTimeout(function() {
								$('div.img iframe', div).attr('src', '/image.html#' + a.image[2]['#text']);
							}, i * 150);
						});
						LIB.handleLinks('section');
						!$('a', dest).length && dest.append('<p class="empty">' + L.emptyHomeTag + '</p>');
						LIB.onSectionScroll(albums.length === 50, function() {
							page++;
							getAlbums();
						});
					});
				};

			getAlbums();
			
			var renderTags = function(tags) {
					var dest = $('section div.tags');
					dest.empty();
					tags.forEach(function(t) {
						dest.append('<a href="/explore/' + t.name.replace(/"/g, '') + '">' + t.name.substr(0, 1).toUpperCase() + t.name.substr(1) + '</a>')
					});
					LIB.handleLinks(dest);
				};

			if(data.tag) LASTFM.getSimilarTags(data.tag, renderTags);
			else LASTFM.getTopTags(renderTags);
		},
		initSearch : function() {
			var autofill = $('aside form ul'),
				input = $('aside form input[type="text"]'),
				timeout,
				lastQuery,
				submit = function() {
					var query = input.val().trim();
					if(query === '') return;
					autofill.scrollTop(0);
					if(query === lastQuery) {
						autofill.parent().addClass('autofill');
						$(window).bind('mouseup', hide);
						return;
					}
					lastQuery = query;
					var ah = $('<li class="header" style="display:none">' + L.artists + '</li>'),
						gh = $('<li class="header" style="display:none">' + L.genres + '</li>'),
						handleLink = function(a) {
							a.click(function(e) {
								$('li', autofill).removeClass('selected');
								a.parent().addClass('selected');
								LIB.handleLink(e, true);
							});
						};

					autofill.empty()
						.append(ah)
						.append(gh)
						.parent().removeClass('autofill');
					
					LASTFM.searchArtists(query, function(artists) {
						var c = 0,
							tophit;

						artists.forEach(function(artist) {
							if(c > 3 || !artist.mbid) return;
							var li = $('<li' + (c === 0 ? ' class="selected"' : '') + '></li>'),
								a = $('<a href="/artist/' + artist.mbid + '">' + artist.name + '</a>');

							handleLink(a);
							li.append(a);
							gh.before(li);
							c === 0 && (tophit = artist.mbid);
							c++;
						});
						if(c === 0) return;
						ah.show();
						autofill.parent().addClass('autofill');
						tophit && ROUTER.update('/artist/' + tophit);
					});
					LASTFM.searchTags(query, function(tags) {
						var c = 0;
						tags.forEach(function(t) {
							if(c > 3) return;
							var li = $('<li></li>'),
								a = $('<a href="/explore/' + t.name.replace(/"/g, "'") + '">' + t.name.substr(0, 1).toUpperCase() + t.name.substr(1) + '</a>');

							handleLink(a);
							li.append(a);
							autofill.append(li);
							c++;
						});
						if(c === 0) return;
						gh.show();
						autofill.parent().addClass('autofill');
					});
					$(window).bind('mouseup', hide);
				},
				hide = function(e) {
					if(e.target === input[0]) return;
					$(window).unbind('mouseup', hide);
					autofill.parent().removeClass('autofill');
				};

			input.keyup(function(e) {
				timeout && clearTimeout(timeout);
				switch(e.keyCode) {
					case 13:
						if(!autofill.parent().hasClass('autofill')) return submit();
						$('li.selected a', autofill).click();
						hide({});
					break;
					case 38:
						var sel = $('li.selected', autofill);
						if(sel.prev().length) {
							sel.prev().hasClass('header') && (sel = sel.prev());
							if(!sel.prev().length) return;
							$('li', autofill).removeClass('selected');
							sel.prev().addClass('selected')[0].scrollIntoView();
							LIB.cancelHandler(e);
						}
					break;
					case 40:
						if(!autofill.parent().hasClass('autofill')) return submit();
						var sel = $('li.selected', autofill);
						if(sel.next().length) {
							sel.next().hasClass('header') && (sel = sel.next());
							if(!sel.next().length) return;
							$('li', autofill).removeClass('selected');
							sel.next().addClass('selected')[0].scrollIntoView();
							LIB.cancelHandler(e);
						}
					break;
					default:
						timeout = setTimeout(submit, 500);
				}
			});
			input.click(function(e) {
				if(input.val() === '') return;
				timeout && clearTimeout(timeout);
				submit();
			});
			$('aside form').submit(function(e) {
				LIB.cancelHandler(e);
				submit();
			});
		}
	},
	artist : {
		data : function(params, callback) {
			var id = params[0];
			LASTFM.getArtist(id, function(a) {
				if(!a) return ROUTER.update('/');
				var bio = LIB.escapeHTML(a.bio.content),
					p = bio.indexOf('Read more about ' + a.name + ' on Last.fm.'),
					artist = {
						name : a.name,
						bio : bio,
						image : LIB.escapeHTML(a.image[a.image.length - 1]['#text']),
						members : a.bandmembers ? (a.bandmembers.member.length ? a.bandmembers.member : [a.bandmembers.member]) : [],
						tags : []
					};

				p !== -1 && (artist.bio = artist.bio.substr(0, p - 10));
				a.tags.tag.forEach(function(t) {
					t = t.name;
					artist.tags.push({
						name : t.substr(0, 1).toUpperCase() + t.substr(1),
						link : '/explore/' + t
					});
				});
				callback(artist);
			});
		},
		render : function(data) {
			var dest = $('section div.padding'),
				page = 1,
				getAlbums = function() {
					LASTFM.getTopAlbums(data.name, function(albums) {
						albums.forEach(function(a, i) {
							if(!a.mbid) return;
							var div = $(Handlebars.partials.album({
									title : a.artist.name + ' - ' + a.name,
									link : '/album/' + a.mbid
								}));

							dest.append(div);
							setTimeout(function() {
								$('div.img iframe', div).attr('src', '/image.html#' + a.image[2]['#text']);
							}, i * 150);
						});
						LIB.handleLinks('section');
						LIB.onSectionScroll(albums.length === 50, function() {
							page++;
							getAlbums();
						});
					}, false, page);
				};

			getAlbums();
			var members = $('section ul.members');
			data.members.forEach(function(m, i) {
				LASTFM.getArtist(null, function(artist) {
					if(!artist || !artist.mbid) return;
					var li = $('li:nth-child(' + (i + 1) + ')', members),
						a = $('<a href="/artist/' + artist.mbid + '" />');

					a.html(li.html());
					LIB.handleLinks(a);
					li.empty().append(a);
				}, m.name);
			});
		}
	}
};

$(window).load(function() {
	/* Handlebars Helpers */
	Handlebars.registerHelper('L', function(id) {
		return L[id] || id;
	});

	Handlebars.registerHelper('or', function(val1, val2, options) {
		if(val1 || val2) return options.fn(this);
		else return options.inverse(this);
	});

	Handlebars.registerHelper('empty', function(data, options) {
		if(!data || !data.length) return options.fn(this);
		else return options.inverse(this);
	});

	Handlebars.registerHelper('a', function(title, href, className, icon) {
		title = L[title] || LIB.escapeHTML(title);
		return new Handlebars.SafeString('<a' + (typeof href === 'string' ? ' href="' + href + '"' : '') + (typeof className === 'string' ? ' class="' + className + '"' : '') + '>' + (typeof icon === 'string' ? '<i class="icon-' + icon + '"></i> ' : '') + title + '</a>');
	});

	Handlebars.registerHelper('inline', function(text, key, field, tag) {
		typeof tag !== 'string' && (tag = 'span');
		text = LIB.escapeHTML(text);
		var edit = true;
		return new Handlebars.SafeString('<' + tag + ' ' + (edit ? 'contenteditable="true" key="' + key +'" field="' + field +'" value="' + text.replace(/"/g, "'") + '"' : '') + '>' + text + '</' + tag + '>');
	});

	Handlebars.registerHelper('timeFormatted', function(data) {
		return LIB.formatTime(this.time || 0);
	});

	/* DATA handlers */
	DATA.playlists.onChange = DATA.albums.onChange = function() {
		/* Update Menu */
		DATA.playlists.getAll(function(playlists) {
			DATA.albums.getAll(function(albums) {
				var menu = $('aside menu').last(),
					selected = $('section .header h1').attr("key"),
					h = menu.css('height');

				menu.replaceWith(Handlebars.partials.playlistsMenu({playlists : playlists, albums: albums}));
				menu = $('aside menu').last();
				menu.css('height', h);
				albums.concat(playlists).forEach(function(p) {
					var lnk = $('li[key="' + p.dataKey + '"] a', menu),
						album = p.dataKey.substr(0, 6) === 'album:';

					if(lnk[0]) {
						lnk[0].drop = {
							types : album ? ['albums'] : ['playlists', 'songs'],
							check : function(o) {
								switch(o.type) {
					        		case 'songs':
					        			lnk[0].drop.className = 'dropping';
					        			var err = false;
										o.data.forEach(function(d) {
											var from = $('h1', d.tr.parents('section')).attr("key");
											from && parseInt(from.split(':')[1], 10) === p.id && (err = true); 
										});
										return !err;
					        		break;
					        		case 'albums':
					        		case 'playlists':
					        			lnk[0].drop.className = 'dropping-reorder';
					        			return o.data[0].id !== p.id;		
					        	}		
							},
							cb : function(o) {
								var songs = [];
								o.data.forEach(function(d) {
									songs.push(d.song);
								});
								switch(o.type) {
					        		case 'songs':
					        			DATA.playlists.addSongs(p.id, songs, TEMPLATE.playlist.resetSelection);
					        		break;
					        		case 'albums':
					        		case 'playlists':
					        			DATA.playlists.reorder(o.data[0].id, p.id, album);
					        	}
							}
						};

						LIB.preventSelection(lnk, function(e) {
							var lli;
					        LIB.drag(e, {
					            title : p.title,
					            type : album ? 'albums' : 'playlists',
					            data : [p]
					        }, function() {
					        	lli = $('<li class="lli"><a></a></li>');
					            lli.children()[0].drop = {
							        types : album ? 'albums' : 'playlists',
							        className : 'dropping-reorder',
							        cb : function(o) {
							        	DATA.playlists.reorder(o.data[0].id, null, album);
							        }
							    }
							    if(album) $('li.header', menu).last().before(lli);
							    else menu.append(lli);
					        }, function() {
					            lli.remove();
					            lli = null;
					        });
					    });
					}
				});
				/* menu shadow */
				menu.bind('scroll', function(e) {
					menu.prev()[(menu.scrollTop() > 0 ? 'add' : 'remove') + 'Class']('s');
				});
				LIB.handleLinks('aside menu');
				if(selected) {
					$('aside menu li').removeClass('selected');
					$('aside menu li[key="' + selected + '"]').addClass('selected');
				}
			});
		});
	};

	DATA.loved.onChange = function() {
		/* Update Loved */
		if($('section .header h1').attr("key") !== 'loved') return;
		ROUTER.update('/loved');
	};

	/* Lang detection/setup */
	LIB.setupLang(function() {
		/* Render the skin */
		$('body').append(Handlebars.templates.skin({})).fadeIn();
		LIB.handleSpeech('aside');
		LIB.handleLinks('aside, footer');
		TEMPLATE.explore.initSearch();

		/* Drop Handlers */
		DATA.playlists.onChange();
		$('aside menu li.create a')[0].drop = {
			types : ['songs'],
			cb : function(o) {
				var songs = [];
				o.data.forEach(function(d) {
					songs.push(d.song);
				});
				DATA.playlists.add(L.newPlaylist.replace(/{{date}}/, LIB.formatDate(new Date())), function(id) {
					DATA.playlists.addSongs(id, songs, function() {
						ROUTER.update('/playlist/' + id);
					});
				});
			}
		};
		$('aside menu li.loved a')[0].drop = {
			types : ['songs'],
			cb : function(o) {
				var songs = [];
				o.data.forEach(function(d) {
					songs.push(d.song);
				});
				DATA.loved.add(songs);
			}
		};

		$(window)
			.resize(LIB.onResize)
			.keydown(LIB.onKeyDown)
			.bind(FULLSCREEN.eventName, PLAYER.onFullscreen);

		/* Init players */
		PLAYER.init();

		/* Start the app */
		ROUTER.init();
	});
});
