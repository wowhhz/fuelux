/*
 * Fuel UX Repeater
 * https://github.com/ExactTarget/fuelux
 *
 * Copyright (c) 2014 ExactTarget
 * Licensed under the MIT license.
 */

// -- BEGIN UMD WRAPPER PREFACE --

// For more information on UMD visit: 
// https://github.com/umdjs/umd/blob/master/jqueryPlugin.js

(function (factory) {
    if (typeof define === 'function' && define.amd) {
        // if AMD loader is available, register as an anonymous module.
         define(['jquery'], factory);
    } else {
        // OR use browser globals if AMD is not present
        factory(jQuery);
    }
}(function ($) {
// -- END UMD WRAPPER PREFACE --

// -- BEGIN MODULE CODE HERE --
    
	var old = $.fn.repeater;

	// REPEATER CONSTRUCTOR AND PROTOTYPE

	var Repeater = function (element, options) {
		var self = this;
		var i;

		this.$element = $(element);

		this.$filters = this.$element.find('.repeater-filters');
		this.$pageSize = this.$element.find('.repeater-itemization .selectlist');
		this.$main = this.$element.find('.repeater-main');
		this.$primaryPager = this.$element.find('.repeater-primaryPaging');
		this.$search = this.$element.find('.repeater-search');
		this.$secondaryPager = this.$element.find('.repeater-secondaryPaging');

		this.options = $.extend(true, {}, $.fn.repeater.defaults);
		for(i in $.fn.repeater.views){
			if($.fn.repeater.views[i].defaults){
				this.options = $.extend(true, this.options, $.fn.repeater.views[i].defaults);
			}
		}
		this.options = $.extend(true, this.options, options);

		this.currentPage = 1;
		this.currentView = 'thumbnail';
		this.skipNested = false;

		//this.$nextpagebtn.on('click', $.proxy(this.next, this));
		//this.$prevpagebtn.on('click', $.proxy(this.previous, this));
		this.$filters.on('changed', $.proxy(this.render, this, { pageIncrement: null }));
		this.$pageSize.on('changed', $.proxy(this.render, this, { pageIncrement: null }));
		this.$search.on('searched cleared', $.proxy(this.render, this, { pageIncrement: null }));

		this.render();
	};

	Repeater.prototype = {
		constructor: Repeater,

		clear: function(){
			this.$main.empty();
		},

		getDataOptions: function(options){
			var opts = {};
			var val;

			options = options || {};

			opts.filter = this.$filters.selectlist('selectedItem');
			opts.pageSize = parseInt(this.$pageSize.selectlist('selectedItem').value, 10);

			if(options.pageIncrement!==undefined){
				if(options.pageIncrement===null){
					opts.pageIndex = 0;
				}else{
					opts.pageIndex = this.currentPage + options.pageIncrement;
				}
			}else{
				opts.pageIndex = this.currentPage;
			}

			val = this.$search.find('input').val();
			if(val!==''){
				opts.search = val;
			}

			delete opts.pageIncrement;

			if($.fn.repeater.views[this.currentView].dataOptions){
				opts = $.fn.repeater.views[this.currentView].dataOptions();
			}

			return opts;
		},

		render: function(options){
			var dataOptions = this.getDataOptions(options);
			var self = this;

			this.clear();
			this.options.dataSource(dataOptions, function(data){
				self.runRenderer(self.$main, $.fn.repeater.views[self.currentView].renderer, data, function(){
					//do next steps
				});
			});
		},

		runRenderer: function(container, renderer, data, callback){
			var async = { after: false, before: false, complete: false, render: false };
			var self = this;
			var repeat, subset, i, l;

			var loopSubset = function(index){
				var args = { container: container, data: data };
				if(renderer.repeat){
					args.subset = subset;
					args.index = index;
				}
				start(args, function(){
					index++;
					if(index<subset.length){
						loopSubset(index);
					}else{
						callback();
					}
				});
			};

			var start = function(args, cb){
				var item = '';

				var callbacks = {
					before: function(){
						proceed('render', args);
					},
					render: function(resp){
						if(resp!==null){
							item = $(resp);
							if(item.length<1){
								item = resp;
							}
							container.append(item);
							args.item = item;
						}
						proceed('after', args);
					},
					after: function(){
						var cont;
						var loopNested = function(cont, index){
							self.runRenderer(cont, renderer.nested[index], data, function(){
								index++;
								if(index<renderer.nested.length){
									loopNested(cont, index);
								}else{
									proceed('complete', args);
								}
							});
						};

						if(renderer.nested && !self.skipNested){
							cont = $(item);
							cont = (cont.attr('data-container')==='true') ? cont : cont.find('[data-container="true"]:first');
							if(cont.length<1){
								cont = container;
							}
							loopNested(cont, 0);
						}else{
							callbacks.complete(null);
						}
					},
					complete: function(){
						if(cb){
							cb();
						}
					}
				};

				var proceed = function(stage, argus){
					argus = $.extend({}, argus);
					if(renderer[stage]){
						if(async[stage]){
							argus.callback = callbacks[stage];
							renderer[stage].call(self, argus);
						}else{
							callbacks[stage](renderer[stage].call(self, argus));
						}
					}else{
						callbacks[stage](null);
					}
				};

				self.skipNested = false;
				proceed('before', args);
			};

			if(renderer.async){
				if(renderer.async===true){
					async = { after: true, before: true, complete: true, render: true };
				}else{
					async = renderer.async;
				}
			}

			if(renderer.repeat){
				repeat = renderer.repeat.split('.');
				subset = data;
				for(i=0, l=repeat.length; i<l; i++){
					subset = subset[repeat[i]];
				}
			}else{
				subset = [''];
			}

			loopSubset(0);
		}
	};

	// REPEATER PLUGIN DEFINITION

	$.fn.repeater = function (option) {
		var args = Array.prototype.slice.call( arguments, 1 );
		var methodReturn;

		var $set = this.each(function () {
			var $this   = $( this );
			var data    = $this.data( 'repeater' );
			var options = typeof option === 'object' && option;

			if ( !data ) $this.data('repeater', (data = new Repeater( this, options ) ) );
			if ( typeof option === 'string' ) methodReturn = data[ option ].apply( data, args );
		});

		return ( methodReturn === undefined ) ? $set : methodReturn;
	};

	$.fn.repeater.defaults = {
		dataSource: function(options, callback){}
	};

	//views object contains keyed list of view plugins.
		//renderer object contains following optional parameters:
			//{
				//before: function(data, [dataset, index]){},
				//after: function(data, item, [dataset, index]){},
				//complete: function(data, item, [dataset, index]){},
				//repeat: 'parameter.subparameter.etc',
				//async: { after: false, before: false, complete: false, render: false }  (passing true sets all to true)
				//render: function(data, [dataset, index]){},
				//nested: [ *array of renderer objects* ]
			//}
			//*NOTE - the dataset and index arguments appear if repeat is present
	$.fn.repeater.views = {
		thumbnail: {
			renderer: {
				render: function(helpers){
					return '<div class="clearfix thumbnailCont" data-container="true"></div>';
				},
				nested: [
					{
						render: function(helpers){
							return '<div class="thumbnail" data-container="true">' + helpers.subset[helpers.index].name + '</div>';
						},
						repeat: 'thumbnails'
					}
				]
			}
		}
	};

	$.fn.repeater.Constructor = Repeater;

	$.fn.repeater.noConflict = function () {
		$.fn.repeater = old;
		return this;
	};

// -- BEGIN UMD WRAPPER AFTERWORD --
}));
// -- END UMD WRAPPER AFTERWORD --