'use strict';
'require view';
'require uci';
'require rpc';
'require dom';
'require fs';
'require ui';

/*
 * FilesCodeBox LuCI 入口页(luci-app-filescodebox 视图)。
 *
 * 为什么是"状态 + 新窗口打开"而非 iframe 内嵌:core 安全基线对全部响应下发
 * X-Frame-Options: SAMEORIGIN(防点击劫持),LuCI(源 :80)内嵌业务端口(:12345)
 * 属跨源,浏览器必拦(白屏)。故本页只做:服务状态展示 + 启停控制 + 新窗口打开。
 *
 * 运行状态数据源:ubus service list(取 instances[*].running)。
 * 勿用 luci getInitList——iStoreOS 的 LuCI 构建里该方法不返回 running 字段
 * (只有 index/stop/enabled,真机实测),拿它判断恒显"未运行"(v0.3.0 踩坑)。
 */

var callServiceList = rpc.declare({
	object: 'service',
	method: 'list',
	expect: { '': {} }
});

var callInitExec = rpc.declare({
	object: 'file',
	method: 'exec',
	params: ['command', 'params'],
	expect: { code: 0 }
});

var INIT_script = '/etc/init.d/filescodebox';

return view.extend({
	load: function() {
		return Promise.all([
			uci.load('filescodebox'),
			L.resolveDefault(callServiceList(), {})
		]);
	},

	monitordata: null,

	handleAction: function(action, ev) {
		return fs.exec(INIT_script, [action]).then(L.bind(function() {
			ui.hideModal();
			/* procd 状态切换有延迟,延时后重取状态重渲染 */
			return new Promise(function(resolve) { window.setTimeout(resolve, 2000); })
				.then(L.bind(function() {
					return L.resolveDefault(callServiceList(), {});
				}, this))
				.then(L.bind(function(res) {
					this.monitordata = res;
					var node = document.querySelector('#filescodebox-main');
					if (node) {
						dom.content(node, this.renderStatus(res));
					}
				}, this));
		}, this)).catch(L.bind(function(e) {
			ui.hideModal();
			ui.addNotification(null, E('p', {}, _('操作失败: %s').format(e.message)));
		}, this));
	},

	renderStatus: function(services) {
		var svc = (services || {})['filescodebox'];
		var instances = (svc && svc.instances) || {};
		var running = Object.keys(instances).some(function(k) {
			return instances[k] && instances[k].running;
		});

		var port = uci.get('filescodebox', 'main', 'port') || '12345';
		var dataDir = uci.get('filescodebox', 'main', 'data_dir') || '/etc/filescodebox/data';
		var url = 'http://' + window.location.hostname + ':' + port + '/';

		var badge = running
			? E('span', { 'class': 'label label-success' }, _('运行中'))
			: E('span', { 'class': 'label label-important' }, _('未运行'));

		var self = this;

		var openBtn = running
			? E('a', {
				'class': 'btn cbi-button cbi-button-apply',
				'href': url,
				'target': '_blank',
				'rel': 'noopener'
			}, [ _('打开 FilesCodeBox 界面 ↗') ])
			: E('a', {
				'class': 'btn cbi-button cbi-button-negative',
				'href': url,
				'target': '_blank',
				'rel': 'noopener',
				'style': 'opacity:.45'
			}, [ _('界面暂不可达(服务未运行) ↗') ]);

		var ctlBtn = function(action, label, cls) {
			return E('button', {
				'class': 'btn cbi-button cbi-button-' + (cls || 'neutral'),
				'click': ui.createHandlerFn(self, 'handleAction', action)
			}, [ label ]);
		};

		return E('div', {}, [
			E('table', { 'class': 'table' }, [
				E('tr', {}, [
					E('td', { 'style': 'width:33%' }, _('服务状态')),
					E('td', {}, [badge])
				]),
				E('tr', {}, [
					E('td', {}, _('访问端口')),
					E('td', {}, [port])
				]),
				E('tr', {}, [
					E('td', {}, _('数据目录')),
					E('td', {}, [dataDir])
				]),
				E('tr', {}, [
					E('td', {}, _('管理入口')),
					E('td', {}, [url])
				])
			]),
			E('div', { 'class': 'cbi-page-actions' }, [
				running ? ctlBtn('restart', _('重启'), 'restart') : null,
				running ? ctlBtn('stop', _('停止'), 'negative') : ctlBtn('start', _('启动'), 'positive'),
				openBtn
			])
		]);
	},

	render: function(results) {
		var self = this;

		var body = E([
			E('h2', {}, _('FilesCodeBox 文件快递柜')),
			E('div', { 'class': 'cbi-map-descr' },
				_('匿名口令分享文本/文件。服务状态经 procd 实时查询,启停/重启按钮等价于 /etc/init.d/filescodebox 操作。')),
			E('div', { 'class': 'cbi-section' }, [
				E('div', { 'class': 'cbi-section-descr' }, _('服务')),
				E('div', { 'id': 'filescodebox-main' }, self.renderStatus(results[1]))
			]),
			E('div', { 'class': 'cbi-section' }, [
				E('div', { 'class': 'cbi-section-descr' }, _('提示')),
				E('div', { 'class': 'cbi-value' },
					_('默认管理员 admin / admin123,装完请尽快在网页设置里修改。')),
				E('div', { 'class': 'cbi-value' },
					_('配置在 /etc/config/filescodebox(UCI),改完执行 /etc/init.d/filescodebox reload 或点上方"重启"。')),
				E('div', { 'class': 'cbi-value' },
					_('上传文件与数据库存于数据目录,大容量场景建议在 UCI data_dir 指到数据盘。'))
			])
		]);

		return body;
	},

	handleSave: null,
	handleSaveApply: null,
	handleReset: null
});
