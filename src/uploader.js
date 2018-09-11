/**
 * JavaScript 循环性能比较
 * https://juejin.im/entry/59390887ac502e006b169ae1
 * 
 * 怎样快速而优雅地遍历 JavaScript 数组
 * https://hyjk2000.github.io/2011/06/09/optimizing-javascript-array-traversing/
 * 
 */
var fileUpload 	= require('node-formdata');
var path = require('path');
var fs = require('fs');
var utils = require('./utils');

var defaultOptions = {
    method: 'POST',
    verbose: true,
    file: ""
};

module.exports = function(){
	let starttime = new Date().getTime();
	let self = this;
    console.log(`[${global.npm_name}]:上传文件 - start`)
	
    return new Promise((resolve, reject)=>{
        selector.call(self,  resolve)
	})
	.then(()=>{
		
		let endtime = new Date().getTime();
		console.log(`[${global.npm_name}]:上传文件 - end (${endtime-starttime}ms)`) 
	})


    
    
}

function selector(done){
	// 这种情况应该不会出现吧
    // if(JSON.stringify(this.mapfile._)=='{}'){
    //     return resolve();
	// }
	let self= this;
	/**
	 * 先处理 static文件  count 计 0
	 * 再处理css文件  count 计 0
	 * js文件中可能存在多级引用
	 * 做while 反复 上传 引用count 减至 0 的文件
	 * 最后改写 html文件 
	 */

	
	new Promise((resolve, reject)=>{
		/**
		 * 上传静态文件
		 */
		if(self.mapfile.static.length==0){
			return resolve();
		}

		self.mapfile.static.forEach((item, index)=>{
			let tempUrl = self.mapfile._[item].url;
			upload(tempUrl, item, self, (err, data)=>{
				self.mapfile.staticCount--;
				if(!err){
					let newItem = self.mapfile._[data.key];
					/**
					 * 存在newItem，视为 静态资源
					 * 不存在视为chunk
					*/
					newItem.url = data.url;
					newItem.status = 2;
					rewriteFullUrl.call(self, tempUrl, data.url)

					if(data.key.indexOf('chunk')>0){
						// chunk 最后 变量取最前面的一个 index
						self.chunkMap[data.key.split(".")[0]] = data.url;
					}					
					
				}
				if(self.mapfile.staticCount==0){
					resolve();
				}
			})
		})
	})
	.then(()=>{
		return new Promise((resolve, reject)=>{
			/**
			 * 改写css
			 */
			self.mapfile.css.forEach((item, index)=>{
				rewriteTempFile.call(self, item, self.mapfile['static']);
			})

			resolve();
		})
	})
	.then(()=>{
		return new Promise((resolve, reject)=>{
			/**
			 * 改写 chunk 
			 */
			if(this.options.chunk){
				self.mapfile.js.forEach((key, index)=>{
					let item = self.mapfile._[key];
					if(item.shuldInjectChunk){
						rewriteChunk.call(self, item);
					}
				})
			}

			resolve();
		})
	})
	.then(()=>{
		/**
		 * 上传css文件
		 */
		return new Promise((resolve, reject)=>{
			if(self.mapfile.css.length==0){
				return resolve();
			}
			self.mapfile.css.forEach((item, index)=>{
				let tempUrl = self.mapfile._[item].url;
				upload(tempUrl, item, self, (err, data)=>{
					self.mapfile.cssCount--;
					if(!err){
						let newItem = self.mapfile._[data.key];
						newItem.url = data.url;
						newItem.status = 2;
						rewriteFullUrl.call(self, tempUrl, data.url)
					}
					if(self.mapfile.cssCount==0){
						resolve();
					}
				})
			})
		})
	})
	.then(()=>{
		/**
		 * 改写js 中的  png css 引用
		 */
		return new Promise((resolve, reject)=>{
			/**
			 * 改写css
			 */
			var arr = [];
			self.mapfile.js.forEach((item, index)=>{
				rewriteTempFile.call(
					self, 
					item, 
					self.mapfile['static'].concat(self.mapfile.css)
				);
			})

			resolve();
		})
	})
	.then(()=>{
		return dreamCycle.call(self)

	})
	.then(()=>{
		/**
		 * map 清理赶紧 此处处理HTML文件
		 */
		return clearHTML.call(self)

	})
	.then(()=>{
		done()
	})
	
	
}

/**
 * 上传 map 中的 0 依赖count 的
 * 也是做 递归，处理完一遍之后，再扫描map
 * 直到 全部处理完
 * 
 *  ********  处理多次依赖  ********
 */
function dreamCycle(){
	let self= this;
	let map = self.mapfile._;		
	let allMap = [];
	let tempRemainMap = [];
	let tempSuccessMap =  [];

	this.successMap = tempSuccessMap;

	return new Promise((allResolve, allReject)=>{
		/**
		 * 上传 map 中的 0 依赖count 的
		 * 也是做 递归，处理完一遍之后，再扫描map
		 * 直到 全部处理完
		 * 
		 *  ********  处理多次依赖  ********
		 */

		/**
		 * 循环json 出 数组， 以后的n次循环中，循环数组来提高效率
		 */
		for(i in map){
			allMap.push(i);
		}

		// 数组按大到小排序，防止小字符替换大字符
		allMap.sort((a, b)=>{
			return a.length<b.length;
		})

		allMap.forEach((item, index)=>{
			if(map[item].count){
				tempRemainMap.push(item);
			}else{
				tempSuccessMap.push(item);
			}
		})

		/****
		 * successMap 中未区分是否上传成功
		 * 先处理一次，将successmap中的 文件完全上传
		 */ 

		let _templength = tempSuccessMap.length;
		tempSuccessMap.forEach((item, index)=>{
			let nowItem = map[item];
			if(!nowItem.status || nowItem.status!=2){
				let tempUrl = nowItem.url;
				upload(tempUrl, item, self, (err, data)=>{
					if(!err){
						let newItem = map[data.key];
						tempSuccessMap.push(data.key);
						newItem.url = data.url;
						newItem.status = 2;
						rewriteFullUrl.call(self, tempUrl, data.url)
					}
					checkDone();
				})
			}else{
				checkDone();
			}
		})

		function checkDone(){
			_templength--;
			if(_templength==0){
				cycle(function(){
					allResolve();
				});		
			}
		}
	})
	

	/**
	 * 依次做扫描循环，将 依赖为0 的 key 推入 tempSuccessMap，
	 * 从 tempRemainMap 移除
	 * 直到 tempRemainMap length 为 0 ， 调用回调
	 * 
	 * @param {循环回调} _cb 
	 */
	function cycle(_cb){
		let tempArr = [];
		let map = self.mapfile._;
		if(tempRemainMap.length){
			/**
			 * 改写 有依赖的 map 文件
			 * 依次减 count ，如果 依赖count为0 ，则 推入 临时数组
			 * 最后将临时数组，加到 tempSuccessMap 中
			 */
			tempRemainMap.forEach((item, index)=>{
				rewriteTempFile.call(self, item, tempSuccessMap, (count)=>{
					if(count<=0){
						tempArr.push(tempRemainMap.splice(index,1)[0]); 
					}
				});
			})

			/**
			 * 将新发现依赖为0 的文件，上传
			 * 然后 递归 重新循环
			 */
			new Promise((resolve, reject)=>{
				let templength = tempArr.length;
				tempArr.forEach((item, index)=>{
					/**
					 * 判断逻辑
					 * 资源状态 不存在 或者不为2，证明未上传过
					 * nowItem.count 为0 表示无引用资源
					 * 取 并集做上传处理                     
					*/
					let nowItem = map[item];
					if(!nowItem.status || nowItem.status!=2){
						let tempUrl = nowItem.url;
						upload(tempUrl, item, self, (err, data)=>{
							templength--;
							if(!err){
								let newItem = map[data.key];
								tempSuccessMap.push(data.key);
								newItem.url = data.url;
								newItem.status = 2;
								rewriteFullUrl.call(self, tempUrl, data.url)
							}
							if(templength==0){
								resolve();
							}
						})
					}else{
						throw new Error("循环中状态错误");
						return false;
					}
				})
			})
			.then(()=>{
				cycle(_cb);
			})

		}else{
			_cb();
		}
	}
}

/**
 * 最后改写HTML
 */
function clearHTML(){
	return new Promise((resolve, reject)=>{
		let self = this,
		files = this.mapfile.html,
		filelength = files.length,
		length=0;
		files.forEach((item, index)=>{
			rewriteHTMLFile.call(self, item, ()=>{
				length++;
				if(length==filelength){
					resolve();
				}
			});
		})
	})
	
}


/**
 * 上传模块
 * @param {*} path : 上传文件路径
 * @param {*} key ： 对应map的 key
 * @param {*} cb ：上传回调
 */
function upload(url, key, self, cb){
    // defaultOptions.file =  url;
    defaultOptions.url =  self.options.uploadUrl;
	let start = new Date().getTime();
	if(!fs.existsSync(url)){
		console.log('gulp-upload uploading','fail!',url)
		return cb('gulp-upload uploading','fail! '+url);
	}
    fileUpload(defaultOptions,'http')
	.then(function(res) {
		let end = new Date().getTime();
		res = JSON.parse(res);
	    if(res.errno==0){
			var myhost = '';
			var isImage = /\.(jpg|jpge|gif|png|webp)/i.test(key);
			var isSwf = /\.(swf)/i.test(key);

			if(isImage){
				myhost = self.options.hostname("img", res.data);
			}else if(isSwf){
				myhost = self.options.hostname("static", res.data);
			}else{
				myhost = self.options.hostname("static", res.data);
			}
	    	var _url = myhost+'/'+res.data.fileName;
			res.url = '//'+_url;
			res['key'] = key;
			console.log(`[${global.npm_name}]:上传文件 ${_url} - (${end-start}ms)`)
			return cb(null, res);
		}else{
			console.log('upload uploading','fail!',url)
			return cb('upload uploading','fail! '+url);
		}
	    
	})
	.fail(function(res){
	    cb(res);
	})
}


function getType(url){
    return path.extname(url).toLowerCase();
};

/**
 * 
 * @param {*} key 改写temp真实文件
 * @param {*} tempArr 改写对照数组
 * @param {*} callback 选填的回调
 */
function rewriteTempFile(key,  tempArr, callback){
	var map = this.mapfile._;
	var tempUrl = map[key].url;
	var doneArr = tempArr;
	

	if(doneArr && doneArr.length){
		if(fs.existsSync(tempUrl) && !utils.isHttpUrl(tempUrl)){
			let content = fs.readFileSync(tempUrl, 'utf8');
			doneArr.forEach((item,index)=>{
				//content
				var cdnUrl = map[item].url;

				if(cdnUrl && utils.isHttpUrl(cdnUrl)){
					var regexp = item.replace('?','\\?');
					content = content.replace(new RegExp(regexp,'g'), function(){
						map[key].count--;
						map[key].count = Math.max(map[key].count, 0)
						if(callback){
							callback(map[key].count)
						}
						return cdnUrl;
					});
				}
			})
			fs.writeFileSync(tempUrl, content, 'utf8');
		}
	}
}



function rewriteChunk(item){
	var tempUrl = item.url;
	const regExp = /\.src[\s]?=.*\[(\w.*)\].*chunk\.js\"/gi;
	let content = fs.readFileSync(tempUrl, 'utf8');
	
	fs.writeFileSync(tempUrl, content.replace(regExp, ($0, $1)=>{
		return `.src=${JSON.stringify(this.chunkMap)}[${$1}]`
	}), 'utf8');

}

/**
 * 
 * @param {*} key 改写html文件
 * @param {*} tempArr 改写对照数组
 * @param {*} callback 选填的回调
 */
function rewriteHTMLFile(key, callback){
	var tempUrl = key;
	var doneArr = this.successMap;
	let map = this.mapfile._;

	if(doneArr && doneArr.length){
		if(fs.existsSync(tempUrl) && !utils.isHttpUrl(tempUrl)){
			let content = fs.readFileSync(tempUrl, 'utf8');
			doneArr.forEach((item,index)=>{
				//content
				var cdnUrl = map[item].url;

				if(cdnUrl && utils.isHttpUrl(cdnUrl)){
					var regexp = item.replace('?','\\?');
					content = content.replace(new RegExp(regexp,'g'), function(){
						if(callback){
							callback()
						}
						return cdnUrl;
					});
				}
			})
			fs.writeFileSync(tempUrl, content, 'utf8');
		}
	}else{
		callback()
	}
}



function copy(obj){
	return JSON.parse(JSON.stringify(obj))
}

function rewriteFullUrl(tempUrl, cdnUrl){
	let map = this.mapfile._
	for(i in map){
		if(map[i].url == tempUrl){
			map[i].url = cdnUrl;
			map[i].url.count = 0;
			map[i].status = 2;
		}
	}
}