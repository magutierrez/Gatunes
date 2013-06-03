DATA = {
	providers : {
		youtube : 1,
		soundcloud : 2,
		lastfm : 3
	},
	getItem : function(id, callback) {
		if(!window.chrome.storage) callback(JSON.parse(window.localStorage.getItem(id)));
		else	 window.chrome.storage.sync.get(id, function(items) {
			callback(items[id]);
		});
	},
	setItem : function(id, value, callback) {
		var onChange = function() {
				var collection = id.split(':')[0];
				DATA[collection] && DATA[collection].onChange && DATA[collection].onChange(id.substr(collection.length + 1));
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
				DATA[collection] && DATA[collection].onChange && DATA[collection].onChange(id.substr(collection.length + 1));
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
		addSongs : function(id, songs, callback) {
			var cb = function(playlist) {
					DATA.setItem('playlist:' + id, playlist, callback);
				};

			DATA.getItem('playlist:' + id, function(playlist) {
				var index = playlist.songs.length, //TODO: This will be used for adding into a defined position (dragging)
					count = songs.length;
				
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
						DATA.setItem('song:' + id, {
							title : LIB.escapeHTML(s.title),
							time : parseInt(s.time, 10)
						}, add);
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
				var cb = function() {
						count--;
						if(count > 0) return;
						callback(album);
					};

				album.dataKey = dataKey;
				album.fullTitle = album.artist.name + ' - ' + album.title;
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
		add : function(mbid, artist, title, image, songs, callback) {
			DATA.getItem('albums', function(albums) {
				albums = albums || [];
				if(albums.indexOf(mbid) !== -1) return callback && callback(mbid);
				albums.unshift(mbid);
				var album = {
						artist : {
							mbid : LIB.escapeHTML(artist.mbid),
							name : LIB.escapeHTML(artist.name)
						},
						title : LIB.escapeHTML(title),
						image : LIB.escapeHTML(image),
						songs : []
					},
					count = songs.length,
					cb = function() {		
						DATA.setItem('album:' + mbid, album, function() {
							DATA.setItem('albums', albums, function() {
								callback && callback(mbid);
							});
						});
					};
				
				if(count === 0) return cb();
				songs.forEach(function(s, index) {
					var id = DATA.providers.lastfm + ':' + LIB.escapeHTML(s.mbid),
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
				DATA.removeItem('album:' + id, function() {
					DATA.setItem('albums', albums, callback);
				});
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
			DATA.playlists.get(id, callback);
		},
		render : function(data) {
			var form = $('section form');
			form.submit(TEMPLATE.playlist.search);
			$('section menu li a').each(function(i, a) {
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
			$('aside menu li' + (data.dataKey ? '[key="' + data.dataKey + '"]' : '.createPlaylist')).addClass('selected');
			TEMPLATE.playlist.renderSongs(data.songs);
			$('section input').first().focus();
			$(window).bind('mousedown', TEMPLATE.playlist.resetSelection);
			ROUTER.onUnload = function() {
				$(window).unbind('mousedown', TEMPLATE.playlist.resetSelection);
	    	};
		},
		renderSongs : function(songs) {
			var dest = $('section table').first();
			dest.empty();
			if(!songs || !songs.length) {
				var tr = $('<tr><td class="empty">' + L.emptyPlaylist + '</td></tr>');
				TEMPLATE.playlist.hookReorder(tr);
				return dest.append(tr);
			}
			songs.forEach(function(s, i) {
				s.num = LIB.addZero(i + 1);
				TEMPLATE.song(s, dest);
			});
			TEMPLATE.playlist.setPlayingSong();
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
									TEMPLATE.song(s, dest);
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

				            TEMPLATE.song(s, dest);
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
		resetSelection : function() {
			var sel = TEMPLATE.playlist.selectedSongs;
	        if(!sel) return;
	        sel.forEach(function(s) {
	            s.tr.removeClass('selected');
	        });
	        delete TEMPLATE.playlist.selectedSongs;
	    },
	    hookReorder : function(tr, song) {
			tr[0].drop = {
	            types : ['songs'],
	            check : function(o) {
	                var sel = TEMPLATE.playlist.selectedSongs,
	                    inSel = false;

	                sel.forEach(function(s) {
	                    if(inSel) return;
	                    !s.song.search && s.tr[0].rowIndex === tr[0].rowIndex && (inSel = 1);
	                });
	                return inSel === false && (sel[sel.length - 1].song.search || sel[sel.length - 1].tr[0].rowIndex !== tr[0].rowIndex - 1);
	            },
	            cb : function(o) {
	        	    var dataKey = $('section .header h1').attr("key");
	                console.log('reorder', dataKey, o.data, song);
	                //remoteStorage.playlists.reorderSongs(PLAYLIST.current.id, ids, ltr ? null : song);
	            	//delete TEMPLATE.playlist.selectedSongs;
	            }
	        }
	    },
	    setPlayingSong : function() {
	    	if(!PLAYER.current) return;
	    	var t = $('section#playlist table').first();
	    	!t.length && (t = $('section#album table').first());
	    	if(!t.length || PLAYER.queueDataKey !== $('section .header h1').attr("key")) return;
	    	$('tr', t).removeClass('playing');
	    	$('tr:nth-child(' + (PLAYER.queueId + 1) + ')', t).addClass('playing');
	    }
	},
	song : function(song, dest) {
		dest.append(Handlebars.partials.song(song));
		var tr = dest.children().children().last(),
			h1 = $('section .header h1'),
			cf = function() {
				if(!song.search) return; //PLAYER.load(song);
				var dataKey = h1.attr("key"),
					add = function() {
						var id = dataKey.split(':')[1];
						DATA.playlists.addSongs(id, [song], function() {
							DATA.playlists.get(id, function(playlist) {
								TEMPLATE.playlist.renderSongs(playlist.songs);
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
	            s.song.provider === song.provider && s.song.provider_id === song.provider_id && (already = i);
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
	            title : sel.length > 1 ? sel.length + ' songs' : sel[0].song.title,
	            type : 'songs',
	            data : sel
	        }, function() {
				ltr = $('<tr class="ltr"><td colspan="3"/></tr>');
				$('section table').first().append(ltr);
				TEMPLATE.playlist.hookReorder(ltr);
	        }, function() {
	            ltr && ltr.remove();
	            ltr = null;
	        });
	    });

		$(tr).dblclick(cf);
		$('a.play', tr).click(cf);
		if(song.search) return;
		$('a.remove', tr).click(function() {
			var dataKey = h1.attr("key");
			if(dataKey === 'undefined') return;
			var id = dataKey.split(':')[1];
			DATA.playlists.removeSong(id, tr[0].rowIndex, song.provider, song.provider_id, function() {
				DATA.playlists.get(id, function(playlist) {
					TEMPLATE.playlist.renderSongs(playlist.songs);
				});
			});
		});
	    TEMPLATE.playlist.hookReorder(tr, song);
	},
	album : {
		data : function(params, callback) {
			var id = params[0];
			delete TEMPLATE.playlist.selectedSongs;
			if(!id) return callback({
				fullTitle : L.newAlbum
			});
			DATA.albums.get(id, function(album) {
				album.songs.forEach(function(s, i) {
					s.num = LIB.addZero(i + 1);
					s.album = true;
				});
				callback(album);
			});
		},
		render : function(data) {
			$('section form').first().submit(function(e) {
				var values = LIB.getForm(e, ['artist']),
					dest = $('section table');

				if(values === null) return;
				dest.empty();
				LASTFM.getTopAlbums(values.artist, function(albums) {
					DATA.getItem('albums', function(userAlbums) {
						userAlbums = userAlbums || [];
						albums.forEach(function(a) {
							if(!a.mbid || userAlbums.indexOf(a.mbid) !== -1) return;
							dest.append('<tr><td class="img"><iframe src="/image.html#' + a.image[1]['#text'] + '"></iframe><b></b></td><td class="title">' + a.artist.name + ' - ' + a.name + '</td>');
							$('td', dest.children().children().last()).click(function() {
								LASTFM.getAlbum(a.mbid, function(data) {
									var songs = [];
									(data.tracks.track.length ? data.tracks.track : [data.tracks.track]).forEach(function(t) {
										if(!t.mbid) return;
										songs.push({
											mbid : t.mbid,
											artist : t.artist,
											title : t.name,
											time : t.duration
										});
									});
									DATA.albums.add(a.mbid, a.artist, a.name, a.image[a.image.length - 1]['#text'], songs, function(mbid) {
										ROUTER.update('/album/' + mbid);
									});
								});
							});
						});
					});
				});
			});
			$('aside menu li' + (data.dataKey ? '[key="' + data.dataKey + '"]' : '.createAlbum')).addClass('selected');
			data.image && $('section div.cover').html('<iframe src="/image.html#' + data.image + '" />');
			if(!data.dataKey) return $('section input').first().focus();
			data.songs.forEach(function(s, i) {
				var tr = $('section table tr:nth-child(' + (i + 1) + ')'),
					cf = function(play) {
						if(bestMatch) return play && (PLAYER.queue = data.songs) && (PLAYER.queueDataKey = data.dataKey) && PLAYER.load(i);
						YT.search('videos', title + ' -cover -live', 0, function(r) {
							if(r.entry) {
								r.entry.forEach(function(e) {
									var ss = {
											provider : DATA.providers.youtube,
											provider_id : e.id.$t.substr(e.id.$t.lastIndexOf('/') + 1),
											title : e.title.$t,
											time : parseInt(e.media$group.yt$duration ? e.media$group.yt$duration.seconds : 0, 10)
										},
										timeDiff = Math.abs(ss.time - s.time),
										sWords = ss.title.split(' '),
										wCount = 0;

									words.forEach(function(w) {
										if(sWords.indexOf(w) === -1) return;
										wCount++; 
									});

									if(wCount >= (words.length / 2) && minTimeDiff > timeDiff && maxWCount <= wCount) {
										minTimeDiff = timeDiff;
										maxWCount = wCount;
										bestMatch = ss;
									}
								});
								!bestMatch && !play && tr.addClass('error');
								if(bestMatch) {
									s.provider = bestMatch.provider;
									s.provider_id = bestMatch.provider_id;
									s.title = bestMatch.title;
									s.time = bestMatch.time;
									play && (PLAYER.queue = data.songs) && (PLAYER.queueDataKey = data.dataKey) && PLAYER.load(i);
								}
							}
						});
					},
					title = s.artist.name + ' ' + s.title,
					words = title.split(' '),
					maxWCount = 0, minTimeDiff = s.time,
					bestMatch;

				tr.dblclick(cf);
				$('a.play', tr).click(cf);
				setTimeout(cf, i * 50);
			});
			TEMPLATE.playlist.setPlayingSong();
			$('section menu li.remove button').click(function() {
				DATA.albums.remove(data.dataKey.split(':')[1], function() {
					ROUTER.update('/album');
				});
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
				var menu = $('aside menu'),
					selected = $('section .header h1').attr("key");

				menu.replaceWith(Handlebars.partials.playlistsMenu({playlists : playlists, albums: albums}));
				LIB.handleLinks('aside menu');
				if(!selected) return $('aside menu li').first().addClass('selected');
				$('aside menu li[key="' + selected + '"]').addClass('selected');
			});
		});
	};

	/* Lang detection/setup */
	DATA.getItem('lang', function(cookie_lang) {
		var browser_lang = navigator.language ? navigator.language.substr(navigator.language.length - 2).toLowerCase() : navigator.browserLanguage,
			lang = 'en'; //the default

		if(LANG[cookie_lang]) lang = cookie_lang;    
		else if(LANG[browser_lang]) lang = browser_lang;

		L = LANG[lang];
		DATA.setItem('lang', lang);

		DATA.playlists.getAll(function(playlists) {
			DATA.albums.getAll(function(albums) {
				/* Render the skin */
				$('body').append(Handlebars.templates.skin({playlists : playlists, albums : albums}));
				LIB.handleLinks('aside');
				$(window).resize(LIB.onResize).keydown(LIB.onKeyDown);

				/* Init players */
				PLAYER.init();

				/* Start the app */
				if(!window.chrome.storage) ROUTER.init();
				else ROUTER.update(albums.length ? '/album/' + albums[0].id : playlists.length ? '/playlist/' + playlists[0].id : '/album/');
			});
		});
	});
});
